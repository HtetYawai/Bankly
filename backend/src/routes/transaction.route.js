import express from "express";
import { getTransactions, getTransactionById } from "../controllers/transaction.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/", protect, (req, res, next) => {
  // console.log(" Transaction route hit");
  next();
}, getTransactions);

router.get("/:transactionId", protect, getTransactionById);

export default router;