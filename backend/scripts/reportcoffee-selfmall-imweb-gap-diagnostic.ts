import path from "node:path";

import dotenv from "dotenv";
import { Pool } from "pg";

dotenv.config({ path: path.resolve(__dirname, "..", ".env"), quiet: true });
dotenv.config({ path: path.resolve(__dirname, "..", ".env.local"), quiet: true });

type CliOptions = {
  startDate: string;
  endDate: string;
  maxPages: number;
  limit: number;
  delayMs: number;
  attachmentAmountKrw: number;
  attachmentOrderCount: number;
};

type ImwebOrder = {
  orderNo: string;
  orderTimeUnix: number;
  paidAtUnix: number;
  paidDateKst: string;
  payType: string;
  pgType: string;
  paymentAmount: number;
  totalPrice: number;
  deliveryPrice: number;
  couponAmount: number;
  completeTimeUnix: number;
  statusText: string;
  rawPaymentStatus: string;
};

type Aggregate = {
  orders: number;
  amount_krw: number;
};

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const EXCLUDED_LIFECYCLE_PATTERN = /(CANCEL|RETURN|EXCHANGE|취소|반품|교환)/i;

function argValue(name: string): string | undefined {
  const prefix = `${name}=`;
  const hit = process.argv.find((arg) => arg.startsWith(prefix));
  return hit?.slice(prefix.length);
}

function assertDate(value: string, label: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${label} must be YYYY-MM-DD`);
  }
  return value;
}

function intArg(name: string, fallback: number): number {
  const parsed = Number(argValue(name));
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : fallback;
}

function parseOptions(): CliOptions {
  const startDate = assertDate(String(argValue("--start") ?? "2026-04-25"), "--start");
  const endDate = assertDate(String(argValue("--end") ?? "2026-05-01"), "--end");
  if (startDate > endDate) throw new Error("--start must be before or equal to --end");
  return {
    startDate,
    endDate,
    maxPages: Math.min(intArg("--max-pages", 80), 160),
    limit: Math.min(intArg("--limit", 100), 100),
    delayMs: Math.max(intArg("--delay-ms", 350), 250),
    attachmentAmountKrw: intArg("--attachment-amount-krw", 5_334_362),
    attachmentOrderCount: intArg("--attachment-order-count", 128),
  };
}

function normalizeDatabaseUrl(value: string): string {
  return value.replace(/^postgresql\+asyncpg:\/\//, "postgresql://");
}

function createPgPool() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) throw new Error("DATABASE_URL is not configured");
  return new Pool({ connectionString: normalizeDatabaseUrl(databaseUrl), max: 1 });
}

function numberValue(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function kstWindowToUnix(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00+09:00`);
  const end = new Date(`${endDate}T00:00:00+09:00`);
  end.setUTCDate(end.getUTCDate() + 1);
  return {
    startUnix: Math.floor(start.getTime() / 1000),
    endUnix: Math.floor(end.getTime() / 1000),
  };
}

function unixToKstDate(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "";
  return new Date(seconds * 1000 + KST_OFFSET_MS).toISOString().slice(0, 10);
}

function unixToKstText(seconds: number): string | null {
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return new Date(seconds * 1000 + KST_OFFSET_MS).toISOString().replace("T", " ").slice(0, 19);
}

function dateRange(startDate: string, endDate: string): string[] {
  const result: string[] = [];
  const cursor = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  while (cursor <= end) {
    result.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return result;
}

function addAggregate(target: Aggregate, amount: number) {
  target.orders += 1;
  target.amount_krw += amount;
}

function emptyAggregate(): Aggregate {
  return { orders: 0, amount_krw: 0 };
}

function aggregateBy<T extends string>(
  rows: ImwebOrder[],
  pick: (row: ImwebOrder) => T,
): Record<T, Aggregate> {
  const result = {} as Record<T, Aggregate>;
  for (const row of rows) {
    const key = pick(row);
    result[key] ??= emptyAggregate();
    addAggregate(result[key], row.paymentAmount);
  }
  return result;
}

async function fetchImwebToken(): Promise<string> {
  const key = process.env.IMWEB_API_KEY_COFFEE?.trim() ?? "";
  const secret = process.env.IMWEB_SECRET_KEY_COFFEE?.trim() ?? "";
  if (!key || !secret) throw new Error("IMWEB_API_KEY_COFFEE / IMWEB_SECRET_KEY_COFFEE missing");

  const response = await fetch("https://api.imweb.me/v2/auth", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ key, secret }),
  });
  const data = await response.json() as { code?: number; msg?: string; access_token?: string };
  if (!data.access_token) {
    throw new Error(`Imweb auth failed: ${response.status} ${data.code ?? ""} ${data.msg ?? ""}`.trim());
  }
  return data.access_token;
}

async function fetchImwebOrdersPage(token: string, page: number, limit: number) {
  const params = new URLSearchParams({ offset: String(page), limit: String(limit) });
  const response = await fetch(`https://api.imweb.me/v2/shop/orders?${params.toString()}`, {
    headers: { "content-type": "application/json", "access-token": token },
  });
  const data = await response.json() as {
    code?: number;
    msg?: string;
    data?: {
      list?: Array<Record<string, unknown>>;
      pagenation?: { data_count?: string | number; total_page?: string | number };
    };
  };
  return {
    list: data.data?.list ?? [],
    totalCount: numberValue(data.data?.pagenation?.data_count),
    totalPage: numberValue(data.data?.pagenation?.total_page),
    error: response.ok && data.code === 200 ? null : data.msg ?? `Imweb API ${response.status} code ${data.code}`,
  };
}

async function fetchImwebOrdersPageWithRetry(token: string, page: number, limit: number, delayMs: number) {
  let lastResult: Awaited<ReturnType<typeof fetchImwebOrdersPage>> | null = null;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const result = await fetchImwebOrdersPage(token, page, limit);
    lastResult = result;
    const error = result.error?.toUpperCase() ?? "";
    if (!error.includes("TOO MANY REQUEST") && !error.includes("429")) return result;
    await wait(delayMs * (attempt + 2));
  }
  return lastResult ?? fetchImwebOrdersPage(token, page, limit);
}

async function wait(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function toImwebOrder(row: Record<string, unknown>): ImwebOrder {
  const payment = (row.payment ?? {}) as Record<string, unknown>;
  const orderTimeUnix = numberValue(row.order_time);
  const completeTimeUnix = numberValue(row.complete_time);
  const paymentTimeUnix = numberValue(payment.payment_time);
  const paidAtUnix = paymentTimeUnix || completeTimeUnix || orderTimeUnix;
  const statusCandidates = [
    stringValue(row.status),
    stringValue(row.order_status),
    stringValue(row.status_text),
    stringValue(row.status_name),
    stringValue(row.imweb_status),
  ].filter(Boolean);
  return {
    orderNo: stringValue(row.order_no),
    orderTimeUnix,
    paidAtUnix,
    paidDateKst: unixToKstDate(paidAtUnix),
    payType: stringValue(payment.pay_type) || "(blank)",
    pgType: stringValue(payment.pg_type) || "(blank)",
    paymentAmount: numberValue(payment.payment_amount),
    totalPrice: numberValue(payment.total_price),
    deliveryPrice: numberValue(payment.deliv_price),
    couponAmount: numberValue(payment.coupon),
    completeTimeUnix,
    statusText: statusCandidates.join("|") || "(blank)",
    rawPaymentStatus: stringValue(payment.payment_status) || "(blank)",
  };
}

async function fetchImwebWindow(options: CliOptions) {
  const token = await fetchImwebToken();
  const { startUnix, endUnix } = kstWindowToUnix(options.startDate, options.endDate);
  const orders = new Map<string, ImwebOrder>();
  let totalCount = 0;
  let totalPage = 0;
  let stopReason = "max_pages";
  const errors: string[] = [];
  const pageOldestNewest: Array<{ page: number; oldest_paid_at_kst: string | null; newest_paid_at_kst: string | null; rows: number }> = [];

  for (let page = 1; page <= options.maxPages; page += 1) {
    const result = await fetchImwebOrdersPageWithRetry(token, page, options.limit, options.delayMs);
    if (result.error) {
      errors.push(`page=${page}: ${result.error}`);
      stopReason = "api_error";
      break;
    }
    totalCount = result.totalCount || totalCount;
    totalPage = result.totalPage || totalPage;
    if (result.list.length === 0) {
      stopReason = "empty_page";
      break;
    }

    const normalized = result.list.map(toImwebOrder).filter((order) => order.orderNo);
    const pagePaidTimes = normalized.map((order) => order.paidAtUnix).filter((value) => value > 0);
    const newest = Math.max(...pagePaidTimes);
    const oldest = Math.min(...pagePaidTimes);
    pageOldestNewest.push({
      page,
      rows: normalized.length,
      oldest_paid_at_kst: Number.isFinite(oldest) ? unixToKstText(oldest) : null,
      newest_paid_at_kst: Number.isFinite(newest) ? unixToKstText(newest) : null,
    });

    for (const order of normalized) {
      if (order.paidAtUnix >= startUnix && order.paidAtUnix < endUnix) {
        orders.set(order.orderNo, order);
      }
    }

    if (Number.isFinite(newest) && newest < startUnix) {
      stopReason = "older_than_window";
      break;
    }
    if (Number.isFinite(oldest) && oldest < startUnix && orders.size > 0) {
      stopReason = "window_covered";
      break;
    }
    if (page >= totalPage) {
      stopReason = "total_page_reached";
      break;
    }
    await wait(options.delayMs);
  }

  return {
    orders: [...orders.values()].sort((a, b) => a.paidAtUnix - b.paidAtUnix),
    source: {
      system: "imweb_v2_shop_orders_readonly",
      total_count: totalCount,
      total_page: totalPage,
      stop_reason: stopReason,
      pages_seen: pageOldestNewest.length,
      page_oldest_newest: pageOldestNewest.slice(0, 3).concat(pageOldestNewest.slice(-3)),
      errors,
    },
  };
}

async function queryToss(options: CliOptions, pool: Pool) {
  const endExclusive = new Date(`${options.endDate}T00:00:00Z`);
  endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
  const endExclusiveText = endExclusive.toISOString().slice(0, 10);
  const result = await pool.query(`
    SELECT
      COUNT(*)::int AS rows,
      COUNT(DISTINCT regexp_replace(COALESCE(order_id, ''), '-P[0-9]+$', ''))::int AS orders,
      ROUND(SUM(COALESCE(total_amount, 0)::numeric))::text AS gross_amount_krw,
      ROUND(SUM(COALESCE(cancel_amount, 0)::numeric))::text AS cancel_amount_krw,
      ROUND(SUM(COALESCE(balance_amount, 0)::numeric))::text AS net_amount_krw,
      MIN(approved_at) AS min_approved_at,
      MAX(approved_at) AS max_approved_at
    FROM public.tb_sales_toss
    WHERE store='coffee'
      AND approved_at::timestamp >= $1::timestamp
      AND approved_at::timestamp < $2::timestamp
  `, [options.startDate, endExclusiveText]);
  return result.rows[0] as Record<string, unknown>;
}

async function main() {
  const options = parseOptions();
  const pool = createPgPool();
  try {
    const [imweb, toss] = await Promise.all([fetchImwebWindow(options), queryToss(options, pool)]);
    const orders = imweb.orders;
    const nonZeroOrders = orders.filter((order) => order.paymentAmount > 0);
    const nonCanceledOrders = nonZeroOrders.filter((order) => !EXCLUDED_LIFECYCLE_PATTERN.test(order.statusText));
    const noCompleteTime = nonCanceledOrders.filter((order) => !order.completeTimeUnix);
    const completeTimePresent = nonCanceledOrders.filter((order) => order.completeTimeUnix > 0);
    const byPayType = aggregateBy(nonCanceledOrders, (order) => order.payType);
    const byPgType = aggregateBy(nonCanceledOrders, (order) => order.pgType);
    const byDate = Object.fromEntries(dateRange(options.startDate, options.endDate).map((date) => [
      date,
      emptyAggregate(),
    ]));
    for (const order of nonCanceledOrders) {
      byDate[order.paidDateKst] ??= emptyAggregate();
      addAggregate(byDate[order.paidDateKst], order.paymentAmount);
    }
    const imwebAmount = nonCanceledOrders.reduce((sum, order) => sum + order.paymentAmount, 0);
    const imwebOrders = nonCanceledOrders.length;
    const tossNetAmount = numberValue(toss.net_amount_krw);
    const tossOrders = numberValue(toss.orders);
    const nPayPayTypes = ["npay", "NAVERPAY_ORDER", "naverpay", "NAVERPAY"].map((v) => v.toLowerCase());
    const imwebNpayOrders = nonCanceledOrders.filter((order) => nPayPayTypes.includes(order.payType.toLowerCase()));
    const imwebNonNpayOrders = nonCanceledOrders.filter((order) => !nPayPayTypes.includes(order.payType.toLowerCase()));
    const imwebNpayAmount = imwebNpayOrders.reduce((sum, order) => sum + order.paymentAmount, 0);
    const imwebNonNpayAmount = imwebNonNpayOrders.reduce((sum, order) => sum + order.paymentAmount, 0);
    const tossPlusImwebNpay = tossNetAmount + imwebNpayAmount;
    const imwebVsAttachment = imwebAmount - options.attachmentAmountKrw;
    const tossPlusNpayVsAttachment = tossPlusImwebNpay - options.attachmentAmountKrw;

    const output = {
      report: "reportcoffee_selfmall_imweb_gap_diagnostic_v1",
      generated_at: new Date().toISOString(),
      site: "thecleancoffee",
      mode: "read_only_no_send_no_write",
      window: {
        timezone: "Asia/Seoul",
        start_date: options.startDate,
        end_date_inclusive: options.endDate,
      },
      attachment_excel: {
        selfmall_amount_krw: options.attachmentAmountKrw,
        selfmall_order_count: options.attachmentOrderCount,
      },
      imweb_api: {
        ...imweb.source,
        all_non_cancel_nonzero: {
          orders: imwebOrders,
          amount_krw: imwebAmount,
          diff_vs_attachment_krw: imwebVsAttachment,
          order_count_diff_vs_attachment: imwebOrders - options.attachmentOrderCount,
        },
        npay_detected: {
          orders: imwebNpayOrders.length,
          amount_krw: imwebNpayAmount,
        },
        non_npay_detected: {
          orders: imwebNonNpayOrders.length,
          amount_krw: imwebNonNpayAmount,
        },
        complete_time_present: {
          orders: completeTimePresent.length,
          amount_krw: completeTimePresent.reduce((sum, order) => sum + order.paymentAmount, 0),
          by_pay_type: aggregateBy(completeTimePresent, (order) => order.payType),
          by_pg_type: aggregateBy(completeTimePresent, (order) => order.pgType),
        },
        complete_time_blank: {
          orders: noCompleteTime.length,
          amount_krw: noCompleteTime.reduce((sum, order) => sum + order.paymentAmount, 0),
          by_pay_type: aggregateBy(noCompleteTime, (order) => order.payType),
          by_pg_type: aggregateBy(noCompleteTime, (order) => order.pgType),
        },
        by_pay_type: byPayType,
        by_pg_type: byPgType,
        by_paid_date_kst: byDate,
        raw_order_output: 0,
      },
      toss_operational_db: {
        source: "operating_db_public_tb_sales_toss_readonly",
        store: "coffee",
        rows: numberValue(toss.rows),
        orders: tossOrders,
        gross_amount_krw: numberValue(toss.gross_amount_krw),
        cancel_amount_krw: numberValue(toss.cancel_amount_krw),
        net_amount_krw: tossNetAmount,
        min_approved_at: toss.min_approved_at ?? null,
        max_approved_at: toss.max_approved_at ?? null,
      },
      reconstruction: {
        toss_net_plus_imweb_api_npay: {
          orders_reference: tossOrders + imwebNpayOrders.length,
          amount_krw: tossPlusImwebNpay,
          diff_vs_attachment_krw: tossPlusNpayVsAttachment,
          note: "Toss order count plus Imweb NPay count may double-count if payment method definitions overlap; amount is diagnostic only.",
        },
        imweb_api_all_vs_attachment: {
          orders: imwebOrders,
          amount_krw: imwebAmount,
          diff_vs_attachment_krw: imwebVsAttachment,
          verdict: imwebAmount === options.attachmentAmountKrw
            ? "exact_amount_match"
            : Math.abs(imwebVsAttachment) <= 150_000
              ? "near_amount_match"
              : "different_source_or_adjustment",
        },
      },
      narrowed_candidates: [
        {
          category: "imweb_api_near_match",
          amount_gap_krw: imwebVsAttachment,
          meaning: "Imweb API 전체 비취소 유상 주문 기준이 첨부 자사몰 값과 가까운지 확인한다.",
        },
        {
          category: "toss_plus_npay_split_gap",
          amount_gap_krw: tossPlusNpayVsAttachment,
          meaning: "기존 Toss net + NPay split 방식과 첨부 자사몰 값의 차이를 확인한다.",
        },
      ],
      guardrails: {
        slack_send: 0,
        operating_db_write: 0,
        vm_cloud_write_or_deploy: 0,
        platform_send_or_upload: 0,
        imweb_write: 0,
        raw_customer_identifier_output: 0,
        raw_order_identifier_output: 0,
        raw_payment_identifier_output: 0,
      },
    };

    console.log(JSON.stringify(output, null, 2));
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
