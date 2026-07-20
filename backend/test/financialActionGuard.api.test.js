import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import express from "express";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";

import authRoutes from "../src/routes/auth.route.js";
import transactionRoutes from "../src/routes/transaction.route.js";
import transferRoutes from "../src/routes/transfer.route.js";
import User from "../src/models/user.model.js";
import Transaction from "../src/models/transaction.model.js";

const USER_ID = "507f1f77bcf86cd799439011";

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
  app.use("/api/transactions", transactionRoutes);
  app.use("/api/transfer", transferRoutes);

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
  const token = jwt.sign({ id: USER_ID, sessionVersion: 0 }, "secret");
  return `token=${token}`;
}

test("frozen user is rejected by the transfer API with ACCOUNT_FROZEN", async (t) => {
  t.mock.method(User, "findById", () =>
    queryReturning({ _id: USER_ID, sessionVersion: 0, accountStatus: "FROZEN" })
  );

  await withApi(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/transfer`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: authCookie() },
      body: JSON.stringify({ receiverAcc: "AC1234567890", amount: 100 }),
    });

    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), {
      code: "ACCOUNT_FROZEN",
      message: "This account is frozen. Contact support for assistance.",
    });
  });
});

test("frozen user can still view account status and wallet balance", async (t) => {
  const frozenUser = {
    _id: USER_ID,
    sessionVersion: 0,
    accountStatus: "FROZEN",
    balance: 4250,
  };
  t.mock.method(User, "findById", () => queryReturning(frozenUser));

  await withApi(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { cookie: authCookie() },
    });

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.accountStatus, "FROZEN");
    assert.equal(body.balance, 4250);
  });
});

test("frozen user can still view transaction history", async (t) => {
  t.mock.method(User, "findById", () =>
    queryReturning({ _id: USER_ID, sessionVersion: 0, accountStatus: "FROZEN" })
  );

  const chain = {
    populate() { return this; },
    sort: async () => [{ transactionId: "TXN-READ-ONLY", amount: 25 }],
  };
  t.mock.method(Transaction, "find", () => chain);

  await withApi(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/transactions`, {
      headers: { cookie: authCookie() },
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), [
      { transactionId: "TXN-READ-ONLY", amount: 25 },
    ]);
  });
});
