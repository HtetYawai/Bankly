import express from "express";
import {
  getAdminStats,
  getAllUsers,
  updateUserDailyLimit,
  getAllTransactions,
} from "../controllers/admin.controller.js";
import { protect, adminOnly } from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(protect, adminOnly);
router.get("/stats", getAdminStats);
router.get("/users", getAllUsers);
router.patch("/users/:userId/limit", updateUserDailyLimit);
router.get("/transactions", getAllTransactions);

export default router;
