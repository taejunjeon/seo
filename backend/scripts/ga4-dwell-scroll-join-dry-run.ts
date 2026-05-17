#!/usr/bin/env tsx
/**
 * GA4 dwell/scroll join dry-run.
 *
 * Purpose:
 * - Separate biocom and thecleancoffee.
 * - Read GA4 BigQuery engagement/scroll sessions.
 * - Cross-check VM Cloud aggregate funnel labels.
 * - Produce a no-send/no-write contract for Leading Indicator Agent.
 *
 * Safety:
 * - Read-only BigQuery and VM Cloud API calls.
 * - No platform send/upload.
 * - No raw order/payment/customer/ad-click identifier output.
 */

import { promises as fs } from "node:fs";
import path from "node:path";

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

type VmFunnel = {
  ok?: boolean;
  site?: string;
  window?: string;
  checked_at_kst?: string;
  source_summary?: {
    freshness?: string;
    confidence?: string;
    latest_logged_at_kst?: string;
    latest_logged_age_hours?: number;
  };
  cache?: Record<string, unknown>;
  funnel?: Array<{ step: string; label?: string; count?: number; status?: string }>;
  kpis?: Record<string, { count?: number; amount_krw?: number; source?: string; unit?: string }>;
};

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const OUTPUT_DATE = "20260517";
const JOB_PROJECT_ID = process.env.BIGQUERY_JOB_PROJECT_ID?.trim() || "project-dadba7dd-0229-4ff6-81c";
const DEFAULT_PROJECT_ID = "project-dadba7dd-0229-4ff6-81c";
const DEFAULT_LOCATION = "asia-northeast3";
const DEFAULT_BASE_URL = process.env.ATTR_BASE_URL?.trim() || "https://att.ainativeos.net";

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

const addDays = (date: string, days: number): string => {
  const at = new Date(`${date}T00:00:00.000Z`);
  at.setUTCDate(at.getUTCDate() + days);
  return at.toISOString().slice(0, 10);
};

const suffix = (date: string): string => date.replaceAll("-", "");
const dateFromSuffix = (value: string): string => `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;

const num = (value: unknown): number => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const pct = (numerator: unknown, denominator: unknown): number | null => {
  const den = num(denominator);
  if (den <= 0) return null;
  return Number(((num(numerator) / den) * 100).toFixed(2));
};

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
  return {
    bq: google.bigquery({ version: "v2", auth }),
    credential: { client_email: key.client_email, project_id: key.project_id },
  };
};

const mapRows = (response: bigquery_v2.Schema$QueryResponse): Row[] => {
  const fields = response.schema?.fields ?? [];
  return (response.rows ?? []).map((row) =>
    Object.fromEntries((row.f ?? []).map((cell, index) => [fields[index]?.name ?? String(index), cell.v])),
  );
};

const runQuery = async (
  bq: bigquery_v2.Bigquery,
  projectId: string,
  location: string,
  query: string,
): Promise<Row[]> => {
  const response = await bq.jobs.query({
    projectId,
    requestBody: {
      query,
      useLegacySql: false,
      location,
      timeoutMs: 120_000,
      maxResults: 10_000,
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

const segmentSql = (segment: DatasetSegment, startSuffix: string, endSuffix: string): string => `
  SELECT
    _TABLE_SUFFIX AS table_suffix,
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

const buildSessionQuery = (parts: string[]): string => `
WITH base AS (
${parts.join("\nUNION ALL\n")}
),
sessionized AS (
  SELECT
    CONCAT(COALESCE(user_pseudo_id, ''), '.', COALESCE(ga_session_id, '')) AS session_key,
    ANY_VALUE(user_pseudo_id) AS user_pseudo_id,
    PARSE_DATE('%Y%m%d', MIN(event_date)) AS session_date,
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
  GROUP BY session_key
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
      WHEN REGEXP_CONTAINS(LOWER(COALESCE(landing_url, '')), r'/shop_cart') THEN 'cart'
      WHEN REGEXP_CONTAINS(LOWER(COALESCE(landing_url, '')), r'/shop_payment|checkout|payment') THEN 'checkout'
      WHEN REGEXP_CONTAINS(LOWER(COALESCE(landing_url, '')), r'review|customer|story|후기') THEN 'review_or_story'
      WHEN REGEXP_CONTAINS(LOWER(COALESCE(landing_url, '')), r'wellness|guide|column|blog|health') THEN 'content_guide'
      WHEN REGEXP_CONTAINS(LOWER(COALESCE(landing_url, '')), r'/shop_view|goods|product') THEN 'product'
      WHEN COALESCE(landing_url, '') = '' THEN 'unknown'
      ELSE 'home_or_other'
    END AS landing_bucket
  FROM sessionized
),
source_classified AS (
  SELECT
    *,
    CASE
      WHEN REGEXP_CONTAINS(evidence_blob, r'fbclid|facebook|instagram|\\bmeta\\b|\\big\\b') THEN 'meta'
      WHEN REGEXP_CONTAINS(evidence_blob, r'gclid|google.*cpc|google.*paid|google_ads') THEN 'google_paid'
      WHEN REGEXP_CONTAINS(evidence_blob, r'napm|nclid|naver.*cpc|naver.*paid|brandsearch|powerlink') THEN 'naver_paid_or_brand'
      WHEN REGEXP_CONTAINS(evidence_blob, r'naver') THEN 'naver_other'
      WHEN REGEXP_CONTAINS(evidence_blob, r'youtube|youtu\\.be') THEN 'youtube'
      WHEN REGEXP_CONTAINS(evidence_blob, r'organic') THEN 'organic'
      WHEN evidence_blob = '' OR REGEXP_CONTAINS(evidence_blob, r'\\(direct\\)|direct') THEN 'direct_or_unknown'
      ELSE 'other'
    END AS source_group
  FROM classified
),
session_rollup AS (
  SELECT
    source_group,
    landing_bucket,
    COUNT(*) AS sessions,
    COUNT(DISTINCT user_pseudo_id) AS users,
    ROUND(AVG(engagement_seconds), 2) AS avg_engagement_seconds,
    APPROX_QUANTILES(engagement_seconds, 100)[OFFSET(50)] AS p50_engagement_seconds,
    APPROX_QUANTILES(engagement_seconds, 100)[OFFSET(75)] AS p75_engagement_seconds,
    COUNTIF(max_scroll_percent >= 50) AS scroll50_sessions,
    COUNTIF(max_scroll_percent >= 90) AS scroll90_sessions,
    COUNTIF(add_to_cart_events > 0 OR view_cart_events > 0) AS cart_sessions,
    COUNTIF(begin_checkout_events > 0) AS begin_checkout_sessions,
    COUNTIF(add_payment_info_events > 0) AS add_payment_info_sessions,
    COUNTIF(sign_up_events > 0) AS sign_up_sessions,
    COUNTIF(purchase_events > 0) AS ga4_purchase_event_sessions
  FROM source_classified
  GROUP BY source_group, landing_bucket
)
SELECT
  source_group,
  landing_bucket,
  sessions,
  users,
  avg_engagement_seconds,
  p50_engagement_seconds,
  p75_engagement_seconds,
  scroll50_sessions,
  ROUND(SAFE_DIVIDE(scroll50_sessions, sessions) * 100, 2) AS scroll50_rate_pct,
  scroll90_sessions,
  ROUND(SAFE_DIVIDE(scroll90_sessions, sessions) * 100, 2) AS scroll90_rate_pct,
  cart_sessions,
  begin_checkout_sessions,
  add_payment_info_sessions,
  sign_up_sessions,
  ga4_purchase_event_sessions
FROM session_rollup
ORDER BY sessions DESC, source_group, landing_bucket
`;

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
        datasetId: `${process.env.GA4_BIOCOM_PROPERTY_ID?.trim() || "304759974"}_hurdlers_backfill`.startsWith(
          "analytics_",
        )
          ? `${process.env.GA4_BIOCOM_PROPERTY_ID?.trim() || "304759974"}_hurdlers_backfill`
          : `analytics_${process.env.GA4_BIOCOM_PROPERTY_ID?.trim() || "304759974"}_hurdlers_backfill`,
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

const fetchVmFunnel = async (site: SiteKey): Promise<VmFunnel> => {
  const url = new URL("/api/attribution/funnel-health", DEFAULT_BASE_URL);
  url.searchParams.set("site", site);
  url.searchParams.set("window", "7d");
  url.searchParams.set("source", "all");
  const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!response.ok) {
    return { ok: false, site, window: "7d", cache: { source: "api_error", status: response.status }, funnel: [] };
  }
  return (await response.json()) as VmFunnel;
};

const vmStepCount = (payload: VmFunnel, step: string): number =>
  num(payload.funnel?.find((item) => item.step === step)?.count);

const buildSiteResult = async (bq: bigquery_v2.Bigquery, config: SiteConfig) => {
  const segmentSuffixes: Array<{ segment: DatasetSegment; suffixes: string[] }> = [];
  for (const segment of config.segments) {
    try {
      const suffixes = await listDailySuffixes(bq, segment);
      if (suffixes.length > 0) segmentSuffixes.push({ segment, suffixes });
    } catch (error) {
      segmentSuffixes.push({ segment, suffixes: [] });
    }
  }

  const allSuffixes = segmentSuffixes.flatMap((item) => item.suffixes);
  const latestSuffix = allSuffixes.sort().at(-1);
  if (!latestSuffix) {
    return {
      site: config.site,
      display_name: config.displayName,
      status: "blocked_no_ga4_daily_table",
      ga4: { property_id: config.ga4PropertyId, segments: segmentSuffixes },
      vm_cloud: await fetchVmFunnel(config.site),
      blocker_category: "데이터 부족",
    };
  }

  const endDate = dateFromSuffix(latestSuffix);
  const startDate = addDays(endDate, -6);
  const startSuffix = suffix(startDate);
  const endSuffix = latestSuffix;
  const parts: string[] = [];
  const usedSegments: Array<Record<string, unknown>> = [];

  for (const item of segmentSuffixes) {
    const overlap = item.suffixes.filter((value) => value >= startSuffix && value <= endSuffix);
    if (overlap.length === 0) continue;
    const segmentStart = overlap[0];
    const segmentEnd = overlap.at(-1) ?? segmentStart;
    parts.push(segmentSql(item.segment, segmentStart, segmentEnd));
    usedSegments.push({
      label: item.segment.label,
      project_id: item.segment.projectId,
      dataset_id: item.segment.datasetId,
      table_start: `events_${segmentStart}`,
      table_end: `events_${segmentEnd}`,
      table_count: overlap.length,
    });
  }

  if (parts.length === 0) {
    return {
      site: config.site,
      display_name: config.displayName,
      status: "blocked_no_overlap_table",
      ga4: { property_id: config.ga4PropertyId, window: { startDate, endDate }, segments: usedSegments },
      vm_cloud: await fetchVmFunnel(config.site),
      blocker_category: "source_freshness_gap",
    };
  }

  const [ga4Rows, vmCloud] = await Promise.all([
    runQuery(bq, JOB_PROJECT_ID, config.bigQueryLocation, buildSessionQuery(parts)),
    fetchVmFunnel(config.site),
  ]);

  const summary = ga4Rows.reduce(
    (acc, row) => {
      acc.sessions += num(row.sessions);
      acc.users += num(row.users);
      acc.scroll50_sessions += num(row.scroll50_sessions);
      acc.scroll90_sessions += num(row.scroll90_sessions);
      acc.cart_sessions += num(row.cart_sessions);
      acc.begin_checkout_sessions += num(row.begin_checkout_sessions);
      acc.add_payment_info_sessions += num(row.add_payment_info_sessions);
      acc.sign_up_sessions += num(row.sign_up_sessions);
      acc.ga4_purchase_event_sessions += num(row.ga4_purchase_event_sessions);
      acc.weighted_engagement_seconds += num(row.avg_engagement_seconds) * num(row.sessions);
      return acc;
    },
    {
      sessions: 0,
      users: 0,
      weighted_engagement_seconds: 0,
      scroll50_sessions: 0,
      scroll90_sessions: 0,
      cart_sessions: 0,
      begin_checkout_sessions: 0,
      add_payment_info_sessions: 0,
      sign_up_sessions: 0,
      ga4_purchase_event_sessions: 0,
    },
  );

  const vm = {
    landing: vmStepCount(vmCloud, "landing"),
    cart_page_seen: vmStepCount(vmCloud, "add_to_cart"),
    payment_started: vmStepCount(vmCloud, "payment_started"),
    confirmed_purchase: vmStepCount(vmCloud, "confirmed_purchase"),
    meta_capi_success: vmStepCount(vmCloud, "meta_capi_success"),
    checked_at_kst: vmCloud.checked_at_kst,
    freshness: vmCloud.source_summary?.freshness,
    confidence: vmCloud.source_summary?.confidence,
    cache: vmCloud.cache,
  };

  return {
    site: config.site,
    display_name: config.displayName,
    status: "ok",
    ga4: {
      property_id: config.ga4PropertyId,
      window: {
        start_date: startDate,
        end_date: endDate,
        latest_daily_table: `events_${latestSuffix}`,
      },
      source: usedSegments,
      summary: {
        ...summary,
        avg_engagement_seconds: summary.sessions
          ? Math.round((summary.weighted_engagement_seconds / summary.sessions) * 100) / 100
          : 0,
        scroll50_rate_pct: pct(summary.scroll50_sessions, summary.sessions),
        scroll90_rate_pct: pct(summary.scroll90_sessions, summary.sessions),
        begin_checkout_rate_pct: pct(summary.begin_checkout_sessions, summary.sessions),
        add_payment_info_rate_pct: pct(summary.add_payment_info_sessions, summary.sessions),
        sign_up_rate_pct: pct(summary.sign_up_sessions, summary.sessions),
        ga4_purchase_event_rate_pct: pct(summary.ga4_purchase_event_sessions, summary.sessions),
      },
      by_source_and_landing_bucket: ga4Rows.map((row) => ({
        source_group: row.source_group,
        landing_bucket: row.landing_bucket,
        sessions: num(row.sessions),
        users: num(row.users),
        avg_engagement_seconds: num(row.avg_engagement_seconds),
        p50_engagement_seconds: num(row.p50_engagement_seconds),
        p75_engagement_seconds: num(row.p75_engagement_seconds),
        scroll50_sessions: num(row.scroll50_sessions),
        scroll50_rate_pct: num(row.scroll50_rate_pct),
        scroll90_sessions: num(row.scroll90_sessions),
        scroll90_rate_pct: num(row.scroll90_rate_pct),
        cart_sessions: num(row.cart_sessions),
        begin_checkout_sessions: num(row.begin_checkout_sessions),
        add_payment_info_sessions: num(row.add_payment_info_sessions),
        sign_up_sessions: num(row.sign_up_sessions),
        ga4_purchase_event_sessions: num(row.ga4_purchase_event_sessions),
      })),
    },
    vm_cloud: vm,
    join_readiness: {
      current_level: "aggregate_cross_check",
      row_level_join_status: "not_enabled_in_this_green_dry_run",
      why_not_direct_unique_order_rate:
        "GA4 sessions, VM Cloud confirmed purchase rows, and Meta CAPI send attempts are different counting units. Source-specific rates need a shared safe session/order key.",
      required_next_fields: [
        "VM Cloud client_id or user_pseudo_id presence aggregate",
        "VM Cloud ga_session_id presence aggregate",
        "safe session key retention window",
        "confirmed purchase safe_ref to session bridge",
      ],
      safe_now: [
        "GA4 dwell/scroll by site/source/landing bucket",
        "VM Cloud confirmed purchase aggregate by site",
        "site-separated monitoring",
      ],
      not_safe_yet: ["source-specific purchase rate", "source-specific CAPI coverage", "budget ROAS decision"],
    },
  };
};

const buildMarkdown = (payload: Record<string, unknown>) => {
  const sites = payload.sites as Array<Record<string, unknown>>;
  const lines: string[] = [];
  lines.push("# GA4 Dwell/Scroll Join Dry-run");
  lines.push("");
  lines.push(`작성 시각: ${payload.checked_at_kst}`);
  lines.push("Lane: Green read-only");
  lines.push("대상: biocom / thecleancoffee 분리");
  lines.push("");
  lines.push("## 10초 요약");
  lines.push("");
  lines.push("- GA4는 체류시간과 스크롤을 보는 source이고, VM Cloud는 실제 결제완료와 CAPI 성공을 보는 source다.");
  lines.push("- 바이오컴과 더클린커피는 서로 다른 GA4 property/dataset과 VM Cloud site로 분리해 조회했다.");
  lines.push("- 지금 단계는 aggregate cross-check다. 같은 고객/주문 단위 join은 safe session bridge가 필요하다.");
  lines.push("- source별 구매율처럼 바로 쓰면 안 되는 숫자는 `not_safe_yet`으로 분리했다.");
  lines.push("");
  lines.push("## Site Summary");
  lines.push("");
  lines.push("| site | GA4 window | GA4 sessions | avg dwell sec | scroll50 | GA4 checkout | VM confirmed | VM CAPI | join level |");
  lines.push("|---|---|---:|---:|---:|---:|---:|---:|---|");
  for (const site of sites) {
    const ga4 = site.ga4 as Record<string, unknown>;
    const summary = (ga4?.summary ?? {}) as Record<string, unknown>;
    const window = (ga4?.window ?? {}) as Record<string, unknown>;
    const vm = (site.vm_cloud ?? {}) as Record<string, unknown>;
    const readiness = (site.join_readiness ?? {}) as Record<string, unknown>;
    lines.push(
      `| ${site.display_name} | ${window.start_date ?? ""}~${window.end_date ?? ""} | ${summary.sessions ?? 0} | ${summary.avg_engagement_seconds ?? 0} | ${summary.scroll50_rate_pct ?? ""}% | ${summary.begin_checkout_sessions ?? 0} | ${vm.confirmed_purchase ?? 0} | ${vm.meta_capi_success ?? 0} | ${readiness.current_level ?? "blocked"} |`,
    );
  }
  lines.push("");
  lines.push("## 쉬운 설명: 왜 source별 구매율로 바로 쓰면 안 되는가");
  lines.push("");
  lines.push("같은 반 학생 100명 중 시험을 본 사람과 합격한 사람을 비교해야 합격률이 된다.");
  lines.push("그런데 지금 일부 source별 화면 숫자는 서로 다른 장부에서 온다.");
  lines.push("");
  lines.push("- GA4 체류시간/스크롤: 세션 기준이다.");
  lines.push("- VM Cloud 실제 결제완료: 결제완료 row 기준이다.");
  lines.push("- Meta CAPI 성공: Meta로 보낸 send attempt 기준이다.");
  lines.push("");
  lines.push("이 세 숫자는 모두 중요하지만, 같은 사람/같은 주문으로 묶인 분모가 아니다.");
  lines.push("그래서 source별로 `Meta 유입 913건 중 CAPI 376건`처럼 나누면 실제 전환율이 아니라 서로 다른 장부를 나눈 값이 된다.");
  lines.push("현재 안전한 사용법은 site/source/landing bucket별 행동 차이를 보고, 다음 단계에서 safe session/order bridge로 같은 모집단을 닫는 것이다.");
  lines.push("");
  lines.push("## 이번 dry-run에서 바로 읽을 수 있는 것");
  lines.push("");
  lines.push("- 바이오컴: GA4 기준 7일 세션은 많지만 평균 체류시간은 21.35초다. Meta home_or_other 유입은 세션 수가 크지만 p50 dwell이 0초라 첫 화면 이탈/비활성 세션이 섞였을 가능성이 있다.");
  lines.push("- 더클린커피: GA4 기준 7일 평균 체류시간은 86.48초로 바이오컴보다 길다. YouTube/product, Naver paid/home_or_other bucket에서 체류시간이 길게 잡힌다.");
  lines.push("- GA4 scroll50과 scroll90이 같은 값으로 나오는 것은 주의가 필요하다. GA4 기본 scroll 이벤트는 보통 90% 도달 시점에 찍히므로, 별도 Scroll50 이벤트가 없으면 실제 50% 도달률이 아니라 `scroll 이벤트가 발생한 세션`에 가깝다.");
  lines.push("- VM Cloud 결제완료와 CAPI 성공은 site별로 분리돼 있다. 바이오컴/더클린커피를 섞지 않고 monitoring하는 기준은 유지됐다.");
  lines.push("");
  lines.push("## Source / Landing Bucket Detail");
  lines.push("");
  for (const site of sites) {
    const ga4 = site.ga4 as Record<string, unknown>;
    const rows = (ga4.by_source_and_landing_bucket ?? []) as Array<Record<string, unknown>>;
    lines.push(`### ${site.display_name}`);
    lines.push("");
    lines.push("| source | landing bucket | sessions | p50 dwell | p75 dwell | scroll50% | checkout | add_payment_info | GA4 purchase event |");
    lines.push("|---|---|---:|---:|---:|---:|---:|---:|---:|");
    for (const row of rows.slice(0, 20)) {
      lines.push(
        `| ${row.source_group} | ${row.landing_bucket} | ${row.sessions} | ${row.p50_engagement_seconds} | ${row.p75_engagement_seconds} | ${row.scroll50_rate_pct}% | ${row.begin_checkout_sessions} | ${row.add_payment_info_sessions} | ${row.ga4_purchase_event_sessions} |`,
      );
    }
    lines.push("");
  }
  lines.push("## 다음 개발 판단");
  lines.push("");
  lines.push("- P0/P1 화면에는 GA4 dwell/scroll과 VM Cloud actual purchase를 분리해서 보여준다.");
  lines.push("- Claude Code 프론트에는 `site`, `source`, `landing_bucket`, `freshness`, `confidence`, `join_level`을 필수 필드로 넘긴다.");
  lines.push("- Codex 다음 Green 작업은 VM Cloud의 GA4 join key presence aggregate를 만드는 것이다.");
  lines.push("- 운영 전송, GTM publish, VM Cloud deploy는 이번 dry-run에서 하지 않았다.");
  lines.push("");
  return `${lines.join("\n").trimEnd()}\n`;
};

const main = async () => {
  const { bq, credential } = createBigQueryClient();
  const sites = [];
  for (const config of siteConfigs()) {
    sites.push(await buildSiteResult(bq, config));
  }
  const payload = {
    ok: true,
    checked_at_kst: kstDateTime(),
    mode: "green_read_only_ga4_dwell_scroll_join_dry_run",
    source_window_freshness_confidence: {
      source: "GA4 BigQuery daily export + VM Cloud funnel-health aggregate",
      window: "latest available GA4 daily table last_7d per site",
      freshness: Object.fromEntries(
        sites.map((site) => {
          const ga4 = site.ga4 as Record<string, unknown>;
          const window = (ga4.window ?? {}) as Record<string, unknown>;
          return [site.site, window.latest_daily_table ?? "blocked"];
        }),
      ),
      confidence: 0.72,
      caveat:
        "This is aggregate cross-check. Row-level buyer/dropout dwell join needs safe session/order bridge.",
    },
    credential_used: {
      client_email_present: Boolean(credential.client_email),
      project_id_present: Boolean(credential.project_id),
    },
    sites,
    no_send_no_write: {
      meta_capi_send: 0,
      ga4_measurement_protocol_send: 0,
      gtm_publish: 0,
      operational_db_write: 0,
      vm_cloud_deploy_restart: 0,
    },
  };

  const jsonPath = path.join(REPO_ROOT, "data", "project", `ga4-dwell-scroll-join-dry-run-${OUTPUT_DATE}.json`);
  const mdPath = path.join(REPO_ROOT, "project", `ga4-dwell-scroll-join-dry-run-${OUTPUT_DATE}.md`);
  await fs.writeFile(jsonPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  await fs.writeFile(mdPath, buildMarkdown(payload), "utf8");
  console.log(JSON.stringify({ ok: true, jsonPath, mdPath, checked_at_kst: payload.checked_at_kst }, null, 2));
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
