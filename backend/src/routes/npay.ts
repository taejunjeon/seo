import { type Request, type Response, Router } from "express";

import { isDatabaseConfigured, queryPg } from "../postgres";

const numberValue = (value: unknown): number => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const percent = (numerator: number, denominator: number): number | null => {
  if (!denominator) return null;
  return Math.round((numerator / denominator) * 10000) / 100;
};

const roundCurrency = (value: number): number => Math.round(value);

const parseMonths = (value: unknown): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 7;
  return Math.max(3, Math.min(12, Math.trunc(parsed)));
};

const daysInMonth = (isoDate: string | null): number => {
  if (!isoDate) return 30;
  const [year, month] = isoDate.split("-").map(Number);
  if (!year || !month) return 30;
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
};

const dayOfMonth = (isoDate: string | null): number => {
  if (!isoDate) return 1;
  const day = Number(isoDate.slice(8, 10));
  return Number.isFinite(day) && day > 0 ? day : 1;
};

const BASE_CTE = `
with raw as (
  select
    order_number::text as order_number,
    coalesce(nullif(trim(product_name::text), ''), '미분류') as product_name,
    coalesce(nullif(trim(payment_method::text), ''), '(blank)') as payment_method,
    coalesce(nullif(trim(payment_status::text), ''), '(blank)') as payment_status,
    case
      when trim(coalesce(payment_complete_time::text, '')) ~ '^\\d{4}-\\d{2}-\\d{2}' then left(trim(payment_complete_time::text), 10)::date
      when trim(coalesce(order_date::text, '')) ~ '^\\d{4}-\\d{2}-\\d{2}' then left(trim(order_date::text), 10)::date
      else null
    end as paid_date,
    nullif(final_order_amount, 0)::numeric as final_order_amount,
    nullif(paid_price, 0)::numeric as paid_price,
    nullif(total_price, 0)::numeric as total_price,
    coalesce(nullif(trim(cancellation_reason::text), ''), '') as cancellation_reason,
    coalesce(nullif(trim(return_reason::text), ''), '') as return_reason
  from public.tb_iamweb_users
  where order_number is not null
), order_level as (
  select
    order_number,
    min(paid_date) as paid_date,
    max(payment_method) as payment_method,
    max(payment_status) as payment_status,
    coalesce(max(final_order_amount), sum(coalesce(paid_price, total_price, 0)), max(total_price), 0)::numeric as order_amount,
    bool_or(cancellation_reason not in ('', 'nan', 'null')) as has_cancel,
    bool_or(return_reason not in ('', 'nan', 'null')) as has_return,
    bool_or(payment_method ~* '(naver|npay)' or payment_method like '%네이버%') as is_npay
  from raw
  group by order_number
), clean_orders as (
  select *
  from order_level
  where paid_date is not null
    and paid_date <= current_date
    and not has_cancel
    and not has_return
    and order_amount > 0
    and payment_status not in (
      'REFUND_COMPLETE',
      'PARTIAL_REFUND_COMPLETE',
      'CANCELLED_BEFORE_DEPOSIT',
      'PAYMENT_OVERDUE',
      'PAYMENT_PREPARATION'
    )
    and lower(payment_status) not like '%refund%'
    and lower(payment_status) not like '%cancel%'
), product_distinct as (
  select distinct
    o.paid_date,
    o.order_number,
    o.order_amount,
    o.is_npay,
    r.product_name,
    case
      when r.product_name ~ '(검사|분석|대사기능|체중|호르몬|장내)' then '검사권/분석서비스'
      when r.product_name ~ '(도시락|팀키토)' then '팀키토/도시락'
      when r.product_name ~ '(메타드림|뉴로마스터|바이오밸런스|클린밸런스|당당케어|다래케어|풍성밸런스|썬화이버|다빈치랩|효소|유산균|프로바이오틱|코큐텐|테아닌|영데이즈|식이섬유)' then '건강식품/영양제'
      else '기타'
    end as category
  from clean_orders o
  join raw r using (order_number)
), allocated as (
  select
    *,
    order_amount / count(*) over (partition by order_number) as allocated_amount
  from product_distinct
)
`;

type MonthlyRow = {
  month: string;
  all_orders: string;
  all_revenue: string;
  npay_orders: string;
  npay_revenue: string;
};

type CategoryRow = {
  category: string;
  all_orders_with_category: string;
  all_allocated_revenue: string;
  npay_orders_with_category: string;
  npay_allocated_revenue: string;
};

type ProductRow = {
  product_name: string;
  category: string;
  orders: string;
  allocated_revenue: string;
};

type FreshnessRow = {
  first_paid_date: string | null;
  max_paid_date: string | null;
  max_npay_paid_date: string | null;
  clean_orders: string;
  clean_npay_orders: string;
};

export const createNpayRouter = () => {
  const router = Router();

  router.get("/api/npay/order-type-impact", async (req: Request, res: Response) => {
    if (!isDatabaseConfigured()) {
      res.status(503).json({
        ok: false,
        error: "database_not_configured",
        message: "DATABASE_URL is not configured.",
      });
      return;
    }

    const months = parseMonths(req.query.months);

    try {
      const [monthlyResult, categoryResult, productResult, freshnessResult] = await Promise.all([
        queryPg<MonthlyRow>(
          `
          ${BASE_CTE}
          select
            to_char(date_trunc('month', paid_date), 'YYYY-MM') as month,
            count(*)::text as all_orders,
            sum(order_amount)::text as all_revenue,
            count(*) filter (where is_npay)::text as npay_orders,
            coalesce(sum(order_amount) filter (where is_npay), 0)::text as npay_revenue
          from clean_orders
          where paid_date >= date_trunc('month', current_date)::date - (($1::int - 1) * interval '1 month')
          group by 1
          order by 1
          `,
          [months],
        ),
        queryPg<CategoryRow>(
          `
          ${BASE_CTE}
          select
            category,
            count(distinct order_number)::text as all_orders_with_category,
            sum(allocated_amount)::text as all_allocated_revenue,
            count(distinct order_number) filter (where is_npay)::text as npay_orders_with_category,
            coalesce(sum(allocated_amount) filter (where is_npay), 0)::text as npay_allocated_revenue
          from allocated
          where paid_date >= date_trunc('month', current_date)::date
          group by category
          order by sum(allocated_amount) desc
          `,
        ),
        queryPg<ProductRow>(
          `
          ${BASE_CTE}
          select
            product_name,
            max(category) as category,
            count(distinct order_number)::text as orders,
            sum(allocated_amount)::text as allocated_revenue
          from allocated
          where paid_date >= date_trunc('month', current_date)::date
            and is_npay
          group by product_name
          order by sum(allocated_amount) desc, count(distinct order_number) desc
          limit 15
          `,
        ),
        queryPg<FreshnessRow>(
          `
          ${BASE_CTE}
          select
            min(paid_date)::text as first_paid_date,
            max(paid_date)::text as max_paid_date,
            max(paid_date) filter (where is_npay)::text as max_npay_paid_date,
            count(*)::text as clean_orders,
            count(*) filter (where is_npay)::text as clean_npay_orders
          from clean_orders
          `,
        ),
      ]);

      const monthly = monthlyResult.rows.map((row) => {
        const allRevenue = numberValue(row.all_revenue);
        const npayRevenue = numberValue(row.npay_revenue);
        const allOrders = numberValue(row.all_orders);
        const npayOrders = numberValue(row.npay_orders);
        return {
          month: row.month,
          allOrders,
          allRevenue,
          npayOrders,
          npayRevenue,
          npayOrderSharePct: percent(npayOrders, allOrders),
          npayRevenueSharePct: percent(npayRevenue, allRevenue),
          allAov: allOrders ? roundCurrency(allRevenue / allOrders) : null,
          npayAov: npayOrders ? roundCurrency(npayRevenue / npayOrders) : null,
        };
      });

      const categoryMix = categoryResult.rows.map((row) => {
        const allRevenue = numberValue(row.all_allocated_revenue);
        const npayRevenue = numberValue(row.npay_allocated_revenue);
        const allOrders = numberValue(row.all_orders_with_category);
        const npayOrders = numberValue(row.npay_orders_with_category);
        return {
          category: row.category,
          allOrdersWithCategory: allOrders,
          allAllocatedRevenue: roundCurrency(allRevenue),
          npayOrdersWithCategory: npayOrders,
          npayAllocatedRevenue: roundCurrency(npayRevenue),
          npayOrderSharePct: percent(npayOrders, allOrders),
          npayRevenueSharePct: percent(npayRevenue, allRevenue),
        };
      });

      const topProducts = productResult.rows.map((row) => ({
        productName: row.product_name,
        category: row.category,
        orders: numberValue(row.orders),
        allocatedRevenue: roundCurrency(numberValue(row.allocated_revenue)),
      }));

      const freshness = freshnessResult.rows[0] ?? {
        first_paid_date: null,
        max_paid_date: null,
        max_npay_paid_date: null,
        clean_orders: "0",
        clean_npay_orders: "0",
      };
      const latest = monthly[monthly.length - 1] ?? null;
      const observedDays = Math.max(1, dayOfMonth(freshness.max_paid_date));
      const currentMonthDays = daysInMonth(freshness.max_paid_date);
      const projectionMultiplier = latest ? currentMonthDays / observedDays : 1;
      const projectedAllRevenue = latest ? roundCurrency(latest.allRevenue * projectionMultiplier) : 0;
      const projectedNpayRevenue = latest ? roundCurrency(latest.npayRevenue * projectionMultiplier) : 0;

      const scenarios = [
        { key: "low", label: "낮은 이탈", npayLossRatePct: 5, confidencePct: 54 },
        { key: "base", label: "기준 추정", npayLossRatePct: 12, confidencePct: 62 },
        { key: "high", label: "보수적 위험", npayLossRatePct: 22, confidencePct: 48 },
      ].map((scenario) => {
        const monthlyRevenueAtRisk = roundCurrency(projectedNpayRevenue * (scenario.npayLossRatePct / 100));
        return {
          ...scenario,
          monthlyRevenueAtRisk,
          totalRevenueImpactPct: percent(monthlyRevenueAtRisk, projectedAllRevenue),
        };
      });

      res.json({
        ok: true,
        site: "biocom",
        generatedAt: new Date().toISOString(),
        timezone: "Asia/Seoul",
        window: {
          months,
          latestMonth: latest?.month ?? null,
          observedDaysInLatestMonth: observedDays,
          daysInLatestMonth: currentMonthDays,
        },
        source: {
          primary: "operational_postgres.public.tb_iamweb_users",
          crossCheck: "local_sqlite.backend/data/crm.sqlite3.imweb_orders, stale after 2026-04-15",
          freshness: {
            firstPaidDate: freshness.first_paid_date,
            maxPaidDate: freshness.max_paid_date,
            maxNpayPaidDate: freshness.max_npay_paid_date,
            cleanOrders: numberValue(freshness.clean_orders),
            cleanNpayOrders: numberValue(freshness.clean_npay_orders),
          },
          confidence: "medium",
          caveats: [
            "tb_iamweb_users는 주문-상품 행 원장이므로 주문 매출은 order_number 기준으로 묶고 max(final_order_amount)를 사용했다.",
            "상품별 매출은 한 주문에 여러 상품이 있을 때 주문금액을 상품 수로 균등 배분했다. 실제 상품별 결제금액이 아니라 상품 믹스 판단용이다.",
            "2026년 3월 이전 일부 행은 payment_status가 한국어/영문으로 섞여 있어 장기 추세보다 현재월 판단 신뢰도가 높다.",
          ],
        },
        summary: {
          latest,
          projectedAllRevenue,
          projectedNpayRevenue,
          recommendation: {
            decision: "주문형을 즉시 전체 제거하지 말고 결제형 설계와 소규모 검증을 먼저 진행",
            expectedBaseLossPctOfNpayRevenue: 12,
            expectedBaseLossPctOfTotalRevenue:
              scenarios.find((scenario) => scenario.key === "base")?.totalRevenueImpactPct ?? null,
            confidencePct: 62,
            reason:
              "검사권은 NPay 의존도가 낮지만, 건강식품/영양제는 현재월 NPay 매출 의존도가 높아 결제 버튼 위치 변경 리스크가 있다.",
          },
        },
        monthly,
        categoryMix,
        topProducts,
        scenarios,
        interpretation: [
          "검사권/분석서비스는 현재월 전체 매출이 크지만 NPay 매출 비중은 낮다.",
          "건강식품/영양제는 NPay 주문형 버튼이 모바일 즉시결제 역할을 하므로 전환 손실 위험이 더 크다.",
          "안다르·닥터피엘·메디큐브의 외부 NPay 버튼은 편의성이 중요하다는 관찰 증거지만, 바이오컴의 실제 손실률은 A/B 또는 단계 전환으로 확인해야 한다.",
        ],
      });
    } catch (err) {
      res.status(500).json({
        ok: false,
        error: "npay_impact_query_failed",
        message: err instanceof Error ? err.message : "query failed",
      });
    }
  });

  return router;
};
