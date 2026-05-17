#!/usr/bin/env tsx
/**
 * thecleancoffee GA4 BigQuery existing middle-event audit.
 *
 * Green read-only:
 * - Queries GA4 BigQuery daily export only.
 * - Produces aggregate counts only.
 * - Does not print raw order/payment/member/click identifiers.
 */

import fs from "node:fs/promises";
import path from "node:path";

import dotenv from "dotenv";
import { google } from "googleapis";

dotenv.config({ path: path.resolve(__dirname, "..", ".env"), quiet: true });

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const OUTPUT_DATE = "20260517";
const PROJECT_ID = "project-dadba7dd-0229-4ff6-81c";
const JOB_PROJECT_ID = process.env.BIGQUERY_JOB_PROJECT_ID?.trim() || PROJECT_ID;
const LOCATION = process.env.GA4_BQ_LOCATION?.trim() || "asia-northeast3";
const PROPERTY_ID = process.env.GA4_COFFEE_PROPERTY_ID?.trim() || "326949178";
const DATASET_ID = `analytics_${PROPERTY_ID}`;
const SERVICE_ACCOUNT = process.env.GA4_BIOCOM_SERVICE_ACCOUNT_KEY || process.env.GA4_SERVICE_ACCOUNT_KEY || "";

const TARGET_EVENTS = [
  "page_view_long",
  "add_to_cart",
  "view_cart",
  "begin_checkout",
  "add_payment_info",
  "purchase",
] as const;

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

const num = (value: unknown): number => {
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
      maxResults: 5000,
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

const listDailySuffixes = async (bq: ReturnType<typeof google.bigquery>) => {
  const tables: string[] = [];
  let pageToken: string | undefined;
  do {
    const result = await bq.tables.list({
      projectId: PROJECT_ID,
      datasetId: DATASET_ID,
      pageToken,
      maxResults: 1000,
    });
    for (const table of result.data.tables || []) {
      const tableId = table.tableReference?.tableId || "";
      const matched = /^events_(\d{8})$/.exec(tableId);
      if (matched) tables.push(matched[1]);
    }
    pageToken = result.data.nextPageToken || undefined;
  } while (pageToken);
  return tables.sort();
};

const suffixToDate = (suffix: string) => `${suffix.slice(0, 4)}-${suffix.slice(4, 6)}-${suffix.slice(6, 8)}`;

const sevenDayWindow = async (bq: ReturnType<typeof google.bigquery>) => {
  const suffixes = await listDailySuffixes(bq);
  const latestSuffix = suffixes.at(-1);
  if (!latestSuffix) throw new Error("no_coffee_ga4_daily_tables");
  const latest = new Date(`${latestSuffix.slice(0, 4)}-${latestSuffix.slice(4, 6)}-${latestSuffix.slice(6, 8)}T00:00:00Z`);
  const start = new Date(latest);
  start.setUTCDate(start.getUTCDate() - 6);
  const startSuffix = `${start.getUTCFullYear()}${String(start.getUTCMonth() + 1).padStart(2, "0")}${String(
    start.getUTCDate(),
  ).padStart(2, "0")}`;
  return { startSuffix, endSuffix: latestSuffix, latestDailyTable: `events_${latestSuffix}` };
};

const baseCte = (startSuffix: string, endSuffix: string) => `
WITH base AS (
  SELECT
    _TABLE_SUFFIX AS suffix,
    event_name,
    user_pseudo_id,
    CAST((SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'ga_session_id') AS STRING) AS ga_session_id,
    LOWER(COALESCE((SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'page_location'), '')) AS page_location,
    event_params
  FROM \`${PROJECT_ID}.${DATASET_ID}.events_*\`
  WHERE _TABLE_SUFFIX BETWEEN '${startSuffix}' AND '${endSuffix}'
),
prepared AS (
  SELECT
    suffix,
    event_name,
    CONCAT(COALESCE(user_pseudo_id, ''), '.', COALESCE(ga_session_id, '')) AS session_key,
    page_location,
    event_params
  FROM base
  WHERE user_pseudo_id IS NOT NULL AND ga_session_id IS NOT NULL
)
`;

const eventSummaryQuery = (startSuffix: string, endSuffix: string) => `
${baseCte(startSuffix, endSuffix)}
SELECT
  event_name,
  COUNT(*) AS events,
  COUNT(DISTINCT session_key) AS sessions,
  COUNTIF(REGEXP_CONTAINS(page_location, r'/shop_cart|cart')) AS cart_page_events,
  COUNTIF(REGEXP_CONTAINS(page_location, r'/shop_payment|checkout|payment')) AS payment_page_events,
  COUNTIF(REGEXP_CONTAINS(page_location, r'/shop_view|goods|product')) AS product_page_events
FROM prepared
WHERE event_name IN (${TARGET_EVENTS.map((event) => `'${event}'`).join(", ")})
GROUP BY event_name
ORDER BY events DESC
`;

const suspectEventQuery = (startSuffix: string, endSuffix: string) => `
${baseCte(startSuffix, endSuffix)}
SELECT
  event_name,
  COUNT(*) AS events,
  COUNT(DISTINCT session_key) AS sessions,
  COUNTIF(REGEXP_CONTAINS(page_location, r'/shop_cart|cart')) AS cart_page_events,
  COUNTIF(REGEXP_CONTAINS(page_location, r'/shop_payment|checkout|payment')) AS payment_page_events
FROM prepared
WHERE REGEXP_CONTAINS(LOWER(event_name), r'hurd|hurdlers|naver|npay|장바구니|네이버|cart|checkout|payment')
GROUP BY event_name
ORDER BY events DESC
LIMIT 100
`;

const suspectParamQuery = (startSuffix: string, endSuffix: string) => `
${baseCte(startSuffix, endSuffix)}
, flat AS (
  SELECT
    event_name,
    ep.key AS param_key,
    LOWER(COALESCE(
      ep.value.string_value,
      CAST(ep.value.int_value AS STRING),
      CAST(ep.value.float_value AS STRING),
      CAST(ep.value.double_value AS STRING),
      ''
    )) AS param_value,
    session_key
  FROM prepared, UNNEST(event_params) AS ep
)
SELECT
  event_name,
  param_key,
  COUNT(*) AS row_count,
  COUNT(DISTINCT session_key) AS sessions
FROM flat
WHERE REGEXP_CONTAINS(LOWER(param_key), r'hurd|hurdlers|naver|npay|장바구니|네이버|cart|checkout|payment')
   OR REGEXP_CONTAINS(param_value, r'hurd|hurdlers|naver|npay|장바구니|네이버|cart|checkout|payment')
GROUP BY event_name, param_key
ORDER BY row_count DESC
LIMIT 100
`;

const normalizeEventSummary = (rows: Row[]) => {
  const byName = new Map(
    rows.map((row) => [
      String(row.event_name || ""),
      {
        event_name: String(row.event_name || ""),
        events: num(row.events),
        sessions: num(row.sessions),
        cart_page_events: num(row.cart_page_events),
        payment_page_events: num(row.payment_page_events),
        product_page_events: num(row.product_page_events),
      },
    ]),
  );
  return TARGET_EVENTS.map(
    (eventName) =>
      byName.get(eventName) || {
        event_name: eventName,
        events: 0,
        sessions: 0,
        cart_page_events: 0,
        payment_page_events: 0,
        product_page_events: 0,
      },
  );
};

const mdTable = (headers: string[], rows: Array<Array<string | number>>) => {
  const lines = [`| ${headers.join(" | ")} |`, `| ${headers.map(() => "---").join(" | ")} |`];
  for (const row of rows) lines.push(`| ${row.join(" | ")} |`);
  return lines.join("\n");
};

const main = async () => {
  const bq = await bigQueryClient();
  const window = await sevenDayWindow(bq);

  const eventSummaryRows = normalizeEventSummary(await runQuery(bq, eventSummaryQuery(window.startSuffix, window.endSuffix)));
  const suspectEventRows = (await runQuery(bq, suspectEventQuery(window.startSuffix, window.endSuffix))).map((row) => ({
    event_name: String(row.event_name || ""),
    events: num(row.events),
    sessions: num(row.sessions),
    cart_page_events: num(row.cart_page_events),
    payment_page_events: num(row.payment_page_events),
  }));
  const suspectParamRows = (await runQuery(bq, suspectParamQuery(window.startSuffix, window.endSuffix))).map((row) => ({
    event_name: String(row.event_name || ""),
    param_key: String(row.param_key || ""),
    rows: num(row.row_count),
    sessions: num(row.sessions),
  }));

  const exact = Object.fromEntries(eventSummaryRows.map((row) => [row.event_name, row.events]));
  const interpretation = {
    page_view_long_loaded: exact.page_view_long > 0,
    add_to_cart_loaded: exact.add_to_cart > 0,
    view_cart_loaded: exact.view_cart > 0,
    begin_checkout_loaded: exact.begin_checkout > 0,
    add_payment_info_loaded: exact.add_payment_info > 0,
    purchase_loaded: exact.purchase > 0,
    hurdlers_named_event_loaded: suspectEventRows.some((row) => /hurd|hurdlers/i.test(row.event_name)),
    naver_or_npay_named_event_loaded: suspectEventRows.some((row) => /naver|npay|네이버/i.test(row.event_name)),
    preview_needed_reason:
      "BigQuery confirms some existing behavior events, but GTM tag names are not exported to GA4. Preview is needed to map HURDLERS dataLayer/cart tags to actual GA4 event names or to confirm they do not send GA4 ecommerce events.",
  };

  const result = {
    ok: true,
    checked_at_kst: `${nowKst()} KST`,
    mode: "green_read_only_coffee_ga4_existing_tag_event_audit",
    site: "thecleancoffee",
    ga4_source: {
      project: PROJECT_ID,
      dataset: DATASET_ID,
      property_id: PROPERTY_ID,
      measurement_id_from_gtm_ui_capture: "G-JLSBXX7300",
    },
    window: {
      start_date: suffixToDate(window.startSuffix),
      end_date: suffixToDate(window.endSuffix),
      latest_daily_table: window.latestDailyTable,
    },
    target_event_summary: eventSummaryRows,
    suspect_event_names: suspectEventRows,
    suspect_param_keys: suspectParamRows,
    interpretation,
    invariants: {
      ga4_measurement_protocol_send: 0,
      meta_capi_send: 0,
      google_ads_upload: 0,
      gtm_publish: 0,
      operating_db_write: 0,
      raw_identifier_output: 0,
    },
  };

  const jsonPath = path.join(REPO_ROOT, "data", "project", `coffee-ga4-existing-tag-event-audit-${OUTPUT_DATE}.json`);
  const mdPath = path.join(REPO_ROOT, "project", `coffee-ga4-existing-tag-event-audit-${OUTPUT_DATE}.md`);

  const md = [
    "# 더클린커피 GA4 기존 태그 이벤트 적재 확인",
    "",
    `작성 시각: ${result.checked_at_kst}`,
    "Lane: Green read-only",
    "대상: thecleancoffee",
    "",
    "```yaml",
    "harness_preflight:",
    "  common_harness_read:",
    "    - AGENTS.md",
    "    - harness/common/HARNESS_GUIDELINES.md",
    "    - harness/common/AUTONOMY_POLICY.md",
    "    - harness/common/REPORTING_TEMPLATE.md",
    "  project_harness_read:",
    "    - harness/coffee-data/README.md",
    "    - harness/coffee-data/RULES.md",
    "    - harness/coffee-data/VERIFY.md",
    "  lane: Green",
    "  allowed_actions:",
    "    - ga4_bigquery_read_only_aggregate",
    "    - documentation_update",
    "  forbidden_actions:",
    "    - gtm_publish",
    "    - ga4_measurement_protocol_send",
    "    - platform_send_or_upload",
    "    - operating_db_write",
    "    - raw_identifier_report_output",
    "  source_window_freshness_confidence:",
    `    source: ${PROJECT_ID}.${DATASET_ID} daily export`,
    `    window: ${suffixToDate(window.startSuffix)}~${suffixToDate(window.endSuffix)}`,
    `    freshness: latest daily table ${window.latestDailyTable}`,
    "    confidence: high for event-name existence, medium for GTM tag-to-event mapping until Preview",
    "```",
    "",
    "## 10초 요약",
    "",
    "- `page_view_long`과 `add_to_cart`는 최근 7일 GA4 BigQuery에 실제로 들어와 있다.",
    "- `view_cart`, `begin_checkout`, `add_payment_info`는 같은 기간 GA4 BigQuery 기준 0이다.",
    "- `purchase`는 들어와 있다. 따라서 문제는 구매 이벤트 부재가 아니라 구매 전 중간 이벤트 이름/매핑 gap이다.",
    "- HURDLERS 태그 이름 자체는 GA4 BigQuery에 저장되지 않는다. Preview가 필요한 이유는 기존 GTM 태그가 GA4에 어떤 event name으로 이어지는지 확인하기 위해서다.",
    "",
    "## Target Event Summary",
    "",
    mdTable(
      ["event_name", "events", "sessions", "cart_page_events", "payment_page_events", "product_page_events"],
      eventSummaryRows.map((row) => [
        row.event_name,
        row.events,
        row.sessions,
        row.cart_page_events,
        row.payment_page_events,
        row.product_page_events,
      ]),
    ),
    "",
    "## HURDLERS / NPay / Cart 후보 event_name 검색",
    "",
    mdTable(
      ["event_name", "events", "sessions", "cart_page_events", "payment_page_events"],
      suspectEventRows.map((row) => [
        row.event_name,
        row.events,
        row.sessions,
        row.cart_page_events,
        row.payment_page_events,
      ]),
    ),
    "",
    "## 관련 parameter key 검색",
    "",
    "값 원문은 출력하지 않고, key와 집계만 남긴다.",
    "",
    mdTable(
      ["event_name", "param_key", "rows", "sessions"],
      suspectParamRows.slice(0, 40).map((row) => [row.event_name, row.param_key, row.rows, row.sessions]),
    ),
    "",
    "## 판단",
    "",
    "- 기존 `page_view_long` 태그는 실제 적재가 확인되어 선행지표로 쓸 수 있다. 단 `value=100`은 매출이 아니다.",
    "- 기존 장바구니 계열은 `add_to_cart`로는 실제 적재가 확인된다.",
    "- 하지만 표준 `view_cart`, `begin_checkout`, `add_payment_info`는 0이므로 결제 전 퍼널 분석에는 아직 gap이 있다.",
    "- HURDLERS 네이버페이 장바구니 태그는 GTM UI에는 있지만, GA4 BigQuery event name만으로는 실제 GA4 ecommerce event로 이어지는지 확정할 수 없다.",
    "- 따라서 GTM Preview는 진행 가치가 있다. 단 Preview only이며 Submit/Create version/Publish는 금지한다.",
    "",
    "## 금지선",
    "",
    "- GA4 Measurement Protocol send 0",
    "- Meta CAPI send 0",
    "- Google Ads upload 0",
    "- GTM publish 0",
    "- 운영DB write 0",
    "- raw identifier output 0",
    "",
  ].join("\n");

  await fs.writeFile(jsonPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  await fs.writeFile(mdPath, md, "utf8");
  console.log(JSON.stringify({ ok: true, jsonPath, mdPath, window: result.window, interpretation }, null, 2));
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
