import jwt from "jsonwebtoken";
import User from "../models/user.model.js";

export const protect = async (req, res, next) => {
  try {
    const token = req.cookies?.token ?? req.cookies?.jwt;

    if (!token) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!process.env.JWT_SECRET) {
      console.error("[protect] JWT_SECRET is not configured.");
      return res.status(500).json({ message: "Server configuration error" });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ["HS256"],
    });
    const userId = decoded.id ?? decoded.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    // Fetch only the fields needed for revocation checks so the query stays light.
    const user = await User.findById(userId).select("sessionVersion");

    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Tokens issued before sessionVersion was introduced carry no value for the
    // field; treating both sides as 0 keeps those sessions valid until revoked.
    const tokenVersion = decoded.sessionVersion ?? 0;
    const userVersion  = user.sessionVersion    ?? 0;

    if (tokenVersion !== userVersion) {
      return res.status(401).json({ message: "Session expired. Please log in again." });
    }

    req.user = { id: userId, _id: userId };
    next();
  } catch (err) {
    res.status(401).json({ message: "Invalid token" });
  }
};
