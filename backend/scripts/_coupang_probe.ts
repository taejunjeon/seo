import { queryPg } from "../src/postgres";
(async()=>{
  const q1 = await queryPg(`SELECT product_name, COUNT(*) cnt FROM public.tb_coupang_orders WHERE product_name IS NOT NULL AND product_name <> '' GROUP BY product_name ORDER BY COUNT(*) DESC LIMIT 60`);
  console.log("tb_coupang_orders 상품명 빈도순:");
  for (const r of q1.rows) console.log(`  ${r.cnt}\t${r.product_name}`);
  const q2 = await queryPg(`SELECT to_char(ordered_at,'YYYY-MM') ym, COUNT(*) cnt, SUM(unit_sales_price::numeric*sales_quantity) rev FROM public.tb_coupang_orders GROUP BY 1 ORDER BY 1`);
  console.log("\n월별 주문·매출:");
  for (const r of q2.rows) console.log(`  ${r.ym}: ${r.cnt}건 · ₩${Math.round(Number(r.rev)).toLocaleString()}`);
})().catch(e=>console.error(e.message||e));
