/**
 * A-6 ledger → imweb_orders join dry-run (read-only).
 *
 * sprint 22 — A-6 design 의 §4 ledger join SQL 검증.
 * 본 commit 시점: 운영 traffic 미진입 (A-5 monitoring 진행 중) — 대부분 test row.
 * publish 후 운영 traffic 들어오면 hit rate 의미 있음.
 *
 * 사용:
 *   cd backend
 *   npx tsx scripts/coffee-a6-ledger-join-dry-run.ts \
 *     [--endpoint https://att.ainativeos.net]  # public list endpoint (admin token 불요)
 *
 * 본 script 는 list endpoint (public read) 만 호출. backend SQLite 직접 조회 0.
 * imweb_orders 테이블 join 은 운영 PG (read-only) 에 sprint 22.1 에서 추가.
 *
 * 출력: ledger 의 imweb_order_code 분포 (real / test / null) — A-6 join 가능성 추정용.
 */

interface LedgerItem {
  id: number;
  intent_uuid: string;
  source_version: string;
  intent_phase: string;
  imweb_order_code: string | null;
  payment_button_type: string | null;
  is_simulation: number;
}

interface LedgerListResponse {
  ok: boolean;
  items: LedgerItem[];
  stats: {
    total_rows: number;
    rows_with_imweb_order_code: number;
    enforce_flag_active: boolean;
    production_mode_active: boolean;
  };
}

function isTestRow(r: LedgerItem): boolean {
  if ((r.intent_uuid || "").startsWith("smoke_")) return true;
  if ((r.source_version || "").includes("codex_sim")) return true;
  if ((r.source_version || "").includes("playwright")) return true;
  if (r.is_simulation === 1) return true;
  return false;
}

async function main(): Promise<void> {
  const endpoint = process.argv.includes("--endpoint")
    ? process.argv[process.argv.indexOf("--endpoint") + 1]
    : "https://att.ainativeos.net";

  console.log(`# A-6 ledger join dry-run`);
  console.log(`# endpoint: ${endpoint}`);
  console.log(`# captured_at: ${new Date().toLocaleString("sv-SE", { timeZone: "Asia/Seoul" })} KST`);
  console.log("");

  const res = await fetch(`${endpoint}/api/attribution/coffee-npay-intents?limit=200`);
  const data = (await res.json()) as LedgerListResponse;

  const items = data.items || [];
  const real = items.filter((r) => !isTestRow(r));
  const test = items.filter((r) => isTestRow(r));

  const realWithCode = real.filter((r) => r.imweb_order_code);
  const realNoCode = real.filter((r) => !r.imweb_order_code);
  const realWithCodeAndC2P = realWithCode.filter((r) => r.intent_phase === "confirm_to_pay");

  console.log(`# === summary ===`);
  console.log(`total_items: ${items.length}`);
  console.log(`test_rows: ${test.length}  # 보고서/A-6 send 에서 제외`);
  console.log(`real_rows: ${real.length}  # A-6 send 후보`);
  console.log(`real_with_imweb_order_code: ${realWithCode.length}  # A-6 join 가능 후보`);
  console.log(`real_with_imweb_order_code_and_confirm_to_pay: ${realWithCodeAndC2P.length}`);
  console.log(`real_no_imweb_order_code: ${realNoCode.length}  # A-6 send 불가 (deterministic key 부재)`);
  console.log("");
  console.log(`# === a6_join_eligibility ===`);
  if (real.length === 0) {
    console.log(`status: insufficient_data  # 운영 traffic 미진입 (publish 후 자연 capture 대기)`);
  } else {
    const eligibility = ((realWithCodeAndC2P.length / real.length) * 100).toFixed(1);
    console.log(`a6_join_eligibility_pct: ${eligibility}  # confirm_to_pay AND imweb_order_code 존재 비율`);
    console.log(`a6_send_target_count: ${realWithCodeAndC2P.length}  # 본 시점 A-6 send 후보 (운영 ledger 누적)`);
  }
  console.log("");
  console.log(`# === backend stats ===`);
  console.log(`enforce_flag_active: ${data.stats.enforce_flag_active}`);
  console.log(`production_mode_active: ${data.stats.production_mode_active}`);
  console.log(`total_rows: ${data.stats.total_rows}`);
  console.log(`rows_with_imweb_order_code: ${data.stats.rows_with_imweb_order_code}`);
  console.log("");
  console.log(`# === note ===`);
  console.log(`# 본 dry-run 은 ledger 의 imweb_order_code 분포만 산출.`);
  console.log(`# 실제 imweb_orders 테이블 (운영 PG) join 은 sprint 22.1 (A-5 closure 후) 에서 진행.`);
  console.log(`# 그 시점 ledger row 의 order_code 가 imweb_orders.order_code 와 1:1 deterministic join 가능 여부 검증.`);
}

main().catch((e) => {
  console.error("[fatal]", (e as Error).message);
  process.exit(1);
});
