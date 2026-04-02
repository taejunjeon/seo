import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  appendLedgerEntry,
  buildAttributionHourlyCompare,
  buildLedgerEntry,
  buildLedgerSummary,
  buildTossReplayPlan,
  buildTossJoinReport,
  normalizeApprovedAtToIso,
  normalizeAttributionPayload,
  readLedgerEntries,
} from "../src/attribution";

test("attribution: normalizeAttributionPayload accepts snake_case and camelCase fields", () => {
  const normalized = normalizeAttributionPayload({
    order_id: "order-1",
    paymentKey: "pay-1",
    approved_at: "2026-03-29T10:00:00+09:00",
    checkout_id: "checkout-1",
    customer_key: "ck_123",
    landing_path: "/products/a",
    ga_session_id: "ga-session-1",
    utm_source: "meta",
    utm_campaign: "spring",
    fbclid: "fbclid-1",
  });

  assert.equal(normalized.orderId, "order-1");
  assert.equal(normalized.paymentKey, "pay-1");
  assert.equal(normalized.approvedAt, "2026-03-29T10:00:00+09:00");
  assert.equal(normalized.checkoutId, "checkout-1");
  assert.equal(normalized.customerKey, "ck_123");
  assert.equal(normalized.landing, "/products/a");
  assert.equal(normalized.gaSessionId, "ga-session-1");
  assert.equal(normalized.utmSource, "meta");
  assert.equal(normalized.utmCampaign, "spring");
  assert.equal(normalized.fbclid, "fbclid-1");
});

test("attribution: normalizeAttributionPayload keeps captureMode when provided", () => {
  const normalized = normalizeAttributionPayload({
    orderId: "order-1",
    capture_mode: "replay",
  });

  assert.equal(normalized.captureMode, "replay");
});

test("attribution: buildLedgerEntry rejects empty payment_success payload", () => {
  assert.throws(
    () =>
      buildLedgerEntry(
        "payment_success",
        {},
        {
          ip: "127.0.0.1",
          userAgent: "node-test",
          origin: "http://localhost:7010",
          requestReferer: "",
          method: "POST",
          path: "/api/attribution/payment-success",
        },
        "2026-03-29T00:00:00.000Z",
      ),
    /payment_success requires orderId or paymentKey/,
  );
});

test("attribution: appendLedgerEntry and readLedgerEntries round-trip jsonl entries", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "seo-attribution-"));
  const ledgerPath = path.join(tempDir, "ledger.jsonl");

  await appendLedgerEntry(
    buildLedgerEntry(
      "checkout_started",
      { checkoutId: "checkout-1", landing: "/checkout" },
      {
        ip: "127.0.0.1",
        userAgent: "node-test",
        origin: "http://localhost:7010",
        requestReferer: "http://localhost:7010/products",
        method: "POST",
        path: "/api/attribution/checkout-context",
      },
      "2026-03-29T01:00:00.000Z",
    ),
    ledgerPath,
  );

  await appendLedgerEntry(
    buildLedgerEntry(
      "payment_success",
      { orderId: "order-1", paymentKey: "pay-1", gaSessionId: "ga-1" },
      {
        ip: "127.0.0.1",
        userAgent: "node-test",
        origin: "http://localhost:7010",
        requestReferer: "http://localhost:7010/checkout/success",
        method: "POST",
        path: "/api/attribution/payment-success",
      },
      "2026-03-29T02:00:00.000Z",
    ),
    ledgerPath,
  );

  const entries = await readLedgerEntries(ledgerPath);
  const rawContent = await readFile(ledgerPath, "utf8");

  assert.equal(entries.length, 2);
  assert.equal(entries[0]?.touchpoint, "payment_success");
  assert.equal(entries[0]?.paymentKey, "pay-1");
  assert.equal(entries[1]?.touchpoint, "checkout_started");
  assert.match(rawContent, /checkout_started/);
  assert.deepEqual(buildLedgerSummary(entries), {
    totalEntries: 2,
    countsByTouchpoint: {
      payment_success: 1,
      checkout_started: 1,
    },
    countsByCaptureMode: {
      live: 2,
      replay: 0,
      smoke: 0,
    },
    paymentSuccessByCaptureMode: {
      live: 1,
      replay: 0,
      smoke: 0,
    },
    checkoutByCaptureMode: {
      live: 1,
      replay: 0,
      smoke: 0,
    },
    countsBySource: {
      "(none)": 2,
    },
    entriesWithPaymentKey: 1,
    entriesWithOrderId: 1,
    entriesWithGaSessionId: 1,
    entriesWithReferrerPayment: 0,
    latestLoggedAt: "2026-03-29T02:00:00.000Z",
  });
});

test("attribution: buildTossJoinReport prefers paymentKey and falls back to orderId", () => {
  const entries = [
    buildLedgerEntry(
      "payment_success",
      {
        orderId: "order-1",
        paymentKey: "pay-1",
        landing: "/meta-landing",
        gaSessionId: "ga-1",
        utmSource: "meta",
      },
      {
        ip: "127.0.0.1",
        userAgent: "node-test",
        origin: "http://localhost:7010",
        requestReferer: "http://localhost:7010/products",
        method: "POST",
        path: "/api/attribution/payment-success",
      },
      "2026-03-29T02:00:00.000Z",
    ),
    buildLedgerEntry(
      "payment_success",
      {
        orderId: "order-2",
        landing: "/google-landing",
        gaSessionId: "ga-2",
        utmSource: "google",
      },
      {
        ip: "127.0.0.1",
        userAgent: "node-test",
        origin: "http://localhost:7010",
        requestReferer: "http://localhost:7010/products",
        method: "POST",
        path: "/api/attribution/payment-success",
      },
      "2026-03-29T03:00:00.000Z",
    ),
  ];

  const report = buildTossJoinReport(entries, [
    {
      paymentKey: "pay-1",
      orderId: "order-1",
      approvedAt: "2026-03-29T11:00:00+09:00",
      status: "DONE",
      channel: "toss_card",
      store: "biocom",
      totalAmount: 120000,
    },
    {
      paymentKey: "",
      orderId: "order-2",
      approvedAt: "2026-03-29T11:10:00+09:00",
      status: "DONE",
      channel: "toss_card",
      store: "biocom",
      totalAmount: 80000,
    },
    {
      paymentKey: "pay-3",
      orderId: "order-3",
      approvedAt: "2026-03-29T11:20:00+09:00",
      status: "DONE",
      channel: "toss_card",
      store: "biocom",
      totalAmount: 50000,
    },
  ]);

  assert.equal(report.summary.matchedTossRows, 2);
  assert.equal(report.summary.unmatchedTossRows, 1);
  assert.equal(report.summary.matchedByPaymentKey, 1);
  assert.equal(report.summary.matchedByOrderId, 1);
  assert.equal(report.summary.paymentSuccessEntriesWithPaymentKey, 1);
  assert.equal(report.summary.paymentSuccessEntriesWithOrderId, 2);
  assert.equal(report.summary.paymentSuccessEntriesWithBothKeys, 1);
  assert.equal(report.summary.ledgerCoverageRate, 100);
  assert.equal(report.summary.byCaptureMode.live.matchedTossRows, 2);
  assert.equal(report.items[0]?.attributionMatchType, "payment_key");
  assert.equal(report.items[0]?.attribution?.utmSource, "meta");
  assert.equal(report.items[0]?.attribution?.captureMode, "live");
  assert.equal(report.items[1]?.attributionMatchType, "order_id");
  assert.equal(report.items[1]?.attribution?.landing, "/google-landing");
  assert.equal(report.items[2]?.attributionMatchType, "unmatched");
});

test("attribution: buildAttributionHourlyCompare aligns KST hours for toss and receiver rows", () => {
  const entries = [
    buildLedgerEntry(
      "checkout_started",
      {
        checkoutId: "checkout-1",
      },
      {
        ip: "127.0.0.1",
        userAgent: "node-test",
        origin: "http://localhost:7010",
        requestReferer: "",
        method: "POST",
        path: "/api/attribution/checkout-context",
      },
      "2026-03-29T00:05:00.000Z",
    ),
    buildLedgerEntry(
      "payment_success",
      {
        orderId: "order-1",
        paymentKey: "pay-1",
      },
      {
        ip: "127.0.0.1",
        userAgent: "node-test",
        origin: "http://localhost:7010",
        requestReferer: "",
        method: "POST",
        path: "/api/attribution/payment-success",
      },
      "2026-03-29T00:10:00.000Z",
    ),
  ];

  const report = buildAttributionHourlyCompare({
    date: "2026-03-29",
    ledgerEntries: entries,
    tossHourlyRows: [
      {
        dateHour: "2026-03-29 09:00",
        approvalCount: 2,
        totalAmount: 150000,
      },
      {
        dateHour: "2026-03-29 10:00",
        approvalCount: 1,
        totalAmount: 50000,
      },
    ],
  });

  assert.equal(report.length, 24);
  assert.deepEqual(report[9], {
    dateHour: "2026-03-29 09:00",
    tossApprovalCount: 2,
    tossApprovalAmount: 150000,
    paymentSuccessEntries: 1,
    livePaymentSuccessEntries: 1,
    replayPaymentSuccessEntries: 0,
    smokePaymentSuccessEntries: 0,
    checkoutEntries: 1,
    diagnosticLabel: "정상 범위",
  });
  assert.deepEqual(report[10], {
    dateHour: "2026-03-29 10:00",
    tossApprovalCount: 1,
    tossApprovalAmount: 50000,
    paymentSuccessEntries: 0,
    livePaymentSuccessEntries: 0,
    replayPaymentSuccessEntries: 0,
    smokePaymentSuccessEntries: 0,
    checkoutEntries: 0,
    diagnosticLabel: "토스 승인만 있고 payment success receiver가 비어 있음",
  });
});

test("attribution: buildTossReplayPlan creates replay rows and skips existing keys", () => {
  const existingEntries = [
    buildLedgerEntry(
      "payment_success",
      {
        orderId: "order-existing",
        paymentKey: "pay-existing",
      },
      {
        ip: "127.0.0.1",
        userAgent: "node-test",
        origin: "",
        requestReferer: "",
        method: "POST",
        path: "/api/attribution/payment-success",
      },
      "2026-03-29T01:00:00.000Z",
    ),
  ];

  const plan = buildTossReplayPlan(existingEntries, [
    {
      paymentKey: "pay-existing",
      orderId: "order-existing",
      approvedAt: "2026-03-29 10:00:00",
      status: "DONE",
      channel: "toss_card",
      store: "biocom",
      totalAmount: 50000,
    },
    {
      paymentKey: "pay-new",
      orderId: "order-new",
      approvedAt: "2026-03-29 11:00:00",
      status: "DONE",
      channel: "toss_card",
      store: "biocom",
      totalAmount: 70000,
    },
  ]);

  assert.equal(plan.summary.candidateRows, 2);
  assert.equal(plan.summary.insertableRows, 1);
  assert.equal(plan.summary.skippedExistingRows, 1);
  assert.equal(plan.insertableEntries[0]?.captureMode, "replay");
  assert.equal(plan.insertableEntries[0]?.metadata.replaySource, "tb_sales_toss");
  assert.equal(plan.skippedRows[0]?.reason, "paymentKey/orderId already exists");
});

test("attribution: normalizeApprovedAtToIso handles toss style local datetime", () => {
  assert.equal(normalizeApprovedAtToIso("2026-03-29 11:00:00"), "2026-03-29T02:00:00.000Z");
});
