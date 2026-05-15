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
