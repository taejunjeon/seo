import { queryPg } from "../src/postgres";
(async () => {
  console.log("=== tb_coupang_orders_rg 컬럼 ===");
  const cols = await queryPg(`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='tb_coupang_orders_rg' ORDER BY ordinal_position`);
  for (const r of cols.rows) console.log(`  ${r.column_name} (${r.data_type})`);

  console.log("\n=== tb_coupang_orders_rg 행수 + 월별 샘플 ===");
  const cnt = await queryPg(`SELECT COUNT(*) FROM public.tb_coupang_orders_rg`);
  console.log("  총 행수:", cnt.rows[0]);
  try {
    const monthly = await queryPg(`
      SELECT SUBSTR(paid_at::text,1,7) ym, vendor_id, COUNT(*) cnt
      FROM public.tb_coupang_orders_rg
      WHERE paid_at IS NOT NULL
      GROUP BY 1,2 ORDER BY 1,2
    `);
    console.log("  월별 (paid_at 기준):");
    for (const r of monthly.rows) console.log(`    ${r.ym} / ${r.vendor_id}: ${r.cnt}건`);
  } catch (e) {
    console.log("  paid_at 컬럼 없음 — 다른 날짜 컬럼 확인:");
  }

  console.log("\n=== tb_coupang_orders_rg 샘플 1건 ===");
  const samp = await queryPg(`SELECT * FROM public.tb_coupang_orders_rg LIMIT 1`);
  console.log(JSON.stringify(samp.rows[0], null, 2));

  console.log("\n=== tb_coupang_orders_mp 행수 + 월별 ===");
  const cnt2 = await queryPg(`SELECT COUNT(*) FROM public.tb_coupang_orders_mp`);
  console.log("  총 행수:", cnt2.rows[0]);
  const cols2 = await queryPg(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='tb_coupang_orders_mp' ORDER BY ordinal_position`);
  console.log("  컬럼:", cols2.rows.map((r: any) => r.column_name).join(", "));

  // mp 월별
  try {
    const mp_monthly = await queryPg(`
      SELECT SUBSTR(paid_at::text,1,7) ym, vendor_id, COUNT(*) cnt
      FROM public.tb_coupang_orders_mp
      WHERE paid_at IS NOT NULL
      GROUP BY 1,2 ORDER BY 1,2
    `);
    console.log("  월별 (paid_at):");
    for (const r of mp_monthly.rows) console.log(`    ${r.ym} / ${r.vendor_id}: ${r.cnt}건`);
  } catch (e: any) {
    console.log("  paid_at 없음:", e.message);
  }

  console.log("\n=== 두 테이블의 synced_at (최근 적재) ===");
  try {
    const s1 = await queryPg(`SELECT MAX(synced_at) AS last_rg FROM public.tb_coupang_orders_rg`);
    const s2 = await queryPg(`SELECT MAX(synced_at) AS last_mp FROM public.tb_coupang_orders_mp`);
    console.log("  rg last synced:", s1.rows[0]);
    console.log("  mp last synced:", s2.rows[0]);
  } catch (e: any) {
    console.log("  synced_at 없음");
  }
})().catch(e => console.error(e.message || e));
