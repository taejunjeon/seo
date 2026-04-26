import { queryPg } from "../src/postgres";
import Database from "better-sqlite3";

(async () => {
  console.log("════════════════ 3P 상품 변화 (tb_sales_coupang · BIOCOM 2026-01 → 2026-02 → 2026-03) ════════════════");
  // 이관 경계 (2026-02) 전후 같은 channel=coupang_3p project 분포
  const q1 = await queryPg(`
    SELECT sales_month, project, COUNT(*) cnt,
           SUM(card_sales + cash_sales + other_sales - card_refund - cash_refund - other_refund) net
    FROM public.tb_sales_coupang
    WHERE channel='coupang_3p'
    GROUP BY sales_month, project
    ORDER BY sales_month, project
  `);
  for (const r of q1.rows) console.log(`  ${r.sales_month} / ${r.project}: ${r.cnt}건 · ₩${Number(r.net).toLocaleString()}`);

  console.log("\n════════════════ 3P 상품 Top (2026-01 BIOCOM · 이관 직전) ════════════════");
  const q2 = await queryPg(`
    SELECT product_name, project, COUNT(*) cnt,
           SUM(card_sales + cash_sales + other_sales - card_refund - cash_refund - other_refund) net
    FROM public.tb_sales_coupang
    WHERE channel='coupang_3p' AND sales_month='2026-01'
    GROUP BY product_name, project
    ORDER BY 4 DESC LIMIT 15
  `);
  for (const r of q2.rows) console.log(`  [${r.project}] ${r.product_name}: ${r.cnt}건 · ₩${Number(r.net).toLocaleString()}`);

  console.log("\n════════════════ 3P 상품 Top (2026-02 · 이관 월) ════════════════");
  const q3 = await queryPg(`
    SELECT product_name, project, COUNT(*) cnt,
           SUM(card_sales + cash_sales + other_sales - card_refund - cash_refund - other_refund) net
    FROM public.tb_sales_coupang
    WHERE channel='coupang_3p' AND sales_month='2026-02'
    GROUP BY product_name, project
    ORDER BY 4 DESC LIMIT 15
  `);
  for (const r of q3.rows) console.log(`  [${r.project}] ${r.product_name}: ${r.cnt}건 · ₩${Number(r.net).toLocaleString()}`);

  console.log("\n════════════════ 3P 상품 Top (2026-03 · 이관 후 BIOCOM 잔여) ════════════════");
  const q4 = await queryPg(`
    SELECT product_name, project, COUNT(*) cnt,
           SUM(card_sales + cash_sales + other_sales - card_refund - cash_refund - other_refund) net
    FROM public.tb_sales_coupang
    WHERE channel='coupang_3p' AND sales_month='2026-03'
    GROUP BY product_name, project
    ORDER BY 4 DESC
  `);
  for (const r of q4.rows) console.log(`  [${r.project}] ${r.product_name}: ${r.cnt}건 · ₩${Number(r.net).toLocaleString()}`);

  // RG 상품 변화 (로컬 SQLite)
  const db = new Database("/Users/vibetj/coding/seo/backend/data/crm.sqlite3", { readonly: true });
  console.log("\n════════════════ BIOCOM RG 상품 Top (2025-12 · 이관 전) ════════════════");
  const rg1 = db.prepare(`
    SELECT product_name, COUNT(*) cnt, SUM(gross_amount) gross
    FROM coupang_rg_orders_api
    WHERE vendor_id='A00668577' AND strftime('%Y-%m', paid_at_kst)='2025-12'
    GROUP BY product_name ORDER BY 3 DESC LIMIT 8
  `).all();
  for (const r of rg1 as any[]) console.log(`  ${r.product_name}: ${r.cnt}건 · ₩${Number(r.gross).toLocaleString()}`);

  console.log("\n════════════════ BIOCOM RG 상품 Top (2026-03 · 이관 후) ════════════════");
  const rg2 = db.prepare(`
    SELECT product_name, COUNT(*) cnt, SUM(gross_amount) gross
    FROM coupang_rg_orders_api
    WHERE vendor_id='A00668577' AND strftime('%Y-%m', paid_at_kst)='2026-03'
    GROUP BY product_name ORDER BY 3 DESC LIMIT 8
  `).all();
  for (const r of rg2 as any[]) console.log(`  ${r.product_name}: ${r.cnt}건 · ₩${Number(r.gross).toLocaleString()}`);

  console.log("\n════════════════ TEAMKETO RG 상품 전체 (2026-01~04) ════════════════");
  const rg3 = db.prepare(`
    SELECT product_name, COUNT(*) cnt, SUM(gross_amount) gross
    FROM coupang_rg_orders_api
    WHERE vendor_id='A00963878'
    GROUP BY product_name ORDER BY 3 DESC LIMIT 10
  `).all();
  for (const r of rg3 as any[]) console.log(`  ${r.product_name}: ${r.cnt}건 · ₩${Number(r.gross).toLocaleString()}`);

  db.close();
})().catch(e => console.error(e.message || e));
