#!/usr/bin/env tsx
/**
 * thecleancoffee GA4 BigQuery middle-event audit.
 *
 * Green read-only:
 * - Queries GA4 BigQuery export only.
 * - Produces aggregate counts only.
 * - Does not print raw order/payment/member/click identifiers.
 */

import fs from "node:fs/promises";
import path from "node:path";

import dotenv from "dotenv";
import { google } from "googleapis";

dotenv.config({ path: path.resolve(__dirname, "..", ".env"), quiet: true });

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const OUTPUT_DATE = "20260518";
const PROJECT_ID = "project-dadba7dd-0229-4ff6-81c";
const JOB_PROJECT_ID = process.env.BIGQUERY_JOB_PROJECT_ID?.trim() || PROJECT_ID;
const LOCATION = process.env.GA4_BQ_LOCATION?.trim() || "asia-northeast3";
const PROPERTY_ID = process.env.GA4_COFFEE_PROPERTY_ID?.trim() || "326949178";
const DATASET_ID = `analytics_${PROPERTY_ID}`;
const SERVICE_ACCOUNT =
  process.env.GA4_BIOCOM_SERVICE_ACCOUNT_KEY || process.env.GA4_SERVICE_ACCOUNT_KEY || "";

type Row = Record<string, string | null>;

const nowKst = () =>
  new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .format(new Date())
    .replace("T", " ");

const toDateSuffix = (date: Date) =>
  `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}${String(
    date.getUTCDate(),
  ).padStart(2, "0")}`;

const suffixToDate = (suffix: string) => `${suffix.slice(0, 4)}-${suffix.slice(4, 6)}-${suffix.slice(6, 8)}`;

const num = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseJson = <T>(raw: string, fallback: T): T => {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const serviceAccount = () => {
  if (!SERVICE_ACCOUNT.trim()) throw new Error("missing_ga4_service_account_env");
  const parsed = parseJson<Record<string, string>>(SERVICE_ACCOUNT, {});
  if (!parsed.client_email || !parsed.private_key) throw new Error("invalid_ga4_service_account_env");
  return parsed;
};

const bigQueryClient = async () => {
  const credentials = serviceAccount();
  const auth = new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ["https://www.googleapis.com/auth/bigquery", "https://www.googleapis.com/auth/cloud-platform"],
  });
  return google.bigquery({ version: "v2", auth });
};

const runQuery = async (bq: ReturnType<typeof google.bigquery>, query: string): Promise<Row[]> => {
  const inserted = await bq.jobs.insert({
    projectId: JOB_PROJECT_ID,
    requestBody: {
      jobReference: { projectId: JOB_PROJECT_ID, location: LOCATION },
      configuration: {
        query: {
          query,
          useLegacySql: false,
          location: LOCATION,
        },
      },
    },
  });

  const jobId = inserted.data.jobReference?.jobId;
  if (!jobId) throw new Error("missing_bigquery_job_id");

  for (let attempt = 0; attempt < 90; attempt += 1) {
    const result = await bq.jobs.getQueryResults({
      projectId: JOB_PROJECT_ID,
      jobId,
      location: LOCATION,
      maxResults: 10000,
    });
    if (result.data.jobComplete) {
      const fields = result.data.schema?.fields?.map((field) => field.name || "") || [];
      return (result.data.rows || []).map((row) => {
        const output: Row = {};
        (row.f || []).forEach((cell, index) => {
          output[fields[index] || `field_${index}`] = (cell.v as string | null) ?? null;
        });
        return output;
      });
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error("bigquery_query_timeout");
};

const baseCte = (startSuffix: string, endSuffix: string) => `
WITH raw AS (
  SELECT
    REGEXP_EXTRACT(_TABLE_SUFFIX, r'(\\d{8})$') AS table_date,
    event_name,
    user_pseudo_id,
    DATETIME(TIMESTAMP_MICROS(event_timestamp), 'Asia/Seoul') AS event_dt_kst,
    CAST((SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'ga_session_id') AS STRING) AS ga_session_id,
    SAFE_CAST((SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'percent_scrolled') AS INT64) AS percent_scrolled,
    LOWER(COALESCE((SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'page_location'), '')) AS page_location,
    LOWER(COALESCE((SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'page_title'), '')) AS page_title,
    LOWER(COALESCE((SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'link_text'), '')) AS link_text,
    LOWER(COALESCE((SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'link_url'), '')) AS link_url,
    LOWER(COALESCE((SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'event_category'), '')) AS event_category,
    LOWER(COALESCE((SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'event_label'), '')) AS event_label
  FROM \`${PROJECT_ID}.${DATASET_ID}.events_*\`
  WHERE REGEXP_EXTRACT(_TABLE_SUFFIX, r'(\\d{8})$') BETWEEN '${startSuffix}' AND '${endSuffix}'
),
prepared AS (
  SELECT
    *,
    CONCAT(COALESCE(user_pseudo_id, ''), '.', COALESCE(ga_session_id, '')) AS session_key,
    CONCAT(
      LOWER(event_name), ' ', page_location, ' ', page_title, ' ', link_text, ' ', link_url, ' ',
      event_category, ' ', event_label
    ) AS searchable_text
  FROM raw
)
`;

const eventSummaryQuery = (startSuffix: string, endSuffix: string) => `
${baseCte(startSuffix, endSuffix)}
, classified AS (
  SELECT
    CASE
      WHEN LOWER(event_name) = 'add_payment_info' THEN 'add_payment_info'
      WHEN REGEXP_CONTAINS(searchable_text, r'(coupon|쿠폰|promotion|promo|discount|할인)') THEN 'coupon_or_promotion'
      WHEN LOWER(event_name) IN ('sign_up', 'complete_registration')
        OR REGEXP_CONTAINS(searchable_text, r'(sign_up|signup|registration|register|회원가입|1초회원가입|1초)') THEN 'registration'
      WHEN LOWER(event_name) IN ('page_view_long', 'scroll50', 'scroll_50')
        OR (LOWER(event_name) = 'scroll' AND percent_scrolled >= 50) THEN 'scroll50_or_page_view_long'
      WHEN LOWER(event_name) IN ('begin_checkout', 'view_cart', 'add_to_cart', 'view_item', 'purchase', 'scroll') THEN 'context'
      ELSE 'other'
    END AS bucket,
    event_name,
    user_pseudo_id,
    session_key,
    event_dt_kst,
    percent_scrolled
  FROM prepared
)
SELECT
  bucket,
  event_name,
  COUNT(*) AS events,
  COUNT(DISTINCT user_pseudo_id) AS users,
  COUNT(DISTINCT session_key) AS sessions,
  MIN(CAST(event_dt_kst AS STRING)) AS first_event_kst,
  MAX(CAST(event_dt_kst AS STRING)) AS latest_event_kst,
  COUNTIF(percent_scrolled >= 50) AS scroll50_param_events
FROM classified
WHERE bucket IN ('add_payment_info', 'coupon_or_promotion', 'registration', 'scroll50_or_page_view_long', 'context')
GROUP BY bucket, event_name
ORDER BY bucket, events DESC
`;

const freshnessQuery = (startSuffix: string, endSuffix: string) => `
${baseCte(startSuffix, endSuffix)}
SELECT
  MIN(table_date) AS min_table_date,
  MAX(table_date) AS max_table_date,
  COUNT(*) AS total_events,
  MAX(CAST(event_dt_kst AS STRING)) AS latest_event_kst
FROM prepared
`;

const normalizedRows = (rows: Row[]) =>
  rows.map((row) => ({
    bucket: String(row.bucket || ""),
    event_name: String(row.event_name || ""),
    events: num(row.events),
    users: num(row.users),
    sessions: num(row.sessions),
    first_event_kst: String(row.first_event_kst || "-"),
    latest_event_kst: String(row.latest_event_kst || "-"),
    scroll50_param_events: num(row.scroll50_param_events),
  }));

const main = async () => {
  const bq = await bigQueryClient();
  const now = new Date();
  const endSuffix = toDateSuffix(now);
  const start7 = new Date(now);
  start7.setUTCDate(start7.getUTCDate() - 7);
  const start30 = new Date(now);
  start30.setUTCDate(start30.getUTCDate() - 30);

  const window7 = { startSuffix: toDateSuffix(start7), endSuffix };
  const window30 = { startSuffix: toDateSuffix(start30), endSuffix };

  const freshness = (await runQuery(bq, freshnessQuery(window7.startSuffix, window7.endSuffix)))[0] || {};
  const sevenDayRows = normalizedRows(await runQuery(bq, eventSummaryQuery(window7.startSuffix, window7.endSuffix)));
  const thirtyDayRows = normalizedRows(await runQuery(bq, eventSummaryQuery(window30.startSuffix, window30.endSuffix))).filter(
    (row) => ["add_payment_info", "coupon_or_promotion", "registration", "scroll50_or_page_view_long"].includes(row.bucket),
  );

  const targetPresence = {
    add_payment_info_7d: sevenDayRows.some((row) => row.bucket === "add_payment_info" && row.events > 0),
    coupon_or_promotion_7d: sevenDayRows.some((row) => row.bucket === "coupon_or_promotion" && row.events > 0),
    registration_7d: sevenDayRows.some((row) => row.bucket === "registration" && row.events > 0),
    scroll50_or_page_view_long_7d: sevenDayRows.some(
      (row) => row.bucket === "scroll50_or_page_view_long" && row.events > 0,
    ),
    begin_checkout_7d: sevenDayRows.some((row) => row.event_name === "begin_checkout" && row.events > 0),
  };

  const result = {
    ok: true,
    checked_at_kst: `${nowKst()} KST`,
    mode: "green_read_only_coffee_ga4_bq_middle_event_audit",
    site: "thecleancoffee",
    ga4_source: {
      project: PROJECT_ID,
      dataset: DATASET_ID,
      property_id: PROPERTY_ID,
      measurement_id_from_gtm_ui_capture: "G-JLSBXX7300",
      location: LOCATION,
    },
    gtm_publish_observed: {
      container: "GTM-5M33GC4",
      version: 21,
      version_name: "AGENTSOS GA4 begin_checkout rename - 2026-05-18",
      published_at_kst: "2026-05-18 05:37",
      changed_tag: "AGENTSOS - [GA4 이벤트전송] begin_checkout",
      scope: "rename existing GA4 begin_checkout sender; event contract unchanged",
    },
    window_7d: {
      start_date: suffixToDate(window7.startSuffix),
      end_date: suffixToDate(window7.endSuffix),
      latest_table_date: String(freshness.max_table_date || "-"),
      latest_event_kst: String(freshness.latest_event_kst || "-"),
      total_events: num(freshness.total_events),
    },
    target_presence: targetPresence,
    seven_day_summary: sevenDayRows,
    thirty_day_target_summary: thirtyDayRows,
    interpretation: {
      ga4_export_lag_note:
        "GTM Preview/Realtime events from 2026-05-18 may not appear in daily BigQuery export until the next export table is available.",
      coupon_note:
        "Coupon detection is based on event_name and safe text/url params containing coupon/쿠폰/promotion/discount/할인. It is aggregate-only and not an order-level truth source.",
      registration_note:
        "Registration detection includes GA4 standard sign_up/complete_registration and existing Korean 1초회원가입 naming.",
      no_send_write_publish: true,
    },
    invariants: {
      ga4_measurement_protocol_send: 0,
      meta_capi_send: 0,
      google_ads_upload: 0,
      operating_db_write: 0,
      vm_cloud_deploy: 0,
      raw_identifier_output: 0,
    },
  };

  const jsonPath = path.join(REPO_ROOT, "data", "project", `coffee-ga4-bq-middle-event-audit-${OUTPUT_DATE}.json`);
  await fs.writeFile(jsonPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ ok: true, jsonPath, window_7d: result.window_7d, targetPresence }, null, 2));
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
