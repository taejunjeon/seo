import { queryPg } from "../src/postgres";
(async()=>{
  // 1) tb_sales_coupang 월 × project 집계
  const q = await queryPg(`
    SELECT COALESCE(sales_month, to_char(TO_DATE(sales_recognition_date,'YYYY-MM-DD'),'YYYY-MM')) ym,
           project,
           SUM(card_sales + cash_sales + other_sales) gross,
           SUM(card_refund + cash_refund + other_refund) refund,
           COUNT(*) rows
    FROM public.tb_sales_coupang
    WHERE sales_recognition_date IS NOT NULL
    GROUP BY 1, 2
    ORDER BY 1, 2
  `);
  console.log("tb_sales_coupang 월 × project 집계:");
  for (const r of q.rows) {
    const net = Number(r.gross) - Number(r.refund);
    console.log(`  ${r.ym}  ${r.project}  gross ₩${Number(r.gross).toLocaleString()}  refund ₩${Number(r.refund).toLocaleString()}  net ₩${net.toLocaleString()}  (${r.rows}건)`);
  }

  // 2) 월 합계 (project 무관)
  const q2 = await queryPg(`
    SELECT COALESCE(sales_month, to_char(TO_DATE(sales_recognition_date,'YYYY-MM-DD'),'YYYY-MM')) ym,
           SUM(card_sales + cash_sales + other_sales - card_refund - cash_refund - other_refund) net,
           COUNT(*) rows
    FROM public.tb_sales_coupang
    WHERE sales_recognition_date IS NOT NULL
    GROUP BY 1 ORDER BY 1
  `);
  console.log("\n월 합계:");
  for (const r of q2.rows) console.log(`  ${r.ym}: net ₩${Number(r.net).toLocaleString()} (${r.rows}건)`);

  // 3) project distinct
  const q3 = await queryPg(`SELECT project, COUNT(*) cnt, SUM(card_sales+cash_sales+other_sales - card_refund - cash_refund - other_refund) net FROM public.tb_sales_coupang GROUP BY project ORDER BY cnt DESC`);
  console.log("\nproject 분포:");
  for (const r of q3.rows) console.log(`  ${r.project}: ${r.cnt}건, net ₩${Number(r.net).toLocaleString()}`);
})().catch(e=>console.error(e.message||e));
