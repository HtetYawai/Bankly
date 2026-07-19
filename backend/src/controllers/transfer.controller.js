import mongoose from "mongoose";
import User from "../models/user.model.js";
import Transaction from "../models/transaction.model.js";
import Notification from "../models/notification.model.js";

const generateTransactionId = () => {
  return "TXN" + Date.now() + Math.floor(Math.random() * 1000);
};

export const transferMoney = async (req, res) => {
  console.log("BODY:", req.body);
  console.log("USER:", req.user);

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // SAFE extraction
    const senderId = req.user?._id;
    const { receiverAcc, amount } = req.body;

    console.log("senderId:", senderId);
    console.log("receiverAcc:", receiverAcc);
    console.log("amount:", amount);

    // validate input
    if (!senderId) throw new Error("Unauthorized");
    if (!receiverAcc || !amount) {
      throw new Error("Invalid data");
    }

    const sender = await User.findById(senderId).session(session);
    const receiver = await User.findOne({ accountNumber: receiverAcc }).session(session);

    console.log("Sender:", sender);
    console.log("Receiver:", receiver);

    // CRITICAL FIXES
    if (!sender) throw new Error("Sender not found");
    if (!receiver) throw new Error("Receiver not found");

    if (sender.accountNumber === receiverAcc) {
      throw new Error("Cannot send to yourself");
    }

    if (sender.balance < amount) {
      throw new Error("Insufficient balance");
    }

    // Update balances
    sender.balance -= amount;
    receiver.balance += amount;

    await sender.save({ session });
    await receiver.save({ session });

    // Transaction
    const transactionId = "TXN" + Date.now() + Math.floor(Math.random() * 1000);

    await Transaction.create([{
      transactionId,
      sender: sender._id,
      receiver: receiver._id,
      amount,
    }], { session });

    // Notification
    await Notification.create([{
    user: receiver._id,
    message: `You have received ฿${amount.toLocaleString()} from ${sender.fullName}. Transaction ID: ${transactionId}.`,
  }], { session });

    await Notification.create([{
    user: sender._id,
    message: `Your transfer of ฿${amount.toLocaleString()} to ${receiver.fullName} was successful. Transaction ID: ${transactionId}.`,
  }], { session });

    await session.commitTransaction();
    session.endSession();

    return res.json({
      success: true,
      transactionId,
    });

  } catch (err) {
    console.log("TRANSFER ERROR:", err.message);

    await session.abortTransaction();
    session.endSession();

    return res.status(400).json({
      message: err.message,
    });
  }
};