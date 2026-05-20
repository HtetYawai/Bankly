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
    const senderId = req.user?.id;
    const { receiverAcc, amount } = req.body;
    const transferAmount = Number(amount);

    console.log("senderId:", senderId);
    console.log("receiverAcc:", receiverAcc);
    console.log("amount:", transferAmount);

    // validate input
    if (!senderId) throw new Error("Unauthorized");
    if (
      !receiverAcc ||
      !transferAmount ||
      isNaN(transferAmount) ||
      transferAmount <= 0
    ) {
      throw new Error("Invalid transfer amount or receiver");
    }

    const sender = await User.findById(senderId).session(session);
    const receiver = await User.findOne({ accountNumber: receiverAcc }).session(
      session,
    );

    console.log("Sender:", sender);
    console.log("Receiver:", receiver);

    // CRITICAL FIXES
    if (!sender) throw new Error("Sender not found");
    if (!receiver) throw new Error("Receiver not found");

    if (sender.accountNumber === receiverAcc) {
      throw new Error("Cannot send to yourself");
    }

    if (sender.balance < transferAmount) {
      throw new Error("Insufficient balance");
    }

    const now = new Date();
    const sameDay =
      sender.dailyTransferDate &&
      sender.dailyTransferDate.toDateString() === now.toDateString();

    if (!sameDay) {
      sender.dailyTransferred = 0;
    }

    if (sender.dailyTransferred + transferAmount > sender.dailyLimit) {
      throw new Error(
        `Daily transfer limit exceeded. Limit: ฿${sender.dailyLimit.toLocaleString()}`,
      );
    }

    sender.dailyTransferred += transferAmount;
    sender.dailyTransferDate = now;

    // Update balances
    sender.balance -= transferAmount;
    receiver.balance += transferAmount;

    await sender.save({ session });
    await receiver.save({ session });

    // Transaction
    const transactionId = "TXN" + Date.now() + Math.floor(Math.random() * 1000);

    await Transaction.create(
      [
        {
          transactionId,
          sender: sender._id,
          receiver: receiver._id,
          amount: transferAmount,
        },
      ],
      { session },
    );

    // Notification
    await Notification.create(
      [
        {
          user: receiver._id,
          message: `You have received ฿${transferAmount.toLocaleString()} from ${sender.fullName}. Transaction ID: ${transactionId}.`,
        },
      ],
      { session },
    );

    await Notification.create(
      [
        {
          user: sender._id,
          message: `Your transfer of ฿${transferAmount.toLocaleString()} to ${receiver.fullName} was successful. Transaction ID: ${transactionId}.`,
        },
      ],
      { session },
    );

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
