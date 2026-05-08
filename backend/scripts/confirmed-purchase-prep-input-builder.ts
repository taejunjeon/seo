#!/usr/bin/env tsx
/**
 * ConfirmedPurchasePrep input builder (P0-2, Path C 측정 가능 input 생성).
 *
 * 무엇:
 *   - 운영 imweb_orders (read-only) + paid_click_intent_ledger (read-only) 를 조회하여
 *     ConfirmedPurchasePrep 가 사용할 candidate input JSON 을 생성한다.
 *   - homepage payment-complete 와 NPay actual confirmed 를 분리한다.
 *   - paid_click_intent_ledger.member_code 가 있는 경우 Path C 매개 매칭을 시도한다.
 *
 * 왜:
 *   - 기존 5/5 fixture 17건 input 으로는 canary window (5/7 23:01~) 결제 측정이 불가능하다.
 *   - Path A vs Path C 효과 비교는 운영 결제완료 row 단위 매일 갱신이 필요하다.
 *
 * 어떻게:
 *   - 운영 sqlite imweb_orders 를 read-only 로 SELECT 한다 (PG 옵션은 별 sprint).
 *   - paid_click_intent_ledger 에 member_code 컬럼이 존재하지 않으면 missing_member_code_column 을 기록하고 lookup skip.
 *   - GA4 guard 는 --ga4-guard-from 옵션의 기존 dry-run JSON 에서만 가져온다 (BigQuery 호출 0건).
 *   - send_candidate=false / no_send / no_write / no_deploy / no_publish / no_platform_send 항상 보장.
 *   - raw member_code 는 stdout/JSON 에 노출하지 않고 sha256 hash prefix 만 저장한다.
 *
 * 금지:
 *   - 운영 deploy / 운영 schema migration / GTM·Imweb wrapper 변경
 *   - GA4 / Meta / Google Ads / TikTok / Naver 전송
 *   - paid_click_intent_ledger.member_code 운영 저장 (그건 P1 Yellow 영역)
 *
 * 사용:
 *   tsx scripts/confirmed-purchase-prep-input-builder.ts \
 *     --start=2026-05-07 --end=2026-05-08 \
 *     --output=../data/confirmed-purchase-prep-input-canary-20260508.json \
 *     --markdown-output=../gdn/confirmed-purchase-prep-input-canary-20260508.md
 *
 *   # fixture 자체 검증
 *   tsx scripts/confirmed-purchase-prep-input-builder.ts --fixture
 */

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";

type CliOptions = {
  start: string;
  end: string;
  site: "biocom";
  sqlitePath: string;
  output?: string;
  markdownOutput?: string;
  ga4GuardFrom?: string;
  lookbackDays: number;
  fixture: boolean;
};

type ImwebOrderRow = {
  order_no: string;
  channel_order_no: string;
  member_code: string;
  pay_type: string;
  pg_type: string;
  payment_amount: number;
  total_price: number;
  complete_time: string;
  order_time: string;
  imweb_status: string;
};

type PaidClickIntentLedgerRow = {
  intent_id: string;
  member_code: string;
  click_id_type: string;
  click_id_hash: string;
  click_id_value: string;
  received_at: string;
  captured_at: string;
  capture_stage: string;
};

type Ga4GuardStatus = "present" | "robust_absent" | "unknown";

type PathCStatus =
  | "matched"
  | "missing_member_code"
  | "missing_paid_click_intent"
  | "outside_window"
  | "after_paid_at"
  | "ambiguous"
  | "skipped_no_member_code_column";

type Candidate = {
  site: "biocom";
  order_number: string;
  channel_order_no: string;
  payment_method: "homepage" | "npay_actual";
  include_reason: "homepage_payment_complete" | "npay_actual_confirmed_order";
  conversion_time: string;
  value: number;
  currency: "KRW";
  member_code_present: boolean;
  member_code_hash: string;
  paid_click_intent_match: {
    matched: boolean;
    click_id_type: string;
    click_id_hash: string;
    received_at: string;
    capture_stage: string;
    candidate_count: number;
    ambiguity: "single" | "multiple" | "none";
    after_paid_at: boolean;
    outside_window: boolean;
  };
  path_a_status: "matched" | "missing_vm_evidence" | "skipped";
  path_c_status: PathCStatus;
  ga4_guard: Ga4GuardStatus;
  send_candidate: false;
  block_reasons: string[];
};

const argValue = (name: string) =>
  process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);

const parseDate = (label: string, value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`${label} must be YYYY-MM-DD: ${value}`);
  return value;
};

const parseArgs = (): CliOptions => ({
  start: parseDate("start", argValue("start") ?? "2026-05-07"),
  end: parseDate("end", argValue("end") ?? "2026-05-08"),
  site: "biocom",
  sqlitePath: path.resolve(
    argValue("sqlite-path") ?? path.join(__dirname, "..", "data", "crm.sqlite3"),
  ),
  output: argValue("output"),
  markdownOutput: argValue("markdown-output") ?? argValue("markdownOutput"),
  ga4GuardFrom: argValue("ga4-guard-from") ?? argValue("ga4GuardFrom"),
  lookbackDays: Math.max(1, Number(argValue("lookback-days") ?? "30")),
  fixture: process.argv.includes("--fixture"),
});

const sha256Prefix = (input: string): string => {
  if (!input) return "";
  return createHash("sha256").update(input).digest("hex").slice(0, 32);
};

const isoFromDbTime = (raw: string): string => {
  if (!raw) return "";
  const trimmed = raw.trim();
  if (!trimmed) return "";
  // imweb_orders.complete_time 은 KST naive 'YYYY-MM-DD HH:MM:SS' 또는 ISO.
  if (/Z|[+-]\d{2}:\d{2}$/.test(trimmed)) return new Date(trimmed).toISOString();
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}/.test(trimmed)) {
    return new Date(`${trimmed.replace(" ", "T")}+09:00`).toISOString();
  }
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
};

const kstStartOfDayIso = (yyyymmdd: string): string =>
  new Date(`${yyyymmdd}T00:00:00+09:00`).toISOString();

const nextDayIso = (yyyymmdd: string): string => {
  const d = new Date(`${yyyymmdd}T00:00:00+09:00`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString();
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

const classifyPaymentMethod = (row: ImwebOrderRow): "homepage" | "npay_actual" => {
  const payType = (row.pay_type || "").toLowerCase();
  if (payType === "npay") return "npay_actual";
  return "homepage";
};

// imweb_orders.imweb_status 의 결제완료 lifecycle 정의.
// IMWEB_STATUS_VALUES (backend/src/routes/crmLocal.ts) 의 영문 enum + NPay 한국어 status 모두 포함.
// 제외: PAY_WAIT (결제 대기), CANCEL/RETURN/EXCHANGE (취소·반품·교환),
//       PAYMENT_OVERDUE/CANCELLED_BEFORE_DEPOSIT/REFUND_COMPLETE/PARTIAL_REFUND_COMPLETE
const COMPLETED_STATUS_SET = new Set([
  "PAY_COMPLETE",
  "PAYMENT_COMPLETE",
  "STANDBY",
  "DELIVERING",
  "COMPLETE",
  "PURCHASE_CONFIRMATION",
  "ORDER_PAID",
  "ORDER_COMPLETE",
  "DELIVERED",
  // 한국어 NPay status
  "거래개시",
  "거래종료",
  "배송준비",
  "배송중",
  "배송완료",
  "구매확정",
]);

const isCompletedStatus = (status: string): boolean => {
  const trimmed = (status || "").trim();
  if (!trimmed) return false;
  return COMPLETED_STATUS_SET.has(trimmed) || COMPLETED_STATUS_SET.has(trimmed.toUpperCase());
};

const tableHasColumn = (
  db: Database.Database,
  table: string,
  column: string,
): boolean => {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return cols.some((c) => c.name === column);
};

const tableExists = (db: Database.Database, table: string): boolean => {
  const row = db
    .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`)
    .get(table) as { name?: string } | undefined;
  return Boolean(row?.name);
};

const readImwebOrders = (
  db: Database.Database,
  startIso: string,
  endIso: string,
  site: string,
): ImwebOrderRow[] => {
  const sql = `SELECT
      order_no,
      COALESCE(channel_order_no, '') AS channel_order_no,
      COALESCE(member_code, '') AS member_code,
      COALESCE(pay_type, '') AS pay_type,
      COALESCE(pg_type, '') AS pg_type,
      COALESCE(payment_amount, 0) AS payment_amount,
      COALESCE(total_price, 0) AS total_price,
      COALESCE(complete_time, '') AS complete_time,
      COALESCE(order_time, '') AS order_time,
      COALESCE(imweb_status, '') AS imweb_status
    FROM imweb_orders
    WHERE site = ?
      AND order_time >= ?
      AND order_time < ?
    ORDER BY order_time ASC`;
  // imweb_orders.order_time 은 better-sqlite3 sync 기준 ISO 8601 (UTC 'Z' suffix) 로 저장됨.
  // CLI 의 --start/--end 는 KST naive YYYY-MM-DD 라 KST 자정 → UTC ISO 변환 후 비교.
  return db.prepare(sql).all(site, startIso, endIso) as ImwebOrderRow[];
};

const readPaidClickIntentRowsByMember = (
  db: Database.Database,
  site: string,
  memberCode: string,
  sinceIso: string,
): PaidClickIntentLedgerRow[] => {
  const sql = `SELECT
      intent_id,
      COALESCE(member_code, '') AS member_code,
      COALESCE(click_id_type, '') AS click_id_type,
      COALESCE(click_id_hash, '') AS click_id_hash,
      COALESCE(click_id_value, '') AS click_id_value,
      received_at,
      captured_at,
      COALESCE(capture_stage, '') AS capture_stage
    FROM paid_click_intent_ledger
    WHERE site = ? AND member_code = ? AND received_at >= ?
    ORDER BY received_at ASC
    LIMIT 50`;
  return db.prepare(sql).all(site, memberCode, sinceIso) as PaidClickIntentLedgerRow[];
};

const loadGa4GuardMap = (filePath?: string): Map<string, Ga4GuardStatus> => {
  const map = new Map<string, Ga4GuardStatus>();
  if (!filePath) return map;
  try {
    const json = JSON.parse(fs.readFileSync(filePath, "utf8")) as {
      candidates?: Array<{
        order_number?: string;
        channel_order_no?: string;
        ga4_guard?: { status?: Ga4GuardStatus };
      }>;
    };
    for (const c of json.candidates ?? []) {
      const status = (c.ga4_guard?.status ?? "unknown") as Ga4GuardStatus;
      if (c.order_number) map.set(c.order_number, status);
      if (c.channel_order_no) map.set(c.channel_order_no, status);
    }
  } catch {
    // ignore — guard 파일 없으면 unknown 으로 fall back
  }
  return map;
};

const buildCandidate = (
  order: ImwebOrderRow,
  windowStartIso: string,
  windowEndIso: string,
  pathCRows: PaidClickIntentLedgerRow[] | null,
  pathCColumnPresent: boolean,
  ga4Map: Map<string, Ga4GuardStatus>,
): Candidate => {
  const paymentMethod = classifyPaymentMethod(order);
  const conversionTime = isoFromDbTime(order.complete_time || order.order_time);
  const value = Math.round(Number(order.payment_amount || order.total_price || 0));
  const memberCodePresent = Boolean(order.member_code);
  const memberCodeHash = sha256Prefix(order.member_code);
  const ga4Status: Ga4GuardStatus =
    ga4Map.get(order.order_no) ?? ga4Map.get(order.channel_order_no) ?? "unknown";

  let pathCStatus: PathCStatus;
  let matchedRow: PaidClickIntentLedgerRow | null = null;
  let candidateCount = 0;
  let ambiguity: "single" | "multiple" | "none" = "none";
  let afterPaidAt = false;
  let outsideWindow = false;

  if (!pathCColumnPresent) {
    pathCStatus = "skipped_no_member_code_column";
  } else if (!memberCodePresent) {
    pathCStatus = "missing_member_code";
  } else {
    const rows = pathCRows ?? [];
    const conversionMs = conversionTime ? Date.parse(conversionTime) : Number.NaN;
    const windowStartMs = Date.parse(windowStartIso);
    const eligibleRows = rows.filter((r) => {
      const recvMs = Date.parse(r.received_at);
      if (!Number.isFinite(recvMs)) return false;
      // paid_at 이후 click 제외 (first-touch attribution).
      if (Number.isFinite(conversionMs) && recvMs > conversionMs) return false;
      // window 밖 (lookback 이전) 도 제외.
      if (recvMs < windowStartMs) return false;
      return true;
    });
    candidateCount = eligibleRows.length;
    if (candidateCount === 0) {
      // 전부 제외된 사유 분류.
      const hasAfter = rows.some((r) => {
        const recvMs = Date.parse(r.received_at);
        return Number.isFinite(recvMs) && Number.isFinite(conversionMs) && recvMs > conversionMs;
      });
      const hasOutside = rows.some((r) => {
        const recvMs = Date.parse(r.received_at);
        return Number.isFinite(recvMs) && recvMs < windowStartMs;
      });
      afterPaidAt = hasAfter;
      outsideWindow = hasOutside;
      if (rows.length === 0) {
        pathCStatus = "missing_paid_click_intent";
      } else if (afterPaidAt && !hasOutside) {
        pathCStatus = "after_paid_at";
      } else if (outsideWindow && !hasAfter) {
        pathCStatus = "outside_window";
      } else {
        pathCStatus = "missing_paid_click_intent";
      }
    } else if (candidateCount === 1) {
      ambiguity = "single";
      matchedRow = eligibleRows[0];
      pathCStatus = "matched";
    } else {
      ambiguity = "multiple";
      // first-touch 정책: 가장 오래된 row 선택, 단 ambiguity flag 유지.
      matchedRow = eligibleRows[0];
      pathCStatus = "ambiguous";
    }
  }

  const blockReasons = ["read_only_phase", "approval_required", "google_ads_conversion_action_not_created", "conversion_upload_not_approved"];
  if (!conversionTime) blockReasons.push("missing_conversion_time");
  if (value <= 0) blockReasons.push("invalid_value");
  if (!isCompletedStatus(order.imweb_status)) blockReasons.push("not_completed_status");
  if (ga4Status === "present") blockReasons.push("already_in_ga4");
  if (ga4Status === "unknown") blockReasons.push("already_in_ga4_unknown");
  // path_a 평가는 본 builder 범위 외 (vm_evidence 입력 없음). missing_vm_evidence 만 기록.
  const pathAStatus: Candidate["path_a_status"] = "missing_vm_evidence";
  if (pathAStatus === "missing_vm_evidence" && pathCStatus !== "matched") {
    blockReasons.push("missing_google_click_id");
  }
  if (pathCStatus === "missing_member_code") blockReasons.push("missing_member_code");
  if (pathCStatus === "missing_paid_click_intent") blockReasons.push("missing_paid_click_intent");
  if (pathCStatus === "outside_window") blockReasons.push("paid_click_intent_outside_window");
  if (pathCStatus === "after_paid_at") blockReasons.push("paid_click_intent_after_paid_at");
  if (pathCStatus === "ambiguous") blockReasons.push("paid_click_intent_ambiguous");
  if (pathCStatus === "skipped_no_member_code_column") blockReasons.push("paid_click_intent_member_code_column_absent");

  return {
    site: "biocom",
    order_number: order.order_no,
    channel_order_no: order.channel_order_no,
    payment_method: paymentMethod,
    include_reason: paymentMethod === "npay_actual" ? "npay_actual_confirmed_order" : "homepage_payment_complete",
    conversion_time: conversionTime,
    value,
    currency: "KRW",
    member_code_present: memberCodePresent,
    member_code_hash: memberCodeHash,
    paid_click_intent_match: {
      matched: pathCStatus === "matched" || pathCStatus === "ambiguous",
      click_id_type: matchedRow?.click_id_type ?? "",
      click_id_hash: matchedRow?.click_id_hash ?? "",
      received_at: matchedRow?.received_at ?? "",
      capture_stage: matchedRow?.capture_stage ?? "",
      candidate_count: candidateCount,
      ambiguity,
      after_paid_at: afterPaidAt,
      outside_window: outsideWindow,
    },
    path_a_status: pathAStatus,
    path_c_status: pathCStatus,
    ga4_guard: ga4Status,
    send_candidate: false,
    block_reasons: blockReasons,
  };
};

type Summary = {
  candidate_count: number;
  homepage_count: number;
  npay_actual_count: number;
  path_a_match_count: number;
  path_c_match_count: number;
  path_c_uplift: number;
  missing_member_code: number;
  missing_paid_click_intent: number;
  outside_window: number;
  after_paid_at: number;
  ambiguous: number;
  already_in_ga4: number;
  send_candidate: 0;
  with_member_code: number;
  member_code_column_absent: number;
};

const buildSummary = (rows: Candidate[]): Summary => {
  const pathCMatched = rows.filter((r) => r.path_c_status === "matched" || r.path_c_status === "ambiguous").length;
  const pathAMatched = rows.filter((r) => r.path_a_status === "matched").length;
  return {
    candidate_count: rows.length,
    homepage_count: rows.filter((r) => r.payment_method === "homepage").length,
    npay_actual_count: rows.filter((r) => r.payment_method === "npay_actual").length,
    path_a_match_count: pathAMatched,
    path_c_match_count: pathCMatched,
    path_c_uplift: pathCMatched - pathAMatched,
    missing_member_code: rows.filter((r) => r.path_c_status === "missing_member_code").length,
    missing_paid_click_intent: rows.filter((r) => r.path_c_status === "missing_paid_click_intent").length,
    outside_window: rows.filter((r) => r.path_c_status === "outside_window").length,
    after_paid_at: rows.filter((r) => r.path_c_status === "after_paid_at").length,
    ambiguous: rows.filter((r) => r.path_c_status === "ambiguous").length,
    already_in_ga4: rows.filter((r) => r.ga4_guard === "present").length,
    send_candidate: 0,
    with_member_code: rows.filter((r) => r.member_code_present).length,
    member_code_column_absent: rows.filter((r) => r.path_c_status === "skipped_no_member_code_column").length,
  };
};

const escapeCell = (v: unknown) => String(v ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");

const mdTable = (headers: string[], rows: unknown[][]) => [
  `| ${headers.map(escapeCell).join(" | ")} |`,
  `| ${headers.map(() => "---").join(" | ")} |`,
  ...rows.map((row) => `| ${row.map(escapeCell).join(" | ")} |`),
].join("\n");

const renderMarkdown = (payload: Record<string, any>): string => {
  const s = payload.summary as Summary;
  return [
    "# ConfirmedPurchasePrep input — canary window builder",
    "",
    `작성 시각: ${payload.generated_at_kst}`,
    "",
    "## 5줄 결론",
    "",
    `1. candidate=${s.candidate_count} (homepage=${s.homepage_count} / npay_actual=${s.npay_actual_count}) — read-only 운영 sqlite imweb_orders 매개.`,
    `2. Path A 매칭=${s.path_a_match_count} (vm_evidence 미사용, 본 builder 범위 외).`,
    `3. Path C 매칭=${s.path_c_match_count} (member_code 매개), uplift=${s.path_c_uplift}.`,
    `4. 차단 분포: missing_member_code=${s.missing_member_code} / missing_paid_click_intent=${s.missing_paid_click_intent} / outside_window=${s.outside_window} / after_paid_at=${s.after_paid_at} / ambiguous=${s.ambiguous} / already_in_ga4=${s.already_in_ga4}.`,
    `5. send_candidate=${s.send_candidate}. 외부 플랫폼 전송 / 운영 DB write / GTM·Imweb wrapper 변경 모두 0건.`,
    "",
    "## 요약",
    "",
    mdTable(
      ["metric", "value"],
      [
        ["candidate_count", s.candidate_count],
        ["homepage_count", s.homepage_count],
        ["npay_actual_count", s.npay_actual_count],
        ["with_member_code", s.with_member_code],
        ["path_a_match_count", s.path_a_match_count],
        ["path_c_match_count", s.path_c_match_count],
        ["path_c_uplift", s.path_c_uplift],
        ["missing_member_code", s.missing_member_code],
        ["missing_paid_click_intent", s.missing_paid_click_intent],
        ["outside_window", s.outside_window],
        ["after_paid_at", s.after_paid_at],
        ["ambiguous", s.ambiguous],
        ["already_in_ga4", s.already_in_ga4],
        ["member_code_column_absent", s.member_code_column_absent],
        ["send_candidate", s.send_candidate],
      ],
    ),
    "",
    "## Guardrails",
    "",
    "```text",
    "No-send verified: YES",
    "No-write verified: YES",
    "No-deploy verified: YES",
    "No-publish verified: YES",
    "No-platform-send verified: YES",
    "Operational schema migration: NOT TRIGGERED (read-only)",
    "GTM/Imweb wrapper change: NONE",
    "Raw member_code in output: NONE (sha256 prefix only)",
    "```",
    "",
    "## 다음 판단",
    "",
    "- Path C 효과를 측정하려면 paid_click_intent_ledger.member_code 컬럼이 운영 sqlite 에 존재해야 한다 (P1 Yellow 영역).",
    "- 본 builder 출력은 ConfirmedPurchasePrep candidate-prep script 의 input 으로 사용된다.",
    "- send_candidate=0 은 read-only 단계이므로 Google Ads / Meta / GA4 전송은 항상 막힌다.",
  ].join("\n");
};

type BuildResult = {
  ok: true;
  generated_at: string;
  generated_at_kst: string;
  mode: "no-send/no-write/read-only";
  harness: { lane: "Green"; no_send: true; no_write: true; no_deploy: true; no_publish: true; no_platform_send: true };
  source: {
    operational_sqlite: string;
    paid_click_intent_ledger_member_code_column_present: boolean;
    paid_click_intent_ledger_table_present: boolean;
    ga4_guard_from?: string;
  };
  window: { start: string; end: string; lookback_days: number; timezone_note: string };
  summary: Summary;
  candidates: Candidate[];
};

const runBuilder = (options: CliOptions): BuildResult => {
  const generatedAtIso = new Date().toISOString();
  const startIsoKst = kstStartOfDayIso(options.start);
  const endIsoKst = nextDayIso(options.end);
  const lookbackStartIsoKst = (() => {
    const start = new Date(`${options.start}T00:00:00+09:00`);
    start.setUTCDate(start.getUTCDate() - options.lookbackDays);
    return start.toISOString();
  })();

  const db = new Database(options.sqlitePath, { readonly: true, fileMustExist: true });
  try {
    const pciTablePresent = tableExists(db, "paid_click_intent_ledger");
    const pciMemberColumnPresent =
      pciTablePresent && tableHasColumn(db, "paid_click_intent_ledger", "member_code");
    const orders = readImwebOrders(db, startIsoKst, endIsoKst, options.site);
    const ga4Map = loadGa4GuardMap(options.ga4GuardFrom);
    const candidates = orders
      .filter((o) => isCompletedStatus(o.imweb_status))
      .map((order) => {
        let pathCRows: PaidClickIntentLedgerRow[] | null = null;
        if (pciMemberColumnPresent && order.member_code) {
          pathCRows = readPaidClickIntentRowsByMember(
            db,
            options.site,
            order.member_code,
            lookbackStartIsoKst,
          );
        }
        return buildCandidate(order, lookbackStartIsoKst, endIsoKst, pathCRows, pciMemberColumnPresent, ga4Map);
      });
    const summary = buildSummary(candidates);
    return {
      ok: true,
      generated_at: generatedAtIso,
      generated_at_kst: kstNow(),
      mode: "no-send/no-write/read-only",
      harness: {
        lane: "Green",
        no_send: true,
        no_write: true,
        no_deploy: true,
        no_publish: true,
        no_platform_send: true,
      },
      source: {
        operational_sqlite: options.sqlitePath,
        paid_click_intent_ledger_member_code_column_present: pciMemberColumnPresent,
        paid_click_intent_ledger_table_present: pciTablePresent,
        ga4_guard_from: options.ga4GuardFrom,
      },
      window: {
        start: options.start,
        end: options.end,
        lookback_days: options.lookbackDays,
        timezone_note:
          "CLI --start/--end 는 KST 자정 기준이고 imweb_orders.order_time 은 ISO 8601 UTC ('Z' suffix) 로 저장되어 있어 KST→UTC 변환 후 string 비교한다.",
      },
      summary,
      candidates,
    };
  } finally {
    db.close();
  }
};

const writeOutputs = (payload: BuildResult, options: CliOptions) => {
  const json = `${JSON.stringify(payload, null, 2)}\n`;
  if (options.output) {
    fs.mkdirSync(path.dirname(path.resolve(options.output)), { recursive: true });
    fs.writeFileSync(path.resolve(options.output), json, "utf8");
  } else {
    process.stdout.write(json);
  }
  if (options.markdownOutput) {
    fs.mkdirSync(path.dirname(path.resolve(options.markdownOutput)), { recursive: true });
    fs.writeFileSync(path.resolve(options.markdownOutput), `${renderMarkdown(payload)}\n`, "utf8");
  }
};

// ---------------------------------------------------------------------------
// Fixture self-test
// ---------------------------------------------------------------------------

const setupFixtureDb = (): Database.Database => {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE imweb_orders (
      order_key TEXT, site TEXT, order_no TEXT, order_code TEXT,
      channel_order_no TEXT, order_type TEXT, sale_channel_idx INTEGER,
      device_type TEXT, order_time_unix INTEGER, order_time TEXT,
      complete_time_unix INTEGER, complete_time TEXT, member_code TEXT,
      orderer_name TEXT, orderer_call TEXT, pay_type TEXT, pg_type TEXT,
      price_currency TEXT, total_price INTEGER, payment_amount INTEGER,
      coupon_amount INTEGER, delivery_price INTEGER, use_issue_coupon_codes TEXT,
      raw_json TEXT, synced_at TEXT, imweb_status TEXT, imweb_status_synced_at TEXT
    );
    CREATE TABLE paid_click_intent_ledger (
      intent_id TEXT, site TEXT, captured_at TEXT, received_at TEXT,
      platform_hint TEXT, capture_stage TEXT, click_id_type TEXT,
      click_id_value TEXT, click_id_hash TEXT, member_code TEXT,
      utm_source TEXT, utm_medium TEXT, utm_campaign TEXT, utm_term TEXT,
      utm_content TEXT, landing_path TEXT, allowed_query_json TEXT,
      referrer_host TEXT, client_id TEXT, ga_session_id TEXT,
      local_session_id TEXT, user_agent_hash TEXT, ip_hash TEXT,
      dedupe_key TEXT, duplicate_count INTEGER, status TEXT,
      reject_reason TEXT, expires_at TEXT, created_at TEXT, updated_at TEXT
    );
  `);
  // Fixture orders (3 종):
  //   F1 — homepage, member_code 보유, paid_click_intent 1건 매칭 (positive)
  //   F2 — homepage, member_code 보유, paid_click_intent 2건 (multiple ambiguity)
  //   F3 — npay_actual, member_code 보유, paid_click_intent 1건이 paid_at 이후 (제외 필요)
  const insertOrder = db.prepare(`INSERT INTO imweb_orders (
    site, order_no, channel_order_no, member_code, pay_type, pg_type,
    payment_amount, total_price, complete_time, order_time, imweb_status
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  // ISO 8601 UTC ('Z' suffix) — better-sqlite3 sync 가 imweb_orders 에 저장하는 실제 형식과 동일.
  // KST 5/7 23:30 = UTC 5/7 14:30 / KST 5/8 02:00 = UTC 5/7 17:00 / KST 5/8 04:00 = UTC 5/7 19:00
  insertOrder.run("biocom", "F1", "F1-CH", "m20260507aaa", "card", "tosspayments", 35000, 35000, "2026-05-07T14:30:00.000Z", "2026-05-07T14:30:00.000Z", "order_paid");
  insertOrder.run("biocom", "F2", "F2-CH", "m20260508bbb", "card", "tosspayments", 50000, 50000, "2026-05-07T17:00:00.000Z", "2026-05-07T17:00:00.000Z", "order_paid");
  insertOrder.run("biocom", "F3", "F3-CH", "m20260508ccc", "npay", "npay", 28000, 28000, "2026-05-07T19:00:00.000Z", "2026-05-07T19:00:00.000Z", "order_paid");

  const insertPci = db.prepare(`INSERT INTO paid_click_intent_ledger (
    intent_id, site, captured_at, received_at, platform_hint, capture_stage,
    click_id_type, click_id_value, click_id_hash, member_code,
    dedupe_key, duplicate_count, status, expires_at, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'received', ?, ?, ?)`);
  // F1 매칭: 결제 1시간 전 click
  insertPci.run("F1-INTENT", "biocom",
    "2026-05-07T13:00:00.000Z", "2026-05-07T13:00:01.000Z",
    "google_ads", "landing", "gclid", "AW.F1", "hash_f1", "m20260507aaa",
    "dedupe_f1", "2026-08-05T13:00:00.000Z", "2026-05-07T13:00:01.000Z", "2026-05-07T13:00:01.000Z");
  // F2 multiple: 결제 2시간 전 + 30분 전 두 click
  insertPci.run("F2-INTENT-A", "biocom",
    "2026-05-07T14:00:00.000Z", "2026-05-07T14:00:01.000Z",
    "google_ads", "landing", "gclid", "AW.F2A", "hash_f2a", "m20260508bbb",
    "dedupe_f2a", "2026-08-05T14:00:00.000Z", "2026-05-07T14:00:01.000Z", "2026-05-07T14:00:01.000Z");
  insertPci.run("F2-INTENT-B", "biocom",
    "2026-05-07T16:30:00.000Z", "2026-05-07T16:30:01.000Z",
    "google_ads", "checkout_start", "gclid", "AW.F2B", "hash_f2b", "m20260508bbb",
    "dedupe_f2b", "2026-08-05T16:30:00.000Z", "2026-05-07T16:30:01.000Z", "2026-05-07T16:30:01.000Z");
  // F3 after_paid_at: paid_at = 2026-05-08 04:00 KST = 2026-05-07T19:00 UTC. click 은 그 1h 후 (제외 필요)
  insertPci.run("F3-INTENT", "biocom",
    "2026-05-07T20:00:00.000Z", "2026-05-07T20:00:01.000Z",
    "google_ads", "landing", "gclid", "AW.F3", "hash_f3", "m20260508ccc",
    "dedupe_f3", "2026-08-05T20:00:00.000Z", "2026-05-07T20:00:01.000Z", "2026-05-07T20:00:01.000Z");
  return db;
};

const runFixtureSelfTest = (): { ok: boolean; failures: string[]; result: BuildResult } => {
  const db = setupFixtureDb();
  const startIsoKst = kstStartOfDayIso("2026-05-07");
  const endIsoKst = nextDayIso("2026-05-08");
  const lookbackStartIso = (() => {
    const start = new Date(`2026-05-07T00:00:00+09:00`);
    start.setUTCDate(start.getUTCDate() - 30);
    return start.toISOString();
  })();
  const orders = readImwebOrders(db, startIsoKst, endIsoKst, "biocom");
  const pciMemberColumnPresent = tableHasColumn(db, "paid_click_intent_ledger", "member_code");
  const candidates = orders.map((order) => {
    const rows = pciMemberColumnPresent && order.member_code
      ? readPaidClickIntentRowsByMember(db, "biocom", order.member_code, lookbackStartIso)
      : null;
    return buildCandidate(order, lookbackStartIso, endIsoKst, rows, pciMemberColumnPresent, new Map());
  });
  const summary = buildSummary(candidates);
  db.close();

  const failures: string[] = [];
  const expect = (cond: boolean, msg: string) => {
    if (!cond) failures.push(msg);
  };

  // 검증 expectations
  expect(summary.candidate_count === 3, `candidate_count expected 3, got ${summary.candidate_count}`);
  expect(summary.homepage_count === 2, `homepage_count expected 2, got ${summary.homepage_count}`);
  expect(summary.npay_actual_count === 1, `npay_actual_count expected 1, got ${summary.npay_actual_count}`);
  expect(summary.with_member_code === 3, `with_member_code expected 3, got ${summary.with_member_code}`);

  const f1 = candidates.find((c) => c.order_number === "F1");
  expect(Boolean(f1) && f1!.path_c_status === "matched", "F1 path_c_status expected 'matched'");
  expect(Boolean(f1) && f1!.paid_click_intent_match.candidate_count === 1, "F1 candidate_count expected 1");
  expect(Boolean(f1) && f1!.paid_click_intent_match.ambiguity === "single", "F1 ambiguity expected 'single'");

  const f2 = candidates.find((c) => c.order_number === "F2");
  expect(Boolean(f2) && f2!.path_c_status === "ambiguous", "F2 path_c_status expected 'ambiguous'");
  expect(Boolean(f2) && f2!.paid_click_intent_match.candidate_count === 2, "F2 candidate_count expected 2");
  expect(Boolean(f2) && f2!.paid_click_intent_match.ambiguity === "multiple", "F2 ambiguity expected 'multiple'");

  const f3 = candidates.find((c) => c.order_number === "F3");
  expect(Boolean(f3) && f3!.path_c_status === "after_paid_at", "F3 path_c_status expected 'after_paid_at'");
  expect(Boolean(f3) && f3!.paid_click_intent_match.after_paid_at === true, "F3 after_paid_at flag expected true");
  expect(Boolean(f3) && f3!.payment_method === "npay_actual", "F3 payment_method expected 'npay_actual'");
  expect(Boolean(f3) && f3!.include_reason === "npay_actual_confirmed_order", "F3 include_reason expected 'npay_actual_confirmed_order'");

  // raw member_code 노출 없음 체크 (member_code_hash 만 존재).
  for (const c of candidates) {
    expect(!("member_code" in c), `${c.order_number} candidate must not contain raw member_code`);
    expect(c.member_code_hash.length === 32, `${c.order_number} member_code_hash expected length 32`);
  }
  // send_candidate 항상 false.
  for (const c of candidates) {
    expect(c.send_candidate === false, `${c.order_number} send_candidate must be false`);
  }
  // path_c_match_count = 1 (F1 matched), F2 ambiguous 도 매칭 카운트에 포함.
  expect(summary.path_c_match_count === 2, `path_c_match_count expected 2 (F1+F2), got ${summary.path_c_match_count}`);
  expect(summary.path_a_match_count === 0, `path_a_match_count expected 0, got ${summary.path_a_match_count}`);
  expect(summary.path_c_uplift === 2, `path_c_uplift expected 2, got ${summary.path_c_uplift}`);
  expect(summary.after_paid_at === 1, `after_paid_at expected 1, got ${summary.after_paid_at}`);
  expect(summary.ambiguous === 1, `ambiguous expected 1, got ${summary.ambiguous}`);
  expect(summary.missing_paid_click_intent === 0, `missing_paid_click_intent expected 0, got ${summary.missing_paid_click_intent}`);

  return {
    ok: failures.length === 0,
    failures,
    result: {
      ok: true,
      generated_at: new Date().toISOString(),
      generated_at_kst: kstNow(),
      mode: "no-send/no-write/read-only",
      harness: { lane: "Green", no_send: true, no_write: true, no_deploy: true, no_publish: true, no_platform_send: true },
      source: {
        operational_sqlite: ":memory: (fixture)",
        paid_click_intent_ledger_member_code_column_present: true,
        paid_click_intent_ledger_table_present: true,
      },
      window: { start: "2026-05-07", end: "2026-05-08", lookback_days: 30, timezone_note: "fixture KST naive" },
      summary,
      candidates,
    },
  };
};

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

const main = () => {
  const options = parseArgs();
  if (options.fixture) {
    const { ok, failures, result } = runFixtureSelfTest();
    process.stdout.write(`${JSON.stringify({ summary: result.summary, failures }, null, 2)}\n`);
    if (!ok) {
      process.stderr.write(`fixture self-test FAILED:\n${failures.map((f) => ` - ${f}`).join("\n")}\n`);
      process.exitCode = 1;
    }
    return;
  }
  const result = runBuilder(options);
  writeOutputs(result, options);
  // raw member_code 가 stdout 에 새지 않도록 summary 만 print.
  process.stdout.write(`${JSON.stringify(result.summary, null, 2)}\n`);
};

main();
