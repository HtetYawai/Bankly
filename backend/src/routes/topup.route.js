import express from "express";
import { topUp, getTopupProviders } from "../controllers/topup.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import { requireFinancialActionPermission } from "../lib/financialActionGuard.js";

const router = express.Router();

router.get("/providers", protect, getTopupProviders);
router.post("/", protect, requireFinancialActionPermission, topUp);

export default router;
