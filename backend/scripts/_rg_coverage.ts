import { queryPg } from "../src/postgres";
(async () => {
  console.log("=== tb_coupang_orders_rg paid_at 실제 포맷 ===");
  const s = await queryPg(`SELECT paid_at, length(paid_at) len FROM public.tb_coupang_orders_rg WHERE paid_at IS NOT NULL LIMIT 5`);
  for (const r of s.rows) console.log(`  len=${r.len} · paid_at=${r.paid_at}`);

  console.log("\n=== 월별 (to_timestamp 변환) ===");
  try {
    const mo = await queryPg(`
      SELECT to_char(to_timestamp(paid_at::bigint/1000),'YYYY-MM') ym,
             vendor_id,
             COUNT(*) cnt,
             SUM(sales_quantity * unit_sales_price)::bigint gross
      FROM public.tb_coupang_orders_rg
      WHERE paid_at IS NOT NULL AND paid_at ~ '^[0-9]+$'
      GROUP BY 1,2 ORDER BY 1,2
    `);
    for (const r of mo.rows) console.log(`  ${r.ym} / ${r.vendor_id}: ${r.cnt}건 · gross ₩${Number(r.gross).toLocaleString()}`);
  } catch (e: any) {
    console.log("  bigint 변환 실패:", e.message);
  }

  console.log("\n=== TEAMKETO RG 존재 여부 ===");
  const tk = await queryPg(`SELECT vendor_id, COUNT(*) c FROM public.tb_coupang_orders_rg GROUP BY 1`);
  for (const r of tk.rows) console.log(`  ${r.vendor_id}: ${r.c}건`);

  console.log("\n=== tb_coupang_orders_mp 월별 ===");
  try {
    const mo2 = await queryPg(`
      SELECT to_char(to_timestamp(paid_at::bigint/1000),'YYYY-MM') ym,
             vendor_id,
             COUNT(*) cnt
      FROM public.tb_coupang_orders_mp
      WHERE paid_at IS NOT NULL AND paid_at ~ '^[0-9]+$'
      GROUP BY 1,2 ORDER BY 1,2
    `);
    for (const r of mo2.rows) console.log(`  ${r.ym} / ${r.vendor_id}: ${r.cnt}건`);
  } catch (e: any) {
    console.log("  변환 실패 (paid_at ISO 문자열 가능?):", e.message);
    const samp = await queryPg(`SELECT paid_at FROM public.tb_coupang_orders_mp WHERE paid_at IS NOT NULL LIMIT 3`);
    for (const r of samp.rows) console.log(`    sample: ${r.paid_at}`);
  }

  console.log("\n=== tb_coupang_orders_mp 전체 요약 ===");
  const mp_total = await queryPg(`SELECT vendor_id, COUNT(*) c FROM public.tb_coupang_orders_mp GROUP BY 1`);
  for (const r of mp_total.rows) console.log(`  ${r.vendor_id}: ${r.c}건`);

  console.log("\n=== sync 상태 (최근 데이터 시점) ===");
  const rg_sync = await queryPg(`SELECT MAX(synced_at) last_sync, MIN(synced_at) first_sync FROM public.tb_coupang_orders_rg`);
  const mp_sync = await queryPg(`SELECT MAX(synced_at) last_sync, MIN(synced_at) first_sync FROM public.tb_coupang_orders_mp`);
  console.log("  rg:", rg_sync.rows[0]);
  console.log("  mp:", mp_sync.rows[0]);
})().catch(e => console.error(e.message || e));
