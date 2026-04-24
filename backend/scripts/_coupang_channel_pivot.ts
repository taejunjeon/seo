import { queryPg } from "../src/postgres";
(async()=>{
  const q = await queryPg(`
    SELECT COALESCE(sales_month, to_char(TO_DATE(sales_recognition_date,'YYYY-MM-DD'),'YYYY-MM')) ym,
           channel, project,
           SUM(card_sales+cash_sales+other_sales - card_refund - cash_refund - other_refund) net,
           COUNT(*) rows
    FROM public.tb_sales_coupang
    WHERE sales_recognition_date IS NOT NULL
    GROUP BY 1,2,3
    ORDER BY 1,2,3
  `);
  console.log("tb_sales_coupang 월 × channel × project:");
  for (const r of q.rows) console.log(`  ${r.ym} ${r.channel} ${r.project}: net ₩${Number(r.net).toLocaleString()} (${r.rows}건)`);

  // channel 합계 (전체)
  const q2 = await queryPg(`
    SELECT channel, SUM(card_sales+cash_sales+other_sales - card_refund - cash_refund - other_refund) net, COUNT(*) rows
    FROM public.tb_sales_coupang GROUP BY 1 ORDER BY net DESC
  `);
  console.log("\nchannel 전체 합계:");
  for (const r of q2.rows) console.log(`  ${r.channel}: net ₩${Number(r.net).toLocaleString()} (${r.rows}건)`);

  // coupang_rg 샘플
  const q3 = await queryPg(`SELECT product_name, project, card_sales, cash_sales, other_sales, sales_month FROM public.tb_sales_coupang WHERE channel='coupang_rg' ORDER BY id LIMIT 10`);
  console.log("\ncoupang_rg 샘플:");
  for (const r of q3.rows) {
    const net = Number(r.card_sales) + Number(r.cash_sales) + Number(r.other_sales);
    console.log(`  [${r.sales_month}] ${r.project}  ${r.product_name}  ₩${net.toLocaleString()}`);
  }
})().catch(e=>console.error(e.message||e));
