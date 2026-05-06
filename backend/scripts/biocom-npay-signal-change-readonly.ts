import path from "node:path";

import dotenv from "dotenv";
import { google, type bigquery_v2 } from "googleapis";

dotenv.config({ path: path.resolve(__dirname, "..", ".env"), quiet: true });

const JOB_PROJECT = "project-dadba7dd-0229-4ff6-81c";
const DATASET = "analytics_304759974_hurdlers_backfill";
const LOCATION = "asia-northeast3";

type BigQueryRow = Record<string, unknown>;

const parseArgs = () => {
  const start = process.argv.find((arg) => arg.startsWith("--start="))?.slice("--start=".length) ?? "2026-04-18";
  const end = process.argv.find((arg) => arg.startsWith("--end="))?.slice("--end=".length) ?? "2026-05-03";
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

const dailyQuery = (startSuffix: string, endSuffix: string) => `
WITH base AS (
  SELECT
    PARSE_DATE('%Y%m%d', event_date) AS event_dt,
    TIMESTAMP_MICROS(event_timestamp) AS event_ts,
    event_name,
    user_pseudo_id,
    CONCAT(user_pseudo_id, '.', CAST((SELECT value.int_value FROM UNNEST(event_params) WHERE key='ga_session_id') AS STRING)) AS session_key,
    COALESCE((SELECT value.string_value FROM UNNEST(event_params) WHERE key='pay_method'), '') AS pay_method,
    COALESCE((SELECT value.string_value FROM UNNEST(event_params) WHERE key='payment_method'), '') AS payment_method,
    COALESCE((SELECT value.string_value FROM UNNEST(event_params) WHERE key='event_id'), '') AS event_id,
    COALESCE((SELECT value.string_value FROM UNNEST(event_params) WHERE key='npay_recovery_source'), '') AS npay_recovery_source,
    COALESCE((SELECT value.string_value FROM UNNEST(event_params) WHERE key='page_location'), '') AS page_location,
    COALESCE((SELECT value.string_value FROM UNNEST(event_params) WHERE key='transaction_id'), ecommerce.transaction_id, '') AS transaction_id,
    COALESCE(
      (SELECT value.double_value FROM UNNEST(event_params) WHERE key='value'),
      CAST((SELECT value.int_value FROM UNNEST(event_params) WHERE key='value') AS FLOAT64),
      ecommerce.purchase_revenue,
      0
    ) AS event_value
  FROM \`${JOB_PROJECT}.${DATASET}.events_*\`
  WHERE _TABLE_SUFFIX BETWEEN '${startSuffix}' AND '${endSuffix}'
),
classified AS (
  SELECT
    *,
    event_name = 'add_payment_info'
      AND (
        LOWER(pay_method) = 'npay'
        OR STARTS_WITH(UPPER(transaction_id), 'NPAY')
        OR LOWER(page_location) LIKE '%npay%'
      ) AS is_npay_add_payment_info,
    event_name = 'purchase'
      AND (
        LOWER(pay_method) = 'npay'
        OR STARTS_WITH(UPPER(transaction_id), 'NPAY')
      ) AS is_npay_purchase_like,
    event_name = 'purchase'
      AND (
        npay_recovery_source != ''
        OR STARTS_WITH(event_id, 'NPayRecoveredPurchase')
        OR LOWER(payment_method) LIKE '%naverpay%'
        OR LOWER(payment_method) LIKE '%npay%'
      ) AS is_npay_mp_recovery_purchase,
    event_name = 'purchase'
      AND (LOWER(pay_method) = 'homepage' OR pay_method = '')
      AND NOT STARTS_WITH(UPPER(transaction_id), 'NPAY') AS is_homepage_purchase
  FROM base
)
SELECT
  CAST(event_dt AS STRING) AS date,
  COUNTIF(is_npay_add_payment_info) AS npay_add_payment_info_events,
  COUNT(DISTINCT IF(is_npay_add_payment_info, session_key, NULL)) AS npay_add_payment_info_sessions,
  COUNTIF(is_npay_purchase_like) AS npay_purchase_like_events,
  COUNT(DISTINCT IF(is_npay_purchase_like, transaction_id, NULL)) AS npay_purchase_like_tx,
  ROUND(SUM(IF(is_npay_purchase_like, event_value, 0)), 0) AS npay_purchase_like_value,
  COUNTIF(is_npay_mp_recovery_purchase) AS npay_mp_recovery_purchase_events,
  COUNT(DISTINCT IF(is_npay_mp_recovery_purchase, transaction_id, NULL)) AS npay_mp_recovery_purchase_tx,
  ROUND(SUM(IF(is_npay_mp_recovery_purchase, event_value, 0)), 0) AS npay_mp_recovery_purchase_value,
  COUNTIF(is_homepage_purchase) AS homepage_purchase_events,
  COUNT(DISTINCT IF(is_homepage_purchase, transaction_id, NULL)) AS homepage_purchase_tx,
  ROUND(SUM(IF(is_homepage_purchase, event_value, 0)), 0) AS homepage_purchase_value
FROM classified
GROUP BY date
ORDER BY date
`;

const detailQuery = (startSuffix: string, endSuffix: string) => `
WITH base AS (
  SELECT
    PARSE_DATE('%Y%m%d', event_date) AS event_dt,
    TIMESTAMP_MICROS(event_timestamp) AS event_ts,
    event_name,
    COALESCE((SELECT value.string_value FROM UNNEST(event_params) WHERE key='pay_method'), '') AS pay_method,
    COALESCE((SELECT value.string_value FROM UNNEST(event_params) WHERE key='payment_method'), '') AS payment_method,
    COALESCE((SELECT value.string_value FROM UNNEST(event_params) WHERE key='event_id'), '') AS event_id,
    COALESCE((SELECT value.string_value FROM UNNEST(event_params) WHERE key='npay_recovery_source'), '') AS npay_recovery_source,
    COALESCE((SELECT value.string_value FROM UNNEST(event_params) WHERE key='page_location'), '') AS page_location,
    COALESCE((SELECT value.string_value FROM UNNEST(event_params) WHERE key='transaction_id'), ecommerce.transaction_id, '') AS transaction_id,
    COALESCE(
      (SELECT value.double_value FROM UNNEST(event_params) WHERE key='value'),
      CAST((SELECT value.int_value FROM UNNEST(event_params) WHERE key='value') AS FLOAT64),
      ecommerce.purchase_revenue,
      0
    ) AS event_value
  FROM \`${JOB_PROJECT}.${DATASET}.events_*\`
  WHERE _TABLE_SUFFIX BETWEEN '${startSuffix}' AND '${endSuffix}'
),
classified AS (
  SELECT
    *,
    event_name = 'purchase'
      AND (
        LOWER(pay_method) = 'npay'
        OR STARTS_WITH(UPPER(transaction_id), 'NPAY')
      ) AS is_npay_purchase_like,
    event_name = 'purchase'
      AND (
        npay_recovery_source != ''
        OR STARTS_WITH(event_id, 'NPayRecoveredPurchase')
        OR LOWER(payment_method) LIKE '%naverpay%'
        OR LOWER(payment_method) LIKE '%npay%'
      ) AS is_npay_mp_recovery_purchase
  FROM base
)
SELECT
  CAST(event_dt AS STRING) AS date,
  event_name,
  pay_method,
  payment_method,
  npay_recovery_source,
  event_id,
  page_location,
  transaction_id,
  ROUND(event_value, 0) AS event_value,
  CASE
    WHEN is_npay_mp_recovery_purchase THEN 'mp_recovery_test_or_server'
    WHEN is_npay_purchase_like THEN 'legacy_npay_purchase_like'
    ELSE 'other'
  END AS classification
FROM classified
WHERE is_npay_purchase_like OR is_npay_mp_recovery_purchase
ORDER BY event_dt, event_ts
LIMIT 500
`;

const main = async () => {
  const args = parseArgs();
  const startSuffix = suffix(args.start);
  const endSuffix = suffix(args.end);
  const { bq, credential } = createBigQueryClient();
  const [daily, detail] = await Promise.all([
    runQuery(bq, dailyQuery(startSuffix, endSuffix)),
    runQuery(bq, detailQuery(startSuffix, endSuffix)),
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
      timezoneNote: "GA4 event_date table suffix. v138 GTM publish was 2026-04-24 23:45 KST.",
    },
    definitions: {
      npayAddPaymentInfo:
        "GA4 add_payment_info with pay_method=npay, NPAY transaction_id, or npay page evidence. This is intent/click, not confirmed purchase.",
      npayPurchaseLike:
        "GA4 purchase with pay_method=npay or transaction_id starting NPAY. Before v138 this can be NPay click-as-purchase pollution.",
      npayMpRecoveryPurchase:
        "GA4 purchase with npay_recovery_source/payment_method/event_id from server MP recovery tests, separated from click pollution.",
      v138Cutover:
        "2026-04-24 23:45 KST: tag [43] GA4_구매전환_Npay was changed from purchase to add_payment_info; tag [48] was paused.",
    },
    daily,
    detail,
  };
  console.log(JSON.stringify(result, null, args.json ? 2 : 2));
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
