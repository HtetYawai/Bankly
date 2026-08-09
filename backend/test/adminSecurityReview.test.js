import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import express from "express";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

import adminRoutes from "../src/routes/admin.route.js";
import { verifyAdminToken } from "../src/lib/adminToken.js";
import { freezeUser } from "../src/controllers/adminUser.controller.js";
import { getUsers, revokeUserSessions } from "../src/controllers/adminUser.controller.js";
import { updateSettings } from "../src/controllers/adminSettings.controller.js";
import { login as customerLogin } from "../src/controllers/auth.controller.js";
import { adminChangePassword } from "../src/controllers/adminAuth.controller.js";
import User from "../src/models/user.model.js";
import Admin from "../src/models/admin.model.js";
import Notification from "../src/models/notification.model.js";
import AdminAuditLog from "../src/models/adminAuditLog.model.js";
import SystemSettings from "../src/models/systemSettings.model.js";

process.env.ADMIN_JWT_SECRET = "test-admin-secret-that-is-not-used-in-production";
process.env.JWT_SECRET = "test-customer-secret-that-is-not-used-in-production";

function responseRecorder() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test("cross-site browser requests are rejected before admin authentication", async () => {
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use("/api/admin", adminRoutes);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/admin/auth/login`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://attacker.example",
        "sec-fetch-site": "cross-site",
      },
      body: JSON.stringify({ email: "admin@example.com", password: "irrelevant" }),
    });
    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), {
      code: "CSRF_REJECTED",
      message: "Request origin is not allowed.",
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("admin token verification only accepts HS256", () => {
  const token = jwt.sign(
    { sub: new mongoose.Types.ObjectId().toString(), role: "admin", aud: "admin-portal" },
    process.env.ADMIN_JWT_SECRET,
    { algorithm: "HS384" }
  );
  assert.throws(() => verifyAdminToken(token));
});

test("customer model serialization never exposes password or session version", () => {
  const user = new User({
    fullName: "Customer",
    email: "customer@example.com",
    phone: "0812345678",
    password: "plaintext-test-value",
    sessionVersion: 7,
  });
  const payload = user.toJSON();
  assert.equal(payload.password, undefined);
  assert.equal(payload.sessionVersion, undefined);
});

test("customer login response explicitly omits password and session metadata", async (t) => {
  const customer = {
    _id: new mongoose.Types.ObjectId(),
    fullName: "Customer",
    email: "customer@example.com",
    phone: "0812345678",
    password: "$2b$10$not-used",
    sessionVersion: 9,
    accountNumber: "AC123",
    balance: 100,
    accountStatus: "ACTIVE",
  };
  t.mock.method(User, "findOne", () => ({ select: async () => customer }));
  const bcrypt = await import("bcryptjs");
  t.mock.method(bcrypt.default, "compare", async () => true);
  const res = responseRecorder();
  res.cookie = () => res;
  await customerLogin({ body: { email: customer.email, password: "correct" } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.user.password, undefined);
  assert.equal(res.body.user.sessionVersion, undefined);
});

test("admin user list uses an allowlist projection", async (t) => {
  let projection = "";
  const query = {
    select(value) { projection = value; return this; },
    sort() { return this; },
    skip() { return this; },
    limit() { return this; },
    then(resolve) { resolve([]); },
  };
  t.mock.method(User, "find", () => query);
  t.mock.method(User, "countDocuments", async () => 0);
  const res = responseRecorder();
  await getUsers({ query: {} }, res);
  assert.equal(res.statusCode, 200);
  assert.match(projection, /fullName/);
  assert.doesNotMatch(projection, /password|sessionVersion|qrCode|notifications/);
});

test("freeze reason is bounded before a database session is opened", async (t) => {
  const startSession = t.mock.method(mongoose, "startSession", async () => {
    throw new Error("must not be called");
  });
  const res = responseRecorder();
  await freezeUser({
    params: { userId: new mongoose.Types.ObjectId().toString() },
    body: { reason: "x".repeat(1001) },
  }, res);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /cannot exceed 1000/);
  assert.equal(startSession.mock.callCount(), 0);
});

test("freeze aborts when its audit record cannot be written", async (t) => {
  let committed = false;
  let aborted = false;
  const activeSession = {
    startTransaction() {},
    async commitTransaction() { committed = true; },
    async abortTransaction() { aborted = true; },
    endSession() {},
  };
  const user = {
    _id: new mongoose.Types.ObjectId(),
    accountStatus: "ACTIVE",
    sessionVersion: 0,
    async save({ session }) { assert.equal(session, activeSession); },
  };
  t.mock.method(mongoose, "startSession", async () => activeSession);
  t.mock.method(User, "findById", () => ({ session: async () => user }));
  t.mock.method(Notification, "create", async () => []);
  t.mock.method(AdminAuditLog, "create", async () => { throw new Error("audit unavailable"); });

  const res = responseRecorder();
  await freezeUser({
    params: { userId: user._id.toString() },
    body: { reason: "Security review" },
    admin: { _id: new mongoose.Types.ObjectId() },
    get: () => "test",
  }, res);

  assert.equal(res.statusCode, 500);
  assert.equal(committed, false);
  assert.equal(aborted, true);
});

test("settings update and audit use one transaction and fail together", async (t) => {
  let ended = false;
  const activeSession = {
    async withTransaction(work) { await work(); },
    async endSession() { ended = true; },
  };
  const previous = {
    _id: new mongoose.Types.ObjectId(),
    applicationName: "Bankly",
    currency: "THB",
    minimumTransferAmount: 1,
    maximumTransferAmount: 25000,
    dailyTransferLimit: 100000,
    transferFee: 0,
    withdrawalFee: 0,
    maintenanceMode: false,
  };
  let call = 0;
  t.mock.method(mongoose, "startSession", async () => activeSession);
  t.mock.method(SystemSettings, "findOneAndUpdate", (_filter, _update, options) => {
    assert.equal(options.session, activeSession);
    call += 1;
    return { lean: async () => call === 1 ? previous : { ...previous, maintenanceMode: true } };
  });
  t.mock.method(AdminAuditLog, "create", async (_entries, options) => {
    assert.equal(options.session, activeSession);
    throw new Error("audit unavailable");
  });

  const res = responseRecorder();
  await updateSettings({
    body: { maintenanceMode: true },
    admin: { _id: new mongoose.Types.ObjectId() },
    get: () => "test",
  }, res);
  assert.equal(res.statusCode, 500);
  assert.equal(ended, true);
});

test("session revocation fails closed when its audit record fails", async (t) => {
  let ended = false;
  const activeSession = {
    async withTransaction(work) { await work(); },
    async endSession() { ended = true; },
  };
  const user = { _id: new mongoose.Types.ObjectId(), sessionVersion: 2 };
  t.mock.method(mongoose, "startSession", async () => activeSession);
  t.mock.method(User, "findByIdAndUpdate", async (_id, _update, options) => {
    assert.equal(options.session, activeSession);
    return user;
  });
  t.mock.method(AdminAuditLog, "create", async () => { throw new Error("audit unavailable"); });
  const res = responseRecorder();
  await revokeUserSessions({
    params: { userId: user._id.toString() },
    admin: { _id: new mongoose.Types.ObjectId() },
    get: () => "test",
  }, res);
  assert.equal(res.statusCode, 500);
  assert.equal(ended, true);
});

test("admin password change does not clear the cookie when audit persistence fails", async (t) => {
  let cookieCleared = false;
  const activeSession = {
    async withTransaction(work) { await work(); },
    async endSession() {},
  };
  const admin = {
    _id: new mongoose.Types.ObjectId(),
    tokenVersion: 0,
    passwordHash: "old",
    async comparePassword() { return true; },
    async save({ session }) { assert.equal(session, activeSession); },
  };
  t.mock.method(Admin, "findById", () => ({ select: async () => admin }));
  t.mock.method(mongoose, "startSession", async () => activeSession);
  t.mock.method(AdminAuditLog, "create", async () => { throw new Error("audit unavailable"); });
  const res = responseRecorder();
  res.cookie = () => { cookieCleared = true; return res; };
  await adminChangePassword({
    body: {
      currentPassword: "CurrentPassword1!",
      newPassword: "ReplacementPassword1!",
      confirmPassword: "ReplacementPassword1!",
    },
    admin: { _id: admin._id },
    get: () => "test",
  }, res);
  assert.equal(res.statusCode, 500);
  assert.equal(cookieCleared, false);
});
