import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

import { readLedgerEntries, type AttributionLedgerEntry } from "./attribution";
import { env } from "./env";
import { getTossBasicAuth, inferTossStoreFromPaymentKey } from "./tossConfig";

const META_GRAPH_URL = "https://graph.facebook.com/v22.0";
const TOSS_BASE_URL = "https://api.tosspayments.com";
const DEFAULT_EVENT_NAME = "Purchase";
const DEFAULT_ACTION_SOURCE = "website";
const DEFAULT_CURRENCY = "KRW";
const DEFAULT_CONTENT_TYPE = "product";
const BIOCOM_PIXEL_PLACEHOLDER = "TODO_BIOCOM_PIXEL_ID";

export const META_CAPI_LOG_PATH = path.resolve(__dirname, "..", "logs", "meta-capi-sends.jsonl");
const META_CAPI_SYNC_LOCK_PATH = path.resolve(__dirname, "..", "logs", "meta-capi-sync.lock");
const META_CAPI_SYNC_LOCK_STALE_MS = 45 * 60 * 1000;

let operationalMetaCapiSyncInFlight = false;

type MetaCapiResponseBody = Record<string, unknown> | string;

type MetaCapiUserData = {
  em?: string[];
  ph?: string[];
  client_ip_address?: string;
  client_user_agent?: string;
  fbc?: string;
  fbp?: string;
};

type MetaCapiContent = {
  id: string;
  quantity?: number;
  item_price?: number;
};

type MetaCapiEvent = {
  event_name: string;
  event_time: number;
  event_id: string;
  action_source: "website";
  event_source_url?: string;
  user_data: MetaCapiUserData;
  custom_data: {
    currency: string;
    value: number;
    order_id: string;
    content_type: string;
    content_ids?: string[];
    contents?: MetaCapiContent[];
  };
};

type MetaCapiSendRequest = {
  data: [MetaCapiEvent];
  test_event_code?: string;
};

type TossPayment = {
  paymentKey?: string;
  orderId?: string;
  status?: string;
  method?: string;
  totalAmount?: number;
  approvedAt?: string;
  customerEmail?: string;
  customerName?: string;
  customerMobilePhone?: string;
  receipt?: { url?: string };
  card?: Record<string, unknown>;
  virtualAccount?: Record<string, unknown>;
};

type LedgerEntrySummary = {
  orderId: string;
  paymentKey: string;
  touchpoint: string;
  captureMode: string;
  source: string;
  approvedAt: string;
  loggedAt: string;
  value: number | null;
  landing?: string;
  referrer?: string;
  requestOrigin?: string;
  requestPath?: string;
};

export type MetaCapiSendLogRecord = {
  event_id: string;
  pixel_id: string;
  event_name: string;
  timestamp: string;
  response_status: number;
  ledger_entry: LedgerEntrySummary;
  response_body?: MetaCapiResponseBody;
  event_source_url?: string;
  send_path?: MetaCapiSendPath;
  test_event_code?: string;
};

export type MetaCapiLogSegment = "operational" | "manual" | "test";
export type MetaCapiSendPath = "auto_sync" | "manual_api" | "test_event" | "unknown";
export type MetaCapiOrderEventDuplicateClassification =
  | "same_event_id_retry_like"
  | "multiple_event_ids_duplicate_risk";

export type MetaCapiDedupCandidateDetail = {
  orderId: string;
  eventName: string;
  count: number;
  uniqueEventIds: number;
  firstSentAt: string;
  lastSentAt: string;
  classification: MetaCapiOrderEventDuplicateClassification;
  rows: Array<{
    createdAt: string;
    eventId: string;
    responseStatus: number;
    pixelId: string;
    eventSourceUrl: string;
    mode: MetaCapiLogSegment;
    sendPath: MetaCapiSendPath;
    orderId: string;
    paymentKey: string;
    touchpoint: string;
    captureMode: string;
    source: string;
    approvedAt: string;
    loggedAt: string;
    ledgerLanding: string;
    ledgerReferrer: string;
    requestOrigin: string;
    requestPath: string;
  }>;
};

export type MetaCapiLogDiagnostics = {
  total: number;
  success: number;
  failure: number;
  countsByPixelId: Record<string, number>;
  countsBySegment: Record<MetaCapiLogSegment, number>;
  uniqueEventIds: number;
  duplicateEventIds: number;
  duplicateEventIdGroups: number;
  duplicateEventIdSamples: Array<{
    eventId: string;
    count: number;
    orderEventKeys: number;
    firstSentAt: string;
    lastSentAt: string;
    segments: Record<MetaCapiLogSegment, number>;
  }>;
  uniqueOrderEventKeys: number;
  duplicateOrderEventKeys: number;
  duplicateOrderEventGroups: number;
  duplicateOrderEventBreakdown: {
    retryLikeGroups: number;
    retryLikeRows: number;
    multiEventIdGroups: number;
    multiEventIdRows: number;
  };
  duplicateOrderEventSamples: Array<{
    orderId: string;
    eventName: string;
    count: number;
    uniqueEventIds: number;
    firstSentAt: string;
    lastSentAt: string;
    classification: MetaCapiOrderEventDuplicateClassification;
    eventIds: string[];
    segments: Record<MetaCapiLogSegment, number>;
    success: number;
    failure: number;
  }>;
};

export type MetaCapiSendInput = {
  orderId: string;
  paymentKey?: string;
  source?: string;
  pixelId?: string;
  approvedAt?: string;
  loggedAt?: string;
  value?: number;
  email?: string;
  phone?: string;
  clientIpAddress?: string;
  clientUserAgent?: string;
  fbc?: string;
  fbp?: string;
  fbclid?: string;
  landing?: string;
  referrer?: string;
  origin?: string;
  eventName?: string;
  testEventCode?: string;
  ledgerEntry?: AttributionLedgerEntry;
  metadata?: Record<string, unknown>;
};

type PreparedMetaCapiSend = {
  request: MetaCapiSendRequest;
  pixelId: string;
  eventId: string;
  eventName: string;
  eventSourceUrl?: string;
  ledgerSummary: LedgerEntrySummary;
};

export type MetaCapiSendResult = {
  ok: true;
  pixelId: string;
  eventId: string;
  eventName: string;
  status: number;
  response: MetaCapiResponseBody;
  event: MetaCapiEvent;
};

export type MetaCapiSyncItem = {
  orderId: string;
  paymentKey: string;
  source: string;
  status: "sent" | "skipped" | "failed";
  eventId?: string;
  pixelId?: string;
  reason?: string;
  responseStatus?: number;
};

export type MetaCapiSyncResult = {
  ok: true;
  totalCandidates: number;
  sent: number;
  skipped: number;
  failed: number;
  skippedAlreadySent: number;
  skippedSyncAlreadyRunning: number;
  items: MetaCapiSyncItem[];
};

type MetaCapiSyncParams = {
  limit?: number;
  testEventCode?: string;
  orderId?: string;
  paymentKey?: string;
};

export const selectMetaCapiSyncCandidates = (
  entries: AttributionLedgerEntry[],
  limit = Number.POSITIVE_INFINITY,
  filter?: {
    orderId?: string;
    paymentKey?: string;
  },
) =>
  entries
    .filter(
      (entry) =>
        entry.touchpoint === "payment_success" &&
        entry.captureMode === "live" &&
        entry.paymentStatus === "confirmed",
    )
    .filter((entry) => {
      const targetOrderId = filter?.orderId?.trim();
      const targetPaymentKey = filter?.paymentKey?.trim();
      if (targetOrderId && entry.orderId !== targetOrderId) return false;
      if (targetPaymentKey && entry.paymentKey !== targetPaymentKey) return false;
      return true;
    })
    .slice(0, limit);

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return !!value && typeof value === "object" && !Array.isArray(value);
};

const pickString = (
  input: Record<string, unknown>,
  keys: string[],
): string => {
  for (const key of keys) {
    const value = input[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
};

const pickNumber = (
  input: Record<string, unknown>,
  keys: string[],
): number | undefined => {
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

const hashSha256 = (value: string) => createHash("sha256").update(value).digest("hex");

const normalizeEmail = (value: string) => value.trim().toLowerCase();

const normalizePhone = (value: string) => value.trim().toLowerCase().replace(/\D+/g, "");

const hashEmail = (value?: string) => {
  if (!value) return undefined;
  const normalized = normalizeEmail(value);
  return normalized ? hashSha256(normalized) : undefined;
};

const hashPhone = (value?: string) => {
  if (!value) return undefined;
  const normalized = normalizePhone(value);
  return normalized ? hashSha256(normalized) : undefined;
};

const parseUrlValue = (value?: string) => {
  if (!value) return null;
  try {
    return new URL(value);
  } catch {
    return null;
  }
};

const queryParamFromUrls = (
  key: string,
  urls: Array<string | undefined>,
): string => {
  for (const value of urls) {
    const parsed = parseUrlValue(value);
    const found = parsed?.searchParams.get(key)?.trim();
    if (found) return found;
  }
  return "";
};

const resolveIsoDate = (value?: string) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const resolveEventTime = (value?: string) => {
  const parsed = resolveIsoDate(value);
  if (parsed) {
    return Math.floor(parsed.getTime() / 1000);
  }
  return Math.floor(Date.now() / 1000);
};

const resolveEventIdTime = (value?: string) => {
  const parsed = resolveIsoDate(value);
  if (parsed) {
    return String(parsed.getTime());
  }
  return String(Date.now());
};

const normalizeOrderIdForCapiDedupe = (value?: string | null) => {
  const trimmed = value?.trim() ?? "";
  return trimmed.replace(/-P\d+$/i, "");
};

const normalizeEventNameForCapiEventId = (value?: string | null) => {
  const normalized = (value?.trim() || DEFAULT_EVENT_NAME)
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
  return normalized || "event";
};

const resolveMetaCapiEventTimeSource = (
  input: Pick<MetaCapiSendInput, "approvedAt" | "loggedAt" | "ledgerEntry">,
) => input.approvedAt || input.ledgerEntry?.approvedAt || input.loggedAt || input.ledgerEntry?.loggedAt;

type MetaCapiEventIdInput = Pick<
  MetaCapiSendInput,
  "orderId" | "approvedAt" | "loggedAt" | "ledgerEntry" | "metadata" | "landing" | "referrer"
>;

const resolveImwebOrderCodeForPixelEventId = (input: MetaCapiEventIdInput) => {
  const metadata = {
    ...(input.ledgerEntry?.metadata ?? {}),
    ...(input.metadata ?? {}),
  };
  const directOrderCode = pickString(metadata, ["orderCode", "order_code", "imwebOrderCode"]);
  if (directOrderCode) return directOrderCode;

  const referrerPayment = metadata.referrerPayment;
  if (isRecord(referrerPayment)) {
    const referrerOrderCode = pickString(referrerPayment, ["orderCode", "order_code"]);
    if (referrerOrderCode) return referrerOrderCode;
  }

  return queryParamFromUrls("order_code", [
    input.landing,
    input.ledgerEntry?.landing,
    input.referrer,
    input.ledgerEntry?.referrer,
  ]) || queryParamFromUrls("orderCode", [
    input.landing,
    input.ledgerEntry?.landing,
    input.referrer,
    input.ledgerEntry?.referrer,
  ]);
};

export const buildMetaCapiEventId = (
  input: MetaCapiEventIdInput,
  eventName = DEFAULT_EVENT_NAME,
) => {
  const orderId = normalizeOrderIdForCapiDedupe(input.orderId);
  const eventNameKey = normalizeEventNameForCapiEventId(eventName);
  if (eventNameKey === "purchase") {
    const imwebOrderCode = resolveImwebOrderCodeForPixelEventId(input);
    if (imwebOrderCode) return `Purchase.${imwebOrderCode}`;
  }
  return `${eventNameKey}:${orderId}`;
};

export const buildMetaCapiOrderEventSuccessKey = (params: {
  paymentKey?: string | null;
  orderId?: string | null;
  eventName?: string | null;
}) => {
  const eventName = params.eventName?.trim() || DEFAULT_EVENT_NAME;
  const paymentKey = params.paymentKey?.trim();
  if (paymentKey) return `payment:${paymentKey}|${eventName}`;

  const orderId = normalizeOrderIdForCapiDedupe(params.orderId);
  if (orderId) return `order:${orderId}|${eventName}`;

  return "";
};

const toResponseBody = async (res: Response): Promise<MetaCapiResponseBody> => {
  const text = await res.text();
  if (!text) return "";
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return text;
  }
};

const getMetadataString = (metadata: Record<string, unknown> | undefined, keys: string[]) => {
  if (!metadata) return "";
  return pickString(metadata, keys);
};

const getMetadataNumber = (metadata: Record<string, unknown> | undefined, keys: string[]) => {
  if (!metadata) return undefined;
  return pickNumber(metadata, keys);
};

const getMetadataRecord = (metadata: Record<string, unknown> | undefined, keys: string[]) => {
  if (!metadata) return undefined;
  for (const key of keys) {
    const value = metadata[key];
    if (isRecord(value)) return value;
  }
  return undefined;
};

const getMetadataArray = (metadata: Record<string, unknown> | undefined, keys: string[]) => {
  if (!metadata) return undefined;
  for (const key of keys) {
    const value = metadata[key];
    if (Array.isArray(value)) return value;
  }
  return undefined;
};

const summarizeLedgerEntry = (params: {
  ledgerEntry?: AttributionLedgerEntry;
  input: MetaCapiSendInput;
  resolvedSource: string;
  resolvedValue: number | null;
}): LedgerEntrySummary => {
  const entry = params.ledgerEntry;
  return {
    orderId: params.input.orderId || entry?.orderId || "",
    paymentKey: params.input.paymentKey || entry?.paymentKey || "",
    touchpoint: entry?.touchpoint ?? "manual",
    captureMode: entry?.captureMode ?? "manual",
    source: params.resolvedSource,
    approvedAt: params.input.approvedAt || entry?.approvedAt || "",
    loggedAt: params.input.loggedAt || entry?.loggedAt || "",
    value: params.resolvedValue,
    landing: params.input.landing || entry?.landing || "",
    referrer: params.input.referrer || entry?.referrer || "",
    requestOrigin: params.input.origin || entry?.requestContext.origin || "",
    requestPath: entry?.requestContext.path || "",
  };
};

const isPlaceholderPixelId = (pixelId: string) => pixelId === BIOCOM_PIXEL_PLACEHOLDER;

const resolveSource = (input: MetaCapiSendInput) => {
  const metadata = input.metadata;
  const explicitSource = input.source?.trim() || getMetadataString(metadata, ["source", "site", "store"]);
  if (explicitSource) return explicitSource;

  const origin = input.origin || input.ledgerEntry?.requestContext.origin || "";
  const paymentKey = input.paymentKey || input.ledgerEntry?.paymentKey || "";
  const store = getMetadataString(metadata, ["store"]);

  if (origin.includes("thecleancoffee.com") || paymentKey.startsWith("iw_th")) return "thecleancoffee_imweb";
  if (origin.includes("aibio.ai")) return "aibio";
  if (origin.includes("biocom.kr") || paymentKey.startsWith("iw_bi") || store === "biocom") return "biocom_imweb";
  if (store === "aibio") return "aibio";
  if (store === "thecleancoffee") return "thecleancoffee_imweb";

  return "";
};

const resolvePixelId = (params: {
  source: string;
  explicitPixelId?: string;
}) => {
  if (params.explicitPixelId?.trim()) return params.explicitPixelId.trim();

  switch (params.source) {
    case "thecleancoffee":
    case "thecleancoffee_imweb":
    case "coffee":
    case "coffee_imweb":
      return env.META_PIXEL_ID_COFFEE;
    case "aibio":
    case "aibio_imweb":
      return env.META_PIXEL_ID_AIBIO;
    case "biocom":
    case "biocom_imweb":
      return env.META_PIXEL_ID_BIOCOM;
    default:
      return "";
  }
};

const resolveValue = (input: MetaCapiSendInput) => {
  if (typeof input.value === "number" && Number.isFinite(input.value)) {
    return input.value;
  }

  const metadata = input.metadata ?? input.ledgerEntry?.metadata;
  const direct = getMetadataNumber(metadata, ["value", "amount", "totalAmount"]);
  if (typeof direct === "number") return direct;

  const referrerPayment = getMetadataRecord(metadata, ["referrerPayment"]);
  const referrerAmount = referrerPayment ? pickNumber(referrerPayment, ["amount"]) : undefined;
  if (typeof referrerAmount === "number") return referrerAmount;

  return undefined;
};

const resolveContactValue = (params: {
  inputValue?: string;
  metadata?: Record<string, unknown>;
  keys: string[];
}) => {
  if (params.inputValue?.trim()) return params.inputValue.trim();
  return getMetadataString(params.metadata, params.keys);
};

const resolveFbc = (input: MetaCapiSendInput) => {
  if (input.fbc?.trim()) return input.fbc.trim();

  const metadata = input.metadata ?? input.ledgerEntry?.metadata;
  const existing = getMetadataString(metadata, ["fbc"]);
  if (existing) return existing;

  const fbclid =
    input.fbclid?.trim()
    || input.ledgerEntry?.fbclid
    || getMetadataString(metadata, ["fbclid"])
    || queryParamFromUrls("fbclid", [input.landing, input.referrer, input.ledgerEntry?.landing, input.ledgerEntry?.referrer]);

  if (!fbclid) return "";

  return `fb.1.${resolveEventIdTime(resolveMetaCapiEventTimeSource(input))}.${fbclid}`;
};

const resolveFbp = (input: MetaCapiSendInput) => {
  if (input.fbp?.trim()) return input.fbp.trim();

  const metadata = input.metadata ?? input.ledgerEntry?.metadata;
  return (
    getMetadataString(metadata, ["fbp"])
    || queryParamFromUrls("fbp", [input.landing, input.referrer, input.ledgerEntry?.landing, input.ledgerEntry?.referrer])
  );
};

const defaultOriginForSource = (source: string) => {
  switch (source) {
    case "thecleancoffee":
    case "thecleancoffee_imweb":
    case "coffee":
    case "coffee_imweb":
      return "https://thecleancoffee.com";
    case "aibio":
    case "aibio_imweb":
      return "https://aibio.ai";
    case "biocom":
    case "biocom_imweb":
    default:
      return "https://biocom.kr";
  }
};

const normalizeMetaCapiEventSourceUrl = (params: {
  value?: string;
  source: string;
  requestOrigin?: string;
}) => {
  const value = params.value?.trim();
  if (!value) return undefined;

  try {
    const parsed = new URL(value);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.toString();
    }
  } catch {}

  try {
    if (value.startsWith("//")) {
      return new URL(`https:${value}`).toString();
    }
  } catch {}

  const origin = parseUrlValue(params.requestOrigin)?.origin || defaultOriginForSource(params.source);
  try {
    return new URL(value.startsWith("/") ? value : `/${value}`, origin).toString();
  } catch {
    return undefined;
  }
};

const resolveEventSourceUrl = (input: MetaCapiSendInput, resolvedSource: string) => {
  return normalizeMetaCapiEventSourceUrl({
    value: input.landing || input.ledgerEntry?.landing || input.referrer || input.ledgerEntry?.referrer,
    source: resolvedSource,
    requestOrigin: input.origin || input.ledgerEntry?.requestContext.origin,
  });
};

const normalizeMetaContentId = (value: unknown) => {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
};

const collectMetaContentIds = (metadata: Record<string, unknown> | undefined) => {
  const direct = getMetadataString(metadata, [
    "content_id",
    "contentId",
    "product_id",
    "productId",
    "product_no",
    "productNo",
    "item_id",
    "itemId",
  ]);
  const ids = new Set<string>();
  if (direct) {
    direct.split(",").map((value) => value.trim()).filter(Boolean).forEach((value) => ids.add(value));
  }

  const arrayValues = getMetadataArray(metadata, ["content_ids", "contentIds", "product_ids", "productIds"]);
  for (const value of arrayValues ?? []) {
    const id = normalizeMetaContentId(value);
    if (id) ids.add(id);
  }

  const itemArrays = [
    getMetadataArray(metadata, ["contents"]),
    getMetadataArray(metadata, ["items", "products", "orderItems", "orderProducts"]),
  ].filter(Boolean) as unknown[][];

  for (const values of itemArrays) {
    for (const value of values) {
      if (isRecord(value)) {
        const id = pickString(value, ["id", "content_id", "contentId", "product_id", "productId", "item_id", "itemId"]);
        if (id) ids.add(id);
      }
    }
  }

  return [...ids];
};

const normalizeMetaContentNumber = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return undefined;
};

const collectMetaContents = (metadata: Record<string, unknown> | undefined): MetaCapiContent[] => {
  const contentRows = [
    getMetadataArray(metadata, ["contents"]),
    getMetadataArray(metadata, ["items", "products", "orderItems", "orderProducts"]),
  ].filter(Boolean) as unknown[][];
  const contents: MetaCapiContent[] = [];

  for (const rows of contentRows) {
    for (const row of rows) {
      if (!isRecord(row)) continue;
      const id = pickString(row, ["id", "content_id", "contentId", "product_id", "productId", "item_id", "itemId"]);
      if (!id) continue;
      const quantity = normalizeMetaContentNumber(row.quantity ?? row.qty ?? row.count);
      const itemPrice = normalizeMetaContentNumber(row.item_price ?? row.itemPrice ?? row.price);
      contents.push({
        id,
        ...(quantity ? { quantity } : {}),
        ...(itemPrice ? { item_price: itemPrice } : {}),
      });
    }
  }

  if (contents.length > 0) return contents;

  return collectMetaContentIds(metadata).map((id) => ({ id }));
};

const redactDiagnosticUrl = (value: string) => {
  if (!value) return "";
  try {
    const parsed = new URL(value);
    for (const key of ["paymentKey", "paymentCode", "orderCode", "fbclid", "fbc", "fbp", "gclid", "ttclid"]) {
      if (parsed.searchParams.has(key)) {
        parsed.searchParams.set(key, "__redacted__");
      }
    }
    return parsed.toString();
  } catch {
    return value;
  }
};

const inferMetaCapiSendPath = (row: MetaCapiSendLogRecord): MetaCapiSendPath => {
  if (row.send_path) return row.send_path;
  if (row.test_event_code || classifyMetaCapiLogSegment(row) === "test") return "test_event";
  if (row.ledger_entry?.captureMode === "manual" || row.ledger_entry?.touchpoint === "manual") {
    return "manual_api";
  }
  if (row.ledger_entry?.captureMode === "live" && row.ledger_entry?.touchpoint === "payment_success") {
    return "auto_sync";
  }
  return "unknown";
};

const resolveClientIp = (input: MetaCapiSendInput) => {
  return input.clientIpAddress || input.ledgerEntry?.requestContext.ip || "";
};

const resolveClientUserAgent = (input: MetaCapiSendInput) => {
  return input.clientUserAgent || input.ledgerEntry?.requestContext.userAgent || "";
};

const prepareMetaCapiSend = (input: MetaCapiSendInput): PreparedMetaCapiSend => {
  const eventName = input.eventName?.trim() || DEFAULT_EVENT_NAME;
  const resolvedSource = resolveSource(input);
  const pixelId = resolvePixelId({ source: resolvedSource, explicitPixelId: input.pixelId });

  if (!input.orderId.trim()) {
    throw new Error("orderId 필요");
  }
  if (!pixelId) {
    throw new Error("Pixel ID를 해석할 수 없음");
  }
  if (isPlaceholderPixelId(pixelId)) {
    throw new Error("META_PIXEL_ID_BIOCOM placeholder 상태");
  }

  const value = resolveValue(input);
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new Error("결제 value 필요");
  }

  const eventTimeSource = resolveMetaCapiEventTimeSource(input);
  const eventTime = resolveEventTime(eventTimeSource);
  const eventId = buildMetaCapiEventId(input, eventName);

  const email =
    resolveContactValue({
      inputValue: input.email,
      metadata: input.metadata ?? input.ledgerEntry?.metadata,
      keys: ["email", "customerEmail", "buyerEmail"],
    });
  const phone =
    resolveContactValue({
      inputValue: input.phone,
      metadata: input.metadata ?? input.ledgerEntry?.metadata,
      keys: ["phone", "mobile", "mobilePhone", "customerMobilePhone", "buyerPhone"],
    });

  const userData: MetaCapiUserData = {
    client_ip_address: resolveClientIp(input) || undefined,
    client_user_agent: resolveClientUserAgent(input) || undefined,
    fbc: resolveFbc(input) || undefined,
    fbp: resolveFbp(input) || undefined,
  };

  const hashedEmail = hashEmail(email);
  if (hashedEmail) userData.em = [hashedEmail];

  const hashedPhone = hashPhone(phone);
  if (hashedPhone) userData.ph = [hashedPhone];

  const metadata = input.metadata ?? input.ledgerEntry?.metadata;
  const eventSourceUrl = resolveEventSourceUrl(input, resolvedSource);
  const contentIds = collectMetaContentIds(metadata);
  const contents = collectMetaContents(metadata);
  const event: MetaCapiEvent = {
    event_name: eventName,
    event_time: eventTime,
    event_id: eventId,
    action_source: DEFAULT_ACTION_SOURCE,
    event_source_url: eventSourceUrl,
    user_data: userData,
    custom_data: {
      currency: DEFAULT_CURRENCY,
      value,
      order_id: input.orderId,
      content_type: DEFAULT_CONTENT_TYPE,
      ...(contentIds.length > 0 ? { content_ids: contentIds } : {}),
      ...(contents.length > 0 ? { contents } : {}),
    },
  };

  return {
    request: {
      data: [event],
      ...(input.testEventCode?.trim() ? { test_event_code: input.testEventCode.trim() } : {}),
    },
    pixelId,
    eventId,
    eventName,
    eventSourceUrl,
    ledgerSummary: summarizeLedgerEntry({
      ledgerEntry: input.ledgerEntry,
      input,
      resolvedSource,
      resolvedValue: value,
    }),
  };
};

const fetchTossPayment = async (paymentKey: string): Promise<TossPayment> => {
  const store = inferTossStoreFromPaymentKey(paymentKey);
  const auth = getTossBasicAuth(store, "live");
  if (!auth) {
    throw new Error(
      store === "coffee"
        ? "TOSS_LIVE_SECRET_KEY_COFFEE 미설정"
        : "TOSS_LIVE_SECRET_KEY_BIOCOM 미설정",
    );
  }

  const res = await fetch(`${TOSS_BASE_URL}/v1/payments/${encodeURIComponent(paymentKey)}`, {
    headers: {
      Authorization: auth,
    },
    signal: AbortSignal.timeout(10000),
  });

  const body = await toResponseBody(res);
  if (!res.ok) {
    const message = typeof body === "string" ? body : JSON.stringify(body);
    throw new Error(`Toss API ${res.status}: ${message.slice(0, 200)}`);
  }

  if (!isRecord(body)) {
    return {};
  }

  return {
    paymentKey: typeof body.paymentKey === "string" ? body.paymentKey : undefined,
    orderId: typeof body.orderId === "string" ? body.orderId : undefined,
    status: typeof body.status === "string" ? body.status : undefined,
    method: typeof body.method === "string" ? body.method : undefined,
    totalAmount: typeof body.totalAmount === "number" ? body.totalAmount : undefined,
    approvedAt: typeof body.approvedAt === "string" ? body.approvedAt : undefined,
    customerEmail: typeof body.customerEmail === "string" ? body.customerEmail : undefined,
    customerName: typeof body.customerName === "string" ? body.customerName : undefined,
    customerMobilePhone: typeof body.customerMobilePhone === "string" ? body.customerMobilePhone : undefined,
    receipt: isRecord(body.receipt) ? { url: typeof body.receipt.url === "string" ? body.receipt.url : undefined } : undefined,
    card: isRecord(body.card) ? body.card : undefined,
    virtualAccount: isRecord(body.virtualAccount) ? body.virtualAccount : undefined,
  };
};

const parseJsonlFile = async <T>(filePath: string): Promise<T[]> => {
  try {
    const content = await fs.readFile(filePath, "utf8");
    return content
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as T);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("ENOENT")) return [];
    throw error;
  }
};

export const readMetaCapiSendLogs = async (): Promise<MetaCapiSendLogRecord[]> => {
  const rows = await parseJsonlFile<MetaCapiSendLogRecord>(META_CAPI_LOG_PATH);
  return rows.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
};

const createSegmentCounts = (): Record<MetaCapiLogSegment, number> => ({
  operational: 0,
  manual: 0,
  test: 0,
});

const markSegment = (
  counts: Record<MetaCapiLogSegment, number>,
  segment: MetaCapiLogSegment,
) => {
  counts[segment] += 1;
};

export const classifyMetaCapiLogSegment = (row: MetaCapiSendLogRecord): MetaCapiLogSegment => {
  const eventId = row.event_id?.trim() ?? "";
  const orderId = row.ledger_entry?.orderId?.trim() ?? "";
  const touchpoint = row.ledger_entry?.touchpoint?.trim() ?? "";
  const captureMode = row.ledger_entry?.captureMode?.trim() ?? "";

  if (/^test[_-]/i.test(eventId) || /^test[_-]/i.test(orderId) || captureMode === "test") {
    return "test";
  }
  if (captureMode === "manual" || touchpoint === "manual") {
    return "manual";
  }
  return "operational";
};

export const buildMetaCapiLogDiagnostics = (logs: MetaCapiSendLogRecord[]): MetaCapiLogDiagnostics => {
  const countsByPixelId = logs.reduce<Record<string, number>>((acc, row) => {
    acc[row.pixel_id] = (acc[row.pixel_id] ?? 0) + 1;
    return acc;
  }, {});
  const countsBySegment = createSegmentCounts();
  const eventIds = logs.map((row) => row.event_id).filter(Boolean);
  const eventIdGroups = new Map<
    string,
    {
      eventId: string;
      orderEventKeys: Set<string>;
      count: number;
      firstSentAt: string;
      lastSentAt: string;
      segments: Record<MetaCapiLogSegment, number>;
    }
  >();
  const orderEventGroups = new Map<
    string,
    {
      orderId: string;
      eventName: string;
      eventIds: Set<string>;
      count: number;
      firstSentAt: string;
      lastSentAt: string;
      segments: Record<MetaCapiLogSegment, number>;
      success: number;
      failure: number;
    }
  >();
  let orderEventRows = 0;

  for (const row of logs) {
    const segment = classifyMetaCapiLogSegment(row);
    markSegment(countsBySegment, segment);

    const orderId = row.ledger_entry?.orderId?.trim();
    const eventName = row.event_name?.trim();
    const orderEventKey = orderId && eventName ? `${orderId}|${eventName}` : "";
    const timestamp = row.timestamp || "";

    if (row.event_id) {
      const eventIdGroup = eventIdGroups.get(row.event_id) ?? {
        eventId: row.event_id,
        orderEventKeys: new Set<string>(),
        count: 0,
        firstSentAt: timestamp,
        lastSentAt: timestamp,
        segments: createSegmentCounts(),
      };
      eventIdGroup.count += 1;
      if (orderEventKey) eventIdGroup.orderEventKeys.add(orderEventKey);
      if (!eventIdGroup.firstSentAt || (timestamp && timestamp < eventIdGroup.firstSentAt)) {
        eventIdGroup.firstSentAt = timestamp;
      }
      if (!eventIdGroup.lastSentAt || (timestamp && timestamp > eventIdGroup.lastSentAt)) {
        eventIdGroup.lastSentAt = timestamp;
      }
      markSegment(eventIdGroup.segments, segment);
      eventIdGroups.set(row.event_id, eventIdGroup);
    }

    if (!orderId || !eventName) continue;
    orderEventRows += 1;
    const key = orderEventKey;
    const current = orderEventGroups.get(key) ?? {
      orderId,
      eventName,
      eventIds: new Set<string>(),
      count: 0,
      firstSentAt: timestamp,
      lastSentAt: timestamp,
      segments: createSegmentCounts(),
      success: 0,
      failure: 0,
    };
    current.count += 1;
    if (row.event_id) current.eventIds.add(row.event_id);
    if (!current.firstSentAt || (timestamp && timestamp < current.firstSentAt)) {
      current.firstSentAt = timestamp;
    }
    if (!current.lastSentAt || (timestamp && timestamp > current.lastSentAt)) {
      current.lastSentAt = timestamp;
    }
    markSegment(current.segments, segment);
    if (row.response_status >= 200 && row.response_status < 300) {
      current.success += 1;
    } else {
      current.failure += 1;
    }
    orderEventGroups.set(key, current);
  }

  const duplicateEventIdGroups = [...eventIdGroups.values()].filter((row) => row.count > 1);
  const duplicateEventIdSamples = duplicateEventIdGroups
    .sort((a, b) => b.count - a.count || a.eventId.localeCompare(b.eventId))
    .slice(0, 20)
    .map((row) => ({
      eventId: row.eventId,
      count: row.count,
      orderEventKeys: row.orderEventKeys.size,
      firstSentAt: row.firstSentAt,
      lastSentAt: row.lastSentAt,
      segments: row.segments,
    }));

  const duplicateOrderEventGroups = [...orderEventGroups.values()].filter((row) => row.count > 1);
  const retryLikeGroups = duplicateOrderEventGroups.filter((row) => row.eventIds.size <= 1);
  const multiEventIdGroups = duplicateOrderEventGroups.filter((row) => row.eventIds.size > 1);
  const duplicateOrderEventSamples = duplicateOrderEventGroups
    .sort((a, b) => b.count - a.count || a.orderId.localeCompare(b.orderId))
    .slice(0, 20)
    .map((row) => ({
      orderId: row.orderId,
      eventName: row.eventName,
      count: row.count,
      uniqueEventIds: row.eventIds.size,
      firstSentAt: row.firstSentAt,
      lastSentAt: row.lastSentAt,
      classification: row.eventIds.size <= 1
        ? "same_event_id_retry_like" as const
        : "multiple_event_ids_duplicate_risk" as const,
      eventIds: [...row.eventIds].slice(0, 5),
      segments: row.segments,
      success: row.success,
      failure: row.failure,
    }));

  return {
    total: logs.length,
    success: logs.filter((row) => row.response_status >= 200 && row.response_status < 300).length,
    failure: logs.filter((row) => row.response_status < 200 || row.response_status >= 300).length,
    countsByPixelId,
    countsBySegment,
    uniqueEventIds: new Set(eventIds).size,
    duplicateEventIds: eventIds.length - new Set(eventIds).size,
    duplicateEventIdGroups: duplicateEventIdGroups.length,
    duplicateEventIdSamples,
    uniqueOrderEventKeys: orderEventGroups.size,
    duplicateOrderEventKeys: orderEventRows - orderEventGroups.size,
    duplicateOrderEventGroups: duplicateOrderEventGroups.length,
    duplicateOrderEventBreakdown: {
      retryLikeGroups: retryLikeGroups.length,
      retryLikeRows: retryLikeGroups.reduce((sum, row) => sum + row.count, 0),
      multiEventIdGroups: multiEventIdGroups.length,
      multiEventIdRows: multiEventIdGroups.reduce((sum, row) => sum + row.count, 0),
    },
    duplicateOrderEventSamples,
  };
};

const indexLedgerEntriesByOrderAndPayment = (entries: AttributionLedgerEntry[]) => {
  const byOrderAndPayment = new Map<string, AttributionLedgerEntry>();
  const byOrderId = new Map<string, AttributionLedgerEntry>();
  const byPaymentKey = new Map<string, AttributionLedgerEntry>();

  for (const entry of entries) {
    if (entry.orderId && entry.paymentKey) {
      byOrderAndPayment.set(`${entry.orderId}|${entry.paymentKey}`, entry);
    }
    if (entry.orderId && !byOrderId.has(entry.orderId)) {
      byOrderId.set(entry.orderId, entry);
    }
    if (entry.paymentKey && !byPaymentKey.has(entry.paymentKey)) {
      byPaymentKey.set(entry.paymentKey, entry);
    }
  }

  return { byOrderAndPayment, byOrderId, byPaymentKey };
};

const findLedgerEntryForCapiLog = (
  row: MetaCapiSendLogRecord,
  index: ReturnType<typeof indexLedgerEntriesByOrderAndPayment>,
) => {
  const orderId = row.ledger_entry?.orderId ?? "";
  const paymentKey = row.ledger_entry?.paymentKey ?? "";

  if (orderId && paymentKey) {
    const exact = index.byOrderAndPayment.get(`${orderId}|${paymentKey}`);
    if (exact) return exact;
  }
  if (orderId) {
    const byOrder = index.byOrderId.get(orderId);
    if (byOrder) return byOrder;
  }
  if (paymentKey) {
    const byPayment = index.byPaymentKey.get(paymentKey);
    if (byPayment) return byPayment;
  }
  return undefined;
};

export const buildMetaCapiDedupCandidateDetails = async (
  logs: MetaCapiSendLogRecord[],
  params?: {
    limit?: number;
    classification?: MetaCapiOrderEventDuplicateClassification | "all";
  },
): Promise<MetaCapiDedupCandidateDetail[]> => {
  const classificationFilter = params?.classification ?? "multiple_event_ids_duplicate_risk";
  const limit = params?.limit && params.limit > 0 ? params.limit : 3;
  const ledgerIndex = indexLedgerEntriesByOrderAndPayment(await readLedgerEntries());
  const groups = new Map<
    string,
    {
      orderId: string;
      eventName: string;
      eventIds: Set<string>;
      firstSentAt: string;
      lastSentAt: string;
      rows: MetaCapiSendLogRecord[];
    }
  >();

  for (const row of logs) {
    const orderId = row.ledger_entry?.orderId?.trim();
    const eventName = row.event_name?.trim();
    if (!orderId || !eventName) continue;

    const key = `${orderId}|${eventName}`;
    const current = groups.get(key) ?? {
      orderId,
      eventName,
      eventIds: new Set<string>(),
      firstSentAt: row.timestamp || "",
      lastSentAt: row.timestamp || "",
      rows: [],
    };
    current.rows.push(row);
    if (row.event_id) current.eventIds.add(row.event_id);
    if (row.timestamp && (!current.firstSentAt || row.timestamp < current.firstSentAt)) {
      current.firstSentAt = row.timestamp;
    }
    if (row.timestamp && (!current.lastSentAt || row.timestamp > current.lastSentAt)) {
      current.lastSentAt = row.timestamp;
    }
    groups.set(key, current);
  }

  return [...groups.values()]
    .filter((group) => group.rows.length > 1)
    .map((group) => {
      const classification: MetaCapiOrderEventDuplicateClassification = group.eventIds.size <= 1
        ? "same_event_id_retry_like"
        : "multiple_event_ids_duplicate_risk";
      return { ...group, classification };
    })
    .filter((group) => classificationFilter === "all" || group.classification === classificationFilter)
    .sort((a, b) => b.rows.length - a.rows.length || a.orderId.localeCompare(b.orderId))
    .slice(0, limit)
    .map((group) => ({
      orderId: group.orderId,
      eventName: group.eventName,
      count: group.rows.length,
      uniqueEventIds: group.eventIds.size,
      firstSentAt: group.firstSentAt,
      lastSentAt: group.lastSentAt,
      classification: group.classification,
      rows: group.rows
        .slice()
        .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
        .map((row) => {
          const ledgerEntry = findLedgerEntryForCapiLog(row, ledgerIndex);
          const ledgerSummary = row.ledger_entry;
          return {
            createdAt: row.timestamp,
            eventId: row.event_id,
            responseStatus: row.response_status,
            pixelId: row.pixel_id,
            eventSourceUrl: redactDiagnosticUrl(
              row.event_source_url
              || ledgerSummary?.landing
              || ledgerEntry?.landing
              || ledgerSummary?.referrer
              || ledgerEntry?.referrer
              || "",
            ),
            mode: classifyMetaCapiLogSegment(row),
            sendPath: inferMetaCapiSendPath(row),
            orderId: ledgerSummary?.orderId || ledgerEntry?.orderId || "",
            paymentKey: ledgerSummary?.paymentKey || ledgerEntry?.paymentKey || "",
            touchpoint: ledgerSummary?.touchpoint || ledgerEntry?.touchpoint || "",
            captureMode: ledgerSummary?.captureMode || ledgerEntry?.captureMode || "",
            source: ledgerSummary?.source || (typeof ledgerEntry?.metadata?.source === "string" ? ledgerEntry.metadata.source : ""),
            approvedAt: ledgerSummary?.approvedAt || ledgerEntry?.approvedAt || "",
            loggedAt: ledgerSummary?.loggedAt || ledgerEntry?.loggedAt || "",
            ledgerLanding: redactDiagnosticUrl(ledgerSummary?.landing || ledgerEntry?.landing || ""),
            ledgerReferrer: redactDiagnosticUrl(ledgerSummary?.referrer || ledgerEntry?.referrer || ""),
            requestOrigin: ledgerSummary?.requestOrigin || ledgerEntry?.requestContext.origin || "",
            requestPath: ledgerSummary?.requestPath || ledgerEntry?.requestContext.path || "",
          };
        }),
    }));
};

const appendMetaCapiLog = async (record: MetaCapiSendLogRecord) => {
  await fs.mkdir(path.dirname(META_CAPI_LOG_PATH), { recursive: true });
  await fs.appendFile(META_CAPI_LOG_PATH, `${JSON.stringify(record)}\n`, "utf8");
};

const readSuccessfulCapiSendHistory = async () => {
  const logs = await readMetaCapiSendLogs();
  const successfulOperationalLogs = logs.filter(
    (row) =>
      row.response_status >= 200 &&
      row.response_status < 300 &&
      classifyMetaCapiLogSegment(row) === "operational" &&
      inferMetaCapiSendPath(row) === "auto_sync",
  );

  return {
    eventIds: new Set(successfulOperationalLogs.map((row) => row.event_id)),
    orderEventKeys: new Set(
      successfulOperationalLogs
        .map((row) =>
          buildMetaCapiOrderEventSuccessKey({
            paymentKey: row.ledger_entry?.paymentKey,
            orderId: row.ledger_entry?.orderId,
            eventName: row.event_name,
          }),
        )
        .filter(Boolean),
    ),
  };
};

type SuccessfulCapiSendHistory = Awaited<ReturnType<typeof readSuccessfulCapiSendHistory>>;

const getSuccessfulCapiSendDuplicateReason = (
  history: SuccessfulCapiSendHistory,
  eventId: string,
  orderEventKey: string | null,
) => {
  if (history.eventIds.has(eventId)) {
    return "duplicate_event_id";
  }
  if (orderEventKey && history.orderEventKeys.has(orderEventKey)) {
    return "duplicate_order_event_success";
  }
  return "";
};

type MetaCapiSyncLock = {
  release: () => Promise<void>;
};

const getErrorCode = (error: unknown) => {
  const code = (error as { code?: unknown })?.code;
  return typeof code === "string" ? code : "";
};

const isOperationalMetaCapiSyncLockStale = async () => {
  try {
    const stat = await fs.stat(META_CAPI_SYNC_LOCK_PATH);
    return Date.now() - stat.mtimeMs > META_CAPI_SYNC_LOCK_STALE_MS;
  } catch (error) {
    if (getErrorCode(error) === "ENOENT") return true;
    throw error;
  }
};

const acquireOperationalMetaCapiSyncLock = async (): Promise<MetaCapiSyncLock | null> => {
  await fs.mkdir(path.dirname(META_CAPI_SYNC_LOCK_PATH), { recursive: true });

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const handle = await fs.open(META_CAPI_SYNC_LOCK_PATH, "wx");
      try {
        await handle.writeFile(JSON.stringify({
          pid: process.pid,
          acquiredAt: new Date().toISOString(),
        }));
      } catch (error) {
        await handle.close();
        await fs.rm(META_CAPI_SYNC_LOCK_PATH, { force: true });
        throw error;
      }
      await handle.close();

      let released = false;
      return {
        release: async () => {
          if (released) return;
          released = true;
          await fs.rm(META_CAPI_SYNC_LOCK_PATH, { force: true });
        },
      };
    } catch (error) {
      if (getErrorCode(error) !== "EEXIST") {
        throw error;
      }
      if (attempt === 0 && await isOperationalMetaCapiSyncLockStale()) {
        await fs.rm(META_CAPI_SYNC_LOCK_PATH, { force: true });
        continue;
      }
      return null;
    }
  }

  return null;
};

export const buildMetaCapiSyncAlreadyRunningResult = (): MetaCapiSyncResult => ({
  ok: true,
  totalCandidates: 0,
  sent: 0,
  skipped: 1,
  failed: 0,
  skippedAlreadySent: 0,
  skippedSyncAlreadyRunning: 1,
  items: [
    {
      orderId: "",
      paymentKey: "",
      source: "auto_sync",
      status: "skipped",
      reason: "sync_already_running",
    },
  ],
});

const resolveCapiToken = (pixelId: string): { token: string; kind: "coffee_system_user" | "coffee_app" | "global"; } => {
  if (pixelId && pixelId === env.META_PIXEL_ID_COFFEE) {
    const sysUser = env.COFFEE_META_TOKEN?.trim();
    if (sysUser) return { token: sysUser, kind: "coffee_system_user" };
    const coffeeApp = env.META_ADMANAGER_API_KEY_COFFEE?.trim();
    if (coffeeApp) return { token: coffeeApp, kind: "coffee_app" };
  }
  const global = env.META_ADMANAGER_API_KEY?.trim() ?? "";
  return { token: global, kind: "global" };
};

// Funnel 이벤트 (ViewContent · AddToCart · InitiateCheckout · AddPaymentInfo · Lead) 전용 경량 전송 함수.
// sendMetaConversion 은 Purchase 중심이라 orderId/PII 필수 구조 — funnel 은 익명 브라우저 행동이라 별도 경로.
// 상세 설계: meta/capimeta.md §Funnel 이벤트 확장 개선 계획 §4 Day 1
export type FunnelEventName = "ViewContent" | "AddToCart" | "InitiateCheckout" | "AddPaymentInfo" | "Lead" | "Search";

export type FunnelEventInput = {
  eventName: FunnelEventName;
  pixelId: string;
  eventId: string;
  eventSourceUrl: string;
  clientIpAddress?: string;
  clientUserAgent?: string;
  fbp?: string;
  fbc?: string;
  contentIds?: string[];
  contentType?: "product" | "product_group";
  value?: number;
  currency?: string;
  testEventCode?: string;
};

export type FunnelEventResult = {
  ok: boolean;
  pixelId: string;
  eventId: string;
  eventName: FunnelEventName;
  status: number;
  tokenKind: "coffee_system_user" | "coffee_app" | "global";
  response: MetaCapiResponseBody;
};

export const sendFunnelEvent = async (input: FunnelEventInput): Promise<FunnelEventResult> => {
  if (!input.pixelId) {
    throw new Error("funnel event: pixelId 필수");
  }
  if (!input.eventId) {
    throw new Error("funnel event: eventId 필수 (브라우저↔서버 디둡 키)");
  }

  const { token, kind: tokenKind } = resolveCapiToken(input.pixelId);
  if (!token) {
    throw new Error(`Meta CAPI 토큰 미설정 (pixel=${input.pixelId}, 시도한 경로=${tokenKind})`);
  }

  const url = new URL(`${META_GRAPH_URL}/${input.pixelId}/events`);
  url.searchParams.set("access_token", token);

  const now = Math.floor(Date.now() / 1000);
  const customData: Record<string, unknown> = {};
  if (input.contentIds && input.contentIds.length > 0) {
    customData.content_ids = input.contentIds;
    customData.content_type = input.contentType ?? "product";
  }
  if (typeof input.value === "number" && Number.isFinite(input.value)) {
    customData.value = input.value;
    customData.currency = input.currency ?? "KRW";
  }

  const requestBody: Record<string, unknown> = {
    data: [
      {
        event_name: input.eventName,
        event_time: now,
        event_id: input.eventId,
        event_source_url: input.eventSourceUrl,
        action_source: "website",
        user_data: {
          client_ip_address: input.clientIpAddress,
          client_user_agent: input.clientUserAgent,
          fbp: input.fbp,
          fbc: input.fbc,
        },
        ...(Object.keys(customData).length > 0 ? { custom_data: customData } : {}),
      },
    ],
  };
  if (input.testEventCode?.trim()) {
    requestBody.test_event_code = input.testEventCode.trim();
  }

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(15_000),
  });
  const responseBody = await toResponseBody(res);

  // Minimal ledger stub — funnel 이벤트는 attribution ledger 와 연결되지 않지만 로그 스키마 호환용.
  const stubLedger: LedgerEntrySummary = {
    orderId: "",
    paymentKey: "",
    touchpoint: "funnel_browser",
    captureMode: "live",
    source: input.eventSourceUrl,
    approvedAt: "",
    loggedAt: new Date(now * 1000).toISOString(),
    value: typeof input.value === "number" ? input.value : null,
    landing: input.eventSourceUrl,
    referrer: "",
    requestOrigin: input.eventSourceUrl,
    requestPath: "",
  };

  await appendMetaCapiLog({
    event_id: input.eventId,
    pixel_id: input.pixelId,
    event_name: input.eventName,
    timestamp: new Date().toISOString(),
    response_status: res.status,
    response_body: responseBody,
    event_source_url: input.eventSourceUrl,
    send_path: input.testEventCode?.trim() ? "test_event" : "manual_api",
    ...(input.testEventCode?.trim() ? { test_event_code: input.testEventCode.trim() } : {}),
    ledger_entry: stubLedger,
  });

  if (!res.ok) {
    const errorMessage = typeof responseBody === "string"
      ? responseBody
      : typeof responseBody.error === "object" && responseBody.error
        ? JSON.stringify(responseBody.error)
        : JSON.stringify(responseBody);
    throw new Error(`Meta CAPI funnel ${res.status}: ${errorMessage.slice(0, 300)}`);
  }

  return {
    ok: true,
    pixelId: input.pixelId,
    eventId: input.eventId,
    eventName: input.eventName,
    status: res.status,
    tokenKind,
    response: responseBody,
  };
};

export const sendMetaConversion = async (input: MetaCapiSendInput): Promise<MetaCapiSendResult> => {
  const prepared = prepareMetaCapiSend(input);
  const { token, kind: tokenKind } = resolveCapiToken(prepared.pixelId);
  if (!token) {
    throw new Error(`Meta CAPI 토큰 미설정 (pixel=${prepared.pixelId}, 시도한 경로=${tokenKind})`);
  }

  const url = new URL(`${META_GRAPH_URL}/${prepared.pixelId}/events`);
  url.searchParams.set("access_token", token);

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(prepared.request),
    signal: AbortSignal.timeout(15000),
  });

  const responseBody = await toResponseBody(res);

  await appendMetaCapiLog({
    event_id: prepared.eventId,
    pixel_id: prepared.pixelId,
    event_name: prepared.eventName,
    timestamp: new Date().toISOString(),
    response_status: res.status,
    response_body: responseBody,
    event_source_url: prepared.eventSourceUrl,
    send_path: input.testEventCode?.trim()
      ? "test_event"
      : prepared.ledgerSummary.captureMode === "manual" || prepared.ledgerSummary.touchpoint === "manual"
        ? "manual_api"
        : prepared.ledgerSummary.captureMode === "live" && prepared.ledgerSummary.touchpoint === "payment_success"
          ? "auto_sync"
          : "unknown",
    ...(input.testEventCode?.trim() ? { test_event_code: input.testEventCode.trim() } : {}),
    ledger_entry: prepared.ledgerSummary,
  });

  if (!res.ok) {
    const errorMessage = typeof responseBody === "string"
      ? responseBody
      : typeof responseBody.error === "object" && responseBody.error
        ? JSON.stringify(responseBody.error)
        : JSON.stringify(responseBody);
    throw new Error(`Meta CAPI ${res.status}: ${errorMessage.slice(0, 300)}`);
  }

  return {
    ok: true,
    pixelId: prepared.pixelId,
    eventId: prepared.eventId,
    eventName: prepared.eventName,
    status: res.status,
    response: responseBody,
    event: prepared.request.data[0],
  };
};

const buildSyncInput = async (entry: AttributionLedgerEntry): Promise<MetaCapiSendInput> => {
  const source = resolveSource({
    orderId: entry.orderId,
    paymentKey: entry.paymentKey,
    origin: entry.requestContext.origin,
    ledgerEntry: entry,
    metadata: entry.metadata,
  });

  let tossPayment: TossPayment | undefined;
  if (entry.paymentKey) {
    tossPayment = await fetchTossPayment(entry.paymentKey);

    if (tossPayment.status === "CANCELED") {
      throw new Error("결제 상태 CANCELED");
    }
    if (tossPayment.method === "가상계좌" && tossPayment.status !== "DONE") {
      throw new Error(`가상계좌 미완료(${tossPayment.status ?? "UNKNOWN"})`);
    }
  }

  return {
    orderId: entry.orderId || tossPayment?.orderId || "",
    paymentKey: entry.paymentKey || tossPayment?.paymentKey,
    source,
    approvedAt: tossPayment?.approvedAt || entry.approvedAt || entry.loggedAt,
    loggedAt: entry.loggedAt,
    value: tossPayment?.totalAmount ?? resolveValue({
      orderId: entry.orderId,
      paymentKey: entry.paymentKey,
      ledgerEntry: entry,
      metadata: entry.metadata,
    }),
    email: tossPayment?.customerEmail,
    phone: tossPayment?.customerMobilePhone,
    clientIpAddress: entry.requestContext.ip,
    clientUserAgent: entry.requestContext.userAgent,
    fbc: getMetadataString(entry.metadata, ["fbc"]),
    fbp: getMetadataString(entry.metadata, ["fbp"]),
    fbclid: entry.fbclid || getMetadataString(entry.metadata, ["fbclid"]),
    landing: entry.landing,
    referrer: entry.referrer,
    origin: entry.requestContext.origin,
    ledgerEntry: entry,
    metadata: {
      ...entry.metadata,
      ...(tossPayment?.totalAmount ? { totalAmount: tossPayment.totalAmount } : {}),
      ...(tossPayment?.status ? { tossStatus: tossPayment.status } : {}),
      ...(tossPayment?.method ? { tossMethod: tossPayment.method } : {}),
      ...(tossPayment?.customerEmail ? { customerEmail: tossPayment.customerEmail } : {}),
      ...(tossPayment?.customerMobilePhone ? { customerMobilePhone: tossPayment.customerMobilePhone } : {}),
    },
  };
};

const syncMetaConversionsFromLedgerInternal = async (
  params: MetaCapiSyncParams | undefined,
  applyOperationalDedupe: boolean,
): Promise<MetaCapiSyncResult> => {
  const limit = params?.limit && params.limit > 0 ? params.limit : Number.POSITIVE_INFINITY;
  const entries = await readLedgerEntries();
  let successfulCapiSendHistory = await readSuccessfulCapiSendHistory();
  const candidates = selectMetaCapiSyncCandidates(entries, limit, {
    orderId: params?.orderId,
    paymentKey: params?.paymentKey,
  });

  const items: MetaCapiSyncItem[] = [];
  let sent = 0;
  let skipped = 0;
  let failed = 0;
  let skippedAlreadySent = 0;

  for (const entry of candidates) {
    try {
      const input = await buildSyncInput(entry);
      input.testEventCode = params?.testEventCode;

      const prepared = prepareMetaCapiSend(input);
      const orderEventKey = buildMetaCapiOrderEventSuccessKey({
        paymentKey: input.paymentKey,
        orderId: input.orderId,
        eventName: prepared.eventName,
      });
      let duplicateReason = applyOperationalDedupe
        ? getSuccessfulCapiSendDuplicateReason(successfulCapiSendHistory, prepared.eventId, orderEventKey)
        : "";

      if (applyOperationalDedupe && !duplicateReason) {
        // Re-read the append-only send log immediately before the network call.
        // This closes the common local race where another sync finished after candidates were selected.
        successfulCapiSendHistory = await readSuccessfulCapiSendHistory();
        duplicateReason = getSuccessfulCapiSendDuplicateReason(
          successfulCapiSendHistory,
          prepared.eventId,
          orderEventKey,
        );
      }

      if (applyOperationalDedupe && duplicateReason) {
        skipped += 1;
        skippedAlreadySent += 1;
        items.push({
          orderId: input.orderId,
          paymentKey: input.paymentKey ?? "",
          source: input.source ?? "",
          status: "skipped",
          eventId: prepared.eventId,
          pixelId: prepared.pixelId,
          reason: duplicateReason,
        });
        continue;
      }

      const result = await sendMetaConversion(input);
      if (applyOperationalDedupe) {
        successfulCapiSendHistory.eventIds.add(result.eventId);
        if (orderEventKey) {
          successfulCapiSendHistory.orderEventKeys.add(orderEventKey);
        }
      }
      sent += 1;
      items.push({
        orderId: input.orderId,
        paymentKey: input.paymentKey ?? "",
        source: input.source ?? "",
        status: "sent",
        eventId: result.eventId,
        pixelId: result.pixelId,
        responseStatus: result.status,
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : "sync failed";
      const source = typeof entry.metadata?.source === "string" ? entry.metadata.source : "";
      const isSkip = [
        "결제 상태 CANCELED",
        "Pixel ID를 해석할 수 없음",
        "META_PIXEL_ID_BIOCOM placeholder 상태",
        "가상계좌 미완료",
      ].some((token) => reason.includes(token));

      if (isSkip) {
        skipped += 1;
        items.push({
          orderId: entry.orderId,
          paymentKey: entry.paymentKey,
          source,
          status: "skipped",
          reason,
        });
      } else {
        failed += 1;
        items.push({
          orderId: entry.orderId,
          paymentKey: entry.paymentKey,
          source,
          status: "failed",
          reason,
        });
      }
    }
  }

  return {
    ok: true,
    totalCandidates: candidates.length,
    sent,
    skipped,
    failed,
    skippedAlreadySent,
    skippedSyncAlreadyRunning: 0,
    items,
  };
};

export const syncMetaConversionsFromLedger = async (params?: MetaCapiSyncParams): Promise<MetaCapiSyncResult> => {
  const applyOperationalDedupe = !params?.testEventCode?.trim();

  if (!applyOperationalDedupe) {
    return syncMetaConversionsFromLedgerInternal(params, applyOperationalDedupe);
  }

  if (operationalMetaCapiSyncInFlight) {
    return buildMetaCapiSyncAlreadyRunningResult();
  }

  const syncLock = await acquireOperationalMetaCapiSyncLock();
  if (!syncLock) {
    return buildMetaCapiSyncAlreadyRunningResult();
  }

  operationalMetaCapiSyncInFlight = true;
  try {
    return await syncMetaConversionsFromLedgerInternal(params, applyOperationalDedupe);
  } finally {
    operationalMetaCapiSyncInFlight = false;
    await syncLock.release();
  }
};
