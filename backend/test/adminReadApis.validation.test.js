import test from "node:test";
import assert from "node:assert/strict";

import { getWalletById } from "../src/controllers/adminWallet.controller.js";
import {
  getAdminTransactions,
  getAdminTransactionById,
} from "../src/controllers/adminTransaction.controller.js";

function responseRecorder() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

test("wallet details rejects an invalid wallet ObjectId", async () => {
  const res = responseRecorder();
  await getWalletById({ params: { walletId: "not-an-object-id" } }, res);
  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body, { message: "Invalid walletId." });
});

test("transaction details rejects an invalid transaction ObjectId", async () => {
  const res = responseRecorder();
  await getAdminTransactionById({ params: { transactionId: "TXN123" } }, res);
  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body, { message: "Invalid transactionId." });
});

test("transaction list rejects invalid sender ObjectIds before querying", async () => {
  const res = responseRecorder();
  await getAdminTransactions({ query: { sender: "invalid" } }, res);
  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body, { message: "sender must be a valid ObjectId." });
});
