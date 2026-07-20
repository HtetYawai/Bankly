import mongoose from "mongoose";
import User from "../models/user.model.js";
import Transaction from "../models/transaction.model.js";
import Ledger from "../models/ledger.model.js";

const WALLET_FIELDS = "_id accountNumber balance accountStatus createdAt updatedAt";
const VALID_STATUSES = new Set(["ACTIVE", "FROZEN", "CLOSED"]);
const SORT_FIELDS = new Set(["balance", "createdAt", "updatedAt", "accountStatus", "fullName"]);

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseNonNegativeNumber(value, name) {
  if (value === undefined) return undefined;
  if (value === "" || !Number.isFinite(Number(value)) || Number(value) < 0) {
    throw new Error(`${name} must be a non-negative number.`);
  }
  return Number(value);
}

function pagination(query) {
  return {
    page: Math.max(1, Number.parseInt(query.page, 10) || 1),
    limit: Math.min(100, Math.max(1, Number.parseInt(query.limit, 10) || 20)),
  };
}

export const getWallets = async (req, res) => {
  try {
    const { page, limit } = pagination(req.query);
    const filter = {};

    const userSearch = req.query.q ?? req.query.search ?? req.query.userSearch;
    if (userSearch?.trim()) {
      const search = new RegExp(escapeRegExp(userSearch.trim()), "i");
      filter.$or = [
        { fullName: search },
        { email: search },
        { phone: search },
        { accountNumber: search },
      ];
    }

    const status = req.query.status ?? req.query.walletStatus;
    if (status) {
      if (!VALID_STATUSES.has(status)) {
        return res.status(400).json({ message: "status must be ACTIVE, FROZEN, or CLOSED." });
      }
      filter.accountStatus = status;
    }

    const minBalance = parseNonNegativeNumber(req.query.minBalance, "minBalance");
    const maxBalance = parseNonNegativeNumber(req.query.maxBalance, "maxBalance");
    if (minBalance !== undefined || maxBalance !== undefined) {
      if (minBalance !== undefined && maxBalance !== undefined && minBalance > maxBalance) {
        return res.status(400).json({ message: "minBalance must not exceed maxBalance." });
      }
      filter.balance = {};
      if (minBalance !== undefined) filter.balance.$gte = minBalance;
      if (maxBalance !== undefined) filter.balance.$lte = maxBalance;
    }

    const sortBy = req.query.sortBy ?? "createdAt";
    if (!SORT_FIELDS.has(sortBy)) {
      return res.status(400).json({ message: `sortBy must be one of: ${[...SORT_FIELDS].join(", ")}.` });
    }
    if (req.query.sortOrder && !["asc", "desc"].includes(req.query.sortOrder)) {
      return res.status(400).json({ message: "sortOrder must be 'asc' or 'desc'." });
    }
    const sortOrder = req.query.sortOrder === "asc" ? 1 : -1;

    const [wallets, total] = await Promise.all([
      User.find(filter)
        .select(`${WALLET_FIELDS} fullName email phone`)
        .sort({ [sortBy]: sortOrder, _id: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ]);

    const walletIds = wallets.map((wallet) => wallet._id);
    const lastTransactions = walletIds.length ? await Transaction.aggregate([
      { $match: { $or: [{ sender: { $in: walletIds } }, { receiver: { $in: walletIds } }] } },
      { $set: { walletIds: { $setUnion: [["$sender"], ["$receiver"]] } } },
      { $unwind: "$walletIds" },
      { $match: { walletIds: { $in: walletIds } } },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: "$walletIds",
          lastTransaction: {
            $first: {
              _id: "$_id",
              transactionId: "$transactionId",
              reference: "$reference",
              type: "$type",
              status: { $ifNull: ["$status", "COMPLETED"] },
              amount: "$amount",
              createdAt: "$createdAt",
            },
          },
        },
      },
    ]) : [];
    const lastTransactionByWallet = new Map(
      lastTransactions.map((item) => [item._id.toString(), item.lastTransaction])
    );
    for (const wallet of wallets) {
      wallet.lastTransaction = lastTransactionByWallet.get(wallet._id.toString()) ?? null;
    }

    return res.json({ wallets, total, page, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    if (err.message?.includes("must be a non-negative number")) {
      return res.status(400).json({ message: err.message });
    }
    console.error("[getWallets]", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const getWalletById = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.walletId)) {
      return res.status(400).json({ message: "Invalid walletId." });
    }

    const walletId = new mongoose.Types.ObjectId(req.params.walletId);
    const [owner, totals, recentLedgerEntries, recentTransactions] = await Promise.all([
      User.findById(walletId).select(`${WALLET_FIELDS} fullName email phone`).lean(),
      Transaction.aggregate([
        { $match: { $or: [{ sender: walletId }, { receiver: walletId }] } },
        {
          $group: {
            _id: null,
            totalSent: { $sum: { $cond: [{ $eq: ["$sender", walletId] }, "$amount", 0] } },
            totalReceived: { $sum: { $cond: [{ $eq: ["$receiver", walletId] }, "$amount", 0] } },
          },
        },
      ]),
      Ledger.find({ userId: walletId })
        .select("transactionId type amount balanceBefore balanceAfter note performedBy createdAt")
        .populate("transactionId", "transactionId reference type status")
        .populate("performedBy", "name email")
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
      Transaction.find({ $or: [{ sender: walletId }, { receiver: walletId }] })
        .select("transactionId reference sender receiver amount fee type status note createdAt")
        .populate("sender", "fullName accountNumber")
        .populate("receiver", "fullName accountNumber")
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
    ]);

    if (!owner) return res.status(404).json({ message: "Wallet not found." });

    const { balance, ...ownerInformation } = owner;
    const aggregate = totals[0] ?? { totalSent: 0, totalReceived: 0 };
    for (const transaction of recentTransactions) {
      if (!transaction.status) transaction.status = "COMPLETED";
    }
    return res.json({
      wallet: {
        _id: owner._id,
        accountNumber: owner.accountNumber,
        status: owner.accountStatus,
        availableBalance: balance,
        createdAt: owner.createdAt,
        updatedAt: owner.updatedAt,
      },
      owner: ownerInformation,
      totalSent: aggregate.totalSent,
      totalReceived: aggregate.totalReceived,
      recentLedgerEntries,
      recentTransactions,
    });
  } catch (err) {
    console.error("[getWalletById]", err);
    return res.status(500).json({ message: "Server error" });
  }
};
