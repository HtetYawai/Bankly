import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const BCRYPT_ROUNDS = 12;

const adminSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    // Stores the bcrypt hash. Plain text is passed in and hashed by the
    // pre-save hook. select: false keeps it out of all query results unless
    // explicitly requested with .select("+passwordHash").
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },

    status: {
      type: String,
      enum: ["ACTIVE", "LOCKED"],
      default: "ACTIVE",
    },

    failedLoginAttempts: {
      type: Number,
      default: 0,
    },

    // Populated when status is set to LOCKED after too many failed attempts.
    lockedUntil: {
      type: Date,
      default: null,
    },

    lastLoginAt: {
      type: Date,
      default: null,
    },

    // Incremented on every password change. Embedded in the JWT payload and
    // checked by requireAdmin so tokens issued before the change are rejected
    // immediately without needing a token blacklist.
    tokenVersion: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// Hash the value of passwordHash before every save if it has changed.
// On creation the caller passes plain text; on password updates the caller
// assigns the new plain text to admin.passwordHash before calling save().
adminSchema.pre("save", async function () {
  if (this.isModified("passwordHash")) {
    this.passwordHash = await bcrypt.hash(this.passwordHash, BCRYPT_ROUNDS);
  }
});

// Call this only on documents fetched with .select("+passwordHash").
adminSchema.methods.comparePassword = async function (candidate) {
  return bcrypt.compare(candidate, this.passwordHash);
};

// Unconditionally strips passwordHash from any JSON serialization, including
// cases where the document was explicitly fetched with +passwordHash for a
// login check and then accidentally passed to res.json().
adminSchema.set("toJSON", {
  transform(_doc, ret) {
    delete ret.passwordHash;
    return ret;
  },
});

const Admin = mongoose.model("Admin", adminSchema);
export default Admin;
