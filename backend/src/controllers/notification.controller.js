import mongoose from "mongoose";
import Notification from "../models/notification.model.js";

export const getNotifications = async (req, res) => {
  try {
    const notis = await Notification.find({ user: req.user._id })
      .populate("transaction", "transactionId")
      .sort({ createdAt: -1 });

    res.json(notis);
  } catch {
    res.status(500).json({ message: "Failed to fetch notifications" });
  }
};

export const getNotificationById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid notification id" });
    }

    const noti = await Notification.findOne({ _id: id, user: req.user._id })
      .populate("transaction", "transactionId");

    if (!noti) {
      return res.status(404).json({ message: "Notification not found" });
    }

    res.json(noti);
  } catch {
    res.status(500).json({ message: "Failed to fetch notification" });
  }
};