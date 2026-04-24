import "dotenv/config";
import { queryPg } from "../src/postgres";

/*
 * tb_iamweb_users가 주문×라인 단위인지 주문 단위인지 확인.
 * 같은 order_number에서 final_order_amount / paid_price / total_price가
 * 라인마다 다른지, 한 번만 기록되는지 본다.
 */

const main = async () => {
  // 1. 한 주문에 여러 row가 있는 경우 샘플
  const sampleRes = await queryPg<{
    order_number: string;
    row_count: string;
    sum_final: string;
    sum_paid: string;
    sum_total: string;
    min_paid: string;
    max_paid: string;
    min_final: string;
    max_final: string;
  }>(
    `SELECT order_number,
            COUNT(*)::text AS row_count,
            SUM(final_order_amount)::text AS sum_final,
            SUM(paid_price)::text AS sum_paid,
            SUM(total_price)::text AS sum_total,
            MIN(paid_price)::text AS min_paid,
            MAX(paid_price)::text AS max_paid,
            MIN(final_order_amount)::text AS min_final,
            MAX(final_order_amount)::text AS max_final
     FROM public.tb_iamweb_users
     WHERE order_date::text >= '2026-01-01' AND order_date::text < '2026-01-08'
     GROUP BY order_number
     HAVING COUNT(*) > 1
     ORDER BY COUNT(*) DESC
     LIMIT 5`,
  );
  console.log("## multi-row orders (top 5)");
  for (const r of sampleRes.rows) {
    console.log(JSON.stringify(r));
  }

  // 2. 한 row만 있는 주문 샘플
  const singleRes = await queryPg<Record<string, unknown>>(
    `SELECT order_number, paid_price, final_order_amount, total_price
     FROM public.tb_iamweb_users
     WHERE order_date::text >= '2026-01-01' AND order_date::text < '2026-01-08'
     LIMIT 5`,
  );
  console.log("\n## sample rows");
  for (const r of singleRes.rows) console.log(JSON.stringify(r));

  // 3. 1월 1-7일 주문번호 distinct 수
  const distinctRes = await queryPg<{ n: string; rows: string }>(
    `SELECT COUNT(DISTINCT order_number)::text AS n,
            COUNT(*)::text AS rows
     FROM public.tb_iamweb_users
     WHERE order_date::text >= '2026-01-01' AND order_date::text < '2026-01-08'`,
  );
  console.log(`\n## Jan 1-7 distinct orders: ${distinctRes.rows[0]?.n}, total rows: ${distinctRes.rows[0]?.rows}`);
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
