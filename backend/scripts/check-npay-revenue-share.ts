import path from "node:path";
import Database from "better-sqlite3";

// NPay 매출 비중 감사 스크립트
// 2026-04-21 작성. NPay return 누락 이슈(GA4/npay_return_missing_20260421.md) TJ 의사결정 근거 데이터.
// 사용: `npm --prefix backend exec tsx backend/scripts/check-npay-revenue-share.ts --json`
//       `... --site=biocom --windowDays=30`

type CliOptions = {
  dbPath: string;
  site: string;
  windows: number[];
  json: boolean;
};

const parseArgs = (): CliOptions => {
  const argValue = (name: string) => {
    const prefix = `--${name}=`;
    return process.argv.find((a) => a.startsWith(prefix))?.slice(prefix.length);
  };
  const defaultDb = path.resolve(process.cwd(), "backend/data/crm.sqlite3");
  const dbPath = argValue("dbPath") ?? defaultDb;
  const site = argValue("site") ?? "biocom";
  const windowsRaw = argValue("windows") ?? "30,60,90,365";
  const windows = windowsRaw.split(",").map((x) => Number(x.trim())).filter((n) => Number.isFinite(n) && n > 0);
  return {
    dbPath,
    site,
    windows: windows.length > 0 ? windows : [30, 60, 90, 365],
    json: process.argv.includes("--json"),
  };
};

type RevenueByPayType = {
  pay_type: string;
  orders: number;
  gross_krw: number;
  payment_amount_krw: number;
  delivery_price_krw: number;
  share_orders_pct: number;
  share_gross_pct: number;
};

type PeriodSummary = {
  window_days: number;
  period_start: string;
  period_end: string;
  total_orders: number;
  total_gross_krw: number;
  by_pay_type: RevenueByPayType[];
};

const queryPeriod = (db: Database.Database, site: string, days: number): PeriodSummary => {
  const row = db.prepare(`
    SELECT pay_type,
           COUNT(*) AS orders,
           COALESCE(SUM(total_price), 0) AS gross_krw,
           COALESCE(SUM(payment_amount), 0) AS payment_amount_krw,
           COALESCE(SUM(delivery_price), 0) AS delivery_price_krw
    FROM imweb_orders
    WHERE site = ?
      AND order_time >= date('now', ?)
    GROUP BY pay_type
    ORDER BY orders DESC
  `);
  const rows = row.all(site, `-${days} days`) as Array<{
    pay_type: string | null;
    orders: number;
    gross_krw: number;
    payment_amount_krw: number;
    delivery_price_krw: number;
  }>;

  const totalOrders = rows.reduce((s, r) => s + r.orders, 0);
  const totalGross = rows.reduce((s, r) => s + r.gross_krw, 0);

  const periodRow = db.prepare(`
    SELECT MIN(order_time) AS period_start, MAX(order_time) AS period_end
    FROM imweb_orders WHERE site = ? AND order_time >= date('now', ?)
  `).get(site, `-${days} days`) as { period_start: string | null; period_end: string | null };

  return {
    window_days: days,
    period_start: periodRow.period_start ?? "",
    period_end: periodRow.period_end ?? "",
    total_orders: totalOrders,
    total_gross_krw: totalGross,
    by_pay_type: rows.map((r) => ({
      pay_type: r.pay_type ?? "(null)",
      orders: r.orders,
      gross_krw: r.gross_krw,
      payment_amount_krw: r.payment_amount_krw,
      delivery_price_krw: r.delivery_price_krw,
      share_orders_pct: totalOrders > 0 ? Math.round((r.orders / totalOrders) * 10000) / 100 : 0,
      share_gross_pct: totalGross > 0 ? Math.round((r.gross_krw / totalGross) * 10000) / 100 : 0,
    })),
  };
};

type NpayTimeSeries = {
  month: string;
  total_orders: number;
  npay_orders: number;
  npay_orders_pct: number;
  total_gross_krw: number;
  npay_gross_krw: number;
  npay_gross_pct: number;
};

const queryMonthlyNpay = (db: Database.Database, site: string, months: number): NpayTimeSeries[] => {
  const rows = db.prepare(`
    SELECT substr(order_time, 1, 7) AS month,
           COUNT(*) AS total_orders,
           SUM(CASE WHEN pay_type = 'npay' THEN 1 ELSE 0 END) AS npay_orders,
           COALESCE(SUM(total_price), 0) AS total_gross_krw,
           COALESCE(SUM(CASE WHEN pay_type = 'npay' THEN total_price ELSE 0 END), 0) AS npay_gross_krw
    FROM imweb_orders
    WHERE site = ?
      AND order_time >= date('now', ?)
    GROUP BY month
    ORDER BY month
  `).all(site, `-${months} months`) as Array<{
    month: string;
    total_orders: number;
    npay_orders: number;
    total_gross_krw: number;
    npay_gross_krw: number;
  }>;

  return rows.map((r) => ({
    ...r,
    npay_orders_pct: r.total_orders > 0 ? Math.round((r.npay_orders / r.total_orders) * 10000) / 100 : 0,
    npay_gross_pct: r.total_gross_krw > 0 ? Math.round((r.npay_gross_krw / r.total_gross_krw) * 10000) / 100 : 0,
  }));
};

const formatKrw = (n: number) => `₩${n.toLocaleString("ko-KR")}`;
const pct = (n: number) => `${n.toFixed(2)}%`;

const printHuman = (opts: CliOptions, periods: PeriodSummary[], monthly: NpayTimeSeries[]) => {
  console.log(`\nNPay 매출 비중 감사 — site=${opts.site}, db=${opts.dbPath}`);
  console.log(`=`.repeat(80));

  for (const p of periods) {
    console.log(`\n● 최근 ${p.window_days}일  (${p.period_start?.slice(0, 10)} ~ ${p.period_end?.slice(0, 10)})`);
    console.log(`  총 주문 ${p.total_orders.toLocaleString()}건 / 총 매출 ${formatKrw(p.total_gross_krw)}`);
    console.log(`  ${"pay_type".padEnd(12)} ${"orders".padStart(8)} ${"gross".padStart(18)} ${"orders %".padStart(10)} ${"gross %".padStart(10)}`);
    console.log(`  ${"-".repeat(60)}`);
    for (const r of p.by_pay_type) {
      const mark = r.pay_type === "npay" ? " ★" : "";
      console.log(
        `  ${r.pay_type.padEnd(12)} ${r.orders.toString().padStart(8)} ${formatKrw(r.gross_krw).padStart(18)} ${pct(r.share_orders_pct).padStart(10)} ${pct(r.share_gross_pct).padStart(10)}${mark}`
      );
    }
  }

  console.log(`\n● 월별 NPay 추이 (최근 12개월)`);
  console.log(`  ${"month".padEnd(8)} ${"total".padStart(8)} ${"npay".padStart(8)} ${"npay % (orders)".padStart(18)} ${"npay gross".padStart(18)} ${"npay % (gross)".padStart(18)}`);
  console.log(`  ${"-".repeat(82)}`);
  for (const m of monthly) {
    console.log(
      `  ${m.month.padEnd(8)} ${m.total_orders.toString().padStart(8)} ${m.npay_orders.toString().padStart(8)} ${pct(m.npay_orders_pct).padStart(18)} ${formatKrw(m.npay_gross_krw).padStart(18)} ${pct(m.npay_gross_pct).padStart(18)}`
    );
  }

  const latest30 = periods.find((p) => p.window_days === 30);
  if (latest30) {
    const npay = latest30.by_pay_type.find((r) => r.pay_type === "npay");
    if (npay) {
      console.log(`\n● TJ 의사결정 근거 (최근 30일)`);
      console.log(`  NPay 주문 수: ${npay.orders}건 / 전체의 ${pct(npay.share_orders_pct)}`);
      console.log(`  NPay gross  : ${formatKrw(npay.gross_krw)} / 전체의 ${pct(npay.share_gross_pct)}`);
      const decisionThreshold = npay.share_gross_pct;
      let recommend = "";
      if (decisionThreshold < 5) recommend = "(a) NPay 제거 + 시계열 비교 — 저위험 (gross 비중 < 5%)";
      else if (decisionThreshold < 15) recommend = "(b) NPay 제거 + 시계열 비교 — 중위험. Rollback 기준 매출 10%↓ 선언";
      else recommend = "(c) 세션 A/B 또는 server-side GA4 MP purchase 복구 권장 — 매출 영향 큼";
      console.log(`  Claude 권장: ${recommend}`);
      console.log(`  (상세: GA4/npay_return_missing_20260421.md §5-3)`);
    }
  }
};

const main = () => {
  const opts = parseArgs();
  const db = new Database(opts.dbPath, { readonly: true });

  const periods = opts.windows.map((d) => queryPeriod(db, opts.site, d));
  const monthly = queryMonthlyNpay(db, opts.site, 12);

  db.close();

  if (opts.json) {
    console.log(JSON.stringify({ site: opts.site, periods, monthly }, null, 2));
  } else {
    printHuman(opts, periods, monthly);
  }
};

main();
