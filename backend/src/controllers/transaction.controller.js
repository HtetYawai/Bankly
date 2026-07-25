import mongoose from "mongoose";
import Transaction from "../models/transaction.model.js";

export const getTransactionById = async (req, res) => {
  try {
    const { transactionId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(transactionId)) {
      return res.status(400).json({ message: "Invalid transaction id" });
    }

    const transaction = await Transaction.findById(transactionId)
      .populate("sender", "fullName accountNumber")
      .populate("receiver", "fullName accountNumber");

    if (
      !transaction ||
      !(
        transaction.sender?._id.equals(req.user._id) ||
        transaction.receiver?._id.equals(req.user._id)
      )
    ) {
      return res.status(404).json({ message: "Transaction not found" });
    }

    res.json(transaction);
  } catch (err) {
    console.log("ERROR:", err.message);
    res.status(500).json({ message: "Failed to fetch transaction" });
  }
};

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