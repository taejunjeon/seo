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
  normalizeApprovedAtToIso,
  normalizePaymentStatus,
  readLedgerEntries,
  type TossJoinRow,
} from "../attribution";
import { updateAttributionLedgerEntries } from "../attributionLedgerDb";
import { getCrmDb } from "../crmLocalDb";
import { getNpayIntentSummary, listNpayIntents, recordNpayIntent } from "../npayIntentLog";
import { buildNpayRoasDryRunReport } from "../npayRoasDryRun";
import { normalizeOrderIdBase, normalizePhoneDigits } from "../orderKeys";
import { isDatabaseConfigured, queryPg } from "../postgres";
import {
  appendTikTokPixelEvent,
  buildTikTokPixelEventSummary,
  listTikTokPixelEvents,
  normalizeTikTokPixelEventPayload,
} from "../tiktokPixelEvents";
import { getTossBasicAuth, inferTossStoreFromPaymentKey, normalizeTossStore, type TossStore } from "../tossConfig";

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

type AttributionStatusSyncPlan = Omit<
  AttributionStatusSyncResult,
  "ok" | "dryRun" | "writtenRows" | "directFallbackRows" | "imwebOverdueRows" | "directFallbackErrors"
> & {
  updates: Array<{ previousEntry: AttributionLedgerEntry; nextEntry: AttributionLedgerEntry }>;
};

type PaymentDecisionLookup = {
  orderId: string;
  orderNo: string;
  orderCode: string;
  paymentCode: string;
  paymentKey: string;
  store: TossStore;
};

type PaymentDecisionMatchType =
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
    source: "toss_direct_api" | "attribution_ledger";
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

const parsePositiveInt = (value: unknown, fallback: number, max: number) => {
  const parsed = typeof value === "string" ? Number.parseInt(value, 10) : Number.NaN;
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

const readCsvList = (value: unknown) =>
  readOne(value)
    .split(",")
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
  if (value === "checkout_started" || value === "payment_success" || value === "form_submit") {
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

const fetchRemoteLedgerEntriesForAcquisition = async (): Promise<EnrichedRemoteLedger> => {
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
    remoteWarnings.push("운영 VM 원장 row를 가져오지 못해 로컬 원장으로 fallback했다.");
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
): AttributionPaymentDecision => {
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

export const createAttributionRouter = () => {
  const router = express.Router();

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
        ga4AbsentOrderNumbers: readCsvList(req.query.ga4AbsentOrderNumbers || req.query.ga4Absent),
        testOrderNumbers: readCsvList(req.query.testOrderNumbers || req.query.testOrders),
        orderNumbers: readCsvList(req.query.orderNumbers || req.query.orderNumber),
      });

      res.json(report);
    } catch (error) {
      const message = error instanceof Error ? error.message : "npay roas dry-run failed";
      res.status(500).json({ ok: false, error: "npay_roas_dry_run_error", message });
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

  router.post("/api/attribution/checkout-context", async (req: Request, res: Response) => {
    try {
      const body = parseBody(req.body);
      enforceOriginSourceMatch(req, body, "checkout_started");
      const entry = enrichCheckoutStartedFirstTouch(
        buildLedgerEntry("checkout_started", body, buildRequestContext(req)),
      );
      const ledgerPath = await appendLedgerEntry(entry);
      res.status(201).json({
        ok: true,
        receiver: "checkout_context",
        storedAt: ledgerPath,
        entry,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "checkout attribution logging failed";
      res.status(400).json({ ok: false, error: "checkout_attribution_log_error", message });
    }
  });

  router.post("/api/attribution/payment-success", async (req: Request, res: Response) => {
    try {
      const body = parseBody(req.body);
      enforceOriginSourceMatch(req, body, "payment_success");
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
      res.status(201).json({
        ok: true,
        receiver: "payment_success",
        storedAt: ledgerPath,
        entry,
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
      res.set("Cache-Control", "no-store");
      const lookup = parsePaymentDecisionLookup(req);
      const tossEnabled = parseBooleanish(req.query.toss ?? req.query.directToss, true);
      const debug = parseBooleanish(req.query.debug, false);
      const entries = await readLedgerEntries();
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

      const decision = buildAttributionPaymentDecision(entries, lookup, directToss.rows);

      res.json({
        ok: true,
        version: "2026-04-12.payment-decision.v1",
        generatedAt: new Date().toISOString(),
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
        directToss: {
          attempted: directToss.attempted,
          matchedRows: directToss.rows.length,
          errors: directToss.errors.length,
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

  router.get("/api/attribution/ledger", async (req: Request, res: Response) => {
    try {
      const allEntries = await readLedgerEntries();
      const source = typeof req.query.source === "string" ? req.query.source.trim() : "";
      const captureMode = typeof req.query.captureMode === "string" ? req.query.captureMode.trim() : "";
      const limit = parsePositiveInt(req.query.limit, 50, 10000);
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

      res.json({
        ok: true,
        filters: {
          source: source || null,
          captureMode: captureMode || null,
          startAt: startAt || null,
          endAt: endAt || null,
        },
        summary: buildLedgerSummary(filtered),
        allEntriesSummary: (source || captureMode || hasStartFilter || hasEndFilter) ? buildLedgerSummary(allEntries) : undefined,
        items: filtered.slice(0, limit),
        codebaseDiscovery: {
          successHandlerFoundInWorkspace: false,
          note:
            "현재 workspace에는 기존 PG successUrl/server callback 구현이 보이지 않아, 이 API를 표준 수신 엔드포인트로 추가했다.",
          canonicalReceivers: [
            "POST /api/attribution/checkout-context",
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
      const channels = parseAcquisitionChannelFilter(readOne(req.query.channel));
      const cohortLedger = await resolveAcquisitionCohortLedger(req.query.dataSource);
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
      const cohortLedger = await resolveAcquisitionCohortLedger(req.query.dataSource);
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
      const cohortLedger = await resolveAcquisitionCohortLedger(req.query.dataSource);
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
          remoteWarnings.push("운영 VM 원장 row를 가져오지 못해 로컬 원장으로 fallback했다.");
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

      const filtered = source
        ? filterLedgerEntries(allEntries, { source })
        : allEntries;

      res.json({
        ok: true,
        filters: { source: source || null },
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
          "이 endpoint는 read-only 운영 DB의 tb_sales_toss를 읽어 replay용 payment_success row를 만든다.",
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

  return router;
};
