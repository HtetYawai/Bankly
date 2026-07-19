import jwt from "jsonwebtoken";

export const protect = (req, res, next) => {
  try {
    const token = req.cookies.token;

    if (!token) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const decoded = jwt.verify(token, "secret");
    req.user = {
  id: decoded.id,
  _id: decoded.id,
};

    next();
  } catch (err) {
    res.status(401).json({ message: "Invalid token" });
  }
};