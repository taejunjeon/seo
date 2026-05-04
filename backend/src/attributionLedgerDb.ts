import { createHash } from "node:crypto";
import path from "node:path";

import type Database from "better-sqlite3";

import { getCrmDb } from "./crmLocalDb";
import type { AttributionLedgerEntry } from "./attribution";

const ATTRIBUTION_LEDGER_TABLE = "attribution_ledger";
const DEFAULT_DB_PATH = path.resolve(__dirname, "..", "data", "crm.sqlite3");

type AttributionLedgerRow = {
  entry_id: string;
  touchpoint: string;
  capture_mode: string;
  payment_status: string | null;
  logged_at: string;
  order_id: string;
  payment_key: string;
  approved_at: string;
  checkout_id: string;
  customer_key: string;
  landing: string;
  referrer: string;
  ga_session_id: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_term: string;
  utm_content: string;
  gclid: string;
  fbclid: string;
  ttclid: string;
  source: string;
  metadata_json: string;
  request_context_json: string;
};

let schemaReady = false;

const ensureAttributionLedgerSchema = (db: Database.Database) => {
  if (schemaReady) return;

  db.exec(`
    CREATE TABLE IF NOT EXISTS ${ATTRIBUTION_LEDGER_TABLE} (
      entry_id TEXT PRIMARY KEY,
      touchpoint TEXT NOT NULL,
      capture_mode TEXT NOT NULL,
      payment_status TEXT,
      logged_at TEXT NOT NULL,
      order_id TEXT NOT NULL DEFAULT '',
      payment_key TEXT NOT NULL DEFAULT '',
      approved_at TEXT NOT NULL DEFAULT '',
      checkout_id TEXT NOT NULL DEFAULT '',
      customer_key TEXT NOT NULL DEFAULT '',
      landing TEXT NOT NULL DEFAULT '',
      referrer TEXT NOT NULL DEFAULT '',
      ga_session_id TEXT NOT NULL DEFAULT '',
      utm_source TEXT NOT NULL DEFAULT '',
      utm_medium TEXT NOT NULL DEFAULT '',
      utm_campaign TEXT NOT NULL DEFAULT '',
      utm_term TEXT NOT NULL DEFAULT '',
      utm_content TEXT NOT NULL DEFAULT '',
      gclid TEXT NOT NULL DEFAULT '',
      fbclid TEXT NOT NULL DEFAULT '',
      ttclid TEXT NOT NULL DEFAULT '',
      source TEXT NOT NULL DEFAULT '',
      metadata_json TEXT NOT NULL DEFAULT '{}',
      request_context_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_attribution_ledger_logged_at
      ON ${ATTRIBUTION_LEDGER_TABLE}(logged_at DESC);
    CREATE INDEX IF NOT EXISTS idx_attribution_ledger_touchpoint
      ON ${ATTRIBUTION_LEDGER_TABLE}(touchpoint);
    CREATE INDEX IF NOT EXISTS idx_attribution_ledger_capture_mode
      ON ${ATTRIBUTION_LEDGER_TABLE}(capture_mode);
    CREATE INDEX IF NOT EXISTS idx_attribution_ledger_payment_status
      ON ${ATTRIBUTION_LEDGER_TABLE}(payment_status);
    CREATE INDEX IF NOT EXISTS idx_attribution_ledger_order_id
      ON ${ATTRIBUTION_LEDGER_TABLE}(order_id);
    CREATE INDEX IF NOT EXISTS idx_attribution_ledger_payment_key
      ON ${ATTRIBUTION_LEDGER_TABLE}(payment_key);
    CREATE INDEX IF NOT EXISTS idx_attribution_ledger_source
      ON ${ATTRIBUTION_LEDGER_TABLE}(source);
  `);

  schemaReady = true;
};

const getSource = (entry: AttributionLedgerEntry) =>
  typeof entry.metadata?.source === "string" ? entry.metadata.source.trim() : "";

export const getAttributionLedgerDbPath = () => process.env.CRM_LOCAL_DB_PATH?.trim() || DEFAULT_DB_PATH;

export const getAttributionLedgerStorageRef = () => `${getAttributionLedgerDbPath()}#${ATTRIBUTION_LEDGER_TABLE}`;

export const buildAttributionLedgerEntryId = (entry: AttributionLedgerEntry) => {
  const hash = createHash("sha256");
  hash.update(entry.touchpoint);
  hash.update("\u001f");
  hash.update(entry.captureMode);
  hash.update("\u001f");
  hash.update(entry.paymentStatus ?? "");
  hash.update("\u001f");
  hash.update(entry.loggedAt);
  hash.update("\u001f");
  hash.update(entry.orderId);
  hash.update("\u001f");
  hash.update(entry.paymentKey);
  hash.update("\u001f");
  hash.update(entry.approvedAt);
  hash.update("\u001f");
  hash.update(entry.checkoutId);
  hash.update("\u001f");
  hash.update(entry.customerKey);
  hash.update("\u001f");
  hash.update(entry.landing);
  hash.update("\u001f");
  hash.update(entry.referrer);
  hash.update("\u001f");
  hash.update(entry.gaSessionId);
  hash.update("\u001f");
  hash.update(entry.utmSource);
  hash.update("\u001f");
  hash.update(entry.utmMedium);
  hash.update("\u001f");
  hash.update(entry.utmCampaign);
  hash.update("\u001f");
  hash.update(entry.utmTerm);
  hash.update("\u001f");
  hash.update(entry.utmContent);
  hash.update("\u001f");
  hash.update(entry.gclid);
  hash.update("\u001f");
  hash.update(entry.fbclid);
  hash.update("\u001f");
  hash.update(entry.ttclid);
  hash.update("\u001f");
  hash.update(JSON.stringify(entry.metadata ?? {}));
  hash.update("\u001f");
  hash.update(JSON.stringify(entry.requestContext ?? {}));
  return hash.digest("hex");
};

const dbRowToEntry = (row: AttributionLedgerRow): AttributionLedgerEntry => ({
  entryId: row.entry_id,
  touchpoint:
    row.touchpoint === "marketing_intent"
      ? "marketing_intent"
      : row.touchpoint === "payment_success"
        ? "payment_success"
        : row.touchpoint === "form_submit"
          ? "form_submit"
          : "checkout_started",
  captureMode:
    row.capture_mode === "replay"
      ? "replay"
      : row.capture_mode === "smoke"
        ? "smoke"
        : "live",
  paymentStatus:
    row.payment_status === "confirmed"
      ? "confirmed"
      : row.payment_status === "canceled"
        ? "canceled"
        : row.payment_status === "pending"
          ? "pending"
          : null,
  loggedAt: row.logged_at,
  orderId: row.order_id,
  paymentKey: row.payment_key,
  approvedAt: row.approved_at,
  checkoutId: row.checkout_id,
  customerKey: row.customer_key,
  landing: row.landing,
  referrer: row.referrer,
  gaSessionId: row.ga_session_id,
  utmSource: row.utm_source,
  utmMedium: row.utm_medium,
  utmCampaign: row.utm_campaign,
  utmTerm: row.utm_term,
  utmContent: row.utm_content,
  gclid: row.gclid,
  fbclid: row.fbclid,
  ttclid: row.ttclid,
  metadata: JSON.parse(row.metadata_json) as Record<string, unknown>,
  requestContext: JSON.parse(row.request_context_json) as AttributionLedgerEntry["requestContext"],
} as AttributionLedgerEntry & { entryId: string });

export const insertAttributionLedgerEntries = (entries: AttributionLedgerEntry[]) => {
  if (entries.length === 0) return 0;

  const db = getCrmDb();
  ensureAttributionLedgerSchema(db);

  const insert = db.prepare(`
    INSERT OR IGNORE INTO ${ATTRIBUTION_LEDGER_TABLE} (
      entry_id, touchpoint, capture_mode, payment_status, logged_at,
      order_id, payment_key, approved_at, checkout_id, customer_key,
      landing, referrer, ga_session_id, utm_source, utm_medium,
      utm_campaign, utm_term, utm_content, gclid, fbclid, ttclid,
      source, metadata_json, request_context_json
    ) VALUES (
      @entry_id, @touchpoint, @capture_mode, @payment_status, @logged_at,
      @order_id, @payment_key, @approved_at, @checkout_id, @customer_key,
      @landing, @referrer, @ga_session_id, @utm_source, @utm_medium,
      @utm_campaign, @utm_term, @utm_content, @gclid, @fbclid, @ttclid,
      @source, @metadata_json, @request_context_json
    )
  `);

  const runMany = db.transaction((items: AttributionLedgerEntry[]) => {
    let inserted = 0;
    for (const entry of items) {
      const result = insert.run({
        entry_id: buildAttributionLedgerEntryId(entry),
        touchpoint: entry.touchpoint,
        capture_mode: entry.captureMode,
        payment_status: entry.paymentStatus,
        logged_at: entry.loggedAt,
        order_id: entry.orderId,
        payment_key: entry.paymentKey,
        approved_at: entry.approvedAt,
        checkout_id: entry.checkoutId,
        customer_key: entry.customerKey,
        landing: entry.landing,
        referrer: entry.referrer,
        ga_session_id: entry.gaSessionId,
        utm_source: entry.utmSource,
        utm_medium: entry.utmMedium,
        utm_campaign: entry.utmCampaign,
        utm_term: entry.utmTerm,
        utm_content: entry.utmContent,
        gclid: entry.gclid,
        fbclid: entry.fbclid,
        ttclid: entry.ttclid,
        source: getSource(entry),
        metadata_json: JSON.stringify(entry.metadata ?? {}),
        request_context_json: JSON.stringify(entry.requestContext ?? {}),
      });
      inserted += Number(result.changes ?? 0);
    }
    return inserted;
  });

  return runMany(entries);
};

export const insertAttributionLedgerEntry = (entry: AttributionLedgerEntry) =>
  insertAttributionLedgerEntries([entry]);

export const updateAttributionLedgerEntries = (
  items: Array<{
    previousEntry: AttributionLedgerEntry;
    nextEntry: AttributionLedgerEntry;
  }>,
) => {
  if (items.length === 0) return 0;

  const db = getCrmDb();
  ensureAttributionLedgerSchema(db);

  const update = db.prepare(`
    UPDATE ${ATTRIBUTION_LEDGER_TABLE}
    SET
      touchpoint = @touchpoint,
      capture_mode = @capture_mode,
      payment_status = @payment_status,
      logged_at = @logged_at,
      order_id = @order_id,
      payment_key = @payment_key,
      approved_at = @approved_at,
      checkout_id = @checkout_id,
      customer_key = @customer_key,
      landing = @landing,
      referrer = @referrer,
      ga_session_id = @ga_session_id,
      utm_source = @utm_source,
      utm_medium = @utm_medium,
      utm_campaign = @utm_campaign,
      utm_term = @utm_term,
      utm_content = @utm_content,
      gclid = @gclid,
      fbclid = @fbclid,
      ttclid = @ttclid,
      source = @source,
      metadata_json = @metadata_json,
      request_context_json = @request_context_json
    WHERE entry_id = @entry_id
  `);

  const runMany = db.transaction(
    (
      updates: Array<{
        previousEntry: AttributionLedgerEntry;
        nextEntry: AttributionLedgerEntry;
      }>,
    ) => {
      let changed = 0;
      for (const item of updates) {
        const result = update.run({
          entry_id: buildAttributionLedgerEntryId(item.previousEntry),
          touchpoint: item.nextEntry.touchpoint,
          capture_mode: item.nextEntry.captureMode,
          payment_status: item.nextEntry.paymentStatus,
          logged_at: item.nextEntry.loggedAt,
          order_id: item.nextEntry.orderId,
          payment_key: item.nextEntry.paymentKey,
          approved_at: item.nextEntry.approvedAt,
          checkout_id: item.nextEntry.checkoutId,
          customer_key: item.nextEntry.customerKey,
          landing: item.nextEntry.landing,
          referrer: item.nextEntry.referrer,
          ga_session_id: item.nextEntry.gaSessionId,
          utm_source: item.nextEntry.utmSource,
          utm_medium: item.nextEntry.utmMedium,
          utm_campaign: item.nextEntry.utmCampaign,
          utm_term: item.nextEntry.utmTerm,
          utm_content: item.nextEntry.utmContent,
          gclid: item.nextEntry.gclid,
          fbclid: item.nextEntry.fbclid,
          ttclid: item.nextEntry.ttclid,
          source: getSource(item.nextEntry),
          metadata_json: JSON.stringify(item.nextEntry.metadata ?? {}),
          request_context_json: JSON.stringify(item.nextEntry.requestContext ?? {}),
        });
        changed += Number(result.changes ?? 0);
      }
      return changed;
    },
  );

  return runMany(items);
};

export const updateAttributionLedgerEntry = (
  previousEntry: AttributionLedgerEntry,
  nextEntry: AttributionLedgerEntry,
) => updateAttributionLedgerEntries([{ previousEntry, nextEntry }]);

export const listAttributionLedgerEntries = (): AttributionLedgerEntry[] => {
  const db = getCrmDb();
  ensureAttributionLedgerSchema(db);

  const rows = db.prepare(`
    SELECT
      entry_id, touchpoint, capture_mode, payment_status, logged_at,
      order_id, payment_key, approved_at, checkout_id, customer_key,
      landing, referrer, ga_session_id, utm_source, utm_medium,
      utm_campaign, utm_term, utm_content, gclid, fbclid, ttclid,
      source, metadata_json, request_context_json
    FROM ${ATTRIBUTION_LEDGER_TABLE}
    ORDER BY logged_at DESC, rowid DESC
  `).all() as AttributionLedgerRow[];

  return rows.map(dbRowToEntry);
};
