import User from "../models/user.model.js";

export const getUserByAccount = async (req, res) => {
  try {
    const { accountNumber } = req.params;

    if (!/^AC\d{10}$/.test(accountNumber)) {
      return res.status(400).json({ message: "Invalid account format" });
    }

    const user = await User.findOne({ accountNumber });

    if (!user) {
      return res.status(404).json({ message: "Account not found" });
    }

    res.status(200).json({
      fullName: user.fullName,
      accountNumber: user.accountNumber,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};