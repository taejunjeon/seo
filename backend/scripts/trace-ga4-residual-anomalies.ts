import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { BetaAnalyticsDataClient } from "@google-analytics/data";
import { Client as PgClient } from "pg";

dotenv.config({ path: path.resolve(process.cwd(), "backend/.env") });

/**
 * 잔여 이상치 역추적 스크립트.
 *  대상: biocom GA4 `304759974` 2026-04-21 purchase 이벤트
 *   - transaction_id == (not set)  … 5건
 *   - pay_method == ""             … 9건
 *
 *  목적:
 *   1. 각 이상치의 transactionId / pagePath / deviceCategory / hostname / streamId 수집
 *   2. pay_method == "" 행의 transactionId 확보 후 운영 DB tb_iamweb_users.order_number 매칭
 *   3. transaction_id == (not set) 이벤트의 컨텍스트(페이지, 디바이스, 소스) 수집
 */

const propertyId = process.env.GA4_BIOCOM_PROPERTY_ID;
const saRaw = process.env.GA4_BIOCOM_SERVICE_ACCOUNT_KEY;
if (!propertyId || !saRaw) throw new Error("env missing");
const ga = new BetaAnalyticsDataClient({ credentials: JSON.parse(saRaw) });
const PROPERTY = `properties/${propertyId}`;
const DAY = "2026-04-21";

const num = (v?: string | null) => Number(v ?? 0);
const s = (v?: string | null) => v ?? "";

const purchaseFilter = {
  filter: { fieldName: "eventName", stringFilter: { matchType: "EXACT" as const, value: "purchase" } },
};

const main = async () => {
  const out: any = { meta: { property: propertyId, day: DAY, generated_at: new Date().toISOString() } };

  // ──────────────────────────────────────────────────────────────
  // [1] pay_method × transactionId → pay_method="" 9건의 transactionId 확보
  // ──────────────────────────────────────────────────────────────
  const [q1] = await ga.runReport({
    property: PROPERTY,
    dateRanges: [{ startDate: DAY, endDate: DAY }],
    dimensions: [
      { name: "customEvent:pay_method" },
      { name: "transactionId" },
    ],
    metrics: [{ name: "eventCount" }, { name: "purchaseRevenue" }],
    dimensionFilter: purchaseFilter,
    orderBys: [{ dimension: { dimensionName: "customEvent:pay_method" } }],
    limit: 500,
  });
  out.pay_method_x_tx = (q1.rows ?? []).map((r) => ({
    pay_method: s(r.dimensionValues?.[0]?.value),
    transactionId: s(r.dimensionValues?.[1]?.value),
    event_count: num(r.metricValues?.[0]?.value),
    revenue: num(r.metricValues?.[1]?.value),
  }));

  const emptyPayTxs = out.pay_method_x_tx
    .filter((r: any) => r.pay_method === "")
    .map((r: any) => r.transactionId);
  const notSetTxMarker = out.pay_method_x_tx.filter((r: any) => r.transactionId === "(not set)" || r.transactionId === "");

  out.summary_pay_method_empty = {
    count_rows: emptyPayTxs.length,
    tx_ids: emptyPayTxs,
  };
  out.summary_not_set_marker_from_q1 = notSetTxMarker;

  // ──────────────────────────────────────────────────────────────
  // [2] transactionId=(not set) 이벤트의 컨텍스트 (pagePath + deviceCategory + hostname)
  //   주의: transactionId dimension filter로 (not set) 값을 지정하면 Data API 가 빈결과 줄 수 있음.
  //   → 먼저 pagePath × transactionId 조합을 받아 transactionId in (""/"(not set)") row 만 수집.
  // ──────────────────────────────────────────────────────────────
  const [q2] = await ga.runReport({
    property: PROPERTY,
    dateRanges: [{ startDate: DAY, endDate: DAY }],
    dimensions: [
      { name: "transactionId" },
      { name: "pagePath" },
      { name: "deviceCategory" },
      { name: "hostName" },
    ],
    metrics: [{ name: "eventCount" }, { name: "purchaseRevenue" }],
    dimensionFilter: purchaseFilter,
    limit: 1000,
  });
  const notSetContext = (q2.rows ?? [])
    .map((r) => ({
      transactionId: s(r.dimensionValues?.[0]?.value),
      pagePath: s(r.dimensionValues?.[1]?.value),
      deviceCategory: s(r.dimensionValues?.[2]?.value),
      hostName: s(r.dimensionValues?.[3]?.value),
      event_count: num(r.metricValues?.[0]?.value),
      revenue: num(r.metricValues?.[1]?.value),
    }))
    .filter((r) => r.transactionId === "" || r.transactionId === "(not set)");
  out.not_set_context = notSetContext;

  // ──────────────────────────────────────────────────────────────
  // [3] transactionId=(not set) × sessionSource / sessionMedium / sessionCampaign
  // ──────────────────────────────────────────────────────────────
  const [q3] = await ga.runReport({
    property: PROPERTY,
    dateRanges: [{ startDate: DAY, endDate: DAY }],
    dimensions: [
      { name: "transactionId" },
      { name: "sessionSource" },
      { name: "sessionMedium" },
      { name: "sessionCampaignName" },
    ],
    metrics: [{ name: "eventCount" }, { name: "purchaseRevenue" }],
    dimensionFilter: purchaseFilter,
    limit: 1000,
  });
  out.not_set_session_source = (q3.rows ?? [])
    .map((r) => ({
      transactionId: s(r.dimensionValues?.[0]?.value),
      sessionSource: s(r.dimensionValues?.[1]?.value),
      sessionMedium: s(r.dimensionValues?.[2]?.value),
      sessionCampaignName: s(r.dimensionValues?.[3]?.value),
      event_count: num(r.metricValues?.[0]?.value),
      revenue: num(r.metricValues?.[1]?.value),
    }))
    .filter((r) => r.transactionId === "" || r.transactionId === "(not set)");

  // ──────────────────────────────────────────────────────────────
  // [4] transactionId × streamId + customEvent:pay_type (어느 GA4 property stream이 쏜 것인지)
  //   biocom GA4 는 G-WJFXN5E2Q1 + G-8GZ48B1S59 (paused) 두 개가 GTM 에 있음
  // ──────────────────────────────────────────────────────────────
  try {
    const [q4] = await ga.runReport({
      property: PROPERTY,
      dateRanges: [{ startDate: DAY, endDate: DAY }],
      dimensions: [
        { name: "transactionId" },
        { name: "streamId" },
        { name: "streamName" },
      ],
      metrics: [{ name: "eventCount" }],
      dimensionFilter: purchaseFilter,
      limit: 500,
    });
    out.tx_by_stream = (q4.rows ?? []).map((r) => ({
      transactionId: s(r.dimensionValues?.[0]?.value),
      streamId: s(r.dimensionValues?.[1]?.value),
      streamName: s(r.dimensionValues?.[2]?.value),
      event_count: num(r.metricValues?.[0]?.value),
    }));
  } catch (e: any) {
    out.tx_by_stream_error = String(e.message).substring(0, 200);
  }

  // ──────────────────────────────────────────────────────────────
  // [5] pay_method="" 의 pagePath + deviceCategory
  // ──────────────────────────────────────────────────────────────
  const [q5] = await ga.runReport({
    property: PROPERTY,
    dateRanges: [{ startDate: DAY, endDate: DAY }],
    dimensions: [
      { name: "customEvent:pay_method" },
      { name: "pagePath" },
      { name: "deviceCategory" },
    ],
    metrics: [{ name: "eventCount" }, { name: "purchaseRevenue" }],
    dimensionFilter: purchaseFilter,
    limit: 500,
  });
  out.pay_method_empty_context = (q5.rows ?? [])
    .map((r) => ({
      pay_method: s(r.dimensionValues?.[0]?.value),
      pagePath: s(r.dimensionValues?.[1]?.value),
      deviceCategory: s(r.dimensionValues?.[2]?.value),
      event_count: num(r.metricValues?.[0]?.value),
      revenue: num(r.metricValues?.[1]?.value),
    }))
    .filter((r) => r.pay_method === "");

  // ──────────────────────────────────────────────────────────────
  // [6] 운영 DB 매칭 — emptyPayTxs 및 2번에서 모인 정상 transactionId 20개 샘플
  // ──────────────────────────────────────────────────────────────
  const pgUrl = (process.env.DATABASE_URL ?? "").replace(/^postgresql\+asyncpg:\/\//, "postgresql://");
  const pg = new PgClient({ connectionString: pgUrl });
  await pg.connect();

  if (emptyPayTxs.length > 0) {
    const uniq = Array.from(new Set(emptyPayTxs)).filter((x) => x && x !== "(not set)");
    const r = await pg.query(
      `SELECT order_number, order_date, payment_method, payment_status, paid_price, pg_name, product_name
       FROM tb_iamweb_users
       WHERE order_number = ANY($1::text[])
       ORDER BY order_number`,
      [uniq],
    );
    out.empty_pay_tx_ops_match = {
      queried_ids: uniq,
      matched_rows: r.rows,
      missing: uniq.filter((id) => !r.rows.some((row: any) => row.order_number === id)),
    };
  } else {
    out.empty_pay_tx_ops_match = { queried_ids: [], matched_rows: [], missing: [] };
  }

  // 보너스: 04-21 이날의 운영 DB 전체 주문 리스트 (시각 순)
  const dailyOps = await pg.query(
    `SELECT order_number, order_date, payment_method, payment_status, paid_price, pg_name,
            payment_complete_time, LEFT(product_name, 30) AS product_name_short
     FROM tb_iamweb_users
     WHERE order_date LIKE '2026-04-21%'
     ORDER BY order_date`,
  );
  out.ops_day_04_21_orders = dailyOps.rows;

  await pg.end();

  const outputPath = path.resolve(process.cwd(), "backend/scripts/trace-ga4-residual-anomalies.out.json");
  fs.writeFileSync(outputPath, JSON.stringify(out, null, 2));
  console.log("WROTE", outputPath);
};

main().catch((e) => {
  console.error("FATAL:", e.message);
  process.exit(1);
});
