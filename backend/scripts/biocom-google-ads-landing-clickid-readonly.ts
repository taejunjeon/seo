import fs from "node:fs";
import path from "node:path";

import dotenv from "dotenv";
import { google, type bigquery_v2 } from "googleapis";

dotenv.config({ path: path.resolve(__dirname, "..", ".env"), quiet: true });

const JOB_PROJECT = "project-dadba7dd-0229-4ff6-81c";
const DATASET = "analytics_304759974_hurdlers_backfill";
const LOCATION = "asia-northeast3";
const OUTPUT_DIR = path.resolve(__dirname, "..", "..", "data");

type BigQueryRow = Record<string, unknown>;

const parseArgs = () => {
  const start = process.argv.find((arg) => arg.startsWith("--start="))?.slice("--start=".length) ?? "2026-04-27";
  const end = process.argv.find((arg) => arg.startsWith("--end="))?.slice("--end=".length) ?? "2026-05-03";
  const json = process.argv.includes("--json");
  const output = process.argv.find((arg) => arg.startsWith("--output="))?.slice("--output=".length);
  const markdownOutput = process.argv.find((arg) => arg.startsWith("--markdown-output="))?.slice("--markdown-output=".length);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
    throw new Error("--start/--end must be YYYY-MM-DD");
  }
  return { start, end, json, output, markdownOutput };
};

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

const pctExpr = (num: string, den: string) => `ROUND(SAFE_DIVIDE(${num}, ${den}) * 100, 2)`;

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
    COALESCE((SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'utm_source'), '') AS utm_source,
    COALESCE((SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'utm_medium'), '') AS utm_medium,
    COALESCE((SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'utm_campaign'), '') AS utm_campaign,
    COALESCE(collected_traffic_source.manual_source, '') AS cts_source,
    COALESCE(collected_traffic_source.manual_medium, '') AS cts_medium,
    COALESCE(collected_traffic_source.manual_campaign_name, '') AS cts_campaign,
    COALESCE(collected_traffic_source.gclid, '') AS cts_gclid,
    COALESCE(session_traffic_source_last_click.google_ads_campaign.customer_id, '') AS st_gads_customer_id,
    COALESCE(session_traffic_source_last_click.google_ads_campaign.campaign_id, '') AS st_gads_campaign_id,
    COALESCE(session_traffic_source_last_click.google_ads_campaign.campaign_name, '') AS st_gads_campaign_name,
    COALESCE(session_traffic_source_last_click.manual_campaign.source, '') AS st_manual_source,
    COALESCE(session_traffic_source_last_click.manual_campaign.medium, '') AS st_manual_medium,
    COALESCE(session_traffic_source_last_click.manual_campaign.campaign_name, '') AS st_manual_campaign,
    COALESCE(session_traffic_source_last_click.cross_channel_campaign.source, '') AS st_cross_source,
    COALESCE(session_traffic_source_last_click.cross_channel_campaign.medium, '') AS st_cross_medium,
    COALESCE(session_traffic_source_last_click.cross_channel_campaign.campaign_name, '') AS st_cross_campaign
  FROM \`${JOB_PROJECT}.${DATASET}.events_*\`
  WHERE _TABLE_SUFFIX BETWEEN '${startSuffix}' AND '${endSuffix}'
),
flagged AS (
  SELECT
    *,
    CONCAT(COALESCE(user_pseudo_id, ''), '.', COALESCE(ga_session_id, '')) AS session_key,
    LOWER(ARRAY_TO_STRING([
      page_location,
      page_referrer,
      utm_source,
      utm_medium,
      utm_campaign,
      cts_source,
      cts_medium,
      cts_campaign,
      st_gads_customer_id,
      st_gads_campaign_id,
      st_gads_campaign_name,
      st_manual_source,
      st_manual_medium,
      st_manual_campaign,
      st_cross_source,
      st_cross_medium,
      st_cross_campaign
    ], ' ')) AS haystack,
    REGEXP_CONTAINS(LOWER(page_location), r'([?&]gclid=)') AS url_has_gclid,
    REGEXP_CONTAINS(LOWER(page_location), r'([?&]gbraid=)') AS url_has_gbraid,
    REGEXP_CONTAINS(LOWER(page_location), r'([?&]wbraid=)') AS url_has_wbraid,
    REGEXP_CONTAINS(LOWER(page_location), r'([?&]gad_campaignid=)') AS url_has_gad_campaignid
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
      url_has_gclid OR
      url_has_gbraid OR
      url_has_wbraid OR
      url_has_gad_campaignid OR
      REGEXP_CONTAINS(haystack, r'(^|[^a-z0-9])googleads([^a-z0-9]|$)') OR
      REGEXP_CONTAINS(haystack, r'(^|[^a-z0-9])google\\s*/\\s*(cpc|ppc|paid|paidsearch)([^a-z0-9]|$)') OR
      REGEXP_CONTAINS(haystack, r'(^|[^a-z0-9])google([^a-z0-9].*)?(cpc|ppc|paid|paidsearch)')
    ) AS is_google_ads_evidence,
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
      (
        STARTS_WITH(UPPER(transaction_id), 'NPAY') OR
        npay_recovery_source != '' OR
        STARTS_WITH(event_id, 'NPayRecoveredPurchase') OR
        LOWER(payment_method) LIKE '%naverpay%' OR
        LOWER(payment_method) LIKE '%npay%'
      )
    ) AS is_npay_purchase_like
  FROM flagged
),
sessions AS (
  SELECT
    session_key,
    ANY_VALUE(user_pseudo_id) AS user_pseudo_id,
    MIN(event_dt) AS first_dt,
    MIN(event_ts) AS first_ts,
    COUNT(*) AS event_count,
    SUM(engagement_time_msec) / 1000 AS engagement_seconds,
    ARRAY_AGG(NULLIF(page_location, '') IGNORE NULLS ORDER BY event_ts LIMIT 1)[SAFE_OFFSET(0)] AS landing_url,
    MAX(CASE WHEN is_google_ads_evidence THEN 1 ELSE 0 END) AS has_google_ads_evidence,
    MAX(CASE WHEN url_has_gclid THEN 1 ELSE 0 END) AS any_url_gclid,
    MAX(CASE WHEN url_has_gbraid THEN 1 ELSE 0 END) AS any_url_gbraid,
    MAX(CASE WHEN url_has_wbraid THEN 1 ELSE 0 END) AS any_url_wbraid,
    MAX(CASE WHEN url_has_gad_campaignid THEN 1 ELSE 0 END) AS any_url_gad_campaignid,
    MAX(CASE WHEN cts_gclid != '' THEN 1 ELSE 0 END) AS any_collected_gclid,
    MAX(CASE WHEN st_gads_campaign_id != '' THEN 1 ELSE 0 END) AS any_ga4_google_ads_campaign,
    MAX(CASE WHEN REGEXP_CONTAINS(LOWER(page_location), r'([?&](gclid|gbraid|wbraid)=)') THEN 1 ELSE 0 END) AS any_url_click_id,
    MAX(CASE WHEN REGEXP_CONTAINS(LOWER(page_location), r'([?&](gclid|gbraid|wbraid)=)') OR cts_gclid != '' THEN 1 ELSE 0 END) AS any_url_or_collected_click_id,
    MAX(CASE WHEN is_regular_checkout THEN 1 ELSE 0 END) AS has_regular_checkout,
    MAX(CASE WHEN is_npay_click THEN 1 ELSE 0 END) AS has_npay_click,
    MAX(CASE WHEN is_homepage_purchase THEN 1 ELSE 0 END) AS has_homepage_purchase,
    SUM(IF(is_homepage_purchase, event_value, 0)) AS homepage_purchase_value,
    MAX(CASE WHEN is_npay_purchase_like THEN 1 ELSE 0 END) AS has_npay_purchase_like
  FROM event_flags
  GROUP BY session_key
)
`;

const buildSummaryQuery = (startSuffix: string, endSuffix: string) => `
${buildSessionCte(startSuffix, endSuffix)}
SELECT
  COUNT(*) AS google_ads_sessions,
  COUNT(DISTINCT user_pseudo_id) AS google_ads_users,
  ROUND(AVG(engagement_seconds), 2) AS avg_engagement_seconds,
  COUNTIF(any_url_click_id = 1) AS sessions_with_url_click_id,
  ${pctExpr("COUNTIF(any_url_click_id = 1)", "COUNT(*)")} AS sessions_with_url_click_id_rate,
  COUNTIF(any_url_or_collected_click_id = 1) AS sessions_with_url_or_collected_click_id,
  ${pctExpr("COUNTIF(any_url_or_collected_click_id = 1)", "COUNT(*)")} AS sessions_with_url_or_collected_click_id_rate,
  COUNTIF(any_url_gclid = 1) AS sessions_with_url_gclid,
  COUNTIF(any_url_gbraid = 1) AS sessions_with_url_gbraid,
  COUNTIF(any_url_wbraid = 1) AS sessions_with_url_wbraid,
  COUNTIF(any_collected_gclid = 1) AS sessions_with_collected_gclid,
  COUNTIF(any_ga4_google_ads_campaign = 1) AS sessions_with_ga4_google_ads_campaign,
  COUNTIF(any_ga4_google_ads_campaign = 1 AND any_url_or_collected_click_id = 0) AS ga4_google_ads_campaign_without_click_id_sessions,
  ${pctExpr("COUNTIF(any_ga4_google_ads_campaign = 1 AND any_url_or_collected_click_id = 0)", "COUNTIF(any_ga4_google_ads_campaign = 1)")} AS ga4_google_ads_campaign_without_click_id_rate,
  COUNTIF(has_regular_checkout = 1) AS regular_checkout_sessions,
  ${pctExpr("COUNTIF(has_regular_checkout = 1)", "COUNT(*)")} AS regular_checkout_rate,
  COUNTIF(has_regular_checkout = 1 AND any_url_or_collected_click_id = 1) AS regular_checkout_with_click_id_sessions,
  ${pctExpr("COUNTIF(has_regular_checkout = 1 AND any_url_or_collected_click_id = 1)", "COUNTIF(has_regular_checkout = 1)")} AS regular_checkout_with_click_id_rate,
  COUNTIF(has_npay_click = 1) AS npay_click_sessions,
  ${pctExpr("COUNTIF(has_npay_click = 1)", "COUNT(*)")} AS npay_click_rate,
  COUNTIF(has_npay_click = 1 AND any_url_or_collected_click_id = 1) AS npay_click_with_click_id_sessions,
  ${pctExpr("COUNTIF(has_npay_click = 1 AND any_url_or_collected_click_id = 1)", "COUNTIF(has_npay_click = 1)")} AS npay_click_with_click_id_rate,
  COUNTIF(has_homepage_purchase = 1) AS homepage_purchase_sessions,
  ${pctExpr("COUNTIF(has_homepage_purchase = 1)", "COUNT(*)")} AS homepage_purchase_rate,
  ROUND(SUM(homepage_purchase_value), 0) AS homepage_purchase_value,
  COUNTIF(has_homepage_purchase = 1 AND any_url_or_collected_click_id = 1) AS homepage_purchase_with_click_id_sessions,
  ${pctExpr("COUNTIF(has_homepage_purchase = 1 AND any_url_or_collected_click_id = 1)", "COUNTIF(has_homepage_purchase = 1)")} AS homepage_purchase_with_click_id_rate,
  COUNTIF(has_npay_purchase_like = 1) AS ga4_npay_purchase_like_sessions,
  COUNTIF(has_npay_purchase_like = 1 AND any_url_or_collected_click_id = 1) AS ga4_npay_purchase_like_with_click_id_sessions
FROM sessions
WHERE has_google_ads_evidence = 1
`;

const buildSampleQuery = (startSuffix: string, endSuffix: string) => `
${buildSessionCte(startSuffix, endSuffix)}
SELECT
  session_key,
  first_dt,
  FORMAT_TIMESTAMP('%Y-%m-%d %H:%M:%S', first_ts, 'Asia/Seoul') AS first_ts_kst,
  any_url_click_id,
  any_collected_gclid,
  any_ga4_google_ads_campaign,
  has_regular_checkout,
  has_npay_click,
  has_homepage_purchase,
  ROUND(homepage_purchase_value, 0) AS homepage_purchase_value,
  REGEXP_REPLACE(COALESCE(landing_url, ''), r'(gclid|gbraid|wbraid)=([^&]+)', r'\\1=REDACTED') AS landing_url_redacted
FROM sessions
WHERE has_google_ads_evidence = 1
ORDER BY has_homepage_purchase DESC, has_regular_checkout DESC, has_npay_click DESC, any_url_or_collected_click_id DESC, first_ts DESC
LIMIT 12
`;

const value = (row: BigQueryRow, key: string) => {
  const raw = row[key];
  if (raw === undefined || raw === null || raw === "") return 0;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : raw;
};

const formatKst = (date = new Date()) =>
  new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date) + " KST";

const mdEscape = (input: unknown) => String(input ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
const truncate = (input: unknown, max = 120) => {
  const text = String(input ?? "");
  return text.length > max ? `${text.slice(0, max)}...` : text;
};

const mdTable = (headers: string[], rows: unknown[][]) => [
  `| ${headers.map(mdEscape).join(" | ")} |`,
  `| ${headers.map(() => "---").join(" | ")} |`,
  ...rows.map((row) => `| ${row.map(mdEscape).join(" | ")} |`),
].join("\n");

const renderMarkdown = (result: any) => {
  const summary = result.summary;
  return [
    "# Google Ads landing-session click id 분모 분석",
    "",
    `작성 시각: ${result.generated_at_kst}`,
    `기간: ${result.range.startDate} ~ ${result.range.endDate}`,
    "문서 성격: read-only BigQuery 분석. GTM publish, Google Ads 전송, 운영 DB write 없음.",
    "",
    "## 10초 결론",
    "",
    `GA4 BigQuery 기준 Google Ads 증거가 있는 세션은 ${value(summary, "google_ads_sessions").toLocaleString("ko-KR")}개다.`,
    `이 중 URL 또는 collected_traffic_source에 Google click id가 남은 세션은 ${value(summary, "sessions_with_url_or_collected_click_id").toLocaleString("ko-KR")}개, 보존률은 ${value(summary, "sessions_with_url_or_collected_click_id_rate")}%다.`,
    `GA4가 Google Ads 캠페인으로 인식한 세션 중 click id가 raw에 남지 않은 비율은 ${value(summary, "ga4_google_ads_campaign_without_click_id_rate")}%다.`,
    "즉 Google Ads 랜딩 세션에는 click id가 대부분 남아 있다. 병목은 광고 URL이 아니라 랜딩 이후 checkout/NPay/결제완료 주문 원장까지 click id가 살아남지 않는 것이다.",
    "",
    "## 핵심 숫자",
    "",
    mdTable(
      ["metric", "value"],
      Object.entries(summary).map(([key, val]) => [key, val]),
    ),
    "",
    "## 샘플",
    "",
    mdTable(
      ["session", "first_ts_kst", "click_id", "gads_campaign", "checkout", "npay", "homepage_purchase", "value", "landing_url"],
      result.samples.map((row: BigQueryRow) => [
        row.session_key,
        row.first_ts_kst,
        Number(row.any_url_click_id) || Number(row.any_collected_gclid) ? "Y" : "N",
        Number(row.any_ga4_google_ads_campaign) ? "Y" : "N",
        Number(row.has_regular_checkout) ? "Y" : "N",
        Number(row.has_npay_click) ? "Y" : "N",
        Number(row.has_homepage_purchase) ? "Y" : "N",
        row.homepage_purchase_value,
        truncate(row.landing_url_redacted),
      ]),
    ),
    "",
    "## 해석",
    "",
    "- 이 분석은 GA4 BigQuery raw만 사용한다. 운영 주문 confirmed 여부는 별도 운영 DB/Attribution VM 조인이 필요하다.",
    "- `gclid/gbraid/wbraid`가 raw에 남은 세션과 Google Ads 캠페인 attribution이 있는 세션은 같은 개념이 아니다.",
    "- 운영 GTM에 `paid_click_intent`를 게시하면, 현재 raw에서 비는 Google click id를 랜딩 시점 storage/no-send ledger로 보강할 수 있다.",
    "- NPay 실제 결제완료는 purchase 후보에 포함해야 하지만, NPay click/count/payment start는 purchase가 아니다.",
  ].join("\n");
};

const main = async () => {
  const args = parseArgs();
  const startSuffix = suffix(args.start);
  const endSuffix = suffix(args.end);
  const { bq, credential } = createBigQueryClient();
  const [summaryRows, sampleRows] = await Promise.all([
    runQuery(bq, buildSummaryQuery(startSuffix, endSuffix)),
    runQuery(bq, buildSampleQuery(startSuffix, endSuffix)),
  ]);
  const result = {
    generated_at: new Date().toISOString(),
    generated_at_kst: formatKst(),
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
    },
    definitions: {
      google_ads_session:
        "GA4 last-click google_ads_campaign, collected gclid, URL gclid/gbraid/wbraid/gad_campaignid, or Google paid UTM evidence.",
      url_or_collected_click_id:
        "page_location gclid/gbraid/wbraid or collected_traffic_source.gclid. gad_campaignid is campaign evidence and is reported separately, not counted as click id.",
      regular_checkout:
        "begin_checkout event on /shop_payment/. Non-NPay purchase button -> checkout proxy.",
      npay_click:
        "add_payment_info with npay evidence. Intent/click, not confirmed purchase.",
      homepage_purchase:
        "GA4 purchase not starting NPAY and not explicitly NPay recovery.",
    },
    summary: summaryRows[0] ?? {},
    samples: sampleRows,
    next_steps: [
      "Use this denominator alongside operational confirmed order click id rate.",
      "Prepare GTM Production publish approval for paid_click_intent v1.",
      "Keep Google Ads conversion action changes and conversion upload blocked until post-publish fill-rate improves.",
    ],
  };

  const outputPath = path.resolve(args.output ?? path.join(OUTPUT_DIR, `google-ads-landing-clickid-${args.start}_${args.end}.json`));
  const markdownPath = args.markdownOutput ? path.resolve(args.markdownOutput) : null;
  fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`);
  if (markdownPath) fs.writeFileSync(markdownPath, `${renderMarkdown(result)}\n`);
  if (args.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  console.log(JSON.stringify({
    outputPath,
    markdownPath,
    summary: result.summary,
  }, null, 2));
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
