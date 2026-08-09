import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  message: String,
  transaction: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Transaction",
    default: null,
  },
  isRead: {
    type: Boolean,
    default: false,
  },
}, { timestamps: true });

export default mongoose.model("Notification", notificationSchema);