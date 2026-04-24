import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { BetaAnalyticsDataClient } from "@google-analytics/data";
import { Client as PgClient } from "pg";

dotenv.config({ path: path.resolve(process.cwd(), "backend/.env") });

/** v137 publish (2026-04-21 01:40 KST) 효과 검증 */

const propertyId = process.env.GA4_BIOCOM_PROPERTY_ID;
const saRaw = process.env.GA4_BIOCOM_SERVICE_ACCOUNT_KEY;
if (!propertyId || !saRaw) throw new Error("env missing");
const ga = new BetaAnalyticsDataClient({ credentials: JSON.parse(saRaw) });
const PROPERTY = `properties/${propertyId}`;
const START = "2026-04-15";
const END = "2026-04-21";

const num = (v?: string | null) => Number(v ?? 0);

const main = async () => {
  const out: any = { meta: { property: propertyId, start: START, end: END, generated_at_kst: new Date().toISOString() } };

  // 1) daily purchase
  const [daily] = await ga.runReport({
    property: PROPERTY,
    dateRanges: [{ startDate: START, endDate: END }],
    dimensions: [{ name: "date" }],
    metrics: [
      { name: "eventCount" },
      { name: "purchaseRevenue" },
      { name: "totalRevenue" },
      { name: "transactions" },
    ],
    dimensionFilter: { filter: { fieldName: "eventName", stringFilter: { matchType: "EXACT", value: "purchase" } } },
    orderBys: [{ dimension: { dimensionName: "date" } }],
  });
  out.daily_purchase = (daily.rows ?? []).map((r) => ({
    date: r.dimensionValues?.[0]?.value,
    event_count: num(r.metricValues?.[0]?.value),
    purchase_revenue: num(r.metricValues?.[1]?.value),
    total_revenue: num(r.metricValues?.[2]?.value),
    transactions: num(r.metricValues?.[3]?.value),
  }));

  // 2) tx 단위 (date, transactionId) → not_set / zero_value 집계
  const [txLevel] = await ga.runReport({
    property: PROPERTY,
    dateRanges: [{ startDate: START, endDate: END }],
    dimensions: [{ name: "date" }, { name: "transactionId" }],
    metrics: [{ name: "eventCount" }, { name: "purchaseRevenue" }],
    dimensionFilter: { filter: { fieldName: "eventName", stringFilter: { matchType: "EXACT", value: "purchase" } } },
    orderBys: [{ dimension: { dimensionName: "date" } }],
    limit: 100000,
  });
  const txByDay: Record<string, any> = {};
  for (const r of txLevel.rows ?? []) {
    const date = r.dimensionValues?.[0]?.value ?? "?";
    const tx = r.dimensionValues?.[1]?.value ?? "";
    const cnt = num(r.metricValues?.[0]?.value);
    const rev = num(r.metricValues?.[1]?.value);
    txByDay[date] ??= {
      total_events: 0,
      distinct_tx: 0,
      not_set_events: 0,
      zero_value_events: 0,
      not_set_tx_count: 0,
      zero_value_tx_count: 0,
      valid_events: 0,
      valid_revenue: 0,
    };
    const b = txByDay[date];
    b.total_events += cnt;
    b.distinct_tx += 1;
    const isNotSet = tx === "(not set)" || tx === "";
    if (isNotSet) {
      b.not_set_events += cnt;
      b.not_set_tx_count += 1;
    }
    if (rev === 0) {
      b.zero_value_events += cnt;
      b.zero_value_tx_count += 1;
    }
    if (!isNotSet && rev > 0) {
      b.valid_events += cnt;
      b.valid_revenue += rev;
    }
  }
  out.tx_level_by_day = Object.entries(txByDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, ...v }));

  // 3) GA4 custom dimension `customEvent:pay_method` 존재 여부 확인 (없으면 오류 반환)
  try {
    const [byPayMethod] = await ga.runReport({
      property: PROPERTY,
      dateRanges: [{ startDate: START, endDate: END }],
      dimensions: [{ name: "date" }, { name: "customEvent:pay_method" }],
      metrics: [{ name: "eventCount" }, { name: "purchaseRevenue" }],
      dimensionFilter: { filter: { fieldName: "eventName", stringFilter: { matchType: "EXACT", value: "purchase" } } },
      orderBys: [{ dimension: { dimensionName: "date" } }],
      limit: 1000,
    });
    out.pay_method_by_day = (byPayMethod.rows ?? []).map((r) => ({
      date: r.dimensionValues?.[0]?.value,
      pay_method: r.dimensionValues?.[1]?.value,
      event_count: num(r.metricValues?.[0]?.value),
      revenue: num(r.metricValues?.[1]?.value),
    }));
  } catch (e: any) {
    out.pay_method_by_day_error = String(e.message).substring(0, 220);
  }

  // 4) GA4 customEvent:order_type or pay_type 대안 시도
  const altDims = ["customEvent:order_type", "customEvent:pay_type", "customEvent:payment_method"];
  out.alt_dims = {};
  for (const dim of altDims) {
    try {
      const [r] = await ga.runReport({
        property: PROPERTY,
        dateRanges: [{ startDate: END, endDate: END }],
        dimensions: [{ name: dim }],
        metrics: [{ name: "eventCount" }],
        dimensionFilter: { filter: { fieldName: "eventName", stringFilter: { matchType: "EXACT", value: "purchase" } } },
        limit: 20,
      });
      out.alt_dims[dim] = (r.rows ?? []).map((x) => ({
        value: x.dimensionValues?.[0]?.value,
        count: num(x.metricValues?.[0]?.value),
      }));
    } catch (e: any) {
      out.alt_dims[dim] = { error: String(e.message).substring(0, 150) };
    }
  }

  // 5) 운영 DB — biocom 주문 (tb_iamweb_users). 일자별 총 주문수/결제완료 주문수/가상계좌 결제수/ vbank WAITING
  const pgUrl = (process.env.DATABASE_URL ?? "").replace(/^postgresql\+asyncpg:\/\//, "postgresql://");
  const pg = new PgClient({ connectionString: pgUrl });
  await pg.connect();

  // payment_method distinct (최근 7일)
  const pmDistinct = await pg.query(`
    SELECT payment_method, payment_status, COUNT(*) AS n
    FROM tb_iamweb_users
    WHERE order_date >= '2026-04-15' AND order_date < '2026-04-22'
    GROUP BY 1, 2
    ORDER BY n DESC
    LIMIT 60
  `);
  out.pg_pay_method_status = pmDistinct.rows;

  // 일자별 payment_method 집계. payment_method 값이 한국어일 수 있어서 가상계좌 텍스트 포함 여부 체크.
  const dailyPg = await pg.query(`
    SELECT
      LEFT(order_date, 10) AS d,
      COUNT(*) AS total_rows,
      COUNT(DISTINCT order_number) AS distinct_orders,
      SUM(CASE WHEN payment_method ILIKE '%가상계좌%' OR payment_method ILIKE '%vbank%' THEN 1 ELSE 0 END) AS vbank_rows,
      COUNT(DISTINCT CASE WHEN payment_method ILIKE '%가상계좌%' OR payment_method ILIKE '%vbank%' THEN order_number END) AS vbank_orders,
      COUNT(DISTINCT CASE WHEN (payment_method ILIKE '%가상계좌%' OR payment_method ILIKE '%vbank%') AND payment_status NOT ILIKE '%완료%' AND payment_status NOT ILIKE '%확정%' THEN order_number END) AS vbank_pending_orders,
      COUNT(DISTINCT CASE WHEN payment_status ILIKE '%결제완료%' OR payment_status ILIKE '%구매확정%' THEN order_number END) AS paid_orders,
      SUM(CASE WHEN payment_status ILIKE '%결제완료%' OR payment_status ILIKE '%구매확정%' THEN paid_price ELSE 0 END) AS paid_sum
    FROM tb_iamweb_users
    WHERE order_date >= '2026-04-15' AND order_date < '2026-04-22'
    GROUP BY 1
    ORDER BY 1
  `);
  out.pg_daily_biocom = dailyPg.rows;

  await pg.end();

  const outputPath = path.resolve(process.cwd(), "backend/scripts/verify-ga4-v137-effect.out.json");
  fs.writeFileSync(outputPath, JSON.stringify(out, null, 2));
  console.log("WROTE", outputPath);
  console.log(JSON.stringify(out, null, 2));
};

main().catch((e) => {
  console.error("FATAL:", e.message);
  process.exit(1);
});
