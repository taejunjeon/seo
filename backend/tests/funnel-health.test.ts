import assert from "node:assert/strict";
import test from "node:test";

import type { AttributionLedgerEntry } from "../src/attribution";
import { buildFunnelHealthReport } from "../src/funnelHealth";
import type { MetaCapiSendLogRecord } from "../src/metaCapi";

const entry = (overrides: Partial<AttributionLedgerEntry>): AttributionLedgerEntry => ({
  touchpoint: "payment_success",
  captureMode: "live",
  paymentStatus: "confirmed",
  loggedAt: "2026-05-15T01:00:00.000Z",
  orderId: "",
  paymentKey: "",
  approvedAt: "2026-05-15T01:00:00.000Z",
  checkoutId: "",
  customerKey: "",
  landing: "",
  referrer: "",
  gaSessionId: "",
  utmSource: "",
  utmMedium: "",
  utmCampaign: "",
  utmTerm: "",
  utmContent: "",
  gclid: "",
  fbclid: "",
  ttclid: "",
  metadata: {},
  requestContext: {
    ip: "",
    userAgent: "",
    origin: "",
    requestReferer: "",
    method: "POST",
    path: "/api/attribution/payment-success",
  },
  ...overrides,
});
const capi = (overrides: Partial<MetaCapiSendLogRecord>): MetaCapiSendLogRecord => ({
  event_id: "event-1",
  pixel_id: "1283400029487161",
  event_name: "Purchase",
  timestamp: "2026-05-15T01:01:00.000Z",
  response_status: 200,
  response_body: { events_received: 1 },
  ledger_entry: {
    orderId: "",
    paymentKey: "",
    touchpoint: "payment_success",
    captureMode: "live",
    source: "biocom_imweb",
    approvedAt: "2026-05-15T01:00:00.000Z",
    loggedAt: "2026-05-15T01:00:00.000Z",
    value: 1000,
  },
  ...overrides,
});

test("funnel health filters Meta CAPI by site pixel and keeps all_sites separate", () => {
  const ledgerEntries = [
    entry({
      orderId: "biocom-order",
      paymentKey: "biocom-payment",
      landing: "https://biocom.kr/shop_payment_complete",
      utmSource: "meta",
      fbclid: "fbclid-present",
      metadata: { site: "biocom", fbp: "fbp", fbc: "fbc" },
    }),
    entry({
      orderId: "coffee-order",
      paymentKey: "coffee-payment",
      landing: "https://thecleancoffee.com/shop_payment_complete",
      utmSource: "naver",
      metadata: { site: "thecleancoffee", fbp: "fbp" },
    }),
  ];
  const capiLogs = [
    capi({
      event_id: "biocom-event",
      pixel_id: "1283400029487161",
      ledger_entry: {
        ...capi({}).ledger_entry,
        orderId: "biocom-order",
        paymentKey: "biocom-payment",
        source: "biocom_imweb",
      },
    }),
    capi({
      event_id: "coffee-event",
      pixel_id: "1186437633687388",
      ledger_entry: {
        ...capi({}).ledger_entry,
        orderId: "coffee-order",
        paymentKey: "coffee-payment",
        source: "thecleancoffee_imweb",
      },
    }),
  ];

  const biocom = buildFunnelHealthReport({
    ledgerEntries,
    capiLogs,
    site: "biocom",
    window: "7d",
    granularity: "day",
    paymentMethod: "all",
    source: "all",
    asOf: new Date("2026-05-15T02:00:00.000Z"),
  });

  assert.equal(biocom.kpis.meta_capi_success.count, 1);
  assert.equal(biocom.capi_health.last_7d.success, 1);
  assert.deepEqual(biocom.meta_capi_breakdown.capi_site_filter.pixel_ids, ["1283400029487161"]);
  assert.equal(
    biocom.utm_breakdown.find((row) => row.channel === "meta")?.meta_capi_success_count,
    1,
  );
  assert.equal(
    biocom.capi_attribution_join.breakdown.find((row) => row.bucket === "strong_meta_ad_evidence")?.count,
    1,
  );

  const allSites = buildFunnelHealthReport({
    ledgerEntries,
    capiLogs,
    site: "all_sites",
    window: "7d",
    granularity: "day",
    paymentMethod: "all",
    source: "all",
    asOf: new Date("2026-05-15T02:00:00.000Z"),
  });

  assert.equal(allSites.kpis.meta_capi_success.count, 2);
  assert.equal(allSites.meta_capi_breakdown.capi_site_filter.all_sites_mode, true);
});

test("funnel health uses site_landing_ledger evidence for landing step", () => {
  const report = buildFunnelHealthReport({
    ledgerEntries: [
      entry({
        touchpoint: "marketing_intent",
        paymentStatus: "pending",
        loggedAt: "2026-05-15T01:00:00.000Z",
        metadata: { site: "biocom" },
      }),
      entry({
        touchpoint: "checkout_started",
        paymentStatus: "pending",
        loggedAt: "2026-05-15T01:10:00.000Z",
        metadata: { site: "biocom" },
      }),
    ],
    capiLogs: [],
    siteLandingEvidence: {
      source: "VM Cloud site_landing_ledger",
      unit: "first_party_landing_row",
      total: 100,
      byFunnelSource: {
        meta: 40,
        google: 50,
        direct: 10,
      },
      series: [
        {
          date: "2026-05-15",
          landing: 100,
          byFunnelSource: {
            meta: 40,
            google: 50,
            direct: 10,
          },
        },
      ],
      cartPageViews: {
        source: "VM Cloud site_landing_ledger",
        unit: "first_party_cart_page_landing_row",
        pathPattern: "/shop_cart",
        total: 7,
        byFunnelSource: {
          meta: 3,
          google: 4,
        },
        series: [
          {
            date: "2026-05-15",
            cart_page_view: 7,
            byFunnelSource: {
              meta: 3,
              google: 4,
            },
          },
        ],
        caveat: "test cart page evidence",
      },
      caveat: "test evidence",
    },
    site: "biocom",
    window: "7d",
    granularity: "day",
    paymentMethod: "all",
    source: "all",
    asOf: new Date("2026-05-15T02:00:00.000Z"),
  });

  assert.equal(report.funnel.find((step) => step.step === "landing")?.count, 100);
  assert.equal(report.funnel.find((step) => step.step === "add_to_cart")?.label, "장바구니 페이지 진입");
  assert.equal(report.funnel.find((step) => step.step === "add_to_cart")?.count, 7);
  assert.equal(report.site_landing_evidence.applied_to_funnel_landing, true);
  assert.equal(report.site_landing_evidence.cart_page_views?.total, 7);
  assert.equal(report.site_landing_evidence.attribution_ledger_marketing_intent_count, 1);
  assert.equal(report.utm_breakdown.find((row) => row.channel === "meta")?.landing_count, 40);
  assert.equal(report.utm_breakdown.find((row) => row.channel === "google")?.landing_count, 50);
  assert.equal(report.utm_breakdown.find((row) => row.channel === "direct")?.landing_count, 10);
  assert.equal(report.series.find((row) => row.date === "2026-05-15")?.landing, 100);
});

test("funnel health does not count ViewContent as cart page entry fallback", () => {
  const report = buildFunnelHealthReport({
    ledgerEntries: [
      entry({
        touchpoint: "marketing_intent",
        paymentStatus: "pending",
        loggedAt: "2026-05-15T01:00:00.000Z",
        metadata: { site: "biocom", eventName: "ViewContent" },
      }),
      entry({
        touchpoint: "marketing_intent",
        paymentStatus: "pending",
        loggedAt: "2026-05-15T01:05:00.000Z",
        metadata: { site: "biocom", eventName: "AddToCart" },
      }),
    ],
    capiLogs: [],
    site: "biocom",
    window: "7d",
    granularity: "day",
    paymentMethod: "all",
    source: "all",
    asOf: new Date("2026-05-15T02:00:00.000Z"),
  });

  const cartStep = report.funnel.find((step) => step.step === "add_to_cart");
  assert.equal(cartStep?.label, "장바구니 페이지 진입");
  assert.equal(cartStep?.count, 1);
  assert.equal(report.metric_contract.metrics.cart_page_view.unit, "AddToCart event row");
  assert.match(report.metric_contract.metrics.cart_page_view.caveat, /ViewContent는 상품 조회/);
});

test("funnel health exposes safe details for confirmed purchases missing Meta CAPI send", () => {
  const report = buildFunnelHealthReport({
    ledgerEntries: [
      entry({
        orderId: "raw-order-should-not-leak",
        paymentKey: "raw-payment-should-not-leak",
        loggedAt: "2026-05-15T01:00:00.000Z",
        approvedAt: "2026-05-15T01:00:00.000Z",
        landing: "https://biocom.kr/shop_payment_complete",
        utmSource: "meta",
        fbclid: "raw-fbclid-should-not-leak",
        metadata: {
          site: "biocom",
          value: 1000,
          fbc: "raw-fbc-should-not-leak",
          fbp: "raw-fbp-should-not-leak",
        },
      }),
    ],
    capiLogs: [],
    site: "biocom",
    window: "7d",
    granularity: "day",
    paymentMethod: "all",
    source: "all",
    asOf: new Date("2026-05-15T02:00:00.000Z"),
  });

  const item = report.action_queue.find((row) => row.key === "confirmed_but_no_capi_send");
  assert.ok(item);
  assert.equal(item.count, 1);
  assert.equal(item.priority, "watch");
  assert.match(item.title, /보관만, 전송하지 않음/);
  assert.match(item.next_action, /backfill하지 말고/);
  assert.equal(item.details?.length, 1);
  const leak = report.unresolved_leaks.items.find((row) => row.key === "confirmed_but_no_capi_send");
  assert.ok(leak);
  assert.equal(leak.priority, "watch");
  assert.match(leak.human_label, /보관만, 전송하지 않음/);

  const detail = item.details?.[0];
  assert.ok(detail);
  assert.match(detail.safe_ref, /^safe_[a-f0-9]{10}$/);
  assert.equal(detail.source_bucket, "meta");
  assert.equal(detail.amount_krw, 1000);
  assert.equal(detail.missing_policy, "legacy_do_not_backfill");
  assert.match(detail.missing_reason, /legacy backlog/);
  assert.match(detail.recommended_action, /보관만, 전송하지 않음/);

  const serialized = JSON.stringify(detail);
  assert.equal(serialized.includes("raw-order-should-not-leak"), false);
  assert.equal(serialized.includes("raw-payment-should-not-leak"), false);
  assert.equal(serialized.includes("raw-fbclid-should-not-leak"), false);
});

test("funnel health keeps current missing CAPI rows as watch queue instead of legacy no-send", () => {
  const report = buildFunnelHealthReport({
    ledgerEntries: [
      entry({
        orderId: "current-order-should-not-leak",
        paymentKey: "current-payment-should-not-leak",
        loggedAt: "2026-05-17T01:00:00.000Z",
        approvedAt: "2026-05-17T01:00:00.000Z",
        landing: "https://biocom.kr/shop_payment_complete",
        utmSource: "meta",
        metadata: {
          site: "biocom",
          value: 2000,
          fbc: "current-fbc-should-not-leak",
        },
      }),
    ],
    capiLogs: [],
    site: "biocom",
    window: "7d",
    granularity: "day",
    paymentMethod: "all",
    source: "all",
    asOf: new Date("2026-05-17T02:00:00.000Z"),
  });

  const item = report.action_queue.find((row) => row.key === "confirmed_but_no_capi_send");
  assert.ok(item);
  assert.equal(item.priority, "critical");
  assert.equal(item.title, "결제완료가 있는데 Meta CAPI 전송 기록이 없음");
  assert.equal(item.details?.length, 1);

  const detail = item.details?.[0];
  assert.ok(detail);
  assert.equal(detail.missing_policy, "current_missing_watch");
  assert.match(detail.recommended_action, /current 누락/);

  const serialized = JSON.stringify(detail);
  assert.equal(serialized.includes("current-order-should-not-leak"), false);
  assert.equal(serialized.includes("current-payment-should-not-leak"), false);
  assert.equal(serialized.includes("current-fbc-should-not-leak"), false);
});
