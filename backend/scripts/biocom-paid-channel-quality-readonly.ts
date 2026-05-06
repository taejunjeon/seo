import path from "node:path";

import dotenv from "dotenv";
import { google, type bigquery_v2 } from "googleapis";

dotenv.config({ path: path.resolve(__dirname, "..", ".env"), quiet: true });

const JOB_PROJECT = "project-dadba7dd-0229-4ff6-81c";
const DATASET = "analytics_304759974_hurdlers_backfill";
const LOCATION = "asia-northeast3";

type BigQueryRow = Record<string, unknown>;

const parseArgs = () => {
  const start =
    process.argv.find((arg) => arg.startsWith("--start="))?.slice("--start=".length) ??
    "2026-04-06";
  const end =
    process.argv.find((arg) => arg.startsWith("--end="))?.slice("--end=".length) ??
    "2026-05-03";
  const json = process.argv.includes("--json");

  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
    throw new Error("--start/--end must be YYYY-MM-DD");
  }

  return { start, end, json };
};

const suffix = (date: string) => date.replaceAll("-", "");

const parseServiceAccount = () => {
  const raw =
    process.env.GA4_BIOCOM_SERVICE_ACCOUNT_KEY?.trim() ||
    process.env.GA4_SERVICE_ACCOUNT_KEY?.trim();
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
    scopes: [
      "https://www.googleapis.com/auth/bigquery",
      "https://www.googleapis.com/auth/cloud-platform",
    ],
  });
  return {
    bq: google.bigquery({ version: "v2", auth }),
    credential: {
      client_email: key.client_email,
      project_id: key.project_id,
    },
  };
};

const mapRows = (response: bigquery_v2.Schema$QueryResponse): BigQueryRow[] => {
  const fields = response.schema?.fields ?? [];
  return (response.rows ?? []).map((row) =>
    Object.fromEntries((row.f ?? []).map((cell, index) => [fields[index]?.name ?? String(index), cell.v])),
  );
};

const runQuery = async (bq: bigquery_v2.Bigquery, query: string) => {
  const response = await bq.jobs.query({
    projectId: JOB_PROJECT,
    requestBody: {
      query,
      useLegacySql: false,
      location: LOCATION,
      timeoutMs: 120_000,
      maxResults: 10_000,
    },
  });

  if (!response.data.jobComplete) {
    throw new Error(`BigQuery job did not complete in timeout: ${response.data.jobReference?.jobId ?? "unknown"}`);
  }

  return mapRows(response.data);
};

const buildSessionCte = (startSuffix: string, endSuffix: string) => `
WITH base AS (
  SELECT
    _TABLE_SUFFIX AS suffix,
    PARSE_DATE('%Y%m%d', event_date) AS event_dt,
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
    COALESCE((SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'event_id'), '') AS event_id,
    COALESCE((SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'npay_recovery_source'), '') AS npay_recovery_source,
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
    COALESCE((SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'term'), '') AS ep_term,
    COALESCE((SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'utm_source'), '') AS utm_source,
    COALESCE((SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'utm_medium'), '') AS utm_medium,
    COALESCE((SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'utm_campaign'), '') AS utm_campaign,
    COALESCE((SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'utm_content'), '') AS utm_content,
    COALESCE(
      (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'utm_term'),
      CAST((SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'utm_term') AS STRING),
      ''
    ) AS utm_term,
    COALESCE(collected_traffic_source.manual_source, '') AS cts_source,
    COALESCE(collected_traffic_source.manual_medium, '') AS cts_medium,
    COALESCE(collected_traffic_source.manual_campaign_name, '') AS cts_campaign,
    COALESCE(collected_traffic_source.manual_content, '') AS cts_content,
    COALESCE(collected_traffic_source.manual_term, '') AS cts_term,
    COALESCE(collected_traffic_source.gclid, '') AS cts_gclid,
    COALESCE(session_traffic_source_last_click.manual_campaign.source, '') AS st_manual_source,
    COALESCE(session_traffic_source_last_click.manual_campaign.medium, '') AS st_manual_medium,
    COALESCE(session_traffic_source_last_click.manual_campaign.campaign_name, '') AS st_manual_campaign,
    COALESCE(session_traffic_source_last_click.google_ads_campaign.customer_id, '') AS st_gads_customer_id,
    COALESCE(session_traffic_source_last_click.google_ads_campaign.campaign_id, '') AS st_gads_campaign_id,
    COALESCE(session_traffic_source_last_click.google_ads_campaign.campaign_name, '') AS st_gads_campaign_name,
    COALESCE(session_traffic_source_last_click.cross_channel_campaign.source, '') AS st_cross_source,
    COALESCE(session_traffic_source_last_click.cross_channel_campaign.medium, '') AS st_cross_medium,
    COALESCE(session_traffic_source_last_click.cross_channel_campaign.campaign_name, '') AS st_cross_campaign,
    COALESCE(session_traffic_source_last_click.cross_channel_campaign.default_channel_group, '') AS st_default_channel_group
  FROM \`${JOB_PROJECT}.${DATASET}.events_*\`
  WHERE _TABLE_SUFFIX BETWEEN '${startSuffix}' AND '${endSuffix}'
),
flagged AS (
  SELECT
    *,
    CONCAT(COALESCE(user_pseudo_id, ''), '.', COALESCE(ga_session_id, '')) AS session_key,
    LOWER(ARRAY_TO_STRING([
      page_location, page_referrer,
      ep_source, ep_medium, ep_campaign, ep_content, ep_term,
      utm_source, utm_medium, utm_campaign, utm_content, utm_term,
      cts_source, cts_medium, cts_campaign, cts_content, cts_term,
      st_manual_source, st_manual_medium, st_manual_campaign,
      st_gads_customer_id, st_gads_campaign_id, st_gads_campaign_name,
      st_cross_source, st_cross_medium, st_cross_campaign, st_default_channel_group
    ], ' ')) AS haystack
  FROM base
  WHERE user_pseudo_id IS NOT NULL AND ga_session_id IS NOT NULL
),
event_flags AS (
  SELECT
    *,
    (
      st_gads_customer_id != '' OR
      st_gads_campaign_id != '' OR
      cts_gclid != '' OR
      REGEXP_CONTAINS(LOWER(page_location), r'([?&](gclid|gbraid|wbraid|gad_source|gad_campaignid)=)') OR
      REGEXP_CONTAINS(haystack, r'(^|[^a-z0-9])googleads([^a-z0-9]|$)') OR
      REGEXP_CONTAINS(haystack, r'(^|[^a-z0-9])google\\s*/\\s*(cpc|ppc|paid|paidsearch)([^a-z0-9]|$)') OR
      REGEXP_CONTAINS(haystack, r'(^|[^a-z0-9])google([^a-z0-9].*)?(cpc|ppc|paid|paidsearch)')
    ) AS is_google_ads_evidence,
    (
      REGEXP_CONTAINS(LOWER(page_location), r'([?&]fbclid=)') OR
      REGEXP_CONTAINS(haystack, r'(^|[^a-z0-9])(facebook|instagram|meta)([^a-z0-9]|$)') OR
      REGEXP_CONTAINS(haystack, r'(^|[^a-z0-9])(fb|ig)($|[^a-z0-9])') OR
      STARTS_WITH(LOWER(ep_campaign), 'meta_') OR
      STARTS_WITH(LOWER(ep_content), 'meta_') OR
      STARTS_WITH(LOWER(utm_campaign), 'meta_') OR
      STARTS_WITH(LOWER(utm_content), 'meta_')
    ) AS is_meta_evidence,
    (
      event_name = 'add_payment_info' AND
      (
        LOWER(pay_method) = 'npay' OR
        STARTS_WITH(UPPER(transaction_id), 'NPAY') OR
        LOWER(page_location) LIKE '%npay%'
      )
    ) AS is_npay_click,
    (event_name = 'begin_checkout' AND LOWER(page_location) LIKE '%/shop_payment/%') AS is_regular_checkout,
    (
      event_name = 'purchase' AND
      (LOWER(pay_method) = 'homepage' OR pay_method = '') AND
      NOT STARTS_WITH(UPPER(transaction_id), 'NPAY')
    ) AS is_homepage_purchase,
    (
      event_name = 'purchase' AND
      STARTS_WITH(UPPER(transaction_id), 'NPAY')
    ) AS is_legacy_npay_purchase_like,
    (
      event_name = 'purchase' AND
      (
        npay_recovery_source != '' OR
        STARTS_WITH(event_id, 'NPayRecoveredPurchase') OR
        LOWER(payment_method) LIKE '%naverpay%' OR
        LOWER(payment_method) LIKE '%npay%'
      )
    ) AS is_npay_mp_recovery_purchase
  FROM flagged
),
sessions AS (
  SELECT
    session_key,
    ANY_VALUE(user_pseudo_id) AS user_pseudo_id,
    MIN(event_dt) AS first_dt,
    MAX(event_dt) AS last_dt,
    MIN(event_ts) AS first_ts,
    MAX(event_ts) AS last_ts,
    COUNT(*) AS event_count,
    SUM(engagement_time_msec) / 1000 AS engagement_seconds,
    TIMESTAMP_DIFF(MAX(event_ts), MIN(event_ts), SECOND) AS duration_span_seconds,
    MAX(percent_scrolled) AS max_percent_scrolled,
    COUNTIF(event_name = 'scroll') AS scroll_events,
    MAX(CASE WHEN event_name = 'scroll' OR percent_scrolled >= 90 THEN 1 ELSE 0 END) AS has_scroll_90,
    MAX(CASE WHEN event_name = 'view_item' THEN 1 ELSE 0 END) AS has_view_item,
    MAX(CASE WHEN event_name = 'add_to_cart' THEN 1 ELSE 0 END) AS has_add_to_cart,
    MAX(CASE WHEN is_regular_checkout THEN 1 ELSE 0 END) AS has_regular_checkout,
    COUNTIF(is_regular_checkout) AS regular_checkout_events,
    MAX(CASE WHEN is_npay_click THEN 1 ELSE 0 END) AS has_npay_click,
    COUNTIF(is_npay_click) AS npay_click_events,
    MAX(CASE WHEN is_homepage_purchase THEN 1 ELSE 0 END) AS has_homepage_purchase,
    COUNTIF(is_homepage_purchase) AS homepage_purchase_events,
    SUM(IF(is_homepage_purchase, event_value, 0)) AS homepage_purchase_value,
    MAX(CASE WHEN is_legacy_npay_purchase_like THEN 1 ELSE 0 END) AS has_legacy_npay_purchase_like,
    COUNTIF(is_legacy_npay_purchase_like) AS legacy_npay_purchase_like_events,
    SUM(IF(is_legacy_npay_purchase_like, event_value, 0)) AS legacy_npay_purchase_like_value,
    MAX(CASE WHEN is_npay_mp_recovery_purchase THEN 1 ELSE 0 END) AS has_npay_mp_recovery_purchase,
    COUNTIF(is_npay_mp_recovery_purchase) AS npay_mp_recovery_purchase_events,
    SUM(IF(is_npay_mp_recovery_purchase, event_value, 0)) AS npay_mp_recovery_purchase_value,
    MAX(CASE WHEN is_google_ads_evidence THEN 1 ELSE 0 END) AS has_google_ads_evidence,
    MAX(CASE WHEN is_meta_evidence THEN 1 ELSE 0 END) AS has_meta_evidence,
    ARRAY_AGG(DISTINCT NULLIF(ep_campaign, '') IGNORE NULLS LIMIT 5) AS ep_campaigns,
    ARRAY_AGG(DISTINCT NULLIF(st_gads_campaign_name, '') IGNORE NULLS LIMIT 5) AS gads_campaigns,
    ARRAY_AGG(DISTINCT NULLIF(st_cross_campaign, '') IGNORE NULLS LIMIT 5) AS cross_campaigns,
    ARRAY_AGG(DISTINCT NULLIF(utm_campaign, '') IGNORE NULLS LIMIT 5) AS utm_campaigns
  FROM event_flags
  GROUP BY session_key
),
channel_sessions AS (
  SELECT 'google_ads' AS channel, * FROM sessions WHERE has_google_ads_evidence = 1
  UNION ALL
  SELECT 'meta' AS channel, * FROM sessions WHERE has_meta_evidence = 1
)
`;

const buildSummaryQuery = (startSuffix: string, endSuffix: string) => `
${buildSessionCte(startSuffix, endSuffix)}
SELECT
  channel,
  COUNT(*) AS sessions,
  COUNT(DISTINCT user_pseudo_id) AS users,
  ROUND(AVG(engagement_seconds), 2) AS avg_engagement_seconds,
  APPROX_QUANTILES(engagement_seconds, 100)[OFFSET(50)] AS p50_engagement_seconds,
  APPROX_QUANTILES(engagement_seconds, 100)[OFFSET(75)] AS p75_engagement_seconds,
  APPROX_QUANTILES(engagement_seconds, 100)[OFFSET(90)] AS p90_engagement_seconds,
  COUNTIF(engagement_seconds >= 45) AS sessions_ge_45s,
  ROUND(SAFE_DIVIDE(COUNTIF(engagement_seconds >= 45), COUNT(*)) * 100, 2) AS sessions_ge_45s_rate,
  COUNTIF(engagement_seconds >= 90) AS sessions_ge_90s,
  ROUND(SAFE_DIVIDE(COUNTIF(engagement_seconds >= 90), COUNT(*)) * 100, 2) AS sessions_ge_90s_rate,
  COUNTIF(has_scroll_90 = 1) AS scroll90_sessions,
  ROUND(SAFE_DIVIDE(COUNTIF(has_scroll_90 = 1), COUNT(*)) * 100, 2) AS scroll90_rate,
  SUM(scroll_events) AS scroll_events,
  COUNTIF(has_view_item = 1) AS view_item_sessions,
  ROUND(SAFE_DIVIDE(COUNTIF(has_view_item = 1), COUNT(*)) * 100, 2) AS view_item_rate,
  COUNTIF(has_add_to_cart = 1) AS add_to_cart_sessions,
  ROUND(SAFE_DIVIDE(COUNTIF(has_add_to_cart = 1), COUNT(*)) * 100, 2) AS add_to_cart_rate,
  COUNTIF(has_regular_checkout = 1) AS regular_checkout_sessions,
  ROUND(SAFE_DIVIDE(COUNTIF(has_regular_checkout = 1), COUNT(*)) * 100, 2) AS regular_checkout_rate,
  SUM(regular_checkout_events) AS regular_checkout_events,
  COUNTIF(has_regular_checkout = 1 AND has_npay_click = 0) AS regular_checkout_no_npay_sessions,
  ROUND(SAFE_DIVIDE(COUNTIF(has_regular_checkout = 1 AND has_npay_click = 0), COUNT(*)) * 100, 2) AS regular_checkout_no_npay_rate,
  COUNTIF(has_npay_click = 1) AS npay_click_sessions,
  ROUND(SAFE_DIVIDE(COUNTIF(has_npay_click = 1), COUNT(*)) * 100, 2) AS npay_click_rate,
  SUM(npay_click_events) AS npay_click_events,
  COUNTIF(has_homepage_purchase = 1) AS homepage_purchase_sessions,
  ROUND(SAFE_DIVIDE(COUNTIF(has_homepage_purchase = 1), COUNT(*)) * 100, 2) AS homepage_purchase_rate,
  SUM(homepage_purchase_events) AS homepage_purchase_events,
  ROUND(SUM(homepage_purchase_value), 0) AS homepage_purchase_value,
  COUNTIF(has_legacy_npay_purchase_like = 1) AS legacy_npay_purchase_like_sessions,
  SUM(legacy_npay_purchase_like_events) AS legacy_npay_purchase_like_events,
  ROUND(SUM(legacy_npay_purchase_like_value), 0) AS legacy_npay_purchase_like_value,
  COUNTIF(has_npay_mp_recovery_purchase = 1) AS npay_mp_recovery_purchase_sessions,
  SUM(npay_mp_recovery_purchase_events) AS npay_mp_recovery_purchase_events,
  ROUND(SUM(npay_mp_recovery_purchase_value), 0) AS npay_mp_recovery_purchase_value,
  ROUND(AVG(IF(has_homepage_purchase = 1, engagement_seconds, NULL)), 2) AS purchaser_avg_engagement_seconds,
  APPROX_QUANTILES(IF(has_homepage_purchase = 1, engagement_seconds, NULL), 100 IGNORE NULLS)[OFFSET(50)] AS purchaser_p50_engagement_seconds,
  COUNTIF(has_google_ads_evidence = 1 AND has_meta_evidence = 1) AS mixed_google_meta_sessions
FROM channel_sessions
GROUP BY channel
ORDER BY channel
`;

const buildTopCampaignQuery = (startSuffix: string, endSuffix: string) => `
${buildSessionCte(startSuffix, endSuffix)}
SELECT
  channel,
  COALESCE(
    NULLIF(ARRAY_TO_STRING(gads_campaigns, ', '), ''),
    NULLIF(ARRAY_TO_STRING(ep_campaigns, ', '), ''),
    NULLIF(ARRAY_TO_STRING(utm_campaigns, ', '), ''),
    NULLIF(ARRAY_TO_STRING(cross_campaigns, ', '), ''),
    '(not set)'
  ) AS campaign_hint,
  COUNT(*) AS sessions,
  ROUND(AVG(engagement_seconds), 2) AS avg_engagement_seconds,
  COUNTIF(has_regular_checkout = 1) AS regular_checkout_sessions,
  COUNTIF(has_npay_click = 1) AS npay_click_sessions,
  COUNTIF(has_homepage_purchase = 1) AS homepage_purchase_sessions,
  ROUND(SUM(homepage_purchase_value), 0) AS homepage_purchase_value
FROM channel_sessions
GROUP BY channel, campaign_hint
ORDER BY channel, sessions DESC
LIMIT 30
`;

const buildLeakageQuery = (startSuffix: string, endSuffix: string) => `
${buildSessionCte(startSuffix, endSuffix)}
SELECT
  channel,
  COUNT(*) AS sessions,
  COUNTIF(has_view_item = 1) AS view_item_sessions,
  ROUND(SAFE_DIVIDE(COUNTIF(has_view_item = 1), COUNT(*)) * 100, 2) AS view_item_rate,
  COUNTIF(has_add_to_cart = 1) AS add_to_cart_sessions,
  ROUND(SAFE_DIVIDE(COUNTIF(has_add_to_cart = 1), COUNT(*)) * 100, 2) AS add_to_cart_rate,
  COUNTIF(has_regular_checkout = 1) AS begin_checkout_sessions,
  ROUND(SAFE_DIVIDE(COUNTIF(has_regular_checkout = 1), COUNT(*)) * 100, 2) AS begin_checkout_rate,
  COUNTIF(
    has_regular_checkout = 1
    AND has_homepage_purchase = 0
    AND has_legacy_npay_purchase_like = 0
    AND has_npay_mp_recovery_purchase = 0
  ) AS begin_checkout_without_ga4_purchase_sessions,
  ROUND(
    SAFE_DIVIDE(
      COUNTIF(
        has_regular_checkout = 1
        AND has_homepage_purchase = 0
        AND has_legacy_npay_purchase_like = 0
        AND has_npay_mp_recovery_purchase = 0
      ),
      COUNTIF(has_regular_checkout = 1)
    ) * 100,
    2
  ) AS begin_checkout_without_ga4_purchase_rate_among_checkout,
  COUNTIF(has_npay_click = 1) AS npay_click_sessions,
  ROUND(SAFE_DIVIDE(COUNTIF(has_npay_click = 1), COUNT(*)) * 100, 2) AS npay_click_rate,
  COUNTIF(
    has_npay_click = 1
    AND has_legacy_npay_purchase_like = 0
    AND has_npay_mp_recovery_purchase = 0
  ) AS npay_click_without_ga4_npay_purchase_sessions,
  ROUND(
    SAFE_DIVIDE(
      COUNTIF(
        has_npay_click = 1
        AND has_legacy_npay_purchase_like = 0
        AND has_npay_mp_recovery_purchase = 0
      ),
      COUNTIF(has_npay_click = 1)
    ) * 100,
    2
  ) AS npay_click_without_ga4_npay_purchase_rate_among_npay_click,
  COUNTIF(has_homepage_purchase = 1) AS homepage_purchase_sessions,
  ROUND(SAFE_DIVIDE(COUNTIF(has_homepage_purchase = 1), COUNT(*)) * 100, 2) AS homepage_purchase_rate,
  ROUND(SUM(homepage_purchase_value), 0) AS homepage_purchase_value,
  COUNTIF(has_homepage_purchase = 1 AND has_regular_checkout = 0) AS homepage_purchase_without_checkout_sessions,
  COUNTIF(has_view_item = 1 AND has_regular_checkout = 0 AND has_npay_click = 0 AND has_homepage_purchase = 0) AS view_item_only_no_checkout_sessions,
  COUNTIF(has_add_to_cart = 1 AND has_regular_checkout = 0 AND has_npay_click = 0 AND has_homepage_purchase = 0) AS add_to_cart_without_checkout_sessions,
  COUNTIF(has_scroll_90 = 1 AND has_homepage_purchase = 0 AND has_npay_click = 0 AND has_regular_checkout = 0) AS deep_scroll_no_commerce_sessions,
  COUNTIF(has_google_ads_evidence = 1 AND has_meta_evidence = 1) AS mixed_google_meta_sessions
FROM channel_sessions
GROUP BY channel
ORDER BY channel
`;

const main = async () => {
  const args = parseArgs();
  const startSuffix = suffix(args.start);
  const endSuffix = suffix(args.end);
  const { bq, credential } = createBigQueryClient();

  const [summary, topCampaigns, leakage] = await Promise.all([
    runQuery(bq, buildSummaryQuery(startSuffix, endSuffix)),
    runQuery(bq, buildTopCampaignQuery(startSuffix, endSuffix)),
    runQuery(bq, buildLeakageQuery(startSuffix, endSuffix)),
  ]);

  const result = {
    generatedAt: new Date().toISOString(),
    source: {
      dataset: `${JOB_PROJECT}.${DATASET}.events_*`,
      jobProject: JOB_PROJECT,
      location: LOCATION,
      credential,
      mode: "read-only SELECT",
    },
    range: {
      startDate: args.start,
      endDate: args.end,
      tableSuffix: { start: startSuffix, end: endSuffix },
      timezoneNote: "GA4 event_date table suffix. Report interprets as GA4 property date; archive latest is 2026-05-03.",
    },
    definitions: {
      googleAds:
        "session has Google Ads evidence: GA4 last-click google_ads_campaign, gclid/gbraid/wbraid/gad_campaignid, or googleads/google cpc UTM evidence.",
      meta:
        "session has Meta evidence: fbclid, facebook/instagram/meta source/campaign evidence, or meta_* UTM evidence.",
      regularCheckout:
        "begin_checkout event on /shop_payment/. This is the best current GA4 proxy for non-NPay purchase button -> checkout start.",
      npayClick:
        "add_payment_info with pay_method=npay, NPAY transaction_id, or npay page evidence. This is intent/click, not confirmed purchase.",
      legacyNpayPurchaseLike:
        "purchase events with transaction_id starting NPAY. In 2026-04-21~24 these are legacy NPay click/purchase-like pollution, not confirmed purchase truth.",
      npayMpRecoveryPurchase:
        "purchase events with npay_recovery_source/payment_method/event_id from server MP recovery tests. These are separated from legacy NPay click pollution.",
      scroll:
        "GA4 scroll event / percent_scrolled=90. It is 90% reached rate, not continuous 10/25/50/75/90 depth distribution.",
      engagement:
        "sum(event_params.engagement_time_msec) per session. More reliable than purchase-event-filtered averageSessionDuration, but still GA4 collection dependent.",
      leakage:
        "BigQuery-only funnel buckets. NPay confirmed order and internal order mismatch cannot be finalized here; those require operational DB / Attribution VM order-level join.",
    },
    summary,
    topCampaigns,
    leakage,
  };

  if (args.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(JSON.stringify(result, null, 2));
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
