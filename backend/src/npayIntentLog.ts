import { createHash, createHmac, randomUUID } from "node:crypto";

import type Database from "better-sqlite3";

import { getCrmDb } from "./crmLocalDb";
import { hasSyntheticGoogleClickId, sanitizeGoogleClickIdForStorage } from "./googleClickIdSanitizer";

type NpayIntentRequestContext = {
  ip: string;
  userAgent: string;
  origin: string;
  requestReferer: string;
  method: string;
  path: string;
};

export type NpayIntentRow = {
  id: string;
  intentKey: string;
  site: string;
  source: string;
  environment: string;
  matchStatus: string;
  capturedAt: string;
  receivedAt: string;
  clientId: string;
  gaCookieRaw: string;
  gaSessionId: string;
  gaSessionNumber: string;
  gclid: string;
  gbraid: string;
  wbraid: string;
  fbp: string;
  fbc: string;
  fbclid: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmContent: string;
  utmTerm: string;
  pageLocation: string;
  pageReferrer: string;
  npayBridgeUrlHash: string;
  npayBridgeHost: string;
  npayBridgePathHash: string;
  npayBridgeObservedAt: string;
  npayCheckoutBridgeIdHash: string;
  imwebOrderCodeHash: string;
  channelOrderNoHash: string;
  localSessionIdHash: string;
  cartFingerprintHash: string;
  cartItemCount: number | null;
  cartQuantityTotal: number | null;
  cartSubtotalKrw: number | null;
  deliveryPriceKrw: number | null;
  discountAmountKrw: number | null;
  expectedPaymentAmountKrw: number | null;
  amountSource: string;
  checkoutStage: string;
  bridgeOpenedAt: string;
  checkoutOpenedAt: string;
  loginGateObservedAt: string;
  orderInitObservedAt: string;
  bridgeVersion: string;
  privacyHashVersion: string;
  productIdx: string;
  productName: string;
  productPrice: number | null;
  memberCode: string;
  memberHash: string;
  phoneHash: string;
  emailHash: string;
  userAgentHash: string;
  ipHash: string;
  buttonSelector: string;
  gtmEventId: string;
  debugMode: boolean;
  rawPayload: Record<string, unknown>;
  duplicateCount: number;
  createdAt: string;
  updatedAt: string;
};

export type NpayIntentRecordResult = {
  intent: NpayIntentRow;
  deduped: boolean;
};

type NpayIntentDbRow = {
  id: string;
  intent_key: string;
  site: string;
  source: string;
  environment: string;
  match_status: string;
  captured_at: string;
  received_at: string;
  client_id: string;
  ga_cookie_raw?: string;
  ga_session_id: string;
  ga_session_number: string;
  gclid: string;
  gbraid: string;
  wbraid: string;
  fbp: string;
  fbc: string;
  fbclid: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_content: string;
  utm_term: string;
  page_location: string;
  page_referrer: string;
  npay_bridge_url_hash?: string;
  npay_bridge_host?: string;
  npay_bridge_path_hash?: string;
  npay_bridge_observed_at?: string;
  npay_checkout_bridge_id_hash?: string;
  imweb_order_code_hash?: string;
  channel_order_no_hash?: string;
  local_session_id_hash?: string;
  cart_fingerprint_hash?: string;
  cart_item_count?: number | null;
  cart_quantity_total?: number | null;
  cart_subtotal_krw?: number | null;
  delivery_price_krw?: number | null;
  discount_amount_krw?: number | null;
  expected_payment_amount_krw?: number | null;
  amount_source?: string;
  checkout_stage?: string;
  bridge_opened_at?: string;
  checkout_opened_at?: string;
  login_gate_observed_at?: string;
  order_init_observed_at?: string;
  bridge_version?: string;
  privacy_hash_version?: string;
  product_idx: string;
  product_name: string;
  product_price: number | null;
  member_code: string;
  member_hash: string;
  phone_hash: string;
  email_hash: string;
  user_agent_hash: string;
  ip_hash: string;
  button_selector: string;
  gtm_event_id: string;
  debug_mode: number;
  raw_payload: string;
  duplicate_count: number;
  created_at: string;
  updated_at: string;
};

const ALLOWED_BIOCOM_HOSTS = new Set([
  "biocom.kr",
  "www.biocom.kr",
  "m.biocom.kr",
  "biocom.imweb.me",
  "localhost",
  "127.0.0.1",
]);

const MAX_RAW_PAYLOAD_LENGTH = 12000;
const NPAY_PRIVATE_HASH_VERSION = "hmac_sha256_npay_bridge_v1";

const FIELD_ALIASES = {
  clientId: ["client_id", "clientId", "ga_client_id", "gaClientId", "cid"],
  gaCookieRaw: ["ga_cookie_raw", "gaCookieRaw", "_ga", "ga_cookie"],
  gaSessionId: ["ga_session_id", "gaSessionId", "session_id", "sessionId", "sid"],
  gaSessionNumber: ["ga_session_number", "gaSessionNumber", "session_number", "sessionNumber"],
  pageLocation: ["page_location", "pageLocation", "landing", "landing_url", "url"],
  pageReferrer: ["page_referrer", "pageReferrer", "referrer", "referer"],
  npayBridgeUrl: [
    "npay_bridge_url",
    "npayBridgeUrl",
    "bridge_url",
    "bridgeUrl",
    "external_checkout_url",
    "externalCheckoutUrl",
    "checkout_url",
    "checkoutUrl",
    "naver_pay_url",
    "naverPayUrl",
    "npay_url",
    "npayUrl",
  ],
  npayBridgeObservedAt: [
    "npay_bridge_observed_at",
    "npayBridgeObservedAt",
    "bridge_observed_at",
    "bridgeObservedAt",
    "external_checkout_observed_at",
    "externalCheckoutObservedAt",
  ],
  npayCheckoutBridgeId: [
    "npay_checkout_bridge_id",
    "npayCheckoutBridgeId",
    "checkout_bridge_id",
    "checkoutBridgeId",
    "bridge_id",
    "bridgeId",
  ],
  imwebOrderCode: [
    "imweb_order_code",
    "imwebOrderCode",
    "order_code",
    "orderCode",
  ],
  channelOrderNo: [
    "channel_order_no",
    "channelOrderNo",
    "npay_order_no",
    "npayOrderNo",
    "naver_order_no",
    "naverOrderNo",
  ],
  localSessionId: [
    "local_session_id",
    "localSessionId",
    "seo_funnel_session",
    "seoFunnelSession",
  ],
  cartFingerprint: [
    "cart_fingerprint",
    "cartFingerprint",
    "cart_fingerprint_source",
    "cartFingerprintSource",
  ],
  cartItemCount: ["cart_item_count", "cartItemCount", "item_count", "itemCount"],
  cartQuantityTotal: ["cart_quantity_total", "cartQuantityTotal", "quantity_total", "quantityTotal"],
  cartSubtotalKrw: ["cart_subtotal_krw", "cartSubtotalKrw", "subtotal_krw", "subtotalKrw"],
  deliveryPriceKrw: ["delivery_price_krw", "deliveryPriceKrw", "shipping_krw", "shippingKrw"],
  discountAmountKrw: ["discount_amount_krw", "discountAmountKrw", "discount_krw", "discountKrw"],
  expectedPaymentAmountKrw: [
    "expected_payment_amount_krw",
    "expectedPaymentAmountKrw",
    "payment_amount_krw",
    "paymentAmountKrw",
  ],
  amountSource: ["amount_source", "amountSource"],
  checkoutStage: ["checkout_stage", "checkoutStage", "stage"],
  bridgeOpenedAt: ["bridge_opened_at", "bridgeOpenedAt"],
  checkoutOpenedAt: ["checkout_opened_at", "checkoutOpenedAt"],
  loginGateObservedAt: ["login_gate_observed_at", "loginGateObservedAt"],
  orderInitObservedAt: ["order_init_observed_at", "orderInitObservedAt"],
  bridgeVersion: ["bridge_version", "bridgeVersion", "snippet_version", "snippetVersion"],
  productIdx: ["product_idx", "productIdx", "item_id", "itemId", "idx"],
  productName: ["product_name", "productName", "item_name", "itemName"],
  productPrice: ["product_price", "productPrice", "price", "item_price", "itemPrice"],
  memberCode: ["member_code", "memberCode"],
  memberHash: ["member_hash", "memberHash"],
  phoneHash: ["phone_hash", "phoneHash"],
  emailHash: ["email_hash", "emailHash"],
  buttonSelector: ["button_selector", "buttonSelector", "selector"],
  gtmEventId: ["gtm_event_id", "gtmEventId", "event_id", "eventId"],
} as const;

const SENSITIVE_RAW_KEYS = new Set([
  "address",
  "auth",
  "auth_token",
  "phone",
  "phone_number",
  "phoneNumber",
  "tel",
  "mobile",
  "mobile_phone",
  "mobilePhone",
  "callnum",
  "orderer_call",
  "ordererCall",
  "email",
  "user_email",
  "userEmail",
  "orderer_email",
  "ordererEmail",
  "customer_email",
  "customerEmail",
  "customer_name",
  "customerName",
  "member_name",
  "memberName",
  "name",
  "order_no",
  "orderNo",
  "orderer_name",
  "ordererName",
  "token",
  "access_token",
  "gclid",
  "gbraid",
  "wbraid",
  "fbclid",
  "fbp",
  "fbc",
  "_fbp",
  "_fbc",
  "_ga",
  "ga_cookie_raw",
  "gaCookieRaw",
  "member_code",
  "memberCode",
  "imweb_order_code",
  "imwebOrderCode",
  "order_code",
  "orderCode",
  "channel_order_no",
  "channelOrderNo",
  "npay_order_no",
  "npayOrderNo",
  "naver_order_no",
  "naverOrderNo",
  "npay_checkout_bridge_id",
  "npayCheckoutBridgeId",
  "checkout_bridge_id",
  "checkoutBridgeId",
  "bridge_id",
  "bridgeId",
  "local_session_id",
  "localSessionId",
  "seo_funnel_session",
  "seoFunnelSession",
  "cart_snapshot",
  "cartSnapshot",
  "npay_bridge_url",
  "npayBridgeUrl",
  "bridge_url",
  "bridgeUrl",
  "external_checkout_url",
  "externalCheckoutUrl",
  "checkout_url",
  "checkoutUrl",
  "naver_pay_url",
  "naverPayUrl",
  "npay_url",
  "npayUrl",
]);

const SENSITIVE_RAW_KEY_NORMALIZED = new Set([
  "address",
  "auth",
  "authtoken",
  "phone",
  "phonenumber",
  "tel",
  "mobile",
  "mobilephone",
  "callnum",
  "orderercall",
  "email",
  "useremail",
  "ordereremail",
  "customeremail",
  "customername",
  "membername",
  "name",
  "orderno",
  "orderername",
  "token",
  "accesstoken",
  "gclid",
  "gbraid",
  "wbraid",
  "fbclid",
  "fbp",
  "fbc",
  "fbp",
  "fbc",
  "ga",
  "gacookieraw",
  "membercode",
  "imwebordercode",
  "ordercode",
  "channelorderno",
  "npayorderno",
  "naverorderno",
  "npaycheckoutbridgeid",
  "checkoutbridgeid",
  "bridgeid",
  "localsessionid",
  "seofunnelsession",
  "cartsnapshot",
  "npaybridgeurl",
  "bridgeurl",
  "externalcheckouturl",
  "checkouturl",
  "naverpayurl",
  "npayurl",
]);

const URL_RAW_KEYS = new Set([
  "page_location",
  "pagelocation",
  "landing",
  "landing_url",
  "url",
  "page_referrer",
  "pagereferrer",
  "referrer",
  "referer",
]);

const PAGE_LOCATION_QUERY_ALLOWLIST = new Set([
  "idx",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "gclid",
  "gbraid",
  "wbraid",
  "fbclid",
]);

const RAW_PAYLOAD_URL_QUERY_ALLOWLIST = new Set([
  "idx",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
]);

const ALLOWED_NPAY_BRIDGE_HOSTS = new Set([
  "orders.pay.naver.com",
  "new-m.pay.naver.com",
  "m.pay.naver.com",
  "pay.naver.com",
  "nid.naver.com",
]);

const DUPLICATE_LOOKBACK_MS = 30_000;

let npayIntentTableReady = false;

const ensureColumn = (
  db: Database.Database,
  table: string,
  column: string,
  definition: string,
) => {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (columns.some((row) => row.name === column)) return;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
};

const ensureNpayIntentTables = (db: Database.Database) => {
  if (npayIntentTableReady) return;

  db.exec(`
    CREATE TABLE IF NOT EXISTS npay_intent_log (
      id TEXT PRIMARY KEY,
      intent_key TEXT NOT NULL UNIQUE,
      site TEXT NOT NULL DEFAULT 'biocom',
      source TEXT NOT NULL DEFAULT 'gtm_118',
      environment TEXT NOT NULL DEFAULT 'unknown',
      match_status TEXT NOT NULL DEFAULT 'pending',
      captured_at TEXT NOT NULL,
      received_at TEXT NOT NULL,
      client_id TEXT DEFAULT '',
      ga_cookie_raw TEXT DEFAULT '',
      ga_session_id TEXT DEFAULT '',
      ga_session_number TEXT DEFAULT '',
      gclid TEXT DEFAULT '',
      gbraid TEXT DEFAULT '',
      wbraid TEXT DEFAULT '',
      fbp TEXT DEFAULT '',
      fbc TEXT DEFAULT '',
      fbclid TEXT DEFAULT '',
      utm_source TEXT DEFAULT '',
      utm_medium TEXT DEFAULT '',
      utm_campaign TEXT DEFAULT '',
      utm_content TEXT DEFAULT '',
      utm_term TEXT DEFAULT '',
      page_location TEXT DEFAULT '',
      page_referrer TEXT DEFAULT '',
      npay_bridge_url_hash TEXT DEFAULT '',
      npay_bridge_host TEXT DEFAULT '',
      npay_bridge_path_hash TEXT DEFAULT '',
      npay_bridge_observed_at TEXT DEFAULT '',
      npay_checkout_bridge_id_hash TEXT DEFAULT '',
      imweb_order_code_hash TEXT DEFAULT '',
      channel_order_no_hash TEXT DEFAULT '',
      local_session_id_hash TEXT DEFAULT '',
      cart_fingerprint_hash TEXT DEFAULT '',
      cart_item_count INTEGER,
      cart_quantity_total INTEGER,
      cart_subtotal_krw INTEGER,
      delivery_price_krw INTEGER,
      discount_amount_krw INTEGER,
      expected_payment_amount_krw INTEGER,
      amount_source TEXT DEFAULT '',
      checkout_stage TEXT DEFAULT '',
      bridge_opened_at TEXT DEFAULT '',
      checkout_opened_at TEXT DEFAULT '',
      login_gate_observed_at TEXT DEFAULT '',
      order_init_observed_at TEXT DEFAULT '',
      bridge_version TEXT DEFAULT '',
      privacy_hash_version TEXT DEFAULT '',
      product_idx TEXT DEFAULT '',
      product_name TEXT DEFAULT '',
      product_price INTEGER,
      member_code TEXT DEFAULT '',
      member_hash TEXT DEFAULT '',
      phone_hash TEXT DEFAULT '',
      email_hash TEXT DEFAULT '',
      user_agent_hash TEXT DEFAULT '',
      ip_hash TEXT DEFAULT '',
      button_selector TEXT DEFAULT '',
      gtm_event_id TEXT DEFAULT '',
      debug_mode INTEGER NOT NULL DEFAULT 0,
      raw_payload TEXT NOT NULL DEFAULT '{}',
      duplicate_count INTEGER NOT NULL DEFAULT 0,
      matched_order_no TEXT,
      matched_order_amount INTEGER,
      matched_payment_method TEXT,
      matched_at TEXT,
      match_confidence INTEGER,
      match_reason TEXT,
      ga4_dispatched_at TEXT,
      meta_dispatched_at TEXT,
      google_ads_dispatched_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_npay_intent_site_captured ON npay_intent_log(site, captured_at DESC);
    CREATE INDEX IF NOT EXISTS idx_npay_intent_match ON npay_intent_log(site, match_status, captured_at DESC);
    CREATE INDEX IF NOT EXISTS idx_npay_intent_ga_session ON npay_intent_log(client_id, ga_session_id, captured_at DESC);
    CREATE INDEX IF NOT EXISTS idx_npay_intent_product ON npay_intent_log(product_idx, captured_at DESC);
    CREATE INDEX IF NOT EXISTS idx_npay_intent_order ON npay_intent_log(matched_order_no);
  `);

  ensureColumn(db, "npay_intent_log", "ga_cookie_raw", "TEXT DEFAULT ''");
  ensureColumn(db, "npay_intent_log", "npay_bridge_url_hash", "TEXT DEFAULT ''");
  ensureColumn(db, "npay_intent_log", "npay_bridge_host", "TEXT DEFAULT ''");
  ensureColumn(db, "npay_intent_log", "npay_bridge_path_hash", "TEXT DEFAULT ''");
  ensureColumn(db, "npay_intent_log", "npay_bridge_observed_at", "TEXT DEFAULT ''");
  ensureColumn(db, "npay_intent_log", "npay_checkout_bridge_id_hash", "TEXT DEFAULT ''");
  ensureColumn(db, "npay_intent_log", "imweb_order_code_hash", "TEXT DEFAULT ''");
  ensureColumn(db, "npay_intent_log", "channel_order_no_hash", "TEXT DEFAULT ''");
  ensureColumn(db, "npay_intent_log", "local_session_id_hash", "TEXT DEFAULT ''");
  ensureColumn(db, "npay_intent_log", "cart_fingerprint_hash", "TEXT DEFAULT ''");
  ensureColumn(db, "npay_intent_log", "cart_item_count", "INTEGER");
  ensureColumn(db, "npay_intent_log", "cart_quantity_total", "INTEGER");
  ensureColumn(db, "npay_intent_log", "cart_subtotal_krw", "INTEGER");
  ensureColumn(db, "npay_intent_log", "delivery_price_krw", "INTEGER");
  ensureColumn(db, "npay_intent_log", "discount_amount_krw", "INTEGER");
  ensureColumn(db, "npay_intent_log", "expected_payment_amount_krw", "INTEGER");
  ensureColumn(db, "npay_intent_log", "amount_source", "TEXT DEFAULT ''");
  ensureColumn(db, "npay_intent_log", "checkout_stage", "TEXT DEFAULT ''");
  ensureColumn(db, "npay_intent_log", "bridge_opened_at", "TEXT DEFAULT ''");
  ensureColumn(db, "npay_intent_log", "checkout_opened_at", "TEXT DEFAULT ''");
  ensureColumn(db, "npay_intent_log", "login_gate_observed_at", "TEXT DEFAULT ''");
  ensureColumn(db, "npay_intent_log", "order_init_observed_at", "TEXT DEFAULT ''");
  ensureColumn(db, "npay_intent_log", "bridge_version", "TEXT DEFAULT ''");
  ensureColumn(db, "npay_intent_log", "privacy_hash_version", "TEXT DEFAULT ''");
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_npay_intent_checkout_bridge ON npay_intent_log(npay_checkout_bridge_id_hash, captured_at DESC);
    CREATE INDEX IF NOT EXISTS idx_npay_intent_imweb_order_code ON npay_intent_log(imweb_order_code_hash, captured_at DESC);
    CREATE INDEX IF NOT EXISTS idx_npay_intent_local_session ON npay_intent_log(local_session_id_hash, captured_at DESC);
  `);

  npayIntentTableReady = true;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const truncate = (value: string, maxLength: number) => value.slice(0, maxLength);

const readString = (
  input: Record<string, unknown>,
  keys: readonly string[],
  maxLength = 500,
): string => {
  for (const key of keys) {
    const value = input[key];
    if (typeof value === "string") return truncate(value.trim(), maxLength);
    if (typeof value === "number" && Number.isFinite(value)) return truncate(String(value), maxLength);
  }
  return "";
};

const readNumber = (input: Record<string, unknown>, keys: readonly string[]): number | null => {
  for (const key of keys) {
    const value = input[key];
    const parsed =
      typeof value === "number"
        ? value
        : typeof value === "string"
          ? Number(value.replace(/,/g, "").trim())
          : Number.NaN;
    if (Number.isFinite(parsed)) return Math.max(0, Math.round(parsed));
  }
  return null;
};

const readBoolean = (value: unknown): boolean => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return ["1", "true", "yes", "y", "debug", "preview"].includes(normalized);
  }
  return false;
};

const normalizeSite = (value: unknown): string => {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!normalized || normalized === "biocom" || normalized === "biocom_imweb") return "biocom";
  throw new Error("npay_intent only supports site=biocom for v1");
};

const normalizeEnvironment = (value: unknown, debugMode: boolean): string => {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (["preview", "live", "smoke", "test", "unknown"].includes(normalized)) return normalized;
  return debugMode ? "preview" : "unknown";
};

const normalizeCapturedAt = (input: Record<string, unknown>, now: Date): string => {
  const raw =
    input.captured_at ??
    input.capturedAt ??
    input.client_observed_at ??
    input.clientObservedAt ??
    input.ts ??
    input.timestamp;

  if (typeof raw === "number" && Number.isFinite(raw)) {
    const milliseconds = raw > 10_000_000_000 ? raw : raw * 1000;
    const parsed = new Date(milliseconds);
    if (Number.isFinite(parsed.getTime())) return parsed.toISOString();
  }

  if (typeof raw === "string" && raw.trim()) {
    const parsed = new Date(raw.trim());
    if (Number.isFinite(parsed.getTime())) return parsed.toISOString();
  }

  return now.toISOString();
};

const hashValue = (value: string, purpose: string): string => {
  const normalized = value.trim();
  if (!normalized) return "";
  const salt = process.env.NPAY_INTENT_HASH_SALT || process.env.ATTRIBUTION_HASH_SALT || "npay-intent-v1";
  return createHash("sha256").update(`${salt}:${purpose}:${normalized}`).digest("hex");
};

const getPrivateHashSecret = () =>
  process.env.NPAY_BRIDGE_HMAC_SECRET ||
  process.env.ORDER_BRIDGE_IDENTITY_HASH_SECRET ||
  process.env.NPAY_INTENT_HASH_SALT ||
  process.env.ATTRIBUTION_HASH_SALT ||
  "npay-bridge-local-development-secret";

const hashPrivateValue = (value: string, purpose: string): string => {
  const normalized = value.trim();
  if (!normalized) return "";
  return createHmac("sha256", getPrivateHashSecret())
    .update(`${purpose}:${normalized}`)
    .digest("hex");
};

const normalizeCheckoutStage = (value: string): string => {
  const normalized = value.trim().toLowerCase();
  if (
    [
      "button_clicked",
      "bridge_opened",
      "login_gate_possible",
      "checkout_opened_possible",
      "completed",
      "entered_not_completed",
    ].includes(normalized)
  ) {
    return normalized;
  }
  return normalized ? "button_clicked" : "";
};

const buildCartFingerprintHash = (input: {
  explicitFingerprint: string;
  productIdx: string;
  productName: string;
  productPrice: number | null;
  cartItemCount: number | null;
  cartQuantityTotal: number | null;
  cartSubtotalKrw: number | null;
  deliveryPriceKrw: number | null;
  discountAmountKrw: number | null;
  expectedPaymentAmountKrw: number | null;
}) => {
  if (input.explicitFingerprint) return hashPrivateValue(input.explicitFingerprint, "cart_fingerprint");

  const material = JSON.stringify({
    productIdx: input.productIdx,
    productName: input.productName.trim().toLowerCase().replace(/\s+/g, " "),
    productPrice: input.productPrice,
    cartItemCount: input.cartItemCount,
    cartQuantityTotal: input.cartQuantityTotal,
    cartSubtotalKrw: input.cartSubtotalKrw,
    deliveryPriceKrw: input.deliveryPriceKrw,
    discountAmountKrw: input.discountAmountKrw,
    expectedPaymentAmountKrw: input.expectedPaymentAmountKrw,
  });
  return hashPrivateValue(material, "cart_fingerprint");
};

const parseUrl = (value: string): URL | null => {
  if (!value) return null;
  try {
    return new URL(value, "https://biocom.kr");
  } catch {
    return null;
  }
};

const normalizeOptionalIso = (value: string): string => {
  if (!value.trim()) return "";
  const parsed = new Date(value.trim());
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : "";
};

const buildNpayBridgeUrlEvidence = (value: string) => {
  const parsed = parseUrl(value);
  if (!parsed) {
    return {
      npayBridgeUrlHash: "",
      npayBridgeHost: "",
      npayBridgePathHash: "",
    };
  }

  const host = parsed.hostname.toLowerCase();
  if (!ALLOWED_NPAY_BRIDGE_HOSTS.has(host)) {
    return {
      npayBridgeUrlHash: "",
      npayBridgeHost: "",
      npayBridgePathHash: "",
    };
  }

  parsed.hash = "";
  const normalizedUrl = truncate(parsed.toString(), 2000);
  const normalizedPath = `${host}${parsed.pathname}`;

  return {
    npayBridgeUrlHash: hashValue(normalizedUrl, "npay_bridge_url"),
    npayBridgeHost: host,
    npayBridgePathHash: hashValue(normalizedPath, "npay_bridge_path"),
  };
};

const assertBiocomPageLocation = (pageLocation: string, requestContext: NpayIntentRequestContext) => {
  const location = parseUrl(pageLocation);
  const referer = parseUrl(requestContext.requestReferer);
  const origin = parseUrl(requestContext.origin);
  const candidates = [location, referer, origin].filter((url): url is URL => Boolean(url));

  if (candidates.length === 0) {
    throw new Error("page_location or allowed origin is required");
  }

  const allowed = candidates.some((url) => ALLOWED_BIOCOM_HOSTS.has(url.hostname.toLowerCase()));
  if (!allowed) {
    throw new Error("npay_intent origin/page_location is not allowed");
  }
};

const extractQueryParam = (pageLocation: string, key: string): string => {
  const parsed = parseUrl(pageLocation);
  return parsed?.searchParams.get(key)?.trim() ?? "";
};

const sanitizeUrlForStorage = (value: string): string => {
  if (!value.trim()) return "";

  const parsed = parseUrl(value);
  if (!parsed) {
    return truncate(value.split("#")[0].split("?")[0].trim(), 2000);
  }

  const nextSearch = new URLSearchParams();
  parsed.searchParams.forEach((paramValue, paramKey) => {
    if (PAGE_LOCATION_QUERY_ALLOWLIST.has(paramKey.toLowerCase())) {
      nextSearch.append(paramKey, truncate(paramValue, 500));
    }
  });

  parsed.search = nextSearch.toString();
  parsed.hash = "";
  return truncate(parsed.toString(), 2000);
};

const sanitizeUrlForRawPayload = (value: string): string => {
  if (!value.trim()) return "";

  const parsed = parseUrl(value);
  if (!parsed) {
    return truncate(value.split("#")[0].split("?")[0].trim(), 2000);
  }

  const nextSearch = new URLSearchParams();
  parsed.searchParams.forEach((paramValue, paramKey) => {
    if (RAW_PAYLOAD_URL_QUERY_ALLOWLIST.has(paramKey.toLowerCase())) {
      nextSearch.append(paramKey, truncate(paramValue, 500));
    }
  });

  parsed.search = nextSearch.toString();
  parsed.hash = "";
  return truncate(parsed.toString(), 2000);
};

const normalizeRawKey = (key: string) => key.replace(/[^a-z0-9]/gi, "").toLowerCase();

const isSensitiveRawKey = (key: string) =>
  SENSITIVE_RAW_KEYS.has(key) ||
  SENSITIVE_RAW_KEYS.has(key.toLowerCase()) ||
  SENSITIVE_RAW_KEY_NORMALIZED.has(normalizeRawKey(key));

const sanitizeRawPayload = (input: Record<string, unknown>, normalized: Record<string, unknown>) => {
  const safeInput: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (isSensitiveRawKey(key)) continue;
    if (typeof value === "string") {
      safeInput[key] = URL_RAW_KEYS.has(key.toLowerCase())
        ? sanitizeUrlForRawPayload(value)
        : truncate(value, 1000);
    } else if (typeof value === "number" || typeof value === "boolean" || value === null) {
      safeInput[key] = value;
    }
  }

  const payload = { input: safeInput, normalized };
  const serialized = JSON.stringify(payload);
  if (serialized.length <= MAX_RAW_PAYLOAD_LENGTH) return payload;
  return {
    normalized,
    omitted: "raw_payload_too_large",
    originalLength: serialized.length,
  };
};

const createIntentKey = (input: {
  site: string;
  source: string;
  capturedAt: string;
  clientId: string;
  gaCookieRaw: string;
  gaSessionId: string;
  pageLocation: string;
  productIdx: string;
  productName: string;
}) => {
  const capturedMs = Date.parse(input.capturedAt);
  const bucket = Number.isFinite(capturedMs) ? Math.floor(capturedMs / 10_000) : 0;
  const basis = [
    input.site,
    input.source,
    input.clientId,
    input.gaCookieRaw,
    input.gaSessionId,
    input.pageLocation,
    input.productIdx,
    input.productName,
    bucket,
  ].join("|");
  return createHash("sha256").update(basis).digest("hex");
};

const parseRow = (row: NpayIntentDbRow): NpayIntentRow => ({
  id: row.id,
  intentKey: row.intent_key,
  site: row.site,
  source: row.source,
  environment: row.environment,
  matchStatus: row.match_status,
  capturedAt: row.captured_at,
  receivedAt: row.received_at,
  clientId: row.client_id,
  gaCookieRaw: row.ga_cookie_raw ?? "",
  gaSessionId: row.ga_session_id,
  gaSessionNumber: row.ga_session_number,
  gclid: row.gclid,
  gbraid: row.gbraid,
  wbraid: row.wbraid,
  fbp: row.fbp,
  fbc: row.fbc,
  fbclid: row.fbclid,
  utmSource: row.utm_source,
  utmMedium: row.utm_medium,
  utmCampaign: row.utm_campaign,
  utmContent: row.utm_content,
  utmTerm: row.utm_term,
  pageLocation: row.page_location,
  pageReferrer: row.page_referrer,
  npayBridgeUrlHash: row.npay_bridge_url_hash ?? "",
  npayBridgeHost: row.npay_bridge_host ?? "",
  npayBridgePathHash: row.npay_bridge_path_hash ?? "",
  npayBridgeObservedAt: row.npay_bridge_observed_at ?? "",
  npayCheckoutBridgeIdHash: row.npay_checkout_bridge_id_hash ?? "",
  imwebOrderCodeHash: row.imweb_order_code_hash ?? "",
  channelOrderNoHash: row.channel_order_no_hash ?? "",
  localSessionIdHash: row.local_session_id_hash ?? "",
  cartFingerprintHash: row.cart_fingerprint_hash ?? "",
  cartItemCount: row.cart_item_count ?? null,
  cartQuantityTotal: row.cart_quantity_total ?? null,
  cartSubtotalKrw: row.cart_subtotal_krw ?? null,
  deliveryPriceKrw: row.delivery_price_krw ?? null,
  discountAmountKrw: row.discount_amount_krw ?? null,
  expectedPaymentAmountKrw: row.expected_payment_amount_krw ?? null,
  amountSource: row.amount_source ?? "",
  checkoutStage: row.checkout_stage ?? "",
  bridgeOpenedAt: row.bridge_opened_at ?? "",
  checkoutOpenedAt: row.checkout_opened_at ?? "",
  loginGateObservedAt: row.login_gate_observed_at ?? "",
  orderInitObservedAt: row.order_init_observed_at ?? "",
  bridgeVersion: row.bridge_version ?? "",
  privacyHashVersion: row.privacy_hash_version ?? "",
  productIdx: row.product_idx,
  productName: row.product_name,
  productPrice: row.product_price,
  memberCode: row.member_code,
  memberHash: row.member_hash,
  phoneHash: row.phone_hash,
  emailHash: row.email_hash,
  userAgentHash: row.user_agent_hash,
  ipHash: row.ip_hash,
  buttonSelector: row.button_selector,
  gtmEventId: row.gtm_event_id,
  debugMode: row.debug_mode === 1,
  rawPayload: safeJsonParse(row.raw_payload),
  duplicateCount: row.duplicate_count,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const safeJsonParse = (value: string): Record<string, unknown> => {
  try {
    const parsed = JSON.parse(value);
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

const selectByIntentKey = (db: Database.Database, intentKey: string): NpayIntentRow | null => {
  const row = db.prepare("SELECT * FROM npay_intent_log WHERE intent_key = ?").get(intentKey) as NpayIntentDbRow | undefined;
  return row ? parseRow(row) : null;
};

const selectRecentDuplicateIntent = (
  db: Database.Database,
  input: {
    site: string;
    source: string;
    capturedAt: string;
    clientId: string;
    gaCookieRaw: string;
    gaSessionId: string;
    pageLocation: string;
    productIdx: string;
    productName: string;
    userAgentHash: string;
    ipHash: string;
  },
): NpayIntentRow | null => {
  const capturedMs = Date.parse(input.capturedAt);
  if (!Number.isFinite(capturedMs)) return null;

  const from = new Date(capturedMs - DUPLICATE_LOOKBACK_MS).toISOString();
  const to = new Date(capturedMs + DUPLICATE_LOOKBACK_MS).toISOString();
  const hasGaIdentity = Boolean(input.clientId || input.gaCookieRaw);
  const row = db.prepare(`
    SELECT * FROM npay_intent_log
    WHERE site = ?
      AND source = ?
      AND ga_session_id = ?
      AND page_location = ?
      AND product_idx = ?
      AND product_name = ?
      AND user_agent_hash = ?
      AND ip_hash = ?
      AND captured_at BETWEEN ? AND ?
      AND (
        (? = 1 AND (client_id = ? OR ga_cookie_raw = ?))
        OR (? = 0 AND client_id = '' AND ga_cookie_raw = '')
      )
    ORDER BY captured_at DESC
    LIMIT 1
  `).get(
    input.site,
    input.source,
    input.gaSessionId,
    input.pageLocation,
    input.productIdx,
    input.productName,
    input.userAgentHash,
    input.ipHash,
    from,
    to,
    hasGaIdentity ? 1 : 0,
    input.clientId,
    input.gaCookieRaw,
    hasGaIdentity ? 1 : 0,
  ) as NpayIntentDbRow | undefined;

  return row ? parseRow(row) : null;
};

type NpayIntentDuplicateEnrichment = {
  npayBridgeUrlHash: string;
  npayBridgeHost: string;
  npayBridgePathHash: string;
  npayBridgeObservedAt: string;
  npayCheckoutBridgeIdHash: string;
  imwebOrderCodeHash: string;
  channelOrderNoHash: string;
  localSessionIdHash: string;
  cartFingerprintHash: string;
  cartItemCount: number | null;
  cartQuantityTotal: number | null;
  cartSubtotalKrw: number | null;
  deliveryPriceKrw: number | null;
  discountAmountKrw: number | null;
  expectedPaymentAmountKrw: number | null;
  amountSource: string;
  checkoutStage: string;
  bridgeOpenedAt: string;
  checkoutOpenedAt: string;
  loginGateObservedAt: string;
  orderInitObservedAt: string;
  bridgeVersion: string;
  privacyHashVersion: string;
  gclid: string;
  gbraid: string;
  wbraid: string;
  fbclid: string;
  fbp: string;
  fbc: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmContent: string;
  utmTerm: string;
  clientId: string;
  gaCookieRaw: string;
  gaSessionId: string;
  gaSessionNumber: string;
  productName: string;
  productPrice: number | null;
  buttonSelector: string;
  gtmEventId: string;
};

const markDuplicateIntent = (
  db: Database.Database,
  intentKey: string,
  receivedAt: string,
  fallback: NpayIntentRow,
  enrichment: NpayIntentDuplicateEnrichment,
): NpayIntentRow => {
  db.prepare(`
    UPDATE npay_intent_log
    SET duplicate_count = duplicate_count + 1,
        npay_bridge_url_hash = CASE WHEN COALESCE(npay_bridge_url_hash, '') = '' AND @npayBridgeUrlHash <> '' THEN @npayBridgeUrlHash ELSE npay_bridge_url_hash END,
        npay_bridge_host = CASE WHEN COALESCE(npay_bridge_host, '') = '' AND @npayBridgeHost <> '' THEN @npayBridgeHost ELSE npay_bridge_host END,
        npay_bridge_path_hash = CASE WHEN COALESCE(npay_bridge_path_hash, '') = '' AND @npayBridgePathHash <> '' THEN @npayBridgePathHash ELSE npay_bridge_path_hash END,
        npay_bridge_observed_at = CASE WHEN COALESCE(npay_bridge_observed_at, '') = '' AND @npayBridgeObservedAt <> '' THEN @npayBridgeObservedAt ELSE npay_bridge_observed_at END,
        npay_checkout_bridge_id_hash = CASE WHEN COALESCE(npay_checkout_bridge_id_hash, '') = '' AND @npayCheckoutBridgeIdHash <> '' THEN @npayCheckoutBridgeIdHash ELSE npay_checkout_bridge_id_hash END,
        imweb_order_code_hash = CASE WHEN COALESCE(imweb_order_code_hash, '') = '' AND @imwebOrderCodeHash <> '' THEN @imwebOrderCodeHash ELSE imweb_order_code_hash END,
        channel_order_no_hash = CASE WHEN COALESCE(channel_order_no_hash, '') = '' AND @channelOrderNoHash <> '' THEN @channelOrderNoHash ELSE channel_order_no_hash END,
        local_session_id_hash = CASE WHEN COALESCE(local_session_id_hash, '') = '' AND @localSessionIdHash <> '' THEN @localSessionIdHash ELSE local_session_id_hash END,
        cart_fingerprint_hash = CASE WHEN COALESCE(cart_fingerprint_hash, '') = '' AND @cartFingerprintHash <> '' THEN @cartFingerprintHash ELSE cart_fingerprint_hash END,
        cart_item_count = CASE WHEN cart_item_count IS NULL AND @cartItemCount IS NOT NULL THEN @cartItemCount ELSE cart_item_count END,
        cart_quantity_total = CASE WHEN cart_quantity_total IS NULL AND @cartQuantityTotal IS NOT NULL THEN @cartQuantityTotal ELSE cart_quantity_total END,
        cart_subtotal_krw = CASE WHEN cart_subtotal_krw IS NULL AND @cartSubtotalKrw IS NOT NULL THEN @cartSubtotalKrw ELSE cart_subtotal_krw END,
        delivery_price_krw = CASE WHEN delivery_price_krw IS NULL AND @deliveryPriceKrw IS NOT NULL THEN @deliveryPriceKrw ELSE delivery_price_krw END,
        discount_amount_krw = CASE WHEN discount_amount_krw IS NULL AND @discountAmountKrw IS NOT NULL THEN @discountAmountKrw ELSE discount_amount_krw END,
        expected_payment_amount_krw = CASE WHEN expected_payment_amount_krw IS NULL AND @expectedPaymentAmountKrw IS NOT NULL THEN @expectedPaymentAmountKrw ELSE expected_payment_amount_krw END,
        amount_source = CASE WHEN COALESCE(amount_source, '') = '' AND @amountSource <> '' THEN @amountSource ELSE amount_source END,
        checkout_stage = CASE WHEN COALESCE(checkout_stage, '') = '' AND @checkoutStage <> '' THEN @checkoutStage ELSE checkout_stage END,
        bridge_opened_at = CASE WHEN COALESCE(bridge_opened_at, '') = '' AND @bridgeOpenedAt <> '' THEN @bridgeOpenedAt ELSE bridge_opened_at END,
        checkout_opened_at = CASE WHEN COALESCE(checkout_opened_at, '') = '' AND @checkoutOpenedAt <> '' THEN @checkoutOpenedAt ELSE checkout_opened_at END,
        login_gate_observed_at = CASE WHEN COALESCE(login_gate_observed_at, '') = '' AND @loginGateObservedAt <> '' THEN @loginGateObservedAt ELSE login_gate_observed_at END,
        order_init_observed_at = CASE WHEN COALESCE(order_init_observed_at, '') = '' AND @orderInitObservedAt <> '' THEN @orderInitObservedAt ELSE order_init_observed_at END,
        bridge_version = CASE WHEN COALESCE(bridge_version, '') = '' AND @bridgeVersion <> '' THEN @bridgeVersion ELSE bridge_version END,
        privacy_hash_version = CASE WHEN COALESCE(privacy_hash_version, '') = '' AND @privacyHashVersion <> '' THEN @privacyHashVersion ELSE privacy_hash_version END,
        gclid = CASE WHEN COALESCE(gclid, '') = '' AND @gclid <> '' THEN @gclid ELSE gclid END,
        gbraid = CASE WHEN COALESCE(gbraid, '') = '' AND @gbraid <> '' THEN @gbraid ELSE gbraid END,
        wbraid = CASE WHEN COALESCE(wbraid, '') = '' AND @wbraid <> '' THEN @wbraid ELSE wbraid END,
        fbclid = CASE WHEN COALESCE(fbclid, '') = '' AND @fbclid <> '' THEN @fbclid ELSE fbclid END,
        fbp = CASE WHEN COALESCE(fbp, '') = '' AND @fbp <> '' THEN @fbp ELSE fbp END,
        fbc = CASE WHEN COALESCE(fbc, '') = '' AND @fbc <> '' THEN @fbc ELSE fbc END,
        utm_source = CASE WHEN COALESCE(utm_source, '') = '' AND @utmSource <> '' THEN @utmSource ELSE utm_source END,
        utm_medium = CASE WHEN COALESCE(utm_medium, '') = '' AND @utmMedium <> '' THEN @utmMedium ELSE utm_medium END,
        utm_campaign = CASE WHEN COALESCE(utm_campaign, '') = '' AND @utmCampaign <> '' THEN @utmCampaign ELSE utm_campaign END,
        utm_content = CASE WHEN COALESCE(utm_content, '') = '' AND @utmContent <> '' THEN @utmContent ELSE utm_content END,
        utm_term = CASE WHEN COALESCE(utm_term, '') = '' AND @utmTerm <> '' THEN @utmTerm ELSE utm_term END,
        client_id = CASE WHEN COALESCE(client_id, '') = '' AND @clientId <> '' THEN @clientId ELSE client_id END,
        ga_cookie_raw = CASE WHEN COALESCE(ga_cookie_raw, '') = '' AND @gaCookieRaw <> '' THEN @gaCookieRaw ELSE ga_cookie_raw END,
        ga_session_id = CASE WHEN COALESCE(ga_session_id, '') = '' AND @gaSessionId <> '' THEN @gaSessionId ELSE ga_session_id END,
        ga_session_number = CASE WHEN COALESCE(ga_session_number, '') = '' AND @gaSessionNumber <> '' THEN @gaSessionNumber ELSE ga_session_number END,
        product_name = CASE WHEN COALESCE(product_name, '') = '' AND @productName <> '' THEN @productName ELSE product_name END,
        product_price = CASE WHEN product_price IS NULL AND @productPrice IS NOT NULL THEN @productPrice ELSE product_price END,
        button_selector = CASE WHEN COALESCE(button_selector, '') = '' AND @buttonSelector <> '' THEN @buttonSelector ELSE button_selector END,
        gtm_event_id = CASE WHEN COALESCE(gtm_event_id, '') = '' AND @gtmEventId <> '' THEN @gtmEventId ELSE gtm_event_id END,
        updated_at = @updatedAt
    WHERE intent_key = @intentKey
  `).run({
    ...enrichment,
    updatedAt: receivedAt,
    intentKey,
  });

  return selectByIntentKey(db, intentKey) ?? fallback;
};

export const recordNpayIntent = (
  rawInput: unknown,
  requestContext: NpayIntentRequestContext,
): NpayIntentRecordResult => {
  const input = isRecord(rawInput) ? rawInput : {};
  const db = getCrmDb();
  ensureNpayIntentTables(db);

  const now = new Date();
  const receivedAt = now.toISOString();
  const capturedAt = normalizeCapturedAt(input, now);
  const debugMode = readBoolean(input.debug_mode ?? input.debugMode);
  const site = normalizeSite(input.site);
  const source = readString(input, ["source"], 80) || "gtm_118";
  const environment = normalizeEnvironment(input.environment, debugMode);
  const rawPageLocation =
    readString(input, FIELD_ALIASES.pageLocation, 2000) ||
    requestContext.requestReferer ||
    requestContext.origin;
  const rawPageReferrer = readString(input, FIELD_ALIASES.pageReferrer, 2000);

  assertBiocomPageLocation(rawPageLocation, requestContext);

  const pageLocation = sanitizeUrlForStorage(rawPageLocation);
  const pageReferrer = sanitizeUrlForStorage(rawPageReferrer);
  const npayBridgeUrlEvidence = buildNpayBridgeUrlEvidence(
    readString(input, FIELD_ALIASES.npayBridgeUrl, 2000),
  );
  const npayBridgeObservedAt = normalizeOptionalIso(
    readString(input, FIELD_ALIASES.npayBridgeObservedAt, 120),
  );
  const npayCheckoutBridgeIdHash = hashPrivateValue(
    readString(input, FIELD_ALIASES.npayCheckoutBridgeId, 500),
    "npay_checkout_bridge_id",
  );
  const imwebOrderCodeHash = hashPrivateValue(
    readString(input, FIELD_ALIASES.imwebOrderCode, 500),
    "imweb_order_code",
  );
  const channelOrderNoHash = hashPrivateValue(
    readString(input, FIELD_ALIASES.channelOrderNo, 500),
    "channel_order_no",
  );
  const localSessionIdHash = hashPrivateValue(
    readString(input, FIELD_ALIASES.localSessionId, 500),
    "local_session_id",
  );
  const clientId = readString(input, FIELD_ALIASES.clientId, 200);
  const gaCookieRaw = readString(input, FIELD_ALIASES.gaCookieRaw, 200);
  const gaSessionId = readString(input, FIELD_ALIASES.gaSessionId, 120);
  const gaSessionNumber = readString(input, FIELD_ALIASES.gaSessionNumber, 120);
  const rawGclid = readString(input, ["gclid"], 500) || extractQueryParam(rawPageLocation, "gclid");
  const rawGbraid = readString(input, ["gbraid"], 500) || extractQueryParam(rawPageLocation, "gbraid");
  const rawWbraid = readString(input, ["wbraid"], 500) || extractQueryParam(rawPageLocation, "wbraid");
  const syntheticGoogleClickIdQuarantined = hasSyntheticGoogleClickId(rawGclid, rawGbraid, rawWbraid);
  const gclid = sanitizeGoogleClickIdForStorage(rawGclid);
  const gbraid = sanitizeGoogleClickIdForStorage(rawGbraid);
  const wbraid = sanitizeGoogleClickIdForStorage(rawWbraid);
  const fbclid = readString(input, ["fbclid"], 500) || extractQueryParam(rawPageLocation, "fbclid");
  const fbp = readString(input, ["fbp", "_fbp"], 500);
  const fbc = readString(input, ["fbc", "_fbc"], 500);
  const utmSource = readString(input, ["utm_source", "utmSource"], 300) || extractQueryParam(rawPageLocation, "utm_source");
  const utmMedium = readString(input, ["utm_medium", "utmMedium"], 300) || extractQueryParam(rawPageLocation, "utm_medium");
  const utmCampaign = readString(input, ["utm_campaign", "utmCampaign"], 300) || extractQueryParam(rawPageLocation, "utm_campaign");
  const utmContent = readString(input, ["utm_content", "utmContent"], 300) || extractQueryParam(rawPageLocation, "utm_content");
  const utmTerm = readString(input, ["utm_term", "utmTerm"], 300) || extractQueryParam(rawPageLocation, "utm_term");
  const productIdx = readString(input, FIELD_ALIASES.productIdx, 200) || extractQueryParam(rawPageLocation, "idx");
  const productName = readString(input, FIELD_ALIASES.productName, 500);
  const productPrice = readNumber(input, FIELD_ALIASES.productPrice);
  const cartItemCount = readNumber(input, FIELD_ALIASES.cartItemCount);
  const cartQuantityTotal = readNumber(input, FIELD_ALIASES.cartQuantityTotal);
  const cartSubtotalKrw = readNumber(input, FIELD_ALIASES.cartSubtotalKrw);
  const deliveryPriceKrw = readNumber(input, FIELD_ALIASES.deliveryPriceKrw);
  const discountAmountKrw = readNumber(input, FIELD_ALIASES.discountAmountKrw);
  const expectedPaymentAmountKrw = readNumber(input, FIELD_ALIASES.expectedPaymentAmountKrw);
  const amountSource = readString(input, FIELD_ALIASES.amountSource, 120);
  const checkoutStage = normalizeCheckoutStage(readString(input, FIELD_ALIASES.checkoutStage, 120));
  const bridgeOpenedAt = normalizeOptionalIso(readString(input, FIELD_ALIASES.bridgeOpenedAt, 120));
  const checkoutOpenedAt = normalizeOptionalIso(readString(input, FIELD_ALIASES.checkoutOpenedAt, 120));
  const loginGateObservedAt = normalizeOptionalIso(readString(input, FIELD_ALIASES.loginGateObservedAt, 120));
  const orderInitObservedAt = normalizeOptionalIso(readString(input, FIELD_ALIASES.orderInitObservedAt, 120));
  const bridgeVersion = readString(input, FIELD_ALIASES.bridgeVersion, 200);
  const cartFingerprintHash = buildCartFingerprintHash({
    explicitFingerprint: readString(input, FIELD_ALIASES.cartFingerprint, 2000),
    productIdx,
    productName,
    productPrice,
    cartItemCount,
    cartQuantityTotal,
    cartSubtotalKrw,
    deliveryPriceKrw,
    discountAmountKrw,
    expectedPaymentAmountKrw,
  });
  const memberCode = readString(input, FIELD_ALIASES.memberCode, 200);
  const memberHash = readString(input, FIELD_ALIASES.memberHash, 200);
  const phoneHash = readString(input, FIELD_ALIASES.phoneHash, 200);
  const emailHash = readString(input, FIELD_ALIASES.emailHash, 200);
  const buttonSelector = readString(input, FIELD_ALIASES.buttonSelector, 300);
  const gtmEventId = readString(input, FIELD_ALIASES.gtmEventId, 300);
  const intentKey = createIntentKey({
    site,
    source,
    capturedAt,
    clientId,
    gaCookieRaw,
    gaSessionId,
    pageLocation,
    productIdx,
    productName,
  });
  const ipHash = hashValue(requestContext.ip, "ip");
  const userAgentHash = hashValue(requestContext.userAgent, "ua");
  const normalizedRaw = {
    site,
    source,
    environment,
    captured_at: capturedAt,
    client_id: clientId,
    ga_cookie_raw: gaCookieRaw,
    ga_session_id: gaSessionId,
    product_idx: productIdx,
    product_price: productPrice,
    page_location: sanitizeUrlForRawPayload(rawPageLocation),
    npay_bridge_url_hash_present: Boolean(npayBridgeUrlEvidence.npayBridgeUrlHash),
    npay_bridge_host: npayBridgeUrlEvidence.npayBridgeHost,
    npay_bridge_path_hash_present: Boolean(npayBridgeUrlEvidence.npayBridgePathHash),
    npay_bridge_observed_at: npayBridgeObservedAt,
    npay_checkout_bridge_id_hash_present: Boolean(npayCheckoutBridgeIdHash),
    imweb_order_code_hash_present: Boolean(imwebOrderCodeHash),
    channel_order_no_hash_present: Boolean(channelOrderNoHash),
    local_session_id_hash_present: Boolean(localSessionIdHash),
    cart_fingerprint_hash_present: Boolean(cartFingerprintHash),
    cart_item_count: cartItemCount,
    cart_quantity_total: cartQuantityTotal,
    cart_subtotal_krw: cartSubtotalKrw,
    delivery_price_krw: deliveryPriceKrw,
    discount_amount_krw: discountAmountKrw,
    expected_payment_amount_krw: expectedPaymentAmountKrw,
    amount_source: amountSource,
    checkout_stage: checkoutStage,
    bridge_opened_at: bridgeOpenedAt,
    checkout_opened_at: checkoutOpenedAt,
    login_gate_observed_at: loginGateObservedAt,
    order_init_observed_at: orderInitObservedAt,
    bridge_version: bridgeVersion,
    privacy_hash_version: NPAY_PRIVATE_HASH_VERSION,
    synthetic_google_click_id_quarantined: syntheticGoogleClickIdQuarantined,
    has_google_click_id: Boolean(gclid || gbraid || wbraid),
    has_gclid: Boolean(gclid),
    has_gbraid: Boolean(gbraid),
    has_wbraid: Boolean(wbraid),
    has_fbclid: Boolean(fbclid),
    utm_source: utmSource,
    utm_medium: utmMedium,
    utm_campaign: utmCampaign,
  };
  const rawPayload = JSON.stringify(sanitizeRawPayload(input, normalizedRaw));
  const duplicateEnrichment: NpayIntentDuplicateEnrichment = {
    npayBridgeUrlHash: npayBridgeUrlEvidence.npayBridgeUrlHash,
    npayBridgeHost: npayBridgeUrlEvidence.npayBridgeHost,
    npayBridgePathHash: npayBridgeUrlEvidence.npayBridgePathHash,
    npayBridgeObservedAt,
    npayCheckoutBridgeIdHash,
    imwebOrderCodeHash,
    channelOrderNoHash,
    localSessionIdHash,
    cartFingerprintHash,
    cartItemCount,
    cartQuantityTotal,
    cartSubtotalKrw,
    deliveryPriceKrw,
    discountAmountKrw,
    expectedPaymentAmountKrw,
    amountSource,
    checkoutStage,
    bridgeOpenedAt,
    checkoutOpenedAt,
    loginGateObservedAt,
    orderInitObservedAt,
    bridgeVersion,
    privacyHashVersion: NPAY_PRIVATE_HASH_VERSION,
    gclid,
    gbraid,
    wbraid,
    fbclid,
    fbp,
    fbc,
    utmSource,
    utmMedium,
    utmCampaign,
    utmContent,
    utmTerm,
    clientId,
    gaCookieRaw,
    gaSessionId,
    gaSessionNumber,
    productName,
    productPrice,
    buttonSelector,
    gtmEventId,
  };

  const existing = selectByIntentKey(db, intentKey);
  if (existing) {
    return { intent: markDuplicateIntent(db, existing.intentKey, receivedAt, existing, duplicateEnrichment), deduped: true };
  }

  const recentDuplicate = selectRecentDuplicateIntent(db, {
    site,
    source,
    capturedAt,
    clientId,
    gaCookieRaw,
    gaSessionId,
    pageLocation,
    productIdx,
    productName,
    userAgentHash,
    ipHash,
  });
  if (recentDuplicate) {
    return { intent: markDuplicateIntent(db, recentDuplicate.intentKey, receivedAt, recentDuplicate, duplicateEnrichment), deduped: true };
  }

  const id = randomUUID();
  db.prepare(`
    INSERT INTO npay_intent_log (
      id, intent_key, site, source, environment, match_status, captured_at, received_at,
      client_id, ga_cookie_raw, ga_session_id, ga_session_number, gclid, gbraid, wbraid, fbp, fbc, fbclid,
      utm_source, utm_medium, utm_campaign, utm_content, utm_term,
      page_location, page_referrer, npay_bridge_url_hash, npay_bridge_host, npay_bridge_path_hash, npay_bridge_observed_at,
      npay_checkout_bridge_id_hash, imweb_order_code_hash, channel_order_no_hash, local_session_id_hash,
      cart_fingerprint_hash, cart_item_count, cart_quantity_total, cart_subtotal_krw, delivery_price_krw, discount_amount_krw,
      expected_payment_amount_krw, amount_source, checkout_stage, bridge_opened_at, checkout_opened_at,
      login_gate_observed_at, order_init_observed_at, bridge_version, privacy_hash_version,
      product_idx, product_name, product_price,
      member_code, member_hash, phone_hash, email_hash, user_agent_hash, ip_hash,
      button_selector, gtm_event_id, debug_mode, raw_payload, duplicate_count, created_at, updated_at
    )
    VALUES (
      @id, @intentKey, @site, @source, @environment, 'pending', @capturedAt, @receivedAt,
      @clientId, @gaCookieRaw, @gaSessionId, @gaSessionNumber, @gclid, @gbraid, @wbraid, @fbp, @fbc, @fbclid,
      @utmSource, @utmMedium, @utmCampaign, @utmContent, @utmTerm,
      @pageLocation, @pageReferrer, @npayBridgeUrlHash, @npayBridgeHost, @npayBridgePathHash, @npayBridgeObservedAt,
      @npayCheckoutBridgeIdHash, @imwebOrderCodeHash, @channelOrderNoHash, @localSessionIdHash,
      @cartFingerprintHash, @cartItemCount, @cartQuantityTotal, @cartSubtotalKrw, @deliveryPriceKrw, @discountAmountKrw,
      @expectedPaymentAmountKrw, @amountSource, @checkoutStage, @bridgeOpenedAt, @checkoutOpenedAt,
      @loginGateObservedAt, @orderInitObservedAt, @bridgeVersion, @privacyHashVersion,
      @productIdx, @productName, @productPrice,
      @memberCode, @memberHash, @phoneHash, @emailHash, @userAgentHash, @ipHash,
      @buttonSelector, @gtmEventId, @debugMode, @rawPayload, 0, @receivedAt, @receivedAt
    )
  `).run({
    id,
    intentKey,
    site,
    source,
    environment,
    capturedAt,
    receivedAt,
    clientId,
    gaCookieRaw,
    gaSessionId,
    gaSessionNumber,
    gclid,
    gbraid,
    wbraid,
    fbp,
    fbc,
    fbclid,
    utmSource,
    utmMedium,
    utmCampaign,
    utmContent,
    utmTerm,
    pageLocation,
    pageReferrer,
    npayBridgeUrlHash: npayBridgeUrlEvidence.npayBridgeUrlHash,
    npayBridgeHost: npayBridgeUrlEvidence.npayBridgeHost,
    npayBridgePathHash: npayBridgeUrlEvidence.npayBridgePathHash,
    npayBridgeObservedAt,
    npayCheckoutBridgeIdHash,
    imwebOrderCodeHash,
    channelOrderNoHash,
    localSessionIdHash,
    cartFingerprintHash,
    cartItemCount,
    cartQuantityTotal,
    cartSubtotalKrw,
    deliveryPriceKrw,
    discountAmountKrw,
    expectedPaymentAmountKrw,
    amountSource,
    checkoutStage,
    bridgeOpenedAt,
    checkoutOpenedAt,
    loginGateObservedAt,
    orderInitObservedAt,
    bridgeVersion,
    privacyHashVersion: NPAY_PRIVATE_HASH_VERSION,
    productIdx,
    productName,
    productPrice,
    memberCode,
    memberHash,
    phoneHash,
    emailHash,
    userAgentHash,
    ipHash,
    buttonSelector,
    gtmEventId,
    debugMode: debugMode ? 1 : 0,
    rawPayload,
  });

  const intent = selectByIntentKey(db, intentKey);
  if (!intent) throw new Error("npay_intent insert failed");
  return { intent, deduped: false };
};

export const listNpayIntents = (input: {
  site?: string;
  matchStatus?: string;
  limit?: number;
}): NpayIntentRow[] => {
  const db = getCrmDb();
  ensureNpayIntentTables(db);
  const site = input.site?.trim() || "biocom";
  const limit = Math.max(1, Math.min(input.limit ?? 50, 200));
  const matchStatus = input.matchStatus?.trim() || "";

  const rows = matchStatus
    ? db.prepare(`
        SELECT * FROM npay_intent_log
        WHERE site = ? AND match_status = ?
        ORDER BY captured_at DESC
        LIMIT ?
      `).all(site, matchStatus, limit)
    : db.prepare(`
        SELECT * FROM npay_intent_log
        WHERE site = ?
        ORDER BY captured_at DESC
        LIMIT ?
      `).all(site, limit);

  return (rows as NpayIntentDbRow[]).map(parseRow);
};

export const getNpayIntentSummary = (siteInput = "biocom") => {
  const db = getCrmDb();
  ensureNpayIntentTables(db);
  const site = siteInput.trim() || "biocom";
  const summary = db.prepare(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN match_status = 'pending' THEN 1 ELSE 0 END) AS pending,
      SUM(CASE WHEN match_status = 'matched' THEN 1 ELSE 0 END) AS matched,
      SUM(CASE WHEN environment = 'preview' THEN 1 ELSE 0 END) AS preview,
      SUM(CASE WHEN environment = 'live' THEN 1 ELSE 0 END) AS live,
      SUM(duplicate_count) AS duplicate_count,
      MIN(captured_at) AS first_captured_at,
      MAX(captured_at) AS last_captured_at
    FROM npay_intent_log
    WHERE site = ?
  `).get(site) as {
    total: number | null;
    pending: number | null;
    matched: number | null;
    preview: number | null;
    live: number | null;
    duplicate_count: number | null;
    first_captured_at: string | null;
    last_captured_at: string | null;
  };

  return {
    site,
    total: Number(summary.total ?? 0),
    pending: Number(summary.pending ?? 0),
    matched: Number(summary.matched ?? 0),
    preview: Number(summary.preview ?? 0),
    live: Number(summary.live ?? 0),
    duplicateCount: Number(summary.duplicate_count ?? 0),
    firstCapturedAt: summary.first_captured_at,
    lastCapturedAt: summary.last_captured_at,
  };
};
