import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import express from "express";
import cookieParser from "cookie-parser";
import mongoose from "mongoose";

import adminRoutes from "../src/routes/admin.route.js";
import {
  AdjustmentError,
  performBalanceAdjustment,
  validateAdjustmentInput,
} from "../src/controllers/adminAdjustment.controller.js";

const WALLET_ID = new mongoose.Types.ObjectId();
const ADMIN_ID = new mongoose.Types.ObjectId();

function query(resolveValue) {
  return {
    select() { return this; },
    session(session) { this.activeSession = session; return this; },
    async lean() { return typeof resolveValue === "function" ? resolveValue(this.activeSession) : resolveValue; },
  };
}

function fakeDatabase(startingBalance = 100) {
  const state = {
    wallet: { _id: WALLET_ID, fullName: "Wallet Owner", accountNumber: "AC1234567890", balance: startingBalance },
    transactions: [],
    ledgers: [],
    audits: [],
    notifications: [],
  };

  function recordInsert(session, collection, document) {
    collection.push(document);
    session.undo.push(() => collection.splice(collection.indexOf(document), 1));
  }

  const dependencies = {
    startSession: async () => ({
      undo: [],
      async withTransaction(work) {
        try {
          await work();
          this.undo = [];
        } catch (error) {
          for (const undo of this.undo.reverse()) undo();
          throw error;
        }
      },
      async endSession() {},
    }),
    User: {
      findOneAndUpdate(filter, update, options) {
        assert.ok(options.session);
        return query(() => {
          if (!state.wallet || !state.wallet._id.equals(filter._id)) return null;
          if (filter.balance?.$gte !== undefined && state.wallet.balance < filter.balance.$gte) return null;
          const previous = state.wallet.balance;
          options.session.undo.push(() => { state.wallet.balance = previous; });
          state.wallet.balance += update.$inc.balance;
          return { ...state.wallet };
        });
      },
      findById(id) {
        return query(() => state.wallet && state.wallet._id.equals(id) ? { _id: state.wallet._id } : null);
      },
    },
    Transaction: {
      findOne({ adjustmentKey }) {
        return query(() => state.transactions.find((item) => item.adjustmentKey === adjustmentKey) ?? null);
      },
      async create([document], { session }) {
        assert.ok(session);
        if (state.transactions.some((item) => item.adjustmentKey === document.adjustmentKey)) {
          const error = Object.assign(new Error("duplicate"), {
            code: 11000,
            keyPattern: { adjustmentKey: 1 },
          });
          throw error;
        }
        const saved = { ...document, _id: new mongoose.Types.ObjectId() };
        recordInsert(session, state.transactions, saved);
        return [saved];
      },
    },
    Ledger: {
      async create([document], { session }) {
        assert.ok(session);
        recordInsert(session, state.ledgers, document);
        return [document];
      },
    },
    Notification: {
      async create([document], { session }) {
        assert.ok(session);
        recordInsert(session, state.notifications, document);
        return [document];
      },
    },
    async createAuditLog(entry) {
      assert.ok(entry.session);
      recordInsert(entry.session, state.audits, entry);
    },
  };
  return { state, dependencies };
}

function input(overrides = {}) {
  return validateAdjustmentInput({
    type: "CREDIT",
    amount: 25.5,
    reason: "Manual correction",
    idempotencyKey: "adjustment-1",
    ...overrides,
  });
}

function adjust(database, adjustmentInput) {
  return performBalanceAdjustment({
    walletId: WALLET_ID,
    adminId: ADMIN_ID,
    input: adjustmentInput,
    req: {},
    dependencies: database.dependencies,
  });
}

test("credit success writes the balance, transaction, ledger, audit, and notification", async () => {
  const database = fakeDatabase(100);
  const result = await adjust(database, input());
  assert.equal(result.newBalance, 125.5);
  assert.equal(database.state.wallet.balance, 125.5);
  assert.equal(database.state.transactions.length, 1);
  assert.equal(database.state.ledgers[0].balanceBefore, 100);
  assert.equal(database.state.ledgers[0].balanceAfter, 125.5);
  assert.equal(database.state.audits.length, 1);
  assert.equal(database.state.notifications.length, 1);
});

test("debit success returns the authoritative new balance", async () => {
  const database = fakeDatabase(100);
  const result = await adjust(database, input({ type: "DEBIT", amount: 40 }));
  assert.equal(result.newBalance, 60);
  assert.equal(database.state.transactions.length, 1);
  assert.equal(database.state.transactions[0].type, "ADMIN_DEBIT");
  assert.equal(database.state.ledgers.length, 1);
  assert.equal(database.state.ledgers[0].type, "DEBIT");
});

test("debit rejects insufficient balance without writes", async () => {
  const database = fakeDatabase(10);
  await assert.rejects(adjust(database, input({ type: "DEBIT", amount: 11 })),
    (error) => error instanceof AdjustmentError && error.code === "INSUFFICIENT_BALANCE");
  assert.equal(database.state.wallet.balance, 10);
  assert.equal(database.state.transactions.length, 0);
  assert.equal(database.state.ledgers.length, 0);
  assert.equal(database.state.audits.length, 0);
  assert.equal(database.state.notifications.length, 0);
});

test("invalid amounts reject zero, negative, and sub-minor-unit values", () => {
  for (const amount of [0, -1, 1.001, NaN, "10"]) {
    assert.throws(() => input({ amount }), (error) => error.code === "INVALID_AMOUNT");
  }
});

test("missing wallet returns WALLET_NOT_FOUND", async () => {
  const database = fakeDatabase();
  database.state.wallet = null;
  await assert.rejects(adjust(database, input()), (error) => error.code === "WALLET_NOT_FOUND");
});

test("duplicate idempotency key rejects the second adjustment", async () => {
  const database = fakeDatabase(100);
  await adjust(database, input());
  await assert.rejects(adjust(database, input()), (error) => error.code === "DUPLICATE_ADJUSTMENT");
  assert.equal(database.state.wallet.balance, 125.5);
  assert.equal(database.state.transactions.length, 1);
});

test("unauthorized adjustment request is rejected by the real admin route", async () => {
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use("/api/admin", adminRoutes);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/admin/wallets/${WALLET_ID}/adjustments`, {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": "unauthorized" },
      body: JSON.stringify({ type: "CREDIT", amount: 10, reason: "test" }),
    });
    assert.equal(response.status, 401);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("concurrent debit attempts cannot overdraw the wallet", async () => {
  const database = fakeDatabase(100);
  const results = await Promise.allSettled([
    adjust(database, input({ type: "DEBIT", amount: 80, idempotencyKey: "debit-a" })),
    adjust(database, input({ type: "DEBIT", amount: 80, idempotencyKey: "debit-b" })),
  ]);
  assert.equal(results.filter((item) => item.status === "fulfilled").length, 1);
  assert.equal(results.filter((item) => item.status === "rejected" && item.reason.code === "INSUFFICIENT_BALANCE").length, 1);
  assert.equal(database.state.wallet.balance, 20);
});

test("an injected post-ledger failure rolls back every financial write", async () => {
  const database = fakeDatabase(100);
  database.dependencies.createAuditLog = async () => { throw new Error("injected audit failure"); };
  await assert.rejects(adjust(database, input()), /injected audit failure/);
  assert.equal(database.state.wallet.balance, 100);
  assert.equal(database.state.transactions.length, 0);
  assert.equal(database.state.ledgers.length, 0);
  assert.equal(database.state.audits.length, 0);
  assert.equal(database.state.notifications.length, 0);
});
