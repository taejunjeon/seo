import path from "node:path";
import Database from "better-sqlite3";

// NPay 스코프 내 매출 비중 재계산 스크립트
// 2026-04-22. TJ 요청: NPay 는 건기식(영양제/도시락/세트/정기구독) 페이지에만 달려있음.
// 검사/분석 카테고리는 NPay 없음 → 분모에서 제외하고 실제 NPay 선택률 계산.

type Opts = { dbPath: string; site: string; windows: number[]; json: boolean; };

const parseArgs = (): Opts => {
  const argValue = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
  return {
    dbPath: argValue("dbPath") ?? path.resolve(process.cwd(), "backend/data/crm.sqlite3"),
    site: argValue("site") ?? "biocom",
    windows: (argValue("windows") ?? "30,60,90,365").split(",").map(Number).filter((n) => n > 0),
    json: process.argv.includes("--json"),
  };
};

// 검사/분석 카테고리 item_name 패턴 (NPay 스코프 밖)
// 기준: 2026-04-22 Playwright 확인 결과 — igg_store / mineraltest_store / organicacid_store /
//       microbiome / hormon_store / 펫 영양검사 에 NPay 버튼 없음.
// 세트 (biocomset_store) 는 NPay 있음 → 검사 키워드 매치여도 '세트/Set' 포함이면 스코프 내.
const TEST_ONLY_PATTERNS = [
  "음식물 과민증 분석",
  "음식물 과민증 검사",
  "음식물과민증 분석",  // 띄어쓰기 변형
  "지연성 알러지",
  "중금속 분석",
  "영양 중금속",
  "미네랄 검사",
  "유기산 대사 검사",
  "대사기능 분석",
  "대사기능 검사",
  "마이크로바이옴",
  "장내 미생물",
  "NGS 장내",
  "호르몬 검사",
  "스트레스 노화 검사",
  "스트레스호르몬",
  "펫 영양검사",
  "펫 영양 검사",
];
const SET_KEYWORDS = ["세트", "Set", "set", "SET", "콤보"];

const isTestOnly = (name: string): boolean => {
  if (!name) return false;
  const hasTest = TEST_ONLY_PATTERNS.some((p) => name.includes(p));
  if (!hasTest) return false;
  // 세트/콤보 키워드가 있으면 '검사 포함 세트' 로 분류 (NPay 스코프 내)
  const hasSet = SET_KEYWORDS.some((k) => name.includes(k));
  return !hasSet;
};

type OrderScope = {
  order_no: string;
  site: string;
  pay_type: string | null;
  order_time: string | null;
  total_price: number;
  scope: "npay_possible" | "test_only" | "mixed" | "unknown";
  test_item_count: number;
  supplement_item_count: number;
  set_item_count: number;
};

const classifyOrders = (db: Database.Database, site: string, days: number): OrderScope[] => {
  const rows = db.prepare(`
    SELECT o.order_no, o.site, o.pay_type, o.order_time, o.total_price,
           i.item_name, i.sale_cnt
    FROM imweb_orders o
    LEFT JOIN imweb_order_items i
           ON i.order_no = o.order_no AND i.site = o.site
    WHERE o.site = ?
      AND o.order_time >= date('now', ?)
    ORDER BY o.order_no
  `).all(site, `-${days} days`) as Array<{
    order_no: string; site: string; pay_type: string | null; order_time: string | null;
    total_price: number; item_name: string | null; sale_cnt: number | null;
  }>;

  const byOrder = new Map<string, OrderScope>();
  for (const r of rows) {
    if (!byOrder.has(r.order_no)) {
      byOrder.set(r.order_no, {
        order_no: r.order_no, site: r.site, pay_type: r.pay_type, order_time: r.order_time,
        total_price: r.total_price, scope: "unknown",
        test_item_count: 0, supplement_item_count: 0, set_item_count: 0,
      });
    }
    const o = byOrder.get(r.order_no)!;
    if (!r.item_name) continue;
    const hasSet = SET_KEYWORDS.some((k) => r.item_name!.includes(k));
    const testOnly = isTestOnly(r.item_name);
    if (hasSet) o.set_item_count++;
    else if (testOnly) o.test_item_count++;
    else o.supplement_item_count++;
  }

  // 스코프 결정
  for (const o of byOrder.values()) {
    const hasTest = o.test_item_count > 0;
    const hasSupp = o.supplement_item_count > 0;
    const hasSet = o.set_item_count > 0;
    if (!hasTest && !hasSupp && !hasSet) o.scope = "unknown"; // line items 없음 (백필/수동 주문 등)
    else if (hasSupp || hasSet) o.scope = hasTest ? "mixed" : "npay_possible";
    else if (hasTest) o.scope = "test_only";
  }

  return Array.from(byOrder.values());
};

type PeriodReport = {
  window_days: number;
  total_orders: number;
  total_gross: number;
  byScope: Record<string, { orders: number; gross: number; npay_orders: number; npay_gross: number; share_orders: number; share_gross: number; npay_selection_rate: number; }>;
};

const report = (orders: OrderScope[], windowDays: number): PeriodReport => {
  const acc: Record<string, { orders: number; gross: number; npay_orders: number; npay_gross: number }> = {
    npay_possible: { orders: 0, gross: 0, npay_orders: 0, npay_gross: 0 },
    mixed: { orders: 0, gross: 0, npay_orders: 0, npay_gross: 0 },
    test_only: { orders: 0, gross: 0, npay_orders: 0, npay_gross: 0 },
    unknown: { orders: 0, gross: 0, npay_orders: 0, npay_gross: 0 },
  };
  for (const o of orders) {
    const b = acc[o.scope];
    b.orders++;
    b.gross += o.total_price;
    if (o.pay_type === "npay") { b.npay_orders++; b.npay_gross += o.total_price; }
  }
  const total = orders.length;
  const totalGross = orders.reduce((s, o) => s + o.total_price, 0);

  const byScope: PeriodReport["byScope"] = {};
  for (const [k, v] of Object.entries(acc)) {
    byScope[k] = {
      orders: v.orders,
      gross: v.gross,
      npay_orders: v.npay_orders,
      npay_gross: v.npay_gross,
      share_orders: total > 0 ? Math.round((v.orders / total) * 10000) / 100 : 0,
      share_gross: totalGross > 0 ? Math.round((v.gross / totalGross) * 10000) / 100 : 0,
      npay_selection_rate: v.orders > 0 ? Math.round((v.npay_orders / v.orders) * 10000) / 100 : 0,
    };
  }
  return { window_days: windowDays, total_orders: total, total_gross: totalGross, byScope };
};

const fmtKrw = (n: number) => `₩${n.toLocaleString("ko-KR")}`;

const main = () => {
  const opts = parseArgs();
  const db = new Database(opts.dbPath, { readonly: true });

  const reports = opts.windows.map((d) => report(classifyOrders(db, opts.site, d), d));
  db.close();

  if (opts.json) {
    console.log(JSON.stringify({ site: opts.site, reports }, null, 2));
    return;
  }

  console.log(`\nNPay 스코프 구분 재계산 — site=${opts.site}`);
  console.log(`=`.repeat(96));
  console.log(`분류 기준 (2026-04-22 Playwright 확인):`);
  console.log(`  • npay_possible = 건기식/도시락/세트/정기구독 — NPay 버튼 있음`);
  console.log(`  • test_only      = 검사/분석만 (IgG/미네랄/유기산/마이크로바이옴/호르몬/펫) — NPay 없음`);
  console.log(`  • mixed          = 검사 + 건기식 같이 주문 — NPay 가능 페이지에서 결제 시작했을 것`);
  console.log(`  • unknown        = line items 없음 (backfill/누락)\n`);

  for (const r of reports) {
    console.log(`● 최근 ${r.window_days}일  총 ${r.total_orders.toLocaleString()}건 / ${fmtKrw(r.total_gross)}`);
    console.log(`  ${"scope".padEnd(16)} ${"orders".padStart(7)} ${"gross".padStart(18)} ${"share_o".padStart(9)} ${"share_g".padStart(9)} ${"npay_o".padStart(7)} ${"npay_g".padStart(14)} ${"npay_selection_rate".padStart(22)}`);
    console.log(`  ${"-".repeat(108)}`);
    const order = ["npay_possible", "mixed", "test_only", "unknown"];
    for (const k of order) {
      const s = r.byScope[k];
      const mark = k === "npay_possible" ? " ★" : "";
      console.log(`  ${k.padEnd(16)} ${String(s.orders).padStart(7)} ${fmtKrw(s.gross).padStart(18)} ${(s.share_orders + "%").padStart(9)} ${(s.share_gross + "%").padStart(9)} ${String(s.npay_orders).padStart(7)} ${fmtKrw(s.npay_gross).padStart(14)} ${(s.npay_selection_rate + "%").padStart(22)}${mark}`);
    }

    // 핵심 인사이트
    const np = r.byScope.npay_possible;
    const mx = r.byScope.mixed;
    const scopeOrders = np.orders + mx.orders;
    const scopeNpay = np.npay_orders + mx.npay_orders;
    const scopeGross = np.gross + mx.gross;
    const scopeNpayGross = np.npay_gross + mx.npay_gross;
    console.log(`\n  ⭐ NPay 가능 페이지 기준 (npay_possible + mixed):`);
    console.log(`     scope 주문: ${scopeOrders.toLocaleString()} / NPay 주문: ${scopeNpay.toLocaleString()} → 선택률 ${scopeOrders > 0 ? ((scopeNpay / scopeOrders) * 100).toFixed(2) : 0}%`);
    console.log(`     scope gross: ${fmtKrw(scopeGross)} / NPay gross: ${fmtKrw(scopeNpayGross)} → ${scopeGross > 0 ? ((scopeNpayGross / scopeGross) * 100).toFixed(2) : 0}%\n`);
  }
};

main();
