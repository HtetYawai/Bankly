import express from "express";
import { getNotifications, getNotificationById } from "../controllers/notification.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import Notification from "../models/notification.model.js";

const router = express.Router();

// GET notifications
router.get("/", protect, (req, res, next) => {
  // console.log("Notification route hit");
  next();
}, getNotifications);

// GET single notification
router.get("/:id", protect, getNotificationById);

// MARK AS READ (FIXED)
router.put("/read", protect, async (req, res) => {
  try {
    await Notification.updateMany(
      { user: req.user._id, isRead: false }, // ONLY CURRENT USER
      { $set: { isRead: true } }
    );

    res.json({ message: "Notifications marked as read" });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Failed to update notifications" });
  }
});

export default router;