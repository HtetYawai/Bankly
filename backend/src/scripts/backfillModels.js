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

  // --- Notification.transaction ---
  // Notifications created before the `transaction` ref field existed have no
  // link, even though transfer notifications embed "Transaction ID: TXN..."
  // in their message text. Recover the link from that text so old
  // notifications can still open their transaction's detail page.
  const candidates = await mongoose.connection
    .collection("notifications")
    .find({ transaction: { $exists: false }, message: /Transaction ID: (\S+)\./ })
    .toArray();

  let notificationsLinked = 0;
  for (const noti of candidates) {
    const match = noti.message.match(/Transaction ID: (\S+)\./);
    const transactionId = match?.[1];
    if (!transactionId) continue;

    const transaction = await mongoose.connection
      .collection("transactions")
      .findOne({ transactionId });
    if (!transaction) continue;

    await mongoose.connection
      .collection("notifications")
      .updateOne({ _id: noti._id }, { $set: { transaction: transaction._id } });
    notificationsLinked++;
  }

  console.log(
    `Notification backfill: ${candidates.length} candidates, ${notificationsLinked} linked.`
  );

  await mongoose.disconnect();
  console.log("Done. Disconnected.");
}

run().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
