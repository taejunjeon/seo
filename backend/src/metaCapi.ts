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

type MetaCapiResponseBody = Record<string, unknown> | string;

type MetaCapiUserData = {
  em?: string[];
  ph?: string[];
  client_ip_address?: string;
  client_user_agent?: string;
  fbc?: string;
  fbp?: string;
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
};

export type MetaCapiSendLogRecord = {
  event_id: string;
  pixel_id: string;
  event_name: string;
  timestamp: string;
  response_status: number;
  ledger_entry: LedgerEntrySummary;
  response_body?: MetaCapiResponseBody;
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
  items: MetaCapiSyncItem[];
};

export const selectMetaCapiSyncCandidates = (
  entries: AttributionLedgerEntry[],
  limit = Number.POSITIVE_INFINITY,
) =>
  entries
    .filter(
      (entry) =>
        entry.touchpoint === "payment_success" &&
        entry.captureMode === "live" &&
        entry.paymentStatus === "confirmed",
    )
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

  return `fb.1.${resolveEventIdTime(input.loggedAt || input.approvedAt || input.ledgerEntry?.loggedAt || input.ledgerEntry?.approvedAt)}.${fbclid}`;
};

const resolveFbp = (input: MetaCapiSendInput) => {
  if (input.fbp?.trim()) return input.fbp.trim();

  const metadata = input.metadata ?? input.ledgerEntry?.metadata;
  return (
    getMetadataString(metadata, ["fbp"])
    || queryParamFromUrls("fbp", [input.landing, input.referrer, input.ledgerEntry?.landing, input.ledgerEntry?.referrer])
  );
};

const resolveEventSourceUrl = (input: MetaCapiSendInput) => {
  return input.landing || input.ledgerEntry?.landing || input.referrer || input.ledgerEntry?.referrer || undefined;
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

  const eventTimeSource = input.loggedAt || input.approvedAt || input.ledgerEntry?.loggedAt || input.ledgerEntry?.approvedAt;
  const eventTime = resolveEventTime(eventTimeSource);
  const eventId = `${input.orderId}_${eventName}_${resolveEventIdTime(eventTimeSource)}`;

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

  const event: MetaCapiEvent = {
    event_name: eventName,
    event_time: eventTime,
    event_id: eventId,
    action_source: DEFAULT_ACTION_SOURCE,
    event_source_url: resolveEventSourceUrl(input),
    user_data: userData,
    custom_data: {
      currency: DEFAULT_CURRENCY,
      value,
      order_id: input.orderId,
      content_type: DEFAULT_CONTENT_TYPE,
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

const appendMetaCapiLog = async (record: MetaCapiSendLogRecord) => {
  await fs.mkdir(path.dirname(META_CAPI_LOG_PATH), { recursive: true });
  await fs.appendFile(META_CAPI_LOG_PATH, `${JSON.stringify(record)}\n`, "utf8");
};

const readSuccessfulEventIds = async () => {
  const logs = await readMetaCapiSendLogs();
  return new Set(
    logs
      .filter((row) => row.response_status >= 200 && row.response_status < 300)
      .map((row) => row.event_id),
  );
};

export const sendMetaConversion = async (input: MetaCapiSendInput): Promise<MetaCapiSendResult> => {
  const token = env.META_ADMANAGER_API_KEY?.trim();
  if (!token) {
    throw new Error("META_ADMANAGER_API_KEY 미설정");
  }

  const prepared = prepareMetaCapiSend(input);
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

export const syncMetaConversionsFromLedger = async (params?: {
  limit?: number;
  testEventCode?: string;
}): Promise<MetaCapiSyncResult> => {
  const limit = params?.limit && params.limit > 0 ? params.limit : Number.POSITIVE_INFINITY;
  const entries = await readLedgerEntries();
  const successfulEventIds = await readSuccessfulEventIds();
  const candidates = selectMetaCapiSyncCandidates(entries, limit);

  const items: MetaCapiSyncItem[] = [];
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const entry of candidates) {
    try {
      const input = await buildSyncInput(entry);
      input.testEventCode = params?.testEventCode;

      const prepared = prepareMetaCapiSend(input);
      if (successfulEventIds.has(prepared.eventId)) {
        skipped += 1;
        items.push({
          orderId: input.orderId,
          paymentKey: input.paymentKey ?? "",
          source: input.source ?? "",
          status: "skipped",
          eventId: prepared.eventId,
          pixelId: prepared.pixelId,
          reason: "duplicate_event_id",
        });
        continue;
      }

      const result = await sendMetaConversion(input);
      successfulEventIds.add(result.eventId);
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
    items,
  };
};
