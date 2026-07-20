import mongoose from "mongoose";

// Append-only record of every sensitive action performed by an admin.
// Documents in this collection are never updated or deleted by the application.
const adminAuditLogSchema = new mongoose.Schema(
  {
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },

    // Machine-readable action code, e.g. "FREEZE_USER", "BALANCE_ADJUST".
    action: {
      type: String,
      required: true,
      trim: true,
    },

    // The Mongoose model name of the affected document, e.g. "User",
    // "Transaction", "SystemSettings". Null for non-entity actions.
    entityType: {
      type: String,
      trim: true,
      default: null,
    },

    // _id of the affected document. Not a typed ObjectId ref because the
    // referenced collection is determined at runtime by entityType.
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    // Snapshot of the relevant fields before the change.
    previousData: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    // Snapshot of the relevant fields after the change.
    newData: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    reason: {
      type: String,
      trim: true,
      default: null,
    },

    ipAddress: {
      type: String,
      default: null,
    },

    userAgent: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

// Supports the most common admin audit query patterns.
adminAuditLogSchema.index({ adminId: 1, createdAt: -1 });
adminAuditLogSchema.index({ action: 1, createdAt: -1 });
// Compound index serves queries that filter by both entityType and entityId.
adminAuditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
// Standalone entityId index serves queries that filter by entityId alone,
// e.g. "show all audit events touching user <id>" regardless of entityType.
adminAuditLogSchema.index({ entityId: 1, createdAt: -1 });
adminAuditLogSchema.index({ createdAt: -1 });

export default mongoose.model("AdminAuditLog", adminAuditLogSchema);
