import assert from "node:assert/strict";
import test from "node:test";

import { buildLedgerEntry } from "../src/attribution";
import { buildAttributionTimeline } from "../src/crmPhase1";

test("crmPhase1: buildAttributionTimeline merges ga4, toss, and ledger by date", () => {
  const ledgerEntries = [
    buildLedgerEntry(
      "checkout_started",
      { checkoutId: "checkout-1", landing: "/checkout" },
      {
        ip: "127.0.0.1",
        userAgent: "node-test",
        origin: "http://localhost:7010",
        requestReferer: "",
        method: "POST",
        path: "/api/attribution/checkout-context",
      },
      "2026-03-29T01:00:00.000Z",
    ),
    buildLedgerEntry(
      "payment_success",
      { orderId: "order-1", paymentKey: "pay-1" },
      {
        ip: "127.0.0.1",
        userAgent: "node-test",
        origin: "http://localhost:7010",
        requestReferer: "",
        method: "POST",
        path: "/api/attribution/payment-success",
      },
      "2026-03-28T02:00:00.000Z",
    ),
  ];

  const timeline = buildAttributionTimeline({
    ga4Rows: [
      {
        date: "2026-03-29",
        ecommercePurchases: 2,
        grossPurchaseRevenue: 130000,
      },
    ],
    tossDailyRows: [
      {
        date: "2026-03-29",
        approvalCount: 3,
        totalAmount: 200000,
      },
      {
        date: "2026-03-28",
        approvalCount: 0,
        totalAmount: 0,
      },
    ],
    ledgerEntries,
  });

  assert.equal(timeline.length, 2);
  assert.equal(timeline[0]?.date, "2026-03-29");
  assert.equal(timeline[0]?.ga4NotSetRevenue, 130000);
  assert.equal(timeline[0]?.tossApprovalCount, 3);
  assert.equal(timeline[0]?.paymentSuccessEntries, 0);
  assert.match(timeline[0]?.diagnosticLabel ?? "", /receiver row가 없음/);

  assert.equal(timeline[1]?.date, "2026-03-28");
  assert.equal(timeline[1]?.paymentSuccessEntries, 1);
  assert.equal(timeline[1]?.checkoutEntries, 0);
  assert.match(timeline[1]?.diagnosticLabel ?? "", /토스 승인 집계와 분리됨/);
});
