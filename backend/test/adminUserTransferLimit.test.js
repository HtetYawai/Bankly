import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

import { updateUserTransferLimit } from "../src/controllers/adminUser.controller.js";
import User from "../src/models/user.model.js";
import Notification from "../src/models/notification.model.js";
import AdminAuditLog from "../src/models/adminAuditLog.model.js";

function responseRecorder() {
  return { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}

function session() {
  return { async withTransaction(work) { await work(); }, async endSession() {} };
}

function userQuery(user) {
  return { session: async () => user };
}

test("admin can set and clear a customer's per-transaction transfer limit", async (t) => {
  const activeSession = session();
  const audits = [];
  const notifications = [];
  const user = {
    _id: new mongoose.Types.ObjectId(),
    customMaximumTransferAmount: null,
    async save(options) { assert.equal(options.session, activeSession); },
  };
  t.mock.method(mongoose, "startSession", async () => activeSession);
  t.mock.method(User, "findById", () => userQuery(user));
  t.mock.method(Notification, "create", async (entries, options) => { assert.equal(options.session, activeSession); notifications.push(entries[0]); return entries; });
  t.mock.method(AdminAuditLog, "create", async (entries, options) => { assert.equal(options.session, activeSession); audits.push(Array.isArray(entries) ? entries[0] : entries); return entries; });
  const request = (body) => ({ params: { userId: user._id.toString() }, body, admin: { _id: new mongoose.Types.ObjectId() }, ip: "127.0.0.1", get: () => "test" });

  await t.test("rejects a missing reason", async () => {
    const res = responseRecorder();
    await updateUserTransferLimit(request({ maximumTransferAmount: 5000 }), res);
    assert.equal(res.statusCode, 400);
    assert.equal(audits.length, 0);
  });

  await t.test("rejects a negative amount", async () => {
    const res = responseRecorder();
    await updateUserTransferLimit(request({ maximumTransferAmount: -5, reason: "VIP tier" }), res);
    assert.equal(res.statusCode, 400);
    assert.equal(audits.length, 0);
  });

  await t.test("admin can set a custom limit", async () => {
    const res = responseRecorder();
    await updateUserTransferLimit(request({ maximumTransferAmount: 100000, reason: "VIP customer" }), res);
    assert.equal(res.statusCode, 200);
    assert.equal(user.customMaximumTransferAmount, 100000);
    assert.equal(audits.at(-1).action, "USER_TRANSFER_LIMIT_UPDATED");
    assert.equal(audits.at(-1).newData.customMaximumTransferAmount, 100000);
    assert.equal(notifications.length, 1);
  });

  await t.test("admin can clear the custom limit back to the default", async () => {
    const res = responseRecorder();
    await updateUserTransferLimit(request({ maximumTransferAmount: null, reason: "Back to standard tier" }), res);
    assert.equal(res.statusCode, 200);
    assert.equal(user.customMaximumTransferAmount, null);
    assert.equal(audits.at(-1).newData.customMaximumTransferAmount, null);
    assert.equal(notifications.length, 2);
  });
});

test("updating the limit for an unknown user returns 404", async (t) => {
  const activeSession = session();
  t.mock.method(mongoose, "startSession", async () => activeSession);
  t.mock.method(User, "findById", () => userQuery(null));

  const res = responseRecorder();
  await updateUserTransferLimit(
    {
      params: { userId: new mongoose.Types.ObjectId().toString() },
      body: { maximumTransferAmount: 1000, reason: "test" },
      admin: { _id: new mongoose.Types.ObjectId() },
      ip: "127.0.0.1",
      get: () => "test",
    },
    res
  );
  assert.equal(res.statusCode, 404);
});

test("an invalid userId format is rejected before touching the database", async () => {
  const res = responseRecorder();
  await updateUserTransferLimit({ params: { userId: "not-an-object-id" }, body: {} }, res);
  assert.equal(res.statusCode, 400);
});
