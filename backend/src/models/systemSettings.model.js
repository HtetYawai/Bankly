import mongoose from "mongoose";

// Single-document configuration store. Only one document should ever exist
// in this collection. Use SystemSettings.getSettings() for all reads and
// writes so the singleton is initialised automatically on first access.
//
// Money fields use Number (float64), consistent with the rest of the codebase.
const systemSettingsSchema = new mongoose.Schema(
  {
    applicationName: {
      type: String,
      default: "Bankly",
      trim: true,
    },

    currency: {
      type: String,
      enum: ["THB"],
      default: "THB",
      trim: true,
    },

    minimumTransferAmount: {
      type: Number,
      default: 1,
      min: 0,
    },

    maximumTransferAmount: {
      type: Number,
      default: 25000,
      min: 0,
    },

    dailyTransferLimit: {
      type: Number,
      default: 100000,
      min: 0,
    },

    // Flat fee deducted from the sender on every peer-to-peer transfer.
    transferFee: {
      type: Number,
      default: 0,
      min: 0,
    },

    withdrawalFee: {
      type: Number,
      default: 0,
      min: 0,
    },

    // When true the transfer endpoint rejects all user-initiated transfers.
    maintenanceMode: {
      type: Boolean,
      default: false,
    },

    // Admin who last changed the settings; null until first update.
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
  },
  { timestamps: true }
);

// Returns the single settings document, creating it with defaults if it does
// not yet exist. Safe to call on every request; the upsert is a no-op after
// the first call.
systemSettingsSchema.statics.getSettings = async function () {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({});
  }
  return settings;
};

const SystemSettings = mongoose.model("SystemSettings", systemSettingsSchema);
export default SystemSettings;
