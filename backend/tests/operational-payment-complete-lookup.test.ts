import assert from "node:assert/strict";
import test from "node:test";
import { createHmac } from "node:crypto";

import {
  lookupOperationalPaymentComplete,
  type OperationalPaymentCompleteLookupRow,
} from "../src/operationalPaymentCompleteLookup";

const TEST_SECRET = "test-secret-for-fixture-only-not-prod";
const hmacHex = (v: string) => createHmac("sha256", TEST_SECRET).update(v, "utf8").digest("hex");

const fakeRows = [
  {
    order_number: "FIX-ORD-1",
    channel_order_no: "",
    payment_status: "PAYMENT_COMPLETE",
    payment_method: "CARD",
    final_order_amount: 150000,
  },
  {
    order_number: "FIX-ORD-2",
    channel_order_no: "FIX-CHANNEL-2",
    payment_status: "PAYMENT_COMPLETE",
    payment_method: "NAVERPAY_ORDER",
    final_order_amount: 75000,
  },
  {
    order_number: "FIX-ORD-3",
    channel_order_no: "",
    payment_status: "REFUND_COMPLETE",
    payment_method: "CARD",
    final_order_amount: 50000,
  },
];

const mockQueryPg = async (_text: string, _values: ReadonlyArray<unknown>) => ({
  rows: fakeRows.map((r, i) => ({
    ...r,
    payment_complete_time: "2026-05-10",
    order_date: "2026-05-10",
    now_utc: "2026-05-11T01:00:00.000Z",
    max_order_utc: "2026-05-11T00:00:00.000Z",
  })),
});

const deps = {
  isDatabaseConfigured: () => true,
  queryPg: mockQueryPg as unknown as <T>(
    text: string,
    values?: ReadonlyArray<unknown>,
  ) => Promise<{ rows: T[] }>,
};

test("operationalPaymentCompleteLookup: ledger order_hash matches order_number HMAC → payment_complete_match true", async () => {
  const ledgerHash = hmacHex("FIX-ORD-1");
  const result = await lookupOperationalPaymentComplete({
    site: "biocom",
    ledgerOrderHashes: [ledgerHash],
    hmacSecret: TEST_SECRET,
  }, deps);
  assert.equal(result.ok, true);
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].payment_complete_match, true);
  assert.equal(result.rows[0].match_key_type, "order_number_hash");
  assert.equal(result.rows[0].payment_method_family, "card");
  assert.equal(result.rows[0].amount_krw_bucket, "100000_to_300000");
});

test("operationalPaymentCompleteLookup: ledger order_hash matches channel_order_no HMAC → payment_complete_match true npay", async () => {
  const ledgerHash = hmacHex("FIX-CHANNEL-2");
  const result = await lookupOperationalPaymentComplete({
    site: "biocom",
    ledgerOrderHashes: [ledgerHash],
    hmacSecret: TEST_SECRET,
  }, deps);
  assert.equal(result.rows[0].payment_complete_match, true);
  assert.equal(result.rows[0].match_key_type, "channel_order_no_hash");
  assert.equal(result.rows[0].payment_method_family, "npay");
  assert.equal(result.rows[0].amount_krw_bucket, "50000_to_100000");
});

test("operationalPaymentCompleteLookup: ledger order_hash no match → pending_sync_lag", async () => {
  const ledgerHash = hmacHex("NOT-IN-DB-ORDER");
  const result = await lookupOperationalPaymentComplete({
    site: "biocom",
    ledgerOrderHashes: [ledgerHash],
    hmacSecret: TEST_SECRET,
  }, deps);
  assert.equal(result.rows[0].payment_complete_match, false);
  assert.equal(result.rows[0].match_key_type, "none");
  assert.equal(result.pending_sync_lag, 1);
});

test("operationalPaymentCompleteLookup: payment_status not COMPLETE → unpaid_hold count", async () => {
  const ledgerHash = hmacHex("FIX-ORD-3");
  const result = await lookupOperationalPaymentComplete({
    site: "biocom",
    ledgerOrderHashes: [ledgerHash],
    hmacSecret: TEST_SECRET,
  }, deps);
  assert.equal(result.rows[0].payment_complete_match, false);
  assert.equal(result.rows[0].payment_status, "REFUND_COMPLETE");
  assert.equal(result.unpaid_hold, 1);
});

test("operationalPaymentCompleteLookup: raw order_no never appears in output", async () => {
  const ledgerHash = hmacHex("FIX-ORD-1");
  const result = await lookupOperationalPaymentComplete({
    site: "biocom",
    ledgerOrderHashes: [ledgerHash],
    hmacSecret: TEST_SECRET,
  }, deps);
  const serialized = JSON.stringify(result);
  assert.ok(!serialized.includes("FIX-ORD-1"), "raw order_number must not appear");
  assert.ok(!serialized.includes("FIX-ORD-2"), "raw other order_number must not appear");
  assert.ok(!serialized.includes("FIX-CHANNEL-2"), "raw channel_order_no must not appear");
});
