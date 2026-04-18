import "dotenv/config";
import { queryPg } from "../src/postgres";

const main = async () => {
  // 1. shop_name distribution (채널 분포)
  const shopRes = await queryPg<{ shop_name: string; n: string }>(`
    SELECT shop_name, COUNT(*)::text AS n
    FROM public.tb_playauto_orders
    GROUP BY shop_name
    ORDER BY COUNT(*) DESC
    LIMIT 30
  `);
  console.log("## shop_name distribution (top 30)");
  for (const r of shopRes.rows) console.log(`  ${r.shop_name}: ${r.n}`);

  // 2. imweb/자사몰 후보 필터
  const imwebRes = await queryPg<{ shop_name: string; n: string }>(`
    SELECT shop_name, COUNT(*)::text AS n
    FROM public.tb_playauto_orders
    WHERE shop_name ILIKE '%imweb%' OR shop_name ILIKE '%자사몰%' OR shop_name ILIKE '%biocom%'
      OR shop_name ILIKE '%아임웹%' OR shop_name ILIKE '%바이오컴%' OR shop_name ILIKE '%커피%'
      OR shop_name ILIKE '%clean%' OR shop_name ILIKE '%coffee%'
    GROUP BY shop_name
    ORDER BY COUNT(*) DESC
  `);
  console.log("\n## imweb/biocom-like shop_name");
  for (const r of imwebRes.rows) console.log(`  ${r.shop_name}: ${r.n}`);

  // 3. 샘플 row — imweb 후보에서 3개
  const sampleRes = await queryPg<Record<string, unknown>>(`
    SELECT shop_name, shop_ord_no, shop_sale_name, shop_opt_name, sale_cnt, pay_amt, order_htel, ord_time
    FROM public.tb_playauto_orders
    WHERE shop_name ILIKE '%imweb%' OR shop_name ILIKE '%자사몰%' OR shop_name ILIKE '%biocom%'
      OR shop_name ILIKE '%아임웹%' OR shop_name ILIKE '%바이오컴%'
    ORDER BY ord_time DESC
    LIMIT 5
  `);
  console.log("\n## imweb-candidate sample rows");
  for (const r of sampleRes.rows) console.log(JSON.stringify(r));

  // 4. join test — VM imweb_orders.order_no와 tb_playauto_orders.shop_ord_no 매치 가능성
  // 로컬 SQLite imweb_orders에서 최근 biocom order_no 10개 뽑기 → Postgres shop_ord_no 존재 여부 확인
  const Database = (await import("better-sqlite3")).default;
  const path = (await import("path")).default;
  const dbPath = path.resolve(__dirname, "..", "data", "crm.sqlite3");
  const db = new Database(dbPath, { readonly: true });
  const recent = db.prepare(`
    SELECT order_no FROM imweb_orders
    WHERE site = 'biocom'
    ORDER BY order_time DESC
    LIMIT 10
  `).all() as Array<{ order_no: string }>;
  const orderNos = recent.map((r) => r.order_no);
  db.close();

  console.log(`\n## biocom order_no samples (SQLite): ${orderNos.slice(0, 3).join(", ")}...`);

  if (orderNos.length > 0) {
    const placeholders = orderNos.map((_, i) => `$${i + 1}`).join(",");
    const matchRes = await queryPg<{
      shop_ord_no: string;
      shop_name: string;
      shop_sale_name: string;
      shop_opt_name: string;
      pay_amt: string;
    }>(
      `SELECT shop_ord_no, shop_name, shop_sale_name, shop_opt_name, pay_amt
       FROM public.tb_playauto_orders
       WHERE shop_ord_no IN (${placeholders})`,
      orderNos,
    );
    console.log(`\n## match count: ${matchRes.rows.length} / ${orderNos.length}`);
    for (const r of matchRes.rows.slice(0, 5)) console.log(JSON.stringify(r));
  }

  // 5. 기간 커버리지
  const rangeRes = await queryPg<{
    earliest: string;
    latest: string;
    n: string;
  }>(`
    SELECT MIN(ord_time) AS earliest, MAX(ord_time) AS latest, COUNT(*)::text AS n
    FROM public.tb_playauto_orders
  `);
  console.log("\n## tb_playauto_orders total range");
  console.log(JSON.stringify(rangeRes.rows[0]));

  process.exit(0);
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
