import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import test from "node:test";

import { enrichConfirmedPurchaseWithLedgerLookup } from "../src/confirmedPurchaseLedgerLookupEnricher";
import type { OrderBridgeLedgerRow } from "../src/orderBridgeLedger";

const SECRET = "fixture-secret-not-prod-with-enough-length-to-pass-validation-checks";
const hmacHex = (v: string) => createHmac("sha256", SECRET).update(v, "utf8").digest("hex");
const sha256Hex = (v: string) => createHash("sha256").update(v, "utf8").digest("hex");

const ledgerRow = (overrides: Partial<OrderBridgeLedgerRow> = {}): OrderBridgeLedgerRow => ({
  bridgeId: "fixture-bridge-id",
  site: "biocom",
  captureStage: "order_confirm_preview",
  receivedAt: "2026-05-10T17:19:13.824Z",
  orderNoHash: hmacHex("FIX-ORDER-1"),
  clientId: "111.222",
  gaSessionId: "999",
  localSessionIdHash: "",
  clickIdHash: "",
  emailHash: "",
  phoneHash: "",
  identitySource: "none" as const,
  payType: "",
  pgType: "",
  identityHashVersion: "hmac_sha256_identity_v1",
  rawPayloadSampleHash: "",
  rawPayloadStored: 0,
  platformSendCount: 0,
  duplicateCount: 0,
  status: "session_only_quarantine" as const,
  dedupeKey: "fixture-dedupe-key",
  createdAt: "2026-05-10T17:19:13.824Z",
  updatedAt: "2026-05-10T17:19:13.824Z",
  expiresAt: "2026-08-10T17:19:13.824Z",
  ...overrides,
});

const stubPaymentDeps = (paymentStatus: string | null, paymentMethodFamily = "card", lag: "fresh" | "lagged" | "stale" | "unknown" = "fresh") => ({
  isDatabaseConfigured: () => true,
  queryPg: async () => ({
    rows: paymentStatus
      ? [{
          order_number: "FIX-ORDER-1",
          channel_order_no: "",
          payment_status: paymentStatus,
          payment_method: paymentMethodFamily === "card" ? "CARD" : paymentMethodFamily.toUpperCase(),
          payment_complete_time: "2026-05-10",
          order_date: "2026-05-10",
          final_order_amount: 150000,
          now_utc: "2026-05-11T00:00:00.000Z",
          max_order_utc: lag === "fresh" ? "2026-05-10T23:30:00.000Z" : lag === "lagged" ? "2026-05-10T22:00:00.000Z" : "2026-05-10T12:00:00.000Z",
        }]
      : [{
          order_number: "OTHER-ORDER",
          channel_order_no: "",
          payment_status: "PAYMENT_COMPLETE",
          payment_method: "CARD",
          payment_complete_time: "2026-05-10",
          order_date: "2026-05-10",
          final_order_amount: 100000,
          now_utc: "2026-05-11T00:00:00.000Z",
          max_order_utc: "2026-05-10T23:30:00.000Z",
        }],
  }),
});

test("enricher: ledger paid + click_view exact → A_via_ledger_budget_floor", async () => {
  const rawGclid = "FIX-GCLID-AAA";
  const result = await enrichConfirmedPurchaseWithLedgerLookup(
    {
      orderNo: "FIX-ORDER-1",
      site: "biocom",
    },
    {
      hmacSecret: SECRET,
      operationalPaymentCompleteLookupDeps: stubPaymentDeps("PAYMENT_COMPLETE"),
      clickViewCandidates: [{
        rawClickId: rawGclid,
        clickIdType: "gclid",
        campaignId: "22018174474",
        campaignName: "[PM]건기식 실적최대화",
        clickTimeIso: "2026-05-10T00:00:00.000Z",
      }],
      ledgerRowOverride: [ledgerRow({ clickIdHash: sha256Hex(rawGclid), status: "full_bridge" })],
    },
  );
  assert.equal(result.ledger_row_present, true);
  assert.equal(result.payment_complete_match, true);
  assert.equal(result.click_view_exact_match, true);
  assert.equal(result.campaign_id, "22018174474");
  assert.equal(result.budget_classification, "A_via_ledger_budget_floor");
  assert.equal(result.budget_usable, true);
  assert.equal(result.cross_reference_evidence.category, "A_via_ledger_budget_floor");
  assert.equal(result.cross_reference_evidence.budget_usable, true);
});

test("enricher: ledger paid + no click in ledger → paid_order_no_click_hold", async () => {
  const result = await enrichConfirmedPurchaseWithLedgerLookup(
    { orderNo: "FIX-ORDER-1", site: "biocom" },
    {
      hmacSecret: SECRET,
      operationalPaymentCompleteLookupDeps: stubPaymentDeps("PAYMENT_COMPLETE"),
      clickViewCandidates: [],
      ledgerRowOverride: [ledgerRow({ clickIdHash: "", status: "session_only_quarantine" })],
    },
  );
  assert.equal(result.payment_complete_match, true);
  assert.equal(result.click_view_exact_match, false);
  assert.equal(result.budget_classification, "paid_order_no_click_hold");
  assert.equal(result.budget_usable, false);
  assert.equal(result.cross_reference_evidence.category, "paid_order_no_click_hold");
});

test("enricher: ledger row absent (no R2 row yet) → cross_reference falls back to default branches", async () => {
  const result = await enrichConfirmedPurchaseWithLedgerLookup(
    { orderNo: "FIX-NEW-ORDER", site: "biocom", paymentMethod: "homepage" },
    {
      hmacSecret: SECRET,
      operationalPaymentCompleteLookupDeps: stubPaymentDeps(null),
      clickViewCandidates: [],
      ledgerRowOverride: [],
    },
  );
  assert.equal(result.ledger_row_present, false);
  assert.equal(result.ledger_row_count, 0);
  // ledger_row_present=false 면 cross_reference 는 기존 분기 사용 — homepage no_click no_utm → F_homepage_no_click_no_utm
  assert.equal(result.cross_reference_evidence.category, "F_homepage_no_click_no_utm");
  assert.equal(result.budget_usable, false);
});

test("enricher: ledger paid REFUND → unpaid_order_bridge_hold", async () => {
  const result = await enrichConfirmedPurchaseWithLedgerLookup(
    { orderNo: "FIX-ORDER-1", site: "biocom" },
    {
      hmacSecret: SECRET,
      operationalPaymentCompleteLookupDeps: stubPaymentDeps("REFUND_COMPLETE"),
      clickViewCandidates: [],
      ledgerRowOverride: [ledgerRow({ status: "session_only_quarantine" })],
    },
  );
  assert.equal(result.payment_complete_match, false);
  assert.equal(result.budget_classification, "unpaid_order_bridge_hold");
  assert.equal(result.cross_reference_evidence.category, "unpaid_order_bridge_hold");
});

test("enricher: raw inputs never appear in output", async () => {
  const rawOrder = "RAW-ORDER-LEAK-CHECK";
  const rawGclid = "RAW-GCLID-LEAK-CHECK";
  const result = await enrichConfirmedPurchaseWithLedgerLookup(
    {
      orderNo: rawOrder,
      site: "biocom",
      clickIdentifiers: { gclid: rawGclid },
    },
    {
      hmacSecret: SECRET,
      operationalPaymentCompleteLookupDeps: stubPaymentDeps("PAYMENT_COMPLETE"),
      clickViewCandidates: [{
        rawClickId: rawGclid,
        clickIdType: "gclid",
        campaignId: "22018174474",
        campaignName: "X",
        clickTimeIso: "",
      }],
      ledgerRowOverride: [ledgerRow({ orderNoHash: hmacHex(rawOrder), clickIdHash: sha256Hex(rawGclid) })],
    },
  );
  const serialized = JSON.stringify(result);
  assert.ok(!serialized.includes(rawOrder), "raw order_no must not appear");
  assert.ok(!serialized.includes(rawGclid), "raw gclid must not appear");
  // 다만 click_identifiers.gclid 는 cross_reference_evidence 가 source 로 사용 — preview 본체에 raw 가 들어왔다는 뜻이므로 invariant 는 helper output 자체에 한정
  assert.equal(result.invariants_held.send_candidate, false);
  assert.equal(result.invariants_held.upload_candidate, 0);
});
