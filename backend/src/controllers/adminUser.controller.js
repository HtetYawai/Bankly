import mongoose from "mongoose";
import User from "../models/user.model.js";
import Transaction from "../models/transaction.model.js";
import Notification from "../models/notification.model.js";
import { createAuditLog, AUDIT_ACTIONS } from "../lib/audit.js";

// Escapes special RegExp characters so user-supplied search strings cannot
// accidentally form a pattern (e.g. "." matching any character).
function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const SORTABLE_FIELDS = new Set(["fullName", "email", "createdAt", "balance"]);
const VALID_STATUSES  = new Set(["ACTIVE", "FROZEN", "CLOSED"]);
const MAX_REASON_LENGTH = 1000;
const USER_LIST_FIELDS = "_id fullName email phone accountNumber balance accountStatus frozenAt createdAt updatedAt";
const USER_DETAIL_FIELDS = `${USER_LIST_FIELDS} frozenReason unfrozenAt`;
const RECENT_TRANSACTION_FIELDS = "transactionId reference sender receiver amount fee type status createdAt";

function actionReason(value, action) {
  const reason = typeof value === "string" ? value.trim() : "";
  if (!reason) return { error: `A reason is required to ${action} an account.` };
  if (reason.length > MAX_REASON_LENGTH) {
    return { error: `Reason cannot exceed ${MAX_REASON_LENGTH} characters.` };
  }
  return { reason };
}

// ── GET /api/admin/users ──────────────────────────────────────────────────────
//
// Query parameters (all optional):
//   q               — text search across fullName, email, phone
//   accountStatus   — ACTIVE | FROZEN | CLOSED
//   registeredFrom  — ISO date, inclusive lower bound on createdAt
//   registeredTo    — ISO date, inclusive upper bound on createdAt
//   sortBy          — fullName | email | createdAt | balance  (default: createdAt)
//   sortOrder       — asc | desc  (default: desc)
//   page            — positive integer, default 1
//   limit           — positive integer, default 20, max 100

export const getUsers = async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip  = (page - 1) * limit;

    const filter = {};

    if (req.query.q?.trim()) {
      const re = new RegExp(escapeRegExp(req.query.q.trim()), "i");
      filter.$or = [{ fullName: re }, { email: re }, { phone: re }];
    }

    if (req.query.accountStatus) {
      if (!VALID_STATUSES.has(req.query.accountStatus)) {
        return res.status(400).json({
          message: "accountStatus must be ACTIVE, FROZEN, or CLOSED.",
        });
      }
      filter.accountStatus = req.query.accountStatus;
    }

    if (req.query.registeredFrom || req.query.registeredTo) {
      filter.createdAt = {};
      if (req.query.registeredFrom) {
        const from = new Date(req.query.registeredFrom);
        if (isNaN(from.getTime())) {
          return res.status(400).json({ message: "Invalid registeredFrom value." });
        }
        filter.createdAt.$gte = from;
      }
      if (req.query.registeredTo) {
        const to = new Date(req.query.registeredTo);
        if (isNaN(to.getTime())) {
          return res.status(400).json({ message: "Invalid registeredTo value." });
        }
        filter.createdAt.$lte = to;
      }
      if (
        filter.createdAt.$gte &&
        filter.createdAt.$lte &&
        filter.createdAt.$gte > filter.createdAt.$lte
      ) {
        return res.status(400).json({
          message: "registeredFrom must not be later than registeredTo.",
        });
      }
    }

    let sortField = "createdAt";
    let sortDir   = -1;

    if (req.query.sortBy) {
      if (!SORTABLE_FIELDS.has(req.query.sortBy)) {
        return res.status(400).json({
          message: `sortBy must be one of: ${[...SORTABLE_FIELDS].join(", ")}.`,
        });
      }
      sortField = req.query.sortBy;
    }

    if (req.query.sortOrder) {
      if (req.query.sortOrder !== "asc" && req.query.sortOrder !== "desc") {
        return res.status(400).json({ message: "sortOrder must be 'asc' or 'desc'." });
      }
      sortDir = req.query.sortOrder === "asc" ? 1 : -1;
    }

    const [users, total] = await Promise.all([
      User.find(filter)
        .select(USER_LIST_FIELDS)
        .sort({ [sortField]: sortDir })
        .skip(skip)
        .limit(limit),
      User.countDocuments(filter),
    ]);

    return res.json({ users, total, page, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    console.error("[getUsers]", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ── GET /api/admin/users/:userId ──────────────────────────────────────────────

export const getUserById = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.userId)) {
      return res.status(400).json({ message: "Invalid userId." });
    }

    const [user, recentTransactions] = await Promise.all([
      User.findById(req.params.userId).select(USER_DETAIL_FIELDS),
      Transaction.find({
        $or: [
          { sender:   new mongoose.Types.ObjectId(req.params.userId) },
          { receiver: new mongoose.Types.ObjectId(req.params.userId) },
        ],
      })
        .sort({ createdAt: -1 })
        .limit(10)
        .select(RECENT_TRANSACTION_FIELDS),
    ]);

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    return res.json({ user, recentTransactions });
  } catch (err) {
    console.error("[getUserById]", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ── PATCH /api/admin/users/:userId/freeze ─────────────────────────────────────

export const freezeUser = async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.userId)) {
    return res.status(400).json({ message: "Invalid userId." });
  }

  const reasonResult = actionReason(req.body?.reason, "freeze");
  if (reasonResult.error) return res.status(400).json({ message: reasonResult.error });
  const { reason } = reasonResult;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const user = await User.findById(req.params.userId).session(session);

    if (!user) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "User not found." });
    }

    if (user.accountStatus === "FROZEN") {
      await session.abortTransaction();
      session.endSession();
      return res.status(409).json({ message: "Account is already frozen." });
    }

    if (user.accountStatus === "CLOSED") {
      await session.abortTransaction();
      session.endSession();
      return res.status(409).json({ message: "Closed accounts cannot be frozen." });
    }

    const previousStatus = user.accountStatus;

    user.accountStatus  = "FROZEN";
    user.frozenReason   = reason;
    user.frozenAt       = new Date();
    user.unfrozenAt     = null;
    // Incrementing sessionVersion invalidates any active JWT the user currently holds.
    user.sessionVersion = (user.sessionVersion ?? 0) + 1;

    await user.save({ session });

    await Notification.create(
      [{
        user: user._id,
        message: `Your account has been suspended. Reason: ${reason}. Please contact support for assistance.`,
      }],
      { session }
    );

    await createAuditLog({
      adminId:      req.admin._id,
      action:       AUDIT_ACTIONS.USER_FROZEN,
      entityType:   "User",
      entityId:     user._id,
      previousData: { accountStatus: previousStatus },
      newData:      { accountStatus: "FROZEN", frozenReason: reason, frozenAt: user.frozenAt },
      reason,
      req,
      session,
      throwOnError: true,
    });

    await session.commitTransaction();
    session.endSession();

    return res.json({
      message: "Account frozen.",
      user: {
        _id:           user._id,
        accountStatus: user.accountStatus,
        frozenReason:  user.frozenReason,
        frozenAt:      user.frozenAt,
      },
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();

    // Record the failed attempt outside the aborted session.
    await createAuditLog({
      adminId:    req.admin._id,
      action:     AUDIT_ACTIONS.USER_FROZEN,
      entityType: "User",
      entityId:   req.params.userId,
      reason:     `FAILED: ${err.message}`,
      req,
    });

    console.error("[freezeUser]", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ── PATCH /api/admin/users/:userId/unfreeze ───────────────────────────────────

export const unfreezeUser = async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.userId)) {
    return res.status(400).json({ message: "Invalid userId." });
  }

  const reasonResult = actionReason(req.body?.reason, "unfreeze");
  if (reasonResult.error) return res.status(400).json({ message: reasonResult.error });
  const { reason } = reasonResult;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const user = await User.findById(req.params.userId).session(session);

    if (!user) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "User not found." });
    }

    if (user.accountStatus !== "FROZEN") {
      await session.abortTransaction();
      session.endSession();
      return res.status(409).json({ message: "Account is not currently frozen." });
    }

    // Snapshot the freeze context before clearing it.
    const previousData = {
      accountStatus: user.accountStatus,
      frozenReason:  user.frozenReason,
      frozenAt:      user.frozenAt,
    };

    user.accountStatus = "ACTIVE";
    user.unfrozenAt    = new Date();
    // frozenReason and frozenAt are intentionally preserved — they are a
    // historical record of why the account was suspended.

    await user.save({ session });

    await Notification.create(
      [{
        user:    user._id,
        message: "Your account has been reactivated. You can now send and receive transfers.",
      }],
      { session }
    );

    await createAuditLog({
      adminId:      req.admin._id,
      action:       AUDIT_ACTIONS.USER_UNFROZEN,
      entityType:   "User",
      entityId:     user._id,
      previousData,
      newData:      { accountStatus: "ACTIVE", unfrozenAt: user.unfrozenAt },
      reason,
      req,
      session,
      throwOnError: true,
    });

    await session.commitTransaction();
    session.endSession();

    return res.json({
      message: "Account unfrozen.",
      user: {
        _id:           user._id,
        accountStatus: user.accountStatus,
        unfrozenAt:    user.unfrozenAt,
      },
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();

    await createAuditLog({
      adminId:    req.admin._id,
      action:     AUDIT_ACTIONS.USER_UNFROZEN,
      entityType: "User",
      entityId:   req.params.userId,
      reason:     `FAILED: ${err.message}`,
      req,
    });

    console.error("[unfreezeUser]", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ── POST /api/admin/users/:userId/revoke-sessions ─────────────────────────────

export const revokeUserSessions = async (req, res) => {
  let session;
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.userId)) {
      return res.status(400).json({ message: "Invalid userId." });
    }

    session = await mongoose.startSession();
    let user;
    await session.withTransaction(async () => {
      // $inc avoids a read-modify-write and is concurrency safe.
      user = await User.findByIdAndUpdate(
        req.params.userId,
        { $inc: { sessionVersion: 1 } },
        { new: true, select: "_id sessionVersion", session }
      );

      if (!user) return;

      await createAuditLog({
        adminId:    req.admin._id,
        action:     AUDIT_ACTIONS.USER_SESSIONS_REVOKED,
        entityType: "User",
        entityId:   user._id,
        newData:    { sessionVersion: user.sessionVersion },
        req,
        session,
        throwOnError: true,
      });
    });

    if (!user) return res.status(404).json({ message: "User not found." });
    return res.json({ message: "User sessions revoked." });
  } catch (err) {
    console.error("[revokeUserSessions]", err);
    return res.status(500).json({ message: "Server error" });
  } finally {
    if (session) await session.endSession();
  }
};
