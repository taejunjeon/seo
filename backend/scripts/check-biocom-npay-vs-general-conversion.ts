import path from "node:path";
import dotenv from "dotenv";
import { BetaAnalyticsDataClient } from "@google-analytics/data";

dotenv.config({ path: path.resolve(process.cwd(), "backend/.env") });

// biocom GA4 Data API — 최근 30일 카테고리별 view_item → purchase 전환율 + pay_method 별 purchase 분포
// 2026-04-22. TJ 질문: "일반 구매하기 전환율?" + "6개월 NPay vs 일반 숫자"

const PROPERTY_ID = "304759974";

const sa = JSON.parse(process.env.GA4_BIOCOM_SERVICE_ACCOUNT_KEY || "{}");
const client = new BetaAnalyticsDataClient({
  credentials: { client_email: sa.client_email, private_key: sa.private_key },
});

type Row = Record<string, string | number>;
const runReport = async (req: any): Promise<Row[]> => {
  const [resp] = await client.runReport({ property: `properties/${PROPERTY_ID}`, ...req });
  return (resp.rows || []).map((r: any) => {
    const o: Row = {};
    const dims = r.dimensionValues?.map((d: any) => d.value) || [];
    const mets = r.metricValues?.map((m: any) => m.value) || [];
    (req.dimensions || []).forEach((d: any, i: number) => { o[d.name] = dims[i] || ""; });
    (req.metrics || []).forEach((m: any, i: number) => { o[m.name] = Number(mets[i] || 0); });
    return o;
  });
};

const D30 = { startDate: "30daysAgo", endDate: "today" };
const D180 = { startDate: "180daysAgo", endDate: "today" };

const main = async () => {
  console.log("=== biocom GA4 property 304759974 — NPay vs 일반 구매 분석 ===");
  console.log("");

  // 1) 최근 30일 purchase pay_method 분포 (custom event parameter 가정)
  // GA4 Admin 에 pay_method 가 custom dimension 등록되어 있어야 함. 없으면 '(not set)'.
  console.log(`[1] 최근 30일 purchase pay_method 분포 (customEvent:pay_method)`);
  try {
    const rows = await runReport({
      dateRanges: [D30],
      dimensions: [{ name: "customEvent:pay_method" }],
      metrics: [{ name: "eventCount" }, { name: "totalRevenue" }],
      dimensionFilter: {
        filter: { fieldName: "eventName", stringFilter: { value: "purchase" } },
      },
      orderBys: [{ metric: { metricName: "eventCount" }, desc: true }],
      limit: 20,
    });
    console.log(`  ${"pay_method".padEnd(20)} ${"events".padStart(8)} ${"revenue".padStart(15)}`);
    for (const r of rows) {
      console.log(`  ${String(r["customEvent:pay_method"]).padEnd(20)} ${String(r.eventCount).padStart(8)} ${String(r.totalRevenue).padStart(15)}`);
    }
  } catch (e: any) {
    console.log(`  ❌ customEvent:pay_method 차원 실패: ${e.message.substring(0, 200)}`);
    console.log(`     → pay_method 가 GA4 Admin 에 Custom Definition 으로 등록 안 되어 있을 가능성`);
  }

  // 2) 최근 30일 page_location 별 view_item + purchase event counts
  console.log(`\n[2] 최근 30일 카테고리별 view_item / purchase event (pageLocation)`);
  const catPatterns = [
    { label: "HealthFood (영양제)", contains: "/HealthFood/" },
    { label: "DietMealBox (도시락)", contains: "/DietMealBox/" },
    { label: "biocomset_store (세트)", contains: "/biocomset_store/" },
    { label: "subscription (정기구독)", contains: "/subscription/" },
    { label: "shop_view (영양제 뷰)", contains: "/shop_view/" },
    { label: "igg_store (음식물과민증)", contains: "/igg_store/" },
    { label: "mineraltest_store (미네랄검사)", contains: "/mineraltest_store/" },
    { label: "organicacid_store (유기산)", contains: "/organicacid_store/" },
    { label: "microbiome (마이크로바이옴)", contains: "/microbiome/" },
    { label: "hormon_store (호르몬)", contains: "/hormon_store/" },
    { label: "shop_payment_complete (결제완료)", contains: "/shop_payment_complete" },
  ];

  const catResult: Array<{ label: string; contains: string; view_item: number; purchase: number; users: number; conversion_pct: number }> = [];
  for (const c of catPatterns) {
    try {
      const rows = await runReport({
        dateRanges: [D30],
        dimensions: [{ name: "eventName" }],
        metrics: [{ name: "eventCount" }, { name: "totalUsers" }],
        dimensionFilter: {
          andGroup: {
            expressions: [
              { filter: { fieldName: "pageLocation", stringFilter: { value: c.contains, matchType: "CONTAINS" } } },
              { filter: { fieldName: "eventName", inListFilter: { values: ["view_item", "purchase"] } } },
            ],
          },
        },
      });
      const viewItem = Number(rows.find((r) => r.eventName === "view_item")?.eventCount || 0);
      const purchase = Number(rows.find((r) => r.eventName === "purchase")?.eventCount || 0);
      const users = Number(rows.find((r) => r.eventName === "view_item")?.totalUsers || 0);
      catResult.push({
        label: c.label,
        contains: c.contains,
        view_item: viewItem,
        purchase,
        users,
        conversion_pct: viewItem > 0 ? Math.round((purchase / viewItem) * 10000) / 100 : 0,
      });
    } catch (e: any) {
      catResult.push({ label: c.label, contains: c.contains, view_item: -1, purchase: -1, users: 0, conversion_pct: 0 });
    }
  }

  console.log(`  ${"category".padEnd(30)} ${"view_item".padStart(10)} ${"purchase".padStart(10)} ${"users".padStart(8)} ${"conv %".padStart(8)}`);
  console.log("  " + "-".repeat(78));
  for (const r of catResult) {
    console.log(`  ${r.label.padEnd(30)} ${String(r.view_item).padStart(10)} ${String(r.purchase).padStart(10)} ${String(r.users).padStart(8)} ${(r.conversion_pct + "%").padStart(8)}`);
  }

  // 3) 전체 사이트 세션 기준 전환율 (참고)
  console.log(`\n[3] 최근 30일 전체 사이트 세션/전환율 지표`);
  try {
    const rows = await runReport({
      dateRanges: [D30],
      metrics: [
        { name: "sessions" },
        { name: "activeUsers" },
        { name: "transactions" },
        { name: "purchaseRevenue" },
        { name: "sessionConversionRate" },
      ],
    });
    for (const r of rows) {
      console.log(`  sessions            : ${Number(r.sessions).toLocaleString()}`);
      console.log(`  activeUsers         : ${Number(r.activeUsers).toLocaleString()}`);
      console.log(`  transactions        : ${Number(r.transactions).toLocaleString()}`);
      console.log(`  purchaseRevenue     : ₩${Number(r.purchaseRevenue).toLocaleString()}`);
      console.log(`  sessionConversionRate: ${(Number(r.sessionConversionRate) * 100).toFixed(3)}%`);
    }
  } catch (e: any) {
    console.log(`  ❌ ${e.message.substring(0, 150)}`);
  }
};

main().catch((e) => { console.error("FATAL:", e.message); process.exit(1); });
