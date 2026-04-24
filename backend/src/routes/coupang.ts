import { type Request, type Response, Router } from "express";

import { getCrmDb } from "../crmLocalDb";
import { queryPg, isDatabaseConfigured } from "../postgres";

export const createCoupangRouter = () => {
  const router = Router();

  /**
   * 쿠팡 매출 대시보드 · 월별/vendor별/type별 집계 + 이관시점 · Top 상품
   * 소스:
   *  - coupang_settlements_api (로컬 SQLite · 16개월 · 106건)
   *  - tb_coupang_orders (원격 PG · 상품별 집계용 · 2026-02 이후 BIOCOM 건기식)
   */
  router.get("/api/coupang/dashboard", async (_req: Request, res: Response) => {
    try {
      const db = getCrmDb();

      // 1) 월별 vendor × type 피벗
      const monthly = db
        .prepare(
          `
          SELECT
            recognition_year_month AS ym,
            SUM(CASE WHEN vendor_id='A00668577' THEN final_amount ELSE 0 END) AS biocom,
            SUM(CASE WHEN vendor_id='A00963878' THEN final_amount ELSE 0 END) AS teamketo,
            SUM(CASE WHEN vendor_id='A00668577' THEN total_sale ELSE 0 END) AS biocom_gross,
            SUM(CASE WHEN vendor_id='A00963878' THEN total_sale ELSE 0 END) AS teamketo_gross,
            SUM(CASE WHEN settlement_type='WEEKLY' THEN final_amount ELSE 0 END) AS weekly,
            SUM(CASE WHEN settlement_type='RESERVE' THEN final_amount ELSE 0 END) AS reserve,
            COUNT(*) AS rows
          FROM coupang_settlements_api
          GROUP BY recognition_year_month
          ORDER BY recognition_year_month
          `,
        )
        .all();

      // 2) 전체 KPI
      const kpi = db
        .prepare(
          `
          SELECT
            SUM(final_amount) AS total_final,
            SUM(total_sale) AS total_gross,
            SUM(service_fee) AS total_fee,
            SUM(CASE WHEN vendor_id='A00668577' THEN final_amount ELSE 0 END) AS biocom_total,
            SUM(CASE WHEN vendor_id='A00963878' THEN final_amount ELSE 0 END) AS teamketo_total,
            COUNT(*) AS rows
          FROM coupang_settlements_api
          `,
        )
        .get();

      // 3) 이관 전/후 평균 (경계 = 2026-02)
      const TRANSFER = "2026-02";
      const transferPivot = db
        .prepare(
          `
          SELECT vendor_id,
                 SUM(CASE WHEN recognition_year_month < ? THEN final_amount ELSE 0 END) AS before_total,
                 COUNT(DISTINCT CASE WHEN recognition_year_month < ? THEN recognition_year_month END) AS before_months,
                 SUM(CASE WHEN recognition_year_month >= ? THEN final_amount ELSE 0 END) AS after_total,
                 COUNT(DISTINCT CASE WHEN recognition_year_month >= ? THEN recognition_year_month END) AS after_months
          FROM coupang_settlements_api GROUP BY vendor_id
          `,
        )
        .all(TRANSFER, TRANSFER, TRANSFER, TRANSFER);

      // 4) settlement_type 분포
      const typeDist = db
        .prepare(
          `
          SELECT settlement_type AS type, COUNT(*) AS cnt, SUM(final_amount) AS total
          FROM coupang_settlements_api GROUP BY settlement_type ORDER BY cnt DESC
          `,
        )
        .all();

      // 5) 최근 정산 10건
      const recent = db
        .prepare(
          `
          SELECT vendor_id, settlement_date, settlement_type, recognition_year_month,
                 recognition_date_from, recognition_date_to, total_sale, final_amount, status
          FROM coupang_settlements_api ORDER BY settlement_date DESC LIMIT 10
          `,
        )
        .all();

      // 6) TOP 상품 (PG `tb_coupang_orders` · BIOCOM 최근 2개월 건기식)
      let topProducts: Array<Record<string, unknown>> = [];
      // 7) 브랜드/채널 피벗 (tb_sales_coupang · 수동 업로드 · 3P vs 로켓그로스 × 커피/영양제)
      let brandBreakdown: Array<Record<string, unknown>> = [];
      let channelTotals: Array<Record<string, unknown>> = [];
      if (isDatabaseConfigured()) {
        try {
          const pg = await queryPg<{
            product_name: string;
            orders: string;
            qty: string;
            rev: string;
          }>(
            `SELECT product_name,
                    COUNT(*)::text AS orders,
                    SUM(sales_quantity)::text AS qty,
                    ROUND(SUM(unit_sales_price::numeric * sales_quantity))::text AS rev
             FROM public.tb_coupang_orders
             WHERE product_name IS NOT NULL AND product_name <> ''
             GROUP BY product_name ORDER BY SUM(unit_sales_price::numeric * sales_quantity) DESC
             LIMIT 10`,
          );
          topProducts = pg.rows.map((r) => ({
            product_name: r.product_name,
            orders: Number(r.orders),
            qty: Number(r.qty),
            rev: Number(r.rev),
          }));
        } catch {
          topProducts = [];
        }

        try {
          const bb = await queryPg<{
            ym: string; channel: string; project: string; net: string; rows: string;
          }>(
            `SELECT sales_month AS ym, channel, project,
                    SUM(card_sales + cash_sales + other_sales - card_refund - cash_refund - other_refund)::text AS net,
                    COUNT(*)::text AS rows
             FROM public.tb_sales_coupang
             WHERE sales_month IS NOT NULL
             GROUP BY sales_month, channel, project
             ORDER BY sales_month, channel, project`,
          );
          brandBreakdown = bb.rows.map((r) => ({
            ym: r.ym,
            channel: r.channel,
            project: r.project,
            net: Number(r.net),
            rows: Number(r.rows),
          }));
        } catch {
          brandBreakdown = [];
        }

        try {
          const ct = await queryPg<{ channel: string; net: string; rows: string }>(
            `SELECT channel,
                    SUM(card_sales + cash_sales + other_sales - card_refund - cash_refund - other_refund)::text AS net,
                    COUNT(*)::text AS rows
             FROM public.tb_sales_coupang
             GROUP BY channel ORDER BY 2 DESC`,
          );
          channelTotals = ct.rows.map((r) => ({ channel: r.channel, net: Number(r.net), rows: Number(r.rows) }));
        } catch {
          channelTotals = [];
        }
      }

      res.json({
        ok: true,
        queryDate: new Date().toISOString(),
        note: {
          transfer_month: TRANSFER,
          transfer_description:
            "BIOCOM 에서 TEAMKETO 로 더클린커피 사업부 이관 추정 시점. 2026-01 BIOCOM ₩7.46M → 2026-02 ₩1.88M (-75%) + TEAMKETO ₩0 → ₩4.53M (등장).",
          rocket_growth:
            "로켓그로스 전용 settlement endpoint 는 공식 API 에 없음 (2026-04-24 리서치). Wing UI → 수동 엑셀 업로드만 가능. `tb_sales_coupang.channel='coupang_rg'` 가 로켓그로스 구간.",
          top_products_source: "tb_coupang_orders (PG · BIOCOM vendor 최근 2개월 · 2026-02 이후라 건기식 상품만 포함)",
          brand_breakdown_source: "tb_sales_coupang (PG · 수동 업로드 · coupang_3p/coupang_rg channel · project 태깅)",
          brand_breakdown_coverage: "2026-01~03 월만 커버. 과거 16개월은 미업로드.",
        },
        kpi,
        monthly,
        transferPivot,
        typeDist,
        recent,
        topProducts,
        brandBreakdown,
        channelTotals,
      });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "query failed" });
    }
  });

  return router;
};
