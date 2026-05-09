import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import express from "express";
import test from "node:test";

import { resetCrmDbForTests } from "../src/crmLocalDb";
import {
  getOrderBridgeLedgerSummary,
  resetOrderBridgeLedgerTableForTests,
} from "../src/orderBridgeLedger";
import {
  buildOrderBridgeIdentityHmacLogRecord,
  buildOrderBridgeIdentityHmacPreview,
  hmacSha256Hex,
  normalizeOrderBridgeEmail,
  normalizeOrderBridgePhone,
} from "../src/orderBridgeIdentityHmac";
import { createAttributionRouter } from "../src/routes/attribution";

const SECRET = "fixture-order-bridge-secret-20260508";
const RAW_EMAIL = "Buyer.PathB+Smoke@Example.Invalid";
const RAW_PHONE = "+82 10 1234 5678";
const RAW_ORDER = "ORDER-PATHB-RAW-20260508";
const RAW_LOCAL_SESSION = "local-session-raw-pathb";
const RAW_CLICK_ID = "TEST_GCLID_PATHB_PREVIEW_20260508";

const fixturePayload = {
  site: "biocom",
  capture_stage: "order_confirm_preview",
  email: RAW_EMAIL,
  phone: RAW_PHONE,
  order_no: RAW_ORDER,
  client_id: "349382661.1770783461",
  ga_session_id: "1778235134",
  local_session_id: RAW_LOCAL_SESSION,
  click_id: RAW_CLICK_ID,
  preview_mode: true,
};

const resetOrderBridgeTestDb = (dbPath: string) => {
  resetCrmDbForTests();
  resetOrderBridgeLedgerTableForTests();
  fs.rmSync(dbPath, { force: true });
  fs.rmSync(`${dbPath}-shm`, { force: true });
  fs.rmSync(`${dbPath}-wal`, { force: true });
};

const assertNoRawEcho = (value: unknown) => {
  const serialized = JSON.stringify(value);
  for (const raw of [RAW_EMAIL, RAW_EMAIL.toLowerCase(), RAW_PHONE, RAW_ORDER, RAW_LOCAL_SESSION, RAW_CLICK_ID]) {
    assert.equal(serialized.includes(raw), false, `raw value leaked: ${raw}`);
  }
};

test("order bridge identity: normalizes email and phone before HMAC", () => {
  assert.equal(normalizeOrderBridgeEmail(`  ${RAW_EMAIL}  `), RAW_EMAIL.toLowerCase());
  assert.equal(normalizeOrderBridgePhone(RAW_PHONE), "821012345678");
});

test("order bridge identity: write flag stores hash-only canary row and dedupes", async (t) => {
  const previous = {
    secret: process.env.ORDER_BRIDGE_IDENTITY_HASH_SECRET,
    writeEnabled: process.env.ORDER_BRIDGE_WRITE_ENABLED,
    canaryUntil: process.env.ORDER_BRIDGE_WRITE_CANARY_UNTIL,
    maxRows: process.env.ORDER_BRIDGE_WRITE_MAX_ROWS,
    rawLogging: process.env.ORDER_BRIDGE_RAW_BODY_LOGGING,
    platformSend: process.env.ORDER_BRIDGE_PLATFORM_SEND_ENABLED,
    dbPath: process.env.CRM_LOCAL_DB_PATH,
  };
  const testDbPath = path.join(os.tmpdir(), `order-bridge-ledger-${process.pid}-${Date.now()}.sqlite3`);
  resetOrderBridgeTestDb(testDbPath);
  process.env.CRM_LOCAL_DB_PATH = testDbPath;
  process.env.ORDER_BRIDGE_IDENTITY_HASH_SECRET = SECRET;
  process.env.ORDER_BRIDGE_WRITE_ENABLED = "true";
  process.env.ORDER_BRIDGE_WRITE_CANARY_UNTIL = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  process.env.ORDER_BRIDGE_WRITE_MAX_ROWS = "200";
  process.env.ORDER_BRIDGE_RAW_BODY_LOGGING = "false";
  process.env.ORDER_BRIDGE_PLATFORM_SEND_ENABLED = "false";

  const app = express();
  app.use(express.json());
  app.use(createAttributionRouter());
  const server = app.listen(0);
  t.after(() => {
    server.close();
    if (previous.secret === undefined) delete process.env.ORDER_BRIDGE_IDENTITY_HASH_SECRET;
    else process.env.ORDER_BRIDGE_IDENTITY_HASH_SECRET = previous.secret;
    if (previous.writeEnabled === undefined) delete process.env.ORDER_BRIDGE_WRITE_ENABLED;
    else process.env.ORDER_BRIDGE_WRITE_ENABLED = previous.writeEnabled;
    if (previous.canaryUntil === undefined) delete process.env.ORDER_BRIDGE_WRITE_CANARY_UNTIL;
    else process.env.ORDER_BRIDGE_WRITE_CANARY_UNTIL = previous.canaryUntil;
    if (previous.maxRows === undefined) delete process.env.ORDER_BRIDGE_WRITE_MAX_ROWS;
    else process.env.ORDER_BRIDGE_WRITE_MAX_ROWS = previous.maxRows;
    if (previous.rawLogging === undefined) delete process.env.ORDER_BRIDGE_RAW_BODY_LOGGING;
    else process.env.ORDER_BRIDGE_RAW_BODY_LOGGING = previous.rawLogging;
    if (previous.platformSend === undefined) delete process.env.ORDER_BRIDGE_PLATFORM_SEND_ENABLED;
    else process.env.ORDER_BRIDGE_PLATFORM_SEND_ENABLED = previous.platformSend;
    if (previous.dbPath === undefined) delete process.env.CRM_LOCAL_DB_PATH;
    else process.env.CRM_LOCAL_DB_PATH = previous.dbPath;
    resetOrderBridgeTestDb(testDbPath);
  });

  const address = server.address();
  assert.equal(typeof address, "object");
  assert.ok(address && "port" in address);
  const url = `http://127.0.0.1:${address.port}/api/attribution/order-bridge/identity-hmac/no-send`;

  const firstResponse = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fixturePayload),
  });
  const firstBody = await firstResponse.json() as Record<string, unknown>;
  const firstPreview = firstBody.preview as Record<string, unknown>;
  const firstLedger = firstBody.ledger as Record<string, unknown>;

  assert.equal(firstResponse.status, 200);
  assert.equal(firstBody.ok, true);
  assert.equal(firstPreview.would_store, true);
  assert.equal(firstPreview.would_send, false);
  assert.equal(firstPreview.row_status, "full_bridge");
  assert.equal(firstLedger.stored, true);
  assert.equal(firstLedger.deduped, false);
  assert.equal(firstLedger.status, "full_bridge");
  assertNoRawEcho(firstBody);

  const secondResponse = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fixturePayload),
  });
  const secondBody = await secondResponse.json() as Record<string, unknown>;
  const secondLedger = secondBody.ledger as Record<string, unknown>;

  assert.equal(secondResponse.status, 200);
  assert.equal(secondLedger.stored, true);
  assert.equal(secondLedger.deduped, true);
  assertNoRawEcho(secondBody);

  const summary = getOrderBridgeLedgerSummary("biocom");
  assert.equal(summary.row_count, 1);
  assert.equal(summary.unique_order_no_hash, 1);
  assert.equal(summary.unique_email_hash, 1);
  assert.equal(summary.unique_phone_hash, 1);
  assert.equal(summary.unique_click_id_hash, 1);
  assert.equal(summary.raw_stored_count, 0);
  assert.equal(summary.platform_send_count, 0);
  assert.equal(summary.duplicate_dedupe_count, 1);
  assert.deepEqual(summary.status_counts, {
    full_bridge: 1,
    identity_only_quarantine: 0,
    session_only_quarantine: 0,
    click_missing_hold: 0,
    ambiguous: 0,
    do_not_send: 0,
  });
});

test("order bridge identity: missing click id stores identity_only_quarantine", async (t) => {
  const previous = {
    secret: process.env.ORDER_BRIDGE_IDENTITY_HASH_SECRET,
    writeEnabled: process.env.ORDER_BRIDGE_WRITE_ENABLED,
    canaryUntil: process.env.ORDER_BRIDGE_WRITE_CANARY_UNTIL,
    maxRows: process.env.ORDER_BRIDGE_WRITE_MAX_ROWS,
    rawLogging: process.env.ORDER_BRIDGE_RAW_BODY_LOGGING,
    platformSend: process.env.ORDER_BRIDGE_PLATFORM_SEND_ENABLED,
    dbPath: process.env.CRM_LOCAL_DB_PATH,
  };
  const testDbPath = path.join(os.tmpdir(), `order-bridge-ledger-no-click-${process.pid}-${Date.now()}.sqlite3`);
  resetOrderBridgeTestDb(testDbPath);
  process.env.CRM_LOCAL_DB_PATH = testDbPath;
  process.env.ORDER_BRIDGE_IDENTITY_HASH_SECRET = SECRET;
  process.env.ORDER_BRIDGE_WRITE_ENABLED = "true";
  process.env.ORDER_BRIDGE_WRITE_CANARY_UNTIL = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  process.env.ORDER_BRIDGE_WRITE_MAX_ROWS = "200";
  process.env.ORDER_BRIDGE_RAW_BODY_LOGGING = "false";
  process.env.ORDER_BRIDGE_PLATFORM_SEND_ENABLED = "false";

  const app = express();
  app.use(express.json());
  app.use(createAttributionRouter());
  const server = app.listen(0);
  t.after(() => {
    server.close();
    if (previous.secret === undefined) delete process.env.ORDER_BRIDGE_IDENTITY_HASH_SECRET;
    else process.env.ORDER_BRIDGE_IDENTITY_HASH_SECRET = previous.secret;
    if (previous.writeEnabled === undefined) delete process.env.ORDER_BRIDGE_WRITE_ENABLED;
    else process.env.ORDER_BRIDGE_WRITE_ENABLED = previous.writeEnabled;
    if (previous.canaryUntil === undefined) delete process.env.ORDER_BRIDGE_WRITE_CANARY_UNTIL;
    else process.env.ORDER_BRIDGE_WRITE_CANARY_UNTIL = previous.canaryUntil;
    if (previous.maxRows === undefined) delete process.env.ORDER_BRIDGE_WRITE_MAX_ROWS;
    else process.env.ORDER_BRIDGE_WRITE_MAX_ROWS = previous.maxRows;
    if (previous.rawLogging === undefined) delete process.env.ORDER_BRIDGE_RAW_BODY_LOGGING;
    else process.env.ORDER_BRIDGE_RAW_BODY_LOGGING = previous.rawLogging;
    if (previous.platformSend === undefined) delete process.env.ORDER_BRIDGE_PLATFORM_SEND_ENABLED;
    else process.env.ORDER_BRIDGE_PLATFORM_SEND_ENABLED = previous.platformSend;
    if (previous.dbPath === undefined) delete process.env.CRM_LOCAL_DB_PATH;
    else process.env.CRM_LOCAL_DB_PATH = previous.dbPath;
    resetOrderBridgeTestDb(testDbPath);
  });

  const address = server.address();
  assert.equal(typeof address, "object");
  assert.ok(address && "port" in address);
  const url = `http://127.0.0.1:${address.port}/api/attribution/order-bridge/identity-hmac/no-send`;
  const payloadWithoutClick = { ...fixturePayload, click_id: "" };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payloadWithoutClick),
  });
  const body = await response.json() as Record<string, unknown>;
  const preview = body.preview as Record<string, unknown>;
  const ledger = body.ledger as Record<string, unknown>;

  assert.equal(response.status, 200);
  assert.equal(preview.order_no_hash_present, true);
  assert.equal(preview.email_hash_present, true);
  assert.equal(preview.client_session_present, true);
  assert.equal(preview.click_id_hash_present, false);
  assert.equal(preview.row_status, "identity_only_quarantine");
  assert.equal(ledger.stored, true);
  assert.equal(ledger.status, "identity_only_quarantine");
  assertNoRawEcho(body);

  const summary = getOrderBridgeLedgerSummary("biocom");
  assert.equal(summary.row_count, 1);
  assert.equal(summary.unique_click_id_hash, 0);
  assert.equal(summary.status_counts.identity_only_quarantine, 1);
  assert.equal(summary.raw_stored_count, 0);
  assert.equal(summary.platform_send_count, 0);
});

test("order bridge identity: fixture smoke creates hash-only preview", () => {
  const preview = buildOrderBridgeIdentityHmacPreview(fixturePayload, {
    secret: SECRET,
    receivedAt: "2026-05-08T13:59:00.000Z",
  });

  assert.equal(preview.ok, true);
  assert.equal(preview.would_store, false);
  assert.equal(preview.would_send, false);
  assert.equal(preview.email_hash_present, true);
  assert.equal(preview.phone_hash_present, true);
  assert.equal(preview.order_no_hash_present, true);
  assert.equal(preview.client_session_present, true);
  assert.equal(preview.click_id_hash_present, true);
  assert.equal(preview.row_status, "full_bridge");
  assert.equal(preview.identity_source, "both");
  assert.equal(preview.no_platform_send_verified, true);
  assert.equal(preview.platform_send_count, 0);
  assert.equal(preview.raw_payload_stored, false);
  assert.equal(preview.raw_logging_enabled, false);
  assert.equal(
    preview.hash_prefixes.email_hash_prefix,
    hmacSha256Hex(RAW_EMAIL.toLowerCase(), SECRET).slice(0, 8),
  );
  assertNoRawEcho(preview);
});

test("order bridge identity: safe log record has no raw email phone order session or click id", () => {
  const preview = buildOrderBridgeIdentityHmacPreview(fixturePayload, { secret: SECRET });
  const logRecord = buildOrderBridgeIdentityHmacLogRecord(preview);

  assert.equal(logRecord.would_store, false);
  assert.equal(logRecord.would_send, false);
  assert.equal(logRecord.row_status, "full_bridge");
  assert.equal(logRecord.no_platform_send_verified, true);
  assert.equal(logRecord.platform_send_count, 0);
  assertNoRawEcho(logRecord);
});

test("order bridge identity: no-send route returns hash-only response and no platform send", async (t) => {
  const previousSecret = process.env.ORDER_BRIDGE_IDENTITY_HASH_SECRET;
  process.env.ORDER_BRIDGE_IDENTITY_HASH_SECRET = SECRET;

  const app = express();
  app.use(express.json());
  app.use(createAttributionRouter());
  const server = app.listen(0);
  t.after(() => {
    if (previousSecret === undefined) {
      delete process.env.ORDER_BRIDGE_IDENTITY_HASH_SECRET;
    } else {
      process.env.ORDER_BRIDGE_IDENTITY_HASH_SECRET = previousSecret;
    }
    server.close();
  });

  const address = server.address();
  assert.equal(typeof address, "object");
  assert.ok(address && "port" in address);

  const response = await fetch(`http://127.0.0.1:${address.port}/api/attribution/order-bridge/identity-hmac/no-send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fixturePayload),
  });
  const body = await response.json() as Record<string, unknown>;

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.would_store, false);
  assert.equal(body.would_send, false);
  assert.equal(body.no_platform_send_verified, true);
  const preview = body.preview as Record<string, unknown>;
  assert.equal(preview.email_hash_present, true);
  assert.equal(preview.phone_hash_present, true);
  assert.equal(preview.order_no_hash_present, true);
  assert.equal(preview.client_session_present, true);
  assert.equal(preview.row_status, "full_bridge");
  assert.equal(preview.no_platform_send_verified, true);
  assert.equal(preview.platform_send_count, 0);
  assertNoRawEcho(body);
});

test("order bridge identity: oversized payload is rejected without raw echo or platform send", async (t) => {
  const previousSecret = process.env.ORDER_BRIDGE_IDENTITY_HASH_SECRET;
  process.env.ORDER_BRIDGE_IDENTITY_HASH_SECRET = SECRET;

  const app = express();
  app.use(express.json({ limit: "64kb" }));
  app.use(createAttributionRouter());
  const server = app.listen(0);
  t.after(() => {
    if (previousSecret === undefined) {
      delete process.env.ORDER_BRIDGE_IDENTITY_HASH_SECRET;
    } else {
      process.env.ORDER_BRIDGE_IDENTITY_HASH_SECRET = previousSecret;
    }
    server.close();
  });

  const address = server.address();
  assert.equal(typeof address, "object");
  assert.ok(address && "port" in address);

  const oversizedPayload = {
    ...fixturePayload,
    extra_note: "x".repeat(17 * 1024),
  };
  const response = await fetch(`http://127.0.0.1:${address.port}/api/attribution/order-bridge/identity-hmac/no-send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(oversizedPayload),
  });
  const body = await response.json() as Record<string, unknown>;

  assert.equal(response.status, 413);
  assert.equal(body.ok, false);
  assert.equal(body.would_store, false);
  assert.equal(body.would_send, false);
  assert.equal(body.no_platform_send_verified, true);
  assert.equal(body.error, "payload_too_large");
  assertNoRawEcho(body);
});
