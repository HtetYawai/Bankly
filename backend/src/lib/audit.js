import AdminAuditLog from "../models/adminAuditLog.model.js";

// ── Action constants ──────────────────────────────────────────────────────────
//
// Use these values everywhere an action is recorded. Centralising them here
// means a typo causes an obvious import-time or lint-time error instead of
// silently writing an unrecognised action string into the database.

export const AUDIT_ACTIONS = Object.freeze({
  ADMIN_LOGIN_SUCCESS:       "ADMIN_LOGIN_SUCCESS",
  ADMIN_LOGIN_FAILED:        "ADMIN_LOGIN_FAILED",
  ADMIN_LOGOUT:              "ADMIN_LOGOUT",
  ADMIN_PASSWORD_CHANGED:    "ADMIN_PASSWORD_CHANGED",
  USER_FROZEN:               "USER_FROZEN",
  USER_UNFROZEN:             "USER_UNFROZEN",
  USER_SESSIONS_REVOKED:     "USER_SESSIONS_REVOKED",
  BALANCE_CREDIT_ADJUSTMENT: "BALANCE_CREDIT_ADJUSTMENT",
  BALANCE_DEBIT_ADJUSTMENT:  "BALANCE_DEBIT_ADJUSTMENT",
  SYSTEM_SETTINGS_UPDATED:   "SYSTEM_SETTINGS_UPDATED",
});

// ── Sanitizer ─────────────────────────────────────────────────────────────────
//
// Applied to previousData and newData before they are persisted. Any key
// whose lowercase form appears in SENSITIVE_KEYS has its value replaced with
// "[REDACTED]". The sanitiser is recursive so nested objects and arrays are
// also cleaned. It returns a new object and never mutates its input.

const SENSITIVE_KEYS = new Set([
  // passwords
  "password", "passwordhash", "passwordsalt", "pwd", "passcode",
  // tokens / keys / secrets
  "token", "accesstoken", "refreshtoken", "resettoken", "verificationtoken",
  "idtoken", "jwttoken", "authtoken", "bearertoken", "sessiontoken",
  "secret", "apisecret", "clientsecret", "apikey", "privatekey",
  // payment credentials
  "cardnumber", "cardnum", "cvv", "cvc", "pan", "pin",
  // government / identity numbers
  "ssn", "socialsecuritynumber", "taxid",
]);

function sanitize(data) {
  if (data === null || data === undefined) return data;
  if (Array.isArray(data)) return data.map(sanitize);
  if (typeof data !== "object") return data;

  const result = {};
  for (const [key, val] of Object.entries(data)) {
    result[key] = SENSITIVE_KEYS.has(key.toLowerCase()) ? "[REDACTED]" : sanitize(val);
  }
  return result;
}

// ── createAuditLog ────────────────────────────────────────────────────────────
//
// Writes one immutable audit log entry to the AdminAuditLog collection.
//
// Parameters:
//   adminId      — ObjectId of the acting admin. MUST always be taken from
//                  req.admin._id (set by requireAdmin middleware) or from the
//                  Admin document retrieved from MongoDB. Never accept this
//                  value from req.body or any other client-supplied source.
//   action       — One of the AUDIT_ACTIONS values.
//   entityType   — Mongoose model name of the affected document (e.g. "User"),
//                  or null for non-entity actions such as login/logout.
//   entityId     — _id of the affected document, or null.
//   previousData — Plain-object snapshot of relevant fields before the change.
//                  Will be sanitised before storage.
//   newData      — Plain-object snapshot of relevant fields after the change.
//                  Will be sanitised before storage.
//   reason       — Free-text description supplied by the admin, or null.
//   req          — Express Request object used to extract ip and user-agent.
//   session      — Optional Mongoose ClientSession. When supplied the audit
//                  entry participates in the same MongoDB transaction as the
//                  surrounding business operation so both documents are written
//                  atomically. If the session is later aborted the audit entry
//                  is rolled back with it — callers that abort a session must
//                  write a separate, non-session failure entry afterwards.
//
// By default this never throws. Financial operations can set throwOnError so
// an audit failure aborts the surrounding transaction instead of allowing an
// unaudited balance mutation.

export async function createAuditLog({
  adminId,
  action,
  entityType = null,
  entityId = null,
  previousData = null,
  newData = null,
  reason = null,
  req = null,
  session = null,
  throwOnError = false,
}) {
  try {
    const entry = {
      adminId,
      action,
      entityType,
      entityId,
      previousData: sanitize(previousData),
      newData: sanitize(newData),
      reason,
      ipAddress: req?.ip ?? null,
      userAgent: req?.get?.("user-agent") ?? null,
    };

    if (session) {
      // Model.create() accepts an array as its first argument when a session
      // option is provided — this is the Mongoose-required signature for
      // session-aware inserts.
      await AdminAuditLog.create([entry], { session });
    } else {
      await AdminAuditLog.create(entry);
    }
  } catch (err) {
    console.error(
      "[audit] Failed to write audit log for action %s: %s",
      action,
      err.message
    );
    if (throwOnError) throw err;
  }
}
