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
]
  },
  { timestamps: true }
);

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

const User = mongoose.model("User", userSchema);
export default User;