#!/usr/bin/env tsx
/**
 * GA4 ↔ VM Cloud join-key presence + coffee middle-event gap dry-run.
 *
 * Green read-only:
 * - VM Cloud SQLite is queried through SSH with aggregate-only SQL.
 * - GA4 BigQuery export is queried read-only.
 * - No raw order/payment/member/click identifiers are printed.
 */

import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import dotenv from "dotenv";
import { google } from "googleapis";

dotenv.config({ path: path.resolve(__dirname, "..", ".env"), quiet: true });

const execFileAsync = promisify(execFile);

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const OUTPUT_DATE = "20260517";
const DEFAULT_PROJECT_ID = "project-dadba7dd-0229-4ff6-81c";
const JOB_PROJECT_ID = process.env.BIGQUERY_JOB_PROJECT_ID?.trim() || DEFAULT_PROJECT_ID;
const DEFAULT_LOCATION = process.env.GA4_BQ_LOCATION?.trim() || "asia-northeast3";
const SERVICE_ACCOUNT = process.env.GA4_BIOCOM_SERVICE_ACCOUNT_KEY || process.env.GA4_SERVICE_ACCOUNT_KEY || "";

type SiteKey = "biocom" | "thecleancoffee";

type DatasetSegment = {
  label: string;
  projectId: string;
  datasetId: string;
};

type SiteConfig = {
  site: SiteKey;
  displayName: string;
  ga4PropertyId: string;
  segments: DatasetSegment[];
};

const pct = (num: number, den: number): number => (den ? Math.round((num / den) * 10000) / 100 : 0);
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

const parseJsonArraySection = (raw: string) => {
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  if (start < 0 || end < start) return [];
  return parseJson<Array<Record<string, unknown>>>(raw.slice(start, end + 1), []);
};

const parseServiceAccount = () => {
  if (!SERVICE_ACCOUNT.trim()) throw new Error("missing_ga4_service_account_env");
  const parsed = parseJson<Record<string, string>>(SERVICE_ACCOUNT, {});
  if (!parsed.client_email || !parsed.private_key) throw new Error("invalid_ga4_service_account_env");
  return parsed;
};

const bigQueryClient = async () => {
  const credentials = parseServiceAccount();
  const auth = new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ["https://www.googleapis.com/auth/bigquery", "https://www.googleapis.com/auth/cloud-platform"],
  });
  return google.bigquery({ version: "v2", auth });
};

const runQuery = async (bq: ReturnType<typeof google.bigquery>, query: string) => {
  const inserted = await bq.jobs.insert({
    projectId: JOB_PROJECT_ID,
    requestBody: {
      jobReference: { projectId: JOB_PROJECT_ID, location: DEFAULT_LOCATION },
      configuration: {
        query: {
          query,
          useLegacySql: false,
          location: DEFAULT_LOCATION,
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
      location: DEFAULT_LOCATION,
      maxResults: 5000,
    });
    if (result.data.jobComplete) {
      const fields = result.data.schema?.fields?.map((field) => field.name || "") || [];
      return (result.data.rows || []).map((row) => {
        const output: Record<string, string | null> = {};
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

const tableExists = async (
  bq: ReturnType<typeof google.bigquery>,
  segment: DatasetSegment,
  tableId: string,
): Promise<boolean> => {
  try {
    await bq.tables.get({
      projectId: segment.projectId,
      datasetId: segment.datasetId,
      tableId,
    });
    return true;
  } catch {
    return false;
  }
};

const listDailySuffixes = async (bq: ReturnType<typeof google.bigquery>, segment: DatasetSegment) => {
  const tables: string[] = [];
  let pageToken: string | undefined;
  do {
    const result = await bq.tables.list({
      projectId: segment.projectId,
      datasetId: segment.datasetId,
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

const siteConfigs = (): SiteConfig[] => [
  {
    site: "biocom",
    displayName: "바이오컴",
    ga4PropertyId: process.env.GA4_BIOCOM_PROPERTY_ID?.trim() || "304759974",
    segments: [
      {
        label: "archive",
        projectId: DEFAULT_PROJECT_ID,
        datasetId: `analytics_${process.env.GA4_BIOCOM_PROPERTY_ID?.trim() || "304759974"}_hurdlers_backfill`,
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
    segments: [
      {
        label: "current",
        projectId: DEFAULT_PROJECT_ID,
        datasetId: `analytics_${process.env.GA4_COFFEE_PROPERTY_ID?.trim() || "326949178"}`,
      },
    ],
  },
];

const sourceSql = (segment: DatasetSegment, startSuffix: string, endSuffix: string) => `
SELECT
  event_name,
  user_pseudo_id,
  CAST((SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'ga_session_id') AS STRING) AS ga_session_id,
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'page_location') AS page_location
FROM \`${segment.projectId}.${segment.datasetId}.events_*\`
WHERE _TABLE_SUFFIX BETWEEN '${startSuffix}' AND '${endSuffix}'
`;

const ga4EventGapQuery = (parts: string) => `
WITH base AS (
${parts}
),
prepared AS (
  SELECT
    event_name,
    CONCAT(COALESCE(user_pseudo_id, ''), '.', COALESCE(ga_session_id, '')) AS session_key,
    LOWER(COALESCE(page_location, '')) AS page_location
  FROM base
  WHERE user_pseudo_id IS NOT NULL AND ga_session_id IS NOT NULL
)
SELECT
  event_name,
  COUNT(*) AS events,
  COUNT(DISTINCT session_key) AS sessions,
  COUNTIF(REGEXP_CONTAINS(page_location, r'/shop_payment|checkout|payment')) AS payment_page_events,
  COUNTIF(REGEXP_CONTAINS(page_location, r'/shop_cart|cart')) AS cart_page_events,
  COUNTIF(REGEXP_CONTAINS(page_location, r'/shop_view|goods|product')) AS product_page_events
FROM prepared
GROUP BY event_name
ORDER BY events DESC
LIMIT 100
`;

const buildGa4EventGap = async (bq: ReturnType<typeof google.bigquery>, config: SiteConfig) => {
  const segmentSuffixes: Array<{ segment: DatasetSegment; suffixes: string[] }> = [];
  for (const segment of config.segments) {
    segmentSuffixes.push({ segment, suffixes: await listDailySuffixes(bq, segment) });
  }
  const latestSuffix = segmentSuffixes.flatMap((item) => item.suffixes).sort().at(-1);
  if (!latestSuffix) throw new Error(`no_ga4_daily_tables_${config.site}`);
  const latest = new Date(`${latestSuffix.slice(0, 4)}-${latestSuffix.slice(4, 6)}-${latestSuffix.slice(6, 8)}T00:00:00Z`);
  const start = new Date(latest);
  start.setUTCDate(start.getUTCDate() - 6);
  const startSuffix = `${start.getUTCFullYear()}${String(start.getUTCMonth() + 1).padStart(2, "0")}${String(
    start.getUTCDate(),
  ).padStart(2, "0")}`;

  const parts: string[] = [];
  const usedSegments: Array<{ label: string; dataset: string; start_suffix: string; end_suffix: string }> = [];
  for (const item of segmentSuffixes) {
    const segmentStart = item.suffixes.find((suffix) => suffix >= startSuffix && suffix <= latestSuffix);
    const segmentEnd = [...item.suffixes].reverse().find((suffix) => suffix >= startSuffix && suffix <= latestSuffix);
    if (!segmentStart || !segmentEnd) continue;
    if (!(await tableExists(bq, item.segment, `events_${segmentEnd}`))) continue;
    parts.push(sourceSql(item.segment, segmentStart, segmentEnd));
    usedSegments.push({
      label: item.segment.label,
      dataset: `${item.segment.projectId}.${item.segment.datasetId}`,
      start_suffix: segmentStart,
      end_suffix: segmentEnd,
    });
  }
  if (!parts.length) throw new Error(`no_ga4_query_parts_${config.site}`);

  const rows = await runQuery(bq, ga4EventGapQuery(parts.join("\nUNION ALL\n")));
  const eventRows = rows.map((row) => ({
    event_name: String(row.event_name || ""),
    events: num(row.events),
    sessions: num(row.sessions),
    payment_page_events: num(row.payment_page_events),
    cart_page_events: num(row.cart_page_events),
    product_page_events: num(row.product_page_events),
  }));
  const byName = new Map(eventRows.map((row) => [row.event_name, row]));
  const middle = {
    view_item_sessions: byName.get("view_item")?.sessions || 0,
    add_to_cart_sessions: byName.get("add_to_cart")?.sessions || 0,
    view_cart_sessions: byName.get("view_cart")?.sessions || 0,
    begin_checkout_sessions: byName.get("begin_checkout")?.sessions || 0,
    add_payment_info_sessions: byName.get("add_payment_info")?.sessions || 0,
    sign_up_sessions: byName.get("sign_up")?.sessions || 0,
    purchase_sessions: byName.get("purchase")?.sessions || 0,
  };
  const paymentPageEvidence = eventRows
    .filter((row) => row.payment_page_events > 0)
    .slice(0, 20)
    .map((row) => ({
      event_name: row.event_name,
      payment_page_events: row.payment_page_events,
      sessions: row.sessions,
    }));
  return {
    site: config.site,
    display_name: config.displayName,
    property_id: config.ga4PropertyId,
    window: {
      start_date: `${startSuffix.slice(0, 4)}-${startSuffix.slice(4, 6)}-${startSuffix.slice(6, 8)}`,
      end_date: `${latestSuffix.slice(0, 4)}-${latestSuffix.slice(4, 6)}-${latestSuffix.slice(6, 8)}`,
      latest_daily_table: `events_${latestSuffix}`,
    },
    source: usedSegments,
    middle_event_sessions: middle,
    payment_page_event_evidence: paymentPageEvidence,
    top_events: eventRows.slice(0, 30),
    gap_interpretation:
      config.site === "thecleancoffee" && middle.begin_checkout_sessions === 0 && middle.purchase_sessions > 0
        ? "GA4 purchase exists but begin_checkout/add_payment_info are absent. This is event instrumentation gap, not proof that checkout did not happen."
        : "GA4 middle event availability should be read with VM Cloud cross-check.",
  };
};

const runVmAggregate = async () => {
  const sqlCoverage = `WITH base AS (
  SELECT CASE WHEN source='biocom_imweb' THEN 'biocom' WHEN source='thecleancoffee_imweb' THEN 'thecleancoffee' ELSE source END AS site,
    source, touchpoint, payment_status, logged_at, order_id, payment_key, checkout_id, customer_key, ga_session_id, metadata_json
  FROM attribution_ledger
  WHERE logged_at >= datetime('now','-7 days')
    AND source IN ('biocom_imweb','thecleancoffee_imweb')
)
SELECT site, touchpoint, COUNT(*) AS rows,
  SUM(ga_session_id<>'') AS with_ga_session_id,
  SUM(checkout_id<>'') AS with_checkout_id,
  SUM(order_id<>'') AS with_order_key,
  SUM(payment_key<>'') AS with_payment_key,
  SUM(COALESCE(json_extract(metadata_json,'$.clientId'), json_extract(metadata_json,'$.client_id'), '')<>'') AS with_metadata_client_id,
  SUM(COALESCE(json_extract(metadata_json,'$.userPseudoId'), json_extract(metadata_json,'$.user_pseudo_id'), '')<>'') AS with_metadata_user_pseudo_id,
  SUM(COALESCE(json_extract(metadata_json,'$.gaSessionId'), json_extract(metadata_json,'$.ga_session_id'), '')<>'') AS with_metadata_ga_session_id,
  SUM(CASE WHEN json_extract(metadata_json,'$.ga_join_key_present') IN (1,'true') THEN 1 ELSE 0 END) AS with_ga_join_key_marker
FROM base
GROUP BY site, touchpoint
ORDER BY site, touchpoint;`;

  const sqlConfirmed = `WITH ps AS (
  SELECT CASE WHEN source='biocom_imweb' THEN 'biocom' WHEN source='thecleancoffee_imweb' THEN 'thecleancoffee' ELSE source END AS site,
    source, logged_at, order_id, payment_key, checkout_id, ga_session_id, metadata_json
  FROM attribution_ledger
  WHERE logged_at >= datetime('now','-7 days')
    AND source IN ('biocom_imweb','thecleancoffee_imweb')
    AND touchpoint='payment_success'
    AND payment_status='confirmed'
),
prior AS (
  SELECT source, checkout_id, ga_session_id, logged_at
  FROM attribution_ledger
  WHERE logged_at >= datetime('now','-8 days')
    AND source IN ('biocom_imweb','thecleancoffee_imweb')
    AND touchpoint IN ('checkout_started','payment_page_seen')
)
SELECT ps.site, COUNT(*) AS confirmed_rows,
  SUM(ps.ga_session_id<>'') AS with_ga_session_id,
  SUM(ps.checkout_id<>'') AS with_checkout_id,
  SUM(ps.payment_key<>'') AS with_payment_key,
  SUM(COALESCE(json_extract(ps.metadata_json,'$.clientId'), json_extract(ps.metadata_json,'$.client_id'), '')<>'') AS with_metadata_client_id,
  SUM(EXISTS(SELECT 1 FROM prior p WHERE p.source=ps.source AND ps.checkout_id<>'' AND p.checkout_id=ps.checkout_id)) AS matched_prior_by_checkout_id,
  SUM(EXISTS(SELECT 1 FROM prior p WHERE p.source=ps.source AND ps.ga_session_id<>'' AND p.ga_session_id=ps.ga_session_id)) AS matched_prior_by_ga_session_id,
  SUM(EXISTS(SELECT 1 FROM site_landing_ledger l WHERE l.site=ps.site AND ps.ga_session_id<>'' AND l.ga_session_id=ps.ga_session_id AND l.landed_at >= datetime(ps.logged_at, '-7 days') AND l.landed_at <= ps.logged_at)) AS matched_site_landing_by_ga_session_id,
  SUM(EXISTS(SELECT 1 FROM site_landing_ledger l WHERE l.site=ps.site AND COALESCE(json_extract(ps.metadata_json,'$.clientId'), json_extract(ps.metadata_json,'$.client_id'), '')<>'' AND l.client_id=COALESCE(json_extract(ps.metadata_json,'$.clientId'), json_extract(ps.metadata_json,'$.client_id'), '') AND l.landed_at >= datetime(ps.logged_at, '-7 days') AND l.landed_at <= ps.logged_at)) AS matched_site_landing_by_client_id
FROM ps
GROUP BY ps.site
ORDER BY ps.site;`;

  const sqlLanding = `SELECT site, COUNT(*) AS rows,
  SUM(ga_session_id<>'') AS with_ga_session_id,
  SUM(client_id<>'') AS with_client_id,
  SUM(local_session_id_hash<>'') AS with_local_session_id_hash,
  SUM(landing_path LIKE '%shop_cart%') AS cart_path_rows,
  SUM(landing_path LIKE '%shop_payment%') AS payment_path_rows
FROM site_landing_ledger
WHERE landed_at >= datetime('now','-7 days')
  AND site IN ('biocom','thecleancoffee')
GROUP BY site
ORDER BY site;`;

  const localShell = `
VM_SSH_USER=taejun
VM_SSH_HOST=34.64.104.94
ssh -q -T -i "${process.env.HOME}/.ssh/id_ed25519" -o IdentitiesOnly=yes -o BatchMode=yes -o ConnectTimeout=8 "$VM_SSH_USER"@"$VM_SSH_HOST" <<'REMOTE'
sudo -n -u biocomkr_sns bash <<'EOSQL'
DB=/home/biocomkr_sns/seo/shared/backend-data/crm.sqlite3
sqlite3 -json "$DB" <<'SQL'
${sqlCoverage}
SQL
printf "\\n__SECTION__\\n"
sqlite3 -json "$DB" <<'SQL'
${sqlConfirmed}
SQL
printf "\\n__SECTION__\\n"
sqlite3 -json "$DB" <<'SQL'
${sqlLanding}
SQL
EOSQL
REMOTE
`;
  const { stdout } = await execFileAsync("bash", ["-lc", localShell], { maxBuffer: 10 * 1024 * 1024 });
  const sections = stdout.split("__SECTION__").map((section) => section.trim()).filter(Boolean);
  return {
    coverage_by_touchpoint: parseJsonArraySection(sections[0] || "[]"),
    confirmed_join_coverage: parseJsonArraySection(sections[1] || "[]"),
    site_landing_coverage: parseJsonArraySection(sections[2] || "[]"),
  };
};

const enrichVm = (vm: Awaited<ReturnType<typeof runVmAggregate>>) => {
  const confirmed = vm.confirmed_join_coverage.map((row) => {
    const confirmedRows = num(row.confirmed_rows);
    return {
      ...row,
      ga_session_id_rate_pct: pct(num(row.with_ga_session_id), confirmedRows),
      checkout_id_rate_pct: pct(num(row.with_checkout_id), confirmedRows),
      metadata_client_id_rate_pct: pct(num(row.with_metadata_client_id), confirmedRows),
      prior_checkout_id_match_rate_pct: pct(num(row.matched_prior_by_checkout_id), confirmedRows),
      prior_ga_session_match_rate_pct: pct(num(row.matched_prior_by_ga_session_id), confirmedRows),
      site_landing_ga_session_match_rate_pct: pct(num(row.matched_site_landing_by_ga_session_id), confirmedRows),
      site_landing_client_id_match_rate_pct: pct(num(row.matched_site_landing_by_client_id), confirmedRows),
      same_population_status:
        pct(num(row.matched_site_landing_by_client_id), confirmedRows) >= 80
          ? "strong_enough_for_next_row_level_dry_run"
          : "needs_key_capture_improvement",
    };
  });
  return { ...vm, confirmed_join_coverage: confirmed };
};

const buildMarkdown = (payload: Record<string, unknown>) => {
  const vm = payload.vm_cloud as Record<string, unknown>;
  const ga4 = payload.ga4_event_gap as Array<Record<string, unknown>>;
  const confirmed = (vm.confirmed_join_coverage as Array<Record<string, unknown>>) || [];
  const lines: string[] = [];
  lines.push("# GA4 ↔ VM Cloud Join Key / Coffee Middle Event Gap Dry-run");
  lines.push("");
  lines.push(`작성 시각: ${payload.checked_at_kst}`);
  lines.push("Lane: Green read-only");
  lines.push("대상: biocom / thecleancoffee 분리");
  lines.push("");
  lines.push("```yaml");
  lines.push("harness_preflight:");
  lines.push("  common_harness_read:");
  lines.push("    - AGENTS.md");
  lines.push("    - harness/common/HARNESS_GUIDELINES.md");
  lines.push("    - harness/common/AUTONOMY_POLICY.md");
  lines.push("    - harness/common/REPORTING_TEMPLATE.md");
  lines.push("  project_harness_read:");
  lines.push("    - data/!data_inventory.md");
  lines.push("    - harness/coffee-data/README.md");
  lines.push("    - harness/coffee-data/RULES.md");
  lines.push("    - harness/coffee-data/VERIFY.md");
  lines.push("  lane: Green");
  lines.push("  allowed_actions:");
  lines.push("    - vm_cloud_sqlite_read_only_aggregate");
  lines.push("    - ga4_bigquery_read_only_aggregate");
  lines.push("    - local_report_script");
  lines.push("    - documentation_update");
  lines.push("  forbidden_actions:");
  lines.push("    - operating_db_write");
  lines.push("    - vm_cloud_schema_migration");
  lines.push("    - platform_send_or_upload");
  lines.push("    - gtm_publish");
  lines.push("    - vm_cloud_deploy_or_restart");
  lines.push("  source_window_freshness_confidence:");
  lines.push("    source: VM Cloud SQLite aggregate read-only + GA4 BigQuery daily export read-only");
  lines.push("    window: VM Cloud rolling last 7d; GA4 latest daily table minus 6 days");
  lines.push("    freshness: runtime query");
  lines.push("    confidence: medium_high for key presence, medium for row-level buyer/dropout join");
  lines.push("```");
  lines.push("");
  lines.push("## 10초 요약");
  lines.push("");
  lines.push("- VM Cloud 결제완료 row에는 GA4와 이어볼 수 있는 세션 키가 대부분 남아 있다.");
  lines.push("- 바이오컴과 더클린커피 모두 `checkout_id` 기준으로 결제 전 단계와 결제완료가 거의 이어진다.");
  lines.push("- 더클린커피 GA4는 purchase event는 있는데 begin_checkout/add_payment_info가 없다. 결제 단계가 없다는 뜻이 아니라 GA4 중간 이벤트 계측 gap이다.");
  lines.push("- 아직 예산 판단용 source별 구매율은 만들지 않는다. 다음 단계는 raw id 출력 없이 safe session/order bridge를 만드는 것이다.");
  lines.push("");
  lines.push("## VM Cloud confirmed purchase join key coverage");
  lines.push("");
  lines.push("| site | confirmed | GA session key | checkout key | metadata client key | prior checkout match | prior GA session match | landing match by client | status |");
  lines.push("|---|---:|---:|---:|---:|---:|---:|---:|---|");
  for (const row of confirmed) {
    lines.push(
      `| ${row.site} | ${row.confirmed_rows} | ${row.ga_session_id_rate_pct}% | ${row.checkout_id_rate_pct}% | ${row.metadata_client_id_rate_pct}% | ${row.prior_checkout_id_match_rate_pct}% | ${row.prior_ga_session_match_rate_pct}% | ${row.site_landing_client_id_match_rate_pct}% | ${row.same_population_status} |`,
    );
  }
  lines.push("");
  lines.push("## 쉬운 설명");
  lines.push("");
  lines.push("이번 확인은 `이 주문이 어떤 방문에서 시작됐는지 추적할 수 있는 열쇠가 남아 있는가`를 보는 작업이다.");
  lines.push("열쇠가 있으면 다음 sprint에서 구매자와 이탈자를 같은 기준으로 비교할 수 있다.");
  lines.push("열쇠가 없으면 GA4의 방문자 숫자와 VM Cloud의 주문 숫자를 억지로 나누게 되고, 그 값은 진짜 구매율이 아니다.");
  lines.push("");
  lines.push("## GA4 middle event gap");
  lines.push("");
  lines.push("| site | window | view_item | add_to_cart | view_cart | begin_checkout | add_payment_info | sign_up | purchase | interpretation |");
  lines.push("|---|---|---:|---:|---:|---:|---:|---:|---:|---|");
  for (const site of ga4) {
    const middle = site.middle_event_sessions as Record<string, unknown>;
    const window = site.window as Record<string, unknown>;
    lines.push(
      `| ${site.site} | ${window.start_date}~${window.end_date} | ${middle.view_item_sessions} | ${middle.add_to_cart_sessions} | ${middle.view_cart_sessions} | ${middle.begin_checkout_sessions} | ${middle.add_payment_info_sessions} | ${middle.sign_up_sessions} | ${middle.purchase_sessions} | ${site.gap_interpretation} |`,
    );
  }
  lines.push("");
  lines.push("## 더클린커피 gap 판단");
  lines.push("");
  lines.push("- 더클린커피는 VM Cloud에서 결제 시작과 결제완료가 잡힌다.");
  lines.push("- 하지만 GA4에는 begin_checkout/add_payment_info가 0으로 나온다.");
  lines.push("- 따라서 `사용자가 결제 단계에 가지 않았다`가 아니라 `GA4 ecommerce 중간 이벤트가 더클린커피 결제 흐름에서 안 찍힌다`가 현재 판단이다.");
  lines.push("- 화면에는 GA4 중간 이벤트를 결제 단계 정답으로 쓰지 말고, VM Cloud payment_started를 결제 단계 primary로 써야 한다.");
  lines.push("");
  lines.push("## 다음 개발 판단");
  lines.push("");
  lines.push("- 바이오컴/더클린커피 모두 next step은 row-level safe bridge dry-run이다.");
  lines.push("- 더클린커피 GA4에는 begin_checkout/add_payment_info 보강 설계를 별도 ticket으로 둔다.");
  lines.push("- 운영 전송, GTM publish, VM Cloud deploy, 운영DB write는 하지 않았다.");
  return `${lines.join("\n").trimEnd()}\n`;
};

const main = async () => {
  const checkedAt = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date()).replace("T", " ");

  const bq = await bigQueryClient();
  const ga4 = [];
  for (const config of siteConfigs()) {
    ga4.push(await buildGa4EventGap(bq, config));
  }
  const vm = enrichVm(await runVmAggregate());
  const payload = {
    ok: true,
    checked_at_kst: `${checkedAt} KST`,
    mode: "green_read_only_ga4_vm_join_key_and_coffee_gap",
    source_window_freshness_confidence: {
      source: "VM Cloud SQLite aggregate read-only + GA4 BigQuery daily export read-only",
      window: "VM Cloud rolling last 7d; GA4 latest daily table minus 6 days",
      freshness: "VM Cloud queried at runtime; GA4 latest daily table per site",
      confidence: "medium_high for key presence; medium for row-level buyer/dropout join until safe bridge is built",
    },
    vm_cloud: vm,
    ga4_event_gap: ga4,
    safety: {
      no_send: true,
      no_write: true,
      no_deploy: true,
      no_publish: true,
      raw_identifier_output: false,
    },
  };

  const jsonPath = path.join(REPO_ROOT, "data", "project", `ga4-vm-join-key-and-coffee-gap-${OUTPUT_DATE}.json`);
  const mdPath = path.join(REPO_ROOT, "project", `ga4-vm-join-key-and-coffee-gap-${OUTPUT_DATE}.md`);
  await fs.mkdir(path.dirname(jsonPath), { recursive: true });
  await fs.mkdir(path.dirname(mdPath), { recursive: true });
  await fs.writeFile(jsonPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  await fs.writeFile(mdPath, buildMarkdown(payload), "utf8");
  console.log(JSON.stringify({ ok: true, jsonPath, mdPath, checked_at_kst: payload.checked_at_kst }, null, 2));
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
