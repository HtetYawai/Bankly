import mongoose from "mongoose";
import Transaction from "../models/transaction.model.js";
import Ledger from "../models/ledger.model.js";

const VALID_TYPES = new Set(["TRANSFER", "ADMIN_CREDIT", "ADMIN_DEBIT"]);
const VALID_STATUSES = new Set(["PENDING", "COMPLETED", "FAILED", "REVERSED", "CANCELLED"]);
const SORT_FIELDS = new Set(["createdAt", "updatedAt", "amount", "type", "status", "transactionId"]);
const USER_FIELDS = "fullName accountNumber accountStatus";
const TRANSACTION_FIELDS = "transactionId reference sender receiver amount fee type status note performedBy createdAt updatedAt";

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseNumber(value, name) {
  if (value === undefined) return undefined;
  if (value === "" || !Number.isFinite(Number(value)) || Number(value) < 0) {
    throw new Error(`${name} must be a non-negative number.`);
  }
  return Number(value);
}

function parseDate(value, name) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`${name} must be a valid date.`);
  return date;
}

export const getAdminTransactions = async (req, res) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
    const filter = {};

    const identifier = req.query.q ?? req.query.search ?? req.query.transactionId ?? req.query.reference;
    if (identifier?.trim()) {
      const search = new RegExp(escapeRegExp(identifier.trim()), "i");
      filter.$or = [{ transactionId: search }, { reference: search }];
    }

    for (const field of ["sender", "receiver"]) {
      if (req.query[field]) {
        if (!mongoose.Types.ObjectId.isValid(req.query[field])) {
          return res.status(400).json({ message: `${field} must be a valid ObjectId.` });
        }
        filter[field] = new mongoose.Types.ObjectId(req.query[field]);
      }
    }

    if (req.query.type) {
      if (!VALID_TYPES.has(req.query.type)) {
        return res.status(400).json({ message: `type must be one of: ${[...VALID_TYPES].join(", ")}.` });
      }
      filter.type = req.query.type;
    }
    if (req.query.status) {
      if (!VALID_STATUSES.has(req.query.status)) {
        return res.status(400).json({ message: `status must be one of: ${[...VALID_STATUSES].join(", ")}.` });
      }
      // Legacy transactions pre-date the status field and are completed.
      if (req.query.status === "COMPLETED") {
        const completed = [{ status: "COMPLETED" }, { status: { $exists: false } }];
        if (filter.$or) {
          filter.$and = [{ $or: filter.$or }, { $or: completed }];
          delete filter.$or;
        } else {
          filter.$or = completed;
        }
      } else filter.status = req.query.status;
    }

    const from = parseDate(req.query.from ?? req.query.startDate, "from");
    const to = parseDate(req.query.to ?? req.query.endDate, "to");
    if (from && to && from > to) return res.status(400).json({ message: "from must not be later than to." });
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = from;
      if (to) filter.createdAt.$lte = to;
    }

    const minAmount = parseNumber(req.query.minAmount, "minAmount");
    const maxAmount = parseNumber(req.query.maxAmount, "maxAmount");
    if (minAmount !== undefined && maxAmount !== undefined && minAmount > maxAmount) {
      return res.status(400).json({ message: "minAmount must not exceed maxAmount." });
    }
    if (minAmount !== undefined || maxAmount !== undefined) {
      filter.amount = {};
      if (minAmount !== undefined) filter.amount.$gte = minAmount;
      if (maxAmount !== undefined) filter.amount.$lte = maxAmount;
    }

    const sortBy = req.query.sortBy ?? "createdAt";
    if (!SORT_FIELDS.has(sortBy)) {
      return res.status(400).json({ message: `sortBy must be one of: ${[...SORT_FIELDS].join(", ")}.` });
    }
    if (req.query.sortOrder && !["asc", "desc"].includes(req.query.sortOrder)) {
      return res.status(400).json({ message: "sortOrder must be 'asc' or 'desc'." });
    }
    const sortOrder = req.query.sortOrder === "asc" ? 1 : -1;

    const [transactions, total] = await Promise.all([
      Transaction.find(filter)
        .select(TRANSACTION_FIELDS)
        .populate("sender", USER_FIELDS)
        .populate("receiver", USER_FIELDS)
        .populate("performedBy", "name email")
        .sort({ [sortBy]: sortOrder, _id: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Transaction.countDocuments(filter),
    ]);

    for (const transaction of transactions) {
      if (!transaction.status) transaction.status = "COMPLETED";
    }
    return res.json({ transactions, total, page, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    if (err.message?.includes("must be a non-negative number") || err.message?.includes("must be a valid date")) {
      return res.status(400).json({ message: err.message });
    }
    console.error("[getAdminTransactions]", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const getAdminTransactionById = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.transactionId)) {
      return res.status(400).json({ message: "Invalid transactionId." });
    }

    const [transaction, ledgerEntries] = await Promise.all([
      Transaction.findById(req.params.transactionId)
        .select(`${TRANSACTION_FIELDS} reason`)
        .populate("sender", USER_FIELDS)
        .populate("receiver", USER_FIELDS)
        .populate("performedBy", "name email")
        .lean(),
      Ledger.find({ transactionId: req.params.transactionId })
        .select("userId type amount balanceBefore balanceAfter note performedBy createdAt")
        .populate("userId", "fullName accountNumber accountStatus")
        .populate("performedBy", "name email")
        .sort({ createdAt: 1 })
        .lean(),
    ]);

    if (!transaction) return res.status(404).json({ message: "Transaction not found." });
    if (!transaction.status) transaction.status = "COMPLETED";
    return res.json({ transaction, ledgerEntries });
  } catch (err) {
    console.error("[getAdminTransactionById]", err);
    return res.status(500).json({ message: "Server error" });
  }
};
