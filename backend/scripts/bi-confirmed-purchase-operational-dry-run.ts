#!/usr/bin/env tsx
import fs from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";
import dotenv from "dotenv";
import { google, type bigquery_v2 } from "googleapis";

import {
  buildNpayRoasDryRunReport,
  type NpayRoasDryRunOrderResult,
} from "../src/npayRoasDryRun";
import { queryPg } from "../src/postgres";

dotenv.config({ path: path.resolve(__dirname, "..", ".env"), quiet: true });

const DEFAULT_VM_DB = path.resolve(__dirname, "..", "data", "vm-npay-intent-20260505.sqlite3");
const DEFAULT_SOURCE_PROJECT_ID = "hurdlers-naver-pay";
const DEFAULT_JOB_PROJECT_ID = "project-dadba7dd-0229-4ff6-81c";
const DEFAULT_DATASET = `analytics_${process.env.GA4_BIOCOM_PROPERTY_ID?.trim() || "304759974"}`;
const DEFAULT_LOCATION = "asia-northeast3";

type CliOptions = {
  start: string;
  end: string;
  site: "biocom";
  vmDbPath: string;
  output?: string;
  markdownOutput?: string;
  limit: number;
  skipBigQuery: boolean;
  sourceProjectId: string;
  jobProjectId: string;
  dataset: string;
  location: string;
};

type PgOrderRow = {
  orderNumber: string;
  channelOrderNo: string | null;
  paidAt: string | Date | null;
  paymentMethod: string;
  paymentStatus: string;
  orderAmount: string | number | null;
  orderItemTotal: string | number | null;
  deliveryPrice: string | number | null;
  refundAmount: string | number | null;
  productNames: string | null;
  hasCancel: boolean;
  hasReturn: boolean;
  isNpay: boolean;
};

type ImwebOperationalFreshness = {
  rowCount: number;
  sourceMaxPaymentCompleteAt: string;
  sourceMaxOrderDateAt: string;
  sourceLagHours: number | null;
  freshnessStatus: "fresh" | "warn" | "stale" | "unknown";
};

type VmLedgerRow = {
  entry_id: string;
  logged_at: string;
  approved_at: string;
  order_id: string;
  payment_key: string;
  landing: string;
  referrer: string;
  ga_session_id: string;
  gclid: string;
  fbclid: string;
  ttclid: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_term: string;
  utm_content: string;
  source: string;
  metadata_json: string;
  request_context_json: string;
};

type VmIntentRow = {
  id: string;
  intent_key: string;
  captured_at: string;
  client_id: string | null;
  ga_session_id: string | null;
  gclid: string | null;
  gbraid: string | null;
  wbraid: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  page_location: string | null;
  matched_order_no: string | null;
};

type Ga4GuardStatus = "present" | "robust_absent" | "unknown";

type OperationalCandidate = {
  site: "biocom";
  order_number: string;
  channel_order_no: string;
  payment_method: "npay" | "homepage" | "unknown";
  payment_status: "confirmed" | "canceled" | "refunded" | "excluded";
  conversion_time: string;
  value: number;
  currency: "KRW";
  vm_evidence: {
    matched: boolean;
    matched_by: "order_number" | "channel_order_no" | "payment_key" | "none";
    entry_id: string;
    source: string;
    logged_at: string;
    ga_session_id: string;
    client_id: string;
    gclid: string;
    gbraid: string;
    wbraid: string;
    fbclid: string;
    utm_source: string;
    utm_medium: string;
    utm_campaign: string;
  };
  ga4_guard: {
    status: Ga4GuardStatus;
    matched_ids: string[];
  };
  would_be_eligible_after_approval: boolean;
  send_candidate: false;
  block_reasons: string[];
  include_reason: "homepage_confirmed_order" | "npay_confirmed_order";
};

const argValue = (name: string) =>
  process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);

const parseDate = (label: string, value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`${label} must be YYYY-MM-DD: ${value}`);
  return value;
};

const parseArgs = (): CliOptions => ({
  start: parseDate("start", argValue("start") ?? "2026-04-27"),
  end: parseDate("end", argValue("end") ?? "2026-05-05"),
  site: "biocom",
  vmDbPath: path.resolve(argValue("vm-db") ?? argValue("vmDb") ?? DEFAULT_VM_DB),
  output: argValue("output"),
  markdownOutput: argValue("markdown-output") ?? argValue("markdownOutput"),
  limit: Math.max(1, Number(argValue("limit") ?? "5000")),
  skipBigQuery: process.argv.includes("--skip-bigquery"),
  sourceProjectId: argValue("source-project") ?? argValue("project") ?? DEFAULT_SOURCE_PROJECT_ID,
  jobProjectId: argValue("job-project") ?? DEFAULT_JOB_PROJECT_ID,
  dataset: argValue("dataset") ?? DEFAULT_DATASET,
  location: argValue("location") ?? DEFAULT_LOCATION,
});

const toNumber = (value: unknown): number => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const stringFrom = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  return String(value).trim();
};

const isoFrom = (value: unknown): string => {
  if (value instanceof Date) return value.toISOString();
  const raw = stringFrom(value);
  if (!raw) return "";
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? raw : parsed.toISOString();
};

const safeJson = (raw: string): Record<string, unknown> => {
  try {
    const parsed = JSON.parse(raw || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
};

const nestedRecord = (obj: Record<string, unknown>, key: string): Record<string, unknown> => {
  const value = obj[key];
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
};

const pickUrlParam = (urlText: string, key: string): string => {
  if (!urlText) return "";
  for (const candidate of [urlText, safeDecode(urlText)]) {
    try {
      const url = new URL(candidate);
      const value = url.searchParams.get(key);
      if (value) return value.trim();
    } catch {
      const match = candidate.match(new RegExp(`[?&]${key}=([^&#]+)`));
      if (match?.[1]) return safeDecode(match[1]).trim();
    }
  }
  return "";
};

const safeDecode = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const bqString = (value: string) => `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;

const suffix = (date: string) => date.replaceAll("-", "");

const kstStartOfDay = (date: string) => `${date}T00:00:00+09:00`;

const nextDay = (date: string) => {
  const parsed = new Date(`${date}T00:00:00+09:00`);
  parsed.setUTCDate(parsed.getUTCDate() + 1);
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(parsed);
};

const kstNow = () =>
  `${new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date())} KST`;

const readOperationalOrders = async (options: CliOptions): Promise<PgOrderRow[]> => {
  const result = await queryPg<PgOrderRow>(
    `
    WITH raw AS (
      SELECT
        order_number::text AS order_number,
        COALESCE(NULLIF(TRIM(raw_data ->> 'channelOrderNo'), ''), '') AS channel_order_no,
        COALESCE(NULLIF(TRIM(product_name::text), ''), '미분류') AS product_name,
        COALESCE(NULLIF(TRIM(payment_method::text), ''), '(blank)') AS payment_method,
        COALESCE(NULLIF(TRIM(payment_status::text), ''), '(blank)') AS payment_status,
        CASE
          WHEN TRIM(COALESCE(payment_complete_time::text, '')) ~ '^\\d{4}-\\d{2}-\\d{2}'
            THEN payment_complete_time::timestamptz
          WHEN TRIM(COALESCE(order_date::text, '')) ~ '^\\d{4}-\\d{2}-\\d{2}'
            THEN order_date::timestamptz
          ELSE NULL
        END AS paid_at,
        NULLIF(final_order_amount, 0)::numeric AS final_order_amount,
        NULLIF(paid_price, 0)::numeric AS paid_price,
        NULLIF(total_price, 0)::numeric AS total_price,
        COALESCE(NULLIF(total_refunded_price, 0), 0)::numeric AS total_refunded_price,
        COALESCE(NULLIF(delivery_price, 0), 0)::numeric AS delivery_price,
        COALESCE(NULLIF(cancellation_reason::text, ''), '') AS cancellation_reason,
        COALESCE(NULLIF(return_reason::text, ''), '') AS return_reason
      FROM public.tb_iamweb_users
      WHERE order_number IS NOT NULL
    ),
    order_level AS (
      SELECT
        order_number AS "orderNumber",
        MAX(channel_order_no) AS "channelOrderNo",
        MIN(paid_at) AS "paidAt",
        MAX(payment_method) AS "paymentMethod",
        MAX(payment_status) AS "paymentStatus",
        COALESCE(MAX(final_order_amount), SUM(COALESCE(paid_price, total_price, 0)), MAX(total_price), 0)::numeric AS "orderAmount",
        SUM(COALESCE(total_price, 0))::numeric AS "orderItemTotal",
        COALESCE(MAX(delivery_price), 0)::numeric AS "deliveryPrice",
        COALESCE(MAX(total_refunded_price), 0)::numeric AS "refundAmount",
        STRING_AGG(DISTINCT product_name, ' + ' ORDER BY product_name) AS "productNames",
        BOOL_OR(cancellation_reason NOT IN ('', 'nan', 'null')) AS "hasCancel",
        BOOL_OR(return_reason NOT IN ('', 'nan', 'null')) AS "hasReturn",
        BOOL_OR(payment_method ~* '(naver|npay)' OR payment_method LIKE '%네이버%' OR channel_order_no <> '') AS "isNpay"
      FROM raw
      GROUP BY order_number
    )
    SELECT *
    FROM order_level
    WHERE "paidAt" >= $1::timestamptz
      AND "paidAt" < ($2::date + INTERVAL '1 day')::timestamptz
      AND "orderAmount" > 0
      AND "paymentStatus" NOT IN (
        'REFUND_COMPLETE',
        'PARTIAL_REFUND_COMPLETE',
        'CANCELLED_BEFORE_DEPOSIT',
        'PAYMENT_OVERDUE',
        'PAYMENT_PREPARATION'
      )
      AND LOWER("paymentStatus") NOT LIKE '%refund%'
      AND LOWER("paymentStatus") NOT LIKE '%cancel%'
    ORDER BY "paidAt" ASC
    LIMIT $3
    `,
    [options.start, options.end, options.limit],
  );
  return result.rows;
};

const classifyFreshnessStatus = (lagHours: number | null): ImwebOperationalFreshness["freshnessStatus"] => {
  if (lagHours === null) return "unknown";
  if (lagHours >= 36) return "stale";
  if (lagHours >= 24) return "warn";
  return "fresh";
};

const hoursBetween = (fromIso: string, toIso: string) => {
  const from = Date.parse(fromIso);
  const to = Date.parse(toIso);
  if (Number.isNaN(from) || Number.isNaN(to)) return null;
  return Math.round(((to - from) / 3_600_000) * 10) / 10;
};

const readImwebOperationalFreshness = async (referenceAtIso: string): Promise<ImwebOperationalFreshness> => {
  const result = await queryPg<{
    rowCount: string | number;
    sourceMaxPaymentCompleteAt: string | Date | null;
    sourceMaxOrderDateAt: string | Date | null;
  }>(
    `
      SELECT
        COUNT(*)::bigint AS "rowCount",
        MAX(
          CASE
            WHEN TRIM(COALESCE(payment_complete_time::text, '')) ~ '^\\d{4}-\\d{2}-\\d{2}'
              THEN payment_complete_time::timestamptz
            ELSE NULL
          END
        ) AS "sourceMaxPaymentCompleteAt",
        MAX(
          CASE
            WHEN TRIM(COALESCE(order_date::text, '')) ~ '^\\d{4}-\\d{2}-\\d{2}'
              THEN order_date::timestamptz
            ELSE NULL
          END
        ) AS "sourceMaxOrderDateAt"
      FROM public.tb_iamweb_users
    `,
    [],
  );
  const row = result.rows[0];
  const sourceMaxPaymentCompleteAt = isoFrom(row?.sourceMaxPaymentCompleteAt);
  const sourceMaxOrderDateAt = isoFrom(row?.sourceMaxOrderDateAt);
  const sourceLagHours = sourceMaxPaymentCompleteAt ? hoursBetween(sourceMaxPaymentCompleteAt, referenceAtIso) : null;
  return {
    rowCount: toNumber(row?.rowCount),
    sourceMaxPaymentCompleteAt,
    sourceMaxOrderDateAt,
    sourceLagHours,
    freshnessStatus: classifyFreshnessStatus(sourceLagHours),
  };
};

const indexVmLedger = (dbPath: string) => {
  const db = new Database(dbPath, { readonly: true, fileMustExist: true });
  try {
    const rows = db
      .prepare(
        `
        SELECT
          entry_id, logged_at, approved_at, order_id, payment_key, landing, referrer,
          ga_session_id, gclid, fbclid, ttclid, utm_source, utm_medium,
          utm_campaign, utm_term, utm_content, source, metadata_json, request_context_json
        FROM attribution_ledger
        WHERE touchpoint = 'payment_success'
          AND payment_status = 'confirmed'
          AND source = 'biocom_imweb'
        ORDER BY logged_at DESC
        `,
      )
      .all() as VmLedgerRow[];

    const byKey = new Map<string, VmLedgerRow>();
    for (const row of rows) {
      const metadata = safeJson(row.metadata_json);
      const referrerPayment = nestedRecord(metadata, "referrerPayment");
      const keys = [
        row.order_id,
        row.payment_key,
        stringFrom(referrerPayment.orderNo),
        stringFrom(referrerPayment.orderId),
        stringFrom(referrerPayment.channelOrderNo),
        stringFrom(metadata.order_number),
      ].filter(Boolean);
      for (const key of keys) {
        if (!byKey.has(key)) byKey.set(key, row);
      }
    }
    return { rows, byKey };
  } finally {
    db.close();
  }
};

const indexVmNpayIntents = (dbPath: string) => {
  const db = new Database(dbPath, { readonly: true, fileMustExist: true });
  try {
    const rows = db
      .prepare(
        `
        SELECT
          id, intent_key, captured_at, client_id, ga_session_id, gclid, gbraid,
          wbraid, utm_source, utm_medium, utm_campaign, page_location, matched_order_no
        FROM npay_intent_log
        WHERE site = 'biocom'
          AND environment = 'live'
        ORDER BY captured_at DESC
        `,
      )
      .all() as VmIntentRow[];
    const byOrder = new Map<string, VmIntentRow>();
    for (const row of rows) {
      const order = stringFrom(row.matched_order_no);
      if (order && !byOrder.has(order)) byOrder.set(order, row);
    }
    return { rows, byOrder };
  } finally {
    db.close();
  }
};

const parseServiceAccount = () => {
  const raw = process.env.GA4_BIOCOM_SERVICE_ACCOUNT_KEY?.trim() || process.env.GA4_SERVICE_ACCOUNT_KEY?.trim();
  if (!raw) throw new Error("GA4_BIOCOM_SERVICE_ACCOUNT_KEY or GA4_SERVICE_ACCOUNT_KEY is required");
  const parsed = JSON.parse(raw) as { client_email?: string; private_key?: string; project_id?: string };
  if (!parsed.client_email || !parsed.private_key) {
    throw new Error("service account key must include client_email and private_key");
  }
  return parsed;
};

const createBigQueryClient = () => {
  const key = parseServiceAccount();
  const auth = new google.auth.JWT({
    email: key.client_email,
    key: key.private_key,
    scopes: [
      "https://www.googleapis.com/auth/bigquery.readonly",
      "https://www.googleapis.com/auth/cloud-platform.read-only",
    ],
  });
  return {
    bq: google.bigquery({ version: "v2", auth }),
    credential: {
      clientEmail: key.client_email,
      projectId: key.project_id,
    },
  };
};

const eventParamValueExpr =
  "COALESCE(ep.value.string_value, CAST(ep.value.int_value AS STRING), CAST(ep.value.double_value AS STRING), CAST(ep.value.float_value AS STRING))";

const buildGa4GuardQuery = (ids: string[], options: CliOptions) => `
WITH ids AS (
  SELECT id FROM UNNEST([${ids.map(bqString).join(", ")}]) AS id
),
raw AS (
  SELECT
    event_name,
    event_timestamp,
    ecommerce.transaction_id AS ecommerce_transaction_id,
    (SELECT ep.value.string_value FROM UNNEST(event_params) ep WHERE ep.key = 'transaction_id') AS param_transaction_id,
    ARRAY(
      SELECT ${eventParamValueExpr}
      FROM UNNEST(event_params) ep
      WHERE ${eventParamValueExpr} IS NOT NULL
    ) AS event_param_values
  FROM \`${options.sourceProjectId}.${options.dataset}.events_*\`
  WHERE (
    REGEXP_CONTAINS(_TABLE_SUFFIX, r'^\\d{8}$')
    AND _TABLE_SUFFIX BETWEEN '${suffix(options.start)}' AND '${suffix(options.end)}'
  ) OR (
    STARTS_WITH(_TABLE_SUFFIX, 'intraday_')
    AND SUBSTR(_TABLE_SUFFIX, 10) BETWEEN '${suffix(options.start)}' AND '${suffix(options.end)}'
  )
),
matched AS (
  SELECT
    ids.id,
    raw.event_name,
    raw.event_timestamp
  FROM ids
  JOIN raw
    ON raw.ecommerce_transaction_id = ids.id
    OR raw.param_transaction_id = ids.id
    OR ids.id IN UNNEST(raw.event_param_values)
)
SELECT
  ids.id,
  COUNT(matched.event_name) AS events,
  COUNTIF(matched.event_name = 'purchase') AS purchase_events
FROM ids
LEFT JOIN matched USING (id)
GROUP BY ids.id
ORDER BY ids.id;
`;

const mapBigQueryRows = (response: bigquery_v2.Schema$QueryResponse): Record<string, unknown>[] => {
  const fields = response.schema?.fields ?? [];
  return (response.rows ?? []).map((row) =>
    Object.fromEntries((row.f ?? []).map((cell, index) => [fields[index]?.name ?? String(index), cell.v])),
  );
};

const runGa4Guard = async (ids: string[], options: CliOptions) => {
  if (options.skipBigQuery || ids.length === 0) {
    return new Map<string, Ga4GuardStatus>(ids.map((id) => [id, "unknown"]));
  }
  const { bq } = createBigQueryClient();
  const response = await bq.jobs.query({
    projectId: options.jobProjectId,
    requestBody: {
      query: buildGa4GuardQuery(ids, options),
      useLegacySql: false,
      location: options.location,
      timeoutMs: 120_000,
      maxResults: 10_000,
    },
  });
  if (!response.data.jobComplete) throw new Error("BigQuery guard job did not complete in timeout");
  const map = new Map<string, Ga4GuardStatus>();
  for (const row of mapBigQueryRows(response.data)) {
    const id = stringFrom(row.id);
    const events = toNumber(row.events);
    const purchaseEvents = toNumber(row.purchase_events);
    map.set(id, events > 0 || purchaseEvents > 0 ? "present" : "robust_absent");
  }
  return map;
};

const extractClientId = (row: VmLedgerRow | null, intent: VmIntentRow | null) => {
  if (intent?.client_id) return stringFrom(intent.client_id);
  if (!row) return "";
  const metadata = safeJson(row.metadata_json);
  const candidates = [
    metadata.clientId,
    metadata.client_id,
    nestedRecord(metadata, "ga").clientId,
    nestedRecord(metadata, "ga").client_id,
  ];
  return candidates.map(stringFrom).find(Boolean) ?? "";
};

const extractNpayGoogleClickId = (
  result: NpayRoasDryRunOrderResult | null,
  key: "gclid" | "gbraid" | "wbraid",
) => {
  const candidate = result?.bestCandidate;
  if (!candidate) return "";
  const fromPage = pickUrlParam(candidate.pageLocation, key);
  if (fromPage) return fromPage;
  return candidate.adClickKeys.find((item) => item.startsWith(`${key}=`))?.slice(key.length + 1) ?? "";
};

const extractClickId = (row: VmLedgerRow | null, intent: VmIntentRow | null, key: "gclid" | "gbraid" | "wbraid") => {
  if (intent?.[key]) return stringFrom(intent[key]);
  if (!row) return "";
  const metadata = safeJson(row.metadata_json);
  const firstTouch = nestedRecord(metadata, "firstTouch");
  const direct = stringFrom(row[key as keyof VmLedgerRow]) || stringFrom(metadata[key]) || stringFrom(firstTouch[key]);
  if (direct) return direct;
  return pickUrlParam([row.landing, row.referrer, row.metadata_json, row.request_context_json].join(" "), key);
};

const classifyPaymentMethod = (order: PgOrderRow): "npay" | "homepage" | "unknown" => {
  if (order.isNpay) return "npay";
  const raw = `${order.paymentMethod || ""} ${order.channelOrderNo || ""}`.toLowerCase();
  if (/naver|npay|네이버/.test(raw)) return "npay";
  if (order.paymentMethod) return "homepage";
  return "unknown";
};

const buildCandidate = (
  order: PgOrderRow,
  vmByKey: Map<string, VmLedgerRow>,
  intentByOrder: Map<string, VmIntentRow>,
  npayByOrder: Map<string, NpayRoasDryRunOrderResult>,
  ga4StatusById: Map<string, Ga4GuardStatus>,
  duplicateSeen: Set<string>,
): OperationalCandidate => {
  const orderNumber = stringFrom(order.orderNumber);
  const channelOrderNo = stringFrom(order.channelOrderNo);
  const vmKeys = [orderNumber, channelOrderNo].filter(Boolean);
  let vmRow: VmLedgerRow | null = null;
  let matchedBy: OperationalCandidate["vm_evidence"]["matched_by"] = "none";
  for (const key of vmKeys) {
    const row = vmByKey.get(key);
    if (row) {
      vmRow = row;
      matchedBy = key === orderNumber ? "order_number" : "channel_order_no";
      break;
    }
  }
  const intent = intentByOrder.get(orderNumber) ?? null;
  const paymentMethod = classifyPaymentMethod(order);
  const npayResult = paymentMethod === "npay" ? npayByOrder.get(orderNumber) ?? null : null;
  const npayBest = npayResult?.bestCandidate ?? null;
  const lookupIds = [orderNumber, channelOrderNo].filter(Boolean);
  const matchedGa4Ids = lookupIds.filter((id) => ga4StatusById.get(id) === "present");
  const ga4Status: Ga4GuardStatus =
    matchedGa4Ids.length > 0
      ? "present"
      : lookupIds.some((id) => ga4StatusById.get(id) === "robust_absent")
        ? "robust_absent"
        : "unknown";
  const gclid = extractClickId(vmRow, intent, "gclid") || extractNpayGoogleClickId(npayResult, "gclid");
  const gbraid = extractClickId(vmRow, intent, "gbraid") || extractNpayGoogleClickId(npayResult, "gbraid");
  const wbraid = extractClickId(vmRow, intent, "wbraid") || extractNpayGoogleClickId(npayResult, "wbraid");
  const blockReasons = ["read_only_phase", "approval_required"];
  const dedupeKey = channelOrderNo || orderNumber;

  if (!orderNumber) blockReasons.push("missing_order_number");
  if (!order.paidAt) blockReasons.push("missing_conversion_time");
  if (toNumber(order.orderAmount) <= 0) blockReasons.push("invalid_value");
  if (order.hasCancel) blockReasons.push("order_has_cancel_reason");
  if (order.hasReturn) blockReasons.push("order_has_return_reason");
  if (toNumber(order.refundAmount) > 0) blockReasons.push("order_has_refund_amount");
  if (!vmRow && !intent && !npayBest) blockReasons.push("missing_attribution_vm_evidence");
  if (paymentMethod === "npay" && npayResult && npayResult.status !== "strong_match") {
    blockReasons.push(`npay_intent_${npayResult.status}`);
  }
  if (paymentMethod === "npay" && npayResult?.strongGrade === "B") {
    blockReasons.push("npay_intent_not_a_grade_strong");
  }
  if (!gclid && !gbraid && !wbraid) blockReasons.push("missing_google_click_id");
  if (ga4Status === "present") blockReasons.push("already_in_ga4");
  if (ga4Status === "unknown") blockReasons.push("already_in_ga4_unknown");
  if (dedupeKey && duplicateSeen.has(dedupeKey)) blockReasons.push("duplicate_order");
  if (dedupeKey) duplicateSeen.add(dedupeKey);

  const wouldBeEligibleAfterApproval = blockReasons.every((reason) =>
    ["read_only_phase", "approval_required"].includes(reason),
  );

  return {
    site: "biocom",
    order_number: orderNumber,
    channel_order_no: channelOrderNo,
    payment_method: paymentMethod,
    payment_status: order.hasCancel || order.hasReturn ? "canceled" : toNumber(order.refundAmount) > 0 ? "refunded" : "confirmed",
    conversion_time: isoFrom(order.paidAt),
    value: Math.round(toNumber(order.orderAmount)),
    currency: "KRW",
    vm_evidence: {
      matched: Boolean(vmRow || intent || npayBest),
      matched_by: vmRow ? matchedBy : intent || npayBest ? "order_number" : "none",
      entry_id: stringFrom(vmRow?.entry_id),
      source: stringFrom(vmRow?.source || (intent || npayBest ? "npay_intent_log" : "")),
      logged_at: stringFrom(vmRow?.logged_at || intent?.captured_at || npayBest?.capturedAt),
      ga_session_id: stringFrom(intent?.ga_session_id || npayBest?.gaSessionId || vmRow?.ga_session_id),
      client_id: extractClientId(vmRow, intent) || stringFrom(npayBest?.clientId),
      gclid,
      gbraid,
      wbraid,
      fbclid: stringFrom(intent?.page_location ? pickUrlParam(intent.page_location, "fbclid") : vmRow?.fbclid),
      utm_source: stringFrom(intent?.utm_source || npayBest?.utm.source || vmRow?.utm_source),
      utm_medium: stringFrom(intent?.utm_medium || npayBest?.utm.medium || vmRow?.utm_medium),
      utm_campaign: stringFrom(intent?.utm_campaign || npayBest?.utm.campaign || vmRow?.utm_campaign),
    },
    ga4_guard: {
      status: ga4Status,
      matched_ids: matchedGa4Ids,
    },
    would_be_eligible_after_approval: wouldBeEligibleAfterApproval,
    send_candidate: false,
    block_reasons: blockReasons,
    include_reason: paymentMethod === "npay" ? "npay_confirmed_order" : "homepage_confirmed_order",
  };
};

const countBy = (values: string[]) => {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value || "(blank)", (counts.get(value || "(blank)") ?? 0) + 1);
  return Object.fromEntries([...counts.entries()].sort((a, b) => b[1] - a[1]));
};

const escapeCell = (value: unknown) => String(value ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");

const mdTable = (headers: string[], rows: unknown[][]) => [
  `| ${headers.map(escapeCell).join(" | ")} |`,
  `| ${headers.map(() => "---").join(" | ")} |`,
  ...rows.map((row) => `| ${row.map(escapeCell).join(" | ")} |`),
].join("\n");

const renderMarkdown = (payload: Record<string, any>) => [
  "# BI confirmed_purchase 운영 source no-send dry-run",
  "",
  `작성 시각: ${payload.generated_at_kst}`,
  "",
  "## 10초 결론",
  "",
  "이 리포트는 Google Ads에 실제 결제완료 주문만 구매로 알려주기 전, 운영 source 기준으로 후보와 차단 사유를 계산한 no-send 결과다.",
  "NPay 실제 결제완료 주문은 포함했고, NPay 클릭/count/payment start만 있는 신호는 구매 후보에 넣지 않았다.",
  "모든 row는 `send_candidate=false`이며 실제 GA4/Meta/Google Ads 전송, Google Ads 전환 액션 생성/변경, 운영 DB write는 하지 않았다.",
  "",
  "## 요약",
  "",
  mdTable(
    ["metric", "value"],
    [
      ["operational_orders", payload.summary.operational_orders],
      ["confirmed_homepage", payload.summary.include_reason_counts.homepage_confirmed_order ?? 0],
      ["confirmed_npay", payload.summary.include_reason_counts.npay_confirmed_order ?? 0],
      ["ga4_present", payload.summary.ga4_guard_counts.present ?? 0],
      ["ga4_robust_absent", payload.summary.ga4_guard_counts.robust_absent ?? 0],
      ["with_google_click_id", payload.summary.with_google_click_id],
      ["would_be_eligible_after_approval", payload.summary.would_be_eligible_after_approval],
      ["send_candidate", payload.summary.send_candidate],
      ["blocked_by_missing_google_click_id", payload.summary.send_candidate_breakdown.blocked_by_missing_google_click_id],
      ["blocked_by_read_only_phase", payload.summary.send_candidate_breakdown.blocked_by_read_only_phase],
      ["blocked_by_approval_required", payload.summary.send_candidate_breakdown.blocked_by_approval_required],
    ],
  ),
  "",
  "## Source freshness",
  "",
  mdTable(
    ["source", "status", "row_count", "source_max_payment_complete_at", "source_lag_hours", "note"],
    [
      [
        "imweb_operational",
        payload.source_freshness.imweb_operational.freshness_status,
        payload.source_freshness.imweb_operational.row_count,
        payload.source_freshness.imweb_operational.source_max_payment_complete_at,
        payload.source_freshness.imweb_operational.source_lag_hours,
        payload.source_freshness.imweb_operational.freshness_note,
      ],
    ],
  ),
  "",
  "## send_candidate=0 해석",
  "",
  "`send_candidate=0`은 실제 결제완료 주문이 없다는 뜻이 아니다.",
  "현재 Green Lane이므로 모든 row가 `read_only_phase`와 `approval_required`로 막혀 있고, Google Ads 연결 관점에서는 `missing_google_click_id`가 별도 병목이다.",
  "",
  "## 후보 샘플",
  "",
  mdTable(
    [
      "order_number",
      "channel_order_no",
      "method",
      "value",
      "conversion_time",
      "ga4",
      "google_click",
      "vm_match",
      "send_candidate",
      "block_reasons",
    ],
    payload.candidates.slice(0, 40).map((row: OperationalCandidate) => [
      row.order_number,
      row.channel_order_no,
      row.payment_method,
      row.value,
      row.conversion_time,
      row.ga4_guard.status,
      row.vm_evidence.gclid || row.vm_evidence.gbraid || row.vm_evidence.wbraid ? "Y" : "N",
      row.vm_evidence.matched ? `${row.vm_evidence.source}/${row.vm_evidence.matched_by}` : "N",
      row.send_candidate ? "Y" : "N",
      row.block_reasons.join(", "),
    ]),
  ),
  "",
  "## Guardrails",
  "",
  "```text",
  "No-send verified: YES",
  "No-write verified: YES",
  "No-deploy verified: YES",
  "No-publish verified: YES",
  "No-platform-send verified: YES",
  "```",
  "",
  "## 다음 판단",
  "",
  "- `would_be_eligible_after_approval`은 실제 전송 후보가 아니다. 승인 후에도 Google Ads conversion action 생성/업로드는 Red Lane이다.",
  "- `missing_google_click_id`가 많으면 랜딩/체크아웃 시점 `gclid/gbraid/wbraid` 보존이 먼저다.",
  "- `already_in_ga4=present`는 GA4 복구 전송 후보에서 제외한다.",
].join("\n");

const main = async () => {
  const options = parseArgs();
  const generatedAt = new Date();
  const generatedAtIso = generatedAt.toISOString();
  const orders = await readOperationalOrders(options);
  const imwebFreshness = await readImwebOperationalFreshness(generatedAtIso);
  const ledger = indexVmLedger(options.vmDbPath);
  const intents = indexVmNpayIntents(options.vmDbPath);
  const lookupIds = [...new Set(orders.flatMap((order) => [stringFrom(order.orderNumber), stringFrom(order.channelOrderNo)]).filter(Boolean))];
  const ga4StatusById = await runGa4Guard(lookupIds, options);
  const ga4PresentOrderNumbers = lookupIds.filter((id) => ga4StatusById.get(id) === "present");
  const ga4RobustAbsentOrderNumbers = lookupIds.filter((id) => ga4StatusById.get(id) === "robust_absent");
  const npayReport = await buildNpayRoasDryRunReport({
    start: kstStartOfDay(options.start),
    end: kstStartOfDay(nextDay(options.end)),
    site: options.site,
    sqlitePath: options.vmDbPath,
    ga4PresentOrderNumbers,
    ga4RobustAbsentOrderNumbers,
  });
  const npayByOrder = new Map(npayReport.orderResults.map((result) => [result.order.orderNumber, result]));
  const duplicateSeen = new Set<string>();
  const candidates = orders.map((order) =>
    buildCandidate(order, ledger.byKey, intents.byOrder, npayByOrder, ga4StatusById, duplicateSeen),
  );
  const countWithBlockReason = (reason: string) =>
    candidates.filter((row) => row.block_reasons.includes(reason)).length;
  const payload = {
    ok: true,
    generated_at: generatedAtIso,
    generated_at_kst: kstNow(),
    mode: "no-send/no-write/read-only",
    harness: {
      lane: "Green",
      no_send: true,
      no_write: true,
      no_deploy: true,
      no_publish: true,
      no_platform_send: true,
    },
    source: {
      operational_db: "PostgreSQL dashboard.public.tb_iamweb_users",
      attribution_vm_snapshot: options.vmDbPath,
      ga4_bigquery: options.skipBigQuery
        ? "skipped"
        : `${options.sourceProjectId}.${options.dataset} queried by job project ${options.jobProjectId}`,
    },
    source_freshness: {
      imweb_operational: {
        row_count: imwebFreshness.rowCount,
        source_max_payment_complete_at: imwebFreshness.sourceMaxPaymentCompleteAt,
        source_max_order_date_at: imwebFreshness.sourceMaxOrderDateAt,
        source_lag_hours: imwebFreshness.sourceLagHours,
        freshness_status: imwebFreshness.freshnessStatus,
        freshness_note:
          imwebFreshness.freshnessStatus === "warn" || imwebFreshness.freshnessStatus === "stale"
            ? "warn/stale 숫자는 운영 판단용 최종값이 아니라 provisional로 표시해야 한다."
            : "fresh 기준. 그래도 외부 전송 전에는 최신성 재확인이 필요하다.",
      },
    },
    window: {
      start: options.start,
      end: options.end,
      timezone_note: "operational order paidAt filter uses timestamptz; report dates are KST-oriented operational windows.",
    },
    summary: {
      operational_orders: candidates.length,
      total_value: candidates.reduce((sum, row) => sum + row.value, 0),
      include_reason_counts: countBy(candidates.map((row) => row.include_reason)),
      payment_method_counts: countBy(candidates.map((row) => row.payment_method)),
      ga4_guard_counts: countBy(candidates.map((row) => row.ga4_guard.status)),
      block_reason_counts: countBy(candidates.flatMap((row) => row.block_reasons)),
      with_google_click_id: candidates.filter((row) => row.vm_evidence.gclid || row.vm_evidence.gbraid || row.vm_evidence.wbraid).length,
      would_be_eligible_after_approval: candidates.filter((row) => row.would_be_eligible_after_approval).length,
      send_candidate: candidates.filter((row) => row.send_candidate).length,
      send_candidate_breakdown: {
        eligible_payment_complete_orders: candidates.length,
        actual_send_candidate: candidates.filter((row) => row.send_candidate).length,
        blocked_by_read_only_phase: countWithBlockReason("read_only_phase"),
        blocked_by_approval_required: countWithBlockReason("approval_required"),
        blocked_by_missing_google_click_id: countWithBlockReason("missing_google_click_id"),
        blocked_by_already_in_ga4: countWithBlockReason("already_in_ga4"),
        blocked_by_missing_attribution_vm_evidence: countWithBlockReason("missing_attribution_vm_evidence"),
        blocked_by_source_freshness_warn: imwebFreshness.freshnessStatus === "warn" ? candidates.length : 0,
        blocked_by_source_freshness_stale: imwebFreshness.freshnessStatus === "stale" ? candidates.length : 0,
      },
      npay_intent_summary: npayReport.summary,
      excluded_signal_only_policy:
        "NPay click/count/payment start-only signals are not read from operational orders and are excluded by construction; only payment-complete Imweb order rows are included.",
    },
    candidates,
  };

  const json = `${JSON.stringify(payload, null, 2)}\n`;
  if (options.output) fs.writeFileSync(path.resolve(options.output), json, "utf8");
  else process.stdout.write(json);
  if (options.markdownOutput) {
    fs.writeFileSync(path.resolve(options.markdownOutput), `${renderMarkdown(payload)}\n`, "utf8");
  }
};

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`bi-confirmed-purchase-operational-dry-run failed: ${message}`);
  process.exitCode = 1;
});
