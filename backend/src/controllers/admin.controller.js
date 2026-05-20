import User from "../models/user.model.js";
import Transaction from "../models/transaction.model.js";

export const getAdminStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalTransactions = await Transaction.countDocuments();
    const balanceResult = await User.aggregate([
      { $group: { _id: null, totalBalance: { $sum: "$balance" } } },
    ]);
    const totalBalance = balanceResult[0]?.totalBalance || 0;

    res.json({ totalUsers, totalTransactions, totalBalance });
  } catch (err) {
    console.error("Admin stats error:", err);
    res.status(500).json({ message: "Failed to load admin stats" });
  }
};

export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select("-password").sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    console.error("Admin users error:", err);
    res.status(500).json({ message: "Failed to load users" });
  }
};

export const updateUserDailyLimit = async (req, res) => {
  try {
    const { userId } = req.params;
    const { dailyLimit } = req.body;

    if (dailyLimit == null || dailyLimit < 0) {
      return res.status(400).json({ message: "Invalid daily limit value" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.dailyLimit = dailyLimit;
    await user.save();

    res.json({ message: "Daily limit updated", dailyLimit: user.dailyLimit });
  } catch (err) {
    console.error("Admin update limit error:", err);
    res.status(500).json({ message: "Failed to update daily limit" });
  }
};

export const getAllTransactions = async (req, res) => {
  try {
    const transactions = await Transaction.find()
      .populate("sender", "fullName email accountNumber")
      .populate("receiver", "fullName email accountNumber")
      .sort({ createdAt: -1 });

    res.json(transactions);
  } catch (err) {
    console.error("Admin transactions error:", err);
    res.status(500).json({ message: "Failed to load transactions" });
  }
};
