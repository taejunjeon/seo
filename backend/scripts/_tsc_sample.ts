import { queryPg } from "../src/postgres";
(async () => {
  // 이미 올라간 2026-01 upload 샘플
  const s = await queryPg(`SELECT * FROM public.tb_sales_coupang WHERE sales_month='2026-01' AND channel='coupang_3p' LIMIT 3`);
  console.log("원격 PG tb_sales_coupang 2026-01 coupang_3p 샘플 3건:");
  for (const r of s.rows) console.log(JSON.stringify(r, null, 2));

  // project 분포 추정 (project 는 어떻게 결정되나?)
  const p = await queryPg(`SELECT project, COUNT(*) c, AVG(card_sales+cash_sales+other_sales) avg_amt FROM public.tb_sales_coupang WHERE sales_month='2026-01' GROUP BY project`);
  console.log("\nproject 분포:");
  for (const r of p.rows) console.log(`  ${r.project}: ${r.c}건 · 평균 ₩${Math.round(Number(r.avg_amt)).toLocaleString()}`);

  // upload_batch_id 정체
  const b = await queryPg(`SELECT upload_batch_id, channel, sales_month, MIN(uploaded_at) ua, COUNT(*) c FROM public.tb_sales_coupang GROUP BY 1,2,3 ORDER BY ua DESC`);
  console.log("\nupload_batch_id 전체:");
  for (const r of b.rows) console.log(`  ${r.upload_batch_id} | ${r.channel} | ${r.sales_month} | ${r.ua} | ${r.c}건`);
})().catch(e => console.error(e.message || e));
