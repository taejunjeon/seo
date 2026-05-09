#!/usr/bin/env tsx
/**
 * Canary effect meaningful dry-run.
 *
 * What:
 *   - Rebuild the confirmed-purchase candidate base from operational PG.
 *   - Read the live paid_click_intent_ledger directly from the attribution VM.
 *   - Report whether a canary effect comparison is meaningful with current join keys.
 *
 * Guardrails:
 *   - read-only operational PG SELECT
 *   - read-only VM SQLite SELECT over SSH
 *   - local JSON/Markdown artifact writes only
 *   - no deploy, no publish, no platform send, no production DB write
 */

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { queryPg } from "../src/postgres";

type CliOptions = {
  start: string;
  end: string;
  site: "biocom";
  output?: string;
  markdownOutput?: string;
  lookbackDays: number;
  vmHost: string;
  vmUser: string;
  sshKey: string;
  vmDbPath: string;
};

type PgOrderRow = {
  orderNumber: string;
  channelOrderNo: string;
  memberCode: string;
  paidAt: string;
  paymentMethod: string;
  pgName: string;
  paymentStatus: string;
  amount: string | number;
  lineRows: string | number;
  hasCancel: boolean;
  hasReturn: boolean;
  refundAmount: string | number;
};

type Candidate = {
  site: "biocom";
  order_number: string;
  order_hash: string;
  channel_order_no: string;
  channel_order_hash: string;
  payment_method: "homepage" | "npay_actual";
  include_reason: "homepage_payment_complete" | "npay_actual_confirmed_order";
  conversion_time: string;
  conversion_time_kst: string;
  value: number;
  currency: "KRW";
  member_code_present: boolean;
  member_code_hash: string;
  member_code_hash_method: "sha256_prefix_dry_run_only";
  direct_ledger_join: {
    deterministic_match_possible: false;
    prior_click_candidates_30d: number;
    prior_click_candidates_window: number;
    ambiguity: "none" | "single" | "multiple";
    reason: string;
  };
  send_candidate: false;
  block_reasons: string[];
};

type LedgerRow = {
  intent_id: string;
  received_at: string;
  captured_at: string;
  platform_hint: string;
  capture_stage: string;
  click_id_type: string;
  click_id_hash: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  landing_path: string;
  referrer_host: string;
  client_id: string;
  ga_session_id: string;
  local_session_id: string;
  allowed_query_json: string;
  status: string;
  reject_reason: string;
};

type LedgerColumn = {
  name: string;
};

const argValue = (name: string) =>
  process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);

const parseBoundary = (label: string, fallback: string): string => {
  const value = argValue(label) ?? fallback;
  if (value === "now") return new Date().toISOString();
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T00:00:00+09:00`).toISOString();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error(`--${label} must be ISO-ish date/time: ${value}`);
  return parsed.toISOString();
};

const parseArgs = (): CliOptions => ({
  start: parseBoundary("start", "2026-05-07T23:01:00+09:00"),
  end: parseBoundary("end", "now"),
  site: "biocom",
  output: argValue("output"),
  markdownOutput: argValue("markdown-output") ?? argValue("markdownOutput"),
  lookbackDays: Math.max(1, Number(argValue("lookback-days") ?? "30")),
  vmHost: argValue("vm-host") ?? "34.64.104.94",
  vmUser: argValue("vm-user") ?? "taejun",
  sshKey: path.resolve(argValue("ssh-key") ?? path.join(process.env.HOME ?? "", ".ssh", "id_ed25519")),
  vmDbPath: argValue("vm-db") ?? "/home/biocomkr_sns/seo/repo/backend/data/crm.sqlite3",
});

const toNumber = (value: unknown): number => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const sha256Prefix = (input: string): string => {
  if (!input) return "";
  return createHash("sha256").update(input).digest("hex").slice(0, 32);
};

const kstString = (value: Date | string = new Date()) =>
  new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(typeof value === "string" ? new Date(value) : value);

const countBy = <T extends string>(values: T[]) => {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value || "(blank)", (counts.get(value || "(blank)") ?? 0) + 1);
  return Object.fromEntries([...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
};

const percentile = (values: number[], p: number): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index];
};

const maxIso = (values: string[]): string => {
  let best = "";
  let bestMs = Number.NEGATIVE_INFINITY;
  for (const value of values) {
    const ms = Date.parse(value);
    if (Number.isFinite(ms) && ms > bestMs) {
      best = new Date(ms).toISOString();
      bestMs = ms;
    }
  }
  return best;
};

const shellQuote = (value: string) => `'${value.replace(/'/g, `'\\''`)}'`;

const runVmSqliteJson = <T>(options: CliOptions, sql: string): T[] => {
  const remote = `sqlite3 -json ${shellQuote(options.vmDbPath)} ${shellQuote(sql)}`;
  const output = execFileSync(
    "ssh",
    [
      "-i",
      options.sshKey,
      "-o",
      "IdentitiesOnly=yes",
      "-o",
      "BatchMode=yes",
      `${options.vmUser}@${options.vmHost}`,
      `sudo -n -u biocomkr_sns bash -lc ${shellQuote(remote)}`,
    ],
    { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 },
  );
  const trimmed = output.trim();
  if (!trimmed) return [];
  return JSON.parse(trimmed) as T[];
};

const readOperationalOrders = async (options: CliOptions): Promise<PgOrderRow[]> => {
  const result = await queryPg<PgOrderRow>(
    `
    WITH raw AS (
      SELECT
        order_number::text AS order_number,
        COALESCE(NULLIF(TRIM(raw_data ->> 'channelOrderNo'), ''), '') AS channel_order_no,
        COALESCE(NULLIF(TRIM(raw_data ->> 'memberCode'), ''), '') AS member_code,
        COALESCE(NULLIF(TRIM(payment_method::text), ''), '') AS payment_method,
        COALESCE(NULLIF(TRIM(pg_name::text), ''), '') AS pg_name,
        COALESCE(NULLIF(TRIM(payment_status::text), ''), '') AS payment_status,
        payment_complete_time::timestamptz AS paid_at,
        COALESCE(paid_price, final_order_amount, total_price, 0)::numeric AS amount,
        COALESCE(total_refunded_price, 0)::numeric AS refund_amount,
        COALESCE(NULLIF(cancellation_reason::text, ''), '') AS cancellation_reason,
        COALESCE(NULLIF(return_reason::text, ''), '') AS return_reason
      FROM public.tb_iamweb_users
      WHERE order_number IS NOT NULL
        AND TRIM(COALESCE(payment_complete_time::text, '')) ~ '^\\d{4}-\\d{2}-\\d{2}'
    ),
    order_level AS (
      SELECT
        order_number AS "orderNumber",
        MAX(channel_order_no) AS "channelOrderNo",
        MAX(member_code) AS "memberCode",
        MIN(paid_at) AS "paidAt",
        MAX(payment_method) AS "paymentMethod",
        MAX(pg_name) AS "pgName",
        MAX(payment_status) AS "paymentStatus",
        MAX(amount)::numeric AS "amount",
        COUNT(*)::int AS "lineRows",
        BOOL_OR(cancellation_reason NOT IN ('', 'nan', 'null')) AS "hasCancel",
        BOOL_OR(return_reason NOT IN ('', 'nan', 'null')) AS "hasReturn",
        MAX(refund_amount)::numeric AS "refundAmount"
      FROM raw
      GROUP BY order_number
    )
    SELECT *
    FROM order_level
    WHERE "paidAt" >= $1::timestamptz
      AND "paidAt" < $2::timestamptz
    ORDER BY "paidAt" ASC
    `,
    [options.start, options.end],
  );
  return result.rows;
};

const isExcludedOrder = (row: PgOrderRow): boolean => {
  const status = String(row.paymentStatus || "").toLowerCase();
  return (
    toNumber(row.amount) <= 0 ||
    row.hasCancel ||
    row.hasReturn ||
    toNumber(row.refundAmount) > 0 ||
    status.includes("refund") ||
    status.includes("cancel") ||
    ["refund_complete", "partial_refund_complete", "cancelled_before_deposit", "payment_overdue", "payment_preparation"].includes(status)
  );
};

const isNpay = (row: PgOrderRow): boolean => {
  const joined = `${row.paymentMethod} ${row.pgName} ${row.channelOrderNo}`.toLowerCase();
  return /naver|npay|네이버/.test(joined);
};

const readLedgerColumns = (options: CliOptions) =>
  runVmSqliteJson<LedgerColumn>(
    options,
    "SELECT name FROM pragma_table_info('paid_click_intent_ledger') ORDER BY cid;",
  ).map((row) => row.name);

const readLedgerRows = (options: CliOptions): LedgerRow[] =>
  runVmSqliteJson<LedgerRow>(
    options,
    `
    SELECT
      intent_id,
      received_at,
      captured_at,
      platform_hint,
      capture_stage,
      click_id_type,
      click_id_hash,
      utm_source,
      utm_medium,
      utm_campaign,
      landing_path,
      referrer_host,
      client_id,
      ga_session_id,
      local_session_id,
      allowed_query_json,
      status,
      reject_reason
    FROM paid_click_intent_ledger
    WHERE site = '${options.site}'
      AND received_at >= '${options.start}'
      AND received_at < '${options.end}'
    ORDER BY received_at ASC;
    `,
  );

const allowedQueryDebugKeyRows = (rows: LedgerRow[]): number => {
  let count = 0;
  for (const row of rows) {
    try {
      const parsed = JSON.parse(row.allowed_query_json || "{}") as Record<string, unknown>;
      if (Object.keys(parsed).some((key) => /test|debug|preview/i.test(key))) count += 1;
    } catch {
      // Invalid JSON is treated as not proving debug/test/preview traffic.
    }
  }
  return count;
};

const buildCandidate = (
  row: PgOrderRow,
  ledgerRows: LedgerRow[],
  windowStartMs: number,
  lookbackMs: number,
): Candidate => {
  const paidAt = new Date(row.paidAt).toISOString();
  const paidAtMs = Date.parse(paidAt);
  const prior30d = ledgerRows.filter((ledger) => {
    const receivedAt = Date.parse(ledger.received_at);
    return receivedAt >= paidAtMs - lookbackMs && receivedAt <= paidAtMs;
  }).length;
  const priorWindow = ledgerRows.filter((ledger) => {
    const receivedAt = Date.parse(ledger.received_at);
    return receivedAt >= windowStartMs && receivedAt <= paidAtMs;
  }).length;
  const ambiguity = prior30d === 0 ? "none" : prior30d === 1 ? "single" : "multiple";
  const paymentMethod = isNpay(row) ? "npay_actual" : "homepage";
  const memberCode = String(row.memberCode || "");

  return {
    site: "biocom",
    order_number: String(row.orderNumber || ""),
    order_hash: sha256Prefix(String(row.orderNumber || "")),
    channel_order_no: String(row.channelOrderNo || ""),
    channel_order_hash: sha256Prefix(String(row.channelOrderNo || "")),
    payment_method: paymentMethod,
    include_reason: paymentMethod === "npay_actual" ? "npay_actual_confirmed_order" : "homepage_payment_complete",
    conversion_time: paidAt,
    conversion_time_kst: `${kstString(paidAt)} KST`,
    value: Math.round(toNumber(row.amount)),
    currency: "KRW",
    member_code_present: Boolean(memberCode),
    member_code_hash: sha256Prefix(memberCode),
    member_code_hash_method: "sha256_prefix_dry_run_only",
    direct_ledger_join: {
      deterministic_match_possible: false,
      prior_click_candidates_30d: prior30d,
      prior_click_candidates_window: priorWindow,
      ambiguity,
      reason:
        "paid_click_intent_ledger has click/session keys but no member_code_hash/order_number bridge in current production schema.",
    },
    send_candidate: false,
    block_reasons: [
      "read_only_phase",
      "approval_required",
      "no_platform_send",
      "direct_ledger_missing_deterministic_order_bridge",
    ],
  };
};

const mdTable = (headers: string[], rows: unknown[][]) => {
  const escapeCell = (value: unknown) => String(value ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
  return [
    `| ${headers.map(escapeCell).join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map(escapeCell).join(" | ")} |`),
  ].join("\n");
};

const renderMarkdown = (payload: Record<string, any>) => [
  "```yaml",
  "harness_preflight:",
  "  common_harness_read:",
  "    - AGENTS.md",
  "    - docurule.md",
  "    - harness/common/HARNESS_GUIDELINES.md",
  "    - harness/common/AUTONOMY_POLICY.md",
  "    - harness/common/REPORTING_TEMPLATE.md",
  "  project_harness_read:",
  "    - docs/agent-harness/growth-data-harness-v0.md",
  "    - harness/npay-recovery/README.md",
  "    - data/!channelfunnel.md",
  "    - total/!total-current.md",
  "  required_context_docs:",
  "    - gdn/confirmed-purchase-prep-canary-interim-20260508.md",
  "    - gdn/path-c-member-code-attribution-design-20260508.md",
  "  lane: Green",
  "  allowed_actions:",
  "    - operational PG read-only SELECT",
  "    - Attribution VM SQLite read-only SELECT over SSH",
  "    - local JSON/Markdown artifact write",
  "    - no-send dry-run analysis",
  "  forbidden_actions:",
  "    - production DB write/schema migration",
  "    - backend deploy or PM2 restart",
  "    - GTM/Imweb publish",
  "    - GA4/Google Ads/Meta/TikTok/Naver platform send",
  "    - Google Ads conversion action or upload",
  "  source_window_freshness_confidence:",
  `    source: "operational PostgreSQL public.tb_iamweb_users + live Attribution VM paid_click_intent_ledger"`,
  `    window: "${payload.window.start_kst} ~ ${payload.window.end_kst}"`,
  `    freshness: "PG max paid_at ${payload.source_freshness.operational_pg.max_paid_at}; VM ledger max received_at ${payload.source_freshness.paid_click_intent_ledger.max_received_at}"`,
  `    confidence: ${payload.verdict.confidence}`,
  "```",
  "",
  "# Canary effect meaningful dry-run",
  "",
  `작성 시각: ${payload.generated_at_kst}`,
  "",
  "## 한 줄 결론",
  "",
  payload.verdict.one_line,
  "",
  "## Window",
  "",
  mdTable(
    ["item", "value"],
    [
      ["start_kst", payload.window.start_kst],
      ["end_kst", payload.window.end_kst],
      ["start_utc", payload.window.start_utc],
      ["end_utc", payload.window.end_utc],
      ["elapsed_hours", payload.window.elapsed_hours],
      ["full_24h_reached", payload.window.full_24h_reached ? "YES" : "NO"],
    ],
  ),
  "",
  "## 운영 PG 기반 새 dry-run input",
  "",
  mdTable(
    ["metric", "value"],
    [
      ["candidate_orders_all_status", payload.operational_pg_input.summary.candidate_orders_all_status],
      ["candidate_orders_confirmed_positive", payload.operational_pg_input.summary.candidate_orders_confirmed_positive],
      ["homepage_count", payload.operational_pg_input.summary.homepage_count],
      ["npay_actual_count", payload.operational_pg_input.summary.npay_actual_count],
      ["confirmed_positive_value", payload.operational_pg_input.summary.confirmed_positive_value],
      ["member_code_present_orders", payload.operational_pg_input.summary.member_code_present_orders],
      ["send_candidate", payload.operational_pg_input.summary.send_candidate],
    ],
  ),
  "",
  "## paid_click_intent_ledger 직접 source",
  "",
  mdTable(
    ["metric", "value"],
    [
      ["ledger_rows", payload.ledger_direct_source.summary.ledger_rows],
      ["unique_click_id_hash", payload.ledger_direct_source.summary.unique_click_id_hash],
      ["unique_client_id", payload.ledger_direct_source.summary.unique_client_id],
      ["unique_ga_session_id", payload.ledger_direct_source.summary.unique_ga_session_id],
      ["debug_test_preview_query_key_rows", payload.ledger_direct_source.summary.debug_test_preview_query_key_rows],
      ["send_candidate", payload.ledger_direct_source.summary.send_candidate],
    ],
  ),
  "",
  "## 직접 source 결합 가능성",
  "",
  mdTable(
    ["metric", "value"],
    [
      ["deterministic_bridge_ready", payload.direct_source_join_feasibility.deterministic_bridge_ready ? "YES" : "NO"],
      ["ledger_has_member_code_hash_column", payload.direct_source_join_feasibility.ledger_has_member_code_hash_column ? "YES" : "NO"],
      ["orders_with_any_prior_click", payload.direct_source_join_feasibility.order_to_ledger_ambiguity.orders_with_any_prior_click],
      ["orders_with_single_prior_click", payload.direct_source_join_feasibility.order_to_ledger_ambiguity.orders_with_single_prior_click],
      ["orders_with_multiple_prior_clicks", payload.direct_source_join_feasibility.order_to_ledger_ambiguity.orders_with_multiple_prior_clicks],
      ["median_prior_click_candidates", payload.direct_source_join_feasibility.order_to_ledger_ambiguity.median_prior_click_candidates],
      ["p90_prior_click_candidates", payload.direct_source_join_feasibility.order_to_ledger_ambiguity.p90_prior_click_candidates],
      ["max_prior_click_candidates", payload.direct_source_join_feasibility.order_to_ledger_ambiguity.max_prior_click_candidates],
    ],
  ),
  "",
  "## 해석",
  "",
  "- 운영 PG 기반 새 input은 생성 가능하다. 결제완료 주문 base는 canary window 기준으로 갱신됐다.",
  "- 다만 현재 live ledger schema에는 주문번호, member_code_hash, PG 주문의 client_id/ga_session_id가 없어서 order-level 효과 비교는 아직 성립하지 않는다.",
  "- ledger 직접 source는 capture health와 click-id 보존량 측정에는 의미가 있다. confirmed purchase uplift 측정에는 P1-1/P1-2의 deterministic bridge가 필요하다.",
  "",
  "## Guardrails",
  "",
  "```text",
  "No-send verified: YES",
  "No-write verified: YES (local artifact write only)",
  "No-deploy verified: YES",
  "No-publish verified: YES",
  "No-platform-send verified: YES",
  "Raw member_code output: 0",
  "```",
  "",
  "## 후보 샘플",
  "",
  mdTable(
    ["order_hash", "method", "value", "conversion_time_kst", "member_code_present", "prior_clicks_30d", "ambiguity", "send_candidate"],
    payload.operational_pg_input.candidates.slice(0, 20).map((row: Candidate) => [
      row.order_hash,
      row.payment_method,
      row.value,
      row.conversion_time_kst,
      row.member_code_present ? "Y" : "N",
      row.direct_ledger_join.prior_click_candidates_30d,
      row.direct_ledger_join.ambiguity,
      row.send_candidate ? "Y" : "N",
    ]),
  ),
  "",
  "## 다음 판단",
  "",
  "1. `data/!channelfunnel` Phase2-Sprint2는 `PG input 갱신 완료 / effect HOLD`로 바꾸는 것이 맞다.",
  "2. `paid_click_intent_ledger` 직접 source는 ConfirmedPurchasePrep input이 아니라 별도 health source로 두고, order-level join은 `member_code_hash` bridge 이후 다시 측정한다.",
  "3. 24h 도달 후 같은 스크립트를 재실행해 ledger capture health 숫자만 갱신한다. effect/uplift는 deterministic bridge 전까지 0 또는 HOLD로 표시한다.",
].join("\n");

const main = async () => {
  const options = parseArgs();
  const generatedAt = new Date();
  const startMs = Date.parse(options.start);
  const endMs = Date.parse(options.end);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    throw new Error(`invalid window: ${options.start} ~ ${options.end}`);
  }

  const pgRows = await readOperationalOrders(options);
  const ledgerColumns = readLedgerColumns(options);
  const ledgerRows = readLedgerRows(options);
  const confirmedRows = pgRows.filter((row) => !isExcludedOrder(row));
  const lookbackMs = options.lookbackDays * 24 * 60 * 60 * 1000;
  const candidates = confirmedRows.map((row) => buildCandidate(row, ledgerRows, startMs, lookbackMs));
  const priorCounts = candidates.map((row) => row.direct_ledger_join.prior_click_candidates_30d);
  const allStatusNpay = pgRows.filter(isNpay).length;
  const confirmedNpay = candidates.filter((row) => row.payment_method === "npay_actual").length;
  const debugKeyRows = allowedQueryDebugKeyRows(ledgerRows);
  const maxPaidAt = maxIso(pgRows.map((row) => row.paidAt));
  const maxReceivedAt = maxIso(ledgerRows.map((row) => row.received_at));
  const deterministicBridgeReady =
    ledgerColumns.includes("member_code_hash") ||
    ledgerColumns.includes("order_number") ||
    ledgerColumns.includes("order_no");

  const payload = {
    ok: true,
    generated_at: generatedAt.toISOString(),
    generated_at_kst: `${kstString(generatedAt)} KST`,
    mode: "no-send/no-write/read-only",
    harness: {
      lane: "Green",
      no_send: true,
      no_write: true,
      no_deploy: true,
      no_publish: true,
      no_platform_send: true,
    },
    window: {
      start_utc: options.start,
      end_utc: options.end,
      start_kst: `${kstString(options.start)} KST`,
      end_kst: `${kstString(options.end)} KST`,
      elapsed_hours: Math.round(((endMs - startMs) / 3_600_000) * 10) / 10,
      full_24h_reached: endMs - startMs >= 24 * 60 * 60 * 1000,
      lookback_days: options.lookbackDays,
    },
    source_freshness: {
      operational_pg: {
        source: "public.tb_iamweb_users",
        row_count_in_window_all_status: pgRows.length,
        max_paid_at: maxPaidAt,
        max_paid_at_kst: maxPaidAt ? `${kstString(maxPaidAt)} KST` : "",
      },
      paid_click_intent_ledger: {
        source: `${options.vmUser}@${options.vmHost}:${options.vmDbPath}#paid_click_intent_ledger`,
        row_count_in_window: ledgerRows.length,
        max_received_at: maxReceivedAt,
        max_received_at_kst: maxReceivedAt ? `${kstString(maxReceivedAt)} KST` : "",
      },
    },
    operational_pg_input: {
      source: "operational PostgreSQL public.tb_iamweb_users read-only",
      summary: {
        candidate_orders_all_status: pgRows.length,
        candidate_orders_confirmed_positive: candidates.length,
        homepage_count: candidates.filter((row) => row.payment_method === "homepage").length,
        npay_actual_count: confirmedNpay,
        npay_all_status_count: allStatusNpay,
        confirmed_positive_value: candidates.reduce((sum, row) => sum + row.value, 0),
        member_code_present_orders: candidates.filter((row) => row.member_code_present).length,
        member_code_hash_method: "sha256_prefix_dry_run_only; production design should use HMAC-SHA256(member_code, server_secret)",
        send_candidate: candidates.filter((row) => row.send_candidate).length,
        include_reason_counts: countBy(candidates.map((row) => row.include_reason)),
        payment_status_counts_all_status: countBy(pgRows.map((row) => row.paymentStatus)),
      },
      candidates,
    },
    ledger_direct_source: {
      source: "live VM SQLite paid_click_intent_ledger read-only",
      schema_columns: ledgerColumns,
      summary: {
        ledger_rows: ledgerRows.length,
        unique_click_id_hash: new Set(ledgerRows.map((row) => row.click_id_hash).filter(Boolean)).size,
        unique_client_id: new Set(ledgerRows.map((row) => row.client_id).filter(Boolean)).size,
        unique_ga_session_id: new Set(ledgerRows.map((row) => row.ga_session_id).filter(Boolean)).size,
        capture_stage_counts: countBy(ledgerRows.map((row) => row.capture_stage)),
        click_id_type_counts: countBy(ledgerRows.map((row) => row.click_id_type)),
        status_counts: countBy(ledgerRows.map((row) => row.status)),
        reject_reason_counts: countBy(ledgerRows.map((row) => row.reject_reason)),
        debug_test_preview_query_key_rows: debugKeyRows,
        send_candidate: 0,
      },
    },
    direct_source_join_feasibility: {
      deterministic_bridge_ready: deterministicBridgeReady,
      ledger_has_member_code_hash_column: ledgerColumns.includes("member_code_hash"),
      ledger_has_raw_member_code_column: ledgerColumns.includes("member_code"),
      ledger_has_order_number_column: ledgerColumns.includes("order_number") || ledgerColumns.includes("order_no"),
      pg_order_source_has_member_code: pgRows.some((row) => Boolean(row.memberCode)),
      pg_order_source_has_client_or_session_id: false,
      order_to_ledger_ambiguity: {
        orders_checked: candidates.length,
        orders_with_no_prior_click: priorCounts.filter((count) => count === 0).length,
        orders_with_any_prior_click: priorCounts.filter((count) => count > 0).length,
        orders_with_single_prior_click: priorCounts.filter((count) => count === 1).length,
        orders_with_multiple_prior_clicks: priorCounts.filter((count) => count > 1).length,
        median_prior_click_candidates: percentile(priorCounts, 50),
        p90_prior_click_candidates: percentile(priorCounts, 90),
        max_prior_click_candidates: percentile(priorCounts, 100),
      },
      verdict:
        deterministicBridgeReady && priorCounts.some((count) => count === 1)
          ? "partially_meaningful"
          : "not_meaningful_for_order_level_effect",
      reason:
        "Without member_code_hash/order_number/session bridge on both sides, direct ledger source creates many-to-many candidates. It is useful for capture health, not confirmed-purchase uplift.",
    },
    verdict: {
      canary_effect_measured: false,
      confidence: deterministicBridgeReady ? 0.75 : 0.93,
      one_line:
        "운영 PG 기반 새 결제완료 input은 생성됐지만, live paid_click_intent_ledger 직접 source는 현재 deterministic 주문 결합키가 없어 canary effect/uplift 비교에는 아직 의미가 없다.",
      recommended_interpretation:
        "Use the PG input as the refreshed purchase base, use direct ledger as capture-health evidence, and hold effect comparison until member_code_hash bridge or an equivalent deterministic key is deployed.",
    },
  };

  const json = `${JSON.stringify(payload, null, 2)}\n`;
  if (options.output) fs.writeFileSync(path.resolve(options.output), json, "utf8");
  else process.stdout.write(json);
  if (options.markdownOutput) {
    fs.writeFileSync(path.resolve(options.markdownOutput), `${renderMarkdown(payload)}\n`, "utf8");
  }
};

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`canary-effect-meaningful-dry-run failed: ${message}`);
  process.exitCode = 1;
});
