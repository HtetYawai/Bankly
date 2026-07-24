import dotenv from "dotenv";
dotenv.config();

import crypto from "crypto";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import Admin from "../models/admin.model.js";
import User from "../models/user.model.js";
import Transaction from "../models/transaction.model.js";
import Ledger from "../models/ledger.model.js";
import AdminAuditLog from "../models/adminAuditLog.model.js";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:5001";
const CUSTOMER_FIXTURE_PASSWORD = "E2eCustomerPass1!";
const checks = [];
let adminCookie = "";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function record(name, details = "") {
  checks.push({ name, details });
  console.log(`PASS ${name}${details ? ` — ${details}` : ""}`);
}

async function ensureCustomerFixture({
  email,
  fullName,
  phone,
  accountNumber,
  openingBalance,
}) {
  let user = await User.findOne({ email })
    .select("_id fullName email accountNumber balance sessionVersion accountStatus")
    .lean();
  if (!user) {
    const created = await User.create({
      fullName,
      email,
      phone,
      password: CUSTOMER_FIXTURE_PASSWORD,
      accountNumber,
      qrCode: `bankapp://pay?acc=${accountNumber}&name=${encodeURIComponent(fullName)}`,
      balance: openingBalance,
      accountStatus: "ACTIVE",
    });
    user = await User.findById(created._id)
      .select("_id fullName email accountNumber balance sessionVersion accountStatus")
      .lean();
  }
  if (user.accountStatus !== "ACTIVE") {
    await User.updateOne(
      { _id: user._id },
      { $set: { accountStatus: "ACTIVE", unfrozenAt: new Date() } }
    );
  }
  if (openingBalance > 0 && user.balance < openingBalance) {
    await User.updateOne(
      { _id: user._id, balance: user.balance },
      { $inc: { balance: openingBalance - user.balance } }
    );
  }
  const fixtureDocument = await User.findById(user._id).select("+password");
  fixtureDocument.password = CUSTOMER_FIXTURE_PASSWORD;
  await fixtureDocument.save();
  return User.findById(user._id)
    .select("_id fullName email accountNumber balance sessionVersion accountStatus")
    .lean();
}

function captureCookie(response) {
  const value = response.headers.get("set-cookie");
  if (!value) return;
  const match = value.match(/adminToken=([^;]*)/);
  if (match) adminCookie = `adminToken=${match[1]}`;
}

async function request(path, { method = "GET", body, customerCookie, expected = 200, useAdmin = true } = {}) {
  const headers = { accept: "application/json" };
  const cookie = customerCookie ?? (useAdmin ? adminCookie : "");
  if (cookie) headers.cookie = cookie;
  if (body !== undefined) headers["content-type"] = "application/json";
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  captureCookie(response);
  const text = await response.text();
  let payload;
  try { payload = text ? JSON.parse(text) : null; } catch { payload = text; }
  assert(response.status === expected, `${method} ${path}: expected ${expected}, got ${response.status}: ${text}`);
  return payload;
}

async function run() {
  assert(process.env.MONGODB_URL, "MONGODB_URL is required.");
  assert(process.env.JWT_SECRET, "JWT_SECRET is required.");
  assert(process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD, "Admin seed credentials are required.");

  const connection = await mongoose.connect(process.env.MONGODB_URL);
  try {
    const topology = await connection.connection.db.admin().command({ hello: 1 });
    assert(topology.setName || topology.msg === "isdbgrid", "MongoDB is not transaction capable.");
    const adminCount = await Admin.countDocuments();
    assert(adminCount === 1, `Expected exactly one admin, found ${adminCount}.`);
    record("Database validation", `${topology.setName ? `replica set ${topology.setName}` : "sharded cluster"}; one admin`);

    const target = await ensureCustomerFixture({
      email: "e2e.sender@bankly.test",
      fullName: "E2E Sender",
      phone: "0900000001",
      accountNumber: "AC9000000001",
      openingBalance: 10,
    });
    const receiver = await ensureCustomerFixture({
      email: "e2e.receiver@bankly.test",
      fullName: "E2E Receiver",
      phone: "0900000002",
      accountNumber: "AC9000000002",
      openingBalance: 0,
    });
    assert(target && receiver, "Unable to provision isolated E2E customer fixtures.");
    record("Customer fixtures", "isolated reusable sender and receiver");

    const login = await request("/api/admin/auth/login", {
      method: "POST",
      useAdmin: false,
      body: { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD },
    });
    assert(login.email === process.env.ADMIN_EMAIL.toLowerCase(), "Admin login returned the wrong identity.");
    assert(adminCookie, "Admin login did not set an admin cookie.");
    record("Admin login", login.email);

    const dashboard = await request("/api/admin/reports/dashboard");
    assert(Number.isFinite(dashboard.totalUsers) && Array.isArray(dashboard.recentTransactions), "Dashboard statistics are malformed.");
    record("Dashboard statistics", `${dashboard.totalUsers} users`);

    const users = await request("/api/admin/users?limit=20");
    assert(users.users.some((user) => user._id === target._id.toString()), "Target customer is missing from user list.");
    record("Admin user list", `${users.total} users`);

    const userDetails = await request(`/api/admin/users/${target._id}`);
    assert(userDetails.user._id === target._id.toString(), "User details returned the wrong customer.");
    record("Admin user details", target.fullName);

    const reason = `E2E freeze ${new Date().toISOString()}`;
    await request(`/api/admin/users/${target._id}/freeze`, {
      method: "PATCH",
      body: { reason },
    });
    record("Freeze customer", reason);

    const frozen = await User.findById(target._id).select("sessionVersion accountStatus").lean();
    assert(frozen.accountStatus === "FROZEN", "Database did not persist frozen status.");
    const frozenToken = jwt.sign(
      { id: target._id.toString(), sessionVersion: frozen.sessionVersion },
      process.env.JWT_SECRET,
      { expiresIn: "5m", algorithm: "HS256" }
    );
    const frozenTransfer = await request("/api/transfer", {
      method: "POST",
      useAdmin: false,
      customerCookie: `token=${frozenToken}`,
      body: { receiverAcc: receiver.accountNumber, amount: 0.01 },
      expected: 403,
    });
    assert(frozenTransfer.code === "ACCOUNT_FROZEN", "Frozen transfer did not return ACCOUNT_FROZEN.");
    record("Frozen transfer rejected", frozenTransfer.code);

    const freezeAudits = await request(`/api/admin/audit-logs?action=USER_FROZEN&entityId=${target._id}`);
    assert(freezeAudits.logs.some((log) => log.reason === reason), "Freeze audit record was not found.");
    record("Freeze audit visible");

    await request(`/api/admin/users/${target._id}/unfreeze`, {
      method: "PATCH",
      body: { reason: "E2E verification complete" },
    });
    record("Unfreeze customer");

    const active = await User.findById(target._id).select("sessionVersion accountStatus").lean();
    assert(active.accountStatus === "ACTIVE", "Database did not persist active status.");
    const activeToken = jwt.sign(
      { id: target._id.toString(), sessionVersion: active.sessionVersion },
      process.env.JWT_SECRET,
      { expiresIn: "5m", algorithm: "HS256" }
    );
    const customerCookie = `token=${activeToken}`;
    const transfer = await request("/api/transfer", {
      method: "POST",
      useAdmin: false,
      customerCookie,
      body: { receiverAcc: receiver.accountNumber, amount: 0.01 },
    });
    assert(transfer.success && transfer.transactionId, "Unfrozen transfer did not succeed.");
    record("Unfrozen transfer succeeds", transfer.transactionId);

    const walletBefore = await request(`/api/admin/wallets/${target._id}`);
    const creditAmount = 1.23;
    const referenceNumber = `E2E-${Date.now()}`;
    const idempotencyKey = crypto.randomUUID();
    const adjustmentResponse = await fetch(`${BASE_URL}/api/admin/wallets/${target._id}/adjustments`, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        cookie: adminCookie,
        "idempotency-key": idempotencyKey,
      },
      body: JSON.stringify({
        type: "CREDIT",
        amount: creditAmount,
        reason: "End-to-end verification credit",
        referenceNumber,
        note: "Automated E2E review",
      }),
    });
    const adjustment = await adjustmentResponse.json();
    assert(adjustmentResponse.status === 201, `Adjustment failed: ${JSON.stringify(adjustment)}`);
    const walletAfter = await request(`/api/admin/wallets/${target._id}`);
    assert(
      Math.abs(walletAfter.wallet.availableBalance - (walletBefore.wallet.availableBalance + creditAmount)) < 0.001,
      "Wallet balance did not increase by the credit amount."
    );
    const transaction = await Transaction.findById(adjustment.adjustment._id).lean();
    const ledger = await Ledger.findOne({ transactionId: adjustment.adjustment._id }).lean();
    assert(transaction?.reference === referenceNumber && ledger, "Adjustment transaction or ledger record is missing.");
    record("Credit adjustment persisted", `${referenceNumber}; balance ${walletAfter.wallet.availableBalance}`);

    const adjustmentAudit = await AdminAuditLog.findOne({
      action: "BALANCE_CREDIT_ADJUSTMENT",
      entityId: target._id,
      "newData.referenceNumber": referenceNumber,
    }).lean();
    assert(adjustmentAudit, "Adjustment audit record is missing.");
    record("Adjustment audit persisted");

    const transactionDetails = await request(`/api/admin/transactions/${transaction._id}`);
    assert(transactionDetails.transaction.reference === referenceNumber, "Transaction details returned the wrong adjustment.");
    assert(transactionDetails.ledgerEntries.length > 0, "Transaction details did not include ledger entries.");
    record("Transaction details", referenceNumber);

    const currentSettings = (await request("/api/admin/settings")).settings;
    const temporaryName = `${currentSettings.applicationName} E2E`;
    const updatedSettings = (await request("/api/admin/settings", {
      method: "PATCH",
      body: { applicationName: temporaryName },
    })).settings;
    assert(updatedSettings.applicationName === temporaryName, "Settings update was not persisted.");
    await request("/api/admin/settings", {
      method: "PATCH",
      body: { applicationName: currentSettings.applicationName },
    });
    record("System settings update and restore");

    const temporaryPassword = `${process.env.ADMIN_PASSWORD}-${crypto.randomBytes(8).toString("hex")}Aa1!`;
    await request("/api/admin/auth/change-password", {
      method: "POST",
      body: {
        currentPassword: process.env.ADMIN_PASSWORD,
        newPassword: temporaryPassword,
        confirmPassword: temporaryPassword,
      },
    });
    record("Admin password changed");

    adminCookie = "";
    await request("/api/admin/auth/login", {
      method: "POST",
      useAdmin: false,
      body: { email: process.env.ADMIN_EMAIL, password: temporaryPassword },
    });
    await request("/api/admin/auth/change-password", {
      method: "POST",
      body: {
        currentPassword: temporaryPassword,
        newPassword: process.env.ADMIN_PASSWORD,
        confirmPassword: process.env.ADMIN_PASSWORD,
      },
    });
    adminCookie = "";
    await request("/api/admin/auth/login", {
      method: "POST",
      useAdmin: false,
      body: { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD },
    });
    await request("/api/admin/auth/logout", { method: "POST" });
    await request("/api/admin/reports/dashboard", { expected: 401 });
    record("Logout protects admin routes");

    const customerLoginResponse = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify({ email: target.email, password: CUSTOMER_FIXTURE_PASSWORD }),
    });
    const customerLoginBody = await customerLoginResponse.json();
    assert(customerLoginResponse.status === 200, `Customer login failed: ${JSON.stringify(customerLoginBody)}`);
    const customerSetCookie = customerLoginResponse.headers.get("set-cookie") ?? "";
    const customerTokenMatch = customerSetCookie.match(/token=([^;]+)/);
    assert(customerTokenMatch, "Customer login did not issue the token cookie.");
    const authenticatedCustomerCookie = `token=${customerTokenMatch[1]}`;
    const me = await request("/api/auth/me", {
      useAdmin: false,
      customerCookie: authenticatedCustomerCookie,
    });
    assert(me._id === target._id.toString(), "Customer account endpoint failed after admin flow.");
    const history = await request("/api/transactions", {
      useAdmin: false,
      customerCookie: authenticatedCustomerCookie,
    });
    assert(Array.isArray(history) && history.some((item) => item.transactionId === transfer.transactionId), "Customer transaction history is unavailable.");
    record("Existing customer read flow");

    console.log(JSON.stringify({ passed: checks.length, checks }, null, 2));
  } finally {
    await mongoose.disconnect();
  }
}

run().catch(async (error) => {
  console.error(`FAIL ${error.message}`);
  if (mongoose.connection.readyState) await mongoose.disconnect();
  process.exitCode = 1;
});
