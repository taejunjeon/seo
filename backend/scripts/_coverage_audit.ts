import { queryPg } from "../src/postgres";
import Database from "better-sqlite3";

(async () => {
  console.log("=== 로컬 SQLite coupang_settlements_api 현황 ===");
  const db = new Database("/Users/vibetj/coding/seo/backend/data/crm.sqlite3", { readonly: true });
  const monthly = db.prepare(`
    SELECT vendor_id, recognition_year_month ym, COUNT(*) cnt, SUM(final_amount) net, SUM(total_sale) gross
    FROM coupang_settlements_api GROUP BY vendor_id, recognition_year_month ORDER BY vendor_id, ym
  `).all();
  for (const r of monthly as any[]) console.log(`  ${r.vendor_id} ${r.ym}: ${r.cnt}건 · final ₩${Number(r.net).toLocaleString()} · gross ₩${Number(r.gross).toLocaleString()}`);
  const totalMonths = db.prepare(`SELECT COUNT(DISTINCT recognition_year_month) FROM coupang_settlements_api`).get();
  console.log(`  총 distinct months: ${JSON.stringify(totalMonths)}`);
  db.close();

  console.log("\n=== PG tb_sales_coupang channel × month 커버리지 ===");
  const q = await queryPg(`
    SELECT channel, sales_month, COUNT(*) rows,
           SUM(card_sales+cash_sales+other_sales - card_refund - cash_refund - other_refund) net
    FROM public.tb_sales_coupang
    GROUP BY channel, sales_month ORDER BY channel, sales_month
  `);
  for (const r of q.rows) console.log(`  ${r.channel} ${r.sales_month || '<null>'}: ${r.rows}건 · ₩${Number(r.net).toLocaleString()}`);

  console.log("\n=== tb_sales_coupang 에서 vendor 추정 가능 컬럼 있는지 ===");
  const cols = await queryPg(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='tb_sales_coupang' ORDER BY ordinal_position`);
  console.log("  columns:", cols.rows.map((r: any) => r.column_name).join(", "));

  console.log("\n=== coupang 관련 다른 테이블 탐색 ===");
  const tbls = await queryPg(`
    SELECT table_name,
           (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema='public' AND table_name=t.table_name) AS ncol
    FROM information_schema.tables t
    WHERE table_schema='public' AND (table_name ILIKE '%coupang%' OR table_name ILIKE '%rocket%' OR table_name ILIKE '%rg%')
    ORDER BY table_name
  `);
  for (const r of tbls.rows) console.log(`  ${r.table_name} (${r.ncol}컬럼)`);

  console.log("\n=== tb_coupang_orders 에 channel 식별 컬럼 있는지 ===");
  const cols2 = await queryPg(`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='tb_coupang_orders' ORDER BY ordinal_position`);
  for (const r of cols2.rows) console.log(`  ${r.column_name} (${r.data_type})`);
  // 실제 주문이 3P 인지 RG 인지 추정 단서 (item_type, shipment_type 등이 있을지)
})().catch(e => console.error(e.message || e));
