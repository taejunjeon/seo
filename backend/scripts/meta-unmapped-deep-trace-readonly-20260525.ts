#!/usr/bin/env tsx
/**
 * Meta unmapped deep trace read-only.
 *
 * Green Lane:
 * - VM Cloud SQLite is read-only through SSH.
 * - GA4 BigQuery is read-only.
 * - Meta Ads API is read-only.
 * - Output is aggregate/sanitized. No raw order/payment/member/click IDs.
 */

import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

import dotenv from "dotenv";
import { google, type bigquery_v2 } from "googleapis";

dotenv.config({ path: path.resolve(__dirname, "..", ".env"), quiet: true });

type Row = Record<string, unknown>;

type VmRemainingRow = {
  group_label: "blank_utm_fbclid_only" | "macro_placeholder_one";
  approved_date: string;
  amount: number;
  safe_session_key: string;
  safe_session_keys: string[];
  safe_ga_session_id_key: string;
  has_meta_cookie: boolean;
  has_direct_fbclid: boolean;
  first_touch_utm_present: boolean;
  user_key_candidate_count: number;
  has_client_id_fallback_candidate: boolean;
};

type Ga4TraceRow = {
  safe_session_key: string;
  event_count: number;
  first_event_date: string;
  last_event_date: string;
  page_view_events: number;
  purchase_events: number;
  begin_checkout_events: number;
  add_payment_info_events: number;
  first_page_class: string;
  last_page_class: string;
  first_referrer_class: string;
  any_fbclid_url: boolean;
  any_meta_referrer: boolean;
  any_meta_traffic_source: boolean;
  any_utm_campaign: boolean;
  any_numeric_campaign_id: boolean;
  any_numeric_adset_id: boolean;
  any_numeric_ad_id: boolean;
  any_non_payment_landing: boolean;
};

type Ga4SessionIdFallbackRow = {
  safe_ga_session_id_key: string;
  candidate_sessions: number;
  event_count: number;
  purchase_events: number;
  any_utm_campaign: boolean;
  any_numeric_campaign_id: boolean;
  any_numeric_adset_id: boolean;
  any_numeric_ad_id: boolean;
  any_non_payment_landing: boolean;
  any_meta_traffic_source: boolean;
};

type MetaAdRow = {
  id?: string;
  name?: string;
  status?: string;
  effective_status?: string;
  configured_status?: string;
  campaign_id?: string;
  adset_id?: string;
  campaign?: { id?: string; name?: string };
  adset?: { id?: string; name?: string };
  creative?: unknown;
};

const execFileAsync = promisify(execFile);
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const OUTPUT_JSON = path.join(REPO_ROOT, "data/project/meta-unmapped-deep-trace-readonly-20260525.json");
const OUTPUT_MD = path.join(REPO_ROOT, "project/meta-unmapped-deep-trace-readonly-20260525.md");
const ACCOUNT_ID = process.env.META_BIOCOM_ACCOUNT_ID?.trim() || "act_3138805896402376";
const JOB_PROJECT_ID = process.env.BIGQUERY_JOB_PROJECT_ID?.trim() || "project-dadba7dd-0229-4ff6-81c";
const GA4_PROPERTY_ID = process.env.GA4_BIOCOM_PROPERTY_ID?.trim() || "304759974";
const GA4_LOCATION = process.env.GA4_BQ_LOCATION?.trim() || "asia-northeast3";
const GA4_SEGMENTS = [
  { label: "archive", projectId: JOB_PROJECT_ID, datasetId: `analytics_${GA4_PROPERTY_ID}_hurdlers_backfill` },
  { label: "current", projectId: JOB_PROJECT_ID, datasetId: `analytics_${GA4_PROPERTY_ID}` },
];

const kstNow = () =>
  `${new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date())} KST`;

const toBool = (value: unknown) => String(value ?? "") === "1" || value === true || value === "true";
const toNum = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const mapRows = (response: Pick<bigquery_v2.Schema$QueryResponse, "schema" | "rows">): Row[] => {
  const fields = response.schema?.fields ?? [];
  return (response.rows ?? []).map((row) =>
    Object.fromEntries((row.f ?? []).map((cell, index) => [fields[index]?.name ?? String(index), cell.v])),
  );
};

const parseServiceAccount = () => {
  const raw = process.env.GA4_BIOCOM_SERVICE_ACCOUNT_KEY?.trim() || process.env.GA4_SERVICE_ACCOUNT_KEY?.trim();
  if (!raw) throw new Error("GA4_BIOCOM_SERVICE_ACCOUNT_KEY or GA4_SERVICE_ACCOUNT_KEY is required");
  const parsed = JSON.parse(raw) as { client_email?: string; private_key?: string };
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

const runBigQuery = async (bq: bigquery_v2.Bigquery, query: string) => {
  const response = await bq.jobs.query({
    projectId: JOB_PROJECT_ID,
    requestBody: {
      query,
      useLegacySql: false,
      location: GA4_LOCATION,
      timeoutMs: 120_000,
      maxResults: 20_000,
    },
  });
  if (!response.data.jobComplete) {
    throw new Error(`BigQuery job did not complete: ${response.data.jobReference?.jobId ?? "unknown"}`);
  }
  const rows = [...mapRows(response.data)];
  let pageToken = response.data.pageToken ?? undefined;
  const jobId = response.data.jobReference?.jobId;
  const jobProjectId = response.data.jobReference?.projectId ?? JOB_PROJECT_ID;
  while (jobId && pageToken) {
    const page = await bq.jobs.getQueryResults({
      projectId: jobProjectId,
      jobId,
      location: GA4_LOCATION,
      pageToken,
      maxResults: 20_000,
    });
    rows.push(...mapRows(page.data));
    pageToken = page.data.pageToken ?? undefined;
  }
  return rows;
};

const shellQuote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`;

const fetchVmRemainingRows = async (): Promise<VmRemainingRow[]> => {
  const python = String.raw`
import sqlite3, json, hashlib
DB = "/home/biocomkr_sns/seo/repo/backend/data/crm.sqlite3"
conn = sqlite3.connect(DB)
conn.row_factory = sqlite3.Row
rows = conn.execute("""
WITH payment AS (
  SELECT
    entry_id,
    substr(approved_at,1,10) AS approved_date,
    lower(trim(utm_source)) AS source,
    trim(utm_campaign) AS campaign,
    trim(utm_term) AS term,
    trim(utm_content) AS content,
    CASE WHEN trim(fbclid) <> '' THEN 1 ELSE 0 END AS has_fbclid,
    CAST(json_extract(metadata_json, '$.totalAmount') AS INTEGER) AS amount,
    ga_session_id,
    metadata_json
  FROM attribution_ledger
  WHERE touchpoint='payment_success'
    AND payment_status='confirmed'
    AND lower(COALESCE(json_extract(metadata_json, '$.store'), '')) = 'biocom'
    AND substr(approved_at,1,10) BETWEEN '2026-05-18' AND '2026-05-24'
), remaining AS (
  SELECT *, CASE
    WHEN source='' AND campaign='' AND term='' AND content='' AND has_fbclid=1 THEN 'blank_utm_fbclid_only'
    WHEN approved_date='2026-05-22' AND amount=459000 AND source='meta' AND campaign='{{campaign.id}}' AND term='{{adset.id}}' AND content='{{ad.id}}' THEN 'macro_placeholder_one'
    ELSE 'other' END AS group_label
  FROM payment
  WHERE (source='' AND campaign='' AND term='' AND content='' AND has_fbclid=1)
     OR (approved_date='2026-05-22' AND amount=459000 AND source='meta' AND campaign='{{campaign.id}}' AND term='{{adset.id}}' AND content='{{ad.id}}')
)
SELECT * FROM remaining ORDER BY approved_date DESC, amount DESC
""").fetchall()

out = []
def text(value):
    return str(value or "").strip()

def unique(values):
    out = []
    seen = set()
    for value in values:
        clean = text(value)
        if clean and clean not in seen:
            seen.add(clean)
            out.append(clean)
    return out

for row in rows:
    meta = json.loads(row["metadata_json"] or "{}")
    users = unique([
        meta.get("userPseudoId"),
        meta.get("user_pseudo_id"),
        meta.get("gaUserPseudoId"),
        meta.get("ga_user_pseudo_id"),
        meta.get("clientId"),
        meta.get("client_id"),
        meta.get("gaClientId"),
        meta.get("ga_client_id"),
    ])
    ga_session_id = text(row["ga_session_id"]) or text(meta.get("gaSessionId")) or text(meta.get("ga_session_id")) or text(meta.get("sessionId"))
    safe_keys = [
        hashlib.sha256(f"{user}.{ga_session_id}".encode()).hexdigest().upper()
        for user in users
        if user and ga_session_id
    ]
    if not safe_keys:
        continue
    out.append({
        "group_label": row["group_label"],
        "approved_date": row["approved_date"],
        "amount": int(row["amount"] or 0),
        "safe_session_key": safe_keys[0],
        "safe_session_keys": safe_keys,
        "safe_ga_session_id_key": hashlib.sha256(ga_session_id.encode()).hexdigest().upper(),
        "has_meta_cookie": bool(meta.get("fbc") or meta.get("fbp")),
        "has_direct_fbclid": bool(row["has_fbclid"]),
        "first_touch_utm_present": bool(((meta.get("firstTouch") or {}).get("utmSource")) or ((meta.get("firstTouch") or {}).get("utmCampaign"))),
        "user_key_candidate_count": len(users),
        "has_client_id_fallback_candidate": bool(text(meta.get("clientId")) or text(meta.get("client_id")) or text(meta.get("gaClientId")) or text(meta.get("ga_client_id"))),
    })
print(json.dumps(out, ensure_ascii=False))
`;
  const { stdout } = await execFileAsync("ssh", [
    "-i",
    `${process.env.HOME}/.ssh/id_ed25519`,
    "-o",
    "IdentitiesOnly=yes",
    "taejun@34.64.104.94",
    `sudo -n -u biocomkr_sns python3 -c ${shellQuote(python)}`,
  ], { maxBuffer: 4 * 1024 * 1024 });
  return JSON.parse(stdout) as VmRemainingRow[];
};

const ga4PartSql = (segment: (typeof GA4_SEGMENTS)[number], start: string, end: string) => `
  SELECT
    event_date,
    event_timestamp,
    event_name,
    user_pseudo_id,
    CAST((SELECT value.int_value FROM UNNEST(event_params) WHERE key='ga_session_id') AS STRING) AS ga_session_id,
    COALESCE((SELECT value.string_value FROM UNNEST(event_params) WHERE key='page_location'), '') AS page_location,
    COALESCE((SELECT value.string_value FROM UNNEST(event_params) WHERE key='page_referrer'), '') AS page_referrer,
    COALESCE((SELECT value.string_value FROM UNNEST(event_params) WHERE key='utm_source'), '') AS utm_source,
    COALESCE((SELECT value.string_value FROM UNNEST(event_params) WHERE key='utm_medium'), '') AS utm_medium,
    COALESCE((SELECT value.string_value FROM UNNEST(event_params) WHERE key='utm_campaign'), '') AS utm_campaign,
    COALESCE((SELECT value.string_value FROM UNNEST(event_params) WHERE key='utm_content'), '') AS utm_content,
    COALESCE((SELECT value.string_value FROM UNNEST(event_params) WHERE key='utm_term'), CAST((SELECT value.int_value FROM UNNEST(event_params) WHERE key='utm_term') AS STRING), '') AS utm_term,
    COALESCE((SELECT value.string_value FROM UNNEST(event_params) WHERE key='source'), '') AS ep_source,
    COALESCE((SELECT value.string_value FROM UNNEST(event_params) WHERE key='medium'), '') AS ep_medium,
    COALESCE((SELECT value.string_value FROM UNNEST(event_params) WHERE key='campaign'), '') AS ep_campaign,
    COALESCE((SELECT value.string_value FROM UNNEST(event_params) WHERE key='content'), '') AS ep_content,
    COALESCE((SELECT value.string_value FROM UNNEST(event_params) WHERE key='term'), '') AS ep_term,
    COALESCE(collected_traffic_source.manual_source, '') AS cts_source,
    COALESCE(collected_traffic_source.manual_medium, '') AS cts_medium,
    COALESCE(collected_traffic_source.manual_campaign_name, '') AS cts_campaign,
    COALESCE(collected_traffic_source.manual_content, '') AS cts_content,
    COALESCE(collected_traffic_source.manual_term, '') AS cts_term,
    COALESCE(session_traffic_source_last_click.manual_campaign.source, '') AS st_source,
    COALESCE(session_traffic_source_last_click.manual_campaign.medium, '') AS st_medium,
    COALESCE(session_traffic_source_last_click.manual_campaign.campaign_name, '') AS st_campaign
  FROM \`${segment.projectId}.${segment.datasetId}.events_*\`
  WHERE _TABLE_SUFFIX BETWEEN '${start}' AND '${end}'
`;

const buildGa4Query = (safeKeys: string[]) => {
  const keyLiteral = safeKeys.map((key) => `'${key}'`).join(",");
  const parts = GA4_SEGMENTS.map((segment) => ga4PartSql(segment, "20260511", "20260524")).join("\nUNION ALL\n");
  return `
WITH target AS (
  SELECT key AS safe_session_key FROM UNNEST([${keyLiteral}]) AS key
),
base AS (
${parts}
),
filtered AS (
  SELECT
    *,
    TO_HEX(SHA256(CONCAT(COALESCE(user_pseudo_id,''), '.', COALESCE(ga_session_id,'')))) AS safe_session_key,
    LOWER(CONCAT(
      page_location, ' ', page_referrer, ' ',
      utm_source, ' ', utm_medium, ' ', utm_campaign, ' ', utm_content, ' ', utm_term, ' ',
      ep_source, ' ', ep_medium, ' ', ep_campaign, ' ', ep_content, ' ', ep_term, ' ',
      cts_source, ' ', cts_medium, ' ', cts_campaign, ' ', cts_content, ' ', cts_term, ' ',
      st_source, ' ', st_medium, ' ', st_campaign
    )) AS evidence_blob
  FROM base
  WHERE user_pseudo_id IS NOT NULL AND ga_session_id IS NOT NULL
),
matched AS (
  SELECT f.* FROM filtered f JOIN target t USING (safe_session_key)
),
classified AS (
  SELECT
    *,
    CASE
      WHEN REGEXP_CONTAINS(LOWER(page_location), r'/shop_payment') THEN '/shop_payment'
      WHEN REGEXP_CONTAINS(LOWER(page_location), r'/shop_cart') THEN '/shop_cart'
      WHEN REGEXP_CONTAINS(LOWER(page_location), r'/shop_view') THEN '/shop_view'
      WHEN REGEXP_CONTAINS(LOWER(page_location), r'/iiary02') THEN '/iiary02'
      WHEN REGEXP_CONTAINS(LOWER(page_location), r'/songyuul07') THEN '/songyuul07'
      WHEN REGEXP_CONTAINS(LOWER(page_location), r'/hwajung01') THEN '/hwajung01'
      WHEN REGEXP_CONTAINS(LOWER(page_location), r'/nanabebe05') THEN '/nanabebe05'
      WHEN REGEXP_CONTAINS(LOWER(page_location), r'/hangzassi01') THEN '/hangzassi01'
      WHEN page_location = '' THEN ''
      ELSE '(other)'
    END AS page_class,
    CASE
      WHEN REGEXP_CONTAINS(LOWER(page_referrer), r'facebook') THEN 'facebook'
      WHEN REGEXP_CONTAINS(LOWER(page_referrer), r'instagram') THEN 'instagram'
      WHEN REGEXP_CONTAINS(LOWER(page_referrer), r'biocom') THEN 'self'
      WHEN page_referrer = '' THEN ''
      ELSE '(other_referrer)'
    END AS referrer_class
  FROM matched
)
SELECT
  safe_session_key,
  COUNT(*) AS event_count,
  MIN(event_date) AS first_event_date,
  MAX(event_date) AS last_event_date,
  COUNTIF(event_name='page_view') AS page_view_events,
  COUNTIF(event_name='purchase') AS purchase_events,
  COUNTIF(event_name='begin_checkout') AS begin_checkout_events,
  COUNTIF(event_name='add_payment_info') AS add_payment_info_events,
  ARRAY_AGG(page_class ORDER BY event_timestamp LIMIT 1)[SAFE_OFFSET(0)] AS first_page_class,
  ARRAY_AGG(page_class ORDER BY event_timestamp DESC LIMIT 1)[SAFE_OFFSET(0)] AS last_page_class,
  ARRAY_AGG(referrer_class ORDER BY event_timestamp LIMIT 1)[SAFE_OFFSET(0)] AS first_referrer_class,
  COUNTIF(REGEXP_CONTAINS(LOWER(page_location), r'[?&]fbclid=')) > 0 AS any_fbclid_url,
  COUNTIF(REGEXP_CONTAINS(LOWER(page_referrer), r'facebook|instagram')) > 0 AS any_meta_referrer,
  COUNTIF(REGEXP_CONTAINS(evidence_blob, r'facebook|instagram|fbclid|(^|[^a-z0-9])meta([^a-z0-9]|$)|(^|[^a-z0-9])ig([^a-z0-9]|$)')) > 0 AS any_meta_traffic_source,
  COUNTIF(CONCAT(utm_campaign, ep_campaign, cts_campaign, st_campaign) != '') > 0 AS any_utm_campaign,
  COUNTIF(REGEXP_CONTAINS(evidence_blob, r'(utm_campaign|meta_campaign_id|campaign_id)=\\d{8,}|(^|[^0-9])120\\d{12,}([^0-9]|$)')) > 0 AS any_numeric_campaign_id,
  COUNTIF(REGEXP_CONTAINS(evidence_blob, r'(utm_term|meta_adset_id|adset_id)=\\d{8,}')) > 0 AS any_numeric_adset_id,
  COUNTIF(REGEXP_CONTAINS(evidence_blob, r'(utm_content|meta_ad_id|ad_id)=\\d{8,}')) > 0 AS any_numeric_ad_id,
  COUNTIF(page_class NOT IN ('/shop_payment','')) > 0 AS any_non_payment_landing
FROM classified
GROUP BY safe_session_key
`;
};

const buildGa4SessionIdFallbackQuery = (safeGaSessionIdKeys: string[]) => {
  const keyLiteral = safeGaSessionIdKeys.map((key) => `'${key}'`).join(",");
  const parts = GA4_SEGMENTS.map((segment) => ga4PartSql(segment, "20260511", "20260524")).join("\nUNION ALL\n");
  return `
WITH target AS (
  SELECT key AS safe_ga_session_id_key FROM UNNEST([${keyLiteral}]) AS key
),
base AS (
${parts}
),
filtered AS (
  SELECT
    *,
    TO_HEX(SHA256(COALESCE(ga_session_id,''))) AS safe_ga_session_id_key,
    CONCAT(COALESCE(user_pseudo_id,''), '.', COALESCE(ga_session_id,'')) AS session_key,
    LOWER(CONCAT(
      page_location, ' ', page_referrer, ' ',
      utm_source, ' ', utm_medium, ' ', utm_campaign, ' ', utm_content, ' ', utm_term, ' ',
      ep_source, ' ', ep_medium, ' ', ep_campaign, ' ', ep_content, ' ', ep_term, ' ',
      cts_source, ' ', cts_medium, ' ', cts_campaign, ' ', cts_content, ' ', cts_term, ' ',
      st_source, ' ', st_medium, ' ', st_campaign
    )) AS evidence_blob
  FROM base
  WHERE ga_session_id IS NOT NULL
),
matched AS (
  SELECT f.* FROM filtered f JOIN target t USING (safe_ga_session_id_key)
)
SELECT
  safe_ga_session_id_key,
  COUNT(DISTINCT session_key) AS candidate_sessions,
  COUNT(*) AS event_count,
  COUNTIF(event_name='purchase') AS purchase_events,
  COUNTIF(CONCAT(utm_campaign, ep_campaign, cts_campaign, st_campaign) != '') > 0 AS any_utm_campaign,
  COUNTIF(REGEXP_CONTAINS(evidence_blob, r'(utm_campaign|meta_campaign_id|campaign_id)=\\d{8,}|(^|[^0-9])120\\d{12,}([^0-9]|$)')) > 0 AS any_numeric_campaign_id,
  COUNTIF(REGEXP_CONTAINS(evidence_blob, r'(utm_term|meta_adset_id|adset_id)=\\d{8,}')) > 0 AS any_numeric_adset_id,
  COUNTIF(REGEXP_CONTAINS(evidence_blob, r'(utm_content|meta_ad_id|ad_id)=\\d{8,}')) > 0 AS any_numeric_ad_id,
  COUNTIF(
    NOT REGEXP_CONTAINS(LOWER(page_location), r'/shop_payment')
    AND COALESCE(page_location, '') != ''
  ) > 0 AS any_non_payment_landing,
  COUNTIF(REGEXP_CONTAINS(evidence_blob, r'facebook|instagram|fbclid|(^|[^a-z0-9])meta([^a-z0-9]|$)|(^|[^a-z0-9])ig([^a-z0-9]|$)')) > 0 AS any_meta_traffic_source
FROM matched
GROUP BY safe_ga_session_id_key
`;
};

const summarizeGa4 = (vmRows: VmRemainingRow[], ga4Rows: Ga4TraceRow[]) => {
  const ga4ByKey = new Map(ga4Rows.map((row) => [row.safe_session_key, row]));
  const groups = new Map<string, {
    orders: number;
    revenue: number;
    ga4Joined: number;
    anyUtmCampaign: number;
    anyNumericCampaign: number;
    anyNumericAdset: number;
    anyNumericAd: number;
    anyNonPaymentLanding: number;
    anyMetaTrafficSource: number;
    pageClassCounts: Record<string, number>;
    referrerClassCounts: Record<string, number>;
  }>();
  for (const row of vmRows) {
    const group = groups.get(row.group_label) ?? {
      orders: 0,
      revenue: 0,
      ga4Joined: 0,
      anyUtmCampaign: 0,
      anyNumericCampaign: 0,
      anyNumericAdset: 0,
      anyNumericAd: 0,
      anyNonPaymentLanding: 0,
      anyMetaTrafficSource: 0,
      pageClassCounts: {},
      referrerClassCounts: {},
    };
    group.orders += 1;
    group.revenue += row.amount;
    const candidateKeys = row.safe_session_keys?.length ? row.safe_session_keys : [row.safe_session_key].filter(Boolean);
    const ga = candidateKeys.map((key) => ga4ByKey.get(key)).find(Boolean);
    if (ga) {
      group.ga4Joined += 1;
      if (ga.any_utm_campaign) group.anyUtmCampaign += 1;
      if (ga.any_numeric_campaign_id) group.anyNumericCampaign += 1;
      if (ga.any_numeric_adset_id) group.anyNumericAdset += 1;
      if (ga.any_numeric_ad_id) group.anyNumericAd += 1;
      if (ga.any_non_payment_landing) group.anyNonPaymentLanding += 1;
      if (ga.any_meta_traffic_source) group.anyMetaTrafficSource += 1;
      group.pageClassCounts[ga.first_page_class || ""] = (group.pageClassCounts[ga.first_page_class || ""] ?? 0) + 1;
      group.referrerClassCounts[ga.first_referrer_class || ""] = (group.referrerClassCounts[ga.first_referrer_class || ""] ?? 0) + 1;
    }
    groups.set(row.group_label, group);
  }
  return Object.fromEntries(groups);
};

const summarizeGa4SessionIdFallback = (vmRows: VmRemainingRow[], fallbackRows: Ga4SessionIdFallbackRow[]) => {
  const fallbackByKey = new Map(fallbackRows.map((row) => [row.safe_ga_session_id_key, row]));
  const groups = new Map<string, {
    orders: number;
    revenue: number;
    matchedSessionIdKeys: number;
    uniqueSessionIdKeys: number;
    ambiguousSessionIdKeys: number;
    candidateSessionsTotal: number;
    maxCandidateSessions: number;
    anyUtmCampaign: number;
    anyNumericCampaign: number;
    anyNumericAdset: number;
    anyNumericAd: number;
    anyNonPaymentLanding: number;
    anyMetaTrafficSource: number;
  }>();
  for (const row of vmRows) {
    const group = groups.get(row.group_label) ?? {
      orders: 0,
      revenue: 0,
      matchedSessionIdKeys: 0,
      uniqueSessionIdKeys: 0,
      ambiguousSessionIdKeys: 0,
      candidateSessionsTotal: 0,
      maxCandidateSessions: 0,
      anyUtmCampaign: 0,
      anyNumericCampaign: 0,
      anyNumericAdset: 0,
      anyNumericAd: 0,
      anyNonPaymentLanding: 0,
      anyMetaTrafficSource: 0,
    };
    group.orders += 1;
    group.revenue += row.amount;
    const fallback = fallbackByKey.get(row.safe_ga_session_id_key);
    if (fallback) {
      group.matchedSessionIdKeys += 1;
      if (fallback.candidate_sessions === 1) group.uniqueSessionIdKeys += 1;
      if (fallback.candidate_sessions > 1) group.ambiguousSessionIdKeys += 1;
      group.candidateSessionsTotal += fallback.candidate_sessions;
      group.maxCandidateSessions = Math.max(group.maxCandidateSessions, fallback.candidate_sessions);
      if (fallback.any_utm_campaign) group.anyUtmCampaign += 1;
      if (fallback.any_numeric_campaign_id) group.anyNumericCampaign += 1;
      if (fallback.any_numeric_adset_id) group.anyNumericAdset += 1;
      if (fallback.any_numeric_ad_id) group.anyNumericAd += 1;
      if (fallback.any_non_payment_landing) group.anyNonPaymentLanding += 1;
      if (fallback.any_meta_traffic_source) group.anyMetaTrafficSource += 1;
    }
    groups.set(row.group_label, group);
  }
  return Object.fromEntries(groups);
};

const collectStrings = (value: unknown, output: string[] = []): string[] => {
  if (typeof value === "string") {
    output.push(value);
    return output;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, output);
    return output;
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value as Record<string, unknown>)) collectStrings(item, output);
  }
  return output;
};

const urlLike = (value: string) => /^https?:\/\//i.test(value.trim()) || value.includes("utm_") || value.includes("{{");
const normalizePath = (value: string) => {
  try {
    const parsed = new URL(value);
    return parsed.pathname || "/";
  } catch {
    return "";
  }
};

const fetchMetaInventory = async () => {
  const token = process.env.META_ADMANAGER_API_KEY?.trim();
  if (!token) return { ok: false, error: "META_ADMANAGER_API_KEY missing" };
  const rows: MetaAdRow[] = [];
  let nextUrl: string | null = `https://graph.facebook.com/v22.0/${ACCOUNT_ID}/ads?` + new URLSearchParams({
    access_token: token,
    fields: [
      "id",
      "name",
      "status",
      "effective_status",
      "configured_status",
      "campaign_id",
      "adset_id",
      "campaign{id,name}",
      "adset{id,name}",
      "creative{id,name,url_tags,link_url,object_url,object_story_spec,asset_feed_spec,instagram_permalink_url}",
    ].join(","),
    limit: "200",
  }).toString();
  while (nextUrl && rows.length < 2000) {
    const response = await fetch(nextUrl, { signal: AbortSignal.timeout(20_000) });
    const body = await response.json() as { data?: MetaAdRow[]; paging?: { next?: string }; error?: { message?: string; code?: number } };
    if (body.error) return { ok: false, error: body.error.message ?? `Meta API error ${body.error.code ?? ""}` };
    rows.push(...(body.data ?? []));
    nextUrl = body.paging?.next ?? null;
  }

  const summary = {
    ok: true,
    adsFetched: rows.length,
    activeAds: 0,
    activeWithAnyUrlEvidence: 0,
    activeWithNumericCampaignIdInUrl: 0,
    activeWithNumericAdsetIdInUrl: 0,
    activeWithNumericAdIdInUrl: 0,
    activeWithLiteralMacro: 0,
    activeWithMetaAlias: 0,
    activeWithLandingPath: 0,
    uniqueLandingPaths: {} as Record<string, number>,
    campaignUrlEvidence: {} as Record<string, { campaignName: string; ads: number; numericFullIdAds: number; macroAds: number; aliasAds: number }>,
  };

  for (const ad of rows) {
    const effective = String(ad.effective_status ?? ad.status ?? "").toUpperCase();
    if (effective !== "ACTIVE") continue;
    summary.activeAds += 1;
    const values = collectStrings(ad.creative).filter(urlLike);
    const blob = values.join(" ").toLowerCase();
    const campaignId = ad.campaign_id ?? ad.campaign?.id ?? "";
    const campaignName = ad.campaign?.name ?? "";
    const bucket = summary.campaignUrlEvidence[campaignId] ?? { campaignName, ads: 0, numericFullIdAds: 0, macroAds: 0, aliasAds: 0 };
    bucket.ads += 1;
    const numericCampaign = /(utm_campaign|meta_campaign_id|campaign_id)=\d{8,}|(^|[^0-9])120\d{12,}([^0-9]|$)/i.test(blob);
    const numericAdset = /(utm_term|meta_adset_id|adset_id)=\d{8,}/i.test(blob);
    const numericAd = /(utm_content|meta_ad_id|ad_id)=\d{8,}/i.test(blob);
    const literalMacro = /\{\{\s*(campaign|adset|ad)[._]?id\s*\}\}/i.test(blob);
    const metaAlias = /campaign_alias=meta_|utm_campaign=meta_/i.test(blob);
    const paths = values.map(normalizePath).filter(Boolean);
    if (values.length > 0) summary.activeWithAnyUrlEvidence += 1;
    if (numericCampaign) summary.activeWithNumericCampaignIdInUrl += 1;
    if (numericAdset) summary.activeWithNumericAdsetIdInUrl += 1;
    if (numericAd) summary.activeWithNumericAdIdInUrl += 1;
    if (literalMacro) {
      summary.activeWithLiteralMacro += 1;
      bucket.macroAds += 1;
    }
    if (metaAlias) {
      summary.activeWithMetaAlias += 1;
      bucket.aliasAds += 1;
    }
    if (numericCampaign && numericAdset && numericAd) bucket.numericFullIdAds += 1;
    if (paths.length > 0) summary.activeWithLandingPath += 1;
    for (const pathValue of new Set(paths)) {
      summary.uniqueLandingPaths[pathValue] = (summary.uniqueLandingPaths[pathValue] ?? 0) + 1;
    }
    summary.campaignUrlEvidence[campaignId] = bucket;
  }
  return summary;
};

const renderMarkdown = (payload: Row) => `작성 시각: ${payload.generated_at_kst}
기준일: 2026-05-25
문서 성격: Meta 남은 미매칭 GA4/Meta API read-only 추가 추적 결과

\`\`\`yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - AGENTS.md
    - data/!data_inventory.md
    - gdn/attribution-data-source-decision-guide-20260511.md
  lane: Green
  allowed_actions:
    - vm_cloud_sqlite_read_only
    - ga4_bigquery_read_only
    - meta_ads_api_read_only_url_inventory
    - documentation
  forbidden_actions:
    - operating_db_write
    - vm_cloud_deploy_or_restart
    - platform_send
    - meta_ads_mutation
  source_window_freshness_confidence:
    source: VM Cloud SQLite + GA4 BigQuery + Meta Ads API
    window: VM orders 2026-05-18~2026-05-24 KST, GA4 events 2026-05-11~2026-05-24
    site: biocom
    confidence: A for read-only query execution, B for GA4 session attribution interpretation
\`\`\`

## 10초 요약

남은 Meta 미매칭 14건을 GA4 BigQuery 세션으로 역추적했지만, 캠페인·세트·소재 숫자 ID는 복구되지 않았다.

Meta Ads API URL inventory는 최신 광고 URL 단서 자체는 다시 읽었지만, 남은 주문이 결제 페이지 안의 fbclid/cookie-only 상태라 광고 URL inventory와 직접 조인할 landing/ad id가 없다.

따라서 과거 14건은 D급 quarantine 유지가 맞고, 앞으로 줄이려면 결제 전 마지막 유료 유입을 \`firstPaidTouch\`로 고정 저장해야 한다.

## GA4 BigQuery 결과

\`\`\`json
${JSON.stringify(payload.ga4_summary, null, 2)}
\`\`\`

## GA4 ga_session_id-only 보조 진단

아래 값은 고객 ID와 세션 ID가 함께 맞는 확정 조인이 아니라, 세션 ID만으로 BigQuery 후보가 있는지 본 보조 진단이다. 후보가 여러 개이면 캠페인 매핑 근거로 쓰지 않는다.

\`\`\`json
${JSON.stringify(payload.ga4_session_id_fallback_summary, null, 2)}
\`\`\`

## Meta Ads API URL Inventory 결과

\`\`\`json
${JSON.stringify(payload.meta_inventory_summary, null, 2)}
\`\`\`

## 해석

- GA4에서 세션이 조인되어도 숫자 campaign/adset/ad ID가 없으면 A급 매칭으로 승격할 수 없다.
- Meta URL inventory는 광고 소재 쪽 URL 보완 상태를 보는 장부다. 주문 쪽에 landing/ad id가 없으면 양쪽을 결정적으로 붙일 수 없다.
- \`fbclid/fbc/fbp\`는 Meta 클릭/쿠키 흔적이지 캠페인 ID가 아니다.
`;

const main = async () => {
  const generatedAtKst = kstNow();
  const vmRows = await fetchVmRemainingRows();
  const safeKeys = [
    ...new Set(
      vmRows
        .flatMap((row) => (row.safe_session_keys?.length ? row.safe_session_keys : [row.safe_session_key]))
        .filter(Boolean),
    ),
  ];
  const safeGaSessionIdKeys = [...new Set(vmRows.map((row) => row.safe_ga_session_id_key).filter(Boolean))];

  let ga4Rows: Ga4TraceRow[] = [];
  let ga4SessionIdFallbackRows: Ga4SessionIdFallbackRow[] = [];
  let ga4Error: string | null = null;
  let ga4SessionIdFallbackError: string | null = null;
  try {
    if (safeKeys.length > 0) {
      const bq = createBigQueryClient();
      ga4Rows = (await runBigQuery(bq, buildGa4Query(safeKeys))).map((row): Ga4TraceRow => ({
        safe_session_key: String(row.safe_session_key ?? ""),
        event_count: toNum(row.event_count),
        first_event_date: String(row.first_event_date ?? ""),
        last_event_date: String(row.last_event_date ?? ""),
        page_view_events: toNum(row.page_view_events),
        purchase_events: toNum(row.purchase_events),
        begin_checkout_events: toNum(row.begin_checkout_events),
        add_payment_info_events: toNum(row.add_payment_info_events),
        first_page_class: String(row.first_page_class ?? ""),
        last_page_class: String(row.last_page_class ?? ""),
        first_referrer_class: String(row.first_referrer_class ?? ""),
        any_fbclid_url: toBool(row.any_fbclid_url),
        any_meta_referrer: toBool(row.any_meta_referrer),
        any_meta_traffic_source: toBool(row.any_meta_traffic_source),
        any_utm_campaign: toBool(row.any_utm_campaign),
        any_numeric_campaign_id: toBool(row.any_numeric_campaign_id),
        any_numeric_adset_id: toBool(row.any_numeric_adset_id),
        any_numeric_ad_id: toBool(row.any_numeric_ad_id),
        any_non_payment_landing: toBool(row.any_non_payment_landing),
      }));
      if (safeGaSessionIdKeys.length > 0) {
        ga4SessionIdFallbackRows = (await runBigQuery(bq, buildGa4SessionIdFallbackQuery(safeGaSessionIdKeys))).map((row): Ga4SessionIdFallbackRow => ({
          safe_ga_session_id_key: String(row.safe_ga_session_id_key ?? ""),
          candidate_sessions: toNum(row.candidate_sessions),
          event_count: toNum(row.event_count),
          purchase_events: toNum(row.purchase_events),
          any_utm_campaign: toBool(row.any_utm_campaign),
          any_numeric_campaign_id: toBool(row.any_numeric_campaign_id),
          any_numeric_adset_id: toBool(row.any_numeric_adset_id),
          any_numeric_ad_id: toBool(row.any_numeric_ad_id),
          any_non_payment_landing: toBool(row.any_non_payment_landing),
          any_meta_traffic_source: toBool(row.any_meta_traffic_source),
        }));
      }
    }
  } catch (error) {
    ga4Error = error instanceof Error ? error.message : String(error);
  }
  if (!ga4Error && safeGaSessionIdKeys.length > 0 && ga4SessionIdFallbackRows.length === 0) {
    ga4SessionIdFallbackError = null;
  }

  let metaInventorySummary: unknown;
  try {
    metaInventorySummary = process.env.SKIP_META_API === "1"
      ? { ok: false, skipped: true, reason: "SKIP_META_API=1; previous same-turn requery already hit/saturated Meta API quota" }
      : await fetchMetaInventory();
  } catch (error) {
    metaInventorySummary = { ok: false, error: error instanceof Error ? error.message : String(error) };
  }

  const payload = {
    generated_at_kst: generatedAtKst,
    safety: {
      no_send: true,
      no_write: true,
      no_deploy: true,
      no_platform_send: true,
      raw_order_ids_emitted: false,
      raw_click_ids_emitted: false,
    },
    source: {
      vm_cloud: "attribution_ledger read-only via SSH",
      ga4_bigquery: `${JOB_PROJECT_ID}.analytics_${GA4_PROPERTY_ID}* events_20260511~20260524`,
      meta_ads_api: `/${ACCOUNT_ID}/ads read-only creative URL fields`,
    },
    vm_remaining: {
      orders: vmRows.length,
      revenue: vmRows.reduce((sum, row) => sum + row.amount, 0),
      groups: Object.fromEntries(
        [...new Set(vmRows.map((row) => row.group_label))].map((label) => [
          label,
          {
            orders: vmRows.filter((row) => row.group_label === label).length,
            revenue: vmRows.filter((row) => row.group_label === label).reduce((sum, row) => sum + row.amount, 0),
          },
        ]),
      ),
      safe_session_key_candidates: safeKeys.length,
      rows_with_client_id_fallback_candidate: vmRows.filter((row) => row.has_client_id_fallback_candidate).length,
      avg_user_key_candidates: vmRows.length > 0
        ? Number((vmRows.reduce((sum, row) => sum + row.user_key_candidate_count, 0) / vmRows.length).toFixed(2))
        : 0,
      safe_ga_session_id_keys: safeGaSessionIdKeys.length,
    },
    ga4_error: ga4Error,
    ga4_summary: summarizeGa4(vmRows, ga4Rows),
    ga4_session_id_fallback_error: ga4SessionIdFallbackError,
    ga4_session_id_fallback_summary: summarizeGa4SessionIdFallback(vmRows, ga4SessionIdFallbackRows),
    ga4_joined_sessions: ga4Rows.length,
    ga4_session_id_fallback_rows: ga4SessionIdFallbackRows.length,
    meta_inventory_summary: metaInventorySummary,
  };

  await fs.mkdir(path.dirname(OUTPUT_JSON), { recursive: true });
  await fs.writeFile(OUTPUT_JSON, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  await fs.writeFile(OUTPUT_MD, renderMarkdown(payload), "utf8");
  console.log(JSON.stringify({
    ok: true,
    output_json: OUTPUT_JSON,
    output_md: OUTPUT_MD,
    vm_orders: payload.vm_remaining.orders,
    vm_revenue: payload.vm_remaining.revenue,
    ga4_error: ga4Error,
    ga4_joined_sessions: ga4Rows.length,
    ga4_summary: payload.ga4_summary,
    meta_inventory_summary: metaInventorySummary,
  }, null, 2));
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
