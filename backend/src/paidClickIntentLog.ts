import { createHash, randomUUID } from "node:crypto";

import type Database from "better-sqlite3";

import { getCrmDb } from "./crmLocalDb";

const TABLE = "paid_click_intent_ledger";
let tableReady = false;

const ensureTable = (db: Database.Database) => {
  if (tableReady) return;
  db.exec(`
    CREATE TABLE IF NOT EXISTS ${TABLE} (
      intent_id TEXT PRIMARY KEY,
      site TEXT NOT NULL DEFAULT 'biocom',
      captured_at TEXT NOT NULL,
      received_at TEXT NOT NULL,
      platform_hint TEXT NOT NULL DEFAULT 'google_ads',
      capture_stage TEXT NOT NULL DEFAULT 'landing',
      click_id_type TEXT NOT NULL DEFAULT '',
      click_id_value TEXT NOT NULL DEFAULT '',
      click_id_hash TEXT NOT NULL DEFAULT '',
      utm_source TEXT NOT NULL DEFAULT '',
      utm_medium TEXT NOT NULL DEFAULT '',
      utm_campaign TEXT NOT NULL DEFAULT '',
      utm_term TEXT NOT NULL DEFAULT '',
      utm_content TEXT NOT NULL DEFAULT '',
      landing_path TEXT NOT NULL DEFAULT '',
      allowed_query_json TEXT NOT NULL DEFAULT '{}',
      referrer_host TEXT NOT NULL DEFAULT '',
      client_id TEXT NOT NULL DEFAULT '',
      ga_session_id TEXT NOT NULL DEFAULT '',
      local_session_id TEXT NOT NULL DEFAULT '',
      user_agent_hash TEXT NOT NULL DEFAULT '',
      ip_hash TEXT NOT NULL DEFAULT '',
      dedupe_key TEXT NOT NULL,
      duplicate_count INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'received',
      reject_reason TEXT NOT NULL DEFAULT '',
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_pci_dedupe ON ${TABLE}(dedupe_key);
    CREATE INDEX IF NOT EXISTS idx_pci_click_hash ON ${TABLE}(click_id_hash);
    CREATE INDEX IF NOT EXISTS idx_pci_session ON ${TABLE}(site, ga_session_id, local_session_id);
    CREATE INDEX IF NOT EXISTS idx_pci_expires ON ${TABLE}(expires_at);
    CREATE INDEX IF NOT EXISTS idx_pci_status ON ${TABLE}(status, captured_at DESC);
  `);
  tableReady = true;
};

const hashValue = (input: string, salt: string) => {
  if (!input) return "";
  return createHash("sha256").update(`${salt}::${input}`).digest("hex").slice(0, 32);
};

const PII_FIELDS = new Set([
  "email",
  "phone",
  "name",
  "address",
  "order_number",
  "ordernumber",
  "channel_order_no",
  "channelorderno",
  "payment_key",
  "paymentkey",
  "value",
  "currency",
  "paid_at",
  "paidat",
]);

export type PaidClickIntentRow = {
  intentId: string;
  site: string;
  capturedAt: string;
  receivedAt: string;
  platformHint: string;
  captureStage: string;
  clickIdType: string;
  clickIdValue: string;
  clickIdHash: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmTerm: string;
  utmContent: string;
  landingPath: string;
  allowedQueryJson: string;
  referrerHost: string;
  clientId: string;
  gaSessionId: string;
  localSessionId: string;
  userAgentHash: string;
  ipHash: string;
  dedupeKey: string;
  duplicateCount: number;
  status: string;
  rejectReason: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
};

export type PaidClickIntentRecordResult =
  | { stored: true; intent: PaidClickIntentRow; deduped: false }
  | { stored: true; intent: PaidClickIntentRow; deduped: true }
  | { stored: false; deduped: false; rejected: true; reason: string };

export type PaidClickIntentRequestContext = {
  ip: string;
  userAgent: string;
};

export type PaidClickIntentPreview = {
  site: string;
  capture_stage: string;
  captured_at: string;
  dedupe_key: string;
  has_google_click_id: boolean;
  test_click_id: boolean;
  live_candidate_after_approval: boolean;
  block_reasons: string[];
  click_ids: { gclid: string; gbraid: string; wbraid: string; fbclid?: string; ttclid?: string };
  utm: { source: string; medium: string; campaign: string; term: string; content: string };
  client_id: string;
  ga_session_id: string;
  local_session_id: string;
  sanitized_landing_url: string;
  sanitized_referrer: string;
};

const pickClickIdType = (clickIds: PaidClickIntentPreview["click_ids"]): { type: string; value: string } => {
  if (clickIds.gclid) return { type: "gclid", value: clickIds.gclid };
  if (clickIds.gbraid) return { type: "gbraid", value: clickIds.gbraid };
  if (clickIds.wbraid) return { type: "wbraid", value: clickIds.wbraid };
  return { type: "", value: "" };
};

const extractPath = (sanitizedUrl: string) => {
  if (!sanitizedUrl) return "";
  try {
    const u = new URL(sanitizedUrl);
    return u.pathname.slice(0, 200);
  } catch {
    return "";
  }
};

const extractHost = (sanitizedUrl: string) => {
  if (!sanitizedUrl) return "";
  try {
    return new URL(sanitizedUrl).host.slice(0, 120);
  } catch {
    return "";
  }
};

const buildAllowedQueryJson = (preview: PaidClickIntentPreview) => {
  const allowed: Record<string, string> = {};
  if (preview.utm.source) allowed.utm_source = preview.utm.source;
  if (preview.utm.medium) allowed.utm_medium = preview.utm.medium;
  if (preview.utm.campaign) allowed.utm_campaign = preview.utm.campaign;
  if (preview.utm.term) allowed.utm_term = preview.utm.term;
  if (preview.utm.content) allowed.utm_content = preview.utm.content;
  if (preview.click_ids.gclid) allowed.gclid_present = "1";
  if (preview.click_ids.gbraid) allowed.gbraid_present = "1";
  if (preview.click_ids.wbraid) allowed.wbraid_present = "1";
  return JSON.stringify(allowed);
};

const isPiiPresent = (rawInput: unknown): boolean => {
  if (!rawInput || typeof rawInput !== "object") return false;
  const obj = rawInput as Record<string, unknown>;
  for (const key of Object.keys(obj)) {
    const normalized = key.toLowerCase().replace(/[\s_-]/g, "");
    if (PII_FIELDS.has(normalized) || PII_FIELDS.has(key.toLowerCase())) return true;
  }
  return false;
};

const dbRowToRow = (row: Record<string, unknown>): PaidClickIntentRow => ({
  intentId: String(row.intent_id),
  site: String(row.site),
  capturedAt: String(row.captured_at),
  receivedAt: String(row.received_at),
  platformHint: String(row.platform_hint),
  captureStage: String(row.capture_stage),
  clickIdType: String(row.click_id_type ?? ""),
  clickIdValue: String(row.click_id_value ?? ""),
  clickIdHash: String(row.click_id_hash ?? ""),
  utmSource: String(row.utm_source ?? ""),
  utmMedium: String(row.utm_medium ?? ""),
  utmCampaign: String(row.utm_campaign ?? ""),
  utmTerm: String(row.utm_term ?? ""),
  utmContent: String(row.utm_content ?? ""),
  landingPath: String(row.landing_path ?? ""),
  allowedQueryJson: String(row.allowed_query_json ?? "{}"),
  referrerHost: String(row.referrer_host ?? ""),
  clientId: String(row.client_id ?? ""),
  gaSessionId: String(row.ga_session_id ?? ""),
  localSessionId: String(row.local_session_id ?? ""),
  userAgentHash: String(row.user_agent_hash ?? ""),
  ipHash: String(row.ip_hash ?? ""),
  dedupeKey: String(row.dedupe_key),
  duplicateCount: Number(row.duplicate_count) || 0,
  status: String(row.status),
  rejectReason: String(row.reject_reason ?? ""),
  expiresAt: String(row.expires_at),
  createdAt: String(row.created_at),
  updatedAt: String(row.updated_at),
});

const selectByDedupeKey = (db: Database.Database, dedupeKey: string): PaidClickIntentRow | null => {
  const row = db
    .prepare(`SELECT * FROM ${TABLE} WHERE dedupe_key = ?`)
    .get(dedupeKey) as Record<string, unknown> | undefined;
  return row ? dbRowToRow(row) : null;
};

const markDuplicate = (db: Database.Database, dedupeKey: string, receivedAt: string): PaidClickIntentRow => {
  db.prepare(
    `UPDATE ${TABLE}
     SET duplicate_count = duplicate_count + 1,
         updated_at = ?
     WHERE dedupe_key = ?`,
  ).run(receivedAt, dedupeKey);
  const row = selectByDedupeKey(db, dedupeKey);
  if (!row) throw new Error("paid_click_intent_dedupe_lookup_failed");
  return row;
};

const PAID_CLICK_INTENT_RETENTION_DAYS = Number(process.env.PAID_CLICK_INTENT_RETENTION_DAYS ?? "90");

const computeExpiresAt = (capturedAt: string) => {
  const base = Number.isFinite(Date.parse(capturedAt)) ? Date.parse(capturedAt) : Date.now();
  const expires = new Date(base + PAID_CLICK_INTENT_RETENTION_DAYS * 24 * 3600 * 1000);
  return expires.toISOString();
};

/**
 * Insert a minimal paid_click_intent ledger row from the no-send preview.
 * Caller MUST have validated preview.live_candidate_after_approval=true and
 * checked the feature flag before calling.
 *
 * Forbidden fields (raw body, PII, order/payment/value/currency) are filtered:
 *   - sanitized_landing_url has query stripped before this point
 *   - PII detection on rawInput rejects upstream
 *   - this fn does not accept order/payment/value/currency input
 */
export const recordPaidClickIntent = (
  preview: PaidClickIntentPreview,
  rawInput: unknown,
  context: PaidClickIntentRequestContext,
): PaidClickIntentRecordResult => {
  if (isPiiPresent(rawInput)) {
    return { stored: false, deduped: false, rejected: true, reason: "pii_or_purchase_field_detected" };
  }
  if (!preview.live_candidate_after_approval) {
    return { stored: false, deduped: false, rejected: true, reason: preview.block_reasons.join(",") || "not_live_candidate" };
  }

  const db = getCrmDb();
  ensureTable(db);

  const now = new Date().toISOString();
  const { type: clickIdType, value: clickIdValue } = pickClickIdType(preview.click_ids);
  const clickIdHash = hashValue(clickIdValue, "pci_click");
  const userAgentHash = hashValue(context.userAgent || "", "pci_ua");
  const ipHash = hashValue(context.ip || "", "pci_ip");
  const landingPath = extractPath(preview.sanitized_landing_url);
  const referrerHost = extractHost(preview.sanitized_referrer);
  const expiresAt = computeExpiresAt(preview.captured_at);
  const allowedQueryJson = buildAllowedQueryJson(preview);

  const existing = selectByDedupeKey(db, preview.dedupe_key);
  if (existing) {
    const intent = markDuplicate(db, preview.dedupe_key, now);
    return { stored: true, intent, deduped: true };
  }

  const intentId = randomUUID();
  db.prepare(
    `INSERT INTO ${TABLE} (
      intent_id, site, captured_at, received_at, platform_hint, capture_stage,
      click_id_type, click_id_value, click_id_hash,
      utm_source, utm_medium, utm_campaign, utm_term, utm_content,
      landing_path, allowed_query_json, referrer_host,
      client_id, ga_session_id, local_session_id, user_agent_hash, ip_hash,
      dedupe_key, duplicate_count, status, reject_reason, expires_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'received', '', ?, ?, ?)`,
  ).run(
    intentId,
    preview.site,
    preview.captured_at,
    now,
    "google_ads",
    preview.capture_stage,
    clickIdType,
    clickIdValue,
    clickIdHash,
    preview.utm.source,
    preview.utm.medium,
    preview.utm.campaign,
    preview.utm.term,
    preview.utm.content,
    landingPath,
    allowedQueryJson,
    referrerHost,
    preview.client_id,
    preview.ga_session_id,
    preview.local_session_id,
    userAgentHash,
    ipHash,
    preview.dedupe_key,
    expiresAt,
    now,
    now,
  );

  const intent = selectByDedupeKey(db, preview.dedupe_key);
  if (!intent) throw new Error("paid_click_intent_insert_lookup_failed");
  return { stored: true, intent, deduped: false };
};

/**
 * Eagerly create the paid_click_intent_ledger table.
 * Server boot/Express setup can call this so the schema exists even while
 * the write flag is OFF, which makes Phase 1 verification deterministic.
 */
export const bootstrapPaidClickIntentTable = (): void => {
  ensureTable(getCrmDb());
};

export const isPaidClickIntentWriteEnabled = (): boolean => {
  const value = (process.env.PAID_CLICK_INTENT_WRITE_ENABLED ?? "false").trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes";
};

export const getPaidClickIntentWriteSampleRate = (): number => {
  const raw = Number(process.env.PAID_CLICK_INTENT_WRITE_SAMPLE_RATE ?? "1");
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  if (raw > 1) return 1;
  return raw;
};

export const getPaidClickIntentSummary = (siteInput = "biocom") => {
  const db = getCrmDb();
  ensureTable(db);
  const site = siteInput || "biocom";
  const total = db
    .prepare(`SELECT COUNT(*) AS n FROM ${TABLE} WHERE site = ?`)
    .get(site) as { n: number };
  const last24h = db
    .prepare(
      `SELECT COUNT(*) AS n FROM ${TABLE}
       WHERE site = ? AND received_at >= datetime('now', '-1 day')`,
    )
    .get(site) as { n: number };
  const dedupedCount = db
    .prepare(`SELECT COUNT(*) AS n FROM ${TABLE} WHERE site = ? AND duplicate_count > 0`)
    .get(site) as { n: number };
  const withGclid = db
    .prepare(`SELECT COUNT(*) AS n FROM ${TABLE} WHERE site = ? AND click_id_type = 'gclid'`)
    .get(site) as { n: number };
  return {
    site,
    total: Number(total.n) || 0,
    last_24h: Number(last24h.n) || 0,
    deduped: Number(dedupedCount.n) || 0,
    with_gclid: Number(withGclid.n) || 0,
  };
};

export const listPaidClickIntents = (input: { site?: string; limit?: number }) => {
  const db = getCrmDb();
  ensureTable(db);
  const site = input.site || "biocom";
  const limit = Math.min(Math.max(Number(input.limit) || 50, 1), 200);
  const rows = db
    .prepare(
      `SELECT * FROM ${TABLE}
       WHERE site = ?
       ORDER BY received_at DESC
       LIMIT ?`,
    )
    .all(site, limit) as Record<string, unknown>[];
  return rows.map(dbRowToRow);
};
