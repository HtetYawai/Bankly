import mongoose from "mongoose";
import AdminAuditLog from "../models/adminAuditLog.model.js";

// ── GET /api/admin/audit-logs ─────────────────────────────────────────────────
//
// Returns a paginated, filtered, newest-first list of audit log entries.
//
// Query parameters (all optional):
//   page        — positive integer, default 1
//   limit       — positive integer, default 20, max 100
//   action      — exact match against the action field
//   entityType  — exact match against the entityType field
//   entityId    — valid ObjectId string; exact match against the entityId field
//   dateFrom    — ISO 8601 date string; lower bound on createdAt (inclusive)
//   dateTo      — ISO 8601 date string; upper bound on createdAt (inclusive)
//
// adminId is populated with { name, email } so the response identifies the
// acting admin by name without exposing any credential fields.

export const getAuditLogs = async (req, res) => {
  try {
    // ── pagination ────────────────────────────────────────────────────────────

    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip  = (page - 1) * limit;

    // ── filter ────────────────────────────────────────────────────────────────

    const filter = {};

    if (req.query.action) {
      filter.action = req.query.action;
    }

    if (req.query.entityType) {
      filter.entityType = req.query.entityType;
    }

    if (req.query.entityId !== undefined && req.query.entityId !== "") {
      if (!mongoose.Types.ObjectId.isValid(req.query.entityId)) {
        return res.status(400).json({ message: "Invalid entityId format." });
      }
      filter.entityId = req.query.entityId; // Mongoose casts the string automatically
    }

    if (req.query.dateFrom || req.query.dateTo) {
      filter.createdAt = {};

      if (req.query.dateFrom) {
        const from = new Date(req.query.dateFrom);
        if (isNaN(from.getTime())) {
          return res.status(400).json({ message: "Invalid dateFrom value." });
        }
        filter.createdAt.$gte = from;
      }

      if (req.query.dateTo) {
        const to = new Date(req.query.dateTo);
        if (isNaN(to.getTime())) {
          return res.status(400).json({ message: "Invalid dateTo value." });
        }
        filter.createdAt.$lte = to;
      }

      if (
        filter.createdAt.$gte &&
        filter.createdAt.$lte &&
        filter.createdAt.$gte > filter.createdAt.$lte
      ) {
        return res
          .status(400)
          .json({ message: "dateFrom must not be later than dateTo." });
      }
    }

    // ── query ─────────────────────────────────────────────────────────────────
    //
    // Run the data fetch and count in parallel. Both queries use the same
    // filter so they are always consistent with each other.

    const [logs, total] = await Promise.all([
      AdminAuditLog.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("adminId", "name email"),
      AdminAuditLog.countDocuments(filter),
    ]);

    return res.json({
      logs,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error("[getAuditLogs]", err);
    return res.status(500).json({ message: "Server error" });
  }
};
