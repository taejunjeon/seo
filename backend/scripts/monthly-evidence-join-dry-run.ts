import { getPgPool, queryPg } from "../src/postgres";
import { env } from "../src/env";
import { buildNpayRoasDryRunReport, type NpayRoasDryRunOrderResult, type NpayRoasDryRunReport } from "../src/npayRoasDryRun";
import { buildTikTokRoasComparison } from "../src/tiktokRoasComparison";
import { summarizeNaverAdsDaily } from "../src/naverAdsLocalDb";
import { google } from "googleapis";

type Options = {
  site: "biocom";
  month: string;
  since: string | null;
  until: string | null;
  json: boolean;
  npayIntentDbPath?: string;
};

type SpineRow = {
  order_number: string;
  channel_order_no: string | null;
  payment_key: string | null;
  order_id: string | null;
  order_id_base: string | null;
  payment_method: string;
  payment_status: string;
  subscription_sequence: string | number | null;
  subscription_member_key_present: boolean | string | null;
  gross_revenue: string | number;
  net_revenue: string | number;
  join_method: string;
  join_confidence: string;
};

type LedgerItem = {
  touchpoint?: string;
  captureMode?: string;
  paymentStatus?: string | null;
  loggedAt?: string;
  orderId?: string;
  paymentKey?: string;
  checkoutId?: string;
  landing?: string;
  referrer?: string;
  gaSessionId?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  gclid?: string;
  fbclid?: string;
  ttclid?: string;
  metadata?: Record<string, unknown>;
};

type Assignment = {
  orderNumber: string;
  netRevenue: number;
  joinMethod: string;
  primaryChannel: string;
  assistChannels: string[];
  evidenceConfidence: "A" | "B" | "C" | "D";
  evidenceTier: string;
  unknownReason: string;
  unknownDetail?: string;
  matchedBy: string[];
  npayIntentStatus?: string;
  subscriptionSequence?: number | null;
  subscriptionMemberKeyPresent?: boolean | null;
  utmAudit?: UtmAuditSignature;
};

type ChannelSummaryRow = {
  primaryChannel: string;
  orders: number;
  revenue: number;
  confidence: Record<string, number>;
};

type UnknownReasonDetailRow = {
  rootReason: string;
  detail: string;
  orders: number;
  revenue: number;
  nextEvidenceNeeded: string;
  recommendedFix: string;
  confidence: Assignment["evidenceConfidence"];
};

type EvidenceAuditRow = {
  label: string;
  orders: number;
  revenue: number | null;
  confidence: Assignment["evidenceConfidence"] | "aggregate_only";
  source: string;
  useForBudgetRoas: "yes_order_level" | "reference_only" | "no";
  note: string;
};

type UtmAuditSignature = {
  source: string;
  medium: string;
  campaign: string;
  family: string;
  candidateRule: string;
};

type UtmInvalidAuditRow = UtmAuditSignature & {
  orders: number;
  revenue: number;
  useForBudgetRoas: "reference_only_not_budget";
  note: string;
};

type NaverEvidenceAggregateRow = {
  class:
    | "paid_naver"
    | "naver_brandsearch"
    | "naver_shopping_search_candidate"
    | "organic_naver_candidate"
    | "naver_referrer_or_utm_only";
  touchpoint: string;
  rows: number;
  bridgeKeyPresent: number;
  confidence: "B" | "C" | "aggregate_only";
  budgetRoasIncluded: false;
  useForBudgetRoas: "reference_only_not_budget";
  note: string;
};

const NAVER_EVIDENCE_CLASSES: NaverEvidenceAggregateRow["class"][] = [
  "paid_naver",
  "naver_brandsearch",
  "naver_shopping_search_candidate",
  "organic_naver_candidate",
  "naver_referrer_or_utm_only",
];

type NaverEvidenceAggregate = {
  contractVersion: string;
  aggregateOnly: true;
  rawIdentifierOutput: false;
  budgetRoasIncluded: false;
  source: string;
  coverageStatus: "full_aggregate" | "limited_item_slice_fallback" | "unavailable";
  endpointStatus: "available" | "unavailable";
  filters: Record<string, unknown>;
  summary: {
    rowsTotal: number;
    naverAny: number;
    byClass: Record<string, number>;
  };
  rows: NaverEvidenceAggregateRow[];
  warnings: string[];
};

type SubscriptionAcquisitionSummary = {
  renewable_order_count: number;
  renewable_revenue: number;
  first_subscription_order_count: number;
  first_subscription_revenue: number;
  first_acquisition_channel_found: number;
  first_acquisition_revenue_found: number;
  archive_lookup_needed: number;
  archive_lookup_needed_revenue: number;
  member_key_missing: number;
  member_key_missing_revenue: number;
};

type PlatformReferenceRow = {
  platform: "meta" | "tiktok" | "google" | "naver";
  internalChannel: string;
  internalConfirmed: {
    orders: number;
    revenue: number;
    confidenceRevenue: Record<string, number>;
  };
  platformReference: {
    status: "joined" | "not_joined" | "unavailable";
    source: string;
    spendKrw: number | null;
    conversionValueKrw: number | null;
    roas: number | null;
    attributionWindow: string | null;
    actionReportTime: string | null;
    queriedAt: string | null;
    freshness: "fresh" | "local_cache" | "not_queried" | "blocked" | "error";
    error: string | null;
    sourceWindow: {
      startDate: string | null;
      endDate: string | null;
      latestDate: string | null;
    };
    sourceDiagnostics: Record<string, unknown> | null;
  };
  gap: {
    conversionValueMinusInternalRevenue: number | null;
    roasDelta: number | null;
    reason: string;
  };
  allowedUse: "platform_reference_only";
  forbiddenUse: "do_not_add_to_internal_confirmed_revenue";
};

const CONTRACT_VERSION = "monthly-evidence-join-dry-run-v0.5";
const ATTRIBUTION_BASE_URL = process.env.ATTRIBUTION_OPERATIONAL_BASE_URL || "https://att.ainativeos.net";

const argValue = (name: string) => {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
};

const parseArgs = (): Options => {
  const site = argValue("site") || "biocom";
  const since = argValue("since");
  const until = argValue("until");
  const month = argValue("month") || (!since && !until ? "2026-04" : "");

  if (site !== "biocom") throw new Error("Only --site=biocom is supported in v0.1");
  // --since/--until 가 주어지면 그 윈도우 우선. 둘 다 주어져야 함.
  if (since || until) {
    if (!since || !until) throw new Error("--since 와 --until 은 함께 지정");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(since)) throw new Error("--since must be YYYY-MM-DD");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(until)) throw new Error("--until must be YYYY-MM-DD");
    if (since > until) throw new Error("--since must be <= --until");
  } else if (!/^\d{4}-\d{2}$/.test(month)) {
    throw new Error("--month must be YYYY-MM (또는 --since/--until 사용)");
  }

  return {
    site,
    month: month || `${since}~${until}`,
    since: since ?? null,
    until: until ?? null,
    json: process.argv.includes("--json"),
    npayIntentDbPath: argValue("npay-intent-db"),
  };
};

const monthRange = (month: string) => {
  const [yearRaw, monthRaw] = month.split("-");
  const year = Number(yearRaw);
  const monthIndex = Number(monthRaw) - 1;
  const startKstAsUtc = new Date(Date.UTC(year, monthIndex, 0, 15, 0, 0));
  const endKstAsUtc = new Date(Date.UTC(year, monthIndex + 1, 0, 15, 0, 0));
  const fmtDate = (date: Date) =>
    `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;

  return {
    startDate: `${yearRaw}-${monthRaw}-01`,
    endDateExclusive: fmtDate(new Date(Date.UTC(year, monthIndex + 1, 1))),
    startAtUtc: startKstAsUtc.toISOString(),
    endAtUtc: endKstAsUtc.toISOString(),
  };
};

// since~until (둘 다 inclusive YYYY-MM-DD KST) 를 monthRange 와 동일 shape 으로 반환.
const customRange = (since: string, until: string) => {
  const [sYear, sMonth, sDay] = since.split("-").map((v) => Number(v));
  const [uYear, uMonth, uDay] = until.split("-").map((v) => Number(v));
  // KST 00:00 = UTC 15:00 (전일)
  const startKstAsUtc = new Date(Date.UTC(sYear, sMonth - 1, sDay - 1, 15, 0, 0));
  const endKstAsUtc = new Date(Date.UTC(uYear, uMonth - 1, uDay, 15, 0, 0));
  const fmtDate = (date: Date) =>
    `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
  return {
    startDate: since,
    endDateExclusive: fmtDate(new Date(Date.UTC(uYear, uMonth - 1, uDay + 1))),
    startAtUtc: startKstAsUtc.toISOString(),
    endAtUtc: endKstAsUtc.toISOString(),
  };
};

const toNumber = (value: string | number | null | undefined) => {
  if (typeof value === "number") return value;
  if (!value) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const krw = (value: string | number | null | undefined) => `${toNumber(value).toLocaleString("ko-KR")}원`;

const round2 = (value: number) => Math.round(value * 100) / 100;
const roas = (value: number | null, spend: number | null) =>
  value != null && spend != null && spend > 0 ? round2(value / spend) : null;

const previousDate = (isoDate: string) => {
  const [year, month, day] = isoDate.split("-").map((part) => Number.parseInt(part, 10));
  return new Date(Date.UTC(year, month - 1, day - 1)).toISOString().slice(0, 10);
};

const normalizeOrderIdBase = (value: unknown) =>
  typeof value === "string" ? value.trim().replace(/(?:-|_)(?:p|pay)\d+$/i, "") : "";

const readString = (value: unknown) => (typeof value === "string" ? value.trim() : "");

const objectValue = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

const includesAny = (value: string, tokens: string[]) => {
  const lower = value.toLowerCase();
  return tokens.some((token) => lower.includes(token));
};

const evidenceText = (entry: LedgerItem) => [
  entry.landing,
  entry.referrer,
  entry.utmSource,
  entry.utmMedium,
  entry.utmCampaign,
  entry.utmTerm,
  entry.utmContent,
].map((value) => readString(value).toLowerCase()).join(" ");

const getFirstTouch = (entry: LedgerItem) => objectValue(entry.metadata?.firstTouch);
const getFirstTouchMatch = (entry: LedgerItem) => objectValue(entry.metadata?.firstTouchMatch);

const safeUrlParam = (key: string, ...values: unknown[]) => {
  for (const value of values) {
    const raw = readString(value);
    if (!raw) continue;
    try {
      const parsed = new URL(raw, "https://biocom.kr");
      const found = parsed.searchParams.get(key)?.trim();
      if (found) return found;
    } catch {
      // Ignore malformed URL evidence and continue with other fields.
    }
  }
  return "";
};

const decodeTextLoose = (value: string) => {
  if (!value) return "";
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const extractNapmTrCode = (napm: string) => {
  const decoded = decodeTextLoose(napm);
  return decoded.match(/(?:^|\|)tr=([^|&]+)/i)?.[1]?.toLowerCase() || "";
};

const paidMedium = (value: unknown) =>
  /^(cpc|ppc|paid|paid_social|social_paid|display|shopping|performance|max)$/i.test(readString(value));

const sourceIs = (value: unknown, tokens: string[]) => {
  const source = readString(value).toLowerCase();
  return tokens.some((token) => source.includes(token));
};

const hasAnyValue = (...values: unknown[]) => values.some((value) => readString(value).length > 0);
const confidenceRank = (confidence: Assignment["evidenceConfidence"]) => ({
  A: 4,
  B: 3,
  C: 2,
  D: 1,
}[confidence] || 0);

const safeUtmPart = (value: unknown) => {
  const normalized = readString(value).trim().toLowerCase().replace(/\s+/g, "_");
  if (!normalized) return "(blank)";
  return normalized.slice(0, 80);
};

const hasWordToken = (text: string, tokens: string[]) =>
  tokens.some((token) => new RegExp(`(^|[^a-z0-9])${token}([^a-z0-9]|$)`, "i").test(text));

const utmFamily = (source: string, medium: string, campaign: string) => {
  const text = `${source} ${medium} ${campaign}`.toLowerCase();
  if (text.includes("naverbrandsearch") || text.includes("brandsearch")) return "naver_brandsearch";
  if (text.includes("powerlink") || text.includes("shoppingsearch")) return "paid_naver_candidate";
  if (text.includes("naver") && hasWordToken(text, ["cpc", "paid", "powerlink", "search", "sa", "bs"])) {
    return "paid_naver_candidate";
  }
  if (text.includes("naver")) return "naver_utm_needs_rule";
  if (text.includes("kakao") || text.includes("talk")) return "kakao_candidate";
  if (hasWordToken(text, ["meta", "facebook", "instagram", "fb"])) return "meta_candidate";
  if (text.includes("google") || text.includes("youtube")) return "google_candidate";
  return "unknown_utm_invalid";
};

const utmCandidateRule = (family: string) => {
  if (family === "naver_brandsearch") return "naver_brandsearch_reference";
  if (family === "paid_naver_candidate") return "paid_naver_reference";
  if (family === "naver_utm_needs_rule") return "naver_rule_review";
  if (family === "kakao_candidate") return "kakao_reference";
  if (family === "meta_candidate") return "paid_meta_reference";
  if (family === "google_candidate") return "paid_google_reference";
  return "unknown_utm_invalid";
};

const buildUtmAuditSignature = (entry: LedgerItem | undefined): UtmAuditSignature | undefined => {
  if (!entry) return undefined;
  const firstTouch = getFirstTouch(entry);
  const source = safeUtmPart(entry.utmSource) !== "(blank)" ? safeUtmPart(entry.utmSource) : safeUtmPart(firstTouch.utmSource);
  const medium = safeUtmPart(entry.utmMedium) !== "(blank)" ? safeUtmPart(entry.utmMedium) : safeUtmPart(firstTouch.utmMedium);
  const campaign = safeUtmPart(entry.utmCampaign) !== "(blank)" ? safeUtmPart(entry.utmCampaign) : safeUtmPart(firstTouch.utmCampaign);
  if (source === "(blank)" && medium === "(blank)" && campaign === "(blank)") return undefined;
  const family = utmFamily(source, medium, campaign);
  return {
    source,
    medium,
    campaign,
    family,
    candidateRule: utmCandidateRule(family),
  };
};

const NAVER_SEARCH_REFERRERS = ["search.naver.com", "m.search.naver.com"];
const NAVER_REFERRERS = [
  "search.naver.com",
  "m.search.naver.com",
  "naver.com",
  "blog.naver.com",
  "m.blog.naver.com",
  "shopping.naver.com",
  "m.shopping.naver.com",
];

const naverEvidenceProfile = (entry: LedgerItem | undefined) => {
  if (!entry) {
    return {
      hasNaverReferrer: false,
      hasNaverSearchReferrer: false,
      hasNaverPaidMarker: false,
      hasDirectNaverSearchReferrer: false,
      hasFirstTouchNaverSearchReferrer: false,
    };
  }
  const firstTouch = getFirstTouch(entry);
  const directReferrer = readString(entry.referrer).toLowerCase();
  const firstReferrer = readString(firstTouch.referrer).toLowerCase();
  const directText = evidenceText(entry);
  const firstTouchText = [
    firstTouch.landing,
    firstTouch.referrer,
    firstTouch.utmSource,
    firstTouch.utmMedium,
    firstTouch.utmCampaign,
    firstTouch.utmTerm,
    firstTouch.utmContent,
  ].map((value) => readString(value).toLowerCase()).join(" ");
  const allText = `${directText} ${firstTouchText}`;
  const directNapm = safeUrlParam("NaPm", entry.landing, entry.referrer);
  const firstNapm = safeUrlParam("NaPm", firstTouch.landing, firstTouch.referrer);
  const directNapmTr = extractNapmTrCode(directNapm);
  const firstNapmTr = extractNapmTrCode(firstNapm);
  const directPaidUtm = sourceIs(entry.utmSource, ["naver"]) && paidMedium(entry.utmMedium);
  const firstPaidUtm = sourceIs(firstTouch.utmSource, ["naver"]) && paidMedium(firstTouch.utmMedium);
  const paidMarkerTokens = [
    "powerlink",
    "naverad",
    "nvadid",
    "n_media=",
    "n_query=",
    "n_rank=",
    "n_ad_group=",
    "n_ad=",
    "n_campaign_type=",
    "n_ad_group_type=",
    "n_match=",
  ];
  const directPaidMarker = Boolean(directPaidUtm || directNapmTr === "sa" || includesAny(directText, paidMarkerTokens));
  const firstPaidMarker = Boolean(firstPaidUtm || firstNapmTr === "sa" || includesAny(firstTouchText, paidMarkerTokens));
  const brandsearchMarker = Boolean(
    directNapmTr === "brnd" ||
    firstNapmTr === "brnd" ||
    includesAny(allText, ["brandsearch", "brand_search", "naverbrandsearch"]),
  );
  const shoppingMarker = Boolean(
    directNapmTr === "slsl" ||
    firstNapmTr === "slsl" ||
    includesAny(allText, ["shopping.naver.com", "m.shopping.naver.com", "shoppingsearch"]),
  );
  const hasDirectNaverSearchReferrer = includesAny(directReferrer, NAVER_SEARCH_REFERRERS);
  const hasFirstTouchNaverSearchReferrer = includesAny(firstReferrer, NAVER_SEARCH_REFERRERS);
  return {
    hasNaverReferrer: includesAny(`${directReferrer} ${firstReferrer}`, NAVER_REFERRERS),
    hasNaverSearchReferrer: hasDirectNaverSearchReferrer || hasFirstTouchNaverSearchReferrer,
    hasNaverPaidMarker: Boolean(directPaidMarker || firstPaidMarker),
    hasDirectNaverPaidMarker: directPaidMarker,
    hasFirstTouchNaverPaidMarker: firstPaidMarker,
    hasNaverBrandsearchMarker: brandsearchMarker,
    hasNaverShoppingMarker: shoppingMarker,
    hasDirectNaverSearchReferrer,
    hasFirstTouchNaverSearchReferrer,
  };
};

const classifyEvidence = (entry: LedgerItem | undefined): {
  channel: string;
  tier: string;
  confidence: Assignment["evidenceConfidence"];
  assistChannels: string[];
  reason: string;
  detail: string;
} => {
  if (!entry) {
    return {
      channel: "unknown",
      tier: "no_vm_payment_success",
      confidence: "C",
      assistChannels: [],
      reason: "vm_payment_success_missing",
      detail: "payment_success_missing_in_vm_cloud",
    };
  }

  const firstTouch = getFirstTouch(entry);
  const firstTouchMatch = getFirstTouchMatch(entry);
  const directText = evidenceText(entry);
  const firstTouchText = [
    firstTouch.landing,
    firstTouch.referrer,
    firstTouch.utmSource,
    firstTouch.utmMedium,
    firstTouch.utmCampaign,
    firstTouch.utmTerm,
    firstTouch.utmContent,
  ].map((value) => readString(value).toLowerCase()).join(" ");

  type EvidenceCandidate = {
    channel: string;
    tier: string;
    confidence: Assignment["evidenceConfidence"];
    strength: number;
  };
  const candidates = new Map<string, EvidenceCandidate>();
  const add = (candidate: EvidenceCandidate) => {
    const current = candidates.get(candidate.channel);
    if (!current || candidate.strength > current.strength) candidates.set(candidate.channel, candidate);
  };

  const directFbclid = readString(entry.fbclid) || safeUrlParam("fbclid", entry.landing, entry.referrer);
  const firstFbclid =
    readString(firstTouch.fbclid) || safeUrlParam("fbclid", firstTouch.landing, firstTouch.referrer);
  const directFbc = readString(entry.metadata?.fbc);
  const firstFbc = readString(firstTouch.fbc);
  const directTtclid = readString(entry.ttclid) || safeUrlParam("ttclid", entry.landing, entry.referrer);
  const firstTtclid =
    readString(firstTouch.ttclid) || safeUrlParam("ttclid", firstTouch.landing, firstTouch.referrer);
  const directGclid =
    readString(entry.gclid) ||
    safeUrlParam("gclid", entry.landing, entry.referrer) ||
    safeUrlParam("gbraid", entry.landing, entry.referrer) ||
    safeUrlParam("wbraid", entry.landing, entry.referrer);
  const firstGclid =
    readString(firstTouch.gclid) ||
    safeUrlParam("gclid", firstTouch.landing, firstTouch.referrer) ||
    safeUrlParam("gbraid", firstTouch.landing, firstTouch.referrer) ||
    safeUrlParam("wbraid", firstTouch.landing, firstTouch.referrer);
  const directNapm = safeUrlParam("NaPm", entry.landing, entry.referrer);
  const firstNapm = safeUrlParam("NaPm", firstTouch.landing, firstTouch.referrer);
  const firstTouchStrong = Array.isArray(firstTouchMatch.matchedBy)
    ? firstTouchMatch.matchedBy.some((key) => ["checkout_id", "ga_session_id", "client_id", "user_pseudo_id"].includes(readString(key)))
    : Object.keys(firstTouch).length > 0;
  const hasAnyClickId = Boolean(
    directGclid || firstGclid || directTtclid || firstTtclid || directFbclid || firstFbclid || directFbc || firstFbc || directNapm || firstNapm,
  );
  const hasAnyUtm = hasAnyValue(
    entry.utmSource,
    entry.utmMedium,
    entry.utmCampaign,
    entry.utmTerm,
    entry.utmContent,
    firstTouch.utmSource,
    firstTouch.utmMedium,
    firstTouch.utmCampaign,
    firstTouch.utmTerm,
    firstTouch.utmContent,
  );
  const hasAnyReferrer = hasAnyValue(entry.referrer, firstTouch.referrer);
  const hasFirstTouch = Object.keys(firstTouch).length > 0;
  const hasSelfInternalReferrer = includesAny(`${directText} ${firstTouchText}`, [
    "biocom.kr",
    "biocom.co.kr",
    "m.biocom.kr",
    "biocom.imweb.me",
  ]);
  const naverProfile = naverEvidenceProfile(entry);

  if (directGclid) add({ channel: "paid_google", tier: "paid_google_order_click_id", confidence: "A", strength: 100 });
  if (directTtclid) add({ channel: "paid_tiktok", tier: "paid_tiktok_order_click_id", confidence: "A", strength: 100 });
  if (directFbclid || directFbc) add({ channel: "paid_meta", tier: "paid_meta_order_click_id", confidence: "A", strength: 100 });
  if (naverProfile.hasDirectNaverPaidMarker) add({ channel: "paid_naver", tier: "paid_naver_order_click_id", confidence: "A", strength: 100 });

  if (firstGclid) add({ channel: "paid_google", tier: "paid_google_checkout_first_touch", confidence: firstTouchStrong ? "B" : "C", strength: 80 });
  if (firstTtclid) add({ channel: "paid_tiktok", tier: "paid_tiktok_checkout_first_touch", confidence: firstTouchStrong ? "B" : "C", strength: 80 });
  if (firstFbclid || firstFbc) add({ channel: "paid_meta", tier: "paid_meta_checkout_first_touch", confidence: firstTouchStrong ? "B" : "C", strength: 80 });
  if (naverProfile.hasFirstTouchNaverPaidMarker) add({ channel: "paid_naver", tier: "paid_naver_checkout_first_touch", confidence: firstTouchStrong ? "B" : "C", strength: 80 });

  if (paidMedium(entry.utmMedium) || paidMedium(firstTouch.utmMedium)) {
    if (sourceIs(entry.utmSource, ["google"]) || sourceIs(firstTouch.utmSource, ["google"])) {
      add({ channel: "paid_google", tier: "paid_google_paid_utm", confidence: "B", strength: 65 });
    }
    if (sourceIs(entry.utmSource, ["tiktok"]) || sourceIs(firstTouch.utmSource, ["tiktok"])) {
      add({ channel: "paid_tiktok", tier: "paid_tiktok_paid_utm", confidence: "B", strength: 65 });
    }
    if (sourceIs(entry.utmSource, ["meta", "facebook", "instagram", "fb", "ig"]) || sourceIs(firstTouch.utmSource, ["meta", "facebook", "instagram", "fb", "ig"])) {
      add({ channel: "paid_meta", tier: "paid_meta_paid_utm", confidence: "B", strength: 65 });
    }
    if (sourceIs(entry.utmSource, ["naver"]) || sourceIs(firstTouch.utmSource, ["naver"])) {
      add({ channel: "paid_naver", tier: "paid_naver_paid_utm", confidence: "B", strength: 65 });
    }
  }

  const ordered = Array.from(candidates.values()).sort((a, b) => b.strength - a.strength || a.channel.localeCompare(b.channel));

  if (ordered.length > 1) {
    const winner = ordered[0];
    return {
      channel: winner.channel,
      tier: `multiple_paid_evidence_${winner.tier}`,
      confidence: winner.confidence === "A" ? "B" : winner.confidence,
      assistChannels: ordered.slice(1).map((candidate) => candidate.channel),
      reason: "",
      detail: "",
    };
  }

  if (ordered.length === 1) {
    const winner = ordered[0];
    return {
      channel: winner.channel,
      tier: winner.tier,
      confidence: winner.confidence,
      assistChannels: [],
      reason: "",
      detail: "",
    };
  }

  if (naverProfile.hasDirectNaverSearchReferrer && !naverProfile.hasNaverPaidMarker) {
    return {
      channel: "organic_naver",
      tier: "organic_naver_payment_success_referrer",
      confidence: "B",
      assistChannels: [],
      reason: "",
      detail: "",
    };
  }

  if (naverProfile.hasFirstTouchNaverSearchReferrer && !naverProfile.hasNaverPaidMarker) {
    return {
      channel: "organic_naver",
      tier: "organic_naver_checkout_first_touch",
      confidence: "C",
      assistChannels: [],
      reason: "",
      detail: "",
    };
  }

  const hasSearchReferrer = includesAny(`${directText} ${firstTouchText}`, ["google.com/search", "bing.com"]);

  if (hasSearchReferrer) {
    return {
      channel: "organic_search",
      tier: "organic_referrer",
      confidence: "C",
      assistChannels: [],
      reason: "",
      detail: "",
    };
  }

  if (includesAny(`${directText} ${firstTouchText}`, ["link.inpock.co.kr"])) {
    return {
      channel: "influencer_non_paid",
      tier: "influencer_referrer",
      confidence: "C",
      assistChannels: [],
      reason: "",
      detail: "",
    };
  }

  const unknownDetail = !hasAnyClickId && !hasAnyUtm && !hasAnyReferrer && !hasFirstTouch
    ? "no_referrer"
    : !hasAnyClickId && hasAnyUtm
      ? "utm_present_but_invalid_rule"
      : !hasAnyClickId && hasSelfInternalReferrer
        ? "self_or_internal_referrer_only"
        : !hasAnyClickId && !hasAnyReferrer
          ? "no_referrer"
          : !hasFirstTouch
            ? "first_touch_expired"
            : "click_id_missing";

  return {
    channel: "unknown",
    tier: "no_paid_or_referrer_evidence",
    confidence: "C",
    assistChannels: [],
    reason: "missing_channel_evidence",
    detail: unknownDetail,
  };
};

const fetchVmLedger = async (source: string, startAt: string, endAt: string) => {
  const url = new URL("/api/attribution/ledger", ATTRIBUTION_BASE_URL);
  url.searchParams.set("source", source);
  url.searchParams.set("startAt", startAt);
  url.searchParams.set("endAt", endAt);
  url.searchParams.set("limit", "10000");

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Attribution VM request failed: ${response.status} ${response.statusText}`);
  }
  return await response.json() as { summary?: unknown; items?: LedgerItem[]; filters?: unknown };
};

const ledgerOrderKeys = (entry: LedgerItem) => [
  normalizeOrderIdBase(entry.orderId),
  normalizeOrderIdBase(readString(entry.metadata?.orderIdBase)),
  normalizeOrderIdBase(readString(objectValue(entry.metadata?.referrerPayment).orderNo)),
  normalizeOrderIdBase(readString(objectValue(entry.metadata?.referrerPayment).orderId)),
].filter(Boolean);

const getSpineRows = async (site: string, startDate: string, endDateExclusive: string) => {
  const result = await queryPg<SpineRow>(
    `
    WITH
      subscription_history AS (
        SELECT
          order_number,
          customer_number IS NOT NULL AS subscription_member_key_present,
          ROW_NUMBER() OVER (
            PARTITION BY COALESCE(customer_number, order_number)
            ORDER BY order_date_kst, order_number
          ) AS subscription_sequence
        FROM (
          SELECT
            order_number,
            MAX(NULLIF(customer_number, '')) AS customer_number,
            MIN(order_date::timestamp) AS order_date_kst
          FROM public.tb_iamweb_users
          WHERE payment_method = 'SUBSCRIPTION'
            AND payment_status = 'PAYMENT_COMPLETE'
          GROUP BY order_number
        ) history_base
      ),
      imweb AS (
        SELECT
          u.order_number,
          MIN(u.order_date::timestamp) AS order_date_kst,
          MAX(COALESCE(u.final_order_amount, 0)) AS imweb_amount,
          MAX(COALESCE(u.total_refunded_price, 0)) AS imweb_refund,
          MAX(u.payment_method) AS payment_method,
          MAX(u.payment_status) AS payment_status,
          MAX(u.raw_data->>'channelOrderNo') AS channel_order_no,
          MAX(sh.subscription_sequence) AS subscription_sequence,
          BOOL_OR(COALESCE(sh.subscription_member_key_present, false)) AS subscription_member_key_present
        FROM public.tb_iamweb_users u
        LEFT JOIN subscription_history sh ON sh.order_number = u.order_number
        WHERE u.order_date::timestamp >= $1::timestamp
          AND u.order_date::timestamp < $2::timestamp
        GROUP BY u.order_number
      ),
      toss AS (
        SELECT
          payment_key,
          order_id,
          regexp_replace(order_id, '(-|_)(p|pay)[0-9]+$', '', 'i') AS order_id_base,
          MAX(COALESCE(total_amount, 0)) AS toss_amount,
          MAX(COALESCE(balance_amount, 0)) AS toss_balance,
          MAX(COALESCE(cancel_amount, 0)) AS toss_cancel,
          MAX(status) AS toss_status
        FROM public.tb_sales_toss
        WHERE store = $3
          AND approved_at::timestamp >= $1::timestamp
          AND approved_at::timestamp < $2::timestamp
        GROUP BY payment_key, order_id
      ),
      spine AS (
        SELECT
          i.order_number,
          i.channel_order_no,
          t.payment_key,
          t.order_id,
          t.order_id_base,
          i.payment_method,
          i.payment_status,
          i.subscription_sequence,
          i.subscription_member_key_present,
          i.imweb_amount AS gross_revenue,
          CASE
            WHEN t.payment_key IS NOT NULL THEN t.toss_balance
            WHEN i.payment_method IN ('NAVERPAY_ORDER', 'SUBSCRIPTION')
              AND i.payment_status = 'PAYMENT_COMPLETE' THEN i.imweb_amount
            ELSE 0
          END AS net_revenue,
          CASE
            WHEN t.payment_key IS NOT NULL THEN 'toss_order_id_base'
            WHEN i.payment_method = 'NAVERPAY_ORDER' AND i.payment_status = 'PAYMENT_COMPLETE' THEN 'imweb_npay_confirmed'
            WHEN i.payment_method = 'SUBSCRIPTION' AND i.payment_status = 'PAYMENT_COMPLETE' THEN 'imweb_subscription_confirmed'
            WHEN i.payment_method = 'VIRTUAL' AND i.payment_status = 'PAYMENT_COMPLETE' THEN 'imweb_virtual_without_toss'
            WHEN i.imweb_amount = 0 THEN 'zero_amount_non_revenue'
            ELSE 'quarantine_unmatched_revenue'
          END AS join_method,
          CASE
            WHEN t.payment_key IS NOT NULL THEN 'A'
            WHEN i.payment_method IN ('NAVERPAY_ORDER', 'SUBSCRIPTION') AND i.payment_status = 'PAYMENT_COMPLETE' THEN 'B'
            WHEN i.payment_method = 'VIRTUAL' AND i.payment_status = 'PAYMENT_COMPLETE' THEN 'C'
            WHEN i.imweb_amount = 0 THEN 'A'
            ELSE 'D'
          END AS join_confidence
        FROM imweb i
        LEFT JOIN toss t ON t.order_id_base = i.order_number
      )
    SELECT *
    FROM spine
    WHERE join_confidence IN ('A', 'B')
      AND net_revenue > 0
    ORDER BY order_number
    `,
    [startDate, endDateExclusive, site],
  );
  return result.rows;
};

const buildLedgerIndexes = (items: LedgerItem[]) => {
  const paymentEntries = items.filter((item) => item.touchpoint === "payment_success" && item.paymentStatus === "confirmed");
  const byPaymentKey = new Map<string, LedgerItem>();
  const byOrderId = new Map<string, LedgerItem>();
  const byRelatedOrderId = new Map<string, LedgerItem>();

  for (const entry of items) {
    for (const key of ledgerOrderKeys(entry)) {
      const current = byRelatedOrderId.get(key);
      const entryRank = entry.touchpoint === "checkout_started" || entry.touchpoint === "checkout_context" ? 2 : 1;
      const currentRank = current?.touchpoint === "checkout_started" || current?.touchpoint === "checkout_context" ? 2 : 1;
      if (!current || entryRank > currentRank) byRelatedOrderId.set(key, entry);
    }
  }

  for (const entry of paymentEntries) {
    if (entry.paymentKey && !byPaymentKey.has(entry.paymentKey)) byPaymentKey.set(entry.paymentKey, entry);
    for (const key of ledgerOrderKeys(entry)) {
      if (!byOrderId.has(key)) byOrderId.set(key, entry);
    }
  }

  return { byPaymentKey, byOrderId, byRelatedOrderId };
};

type NpayContext = {
  sourceAccess: "available" | "empty_or_unavailable" | "error";
  byOrderNumber: Map<string, NpayRoasDryRunOrderResult>;
};

const readBool = (value: boolean | string | null | undefined) =>
  value === true || value === "true" || value === "t" || value === "1";

const missingPaymentSuccessDetail = (row: SpineRow, relatedEntry?: LedgerItem): string => {
  const relatedNaver = naverEvidenceProfile(relatedEntry);
  if (relatedNaver.hasNaverSearchReferrer && !relatedNaver.hasNaverPaidMarker) {
    return "naver_referrer_present_but_order_bridge_missing";
  }
  if (relatedEntry) return "checkout_started_but_payment_success_missing";
  if (row.join_method === "imweb_npay_confirmed") return "npay_return_missing";
  return "payment_success_order_key_normalize_failed";
};

const subscriptionUnknownDetail = (row: SpineRow, classifiedDetail: string, entry?: LedgerItem): string => {
  if (!readBool(row.subscription_member_key_present)) return "member_hash_missing";
  if (!entry) return "acquisition_archive_lookup_needed";
  if (classifiedDetail === "no_referrer") return "first_touch_expired";
  return classifiedDetail || "acquisition_archive_lookup_needed";
};

const assignRow = (
  row: SpineRow,
  indexes: ReturnType<typeof buildLedgerIndexes>,
  npay: NpayContext,
): Assignment => {
  const matchedBy: string[] = [];
  let entry: LedgerItem | undefined;
  let relatedEntry: LedgerItem | undefined;
  const subscriptionSequence = row.join_method === "imweb_subscription_confirmed"
    ? toNumber(row.subscription_sequence)
    : null;
  const subscriptionFields = row.join_method === "imweb_subscription_confirmed"
    ? {
        subscriptionSequence,
        subscriptionMemberKeyPresent: readBool(row.subscription_member_key_present),
      }
    : {};

  if (row.payment_key) {
    entry = indexes.byPaymentKey.get(row.payment_key);
    if (entry) matchedBy.push("payment_key");
  }

  const orderKey = row.order_id_base || row.order_number;
  if (!entry && orderKey) {
    entry = indexes.byOrderId.get(orderKey);
    if (entry) matchedBy.push("order_id_base");
  }
  if (!entry && orderKey) {
    relatedEntry = indexes.byRelatedOrderId.get(orderKey);
    if (relatedEntry) matchedBy.push("related_order_event");
  }

  if (row.join_method === "imweb_npay_confirmed") {
    const npayResult = npay.byOrderNumber.get(row.order_number);
    const base = {
      orderNumber: row.order_number,
      netRevenue: toNumber(row.net_revenue),
      joinMethod: row.join_method,
      primaryChannel: "npay",
      assistChannels: [],
        unknownReason: "",
        matchedBy,
        ...subscriptionFields,
      };

    if (npay.sourceAccess !== "available") {
      return {
        ...base,
        evidenceConfidence: "C",
        evidenceTier: "npay_confirmed_intent_source_unavailable",
        npayIntentStatus: npay.sourceAccess,
      };
    }

    if (!npayResult) {
      return {
        ...base,
        evidenceConfidence: "C",
        evidenceTier: "npay_confirmed_not_in_match_report",
        npayIntentStatus: "not_in_match_report",
      };
    }

    if (npayResult.status === "strong_match" && npayResult.strongGrade === "A") {
      return {
        ...base,
        evidenceConfidence: "B",
        evidenceTier: "npay_confirmed_intent_strong_a",
        matchedBy: [...matchedBy, "npay_intent_strong_a"],
        npayIntentStatus: "strong_match_a",
      };
    }

    if (npayResult.status === "strong_match") {
      return {
        ...base,
        evidenceConfidence: "C",
        evidenceTier: "npay_confirmed_intent_strong_b",
        matchedBy: [...matchedBy, "npay_intent_strong_b"],
        npayIntentStatus: "strong_match_b",
      };
    }

    if (npayResult.status === "ambiguous") {
      return {
        ...base,
        evidenceConfidence: "D",
        evidenceTier: "npay_confirmed_intent_ambiguous",
        unknownReason: "npay_intent_ambiguous",
        unknownDetail: "npay_intent_multiple_candidates",
        npayIntentStatus: "ambiguous",
      };
    }

    return {
      ...base,
      evidenceConfidence: "C",
      evidenceTier: "npay_confirmed_without_intent",
      npayIntentStatus: "purchase_without_intent",
    };
  }

  if (row.join_method === "imweb_subscription_confirmed" && toNumber(row.subscription_sequence) > 1) {
    return {
      orderNumber: row.order_number,
      netRevenue: toNumber(row.net_revenue),
      joinMethod: row.join_method,
      primaryChannel: "subscription_recurring",
      assistChannels: [],
      evidenceConfidence: "B",
      evidenceTier: "subscription_recurring_second_plus",
      unknownReason: "",
      matchedBy,
      ...subscriptionFields,
    };
  }

  if (!entry) {
    const detail = missingPaymentSuccessDetail(row, relatedEntry);
    if (row.join_method === "imweb_subscription_confirmed") {
      return {
        orderNumber: row.order_number,
        netRevenue: toNumber(row.net_revenue),
        joinMethod: row.join_method,
        primaryChannel: "unknown",
        assistChannels: [],
        evidenceConfidence: "C",
        evidenceTier: "subscription_without_acquisition_evidence",
        unknownReason: "subscription_without_acquisition_evidence",
        unknownDetail: subscriptionUnknownDetail(row, detail, entry),
        matchedBy,
        ...subscriptionFields,
      };
    }
    return {
      orderNumber: row.order_number,
      netRevenue: toNumber(row.net_revenue),
      joinMethod: row.join_method,
      primaryChannel: "unknown",
      assistChannels: [],
      evidenceConfidence: "C",
      evidenceTier: "no_vm_payment_success",
      unknownReason: "vm_payment_success_missing",
      unknownDetail: detail,
      matchedBy,
      ...subscriptionFields,
    };
  }

  const classified = classifyEvidence(entry);
  const utmAudit = buildUtmAuditSignature(entry);
  if (row.join_method === "imweb_subscription_confirmed" && classified.channel === "unknown") {
    return {
      orderNumber: row.order_number,
      netRevenue: toNumber(row.net_revenue),
      joinMethod: row.join_method,
      primaryChannel: "unknown",
      assistChannels: [],
      evidenceConfidence: "C",
      evidenceTier: "subscription_without_acquisition_evidence",
      unknownReason: "subscription_without_acquisition_evidence",
      unknownDetail: subscriptionUnknownDetail(row, classified.detail, entry),
      matchedBy,
      utmAudit,
      ...subscriptionFields,
    };
  }

  return {
    orderNumber: row.order_number,
    netRevenue: toNumber(row.net_revenue),
    joinMethod: row.join_method,
    primaryChannel: classified.channel,
    assistChannels: classified.assistChannels,
    evidenceConfidence: classified.confidence,
    evidenceTier: classified.tier,
    unknownReason: classified.reason,
    unknownDetail: classified.detail,
    matchedBy,
    utmAudit,
    ...subscriptionFields,
  };
};

const unknownDetailMeta = (rootReason: string, detail = "") => {
  const key = `${rootReason}:${detail || "unspecified"}`;
  const fallback = {
    nextEvidenceNeeded: "source aggregate review",
    recommendedFix: "원인별 source coverage를 추가 점검",
  };
  const map: Record<string, { nextEvidenceNeeded: string; recommendedFix: string }> = {
    "vm_payment_success_missing:checkout_started_but_payment_success_missing": {
      nextEvidenceNeeded: "VM Cloud checkout event to payment_success continuity",
      recommendedFix: "checkout 진입 후 결제완료 신호가 끊기는 구간의 server-side success capture 점검",
    },
    "vm_payment_success_missing:payment_success_order_key_normalize_failed": {
      nextEvidenceNeeded: "VM Cloud attribution_ledger payment_success coverage",
      recommendedFix: "server-side payment_success capture 또는 order id normalize rule 점검",
    },
    "vm_payment_success_missing:npay_return_missing": {
      nextEvidenceNeeded: "NPay return/success bridge",
      recommendedFix: "NPay 결제완료 후 주문번호가 고객 유입 장부에 남는지 확인",
    },
    "vm_payment_success_missing:naver_referrer_present_but_order_bridge_missing": {
      nextEvidenceNeeded: "Naver organic referrer + order bridge",
      recommendedFix: "네이버 검색 유입이 보이는 checkout/session을 결제완료 주문과 연결하는 bridge 보강",
    },
    "missing_channel_evidence:no_referrer": {
      nextEvidenceNeeded: "click id, UTM, referrer, first touch capture",
      recommendedFix: "referrer 보존과 first touch cookie/cross-domain capture 점검",
    },
    "missing_channel_evidence:utm_present_but_invalid_rule": {
      nextEvidenceNeeded: "utm_source/utm_medium naming rule",
      recommendedFix: "paid/organic 판정 가능한 UTM source/medium 표준으로 정리",
    },
    "missing_channel_evidence:self_or_internal_referrer_only": {
      nextEvidenceNeeded: "original external referrer before internal redirect",
      recommendedFix: "내부 도메인 이동 전 최초 referrer/landing 보존",
    },
    "missing_channel_evidence:click_id_missing": {
      nextEvidenceNeeded: "ad click id or external referrer",
      recommendedFix: "gclid/fbclid/ttclid/NaPm capture와 referrer 보존 점검",
    },
    "missing_channel_evidence:first_touch_expired": {
      nextEvidenceNeeded: "first touch retention window",
      recommendedFix: "first touch TTL과 결제까지 걸린 시간 분포를 보고 보존 기간 조정",
    },
    "subscription_without_acquisition_evidence:first_touch_expired": {
      nextEvidenceNeeded: "first subscription acquisition first touch",
      recommendedFix: "첫 구독 시작 전 최초 유입 보존 기간과 결제완료 연결 확인",
    },
    "subscription_without_acquisition_evidence:utm_present_but_invalid_rule": {
      nextEvidenceNeeded: "first subscription UTM naming rule",
      recommendedFix: "첫 구독 시작 유입 UTM source/medium 표준화",
    },
    "subscription_without_acquisition_evidence:member_hash_missing": {
      nextEvidenceNeeded: "member hash or internal join key",
      recommendedFix: "raw 회원정보 없이 내부 join 가능한 회원 key 보존 여부 확인",
    },
    "subscription_without_acquisition_evidence:acquisition_archive_lookup_needed": {
      nextEvidenceNeeded: "subscription first-order acquisition archive",
      recommendedFix: "첫 구독 시작 주문의 과거 유입 장부 archive lookup 설계",
    },
    "subscription_without_acquisition_evidence:first_order_outside_window": {
      nextEvidenceNeeded: "first order outside current report window",
      recommendedFix: "월별 화면 밖 최초 주문 acquisition을 archive에서 조회",
    },
    "npay_intent_ambiguous:npay_intent_multiple_candidates": {
      nextEvidenceNeeded: "NPay intent disambiguation key",
      recommendedFix: "NPay intent ledger의 order/session key 정밀도 개선",
    },
  };
  return map[key] ?? fallback;
};

const summarizeAssignments = (assignments: Assignment[]) => {
  const byChannel = new Map<string, { orders: number; revenue: number; confidence: Record<string, number> }>();
  const unknownReasons = new Map<string, { orders: number; revenue: number }>();
  const unknownReasonDetails = new Map<string, UnknownReasonDetailRow>();
  const evidenceTiers = new Map<string, { orders: number; revenue: number }>();
  const npayIntentStatuses = new Map<string, { orders: number; revenue: number }>();
  const naverOrganicEvidence = new Map<string, EvidenceAuditRow>();
  const utmInvalidAudit = new Map<string, UtmInvalidAuditRow>();
  const subscriptionAcquisition: SubscriptionAcquisitionSummary = {
    renewable_order_count: 0,
    renewable_revenue: 0,
    first_subscription_order_count: 0,
    first_subscription_revenue: 0,
    first_acquisition_channel_found: 0,
    first_acquisition_revenue_found: 0,
    archive_lookup_needed: 0,
    archive_lookup_needed_revenue: 0,
    member_key_missing: 0,
    member_key_missing_revenue: 0,
  };

  const addNaverEvidence = (
    key: string,
    input: Omit<EvidenceAuditRow, "orders" | "revenue"> & { revenue: number | null },
    assignment?: Assignment,
  ) => {
    const current = naverOrganicEvidence.get(key) || {
      ...input,
      orders: 0,
      revenue: input.revenue == null ? null : 0,
    };
    if (assignment) {
      current.orders += 1;
      current.revenue = (current.revenue || 0) + assignment.netRevenue;
      if (
        input.confidence !== "aggregate_only" &&
        current.confidence !== "aggregate_only" &&
        confidenceRank(input.confidence) > confidenceRank(current.confidence)
      ) {
        current.confidence = input.confidence;
      }
    }
    naverOrganicEvidence.set(key, current);
  };

  for (const assignment of assignments) {
    const channel = byChannel.get(assignment.primaryChannel) || { orders: 0, revenue: 0, confidence: {} };
    channel.orders += 1;
    channel.revenue += assignment.netRevenue;
    channel.confidence[assignment.evidenceConfidence] = (channel.confidence[assignment.evidenceConfidence] || 0) + assignment.netRevenue;
    byChannel.set(assignment.primaryChannel, channel);

    if (assignment.unknownReason) {
      const reason = unknownReasons.get(assignment.unknownReason) || { orders: 0, revenue: 0 };
      reason.orders += 1;
      reason.revenue += assignment.netRevenue;
      unknownReasons.set(assignment.unknownReason, reason);

      const detail = assignment.unknownDetail || "unspecified";
      const detailKey = `${assignment.unknownReason}:${detail}`;
      const meta = unknownDetailMeta(assignment.unknownReason, detail);
      const current = unknownReasonDetails.get(detailKey) || {
        rootReason: assignment.unknownReason,
        detail,
        orders: 0,
        revenue: 0,
        nextEvidenceNeeded: meta.nextEvidenceNeeded,
        recommendedFix: meta.recommendedFix,
        confidence: assignment.evidenceConfidence,
      };
      current.orders += 1;
      current.revenue += assignment.netRevenue;
      if (confidenceRank(assignment.evidenceConfidence) > confidenceRank(current.confidence)) {
        current.confidence = assignment.evidenceConfidence;
      }
      unknownReasonDetails.set(detailKey, current);

      if (assignment.unknownDetail === "utm_present_but_invalid_rule" && assignment.utmAudit) {
        const signature = `${assignment.utmAudit.source}|${assignment.utmAudit.medium}|${assignment.utmAudit.campaign}|${assignment.utmAudit.family}`;
        const utmCurrent = utmInvalidAudit.get(signature) || {
          ...assignment.utmAudit,
          orders: 0,
          revenue: 0,
          useForBudgetRoas: "reference_only_not_budget" as const,
          note: "UTM 이름만으로 actual 매출 채널을 확정하지 않고, channel evidence 후보로만 둔다.",
        };
        utmCurrent.orders += 1;
        utmCurrent.revenue += assignment.netRevenue;
        utmInvalidAudit.set(signature, utmCurrent);
      }
    }

    const tier = evidenceTiers.get(assignment.evidenceTier) || { orders: 0, revenue: 0 };
    tier.orders += 1;
    tier.revenue += assignment.netRevenue;
    evidenceTiers.set(assignment.evidenceTier, tier);

    if (assignment.joinMethod === "imweb_npay_confirmed") {
      const statusKey = assignment.npayIntentStatus || assignment.evidenceTier;
      const npayStatus = npayIntentStatuses.get(statusKey) || { orders: 0, revenue: 0 };
      npayStatus.orders += 1;
      npayStatus.revenue += assignment.netRevenue;
      npayIntentStatuses.set(statusKey, npayStatus);
    }

    if (assignment.evidenceTier === "organic_naver_payment_success_referrer") {
      addNaverEvidence(
        "organic_naver_order_level_strong",
        {
          label: "organic_naver_order_level_strong",
          revenue: 0,
          confidence: "B",
          source: "VM Cloud attribution_ledger payment_success referrer",
          useForBudgetRoas: "yes_order_level",
          note: "결제완료 신호에 네이버 검색 referrer가 있고 NaPm/paid UTM이 없다.",
        },
        assignment,
      );
    }
    if (assignment.evidenceTier === "organic_naver_checkout_first_touch") {
      addNaverEvidence(
        "organic_naver_session_level_medium",
        {
          label: "organic_naver_session_level_medium",
          revenue: 0,
          confidence: "C",
          source: "VM Cloud attribution_ledger first_touch referrer",
          useForBudgetRoas: "reference_only",
          note: "같은 주문의 결제완료에는 직접 referrer가 없지만 first touch에 네이버 검색 referrer가 있다.",
        },
        assignment,
      );
    }
    if (assignment.unknownDetail === "naver_referrer_present_but_order_bridge_missing") {
      addNaverEvidence(
        "naver_referrer_but_order_bridge_missing",
        {
          label: "naver_referrer_but_order_bridge_missing",
          revenue: 0,
          confidence: "C",
          source: "VM Cloud attribution_ledger related checkout/session event",
          useForBudgetRoas: "reference_only",
          note: "네이버 검색 referrer는 보이나 결제완료 주문 bridge가 없어 예산 판단 채널로 승격하지 않는다.",
        },
        assignment,
      );
    }

    if (assignment.joinMethod === "imweb_subscription_confirmed") {
      if ((assignment.subscriptionSequence || 0) > 1) {
        subscriptionAcquisition.renewable_order_count += 1;
        subscriptionAcquisition.renewable_revenue += assignment.netRevenue;
      } else {
        subscriptionAcquisition.first_subscription_order_count += 1;
        subscriptionAcquisition.first_subscription_revenue += assignment.netRevenue;
        if (assignment.primaryChannel !== "unknown") {
          subscriptionAcquisition.first_acquisition_channel_found += 1;
          subscriptionAcquisition.first_acquisition_revenue_found += assignment.netRevenue;
        }
      }
      if (assignment.unknownDetail === "acquisition_archive_lookup_needed") {
        subscriptionAcquisition.archive_lookup_needed += 1;
        subscriptionAcquisition.archive_lookup_needed_revenue += assignment.netRevenue;
      }
      if (assignment.unknownDetail === "member_hash_missing") {
        subscriptionAcquisition.member_key_missing += 1;
        subscriptionAcquisition.member_key_missing_revenue += assignment.netRevenue;
      }
    }
  }

  addNaverEvidence("naver_searchadvisor_aggregate_only", {
    label: "naver_searchadvisor_aggregate_only",
    revenue: null,
    confidence: "aggregate_only",
    source: "Naver Search Advisor aggregate export/API",
    useForBudgetRoas: "no",
    note: "Search Advisor는 검색어/페이지/day aggregate 근거다. 주문 단위 매출 정본이나 자동 채널 배정에는 쓰지 않는다.",
  });

  return {
    byChannel: Array.from(byChannel.entries())
      .map(([primaryChannel, value]) => ({ primaryChannel, ...value }))
      .sort((a, b) => b.revenue - a.revenue),
    unknownReasons: Array.from(unknownReasons.entries())
      .map(([unknownReason, value]) => ({ unknownReason, ...value }))
      .sort((a, b) => b.revenue - a.revenue),
    unknownReasonDetails: Array.from(unknownReasonDetails.values())
      .sort((a, b) => b.revenue - a.revenue),
    evidenceTiers: Array.from(evidenceTiers.entries())
      .map(([evidenceTier, value]) => ({ evidenceTier, ...value }))
      .sort((a, b) => b.revenue - a.revenue),
    npayIntentStatuses: Array.from(npayIntentStatuses.entries())
      .map(([npayIntentStatus, value]) => ({ npayIntentStatus, ...value }))
      .sort((a, b) => b.revenue - a.revenue),
    naverOrganicEvidence: Array.from(naverOrganicEvidence.values())
      .sort((a, b) => (b.revenue || 0) - (a.revenue || 0)),
    utmInvalidAudit: Array.from(utmInvalidAudit.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 20),
    subscriptionAcquisition,
  };
};

const summarizeNaverLedgerAggregate = (
  items: LedgerItem[],
  assignmentRows: EvidenceAuditRow[],
): EvidenceAuditRow[] => {
  const existing = new Map(assignmentRows.map((row) => [row.label, { ...row }]));
  let checkoutSearchEvents = 0;
  let paymentSearchEvents = 0;
  let paidMarkedSearchEvents = 0;
  let nonSearchNaverReferenceEvents = 0;

  for (const item of items) {
    const profile = naverEvidenceProfile(item);
    if (profile.hasNaverSearchReferrer && profile.hasNaverPaidMarker) {
      paidMarkedSearchEvents += 1;
      continue;
    }
    if (profile.hasNaverReferrer && !profile.hasNaverSearchReferrer && !profile.hasNaverPaidMarker) {
      nonSearchNaverReferenceEvents += 1;
      continue;
    }
    if (!profile.hasNaverSearchReferrer || profile.hasNaverPaidMarker) continue;
    if (item.touchpoint === "payment_success") paymentSearchEvents += 1;
    if (item.touchpoint === "checkout_started" || item.touchpoint === "checkout_context") {
      checkoutSearchEvents += 1;
    }
  }

  if (paymentSearchEvents > 0 && !existing.has("organic_naver_order_level_strong")) {
    existing.set("organic_naver_order_level_strong", {
      label: "organic_naver_order_level_strong",
      orders: paymentSearchEvents,
      revenue: null,
      confidence: "B",
      source: "VM Cloud attribution_ledger payment_success referrer aggregate",
      useForBudgetRoas: "reference_only",
      note: "결제완료 이벤트에는 네이버 검색 referrer가 있으나 운영DB 주문 매출 bridge 검증 전이라 참고용으로만 둔다.",
    });
  }

  if (checkoutSearchEvents > 0 && !existing.has("organic_naver_session_level_medium")) {
    existing.set("organic_naver_session_level_medium", {
      label: "organic_naver_session_level_medium",
      orders: checkoutSearchEvents,
      revenue: null,
      confidence: "C",
      source: "VM Cloud attribution_ledger checkout_started referrer aggregate",
      useForBudgetRoas: "reference_only",
      note: "네이버 검색 referrer가 있는 checkout/session 건수다. 주문 매출 bridge가 닫히기 전까지 예산 판단 매출로 쓰지 않는다.",
    });
  }

  if (paidMarkedSearchEvents > 0 && !existing.has("naver_search_referrer_paid_marker_excluded")) {
    existing.set("naver_search_referrer_paid_marker_excluded", {
      label: "naver_search_referrer_paid_marker_excluded",
      orders: paidMarkedSearchEvents,
      revenue: null,
      confidence: "aggregate_only",
      source: "VM Cloud attribution_ledger referrer aggregate",
      useForBudgetRoas: "no",
      note: "네이버 검색 referrer가 보이지만 NaPm/브랜드검색 등 유료 표식이 있어 자연검색 매출로 분류하지 않는다.",
    });
  }

  if (nonSearchNaverReferenceEvents > 0 && !existing.has("naver_non_search_referrer_reference_only")) {
    existing.set("naver_non_search_referrer_reference_only", {
      label: "naver_non_search_referrer_reference_only",
      orders: nonSearchNaverReferenceEvents,
      revenue: null,
      confidence: "aggregate_only",
      source: "VM Cloud attribution_ledger referrer aggregate",
      useForBudgetRoas: "no",
      note: "네이버 도메인 referrer는 있으나 검색 referrer가 아니라 자연검색 주문 근거로 쓰지 않는다.",
    });
  }

  return Array.from(existing.values()).sort((a, b) => (b.revenue || 0) - (a.revenue || 0) || b.orders - a.orders);
};

const classifyNaverAggregateItem = (item: LedgerItem): NaverEvidenceAggregateRow["class"] | null => {
  const profile = naverEvidenceProfile(item);
  const firstTouch = getFirstTouch(item);
  const text = [
    evidenceText(item),
    firstTouch.landing,
    firstTouch.referrer,
    firstTouch.utmSource,
    firstTouch.utmMedium,
    firstTouch.utmCampaign,
    firstTouch.utmTerm,
    firstTouch.utmContent,
  ].map((value) => readString(value).toLowerCase()).join(" ");
  const hasNaverAny = profile.hasNaverReferrer || profile.hasNaverPaidMarker || text.includes("naver") || text.includes("napm");
  if (!hasNaverAny) return null;
  if (profile.hasNaverBrandsearchMarker || includesAny(text, ["brandsearch", "brand_search", "naverbrandsearch"])) return "naver_brandsearch";
  if (profile.hasNaverPaidMarker) return "paid_naver";
  if (profile.hasNaverShoppingMarker) return "naver_shopping_search_candidate";
  if (profile.hasNaverSearchReferrer) return "organic_naver_candidate";
  if (profile.hasNaverReferrer || text.includes("naver")) return "naver_referrer_or_utm_only";
  return null;
};

const naverAggregateNote = (classification: NaverEvidenceAggregateRow["class"]) => {
  if (classification === "paid_naver") return "n_* 또는 paid UTM 계열이 있어 네이버 광고 후보로만 둔다. NaPm 단독은 paid 근거로 쓰지 않는다.";
  if (classification === "naver_brandsearch") return "brandsearch marker가 있어 네이버 브랜드검색 후보로만 둔다.";
  if (classification === "naver_shopping_search_candidate") return "shopping.naver 또는 NaPm shopping marker가 있어 네이버 쇼핑검색 후보로만 둔다.";
  if (classification === "organic_naver_candidate") return "네이버 검색 referrer는 있으나 paid marker가 없어 자연검색 후보로 둔다.";
  return "네이버 흔적은 있으나 paid/brandsearch/organic 확정 조건을 충족하지 않는다.";
};

const buildNaverAggregateFromItems = (
  items: LedgerItem[],
  filters: Record<string, unknown>,
  coverageStatus: NaverEvidenceAggregate["coverageStatus"],
  endpointStatus: NaverEvidenceAggregate["endpointStatus"],
): NaverEvidenceAggregate => {
  const rows = new Map<string, NaverEvidenceAggregateRow>();
  for (const item of items) {
    const classification = classifyNaverAggregateItem(item);
    if (!classification) continue;
    const touchpoint = item.touchpoint || "unknown";
    const key = `${classification}:${touchpoint}`;
    const current = rows.get(key) || {
      class: classification,
      touchpoint,
      rows: 0,
      bridgeKeyPresent: 0,
      confidence: classification === "organic_naver_candidate" ? "C" as const : "aggregate_only" as const,
      budgetRoasIncluded: false as const,
      useForBudgetRoas: "reference_only_not_budget" as const,
      note: naverAggregateNote(classification),
    };
    current.rows += 1;
    if (item.orderId || item.paymentKey) current.bridgeKeyPresent += 1;
    rows.set(key, current);
  }
  const ordered = Array.from(rows.values()).sort((a, b) =>
    a.class.localeCompare(b.class) || a.touchpoint.localeCompare(b.touchpoint),
  );
  const byClass = NAVER_EVIDENCE_CLASSES.reduce<Record<NaverEvidenceAggregateRow["class"], number>>((acc, key) => {
    acc[key] = 0;
    return acc;
  }, {} as Record<NaverEvidenceAggregateRow["class"], number>);
  for (const row of ordered) {
    byClass[row.class] = (byClass[row.class] || 0) + row.rows;
  }
  return {
    contractVersion: "naver-evidence-aggregate-v0.1",
    aggregateOnly: true,
    rawIdentifierOutput: false,
    budgetRoasIncluded: false,
    source: coverageStatus === "full_aggregate"
      ? "attribution_ledger full filtered aggregate"
      : "attribution_ledger limited item slice fallback",
    coverageStatus,
    endpointStatus,
    filters,
    summary: {
      rowsTotal: items.length,
      naverAny: ordered.reduce((sum, row) => sum + row.rows, 0),
      byClass,
    },
    rows: ordered,
    warnings: [
      "UTM/NaPm/n_*는 채널 evidence이며 actual 매출 정본이 아니다.",
      "예산 ROAS에는 자동 포함하지 않는다.",
      ...(coverageStatus === "limited_item_slice_fallback"
        ? ["aggregate endpoint unavailable; /api/attribution/ledger item slice 기준이므로 VM Cloud 전체 숫자와 다를 수 있다."]
        : []),
    ],
  };
};

const fetchVmNaverEvidenceAggregate = async (
  source: string,
  startAt: string,
  endAt: string,
  fallbackItems: LedgerItem[],
): Promise<NaverEvidenceAggregate> => {
  const url = new URL("/api/attribution/ledger/naver-evidence-aggregate", ATTRIBUTION_BASE_URL);
  url.searchParams.set("source", source);
  url.searchParams.set("startAt", startAt);
  url.searchParams.set("endAt", endAt);
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    if (!response.ok) {
      return buildNaverAggregateFromItems(
        fallbackItems,
        { source, startAt, endAt },
        "limited_item_slice_fallback",
        "unavailable",
      );
    }
    const body = await response.json() as { aggregate?: NaverEvidenceAggregate };
    if (!body.aggregate?.rows) {
      return buildNaverAggregateFromItems(
        fallbackItems,
        { source, startAt, endAt },
        "limited_item_slice_fallback",
        "unavailable",
      );
    }
    return {
      ...body.aggregate,
      coverageStatus: "full_aggregate",
      endpointStatus: "available",
      warnings: body.aggregate.warnings || [],
    };
  } catch {
    return buildNaverAggregateFromItems(
      fallbackItems,
      { source, startAt, endAt },
      "limited_item_slice_fallback",
      "unavailable",
    );
  }
};

type PlatformFetchResult = {
  status: PlatformReferenceRow["platformReference"]["status"];
  source: string;
  spendKrw: number | null;
  conversionValueKrw: number | null;
  roas: number | null;
  attributionWindow: string | null;
  actionReportTime: string | null;
  queriedAt: string | null;
  freshness: PlatformReferenceRow["platformReference"]["freshness"];
  error: string | null;
  sourceWindow: {
    startDate: string | null;
    endDate: string | null;
    latestDate: string | null;
  };
  sourceDiagnostics: Record<string, unknown> | null;
};

const unavailablePlatformReference = (
  source: string,
  error: string,
  freshness: PlatformReferenceRow["platformReference"]["freshness"] = "blocked",
): PlatformFetchResult => ({
  status: "unavailable",
  source,
  spendKrw: null,
  conversionValueKrw: null,
  roas: null,
  attributionWindow: null,
  actionReportTime: null,
  queriedAt: new Date().toISOString(),
  freshness,
  error,
  sourceWindow: {
    startDate: null,
    endDate: null,
    latestDate: null,
  },
  sourceDiagnostics: null,
});

const joinedPlatformReference = (input: Omit<PlatformFetchResult, "status" | "error">): PlatformFetchResult => ({
  ...input,
  status: "joined",
  error: null,
});

const fetchMetaPlatformReference = async (
  startDate: string,
  endDateInclusive: string,
): Promise<PlatformFetchResult> => {
  const token = env.META_ADMANAGER_API_KEY;
  const accountId = "act_3138805896402376";
  if (!token) {
    return unavailablePlatformReference("Meta Ads Insights API", "META_ADMANAGER_API_KEY is not configured");
  }

  const url = new URL(`https://graph.facebook.com/v22.0/${accountId}/insights`);
  url.searchParams.set("access_token", token);
  url.searchParams.set("fields", "spend,actions,action_values");
  url.searchParams.set("time_range", JSON.stringify({ since: startDate, until: endDateInclusive }));
  url.searchParams.set("action_report_time", "conversion");
  url.searchParams.set("use_unified_attribution_setting", "true");
  url.searchParams.set("limit", "10");

  const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  const body = await response.json() as {
    data?: Array<{
      spend?: string;
      actions?: Array<{ action_type?: string; value?: string }>;
      action_values?: Array<{ action_type?: string; value?: string }>;
    }>;
    error?: { message?: string };
  };

  if (!response.ok || body.error) {
    return unavailablePlatformReference(
      "Meta Ads Insights API",
      body.error?.message || `Meta API request failed: ${response.status}`,
      "error",
    );
  }

  const rows = body.data || [];
  const spend = rows.reduce((sum, row) => sum + toNumber(row.spend), 0);
  const conversionValue = rows.reduce((sum, row) => {
    const purchase = row.action_values?.find((action) =>
      action.action_type === "purchase" || action.action_type === "offsite_conversion.fb_pixel_purchase"
    );
    return sum + toNumber(purchase?.value);
  }, 0);

  return joinedPlatformReference({
    source: "Meta Ads Insights API",
    spendKrw: Math.round(spend),
    conversionValueKrw: Math.round(conversionValue),
    roas: roas(conversionValue, spend),
    attributionWindow: "use_unified_attribution_setting=true",
    actionReportTime: "conversion",
    queriedAt: new Date().toISOString(),
    freshness: "fresh",
    sourceWindow: {
      startDate,
      endDate: endDateInclusive,
      latestDate: endDateInclusive,
    },
    sourceDiagnostics: {
      accountId,
      rows: rows.length,
      currency: "KRW",
    },
  });
};

const fetchTikTokPlatformReference = async (
  startDate: string,
  endDateInclusive: string,
): Promise<PlatformFetchResult> => {
  try {
    const report = await buildTikTokRoasComparison({
      startDate,
      endDate: endDateInclusive,
      autoIngest: false,
    });
    const summary = report.ads_report.summary;
    return joinedPlatformReference({
      source: report.ads_report.source,
      spendKrw: Math.round(summary.spend),
      conversionValueKrw: Math.round(summary.purchaseValue),
      roas: summary.platformRoas == null ? null : round2(summary.platformRoas),
      attributionWindow: `${report.attribution_window.click}_click/${report.attribution_window.view}_view`,
      actionReportTime: "TikTok export default",
      queriedAt: new Date().toISOString(),
      freshness: report.local_table.daily.readyForImport ? "local_cache" : "blocked",
      sourceWindow: {
        startDate,
        endDate: endDateInclusive,
        latestDate: report.local_table.daily.maxDate,
      },
      sourceDiagnostics: {
        dailyTable: report.local_table.daily,
        availableRanges: report.local_table.availableRanges,
        warnings: report.warnings,
        currency: summary.currency,
      },
    });
  } catch (error) {
    return unavailablePlatformReference(
      "TikTok Business API/local export",
      error instanceof Error ? error.message : "TikTok reference failed",
      "error",
    );
  }
};

const fetchGooglePlatformReference = async (
  startDate: string,
  endDateInclusive: string,
): Promise<PlatformFetchResult> => {
  const developerToken = env.GOOGLE_ADS_DEVELOPER_TOKEN;
  const rawCredentials = env.GSC_SERVICE_ACCOUNT_KEY ?? env.GA4_BIOCOM_SERVICE_ACCOUNT_KEY;
  if (!developerToken) {
    return unavailablePlatformReference("Google Ads API", "GOOGLE_ADS_DEVELOPER_TOKEN is not configured");
  }
  if (!rawCredentials) {
    return unavailablePlatformReference("Google Ads API", "Google service account key is not configured");
  }

  try {
    const credentials = JSON.parse(rawCredentials) as Record<string, unknown>;
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/adwords"],
    });
    const client = await auth.getClient();
    const accessToken = await client.getAccessToken();
    const token = typeof accessToken === "string" ? accessToken : accessToken?.token;
    if (!token) {
      return unavailablePlatformReference("Google Ads API", "Failed to obtain Google Ads OAuth access token");
    }

    const customerId = env.GOOGLE_ADS_CUSTOMER_ID.replace(/\D/g, "");
    const query = `
      SELECT
        campaign.id,
        metrics.cost_micros,
        metrics.conversions,
        metrics.conversions_value,
        metrics.all_conversions,
        metrics.all_conversions_value
      FROM campaign
      WHERE segments.date BETWEEN '${startDate}' AND '${endDateInclusive}'
        AND metrics.cost_micros > 0
      LIMIT 10000
    `;

    const response = await fetch(
      `https://googleads.googleapis.com/${env.GOOGLE_ADS_API_VERSION}/customers/${customerId}/googleAds:search`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "developer-token": developerToken,
          ...(env.GOOGLE_ADS_LOGIN_CUSTOMER_ID
            ? { "login-customer-id": env.GOOGLE_ADS_LOGIN_CUSTOMER_ID.replace(/\D/g, "") }
            : {}),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query }),
      },
    );
    const text = await response.text();
    if (!response.ok) {
      return unavailablePlatformReference("Google Ads API", text.slice(0, 500), "error");
    }

    const body = JSON.parse(text) as { results?: Array<{ metrics?: Record<string, unknown> }> };
    const rows = body.results || [];
    const spend = rows.reduce((sum, row) => sum + toNumber(row.metrics?.costMicros) / 1_000_000, 0);
    const conversionValue = rows.reduce((sum, row) => sum + toNumber(row.metrics?.conversionsValue), 0);

    return joinedPlatformReference({
      source: "Google Ads API",
      spendKrw: Math.round(spend),
      conversionValueKrw: Math.round(conversionValue),
      roas: roas(conversionValue, spend),
      attributionWindow: "Google Ads conversion action settings",
      actionReportTime: "segments.date by Google Ads reporting timezone",
      queriedAt: new Date().toISOString(),
      freshness: "fresh",
      sourceWindow: {
        startDate,
        endDate: endDateInclusive,
        latestDate: endDateInclusive,
      },
      sourceDiagnostics: {
        customerId,
        rows: rows.length,
        currency: "KRW",
      },
    });
  } catch (error) {
    return unavailablePlatformReference(
      "Google Ads API",
      error instanceof Error ? error.message : "Google Ads reference failed",
      "error",
    );
  }
};

/**
 * gpt0508-49 단계3: 로컬DB SQLite naver_ads_daily (네이버 검색광고 API 일별 캐시) 에서 광고비 + convAmt 합산.
 * - 광고비 (salesAmt) 는 정본 후보 — /total "광고비" 카드에 사용 가능
 * - convAmt 는 네이버 자체 attribution 기준 주장 매출 — 참고값, 내부 매출과 합산 금지
 */
const fetchNaverPlatformReference = async (
  startDate: string,
  endDateInclusive: string,
): Promise<PlatformFetchResult> => {
  try {
    const summary = summarizeNaverAdsDaily({
      site: "biocom",
      since: startDate,
      until: endDateInclusive,
    });
    if (summary.total_rows === 0) {
      return unavailablePlatformReference(
        "Naver Search Ad API (local cache)",
        "naver_ads_daily 캐시 비어있음 — backend/scripts/naver-ads-collect-7d-20260513.ts 또는 별도 sync 명령 실행 필요",
        "blocked_or_empty",
      );
    }
    const dates = summary.by_campaign.length > 0 ? summary.by_campaign[0].days : 0;
    return joinedPlatformReference({
      source: "Naver Search Ad API → 로컬DB naver_ads_daily",
      spendKrw: summary.total_sales_amt_krw,
      conversionValueKrw: summary.total_conv_amt_krw,
      roas:
        summary.total_sales_amt_krw > 0
          ? round2(summary.total_conv_amt_krw / summary.total_sales_amt_krw)
          : null,
      attributionWindow: "네이버 자체 attribution (보통 7일 클릭, 1일 view)",
      actionReportTime: null,
      queriedAt: new Date().toISOString(),
      freshness: "local_cache",
      sourceWindow: {
        startDate,
        endDate: endDateInclusive,
        latestDate: endDateInclusive,
      },
      sourceDiagnostics: {
        rows: summary.total_rows,
        campaigns_with_spend: summary.by_campaign.filter((c) => c.salesAmtKrw > 0).length,
        campaigns_total: summary.by_campaign.length,
        cached_days: dates,
        warning:
          "convAmt 는 네이버 자체 attribution. 운영DB tb_iamweb_users 결제완료 매출과 합산 금지.",
      },
    });
  } catch (error) {
    return unavailablePlatformReference(
      "Naver Search Ad API (local cache)",
      error instanceof Error ? error.message : "Naver Ads local cache read failed",
      "error",
    );
  }
};

const buildPlatformReference = async (
  channelSummary: ChannelSummaryRow[],
  range: ReturnType<typeof monthRange>,
) => {
  const byChannel = new Map(channelSummary.map((row) => [row.primaryChannel, row]));
  const endDateInclusive = previousDate(range.endDateExclusive);
  const fetched = new Map<PlatformReferenceRow["platform"], PlatformFetchResult>();
  const results = await Promise.allSettled([
    fetchMetaPlatformReference(range.startDate, endDateInclusive),
    fetchTikTokPlatformReference(range.startDate, endDateInclusive),
    fetchGooglePlatformReference(range.startDate, endDateInclusive),
    fetchNaverPlatformReference(range.startDate, endDateInclusive),
  ]);
  const platforms: PlatformReferenceRow["platform"][] = ["meta", "tiktok", "google", "naver"];
  results.forEach((result, index) => {
    const platform = platforms[index];
    fetched.set(
      platform,
      result.status === "fulfilled"
        ? result.value
        : unavailablePlatformReference(`${platform} platform reference`, String(result.reason), "error"),
    );
  });

  const specs: Array<{
    platform: PlatformReferenceRow["platform"];
    internalChannel: string;
    source: string;
  }> = [
    {
      platform: "meta",
      internalChannel: "paid_meta",
      source: "Meta Ads Insights API or exported Ads Manager report",
    },
    {
      platform: "tiktok",
      internalChannel: "paid_tiktok",
      source: "TikTok Business API or exported TikTok Ads report",
    },
    {
      platform: "google",
      internalChannel: "paid_google",
      source: "Google Ads API or exported Google Ads report",
    },
    {
      platform: "naver",
      internalChannel: "paid_naver",
      source: "Naver Ads API/export plus NPay intent/reference ledger when available",
    },
  ];

  const rows: PlatformReferenceRow[] = specs.map((spec) => {
    const internal = byChannel.get(spec.internalChannel);
    const reference = fetched.get(spec.platform) ?? unavailablePlatformReference(spec.source, "platform reference not fetched");
    const internalRevenue = internal?.revenue || 0;
    const internalRoas = roas(internalRevenue, reference.spendKrw);
    return {
      platform: spec.platform,
      internalChannel: spec.internalChannel,
      internalConfirmed: {
        orders: internal?.orders || 0,
        revenue: internalRevenue,
        confidenceRevenue: internal?.confidence || {},
      },
      platformReference: reference,
      gap: {
        conversionValueMinusInternalRevenue: reference.conversionValueKrw == null
          ? null
          : Math.round(reference.conversionValueKrw - internalRevenue),
        roasDelta: reference.roas != null && internalRoas != null ? round2(reference.roas - internalRoas) : null,
        reason: reference.status === "joined"
          ? "platform_value_minus_internal_confirmed_revenue"
          : "platform_api_reference_not_connected",
      },
      allowedUse: "platform_reference_only",
      forbiddenUse: "do_not_add_to_internal_confirmed_revenue",
    };
  });

  return {
    contractVersion: "platform-reference-v0.2",
    referenceOnly: true,
    noInternalRevenueMerge: true,
    joinStatus: rows.some((row) => row.platformReference.status === "joined") ? "partial_join" : "skeleton_only",
    reason: "Platform API values are intentionally kept as reference-only and never merged into internal confirmed revenue.",
    requiredMetadataWhenJoined: [
      "platform",
      "source",
      "queried_at",
      "timezone",
      "date_range",
      "attribution_window",
      "action_report_time",
      "currency",
      "rounding_rule",
    ],
    primaryJoinKeys: [
      "platform_campaign_id",
      "platform_adset_or_group_id",
      "platform_ad_id",
      "utm_campaign",
      "utm_term",
      "utm_content",
      "click_id",
    ],
    rows,
  };
};

const run = async (options: Options) => {
  const range =
    options.since && options.until
      ? customRange(options.since, options.until)
      : monthRange(options.month);
  const rows = await getSpineRows(options.site, range.startDate, range.endDateExclusive);
  const vm = await fetchVmLedger(`${options.site}_imweb`, range.startAtUtc, range.endAtUtc);
  const indexes = buildLedgerIndexes(vm.items || []);
  let npayReport: NpayRoasDryRunReport | null = null;
  let npayReportError = "";

  try {
    npayReport = await buildNpayRoasDryRunReport({
      start: range.startAtUtc,
      end: range.endAtUtc,
      site: options.site,
      sqlitePath: options.npayIntentDbPath,
    });
  } catch (error) {
    npayReportError = error instanceof Error ? error.message : String(error);
  }

  const npaySourceAccess: NpayContext["sourceAccess"] = npayReport
    ? npayReport.summary.liveIntentCount > 0
      ? "available"
      : "empty_or_unavailable"
    : "error";
  const npayContext: NpayContext = {
    sourceAccess: npaySourceAccess,
    byOrderNumber: new Map(npayReport?.orderResults.map((result) => [result.order.orderNumber, result]) || []),
  };
  const assignments = rows.map((row) => assignRow(row, indexes, npayContext));
  const totalRevenue = assignments.reduce((sum, assignment) => sum + assignment.netRevenue, 0);
  const assignedRevenue = assignments
    .filter((assignment) => assignment.primaryChannel !== "unknown" && assignment.primaryChannel !== "quarantine")
    .reduce((sum, assignment) => sum + assignment.netRevenue, 0);
  const summary = summarizeAssignments(assignments);
  const naverOrganicEvidence = summarizeNaverLedgerAggregate(vm.items || [], summary.naverOrganicEvidence);
  const naverEvidenceAggregate = await fetchVmNaverEvidenceAggregate(
    `${options.site}_imweb`,
    range.startAtUtc,
    range.endAtUtc,
    vm.items || [],
  );
  const platformReference = await buildPlatformReference(summary.byChannel, range);

  return {
    metadata: {
      contractVersion: CONTRACT_VERSION,
      site: options.site,
      month: options.month,
      timezone: "Asia/Seoul",
      dateStart: range.startDate,
      dateEndExclusive: range.endDateExclusive,
      attributionStartAt: range.startAtUtc,
      attributionEndAt: range.endAtUtc,
      queriedAt: new Date().toISOString(),
      dryRun: true,
      write: false,
      send: false,
    },
    source: {
      vmFilters: vm.filters,
      vmSummary: vm.summary,
      npayIntentMatching: npayReport
        ? {
            sourceAccess: npaySourceAccess,
            source: npayReport.source.intents,
            window: npayReport.window,
            summary: npayReport.summary,
          }
        : {
            sourceAccess: npaySourceAccess,
            error: npayReportError,
          },
    },
    totals: {
      ordersTotalAb: assignments.length,
      revenueTotalAb: totalRevenue,
      assignedOrders: assignments.filter((assignment) => assignment.primaryChannel !== "unknown").length,
      assignedRevenue,
      unknownOrders: assignments.filter((assignment) => assignment.primaryChannel === "unknown").length,
      unknownRevenue: assignments
        .filter((assignment) => assignment.primaryChannel === "unknown")
        .reduce((sum, assignment) => sum + assignment.netRevenue, 0),
      primarySumMatchesRevenue: summary.byChannel.reduce((sum, row) => sum + row.revenue, 0) === totalRevenue,
    },
    channelSummary: summary.byChannel,
    platformReference,
    unknownReasons: summary.unknownReasons,
    unknownReasonDetails: summary.unknownReasonDetails,
    naverOrganicEvidence,
    naverEvidenceAggregate,
    utmInvalidAudit: summary.utmInvalidAudit,
    subscriptionAcquisitionSummary: summary.subscriptionAcquisition,
    evidenceTierSummary: summary.evidenceTiers,
    npayIntentStatusSummary: summary.npayIntentStatuses,
    sampleRows: [],
  };
};

const printMarkdown = (payload: Awaited<ReturnType<typeof run>>) => {
  const {
    metadata,
    totals,
    channelSummary,
    platformReference,
    unknownReasons,
    unknownReasonDetails,
    naverOrganicEvidence,
    naverEvidenceAggregate,
    utmInvalidAudit,
    subscriptionAcquisitionSummary,
  } = payload;
  console.log(`# monthly-evidence-join-dry-run ${metadata.site} ${metadata.month}`);
  console.log("");
  console.log(`- contract_version: ${metadata.contractVersion}`);
  console.log(`- timezone: ${metadata.timezone}`);
  console.log(`- window: ${metadata.dateStart} <= KST < ${metadata.dateEndExclusive}`);
  console.log(`- dry_run/write/send: ${metadata.dryRun}/${metadata.write}/${metadata.send}`);
  console.log("");
  console.log("## Totals");
  console.log("");
  console.log("| metric | value |");
  console.log("|---|---:|");
  console.log(`| orders_total_ab | ${totals.ordersTotalAb.toLocaleString("ko-KR")} |`);
  console.log(`| revenue_total_ab | ${krw(totals.revenueTotalAb)} |`);
  console.log(`| assigned_orders | ${totals.assignedOrders.toLocaleString("ko-KR")} |`);
  console.log(`| assigned_revenue | ${krw(totals.assignedRevenue)} |`);
  console.log(`| unknown_orders | ${totals.unknownOrders.toLocaleString("ko-KR")} |`);
  console.log(`| unknown_revenue | ${krw(totals.unknownRevenue)} |`);
  console.log(`| primary_sum_matches_revenue | ${totals.primarySumMatchesRevenue ? "YES" : "NO"} |`);
  console.log("");
  console.log("## Channel Summary");
  console.log("");
  console.log("| primary_channel | orders | revenue | confidence_revenue |");
  console.log("|---|---:|---:|---|");
  for (const row of channelSummary) {
    const confidenceRevenue = Object.entries(row.confidence)
      .map(([key, value]) => `${key}:${krw(value)}`)
      .join(", ");
    console.log(`| ${row.primaryChannel} | ${row.orders.toLocaleString("ko-KR")} | ${krw(row.revenue)} | ${confidenceRevenue} |`);
  }
  console.log("");
  console.log("## Platform Reference Skeleton");
  console.log("");
  console.log(`- contract_version: ${platformReference.contractVersion}`);
  console.log(`- reference_only: ${platformReference.referenceOnly ? "YES" : "NO"}`);
  console.log(`- no_internal_revenue_merge: ${platformReference.noInternalRevenueMerge ? "YES" : "NO"}`);
  console.log(`- join_status: ${platformReference.joinStatus}`);
  console.log("");
  console.log("| platform | internal_channel | internal_orders | internal_revenue | platform_status |");
  console.log("|---|---|---:|---:|---|");
  for (const row of platformReference.rows) {
    console.log(
      `| ${row.platform} | ${row.internalChannel} | ${row.internalConfirmed.orders.toLocaleString("ko-KR")} | ${krw(row.internalConfirmed.revenue)} | ${row.platformReference.status} |`,
    );
  }
  console.log("");
  console.log("## Unknown Reasons");
  console.log("");
  console.log("| unknown_reason | orders | revenue |");
  console.log("|---|---:|---:|");
  for (const row of unknownReasons) {
    console.log(`| ${row.unknownReason} | ${row.orders.toLocaleString("ko-KR")} | ${krw(row.revenue)} |`);
  }
  console.log("");
  console.log("## Unknown Reason Details");
  console.log("");
  console.log("| root_reason | detail | orders | revenue | next_evidence_needed | recommended_fix |");
  console.log("|---|---|---:|---:|---|---|");
  for (const row of unknownReasonDetails) {
    console.log(`| ${row.rootReason} | ${row.detail} | ${row.orders.toLocaleString("ko-KR")} | ${krw(row.revenue)} | ${row.nextEvidenceNeeded} | ${row.recommendedFix} |`);
  }
  console.log("");
  console.log("## Naver Organic Evidence");
  console.log("");
  console.log("| label | orders | revenue | confidence | use_for_budget_roas | source | note |");
  console.log("|---|---:|---:|---|---|---|---|");
  for (const row of naverOrganicEvidence) {
    console.log(`| ${row.label} | ${row.orders.toLocaleString("ko-KR")} | ${row.revenue == null ? "-" : krw(row.revenue)} | ${row.confidence} | ${row.useForBudgetRoas} | ${row.source} | ${row.note} |`);
  }
  console.log("");
  console.log("## Naver Evidence Aggregate");
  console.log("");
  console.log(`- coverage_status: ${naverEvidenceAggregate.coverageStatus}`);
  console.log(`- endpoint_status: ${naverEvidenceAggregate.endpointStatus}`);
  console.log("| class | touchpoint | rows | bridge_key_present | use_for_budget_roas | note |");
  console.log("|---|---|---:|---:|---|---|");
  for (const row of naverEvidenceAggregate.rows) {
    console.log(`| ${row.class} | ${row.touchpoint} | ${row.rows.toLocaleString("ko-KR")} | ${row.bridgeKeyPresent.toLocaleString("ko-KR")} | ${row.useForBudgetRoas} | ${row.note} |`);
  }
  console.log("");
  console.log("## UTM Invalid Audit");
  console.log("");
  console.log("| family | source | medium | campaign | candidate_rule | orders | revenue |");
  console.log("|---|---|---|---|---|---:|---:|");
  for (const row of utmInvalidAudit) {
    console.log(`| ${row.family} | ${row.source} | ${row.medium} | ${row.campaign} | ${row.candidateRule} | ${row.orders.toLocaleString("ko-KR")} | ${krw(row.revenue)} |`);
  }
  console.log("");
  console.log("## Subscription Acquisition Summary");
  console.log("");
  console.log("| metric | value |");
  console.log("|---|---:|");
  for (const [key, value] of Object.entries(subscriptionAcquisitionSummary)) {
    console.log(`| ${key} | ${typeof value === "number" ? value.toLocaleString("ko-KR") : value} |`);
  }
};

const main = async () => {
  const options = parseArgs();
  const payload = await run(options);
  if (options.json) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    printMarkdown(payload);
  }
};

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await getPgPool().end();
    } catch {
      // Ignore close errors after reporting the primary result.
    }
  });
