/**
 * coffee NPay intent ledger 모니터링 리포트 (read-only).
 *
 * 상위 sprint: data/!coffeedata.md 항목 19, A-4 publish 결정 문서:
 *   data/coffee-a4-publish-decision-and-dispatcher-v21-20260502.md
 * 출력 스키마 정의:
 *   data/coffee-a4-monitoring-report-template-20260502.md
 *
 * 가드:
 *   - GET /api/coffee/intent/stats (public)
 *   - GET /api/attribution/coffee-npay-intent-join-report (admin token 필요)
 *   - 외부 send 0, write 0, GTM 변경 0
 *
 * 사용:
 *   cd backend
 *   npx tsx scripts/coffee-npay-intent-monitoring-report.ts \
 *     --endpoint https://att.ainativeos.net \
 *     --publish-ts "2026-05-02 15:00" \
 *     [--admin-token <token>] \
 *     [--output /tmp/coffee-monitoring-YYYYMMDD-HHMM.yaml]
 *
 * --admin-token 미지정 시 환경변수 COFFEE_NPAY_INTENT_SMOKE_ADMIN_TOKEN 사용. 둘 다 없으면
 * join-report skip 하고 stats 만 사용.
 */

interface Args {
  endpoint: string;
  publishTs: string | null;
  adminToken: string | null;
  output: string | null;
}

interface StatsResponse {
  ok: boolean;
  schema_version: number;
  enforce_flag_active: boolean;
  smoke_window_active: boolean;
  total_rows: number;
  rows_with_imweb_order_code: number;
  rows_with_ga4_synthetic_transaction_id: number;
  reject_counters: Record<string, number>;
  smoke_window_summary?: { id: number; inserted_count: number; max_inserts: number; remaining: number; expires_at: string };
}

interface JoinReportResponse {
  ok: boolean;
  total_intent_rows?: number;
  joined_confirmed_order?: number;
  pending_order_sync?: number;
  no_order_after_24h?: number;
  duplicated_intent?: number;
  invalid_payload?: number;
  [k: string]: unknown;
}

interface LedgerItem {
  id: number;
  intent_uuid: string;
  source_version: string;
  intent_phase: string;
  payment_button_type: string | null;
  imweb_order_code: string | null;
  is_simulation: number;
  preview_only: number;
  ts_ms_kst: number | null;
  captured_at_kst: string | null;
}

interface LedgerListResponse {
  ok: boolean;
  items: LedgerItem[];
  stats: StatsResponse;
}

const TEST_INTENT_PREFIX = "smoke_";
const TEST_VERSION_BLACKLIST = ["a3v2_codex_sim", "a3v21_codex_sim"];

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const result: Args = {
    endpoint: "https://att.ainativeos.net",
    publishTs: null,
    adminToken: null,
    output: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--endpoint") result.endpoint = argv[++i];
    else if (arg === "--publish-ts") result.publishTs = argv[++i];
    else if (arg === "--admin-token") result.adminToken = argv[++i];
    else if (arg === "--output") result.output = argv[++i];
  }
  if (!result.adminToken && process.env.COFFEE_NPAY_INTENT_SMOKE_ADMIN_TOKEN) {
    result.adminToken = process.env.COFFEE_NPAY_INTENT_SMOKE_ADMIN_TOKEN;
  }
  return result;
}

async function fetchJson<T>(url: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(url, opts);
  if (!res.ok && res.status >= 400) {
    const body = await res.text();
    throw new Error(`HTTP ${res.status} on ${url}: ${body.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

function isTestRow(r: LedgerItem): boolean {
  if ((r.intent_uuid || "").startsWith(TEST_INTENT_PREFIX)) return true;
  if (TEST_VERSION_BLACKLIST.some((v) => r.source_version === v)) return true;
  if ((r.source_version || "").startsWith("test_")) return true;
  if (r.is_simulation === 1) return true;
  return false;
}

function pct(num: number, denom: number, digits = 1): string {
  if (denom === 0) return "n/a";
  return ((num / denom) * 100).toFixed(digits);
}

function daysSincePublish(publishTs: string | null): number | string {
  if (!publishTs) return "pre-publish";
  const ms = Date.parse(publishTs.replace(" ", "T") + "+09:00");
  if (Number.isNaN(ms)) return "pre-publish";
  return Math.floor((Date.now() - ms) / (24 * 3600 * 1000));
}

function modeFromDays(days: number | string): string {
  if (days === "pre-publish") return "pre-publish";
  const d = Number(days);
  if (d < 1) return "day1";
  if (d <= 7) return `day${d + 1}`;
  return "post-default";
}

async function main(): Promise<void> {
  const args = parseArgs();
  const capturedAtKst = new Date().toLocaleString("sv-SE", { timeZone: "Asia/Seoul" });
  const days = daysSincePublish(args.publishTs);

  // 1. stats (public)
  const stats = await fetchJson<StatsResponse>(`${args.endpoint}/api/coffee/intent/stats`);
  const rc = stats.reject_counters || {};

  // 2. ledger items (admin token 있으면)
  let ledgerItems: LedgerItem[] = [];
  let joinReport: JoinReportResponse | null = null;
  if (args.adminToken) {
    try {
      const list = await fetchJson<LedgerListResponse>(
        `${args.endpoint}/api/attribution/coffee-npay-intents?limit=500`,
        { headers: { Authorization: `Bearer ${args.adminToken}` } },
      );
      ledgerItems = list.items || [];
    } catch (e) {
      console.error("[warn] ledger list fetch failed:", (e as Error).message);
    }
    try {
      joinReport = await fetchJson<JoinReportResponse>(
        `${args.endpoint}/api/attribution/coffee-npay-intent-join-report`,
        { headers: { Authorization: `Bearer ${args.adminToken}` } },
      );
    } catch (e) {
      console.error("[warn] join-report fetch failed:", (e as Error).message);
    }
  }

  // 3. test row 분리
  const realItems = ledgerItems.filter((r) => !isTestRow(r));
  const testItems = ledgerItems.filter((r) => isTestRow(r));

  // 4. metric 산출
  const M1_total = realItems.length;
  const M2_with_code = realItems.filter((r) => r.imweb_order_code).length;
  const M3_coverage = pct(M2_with_code, M1_total);
  const M4_enforce_inserted = rc.enforce_inserted ?? 0;
  const M5_enforce_deduped = rc.enforce_deduped ?? 0;
  const M5_dedup_ratio = pct(M5_enforce_deduped, M4_enforce_inserted);
  const M6_invalid_origin = rc.invalid_origin ?? 0;
  const M7_rate_limited = rc.rate_limited ?? 0;
  const M8_preview_only_violation = rc.preview_only_violation ?? 0;
  const M9_is_simulation_blocked = rc.is_simulation_blocked ?? 0;
  const M10_pii_rejected = rc.pii_rejected ?? 0;
  // M11 endpoint_5xx: backend log grep manual
  const M12_rows_with_ga4_id = stats.rows_with_ga4_synthetic_transaction_id;

  // 5. payment_button_type null in confirm_to_pay
  const C2P_null = realItems.filter(
    (r) => r.intent_phase === "confirm_to_pay" && !r.payment_button_type,
  ).length;

  // 6. stop 조건 위반 카운트 (자동 측정 가능 부분만)
  const F_violations: string[] = [];
  if (M1_total > 0 && Number(M3_coverage) < 80) F_violations.push("F-1");
  if (M4_enforce_inserted > 0 && Number(M5_dedup_ratio) > 20) F_violations.push("F-2");
  if (M6_invalid_origin > 0) F_violations.push("F-5");
  if (M8_preview_only_violation > 0) F_violations.push("F-6");
  if (M9_is_simulation_blocked > 0) F_violations.push("F-7");
  if (M10_pii_rejected > 0) F_violations.push("F-8");

  // 7. early gate 평가
  const eg: Record<string, string> = {};
  if (M1_total === 0) {
    eg["EG-1_imweb_order_code_coverage_ge_95"] = "n/a (no real rows)";
  } else {
    eg["EG-1_imweb_order_code_coverage_ge_95"] = Number(M3_coverage) >= 95 ? "PASS" : "FAIL";
  }
  eg["EG-3_enforce_deduped_ratio_le_5"] =
    M4_enforce_inserted === 0 || Number(M5_dedup_ratio) <= 5 ? "PASS" : "FAIL";
  eg["EG-4_payment_button_type_null_in_confirm"] = C2P_null === 0 ? "PASS" : `FAIL (${C2P_null})`;
  eg["EG-5_invalid_origin_zero"] = M6_invalid_origin === 0 ? "PASS" : "FAIL";
  eg["EG-5_rate_limited_zero"] = M7_rate_limited === 0 ? "PASS" : "FAIL";
  eg["EG-5_preview_only_violation_zero"] = M8_preview_only_violation === 0 ? "PASS" : "FAIL";
  eg["EG-5_is_simulation_blocked_zero"] = M9_is_simulation_blocked === 0 ? "PASS" : "FAIL";
  eg["EG-6_pii_rejected_zero"] = M10_pii_rejected === 0 ? "PASS" : "FAIL";

  // 8. yaml 형식 출력
  const lines: string[] = [];
  lines.push(`report_id: coffee-npay-intent-monitoring-${capturedAtKst.replace(/[^0-9]/g, "").slice(0, 12)}`);
  lines.push(`captured_at_kst: ${capturedAtKst}`);
  lines.push(`publish_ts_kst: ${args.publishTs ?? "null"}`);
  lines.push(`days_since_publish: ${days}`);
  lines.push(`mode: ${modeFromDays(days)}`);
  lines.push(`backend_endpoint: ${args.endpoint}`);
  lines.push("");
  lines.push("# Section 1: backend dormancy");
  lines.push(`enforce_flag_active: ${stats.enforce_flag_active}`);
  lines.push(`smoke_window_active: ${stats.smoke_window_active}`);
  lines.push("");
  lines.push("# Section 2: 핵심 메트릭");
  lines.push(`M-1_total_rows_excl_test: ${M1_total}`);
  lines.push(`M-1_test_rows_excluded: ${testItems.length}`);
  lines.push(`M-2_rows_with_imweb_order_code: ${M2_with_code}`);
  lines.push(`M-3_imweb_order_code_coverage_pct: ${M3_coverage}`);
  lines.push(`M-4_enforce_inserted: ${M4_enforce_inserted}`);
  lines.push(`M-5_enforce_deduped: ${M5_enforce_deduped}`);
  lines.push(`M-5_enforce_deduped_ratio_pct: ${M5_dedup_ratio}`);
  lines.push(`M-6_invalid_origin: ${M6_invalid_origin}`);
  lines.push(`M-7_rate_limited: ${M7_rate_limited}`);
  lines.push(`M-8_preview_only_violation: ${M8_preview_only_violation}`);
  lines.push(`M-9_is_simulation_blocked: ${M9_is_simulation_blocked}`);
  lines.push(`M-10_pii_rejected: ${M10_pii_rejected}`);
  lines.push(`M-11_endpoint_5xx: manual_pm2_logs_grep`);
  lines.push(`M-12_rows_with_ga4_synthetic_transaction_id: ${M12_rows_with_ga4_id}`);
  lines.push("");
  lines.push("# Section 3: payment_button_type 점검");
  lines.push(`payment_button_type_null_in_confirm_to_pay: ${C2P_null}`);
  lines.push("");
  lines.push("# Section 4: join 메트릭");
  if (joinReport) {
    lines.push(`J-1_joined_confirmed_order: ${joinReport.joined_confirmed_order ?? "n/a"}`);
    lines.push(`J-2_pending_order_sync: ${joinReport.pending_order_sync ?? "n/a"}`);
    lines.push(`J-3_no_order_after_24h: ${joinReport.no_order_after_24h ?? "n/a"}`);
    lines.push(`J-4_duplicated_intent: ${joinReport.duplicated_intent ?? "n/a"}`);
    lines.push(`J-5_invalid_payload_post_join: ${joinReport.invalid_payload ?? "n/a"}`);
  } else {
    lines.push("# join-report skipped (admin token 미지정 또는 fetch 실패)");
  }
  lines.push("");
  lines.push("# Section 5: stop 조건");
  lines.push(`F-violations_auto: [${F_violations.join(", ")}]`);
  lines.push(`stop_required: ${F_violations.length > 0}`);
  lines.push("");
  lines.push("# Section 6: 조기 게이트 (EG-1~EG-9)");
  for (const [k, v] of Object.entries(eg)) {
    lines.push(`${k}: ${v}`);
  }
  lines.push("");
  lines.push("# Section 7: verdict");
  const allPass = Object.values(eg).every((v) => v === "PASS" || v.startsWith("n/a"));
  lines.push(`verdict: ${allPass ? "closure-ready (auto-evaluated)" : "needs_review"}`);
  lines.push(`auto_metric_only: true   # F-9 ~ F-14, D-1~D-3, M-11 manual`);

  const out = lines.join("\n") + "\n";
  console.log(out);

  if (args.output) {
    const fs = await import("fs");
    fs.writeFileSync(args.output, out);
    console.error(`[info] wrote ${args.output}`);
  }
}

main().catch((e) => {
  console.error("[fatal]", (e as Error).message);
  process.exit(1);
});
