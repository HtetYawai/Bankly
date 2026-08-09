import Admin from "../models/admin.model.js";
import mongoose from "mongoose";
import { issueAdminToken, clearAdminToken } from "../lib/adminToken.js";
import { createAuditLog, AUDIT_ACTIONS } from "../lib/audit.js";

// ── constants ────────────────────────────────────────────────────────────────

const MAX_LOGIN_FAILURES = 5;
const LOCK_DURATION_MS = 30 * 60 * 1000; // 30 minutes
const MAX_PASSWORD_LENGTH = 128;

// Single message used for every authentication failure. A distinct message
// for "user not found" vs "wrong password" would allow an attacker to
// enumerate valid admin email addresses.
const INVALID_CREDENTIALS_MSG = "Invalid credentials.";

// ── helpers ───────────────────────────────────────────────────────────────────

// Returns only the fields that are safe to send to the admin portal.
// passwordHash is never included — the schema's toJSON transform is an
// additional safety net, but we exclude it explicitly here too.
function safeAdminPayload(admin) {
  return {
    _id: admin._id,
    name: admin.name,
    email: admin.email,
    status: admin.status,
    lastLoginAt: admin.lastLoginAt,
    createdAt: admin.createdAt,
  };
}

function isValidEmail(str) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(str);
}

// ── POST /api/admin/auth/login ────────────────────────────────────────────────

export const adminLogin = async (req, res) => {
  try {
    const rawEmail = req.body?.email;
    const password = req.body?.password;

    // Presence check only — detailed validation would reveal which field is
    // missing and could assist enumeration.
    if (!rawEmail || typeof rawEmail !== "string" ||
        !password || typeof password !== "string") {
      return res.status(400).json({ message: "Email and password are required." });
    }

    const email = rawEmail.trim().toLowerCase();
    if (email.length > 254 || password.length > MAX_PASSWORD_LENGTH) {
      return res.status(401).json({ message: INVALID_CREDENTIALS_MSG });
    }

    // Reject malformed email addresses with the same generic message.
    if (!isValidEmail(email)) {
      return res.status(401).json({ message: INVALID_CREDENTIALS_MSG });
    }

    // passwordHash has select: false on the schema. It must be explicitly
    // requested here for comparePassword() to have access to the stored hash.
    const admin = await Admin.findOne({ email }).select("+passwordHash");

    if (!admin) {
      // No admin with that email. Return the generic message so callers
      // cannot distinguish "no such email" from "wrong password".
      return res.status(401).json({ message: INVALID_CREDENTIALS_MSG });
    }

    // ── lockout check ─────────────────────────────────────────────────────────

    if (admin.status === "LOCKED") {
      if (admin.lockedUntil && admin.lockedUntil > new Date()) {
        // Still within the lock window — record the attempt and reject.
        await createAuditLog({
          adminId: admin._id,
          action: AUDIT_ACTIONS.ADMIN_LOGIN_FAILED,
          reason: "Account is temporarily locked",
          req,
        });
        return res.status(401).json({ message: INVALID_CREDENTIALS_MSG });
      }

      // Lock period has expired — reset before attempting the comparison.
      admin.status = "ACTIVE";
      admin.failedLoginAttempts = 0;
      admin.lockedUntil = null;
    }

    // ── password comparison ───────────────────────────────────────────────────

    const isMatch = await admin.comparePassword(password);

    if (!isMatch) {
      admin.failedLoginAttempts += 1;

      if (admin.failedLoginAttempts >= MAX_LOGIN_FAILURES) {
        admin.status = "LOCKED";
        admin.lockedUntil = new Date(Date.now() + LOCK_DURATION_MS);
      }

      // passwordHash was selected above so admin.save() has the full document
      // and will not fail the required field validation.
      await admin.save();

      await createAuditLog({
        adminId: admin._id,
        action: AUDIT_ACTIONS.ADMIN_LOGIN_FAILED,
        reason: `Incorrect password (attempt ${admin.failedLoginAttempts} of ${MAX_LOGIN_FAILURES})`,
        req,
      });

      return res.status(401).json({ message: INVALID_CREDENTIALS_MSG });
    }

    // ── success ───────────────────────────────────────────────────────────────

    admin.failedLoginAttempts = 0;
    admin.lockedUntil = null;
    admin.lastLoginAt = new Date();
    await admin.save();

    issueAdminToken(admin, res);

    await createAuditLog({
      adminId: admin._id,
      action: AUDIT_ACTIONS.ADMIN_LOGIN_SUCCESS,
      req,
    });

    return res.json(safeAdminPayload(admin));
  } catch (err) {
    console.error("[adminLogin]", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ── POST /api/admin/auth/logout ───────────────────────────────────────────────

export const adminLogout = async (req, res) => {
  try {
    clearAdminToken(res);

    await createAuditLog({
      adminId: req.admin._id,
      action: AUDIT_ACTIONS.ADMIN_LOGOUT,
      req,
    });

    return res.json({ message: "Logged out successfully." });
  } catch (err) {
    console.error("[adminLogout]", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ── GET /api/admin/auth/me ────────────────────────────────────────────────────

export const adminGetMe = async (req, res) => {
  try {
    // Re-fetch from the database so the response always reflects the latest
    // stored state rather than the snapshot captured by requireAdmin.
    const admin = await Admin.findById(req.admin._id);

    if (!admin) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    return res.json(safeAdminPayload(admin));
  } catch (err) {
    console.error("[adminGetMe]", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ── POST /api/admin/auth/change-password ──────────────────────────────────────

export const adminChangePassword = async (req, res) => {
  let session;
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body ?? {};

    // ── input validation ──────────────────────────────────────────────────────

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ message: "All fields are required." });
    }

    if (
      typeof currentPassword !== "string" ||
      typeof newPassword !== "string" ||
      typeof confirmPassword !== "string"
    ) {
      return res.status(400).json({ message: "All fields must be strings." });
    }

    if (newPassword.length < 8) {
      return res
        .status(400)
        .json({ message: "New password must be at least 8 characters." });
    }
    if (currentPassword.length > MAX_PASSWORD_LENGTH || newPassword.length > MAX_PASSWORD_LENGTH) {
      return res.status(400).json({ message: `Passwords cannot exceed ${MAX_PASSWORD_LENGTH} characters.` });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: "New passwords do not match." });
    }

    if (newPassword === currentPassword) {
      return res
        .status(400)
        .json({ message: "New password must differ from the current password." });
    }

    // ── fetch with hash for comparison ────────────────────────────────────────

    const admin = await Admin.findById(req.admin._id).select("+passwordHash");

    if (!admin) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const isMatch = await admin.comparePassword(currentPassword);

    if (!isMatch) {
      return res.status(400).json({ message: "Current password is incorrect." });
    }

    // ── update ────────────────────────────────────────────────────────────────
    // Assign plain text to passwordHash. The pre-save hook on Admin detects
    // isModified("passwordHash") and hashes it before writing to MongoDB.
    // Incrementing tokenVersion causes requireAdmin to reject all tokens
    // that were issued before this save completes.
    session = await mongoose.startSession();
    await session.withTransaction(async () => {
      admin.passwordHash = newPassword;
      admin.tokenVersion = (admin.tokenVersion ?? 0) + 1;
      await admin.save({ session });

      await createAuditLog({
        adminId: admin._id,
        action: AUDIT_ACTIONS.ADMIN_PASSWORD_CHANGED,
        entityType: "Admin",
        entityId: admin._id,
        req,
        session,
        throwOnError: true,
      });
    });

    // Revoke the current session cookie only after the transaction commits.
    clearAdminToken(res);
    return res.json({ message: "Password changed. Please log in again." });
  } catch (err) {
    console.error("[adminChangePassword]", err);
    return res.status(500).json({ message: "Server error" });
  } finally {
    if (session) await session.endSession();
  }
};
