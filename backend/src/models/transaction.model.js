import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema({
  transactionId: {
    type: String,
    unique: true,
  },
  reference: {
    type: String,
    trim: true,
    default: null,
  },
  adjustmentKey: {
    type: String,
    select: false,
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  amount: Number,
  fee: {
    type: Number,
    default: 0,
  },

  // TRANSFER      : normal peer-to-peer transfer (all existing documents)
  // ADMIN_CREDIT  : admin-initiated balance credit
  // ADMIN_DEBIT   : admin-initiated balance debit
  // TOPUP         : self-debit to pay a mobile/e-wallet/transit provider
  type: {
    type: String,
    enum: ["TRANSFER", "ADMIN_CREDIT", "ADMIN_DEBIT", "TOPUP"],
    default: "TRANSFER",
  },

  // Human-readable reason; required for ADMIN_CREDIT and ADMIN_DEBIT.
  note: {
    type: String,
    trim: true,
    default: "",
  },
  reason: {
    type: String,
    trim: true,
    default: "",
  },

  // Null for peer-to-peer transfers; the acting admin's _id for adjustments.
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Admin",
    default: null,
  },
  status: {
    type: String,
    enum: ["PENDING", "COMPLETED", "FAILED", "REVERSED", "CANCELLED"],
    default: "COMPLETED",
  },
}, { timestamps: true });

// Supports admin transaction-list queries filtered by type.
transactionSchema.index({ type: 1, createdAt: -1 });
transactionSchema.index({ status: 1, createdAt: -1 });
transactionSchema.index({ sender: 1, createdAt: -1 });
transactionSchema.index({ receiver: 1, createdAt: -1 });
transactionSchema.index({ amount: 1, createdAt: -1 });
transactionSchema.index({ reference: 1 }, { sparse: true });
transactionSchema.index({ adjustmentKey: 1 }, { unique: true, sparse: true });
transactionSchema.index({ createdAt: -1 });

export default mongoose.model("Transaction", transactionSchema);
