import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  appendLedgerEntry,
  buildAttributionCallerCoverageReport,
  buildAttributionFirstTouchSnapshot,
  buildAttributionHourlyCompare,
  buildLedgerEntry,
  buildLedgerSummary,
  buildTossReplayPlan,
  buildTossJoinReport,
  enrichCheckoutStartedFirstTouch,
  enrichPaymentSuccessFirstTouch,
  normalizeApprovedAtToIso,
  normalizeAttributionPayload,
  readLedgerEntries,
} from "../src/attribution";
import {
  buildMetaCapiDedupCandidateDetails,
  buildMetaCapiEventId,
  buildMetaCapiLogDiagnostics,
  buildMetaCapiOrderEventSuccessKey,
  buildMetaCapiSyncAlreadyRunningResult,
  selectMetaCapiSyncCandidates,
} from "../src/metaCapi";
import {
  buildAttributionPaymentDecision,
  buildAttributionPaymentStatusSyncPlan,
  findDuplicateFormSubmitEntry,
} from "../src/routes/attribution";
import { normalizeTikTokPixelEventPayload } from "../src/tiktokPixelEvents";

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

test("attribution: normalizeAttributionPayload extracts Imweb order keys from landing URL", () => {
  const normalized = normalizeAttributionPayload({
    landing:
      "https://biocom.kr/shop_payment/?order_code=o20260418abc123&order_no=202604188765432&payment_code=pa20260418abc",
    ttclid: "ttclid-1",
    source: "biocom_imweb",
  });

  assert.equal(normalized.orderId, "202604188765432");
  assert.equal(normalized.ttclid, "ttclid-1");
  assert.equal(normalized.metadata.orderNo, "202604188765432");
  assert.equal(normalized.metadata.orderCode, "o20260418abc123");
  assert.equal(normalized.metadata.paymentCode, "pa20260418abc");
  assert.deepEqual(normalized.metadata.landingPayment, {
    orderCode: "o20260418abc123",
    orderNo: "202604188765432",
    paymentCode: "pa20260418abc",
  });
});

test("attribution: firstTouch snapshot preserves checkout TikTok and caller IDs", () => {
  const requestContext = {
    ip: "127.0.0.1",
    userAgent: "node-test",
    origin: "https://biocom.kr",
    requestReferer: "",
    method: "POST",
    path: "/api/attribution/checkout-context",
  };
  const checkout = buildLedgerEntry(
    "checkout_started",
    {
      orderId: "202604271234567",
      checkoutId: "checkout-1",
      landing: "https://biocom.kr/shop_payment/?order_no=202604271234567&ttclid=tt-1",
      utmSource: "tiktok",
      utmCampaign: "campaign-a",
      ttclid: "tt-1",
      metadata: {
        source: "biocom_imweb",
        clientId: "349382661.1770783461",
        userPseudoId: "349382661.1770783461",
      },
    },
    requestContext,
    "2026-04-27T01:00:00.000Z",
  );

  const snapshot = buildAttributionFirstTouchSnapshot(checkout);
  const enriched = enrichCheckoutStartedFirstTouch(checkout, "2026-04-27T01:00:01.000Z");
  const storedFirstTouch = enriched.metadata.firstTouch as Record<string, unknown>;

  assert.equal(snapshot.source, "biocom_imweb");
  assert.equal(snapshot.clientId, "349382661.1770783461");
  assert.equal(snapshot.ttclid, "tt-1");
  assert.ok(snapshot.tiktokMatchReasons.includes("ttclid_direct"));
  assert.equal(storedFirstTouch.ttclid, "tt-1");
  assert.equal(enriched.metadata.tiktokFirstTouchCandidate, true);
});

test("attribution: payment_success carries checkout firstTouch without overwriting strict fields", () => {
  const requestContext = {
    ip: "127.0.0.1",
    userAgent: "node-test",
    origin: "https://biocom.kr",
    requestReferer: "",
    method: "POST",
    path: "/api/attribution/payment-success",
  };
  const checkout = enrichCheckoutStartedFirstTouch(
    buildLedgerEntry(
      "checkout_started",
      {
        orderId: "202604271234568",
        checkoutId: "checkout-2",
        landing: "https://biocom.kr/shop_payment/?order_no=202604271234568&ttclid=tt-2",
        utmSource: "tiktok",
        utmCampaign: "campaign-b",
        ttclid: "tt-2",
        metadata: {
          source: "biocom_imweb",
          clientId: "client-2",
          userPseudoId: "client-2",
        },
      },
      { ...requestContext, path: "/api/attribution/checkout-context" },
      "2026-04-27T02:00:00.000Z",
    ),
    "2026-04-27T02:00:01.000Z",
  );
  const payment = buildLedgerEntry(
    "payment_success",
    {
      orderId: "202604271234568",
      paymentKey: "pay-2",
      checkoutId: "checkout-2",
      paymentStatus: "confirmed",
      metadata: {
        source: "biocom_imweb",
        value: 11900,
        clientId: "client-2",
        userPseudoId: "client-2",
      },
    },
    requestContext,
    "2026-04-27T02:05:00.000Z",
  );

  const enriched = enrichPaymentSuccessFirstTouch(
    payment,
    [checkout],
    "2026-04-27T02:05:01.000Z",
  );
  const firstTouch = enriched.metadata.firstTouch as Record<string, unknown>;
  const firstTouchMatch = enriched.metadata.firstTouchMatch as Record<string, unknown>;
  const matchedBy = firstTouchMatch.matchedBy as string[];

  assert.equal(enriched.ttclid, "");
  assert.equal(enriched.utmSource, "");
  assert.equal(firstTouch.ttclid, "tt-2");
  assert.equal(firstTouch.utmSource, "tiktok");
  assert.equal(enriched.metadata.tiktokFirstTouchCandidate, true);
  assert.ok(matchedBy.includes("checkout_id"));
  assert.ok(matchedBy.includes("order_id"));
  assert.ok(matchedBy.includes("client_id"));
});

test("attribution: payment_success can carry prior TikTok marketing intent firstTouch", () => {
  const requestContext = {
    ip: "127.0.0.1",
    userAgent: "node-test",
    origin: "https://biocom.kr",
    requestReferer: "",
    method: "POST",
    path: "/api/attribution/marketing-intent",
  };
  const marketingIntent = buildLedgerEntry(
    "marketing_intent",
    {
      landing: "https://biocom.kr/supplements?utm_source=tiktok&utm_campaign=campaign-c&ttclid=tt-3",
      referrer: "https://www.tiktok.com/",
      utmSource: "tiktok",
      utmCampaign: "campaign-c",
      ttclid: "tt-3",
      metadata: {
        source: "biocom_imweb",
        clientId: "client-3",
        userPseudoId: "client-3",
      },
    },
    requestContext,
    "2026-04-28T00:00:00.000Z",
  );
  const payment = buildLedgerEntry(
    "payment_success",
    {
      orderId: "202604301234569",
      paymentKey: "pay-3",
      paymentStatus: "confirmed",
      metadata: {
        source: "biocom_imweb",
        value: 35000,
        clientId: "client-3",
        userPseudoId: "client-3",
      },
    },
    { ...requestContext, path: "/api/attribution/payment-success" },
    "2026-04-30T00:00:00.000Z",
  );

  const enriched = enrichPaymentSuccessFirstTouch(
    payment,
    [marketingIntent],
    "2026-04-30T00:00:01.000Z",
  );
  const firstTouch = enriched.metadata.firstTouch as Record<string, unknown>;
  const firstTouchMatch = enriched.metadata.firstTouchMatch as Record<string, unknown>;
  const matchedBy = firstTouchMatch.matchedBy as string[];

  assert.equal(enriched.ttclid, "");
  assert.equal(firstTouch.touchpoint, "marketing_intent");
  assert.equal(firstTouch.ttclid, "tt-3");
  assert.equal(firstTouchMatch.source, "marketing_intent");
  assert.equal(enriched.metadata.tiktokFirstTouchCandidate, true);
  assert.ok(matchedBy.includes("client_id"));
});

test("tiktok pixel events: normalize payload keeps event-level order and decision keys", () => {
  const event = normalizeTikTokPixelEventPayload(
    {
      action: "released_confirmed_purchase",
      source: "TIKTOK_PIXEL.track",
      eventName: "Purchase",
      eventId: "Purchase_o20260418abc123",
      orderCode: "o20260418abc123",
      orderNo: "202604188765432",
      paymentCode: "pa20260418abc",
      value: "35000",
      currency: "KRW",
      status: "confirmed",
      browserAction: "allow_purchase",
      matchedBy: "toss_direct_payment_key",
      reason: "toss_direct_api_status",
      url:
        "https://biocom.kr/shop_payment_complete?order_code=o20260418abc123&order_no=202604188765432&ttclid=tt-1",
      decision: {
        status: "confirmed",
        browserAction: "allow_purchase",
        matchedBy: "toss_direct_payment_key",
      },
    },
    {
      ip: "127.0.0.1",
      userAgent: "node-test",
      origin: "https://biocom.kr",
      requestReferer: "https://biocom.kr/shop_payment_complete",
      method: "POST",
      path: "/api/attribution/tiktok-pixel-event",
    },
    "biocom_imweb",
    "2026-04-18T01:00:00.000Z",
  );

  assert.equal(event.siteSource, "biocom_imweb");
  assert.equal(event.pixelSource, "TIKTOK_PIXEL.track");
  assert.equal(event.action, "released_confirmed_purchase");
  assert.equal(event.orderCode, "o20260418abc123");
  assert.equal(event.orderNo, "202604188765432");
  assert.equal(event.value, 35000);
  assert.equal(event.decisionStatus, "confirmed");
  assert.equal(event.decisionBranch, "allow_purchase");
  assert.equal(event.decisionMatchedBy, "toss_direct_payment_key");
  assert.equal(event.ttclid, "tt-1");
  assert.ok(event.eventLogId.length > 20);
});

test("meta capi: log diagnostics surfaces duplicate event and order-event keys", () => {
  const diagnostics = buildMetaCapiLogDiagnostics([
    {
      event_id: "order-1_Purchase_1",
      pixel_id: "pixel-1",
      event_name: "Purchase",
      timestamp: "2026-04-10T00:00:01.000Z",
      response_status: 200,
      ledger_entry: {
        orderId: "order-1",
        paymentKey: "pay-1",
        touchpoint: "payment_success",
        captureMode: "live",
        source: "biocom_imweb",
        approvedAt: "2026-04-10T09:00:00+09:00",
        loggedAt: "2026-04-10T00:00:00.000Z",
        value: 10000,
      },
    },
    {
      event_id: "order-1_Purchase_1",
      pixel_id: "pixel-1",
      event_name: "Purchase",
      timestamp: "2026-04-10T00:00:02.000Z",
      response_status: 200,
      ledger_entry: {
        orderId: "order-1",
        paymentKey: "pay-1",
        touchpoint: "payment_success",
        captureMode: "live",
        source: "biocom_imweb",
        approvedAt: "2026-04-10T09:00:00+09:00",
        loggedAt: "2026-04-10T00:00:00.000Z",
        value: 10000,
      },
    },
    {
      event_id: "order-1_Purchase_2",
      pixel_id: "pixel-1",
      event_name: "Purchase",
      timestamp: "2026-04-10T00:00:03.000Z",
      response_status: 500,
      ledger_entry: {
        orderId: "order-1",
        paymentKey: "pay-1",
        touchpoint: "payment_success",
        captureMode: "live",
        source: "biocom_imweb",
        approvedAt: "2026-04-10T09:00:00+09:00",
        loggedAt: "2026-04-10T00:00:00.000Z",
        value: 10000,
      },
    },
  ]);

  assert.equal(diagnostics.total, 3);
  assert.equal(diagnostics.success, 2);
  assert.equal(diagnostics.failure, 1);
  assert.deepEqual(diagnostics.countsBySegment, { operational: 3, manual: 0, test: 0 });
  assert.equal(diagnostics.uniqueEventIds, 2);
  assert.equal(diagnostics.duplicateEventIds, 1);
  assert.equal(diagnostics.duplicateEventIdGroups, 1);
  assert.deepEqual(diagnostics.duplicateEventIdSamples, [
    {
      eventId: "order-1_Purchase_1",
      count: 2,
      orderEventKeys: 1,
      firstSentAt: "2026-04-10T00:00:01.000Z",
      lastSentAt: "2026-04-10T00:00:02.000Z",
      segments: { operational: 2, manual: 0, test: 0 },
    },
  ]);
  assert.equal(diagnostics.uniqueOrderEventKeys, 1);
  assert.equal(diagnostics.duplicateOrderEventKeys, 2);
  assert.equal(diagnostics.duplicateOrderEventGroups, 1);
  assert.deepEqual(diagnostics.duplicateOrderEventBreakdown, {
    retryLikeGroups: 0,
    retryLikeRows: 0,
    multiEventIdGroups: 1,
    multiEventIdRows: 3,
  });
  assert.deepEqual(diagnostics.duplicateOrderEventSamples, [
    {
      orderId: "order-1",
      eventName: "Purchase",
      count: 3,
      uniqueEventIds: 2,
      firstSentAt: "2026-04-10T00:00:01.000Z",
      lastSentAt: "2026-04-10T00:00:03.000Z",
      classification: "multiple_event_ids_duplicate_risk",
      eventIds: ["order-1_Purchase_1", "order-1_Purchase_2"],
      segments: { operational: 3, manual: 0, test: 0 },
      success: 2,
      failure: 1,
    },
  ]);
});

test("meta capi: dedup candidate details focus multi-event-id duplicate risk", async () => {
  const details = await buildMetaCapiDedupCandidateDetails([
    {
      event_id: "dedup-test-order-1_Purchase_1",
      pixel_id: "pixel-1",
      event_name: "Purchase",
      timestamp: "2026-04-10T00:00:01.000Z",
      response_status: 200,
      event_source_url: "https://biocom.kr/order/complete",
      send_path: "auto_sync",
      ledger_entry: {
        orderId: "dedup-test-order-1",
        paymentKey: "dedup-test-pay-1",
        touchpoint: "payment_success",
        captureMode: "live",
        source: "biocom_imweb",
        approvedAt: "2026-04-10T09:00:00+09:00",
        loggedAt: "2026-04-10T00:00:00.000Z",
        value: 10000,
      },
    },
    {
      event_id: "dedup-test-order-1_Purchase_2",
      pixel_id: "pixel-1",
      event_name: "Purchase",
      timestamp: "2026-04-10T00:00:02.000Z",
      response_status: 200,
      send_path: "auto_sync",
      ledger_entry: {
        orderId: "dedup-test-order-1",
        paymentKey: "dedup-test-pay-1",
        touchpoint: "payment_success",
        captureMode: "live",
        source: "biocom_imweb",
        approvedAt: "2026-04-10T09:00:00+09:00",
        loggedAt: "2026-04-10T00:00:00.000Z",
        value: 10000,
        landing: "https://biocom.kr/order/complete?from=ledger",
      },
    },
    {
      event_id: "dedup-test-order-2_Purchase_1",
      pixel_id: "pixel-1",
      event_name: "Purchase",
      timestamp: "2026-04-10T00:00:03.000Z",
      response_status: 200,
      send_path: "auto_sync",
      ledger_entry: {
        orderId: "dedup-test-order-2",
        paymentKey: "dedup-test-pay-2",
        touchpoint: "payment_success",
        captureMode: "live",
        source: "biocom_imweb",
        approvedAt: "2026-04-10T09:00:00+09:00",
        loggedAt: "2026-04-10T00:00:00.000Z",
        value: 10000,
      },
    },
    {
      event_id: "dedup-test-order-2_Purchase_1",
      pixel_id: "pixel-1",
      event_name: "Purchase",
      timestamp: "2026-04-10T00:00:04.000Z",
      response_status: 200,
      send_path: "auto_sync",
      ledger_entry: {
        orderId: "dedup-test-order-2",
        paymentKey: "dedup-test-pay-2",
        touchpoint: "payment_success",
        captureMode: "live",
        source: "biocom_imweb",
        approvedAt: "2026-04-10T09:00:00+09:00",
        loggedAt: "2026-04-10T00:00:00.000Z",
        value: 10000,
      },
    },
  ]);

  assert.equal(details.length, 1);
  assert.equal(details[0].orderId, "dedup-test-order-1");
  assert.equal(details[0].classification, "multiple_event_ids_duplicate_risk");
  assert.equal(details[0].count, 2);
  assert.equal(details[0].uniqueEventIds, 2);
  assert.equal(details[0].rows[0].eventSourceUrl, "https://biocom.kr/order/complete");
  assert.equal(details[0].rows[1].eventSourceUrl, "https://biocom.kr/order/complete?from=ledger");
  assert.equal(details[0].rows[0].sendPath, "auto_sync");
  assert.equal(details[0].rows[0].mode, "operational");
});

test("meta capi: purchase event id is stable by normalized order id", () => {
  const approvedAt = "2026-04-08T10:27:59+09:00";
  const eventIdA = buildMetaCapiEventId({
    orderId: "202604083892378-P1",
    approvedAt,
    loggedAt: "2026-04-08T02:43:32.705Z",
  });
  const eventIdB = buildMetaCapiEventId({
    orderId: "202604083892378",
    approvedAt,
    loggedAt: "2026-04-08T01:28:03.662Z",
  });

  assert.equal(eventIdA, eventIdB);
  assert.equal(eventIdA, "purchase:202604083892378");
  assert.equal(buildMetaCapiEventId({ orderId: "202604083892378" }, "AddPaymentInfo"), "add_payment_info:202604083892378");
});

test("meta capi: purchase event id matches Imweb browser pixel order code when present", () => {
  assert.equal(
    buildMetaCapiEventId({
      orderId: "202604110037075",
      metadata: {
        referrerPayment: {
          orderCode: "o202604111e6d6e78c02e9",
        },
      },
    }),
    "Purchase.o202604111e6d6e78c02e9",
  );

  assert.equal(
    buildMetaCapiEventId({
      orderId: "202604110037075",
      landing: "https://biocom.kr/shop_payment/?order_code=o202604111e6d6e78c02e9&order_no=202604110037075",
    }),
    "Purchase.o202604111e6d6e78c02e9",
  );
});

test("meta capi: order-event success key prefers paymentKey and normalizes product suffix", () => {
  assert.equal(
    buildMetaCapiOrderEventSuccessKey({
      paymentKey: " iw_bi20260408102731qpmS8 ",
      orderId: "202604083892378-P1",
      eventName: "Purchase",
    }),
    "payment:iw_bi20260408102731qpmS8|Purchase",
  );
  assert.equal(
    buildMetaCapiOrderEventSuccessKey({
      orderId: "202604083892378-P2",
      eventName: "Purchase",
    }),
    "order:202604083892378|Purchase",
  );
});

test("meta capi: already running sync is reported as a skipped operational guard", () => {
  const result = buildMetaCapiSyncAlreadyRunningResult();

  assert.equal(result.ok, true);
  assert.equal(result.sent, 0);
  assert.equal(result.failed, 0);
  assert.equal(result.skipped, 1);
  assert.equal(result.skippedAlreadySent, 0);
  assert.equal(result.skippedSyncAlreadyRunning, 1);
  assert.equal(result.items[0]?.status, "skipped");
  assert.equal(result.items[0]?.reason, "sync_already_running");
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

test("attribution: normalizeAttributionPayload falls back user pseudo id and stores Meta browser ids", () => {
  const normalized = normalizeAttributionPayload({
    order_id: "order-identity-fallback",
    client_id: "cid-fallback",
    fbc: "fb.1.1775608079000.fbclid-1",
    fbp: "fb.1.1775608079000.1234567890",
  });

  assert.equal(normalized.metadata.clientId, "cid-fallback");
  assert.equal(normalized.metadata.userPseudoId, "cid-fallback");
  assert.equal(normalized.metadata.userPseudoIdStrategy, "client_id_fallback");
  assert.equal(normalized.metadata.fbc, "fb.1.1775608079000.fbclid-1");
  assert.equal(normalized.metadata.fbp, "fb.1.1775608079000.1234567890");
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

test("attribution: buildAttributionPaymentStatusSyncPlan marks Toss direct fallback rows", () => {
  const requestContext = {
    ip: "127.0.0.1",
    userAgent: "node-test",
    origin: "",
    requestReferer: "",
    method: "POST",
    path: "/api/attribution/payment-success",
  };

  const pending = buildLedgerEntry(
    "payment_success",
    {
      orderId: "order-direct-1",
      paymentKey: "pay-direct-1",
      metadata: {
        status: "WAITING_FOR_DEPOSIT",
        totalAmount: 50000,
      },
    },
    requestContext,
    "2026-04-10T10:00:00.000Z",
  );

  const plan = buildAttributionPaymentStatusSyncPlan(
    [pending],
    [
      {
        paymentKey: "pay-direct-1",
        orderId: "order-direct-1",
        approvedAt: "2026-04-10T23:34:21+09:00",
        status: "DONE",
        channel: "카드",
        store: "biocom",
        totalAmount: 50000,
        syncSource: "toss_direct_api_fallback",
      },
    ],
    10,
    "2026-04-10T14:40:00.000Z",
  );

  assert.equal(plan.totalCandidates, 1);
  assert.equal(plan.matchedRows, 1);
  assert.equal(plan.updatedRows, 1);
  assert.equal(plan.items[0]?.matchType, "direct_payment_key");
  assert.equal(plan.updates[0]?.nextEntry.paymentStatus, "confirmed");
  assert.equal(plan.updates[0]?.nextEntry.approvedAt, "2026-04-10T14:34:21.000Z");
  assert.equal(plan.updates[0]?.nextEntry.metadata.tossSyncSource, "toss_direct_api_fallback");
  assert.equal(plan.updates[0]?.nextEntry.metadata.tossDirectFallbackAt, "2026-04-10T14:40:00.000Z");
});

test("attribution: buildAttributionPaymentStatusSyncPlan marks Imweb overdue virtual accounts as canceled", () => {
  const requestContext = {
    ip: "127.0.0.1",
    userAgent: "node-test",
    origin: "",
    requestReferer: "",
    method: "POST",
    path: "/api/attribution/payment-success",
  };

  const pending = buildLedgerEntry(
    "payment_success",
    {
      orderId: "202604052259913-P1",
      paymentKey: "iw_bi202604052826virtual",
      metadata: {
        status: "WAITING_FOR_DEPOSIT",
        totalAmount: 260100000,
      },
    },
    requestContext,
    "2026-04-05T09:28:37.000Z",
  );

  const plan = buildAttributionPaymentStatusSyncPlan(
    [pending],
    [
      {
        paymentKey: "",
        orderId: "202604052259913",
        approvedAt: "",
        status: "CANCELLED_BEFORE_DEPOSIT",
        channel: "imweb",
        store: "biocom",
        totalAmount: 260100000,
        syncSource: "tb_iamweb_users_overdue",
        imwebPaymentMethod: "VIRTUAL",
        imwebPaymentStatus: "PAYMENT_OVERDUE",
        imwebCancellationReason: "입금기간 마감으로 인한 자동 취소",
        imwebOrderDate: "2026-04-05 18:26:53",
      },
    ],
    10,
    "2026-04-23T02:42:00.000Z",
  );

  assert.equal(plan.totalCandidates, 1);
  assert.equal(plan.matchedRows, 1);
  assert.equal(plan.updatedRows, 1);
  assert.equal(plan.items[0]?.matchType, "imweb_overdue_order_id");
  assert.equal(plan.updates[0]?.nextEntry.paymentStatus, "canceled");
  assert.equal(plan.updates[0]?.nextEntry.metadata.fate, "vbank_expired");
  assert.equal(plan.updates[0]?.nextEntry.metadata.vbankExpired, true);
  assert.equal(plan.updates[0]?.nextEntry.metadata.imwebPaymentStatus, "PAYMENT_OVERDUE");
  assert.equal(plan.updates[0]?.nextEntry.metadata.imwebCancellationReason, "입금기간 마감으로 인한 자동 취소");
});

test("attribution: buildAttributionPaymentStatusSyncPlan prefers Imweb overdue over still-pending direct fallback", () => {
  const requestContext = {
    ip: "127.0.0.1",
    userAgent: "node-test",
    origin: "",
    requestReferer: "",
    method: "POST",
    path: "/api/attribution/payment-success",
  };

  const pending = buildLedgerEntry(
    "payment_success",
    {
      orderId: "202604052259913-P1",
      paymentKey: "pay_pending_123",
      metadata: {
        status: "WAITING_FOR_DEPOSIT",
        totalAmount: 260100000,
      },
    },
    requestContext,
    "2026-04-05T09:28:37.000Z",
  );

  const plan = buildAttributionPaymentStatusSyncPlan(
    [pending],
    [
      {
        paymentKey: "pay_pending_123",
        orderId: "202604052259913-P1",
        approvedAt: "",
        status: "WAITING_FOR_DEPOSIT",
        channel: "toss",
        store: "biocom",
        totalAmount: 260100000,
        syncSource: "toss_direct_api_fallback",
      },
      {
        paymentKey: "",
        orderId: "202604052259913",
        approvedAt: "",
        status: "CANCELLED_BEFORE_DEPOSIT",
        channel: "imweb",
        store: "biocom",
        totalAmount: 260100000,
        syncSource: "tb_iamweb_users_overdue",
        imwebPaymentMethod: "VIRTUAL",
        imwebPaymentStatus: "PAYMENT_OVERDUE",
        imwebCancellationReason: "입금기간 마감으로 인한 자동 취소",
        imwebOrderDate: "2026-04-05 18:26:53",
      },
    ],
    10,
    "2026-04-23T03:20:00.000Z",
  );

  assert.equal(plan.totalCandidates, 1);
  assert.equal(plan.matchedRows, 1);
  assert.equal(plan.updatedRows, 1);
  assert.equal(plan.items[0]?.matchType, "imweb_overdue_order_id");
  assert.equal(plan.updates[0]?.nextEntry.paymentStatus, "canceled");
  assert.equal(plan.updates[0]?.nextEntry.metadata.paymentStatusSyncSource, "tb_iamweb_users_overdue");
  assert.equal(plan.updates[0]?.nextEntry.metadata.vbankExpired, true);
});

test("attribution: payment decision allows only confirmed server status", () => {
  const requestContext = {
    ip: "127.0.0.1",
    userAgent: "node-test",
    origin: "",
    requestReferer: "",
    method: "POST",
    path: "/api/attribution/payment-success",
  };
  const pendingEntry = buildLedgerEntry(
    "payment_success",
    {
      orderId: "202604123890630",
      metadata: {
        status: "WAITING_FOR_DEPOSIT",
        referrerPayment: {
          orderCode: "o20260411a9f1cba638b60",
          paymentCode: "pa2026041183a3aba83dac2",
        },
      },
    },
    requestContext,
    "2026-04-11T16:45:00.000Z",
  );
  const confirmedEntry = buildLedgerEntry(
    "payment_success",
    {
      orderId: "202604123633105",
      metadata: {
        status: "DONE",
        referrerPayment: {
          orderCode: "o20260411ffcf4b110f72e",
          paymentCode: "pa202604114e7d185d01605",
        },
      },
    },
    requestContext,
    "2026-04-11T16:55:00.000Z",
  );

  const pending = buildAttributionPaymentDecision(
    [pendingEntry, confirmedEntry],
    {
      orderId: "",
      orderNo: "202604123890630",
      orderCode: "o20260411a9f1cba638b60",
      paymentCode: "pa2026041183a3aba83dac2",
      paymentKey: "",
      store: "biocom",
    },
  );
  assert.equal(pending.status, "pending");
  assert.equal(pending.browserAction, "block_purchase_virtual_account");
  assert.equal(pending.matchedBy, "ledger_order_id");

  const confirmed = buildAttributionPaymentDecision(
    [pendingEntry, confirmedEntry],
    {
      orderId: "",
      orderNo: "",
      orderCode: "o20260411ffcf4b110f72e",
      paymentCode: "",
      paymentKey: "",
      store: "biocom",
    },
  );
  assert.equal(confirmed.status, "confirmed");
  assert.equal(confirmed.browserAction, "allow_purchase");
  assert.equal(confirmed.matchedBy, "ledger_order_code");
});

test("attribution: payment decision prefers current Toss direct status over ledger", () => {
  const requestContext = {
    ip: "127.0.0.1",
    userAgent: "node-test",
    origin: "",
    requestReferer: "",
    method: "POST",
    path: "/api/attribution/payment-success",
  };
  const pendingLedgerEntry = buildLedgerEntry(
    "payment_success",
    {
      orderId: "202604123633105",
      metadata: {
        status: "WAITING_FOR_DEPOSIT",
      },
    },
    requestContext,
    "2026-04-11T16:55:00.000Z",
  );

  const decision = buildAttributionPaymentDecision(
    [pendingLedgerEntry],
    {
      orderId: "",
      orderNo: "202604123633105",
      orderCode: "",
      paymentCode: "",
      paymentKey: "",
      store: "biocom",
    },
    [
      {
        paymentKey: "iw_bi_payment_key",
        orderId: "202604123633105",
        approvedAt: "2026-04-11T16:56:00+09:00",
        status: "DONE",
        channel: "카드",
        store: "biocom",
        totalAmount: 35000,
        syncSource: "toss_direct_api_fallback",
      },
    ],
  );

  assert.equal(decision.status, "confirmed");
  assert.equal(decision.browserAction, "allow_purchase");
  assert.equal(decision.matchedBy, "toss_direct_order_id");
  assert.equal(decision.matched?.source, "toss_direct_api");
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

test("attribution: selectMetaCapiSyncCandidates filters target before limit", () => {
  const requestContext = {
    ip: "127.0.0.1",
    userAgent: "node-test",
    origin: "",
    requestReferer: "",
    method: "POST",
    path: "/api/attribution/payment-success",
  };

  const candidates = selectMetaCapiSyncCandidates(
    [
      buildLedgerEntry(
        "payment_success",
        {
          orderId: "order-a",
          paymentKey: "pay-a",
          metadata: { status: "DONE" },
        },
        requestContext,
        "2026-04-06T03:00:00.000Z",
      ),
      buildLedgerEntry(
        "payment_success",
        {
          orderId: "order-b",
          paymentKey: "pay-b",
          metadata: { status: "DONE" },
        },
        requestContext,
        "2026-04-06T03:10:00.000Z",
      ),
    ],
    1,
    { orderId: "order-b" },
  );

  assert.equal(candidates.length, 1);
  assert.equal(candidates[0]?.orderId, "order-b");
});

test("attribution: normalizeApprovedAtToIso handles toss style local datetime", () => {
  assert.equal(normalizeApprovedAtToIso("2026-03-29 11:00:00"), "2026-03-29T02:00:00.000Z");
});
