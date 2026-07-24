const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function allowedOrigins() {
  const configured = [
    process.env.FRONTEND_URL,
    ...(process.env.ADMIN_PORTAL_ORIGINS ?? "").split(","),
  ].map((value) => value?.trim()).filter(Boolean);

  if (process.env.NODE_ENV !== "production") {
    configured.push("http://localhost:5173", "http://localhost:5174");
  }
  return new Set(configured);
}

// Admin authentication is cookie based. SameSite=Strict is the primary CSRF
// boundary; this additionally rejects requests browsers explicitly identify as
// cross-site and rejects untrusted Origin headers on state-changing methods.
// Requests without browser provenance headers remain available to trusted
// direct API clients and integration tests.
export function requireTrustedAdminOrigin(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next();

  if (req.get("sec-fetch-site") === "cross-site") {
    return res.status(403).json({ code: "CSRF_REJECTED", message: "Request origin is not allowed." });
  }

  const origin = req.get("origin");
  if (origin && !allowedOrigins().has(origin)) {
    return res.status(403).json({ code: "CSRF_REJECTED", message: "Request origin is not allowed." });
  }

  return next();
}
