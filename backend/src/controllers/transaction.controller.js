import Transaction from "../models/transaction.model.js";

export const getTransactions = async (req, res) => {
  try {

    const userId = req.user._id;

    const transactions = await Transaction.find({
      $or: [
        { sender: userId },
        { receiver: userId },
      ],
    })
      .populate("sender", "accountNumber")      
      .populate("receiver", "accountNumber")   
      .sort({ createdAt: -1 });

    res.json(transactions);
  } catch (err) {
    console.log("ERROR:", err.message);
    res.status(500).json({ message: "Failed to fetch transactions" });
  }
};