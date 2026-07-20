import mongoose from "mongoose";

// Immutable record of every balance movement for a user. Created alongside
// every Transaction document so that the full audit trail of a wallet's
// balance can be reconstructed independently of the Transaction collection.
//
// Money fields use Number (float64), consistent with User.balance,
// Transaction.amount, and Transaction.fee throughout this codebase.
const ledgerSchema = new mongoose.Schema(
  {
    transactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Transaction",
      required: true,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // CREDIT increases the user's balance; DEBIT decreases it.
    type: {
      type: String,
      enum: ["CREDIT", "DEBIT"],
      required: true,
    },

    amount: {
      type: Number,
      required: true,
    },

    balanceBefore: {
      type: Number,
      required: true,
    },

    balanceAfter: {
      type: Number,
      required: true,
    },

    // Human-readable description, required for admin adjustments.
    note: {
      type: String,
      trim: true,
      default: "",
    },

    // Null for peer-to-peer transfers; set to the acting admin's _id for
    // any balance adjustment initiated through the admin portal.
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
  },
  { timestamps: true }
);

ledgerSchema.index({ userId: 1, createdAt: -1 });
ledgerSchema.index({ transactionId: 1 });

export default mongoose.model("Ledger", ledgerSchema);
