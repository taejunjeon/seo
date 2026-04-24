import { createHash } from "node:crypto";

import type Database from "better-sqlite3";

import type { AttributionLedgerEntry } from "./attribution";
import { getCrmDb } from "./crmLocalDb";

const TIKTOK_PIXEL_EVENTS_TABLE = "tiktok_pixel_events";

export type TikTokPixelEvent = {
  eventLogId: string;
  loggedAt: string;
  clientObservedAt: string;
  siteSource: string;
  pixelSource: string;
  action: string;
  eventName: string;
  eventId: string;
  originalEventName: string;
  originalEventId: string;
  replacementEventName: string;
  orderCode: string;
  orderNo: string;
  paymentCode: string;
  paymentKeyPresent: boolean;
  value: number | null;
  currency: string;
  decisionStatus: string;
  decisionBranch: string;
  decisionReason: string;
  decisionMatchedBy: string;
  ttclid: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmContent: string;
  utmTerm: string;
  url: string;
  referrer: string;
  params: Record<string, unknown>;
  decision: Record<string, unknown>;
  requestContext: AttributionLedgerEntry["requestContext"];
};

type TikTokPixelEventRow = {
  event_log_id: string;
  logged_at: string;
  client_observed_at: string;
  site_source: string;
  pixel_source: string;
  action: string;
  event_name: string;
  event_id: string;
  original_event_name: string;
  original_event_id: string;
  replacement_event_name: string;
  order_code: string;
  order_no: string;
  payment_code: string;
  payment_key_present: number;
  value: number | null;
  currency: string;
  decision_status: string;
  decision_branch: string;
  decision_reason: string;
  decision_matched_by: string;
  ttclid: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_content: string;
  utm_term: string;
  url: string;
  referrer: string;
  params_json: string;
  decision_json: string;
  request_context_json: string;
};

export type TikTokPixelEventListFilters = {
  startAt?: string;
  endAt?: string;
  siteSource?: string;
  eventName?: string;
  action?: string;
  orderCode?: string;
  orderNo?: string;
  limit?: number;
};

let schemaReady = false;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

const readRecord = (value: unknown): Record<string, unknown> => (isRecord(value) ? value : {});

const readString = (input: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = input[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
};

const readNumber = (input: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = input[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value.replace(/,/g, "").trim());
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
};

const readBooleanish = (input: Record<string, unknown>, keys: string[]) => {
  const value = readString(input, keys).toLowerCase();
  if (!value) return false;
  return ["1", "true", "yes", "y", "present", "paymentkey", "yes"].includes(value);
};

const readUrlParam = (urlValue: string, key: string) => {
  if (!urlValue) return "";
  try {
    return new URL(urlValue, "https://biocom.kr").searchParams.get(key)?.trim() ?? "";
  } catch {
    return "";
  }
};

const safeJsonParse = (value: string): Record<string, unknown> => {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return readRecord(parsed);
  } catch {
    return {};
  }
};

const toJson = (value: Record<string, unknown>) => JSON.stringify(value ?? {});

const buildTikTokPixelEventId = (event: Omit<TikTokPixelEvent, "eventLogId">) => {
  const hash = createHash("sha256");
  hash.update(event.clientObservedAt || event.loggedAt);
  hash.update("\u001f");
  hash.update(event.siteSource);
  hash.update("\u001f");
  hash.update(event.pixelSource);
  hash.update("\u001f");
  hash.update(event.action);
  hash.update("\u001f");
  hash.update(event.eventName);
  hash.update("\u001f");
  hash.update(event.eventId);
  hash.update("\u001f");
  hash.update(event.orderCode);
  hash.update("\u001f");
  hash.update(event.orderNo);
  hash.update("\u001f");
  hash.update(event.paymentCode);
  return hash.digest("hex");
};

const ensureTikTokPixelEventsSchema = (db: Database.Database) => {
  if (schemaReady) return;

  db.exec(`
    CREATE TABLE IF NOT EXISTS ${TIKTOK_PIXEL_EVENTS_TABLE} (
      event_log_id TEXT PRIMARY KEY,
      logged_at TEXT NOT NULL,
      client_observed_at TEXT NOT NULL DEFAULT '',
      site_source TEXT NOT NULL DEFAULT '',
      pixel_source TEXT NOT NULL DEFAULT '',
      action TEXT NOT NULL DEFAULT '',
      event_name TEXT NOT NULL DEFAULT '',
      event_id TEXT NOT NULL DEFAULT '',
      original_event_name TEXT NOT NULL DEFAULT '',
      original_event_id TEXT NOT NULL DEFAULT '',
      replacement_event_name TEXT NOT NULL DEFAULT '',
      order_code TEXT NOT NULL DEFAULT '',
      order_no TEXT NOT NULL DEFAULT '',
      payment_code TEXT NOT NULL DEFAULT '',
      payment_key_present INTEGER NOT NULL DEFAULT 0,
      value REAL,
      currency TEXT NOT NULL DEFAULT '',
      decision_status TEXT NOT NULL DEFAULT '',
      decision_branch TEXT NOT NULL DEFAULT '',
      decision_reason TEXT NOT NULL DEFAULT '',
      decision_matched_by TEXT NOT NULL DEFAULT '',
      ttclid TEXT NOT NULL DEFAULT '',
      utm_source TEXT NOT NULL DEFAULT '',
      utm_medium TEXT NOT NULL DEFAULT '',
      utm_campaign TEXT NOT NULL DEFAULT '',
      utm_content TEXT NOT NULL DEFAULT '',
      utm_term TEXT NOT NULL DEFAULT '',
      url TEXT NOT NULL DEFAULT '',
      referrer TEXT NOT NULL DEFAULT '',
      params_json TEXT NOT NULL DEFAULT '{}',
      decision_json TEXT NOT NULL DEFAULT '{}',
      request_context_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_tiktok_pixel_events_logged_at
      ON ${TIKTOK_PIXEL_EVENTS_TABLE}(logged_at DESC);
    CREATE INDEX IF NOT EXISTS idx_tiktok_pixel_events_site_source
      ON ${TIKTOK_PIXEL_EVENTS_TABLE}(site_source);
    CREATE INDEX IF NOT EXISTS idx_tiktok_pixel_events_action
      ON ${TIKTOK_PIXEL_EVENTS_TABLE}(action);
    CREATE INDEX IF NOT EXISTS idx_tiktok_pixel_events_event_name
      ON ${TIKTOK_PIXEL_EVENTS_TABLE}(event_name);
    CREATE INDEX IF NOT EXISTS idx_tiktok_pixel_events_event_id
      ON ${TIKTOK_PIXEL_EVENTS_TABLE}(event_id);
    CREATE INDEX IF NOT EXISTS idx_tiktok_pixel_events_order_code
      ON ${TIKTOK_PIXEL_EVENTS_TABLE}(order_code);
    CREATE INDEX IF NOT EXISTS idx_tiktok_pixel_events_order_no
      ON ${TIKTOK_PIXEL_EVENTS_TABLE}(order_no);
  `);

  schemaReady = true;
};

export const normalizeTikTokPixelEventPayload = (
  raw: unknown,
  requestContext: AttributionLedgerEntry["requestContext"],
  siteSource = "",
  loggedAt = new Date().toISOString(),
): TikTokPixelEvent => {
  const input = readRecord(raw);
  const params = readRecord(input.params);
  const options = readRecord(input.options);
  const decision = readRecord(input.decision);
  const url = readString(input, ["url", "href"]) || requestContext.requestReferer;
  const referrer = readString(input, ["referrer", "referer"]);
  const eventWithoutId = {
    loggedAt,
    clientObservedAt: readString(input, ["clientObservedAt", "client_observed_at", "at"]),
    siteSource: siteSource || readString(input, ["siteSource", "site_source"]),
    pixelSource: readString(input, ["pixelSource", "pixel_source", "source"]),
    action: readString(input, ["action", "phase"]) || "unknown",
    eventName: readString(input, ["eventName", "event_name"]) || readString(params, ["eventName", "event_name"]),
    eventId:
      readString(input, ["eventId", "event_id", "eventID"]) ||
      readString(params, ["event_id", "eventID", "eventId"]) ||
      readString(options, ["event_id", "eventID", "eventId"]),
    originalEventName:
      readString(input, ["originalEventName", "original_event_name"]) ||
      readString(params, ["original_event_name", "originalEventName"]),
    originalEventId:
      readString(input, ["originalEventId", "original_event_id"]) ||
      readString(params, ["original_event_id", "originalEventId"]),
    replacementEventName:
      readString(input, ["replacementEventName", "replacement_event_name"]) ||
      readString(params, ["replacement_event_name", "replacementEventName"]),
    orderCode:
      readString(input, ["orderCode", "order_code"]) ||
      readString(params, ["order_code", "orderCode"]) ||
      readUrlParam(url, "order_code") ||
      readUrlParam(referrer, "order_code"),
    orderNo:
      readString(input, ["orderNo", "order_no", "orderId", "order_id"]) ||
      readString(params, ["order_no", "orderNo", "order_id", "orderId"]) ||
      readUrlParam(url, "order_no") ||
      readUrlParam(referrer, "order_no"),
    paymentCode:
      readString(input, ["paymentCode", "payment_code"]) ||
      readString(params, ["payment_code", "paymentCode"]) ||
      readUrlParam(url, "payment_code") ||
      readUrlParam(referrer, "payment_code"),
    paymentKeyPresent: readBooleanish(input, ["paymentKeyPresent", "payment_key_present", "hasPaymentKey"]),
    value: readNumber(input, ["value"]) ?? readNumber(params, ["value", "amount", "totalAmount"]),
    currency: readString(input, ["currency"]) || readString(params, ["currency"]) || "KRW",
    decisionStatus:
      readString(input, ["decisionStatus", "decision_status", "status"]) ||
      readString(decision, ["status"]),
    decisionBranch:
      readString(input, ["decisionBranch", "decision_branch", "browserAction"]) ||
      readString(decision, ["browserAction", "branch"]),
    decisionReason:
      readString(input, ["decisionReason", "decision_reason", "reason"]) ||
      readString(decision, ["reason"]),
    decisionMatchedBy:
      readString(input, ["decisionMatchedBy", "decision_matched_by", "matchedBy"]) ||
      readString(decision, ["matchedBy"]),
    ttclid: readString(input, ["ttclid"]) || readUrlParam(url, "ttclid"),
    utmSource: readString(input, ["utmSource", "utm_source"]) || readUrlParam(url, "utm_source"),
    utmMedium: readString(input, ["utmMedium", "utm_medium"]) || readUrlParam(url, "utm_medium"),
    utmCampaign: readString(input, ["utmCampaign", "utm_campaign"]) || readUrlParam(url, "utm_campaign"),
    utmContent: readString(input, ["utmContent", "utm_content"]) || readUrlParam(url, "utm_content"),
    utmTerm: readString(input, ["utmTerm", "utm_term"]) || readUrlParam(url, "utm_term"),
    url,
    referrer,
    params: {
      params,
      options,
    },
    decision,
    requestContext,
  };

  return {
    eventLogId: buildTikTokPixelEventId(eventWithoutId),
    ...eventWithoutId,
  };
};

const rowToTikTokPixelEvent = (row: TikTokPixelEventRow): TikTokPixelEvent => ({
  eventLogId: row.event_log_id,
  loggedAt: row.logged_at,
  clientObservedAt: row.client_observed_at,
  siteSource: row.site_source,
  pixelSource: row.pixel_source,
  action: row.action,
  eventName: row.event_name,
  eventId: row.event_id,
  originalEventName: row.original_event_name,
  originalEventId: row.original_event_id,
  replacementEventName: row.replacement_event_name,
  orderCode: row.order_code,
  orderNo: row.order_no,
  paymentCode: row.payment_code,
  paymentKeyPresent: row.payment_key_present === 1,
  value: row.value,
  currency: row.currency,
  decisionStatus: row.decision_status,
  decisionBranch: row.decision_branch,
  decisionReason: row.decision_reason,
  decisionMatchedBy: row.decision_matched_by,
  ttclid: row.ttclid,
  utmSource: row.utm_source,
  utmMedium: row.utm_medium,
  utmCampaign: row.utm_campaign,
  utmContent: row.utm_content,
  utmTerm: row.utm_term,
  url: row.url,
  referrer: row.referrer,
  params: safeJsonParse(row.params_json),
  decision: safeJsonParse(row.decision_json),
  requestContext: safeJsonParse(row.request_context_json) as AttributionLedgerEntry["requestContext"],
});

export const appendTikTokPixelEvent = (event: TikTokPixelEvent) => {
  const db = getCrmDb();
  ensureTikTokPixelEventsSchema(db);

  const result = db.prepare(`
    INSERT OR IGNORE INTO ${TIKTOK_PIXEL_EVENTS_TABLE} (
      event_log_id, logged_at, client_observed_at, site_source, pixel_source,
      action, event_name, event_id, original_event_name, original_event_id,
      replacement_event_name, order_code, order_no, payment_code,
      payment_key_present, value, currency, decision_status, decision_branch,
      decision_reason, decision_matched_by, ttclid, utm_source, utm_medium,
      utm_campaign, utm_content, utm_term, url, referrer, params_json,
      decision_json, request_context_json
    ) VALUES (
      @event_log_id, @logged_at, @client_observed_at, @site_source, @pixel_source,
      @action, @event_name, @event_id, @original_event_name, @original_event_id,
      @replacement_event_name, @order_code, @order_no, @payment_code,
      @payment_key_present, @value, @currency, @decision_status, @decision_branch,
      @decision_reason, @decision_matched_by, @ttclid, @utm_source, @utm_medium,
      @utm_campaign, @utm_content, @utm_term, @url, @referrer, @params_json,
      @decision_json, @request_context_json
    )
  `).run({
    event_log_id: event.eventLogId,
    logged_at: event.loggedAt,
    client_observed_at: event.clientObservedAt,
    site_source: event.siteSource,
    pixel_source: event.pixelSource,
    action: event.action,
    event_name: event.eventName,
    event_id: event.eventId,
    original_event_name: event.originalEventName,
    original_event_id: event.originalEventId,
    replacement_event_name: event.replacementEventName,
    order_code: event.orderCode,
    order_no: event.orderNo,
    payment_code: event.paymentCode,
    payment_key_present: event.paymentKeyPresent ? 1 : 0,
    value: event.value,
    currency: event.currency,
    decision_status: event.decisionStatus,
    decision_branch: event.decisionBranch,
    decision_reason: event.decisionReason,
    decision_matched_by: event.decisionMatchedBy,
    ttclid: event.ttclid,
    utm_source: event.utmSource,
    utm_medium: event.utmMedium,
    utm_campaign: event.utmCampaign,
    utm_content: event.utmContent,
    utm_term: event.utmTerm,
    url: event.url,
    referrer: event.referrer,
    params_json: toJson(event.params),
    decision_json: toJson(event.decision),
    request_context_json: toJson(event.requestContext),
  });

  return Number(result.changes ?? 0);
};

export const listTikTokPixelEvents = (filters: TikTokPixelEventListFilters = {}) => {
  const db = getCrmDb();
  ensureTikTokPixelEventsSchema(db);

  const where: string[] = [];
  const params: Record<string, unknown> = {};
  if (filters.startAt) {
    where.push("logged_at >= @start_at");
    params.start_at = filters.startAt;
  }
  if (filters.endAt) {
    where.push("logged_at <= @end_at");
    params.end_at = filters.endAt;
  }
  if (filters.siteSource) {
    where.push("site_source = @site_source");
    params.site_source = filters.siteSource;
  }
  if (filters.eventName) {
    where.push("event_name = @event_name");
    params.event_name = filters.eventName;
  }
  if (filters.action) {
    where.push("action = @action");
    params.action = filters.action;
  }
  if (filters.orderCode) {
    where.push("order_code = @order_code");
    params.order_code = filters.orderCode;
  }
  if (filters.orderNo) {
    where.push("order_no = @order_no");
    params.order_no = filters.orderNo;
  }
  params.limit = Math.max(1, Math.min(10000, Math.trunc(filters.limit ?? 100)));

  const sql = `
    SELECT
      event_log_id, logged_at, client_observed_at, site_source, pixel_source,
      action, event_name, event_id, original_event_name, original_event_id,
      replacement_event_name, order_code, order_no, payment_code,
      payment_key_present, value, currency, decision_status, decision_branch,
      decision_reason, decision_matched_by, ttclid, utm_source, utm_medium,
      utm_campaign, utm_content, utm_term, url, referrer, params_json,
      decision_json, request_context_json
    FROM ${TIKTOK_PIXEL_EVENTS_TABLE}
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY logged_at DESC, rowid DESC
    LIMIT @limit
  `;

  const rows = db.prepare(sql).all(params) as TikTokPixelEventRow[];
  return rows.map(rowToTikTokPixelEvent);
};

const countBy = (events: TikTokPixelEvent[], key: keyof TikTokPixelEvent) => {
  const result: Record<string, number> = {};
  for (const event of events) {
    const value = event[key];
    const bucket = typeof value === "string" && value ? value : "(none)";
    result[bucket] = (result[bucket] ?? 0) + 1;
  }
  return result;
};

export const buildTikTokPixelEventSummary = (events: TikTokPixelEvent[]) => {
  const uniqueOrders = new Set<string>();
  for (const event of events) {
    const key = event.orderCode || event.orderNo || event.eventId;
    if (key) uniqueOrders.add(key);
  }

  return {
    totalEvents: events.length,
    uniqueOrderKeys: uniqueOrders.size,
    countsByAction: countBy(events, "action"),
    countsByEventName: countBy(events, "eventName"),
    countsByDecisionStatus: countBy(events, "decisionStatus"),
    countsByDecisionBranch: countBy(events, "decisionBranch"),
  };
};
