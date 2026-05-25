/**
 * Leading Indicator Agent P1 aggregate contract
 *
 * Purpose:
 * - Return buyer vs non-buyer leading indicator aggregates for frontend.
 * - Keep raw order/payment/member/click/session identifiers out of responses.
 * - Provide an in-memory precompute skeleton that can be wired to VM Cloud later.
 */

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import type { AttributionLedgerEntry } from "./attribution";
import { resolveLedgerRevenueValue } from "./attribution";

export type LeadingIndicatorSite = "biocom" | "thecleancoffee";
export type LeadingIndicatorWindow = "1d" | "7d" | "14d" | "30d";
export type LeadingIndicatorChannel =
  | "meta"
  | "google_paid"
  | "youtube"
  | "naver_paid_or_brand"
  | "organic"
  | "direct_or_unknown"
  | "all";
export type LeadingIndicatorDimension =
  | "buyer_vs_leaver"
  | "channel"
  | "landing_bucket"
  | "campaign"
  | "product";
export type LeadingIndicatorFreshness = "cached" | "force";

export type LeadingIndicatorQuery = {
  site: LeadingIndicatorSite;
  window: LeadingIndicatorWindow;
  channel: LeadingIndicatorChannel;
  dimension: LeadingIndicatorDimension;
  freshness: LeadingIndicatorFreshness;
};

type LeadingIndicatorSource = {
  primary: "VM Cloud SQLite attribution_ledger";
  cross_check: "GA4 BigQuery export";
  freshness_kst: string;
  confidence: "high" | "medium" | "low";
};

type LeadingIndicatorCohort = {
  safe_sessions: number;
  ga4_joined_sessions: number;
  buyer_sessions: number;
  non_buyer_sessions: number;
  confirmed_buyer_sessions: number;
  checkout_non_buyer_sessions: number;
  ga4_purchase_conflict_sessions: number;
  pending_payment_success_sessions: number;
  ga4_purchase_conflict_rate_pct: number | null;
  confirmed_purchases: number;
  confirmed_revenue_krw: number;
  ledger_rows_scanned: number;
};

type LeadingIndicatorMetrics = {
  sessions: number;
  confirmed_purchases: number;
  confirmed_revenue_krw: number;
  p50_dwell_seconds: number | null;
  dwell_known_sessions: number;
  scroll_known_sessions: number;
  scroll_unknown_sessions: number;
  scroll90_sessions: number;
  /**
   * Backward-compatible alias. Same value as scroll90_known_rate_pct.
   * Frontend should prefer explicit denominator fields below.
   */
  scroll90_rate_pct: number | null;
  scroll90_known_rate_pct: number | null;
  scroll90_all_sessions_rate_pct: number | null;
  scroll_denominator_note: string;
  page_view_long_sessions: number;
  page_view_long_rate_pct: number | null;
  review_reach_sessions: number;
  review_reach_rate_pct: number | null;
  begin_checkout_rate_pct: number | null;
  add_to_cart_rate_pct: number | null;
  coupon_event_rate_pct: number | null;
};

type LeadingIndicatorItem = {
  rank: number;
  id: string;
  label: string;
  status: "candidate" | "watch" | "insufficient_data";
  score: number | null;
  score_grade: "strong_candidate" | "candidate" | "watch" | "insufficient_data";
  buyer_value: number | null;
  non_buyer_value: number | null;
  delta: number | null;
  unit: "seconds" | "pct" | "count";
  sample_sessions: number;
  known_coverage_pct: number | null;
  score_components: {
    lift: number;
    volume: number;
    confidence: number;
    controllability: number;
    risk_penalty: number;
  } | null;
  interpretation_ko: string;
  next_action_ko: string;
  data_quality_note_ko: string;
};

type LeadingIndicatorSegment = {
  bucket: string;
  sessions: number;
  buyers: number;
  confirmed_revenue_krw: number;
  buyer_rate_pct: number;
  p50_dwell_seconds: number | null;
  scroll90_rate_pct: number | null;
};

type Ga4BehaviorSnapshotMetrics = {
  safe_sessions: number;
  ga4_joined_sessions: number;
  join_rate_pct: number | null;
  p50_engagement_seconds: number | null;
  p75_engagement_seconds: number | null;
  scroll90_rate_pct: number | null;
  page_view_long_rate_pct: number | null;
  view_item_rate_pct: number | null;
  add_to_cart_rate_pct: number | null;
  begin_checkout_rate_pct: number | null;
  add_payment_info_rate_pct: number | null;
  ga4_purchase_event_rate_pct: number | null;
};

type Ga4BehaviorSnapshot = {
  status: "available" | "missing";
  source: "ga4_bigquery_safe_bridge_dry_run_snapshot" | "not_available";
  checked_at_kst: string | null;
  snapshot_window: "7d";
  requested_window: LeadingIndicatorWindow;
  window_alignment: "matched" | "snapshot_7d_fallback";
  site: LeadingIndicatorSite;
  channel: LeadingIndicatorChannel;
  confidence: "high" | "medium" | "low";
  root_cause_ko: string;
  recommended_usage_ko: string;
  buyer: Ga4BehaviorSnapshotMetrics | null;
  non_buyer: Ga4BehaviorSnapshotMetrics | null;
  deltas: {
    p50_engagement_seconds: number | null;
    scroll90_rate_pct: number | null;
    begin_checkout_rate_pct: number | null;
    add_to_cart_rate_pct: number | null;
    add_payment_info_rate_pct: number | null;
  };
  page_long_threshold: {
    recommended_threshold_seconds: number | null;
    recommended_threshold_label: string | null;
    current_7min_lift_pct: number | null;
    interpretation_ko: string | null;
  } | null;
};

export type LeadingIndicatorsReport = {
  ok: true;
  schema_version: "leading-indicators-v1";
  site: LeadingIndicatorSite;
  window: LeadingIndicatorWindow;
  channel: LeadingIndicatorChannel;
  dimension: LeadingIndicatorDimension;
  source: LeadingIndicatorSource;
  headline: {
    decision: string;
    buyer_dwell_delta_seconds: number | null;
    buyer_scroll90_delta_pct: number | null;
  };
  cohort: LeadingIndicatorCohort;
  comparison: {
    buyer: LeadingIndicatorMetrics;
    non_buyer: LeadingIndicatorMetrics;
    confirmed_buyer: LeadingIndicatorMetrics;
    checkout_non_buyer: LeadingIndicatorMetrics;
    ga4_purchase_conflict: LeadingIndicatorMetrics;
    pending_payment_success: LeadingIndicatorMetrics;
  };
  indicators: LeadingIndicatorItem[];
  segments: LeadingIndicatorSegment[];
  ga4_behavior_snapshot: Ga4BehaviorSnapshot;
  caveats: string[];
  safety: {
    raw_identifier_output: false;
    external_platform_send: 0;
    operating_db_write: 0;
    vm_cloud_write: 0;
    gtm_publish: 0;
    aggregate_only: true;
  };
};

export type LeadingIndicatorsCacheMeta = {
  cached: boolean;
  cached_at_kst: string | null;
  next_refresh_at_kst: string | null;
  generation_ms: number;
  staleness_ms: number;
  source:
    | "in_memory_precompute"
    | "live_cache_miss"
    | "live_force_refresh";
};

export type PrecomputedLeadingIndicators = {
  entry: {
    result: LeadingIndicatorsReport;
    computedAtMs: number;
    generationMs: number;
  };
  meta: LeadingIndicatorsCacheMeta;
};

export class LeadingIndicatorsValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LeadingIndicatorsValidationError";
  }
}

export const LEADING_INDICATOR_WINDOW_HOURS: Record<LeadingIndicatorWindow, number> = {
  "1d": 24,
  "7d": 24 * 7,
  "14d": 24 * 14,
  "30d": 24 * 30,
};

const DEFAULT_QUERY: LeadingIndicatorQuery = {
  site: "thecleancoffee",
  window: "7d",
  channel: "meta",
  dimension: "buyer_vs_leaver",
  freshness: "cached",
};

const PRECOMPUTE_INTERVAL_MS = Number.parseInt(
  process.env.LEADING_INDICATORS_PRECOMPUTE_INTERVAL_MS ?? `${30 * 60 * 1000}`,
  10,
);

const cache = new Map<string, PrecomputedLeadingIndicators["entry"]>();

const toSingleString = (value: unknown): string => {
  if (Array.isArray(value)) return String(value[0] ?? "").trim();
  if (value == null) return "";
  return String(value).trim();
};

const parseEnum = <T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
  field: string,
): T => {
  const raw = toSingleString(value);
  if (!raw) return fallback;
  if ((allowed as readonly string[]).includes(raw)) return raw as T;
  throw new LeadingIndicatorsValidationError(
    `invalid ${field}: ${raw}; allowed=${allowed.join(",")}`,
  );
};

export const parseLeadingIndicatorsQuery = (query: {
  site?: unknown;
  window?: unknown;
  channel?: unknown;
  dimension?: unknown;
  freshness?: unknown;
  force?: unknown;
}): LeadingIndicatorQuery => {
  const forceRaw = toSingleString(query.force).toLowerCase();
  const freshnessRaw = toSingleString(query.freshness).toLowerCase();
  return {
    site: parseEnum(
      query.site,
      ["biocom", "thecleancoffee"] as const,
      DEFAULT_QUERY.site,
      "site",
    ),
    window: parseEnum(
      query.window,
      ["1d", "7d", "14d", "30d"] as const,
      DEFAULT_QUERY.window,
      "window",
    ),
    channel: parseEnum(
      query.channel,
      [
        "meta",
        "google_paid",
        "youtube",
        "naver_paid_or_brand",
        "organic",
        "direct_or_unknown",
        "all",
      ] as const,
      DEFAULT_QUERY.channel,
      "channel",
    ),
    dimension: parseEnum(
      query.dimension,
      ["buyer_vs_leaver", "channel", "landing_bucket", "campaign", "product"] as const,
      DEFAULT_QUERY.dimension,
      "dimension",
    ),
    freshness:
      forceRaw === "true" || forceRaw === "1" || forceRaw === "yes" || freshnessRaw === "force"
        ? "force"
        : "cached",
  };
};

const kstFormatter = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

const formatKst = (ms: number): string => `${kstFormatter.format(new Date(ms)).replace(" ", " ")} KST`;

const safeHash = (value: string): string =>
  createHash("sha256").update(value).digest("hex").slice(0, 16);

const cacheKeyFor = (query: Omit<LeadingIndicatorQuery, "freshness">): string =>
  `${query.site}:${query.window}:${query.channel}:${query.dimension}`;

const objectValue = (
  obj: Record<string, unknown> | undefined,
  keys: string[],
): Record<string, unknown> | undefined => {
  if (!obj) return undefined;
  for (const key of keys) {
    const value = obj[key];
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
  }
  return undefined;
};

const stringValue = (
  obj: Record<string, unknown> | undefined,
  keys: string[],
): string => {
  if (!obj) return "";
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
};

const numberValue = (
  obj: Record<string, unknown> | undefined,
  keys: string[],
): number | null => {
  if (!obj) return null;
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const parsed = Number(value.replace(/[^\d.-]/g, ""));
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
};

const normalizeText = (value: string): string => value.trim().toLowerCase();

const safeUrlParam = (key: string, ...values: string[]): string => {
  for (const value of values) {
    if (!value) continue;
    try {
      const parsed = new URL(value, "https://biocom.kr");
      const found = parsed.searchParams.get(key)?.trim();
      if (found) return found;
    } catch {
      // Ignore malformed attribution evidence.
    }
  }
  return "";
};

const decodeTextLoose = (value: string): string => {
  if (!value) return "";
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const extractNapmTrCode = (napm: string): string => {
  const decoded = decodeTextLoose(napm);
  return decoded.match(/(?:^|\|)tr=([^|&]+)/i)?.[1]?.toLowerCase() || "";
};

const classifySite = (entry: AttributionLedgerEntry): LeadingIndicatorSite | null => {
  const metaSite = normalizeText(stringValue(entry.metadata, ["site", "store"]));
  if (metaSite === "biocom") return "biocom";
  if (metaSite === "thecleancoffee" || metaSite === "coffee") return "thecleancoffee";

  const blob = normalizeText(
    [
      entry.landing,
      entry.referrer,
      stringValue(objectValue(entry.metadata, ["referrerPayment"]), ["host"]),
    ].join(" "),
  );
  if (blob.includes("biocom.kr") || blob.includes("biocom.co")) return "biocom";
  if (blob.includes("thecleancoffee.com") || blob.includes("clean-coffee")) {
    return "thecleancoffee";
  }
  return null;
};

const hasPaidNaverMarker = (entry: AttributionLedgerEntry): boolean => {
  const blob = normalizeText([entry.landing, entry.referrer, entry.utmCampaign].join(" "));
  const napmTrCode = extractNapmTrCode(safeUrlParam("NaPm", entry.landing, entry.referrer));
  return (
    napmTrCode === "sa" ||
    napmTrCode === "brnd" ||
    blob.includes("nclid=") ||
    blob.includes("brandsearch") ||
    blob.includes("powerlink") ||
    blob.includes("n_media=") ||
    blob.includes("n_query=") ||
    blob.includes("n_ad_group=") ||
    blob.includes("n_ad=")
  );
};

const hasPaidGoogleMarker = (entry: AttributionLedgerEntry): boolean => {
  const utmSource = normalizeText(entry.utmSource);
  const utmMedium = normalizeText(entry.utmMedium);
  const metadataBlob = normalizeText(JSON.stringify(entry.metadata ?? {}));
  const blob = normalizeText(
    [
      entry.landing,
      entry.referrer,
      entry.utmSource,
      entry.utmMedium,
      entry.utmCampaign,
      entry.utmTerm,
      entry.utmContent,
      metadataBlob,
    ].join(" "),
  );

  const hasGoogleClickId =
    Boolean(entry.gclid) ||
    blob.includes("gclid=") ||
    blob.includes("gbraid=") ||
    blob.includes("wbraid=") ||
    blob.includes("gad_source=");

  const hasGoogleSource =
    utmSource.includes("google") ||
    utmSource.includes("adwords") ||
    utmSource.includes("googleads");

  const hasPaidMedium =
    utmMedium.includes("cpc") ||
    utmMedium.includes("paid") ||
    utmMedium.includes("ppc") ||
    utmMedium.includes("sem") ||
    utmMedium.includes("display");

  return (
    hasGoogleClickId ||
    (hasGoogleSource && hasPaidMedium) ||
    blob.includes("google_ads") ||
    blob.includes("googleads") ||
    blob.includes("google paid") ||
    blob.includes("google cpc")
  );
};

const classifyChannel = (entry: AttributionLedgerEntry): LeadingIndicatorChannel => {
  const utmSource = normalizeText(entry.utmSource);
  const utmMedium = normalizeText(entry.utmMedium);
  const utmCampaign = normalizeText(entry.utmCampaign);
  const landing = normalizeText(entry.landing);
  const referrer = normalizeText(entry.referrer);
  const metaSource = normalizeText(stringValue(entry.metadata, ["source", "channel", "eventSource"]));
  const eventName = normalizeText(stringValue(entry.metadata, ["eventName"]));

  if (
    entry.fbclid ||
    stringValue(entry.metadata, ["fbc", "_fbc"]) ||
    utmSource.includes("meta") ||
    utmSource.includes("facebook") ||
    utmSource.includes("instagram") ||
    metaSource.includes("meta") ||
    referrer.includes("facebook.com") ||
    referrer.includes("instagram.com") ||
    landing.includes("fbclid=")
  ) {
    return "meta";
  }

  if (hasPaidGoogleMarker(entry)) {
    return "google_paid";
  }

  if (
    utmSource.includes("youtube") ||
    utmMedium.includes("youtube") ||
    referrer.includes("youtube.com") ||
    referrer.includes("youtu.be")
  ) {
    return "youtube";
  }

  if (
    hasPaidNaverMarker(entry) ||
    (utmSource.includes("naver") &&
      (utmMedium.includes("cpc") ||
        utmMedium.includes("paid") ||
        utmMedium.includes("brand") ||
        utmCampaign.includes("brand")))
  ) {
    return "naver_paid_or_brand";
  }

  if (
    utmMedium.includes("organic") ||
    (referrer.includes("google.") && !utmMedium.includes("cpc")) ||
    (referrer.includes("search.naver.com") && !hasPaidNaverMarker(entry)) ||
    eventName.includes("organic")
  ) {
    return "organic";
  }

  return "direct_or_unknown";
};

const landingBucket = (entry: AttributionLedgerEntry): string => {
  try {
    const parsed = new URL(entry.landing || "https://unknown.local/");
    const path = parsed.pathname || "/";
    if (path.includes("/shop_view")) return "/shop_view";
    if (path.includes("/shop_cart")) return "/shop_cart";
    if (path.includes("/shop_payment")) return "/shop_payment";
    if (path.includes("review")) return "/reviews";
    if (path === "/") return "/";
    return path.split("/").filter(Boolean).slice(0, 2).join("/") || "/";
  } catch {
    return "unknown_landing";
  }
};

const sanitizeBucket = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return "unknown";
  return trimmed.replace(/[?#].*$/, "").slice(0, 80);
};

const productBucket = (entry: AttributionLedgerEntry): string => {
  const candidateContainers = [
    entry.metadata,
    objectValue(entry.metadata, ["ecommerce"]),
    objectValue(entry.metadata, ["agentsos_ga4"]),
    objectValue(entry.metadata, ["hurdlers_ga4"]),
  ];
  for (const container of candidateContainers) {
    const items = container?.items;
    if (Array.isArray(items) && items.length > 0) {
      const first = items[0] as Record<string, unknown>;
      const name = stringValue(first, ["item_name", "name", "product_name"]);
      const itemId = stringValue(first, ["item_id", "id", "product_id"]);
      if (name) return sanitizeBucket(name);
      if (itemId) return `item_${sanitizeBucket(itemId)}`;
    }
  }
  return "unknown_product";
};

const campaignBucket = (entry: AttributionLedgerEntry): string => {
  const campaign = sanitizeBucket(entry.utmCampaign);
  if (campaign !== "unknown") return campaign;
  const source = sanitizeBucket(entry.utmSource);
  const medium = sanitizeBucket(entry.utmMedium);
  if (source !== "unknown" || medium !== "unknown") return `${source}/${medium}`;
  return "unknown_campaign";
};

type SessionAggregate = {
  sessionKey: string;
  channel: LeadingIndicatorChannel;
  landingBucket: string;
  campaignBucket: string;
  productBucket: string;
  rows: number;
  hasGa4JoinKey: boolean;
  hasGa4Purchase: boolean;
  hasPendingPaymentSuccess: boolean;
  isBuyer: boolean;
  confirmedPurchases: number;
  confirmedRevenueKrw: number;
  maxVisibleSeconds: number | null;
  maxScrollPercent: number | null;
  hasPageViewLong: boolean;
  hasReviewReach: boolean;
  hasBeginCheckout: boolean;
  hasAddToCart: boolean;
  hasCouponEvent: boolean;
};

const sessionKeyFor = (entry: AttributionLedgerEntry, index: number): string => {
  const material = [
    entry.checkoutId,
    entry.gaSessionId,
    stringValue(entry.metadata, ["clientId", "client_id", "gaClientId", "ga_client_id"]),
    stringValue(entry.metadata, ["userPseudoId", "user_pseudo_id", "gaUserPseudoId", "ga_user_pseudo_id"]),
    entry.customerKey,
    `${entry.loggedAt}:${index}`,
  ].find((part) => part && part.trim());
  return `safe_session_${safeHash(material ?? `${entry.loggedAt}:${index}`)}`;
};

const hasGa4JoinKey = (entry: AttributionLedgerEntry): boolean =>
  Boolean(
    entry.gaSessionId ||
      stringValue(entry.metadata, ["clientId", "client_id", "gaClientId", "ga_client_id"]) ||
      stringValue(entry.metadata, ["userPseudoId", "user_pseudo_id", "gaUserPseudoId", "ga_user_pseudo_id"]),
  );

const hasGa4PurchaseEvidence = (entry: AttributionLedgerEntry): boolean => {
  const metadata = entry.metadata ?? {};
  const eventName = normalizeText(
    stringValue(metadata, [
      "eventName",
      "event_name",
      "ga4_event_name",
      "ga4EventName",
      "semantic_touchpoint",
    ]),
  );
  const ga4Metadata = objectValue(metadata, ["ga4", "ga4BigQuery", "ga4_bigquery"]);
  const joinedEvents = normalizeText(
    [
      stringValue(metadata, [
        "ga4_events",
        "joined_ga4_events",
        "joinedGa4Events",
        "events",
      ]),
      stringValue(ga4Metadata, ["eventName", "event_name", "events"]),
    ].join(" "),
  );
  const purchaseCount = numberValue(metadata, [
    "ga4_purchase_events",
    "ga4PurchaseEvents",
    "purchase_events",
    "purchaseEvents",
  ]);

  return (
    eventName === "purchase" ||
    eventName.includes("ga4_purchase") ||
    joinedEvents.split(/[\s,|]+/).includes("purchase") ||
    Boolean(purchaseCount && purchaseCount > 0)
  );
};

const visibleSeconds = (entry: AttributionLedgerEntry): number | null => {
  const seconds = numberValue(entry.metadata, ["visible_seconds", "visibleSeconds"]);
  if (seconds !== null) return Math.max(0, seconds);
  const ms = numberValue(entry.metadata, ["time_on_page_ms", "timeOnPageMs", "engagement_time_msec"]);
  return ms === null ? null : Math.max(0, Math.round(ms / 1000));
};

const scrollPercent = (entry: AttributionLedgerEntry): number | null => {
  const value = numberValue(entry.metadata, [
    "scroll_max_percent",
    "max_scroll_percent",
    "scrollPercent",
    "scroll_percent",
  ]);
  return value === null ? null : Math.max(0, Math.min(100, value));
};

const isBeginCheckout = (entry: AttributionLedgerEntry): boolean => {
  const eventName = normalizeText(stringValue(entry.metadata, ["eventName", "event_name", "semantic_touchpoint"]));
  return (
    entry.touchpoint === "checkout_started" ||
    entry.touchpoint === "payment_page_seen" ||
    eventName.includes("begin_checkout") ||
    eventName.includes("initiatecheckout")
  );
};

const isAddToCart = (entry: AttributionLedgerEntry): boolean => {
  const eventName = normalizeText(stringValue(entry.metadata, ["eventName", "event_name", "semantic_touchpoint"]));
  return (
    eventName.includes("addtocart") ||
    eventName.includes("add_to_cart") ||
    landingBucket(entry) === "/shop_cart"
  );
};

const isCouponEvent = (entry: AttributionLedgerEntry): boolean => {
  const eventName = normalizeText(stringValue(entry.metadata, ["eventName", "event_name", "semantic_touchpoint"]));
  const text = normalizeText(
    [
      eventName,
      stringValue(entry.metadata, ["elementText", "buttonText", "label"]),
      entry.landing,
    ].join(" "),
  );
  return text.includes("coupon") || text.includes("쿠폰");
};

const isPageViewLong = (entry: AttributionLedgerEntry): boolean => {
  const eventName = normalizeText(stringValue(entry.metadata, ["eventName", "event_name", "semantic_touchpoint"]));
  return eventName === "page_view_long" || eventName.includes("page_view_long");
};

const isReviewReach = (entry: AttributionLedgerEntry): boolean => {
  const eventName = normalizeText(stringValue(entry.metadata, ["eventName", "event_name", "semantic_touchpoint"]));
  const text = normalizeText(
    [
      eventName,
      entry.landing,
      entry.referrer,
      stringValue(entry.metadata, ["page_location", "pageLocation", "url", "path"]),
    ].join(" "),
  );
  return text.includes("review") || text.includes("리뷰") || text.includes("구매평");
};

const median = (values: number[]): number | null => {
  const sorted = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 100) / 100;
};

const pct = (num: number, den: number): number | null => {
  if (den <= 0) return null;
  return Math.round((num / den) * 1000) / 10;
};

const metricFor = (sessions: SessionAggregate[]): LeadingIndicatorMetrics => {
  const dwell = sessions
    .map((session) => session.maxVisibleSeconds)
    .filter((value): value is number => value !== null);
  const scrollKnown = sessions.filter((session) => session.maxScrollPercent !== null);
  const scroll90 = scrollKnown.filter((session) => (session.maxScrollPercent ?? 0) >= 90).length;
  const scroll90KnownRate = pct(scroll90, scrollKnown.length);
  const scroll90AllSessionsRate = pct(scroll90, sessions.length);
  const pageViewLong = sessions.filter((session) => session.hasPageViewLong).length;
  const reviewReach = sessions.filter((session) => session.hasReviewReach).length;

  return {
    sessions: sessions.length,
    confirmed_purchases: sessions.reduce((sum, session) => sum + session.confirmedPurchases, 0),
    confirmed_revenue_krw: Math.round(
      sessions.reduce((sum, session) => sum + session.confirmedRevenueKrw, 0),
    ),
    p50_dwell_seconds: median(dwell),
    dwell_known_sessions: dwell.length,
    scroll_known_sessions: scrollKnown.length,
    scroll_unknown_sessions: Math.max(0, sessions.length - scrollKnown.length),
    scroll90_sessions: scroll90,
    scroll90_rate_pct: scroll90KnownRate,
    scroll90_known_rate_pct: scroll90KnownRate,
    scroll90_all_sessions_rate_pct: scroll90AllSessionsRate,
    scroll_denominator_note:
      "scroll90_rate_pct는 스크롤 값을 수집한 세션만 분모로 둔 기존 호환값입니다. 전체 세션 기준 비교에는 scroll90_all_sessions_rate_pct를 사용하세요.",
    page_view_long_sessions: pageViewLong,
    page_view_long_rate_pct: pct(pageViewLong, sessions.length),
    review_reach_sessions: reviewReach,
    review_reach_rate_pct: pct(reviewReach, sessions.length),
    begin_checkout_rate_pct: pct(
      sessions.filter((session) => session.hasBeginCheckout).length,
      sessions.length,
    ),
    add_to_cart_rate_pct: pct(
      sessions.filter((session) => session.hasAddToCart).length,
      sessions.length,
    ),
    coupon_event_rate_pct: pct(
      sessions.filter((session) => session.hasCouponEvent).length,
      sessions.length,
    ),
  };
};

const delta = (buyer: number | null, nonBuyer: number | null): number | null => {
  if (buyer === null || nonBuyer === null) return null;
  return Math.round((buyer - nonBuyer) * 10) / 10;
};

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

const scoreRound = (value: number): number => Math.round(value * 10) / 10;

type IndicatorCandidateInput = {
  id: string;
  label: string;
  buyerValue: number | null;
  nonBuyerValue: number | null;
  unit: LeadingIndicatorItem["unit"];
  sampleSessions: number;
  knownSessions: number;
  totalSessions: number;
  liftScale: number;
  controllability: number;
  riskPenalty: number;
  interpretationKo: string;
  nextActionKo: string;
};

const indicatorDataQualityNote = (
  candidate: IndicatorCandidateInput,
  knownCoveragePct: number | null,
): string => {
  if (candidate.buyerValue === null || candidate.nonBuyerValue === null) {
    return "구매자 또는 비결제자 쪽에 비교할 값이 없어 아직 후보로 판단하지 않습니다.";
  }
  if (candidate.sampleSessions < 20) {
    return `표본이 ${candidate.sampleSessions}개라 한두 건 변화에도 비율이 크게 움직입니다. 방향만 참고하세요.`;
  }
  if (knownCoveragePct !== null && knownCoveragePct < 50) {
    return `수집된 행동값이 전체의 ${knownCoveragePct.toFixed(1)}%라 누락 가능성을 함께 봐야 합니다.`;
  }
  return "표본과 수집 범위가 현재 dry-run에서 비교 가능한 수준입니다.";
};

const scoreGradeFor = (
  status: LeadingIndicatorItem["status"],
  score: number | null,
): LeadingIndicatorItem["score_grade"] => {
  if (status === "insufficient_data" || score === null) return "insufficient_data";
  if (score >= 75) return "strong_candidate";
  if (score >= 60) return "candidate";
  return "watch";
};

const scoreIndicator = (candidate: IndicatorCandidateInput): Omit<LeadingIndicatorItem, "rank"> => {
  const valueDelta = delta(candidate.buyerValue, candidate.nonBuyerValue);
  const knownCoveragePct =
    candidate.totalSessions > 0 ? pct(candidate.knownSessions, candidate.totalSessions) : null;
  const hasEnoughData =
    candidate.buyerValue !== null &&
    candidate.nonBuyerValue !== null &&
    candidate.sampleSessions >= 20 &&
    (knownCoveragePct === null || knownCoveragePct >= 15);

  if (!hasEnoughData || valueDelta === null) {
    return {
      id: candidate.id,
      label: candidate.label,
      status: "insufficient_data",
      score: null,
      score_grade: "insufficient_data",
      buyer_value: candidate.buyerValue,
      non_buyer_value: candidate.nonBuyerValue,
      delta: valueDelta,
      unit: candidate.unit,
      sample_sessions: candidate.sampleSessions,
      known_coverage_pct: knownCoveragePct,
      score_components: null,
      interpretation_ko: candidate.interpretationKo,
      next_action_ko: candidate.nextActionKo,
      data_quality_note_ko: indicatorDataQualityNote(candidate, knownCoveragePct),
    };
  }

  const positiveLift = Math.max(0, valueDelta);
  const lift = scoreRound(clamp((positiveLift / candidate.liftScale) * 35, 0, 35));
  const volume = scoreRound(
    clamp((Math.log10(candidate.sampleSessions + 1) / Math.log10(500)) * 20, 0, 20),
  );
  const confidence = scoreRound(clamp(((knownCoveragePct ?? 100) / 100) * 20, 0, 20));
  const controllability = scoreRound(clamp(candidate.controllability, 0, 20));
  const riskPenalty = scoreRound(clamp(candidate.riskPenalty, 0, 20));
  const score = scoreRound(clamp(lift + volume + confidence + controllability - riskPenalty, 0, 100));
  const status: LeadingIndicatorItem["status"] =
    valueDelta > 0 && score >= 60 ? "candidate" : "watch";

  return {
    id: candidate.id,
    label: candidate.label,
    status,
    score,
    score_grade: scoreGradeFor(status, score),
    buyer_value: candidate.buyerValue,
    non_buyer_value: candidate.nonBuyerValue,
    delta: valueDelta,
    unit: candidate.unit,
    sample_sessions: candidate.sampleSessions,
    known_coverage_pct: knownCoveragePct,
    score_components: {
      lift,
      volume,
      confidence,
      controllability,
      risk_penalty: riskPenalty,
    },
    interpretation_ko: candidate.interpretationKo,
    next_action_ko: candidate.nextActionKo,
    data_quality_note_ko: indicatorDataQualityNote(candidate, knownCoveragePct),
  };
};

const buildIndicators = (
  buyer: LeadingIndicatorMetrics,
  nonBuyer: LeadingIndicatorMetrics,
): LeadingIndicatorItem[] => {
  const totalSessions = buyer.sessions + nonBuyer.sessions;
  const candidates: IndicatorCandidateInput[] = [
    {
      id: "dwell_p50",
      label: "상세페이지에 머문 시간 중앙값",
      buyerValue: buyer.p50_dwell_seconds,
      nonBuyerValue: nonBuyer.p50_dwell_seconds,
      unit: "seconds",
      sampleSessions: buyer.dwell_known_sessions + nonBuyer.dwell_known_sessions,
      knownSessions: buyer.dwell_known_sessions + nonBuyer.dwell_known_sessions,
      totalSessions,
      liftScale: 120,
      controllability: 16,
      riskPenalty: 4,
      interpretationKo:
        "구매자가 더 오래 머문다면 상세페이지의 설득 구간을 구매 예고 행동 후보로 볼 수 있습니다.",
      nextActionKo:
        "결제자와 멈춘 사람의 체류시간 차이가 큰 랜딩/상품을 먼저 보고, 빠르게 이탈하는 구간의 문구와 리뷰 배치를 조정합니다.",
    },
    {
      id: "page_view_long_rate",
      label: "오래 본 방문 비율",
      unit: "pct",
      buyerValue: buyer.page_view_long_rate_pct,
      nonBuyerValue: nonBuyer.page_view_long_rate_pct,
      sampleSessions: totalSessions,
      knownSessions: totalSessions,
      totalSessions,
      liftScale: 30,
      controllability: 14,
      riskPenalty: 5,
      interpretationKo:
        "일정 시간 이상 머문 방문이 구매자에게 더 많으면 콘텐츠 몰입이 구매 전 선행지표일 수 있습니다.",
      nextActionKo:
        "현재 7분 기준은 보조 지표로 두고, 3분/5분/7분 중 구매자와 비결제자를 가장 잘 가르는 기준을 채널별로 비교합니다.",
    },
    {
      id: "review_reach_rate",
      label: "리뷰 구간 도달 비율",
      unit: "pct",
      buyerValue: buyer.review_reach_rate_pct,
      nonBuyerValue: nonBuyer.review_reach_rate_pct,
      sampleSessions: totalSessions,
      knownSessions: totalSessions,
      totalSessions,
      liftScale: 30,
      controllability: 18,
      riskPenalty: 6,
      interpretationKo:
        "구매자가 리뷰 영역까지 더 자주 도달하면 리뷰 노출이 구매를 예고하거나 설득하는 구간일 수 있습니다.",
      nextActionKo:
        "리뷰 도달 전 이탈이 많은 랜딩은 리뷰 위치, 요약 문구, 구매평 CTA를 위로 올리는 실험 후보로 둡니다.",
    },
    {
      id: "scroll90_all_sessions_rate",
      label: "90% 이상 스크롤 비율(전체 방문 기준)",
      unit: "pct",
      buyerValue: buyer.scroll90_all_sessions_rate_pct,
      nonBuyerValue: nonBuyer.scroll90_all_sessions_rate_pct,
      sampleSessions: totalSessions,
      knownSessions: buyer.scroll_known_sessions + nonBuyer.scroll_known_sessions,
      totalSessions,
      liftScale: 30,
      controllability: 12,
      riskPenalty: 8,
      interpretationKo:
        "구매자가 페이지 하단까지 더 자주 내려가면 완독 신호일 수 있지만, 스크롤 수집 누락이 있으면 과대해석하면 안 됩니다.",
      nextActionKo:
        "스크롤 값이 없는 방문까지 분모에 포함한 수치를 기본으로 보고, 이전 known-only 수치와 차이가 큰지 계속 감시합니다.",
    },
    {
      id: "begin_checkout_rate",
      label: "주문서 진입 비율",
      buyerValue: buyer.begin_checkout_rate_pct,
      nonBuyerValue: nonBuyer.begin_checkout_rate_pct,
      unit: "pct",
      sampleSessions: totalSessions,
      knownSessions: totalSessions,
      totalSessions,
      liftScale: 25,
      controllability: 20,
      riskPenalty: 7,
      interpretationKo:
        "주문서 진입은 매출 직전 행동입니다. 이 비율이 낮으면 광고보다 랜딩/상품 선택 마찰을 먼저 봐야 합니다.",
      nextActionKo:
        "구매 버튼 클릭 후 주문서 도달이 낮은 상품은 옵션 선택, 쿠폰 영역, 버튼 위치, 외부 결제 이동 지연을 먼저 점검합니다.",
    },
    {
      id: "add_to_cart_rate",
      label: "장바구니 신호 비율",
      buyerValue: buyer.add_to_cart_rate_pct,
      nonBuyerValue: nonBuyer.add_to_cart_rate_pct,
      unit: "pct",
      sampleSessions: totalSessions,
      knownSessions: totalSessions,
      totalSessions,
      liftScale: 25,
      controllability: 16,
      riskPenalty: 7,
      interpretationKo:
        "장바구니 페이지 진입 또는 AddToCart 이벤트가 구매자에게 더 많으면 상품 선택 의도가 강한 선행지표입니다.",
      nextActionKo:
        "장바구니 단계가 낮거나 0이면 클릭 이벤트와 장바구니 페이지 진입 중 어떤 정의로 볼지 고정하고 VM 수집을 맞춥니다.",
    },
    {
      id: "coupon_event_rate",
      label: "쿠폰 반응 비율",
      buyerValue: buyer.coupon_event_rate_pct,
      nonBuyerValue: nonBuyer.coupon_event_rate_pct,
      unit: "pct",
      sampleSessions: totalSessions,
      knownSessions: totalSessions,
      totalSessions,
      liftScale: 20,
      controllability: 18,
      riskPenalty: 9,
      interpretationKo:
        "구매자가 쿠폰 버튼이나 쿠폰 영역에 더 많이 반응하면 가격 장벽을 낮추는 선행 행동 후보입니다.",
      nextActionKo:
        "쿠폰 이벤트가 잡히는 상품과 안 잡히는 상품을 분리하고, 쿠폰 수령 후 주문서 진입률을 별도 지표로 추가합니다.",
    },
  ];

  return candidates
    .map(scoreIndicator)
    .sort((a, b) => {
      const scoreDiff = (b.score ?? -1) - (a.score ?? -1);
      if (scoreDiff !== 0) return scoreDiff;
      return (b.delta ?? -999) - (a.delta ?? -999);
    })
    .slice(0, 5)
    .map((candidate, index) => ({ ...candidate, rank: index + 1 }));
};

const segmentBucketFor = (
  session: SessionAggregate,
  dimension: LeadingIndicatorDimension,
): string => {
  switch (dimension) {
    case "channel":
      return session.channel;
    case "landing_bucket":
      return session.landingBucket;
    case "campaign":
      return session.campaignBucket;
    case "product":
      return session.productBucket;
    case "buyer_vs_leaver":
    default:
      if (session.isBuyer) return "confirmed_buyer";
      if (session.hasGa4Purchase) return "ga4_purchase_conflict";
      if (session.hasPendingPaymentSuccess) return "pending_payment_success";
      return "checkout_non_buyer";
  }
};

const buildSegments = (
  sessions: SessionAggregate[],
  dimension: LeadingIndicatorDimension,
): LeadingIndicatorSegment[] => {
  const grouped = new Map<string, SessionAggregate[]>();
  for (const session of sessions) {
    const bucket = segmentBucketFor(session, dimension);
    const existing = grouped.get(bucket) ?? [];
    existing.push(session);
    grouped.set(bucket, existing);
  }
  return Array.from(grouped.entries())
    .map(([bucket, bucketSessions]) => {
      const metrics = metricFor(bucketSessions);
      const buyers = bucketSessions.filter((session) => session.isBuyer).length;
      return {
        bucket,
        sessions: bucketSessions.length,
        buyers,
        confirmed_revenue_krw: metrics.confirmed_revenue_krw,
        buyer_rate_pct: pct(buyers, bucketSessions.length) ?? 0,
        p50_dwell_seconds: metrics.p50_dwell_seconds,
        scroll90_rate_pct: metrics.scroll90_rate_pct,
      };
    })
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, 12);
};

const buildHeadline = (
  buyer: LeadingIndicatorMetrics,
  nonBuyer: LeadingIndicatorMetrics,
  conflict: LeadingIndicatorMetrics,
  pending: LeadingIndicatorMetrics,
): LeadingIndicatorsReport["headline"] => {
  const dwellDelta = delta(buyer.p50_dwell_seconds, nonBuyer.p50_dwell_seconds);
  const scrollDelta = delta(buyer.scroll90_rate_pct, nonBuyer.scroll90_rate_pct);
  const decision =
    dwellDelta === null && scrollDelta === null
      ? "아직 확정 구매자와 순수 비결제자의 행동 차이를 확정할 만큼 row-level 행동 데이터가 부족합니다."
      : `확정 구매자와 순수 비결제자를 aggregate로 비교했습니다. GA4 purchase 충돌 ${conflict.sessions}건과 결제확인 보류 ${pending.sessions}건은 별도 cohort로 분리했고, 체류시간 차이=${dwellDelta ?? "unknown"}초, 스크롤90 차이=${scrollDelta ?? "unknown"}%p 입니다.`;
  return {
    decision,
    buyer_dwell_delta_seconds: dwellDelta,
    buyer_scroll90_delta_pct: scrollDelta,
  };
};

const snapshotJsonCache = new Map<string, unknown | null>();

const projectDataFile = (fileName: string): string | null => {
  const roots = new Set<string>();
  let cursor = process.cwd();
  for (let i = 0; i < 6; i += 1) {
    roots.add(cursor);
    roots.add(path.dirname(cursor));
    const parent = path.dirname(cursor);
    if (parent === cursor) break;
    cursor = parent;
  }
  cursor = __dirname;
  for (let i = 0; i < 6; i += 1) {
    roots.add(cursor);
    roots.add(path.dirname(cursor));
    const parent = path.dirname(cursor);
    if (parent === cursor) break;
    cursor = parent;
  }

  for (const root of roots) {
    const candidate = path.join(root, "data", "project", fileName);
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
};

const readProjectJson = (fileName: string): unknown | null => {
  if (snapshotJsonCache.has(fileName)) return snapshotJsonCache.get(fileName) ?? null;
  const filePath = projectDataFile(fileName);
  if (!filePath) {
    snapshotJsonCache.set(fileName, null);
    return null;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as unknown;
    snapshotJsonCache.set(fileName, parsed);
    return parsed;
  } catch {
    snapshotJsonCache.set(fileName, null);
    return null;
  }
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const arrayFrom = (obj: Record<string, unknown> | null, key: string): unknown[] => {
  const value = obj?.[key];
  return Array.isArray(value) ? value : [];
};

const rowMatches = (
  row: Record<string, unknown>,
  key: string,
  expected: string,
): boolean => stringValue(row, [key]) === expected;

const snapshotMetric = (
  row: Record<string, unknown> | null,
  kind: "cohort" | "buyer" | "non_buyer" | "channel_buyer" | "channel_non_buyer",
): Ga4BehaviorSnapshotMetrics | null => {
  if (!row) return null;

  if (kind === "cohort") {
    return {
      safe_sessions: numberValue(row, ["vm_safe_sessions"]) ?? 0,
      ga4_joined_sessions: numberValue(row, ["ga4_joined_sessions"]) ?? 0,
      join_rate_pct: numberValue(row, ["join_rate_pct"]),
      p50_engagement_seconds: numberValue(row, ["p50_engagement_seconds"]),
      p75_engagement_seconds: numberValue(row, ["p75_engagement_seconds"]),
      scroll90_rate_pct: numberValue(row, ["scroll90_rate_pct"]),
      page_view_long_rate_pct: numberValue(row, ["page_view_long_rate_pct"]),
      view_item_rate_pct: numberValue(row, ["view_item_rate_pct"]),
      add_to_cart_rate_pct: numberValue(row, ["add_to_cart_rate_pct"]),
      begin_checkout_rate_pct: numberValue(row, ["begin_checkout_rate_pct"]),
      add_payment_info_rate_pct: numberValue(row, ["add_payment_info_rate_pct"]),
      ga4_purchase_event_rate_pct: numberValue(row, ["ga4_purchase_event_rate_pct"]),
    };
  }

  if (kind === "channel_buyer" || kind === "channel_non_buyer") {
    const prefix = kind === "channel_buyer" ? "buyer" : "leaver";
    const sessions =
      kind === "channel_buyer"
        ? numberValue(row, ["confirmed_purchase_sessions"])
        : numberValue(row, ["dropped_checkout_sessions"]);
    return {
      safe_sessions: sessions ?? 0,
      ga4_joined_sessions: numberValue(row, ["ga4_joined_sessions"]) ?? 0,
      join_rate_pct: numberValue(row, ["join_rate_pct"]),
      p50_engagement_seconds: numberValue(row, [`${prefix}_p50_dwell_seconds`]),
      p75_engagement_seconds: null,
      scroll90_rate_pct: numberValue(row, [`${prefix}_scroll90_rate_pct`]),
      page_view_long_rate_pct: null,
      view_item_rate_pct: null,
      add_to_cart_rate_pct: numberValue(row, [
        `${prefix}_add_to_cart_or_view_cart_rate_pct`,
        `${prefix}_cart_signal_pct`,
      ]),
      begin_checkout_rate_pct: numberValue(row, [`${prefix}_begin_checkout_rate_pct`]),
      add_payment_info_rate_pct: numberValue(row, [`${prefix}_add_payment_info_rate_pct`]),
      ga4_purchase_event_rate_pct:
        kind === "channel_non_buyer"
          ? numberValue(row, ["dropped_with_ga4_purchase_event_rate_pct"])
          : null,
    };
  }

  const source = asRecord(row[kind]);
  if (!source) return null;
  return {
    safe_sessions: numberValue(source, ["vm_safe_sessions"]) ?? 0,
    ga4_joined_sessions: numberValue(source, ["ga4_joined_sessions"]) ?? 0,
    join_rate_pct: numberValue(source, ["join_rate_pct"]),
    p50_engagement_seconds: numberValue(source, ["p50_dwell_seconds", "p50_engagement_seconds"]),
    p75_engagement_seconds: numberValue(source, ["p75_dwell_seconds", "p75_engagement_seconds"]),
    scroll90_rate_pct: numberValue(source, ["scroll90_rate_pct"]),
    page_view_long_rate_pct: numberValue(source, ["page_view_long_rate_pct"]),
    view_item_rate_pct: numberValue(source, ["view_item_rate_pct"]),
    add_to_cart_rate_pct: numberValue(source, ["add_to_cart_or_view_cart_rate_pct", "add_to_cart_rate_pct"]),
    begin_checkout_rate_pct: numberValue(source, ["begin_checkout_rate_pct"]),
    add_payment_info_rate_pct: numberValue(source, ["add_payment_info_rate_pct"]),
    ga4_purchase_event_rate_pct: numberValue(source, ["ga4_purchase_event_rate_pct"]),
  };
};

const findPageLongThresholdRow = (
  site: LeadingIndicatorSite,
  channel: LeadingIndicatorChannel,
): Record<string, unknown> | null => {
  const raw = asRecord(readProjectJson("page-long-threshold-fit-dry-run-20260525.json"));
  const rows = arrayFrom(raw, "threshold_fit");
  const lookupChannel = channel === "all" ? "meta" : channel;
  const row = rows
    .map(asRecord)
    .find((candidate): candidate is Record<string, unknown> =>
      Boolean(
        candidate &&
          rowMatches(candidate, "site", site) &&
          rowMatches(candidate, "source_group", lookupChannel),
      ),
    );
  return row ?? null;
};

const pageLongSnapshot = (
  site: LeadingIndicatorSite,
  channel: LeadingIndicatorChannel,
): Ga4BehaviorSnapshot["page_long_threshold"] => {
  const row = findPageLongThresholdRow(site, channel);
  if (!row) return null;
  const current7Min = asRecord(row.current_7min);
  return {
    recommended_threshold_seconds: numberValue(row, ["recommended_threshold_seconds"]),
    recommended_threshold_label: stringValue(row, ["recommended_threshold_label"]) || null,
    current_7min_lift_pct: numberValue(current7Min ?? undefined, ["lift_pct"]),
    interpretation_ko: stringValue(row, ["interpretation"]) || null,
  };
};

const buildGa4BehaviorSnapshot = (input: {
  site: LeadingIndicatorSite;
  window: LeadingIndicatorWindow;
  channel: LeadingIndicatorChannel;
}): Ga4BehaviorSnapshot => {
  const checkedAt =
    stringValue(
      asRecord(readProjectJson("ga4-vm-row-level-safe-bridge-dry-run-20260525.json")) ?? undefined,
      ["checked_at_kst"],
    ) ||
    stringValue(
      asRecord(readProjectJson("coffee-channel-cohort-truth-table-20260525.json")) ?? undefined,
      ["checked_at_kst"],
    ) ||
    null;

  let buyer: Ga4BehaviorSnapshotMetrics | null = null;
  let nonBuyer: Ga4BehaviorSnapshotMetrics | null = null;
  let confidence: Ga4BehaviorSnapshot["confidence"] = "low";

  if (input.site === "biocom" && input.channel === "meta") {
    const raw = asRecord(readProjectJson("biocom-meta-only-buyer-leaver-truth-table-20260525.json"));
    const truthTable = asRecord(raw?.truth_table);
    buyer = snapshotMetric(truthTable, "buyer");
    nonBuyer = snapshotMetric(truthTable, "non_buyer");
    confidence = stringValue(truthTable ?? undefined, ["confidence"]) === "high" ? "high" : "medium";
  } else if (input.site === "thecleancoffee" && input.channel !== "all") {
    const raw = asRecord(readProjectJson("coffee-channel-cohort-truth-table-20260525.json"));
    const row = arrayFrom(raw, "channel_truth_table")
      .map(asRecord)
      .find((candidate): candidate is Record<string, unknown> =>
        Boolean(
          candidate &&
            rowMatches(candidate, "dimension", "source_group") &&
            rowMatches(candidate, "value", input.channel),
        ),
      );
    buyer = snapshotMetric(row ?? null, "channel_buyer");
    nonBuyer = snapshotMetric(row ?? null, "channel_non_buyer");
    const rowConfidence = stringValue(row ?? undefined, ["confidence"]);
    confidence = rowConfidence === "high" || rowConfidence === "medium" ? rowConfidence : "low";
  } else {
    const raw = asRecord(readProjectJson("ga4-vm-row-level-safe-bridge-dry-run-20260525.json"));
    const rows = arrayFrom(raw, "cohort_summary").map(asRecord);
    const buyerRow = rows.find((candidate): candidate is Record<string, unknown> =>
      Boolean(
        candidate &&
          rowMatches(candidate, "site", input.site) &&
          rowMatches(candidate, "cohort", "confirmed_purchase"),
      ),
    );
    const nonBuyerRow = rows.find((candidate): candidate is Record<string, unknown> =>
      Boolean(
        candidate &&
          rowMatches(candidate, "site", input.site) &&
          rowMatches(candidate, "cohort", "dropped_checkout"),
      ),
    );
    buyer = snapshotMetric(buyerRow ?? null, "cohort");
    nonBuyer = snapshotMetric(nonBuyerRow ?? null, "cohort");
    confidence = buyer && nonBuyer ? "high" : "low";
  }

  const available = Boolean(buyer && nonBuyer);
  const rootCauseKo =
    input.site === "thecleancoffee" && available
      ? "더클린커피 행동 공백은 GA4 원천 데이터 부재가 아니라, 기존 live API가 VM 원장 metadata만 보여서 생긴 표시 공백입니다. GA4 safe bridge snapshot에서는 행동 연결률이 높게 확인됩니다."
      : available
        ? "live API의 VM 원장 행동값과 GA4 행동값은 측정 방식이 다릅니다. 이 snapshot은 GA4 BigQuery safe bridge 기준 행동 비교입니다."
        : "요청한 site/channel 조합에 대응하는 GA4 행동 snapshot이 아직 없습니다.";

  return {
    status: available ? "available" : "missing",
    source: available ? "ga4_bigquery_safe_bridge_dry_run_snapshot" : "not_available",
    checked_at_kst: checkedAt,
    snapshot_window: "7d",
    requested_window: input.window,
    window_alignment: input.window === "7d" ? "matched" : "snapshot_7d_fallback",
    site: input.site,
    channel: input.channel,
    confidence,
    root_cause_ko: rootCauseKo,
    recommended_usage_ko:
      "구매자/비결제자 행동 차이 해석에는 ga4_behavior_snapshot을 우선 보고, CAPI 전송 감시와 결제 정본 판단에는 기존 VM Cloud cohort/comparison을 보세요.",
    buyer,
    non_buyer: nonBuyer,
    deltas: {
      p50_engagement_seconds: delta(
        buyer?.p50_engagement_seconds ?? null,
        nonBuyer?.p50_engagement_seconds ?? null,
      ),
      scroll90_rate_pct: delta(
        buyer?.scroll90_rate_pct ?? null,
        nonBuyer?.scroll90_rate_pct ?? null,
      ),
      begin_checkout_rate_pct: delta(
        buyer?.begin_checkout_rate_pct ?? null,
        nonBuyer?.begin_checkout_rate_pct ?? null,
      ),
      add_to_cart_rate_pct: delta(
        buyer?.add_to_cart_rate_pct ?? null,
        nonBuyer?.add_to_cart_rate_pct ?? null,
      ),
      add_payment_info_rate_pct: delta(
        buyer?.add_payment_info_rate_pct ?? null,
        nonBuyer?.add_payment_info_rate_pct ?? null,
      ),
    },
    page_long_threshold: pageLongSnapshot(input.site, input.channel),
  };
};

export const buildLeadingIndicatorsReport = (input: {
  ledgerEntries: AttributionLedgerEntry[];
  site: LeadingIndicatorSite;
  window: LeadingIndicatorWindow;
  channel: LeadingIndicatorChannel;
  dimension: LeadingIndicatorDimension;
  asOfMs?: number;
}): LeadingIndicatorsReport => {
  const asOfMs = input.asOfMs ?? Date.now();
  const fromMs = asOfMs - LEADING_INDICATOR_WINDOW_HOURS[input.window] * 60 * 60 * 1000;
  const sessions = new Map<string, SessionAggregate>();
  let rowsScanned = 0;

  input.ledgerEntries.forEach((entry, index) => {
    const loggedAtMs = Date.parse(entry.loggedAt);
    if (!Number.isFinite(loggedAtMs) || loggedAtMs < fromMs || loggedAtMs > asOfMs) return;

    const site = classifySite(entry);
    if (site && site !== input.site) return;

    const channel = classifyChannel(entry);
    if (input.channel !== "all" && channel !== input.channel) return;

    rowsScanned += 1;
    const key = sessionKeyFor(entry, index);
    const existing = sessions.get(key);
    const session =
      existing ??
      ({
        sessionKey: key,
        channel,
        landingBucket: landingBucket(entry),
        campaignBucket: campaignBucket(entry),
        productBucket: productBucket(entry),
        rows: 0,
        hasGa4JoinKey: false,
        hasGa4Purchase: false,
        hasPendingPaymentSuccess: false,
        isBuyer: false,
        confirmedPurchases: 0,
        confirmedRevenueKrw: 0,
        maxVisibleSeconds: null,
        maxScrollPercent: null,
        hasPageViewLong: false,
        hasReviewReach: false,
        hasBeginCheckout: false,
        hasAddToCart: false,
        hasCouponEvent: false,
      } satisfies SessionAggregate);

    session.rows += 1;
    session.hasGa4JoinKey = session.hasGa4JoinKey || hasGa4JoinKey(entry);
    session.hasGa4Purchase = session.hasGa4Purchase || hasGa4PurchaseEvidence(entry);
    session.hasPendingPaymentSuccess =
      session.hasPendingPaymentSuccess ||
      (entry.touchpoint === "payment_success" && entry.paymentStatus !== "confirmed");
    session.hasBeginCheckout = session.hasBeginCheckout || isBeginCheckout(entry);
    session.hasAddToCart = session.hasAddToCart || isAddToCart(entry);
    session.hasCouponEvent = session.hasCouponEvent || isCouponEvent(entry);
    session.hasPageViewLong = session.hasPageViewLong || isPageViewLong(entry);
    session.hasReviewReach = session.hasReviewReach || isReviewReach(entry);

    const dwell = visibleSeconds(entry);
    if (dwell !== null) {
      session.maxVisibleSeconds = Math.max(session.maxVisibleSeconds ?? 0, dwell);
    }

    const scroll = scrollPercent(entry);
    if (scroll !== null) {
      session.maxScrollPercent = Math.max(session.maxScrollPercent ?? 0, scroll);
    }

    if (entry.touchpoint === "payment_success" && entry.paymentStatus === "confirmed") {
      const revenue = resolveLedgerRevenueValue(entry);
      if (revenue > 0) {
        session.isBuyer = true;
        session.confirmedPurchases += 1;
        session.confirmedRevenueKrw += revenue;
        session.productBucket = productBucket(entry);
      }
    }

    sessions.set(key, session);
  });

  const sessionList = Array.from(sessions.values());
  const confirmedBuyers = sessionList.filter((session) => session.isBuyer);
  const ga4PurchaseConflicts = sessionList.filter(
    (session) => !session.isBuyer && session.hasGa4Purchase,
  );
  const pendingPaymentSuccess = sessionList.filter(
    (session) => !session.isBuyer && !session.hasGa4Purchase && session.hasPendingPaymentSuccess,
  );
  const checkoutNonBuyers = sessionList.filter(
    (session) => !session.isBuyer && !session.hasGa4Purchase && !session.hasPendingPaymentSuccess,
  );
  const buyerMetrics = metricFor(confirmedBuyers);
  const nonBuyerMetrics = metricFor(checkoutNonBuyers);
  const conflictMetrics = metricFor(ga4PurchaseConflicts);
  const pendingMetrics = metricFor(pendingPaymentSuccess);

  const caveats = [
    "이 응답은 raw 주문/결제/회원/click/session id를 반환하지 않는 aggregate 전용입니다.",
    "GA4 BigQuery 행동 snapshot은 ga4_behavior_snapshot에 aggregate-only로 붙입니다. 매출 정본은 VM Cloud confirmed payment_success입니다.",
    "non_buyer는 GA4 purchase 충돌과 pending/unknown/canceled payment_success 흔적이 없는 순수 비결제자입니다. GA4 purchase가 보이지만 VM confirmed purchase가 없는 세션은 ga4_purchase_conflict로 분리합니다.",
    "ga4_purchase_conflict는 GA4 purchase가 매출 정본이라는 뜻이 아니라, session/window mismatch 또는 VM confirmed bridge 누락 가능성을 따로 점검하라는 보류 bucket입니다.",
    "pending_payment_success는 VM payment_success 흔적은 있으나 confirmed로 닫히지 않은 세션입니다. 실제 미결제, 취소, sync 지연, bridge 누락 가능성이 있어 순수 비결제자 평균에 섞지 않습니다.",
    "scroll90은 이제 두 분모를 함께 제공합니다. scroll90_known_rate_pct는 스크롤 값이 있는 세션 기준이고, scroll90_all_sessions_rate_pct는 전체 safe session 기준입니다.",
    "page_view_long은 GTM 타이머 기반 오래 머문 방문 신호입니다. 바이오컴 문서 기준 타이머는 420초(7분)이며, site별 GTM 설정이 다를 수 있어 site 문서와 함께 확인해야 합니다.",
  ];

  return {
    ok: true,
    schema_version: "leading-indicators-v1",
    site: input.site,
    window: input.window,
    channel: input.channel,
    dimension: input.dimension,
    source: {
      primary: "VM Cloud SQLite attribution_ledger",
      cross_check: "GA4 BigQuery export",
      freshness_kst: formatKst(asOfMs),
      confidence: rowsScanned > 0 ? "medium" : "low",
    },
    headline: buildHeadline(buyerMetrics, nonBuyerMetrics, conflictMetrics, pendingMetrics),
    cohort: {
      safe_sessions: sessionList.length,
      ga4_joined_sessions: sessionList.filter((session) => session.hasGa4JoinKey).length,
      buyer_sessions: confirmedBuyers.length,
      non_buyer_sessions: checkoutNonBuyers.length,
      confirmed_buyer_sessions: confirmedBuyers.length,
      checkout_non_buyer_sessions: checkoutNonBuyers.length,
      ga4_purchase_conflict_sessions: ga4PurchaseConflicts.length,
      pending_payment_success_sessions: pendingPaymentSuccess.length,
      ga4_purchase_conflict_rate_pct: pct(
        ga4PurchaseConflicts.length,
        checkoutNonBuyers.length + ga4PurchaseConflicts.length + pendingPaymentSuccess.length,
      ),
      confirmed_purchases: buyerMetrics.confirmed_purchases,
      confirmed_revenue_krw: buyerMetrics.confirmed_revenue_krw,
      ledger_rows_scanned: rowsScanned,
    },
    comparison: {
      buyer: buyerMetrics,
      non_buyer: nonBuyerMetrics,
      confirmed_buyer: buyerMetrics,
      checkout_non_buyer: nonBuyerMetrics,
      ga4_purchase_conflict: conflictMetrics,
      pending_payment_success: pendingMetrics,
    },
    indicators: buildIndicators(buyerMetrics, nonBuyerMetrics),
    segments: buildSegments(sessionList, input.dimension),
    ga4_behavior_snapshot: buildGa4BehaviorSnapshot({
      site: input.site,
      window: input.window,
      channel: input.channel,
    }),
    caveats,
    safety: {
      raw_identifier_output: false,
      external_platform_send: 0,
      operating_db_write: 0,
      vm_cloud_write: 0,
      gtm_publish: 0,
      aggregate_only: true,
    },
  };
};

export const getPrecomputedLeadingIndicators = (
  query: Omit<LeadingIndicatorQuery, "freshness">,
): PrecomputedLeadingIndicators | null => {
  const entry = cache.get(cacheKeyFor(query));
  if (!entry) return null;
  const nowMs = Date.now();
  return {
    entry,
    meta: {
      cached: true,
      cached_at_kst: formatKst(entry.computedAtMs),
      next_refresh_at_kst: formatKst(entry.computedAtMs + PRECOMPUTE_INTERVAL_MS),
      generation_ms: entry.generationMs,
      staleness_ms: Math.max(0, nowMs - entry.computedAtMs),
      source: "in_memory_precompute",
    },
  };
};

const PRECOMPUTE_SITES: LeadingIndicatorSite[] = ["biocom", "thecleancoffee"];
const PRECOMPUTE_WINDOWS: LeadingIndicatorWindow[] = ["1d", "7d", "14d", "30d"];
const PRECOMPUTE_BUYER_CHANNELS: LeadingIndicatorChannel[] = [
  "meta",
  "google_paid",
  "youtube",
  "organic",
];

const PRECOMPUTE_TARGETS: Array<Omit<LeadingIndicatorQuery, "freshness">> = [
  ...PRECOMPUTE_SITES.flatMap((site) =>
    PRECOMPUTE_WINDOWS.flatMap((window) =>
      PRECOMPUTE_BUYER_CHANNELS.map((channel) => ({
        site,
        window,
        channel,
        dimension: "buyer_vs_leaver" as const,
      })),
    ),
  ),
  ...PRECOMPUTE_SITES.flatMap((site) =>
    PRECOMPUTE_WINDOWS.filter((window) => window !== "1d").map((window) => ({
      site,
      window,
      channel: "all" as const,
      dimension: "channel" as const,
    })),
  ),
  ...PRECOMPUTE_SITES.flatMap((site) =>
    PRECOMPUTE_WINDOWS.filter((window) => window !== "1d").map((window) => ({
      site,
      window,
      channel: "meta" as const,
      dimension: "landing_bucket" as const,
    })),
  ),
];

export const runLeadingIndicatorsPrecomputeOnce = async (
  loadData: () => Promise<{ ledgerEntries: AttributionLedgerEntry[] }>,
): Promise<{ ok: number; failed: number; generation_ms: number }> => {
  const startedAt = Date.now();
  const { ledgerEntries } = await loadData();
  let ok = 0;
  let failed = 0;

  for (const target of PRECOMPUTE_TARGETS) {
    const targetStartedAt = Date.now();
    try {
      const result = buildLeadingIndicatorsReport({
        ledgerEntries,
        ...target,
        asOfMs: Date.now(),
      });
      cache.set(cacheKeyFor(target), {
        result,
        computedAtMs: Date.now(),
        generationMs: Date.now() - targetStartedAt,
      });
      ok += 1;
    } catch {
      failed += 1;
    }
  }

  return {
    ok,
    failed,
    generation_ms: Date.now() - startedAt,
  };
};

export const startLeadingIndicatorsPrecomputeWorker = (
  loadData: () => Promise<{ ledgerEntries: AttributionLedgerEntry[] }>,
  intervalMs = PRECOMPUTE_INTERVAL_MS,
): NodeJS.Timeout | null => {
  const enabled =
    process.env.LEADING_INDICATORS_PRECOMPUTE_ENABLED === "1" ||
    process.env.LEADING_INDICATORS_PRECOMPUTE_ENABLED === "true";
  if (!enabled) return null;

  const safeIntervalMs = Math.max(5 * 60 * 1000, intervalMs);
  const tick = async () => {
    try {
      const result = await runLeadingIndicatorsPrecomputeOnce(loadData);
      console.log(
        `[leading-indicators precompute] tick ok=${result.ok} failed=${result.failed} generation_ms=${result.generation_ms} next=${Math.round(safeIntervalMs / 1000)}s`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown";
      console.warn(`[leading-indicators precompute] tick failed: ${message}`);
    }
  };

  setTimeout(() => {
    void tick();
  }, 30 * 1000);

  return setInterval(() => {
    void tick();
  }, safeIntervalMs);
};
