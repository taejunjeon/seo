import express, { type Request, type Response } from "express";
import { createHash } from "crypto";
import { promises as fs } from "fs";
import path from "path";

import type {
  AttributionCaptureMode,
  AttributionLedgerEntry,
  AttributionPaymentStatus,
} from "../attribution";
import {
  getAttributionMetaMatchReasons,
  getAttributionTikTokMatchReasons,
  readLedgerEntries,
} from "../attribution";
import {
  getCrmDb,
  getExperimentActivityWindow,
  getExperimentResults,
  listExperiments,
  type CrmExperiment,
  type ExperimentActivityWindow,
  type VariantSummary,
} from "../crmLocalDb";
import { env } from "../env";
import {
  parseIsoDate,
  shiftIsoDateByDays,
  shiftIsoDateByMonths,
} from "../utils/isoDate";
import {
  applyAliasReviewDecision,
  loadAliasReviewItems,
  type AliasReviewDecision,
} from "../metaCampaignAliasReview";
import { isDatabaseConfigured, queryPg } from "../postgres";
import { categorizeProductName, normalizePhone } from "../consultation";
import { normalizeOrderIdBase } from "../orderKeys";
import { buildTikTokRoasComparison } from "../tiktokRoasComparison";
import { queryGA4PaidTrafficQuality, queryGA4SourceConversion } from "../ga4";

const META_GRAPH_URL = "https://graph.facebook.com/v22.0";
const DATA_DIR = path.resolve(__dirname, "..", "..", "data");
const KST_TIMEZONE = "Asia/Seoul";
const KST_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: KST_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const META_DEFAULT_ACTION_REPORT_TIME = "conversion";
const META_DEFAULT_ATTRIBUTION_WINDOWS = ["7d_click", "1d_view"] as const;
const META_DEFAULT_UNIFIED_ATTRIBUTION_SETTING = true;
const ADS_DEFAULT_DATE_PRESET = "last_7d";

// Lazy TTL cache (Option B 패턴) — 첫 호출은 15초 걸려도 5분 동안은 즉시 응답.
// Meta API 호출 횟수도 자연 감소 (rate limit 압박 ↓).
type AdsCacheEntry = { result: unknown; cachedAtMs: number; expiresAtMs: number };
const adsLazyCache = new Map<string, AdsCacheEntry>();
const ADS_LAZY_CACHE_TTL_MS = 5 * 60 * 1000; // 5분
const toKstShortAds = (ms: number): string => {
  const kst = new Date(ms + 9 * 60 * 60 * 1000);
  return `${kst.toISOString().slice(0, 10)} ${kst.toISOString().slice(11, 16)}`;
};
const getAdsLazyCached = (key: string): AdsCacheEntry | null => {
  const e = adsLazyCache.get(key);
  if (!e) return null;
  if (Date.now() > e.expiresAtMs) {
    adsLazyCache.delete(key);
    return null;
  }
  return e;
};
/**
 * stale-while-revalidate — expire 후에도 staleMaxAgeMs 안에 있으면 반환.
 * Meta API 일시 실패 시 옛 데이터라도 보여줘 사용자 화면 안정.
 */
const ADS_LAZY_STALE_MAX_AGE_MS = 30 * 60 * 1000;
const getAdsLazyCachedStale = (key: string): AdsCacheEntry | null => {
  const e = adsLazyCache.get(key);
  if (!e) return null;
  if (Date.now() - e.cachedAtMs > ADS_LAZY_STALE_MAX_AGE_MS) {
    adsLazyCache.delete(key);
    return null;
  }
  return e;
};
const setAdsLazyCached = (key: string, result: unknown): AdsCacheEntry => {
  const entry: AdsCacheEntry = {
    result,
    cachedAtMs: Date.now(),
    expiresAtMs: Date.now() + ADS_LAZY_CACHE_TTL_MS,
  };
  adsLazyCache.set(key, entry);
  return entry;
};
const buildAdsCacheMeta = (entry: AdsCacheEntry | null, source: "lazy_cache_hit" | "live_force" | "live_cache_miss"): {
  cached: boolean;
  cached_at_kst: string | null;
  next_refresh_at_kst: string | null;
  ttl_seconds: number;
  source: string;
} => ({
  cached: source === "lazy_cache_hit",
  cached_at_kst: entry ? toKstShortAds(entry.cachedAtMs) : null,
  next_refresh_at_kst: entry ? toKstShortAds(entry.expiresAtMs) : null,
  ttl_seconds: Math.round(ADS_LAZY_CACHE_TTL_MS / 1000),
  source,
});
const VALID_META_ATTRIBUTION_WINDOWS = ["1d_click", "7d_click", "28d_click", "1d_view"] as const;
const ROAS_SUMMARY_CACHE_FRESH_MS = 4 * 60 * 60 * 1000;
const ROAS_SUMMARY_CACHE_STALE_MAX_MS = 8 * 60 * 60 * 1000;
const ROAS_SUMMARY_FORCE_COOLDOWN_MS = 5 * 60 * 1000;
const ROAS_SUMMARY_DEFAULT_INTERVAL_MS = 4 * 60 * 60 * 1000;

export type SiteKey = "biocom" | "thecleancoffee" | "aibio";
type AdsChannel = "meta" | "google" | "daangn";
type MetaAttributionWindow = typeof VALID_META_ATTRIBUTION_WINDOWS[number];
type AdsLedgerSourceRequest = "auto" | "local" | "operational_vm";
type AdsLedgerSourceUsed = "local" | "operational_vm";
type AdsSourceConfidence = "A" | "B" | "C" | "D";

type DateRange = {
  startDate: string;
  endDate: string;
};

type LedgerFreshness = {
  entries: number;
  orders: number;
  latestLoggedAt: string | null;
  latestApprovedDate: string | null;
};

type AdsResponseMetaParams = {
  range?: DateRange;
  datePreset?: string | null;
  accountId?: string | null;
  site?: SiteKey | null;
  attributionWindow?: MetaAttributionWindow | null;
  metaLevel?: string | null;
  metaFields?: string | null;
};

type MetaInsightAction = {
  action_type: string;
  value: string;
} & Partial<Record<MetaAttributionWindow, string>>;

type MetaInsightRow = {
  campaign_name: string;
  campaign_id: string;
  impressions: string;
  clicks: string;
  spend: string;
  cpc?: string;
  cpm?: string;
  ctr?: string;
  date_start: string;
  date_stop: string;
  actions?: MetaInsightAction[];
  action_values?: MetaInsightAction[];
};

type MetaFetchResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

type RoasSummaryBody = Record<string, unknown> & {
  batch?: Record<string, unknown>;
};

type RoasSummaryCacheSource =
  | "in_memory_precompute"
  | "live_cache_miss"
  | "live_force_refresh"
  | "live_error_no_cache"
  | "force_cooldown_cache"
  | "refresh_in_flight_cache"
  | "stale_fallback";

type RoasSummaryCacheEntry = {
  body: RoasSummaryBody;
  computedAtMs: number;
  generationMs: number;
  nextRefreshAtMs: number;
};

type RoasSummaryCacheMeta = {
  cached: boolean;
  cached_at_kst: string | null;
  next_refresh_at_kst: string | null;
  generation_ms: number | null;
  staleness_ms: number | null;
  source: RoasSummaryCacheSource;
  stale: boolean;
  force_cooldown_remaining_ms: number;
  refresh_in_flight: boolean;
  cache_key: string;
  error_from_refresh?: string;
};

const roasSummaryCache = new Map<string, RoasSummaryCacheEntry>();
const roasSummaryRefreshInFlight = new Set<string>();

type MetaReference = {
  mode: "ads_manager_parity" | "custom_window_override";
  actionReportTime: string;
  useUnifiedAttributionSetting: boolean;
  requestedAttributionWindow: string | null;
  appliedAttributionWindows: string[] | null;
  actionValueField: string;
  purchaseRoasField: string;
  websitePurchaseRoasField: string;
  numeratorDefinition: string;
  comparisonGuidance: string;
};

type MetaCampaignAggregate = {
  campaignId: string;
  campaignName: string;
  impressions: number;
  clicks: number;
  spend: number;
};

type MetaTotals = {
  impressions: number;
  clicks: number;
  spend: number;
  cpc: number;
  cpm: number;
  landingPageViews: number;
  leads: number;
  purchases: number;
  purchaseValue: number;
};

type SiteMetaSummary = MetaTotals & {
  site: SiteKey;
  accountId: string;
  metaError: string | null;
};

export type NormalizedLedgerOrder = {
  key: string;
  orderId: string;
  paymentKey: string;
  approvedDate: string | null;
  amount: number | null;
  site: SiteKey | null;
  customerKey: string;
  utmSource: string;
  utmCampaign: string;
  utmTerm: string;
  utmContent: string;
  fbclid: string;
  gclid: string;
  ttclid: string;
  campaignIdHint: string;
  adsetIdHint: string;
  adIdHint: string;
  captureMode: AttributionCaptureMode;
  paymentStatus: AttributionPaymentStatus;
  status: string;
  completed: boolean;
  businessConfirmed: boolean;
  businessConfirmedDate: string | null;
  businessConfirmedAmount: number | null;
  entryCount: number;
};

export type CampaignRoasRow = {
  campaignId: string | null;
  campaignName: string;
  spend: number;
  attributedRevenue: number;
  roas: number | null;
  orders: number;
  // 2026-04-20: 공동구매 전용 Meta 캠페인 분리 (§ H/I 참조).
  // 기준: 캠페인 이름에 "공동구매" 또는 "공구" 포함.
  // 공동구매는 일반 Meta 광고와 별도 버킷으로 분리해 평가한다 (할인가 기준 매출이므로 일반 ROAS와 직접 비교 금지).
  campaignType: "general" | "coop";
};

// 캠페인 이름으로 공동구매 Meta 캠페인 식별. 실측 확인된 단순 키워드 규칙.
// v1 기준 1번. 현재 /ads 라이브에 적용.
export const isCoopCampaignByName = (name: string | null | undefined): boolean => {
  const n = String(name ?? "");
  return n.includes("공동구매") || n.includes("공구");
};

// 2026-04-21 v1 확장: 주문 단위 공동구매 식별 helper.
// Meta 캠페인 레벨에서는 캠페인명 키워드만으로 판정하지만(isCoopCampaignByName),
// 실제 주문은 UTM/landing/상품명에 흔적이 남는 경우가 있다. 이 helper는 attribution_ledger
// 주문 또는 imweb_order_items 라인을 받아 coop_campaigns.biocom.json 마스터와 매칭한다.
// 현재 /ads 라우트에서는 아직 사용하지 않는다. v2에서 주문 분리 카드를 추가할 때 사용한다.
export type CoopCampaignMasterRecord = {
  campaign_id: string;
  partner: string;
  round: number | null;
  product_families: string[];
  start_date: string | null;
  end_date: string | null;
  coupon_codes: string[];
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  landing_path_pattern: string | null;
  order_no_allowlist: string[];
  revenue_source: string | null;
  classification_basis: string | null;
  classification_confidence: number | null;
  notes: string | null;
};

type CoopMasterCache = {
  records: CoopCampaignMasterRecord[];
  loadedAt: number;
};
const coopMasterCache: Map<SiteKey, CoopMasterCache> = new Map();
const COOP_MASTER_TTL_MS = 60_000;

export const loadCoopCampaignsMaster = async (
  site: SiteKey,
): Promise<CoopCampaignMasterRecord[]> => {
  const cached = coopMasterCache.get(site);
  if (cached && Date.now() - cached.loadedAt < COOP_MASTER_TTL_MS) {
    return cached.records;
  }
  const filePath = path.resolve(process.cwd(), "..", "data", `coop_campaigns.${site}.json`);
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as { campaigns?: CoopCampaignMasterRecord[] };
    const records = Array.isArray(parsed?.campaigns) ? parsed.campaigns : [];
    coopMasterCache.set(site, { records, loadedAt: Date.now() });
    return records;
  } catch {
    coopMasterCache.set(site, { records: [], loadedAt: Date.now() });
    return [];
  }
};

export type CoopOrderSignals = {
  orderNo?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  landing?: string | null;
  itemNames?: string[];
  orderTime?: string | null;
};

export type CoopOrderMatch = {
  isCoop: boolean;
  campaignId: string | null;
  basis:
    | "allowlist"
    | "utm_campaign"
    | "utm_source"
    | "landing"
    | "product_family"
    | "product_name_pattern"
    | null;
  confidence: number;
};

// v1 기준 2~4번 대응. 신호 우선순위 전수 스캔: allowlist > coupon > utm > landing > product_family > pattern.
// `classification_basis='time+product_candidate'` 또는 `'allowlist_pending'` 레코드는 product_family 매칭에서 제외(false match 방지).
export const classifyCoopOrder = (
  signals: CoopOrderSignals,
  master: CoopCampaignMasterRecord[],
): CoopOrderMatch => {
  const orderNo = signals.orderNo ?? "";
  const utmSource = (signals.utmSource ?? "").toLowerCase();
  const utmCampaign = (signals.utmCampaign ?? "").toLowerCase();
  const landing = signals.landing ?? "";
  const itemNames = signals.itemNames ?? [];

  // Phase 1: allowlist 전수 스캔 (가장 강한 신호)
  if (orderNo) {
    for (const rec of master) {
      if (rec.order_no_allowlist?.includes(orderNo)) {
        return { isCoop: true, campaignId: rec.campaign_id, basis: "allowlist", confidence: 1.0 };
      }
    }
  }
  // Phase 2: utm_campaign 전수 스캔
  if (utmCampaign) {
    for (const rec of master) {
      if (rec.utm_campaign && utmCampaign === rec.utm_campaign.toLowerCase()) {
        return { isCoop: true, campaignId: rec.campaign_id, basis: "utm_campaign", confidence: 0.9 };
      }
    }
  }
  // Phase 3: utm_source 전수 스캔
  if (utmSource) {
    for (const rec of master) {
      if (rec.utm_source && utmSource === rec.utm_source.toLowerCase()) {
        return { isCoop: true, campaignId: rec.campaign_id, basis: "utm_source", confidence: 0.85 };
      }
    }
  }
  // Phase 4: landing_path 전수 스캔
  if (landing) {
    for (const rec of master) {
      if (rec.landing_path_pattern && landing.includes(rec.landing_path_pattern)) {
        return { isCoop: true, campaignId: rec.campaign_id, basis: "landing", confidence: 0.85 };
      }
    }
  }
  // Phase 5: product_family 매칭 (time+product_candidate / allowlist_pending 마스터 제외)
  if (itemNames.length) {
    for (const rec of master) {
      if (rec.classification_basis === "time+product_candidate" || rec.classification_basis === "allowlist_pending") {
        continue;
      }
      if (!rec.product_families?.length) continue;
      const match = itemNames.find((n) => rec.product_families.some((p) => n.includes(p)));
      if (match) {
        return {
          isCoop: true,
          campaignId: rec.campaign_id,
          basis: "product_family",
          confidence: 0.6,
        };
      }
    }
  }
  // Phase 6: 공구 마스터에 없어도 상품명에 [공구]/[파트너명] 접두사가 있으면 coop 후보로 본다
  // 공동구매내역 SQL 넓은 기준과 일치: `[` 시작 + 정기구독/비밀링크/KOLAS 제외
  const EXCLUDED_PREFIXES = /^\[(정기구독|비밀링크|KOLAS|공지|안내)/;
  const hasBracketPartner = itemNames.some((n) => {
    if (EXCLUDED_PREFIXES.test(n)) return false;
    return /^\[/.test(n);
  });
  if (hasBracketPartner) {
    return {
      isCoop: true,
      campaignId: null,
      basis: "product_name_pattern",
      confidence: 0.5,
    };
  }
  return { isCoop: false, campaignId: null, basis: null, confidence: 0 };
};

export type CampaignLtvRoasRow = CampaignRoasRow & {
  ltvRevenue: number;
  repeatRevenue: number;
  supplementRevenue: number;
  ltvRoas: number | null;
  matchedCustomers: number;
  consultedCustomers: number;
  supplementCustomers: number;
  identityMatchedOrders: number;
  ltvStatus: "ready" | "low_sample" | "identity_missing" | "no_attribution" | "blocked";
  ltvBlocker: string | null;
};

export type DailyRoasRow = {
  date: string;
  spend: number;
  revenue: number;
  roas: number | null;
  confirmedRevenue: number;
  pendingRevenue: number;
  potentialRevenue: number;
  metaPurchaseValue: number;
  confirmedRoas: number | null;
  officialRoas: number | null;
  fastSignalRoas: number | null;
  roasGap: number | null;
  potentialRoas: number | null;
  metaPurchaseRoas: number | null;
};

export type SiteRoasSummary = {
  site: SiteKey;
  account_id: string;
  impressions: number;
  clicks: number;
  spend: number;
  cpc: number;
  cpm: number;
  landing_page_views: number;
  leads: number;
  purchases: number;
  purchase_value: number;
  revenue: number;
  roas: number | null;
  orders: number;
  confirmedRevenue: number;
  confirmedOrders: number;
  pendingRevenue: number;
  pendingOrders: number;
  potentialRevenue: number;
  confirmedRoas: number | null;
  officialRoas: number | null;
  fastSignalRoas: number | null;
  roasGap: number | null;
  potentialRoas: number | null;
  metaPurchaseValue: number;
  metaPurchaseRoas: number | null;
  siteConfirmedRevenue: number;
  siteConfirmedOrders: number;
  bestCaseCeilingRoas: number | null;
  metaError: string | null;
};

export type ChannelComparisonRow = {
  channel: AdsChannel;
  spend: number;
  impressions: number;
  clicks: number;
  revenue: number;
  roas: number | null;
  placeholder: boolean;
  dataSource: string;
};

const SITE_ACCOUNTS: Array<{ site: SiteKey; accountId: string; hosts: string[] }> = [
  {
    site: "biocom",
    accountId: "act_3138805896402376",
    hosts: ["biocom.kr", "www.biocom.kr", "biocom.imweb.me"],
  },
  {
    site: "thecleancoffee",
    accountId: "act_654671961007474",
    hosts: ["thecleancoffee.com", "www.thecleancoffee.com", "thecleancoffee.imweb.me"],
  },
  {
    site: "aibio",
    accountId: "act_377604674894011",
    hosts: ["aibio.ai", "www.aibio.ai", "aibio.imweb.me"],
  },
];

const findSiteAccountByAccountId = (accountId: string) =>
  SITE_ACCOUNTS.find((site) => site.accountId === accountId.trim()) ?? null;

const filterOrdersForAccount = (
  orders: NormalizedLedgerOrder[],
  accountId: string,
): NormalizedLedgerOrder[] => {
  const siteAccount = findSiteAccountByAccountId(accountId);
  if (!siteAccount) return orders;
  return orders.filter((order) => order.site === siteAccount.site);
};

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

const round2 = (value: number) => Number(value.toFixed(2));

const toNumber = (value: unknown) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const toPositiveNumber = (value: unknown): number | null => {
  const parsed = toNumber(value);
  return parsed > 0 ? parsed : null;
};

const toObject = (value: unknown): Record<string, unknown> => (
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
);

const firstNonEmpty = (values: string[]) => values.find((value) => value.trim()) ?? "";

const firstMetadataString = (metadata: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
};

const extractUrlParam = (value: string, key: string) => {
  if (!value.trim()) return "";
  try {
    const parsed = new URL(value);
    return parsed.searchParams.get(key)?.trim() ?? "";
  } catch {
    const match = value.match(new RegExp(`[?&]${key}=([^&#\\s]+)`));
    return match?.[1] ? decodeURIComponent(match[1]).trim() : "";
  }
};

const extractFirstUrlParam = (values: string[], key: string) =>
  firstNonEmpty(values.map((value) => extractUrlParam(value, key)));

const normalizeMetaNumericId = (value: string) => {
  const raw = value.trim();
  return /^\d{8,}$/.test(raw) ? raw : "";
};

const extractFirstNumericUrlParam = (values: string[], keys: string[]) => {
  for (const key of keys) {
    const value = firstNonEmpty(values.map((candidate) => (
      normalizeMetaNumericId(extractUrlParam(candidate, key))
    )));
    if (value) return value;
  }
  return "";
};

const getKstToday = () => KST_DATE_FORMATTER.format(new Date());

const firstDayOfMonth = (date: string) => `${date.slice(0, 7)}-01`;

const lastDayOfMonth = (date: string) =>
  shiftIsoDateByDays(shiftIsoDateByMonths(firstDayOfMonth(date), 1), -1);

export const resolveDatePresetRange = (
  datePreset: string,
  today: string = getKstToday(),
): DateRange | null => {
  // Meta's rolling date_preset windows such as last_7d use completed days ending yesterday.
  const lastCompletedDate = shiftIsoDateByDays(today, -1);
  switch (datePreset) {
    case "today":
      return { startDate: today, endDate: today };
    case "yesterday": {
      return { startDate: lastCompletedDate, endDate: lastCompletedDate };
    }
    case "last_7d":
      return { startDate: shiftIsoDateByDays(lastCompletedDate, -6), endDate: lastCompletedDate };
    case "last_14d":
      return { startDate: shiftIsoDateByDays(lastCompletedDate, -13), endDate: lastCompletedDate };
    case "last_30d":
      return { startDate: shiftIsoDateByDays(lastCompletedDate, -29), endDate: lastCompletedDate };
    case "last_90d":
      return { startDate: shiftIsoDateByDays(lastCompletedDate, -89), endDate: lastCompletedDate };
    case "this_month":
      return { startDate: firstDayOfMonth(today), endDate: today };
    case "last_month": {
      const previousMonthAnchor = shiftIsoDateByMonths(today, -1);
      return {
        startDate: firstDayOfMonth(previousMonthAnchor),
        endDate: lastDayOfMonth(previousMonthAnchor),
      };
    }
    default:
      return null;
  }
};

const parseIsoDateParam = (value: unknown, label: string) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    throw new Error(`${label} 형식은 YYYY-MM-DD 이어야 함`);
  }
  parseIsoDate(value.trim());
  return value.trim();
};

const ensureValidDateRange = (startDate: string, endDate: string): DateRange => {
  if (startDate > endDate) {
    throw new Error("start_date 는 end_date 보다 늦을 수 없음");
  }
  return { startDate, endDate };
};

const resolveExplicitRange = (req: Request) => ensureValidDateRange(
  parseIsoDateParam(req.query.start_date, "start_date"),
  parseIsoDateParam(req.query.end_date, "end_date"),
);

const resolveOptionalRange = (req: Request): { range: DateRange; datePreset: string | null } => {
  const hasExplicitRange = typeof req.query.start_date === "string" || typeof req.query.end_date === "string";
  if (hasExplicitRange) {
    return { range: resolveExplicitRange(req), datePreset: null };
  }

  const requestedDatePreset = typeof req.query.date_preset === "string"
    ? req.query.date_preset.trim()
    : ADS_DEFAULT_DATE_PRESET;
  const range = resolveDatePresetRange(requestedDatePreset);
  if (!range) {
    throw new Error(`지원하지 않는 date_preset: ${requestedDatePreset}`);
  }
  return { range, datePreset: requestedDatePreset };
};

const parseMetaAttributionWindow = (value: unknown): MetaAttributionWindow | null => {
  if (typeof value !== "string" || !value.trim()) return null;
  const requested = value.trim();
  if (!VALID_META_ATTRIBUTION_WINDOWS.includes(requested as MetaAttributionWindow)) {
    throw new Error(`지원하지 않는 attribution_window: ${requested}`);
  }
  return requested as MetaAttributionWindow;
};

const parseAdsLedgerSource = (value: unknown): AdsLedgerSourceRequest => {
  if (typeof value !== "string" || !value.trim()) return "auto";
  const requested = value.trim();
  if (requested === "auto" || requested === "local" || requested === "operational_vm") {
    return requested;
  }
  throw new Error(`지원하지 않는 ledger_source: ${requested}`);
};

const parsePositiveMsEnv = (key: string, fallback: number, min: number = 0) => {
  const raw = process.env[key];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= min ? parsed : fallback;
};

const getRoasSummaryCacheConfig = () => ({
  freshMs: parsePositiveMsEnv("ROAS_SUMMARY_CACHE_FRESH_MS", ROAS_SUMMARY_CACHE_FRESH_MS, 60_000),
  staleMaxMs: parsePositiveMsEnv("ROAS_SUMMARY_STALE_MAX_AGE_MS", ROAS_SUMMARY_CACHE_STALE_MAX_MS, 60_000),
  forceCooldownMs: parsePositiveMsEnv("ROAS_SUMMARY_FORCE_COOLDOWN_MS", ROAS_SUMMARY_FORCE_COOLDOWN_MS, 0),
  intervalMs: parsePositiveMsEnv("ROAS_SUMMARY_PRECOMPUTE_INTERVAL_MS", ROAS_SUMMARY_DEFAULT_INTERVAL_MS, 60_000),
});

const toKstMinute = (value: Date): string => {
  const kst = new Date(value.getTime() + 9 * 60 * 60 * 1000);
  return `${kst.toISOString().slice(0, 10)} ${kst.toISOString().slice(11, 16)}`;
};

const normalizeRoasSummaryPresets = (presets: string[]) => (
  [...new Set(presets.map((preset) => preset.trim()).filter(Boolean))]
    .sort()
    .join(",")
);

const buildRoasSummaryCacheKey = (params: {
  accountId: string;
  presets: string[];
  ledgerSource: AdsLedgerSourceRequest;
}) => [
  "roas_summary",
  params.accountId.trim(),
  normalizeRoasSummaryPresets(params.presets),
  params.ledgerSource,
].join(":");

const buildRoasSummaryCacheMeta = (params: {
  cacheKey: string;
  entry: RoasSummaryCacheEntry | null;
  source: RoasSummaryCacheSource;
  stale?: boolean;
  refreshInFlight?: boolean;
  forceCooldownRemainingMs?: number;
  errorFromRefresh?: string;
}): RoasSummaryCacheMeta => {
  const now = Date.now();
  return {
    cached: Boolean(params.entry),
    cached_at_kst: params.entry ? toKstMinute(new Date(params.entry.computedAtMs)) : null,
    next_refresh_at_kst: params.entry ? toKstMinute(new Date(params.entry.nextRefreshAtMs)) : null,
    generation_ms: params.entry?.generationMs ?? null,
    staleness_ms: params.entry ? now - params.entry.computedAtMs : null,
    source: params.source,
    stale: Boolean(params.stale),
    force_cooldown_remaining_ms: Math.max(0, Math.round(params.forceCooldownRemainingMs ?? 0)),
    refresh_in_flight: Boolean(params.refreshInFlight),
    cache_key: params.cacheKey,
    ...(params.errorFromRefresh ? { error_from_refresh: params.errorFromRefresh } : {}),
  };
};

const cloneRoasSummaryBodyWithCache = (params: {
  cacheKey: string;
  entry: RoasSummaryCacheEntry;
  source: RoasSummaryCacheSource;
  stale?: boolean;
  refreshInFlight?: boolean;
  forceCooldownRemainingMs?: number;
  errorFromRefresh?: string;
}): RoasSummaryBody => {
  const batch = params.entry.body.batch && typeof params.entry.body.batch === "object"
    ? { ...params.entry.body.batch }
    : {};
  return {
    ...params.entry.body,
    served_at: new Date().toISOString(),
    cache: buildRoasSummaryCacheMeta({
      cacheKey: params.cacheKey,
      entry: params.entry,
      source: params.source,
      stale: params.stale,
      refreshInFlight: params.refreshInFlight,
      forceCooldownRemainingMs: params.forceCooldownRemainingMs,
      errorFromRefresh: params.errorFromRefresh,
    }),
    batch: {
      ...batch,
      source: params.source,
      request_ledger_fetch_count: 0,
      generated_ledger_fetch_count: batch.ledger_fetch_count ?? null,
      cache_hit: true,
    },
  };
};

const normalizeDateLike = (value: string): string | null => {
  const raw = value.trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return KST_DATE_FORMATTER.format(parsed);
};

const resolveHost = (value: string): string => {
  const raw = value.trim();
  if (!raw) return "";

  try {
    return new URL(raw).host.toLowerCase();
  } catch {
    const match = raw.match(/([a-z0-9-]+\.)+[a-z]{2,}/i);
    return match ? match[0].toLowerCase() : "";
  }
};

const getMetaToken = (accountId?: string) => {
  if (accountId === "act_654671961007474") {
    return (
      env.COFFEE_META_TOKEN
      ?? env.META_ADMANAGER_API_KEY_COFFEE
      ?? env.META_ADMANAGER_API_KEY
      ?? ""
    );
  }
  return env.META_ADMANAGER_API_KEY ?? "";
};

const fetchMeta = async <T>(
  path: string,
  params: Record<string, string> = {},
): Promise<MetaFetchResult<T>> => {
  const accountId = path.match(/^\/(act_\d+)/)?.[1];
  const token = getMetaToken(accountId);
  if (!token) return { ok: false, error: "META_ADMANAGER_API_KEY 미설정" };

  const url = new URL(`${META_GRAPH_URL}${path}`);
  url.searchParams.set("access_token", token);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url.toString(), { signal: AbortSignal.timeout(15_000) });
  const body = await response.json() as Record<string, unknown>;

  if (body.error) {
    const error = body.error as { message?: string };
    return { ok: false, error: error.message ?? "Meta API error" };
  }

  return { ok: true, data: body as T };
};

const fetchMetaInsights = async (params: {
  accountId: string;
  fields: string;
  level?: string;
  timeIncrement?: string;
  datePreset?: string;
  range?: DateRange;
  limit?: string;
  actionReportTime?: string;
  useUnifiedAttributionSetting?: boolean;
  actionAttributionWindows?: string[];
}): Promise<MetaFetchResult<MetaInsightRow[]>> => {
  const query: Record<string, string> = {
    fields: params.fields,
    limit: params.limit ?? "100",
  };

  if (params.level) query.level = params.level;
  if (params.timeIncrement) query.time_increment = params.timeIncrement;
  if (params.actionReportTime) query.action_report_time = params.actionReportTime;
  if (params.useUnifiedAttributionSetting) {
    query.use_unified_attribution_setting = "true";
  }
  if (params.actionAttributionWindows?.length) {
    query.action_attribution_windows = JSON.stringify(params.actionAttributionWindows);
  }
  if (params.range) {
    query.time_range = JSON.stringify({
      since: params.range.startDate,
      until: params.range.endDate,
    });
  } else if (params.datePreset) {
    query.date_preset = params.datePreset;
  }

  const result = await fetchMeta<{ data: MetaInsightRow[] }>(
    `/${params.accountId}/insights`,
    query,
  );

  if (!result.ok) return result;
  return { ok: true, data: result.data.data ?? [] };
};

type LocalAliasAuditFile = {
  campaigns?: Array<{
    campaignId?: string;
    campaignName?: string;
    adsets?: Array<{
      adsetId?: string;
      adsetName?: string;
      ads?: Array<{
        adId?: string;
        adName?: string;
      }>;
    }>;
  }>;
};

const loadLocalAuditAdsetCampaignMap = async (
  site: SiteKey | null,
): Promise<AdsetCampaignMap> => {
  const map: AdsetCampaignMap = new Map();
  if (!site) return map;

  try {
    const raw = await fs.readFile(path.resolve(DATA_DIR, `meta_campaign_alias_audit.${site}.json`), "utf8");
    const audit = JSON.parse(raw) as LocalAliasAuditFile;
    for (const campaign of audit.campaigns ?? []) {
      const campaignId = campaign.campaignId?.trim() ?? "";
      if (!campaignId) continue;
      for (const adset of campaign.adsets ?? []) {
        const adsetId = adset.adsetId?.trim() ?? "";
        if (!adsetId) continue;
        map.set(adsetId, {
          campaignId,
          campaignName: campaign.campaignName?.trim() ?? "",
          adsetName: adset.adsetName?.trim() ?? "",
        });
      }
    }
  } catch {
    return map;
  }

  return map;
};

const loadLocalAuditAdCampaignMap = async (
  site: SiteKey | null,
): Promise<AdCampaignMap> => {
  const map: AdCampaignMap = new Map();
  if (!site) return map;

  try {
    const raw = await fs.readFile(path.resolve(DATA_DIR, `meta_campaign_alias_audit.${site}.json`), "utf8");
    const audit = JSON.parse(raw) as LocalAliasAuditFile;
    for (const campaign of audit.campaigns ?? []) {
      const campaignId = campaign.campaignId?.trim() ?? "";
      if (!campaignId) continue;
      for (const adset of campaign.adsets ?? []) {
        for (const ad of adset.ads ?? []) {
          const adId = ad.adId?.trim() ?? "";
          if (!adId) continue;
          map.set(adId, {
            campaignId,
            campaignName: campaign.campaignName?.trim() ?? "",
            adsetName: adset.adsetName?.trim() ?? "",
            adName: ad.adName?.trim() ?? "",
          });
        }
      }
    }
  } catch {
    return map;
  }

  return map;
};

const fetchMetaAdsetCampaignMap = async (
  accountId: string,
): Promise<{ map: AdsetCampaignMap; error: string | null }> => {
  let result: MetaFetchResult<{
    data: Array<{
      id: string;
      name?: string;
      campaign_id?: string;
      campaign?: { id?: string; name?: string };
    }>;
  }>;
  try {
    result = await fetchMeta<{
      data: Array<{
        id: string;
        name?: string;
        campaign_id?: string;
        campaign?: { id?: string; name?: string };
      }>;
    }>(
      `/${accountId}/adsets`,
      { fields: "id,name,campaign_id,campaign{id,name}", limit: "500" },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const siteAccount = findSiteAccountByAccountId(accountId);
    const fallbackMap = await loadLocalAuditAdsetCampaignMap(siteAccount?.site ?? null);
    return {
      map: fallbackMap,
      error: fallbackMap.size > 0
        ? `${message}; local alias audit fallback adsets=${fallbackMap.size}`
        : message,
    };
  }

  if (!result.ok) {
    const siteAccount = findSiteAccountByAccountId(accountId);
    const fallbackMap = await loadLocalAuditAdsetCampaignMap(siteAccount?.site ?? null);
    return {
      map: fallbackMap,
      error: fallbackMap.size > 0
        ? `${result.error}; local alias audit fallback adsets=${fallbackMap.size}`
        : result.error,
    };
  }

  const map: AdsetCampaignMap = new Map();
  for (const adset of result.data.data ?? []) {
    const campaignId = adset.campaign_id ?? adset.campaign?.id ?? "";
    if (!adset.id || !campaignId) continue;
    map.set(adset.id, {
      campaignId,
      campaignName: adset.campaign?.name ?? "",
      adsetName: adset.name ?? "",
    });
  }
  return { map, error: null };
};

type MetaAdCreativeEvidenceRow = {
  id: string;
  name?: string;
  adset_id?: string;
  campaign_id?: string;
  campaign?: { id?: string; name?: string };
  adset?: { id?: string; name?: string };
  creative?: unknown;
};

type MetaPagedResponse<T> = {
  data?: T[];
  paging?: { next?: string };
};

const fetchMetaPaged = async <T>(
  path: string,
  params: Record<string, string>,
  maxRows = 2000,
): Promise<MetaFetchResult<T[]>> => {
  const accountId = path.match(/^\/(act_\d+)/)?.[1];
  const token = getMetaToken(accountId);
  if (!token) return { ok: false, error: "META_ADMANAGER_API_KEY 미설정" };

  const firstUrl = new URL(`${META_GRAPH_URL}${path}`);
  firstUrl.searchParams.set("access_token", token);
  for (const [key, value] of Object.entries(params)) {
    firstUrl.searchParams.set(key, value);
  }

  const rows: T[] = [];
  let nextUrl: string | null = firstUrl.toString();
  while (nextUrl && rows.length < maxRows) {
    const response = await fetch(nextUrl, { signal: AbortSignal.timeout(15_000) });
    const body = await response.json() as MetaPagedResponse<T> & { error?: { message?: string } };
    if (body.error) {
      return { ok: false, error: body.error.message ?? "Meta API error" };
    }
    rows.push(...(body.data ?? []));
    nextUrl = body.paging?.next ?? null;
  }

  return { ok: true, data: rows.slice(0, maxRows) };
};

const collectStringValuesDeep = (value: unknown, output: string[] = []): string[] => {
  if (typeof value === "string") {
    output.push(value);
    return output;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStringValuesDeep(item, output);
    return output;
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value as Record<string, unknown>)) {
      collectStringValuesDeep(item, output);
    }
  }
  return output;
};

const extractMetaAliasKeysFromCreative = (creative: unknown) => {
  const aliases = new Set<string>();
  for (const value of collectStringValuesDeep(creative)) {
    const candidates = [
      extractUrlParam(value, "campaign_alias"),
      extractUrlParam(value, "utm_campaign"),
    ];
    for (const candidate of candidates) {
      const normalized = candidate.trim();
      if (!normalized || normalizeMetaNumericId(normalized)) continue;
      if (!normalized.toLowerCase().includes("meta")) continue;
      aliases.add(normalizeCampaignKey(normalized));
    }
  }
  return [...aliases].filter(Boolean);
};

const fetchMetaAdCreativeEvidenceMaps = async (
  accountId: string,
): Promise<{ adMap: AdCampaignMap; aliasMap: CampaignAliasMap; error: string | null }> => {
  const siteAccount = findSiteAccountByAccountId(accountId);
  const localAdMap = await loadLocalAuditAdCampaignMap(siteAccount?.site ?? null);
  let result: MetaFetchResult<MetaAdCreativeEvidenceRow[]>;
  try {
    result = await fetchMetaPaged<MetaAdCreativeEvidenceRow>(
      `/${accountId}/ads`,
      {
        fields: "id,name,adset_id,campaign_id,campaign{id,name},adset{id,name},creative{id,name,url_tags}",
        limit: "200",
      },
      1000,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      adMap: localAdMap,
      aliasMap: new Map(),
      error: localAdMap.size > 0
        ? `${message}; local alias audit fallback ads=${localAdMap.size}`
        : message,
    };
  }

  if (!result.ok) {
    return {
      adMap: localAdMap,
      aliasMap: new Map(),
      error: localAdMap.size > 0
        ? `${result.error}; local alias audit fallback ads=${localAdMap.size}`
        : result.error,
    };
  }

  const adMap: AdCampaignMap = new Map(localAdMap);
  const aliasBuckets = new Map<string, CampaignAliasMatch[]>();
  for (const ad of result.data) {
    const campaignId = ad.campaign_id ?? ad.campaign?.id ?? "";
    if (!ad.id || !campaignId) continue;
    const campaignName = ad.campaign?.name ?? "";
    adMap.set(ad.id, {
      campaignId,
      campaignName,
      adsetName: ad.adset?.name ?? "",
      adName: ad.name ?? "",
    });

    for (const aliasKey of extractMetaAliasKeysFromCreative(ad.creative)) {
      const bucket = aliasBuckets.get(aliasKey) ?? [];
      bucket.push({
        campaignId,
        campaignName,
        validFrom: null,
        validTo: null,
        confidence: "live_creative_url",
      });
      aliasBuckets.set(aliasKey, bucket);
    }
  }

  const aliasMap: CampaignAliasMap = new Map();
  for (const [aliasKey, matches] of aliasBuckets) {
    const uniqueCampaignIds = new Set(matches.map((match) => match.campaignId));
    if (uniqueCampaignIds.size !== 1) continue;
    const match = matches[0];
    if (match) aliasMap.set(aliasKey, [match]);
  }

  return { adMap, aliasMap, error: null };
};

const buildMetaReference = (params?: {
  mode?: MetaReference["mode"];
  requestedAttributionWindow?: string | null;
  appliedAttributionWindows?: string[] | null;
}): MetaReference => {
  const mode = params?.mode ?? "ads_manager_parity";
  return {
    mode,
    actionReportTime: META_DEFAULT_ACTION_REPORT_TIME,
    useUnifiedAttributionSetting: mode === "ads_manager_parity"
      ? META_DEFAULT_UNIFIED_ATTRIBUTION_SETTING
      : false,
    requestedAttributionWindow: params?.requestedAttributionWindow ?? null,
    appliedAttributionWindows: params?.appliedAttributionWindows ?? null,
    actionValueField: "action_values[purchase]",
    purchaseRoasField: "purchase_roas",
    websitePurchaseRoasField: "website_purchase_roas",
    numeratorDefinition: "Meta ROAS 분자는 PG confirmed revenue가 아니라 Meta가 광고에 귀속한 conversion value임",
    comparisonGuidance: "운영 메인은 Attribution confirmed ROAS, Meta purchase ROAS는 platform reference로만 해석",
  };
};

const pickActionValue = (
  action: MetaInsightAction,
  attributionWindow: MetaAttributionWindow | null,
) => toNumber(attributionWindow ? action[attributionWindow] ?? action.value : action.value);

const parseActions = (
  actions: MetaInsightAction[] | undefined,
  attributionWindow: MetaAttributionWindow | null = null,
) => {
  const actionMap: Record<string, number> = {};
  for (const action of actions ?? []) {
    actionMap[action.action_type] = pickActionValue(action, attributionWindow);
  }
  return {
    landingPageViews: actionMap.landing_page_view ?? 0,
    leads: actionMap.lead ?? actionMap["offsite_conversion.fb_pixel_lead"] ?? 0,
    purchases: actionMap.purchase ?? actionMap["offsite_conversion.fb_pixel_purchase"] ?? 0,
  };
};

const parsePurchaseValue = (
  actionValues: MetaInsightAction[] | undefined,
  attributionWindow: MetaAttributionWindow | null = null,
) => {
  const action = actionValues?.find((item) => item.action_type === "purchase");
  return action ? pickActionValue(action, attributionWindow) : 0;
};

const summarizeMetaRows = (
  rows: MetaInsightRow[],
  attributionWindow: MetaAttributionWindow | null = null,
): MetaTotals => {
  const totals = rows.reduce<MetaTotals>((sum, row) => {
    const actions = parseActions(row.actions, attributionWindow);
    sum.impressions += toNumber(row.impressions);
    sum.clicks += toNumber(row.clicks);
    sum.spend += toNumber(row.spend);
    sum.landingPageViews += actions.landingPageViews;
    sum.leads += actions.leads;
    sum.purchases += actions.purchases;
    sum.purchaseValue += parsePurchaseValue(row.action_values, attributionWindow);
    return sum;
  }, {
    impressions: 0,
    clicks: 0,
    spend: 0,
    cpc: 0,
    cpm: 0,
    landingPageViews: 0,
    leads: 0,
    purchases: 0,
    purchaseValue: 0,
  });

  return {
    ...totals,
    cpc: totals.clicks > 0 ? round2(totals.spend / totals.clicks) : 0,
    cpm: totals.impressions > 0 ? round2((totals.spend / totals.impressions) * 1000) : 0,
  };
};

const aggregateMetaCampaigns = (rows: MetaInsightRow[]): MetaCampaignAggregate[] => {
  const grouped = new Map<string, MetaCampaignAggregate>();

  for (const row of rows) {
    const campaignId = row.campaign_id || row.campaign_name || "(unknown)";
    const existing = grouped.get(campaignId) ?? {
      campaignId,
      campaignName: row.campaign_name || row.campaign_id || "(unknown)",
      impressions: 0,
      clicks: 0,
      spend: 0,
    };

    existing.impressions += toNumber(row.impressions);
    existing.clicks += toNumber(row.clicks);
    existing.spend += toNumber(row.spend);
    grouped.set(campaignId, existing);
  }

  return [...grouped.values()].sort((a, b) => b.spend - a.spend || b.impressions - a.impressions);
};

const sortEntriesByPreference = (entries: AttributionLedgerEntry[]) => [...entries].sort((a, b) => (
  CAPTURE_MODE_PRIORITY[b.captureMode] - CAPTURE_MODE_PRIORITY[a.captureMode]
  || Number(Boolean(b.utmSource || b.utmCampaign || b.fbclid || b.gclid))
    - Number(Boolean(a.utmSource || a.utmCampaign || a.fbclid || a.gclid))
  || b.loggedAt.localeCompare(a.loggedAt)
));

const extractStatus = (entry: AttributionLedgerEntry) => {
  const metadata = toObject(entry.metadata);
  return typeof metadata.status === "string" ? metadata.status.trim() : "";
};

const resolveOrderPaymentStatus = (entries: AttributionLedgerEntry[]): AttributionPaymentStatus => entries.reduce<AttributionPaymentStatus>(
  (current, entry) => {
    const candidate = entry.paymentStatus ?? "pending";
    return PAYMENT_STATUS_PRIORITY[candidate] > PAYMENT_STATUS_PRIORITY[current]
      ? candidate
      : current;
  },
  "pending",
);

export const extractLedgerAmount = (entry: AttributionLedgerEntry): number | null => {
  const metadata = toObject(entry.metadata);
  const referrerPayment = toObject(metadata.referrerPayment);

  const referrerAmount = (() => {
    try {
      const raw = entry.referrer.trim();
      if (!raw) return null;
      return toPositiveNumber(new URL(raw).searchParams.get("amount"));
    } catch {
      return null;
    }
  })();

  const candidates = [
    metadata.totalAmount,
    metadata.total_amount,
    metadata.amount,
    metadata.paymentAmount,
    metadata.payment_amount,
    referrerPayment.amount,
    referrerAmount,
  ];

  for (const candidate of candidates) {
    const amount = toPositiveNumber(candidate);
    if (amount !== null) return amount;
  }

  return null;
};

const resolveSiteFromString = (value: string): SiteKey | null => {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized.startsWith("biocom")) return "biocom";
  if (normalized.startsWith("thecleancoffee")) return "thecleancoffee";
  if (normalized.startsWith("aibio")) return "aibio";
  return null;
};

export const inferSiteFromLedgerEntry = (entry: AttributionLedgerEntry): SiteKey | null => {
  const metadata = toObject(entry.metadata);
  const source = typeof metadata.source === "string" ? resolveSiteFromString(metadata.source) : null;
  if (source) return source;

  const store = typeof metadata.store === "string" ? resolveSiteFromString(metadata.store) : null;
  if (store) return store;

  for (const candidate of [
    entry.requestContext.origin,
    entry.requestContext.requestReferer,
    entry.referrer,
    entry.landing,
  ]) {
    const host = resolveHost(candidate);
    if (!host) continue;
    const matchedSite = SITE_ACCOUNTS.find((site) =>
      site.hosts.some((siteHost) => host === siteHost || host.endsWith(`.${siteHost}`)));
    if (matchedSite) return matchedSite.site;
  }

  return null;
};

const resolveLedgerOrderDate = (entry: AttributionLedgerEntry): string | null =>
  normalizeDateLike(entry.approvedAt) ?? normalizeDateLike(entry.loggedAt);

const getOrderKey = (entry: AttributionLedgerEntry, index: number) =>
  entry.paymentKey || entry.orderId || `ledger:${index}:${entry.loggedAt}`;

type BusinessConfirmedImwebOrder = {
  site: SiteKey | null;
  completeDate: string | null;
  amount: number | null;
};

type BusinessConfirmedImwebOrderMap = Map<string, BusinessConfirmedImwebOrder[]>;

type BusinessConfirmedImwebOrderRow = {
  site: string | null;
  order_no: string | null;
  order_code: string | null;
  complete_time: string | null;
  payment_amount: number | null;
};

const normalizeOrderMatchKey = (value: unknown) =>
  normalizeOrderIdBase(typeof value === "string" ? value : "").toLowerCase();

const addOrderMatchKey = (keys: Set<string>, value: unknown) => {
  const key = normalizeOrderMatchKey(value);
  if (key) keys.add(key);
};

const addUrlOrderMatchKeys = (keys: Set<string>, value: string) => {
  for (const param of ["order_no", "orderNo", "order_id", "orderId", "order_code", "orderCode"]) {
    addOrderMatchKey(keys, extractUrlParam(value, param));
  }
};

const addMetadataOrderMatchKeys = (keys: Set<string>, metadata: Record<string, unknown>) => {
  const orderKeys = [
    "orderIdBase",
    "order_id_base",
    "orderId",
    "order_id",
    "orderNo",
    "order_no",
    "orderCode",
    "order_code",
    "imwebOrderCode",
    "imweb_order_code",
  ];

  for (const key of orderKeys) {
    addOrderMatchKey(keys, metadata[key]);
  }

  for (const nestedKey of ["referrerPayment", "payment", "imweb", "order", "checkout"]) {
    const nested = toObject(metadata[nestedKey]);
    for (const key of orderKeys) {
      addOrderMatchKey(keys, nested[key]);
    }
  }
};

const getLedgerOrderMatchKeys = (entries: AttributionLedgerEntry[]) => {
  const keys = new Set<string>();
  for (const entry of entries) {
    addOrderMatchKey(keys, entry.orderId);
    addMetadataOrderMatchKeys(keys, entry.metadata);
    addUrlOrderMatchKeys(keys, entry.landing);
    addUrlOrderMatchKeys(keys, entry.referrer);
    addUrlOrderMatchKeys(keys, entry.requestContext.requestReferer);
  }
  return keys;
};

const loadBusinessConfirmedImwebOrderMap = (): BusinessConfirmedImwebOrderMap => {
  const rows = getCrmDb().prepare(`
    SELECT site, order_no, order_code, complete_time, payment_amount
    FROM imweb_orders
    WHERE complete_time IS NOT NULL
      AND TRIM(complete_time) != ''
  `).all() as BusinessConfirmedImwebOrderRow[];

  const map: BusinessConfirmedImwebOrderMap = new Map();
  for (const row of rows) {
    const item: BusinessConfirmedImwebOrder = {
      site: row.site ? resolveSiteFromString(row.site) : null,
      completeDate: row.complete_time ? normalizeDateLike(row.complete_time) : null,
      amount: row.payment_amount !== null && Number.isFinite(Number(row.payment_amount))
        ? Number(row.payment_amount)
        : null,
    };
    const keys = new Set<string>();
    addOrderMatchKey(keys, row.order_no ?? "");
    addOrderMatchKey(keys, row.order_code ?? "");
    for (const key of keys) {
      const bucket = map.get(key) ?? [];
      bucket.push(item);
      map.set(key, bucket);
    }
  }
  return map;
};

const findBusinessConfirmedOrder = (
  entries: AttributionLedgerEntry[],
  businessConfirmedOrders: BusinessConfirmedImwebOrderMap,
  site: SiteKey | null,
): BusinessConfirmedImwebOrder | null => {
  for (const key of getLedgerOrderMatchKeys(entries)) {
    const matches = businessConfirmedOrders.get(key);
    if (!matches?.length) continue;
    const siteMatch = site ? matches.find((match) => match.site === site) : null;
    return siteMatch ?? matches[0] ?? null;
  }
  return null;
};

export const buildNormalizedLedgerOrders = (
  entries: AttributionLedgerEntry[],
  businessConfirmedOrders: BusinessConfirmedImwebOrderMap = new Map(),
  options: { trustConfirmedPaymentStatusAsBusinessConfirmed?: boolean } = {},
): NormalizedLedgerOrder[] => {
  const grouped = new Map<string, AttributionLedgerEntry[]>();

  entries
    .filter((entry) => entry.touchpoint === "payment_success")
    .forEach((entry, index) => {
      const key = getOrderKey(entry, index);
      const bucket = grouped.get(key) ?? [];
      bucket.push(entry);
      grouped.set(key, bucket);
    });

  return [...grouped.entries()].map(([key, group]) => {
    const preferred = sortEntriesByPreference(group);
    const attributionCarrier = preferred.find(
      (entry) => Boolean(entry.utmSource || entry.utmCampaign || entry.fbclid || entry.gclid || entry.ttclid),
    ) ?? preferred[0];

    const amount = preferred.map(extractLedgerAmount).find((value) => value !== null) ?? null;
    const site = preferred.map(inferSiteFromLedgerEntry).find((value) => value !== null) ?? null;
    const approvedDate = preferred.map(resolveLedgerOrderDate).find((value) => value !== null) ?? null;
    const businessConfirmedOrder = findBusinessConfirmedOrder(preferred, businessConfirmedOrders, site);
    const paymentStatus = resolveOrderPaymentStatus(preferred);
    const inferredBusinessConfirmed = options.trustConfirmedPaymentStatusAsBusinessConfirmed === true
      && paymentStatus === "confirmed";
    const statusCarrier = [...preferred].sort((a, b) => (
      PAYMENT_STATUS_PRIORITY[b.paymentStatus ?? "pending"] - PAYMENT_STATUS_PRIORITY[a.paymentStatus ?? "pending"]
      || b.loggedAt.localeCompare(a.loggedAt)
    ))[0];
    const status = extractStatus(statusCarrier) || paymentStatus.toUpperCase();
    const urlCandidates = preferred.flatMap((entry) => [
      entry.landing,
      entry.referrer,
      firstMetadataString(entry.metadata, [
        "imweb_landing_url",
        "checkout_started_landing",
        "checkoutUrl",
        "initial_referrer",
        "original_referrer",
      ]),
    ]);
    const campaignAlias = extractFirstUrlParam(urlCandidates, "campaign_alias");
    const utmCampaign = firstNonEmpty([attributionCarrier?.utmCampaign ?? "", campaignAlias]);
    const utmTerm = attributionCarrier?.utmTerm ?? "";
    const utmContent = attributionCarrier?.utmContent ?? "";
    const campaignIdHint = firstNonEmpty([
      normalizeMetaNumericId(utmCampaign),
      extractFirstNumericUrlParam(urlCandidates, [
        "meta_campaign_id",
        "campaign_id",
        "utm_id",
        "utm_campaign",
      ]),
    ]);
    const adsetIdHint = firstNonEmpty([
      normalizeMetaNumericId(utmTerm),
      extractFirstNumericUrlParam(urlCandidates, [
        "meta_adset_id",
        "adset_id",
        "utm_term",
      ]),
    ]);
    const adIdHint = firstNonEmpty([
      normalizeMetaNumericId(utmContent),
      extractFirstNumericUrlParam(urlCandidates, [
        "meta_ad_id",
        "ad_id",
        "utm_content",
      ]),
    ]);

    return {
      key,
      orderId: firstNonEmpty(preferred.map((entry) => entry.orderId)),
      paymentKey: firstNonEmpty(preferred.map((entry) => entry.paymentKey)),
      approvedDate,
      amount,
      site,
      customerKey: firstNonEmpty(preferred.map((entry) => normalizePhone(entry.customerKey))),
      utmSource: attributionCarrier?.utmSource ?? "",
      utmCampaign,
      utmTerm,
      utmContent,
      fbclid: attributionCarrier?.fbclid ?? "",
      gclid: attributionCarrier?.gclid ?? "",
      ttclid: attributionCarrier?.ttclid ?? "",
      campaignIdHint,
      adsetIdHint,
      adIdHint,
      captureMode: attributionCarrier?.captureMode ?? preferred[0]?.captureMode ?? "live",
      paymentStatus,
      status,
      completed: paymentStatus === "confirmed",
      businessConfirmed: Boolean(businessConfirmedOrder) || inferredBusinessConfirmed,
      businessConfirmedDate: businessConfirmedOrder?.completeDate ?? (inferredBusinessConfirmed ? approvedDate : null),
      businessConfirmedAmount: businessConfirmedOrder?.amount ?? (inferredBusinessConfirmed ? amount : null),
      entryCount: group.length,
    };
  }).sort((a, b) => (
    (b.approvedDate ?? "").localeCompare(a.approvedDate ?? "")
    || b.key.localeCompare(a.key)
  ));
};

const normalizeSource = (value: string) => value.trim().toLowerCase();

const inDateRange = (date: string | null, range: DateRange) =>
  Boolean(date && date >= range.startDate && date <= range.endDate);

const isMetaAttributedOrder = (order: NormalizedLedgerOrder) => {
  const source = normalizeSource(order.utmSource);
  const campaign = normalizeSource(order.utmCampaign);
  return (
    source === "fb"
    || source.includes("facebook")
    || source.includes("meta")
    || campaign.includes("meta")
    || Boolean(order.fbclid.trim())
    || Boolean(order.campaignIdHint.trim())
    || Boolean(order.adsetIdHint.trim())
    || Boolean(order.adIdHint.trim())
  );
};

const isGoogleAttributedOrder = (order: NormalizedLedgerOrder) => {
  const source = normalizeSource(order.utmSource);
  return source.includes("google") || Boolean(order.gclid.trim());
};

const isDaangnAttributedOrder = (order: NormalizedLedgerOrder) => {
  const source = normalizeSource(order.utmSource);
  return source.includes("daangn")
    || source.includes("danggn")
    || source.includes("karrot")
    || source.includes("당근");
};

const filterOrdersByRange = (
  orders: NormalizedLedgerOrder[],
  range: DateRange,
) => orders.filter((order) => order.completed && inDateRange(order.approvedDate, range));

const filterOrdersByDateRange = (
  orders: NormalizedLedgerOrder[],
  range: DateRange,
) => orders.filter((order) => inDateRange(order.approvedDate, range));

const computeRoas = (
  revenue: number,
  spend: number,
  ledgerAvailable: boolean,
): number | null => {
  if (!ledgerAvailable) return null;
  if (spend <= 0) return null;
  return round2(revenue / spend);
};

const computeObservedRoas = (value: number, spend: number) => {
  if (spend <= 0) return null;
  return round2(value / spend);
};

const sumRevenue = (orders: NormalizedLedgerOrder[]) =>
  round2(orders.reduce((sum, order) => sum + (order.amount ?? 0), 0));

const getOfficialRevenueAmount = (order: NormalizedLedgerOrder) =>
  order.businessConfirmedAmount ?? order.amount ?? 0;

const sumOfficialRevenue = (orders: NormalizedLedgerOrder[]) =>
  round2(orders.reduce((sum, order) => (
    order.businessConfirmed ? sum + getOfficialRevenueAmount(order) : sum
  ), 0));

const computeRoasGap = (
  officialRoas: number | null,
  fastSignalRoas: number | null,
) => (
  officialRoas === null || fastSignalRoas === null
    ? null
    : round2(officialRoas - fastSignalRoas)
);

const normalizeCampaignKey = (value: string) =>
  value.trim().toLowerCase().replace(/[^a-z0-9가-힣]+/g, "");

type AdsetCampaignMatch = {
  campaignId: string;
  campaignName: string;
  adsetName: string;
};

type AdsetCampaignMap = Map<string, AdsetCampaignMatch>;

type AdCampaignMatch = AdsetCampaignMatch & {
  adName: string;
};

type AdCampaignMap = Map<string, AdCampaignMatch>;

type CampaignAliasMatch = {
  campaignId: string;
  campaignName: string | null;
  validFrom: string | null;
  validTo: string | null;
  confidence: string;
};

type CampaignAliasMap = Map<string, CampaignAliasMatch[]>;

const fetchManualVerifiedAliasMap = async (
  site: SiteKey | null,
): Promise<{ map: CampaignAliasMap; error: string | null }> => {
  const map: CampaignAliasMap = new Map();
  if (!site) return { map, error: null };

  try {
    const review = await loadAliasReviewItems(site);
    for (const item of review.items) {
      if (item.status !== "manual_verified" || !item.selectedCampaignId) continue;
      const aliasKey = normalizeCampaignKey(item.aliasKey);
      if (!aliasKey) continue;
      const bucket = map.get(aliasKey) ?? [];
      bucket.push({
        campaignId: item.selectedCampaignId,
        campaignName: item.selectedCampaignName,
        validFrom: item.validFrom,
        validTo: item.validTo,
        confidence: item.confidence,
      });
      map.set(aliasKey, bucket);
    }
    return { map, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { map, error: message };
  }
};

const mergeCampaignAliasMaps = (...maps: CampaignAliasMap[]): CampaignAliasMap => {
  const merged: CampaignAliasMap = new Map();
  for (const map of maps) {
    for (const [aliasKey, matches] of map) {
      const bucket = merged.get(aliasKey) ?? [];
      bucket.push(...matches);
      merged.set(aliasKey, bucket);
    }
  }
  return merged;
};

const isAliasMatchActive = (match: CampaignAliasMatch, orderDate: string | null) => {
  if (!orderDate) return true;
  if (match.validFrom && orderDate < match.validFrom) return false;
  if (match.validTo && orderDate > match.validTo) return false;
  return true;
};

const matchCampaignId = (
  utmCampaign: string,
  campaigns: MetaCampaignAggregate[],
): string | null => {
  const key = normalizeCampaignKey(utmCampaign);
  if (!key) return null;

  const exactMatch = campaigns.find((campaign) => (
    normalizeCampaignKey(campaign.campaignId) === key
    || normalizeCampaignKey(campaign.campaignName) === key
  ));
  if (exactMatch) return exactMatch.campaignId;

  const fuzzyMatches = campaigns.filter((campaign) => {
    const campaignKey = normalizeCampaignKey(campaign.campaignName);
    return campaignKey.includes(key) || key.includes(campaignKey);
  });

  return fuzzyMatches.length === 1 ? fuzzyMatches[0]?.campaignId ?? null : null;
};

const matchCampaignIdForOrder = (
  order: NormalizedLedgerOrder,
  campaigns: MetaCampaignAggregate[],
  adsetCampaignMap: AdsetCampaignMap = new Map(),
  adCampaignMap: AdCampaignMap = new Map(),
  campaignAliasMap: CampaignAliasMap = new Map(),
): string | null => {
  const campaignIdHint = order.campaignIdHint.trim();
  if (campaignIdHint && campaigns.some((campaign) => campaign.campaignId === campaignIdHint)) {
    return campaignIdHint;
  }

  const adMatch = adCampaignMap.get(order.adIdHint.trim());
  if (adMatch && campaigns.some((campaign) => campaign.campaignId === adMatch.campaignId)) {
    return adMatch.campaignId;
  }

  const adsetMatch = adsetCampaignMap.get(order.adsetIdHint.trim());
  if (adsetMatch && campaigns.some((campaign) => campaign.campaignId === adsetMatch.campaignId)) {
    return adsetMatch.campaignId;
  }

  const directMatch = matchCampaignId(order.utmCampaign, campaigns);
  if (directMatch) return directMatch;

  const aliasKey = normalizeCampaignKey(firstNonEmpty([order.utmCampaign, order.utmSource]));
  const activeAliasCampaignIds = new Set(
    (campaignAliasMap.get(aliasKey) ?? [])
      .filter((match) => isAliasMatchActive(match, order.approvedDate))
      .filter((match) => campaigns.some((campaign) => campaign.campaignId === match.campaignId))
      .map((match) => match.campaignId),
  );

  return activeAliasCampaignIds.size === 1 ? [...activeAliasCampaignIds][0] ?? null : null;
};

export const buildCampaignRoasRows = (params: {
  metaRows: MetaInsightRow[];
  orders: NormalizedLedgerOrder[];
  ledgerAvailable: boolean;
  adsetCampaignMap?: AdsetCampaignMap;
  adCampaignMap?: AdCampaignMap;
  campaignAliasMap?: CampaignAliasMap;
}): CampaignRoasRow[] => {
  const campaigns = aggregateMetaCampaigns(params.metaRows);
  const revenueByCampaignId = new Map<string, { revenue: number; orders: number }>();
  let unmappedRevenue = 0;
  let unmappedOrders = 0;

  for (const order of params.orders.filter((candidate) => candidate.completed).filter(isMetaAttributedOrder)) {
    const matchedCampaignId = matchCampaignIdForOrder(
      order,
      campaigns,
      params.adsetCampaignMap,
      params.adCampaignMap,
      params.campaignAliasMap,
    );
    if (!matchedCampaignId) {
      unmappedRevenue += order.amount ?? 0;
      unmappedOrders += 1;
      continue;
    }

    const existing = revenueByCampaignId.get(matchedCampaignId) ?? { revenue: 0, orders: 0 };
    existing.revenue += order.amount ?? 0;
    existing.orders += 1;
    revenueByCampaignId.set(matchedCampaignId, existing);
  }

  const rows: CampaignRoasRow[] = campaigns.map((campaign) => {
    const attribution = revenueByCampaignId.get(campaign.campaignId);
    const attributedRevenue = round2(attribution?.revenue ?? 0);
    return {
      campaignId: campaign.campaignId,
      campaignName: campaign.campaignName,
      spend: round2(campaign.spend),
      attributedRevenue,
      roas: computeRoas(attributedRevenue, campaign.spend, params.ledgerAvailable),
      orders: attribution?.orders ?? 0,
      campaignType: isCoopCampaignByName(campaign.campaignName) ? "coop" : "general",
    };
  });

  if (unmappedOrders > 0 || unmappedRevenue > 0) {
    rows.push({
      campaignId: null,
      campaignName: "(unmapped)",
      spend: 0,
      attributedRevenue: round2(unmappedRevenue),
      roas: params.ledgerAvailable ? null : null,
      orders: unmappedOrders,
      campaignType: "general",
    });
  }

  return rows.sort((a, b) => b.spend - a.spend || b.attributedRevenue - a.attributedRevenue);
};

const ADS_ORDER_DATE_SQL = `
  case
    when trim(coalesce(payment_complete_time::text, '')) ~ '^\\d{4}-\\d{2}-\\d{2}' then left(trim(payment_complete_time::text), 10)::date
    when trim(coalesce(order_date::text, '')) ~ '^\\d{4}-\\d{2}-\\d{2}' then left(trim(order_date::text), 10)::date
    else null
  end
`;
const ADS_ORDER_REVENUE_SQL = `
  greatest(
    coalesce(nullif(final_order_amount, 0), nullif(paid_price, 0), nullif(total_price, 0), 0)
      - coalesce(total_refunded_price, 0),
    0
  )
`;
const ADS_NORMALIZED_PHONE_SQL = `regexp_replace(coalesce(customer_number::text, ''), '[^0-9]', '', 'g')`;
const ADS_NORMALIZED_CONTACT_SQL = `regexp_replace(coalesce(customer_contact::text, ''), '[^0-9]', '', 'g')`;

type AdsOrderIdentityRow = {
  order_number: string;
  normalized_phone: string;
  order_date: string;
  net_revenue: number | string;
  product_names: string[] | null;
};

type AdsOrderFact = {
  orderNumber: string;
  normalizedPhone: string;
  orderDate: string;
  netRevenue: number;
  productCategories: Set<"test_kit" | "supplement" | "other">;
};

const normalizeProductNames = (value: unknown): string[] => (
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []
);

const mapOrderFact = (row: AdsOrderIdentityRow): AdsOrderFact | null => {
  const normalizedPhone = normalizePhone(row.normalized_phone);
  const orderDate = normalizeDateLike(String(row.order_date ?? ""));
  if (!row.order_number || !normalizedPhone || !orderDate) return null;
  return {
    orderNumber: row.order_number,
    normalizedPhone,
    orderDate,
    netRevenue: toNumber(row.net_revenue),
    productCategories: new Set(normalizeProductNames(row.product_names).map(categorizeProductName)),
  };
};

const fetchOrderFactsByOrderNumbers = async (orderNumbers: string[]) => {
  const uniqueOrderNumbers = [...new Set(orderNumbers.filter((value) => value.trim()))];
  if (uniqueOrderNumbers.length === 0) return new Map<string, AdsOrderFact>();

  const result = await queryPg<AdsOrderIdentityRow>(
    `
      select
        order_number::text as order_number,
        ${ADS_NORMALIZED_PHONE_SQL} as normalized_phone,
        ${ADS_ORDER_DATE_SQL}::text as order_date,
        max(${ADS_ORDER_REVENUE_SQL}) as net_revenue,
        array_agg(distinct coalesce(nullif(trim(product_name), ''), '미분류')) as product_names
      from public.tb_iamweb_users
      where order_number::text = any($1::text[])
        and ${ADS_ORDER_DATE_SQL} is not null
        and ${ADS_ORDER_REVENUE_SQL} > 0
        and (cancellation_reason is null or trim(cancellation_reason::text) in ('', 'nan'))
        and (return_reason is null or trim(return_reason::text) in ('', 'nan'))
      group by order_number::text, ${ADS_NORMALIZED_PHONE_SQL}, ${ADS_ORDER_DATE_SQL}
    `,
    [uniqueOrderNumbers],
  );

  const facts = new Map<string, AdsOrderFact>();
  for (const row of result.rows) {
    const fact = mapOrderFact(row);
    if (fact) facts.set(fact.orderNumber, fact);
  }
  return facts;
};

const fetchOrderFactsByPhones = async (phones: string[], startDate: string, endDate: string) => {
  const uniquePhones = [...new Set(phones.map(normalizePhone).filter(Boolean))];
  if (uniquePhones.length === 0) return new Map<string, AdsOrderFact[]>();

  const result = await queryPg<AdsOrderIdentityRow>(
    `
      select
        order_number::text as order_number,
        ${ADS_NORMALIZED_PHONE_SQL} as normalized_phone,
        ${ADS_ORDER_DATE_SQL}::text as order_date,
        max(${ADS_ORDER_REVENUE_SQL}) as net_revenue,
        array_agg(distinct coalesce(nullif(trim(product_name), ''), '미분류')) as product_names
      from public.tb_iamweb_users
      where ${ADS_NORMALIZED_PHONE_SQL} = any($1::text[])
        and ${ADS_ORDER_DATE_SQL} between $2::date and $3::date
        and ${ADS_ORDER_REVENUE_SQL} > 0
        and (cancellation_reason is null or trim(cancellation_reason::text) in ('', 'nan'))
        and (return_reason is null or trim(return_reason::text) in ('', 'nan'))
      group by order_number::text, ${ADS_NORMALIZED_PHONE_SQL}, ${ADS_ORDER_DATE_SQL}
      order by ${ADS_NORMALIZED_PHONE_SQL} asc, ${ADS_ORDER_DATE_SQL} asc, order_number::text asc
    `,
    [uniquePhones, startDate, endDate],
  );

  const grouped = new Map<string, AdsOrderFact[]>();
  for (const row of result.rows) {
    const fact = mapOrderFact(row);
    if (!fact) continue;
    const bucket = grouped.get(fact.normalizedPhone) ?? [];
    bucket.push(fact);
    grouped.set(fact.normalizedPhone, bucket);
  }
  return grouped;
};

const fetchCompletedConsultationPhones = async (phones: string[]) => {
  const uniquePhones = [...new Set(phones.map(normalizePhone).filter(Boolean))];
  if (uniquePhones.length === 0) return new Set<string>();

  const result = await queryPg<{ normalized_phone: string }>(
    `
      select distinct ${ADS_NORMALIZED_CONTACT_SQL} as normalized_phone
      from public.tb_consultation_records
      where ${ADS_NORMALIZED_CONTACT_SQL} = any($1::text[])
        and coalesce(consultation_status::text, '') like '%완료%'
    `,
    [uniquePhones],
  );

  return new Set(result.rows.map((row) => normalizePhone(row.normalized_phone)).filter(Boolean));
};

const buildCampaignOrderMap = (params: {
  campaigns: MetaCampaignAggregate[];
  orders: NormalizedLedgerOrder[];
  adsetCampaignMap?: AdsetCampaignMap;
  adCampaignMap?: AdCampaignMap;
  campaignAliasMap?: CampaignAliasMap;
}) => {
  const matched = new Map<string, NormalizedLedgerOrder[]>();
  for (const order of params.orders.filter((candidate) => candidate.completed).filter(isMetaAttributedOrder)) {
    const campaignId = matchCampaignIdForOrder(
      order,
      params.campaigns,
      params.adsetCampaignMap,
      params.adCampaignMap,
      params.campaignAliasMap,
    );
    if (!campaignId) continue;
    const bucket = matched.get(campaignId) ?? [];
    bucket.push(order);
    matched.set(campaignId, bucket);
  }
  return matched;
};

const buildBlockedLtvRows = (campaignRows: CampaignRoasRow[], ltvWindowDays: number, blocker: string) =>
  campaignRows.map((row): CampaignLtvRoasRow => ({
    ...row,
    ltvRevenue: row.attributedRevenue,
    repeatRevenue: 0,
    supplementRevenue: 0,
    ltvRoas: computeRoas(row.attributedRevenue, row.spend, true),
    matchedCustomers: 0,
    consultedCustomers: 0,
    supplementCustomers: 0,
    identityMatchedOrders: 0,
    ltvStatus: "blocked",
    ltvBlocker: `${blocker} (window=${ltvWindowDays}d)`,
  }));

const buildCampaignLtvRoasRows = async (params: {
  campaignRows: CampaignRoasRow[];
  campaigns: MetaCampaignAggregate[];
  orders: NormalizedLedgerOrder[];
  range: DateRange;
  adsetCampaignMap?: AdsetCampaignMap;
  adCampaignMap?: AdCampaignMap;
  campaignAliasMap?: CampaignAliasMap;
  ltvWindowDays: number;
}): Promise<CampaignLtvRoasRow[]> => {
  if (!isDatabaseConfigured()) {
    return buildBlockedLtvRows(params.campaignRows, params.ltvWindowDays, "DATABASE_URL 미설정");
  }

  const campaignOrderMap = buildCampaignOrderMap({
    campaigns: params.campaigns,
    orders: params.orders,
    adsetCampaignMap: params.adsetCampaignMap,
    adCampaignMap: params.adCampaignMap,
    campaignAliasMap: params.campaignAliasMap,
  });
  const orderNumbers = [...campaignOrderMap.values()].flat().map((order) => order.orderId);
  const orderFactsByOrderNumber = await fetchOrderFactsByOrderNumbers(orderNumbers);
  const phones = [...new Set([...orderFactsByOrderNumber.values()].map((fact) => fact.normalizedPhone))];
  const futureOrdersByPhone = await fetchOrderFactsByPhones(
    phones,
    params.range.startDate,
    shiftIsoDateByDays(params.range.endDate, params.ltvWindowDays),
  );
  const completedConsultationPhones = await fetchCompletedConsultationPhones(phones);

  return params.campaignRows.map((row) => {
    if (!row.campaignId) {
      return {
        ...row,
        ltvRevenue: row.attributedRevenue,
        repeatRevenue: 0,
        supplementRevenue: 0,
        ltvRoas: null,
        matchedCustomers: 0,
        consultedCustomers: 0,
        supplementCustomers: 0,
        identityMatchedOrders: 0,
        ltvStatus: "no_attribution",
        ltvBlocker: "캠페인 미매핑 버킷",
      };
    }

    const campaignOrders = campaignOrderMap.get(row.campaignId) ?? [];
    if (campaignOrders.length === 0) {
      return {
        ...row,
        ltvRevenue: 0,
        repeatRevenue: 0,
        supplementRevenue: 0,
        ltvRoas: computeRoas(0, row.spend, true),
        matchedCustomers: 0,
        consultedCustomers: 0,
        supplementCustomers: 0,
        identityMatchedOrders: 0,
        ltvStatus: "no_attribution",
        ltvBlocker: "confirmed attribution 주문 없음",
      };
    }

    const ordersByPhone = new Map<string, NormalizedLedgerOrder[]>();
    let identityMatchedOrders = 0;
    let unmatchedAttributedRevenue = 0;

    for (const order of campaignOrders) {
      const fact = orderFactsByOrderNumber.get(order.orderId);
      const phone = fact?.normalizedPhone ?? normalizePhone(order.customerKey);
      if (!phone) {
        unmatchedAttributedRevenue += order.amount ?? 0;
        continue;
      }
      identityMatchedOrders += 1;
      const bucket = ordersByPhone.get(phone) ?? [];
      bucket.push(order);
      ordersByPhone.set(phone, bucket);
    }

    let ltvRevenue = unmatchedAttributedRevenue;
    let supplementRevenue = 0;
    let consultedCustomers = 0;
    let supplementCustomers = 0;

    for (const [phone, orders] of ordersByPhone.entries()) {
      const anchorDate = orders
        .map((order) => order.approvedDate)
        .filter((date): date is string => Boolean(date))
        .sort()[0] ?? params.range.startDate;
      const attributedRevenueForPhone = orders.reduce((sum, order) => sum + (order.amount ?? 0), 0);
      const windowEnd = shiftIsoDateByDays(anchorDate, params.ltvWindowDays);
      const ltvOrders = (futureOrdersByPhone.get(phone) ?? []).filter(
        (order) => order.orderDate >= anchorDate && order.orderDate <= windowEnd,
      );
      const phoneLtvRevenue = ltvOrders.reduce((sum, order) => sum + order.netRevenue, 0);
      const phoneSupplementRevenue = ltvOrders
        .filter((order) => order.productCategories.has("supplement"))
        .reduce((sum, order) => sum + order.netRevenue, 0);

      ltvRevenue += Math.max(phoneLtvRevenue, attributedRevenueForPhone);
      supplementRevenue += phoneSupplementRevenue;
      if (phoneSupplementRevenue > 0) supplementCustomers += 1;
      if (completedConsultationPhones.has(phone)) consultedCustomers += 1;
    }

    const roundedLtvRevenue = round2(ltvRevenue);
    const repeatRevenue = Math.max(0, roundedLtvRevenue - row.attributedRevenue);
    const matchedCustomers = ordersByPhone.size;
    const ltvStatus: CampaignLtvRoasRow["ltvStatus"] =
      matchedCustomers === 0
        ? "identity_missing"
        : identityMatchedOrders < 2 || row.attributedRevenue < 500_000
          ? "low_sample"
          : "ready";

    return {
      ...row,
      ltvRevenue: roundedLtvRevenue,
      repeatRevenue: round2(repeatRevenue),
      supplementRevenue: round2(supplementRevenue),
      ltvRoas: computeRoas(roundedLtvRevenue, row.spend, true),
      matchedCustomers,
      consultedCustomers,
      supplementCustomers,
      identityMatchedOrders,
      ltvStatus,
      ltvBlocker:
        ltvStatus === "identity_missing"
          ? "order_number/customer phone 매칭 실패"
          : ltvStatus === "low_sample"
            ? "표본 부족: confirmed 2건 이상 또는 ₩500,000 이상 필요"
            : null,
    };
  });
};

export const buildDailyRoasRows = (params: {
  range: DateRange;
  metaRows: MetaInsightRow[];
  orders: NormalizedLedgerOrder[];
  ledgerAvailable: boolean;
  attributionWindow?: MetaAttributionWindow | null;
}): DailyRoasRow[] => {
  const spendByDate = new Map<string, number>();
  const metaPurchaseValueByDate = new Map<string, number>();
  for (const row of params.metaRows) {
    const date = normalizeDateLike(row.date_start);
    if (!date) continue;
    spendByDate.set(date, (spendByDate.get(date) ?? 0) + toNumber(row.spend));
    metaPurchaseValueByDate.set(
      date,
      (metaPurchaseValueByDate.get(date) ?? 0) + parsePurchaseValue(row.action_values, params.attributionWindow ?? null),
    );
  }

  const confirmedRevenueByDate = new Map<string, number>();
  const pendingRevenueByDate = new Map<string, number>();
  const officialRevenueByDate = new Map<string, number>();
  for (const order of params.orders.filter(isMetaAttributedOrder)) {
    if (!order.approvedDate) continue;
    if (order.businessConfirmed) {
      officialRevenueByDate.set(
        order.approvedDate,
        (officialRevenueByDate.get(order.approvedDate) ?? 0) + getOfficialRevenueAmount(order),
      );
    }
    if (order.paymentStatus === "confirmed") {
      confirmedRevenueByDate.set(
        order.approvedDate,
        (confirmedRevenueByDate.get(order.approvedDate) ?? 0) + (order.amount ?? 0),
      );
      continue;
    }
    if (order.paymentStatus === "pending") {
      pendingRevenueByDate.set(
        order.approvedDate,
        (pendingRevenueByDate.get(order.approvedDate) ?? 0) + (order.amount ?? 0),
      );
    }
  }

  const rows: DailyRoasRow[] = [];
  for (
    let date = params.range.startDate;
    date <= params.range.endDate;
    date = shiftIsoDateByDays(date, 1)
  ) {
    const spend = round2(spendByDate.get(date) ?? 0);
    const confirmedRevenue = round2(confirmedRevenueByDate.get(date) ?? 0);
    const pendingRevenue = round2(pendingRevenueByDate.get(date) ?? 0);
    const officialRevenue = round2(officialRevenueByDate.get(date) ?? 0);
    const potentialRevenue = round2(confirmedRevenue + pendingRevenue);
    const metaPurchaseValue = round2(metaPurchaseValueByDate.get(date) ?? 0);
    const confirmedRoas = computeRoas(confirmedRevenue, spend, params.ledgerAvailable);
    const officialRoas = computeRoas(officialRevenue, spend, params.ledgerAvailable);
    rows.push({
      date,
      spend,
      revenue: confirmedRevenue,
      roas: confirmedRoas,
      confirmedRevenue,
      pendingRevenue,
      potentialRevenue,
      metaPurchaseValue,
      confirmedRoas,
      officialRoas,
      fastSignalRoas: confirmedRoas,
      roasGap: computeRoasGap(officialRoas, confirmedRoas),
      potentialRoas: computeRoas(potentialRevenue, spend, params.ledgerAvailable),
      metaPurchaseRoas: computeObservedRoas(metaPurchaseValue, spend),
    });
  }

  return rows;
};

const fetchSiteMetaSummary = async (params: {
  site: SiteKey;
  accountId: string;
  range: DateRange;
  datePreset: string | null;
  attributionWindow?: MetaAttributionWindow | null;
}): Promise<SiteMetaSummary> => {
  const result = await fetchMetaInsights({
    accountId: params.accountId,
    fields: "impressions,clicks,spend,cpc,cpm,actions,action_values",
    datePreset: params.datePreset ?? undefined,
    range: params.datePreset ? undefined : params.range,
    limit: "10",
    actionReportTime: META_DEFAULT_ACTION_REPORT_TIME,
    useUnifiedAttributionSetting: params.attributionWindow
      ? false
      : META_DEFAULT_UNIFIED_ATTRIBUTION_SETTING,
    actionAttributionWindows: params.attributionWindow
      ? [params.attributionWindow]
      : undefined,
  });

  if (!result.ok) {
    return {
      site: params.site,
      accountId: params.accountId,
      impressions: 0,
      clicks: 0,
      spend: 0,
      cpc: 0,
      cpm: 0,
      landingPageViews: 0,
      leads: 0,
      purchases: 0,
      purchaseValue: 0,
      metaError: result.error,
    };
  }

  return {
    site: params.site,
    accountId: params.accountId,
    ...summarizeMetaRows(result.data, params.attributionWindow ?? null),
    metaError: null,
  };
};

type AdsLedgerLoadOptions = {
  range?: DateRange;
  sites?: SiteKey[];
  source?: AdsLedgerSourceRequest;
};

type LoadedAdsLedger = {
  entries: AttributionLedgerEntry[];
  orders: NormalizedLedgerOrder[];
  dataSource: AdsLedgerSourceUsed;
  requestedSource: AdsLedgerSourceRequest;
  warnings: string[];
  freshness: LedgerFreshness;
};

const safeRemoteString = (value: unknown) => (typeof value === "string" ? value : "");

const safeRemoteCaptureMode = (value: unknown): AttributionCaptureMode => (
  value === "live" || value === "replay" || value === "smoke" ? value : "live"
);

const safeRemotePaymentStatus = (value: unknown): AttributionPaymentStatus | null => (
  value === "pending" || value === "confirmed" || value === "canceled" ? value : null
);

const normalizeRemoteLedgerEntryForAds = (item: unknown): AttributionLedgerEntry => {
  const raw = toObject(item);
  const metadata = toObject(raw.metadata);
  const requestContext = toObject(raw.requestContext);
  return {
    touchpoint: safeRemoteString(raw.touchpoint) as AttributionLedgerEntry["touchpoint"],
    captureMode: safeRemoteCaptureMode(raw.captureMode),
    paymentStatus: safeRemotePaymentStatus(raw.paymentStatus),
    loggedAt: safeRemoteString(raw.loggedAt),
    orderId: safeRemoteString(raw.orderId),
    paymentKey: safeRemoteString(raw.paymentKey),
    approvedAt: safeRemoteString(raw.approvedAt),
    checkoutId: safeRemoteString(raw.checkoutId),
    customerKey: safeRemoteString(raw.customerKey),
    landing: safeRemoteString(raw.landing),
    referrer: safeRemoteString(raw.referrer),
    gaSessionId: safeRemoteString(raw.gaSessionId),
    utmSource: safeRemoteString(raw.utmSource),
    utmMedium: safeRemoteString(raw.utmMedium),
    utmCampaign: safeRemoteString(raw.utmCampaign),
    utmTerm: safeRemoteString(raw.utmTerm),
    utmContent: safeRemoteString(raw.utmContent),
    gclid: safeRemoteString(raw.gclid),
    fbclid: safeRemoteString(raw.fbclid),
    ttclid: safeRemoteString(raw.ttclid),
    metadata: safeRemoteString(raw.source)
      ? { ...metadata, source: safeRemoteString(raw.source) }
      : metadata,
    requestContext: {
      ip: safeRemoteString(requestContext.ip),
      userAgent: safeRemoteString(requestContext.userAgent),
      origin: safeRemoteString(requestContext.origin),
      requestReferer: safeRemoteString(requestContext.requestReferer),
      method: safeRemoteString(requestContext.method),
      path: safeRemoteString(requestContext.path),
    },
  };
};

const buildLedgerFreshness = (
  entries: AttributionLedgerEntry[],
  orders: NormalizedLedgerOrder[],
): LedgerFreshness => ({
  entries: entries.length,
  orders: orders.length,
  latestLoggedAt: entries.reduce<string | null>((latest, entry) => (
    entry.loggedAt && (!latest || entry.loggedAt > latest) ? entry.loggedAt : latest
  ), null),
  latestApprovedDate: orders.reduce<string | null>((latest, order) => (
    order.approvedDate && (!latest || order.approvedDate > latest) ? order.approvedDate : latest
  ), null),
});

// /ads 페이지가 동시에 5~10개 endpoint 를 호출 → 각 endpoint 가 3 site × ledger self-fetch → 15~30 concurrent self-fetches → backend memory 폭주 → OOM.
// (site,range) 조합별로 60초 lazy cache + in-flight promise coalescing 으로 concurrent call 을 1회 fetch 로 합친다.
type LedgerFetchEntry = {
  promise: Promise<{ entries: AttributionLedgerEntry[]; warnings: string[] }>;
  cachedAtMs: number;
  ttlMs: number;
};
const operationalLedgerFetchCache = new Map<string, LedgerFetchEntry>();
const OPERATIONAL_LEDGER_TTL_MS = 60_000;

const fetchOperationalLedgerEntriesForAds = async (
  site: SiteKey,
  range?: DateRange,
): Promise<{ entries: AttributionLedgerEntry[]; warnings: string[] }> => {
  const cacheKey = `${site}|${range?.startDate ?? ""}|${range?.endDate ?? ""}`;
  const now = Date.now();
  const existing = operationalLedgerFetchCache.get(cacheKey);
  if (existing && now - existing.cachedAtMs < existing.ttlMs) {
    return existing.promise;
  }

  const doFetch = async (): Promise<{ entries: AttributionLedgerEntry[]; warnings: string[] }> => {
    const warnings: string[] = [];
    const url = new URL("/api/attribution/ledger", env.ATTRIBUTION_OPERATIONAL_BASE_URL);
    url.searchParams.set("source", `${site}_imweb`);
    url.searchParams.set("captureMode", "live");
    url.searchParams.set("limit", "10000");

    if (range) {
      url.searchParams.set("startAt", `${shiftIsoDateByDays(range.startDate, -1)}T00:00:00.000Z`);
      url.searchParams.set("endAt", `${shiftIsoDateByDays(range.endDate, 3)}T00:00:00.000Z`);
    }

    const response = await fetch(url.toString(), { signal: AbortSignal.timeout(15_000) });
    const body = await response.json() as Record<string, unknown>;
    if (!response.ok || body.ok !== true) {
      const message = typeof body.error === "string" ? body.error : response.statusText;
      throw new Error(`${site} 운영 VM ledger 조회 실패: ${message}`);
    }

    const items = Array.isArray(body.items) ? body.items : [];
    const summary = toObject(body.summary);
    const totalEntries = toNumber(summary.totalEntries);
    if (totalEntries > items.length) {
      warnings.push(`${site} 운영 VM ledger가 ${items.length}/${totalEntries}행만 반환했다. 더 긴 기간은 분할 조회가 필요하다.`);
    }
    return {
      entries: items.map(normalizeRemoteLedgerEntryForAds),
      warnings,
    };
  };

  const promise = doFetch().catch((err) => {
    // fail 도 즉시 cache 제거 — 다음 호출이 재시도 가능
    operationalLedgerFetchCache.delete(cacheKey);
    throw err;
  });
  operationalLedgerFetchCache.set(cacheKey, { promise, cachedAtMs: now, ttlMs: OPERATIONAL_LEDGER_TTL_MS });
  return promise;
};

const loadLocalLedgerOrders = async (
  requestedSource: AdsLedgerSourceRequest,
  warnings: string[] = [],
): Promise<LoadedAdsLedger> => {
  const entries = await readLedgerEntries();
  const businessConfirmedOrders = loadBusinessConfirmedImwebOrderMap();
  const orders = buildNormalizedLedgerOrders(entries, businessConfirmedOrders);
  return {
    entries,
    orders,
    dataSource: "local",
    requestedSource,
    warnings,
    freshness: buildLedgerFreshness(entries, orders),
  };
};

const loadOperationalLedgerOrders = async (
  options: AdsLedgerLoadOptions,
): Promise<LoadedAdsLedger> => {
  const requestedSource = options.source ?? "auto";
  const sites = [...new Set(options.sites?.length ? options.sites : SITE_ACCOUNTS.map((site) => site.site))];
  const warnings: string[] = [];
  const perSite = await Promise.allSettled(
    sites.map(async (site) => ({ site, ...(await fetchOperationalLedgerEntriesForAds(site, options.range)) })),
  );
  const entries: AttributionLedgerEntry[] = [];

  for (const result of perSite) {
    if (result.status === "fulfilled") {
      entries.push(...result.value.entries);
      warnings.push(...result.value.warnings);
    } else {
      warnings.push(result.reason instanceof Error ? result.reason.message : String(result.reason));
    }
  }

  const businessConfirmedOrders = loadBusinessConfirmedImwebOrderMap();
  const orders = buildNormalizedLedgerOrders(entries, businessConfirmedOrders, {
    trustConfirmedPaymentStatusAsBusinessConfirmed: true,
  });

  return {
    entries,
    orders,
    dataSource: "operational_vm",
    requestedSource,
    warnings,
    freshness: buildLedgerFreshness(entries, orders),
  };
};

const loadLedgerOrders = async (
  options: AdsLedgerLoadOptions = {},
): Promise<LoadedAdsLedger> => {
  const requestedSource = options.source ?? "auto";

  if (requestedSource === "local") {
    return loadLocalLedgerOrders(requestedSource);
  }

  try {
    const remote = await loadOperationalLedgerOrders({ ...options, source: requestedSource });
    if (remote.entries.length > 0 || requestedSource === "operational_vm") return remote;
    return loadLocalLedgerOrders(requestedSource, [
      ...remote.warnings,
      "운영 VM ledger row가 없어 로컬 attribution_ledger로 fallback했다.",
    ]);
  } catch (error) {
    if (requestedSource === "operational_vm") throw error;
    return loadLocalLedgerOrders(requestedSource, [
      error instanceof Error ? error.message : String(error),
      "운영 VM ledger 조회 실패로 로컬 attribution_ledger로 fallback했다.",
    ]);
  }
};

const ledgerQueryOptions = (
  req: Request,
  range: DateRange,
  sites: SiteKey[] = SITE_ACCOUNTS.map((site) => site.site),
): AdsLedgerLoadOptions => ({
  range,
  sites,
  source: parseAdsLedgerSource(req.query.ledger_source ?? req.query.data_source),
});

const describeLedgerSourceConfidence = (
  ledger: LoadedAdsLedger,
): { label: AdsSourceConfidence; reason: string } => {
  if (ledger.dataSource === "operational_vm" && ledger.freshness.entries > 0) {
    if (ledger.warnings.length > 0) {
      return {
        label: "B",
        reason: "운영 VM ledger를 사용했지만 일부 site/page warning이 있어 숫자 해석 시 확인 필요",
      };
    }
    return {
      label: "A",
      reason: "운영 VM attribution ledger read-only 기준이며 row가 존재함",
    };
  }

  if (ledger.requestedSource === "local") {
    return {
      label: "C",
      reason: "사용자가 local ledger를 명시 요청했으므로 stale cache 가능성 있음",
    };
  }

  if (ledger.dataSource === "local") {
    return {
      label: "D",
      reason: "운영 VM 조회 실패 또는 empty로 local cache fallback 사용",
    };
  }

  return {
    label: "D",
    reason: "ledger source 상태가 명확하지 않음",
  };
};

const buildMetaAttributionContext = (attributionWindow?: MetaAttributionWindow | null) => {
  if (attributionWindow) {
    return {
      meta_attribution_window: attributionWindow,
      meta_attribution_windows: [attributionWindow],
      meta_use_unified_attribution_setting: false,
    };
  }
  return {
    meta_attribution_window: "ads_manager_default",
    meta_attribution_windows: [...META_DEFAULT_ATTRIBUTION_WINDOWS],
    meta_use_unified_attribution_setting: META_DEFAULT_UNIFIED_ATTRIBUTION_SETTING,
  };
};

const ledgerResponseMeta = (
  ledger: LoadedAdsLedger,
  params: AdsResponseMetaParams = {},
) => {
  const queriedAt = new Date().toISOString();
  const confidence = describeLedgerSourceConfidence(ledger);
  const fallbackReason = ledger.requestedSource === "auto" && ledger.dataSource === "local"
    ? ledger.warnings.join(" / ") || "운영 VM ledger unavailable; local cache fallback"
    : null;
  const sourceMaxTimestamp = ledger.freshness.latestApprovedDate
    ?? ledger.freshness.latestLoggedAt
    ?? null;
  const dateRange = params.range
    ? {
      start_date: params.range.startDate,
      end_date: params.range.endDate,
      timezone: KST_TIMEZONE,
      inclusivity: "KST calendar dates inclusive",
    }
    : null;
  const metaAttributionContext = buildMetaAttributionContext(params.attributionWindow);

  return {
    queried_at: queriedAt,
    checked_at: queriedAt,
    timezone: KST_TIMEZONE,
    date_range: dateRange,
    account_id_context: params.accountId ?? null,
    site_context: params.site ?? null,
    ledger_source: ledger.dataSource,
    requested_ledger_source: ledger.requestedSource,
    source_confidence: confidence.label,
    source_confidence_reason: confidence.reason,
    source_max_timestamp: sourceMaxTimestamp,
    row_count: ledger.freshness.entries,
    order_count: ledger.freshness.orders,
    fallback_reason: fallbackReason,
    ledger_warnings: ledger.warnings,
    ledger_freshness: ledger.freshness,
    spend_source: "Meta Ads Insights API spend",
    currency: "KRW",
    rounding_rule: "API keeps numeric KRW values as numbers; UI rounds KRW display to whole won",
    date_preset_context: params.datePreset ?? null,
    meta_level: params.metaLevel ?? null,
    meta_fields: params.metaFields ?? null,
    meta_action_report_time: META_DEFAULT_ACTION_REPORT_TIME,
    ...metaAttributionContext,
    query_context: {
      queried_at: queriedAt,
      timezone: KST_TIMEZONE,
      date_range: dateRange,
      ledger_source: ledger.dataSource,
      requested_ledger_source: ledger.requestedSource,
      source_confidence: confidence.label,
      source_max_timestamp: sourceMaxTimestamp,
      row_count: ledger.freshness.entries,
      fallback_reason: fallbackReason,
      spend_source: "Meta Ads Insights API spend",
      currency: "KRW",
      rounding_rule: "API keeps numeric KRW values as numbers; UI rounds KRW display to whole won",
      meta_attribution_window: metaAttributionContext.meta_attribution_window,
      meta_attribution_windows: metaAttributionContext.meta_attribution_windows,
      meta_action_report_time: META_DEFAULT_ACTION_REPORT_TIME,
      meta_use_unified_attribution_setting: metaAttributionContext.meta_use_unified_attribution_setting,
    },
  };
};

type IroasMetaError = {
  site: SiteKey;
  account_id: string;
  error: string;
};

type IroasVariantRow = VariantSummary & {
  group: "control" | "treatment";
};

type ExperimentIroasSnapshot = {
  experiment_key: string;
  name: string;
  status: string;
  channel: string;
  start_date: string | null;
  end_date: string | null;
  site_scope: SiteKey[];
  variants: IroasVariantRow[];
  treatment_revenue: number;
  control_revenue: number;
  incremental_revenue: number;
  ad_spend: number;
  iroas: number | null;
  roas: number | null;
  treatment_count: number;
  control_count: number;
  treatment_purchase_rate: number;
  control_purchase_rate: number;
  treatment_purchaser_count: number;
  control_purchaser_count: number;
  treatment_purchase_count: number;
  control_purchase_count: number;
  meta_errors: IroasMetaError[];
};

const CONTROL_VARIANT_KEY = "control";

const round4 = (value: number) => Number(value.toFixed(4));

const isControlVariant = (variantKey: string) =>
  variantKey.trim().toLowerCase() === CONTROL_VARIANT_KEY;

const computeSpendRatio = (
  numerator: number,
  denominator: number,
  ready: boolean,
): number | null => {
  if (!ready || denominator <= 0) return null;
  return round2(numerator / denominator);
};

const dedupeMetaErrors = (errors: IroasMetaError[]) => {
  const byKey = new Map<string, IroasMetaError>();
  for (const error of errors) {
    const key = `${error.site}|${error.account_id}|${error.error}`;
    if (!byKey.has(key)) byKey.set(key, error);
  }
  return [...byKey.values()];
};

const inferExperimentSites = (experiment: Pick<
  CrmExperiment,
  "experiment_key" | "name" | "asset_id" | "lead_magnet_id"
>): SiteKey[] => {
  const haystack = [
    experiment.experiment_key,
    experiment.name,
    experiment.asset_id ?? "",
    experiment.lead_magnet_id ?? "",
  ].join(" ").toLowerCase();

  if (haystack.includes("coffee") || haystack.includes("커피")) {
    return ["thecleancoffee"];
  }
  if (
    haystack.includes("aibio")
    || haystack.includes("recoverylab")
    || haystack.includes("리커버리랩")
  ) {
    return ["aibio"];
  }
  if (
    haystack.includes("biocom")
    || haystack.includes("바이오컴")
    || haystack.includes("consult")
    || haystack.includes("상담")
    || haystack.includes("checkout")
    || haystack.includes("abandon")
    || haystack.includes("장바구니")
  ) {
    return ["biocom"];
  }

  return ["biocom"];
};

const resolveExperimentRangeFromWindow = (
  activityWindow: ExperimentActivityWindow | null,
): DateRange | null => {
  if (!activityWindow) return null;

  const startDate = normalizeDateLike(activityWindow.start_at ?? "");
  const endDate = normalizeDateLike(activityWindow.end_at ?? activityWindow.start_at ?? "");
  if (!startDate || !endDate) return null;

  return startDate <= endDate
    ? { startDate, endDate }
    : { startDate: endDate, endDate: startDate };
};

const sumVariantMetrics = (variants: VariantSummary[]) => {
  const totals = variants.reduce((sum, variant) => ({
    assignment_count: sum.assignment_count + variant.assignment_count,
    purchaser_count: sum.purchaser_count + variant.purchaser_count,
    purchase_count: sum.purchase_count + variant.purchase_count,
    net_revenue: sum.net_revenue + variant.net_revenue,
  }), {
    assignment_count: 0,
    purchaser_count: 0,
    purchase_count: 0,
    net_revenue: 0,
  });

  return {
    ...totals,
    net_revenue: round2(totals.net_revenue),
    purchase_rate: totals.assignment_count > 0
      ? round4(totals.purchaser_count / totals.assignment_count)
      : 0,
  };
};

const createMetaSpendLoader = () => {
  const cache = new Map<string, Promise<{
    ad_spend: number;
    site_scope: SiteKey[];
    meta_errors: IroasMetaError[];
  }>>();

  return (
    experiment: Pick<CrmExperiment, "experiment_key" | "name" | "asset_id" | "lead_magnet_id">,
    range: DateRange | null,
  ) => {
    const siteScope = inferExperimentSites(experiment);
    const cacheKey = `${siteScope.slice().sort().join(",")}|${range?.startDate ?? ""}|${range?.endDate ?? ""}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    const promise = (async () => {
      if (!range) {
        return { ad_spend: 0, site_scope: siteScope, meta_errors: [] };
      }

      const siteResults = await Promise.all(
        SITE_ACCOUNTS
          .filter((site) => siteScope.includes(site.site))
          .map((site) => fetchSiteMetaSummary({
            site: site.site,
            accountId: site.accountId,
            range,
            datePreset: null,
          })),
      );

      return {
        ad_spend: round2(siteResults.reduce((sum, site) => sum + site.spend, 0)),
        site_scope: siteScope,
        meta_errors: dedupeMetaErrors(
          siteResults
            .filter((site) => site.metaError)
            .map((site) => ({
              site: site.site,
              account_id: site.accountId,
              error: site.metaError ?? "Meta insights unavailable",
            })),
        ),
      };
    })();

    cache.set(cacheKey, promise);
    return promise;
  };
};

const buildExperimentIroasSnapshot = async (
  experiment: CrmExperiment,
  loadMetaSpend: ReturnType<typeof createMetaSpendLoader>,
): Promise<ExperimentIroasSnapshot> => {
  const result = getExperimentResults(experiment.experiment_key);
  const activityWindow = getExperimentActivityWindow(experiment.experiment_key);
  const range = resolveExperimentRangeFromWindow(activityWindow);
  const metaSpend = await loadMetaSpend(experiment, range);
  const variants: IroasVariantRow[] = result.variant_summary.map((variant) => ({
    ...variant,
    group: isControlVariant(variant.variant_key) ? "control" : "treatment",
  }));
  const controlTotals = sumVariantMetrics(variants.filter((variant) => variant.group === "control"));
  const treatmentTotals = sumVariantMetrics(variants.filter((variant) => variant.group === "treatment"));
  const hasComparableGroups = controlTotals.assignment_count > 0 && treatmentTotals.assignment_count > 0;
  const incrementalRevenue = round2(treatmentTotals.net_revenue - controlTotals.net_revenue);

  return {
    experiment_key: experiment.experiment_key,
    name: experiment.name,
    status: experiment.status,
    channel: experiment.channel,
    start_date: range?.startDate ?? null,
    end_date: range?.endDate ?? null,
    site_scope: metaSpend.site_scope,
    variants,
    treatment_revenue: treatmentTotals.net_revenue,
    control_revenue: controlTotals.net_revenue,
    incremental_revenue: incrementalRevenue,
    ad_spend: metaSpend.ad_spend,
    iroas: computeSpendRatio(incrementalRevenue, metaSpend.ad_spend, hasComparableGroups),
    roas: computeSpendRatio(
      treatmentTotals.net_revenue,
      metaSpend.ad_spend,
      treatmentTotals.assignment_count > 0,
    ),
    treatment_count: treatmentTotals.assignment_count,
    control_count: controlTotals.assignment_count,
    treatment_purchase_rate: treatmentTotals.purchase_rate,
    control_purchase_rate: controlTotals.purchase_rate,
    treatment_purchaser_count: treatmentTotals.purchaser_count,
    control_purchaser_count: controlTotals.purchaser_count,
    treatment_purchase_count: treatmentTotals.purchase_count,
    control_purchase_count: controlTotals.purchase_count,
    meta_errors: metaSpend.meta_errors,
  };
};

const loadExperimentIroasSnapshots = async () => {
  const experiments = listExperiments();
  const loadMetaSpend = createMetaSpendLoader();
  return Promise.all(experiments.map((experiment) => buildExperimentIroasSnapshot(experiment, loadMetaSpend)));
};

type PaidTrafficChannel = "tiktok" | "meta";

type PaidTrafficVmFunnel = {
  source: "TJ 관리 Attribution VM SQLite";
  storage: "CRM_LOCAL_DB_PATH#attribution_ledger";
  channel: PaidTrafficChannel;
  evidenceDefinition: string;
  marketingIntentRows: number;
  marketingIntentClients: number;
  checkoutStartedRows: number;
  checkoutStartedOrders: number;
  paymentSuccessRows: number;
  manualTestOrders: number;
  confirmedOrders: number;
  confirmedRevenue: number;
  pendingOrders: number;
  pendingRevenue: number;
  canceledOrders: number;
  canceledRevenue: number;
  sampleCheckoutOrders: Array<{
    loggedAt: string;
    orderKey: string;
    amount: number;
    reasons: string[];
  }>;
  sampleConfirmedOrders: Array<{
    loggedAt: string;
    orderKey: string;
    amount: number;
    reasons: string[];
  }>;
};

const kstDateForIso = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return KST_DATE_FORMATTER.format(parsed);
};

const entryInKstRange = (entry: AttributionLedgerEntry, range: DateRange) => {
  const date = kstDateForIso(entry.loggedAt);
  return Boolean(date) && date >= range.startDate && date <= range.endDate;
};

const metadataRecord = (value: unknown) => toObject(value);

const metadataStringArray = (metadata: Record<string, unknown>, key: string) => {
  const value = metadata[key];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
};

const getStoredFirstTouchReasons = (entry: AttributionLedgerEntry, channel: PaidTrafficChannel) => {
  const firstTouch = metadataRecord(entry.metadata.firstTouch);
  const firstTouchMatch = metadataRecord(entry.metadata.firstTouchMatch);
  const key = channel === "tiktok" ? "tiktokMatchReasons" : "metaMatchReasons";
  return [
    ...metadataStringArray(firstTouch, key).map((reason) => `firstTouch.${reason}`),
    ...metadataStringArray(firstTouchMatch, key).map((reason) => `firstTouchMatch.${reason}`),
    ...metadataStringArray(entry.metadata, channel === "tiktok" ? "tiktokFirstTouchMatchReasons" : "metaFirstTouchMatchReasons")
      .map((reason) => `metadata.${reason}`),
  ];
};

const getPaidChannelReasons = (entry: AttributionLedgerEntry, channel: PaidTrafficChannel) => {
  const direct = channel === "tiktok"
    ? getAttributionTikTokMatchReasons(entry)
    : getAttributionMetaMatchReasons(entry);
  return [...new Set([...direct, ...getStoredFirstTouchReasons(entry, channel)])].sort();
};

const amountFromLedgerEntry = (entry: AttributionLedgerEntry) => {
  const referrerPayment = toObject(entry.metadata.referrerPayment);
  return [
    entry.metadata.totalAmount,
    entry.metadata.total_amount,
    entry.metadata.value,
    entry.metadata.amount,
    entry.metadata.paymentAmount,
    entry.metadata.payment_amount,
    referrerPayment.totalAmount,
    referrerPayment.value,
    referrerPayment.amount,
  ].map(toNumber).find((value) => value > 0) ?? 0;
};

const orderKeyFromLedgerEntry = (entry: AttributionLedgerEntry) => {
  const referrerPayment = toObject(entry.metadata.referrerPayment);
  return firstNonEmpty([
    normalizeOrderIdBase(entry.orderId),
    normalizeOrderIdBase(firstMetadataString(entry.metadata, ["orderIdBase", "orderNo", "order_no", "order_code"])),
    normalizeOrderIdBase(safeRemoteString(referrerPayment.orderNo)),
    normalizeOrderIdBase(safeRemoteString(referrerPayment.orderId)),
    entry.paymentKey,
    entry.checkoutId,
  ]);
};

const clientKeyFromLedgerEntry = (entry: AttributionLedgerEntry) => firstNonEmpty([
  firstMetadataString(entry.metadata, ["clientId", "userPseudoId", "gaClientId"]),
  entry.gaSessionId,
  entry.customerKey,
  entry.requestContext.ip,
]);

const hashManualTestKey = (value: string) => createHash("sha256").update(value).digest("hex").slice(0, 16);

const isManualPaidTrafficTestEntry = (entry: AttributionLedgerEntry, orderKey: string) => {
  const knownManualOrderKeyHashes = new Set([
    "35606607e09666d7",
    "37dded9748aab2c7",
    "273fc10424556dc2",
    "876be2ae6ffa901f",
  ]);
  if (
    knownManualOrderKeyHashes.has(hashManualTestKey(orderKey)) ||
    knownManualOrderKeyHashes.has(hashManualTestKey(normalizeOrderIdBase(entry.orderId)))
  ) {
    return true;
  }

  const text = [
    entry.utmSource,
    entry.utmMedium,
    entry.utmCampaign,
    entry.utmContent,
    entry.utmTerm,
    entry.landing,
    entry.referrer,
    JSON.stringify(entry.metadata),
  ].join(" ").toLowerCase();

  return [
    "codex_",
    "codex-",
    "vm_smoke",
    "smoke_test",
    "manual_browser_test",
    "gtm_live",
    "gtm_test",
    "card_test",
    "test events smoke",
  ].some((needle) => text.includes(needle));
};

const buildPaidTrafficVmFunnel = (
  entries: AttributionLedgerEntry[],
  range: DateRange,
  channel: PaidTrafficChannel,
): PaidTrafficVmFunnel => {
  const marketingIntentClients = new Set<string>();
  const checkoutOrders = new Set<string>();
  const manualTestOrders = new Set<string>();
  const confirmedOrders = new Set<string>();
  const pendingOrders = new Set<string>();
  const canceledOrders = new Set<string>();
  let marketingIntentRows = 0;
  let checkoutStartedRows = 0;
  let paymentSuccessRows = 0;
  let confirmedRevenue = 0;
  let pendingRevenue = 0;
  let canceledRevenue = 0;
  const sampleCheckoutOrders: PaidTrafficVmFunnel["sampleCheckoutOrders"] = [];
  const sampleConfirmedOrders: PaidTrafficVmFunnel["sampleConfirmedOrders"] = [];

  for (const entry of entries) {
    if (!entryInKstRange(entry, range)) continue;
    const reasons = getPaidChannelReasons(entry, channel);
    if (reasons.length === 0) continue;

    const orderKey = orderKeyFromLedgerEntry(entry);
    const amount = amountFromLedgerEntry(entry);
    const manualTest = isManualPaidTrafficTestEntry(entry, orderKey);
    if (manualTest && orderKey) manualTestOrders.add(orderKey);

    if (entry.touchpoint === "marketing_intent") {
      if (manualTest) continue;
      marketingIntentRows += 1;
      const clientKey = clientKeyFromLedgerEntry(entry);
      if (clientKey) marketingIntentClients.add(clientKey);
    }

    if (entry.touchpoint === "checkout_started") {
      if (manualTest) continue;
      checkoutStartedRows += 1;
      if (orderKey) checkoutOrders.add(orderKey);
      if (sampleCheckoutOrders.length < 5) {
        sampleCheckoutOrders.push({ loggedAt: entry.loggedAt, orderKey: orderKey || "-", amount, reasons });
      }
    }

    if (entry.touchpoint === "payment_success") {
      if (manualTest) continue;
      paymentSuccessRows += 1;
      if (entry.paymentStatus === "confirmed") {
        if (orderKey) confirmedOrders.add(orderKey);
        confirmedRevenue += amount;
        if (sampleConfirmedOrders.length < 5) {
          sampleConfirmedOrders.push({ loggedAt: entry.loggedAt, orderKey: orderKey || "-", amount, reasons });
        }
      } else if (entry.paymentStatus === "pending") {
        if (orderKey) pendingOrders.add(orderKey);
        pendingRevenue += amount;
      } else if (entry.paymentStatus === "canceled") {
        if (orderKey) canceledOrders.add(orderKey);
        canceledRevenue += amount;
      }
    }
  }

  return {
    source: "TJ 관리 Attribution VM SQLite",
    storage: "CRM_LOCAL_DB_PATH#attribution_ledger",
    channel,
    evidenceDefinition: channel === "tiktok"
      ? "ttclid 또는 TikTok UTM/referrer/firstTouch evidence"
      : "fbclid/fbc/fbp 또는 Meta/Facebook/Instagram UTM/referrer/firstTouch evidence",
    marketingIntentRows,
    marketingIntentClients: marketingIntentClients.size,
    checkoutStartedRows,
    checkoutStartedOrders: checkoutOrders.size,
    paymentSuccessRows,
    manualTestOrders: manualTestOrders.size,
    confirmedOrders: confirmedOrders.size,
    confirmedRevenue: Math.round(confirmedRevenue),
    pendingOrders: pendingOrders.size,
    pendingRevenue: Math.round(pendingRevenue),
    canceledOrders: canceledOrders.size,
    canceledRevenue: Math.round(canceledRevenue),
    sampleCheckoutOrders,
    sampleConfirmedOrders,
  };
};

type TikTokOffImpactChannelKey =
  | "paid_meta"
  | "meta_pixel_only"
  | "paid_google"
  | "paid_tiktok"
  | "paid_naver"
  | "organic_search"
  | "organic_social"
  | "direct"
  | "referral"
  | "self_internal"
  | "unknown";

type TikTokOffImpactMetric = {
  days: number;
  orders: number;
  revenue: number;
  ordersPerDay: number;
  revenuePerDay: number;
};

type TikTokOffImpactChannelRow = {
  channel: TikTokOffImpactChannelKey;
  label: string;
  explanation: string;
  confidence: "high" | "medium" | "low";
  baseline: TikTokOffImpactMetric;
  off: TikTokOffImpactMetric;
  deltaOrdersPerDay: number;
  deltaRevenuePerDay: number;
  deltaRevenuePct: number | null;
  shareOfObservedDropPct: number | null;
};

type TikTokOffImpactGa4ChannelRow = {
  channel: TikTokOffImpactChannelKey;
  label: string;
  baseline: {
    sessions: number;
    purchases: number;
    revenue: number;
    sessionsPerDay: number;
    revenuePerDay: number;
  };
  off: {
    sessions: number;
    purchases: number;
    revenue: number;
    sessionsPerDay: number;
    revenuePerDay: number;
  };
  deltaRevenuePerDay: number;
  deltaSessionsPerDay: number;
};

type TikTokOffImpactAuditItem = {
  item: string;
  answer: "낮음" | "중간" | "높음" | "남아있음";
  score: number;
  evidence: string;
  whatItMeans: string;
};

type OperationalCoopRangeSummary = {
  days: number;
  rows: number;
  groupBuys: number;
  grossAmount: number;
  grossAmountPerDay: number;
  includedRows: number;
  includedAmount: number;
  includedAmountPerDay: number;
  excludedRows: number;
  excludedAmount: number;
  topGroups: Array<{
    groupBuyId: number;
    title: string;
    rows: number;
    amount: number;
    amountPerDay: number;
  }>;
};

type OperationalCoopImpactSummary = {
  status: "included" | "unavailable";
  source: string;
  sourceLocation: "operational_db";
  baseline: OperationalCoopRangeSummary;
  off: OperationalCoopRangeSummary;
  deltaRows: number;
  deltaIncludedAmountPerDay: number;
  deltaIncludedAmountPct: number | null;
  shareOfObservedDropPct: number | null;
  nonCoopDeltaRevenuePerDay: number | null;
  warnings: string[];
};

const TIKTOK_OFF_DEFAULT_BASELINE: DateRange = { startDate: "2026-05-01", endDate: "2026-05-07" };
const TIKTOK_OFF_DEFAULT_OFF: DateRange = { startDate: "2026-05-08", endDate: "2026-05-12" };
const TIKTOK_OFF_IMPACT_CACHE_PATH = path.join(DATA_DIR, "tiktok-off-impact-audit-cache.json");
const TIKTOK_OFF_IMPACT_CACHE_VERSION = 2;
const TIKTOK_ADS_DAILY_PROCESSED_DIR = path.resolve(
  process.cwd(),
  "..",
  "data",
  "ads_csv",
  "tiktok",
  "processed",
);

type TikTokOffImpactAdsSummary = {
  spend: number;
  platformPurchases: number;
  platformPurchaseValue: number;
  platformRoas: number | null;
  rows: number;
  files: number;
  source: string;
  warnings: string[];
};

type AttributionLedgerDbRowForAds = {
  touchpoint: string;
  capture_mode: string;
  payment_status: string | null;
  logged_at: string;
  order_id: string;
  payment_key: string;
  approved_at: string;
  checkout_id: string;
  customer_key: string;
  landing: string;
  referrer: string;
  ga_session_id: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_term: string;
  utm_content: string;
  gclid: string;
  fbclid: string;
  ttclid: string;
  source: string;
  metadata_json: string;
  request_context_json: string;
};

const OFF_CHANNEL_LABELS: Record<TikTokOffImpactChannelKey, { label: string; explanation: string }> = {
  paid_meta: {
    label: "Meta 광고",
    explanation: "Meta 클릭 식별자 또는 Meta paid UTM 근거가 붙은 결제완료",
  },
  meta_pixel_only: {
    label: "Meta 픽셀 흔적",
    explanation: "fbp 등 픽셀 쿠키만 있어 Meta 광고 성과로 확정하지 않는 결제완료",
  },
  paid_google: {
    label: "Google 광고",
    explanation: "Google 클릭 식별자 또는 Google paid UTM 근거가 붙은 결제완료",
  },
  paid_tiktok: {
    label: "TikTok 광고",
    explanation: "TikTok 클릭 식별자 또는 TikTok UTM/referrer/firstTouch 근거가 붙은 결제완료",
  },
  paid_naver: {
    label: "Naver 광고 후보",
    explanation: "nclick 또는 Naver paid UTM 근거가 붙은 결제완료",
  },
  organic_search: {
    label: "자연 검색",
    explanation: "Google/Naver/Daum/Bing 등 검색 referrer 또는 organic UTM 결제완료",
  },
  organic_social: {
    label: "자연 소셜",
    explanation: "광고 클릭 ID 없이 Instagram/Facebook/TikTok 등 소셜 referrer로 들어온 결제완료",
  },
  direct: {
    label: "직접/미식별",
    explanation: "referrer와 광고 식별자가 없어서 직접 방문 또는 미식별로 남은 결제완료",
  },
  referral: {
    label: "외부 추천",
    explanation: "검색/소셜/자기 도메인이 아닌 외부 referrer 결제완료",
  },
  self_internal: {
    label: "사이트 내부 이동",
    explanation: "자기 도메인 referrer만 남아 최초 유입이 가려진 결제완료",
  },
  unknown: {
    label: "기타/분류 보류",
    explanation: "현재 룰로 채널을 안전하게 분류하지 못한 결제완료",
  },
};

const SEARCH_ENGINE_NEEDLES = ["google", "naver", "daum", "bing", "yahoo", "duckduckgo"];
const SOCIAL_NEEDLES = ["instagram", "facebook", "meta", "tiktok", "threads", "youtube", "twitter", "x.com"];
const PAID_NEEDLES = ["cpc", "paid", "ads", "sem", "ppc", "paid_social", "paid_search", "powerlink"];

const parseOptionalDateRange = (
  startValue: unknown,
  endValue: unknown,
  fallback: DateRange,
  startLabel: string,
  endLabel: string,
) => {
  const startDate = typeof startValue === "string" && startValue.trim()
    ? parseIsoDateParam(startValue, startLabel)
    : fallback.startDate;
  const endDate = typeof endValue === "string" && endValue.trim()
    ? parseIsoDateParam(endValue, endLabel)
    : fallback.endDate;
  return ensureValidDateRange(startDate, endDate);
};

const eachIsoDateInRange = (range: DateRange) => {
  const dates: string[] = [];
  let cursor = range.startDate;
  while (cursor <= range.endDate) {
    dates.push(cursor);
    cursor = shiftIsoDateByDays(cursor, 1);
  }
  return dates;
};

const daysInRange = (range: DateRange) => eachIsoDateInRange(range).length;

const waitMs = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const tiktokOffImpactCacheKey = (baselineRange: DateRange, offRange: DateRange) =>
  `${baselineRange.startDate}_${baselineRange.endDate}__${offRange.startDate}_${offRange.endDate}`;

const readTikTokOffImpactCacheFile = async (): Promise<{
  version: number;
  records: Record<string, { generatedAt: string; payload: Record<string, unknown> }>;
}> => {
  try {
    const raw = await fs.readFile(TIKTOK_OFF_IMPACT_CACHE_PATH, "utf-8");
    const parsed = JSON.parse(raw) as {
      version?: number;
      records?: Record<string, { generatedAt: string; payload: Record<string, unknown> }>;
    };
    if (parsed.version !== TIKTOK_OFF_IMPACT_CACHE_VERSION) {
      return { version: TIKTOK_OFF_IMPACT_CACHE_VERSION, records: {} };
    }
    return {
      version: parsed.version ?? TIKTOK_OFF_IMPACT_CACHE_VERSION,
      records: parsed.records ?? {},
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { version: TIKTOK_OFF_IMPACT_CACHE_VERSION, records: {} };
    }
    throw error;
  }
};

const readTikTokOffImpactCache = async (key: string) => {
  const cache = await readTikTokOffImpactCacheFile();
  return cache.records[key] ?? null;
};

const writeTikTokOffImpactCache = async (key: string, payload: Record<string, unknown>) => {
  const cache = await readTikTokOffImpactCacheFile();
  const generatedAt = new Date().toISOString();
  cache.records[key] = { generatedAt, payload };
  await fs.mkdir(path.dirname(TIKTOK_OFF_IMPACT_CACHE_PATH), { recursive: true });
  await fs.writeFile(
    TIKTOK_OFF_IMPACT_CACHE_PATH,
    `${JSON.stringify({ version: TIKTOK_OFF_IMPACT_CACHE_VERSION, records: cache.records }, null, 2)}\n`,
  );
  return generatedAt;
};

const splitCsvLine = (line: string) => {
  const values: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  values.push(current);
  return values;
};

const parseCsvRecords = (raw: string) => {
  const lines = raw.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]).map((header) => header.trim());
  return lines.slice(1).map((line) => {
    const values = splitCsvLine(line);
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      record[header] = values[index]?.trim() ?? "";
    });
    return record;
  });
};

const readTikTokAdsDailySummaryFromCsv = async (
  range: DateRange,
): Promise<TikTokOffImpactAdsSummary> => {
  const warnings: string[] = [];
  let names: string[] = [];
  try {
    names = await fs.readdir(TIKTOK_ADS_DAILY_PROCESSED_DIR);
  } catch (error) {
    warnings.push(`TikTok Ads processed CSV directory missing: ${(error as Error).message}`);
  }

  const files = names
    .filter((name) => /^\d{8}_\d{8}_daily_campaign\.csv$/.test(name))
    .sort();
  const rowsByKey = new Map<string, Record<string, string>>();

  for (const file of files) {
    try {
      const raw = await fs.readFile(path.join(TIKTOK_ADS_DAILY_PROCESSED_DIR, file), "utf-8");
      for (const row of parseCsvRecords(raw)) {
        const reportDate = row.report_date;
        const campaignId = row.campaign_id || row.campaign_name || "unknown";
        if (!/^\d{4}-\d{2}-\d{2}$/.test(reportDate)) continue;
        if (reportDate < range.startDate || reportDate > range.endDate) continue;
        rowsByKey.set(`${reportDate}__${campaignId}`, row);
      }
    } catch (error) {
      warnings.push(`TikTok Ads processed CSV read failed: ${file}: ${(error as Error).message}`);
    }
  }

  let spend = 0;
  let platformPurchases = 0;
  let platformPurchaseValue = 0;
  for (const row of rowsByKey.values()) {
    spend += toNumber(row.spend);
    platformPurchases += toNumber(row.purchase_count);
    platformPurchaseValue += toNumber(row.purchase_value);
  }

  if (files.length === 0) {
    warnings.push("TikTok Ads processed CSV source is empty; spend/platform claim set to 0.");
  } else if (rowsByKey.size === 0) {
    warnings.push(`TikTok Ads processed CSV has no rows for ${range.startDate}~${range.endDate}.`);
  }

  return {
    spend: Math.round(spend),
    platformPurchases: Math.round(platformPurchases),
    platformPurchaseValue: Math.round(platformPurchaseValue),
    platformRoas: spend > 0 ? round2(platformPurchaseValue / spend) : null,
    rows: rowsByKey.size,
    files: files.length,
    source: "repo data/ads_csv/tiktok/processed daily_campaign CSV read-only",
    warnings,
  };
};

const withTikTokOffImpactCacheMeta = (
  payload: Record<string, unknown>,
  cache: Record<string, unknown>,
) => ({
  ...payload,
  cache,
});

const fetchRemoteJsonWithRetry = async (
  url: URL,
  context: string,
  attempts = 3,
): Promise<Record<string, unknown>> => {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url.toString(), {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(45_000),
      });
      const text = await response.text();
      let body: Record<string, unknown>;
      try {
        body = JSON.parse(text) as Record<string, unknown>;
      } catch {
        throw new Error(`${context} non_json_response_${response.status}`);
      }
      if (!response.ok || body.ok !== true) {
        const message = typeof body.error === "string" ? body.error : response.statusText;
        throw new Error(`${context} ${message || `http_${response.status}`}`);
      }
      return body;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await waitMs(450 * attempt);
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`${context} failed`);
};

const fetchOperationalLedgerEntriesForAdsByDay = async (
  site: SiteKey,
  range: DateRange,
): Promise<{ entries: AttributionLedgerEntry[]; warnings: string[] }> => {
  const entries: AttributionLedgerEntry[] = [];
  const warnings: string[] = [];

  for (const date of eachIsoDateInRange(range)) {
    const url = new URL("/api/attribution/ledger", env.ATTRIBUTION_OPERATIONAL_BASE_URL);
    url.searchParams.set("source", `${site}_imweb`);
    url.searchParams.set("captureMode", "live");
    url.searchParams.set("limit", "10000");
    url.searchParams.set("startAt", `${shiftIsoDateByDays(date, -1)}T15:00:00.000Z`);
    url.searchParams.set("endAt", `${date}T15:00:00.000Z`);

    const body = await fetchRemoteJsonWithRetry(url, `${site} VM Cloud ledger ${date}`);

    const items = Array.isArray(body.items) ? body.items : [];
    const summary = toObject(body.summary);
    const totalEntries = toNumber(summary.totalEntries);
    if (totalEntries > items.length) {
      warnings.push(`${date} VM Cloud ledger가 ${items.length}/${totalEntries}행만 반환했다.`);
    }
    entries.push(...items.map(normalizeRemoteLedgerEntryForAds));
  }

  return { entries, warnings };
};

const parseJsonObjectForAds = (raw: string): Record<string, unknown> => {
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
};

const normalizeLedgerDbRowForAds = (row: AttributionLedgerDbRowForAds): AttributionLedgerEntry => ({
  touchpoint:
    row.touchpoint === "marketing_intent"
      ? "marketing_intent"
      : row.touchpoint === "payment_success"
        ? "payment_success"
        : row.touchpoint === "form_submit"
          ? "form_submit"
          : "checkout_started",
  captureMode:
    row.capture_mode === "replay"
      ? "replay"
      : row.capture_mode === "smoke"
        ? "smoke"
        : "live",
  paymentStatus:
    row.payment_status === "confirmed"
      ? "confirmed"
      : row.payment_status === "canceled"
        ? "canceled"
        : row.payment_status === "pending"
          ? "pending"
          : null,
  loggedAt: row.logged_at,
  orderId: row.order_id,
  paymentKey: row.payment_key,
  approvedAt: row.approved_at,
  checkoutId: row.checkout_id,
  customerKey: row.customer_key,
  landing: row.landing,
  referrer: row.referrer,
  gaSessionId: row.ga_session_id,
  utmSource: row.utm_source,
  utmMedium: row.utm_medium,
  utmCampaign: row.utm_campaign,
  utmTerm: row.utm_term,
  utmContent: row.utm_content,
  gclid: row.gclid,
  fbclid: row.fbclid,
  ttclid: row.ttclid,
  metadata: {
    ...parseJsonObjectForAds(row.metadata_json),
    source: row.source,
  },
  requestContext: {
    ip: "",
    userAgent: "",
    origin: "",
    requestReferer: "",
    method: "",
    path: "",
    ...parseJsonObjectForAds(row.request_context_json),
  } as AttributionLedgerEntry["requestContext"],
});

const readOperationalLedgerEntriesForAds = async (
  site: SiteKey,
  range: DateRange,
): Promise<{ entries: AttributionLedgerEntry[]; warnings: string[] }> => {
  const source = `${site}_imweb`;
  const startAt = `${shiftIsoDateByDays(range.startDate, -1)}T15:00:00.000Z`;
  const endAt = `${range.endDate}T15:00:00.000Z`;
  const db = getCrmDb();
  const rows = db.prepare(`
    SELECT
      touchpoint, capture_mode, payment_status, logged_at,
      order_id, payment_key, approved_at, checkout_id, customer_key,
      landing, referrer, ga_session_id, utm_source, utm_medium,
      utm_campaign, utm_term, utm_content, gclid, fbclid, ttclid,
      source, metadata_json, request_context_json
    FROM attribution_ledger
    WHERE source = @source
      AND capture_mode = 'live'
      AND logged_at >= @startAt
      AND logged_at < @endAt
    ORDER BY logged_at DESC, rowid DESC
  `).all({ source, startAt, endAt }) as AttributionLedgerDbRowForAds[];

  return {
    entries: rows.map(normalizeLedgerDbRowForAds),
    warnings: [],
  };
};

const emptyOperationalCoopRangeSummary = (range: DateRange): OperationalCoopRangeSummary => {
  const days = daysInRange(range);
  return {
    days,
    rows: 0,
    groupBuys: 0,
    grossAmount: 0,
    grossAmountPerDay: 0,
    includedRows: 0,
    includedAmount: 0,
    includedAmountPerDay: 0,
    excludedRows: 0,
    excludedAmount: 0,
    topGroups: [],
  };
};

const readOperationalCoopRangeSummary = async (
  range: DateRange,
): Promise<OperationalCoopRangeSummary> => {
  const days = daysInRange(range);
  const total = await queryPg<{
    rows: number;
    group_buys: number;
    gross_amount: string | number | null;
    included_rows: number;
    included_amount: string | number | null;
    excluded_rows: number;
    excluded_amount: string | number | null;
  }>(`
    WITH normalized AS (
      SELECT
        c.group_buy_id,
        COALESCE(c.total_amount, c.order_amount, 0) AS amount,
        COALESCE(c.order_status, '') AS order_status,
        CASE
          WHEN c.order_date ~ '^\\d{4}-\\d{2}-\\d{2}' THEN substring(c.order_date FROM 1 FOR 10)::date
          WHEN c.created_at IS NOT NULL THEN c.created_at::date
          ELSE NULL
        END AS order_day
      FROM public.tb_influencer_group_buy_customer c
    )
    SELECT
      COUNT(*)::int AS rows,
      COUNT(DISTINCT group_buy_id)::int AS group_buys,
      COALESCE(SUM(amount), 0)::bigint AS gross_amount,
      COUNT(*) FILTER (WHERE order_status NOT IN ('cancelled', 'refunded'))::int AS included_rows,
      COALESCE(SUM(amount) FILTER (WHERE order_status NOT IN ('cancelled', 'refunded')), 0)::bigint AS included_amount,
      COUNT(*) FILTER (WHERE order_status IN ('cancelled', 'refunded'))::int AS excluded_rows,
      COALESCE(SUM(amount) FILTER (WHERE order_status IN ('cancelled', 'refunded')), 0)::bigint AS excluded_amount
    FROM normalized
    WHERE order_day BETWEEN $1::date AND $2::date
  `, [range.startDate, range.endDate]);

  const groups = await queryPg<{
    group_buy_id: number;
    title: string | null;
    rows: number;
    amount: string | number | null;
  }>(`
    WITH normalized AS (
      SELECT
        c.group_buy_id,
        COALESCE(c.total_amount, c.order_amount, 0) AS amount,
        COALESCE(c.order_status, '') AS order_status,
        CASE
          WHEN c.order_date ~ '^\\d{4}-\\d{2}-\\d{2}' THEN substring(c.order_date FROM 1 FOR 10)::date
          WHEN c.created_at IS NOT NULL THEN c.created_at::date
          ELSE NULL
        END AS order_day
      FROM public.tb_influencer_group_buy_customer c
    )
    SELECT
      g.id AS group_buy_id,
      g.title,
      COUNT(*)::int AS rows,
      COALESCE(SUM(n.amount), 0)::bigint AS amount
    FROM normalized n
    JOIN public.tb_influencer_group_buy g ON g.id = n.group_buy_id
    WHERE n.order_day BETWEEN $1::date AND $2::date
      AND n.order_status NOT IN ('cancelled', 'refunded')
    GROUP BY g.id, g.title
    ORDER BY amount DESC
    LIMIT 8
  `, [range.startDate, range.endDate]);

  const row = total.rows[0];
  const grossAmount = Math.round(toNumber(row?.gross_amount));
  const includedAmount = Math.round(toNumber(row?.included_amount));
  const excludedAmount = Math.round(toNumber(row?.excluded_amount));

  return {
    days,
    rows: Number(row?.rows ?? 0),
    groupBuys: Number(row?.group_buys ?? 0),
    grossAmount,
    grossAmountPerDay: Math.round(grossAmount / Math.max(days, 1)),
    includedRows: Number(row?.included_rows ?? 0),
    includedAmount,
    includedAmountPerDay: Math.round(includedAmount / Math.max(days, 1)),
    excludedRows: Number(row?.excluded_rows ?? 0),
    excludedAmount,
    topGroups: groups.rows.map((group) => {
      const amount = Math.round(toNumber(group.amount));
      return {
        groupBuyId: Number(group.group_buy_id),
        title: group.title || `group_buy_${group.group_buy_id}`,
        rows: Number(group.rows ?? 0),
        amount,
        amountPerDay: Math.round(amount / Math.max(days, 1)),
      };
    }),
  };
};

const buildOperationalCoopImpactSummary = async (
  baselineRange: DateRange,
  offRange: DateRange,
  overallDeltaRevenuePerDay: number | null,
): Promise<OperationalCoopImpactSummary> => {
  const source = "operational_db.public.tb_influencer_group_buy_customer read-only";
  const warnings: string[] = [];

  if (!isDatabaseConfigured()) {
    warnings.push("operational_db_not_configured");
    return {
      status: "unavailable",
      source,
      sourceLocation: "operational_db",
      baseline: emptyOperationalCoopRangeSummary(baselineRange),
      off: emptyOperationalCoopRangeSummary(offRange),
      deltaRows: 0,
      deltaIncludedAmountPerDay: 0,
      deltaIncludedAmountPct: null,
      shareOfObservedDropPct: null,
      nonCoopDeltaRevenuePerDay: overallDeltaRevenuePerDay,
      warnings,
    };
  }

  try {
    const [baseline, off] = await Promise.all([
      readOperationalCoopRangeSummary(baselineRange),
      readOperationalCoopRangeSummary(offRange),
    ]);
    const deltaIncludedAmountPerDay = off.includedAmountPerDay - baseline.includedAmountPerDay;
    const observedDrop = overallDeltaRevenuePerDay != null && overallDeltaRevenuePerDay < 0
      ? Math.abs(overallDeltaRevenuePerDay)
      : 0;
    return {
      status: "included",
      source,
      sourceLocation: "operational_db",
      baseline,
      off,
      deltaRows: off.includedRows - baseline.includedRows,
      deltaIncludedAmountPerDay,
      deltaIncludedAmountPct: baseline.includedAmountPerDay > 0
        ? round2((deltaIncludedAmountPerDay / baseline.includedAmountPerDay) * 100)
        : null,
      shareOfObservedDropPct: observedDrop > 0 && deltaIncludedAmountPerDay < 0
        ? round2((Math.abs(deltaIncludedAmountPerDay) / observedDrop) * 100)
        : null,
      nonCoopDeltaRevenuePerDay: overallDeltaRevenuePerDay == null
        ? null
        : overallDeltaRevenuePerDay - deltaIncludedAmountPerDay,
      warnings,
    };
  } catch (error) {
    warnings.push(`operational_db_coop_query_failed: ${error instanceof Error ? error.message : String(error)}`);
    return {
      status: "unavailable",
      source,
      sourceLocation: "operational_db",
      baseline: emptyOperationalCoopRangeSummary(baselineRange),
      off: emptyOperationalCoopRangeSummary(offRange),
      deltaRows: 0,
      deltaIncludedAmountPerDay: 0,
      deltaIncludedAmountPct: null,
      shareOfObservedDropPct: null,
      nonCoopDeltaRevenuePerDay: overallDeltaRevenuePerDay,
      warnings,
    };
  }
};

const includeText = (value: unknown, needles: string[]) => {
  const text = typeof value === "string" ? value.toLowerCase() : "";
  return Boolean(text && needles.some((needle) => text.includes(needle)));
};

const urlParamPresent = (values: string[], keys: string[]) =>
  keys.some((key) => values.some((value) => Boolean(extractUrlParam(value, key))));

const hostContainsAny = (values: string[], needles: string[]) =>
  values.some((value) => includeText(resolveHost(value), needles));

const hasStrongMetaPaidSignal = (entry: AttributionLedgerEntry) => {
  const reasons = getPaidChannelReasons(entry, "meta");
  const values = evidenceTextValues(entry);
  const urls = [entry.landing, entry.referrer, entry.requestContext.requestReferer].filter(Boolean);
  const medium = [
    entry.utmMedium,
    firstMetadataString(entry.metadata, ["utmMedium", "utm_medium", "medium"]),
  ].join(" ").toLowerCase();
  const source = [
    entry.utmSource,
    firstMetadataString(entry.metadata, ["utmSource", "utm_source", "source"]),
  ].join(" ").toLowerCase();

  return (
    reasons.some((reason) => reason.includes("fbclid") || reason.includes("fbc"))
    || urlParamPresent(urls, ["fbclid", "fbc"])
    || (includeText(source, ["meta", "facebook", "instagram"]) && includeText(medium, PAID_NEEDLES))
    || values.some((value) => {
      const text = String(value).toLowerCase();
      return (
        (text.includes("utm_source=meta") || text.includes("utm_source=facebook") || text.includes("utm_source=instagram"))
        && PAID_NEEDLES.some((needle) => text.includes(`utm_medium=${needle}`) || text.includes(`medium=${needle}`))
      );
    })
  );
};

const firstTouchObject = (entry: AttributionLedgerEntry) => ({
  firstTouch: toObject(entry.metadata.firstTouch),
  firstTouchMatch: toObject(entry.metadata.firstTouchMatch),
});

const evidenceTextValues = (entry: AttributionLedgerEntry) => {
  const { firstTouch, firstTouchMatch } = firstTouchObject(entry);
  const referrerPayment = toObject(entry.metadata.referrerPayment);
  return [
    entry.utmSource,
    entry.utmMedium,
    entry.utmCampaign,
    entry.utmContent,
    entry.utmTerm,
    entry.landing,
    entry.referrer,
    entry.gclid,
    entry.fbclid,
    entry.ttclid,
    firstMetadataString(entry.metadata, ["utmSource", "utm_source", "source", "medium", "campaign", "landing", "url"]),
    firstMetadataString(referrerPayment, ["source", "medium", "campaign", "landing", "url"]),
    firstMetadataString(firstTouch, ["utmSource", "utm_source", "utmMedium", "utm_medium", "utmCampaign", "utm_campaign", "landing", "referrer", "ttclid", "gclid", "fbclid"]),
    firstMetadataString(firstTouchMatch, ["utmSource", "utm_source", "utmMedium", "utm_medium", "utmCampaign", "utm_campaign", "landing", "referrer", "ttclid", "gclid", "fbclid"]),
  ].filter(Boolean);
};

const classifyPaymentEntryChannel = (entry: AttributionLedgerEntry): {
  channel: TikTokOffImpactChannelKey;
  confidence: "high" | "medium" | "low";
} => {
  const values = evidenceTextValues(entry);
  const joined = values.join(" ").toLowerCase();
  const urls = [entry.landing, entry.referrer, entry.requestContext.requestReferer].filter(Boolean);
  const medium = [
    entry.utmMedium,
    firstMetadataString(entry.metadata, ["utmMedium", "utm_medium", "medium"]),
  ].join(" ").toLowerCase();
  const source = [
    entry.utmSource,
    firstMetadataString(entry.metadata, ["utmSource", "utm_source", "source"]),
  ].join(" ").toLowerCase();

  if (getPaidChannelReasons(entry, "tiktok").length > 0) {
    return { channel: "paid_tiktok", confidence: "high" };
  }
  if (hasStrongMetaPaidSignal(entry)) {
    return { channel: "paid_meta", confidence: "high" };
  }
  if (
    Boolean(entry.gclid.trim())
    || urlParamPresent(urls, ["gclid", "gbraid", "wbraid"])
    || (includeText(source, ["google"]) && includeText(medium, PAID_NEEDLES))
  ) {
    return { channel: "paid_google", confidence: "high" };
  }
  if (
    urlParamPresent(urls, ["nclick_id", "n_media", "n_query"])
    || (includeText(source, ["naver"]) && includeText(medium, PAID_NEEDLES))
  ) {
    return { channel: "paid_naver", confidence: "medium" };
  }
  if (includeText(medium, ["organic", "organic_search"]) || hostContainsAny([entry.referrer, entry.landing], SEARCH_ENGINE_NEEDLES)) {
    return { channel: "organic_search", confidence: "medium" };
  }
  if (hostContainsAny([entry.referrer], SOCIAL_NEEDLES) || (SOCIAL_NEEDLES.some((needle) => joined.includes(needle)) && !includeText(medium, PAID_NEEDLES))) {
    return { channel: "organic_social", confidence: "low" };
  }
  if (getPaidChannelReasons(entry, "meta").length > 0) {
    return { channel: "meta_pixel_only", confidence: "low" };
  }
  if (hostContainsAny([entry.referrer], ["biocom.kr", "biocom.imweb.me"])) {
    return { channel: "self_internal", confidence: "low" };
  }
  if (resolveHost(entry.referrer)) {
    return { channel: "referral", confidence: "low" };
  }
  if (!entry.referrer.trim() && !entry.utmSource.trim() && !entry.utmCampaign.trim()) {
    return { channel: "direct", confidence: "low" };
  }
  return { channel: "unknown", confidence: "low" };
};

const metricFromTotals = (days: number, orders: number, revenue: number): TikTokOffImpactMetric => ({
  days,
  orders,
  revenue: Math.round(revenue),
  ordersPerDay: round2(orders / Math.max(days, 1)),
  revenuePerDay: Math.round(revenue / Math.max(days, 1)),
});

const buildVmChannelMetrics = (
  entries: AttributionLedgerEntry[],
  range: DateRange,
) => {
  const days = daysInRange(range);
  const grouped = new Map<string, AttributionLedgerEntry[]>();

  entries
    .filter((entry) => entry.touchpoint === "payment_success")
    .filter((entry) => entry.paymentStatus === "confirmed")
    .filter((entry) => entryInKstRange(entry, range))
    .forEach((entry, index) => {
      const orderKey = orderKeyFromLedgerEntry(entry) || getOrderKey(entry, index);
      if (isManualPaidTrafficTestEntry(entry, orderKey)) return;
      const bucket = grouped.get(orderKey) ?? [];
      bucket.push(entry);
      grouped.set(orderKey, bucket);
    });

  const totals = new Map<TikTokOffImpactChannelKey, { orders: number; revenue: number; confidence: "high" | "medium" | "low" }>();
  let allOrders = 0;
  let allRevenue = 0;

  for (const group of grouped.values()) {
    const preferred = sortEntriesByPreference(group);
    const carrier = preferred.find((entry) => (
      getPaidChannelReasons(entry, "tiktok").length > 0
      || hasStrongMetaPaidSignal(entry)
      || Boolean(entry.gclid || entry.fbclid || entry.ttclid || entry.utmSource || entry.utmCampaign)
    )) ?? preferred[0];
    if (!carrier) continue;
    const amount = preferred.map(amountFromLedgerEntry).find((value) => value > 0) ?? 0;
    const classification = classifyPaymentEntryChannel(carrier);
    const existing = totals.get(classification.channel) ?? {
      orders: 0,
      revenue: 0,
      confidence: classification.confidence,
    };
    existing.orders += 1;
    existing.revenue += amount;
    if (existing.confidence === "low" && classification.confidence !== "low") {
      existing.confidence = classification.confidence;
    }
    totals.set(classification.channel, existing);
    allOrders += 1;
    allRevenue += amount;
  }

  return {
    days,
    total: metricFromTotals(days, allOrders, allRevenue),
    channels: totals,
  };
};

const emptyOffMetric = (days: number): TikTokOffImpactMetric => metricFromTotals(days, 0, 0);

const buildVmChannelComparison = (
  baseline: ReturnType<typeof buildVmChannelMetrics>,
  off: ReturnType<typeof buildVmChannelMetrics>,
): TikTokOffImpactChannelRow[] => {
  const channels = new Set<TikTokOffImpactChannelKey>([
    ...Object.keys(OFF_CHANNEL_LABELS) as TikTokOffImpactChannelKey[],
    ...baseline.channels.keys(),
    ...off.channels.keys(),
  ]);
  const observedDrop = Math.max(0, baseline.total.revenuePerDay - off.total.revenuePerDay);

  return [...channels].map((channel) => {
    const base = baseline.channels.get(channel);
    const next = off.channels.get(channel);
    const baselineMetric = base
      ? metricFromTotals(baseline.days, base.orders, base.revenue)
      : emptyOffMetric(baseline.days);
    const offMetric = next
      ? metricFromTotals(off.days, next.orders, next.revenue)
      : emptyOffMetric(off.days);
    const deltaRevenuePerDay = offMetric.revenuePerDay - baselineMetric.revenuePerDay;
    const deltaOrdersPerDay = round2(offMetric.ordersPerDay - baselineMetric.ordersPerDay);
    const deltaRevenuePct = baselineMetric.revenuePerDay > 0
      ? round2((deltaRevenuePerDay / baselineMetric.revenuePerDay) * 100)
      : null;
    const meta = OFF_CHANNEL_LABELS[channel];
    return {
      channel,
      label: meta.label,
      explanation: meta.explanation,
      confidence: next?.confidence ?? base?.confidence ?? "low",
      baseline: baselineMetric,
      off: offMetric,
      deltaOrdersPerDay,
      deltaRevenuePerDay,
      deltaRevenuePct,
      shareOfObservedDropPct: observedDrop > 0 && deltaRevenuePerDay < 0
        ? round2((Math.abs(deltaRevenuePerDay) / observedDrop) * 100)
        : null,
    };
  }).sort((a, b) => Math.abs(b.deltaRevenuePerDay) - Math.abs(a.deltaRevenuePerDay));
};

const classifyGa4SourceChannel = (row: { channel: string; sessionSource: string; sessionMedium: string }): TikTokOffImpactChannelKey => {
  const source = row.sessionSource.toLowerCase();
  const medium = row.sessionMedium.toLowerCase();
  const channel = row.channel.toLowerCase();
  if (channel === "tiktok" || source.includes("tiktok") || medium.includes("tiktok")) return "paid_tiktok";
  if (channel === "meta" || source.includes("facebook") || source.includes("instagram") || source.includes("meta")) return "paid_meta";
  if (source.includes("google") && PAID_NEEDLES.some((needle) => medium.includes(needle))) return "paid_google";
  if (source.includes("naver") && PAID_NEEDLES.some((needle) => medium.includes(needle))) return "paid_naver";
  if (medium.includes("organic") || SEARCH_ENGINE_NEEDLES.some((needle) => source.includes(needle))) return "organic_search";
  if (channel === "direct" || source.includes("direct")) return "direct";
  if (SOCIAL_NEEDLES.some((needle) => source.includes(needle))) return "organic_social";
  return source === "(not set)" || channel === "not_set" ? "unknown" : "referral";
};

const buildGa4ChannelComparison = async (
  baselineRange: DateRange,
  offRange: DateRange,
): Promise<{ rows: TikTokOffImpactGa4ChannelRow[]; error: string | null }> => {
  try {
    const [baseline, off] = await Promise.all([
      queryGA4SourceConversion({ startDate: baselineRange.startDate, endDate: baselineRange.endDate, limit: 250 }),
      queryGA4SourceConversion({ startDate: offRange.startDate, endDate: offRange.endDate, limit: 250 }),
    ]);
    const baselineDays = daysInRange(baselineRange);
    const offDays = daysInRange(offRange);
    const aggregate = (rows: typeof baseline.rows) => {
      const map = new Map<TikTokOffImpactChannelKey, { sessions: number; purchases: number; revenue: number }>();
      for (const row of rows) {
        const channel = classifyGa4SourceChannel(row);
        const bucket = map.get(channel) ?? { sessions: 0, purchases: 0, revenue: 0 };
        bucket.sessions += row.sessions;
        bucket.purchases += row.ecommercePurchases;
        bucket.revenue += row.grossPurchaseRevenue;
        map.set(channel, bucket);
      }
      return map;
    };
    const baseMap = aggregate(baseline.rows);
    const offMap = aggregate(off.rows);
    const channels = new Set<TikTokOffImpactChannelKey>([
      ...baseMap.keys(),
      ...offMap.keys(),
      "paid_tiktok",
      "paid_meta",
      "paid_google",
      "organic_search",
      "direct",
    ]);
    const rows = [...channels].map((channel) => {
      const base = baseMap.get(channel) ?? { sessions: 0, purchases: 0, revenue: 0 };
      const next = offMap.get(channel) ?? { sessions: 0, purchases: 0, revenue: 0 };
      const meta = OFF_CHANNEL_LABELS[channel];
      return {
        channel,
        label: meta.label,
        baseline: {
          sessions: base.sessions,
          purchases: base.purchases,
          revenue: Math.round(base.revenue),
          sessionsPerDay: Math.round(base.sessions / Math.max(baselineDays, 1)),
          revenuePerDay: Math.round(base.revenue / Math.max(baselineDays, 1)),
        },
        off: {
          sessions: next.sessions,
          purchases: next.purchases,
          revenue: Math.round(next.revenue),
          sessionsPerDay: Math.round(next.sessions / Math.max(offDays, 1)),
          revenuePerDay: Math.round(next.revenue / Math.max(offDays, 1)),
        },
        deltaRevenuePerDay: Math.round(next.revenue / Math.max(offDays, 1) - base.revenue / Math.max(baselineDays, 1)),
        deltaSessionsPerDay: Math.round(next.sessions / Math.max(offDays, 1) - base.sessions / Math.max(baselineDays, 1)),
      };
    }).sort((a, b) => Math.abs(b.deltaRevenuePerDay) - Math.abs(a.deltaRevenuePerDay));
    return { rows, error: null };
  } catch (error) {
    return { rows: [], error: error instanceof Error ? error.message : String(error) };
  }
};

const buildTikTokTrackingAuditItems = (params: {
  baselineTiktokSpend: number;
  offTiktokSpend: number;
  baselinePlatformValue: number;
  baselineTiktokIntentRows: number;
  offTiktokIntentRows: number;
  baselineTiktokCheckoutOrders: number;
  offTiktokCheckoutOrders: number;
  baselineTiktokConfirmedRevenue: number;
  offTiktokConfirmedRevenue: number;
  baselineFirstTouchRevenue: number;
  offFirstTouchRevenue: number;
  baselineGa4TikTokRevenue: number;
  offGa4TikTokRevenue: number;
}): TikTokOffImpactAuditItem[] => ([
  {
    item: "광고비가 실제로 꺼졌나",
    answer: params.offTiktokSpend <= 100 ? "낮음" : "중간",
    score: params.offTiktokSpend <= 100 ? 8 : 45,
    evidence: `OFF 기간 TikTok spend ${Math.round(params.offTiktokSpend).toLocaleString("ko-KR")}원, baseline ${Math.round(params.baselineTiktokSpend).toLocaleString("ko-KR")}원`,
    whatItMeans: "spend 기준으로는 광고 중단 상태로 볼 수 있다.",
  },
  {
    item: "유입 수집 자체를 못 했나",
    answer: params.baselineTiktokIntentRows > 1000 ? "낮음" : "중간",
    score: params.baselineTiktokIntentRows > 1000 ? 22 : 48,
    evidence: `OFF 전 TikTok 유입 row ${params.baselineTiktokIntentRows.toLocaleString("ko-KR")}건, OFF 후 ${params.offTiktokIntentRows.toLocaleString("ko-KR")}건`,
    whatItMeans: "TikTok 클릭/유입 수집점은 살아 있었다. 완전 미수집 가능성은 낮다.",
  },
  {
    item: "결제 연결에서 놓쳤나",
    answer: params.baselineTiktokConfirmedRevenue === 0 && params.baselineFirstTouchRevenue > 0 ? "중간" : "낮음",
    score: params.baselineTiktokConfirmedRevenue === 0 && params.baselineFirstTouchRevenue > 0 ? 42 : 28,
    evidence: `OFF 전 TikTok checkout 후보 ${params.baselineTiktokCheckoutOrders.toLocaleString("ko-KR")}건, strict confirmed ${Math.round(params.baselineTiktokConfirmedRevenue).toLocaleString("ko-KR")}원, firstTouch 후보 ${Math.round(params.baselineFirstTouchRevenue).toLocaleString("ko-KR")}원`,
    whatItMeans: "직접 결제 근거는 없지만 보조 후보는 있어 일부 assisted 가능성은 남는다.",
  },
  {
    item: "GA4가 TikTok 구매를 못 봤나",
    answer: params.baselineGa4TikTokRevenue === 0 && params.offGa4TikTokRevenue === 0 ? "낮음" : "중간",
    score: params.baselineGa4TikTokRevenue === 0 && params.offGa4TikTokRevenue === 0 ? 24 : 45,
    evidence: `GA4 TikTok purchase revenue baseline ${Math.round(params.baselineGa4TikTokRevenue).toLocaleString("ko-KR")}원, OFF ${Math.round(params.offGa4TikTokRevenue).toLocaleString("ko-KR")}원`,
    whatItMeans: "GA4 cross-check에서도 TikTok 구매가 보이지 않는다.",
  },
  {
    item: "view-through / 다른 기기 구매 가능성",
    answer: params.baselinePlatformValue > 0 && params.baselineTiktokConfirmedRevenue === 0 ? "남아있음" : "낮음",
    score: params.baselinePlatformValue > 0 && params.baselineTiktokConfirmedRevenue === 0 ? 40 : 20,
    evidence: `TikTok 플랫폼 주장 매출 ${Math.round(params.baselinePlatformValue).toLocaleString("ko-KR")}원과 내부 strict 0원 사이에 gap이 있다.`,
    whatItMeans: "사용자가 보고 나중에 검색/직접/다른 기기로 구매한 assisted 효과는 strict 원장만으로 완전히 닫기 어렵다.",
  },
]);

const sumAuditScores = (items: TikTokOffImpactAuditItem[]) =>
  Math.round(items.reduce((sum, item) => sum + item.score, 0) / Math.max(items.length, 1));

const buildTikTokPaymentEvidenceSummary = (
  entries: AttributionLedgerEntry[],
  range: DateRange,
) => {
  const marketingIntentClients = new Set<string>();
  const checkoutOrders = new Set<string>();
  const strictOrders = new Set<string>();
  const firstTouchOrders = new Set<string>();
  let marketingIntentRows = 0;
  let checkoutRows = 0;
  let strictRevenue = 0;
  let firstTouchRevenue = 0;

  for (const entry of entries) {
    if (!entryInKstRange(entry, range)) continue;
    const orderKey = orderKeyFromLedgerEntry(entry);
    if (isManualPaidTrafficTestEntry(entry, orderKey)) continue;

    const directReasons = getAttributionTikTokMatchReasons(entry);
    const firstTouchReasons = getStoredFirstTouchReasons(entry, "tiktok");
    const hasTikTokEvidence = directReasons.length > 0 || firstTouchReasons.length > 0;
    if (!hasTikTokEvidence) continue;

    if (entry.touchpoint === "marketing_intent") {
      marketingIntentRows += 1;
      const clientKey = clientKeyFromLedgerEntry(entry);
      if (clientKey) marketingIntentClients.add(clientKey);
    }
    if (entry.touchpoint === "checkout_started") {
      checkoutRows += 1;
      if (orderKey) checkoutOrders.add(orderKey);
    }
    if (entry.touchpoint === "payment_success" && entry.paymentStatus === "confirmed") {
      const amount = amountFromLedgerEntry(entry);
      if (directReasons.length > 0) {
        if (orderKey && strictOrders.has(orderKey)) continue;
        if (orderKey) strictOrders.add(orderKey);
        strictRevenue += amount;
      } else if (firstTouchReasons.length > 0) {
        if (orderKey && firstTouchOrders.has(orderKey)) continue;
        if (orderKey) firstTouchOrders.add(orderKey);
        firstTouchRevenue += amount;
      }
    }
  }

  return {
    marketingIntentRows,
    marketingIntentClients: marketingIntentClients.size,
    checkoutRows,
    checkoutOrders: checkoutOrders.size,
    strictConfirmedOrders: strictOrders.size,
    strictConfirmedRevenue: Math.round(strictRevenue),
    firstTouchConfirmedOrders: firstTouchOrders.size,
    firstTouchConfirmedRevenue: Math.round(firstTouchRevenue),
  };
};

export const createAdsRouter = () => {
  const router = express.Router();

  router.get("/api/ads/tiktok/roas-comparison", async (req: Request, res: Response) => {
    try {
      const startDate = typeof req.query.start_date === "string" ? req.query.start_date.trim() : undefined;
      const endDate = typeof req.query.end_date === "string" ? req.query.end_date.trim() : undefined;
      const invalidRange =
        (startDate && !/^\d{4}-\d{2}-\d{2}$/.test(startDate))
        || (endDate && !/^\d{4}-\d{2}-\d{2}$/.test(endDate))
        || Boolean((startDate && !endDate) || (!startDate && endDate));

      if (invalidRange) {
        res.status(400).json({
          ok: false,
          error: "start_date/end_date는 둘 다 YYYY-MM-DD 형식으로 전달해야 한다.",
        });
        return;
      }

      const payload = await buildTikTokRoasComparison({ startDate, endDate });
      res.json(payload);
    } catch (error) {
      const message = error instanceof Error ? error.message : "tiktok roas comparison failed";
      res.status(500).json({ ok: false, error: message });
    }
  });

  router.get("/api/ads/tiktok/off-impact-audit", async (req: Request, res: Response) => {
    let cacheKey: string | null = null;
    try {
      const baselineRange = parseOptionalDateRange(
        req.query.baseline_start,
        req.query.baseline_end,
        TIKTOK_OFF_DEFAULT_BASELINE,
        "baseline_start",
        "baseline_end",
      );
      const offRange = parseOptionalDateRange(
        req.query.off_start,
        req.query.off_end,
        TIKTOK_OFF_DEFAULT_OFF,
        "off_start",
        "off_end",
      );
      cacheKey = tiktokOffImpactCacheKey(baselineRange, offRange);
      const forceRefresh = req.query.refresh === "1" || req.query.force === "1";

      if (!forceRefresh) {
        const cached = await readTikTokOffImpactCache(cacheKey);
        if (cached) {
          res.json(withTikTokOffImpactCacheMeta(cached.payload, {
            hit: true,
            key: cacheKey,
            generated_at: cached.generatedAt,
            stale_due_to_error: false,
          }));
          return;
        }
      }

      const [baselineLedger, offLedger] = await Promise.all([
        readOperationalLedgerEntriesForAds("biocom", baselineRange),
        readOperationalLedgerEntriesForAds("biocom", offRange),
      ]);
      const baselineVm = buildVmChannelMetrics(baselineLedger.entries, baselineRange);
      const offVm = buildVmChannelMetrics(offLedger.entries, offRange);
      const overallDeltaRevenuePerDay = offVm.total.revenuePerDay - baselineVm.total.revenuePerDay;
      const [baselineTikTokAds, offTikTokAds, ga4ChannelComparison, coopAdjustment] = await Promise.all([
        readTikTokAdsDailySummaryFromCsv(baselineRange),
        readTikTokAdsDailySummaryFromCsv(offRange),
        buildGa4ChannelComparison(baselineRange, offRange),
        buildOperationalCoopImpactSummary(baselineRange, offRange, overallDeltaRevenuePerDay),
      ]);

      const channelRows = buildVmChannelComparison(baselineVm, offVm);
      const baselineTikTokEvidence = buildTikTokPaymentEvidenceSummary(baselineLedger.entries, baselineRange);
      const offTikTokEvidence = buildTikTokPaymentEvidenceSummary(offLedger.entries, offRange);
      const baselineGa4TikTok = ga4ChannelComparison.rows.find((row) => row.channel === "paid_tiktok")?.baseline;
      const offGa4TikTok = ga4ChannelComparison.rows.find((row) => row.channel === "paid_tiktok")?.off;
      const auditItems = buildTikTokTrackingAuditItems({
        baselineTiktokSpend: baselineTikTokAds.spend,
        offTiktokSpend: offTikTokAds.spend,
        baselinePlatformValue: baselineTikTokAds.platformPurchaseValue,
        baselineTiktokIntentRows: baselineTikTokEvidence.marketingIntentRows,
        offTiktokIntentRows: offTikTokEvidence.marketingIntentRows,
        baselineTiktokCheckoutOrders: baselineTikTokEvidence.checkoutOrders,
        offTiktokCheckoutOrders: offTikTokEvidence.checkoutOrders,
        baselineTiktokConfirmedRevenue: baselineTikTokEvidence.strictConfirmedRevenue,
        offTiktokConfirmedRevenue: offTikTokEvidence.strictConfirmedRevenue,
        baselineFirstTouchRevenue: baselineTikTokEvidence.firstTouchConfirmedRevenue,
        offFirstTouchRevenue: offTikTokEvidence.firstTouchConfirmedRevenue,
        baselineGa4TikTokRevenue: baselineGa4TikTok?.revenue ?? 0,
        offGa4TikTokRevenue: offGa4TikTok?.revenue ?? 0,
      });
      const missingTrackingScore = sumAuditScores(auditItems);
      const platformOverCreditScore = Math.max(
        0,
        Math.min(100, Math.round(70 - (baselineTikTokEvidence.strictConfirmedRevenue > 0 ? 25 : 0))),
      );
      const observedRevenueDropPerDay = baselineVm.total.revenuePerDay - offVm.total.revenuePerDay;
      const topDropChannels = channelRows
        .filter((row) => row.deltaRevenuePerDay < 0)
        .slice(0, 5);

      const payload: Record<string, unknown> = {
        ok: true,
        site: "biocom",
        checked_at: new Date().toISOString(),
        lane: "Green read-only",
        ranges: {
          baseline: {
            ...baselineRange,
            label: "TikTok OFF 전",
            days: daysInRange(baselineRange),
          },
          off: {
            ...offRange,
            label: "TikTok OFF 후",
            days: daysInRange(offRange),
          },
        },
        source: {
          primary: "VM Cloud SQLite 보조 원장 직접 read-only / attribution_ledger source=biocom_imweb captureMode=live",
          ga4_cross_check: "GA4 Data API / biocom property / session source-medium revenue",
          tiktok_ads: baselineTikTokAds.source,
          coop_adjustment: coopAdjustment.source,
          notes: [
            "채널별 매출은 예산 판단용 확정치가 아니라 VM Cloud 결제완료 row의 유입 근거 분류다.",
            "공동구매 보정 매출은 운영DB 공동구매 테이블의 read-only 집계이며 광고 채널 매출에 섞지 않는다.",
            "기간 길이가 달라 총액 대신 일평균 주문/매출로 비교한다.",
            "응답에는 raw order/payment/click/member identifier를 포함하지 않는다.",
          ],
        },
        warnings: [
          ...baselineLedger.warnings,
          ...offLedger.warnings,
          ...baselineTikTokAds.warnings,
          ...offTikTokAds.warnings,
          ...coopAdjustment.warnings,
          ...(ga4ChannelComparison.error ? [`GA4 cross-check 실패: ${ga4ChannelComparison.error}`] : []),
        ],
        overall: {
          baseline: baselineVm.total,
          off: offVm.total,
          deltaOrdersPerDay: round2(offVm.total.ordersPerDay - baselineVm.total.ordersPerDay),
          deltaRevenuePerDay: overallDeltaRevenuePerDay,
          deltaRevenuePct: baselineVm.total.revenuePerDay > 0
            ? round2((overallDeltaRevenuePerDay / baselineVm.total.revenuePerDay) * 100)
            : null,
        },
        coop_adjustment: coopAdjustment,
        tiktok_spend_and_claim: {
          source: baselineTikTokAds.source,
          baseline: {
            spend: baselineTikTokAds.spend,
            platformPurchases: baselineTikTokAds.platformPurchases,
            platformPurchaseValue: baselineTikTokAds.platformPurchaseValue,
            platformRoas: baselineTikTokAds.platformRoas,
            sourceRows: baselineTikTokAds.rows,
            sourceFiles: baselineTikTokAds.files,
          },
          off: {
            spend: offTikTokAds.spend,
            platformPurchases: offTikTokAds.platformPurchases,
            platformPurchaseValue: offTikTokAds.platformPurchaseValue,
            platformRoas: offTikTokAds.platformRoas,
            sourceRows: offTikTokAds.rows,
            sourceFiles: offTikTokAds.files,
          },
        },
        tiktok_internal_evidence: {
          baseline: baselineTikTokEvidence,
          off: offTikTokEvidence,
        },
        channel_shift: {
          source: "VM Cloud SQLite 보조 원장 결제완료 row channel classifier",
          observedRevenueDropPerDay,
          topDropChannels,
          rows: channelRows,
        },
        ga4_channel_cross_check: {
          source: "GA4 Data API sessionSource/sessionMedium",
          error: ga4ChannelComparison.error,
          rows: ga4ChannelComparison.rows,
        },
        mistracking_audit: {
          missingTrackingProbabilityScore: missingTrackingScore,
          platformOverCreditProbabilityScore: platformOverCreditScore,
          recommendation: missingTrackingScore >= 60
            ? "TikTok 제한 재테스트 전 추적 보강이 먼저다."
            : "대규모 미추적보다는 플랫폼 과대 attribution 가능성이 더 크다. 7일 OFF 결과를 닫고 제한 재테스트 여부를 결정한다.",
          items: auditItems,
        },
        invariants: {
          no_send: true,
          no_write: true,
          no_deploy: true,
          no_publish: true,
          raw_identifier_suppressed: true,
        },
      };
      const generatedAt = await writeTikTokOffImpactCache(cacheKey, payload);
      res.json(withTikTokOffImpactCacheMeta(payload, {
        hit: false,
        key: cacheKey,
        generated_at: generatedAt,
        stale_due_to_error: false,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "tiktok off impact audit failed";
      if (cacheKey) {
        try {
          const cached = await readTikTokOffImpactCache(cacheKey);
          if (cached) {
            res.json(withTikTokOffImpactCacheMeta(cached.payload, {
              hit: true,
              key: cacheKey,
              generated_at: cached.generatedAt,
              stale_due_to_error: true,
              refresh_error: message,
            }));
            return;
          }
        } catch {
          // Fall through to the original error when cache read also fails.
        }
      }
      res.status(500).json({ ok: false, error: message });
    }
  });

  router.get("/api/ads/tiktok/traffic-quality", async (req: Request, res: Response) => {
    try {
      const { range, datePreset } = resolveOptionalRange(req);
      const [ga4, ledger] = await Promise.all([
        queryGA4PaidTrafficQuality({ startDate: range.startDate, endDate: range.endDate }),
        loadLedgerOrders({ range, sites: ["biocom"], source: "operational_vm" }),
      ]);
      const queriedAt = new Date().toISOString();

      res.json({
        ok: true,
        range: {
          start_date: range.startDate,
          end_date: range.endDate,
          timezone: KST_TIMEZONE,
          inclusivity: "KST calendar dates inclusive",
        },
        date_preset: datePreset,
        queried_at: queriedAt,
        source: {
          ga4: "GA4 Data API / property biocom",
          vm: "TJ 관리 Attribution VM SQLite / CRM_LOCAL_DB_PATH#attribution_ledger",
        },
        freshness: {
          checked_at: queriedAt,
          vm_latest_logged_at: ledger.freshness.latestLoggedAt,
          vm_latest_approved_date: ledger.freshness.latestApprovedDate,
          vm_entries: ledger.freshness.entries,
          vm_orders: ledger.freshness.orders,
        },
        confidence: {
          label: describeLedgerSourceConfidence(ledger).label,
          reason: describeLedgerSourceConfidence(ledger).reason,
          ga4: "B: GA4는 행동 품질 cross-check이며, 광고별 실제 결제 확정은 TJ 관리 Attribution VM confirmed가 primary다.",
        },
        ga4,
        attribution_vm: {
          tiktok: buildPaidTrafficVmFunnel(ledger.entries, range, "tiktok"),
          meta: buildPaidTrafficVmFunnel(ledger.entries, range, "meta"),
        },
        notes: [
          "이 endpoint는 read-only다. 운영DB write, VM SQLite write, GA4/Meta/TikTok/Google 전환 전송을 하지 않는다.",
          "GA4 bounceRate/engagementRate는 현재 TikTok/Meta traffic에서 낮은 변동성을 보일 수 있어 보조 지표로만 본다.",
          "90% 스크롤은 GA4 Enhanced Measurement scroll 이벤트 기준이다. 연속 스크롤 깊이 측정은 GTM custom scroll tag가 필요하다.",
        ],
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "tiktok traffic quality failed";
      res.status(500).json({ ok: false, error: message });
    }
  });

  router.post("/api/ads/tiktok/ingest-daily", async (req: Request, res: Response) => {
    try {
      const startDate = typeof req.body?.start_date === "string" ? req.body.start_date.trim() : undefined;
      const endDate = typeof req.body?.end_date === "string" ? req.body.end_date.trim() : undefined;
      const { ensureTikTokDailyUpToYesterday, ensureTikTokDailyCovers } = await import("../tiktokAdsAutoSync");
      if (startDate && endDate) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
          res.status(400).json({ ok: false, error: "start_date/end_date는 YYYY-MM-DD" });
          return;
        }
        const result = await ensureTikTokDailyCovers(startDate, endDate);
        res.json({ ok: true, result });
        return;
      }
      const result = await ensureTikTokDailyUpToYesterday();
      res.json({ ok: true, result });
    } catch (error) {
      const message = error instanceof Error ? error.message : "tiktok daily ingest failed";
      res.status(500).json({ ok: false, error: message });
    }
  });

  router.get("/api/ads/roas-summary", async (req: Request, res: Response) => {
    try {
      const accountId = typeof req.query.account_id === "string" ? req.query.account_id.trim() : "";
      if (!accountId) {
        res.status(400).json({ ok: false, error: "account_id 필요" });
        return;
      }

      const requestedPresets = (
        typeof req.query.presets === "string" && req.query.presets.trim()
          ? req.query.presets
          : "today,yesterday,last_7d"
      )
        .split(",")
        .map((preset) => preset.trim())
        .filter(Boolean);
      const uniquePresets = [...new Set(requestedPresets)];

      const presetRanges = uniquePresets
        .map((preset) => ({ preset, range: resolveDatePresetRange(preset) }))
        .filter((item): item is { preset: string; range: DateRange } => Boolean(item.range));
      const invalidPresets = uniquePresets.filter((preset) => !resolveDatePresetRange(preset));

      if (presetRanges.length === 0) {
        res.status(400).json({
          ok: false,
          error: "지원하는 presets 필요",
          invalid_presets: invalidPresets,
          supported_presets: [
            "today",
            "yesterday",
            "last_7d",
            "last_14d",
            "last_30d",
            "last_90d",
            "this_month",
            "last_month",
          ],
        });
        return;
      }

      const unionRange = presetRanges.reduce<DateRange>(
        (current, item) => ({
          startDate: item.range.startDate < current.startDate ? item.range.startDate : current.startDate,
          endDate: item.range.endDate > current.endDate ? item.range.endDate : current.endDate,
        }),
        { ...presetRanges[0].range },
      );
      const siteAccount = findSiteAccountByAccountId(accountId);
      const forceRefresh =
        req.query.force === "true" || req.query.force === "1" || req.query.force === "yes";
      const ledgerSource = parseAdsLedgerSource(req.query.ledger_source ?? req.query.data_source);
      const cacheKey = buildRoasSummaryCacheKey({
        accountId,
        presets: uniquePresets,
        ledgerSource,
      });
      const cacheConfig = getRoasSummaryCacheConfig();
      const cached = roasSummaryCache.get(cacheKey) ?? null;
      const cachedAgeMs = cached ? Date.now() - cached.computedAtMs : Number.POSITIVE_INFINITY;
      const cacheWithinStaleLimit = Boolean(cached && cachedAgeMs <= cacheConfig.staleMaxMs);

      if (!forceRefresh && cacheWithinStaleLimit && cached) {
        res.json(cloneRoasSummaryBodyWithCache({
          cacheKey,
          entry: cached,
          source: cachedAgeMs <= cacheConfig.freshMs ? "in_memory_precompute" : "stale_fallback",
          stale: cachedAgeMs > cacheConfig.freshMs,
        }));
        return;
      }

      const forceCooldownRemainingMs = cached
        ? cacheConfig.forceCooldownMs - cachedAgeMs
        : 0;
      if (forceRefresh && cached && forceCooldownRemainingMs > 0) {
        res.json(cloneRoasSummaryBodyWithCache({
          cacheKey,
          entry: cached,
          source: "force_cooldown_cache",
          stale: cachedAgeMs > cacheConfig.freshMs,
          forceCooldownRemainingMs,
        }));
        return;
      }

      if (roasSummaryRefreshInFlight.has(cacheKey) && cached) {
        res.json(cloneRoasSummaryBodyWithCache({
          cacheKey,
          entry: cached,
          source: "refresh_in_flight_cache",
          stale: cachedAgeMs > cacheConfig.freshMs,
          refreshInFlight: true,
        }));
        return;
      }

      const generationStartedAtMs = Date.now();
      roasSummaryRefreshInFlight.add(cacheKey);
      try {
      const ledgerOptions = ledgerQueryOptions(req, unionRange, siteAccount ? [siteAccount.site] : undefined);
      const [adsetCampaigns, creativeEvidence, aliasCampaigns, ledger] = await Promise.all([
        fetchMetaAdsetCampaignMap(accountId),
        fetchMetaAdCreativeEvidenceMaps(accountId),
        fetchManualVerifiedAliasMap(siteAccount?.site ?? null),
        loadLedgerOrders(ledgerOptions),
      ]);

      const accountOrders = filterOrdersForAccount(ledger.orders, accountId);
      const campaignAliasMap = mergeCampaignAliasMaps(aliasCampaigns.map, creativeEvidence.aliasMap);
      const results: Record<string, unknown> = {};
      const errors: Record<string, unknown> = {};

      await Promise.all(presetRanges.map(async ({ preset, range }) => {
        const metaResult = await fetchMetaInsights({
          accountId,
          fields: "campaign_name,campaign_id,impressions,clicks,spend",
          level: "campaign",
          datePreset: preset,
          limit: "100",
          actionReportTime: META_DEFAULT_ACTION_REPORT_TIME,
          useUnifiedAttributionSetting: META_DEFAULT_UNIFIED_ATTRIBUTION_SETTING,
        });

        if (!metaResult.ok) {
          errors[preset] = {
            error: metaResult.error,
            status: 502,
            response_message: metaResult.error,
          };
          return;
        }

        const filteredOrders = filterOrdersByRange(accountOrders, range);
        const campaigns = buildCampaignRoasRows({
          metaRows: metaResult.data,
          orders: filteredOrders,
          ledgerAvailable: ledger.entries.length > 0,
          adsetCampaignMap: adsetCampaigns.map,
          adCampaignMap: creativeEvidence.adMap,
          campaignAliasMap,
        });
        const totalSpend = round2(campaigns.reduce((sum, row) => sum + row.spend, 0));
        const totalAttributedRevenue = round2(campaigns.reduce((sum, row) => sum + row.attributedRevenue, 0));
        const totalOrders = campaigns.reduce((sum, row) => sum + row.orders, 0);
        const coopRows = campaigns.filter((row) => row.campaignType === "coop");
        const generalRows = campaigns.filter((row) => row.campaignType === "general");
        const coopSpend = round2(coopRows.reduce((sum, row) => sum + row.spend, 0));
        const coopRevenue = round2(coopRows.reduce((sum, row) => sum + row.attributedRevenue, 0));
        const generalSpend = round2(generalRows.reduce((sum, row) => sum + row.spend, 0));
        const generalRevenue = round2(generalRows.reduce((sum, row) => sum + row.attributedRevenue, 0));

        results[preset] = {
          ok: true,
          queried_at: new Date().toISOString(),
          date_range: {
            start_date: range.startDate,
            end_date: range.endDate,
            timezone: KST_TIMEZONE,
            inclusivity: "KST calendar dates inclusive",
          },
          summary: {
            spend: totalSpend,
            attributedRevenue: totalAttributedRevenue,
            roas: computeRoas(totalAttributedRevenue, totalSpend, ledger.entries.length > 0),
            orders: totalOrders,
            general: {
              spend: generalSpend,
              attributedRevenue: generalRevenue,
              roas: computeRoas(generalRevenue, generalSpend, ledger.entries.length > 0),
              orders: generalRows.reduce((sum, row) => sum + row.orders, 0),
            },
            coop: {
              spend: coopSpend,
              attributedRevenue: coopRevenue,
              roas: computeRoas(coopRevenue, coopSpend, ledger.entries.length > 0),
              orders: coopRows.reduce((sum, row) => sum + row.orders, 0),
              campaignCount: coopRows.length,
            },
          },
        };
      }));

      for (const preset of invalidPresets) {
        errors[preset] = {
          error: `지원하지 않는 date_preset: ${preset}`,
          status: 400,
          response_message: `지원하지 않는 date_preset: ${preset}`,
        };
      }

      const responseBody: RoasSummaryBody = {
        ok: true,
        ...ledgerResponseMeta(ledger, {
          range: unionRange,
          datePreset: "batch",
          accountId,
          site: siteAccount?.site ?? null,
          metaLevel: "campaign",
          metaFields: "campaign_name,campaign_id,impressions,clicks,spend",
        }),
        account_id: accountId,
        presets: uniquePresets,
        valid_presets: presetRanges.map((item) => item.preset),
        invalid_presets: invalidPresets,
        union_range: unionRange,
        meta_reference: buildMetaReference(),
        adset_mapping_error: adsetCampaigns.error,
        ad_mapping_error: creativeEvidence.error,
        alias_mapping_error: aliasCampaigns.error,
        batch: {
          mode: "aggregate_summary",
          ledger_fetch_count: 1,
          meta_insights_fetch_count: presetRanges.length,
          raw_ledger_items_returned: 0,
          fallback_prevented: true,
          caveat: "프론트가 today/yesterday/last_7d를 따로 호출하지 않도록 ledger를 한 번만 읽고 기간별 요약만 반환한다.",
        },
        metric_contract: {
          source: {
            revenue: ledger.dataSource === "operational_vm"
              ? "VM Cloud attribution ledger"
              : "local attribution ledger fallback",
            spend: "Meta Ads Insights API",
          },
          unit: {
            revenue: "unique confirmed/pending ledger order matched to Meta evidence",
            spend: "KRW campaign spend",
            roas: "attributedRevenue / spend",
          },
          window: "date_preset batch",
          site: siteAccount?.site ?? null,
          account_id: accountId,
          last_updated_at: new Date().toISOString(),
          caveat: "Ads Manager가 주장하는 platform ROAS가 아니라 내부 attribution ledger 기준 ATT ROAS다.",
        },
        results,
        errors,
      };
      const computedAtMs = Date.now();
      const entry: RoasSummaryCacheEntry = {
        body: responseBody,
        computedAtMs,
        generationMs: computedAtMs - generationStartedAtMs,
        nextRefreshAtMs: computedAtMs + cacheConfig.intervalMs,
      };
      roasSummaryCache.set(cacheKey, entry);
      const source: RoasSummaryCacheSource = forceRefresh ? "live_force_refresh" : "live_cache_miss";
      const batch = responseBody.batch && typeof responseBody.batch === "object"
        ? { ...responseBody.batch }
        : {};
      res.json({
        ...responseBody,
        served_at: new Date().toISOString(),
        cache: buildRoasSummaryCacheMeta({
          cacheKey,
          entry,
          source,
        }),
        batch: {
          ...batch,
          source,
          cache_hit: false,
          request_ledger_fetch_count: 1,
          generated_ledger_fetch_count: batch.ledger_fetch_count ?? null,
        },
      });
      } catch (liveError) {
        const message = liveError instanceof Error ? liveError.message : String(liveError);
        if (cached && cacheWithinStaleLimit) {
          res.json(cloneRoasSummaryBodyWithCache({
            cacheKey,
            entry: cached,
            source: "stale_fallback",
            stale: true,
            errorFromRefresh: message,
          }));
          return;
        }
        const nowIso = new Date().toISOString();
        const errors = Object.fromEntries(presetRanges.map(({ preset }) => [
          preset,
          {
            error: message,
            status: 502,
            response_message: message,
          },
        ]));
        res.json({
          ok: true,
          account_id: accountId,
          presets: uniquePresets,
          valid_presets: presetRanges.map((item) => item.preset),
          invalid_presets: invalidPresets,
          union_range: unionRange,
          served_at: nowIso,
          queried_at: nowIso,
          meta_reference: buildMetaReference(),
          results: {},
          errors,
          batch: {
            mode: "aggregate_summary",
            source: "live_error_no_cache",
            cache_hit: false,
            ledger_fetch_count: 0,
            meta_insights_fetch_count: 0,
            raw_ledger_items_returned: 0,
            fallback_prevented: true,
            caveat: "ROAS summary live 계산이 실패했지만 프론트가 느린 개별 /api/ads/roas fallback을 때리지 않도록 200 + errors contract로 반환한다.",
          },
          metric_contract: {
            source: {
              revenue: "VM Cloud attribution ledger",
              spend: "Meta Ads Insights API",
            },
            unit: {
              revenue: "unique confirmed/pending ledger order matched to Meta evidence",
              spend: "KRW campaign spend",
              roas: "attributedRevenue / spend",
            },
            window: "date_preset batch",
            site: siteAccount?.site ?? null,
            account_id: accountId,
            last_updated_at: nowIso,
            caveat: "live no-cache 계산 실패. 다음 precompute tick 또는 캐시 생성 후 정상값을 제공한다.",
          },
          cache: buildRoasSummaryCacheMeta({
            cacheKey,
            entry: null,
            source: "live_error_no_cache",
            stale: true,
            errorFromRefresh: message,
          }),
        });
        return;
      } finally {
        roasSummaryRefreshInFlight.delete(cacheKey);
      }
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: error instanceof Error ? error.message : "ads roas summary failed",
      });
    }
  });

  router.get("/api/ads/roas", async (req: Request, res: Response) => {
    try {
      const accountId = typeof req.query.account_id === "string" ? req.query.account_id.trim() : "";
      if (!accountId) {
        res.status(400).json({ ok: false, error: "account_id 필요" });
        return;
      }

      // 사용자 지정 (start_date+end_date) 우선, 없으면 date_preset.
      const { range, datePreset } = resolveOptionalRange(req);

      const siteAccount = findSiteAccountByAccountId(accountId);
      const ledgerOptions = ledgerQueryOptions(req, range, siteAccount ? [siteAccount.site] : undefined);
      const [metaResult, adsetCampaigns, creativeEvidence, aliasCampaigns, ledger] = await Promise.all([
        fetchMetaInsights({
          accountId,
          fields: "campaign_name,campaign_id,impressions,clicks,spend",
          level: "campaign",
          ...(datePreset ? { datePreset } : { range }),
          limit: "100",
          actionReportTime: META_DEFAULT_ACTION_REPORT_TIME,
          useUnifiedAttributionSetting: META_DEFAULT_UNIFIED_ATTRIBUTION_SETTING,
        }),
        fetchMetaAdsetCampaignMap(accountId),
        fetchMetaAdCreativeEvidenceMaps(accountId),
        fetchManualVerifiedAliasMap(siteAccount?.site ?? null),
        loadLedgerOrders(ledgerOptions),
      ]);

      if (!metaResult.ok) {
        res.status(502).json(metaResult);
        return;
      }

      const filteredOrders = filterOrdersByRange(filterOrdersForAccount(ledger.orders, accountId), range);
      const campaigns = buildCampaignRoasRows({
        metaRows: metaResult.data,
        orders: filteredOrders,
        ledgerAvailable: ledger.entries.length > 0,
        adsetCampaignMap: adsetCampaigns.map,
        adCampaignMap: creativeEvidence.adMap,
        campaignAliasMap: mergeCampaignAliasMaps(aliasCampaigns.map, creativeEvidence.aliasMap),
      });
      const totalSpend = round2(campaigns.reduce((sum, row) => sum + row.spend, 0));
      const totalAttributedRevenue = round2(campaigns.reduce((sum, row) => sum + row.attributedRevenue, 0));
      const totalOrders = campaigns.reduce((sum, row) => sum + row.orders, 0);

      // 공동구매 분리 (§ H/I 참조). 일반 Meta ROAS를 공동구매가 끌어올리는 편향 제거용.
      const coopRows = campaigns.filter((row) => row.campaignType === "coop");
      const generalRows = campaigns.filter((row) => row.campaignType === "general");
      const coopSpend = round2(coopRows.reduce((sum, row) => sum + row.spend, 0));
      const coopRevenue = round2(coopRows.reduce((sum, row) => sum + row.attributedRevenue, 0));
      const coopOrders = coopRows.reduce((sum, row) => sum + row.orders, 0);
      const generalSpend = round2(generalRows.reduce((sum, row) => sum + row.spend, 0));
      const generalRevenue = round2(generalRows.reduce((sum, row) => sum + row.attributedRevenue, 0));
      const generalOrders = generalRows.reduce((sum, row) => sum + row.orders, 0);

      res.json({
        ok: true,
        ...ledgerResponseMeta(ledger, {
          range,
          datePreset,
          accountId,
          site: siteAccount?.site ?? null,
          metaLevel: "campaign",
          metaFields: "campaign_name,campaign_id,impressions,clicks,spend",
        }),
        account_id: accountId,
        date_preset: datePreset,
        range,
        meta_reference: buildMetaReference(),
        adset_mapping_error: adsetCampaigns.error,
        ad_mapping_error: creativeEvidence.error,
        alias_mapping_error: aliasCampaigns.error,
        campaigns,
        summary: {
          spend: totalSpend,
          attributedRevenue: totalAttributedRevenue,
          roas: computeRoas(totalAttributedRevenue, totalSpend, ledger.entries.length > 0),
          orders: totalOrders,
          // 공동구매 분리 지표 (§ I): 기본 ROAS는 "일반 캠페인만", 전체/공동구매는 토글로 비교
          general: {
            spend: generalSpend,
            attributedRevenue: generalRevenue,
            roas: computeRoas(generalRevenue, generalSpend, ledger.entries.length > 0),
            orders: generalOrders,
          },
          coop: {
            spend: coopSpend,
            attributedRevenue: coopRevenue,
            roas: computeRoas(coopRevenue, coopSpend, ledger.entries.length > 0),
            orders: coopOrders,
            campaignCount: coopRows.length,
          },
        },
      });
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: error instanceof Error ? error.message : "ads roas failed",
      });
    }
  });

  router.get("/api/ads/campaign-ltv-roas", async (req: Request, res: Response) => {
    let cacheKey = "";
    try {
      const accountId = typeof req.query.account_id === "string" ? req.query.account_id.trim() : "";
      if (!accountId) {
        res.status(400).json({ ok: false, error: "account_id 필요" });
        return;
      }

      const datePreset = typeof req.query.date_preset === "string"
        ? req.query.date_preset.trim()
        : ADS_DEFAULT_DATE_PRESET;
      const range = resolveDatePresetRange(datePreset);
      if (!range) {
        res.status(400).json({ ok: false, error: `지원하지 않는 date_preset: ${datePreset}` });
        return;
      }
      const ltvWindowDays = Math.min(
        365,
        Math.max(30, Number.parseInt(typeof req.query.ltv_window_days === "string" ? req.query.ltv_window_days : "180", 10) || 180),
      );
      const forceRefresh = req.query.force === "true" || req.query.force === "1";

      // Lazy TTL cache (Option B): 첫 호출 15초 → 다음 5분간 ~10ms.
      cacheKey = `ltv-roas:${accountId}:${datePreset}:${ltvWindowDays}`;
      if (!forceRefresh) {
        const cached = getAdsLazyCached(cacheKey);
        if (cached) {
          res.json({ ...(cached.result as object), cache: buildAdsCacheMeta(cached, "lazy_cache_hit") });
          return;
        }
      }

      const siteAccount = findSiteAccountByAccountId(accountId);
      const ledgerOptions = ledgerQueryOptions(req, range, siteAccount ? [siteAccount.site] : undefined);
      const [metaResult, adsetCampaigns, creativeEvidence, aliasCampaigns, ledger] = await Promise.all([
        fetchMetaInsights({
          accountId,
          fields: "campaign_name,campaign_id,impressions,clicks,spend",
          level: "campaign",
          datePreset,
          limit: "100",
          actionReportTime: META_DEFAULT_ACTION_REPORT_TIME,
          useUnifiedAttributionSetting: META_DEFAULT_UNIFIED_ATTRIBUTION_SETTING,
        }),
        fetchMetaAdsetCampaignMap(accountId),
        fetchMetaAdCreativeEvidenceMaps(accountId),
        fetchManualVerifiedAliasMap(siteAccount?.site ?? null),
        loadLedgerOrders(ledgerOptions),
      ]);

      if (!metaResult.ok) {
        res.status(502).json(metaResult);
        return;
      }

      const filteredOrders = filterOrdersByRange(filterOrdersForAccount(ledger.orders, accountId), range);
      const campaigns = aggregateMetaCampaigns(metaResult.data);
      const campaignRoasRows = buildCampaignRoasRows({
        metaRows: metaResult.data,
        orders: filteredOrders,
        ledgerAvailable: ledger.entries.length > 0,
        adsetCampaignMap: adsetCampaigns.map,
        adCampaignMap: creativeEvidence.adMap,
        campaignAliasMap: mergeCampaignAliasMaps(aliasCampaigns.map, creativeEvidence.aliasMap),
      });
      const rows = await buildCampaignLtvRoasRows({
        campaignRows: campaignRoasRows,
        campaigns,
        orders: filteredOrders,
        range,
        adsetCampaignMap: adsetCampaigns.map,
        adCampaignMap: creativeEvidence.adMap,
        campaignAliasMap: mergeCampaignAliasMaps(aliasCampaigns.map, creativeEvidence.aliasMap),
        ltvWindowDays,
      });

      const mappedRows = rows.filter((row) => row.campaignId);
      const responseBody = {
        ok: true,
        ...ledgerResponseMeta(ledger, {
          range,
          datePreset,
          accountId,
          site: siteAccount?.site ?? null,
          metaLevel: "campaign",
          metaFields: "campaign_name,campaign_id,impressions,clicks,spend",
        }),
        account_id: accountId,
        date_preset: datePreset,
        range,
        ltv_window_days: ltvWindowDays,
        ltv_definition: "campaign에 귀속된 confirmed 주문 고객을 order_number/customer_number로 조인하고, anchor date 이후 LTV window 안의 전체 후속 주문 매출을 포함한다.",
        adset_mapping_error: adsetCampaigns.error,
        ad_mapping_error: creativeEvidence.error,
        alias_mapping_error: aliasCampaigns.error,
        rows,
        summary: {
          spend: round2(mappedRows.reduce((sum, row) => sum + row.spend, 0)),
          attributedRevenue: round2(mappedRows.reduce((sum, row) => sum + row.attributedRevenue, 0)),
          ltvRevenue: round2(mappedRows.reduce((sum, row) => sum + row.ltvRevenue, 0)),
          repeatRevenue: round2(mappedRows.reduce((sum, row) => sum + row.repeatRevenue, 0)),
          supplementRevenue: round2(mappedRows.reduce((sum, row) => sum + row.supplementRevenue, 0)),
          ltvRoas: computeRoas(
            mappedRows.reduce((sum, row) => sum + row.ltvRevenue, 0),
            mappedRows.reduce((sum, row) => sum + row.spend, 0),
            ledger.entries.length > 0,
          ),
          readyCampaigns: mappedRows.filter((row) => row.ltvStatus === "ready").length,
          blockedCampaigns: mappedRows.filter((row) => row.ltvStatus === "blocked" || row.ltvStatus === "identity_missing").length,
        },
      };
      // 캐시에 저장 (다음 5분간은 즉시 응답)
      const cached = setAdsLazyCached(cacheKey, responseBody);
      res.json({ ...responseBody, cache: buildAdsCacheMeta(cached, forceRefresh ? "live_force" : "live_cache_miss") });
    } catch (error) {
      const message = error instanceof Error ? error.message : "campaign ltv roas failed";
      // stale-while-revalidate
      if (cacheKey) {
        const stale = getAdsLazyCachedStale(cacheKey);
        if (stale) {
          res.json({
            ...(stale.result as object),
            cache: { ...buildAdsCacheMeta(stale, "lazy_cache_hit"), stale: true, stale_reason: message },
          });
          return;
        }
      }
      res.status(500).json({ ok: false, error: message });
    }
  });

  router.get("/api/ads/roas/daily", async (req: Request, res: Response) => {
    try {
      const accountId = typeof req.query.account_id === "string" ? req.query.account_id.trim() : "";
      if (!accountId) {
        res.status(400).json({ ok: false, error: "account_id 필요" });
        return;
      }

      const { range, datePreset } = resolveOptionalRange(req);
      const attributionWindow = parseMetaAttributionWindow(req.query.attribution_window);
      const siteAccount = findSiteAccountByAccountId(accountId);
      const ledgerOptions = ledgerQueryOptions(req, range, siteAccount ? [siteAccount.site] : undefined);
      const [metaResult, ledger] = await Promise.all([
        fetchMetaInsights({
          accountId,
          fields: "spend,action_values",
          datePreset: datePreset ?? undefined,
          range: datePreset ? undefined : range,
          timeIncrement: "1",
          limit: "400",
          actionReportTime: META_DEFAULT_ACTION_REPORT_TIME,
          useUnifiedAttributionSetting: attributionWindow
            ? false
            : META_DEFAULT_UNIFIED_ATTRIBUTION_SETTING,
          actionAttributionWindows: attributionWindow ? [attributionWindow] : undefined,
        }),
        loadLedgerOrders(ledgerOptions),
      ]);

      if (!metaResult.ok) {
        res.status(502).json(metaResult);
        return;
      }

      const dailyOrders = filterOrdersByDateRange(filterOrdersForAccount(ledger.orders, accountId), range);
      const rows = buildDailyRoasRows({
        range,
        metaRows: metaResult.data,
        orders: dailyOrders,
        ledgerAvailable: ledger.entries.length > 0,
        attributionWindow,
      });
      const totalSpend = round2(rows.reduce((sum, row) => sum + row.spend, 0));
      const totalRevenue = round2(rows.reduce((sum, row) => sum + row.revenue, 0));
      const totalPotentialRevenue = round2(rows.reduce((sum, row) => sum + row.potentialRevenue, 0));
      const totalMetaPurchaseValue = round2(rows.reduce((sum, row) => sum + row.metaPurchaseValue, 0));
      const totalOfficialRevenue = sumOfficialRevenue(dailyOrders.filter(isMetaAttributedOrder));
      const totalConfirmedRoas = computeRoas(totalRevenue, totalSpend, ledger.entries.length > 0);
      const totalOfficialRoas = computeRoas(totalOfficialRevenue, totalSpend, ledger.entries.length > 0);

      res.json({
        ok: true,
        ...ledgerResponseMeta(ledger, {
          range,
          datePreset,
          accountId,
          site: siteAccount?.site ?? null,
          attributionWindow,
          metaLevel: null,
          metaFields: "spend,action_values",
        }),
        account_id: accountId,
        date_preset: datePreset,
        start_date: range.startDate,
        end_date: range.endDate,
        meta_reference: buildMetaReference(attributionWindow ? {
          mode: "custom_window_override",
          requestedAttributionWindow: attributionWindow,
          appliedAttributionWindows: [attributionWindow],
        } : undefined),
        rows,
        summary: {
          spend: totalSpend,
          revenue: totalRevenue,
          confirmedRevenue: totalRevenue,
          pendingRevenue: round2(rows.reduce((sum, row) => sum + row.pendingRevenue, 0)),
          potentialRevenue: totalPotentialRevenue,
          metaPurchaseValue: totalMetaPurchaseValue,
          roas: totalConfirmedRoas,
          confirmedRoas: totalConfirmedRoas,
          officialRoas: totalOfficialRoas,
          fastSignalRoas: totalConfirmedRoas,
          roasGap: computeRoasGap(totalOfficialRoas, totalConfirmedRoas),
          potentialRoas: computeRoas(totalPotentialRevenue, totalSpend, ledger.entries.length > 0),
          metaPurchaseRoas: computeObservedRoas(totalMetaPurchaseValue, totalSpend),
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "daily roas failed";
      const status = message.includes("YYYY-MM-DD") || message.includes("start_date") || message.includes("attribution_window") ? 400 : 500;
      res.status(status).json({ ok: false, error: message });
    }
  });

  router.get("/api/ads/channel-comparison", async (req: Request, res: Response) => {
    try {
      const range = resolveExplicitRange(req);
      const ledgerOptions = ledgerQueryOptions(req, range);
      const [siteResults, ledger] = await Promise.all([
        Promise.all(SITE_ACCOUNTS.map((site) => fetchSiteMetaSummary({
          site: site.site,
          accountId: site.accountId,
          range,
          datePreset: null,
        }))),
        loadLedgerOrders(ledgerOptions),
      ]);

      const filteredOrders = filterOrdersByRange(ledger.orders, range);
      const metaOrders = filteredOrders.filter(isMetaAttributedOrder);
      const googleOrders = filteredOrders.filter(isGoogleAttributedOrder);
      const daangnOrders = filteredOrders.filter(isDaangnAttributedOrder);
      const metaTotals = siteResults.reduce<MetaTotals>((sum, site) => ({
        impressions: sum.impressions + site.impressions,
        clicks: sum.clicks + site.clicks,
        spend: sum.spend + site.spend,
        cpc: 0,
        cpm: 0,
        landingPageViews: 0,
        leads: 0,
        purchases: 0,
        purchaseValue: 0,
      }), {
        impressions: 0,
        clicks: 0,
        spend: 0,
        cpc: 0,
        cpm: 0,
        landingPageViews: 0,
        leads: 0,
        purchases: 0,
        purchaseValue: 0,
      });

      const channels: ChannelComparisonRow[] = [
        {
          channel: "meta",
          spend: round2(metaTotals.spend),
          impressions: metaTotals.impressions,
          clicks: metaTotals.clicks,
          revenue: sumRevenue(metaOrders),
          roas: computeRoas(sumRevenue(metaOrders), metaTotals.spend, ledger.entries.length > 0),
          placeholder: false,
          dataSource: "meta_insights + attribution_ledger",
        },
        {
          channel: "google",
          spend: 0,
          impressions: 0,
          clicks: 0,
          revenue: sumRevenue(googleOrders),
          roas: null,
          placeholder: true,
          dataSource: "attribution_ledger placeholder (GA4/Ads spend 미연동)",
        },
        {
          channel: "daangn",
          spend: 0,
          impressions: 0,
          clicks: 0,
          revenue: sumRevenue(daangnOrders),
          roas: null,
          placeholder: true,
          dataSource: "attribution_ledger placeholder (수동 입력 테이블 미구현)",
        },
      ];

      res.json({
        ok: true,
        ...ledgerResponseMeta(ledger, {
          range,
          datePreset: null,
          attributionWindow: null,
          metaLevel: null,
          metaFields: "spend",
        }),
        start_date: range.startDate,
        end_date: range.endDate,
        channels,
        metaErrors: siteResults
          .filter((site) => site.metaError)
          .map((site) => ({ site: site.site, account_id: site.accountId, error: site.metaError })),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "channel comparison failed";
      const status = message.includes("YYYY-MM-DD") || message.includes("start_date") ? 400 : 500;
      res.status(status).json({ ok: false, error: message });
    }
  });

  router.get("/api/ads/site-summary", async (req: Request, res: Response) => {
    // cacheKey 를 try 밖에 선언해 catch 에서 stale-fallback 참조 가능하게.
    let cacheKey = "";
    try {
      const { range, datePreset } = resolveOptionalRange(req);
      const attributionWindow = parseMetaAttributionWindow(req.query.attribution_window);
      const forceRefresh = req.query.force === "true" || req.query.force === "1";

      // Lazy TTL cache — 첫 호출 2~5초, 다음 5분간 ~10ms.
      cacheKey = `site-summary:${datePreset}:${attributionWindow ?? "default"}`;
      if (!forceRefresh) {
        const cached = getAdsLazyCached(cacheKey);
        if (cached) {
          res.json({ ...(cached.result as object), cache: buildAdsCacheMeta(cached, "lazy_cache_hit") });
          return;
        }
      }
      const ledgerOptions = ledgerQueryOptions(req, range);
      const [siteResults, ledger] = await Promise.all([
        Promise.all(SITE_ACCOUNTS.map((site) => fetchSiteMetaSummary({
          site: site.site,
          accountId: site.accountId,
          range,
          datePreset,
          attributionWindow,
        }))),
        loadLedgerOrders(ledgerOptions),
      ]);

      const ledgerAvailable = ledger.entries.length > 0;
      const filteredOrders = filterOrdersByRange(ledger.orders, range).filter(isMetaAttributedOrder);
      const datedOrders = filterOrdersByDateRange(ledger.orders, range);
      const sites: SiteRoasSummary[] = siteResults.map((site) => {
        const siteOrders = filteredOrders.filter((order) => order.site === site.site);
        const sitePendingOrders = datedOrders.filter((order) =>
          order.site === site.site && isMetaAttributedOrder(order) && order.paymentStatus === "pending");
        const siteAllConfirmedOrders = datedOrders.filter((order) =>
          order.site === site.site && order.paymentStatus === "confirmed");
        const siteOfficialOrders = datedOrders.filter((order) =>
          order.site === site.site && isMetaAttributedOrder(order) && order.businessConfirmed);
        const revenue = sumRevenue(siteOrders);
        const pendingRevenue = sumRevenue(sitePendingOrders);
        const potentialRevenue = round2(revenue + pendingRevenue);
        const siteConfirmedRevenue = sumRevenue(siteAllConfirmedOrders);
        const officialRevenue = sumOfficialRevenue(siteOfficialOrders);
        const confirmedRoas = computeRoas(revenue, site.spend, ledgerAvailable);
        const officialRoas = computeRoas(officialRevenue, site.spend, ledgerAvailable);
        return {
          site: site.site,
          account_id: site.accountId,
          impressions: site.impressions,
          clicks: site.clicks,
          spend: round2(site.spend),
          cpc: site.cpc,
          cpm: site.cpm,
          landing_page_views: site.landingPageViews,
          leads: site.leads,
          purchases: site.purchases,
          purchase_value: round2(site.purchaseValue),
          revenue,
          roas: confirmedRoas,
          orders: siteOrders.length,
          confirmedRevenue: revenue,
          confirmedOrders: siteOrders.length,
          pendingRevenue,
          pendingOrders: sitePendingOrders.length,
          potentialRevenue,
          confirmedRoas,
          officialRoas,
          fastSignalRoas: confirmedRoas,
          roasGap: computeRoasGap(officialRoas, confirmedRoas),
          potentialRoas: computeRoas(potentialRevenue, site.spend, ledgerAvailable),
          metaPurchaseValue: round2(site.purchaseValue),
          metaPurchaseRoas: computeObservedRoas(round2(site.purchaseValue), site.spend),
          siteConfirmedRevenue,
          siteConfirmedOrders: siteAllConfirmedOrders.length,
          bestCaseCeilingRoas: computeRoas(siteConfirmedRevenue, site.spend, ledgerAvailable),
          metaError: site.metaError,
        };
      });

      const totalSpend = round2(sites.reduce((sum, site) => sum + site.spend, 0));
      const totalRevenue = round2(sites.reduce((sum, site) => sum + site.revenue, 0));
      const totalPendingRevenue = round2(sites.reduce((sum, site) => sum + site.pendingRevenue, 0));
      const totalPotentialRevenue = round2(sites.reduce((sum, site) => sum + site.potentialRevenue, 0));
      const totalMetaPurchaseValue = round2(sites.reduce((sum, site) => sum + site.metaPurchaseValue, 0));
      const totalOfficialRevenue = sumOfficialRevenue(
        datedOrders.filter((order) => isMetaAttributedOrder(order) && order.businessConfirmed),
      );
      const totalConfirmedRoas = computeRoas(totalRevenue, totalSpend, ledgerAvailable);
      const totalOfficialRoas = computeRoas(totalOfficialRevenue, totalSpend, ledgerAvailable);

      const responseBody = {
        ok: true,
        ...ledgerResponseMeta(ledger, {
          range,
          datePreset,
          attributionWindow,
          metaLevel: null,
          metaFields: "impressions,clicks,spend,cpc,cpm,actions,action_values",
        }),
        date_preset: datePreset,
        start_date: range.startDate,
        end_date: range.endDate,
        meta_reference: buildMetaReference(attributionWindow ? {
          mode: "custom_window_override",
          requestedAttributionWindow: attributionWindow,
          appliedAttributionWindows: [attributionWindow],
        } : undefined),
        sites,
        total: {
          impressions: sites.reduce((sum, site) => sum + site.impressions, 0),
          clicks: sites.reduce((sum, site) => sum + site.clicks, 0),
          spend: totalSpend,
          revenue: totalRevenue,
          roas: totalConfirmedRoas,
          confirmedRevenue: totalRevenue,
          pendingRevenue: totalPendingRevenue,
          potentialRevenue: totalPotentialRevenue,
          metaPurchaseValue: totalMetaPurchaseValue,
          confirmedRoas: totalConfirmedRoas,
          officialRoas: totalOfficialRoas,
          fastSignalRoas: totalConfirmedRoas,
          roasGap: computeRoasGap(totalOfficialRoas, totalConfirmedRoas),
          potentialRoas: computeRoas(totalPotentialRevenue, totalSpend, ledgerAvailable),
          metaPurchaseRoas: computeObservedRoas(totalMetaPurchaseValue, totalSpend),
          orders: sites.reduce((sum, site) => sum + site.orders, 0),
        },
      };
      const cachedEntry = setAdsLazyCached(cacheKey, responseBody);
      res.json({ ...responseBody, cache: buildAdsCacheMeta(cachedEntry, forceRefresh ? "live_force" : "live_cache_miss") });
    } catch (error) {
      const message = error instanceof Error ? error.message : "site summary failed";
      const status = message.includes("YYYY-MM-DD") || message.includes("date_preset") || message.includes("attribution_window") ? 400 : 500;
      // stale-while-revalidate — Meta API 일시 실패 시 옛 cache 가 있으면 반환
      if (status === 500 && cacheKey) {
        const stale = getAdsLazyCachedStale(cacheKey);
        if (stale) {
          res.json({
            ...(stale.result as object),
            cache: { ...buildAdsCacheMeta(stale, "lazy_cache_hit"), stale: true, stale_reason: message },
          });
          return;
        }
      }
      res.status(status).json({ ok: false, error: message });
    }
  });

  router.get("/api/ads/campaign-alias-review", async (req: Request, res: Response) => {
    try {
      const site = typeof req.query.site === "string" ? req.query.site.trim() : "biocom";
      const review = await loadAliasReviewItems(site);
      res.json({
        ok: true,
        site: review.site,
        generated_at: review.generatedAt,
        summary: review.summary,
        items: review.items,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "campaign alias review failed";
      const status = message.includes("지원하지 않는 site") ? 400 : 500;
      res.status(status).json({ ok: false, error: message });
    }
  });

  router.post("/api/ads/campaign-alias-review/decision", express.json(), async (req: Request, res: Response) => {
    try {
      const site = typeof req.body?.site === "string" ? req.body.site.trim() : "";
      const aliasKey = typeof req.body?.aliasKey === "string" ? req.body.aliasKey.trim() : "";
      const campaignId = typeof req.body?.campaignId === "string" ? req.body.campaignId.trim() : "";
      const decision = typeof req.body?.decision === "string"
        ? req.body.decision.trim().toLowerCase()
        : "";

      if (!site || !aliasKey || !campaignId) {
        res.status(400).json({ ok: false, error: "site, aliasKey, campaignId 필요" });
        return;
      }
      if (decision !== "yes" && decision !== "no") {
        res.status(400).json({ ok: false, error: "decision 은 yes 또는 no 이어야 함" });
        return;
      }

      const item = await applyAliasReviewDecision({
        site,
        aliasKey,
        campaignId,
        decision: decision as AliasReviewDecision,
      });
      res.json({
        ok: true,
        item,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "campaign alias review decision failed";
      const status = message.includes("need")
        || message.includes("지원하지 않는 site")
        || message.includes("not found")
        ? 400
        : 500;
      res.status(status).json({ ok: false, error: message });
    }
  });

  router.get("/api/ads/iroas/experiments", async (_req: Request, res: Response) => {
    try {
      const experiments = await loadExperimentIroasSnapshots();
      res.json({
        ok: true,
        experiments: experiments.map((experiment) => ({
          experiment_key: experiment.experiment_key,
          name: experiment.name,
          status: experiment.status,
          channel: experiment.channel,
          treatment_revenue: experiment.treatment_revenue,
          control_revenue: experiment.control_revenue,
          incremental_revenue: experiment.incremental_revenue,
          ad_spend: experiment.ad_spend,
          iroas: experiment.iroas,
          treatment_count: experiment.treatment_count,
          control_count: experiment.control_count,
          treatment_purchase_rate: experiment.treatment_purchase_rate,
          control_purchase_rate: experiment.control_purchase_rate,
        })),
      });
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: error instanceof Error ? error.message : "iroas experiments failed",
      });
    }
  });

  router.get("/api/ads/iroas/experiments/:key", async (req: Request, res: Response) => {
    try {
      const experiment = listExperiments().find((item) => item.experiment_key === req.params.key);
      if (!experiment) {
        res.status(404).json({ ok: false, error: "experiment not found" });
        return;
      }

      const loadMetaSpend = createMetaSpendLoader();
      const snapshot = await buildExperimentIroasSnapshot(experiment, loadMetaSpend);

      res.json({
        ok: true,
        experiment: {
          experiment_key: snapshot.experiment_key,
          name: snapshot.name,
          status: snapshot.status,
          channel: snapshot.channel,
          start_date: snapshot.start_date,
          end_date: snapshot.end_date,
          site_scope: snapshot.site_scope,
          treatment_revenue: snapshot.treatment_revenue,
          control_revenue: snapshot.control_revenue,
          incremental_revenue: snapshot.incremental_revenue,
          ad_spend: snapshot.ad_spend,
          roas: snapshot.roas,
          iroas: snapshot.iroas,
          treatment_count: snapshot.treatment_count,
          control_count: snapshot.control_count,
          treatment_purchase_rate: snapshot.treatment_purchase_rate,
          control_purchase_rate: snapshot.control_purchase_rate,
          treatment_purchaser_count: snapshot.treatment_purchaser_count,
          control_purchaser_count: snapshot.control_purchaser_count,
          treatment_purchase_count: snapshot.treatment_purchase_count,
          control_purchase_count: snapshot.control_purchase_count,
        },
        variants: snapshot.variants.map((variant) => ({
          variant_key: variant.variant_key,
          group: variant.group,
          assignment_count: variant.assignment_count,
          purchaser_count: variant.purchaser_count,
          purchase_count: variant.purchase_count,
          purchase_rate: variant.purchase_rate,
          revenue_amount: variant.revenue_amount,
          refund_amount: variant.refund_amount,
          net_revenue: variant.net_revenue,
        })),
        calculation: {
          formula: "iROAS = (treatment_revenue - control_revenue) / ad_spend",
          treatment_revenue: snapshot.treatment_revenue,
          control_revenue: snapshot.control_revenue,
          incremental_revenue: snapshot.incremental_revenue,
          ad_spend: snapshot.ad_spend,
          iroas: snapshot.iroas,
          comparable_groups: snapshot.treatment_count > 0 && snapshot.control_count > 0,
        },
        meta_errors: snapshot.meta_errors,
      });
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: error instanceof Error ? error.message : "iroas experiment detail failed",
      });
    }
  });

  router.get("/api/ads/iroas/channel-comparison", async (_req: Request, res: Response) => {
    try {
      const snapshots = await loadExperimentIroasSnapshots();
      const grouped = new Map<string, {
        channel: string;
        ad_spend: number;
        incremental_revenue: number;
        treatment_revenue: number;
        experiments: number;
      }>();

      for (const snapshot of snapshots) {
        const key = snapshot.channel.trim().toLowerCase() || "unknown";
        const existing = grouped.get(key) ?? {
          channel: snapshot.channel,
          ad_spend: 0,
          incremental_revenue: 0,
          treatment_revenue: 0,
          experiments: 0,
        };
        existing.ad_spend += snapshot.ad_spend;
        existing.incremental_revenue += snapshot.incremental_revenue;
        existing.treatment_revenue += snapshot.treatment_revenue;
        existing.experiments += 1;
        grouped.set(key, existing);
      }

      res.json({
        ok: true,
        channels: [...grouped.values()]
          .map((channel) => ({
            channel: channel.channel,
            ad_spend: round2(channel.ad_spend),
            incremental_revenue: round2(channel.incremental_revenue),
            iroas: computeSpendRatio(
              channel.incremental_revenue,
              channel.ad_spend,
              channel.experiments > 0,
            ),
            roas: computeSpendRatio(
              channel.treatment_revenue,
              channel.ad_spend,
              channel.experiments > 0,
            ),
            experiments: channel.experiments,
          }))
          .sort((a, b) => {
            const aScore = a.iroas ?? Number.NEGATIVE_INFINITY;
            const bScore = b.iroas ?? Number.NEGATIVE_INFINITY;
            return bScore - aScore || b.incremental_revenue - a.incremental_revenue;
          }),
        meta_errors: dedupeMetaErrors(snapshots.flatMap((snapshot) => snapshot.meta_errors)),
      });
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: error instanceof Error ? error.message : "iroas channel comparison failed",
      });
    }
  });

  router.get("/api/ads/iroas/trend", async (_req: Request, res: Response) => {
    try {
      const snapshots = await loadExperimentIroasSnapshots();
      const cycles = [...snapshots]
        .sort((a, b) => (
          (a.start_date ?? "").localeCompare(b.start_date ?? "")
          || a.experiment_key.localeCompare(b.experiment_key)
        ))
        .map((snapshot, index) => ({
          cycle: index + 1,
          experiment_key: snapshot.experiment_key,
          name: snapshot.name,
          status: snapshot.status,
          channel: snapshot.channel,
          start_date: snapshot.start_date,
          end_date: snapshot.end_date,
          ad_spend: snapshot.ad_spend,
          treatment_revenue: snapshot.treatment_revenue,
          control_revenue: snapshot.control_revenue,
          incremental_revenue: snapshot.incremental_revenue,
          roas: snapshot.roas,
          iroas: snapshot.iroas,
        }));

      res.json({
        ok: true,
        cycles,
        meta_errors: dedupeMetaErrors(snapshots.flatMap((snapshot) => snapshot.meta_errors)),
      });
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: error instanceof Error ? error.message : "iroas trend failed",
      });
    }
  });

  // 2026-04-21 Phase3-Sprint7. 공동구매 주문 단위 분리 v2 엔드포인트 스켈레톤.
  // classifyCoopOrder helper를 실제로 호출해 주문 단위로 공동구매 여부 판정. campaigns 마스터 기반.
  router.get("/api/ads/coop-order-summary", async (req: Request, res: Response) => {
    try {
      const siteParam: SiteKey = resolveSiteFromString(String(req.query.site ?? "biocom")) ?? "biocom";
      const startDate = String(req.query.start_date ?? "").trim() || "2026-01-01";
      const endDate = String(req.query.end_date ?? "").trim() || "2026-04-01";
      if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
        res.status(400).json({ ok: false, error: "start_date / end_date must be YYYY-MM-DD" });
        return;
      }

      const master = await loadCoopCampaignsMaster(siteParam);
      const db = getCrmDb();

      const orders = db
        .prepare(
          `SELECT o.order_no, o.payment_amount, o.order_time
           FROM imweb_orders o
           WHERE o.site = ? AND o.order_time >= ? AND o.order_time < ?`,
        )
        .all(siteParam, `${startDate}T00:00:00.000Z`, `${endDate}T00:00:00.000Z`) as Array<{
          order_no: string;
          payment_amount: number;
          order_time: string;
        }>;

      const itemsStmt = db.prepare(
        `SELECT item_name FROM imweb_order_items WHERE site = ? AND order_no = ?`,
      );
      // attribution_ledger 조인은 선택적 (2026-03-29 이후 데이터만 존재)
      const attrStmt = db.prepare(
        `SELECT utm_source, utm_campaign, landing
         FROM attribution_ledger
         WHERE order_id = ?
         ORDER BY logged_at DESC LIMIT 1`,
      );

      type BasisCount = { orders: number; revenue: number };
      const emptyBasis = (): BasisCount => ({ orders: 0, revenue: 0 });
      const byBasis: Record<string, BasisCount> = {
        allowlist: emptyBasis(),
        utm_campaign: emptyBasis(),
        utm_source: emptyBasis(),
        landing: emptyBasis(),
        product_family: emptyBasis(),
        product_name_pattern: emptyBasis(),
        unmatched: emptyBasis(),
      };

      const byCampaign = new Map<
        string,
        { campaign_id: string; partner: string; round: number | null; orders: number; revenue: number }
      >();

      let coopOrders = 0;
      let coopRevenue = 0;

      for (const o of orders) {
        const items = itemsStmt.all(siteParam, o.order_no) as Array<{ item_name: string }>;
        const attr = attrStmt.get(o.order_no) as
          | { utm_source?: string; utm_campaign?: string; landing?: string }
          | undefined;
        const match = classifyCoopOrder(
          {
            orderNo: o.order_no,
            utmSource: attr?.utm_source ?? null,
            utmCampaign: attr?.utm_campaign ?? null,
            landing: attr?.landing ?? null,
            itemNames: items.map((i) => i.item_name),
            orderTime: o.order_time,
          },
          master,
        );

        if (!match.isCoop) {
          byBasis.unmatched.orders += 1;
          byBasis.unmatched.revenue += Number(o.payment_amount ?? 0);
          continue;
        }
        coopOrders += 1;
        coopRevenue += Number(o.payment_amount ?? 0);

        const basisKey = match.basis ?? "unmatched";
        if (byBasis[basisKey]) {
          byBasis[basisKey].orders += 1;
          byBasis[basisKey].revenue += Number(o.payment_amount ?? 0);
        }

        if (match.campaignId) {
          const rec = master.find((m) => m.campaign_id === match.campaignId);
          const key = match.campaignId;
          const existing =
            byCampaign.get(key) ??
            {
              campaign_id: match.campaignId,
              partner: rec?.partner ?? "",
              round: rec?.round ?? null,
              orders: 0,
              revenue: 0,
            };
          existing.orders += 1;
          existing.revenue += Number(o.payment_amount ?? 0);
          byCampaign.set(key, existing);
        }
      }

      let operationalDbCoop: Record<string, unknown> | null = null;
      if (siteParam === "biocom") {
        const operationalEndDate = endDate > startDate ? shiftIsoDateByDays(endDate, -1) : endDate;
        try {
          const summary = await readOperationalCoopRangeSummary({ startDate, endDate: operationalEndDate });
          operationalDbCoop = {
            status: "included",
            source: "operational_db.public.tb_influencer_group_buy_customer read-only",
            source_location: "operational_db",
            range: { start: startDate, end_inclusive: operationalEndDate },
            rows: summary.rows,
            group_buys: summary.groupBuys,
            gross_amount: summary.grossAmount,
            included_rows: summary.includedRows,
            included_amount: summary.includedAmount,
            excluded_rows: summary.excludedRows,
            excluded_amount: summary.excludedAmount,
            top_groups: summary.topGroups,
            note: "VM Cloud 상품명/마스터 매칭과 별개로 운영DB 공동구매 테이블을 primary cross-check로 제공한다.",
          };
        } catch (error) {
          operationalDbCoop = {
            status: "unavailable",
            source: "operational_db.public.tb_influencer_group_buy_customer read-only",
            source_location: "operational_db",
            error: error instanceof Error ? error.message : String(error),
          };
        }
      }

      res.json({
        ok: true,
        site: siteParam,
        range: { start: startDate, end: endDate },
        campaigns_loaded: master.length,
        orders: {
          total_in_range: orders.length,
          coop_matched: coopOrders,
          coop_revenue: round2(coopRevenue),
        },
        by_basis: Object.fromEntries(
          Object.entries(byBasis).map(([k, v]) => [k, { orders: v.orders, revenue: round2(v.revenue) }]),
        ),
        by_campaign: Array.from(byCampaign.values())
          .map((c) => ({ ...c, revenue: round2(c.revenue) }))
          .sort((a, b) => b.revenue - a.revenue),
        operational_db_coop: operationalDbCoop,
      });
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: error instanceof Error ? error.message : "coop-order-summary failed",
      });
    }
  });

  return router;
};
