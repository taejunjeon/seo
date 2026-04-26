import { queryPg } from "../src/postgres";
(async () => {
  console.log("═══ BIOCOM RG 상품 Top (2026-03 · 원격 PG tb_coupang_orders_rg) ═══");
  const q = await queryPg(`
    SELECT product_name, COUNT(*) cnt, SUM(sales_quantity::bigint * unit_sales_price::bigint) gross
    FROM public.tb_coupang_orders_rg
    WHERE vendor_id='A00668577'
      AND paid_at IS NOT NULL AND paid_at ~ '^[0-9]+$'
      AND to_timestamp(paid_at::bigint/1000) >= '2026-03-01'
      AND to_timestamp(paid_at::bigint/1000) < '2026-04-01'
    GROUP BY product_name ORDER BY 3 DESC LIMIT 10
  `);
  for (const r of q.rows) console.log(`  ${r.product_name}: ${r.cnt}건 · ₩${Number(r.gross).toLocaleString()}`);

  console.log("\n═══ BIOCOM RG 상품 카테고리 분포 · 2025-12 vs 2026-03 ═══");
  for (const ym of ["2025-12", "2026-03"]) {
    const range = ym === "2025-12"
      ? { from: "2025-12-01", to: "2026-01-01", src: "로컬 SQLite" }
      : { from: "2026-03-01", to: "2026-04-01", src: "원격 PG" };
    const isCoffee = /커피|콜롬비아|에티오피아|과테말라|케냐|디카페인|드립백|원두|수프레모|예가체프|더클린/;
    const isSupplement = /뉴로마스터|바이오밸런스|당당케어|썬화이버|메타드림|다래케어|풍성밸런스|클린밸런스|멜라토닌|오메가|마그네슘|프로바이오|구아검|영데이즈|리셋데이/;

    if (ym === "2026-03") {
      const all = await queryPg(`
        SELECT product_name, SUM(sales_quantity::bigint * unit_sales_price::bigint)::text gross
        FROM public.tb_coupang_orders_rg
        WHERE vendor_id='A00668577' AND paid_at IS NOT NULL AND paid_at ~ '^[0-9]+$'
          AND to_timestamp(paid_at::bigint/1000) >= '${range.from}' AND to_timestamp(paid_at::bigint/1000) < '${range.to}'
        GROUP BY product_name
      `);
      let coffee = 0, sup = 0, other = 0;
      for (const r of all.rows) {
        const g = Number(r.gross);
        if (isCoffee.test(r.product_name)) coffee += g;
        else if (isSupplement.test(r.product_name)) sup += g;
        else other += g;
      }
      const total = coffee + sup + other;
      console.log(`  ${ym} [${range.src}]: 커피 ₩${coffee.toLocaleString()} (${(coffee/total*100).toFixed(1)}%) · 건기식 ₩${sup.toLocaleString()} (${(sup/total*100).toFixed(1)}%) · 기타 ₩${other.toLocaleString()} (${(other/total*100).toFixed(1)}%)`);
    }
  }
})().catch(e => console.error(e.message || e));
