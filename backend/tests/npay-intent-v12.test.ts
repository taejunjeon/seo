import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test, { after } from "node:test";

const TEST_DB_PATH = path.join(os.tmpdir(), `seo-npay-intent-v12-${process.pid}.sqlite3`);

process.env.CRM_LOCAL_DB_PATH = TEST_DB_PATH;
process.env.NPAY_BRIDGE_HMAC_SECRET = "test-npay-bridge-hmac-secret-20260530";

after(async () => {
  const crmLocal = await import("../src/crmLocalDb");
  crmLocal.resetCrmDbForTests();
  delete process.env.CRM_LOCAL_DB_PATH;
  delete process.env.NPAY_BRIDGE_HMAC_SECRET;
  rmSync(TEST_DB_PATH, { force: true });
  rmSync(`${TEST_DB_PATH}-shm`, { force: true });
  rmSync(`${TEST_DB_PATH}-wal`, { force: true });
});

test("npay intent v1.2 stores bridge/order evidence as hashes and scrubs raw payload", async () => {
  const { recordNpayIntent } = await import("../src/npayIntentLog");

  const result = recordNpayIntent(
    {
      site: "biocom",
      source: "gtm_npay_bridge_v1_2",
      environment: "preview",
      snippet_version: "2026-05-30-biocom-npay-bridge-gtm-v1-2-preview",
      captured_at: "2026-05-30T04:15:00.000Z",
      page_location:
        "https://biocom.kr/shop_view/?idx=198&utm_source=googleads_test&gclid=EAIaIQobChMIvalidRealClickIdEgTEST",
      page_referrer: "https://www.google.com/",
      client_id: "123456.1770000000",
      ga_cookie_raw: "GA1.1.123456.1770000000",
      ga_session_id: "1770000000",
      gclid: "EAIaIQobChMIvalidRealClickIdEgTEST",
      product_idx: "198",
      product_name: "뉴로마스터 60정",
      product_price: 35000,
      npayBridgeUrl: "https://orders.pay.naver.com/order/checkout/mall/abc-raw-bridge-token",
      npayBridgeObservedAt: "2026-05-30T04:15:05.000Z",
      npay_checkout_bridge_id: "raw-checkout-bridge-id-should-not-appear",
      imweb_order_code: "o20260530rawordercode",
      channel_order_no: "2026053099999999",
      local_session_id: "local-session-raw-value",
      cart_item_count: 1,
      cart_quantity_total: 1,
      cart_subtotal_krw: 35000,
      delivery_price_krw: 0,
      discount_amount_krw: 0,
      expected_payment_amount_krw: 35000,
      amount_source: "product_page",
      checkout_stage: "checkout_opened_possible",
      bridge_opened_at: "2026-05-30T04:15:03.000Z",
      checkout_opened_at: "2026-05-30T04:15:06.000Z",
      login_gate_observed_at: "",
      order_init_observed_at: "2026-05-30T04:15:02.000Z",
      member_code: "m2026rawmember",
      cart_snapshot: [{ name: "뉴로마스터 60정", price: 35000 }],
      debug_mode: true,
    },
    {
      ip: "203.0.113.7",
      userAgent: "node-test",
      origin: "https://biocom.kr",
      requestReferer: "https://biocom.kr/shop_view/?idx=198",
      method: "POST",
      path: "/api/attribution/npay-intent",
    },
  );

  assert.equal(result.deduped, false);
  assert.equal(result.intent.source, "gtm_npay_bridge_v1_2");
  assert.equal(result.intent.checkoutStage, "checkout_opened_possible");
  assert.equal(result.intent.expectedPaymentAmountKrw, 35000);
  assert.equal(result.intent.cartItemCount, 1);
  assert.match(result.intent.npayBridgeUrlHash, /^[0-9a-f]{64}$/);
  assert.match(result.intent.npayCheckoutBridgeIdHash, /^[0-9a-f]{64}$/);
  assert.match(result.intent.imwebOrderCodeHash, /^[0-9a-f]{64}$/);
  assert.match(result.intent.channelOrderNoHash, /^[0-9a-f]{64}$/);
  assert.match(result.intent.localSessionIdHash, /^[0-9a-f]{64}$/);
  assert.match(result.intent.cartFingerprintHash, /^[0-9a-f]{64}$/);
  assert.notEqual(result.intent.npayCheckoutBridgeIdHash, "raw-checkout-bridge-id-should-not-appear");

  const rawPayloadText = JSON.stringify(result.intent.rawPayload);
  assert.ok(!rawPayloadText.includes("raw-checkout-bridge-id-should-not-appear"));
  assert.ok(!rawPayloadText.includes("o20260530rawordercode"));
  assert.ok(!rawPayloadText.includes("2026053099999999"));
  assert.ok(!rawPayloadText.includes("local-session-raw-value"));
  assert.ok(!rawPayloadText.includes("m2026rawmember"));
  assert.ok(!rawPayloadText.includes("abc-raw-bridge-token"));
  assert.ok(!rawPayloadText.includes("EAIaIQobChMIvalidRealClickIdEgTEST"));

  const normalized = result.intent.rawPayload.normalized as Record<string, unknown>;
  assert.equal(normalized.has_google_click_id, true);
  assert.equal(normalized.npay_checkout_bridge_id_hash_present, true);
  assert.equal(normalized.imweb_order_code_hash_present, true);
  assert.equal(normalized.privacy_hash_version, "hmac_sha256_npay_bridge_v1");
});
