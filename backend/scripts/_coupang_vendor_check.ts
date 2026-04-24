import { queryPg } from "../src/postgres";
(async()=>{
  // tb_sales_coupang 에 vendor 구분이 있는지
  const q = await queryPg(`SELECT DISTINCT channel FROM public.tb_sales_coupang`);
  console.log("tb_sales_coupang channel 분포:");
  for (const r of q.rows) console.log(`  ${r.channel}`);

  // upload_batch_id 당 개수
  const q2 = await queryPg(`SELECT upload_batch_id, MIN(uploaded_at) up, COUNT(*) c, MIN(sales_month) smin, MAX(sales_month) smax FROM public.tb_sales_coupang GROUP BY 1 ORDER BY up DESC LIMIT 10`);
  console.log("\nupload_batch_id 별:");
  for (const r of q2.rows) console.log(`  ${r.upload_batch_id}  ${r.up}  ${r.c}건  ${r.smin}~${r.smax}`);

  // tb_coupang_orders vendor별 상품 빈도
  const q3 = await queryPg(`SELECT vendor_id, COUNT(*) cnt, COUNT(DISTINCT product_name) pn FROM public.tb_coupang_orders GROUP BY vendor_id`);
  console.log("\ntb_coupang_orders vendor별:");
  for (const r of q3.rows) console.log(`  ${r.vendor_id}: ${r.cnt}건 · ${r.pn}상품`);

  // tb_coupang_orders 월별 paid_at
  const q4 = await queryPg(`SELECT SUBSTR(paid_at,1,7) ym, vendor_id, COUNT(*) cnt, SUM(unit_sales_price::bigint * sales_quantity) rev FROM public.tb_coupang_orders WHERE paid_at IS NOT NULL AND paid_at <> '' GROUP BY 1,2 ORDER BY 1,2`);
  console.log("\ntb_coupang_orders 월 × vendor:");
  for (const r of q4.rows) console.log(`  ${r.ym} ${r.vendor_id}: ${r.cnt}건 · ₩${Number(r.rev).toLocaleString()}`);
})().catch(e=>console.error(e.message||e));
