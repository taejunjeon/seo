/**
 * Leading Indicator Agent P1 aggregate contract
 *
 * Purpose:
 * - Return buyer vs non-buyer leading indicator aggregates for frontend.
 * - Keep raw order/payment/member/click/session identifiers out of responses.
 * - Provide an in-memory precompute skeleton that can be wired to VM Cloud later.
 */

import { createHash } from "node:crypto";

import type { AttributionLedgerEntry } from "./attribution";
import { resolveLedgerRevenueValue } from "./attribution";

export type LeadingIndicatorSite = "biocom" | "thecleancoffee";
export type LeadingIndicatorWindow = "1d" | "7d" | "14d" | "30d";
export type LeadingIndicatorChannel =
  | "meta"
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
  scroll90_rate_pct: number | null;
  begin_checkout_rate_pct: number | null;
  add_to_cart_rate_pct: number | null;
  coupon_event_rate_pct: number | null;
};

type LeadingIndicatorItem = {
  id: string;
  label: string;
  status: "candidate" | "watch" | "insufficient_data";
  buyer_value: number | null;
  non_buyer_value: number | null;
  delta: number | null;
  unit: "seconds" | "pct" | "count";
  interpretation_ko: string;
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
      ["meta", "youtube", "naver_paid_or_brand", "organic", "direct_or_unknown", "all"] as const,
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
  return (
    blob.includes("napm=") ||
    blob.includes("nclid=") ||
    blob.includes("brandsearch") ||
    blob.includes("powerlink") ||
    blob.includes("n_media=")
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

  return {
    sessions: sessions.length,
    confirmed_purchases: sessions.reduce((sum, session) => sum + session.confirmedPurchases, 0),
    confirmed_revenue_krw: Math.round(
      sessions.reduce((sum, session) => sum + session.confirmedRevenueKrw, 0),
    ),
    p50_dwell_seconds: median(dwell),
    scroll90_rate_pct: pct(scroll90, scrollKnown.length),
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

const indicatorStatus = (buyer: number | null, nonBuyer: number | null): LeadingIndicatorItem["status"] => {
  if (buyer === null || nonBuyer === null) return "insufficient_data";
  if (buyer > nonBuyer) return "candidate";
  return "watch";
};

const buildIndicators = (
  buyer: LeadingIndicatorMetrics,
  nonBuyer: LeadingIndicatorMetrics,
): LeadingIndicatorItem[] => [
  {
    id: "dwell_p50",
    label: "체류시간 중앙값",
    status: indicatorStatus(buyer.p50_dwell_seconds, nonBuyer.p50_dwell_seconds),
    buyer_value: buyer.p50_dwell_seconds,
    non_buyer_value: nonBuyer.p50_dwell_seconds,
    delta: delta(buyer.p50_dwell_seconds, nonBuyer.p50_dwell_seconds),
    unit: "seconds",
    interpretation_ko:
      "구매자가 더 오래 머무르면 상세페이지 설득 구간을 선행지표 후보로 볼 수 있습니다.",
  },
  {
    id: "scroll90_rate",
    label: "90% 이상 스크롤 비율",
    status: indicatorStatus(buyer.scroll90_rate_pct, nonBuyer.scroll90_rate_pct),
    buyer_value: buyer.scroll90_rate_pct,
    non_buyer_value: nonBuyer.scroll90_rate_pct,
    delta: delta(buyer.scroll90_rate_pct, nonBuyer.scroll90_rate_pct),
    unit: "pct",
    interpretation_ko:
      "구매자가 끝까지 읽는 비율이 높으면 콘텐츠 완독이 구매 예고 신호일 가능성이 있습니다.",
  },
  {
    id: "begin_checkout_rate",
    label: "주문서 진입 비율",
    status: indicatorStatus(buyer.begin_checkout_rate_pct, nonBuyer.begin_checkout_rate_pct),
    buyer_value: buyer.begin_checkout_rate_pct,
    non_buyer_value: nonBuyer.begin_checkout_rate_pct,
    delta: delta(buyer.begin_checkout_rate_pct, nonBuyer.begin_checkout_rate_pct),
    unit: "pct",
    interpretation_ko:
      "주문서 진입은 매출 직전 행동입니다. 이 비율이 낮으면 광고보다 랜딩/상품 선택 마찰을 먼저 봐야 합니다.",
  },
  {
    id: "add_to_cart_rate",
    label: "장바구니 신호 비율",
    status: indicatorStatus(buyer.add_to_cart_rate_pct, nonBuyer.add_to_cart_rate_pct),
    buyer_value: buyer.add_to_cart_rate_pct,
    non_buyer_value: nonBuyer.add_to_cart_rate_pct,
    delta: delta(buyer.add_to_cart_rate_pct, nonBuyer.add_to_cart_rate_pct),
    unit: "pct",
    interpretation_ko:
      "장바구니 페이지 진입 또는 AddToCart 이벤트가 구매자에게 더 많으면 상품 선택 의도가 강한 선행지표입니다.",
  },
];

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
    "GA4 BigQuery row-level dwell/scroll join은 P1 skeleton에서 아직 cross-check로만 표시하며, 매출 정본은 VM Cloud confirmed payment_success입니다.",
    "non_buyer는 GA4 purchase 충돌과 pending/unknown/canceled payment_success 흔적이 없는 순수 비결제자입니다. GA4 purchase가 보이지만 VM confirmed purchase가 없는 세션은 ga4_purchase_conflict로 분리합니다.",
    "ga4_purchase_conflict는 GA4 purchase가 매출 정본이라는 뜻이 아니라, session/window mismatch 또는 VM confirmed bridge 누락 가능성을 따로 점검하라는 보류 bucket입니다.",
    "pending_payment_success는 VM payment_success 흔적은 있으나 confirmed로 닫히지 않은 세션입니다. 실제 미결제, 취소, sync 지연, bridge 누락 가능성이 있어 순수 비결제자 평균에 섞지 않습니다.",
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

const PRECOMPUTE_TARGETS: Array<Omit<LeadingIndicatorQuery, "freshness">> = [
  { site: "biocom", window: "1d", channel: "meta", dimension: "buyer_vs_leaver" },
  { site: "biocom", window: "7d", channel: "meta", dimension: "buyer_vs_leaver" },
  { site: "biocom", window: "7d", channel: "meta", dimension: "landing_bucket" },
  { site: "biocom", window: "7d", channel: "all", dimension: "channel" },
  { site: "thecleancoffee", window: "1d", channel: "meta", dimension: "buyer_vs_leaver" },
  { site: "thecleancoffee", window: "7d", channel: "meta", dimension: "buyer_vs_leaver" },
  { site: "thecleancoffee", window: "7d", channel: "meta", dimension: "landing_bucket" },
  { site: "thecleancoffee", window: "7d", channel: "all", dimension: "channel" },
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
