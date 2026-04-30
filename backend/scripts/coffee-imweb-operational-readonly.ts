import path from "node:path";

import Database from "better-sqlite3";
import dotenv from "dotenv";
import { google, type bigquery_v2 } from "googleapis";
import { Pool } from "pg";

dotenv.config({ path: path.resolve(__dirname, "..", ".env"), quiet: true });

const SITE = "thecleancoffee";
const COFFEE_PROJECT_ID = "project-dadba7dd-0229-4ff6-81c";
const COFFEE_DATASET = `analytics_${process.env.GA4_COFFEE_PROPERTY_ID?.trim() || "326949178"}`;
const COFFEE_LOCATION = "asia-northeast3";

type BigQueryRow = Record<string, unknown>;

type ImwebOrder = {
  orderNo: string;
  channelOrderNo: string;
  orderTimeUnix: number;
  paidAtUnix: number;
  paidAtKst: string;
  payType: string;
  pgType: string;
  totalPrice: number;
  deliveryPrice: number;
  couponAmount: number;
  paymentAmount: number;
  deviceType: string;
};

type Ga4Purchase = {
  eventUnix: number;
  eventTimeKst: string;
  transactionId: string;
  paymentMethodGuess: "npay_transaction_id" | "non_npay_ga4";
  revenue: number;
  pageLocation: string;
  sourceKey: string;
  mediumKey: string;
  itemIds: string;
  itemNames: string;
};

type PlayautoOrderEvidence = {
  orderNo: string;
  status: string;
  itemRows: number;
  productNames: string;
  quantity: number;
};

type AmountMatchType =
  | "final_exact"
  | "item_exact"
  | "shipping_reconciled"
  | "discount_reconciled"
  | "near_exact"
  | "none";

const argValue = (name: string) =>
  process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);

const validateSuffix = (label: string, suffix: string) => {
  if (!/^\d{8}$/.test(suffix)) throw new Error(`${label} must be YYYYMMDD: ${suffix}`);
  return suffix;
};

const suffixToDate = (suffix: string) => `${suffix.slice(0, 4)}-${suffix.slice(4, 6)}-${suffix.slice(6, 8)}`;

const parseArgs = () => {
  const startSuffix = validateSuffix("startSuffix", argValue("startSuffix") ?? "20260423");
  const endSuffix = validateSuffix("endSuffix", argValue("endSuffix") ?? "20260429");
  if (startSuffix > endSuffix) throw new Error(`startSuffix must be <= endSuffix: ${startSuffix} > ${endSuffix}`);
  return {
    startSuffix,
    endSuffix,
    startDate: suffixToDate(startSuffix),
    endDate: suffixToDate(endSuffix),
    maxPages: Math.min(Math.max(Number(argValue("maxPages") ?? "8"), 1), 50),
    limit: Math.min(Math.max(Number(argValue("limit") ?? "100"), 10), 100),
    delayMs: Math.min(Math.max(Number(argValue("delayMs") ?? "900"), 250), 5000),
    json: process.argv.includes("--json"),
  };
};

const kstWindowToUnix = (startDate: string, endDate: string) => {
  const start = new Date(`${startDate}T00:00:00+09:00`);
  const end = new Date(`${endDate}T00:00:00+09:00`);
  end.setUTCDate(end.getUTCDate() + 1);
  return {
    startUnix: Math.floor(start.getTime() / 1000),
    endUnix: Math.floor(end.getTime() / 1000),
  };
};

const unixToKst = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds <= 0) return "";
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(seconds * 1000));
};

const parseNumber = (value: unknown) => {
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string" && value.trim()) return Number(value);
  return 0;
};

const parseString = (value: unknown) => (typeof value === "string" ? value.trim() : "");

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const parseJsonCredentials = () => {
  const rawKey = process.env.GA4_SERVICE_ACCOUNT_KEY || process.env.GA4_BIOCOM_SERVICE_ACCOUNT_KEY;
  if (!rawKey?.trim()) throw new Error("GA4 service account key missing");
  return JSON.parse(rawKey) as { client_email: string; private_key: string };
};

const createBigQueryClient = () => {
  const credentials = parseJsonCredentials();
  const auth = new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: [
      "https://www.googleapis.com/auth/bigquery.readonly",
      "https://www.googleapis.com/auth/cloud-platform.read-only",
    ],
  });
  return google.bigquery({ version: "v2", auth });
};

const runBigQuery = async (bq: bigquery_v2.Bigquery, query: string) => {
  const response = await bq.jobs.query({
    projectId: COFFEE_PROJECT_ID,
    requestBody: {
      query,
      useLegacySql: false,
      location: COFFEE_LOCATION,
      timeoutMs: 30_000,
    },
  });
  const fields = response.data.schema?.fields ?? [];
  return (response.data.rows ?? []).map((row) =>
    Object.fromEntries((row.f ?? []).map((cell, index) => [fields[index]?.name ?? String(index), cell.v])),
  ) as BigQueryRow[];
};

const normalizeDatabaseUrl = (value: string) => value.replace(/^postgresql\+asyncpg:\/\//, "postgresql://");

const createPgPool = () => {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) throw new Error("DATABASE_URL is not configured");
  return new Pool({ connectionString: normalizeDatabaseUrl(databaseUrl), max: 1 });
};

const fetchImwebToken = async () => {
  const key = process.env.IMWEB_API_KEY_COFFEE?.trim() ?? "";
  const secret = process.env.IMWEB_SECRET_KEY_COFFEE?.trim() ?? "";
  if (!key || !secret) throw new Error("IMWEB_API_KEY_COFFEE / IMWEB_SECRET_KEY_COFFEE missing");

  const response = await fetch("https://api.imweb.me/v2/auth", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ key, secret }),
  });
  const data = (await response.json()) as { code?: number; msg?: string; access_token?: string };
  if (!data.access_token) {
    throw new Error(`Imweb auth failed: ${response.status} ${data.code ?? ""} ${data.msg ?? ""}`.trim());
  }
  return data.access_token;
};

const fetchImwebOrdersPage = async (
  token: string,
  page: number,
  limit: number,
  type?: "npay",
): Promise<{ list: Array<Record<string, unknown>>; totalCount: number; totalPage: number; error: string | null }> => {
  const params = new URLSearchParams({ offset: String(page), limit: String(limit) });
  if (type) params.set("type", type);
  const url = `https://api.imweb.me/v2/shop/orders?${params.toString()}`;
  const response = await fetch(url, {
    headers: { "content-type": "application/json", "access-token": token },
  });
  const data = (await response.json()) as {
    code?: number;
    msg?: string;
    data?: {
      list?: Array<Record<string, unknown>>;
      pagenation?: { data_count?: string | number; total_page?: string | number };
    };
  };
  return {
    list: data.data?.list ?? [],
    totalCount: Number.parseInt(String(data.data?.pagenation?.data_count ?? "0"), 10) || 0,
    totalPage: Number.parseInt(String(data.data?.pagenation?.total_page ?? "0"), 10) || 0,
    error: response.ok && data.code === 200 ? null : data.msg ?? `Imweb API ${response.status} code ${data.code}`,
  };
};

const fetchImwebOrdersPageWithRetry = async (
  token: string,
  page: number,
  limit: number,
  type: "npay" | undefined,
) => {
  for (let attempt = 0; attempt < 4; attempt++) {
    const result = await fetchImwebOrdersPage(token, page, limit, type);
    const error = result.error?.toUpperCase() ?? "";
    if (!error.includes("TOO MANY REQUEST") && !error.includes("429")) return result;
    await wait(1500 + attempt * 900);
  }
  return fetchImwebOrdersPage(token, page, limit, type);
};

const toImwebOrder = (row: Record<string, unknown>): ImwebOrder => {
  const payment = (row.payment ?? {}) as Record<string, unknown>;
  const device = (row.device ?? {}) as Record<string, unknown>;
  const orderTimeUnix = parseNumber(row.order_time);
  const paymentTimeUnix = parseNumber(payment.payment_time);
  const completeTimeUnix = parseNumber(row.complete_time);
  const paidAtUnix = paymentTimeUnix || completeTimeUnix || orderTimeUnix;
  return {
    orderNo: parseString(row.order_no),
    channelOrderNo: parseString(row.channel_order_no),
    orderTimeUnix,
    paidAtUnix,
    paidAtKst: unixToKst(paidAtUnix),
    payType: parseString(payment.pay_type),
    pgType: parseString(payment.pg_type),
    totalPrice: parseNumber(payment.total_price),
    deliveryPrice: parseNumber(payment.deliv_price),
    couponAmount: parseNumber(payment.coupon),
    paymentAmount: parseNumber(payment.payment_amount),
    deviceType: parseString(device.type),
  };
};

const fetchRecentImwebOrders = async (
  token: string,
  input: {
    startUnix: number;
    endUnix: number;
    maxPages: number;
    limit: number;
    delayMs: number;
    type?: "npay";
  },
) => {
  const orders = new Map<string, ImwebOrder>();
  let totalCount = 0;
  let totalPage = 0;
  const errors: string[] = [];
  let stopReason = "max_pages";

  for (let page = 1; page <= input.maxPages; page++) {
    const result = await fetchImwebOrdersPageWithRetry(token, page, input.limit, input.type);
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
    for (const order of normalized) {
      if (order.paidAtUnix >= input.startUnix && order.paidAtUnix < input.endUnix) {
        orders.set(order.orderNo, order);
      }
    }

    const newest = Math.max(...normalized.map((order) => order.paidAtUnix).filter(Boolean));
    const oldest = Math.min(...normalized.map((order) => order.paidAtUnix).filter(Boolean));
    if (Number.isFinite(newest) && newest < input.startUnix) {
      stopReason = "older_than_window";
      break;
    }
    if (Number.isFinite(oldest) && oldest < input.startUnix && orders.size > 0) {
      stopReason = "window_covered";
      break;
    }
    if (page >= totalPage) {
      stopReason = "total_page_reached";
      break;
    }
    await wait(input.delayMs);
  }

  return {
    orders: [...orders.values()].sort((a, b) => a.paidAtUnix - b.paidAtUnix),
    totalCount,
    totalPage,
    fetchedPagesLimit: input.maxPages,
    stopReason,
    errors,
  };
};

const queryGa4Purchases = async (bq: bigquery_v2.Bigquery, startSuffix: string, endSuffix: string) => {
  const valueExpr = "COALESCE(ep.value.string_value, CAST(ep.value.int_value AS STRING), CAST(ep.value.double_value AS STRING), CAST(ep.value.float_value AS STRING))";
  const rows = await runBigQuery(
    bq,
    `
      SELECT
        CAST(DIV(event_timestamp, 1000000) AS INT64) AS event_unix,
        FORMAT_TIMESTAMP('%Y-%m-%d %H:%M:%S', TIMESTAMP_MICROS(event_timestamp), 'Asia/Seoul') AS event_time_kst,
        COALESCE(ecommerce.transaction_id, (
          SELECT ep.value.string_value FROM UNNEST(event_params) ep WHERE ep.key = 'transaction_id'
        )) AS transaction_id,
        CASE
          WHEN STARTS_WITH(UPPER(COALESCE(ecommerce.transaction_id, (
            SELECT ep.value.string_value FROM UNNEST(event_params) ep WHERE ep.key = 'transaction_id'
          ), '')), 'NPAY') THEN 'npay_transaction_id'
          ELSE 'non_npay_ga4'
        END AS payment_method_guess,
        ROUND(COALESCE(ecommerce.purchase_revenue, 0)) AS revenue,
        (SELECT ${valueExpr} FROM UNNEST(event_params) ep WHERE ep.key = 'page_location' LIMIT 1) AS page_location,
        COALESCE(
          session_traffic_source_last_click.cross_channel_campaign.source,
          session_traffic_source_last_click.manual_campaign.source,
          IF(session_traffic_source_last_click.google_ads_campaign.campaign_id IS NOT NULL, 'google_ads', NULL),
          '(missing)'
        ) AS source_key,
        COALESCE(
          session_traffic_source_last_click.cross_channel_campaign.medium,
          session_traffic_source_last_click.manual_campaign.medium,
          '(missing)'
        ) AS medium_key,
        ARRAY_TO_STRING(ARRAY(SELECT item.item_id FROM UNNEST(items) item LIMIT 5), ' + ') AS item_ids,
        ARRAY_TO_STRING(ARRAY(SELECT item.item_name FROM UNNEST(items) item LIMIT 5), ' + ') AS item_names
      FROM \`${COFFEE_PROJECT_ID}.${COFFEE_DATASET}.events_*\`
      WHERE _TABLE_SUFFIX BETWEEN '${startSuffix}' AND '${endSuffix}'
        AND event_name = 'purchase'
      ORDER BY event_timestamp ASC
    `,
  );

  return rows.map((row) => ({
    eventUnix: parseNumber(row.event_unix),
    eventTimeKst: parseString(row.event_time_kst),
    transactionId: parseString(row.transaction_id),
    paymentMethodGuess: parseString(row.payment_method_guess) === "npay_transaction_id"
      ? "npay_transaction_id"
      : "non_npay_ga4",
    revenue: parseNumber(row.revenue),
    pageLocation: parseString(row.page_location),
    sourceKey: parseString(row.source_key),
    mediumKey: parseString(row.medium_key),
    itemIds: parseString(row.item_ids),
    itemNames: parseString(row.item_names),
  })) satisfies Ga4Purchase[];
};

const sum = <T>(items: T[], pick: (item: T) => number) =>
  items.reduce((total, item) => total + pick(item), 0);

const groupImwebByPayType = (orders: ImwebOrder[]) => {
  const groups = new Map<string, { orders: number; amount: number; channelOrderNoFilled: number }>();
  for (const order of orders) {
    const key = order.payType || "(blank)";
    const current = groups.get(key) ?? { orders: 0, amount: 0, channelOrderNoFilled: 0 };
    current.orders += 1;
    current.amount += order.paymentAmount;
    if (order.channelOrderNo) current.channelOrderNoFilled += 1;
    groups.set(key, current);
  }
  return [...groups.entries()]
    .map(([payType, value]) => ({ payType, ...value }))
    .sort((a, b) => b.orders - a.orders || b.amount - a.amount);
};

const queryOperationalCrossChecks = async (
  pool: Pool,
  orderNos: string[],
  startDate: string,
  endDate: string,
) => {
  const toss = await pool.query(
    `
      SELECT
        regexp_replace(COALESCE(order_id, ''), '-P[0-9]+$', '') AS order_no,
        status,
        COUNT(*)::int AS rows,
        ROUND(SUM(COALESCE(total_amount, 0)::numeric))::text AS gross,
        ROUND(SUM(COALESCE(total_amount, 0)::numeric - COALESCE(cancel_amount, 0)::numeric))::text AS net
      FROM public.tb_sales_toss
      WHERE store='coffee'
        AND (
          regexp_replace(COALESCE(order_id, ''), '-P[0-9]+$', '') = ANY($1::text[])
          OR SUBSTRING(COALESCE(approved_at, ''), 1, 10) BETWEEN $2 AND $3
        )
      GROUP BY order_no, status
    `,
    [orderNos, startDate, endDate],
  );

  const playauto = await pool.query(
    `
      SELECT
        split_part(shop_ord_no, ' ', 1) AS order_no,
        MAX(ord_status) AS status,
        COUNT(*)::int AS item_rows,
        STRING_AGG(DISTINCT shop_sale_name, ' + ' ORDER BY shop_sale_name) AS product_names,
        SUM(COALESCE(sale_cnt, 0))::int AS quantity
      FROM public.tb_playauto_orders
      WHERE shop_name='아임웹-C'
        AND (
          split_part(shop_ord_no, ' ', 1) = ANY($1::text[])
          OR SUBSTRING(COALESCE(pay_time, ''), 1, 10) BETWEEN $2 AND $3
        )
      GROUP BY order_no
    `,
    [orderNos, startDate, endDate],
  );

  const unsafeIamweb = await pool.query(
    `
      SELECT
        COUNT(*)::int AS matched_rows,
        COUNT(DISTINCT order_number)::int AS matched_orders,
        MAX(order_date) AS latest_order_date
      FROM public.tb_iamweb_users
      WHERE order_number = ANY($1::text[])
    `,
    [orderNos],
  );

  return {
    tossRows: toss.rows,
    playautoRows: playauto.rows,
    tbIamwebUsersMatch: unsafeIamweb.rows[0] ?? null,
  };
};

const queryLocalImwebFreshness = () => {
  const dbPath = path.resolve(__dirname, "..", "data", "crm.sqlite3");
  const db = new Database(dbPath, { readonly: true });
  try {
    return db.prepare(
      `
        SELECT
          site,
          COUNT(*) AS orders,
          MIN(order_time) AS first_order,
          MAX(order_time) AS latest_order,
          MAX(synced_at) AS latest_synced_at,
          COALESCE(SUM(payment_amount), 0) AS amount
        FROM imweb_orders
        WHERE site=?
        GROUP BY site
      `,
    ).get(SITE) as Record<string, unknown> | undefined;
  } finally {
    db.close();
  }
};

const buildMatches = (ga4: Ga4Purchase[], imweb: ImwebOrder[]) => {
  const byOrderNo = new Map(imweb.map((order) => [order.orderNo, order]));
  const byChannelOrderNo = new Map(imweb.filter((order) => order.channelOrderNo).map((order) => [order.channelOrderNo, order]));
  const exactMatches = ga4
    .map((purchase) => {
      const byOrder = byOrderNo.get(purchase.transactionId);
      const byChannel = byChannelOrderNo.get(purchase.transactionId);
      const order = byOrder ?? byChannel;
      if (!order) return null;
      return {
        transactionId: purchase.transactionId,
        matchKey: byOrder ? "order_no" : "channel_order_no",
        orderNo: order.orderNo,
        channelOrderNo: order.channelOrderNo,
        ga4Revenue: purchase.revenue,
        imwebPaymentAmount: order.paymentAmount,
        delta: purchase.revenue - order.paymentAmount,
        paymentMethodGuess: purchase.paymentMethodGuess,
      };
    })
    .filter(Boolean);
  return exactMatches;
};

const normalizeText = (value: string) =>
  value
    .replace(/\u00a0/g, " ")
    .replace(/[└()\[\]{}]/g, " ")
    .replace(/추가구매/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const productOverlapScore = (left: string, right: string) => {
  const l = normalizeText(left);
  const r = normalizeText(right);
  if (!l || !r) return 0;
  if (l.includes(r) || r.includes(l)) return 20;
  const tokens = [...new Set(l.split(/[\s/+,:*]+/).filter((token) => token.length >= 2))];
  if (tokens.length === 0) return 0;
  const overlap = tokens.filter((token) => r.includes(token)).length;
  const ratio = overlap / tokens.length;
  if (ratio >= 0.6) return 16;
  if (ratio >= 0.35) return 10;
  return 0;
};

const classifyAmountMatch = (order: ImwebOrder, ga4Revenue: number): { type: AmountMatchType; delta: number; reason: string } => {
  const finalDelta = ga4Revenue - order.paymentAmount;
  if (finalDelta === 0) return { type: "final_exact", delta: 0, reason: "ga4_revenue_equals_payment_amount" };

  if (order.deliveryPrice > 0 && order.paymentAmount === order.totalPrice + order.deliveryPrice) {
    const shippingDelta = order.paymentAmount - ga4Revenue;
    if (shippingDelta === order.deliveryPrice) {
      return {
        type: "shipping_reconciled",
        delta: shippingDelta,
        reason: "ga4_revenue_excludes_delivery_price",
      };
    }
  }

  const itemDelta = ga4Revenue - order.totalPrice;
  if (itemDelta === 0) return { type: "item_exact", delta: itemDelta, reason: "ga4_revenue_equals_item_total" };

  if (order.couponAmount > 0 && order.paymentAmount === order.totalPrice + order.deliveryPrice - order.couponAmount) {
    return {
      type: "discount_reconciled",
      delta: finalDelta,
      reason: "payment_amount_reconciles_with_discount_or_coupon",
    };
  }

  if (Math.abs(finalDelta) <= 1000) return { type: "near_exact", delta: finalDelta, reason: "within_1000_won" };
  return { type: "none", delta: finalDelta, reason: "not_reconciled" };
};

const countBy = <T>(items: T[], pick: (item: T) => string) => {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = pick(item) || "(blank)";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Object.fromEntries([...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
};

const buildNpayActualGa4Candidates = (
  imwebNpayOrders: ImwebOrder[],
  ga4NpayPurchases: Ga4Purchase[],
  playautoRows: PlayautoOrderEvidence[],
) => {
  const playautoByOrderNo = new Map(playautoRows.map((row) => [row.orderNo, row]));
  const amountOrderCounts = new Map<number, number>();
  for (const order of imwebNpayOrders) {
    amountOrderCounts.set(order.paymentAmount, (amountOrderCounts.get(order.paymentAmount) ?? 0) + 1);
  }

  const decisions = imwebNpayOrders.map((order) => {
    const playauto = playautoByOrderNo.get(order.orderNo);
    const candidates = ga4NpayPurchases
      .map((purchase) => {
        const amountMatch = classifyAmountMatch(order, purchase.revenue);
        const amountDelta = amountMatch.delta;
        const absAmountDelta = Math.abs(amountDelta);
        const timeGapMinutes = Math.abs(purchase.eventUnix - order.paidAtUnix) / 60;
        const amountScore =
          amountMatch.type === "final_exact"
            ? 45
            : amountMatch.type === "shipping_reconciled" || amountMatch.type === "discount_reconciled"
              ? 38
              : amountMatch.type === "item_exact"
                ? 34
                : absAmountDelta <= 1000
                  ? 30
                  : absAmountDelta <= 3000
                    ? 16
                    : 0;
        const timeScore = timeGapMinutes <= 2 ? 35 : timeGapMinutes <= 10 ? 25 : timeGapMinutes <= 60 ? 10 : 0;
        const productScore = playauto ? productOverlapScore(playauto.productNames, purchase.itemNames) : 0;
        const score = amountScore + timeScore + productScore;
        return {
          transactionId: purchase.transactionId,
          eventTimeKst: purchase.eventTimeKst,
          eventUnix: purchase.eventUnix,
          revenue: purchase.revenue,
          pageLocation: purchase.pageLocation,
          itemIds: purchase.itemIds,
          itemNames: purchase.itemNames,
          sourceKey: purchase.sourceKey,
          mediumKey: purchase.mediumKey,
          amountDelta,
          amountMatchType: amountMatch.type,
          amountReconcileReason: amountMatch.reason,
          timeGapMinutes: Number(timeGapMinutes.toFixed(2)),
          productScore,
          amountScore,
          timeScore,
          score,
        };
      })
      .filter((candidate) => candidate.score >= 25)
      .sort((a, b) => b.score - a.score || a.timeGapMinutes - b.timeGapMinutes)
      .slice(0, 5);

    const best = candidates[0] ?? null;
    const second = candidates[1] ?? null;
    const scoreGap = best ? best.score - (second?.score ?? 0) : 0;
    const ambiguousReasons: string[] = [];
    if (!best) ambiguousReasons.push("no_ga4_candidate_above_threshold");
    if (candidates.length > 1) ambiguousReasons.push("multiple_ga4_candidates");
    if (best && scoreGap < 15) ambiguousReasons.push("low_score_gap");
    if (best && best.timeGapMinutes > 10) ambiguousReasons.push("weak_time_gap");
    if (best && best.amountMatchType === "none") ambiguousReasons.push("amount_not_reconciled");
    if (best && best.productScore === 0) ambiguousReasons.push("product_name_variant_or_no_overlap");
    if (!playauto) ambiguousReasons.push("no_product_evidence");
    if ((amountOrderCounts.get(order.paymentAmount) ?? 0) > 1) ambiguousReasons.push("same_amount_many_orders");

    const status = !best
      ? "actual_without_ga4_candidate"
      : best.score >= 80 && scoreGap >= 20
        ? "strong_match"
        : best.score >= 65 && scoreGap >= 15
          ? "probable_match"
          : "ambiguous";

    return {
      orderNo: order.orderNo,
      channelOrderNo: order.channelOrderNo,
      paidAtKst: order.paidAtKst,
      paymentAmount: order.paymentAmount,
      productNames: playauto?.productNames ?? "",
      playautoStatus: playauto?.status ?? "",
      status,
      bestScore: best?.score ?? 0,
      secondScore: second?.score ?? 0,
      scoreGap,
      bestTransactionId: best?.transactionId ?? "",
      bestTimeGapMinutes: best?.timeGapMinutes ?? null,
      bestAmountDelta: best?.amountDelta ?? null,
      bestAmountMatchType: best?.amountMatchType ?? null,
      bestAmountReconcileReason: best?.amountReconcileReason ?? null,
      ambiguousReasons: status === "ambiguous" || status === "actual_without_ga4_candidate" ? ambiguousReasons : [],
      candidates,
    };
  });

  const matchedTransactionIds = new Set(
    decisions
      .filter((decision) => decision.status === "strong_match" || decision.status === "probable_match")
      .map((decision) => decision.bestTransactionId)
      .filter(Boolean),
  );
  const ga4WithoutActualCandidate = ga4NpayPurchases.filter((purchase) => !matchedTransactionIds.has(purchase.transactionId));

  return {
    decisions,
    summary: {
      strongMatch: decisions.filter((decision) => decision.status === "strong_match").length,
      probableMatch: decisions.filter((decision) => decision.status === "probable_match").length,
      ambiguous: decisions.filter((decision) => decision.status === "ambiguous").length,
      actualWithoutGa4Candidate: decisions.filter((decision) => decision.status === "actual_without_ga4_candidate").length,
      ga4WithoutActualCandidate: ga4WithoutActualCandidate.length,
      ambiguousReasonSummary: countBy(
        decisions.flatMap((decision) => decision.ambiguousReasons),
        (reason) => reason,
      ),
      bestAmountMatchTypeSummary: countBy(decisions, (decision) => decision.bestAmountMatchType ?? "no_candidate"),
    },
    mismatchSummary: {
      orderCountDelta: imwebNpayOrders.length - ga4NpayPurchases.length,
      revenueDelta: sum(imwebNpayOrders, (order) => order.paymentAmount) - sum(ga4NpayPurchases, (purchase) => purchase.revenue),
      imwebNpayOrders: imwebNpayOrders.length,
      imwebNpayRevenue: sum(imwebNpayOrders, (order) => order.paymentAmount),
      ga4NpayPatternEvents: ga4NpayPurchases.length,
      ga4NpayPatternRevenue: sum(ga4NpayPurchases, (purchase) => purchase.revenue),
    },
    needsReviewOrders: decisions
      .filter((decision) => decision.status === "ambiguous" || decision.status === "actual_without_ga4_candidate")
      .slice(0, 50),
    ga4WithoutActualCandidate: ga4WithoutActualCandidate.slice(0, 20),
  };
};

const main = async () => {
  const args = parseArgs();
  const { startUnix, endUnix } = kstWindowToUnix(args.startDate, args.endDate);
  const [token, bq, pool] = await Promise.all([
    fetchImwebToken(),
    Promise.resolve(createBigQueryClient()),
    Promise.resolve(createPgPool()),
  ]);

  try {
    const [imwebAll, imwebNpay, ga4Purchases] = await Promise.all([
      fetchRecentImwebOrders(token, { startUnix, endUnix, maxPages: args.maxPages, limit: args.limit, delayMs: args.delayMs }),
      fetchRecentImwebOrders(token, { startUnix, endUnix, maxPages: args.maxPages, limit: args.limit, delayMs: args.delayMs, type: "npay" }),
      queryGa4Purchases(bq, args.startSuffix, args.endSuffix),
    ]);
    const orderNos = [...new Set(imwebAll.orders.map((order) => order.orderNo))];
    const operational = await queryOperationalCrossChecks(pool, orderNos, args.startDate, args.endDate);
    const localImwebFreshness = queryLocalImwebFreshness();
    const exactGa4ImwebMatches = buildMatches(ga4Purchases, imwebAll.orders);

    const ga4Npay = ga4Purchases.filter((purchase) => purchase.paymentMethodGuess === "npay_transaction_id");
    const ga4NonNpay = ga4Purchases.filter((purchase) => purchase.paymentMethodGuess !== "npay_transaction_id");
    const playautoEvidence = operational.playautoRows.map((row) => ({
      orderNo: parseString(row.order_no),
      status: parseString(row.status),
      itemRows: parseNumber(row.item_rows),
      productNames: parseString(row.product_names),
      quantity: parseNumber(row.quantity),
    })) satisfies PlayautoOrderEvidence[];
    const playautoMatchedOrderNos = new Set(playautoEvidence.map((row) => row.orderNo).filter(Boolean));
    const tossMatchedOrderNos = new Set(operational.tossRows.map((row) => parseString(row.order_no)).filter(Boolean));
    const npayActualGa4Match = buildNpayActualGa4Candidates(imwebNpay.orders, ga4Npay, playautoEvidence);

    const payload = {
      ok: true,
      checkedAt: new Date().toISOString(),
      site: SITE,
      mode: "read_only",
      window: {
        startSuffix: args.startSuffix,
        endSuffix: args.endSuffix,
        startDate: args.startDate,
        endDate: args.endDate,
      },
      sourceFreshness: {
        imwebApi: {
          allTotalCount: imwebAll.totalCount,
          allTotalPage: imwebAll.totalPage,
          allStopReason: imwebAll.stopReason,
          npayTotalCount: imwebNpay.totalCount,
          npayTotalPage: imwebNpay.totalPage,
          npayStopReason: imwebNpay.stopReason,
          errors: [...imwebAll.errors, ...imwebNpay.errors],
        },
        localImwebFreshness,
        operationalDb: {
          tossStore: "coffee",
          playautoShopName: "아임웹-C",
          tbIamwebUsers: "checked only as unsafe/unscoped; not used as coffee primary",
        },
        bigQuery: {
          projectId: COFFEE_PROJECT_ID,
          dataset: COFFEE_DATASET,
          location: COFFEE_LOCATION,
        },
      },
      summary: {
        imwebApiOrders: imwebAll.orders.length,
        imwebApiRevenue: sum(imwebAll.orders, (order) => order.paymentAmount),
        imwebApiNpayOrders: imwebNpay.orders.length,
        imwebApiNpayRevenue: sum(imwebNpay.orders, (order) => order.paymentAmount),
        imwebApiNpayChannelOrderNoFilled: imwebNpay.orders.filter((order) => order.channelOrderNo).length,
        ga4PurchaseEvents: ga4Purchases.length,
        ga4Revenue: sum(ga4Purchases, (purchase) => purchase.revenue),
        ga4NpayPatternEvents: ga4Npay.length,
        ga4NpayPatternRevenue: sum(ga4Npay, (purchase) => purchase.revenue),
        ga4NonNpayEvents: ga4NonNpay.length,
        ga4NonNpayRevenue: sum(ga4NonNpay, (purchase) => purchase.revenue),
        ga4ExactImwebMatches: exactGa4ImwebMatches.length,
        npayActualStrongMatch: npayActualGa4Match.summary.strongMatch,
        npayActualProbableMatch: npayActualGa4Match.summary.probableMatch,
        npayActualAmbiguous: npayActualGa4Match.summary.ambiguous,
        npayActualWithoutGa4Candidate: npayActualGa4Match.summary.actualWithoutGa4Candidate,
        ga4NpayWithoutActualCandidate: npayActualGa4Match.summary.ga4WithoutActualCandidate,
        imwebOrdersWithTossRows: orderNos.filter((orderNo) => tossMatchedOrderNos.has(orderNo)).length,
        imwebOrdersWithPlayautoRows: orderNos.filter((orderNo) => playautoMatchedOrderNos.has(orderNo)).length,
        tbIamwebUsersMatchedOrders: parseNumber((operational.tbIamwebUsersMatch as Record<string, unknown> | null)?.matched_orders),
      },
      imwebPayTypeSummary: groupImwebByPayType(imwebAll.orders),
      operationalSummary: {
        tossRows: operational.tossRows,
        playautoMatchedOrders: operational.playautoRows.length,
        playautoSample: operational.playautoRows.slice(0, 10),
        tbIamwebUsersMatch: operational.tbIamwebUsersMatch,
      },
      exactGa4ImwebMatches,
      npayActualGa4Match: {
        summary: npayActualGa4Match.summary,
        mismatchSummary: npayActualGa4Match.mismatchSummary,
        needsReviewOrders: npayActualGa4Match.needsReviewOrders,
        decisions: npayActualGa4Match.decisions,
        ga4WithoutActualCandidate: npayActualGa4Match.ga4WithoutActualCandidate,
      },
      sampleOrders: {
        imwebNpay: imwebNpay.orders.slice(-10),
        imwebAllRecent: imwebAll.orders.slice(-10),
        ga4NpayPattern: ga4Npay.slice(0, 10),
      },
      interpretation: {
        primaryOrderSource: "Imweb v2 API for coffee order header/payment/channel_order_no",
        crossChecks: [
          "operational_postgres.public.tb_sales_toss store=coffee for Toss/card payments",
          "operational_postgres.public.tb_playauto_orders shop_name='아임웹-C' for product/status line evidence",
          "GA4 BigQuery analytics_326949178 for already-in-GA4 guard",
        ],
        notPrimary: [
          "operational_postgres.public.tb_iamweb_users has no site column and matched 0 sampled coffee order_no values; do not use as coffee primary unless site isolation is proven",
          "local SQLite imweb_orders is stale and should be used as historical fallback only",
        ],
      },
      guardrails: {
        dbWrite: false,
        imwebWrite: false,
        ga4Send: false,
        metaSend: false,
        tiktokSend: false,
        googleAdsSend: false,
        gtmPublish: false,
        endpointDeploy: false,
      },
    };

    console.log(JSON.stringify(payload, null, 2));
  } finally {
    await pool.end();
  }
};

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
