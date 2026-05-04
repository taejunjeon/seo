import { getPgPool, queryPg } from "../src/postgres";

type Options = {
  site: "biocom";
  month: string;
  json: boolean;
};

type SummaryRow = {
  imweb_orders: string | number;
  imweb_final_revenue: string | number | null;
  imweb_npay_complete_orders: string | number;
  imweb_npay_complete_revenue: string | number | null;
  toss_payments: string | number;
  toss_distinct_order_id_base: string | number;
  toss_total_amount: string | number | null;
  toss_cancel_amount: string | number | null;
  toss_balance_amount: string | number | null;
  matched_toss_orders: string | number;
  imweb_without_toss_orders: string | number;
  toss_without_imweb_orders: string | number;
};

type JoinMethodRow = {
  join_method: string;
  orders: string | number;
  imweb_amount: string | number | null;
  toss_amount: string | number | null;
  toss_balance: string | number | null;
  net_candidate: string | number | null;
};

type BreakdownRow = {
  payment_method: string;
  payment_status: string;
  orders: string | number;
  revenue: string | number | null;
};

type TossOnlyRow = {
  order_id_base: string;
  order_id: string;
  payment_key: string;
  toss_amount: string | number | null;
};

const CONTRACT_VERSION = "monthly-spine-dry-run-v0.2";
const CONFIRMED_AB_JOIN_METHODS = new Set([
  "toss_order_id_base",
  "imweb_npay_confirmed",
  "imweb_subscription_confirmed",
]);
const REVIEW_C_JOIN_METHODS = new Set(["imweb_virtual_without_toss"]);

const argValue = (name: string) => {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
};

const parseArgs = (): Options => {
  const site = argValue("site") || "biocom";
  const month = argValue("month") || "2026-04";

  if (site !== "biocom") {
    throw new Error("Only --site=biocom is supported in v0.1");
  }
  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw new Error("--month must be YYYY-MM");
  }

  return {
    site,
    month,
    json: process.argv.includes("--json"),
  };
};

const monthRange = (month: string) => {
  const [yearRaw, monthRaw] = month.split("-");
  const year = Number(yearRaw);
  const monthIndex = Number(monthRaw) - 1;
  const start = new Date(Date.UTC(year, monthIndex, 1));
  const end = new Date(Date.UTC(year, monthIndex + 1, 1));
  const fmt = (date: Date) =>
    `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
  return { startDate: fmt(start), endDate: fmt(end) };
};

const toNumber = (value: string | number | null | undefined) => {
  if (typeof value === "number") return value;
  if (!value) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const krw = (value: string | number | null | undefined) => `${toNumber(value).toLocaleString("ko-KR")}원`;

const imwebCte = `
  imweb AS (
    SELECT
      order_number,
      MAX(COALESCE(final_order_amount, 0)) AS imweb_amount,
      MAX(COALESCE(total_refunded_price, 0)) AS imweb_refund,
      MAX(payment_method) AS payment_method,
      MAX(payment_status) AS payment_status,
      MIN(order_date::timestamp) AS order_date_kst,
      MIN((payment_complete_time::timestamptz AT TIME ZONE 'Asia/Seoul'))
        FILTER (WHERE payment_complete_time IS NOT NULL AND payment_complete_time <> '') AS paid_at_kst,
      MAX(raw_data->>'channelOrderNo') AS channel_order_no,
      COUNT(*) AS item_rows
    FROM public.tb_iamweb_users
    WHERE order_date::timestamp >= $1::timestamp
      AND order_date::timestamp < $2::timestamp
    GROUP BY order_number
  )
`;

const tossCte = `
  toss AS (
    SELECT
      payment_key,
      order_id,
      regexp_replace(order_id, '(-|_)(p|pay)[0-9]+$', '', 'i') AS order_id_base,
      MAX(COALESCE(total_amount, 0)) AS toss_amount,
      MAX(COALESCE(balance_amount, 0)) AS toss_balance,
      MAX(COALESCE(cancel_amount, 0)) AS toss_cancel,
      MAX(status) AS toss_status,
      MAX(method) AS toss_method,
      MIN(approved_at::timestamp) AS approved_at_kst,
      MAX(NULLIF(canceled_at, '')::timestamp) AS canceled_at_kst
    FROM public.tb_sales_toss
    WHERE store = $3
      AND approved_at::timestamp >= $1::timestamp
      AND approved_at::timestamp < $2::timestamp
    GROUP BY payment_key, order_id
  )
`;

const spineCte = `
  spine AS (
    SELECT
      i.*,
      t.payment_key,
      t.order_id,
      t.order_id_base,
      t.toss_amount,
      t.toss_balance,
      t.toss_cancel,
      t.toss_status,
      CASE
        WHEN t.payment_key IS NOT NULL THEN 'toss_order_id_base'
        WHEN i.payment_method = 'NAVERPAY_ORDER' AND i.payment_status = 'PAYMENT_COMPLETE' THEN 'imweb_npay_confirmed'
        WHEN i.payment_method = 'SUBSCRIPTION' AND i.payment_status = 'PAYMENT_COMPLETE' THEN 'imweb_subscription_confirmed'
        WHEN i.payment_method = 'VIRTUAL' AND i.payment_status = 'PAYMENT_COMPLETE' THEN 'imweb_virtual_without_toss'
        WHEN i.imweb_amount = 0 THEN 'zero_amount_non_revenue'
        ELSE 'quarantine_unmatched_revenue'
      END AS join_method,
      CASE
        WHEN t.payment_key IS NOT NULL THEN t.toss_balance
        WHEN i.payment_method IN ('NAVERPAY_ORDER', 'SUBSCRIPTION', 'VIRTUAL')
          AND i.payment_status = 'PAYMENT_COMPLETE' THEN i.imweb_amount
        ELSE 0
      END AS net_revenue_candidate
    FROM imweb i
    LEFT JOIN toss t ON t.order_id_base = i.order_number
  )
`;

const run = async (options: Options) => {
  const { startDate, endDate } = monthRange(options.month);
  const params = [startDate, endDate, options.site];

  const summary = await queryPg<SummaryRow>(
    `
    WITH ${imwebCte}, ${tossCte}
    SELECT
      (SELECT COUNT(*) FROM imweb) AS imweb_orders,
      (SELECT SUM(imweb_amount) FROM imweb) AS imweb_final_revenue,
      (SELECT COUNT(*) FROM imweb WHERE payment_method = 'NAVERPAY_ORDER' AND payment_status = 'PAYMENT_COMPLETE') AS imweb_npay_complete_orders,
      (SELECT SUM(imweb_amount) FROM imweb WHERE payment_method = 'NAVERPAY_ORDER' AND payment_status = 'PAYMENT_COMPLETE') AS imweb_npay_complete_revenue,
      (SELECT COUNT(*) FROM toss) AS toss_payments,
      (SELECT COUNT(DISTINCT order_id_base) FROM toss) AS toss_distinct_order_id_base,
      (SELECT SUM(toss_amount) FROM toss) AS toss_total_amount,
      (SELECT SUM(toss_cancel) FROM toss) AS toss_cancel_amount,
      (SELECT SUM(toss_balance) FROM toss) AS toss_balance_amount,
      (SELECT COUNT(t.payment_key) FROM imweb i LEFT JOIN toss t ON t.order_id_base = i.order_number) AS matched_toss_orders,
      (SELECT COUNT(*) FROM imweb i LEFT JOIN toss t ON t.order_id_base = i.order_number WHERE t.payment_key IS NULL) AS imweb_without_toss_orders,
      (SELECT COUNT(*) FROM toss t LEFT JOIN imweb i ON i.order_number = t.order_id_base WHERE i.order_number IS NULL) AS toss_without_imweb_orders
    `,
    params,
  );

  const joinMethods = await queryPg<JoinMethodRow>(
    `
    WITH ${imwebCte}, ${tossCte}, ${spineCte}
    SELECT
      join_method,
      COUNT(*) AS orders,
      SUM(imweb_amount) AS imweb_amount,
      SUM(COALESCE(toss_amount, 0)) AS toss_amount,
      SUM(COALESCE(toss_balance, 0)) AS toss_balance,
      SUM(net_revenue_candidate) AS net_candidate
    FROM spine
    GROUP BY join_method
    ORDER BY net_candidate DESC, orders DESC
    `,
    params,
  );

  const withoutTossBreakdown = await queryPg<BreakdownRow>(
    `
    WITH ${imwebCte}, ${tossCte}
    SELECT
      COALESCE(i.payment_method, '') AS payment_method,
      COALESCE(i.payment_status, '') AS payment_status,
      COUNT(*) AS orders,
      SUM(i.imweb_amount) AS revenue
    FROM imweb i
    LEFT JOIN toss t ON t.order_id_base = i.order_number
    WHERE t.payment_key IS NULL
    GROUP BY 1, 2
    ORDER BY COUNT(*) DESC, SUM(i.imweb_amount) DESC
    `,
    params,
  );

  const tossOnly = await queryPg<TossOnlyRow>(
    `
    WITH ${imwebCte}, ${tossCte}
    SELECT
      t.order_id_base,
      t.order_id,
      t.payment_key,
      t.toss_amount
    FROM toss t
    LEFT JOIN imweb i ON i.order_number = t.order_id_base
    WHERE i.order_number IS NULL
    ORDER BY t.order_id_base
    LIMIT 20
    `,
    params,
  );

  const netCandidate = joinMethods.rows.reduce((sum, row) => sum + toNumber(row.net_candidate), 0);
  const confirmedNetRevenueAb = joinMethods.rows
    .filter((row) => CONFIRMED_AB_JOIN_METHODS.has(row.join_method))
    .reduce((sum, row) => sum + toNumber(row.net_candidate), 0);
  const reviewRevenueC = joinMethods.rows
    .filter((row) => REVIEW_C_JOIN_METHODS.has(row.join_method))
    .reduce((sum, row) => sum + toNumber(row.net_candidate), 0);
  const quarantineRevenueD = joinMethods.rows
    .filter((row) => row.join_method === "quarantine_unmatched_revenue")
    .reduce((sum, row) => sum + toNumber(row.imweb_amount), 0);
  const tossOnlyMonthBoundaryRevenue = tossOnly.rows.reduce((sum, row) => sum + toNumber(row.toss_amount), 0);

  return {
    metadata: {
      contractVersion: CONTRACT_VERSION,
      site: options.site,
      month: options.month,
      timezone: "Asia/Seoul",
      dateStart: startDate,
      dateEndExclusive: endDate,
      queriedAt: new Date().toISOString(),
      dryRun: true,
      write: false,
      send: false,
    },
    summary: {
      ...summary.rows[0],
      confirmed_net_revenue_ab: confirmedNetRevenueAb,
      review_revenue_c: reviewRevenueC,
      quarantine_revenue_d: quarantineRevenueD,
      toss_only_month_boundary_revenue: tossOnlyMonthBoundaryRevenue,
      net_revenue_candidate_including_c: netCandidate,
    },
    joinMethods: joinMethods.rows,
    withoutTossBreakdown: withoutTossBreakdown.rows,
    tossOnlySamples: tossOnly.rows,
  };
};

const printMarkdown = (payload: Awaited<ReturnType<typeof run>>) => {
  const { metadata, summary, joinMethods, withoutTossBreakdown, tossOnlySamples } = payload;

  console.log(`# monthly-spine-dry-run ${metadata.site} ${metadata.month}`);
  console.log("");
  console.log(`- contract_version: ${metadata.contractVersion}`);
  console.log(`- timezone: ${metadata.timezone}`);
  console.log(`- window: ${metadata.dateStart} <= KST < ${metadata.dateEndExclusive}`);
  console.log(`- queried_at: ${metadata.queriedAt}`);
  console.log(`- dry_run/write/send: ${metadata.dryRun}/${metadata.write}/${metadata.send}`);
  console.log("");
  console.log("## Summary");
  console.log("");
  console.log("| metric | value |");
  console.log("|---|---:|");
  console.log(`| imweb_orders | ${toNumber(summary.imweb_orders).toLocaleString("ko-KR")} |`);
  console.log(`| imweb_final_revenue | ${krw(summary.imweb_final_revenue)} |`);
  console.log(`| imweb_npay_complete | ${toNumber(summary.imweb_npay_complete_orders).toLocaleString("ko-KR")} / ${krw(summary.imweb_npay_complete_revenue)} |`);
  console.log(`| toss_payments | ${toNumber(summary.toss_payments).toLocaleString("ko-KR")} |`);
  console.log(`| toss_total_amount | ${krw(summary.toss_total_amount)} |`);
  console.log(`| toss_cancel_amount | ${krw(summary.toss_cancel_amount)} |`);
  console.log(`| toss_balance_amount | ${krw(summary.toss_balance_amount)} |`);
  console.log(`| matched_toss_orders | ${toNumber(summary.matched_toss_orders).toLocaleString("ko-KR")} |`);
  console.log(`| imweb_without_toss_orders | ${toNumber(summary.imweb_without_toss_orders).toLocaleString("ko-KR")} |`);
  console.log(`| toss_without_imweb_orders | ${toNumber(summary.toss_without_imweb_orders).toLocaleString("ko-KR")} |`);
  console.log(`| confirmed_net_revenue_ab | ${krw(summary.confirmed_net_revenue_ab)} |`);
  console.log(`| review_revenue_c | ${krw(summary.review_revenue_c)} |`);
  console.log(`| quarantine_revenue_d | ${krw(summary.quarantine_revenue_d)} |`);
  console.log(`| toss_only_month_boundary_revenue | ${krw(summary.toss_only_month_boundary_revenue)} |`);
  console.log(`| net_revenue_candidate_including_c | ${krw(summary.net_revenue_candidate_including_c)} |`);
  console.log("");
  console.log("## Join Methods");
  console.log("");
  console.log("| join_method | orders | imweb_amount | toss_amount | toss_balance | net_candidate |");
  console.log("|---|---:|---:|---:|---:|---:|");
  for (const row of joinMethods) {
    console.log(
      `| ${row.join_method} | ${toNumber(row.orders).toLocaleString("ko-KR")} | ${krw(row.imweb_amount)} | ${krw(row.toss_amount)} | ${krw(row.toss_balance)} | ${krw(row.net_candidate)} |`,
    );
  }
  console.log("");
  console.log("## Imweb Without Toss");
  console.log("");
  console.log("| payment_method | payment_status | orders | revenue |");
  console.log("|---|---|---:|---:|");
  for (const row of withoutTossBreakdown) {
    console.log(
      `| ${row.payment_method || "(blank)"} | ${row.payment_status || "(blank)"} | ${toNumber(row.orders).toLocaleString("ko-KR")} | ${krw(row.revenue)} |`,
    );
  }
  console.log("");
  console.log("## Toss Only Samples");
  console.log("");
  console.log("| order_id_base | order_id | payment_key | toss_amount |");
  console.log("|---|---|---|---:|");
  for (const row of tossOnlySamples) {
    console.log(`| ${row.order_id_base} | ${row.order_id} | ${row.payment_key} | ${krw(row.toss_amount)} |`);
  }
};

const main = async () => {
  const options = parseArgs();
  const payload = await run(options);
  if (options.json) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    printMarkdown(payload);
  }
};

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await getPgPool().end();
    } catch {
      // Ignore close errors after reporting the primary result.
    }
  });
