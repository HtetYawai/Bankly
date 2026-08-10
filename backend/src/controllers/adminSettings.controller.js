import SystemSettings from "../models/systemSettings.model.js";
import mongoose from "mongoose";
import { createAuditLog, AUDIT_ACTIONS } from "../lib/audit.js";

const SUPPORTED_CURRENCIES = new Set(["THB"]);
const MUTABLE_FIELDS = [
  "applicationName",
  "currency",
  "minimumTransferAmount",
  "maximumTransferAmount",
  "dailyTransferLimit",
  "transferFee",
  "withdrawalFee",
  "maintenanceMode",
];
const MONEY_FIELDS = ["minimumTransferAmount", "maximumTransferAmount", "dailyTransferLimit", "transferFee", "withdrawalFee"];

async function ensureSettings(session = null) {
  return SystemSettings.findOneAndUpdate(
    {},
    { $setOnInsert: {} },
    { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true, ...(session ? { session } : {}) }
  ).lean();
}

function validateMoney(value, field) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`${field} must be a non-negative number.`);
  }
  const minorUnits = Math.round(value * 100);
  if (!Number.isSafeInteger(minorUnits) || Math.abs(value - minorUnits / 100) > Number.EPSILON) {
    throw new Error(`${field} must have at most two decimal places and be within the supported range.`);
  }
}

export function validateSettings(values) {
  for (const field of MONEY_FIELDS) validateMoney(values[field], field);
  if (values.minimumTransferAmount > values.maximumTransferAmount) {
    throw new Error("minimumTransferAmount cannot exceed maximumTransferAmount.");
  }
  if (values.maximumTransferAmount > values.dailyTransferLimit) {
    throw new Error("maximumTransferAmount cannot exceed dailyTransferLimit.");
  }
  if (!SUPPORTED_CURRENCIES.has(values.currency)) throw new Error("currency must be THB.");
  if (typeof values.maintenanceMode !== "boolean") throw new Error("maintenanceMode must be boolean.");
  if (typeof values.applicationName !== "string" || !values.applicationName.trim()) throw new Error("applicationName is required.");
}

export const getSettings = async (_req, res) => {
  try {
    return res.json({ settings: await ensureSettings() });
  } catch (err) {
    console.error("[getSettings]", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const updateSettings = async (req, res) => {
  let session;
  try {
    const unknown = Object.keys(req.body ?? {}).filter((key) => !MUTABLE_FIELDS.includes(key));
    if (unknown.length) return res.status(400).json({ message: `Unsupported settings: ${unknown.join(", ")}.` });
    if (!Object.keys(req.body ?? {}).length) return res.status(400).json({ message: "At least one setting is required." });

    session = await mongoose.startSession();
    let settings;
    await session.withTransaction(async () => {
      const previous = await ensureSettings(session);
      const updates = {};
      for (const field of MUTABLE_FIELDS) if (Object.hasOwn(req.body, field)) updates[field] = req.body[field];
      if (typeof updates.applicationName === "string") updates.applicationName = updates.applicationName.trim();
      if (typeof updates.currency === "string") updates.currency = updates.currency.trim().toUpperCase();
      validateSettings({ ...previous, ...updates });

      settings = await SystemSettings.findOneAndUpdate(
        { _id: previous._id },
        { $set: { ...updates, updatedBy: req.admin._id } },
        { new: true, runValidators: true, session }
      ).lean();

      await createAuditLog({
        adminId: req.admin._id,
        action: AUDIT_ACTIONS.SYSTEM_SETTINGS_UPDATED,
        entityType: "SystemSettings",
        entityId: settings._id,
        previousData: Object.fromEntries(MUTABLE_FIELDS.map((field) => [field, previous[field]])),
        newData: Object.fromEntries(MUTABLE_FIELDS.map((field) => [field, settings[field]])),
        req,
        session,
        throwOnError: true,
      });
    });
    return res.json({ settings });
  } catch (err) {
    if (err.message?.includes("must") || err.message?.includes("cannot") || err.message?.includes("required")) {
      return res.status(400).json({ message: err.message });
    }
    console.error("[updateSettings]", err);
    return res.status(500).json({ message: "Server error" });
  } finally {
    if (session) await session.endSession();
  }
};
