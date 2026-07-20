import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import express from "express";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

import adminRoutes from "../src/routes/admin.route.js";
import authRoutes from "../src/routes/auth.route.js";
import Admin from "../src/models/admin.model.js";
import AdminAuditLog from "../src/models/adminAuditLog.model.js";
import User from "../src/models/user.model.js";

process.env.ADMIN_JWT_SECRET = "test-admin-secret-that-is-not-used-in-production";

function query(value) {
  return { select: async () => value };
}

function adminDocument({ password = "CorrectPassword1!", status = "ACTIVE" } = {}) {
  return {
    _id: new mongoose.Types.ObjectId(),
    name: "System Administrator",
    email: "admin@example.com",
    passwordHash: "never-return-this-hash",
    status,
    failedLoginAttempts: 0,
    lockedUntil: null,
    tokenVersion: 0,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    lastLoginAt: null,
    async comparePassword(candidate) { return candidate === password; },
    async save() {},
  };
}

async function withApi(run) {
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use("/api/admin", adminRoutes);
  app.use("/api/auth", authRoutes);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  try { await run(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise((resolve) => server.close(resolve)); }
}

function adminCookie(admin, overrides = {}) {
  const token = jwt.sign({
    sub: admin._id.toString(),
    role: "admin",
    aud: "admin-portal",
    tokenVersion: admin.tokenVersion,
    ...overrides,
  }, process.env.ADMIN_JWT_SECRET, { expiresIn: "1h" });
  return `adminToken=${token}`;
}

test("admin authentication and authorization HTTP boundaries", async (t) => {
  const audits = [];
  t.mock.method(AdminAuditLog, "create", async (entry) => {
    audits.push(Array.isArray(entry) ? entry[0] : entry);
    return entry;
  });

  await t.test("admin login succeeds and returns only safe fields", async (t) => {
    const admin = adminDocument();
    t.mock.method(Admin, "findOne", () => query(admin));
    await withApi(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/admin/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "admin@example.com", password: "CorrectPassword1!" }),
      });
      assert.equal(response.status, 200);
      assert.match(response.headers.get("set-cookie"), /adminToken=/);
      const body = await response.json();
      assert.equal(body.email, admin.email);
      assert.equal(body.passwordHash, undefined);
      assert.equal(body.token, undefined);
      assert.equal(body.tokenVersion, undefined);
    });
  });

  await t.test("incorrect credentials fail with the generic response", async (t) => {
    const admin = adminDocument();
    t.mock.method(Admin, "findOne", () => query(admin));
    await withApi(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/admin/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: admin.email, password: "wrong" }),
      });
      assert.equal(response.status, 401);
      assert.deepEqual(await response.json(), { message: "Invalid credentials." });
    });
  });

  await t.test("five failed attempts lock the admin account", async (t) => {
    const admin = adminDocument();
    t.mock.method(Admin, "findOne", () => query(admin));
    await withApi(async (baseUrl) => {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const response = await fetch(`${baseUrl}/api/admin/auth/login`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email: admin.email, password: "wrong" }),
        });
        assert.equal(response.status, 401);
      }
      assert.equal(admin.failedLoginAttempts, 5);
      assert.equal(admin.status, "LOCKED");
      assert.ok(admin.lockedUntil > new Date());
      assert.ok(audits.some((entry) => entry.action === "ADMIN_LOGIN_FAILED"));
    });
  });

  await t.test("unauthenticated and normal-user tokens cannot access admin APIs", async () => {
    await withApi(async (baseUrl) => {
      const noCookie = await fetch(`${baseUrl}/api/admin/users`);
      assert.equal(noCookie.status, 401);

      const normalUserToken = jwt.sign({ sub: new mongoose.Types.ObjectId().toString(), role: "user", aud: "admin-portal" }, process.env.ADMIN_JWT_SECRET);
      const normalUser = await fetch(`${baseUrl}/api/admin/users`, { headers: { cookie: `adminToken=${normalUserToken}` } });
      assert.equal(normalUser.status, 401);
    });
  });

  await t.test("audit logs expose no edit or delete routes", async (t) => {
    const admin = adminDocument();
    t.mock.method(Admin, "findById", async () => admin);
    await withApi(async (baseUrl) => {
      for (const method of ["PUT", "PATCH", "DELETE"]) {
        const response = await fetch(`${baseUrl}/api/admin/audit-logs`, { method, headers: { cookie: adminCookie(admin) } });
        assert.equal(response.status, 404);
      }
    });
  });

  await t.test("admin profile response never returns password hashes or tokens", async (t) => {
    const admin = adminDocument();
    t.mock.method(Admin, "findById", async () => admin);
    await withApi(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/admin/auth/me`, { headers: { cookie: adminCookie(admin) } });
      assert.equal(response.status, 200);
      const body = await response.json();
      assert.equal(body.passwordHash, undefined);
      assert.equal(body.tokenVersion, undefined);
      assert.equal(body.token, undefined);
    });
  });

  await t.test("existing customer account endpoint still accepts customer authentication", async (t) => {
    const customerId = new mongoose.Types.ObjectId().toString();
    const customer = { _id: customerId, sessionVersion: 0, fullName: "Customer", balance: 500, accountStatus: "ACTIVE" };
    t.mock.method(User, "findById", () => query(customer));
    const customerToken = jwt.sign({ id: customerId, sessionVersion: 0 }, "secret");
    await withApi(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/auth/me`, { headers: { cookie: `token=${customerToken}` } });
      assert.equal(response.status, 200);
      const body = await response.json();
      assert.equal(body.fullName, "Customer");
      assert.equal(body.balance, 500);
    });
  });
});
