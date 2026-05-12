import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { getCrmDb, resetCrmDbForTests } from "../src/crmLocalDb";
import {
  estimateInternalRoasLift,
  fetchNpayActualConfirmedSiteLandingSummary,
  type NpayActualConfirmedSnapshot,
} from "../src/npayActualConfirmedPgReader";

const TEST_DB_PATH = path.join(os.tmpdir(), `npay-actual-confirmed-reader-${process.pid}.sqlite3`);
process.env.CRM_LOCAL_DB_PATH = TEST_DB_PATH;

const baseSnapshot = (overrides: Partial<NpayActualConfirmedSnapshot> = {}): NpayActualConfirmedSnapshot => ({
  ok: true,
  windowDays: 30,
  generatedAtIso: "2026-05-10T14:25:00.000Z",
  rows: 209,
  totalAmountKrw: 37638900,
  avgAmountKrw: 180090,
  medianAmountKrw: 109200,
  p90AmountKrw: 496000,
  minAmountKrw: 11900,
  maxAmountKrw: 978000,
  filter: {
    paymentMethod: "NAVERPAY_ORDER",
    paymentStatus: "PAYMENT_COMPLETE",
    cancelReasonExcluded: true,
    returnReasonExcluded: true,
    amountPositive: true,
  },
  promotionRule: {
    actualPurchaseDefinition:
      "PAYMENT_COMPLETE + cancellation_reason/return_reason empty + final_order_amount > 0",
    npayClickToPurchase: false,
    sendCandidate: false,
    actualSendCandidate: false,
    uploadCandidate: false,
  },
  warnings: [],
  ...overrides,
});

test("npay_actual_confirmed_pg_reader: estimateInternalRoasLift turns 0.27 → ~1.86 with measured snapshot", () => {
  const lift = estimateInternalRoasLift(baseSnapshot(), {
    confirmedOrders: 25,
    confirmedRevenueKrw: 6493020,
    platformCostKrw: 23666491.84,
  });

  assert.equal(lift.before.confirmedOrders, 25);
  assert.equal(lift.before.confirmedRevenueKrw, 6493020);
  // platform cost / before revenue → 0.2743… (rounded)
  assert.ok(lift.before.internalConfirmedRoas > 0.27 && lift.before.internalConfirmedRoas < 0.28);
  assert.equal(lift.after.confirmedOrders, 234);
  assert.equal(lift.after.confirmedRevenueKrw, 44131920);
  // after ROAS should land between 1.85 and 1.87
  assert.ok(
    lift.after.internalConfirmedRoas > 1.85 && lift.after.internalConfirmedRoas < 1.87,
    `expected ~1.86, got ${lift.after.internalConfirmedRoas}`,
  );
  assert.equal(lift.delta.addedOrders, 209);
  assert.equal(lift.delta.addedRevenueKrw, 37638900);
  assert.ok(lift.delta.roasLift > 1.5);
});

test("npay_actual_confirmed_pg_reader: empty snapshot keeps internal ROAS unchanged", () => {
  const empty = baseSnapshot({ rows: 0, totalAmountKrw: 0 });
  const lift = estimateInternalRoasLift(empty, {
    confirmedOrders: 25,
    confirmedRevenueKrw: 6493020,
    platformCostKrw: 23666491.84,
  });

  assert.equal(lift.before.internalConfirmedRoas, lift.after.internalConfirmedRoas);
  assert.equal(lift.delta.addedOrders, 0);
  assert.equal(lift.delta.addedRevenueKrw, 0);
  assert.equal(lift.delta.roasLift, 0);
});

test("npay_actual_confirmed_pg_reader: snapshot promotion rule keeps send_candidate/actual_send_candidate/upload_candidate false", () => {
  const snap = baseSnapshot();
  assert.equal(snap.promotionRule.npayClickToPurchase, false);
  assert.equal(snap.promotionRule.sendCandidate, false);
  assert.equal(snap.promotionRule.actualSendCandidate, false);
  assert.equal(snap.promotionRule.uploadCandidate, false);
  assert.equal(snap.filter.paymentMethod, "NAVERPAY_ORDER");
  assert.equal(snap.filter.paymentStatus, "PAYMENT_COMPLETE");
});

test("npay_actual_confirmed_pg_reader: zero platform cost produces 0 ROAS instead of NaN", () => {
  const lift = estimateInternalRoasLift(baseSnapshot(), {
    confirmedOrders: 25,
    confirmedRevenueKrw: 6493020,
    platformCostKrw: 0,
  });
  assert.equal(lift.before.internalConfirmedRoas, 0);
  assert.equal(lift.after.internalConfirmedRoas, 0);
  assert.equal(lift.delta.roasLift, 0);
});

test.after(() => {
  try {
    resetCrmDbForTests();
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  } catch {
    // ignore cleanup failures
  }
  delete process.env.CRM_LOCAL_DB_PATH;
});

test("coffee actual reader: Imweb v2 NPay rows include paid non-cancel statuses with blank-status warning", async () => {
  resetCrmDbForTests();
  if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  const db = getCrmDb();
  const now = new Date().toISOString();
  const old = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
  const stmt = db.prepare(`
    INSERT INTO imweb_orders (
      order_key, site, order_no, order_code, channel_order_no, order_time, complete_time,
      pay_type, payment_amount, total_price, raw_json, synced_at, imweb_status, imweb_status_synced_at
    )
    VALUES (?, 'thecleancoffee', ?, ?, ?, ?, ?, ?, ?, ?, '{}', ?, ?, ?)
  `);

  stmt.run("coffee-purchase-confirmation", "SECRET_ORDER_NO_001", "coffee-code-1", "coffee-channel-1", now, "", "npay", 1000, 1000, now, "PURCHASE_CONFIRMATION", now);
  stmt.run("coffee-delivering", "SECRET_ORDER_NO_002", "coffee-code-2", "coffee-channel-2", now, "", "npay", 2000, 2000, now, "DELIVERING", now);
  stmt.run("coffee-cancel", "SECRET_ORDER_NO_003", "coffee-code-3", "coffee-channel-3", now, "", "npay", 3000, 3000, now, "CANCEL", now);
  stmt.run("coffee-return", "SECRET_ORDER_NO_004", "coffee-code-4", "coffee-channel-4", now, "", "npay", 4000, 4000, now, "RETURN", now);
  stmt.run("coffee-exchange", "SECRET_ORDER_NO_005", "coffee-code-5", "coffee-channel-5", now, "", "npay", 5000, 5000, now, "EXCHANGE", now);
  stmt.run("coffee-status-blank", "SECRET_ORDER_NO_006", "coffee-code-6", "coffee-channel-6", now, "", "npay", 6000, 6000, now, "", now);
  stmt.run("coffee-old", "SECRET_ORDER_NO_007", "coffee-code-7", "coffee-channel-7", old, "", "npay", 7000, 7000, now, "PURCHASE_CONFIRMATION", now);
  stmt.run("coffee-card", "SECRET_ORDER_NO_008", "coffee-code-8", "coffee-channel-8", now, "", "card", 8000, 8000, now, "PURCHASE_CONFIRMATION", now);
  stmt.run("coffee-zero", "SECRET_ORDER_NO_009", "coffee-code-9", "coffee-channel-9", now, "", "npay", 0, 0, now, "PURCHASE_CONFIRMATION", now);

  const summary = await fetchNpayActualConfirmedSiteLandingSummary({
    site: "thecleancoffee",
    windowDays: 30,
  });

  assert.equal(summary.ok, true);
  assert.equal(summary.source, "imweb_v2_vm_cloud_imweb_orders");
  assert.equal(summary.status, "included_with_warning");
  assert.equal(summary.grossCount, 6);
  assert.equal(summary.grossAmountKrw, 21000);
  assert.equal(summary.completeCount, 3);
  assert.equal(summary.completeAmountKrw, 9000);
  assert.equal(summary.confirmedStatusCount, 2);
  assert.equal(summary.confirmedStatusAmountKrw, 3000);
  assert.equal(summary.statusBlankCount, 1);
  assert.equal(summary.statusBlankAmountKrw, 6000);
  assert.equal(summary.excludedCancelReturnExchangeCount, 3);
  assert.equal(summary.excludedCancelReturnExchangeAmountKrw, 12000);
  assert.equal(summary.maxPaymentCompleteTime, null);
  assert.equal(summary.ga4GuardRole, "already_in_ga4_guard_only_not_actual_source");
  assert.ok(summary.warnings.includes("ga4_guard_not_actual_source"));
  assert.ok(summary.warnings.includes("status_blank_rows_included_with_warning"));

  const serialized = JSON.stringify(summary);
  assert.ok(!serialized.includes("SECRET_ORDER_NO_001"));
  assert.ok(!serialized.includes("coffee-code-1"));
  assert.ok(!serialized.includes("coffee-channel-1"));
});

test("biocom reader regression: biocom still uses operational DB source and does not fall through to coffee", async () => {
  const summary = await fetchNpayActualConfirmedSiteLandingSummary({
    site: "biocom",
    windowDays: 30,
  });
  assert.notEqual(summary.source, "imweb_v2_vm_cloud_imweb_orders");
  assert.ok(summary.source === "operational_db.tb_iamweb_users PAYMENT_COMPLETE" || summary.source === "unavailable");
  assert.ok(!summary.warnings.includes("ga4_guard_not_actual_source"));
});
