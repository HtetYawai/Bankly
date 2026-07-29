import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import express from "express";
import cookieParser from "cookie-parser";
import bcrypt from "bcryptjs";

import authRoutes from "../src/routes/auth.route.js";
import User from "../src/models/user.model.js";

process.env.JWT_SECRET = "test-customer-secret-that-is-not-used-in-production";

const CORRECT_PASSWORD = "correct-password-123";
const PASSWORD_HASH = bcrypt.hashSync(CORRECT_PASSWORD, 10);

function makeUser(overrides = {}) {
  return {
    _id: "507f1f77bcf86cd799439011",
    fullName: "Test User",
    email: "user@test.com",
    phone: "0812345678",
    accountNumber: "AC1234567890",
    qrCode: "bankapp://pay?acc=AC1234567890",
    balance: 1000,
    accountStatus: "ACTIVE",
    sessionVersion: 0,
    failedLoginAttempts: 0,
    lockedUntil: null,
    password: PASSWORD_HASH,
    createdAt: new Date(),
    updatedAt: new Date(),
    save: async function () {},
    ...overrides,
  };
}

async function withApi(run) {
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use("/api/auth", authRoutes);

  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");

  try {
    const { port } = server.address();
    await run(`http://127.0.0.1:${port}`);
  } finally {
    if (server.listening) {
      await new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve()))
      );
    }
  }
}

function postLogin(baseUrl, body) {
  return fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

test("unknown email is rejected with the same generic message as a wrong password", async (t) => {
  t.mock.method(User, "findOne", () => ({ select: async () => null }));

  await withApi(async (baseUrl) => {
    const response = await postLogin(baseUrl, {
      email: "nobody@test.com",
      password: "whatever123",
    });

    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), {
      message: "Invalid email or password",
    });
  });
});

test("wrong password is rejected and increments failedLoginAttempts", async (t) => {
  const user = makeUser();
  t.mock.method(User, "findOne", () => ({ select: async () => user }));

  await withApi(async (baseUrl) => {
    const response = await postLogin(baseUrl, {
      email: user.email,
      password: "totally-wrong",
    });

    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), {
      message: "Invalid email or password",
    });
  });

  assert.equal(user.failedLoginAttempts, 1);
});

test("account locks out after 5 failed attempts and rejects even the correct password while locked", async (t) => {
  const user = makeUser();
  t.mock.method(User, "findOne", () => ({ select: async () => user }));

  await withApi(async (baseUrl) => {
    for (let i = 0; i < 5; i++) {
      const response = await postLogin(baseUrl, {
        email: user.email,
        password: "totally-wrong",
      });
      assert.equal(response.status, 401);
    }

    assert.equal(user.failedLoginAttempts, 5);
    assert.ok(user.lockedUntil instanceof Date && user.lockedUntil > new Date());

    const lockedResponse = await postLogin(baseUrl, {
      email: user.email,
      password: CORRECT_PASSWORD,
    });

    assert.equal(lockedResponse.status, 401);
    assert.deepEqual(await lockedResponse.json(), {
      message: "Invalid email or password",
    });
  });
});

test("correct password succeeds and resets lockout state", async (t) => {
  const user = makeUser({ failedLoginAttempts: 2 });
  t.mock.method(User, "findOne", () => ({ select: async () => user }));

  await withApi(async (baseUrl) => {
    const response = await postLogin(baseUrl, {
      email: user.email,
      password: CORRECT_PASSWORD,
    });

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.user.email, user.email);
  });

  assert.equal(user.failedLoginAttempts, 0);
  assert.equal(user.lockedUntil, null);
});
