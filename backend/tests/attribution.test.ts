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
  buildPaidTouchBeforeCheckoutSnapshot,
  buildLedgerSummary,
  buildTossReplayPlan,
  buildTossJoinReport,
  enrichCheckoutStartedFirstTouch,
  enrichPaymentSuccessFirstTouch,
  mergePaidTouchBeforeCheckoutSnapshot,
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
  getMetaCapiNoSendReason,
  selectMetaCapiSyncCandidates,
} from "../src/metaCapi";
import { buildLeadingIndicatorsReport } from "../src/leadingIndicators";
import {
  buildAttributionPaymentDecision,
  buildAttributionPaymentStatusSyncPlan,
  buildFastLedgerPaymentDecision,
  buildPaidClickIntentNoSendPreview,
  buildNaverEvidenceAggregate,
  buildOperationalPaymentCompleteBridgePlan,
  findDuplicateFormSubmitEntry,
  getPaymentSuccessDowngradeReason,
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

test("attribution: Naver aggregate separates organic, paid, shopping ad, and display markers", () => {
  const requestContext = {
    ip: "",
    userAgent: "",
    origin: "https://biocom.kr",
    requestReferer: "",
    method: "POST",
    path: "/api/attribution/checkout-context",
  };

  const organic = buildLedgerEntry(
    "checkout_started",
    {
      landing: "https://biocom.kr/?NaPm=ct%3Dsample%7Cci%3Dorganic%7Ctr%3Dds%7Chk%3Dhash",
      referrer: "https://search.naver.com/search.naver?query=biocom",
      source: "biocom_imweb",
      checkoutId: "chk-naver-organic",
    },
    requestContext,
    "2026-05-21T13:00:00.000Z",
  );

  const paid = buildLedgerEntry(
    "checkout_started",
    {
      landing:
        "https://www.biocom.kr/mineraltest_store/?idx=6&utm_source=naver&utm_medium=cpc&n_media=27758&n_query=biocom&n_ad_group=grp-1&n_ad=nad-1&n_match=2&NaPm=ct%3Dsample%7Ctr%3Dsa%7Chk%3Dhash",
      referrer: "https://search.naver.com/search.naver?query=biocom",
      utm_source: "naver",
      utm_medium: "cpc",
      source: "biocom_imweb",
      checkoutId: "chk-naver-paid",
    },
    requestContext,
    "2026-05-21T13:01:00.000Z",
  );

  const shopping = buildLedgerEntry(
    "checkout_started",
    {
      landing: "https://biocom.kr/shop_view/?idx=85&NaPm=ct%3Dsample%7Ctr%3Dslsl%7Csn%3D1043174%7Chk%3Dhash",
      referrer: "https://shopping.naver.com/",
      source: "biocom_imweb",
      checkoutId: "chk-naver-shopping",
    },
    requestContext,
    "2026-05-21T13:02:00.000Z",
  );

  const shoppingAd = buildLedgerEntry(
    "checkout_started",
    {
      landing: "https://biocom.kr/shop_view/?idx=85",
      referrer: "https://ader.naver.com/v1/test?c=naver.search.pc.npla&NaPm=1&ui=GUIDE",
      source: "biocom_imweb",
      checkoutId: "chk-naver-shopping-ad",
    },
    requestContext,
    "2026-05-21T13:03:00.000Z",
  );

  const display = buildLedgerEntry(
    "checkout_started",
    {
      landing: "https://biocom.kr/store/?utm_source=naver&utm_medium=display&utm_campaign=advoost_april",
      referrer: "https://search.naver.com/search.naver?query=biocom",
      utm_source: "naver",
      utm_medium: "display",
      utm_campaign: "advoost_april",
      source: "biocom_imweb",
      checkoutId: "chk-naver-display",
    },
    requestContext,
    "2026-05-21T13:04:00.000Z",
  );

  const aggregate = buildNaverEvidenceAggregate([organic, paid, shopping, shoppingAd, display], { fixture: "naver-split" });

  assert.equal(aggregate.summary.byClass.organic_naver_candidate, 1);
  assert.equal(aggregate.summary.byClass.paid_naver, 1);
  assert.equal(aggregate.summary.byClass.naver_shopping_ad, 1);
  assert.equal(aggregate.summary.byClass.naver_display, 1);
  assert.equal(aggregate.summary.byClass.naver_shopping_search_candidate, 1);
  assert.equal(aggregate.summary.naverAny, 5);
});

test("leading indicators: Naver NaPm-only organic does not enter paid or brand bucket", () => {
  const requestContext = {
    ip: "",
    userAgent: "",
    origin: "https://biocom.kr",
    requestReferer: "",
    method: "POST",
    path: "/api/attribution/checkout-context",
  };
  const asOfMs = Date.parse("2026-05-21T13:10:00.000Z");

  const organic = buildLedgerEntry(
    "checkout_started",
    {
      landing: "https://biocom.kr/?NaPm=ct%3Dsample%7Cci%3Dorganic%7Ctr%3Dds%7Chk%3Dhash",
      referrer: "https://search.naver.com/search.naver?query=biocom",
      source: "biocom_imweb",
      checkoutId: "chk-leading-naver-organic",
    },
    requestContext,
    "2026-05-21T13:00:00.000Z",
  );

  const paid = buildLedgerEntry(
    "checkout_started",
    {
      landing:
        "https://biocom.kr/mineraltest_store/?idx=6&utm_source=naver&utm_medium=cpc&n_media=27758&n_query=biocom&NaPm=ct%3Dsample%7Ctr%3Dsa%7Chk%3Dhash",
      referrer: "https://search.naver.com/search.naver?query=biocom",
      utm_source: "naver",
      utm_medium: "cpc",
      source: "biocom_imweb",
      checkoutId: "chk-leading-naver-paid",
    },
    requestContext,
    "2026-05-21T13:01:00.000Z",
  );

  const organicReport = buildLeadingIndicatorsReport({
    ledgerEntries: [organic, paid],
    site: "biocom",
    window: "1d",
    channel: "organic",
    dimension: "channel",
    freshness: "cached",
    asOfMs,
  });
  const paidReport = buildLeadingIndicatorsReport({
    ledgerEntries: [organic, paid],
    site: "biocom",
    window: "1d",
    channel: "naver_paid_or_brand",
    dimension: "channel",
    freshness: "cached",
    asOfMs,
  });

  assert.equal(organicReport.cohort.safe_sessions, 1);
  assert.equal(paidReport.cohort.safe_sessions, 1);
});

test("paid-click-intent: stale preview secondary click id does not block live Google click", () => {
  const preview = buildPaidClickIntentNoSendPreview({
    site: "biocom",
    capture_stage: "landing",
    captured_at: "2026-05-21T04:15:25.790Z",
    gclid: "CjwKCAjwt7XQBhBkEiwAtStpp05zLNcr6STRx_gs9wZ9ZvqhsLLSbP6Bfk68G6UEChpmeehxs8TR4hoCsUgQAvD_BwE",
    gbraid: "0AAAAABIj2JiXX_Uuh_3-jfs4r_uy-M4B_",
    wbraid: "test_wbraid_20260514",
    landing_url:
      "https://biocom.kr/mineraltest_store/?idx=6&gad_campaignid=14629255429&gclid=CjwKCAjwt7XQBhBkEiwAtStpp05zLNcr6STRx_gs9wZ9ZvqhsLLSbP6Bfk68G6UEChpmeehxs8TR4hoCsUgQAvD_BwE&gbraid=0AAAAABIj2JiXX_Uuh_3-jfs4r_uy-M4B_",
    local_session_id: "pciv1_fbvrfte2x7q",
  });

  assert.equal(preview.test_click_id, false);
  assert.equal(preview.live_candidate_after_approval, true);
  assert.equal(preview.click_ids.gclid.startsWith("CjwKCA"), true);
  assert.equal(preview.click_ids.gbraid, "0AAAAABIj2JiXX_Uuh_3-jfs4r_uy-M4B_");
  assert.equal(preview.click_ids.wbraid, "");
  assert.deepEqual(preview.ignored_preview_click_id_types, ["wbraid"]);
  assert.equal(preview.block_reasons.includes("test_click_id_rejected_for_live"), false);
});

test("paid-click-intent: preview-only Google click id remains blocked", () => {
  const preview = buildPaidClickIntentNoSendPreview({
    site: "biocom",
    capture_stage: "landing",
    captured_at: "2026-05-21T04:15:25.790Z",
    wbraid: "test_wbraid_20260514",
    landing_url: "https://biocom.kr/mineraltest_store/?idx=6&wbraid=test_wbraid_20260514",
    local_session_id: "pciv1_test",
  });

  assert.equal(preview.test_click_id, true);
  assert.equal(preview.live_candidate_after_approval, false);
  assert.equal(preview.click_ids.wbraid, "test_wbraid_20260514");
  assert.equal(preview.block_reasons.includes("test_click_id_rejected_for_live"), true);
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

test("attribution: payment_success can carry prior Meta marketing intent firstTouch", () => {
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
      landing: "https://biocom.kr/HealthFood/?idx=198&utm_source=facebook&utm_campaign=meta_biocom_food&fbclid=fb-1",
      referrer: "https://l.facebook.com/",
      utmSource: "facebook",
      utmCampaign: "meta_biocom_food",
      fbclid: "fb-1",
      metadata: {
        source: "biocom_imweb",
        clientId: "client-meta-1",
        userPseudoId: "client-meta-1",
        fbc: "fb.1.1777500000000.fb-1",
        fbp: "fb.1.1777500000000.123456789",
      },
    },
    requestContext,
    "2026-04-28T00:00:00.000Z",
  );
  const payment = buildLedgerEntry(
    "payment_success",
    {
      orderId: "202604301234570",
      paymentKey: "pay-meta-1",
      paymentStatus: "confirmed",
      metadata: {
        source: "biocom_imweb",
        value: 35000,
        clientId: "client-meta-1",
        userPseudoId: "client-meta-1",
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
  const metaMatchReasons = firstTouch.metaMatchReasons as string[];
  const matchedBy = firstTouchMatch.matchedBy as string[];

  assert.equal(enriched.fbclid, "");
  assert.equal(firstTouch.touchpoint, "marketing_intent");
  assert.equal(firstTouch.fbclid, "fb-1");
  assert.equal(firstTouchMatch.source, "marketing_intent");
  assert.equal(enriched.metadata.metaFirstTouchCandidate, true);
  assert.ok(metaMatchReasons.includes("fbclid_direct"));
  assert.ok(metaMatchReasons.includes("metadata_fbc"));
  assert.ok(matchedBy.includes("client_id"));
});

test("attribution: paidTouchBeforeCheckout grades numeric Meta IDs as A", () => {
  const snapshot = buildPaidTouchBeforeCheckoutSnapshot(
    {
      capturedAt: "2026-05-26T01:00:00.000Z",
      landing:
        "https://biocom.kr/iiary02?utm_source=meta&utm_medium=paid_social&utm_campaign=120000000000000001&utm_term=120000000000000002&utm_content=120000000000000003&campaign_alias=meta_biocom_iiari_acid_260518&fbclid=test-click",
      meta_site_source: "instagram",
      meta_placement: "Instagram_Feed",
    },
    "2026-05-26T01:00:01.000Z",
  );

  assert.ok(snapshot);
  assert.equal(snapshot.grade, "A");
  assert.equal(snapshot.confidence, 0.96);
  assert.equal(snapshot.metaCampaignId, "120000000000000001");
  assert.equal(snapshot.metaAdsetId, "120000000000000002");
  assert.equal(snapshot.metaAdId, "120000000000000003");
  assert.equal(snapshot.clickIdType, "fbclid");
  assert.equal(Object.hasOwn(snapshot, "fbclid"), false);
  assert.ok(snapshot.evidence.includes("numeric_meta_campaign_id"));
});

test("attribution: paidTouchBeforeCheckout keeps existing A when shop_payment candidate appears", () => {
  const existing = buildPaidTouchBeforeCheckoutSnapshot(
    {
      capturedAt: "2026-05-26T01:00:00.000Z",
      landing:
        "https://biocom.kr/iiary02?utm_source=meta&utm_medium=paid_social&utm_campaign=120000000000000011&utm_term=120000000000000012&utm_content=120000000000000013",
    },
    "2026-05-26T01:00:01.000Z",
  );
  assert.ok(existing);

  const merged = mergePaidTouchBeforeCheckoutSnapshot(
    existing,
    {
      capturedAt: "2026-05-26T01:05:00.000Z",
      landing: "https://biocom.kr/shop_payment/?order_no=test-order&fbclid=test-click",
      utm_source: "meta",
    },
    "2026-05-26T01:05:01.000Z",
  );

  assert.deepEqual(merged, existing);
});

test("attribution: paidTouchBeforeCheckout does not treat common campaign_alias as B grade", () => {
  const snapshot = buildPaidTouchBeforeCheckoutSnapshot(
    {
      capturedAt: "2026-05-26T01:00:00.000Z",
      landing: "https://biocom.kr/jiihyun01?fbclid=test-click",
      campaign_alias: "meta_biocom_광고별칭",
    },
    "2026-05-26T01:00:01.000Z",
  );

  assert.ok(snapshot);
  assert.equal(snapshot.campaignAlias, "meta_biocom_광고별칭");
  assert.notEqual(snapshot.grade, "B");
  assert.equal(snapshot.grade, "D");
  assert.ok(snapshot.evidence.includes("common_campaign_alias"));
});

test("attribution: paidTouchBeforeCheckout quarantines Meta macro placeholders as D", () => {
  const snapshot = buildPaidTouchBeforeCheckoutSnapshot(
    {
      capturedAt: "2026-05-26T01:00:00.000Z",
      landing:
        "https://biocom.kr/songyuul07?utm_source=meta&utm_medium=paid_social&utm_campaign={{campaign.id}}&utm_term={{adset.id}}&utm_content={{ad.id}}&campaign_alias=meta_biocom_광고별칭",
    },
    "2026-05-26T01:00:01.000Z",
  );

  assert.ok(snapshot);
  assert.equal(snapshot.grade, "D");
  assert.ok(snapshot.evidence.includes("meta_macro_placeholder"));
});

test("attribution: paidTouchBeforeCheckout does not promote non-Meta numeric UTM to Meta A", () => {
  const snapshot = buildPaidTouchBeforeCheckoutSnapshot(
    {
      capturedAt: "2026-05-26T01:00:00.000Z",
      landing:
        "https://biocom.kr/mineraltest_store?utm_source=naver&utm_medium=cpc&utm_campaign=123456789&utm_term=987654321&gclid=test-click",
    },
    "2026-05-26T01:00:01.000Z",
  );

  assert.ok(snapshot);
  assert.equal(snapshot.metaCampaignId, "");
  assert.equal(snapshot.metaAdsetId, "");
  assert.notEqual(snapshot.grade, "A");
});

test("attribution: payment_success copies paidTouchBeforeCheckout metadata snapshot", () => {
  const requestContext = {
    ip: "127.0.0.1",
    userAgent: "node-test",
    origin: "https://biocom.kr",
    requestReferer: "",
    method: "POST",
    path: "/api/attribution/payment-success",
  };
  const payment = buildLedgerEntry(
    "payment_success",
    {
      orderId: "paid-touch-order-1",
      paymentKey: "paid-touch-pay-1",
      paymentStatus: "confirmed",
      metadata: {
        source: "biocom_imweb",
        value: 459000,
        paidTouchBeforeCheckout: {
          capturedAt: "2026-05-26T01:00:00.000Z",
          landing:
            "https://biocom.kr/iiary02?utm_source=meta&utm_medium=paid_social&utm_campaign=120000000000000021&utm_term=120000000000000022&utm_content=120000000000000023&campaign_alias=meta_biocom_iiari_lgg_260518",
        },
      },
    },
    requestContext,
    "2026-05-26T01:05:00.000Z",
  );

  const enriched = enrichPaymentSuccessFirstTouch(payment, [], "2026-05-26T01:05:01.000Z");
  const paidTouch = enriched.metadata.paidTouchBeforeCheckout as Record<string, unknown>;
  const paidTouchMatch = enriched.metadata.paidTouchBeforeCheckoutMatch as Record<string, unknown>;

  assert.equal(paidTouch.grade, "A");
  assert.equal(paidTouch.metaCampaignId, "120000000000000021");
  assert.equal(paidTouch.metaAdsetId, "120000000000000022");
  assert.equal(paidTouch.metaAdId, "120000000000000023");
  assert.equal(paidTouchMatch.storage, "CRM_LOCAL_DB_PATH#attribution_ledger.metadata_json.paidTouchBeforeCheckout");
  assert.equal(paidTouchMatch.grade, "A");
  assert.equal(enriched.metadata.firstTouch, undefined);
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

test("attribution: payment_page_seen is stored as a diagnostic non-purchase touchpoint", () => {
  const entry = buildLedgerEntry(
    "payment_page_seen",
    {
      checkoutId: "checkout-page-seen-1",
      landing: "https://biocom.kr/shop_payment/?order_no=202605150000001",
      source: "biocom_imweb",
      metadata: {
        semantic_touchpoint: "payment_page_seen",
        meta_purchase_candidate: false,
        selected_payment_method: "card",
      },
    },
    {
      ip: "127.0.0.1",
      userAgent: "node-test",
      origin: "https://biocom.kr",
      requestReferer: "",
      method: "POST",
      path: "/api/attribution/payment-page-seen",
    },
    "2026-05-15T02:00:00.000Z",
  );

  assert.equal(entry.touchpoint, "payment_page_seen");
  assert.equal(entry.paymentStatus, null);
  assert.equal(entry.metadata.semantic_touchpoint, "payment_page_seen");
});

test("attribution: payment_success guard downgrades shop_payment progress URLs", () => {
  assert.equal(
    getPaymentSuccessDowngradeReason({
      landing: "https://biocom.kr/shop_payment/?order_no=202605150000002",
      source: "biocom_imweb",
      metadata: {},
    }),
    "shop_payment_progress_url_without_completion_signal",
  );

  assert.equal(
    getPaymentSuccessDowngradeReason({
      landing: "https://biocom.kr/shop_payment_complete?order_no=202605150000003",
      source: "biocom_imweb",
      metadata: { semantic_touchpoint: "payment_success" },
    }),
    "",
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

test("attribution: fast payment decision allows confirmed positive ledger exact match", () => {
  const requestContext = {
    ip: "127.0.0.1",
    userAgent: "node-test",
    origin: "https://biocom.kr",
    requestReferer: "",
    method: "POST",
    path: "/api/attribution/payment-success",
  };
  const confirmedEntry = buildLedgerEntry(
    "payment_success",
    {
      orderId: "202605150000101",
      paymentKey: "pay-fast-confirmed",
      paymentStatus: "confirmed",
      landing:
        "https://biocom.kr/shop_payment_complete?order_code=o20260515fast&payment_code=pa20260515fast&order_no=202605150000101",
      metadata: {
        source: "biocom_imweb",
        semantic_touchpoint: "payment_success",
        page_location_class: "payment_success_allowlist",
        value: 11900,
      },
    },
    requestContext,
    "2026-05-15T02:11:48.000Z",
  );

  const decision = buildFastLedgerPaymentDecision([confirmedEntry], {
    orderId: "",
    orderNo: "202605150000101",
    orderCode: "o20260515fast",
    paymentCode: "",
    paymentKey: "",
    store: "biocom",
  });

  assert.equal(decision?.status, "confirmed");
  assert.equal(decision?.browserAction, "allow_purchase");
  assert.equal(decision?.matchedBy, "ledger_order_id");
  assert.equal(decision?.reason, "fast_ledger_confirmed_positive_exact_match");
});

test("attribution: fast payment decision blocks pending ledger exact match", () => {
  const pendingEntry = buildLedgerEntry(
    "payment_success",
    {
      orderId: "202605150000102",
      paymentStatus: "pending",
      metadata: {
        source: "biocom_imweb",
        status: "WAITING_FOR_DEPOSIT",
        value: 55000,
      },
    },
    {
      ip: "127.0.0.1",
      userAgent: "node-test",
      origin: "https://biocom.kr",
      requestReferer: "",
      method: "POST",
      path: "/api/attribution/payment-success",
    },
    "2026-05-15T02:12:48.000Z",
  );

  const decision = buildFastLedgerPaymentDecision([pendingEntry], {
    orderId: "",
    orderNo: "202605150000102",
    orderCode: "",
    paymentCode: "",
    paymentKey: "",
    store: "biocom",
  });

  assert.equal(decision?.status, "pending");
  assert.equal(decision?.browserAction, "block_purchase_virtual_account");
  assert.equal(decision?.reason, "fast_ledger_pending_status");
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

test("attribution: payment decision allows operational DB PAYMENT_COMPLETE before ledger", () => {
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
      orderId: "202605150000001",
      metadata: { status: "WAITING_FOR_DEPOSIT" },
    },
    requestContext,
    "2026-05-15T12:00:00.000Z",
  );

  const decision = buildAttributionPaymentDecision(
    [pendingLedgerEntry],
    {
      orderId: "",
      orderNo: "202605150000001",
      orderCode: "",
      paymentCode: "",
      paymentKey: "",
      store: "biocom",
    },
    [],
    [
      {
        orderNumber: "202605150000001",
        channelOrderNo: "",
        paymentStatus: "PAYMENT_COMPLETE",
        paymentMethod: "CARD",
        paidAt: "2026-05-15T12:01:00+09:00",
        orderAmount: 35000,
        refundAmount: 0,
        refundPendingAmount: 0,
        hasCancel: false,
        hasReturn: false,
        isNpay: false,
      },
    ],
  );

  assert.equal(decision.status, "confirmed");
  assert.equal(decision.browserAction, "allow_purchase");
  assert.equal(decision.matchedBy, "operational_db_order_number");
  assert.equal(decision.reason, "operational_db_payment_complete");
  assert.equal(decision.matched?.source, "operational_db_tb_iamweb_users");
});

test("attribution: payment decision blocks operational DB pending before Toss", () => {
  const decision = buildAttributionPaymentDecision(
    [],
    {
      orderId: "",
      orderNo: "202605150000002",
      orderCode: "",
      paymentCode: "",
      paymentKey: "",
      store: "biocom",
    },
    [
      {
        paymentKey: "pay-operational-pending",
        orderId: "202605150000002",
        approvedAt: "2026-05-15T12:01:00+09:00",
        status: "DONE",
        channel: "카드",
        store: "biocom",
        totalAmount: 35000,
        syncSource: "toss_direct_api_fallback",
      },
    ],
    [
      {
        orderNumber: "202605150000002",
        channelOrderNo: "",
        paymentStatus: "WAITING_FOR_DEPOSIT",
        paymentMethod: "VIRTUAL",
        paidAt: "",
        orderAmount: 35000,
        refundAmount: 0,
        refundPendingAmount: 0,
        hasCancel: false,
        hasReturn: false,
        isNpay: false,
      },
    ],
  );

  assert.equal(decision.status, "pending");
  assert.equal(decision.browserAction, "block_purchase_virtual_account");
  assert.equal(decision.matchedBy, "operational_db_order_number");
  assert.equal(decision.reason, "operational_db_payment_pending");
});

test("attribution: payment decision treats unconfirmed virtual account as pending block", () => {
  const decision = buildAttributionPaymentDecision(
    [],
    {
      orderId: "",
      orderNo: "202605150000003",
      orderCode: "",
      paymentCode: "",
      paymentKey: "",
      store: "biocom",
    },
    [],
    [
      {
        orderNumber: "202605150000003",
        channelOrderNo: "",
        paymentStatus: "입금대기",
        paymentMethod: "무통장입금",
        paidAt: "",
        orderAmount: 35000,
        refundAmount: 0,
        refundPendingAmount: 0,
        hasCancel: false,
        hasReturn: false,
        isNpay: false,
      },
    ],
  );

  assert.equal(decision.status, "pending");
  assert.equal(decision.browserAction, "block_purchase_virtual_account");
  assert.equal(decision.reason, "operational_db_virtual_or_bank_not_complete");
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

test("attribution: selectMetaCapiSyncCandidates excludes operational bridge no-send rows", () => {
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
        orderId: "order-bridge",
        paymentKey: "pay-bridge",
        paymentStatus: "confirmed",
        metadata: {
          source: "biocom_imweb",
          status: "PAYMENT_COMPLETE",
          value: 123000,
          paymentStatusSyncSource: "operational_db_tb_iamweb_users_payment_complete_bridge",
          metaCapiAutoSendAllowed: false,
        },
      },
      requestContext,
      "2026-05-14T07:00:00.000Z",
    ),
    buildLedgerEntry(
      "payment_success",
      {
        orderId: "order-normal",
        paymentKey: "pay-normal",
        paymentStatus: "confirmed",
        metadata: { source: "biocom_imweb", status: "DONE", value: 99000 },
      },
      requestContext,
      "2026-05-14T07:10:00.000Z",
    ),
  ]);

  assert.equal(candidates.length, 1);
  assert.equal(candidates[0]?.orderId, "order-normal");
});

test("attribution: meta capi value guard blocks payment page and unsafe values", () => {
  const requestContext = {
    ip: "127.0.0.1",
    userAgent: "node-test",
    origin: "https://biocom.kr",
    requestReferer: "",
    method: "POST",
    path: "/api/attribution/payment-success",
  };

  const pageSeen = buildLedgerEntry(
    "payment_page_seen",
    {
      checkoutId: "checkout-payment-page",
      landing: "https://biocom.kr/shop_payment/?order_no=202605150000004",
      metadata: { source: "biocom_imweb", semantic_touchpoint: "payment_page_seen", value: 99000 },
    },
    requestContext,
    "2026-05-15T02:10:00.000Z",
  );
  const pendingGuard = buildLedgerEntry(
    "payment_success",
    {
      orderId: "order-needs-value-guard",
      paymentKey: "pay-needs-value-guard",
      paymentStatus: "confirmed",
      metadata: {
        source: "biocom_imweb",
        status: "DONE",
        value: 99000,
        value_guard_required_before_meta_send: true,
      },
    },
    requestContext,
    "2026-05-15T02:11:00.000Z",
  );
  const mismatch = buildLedgerEntry(
    "payment_success",
    {
      orderId: "order-value-mismatch",
      paymentKey: "pay-value-mismatch",
      paymentStatus: "confirmed",
      metadata: {
        source: "biocom_imweb",
        status: "DONE",
        value: 99000,
        valueGuard: { status: "passed", sourceTotalKrw: 88000 },
      },
    },
    requestContext,
    "2026-05-15T02:12:00.000Z",
  );
  const passed = buildLedgerEntry(
    "payment_success",
    {
      orderId: "order-value-pass",
      paymentKey: "pay-value-pass",
      paymentStatus: "confirmed",
      metadata: {
        source: "biocom_imweb",
        status: "DONE",
        value: 99000,
        value_guard_required_before_meta_send: true,
        valueGuard: { status: "passed", sourceTotalKrw: 99000 },
      },
    },
    requestContext,
    "2026-05-15T02:13:00.000Z",
  );

  assert.equal(getMetaCapiNoSendReason(pageSeen), "payment_page_seen_not_purchase");
  assert.equal(getMetaCapiNoSendReason(pendingGuard), "value_guard_required_not_passed");
  assert.equal(getMetaCapiNoSendReason(mismatch), "value_source_total_mismatch");
  assert.equal(getMetaCapiNoSendReason(passed), "");

  const candidates = selectMetaCapiSyncCandidates([pageSeen, pendingGuard, mismatch, passed]);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0]?.orderId, "order-value-pass");
});

test("attribution: meta capi candidate gate blocks zero, negative, and zero source totals", () => {
  const requestContext = {
    ip: "127.0.0.1",
    userAgent: "node-test",
    origin: "https://biocom.kr",
    requestReferer: "",
    method: "POST",
    path: "/api/attribution/payment-success",
  };

  const zeroValue = buildLedgerEntry(
    "payment_success",
    {
      orderId: "order-zero-value",
      paymentKey: "pay-zero-value",
      paymentStatus: "confirmed",
      metadata: {
        source: "biocom_imweb",
        status: "DONE",
        value: 0,
        semantic_touchpoint: "payment_success",
        completed_url_allowlist_pass: true,
      },
    },
    requestContext,
    "2026-05-15T03:00:00.000Z",
  );
  const negativeValue = buildLedgerEntry(
    "payment_success",
    {
      orderId: "order-negative-value",
      paymentKey: "pay-negative-value",
      paymentStatus: "confirmed",
      metadata: {
        source: "biocom_imweb",
        status: "DONE",
        value: -1000,
        semantic_touchpoint: "payment_success",
        completed_url_allowlist_pass: true,
      },
    },
    requestContext,
    "2026-05-15T03:01:00.000Z",
  );
  const zeroSourceTotal = buildLedgerEntry(
    "payment_success",
    {
      orderId: "order-zero-source-total",
      paymentKey: "pay-zero-source-total",
      paymentStatus: "confirmed",
      metadata: {
        source: "biocom_imweb",
        status: "DONE",
        value: 99000,
        valueGuard: { status: "passed", sourceTotalKrw: 0 },
      },
    },
    requestContext,
    "2026-05-15T03:02:00.000Z",
  );
  const positiveValue = buildLedgerEntry(
    "payment_success",
    {
      orderId: "order-positive-value",
      paymentKey: "pay-positive-value",
      paymentStatus: "confirmed",
      metadata: {
        source: "biocom_imweb",
        status: "DONE",
        value: 99000,
        valueGuard: { status: "passed", sourceTotalKrw: 99000 },
      },
    },
    requestContext,
    "2026-05-15T03:03:00.000Z",
  );

  assert.equal(getMetaCapiNoSendReason(zeroValue), "non_positive_value");
  assert.equal(getMetaCapiNoSendReason(negativeValue), "non_positive_value");
  assert.equal(getMetaCapiNoSendReason(zeroSourceTotal), "value_source_total_mismatch");
  assert.equal(getMetaCapiNoSendReason(positiveValue), "");

  const candidates = selectMetaCapiSyncCandidates([zeroValue, negativeValue, zeroSourceTotal, positiveValue]);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0]?.orderId, "order-positive-value");
});

test("attribution: meta capi candidate gate allows confirmed completion URL with runtime Toss value guard", () => {
  const requestContext = {
    ip: "127.0.0.1",
    userAgent: "node-test",
    origin: "https://biocom.kr",
    requestReferer: "",
    method: "POST",
    path: "/api/attribution/payment-success",
  };

  const completionConfirmed = buildLedgerEntry(
    "payment_success",
    {
      orderId: "order-runtime-toss-guard",
      paymentKey: "pay-runtime-toss-guard",
      paymentStatus: "confirmed",
      landing: "https://biocom.kr/shop_payment_complete?order_no=order-runtime-toss-guard",
      metadata: {
        source: "biocom_imweb",
        semantic_touchpoint: "payment_success",
        page_location_class: "payment_success_allowlist",
        completed_url_allowlist_pass: true,
        completion_url: true,
        meta_purchase_candidate: false,
        value_guard_required_before_meta_send: true,
        value: 11900,
      },
    },
    requestContext,
    "2026-05-15T02:11:48.000Z",
  );
  const paymentPageOnly = buildLedgerEntry(
    "payment_page_seen",
    {
      checkoutId: "checkout-runtime-toss-guard",
      landing: "https://biocom.kr/shop_payment/?order_no=order-runtime-toss-guard",
      metadata: {
        source: "biocom_imweb",
        semantic_touchpoint: "payment_page_seen",
        meta_purchase_candidate: false,
        value: 11900,
      },
    },
    requestContext,
    "2026-05-15T02:10:48.000Z",
  );

  assert.equal(getMetaCapiNoSendReason(completionConfirmed), "");
  assert.equal(getMetaCapiNoSendReason(paymentPageOnly), "payment_page_seen_not_purchase");

  const candidates = selectMetaCapiSyncCandidates([paymentPageOnly, completionConfirmed]);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0]?.orderId, "order-runtime-toss-guard");
});

test("attribution: operational PAYMENT_COMPLETE bridge upgrades only safe biocom rows", () => {
  const requestContext = {
    ip: "127.0.0.1",
    userAgent: "node-test",
    origin: "https://biocom.kr",
    requestReferer: "",
    method: "POST",
    path: "/api/attribution/payment-success",
  };
  const makePending = (orderId: string, source = "biocom_imweb") =>
    buildLedgerEntry(
      "payment_success",
      {
        orderId,
        paymentStatus: "pending",
        metadata: { source },
      },
      requestContext,
      "2026-05-14T07:00:00.000Z",
    );

  const plan = buildOperationalPaymentCompleteBridgePlan(
    [
      makePending("safe-card"),
      makePending("free-zero"),
      makePending("npay-order"),
      makePending("cancel-order"),
      makePending("missing-order"),
      makePending("coffee-order", "thecleancoffee_imweb"),
    ],
    [
      {
        orderNumber: "safe-card",
        channelOrderNo: "",
        paymentStatus: "PAYMENT_COMPLETE",
        paymentMethod: "CARD",
        paidAt: "2026-05-14 15:00:00+09",
        orderAmount: 226113,
        refundAmount: 0,
        refundPendingAmount: 0,
        hasCancel: false,
        hasReturn: false,
        isNpay: false,
      },
      {
        orderNumber: "free-zero",
        channelOrderNo: "",
        paymentStatus: "PAYMENT_COMPLETE",
        paymentMethod: "FREE",
        paidAt: "2026-05-14 15:10:00+09",
        orderAmount: 0,
        refundAmount: 0,
        refundPendingAmount: 0,
        hasCancel: false,
        hasReturn: false,
        isNpay: false,
      },
      {
        orderNumber: "npay-order",
        channelOrderNo: "npay-channel-order",
        paymentStatus: "PAYMENT_COMPLETE",
        paymentMethod: "NAVERPAY_ORDER",
        paidAt: "2026-05-14 15:20:00+09",
        orderAmount: 133900,
        refundAmount: 0,
        refundPendingAmount: 0,
        hasCancel: false,
        hasReturn: false,
        isNpay: true,
      },
      {
        orderNumber: "cancel-order",
        channelOrderNo: "",
        paymentStatus: "PAYMENT_COMPLETE",
        paymentMethod: "CARD",
        paidAt: "2026-05-14 15:30:00+09",
        orderAmount: 45000,
        refundAmount: 0,
        refundPendingAmount: 0,
        hasCancel: true,
        hasReturn: false,
        isNpay: false,
      },
    ],
    100,
    "2026-05-14T10:00:00.000Z",
  );

  assert.equal(plan.totalCandidates, 6);
  assert.equal(plan.scopedCandidates, 5);
  assert.equal(plan.updatedRows, 1);
  assert.equal(plan.confirmedAmountKrw, 226113);
  assert.equal(plan.noSendGateRows, 1);
  assert.equal(plan.exclusionsByReason.free_zero_amount?.count, 1);
  assert.equal(plan.exclusionsByReason.npay_excluded?.count, 1);
  assert.equal(plan.exclusionsByReason.cancel_or_return_present?.count, 1);
  assert.equal(plan.exclusionsByReason.operational_row_not_found?.count, 1);
  assert.equal(plan.exclusionsByReason.out_of_scope_source?.count, 1);
  assert.equal(plan.updates[0]?.nextEntry.paymentStatus, "confirmed");
  assert.equal(plan.updates[0]?.nextEntry.metadata.metaCapiAutoSendAllowed, false);
  assert.equal(
    plan.updates[0]?.nextEntry.metadata.paymentStatusSyncSource,
    "operational_db_tb_iamweb_users_payment_complete_bridge",
  );
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
