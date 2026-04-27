import { createHash, randomUUID } from "node:crypto";

import type Database from "better-sqlite3";

import { getCrmDb } from "./crmLocalDb";

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

const FIELD_ALIASES = {
  clientId: ["client_id", "clientId", "ga_client_id", "gaClientId", "cid"],
  gaCookieRaw: ["ga_cookie_raw", "gaCookieRaw", "_ga", "ga_cookie"],
  gaSessionId: ["ga_session_id", "gaSessionId", "session_id", "sessionId", "sid"],
  gaSessionNumber: ["ga_session_number", "gaSessionNumber", "session_number", "sessionNumber"],
  pageLocation: ["page_location", "pageLocation", "landing", "landing_url", "url"],
  pageReferrer: ["page_referrer", "pageReferrer", "referrer", "referer"],
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

const parseUrl = (value: string): URL | null => {
  if (!value) return null;
  try {
    return new URL(value, "https://biocom.kr");
  } catch {
    return null;
  }
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
        ? sanitizeUrlForStorage(value)
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

const markDuplicateIntent = (
  db: Database.Database,
  intentKey: string,
  receivedAt: string,
  fallback: NpayIntentRow,
): NpayIntentRow => {
  db.prepare(`
    UPDATE npay_intent_log
    SET duplicate_count = duplicate_count + 1,
        updated_at = ?
    WHERE intent_key = ?
  `).run(receivedAt, intentKey);

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
  const clientId = readString(input, FIELD_ALIASES.clientId, 200);
  const gaCookieRaw = readString(input, FIELD_ALIASES.gaCookieRaw, 200);
  const gaSessionId = readString(input, FIELD_ALIASES.gaSessionId, 120);
  const gaSessionNumber = readString(input, FIELD_ALIASES.gaSessionNumber, 120);
  const gclid = readString(input, ["gclid"], 500) || extractQueryParam(rawPageLocation, "gclid");
  const gbraid = readString(input, ["gbraid"], 500) || extractQueryParam(rawPageLocation, "gbraid");
  const wbraid = readString(input, ["wbraid"], 500) || extractQueryParam(rawPageLocation, "wbraid");
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
    page_location: pageLocation,
    gclid,
    gbraid,
    wbraid,
    fbclid,
    utm_source: utmSource,
    utm_medium: utmMedium,
    utm_campaign: utmCampaign,
  };
  const rawPayload = JSON.stringify(sanitizeRawPayload(input, normalizedRaw));

  const existing = selectByIntentKey(db, intentKey);
  if (existing) {
    return { intent: markDuplicateIntent(db, existing.intentKey, receivedAt, existing), deduped: true };
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
    return { intent: markDuplicateIntent(db, recentDuplicate.intentKey, receivedAt, recentDuplicate), deduped: true };
  }

  const id = randomUUID();
  db.prepare(`
    INSERT INTO npay_intent_log (
      id, intent_key, site, source, environment, match_status, captured_at, received_at,
      client_id, ga_cookie_raw, ga_session_id, ga_session_number, gclid, gbraid, wbraid, fbp, fbc, fbclid,
      utm_source, utm_medium, utm_campaign, utm_content, utm_term,
      page_location, page_referrer, product_idx, product_name, product_price,
      member_code, member_hash, phone_hash, email_hash, user_agent_hash, ip_hash,
      button_selector, gtm_event_id, debug_mode, raw_payload, duplicate_count, created_at, updated_at
    )
    VALUES (
      @id, @intentKey, @site, @source, @environment, 'pending', @capturedAt, @receivedAt,
      @clientId, @gaCookieRaw, @gaSessionId, @gaSessionNumber, @gclid, @gbraid, @wbraid, @fbp, @fbc, @fbclid,
      @utmSource, @utmMedium, @utmCampaign, @utmContent, @utmTerm,
      @pageLocation, @pageReferrer, @productIdx, @productName, @productPrice,
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
