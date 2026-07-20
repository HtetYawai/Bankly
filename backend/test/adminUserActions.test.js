import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

import { freezeUser, unfreezeUser } from "../src/controllers/adminUser.controller.js";
import User from "../src/models/user.model.js";
import Notification from "../src/models/notification.model.js";
import AdminAuditLog from "../src/models/adminAuditLog.model.js";

function responseRecorder() {
  return { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}

function session() {
  return { startTransaction() {}, async commitTransaction() {}, async abortTransaction() {}, endSession() {} };
}

function userQuery(user) {
  return { session: async () => user };
}

test("admin freeze and unfreeze transitions are audited", async (t) => {
  const activeSession = session();
  const audits = [];
  const notifications = [];
  const user = {
    _id: new mongoose.Types.ObjectId(),
    accountStatus: "ACTIVE",
    frozenReason: null,
    frozenAt: null,
    unfrozenAt: null,
    sessionVersion: 0,
    async save(options) { assert.equal(options.session, activeSession); },
  };
  t.mock.method(mongoose, "startSession", async () => activeSession);
  t.mock.method(User, "findById", () => userQuery(user));
  t.mock.method(Notification, "create", async (entries, options) => { assert.equal(options.session, activeSession); notifications.push(entries[0]); return entries; });
  t.mock.method(AdminAuditLog, "create", async (entries, options) => { assert.equal(options.session, activeSession); const entry = Array.isArray(entries) ? entries[0] : entries; audits.push(entry); return entries; });
  const request = (reason) => ({ params: { userId: user._id.toString() }, body: { reason }, admin: { _id: new mongoose.Types.ObjectId() }, ip: "127.0.0.1", get: () => "test" });

  await t.test("admin can freeze an active user", async () => {
    const res = responseRecorder();
    await freezeUser(request("Risk review"), res);
    assert.equal(res.statusCode, 200);
    assert.equal(user.accountStatus, "FROZEN");
    assert.equal(user.sessionVersion, 1);
    assert.equal(audits.at(-1).action, "USER_FROZEN");
    assert.equal(notifications.length, 1);
  });

  await t.test("admin cannot freeze an already-frozen user", async () => {
    const auditCount = audits.length;
    const res = responseRecorder();
    await freezeUser(request("Duplicate freeze"), res);
    assert.equal(res.statusCode, 409);
    assert.equal(res.body.message, "Account is already frozen.");
    assert.equal(audits.length, auditCount);
  });

  await t.test("admin can unfreeze a frozen user and records an audit log", async () => {
    const res = responseRecorder();
    await unfreezeUser(request("Review complete"), res);
    assert.equal(res.statusCode, 200);
    assert.equal(user.accountStatus, "ACTIVE");
    assert.equal(audits.at(-1).action, "USER_UNFROZEN");
    assert.equal(notifications.length, 2);
  });
});
