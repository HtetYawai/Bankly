import Notification from "../models/notification.model.js";

export const getNotifications = async (req, res) => {
  try {
    const notis = await Notification.find({ user: req.user._id })
      .sort({ createdAt: -1 });

    res.json(notis);
  } catch {
    res.status(500).json({ message: "Failed to fetch notifications" });
  }
};