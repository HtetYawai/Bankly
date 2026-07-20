/**
 * One-time backfill script. Run this once after deploying the new model
 * fields to ensure existing MongoDB documents carry the correct defaults.
 *
 * Safe to run multiple times — both operations use $exists: false filters
 * so documents already carrying the field are never touched.
 *
 *   node src/scripts/backfillModels.js
 */

import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URL);
  console.log("Connected to MongoDB.");

  // --- User.accountStatus ---
  // Mongoose schema defaults only apply to documents created after the field
  // was added. Existing documents read back as accountStatus: undefined, which
  // would cause admin user-list queries (filtered by accountStatus: "ACTIVE")
  // to miss them. This backfill sets the safe default on every existing row.
  const userResult = await mongoose.connection
    .collection("users")
    .updateMany(
      { accountStatus: { $exists: false } },
      { $set: { accountStatus: "ACTIVE", frozenReason: null, frozenAt: null, unfrozenAt: null } }
    );

  console.log(
    `User backfill: ${userResult.matchedCount} matched, ${userResult.modifiedCount} updated.`
  );

  // --- Transaction.type ---
  // All transactions created before this field was added are peer-to-peer
  // transfers, so "TRANSFER" is the correct value for every existing document.
  const txResult = await mongoose.connection
    .collection("transactions")
    .updateMany(
      { type: { $exists: false } },
      { $set: { type: "TRANSFER", note: "", performedBy: null } }
    );

  console.log(
    `Transaction backfill: ${txResult.matchedCount} matched, ${txResult.modifiedCount} updated.`
  );

  await mongoose.disconnect();
  console.log("Done. Disconnected.");
}

run().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
