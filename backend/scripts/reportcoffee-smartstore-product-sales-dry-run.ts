import fs from "node:fs";
import path from "node:path";

import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "..", ".env"), quiet: true });
dotenv.config({ path: path.resolve(__dirname, "..", ".env.local"), quiet: true });

type CliOptions = {
  outputPath?: string;
  topProducts: number;
  asOfDate: string;
};

type WindowSpec = {
  key: "weekly" | "month_to_date" | "rolling_30d";
  label: string;
  startDate: string;
  endDateInclusive: string;
  endDateExclusive: string;
};

type StatusRow = {
  ord_status: string;
  rows: string;
  quantity: string;
  amount_krw: string;
  min_time: string | null;
  max_time: string | null;
};

type ProductOptionRow = {
  product_name: string;
  option_name: string;
  ord_status: string;
  rows: string;
  quantity: string;
  amount_krw: string;
};

type ProductBucket = {
  product_name_normalized: string;
  rows: number;
  quantity: number;
  amount_krw: number;
  option_count: number;
  option_examples: string[];
};

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function parseArgs(argv: string[]): Record<string, string | boolean> {
  const args: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const body = token.slice(2);
    const eqIndex = body.indexOf("=");
    if (eqIndex >= 0) {
      args[body.slice(0, eqIndex)] = body.slice(eqIndex + 1);
      continue;
    }
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      args[body] = next;
      i += 1;
    } else {
      args[body] = true;
    }
  }
  return args;
}

function assertDate(value: string, label: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${label} must be YYYY-MM-DD`);
  }
  return value;
}

function shiftKstDate(date: string, deltaDays: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + deltaDays));
  return [
    shifted.getUTCFullYear(),
    String(shifted.getUTCMonth() + 1).padStart(2, "0"),
    String(shifted.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function getPreviousKstDate(): string {
  const nowKst = new Date(Date.now() + KST_OFFSET_MS);
  const todayKstUtc = Date.UTC(
    nowKst.getUTCFullYear(),
    nowKst.getUTCMonth(),
    nowKst.getUTCDate(),
  );
  const previous = new Date(todayKstUtc - ONE_DAY_MS);
  return [
    previous.getUTCFullYear(),
    String(previous.getUTCMonth() + 1).padStart(2, "0"),
    String(previous.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function monthStart(date: string): string {
  return `${date.slice(0, 8)}01`;
}

function asInt(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : fallback;
}

function getOptions(): CliOptions {
  const args = parseArgs(process.argv.slice(2));
  const asOfDate = assertDate(String(args.asOf ?? args["as-of"] ?? getPreviousKstDate()), "--as-of");
  return {
    asOfDate,
    outputPath: args.out ? String(args.out) : undefined,
    topProducts: Math.max(1, Math.min(20, asInt(args.topProducts ?? args["top-products"], 10))),
  };
}

function buildWindows(asOfDate: string): WindowSpec[] {
  const endDateExclusive = shiftKstDate(asOfDate, 1);
  return [
    {
      key: "weekly",
      label: "최근 완료 7일",
      startDate: shiftKstDate(asOfDate, -6),
      endDateInclusive: asOfDate,
      endDateExclusive,
    },
    {
      key: "month_to_date",
      label: "월초-기준일",
      startDate: monthStart(asOfDate),
      endDateInclusive: asOfDate,
      endDateExclusive,
    },
    {
      key: "rolling_30d",
      label: "최근 완료 30일",
      startDate: shiftKstDate(asOfDate, -29),
      endDateInclusive: asOfDate,
      endDateExclusive,
    },
  ];
}

function normalizeProductName(value: string): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized || "unknown_product";
}

function normalizeOptionName(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function isExcludedStatus(status: string): boolean {
  return /취소|반품|환불|교환/.test(status);
}

function toNumber(value: string | number | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.round(parsed) : 0;
}

async function run() {
  const { isDatabaseConfigured, queryPg } = await import("../src/postgres");
  const options = getOptions();
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL is not configured");
  }

  const windows = buildWindows(options.asOfDate);
  const windowResults: Record<string, unknown> = {};

  for (const window of windows) {
    const params = [window.startDate, window.endDateExclusive];
    const statusResult = await queryPg<StatusRow>(
      `
        SELECT
          COALESCE(NULLIF(ord_status, ''), 'unknown') AS ord_status,
          COUNT(*)::text AS rows,
          COALESCE(SUM(sale_cnt::numeric), 0)::text AS quantity,
          COALESCE(SUM(pay_amt::numeric), 0)::text AS amount_krw,
          MIN(COALESCE(NULLIF(pay_time, ''), ord_time))::text AS min_time,
          MAX(COALESCE(NULLIF(pay_time, ''), ord_time))::text AS max_time
        FROM public.tb_playauto_orders
        WHERE shop_name = '스마트스토어'
          AND COALESCE(NULLIF(pay_time, ''), ord_time)::timestamp >= $1::date
          AND COALESCE(NULLIF(pay_time, ''), ord_time)::timestamp < $2::date
        GROUP BY 1
        ORDER BY COALESCE(SUM(pay_amt::numeric), 0) DESC
      `,
      params,
    );

    const productResult = await queryPg<ProductOptionRow>(
      `
        SELECT
          COALESCE(NULLIF(shop_sale_name, ''), 'unknown_product') AS product_name,
          COALESCE(NULLIF(shop_opt_name, ''), '') AS option_name,
          COALESCE(NULLIF(ord_status, ''), 'unknown') AS ord_status,
          COUNT(*)::text AS rows,
          COALESCE(SUM(sale_cnt::numeric), 0)::text AS quantity,
          COALESCE(SUM(pay_amt::numeric), 0)::text AS amount_krw
        FROM public.tb_playauto_orders
        WHERE shop_name = '스마트스토어'
          AND COALESCE(NULLIF(pay_time, ''), ord_time)::timestamp >= $1::date
          AND COALESCE(NULLIF(pay_time, ''), ord_time)::timestamp < $2::date
        GROUP BY 1, 2, 3
        ORDER BY COALESCE(SUM(pay_amt::numeric), 0) DESC
      `,
      params,
    );

    let includedRows = 0;
    let includedQuantity = 0;
    let includedAmount = 0;
    let excludedRows = 0;
    let excludedAmount = 0;
    const buckets = new Map<string, ProductBucket>();

    for (const row of productResult.rows) {
      const rows = toNumber(row.rows);
      const quantity = toNumber(row.quantity);
      const amount = toNumber(row.amount_krw);
      if (isExcludedStatus(row.ord_status)) {
        excludedRows += rows;
        excludedAmount += amount;
        continue;
      }

      includedRows += rows;
      includedQuantity += quantity;
      includedAmount += amount;
      const productName = normalizeProductName(row.product_name);
      const optionName = normalizeOptionName(row.option_name);
      const bucket = buckets.get(productName) ?? {
        product_name_normalized: productName,
        rows: 0,
        quantity: 0,
        amount_krw: 0,
        option_count: 0,
        option_examples: [],
      };
      bucket.rows += rows;
      bucket.quantity += quantity;
      bucket.amount_krw += amount;
      if (optionName) {
        bucket.option_count += 1;
        if (bucket.option_examples.length < 3 && !bucket.option_examples.includes(optionName)) {
          bucket.option_examples.push(optionName);
        }
      }
      buckets.set(productName, bucket);
    }

    const topProducts = [...buckets.values()]
      .sort((a, b) => b.amount_krw - a.amount_krw)
      .slice(0, options.topProducts)
      .map((row, index) => ({
        rank: index + 1,
        ...row,
      }));

    windowResults[window.key] = {
      window: {
        label: window.label,
        timezone: "Asia/Seoul",
        start_date: window.startDate,
        end_date_inclusive: window.endDateInclusive,
        end_date_exclusive: window.endDateExclusive,
      },
      totals: {
        included_rows: includedRows,
        included_quantity: includedQuantity,
        included_amount_krw: includedAmount,
        excluded_rows: excludedRows,
        excluded_amount_krw: excludedAmount,
        product_bucket_count: buckets.size,
      },
      top_products: topProducts,
      status_breakdown: statusResult.rows.map((row) => ({
        ord_status: row.ord_status,
        rows: toNumber(row.rows),
        quantity: toNumber(row.quantity),
        amount_krw: toNumber(row.amount_krw),
        excluded_by_rule: isExcludedStatus(row.ord_status),
        min_time: row.min_time,
        max_time: row.max_time,
      })),
      reconciliation: {
        all_product_amount_krw: [...buckets.values()].reduce((sum, row) => sum + row.amount_krw, 0),
        matches_included_total: [...buckets.values()].reduce((sum, row) => sum + row.amount_krw, 0) === includedAmount,
      },
    };
  }

  const result = {
    report: "reportcoffee_smartstore_product_sales_dry_run_v1",
    generated_at: new Date().toISOString(),
    generated_for_kst_date: options.asOfDate,
    source: {
      system: "operational_postgres_read_only",
      table: "public.tb_playauto_orders",
      filter: "shop_name = '스마트스토어'",
      product_fields: ["shop_sale_name", "shop_opt_name"],
      amount_field: "pay_amt",
      quantity_field: "sale_cnt",
      time_rule: "COALESCE(pay_time, ord_time) KST date window",
    },
    status_rule: {
      included: "ord_status does not contain 취소/반품/환불/교환",
      excluded: "ord_status contains 취소/반품/환불/교환",
      note: "PlayAuto 상태값은 dry-run 기준이며 정산 기준 확정 전에는 included_with_warning",
    },
    windows: windowResults,
    guardrails: {
      read_only: true,
      operating_db_write: 0,
      slack_send: 0,
      platform_send_or_upload: 0,
      raw_customer_identifier_output: 0,
      raw_order_identifier_output: 0,
      raw_payment_identifier_output: 0,
      raw_click_identifier_output: 0,
    },
    confidence: "medium_high_playauto_product_amount",
  };

  const json = `${JSON.stringify(result, null, 2)}\n`;
  if (options.outputPath) {
    fs.mkdirSync(path.dirname(path.resolve(options.outputPath)), { recursive: true });
    fs.writeFileSync(options.outputPath, json);
  } else {
    process.stdout.write(json);
  }
}

run().catch((error) => {
  console.error(
    JSON.stringify(
      {
        report: "reportcoffee_smartstore_product_sales_dry_run_v1",
        status: "failed",
        error: error instanceof Error ? error.message.slice(0, 240) : String(error).slice(0, 240),
        guardrails: {
          read_only: true,
          operating_db_write: 0,
          slack_send: 0,
          platform_send_or_upload: 0,
          raw_customer_identifier_output: 0,
          raw_order_identifier_output: 0,
          raw_payment_identifier_output: 0,
          raw_click_identifier_output: 0,
        },
      },
      null,
      2,
    ),
  );
  process.exit(1);
});
