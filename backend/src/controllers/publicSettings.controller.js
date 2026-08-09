import SystemSettings from "../models/systemSettings.model.js";

export const getPublicSettings = async (_req, res) => {
  try {
    const settings = await SystemSettings.getSettings();
    res.json({
      currency: settings.currency,
      minimumTransferAmount: settings.minimumTransferAmount,
      maximumTransferAmount: settings.maximumTransferAmount,
      dailyTransferLimit: settings.dailyTransferLimit,
      transferFee: settings.transferFee,
      maintenanceMode: settings.maintenanceMode,
    });
  } catch (err) {
    console.error("[getPublicSettings]", err);
    res.status(500).json({ message: "Failed to load settings" });
  }
};
