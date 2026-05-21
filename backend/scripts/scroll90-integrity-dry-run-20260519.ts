#!/usr/bin/env tsx
/**
 * scroll90 integrity dry-run.
 *
 * Green read-only:
 * - GA4 BigQuery export read-only.
 * - Leading Indicators live API read-only.
 * - Aggregate-only output. No raw user/session/order/payment/click identifiers.
 */

import fs from "node:fs/promises";
import path from "node:path";

import dotenv from "dotenv";
import { google } from "googleapis";

dotenv.config({ path: path.resolve(__dirname, "..", ".env"), quiet: true });

type SiteKey = "biocom" | "thecleancoffee";
type Row = Record<string, string | null>;

type DatasetSegment = {
  label: string;
  projectId: string;
  datasetId: string;
};

type SiteConfig = {
  site: SiteKey;
  displayName: string;
  propertyId: string;
  segments: DatasetSegment[];
};

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const OUTPUT_DATE = "20260519";
const PROJECT_ID = "project-dadba7dd-0229-4ff6-81c";
const JOB_PROJECT_ID = process.env.BIGQUERY_JOB_PROJECT_ID?.trim() || PROJECT_ID;
const LOCATION = process.env.GA4_BQ_LOCATION?.trim() || "asia-northeast3";
const ATTR_BASE_URL = process.env.ATTR_BASE_URL?.trim() || "https://att.ainativeos.net";
const SERVICE_ACCOUNT = process.env.GA4_BIOCOM_SERVICE_ACCOUNT_KEY || process.env.GA4_SERVICE_ACCOUNT_KEY || "";

const pct = (num: number, den: number): number | null =>
  den > 0 ? Math.round((num / den) * 10000) / 100 : null;

const toNum = (value: unknown): number => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

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

const suffixToDate = (suffix: string) => `${suffix.slice(0, 4)}-${suffix.slice(4, 6)}-${suffix.slice(6, 8)}`;

const addDays = (date: string, days: number) => {
  const at = new Date(`${date}T00:00:00Z`);
  at.setUTCDate(at.getUTCDate() + days);
  return at.toISOString().slice(0, 10).replaceAll("-", "");
};

const parseServiceAccount = () => {
  if (!SERVICE_ACCOUNT.trim()) throw new Error("missing_ga4_service_account_env");
  const parsed = JSON.parse(SERVICE_ACCOUNT) as { client_email?: string; private_key?: string };
  if (!parsed.client_email || !parsed.private_key) throw new Error("invalid_ga4_service_account_env");
  return parsed;
};

const bigQueryClient = () => {
  const credentials = parseServiceAccount();
  const auth = new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ["https://www.googleapis.com/auth/bigquery", "https://www.googleapis.com/auth/cloud-platform"],
  });
  return google.bigquery({ version: "v2", auth });
};

const isRetryableBigQueryError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  return /ETIMEDOUT|ECONNRESET|socket hang up|rateLimitExceeded|backendError|internalError/i.test(message);
};

const runQuery = async (bq: ReturnType<typeof google.bigquery>, query: string): Promise<Row[]> => {
  let inserted;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      inserted = await bq.jobs.insert({
        projectId: JOB_PROJECT_ID,
        requestBody: {
          jobReference: { projectId: JOB_PROJECT_ID, location: LOCATION },
          configuration: {
            query: { query, useLegacySql: false, location: LOCATION },
          },
        },
      });
      break;
    } catch (error) {
      if (!isRetryableBigQueryError(error) || attempt === 3) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    }
  }
  if (!inserted) throw new Error("bigquery_job_insert_failed");
  const jobId = inserted.data.jobReference?.jobId;
  if (!jobId) throw new Error("missing_bigquery_job_id");

  const rows: Row[] = [];
  let pageToken: string | undefined;
  for (let attempt = 0; attempt < 90; attempt += 1) {
    let result;
    try {
      result = await bq.jobs.getQueryResults({
        projectId: JOB_PROJECT_ID,
        jobId,
        location: LOCATION,
        maxResults: 10000,
        pageToken,
      });
    } catch (error) {
      if (!isRetryableBigQueryError(error)) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1000));
      continue;
    }
    if (!result.data.jobComplete) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      continue;
    }

    const fields = result.data.schema?.fields?.map((field) => field.name || "") || [];
    rows.push(
      ...(result.data.rows || []).map((row) => {
        const output: Row = {};
        (row.f || []).forEach((cell, index) => {
          output[fields[index] || `field_${index}`] = (cell.v as string | null) ?? null;
        });
        return output;
      }),
    );
    pageToken = result.data.pageToken || undefined;
    if (!pageToken) return rows;
  }
  throw new Error("bigquery_query_timeout");
};

const listDailySuffixes = async (bq: ReturnType<typeof google.bigquery>, segment: DatasetSegment) => {
  const suffixes: string[] = [];
  let pageToken: string | undefined;
  do {
    const result = await bq.tables.list({
      projectId: segment.projectId,
      datasetId: segment.datasetId,
      maxResults: 1000,
      pageToken,
    });
    for (const table of result.data.tables || []) {
      const tableId = table.tableReference?.tableId || "";
      const matched = /^events_(\d{8})$/.exec(tableId);
      if (matched) suffixes.push(matched[1]);
    }
    pageToken = result.data.nextPageToken || undefined;
  } while (pageToken);
  return suffixes.sort();
};

const siteConfigs = (): SiteConfig[] => [
  {
    site: "biocom",
    displayName: "바이오컴",
    propertyId: process.env.GA4_BIOCOM_PROPERTY_ID?.trim() || "304759974",
    segments: [
      {
        label: "current",
        projectId: PROJECT_ID,
        datasetId: `analytics_${process.env.GA4_BIOCOM_PROPERTY_ID?.trim() || "304759974"}`,
      },
    ],
  },
  {
    site: "thecleancoffee",
    displayName: "더클린커피",
    propertyId: process.env.GA4_COFFEE_PROPERTY_ID?.trim() || "326949178",
    segments: [
      {
        label: "current",
        projectId: PROJECT_ID,
        datasetId: `analytics_${process.env.GA4_COFFEE_PROPERTY_ID?.trim() || "326949178"}`,
      },
    ],
  },
];

const sourceSql = (segment: DatasetSegment, startSuffix: string, endSuffix: string) => `
SELECT
  event_name,
  event_timestamp,
  event_date,
  user_pseudo_id,
  CAST((SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'ga_session_id') AS STRING) AS ga_session_id,
  LOWER(COALESCE((SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'page_location'), '')) AS page_location,
  COALESCE((SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'engagement_time_msec'), 0) AS engagement_time_msec,
  COALESCE(
    (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'percent_scrolled'),
    CAST((SELECT value.double_value FROM UNNEST(event_params) WHERE key = 'percent_scrolled') AS INT64),
    0
  ) AS percent_scrolled
FROM \`${segment.projectId}.${segment.datasetId}.events_*\`
WHERE _TABLE_SUFFIX BETWEEN '${startSuffix}' AND '${endSuffix}'
`;

const integrityQuery = (parts: string) => `
WITH base AS (
${parts}
),
prepared AS (
  SELECT
    event_name,
    event_timestamp,
    event_date,
    CONCAT(COALESCE(user_pseudo_id, ''), '.', COALESCE(ga_session_id, '')) AS session_key,
    page_location,
    CAST(engagement_time_msec AS FLOAT64) AS engagement_time_msec,
    CAST(percent_scrolled AS INT64) AS percent_scrolled
  FROM base
  WHERE user_pseudo_id IS NOT NULL AND ga_session_id IS NOT NULL
),
sessions AS (
  SELECT
    session_key,
    SUM(engagement_time_msec) / 1000 AS dwell_seconds,
    MAX(percent_scrolled) AS max_percent_param,
    MAX(IF(event_name = 'scroll', 1, 0)) AS has_scroll_event,
    MAX(IF(event_name = 'page_view_long', 1, 0)) AS has_page_view_long,
    MAX(IF(REGEXP_CONTAINS(page_location, r'review|customer|story|후기'), 1, 0)) AS has_review_url,
    MAX(IF(REGEXP_CONTAINS(LOWER(event_name), r'review|customer|story|후기'), 1, 0)) AS has_review_event,
    MAX(IF(event_name = 'view_item', 1, 0)) AS has_view_item,
    MAX(IF(event_name = 'begin_checkout', 1, 0)) AS has_begin_checkout,
    MAX(IF(event_name = 'add_payment_info', 1, 0)) AS has_add_payment_info
  FROM prepared
  GROUP BY session_key
)
SELECT
  COUNT(*) AS sessions,
  COUNTIF(has_scroll_event = 1) AS sessions_with_scroll_event,
  COUNTIF(max_percent_param > 0) AS sessions_with_percent_param,
  COUNTIF(max_percent_param >= 90) AS sessions_raw_percent90,
  COUNTIF(GREATEST(max_percent_param, IF(has_scroll_event = 1, 90, 0)) >= 90) AS sessions_assumed_scroll90,
  COUNTIF(has_page_view_long = 1) AS sessions_with_page_view_long,
  COUNTIF(has_review_url = 1) AS sessions_with_review_url,
  COUNTIF(has_review_event = 1) AS sessions_with_review_event,
  COUNTIF(has_view_item = 1) AS sessions_with_view_item,
  COUNTIF(has_begin_checkout = 1) AS sessions_with_begin_checkout,
  COUNTIF(has_add_payment_info = 1) AS sessions_with_add_payment_info,
  APPROX_QUANTILES(dwell_seconds, 100)[OFFSET(50)] AS p50_dwell_seconds,
  APPROX_QUANTILES(dwell_seconds, 100)[OFFSET(75)] AS p75_dwell_seconds
FROM sessions
`;

const eventDistributionQuery = (parts: string) => `
WITH base AS (
${parts}
),
prepared AS (
  SELECT
    event_name,
    CONCAT(COALESCE(user_pseudo_id, ''), '.', COALESCE(ga_session_id, '')) AS session_key,
    page_location,
    CAST(percent_scrolled AS INT64) AS percent_scrolled
  FROM base
  WHERE user_pseudo_id IS NOT NULL AND ga_session_id IS NOT NULL
)
SELECT
  event_name,
  COUNT(*) AS events,
  COUNT(DISTINCT session_key) AS sessions,
  COUNTIF(percent_scrolled = 0) AS percent_scrolled_0_events,
  COUNTIF(percent_scrolled BETWEEN 1 AND 49) AS percent_scrolled_1_49_events,
  COUNTIF(percent_scrolled BETWEEN 50 AND 89) AS percent_scrolled_50_89_events,
  COUNTIF(percent_scrolled >= 90) AS percent_scrolled_90_plus_events,
  COUNTIF(REGEXP_CONTAINS(page_location, r'review|customer|story|후기')) AS review_url_events
FROM prepared
WHERE event_name IN ('scroll', 'page_view_long', 'view_item', 'begin_checkout', 'add_payment_info', 'purchase')
   OR REGEXP_CONTAINS(LOWER(event_name), r'review|customer|story|후기|scroll|long')
GROUP BY event_name
ORDER BY events DESC
LIMIT 50
`;

const fetchLeading = async (site: SiteKey) => {
  const url = `${ATTR_BASE_URL}/api/attribution/leading-indicators?site=${site}&window=7d&channel=meta&dimension=buyer_vs_leaver`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`leading_indicators_${site}_${response.status}`);
  return response.json() as Promise<Record<string, unknown>>;
};

const buildSiteResult = async (bq: ReturnType<typeof google.bigquery>, config: SiteConfig) => {
  const suffixes = (await Promise.all(config.segments.map((segment) => listDailySuffixes(bq, segment)))).flat();
  const latest = suffixes.sort().at(-1);
  if (!latest) throw new Error(`no_daily_tables_${config.site}`);
  const start = addDays(suffixToDate(latest), -6);
  const parts = config.segments
    .map((segment) => sourceSql(segment, start, latest))
    .join("\nUNION ALL\n");

  const integrityRows = await runQuery(bq, integrityQuery(parts));
  const eventRows = await runQuery(bq, eventDistributionQuery(parts));
  const leading = await fetchLeading(config.site);

  const integrity = integrityRows[0] || {};
  const sessions = toNum(integrity.sessions);
  const rawScroll90 = toNum(integrity.sessions_raw_percent90);
  const assumedScroll90 = toNum(integrity.sessions_assumed_scroll90);
  const scrollEventSessions = toNum(integrity.sessions_with_scroll_event);

  return {
    site: config.site,
    display_name: config.displayName,
    window: {
      label: "latest_7d_ga4_daily_export",
      start_date: suffixToDate(start),
      end_date: suffixToDate(latest),
    },
    ga4_integrity: {
      sessions,
      sessions_with_scroll_event: scrollEventSessions,
      sessions_with_percent_param: toNum(integrity.sessions_with_percent_param),
      sessions_raw_percent90: rawScroll90,
      sessions_assumed_scroll90: assumedScroll90,
      raw_scroll90_rate_pct: pct(rawScroll90, sessions),
      assumed_scroll90_rate_pct: pct(assumedScroll90, sessions),
      scroll90_inflation_pct_point:
        pct(assumedScroll90, sessions) !== null && pct(rawScroll90, sessions) !== null
          ? Number(((pct(assumedScroll90, sessions) ?? 0) - (pct(rawScroll90, sessions) ?? 0)).toFixed(2))
          : null,
      scroll_event_rate_pct: pct(scrollEventSessions, sessions),
      page_view_long_sessions: toNum(integrity.sessions_with_page_view_long),
      page_view_long_rate_pct: pct(toNum(integrity.sessions_with_page_view_long), sessions),
      review_url_sessions: toNum(integrity.sessions_with_review_url),
      review_url_rate_pct: pct(toNum(integrity.sessions_with_review_url), sessions),
      review_event_sessions: toNum(integrity.sessions_with_review_event),
      review_event_rate_pct: pct(toNum(integrity.sessions_with_review_event), sessions),
      p50_dwell_seconds: Math.round(toNum(integrity.p50_dwell_seconds)),
      p75_dwell_seconds: Math.round(toNum(integrity.p75_dwell_seconds)),
      view_item_rate_pct: pct(toNum(integrity.sessions_with_view_item), sessions),
      begin_checkout_rate_pct: pct(toNum(integrity.sessions_with_begin_checkout), sessions),
      add_payment_info_rate_pct: pct(toNum(integrity.sessions_with_add_payment_info), sessions),
    },
    ga4_event_distribution: eventRows.map((row) => ({
      event_name: row.event_name || "",
      events: toNum(row.events),
      sessions: toNum(row.sessions),
      percent_scrolled_0_events: toNum(row.percent_scrolled_0_events),
      percent_scrolled_1_49_events: toNum(row.percent_scrolled_1_49_events),
      percent_scrolled_50_89_events: toNum(row.percent_scrolled_50_89_events),
      percent_scrolled_90_plus_events: toNum(row.percent_scrolled_90_plus_events),
      review_url_events: toNum(row.review_url_events),
    })),
    leading_indicators_live: {
      cohort: leading.cohort,
      comparison: leading.comparison,
      headline: leading.headline,
      caveats: leading.caveats,
    },
  };
};

const writeMarkdown = async (summary: Record<string, unknown>) => {
  const sites = summary.sites as Array<Record<string, unknown>>;
  const lines: string[] = [];
  lines.push("# scroll90 무결성 dry-run — 2026-05-19");
  lines.push("");
  lines.push("문서 성격: Green read-only audit");
  lines.push("");
  lines.push("```yaml");
  lines.push("harness_preflight:");
  lines.push("  common_harness_read: true");
  lines.push("  project_harness_read: true");
  lines.push("  lane: Green");
  lines.push("  allowed_actions:");
  lines.push("    - ga4_bigquery_read_only_aggregate");
  lines.push("    - leading_indicators_api_read_only");
  lines.push("    - local_report_write");
  lines.push("  forbidden_actions:");
  lines.push("    - platform_send");
  lines.push("    - gtm_publish");
  lines.push("    - operating_db_write");
  lines.push("    - vm_cloud_write");
  lines.push("    - raw_identifier_output");
  lines.push("  source_window_freshness_confidence:");
  lines.push(`    source: GA4 BigQuery daily export + leading-indicators API`);
  lines.push(`    window: latest 7d per site`);
  lines.push(`    freshness: ${String(summary.generated_at_kst)}`);
  lines.push("    confidence: high for GA4 aggregate event integrity, medium for VM-GA4 cohort interpretation");
  lines.push("```");
  lines.push("");
  lines.push("## 이번에 가능해진 것");
  lines.push("");
  lines.push("GA4 원본 기준의 `scroll` 이벤트와 `percent_scrolled` 값을 분리했다. 과거 dry-run의 높은 scroll90은 `scroll` 이벤트 자체를 90% 도달로 간주한 계산 영향이 컸는지 확인할 수 있다.");
  lines.push("");
  lines.push("## 사이트별 요약");
  lines.push("");
  lines.push("| 사이트 | GA4 세션 | raw percent_scrolled>=90 | scroll 이벤트를 90으로 간주 | 차이 | page_view_long | 리뷰 URL/이벤트 도달 | p50/p75 체류 |");
  lines.push("| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |");
  for (const site of sites) {
    const ga4 = site.ga4_integrity as Record<string, unknown>;
    lines.push(
      `| ${site.display_name} | ${ga4.sessions} | ${ga4.raw_scroll90_rate_pct}% | ${ga4.assumed_scroll90_rate_pct}% | ${ga4.scroll90_inflation_pct_point}%p | ${ga4.page_view_long_rate_pct}% | ${ga4.review_url_rate_pct}% / ${ga4.review_event_rate_pct}% | ${ga4.p50_dwell_seconds}s / ${ga4.p75_dwell_seconds}s |`,
    );
  }
  lines.push("");
  lines.push("## 해석");
  lines.push("");
  lines.push("- `raw percent_scrolled>=90`은 GA4 event_params에 90 이상 값이 들어온 경우만 센 값이다.");
  lines.push("- `scroll 이벤트를 90으로 간주`는 기존 일부 dry-run에서 쓰던 방식이다. GA4 기본 scroll 이벤트는 보통 90% 도달 때 발생하지만, 구현에 따라 percent_scrolled 값이 0으로 들어오는 사이트가 있어 이 방식은 비율을 부풀릴 수 있다.");
  lines.push("- live leadingIndicators API는 VM Cloud row의 `scroll_max_percent` 계열 metadata만 읽으므로 GA4 기반 과거 dry-run과 같은 지표가 아니다.");
  lines.push("- 따라서 scroll90을 선행지표로 쓰려면 분모와 source를 같이 내려줘야 한다: 전체 세션 대비, scroll 관측 세션 대비, raw percent 기반, assumed scroll 기반을 분리해야 한다.");
  lines.push("");
  lines.push("## 권장 API 보강");
  lines.push("");
  lines.push("- `scroll_known_sessions`: scroll 값을 알고 있는 세션 수.");
  lines.push("- `scroll_unknown_sessions`: scroll 값이 없는 세션 수.");
  lines.push("- `scroll90_known_rate_pct`: scroll 관측 세션 중 90% 이상.");
  lines.push("- `scroll90_all_sessions_rate_pct`: 전체 cohort 중 90% 이상.");
  lines.push("- `scroll_source`: `vm_metadata`, `ga4_percent_scrolled`, `ga4_scroll_event_assumed_90` 중 하나.");
  lines.push("- `page_view_long_rate_pct`, `review_reach_rate_pct`, `dwell_p50/p75`를 같은 cohort 분모로 제공.");
  lines.push("");
  lines.push("## 이벤트 분포");
  for (const site of sites) {
    lines.push("");
    lines.push(`### ${site.display_name}`);
    lines.push("");
    lines.push("| event_name | events | sessions | percent=0 | 1-49 | 50-89 | 90+ | review URL events |");
    lines.push("| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |");
    for (const event of site.ga4_event_distribution as Array<Record<string, unknown>>) {
      lines.push(
        `| ${event.event_name} | ${event.events} | ${event.sessions} | ${event.percent_scrolled_0_events} | ${event.percent_scrolled_1_49_events} | ${event.percent_scrolled_50_89_events} | ${event.percent_scrolled_90_plus_events} | ${event.review_url_events} |`,
      );
    }
  }
  await fs.writeFile(path.join(REPO_ROOT, "project", `scroll90-integrity-dry-run-${OUTPUT_DATE}.md`), `${lines.join("\n")}\n`);
};

const main = async () => {
  const bq = bigQueryClient();
  const sites = [];
  for (const config of siteConfigs()) {
    sites.push(await buildSiteResult(bq, config));
  }
  const summary = {
    generated_at_kst: kstNow(),
    safety: {
      raw_identifier_output: false,
      external_platform_send: 0,
      operating_db_write: 0,
      vm_cloud_write: 0,
      gtm_publish: 0,
    },
    sites,
  };

  await fs.writeFile(
    path.join(REPO_ROOT, "data", `scroll90-integrity-dry-run-${OUTPUT_DATE}.json`),
    `${JSON.stringify(summary, null, 2)}\n`,
  );
  await writeMarkdown(summary);
  console.log(JSON.stringify(summary, null, 2));
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
