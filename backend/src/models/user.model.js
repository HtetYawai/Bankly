import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },

    password: {
      type: String,
      required: true,
      minlength: 6,
      select: false,
    },

    phone: {
      type: String,
      required: true,
      unique: true,
    },

    accountNumber: {
      type: String,
      unique: true,
    },

    qrCode: {
      type: String, // store QR image URL or encoded string
      unique: true,
    },

    balance: {
      type: Number,
      default: 0,
    },
    notifications: [
  {
    message: String,
    createdAt: { type: Date, default: Date.now }
  }
],

    // --- Admin-managed account status ---

    // ACTIVE   : normal operation (default for all existing documents)
    // FROZEN   : user cannot send or receive transfers
    // CLOSED   : account permanently closed
    accountStatus: {
      type: String,
      enum: ["ACTIVE", "FROZEN", "CLOSED"],
      default: "ACTIVE",
    },

    // Populated when an admin freezes the account.
    frozenReason: {
      type: String,
      trim: true,
      default: null,
    },

    frozenAt: {
      type: Date,
      default: null,
    },

    // Reset to null when the account is frozen again after an unfreeze.
    unfrozenAt: {
      type: Date,
      default: null,
    },

    // Incremented by the admin revoke-sessions endpoint. The protect middleware
    // embeds this value in each JWT and rejects tokens whose version is stale.
    sessionVersion: {
      type: Number,
      default: 0,
    },

    // Auto-lockout after repeated failed login attempts (see login() in
    // auth.controller.js). Independent of accountStatus, which is reserved
    // for admin-initiated freeze/close actions.
    failedLoginAttempts: {
      type: Number,
      default: 0,
    },

    lockedUntil: {
      type: Date,
      default: null,
    },

    // Per-customer override for the maximum amount allowed on a single
    // transfer or top-up. Null means "use the global maximumTransferAmount
    // from SystemSettings". Set by an admin via PATCH
    // /api/admin/users/:userId/transfer-limit.
    customMaximumTransferAmount: {
      type: Number,
      default: null,
    },
  },
  { timestamps: true }
);

// Supports admin user-list queries filtered by accountStatus.
userSchema.index({ accountStatus: 1 });
userSchema.index({ accountStatus: 1, balance: 1, createdAt: -1 });
userSchema.index({ balance: 1, createdAt: -1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ accountStatus: 1, frozenAt: -1 });

//
function generateAccountNumber() {
  return "AC" + Math.floor(1000000000 + Math.random() * 9000000000);
}

function generateQRCode(user) {
  return `bankapp://pay?acc=${user.accountNumber}&name=${user.fullName}`;
}

userSchema.pre("save", async function () {
  if (this.isModified("password")) {
    this.password = await bcrypt.hash(this.password, 10);
  }

  if (!this.accountNumber) {
    this.accountNumber = generateAccountNumber();
  }

  if (!this.qrCode) {
    this.qrCode = generateQRCode(this);
  }
});

userSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

userSchema.set("toJSON", {
  transform(_doc, ret) {
    delete ret.password;
    delete ret.sessionVersion;
    return ret;
  },
});

const User = mongoose.model("User", userSchema);
export default User;
