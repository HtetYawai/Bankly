import express from "express";
import { getPublicSettings } from "../controllers/publicSettings.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/", protect, getPublicSettings);

export default router;
