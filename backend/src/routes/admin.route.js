import express from "express";
import {
  adminLogin,
  adminLogout,
  adminGetMe,
  adminChangePassword,
} from "../controllers/adminAuth.controller.js";
import { getAuditLogs } from "../controllers/adminAuditLog.controller.js";
import { getWallets, getWalletById } from "../controllers/adminWallet.controller.js";
import { createWalletAdjustment } from "../controllers/adminAdjustment.controller.js";
import {
  getDashboardReport,
  getTransactionReport,
  getUserReport,
  getFrozenAccountsReport,
  getWalletBalancesReport,
} from "../controllers/adminReport.controller.js";
import { getSettings, updateSettings } from "../controllers/adminSettings.controller.js";
import {
  getAdminTransactions,
  getAdminTransactionById,
} from "../controllers/adminTransaction.controller.js";
import {
  getUsers,
  getUserById,
  freezeUser,
  unfreezeUser,
  revokeUserSessions,
  updateUserTransferLimit,
} from "../controllers/adminUser.controller.js";
import { requireAdmin } from "../middleware/adminAuth.middleware.js";
import { requireTrustedAdminOrigin } from "../middleware/adminCsrf.middleware.js";

const router = express.Router();

router.use(requireTrustedAdminOrigin);

// ── Public — no authentication required ──────────────────────────────────────
router.post("/auth/login", adminLogin);

// ── Protected — requireAdmin validates the adminToken cookie ─────────────────
router.post("/auth/logout",          requireAdmin, adminLogout);
router.get("/auth/me",               requireAdmin, adminGetMe);
router.post("/auth/change-password", requireAdmin, adminChangePassword);

// ── Audit logs — read-only, no update or delete routes ───────────────────────
router.get("/audit-logs", requireAdmin, getAuditLogs);

// ── Reports ──────────────────────────────────────────────────────────────────
router.get("/reports/dashboard",       requireAdmin, getDashboardReport);
router.get("/reports/transactions",    requireAdmin, getTransactionReport);
router.get("/reports/users",           requireAdmin, getUserReport);
router.get("/reports/frozen-accounts", requireAdmin, getFrozenAccountsReport);
router.get("/reports/wallet-balances", requireAdmin, getWalletBalancesReport);

// ── System settings ──────────────────────────────────────────────────────────
router.get("/settings",   requireAdmin, getSettings);
router.patch("/settings", requireAdmin, updateSettings);

// ── Wallets and transactions — strictly read-only ───────────────────────────
router.get("/wallets",                  requireAdmin, getWallets);
router.get("/wallets/:walletId",        requireAdmin, getWalletById);
router.post("/wallets/:walletId/adjustments", requireAdmin, createWalletAdjustment);
router.get("/transactions",             requireAdmin, getAdminTransactions);
router.get("/transactions/:transactionId", requireAdmin, getAdminTransactionById);

// ── User management ───────────────────────────────────────────────────────────
router.get("/users",                          requireAdmin, getUsers);
router.get("/users/:userId",                  requireAdmin, getUserById);
router.patch("/users/:userId/freeze",         requireAdmin, freezeUser);
router.patch("/users/:userId/unfreeze",       requireAdmin, unfreezeUser);
router.post("/users/:userId/revoke-sessions", requireAdmin, revokeUserSessions);
router.patch("/users/:userId/transfer-limit", requireAdmin, updateUserTransferLimit);

export default router;
