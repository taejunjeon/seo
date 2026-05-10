#!/usr/bin/env tsx
import fs from "node:fs";
import path from "node:path";

import dotenv from "dotenv";
import { google, type bigquery_v2 } from "googleapis";

dotenv.config({ path: path.resolve(__dirname, "..", ".env"), quiet: true });

const DEFAULT_JOB_PROJECT = "project-dadba7dd-0229-4ff6-81c";
const DEFAULT_DATASET = "analytics_304759974";
const DEFAULT_LOCATION = "asia-northeast3";

type Row = Record<string, unknown>;

const argValue = (name: string) =>
  process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);

const parseArgs = () => ({
  start: argValue("start") ?? "2026-05-07",
  end: argValue("end") ?? "2026-05-09",
  jobProject: argValue("job-project") ?? DEFAULT_JOB_PROJECT,
  dataset: argValue("dataset") ?? DEFAULT_DATASET,
  location: argValue("location") ?? DEFAULT_LOCATION,
  output: argValue("output"),
  markdownOutput: argValue("markdown-output") ?? argValue("markdownOutput"),
});

const suffix = (date: string) => date.replaceAll("-", "");

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
  if (!response.data.jobComplete) throw new Error(`BigQuery job did not complete: ${response.data.jobReference?.jobId}`);
  return mapRows(response.data);
};

const num = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toPercent = (numValue: unknown, denomValue: unknown) => {
  const denominator = num(denomValue);
  return denominator > 0 ? Number(((num(numValue) / denominator) * 100).toFixed(2)) : null;
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

const buildQuery = (project: string, dataset: string, startSuffix: string, endSuffix: string) => `
WITH base AS (
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
    COALESCE((SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'utm_source'), '') AS utm_source,
    COALESCE((SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'utm_medium'), '') AS utm_medium,
    COALESCE((SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'utm_campaign'), '') AS utm_campaign,
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
  FROM \`${project}.${dataset}.events_*\`
  WHERE _TABLE_SUFFIX BETWEEN '${startSuffix}' AND '${endSuffix}'
),
flagged AS (
  SELECT
    *,
    CONCAT(COALESCE(user_pseudo_id, ''), '.', COALESCE(ga_session_id, '')) AS session_key,
    LOWER(ARRAY_TO_STRING([
      page_location, page_referrer, ep_source, ep_medium, ep_campaign,
      utm_source, utm_medium, utm_campaign,
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
    MAX(CASE WHEN is_npay_click THEN 1 ELSE 0 END) AS has_npay_click,
    COUNTIF(is_npay_click) AS npay_click_events,
    MAX(CASE WHEN event_name = 'add_payment_info' THEN 1 ELSE 0 END) AS has_add_payment_info,
    MAX(CASE WHEN is_purchase THEN 1 ELSE 0 END) AS has_purchase,
    COUNTIF(is_purchase) AS purchase_events,
    COUNT(DISTINCT NULLIF(transaction_id, '')) AS distinct_transaction_ids,
    SUM(IF(is_purchase, event_value, 0)) AS purchase_value,
    MAX(IF(is_google_ads, 1, 0)) AS has_google_ads_evidence,
    MAX(IF(is_meta, 1, 0)) AS has_meta_evidence
  FROM event_flags
  GROUP BY session_key
)
SELECT
  source_group,
  campaign_hint,
  COUNT(*) AS sessions,
  COUNT(DISTINCT user_pseudo_id) AS users,
  ROUND(AVG(engagement_seconds), 2) AS avg_engagement_seconds,
  APPROX_QUANTILES(engagement_seconds, 100)[OFFSET(50)] AS p50_engagement_seconds,
  APPROX_QUANTILES(engagement_seconds, 100)[OFFSET(90)] AS p90_engagement_seconds,
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
  ROUND(SUM(purchase_value), 0) AS ga4_purchase_value,
  COUNTIF(has_checkout = 1 AND has_purchase = 0) AS checkout_without_purchase_sessions,
  COUNTIF(has_npay_click = 1 AND has_purchase = 0) AS npay_click_without_purchase_sessions,
  COUNTIF(has_google_ads_evidence = 1 AND has_meta_evidence = 1) AS mixed_google_meta_sessions
FROM sessions
GROUP BY source_group, campaign_hint
ORDER BY sessions DESC
LIMIT 100
`;

const buildFreshnessQuery = (project: string, dataset: string, startSuffix: string, endSuffix: string) => `
SELECT
  MAX(_TABLE_SUFFIX) AS latest_suffix,
  COUNT(*) AS event_rows,
  MAX(TIMESTAMP_MICROS(event_timestamp)) AS max_event_ts
FROM \`${project}.${dataset}.events_*\`
WHERE _TABLE_SUFFIX BETWEEN '${startSuffix}' AND '${endSuffix}'
`;

const renderMarkdown = (payload: Record<string, unknown>) => {
  const summary = payload.summary as Record<string, unknown>;
  const rows = payload.funnel_by_channel_campaign as Array<Record<string, unknown>>;
  const lines: string[] = [];
  lines.push("# Channel/Campaign funnel quality (2026-05-10)");
  lines.push("");
  lines.push("## 5줄 요약");
  lines.push("");
  lines.push("1. GA4 BigQuery current export를 read-only로 조회해 channel/campaign별 퍼널 품질을 갱신했다.");
  lines.push(`2. 총 세션은 ${summary.sessions}건, Google Ads 세션은 ${summary.paid_google_sessions}건이다.`);
  lines.push("3. NPay click은 구매완료가 아니며, GA4 purchase와 internal confirmed match는 별도 원장 조인이 필요하다.");
  lines.push("4. scroll90, view_item, checkout, add_payment_info, NPay click, GA4 purchase를 같은 표로 분리했다.");
  lines.push("5. Google Ads/Meta/GA4 전송은 하지 않았고 send_candidate=false 상태다.");
  lines.push("");
  lines.push("## Source");
  lines.push("");
  lines.push(`- source: ${(payload.source as Record<string, unknown>).primary}`);
  lines.push(`- window: ${(payload.window as Record<string, unknown>).start_date} ~ ${(payload.window as Record<string, unknown>).end_date}`);
  lines.push(`- freshness: ${JSON.stringify(payload.freshness)}`);
  lines.push("");
  lines.push("## Top Rows");
  lines.push("");
  lines.push("| source_group | campaign_hint | sessions | scroll90% | view_item | checkout | add_payment_info | npay_click | GA4 purchase |");
  lines.push("| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |");
  for (const row of rows.slice(0, 20)) {
    lines.push(`| ${row.source_group} | ${String(row.campaign_hint).replaceAll("|", "/")} | ${row.sessions} | ${row.scroll90_rate} | ${row.view_item_sessions} | ${row.begin_checkout_sessions} | ${row.add_payment_info_sessions} | ${row.npay_click_sessions} | ${row.ga4_purchase_events} |`);
  }
  lines.push("");
  lines.push("## 해석");
  lines.push("");
  lines.push("- GA4 BigQuery는 실제 NPay 결제완료의 primary source가 아니다. 운영DB PAYMENT_COMPLETE/admin confirmed와 조인해야 한다.");
  lines.push("- NPay click/add_payment_info는 purchase가 아니며, 구매완료 후보로 승격하지 않는다.");
  lines.push("- internal confirmed match는 이번 문서에서 not_joined로 남긴다. ConfirmedPurchasePrep integrated input이 다음 조인 기준이다.");
  lines.push("");
  return `${lines.join("\n")}\n`;
};

const main = async () => {
  const args = parseArgs();
  const startSuffix = suffix(args.start);
  const endSuffix = suffix(args.end);
  const { bq, credential } = createBigQueryClient();
  const [freshnessRows, funnelRows] = await Promise.all([
    runQuery(bq, args.jobProject, args.location, buildFreshnessQuery(args.jobProject, args.dataset, startSuffix, endSuffix)),
    runQuery(bq, args.jobProject, args.location, buildQuery(args.jobProject, args.dataset, startSuffix, endSuffix)),
  ]);
  const rows = funnelRows.map((row) => ({
    ...row,
    scroll90_rate: toPercent(row.scroll90_sessions, row.sessions),
    view_item_rate: toPercent(row.view_item_sessions, row.sessions),
    add_to_cart_rate: toPercent(row.add_to_cart_sessions, row.sessions),
    begin_checkout_rate: toPercent(row.begin_checkout_sessions, row.sessions),
    add_payment_info_rate: toPercent(row.add_payment_info_sessions, row.sessions),
    npay_click_rate: toPercent(row.npay_click_sessions, row.sessions),
    ga4_purchase_rate: toPercent(row.ga4_purchase_sessions, row.sessions),
  }));
  const totalSessions = rows.reduce((sum, row) => sum + num(row.sessions), 0);
  const payload = {
    ok: true,
    generated_at_kst: kstNow(),
    site: "biocom",
    mode: "green_read_only_bigquery_channel_campaign_funnel",
    send_candidate: false,
    source: {
      primary: `${args.jobProject}.${args.dataset}.events_*`,
      location: args.location,
      credential_project_id: credential.project_id,
      credential_client_email: credential.client_email,
    },
    window: {
      start_date: args.start,
      end_date: args.end,
      timezone: "Asia/Seoul",
      table_suffix: { start: startSuffix, end: endSuffix },
    },
    freshness: freshnessRows[0] ?? {},
    summary: {
      sessions: totalSessions,
      paid_google_sessions: rows.filter((row) => row.source_group === "paid_google").reduce((sum, row) => sum + num(row.sessions), 0),
      paid_meta_sessions: rows.filter((row) => row.source_group === "paid_meta").reduce((sum, row) => sum + num(row.sessions), 0),
      paid_tiktok_sessions: rows.filter((row) => row.source_group === "paid_tiktok").reduce((sum, row) => sum + num(row.sessions), 0),
      paid_naver_sessions: rows.filter((row) => row.source_group === "paid_naver").reduce((sum, row) => sum + num(row.sessions), 0),
      organic_search_sessions: rows.filter((row) => row.source_group === "organic_search").reduce((sum, row) => sum + num(row.sessions), 0),
      npay_click_sessions: rows.reduce((sum, row) => sum + num(row.npay_click_sessions), 0),
      ga4_purchase_events: rows.reduce((sum, row) => sum + num(row.ga4_purchase_events), 0),
      internal_confirmed_join_status: "not_joined",
    },
    definitions: {
      source_group: "session-level evidence priority: Google Ads > Meta > TikTok > paid Naver > organic search > direct > other",
      npay_click: "add_payment_info/pay_method=npay/NPAY transaction_id/page npay evidence. This is not confirmed purchase.",
      internal_confirmed_match: "requires operational DB PAYMENT_COMPLETE/admin confirmed join; not provided by GA4 BigQuery alone.",
    },
    funnel_by_channel_campaign: rows,
    warnings: [
      "GA4 BigQuery cannot be primary source for NPay actual confirmed purchase.",
      "NPay click/add_payment_info is not purchase.",
      "Internal confirmed match remains not_joined until ConfirmedPurchasePrep integrated input is joined by order/session/click evidence.",
    ],
    blockers: [],
  };

  if (args.output) {
    fs.mkdirSync(path.dirname(path.resolve(args.output)), { recursive: true });
    fs.writeFileSync(path.resolve(args.output), `${JSON.stringify(payload, null, 2)}\n`);
  } else {
    console.log(JSON.stringify(payload, null, 2));
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
