import assert from "node:assert/strict";
import test from "node:test";

import { buildLedgerEntry } from "../src/attribution";
import {
  buildCampaignRoasRows,
  buildDailyRoasRows,
  buildNormalizedLedgerOrders,
} from "../src/routes/ads";

const requestContext = {
  ip: "127.0.0.1",
  userAgent: "node-test",
  origin: "https://biocom.kr",
  requestReferer: "https://biocom.kr/",
  method: "POST",
  path: "/api/attribution/payment-success",
};

test("ads: buildNormalizedLedgerOrders merges live attribution with replay amount", () => {
  const liveEntry = buildLedgerEntry(
    "payment_success",
    {
      orderId: "order-1",
      paymentKey: "pay-1",
      approvedAt: "2026-04-01T12:34:56+09:00",
      utmSource: "facebook",
      utmCampaign: "spring-sale",
      fbclid: "fbclid-1",
      metadata: {
        source: "biocom_imweb",
      },
    },
    requestContext,
    "2026-04-01T03:34:56.000Z",
  );

  const replayEntry = buildLedgerEntry(
    "payment_success",
    {
      orderId: "order-1",
      paymentKey: "pay-1",
      approvedAt: "2026-04-01 12:34:56",
      captureMode: "replay",
      metadata: {
        status: "DONE",
        store: "biocom",
        totalAmount: 245000,
      },
    },
    requestContext,
    "2026-04-01T03:35:10.000Z",
  );

  const orders = buildNormalizedLedgerOrders([liveEntry, replayEntry]);

  assert.equal(orders.length, 1);
  assert.equal(orders[0]?.orderId, "order-1");
  assert.equal(orders[0]?.paymentKey, "pay-1");
  assert.equal(orders[0]?.utmSource, "facebook");
  assert.equal(orders[0]?.utmCampaign, "spring-sale");
  assert.equal(orders[0]?.fbclid, "fbclid-1");
  assert.equal(orders[0]?.amount, 245000);
  assert.equal(orders[0]?.site, "biocom");
  assert.equal(orders[0]?.approvedDate, "2026-04-01");
  assert.equal(orders[0]?.paymentStatus, "confirmed");
  assert.equal(orders[0]?.status, "DONE");
  assert.equal(orders[0]?.completed, true);
  assert.equal(orders[0]?.entryCount, 2);
});

test("ads: buildNormalizedLedgerOrders excludes canceled orders from completed revenue pool", () => {
  const canceledEntry = buildLedgerEntry(
    "payment_success",
    {
      orderId: "order-cancel",
      paymentKey: "pay-cancel",
      approvedAt: "2026-04-02T09:00:00+09:00",
      utmSource: "facebook",
      fbclid: "fbclid-cancel",
      metadata: {
        status: "CANCELED",
        totalAmount: 53000,
      },
    },
    requestContext,
    "2026-04-02T00:00:00.000Z",
  );

  const orders = buildNormalizedLedgerOrders([canceledEntry]);

  assert.equal(orders.length, 1);
  assert.equal(orders[0]?.paymentStatus, "canceled");
  assert.equal(orders[0]?.completed, false);
  assert.equal(orders[0]?.amount, 53000);
});

test("ads: buildNormalizedLedgerOrders keeps waiting for deposit orders pending", () => {
  const pendingEntry = buildLedgerEntry(
    "payment_success",
    {
      orderId: "order-pending",
      paymentKey: "pay-pending",
      approvedAt: "2026-04-02T10:00:00+09:00",
      utmSource: "facebook",
      fbclid: "fbclid-pending",
      metadata: {
        status: "WAITING_FOR_DEPOSIT",
        totalAmount: 91000,
      },
    },
    requestContext,
    "2026-04-02T01:00:00.000Z",
  );

  const orders = buildNormalizedLedgerOrders([pendingEntry]);

  assert.equal(orders.length, 1);
  assert.equal(orders[0]?.paymentStatus, "pending");
  assert.equal(orders[0]?.completed, false);
  assert.equal(orders[0]?.amount, 91000);
});

test("ads: buildNormalizedLedgerOrders uses paidTouchBeforeCheckout numeric Meta IDs", () => {
  const entry = buildLedgerEntry(
    "payment_success",
    {
      orderId: "202605268937285",
      paymentKey: "iw_bi20260526212718SXL00",
      landing: "https://biocom.kr/shop_payment_complete?order_code=o20260526011e302f9a978&order_no=202605268937285",
      referrer: "https://biocom.kr/backpg/payment/oms/OMS_confirm.cm?amount=234000",
      metadata: {
        status: "DONE",
        paidTouchBeforeCheckout: {
          source: "meta",
          medium: "paid_social",
          campaign: "120245003319500396",
          term: "120245143376260396",
          content: "12025701139440396",
          metaCampaignId: "120245003319500396",
          metaAdsetId: "120245143376260396",
          metaAdId: "12025701139440396",
          grade: "A",
          confidence: 0.96,
          evidence: [
            "flat_touch_numeric_meta_fallback",
            "numeric_utm_campaign",
            "numeric_utm_term",
            "numeric_utm_content",
          ],
        },
      },
    },
    requestContext,
    "2026-05-26T12:27:31.859Z",
  );

  const orders = buildNormalizedLedgerOrders([entry]);

  assert.equal(orders.length, 1);
  assert.equal(orders[0]?.utmSource, "meta");
  assert.equal(orders[0]?.utmCampaign, "120245003319500396");
  assert.equal(orders[0]?.utmTerm, "120245143376260396");
  assert.equal(orders[0]?.utmContent, "12025701139440396");
  assert.equal(orders[0]?.campaignIdHint, "120245003319500396");
  assert.equal(orders[0]?.adsetIdHint, "120245143376260396");
  assert.equal(orders[0]?.adIdHint, "12025701139440396");

  const rows = buildCampaignRoasRows({
    metaRows: [{
      campaign_name: "meta_biocom_influencer_260506",
      campaign_id: "120245003319500396",
      impressions: "1000",
      clicks: "100",
      spend: "10000",
      date_start: "2026-05-26",
      date_stop: "2026-05-26",
    }],
    orders,
    ledgerAvailable: true,
  });
  const matched = rows.find((row) => row.campaignId === "120245003319500396");
  assert.equal(matched?.attributedRevenue, 234000);
  assert.equal(matched?.orders, 1);
  assert.equal(rows.some((row) => row.campaignName === "(unmapped)"), false);
});

test("ads: buildCampaignRoasRows maps campaign revenue and preserves unmapped bucket", () => {
  const orders = buildNormalizedLedgerOrders([
    buildLedgerEntry(
      "payment_success",
      {
        orderId: "order-1",
        paymentKey: "pay-1",
        approvedAt: "2026-04-01T12:34:56+09:00",
        utmSource: "facebook",
        utmCampaign: "spring-sale",
        fbclid: "fbclid-1",
        metadata: { totalAmount: 300000, status: "DONE" },
      },
      requestContext,
      "2026-04-01T03:34:56.000Z",
    ),
    buildLedgerEntry(
      "payment_success",
      {
        orderId: "order-2",
        paymentKey: "pay-2",
        approvedAt: "2026-04-01T13:00:00+09:00",
        utmSource: "facebook",
        utmCampaign: "unknown-campaign",
        fbclid: "fbclid-2",
        metadata: { totalAmount: 50000, status: "DONE" },
      },
      requestContext,
      "2026-04-01T04:00:00.000Z",
    ),
  ]);

  const rows = buildCampaignRoasRows({
    metaRows: [
      {
        campaign_name: "Spring Sale",
        campaign_id: "cmp-1",
        impressions: "10000",
        clicks: "200",
        spend: "100000",
        date_start: "2026-04-01",
        date_stop: "2026-04-01",
      },
    ],
    orders,
    ledgerAvailable: true,
  });

  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], {
    campaignId: "cmp-1",
    campaignName: "Spring Sale",
    spend: 100000,
    attributedRevenue: 300000,
    roas: 3,
    orders: 1,
    campaignType: "general",
  });
  assert.deepEqual(rows[1], {
    campaignId: null,
    campaignName: "(unmapped)",
    spend: 0,
    attributedRevenue: 50000,
    roas: null,
    orders: 1,
    campaignType: "general",
  });
});

test("ads: buildDailyRoasRows returns null roas when ledger is empty", () => {
  const rows = buildDailyRoasRows({
    range: { startDate: "2026-04-01", endDate: "2026-04-02" },
    metaRows: [
      {
        campaign_name: "",
        campaign_id: "",
        impressions: "0",
        clicks: "0",
        spend: "10000",
        date_start: "2026-04-01",
        date_stop: "2026-04-01",
      },
      {
        campaign_name: "",
        campaign_id: "",
        impressions: "0",
        clicks: "0",
        spend: "20000",
        date_start: "2026-04-02",
        date_stop: "2026-04-02",
      },
    ],
    orders: [],
    ledgerAvailable: false,
  });

  assert.deepEqual(rows, [
    {
      date: "2026-04-01",
      spend: 10000,
      revenue: 0,
      roas: null,
      confirmedRevenue: 0,
      pendingRevenue: 0,
      potentialRevenue: 0,
      metaPurchaseValue: 0,
      confirmedRoas: null,
      officialRoas: null,
      fastSignalRoas: null,
      roasGap: null,
      potentialRoas: null,
      metaPurchaseRoas: 0,
    },
    {
      date: "2026-04-02",
      spend: 20000,
      revenue: 0,
      roas: null,
      confirmedRevenue: 0,
      pendingRevenue: 0,
      potentialRevenue: 0,
      metaPurchaseValue: 0,
      confirmedRoas: null,
      officialRoas: null,
      fastSignalRoas: null,
      roasGap: null,
      potentialRoas: null,
      metaPurchaseRoas: 0,
    },
  ]);
});
