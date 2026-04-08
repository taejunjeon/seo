import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  appendLedgerEntry,
  buildAttributionCallerCoverageReport,
  buildAttributionHourlyCompare,
  buildLedgerEntry,
  buildLedgerSummary,
  buildTossReplayPlan,
  buildTossJoinReport,
  normalizeApprovedAtToIso,
  normalizeAttributionPayload,
  readLedgerEntries,
} from "../src/attribution";
import { selectMetaCapiSyncCandidates } from "../src/metaCapi";
import { buildAttributionPaymentStatusSyncPlan, findDuplicateFormSubmitEntry } from "../src/routes/attribution";

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

test("attribution: normalizeAttributionPayload enriches standard order and identity keys", () => {
  const normalized = normalizeAttributionPayload({
    order_id: "202604017770927-P1",
    mobile_phone: "010-1234-5678",
    ga_session_id: "ga-session-2",
    client_id: "cid-2",
    user_pseudo_id: "up-2",
  });

  assert.equal(normalized.customerKey, "01012345678");
  assert.equal(normalized.metadata.orderIdBase, "202604017770927");
  assert.equal(normalized.metadata.normalizedPhone, "01012345678");
  assert.equal(normalized.metadata.gaSessionId, "ga-session-2");
  assert.equal(normalized.metadata.clientId, "cid-2");
  assert.equal(normalized.metadata.userPseudoId, "up-2");
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

test("attribution: findDuplicateFormSubmitEntry prefers formId over shared formPage", () => {
  const existing = [
    buildLedgerEntry(
      "form_submit",
      {
        source: "aibio_imweb",
        formId: "/59_form_add.cm_12345",
        formPage: "/59",
      },
      {
        ip: "127.0.0.1",
        userAgent: "node-test",
        origin: "https://aibio.ai",
        requestReferer: "https://aibio.ai/59",
        method: "POST",
        path: "/api/attribution/form-submit",
      },
      "2026-04-08T13:14:00.000Z",
    ),
  ];

  const sameFormId = findDuplicateFormSubmitEntry(
    existing,
    {
      source: "aibio_imweb",
      formId: "/59_form_add.cm_12345",
      formPage: "/59",
    },
    "2026-04-08T13:19:00.000Z",
  );

  const differentFormIdSamePage = findDuplicateFormSubmitEntry(
    existing,
    {
      source: "aibio_imweb",
      formId: "/59_form_add.cm_67890",
      formPage: "/59",
    },
    "2026-04-08T13:19:00.000Z",
  );

  assert.ok(sameFormId);
  assert.equal(differentFormIdSamePage, undefined);
});

test("attribution: findDuplicateFormSubmitEntry falls back to formPage when formId is absent", () => {
  const existing = [
    buildLedgerEntry(
      "form_submit",
      {
        source: "aibio_imweb",
        formPage: "/59",
      },
      {
        ip: "127.0.0.1",
        userAgent: "node-test",
        origin: "https://aibio.ai",
        requestReferer: "https://aibio.ai/59",
        method: "POST",
        path: "/api/attribution/form-submit",
      },
      "2026-04-08T13:14:00.000Z",
    ),
  ];

  const duplicate = findDuplicateFormSubmitEntry(
    existing,
    {
      source: "aibio_imweb",
      formPage: "/59",
    },
    "2026-04-08T13:19:00.000Z",
  );

  const expiredWindow = findDuplicateFormSubmitEntry(
    existing,
    {
      source: "aibio_imweb",
      formPage: "/59",
    },
    "2026-04-08T13:30:01.000Z",
  );

  assert.ok(duplicate);
  assert.equal(expiredWindow, undefined);
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
  assert.equal(entries[0]?.paymentStatus, "pending");
  assert.equal(entries[1]?.touchpoint, "checkout_started");
  assert.equal(entries[1]?.paymentStatus, null);
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
    paymentSuccessByPaymentStatus: {
      pending: 1,
      confirmed: 0,
      canceled: 0,
    },
    paymentRevenueByPaymentStatus: {
      pending: 0,
      confirmed: 0,
      canceled: 0,
    },
    confirmedRevenue: 0,
    pendingRevenue: 0,
    canceledRevenue: 0,
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
    entriesWithClientId: 0,
    entriesWithUserPseudoId: 0,
    entriesWithNormalizedPhone: 0,
    entriesWithOrderIdBase: 1,
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

test("attribution: buildLedgerSummary exposes revenue by payment status", () => {
  const requestContext = {
    ip: "127.0.0.1",
    userAgent: "node-test",
    origin: "",
    requestReferer: "",
    method: "POST",
    path: "/api/attribution/payment-success",
  };

  const summary = buildLedgerSummary([
    buildLedgerEntry(
      "payment_success",
      {
        orderId: "order-pending",
        paymentKey: "pay-pending",
        metadata: {
          status: "WAITING_FOR_DEPOSIT",
          totalAmount: 120000,
        },
      },
      requestContext,
      "2026-04-06T00:00:00.000Z",
    ),
    buildLedgerEntry(
      "payment_success",
      {
        orderId: "order-confirmed",
        paymentKey: "pay-confirmed",
        metadata: {
          status: "DONE",
          totalAmount: 89000,
        },
      },
      requestContext,
      "2026-04-06T00:01:00.000Z",
    ),
    buildLedgerEntry(
      "payment_success",
      {
        orderId: "order-canceled",
        paymentKey: "pay-canceled",
        metadata: {
          status: "CANCELED",
          totalAmount: 33000,
        },
      },
      requestContext,
      "2026-04-06T00:02:00.000Z",
    ),
  ]);

  assert.deepEqual(summary.paymentSuccessByPaymentStatus, {
    pending: 1,
    confirmed: 1,
    canceled: 1,
  });
  assert.deepEqual(summary.paymentRevenueByPaymentStatus, {
    pending: 120000,
    confirmed: 89000,
    canceled: 33000,
  });
  assert.equal(summary.pendingRevenue, 120000);
  assert.equal(summary.confirmedRevenue, 89000);
  assert.equal(summary.canceledRevenue, 33000);
});

test("attribution: buildAttributionCallerCoverageReport summarizes live caller identifier coverage", () => {
  const requestContext = {
    ip: "127.0.0.1",
    userAgent: "node-test",
    origin: "",
    requestReferer: "",
    method: "POST",
    path: "/api/attribution/payment-success",
  };

  const report = buildAttributionCallerCoverageReport([
    buildLedgerEntry(
      "payment_success",
      {
        orderId: "order-complete",
        paymentKey: "pay-complete",
        ga_session_id: "ga-1",
        client_id: "cid-1",
        user_pseudo_id: "up-1",
      },
      requestContext,
      "2026-04-07T01:00:00.000Z",
    ),
    buildLedgerEntry(
      "payment_success",
      {
        orderId: "order-missing-client",
        paymentKey: "pay-missing-client",
        ga_session_id: "ga-2",
      },
      requestContext,
      "2026-04-07T01:10:00.000Z",
    ),
    buildLedgerEntry(
      "checkout_started",
      {
        checkoutId: "checkout-1",
        ga_session_id: "ga-checkout-1",
      },
      {
        ...requestContext,
        path: "/api/attribution/checkout-context",
      },
      "2026-04-07T00:50:00.000Z",
    ),
    buildLedgerEntry(
      "checkout_started",
      {
        checkoutId: "checkout-replay",
        capture_mode: "replay",
        ga_session_id: "ga-replay",
        client_id: "cid-replay",
        user_pseudo_id: "up-replay",
      },
      {
        ...requestContext,
        method: "REPLAY",
        path: "/api/attribution/replay/toss",
      },
      "2026-04-07T00:40:00.000Z",
    ),
  ]);

  assert.deepEqual(report.paymentSuccess, {
    total: 2,
    withGaSessionId: 2,
    withClientId: 1,
    withUserPseudoId: 1,
    withAllThree: 1,
    gaSessionIdRate: 100,
    clientIdRate: 50,
    userPseudoIdRate: 50,
    allThreeRate: 50,
  });
  assert.deepEqual(report.checkoutStarted, {
    total: 1,
    withGaSessionId: 1,
    withClientId: 0,
    withUserPseudoId: 0,
    withAllThree: 0,
    gaSessionIdRate: 100,
    clientIdRate: 0,
    userPseudoIdRate: 0,
    allThreeRate: 0,
  });
  assert.equal(report.recentMissingPayments.length, 1);
  assert.equal(report.recentMissingPayments[0]?.orderId, "order-missing-client");
  assert.deepEqual(report.recentMissingPayments[0]?.missingFields, ["clientId", "userPseudoId"]);
  assert.equal(report.recentMissingCheckouts.length, 1);
  assert.deepEqual(report.recentMissingCheckouts[0]?.missingFields, ["clientId", "userPseudoId"]);
  assert.match(report.notes[0] ?? "", /payment_success/);
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
  assert.equal(plan.insertableEntries[0]?.paymentStatus, "confirmed");
  assert.equal(plan.insertableEntries[0]?.metadata.replaySource, "tb_sales_toss");
  assert.equal(plan.skippedRows[0]?.reason, "paymentKey/orderId already exists");
});

test("attribution: buildLedgerEntry maps payment status to pending, confirmed, canceled", () => {
  const pendingEntry = buildLedgerEntry(
    "payment_success",
    {
      orderId: "order-pending",
      paymentKey: "pay-pending",
      metadata: {
        status: "WAITING_FOR_DEPOSIT",
      },
    },
    {
      ip: "127.0.0.1",
      userAgent: "node-test",
      origin: "",
      requestReferer: "",
      method: "POST",
      path: "/api/attribution/payment-success",
    },
    "2026-04-06T00:00:00.000Z",
  );
  const confirmedEntry = buildLedgerEntry(
    "payment_success",
    {
      orderId: "order-confirmed",
      paymentKey: "pay-confirmed",
      metadata: {
        status: "DONE",
      },
    },
    {
      ip: "127.0.0.1",
      userAgent: "node-test",
      origin: "",
      requestReferer: "",
      method: "POST",
      path: "/api/attribution/payment-success",
    },
    "2026-04-06T00:01:00.000Z",
  );
  const canceledEntry = buildLedgerEntry(
    "payment_success",
    {
      orderId: "order-canceled",
      paymentKey: "pay-canceled",
      metadata: {
        status: "CANCELED",
      },
    },
    {
      ip: "127.0.0.1",
      userAgent: "node-test",
      origin: "",
      requestReferer: "",
      method: "POST",
      path: "/api/attribution/payment-success",
    },
    "2026-04-06T00:02:00.000Z",
  );

  assert.equal(pendingEntry.paymentStatus, "pending");
  assert.equal(confirmedEntry.paymentStatus, "confirmed");
  assert.equal(canceledEntry.paymentStatus, "canceled");
});

test("attribution: buildAttributionPaymentStatusSyncPlan upgrades pending entries from toss rows", () => {
  const requestContext = {
    ip: "127.0.0.1",
    userAgent: "node-test",
    origin: "",
    requestReferer: "",
    method: "POST",
    path: "/api/attribution/payment-success",
  };

  const pendingByPaymentKey = buildLedgerEntry(
    "payment_success",
    {
      orderId: "order-1",
      paymentKey: "pay-1",
      metadata: {
        status: "WAITING_FOR_DEPOSIT",
        totalAmount: 50000,
      },
    },
    requestContext,
    "2026-04-06T01:00:00.000Z",
  );
  const pendingByOrderId = buildLedgerEntry(
    "payment_success",
    {
      orderId: "order-2",
      metadata: {
        status: "WAITING_FOR_DEPOSIT",
        totalAmount: 70000,
      },
    },
    requestContext,
    "2026-04-06T01:10:00.000Z",
  );
  const stillPending = buildLedgerEntry(
    "payment_success",
    {
      orderId: "order-3",
      paymentKey: "pay-3",
      metadata: {
        status: "WAITING_FOR_DEPOSIT",
      },
    },
    requestContext,
    "2026-04-06T01:20:00.000Z",
  );

  const plan = buildAttributionPaymentStatusSyncPlan(
    [pendingByPaymentKey, pendingByOrderId, stillPending],
    [
      {
        paymentKey: "pay-1",
        orderId: "order-1",
        approvedAt: "2026-04-06 10:00:00",
        status: "DONE",
        channel: "toss_card",
        store: "thecleancoffee",
        totalAmount: 50000,
      },
      {
        paymentKey: "",
        orderId: "order-2",
        approvedAt: "",
        status: "CANCELED",
        channel: "toss_virtual_account",
        store: "thecleancoffee",
        totalAmount: 70000,
      },
      {
        paymentKey: "pay-3",
        orderId: "order-3",
        approvedAt: "",
        status: "WAITING_FOR_DEPOSIT",
        channel: "toss_virtual_account",
        store: "thecleancoffee",
        totalAmount: 90000,
      },
    ],
    10,
    "2026-04-06T02:00:00.000Z",
  );

  assert.equal(plan.totalCandidates, 3);
  assert.equal(plan.matchedRows, 3);
  assert.equal(plan.updatedRows, 2);
  assert.equal(plan.skippedPendingRows, 1);
  assert.equal(plan.skippedNoMatchRows, 0);
  assert.equal(plan.updates[0]?.nextEntry.paymentStatus, "confirmed");
  assert.equal(plan.updates[0]?.nextEntry.approvedAt, "2026-04-06T01:00:00.000Z");
  assert.equal(plan.updates[1]?.nextEntry.paymentStatus, "canceled");
  assert.equal(plan.updates[1]?.nextEntry.metadata.tossSyncSource, "tb_sales_toss");
  assert.equal(plan.items[0]?.matchType, "payment_key");
  assert.equal(plan.items[1]?.matchType, "order_id");
  assert.equal(plan.items[2]?.reason, "toss status still pending");
});

test("attribution: selectMetaCapiSyncCandidates keeps confirmed live payments only", () => {
  const requestContext = {
    ip: "127.0.0.1",
    userAgent: "node-test",
    origin: "",
    requestReferer: "",
    method: "POST",
    path: "/api/attribution/payment-success",
  };

  const candidates = selectMetaCapiSyncCandidates([
    buildLedgerEntry(
      "payment_success",
      {
        orderId: "order-confirmed",
        paymentKey: "pay-confirmed",
        metadata: { status: "DONE" },
      },
      requestContext,
      "2026-04-06T03:00:00.000Z",
    ),
    buildLedgerEntry(
      "payment_success",
      {
        orderId: "order-pending",
        paymentKey: "pay-pending",
        metadata: { status: "WAITING_FOR_DEPOSIT" },
      },
      requestContext,
      "2026-04-06T03:10:00.000Z",
    ),
    buildLedgerEntry(
      "payment_success",
      {
        orderId: "order-replay",
        paymentKey: "pay-replay",
        captureMode: "replay",
        metadata: { status: "DONE" },
      },
      requestContext,
      "2026-04-06T03:20:00.000Z",
    ),
  ]);

  assert.equal(candidates.length, 1);
  assert.equal(candidates[0]?.orderId, "order-confirmed");
  assert.equal(candidates[0]?.paymentStatus, "confirmed");
  assert.equal(candidates[0]?.captureMode, "live");
});

test("attribution: normalizeApprovedAtToIso handles toss style local datetime", () => {
  assert.equal(normalizeApprovedAtToIso("2026-03-29 11:00:00"), "2026-03-29T02:00:00.000Z");
});
