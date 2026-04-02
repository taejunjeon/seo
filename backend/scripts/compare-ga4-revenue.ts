import fs from "node:fs";
import path from "node:path";

import dotenv from "dotenv";
import { Pool } from "pg";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

import { queryGA4RevenueKpi } from "../src/ga4";

type MonthlyComparisonRow = {
  month: string;
  startDate: string;
  endDate: string;
  ga4Revenue: number;
  revenueSalesSummary: number;
  absoluteDiff: number;
  diffRatePct: number | null;
};

type AvailableSalesMonthRow = {
  src: string;
  sales_month: string;
};

const buildMonthRange = (month: string) => {
  const [yearRaw, monthRaw] = month.split("-");
  const year = Number(yearRaw);
  const monthNumber = Number(monthRaw);
  if (!year || !monthNumber || monthNumber < 1 || monthNumber > 12) {
    throw new Error(`Invalid month: ${month}`);
  }

  const start = new Date(Date.UTC(year, monthNumber - 1, 1));
  const end = new Date(Date.UTC(year, monthNumber, 0));
  return { start, end };
};

const toDateOnly = (value: Date) => value.toISOString().slice(0, 10);

const formatMonth = (value: Date) => `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}`;

const getDefaultMonthRange = () => {
  const today = new Date();
  const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 3, 1));
  return { startMonth: formatMonth(start), endMonth: formatMonth(end) };
};

const iterateMonths = (startMonth: string, endMonth: string) => {
  const start = buildMonthRange(startMonth).start;
  const end = buildMonthRange(endMonth).start;
  const months: string[] = [];

  const cursor = new Date(start);
  while (cursor <= end) {
    months.push(formatMonth(cursor));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  return months;
};

const readRevenueDatabaseUrl = () => {
  const candidates = [
    path.resolve(process.cwd(), "../../revenue/backend/.env"),
    path.resolve(process.cwd(), "../../revenue/.env"),
    path.resolve(process.cwd(), "../../revenue/backend/.env.local"),
  ];

  for (const revenueEnvPath of candidates) {
    if (!fs.existsSync(revenueEnvPath)) continue;

    const parsed = dotenv.parse(fs.readFileSync(revenueEnvPath, "utf8"));
    const rawUrl = parsed.DATABASE_URL?.trim();
    if (!rawUrl) continue;

    return rawUrl.replace(/^postgresql\+asyncpg:\/\//, "postgresql://");
  }

  throw new Error("Revenue env file with DATABASE_URL was not found.");
};

const SALES_SUMMARY_TOTAL_SQL = `
  SELECT COALESCE(SUM(card + cash + other), 0)::numeric AS grand_total
  FROM (
      SELECT
          '토스' AS channel,
          COALESCE(project, '미분류') AS project,
          CASE WHEN channel = 'toss_card' THEN total_amount - cancel_amount ELSE 0 END AS card,
          CASE WHEN channel = 'toss_cash_receipt' THEN total_amount - cancel_amount ELSE 0 END AS cash,
          0 AS other
      FROM tb_sales_toss
      WHERE sales_month = $1

      UNION ALL

      SELECT
          '나이스페이' AS channel,
          COALESCE(project, '미분류') AS project,
          CASE WHEN status = '승인' THEN transaction_amount
               WHEN status = '취소' THEN -transaction_amount
               ELSE 0 END AS card,
          0 AS cash,
          0 AS other
      FROM tb_sales_nicepay
      WHERE sales_month = $1

      UNION ALL

      SELECT
          '네이버페이' AS channel,
          COALESCE(project, '미분류') AS project,
          credit_card_amount AS card,
          cash_income_deduction_amount + cash_outgoing_evidence_amount AS cash,
          cash_exclusion_issuance_amount + other_amount AS other
      FROM tb_sales_naver_vat
      WHERE sales_month = $1 AND channel = 'naverpay'

      UNION ALL

      SELECT
          '스마트스토어' AS channel,
          COALESCE(project, '미분류') AS project,
          credit_card_amount AS card,
          cash_income_deduction_amount + cash_outgoing_evidence_amount AS cash,
          cash_exclusion_issuance_amount + other_amount AS other
      FROM tb_sales_naver_vat
      WHERE sales_month = $1 AND channel = 'smartstore'

      UNION ALL

      SELECT
          '쿠팡' AS channel,
          COALESCE(NULLIF(project, ''), '미분류') AS project,
          card_sales - card_refund AS card,
          cash_sales - cash_refund AS cash,
          other_sales - other_refund AS other
      FROM tb_sales_coupang
      WHERE sales_month = $1 AND channel = 'coupang_3p'

      UNION ALL

      SELECT
          '쿠팡 로켓그로스' AS channel,
          COALESCE(NULLIF(project, ''), '미분류') AS project,
          card_sales - card_refund AS card,
          cash_sales - cash_refund AS cash,
          other_sales - other_refund AS other
      FROM tb_sales_coupang
      WHERE sales_month = $1 AND channel = 'coupang_rg'

      UNION ALL

      SELECT
          '세금계산서' AS channel,
          COALESCE(project, '미분류') AS project,
          0 AS card,
          0 AS cash,
          total_amount AS other
      FROM tb_sales_tax_invoice
      WHERE sales_month = $1 AND COALESCE(project, '미분류') != '광고비'

      UNION ALL

      SELECT
          '리커버리랩' AS channel,
          COALESCE(project, '센터') AS project,
          CASE WHEN payment_type = '카드' THEN payment_amount ELSE 0 END AS card,
          CASE WHEN payment_type = '현금영수증' THEN payment_amount ELSE 0 END AS cash,
          0 AS other
      FROM tb_sales_recovery_lab
      WHERE sales_month = $1
  ) AS combined
  WHERE project != '미분류'
`;

const AVAILABLE_SALES_MONTHS_SQL = `
  SELECT src, sales_month
  FROM (
      SELECT 'toss' AS src, sales_month FROM tb_sales_toss
      UNION ALL
      SELECT 'nicepay' AS src, sales_month FROM tb_sales_nicepay
      UNION ALL
      SELECT 'naver_vat' AS src, sales_month FROM tb_sales_naver_vat
      UNION ALL
      SELECT 'coupang' AS src, sales_month FROM tb_sales_coupang
      UNION ALL
      SELECT 'tax_invoice' AS src, sales_month FROM tb_sales_tax_invoice
      UNION ALL
      SELECT 'recovery_lab' AS src, sales_month FROM tb_sales_recovery_lab
  ) x
  WHERE sales_month IS NOT NULL
  GROUP BY src, sales_month
  ORDER BY sales_month DESC, src
`;

const getArgs = () => {
  const defaults = getDefaultMonthRange();
  const startMonth = process.argv.find((arg) => arg.startsWith("--startMonth="))?.split("=")[1] ?? defaults.startMonth;
  const endMonth = process.argv.find((arg) => arg.startsWith("--endMonth="))?.split("=")[1] ?? defaults.endMonth;
  return { startMonth, endMonth };
};

const main = async () => {
  const { startMonth, endMonth } = getArgs();
  const months = iterateMonths(startMonth, endMonth);
  const revenueDbUrl = readRevenueDatabaseUrl();
  const revenuePool = new Pool({ connectionString: revenueDbUrl });

  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);

  try {
    const availableMonthsResult = await revenuePool.query<AvailableSalesMonthRow>(AVAILABLE_SALES_MONTHS_SQL);
    const rows: MonthlyComparisonRow[] = [];

    for (const month of months) {
      const { start, end } = buildMonthRange(month);
      const boundedEnd = end > yesterday ? yesterday : end;
      const startDate = toDateOnly(start);
      const endDate = toDateOnly(boundedEnd);

      const ga4 = await queryGA4RevenueKpi({ startDate, endDate });
      const revenueResult = await revenuePool.query<{ grand_total: string | null }>(SALES_SUMMARY_TOTAL_SQL, [month]);
      const revenueSalesSummary = Number(revenueResult.rows[0]?.grand_total ?? 0);
      const absoluteDiff = ga4.totalRevenue - revenueSalesSummary;

      rows.push({
        month,
        startDate,
        endDate,
        ga4Revenue: ga4.totalRevenue,
        revenueSalesSummary,
        absoluteDiff,
        diffRatePct: revenueSalesSummary !== 0 ? Number(((absoluteDiff / revenueSalesSummary) * 100).toFixed(2)) : null,
      });
    }

    const totals = rows.reduce(
      (acc, row) => {
        acc.ga4Revenue += row.ga4Revenue;
        acc.revenueSalesSummary += row.revenueSalesSummary;
        acc.absoluteDiff += row.absoluteDiff;
        return acc;
      },
      { ga4Revenue: 0, revenueSalesSummary: 0, absoluteDiff: 0 },
    );

    const result = {
      generatedAt: new Date().toISOString(),
      range: { startMonth, endMonth },
      source: {
        ga4: "/api/ga4/revenue-kpi",
        revenue: "/api/sales/summary?month=YYYY-MM",
      },
      availableSalesMonths: availableMonthsResult.rows,
      rows,
      totals: {
        ...totals,
        diffRatePct:
          totals.revenueSalesSummary !== 0
            ? Number(((totals.absoluteDiff / totals.revenueSalesSummary) * 100).toFixed(2))
            : null,
      },
    };

    console.log(JSON.stringify(result, null, 2));
  } finally {
    await revenuePool.end();
  }
};

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
