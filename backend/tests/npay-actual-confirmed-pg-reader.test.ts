import assert from "node:assert/strict";
import test from "node:test";

import {
  estimateInternalRoasLift,
  type NpayActualConfirmedSnapshot,
} from "../src/npayActualConfirmedPgReader";

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
