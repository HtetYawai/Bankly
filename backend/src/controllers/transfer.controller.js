import crypto from "crypto";
import mongoose from "mongoose";
import User from "../models/user.model.js";
import Transaction from "../models/transaction.model.js";
import Notification from "../models/notification.model.js";
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

  const session = await mongoose.startSession();
  try {
    let transactionId;
    await session.withTransaction(async () => {
      const [senderSnapshot, receiverSnapshot] = await Promise.all([
        User.findById(senderId)
          .select("_id fullName accountNumber accountStatus")
          .session(session)
          .lean(),
        User.findOne({ accountNumber: receiverAcc })
          .select("_id fullName accountNumber accountStatus")
          .session(session)
          .lean(),
      ]);

      if (!senderSnapshot) throw new TransferError("UNAUTHORIZED", "Unauthorized", 401);
      assertUserCanPerformFinancialAction(senderSnapshot);
      if (!receiverSnapshot || receiverSnapshot.accountStatus !== "ACTIVE") {
        throw new TransferError("RECIPIENT_UNAVAILABLE", "Recipient account is unavailable.", 409);
      }
      if (senderSnapshot._id.equals(receiverSnapshot._id)) {
        throw new TransferError("SELF_TRANSFER", "Cannot send to yourself.");
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
        status: "COMPLETED",
        type: "TRANSFER",
      }], { session, ordered: true });

      await Notification.create([{
        user: receiver._id,
        transaction: transactionDoc._id,
        message: `You have received ฿${amount.toLocaleString()} from ${senderSnapshot.fullName}. Transaction ID: ${transactionId}.`,
      }, {
        user: sender._id,
        transaction: transactionDoc._id,
        message: `Your transfer of ฿${amount.toLocaleString()} to ${receiverSnapshot.fullName} was successful. Transaction ID: ${transactionId}.`,
      }], { session, ordered: true });
    });

    return res.json({ success: true, transactionId });
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
