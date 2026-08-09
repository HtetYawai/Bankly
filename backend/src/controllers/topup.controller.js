import crypto from "crypto";
import mongoose from "mongoose";
import User from "../models/user.model.js";
import Transaction from "../models/transaction.model.js";
import Ledger from "../models/ledger.model.js";
import Notification from "../models/notification.model.js";
import SystemSettings from "../models/systemSettings.model.js";
import {
  assertUserCanPerformFinancialAction,
  FinancialActionError,
} from "../lib/financialActionGuard.js";
import { TOPUP_PROVIDERS } from "../config/topupProviders.js";

const PROVIDERS = new Set(TOPUP_PROVIDERS.map((provider) => provider.name));

export const getTopupProviders = async (_req, res) => {
  res.json(TOPUP_PROVIDERS);
};

class TopupError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function parseAmount(value) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new TopupError("INVALID_AMOUNT", "Amount must be a positive number.");
  }
  const minorUnits = Math.round(value * 100);
  if (!Number.isSafeInteger(minorUnits) || Math.abs(value - minorUnits / 100) > Number.EPSILON) {
    throw new TopupError("INVALID_AMOUNT", "Amount must have at most two decimal places.");
  }
  return minorUnits / 100;
}

export const topUp = async (req, res) => {
  const userId = req.user?._id;
  const provider = typeof req.body?.provider === "string" ? req.body.provider.trim() : "";
  const accountRef = typeof req.body?.accountRef === "string" ? req.body.accountRef.trim() : "";

  if (!userId) return res.status(401).json({ code: "UNAUTHORIZED", message: "Unauthorized" });
  if (!PROVIDERS.has(provider)) {
    return res.status(400).json({ code: "INVALID_PROVIDER", message: "Select a valid top-up service." });
  }
  if (accountRef.length < 4 || accountRef.length > 20) {
    return res.status(400).json({ code: "INVALID_REFERENCE", message: "Enter a valid phone or account number." });
  }

  let amount;
  try {
    amount = parseAmount(req.body?.amount);
  } catch (error) {
    return res.status(error.status).json({ code: error.code, message: error.message });
  }

  const settings = await SystemSettings.getSettings();

  if (settings.maintenanceMode) {
    return res.status(503).json({
      code: "MAINTENANCE_MODE",
      message: "Top-ups are temporarily disabled for maintenance. Please try again later.",
    });
  }
  if (amount < settings.minimumTransferAmount) {
    return res.status(400).json({
      code: "AMOUNT_TOO_LOW",
      message: `Amount must be at least ฿${settings.minimumTransferAmount.toLocaleString()}.`,
    });
  }
  const session = await mongoose.startSession();
  try {
    let transactionId;
    await session.withTransaction(async () => {
      const senderSnapshot = await User.findById(userId)
        .select("_id fullName accountNumber accountStatus customMaximumTransferAmount")
        .session(session)
        .lean();

      if (!senderSnapshot) throw new TopupError("UNAUTHORIZED", "Unauthorized", 401);
      assertUserCanPerformFinancialAction(senderSnapshot);

      const maxAmount = senderSnapshot.customMaximumTransferAmount ?? settings.maximumTransferAmount;
      if (amount > maxAmount) {
        throw new TopupError(
          "AMOUNT_TOO_HIGH",
          `Amount cannot exceed ฿${maxAmount.toLocaleString()} per top-up.`
        );
      }

      const dayStart = new Date();
      dayStart.setHours(0, 0, 0, 0);
      const [dailyTotal] = await Transaction.aggregate([
        {
          $match: {
            sender: senderSnapshot._id,
            type: { $in: ["TRANSFER", "TOPUP"] },
            status: "COMPLETED",
            createdAt: { $gte: dayStart },
          },
        },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]).session(session);
      const sentToday = dailyTotal?.total ?? 0;
      if (sentToday + amount > settings.dailyTransferLimit) {
        throw new TopupError(
          "DAILY_LIMIT_EXCEEDED",
          `This top-up would exceed your daily transfer limit of ฿${settings.dailyTransferLimit.toLocaleString()}.`,
          409
        );
      }

      const sender = await User.findOneAndUpdate(
        {
          _id: senderSnapshot._id,
          accountStatus: "ACTIVE",
          balance: { $gte: amount },
        },
        { $inc: { balance: -amount } },
        { returnDocument: "after", session, select: "_id balance" }
      ).lean();
      if (!sender) {
        throw new TopupError("INSUFFICIENT_BALANCE", "Insufficient balance.", 409);
      }

      transactionId = `TXN${Date.now()}${crypto.randomBytes(5).toString("hex")}`;
      const [transactionDoc] = await Transaction.create([{
        transactionId,
        sender: sender._id,
        amount,
        fee: 0,
        status: "COMPLETED",
        type: "TOPUP",
        reference: accountRef,
        note: `${provider} top-up`,
      }], { session, ordered: true });

      const balanceAfter = sender.balance;
      const balanceBefore = balanceAfter + amount;

      await Ledger.create([{
        transactionId: transactionDoc._id,
        userId: sender._id,
        type: "DEBIT",
        amount,
        balanceBefore,
        balanceAfter,
        note: `${provider} top-up (${accountRef})`,
      }], { session, ordered: true });

      await Notification.create([{
        user: sender._id,
        transaction: transactionDoc._id,
        message: `Your top-up of ฿${amount.toLocaleString()} to ${provider} was successful. Transaction ID: ${transactionId}.`,
      }], { session, ordered: true });
    });

    return res.json({ success: true, transactionId, amount, provider });
  } catch (error) {
    if (error instanceof FinancialActionError || error instanceof TopupError) {
      return res.status(error.status).json({ code: error.code, message: error.message });
    }
    console.error("[topUp]", error);
    return res.status(500).json({ code: "TOPUP_FAILED", message: "Top-up failed." });
  } finally {
    await session.endSession();
  }
};
