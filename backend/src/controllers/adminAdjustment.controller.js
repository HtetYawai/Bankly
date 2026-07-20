import crypto from "crypto";
import mongoose from "mongoose";
import User from "../models/user.model.js";
import Transaction from "../models/transaction.model.js";
import Ledger from "../models/ledger.model.js";
import Notification from "../models/notification.model.js";
import { createAuditLog, AUDIT_ACTIONS } from "../lib/audit.js";

const MAX_KEY_LENGTH = 200;
const MAX_TEXT_LENGTH = 1000;

export class AdjustmentError extends Error {
  constructor(code, message, status) {
    super(message);
    this.name = "AdjustmentError";
    this.code = code;
    this.status = status;
  }
}

function parseMoney(value) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new AdjustmentError("INVALID_AMOUNT", "amount must be a positive number.", 400);
  }

  // Money is stored as Number in this project. Normalising through integer
  // minor units prevents values with fractions smaller than one satang.
  const minorUnits = Math.round(value * 100);
  if (!Number.isSafeInteger(minorUnits) || Math.abs(value - minorUnits / 100) > Number.EPSILON) {
    throw new AdjustmentError(
      "INVALID_AMOUNT",
      "amount must have at most two decimal places and be within the supported range.",
      400
    );
  }
  return minorUnits / 100;
}

function requiredText(value, field) {
  if (typeof value !== "string" || !value.trim()) {
    throw new AdjustmentError("INVALID_REQUEST", `${field} is required.`, 400);
  }
  const text = value.trim();
  if (text.length > MAX_TEXT_LENGTH) {
    throw new AdjustmentError("INVALID_REQUEST", `${field} is too long.`, 400);
  }
  return text;
}

function optionalText(value, field, maxLength = MAX_TEXT_LENGTH) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || value.trim().length > maxLength) {
    throw new AdjustmentError("INVALID_REQUEST", `${field} is invalid.`, 400);
  }
  return value.trim();
}

export function validateAdjustmentInput({ type, amount, reason, referenceNumber, idempotencyKey, note }) {
  if (!new Set(["CREDIT", "DEBIT"]).has(type)) {
    throw new AdjustmentError("INVALID_REQUEST", "type must be CREDIT or DEBIT.", 400);
  }
  const reference = optionalText(referenceNumber, "referenceNumber", MAX_KEY_LENGTH);
  const rawKey = optionalText(idempotencyKey, "Idempotency-Key", MAX_KEY_LENGTH) ?? reference;
  if (!rawKey) {
    throw new AdjustmentError(
      "IDEMPOTENCY_KEY_REQUIRED",
      "Idempotency-Key header or referenceNumber is required.",
      400
    );
  }
  return {
    type,
    amount: parseMoney(amount),
    reason: requiredText(reason, "reason"),
    referenceNumber: reference,
    note: optionalText(note, "note"),
    idempotencyKey: rawKey,
  };
}

export async function performBalanceAdjustment({
  walletId,
  adminId,
  input,
  req,
  dependencies = {},
}) {
  const UserModel = dependencies.User ?? User;
  const TransactionModel = dependencies.Transaction ?? Transaction;
  const LedgerModel = dependencies.Ledger ?? Ledger;
  const NotificationModel = dependencies.Notification ?? Notification;
  const auditWriter = dependencies.createAuditLog ?? createAuditLog;
  const startSession = dependencies.startSession ?? (() => mongoose.startSession());
  const session = await startSession();
  let response;

  // Scope client keys to the acting admin while retaining a database-enforced
  // unique value. A hash avoids storing arbitrary header content as an index key.
  const adjustmentKey = crypto
    .createHash("sha256")
    .update(`${adminId}:${input.idempotencyKey}`)
    .digest("hex");

  try {
    await session.withTransaction(async () => {
      const duplicate = await TransactionModel.findOne({ adjustmentKey })
        .select("_id")
        .session(session)
        .lean();
      if (duplicate) {
        throw new AdjustmentError("DUPLICATE_ADJUSTMENT", "This adjustment was already processed.", 409);
      }

      const balanceCondition = { _id: walletId };
      if (input.type === "DEBIT") balanceCondition.balance = { $gte: input.amount };
      const delta = input.type === "CREDIT" ? input.amount : -input.amount;

      // This conditional $inc is the concurrency boundary. MongoDB evaluates
      // the balance predicate and update atomically against persisted state.
      const wallet = await UserModel.findOneAndUpdate(
        balanceCondition,
        { $inc: { balance: delta } },
        { new: true, session, select: "_id fullName balance accountNumber" }
      ).lean();

      if (!wallet) {
        const existing = await UserModel.findById(walletId)
          .select("_id")
          .session(session)
          .lean();
        if (!existing) throw new AdjustmentError("WALLET_NOT_FOUND", "Wallet not found.", 404);
        throw new AdjustmentError("INSUFFICIENT_BALANCE", "Debit would create a negative balance.", 409);
      }

      const balanceAfter = wallet.balance;
      const balanceBefore = balanceAfter - delta;
      const transactionId = `ADJ${Date.now()}${crypto.randomBytes(6).toString("hex")}`;
      const [transaction] = await TransactionModel.create([{
        transactionId,
        reference: input.referenceNumber,
        adjustmentKey,
        sender: input.type === "DEBIT" ? wallet._id : null,
        receiver: input.type === "CREDIT" ? wallet._id : null,
        amount: input.amount,
        fee: 0,
        type: input.type === "CREDIT" ? "ADMIN_CREDIT" : "ADMIN_DEBIT",
        status: "COMPLETED",
        reason: input.reason,
        note: input.note ?? "",
        performedBy: adminId,
      }], { session });

      await LedgerModel.create([{
        transactionId: transaction._id,
        userId: wallet._id,
        type: input.type,
        amount: input.amount,
        balanceBefore,
        balanceAfter,
        note: input.note ?? input.reason,
        performedBy: adminId,
      }], { session });

      await auditWriter({
        adminId,
        action: input.type === "CREDIT"
          ? AUDIT_ACTIONS.BALANCE_CREDIT_ADJUSTMENT
          : AUDIT_ACTIONS.BALANCE_DEBIT_ADJUSTMENT,
        entityType: "User",
        entityId: wallet._id,
        previousData: { balance: balanceBefore },
        newData: {
          balance: balanceAfter,
          amount: input.amount,
          transactionId: transaction._id,
          referenceNumber: input.referenceNumber,
        },
        reason: input.reason,
        req,
        session,
        throwOnError: true,
      });

      await NotificationModel.create([{
        user: wallet._id,
        message: `An admin ${input.type.toLowerCase()} adjustment of ฿${input.amount.toLocaleString()} was applied to your wallet. New balance: ฿${balanceAfter.toLocaleString()}.`,
      }], { session });

      response = {
        adjustment: {
          _id: transaction._id,
          transactionId: transaction.transactionId,
          referenceNumber: input.referenceNumber,
          type: input.type,
          amount: input.amount,
          reason: input.reason,
          note: input.note,
        },
        wallet: { _id: wallet._id, accountNumber: wallet.accountNumber, balance: balanceAfter },
        newBalance: balanceAfter,
      };
    });
    return response;
  } catch (error) {
    if (error?.code === 11000 && (error.keyPattern?.adjustmentKey || error.keyValue?.adjustmentKey)) {
      throw new AdjustmentError("DUPLICATE_ADJUSTMENT", "This adjustment was already processed.", 409);
    }
    throw error;
  } finally {
    await session.endSession();
  }
}

export const createWalletAdjustment = async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.walletId)) {
    return res.status(400).json({ code: "INVALID_WALLET_ID", message: "Invalid walletId." });
  }

  try {
    const input = validateAdjustmentInput({
      ...req.body,
      idempotencyKey: req.get("idempotency-key"),
    });
    const result = await performBalanceAdjustment({
      walletId: new mongoose.Types.ObjectId(req.params.walletId),
      adminId: req.admin._id,
      input,
      req,
    });
    return res.status(201).json(result);
  } catch (error) {
    if (error instanceof AdjustmentError) {
      return res.status(error.status).json({ code: error.code, message: error.message });
    }
    console.error("[createWalletAdjustment]", error);
    return res.status(500).json({ code: "ADJUSTMENT_FAILED", message: "Balance adjustment failed." });
  }
};
