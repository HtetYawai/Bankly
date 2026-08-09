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

class TransferError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function parseAmount(value) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new TransferError("INVALID_AMOUNT", "Amount must be a positive number.");
  }
  const minorUnits = Math.round(value * 100);
  if (!Number.isSafeInteger(minorUnits) || Math.abs(value - minorUnits / 100) > Number.EPSILON) {
    throw new TransferError("INVALID_AMOUNT", "Amount must have at most two decimal places.");
  }
  return minorUnits / 100;
}

export const transferMoney = async (req, res) => {
  const senderId = req.user?._id;
  const receiverAcc = typeof req.body?.receiverAcc === "string"
    ? req.body.receiverAcc.trim()
    : "";

  if (!senderId) return res.status(401).json({ code: "UNAUTHORIZED", message: "Unauthorized" });
  if (!receiverAcc) {
    return res.status(400).json({ code: "INVALID_REQUEST", message: "Receiver account is required." });
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
      message: "Transfers are temporarily disabled for maintenance. Please try again later.",
    });
  }
  if (amount < settings.minimumTransferAmount) {
    return res.status(400).json({
      code: "AMOUNT_TOO_LOW",
      message: `Amount must be at least ฿${settings.minimumTransferAmount.toLocaleString()}.`,
    });
  }
  const fee = settings.transferFee;
  const totalDebit = amount + fee;

  const session = await mongoose.startSession();
  try {
    let transactionId;
    await session.withTransaction(async () => {
      const [senderSnapshot, receiverSnapshot] = await Promise.all([
        User.findById(senderId)
          .select("_id fullName accountNumber accountStatus customMaximumTransferAmount")
          .session(session)
          .lean(),
        User.findOne({ accountNumber: receiverAcc })
          .select("_id fullName accountNumber accountStatus")
          .session(session)
          .lean(),
      ]);

      if (!senderSnapshot) throw new TransferError("UNAUTHORIZED", "Unauthorized", 401);
      assertUserCanPerformFinancialAction(senderSnapshot);

      const maxAmount = senderSnapshot.customMaximumTransferAmount ?? settings.maximumTransferAmount;
      if (amount > maxAmount) {
        throw new TransferError(
          "AMOUNT_TOO_HIGH",
          `Amount cannot exceed ฿${maxAmount.toLocaleString()} per transfer.`
        );
      }

      if (!receiverSnapshot || receiverSnapshot.accountStatus !== "ACTIVE") {
        throw new TransferError("RECIPIENT_UNAVAILABLE", "Recipient account is unavailable.", 409);
      }
      if (senderSnapshot._id.equals(receiverSnapshot._id)) {
        throw new TransferError("SELF_TRANSFER", "Cannot send to yourself.");
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
      const transferredToday = dailyTotal?.total ?? 0;
      if (transferredToday + amount > settings.dailyTransferLimit) {
        throw new TransferError(
          "DAILY_LIMIT_EXCEEDED",
          `This transfer would exceed your daily transfer limit of ฿${settings.dailyTransferLimit.toLocaleString()}.`,
          409
        );
      }

      const sender = await User.findOneAndUpdate(
        {
          _id: senderSnapshot._id,
          accountStatus: "ACTIVE",
          balance: { $gte: totalDebit },
        },
        { $inc: { balance: -totalDebit } },
        { returnDocument: "after", session, select: "_id balance" }
      ).lean();
      if (!sender) {
        throw new TransferError("INSUFFICIENT_BALANCE", "Insufficient balance.", 409);
      }

      const receiver = await User.findOneAndUpdate(
        { _id: receiverSnapshot._id, accountStatus: "ACTIVE" },
        { $inc: { balance: amount } },
        { returnDocument: "after", session, select: "_id balance" }
      ).lean();
      if (!receiver) {
        throw new TransferError("RECIPIENT_UNAVAILABLE", "Recipient account is unavailable.", 409);
      }

      transactionId = `TXN${Date.now()}${crypto.randomBytes(5).toString("hex")}`;
      const [transactionDoc] = await Transaction.create([{
        transactionId,
        sender: sender._id,
        receiver: receiver._id,
        amount,
        fee,
        status: "COMPLETED",
        type: "TRANSFER",
      }], { session, ordered: true });

      const senderBalanceAfter = sender.balance;
      const senderBalanceBefore = senderBalanceAfter + totalDebit;
      const receiverBalanceAfter = receiver.balance;
      const receiverBalanceBefore = receiverBalanceAfter - amount;

      await Ledger.create([{
        transactionId: transactionDoc._id,
        userId: sender._id,
        type: "DEBIT",
        amount: totalDebit,
        balanceBefore: senderBalanceBefore,
        balanceAfter: senderBalanceAfter,
        note: `Transfer to ${receiverSnapshot.fullName}`,
      }, {
        transactionId: transactionDoc._id,
        userId: receiver._id,
        type: "CREDIT",
        amount,
        balanceBefore: receiverBalanceBefore,
        balanceAfter: receiverBalanceAfter,
        note: `Transfer from ${senderSnapshot.fullName}`,
      }], { session, ordered: true });

      await Notification.create([{
        user: receiver._id,
        transaction: transactionDoc._id,
        message: `You have received ฿${amount.toLocaleString()} from ${senderSnapshot.fullName}. Transaction ID: ${transactionId}.`,
      }, {
        user: sender._id,
        transaction: transactionDoc._id,
        message: fee > 0
          ? `Your transfer of ฿${amount.toLocaleString()} to ${receiverSnapshot.fullName} was successful (fee ฿${fee.toLocaleString()}). Transaction ID: ${transactionId}.`
          : `Your transfer of ฿${amount.toLocaleString()} to ${receiverSnapshot.fullName} was successful. Transaction ID: ${transactionId}.`,
      }], { session, ordered: true });
    });

    return res.json({ success: true, transactionId, amount, fee });
  } catch (error) {
    if (error instanceof FinancialActionError || error instanceof TransferError) {
      return res.status(error.status).json({ code: error.code, message: error.message });
    }
    console.error("[transferMoney]", error);
    return res.status(500).json({ code: "TRANSFER_FAILED", message: "Transfer failed." });
  } finally {
    await session.endSession();
  }
};
