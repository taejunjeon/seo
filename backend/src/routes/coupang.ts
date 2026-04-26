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
          // tb_coupang_orders_rg (원격 PG · BIOCOM 로켓그로스 · 최근 2개월 구매확정 기준)
          const pg = await queryPg<{
            product_name: string;
            orders: string;
            qty: string;
            rev: string;
          }>(
            `SELECT product_name,
                    COUNT(*)::text AS orders,
                    SUM(sales_quantity::bigint)::text AS qty,
                    SUM(sales_quantity::bigint * unit_sales_price::bigint)::text AS rev
             FROM public.tb_coupang_orders_rg
             WHERE vendor_id = 'A00668577'
               AND product_name IS NOT NULL AND product_name <> ''
               AND paid_at IS NOT NULL AND paid_at ~ '^[0-9]+$'
               AND to_timestamp(paid_at::bigint/1000) >= NOW() - INTERVAL '60 days'
             GROUP BY product_name
             ORDER BY SUM(sales_quantity::bigint * unit_sales_price::bigint) DESC
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

      // 7b) 이관 전후 상품 변화 (3P 상품 Top · BIOCOM/TEAMKETO)
      let productFlow: {
        biocom3p_pre: Array<Record<string, unknown>>;
        biocom3p_post: Array<Record<string, unknown>>;
        teamketoRgCoffee: Array<Record<string, unknown>>;
      } = {
        biocom3p_pre: [],
        biocom3p_post: [],
        teamketoRgCoffee: [],
      };
      if (isDatabaseConfigured()) {
        try {
          // 2026-01 BIOCOM 3P Top (이관 직전)
          const pre = await queryPg<{ product_name: string; project: string; cnt: string; net: string }>(
            `SELECT product_name, project, COUNT(*)::text cnt,
                    SUM(card_sales + cash_sales + other_sales - card_refund - cash_refund - other_refund)::text net
             FROM public.tb_sales_coupang
             WHERE channel='coupang_3p' AND sales_month='2026-01'
             GROUP BY 1, 2
             ORDER BY SUM(card_sales + cash_sales + other_sales - card_refund - cash_refund - other_refund) DESC NULLS LAST
             LIMIT 10`,
          );
          productFlow.biocom3p_pre = pre.rows.map((r) => ({
            product_name: r.product_name,
            project: r.project,
            cnt: Number(r.cnt),
            net: Number(r.net),
          }));

          // 2026-02~03 BIOCOM 3P 잔여 (이관 후)
          const post = await queryPg<{ product_name: string; project: string; cnt: string; net: string }>(
            `SELECT product_name, project, COUNT(*)::text cnt,
                    SUM(card_sales + cash_sales + other_sales - card_refund - cash_refund - other_refund)::text net
             FROM public.tb_sales_coupang
             WHERE channel='coupang_3p' AND sales_month IN ('2026-02','2026-03')
             GROUP BY 1, 2
             ORDER BY SUM(card_sales + cash_sales + other_sales - card_refund - cash_refund - other_refund) DESC NULLS LAST
             LIMIT 10`,
          );
          productFlow.biocom3p_post = post.rows.map((r) => ({
            product_name: r.product_name,
            project: r.project,
            cnt: Number(r.cnt),
            net: Number(r.net),
          }));
        } catch {
          // ignore
        }
      }

      // TEAMKETO RG 커피 상품 Top (로컬 SQLite)
      try {
        const tk = db
          .prepare(
            `SELECT product_name, COUNT(*) cnt, SUM(gross_amount) gross
             FROM coupang_rg_orders_api
             WHERE vendor_id='A00963878'
             GROUP BY product_name ORDER BY 3 DESC LIMIT 10`,
          )
          .all() as Array<{ product_name: string; cnt: number; gross: number }>;
        productFlow.teamketoRgCoffee = tk.map((r) => ({
          product_name: r.product_name,
          cnt: Number(r.cnt),
          gross: Number(r.gross),
        }));
      } catch {
        // ignore
      }

      // 8) 로켓그로스 주문 월별 집계 (2 소스 union · 시점별 분할)
      //    · 로컬 SQLite `coupang_rg_orders_api` (2025-01~2026-01 · seo 자체 백필 · RG Order API)
      //    · 원격 PG `tb_coupang_orders_rg` (2026-02~ · biocom-dashboard Cloud Scheduler sync)
      type RgMonth = { ym: string; vendor_id: string; cnt: number; gross: number; source: string };
      const rgMap = new Map<string, RgMonth>();

      try {
        const localRg = db
          .prepare(
            `SELECT strftime('%Y-%m', paid_at_kst) AS ym,
                    vendor_id,
                    COUNT(*) AS cnt,
                    SUM(gross_amount) AS gross
             FROM coupang_rg_orders_api
             GROUP BY 1, 2 ORDER BY 1, 2`,
          )
          .all() as Array<{ ym: string; vendor_id: string; cnt: number; gross: number }>;
        for (const r of localRg) {
          rgMap.set(`${r.ym}|${r.vendor_id}`, {
            ym: r.ym,
            vendor_id: r.vendor_id,
            cnt: Number(r.cnt),
            gross: Number(r.gross),
            source: "local_sqlite",
          });
        }
      } catch {
        // table may not exist yet (before first backfill)
      }

      if (isDatabaseConfigured()) {
        try {
          const q = await queryPg<{ ym: string; vendor_id: string; cnt: string; gross: string }>(
            `SELECT to_char(to_timestamp(paid_at::bigint/1000) AT TIME ZONE 'Asia/Seoul', 'YYYY-MM') AS ym,
                    vendor_id,
                    COUNT(*)::text AS cnt,
                    SUM(sales_quantity::bigint * unit_sales_price::bigint)::text AS gross
             FROM public.tb_coupang_orders_rg
             WHERE paid_at IS NOT NULL AND paid_at ~ '^[0-9]+$'
             GROUP BY 1, 2 ORDER BY 1, 2`,
          );
          for (const r of q.rows) {
            const key = `${r.ym}|${r.vendor_id}`;
            if (!rgMap.has(key)) {
              // 로컬에 없는 월만 원격 PG 값 사용 (2026-02~)
              rgMap.set(key, {
                ym: r.ym,
                vendor_id: r.vendor_id,
                cnt: Number(r.cnt),
                gross: Number(r.gross),
                source: "remote_pg",
              });
            }
          }
        } catch {
          // remote PG may be unavailable
        }
      }

      const rgOrdersMonthly = Array.from(rgMap.values()).sort((a, b) =>
        a.ym === b.ym ? a.vendor_id.localeCompare(b.vendor_id) : a.ym.localeCompare(b.ym),
      );

      res.json({
        ok: true,
        queryDate: new Date().toISOString(),
        note: {
          transfer_month: TRANSFER,
          transfer_description:
            "BIOCOM 에서 TEAMKETO 로 더클린커피 사업부 이관 추정 시점. 2026-01 BIOCOM 3P ₩7.46M → 2026-02 ₩1.88M (-75%) + TEAMKETO ₩0 → ₩4.53M (등장).",
          rocket_growth:
            "공식 RG Order API (주문 조회) 존재 · 정산 전용 endpoint 는 없음. biocom-dashboard 프로젝트의 Cloud Scheduler 가 매일 02:05/17:05 KST 에 sync. `tb_coupang_orders_rg` 가 BIOCOM 로켓그로스 주문. TEAMKETO 는 로켓그로스 미운영 (설계상).",
          top_products_source: "tb_coupang_orders_rg (원격 PG · BIOCOM 로켓그로스 · 최근 60일 구매확정 · 건기식 위주)",
          brand_breakdown_source: "tb_sales_coupang (PG · 수동 업로드 · coupang_3p/coupang_rg channel · project 태깅)",
          brand_breakdown_coverage: "2026-01~03 월만 커버. 과거 16개월은 미업로드.",
          rg_orders_source:
            "2소스 union — 로컬 SQLite coupang_rg_orders_api (2025-01~2026-01 · seo 자체 RG Order API 백필) + 원격 PG tb_coupang_orders_rg (2026-02~ · biocom-dashboard Cloud Scheduler). BIOCOM 전용. sales_quantity × unit_sales_price 로 gross 자체 계산 (수수료·물류비 차감 없음 = 지급액 아닌 총판매 추정치).",
          rg_orders_coverage:
            "BIOCOM 2025-01~2026-04 · TEAMKETO 2026-01-21~ (이관 2주 전부터 운영 시작).",
          coverage_summary:
            "BIOCOM 3P: 2025-01~2026-04 (16개월 · 정산) · BIOCOM RG: 2025-01~2026-04 (16개월 · ₩368M) · TEAMKETO 3P: 2026-02~04 (3개월) · TEAMKETO RG: 2026-01~2026-04 (₩14M · 이관 2주 전부터 가동). 전부 seo 자체 백필 완료.",
        },
        kpi,
        monthly,
        transferPivot,
        typeDist,
        recent,
        topProducts,
        brandBreakdown,
        channelTotals,
        rgOrdersMonthly,
        productFlow,
      });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "query failed" });
    }
  });

  return router;
};
