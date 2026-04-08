import { promises as fs } from "node:fs";
import path from "node:path";

import type { Request } from "express";
import { z } from "zod";

import {
  getAttributionLedgerStorageRef,
  insertAttributionLedgerEntries,
  insertAttributionLedgerEntry,
  listAttributionLedgerEntries,
} from "./attributionLedgerDb";
import { normalizeOrderIdBase, normalizePhoneDigits } from "./orderKeys";

export type AttributionTouchpoint = "checkout_started" | "payment_success" | "form_submit";
export type AttributionCaptureMode = "live" | "replay" | "smoke";
export type AttributionPaymentStatus = "pending" | "confirmed" | "canceled";

export type AttributionCaptureModeCounts = Record<AttributionCaptureMode, number>;
export type AttributionPaymentStatusCounts = Record<AttributionPaymentStatus, number>;
export type AttributionPaymentStatusRevenue = Record<AttributionPaymentStatus, number>;
export type AttributionIdentityField = "gaSessionId" | "clientId" | "userPseudoId";

export type AttributionLedgerEntry = {
  touchpoint: AttributionTouchpoint;
  captureMode: AttributionCaptureMode;
  paymentStatus: AttributionPaymentStatus | null;
  loggedAt: string;
  orderId: string;
  paymentKey: string;
  approvedAt: string;
  checkoutId: string;
  customerKey: string;
  landing: string;
  referrer: string;
  gaSessionId: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmTerm: string;
  utmContent: string;
  gclid: string;
  fbclid: string;
  ttclid: string;
  metadata: Record<string, unknown>;
  requestContext: {
    ip: string;
    userAgent: string;
    origin: string;
    requestReferer: string;
    method: string;
    path: string;
  };
};

export type TossJoinRow = {
  paymentKey: string;
  orderId: string;
  approvedAt: string;
  status: string;
  channel: string;
  store: string;
  totalAmount: number;
};

export type TossHourlyRow = {
  dateHour: string;
  approvalCount: number;
  totalAmount: number;
};

export type AttributionHourlyCompareRow = {
  dateHour: string;
  tossApprovalCount: number;
  tossApprovalAmount: number;
  paymentSuccessEntries: number;
  livePaymentSuccessEntries: number;
  replayPaymentSuccessEntries: number;
  smokePaymentSuccessEntries: number;
  checkoutEntries: number;
  diagnosticLabel: string;
};

export type AttributionCallerCoverageSummary = {
  total: number;
  withGaSessionId: number;
  withClientId: number;
  withUserPseudoId: number;
  withAllThree: number;
  gaSessionIdRate: number;
  clientIdRate: number;
  userPseudoIdRate: number;
  allThreeRate: number;
};

export type AttributionCallerCoverageSample = {
  loggedAt: string;
  touchpoint: AttributionTouchpoint;
  captureMode: AttributionCaptureMode;
  orderId: string;
  paymentKey: string;
  source: string;
  store: string;
  landing: string;
  orderIdBase: string;
  normalizedPhone: string;
  gaSessionId: string;
  clientId: string;
  userPseudoId: string;
  missingFields: AttributionIdentityField[];
};

export type AttributionCallerCoverageReport = {
  paymentSuccess: AttributionCallerCoverageSummary;
  checkoutStarted: AttributionCallerCoverageSummary;
  recentMissingPayments: AttributionCallerCoverageSample[];
  recentMissingCheckouts: AttributionCallerCoverageSample[];
  notes: string[];
};

export type TossReplayPlan = {
  summary: {
    tossRows: number;
    candidateRows: number;
    insertableRows: number;
    skippedExistingRows: number;
  };
  insertableEntries: AttributionLedgerEntry[];
  skippedRows: Array<{
    paymentKey: string;
    orderId: string;
    approvedAt: string;
    reason: string;
  }>;
};

const stringField = z.string().trim().max(5000).optional().default("");
const CAPTURE_MODES = ["live", "replay", "smoke"] as const;
const PAYMENT_STATUSES = ["pending", "confirmed", "canceled"] as const;

const normalizedPayloadSchema = z.object({
  orderId: stringField,
  paymentKey: stringField,
  approvedAt: stringField,
  checkoutId: stringField,
  customerKey: stringField,
  landing: stringField,
  referrer: stringField,
  gaSessionId: stringField,
  utmSource: stringField,
  utmMedium: stringField,
  utmCampaign: stringField,
  utmTerm: stringField,
  utmContent: stringField,
  gclid: stringField,
  fbclid: stringField,
  ttclid: stringField,
  captureMode: z.enum(CAPTURE_MODES).optional(),
  paymentStatus: z.enum(PAYMENT_STATUSES).nullable().optional().default(null),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});

const LEGACY_LEDGER_PATH = path.resolve(__dirname, "..", "logs", "checkout-attribution-ledger.jsonl");
const KST_TIMEZONE = "Asia/Seoul";
const CAPTURE_MODE_PRIORITY: Record<AttributionCaptureMode, number> = {
  live: 3,
  replay: 2,
  smoke: 1,
};
const PAYMENT_STATUS_PRIORITY: Record<AttributionPaymentStatus, number> = {
  pending: 1,
  confirmed: 2,
  canceled: 3,
};
const CONFIRMED_STATUS_KEYWORDS = ["DONE", "PAID", "APPROVED", "SUCCESS", "SUCCEEDED", "CONFIRMED", "COMPLETED", "COMPLETE"];
const PENDING_STATUS_KEYWORDS = ["WAITING_FOR_DEPOSIT", "PENDING", "WAITING", "READY", "DEPOSIT", "REQUESTED", "IN_PROGRESS"];
const CANCELED_STATUS_KEYWORDS = ["CANCEL", "FAIL", "ABORT", "REFUND", "EXPIRE", "VOID"];

const createCaptureModeCounts = (): AttributionCaptureModeCounts => ({
  live: 0,
  replay: 0,
  smoke: 0,
});

const createPaymentStatusCounts = (): AttributionPaymentStatusCounts => ({
  pending: 0,
  confirmed: 0,
  canceled: 0,
});

const createPaymentStatusRevenue = (): AttributionPaymentStatusRevenue => ({
  pending: 0,
  confirmed: 0,
  canceled: 0,
});

const REFERRER_PAYMENT_KEYS = [
  "orderCode",
  "orderNo",
  "paymentCode",
  "orderId",
  "paymentKey",
  "amount",
] as const;
const PHONE_FIELD_KEYS = [
  "phone",
  "phoneNumber",
  "phone_number",
  "mobile",
  "mobilePhone",
  "mobile_phone",
  "customerPhone",
  "customer_phone",
  "customerMobilePhone",
  "customer_mobile_phone",
  "buyerPhone",
  "buyer_phone",
  "ordererCall",
  "orderer_call",
  "callnum",
  "customerKey",
  "customer_key",
] as const;
const CLIENT_ID_FIELD_KEYS = ["clientId", "client_id", "gaClientId", "ga_client_id"] as const;
const USER_PSEUDO_ID_FIELD_KEYS = ["userPseudoId", "user_pseudo_id", "gaUserPseudoId", "ga_user_pseudo_id"] as const;

const parseReferrerPaymentParams = (
  referrerUrl: string,
): Record<string, string> => {
  if (!referrerUrl) return {};
  try {
    const url = new URL(referrerUrl);
    const result: Record<string, string> = {};
    for (const key of REFERRER_PAYMENT_KEYS) {
      const value = url.searchParams.get(key);
      if (value) result[key] = value;
    }
    return result;
  } catch {
    return {};
  }
};

const firstString = (input: Record<string, unknown>, keys: string[]): string => {
  for (const key of keys) {
    const value = input[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
};

const objectValue = (input: Record<string, unknown>, keys: string[]): Record<string, unknown> => {
  for (const key of keys) {
    const value = input[key];
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
  }
  return {};
};

const firstNumber = (input: Record<string, unknown>, keys: string[]): number | undefined => {
  for (const key of keys) {
    const value = input[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value.trim());
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return undefined;
};

export const normalizePaymentStatus = (value: unknown): AttributionPaymentStatus | undefined => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const normalized = trimmed.toLowerCase();
  if (normalized === "pending" || normalized === "confirmed" || normalized === "canceled") {
    return normalized;
  }

  const upper = trimmed.toUpperCase();
  if (CANCELED_STATUS_KEYWORDS.some((keyword) => upper.includes(keyword))) {
    return "canceled";
  }
  if (PENDING_STATUS_KEYWORDS.some((keyword) => upper.includes(keyword))) {
    return "pending";
  }
  if (CONFIRMED_STATUS_KEYWORDS.some((keyword) => upper.includes(keyword))) {
    return "confirmed";
  }

  return undefined;
};

export const resolveLedgerPath = (overridePath?: string) => overridePath || LEGACY_LEDGER_PATH;

const normalizeCaptureMode = (value: unknown): AttributionCaptureMode | undefined => {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === "live" || normalized === "replay" || normalized === "smoke") {
    return normalized;
  }
  return undefined;
};

const resolvePaymentStatus = (params: {
  touchpoint: AttributionTouchpoint;
  paymentStatus?: AttributionPaymentStatus | null;
  metadata: Record<string, unknown>;
}) => {
  if (params.touchpoint !== "payment_success") {
    return null;
  }

  const metadataStatus = normalizePaymentStatus(
    firstString(params.metadata, ["paymentStatus", "payment_status", "status"]),
  );
  const explicitStatus = normalizePaymentStatus(params.paymentStatus);
  return explicitStatus ?? metadataStatus ?? "pending";
};

export const buildRequestContext = (req: Request) => ({
  ip:
    (typeof req.headers["x-forwarded-for"] === "string" ? req.headers["x-forwarded-for"].split(",")[0] : "")?.trim() ||
    req.ip ||
    "",
  userAgent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : "",
  origin: typeof req.headers.origin === "string" ? req.headers.origin : "",
  requestReferer: typeof req.headers.referer === "string" ? req.headers.referer : "",
  method: req.method,
  path: req.path,
});

export const normalizeAttributionPayload = (raw: unknown) => {
  const input = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

  const referrerRaw = firstString(input, ["referrer", "referer"]);
  const referrerParams = parseReferrerPaymentParams(referrerRaw);

  const orderId =
    firstString(input, ["orderId", "order_id"]) ||
    referrerParams.orderNo ||
    referrerParams.orderId ||
    "";
  const paymentKey =
    firstString(input, ["paymentKey", "payment_key"]) ||
    referrerParams.paymentKey ||
    "";

  const existingMetadata = objectValue(input, ["metadata", "meta"]);
  const source = firstString(input, ["source"]);
  const clientObservedAt = firstString(input, ["clientObservedAt", "client_observed_at"]);
  const gaSessionId =
    firstString(input, ["gaSessionId", "ga_session_id"]) ||
    firstString(existingMetadata, ["gaSessionId", "ga_session_id"]);
  const clientId =
    firstString(input, [...CLIENT_ID_FIELD_KEYS]) ||
    firstString(existingMetadata, [...CLIENT_ID_FIELD_KEYS]);
  const userPseudoId =
    firstString(input, [...USER_PSEUDO_ID_FIELD_KEYS]) ||
    firstString(existingMetadata, [...USER_PSEUDO_ID_FIELD_KEYS]);
  const normalizedPhone = normalizePhoneDigits(
    firstString(input, [...PHONE_FIELD_KEYS]) ||
      firstString(existingMetadata, [...PHONE_FIELD_KEYS]),
  );
  const paymentStatus =
    normalizePaymentStatus(firstString(input, ["paymentStatus", "payment_status"])) ??
    normalizePaymentStatus(firstString(existingMetadata, ["paymentStatus", "payment_status", "status"])) ??
    null;
  const orderIdBase = normalizeOrderIdBase(
    firstString(input, ["orderIdBase", "order_id_base"]) ||
      firstString(existingMetadata, ["orderIdBase", "order_id_base"]) ||
      orderId ||
      referrerParams.orderId ||
      referrerParams.orderNo ||
      "",
  );

  const enrichedMetadata: Record<string, unknown> = { ...existingMetadata };
  if (source) enrichedMetadata.source = source;
  if (clientObservedAt) enrichedMetadata.clientObservedAt = clientObservedAt;
  if (orderIdBase) enrichedMetadata.orderIdBase = orderIdBase;
  if (normalizedPhone) enrichedMetadata.normalizedPhone = normalizedPhone;
  if (gaSessionId) enrichedMetadata.gaSessionId = gaSessionId;
  if (clientId) enrichedMetadata.clientId = clientId;
  if (userPseudoId) enrichedMetadata.userPseudoId = userPseudoId;
  if (Object.keys(referrerParams).length > 0) {
    enrichedMetadata.referrerPayment = referrerParams;
  }
  const formId = firstString(input, ["formId", "form_id"]);
  if (formId) enrichedMetadata.formId = formId;
  const formName = firstString(input, ["formName", "form_name"]);
  if (formName) enrichedMetadata.formName = formName;
  const formPage = firstString(input, ["formPage", "form_page"]);
  if (formPage) enrichedMetadata.formPage = formPage;

  return normalizedPayloadSchema.parse({
    orderId,
    paymentKey,
    approvedAt: firstString(input, ["approvedAt", "approved_at"]),
    checkoutId: firstString(input, ["checkoutId", "checkout_id"]),
    customerKey: firstString(input, ["customerKey", "customer_key"]) || normalizedPhone,
    landing: firstString(input, ["landing", "landingPath", "landing_path"]),
    referrer: referrerRaw,
    gaSessionId,
    utmSource: firstString(input, ["utmSource", "utm_source"]),
    utmMedium: firstString(input, ["utmMedium", "utm_medium"]),
    utmCampaign: firstString(input, ["utmCampaign", "utm_campaign"]),
    utmTerm: firstString(input, ["utmTerm", "utm_term"]),
    utmContent: firstString(input, ["utmContent", "utm_content"]),
    gclid: firstString(input, ["gclid"]),
    fbclid: firstString(input, ["fbclid"]),
    ttclid: firstString(input, ["ttclid"]),
    captureMode: normalizeCaptureMode(
      firstString(input, ["captureMode", "capture_mode", "sourceMode", "source_mode"]),
    ),
    paymentStatus,
    metadata: enrichedMetadata,
  });
};

const resolveCaptureMode = (params: {
  captureMode?: AttributionCaptureMode;
  metadata: Record<string, unknown>;
  utmMedium: string;
  requestContext: AttributionLedgerEntry["requestContext"];
}) => {
  if (params.captureMode) {
    return params.captureMode;
  }

  const metadataMode = normalizeCaptureMode(params.metadata.captureMode);
  if (metadataMode) {
    return metadataMode;
  }

  if (
    params.metadata.replaySource ||
    params.requestContext.method === "REPLAY" ||
    params.requestContext.path.includes("/replay/")
  ) {
    return "replay" as const;
  }

  if (params.metadata.smokeCheck === true || params.utmMedium === "smoke") {
    return "smoke" as const;
  }

  return "live" as const;
};

const inferCaptureMode = (
  payload: ReturnType<typeof normalizeAttributionPayload>,
  requestContext: AttributionLedgerEntry["requestContext"],
): AttributionCaptureMode => {
  return resolveCaptureMode({
    captureMode: payload.captureMode,
    metadata: payload.metadata,
    utmMedium: payload.utmMedium,
    requestContext,
  });
};

export const buildLedgerEntry = (
  touchpoint: AttributionTouchpoint,
  raw: unknown,
  requestContext: AttributionLedgerEntry["requestContext"],
  loggedAt = new Date().toISOString(),
): AttributionLedgerEntry => {
  const payload = normalizeAttributionPayload(raw);
  if (
    touchpoint === "checkout_started" &&
    !payload.checkoutId &&
    !payload.customerKey &&
    !payload.landing &&
    !payload.gaSessionId
  ) {
    throw new Error("checkout_started requires at least one of checkoutId, customerKey, landing, gaSessionId");
  }
  if (touchpoint === "payment_success" && !payload.orderId && !payload.paymentKey) {
    throw new Error("payment_success requires orderId or paymentKey");
  }
  if (touchpoint === "form_submit" && !payload.metadata?.source) {
    throw new Error("form_submit requires source in metadata");
  }
  return {
    touchpoint,
    loggedAt,
    ...payload,
    captureMode: inferCaptureMode(payload, requestContext),
    paymentStatus: resolvePaymentStatus({
      touchpoint,
      paymentStatus: payload.paymentStatus,
      metadata: payload.metadata,
    }),
    requestContext,
  };
};

const normalizeLedgerRequestContext = (
  requestContext: Partial<AttributionLedgerEntry["requestContext"]> | undefined,
): AttributionLedgerEntry["requestContext"] => ({
  ip: requestContext?.ip ?? "",
  userAgent: requestContext?.userAgent ?? "",
  origin: requestContext?.origin ?? "",
  requestReferer: requestContext?.requestReferer ?? "",
  method: requestContext?.method ?? "",
  path: requestContext?.path ?? "",
});

const coerceLedgerEntry = (parsed: Partial<AttributionLedgerEntry>): AttributionLedgerEntry => {
  const touchpoint =
    parsed.touchpoint === "payment_success"
      ? "payment_success"
      : parsed.touchpoint === "form_submit"
        ? "form_submit"
        : "checkout_started";
  const metadata = parsed.metadata ?? {};
  const requestContext = normalizeLedgerRequestContext(parsed.requestContext);

  return {
    touchpoint,
    captureMode: resolveCaptureMode({
      captureMode: normalizeCaptureMode(parsed.captureMode),
      metadata,
      utmMedium: typeof parsed.utmMedium === "string" ? parsed.utmMedium : "",
      requestContext,
    }),
    paymentStatus: resolvePaymentStatus({
      touchpoint,
      paymentStatus: normalizePaymentStatus(parsed.paymentStatus),
      metadata,
    }),
    loggedAt: parsed.loggedAt ?? "",
    orderId: parsed.orderId ?? "",
    paymentKey: parsed.paymentKey ?? "",
    approvedAt: parsed.approvedAt ?? "",
    checkoutId: parsed.checkoutId ?? "",
    customerKey: parsed.customerKey ?? "",
    landing: parsed.landing ?? "",
    referrer: parsed.referrer ?? "",
    gaSessionId: parsed.gaSessionId ?? "",
    utmSource: parsed.utmSource ?? "",
    utmMedium: parsed.utmMedium ?? "",
    utmCampaign: parsed.utmCampaign ?? "",
    utmTerm: parsed.utmTerm ?? "",
    utmContent: parsed.utmContent ?? "",
    gclid: parsed.gclid ?? "",
    fbclid: parsed.fbclid ?? "",
    ttclid: parsed.ttclid ?? "",
    metadata,
    requestContext,
  };
};

const readLegacyLedgerEntries = async (ledgerPath: string): Promise<AttributionLedgerEntry[]> => {
  try {
    const content = await fs.readFile(ledgerPath, "utf8");
    return content
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => coerceLedgerEntry(JSON.parse(line) as Partial<AttributionLedgerEntry>))
      .sort((a, b) => b.loggedAt.localeCompare(a.loggedAt));
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("ENOENT")) return [];
    throw error;
  }
};

let defaultLedgerMigrationPromise: Promise<void> | null = null;

const ensureDefaultLedgerMigrated = async () => {
  if (!defaultLedgerMigrationPromise) {
    defaultLedgerMigrationPromise = (async () => {
      const legacyEntries = await readLegacyLedgerEntries(LEGACY_LEDGER_PATH);
      if (legacyEntries.length > 0) {
        insertAttributionLedgerEntries(legacyEntries);
      }
    })().catch((error) => {
      defaultLedgerMigrationPromise = null;
      throw error;
    });
  }

  await defaultLedgerMigrationPromise;
};

export const appendLedgerEntry = async (
  entry: AttributionLedgerEntry,
  ledgerPath?: string,
) => {
  if (ledgerPath) {
    const targetPath = resolveLedgerPath(ledgerPath);
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.appendFile(targetPath, `${JSON.stringify(entry)}\n`, "utf8");
    return targetPath;
  }

  await ensureDefaultLedgerMigrated();
  insertAttributionLedgerEntry(entry);
  return getAttributionLedgerStorageRef();
};

export const readLedgerEntries = async (ledgerPath?: string): Promise<AttributionLedgerEntry[]> => {
  if (ledgerPath) {
    return readLegacyLedgerEntries(resolveLedgerPath(ledgerPath));
  }

  await ensureDefaultLedgerMigrated();
  return listAttributionLedgerEntries();
};

export const filterLedgerEntries = (
  entries: AttributionLedgerEntry[],
  filters: { source?: string; captureMode?: string },
): AttributionLedgerEntry[] => {
  return entries.filter((entry) => {
    if (filters.source) {
      const entrySource =
        typeof entry.metadata?.source === "string" ? entry.metadata.source : "";
      if (entrySource !== filters.source) return false;
    }
    if (filters.captureMode && entry.captureMode !== filters.captureMode) return false;
    return true;
  });
};

export const resolveLedgerRevenueValue = (entry: AttributionLedgerEntry): number => {
  if (entry.touchpoint !== "payment_success") return 0;

  const direct = firstNumber(entry.metadata, ["value", "amount", "totalAmount"]);
  if (typeof direct === "number" && direct > 0) {
    return direct;
  }

  const referrerPayment = objectValue(entry.metadata, ["referrerPayment"]);
  const referrerAmount = firstNumber(referrerPayment, ["amount"]);
  if (typeof referrerAmount === "number" && referrerAmount > 0) {
    return referrerAmount;
  }

  return 0;
};

export const buildLedgerSummary = (entries: AttributionLedgerEntry[]) => {
  const countsByTouchpoint: Record<string, number> = {};
  const countsByCaptureMode = createCaptureModeCounts();
  const paymentSuccessByCaptureMode = createCaptureModeCounts();
  const paymentSuccessByPaymentStatus = createPaymentStatusCounts();
  const paymentRevenueByPaymentStatus = createPaymentStatusRevenue();
  const checkoutByCaptureMode = createCaptureModeCounts();
  const countsBySource: Record<string, number> = {};
  let withPaymentKey = 0;
  let withOrderId = 0;
  let withGaSessionId = 0;
  let withClientId = 0;
  let withUserPseudoId = 0;
  let withNormalizedPhone = 0;
  let withOrderIdBase = 0;
  let withReferrerPayment = 0;

  for (const entry of entries) {
    countsByTouchpoint[entry.touchpoint] = (countsByTouchpoint[entry.touchpoint] ?? 0) + 1;
    countsByCaptureMode[entry.captureMode] += 1;
    if (entry.touchpoint === "payment_success") {
      paymentSuccessByCaptureMode[entry.captureMode] += 1;
      if (entry.paymentStatus) {
        paymentSuccessByPaymentStatus[entry.paymentStatus] += 1;
        paymentRevenueByPaymentStatus[entry.paymentStatus] += resolveLedgerRevenueValue(entry);
      }
    }
    if (entry.touchpoint === "checkout_started") checkoutByCaptureMode[entry.captureMode] += 1;
    if (entry.paymentKey) withPaymentKey += 1;
    if (entry.orderId) withOrderId += 1;
    if (entry.gaSessionId) withGaSessionId += 1;
    if (typeof entry.metadata?.clientId === "string" && entry.metadata.clientId.trim()) withClientId += 1;
    if (typeof entry.metadata?.userPseudoId === "string" && entry.metadata.userPseudoId.trim()) withUserPseudoId += 1;
    if (typeof entry.metadata?.normalizedPhone === "string" && entry.metadata.normalizedPhone.trim()) withNormalizedPhone += 1;
    if (typeof entry.metadata?.orderIdBase === "string" && entry.metadata.orderIdBase.trim()) withOrderIdBase += 1;
    const source = typeof entry.metadata?.source === "string" ? entry.metadata.source : "(none)";
    countsBySource[source] = (countsBySource[source] ?? 0) + 1;
    if (entry.metadata?.referrerPayment) withReferrerPayment += 1;
  }

  return {
    totalEntries: entries.length,
    countsByTouchpoint,
    countsByCaptureMode,
    paymentSuccessByCaptureMode,
    paymentSuccessByPaymentStatus,
    paymentRevenueByPaymentStatus,
    confirmedRevenue: paymentRevenueByPaymentStatus.confirmed,
    pendingRevenue: paymentRevenueByPaymentStatus.pending,
    canceledRevenue: paymentRevenueByPaymentStatus.canceled,
    checkoutByCaptureMode,
    countsBySource,
    entriesWithPaymentKey: withPaymentKey,
    entriesWithOrderId: withOrderId,
    entriesWithGaSessionId: withGaSessionId,
    entriesWithClientId: withClientId,
    entriesWithUserPseudoId: withUserPseudoId,
    entriesWithNormalizedPhone: withNormalizedPhone,
    entriesWithOrderIdBase: withOrderIdBase,
    entriesWithReferrerPayment: withReferrerPayment,
    latestLoggedAt: entries[0]?.loggedAt ?? null,
  };
};

const roundCoverageRate = (value: number) => Number(value.toFixed(2));

const hasClientId = (entry: AttributionLedgerEntry) =>
  typeof entry.metadata?.clientId === "string" && entry.metadata.clientId.trim().length > 0;

const hasUserPseudoId = (entry: AttributionLedgerEntry) =>
  typeof entry.metadata?.userPseudoId === "string" && entry.metadata.userPseudoId.trim().length > 0;

const resolveCallerCoverageSummary = (entries: AttributionLedgerEntry[]): AttributionCallerCoverageSummary => {
  let withGaSessionId = 0;
  let withClientId = 0;
  let withUserPseudoId = 0;
  let withAllThree = 0;

  for (const entry of entries) {
    const gaSessionIdPresent = entry.gaSessionId.trim().length > 0;
    const clientIdPresent = hasClientId(entry);
    const userPseudoIdPresent = hasUserPseudoId(entry);

    if (gaSessionIdPresent) withGaSessionId += 1;
    if (clientIdPresent) withClientId += 1;
    if (userPseudoIdPresent) withUserPseudoId += 1;
    if (gaSessionIdPresent && clientIdPresent && userPseudoIdPresent) withAllThree += 1;
  }

  const total = entries.length;
  const toRate = (count: number) => (total > 0 ? roundCoverageRate((count / total) * 100) : 0);

  return {
    total,
    withGaSessionId,
    withClientId,
    withUserPseudoId,
    withAllThree,
    gaSessionIdRate: toRate(withGaSessionId),
    clientIdRate: toRate(withClientId),
    userPseudoIdRate: toRate(withUserPseudoId),
    allThreeRate: toRate(withAllThree),
  };
};

const resolveCallerMissingFields = (entry: AttributionLedgerEntry): AttributionIdentityField[] => {
  const missingFields: AttributionIdentityField[] = [];

  if (!entry.gaSessionId.trim()) missingFields.push("gaSessionId");
  if (!hasClientId(entry)) missingFields.push("clientId");
  if (!hasUserPseudoId(entry)) missingFields.push("userPseudoId");

  return missingFields;
};

const toCallerCoverageSample = (entry: AttributionLedgerEntry): AttributionCallerCoverageSample => ({
  loggedAt: entry.loggedAt,
  touchpoint: entry.touchpoint,
  captureMode: entry.captureMode,
  orderId: entry.orderId,
  paymentKey: entry.paymentKey,
  source: typeof entry.metadata?.source === "string" ? entry.metadata.source : "",
  store: typeof entry.metadata?.store === "string" ? entry.metadata.store : "",
  landing: entry.landing,
  orderIdBase: typeof entry.metadata?.orderIdBase === "string" ? entry.metadata.orderIdBase : "",
  normalizedPhone: typeof entry.metadata?.normalizedPhone === "string" ? entry.metadata.normalizedPhone : "",
  gaSessionId: entry.gaSessionId,
  clientId: typeof entry.metadata?.clientId === "string" ? entry.metadata.clientId : "",
  userPseudoId: typeof entry.metadata?.userPseudoId === "string" ? entry.metadata.userPseudoId : "",
  missingFields: resolveCallerMissingFields(entry),
});

export const buildAttributionCallerCoverageReport = (
  entries: AttributionLedgerEntry[],
  options?: { paymentLimit?: number; checkoutLimit?: number },
): AttributionCallerCoverageReport => {
  const paymentLimit = Math.max(1, Math.min(options?.paymentLimit ?? 20, 100));
  const checkoutLimit = Math.max(1, Math.min(options?.checkoutLimit ?? 10, 100));

  const livePayments = entries.filter(
    (entry) => entry.captureMode === "live" && entry.touchpoint === "payment_success",
  );
  const liveCheckouts = entries.filter(
    (entry) => entry.captureMode === "live" && entry.touchpoint === "checkout_started",
  );

  const recentMissingPayments = livePayments
    .filter((entry) => resolveCallerMissingFields(entry).length > 0)
    .slice(0, paymentLimit)
    .map(toCallerCoverageSample);
  const recentMissingCheckouts = liveCheckouts
    .filter((entry) => resolveCallerMissingFields(entry).length > 0)
    .slice(0, checkoutLimit)
    .map(toCallerCoverageSample);

  const paymentSummary = resolveCallerCoverageSummary(livePayments);
  const checkoutSummary = resolveCallerCoverageSummary(liveCheckouts);
  const notes: string[] = [];

  if (paymentSummary.total === 0) {
    notes.push("live payment_success row가 아직 없어 caller 식별자 실유입을 결제 체인에서 검증할 수 없음.");
  } else if (paymentSummary.allThreeRate < 80) {
    notes.push(`live payment_success의 all-three coverage가 ${paymentSummary.allThreeRate}%로 낮다. 외부 checkout/payment_success caller 수정이 아직 필요함.`);
  }

  if (checkoutSummary.total === 0) {
    notes.push("live checkout_started row가 아직 없어 체크아웃 시작 지점의 GA 식별자 누락률을 판단하기 어려움.");
  } else if (checkoutSummary.allThreeRate < 80) {
    notes.push(`live checkout_started의 all-three coverage가 ${checkoutSummary.allThreeRate}%다. 체크아웃 진입 시점 caller도 같이 점검해야 함.`);
  }

  return {
    paymentSuccess: paymentSummary,
    checkoutStarted: checkoutSummary,
    recentMissingPayments,
    recentMissingCheckouts,
    notes,
  };
};

const toKstDateHour = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: KST_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  })
    .formatToParts(parsed)
    .reduce<Record<string, string>>((acc, part) => {
      if (part.type !== "literal") {
        acc[part.type] = part.value;
      }
      return acc;
    }, {});

  if (!parts.year || !parts.month || !parts.day || !parts.hour) {
    return null;
  }

  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    hour: parts.hour,
    dateHour: `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:00`,
  };
};

const buildAttributionIndex = (entries: AttributionLedgerEntry[]) => {
  const byPaymentKey = new Map<string, AttributionLedgerEntry>();
  const byOrderId = new Map<string, AttributionLedgerEntry>();

  for (const entry of entries) {
    const currentPaymentKeyEntry = entry.paymentKey ? byPaymentKey.get(entry.paymentKey) : undefined;
    if (
      entry.paymentKey &&
      (!currentPaymentKeyEntry ||
        CAPTURE_MODE_PRIORITY[entry.captureMode] > CAPTURE_MODE_PRIORITY[currentPaymentKeyEntry.captureMode] ||
        (
          CAPTURE_MODE_PRIORITY[entry.captureMode] === CAPTURE_MODE_PRIORITY[currentPaymentKeyEntry.captureMode] &&
          entry.loggedAt > currentPaymentKeyEntry.loggedAt
        ))
    ) {
      byPaymentKey.set(entry.paymentKey, entry);
    }
    const currentOrderIdEntry = entry.orderId ? byOrderId.get(entry.orderId) : undefined;
    if (
      entry.orderId &&
      (!currentOrderIdEntry ||
        CAPTURE_MODE_PRIORITY[entry.captureMode] > CAPTURE_MODE_PRIORITY[currentOrderIdEntry.captureMode] ||
        (
          CAPTURE_MODE_PRIORITY[entry.captureMode] === CAPTURE_MODE_PRIORITY[currentOrderIdEntry.captureMode] &&
          entry.loggedAt > currentOrderIdEntry.loggedAt
        ))
    ) {
      byOrderId.set(entry.orderId, entry);
    }
  }

  return { byPaymentKey, byOrderId };
};

const buildLedgerHourlyCounts = (entries: AttributionLedgerEntry[], date: string) => {
  const counts = new Map<
    string,
    {
      paymentSuccessEntries: number;
      paymentSuccessByCaptureMode: AttributionCaptureModeCounts;
      checkoutEntries: number;
    }
  >();

  for (const entry of entries) {
    const dateHour = toKstDateHour(entry.loggedAt);
    if (!dateHour || dateHour.date !== date) {
      continue;
    }

    const current = counts.get(dateHour.hour) ?? {
      paymentSuccessEntries: 0,
      paymentSuccessByCaptureMode: createCaptureModeCounts(),
      checkoutEntries: 0,
    };
    if (entry.touchpoint === "payment_success") {
      current.paymentSuccessEntries += 1;
      current.paymentSuccessByCaptureMode[entry.captureMode] += 1;
    }
    if (entry.touchpoint === "checkout_started") current.checkoutEntries += 1;
    counts.set(dateHour.hour, current);
  }

  return counts;
};

export const buildAttributionHourlyCompare = (params: {
  date: string;
  ledgerEntries: AttributionLedgerEntry[];
  tossHourlyRows: TossHourlyRow[];
}): AttributionHourlyCompareRow[] => {
  const ledgerMap = buildLedgerHourlyCounts(params.ledgerEntries, params.date);
  const tossMap = new Map(
    params.tossHourlyRows.map((row) => [row.dateHour.slice(11, 13), row]),
  );

  return Array.from({ length: 24 }, (_, hourIndex) => hourIndex.toString().padStart(2, "0")).map((hour) => {
    const toss = tossMap.get(hour);
    const ledger = ledgerMap.get(hour);
    const livePaymentSuccessEntries = ledger?.paymentSuccessByCaptureMode.live ?? 0;
    const replayPaymentSuccessEntries = ledger?.paymentSuccessByCaptureMode.replay ?? 0;
    const smokePaymentSuccessEntries = ledger?.paymentSuccessByCaptureMode.smoke ?? 0;

    let diagnosticLabel = "정상 범위";
    if ((toss?.approvalCount ?? 0) > 0 && livePaymentSuccessEntries === 0 && replayPaymentSuccessEntries > 0) {
      diagnosticLabel = "replay row는 있으나 live payment success receiver가 비어 있음";
    } else if ((toss?.approvalCount ?? 0) > 0 && (ledger?.paymentSuccessEntries ?? 0) === 0) {
      diagnosticLabel = "토스 승인만 있고 payment success receiver가 비어 있음";
    } else if ((ledger?.paymentSuccessEntries ?? 0) > 0 && (toss?.approvalCount ?? 0) === 0) {
      diagnosticLabel = "receiver row는 있으나 토스 승인 집계와 분리됨";
    }

    return {
      dateHour: `${params.date} ${hour}:00`,
      tossApprovalCount: toss?.approvalCount ?? 0,
      tossApprovalAmount: toss?.totalAmount ?? 0,
      paymentSuccessEntries: ledger?.paymentSuccessEntries ?? 0,
      livePaymentSuccessEntries,
      replayPaymentSuccessEntries,
      smokePaymentSuccessEntries,
      checkoutEntries: ledger?.checkoutEntries ?? 0,
      diagnosticLabel,
    };
  });
};

export const buildTossJoinReport = (
  entries: AttributionLedgerEntry[],
  tossRows: TossJoinRow[],
  limit = 50,
) => {
  const relevantEntries = entries.filter((entry) => entry.touchpoint === "payment_success");
  const { byPaymentKey, byOrderId } = buildAttributionIndex(relevantEntries);
  const matchedEntryKeys = new Set<string>();
  const matchedTossRowsByCaptureMode = createCaptureModeCounts();
  const entriesWithPaymentKey = relevantEntries.filter((entry) => Boolean(entry.paymentKey)).length;
  const entriesWithOrderId = relevantEntries.filter((entry) => Boolean(entry.orderId)).length;
  const entriesWithBothKeys = relevantEntries.filter((entry) => Boolean(entry.paymentKey && entry.orderId)).length;
  const paymentSuccessEntriesByCaptureMode = createCaptureModeCounts();
  for (const entry of relevantEntries) {
    paymentSuccessEntriesByCaptureMode[entry.captureMode] += 1;
  }
  let matchedByPaymentKey = 0;
  let matchedByOrderId = 0;
  const items = tossRows.slice(0, Math.max(1, Math.min(limit, 500))).map((row) => {
    const paymentKeyMatch = row.paymentKey ? byPaymentKey.get(row.paymentKey) : undefined;
    const orderIdMatch = paymentKeyMatch ? undefined : row.orderId ? byOrderId.get(row.orderId) : undefined;
    const match = paymentKeyMatch ?? orderIdMatch;
    const matchType = paymentKeyMatch ? "payment_key" : orderIdMatch ? "order_id" : "unmatched";

    if (matchType === "payment_key") matchedByPaymentKey += 1;
    if (matchType === "order_id") matchedByOrderId += 1;

    if (match) {
      matchedEntryKeys.add(`${match.loggedAt}:${match.paymentKey}:${match.orderId}`);
      matchedTossRowsByCaptureMode[match.captureMode] += 1;
    }

    return {
      paymentKey: row.paymentKey,
      orderId: row.orderId,
      approvedAt: row.approvedAt,
      status: row.status,
      channel: row.channel,
      store: row.store,
      totalAmount: row.totalAmount,
      attributionMatchType: matchType,
      attribution: match
        ? {
            captureMode: match.captureMode,
            loggedAt: match.loggedAt,
            landing: match.landing,
            referrer: match.referrer,
            gaSessionId: match.gaSessionId,
            utmSource: match.utmSource,
            utmMedium: match.utmMedium,
            utmCampaign: match.utmCampaign,
            gclid: match.gclid,
            fbclid: match.fbclid,
            ttclid: match.ttclid,
            requestContext: match.requestContext,
          }
        : null,
    };
  });

  const unmatchedLedgerEntries = relevantEntries.filter(
    (entry) => !matchedEntryKeys.has(`${entry.loggedAt}:${entry.paymentKey}:${entry.orderId}`),
  );
  const unmatchedLedgerEntriesByCaptureMode = createCaptureModeCounts();
  for (const entry of unmatchedLedgerEntries) {
    unmatchedLedgerEntriesByCaptureMode[entry.captureMode] += 1;
  }

  const matchedCount = items.filter((item) => item.attributionMatchType !== "unmatched").length;
  const matchedLedgerEntries = relevantEntries.length - unmatchedLedgerEntries.length;

  return {
    summary: {
      tossRows: items.length,
      paymentSuccessEntries: relevantEntries.length,
      matchedTossRows: matchedCount,
      matchedByPaymentKey,
      matchedByOrderId,
      unmatchedTossRows: items.length - matchedCount,
      unmatchedLedgerEntries: unmatchedLedgerEntries.length,
      paymentSuccessEntriesWithPaymentKey: entriesWithPaymentKey,
      paymentSuccessEntriesWithOrderId: entriesWithOrderId,
      paymentSuccessEntriesWithBothKeys: entriesWithBothKeys,
      joinCoverageRate: items.length > 0 ? +((matchedCount / items.length) * 100).toFixed(1) : 0,
      ledgerCoverageRate:
        relevantEntries.length > 0 ? +((matchedLedgerEntries / relevantEntries.length) * 100).toFixed(1) : 0,
      byCaptureMode: {
        live: {
          paymentSuccessEntries: paymentSuccessEntriesByCaptureMode.live,
          matchedTossRows: matchedTossRowsByCaptureMode.live,
          unmatchedLedgerEntries: unmatchedLedgerEntriesByCaptureMode.live,
          joinCoverageRate: items.length > 0 ? +((matchedTossRowsByCaptureMode.live / items.length) * 100).toFixed(1) : 0,
          ledgerCoverageRate:
            paymentSuccessEntriesByCaptureMode.live > 0
              ? +(((paymentSuccessEntriesByCaptureMode.live - unmatchedLedgerEntriesByCaptureMode.live) / paymentSuccessEntriesByCaptureMode.live) * 100).toFixed(1)
              : 0,
        },
        replay: {
          paymentSuccessEntries: paymentSuccessEntriesByCaptureMode.replay,
          matchedTossRows: matchedTossRowsByCaptureMode.replay,
          unmatchedLedgerEntries: unmatchedLedgerEntriesByCaptureMode.replay,
          joinCoverageRate: items.length > 0 ? +((matchedTossRowsByCaptureMode.replay / items.length) * 100).toFixed(1) : 0,
          ledgerCoverageRate:
            paymentSuccessEntriesByCaptureMode.replay > 0
              ? +(((paymentSuccessEntriesByCaptureMode.replay - unmatchedLedgerEntriesByCaptureMode.replay) / paymentSuccessEntriesByCaptureMode.replay) * 100).toFixed(1)
              : 0,
        },
        smoke: {
          paymentSuccessEntries: paymentSuccessEntriesByCaptureMode.smoke,
          matchedTossRows: matchedTossRowsByCaptureMode.smoke,
          unmatchedLedgerEntries: unmatchedLedgerEntriesByCaptureMode.smoke,
          joinCoverageRate: items.length > 0 ? +((matchedTossRowsByCaptureMode.smoke / items.length) * 100).toFixed(1) : 0,
          ledgerCoverageRate:
            paymentSuccessEntriesByCaptureMode.smoke > 0
              ? +(((paymentSuccessEntriesByCaptureMode.smoke - unmatchedLedgerEntriesByCaptureMode.smoke) / paymentSuccessEntriesByCaptureMode.smoke) * 100).toFixed(1)
              : 0,
        },
      },
    },
    items,
    unmatchedLedgerEntries: unmatchedLedgerEntries.slice(0, 20).map((entry) => ({
      captureMode: entry.captureMode,
      loggedAt: entry.loggedAt,
      orderId: entry.orderId,
      paymentKey: entry.paymentKey,
      landing: entry.landing,
      gaSessionId: entry.gaSessionId,
      utmSource: entry.utmSource,
      utmCampaign: entry.utmCampaign,
    })),
  };
};

export const normalizeApprovedAtToIso = (value: string, fallback = new Date().toISOString()) => {
  const trimmed = value.trim();
  if (!trimmed) return fallback;

  const candidates = [
    trimmed,
    trimmed.includes("T") ? trimmed : trimmed.replace(" ", "T"),
    /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(trimmed) ? `${trimmed.replace(" ", "T")}+09:00` : "",
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(trimmed) ? `${trimmed}+09:00` : "",
  ].filter(Boolean);

  for (const candidate of candidates) {
    const parsed = new Date(candidate);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  return fallback;
};

export const buildTossReplayPlan = (
  existingEntries: AttributionLedgerEntry[],
  tossRows: TossJoinRow[],
  limit = 100,
): TossReplayPlan => {
  const existingPaymentKeys = new Set(existingEntries.map((entry) => entry.paymentKey).filter(Boolean));
  const existingOrderIds = new Set(existingEntries.map((entry) => entry.orderId).filter(Boolean));
  const candidateRows = tossRows.slice(0, Math.max(1, Math.min(limit, 500)));
  const insertableEntries: AttributionLedgerEntry[] = [];
  const skippedRows: TossReplayPlan["skippedRows"] = [];

  for (const row of candidateRows) {
    const paymentKeyExists = Boolean(row.paymentKey && existingPaymentKeys.has(row.paymentKey));
    const orderIdExists = Boolean(row.orderId && existingOrderIds.has(row.orderId));

    if (paymentKeyExists || orderIdExists) {
      skippedRows.push({
        paymentKey: row.paymentKey,
        orderId: row.orderId,
        approvedAt: row.approvedAt,
        reason: paymentKeyExists && orderIdExists ? "paymentKey/orderId already exists" : paymentKeyExists ? "paymentKey already exists" : "orderId already exists",
      });
      continue;
    }

    const replayEntry = buildLedgerEntry(
      "payment_success",
      {
        orderId: row.orderId,
        paymentKey: row.paymentKey,
        approvedAt: row.approvedAt,
        captureMode: "replay",
        metadata: {
          replaySource: "tb_sales_toss",
          status: row.status,
          channel: row.channel,
          store: row.store,
          totalAmount: row.totalAmount,
        },
      },
      {
        ip: "",
        userAgent: "system:replay",
        origin: "",
        requestReferer: "",
        method: "REPLAY",
        path: "/api/attribution/replay/toss",
      },
      normalizeApprovedAtToIso(row.approvedAt),
    );
    insertableEntries.push(replayEntry);
    if (replayEntry.paymentKey) existingPaymentKeys.add(replayEntry.paymentKey);
    if (replayEntry.orderId) existingOrderIds.add(replayEntry.orderId);
  }

  return {
    summary: {
      tossRows: tossRows.length,
      candidateRows: candidateRows.length,
      insertableRows: insertableEntries.length,
      skippedExistingRows: skippedRows.length,
    },
    insertableEntries,
    skippedRows,
  };
};
