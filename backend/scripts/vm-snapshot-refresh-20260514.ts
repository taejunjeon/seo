/**
 * Y-1: one-shot VM attribution ledger snapshot refresh (Yellow Sprint A).
 *
 * Pull biocom_imweb + thecleancoffee_imweb ledger rows from att.ainativeos.net
 * → write to new SQLite file with same schema as vm-npay-intent-20260505.sqlite3
 * → atomic rename
 *
 * Read-only against operational DB. No mutation outside the new snapshot file.
 */
import Database from "better-sqlite3";
import * as fs from "node:fs";
import * as path from "node:path";

const BASE = "https://att.ainativeos.net";
const SOURCES = ["biocom_imweb", "thecleancoffee_imweb"];
const SINCE = "2026-03-29T00:00:00+09:00";
const UNTIL = "2026-05-14T00:00:00+09:00";

type Item = {
  entryId: string;
  touchpoint: string;
  captureMode?: string;
  paymentStatus?: string | null;
  loggedAt: string;
  orderId?: string;
  paymentKey?: string;
  approvedAt?: string;
  checkoutId?: string;
  customerKey?: string;
  landing?: string;
  referrer?: string;
  gaSessionId?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  gclid?: string;
  fbclid?: string;
  ttclid?: string;
  metadata?: Record<string, unknown>;
  requestContext?: Record<string, unknown>;
};

const LIMIT = 10000;
const MAX_RETRIES = 5;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// API offset 무시 — time-bucket 으로 분할 (7일씩) 해서 limit 안에 들어가게 한다.
const BUCKETS_KST = [
  ["2026-03-29T00:00:00+09:00", "2026-04-05T00:00:00+09:00"],
  ["2026-04-05T00:00:00+09:00", "2026-04-12T00:00:00+09:00"],
  ["2026-04-12T00:00:00+09:00", "2026-04-19T00:00:00+09:00"],
  ["2026-04-19T00:00:00+09:00", "2026-04-26T00:00:00+09:00"],
  ["2026-04-26T00:00:00+09:00", "2026-05-03T00:00:00+09:00"],
  ["2026-05-03T00:00:00+09:00", "2026-05-10T00:00:00+09:00"],
  ["2026-05-10T00:00:00+09:00", "2026-05-14T00:00:00+09:00"],
];

const fetchBucket = async (source: string, startAt: string, endAt: string): Promise<Item[]> => {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const url = new URL("/api/attribution/ledger", BASE);
      url.searchParams.set("source", source);
      url.searchParams.set("startAt", startAt);
      url.searchParams.set("endAt", endAt);
      url.searchParams.set("limit", String(LIMIT));
      const res = await fetch(url, { signal: AbortSignal.timeout(120000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = (await res.json()) as { items?: Item[]; summary?: { totalEntries?: number } };
      const items = j.items || [];
      const total = j.summary?.totalEntries ?? items.length;
      if (total > LIMIT) {
        console.log(`  WARN ${source} bucket ${startAt}~${endAt} totalEntries=${total} > LIMIT=${LIMIT} — 일부 누락 가능`);
      }
      return items;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log(`  retry ${attempt}/${MAX_RETRIES} ${source} ${startAt}: ${msg.slice(0, 80)}`);
      if (attempt === MAX_RETRIES) throw e;
      await sleep(2000 * attempt);
    }
  }
  return [];
};

const fetchAll = async (source: string): Promise<Item[]> => {
  const all: Item[] = [];
  const seen = new Set<string>();
  for (const [s, e] of BUCKETS_KST) {
    const items = await fetchBucket(source, s, e);
    let added = 0;
    for (const it of items) {
      if (it.entryId && !seen.has(it.entryId)) {
        seen.add(it.entryId);
        all.push(it);
        added++;
      }
    }
    console.log(`  ${source} bucket ${s.slice(0,10)}~${e.slice(0,10)}: got=${items.length} unique=${added} total=${all.length}`);
    await sleep(300);
  }
  return all;
};

const npayIntentFetch = async (): Promise<Array<Record<string, unknown>>> => {
  const all: Array<Record<string, unknown>> = [];
  let offset = 0;
  while (true) {
    const url = new URL("/api/attribution/npay-intent", BASE);
    url.searchParams.set("site", "biocom");
    url.searchParams.set("limit", String(PAGE));
    url.searchParams.set("offset", String(offset));
    const res = await fetch(url);
    if (!res.ok) {
      console.log(`  npay-intent HTTP ${res.status} — endpoint may differ. Try /api/npay/intents`);
      // fallback or skip
      break;
    }
    const j = (await res.json()) as { items?: Array<Record<string, unknown>> };
    const items = j.items || [];
    all.push(...items);
    console.log(`  npay-intent offset=${offset} got=${items.length} total=${all.length}`);
    if (items.length < PAGE) break;
    offset += PAGE;
  }
  return all;
};

const main = async () => {
  console.log("=== Y-1 snapshot refresh start ===");
  const tmp = "/tmp/vm-attribution-snapshot-20260514.sqlite3";
  if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
  const db = new Database(tmp);

  // schema (mirror vm-npay-intent-20260505.sqlite3 attribution_ledger / npay_intent_log)
  db.exec(`
    CREATE TABLE attribution_ledger (
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
      request_context_json TEXT NOT NULL DEFAULT '{}'
    );
    CREATE INDEX idx_attr_ledger_source ON attribution_ledger(source, touchpoint);
    CREATE INDEX idx_attr_ledger_logged ON attribution_ledger(logged_at);
    CREATE INDEX idx_attr_ledger_order ON attribution_ledger(order_id);

    CREATE TABLE npay_intent_log (
      id TEXT PRIMARY KEY,
      intent_key TEXT NOT NULL,
      site TEXT NOT NULL DEFAULT 'biocom',
      source TEXT NOT NULL DEFAULT 'gtm_118',
      environment TEXT NOT NULL DEFAULT 'unknown',
      match_status TEXT NOT NULL DEFAULT 'pending',
      captured_at TEXT NOT NULL,
      received_at TEXT NOT NULL,
      client_id TEXT DEFAULT '',
      ga_session_id TEXT DEFAULT '',
      gclid TEXT DEFAULT '',
      gbraid TEXT DEFAULT '',
      wbraid TEXT DEFAULT '',
      fbclid TEXT DEFAULT '',
      utm_source TEXT DEFAULT '',
      utm_medium TEXT DEFAULT '',
      utm_campaign TEXT DEFAULT '',
      page_location TEXT DEFAULT '',
      page_referrer TEXT DEFAULT '',
      matched_order_no TEXT DEFAULT ''
    );
  `);

  const ins = db.prepare(`INSERT OR REPLACE INTO attribution_ledger(
    entry_id, touchpoint, capture_mode, payment_status, logged_at,
    order_id, payment_key, approved_at, checkout_id, customer_key,
    landing, referrer, ga_session_id,
    utm_source, utm_medium, utm_campaign, utm_term, utm_content,
    gclid, fbclid, ttclid, source, metadata_json, request_context_json
  ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);

  const insMany = db.transaction((items: Item[], sourceName: string) => {
    for (const it of items) {
      ins.run(
        it.entryId, it.touchpoint, it.captureMode || "live",
        it.paymentStatus || null,
        it.loggedAt, it.orderId || "", it.paymentKey || "",
        it.approvedAt || "", it.checkoutId || "", it.customerKey || "",
        it.landing || "", it.referrer || "", it.gaSessionId || "",
        it.utmSource || "", it.utmMedium || "", it.utmCampaign || "",
        it.utmTerm || "", it.utmContent || "",
        it.gclid || "", it.fbclid || "", it.ttclid || "",
        sourceName,
        JSON.stringify(it.metadata || {}),
        JSON.stringify(it.requestContext || {}),
      );
    }
  });

  for (const source of SOURCES) {
    console.log(`Fetching ${source}...`);
    const items = await fetchAll(source);
    insMany(items, source);
    console.log(`  → inserted ${items.length} rows for ${source}`);
  }

  // Try to fetch npay_intent_log
  console.log("Fetching npay-intent...");
  try {
    const npayItems = await npayIntentFetch();
    if (npayItems.length > 0) {
      const npayIns = db.prepare(`INSERT OR REPLACE INTO npay_intent_log(
        id, intent_key, site, source, environment, match_status, captured_at, received_at,
        client_id, ga_session_id, gclid, gbraid, wbraid, fbclid,
        utm_source, utm_medium, utm_campaign,
        page_location, page_referrer, matched_order_no
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
      const npayMany = db.transaction((items: typeof npayItems) => {
        for (const it of items as Array<Record<string, unknown>>) {
          const s = (k: string) => (typeof it[k] === "string" ? (it[k] as string) : "");
          npayIns.run(
            s("id") || s("intentKey"), s("intentKey") || s("intent_key") || s("id"),
            s("site") || "biocom", s("source") || "gtm_118",
            s("environment") || "unknown", s("matchStatus") || s("match_status") || "pending",
            s("capturedAt") || s("captured_at"), s("receivedAt") || s("received_at"),
            s("clientId") || s("client_id"), s("gaSessionId") || s("ga_session_id"),
            s("gclid"), s("gbraid"), s("wbraid"), s("fbclid"),
            s("utmSource") || s("utm_source"), s("utmMedium") || s("utm_medium"),
            s("utmCampaign") || s("utm_campaign"),
            s("pageLocation") || s("page_location"),
            s("pageReferrer") || s("page_referrer"),
            s("matchedOrderNo") || s("matched_order_no"),
          );
        }
      });
      npayMany(npayItems);
      console.log(`  → inserted ${npayItems.length} npay_intent rows`);
    }
  } catch (e) {
    console.log(`  npay-intent fetch error: ${e instanceof Error ? e.message : e}`);
  }

  // Verify
  const ledgerCount = (db.prepare("SELECT COUNT(*) AS c FROM attribution_ledger").get() as { c: number }).c;
  const intentCount = (db.prepare("SELECT COUNT(*) AS c FROM npay_intent_log").get() as { c: number }).c;
  const maxLog = (db.prepare("SELECT MAX(logged_at) AS m FROM attribution_ledger").get() as { m: string }).m;
  const withGclid = (db.prepare("SELECT COUNT(*) AS c FROM attribution_ledger WHERE gclid <> '' AND source='biocom_imweb' AND touchpoint='payment_success' AND payment_status='confirmed' AND logged_at >= '2026-04-14' AND logged_at < '2026-05-14'").get() as { c: number }).c;
  const payConfirmed = (db.prepare("SELECT COUNT(*) AS c FROM attribution_ledger WHERE source='biocom_imweb' AND touchpoint='payment_success' AND payment_status='confirmed' AND logged_at >= '2026-04-14' AND logged_at < '2026-05-14'").get() as { c: number }).c;

  db.close();

  console.log(`\nSnapshot stats:
    attribution_ledger rows: ${ledgerCount}
    npay_intent_log rows: ${intentCount}
    max(logged_at): ${maxLog}
    last_30d biocom_imweb payment_success confirmed: ${payConfirmed}
    last_30d biocom_imweb payment_success confirmed with gclid: ${withGclid}
    gclid fill-rate: ${payConfirmed > 0 ? (withGclid / payConfirmed * 100).toFixed(2) : 'n/a'}%
  `);

  // atomic rename to final path (backend/data/)
  const target = path.resolve(__dirname, "..", "data", "vm-attribution-snapshot-20260514.sqlite3");
  const oldPath = path.resolve(__dirname, "..", "data", "vm-npay-intent-20260505.sqlite3");
  if (fs.existsSync(oldPath)) {
    console.log(`Old snapshot kept at: ${oldPath} (not mutated)`);
  }
  fs.renameSync(tmp, target);
  console.log(`\nNew snapshot written: ${target}`);
  console.log("✅ Y-1 snapshot refresh complete");
};

main().catch((e) => { console.error(e); process.exit(1); });
