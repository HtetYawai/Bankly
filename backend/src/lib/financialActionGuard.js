import User from "../models/user.model.js";

export const FINANCIAL_ACTION_ERRORS = Object.freeze({
  ACCOUNT_FROZEN: "ACCOUNT_FROZEN",
  ACCOUNT_CLOSED: "ACCOUNT_CLOSED",
});

export class FinancialActionError extends Error {
  constructor(code, message, status = 403) {
    super(message);
    this.name = "FinancialActionError";
    this.code = code;
    this.status = status;
  }
}

/**
 * Central policy for user-initiated money movement and sensitive account
 * changes. Call this from services that can also be invoked outside HTTP.
 */
export function assertUserCanPerformFinancialAction(user) {
  if (!user) {
    throw new FinancialActionError("UNAUTHORIZED", "Unauthorized", 401);
  }

  if (user.accountStatus === "FROZEN") {
    throw new FinancialActionError(
      FINANCIAL_ACTION_ERRORS.ACCOUNT_FROZEN,
      "This account is frozen. Contact support for assistance."
    );
  }

  if (user.accountStatus === "CLOSED") {
    throw new FinancialActionError(
      FINANCIAL_ACTION_ERRORS.ACCOUNT_CLOSED,
      "This account is closed. Contact support for assistance."
    );
  }
}

/**
 * HTTP adapter for the central policy. It deliberately performs a fresh user
 * lookup so a token issued before an account freeze cannot authorize a write.
 * Admin routes do not use this middleware.
 */
export async function requireFinancialActionPermission(req, res, next) {
  try {
    const userId = req.user?._id ?? req.user?.id;
    const user = userId
      ? await User.findById(userId).select("accountStatus")
      : null;

    assertUserCanPerformFinancialAction(user);
    return next();
  } catch (error) {
    if (error instanceof FinancialActionError) {
      return res.status(error.status).json({
        code: error.code,
        message: error.message,
      });
    }

    return next(error);
  }
}
