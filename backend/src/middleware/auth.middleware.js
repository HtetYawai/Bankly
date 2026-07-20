import jwt from "jsonwebtoken";
import User from "../models/user.model.js";

export const protect = async (req, res, next) => {
  try {
    const token = req.cookies.token;

    if (!token) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const decoded = jwt.verify(token, "secret");

    // Fetch only the fields needed for revocation checks so the query stays light.
    const user = await User.findById(decoded.id).select("sessionVersion");

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

    req.user = { id: decoded.id, _id: decoded.id };
    next();
  } catch (err) {
    res.status(401).json({ message: "Invalid token" });
  }
};