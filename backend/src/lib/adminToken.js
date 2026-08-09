import jwt from "jsonwebtoken";

const COOKIE_NAME = "adminToken";
const TOKEN_EXPIRY = "8h";
const COOKIE_MAX_AGE_MS = 8 * 60 * 60 * 1000; // 8 hours

// Fail loudly at call time if the secret is absent rather than signing with
// undefined, which would produce tokens that silently pass signature checks
// on any server that also has an undefined secret.
function getSecret() {
  const secret = process.env.ADMIN_JWT_SECRET;
  if (!secret) {
    throw new Error(
      "ADMIN_JWT_SECRET is not set. Add it to .env before starting the server."
    );
  }
  return secret;
}

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    maxAge: COOKIE_MAX_AGE_MS,
  };
}

// Issues a signed admin JWT and writes it to the response as an httpOnly
// cookie. The payload carries an explicit role claim, a fixed audience, and
// the tokenVersion so that a password change immediately invalidates all
// previously issued tokens without needing a blacklist.
export function issueAdminToken(admin, res) {
  const token = jwt.sign(
    {
      sub: admin._id.toString(),
      role: "admin",
      aud: "admin-portal",
      tokenVersion: admin.tokenVersion ?? 0,
    },
    getSecret(),
    { expiresIn: TOKEN_EXPIRY, algorithm: "HS256" }
  );

  res.cookie(COOKIE_NAME, token, cookieOptions());
  return token;
}

// Clears the adminToken cookie. Must pass the same options that were used
// when setting it so browsers honour the clear instruction.
export function clearAdminToken(res) {
  res.cookie(COOKIE_NAME, "", {
    ...cookieOptions(),
    maxAge: 0,
  });
}

// Verifies signature, expiry, and audience in one call.
// Throws on any failure — callers must catch.
export function verifyAdminToken(token) {
  return jwt.verify(token, getSecret(), {
    audience: "admin-portal",
    algorithms: ["HS256"],
  });
}
