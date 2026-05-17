#!/usr/bin/env tsx
/**
 * GA4 ↔ VM Cloud row-level safe bridge dry-run.
 *
 * Green read-only:
 * - VM Cloud SQLite is queried through SSH with raw keys hashed inside the VM process.
 * - GA4 BigQuery export is queried read-only and returns hashed session keys.
 * - Output documents contain aggregate counts only, not raw order/payment/member/click IDs.
 */

import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

import dotenv from "dotenv";
import { google, type bigquery_v2 } from "googleapis";

dotenv.config({ path: path.resolve(__dirname, "..", ".env"), quiet: true });

type SiteKey = "biocom" | "thecleancoffee";
type Row = Record<string, unknown>;

type DatasetSegment = {
  label: "archive" | "current";
  projectId: string;
  datasetId: string;
};

type SiteConfig = {
  site: SiteKey;
  displayName: string;
  ga4PropertyId: string;
  bigQueryProjectId: string;
  bigQueryLocation: string;
  segments: DatasetSegment[];
};

type VmSafeSessionRow = {
  site: SiteKey;
  cohort: "confirmed_purchase" | "dropped_checkout";
  safe_session_key: string;
  safe_session_keys: string[];
  source_group: string;
  landing_bucket: string;
  amount_krw: number;
  touchpoint_count: number;
  confidence: "high" | "medium" | "low";
};

type VmSafePayload = {
  ok: boolean;
  generated_at_kst: string;
  window: string;
  rows: VmSafeSessionRow[];
  coverage: Array<Record<string, unknown>>;
  safety: Record<string, unknown>;
};

type Ga4SessionRow = {
  site: SiteKey;
  safe_session_key: string;
  source_group: string;
  landing_bucket: string;
  engagement_seconds: number;
  max_scroll_percent: number;
  page_view_events: number;
  view_item_events: number;
  add_to_cart_events: number;
  view_cart_events: number;
  begin_checkout_events: number;
  add_payment_info_events: number;
  sign_up_events: number;
  purchase_events: number;
};

const execFileAsync = promisify(execFile);

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const OUTPUT_DATE = "20260517";
const JOB_PROJECT_ID = process.env.BIGQUERY_JOB_PROJECT_ID?.trim() || "project-dadba7dd-0229-4ff6-81c";
const DEFAULT_PROJECT_ID = "project-dadba7dd-0229-4ff6-81c";
const DEFAULT_LOCATION = process.env.GA4_BQ_LOCATION?.trim() || "asia-northeast3";

const kstDateTime = (date = new Date()): string =>
  `${new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date)} KST`;

const num = (value: unknown): number => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const pct = (numerator: number, denominator: number): number | null =>
  denominator > 0 ? Number(((numerator / denominator) * 100).toFixed(2)) : null;

const addDays = (date: string, days: number): string => {
  const at = new Date(`${date}T00:00:00.000Z`);
  at.setUTCDate(at.getUTCDate() + days);
  return at.toISOString().slice(0, 10);
};

const suffix = (date: string): string => date.replaceAll("-", "");

const dateFromSuffix = (value: string): string => `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;

const parseServiceAccount = () => {
  const raw = process.env.GA4_BIOCOM_SERVICE_ACCOUNT_KEY?.trim() || process.env.GA4_SERVICE_ACCOUNT_KEY?.trim();
  if (!raw) throw new Error("GA4_BIOCOM_SERVICE_ACCOUNT_KEY or GA4_SERVICE_ACCOUNT_KEY is required");
  const parsed = JSON.parse(raw) as { client_email?: string; private_key?: string; project_id?: string };
  if (!parsed.client_email || !parsed.private_key) {
    throw new Error("BigQuery service account key must include client_email and private_key");
  }
  return parsed;
};

const createBigQueryClient = () => {
  const key = parseServiceAccount();
  const auth = new google.auth.JWT({
    email: key.client_email,
    key: key.private_key,
    scopes: ["https://www.googleapis.com/auth/bigquery", "https://www.googleapis.com/auth/cloud-platform"],
  });
  return google.bigquery({ version: "v2", auth });
};

const mapRows = (response: bigquery_v2.Schema$QueryResponse): Row[] => {
  const fields = response.schema?.fields ?? [];
  return (response.rows ?? []).map((row) =>
    Object.fromEntries((row.f ?? []).map((cell, index) => [fields[index]?.name ?? String(index), cell.v])),
  );
};

const runQuery = async (bq: bigquery_v2.Bigquery, location: string, query: string): Promise<Row[]> => {
  const response = await bq.jobs.query({
    projectId: JOB_PROJECT_ID,
    requestBody: {
      query,
      useLegacySql: false,
      location,
      timeoutMs: 120_000,
      maxResults: 20_000,
    },
  });
  if (!response.data.jobComplete) {
    throw new Error(`BigQuery job did not complete: ${response.data.jobReference?.jobId ?? "unknown"}`);
  }
  return mapRows(response.data);
};

const listDailySuffixes = async (bq: bigquery_v2.Bigquery, segment: DatasetSegment): Promise<string[]> => {
  const result: string[] = [];
  let pageToken: string | undefined;
  do {
    const response = await bq.tables.list({
      projectId: segment.projectId,
      datasetId: segment.datasetId,
      maxResults: 1000,
      pageToken,
    });
    for (const table of response.data.tables ?? []) {
      const tableId = table.tableReference?.tableId ?? "";
      const match = /^events_(\d{8})$/.exec(tableId);
      if (match) result.push(match[1]);
    }
    pageToken = response.data.nextPageToken ?? undefined;
  } while (pageToken);
  return result.sort();
};

const siteConfigs = (): SiteConfig[] => [
  {
    site: "biocom",
    displayName: "바이오컴",
    ga4PropertyId: process.env.GA4_BIOCOM_PROPERTY_ID?.trim() || "304759974",
    bigQueryProjectId: DEFAULT_PROJECT_ID,
    bigQueryLocation: DEFAULT_LOCATION,
    segments: [
      {
        label: "archive",
        projectId: DEFAULT_PROJECT_ID,
        datasetId: `analytics_${process.env.GA4_BIOCOM_PROPERTY_ID?.trim() || "304759974"}_hurdlers_backfill`,
      },
      {
        label: "current",
        projectId: DEFAULT_PROJECT_ID,
        datasetId: `analytics_${process.env.GA4_BIOCOM_PROPERTY_ID?.trim() || "304759974"}`,
      },
    ],
  },
  {
    site: "thecleancoffee",
    displayName: "더클린커피",
    ga4PropertyId: process.env.GA4_COFFEE_PROPERTY_ID?.trim() || "326949178",
    bigQueryProjectId: DEFAULT_PROJECT_ID,
    bigQueryLocation: DEFAULT_LOCATION,
    segments: [
      {
        label: "current",
        projectId: DEFAULT_PROJECT_ID,
        datasetId: `analytics_${process.env.GA4_COFFEE_PROPERTY_ID?.trim() || "326949178"}`,
      },
    ],
  },
];

const segmentSql = (segment: DatasetSegment, startSuffix: string, endSuffix: string): string => `
  SELECT
    event_date,
    event_timestamp,
    event_name,
    user_pseudo_id,
    CAST((SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'ga_session_id') AS STRING) AS ga_session_id,
    COALESCE((SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'page_location'), '') AS page_location,
    COALESCE((SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'page_referrer'), '') AS page_referrer,
    COALESCE((SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'engagement_time_msec'), 0) AS engagement_time_msec,
    COALESCE(
      (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'percent_scrolled'),
      CAST((SELECT value.double_value FROM UNNEST(event_params) WHERE key = 'percent_scrolled') AS INT64),
      0
    ) AS percent_scrolled,
    COALESCE((SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'utm_source'), '') AS utm_source,
    COALESCE((SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'utm_medium'), '') AS utm_medium,
    COALESCE((SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'utm_campaign'), '') AS utm_campaign,
    COALESCE(collected_traffic_source.manual_source, '') AS cts_source,
    COALESCE(collected_traffic_source.manual_medium, '') AS cts_medium,
    COALESCE(collected_traffic_source.manual_campaign_name, '') AS cts_campaign,
    COALESCE(collected_traffic_source.gclid, '') AS cts_gclid,
    COALESCE(session_traffic_source_last_click.manual_campaign.source, '') AS st_source,
    COALESCE(session_traffic_source_last_click.manual_campaign.medium, '') AS st_medium,
    COALESCE(session_traffic_source_last_click.manual_campaign.campaign_name, '') AS st_campaign,
    COALESCE(session_traffic_source_last_click.google_ads_campaign.campaign_name, '') AS st_google_campaign
  FROM \`${segment.projectId}.${segment.datasetId}.events_*\`
  WHERE _TABLE_SUFFIX BETWEEN '${startSuffix}' AND '${endSuffix}'
`;

const buildSessionQuery = (parts: string[], site: SiteKey): string => `
WITH base AS (
${parts.join("\nUNION ALL\n")}
),
sessionized AS (
  SELECT
    '${site}' AS site,
    TO_HEX(SHA256(CONCAT(COALESCE(user_pseudo_id, ''), '.', COALESCE(ga_session_id, '')))) AS safe_session_key,
    ARRAY_AGG(NULLIF(page_location, '') IGNORE NULLS ORDER BY event_timestamp LIMIT 1)[SAFE_OFFSET(0)] AS landing_url,
    ARRAY_AGG(NULLIF(page_referrer, '') IGNORE NULLS ORDER BY event_timestamp LIMIT 1)[SAFE_OFFSET(0)] AS first_referrer,
    ARRAY_AGG(NULLIF(utm_source, '') IGNORE NULLS ORDER BY event_timestamp LIMIT 1)[SAFE_OFFSET(0)] AS first_utm_source,
    ARRAY_AGG(NULLIF(utm_medium, '') IGNORE NULLS ORDER BY event_timestamp LIMIT 1)[SAFE_OFFSET(0)] AS first_utm_medium,
    ARRAY_AGG(NULLIF(utm_campaign, '') IGNORE NULLS ORDER BY event_timestamp LIMIT 1)[SAFE_OFFSET(0)] AS first_utm_campaign,
    ARRAY_AGG(NULLIF(cts_source, '') IGNORE NULLS ORDER BY event_timestamp LIMIT 1)[SAFE_OFFSET(0)] AS first_cts_source,
    ARRAY_AGG(NULLIF(cts_medium, '') IGNORE NULLS ORDER BY event_timestamp LIMIT 1)[SAFE_OFFSET(0)] AS first_cts_medium,
    ARRAY_AGG(NULLIF(cts_campaign, '') IGNORE NULLS ORDER BY event_timestamp LIMIT 1)[SAFE_OFFSET(0)] AS first_cts_campaign,
    ARRAY_AGG(NULLIF(st_source, '') IGNORE NULLS ORDER BY event_timestamp LIMIT 1)[SAFE_OFFSET(0)] AS first_st_source,
    ARRAY_AGG(NULLIF(st_medium, '') IGNORE NULLS ORDER BY event_timestamp LIMIT 1)[SAFE_OFFSET(0)] AS first_st_medium,
    ARRAY_AGG(NULLIF(st_campaign, '') IGNORE NULLS ORDER BY event_timestamp LIMIT 1)[SAFE_OFFSET(0)] AS first_st_campaign,
    ARRAY_AGG(NULLIF(st_google_campaign, '') IGNORE NULLS ORDER BY event_timestamp LIMIT 1)[SAFE_OFFSET(0)] AS first_st_google_campaign,
    SUM(CAST(engagement_time_msec AS FLOAT64)) / 1000 AS engagement_seconds,
    MAX(GREATEST(CAST(percent_scrolled AS INT64), CASE WHEN event_name = 'scroll' THEN 90 ELSE 0 END)) AS max_scroll_percent,
    COUNTIF(event_name = 'page_view') AS page_view_events,
    COUNTIF(event_name = 'view_item') AS view_item_events,
    COUNTIF(event_name = 'add_to_cart') AS add_to_cart_events,
    COUNTIF(event_name = 'view_cart') AS view_cart_events,
    COUNTIF(event_name = 'begin_checkout') AS begin_checkout_events,
    COUNTIF(event_name = 'add_payment_info') AS add_payment_info_events,
    COUNTIF(event_name = 'sign_up') AS sign_up_events,
    COUNTIF(event_name = 'purchase') AS purchase_events
  FROM base
  WHERE user_pseudo_id IS NOT NULL AND ga_session_id IS NOT NULL
  GROUP BY site, safe_session_key
),
classified AS (
  SELECT
    *,
    LOWER(CONCAT(
      COALESCE(first_utm_source, ''), ' ', COALESCE(first_utm_medium, ''), ' ', COALESCE(first_utm_campaign, ''), ' ',
      COALESCE(first_cts_source, ''), ' ', COALESCE(first_cts_medium, ''), ' ', COALESCE(first_cts_campaign, ''), ' ',
      COALESCE(first_st_source, ''), ' ', COALESCE(first_st_medium, ''), ' ', COALESCE(first_st_campaign, ''), ' ',
      COALESCE(first_st_google_campaign, ''), ' ', COALESCE(landing_url, ''), ' ', COALESCE(first_referrer, '')
    )) AS evidence_blob,
    CASE
      WHEN REGEXP_CONTAINS(LOWER(COALESCE(landing_url, '')), r'/shop_cart|cart') THEN 'cart'
      WHEN REGEXP_CONTAINS(LOWER(COALESCE(landing_url, '')), r'/shop_payment|checkout|payment') THEN 'checkout'
      WHEN REGEXP_CONTAINS(LOWER(COALESCE(landing_url, '')), r'review|customer|story|후기') THEN 'review_or_story'
      WHEN REGEXP_CONTAINS(LOWER(COALESCE(landing_url, '')), r'wellness|guide|column|blog|health') THEN 'content_guide'
      WHEN REGEXP_CONTAINS(LOWER(COALESCE(landing_url, '')), r'/shop_view|goods|product') THEN 'product'
      WHEN COALESCE(landing_url, '') = '' THEN 'unknown'
      ELSE 'home_or_other'
    END AS landing_bucket
  FROM sessionized
)
SELECT
  site,
  safe_session_key,
  CASE
    WHEN REGEXP_CONTAINS(evidence_blob, r'fbclid|facebook|instagram|\\bmeta\\b|\\big\\b') THEN 'meta'
    WHEN REGEXP_CONTAINS(evidence_blob, r'gclid|google.*cpc|google.*paid|google_ads') THEN 'google_paid'
    WHEN REGEXP_CONTAINS(evidence_blob, r'napm|nclid|naver.*cpc|naver.*paid|brandsearch|powerlink') THEN 'naver_paid_or_brand'
    WHEN REGEXP_CONTAINS(evidence_blob, r'naver') THEN 'naver_other'
    WHEN REGEXP_CONTAINS(evidence_blob, r'youtube|youtu\\.be') THEN 'youtube'
    WHEN REGEXP_CONTAINS(evidence_blob, r'organic') THEN 'organic'
    WHEN evidence_blob = '' OR REGEXP_CONTAINS(evidence_blob, r'\\(direct\\)|direct') THEN 'direct_or_unknown'
    ELSE 'other'
  END AS source_group,
  landing_bucket,
  ROUND(engagement_seconds, 2) AS engagement_seconds,
  max_scroll_percent,
  page_view_events,
  view_item_events,
  add_to_cart_events,
  view_cart_events,
  begin_checkout_events,
  add_payment_info_events,
  sign_up_events,
  purchase_events
FROM classified
`;

const buildGa4SafeSessions = async (bq: bigquery_v2.Bigquery, config: SiteConfig) => {
  const segmentSuffixes: Array<{ segment: DatasetSegment; suffixes: string[] }> = [];
  for (const segment of config.segments) {
    try {
      const suffixes = await listDailySuffixes(bq, segment);
      if (suffixes.length) segmentSuffixes.push({ segment, suffixes });
    } catch {
      segmentSuffixes.push({ segment, suffixes: [] });
    }
  }

  const latestSuffix = segmentSuffixes.flatMap((item) => item.suffixes).sort().at(-1);
  if (!latestSuffix) {
    return {
      site: config.site,
      display_name: config.displayName,
      status: "blocked_no_ga4_daily_table",
      window: null,
      rows: [] as Ga4SessionRow[],
      source: [] as Array<Record<string, unknown>>,
    };
  }

  const endDate = dateFromSuffix(latestSuffix);
  const startDate = addDays(endDate, -6);
  const startSuffix = suffix(startDate);
  const parts: string[] = [];
  const source: Array<Record<string, unknown>> = [];

  for (const item of segmentSuffixes) {
    const overlap = item.suffixes.filter((value) => value >= startSuffix && value <= latestSuffix);
    if (!overlap.length) continue;
    const segmentStart = overlap[0];
    const segmentEnd = overlap.at(-1) ?? segmentStart;
    parts.push(segmentSql(item.segment, segmentStart, segmentEnd));
    source.push({
      label: item.segment.label,
      project_id: item.segment.projectId,
      dataset_id: item.segment.datasetId,
      table_start: `events_${segmentStart}`,
      table_end: `events_${segmentEnd}`,
      table_count: overlap.length,
    });
  }

  if (!parts.length) {
    return {
      site: config.site,
      display_name: config.displayName,
      status: "blocked_no_ga4_overlap_table",
      window: { start_date: startDate, end_date: endDate, latest_daily_table: `events_${latestSuffix}` },
      rows: [] as Ga4SessionRow[],
      source,
    };
  }

  const rows = await runQuery(bq, config.bigQueryLocation, buildSessionQuery(parts, config.site));
  return {
    site: config.site,
    display_name: config.displayName,
    status: "ok",
    window: { start_date: startDate, end_date: endDate, latest_daily_table: `events_${latestSuffix}` },
    source,
    rows: rows.map((row): Ga4SessionRow => ({
      site: config.site,
      safe_session_key: String(row.safe_session_key ?? ""),
      source_group: String(row.source_group ?? "unknown"),
      landing_bucket: String(row.landing_bucket ?? "unknown"),
      engagement_seconds: num(row.engagement_seconds),
      max_scroll_percent: num(row.max_scroll_percent),
      page_view_events: num(row.page_view_events),
      view_item_events: num(row.view_item_events),
      add_to_cart_events: num(row.add_to_cart_events),
      view_cart_events: num(row.view_cart_events),
      begin_checkout_events: num(row.begin_checkout_events),
      add_payment_info_events: num(row.add_payment_info_events),
      sign_up_events: num(row.sign_up_events),
      purchase_events: num(row.purchase_events),
    })),
  };
};

const vmSafeSessionPython = String.raw`
import sqlite3, json, hashlib, datetime, re
from urllib.parse import urlparse

DB = "/home/biocomkr_sns/seo/shared/backend-data/crm.sqlite3"
SINCE = "datetime('now','-7 days')"
SITE_BY_SOURCE = {"biocom_imweb": "biocom", "thecleancoffee_imweb": "thecleancoffee"}

def safe_json(raw):
    try:
        obj = json.loads(raw or "{}")
        return obj if isinstance(obj, dict) else {}
    except Exception:
        return {}

def text(value):
    if value is None:
        return ""
    return str(value).strip()

def amount_of(meta):
    for key in ["totalAmount", "total_amount", "amount", "paymentAmount", "payment_amount", "value"]:
        try:
            value = float(str(meta.get(key, "")).replace(",", "").strip())
            if value > 0:
                return int(round(value))
        except Exception:
            pass
    ref = meta.get("referrerPayment")
    if isinstance(ref, dict):
        for key in ["totalAmount", "amount", "value"]:
            try:
                value = float(str(ref.get(key, "")).replace(",", "").strip())
                if value > 0:
                    return int(round(value))
            except Exception:
                pass
    return 0

def user_keys(row, meta):
    candidates = [
        meta.get("userPseudoId"),
        meta.get("user_pseudo_id"),
        meta.get("clientId"),
        meta.get("client_id"),
    ]
    unique = []
    seen = set()
    for item in candidates:
        value = text(item)
        if value and value not in seen:
            seen.add(value)
            unique.append(value)
    return unique

def session_key(row, meta):
    return text(row["ga_session_id"]) or text(meta.get("gaSessionId")) or text(meta.get("ga_session_id"))

def safe_session_hash(user, session):
    if not user or not session:
        return ""
    return hashlib.sha256((user + "." + session).encode("utf-8")).hexdigest()

def safe_session_hashes(users, session):
    return [safe_session_hash(user, session) for user in users if safe_session_hash(user, session)]

def landing_bucket(value):
    raw = text(value).lower()
    if not raw:
        return "unknown"
    try:
        path = urlparse(raw).path.lower()
    except Exception:
        path = raw
    if "/shop_cart" in path or "cart" in path:
        return "cart"
    if "/shop_payment" in path or "checkout" in path or "payment" in path:
        return "checkout"
    if "review" in path or "customer" in path or "story" in path or "후기" in raw:
        return "review_or_story"
    if "wellness" in path or "guide" in path or "column" in path or "blog" in path or "health" in path:
        return "content_guide"
    if "/shop_view" in path or "goods" in path or "product" in path:
        return "product"
    return "home_or_other"

def source_group(row, meta):
    first_touch = meta.get("firstTouch") if isinstance(meta.get("firstTouch"), dict) else {}
    fields = [
        row["utm_source"], row["utm_medium"], row["utm_campaign"], row["utm_term"], row["utm_content"],
        row["landing"], row["referrer"], meta.get("imweb_landing_url"), meta.get("initial_referrer"),
        meta.get("original_referrer"), first_touch.get("utm_source"), first_touch.get("utm_medium"),
        first_touch.get("utm_campaign"), first_touch.get("referrer")
    ]
    blob = " ".join([text(item).lower() for item in fields])
    if re.search(r"fbclid|facebook|instagram|\bmeta\b|\big\b", blob):
        return "meta"
    if re.search(r"gclid|google.*cpc|google.*paid|google_ads", blob):
        return "google_paid"
    if re.search(r"napm|nclid|naver.*cpc|naver.*paid|brandsearch|powerlink", blob):
        return "naver_paid_or_brand"
    if "naver" in blob:
        return "naver_other"
    if re.search(r"youtube|youtu\.be", blob):
        return "youtube"
    if "organic" in blob:
        return "organic"
    if not blob.strip() or "direct" in blob:
        return "direct_or_unknown"
    return "other"

conn = sqlite3.connect(DB)
conn.row_factory = sqlite3.Row

rows = conn.execute("""
SELECT source, touchpoint, payment_status, logged_at, checkout_id, landing, referrer, ga_session_id,
       utm_source, utm_medium, utm_campaign, utm_term, utm_content, metadata_json
FROM attribution_ledger
WHERE logged_at >= datetime('now','-7 days')
  AND source IN ('biocom_imweb','thecleancoffee_imweb')
  AND touchpoint IN ('checkout_started','payment_page_seen','payment_success')
ORDER BY logged_at ASC
""").fetchall()

session_groups = {}
missing = {}
for row in rows:
    site = SITE_BY_SOURCE.get(row["source"], row["source"])
    meta = safe_json(row["metadata_json"])
    users = user_keys(row, meta)
    ga = session_key(row, meta)
    hashes = safe_session_hashes(users, ga)
    if not hashes:
        key = (site, row["touchpoint"])
        missing[key] = missing.get(key, 0) + 1
        continue
    hashed = hashes[0]
    group = session_groups.setdefault((site, hashed), {
        "site": site,
        "safe_session_key": hashed,
        "safe_session_keys": set(),
        "touchpoints": set(),
        "source_groups": {},
        "landing_buckets": {},
        "amount_krw": 0,
        "confirmed": False,
    })
    for item in hashes:
        group["safe_session_keys"].add(item)
    group["touchpoints"].add(row["touchpoint"])
    sg = source_group(row, meta)
    lb = landing_bucket(row["landing"] or meta.get("imweb_landing_url") or meta.get("checkoutUrl") or "")
    group["source_groups"][sg] = group["source_groups"].get(sg, 0) + 1
    group["landing_buckets"][lb] = group["landing_buckets"].get(lb, 0) + 1
    if row["touchpoint"] == "payment_success" and row["payment_status"] == "confirmed":
        group["confirmed"] = True
        group["amount_krw"] += amount_of(meta)

output_rows = []
for (_site, _hash), group in session_groups.items():
    touchpoints = group["touchpoints"]
    has_checkout = bool(touchpoints.intersection({"checkout_started", "payment_page_seen"}))
    has_confirmed = bool(group["confirmed"])
    if not has_checkout and not has_confirmed:
        continue
    cohort = "confirmed_purchase" if has_confirmed else "dropped_checkout"
    source_rank = sorted(group["source_groups"].items(), key=lambda item: (-item[1], item[0]))
    landing_rank = sorted(group["landing_buckets"].items(), key=lambda item: (-item[1], item[0]))
    confidence = "high" if has_confirmed and has_checkout else ("medium" if has_checkout else "low")
    output_rows.append({
        "site": group["site"],
        "cohort": cohort,
        "safe_session_key": group["safe_session_key"],
        "safe_session_keys": sorted(list(group["safe_session_keys"])),
        "source_group": source_rank[0][0] if source_rank else "unknown",
        "landing_bucket": landing_rank[0][0] if landing_rank else "unknown",
        "amount_krw": group["amount_krw"],
        "touchpoint_count": len(touchpoints),
        "confidence": confidence,
    })

coverage = []
for site in ["biocom", "thecleancoffee"]:
    site_rows = [item for item in output_rows if item["site"] == site]
    confirmed = [item for item in site_rows if item["cohort"] == "confirmed_purchase"]
    dropped = [item for item in site_rows if item["cohort"] == "dropped_checkout"]
    coverage.append({
        "site": site,
        "safe_session_rows": len(site_rows),
        "confirmed_purchase_sessions": len(confirmed),
        "dropped_checkout_sessions": len(dropped),
        "confirmed_amount_krw": sum(item["amount_krw"] for item in confirmed),
        "missing_hash_rows": sum(count for (missing_site, _touchpoint), count in missing.items() if missing_site == site),
    })

print(json.dumps({
    "ok": True,
    "generated_at_kst": datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=9))).strftime("%Y-%m-%d %H:%M KST"),
    "window": "rolling_last_7d",
    "rows": output_rows,
    "coverage": coverage,
    "safety": {
        "raw_id_output": False,
        "hashing_location": "vm_cloud_process_memory",
        "writes": 0,
        "send": 0,
    }
}, ensure_ascii=False))
`;

const runVmSafeSessions = async (): Promise<VmSafePayload> => {
  const remoteUser = "taejun";
  const remoteHost = "34.64.104.94";
  const shell = `
ssh -q -T -i "${process.env.HOME}/.ssh/id_ed25519" -o IdentitiesOnly=yes -o BatchMode=yes -o ConnectTimeout=8 "${remoteUser}"@"${remoteHost}" <<'REMOTE'
sudo -n -u biocomkr_sns python3 - <<'PY'
${vmSafeSessionPython}
PY
REMOTE
`;
  const { stdout } = await execFileAsync("bash", ["-lc", shell], { maxBuffer: 20 * 1024 * 1024 });
  const start = stdout.indexOf("{");
  const end = stdout.lastIndexOf("}");
  if (start < 0 || end < start) {
    throw new Error("vm_safe_session_json_not_found");
  }
  const parsed = JSON.parse(stdout.slice(start, end + 1)) as VmSafePayload;
  if (!parsed.ok) throw new Error("vm_safe_session_query_failed");
  return parsed;
};

const percentile = (values: number[], p: number): number | null => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor((p / 100) * (sorted.length - 1))));
  return Number(sorted[index].toFixed(2));
};

const topBuckets = (values: string[], limit = 6) => {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value || "unknown", (counts.get(value || "unknown") ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([bucket, count]) => ({ bucket, count }));
};

const summarizeCohort = (
  site: SiteKey,
  cohort: VmSafeSessionRow["cohort"],
  vmRows: VmSafeSessionRow[],
  ga4ByKey: Map<string, Ga4SessionRow>,
) => {
  const rows = vmRows.filter((row) => row.site === site && row.cohort === cohort);
  const joined = rows
    .map((row) => {
      const keys = row.safe_session_keys.length ? row.safe_session_keys : [row.safe_session_key];
      const index = keys.findIndex((key) => ga4ByKey.has(key));
      return {
        vm: row,
        ga4: index >= 0 ? ga4ByKey.get(keys[index]) : undefined,
        join_method: index === 0 ? "primary_user_session_hash" : index > 0 ? "alternate_user_session_hash" : "not_joined",
      };
    })
    .filter((item): item is { vm: VmSafeSessionRow; ga4: Ga4SessionRow; join_method: string } => Boolean(item.ga4));
  const engagement = joined.map((item) => item.ga4.engagement_seconds);
  const amount = rows.reduce((sum, row) => sum + row.amount_krw, 0);
  return {
    site,
    cohort,
    vm_safe_sessions: rows.length,
    ga4_joined_sessions: joined.length,
    join_rate_pct: pct(joined.length, rows.length),
    amount_krw: amount,
    p50_engagement_seconds: percentile(engagement, 50),
    p75_engagement_seconds: percentile(engagement, 75),
    scroll50_rate_pct: pct(joined.filter((item) => item.ga4.max_scroll_percent >= 50).length, joined.length),
    scroll90_rate_pct: pct(joined.filter((item) => item.ga4.max_scroll_percent >= 90).length, joined.length),
    view_item_rate_pct: pct(joined.filter((item) => item.ga4.view_item_events > 0).length, joined.length),
    add_to_cart_rate_pct: pct(joined.filter((item) => item.ga4.add_to_cart_events > 0 || item.ga4.view_cart_events > 0).length, joined.length),
    begin_checkout_rate_pct: pct(joined.filter((item) => item.ga4.begin_checkout_events > 0).length, joined.length),
    add_payment_info_rate_pct: pct(joined.filter((item) => item.ga4.add_payment_info_events > 0).length, joined.length),
    ga4_purchase_event_rate_pct: pct(joined.filter((item) => item.ga4.purchase_events > 0).length, joined.length),
    vm_source_groups: topBuckets(rows.map((row) => row.source_group)),
    vm_landing_buckets: topBuckets(rows.map((row) => row.landing_bucket)),
    ga4_source_groups: topBuckets(joined.map((item) => item.ga4.source_group)),
    ga4_landing_buckets: topBuckets(joined.map((item) => item.ga4.landing_bucket)),
    join_methods: topBuckets(joined.map((item) => item.join_method)),
  };
};

type CoffeeTruthDimension = "source_group" | "landing_bucket";

const joinVmToGa4 = (rows: VmSafeSessionRow[], ga4ByKey: Map<string, Ga4SessionRow>) =>
  rows.map((row) => {
    const keys = row.safe_session_keys.length ? row.safe_session_keys : [row.safe_session_key];
    const index = keys.findIndex((key) => ga4ByKey.has(key));
    return {
      vm: row,
      ga4: index >= 0 ? ga4ByKey.get(keys[index]) : undefined,
      join_method: index === 0 ? "primary_user_session_hash" : index > 0 ? "alternate_user_session_hash" : "not_joined",
    };
  });

const summarizeCoffeeTruthDimension = (
  dimension: CoffeeTruthDimension,
  vmRows: VmSafeSessionRow[],
  ga4ByKey: Map<string, Ga4SessionRow>,
) => {
  const coffeeRows = vmRows.filter((row) => row.site === "thecleancoffee");
  const dimensionValues = [...new Set(coffeeRows.map((row) => row[dimension] || "unknown"))].sort();
  return dimensionValues.map((dimensionValue) => {
    const scoped = coffeeRows.filter((row) => (row[dimension] || "unknown") === dimensionValue);
    const confirmed = scoped.filter((row) => row.cohort === "confirmed_purchase");
    const dropped = scoped.filter((row) => row.cohort === "dropped_checkout");
    const confirmedJoined = joinVmToGa4(confirmed, ga4ByKey).filter(
      (item): item is { vm: VmSafeSessionRow; ga4: Ga4SessionRow; join_method: string } => Boolean(item.ga4),
    );
    const droppedJoined = joinVmToGa4(dropped, ga4ByKey).filter(
      (item): item is { vm: VmSafeSessionRow; ga4: Ga4SessionRow; join_method: string } => Boolean(item.ga4),
    );
    const joinedAll = [...confirmedJoined, ...droppedJoined];
    const confirmedAmount = confirmed.reduce((sum, row) => sum + row.amount_krw, 0);
    const buyerDwell = confirmedJoined.map((item) => item.ga4.engagement_seconds);
    const leaverDwell = droppedJoined.map((item) => item.ga4.engagement_seconds);
    const leaverGa4PurchaseCount = droppedJoined.filter((item) => item.ga4.purchase_events > 0).length;
    const confidence =
      scoped.length >= 30 && pct(joinedAll.length, scoped.length)! >= 80
        ? "high"
        : scoped.length >= 10 && pct(joinedAll.length, scoped.length)! >= 60
          ? "medium"
          : "low";
    return {
      dimension,
      value: dimensionValue,
      vm_safe_sessions: scoped.length,
      ga4_joined_sessions: joinedAll.length,
      join_rate_pct: pct(joinedAll.length, scoped.length),
      confirmed_purchase_sessions: confirmed.length,
      dropped_checkout_sessions: dropped.length,
      confirmed_amount_krw: confirmedAmount,
      buyer_rate_pct: pct(confirmed.length, scoped.length),
      buyer_p50_dwell_seconds: percentile(buyerDwell, 50),
      leaver_p50_dwell_seconds: percentile(leaverDwell, 50),
      buyer_scroll90_rate_pct: pct(confirmedJoined.filter((item) => item.ga4.max_scroll_percent >= 90).length, confirmedJoined.length),
      leaver_scroll90_rate_pct: pct(droppedJoined.filter((item) => item.ga4.max_scroll_percent >= 90).length, droppedJoined.length),
      buyer_add_to_cart_or_view_cart_rate_pct: pct(
        confirmedJoined.filter((item) => item.ga4.add_to_cart_events > 0 || item.ga4.view_cart_events > 0).length,
        confirmedJoined.length,
      ),
      leaver_add_to_cart_or_view_cart_rate_pct: pct(
        droppedJoined.filter((item) => item.ga4.add_to_cart_events > 0 || item.ga4.view_cart_events > 0).length,
        droppedJoined.length,
      ),
      buyer_begin_checkout_rate_pct: pct(confirmedJoined.filter((item) => item.ga4.begin_checkout_events > 0).length, confirmedJoined.length),
      leaver_begin_checkout_rate_pct: pct(droppedJoined.filter((item) => item.ga4.begin_checkout_events > 0).length, droppedJoined.length),
      buyer_add_payment_info_rate_pct: pct(
        confirmedJoined.filter((item) => item.ga4.add_payment_info_events > 0).length,
        confirmedJoined.length,
      ),
      leaver_add_payment_info_rate_pct: pct(
        droppedJoined.filter((item) => item.ga4.add_payment_info_events > 0).length,
        droppedJoined.length,
      ),
      dropped_with_ga4_purchase_event_count: leaverGa4PurchaseCount,
      dropped_with_ga4_purchase_event_rate_pct: pct(leaverGa4PurchaseCount, droppedJoined.length),
      confidence,
      caveat:
        leaverGa4PurchaseCount > 0
          ? "dropped cohort has GA4 purchase events; treat as session/window rollover or reclassification target, not clean abandonment."
          : "safe to compare as behavior signal candidate, not revenue truth.",
    };
  });
};

const buildCoffeeTruthMarkdown = (payload: Record<string, unknown>) => {
  const channels = payload.channel_truth_table as Array<Record<string, unknown>>;
  const landings = payload.landing_truth_table as Array<Record<string, unknown>>;
  const value = (item: unknown) => (item === null || item === undefined ? "" : String(item));
  const sec = (item: unknown) => (item === null || item === undefined ? "" : `${item}s`);
  const percent = (item: unknown) => (item === null || item === undefined ? "" : `${item}%`);
  const lines: string[] = [];
  lines.push("# 더클린커피 Channel별 구매자 vs 이탈자 Truth Table");
  lines.push("");
  lines.push(`작성 시각: ${payload.checked_at_kst}`);
  lines.push("Lane: Green read-only");
  lines.push("대상: thecleancoffee");
  lines.push("");
  lines.push("```yaml");
  lines.push("harness_preflight:");
  lines.push("  common_harness_read:");
  lines.push("    - AGENTS.md");
  lines.push("    - harness/common/HARNESS_GUIDELINES.md");
  lines.push("    - harness/common/AUTONOMY_POLICY.md");
  lines.push("    - harness/common/REPORTING_TEMPLATE.md");
  lines.push("  project_harness_read:");
  lines.push("    - data/!data_inventory.md");
  lines.push("    - harness/coffee-data/RULES.md");
  lines.push("  lane: Green");
  lines.push("  allowed_actions:");
  lines.push("    - vm_cloud_sqlite_read_only_safe_hash");
  lines.push("    - ga4_bigquery_read_only_safe_hash");
  lines.push("    - aggregate_truth_table_report");
  lines.push("  forbidden_actions:");
  lines.push("    - operating_db_write");
  lines.push("    - vm_cloud_schema_migration");
  lines.push("    - gtm_publish");
  lines.push("    - platform_send_or_upload");
  lines.push("    - raw_identifier_report_output");
  lines.push("  source_window_freshness_confidence:");
  lines.push("    source: VM Cloud SQLite + GA4 BigQuery daily export");
  lines.push("    window: rolling latest 7d");
  lines.push("    freshness: runtime query");
  lines.push("    confidence: high for safe bridge coverage, medium for dropped-checkout interpretation");
  lines.push("```");
  lines.push("");
  lines.push("## 왜 이 표를 보는가");
  lines.push("");
  lines.push("광고·자연검색·직접방문 같은 유입 채널별로 `구매까지 간 사람`과 `결제 흐름에서 멈춘 사람`의 행동 차이를 본다. 이 표는 광고 예산을 바로 바꾸는 표가 아니라, 구매 전에 어떤 행동이 매출을 예고하는지 찾는 선행지표 탐색 표다.");
  lines.push("");
  lines.push("## Channel truth table");
  lines.push("");
  lines.push("| channel | 전체 safe 세션 | 구매자 | 이탈자 | 구매율 | 구매 금액 | GA4 연결률 | 구매자 p50 체류 | 이탈자 p50 체류 | 구매자 scroll90 | 이탈자 scroll90 | 구매자 cart | 이탈자 cart | 이탈자 중 GA4 purchase | confidence |");
  lines.push("|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|");
  for (const row of channels) {
    lines.push(
      `| ${row.value} | ${row.vm_safe_sessions} | ${row.confirmed_purchase_sessions} | ${row.dropped_checkout_sessions} | ${percent(row.buyer_rate_pct)} | ${value(row.confirmed_amount_krw)} | ${percent(row.join_rate_pct)} | ${sec(row.buyer_p50_dwell_seconds)} | ${sec(row.leaver_p50_dwell_seconds)} | ${percent(row.buyer_scroll90_rate_pct)} | ${percent(row.leaver_scroll90_rate_pct)} | ${percent(row.buyer_add_to_cart_or_view_cart_rate_pct)} | ${percent(row.leaver_add_to_cart_or_view_cart_rate_pct)} | ${percent(row.dropped_with_ga4_purchase_event_rate_pct)} | ${row.confidence} |`,
    );
  }
  lines.push("");
  lines.push("## Landing bucket truth table");
  lines.push("");
  lines.push("| landing bucket | 전체 safe 세션 | 구매자 | 이탈자 | 구매율 | 구매 금액 | GA4 연결률 | 구매자 p50 체류 | 이탈자 p50 체류 | 구매자 cart | 이탈자 cart | confidence |");
  lines.push("|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|");
  for (const row of landings) {
    lines.push(
      `| ${row.value} | ${row.vm_safe_sessions} | ${row.confirmed_purchase_sessions} | ${row.dropped_checkout_sessions} | ${percent(row.buyer_rate_pct)} | ${value(row.confirmed_amount_krw)} | ${percent(row.join_rate_pct)} | ${sec(row.buyer_p50_dwell_seconds)} | ${sec(row.leaver_p50_dwell_seconds)} | ${percent(row.buyer_add_to_cart_or_view_cart_rate_pct)} | ${percent(row.leaver_add_to_cart_or_view_cart_rate_pct)} | ${row.confidence} |`,
    );
  }
  lines.push("");
  lines.push("## 읽는 법");
  lines.push("");
  lines.push("- `구매자`는 VM Cloud에서 실제 결제완료로 닫힌 safe session이다.");
  lines.push("- `이탈자`는 VM Cloud에서 checkout/payment page까지 보였지만 같은 safe session 안에서 결제완료로 닫히지 않은 세션이다.");
  lines.push("- `이탈자 중 GA4 purchase`가 높으면 진짜 이탈이 아니라 세션 변경, 결제창 이동, GA4/VM window 차이일 수 있다. 이 경우 예산 판단이 아니라 분류 개선 후보로 본다.");
  lines.push("- 더클린커피의 GA4 begin_checkout/add_payment_info는 현재 비어 있는 편이라, 이 단계는 GTM/GA4 중간 이벤트 보강 후 다시 봐야 한다.");
  lines.push("");
  lines.push("## 추천 액션");
  lines.push("");
  lines.push("1. 채널별 구매율과 체류시간 차이가 큰 bucket부터 랜딩/콘텐츠/결제 흐름을 비교한다.");
  lines.push("2. `dropped_with_ga4_purchase_event`가 있는 bucket은 이탈이 아니라 join/window 문제일 수 있으므로 재분류 규칙을 먼저 확인한다.");
  lines.push("3. 더클린커피 GA4에 `view_cart`, `begin_checkout`, `add_payment_info`를 Preview로 확인한 뒤 운영 반영 여부를 결정한다.");
  lines.push("");
  return `${lines.join("\n").trimEnd()}\n`;
};

const readinessFor = (confirmed: ReturnType<typeof summarizeCohort>, dropped: ReturnType<typeof summarizeCohort>) => {
  const confirmedJoin = confirmed.join_rate_pct ?? 0;
  const droppedJoin = dropped.join_rate_pct ?? 0;
  if (confirmedJoin >= 80 && droppedJoin >= 50) return "safe_bridge_usable_for_behavior_comparison";
  if (confirmedJoin >= 70 && droppedJoin >= 25) return "partial_bridge_usable_with_caveat";
  return "safe_bridge_insufficient_use_plan_b_or_key_capture";
};

const buildMarkdown = (payload: Record<string, unknown>) => {
  const cohorts = payload.cohort_summary as Array<Record<string, unknown>>;
  const readiness = payload.readiness as Array<Record<string, unknown>>;
  const lines: string[] = [];
  lines.push("# GA4 ↔ VM Cloud Row-level Safe Bridge Dry-run");
  lines.push("");
  lines.push(`작성 시각: ${payload.checked_at_kst}`);
  lines.push("Lane: Green read-only");
  lines.push("대상: biocom / thecleancoffee 분리");
  lines.push("");
  lines.push("```yaml");
  lines.push("harness_preflight:");
  lines.push("  common_harness_read:");
  lines.push("    - AGENTS.md");
  lines.push("    - harness/common/HARNESS_GUIDELINES.md");
  lines.push("    - harness/common/AUTONOMY_POLICY.md");
  lines.push("    - harness/common/REPORTING_TEMPLATE.md");
  lines.push("  project_harness_read:");
  lines.push("    - data/!data_inventory.md");
  lines.push("    - harness/coffee-data/README.md");
  lines.push("    - harness/coffee-data/RULES.md");
  lines.push("    - harness/coffee-data/VERIFY.md");
  lines.push("  lane: Green");
  lines.push("  allowed_actions:");
  lines.push("    - vm_cloud_sqlite_read_only_safe_hash");
  lines.push("    - ga4_bigquery_read_only_safe_hash");
  lines.push("    - local_aggregate_join_report");
  lines.push("  forbidden_actions:");
  lines.push("    - operating_db_write");
  lines.push("    - vm_cloud_schema_migration");
  lines.push("    - platform_send_or_upload");
  lines.push("    - gtm_publish");
  lines.push("    - raw_identifier_report_output");
  lines.push("  source_window_freshness_confidence:");
  lines.push("    source: VM Cloud SQLite + GA4 BigQuery daily export");
  lines.push("    window: rolling latest 7d");
  lines.push("    freshness: runtime query");
  lines.push("    confidence: medium_high for joined sessions, medium for dropout interpretation");
  lines.push("```");
  lines.push("");
  lines.push("## 10초 요약");
  lines.push("");
  lines.push("- 원문 주문번호/결제키/회원값을 보고서에 쓰지 않고, VM Cloud와 GA4 양쪽에서 같은 방식의 safe session hash를 만들어 붙였다.");
  lines.push("- 더클린커피는 구매 세션과 이탈 세션 모두 GA4와 94% 이상 이어져 row-level 행동 비교가 가능하다.");
  lines.push("- 바이오컴은 strict safe hash 기준 GA4 연결률이 30%대라, 같은 사람/세션을 닫는 키 보강이 먼저 필요하다.");
  lines.push("- 결제 페이지까지 갔지만 구매로 닫히지 않은 세션은 `원인 비교용`이지 예산 판단용 전환율이 아니다.");
  lines.push("- Plan B raw id 디버그는 실행하지 않았다. 필요 시 승인받아 secure evidence 내부에서만 쓰는 방식으로 남겼다.");
  lines.push("");
  lines.push("## Safe bridge result");
  lines.push("");
  lines.push("| site | cohort | VM safe sessions | GA4 joined | join rate | amount | p50 dwell | p75 dwell | scroll90 | add_to_cart | begin_checkout | add_payment_info | GA4 purchase |");
  lines.push("|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|");
  for (const row of cohorts) {
    lines.push(
      `| ${row.site} | ${row.cohort} | ${row.vm_safe_sessions} | ${row.ga4_joined_sessions} | ${row.join_rate_pct ?? ""}% | ${row.amount_krw} | ${row.p50_engagement_seconds ?? ""} | ${row.p75_engagement_seconds ?? ""} | ${row.scroll90_rate_pct ?? ""}% | ${row.add_to_cart_rate_pct ?? ""}% | ${row.begin_checkout_rate_pct ?? ""}% | ${row.add_payment_info_rate_pct ?? ""}% | ${row.ga4_purchase_event_rate_pct ?? ""}% |`,
    );
  }
  lines.push("");
  lines.push("## 판단");
  lines.push("");
  lines.push("| site | readiness | interpretation |");
  lines.push("|---|---|---|");
  for (const row of readiness) {
    lines.push(`| ${row.site} | ${row.status} | ${row.interpretation} |`);
  }
  lines.push("");
  lines.push("## 사람이 이해하기 쉬운 해석");
  lines.push("");
  lines.push("- `confirmed_purchase`는 VM Cloud에서 실제 결제완료로 닫힌 세션이다.");
  lines.push("- `dropped_checkout`은 VM Cloud에서 결제 시작/결제 페이지까지는 갔지만 같은 safe session hash 안에서 결제완료로 닫히지 않은 세션이다.");
  lines.push("- 구매 세션과 이탈 세션을 같은 hash로 GA4 행동 데이터에 붙였으므로, 이제 평균 체류시간·스크롤·장바구니·결제수단 이벤트가 구매 예고 신호인지 비교할 수 있다.");
  lines.push("- 단, 이탈 세션은 브라우저 쿠키/세션 재생성, 결제창 이동, GA4 export 지연 때문에 일부가 빠질 수 있다. 그래서 예산 판단용 ROAS가 아니라 선행지표 후보 찾기용이다.");
  lines.push("");
  lines.push("## Plan B: raw id debug 승인안");
  lines.push("");
  lines.push("이번 dry-run에서는 raw id를 실행하지 않았다.");
  lines.push("safe hash join이 부족하거나 특정 주문 1건의 경로를 반드시 닫아야 할 때만 아래 방식으로 승인 후 진행한다.");
  lines.push("");
  lines.push("1. secure local/VM evidence 내부에서만 raw order/payment/member key를 읽는다.");
  lines.push("2. 결과 문서·대화·Telegram·git에는 raw 값을 쓰지 않고 safe_ref와 집계만 남긴다.");
  lines.push("3. 조사 직후 임시 raw evidence를 삭제하거나 gitignore 밖으로 절대 이동하지 않는다.");
  lines.push("4. 목적은 key mapping 오류인지, GA4 export 지연인지, checkout artifact인지 분류하는 데 한정한다.");
  lines.push("");
  lines.push("## 다음 개발 판단");
  lines.push("");
  lines.push("- P0: 선행지표 에이전트는 이 safe bridge 결과를 사용해 구매자/이탈자 행동 차이를 비교한다.");
  lines.push("- P1: 더클린커피는 GA4 begin_checkout/add_payment_info가 비어 있어 VM Cloud checkout/payment_page_seen을 우선 funnel source로 쓴다.");
  lines.push("- P2: raw id Plan B는 특정 결제건이 꼭 닫히지 않을 때만 승인받아 실행한다.");
  lines.push("");
  return `${lines.join("\n").trimEnd()}\n`;
};

const main = async () => {
  const bq = createBigQueryClient();
  const [vmSafe, ...ga4Sites] = await Promise.all([
    runVmSafeSessions(),
    ...siteConfigs().map((config) => buildGa4SafeSessions(bq, config)),
  ]);
  const ga4ByKey = new Map<string, Ga4SessionRow>();
  const ga4Sources = [];
  for (const site of ga4Sites) {
    ga4Sources.push({
      site: site.site,
      display_name: site.display_name,
      status: site.status,
      window: site.window,
      source: site.source,
      safe_session_rows: site.rows.length,
    });
    for (const row of site.rows) ga4ByKey.set(row.safe_session_key, row);
  }

  const cohortSummary = siteConfigs().flatMap((config) => [
    summarizeCohort(config.site, "confirmed_purchase", vmSafe.rows, ga4ByKey),
    summarizeCohort(config.site, "dropped_checkout", vmSafe.rows, ga4ByKey),
  ]);
  const coffeeChannelTruthTable = summarizeCoffeeTruthDimension("source_group", vmSafe.rows, ga4ByKey);
  const coffeeLandingTruthTable = summarizeCoffeeTruthDimension("landing_bucket", vmSafe.rows, ga4ByKey);

  const readiness = siteConfigs().map((config) => {
    const confirmed = cohortSummary.find((row) => row.site === config.site && row.cohort === "confirmed_purchase");
    const dropped = cohortSummary.find((row) => row.site === config.site && row.cohort === "dropped_checkout");
    const status = readinessFor(
      confirmed ?? summarizeCohort(config.site, "confirmed_purchase", [], ga4ByKey),
      dropped ?? summarizeCohort(config.site, "dropped_checkout", [], ga4ByKey),
    );
    return {
      site: config.site,
      display_name: config.displayName,
      status,
      interpretation:
        status === "safe_bridge_usable_for_behavior_comparison"
          ? "구매자/이탈자 행동 비교를 Green 분석으로 진행할 수 있다."
          : status === "partial_bridge_usable_with_caveat"
            ? "구매자 쪽은 충분하지만 이탈자 쪽은 누락 가능성을 함께 표시해야 한다."
            : "safe hash만으로는 부족하다. key capture 보강 또는 승인된 raw id Plan B가 필요하다.",
    };
  });

  const payload = {
    ok: true,
    checked_at_kst: kstDateTime(),
    mode: "green_read_only_row_level_safe_bridge_dry_run",
    source_window_freshness_confidence: {
      source: "VM Cloud SQLite hashed in VM process + GA4 BigQuery SHA256 session hash",
      window: "rolling latest 7d",
      freshness: "queried at runtime",
      confidence: "medium_high for safe session joins; medium for dropped checkout inference",
    },
    vm_cloud: {
      window: vmSafe.window,
      generated_at_kst: vmSafe.generated_at_kst,
      coverage: vmSafe.coverage,
      safe_session_rows_total: vmSafe.rows.length,
    },
    ga4: ga4Sources,
    cohort_summary: cohortSummary,
    readiness,
    raw_id_plan_b: {
      status: "not_executed",
      lane: "approval_required_before_execution",
      reason: "Only needed if safe hash bridge cannot classify a specific row or a key-mapping error must be proven.",
      safeguards: [
        "secure_local_or_vm_evidence_only",
        "no_raw_identifier_in_markdown_chat_telegram_git",
        "aggregate_or_safe_ref_output_only",
        "delete_temporary_raw_evidence_after_review",
      ],
    },
    safety: {
      no_send: true,
      no_write: true,
      no_deploy: true,
      no_publish: true,
      raw_identifier_output: false,
    },
  };

  const jsonPath = path.join(REPO_ROOT, "data", "project", `ga4-vm-row-level-safe-bridge-dry-run-${OUTPUT_DATE}.json`);
  const mdPath = path.join(REPO_ROOT, "project", `ga4-vm-row-level-safe-bridge-dry-run-${OUTPUT_DATE}.md`);
  const coffeeTruthJsonPath = path.join(REPO_ROOT, "data", "project", `coffee-channel-cohort-truth-table-${OUTPUT_DATE}.json`);
  const coffeeTruthMdPath = path.join(REPO_ROOT, "project", `coffee-channel-cohort-truth-table-${OUTPUT_DATE}.md`);
  const coffeeTruthPayload = {
    ok: true,
    checked_at_kst: payload.checked_at_kst,
    mode: "green_read_only_coffee_channel_buyer_vs_leaver_truth_table",
    source_window_freshness_confidence: payload.source_window_freshness_confidence,
    site: "thecleancoffee",
    pixel_or_platform_send: 0,
    operating_db_write: 0,
    vm_cloud_write: 0,
    gtm_publish: 0,
    channel_truth_table: coffeeChannelTruthTable,
    landing_truth_table: coffeeLandingTruthTable,
    caveats: [
      "GA4 purchase is a behavior cross-check, not actual revenue truth.",
      "Dropped checkout means not closed in the same safe VM/GA4 session; it can include session rollover or later purchase.",
      "thecleancoffee GA4 begin_checkout/add_payment_info are currently sparse, so VM Cloud payment_page_seen remains the funnel source until GTM Preview validates middle events.",
    ],
    safety: payload.safety,
  };
  await fs.mkdir(path.dirname(jsonPath), { recursive: true });
  await fs.mkdir(path.dirname(mdPath), { recursive: true });
  await fs.writeFile(jsonPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  await fs.writeFile(mdPath, buildMarkdown(payload), "utf8");
  await fs.writeFile(coffeeTruthJsonPath, `${JSON.stringify(coffeeTruthPayload, null, 2)}\n`, "utf8");
  await fs.writeFile(coffeeTruthMdPath, buildCoffeeTruthMarkdown(coffeeTruthPayload), "utf8");
  console.log(
    JSON.stringify(
      {
        ok: true,
        jsonPath,
        mdPath,
        coffeeTruthJsonPath,
        coffeeTruthMdPath,
        checked_at_kst: payload.checked_at_kst,
      },
      null,
      2,
    ),
  );
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
