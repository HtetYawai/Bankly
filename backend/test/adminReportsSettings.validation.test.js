import test from "node:test";
import assert from "node:assert/strict";

import { parseReportDateRange, ReportValidationError } from "../src/controllers/adminReport.controller.js";
import { updateSettings, validateSettings } from "../src/controllers/adminSettings.controller.js";

function responseRecorder() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test("report date range rejects invalid and reversed dates", () => {
  assert.throws(() => parseReportDateRange({ dateFrom: "invalid" }), ReportValidationError);
  assert.throws(
    () => parseReportDateRange({ dateFrom: "2026-02-02", dateTo: "2026-02-01" }),
    /dateFrom must not be later/
  );
});

test("report date range is bounded", () => {
  assert.throws(
    () => parseReportDateRange({ dateFrom: "2020-01-01", dateTo: "2026-01-01" }),
    /cannot exceed 366 days/
  );
});

test("settings rejects unknown or empty patches before database access", async () => {
  const emptyResponse = responseRecorder();
  await updateSettings({ body: {}, admin: {} }, emptyResponse);
  assert.equal(emptyResponse.statusCode, 400);

  const unknownResponse = responseRecorder();
  await updateSettings({ body: { unsupported: true }, admin: {} }, unknownResponse);
  assert.equal(unknownResponse.statusCode, 400);
});

test("settings enforces limits, fees, currency, and maintenance type", () => {
  const valid = {
    applicationName: "Bankly",
    currency: "THB",
    minimumTransferAmount: 1,
    maximumTransferAmount: 25000,
    dailyTransferLimit: 100000,
    transferFee: 0,
    withdrawalFee: 0,
    maintenanceMode: false,
  };
  assert.doesNotThrow(() => validateSettings(valid));
  assert.throws(() => validateSettings({ ...valid, minimumTransferAmount: 10, maximumTransferAmount: 5 }), /cannot exceed/);
  assert.throws(() => validateSettings({ ...valid, maximumTransferAmount: 200000, dailyTransferLimit: 100000 }), /maximumTransferAmount cannot exceed dailyTransferLimit/);
  assert.throws(() => validateSettings({ ...valid, transferFee: -1 }), /non-negative/);
  assert.throws(() => validateSettings({ ...valid, currency: "USD" }), /THB/);
  assert.throws(() => validateSettings({ ...valid, maintenanceMode: "false" }), /boolean/);
});
