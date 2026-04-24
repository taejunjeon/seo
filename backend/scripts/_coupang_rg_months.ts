import { queryPg } from "../src/postgres";
(async()=>{
  const q = await queryPg(`
    SELECT channel, sales_month, COUNT(*) rows,
           SUM(card_sales+cash_sales+other_sales - card_refund - cash_refund - other_refund) net
    FROM public.tb_sales_coupang
    GROUP BY 1,2 ORDER BY 1,2
  `);
  console.log("channel × sales_month:");
  for (const r of q.rows) console.log(`  ${r.channel} ${r.sales_month || '<null>'}: ${r.rows}건 · ₩${Number(r.net).toLocaleString()}`);
})().catch(e=>console.error(e.message||e));
