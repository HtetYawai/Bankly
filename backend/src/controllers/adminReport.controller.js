import User from "../models/user.model.js";
import Transaction from "../models/transaction.model.js";

const MAX_RANGE_DAYS = 366;
const DAY_MS = 24 * 60 * 60 * 1000;
const SAFE_USER_PROJECT = { _id: 1, fullName: 1, email: 1, phone: 1, accountNumber: 1, accountStatus: 1, balance: 1, createdAt: 1 };

export class ReportValidationError extends Error {}

export function parseReportDateRange(query = {}, defaultDays = 30) {
  const now = new Date();
  const defaultFrom = new Date(now.getTime() - (defaultDays - 1) * DAY_MS);
  defaultFrom.setUTCHours(0, 0, 0, 0);
  const from = query.dateFrom ? new Date(query.dateFrom) : defaultFrom;
  const to = query.dateTo ? new Date(query.dateTo) : now;
  if (Number.isNaN(from.getTime())) throw new ReportValidationError("Invalid dateFrom value.");
  if (Number.isNaN(to.getTime())) throw new ReportValidationError("Invalid dateTo value.");
  if (from > to) throw new ReportValidationError("dateFrom must not be later than dateTo.");
  if (to.getTime() - from.getTime() > MAX_RANGE_DAYS * DAY_MS) {
    throw new ReportValidationError(`Date range cannot exceed ${MAX_RANGE_DAYS} days.`);
  }
  return { from, to };
}

function dateMatch(from, to, field = "createdAt") {
  return { [field]: { $gte: from, $lte: to } };
}

function normalizedStatus() {
  return { $ifNull: ["$status", "COMPLETED"] };
}

function userLookup(localField, as) {
  return {
    $lookup: {
      from: User.collection.name,
      let: { userId: `$${localField}` },
      pipeline: [
        { $match: { $expr: { $eq: ["$_id", "$$userId"] } } },
        { $project: { _id: 1, fullName: 1, accountNumber: 1, accountStatus: 1 } },
      ],
      as,
    },
  };
}

function firstOrDefault(items, fallback) {
  return items?.[0] ?? fallback;
}

function reportError(res, err, label) {
  if (err instanceof ReportValidationError) return res.status(400).json({ message: err.message });
  console.error(`[${label}]`, err);
  return res.status(500).json({ message: "Server error" });
}

export const getDashboardReport = async (req, res) => {
  try {
    const { from: trendFrom, to: trendTo } = parseReportDateRange(req.query);
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const [userFacets, transactionFacets] = await Promise.all([
      User.aggregate([{
        $facet: {
          totals: [{
            $group: {
              _id: null,
              totalUsers: { $sum: 1 },
              activeUsers: { $sum: { $cond: [{ $eq: ["$accountStatus", "ACTIVE"] }, 1, 0] } },
              frozenUsers: { $sum: { $cond: [{ $eq: ["$accountStatus", "FROZEN"] }, 1, 0] } },
              newUsersToday: { $sum: { $cond: [{ $gte: ["$createdAt", today] }, 1, 0] } },
              totalWalletBalance: { $sum: "$balance" },
            },
          }],
          recentUsers: [
            { $sort: { createdAt: -1 } },
            { $limit: 10 },
            { $project: SAFE_USER_PROJECT },
          ],
          trend: [
            { $match: dateMatch(trendFrom, trendTo) },
            { $group: { _id: { $dateTrunc: { date: "$createdAt", unit: "day", timezone: "UTC" } }, newUsers: { $sum: 1 } } },
            { $sort: { _id: 1 } },
            { $project: { _id: 0, date: "$_id", newUsers: 1 } },
          ],
        },
      }]),
      Transaction.aggregate([{
        $facet: {
          totals: [
            { $set: { normalizedStatus: normalizedStatus() } },
            {
              $group: {
                _id: null,
                transactionsToday: { $sum: { $cond: [{ $gte: ["$createdAt", today] }, 1, 0] } },
                successfulTransactionCount: { $sum: { $cond: [{ $eq: ["$normalizedStatus", "COMPLETED"] }, 1, 0] } },
                pendingTransactionCount: { $sum: { $cond: [{ $eq: ["$normalizedStatus", "PENDING"] }, 1, 0] } },
                failedTransactionCount: { $sum: { $cond: [{ $eq: ["$normalizedStatus", "FAILED"] }, 1, 0] } },
                transactionVolumeToday: {
                  $sum: { $cond: [{ $and: [{ $gte: ["$createdAt", today] }, { $eq: ["$normalizedStatus", "COMPLETED"] }] }, "$amount", 0] },
                },
              },
            },
          ],
          recentTransactions: [
            { $sort: { createdAt: -1 } },
            { $limit: 10 },
            { $set: { status: normalizedStatus() } },
            userLookup("sender", "sender"),
            userLookup("receiver", "receiver"),
            { $set: { sender: { $first: "$sender" }, receiver: { $first: "$receiver" } } },
            { $project: { adjustmentKey: 0, reason: 0, note: 0, performedBy: 0, __v: 0 } },
          ],
          trend: [
            { $match: dateMatch(trendFrom, trendTo) },
            { $set: { normalizedStatus: normalizedStatus() } },
            {
              $group: {
                _id: { $dateTrunc: { date: "$createdAt", unit: "day", timezone: "UTC" } },
                transactionCount: { $sum: 1 },
                successfulCount: { $sum: { $cond: [{ $eq: ["$normalizedStatus", "COMPLETED"] }, 1, 0] } },
                volume: { $sum: { $cond: [{ $eq: ["$normalizedStatus", "COMPLETED"] }, "$amount", 0] } },
              },
            },
            { $sort: { _id: 1 } },
            { $project: { _id: 0, date: "$_id", transactionCount: 1, successfulCount: 1, volume: 1 } },
          ],
        },
      }]),
    ]);

    const userData = userFacets[0];
    const txData = transactionFacets[0];
    return res.json({
      ...firstOrDefault(userData.totals, { totalUsers: 0, activeUsers: 0, frozenUsers: 0, newUsersToday: 0, totalWalletBalance: 0 }),
      ...firstOrDefault(txData.totals, { transactionsToday: 0, successfulTransactionCount: 0, pendingTransactionCount: 0, failedTransactionCount: 0, transactionVolumeToday: 0 }),
      recentUsers: userData.recentUsers,
      recentTransactions: txData.recentTransactions,
      trendData: { users: userData.trend, transactions: txData.trend, dateFrom: trendFrom, dateTo: trendTo },
    });
  } catch (err) {
    return reportError(res, err, "getDashboardReport");
  }
};

export const getTransactionReport = async (req, res) => {
  try {
    const { from, to } = parseReportDateRange(req.query);
    const [result] = await Transaction.aggregate([
      { $match: dateMatch(from, to) },
      { $set: { normalizedStatus: normalizedStatus() } },
      {
        $facet: {
          summary: [{
            $group: {
              _id: null,
              transactionCount: { $sum: 1 },
              totalVolume: { $sum: "$amount" },
              successfulVolume: { $sum: { $cond: [{ $eq: ["$normalizedStatus", "COMPLETED"] }, "$amount", 0] } },
              averageAmount: { $avg: "$amount" },
            },
          }],
          byStatus: [{ $group: { _id: "$normalizedStatus", count: { $sum: 1 }, volume: { $sum: "$amount" } } }, { $sort: { _id: 1 } }],
          byType: [{ $group: { _id: "$type", count: { $sum: 1 }, volume: { $sum: "$amount" } } }, { $sort: { _id: 1 } }],
          trend: [
            { $group: { _id: { $dateTrunc: { date: "$createdAt", unit: "day", timezone: "UTC" } }, count: { $sum: 1 }, volume: { $sum: "$amount" } } },
            { $sort: { _id: 1 } },
            { $project: { _id: 0, date: "$_id", count: 1, volume: 1 } },
          ],
        },
      },
    ]);
    return res.json({ dateFrom: from, dateTo: to, summary: firstOrDefault(result.summary, { transactionCount: 0, totalVolume: 0, successfulVolume: 0, averageAmount: 0 }), byStatus: result.byStatus, byType: result.byType, trend: result.trend });
  } catch (err) {
    return reportError(res, err, "getTransactionReport");
  }
};

export const getUserReport = async (req, res) => {
  try {
    const { from, to } = parseReportDateRange(req.query);
    const [result] = await User.aggregate([{
      $facet: {
        summary: [{ $group: { _id: null, totalUsers: { $sum: 1 }, totalWalletBalance: { $sum: "$balance" }, averageWalletBalance: { $avg: "$balance" } } }],
        byStatus: [{ $group: { _id: "$accountStatus", count: { $sum: 1 }, balance: { $sum: "$balance" } } }, { $sort: { _id: 1 } }],
        registrations: [
          { $match: dateMatch(from, to) },
          { $group: { _id: { $dateTrunc: { date: "$createdAt", unit: "day", timezone: "UTC" } }, count: { $sum: 1 } } },
          { $sort: { _id: 1 } },
          { $project: { _id: 0, date: "$_id", count: 1 } },
        ],
      },
    }]);
    return res.json({ dateFrom: from, dateTo: to, summary: firstOrDefault(result.summary, { totalUsers: 0, totalWalletBalance: 0, averageWalletBalance: 0 }), byStatus: result.byStatus, registrations: result.registrations });
  } catch (err) {
    return reportError(res, err, "getUserReport");
  }
};

export const getFrozenAccountsReport = async (req, res) => {
  try {
    const { from, to } = parseReportDateRange(req.query);
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
    const [result] = await User.aggregate([
      { $match: { accountStatus: "FROZEN", frozenAt: { $gte: from, $lte: to } } },
      {
        $facet: {
          accounts: [{ $sort: { frozenAt: -1 } }, { $skip: (page - 1) * limit }, { $limit: limit }, { $project: { ...SAFE_USER_PROJECT, frozenAt: 1, frozenReason: 1 } }],
          summary: [{ $group: { _id: null, total: { $sum: 1 }, totalBalance: { $sum: "$balance" } } }],
        },
      },
    ]);
    const summary = firstOrDefault(result.summary, { total: 0, totalBalance: 0 });
    return res.json({ accounts: result.accounts, total: summary.total, totalBalance: summary.totalBalance, page, totalPages: Math.ceil(summary.total / limit), dateFrom: from, dateTo: to });
  } catch (err) {
    return reportError(res, err, "getFrozenAccountsReport");
  }
};

export const getWalletBalancesReport = async (req, res) => {
  try {
    const [result] = await User.aggregate([{
      $facet: {
        summary: [{ $group: { _id: null, walletCount: { $sum: 1 }, totalBalance: { $sum: "$balance" }, averageBalance: { $avg: "$balance" }, minimumBalance: { $min: "$balance" }, maximumBalance: { $max: "$balance" } } }],
        byStatus: [{ $group: { _id: "$accountStatus", walletCount: { $sum: 1 }, totalBalance: { $sum: "$balance" } } }, { $sort: { _id: 1 } }],
        distribution: [
          { $bucket: { groupBy: "$balance", boundaries: [0, 1000, 10000, 100000, 1000000], default: "1000000+", output: { walletCount: { $sum: 1 }, totalBalance: { $sum: "$balance" } } } },
        ],
        topWallets: [{ $sort: { balance: -1 } }, { $limit: 20 }, { $project: SAFE_USER_PROJECT }],
      },
    }]);
    return res.json({ summary: firstOrDefault(result.summary, { walletCount: 0, totalBalance: 0, averageBalance: 0, minimumBalance: 0, maximumBalance: 0 }), byStatus: result.byStatus, distribution: result.distribution, topWallets: result.topWallets });
  } catch (err) {
    return reportError(res, err, "getWalletBalancesReport");
  }
};
