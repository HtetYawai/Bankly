import { verifyAdminToken } from "../lib/adminToken.js";
import Admin from "../models/admin.model.js";

// Guards every protected admin route. Rejects the request at the first
// failing check so that the specific reason for rejection is never disclosed
// to the caller (all failures return the same 401 Unauthorized).
//
// Checks performed in order:
//   1. adminToken cookie is present
//   2. JWT signature and expiry are valid (via ADMIN_JWT_SECRET + aud claim)
//   3. JWT payload carries role: "admin"
//   4. Admin document exists in the database
//   5. Account is not LOCKED (auto-heals an expired lock via findByIdAndUpdate)
//   6. tokenVersion in the JWT matches the current value in the database
//      (invalidates tokens issued before a password change)
//
// On success, populates req.admin with safe fields.
export const requireAdmin = async (req, res, next) => {
  try {
    const token = req.cookies?.adminToken;

    if (!token) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    let decoded;
    try {
      decoded = verifyAdminToken(token);
    } catch {
      // Covers expired tokens, tampered signatures, wrong audience, etc.
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Explicit role check. jwt.verify already validates the audience claim,
    // but we also assert role so that a hypothetical token signed with the
    // same secret but without role: "admin" cannot pass this middleware.
    if (decoded.role !== "admin") {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const admin = await Admin.findById(decoded.sub);

    if (!admin) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Handle LOCKED status.
    if (admin.status === "LOCKED") {
      if (admin.lockedUntil && admin.lockedUntil > new Date()) {
        // Account is still within its lock window.
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Lock period has expired — heal using findByIdAndUpdate to avoid
      // triggering the pre-save hook on a document where passwordHash was
      // not selected (which would fail the required field check).
      await Admin.findByIdAndUpdate(admin._id, {
        $set: { status: "ACTIVE", failedLoginAttempts: 0, lockedUntil: null },
      });
      admin.status = "ACTIVE";
    }

    // Token version check. Using nullish coalescing so that tokens and
    // documents that pre-date this field (version = undefined) both default
    // to 0 and continue to work without requiring a re-login.
    if ((decoded.tokenVersion ?? 0) !== (admin.tokenVersion ?? 0)) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    req.admin = {
      id: admin._id.toString(),
      _id: admin._id,
      email: admin.email,
      name: admin.name,
      status: admin.status,
    };

    next();
  } catch (err) {
    console.error("[requireAdmin]", err.message);
    return res.status(401).json({ message: "Unauthorized" });
  }
};
