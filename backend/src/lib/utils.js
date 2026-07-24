import jwt from "jsonwebtoken";

function jwtSecret() {
  if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET is not configured.");
  return process.env.JWT_SECRET;
}

export const generateToken = (userId, res, sessionVersion = 0) => {
  const token = jwt.sign(
    { id: userId, sessionVersion },
    jwtSecret(),
    { expiresIn: "7d", algorithm: "HS256" }
  );

  res.cookie("token", token, {
    maxAge: 7 * 24 * 60 * 60 * 1000,
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });

  return token;
};
