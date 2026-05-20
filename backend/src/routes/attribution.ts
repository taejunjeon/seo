import express, { type Request, type Response } from "express";

import { buildAcquisitionSummaryReport } from "../acquisitionAnalysis";
import {
  buildAttributionCohortLtrReport,
  buildChannelCategoryRepeatReport,
  buildReverseFunnelReport,
  CohortValidationError,
  extractItemNamesFromRawJson,
  type FirstPurchaseCategory,
  parseAcquisitionChannelFilter,
} from "../acquisitionCohort";
import { categorizeProductName } from "../consultation";
import {
  appendLedgerEntry,
  type AttributionLedgerEntry,
  type AttributionPaymentStatus,
  buildAttributionCallerCoverageReport,
  buildAttributionHourlyCompare,
  buildLedgerEntry,
  buildLedgerSummary,
  buildTossJoinReport,
  buildTossReplayPlan,
  buildRequestContext,
  enrichCheckoutStartedFirstTouch,
  enrichPaymentSuccessFirstTouch,
  filterLedgerEntries,
  getAttributionTikTokMatchReasons,
  normalizeApprovedAtToIso,
  normalizePaymentStatus,
  readLedgerEntries,
  readLedgerEntriesInRange,
  type TossJoinRow,
} from "../attribution";
import {
  listAttributionLedgerPaymentDecisionCandidates,
  updateAttributionLedgerEntries,
} from "../attributionLedgerDb";
import { getCrmDb } from "../crmLocalDb";
import {
  recordSiteLanding,
  summarizeSiteLandingFunnelEvidence,
  summarizeSiteLanding,
  detectSiteFromUrl,
  type SiteKey,
  type SiteLandingChannelClassified,
} from "../siteLandingLedger";
import { classifySiteLandingChannel } from "../siteLandingChannelClassifier";
import {
  fanOutEntryToSiteLanding,
  fanOutPaidClickIntentPreviewToSiteLanding,
} from "../siteLandingFanout";
import { getNpayIntentSummary, listNpayIntents, recordNpayIntent } from "../npayIntentLog";
import {
  bootstrapOrderBridgeLedgerTable,
  recordOrderBridgeLedger,
  isOrderBridgeWriteEnabled,
  getOrderBridgeLedgerSummary,
  getOrderBridgeWriteMaxRows,
  isOrderBridgePlatformSendEnabled,
  isOrderBridgeRawBodyLoggingEnabled,
} from "../orderBridgeLedger";
import {
  buildOrderBridgeIdentityHmacMaterial,
  OrderBridgeIdentityHmacConfigError,
} from "../orderBridgeIdentityHmac";
import {
  bootstrapPaidClickIntentTable,
  getPaidClickIntentWriteSampleRate,
  isPaidClickIntentWriteEnabled,
  recordPaidClickIntent,
} from "../paidClickIntentLog";
import { buildNpayRoasDryRunReport } from "../npayRoasDryRun";
import {
  fetchNpayActualConfirmedSiteLandingSummary,
  type NpayActualConfirmedSiteLandingSummary,
} from "../npayActualConfirmedPgReader";
import { normalizeOrderIdBase, normalizePhoneDigits } from "../orderKeys";
import { isDatabaseConfigured, queryPg } from "../postgres";
import { classifyCrossReferenceEvidence } from "../confirmedPurchaseCrossReferenceEvidence";
import {
  appendTikTokPixelEvent,
  buildTikTokPixelEventSummary,
  listTikTokPixelEvents,
  normalizeTikTokPixelEventPayload,
} from "../tiktokPixelEvents";
import { getTossBasicAuth, inferTossStoreFromPaymentKey, normalizeTossStore, type TossStore } from "../tossConfig";
import { readMetaCapiSendLogs } from "../metaCapi";
import {
  buildFunnelHealthReport,
  FUNNEL_HEALTH_WINDOW_HOURS,
  parseFunnelHealthQuery,
} from "../funnelHealth";
import {
  buildLeadingIndicatorsReport,
  getPrecomputedLeadingIndicators,
  LEADING_INDICATOR_WINDOW_HOURS,
  LeadingIndicatorsValidationError,
  parseLeadingIndicatorsQuery,
} from "../leadingIndicators";
import { readPaymentDecisionMeasurements, recordPaymentDecisionMeasurement } from "../paymentDecisionLatency";
import { getPrecomputedFunnelHealth } from "../funnelHealthPrecompute";
import { getPrecomputedAcquisition } from "../acquisitionPrecompute";

type TossRow = {
  paymentKey: string | null;
  orderId: string | null;
  approvedAt: string | null;
  status: string | null;
  channel: string | null;
  store: string | null;
  totalAmount: number | null;
};

type TossPaymentDetail = {
  paymentKey?: string;
  orderId?: string;
  approvedAt?: string;
  status?: string;
  method?: string;
  totalAmount?: number;
};

type ImwebOverdueRow = {
  orderNumber: string | null;
  paymentMethod: string | null;
  paymentStatus: string | null;
  cancellationReason: string | null;
  orderDate: string | null;
  paidPriceSum: number | string | null;
  totalPriceSum: number | string | null;
};

type AttributionStatusSyncMatchType =
  | "payment_key"
  | "order_id"
  | "direct_payment_key"
  | "direct_order_id"
  | "imweb_overdue_order_id"
  | "unmatched";

export type AttributionStatusSyncItem = {
  orderId: string;
  paymentKey: string;
  previousStatus: AttributionPaymentStatus;
  nextStatus: AttributionPaymentStatus | null;
  matchType: AttributionStatusSyncMatchType;
  action: "updated" | "skipped";
  reason?: string;
  approvedAt?: string;
};

export type AttributionStatusSyncResult = {
  ok: true;
  dryRun: boolean;
  totalCandidates: number;
  matchedRows: number;
  updatedRows: number;
  writtenRows: number;
  skippedNoMatchRows: number;
  skippedPendingRows: number;
  directFallbackRows: number;
  imwebOverdueRows: number;
  directFallbackErrors: string[];
  items: AttributionStatusSyncItem[];
};

type OperationalPaymentCompleteBridgeRow = {
  orderNumber: string;
  channelOrderNo: string;
  paymentStatus: string;
  paymentMethod: string;
  paidAt: string;
  orderAmount: number;
  refundAmount: number;
  refundPendingAmount: number;
  hasCancel: boolean;
  hasReturn: boolean;
  isNpay: boolean;
};

type OperationalPaymentCompleteBridgeMatchType = "order_number" | "channel_order_no" | "unmatched";

type OperationalPaymentCompleteBridgeReason =
  | "confirmed_candidate"
  | "out_of_scope_source"
  | "operational_row_not_found"
  | "operational_payment_not_complete"
  | "free_zero_amount"
  | "npay_excluded"
  | "refund_amount_present"
  | "refund_pending_amount_present"
  | "cancel_or_return_present"
  | "ambiguous_operational_match";

export type OperationalPaymentCompleteBridgeItem = {
  action: "updated" | "skipped";
  reason: OperationalPaymentCompleteBridgeReason;
  previousStatus: AttributionPaymentStatus;
  nextStatus: AttributionPaymentStatus | null;
  matchType: OperationalPaymentCompleteBridgeMatchType;
  paymentMethodFamily: "card" | "subscription" | "free" | "npay" | "other";
  amountKrw: number;
};

export type OperationalPaymentCompleteBridgePlan = {
  totalCandidates: number;
  scopedCandidates: number;
  matchedRows: number;
  updatedRows: number;
  confirmedAmountKrw: number;
  excludedRows: number;
  excludedAmountKrw: number;
  noSendGateRows: number;
  items: OperationalPaymentCompleteBridgeItem[];
  exclusionsByReason: Record<string, { count: number; amountKrw: number }>;
  matchTypes: Record<string, number>;
  paymentMethods: Record<string, { count: number; amountKrw: number }>;
  updates: Array<{ previousEntry: AttributionLedgerEntry; nextEntry: AttributionLedgerEntry }>;
};

export type OperationalPaymentCompleteBridgeResult = OperationalPaymentCompleteBridgePlan & {
  ok: true;
  dryRun: boolean;
  writtenRows: number;
  source: {
    primary: "운영DB PostgreSQL dashboard.public.tb_iamweb_users";
    target: "VM Cloud SQLite attribution_ledger";
  };
  notes: string[];
};

type AttributionStatusSyncPlan = Omit<
  AttributionStatusSyncResult,
  "ok" | "dryRun" | "writtenRows" | "directFallbackRows" | "imwebOverdueRows" | "directFallbackErrors"
> & {
  updates: Array<{ previousEntry: AttributionLedgerEntry; nextEntry: AttributionLedgerEntry }>;
};

export type PaymentDecisionLookup = {
  orderId: string;
  orderNo: string;
  orderCode: string;
  paymentCode: string;
  paymentKey: string;
  store: TossStore;
};

type PaymentDecisionMatchType =
  | "operational_db_order_number"
  | "operational_db_channel_order_no"
  | "toss_direct_payment_key"
  | "toss_direct_order_id"
  | "ledger_payment_key"
  | "ledger_order_id"
  | "ledger_order_code"
  | "ledger_payment_code"
  | "none";

type PaymentDecisionBrowserAction =
  | "allow_purchase"
  | "block_purchase_virtual_account"
  | "block_purchase"
  | "hold_or_block_purchase";

export type AttributionPaymentDecision = {
  status: AttributionPaymentStatus | "unknown";
  browserAction: PaymentDecisionBrowserAction;
  confidence: "high" | "medium" | "low";
  matchedBy: PaymentDecisionMatchType;
  reason: string;
  notes: string[];
  matched?: {
    source: "operational_db_tb_iamweb_users" | "toss_direct_api" | "attribution_ledger";
    orderId: string;
    paymentKey: string;
    status: string;
    approvedAt: string;
    channel: string;
    store: string;
    loggedAt?: string;
    captureMode?: string;
  };
};

const STATUS_RANK: Record<AttributionPaymentStatus, number> = {
  pending: 1,
  confirmed: 2,
  canceled: 3,
};
const TOSS_BASE_URL = "https://api.tosspayments.com";
const TOSS_DIRECT_FALLBACK_TIMEOUT_MS = 10000;
const OPERATIONAL_ATTRIBUTION_BASE_URL =
  process.env.ATTRIBUTION_OPERATIONAL_BASE_URL?.trim() || "https://att.ainativeos.net";
const ACQUISITION_REMOTE_LEDGER_SOURCES = [
  "biocom_imweb",
  "thecleancoffee_imweb",
  "aibio_imweb",
] as const;
const ACQUISITION_REMOTE_LEDGER_LIMIT = 10000;
const ACQUISITION_REMOTE_LEDGER_TIMEOUT_MS = 30000;
const ACQUISITION_REMOTE_LEDGER_LOOKBACK_DAYS = 365;
const NAVER_SEARCH_REFERRERS = ["search.naver.com", "m.search.naver.com"];
const NAVER_REFERRERS = [
  "search.naver.com",
  "m.search.naver.com",
  "naver.com",
  "blog.naver.com",
  "m.blog.naver.com",
  "shopping.naver.com",
  "m.shopping.naver.com",
];

const parsePositiveInt = (value: unknown, fallback: number, max: number) => {
  const parsed = typeof value === "string" ? Number.parseInt(value, 10) : Number.NaN;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(max, parsed));
};

const parsePositiveEnvInt = (value: string | undefined, fallback: number, max: number) => {
  const parsed = value ? Number.parseInt(value, 10) : Number.NaN;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(max, parsed));
};

const parseBooleanish = (value: unknown, fallback: boolean) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "y", "yes"].includes(normalized)) return true;
    if (["0", "false", "n", "no"].includes(normalized)) return false;
  }
  return fallback;
};

const readOne = (value: unknown) => {
  if (Array.isArray(value)) return typeof value[0] === "string" ? value[0].trim() : "";
  return typeof value === "string" ? value.trim() : "";
};

const readText = (value: unknown) => (typeof value === "string" ? value.trim() : "");

const ATTRIBUTION_LEDGER_TRUSTED_READ_IPS = new Set(
  (process.env.ATTRIBUTION_LEDGER_TRUSTED_READ_IPS || "127.0.0.1,::1,::ffff:127.0.0.1,34.64.104.94")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
);
const ATTRIBUTION_LEDGER_PUBLIC_MAX_LIMIT = parsePositiveEnvInt(
  process.env.ATTRIBUTION_LEDGER_PUBLIC_MAX_LIMIT,
  1000,
  10000,
);
const ATTRIBUTION_LEDGER_PUBLIC_LONG_RANGE_MAX_LIMIT = parsePositiveEnvInt(
  process.env.ATTRIBUTION_LEDGER_PUBLIC_LONG_RANGE_MAX_LIMIT,
  500,
  10000,
);
const ATTRIBUTION_LEDGER_LONG_RANGE_DAYS = parsePositiveEnvInt(
  process.env.ATTRIBUTION_LEDGER_LONG_RANGE_DAYS,
  3,
  365,
);
const ATTRIBUTION_LEDGER_RATE_WINDOW_MS = parsePositiveEnvInt(
  process.env.ATTRIBUTION_LEDGER_RATE_WINDOW_MS,
  60_000,
  10 * 60_000,
);
const ATTRIBUTION_LEDGER_PUBLIC_RATE_LIMIT = parsePositiveEnvInt(
  process.env.ATTRIBUTION_LEDGER_PUBLIC_RATE_LIMIT,
  60,
  10_000,
);
const attributionLedgerRateBuckets = new Map<string, number[]>();

const getClientIpForGuard = (req: Request) => {
  const forwarded = req.headers["cf-connecting-ip"] || req.headers["x-forwarded-for"];
  const firstForwarded = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return (firstForwarded || req.ip || req.socket.remoteAddress || "unknown").split(",")[0].trim();
};

const isTrustedLedgerReadCaller = (req: Request) => ATTRIBUTION_LEDGER_TRUSTED_READ_IPS.has(getClientIpForGuard(req));

const checkAttributionLedgerReadRateLimit = (req: Request) => {
  if (isTrustedLedgerReadCaller(req)) {
    return { allowed: true, retryAfterSeconds: 0 };
  }
  const key = getClientIpForGuard(req);
  const now = Date.now();
  const cutoff = now - ATTRIBUTION_LEDGER_RATE_WINDOW_MS;
  const recent = (attributionLedgerRateBuckets.get(key) || []).filter((time) => time >= cutoff);
  if (recent.length >= ATTRIBUTION_LEDGER_PUBLIC_RATE_LIMIT) {
    attributionLedgerRateBuckets.set(key, recent);
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((recent[0] + ATTRIBUTION_LEDGER_RATE_WINDOW_MS - now) / 1000)) };
  }
  recent.push(now);
  attributionLedgerRateBuckets.set(key, recent);
  if (attributionLedgerRateBuckets.size > 1000) {
    for (const [bucketKey, times] of attributionLedgerRateBuckets) {
      const alive = times.filter((time) => time >= cutoff);
      if (alive.length === 0) attributionLedgerRateBuckets.delete(bucketKey);
      else attributionLedgerRateBuckets.set(bucketKey, alive);
    }
  }
  return { allowed: true, retryAfterSeconds: 0 };
};

const lowerIncludesAny = (value: string, tokens: string[]) => {
  const lower = value.toLowerCase();
  return tokens.some((token) => lower.includes(token));
};

const safeUrlParam = (key: string, ...values: unknown[]) => {
  for (const value of values) {
    const raw = readText(value);
    if (!raw) continue;
    try {
      const parsed = new URL(raw, "https://biocom.kr");
      const found = parsed.searchParams.get(key)?.trim();
      if (found) return found;
    } catch {
      // Ignore malformed URLs in aggregate-only diagnostics.
    }
  }
  return "";
};

const readCsvList = (value: unknown) =>
  readOne(value)
    .split(/[,\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);

const readBearerToken = (req: Request) => {
  const authorization = req.header("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
};

const getNpayIntentAdminToken = () =>
  process.env.NPAY_INTENT_ADMIN_TOKEN?.trim() ||
  process.env.AIBIO_NATIVE_ADMIN_TOKEN?.trim() ||
  "";

const requireNpayIntentReadAccess = (req: Request, res: Response) => {
  const configured = getNpayIntentAdminToken();
  if (!configured) {
    if (process.env.NODE_ENV !== "production") return true;
    res.status(503).json({
      ok: false,
      error: "npay_intent_admin_token_not_configured",
      message: "NPay intent 조회 API는 NPAY_INTENT_ADMIN_TOKEN 설정 후에만 운영에서 허용한다.",
    });
    return false;
  }

  const supplied = req.header("x-admin-token")?.trim() || readBearerToken(req);
  if (supplied !== configured) {
    res.status(403).json({ ok: false, error: "forbidden" });
    return false;
  }

  return true;
};

const getQueryParamFromUrl = (urlValue: string, key: string) => {
  if (!urlValue) return "";
  try {
    const parsed = new URL(urlValue, "https://biocom.kr");
    return parsed.searchParams.get(key)?.trim() ?? "";
  } catch {
    return "";
  }
};

const getNestedRecord = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
};

const readNestedString = (value: unknown, key: string) => {
  const record = getNestedRecord(value);
  const raw = record[key];
  return typeof raw === "string" ? raw.trim() : "";
};

const resolveKstDate = (value: unknown) => {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    return value.trim();
  }

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
};

const mapTossRow = (row: TossRow): TossJoinRow => ({
  paymentKey: row.paymentKey ?? "",
  orderId: row.orderId ?? "",
  approvedAt: row.approvedAt ?? "",
  status: row.status ?? "",
  channel: row.channel ?? "",
  store: row.store ?? "",
  totalAmount: Number(row.totalAmount ?? 0),
  syncSource: "tb_sales_toss",
});

const parseNullableNumber = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string") {
    const parsed = Number(value.replace(/,/g, "").trim());
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const mapImwebOverdueRow = (row: ImwebOverdueRow): TossJoinRow => ({
  paymentKey: "",
  orderId: row.orderNumber ?? "",
  approvedAt: "",
  status: "CANCELLED_BEFORE_DEPOSIT",
  channel: "imweb",
  store: "biocom",
  totalAmount: parseNullableNumber(row.paidPriceSum) || parseNullableNumber(row.totalPriceSum),
  syncSource: "tb_iamweb_users_overdue",
  imwebPaymentMethod: row.paymentMethod ?? "",
  imwebPaymentStatus: row.paymentStatus ?? "",
  imwebCancellationReason: row.cancellationReason ?? "",
  imwebOrderDate: row.orderDate ?? "",
});

const fetchTossRows = async (startDate: string, endDate: string, limit: number) => {
  if (!isDatabaseConfigured()) {
    return [];
  }

  const result = await queryPg<TossRow>(
    `
      SELECT
        payment_key AS "paymentKey",
        order_id AS "orderId",
        approved_at AS "approvedAt",
        status,
        channel,
        store,
        total_amount AS "totalAmount"
      FROM tb_sales_toss
      WHERE ($1 = '' OR SUBSTRING(COALESCE(approved_at, ''), 1, 10) >= $1)
        AND ($2 = '' OR SUBSTRING(COALESCE(approved_at, ''), 1, 10) <= $2)
      ORDER BY approved_at DESC NULLS LAST
      LIMIT $3
    `,
    [startDate, endDate, limit],
  );

  return result.rows.map(mapTossRow);
};

const fetchTossRowsByPendingEntries = async (
  entries: AttributionLedgerEntry[],
  limit: number,
): Promise<TossJoinRow[]> => {
  if (!isDatabaseConfigured() || entries.length === 0) {
    return [];
  }

  const paymentKeys = [...new Set(entries.map((entry) => entry.paymentKey).filter(Boolean))];
  const orderIds = [...new Set(entries.map((entry) => entry.orderId).filter(Boolean))];

  if (paymentKeys.length === 0 && orderIds.length === 0) {
    return [];
  }

  const result = await queryPg<TossRow>(
    `
      SELECT
        payment_key AS "paymentKey",
        order_id AS "orderId",
        approved_at AS "approvedAt",
        status,
        channel,
        store,
        total_amount AS "totalAmount"
      FROM tb_sales_toss
      WHERE (
        (cardinality($1::text[]) > 0 AND COALESCE(payment_key, '') = ANY($1::text[]))
        OR
        (cardinality($2::text[]) > 0 AND COALESCE(order_id, '') = ANY($2::text[]))
      )
      ORDER BY
        CASE
          WHEN UPPER(COALESCE(status, '')) LIKE '%CANCEL%' THEN 3
          WHEN UPPER(COALESCE(status, '')) LIKE '%FAIL%' THEN 3
          WHEN UPPER(COALESCE(status, '')) LIKE '%DONE%' THEN 2
          WHEN UPPER(COALESCE(status, '')) LIKE '%PAID%' THEN 2
          ELSE 1
        END DESC,
        approved_at DESC NULLS LAST
      LIMIT $3
    `,
    [paymentKeys, orderIds, Math.max(limit * 5, 100)],
  );

  return result.rows.map(mapTossRow);
};

const fetchImwebOverdueRowsByPendingEntries = async (
  entries: AttributionLedgerEntry[],
  limit: number,
): Promise<TossJoinRow[]> => {
  if (!isDatabaseConfigured() || entries.length === 0) {
    return [];
  }

  const orderIds = [
    ...new Set(
      entries
        .flatMap((entry) => [entry.orderId, normalizeOrderIdBase(entry.orderId)])
        .map((value) => value?.trim() ?? "")
        .filter(Boolean),
    ),
  ];

  if (orderIds.length === 0) {
    return [];
  }

  const result = await queryPg<ImwebOverdueRow>(
    `
      SELECT
        order_number AS "orderNumber",
        MAX(payment_method) AS "paymentMethod",
        MAX(payment_status) AS "paymentStatus",
        MAX(cancellation_reason) AS "cancellationReason",
        MAX(order_date) AS "orderDate",
        SUM(COALESCE(paid_price, 0))::bigint AS "paidPriceSum",
        SUM(COALESCE(total_price, 0))::bigint AS "totalPriceSum"
      FROM public.tb_iamweb_users
      WHERE order_number = ANY($1::text[])
        AND UPPER(COALESCE(payment_method, '')) = 'VIRTUAL'
        AND UPPER(COALESCE(payment_status, '')) = 'PAYMENT_OVERDUE'
        AND COALESCE(cancellation_reason, '') LIKE '%입금기간 마감%'
      GROUP BY order_number
      ORDER BY SUM(COALESCE(paid_price, 0)) DESC
      LIMIT $2
    `,
    [orderIds, Math.max(limit * 5, 100)],
  );

  return result.rows.map(mapImwebOverdueRow);
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const parseTossPaymentDetail = (body: unknown): TossPaymentDetail => {
  if (!isRecord(body)) return {};

  return {
    paymentKey: typeof body.paymentKey === "string" ? body.paymentKey : undefined,
    orderId: typeof body.orderId === "string" ? body.orderId : undefined,
    approvedAt: typeof body.approvedAt === "string" ? body.approvedAt : undefined,
    status: typeof body.status === "string" ? body.status : undefined,
    method: typeof body.method === "string" ? body.method : undefined,
    totalAmount: typeof body.totalAmount === "number" ? body.totalAmount : undefined,
  };
};

const readStringField = (record: Record<string, unknown>, key: string) => {
  const raw = record[key];
  return typeof raw === "string" ? raw.trim() : "";
};

const normalizeRemoteTouchpoint = (value: unknown): AttributionLedgerEntry["touchpoint"] | null => {
  if (
    value === "marketing_intent" ||
    value === "checkout_started" ||
    value === "payment_page_seen" ||
    value === "payment_success" ||
    value === "form_submit"
  ) {
    return value;
  }
  return null;
};

const normalizeRemoteCaptureMode = (value: unknown): AttributionLedgerEntry["captureMode"] => {
  if (value === "replay" || value === "smoke") return value;
  return "live";
};

const normalizeRemotePaymentStatus = (value: unknown): AttributionLedgerEntry["paymentStatus"] => {
  if (value === "pending" || value === "confirmed" || value === "canceled") return value;
  return null;
};

const normalizeBlankMarker = (value: unknown) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

const isBlankOperationalMarker = (value: unknown) => {
  const normalized = normalizeBlankMarker(value);
  return normalized === "" || normalized === "nan" || normalized === "null" || normalized === "undefined";
};

const normalizeBridgeNumber = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string") {
    const parsed = Number(value.replace(/,/g, "").trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
};

const classifyBridgePaymentMethod = (
  method: string,
  isNpay: boolean,
): OperationalPaymentCompleteBridgeItem["paymentMethodFamily"] => {
  const upper = method.trim().toUpperCase();
  if (isNpay || upper.includes("NAVERPAY") || upper.includes("NPAY") || method.includes("네이버")) return "npay";
  if (upper === "FREE") return "free";
  if (upper === "SUBSCRIPTION") return "subscription";
  if (upper === "CARD" || upper === "CREDIT_CARD") return "card";
  return "other";
};

const getLedgerSource = (entry: AttributionLedgerEntry) =>
  typeof entry.metadata?.source === "string" ? entry.metadata.source.trim() : "";

const getExactEntryOrderKeys = (entry: AttributionLedgerEntry) =>
  Array.from(
    new Set(
      [
        entry.orderId,
        typeof entry.metadata?.orderNo === "string" ? entry.metadata.orderNo : "",
        isRecord(entry.metadata?.landingPayment) && typeof entry.metadata.landingPayment.orderNo === "string"
          ? entry.metadata.landingPayment.orderNo
          : "",
      ]
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  );

const addBridgeAggregate = (
  target: Record<string, { count: number; amountKrw: number }>,
  key: string,
  amountKrw: number,
) => {
  const current = target[key] ?? { count: 0, amountKrw: 0 };
  current.count += 1;
  current.amountKrw += amountKrw;
  target[key] = current;
};

const addBridgeCount = (target: Record<string, number>, key: string) => {
  target[key] = (target[key] ?? 0) + 1;
};

const buildOperationalBridgeIndexes = (rows: OperationalPaymentCompleteBridgeRow[]) => {
  const byOrderNumber = new Map<string, OperationalPaymentCompleteBridgeRow[]>();
  const byChannelOrderNo = new Map<string, OperationalPaymentCompleteBridgeRow[]>();

  for (const row of rows) {
    if (row.orderNumber) {
      const items = byOrderNumber.get(row.orderNumber) ?? [];
      items.push(row);
      byOrderNumber.set(row.orderNumber, items);
    }
    if (row.channelOrderNo) {
      const items = byChannelOrderNo.get(row.channelOrderNo) ?? [];
      items.push(row);
      byChannelOrderNo.set(row.channelOrderNo, items);
    }
  }

  return { byOrderNumber, byChannelOrderNo };
};

const findOperationalBridgeRow = (
  entry: AttributionLedgerEntry,
  rows: OperationalPaymentCompleteBridgeRow[],
): { row: OperationalPaymentCompleteBridgeRow | null; matchType: OperationalPaymentCompleteBridgeMatchType; ambiguous: boolean } => {
  const indexes = buildOperationalBridgeIndexes(rows);
  const matches: Array<{ row: OperationalPaymentCompleteBridgeRow; matchType: OperationalPaymentCompleteBridgeMatchType }> = [];

  for (const key of getExactEntryOrderKeys(entry)) {
    for (const row of indexes.byOrderNumber.get(key) ?? []) {
      matches.push({ row, matchType: "order_number" });
    }
    for (const row of indexes.byChannelOrderNo.get(key) ?? []) {
      matches.push({ row, matchType: "channel_order_no" });
    }
  }

  const unique = new Map<string, { row: OperationalPaymentCompleteBridgeRow; matchType: OperationalPaymentCompleteBridgeMatchType }>();
  for (const match of matches) {
    const key = `${match.row.orderNumber}\u001f${match.row.channelOrderNo}`;
    if (!unique.has(key)) unique.set(key, match);
  }
  const uniqueMatches = [...unique.values()];
  if (uniqueMatches.length === 0) return { row: null, matchType: "unmatched", ambiguous: false };
  if (uniqueMatches.length > 1) return { row: uniqueMatches[0]?.row ?? null, matchType: uniqueMatches[0]?.matchType ?? "unmatched", ambiguous: true };
  return { row: uniqueMatches[0]?.row ?? null, matchType: uniqueMatches[0]?.matchType ?? "unmatched", ambiguous: false };
};

const fetchOperationalPaymentCompleteRowsByPendingEntries = async (
  entries: AttributionLedgerEntry[],
  limit: number,
): Promise<OperationalPaymentCompleteBridgeRow[]> => {
  if (!isDatabaseConfigured() || entries.length === 0) return [];

  const orderKeys = [
    ...new Set(entries.flatMap(getExactEntryOrderKeys).map((value) => value.trim()).filter(Boolean)),
  ];
  if (orderKeys.length === 0) return [];

  const result = await queryPg<{
    orderNumber: string | null;
    channelOrderNo: string | null;
    paymentStatus: string | null;
    paymentMethod: string | null;
    paidAt: string | null;
    orderAmount: string | number | null;
    refundAmount: string | number | null;
    refundPendingAmount: string | number | null;
    hasCancel: boolean | null;
    hasReturn: boolean | null;
    isNpay: boolean | null;
  }>(
    `
    WITH raw AS (
      SELECT
        COALESCE(NULLIF(TRIM(order_number::text), ''), '') AS order_number,
        COALESCE(NULLIF(TRIM(raw_data ->> 'channelOrderNo'), ''), '') AS channel_order_no,
        COALESCE(NULLIF(TRIM(payment_status::text), ''), '') AS payment_status,
        COALESCE(NULLIF(TRIM(payment_method::text), ''), '') AS payment_method,
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
        COALESCE(NULLIF(total_refunded_price, 0), 0)::numeric AS refund_amount,
        COALESCE(NULLIF(cancellation_reason::text, ''), '') AS cancellation_reason,
        COALESCE(NULLIF(return_reason::text, ''), '') AS return_reason
      FROM public.tb_iamweb_users
      WHERE COALESCE(NULLIF(TRIM(order_number::text), ''), '') = ANY($1::text[])
        OR COALESCE(NULLIF(TRIM(raw_data ->> 'channelOrderNo'), ''), '') = ANY($1::text[])
    ),
    order_level AS (
      SELECT
        order_number AS "orderNumber",
        MAX(channel_order_no) AS "channelOrderNo",
        MAX(payment_status) AS "paymentStatus",
        MAX(payment_method) AS "paymentMethod",
        MIN(paid_at)::text AS "paidAt",
        COALESCE(MAX(final_order_amount), SUM(COALESCE(paid_price, total_price, 0)), MAX(total_price), 0)::numeric AS "orderAmount",
        COALESCE(MAX(refund_amount), 0)::numeric AS "refundAmount",
        0::numeric AS "refundPendingAmount",
        BOOL_OR(NOT (cancellation_reason IN ('', 'nan', 'null', 'undefined'))) AS "hasCancel",
        BOOL_OR(NOT (return_reason IN ('', 'nan', 'null', 'undefined'))) AS "hasReturn",
        BOOL_OR(payment_method ~* '(naver|npay)' OR payment_method LIKE '%네이버%' OR channel_order_no <> '') AS "isNpay"
      FROM raw
      WHERE order_number <> ''
      GROUP BY order_number
    )
    SELECT *
    FROM order_level
    ORDER BY "paidAt" DESC NULLS LAST
    LIMIT $2
    `,
    [orderKeys, Math.max(limit * 5, 100)],
  );

  return result.rows.map((row) => ({
    orderNumber: row.orderNumber ?? "",
    channelOrderNo: row.channelOrderNo ?? "",
    paymentStatus: row.paymentStatus ?? "",
    paymentMethod: row.paymentMethod ?? "",
    paidAt: row.paidAt ?? "",
    orderAmount: normalizeBridgeNumber(row.orderAmount),
    refundAmount: normalizeBridgeNumber(row.refundAmount),
    refundPendingAmount: normalizeBridgeNumber(row.refundPendingAmount),
    hasCancel: Boolean(row.hasCancel),
    hasReturn: Boolean(row.hasReturn),
    isNpay: Boolean(row.isNpay),
  }));
};

const buildOperationalBridgeNextEntry = (
  entry: AttributionLedgerEntry,
  row: OperationalPaymentCompleteBridgeRow,
  matchType: OperationalPaymentCompleteBridgeMatchType,
  syncedAt: string,
): AttributionLedgerEntry => ({
  ...entry,
  paymentStatus: "confirmed",
  approvedAt: row.paidAt ? normalizeApprovedAtToIso(row.paidAt, entry.approvedAt || entry.loggedAt) : entry.approvedAt,
  metadata: {
    ...entry.metadata,
    value: row.orderAmount,
    totalAmount: row.orderAmount,
    paymentStatus: "confirmed",
    status: "PAYMENT_COMPLETE",
    channel: row.paymentMethod || entry.metadata?.channel,
    store: "biocom",
    operationalDbPaymentStatus: "PAYMENT_COMPLETE",
    paymentStatusSyncSource: "operational_db_tb_iamweb_users_payment_complete_bridge",
    operationalPaymentCompleteBridge: {
      source: "운영DB PostgreSQL dashboard.public.tb_iamweb_users",
      target: "VM Cloud SQLite attribution_ledger",
      syncedAt,
      matchType,
      amountKrw: row.orderAmount,
      refundAmountKrw: row.refundAmount,
      refundPendingAmountKrw: row.refundPendingAmount,
      metaCapiAutoSendAllowed: false,
      reason: "Meta CAPI send requires separate approval",
    },
    bridgeAutoSendAllowed: false,
    metaCapiAutoSendAllowed: false,
  },
});

export const buildOperationalPaymentCompleteBridgePlan = (
  entries: AttributionLedgerEntry[],
  operationalRows: OperationalPaymentCompleteBridgeRow[],
  limit = 100,
  syncedAt = new Date().toISOString(),
): OperationalPaymentCompleteBridgePlan => {
  const candidates = entries
    .filter((entry) => entry.touchpoint === "payment_success" && entry.paymentStatus === "pending")
    .slice(0, Math.max(1, Math.min(limit, 500)));
  const items: OperationalPaymentCompleteBridgeItem[] = [];
  const updates: Array<{ previousEntry: AttributionLedgerEntry; nextEntry: AttributionLedgerEntry }> = [];
  const exclusionsByReason: Record<string, { count: number; amountKrw: number }> = {};
  const matchTypes: Record<string, number> = {};
  const paymentMethods: Record<string, { count: number; amountKrw: number }> = {};
  let scopedCandidates = 0;
  let matchedRows = 0;
  let confirmedAmountKrw = 0;
  let excludedRows = 0;
  let excludedAmountKrw = 0;

  for (const entry of candidates) {
    const previousStatus = entry.paymentStatus ?? "pending";
    if (getLedgerSource(entry) !== "biocom_imweb") {
      excludedRows += 1;
      addBridgeAggregate(exclusionsByReason, "out_of_scope_source", 0);
      items.push({
        action: "skipped",
        reason: "out_of_scope_source",
        previousStatus,
        nextStatus: null,
        matchType: "unmatched",
        paymentMethodFamily: "other",
        amountKrw: 0,
      });
      continue;
    }

    scopedCandidates += 1;
    const { row, matchType, ambiguous } = findOperationalBridgeRow(entry, operationalRows);
    addBridgeCount(matchTypes, matchType);

    if (!row) {
      excludedRows += 1;
      addBridgeAggregate(exclusionsByReason, "operational_row_not_found", 0);
      items.push({
        action: "skipped",
        reason: "operational_row_not_found",
        previousStatus,
        nextStatus: null,
        matchType,
        paymentMethodFamily: "other",
        amountKrw: 0,
      });
      continue;
    }

    matchedRows += 1;
    const amountKrw = Math.round(row.orderAmount);
    const paymentMethodFamily = classifyBridgePaymentMethod(row.paymentMethod, row.isNpay);
    addBridgeAggregate(paymentMethods, paymentMethodFamily, amountKrw);

    let reason: OperationalPaymentCompleteBridgeReason = "confirmed_candidate";
    if (ambiguous) reason = "ambiguous_operational_match";
    else if (row.paymentStatus.toUpperCase() !== "PAYMENT_COMPLETE") reason = "operational_payment_not_complete";
    else if (row.isNpay || paymentMethodFamily === "npay") reason = "npay_excluded";
    else if (amountKrw <= 0 || paymentMethodFamily === "free") reason = "free_zero_amount";
    else if (row.refundAmount > 0) reason = "refund_amount_present";
    else if (row.refundPendingAmount > 0) reason = "refund_pending_amount_present";
    else if (row.hasCancel || row.hasReturn) reason = "cancel_or_return_present";

    if (reason !== "confirmed_candidate") {
      excludedRows += 1;
      excludedAmountKrw += amountKrw;
      addBridgeAggregate(exclusionsByReason, reason, amountKrw);
      items.push({
        action: "skipped",
        reason,
        previousStatus,
        nextStatus: null,
        matchType,
        paymentMethodFamily,
        amountKrw,
      });
      continue;
    }

    const nextEntry = buildOperationalBridgeNextEntry(entry, row, matchType, syncedAt);
    confirmedAmountKrw += amountKrw;
    updates.push({ previousEntry: entry, nextEntry });
    items.push({
      action: "updated",
      reason,
      previousStatus,
      nextStatus: "confirmed",
      matchType,
      paymentMethodFamily,
      amountKrw,
    });
  }

  return {
    totalCandidates: candidates.length,
    scopedCandidates,
    matchedRows,
    updatedRows: updates.length,
    confirmedAmountKrw,
    excludedRows,
    excludedAmountKrw,
    noSendGateRows: updates.length,
    items,
    exclusionsByReason,
    matchTypes,
    paymentMethods,
    updates,
  };
};

export const syncAttributionPaymentStatusesFromOperationalPaymentComplete = async (params?: {
  limit?: number;
  dryRun?: boolean;
  orderIds?: string[];
  loggedAtGte?: string;
}): Promise<OperationalPaymentCompleteBridgeResult> => {
  const dryRun = params?.dryRun ?? true;
  const limit = Math.max(1, Math.min(params?.limit ?? 100, 500));
  const loggedAtGte = params?.loggedAtGte?.trim() ?? "";
  const orderIdFilter = new Set((params?.orderIds ?? []).map((value) => value.trim()).filter(Boolean));
  const entries = await readLedgerEntries();
  const pendingCandidates = entries
    .filter((entry) => entry.touchpoint === "payment_success" && entry.paymentStatus === "pending")
    .filter((entry) => !loggedAtGte || entry.loggedAt >= loggedAtGte)
    .filter((entry) => {
      if (orderIdFilter.size === 0) return true;
      return getExactEntryOrderKeys(entry).some((key) => orderIdFilter.has(key));
    })
    .slice(0, limit);
  const operationalRows = await fetchOperationalPaymentCompleteRowsByPendingEntries(pendingCandidates, limit);
  const plan = buildOperationalPaymentCompleteBridgePlan(pendingCandidates, operationalRows, limit);
  const writtenRows = dryRun ? 0 : updateAttributionLedgerEntries(plan.updates);

  return {
    ok: true,
    dryRun,
    ...plan,
    writtenRows,
    source: {
      primary: "운영DB PostgreSQL dashboard.public.tb_iamweb_users",
      target: "VM Cloud SQLite attribution_ledger",
    },
    notes: [
      "운영DB PAYMENT_COMPLETE는 결제완료 정본으로만 사용했고, 운영DB에는 write하지 않았다.",
      "VM Cloud attribution_ledger row는 안전 후보만 confirmed로 표시하되 metaCapiAutoSendAllowed=false marker를 남긴다.",
      "이 bridge가 만든 confirmed row는 별도 Meta send 승인 전 자동 전송 후보에서 제외된다.",
      "FREE 0원, NPay 미조인, 환불/취소/반품, ambiguous row는 유지한다.",
    ],
  };
};

const IMWEB_BRIDGE_STATUS_VALUES = [
  "PAY_WAIT",
  "PAY_COMPLETE",
  "STANDBY",
  "DELIVERING",
  "COMPLETE",
  "PURCHASE_CONFIRMATION",
  "CANCEL",
  "RETURN",
  "EXCHANGE",
] as const;

type ImwebBridgeStatus = (typeof IMWEB_BRIDGE_STATUS_VALUES)[number];
type ImwebFallbackClassification =
  | "confirmed_by_imweb_api"
  | "pending_or_unpaid_by_imweb_api"
  | "canceled_or_refunded_by_imweb_api"
  | "api_not_found"
  | "api_unavailable";

const fetchBiocomImwebToken = async () => {
  const key = process.env.IMWEB_API_KEY?.trim() ?? "";
  const secret = process.env.IMWEB_SECRET_KEY?.trim() ?? "";
  if (!key || !secret) return "";
  const response = await fetch("https://api.imweb.me/v2/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, secret }),
  });
  const data = (await response.json()) as { access_token?: string };
  return typeof data.access_token === "string" ? data.access_token : "";
};

const fetchBiocomImwebOrdersByStatus = async (
  token: string,
  status: ImwebBridgeStatus,
  page: number,
  limit: number,
) => {
  const response = await fetch(
    `https://api.imweb.me/v2/shop/orders?status=${encodeURIComponent(status)}&offset=${page}&limit=${limit}`,
    { headers: { "Content-Type": "application/json", "access-token": token } },
  );
  const data = (await response.json()) as {
    code?: number;
    msg?: string;
    data?: {
      list?: Array<Record<string, unknown>>;
      pagenation?: { total_page?: string | number };
    };
  };
  return {
    list: data.data?.list ?? [],
    totalPage: Number.parseInt(String(data.data?.pagenation?.total_page ?? "0"), 10),
    error: data.code && data.code !== 200 ? data.msg ?? `Imweb API code ${data.code}` : null,
  };
};

const getImwebOrderKeys = (row: Record<string, unknown>) =>
  [row.order_no, row.order_code, row.channel_order_no]
    .map((value) => (typeof value === "string" || typeof value === "number" ? String(value).trim() : ""))
    .filter(Boolean);

const getImwebOrderAmount = (row: Record<string, unknown>) => {
  const payment = isRecord(row.payment) ? row.payment : {};
  return Math.round(
    normalizeBridgeNumber(payment.payment_amount) ||
      normalizeBridgeNumber(payment.total_price) ||
      normalizeBridgeNumber(row.payment_amount) ||
      normalizeBridgeNumber(row.total_price),
  );
};

const classifyImwebFallbackStatus = (status: string): ImwebFallbackClassification => {
  if (["PAY_COMPLETE", "STANDBY", "DELIVERING", "COMPLETE", "PURCHASE_CONFIRMATION"].includes(status)) {
    return "confirmed_by_imweb_api";
  }
  if (["CANCEL", "RETURN", "EXCHANGE"].includes(status)) return "canceled_or_refunded_by_imweb_api";
  if (status === "PAY_WAIT") return "pending_or_unpaid_by_imweb_api";
  return "api_not_found";
};

const inspectVmCloudImwebCacheAggregate = (targetKeys: string[]) => {
  const empty = {
    table: "VM Cloud SQLite imweb_orders",
    available: false,
    matchedRows: 0,
    statusBlankRows: 0,
    maxSyncedAt: "",
    maxStatusSyncedAt: "",
  };
  if (targetKeys.length === 0) return empty;

  try {
    const db = getCrmDb();
    const table = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='imweb_orders'")
      .get() as { name?: string } | undefined;
    if (!table?.name) return empty;
    const placeholders = targetKeys.map(() => "?").join(",");
    const row = db.prepare(`
      SELECT
        COUNT(*) AS matchedRows,
        SUM(CASE WHEN COALESCE(TRIM(imweb_status), '') = '' THEN 1 ELSE 0 END) AS statusBlankRows,
        MAX(synced_at) AS maxSyncedAt,
        MAX(imweb_status_synced_at) AS maxStatusSyncedAt
      FROM imweb_orders
      WHERE site='biocom'
        AND (order_no IN (${placeholders}) OR channel_order_no IN (${placeholders}) OR order_code IN (${placeholders}))
    `).get([...targetKeys, ...targetKeys, ...targetKeys]) as {
      matchedRows?: number;
      statusBlankRows?: number;
      maxSyncedAt?: string;
      maxStatusSyncedAt?: string;
    } | undefined;

    return {
      ...empty,
      available: true,
      matchedRows: Number(row?.matchedRows ?? 0),
      statusBlankRows: Number(row?.statusBlankRows ?? 0),
      maxSyncedAt: row?.maxSyncedAt ?? "",
      maxStatusSyncedAt: row?.maxStatusSyncedAt ?? "",
    };
  } catch {
    return empty;
  }
};

const runBiocomImwebApiStatusFallbackDryRun = async (params?: {
  limit?: number;
  maxPagesPerStatus?: number;
  loggedAtGte?: string;
}) => {
  const limit = Math.max(1, Math.min(params?.limit ?? 100, 500));
  const maxPagesPerStatus = Math.max(1, Math.min(params?.maxPagesPerStatus ?? 5, 20));
  const loggedAtGte = params?.loggedAtGte?.trim() ?? "";
  const entries = await readLedgerEntries();
  const pendingCandidates = entries
    .filter((entry) => entry.touchpoint === "payment_success" && entry.paymentStatus === "pending")
    .filter((entry) => !loggedAtGte || entry.loggedAt >= loggedAtGte)
    .filter((entry) => getLedgerSource(entry) === "biocom_imweb")
    .slice(0, limit);
  const operationalRows = await fetchOperationalPaymentCompleteRowsByPendingEntries(pendingCandidates, limit);
  const bridgePlan = buildOperationalPaymentCompleteBridgePlan(pendingCandidates, operationalRows, limit);
  const bridgeMatched = new Set(bridgePlan.updates.map((update) => update.previousEntry));
  const targets = pendingCandidates.filter((entry) => !bridgeMatched.has(entry));
  const targetKeys = Array.from(new Set(targets.flatMap(getExactEntryOrderKeys)));
  const cache = inspectVmCloudImwebCacheAggregate(targetKeys);
  const summary: Record<ImwebFallbackClassification, { count: number; amountKrw: number }> = {
    confirmed_by_imweb_api: { count: 0, amountKrw: 0 },
    pending_or_unpaid_by_imweb_api: { count: 0, amountKrw: 0 },
    canceled_or_refunded_by_imweb_api: { count: 0, amountKrw: 0 },
    api_not_found: { count: 0, amountKrw: 0 },
    api_unavailable: { count: 0, amountKrw: 0 },
  };
  const statusCounts: Record<string, number> = {};
  const errors: Record<string, number> = {};

  if (targets.length === 0) {
    return {
      ok: true,
      dryRun: true,
      targetRows: 0,
      source: "Imweb v2 API direct status read-only",
      vmCloudCache: cache,
      summary,
      statusCounts,
      errors,
      notes: ["운영DB bridge 이후 Imweb API fallback 대상 row가 없다."],
    };
  }

  const token = await fetchBiocomImwebToken();
  if (!token) {
    summary.api_unavailable.count = targets.length;
    return {
      ok: true,
      dryRun: true,
      targetRows: targets.length,
      source: "Imweb v2 API direct status read-only",
      vmCloudCache: cache,
      summary,
      statusCounts,
      errors: { token_unavailable: 1 },
      notes: ["IMWEB_API_KEY/IMWEB_SECRET_KEY 토큰 발급 실패 또는 미설정으로 direct fallback을 수행하지 못했다."],
    };
  }

  const imwebByKey = new Map<string, { status: ImwebBridgeStatus; amountKrw: number }>();
  for (const status of IMWEB_BRIDGE_STATUS_VALUES) {
    for (let page = 0; page < maxPagesPerStatus; page++) {
      const result = await fetchBiocomImwebOrdersByStatus(token, status, page, 100);
      if (result.error) {
        errors[status] = (errors[status] ?? 0) + 1;
        break;
      }
      for (const row of result.list) {
        const amountKrw = getImwebOrderAmount(row);
        for (const key of getImwebOrderKeys(row)) {
          if (targetKeys.includes(key) && !imwebByKey.has(key)) {
            imwebByKey.set(key, { status, amountKrw });
          }
        }
      }
      if (result.list.length === 0 || (result.totalPage > 0 && page + 1 >= result.totalPage)) break;
    }
  }

  for (const entry of targets) {
    const match = getExactEntryOrderKeys(entry)
      .map((key) => imwebByKey.get(key))
      .find(Boolean);
    if (!match) {
      summary.api_not_found.count += 1;
      continue;
    }
    const classification = classifyImwebFallbackStatus(match.status);
    summary[classification].count += 1;
    summary[classification].amountKrw += match.amountKrw;
    statusCounts[match.status] = (statusCounts[match.status] ?? 0) + 1;
  }

  return {
    ok: true,
    dryRun: true,
    targetRows: targets.length,
    source: "Imweb v2 API direct status read-only",
    vmCloudCache: cache,
    summary,
    statusCounts,
    errors,
    notes: [
      "Imweb v2 API는 fallback 증거로만 사용했고 VM Cloud/운영DB에 write하지 않았다.",
      "raw order id/payment key는 response에 포함하지 않는다.",
      "confirmed_by_imweb_api row는 2차 bridge 승인안 대상이며, 이번 route는 dry-run만 수행한다.",
    ],
  };
};

const normalizeRemoteLedgerEntry = (value: unknown): AttributionLedgerEntry | null => {
  if (!isRecord(value)) return null;

  const touchpoint = normalizeRemoteTouchpoint(value.touchpoint);
  const loggedAt = readStringField(value, "loggedAt");
  if (!touchpoint || !loggedAt) return null;

  const metadata = isRecord(value.metadata) ? value.metadata : {};
  const requestContext = isRecord(value.requestContext) ? value.requestContext : {};

  return {
    touchpoint,
    captureMode: normalizeRemoteCaptureMode(value.captureMode),
    paymentStatus: normalizeRemotePaymentStatus(value.paymentStatus),
    loggedAt,
    orderId: readStringField(value, "orderId"),
    paymentKey: readStringField(value, "paymentKey"),
    approvedAt: readStringField(value, "approvedAt"),
    checkoutId: readStringField(value, "checkoutId"),
    customerKey: readStringField(value, "customerKey"),
    landing: readStringField(value, "landing"),
    referrer: readStringField(value, "referrer"),
    gaSessionId: readStringField(value, "gaSessionId"),
    utmSource: readStringField(value, "utmSource"),
    utmMedium: readStringField(value, "utmMedium"),
    utmCampaign: readStringField(value, "utmCampaign"),
    utmTerm: readStringField(value, "utmTerm"),
    utmContent: readStringField(value, "utmContent"),
    gclid: readStringField(value, "gclid"),
    fbclid: readStringField(value, "fbclid"),
    ttclid: readStringField(value, "ttclid"),
    metadata,
    requestContext: {
      ip: readStringField(requestContext, "ip"),
      userAgent: readStringField(requestContext, "userAgent"),
      origin: readStringField(requestContext, "origin"),
      requestReferer: readStringField(requestContext, "requestReferer"),
      method: readStringField(requestContext, "method"),
      path: readStringField(requestContext, "path"),
    },
  };
};

const buildRemoteLedgerUrl = (source: string) => {
  const url = new URL("/api/attribution/ledger", OPERATIONAL_ATTRIBUTION_BASE_URL);
  url.searchParams.set("source", source);
  url.searchParams.set("limit", String(ACQUISITION_REMOTE_LEDGER_LIMIT));
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - ACQUISITION_REMOTE_LEDGER_LOOKBACK_DAYS);
  url.searchParams.set("startAt", start.toISOString());
  url.searchParams.set("endAt", end.toISOString());
  return url.toString();
};

const buildLedgerDedupeKey = (entry: AttributionLedgerEntry) =>
  [
    entry.touchpoint,
    entry.loggedAt,
    entry.orderId,
    entry.paymentKey,
    entry.checkoutId,
    entry.landing,
    typeof entry.metadata.source === "string" ? entry.metadata.source : "",
    typeof entry.metadata.formId === "string" ? entry.metadata.formId : "",
  ].join("|");

const MARKETING_INTENT_DEDUPE_MS = 24 * 60 * 60 * 1000;
const MARKETING_INTENT_RATE_LIMIT_MS = 60_000;
const MARKETING_INTENT_RATE_LIMIT_MAX = 60;
const BIOCOM_MARKETING_INTENT_ALLOWED_ORIGINS = new Set([
  "https://biocom.kr",
  "https://www.biocom.kr",
  "https://m.biocom.kr",
  "https://biocom.imweb.me",
]);
const MARKETING_INTENT_ALLOWED_SITES = new Set(["biocom", "biocom_imweb"]);
const MARKETING_INTENT_PII_KEYS = new Set([
  "address",
  "buyeremail",
  "buyername",
  "buyerphone",
  "callnum",
  "customeremail",
  "customername",
  "customerphone",
  "email",
  "mobile",
  "mobilephone",
  "name",
  "ordereremail",
  "orderername",
  "ordererphone",
  "phone",
  "phonenumber",
  "receiver",
  "receiveraddress",
  "receivername",
  "receiverphone",
  "tel",
]);
const MARKETING_INTENT_URL_QUERY_ALLOWLIST = new Set([
  "gad_campaignid",
  "gad_source",
  "gbraid",
  "gclid",
  "ttclid",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "wbraid",
]);
const PRODUCT_ENGAGEMENT_ALLOWED_SITES = new Set(["biocom"]);
const PRODUCT_ENGAGEMENT_EVENT_NAME = "ProductEngagementSummary";
const PRODUCT_ENGAGEMENT_URL_QUERY_ALLOWLIST = new Set([
  "gad_campaignid",
  "gad_source",
  "idx",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "fbclid",
  "gclid",
  "ttclid",
  "gbraid",
  "wbraid",
]);
const PRODUCT_ENGAGEMENT_REJECT_KEYS = new Set([
  "value",
  "currency",
  "card",
  "cardnumber",
  "account",
  "accountnumber",
  "bankaccount",
  "symptom",
  "symptoms",
  "disease",
  "diagnosis",
  "healthstatus",
  "healthcondition",
  "cookie",
  "rawcookie",
]);
const CONFIRMED_PURCHASE_ALLOWED_SITES = new Set(["biocom"]);
const CONFIRMED_PURCHASE_ALLOWED_PAYMENT_METHODS = new Set(["homepage", "npay"]);
const CONFIRMED_PURCHASE_ALLOWED_STAGES = new Set(["payment_complete", "confirmed_order"]);
const CONFIRMED_PURCHASE_BLOCKED_STAGES = new Set([
  "npay_click",
  "npay_count",
  "payment_start",
  "add_payment_info",
  "begin_checkout",
  "checkout_started",
]);
const CONFIRMED_PURCHASE_URL_QUERY_ALLOWLIST = new Set([
  "gad_campaignid",
  "gad_source",
  "idx",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "fbclid",
  "gclid",
  "ttclid",
  "gbraid",
  "wbraid",
]);
const CONFIRMED_PURCHASE_REJECT_KEYS = new Set([
  "card",
  "cardnumber",
  "account",
  "accountnumber",
  "bankaccount",
  "rawcookie",
  "cookie",
  "access_token",
  "token",
  "password",
]);
const PAID_CLICK_INTENT_ALLOWED_SITES = new Set(["biocom"]);
const PAID_CLICK_INTENT_ALLOWED_STAGES = new Set([
  "landing",
  "page_view",
  "cart",
  "add_to_cart",
  "checkout_start",
  "payment_start",
  "npay_intent",
]);
const PAID_CLICK_INTENT_URL_QUERY_ALLOWLIST = new Set([
  "gad_campaignid",
  "gad_source",
  "idx",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "fbclid",
  "gclid",
  "ttclid",
  "gbraid",
  "wbraid",
]);
const PAID_CLICK_INTENT_REJECT_KEYS = new Set([
  "value",
  "currency",
  "order_number",
  "ordernumber",
  "channel_order_no",
  "channelorderno",
  "paid_at",
  "paidat",
  "card",
  "cardnumber",
  "account",
  "accountnumber",
  "bankaccount",
  "rawcookie",
  "cookie",
  "access_token",
  "token",
  "password",
]);
const PAID_CLICK_INTENT_BODY_LIMIT_BYTES = 16 * 1024;
const ORDER_BRIDGE_IDENTITY_HMAC_BODY_LIMIT_BYTES = 16 * 1024;
const PAID_CLICK_INTENT_BLOCKED_PATH_PARTS = [
  "/admin",
  "/backpg/login",
  "/login",
  "/logout",
  "/_bo-analytics",
  "/api/",
];
const marketingIntentRateLimit = new Map<string, { count: number; windowStart: number }>();

const metadataText = (entry: AttributionLedgerEntry, key: string) => {
  const value = entry.metadata[key];
  return typeof value === "string" ? value.trim() : "";
};

const marketingIntentSource = (entry: AttributionLedgerEntry) => metadataText(entry, "source");
const normalizeSecurityKey = (key: string) => key.replace(/[^a-z0-9]/gi, "").toLowerCase();

const parseUrlSafe = (value: string) => {
  if (!value.trim()) return null;
  try {
    return new URL(value, "https://biocom.kr");
  } catch {
    return null;
  }
};

const requestOriginFrom = (value: string) => {
  const parsed = parseUrlSafe(value);
  return parsed ? parsed.origin.toLowerCase() : "";
};

const sanitizeMarketingIntentUrl = (value: string) => {
  const parsed = parseUrlSafe(value);
  if (!parsed) return value.split("#")[0].split("?")[0].slice(0, 2000);

  const nextSearch = new URLSearchParams();
  parsed.searchParams.forEach((paramValue, paramKey) => {
    if (MARKETING_INTENT_URL_QUERY_ALLOWLIST.has(paramKey.toLowerCase())) {
      nextSearch.append(paramKey, paramValue.slice(0, 500));
    }
  });
  parsed.search = nextSearch.toString();
  parsed.hash = "";
  return parsed.toString().slice(0, 2000);
};

const sanitizeMarketingIntentBody = (body: Record<string, unknown>) => {
  for (const key of ["landing", "referrer"]) {
    const raw = body[key];
    if (typeof raw === "string") body[key] = sanitizeMarketingIntentUrl(raw);
  }

  const metadata = body.metadata;
  if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
    const record = metadata as Record<string, unknown>;
    for (const key of ["landing", "referrer", "url", "pageLocation", "page_location"]) {
      const raw = record[key];
      if (typeof raw === "string") record[key] = sanitizeMarketingIntentUrl(raw);
    }
  }
};

const sanitizeProductEngagementUrl = (value: string) => {
  const parsed = parseUrlSafe(value);
  if (!parsed) return value.split("#")[0].split("?")[0].slice(0, 2000);

  const nextSearch = new URLSearchParams();
  parsed.searchParams.forEach((paramValue, paramKey) => {
    if (PRODUCT_ENGAGEMENT_URL_QUERY_ALLOWLIST.has(paramKey.toLowerCase())) {
      nextSearch.append(paramKey, paramValue.slice(0, 500));
    }
  });
  parsed.search = nextSearch.toString();
  parsed.hash = "";
  return parsed.toString().slice(0, 2000);
};

const findProductEngagementRejectedField = (value: unknown, path: string[] = []): string | null => {
  if (!value || typeof value !== "object") return null;
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const nested = findProductEngagementRejectedField(value[index], [...path, String(index)]);
      if (nested) return nested;
    }
    return null;
  }

  for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
    const normalized = normalizeSecurityKey(key);
    if (MARKETING_INTENT_PII_KEYS.has(normalized) || PRODUCT_ENGAGEMENT_REJECT_KEYS.has(normalized)) {
      return [...path, key].join(".");
    }
    if (typeof nestedValue === "string" && /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(nestedValue)) {
      return [...path, key].join(".");
    }
    const nested = findProductEngagementRejectedField(nestedValue, [...path, key]);
    if (nested) return nested;
  }
  return null;
};

const textField = (body: Record<string, unknown>, key: string) =>
  typeof body[key] === "string" ? body[key].trim() : "";

const numberField = (body: Record<string, unknown>, key: string) => {
  const value = body[key];
  if (typeof value === "number") return Number.isFinite(value) ? value : Number.NaN;
  if (typeof value === "string" && value.trim()) return Number(value);
  return Number.NaN;
};

const booleanField = (body: Record<string, unknown>, key: string) => {
  const value = body[key];
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "y", "yes"].includes(normalized)) return true;
    if (["0", "false", "n", "no"].includes(normalized)) return false;
  }
  return false;
};

const productEngagementAttentionScore = (visibleSeconds: number, maxScrollPercent: number) => {
  const timeScore = Math.min(50, Math.max(0, visibleSeconds) / 90 * 50);
  const scrollScore = Math.min(50, Math.max(0, maxScrollPercent) / 100 * 50);
  return Math.round(Math.min(100, timeScore + scrollScore));
};

const sanitizeConfirmedPurchaseUrl = (value: string) => {
  const parsed = parseUrlSafe(value);
  if (!parsed) return value.split("#")[0].split("?")[0].slice(0, 2000);

  const nextSearch = new URLSearchParams();
  parsed.searchParams.forEach((paramValue, paramKey) => {
    if (CONFIRMED_PURCHASE_URL_QUERY_ALLOWLIST.has(paramKey.toLowerCase())) {
      nextSearch.append(paramKey, paramValue.slice(0, 500));
    }
  });
  parsed.search = nextSearch.toString();
  parsed.hash = "";
  return parsed.toString().slice(0, 2000);
};

const sanitizePaidClickIntentUrl = (value: string) => {
  const parsed = parseUrlSafe(value);
  if (!parsed) return value.split("#")[0].split("?")[0].slice(0, 2000);

  const nextSearch = new URLSearchParams();
  parsed.searchParams.forEach((paramValue, paramKey) => {
    if (PAID_CLICK_INTENT_URL_QUERY_ALLOWLIST.has(paramKey.toLowerCase())) {
      nextSearch.append(paramKey, paramValue.slice(0, 500));
    }
  });
  parsed.search = nextSearch.toString();
  parsed.hash = "";
  return parsed.toString().slice(0, 2000);
};

const urlParamFromRaw = (value: string, key: string) => {
  const parsed = parseUrlSafe(value);
  if (!parsed) return "";
  return parsed.searchParams.get(key)?.trim() ?? "";
};

const normalizeGoogleCampaignId = (value: string) => {
  const trimmed = value.trim();
  return /^\d{6,}$/.test(trimmed) ? trimmed.slice(0, 32) : "";
};

const findConfirmedPurchaseRejectedField = (value: unknown, path: string[] = []): string | null => {
  if (!value || typeof value !== "object") return null;
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const nested = findConfirmedPurchaseRejectedField(value[index], [...path, String(index)]);
      if (nested) return nested;
    }
    return null;
  }

  for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
    const normalized = normalizeSecurityKey(key);
    if (MARKETING_INTENT_PII_KEYS.has(normalized) || CONFIRMED_PURCHASE_REJECT_KEYS.has(normalized)) {
      return [...path, key].join(".");
    }
    if (typeof nestedValue === "string" && /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(nestedValue)) {
      return [...path, key].join(".");
    }
    const nested = findConfirmedPurchaseRejectedField(nestedValue, [...path, key]);
    if (nested) return nested;
  }
  return null;
};

const findPaidClickIntentRejectedField = (value: unknown, path: string[] = []): string | null => {
  if (!value || typeof value !== "object") return null;
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const nested = findPaidClickIntentRejectedField(value[index], [...path, String(index)]);
      if (nested) return nested;
    }
    return null;
  }

  for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
    const normalized = normalizeSecurityKey(key);
    if (MARKETING_INTENT_PII_KEYS.has(normalized) || PAID_CLICK_INTENT_REJECT_KEYS.has(normalized)) {
      return [...path, key].join(".");
    }
    if (typeof nestedValue === "string" && /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(nestedValue)) {
      return [...path, key].join(".");
    }
    const nested = findPaidClickIntentRejectedField(nestedValue, [...path, key]);
    if (nested) return nested;
  }
  return null;
};

const estimateJsonSizeBytes = (value: unknown) => {
  try {
    return Buffer.byteLength(JSON.stringify(value), "utf8");
  } catch {
    return Number.POSITIVE_INFINITY;
  }
};

const paidClickIntentBlockedPath = (body: Record<string, unknown>) => {
  const rawUrlCandidates = [
    textField(body, "landing_url"),
    textField(body, "landingUrl"),
    textField(body, "current_url"),
    textField(body, "currentUrl"),
    textField(body, "page_location"),
    textField(body, "pageLocation"),
  ].filter(Boolean);

  for (const rawUrl of rawUrlCandidates) {
    const parsed = parseUrlSafe(rawUrl);
    const path = (parsed?.pathname || rawUrl).toLowerCase();
    const blockedPart = PAID_CLICK_INTENT_BLOCKED_PATH_PARTS.find((part) => path.includes(part));
    if (blockedPart) {
      return {
        blocked_part: blockedPart,
        path: path.slice(0, 300),
      };
    }
  }

  return null;
};

const isPreviewClickId = (value: string) => {
  const normalized = value.trim().toUpperCase();
  return normalized.startsWith("TEST_") || normalized.startsWith("DEBUG_") || normalized.startsWith("PREVIEW_");
};

const uniqueNonEmpty = (values: string[]) => Array.from(new Set(values.filter(Boolean)));

const canonicalAttributionBlockReason = (reason: string) => {
  if (reason === "order_canceled") return "canceled_order";
  if (reason === "order_refunded") return "refunded_order";
  return reason;
};

const canonicalAttributionBlockReasons = (reasons: string[]) =>
  uniqueNonEmpty(reasons.map(canonicalAttributionBlockReason));

const legacyAttributionBlockReasons = (reasons: string[]) =>
  uniqueNonEmpty(reasons.filter((reason) => canonicalAttributionBlockReason(reason) !== reason));

const noSendGuardAliases = {
  dryRun: true,
  dry_run: true,
  wouldStore: false,
  would_store: false,
  wouldSend: false,
  would_send: false,
  noSendVerified: true,
  no_send_verified: true,
  noWriteVerified: true,
  no_write_verified: true,
  noDeployVerified: true,
  no_deploy_verified: true,
  noPublishVerified: true,
  no_publish_verified: true,
  noPlatformSendVerified: true,
  no_platform_send_verified: true,
};

const buildNoSendGuard = ({
  blockReasons,
  legacyBlockReasons = [],
  source,
  checkedAt,
  confidence = 0.9,
}: {
  blockReasons: string[];
  legacyBlockReasons?: string[];
  source: string;
  checkedAt: string;
  confidence?: number;
}) => ({
  guard_status: "blocked" as const,
  send_candidate: false,
  actual_send_candidate: false,
  block_reasons: canonicalAttributionBlockReasons(blockReasons),
  legacy_block_reasons: uniqueNonEmpty([
    ...legacyBlockReasons,
    ...legacyAttributionBlockReasons(blockReasons),
  ]),
  no_send_verified: true,
  no_write_verified: true,
  no_deploy_verified: true,
  no_publish_verified: true,
  no_platform_send_verified: true,
  checked_at: checkedAt,
  source,
  confidence,
});

const buildPaidClickIntentNoSendPreview = (body: Record<string, unknown>) => {
  const site = textField(body, "site") || "biocom";
  const eventName = textField(body, "event_name") || textField(body, "eventName") || "PaidClickIntent";
  const captureStage = (textField(body, "capture_stage") || textField(body, "captureStage") || "landing").toLowerCase();
  const capturedAt = textField(body, "captured_at") || textField(body, "capturedAt") || new Date().toISOString();
  const gclid = textField(body, "gclid");
  const gbraid = textField(body, "gbraid");
  const wbraid = textField(body, "wbraid");
  const fbclid = textField(body, "fbclid");
  const ttclid = textField(body, "ttclid");
  const utmSource = textField(body, "utm_source") || textField(body, "utmSource");
  const utmMedium = textField(body, "utm_medium") || textField(body, "utmMedium");
  const utmCampaign = textField(body, "utm_campaign") || textField(body, "utmCampaign");
  const utmTerm = textField(body, "utm_term") || textField(body, "utmTerm");
  const utmContent = textField(body, "utm_content") || textField(body, "utmContent");
  const clientId = textField(body, "client_id") || textField(body, "clientId");
  const gaSessionId = textField(body, "ga_session_id") || textField(body, "gaSessionId");
  const localSessionId = textField(body, "local_session_id") || textField(body, "localSessionId");
  const landingUrlRaw = textField(body, "landing_url") || textField(body, "landingUrl") || textField(body, "page_location") || textField(body, "pageLocation");
  const currentUrlRaw = textField(body, "current_url") || textField(body, "currentUrl") || landingUrlRaw;
  const referrerRaw = textField(body, "referrer") || textField(body, "page_referrer") || textField(body, "pageReferrer");
  const googleCampaignId = normalizeGoogleCampaignId(
    urlParamFromRaw(landingUrlRaw, "gad_campaignid")
    || urlParamFromRaw(currentUrlRaw, "gad_campaignid"),
  );
  const gadSource = (
    urlParamFromRaw(landingUrlRaw, "gad_source")
    || urlParamFromRaw(currentUrlRaw, "gad_source")
  ).slice(0, 32);
  const eventId = textField(body, "event_id") || textField(body, "eventId") || `PaidClickIntent_${captureStage}_${Date.now()}`;
  const storageKey = textField(body, "storage_key") || textField(body, "storageKey") || "bi_paid_click_intent_v1";
  const memberCodeRaw = textField(body, "member_code") || textField(body, "memberCode");
  const memberCode = (() => {
    const v = (memberCodeRaw || "").trim();
    if (!v) return "";
    if (v.length > 64) return "";
    return /^(m|gu)[a-z0-9]{0,62}$/i.test(v) ? v : "";
  })();
  const googleClickIds = [gclid, gbraid, wbraid].filter(Boolean);
  const hasGoogleClickId = googleClickIds.length > 0;
  const testClickId = googleClickIds.some(isPreviewClickId);
  const sessionKey = gaSessionId || localSessionId || clientId || "missing_session";
  const blockReasons = ["read_only_phase", "approval_required"];

  if (!PAID_CLICK_INTENT_ALLOWED_SITES.has(site)) blockReasons.push("site_not_allowed");
  if (!PAID_CLICK_INTENT_ALLOWED_STAGES.has(captureStage)) blockReasons.push("capture_stage_not_allowed");
  if (!capturedAt || Number.isNaN(Date.parse(capturedAt))) blockReasons.push("invalid_captured_at");
  if (!hasGoogleClickId) blockReasons.push("missing_google_click_id");
  if (testClickId) blockReasons.push("test_click_id_rejected_for_live");
  const canonicalBlockReasons = canonicalAttributionBlockReasons(blockReasons);
  const legacyBlockReasons = legacyAttributionBlockReasons(blockReasons);
  const clickIdentifiers = { gclid, gbraid, wbraid, fbclid, ttclid };

  return {
    site,
    event_name: eventName,
    capture_stage: captureStage,
    event_id: eventId,
    storage_key: storageKey,
    captured_at: capturedAt,
    dedupe_key: `paid_click_intent:${site}:${sessionKey}:${captureStage}:${googleClickIds[0] || "missing"}`,
    has_google_click_id: hasGoogleClickId,
    test_click_id: testClickId,
    live_candidate_after_approval: hasGoogleClickId && !testClickId && blockReasons.every((reason) => ["read_only_phase", "approval_required"].includes(reason)),
    send_candidate: false,
    actual_send_candidate: false,
    would_store: false,
    would_send: false,
    block_reasons: canonicalBlockReasons,
    legacy_block_reasons: legacyBlockReasons,
    click_ids: clickIdentifiers,
    click_identifiers: clickIdentifiers,
    utm: {
      source: utmSource,
      medium: utmMedium,
      campaign: utmCampaign,
      term: utmTerm,
      content: utmContent,
    },
    client_id: clientId,
    ga_session_id: gaSessionId,
    local_session_id: localSessionId,
    sanitized_landing_url: landingUrlRaw ? sanitizePaidClickIntentUrl(landingUrlRaw) : "",
    sanitized_current_url: currentUrlRaw ? sanitizePaidClickIntentUrl(currentUrlRaw) : "",
    sanitized_referrer: referrerRaw ? sanitizePaidClickIntentUrl(referrerRaw) : "",
    google_campaign_id: googleCampaignId,
    gad_campaignid: googleCampaignId,
    gad_source: gadSource,
    member_code: memberCode,
  };
};

const buildConfirmedPurchaseNoSendPreview = (body: Record<string, unknown>) => {
  const site = textField(body, "site") || "biocom";
  const orderNumber = textField(body, "order_number") || textField(body, "orderNumber");
  const channelOrderNo = textField(body, "channel_order_no") || textField(body, "channelOrderNo");
  const paymentMethod = (textField(body, "payment_method") || textField(body, "paymentMethod")).toLowerCase();
  const signalStage = (textField(body, "signal_stage") || textField(body, "signalStage")).toLowerCase();
  const paidAt = textField(body, "paid_at") || textField(body, "paidAt") || textField(body, "conversion_time");
  const value = numberField(body, "value");
  const currency = textField(body, "currency") || "KRW";
  const clientId = textField(body, "client_id") || textField(body, "clientId");
  const gaSessionId = textField(body, "ga_session_id") || textField(body, "gaSessionId");
  const gclid = textField(body, "gclid");
  const gbraid = textField(body, "gbraid");
  const wbraid = textField(body, "wbraid");
  const fbclid = textField(body, "fbclid");
  const ttclid = textField(body, "ttclid");
  const eventId = textField(body, "event_id") || textField(body, "eventId") || `ConfirmedPurchase_${orderNumber || channelOrderNo || "missing"}`;
  const pageLocationRaw = textField(body, "page_location") || textField(body, "pageLocation");
  const pageReferrerRaw = textField(body, "page_referrer") || textField(body, "pageReferrer");
  const sanitizedPageLocation = pageLocationRaw ? sanitizeConfirmedPurchaseUrl(pageLocationRaw) : "";
  const sanitizedPageReferrer = pageReferrerRaw ? sanitizeConfirmedPurchaseUrl(pageReferrerRaw) : "";
  const blockReasons = ["read_only_phase", "approval_required"];
  const legacyBlockReasons: string[] = [];

  if (!CONFIRMED_PURCHASE_ALLOWED_SITES.has(site)) blockReasons.push("site_not_allowed");
  if (!orderNumber && !channelOrderNo) blockReasons.push("missing_order_identity");
  if (!CONFIRMED_PURCHASE_ALLOWED_PAYMENT_METHODS.has(paymentMethod)) blockReasons.push("payment_method_not_allowed");
  if (CONFIRMED_PURCHASE_BLOCKED_STAGES.has(signalStage)) blockReasons.push(`blocked_signal_stage_${signalStage}`);
  if (!CONFIRMED_PURCHASE_ALLOWED_STAGES.has(signalStage)) blockReasons.push("signal_stage_must_be_payment_complete");
  if (!paidAt || Number.isNaN(Date.parse(paidAt))) blockReasons.push("invalid_paid_at");
  if (!Number.isFinite(value) || value <= 0) blockReasons.push("invalid_value");
  if (currency !== "KRW") blockReasons.push("currency_not_allowed");
  if (booleanField(body, "is_test")) blockReasons.push("test_order");
  if (booleanField(body, "is_manual")) blockReasons.push("manual_order");
  if (booleanField(body, "is_canceled")) {
    blockReasons.push("canceled_order");
    legacyBlockReasons.push("order_canceled");
  }
  if (booleanField(body, "is_refunded")) {
    blockReasons.push("refunded_order");
    legacyBlockReasons.push("order_refunded");
  }

  const googleClickId = gclid || gbraid || wbraid;
  const dedupeKey = `confirmed_purchase:${site}:${channelOrderNo || orderNumber || "missing"}`;
  const canonicalBlockReasons = canonicalAttributionBlockReasons(blockReasons);
  const clickIdentifiers = { gclid, gbraid, wbraid, fbclid, ttclid };
  const utmCampaign = textField(body, "utm_campaign") || textField(body, "utmCampaign");
  const pathBBridgePresent = booleanField(body, "path_b_bridge_present") || booleanField(body, "pathBBridgePresent");
  const confirmedPaidPurchaseInput =
    typeof body.confirmed_paid_purchase === "boolean"
      ? (body.confirmed_paid_purchase as boolean)
      : typeof body.confirmedPaidPurchase === "boolean"
        ? (body.confirmedPaidPurchase as boolean)
        : !blockReasons.includes("canceled_order") && !blockReasons.includes("refunded_order");
  const crossReferenceEvidence = classifyCrossReferenceEvidence({
    click_identifiers: clickIdentifiers,
    payment_method: paymentMethod,
    utm_campaign: utmCampaign,
    path_b_bridge_present: pathBBridgePresent,
    confirmed_paid_purchase: confirmedPaidPurchaseInput,
    ledger_lookup: null,
  });

  return {
    site,
    order_number: orderNumber,
    channel_order_no: channelOrderNo,
    include_reason: paymentMethod === "npay" ? "npay_confirmed_order" : "homepage_confirmed_order",
    payment_method: paymentMethod,
    signal_stage: signalStage,
    value: Number.isFinite(value) ? Math.round(value) : null,
    currency,
    paid_at: paidAt,
    event_id: eventId,
    dedupe_key: dedupeKey,
    client_id: clientId,
    ga_session_id: gaSessionId,
    click_ids: clickIdentifiers,
    click_identifiers: clickIdentifiers,
    cross_reference_evidence: crossReferenceEvidence,
    sanitized_page_location: sanitizedPageLocation,
    sanitized_page_referrer: sanitizedPageReferrer,
    has_google_click_id: Boolean(googleClickId),
    send_candidate: false,
    actual_send_candidate: false,
    would_store: false,
    would_send: false,
    block_reasons: canonicalBlockReasons,
    legacy_block_reasons: legacyBlockReasons,
    platform_payload_preview: {
      ga4: {
        event_name: "purchase",
        transaction_id: orderNumber,
        value: Number.isFinite(value) ? Math.round(value) : null,
        currency,
        client_id: clientId,
        ga_session_id: gaSessionId,
        event_id: eventId,
        blocked: true,
        block_reason: "ga4_measurement_protocol_not_approved",
      },
      meta: {
        event_name: "Purchase",
        event_id: eventId,
        value: Number.isFinite(value) ? Math.round(value) : null,
        currency,
        event_source_url: sanitizedPageLocation,
        blocked: true,
        block_reason: "meta_capi_purchase_not_approved",
      },
      google_ads: {
        conversion_name: "BI confirmed_purchase",
        order_id: channelOrderNo || orderNumber,
        conversion_time: paidAt,
        conversion_value: Number.isFinite(value) ? Math.round(value) : null,
        currency_code: currency,
        gclid,
        gbraid,
        wbraid,
        blocked: true,
        block_reason: "google_ads_conversion_upload_not_approved",
      },
    },
  };
};

type PaymentSuccessOrderBridgeR2Result = {
  attempted: boolean;
  write_flag_on: boolean;
  stored: boolean;
  deduped: boolean;
  rejected_reason: string | null;
  status: string | null;
  preview_hash_present: {
    email_hash: boolean;
    phone_hash: boolean;
    order_no_hash: boolean;
    click_id_hash: boolean;
    client_session: boolean;
  };
  raw_echo_verified: true;
  send_candidate: false;
  actual_send_candidate: false;
  upload_candidate: false;
};

export const recordPaymentSuccessOrderBridgeLedger = (
  body: Record<string, unknown>,
  ledgerEntry: AttributionLedgerEntry,
): PaymentSuccessOrderBridgeR2Result => {
  const writeFlagOn = isOrderBridgeWriteEnabled();
  const baseResult: PaymentSuccessOrderBridgeR2Result = {
    attempted: false,
    write_flag_on: writeFlagOn,
    stored: false,
    deduped: false,
    rejected_reason: null,
    status: null,
    preview_hash_present: {
      email_hash: false,
      phone_hash: false,
      order_no_hash: false,
      click_id_hash: false,
      client_session: false,
    },
    raw_echo_verified: true,
    send_candidate: false,
    actual_send_candidate: false,
    upload_candidate: false,
  };

  const orderNo = textField(body, "order_no") || textField(body, "orderNo") || textField(body, "order_number") || textField(body, "orderNumber") || textField(body, "orderId") || ledgerEntry.orderId;
  if (!orderNo) {
    return { ...baseResult, attempted: true, rejected_reason: "missing_order_key" };
  }

  if (!process.env.ORDER_BRIDGE_IDENTITY_HASH_SECRET) {
    return { ...baseResult, attempted: true, rejected_reason: "hash_secret_missing" };
  }

  const clickId =
    textField(body, "click_id") ||
    textField(body, "clickId") ||
    textField(body, "gclid") ||
    textField(body, "gbraid") ||
    textField(body, "wbraid") ||
    textField(body, "ttclid") ||
    textField(body, "nclick_id") ||
    "";
  const ledgerMetadata = (ledgerEntry.metadata ?? {}) as Record<string, unknown>;
  const fallbackPhone = textField(ledgerMetadata, "normalizedPhone");

  const material = (() => {
    try {
      return buildOrderBridgeIdentityHmacMaterial(
        {
          ...body,
          order_no: orderNo,
          click_id: clickId,
          ga_session_id: ledgerEntry.gaSessionId || textField(body, "ga_session_id") || textField(body, "gaSessionId"),
          client_id: textField(ledgerMetadata, "clientId") || textField(body, "client_id") || textField(body, "clientId"),
          local_session_id: textField(body, "local_session_id") || textField(body, "localSessionId"),
          phone: textField(body, "phone") || textField(body, "ordererCall") || textField(body, "phone_buy") || textField(body, "buyerPhone") || fallbackPhone,
          email: textField(body, "email") || textField(body, "ordererEmail") || textField(body, "email_buy") || textField(body, "buyerEmail"),
        },
        {
          secret: process.env.ORDER_BRIDGE_IDENTITY_HASH_SECRET ?? "",
          receivedAt: ledgerEntry.loggedAt || new Date().toISOString(),
        },
      );
    } catch (error) {
      return { _error: error instanceof Error ? error.message : "buildOrderBridgeIdentityHmacMaterial_failed" };
    }
  })();

  if ("_error" in material) {
    return { ...baseResult, attempted: true, rejected_reason: material._error ?? "buildOrderBridgeIdentityHmacMaterial_failed" };
  }

  const presenceResult: PaymentSuccessOrderBridgeR2Result = {
    ...baseResult,
    attempted: true,
    preview_hash_present: {
      email_hash: material.preview.email_hash_present,
      phone_hash: material.preview.phone_hash_present,
      order_no_hash: material.preview.order_no_hash_present,
      click_id_hash: material.preview.click_id_hash_present,
      client_session: material.preview.client_session_present,
    },
    status: material.preview.row_status ?? null,
  };

  if (!writeFlagOn) {
    return { ...presenceResult, rejected_reason: "write_flag_disabled" };
  }

  if (isOrderBridgePlatformSendEnabled()) {
    return { ...presenceResult, rejected_reason: "platform_send_flag_enabled" };
  }
  if (isOrderBridgeRawBodyLoggingEnabled()) {
    return { ...presenceResult, rejected_reason: "raw_body_logging_enabled" };
  }

  const writeResult = recordOrderBridgeLedger(material);
  if (!writeResult.stored) {
    return { ...presenceResult, rejected_reason: writeResult.reason };
  }

  return {
    ...presenceResult,
    stored: true,
    deduped: writeResult.deduped,
    status: writeResult.row.status,
  };
};

const findMarketingIntentPiiKey = (value: unknown, path: string[] = []): string | null => {
  if (!value || typeof value !== "object") return null;
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const nested = findMarketingIntentPiiKey(value[index], [...path, String(index)]);
      if (nested) return nested;
    }
    return null;
  }

  for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
    const normalized = normalizeSecurityKey(key);
    if (MARKETING_INTENT_PII_KEYS.has(normalized)) return [...path, key].join(".");
    if (typeof nestedValue === "string" && /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(nestedValue)) {
      return [...path, key].join(".");
    }
    const nested = findMarketingIntentPiiKey(nestedValue, [...path, key]);
    if (nested) return nested;
  }
  return null;
};

const getMarketingIntentClientKey = (entry: AttributionLedgerEntry) =>
  metadataText(entry, "clientId") ||
  metadataText(entry, "userPseudoId") ||
  entry.gaSessionId ||
  entry.requestContext.ip;

const getMarketingIntentPath = (entry: AttributionLedgerEntry) => {
  const parsed = parseUrlSafe(entry.landing);
  return parsed ? parsed.pathname : entry.landing.split("?")[0].slice(0, 200);
};

const getMarketingIntentReferrerHostPath = (entry: AttributionLedgerEntry) => {
  const parsed = parseUrlSafe(entry.referrer);
  return parsed ? `${parsed.hostname.toLowerCase()}${parsed.pathname}` : entry.referrer.split("?")[0].slice(0, 200);
};

const getMarketingIntentDedupeFingerprint = (entry: AttributionLedgerEntry) => {
  const ttclid = entry.ttclid || metadataText(entry, "ttclid");
  if (ttclid) return { tier: "ttclid", key: ttclid };

  const campaign = entry.utmCampaign;
  const content = entry.utmContent;
  const term = entry.utmTerm;
  if (campaign || content || term) {
    return {
      tier: "utm",
      key: [campaign || "no_campaign", content || "no_content", getMarketingIntentPath(entry)].join("|"),
    };
  }

  return {
    tier: "referrer",
    key: [
      getMarketingIntentReferrerHostPath(entry) || "no_referrer",
      getMarketingIntentPath(entry),
      entry.loggedAt.slice(0, 10),
    ].join("|"),
  };
};

const sameMarketingIntent = (left: AttributionLedgerEntry, right: AttributionLedgerEntry) => {
  if (left.touchpoint !== "marketing_intent" || right.touchpoint !== "marketing_intent") return false;
  if (marketingIntentSource(left) !== marketingIntentSource(right)) return false;

  const leftFingerprint = getMarketingIntentDedupeFingerprint(left);
  const rightFingerprint = getMarketingIntentDedupeFingerprint(right);
  if (leftFingerprint.tier !== rightFingerprint.tier || leftFingerprint.key !== rightFingerprint.key) return false;
  if (leftFingerprint.tier === "ttclid") return true;
  return getMarketingIntentClientKey(left) === getMarketingIntentClientKey(right);
};

const findDuplicateMarketingIntentEntry = (
  existing: AttributionLedgerEntry[],
  entry: AttributionLedgerEntry,
  nowIso = entry.loggedAt,
) => {
  const nowMs = Date.parse(nowIso);
  return existing.find((candidate) => {
    const candidateMs = Date.parse(candidate.loggedAt);
    if (!Number.isFinite(nowMs) || !Number.isFinite(candidateMs)) return false;
    if (nowMs - candidateMs > MARKETING_INTENT_DEDUPE_MS) return false;
    if (candidateMs - nowMs > 10 * 60 * 1000) return false;
    return sameMarketingIntent(candidate, entry);
  }) ?? null;
};

const checkMarketingIntentRateLimit = (req: Request) => {
  const key = req.ip || req.socket.remoteAddress || "unknown";
  const now = Date.now();
  const entry = marketingIntentRateLimit.get(key);
  if (!entry || now - entry.windowStart > MARKETING_INTENT_RATE_LIMIT_MS) {
    marketingIntentRateLimit.set(key, { count: 1, windowStart: now });
    return { allowed: true, retryAfterSeconds: 0 };
  }
  entry.count += 1;
  if (entry.count <= MARKETING_INTENT_RATE_LIMIT_MAX) return { allowed: true, retryAfterSeconds: 0 };
  return {
    allowed: false,
    retryAfterSeconds: Math.ceil((MARKETING_INTENT_RATE_LIMIT_MS - (now - entry.windowStart)) / 1000),
  };
};

const requireBiocomMarketingIntentRequest = (req: Request, body: Record<string, unknown>) => {
  const origin = typeof req.headers.origin === "string" ? req.headers.origin.replace(/\/$/, "").toLowerCase() : "";
  const referer = typeof req.headers.referer === "string" ? req.headers.referer : "";
  const refererOrigin = requestOriginFrom(referer).replace(/\/$/, "").toLowerCase();
  const landingOrigin = typeof body.landing === "string" ? requestOriginFrom(body.landing).replace(/\/$/, "").toLowerCase() : "";
  const candidates = [origin, refererOrigin, landingOrigin].filter(Boolean);
  const matchedOrigin = candidates.find((candidate) => BIOCOM_MARKETING_INTENT_ALLOWED_ORIGINS.has(candidate));
  if (!matchedOrigin) {
    return { ok: false as const, reason: "origin_not_allowed", detail: origin || refererOrigin || landingOrigin || "missing_origin" };
  }

  if (origin && !BIOCOM_MARKETING_INTENT_ALLOWED_ORIGINS.has(origin)) {
    return { ok: false as const, reason: "origin_not_allowed", detail: origin };
  }

  const source = typeof body.source === "string" ? body.source.trim() : "";
  const metadata = body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata)
    ? body.metadata as Record<string, unknown>
    : {};
  const metadataSource = typeof metadata.source === "string" ? metadata.source.trim() : "";
  const site = typeof body.site === "string"
    ? body.site.trim()
    : typeof metadata.site === "string"
      ? metadata.site.trim()
      : "biocom";
  if (!MARKETING_INTENT_ALLOWED_SITES.has(site)) {
    return { ok: false as const, reason: "site_not_allowed", detail: site };
  }
  if ((source && source !== "biocom_imweb") || (metadataSource && metadataSource !== "biocom_imweb")) {
    return { ok: false as const, reason: "source_not_allowed", detail: source || metadataSource };
  }
  return { ok: true as const, matchedOrigin };
};

const hasStrictTikTokMarketingIntentEvidence = (entry: AttributionLedgerEntry) => {
  const reasons = new Set<string>();
  const addTikTokUtm = (label: string, value: string) => {
    if (value.toLowerCase().includes("tiktok")) reasons.add(label);
  };

  if (entry.ttclid || metadataText(entry, "ttclid")) reasons.add("ttclid");
  addTikTokUtm("utm_source_tiktok", entry.utmSource);
  addTikTokUtm("utm_medium_tiktok", entry.utmMedium);
  addTikTokUtm("utm_campaign_tiktok", entry.utmCampaign);
  addTikTokUtm("utm_content_tiktok", entry.utmContent);
  addTikTokUtm("utm_term_tiktok", entry.utmTerm);

  const landing = parseUrlSafe(entry.landing);
  if (landing) {
    if (landing.searchParams.get("ttclid")) reasons.add("landing_ttclid");
    for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]) {
      const value = landing.searchParams.get(key) ?? "";
      if (value.toLowerCase().includes("tiktok")) reasons.add(`landing_${key}_tiktok`);
    }
  }

  const referrer = parseUrlSafe(entry.referrer);
  if (referrer && /(^|\.)tiktok\.com$/i.test(referrer.hostname)) reasons.add("referrer_tiktok");

  return [...reasons].sort();
};

export type RemoteLedgerIdentityDiagnostics = {
  total: number;
  filled: number;
  empty: number;
  bySource: {
    vm_native: number;
    imweb_order_lookup: number;
    ga_session_link: number;
    ga_session_synthetic: number;
    empty: number;
  };
};

const CUSTOMER_KEY_SOURCE_META_FIELD = "customer_key_source";

type EnrichedRemoteLedger = {
  entries: AttributionLedgerEntry[];
  warnings: string[];
  identity: RemoteLedgerIdentityDiagnostics;
};

const buildOrderIdToPhoneMap = (orderIds: Set<string>): Map<string, string> => {
  const map = new Map<string, string>();
  if (orderIds.size === 0) return map;
  try {
    const db = getCrmDb();
    const ids = [...orderIds];
    const chunkSize = 500;
    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunk = ids.slice(i, i + chunkSize);
      const placeholders = chunk.map(() => "?").join(",");
      const rows = db
        .prepare(
          `SELECT order_no, orderer_call FROM imweb_orders WHERE order_no IN (${placeholders})`,
        )
        .all(...chunk) as Array<{ order_no: string; orderer_call: string | null }>;
      for (const row of rows) {
        const phone = normalizePhoneDigits(row.orderer_call);
        if (phone) map.set(row.order_no, phone);
      }
    }
  } catch {
    // CRM DB 없거나 imweb_orders 테이블 비어도 단순히 비어 있는 map 반환
  }
  return map;
};

const enrichRemoteLedgerCustomerKeys = (
  entries: AttributionLedgerEntry[],
): { entries: AttributionLedgerEntry[]; identity: RemoteLedgerIdentityDiagnostics } => {
  const orderIds = new Set<string>();
  for (const entry of entries) {
    const trimmed = entry.orderId?.trim();
    if (trimmed) orderIds.add(trimmed);
  }
  const orderIdToPhone = buildOrderIdToPhoneMap(orderIds);

  // 2-pass: 같은 gaSessionId에 속한 entry 중 하나라도 orderId로 phone이 나오면 해당 session 전체에 전파
  const sessionToPhone = new Map<string, string>();
  for (const entry of entries) {
    const session = entry.gaSessionId?.trim();
    if (!session || sessionToPhone.has(session)) continue;
    const phoneFromOrder = entry.orderId ? orderIdToPhone.get(entry.orderId.trim()) : undefined;
    if (phoneFromOrder) sessionToPhone.set(session, phoneFromOrder);
  }

  let fromVm = 0;
  let fromOrder = 0;
  let fromSession = 0;
  let fromGaSynthetic = 0;
  let empty = 0;

  const enriched = entries.map((entry) => {
    const existingKey = entry.customerKey?.trim();
    if (existingKey) {
      fromVm += 1;
      return entry;
    }
    const phoneFromOrder = entry.orderId ? orderIdToPhone.get(entry.orderId.trim()) : undefined;
    if (phoneFromOrder) {
      fromOrder += 1;
      return {
        ...entry,
        customerKey: phoneFromOrder,
        metadata: { ...entry.metadata, [CUSTOMER_KEY_SOURCE_META_FIELD]: "imweb_order_lookup" },
      };
    }
    const phoneFromSession = entry.gaSessionId ? sessionToPhone.get(entry.gaSessionId.trim()) : undefined;
    if (phoneFromSession) {
      fromSession += 1;
      return {
        ...entry,
        customerKey: phoneFromSession,
        metadata: { ...entry.metadata, [CUSTOMER_KEY_SOURCE_META_FIELD]: "ga_session_link" },
      };
    }
    const session = entry.gaSessionId?.trim();
    if (session) {
      fromGaSynthetic += 1;
      return {
        ...entry,
        customerKey: `ga:${session}`,
        metadata: { ...entry.metadata, [CUSTOMER_KEY_SOURCE_META_FIELD]: "ga_session_synthetic" },
      };
    }
    empty += 1;
    return entry;
  });

  const filled = fromVm + fromOrder + fromSession + fromGaSynthetic;
  const identity: RemoteLedgerIdentityDiagnostics = {
    total: entries.length,
    filled,
    empty,
    bySource: {
      vm_native: fromVm,
      imweb_order_lookup: fromOrder,
      ga_session_link: fromSession,
      ga_session_synthetic: fromGaSynthetic,
      empty,
    },
  };
  return { entries: enriched, identity };
};

export const fetchRemoteLedgerEntriesForAcquisition = async (): Promise<EnrichedRemoteLedger> => {
  const entries: AttributionLedgerEntry[] = [];
  const warnings: string[] = [];
  const seen = new Set<string>();

  for (const source of ACQUISITION_REMOTE_LEDGER_SOURCES) {
    try {
      const response = await fetch(buildRemoteLedgerUrl(source), {
        signal: AbortSignal.timeout(ACQUISITION_REMOTE_LEDGER_TIMEOUT_MS),
      });
      const body = await response.json() as unknown;
      const items = isRecord(body) && Array.isArray(body.items) ? body.items : [];
      if (!response.ok || !isRecord(body) || body.ok !== true) {
        warnings.push(`${source} 운영 원장 응답 확인 필요: HTTP ${response.status}`);
        continue;
      }

      for (const item of items) {
        const entry = normalizeRemoteLedgerEntry(item);
        if (!entry) continue;
        const key = buildLedgerDedupeKey(entry);
        if (seen.has(key)) continue;
        seen.add(key);
        entries.push(entry);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      warnings.push(`${source} 운영 원장 조회 실패: ${message}`);
    }
  }

  const { entries: enriched, identity } = enrichRemoteLedgerCustomerKeys(entries);
  return { entries: enriched, warnings, identity };
};

const shouldUseRemoteAcquisitionLedger = (value: unknown) => {
  const dataSource = readOne(value).toLowerCase();
  return ["vm", "remote", "operational", "operation"].includes(dataSource);
};

const resolveAcquisitionCohortLedger = async (value: unknown): Promise<{
  dataSource: "local" | "operational_vm_ledger";
  remoteWarnings: string[];
  ledgerEntries?: AttributionLedgerEntry[];
}> => {
  if (!shouldUseRemoteAcquisitionLedger(value)) {
    return { dataSource: "local", remoteWarnings: [] };
  }

  const remoteLedger = await fetchRemoteLedgerEntriesForAcquisition();
  const remoteWarnings = [...remoteLedger.warnings];
  if (remoteLedger.entries.length === 0) {
    remoteWarnings.push("VM Cloud 원장 row를 가져오지 못해 로컬 원장으로 fallback했다.");
    return { dataSource: "local", remoteWarnings };
  }

  return {
    dataSource: "operational_vm_ledger",
    remoteWarnings,
    ledgerEntries: remoteLedger.entries,
  };
};

const toTossDirectJoinRow = (
  payment: TossPaymentDetail,
  store: TossStore,
): TossJoinRow | undefined => {
  if (!payment.paymentKey && !payment.orderId) return undefined;

  return {
    paymentKey: payment.paymentKey ?? "",
    orderId: payment.orderId ?? "",
    approvedAt: payment.approvedAt ?? "",
    status: payment.status ?? "",
    channel: payment.method ?? "toss_direct_api",
    store,
    totalAmount: Number(payment.totalAmount ?? 0),
    syncSource: "toss_direct_api_fallback",
  };
};

const getNestedString = (value: unknown, key: string) => {
  if (!isRecord(value)) return "";
  const raw = value[key];
  return typeof raw === "string" ? raw.trim() : "";
};

const getDirectTossLookupKeys = (entry: AttributionLedgerEntry) => {
  const referrerPayment = entry.metadata?.referrerPayment;
  const paymentKey = entry.paymentKey || getNestedString(referrerPayment, "paymentKey");
  const referrerOrderId = getNestedString(referrerPayment, "orderId");
  const orderId = referrerOrderId || (paymentKey ? entry.orderId : "");

  if (!paymentKey && !orderId) return undefined;
  return { paymentKey, orderId };
};

const resolveTossStoreForEntry = (
  entry: AttributionLedgerEntry,
  paymentKey?: string,
): TossStore => {
  if (paymentKey) {
    return inferTossStoreFromPaymentKey(paymentKey);
  }

  const metadataStore = typeof entry.metadata?.store === "string" ? entry.metadata.store : "";
  const metadataSource = typeof entry.metadata?.source === "string" ? entry.metadata.source : "";
  const hint = [
    metadataStore,
    metadataSource,
    entry.landing,
    entry.referrer,
    entry.requestContext.origin,
    entry.requestContext.requestReferer,
  ].join(" ").toLowerCase();

  if (hint.includes("coffee") || hint.includes("thecleancoffee")) return "coffee";
  return normalizeTossStore(metadataStore || metadataSource);
};

const fetchTossPaymentDetail = async (
  path: string,
  store: TossStore,
): Promise<TossPaymentDetail> => {
  const auth = getTossBasicAuth(store, "live");
  if (!auth) {
    throw new Error(
      store === "coffee"
        ? "TOSS_LIVE_SECRET_KEY_COFFEE 미설정"
        : "TOSS_LIVE_SECRET_KEY_BIOCOM 미설정",
    );
  }

  const res = await fetch(`${TOSS_BASE_URL}${path}`, {
    headers: { Authorization: auth },
    signal: AbortSignal.timeout(TOSS_DIRECT_FALLBACK_TIMEOUT_MS),
  });
  const text = await res.text();
  let body: unknown = {};
  try {
    body = text ? JSON.parse(text) as unknown : {};
  } catch {
    body = {};
  }

  if (!res.ok) {
    throw new Error(`Toss API ${res.status}: ${text.slice(0, 200)}`);
  }

  return parseTossPaymentDetail(body);
};

const fetchDirectTossRowForEntry = async (
  entry: AttributionLedgerEntry,
): Promise<TossJoinRow | undefined> => {
  const lookup = getDirectTossLookupKeys(entry);
  if (!lookup) return undefined;

  const store = resolveTossStoreForEntry(entry, lookup.paymentKey);
  let paymentKeyError: Error | undefined;

  if (lookup.paymentKey) {
    try {
      return toTossDirectJoinRow(
        await fetchTossPaymentDetail(`/v1/payments/${encodeURIComponent(lookup.paymentKey)}`, store),
        store,
      );
    } catch (error) {
      paymentKeyError = error instanceof Error ? error : new Error(String(error));
    }
  }

  if (lookup.orderId) {
    return toTossDirectJoinRow(
      await fetchTossPaymentDetail(`/v1/payments/orders/${encodeURIComponent(lookup.orderId)}`, store),
      store,
    );
  }

  if (paymentKeyError) throw paymentKeyError;
  return undefined;
};

const fetchDirectTossRowsByPendingEntries = async (
  entries: AttributionLedgerEntry[],
  limit: number,
): Promise<{ rows: TossJoinRow[]; errors: string[] }> => {
  const rows: TossJoinRow[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();

  for (const entry of entries.slice(0, limit)) {
    const lookup = getDirectTossLookupKeys(entry);
    const key = lookup?.paymentKey || lookup?.orderId;
    if (!key || seen.has(key)) continue;
    seen.add(key);

    try {
      const row = await fetchDirectTossRowForEntry(entry);
      if (row) rows.push(row);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${entry.orderId || "-"} / ${entry.paymentKey || "-"}: ${message}`);
    }
  }

  return { rows, errors };
};

const buildTossStatusIndexes = (rows: TossJoinRow[]) => {
  const byPaymentKey = new Map<string, TossJoinRow>();
  const byOrderId = new Map<string, TossJoinRow>();

  for (const row of rows) {
    const normalizedStatus = normalizePaymentStatus(row.status) ?? "pending";
    const currentPaymentKey = row.paymentKey ? byPaymentKey.get(row.paymentKey) : undefined;
    const currentOrderId = row.orderId ? byOrderId.get(row.orderId) : undefined;

    if (row.paymentKey && (!currentPaymentKey || STATUS_RANK[normalizedStatus] > STATUS_RANK[normalizePaymentStatus(currentPaymentKey.status) ?? "pending"])) {
      byPaymentKey.set(row.paymentKey, row);
    }
    if (row.orderId && (!currentOrderId || STATUS_RANK[normalizedStatus] > STATUS_RANK[normalizePaymentStatus(currentOrderId.status) ?? "pending"])) {
      for (const key of [row.orderId, normalizeOrderIdBase(row.orderId)].filter(Boolean)) {
        byOrderId.set(key, row);
      }
    }
  }

  return { byPaymentKey, byOrderId };
};

const betterStatusRow = (left: TossJoinRow | undefined, right: TossJoinRow | undefined) => {
  if (!left) return right;
  if (!right) return left;
  const leftStatus = normalizePaymentStatus(left.status) ?? "pending";
  const rightStatus = normalizePaymentStatus(right.status) ?? "pending";
  return STATUS_RANK[rightStatus] > STATUS_RANK[leftStatus] ? right : left;
};

const matchTypeForRow = (
  row: TossJoinRow | undefined,
  byPaymentKey: TossJoinRow | undefined,
  byOrderId: TossJoinRow | undefined,
): AttributionStatusSyncMatchType => {
  if (!row) return "unmatched";
  if (row === byPaymentKey) {
    return row.syncSource === "toss_direct_api_fallback" ? "direct_payment_key" : "payment_key";
  }
  if (row === byOrderId) {
    if (row.syncSource === "toss_direct_api_fallback") return "direct_order_id";
    if (row.syncSource === "tb_iamweb_users_overdue") return "imweb_overdue_order_id";
    return "order_id";
  }
  return "unmatched";
};

const normalizeDecisionOrderKey = (value: string) => normalizeOrderIdBase(value.trim());

const parsePaymentDecisionLookup = (req: Request): PaymentDecisionLookup => {
  const orderId = readOne(req.query.orderId ?? req.query.order_id);
  const orderNo = readOne(req.query.orderNo ?? req.query.order_no);
  const orderCode = readOne(req.query.orderCode ?? req.query.order_code);
  const paymentCode = readOne(req.query.paymentCode ?? req.query.payment_code);
  const paymentKey = readOne(req.query.paymentKey ?? req.query.payment_key);
  const storeHint = readOne(req.query.store ?? req.query.site);

  return {
    orderId,
    orderNo,
    orderCode,
    paymentCode,
    paymentKey,
    store: normalizeTossStore(storeHint || undefined),
  };
};

const getEntryReferrerPaymentValue = (entry: AttributionLedgerEntry, key: string) => {
  const referrerPayment = entry.metadata?.referrerPayment;
  return readNestedString(referrerPayment, key);
};

const getEntryUrlParam = (entry: AttributionLedgerEntry, key: string) =>
  getQueryParamFromUrl(entry.landing, key) ||
  getQueryParamFromUrl(entry.referrer, key) ||
  getQueryParamFromUrl(entry.requestContext.requestReferer, key);

const getEntryOrderCode = (entry: AttributionLedgerEntry) =>
  getEntryReferrerPaymentValue(entry, "orderCode") ||
  getEntryReferrerPaymentValue(entry, "order_code") ||
  getEntryUrlParam(entry, "order_code") ||
  getEntryUrlParam(entry, "orderCode");

const getEntryPaymentCode = (entry: AttributionLedgerEntry) =>
  getEntryReferrerPaymentValue(entry, "paymentCode") ||
  getEntryReferrerPaymentValue(entry, "payment_code") ||
  getEntryUrlParam(entry, "payment_code") ||
  getEntryUrlParam(entry, "paymentCode");

const findLedgerDecisionMatch = (
  entries: AttributionLedgerEntry[],
  lookup: PaymentDecisionLookup,
): { entry: AttributionLedgerEntry; matchedBy: PaymentDecisionMatchType } | undefined => {
  const paymentEntries = entries.filter((entry) => entry.touchpoint === "payment_success");
  const lookupOrderKeys = [
    lookup.orderId,
    lookup.orderNo,
  ].map(normalizeDecisionOrderKey).filter(Boolean);

  if (lookup.paymentKey) {
    const entry = paymentEntries.find((candidate) => candidate.paymentKey === lookup.paymentKey);
    if (entry) return { entry, matchedBy: "ledger_payment_key" };
  }

  if (lookupOrderKeys.length > 0) {
    const entry = paymentEntries.find((candidate) => {
      const candidateKeys = [
        candidate.orderId,
        getEntryReferrerPaymentValue(candidate, "orderId"),
        getEntryReferrerPaymentValue(candidate, "orderNo"),
        getEntryUrlParam(candidate, "order_id"),
        getEntryUrlParam(candidate, "orderId"),
        getEntryUrlParam(candidate, "order_no"),
        getEntryUrlParam(candidate, "orderNo"),
      ].map(normalizeDecisionOrderKey).filter(Boolean);
      return candidateKeys.some((key) => lookupOrderKeys.includes(key));
    });
    if (entry) return { entry, matchedBy: "ledger_order_id" };
  }

  if (lookup.orderCode) {
    const entry = paymentEntries.find((candidate) => getEntryOrderCode(candidate) === lookup.orderCode);
    if (entry) return { entry, matchedBy: "ledger_order_code" };
  }

  if (lookup.paymentCode) {
    const entry = paymentEntries.find((candidate) => getEntryPaymentCode(candidate) === lookup.paymentCode);
    if (entry) return { entry, matchedBy: "ledger_payment_code" };
  }

  return undefined;
};

const getPaymentDecisionFastLedgerEntries = (lookup: PaymentDecisionLookup) => {
  const orderKeys = [
    lookup.orderId,
    lookup.orderNo,
    normalizeDecisionOrderKey(lookup.orderId),
    normalizeDecisionOrderKey(lookup.orderNo),
  ].filter(Boolean);

  return listAttributionLedgerPaymentDecisionCandidates({
    paymentKeys: [lookup.paymentKey],
    orderKeys,
    orderCodes: [lookup.orderCode],
    paymentCodes: [lookup.paymentCode],
    limit: 20,
  });
};

const metadataNumberValue = (metadata: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const parsed = Number(value.replace(/,/g, "").trim());
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
};

const metadataBooleanValue = (metadata: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (["1", "true", "yes", "y"].includes(normalized)) return true;
      if (["0", "false", "no", "n"].includes(normalized)) return false;
    }
  }
  return undefined;
};

const getLedgerEntryAmountKrw = (entry: AttributionLedgerEntry) =>
  metadataNumberValue(entry.metadata ?? {}, [
    "value",
    "amount",
    "totalAmount",
    "confirmedAmountKrw",
    "confirmed_amount_krw",
  ]);

const ledgerEntryHasCancelOrRefundSignal = (entry: AttributionLedgerEntry) => {
  if (entry.paymentStatus === "canceled") return true;
  const metadata = entry.metadata ?? {};
  const cancelFlag = metadataBooleanValue(metadata, ["hasCancel", "has_cancel", "canceled", "cancelled", "refunded"]);
  if (cancelFlag === true) return true;
  const refundAmount = metadataNumberValue(metadata, [
    "refundAmount",
    "refund_amount",
    "refundPendingAmount",
    "refund_pending_amount",
  ]);
  return typeof refundAmount === "number" && refundAmount > 0;
};

export const buildFastLedgerPaymentDecision = (
  entries: AttributionLedgerEntry[],
  lookup: PaymentDecisionLookup,
): AttributionPaymentDecision | undefined => {
  const ledgerMatch = findLedgerDecisionMatch(entries, lookup);
  if (!ledgerMatch) return undefined;

  const { entry, matchedBy } = ledgerMatch;
  if (ledgerEntryHasCancelOrRefundSignal(entry)) {
    return decisionFromStatus("canceled", {
      matchedBy,
      confidence: "high",
      reason: "fast_ledger_cancel_or_refund",
      notes: ["VM Cloud SQLite 보조 원장 exact match에서 취소/환불 신호가 있어 Purchase를 차단했다."],
      matched: {
        source: "attribution_ledger",
        orderId: entry.orderId,
        paymentKey: entry.paymentKey,
        status: entry.paymentStatus ?? "",
        approvedAt: entry.approvedAt,
        channel: typeof entry.metadata?.channel === "string" ? entry.metadata.channel : "",
        store: typeof entry.metadata?.store === "string" ? entry.metadata.store : "",
        loggedAt: entry.loggedAt,
        captureMode: entry.captureMode,
      },
    });
  }

  if (entry.paymentStatus === "pending") {
    return decisionFromStatus("pending", {
      matchedBy,
      confidence: "high",
      reason: "fast_ledger_pending_status",
      notes: ["VM Cloud SQLite 보조 원장 exact match가 pending이라 Browser Purchase를 차단했다."],
      matched: {
        source: "attribution_ledger",
        orderId: entry.orderId,
        paymentKey: entry.paymentKey,
        status: entry.paymentStatus,
        approvedAt: entry.approvedAt,
        channel: typeof entry.metadata?.channel === "string" ? entry.metadata.channel : "",
        store: typeof entry.metadata?.store === "string" ? entry.metadata.store : "",
        loggedAt: entry.loggedAt,
        captureMode: entry.captureMode,
      },
    });
  }

  if (entry.paymentStatus !== "confirmed") return undefined;

  const amountKrw = getLedgerEntryAmountKrw(entry);
  if (typeof amountKrw !== "number" || amountKrw <= 0) return undefined;

  return decisionFromStatus("confirmed", {
    matchedBy,
    confidence: "high",
    reason: "fast_ledger_confirmed_positive_exact_match",
    notes: [
      "VM Cloud SQLite 보조 원장에서 payment_success confirmed, 양수 금액, 취소/환불 없음 exact match를 먼저 찾았다.",
      "운영DB sync 지연과 Toss API 지연을 기다리지 않고 Browser Purchase 허용 판단을 반환한다.",
    ],
    matched: {
      source: "attribution_ledger",
      orderId: entry.orderId,
      paymentKey: entry.paymentKey,
      status: entry.paymentStatus,
      approvedAt: entry.approvedAt,
      channel: typeof entry.metadata?.channel === "string" ? entry.metadata.channel : "",
      store: typeof entry.metadata?.store === "string" ? entry.metadata.store : "",
      loggedAt: entry.loggedAt,
      captureMode: entry.captureMode,
    },
  });
};

const findTossDecisionMatch = (
  rows: TossJoinRow[],
  lookup: PaymentDecisionLookup,
): { row: TossJoinRow; matchedBy: PaymentDecisionMatchType } | undefined => {
  if (lookup.paymentKey) {
    const row = rows.find((candidate) => candidate.paymentKey === lookup.paymentKey);
    if (row) return { row, matchedBy: "toss_direct_payment_key" };
  }

  const lookupOrderKeys = [
    lookup.orderId,
    lookup.orderNo,
  ].map(normalizeDecisionOrderKey).filter(Boolean);
  if (lookupOrderKeys.length === 0) return undefined;

  const row = rows.find((candidate) => lookupOrderKeys.includes(normalizeDecisionOrderKey(candidate.orderId)));
  return row ? { row, matchedBy: "toss_direct_order_id" } : undefined;
};

const getPaymentDecisionLookupKeys = (lookup: PaymentDecisionLookup) =>
  Array.from(
    new Set(
      [
        lookup.orderId,
        lookup.orderNo,
        lookup.orderCode,
        lookup.paymentCode,
      ]
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  );

const fetchOperationalPaymentDecisionRows = async (
  lookup: PaymentDecisionLookup,
): Promise<OperationalPaymentCompleteBridgeRow[]> => {
  if (!isDatabaseConfigured()) return [];

  const orderKeys = getPaymentDecisionLookupKeys(lookup);
  if (orderKeys.length === 0) return [];

  const result = await queryPg<{
    orderNumber: string | null;
    channelOrderNo: string | null;
    paymentStatus: string | null;
    paymentMethod: string | null;
    paidAt: string | null;
    orderAmount: string | number | null;
    refundAmount: string | number | null;
    refundPendingAmount: string | number | null;
    hasCancel: boolean | null;
    hasReturn: boolean | null;
    isNpay: boolean | null;
  }>(
    `
    WITH raw AS (
      SELECT
        COALESCE(NULLIF(TRIM(order_number::text), ''), '') AS order_number,
        COALESCE(NULLIF(TRIM(raw_data ->> 'channelOrderNo'), ''), '') AS channel_order_no,
        COALESCE(NULLIF(TRIM(payment_status::text), ''), '') AS payment_status,
        COALESCE(NULLIF(TRIM(payment_method::text), ''), '') AS payment_method,
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
        COALESCE(NULLIF(total_refunded_price, 0), 0)::numeric AS refund_amount,
        COALESCE(NULLIF(cancellation_reason::text, ''), '') AS cancellation_reason,
        COALESCE(NULLIF(return_reason::text, ''), '') AS return_reason
      FROM public.tb_iamweb_users
      WHERE COALESCE(NULLIF(TRIM(order_number::text), ''), '') = ANY($1::text[])
        OR COALESCE(NULLIF(TRIM(raw_data ->> 'channelOrderNo'), ''), '') = ANY($1::text[])
        OR COALESCE(NULLIF(TRIM(raw_data ->> 'orderNo'), ''), '') = ANY($1::text[])
        OR COALESCE(NULLIF(TRIM(raw_data ->> 'orderCode'), ''), '') = ANY($1::text[])
        OR COALESCE(NULLIF(TRIM(raw_data ->> 'order_code'), ''), '') = ANY($1::text[])
        OR COALESCE(NULLIF(TRIM(raw_data ->> 'paymentCode'), ''), '') = ANY($1::text[])
        OR COALESCE(NULLIF(TRIM(raw_data ->> 'payment_code'), ''), '') = ANY($1::text[])
    ),
    order_level AS (
      SELECT
        order_number AS "orderNumber",
        MAX(channel_order_no) AS "channelOrderNo",
        MAX(payment_status) AS "paymentStatus",
        MAX(payment_method) AS "paymentMethod",
        MIN(paid_at)::text AS "paidAt",
        COALESCE(MAX(final_order_amount), SUM(COALESCE(paid_price, total_price, 0)), MAX(total_price), 0)::numeric AS "orderAmount",
        COALESCE(MAX(refund_amount), 0)::numeric AS "refundAmount",
        0::numeric AS "refundPendingAmount",
        BOOL_OR(NOT (LOWER(cancellation_reason) IN ('', 'nan', 'null', 'undefined'))) AS "hasCancel",
        BOOL_OR(NOT (LOWER(return_reason) IN ('', 'nan', 'null', 'undefined'))) AS "hasReturn",
        BOOL_OR(payment_method ~* '(naver|npay)' OR payment_method LIKE '%네이버%' OR channel_order_no <> '') AS "isNpay"
      FROM raw
      WHERE order_number <> ''
      GROUP BY order_number
    )
    SELECT *
    FROM order_level
    ORDER BY
      CASE
        WHEN UPPER(COALESCE("paymentStatus", '')) = 'PAYMENT_COMPLETE' THEN 3
        WHEN UPPER(COALESCE("paymentStatus", '')) LIKE '%COMPLETE%' THEN 3
        WHEN UPPER(COALESCE("paymentStatus", '')) LIKE '%CANCEL%' THEN 2
        ELSE 1
      END DESC,
      "paidAt" DESC NULLS LAST
    LIMIT 20
    `,
    [orderKeys],
  );

  return result.rows.map((row) => ({
    orderNumber: row.orderNumber ?? "",
    channelOrderNo: row.channelOrderNo ?? "",
    paymentStatus: row.paymentStatus ?? "",
    paymentMethod: row.paymentMethod ?? "",
    paidAt: row.paidAt ?? "",
    orderAmount: normalizeBridgeNumber(row.orderAmount),
    refundAmount: normalizeBridgeNumber(row.refundAmount),
    refundPendingAmount: normalizeBridgeNumber(row.refundPendingAmount),
    hasCancel: Boolean(row.hasCancel),
    hasReturn: Boolean(row.hasReturn),
    isNpay: Boolean(row.isNpay),
  }));
};

const findOperationalPaymentDecisionMatch = (
  rows: OperationalPaymentCompleteBridgeRow[],
  lookup: PaymentDecisionLookup,
): { row: OperationalPaymentCompleteBridgeRow; matchedBy: PaymentDecisionMatchType } | undefined => {
  const lookupKeys = getPaymentDecisionLookupKeys(lookup);
  if (lookupKeys.length === 0) return undefined;

  const orderNumberMatch = rows.find((row) => lookupKeys.includes(row.orderNumber));
  if (orderNumberMatch) return { row: orderNumberMatch, matchedBy: "operational_db_order_number" };

  const channelOrderNoMatch = rows.find((row) => row.channelOrderNo && lookupKeys.includes(row.channelOrderNo));
  if (channelOrderNoMatch) return { row: channelOrderNoMatch, matchedBy: "operational_db_channel_order_no" };

  return undefined;
};

const isOperationalVirtualOrBankPendingHint = (row: OperationalPaymentCompleteBridgeRow) => {
  const status = row.paymentStatus.trim().toUpperCase();
  const method = row.paymentMethod.trim().toUpperCase();
  return (
    status.includes("WAIT") ||
    status.includes("READY") ||
    status.includes("PENDING") ||
    status.includes("DEPOSIT") ||
    method.includes("VIRTUAL") ||
    method.includes("BANK") ||
    row.paymentMethod.includes("무통장") ||
    row.paymentMethod.includes("가상")
  );
};

const decisionStatusFromOperationalRow = (row: OperationalPaymentCompleteBridgeRow) => {
  const normalized = normalizePaymentStatus(row.paymentStatus) ?? "unknown";
  const amountKrw = Math.round(row.orderAmount);

  if (row.hasCancel || row.hasReturn || row.refundAmount > 0 || row.refundPendingAmount > 0) {
    return {
      status: "canceled" as const,
      reason: "operational_db_cancel_or_refund",
      notes: ["운영DB 결제 row에 취소/환불 신호가 있어 Browser Purchase를 차단했다."],
    };
  }

  if (normalized === "confirmed" && amountKrw > 0) {
    return {
      status: "confirmed" as const,
      reason: "operational_db_payment_complete",
      notes: ["운영DB PAYMENT_COMPLETE, 양수 금액, 취소/환불 없음 조건을 통과했다."],
    };
  }

  if (normalized === "confirmed" && amountKrw <= 0) {
    return {
      status: "canceled" as const,
      reason: "operational_db_non_positive_amount",
      notes: ["운영DB는 결제완료지만 금액이 0원 이하라 Purchase 발화를 차단했다."],
    };
  }

  if (normalized === "pending") {
    return {
      status: "pending" as const,
      reason: "operational_db_payment_pending",
      notes: ["운영DB에서 아직 결제완료가 아니므로 Purchase 대신 보류/차단한다."],
    };
  }

  if (isOperationalVirtualOrBankPendingHint(row)) {
    return {
      status: "pending" as const,
      reason: "operational_db_virtual_or_bank_not_complete",
      notes: ["운영DB에서 가상계좌/무통장 계열 결제완료가 확인되지 않아 Purchase를 차단했다."],
    };
  }

  return {
    status: "unknown" as const,
    reason: "operational_db_status_unknown",
    notes: ["운영DB row는 찾았지만 결제완료/대기/취소 중 하나로 안전하게 분류되지 않았다."],
  };
};

const decisionFromStatus = (
  status: AttributionPaymentStatus | "unknown",
  params: {
    matchedBy: PaymentDecisionMatchType;
    confidence: AttributionPaymentDecision["confidence"];
    reason: string;
    notes?: string[];
    matched?: AttributionPaymentDecision["matched"];
  },
): AttributionPaymentDecision => {
  if (status === "confirmed") {
    return {
      status,
      browserAction: "allow_purchase",
      confidence: params.confidence,
      matchedBy: params.matchedBy,
      reason: params.reason,
      notes: params.notes ?? [],
      matched: params.matched,
    };
  }

  if (status === "pending") {
    return {
      status,
      browserAction: "block_purchase_virtual_account",
      confidence: params.confidence,
      matchedBy: params.matchedBy,
      reason: params.reason,
      notes: params.notes ?? [],
      matched: params.matched,
    };
  }

  if (status === "canceled") {
    return {
      status,
      browserAction: "block_purchase",
      confidence: params.confidence,
      matchedBy: params.matchedBy,
      reason: params.reason,
      notes: params.notes ?? [],
      matched: params.matched,
    };
  }

  return {
    status: "unknown",
    browserAction: "hold_or_block_purchase",
    confidence: params.confidence,
    matchedBy: params.matchedBy,
    reason: params.reason,
    notes: params.notes ?? [
      "unknown은 confirmed가 아니므로 Meta Browser Purchase를 바로 보내지 않는 정책이 데이터 정합성에는 더 안전하다.",
      "단, 서버 endpoint 장애가 길어지면 카드 매출 Browser Purchase가 누락될 수 있으므로 운영 배포 전 안정성 검증이 필요하다.",
    ],
    matched: params.matched,
  };
};

export const buildAttributionPaymentDecision = (
  entries: AttributionLedgerEntry[],
  lookup: PaymentDecisionLookup,
  tossRows: TossJoinRow[] = [],
  operationalRows: OperationalPaymentCompleteBridgeRow[] = [],
): AttributionPaymentDecision => {
  const operationalMatch = findOperationalPaymentDecisionMatch(operationalRows, lookup);
  if (operationalMatch) {
    const statusDecision = decisionStatusFromOperationalRow(operationalMatch.row);
    return decisionFromStatus(statusDecision.status, {
      matchedBy: operationalMatch.matchedBy,
      confidence: statusDecision.status === "unknown" ? "medium" : "high",
      reason: statusDecision.reason,
      notes: statusDecision.notes,
      matched: {
        source: "operational_db_tb_iamweb_users",
        orderId: operationalMatch.row.orderNumber,
        paymentKey: "",
        status: operationalMatch.row.paymentStatus,
        approvedAt: operationalMatch.row.paidAt,
        channel: operationalMatch.row.paymentMethod,
        store: "biocom",
      },
    });
  }

  const tossMatch = findTossDecisionMatch(tossRows, lookup);
  if (tossMatch) {
    const status = normalizePaymentStatus(tossMatch.row.status) ?? "unknown";
    return decisionFromStatus(status, {
      matchedBy: tossMatch.matchedBy,
      confidence: status === "unknown" ? "medium" : "high",
      reason: "toss_direct_api_status",
      matched: {
        source: "toss_direct_api",
        orderId: tossMatch.row.orderId,
        paymentKey: tossMatch.row.paymentKey,
        status: tossMatch.row.status,
        approvedAt: tossMatch.row.approvedAt,
        channel: tossMatch.row.channel,
        store: tossMatch.row.store,
      },
    });
  }

  const ledgerMatch = findLedgerDecisionMatch(entries, lookup);
  if (ledgerMatch) {
    const status = ledgerMatch.entry.paymentStatus ?? "unknown";
    return decisionFromStatus(status, {
      matchedBy: ledgerMatch.matchedBy,
      confidence: status === "unknown" ? "medium" : "high",
      reason: "attribution_ledger_status",
      matched: {
        source: "attribution_ledger",
        orderId: ledgerMatch.entry.orderId,
        paymentKey: ledgerMatch.entry.paymentKey,
        status: ledgerMatch.entry.paymentStatus ?? "",
        approvedAt: ledgerMatch.entry.approvedAt,
        channel: typeof ledgerMatch.entry.metadata?.channel === "string" ? ledgerMatch.entry.metadata.channel : "",
        store: typeof ledgerMatch.entry.metadata?.store === "string" ? ledgerMatch.entry.metadata.store : "",
        loggedAt: ledgerMatch.entry.loggedAt,
        captureMode: ledgerMatch.entry.captureMode,
      },
    });
  }

  return decisionFromStatus("unknown", {
    matchedBy: "none",
    confidence: "low",
    reason: "no_toss_or_ledger_match",
  });
};

const fetchTossDecisionRows = async (
  lookup: PaymentDecisionLookup,
): Promise<{ rows: TossJoinRow[]; errors: string[]; attempted: boolean }> => {
  const rows: TossJoinRow[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();
  const store = lookup.paymentKey
    ? inferTossStoreFromPaymentKey(lookup.paymentKey, lookup.store)
    : lookup.store;

  const addRow = (row: TossJoinRow | undefined) => {
    if (!row) return;
    const key = `${row.paymentKey || "-"}|${normalizeDecisionOrderKey(row.orderId) || "-"}`;
    if (seen.has(key)) return;
    seen.add(key);
    rows.push(row);
  };

  if (lookup.paymentKey) {
    try {
      addRow(toTossDirectJoinRow(
        await fetchTossPaymentDetail(`/v1/payments/${encodeURIComponent(lookup.paymentKey)}`, store),
        store,
      ));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`paymentKey ${lookup.paymentKey}: ${message}`);
    }
  }

  const orderLookup = lookup.orderId || lookup.orderNo;
  if (orderLookup) {
    const orderCandidates = orderLookup.endsWith("-P1")
      ? [orderLookup]
      : [orderLookup, `${orderLookup}-P1`];
    let matched = false;
    for (const candidate of orderCandidates) {
      try {
        const row = toTossDirectJoinRow(
          await fetchTossPaymentDetail(`/v1/payments/orders/${encodeURIComponent(candidate)}`, store),
          store,
        );
        if (row) {
          addRow(row);
          matched = true;
          break;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push(`orderId ${candidate}: ${message}`);
        if (!/NOT_FOUND_PAYMENT|Toss API 404/.test(message)) break;
      }
    }
    void matched;
  }

  return {
    rows,
    errors,
    attempted: Boolean(lookup.paymentKey || orderLookup),
  };
};

const buildSyncedLedgerEntry = (
  entry: AttributionLedgerEntry,
  row: TossJoinRow,
  nextStatus: AttributionPaymentStatus,
  syncedAt: string,
): AttributionLedgerEntry => {
  const paymentStatusSyncSource = row.syncSource ?? "tb_sales_toss";

  return {
    ...entry,
    paymentStatus: nextStatus,
    approvedAt: row.approvedAt ? normalizeApprovedAtToIso(row.approvedAt, entry.approvedAt || entry.loggedAt) : entry.approvedAt,
    metadata: {
      ...entry.metadata,
      paymentStatus: nextStatus,
      status: row.status || entry.metadata?.status,
      channel: row.channel || entry.metadata?.channel,
      store: row.store || entry.metadata?.store,
      totalAmount: row.totalAmount > 0 ? row.totalAmount : entry.metadata?.totalAmount,
      paymentStatusSyncSource,
      tossSyncSource: paymentStatusSyncSource,
      tossSyncedAt: syncedAt,
      ...(paymentStatusSyncSource === "toss_direct_api_fallback" ? { tossDirectFallbackAt: syncedAt } : {}),
      ...(paymentStatusSyncSource === "tb_iamweb_users_overdue"
        ? {
            fate: "vbank_expired",
            vbankExpired: true,
            imwebPaymentMethod: row.imwebPaymentMethod,
            imwebPaymentStatus: row.imwebPaymentStatus,
            imwebCancellationReason: row.imwebCancellationReason,
            imwebOrderDate: row.imwebOrderDate,
            imwebOverdueSyncedAt: syncedAt,
          }
        : {}),
    },
  };
};

export const syncAttributionPaymentStatusesFromToss = async (params?: {
  limit?: number;
  dryRun?: boolean;
  orderIds?: string[];
}): Promise<AttributionStatusSyncResult> => {
  const dryRun = params?.dryRun ?? false;
  const limit = Math.max(1, Math.min(params?.limit ?? 100, 500));
  const orderIdFilter = new Set(
    (params?.orderIds ?? [])
      .flatMap((orderId) => [orderId, normalizeOrderIdBase(orderId)])
      .map((orderId) => orderId.trim())
      .filter(Boolean),
  );
  const entries = await readLedgerEntries();
  const pendingCandidates = entries
    .filter((entry) => entry.touchpoint === "payment_success" && entry.paymentStatus === "pending")
    .filter((entry) => {
      if (orderIdFilter.size === 0) return true;
      const keys = [entry.orderId, normalizeOrderIdBase(entry.orderId)].map((orderId) => orderId.trim());
      return keys.some((orderId) => orderIdFilter.has(orderId));
    })
    .slice(0, limit);
  const tossRows = await fetchTossRowsByPendingEntries(pendingCandidates, limit);
  const tossIndex = buildTossStatusIndexes(tossRows);
  const directFallbackCandidates = pendingCandidates.filter((entry) => {
    const matchedByPaymentKey = entry.paymentKey ? tossIndex.byPaymentKey.get(entry.paymentKey) : undefined;
    const matchedByOrderId = !matchedByPaymentKey && entry.orderId ? tossIndex.byOrderId.get(entry.orderId) : undefined;
    return !matchedByPaymentKey && !matchedByOrderId && (entry.paymentKey || entry.orderId);
  });
  const directFallback = await fetchDirectTossRowsByPendingEntries(directFallbackCandidates, limit);
  const imwebOverdueRows = await fetchImwebOverdueRowsByPendingEntries(pendingCandidates, limit);
  const plan = buildAttributionPaymentStatusSyncPlan(
    pendingCandidates,
    [...tossRows, ...directFallback.rows, ...imwebOverdueRows],
    limit,
  );
  const writtenRows = dryRun ? 0 : updateAttributionLedgerEntries(plan.updates);

  return {
    ok: true,
    dryRun,
    totalCandidates: plan.totalCandidates,
    matchedRows: plan.matchedRows,
    updatedRows: plan.updatedRows,
    writtenRows,
    skippedNoMatchRows: plan.skippedNoMatchRows,
    skippedPendingRows: plan.skippedPendingRows,
    directFallbackRows: directFallback.rows.length,
    imwebOverdueRows: imwebOverdueRows.length,
    directFallbackErrors: directFallback.errors,
    items: plan.items,
  };
};

export const buildAttributionPaymentStatusSyncPlan = (
  entries: AttributionLedgerEntry[],
  tossRows: TossJoinRow[],
  limit = 100,
  syncedAt = new Date().toISOString(),
): AttributionStatusSyncPlan => {
  const candidates = entries
    .filter((entry) => entry.touchpoint === "payment_success" && entry.paymentStatus === "pending")
    .slice(0, Math.max(1, Math.min(limit, 500)));
  const tossIndex = buildTossStatusIndexes(tossRows);
  const items: AttributionStatusSyncItem[] = [];
  const updates: Array<{ previousEntry: AttributionLedgerEntry; nextEntry: AttributionLedgerEntry }> = [];
  let matchedRows = 0;
  let skippedNoMatchRows = 0;
  let skippedPendingRows = 0;

  for (const entry of candidates) {
    const previousStatus = entry.paymentStatus ?? "pending";
    const matchedByPaymentKey = entry.paymentKey ? tossIndex.byPaymentKey.get(entry.paymentKey) : undefined;
    const matchedByExactOrderId = entry.orderId ? tossIndex.byOrderId.get(entry.orderId) : undefined;
    const matchedByBaseOrderId = entry.orderId ? tossIndex.byOrderId.get(normalizeOrderIdBase(entry.orderId)) : undefined;
    const matchedByOrderId = betterStatusRow(matchedByExactOrderId, matchedByBaseOrderId);
    const matched = betterStatusRow(matchedByPaymentKey, matchedByOrderId);
    const matchType = matchTypeForRow(matched, matchedByPaymentKey, matchedByOrderId);

    if (!matched) {
      skippedNoMatchRows += 1;
      items.push({
        orderId: entry.orderId,
        paymentKey: entry.paymentKey,
        previousStatus,
        nextStatus: null,
        matchType,
        action: "skipped",
        reason: "toss row not found",
      });
      continue;
    }

    matchedRows += 1;
    const nextStatus = normalizePaymentStatus(matched.status) ?? "pending";
    if (nextStatus === "pending") {
      skippedPendingRows += 1;
      items.push({
        orderId: entry.orderId,
        paymentKey: entry.paymentKey,
        previousStatus,
        nextStatus,
        matchType,
        action: "skipped",
        reason: "toss status still pending",
        approvedAt: matched.approvedAt,
      });
      continue;
    }

    const nextEntry = buildSyncedLedgerEntry(entry, matched, nextStatus, syncedAt);
    updates.push({ previousEntry: entry, nextEntry });
    items.push({
      orderId: entry.orderId,
      paymentKey: entry.paymentKey,
      previousStatus,
      nextStatus,
      matchType,
      action: "updated",
      approvedAt: nextEntry.approvedAt,
    });
  }

  return {
    totalCandidates: candidates.length,
    matchedRows,
    updatedRows: updates.length,
    skippedNoMatchRows,
    skippedPendingRows,
    items,
    updates,
  };
};

const fetchTossHourlyRows = async (date: string) => {
  if (!isDatabaseConfigured()) {
    return [];
  }

  const result = await queryPg<{
    dateHour: string | null;
    approvalCount: number | null;
    totalAmount: number | null;
  }>(
    `
      SELECT
        SUBSTRING(approved_at, 1, 13) || ':00' AS "dateHour",
        COUNT(*)::int AS "approvalCount",
        COALESCE(SUM(total_amount), 0)::float AS "totalAmount"
      FROM tb_sales_toss
      WHERE approved_at IS NOT NULL
        AND approved_at <> ''
        AND SUBSTRING(approved_at, 1, 10) = $1
      GROUP BY SUBSTRING(approved_at, 1, 13)
      ORDER BY SUBSTRING(approved_at, 1, 13) ASC
    `,
    [date],
  );

  return result.rows.map((row) => ({
    dateHour: row.dateHour ?? `${date} 00:00`,
    approvalCount: Number(row.approvalCount ?? 0),
    totalAmount: Number(row.totalAmount ?? 0),
  }));
};

// sendBeacon은 text/plain으로 보내므로 JSON 파싱 필요
const parseBody = (body: unknown): Record<string, unknown> => {
  if (typeof body === "string") {
    try { return JSON.parse(body); } catch { return {}; }
  }
  return (body as Record<string, unknown>) ?? {};
};

/**
 * Origin ↔ source 정합성 가드 (2026-04-15 신설)
 *
 * 배경: 2026-04-14 biocom footer 가 coffee 라벨 템플릿으로 교체되어 biocom.kr
 * 에서 발생한 이벤트 276건이 source='thecleancoffee_imweb' 로 오염되는 사건
 * 이 발생. 아래 매핑은 origin 별 정답 source 를 강제하여 향후 footer 에서 또
 * 다른 라벨 오염이 생기면 서버에서 즉시 auto-correct + warn log 남김.
 *
 * 정책: 화이트리스트에 있는 origin 이면 source 를 해당 매핑으로 덮어쓴다.
 * 화이트리스트에 없는 origin (CRON, curl test, localhost 등) 은 그대로 통과.
 */
const ORIGIN_SOURCE_MAP: Record<string, string> = {
  "https://biocom.kr": "biocom_imweb",
  "https://www.biocom.kr": "biocom_imweb",
  "https://m.biocom.kr": "biocom_imweb",
  "https://biocom.imweb.me": "biocom_imweb",
  "https://thecleancoffee.com": "thecleancoffee_imweb",
  "https://www.thecleancoffee.com": "thecleancoffee_imweb",
  "https://thecleancoffee.imweb.me": "thecleancoffee_imweb",
  "https://aibio.ai": "aibio_imweb",
  "https://www.aibio.ai": "aibio_imweb",
};

type OriginSourceGuardResult =
  | { status: "clean"; expected: string; received: string }
  | { status: "corrected"; expected: string; received: string }
  | { status: "unknown_origin"; received: string }
  | { status: "no_source_field"; received: "" };

const enforceOriginSourceMatch = (
  req: Request,
  body: Record<string, unknown>,
  touchpoint: string,
): OriginSourceGuardResult => {
  const originRaw = typeof req.headers.origin === "string" ? req.headers.origin : "";
  const originKey = originRaw.replace(/\/$/, "").toLowerCase();
  const expected = ORIGIN_SOURCE_MAP[originKey];
  const receivedRaw = typeof body.source === "string" ? body.source.trim() : "";

  if (!expected) {
    return { status: "unknown_origin", received: receivedRaw };
  }

  if (!receivedRaw) {
    // body.source 가 비어 있으면 origin 기준으로 채워 넣는다.
    body.source = expected;
    if (body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata)) {
      (body.metadata as Record<string, unknown>).source = expected;
    }
    // eslint-disable-next-line no-console
    console.warn(
      `[attribution-origin-guard] source 미지정 → origin 기반 자동 설정: ` +
        `touchpoint=${touchpoint} origin=${originRaw} expected=${expected}`,
    );
    return { status: "corrected", expected, received: "" };
  }

  if (receivedRaw === expected) {
    return { status: "clean", expected, received: receivedRaw };
  }

  // Mismatch detected — auto-correct
  body.source = expected;
  if (body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata)) {
    (body.metadata as Record<string, unknown>).source = expected;
  }
  // eslint-disable-next-line no-console
  console.warn(
    `[attribution-origin-guard] source 불일치 자동 보정: ` +
      `touchpoint=${touchpoint} origin=${originRaw} received="${receivedRaw}" → "${expected}"`,
  );
  return { status: "corrected", expected, received: receivedRaw };
};

const resolveOriginSiteSource = (req: Request) => {
  const originRaw = typeof req.headers.origin === "string" ? req.headers.origin : "";
  const originKey = originRaw.replace(/\/$/, "").toLowerCase();
  return ORIGIN_SOURCE_MAP[originKey] ?? "";
};

const PAYMENT_SUCCESS_COMPLETION_URL_PATTERN =
  /shop_payment_complete|shop_order_done|order_complete|payment_complete|payment_success/i;
const SHOP_PAYMENT_PROGRESS_URL_PATTERN = /(^|\/)shop_payment(?:\/|\?|$)/i;

const metadataRecord = (body: Record<string, unknown>) =>
  isRecord(body.metadata) ? body.metadata as Record<string, unknown> : {};

const bodyUrlEvidence = (body: Record<string, unknown>, req?: Request) => {
  const metadata = metadataRecord(body);
  return [
    body.landing,
    body.landingPath,
    body.landing_path,
    body.currentUrl,
    body.current_url,
    body.pageLocation,
    body.page_location,
    body.referrer,
    body.referer,
    metadata.paymentUrl,
    metadata.checkoutUrl,
    metadata.imweb_landing_url,
    metadata.page_location,
    metadata.pageLocation,
    req?.headers.referer,
  ].map(readText).filter(Boolean);
};

const hasPaymentSuccessCompletionUrl = (body: Record<string, unknown>, req?: Request) =>
  bodyUrlEvidence(body, req).some((value) => PAYMENT_SUCCESS_COMPLETION_URL_PATTERN.test(value));

const hasShopPaymentProgressUrl = (body: Record<string, unknown>, req?: Request) =>
  bodyUrlEvidence(body, req).some((value) => SHOP_PAYMENT_PROGRESS_URL_PATTERN.test(value));

export const isPaymentPageSeenPayload = (body: Record<string, unknown>) => {
  const metadata = metadataRecord(body);
  return (
    readText(body.touchpoint) === "payment_page_seen" ||
    readText(metadata.semantic_touchpoint) === "payment_page_seen" ||
    readText(metadata.page_location_class) === "shop_payment"
  );
};

export const getPaymentSuccessDowngradeReason = (body: Record<string, unknown>, req?: Request) => {
  const metadata = metadataRecord(body);
  if (isPaymentPageSeenPayload(body)) return "semantic_payment_page_seen";
  if (hasShopPaymentProgressUrl(body, req) && !hasPaymentSuccessCompletionUrl(body, req)) {
    return "shop_payment_progress_url_without_completion_signal";
  }
  if (
    (metadata.meta_purchase_candidate === false || metadata.is_purchase_candidate === false) &&
    !hasPaymentSuccessCompletionUrl(body, req)
  ) {
    return "explicit_non_purchase_candidate_without_completion_signal";
  }
  return "";
};

const markPaymentPageSeenGuardMetadata = (body: Record<string, unknown>, reason: string) => {
  const existing = metadataRecord(body);
  body.metadata = {
    ...existing,
    semantic_touchpoint: "payment_page_seen",
    downgraded_from_touchpoint: "payment_success",
    downgrade_reason: reason,
    is_purchase_candidate: false,
    meta_purchase_candidate: false,
    confirmed_bridge_candidate: false,
    value_guard_required_before_meta_send: true,
    server_guard: "payment_success_downgrade_to_payment_page_seen",
  };
};

export const findDuplicateFormSubmitEntry = (
  entries: AttributionLedgerEntry[],
  body: Record<string, unknown>,
  nowIso = new Date().toISOString(),
) => {
  const formId = typeof body.formId === "string" ? body.formId.trim() : "";
  const formPage = typeof body.formPage === "string" ? body.formPage.trim() : "";
  const source = typeof body.source === "string" ? body.source.trim() : "";

  if (!source || (!formId && !formPage)) {
    return undefined;
  }

  const parsedNow = Date.parse(nowIso);
  const nowMs = Number.isFinite(parsedNow) ? parsedNow : Date.now();
  const tenMinAgo = new Date(nowMs - 10 * 60 * 1000).toISOString();

  return entries.find((entry) => {
    if (entry.touchpoint !== "form_submit") return false;
    if (entry.loggedAt <= tenMinAgo) return false;
    if (entry.metadata?.source !== source) return false;

    const existingFormId = typeof entry.metadata?.formId === "string" ? entry.metadata.formId : "";
    const existingFormPage = typeof entry.metadata?.formPage === "string" ? entry.metadata.formPage : "";

    if (formId) {
      return existingFormId === formId;
    }

  return Boolean(formPage) && existingFormPage === formPage;
  });
};

type NaverEvidenceClass =
  | "paid_naver"
  | "naver_brandsearch"
  | "organic_naver_candidate"
  | "naver_referrer_or_utm_only";

type NaverEvidenceAggregateRow = {
  class: NaverEvidenceClass;
  touchpoint: AttributionLedgerEntry["touchpoint"];
  rows: number;
  bridgeKeyPresent: number;
  confidence: "B" | "C" | "aggregate_only";
  budgetRoasIncluded: false;
  useForBudgetRoas: "reference_only_not_budget";
  note: string;
};

const NAVER_EVIDENCE_CLASSES: NaverEvidenceClass[] = [
  "paid_naver",
  "naver_brandsearch",
  "organic_naver_candidate",
  "naver_referrer_or_utm_only",
];

const ledgerFirstTouch = (entry: AttributionLedgerEntry) => {
  const value = entry.metadata?.firstTouch;
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
};

const naverEvidenceText = (entry: AttributionLedgerEntry) => {
  const firstTouch = ledgerFirstTouch(entry);
  return [
    entry.landing,
    entry.referrer,
    entry.utmSource,
    entry.utmMedium,
    entry.utmCampaign,
    entry.utmTerm,
    entry.utmContent,
    firstTouch.landing,
    firstTouch.referrer,
    firstTouch.utmSource,
    firstTouch.utmMedium,
    firstTouch.utmCampaign,
    firstTouch.utmTerm,
    firstTouch.utmContent,
  ].map((value) => readText(value).toLowerCase()).join(" ");
};

const naverEvidenceProfile = (entry: AttributionLedgerEntry) => {
  const firstTouch = ledgerFirstTouch(entry);
  const directReferrer = readText(entry.referrer).toLowerCase();
  const firstReferrer = readText(firstTouch.referrer).toLowerCase();
  const text = naverEvidenceText(entry);
  const directNapm = safeUrlParam("NaPm", entry.landing, entry.referrer);
  const firstNapm = safeUrlParam("NaPm", firstTouch.landing, firstTouch.referrer);
  const paidUtm =
    (lowerIncludesAny(readText(entry.utmSource), ["naver"]) || lowerIncludesAny(readText(firstTouch.utmSource), ["naver"])) &&
    /^(cpc|ppc|paid|paid_social|display|shopping|brandsearch|powerlink|sa|bs)$/i.test(
      readText(entry.utmMedium) || readText(firstTouch.utmMedium),
    );
  const hasNaverSearchReferrer = lowerIncludesAny(`${directReferrer} ${firstReferrer}`, NAVER_SEARCH_REFERRERS);
  const hasNaverReferrer = lowerIncludesAny(`${directReferrer} ${firstReferrer} ${text}`, NAVER_REFERRERS);
  const hasBrandsearch = lowerIncludesAny(text, ["brandsearch", "brand_search", "naverbrandsearch"]);
  const hasNaverParam = lowerIncludesAny(text, [
    "nclid=",
    "n_media=",
    "n_query=",
    "n_rank=",
    "n_ad_group=",
    "n_ad=",
    "n_keyword_id=",
    "n_keyword=",
    "n_match=",
  ]);
  const hasPowerlink = lowerIncludesAny(text, ["powerlink", "shoppingsearch"]);
  const hasPaidMarker = Boolean(directNapm || firstNapm || paidUtm || hasNaverParam || hasBrandsearch || hasPowerlink);
  const hasNaverAny = hasNaverReferrer || hasPaidMarker || lowerIncludesAny(text, ["naver", "napm"]);
  return {
    text,
    hasNaverAny,
    hasNaverSearchReferrer,
    hasNaverReferrer,
    hasBrandsearch,
    hasPaidMarker,
  };
};

const classifyNaverEvidence = (entry: AttributionLedgerEntry): NaverEvidenceClass | null => {
  const profile = naverEvidenceProfile(entry);
  if (!profile.hasNaverAny) return null;
  if (profile.hasBrandsearch) return "naver_brandsearch";
  if (profile.hasPaidMarker) return "paid_naver";
  if (profile.hasNaverSearchReferrer) return "organic_naver_candidate";
  if (profile.hasNaverReferrer || lowerIncludesAny(profile.text, ["naver"])) return "naver_referrer_or_utm_only";
  return null;
};

const naverEvidenceNote = (classification: NaverEvidenceClass) => {
  if (classification === "paid_naver") return "NaPm/n_* 또는 paid UTM 계열이 있어 네이버 광고 후보로만 둔다.";
  if (classification === "naver_brandsearch") return "brandsearch marker가 있어 네이버 브랜드검색 후보로만 둔다.";
  if (classification === "organic_naver_candidate") return "네이버 검색 referrer는 있으나 paid marker가 없어 자연검색 후보로 둔다.";
  return "네이버 흔적은 있으나 paid/brandsearch/organic 확정 조건을 충족하지 않는다.";
};

const buildNaverEvidenceAggregate = (
  entries: AttributionLedgerEntry[],
  filters: Record<string, unknown>,
) => {
  const rows = new Map<string, NaverEvidenceAggregateRow>();
  const add = (classification: NaverEvidenceClass, entry: AttributionLedgerEntry) => {
    const key = `${classification}:${entry.touchpoint}`;
    const current = rows.get(key) || {
      class: classification,
      touchpoint: entry.touchpoint,
      rows: 0,
      bridgeKeyPresent: 0,
      confidence: classification === "organic_naver_candidate" ? "C" as const : "aggregate_only" as const,
      budgetRoasIncluded: false as const,
      useForBudgetRoas: "reference_only_not_budget" as const,
      note: naverEvidenceNote(classification),
    };
    current.rows += 1;
    if (entry.orderId || entry.paymentKey) current.bridgeKeyPresent += 1;
    rows.set(key, current);
  };

  for (const entry of entries) {
    const classification = classifyNaverEvidence(entry);
    if (classification) add(classification, entry);
  }

  const ordered = Array.from(rows.values()).sort((a, b) =>
    a.class.localeCompare(b.class) || a.touchpoint.localeCompare(b.touchpoint),
  );
  const byClass = NAVER_EVIDENCE_CLASSES.reduce<Record<NaverEvidenceClass, number>>((acc, key) => {
    acc[key] = 0;
    return acc;
  }, {} as Record<NaverEvidenceClass, number>);
  for (const row of ordered) {
    byClass[row.class] = (byClass[row.class] || 0) + row.rows;
  }

  return {
    contractVersion: "naver-evidence-aggregate-v0.1",
    aggregateOnly: true,
    rawIdentifierOutput: false,
    budgetRoasIncluded: false,
    source: "attribution_ledger full filtered aggregate",
    filters,
    summary: {
      rowsTotal: entries.length,
      naverAny: ordered.reduce((sum, row) => sum + row.rows, 0),
      byClass,
    },
    rows: ordered,
    warnings: [
      "UTM/NaPm/n_*는 채널 evidence이며 actual 매출 정본이 아니다.",
      "예산 ROAS에는 자동 포함하지 않는다.",
    ],
  };
};

export const createAttributionRouter = () => {
  const router = express.Router();

  // Ensure paid_click_intent_ledger table exists even while the write flag is
  // OFF. This makes Phase 1 verification deterministic (Phase 0 deploy can
  // confirm table presence, row_count = 0 baseline).
  try {
    bootstrapPaidClickIntentTable();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[paid_click_intent] bootstrap table failed", error);
  }

  router.post("/api/attribution/npay-intent", (req: Request, res: Response) => {
    try {
      const body = parseBody(req.body);
      const result = recordNpayIntent(body, buildRequestContext(req));

      res.status(result.deduped ? 200 : 201).json({
        ok: true,
        receiver: "npay_intent",
        storedAt: "npay_intent_log",
        intent_id: result.intent.id,
        intent_key: result.intent.intentKey,
        deduped: result.deduped,
        match_status: result.intent.matchStatus,
        captured_at: result.intent.capturedAt,
        environment: result.intent.environment,
        site: result.intent.site,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "npay intent logging failed";
      res.status(400).json({ ok: false, error: "npay_intent_log_error", message });
    }
  });

  router.get("/api/attribution/npay-intents", (req: Request, res: Response) => {
    try {
      if (!requireNpayIntentReadAccess(req, res)) return;

      const site = readOne(req.query.site) || "biocom";
      const matchStatus = readOne(req.query.matchStatus || req.query.status);
      const limit = parsePositiveInt(readOne(req.query.limit), 50, 200);
      const items = listNpayIntents({ site, matchStatus, limit });
      res.json({
        ok: true,
        source: "local_crm_sqlite.npay_intent_log",
        generatedAt: new Date().toISOString(),
        summary: getNpayIntentSummary(site),
        items,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "npay intent list failed";
      res.status(500).json({ ok: false, error: "npay_intent_list_error", message });
    }
  });

  router.get("/api/attribution/npay-roas-dry-run", async (req: Request, res: Response) => {
    try {
      if (!requireNpayIntentReadAccess(req, res)) return;

      const report = await buildNpayRoasDryRunReport({
        start: readOne(req.query.start),
        end: readOne(req.query.end),
        site: readOne(req.query.site) || "biocom",
        ga4PresentOrderNumbers: readCsvList(req.query.ga4PresentOrderNumbers || req.query.ga4Present),
        ga4RobustAbsentOrderNumbers: readCsvList(
          req.query.ga4RobustAbsentOrderNumbers || req.query.ga4RobustAbsent,
        ),
        ga4AbsentOrderNumbers: readCsvList(req.query.ga4AbsentOrderNumbers || req.query.ga4Absent),
        testOrderNumbers: readCsvList(req.query.testOrderNumbers || req.query.testOrders),
        testOrderLabel: readOne(req.query.testOrderLabel),
        orderNumbers: readCsvList(req.query.orderNumbers || req.query.orderNumber),
      });

      res.json(report);
    } catch (error) {
      const message = error instanceof Error ? error.message : "npay roas dry-run failed";
      res.status(500).json({ ok: false, error: "npay_roas_dry_run_error", message });
    }
  });

  router.post("/api/attribution/engagement-intent", (req: Request, res: Response) => {
    try {
      const body = parseBody(req.body);
      for (const key of ["page_location", "page_referrer"]) {
        const raw = body[key];
        if (typeof raw === "string") body[key] = sanitizeProductEngagementUrl(raw);
      }
      const rejectedField = findProductEngagementRejectedField(body);
      if (rejectedField) {
        res.status(400).json({
          ok: false,
          dryRun: true,
          wouldStore: false,
          reason: "pii_or_value_detected",
          piiRejectedFields: [rejectedField],
          warnings: ["ProductEngagementSummary는 내부 관심도 분석용이므로 PII, value, currency를 받지 않는다."],
          source: {
            mode: "no_write_preview",
            receivedAt: new Date().toISOString(),
          },
        });
        return;
      }

      const site = textField(body, "site") || "biocom";
      const eventName = textField(body, "event_name");
      const eventId = textField(body, "event_id");
      const capturedAt = textField(body, "captured_at");
      const pageLocation = textField(body, "page_location");
      const productIdx = textField(body, "product_idx");
      const gaSessionId = textField(body, "ga_session_id");
      const localSessionId = textField(body, "local_session_id");
      const visibleSeconds = numberField(body, "visible_seconds");
      const maxScrollPercent = numberField(body, "max_scroll_percent");
      const debugModePresent = Object.prototype.hasOwnProperty.call(body, "debug_mode");

      const missingFields = [
        ["site", site],
        ["event_name", eventName],
        ["event_id", eventId],
        ["captured_at", capturedAt],
        ["page_location", pageLocation],
        ["product_idx", productIdx],
        ["visible_seconds", Number.isFinite(visibleSeconds) ? String(visibleSeconds) : ""],
        ["max_scroll_percent", Number.isFinite(maxScrollPercent) ? String(maxScrollPercent) : ""],
        ["debug_mode", debugModePresent ? "present" : ""],
      ]
        .filter(([, value]) => !value)
        .map(([key]) => key);

      if (missingFields.length > 0) {
        res.status(400).json({
          ok: false,
          dryRun: true,
          wouldStore: false,
          reason: "missing_required_fields",
          missingFields,
          source: {
            mode: "no_write_preview",
            receivedAt: new Date().toISOString(),
          },
        });
        return;
      }

      if (!PRODUCT_ENGAGEMENT_ALLOWED_SITES.has(site)) {
        res.status(400).json({
          ok: false,
          dryRun: true,
          wouldStore: false,
          reason: "site_not_allowed",
          site,
          allowedSites: [...PRODUCT_ENGAGEMENT_ALLOWED_SITES],
          source: {
            mode: "no_write_preview",
            receivedAt: new Date().toISOString(),
          },
        });
        return;
      }

      if (eventName !== PRODUCT_ENGAGEMENT_EVENT_NAME) {
        res.status(400).json({
          ok: false,
          dryRun: true,
          wouldStore: false,
          reason: "event_name_not_allowed",
          eventName,
          expectedEventName: PRODUCT_ENGAGEMENT_EVENT_NAME,
          source: {
            mode: "no_write_preview",
            receivedAt: new Date().toISOString(),
          },
        });
        return;
      }

      if (visibleSeconds < 0 || maxScrollPercent < 0 || maxScrollPercent > 100) {
        res.status(400).json({
          ok: false,
          dryRun: true,
          wouldStore: false,
          reason: "engagement_metric_out_of_range",
          visibleSeconds,
          maxScrollPercent,
          source: {
            mode: "no_write_preview",
            receivedAt: new Date().toISOString(),
          },
        });
        return;
      }

      const sessionKey = gaSessionId || localSessionId || "missing_session";
      const warnings = sessionKey === "missing_session"
        ? ["ga_session_id/local_session_id가 없어 dedupe key 신뢰도가 낮다."]
        : [];

      res.json({
        ok: true,
        dryRun: true,
        wouldStore: false,
        eventName,
        eventId,
        dedupeKey: `engagement:${site}:${sessionKey}:${productIdx}`,
        sanitizedPageLocation: sanitizeProductEngagementUrl(pageLocation),
        derived: {
          isEngagedView: visibleSeconds >= 45 && maxScrollPercent >= 50,
          isDeepView: visibleSeconds >= 90 && maxScrollPercent >= 75,
          bounceLike: visibleSeconds < 10 && maxScrollPercent < 25,
          attentionScorePreview: productEngagementAttentionScore(visibleSeconds, maxScrollPercent),
        },
        warnings,
        piiRejectedFields: [],
        source: {
          mode: "no_write_preview",
          receivedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "engagement intent dry-run failed";
      res.status(400).json({
        ok: false,
        dryRun: true,
        wouldStore: false,
        error: "engagement_intent_dry_run_error",
        message,
      });
    }
  });

  router.post("/api/attribution/confirmed-purchase/no-send", (req: Request, res: Response) => {
    try {
      const body = parseBody(req.body);
      const rejectedField = findConfirmedPurchaseRejectedField(body);
      if (rejectedField) {
        const receivedAt = new Date().toISOString();
        const blockReasons = ["read_only_phase", "approval_required", "pii_detected", "secret_detected"];
        res.status(400).json({
          ok: false,
          ...noSendGuardAliases,
          reason: "pii_or_secret_detected",
          block_reasons: blockReasons,
          legacy_block_reasons: [],
          guard: buildNoSendGuard({
            blockReasons,
            source: "confirmed_purchase_no_send",
            checkedAt: receivedAt,
            confidence: 0.95,
          }),
          rejectedField,
          warnings: [
            "confirmed_purchase no-send preview는 주문번호, 금액, 결제완료 시각, 광고 클릭 ID만 받는다.",
            "이름, 전화번호, 이메일, 카드/계좌, raw cookie, token은 받지 않는다.",
          ],
          source: {
            mode: "no_write_no_send_preview",
            receivedAt,
          },
        });
        return;
      }

      const preview = buildConfirmedPurchaseNoSendPreview(body);
      const hardBlocks = preview.block_reasons.filter((reason) => !["read_only_phase", "approval_required"].includes(reason));
      const receivedAt = new Date().toISOString();
      res.status(hardBlocks.length > 0 ? 400 : 200).json({
        ok: hardBlocks.length === 0,
        ...noSendGuardAliases,
        receiver: "confirmed_purchase_no_send",
        guard: buildNoSendGuard({
          blockReasons: preview.block_reasons,
          legacyBlockReasons: preview.legacy_block_reasons,
          source: "confirmed_purchase_no_send",
          checkedAt: receivedAt,
        }),
        preview,
        source: {
          mode: "no_write_no_send_preview",
          receivedAt,
        },
        warnings: [
          "NPay click/count/payment start만 있는 row는 purchase 후보가 아니다.",
          "NPay 실제 결제완료 주문과 홈페이지 결제완료 주문만 include_reason에 들어갈 수 있다.",
          "GA4/Meta/Google Ads 실제 전송은 별도 Red Lane 승인 전까지 금지다.",
        ],
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "confirmed purchase no-send preview failed";
      const receivedAt = new Date().toISOString();
      const blockReasons = ["read_only_phase", "approval_required"];
      res.status(400).json({
        ok: false,
        ...noSendGuardAliases,
        error: "confirmed_purchase_no_send_preview_error",
        message,
        block_reasons: blockReasons,
        legacy_block_reasons: [],
        guard: buildNoSendGuard({
          blockReasons,
          source: "confirmed_purchase_no_send",
          checkedAt: receivedAt,
          confidence: 0.75,
        }),
      });
    }
  });

  router.post("/api/attribution/paid-click-intent/no-send", (req: Request, res: Response) => {
    try {
      const body = parseBody(req.body);
      const receivedAtForPrecheck = new Date().toISOString();
      const bodySizeBytes = estimateJsonSizeBytes(body);
      if (bodySizeBytes > PAID_CLICK_INTENT_BODY_LIMIT_BYTES) {
        const blockReasons = ["read_only_phase", "approval_required", "payload_too_large"];
        res.status(413).json({
          ok: false,
          ...noSendGuardAliases,
          reason: "payload_too_large",
          block_reasons: blockReasons,
          legacy_block_reasons: [],
          guard: buildNoSendGuard({
            blockReasons,
            source: "paid_click_intent_no_send",
            checkedAt: receivedAtForPrecheck,
            confidence: 0.98,
          }),
          limit_bytes: PAID_CLICK_INTENT_BODY_LIMIT_BYTES,
          received_bytes: Number.isFinite(bodySizeBytes) ? bodySizeBytes : null,
          source: {
            mode: "no_write_no_send_preview",
            receivedAt: receivedAtForPrecheck,
          },
        });
        return;
      }

      const blockedPath = paidClickIntentBlockedPath(body);
      if (blockedPath) {
        const blockReasons = ["read_only_phase", "approval_required", "admin_or_internal_path"];
        res.status(400).json({
          ok: false,
          ...noSendGuardAliases,
          reason: "admin_or_internal_path",
          block_reasons: blockReasons,
          legacy_block_reasons: [],
          guard: buildNoSendGuard({
            blockReasons,
            source: "paid_click_intent_no_send",
            checkedAt: receivedAtForPrecheck,
            confidence: 0.98,
          }),
          blocked_path: blockedPath,
          warnings: [
            "paid_click_intent는 고객 랜딩/체크아웃/NPay intent의 click id 보존만 확인한다.",
            "admin, login, logout, internal/API 경로 payload는 no-write preview에서도 받지 않는다.",
          ],
          source: {
            mode: "no_write_no_send_preview",
            receivedAt: receivedAtForPrecheck,
          },
        });
        return;
      }

      const rejectedField = findPaidClickIntentRejectedField(body);
      if (rejectedField) {
        const receivedAt = new Date().toISOString();
        const normalizedRejectedField = normalizeSecurityKey(rejectedField);
        const blockReasons = ["read_only_phase", "approval_required"];
        if (normalizedRejectedField === "value" || normalizedRejectedField === "currency") {
          blockReasons.push("invalid_value_field");
        } else {
          blockReasons.push("pii_detected", "secret_detected");
        }
        res.status(400).json({
          ok: false,
          ...noSendGuardAliases,
          reason: "pii_secret_or_purchase_field_detected",
          block_reasons: blockReasons,
          legacy_block_reasons: [],
          guard: buildNoSendGuard({
            blockReasons,
            source: "paid_click_intent_no_send",
            checkedAt: receivedAt,
            confidence: 0.95,
          }),
          rejectedField,
          warnings: [
            "paid_click_intent no-send preview는 랜딩/체크아웃 시점 click id 보존만 확인한다.",
            "이름, 전화번호, 이메일, 주문번호, 결제금액, 결제완료 시각, 카드/계좌, raw cookie, token은 받지 않는다.",
          ],
          source: {
            mode: "no_write_no_send_preview",
            receivedAt,
          },
        });
        return;
      }

      const preview = buildPaidClickIntentNoSendPreview(body);
      const hardBlocks = preview.block_reasons.filter((reason) => ![
        "read_only_phase",
        "approval_required",
        "test_click_id_rejected_for_live",
      ].includes(reason));
      const receivedAt = new Date().toISOString();

      // minimal ledger write canary 분기: flag false 또는 비-live 후보는 기존 no-write 응답 그대로 유지.
      // flag true + live_candidate_after_approval=true + sample rate 통과 시에만 운영 ledger 1행 INSERT.
      // 외부 플랫폼 전송(GA4/Meta/Google Ads/TikTok/Naver)은 분기와 무관하게 항상 0건 유지.
      let ledgerStored = false;
      let ledgerDeduped = false;
      let ledgerRejectReason: string | null = null;
      const writeFlagOn = isPaidClickIntentWriteEnabled();
      const livePreviewCandidate = preview.live_candidate_after_approval && hardBlocks.length === 0;
      if (writeFlagOn && livePreviewCandidate) {
        const sampleRate = getPaidClickIntentWriteSampleRate();
        if (sampleRate > 0 && (sampleRate >= 1 || Math.random() < sampleRate)) {
          try {
            const ledgerContext = buildRequestContext(req);
            const result = recordPaidClickIntent(
              {
                site: preview.site,
                capture_stage: preview.capture_stage,
                captured_at: preview.captured_at,
                dedupe_key: preview.dedupe_key,
                has_google_click_id: preview.has_google_click_id,
                test_click_id: preview.test_click_id,
                live_candidate_after_approval: preview.live_candidate_after_approval,
                block_reasons: preview.block_reasons,
                click_ids: preview.click_ids,
                utm: preview.utm,
                client_id: preview.client_id,
                ga_session_id: preview.ga_session_id,
                local_session_id: preview.local_session_id,
                sanitized_landing_url: preview.sanitized_landing_url,
                sanitized_referrer: preview.sanitized_referrer,
                member_code: preview.member_code,
              },
              body,
              { ip: ledgerContext.ip, userAgent: ledgerContext.userAgent },
            );
            if (result.stored) {
              ledgerStored = true;
              ledgerDeduped = result.deduped;
            } else {
              ledgerRejectReason = result.reason;
            }
          } catch (error) {
            // eslint-disable-next-line no-console
            console.error("[paid_click_intent] ledger write failed", error);
            ledgerRejectReason = "ledger_write_internal_error";
          }
        }
      }

      const siteLandingFanout = fanOutPaidClickIntentPreviewToSiteLanding({
        capturedAt: preview.captured_at,
        landingUrl: preview.sanitized_landing_url,
        referrer: preview.sanitized_referrer,
        utm: preview.utm,
        clickIds: preview.click_ids,
        sessionKey: {
          gaSessionId: preview.ga_session_id,
          clientId: preview.client_id,
          localSessionIdHash: preview.local_session_id,
        },
      });

      const previewForResponse = ledgerStored
        ? { ...preview, would_store: true }
        : preview;
      const sourceMode = ledgerStored ? "minimal_ledger_canary_write" : "no_write_no_send_preview";
      const ledgerInfo = ledgerStored
        ? { stored: true as const, deduped: ledgerDeduped, write_mode: "minimal_canary" as const }
        : ledgerRejectReason
          ? { stored: false as const, rejected: true as const, reason: ledgerRejectReason }
          : undefined;

      res.status(hardBlocks.length > 0 ? 400 : 200).json({
        ok: hardBlocks.length === 0,
        ...noSendGuardAliases,
        receiver: "paid_click_intent_no_send",
        guard: buildNoSendGuard({
          blockReasons: preview.block_reasons,
          legacyBlockReasons: preview.legacy_block_reasons,
          source: "paid_click_intent_no_send",
          checkedAt: receivedAt,
        }),
        preview: previewForResponse,
        ledger: ledgerInfo,
        site_landing_fanout: siteLandingFanout,
        source: {
          mode: sourceMode,
          receivedAt,
          write_flag_on: writeFlagOn,
        },
        warnings: [
          "이 endpoint는 purchase 후보가 아니라 Google click id 보존 Preview 전용이다.",
          "TEST_/DEBUG_/PREVIEW_ click id는 Preview 확인용으로만 허용되고 live 후보에서는 항상 차단된다.",
          "confirmed_purchase/no-send는 실제 결제완료 주문만 받도록 계속 분리한다.",
          ...(writeFlagOn
            ? ["minimal_ledger_canary write가 활성화됐다. site=biocom click id 보존용 최소 row만 저장하며 외부 플랫폼 전송은 0건이다."]
            : []),
        ],
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "paid click intent no-send preview failed";
      const receivedAt = new Date().toISOString();
      const blockReasons = ["read_only_phase", "approval_required"];
      res.status(400).json({
        ok: false,
        ...noSendGuardAliases,
        error: "paid_click_intent_no_send_preview_error",
        message,
        block_reasons: blockReasons,
        legacy_block_reasons: [],
        guard: buildNoSendGuard({
          blockReasons,
          source: "paid_click_intent_no_send",
          checkedAt: receivedAt,
          confidence: 0.75,
        }),
      });
    }
  });

  router.post("/api/attribution/order-bridge/identity-hmac/no-send", (req: Request, res: Response) => {
    const receivedAt = new Date().toISOString();
    try {
      const body = parseBody(req.body);
      const bodySizeBytes = estimateJsonSizeBytes(body);
      if (bodySizeBytes > ORDER_BRIDGE_IDENTITY_HMAC_BODY_LIMIT_BYTES) {
        const blockReasons = ["read_only_phase", "approval_required", "payload_too_large"];
        res.status(413).json({
          ok: false,
          ...noSendGuardAliases,
          receiver: "order_bridge_identity_hmac_no_send",
          error: "payload_too_large",
          block_reasons: blockReasons,
          guard: buildNoSendGuard({
            blockReasons,
            source: "order_bridge_identity_hmac_no_send",
            checkedAt: receivedAt,
            confidence: 0.98,
          }),
          limit_bytes: ORDER_BRIDGE_IDENTITY_HMAC_BODY_LIMIT_BYTES,
          received_bytes: Number.isFinite(bodySizeBytes) ? bodySizeBytes : null,
          source: {
            mode: "no_write_no_send_identity_hmac_preview",
            receivedAt,
          },
        });
        return;
      }
      const material = buildOrderBridgeIdentityHmacMaterial(body, {
        secret: process.env.ORDER_BRIDGE_IDENTITY_HASH_SECRET ?? "",
        receivedAt,
      });
      const preview = material.preview;
      const blockReasons = ["read_only_phase", "approval_required"];
      const writeFlagOn = isOrderBridgeWriteEnabled();
      let ledger:
        | { stored: true; deduped: boolean; write_mode: "hash_only_canary"; status: string }
        | { stored: false; rejected: true; reason: string }
        | undefined;
      let previewForResponse = preview;

      if (writeFlagOn) {
        const result = recordOrderBridgeLedger(material);
        if (result.stored) {
          previewForResponse = { ...preview, would_store: true };
          ledger = {
            stored: true,
            deduped: result.deduped,
            write_mode: "hash_only_canary",
            status: result.row.status,
          };
        } else {
          ledger = {
            stored: false,
            rejected: true,
            reason: result.reason,
          };
        }
      }

      res.status(200).json({
        ok: true,
        ...noSendGuardAliases,
        receiver: "order_bridge_identity_hmac_no_send",
        guard: buildNoSendGuard({
          blockReasons,
          source: "order_bridge_identity_hmac_no_send",
          checkedAt: receivedAt,
          confidence: 0.93,
        }),
        preview: previewForResponse,
        ledger,
        source: {
          mode: ledger?.stored ? "hash_only_order_bridge_canary_write" : "no_write_no_send_identity_hmac_preview",
          receivedAt,
          write_flag_on: writeFlagOn,
          write_max_rows: getOrderBridgeWriteMaxRows(),
          raw_body_logging_enabled: isOrderBridgeRawBodyLoggingEnabled(),
          platform_send_enabled: isOrderBridgePlatformSendEnabled(),
        },
        warnings: [
          "Path B Preview endpoint다. 운영 저장, platform send, GTM Production publish는 하지 않는다.",
          "raw email/phone/order는 HMAC 생성을 위한 transient input으로만 허용하고 response/log/storage에 남기지 않는다.",
          "response에는 raw 값 없이 hash present 여부와 짧은 hash prefix만 반환한다.",
          ...(writeFlagOn
            ? ["ORDER_BRIDGE_WRITE_ENABLED=true 상태다. hash-only canary row만 저장하며 raw 저장과 platform send는 계속 0건이어야 한다."]
            : []),
        ],
      });
    } catch (error) {
      const isConfigError = error instanceof OrderBridgeIdentityHmacConfigError;
      const blockReasons = [
        "read_only_phase",
        "approval_required",
        isConfigError ? "hash_secret_missing" : "identity_hmac_preview_error",
      ];
      res.status(isConfigError ? 503 : 400).json({
        ok: false,
        ...noSendGuardAliases,
        receiver: "order_bridge_identity_hmac_no_send",
        error: isConfigError ? "hash_secret_missing" : "identity_hmac_preview_error",
        message: isConfigError
          ? "ORDER_BRIDGE_IDENTITY_HASH_SECRET is required for hash-only preview"
          : "order bridge identity HMAC preview failed",
        block_reasons: blockReasons,
        legacy_block_reasons: [],
        guard: buildNoSendGuard({
          blockReasons,
          source: "order_bridge_identity_hmac_no_send",
          checkedAt: receivedAt,
          confidence: isConfigError ? 0.95 : 0.75,
        }),
        source: {
          mode: "no_write_no_send_identity_hmac_preview",
          receivedAt,
        },
      });
    }
  });

  router.get("/api/attribution/order-bridge/ledger/summary", (_req: Request, res: Response) => {
    try {
      bootstrapOrderBridgeLedgerTable();
      res.status(200).json({
        ok: true,
        summary: getOrderBridgeLedgerSummary("biocom"),
        source: {
          mode: "order_bridge_ledger_summary_readonly",
          receivedAt: new Date().toISOString(),
          write_flag_on: isOrderBridgeWriteEnabled(),
          write_max_rows: getOrderBridgeWriteMaxRows(),
        },
      });
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: "order_bridge_ledger_summary_failed",
        message: error instanceof Error ? error.message : "unknown_error",
      });
    }
  });

  router.post("/api/attribution/form-submit", async (req: Request, res: Response) => {
    try {
      const body = parseBody(req.body);
      enforceOriginSourceMatch(req, body, "form_submit");
      const entry = buildLedgerEntry("form_submit", body, buildRequestContext(req));

      const existing = await readLedgerEntries();
      const duplicate = findDuplicateFormSubmitEntry(existing, body);
      if (duplicate) {
        res.status(200).json({
          ok: true,
          receiver: "form_submit",
          skipped: true,
          reason: "duplicate_form_submit",
        });
        return;
      }

      const ledgerPath = await appendLedgerEntry(entry);
      res.status(201).json({
        ok: true,
        receiver: "form_submit",
        storedAt: ledgerPath,
        entry,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "form attribution logging failed";
      res.status(400).json({ ok: false, error: "form_attribution_log_error", message });
    }
  });

  router.post("/api/attribution/marketing-intent", async (req: Request, res: Response) => {
    try {
      const body = parseBody(req.body);
      const rateLimitState = checkMarketingIntentRateLimit(req);
      if (!rateLimitState.allowed) {
        res
          .status(429)
          .setHeader("Retry-After", String(rateLimitState.retryAfterSeconds))
          .json({ ok: false, error: "marketing_intent_rate_limited", retryAfterSeconds: rateLimitState.retryAfterSeconds });
        return;
      }

      const piiKey = findMarketingIntentPiiKey(body);
      if (piiKey) {
        res.status(400).json({ ok: false, error: "marketing_intent_pii_rejected", piiKey });
        return;
      }

      sanitizeMarketingIntentBody(body);
      const biocomGuard = requireBiocomMarketingIntentRequest(req, body);
      if (!biocomGuard.ok) {
        res.status(403).json({
          ok: false,
          error: biocomGuard.reason,
          detail: biocomGuard.detail,
        });
        return;
      }

      const originGuard = enforceOriginSourceMatch(req, body, "marketing_intent");
      if (originGuard.status === "unknown_origin") {
        body.source = "biocom_imweb";
        if (body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata)) {
          (body.metadata as Record<string, unknown>).source = "biocom_imweb";
        }
      }

      const entry = buildLedgerEntry("marketing_intent", body, buildRequestContext(req));
      const strictTikTokReasons = hasStrictTikTokMarketingIntentEvidence(entry);

      if (strictTikTokReasons.length === 0) {
        res.status(200).json({
          ok: true,
          receiver: "marketing_intent",
          skipped: true,
          reason: "no_tiktok_intent_evidence",
        });
        return;
      }

      const existing = await readLedgerEntries();
      const duplicate = findDuplicateMarketingIntentEntry(existing, entry);
      if (duplicate) {
        res.status(200).json({
          ok: true,
          receiver: "marketing_intent",
          skipped: true,
          reason: "duplicate_marketing_intent",
          existingLoggedAt: duplicate.loggedAt,
        });
        return;
      }

      const enrichedEntry: AttributionLedgerEntry = {
        ...entry,
        metadata: {
          ...entry.metadata,
          intentChannel: "tiktok",
          intentLookbackDays: 7,
          marketingIntentDedupe: getMarketingIntentDedupeFingerprint(entry),
          tiktokMatchReasons: getAttributionTikTokMatchReasons(entry),
          strictTikTokMarketingIntentReasons: strictTikTokReasons,
        },
      };
      const ledgerPath = await appendLedgerEntry(enrichedEntry);
      const siteLandingFanout = fanOutEntryToSiteLanding(enrichedEntry, "marketing_intent");
      res.status(201).json({
        ok: true,
        receiver: "marketing_intent",
        storedAt: ledgerPath,
        entry: enrichedEntry,
        site_landing_fanout: siteLandingFanout,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "marketing intent logging failed";
      res.status(400).json({ ok: false, error: "marketing_intent_log_error", message });
    }
  });

  router.post("/api/attribution/checkout-context", async (req: Request, res: Response) => {
    try {
      const body = parseBody(req.body);
      const touchpoint = isPaymentPageSeenPayload(body) ? "payment_page_seen" : "checkout_started";
      enforceOriginSourceMatch(req, body, touchpoint);
      const builtEntry = buildLedgerEntry(touchpoint, body, buildRequestContext(req));
      const entry = touchpoint === "checkout_started"
        ? enrichCheckoutStartedFirstTouch(builtEntry)
        : builtEntry;
      const ledgerPath = await appendLedgerEntry(entry);
      const siteLandingFanout = fanOutEntryToSiteLanding(entry, touchpoint);
      res.status(201).json({
        ok: true,
        receiver: touchpoint === "payment_page_seen" ? "payment_page_seen" : "checkout_context",
        storedAt: ledgerPath,
        entry,
        site_landing_fanout: siteLandingFanout,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "checkout attribution logging failed";
      res.status(400).json({ ok: false, error: "checkout_attribution_log_error", message });
    }
  });

  router.post("/api/attribution/payment-page-seen", async (req: Request, res: Response) => {
    try {
      const body = parseBody(req.body);
      const metadata = metadataRecord(body);
      body.metadata = {
        ...metadata,
        semantic_touchpoint: "payment_page_seen",
        is_purchase_candidate: false,
        meta_purchase_candidate: false,
        confirmed_bridge_candidate: false,
        value_guard_required_before_meta_send: true,
      };
      enforceOriginSourceMatch(req, body, "payment_page_seen");
      const entry = buildLedgerEntry("payment_page_seen", body, buildRequestContext(req));
      const ledgerPath = await appendLedgerEntry(entry);
      const siteLandingFanout = fanOutEntryToSiteLanding(entry, "payment_page_seen");
      res.status(201).json({
        ok: true,
        receiver: "payment_page_seen",
        storedAt: ledgerPath,
        entry,
        site_landing_fanout: siteLandingFanout,
        warnings: ["payment_page_seen은 결제 진행 진단 신호이며 Meta Purchase 후보가 아니다."],
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "payment page seen attribution logging failed";
      res.status(400).json({ ok: false, error: "payment_page_seen_attribution_log_error", message });
    }
  });

  router.post("/api/attribution/payment-success", async (req: Request, res: Response) => {
    try {
      const body = parseBody(req.body);
      enforceOriginSourceMatch(req, body, "payment_success");
      const downgradeReason = getPaymentSuccessDowngradeReason(body, req);
      if (downgradeReason) {
        markPaymentPageSeenGuardMetadata(body, downgradeReason);
        const entry = buildLedgerEntry("payment_page_seen", body, buildRequestContext(req));
        const ledgerPath = await appendLedgerEntry(entry);
        const siteLandingFanout = fanOutEntryToSiteLanding(entry, "payment_page_seen");
        res.status(202).json({
          ok: true,
          receiver: "payment_page_seen",
          downgraded: true,
          reason: downgradeReason,
          storedAt: ledgerPath,
          entry,
          site_landing_fanout: siteLandingFanout,
          warnings: [
            "/shop_payment/는 결제완료가 아니므로 payment_success로 저장하지 않았다.",
            "payment_page_seen은 Meta Purchase 후보가 될 수 없다.",
          ],
        });
        return;
      }
      const existing = await readLedgerEntries();
      const entry = enrichPaymentSuccessFirstTouch(
        buildLedgerEntry("payment_success", body, buildRequestContext(req)),
        existing,
      );

      // 중복 방지: 같은 orderId가 최근 5분 내에 이미 적재되었으면 skip
      if (entry.orderId) {
        const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        const duplicate = existing.find(
          (e) =>
            e.orderId === entry.orderId &&
            e.touchpoint === "payment_success" &&
            e.loggedAt > fiveMinAgo,
        );
        if (duplicate) {
          res.status(200).json({
            ok: true,
            receiver: "payment_success",
            skipped: true,
            reason: "duplicate_order_id",
            existingLoggedAt: duplicate.loggedAt,
          });
          return;
        }
      }

      const ledgerPath = await appendLedgerEntry(entry);
      const orderBridgeR2 = recordPaymentSuccessOrderBridgeLedger(body, entry);
      const siteLandingFanout = fanOutEntryToSiteLanding(entry, "payment_success");
      res.status(201).json({
        ok: true,
        receiver: "payment_success",
        storedAt: ledgerPath,
        entry,
        orderBridgeR2,
        site_landing_fanout: siteLandingFanout,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "payment attribution logging failed";
      res.status(400).json({ ok: false, error: "payment_attribution_log_error", message });
    }
  });

  router.post("/api/attribution/tiktok-pixel-event", async (req: Request, res: Response) => {
    try {
      const body = parseBody(req.body);
      const event = normalizeTikTokPixelEventPayload(
        body,
        buildRequestContext(req),
        resolveOriginSiteSource(req),
      );
      const writtenRows = appendTikTokPixelEvent(event);
      res.status(writtenRows > 0 ? 201 : 200).json({
        ok: true,
        receiver: "tiktok_pixel_event",
        writtenRows,
        event,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "TikTok pixel event logging failed";
      res.status(400).json({ ok: false, error: "tiktok_pixel_event_log_error", message });
    }
  });

  router.get("/api/attribution/tiktok-pixel-events", async (req: Request, res: Response) => {
    try {
      const items = listTikTokPixelEvents({
        startAt: readOne(req.query.startAt),
        endAt: readOne(req.query.endAt),
        siteSource: readOne(req.query.siteSource),
        eventName: readOne(req.query.eventName),
        action: readOne(req.query.action),
        orderCode: readOne(req.query.orderCode),
        orderNo: readOne(req.query.orderNo),
        limit: parsePositiveInt(req.query.limit, 100, 10000),
      });

      res.json({
        ok: true,
        dataSource: "operational_or_local_sqlite_tiktok_pixel_events",
        storage: "CRM_LOCAL_DB_PATH#tiktok_pixel_events",
        filters: {
          startAt: readOne(req.query.startAt) || null,
          endAt: readOne(req.query.endAt) || null,
          siteSource: readOne(req.query.siteSource) || null,
          eventName: readOne(req.query.eventName) || null,
          action: readOne(req.query.action) || null,
          orderCode: readOne(req.query.orderCode) || null,
          orderNo: readOne(req.query.orderNo) || null,
        },
        summary: buildTikTokPixelEventSummary(items),
        items,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "TikTok pixel event read failed";
      res.status(500).json({ ok: false, error: "tiktok_pixel_event_read_error", message });
    }
  });

  router.get("/api/attribution/payment-decision", async (req: Request, res: Response) => {
    try {
      const routeStartedAt = Date.now();
      res.set("Cache-Control", "no-store");
      const lookup = parsePaymentDecisionLookup(req);
      const tossEnabled = parseBooleanish(req.query.toss ?? req.query.directToss, true);
      const debug = parseBooleanish(req.query.debug, false);
      const fastLedgerEntries = getPaymentDecisionFastLedgerEntries(lookup);
      const fastLedgerDecision = buildFastLedgerPaymentDecision(fastLedgerEntries, lookup);

      if (fastLedgerDecision) {
        const elapsedMs = Date.now() - routeStartedAt;
        recordPaymentDecisionMeasurement({
          receivedAtMs: Date.now(),
          elapsedMs,
          status: fastLedgerDecision.status,
          browserAction: fastLedgerDecision.browserAction,
        });
        res.json({
          ok: true,
          version: "2026-05-15.payment-decision.fast-ledger-v3",
          generatedAt: new Date().toISOString(),
          elapsedMs,
          decision: {
            status: fastLedgerDecision.status,
            browserAction: fastLedgerDecision.browserAction,
            confidence: fastLedgerDecision.confidence,
            matchedBy: fastLedgerDecision.matchedBy,
            reason: fastLedgerDecision.reason,
            notes: fastLedgerDecision.notes,
          },
          lookup: {
            orderId: lookup.orderId || null,
            orderNo: lookup.orderNo || null,
            orderCode: lookup.orderCode || null,
            paymentCode: lookup.paymentCode || null,
            paymentKey: lookup.paymentKey ? "***" : null,
            store: lookup.store,
          },
          fastPath: {
            attempted: true,
            source: "VM Cloud SQLite attribution_ledger",
            matchedRows: fastLedgerEntries.length,
            returned: true,
          },
          directToss: {
            attempted: false,
            matchedRows: 0,
            errors: 0,
          },
          operationalDb: {
            source: "운영DB PostgreSQL dashboard.public.tb_iamweb_users",
            attempted: false,
            matchedRows: 0,
            skippedReason: "fast_ledger_decision_returned",
          },
          debug: debug
            ? {
                matched: fastLedgerDecision.matched,
              }
            : undefined,
          notes: [
            "브라우저 문구가 아니라 서버가 아는 결제 상태로 Browser Purchase 허용 여부를 판단하는 read-only endpoint다.",
            "fast path는 VM Cloud SQLite 보조 원장의 exact payment_success confirmed match를 먼저 확인해 운영DB sync 지연과 외부 API 지연을 줄인다.",
            "confirmed만 allow_purchase다. pending은 VirtualAccountIssued로 낮추고, canceled/unknown은 Purchase를 보내지 않는다.",
          ],
        });
        return;
      }

      const entries = await readLedgerEntries();
      const operationalDecisionRows = await fetchOperationalPaymentDecisionRows(lookup);
      const directToss = tossEnabled
        ? await fetchTossDecisionRows(lookup)
        : { rows: [], errors: [], attempted: false };
      const ledgerFallbackMatch = findLedgerDecisionMatch(entries, lookup);

      if (
        tossEnabled &&
        directToss.rows.length === 0 &&
        ledgerFallbackMatch?.entry.paymentKey &&
        ledgerFallbackMatch.entry.paymentKey !== lookup.paymentKey
      ) {
        const paymentKeyFallback = await fetchTossDecisionRows({
          ...lookup,
          orderId: "",
          orderNo: "",
          paymentKey: ledgerFallbackMatch.entry.paymentKey,
        });
        directToss.rows.push(...paymentKeyFallback.rows);
        directToss.errors.push(...paymentKeyFallback.errors.map((message) => `ledger paymentKey fallback: ${message}`));
        directToss.attempted = directToss.attempted || paymentKeyFallback.attempted;
      }

      const decision = buildAttributionPaymentDecision(entries, lookup, directToss.rows, operationalDecisionRows);

      const elapsedMs = Date.now() - routeStartedAt;
      recordPaymentDecisionMeasurement({
        receivedAtMs: Date.now(),
        elapsedMs,
        status: decision.status,
        browserAction: decision.browserAction,
      });
      res.json({
        ok: true,
        version: "2026-05-15.payment-decision.fast-ledger-v3",
        generatedAt: new Date().toISOString(),
        elapsedMs,
        decision: {
          status: decision.status,
          browserAction: decision.browserAction,
          confidence: decision.confidence,
          matchedBy: decision.matchedBy,
          reason: decision.reason,
          notes: decision.notes,
        },
        lookup: {
          orderId: lookup.orderId || null,
          orderNo: lookup.orderNo || null,
          orderCode: lookup.orderCode || null,
          paymentCode: lookup.paymentCode || null,
          paymentKey: lookup.paymentKey ? "***" : null,
          store: lookup.store,
        },
        fastPath: {
          attempted: true,
          source: "VM Cloud SQLite attribution_ledger",
          matchedRows: fastLedgerEntries.length,
          returned: false,
        },
        directToss: {
          attempted: directToss.attempted,
          matchedRows: directToss.rows.length,
          errors: directToss.errors.length,
        },
        operationalDb: {
          source: "운영DB PostgreSQL dashboard.public.tb_iamweb_users",
          attempted: isDatabaseConfigured() && getPaymentDecisionLookupKeys(lookup).length > 0,
          matchedRows: operationalDecisionRows.length,
        },
        debug: debug
          ? {
              matched: decision.matched,
              directTossErrors: directToss.errors,
            }
          : undefined,
        notes: [
          "브라우저 문구가 아니라 서버가 아는 결제 상태로 Browser Purchase 허용 여부를 판단하는 read-only endpoint다.",
          "confirmed만 allow_purchase다. pending은 VirtualAccountIssued로 낮추고, canceled/unknown은 Purchase를 보내지 않는 정책이 데이터 정합성에 안전하다.",
          "운영 헤더 코드에서 사용하려면 이 endpoint가 노트북이 아니라 안정적인 VM/Cloud Run에서 먼저 배포되어야 한다.",
        ],
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "payment decision failed";
      res.status(500).json({ ok: false, error: "attribution_payment_decision_error", message });
    }
  });

  router.get("/api/attribution/ledger/naver-evidence-aggregate", async (req: Request, res: Response) => {
    try {
      const allEntries = await readLedgerEntries();
      const source = typeof req.query.source === "string" ? req.query.source.trim() : "";
      const captureMode = typeof req.query.captureMode === "string" ? req.query.captureMode.trim() : "";
      const startAt = typeof req.query.startAt === "string" ? req.query.startAt.trim() : "";
      const endAt = typeof req.query.endAt === "string" ? req.query.endAt.trim() : "";

      const startMs = startAt ? Date.parse(startAt) : Number.NaN;
      const endMs = endAt ? Date.parse(endAt) : Number.NaN;
      const hasStartFilter = Number.isFinite(startMs);
      const hasEndFilter = Number.isFinite(endMs);

      const withinRange = (entry: AttributionLedgerEntry) => {
        if (!hasStartFilter && !hasEndFilter) return true;
        const loggedMs = Date.parse(entry.loggedAt);
        if (!Number.isFinite(loggedMs)) return true;
        if (hasStartFilter && loggedMs < startMs) return false;
        if (hasEndFilter && loggedMs > endMs) return false;
        return true;
      };

      const base = (source || captureMode)
        ? filterLedgerEntries(allEntries, {
            source: source || undefined,
            captureMode: captureMode || undefined,
          })
        : allEntries;
      const filtered = (hasStartFilter || hasEndFilter) ? base.filter(withinRange) : base;
      const filters = {
        source: source || null,
        captureMode: captureMode || null,
        startAt: startAt || null,
        endAt: endAt || null,
      };

      res.json({
        ok: true,
        filters,
        aggregate: buildNaverEvidenceAggregate(filtered, filters),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "naver evidence aggregate read failed";
      res.status(500).json({ ok: false, error: "naver_evidence_aggregate_read_error", message });
    }
  });

  router.get("/api/attribution/ledger", async (req: Request, res: Response) => {
    try {
      const rateLimit = checkAttributionLedgerReadRateLimit(req);
      if (!rateLimit.allowed) {
        res
          .status(429)
          .setHeader("Retry-After", String(rateLimit.retryAfterSeconds))
          .json({
            ok: false,
            error: "attribution_ledger_rate_limited",
            retryAfterSeconds: rateLimit.retryAfterSeconds,
            guard: {
              reason: "public_ledger_item_api_rate_limit",
              recommendation: "Use aggregate endpoints or reduce polling frequency.",
            },
          });
        return;
      }

      const allEntries = await readLedgerEntries();
      const source = typeof req.query.source === "string" ? req.query.source.trim() : "";
      const captureMode = typeof req.query.captureMode === "string" ? req.query.captureMode.trim() : "";
      const requestedLimit = parsePositiveInt(req.query.limit, 50, 10000);
      const summaryOnly = parseBooleanish(req.query.summaryOnly ?? req.query.summary_only, false);
      const startAt = typeof req.query.startAt === "string" ? req.query.startAt.trim() : "";
      const endAt = typeof req.query.endAt === "string" ? req.query.endAt.trim() : "";

      const startMs = startAt ? Date.parse(startAt) : Number.NaN;
      const endMs = endAt ? Date.parse(endAt) : Number.NaN;
      const hasStartFilter = Number.isFinite(startMs);
      const hasEndFilter = Number.isFinite(endMs);
      const rangeDays = hasStartFilter && hasEndFilter
        ? Math.max(0, Math.ceil((endMs - startMs) / (24 * 60 * 60 * 1000)))
        : null;
      const trustedInternalCaller = isTrustedLedgerReadCaller(req);
      const publicMaxLimit = rangeDays !== null && rangeDays > ATTRIBUTION_LEDGER_LONG_RANGE_DAYS
        ? ATTRIBUTION_LEDGER_PUBLIC_LONG_RANGE_MAX_LIMIT
        : ATTRIBUTION_LEDGER_PUBLIC_MAX_LIMIT;
      const effectiveLimit = summaryOnly
        ? 0
        : trustedInternalCaller
          ? requestedLimit
          : Math.min(requestedLimit, publicMaxLimit);
      const guardApplied = summaryOnly || effectiveLimit < requestedLimit;
      if (guardApplied) {
        res.setHeader("X-Attribution-Ledger-Guard", summaryOnly ? "summary-only" : "limit-capped");
      }

      const withinRange = (entry: AttributionLedgerEntry) => {
        if (!hasStartFilter && !hasEndFilter) return true;
        const loggedMs = Date.parse(entry.loggedAt);
        if (!Number.isFinite(loggedMs)) return true;
        if (hasStartFilter && loggedMs < startMs) return false;
        if (hasEndFilter && loggedMs > endMs) return false;
        return true;
      };

      const base = (source || captureMode)
        ? filterLedgerEntries(allEntries, {
            source: source || undefined,
            captureMode: captureMode || undefined,
          })
        : allEntries;
      const filtered = (hasStartFilter || hasEndFilter) ? base.filter(withinRange) : base;

      res.json({
        ok: true,
        filters: {
          source: source || null,
          captureMode: captureMode || null,
          startAt: startAt || null,
          endAt: endAt || null,
          requestedLimit,
          limit: effectiveLimit,
          summaryOnly,
          rangeDays,
        },
        summary: buildLedgerSummary(filtered),
        allEntriesSummary: (source || captureMode || hasStartFilter || hasEndFilter) ? buildLedgerSummary(allEntries) : undefined,
        items: effectiveLimit > 0 ? filtered.slice(0, effectiveLimit) : [],
        guard: {
          applied: guardApplied,
          trustedInternalCaller,
          publicMaxLimit,
          rateLimitPerWindow: trustedInternalCaller ? null : ATTRIBUTION_LEDGER_PUBLIC_RATE_LIMIT,
          rateLimitWindowMs: trustedInternalCaller ? null : ATTRIBUTION_LEDGER_RATE_WINDOW_MS,
          note: guardApplied
            ? "Large public item responses are capped. Use summaryOnly=true or aggregate endpoints for dashboards."
            : "No ledger guard cap was applied.",
        },
        codebaseDiscovery: {
          successHandlerFoundInWorkspace: false,
          note:
            "현재 workspace에는 기존 PG successUrl/server callback 구현이 보이지 않아, 이 API를 표준 수신 엔드포인트로 추가했다.",
          canonicalReceivers: [
            "POST /api/attribution/checkout-context",
            "POST /api/attribution/payment-page-seen",
            "POST /api/attribution/payment-success",
            "POST /api/attribution/replay/toss",
          ],
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "attribution ledger read failed";
      res.status(500).json({ ok: false, error: "attribution_ledger_read_error", message });
    }
  });

  router.get("/api/attribution/cohort-ltr", async (req: Request, res: Response) => {
    try {
      const startAt = readOne(req.query.startAt);
      const endAt = readOne(req.query.endAt);
      const channelQuery = (readOne(req.query.channel) ?? "").trim();
      const channels = parseAcquisitionChannelFilter(channelQuery);
      const forceRefresh = req.query.force === "true" || req.query.force === "1";
      const dataSourceRaw = typeof req.query.dataSource === "string" ? req.query.dataSource : "";

      // Option B: precompute cache lookup (channel 필터 없음 + dataSource=vm 만 hit)
      if (!forceRefresh && channelQuery.length === 0 && (dataSourceRaw === "vm" || dataSourceRaw === "")) {
        const cached = getPrecomputedAcquisition({
          endpoint: "cohort-ltr",
          startAt: startAt ?? "",
          endAt: endAt ?? "",
          dataSource: "operational_vm_ledger",
          channels: null,
        });
        if (cached) {
          res.json({ ...(cached.entry.result as object), cache: cached.meta });
          return;
        }
      }

      const cohortLedger = await resolveAcquisitionCohortLedger(req.query.dataSource);
      const builtAt = Date.now();
      const report = buildAttributionCohortLtrReport({
        startAt,
        endAt,
        channels,
        ledgerEntries: cohortLedger.ledgerEntries,
      });

      res.json({
        ok: true,
        dataSource: cohortLedger.dataSource,
        remoteWarnings: cohortLedger.remoteWarnings,
        ...report,
        cache: {
          cached: false,
          cached_at_kst: null,
          next_refresh_at_kst: null,
          generation_ms: Date.now() - builtAt,
          staleness_ms: 0,
          source: forceRefresh ? "live_force_refresh" : "live_cache_miss",
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "attribution cohort LTR failed";
      if (error instanceof CohortValidationError) {
        res.status(400).json({ ok: false, error: "validation_error", message });
        return;
      }
      res.status(500).json({ ok: false, error: "attribution_cohort_ltr_error", message });
    }
  });

  router.get("/api/attribution/channel-category-repeat", async (req: Request, res: Response) => {
    try {
      const startAt = readOne(req.query.startAt);
      const endAt = readOne(req.query.endAt);
      const forceRefresh = req.query.force === "true" || req.query.force === "1";
      const dataSourceRaw = typeof req.query.dataSource === "string" ? req.query.dataSource : "";

      if (!forceRefresh && (dataSourceRaw === "vm" || dataSourceRaw === "")) {
        const cached = getPrecomputedAcquisition({
          endpoint: "channel-category-repeat",
          startAt: startAt ?? "",
          endAt: endAt ?? "",
          dataSource: "operational_vm_ledger",
        });
        if (cached) {
          res.json({ ...(cached.entry.result as object), cache: cached.meta });
          return;
        }
      }

      const cohortLedger = await resolveAcquisitionCohortLedger(req.query.dataSource);
      const builtAt = Date.now();
      const report = buildChannelCategoryRepeatReport({
        startAt,
        endAt,
        ledgerEntries: cohortLedger.ledgerEntries,
      });

      res.json({
        ok: true,
        dataSource: cohortLedger.dataSource,
        remoteWarnings: cohortLedger.remoteWarnings,
        ...report,
        cache: {
          cached: false,
          cached_at_kst: null,
          next_refresh_at_kst: null,
          generation_ms: Date.now() - builtAt,
          staleness_ms: 0,
          source: forceRefresh ? "live_force_refresh" : "live_cache_miss",
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "channel category repeat failed";
      if (error instanceof CohortValidationError) {
        res.status(400).json({ ok: false, error: "validation_error", message });
        return;
      }
      res.status(500).json({ ok: false, error: "attribution_channel_category_repeat_error", message });
    }
  });

  router.get("/api/attribution/reverse-funnel", async (req: Request, res: Response) => {
    try {
      const startAt = readOne(req.query.startAt);
      const endAt = readOne(req.query.endAt);
      const forceRefresh = req.query.force === "true" || req.query.force === "1";
      const dataSourceRaw = typeof req.query.dataSource === "string" ? req.query.dataSource : "";

      if (!forceRefresh && (dataSourceRaw === "vm" || dataSourceRaw === "")) {
        const cached = getPrecomputedAcquisition({
          endpoint: "reverse-funnel",
          startAt: startAt ?? "",
          endAt: endAt ?? "",
          dataSource: "operational_vm_ledger",
        });
        if (cached) {
          res.json({ ...(cached.entry.result as object), cache: cached.meta });
          return;
        }
      }

      const cohortLedger = await resolveAcquisitionCohortLedger(req.query.dataSource);
      const builtAt = Date.now();
      const report = buildReverseFunnelReport({
        startAt,
        endAt,
        ledgerEntries: cohortLedger.ledgerEntries,
      });

      res.json({
        ok: true,
        dataSource: cohortLedger.dataSource,
        remoteWarnings: cohortLedger.remoteWarnings,
        ...report,
        cache: {
          cached: false,
          cached_at_kst: null,
          next_refresh_at_kst: null,
          generation_ms: Date.now() - builtAt,
          staleness_ms: 0,
          source: forceRefresh ? "live_force_refresh" : "live_cache_miss",
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "reverse funnel failed";
      if (error instanceof CohortValidationError) {
        res.status(400).json({ ok: false, error: "validation_error", message });
        return;
      }
      res.status(500).json({ ok: false, error: "attribution_reverse_funnel_error", message });
    }
  });

  router.get("/api/attribution/identity-diagnostics", async (req: Request, res: Response) => {
    try {
      const useRemoteLedger = shouldUseRemoteAcquisitionLedger(req.query.dataSource);
      if (!useRemoteLedger) {
        res.json({
          ok: true,
          dataSource: "local",
          generatedAt: new Date().toISOString(),
          identity: { total: 0, filled: 0, empty: 0, bySource: { vm_native: 0, imweb_order_lookup: 0, ga_session_link: 0, ga_session_synthetic: 0, empty: 0 } },
          note: "로컬 원장은 수신 시 customerKey를 이미 정규화 phone 으로 채운다. 이 엔드포인트는 VM 원장(dataSource=vm) 진단용이다.",
        });
        return;
      }
      const remote = await fetchRemoteLedgerEntriesForAcquisition();
      const { identity } = remote;
      const fillRate = identity.total > 0 ? +(identity.filled / identity.total * 100).toFixed(1) : 0;
      const joinableRate = identity.total > 0
        ? +((identity.bySource.vm_native + identity.bySource.imweb_order_lookup + identity.bySource.ga_session_link) / identity.total * 100).toFixed(1)
        : 0;
      const touchpointByEmpty: Record<string, number> = {};
      for (const entry of remote.entries) {
        if (entry.customerKey) continue;
        touchpointByEmpty[entry.touchpoint] = (touchpointByEmpty[entry.touchpoint] ?? 0) + 1;
      }
      res.json({
        ok: true,
        dataSource: "operational_vm_ledger",
        generatedAt: new Date().toISOString(),
        identity,
        fillRatePercent: fillRate,
        joinableRatePercent: joinableRate,
        emptyRowsByTouchpoint: touchpointByEmpty,
        remoteWarnings: remote.warnings,
        note: "joinable = VM native + imweb order lookup + ga session link. ga_session_synthetic 은 customerKey는 채워졌지만 imweb_orders 와 직접 조인되지 않는다.",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ ok: false, error: "attribution_identity_diagnostics_error", message });
    }
  });

  router.get("/api/attribution/diagnostics/item-coverage", async (req: Request, res: Response) => {
    try {
      const sampleLimit = parsePositiveInt(req.query.sampleLimit, 50, 500);
      const site = typeof req.query.site === "string" ? req.query.site.trim() : "";

      const db = getCrmDb();

      const itemTable = db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
        .get("imweb_order_items") as { name: string } | undefined;

      let itemTableRowCount: number | null = null;
      let itemTableColumns: string[] = [];
      if (itemTable) {
        itemTableRowCount = (db.prepare("SELECT COUNT(*) AS n FROM imweb_order_items").get() as { n: number }).n;
        itemTableColumns = (db.prepare("PRAGMA table_info(imweb_order_items)").all() as Array<{ name: string }>).map((c) => c.name);
      }

      const orderFilters: string[] = [];
      const orderParams: unknown[] = [];
      if (site) {
        orderFilters.push("site = ?");
        orderParams.push(site);
      }
      const whereClause = orderFilters.length ? `WHERE ${orderFilters.join(" AND ")}` : "";

      const orderTotals = db
        .prepare(
          `SELECT
             COUNT(*) AS n,
             SUM(CASE WHEN raw_json IS NOT NULL AND TRIM(raw_json) <> '' AND TRIM(raw_json) <> '{}' THEN 1 ELSE 0 END) AS with_raw,
             SUM(CASE WHEN site = 'biocom' THEN 1 ELSE 0 END) AS biocom,
             SUM(CASE WHEN site = 'thecleancoffee' THEN 1 ELSE 0 END) AS thecleancoffee,
             SUM(CASE WHEN site = 'aibio' THEN 1 ELSE 0 END) AS aibio,
             MIN(order_time) AS earliest,
             MAX(order_time) AS latest
           FROM imweb_orders ${whereClause}`,
        )
        .get(...orderParams) as {
        n: number;
        with_raw: number;
        biocom: number;
        thecleancoffee: number;
        aibio: number;
        earliest: string | null;
        latest: string | null;
      };

      const sampleRows = db
        .prepare(
          `SELECT order_key, site, order_no, order_time, raw_json
           FROM imweb_orders ${whereClause}
           ORDER BY order_time DESC
           LIMIT ?`,
        )
        .all(...orderParams, sampleLimit) as Array<{
        order_key: string;
        site: string;
        order_no: string;
        order_time: string | null;
        raw_json: string | null;
      }>;

      let rawJsonYieldsItems = 0;
      let rawJsonYieldsZero = 0;
      let rawJsonUnparseable = 0;
      const categoryDist: Record<string, number> = { test_kit: 0, supplement: 0, other: 0 };
      const sampleDetail: Array<{
        order_key: string;
        site: string;
        order_no: string;
        order_time: string | null;
        item_count_from_raw: number;
        sample_item_names: string[];
        inferred_category: string;
      }> = [];

      for (const row of sampleRows) {
        let names: string[] = [];
        try {
          names = extractItemNamesFromRawJson(row.raw_json);
        } catch {
          rawJsonUnparseable += 1;
          continue;
        }
        if (names.length > 0) {
          rawJsonYieldsItems += 1;
          let category: FirstPurchaseCategory = "other";
          for (const name of names) {
            const c = categorizeProductName(name);
            if (c === "test_kit") { category = "test_kit"; break; }
            if (c === "supplement" && category === "other") category = "supplement";
          }
          categoryDist[category] = (categoryDist[category] ?? 0) + 1;
        } else {
          rawJsonYieldsZero += 1;
          categoryDist.other += 1;
        }
        if (sampleDetail.length < 10) {
          sampleDetail.push({
            order_key: row.order_key,
            site: row.site,
            order_no: row.order_no,
            order_time: row.order_time,
            item_count_from_raw: names.length,
            sample_item_names: names.slice(0, 3),
            inferred_category:
              names.length === 0
                ? "other"
                : names.reduce<FirstPurchaseCategory>((acc, name) => {
                  const c = categorizeProductName(name);
                  if (c === "test_kit") return "test_kit";
                  if (c === "supplement" && acc === "other") return "supplement";
                  return acc;
                }, "other"),
          });
        }
      }

      const sampleSize = sampleRows.length;
      const rawJsonYieldRate = sampleSize > 0 ? +(rawJsonYieldsItems / sampleSize * 100).toFixed(1) : 0;

      const verdict = (() => {
        if (!itemTable && rawJsonYieldRate >= 80) {
          return "imweb_order_items 테이블은 없지만 imweb_orders.raw_json 경로가 정상 작동. 카테고리 분류가 실패하는 이유는 다른 경로(예: Sprint6 cohort 내 row 필터) 문제일 가능성.";
        }
        if (!itemTable && rawJsonYieldRate < 20) {
          return "imweb_order_items 테이블 없음 + raw_json에서도 item 이름 추출 실패. 주문 동기화 때 item 정보가 raw_json에 포함되지 않음. 동기화 로직 수정 또는 items 테이블 생성·적재 필요.";
        }
        if (itemTable && (itemTableRowCount ?? 0) === 0) {
          return "imweb_order_items 테이블은 있지만 비어 있음. 적재 잡이 한 번도 실행되지 않았거나 실패. 일회성 backfill 필요.";
        }
        if (itemTable && (itemTableRowCount ?? 0) > 0) {
          return "imweb_order_items 테이블 정상 적재. 카테고리 분류가 실패하면 join 키(order_key/order_no) 불일치 또는 item_name 컬럼 매핑 문제일 가능성.";
        }
        return "조건 판정 불명확 — 원본 숫자 참조.";
      })();

      res.json({
        ok: true,
        generatedAt: new Date().toISOString(),
        filters: { site: site || null, sampleLimit },
        imwebOrderItems: {
          tableExists: Boolean(itemTable),
          rowCount: itemTableRowCount,
          columns: itemTableColumns,
        },
        imwebOrders: {
          total: orderTotals.n,
          withRawJson: orderTotals.with_raw,
          rawJsonCoverageRate: orderTotals.n > 0 ? +(orderTotals.with_raw / orderTotals.n * 100).toFixed(1) : 0,
          bySite: {
            biocom: orderTotals.biocom,
            thecleancoffee: orderTotals.thecleancoffee,
            aibio: orderTotals.aibio,
          },
          earliestOrderTime: orderTotals.earliest,
          latestOrderTime: orderTotals.latest,
        },
        rawJsonParseSample: {
          size: sampleSize,
          yieldedItemNames: rawJsonYieldsItems,
          yieldedZero: rawJsonYieldsZero,
          unparseable: rawJsonUnparseable,
          yieldRatePercent: rawJsonYieldRate,
          categoryDistribution: categoryDist,
        },
        sampleDetail,
        verdict,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ ok: false, error: "attribution_item_coverage_diagnostics_error", message });
    }
  });

  router.get("/api/attribution/acquisition-summary", async (req: Request, res: Response) => {
    try {
      const rangeDays = parsePositiveInt(req.query.rangeDays, 30, 365);
      const useRemoteLedger = shouldUseRemoteAcquisitionLedger(req.query.dataSource);
      const remoteWarnings: string[] = [];
      let allEntries = await readLedgerEntries();
      let dataSource = "local_ledger";

      if (useRemoteLedger) {
        const remoteLedger = await fetchRemoteLedgerEntriesForAcquisition();
        remoteWarnings.push(...remoteLedger.warnings);
        if (remoteLedger.entries.length > 0) {
          allEntries = remoteLedger.entries;
          dataSource = "operational_vm_ledger";
        } else {
          remoteWarnings.push("VM Cloud 원장 row를 가져오지 못해 로컬 원장으로 fallback했다.");
        }
      }

      const report = buildAcquisitionSummaryReport(allEntries, { rangeDays });

      res.json({
        ok: true,
        dataSource,
        remoteWarnings,
        ...report,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "acquisition summary failed";
      res.status(500).json({ ok: false, error: "attribution_acquisition_summary_error", message });
    }
  });

  router.get("/api/attribution/caller-coverage", async (req: Request, res: Response) => {
    try {
      const allEntries = await readLedgerEntries();
      const source = typeof req.query.source === "string" ? req.query.source.trim() : "";
      const paymentLimit = parsePositiveInt(req.query.paymentLimit, 20, 100);
      const checkoutLimit = parsePositiveInt(req.query.checkoutLimit, 10, 100);

      // 사용자 지정 KST 날짜 범위 — loggedAt 필터.
      const rawStartDate = typeof req.query.start_date === "string" ? req.query.start_date.trim() : "";
      const rawEndDate = typeof req.query.end_date === "string" ? req.query.end_date.trim() : "";
      const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
      let sinceMs: number | null = null;
      let untilMs: number | null = null;
      if (rawStartDate || rawEndDate) {
        if (!ISO_DATE_RE.test(rawStartDate) || !ISO_DATE_RE.test(rawEndDate)) {
          res.status(400).json({ ok: false, error: "start_date/end_date 는 둘 다 YYYY-MM-DD 형식이어야 함" });
          return;
        }
        if (rawStartDate > rawEndDate) {
          res.status(400).json({ ok: false, error: "start_date 는 end_date 보다 늦을 수 없음" });
          return;
        }
        sinceMs = Date.parse(`${rawStartDate}T00:00:00+09:00`);
        untilMs = Date.parse(`${rawEndDate}T23:59:59.999+09:00`);
      }

      const sourceFiltered = source
        ? filterLedgerEntries(allEntries, { source })
        : allEntries;
      const filtered = sinceMs !== null && untilMs !== null
        ? sourceFiltered.filter((entry) => {
            if (!entry.loggedAt) return false;
            const ts = Date.parse(entry.loggedAt);
            if (!Number.isFinite(ts)) return false;
            return ts >= sinceMs! && ts <= untilMs!;
          })
        : sourceFiltered;

      res.json({
        ok: true,
        filters: {
          source: source || null,
          start_date: rawStartDate || null,
          end_date: rawEndDate || null,
        },
        report: buildAttributionCallerCoverageReport(filtered, { paymentLimit, checkoutLimit }),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "attribution caller coverage failed";
      res.status(500).json({ ok: false, error: message });
    }
  });

  router.get("/api/attribution/toss-join", async (req: Request, res: Response) => {
    try {
      const limit = parsePositiveInt(req.query.limit, 100, 500);
      const startDate = typeof req.query.startDate === "string" ? req.query.startDate.trim() : "";
      const endDate = typeof req.query.endDate === "string" ? req.query.endDate.trim() : "";
      const entries = await readLedgerEntries();
      const tossRows = await fetchTossRows(startDate, endDate, limit);
      const report = buildTossJoinReport(entries, tossRows, limit);

      res.json({
        ok: true,
        filters: { startDate, endDate, limit },
        report,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "toss attribution join failed";
      res.status(500).json({ ok: false, error: "attribution_toss_join_error", message });
    }
  });

  router.post("/api/attribution/replay/toss", async (req: Request, res: Response) => {
    try {
      const startDate =
        typeof req.body?.startDate === "string"
          ? req.body.startDate.trim()
          : typeof req.query.startDate === "string"
            ? req.query.startDate.trim()
            : "";
      const endDate =
        typeof req.body?.endDate === "string"
          ? req.body.endDate.trim()
          : typeof req.query.endDate === "string"
            ? req.query.endDate.trim()
            : "";
      const limit = parsePositiveInt(
        typeof req.body?.limit === "number" ? String(req.body.limit) : req.query.limit,
        100,
        500,
      );
      const dryRun = parseBooleanish(req.body?.dryRun ?? req.query.dryRun, true);

      const [entries, tossRows] = await Promise.all([
        readLedgerEntries(),
        fetchTossRows(startDate, endDate, limit),
      ]);
      const replayPlan = buildTossReplayPlan(entries, tossRows, limit);

      if (!dryRun) {
        for (const entry of replayPlan.insertableEntries) {
          await appendLedgerEntry(entry);
        }
      }

      res.json({
        ok: true,
        dryRun,
        filters: { startDate, endDate, limit },
        summary: {
          ...replayPlan.summary,
          writtenRows: dryRun ? 0 : replayPlan.insertableEntries.length,
        },
        samples: {
          insertableEntries: replayPlan.insertableEntries.slice(0, 5),
          skippedRows: replayPlan.skippedRows.slice(0, 5),
        },
        notes: [
          "이 endpoint는 read-only 운영DB의 tb_sales_toss를 읽어 replay용 payment_success row를 만든다.",
          "dryRun=true면 파일에 쓰지 않고 preview만 반환한다.",
          "replay row는 live 원인 확정용이 아니라 조인 plumbing 점검용이다.",
        ],
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "toss replay failed";
      res.status(500).json({ ok: false, error: "attribution_toss_replay_error", message });
    }
  });

  router.post("/api/attribution/sync-status/toss", async (req: Request, res: Response) => {
    try {
      const limit = parsePositiveInt(
        typeof req.body?.limit === "number" ? String(req.body.limit) : req.query.limit,
        100,
        500,
      );
      const dryRun = parseBooleanish(req.body?.dryRun ?? req.query.dryRun, true);
      const rawOrderIds: unknown[] = Array.isArray(req.body?.orderIds)
        ? req.body.orderIds
        : typeof req.query.orderIds === "string"
          ? req.query.orderIds.split(",")
          : [];
      const orderIds = rawOrderIds
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter(Boolean)
        .slice(0, 500);
      const result = await syncAttributionPaymentStatusesFromToss({ limit, dryRun, orderIds });

      res.json({
        ok: true,
        dryRun,
        filters: {
          limit,
          orderIds: orderIds.length,
        },
        summary: {
          totalCandidates: result.totalCandidates,
          matchedRows: result.matchedRows,
          updatedRows: result.updatedRows,
          writtenRows: result.writtenRows,
          skippedNoMatchRows: result.skippedNoMatchRows,
          skippedPendingRows: result.skippedPendingRows,
          directFallbackRows: result.directFallbackRows,
          imwebOverdueRows: result.imwebOverdueRows,
          directFallbackErrors: result.directFallbackErrors.length,
        },
        items: result.items.slice(0, 20),
        directFallbackErrors: result.directFallbackErrors.slice(0, 20),
        notes: [
          "pending payment_success row를 tb_sales_toss 상태와 대조해 confirmed/canceled로 승격한다.",
          "tb_sales_toss에 아직 없지만 paymentKey/orderId가 있는 최신 pending row는 Toss 직접 결제 상세 API fallback으로 확인한다.",
          "가상계좌 24시간 미입금 자동취소는 tb_iamweb_users PAYMENT_OVERDUE 보조 판정으로 canceled/vbank_expired 승격 후보에 포함한다.",
          "dryRun=true면 preview만 보고 SQLite ledger는 갱신하지 않는다.",
          "status가 아직 WAITING/PENDING이면 유지하고 다음 배치에서 다시 확인한다.",
        ],
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "toss status sync failed";
      res.status(500).json({ ok: false, error: "attribution_toss_status_sync_error", message });
    }
  });

  router.post("/api/attribution/sync-status/operational-payment-complete", async (req: Request, res: Response) => {
    try {
      const limit = parsePositiveInt(
        typeof req.body?.limit === "number" ? String(req.body.limit) : req.query.limit,
        100,
        500,
      );
      const dryRun = parseBooleanish(req.body?.dryRun ?? req.query.dryRun, true);
      const loggedAtGte = typeof req.body?.loggedAtGte === "string"
        ? req.body.loggedAtGte.trim()
        : typeof req.query.loggedAtGte === "string"
          ? req.query.loggedAtGte.trim()
          : "";
      const rawOrderIds: unknown[] = Array.isArray(req.body?.orderIds)
        ? req.body.orderIds
        : typeof req.query.orderIds === "string"
          ? req.query.orderIds.split(",")
          : [];
      const orderIds = rawOrderIds
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter(Boolean)
        .slice(0, 500);
      const result = await syncAttributionPaymentStatusesFromOperationalPaymentComplete({ limit, dryRun, orderIds, loggedAtGte });

      res.json({
        ok: true,
        dryRun,
        filters: {
          limit,
          orderIds: orderIds.length,
          loggedAtGte,
        },
        source: result.source,
        summary: {
          totalCandidates: result.totalCandidates,
          scopedCandidates: result.scopedCandidates,
          matchedRows: result.matchedRows,
          updatedRows: result.updatedRows,
          writtenRows: result.writtenRows,
          confirmedAmountKrw: result.confirmedAmountKrw,
          excludedRows: result.excludedRows,
          excludedAmountKrw: result.excludedAmountKrw,
          noSendGateRows: result.noSendGateRows,
          metaCapiSendCandidateCount: 0,
          duplicateEventIdSendRiskRows: 0,
        },
        exclusionsByReason: result.exclusionsByReason,
        matchTypes: result.matchTypes,
        paymentMethods: result.paymentMethods,
        itemReasonCounts: result.items.reduce<Record<string, number>>((acc, item) => {
          acc[item.reason] = (acc[item.reason] ?? 0) + 1;
          return acc;
        }, {}),
        notes: result.notes,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "operational payment complete bridge failed";
      res.status(500).json({ ok: false, error: "attribution_operational_payment_complete_bridge_error", message });
    }
  });

  router.post("/api/attribution/imweb-status-fallback/dry-run", async (req: Request, res: Response) => {
    try {
      const limit = parsePositiveInt(
        typeof req.body?.limit === "number" ? String(req.body.limit) : req.query.limit,
        100,
        500,
      );
      const maxPagesPerStatus = parsePositiveInt(
        typeof req.body?.maxPagesPerStatus === "number"
          ? String(req.body.maxPagesPerStatus)
          : req.query.maxPagesPerStatus,
        5,
        20,
      );
      const loggedAtGte = typeof req.body?.loggedAtGte === "string"
        ? req.body.loggedAtGte.trim()
        : typeof req.query.loggedAtGte === "string"
          ? req.query.loggedAtGte.trim()
          : "";
      const result = await runBiocomImwebApiStatusFallbackDryRun({ limit, maxPagesPerStatus, loggedAtGte });
      res.json({
        ok: true,
        dryRun: true,
        filters: { limit, maxPagesPerStatus, loggedAtGte },
        source: {
          primary: "Imweb v2 API direct status read-only",
          cache: "VM Cloud SQLite imweb_orders",
          target: "VM Cloud SQLite attribution_ledger pending payment_success aggregate",
        },
        targetRows: result.targetRows,
        vmCloudCache: result.vmCloudCache,
        summary: result.summary,
        statusCounts: result.statusCounts,
        errors: result.errors,
        notes: result.notes,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "imweb status fallback dry-run failed";
      res.status(500).json({ ok: false, error: "attribution_imweb_status_fallback_dry_run_error", message });
    }
  });

  router.get("/api/attribution/hourly-compare", async (req: Request, res: Response) => {
    try {
      const date = resolveKstDate(req.query.date);
      const entries = await readLedgerEntries();
      const tossHourlyRows = await fetchTossHourlyRows(date);
      const items = buildAttributionHourlyCompare({
        date,
        ledgerEntries: entries,
        tossHourlyRows,
      });
      const receiverGapHours = items.filter(
        (item) => item.tossApprovalCount > 0 && item.paymentSuccessEntries === 0,
      ).length;

      res.json({
        ok: true,
        date,
        summary: {
          hours: items.length,
          tossApprovalCount: items.reduce((acc, item) => acc + item.tossApprovalCount, 0),
          paymentSuccessEntries: items.reduce((acc, item) => acc + item.paymentSuccessEntries, 0),
          checkoutEntries: items.reduce((acc, item) => acc + item.checkoutEntries, 0),
          receiverGapHours,
        },
        items,
        notes: [
          "시간대 기준은 Asia/Seoul(KST)로 맞췄다.",
          "이 리포트는 토스 승인 vs receiver row의 시간대 격차를 먼저 보는 초안이다.",
          "GA4 DebugView 검증 전, 어느 시간대에 receiver가 비는지 확인하는 용도로 쓴다.",
        ],
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "hourly attribution compare failed";
      res.status(500).json({ ok: false, error: "attribution_hourly_compare_error", message });
    }
  });

  // gpt0508-42 작업3: site_landing summary read-only API
  router.get("/api/attribution/site-landing/summary", async (req: Request, res: Response) => {
    try {
      const windowHoursRaw = req.query.windowHours;
      const windowHours = Math.max(
        1,
        Math.min(
          Number.isFinite(Number(windowHoursRaw)) ? Number(windowHoursRaw) : 24,
          720,
        ),
      );
      const siteRaw = typeof req.query.site === "string" ? req.query.site : "biocom";
      const site: SiteKey = siteRaw === "thecleancoffee" ? "thecleancoffee" : "biocom";
      const actual = await fetchNpayActualConfirmedSiteLandingSummary({ site, windowDays: 30 }).catch(
        (): NpayActualConfirmedSiteLandingSummary => ({
          ok: false,
          site,
          windowDays: 30,
          source: "unavailable" as const,
          status: "unavailable" as const,
          completeCount: 0,
          completeAmountKrw: 0,
          completeAmountKrwKorean: "₩0",
          maxPaymentCompleteTime: null,
          maxOrderDate: null,
          reason: "운영DB read-only actual confirmed 조회 실패. complete_time legacy는 actual purchase로 쓰지 않는다.",
          warnings: ["operational_db_read_failed"],
        }),
      );
      const summary = summarizeSiteLanding(site, windowHours, {
        npayActualConfirmed30d: {
          source: actual.source,
          status: actual.status,
          complete_count: actual.completeCount,
          complete_amount_krw: actual.completeAmountKrw,
          complete_amount_krw_korean: actual.completeAmountKrwKorean,
          max_payment_complete_time: actual.maxPaymentCompleteTime,
          max_order_date: actual.maxOrderDate,
          reason: actual.reason,
          warnings: actual.warnings,
          gross_count: actual.grossCount,
          gross_amount_krw: actual.grossAmountKrw,
          gross_amount_krw_korean: actual.grossAmountKrwKorean,
          excluded_cancel_return_exchange_count:
            actual.excludedCancelReturnExchangeCount,
          excluded_cancel_return_exchange_amount_krw:
            actual.excludedCancelReturnExchangeAmountKrw,
          excluded_cancel_return_exchange_amount_krw_korean:
            actual.excludedCancelReturnExchangeAmountKrwKorean,
          confirmed_status_count: actual.confirmedStatusCount,
          confirmed_status_amount_krw: actual.confirmedStatusAmountKrw,
          confirmed_status_amount_krw_korean: actual.confirmedStatusAmountKrwKorean,
          status_blank_count: actual.statusBlankCount,
          status_blank_amount_krw: actual.statusBlankAmountKrw,
          status_blank_amount_krw_korean: actual.statusBlankAmountKrwKorean,
          max_order_time: actual.maxOrderTime,
          max_synced_at: actual.maxSyncedAt,
          max_status_synced_at: actual.maxStatusSyncedAt,
          ga4_guard_role: actual.ga4GuardRole,
        },
      });
      res.json({
        ok: true,
        mode: "read_only_no_send",
        window_hours: windowHours,
        site,
        ...summary,
        invariants_held: {
          external_send_count: 0,
          upload_candidate_count: 0,
          gtm_publish: 0,
          imweb_footer_edit: 0,
          operational_db_write: 0,
          raw_email_phone_member_payment_order_in_response: false,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "site_landing summary failed";
      res.status(500).json({ ok: false, error: "site_landing_summary_error", message });
    }
  });

  // gpt0508-41: site_landing_ledger receiver (L1/L2 attribution ladder, no-send, internal write only)
  router.post("/api/attribution/site-landing", (req: Request, res: Response) => {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const get = (k: string): string => {
        const v = body[k];
        return typeof v === "string" ? v : "";
      };
      const utm = (body.utm ?? {}) as Record<string, unknown>;
      const sessionKey = (body.sessionKey ?? {}) as Record<string, unknown>;
      const clickIdInput = (body.clickId ?? null) as Record<string, unknown> | null;

      const landingUrl = get("landingUrl");
      const referrerFullUrl = get("referrerFullUrl");
      const referrerHost = get("referrerHost");
      const landedAt = get("landedAt") || new Date().toISOString();

      if (!landingUrl) {
        res.status(400).json({ ok: false, error: "missing_landing_url" });
        return;
      }

      // gpt0508-45 정정: landing URL 의 host 로 site 자동 감지.
      const detectedSite: SiteKey = detectSiteFromUrl(landingUrl) ?? "biocom";

      const classification = classifySiteLandingChannel({
        referrerHost,
        referrerFullUrl,
        utm: {
          source: typeof utm.source === "string" ? utm.source : "",
          medium: typeof utm.medium === "string" ? utm.medium : "",
          campaign: typeof utm.campaign === "string" ? utm.campaign : "",
        },
        clickIdType:
          clickIdInput && typeof clickIdInput.type === "string" ? clickIdInput.type : "",
        site: detectedSite,
      });

      const result = recordSiteLanding({
        site: detectedSite,
        landedAt,
        receivedAt: new Date().toISOString(),
        referrerHost,
        referrerFullUrl,
        landingUrl,
        landingPath: get("landingPath"),
        utm: {
          source: typeof utm.source === "string" ? utm.source : "",
          medium: typeof utm.medium === "string" ? utm.medium : "",
          campaign: typeof utm.campaign === "string" ? utm.campaign : "",
          term: typeof utm.term === "string" ? utm.term : "",
          content: typeof utm.content === "string" ? utm.content : "",
        },
        clickId: clickIdInput && typeof clickIdInput.type === "string" && typeof clickIdInput.valueOrHash === "string"
          ? {
              type: clickIdInput.type,
              valueOrHash: clickIdInput.valueOrHash,
              storageMode: (clickIdInput.storageMode === "hash" || clickIdInput.storageMode === "raw")
                ? (clickIdInput.storageMode as "hash" | "raw")
                : "none",
            }
          : undefined,
        sessionKey: {
          gaSessionId: typeof sessionKey.gaSessionId === "string" ? sessionKey.gaSessionId : "",
          clientId: typeof sessionKey.clientId === "string" ? sessionKey.clientId : "",
          localSessionIdHash:
            typeof sessionKey.localSessionIdHash === "string" ? sessionKey.localSessionIdHash : "",
        },
        channelClassified: classification.channel as SiteLandingChannelClassified,
        sourceBreakdown: classification.source_breakdown,
      });

      if (!result.stored) {
        res.status(400).json({ ok: false, rejected: true, reason: result.reason });
        return;
      }

      res.json({
        ok: true,
        mode: "no_send_internal_write_only",
        deduped: result.deduped,
        landing_id_prefix: result.row.landingId.slice(0, 12),
        channel_classified: result.row.channelClassified,
        source_breakdown: result.row.sourceBreakdown,
        click_id_storage_mode: result.row.clickId.storageMode,
        is_self_domain: result.row.isSelfDomain,
        invariants_held: {
          send_candidate: false,
          actual_send_candidate: false,
          upload_candidate: 0,
          external_platform_send: 0,
          operational_db_write: 0,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "site_landing receiver failed";
      res.status(500).json({ ok: false, error: "site_landing_receiver_error", message });
    }
  });

  // 선행지표 에이전트 P1: read-only aggregate endpoint. raw identifier 노출 금지.
  // P1 skeleton 은 precompute cache hit 우선, cache miss/force 는 30d 이내 ledger range 로 live fallback.
  router.get("/api/attribution/leading-indicators", async (req: Request, res: Response) => {
    try {
      const parsed = parseLeadingIndicatorsQuery({
        site: req.query.site,
        window: req.query.window,
        channel: req.query.channel,
        dimension: req.query.dimension,
        freshness: req.query.freshness,
        force: req.query.force,
      });

      if (parsed.freshness !== "force") {
        const cached = getPrecomputedLeadingIndicators({
          site: parsed.site,
          window: parsed.window,
          channel: parsed.channel,
          dimension: parsed.dimension,
        });
        if (cached) {
          res.json({
            ...cached.entry.result,
            cache: cached.meta,
          });
          return;
        }
      }

      const nowMs = Date.now();
      const maxWindowHours = Math.max(...Object.values(LEADING_INDICATOR_WINDOW_HOURS));
      const ledgerEntries = await readLedgerEntriesInRange({
        loggedAtFromIso: new Date(nowMs - (maxWindowHours + 24) * 60 * 60 * 1000).toISOString(),
      });
      const builtAtMs = Date.now();
      const result = buildLeadingIndicatorsReport({
        ledgerEntries,
        site: parsed.site,
        window: parsed.window,
        channel: parsed.channel,
        dimension: parsed.dimension,
        asOfMs: nowMs,
      });

      res.json({
        ...result,
        cache: {
          cached: false,
          cached_at_kst: null,
          next_refresh_at_kst: null,
          generation_ms: Date.now() - builtAtMs,
          staleness_ms: 0,
          source: parsed.freshness === "force" ? "live_force_refresh" : "live_cache_miss",
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "leading indicators build failed";
      const status = error instanceof LeadingIndicatorsValidationError ? 400 : 500;
      res.status(status).json({ ok: false, error: "leading_indicators_error", message });
    }
  });

  // 전환 퍼널 관제 (gpt0515-17): read-only aggregate. raw identifier 노출 금지.
  // Option B (gpt0516): precompute cache lookup → cache hit 면 즉시 반환 (< 50ms).
  //                     ?force=true 또는 cache miss 면 실시간 계산 fallback.
  router.get("/api/attribution/funnel-health", async (req: Request, res: Response) => {
    try {
      const parsed = parseFunnelHealthQuery({
        site: req.query.site,
        window: req.query.window,
        granularity: req.query.granularity,
        paymentMethod: req.query.paymentMethod,
        source: req.query.source,
      });
      const forceRefresh =
        req.query.force === "true" || req.query.force === "1" || req.query.force === "yes";

      // 1) precompute cache lookup (force=true 면 skip)
      if (!forceRefresh) {
        const cached = getPrecomputedFunnelHealth({
          site: parsed.site,
          window: parsed.window,
          granularity: parsed.granularity,
          paymentMethod: parsed.paymentMethod,
          source: parsed.source,
        });
        if (cached) {
          res.json({
            ...cached.entry.result,
            cache: cached.meta,
          });
          return;
        }
      }

      // 2) cache miss / force → 실시간 계산 fallback
      // funnel-health 의 window 가 30d 가 최대 → ledger 도 30d range 만 읽어 SQL 인덱스 활용.
      const nowMs = Date.now();
      const ledgerFromMs = nowMs - 31 * 24 * 60 * 60 * 1000;
      const ledgerEntries = await readLedgerEntriesInRange({
        loggedAtFromIso: new Date(ledgerFromMs).toISOString(),
      });
      const capiLogs = await readMetaCapiSendLogs();
      const paymentDecisionRecords = readPaymentDecisionMeasurements(
        nowMs - 30 * 24 * 60 * 60 * 1000,
        nowMs,
      );
      const builtAtMs = Date.now();
      const result = buildFunnelHealthReport({
        ledgerEntries,
        capiLogs,
        paymentDecisionRecords,
        siteLandingEvidence: summarizeSiteLandingFunnelEvidence(
          parsed.site,
          FUNNEL_HEALTH_WINDOW_HOURS[parsed.window],
        ),
        ...parsed,
      });
      res.json({
        ...result,
        cache: {
          cached: false,
          cached_at_kst: null,
          next_refresh_at_kst: null,
          generation_ms: Date.now() - builtAtMs,
          staleness_ms: 0,
          source: forceRefresh ? "live_force_refresh" : "live_cache_miss",
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "funnel_health build failed";
      res.status(500).json({ ok: false, error: "funnel_health_error", message });
    }
  });

  return router;
};
