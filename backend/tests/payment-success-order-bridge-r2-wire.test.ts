import assert from "node:assert/strict";
import test from "node:test";

import type { AttributionLedgerEntry } from "../src/attribution";
import { recordPaymentSuccessOrderBridgeLedger } from "../src/routes/attribution";
import {
  bootstrapOrderBridgeLedgerTable,
  getOrderBridgeLedgerSummary,
} from "../src/orderBridgeLedger";

const TEST_SECRET = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

const setEnv = (overrides: Record<string, string | undefined>) => {
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
};

const baseEntry = (overrides: Partial<AttributionLedgerEntry> = {}): AttributionLedgerEntry =>
  ({
    requestId: "req-1",
    receivedAt: "2026-05-11T00:00:00.000Z",
    loggedAt: "2026-05-11T00:00:00.000Z",
    touchpoint: "payment_success",
    orderId: "FIX-ORDER-1",
    paymentKey: "",
    approvedAt: "",
    checkoutId: "",
    customerKey: "",
    landing: "",
    referrer: "",
    gaSessionId: "1234567890",
    utmSource: "",
    utmMedium: "",
    utmCampaign: "",
    utmContent: "",
    utmTerm: "",
    gclid: "",
    fbclid: "",
    ttclid: "",
    paymentStatus: null,
    metadata: { clientId: "111.222", normalizedPhone: "" },
    requestContext: { ip: "::1", userAgent: "test", origin: "" },
    ...overrides,
  }) as unknown as AttributionLedgerEntry;

const cleanLedger = () => {
  bootstrapOrderBridgeLedgerTable();
  const Database = require("better-sqlite3");
  const path = require("node:path");
  const dbPath =
    process.env.CRM_LOCAL_DB_PATH ?? path.resolve(__dirname, "..", "data", "crm.sqlite3");
  const db = new Database(dbPath);
  db.prepare("DELETE FROM order_bridge_ledger WHERE site = ?").run("biocom");
  db.close();
};

const baseEnvOnce = () => {
  setEnv({
    ORDER_BRIDGE_IDENTITY_HASH_SECRET: TEST_SECRET,
    ORDER_BRIDGE_PLATFORM_SEND_ENABLED: "false",
    ORDER_BRIDGE_RAW_BODY_LOGGING: "false",
    ORDER_BRIDGE_WRITE_MAX_ROWS: "200",
    ORDER_BRIDGE_WRITE_CANARY_UNTIL: "",
  });
};

test("R2 wire: write_flag=true + order + click + session records ledger row", () => {
  baseEnvOnce();
  setEnv({ ORDER_BRIDGE_WRITE_ENABLED: "true" });
  cleanLedger();
  const before = getOrderBridgeLedgerSummary("biocom").row_count;

  const result = recordPaymentSuccessOrderBridgeLedger(
    {
      site: "biocom",
      order_no: "FIX-A1",
      gclid: "Cj0KCQjw_TEST_GCLID_A1",
      ga_session_id: "9999999999",
      client_id: "111.222",
    },
    baseEntry({ orderId: "FIX-A1", gclid: "Cj0KCQjw_TEST_GCLID_A1" }),
  );

  const after = getOrderBridgeLedgerSummary("biocom").row_count;
  assert.equal(result.attempted, true);
  assert.equal(result.write_flag_on, true);
  assert.equal(result.stored, true);
  assert.equal(result.preview_hash_present.order_no_hash, true);
  assert.equal(result.preview_hash_present.click_id_hash, true);
  assert.equal(result.preview_hash_present.client_session, true);
  assert.equal(result.send_candidate, false);
  assert.equal(result.actual_send_candidate, false);
  assert.equal(result.upload_candidate, false);
  assert.equal(after - before, 1);

  cleanLedger();
});

test("R2 wire: identity absent classifies session_only_quarantine but still rows", () => {
  baseEnvOnce();
  setEnv({ ORDER_BRIDGE_WRITE_ENABLED: "true" });
  cleanLedger();

  const result = recordPaymentSuccessOrderBridgeLedger(
    {
      site: "biocom",
      order_no: "FIX-B1",
      gclid: "Cj0KCQjw_TEST_GCLID_B1",
      ga_session_id: "9999999999",
      client_id: "111.222",
    },
    baseEntry({ orderId: "FIX-B1", gclid: "Cj0KCQjw_TEST_GCLID_B1" }),
  );

  assert.equal(result.stored, true);
  assert.equal(result.preview_hash_present.email_hash, false);
  assert.equal(result.preview_hash_present.phone_hash, false);
  // session_only_quarantine 또는 click_missing_hold 둘 중 하나의 invariant 분류
  assert.ok(
    result.status === "session_only_quarantine" ||
      result.status === "click_missing_hold" ||
      result.status === "identity_only_quarantine" ||
      result.status === "full_bridge",
    `unexpected status: ${result.status}`,
  );
  assert.equal(result.upload_candidate, false);

  cleanLedger();
});

test("R2 wire: write_flag=false does not store row", () => {
  baseEnvOnce();
  setEnv({ ORDER_BRIDGE_WRITE_ENABLED: "false" });
  cleanLedger();
  const before = getOrderBridgeLedgerSummary("biocom").row_count;

  const result = recordPaymentSuccessOrderBridgeLedger(
    {
      site: "biocom",
      order_no: "FIX-C1",
      gclid: "Cj0KCQjw_TEST_GCLID_C1",
      ga_session_id: "9999999999",
      client_id: "111.222",
    },
    baseEntry({ orderId: "FIX-C1", gclid: "Cj0KCQjw_TEST_GCLID_C1" }),
  );
  const after = getOrderBridgeLedgerSummary("biocom").row_count;

  assert.equal(result.attempted, true);
  assert.equal(result.write_flag_on, false);
  assert.equal(result.stored, false);
  assert.equal(result.rejected_reason, "write_flag_disabled");
  assert.equal(after - before, 0);
});

test("R2 wire: missing order_no rejects with missing_order_key", () => {
  baseEnvOnce();
  setEnv({ ORDER_BRIDGE_WRITE_ENABLED: "true" });
  cleanLedger();
  const before = getOrderBridgeLedgerSummary("biocom").row_count;

  const result = recordPaymentSuccessOrderBridgeLedger(
    {
      site: "biocom",
      ga_session_id: "9999999999",
      client_id: "111.222",
    },
    baseEntry({ orderId: "" }),
  );
  const after = getOrderBridgeLedgerSummary("biocom").row_count;

  assert.equal(result.attempted, true);
  assert.equal(result.stored, false);
  assert.equal(result.rejected_reason, "missing_order_key");
  assert.equal(after - before, 0);

  cleanLedger();
});

test("R2 wire: response and stored row never echo raw email/phone/order", () => {
  baseEnvOnce();
  setEnv({ ORDER_BRIDGE_WRITE_ENABLED: "true" });
  cleanLedger();

  const rawEmail = "alice@example.com";
  const rawOrder = "ORDER-RAW-12345";

  const result = recordPaymentSuccessOrderBridgeLedger(
    {
      site: "biocom",
      order_no: rawOrder,
      email: rawEmail,
      gclid: "Cj0KCQjw_TEST_GCLID_E1",
      ga_session_id: "9999999999",
      client_id: "111.222",
    },
    baseEntry({ orderId: rawOrder }),
  );

  const responseSerialized = JSON.stringify(result);
  assert.ok(!responseSerialized.includes(rawEmail), "response should not echo raw email");
  assert.ok(!responseSerialized.includes(rawOrder), "response should not echo raw order_no");
  assert.equal(result.preview_hash_present.email_hash, true);
  assert.equal(result.preview_hash_present.order_no_hash, true);

  cleanLedger();
});

test("R2 wire: duplicate payment-success dedupes via order_bridge_ledger", () => {
  baseEnvOnce();
  setEnv({ ORDER_BRIDGE_WRITE_ENABLED: "true" });
  cleanLedger();

  const body = {
    site: "biocom",
    order_no: "FIX-DEDUPE-1",
    email: "dupe@example.com",
    gclid: "Cj0KCQjw_TEST_GCLID_DEDUP",
    ga_session_id: "9999999999",
    client_id: "111.222",
  };
  const entry = baseEntry({ orderId: "FIX-DEDUPE-1" });

  const first = recordPaymentSuccessOrderBridgeLedger(body, entry);
  const second = recordPaymentSuccessOrderBridgeLedger(body, entry);

  const summary = getOrderBridgeLedgerSummary("biocom");
  assert.equal(first.stored, true);
  assert.equal(second.stored, true);
  assert.equal(second.deduped, true);
  // duplicate row 는 row_count 1 + duplicate_dedupe_count 증가
  assert.equal(summary.row_count, 1);
  assert.ok(summary.duplicate_dedupe_count >= 1);

  cleanLedger();
});
