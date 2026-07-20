import express from "express";
import { transferMoney } from "../controllers/transfer.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import { requireFinancialActionPermission } from "../lib/financialActionGuard.js";

const router = express.Router();

router.post("/", protect, requireFinancialActionPermission, transferMoney);

export default router;
