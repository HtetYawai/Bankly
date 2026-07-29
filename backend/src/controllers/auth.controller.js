import User from "../models/user.model.js";
import { generateToken } from "../lib/utils.js";
import bcrypt from "bcryptjs";

// SIGNUP 
export const signup = async (req, res) => {
  const { fullName, email, password, phone } = req.body;

  try {
    // Validate input
    if (!fullName || !email || !password || !phone) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (password.length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters",
      });
    }

    if (!/^\d{10}$/.test(phone)) {
      return res.status(400).json({
        message: "Phone number must be exactly 10 digits",
      });
}

    // Check existing user (email or phone)
    const userExists = await User.findOne({
      $or: [{ email }, { phone }],
    });

    if (userExists) {
      return res.status(400).json({
        message: "Email or phone already exists",
      });
    }

    // Create user (NO manual hashing!)
    const newUser = await User.create({
      fullName,
      email,
      password,
      phone,
    });

    // Generate token (optional)
    if (generateToken) {
      generateToken(newUser._id, res, newUser.sessionVersion ?? 0);
    }

    // Send response (safe data only)
    res.status(201).json({
      _id: newUser._id,
      fullName: newUser.fullName,
      email: newUser.email,
      phone: newUser.phone,
      accountNumber: newUser.accountNumber,
      qrCode: newUser.qrCode,
      balance: newUser.balance,
    });
  } catch (error) {
    console.error("Error in signup controller:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};




// LOGIN
const MAX_LOGIN_FAILURES = 5;
const LOCK_DURATION_MS = 30 * 60 * 1000; // 30 minutes

// Single message for every authentication failure. A distinct message for
// "no such email" vs "wrong password" vs "locked out" would let an attacker
// enumerate valid customer email addresses.
const INVALID_CREDENTIALS_MSG = "Invalid email or password";

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "All fields required" });
    }

    const user = await User.findOne({ email }).select("+password");

    if (!user) {
      return res.status(401).json({ message: INVALID_CREDENTIALS_MSG });
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      return res.status(401).json({ message: INVALID_CREDENTIALS_MSG });
    }

    if (user.lockedUntil) {
      // Lock period has expired — reset before attempting the comparison.
      user.failedLoginAttempts = 0;
      user.lockedUntil = null;
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      user.failedLoginAttempts = (user.failedLoginAttempts ?? 0) + 1;
      if (user.failedLoginAttempts >= MAX_LOGIN_FAILURES) {
        user.lockedUntil = new Date(Date.now() + LOCK_DURATION_MS);
      }
      await user.save();

      return res.status(401).json({ message: INVALID_CREDENTIALS_MSG });
    }

    user.failedLoginAttempts = 0;
    user.lockedUntil = null;
    await user.save();

    generateToken(user._id, res, user.sessionVersion ?? 0);

    res.json({
      user: {
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        accountNumber: user.accountNumber,
        qrCode: user.qrCode,
        balance: user.balance,
        accountStatus: user.accountStatus,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });

  } catch (err) {
    console.error("[customerLogin]", err.message);
    res.status(500).json({ message: "Server error" });
  }
};



// LOGOUT
export const logout = (req, res) => {
  try {
    const options = {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    };
    res.clearCookie("token", options);
    res.clearCookie("jwt", options);
    res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    console.log("Error in logout controller", error.message);
  }
};



// GET ME
export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};
