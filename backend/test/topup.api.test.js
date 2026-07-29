import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import express from "express";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";

import authRoutes from "../src/routes/auth.route.js";
import topupRoutes from "../src/routes/topup.route.js";
import User from "../src/models/user.model.js";

const USER_ID = "507f1f77bcf86cd799439011";
process.env.JWT_SECRET = "test-customer-secret-that-is-not-used-in-production";

function queryReturning(value) {
  return {
    select: async () => value,
  };
}

async function withApi(run) {
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use("/api/auth", authRoutes);
  app.use("/api/topup", topupRoutes);

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

function authCookie() {
  const token = jwt.sign({ id: USER_ID, sessionVersion: 0 }, process.env.JWT_SECRET);
  return `token=${token}`;
}

function postTopup(baseUrl, body) {
  return fetch(`${baseUrl}/api/topup`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: authCookie() },
    body: JSON.stringify(body),
  });
}

test("frozen user is rejected by the topup API with ACCOUNT_FROZEN", async (t) => {
  t.mock.method(User, "findById", () =>
    queryReturning({ _id: USER_ID, sessionVersion: 0, accountStatus: "FROZEN" })
  );

  await withApi(async (baseUrl) => {
    const response = await postTopup(baseUrl, {
      provider: "AIS",
      accountRef: "0812345678",
      amount: 100,
    });

    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), {
      code: "ACCOUNT_FROZEN",
      message: "This account is frozen. Contact support for assistance.",
    });
  });
});

test("unknown provider is rejected with INVALID_PROVIDER", async (t) => {
  t.mock.method(User, "findById", () =>
    queryReturning({ _id: USER_ID, sessionVersion: 0, accountStatus: "ACTIVE" })
  );

  await withApi(async (baseUrl) => {
    const response = await postTopup(baseUrl, {
      provider: "NotARealProvider",
      accountRef: "0812345678",
      amount: 100,
    });

    assert.equal(response.status, 400);
    const body = await response.json();
    assert.equal(body.code, "INVALID_PROVIDER");
  });
});

test("PromptPay is not accepted as a topup provider (it goes through /transfer instead)", async (t) => {
  t.mock.method(User, "findById", () =>
    queryReturning({ _id: USER_ID, sessionVersion: 0, accountStatus: "ACTIVE" })
  );

  await withApi(async (baseUrl) => {
    const response = await postTopup(baseUrl, {
      provider: "PromptPay",
      accountRef: "0812345678",
      amount: 100,
    });

    assert.equal(response.status, 400);
    const body = await response.json();
    assert.equal(body.code, "INVALID_PROVIDER");
  });
});

test("too-short reference number is rejected with INVALID_REFERENCE", async (t) => {
  t.mock.method(User, "findById", () =>
    queryReturning({ _id: USER_ID, sessionVersion: 0, accountStatus: "ACTIVE" })
  );

  await withApi(async (baseUrl) => {
    const response = await postTopup(baseUrl, {
      provider: "AIS",
      accountRef: "12",
      amount: 100,
    });

    assert.equal(response.status, 400);
    const body = await response.json();
    assert.equal(body.code, "INVALID_REFERENCE");
  });
});

test("non-positive amount is rejected with INVALID_AMOUNT", async (t) => {
  t.mock.method(User, "findById", () =>
    queryReturning({ _id: USER_ID, sessionVersion: 0, accountStatus: "ACTIVE" })
  );

  await withApi(async (baseUrl) => {
    const response = await postTopup(baseUrl, {
      provider: "AIS",
      accountRef: "0812345678",
      amount: -5,
    });

    assert.equal(response.status, 400);
    const body = await response.json();
    assert.equal(body.code, "INVALID_AMOUNT");
  });
});

test("GET /api/topup/providers never includes PromptPay", async (t) => {
  t.mock.method(User, "findById", () =>
    queryReturning({ _id: USER_ID, sessionVersion: 0, accountStatus: "ACTIVE" })
  );

  await withApi(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/topup/providers`, {
      headers: { cookie: authCookie() },
    });

    assert.equal(response.status, 200);
    const providers = await response.json();
    assert.ok(Array.isArray(providers) && providers.length > 0);
    assert.ok(!providers.some((p) => p.name === "PromptPay"));
  });
});
