#!/usr/bin/env tsx
import fs from "node:fs";
import path from "node:path";

import dotenv from "dotenv";
import { google, type bigquery_v2 } from "googleapis";

dotenv.config({ path: path.resolve(__dirname, "..", ".env"), quiet: true });

const DEFAULT_JOB_PROJECT = "project-dadba7dd-0229-4ff6-81c";
const DEFAULT_ARCHIVE_DATASET = "analytics_304759974_hurdlers_backfill";
const DEFAULT_DAILY_DATASET = "analytics_304759974";
const DEFAULT_LOCATION = "asia-northeast3";
const DEFAULT_END_DATE = "2026-05-09";
const CUTOVER_SUFFIX = "20260506";
const DAILY_START_SUFFIX = "20260507";

type Row = Record<string, unknown>;

type WindowSpec = {
  label: string;
  days: number;
  startDate: string;
  endDate: string;
  startSuffix: string;
  endSuffix: string;
};

const argValue = (name: string) =>
  process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);

const parseArgs = () => ({
  end: argValue("end") ?? DEFAULT_END_DATE,
  jobProject: argValue("job-project") ?? DEFAULT_JOB_PROJECT,
  archiveDataset: argValue("archive-dataset") ?? DEFAULT_ARCHIVE_DATASET,
  dailyDataset: argValue("daily-dataset") ?? DEFAULT_DAILY_DATASET,
  location: argValue("location") ?? DEFAULT_LOCATION,
  output: argValue("output"),
  markdownOutput: argValue("markdown-output") ?? argValue("markdownOutput"),
});

const suffix = (date: string) => date.replaceAll("-", "");

const dateFromSuffix = (value: string) => `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;

const addDays = (date: string, days: number) => {
  const at = new Date(`${date}T00:00:00.000Z`);
  at.setUTCDate(at.getUTCDate() + days);
  return at.toISOString().slice(0, 10);
};

const inclusiveDayCount = (startDate: string, endDate: string) => {
  const start = new Date(`${startDate}T00:00:00.000Z`).getTime();
  const end = new Date(`${endDate}T00:00:00.000Z`).getTime();
  return Math.floor((end - start) / 86_400_000) + 1;
};

const buildWindows = (endDate: string): WindowSpec[] =>
  [7, 14, 30].map((days) => {
    const startDate = addDays(endDate, -(days - 1));
    return {
      label: `last_${days}d`,
      days,
      startDate,
      endDate,
      startSuffix: suffix(startDate),
      endSuffix: suffix(endDate),
    };
  });

const parseServiceAccount = () => {
  const raw = process.env.GA4_BIOCOM_SERVICE_ACCOUNT_KEY?.trim() || process.env.GA4_SERVICE_ACCOUNT_KEY?.trim();
  if (!raw) throw new Error("GA4_BIOCOM_SERVICE_ACCOUNT_KEY or GA4_SERVICE_ACCOUNT_KEY is required");
  const parsed = JSON.parse(raw) as { client_email?: string; private_key?: string; project_id?: string };
  if (!parsed.client_email || !parsed.private_key) {
    throw new Error("service account key must include client_email and private_key");
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
    credential: {
      client_email: key.client_email,
      project_id: key.project_id,
    },
  };
};

const mapRows = (response: bigquery_v2.Schema$QueryResponse): Row[] => {
  const fields = response.schema?.fields ?? [];
  return (response.rows ?? []).map((row) =>
    Object.fromEntries((row.f ?? []).map((cell, index) => [fields[index]?.name ?? String(index), cell.v])),
  );
};

const runQuery = async (bq: bigquery_v2.Bigquery, projectId: string, location: string, query: string) => {
  const response = await bq.jobs.query({
    projectId,
    requestBody: {
      query,
      useLegacySql: false,
      location,
      timeoutMs: 180_000,
      maxResults: 10_000,
    },
  });
  if (!response.data.jobComplete) {
    throw new Error(`BigQuery job did not complete: ${response.data.jobReference?.jobId ?? "unknown"}`);
  }
  return mapRows(response.data);
};

const num = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const pct = (numerator: unknown, denominator: unknown) => {
  const denom = num(denominator);
  if (denom <= 0) return null;
  return Number(((num(numerator) / denom) * 100).toFixed(2));
};

const kstNow = () =>
  `${new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date())} KST`;

const buildSuffixQuery = (
  project: string,
  archiveDataset: string,
  dailyDataset: string,
  startSuffix: string,
  endSuffix: string,
) => `
WITH tables AS (
  SELECT
    'archive_backfill' AS source_dataset,
    REGEXP_EXTRACT(table_id, r'^events_(\\d{8})$') AS suffix,
    row_count,
    TIMESTAMP_MILLIS(last_modified_time) AS last_modified_at
  FROM \`${project}.${archiveDataset}.__TABLES__\`
  WHERE REGEXP_CONTAINS(table_id, r'^events_\\d{8}$')
  UNION ALL
  SELECT
    'daily_export' AS source_dataset,
    REGEXP_EXTRACT(table_id, r'^events_(\\d{8})$') AS suffix,
    row_count,
    TIMESTAMP_MILLIS(last_modified_time) AS last_modified_at
  FROM \`${project}.${dailyDataset}.__TABLES__\`
  WHERE REGEXP_CONTAINS(table_id, r'^events_\\d{8}$')
)
SELECT source_dataset, suffix, row_count, last_modified_at
FROM tables
WHERE suffix BETWEEN '${startSuffix}' AND '${endSuffix}'
  AND (
    (source_dataset = 'archive_backfill' AND suffix <= '${CUTOVER_SUFFIX}') OR
    (source_dataset = 'daily_export' AND suffix >= '${DAILY_START_SUFFIX}')
  )
ORDER BY suffix, source_dataset
`;

const buildFunnelQuery = (
  project: string,
  archiveDataset: string,
  dailyDataset: string,
  startSuffix: string,
  endSuffix: string,
) => `
WITH base AS (
  SELECT 'archive_backfill' AS source_dataset, * FROM (
    SELECT
      _TABLE_SUFFIX AS suffix,
      event_date,
      TIMESTAMP_MICROS(event_timestamp) AS event_ts,
      event_name,
      user_pseudo_id,
      CAST((SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'ga_session_id') AS STRING) AS ga_session_id,
      COALESCE((SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'page_location'), '') AS page_location,
      COALESCE((SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'page_referrer'), '') AS page_referrer,
      COALESCE((SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'engagement_time_msec'), 0) AS engagement_time_msec,
      COALESCE((SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'percent_scrolled'), 0) AS percent_scrolled,
      COALESCE((SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'pay_method'), '') AS pay_method,
      COALESCE((SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'payment_method'), '') AS payment_method,
      COALESCE((SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'transaction_id'), ecommerce.transaction_id, '') AS transaction_id,
      COALESCE(
        (SELECT value.double_value FROM UNNEST(event_params) WHERE key = 'value'),
        CAST((SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'value') AS FLOAT64),
        ecommerce.purchase_revenue,
        0
      ) AS event_value,
      COALESCE((SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'source'), '') AS ep_source,
      COALESCE((SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'medium'), '') AS ep_medium,
      COALESCE((SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'campaign'), '') AS ep_campaign,
      COALESCE((SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'content'), '') AS ep_content,
      COALESCE((SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'utm_source'), '') AS utm_source,
      COALESCE((SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'utm_medium'), '') AS utm_medium,
      COALESCE((SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'utm_campaign'), '') AS utm_campaign,
      COALESCE((SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'utm_content'), '') AS utm_content,
      COALESCE(collected_traffic_source.manual_source, '') AS cts_source,
      COALESCE(collected_traffic_source.manual_medium, '') AS cts_medium,
      COALESCE(collected_traffic_source.manual_campaign_name, '') AS cts_campaign,
      COALESCE(collected_traffic_source.gclid, '') AS cts_gclid,
      COALESCE(session_traffic_source_last_click.manual_campaign.source, '') AS st_manual_source,
      COALESCE(session_traffic_source_last_click.manual_campaign.medium, '') AS st_manual_medium,
      COALESCE(session_traffic_source_last_click.manual_campaign.campaign_name, '') AS st_manual_campaign,
      COALESCE(session_traffic_source_last_click.google_ads_campaign.campaign_id, '') AS st_gads_campaign_id,
      COALESCE(session_traffic_source_last_click.google_ads_campaign.campaign_name, '') AS st_gads_campaign_name,
      COALESCE(session_traffic_source_last_click.cross_channel_campaign.source, '') AS st_cross_source,
      COALESCE(session_traffic_source_last_click.cross_channel_campaign.medium, '') AS st_cross_medium,
      COALESCE(session_traffic_source_last_click.cross_channel_campaign.campaign_name, '') AS st_cross_campaign,
      COALESCE(session_traffic_source_last_click.cross_channel_campaign.default_channel_group, '') AS st_default_channel_group
    FROM \`${project}.${archiveDataset}.events_*\`
    WHERE _TABLE_SUFFIX BETWEEN '${startSuffix}' AND '${endSuffix}'
      AND _TABLE_SUFFIX <= '${CUTOVER_SUFFIX}'
  )
  UNION ALL
  SELECT 'daily_export' AS source_dataset, * FROM (
    SELECT
      _TABLE_SUFFIX AS suffix,
      event_date,
      TIMESTAMP_MICROS(event_timestamp) AS event_ts,
      event_name,
      user_pseudo_id,
      CAST((SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'ga_session_id') AS STRING) AS ga_session_id,
      COALESCE((SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'page_location'), '') AS page_location,
      COALESCE((SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'page_referrer'), '') AS page_referrer,
      COALESCE((SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'engagement_time_msec'), 0) AS engagement_time_msec,
      COALESCE((SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'percent_scrolled'), 0) AS percent_scrolled,
      COALESCE((SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'pay_method'), '') AS pay_method,
      COALESCE((SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'payment_method'), '') AS payment_method,
      COALESCE((SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'transaction_id'), ecommerce.transaction_id, '') AS transaction_id,
      COALESCE(
        (SELECT value.double_value FROM UNNEST(event_params) WHERE key = 'value'),
        CAST((SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'value') AS FLOAT64),
        ecommerce.purchase_revenue,
        0
      ) AS event_value,
      COALESCE((SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'source'), '') AS ep_source,
      COALESCE((SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'medium'), '') AS ep_medium,
      COALESCE((SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'campaign'), '') AS ep_campaign,
      COALESCE((SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'content'), '') AS ep_content,
      COALESCE((SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'utm_source'), '') AS utm_source,
      COALESCE((SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'utm_medium'), '') AS utm_medium,
      COALESCE((SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'utm_campaign'), '') AS utm_campaign,
      COALESCE((SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'utm_content'), '') AS utm_content,
      COALESCE(collected_traffic_source.manual_source, '') AS cts_source,
      COALESCE(collected_traffic_source.manual_medium, '') AS cts_medium,
      COALESCE(collected_traffic_source.manual_campaign_name, '') AS cts_campaign,
      COALESCE(collected_traffic_source.gclid, '') AS cts_gclid,
      COALESCE(session_traffic_source_last_click.manual_campaign.source, '') AS st_manual_source,
      COALESCE(session_traffic_source_last_click.manual_campaign.medium, '') AS st_manual_medium,
      COALESCE(session_traffic_source_last_click.manual_campaign.campaign_name, '') AS st_manual_campaign,
      COALESCE(session_traffic_source_last_click.google_ads_campaign.campaign_id, '') AS st_gads_campaign_id,
      COALESCE(session_traffic_source_last_click.google_ads_campaign.campaign_name, '') AS st_gads_campaign_name,
      COALESCE(session_traffic_source_last_click.cross_channel_campaign.source, '') AS st_cross_source,
      COALESCE(session_traffic_source_last_click.cross_channel_campaign.medium, '') AS st_cross_medium,
      COALESCE(session_traffic_source_last_click.cross_channel_campaign.campaign_name, '') AS st_cross_campaign,
      COALESCE(session_traffic_source_last_click.cross_channel_campaign.default_channel_group, '') AS st_default_channel_group
    FROM \`${project}.${dailyDataset}.events_*\`
    WHERE _TABLE_SUFFIX BETWEEN '${startSuffix}' AND '${endSuffix}'
      AND _TABLE_SUFFIX >= '${DAILY_START_SUFFIX}'
  )
),
flagged AS (
  SELECT
    *,
    CONCAT(COALESCE(user_pseudo_id, ''), '.', COALESCE(ga_session_id, '')) AS session_key,
    LOWER(ARRAY_TO_STRING([
      page_location, page_referrer, ep_source, ep_medium, ep_campaign, ep_content,
      utm_source, utm_medium, utm_campaign, utm_content,
      cts_source, cts_medium, cts_campaign,
      st_manual_source, st_manual_medium, st_manual_campaign,
      st_gads_campaign_id, st_gads_campaign_name,
      st_cross_source, st_cross_medium, st_cross_campaign, st_default_channel_group
    ], ' ')) AS haystack
  FROM base
  WHERE user_pseudo_id IS NOT NULL AND ga_session_id IS NOT NULL
),
event_flags AS (
  SELECT
    *,
    (
      st_gads_campaign_id != '' OR cts_gclid != '' OR
      REGEXP_CONTAINS(LOWER(page_location), r'([?&](gclid|gbraid|wbraid|gad_source|gad_campaignid)=)') OR
      REGEXP_CONTAINS(haystack, r'googleads|google\\s*/\\s*(cpc|ppc|paid|paidsearch)')
    ) AS is_google_ads,
    (
      REGEXP_CONTAINS(LOWER(page_location), r'([?&]fbclid=)') OR
      REGEXP_CONTAINS(haystack, r'facebook|instagram|meta|(^|[^a-z0-9])(fb|ig)($|[^a-z0-9])')
    ) AS is_meta,
    REGEXP_CONTAINS(haystack, r'tiktok') AS is_tiktok,
    REGEXP_CONTAINS(haystack, r'naver|powerlink|navershopping') AS is_naver,
    REGEXP_CONTAINS(haystack, r'organic') AS is_organic,
    (
      event_name = 'add_payment_info' AND
      (LOWER(pay_method) = 'npay' OR STARTS_WITH(UPPER(transaction_id), 'NPAY') OR LOWER(page_location) LIKE '%npay%')
    ) AS is_npay_click,
    (event_name = 'begin_checkout' OR LOWER(page_location) LIKE '%/shop_payment/%') AS is_checkout,
    (event_name = 'purchase') AS is_purchase
  FROM flagged
),
sessions AS (
  SELECT
    session_key,
    ANY_VALUE(user_pseudo_id) AS user_pseudo_id,
    MIN(event_ts) AS first_ts,
    MAX(event_ts) AS last_ts,
    CASE
      WHEN MAX(IF(is_google_ads, 1, 0)) = 1 THEN 'paid_google'
      WHEN MAX(IF(is_meta, 1, 0)) = 1 THEN 'paid_meta'
      WHEN MAX(IF(is_tiktok, 1, 0)) = 1 THEN 'paid_tiktok'
      WHEN MAX(IF(is_naver, 1, 0)) = 1 AND MAX(IF(is_organic, 1, 0)) = 0 THEN 'paid_naver'
      WHEN MAX(IF(is_organic, 1, 0)) = 1 THEN 'organic_search'
      WHEN MAX(IF(haystack LIKE '%direct%' OR haystack LIKE '%(direct)%', 1, 0)) = 1 THEN 'direct'
      ELSE 'other'
    END AS source_group,
    COALESCE(
      ARRAY_AGG(NULLIF(st_gads_campaign_name, '') IGNORE NULLS LIMIT 1)[SAFE_OFFSET(0)],
      ARRAY_AGG(NULLIF(ep_campaign, '') IGNORE NULLS LIMIT 1)[SAFE_OFFSET(0)],
      ARRAY_AGG(NULLIF(utm_campaign, '') IGNORE NULLS LIMIT 1)[SAFE_OFFSET(0)],
      ARRAY_AGG(NULLIF(cts_campaign, '') IGNORE NULLS LIMIT 1)[SAFE_OFFSET(0)],
      ARRAY_AGG(NULLIF(st_cross_campaign, '') IGNORE NULLS LIMIT 1)[SAFE_OFFSET(0)],
      '(not set)'
    ) AS campaign_hint,
    SUM(engagement_time_msec) / 1000 AS engagement_seconds,
    MAX(CASE WHEN event_name = 'scroll' OR percent_scrolled >= 90 THEN 1 ELSE 0 END) AS has_scroll_90,
    MAX(CASE WHEN event_name = 'view_item' THEN 1 ELSE 0 END) AS has_view_item,
    MAX(CASE WHEN event_name = 'add_to_cart' THEN 1 ELSE 0 END) AS has_add_to_cart,
    MAX(CASE WHEN is_checkout THEN 1 ELSE 0 END) AS has_checkout,
    MAX(CASE WHEN event_name = 'add_payment_info' THEN 1 ELSE 0 END) AS has_add_payment_info,
    MAX(CASE WHEN is_npay_click THEN 1 ELSE 0 END) AS has_npay_click,
    COUNTIF(is_npay_click) AS npay_click_events,
    MAX(CASE WHEN is_purchase THEN 1 ELSE 0 END) AS has_purchase,
    COUNTIF(is_purchase) AS purchase_events,
    COUNT(DISTINCT NULLIF(transaction_id, '')) AS distinct_transaction_ids,
    SUM(IF(is_purchase, event_value, 0)) AS purchase_value
  FROM event_flags
  GROUP BY session_key
)
SELECT
  source_group,
  campaign_hint,
  COUNT(*) AS sessions,
  COUNT(DISTINCT user_pseudo_id) AS users,
  ROUND(AVG(engagement_seconds), 2) AS avg_engagement_seconds,
  COUNTIF(has_scroll_90 = 1) AS scroll90_sessions,
  COUNTIF(has_view_item = 1) AS view_item_sessions,
  COUNTIF(has_add_to_cart = 1) AS add_to_cart_sessions,
  COUNTIF(has_checkout = 1) AS begin_checkout_sessions,
  COUNTIF(has_add_payment_info = 1) AS add_payment_info_sessions,
  COUNTIF(has_npay_click = 1) AS npay_click_sessions,
  SUM(npay_click_events) AS npay_click_events,
  COUNTIF(has_purchase = 1) AS ga4_purchase_sessions,
  SUM(purchase_events) AS ga4_purchase_events,
  SUM(distinct_transaction_ids) AS distinct_transaction_ids,
  ROUND(SUM(purchase_value), 0) AS ga4_purchase_value
FROM sessions
GROUP BY source_group, campaign_hint
ORDER BY sessions DESC
LIMIT 100
`;

const renderMarkdown = (payload: ReturnType<typeof buildPayload>) => {
  const lines: string[] = [];
  lines.push("# BigQuery archive + daily export union dry-run (2026-05-10)");
  lines.push("");
  lines.push("## 5줄 요약");
  lines.push("");
  lines.push("1. GA4 daily suffix는 날짜별 raw event table이다. 신규 daily export만 보면 biocom은 2026-05-07~2026-05-09 3일치만 보여 trend 비교가 안 된다.");
  lines.push("2. 이번 dry-run은 archive 백필 `<=20260506`과 신규 daily export `>=20260507`을 합쳐 7/14/30일 window를 다시 읽었다.");
  lines.push(`3. union trend readiness는 ${payload.summary.trend_comparison_status}다. 7/14/30일이 실제로 다른 날짜 범위를 읽는지 확인했다.`);
  lines.push("4. NPay click/add_payment_info는 구매완료가 아니며, actual confirmed는 운영DB PAYMENT_COMPLETE/admin confirmed source와 조인해야 한다.");
  lines.push("5. GA4/Google Ads/Meta/TikTok/Naver 신규 전송은 하지 않았고, BigQuery read-only 조회만 수행했다.");
  lines.push("");
  lines.push("## Source / Window / Freshness");
  lines.push("");
  lines.push(`- archive source: ${payload.source.archive}`);
  lines.push(`- daily source: ${payload.source.daily}`);
  lines.push(`- job project: ${payload.source.job_project}`);
  lines.push(`- generated_at_kst: ${payload.generated_at_kst}`);
  lines.push(`- confidence: ${payload.source.confidence}`);
  lines.push("");
  lines.push("## Window Coverage");
  lines.push("");
  lines.push("| window | requested days | available suffixes | archive suffixes | daily suffixes | status | event rows |");
  lines.push("| --- | ---: | ---: | ---: | ---: | --- | ---: |");
  for (const window of payload.windows) {
    lines.push(
      `| ${window.label} | ${window.requested_days} | ${window.available_suffix_count} | ${window.archive_suffix_count} | ${window.daily_suffix_count} | ${window.coverage_status} | ${window.event_rows} |`,
    );
  }
  lines.push("");
  lines.push("## Top Funnel Rows");
  for (const window of payload.windows) {
    lines.push("");
    lines.push(`### ${window.label}`);
    lines.push("");
    lines.push("| source_group | campaign_hint | sessions | scroll90% | checkout | add_payment_info | NPay click | GA4 purchase |");
    lines.push("| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |");
    for (const row of window.funnel_by_channel_campaign.slice(0, 10)) {
      lines.push(
        `| ${row.source_group} | ${String(row.campaign_hint).replaceAll("|", "/")} | ${row.sessions} | ${row.scroll90_rate ?? ""} | ${row.begin_checkout_sessions} | ${row.add_payment_info_sessions} | ${row.npay_click_sessions} | ${row.ga4_purchase_events} |`,
      );
    }
  }
  lines.push("");
  lines.push("## 운영자 해석");
  lines.push("");
  lines.push("- `source coverage warning`은 보고 기간보다 실제 읽은 날짜가 적다는 뜻이다. 이번 union이 PASS이면 7/14/30일 추세 비교의 데이터 기반은 확보된 것이다.");
  lines.push("- 그래도 GA4 purchase는 내부 confirmed purchase의 정답이 아니다. NPay 실제 결제완료는 운영DB PAYMENT_COMPLETE/admin confirmed source를 primary로 본다.");
  lines.push("- 이 결과는 frontend에서 BigQuery coverage warning을 낮출 근거가 되지만, Google Ads upload 또는 예산 판단을 자동 승인하지 않는다.");
  lines.push("");
  lines.push("## 금지선 준수");
  lines.push("");
  lines.push("- 운영DB write 0");
  lines.push("- VM Cloud write 0");
  lines.push("- GTM Production publish 0");
  lines.push("- Google Ads/GA4/Meta/TikTok/Naver 신규 전송 0");
  lines.push("");
  return `${lines.join("\n")}\n`;
};

const normalizeFunnelRows = (rows: Row[]) =>
  rows.map((row) => ({
    ...row,
    scroll90_rate: pct(row.scroll90_sessions, row.sessions),
    view_item_rate: pct(row.view_item_sessions, row.sessions),
    add_to_cart_rate: pct(row.add_to_cart_sessions, row.sessions),
    begin_checkout_rate: pct(row.begin_checkout_sessions, row.sessions),
    add_payment_info_rate: pct(row.add_payment_info_sessions, row.sessions),
    npay_click_rate: pct(row.npay_click_sessions, row.sessions),
    ga4_purchase_rate: pct(row.ga4_purchase_sessions, row.sessions),
  }));

const sourceCounts = (suffixRows: Row[], source: string) =>
  suffixRows.filter((row) => row.source_dataset === source).length;

const buildWindowPayload = (window: WindowSpec, suffixRows: Row[], funnelRows: Row[]) => {
  const suffixes = Array.from(new Set(suffixRows.map((row) => String(row.suffix)))).sort();
  const requestedDays = inclusiveDayCount(window.startDate, window.endDate);
  const eventRows = suffixRows.reduce((sum, row) => sum + num(row.row_count), 0);
  const normalizedRows = normalizeFunnelRows(funnelRows);
  return {
    label: window.label,
    start_date: window.startDate,
    end_date: window.endDate,
    start_suffix: window.startSuffix,
    end_suffix: window.endSuffix,
    requested_days: requestedDays,
    available_suffixes: suffixes,
    available_suffix_count: suffixes.length,
    archive_suffix_count: sourceCounts(suffixRows, "archive_backfill"),
    daily_suffix_count: sourceCounts(suffixRows, "daily_export"),
    coverage_status: suffixes.length >= requestedDays ? "PASS" : "HOLD",
    event_rows: eventRows,
    latest_suffix: suffixes.at(-1) ?? "",
    oldest_suffix: suffixes[0] ?? "",
    by_suffix: suffixRows,
    summary: {
      sessions: normalizedRows.reduce((sum, row) => sum + num(row.sessions), 0),
      paid_google_sessions: normalizedRows
        .filter((row) => row.source_group === "paid_google")
        .reduce((sum, row) => sum + num(row.sessions), 0),
      paid_meta_sessions: normalizedRows
        .filter((row) => row.source_group === "paid_meta")
        .reduce((sum, row) => sum + num(row.sessions), 0),
      paid_tiktok_sessions: normalizedRows
        .filter((row) => row.source_group === "paid_tiktok")
        .reduce((sum, row) => sum + num(row.sessions), 0),
      organic_search_sessions: normalizedRows
        .filter((row) => row.source_group === "organic_search")
        .reduce((sum, row) => sum + num(row.sessions), 0),
      npay_click_sessions: normalizedRows.reduce((sum, row) => sum + num(row.npay_click_sessions), 0),
      ga4_purchase_events: normalizedRows.reduce((sum, row) => sum + num(row.ga4_purchase_events), 0),
    },
    funnel_by_channel_campaign: normalizedRows,
  };
};

const buildPayload = (
  args: ReturnType<typeof parseArgs>,
  credential: { client_email?: string; project_id?: string },
  windows: ReturnType<typeof buildWindowPayload>[],
) => {
  const allPass = windows.every((window) => window.coverage_status === "PASS");
  return {
    ok: true,
    generated_at_kst: kstNow(),
    site: "biocom",
    mode: "green_read_only_bigquery_archive_daily_union_dry_run",
    send_candidate: false,
    actual_send_candidate: false,
    upload_candidate_count: 0,
    source: {
      job_project: args.jobProject,
      archive: `${args.jobProject}.${args.archiveDataset}.events_*`,
      daily: `${args.jobProject}.${args.dailyDataset}.events_*`,
      location: args.location,
      archive_cutover_rule: `archive suffix <= ${CUTOVER_SUFFIX}`,
      daily_cutover_rule: `daily suffix >= ${DAILY_START_SUFFIX}`,
      credential_project_id: credential.project_id,
      credential_client_email: credential.client_email,
      confidence: allPass ? "A-" : "B",
    },
    summary: {
      trend_comparison_status: allPass ? "PASS" : "HOLD",
      reason:
        allPass
          ? "archive backfill and new daily export union covered requested 7/14/30 day windows"
          : "one or more windows still have fewer available suffixes than requested days",
      windows: windows.map((window) => ({
        label: window.label,
        requested_days: window.requested_days,
        available_suffix_count: window.available_suffix_count,
        coverage_status: window.coverage_status,
        event_rows: window.event_rows,
      })),
    },
    definitions: {
      ga4_daily_suffix: "GA4 BigQuery가 날짜별로 만드는 raw event table suffix. 예: events_20260509의 suffix는 20260509.",
      source_coverage_warning: "보고 기간보다 실제로 읽은 날짜가 적어 추세 비교로 쓰기 어렵다는 경고.",
      platform_roas: "Google Ads 등 광고 플랫폼이 자기 전환 action 기준으로 주장하는 ROAS. 내부 confirmed ROAS와 분리한다.",
    },
    windows,
    forbidden_actions_not_taken: [
      "Google Ads upload",
      "GA4/Meta/TikTok/Naver send",
      "GTM Production publish",
      "운영DB write",
      "VM Cloud write",
    ],
  };
};

const main = async () => {
  const args = parseArgs();
  const windows = buildWindows(args.end);
  const { bq, credential } = createBigQueryClient();
  const results = [];
  for (const window of windows) {
    const [suffixRows, funnelRows] = await Promise.all([
      runQuery(
        bq,
        args.jobProject,
        args.location,
        buildSuffixQuery(args.jobProject, args.archiveDataset, args.dailyDataset, window.startSuffix, window.endSuffix),
      ),
      runQuery(
        bq,
        args.jobProject,
        args.location,
        buildFunnelQuery(args.jobProject, args.archiveDataset, args.dailyDataset, window.startSuffix, window.endSuffix),
      ),
    ]);
    results.push(buildWindowPayload(window, suffixRows, funnelRows));
  }
  const payload = buildPayload(args, credential, results);
  if (args.output) {
    fs.mkdirSync(path.dirname(path.resolve(args.output)), { recursive: true });
    fs.writeFileSync(path.resolve(args.output), `${JSON.stringify(payload, null, 2)}\n`);
  } else {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  }
  if (args.markdownOutput) {
    fs.mkdirSync(path.dirname(path.resolve(args.markdownOutput)), { recursive: true });
    fs.writeFileSync(path.resolve(args.markdownOutput), renderMarkdown(payload));
  }
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
