import { createHash, randomUUID } from "node:crypto";

import type Database from "better-sqlite3";

import { getCrmDb } from "./crmLocalDb";
import {
  ORDER_BRIDGE_IDENTITY_HASH_VERSION,
  type OrderBridgeIdentityHmacMaterial,
  type OrderBridgeLedgerStatus,
} from "./orderBridgeIdentityHmac";

const TABLE = "order_bridge_ledger";
let tableReady = false;

const ensureTable = (db: Database.Database) => {
  if (tableReady) return;
  db.exec(`
    CREATE TABLE IF NOT EXISTS ${TABLE} (
      bridge_id TEXT PRIMARY KEY,
      site TEXT NOT NULL DEFAULT 'biocom',
      capture_stage TEXT NOT NULL DEFAULT 'order_confirm',
      received_at TEXT NOT NULL,
      order_no_hash TEXT NOT NULL DEFAULT '',
      client_id TEXT NOT NULL DEFAULT '',
      ga_session_id TEXT NOT NULL DEFAULT '',
      local_session_id_hash TEXT NOT NULL DEFAULT '',
      click_id_hash TEXT NOT NULL DEFAULT '',
      member_code_hash TEXT NOT NULL DEFAULT '',
      email_hash TEXT NOT NULL DEFAULT '',
      phone_hash TEXT NOT NULL DEFAULT '',
      identity_hash_version TEXT NOT NULL DEFAULT '${ORDER_BRIDGE_IDENTITY_HASH_VERSION}',
      identity_source TEXT NOT NULL DEFAULT 'none',
      pay_type TEXT NOT NULL DEFAULT '',
      pg_type TEXT NOT NULL DEFAULT '',
      dedupe_key TEXT NOT NULL,
      duplicate_count INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'received',
      reject_reason TEXT NOT NULL DEFAULT '',
      raw_payload_stored INTEGER NOT NULL DEFAULT 0,
      platform_send_count INTEGER NOT NULL DEFAULT 0,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_obl_dedupe ON ${TABLE}(dedupe_key);
    CREATE INDEX IF NOT EXISTS idx_obl_order ON ${TABLE}(site, order_no_hash) WHERE order_no_hash != '';
    CREATE INDEX IF NOT EXISTS idx_obl_email ON ${TABLE}(site, email_hash) WHERE email_hash != '';
    CREATE INDEX IF NOT EXISTS idx_obl_phone ON ${TABLE}(site, phone_hash) WHERE phone_hash != '';
    CREATE INDEX IF NOT EXISTS idx_obl_click ON ${TABLE}(site, click_id_hash) WHERE click_id_hash != '';
    CREATE INDEX IF NOT EXISTS idx_obl_session ON ${TABLE}(site, client_id, ga_session_id);
    CREATE INDEX IF NOT EXISTS idx_obl_expires ON ${TABLE}(expires_at);
  `);
  tableReady = true;
};

const sha256Hex = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");

const boolEnv = (key: string, defaultValue = false) => {
  const value = (process.env[key] ?? String(defaultValue)).trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes";
};

export const isOrderBridgeWriteEnabled = () => boolEnv("ORDER_BRIDGE_WRITE_ENABLED", false);

export const isOrderBridgeRawBodyLoggingEnabled = () => boolEnv("ORDER_BRIDGE_RAW_BODY_LOGGING", false);

export const isOrderBridgePlatformSendEnabled = () => boolEnv("ORDER_BRIDGE_PLATFORM_SEND_ENABLED", false);

export const getOrderBridgeWriteMaxRows = () => {
  const raw = Number(process.env.ORDER_BRIDGE_WRITE_MAX_ROWS ?? "200");
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  return Math.min(Math.floor(raw), 200);
};

const canaryUntilMs = () => {
  const raw = (process.env.ORDER_BRIDGE_WRITE_CANARY_UNTIL ?? "").trim();
  if (!raw) return Infinity;
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : 0;
};

const retentionDays = () => {
  const raw = Number(process.env.ORDER_BRIDGE_RETENTION_DAYS ?? "90");
  if (!Number.isFinite(raw) || raw <= 0) return 90;
  return Math.min(Math.floor(raw), 365);
};

const computeExpiresAt = (receivedAt: string) => {
  const base = Number.isFinite(Date.parse(receivedAt)) ? Date.parse(receivedAt) : Date.now();
  return new Date(base + retentionDays() * 24 * 3600 * 1000).toISOString();
};

const buildDedupeKey = (material: OrderBridgeIdentityHmacMaterial) => {
  const identityHash = material.hashes.email_hash || material.hashes.phone_hash;
  return sha256Hex([
    "order_bridge",
    material.site,
    material.captureStage,
    material.hashes.order_no_hash,
    material.hashes.click_id_hash,
    material.passthrough.identity_source,
    identityHash,
    material.hashes.local_session_id_hash,
  ].join("|"));
};

export type OrderBridgeLedgerRow = {
  bridgeId: string;
  site: string;
  captureStage: string;
  receivedAt: string;
  orderNoHash: string;
  clientId: string;
  gaSessionId: string;
  localSessionIdHash: string;
  clickIdHash: string;
  emailHash: string;
  phoneHash: string;
  identitySource: string;
  dedupeKey: string;
  duplicateCount: number;
  status: OrderBridgeLedgerStatus;
  rejectReason: string;
  rawPayloadStored: number;
  platformSendCount: number;
  expiresAt: string;
};

export type OrderBridgeRecordResult =
  | { stored: true; deduped: boolean; row: OrderBridgeLedgerRow }
  | { stored: false; rejected: true; reason: string };

const dbRowToRow = (row: Record<string, unknown>): OrderBridgeLedgerRow => ({
  bridgeId: String(row.bridge_id),
  site: String(row.site),
  captureStage: String(row.capture_stage),
  receivedAt: String(row.received_at),
  orderNoHash: String(row.order_no_hash ?? ""),
  clientId: String(row.client_id ?? ""),
  gaSessionId: String(row.ga_session_id ?? ""),
  localSessionIdHash: String(row.local_session_id_hash ?? ""),
  clickIdHash: String(row.click_id_hash ?? ""),
  emailHash: String(row.email_hash ?? ""),
  phoneHash: String(row.phone_hash ?? ""),
  identitySource: String(row.identity_source ?? "none"),
  dedupeKey: String(row.dedupe_key),
  duplicateCount: Number(row.duplicate_count) || 0,
  status: String(row.status ?? "do_not_send") as OrderBridgeLedgerStatus,
  rejectReason: String(row.reject_reason ?? ""),
  rawPayloadStored: Number(row.raw_payload_stored) || 0,
  platformSendCount: Number(row.platform_send_count) || 0,
  expiresAt: String(row.expires_at),
});

/**
 * order_bridge_ledger row 를 site + order_no_hash 로 조회한다.
 * ConfirmedPurchasePrep cross_reference_evidence.ledger_lookup wire (다음 sprint) 가
 * same-order match 후보를 가져올 때 사용.
 *
 * read-only. raw email/phone/order 인자 금지 — order_no_hash 만 받는다.
 */
export const findOrderBridgeRowsByOrderHash = (
  orderNoHash: string,
  site: string = "biocom",
): OrderBridgeLedgerRow[] => {
  if (!orderNoHash) return [];
  const db = getCrmDb();
  ensureTable(db);
  const rows = db
    .prepare(`SELECT * FROM ${TABLE} WHERE site = ? AND order_no_hash = ? ORDER BY created_at ASC`)
    .all(site, orderNoHash) as Array<Record<string, unknown>>;
  return rows.map(dbRowToRow);
};

const selectByDedupeKey = (db: Database.Database, dedupeKey: string): OrderBridgeLedgerRow | null => {
  const row = db.prepare(`SELECT * FROM ${TABLE} WHERE dedupe_key = ?`).get(dedupeKey) as
    | Record<string, unknown>
    | undefined;
  return row ? dbRowToRow(row) : null;
};

const currentRowCount = (db: Database.Database, site: string) => {
  const row = db.prepare(`SELECT COUNT(*) AS n FROM ${TABLE} WHERE site = ?`).get(site) as { n: number };
  return Number(row.n) || 0;
};

export const bootstrapOrderBridgeLedgerTable = () => {
  ensureTable(getCrmDb());
};

export const resetOrderBridgeLedgerTableForTests = () => {
  tableReady = false;
};

export const recordOrderBridgeLedger = (
  material: OrderBridgeIdentityHmacMaterial,
): OrderBridgeRecordResult => {
  if (!isOrderBridgeWriteEnabled()) {
    return { stored: false, rejected: true, reason: "write_flag_disabled" };
  }
  if (isOrderBridgeRawBodyLoggingEnabled()) {
    return { stored: false, rejected: true, reason: "raw_body_logging_enabled" };
  }
  if (isOrderBridgePlatformSendEnabled()) {
    return { stored: false, rejected: true, reason: "platform_send_flag_enabled" };
  }
  if (Date.now() > canaryUntilMs()) {
    return { stored: false, rejected: true, reason: "canary_window_closed" };
  }
  if (!material.hashes.order_no_hash) {
    return { stored: false, rejected: true, reason: "missing_order_no_hash" };
  }

  const db = getCrmDb();
  ensureTable(db);
  const now = new Date().toISOString();
  const dedupeKey = buildDedupeKey(material);
  const existing = selectByDedupeKey(db, dedupeKey);
  if (existing) {
    db.prepare(
      `UPDATE ${TABLE}
       SET duplicate_count = duplicate_count + 1,
           updated_at = ?
       WHERE dedupe_key = ?`,
    ).run(now, dedupeKey);
    const row = selectByDedupeKey(db, dedupeKey);
    if (!row) throw new Error("order_bridge_dedupe_lookup_failed");
    return { stored: true, deduped: true, row };
  }

  const maxRows = getOrderBridgeWriteMaxRows();
  if (maxRows <= 0) {
    return { stored: false, rejected: true, reason: "row_cap_zero" };
  }
  if (currentRowCount(db, material.site) >= maxRows) {
    return { stored: false, rejected: true, reason: "row_cap_reached" };
  }

  const bridgeId = randomUUID();
  const expiresAt = computeExpiresAt(material.receivedAt);
  db.prepare(
    `INSERT INTO ${TABLE} (
      bridge_id, site, capture_stage, received_at,
      order_no_hash, client_id, ga_session_id, local_session_id_hash,
      click_id_hash, member_code_hash, email_hash, phone_hash,
      identity_hash_version, identity_source, pay_type, pg_type,
      dedupe_key, duplicate_count, status, reject_reason,
      raw_payload_stored, platform_send_count, expires_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '', ?, ?, ?, ?, ?, ?, ?, 0, ?, '', 0, 0, ?, ?, ?)`,
  ).run(
    bridgeId,
    material.site,
    material.captureStage,
    material.receivedAt,
    material.hashes.order_no_hash,
    material.passthrough.client_id,
    material.passthrough.ga_session_id,
    material.hashes.local_session_id_hash,
    material.hashes.click_id_hash,
    material.hashes.email_hash,
    material.hashes.phone_hash,
    ORDER_BRIDGE_IDENTITY_HASH_VERSION,
    material.passthrough.identity_source,
    material.passthrough.pay_type,
    material.passthrough.pg_type,
    dedupeKey,
    material.preview.row_status,
    expiresAt,
    now,
    now,
  );

  const row = selectByDedupeKey(db, dedupeKey);
  if (!row) throw new Error("order_bridge_insert_lookup_failed");
  return { stored: true, deduped: false, row };
};

export const getOrderBridgeLedgerSummary = (siteInput = "biocom") => {
  const db = getCrmDb();
  ensureTable(db);
  const site = siteInput || "biocom";
  const row = db
    .prepare(
      `SELECT
        COUNT(*) AS row_count,
        COUNT(DISTINCT NULLIF(order_no_hash, '')) AS unique_order_no_hash,
        COUNT(DISTINCT NULLIF(email_hash, '')) AS unique_email_hash,
        COUNT(DISTINCT NULLIF(phone_hash, '')) AS unique_phone_hash,
        COUNT(DISTINCT NULLIF(click_id_hash, '')) AS unique_click_id_hash,
        SUM(CASE WHEN raw_payload_stored != 0 THEN 1 ELSE 0 END) AS raw_stored_count,
        SUM(platform_send_count) AS platform_send_count,
        SUM(duplicate_count) AS duplicate_dedupe_count,
        SUM(CASE WHEN status = 'full_bridge' THEN 1 ELSE 0 END) AS full_bridge_count,
        SUM(CASE WHEN status = 'identity_only_quarantine' THEN 1 ELSE 0 END) AS identity_only_quarantine_count,
        SUM(CASE WHEN status = 'session_only_quarantine' THEN 1 ELSE 0 END) AS session_only_quarantine_count,
        SUM(CASE WHEN status = 'click_missing_hold' THEN 1 ELSE 0 END) AS click_missing_hold_count,
        SUM(CASE WHEN status = 'ambiguous' THEN 1 ELSE 0 END) AS ambiguous_count,
        SUM(CASE WHEN status = 'do_not_send' THEN 1 ELSE 0 END) AS do_not_send_count
       FROM ${TABLE}
       WHERE site = ?`,
    )
    .get(site) as Record<string, number | null>;
  return {
    site,
    row_count: Number(row.row_count) || 0,
    unique_order_no_hash: Number(row.unique_order_no_hash) || 0,
    unique_email_hash: Number(row.unique_email_hash) || 0,
    unique_phone_hash: Number(row.unique_phone_hash) || 0,
    unique_click_id_hash: Number(row.unique_click_id_hash) || 0,
    raw_stored_count: Number(row.raw_stored_count) || 0,
    platform_send_count: Number(row.platform_send_count) || 0,
    duplicate_dedupe_count: Number(row.duplicate_dedupe_count) || 0,
    status_counts: {
      full_bridge: Number(row.full_bridge_count) || 0,
      identity_only_quarantine: Number(row.identity_only_quarantine_count) || 0,
      session_only_quarantine: Number(row.session_only_quarantine_count) || 0,
      click_missing_hold: Number(row.click_missing_hold_count) || 0,
      ambiguous: Number(row.ambiguous_count) || 0,
      do_not_send: Number(row.do_not_send_count) || 0,
    },
  };
};
