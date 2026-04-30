import path from "node:path";

import dotenv from "dotenv";
import { google, type bigquery_v2 } from "googleapis";
import { Pool } from "pg";

dotenv.config({ path: path.resolve(__dirname, "..", ".env"), quiet: true });

const COFFEE_PROJECT_ID = "project-dadba7dd-0229-4ff6-81c";
const COFFEE_DATASET = `analytics_${process.env.GA4_COFFEE_PROPERTY_ID?.trim() || "326949178"}`;
const COFFEE_LOCATION = "asia-northeast3";

type BigQueryRow = Record<string, unknown>;

const argValue = (name: string) =>
  process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);

const validateSuffix = (label: string, suffix: string) => {
  if (!/^\d{8}$/.test(suffix)) throw new Error(`${label} must be YYYYMMDD: ${suffix}`);
  return suffix;
};

const dateToSuffix = (date: Date) =>
  `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}${String(date.getUTCDate()).padStart(2, "0")}`;

const suffixToDate = (suffix: string) => `${suffix.slice(0, 4)}-${suffix.slice(4, 6)}-${suffix.slice(6, 8)}`;

const shiftSuffix = (suffix: string, days: number) => {
  const date = new Date(Date.UTC(Number(suffix.slice(0, 4)), Number(suffix.slice(4, 6)) - 1, Number(suffix.slice(6, 8))));
  date.setUTCDate(date.getUTCDate() + days);
  return dateToSuffix(date);
};

const parseArgs = () => {
  const endSuffix = validateSuffix("endSuffix", argValue("endSuffix") ?? "20260429");
  const startSuffix = validateSuffix("startSuffix", argValue("startSuffix") ?? shiftSuffix(endSuffix, -6));
  if (startSuffix > endSuffix) throw new Error(`startSuffix must be <= endSuffix: ${startSuffix} > ${endSuffix}`);
  return { startSuffix, endSuffix, json: process.argv.includes("--json") };
};

const parseJsonCredentials = () => {
  const rawKey = process.env.GA4_SERVICE_ACCOUNT_KEY || process.env.GA4_BIOCOM_SERVICE_ACCOUNT_KEY;
  if (!rawKey?.trim()) throw new Error("GA4 service account key missing");
  return JSON.parse(rawKey) as { client_email: string; private_key: string };
};

const createBigQueryClient = () => {
  const credentials = parseJsonCredentials();
  const auth = new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: [
      "https://www.googleapis.com/auth/bigquery.readonly",
      "https://www.googleapis.com/auth/cloud-platform.read-only",
    ],
  });
  return google.bigquery({ version: "v2", auth });
};

const normalizeDatabaseUrl = (value: string) => value.replace(/^postgresql\+asyncpg:\/\//, "postgresql://");

const createPgPool = () => {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) throw new Error("DATABASE_URL is not configured");
  return new Pool({ connectionString: normalizeDatabaseUrl(databaseUrl), max: 1 });
};

const runBigQuery = async (bq: bigquery_v2.Bigquery, query: string) => {
  const response = await bq.jobs.query({
    projectId: COFFEE_PROJECT_ID,
    requestBody: {
      query,
      useLegacySql: false,
      location: COFFEE_LOCATION,
      timeoutMs: 30_000,
    },
  });
  const fields = response.data.schema?.fields ?? [];
  return (response.data.rows ?? []).map((row) =>
    Object.fromEntries((row.f ?? []).map((cell, index) => [fields[index]?.name ?? String(index), cell.v])),
  ) as BigQueryRow[];
};

const valueExpr = "COALESCE(ep.value.string_value, CAST(ep.value.int_value AS STRING), CAST(ep.value.double_value AS STRING), CAST(ep.value.float_value AS STRING))";

const queryDailySummary = (startSuffix: string, endSuffix: string) => `
  WITH p AS (
    SELECT
      event_date,
      event_timestamp,
      user_pseudo_id,
      COALESCE(ecommerce.transaction_id, (
        SELECT ep.value.string_value FROM UNNEST(event_params) ep WHERE ep.key = 'transaction_id'
      )) AS transaction_id,
      (SELECT ep.value.int_value FROM UNNEST(event_params) ep WHERE ep.key = 'ga_session_id') AS ga_session_id,
      ecommerce.purchase_revenue AS purchase_revenue
    FROM \`${COFFEE_PROJECT_ID}.${COFFEE_DATASET}.events_*\`
    WHERE _TABLE_SUFFIX BETWEEN '${startSuffix}' AND '${endSuffix}'
      AND event_name = 'purchase'
  )
  SELECT
    event_date,
    COUNT(*) AS purchase_events,
    COUNT(DISTINCT transaction_id) AS distinct_transaction_ids,
    COUNTIF(transaction_id IS NULL OR transaction_id = '') AS missing_transaction_id,
    COUNTIF(user_pseudo_id IS NULL) AS missing_user_pseudo_id,
    COUNTIF(ga_session_id IS NULL) AS missing_ga_session_id,
    ROUND(SUM(COALESCE(purchase_revenue, 0))) AS purchase_revenue,
    FORMAT_TIMESTAMP('%Y-%m-%d %H:%M:%S %Z', TIMESTAMP_MICROS(MAX(event_timestamp)), 'Asia/Seoul') AS latest_event_kst
  FROM p
  GROUP BY event_date
  ORDER BY event_date;
`;

const queryTransactionDetails = (startSuffix: string, endSuffix: string) => `
  SELECT
    event_date,
    FORMAT_TIMESTAMP('%Y-%m-%d %H:%M:%S %Z', TIMESTAMP_MICROS(event_timestamp), 'Asia/Seoul') AS event_time_kst,
    COALESCE(ecommerce.transaction_id, (
      SELECT ep.value.string_value FROM UNNEST(event_params) ep WHERE ep.key = 'transaction_id'
    )) AS transaction_id,
    CASE
      WHEN STARTS_WITH(UPPER(COALESCE(ecommerce.transaction_id, (
        SELECT ep.value.string_value FROM UNNEST(event_params) ep WHERE ep.key = 'transaction_id'
      ), '')), 'NPAY') THEN 'npay_transaction_id'
      ELSE 'non_npay_ga4'
    END AS payment_method_guess,
    ROUND(COALESCE(ecommerce.purchase_revenue, 0)) AS purchase_revenue,
    (SELECT ${valueExpr} FROM UNNEST(event_params) ep WHERE ep.key = 'payment_method' LIMIT 1) AS payment_method_param,
    (SELECT ${valueExpr} FROM UNNEST(event_params) ep WHERE ep.key = 'page_location' LIMIT 1) AS page_location,
    COALESCE(
      session_traffic_source_last_click.cross_channel_campaign.default_channel_group,
      '(missing)'
    ) AS channel_group,
    COALESCE(
      session_traffic_source_last_click.cross_channel_campaign.source,
      session_traffic_source_last_click.manual_campaign.source,
      IF(session_traffic_source_last_click.google_ads_campaign.campaign_id IS NOT NULL, 'google_ads', NULL),
      '(missing)'
    ) AS source_key,
    COALESCE(
      session_traffic_source_last_click.cross_channel_campaign.medium,
      session_traffic_source_last_click.manual_campaign.medium,
      '(missing)'
    ) AS medium_key,
    ARRAY_TO_STRING(ARRAY(SELECT item.item_name FROM UNNEST(items) item LIMIT 5), ' + ') AS item_names,
    ARRAY_TO_STRING(ARRAY(SELECT item.item_id FROM UNNEST(items) item LIMIT 5), ' + ') AS item_ids
  FROM \`${COFFEE_PROJECT_ID}.${COFFEE_DATASET}.events_*\`
  WHERE _TABLE_SUFFIX BETWEEN '${startSuffix}' AND '${endSuffix}'
    AND event_name = 'purchase'
  ORDER BY event_timestamp DESC
  LIMIT 200;
`;

const queryGrouped = (startSuffix: string, endSuffix: string) => `
  WITH p AS (
    SELECT
      COALESCE(ecommerce.transaction_id, (
        SELECT ep.value.string_value FROM UNNEST(event_params) ep WHERE ep.key = 'transaction_id'
      )) AS transaction_id,
      ecommerce.purchase_revenue AS purchase_revenue,
      (SELECT ${valueExpr} FROM UNNEST(event_params) ep WHERE ep.key = 'page_location' LIMIT 1) AS page_location,
      COALESCE(session_traffic_source_last_click.cross_channel_campaign.default_channel_group, '(missing)') AS channel_group,
      COALESCE(
        session_traffic_source_last_click.cross_channel_campaign.source,
        session_traffic_source_last_click.manual_campaign.source,
        IF(session_traffic_source_last_click.google_ads_campaign.campaign_id IS NOT NULL, 'google_ads', NULL),
        '(missing)'
      ) AS source_key,
      COALESCE(
        session_traffic_source_last_click.cross_channel_campaign.medium,
        session_traffic_source_last_click.manual_campaign.medium,
        '(missing)'
      ) AS medium_key
    FROM \`${COFFEE_PROJECT_ID}.${COFFEE_DATASET}.events_*\`
    WHERE _TABLE_SUFFIX BETWEEN '${startSuffix}' AND '${endSuffix}'
      AND event_name = 'purchase'
  )
  SELECT 'payment_method_guess' AS group_type,
         CASE WHEN STARTS_WITH(UPPER(COALESCE(transaction_id, '')), 'NPAY') THEN 'npay_transaction_id' ELSE 'non_npay_ga4' END AS key,
         COUNT(*) AS purchase_events,
         COUNT(DISTINCT transaction_id) AS distinct_transactions,
         ROUND(SUM(COALESCE(purchase_revenue, 0))) AS purchase_revenue
  FROM p
  GROUP BY key
  UNION ALL
  SELECT 'source_medium' AS group_type,
         CONCAT(channel_group, ' / ', source_key, ' / ', medium_key) AS key,
         COUNT(*) AS purchase_events,
         COUNT(DISTINCT transaction_id) AS distinct_transactions,
         ROUND(SUM(COALESCE(purchase_revenue, 0))) AS purchase_revenue
  FROM p
  GROUP BY key
  UNION ALL
  SELECT 'page_location' AS group_type,
         COALESCE(page_location, '(missing)') AS key,
         COUNT(*) AS purchase_events,
         COUNT(DISTINCT transaction_id) AS distinct_transactions,
         ROUND(SUM(COALESCE(purchase_revenue, 0))) AS purchase_revenue
  FROM p
  GROUP BY key
  ORDER BY group_type, purchase_events DESC, purchase_revenue DESC
`;

const queryItemSummary = (startSuffix: string, endSuffix: string) => `
  SELECT
    COALESCE(item.item_name, '(missing)') AS item_name,
    COALESCE(item.item_id, '(missing)') AS item_id,
    COUNT(*) AS item_rows,
    COUNT(DISTINCT COALESCE(ecommerce.transaction_id, (
      SELECT ep.value.string_value FROM UNNEST(event_params) ep WHERE ep.key = 'transaction_id'
    ))) AS distinct_transactions,
    ROUND(SUM(COALESCE(item.price * item.quantity, item.item_revenue, 0))) AS item_revenue_estimate
  FROM \`${COFFEE_PROJECT_ID}.${COFFEE_DATASET}.events_*\`,
  UNNEST(items) AS item
  WHERE _TABLE_SUFFIX BETWEEN '${startSuffix}' AND '${endSuffix}'
    AND event_name = 'purchase'
  GROUP BY item_name, item_id
  ORDER BY item_rows DESC, item_revenue_estimate DESC
  LIMIT 50;
`;

const queryPaymentParamKeys = (startSuffix: string, endSuffix: string) => `
  SELECT
    ep.key,
    ${valueExpr} AS value,
    COUNT(*) AS events
  FROM \`${COFFEE_PROJECT_ID}.${COFFEE_DATASET}.events_*\`,
  UNNEST(event_params) AS ep
  WHERE _TABLE_SUFFIX BETWEEN '${startSuffix}' AND '${endSuffix}'
    AND event_name = 'purchase'
    AND REGEXP_CONTAINS(LOWER(ep.key), r'(pay|payment|pg|order|transaction|method)')
  GROUP BY ep.key, value
  ORDER BY events DESC, ep.key, value
  LIMIT 100;
`;

const queryOperationalSummary = async (pool: Pool, startDate: string, endDate: string) => {
  const toss = await pool.query(
    `
      SELECT
        status,
        COUNT(DISTINCT regexp_replace(COALESCE(order_id, ''), '-P[0-9]+$', '')) AS transactions,
        COUNT(*) AS rows,
        ROUND(SUM(COALESCE(total_amount, 0)::numeric)) AS gross,
        ROUND(SUM(COALESCE(total_amount, 0)::numeric - COALESCE(cancel_amount, 0)::numeric)) AS net,
        MIN(approved_at::text) AS first_approved_at,
        MAX(approved_at::text) AS last_approved_at
      FROM public.tb_sales_toss
      WHERE store='coffee'
        AND SUBSTRING(COALESCE(approved_at::text, ''), 1, 10) BETWEEN $1 AND $2
      GROUP BY status
      ORDER BY status
    `,
    [startDate, endDate],
  );

  const playauto = await pool.query(
    `
      SELECT
        COUNT(*) AS rows,
        COUNT(DISTINCT split_part(shop_ord_no, ' ', 1)) AS distinct_order_keys,
        MIN(pay_time::text) AS first_pay_time,
        MAX(pay_time::text) AS last_pay_time
      FROM public.tb_playauto_orders
      WHERE shop_name='아임웹-C'
        AND SUBSTRING(COALESCE(pay_time::text, ''), 1, 10) BETWEEN $1 AND $2
    `,
    [startDate, endDate],
  );

  return { toss: toss.rows, playauto: playauto.rows[0] ?? null };
};

const buildRobustSearchTemplate = (startSuffix: string, endSuffix: string) => `
DECLARE ids ARRAY<STRING> DEFAULT ['ORDER_NUMBER_HERE', 'CHANNEL_ORDER_NO_HERE'];

SELECT
  _TABLE_SUFFIX AS table_suffix,
  event_name,
  FORMAT_TIMESTAMP('%Y-%m-%d %H:%M:%S %Z', TIMESTAMP_MICROS(event_timestamp), 'Asia/Seoul') AS event_time_kst,
  ecommerce.transaction_id AS ecommerce_transaction_id,
  (SELECT ep.value.string_value FROM UNNEST(event_params) ep WHERE ep.key = 'transaction_id') AS param_transaction_id
FROM \`${COFFEE_PROJECT_ID}.${COFFEE_DATASET}.events_*\`
WHERE _TABLE_SUFFIX BETWEEN '${startSuffix}' AND '${endSuffix}'
  AND (
    ecommerce.transaction_id IN UNNEST(ids)
    OR EXISTS (
      SELECT 1
      FROM UNNEST(event_params) ep
      WHERE COALESCE(ep.value.string_value, CAST(ep.value.int_value AS STRING), CAST(ep.value.double_value AS STRING), CAST(ep.value.float_value AS STRING)) IN UNNEST(ids)
    )
  )
ORDER BY event_timestamp DESC;
`.trim();

const main = async () => {
  const args = parseArgs();
  const startDate = suffixToDate(args.startSuffix);
  const endDate = suffixToDate(args.endSuffix);
  const bq = createBigQueryClient();
  const pool = createPgPool();

  try {
    const [dailySummary, transactionDetails, grouped, itemSummary, paymentParamKeys, operationalSummary] = await Promise.all([
      runBigQuery(bq, queryDailySummary(args.startSuffix, args.endSuffix)),
      runBigQuery(bq, queryTransactionDetails(args.startSuffix, args.endSuffix)),
      runBigQuery(bq, queryGrouped(args.startSuffix, args.endSuffix)),
      runBigQuery(bq, queryItemSummary(args.startSuffix, args.endSuffix)),
      runBigQuery(bq, queryPaymentParamKeys(args.startSuffix, args.endSuffix)),
      queryOperationalSummary(pool, startDate, endDate),
    ]);

    const payload = {
      ok: true,
      checkedAt: new Date().toISOString(),
      site: "thecleancoffee",
      mode: "read_only",
      projectId: COFFEE_PROJECT_ID,
      dataset: COFFEE_DATASET,
      location: COFFEE_LOCATION,
      window: {
        startSuffix: args.startSuffix,
        endSuffix: args.endSuffix,
        startDate,
        endDate,
      },
      dailySummary,
      grouped,
      itemSummary,
      paymentParamKeys,
      transactionDetails,
      operationalSummary,
      robustSearchTemplate: buildRobustSearchTemplate(args.startSuffix, args.endSuffix),
      guardrails: {
        dbWrite: false,
        ga4Send: false,
        metaSend: false,
        tiktokSend: false,
        googleAdsSend: false,
        gtmPublish: false,
        endpointDeploy: false,
      },
    };

    console.log(JSON.stringify(payload, null, 2));
  } finally {
    await pool.end();
  }
};

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
