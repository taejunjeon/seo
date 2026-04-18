import "dotenv/config";
import { queryPg, isDatabaseConfigured } from "../src/postgres";

const main = async () => {
  if (!isDatabaseConfigured()) {
    console.log(JSON.stringify({ error: "DATABASE_URL not configured" }));
    return;
  }

  // 1. 상품/품목/주문아이템 관련 테이블 이름 찾기
  const tablesRes = await queryPg<{ schemaname: string; tablename: string }>(`
    SELECT schemaname, tablename
    FROM pg_catalog.pg_tables
    WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
      AND (
        tablename ILIKE '%item%'
        OR tablename ILIKE '%product%'
        OR tablename ILIKE '%order%'
        OR tablename ILIKE '%prod%'
        OR tablename ILIKE '%goods%'
      )
    ORDER BY schemaname, tablename
  `);
  console.log("## candidate tables");
  for (const row of tablesRes.rows) {
    console.log(`- ${row.schemaname}.${row.tablename}`);
  }

  // 2. 각 테이블 row count + 컬럼 샘플
  const topCandidates = tablesRes.rows.slice(0, 30);
  console.log("\n## row counts + key columns");
  for (const { schemaname, tablename } of topCandidates) {
    try {
      const countRes = await queryPg<{ n: string }>(
        `SELECT COUNT(*)::text AS n FROM ${schemaname}.${tablename}`,
      );
      const colsRes = await queryPg<{ column_name: string; data_type: string }>(
        `SELECT column_name, data_type FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2 ORDER BY ordinal_position LIMIT 40`,
        [schemaname, tablename],
      );
      const cols = colsRes.rows.map((c) => `${c.column_name}:${c.data_type}`).join(", ");
      console.log(`- ${schemaname}.${tablename} n=${countRes.rows[0]?.n} cols=[${cols}]`);
    } catch (err) {
      console.log(`- ${schemaname}.${tablename} ERR ${(err as Error).message}`);
    }
  }

  // 3. 가장 유망한 "주문-상품 라인" 테이블 식별 (order_no 또는 order_code + product 관련 컬럼)
  console.log("\n## order-item line candidates (has order_no/order_code AND product/item/name column)");
  for (const { schemaname, tablename } of topCandidates) {
    try {
      const res = await queryPg<{ column_name: string }>(
        `SELECT column_name FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2`,
        [schemaname, tablename],
      );
      const cols = new Set(res.rows.map((r) => r.column_name.toLowerCase()));
      const hasOrderKey = ["order_no", "order_code", "order_id", "order_key"].some((c) => cols.has(c));
      const hasProductName = [
        "item_name",
        "product_name",
        "prod_name",
        "name",
        "goods_name",
        "title",
      ].some((c) => cols.has(c));
      if (hasOrderKey && hasProductName) {
        console.log(`  ★ ${schemaname}.${tablename}`);
      }
    } catch {}
  }

  // 4. 샘플 row 2개씩: 유망 테이블만
  console.log("\n## sample rows from most-promising table (tb_imweb_order_items or similar)");
  const likely = tablesRes.rows.filter((r) => {
    const n = r.tablename.toLowerCase();
    return (
      n.includes("order") &&
      (n.includes("item") || n.includes("prod") || n.includes("goods"))
    );
  });
  for (const { schemaname, tablename } of likely.slice(0, 5)) {
    try {
      const res = await queryPg(
        `SELECT * FROM ${schemaname}.${tablename} ORDER BY 1 DESC LIMIT 2`,
      );
      console.log(`\n### ${schemaname}.${tablename}`);
      for (const row of res.rows) {
        const short = Object.fromEntries(
          Object.entries(row).map(([k, v]) => [
            k,
            typeof v === "string" && v.length > 80 ? v.slice(0, 80) + "..." : v,
          ]),
        );
        console.log(JSON.stringify(short));
      }
    } catch (err) {
      console.log(`\n### ${schemaname}.${tablename} ERR ${(err as Error).message}`);
    }
  }

  process.exit(0);
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
