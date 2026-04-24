import { queryPg } from "../src/postgres";
(async()=>{
  // 1) tb_coupang_orders 컬럼
  const cols = await queryPg(`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='tb_coupang_orders' ORDER BY ordinal_position`);
  console.log("== tb_coupang_orders 컬럼 ==");
  for (const r of cols.rows) console.log(`  ${r.column_name} (${r.data_type})`);

  // 2) tb_sales_coupang 존재 & 컬럼
  const cols2 = await queryPg(`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='tb_sales_coupang' ORDER BY ordinal_position`);
  console.log("\n== tb_sales_coupang 컬럼 ==");
  for (const r of cols2.rows) console.log(`  ${r.column_name} (${r.data_type})`);

  // 3) tb_sales_coupang 월별·project별 집계
  if (cols2.rows.length) {
    const samp = await queryPg(`SELECT * FROM public.tb_sales_coupang LIMIT 3`);
    console.log("\n== tb_sales_coupang 샘플 ==");
    console.log(JSON.stringify(samp.rows, null, 2));
  }
})().catch(e=>console.error(e.message||e));
