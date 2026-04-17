import type { AttributionLedgerEntry } from "./attribution";
import { readLedgerEntries, resolveLedgerRevenueValue } from "./attribution";
import {
  queryGA4SourceConversion,
  type GA4SourceConversionResult,
  type GA4SourceConversionRow,
} from "./ga4";
import { parseIsoDate, shiftIsoDateByDays } from "./utils/isoDate";

const SITE_CONFIG = [
  {
    key: "biocom",
    source: "biocom_imweb",
    name: "바이오컴 자사몰",
    domain: "biocom.kr",
    conversionName: "결제완료",
    primaryTouchpoint: "payment_success",
  },
  {
    key: "thecleancoffee",
    source: "thecleancoffee_imweb",
    name: "더클린커피",
    domain: "thecleancoffee.com",
    conversionName: "결제완료",
    primaryTouchpoint: "payment_success",
  },
  {
    key: "aibio",
    source: "aibio_imweb",
    name: "AIBIO 센터",
    domain: "aibio.ai",
    conversionName: "상담/폼 제출",
    primaryTouchpoint: "form_submit",
  },
] as const;

type SiteConfig = (typeof SITE_CONFIG)[number];

type ChannelKey =
  | "meta"
  | "google_ads"
  | "tiktok"
  | "naver"
  | "kakao"
  | "google_organic"
  | "direct"
  | "internal"
  | "referral"
  | "unknown";

type ChannelInfo = {
  key: ChannelKey;
  label: string;
  description: string;
};

const CHANNEL_INFO: Record<ChannelKey, ChannelInfo> = {
  meta: {
    key: "meta",
    label: "Meta / Instagram",
    description: "fbclid, fbc/fbp, Instagram/Facebook referrer, meta UTM 기준",
  },
  google_ads: {
    key: "google_ads",
    label: "Google Ads",
    description: "gclid 또는 Google paid UTM 기준",
  },
  tiktok: {
    key: "tiktok",
    label: "TikTok",
    description: "ttclid 또는 TikTok referrer/UTM 기준",
  },
  naver: {
    key: "naver",
    label: "Naver 검색/쇼핑",
    description: "Naver referrer, NaPm, naver UTM 기준",
  },
  kakao: {
    key: "kakao",
    label: "Kakao",
    description: "Kakao referrer/UTM 기준",
  },
  google_organic: {
    key: "google_organic",
    label: "Google organic",
    description: "Google referrer가 있으나 gclid/paid UTM이 없는 경우",
  },
  direct: {
    key: "direct",
    label: "Direct / unknown",
    description: "광고 클릭 ID, UTM, 외부 referrer가 없는 경우",
  },
  internal: {
    key: "internal",
    label: "Internal",
    description: "동일 사이트 내부 이동만 확인되는 경우",
  },
  referral: {
    key: "referral",
    label: "Referral / other",
    description: "기타 외부 referrer 또는 미분류 UTM",
  },
  unknown: {
    key: "unknown",
    label: "Unknown",
    description: "원장 값이 부족해 판단 불가",
  },
};

const TEST_PHONE_DIGITS = new Set(["0100000000", "01000000000"]);
const TEST_NAME_VALUES = new Set(["테스트", "test"]);
const TEST_PHONE_FIELD_KEYS = new Set([
  "phone",
  "phonenumber",
  "phone_number",
  "mobile",
  "mobilephone",
  "mobile_phone",
  "customerphone",
  "customer_phone",
  "customermobilephone",
  "customer_mobile_phone",
  "buyerphone",
  "buyer_phone",
  "orderercall",
  "orderer_call",
  "callnum",
  "customerkey",
  "customer_key",
  "normalizedphone",
]);
const TEST_NAME_FIELD_KEYS = new Set([
  "name",
  "username",
  "user_name",
  "customername",
  "customer_name",
  "buyername",
  "buyer_name",
  "orderername",
  "orderer_name",
  "applicantname",
  "applicant_name",
  "contactname",
  "contact_name",
]);

type ChannelAccumulator = {
  channel: ChannelInfo;
  count: number;
  confirmedCount: number;
  pendingCount: number;
  canceledCount: number;
  revenue: number;
  pendingRevenue: number;
  examples: string[];
};

type DimensionAccumulator = {
  label: string;
  count: number;
  revenue: number;
  examples: string[];
};

type RecentSample = {
  loggedAt: string;
  touchpoint: string;
  paymentStatus: string | null;
  channel: string;
  landing: string;
  referrer: string;
  utmSource: string;
  utmCampaign: string;
  clickIdType: string | null;
};

export type AcquisitionChannelRow = {
  key: ChannelKey;
  label: string;
  description: string;
  count: number;
  share: number;
  confirmedCount: number;
  pendingCount: number;
  canceledCount: number;
  revenue: number;
  pendingRevenue: number;
  examples: string[];
};

export type AcquisitionDimensionRow = {
  label: string;
  count: number;
  share: number;
  revenue: number;
  examples: string[];
};

export type AcquisitionSiteReport = {
  key: string;
  source: string;
  name: string;
  domain: string;
  conversionName: string;
  totalConversions: number;
  operationalConversions: number;
  rawConversions: number;
  liveConversions: number;
  confirmedConversions: number;
  pendingConversions: number;
  canceledConversions: number;
  confirmedRevenue: number;
  pendingRevenue: number;
  totalObservedRevenue: number;
  excludedConversions: number;
  latestLoggedAt: string | null;
  identityCoverageRate: number;
  topChannel: AcquisitionChannelRow | null;
  channels: AcquisitionChannelRow[];
  campaigns: AcquisitionDimensionRow[];
  landings: AcquisitionDimensionRow[];
  recentSamples: RecentSample[];
  insights: string[];
  dataWarnings: string[];
};

export type AcquisitionSummaryReport = {
  generatedAt: string;
  range: {
    rangeDays: number;
    startAt: string;
    endAt: string;
  };
  sites: AcquisitionSiteReport[];
  notes: string[];
};

const toText = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

const toSearchText = (value: unknown): string => {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
};

const lower = (value: unknown) => toText(value).toLowerCase();

const parseDate = (value: string) => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const getMetadataString = (entry: AttributionLedgerEntry, keys: string[]) => {
  for (const key of keys) {
    const value = toText(entry.metadata?.[key]);
    if (value) return value;
  }
  return "";
};

const getMetadataRecord = (entry: AttributionLedgerEntry, key: string): Record<string, unknown> => {
  const value = entry.metadata?.[key];
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
};

const getNestedMetadataSearchValues = (entry: AttributionLedgerEntry) => {
  const touchKeys = ["first_touch", "last_touch", "session_touch", "firstTouch", "lastTouch", "sessionTouch"];
  const fieldKeys = [
    "landing",
    "landingUrl",
    "landing_url",
    "url",
    "referrer",
    "referrerUrl",
    "referrer_url",
    "utmSource",
    "utm_source",
    "utmMedium",
    "utm_medium",
    "utmCampaign",
    "utm_campaign",
    "fbclid",
    "gclid",
    "ttclid",
    "fbc",
    "fbp",
  ];

  return touchKeys.flatMap((touchKey) => {
    const record = getMetadataRecord(entry, touchKey);
    return fieldKeys.map((fieldKey) => toSearchText(record[fieldKey]));
  });
};

const collectMetadataValuesByKey = (
  value: unknown,
  keys: Set<string>,
  depth = 0,
): string[] => {
  if (!value || typeof value !== "object" || depth > 4) return [];
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectMetadataValuesByKey(item, keys, depth + 1));
  }

  const values: string[] = [];
  for (const [key, child] of Object.entries(value)) {
    const normalizedKey = key.trim().toLowerCase();
    if (keys.has(normalizedKey)) {
      const text = toSearchText(child);
      if (text) values.push(text);
    }
    values.push(...collectMetadataValuesByKey(child, keys, depth + 1));
  }
  return values;
};

const normalizeDigits = (value: string) => value.replace(/\D/g, "");

const isTestPhoneValue = (value: string) => TEST_PHONE_DIGITS.has(normalizeDigits(value));

const isTestNameValue = (value: string) => {
  const normalized = value.replace(/\s/g, "").toLowerCase();
  return TEST_NAME_VALUES.has(normalized);
};

const isTruthyMarker = (value: unknown) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value !== "string") return false;
  return ["1", "true", "y", "yes"].includes(value.trim().toLowerCase());
};

const parseUrlSafe = (value: string) => {
  if (!value) return null;
  try {
    return new URL(value, "https://placeholder.local");
  } catch {
    return null;
  }
};

const getQueryParam = (value: string, key: string) => {
  const parsed = parseUrlSafe(value);
  return parsed?.searchParams.get(key)?.trim() ?? "";
};

const getFirstQueryParam = (urls: string[], key: string) => {
  for (const url of urls) {
    const value = getQueryParam(url, key);
    if (value) return value;
  }
  return "";
};

const getReferrerCandidate = (entry: AttributionLedgerEntry) =>
  getMetadataString(entry, [
    "initial_referrer",
    "original_referrer",
    "latestReferrer",
    "initialReferrer",
    "originalReferrer",
  ]) ||
  entry.referrer ||
  entry.requestContext?.requestReferer ||
  "";

const getLandingCandidate = (entry: AttributionLedgerEntry) =>
  getMetadataString(entry, [
    "imweb_landing_url",
    "checkout_started_landing",
    "initialLanding",
    "originalLanding",
    "latestLanding",
  ]) ||
  entry.landing ||
  "";

const isDirectValue = (value: string) => {
  const normalized = value.trim().toLowerCase();
  return !normalized || normalized === "@direct" || normalized === "direct" || normalized === "(direct)";
};

const isInternalReferrer = (value: string, config: SiteConfig) => {
  const parsed = parseUrlSafe(value);
  if (!parsed) return false;
  return parsed.hostname.replace(/^www\./, "") === config.domain;
};

const getUtm = (entry: AttributionLedgerEntry, key: "source" | "medium" | "campaign" | "content" | "term") => {
  const direct =
    key === "source"
      ? entry.utmSource
      : key === "medium"
        ? entry.utmMedium
        : key === "campaign"
          ? entry.utmCampaign
          : key === "content"
            ? entry.utmContent
            : entry.utmTerm;
  if (direct) return direct;

  const landing = getLandingCandidate(entry);
  const referrer = getReferrerCandidate(entry);
  const queryKey = `utm_${key}`;
  return getFirstQueryParam([landing, referrer, entry.landing, entry.referrer], queryKey);
};

const getClickId = (entry: AttributionLedgerEntry) => {
  const landing = getLandingCandidate(entry);
  const referrer = getReferrerCandidate(entry);
  const urls = [landing, referrer, entry.landing, entry.referrer];
  const fbclid = entry.fbclid || getFirstQueryParam(urls, "fbclid");
  const gclid = entry.gclid || getFirstQueryParam(urls, "gclid");
  const ttclid = entry.ttclid || getFirstQueryParam(urls, "ttclid");
  const fbc = getMetadataString(entry, ["fbc"]);
  const fbp = getMetadataString(entry, ["fbp"]);

  if (ttclid) return { type: "ttclid", value: ttclid };
  if (gclid) return { type: "gclid", value: gclid };
  if (fbclid) return { type: "fbclid", value: fbclid };
  if (fbc) return { type: "fbc", value: fbc };
  if (fbp) return { type: "fbp", value: fbp };
  return null;
};

const resolveChannel = (entry: AttributionLedgerEntry, config: SiteConfig): ChannelInfo => {
  const utmSource = lower(getUtm(entry, "source"));
  const utmMedium = lower(getUtm(entry, "medium"));
  const referrer = lower(getReferrerCandidate(entry));
  const landing = lower(getLandingCandidate(entry));
  const userAgent = lower(entry.requestContext?.userAgent);
  const clickId = getClickId(entry);
  const combined = [utmSource, utmMedium, referrer, landing, userAgent].join(" ");

  if (clickId?.type === "ttclid" || combined.includes("tiktok")) return CHANNEL_INFO.tiktok;
  if (clickId?.type === "gclid") return CHANNEL_INFO.google_ads;
  if (
    clickId?.type === "fbclid" ||
    clickId?.type === "fbc" ||
    utmSource.includes("meta") ||
    utmSource.includes("facebook") ||
    utmSource.includes("instagram") ||
    referrer.includes("instagram.") ||
    referrer.includes("facebook.") ||
    userAgent.includes("instagram") ||
    userAgent.includes("fbav")
  ) {
    return CHANNEL_INFO.meta;
  }
  if (
    utmSource.includes("google") &&
    (utmMedium.includes("cpc") || utmMedium.includes("paid") || utmMedium.includes("display") || utmMedium.includes("search"))
  ) {
    return CHANNEL_INFO.google_ads;
  }
  if (
    utmSource.includes("naver") ||
    referrer.includes("naver.") ||
    landing.includes("napm=") ||
    referrer.includes("napm=")
  ) {
    return CHANNEL_INFO.naver;
  }
  if (utmSource.includes("kakao") || referrer.includes("kakao.")) return CHANNEL_INFO.kakao;
  if (referrer.includes("google.") || userAgent.includes("googleapp")) return CHANNEL_INFO.google_organic;
  if (isInternalReferrer(getReferrerCandidate(entry), config)) return CHANNEL_INFO.internal;
  if (isDirectValue(getReferrerCandidate(entry)) && !utmSource && !utmMedium && !clickId) return CHANNEL_INFO.direct;
  if (utmSource || referrer) return CHANNEL_INFO.referral;
  return CHANNEL_INFO.unknown;
};

const getCampaignLabel = (entry: AttributionLedgerEntry) => {
  const campaign = getUtm(entry, "campaign");
  if (campaign) return campaign;
  const source = getUtm(entry, "source");
  if (source) return source;
  const medium = getUtm(entry, "medium");
  if (medium) return medium;
  const referrer = getReferrerCandidate(entry);
  const parsed = parseUrlSafe(referrer);
  if (parsed && !isDirectValue(referrer)) return parsed.hostname.replace(/^www\./, "");
  return "(campaign 없음)";
};

const getLandingLabel = (entry: AttributionLedgerEntry) => {
  const landing = getLandingCandidate(entry);
  const parsed = parseUrlSafe(landing);
  if (!parsed) return landing || "(landing 없음)";
  const idx = parsed.searchParams.get("idx");
  const path = parsed.pathname === "/" ? "/" : parsed.pathname.replace(/\/$/, "");
  return idx ? `${path}?idx=${idx}` : path;
};

const addExample = (target: string[], value: string) => {
  if (!value || target.includes(value)) return;
  if (target.length < 3) target.push(value);
};

const toShare = (count: number, total: number) => (total > 0 ? Number(((count / total) * 100).toFixed(1)) : 0);

const mapAccumulatorRows = (items: DimensionAccumulator[], total: number): AcquisitionDimensionRow[] =>
  items
    .sort((a, b) => b.count - a.count || b.revenue - a.revenue)
    .slice(0, 8)
    .map((item) => ({
      label: item.label,
      count: item.count,
      share: toShare(item.count, total),
      revenue: Math.round(item.revenue),
      examples: item.examples,
    }));

const hasIdentity = (entry: AttributionLedgerEntry) =>
  Boolean(entry.gaSessionId || toText(entry.metadata?.clientId) || toText(entry.metadata?.userPseudoId));

const hasDebugMarker = (entry: AttributionLedgerEntry) => {
  const combined = [
    entry.landing,
    entry.referrer,
    getLandingCandidate(entry),
    getReferrerCandidate(entry),
    toSearchText(entry.metadata?.debug),
    toSearchText(entry.metadata?.is_debug),
    toSearchText(entry.metadata?.isTest),
    toSearchText(entry.metadata?.test),
    toSearchText(entry.metadata?.debugReason),
    ...getNestedMetadataSearchValues(entry),
  ]
    .join(" ")
    .toLowerCase();
  return (
    combined.includes("__seo_attribution_debug=1") ||
    combined.includes("gtm_debug=") ||
    combined.includes("tagassistant.google.com") ||
    combined.includes("test_fbclid") ||
    combined.includes("meta_recoverylab_test") ||
    combined.includes("debug=true") ||
    combined.includes("test=true")
  );
};

const hasTestContactMarker = (entry: AttributionLedgerEntry) => {
  if (
    isTruthyMarker(entry.metadata?.is_test_contact) ||
    isTruthyMarker(entry.metadata?.isTestContact) ||
    isTruthyMarker(entry.metadata?.testContact)
  ) {
    return true;
  }

  const phoneValues = [
    entry.customerKey,
    ...collectMetadataValuesByKey(entry.metadata, TEST_PHONE_FIELD_KEYS),
  ];
  if (phoneValues.some((value) => isTestPhoneValue(value))) return true;

  const nameValues = collectMetadataValuesByKey(entry.metadata, TEST_NAME_FIELD_KEYS);
  return nameValues.some((value) => isTestNameValue(value));
};

const isAibioSetupTestEntry = (entry: AttributionLedgerEntry, config: SiteConfig) => {
  if (config.key !== "aibio" || entry.touchpoint !== "form_submit") return false;
  if (entry.captureMode !== "live") return true;
  if (hasDebugMarker(entry)) return true;
  if (hasTestContactMarker(entry)) return true;

  const loggedAt = parseDate(entry.loggedAt);
  const aibioCleanCutover = new Date("2026-04-08T15:00:00.000Z");
  const hasPaidEvidence = Boolean(
    getClickId(entry) ||
      getUtm(entry, "source") ||
      getUtm(entry, "medium") ||
      getUtm(entry, "campaign") ||
      getUtm(entry, "content") ||
      getUtm(entry, "term"),
  );
  const pageText = [
    getLandingCandidate(entry),
    getReferrerCandidate(entry),
    toText(entry.metadata?.formPage),
  ].join(" ");

  return Boolean(
    loggedAt &&
      loggedAt < aibioCleanCutover &&
      !hasPaidEvidence &&
      (pageText.includes("aibio.ai/59") || pageText.includes("/59")),
  );
};

const buildSiteInsights = (site: AcquisitionSiteReport) => {
  const insights: string[] = [];
  const top = site.topChannel;
  if (top) {
    insights.push(`${site.name}의 현재 1위 유입은 ${top.label}이며, ${site.conversionName} ${top.count}건(${top.share}%)이 이 채널에서 잡혔다.`);
  }
  if (site.key === "aibio") {
    insights.push("AIBIO는 구매가 아니라 폼 제출이 메인 전환이다. fbclid/gclid/ttclid 또는 initial referrer가 없으면 광고 성과로 단정하지 않는다.");
    insights.push("AIBIO form_submit에는 결제 금액이 없으므로 confirmed 매출은 0원이 정상이다. 광고 효율은 폼 제출 수, 이후 상담/방문/결제 전환율을 별도로 붙여야 판단 가능하다.");
    const naver = site.channels.find((row) => row.key === "naver");
    if (naver) {
      insights.push(`최근 AIBIO 폼 제출 중 Naver 검색/인앱 유입 ${naver.count}건(${naver.share}%)이 확인됐다. 이 row는 fbclid 없이 m.naver.com referrer와 NAVER in-app user agent를 근거로 분류했다.`);
    }
  }
  if (site.key === "thecleancoffee" && site.confirmedConversions === 0 && site.pendingConversions > 0) {
    insights.push("더클린커피는 현재 로컬 원장 기준 payment_status가 전부 pending이라 유입 비중은 볼 수 있지만 confirmed 매출 판단은 status sync 이후가 안전하다.");
  }
  if (site.identityCoverageRate < 60 && site.totalConversions > 0) {
    insights.push(`식별자 연결률이 ${site.identityCoverageRate}%로 낮다. 유입원 해석은 가능하지만 사용자 단위 재방문/재구매 귀속은 아직 보수적으로 봐야 한다.`);
  }
  if (site.channels.some((row) => row.key === "direct" && row.share >= 30)) {
    insights.push("Direct / unknown 비중이 높다. UTM, fbclid/fbc/fbp 보존이 더 올라가야 광고 유입 누락을 줄일 수 있다.");
  }
  return insights;
};

const buildDataWarnings = (site: AcquisitionSiteReport) => {
  const warnings: string[] = [];
  if (!site.latestLoggedAt) warnings.push("해당 source의 원장 row가 아직 없다.");
  if (site.key === "thecleancoffee" && site.confirmedConversions === 0 && site.pendingConversions > 0) {
    warnings.push("confirmed 상태 동기화 전이라 매출액은 pending 중심이다.");
  }
  if (site.key === "aibio" && site.totalConversions < 20) {
    warnings.push("AIBIO 표본 수가 작아 채널 순위는 방향성으로만 봐야 한다.");
  }
  if (site.key === "aibio" && site.excludedConversions > 0) {
    warnings.push(`AIBIO 원장 raw ${site.rawConversions}건 중 디버그/초기 검증/테스트 연락처 폼 제출 ${site.excludedConversions}건은 운영 전환 분석에서 제외했다.`);
  }
  return warnings;
};

const buildSiteReport = (
  config: SiteConfig,
  entries: AttributionLedgerEntry[],
  startAt: Date,
  endAt: Date,
): AcquisitionSiteReport => {
  const rawSiteEntries = entries.filter((entry) => {
    const source = toText(entry.metadata?.source);
    if (source !== config.source) return false;
    if (entry.touchpoint !== config.primaryTouchpoint) return false;
    const loggedAt = parseDate(entry.loggedAt);
    if (!loggedAt) return false;
    return loggedAt >= startAt && loggedAt <= endAt;
  });
  const excludedEntries = rawSiteEntries.filter((entry) => isAibioSetupTestEntry(entry, config));
  const siteEntries = rawSiteEntries.filter((entry) => !isAibioSetupTestEntry(entry, config));

  const channelMap = new Map<ChannelKey, ChannelAccumulator>();
  const campaignMap = new Map<string, DimensionAccumulator>();
  const landingMap = new Map<string, DimensionAccumulator>();

  let confirmedConversions = 0;
  let pendingConversions = 0;
  let canceledConversions = 0;
  let confirmedRevenue = 0;
  let pendingRevenue = 0;
  let totalObservedRevenue = 0;
  let identityCount = 0;

  const recentSamples: RecentSample[] = [];

  for (const entry of siteEntries) {
    const channel = resolveChannel(entry, config);
    const amount = resolveLedgerRevenueValue(entry);
    const campaign = getCampaignLabel(entry);
    const landing = getLandingLabel(entry);
    const clickId = getClickId(entry);
    const isConfirmed = entry.paymentStatus === "confirmed" || entry.touchpoint === "form_submit";
    const isPending = entry.paymentStatus === "pending";
    const isCanceled = entry.paymentStatus === "canceled";
    const revenueForRanking = isConfirmed ? amount : 0;

    if (isConfirmed && entry.touchpoint === "payment_success") {
      confirmedConversions += 1;
      confirmedRevenue += amount;
    } else if (entry.touchpoint === "form_submit") {
      confirmedConversions += 1;
    }
    if (isPending) {
      pendingConversions += 1;
      pendingRevenue += amount;
    }
    if (isCanceled) canceledConversions += 1;
    totalObservedRevenue += amount;
    if (hasIdentity(entry)) identityCount += 1;

    const currentChannel =
      channelMap.get(channel.key) ??
      {
        channel,
        count: 0,
        confirmedCount: 0,
        pendingCount: 0,
        canceledCount: 0,
        revenue: 0,
        pendingRevenue: 0,
        examples: [],
      };
    currentChannel.count += 1;
    if (isConfirmed) currentChannel.confirmedCount += 1;
    if (isPending) currentChannel.pendingCount += 1;
    if (isCanceled) currentChannel.canceledCount += 1;
    currentChannel.revenue += revenueForRanking;
    if (isPending) currentChannel.pendingRevenue += amount;
    addExample(currentChannel.examples, campaign);
    channelMap.set(channel.key, currentChannel);

    const currentCampaign = campaignMap.get(campaign) ?? { label: campaign, count: 0, revenue: 0, examples: [] };
    currentCampaign.count += 1;
    currentCampaign.revenue += revenueForRanking;
    addExample(currentCampaign.examples, channel.label);
    campaignMap.set(campaign, currentCampaign);

    const currentLanding = landingMap.get(landing) ?? { label: landing, count: 0, revenue: 0, examples: [] };
    currentLanding.count += 1;
    currentLanding.revenue += revenueForRanking;
    addExample(currentLanding.examples, channel.label);
    landingMap.set(landing, currentLanding);

    if (recentSamples.length < 8) {
      recentSamples.push({
        loggedAt: entry.loggedAt,
        touchpoint: entry.touchpoint,
        paymentStatus: entry.paymentStatus,
        channel: channel.label,
        landing: getLandingCandidate(entry),
        referrer: getReferrerCandidate(entry),
        utmSource: getUtm(entry, "source"),
        utmCampaign: getUtm(entry, "campaign"),
        clickIdType: clickId?.type ?? null,
      });
    }
  }

  const channels = [...channelMap.values()]
    .sort((a, b) => b.count - a.count || b.revenue - a.revenue)
    .map((item) => ({
      key: item.channel.key,
      label: item.channel.label,
      description: item.channel.description,
      count: item.count,
      share: toShare(item.count, siteEntries.length),
      confirmedCount: item.confirmedCount,
      pendingCount: item.pendingCount,
      canceledCount: item.canceledCount,
      revenue: Math.round(item.revenue),
      pendingRevenue: Math.round(item.pendingRevenue),
      examples: item.examples,
    }));

  const report: AcquisitionSiteReport = {
    key: config.key,
    source: config.source,
    name: config.name,
    domain: config.domain,
    conversionName: config.conversionName,
    totalConversions: siteEntries.length,
    operationalConversions: siteEntries.length,
    rawConversions: rawSiteEntries.length,
    liveConversions: siteEntries.filter((entry) => entry.captureMode === "live").length,
    confirmedConversions,
    pendingConversions,
    canceledConversions,
    confirmedRevenue: Math.round(confirmedRevenue),
    pendingRevenue: Math.round(pendingRevenue),
    totalObservedRevenue: Math.round(totalObservedRevenue),
    excludedConversions: excludedEntries.length,
    latestLoggedAt: siteEntries[0]?.loggedAt ?? null,
    identityCoverageRate: siteEntries.length > 0 ? Number(((identityCount / siteEntries.length) * 100).toFixed(1)) : 0,
    topChannel: channels[0] ?? null,
    channels,
    campaigns: mapAccumulatorRows([...campaignMap.values()], siteEntries.length),
    landings: mapAccumulatorRows([...landingMap.values()], siteEntries.length),
    recentSamples,
    insights: [],
    dataWarnings: [],
  };

  report.insights = buildSiteInsights(report);
  report.dataWarnings = buildDataWarnings(report);

  return report;
};

export const buildAcquisitionSummaryReport = (
  entries: AttributionLedgerEntry[],
  options?: { rangeDays?: number; now?: Date },
): AcquisitionSummaryReport => {
  const rangeDays = Math.max(1, Math.min(options?.rangeDays ?? 30, 365));
  const endAt = options?.now ?? new Date();
  const startAt = new Date(endAt.getTime() - rangeDays * 24 * 60 * 60 * 1000);
  const sites = SITE_CONFIG.map((config) => buildSiteReport(config, entries, startAt, endAt));

  return {
    generatedAt: new Date().toISOString(),
    range: {
      rangeDays,
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
    },
    sites,
    notes: [
      "이 화면은 우리 자체 Attribution 원장 기준이다. GA4/Meta Ads Manager와 숫자가 다르면 원장 latestLoggedAt, status sync, UTM/click-id 보존률을 먼저 확인한다.",
      "바이오컴·더클린커피는 payment_success, AIBIO는 form_submit을 전환으로 본다.",
      "결제형 사이트의 메인 매출 판단은 confirmed 기준이지만, 유입 경향은 pending도 보조로 확인한다.",
      "카드의 운영 전환은 테스트/디버그 row를 제외한 숫자이고, 원장 raw와 제외 건수는 별도로 표시한다.",
    ],
  };
};

export type AcquisitionAnalysisSiteKey = SiteConfig["key"];
export type AcquisitionChannelGroup =
  | "Meta Ads"
  | "YouTube"
  | "Naver"
  | "TikTok"
  | "Direct"
  | "Organic"
  | "Other";

export type AcquisitionAnalysisDateRange = {
  startDate: string;
  endDate: string;
};

export type AcquisitionAnalysisDateRangeResult =
  | ({ ok: true } & AcquisitionAnalysisDateRange)
  | { ok: false; error: string; message: string };

export type ChannelAcquisitionRow = {
  source: string;
  medium: string;
  channelGroup: AcquisitionChannelGroup;
  purchases: number;
  revenue: number;
  sessions: number;
  conversionRate: number;
  avgOrderValue: number;
  estimatedLtvMultiplier: number;
  estimatedLtvRevenue: number;
  cohortRepeatRate: null;
};

export type ChannelGroupAcquisitionRow = {
  group: AcquisitionChannelGroup;
  totalPurchases: number;
  totalRevenue: number;
  totalSessions: number;
  overallConversionRate: number;
};

export type ChannelAcquisitionAnalysisResponse = {
  ok: true;
  channels: ChannelAcquisitionRow[];
  channelGroups: ChannelGroupAcquisitionRow[];
};

type LedgerSourceMediumStats = {
  source: string;
  medium: string;
  purchases: number;
  revenue: number;
  campaignHints: Set<string>;
};

type SourceMediumAccumulator = {
  source: string;
  medium: string;
  sessions: number;
  purchases: number;
  revenue: number;
  ltvHints: Set<string>;
};

const ACQUISITION_CHANNEL_GROUPS: AcquisitionChannelGroup[] = [
  "Meta Ads",
  "YouTube",
  "Naver",
  "TikTok",
  "Direct",
  "Organic",
  "Other",
];

const ACQUISITION_DATE_PRESETS = [
  "today",
  "yesterday",
  "last_7d",
  "last_14d",
  "last_30d",
  "last_90d",
] as const;

const ACQUISITION_KST_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const SUPPLEMENT_FIRST_PATTERNS = [
  "supplement",
  "supplements",
  "nutrition",
  "nutrient",
  "vitamin",
  "probiotic",
  "영양제",
  "뉴트리션",
] as const;

const TEST_KIT_FIRST_PATTERNS = [
  "test-kit",
  "test_kit",
  "test kit",
  "kit",
  "dna",
  "genome",
  "검사",
  "키트",
] as const;

const getAcquisitionToday = () => ACQUISITION_KST_DATE_FORMATTER.format(new Date());

const roundMetric = (value: number) => Number(value.toFixed(2));

const sanitizeMetric = (value: number) => (Number.isFinite(value) && value > 0 ? value : 0);

const normalizeKeyPart = (value: string, fallback: string) => {
  const normalized = value.trim();
  return normalized || fallback;
};

const sourceMediumKey = (source: string, medium: string) =>
  `${normalizeKeyPart(source, "(none)").toLowerCase()}\u0000${normalizeKeyPart(medium, "(none)").toLowerCase()}`;

const isSupportedDatePreset = (value: string): value is typeof ACQUISITION_DATE_PRESETS[number] =>
  ACQUISITION_DATE_PRESETS.includes(value as typeof ACQUISITION_DATE_PRESETS[number]);

const validateIsoDate = (value: string, label: string): string => {
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    throw new Error(`${label} must be YYYY-MM-DD`);
  }
  parseIsoDate(trimmed);
  return trimmed;
};

const resolvePresetRange = (
  preset: typeof ACQUISITION_DATE_PRESETS[number],
  today: string = getAcquisitionToday(),
): AcquisitionAnalysisDateRange => {
  const lastCompletedDate = shiftIsoDateByDays(today, -1);

  switch (preset) {
    case "today":
      return { startDate: today, endDate: today };
    case "yesterday":
      return { startDate: lastCompletedDate, endDate: lastCompletedDate };
    case "last_7d":
      return { startDate: shiftIsoDateByDays(lastCompletedDate, -6), endDate: lastCompletedDate };
    case "last_14d":
      return { startDate: shiftIsoDateByDays(lastCompletedDate, -13), endDate: lastCompletedDate };
    case "last_30d":
      return { startDate: shiftIsoDateByDays(lastCompletedDate, -29), endDate: lastCompletedDate };
    case "last_90d":
      return { startDate: shiftIsoDateByDays(lastCompletedDate, -89), endDate: lastCompletedDate };
  }
};

export const resolveAcquisitionAnalysisDateRange = (params: {
  dateRange?: string;
  startDate?: string;
  endDate?: string;
}): AcquisitionAnalysisDateRangeResult => {
  try {
    const startDateParam = params.startDate?.trim();
    const endDateParam = params.endDate?.trim();
    if (startDateParam || endDateParam) {
      if (!startDateParam || !endDateParam) {
        return {
          ok: false,
          error: "validation_error",
          message: "startDate and endDate must be provided together",
        };
      }

      const startDate = validateIsoDate(startDateParam, "startDate");
      const endDate = validateIsoDate(endDateParam, "endDate");
      if (startDate > endDate) {
        return {
          ok: false,
          error: "validation_error",
          message: "startDate must be before or equal to endDate",
        };
      }

      return { ok: true, startDate, endDate };
    }

    const preset = params.dateRange?.trim() || "last_30d";
    if (!isSupportedDatePreset(preset)) {
      return {
        ok: false,
        error: "validation_error",
        message: `date_range must be one of: ${ACQUISITION_DATE_PRESETS.join(", ")}`,
      };
    }

    return { ok: true, ...resolvePresetRange(preset) };
  } catch (error) {
    return {
      ok: false,
      error: "validation_error",
      message: error instanceof Error ? error.message : "Invalid date range",
    };
  }
};

export const isAcquisitionAnalysisSiteKey = (
  value: string,
): value is AcquisitionAnalysisSiteKey =>
  SITE_CONFIG.some((config) => config.key === value);

const resolveAcquisitionSiteConfig = (site: string): SiteConfig => {
  const normalized = site.trim().toLowerCase();
  const config = SITE_CONFIG.find((item) => item.key === normalized);
  if (!config) {
    throw new Error(`unsupported_site:${site}`);
  }
  return config;
};

export const resolveAcquisitionChannelGroup = (
  source: string,
  medium: string,
): AcquisitionChannelGroup => {
  const normalizedSource = source.trim().toLowerCase();
  const normalizedMedium = medium.trim().toLowerCase();

  if (
    normalizedSource.includes("meta") ||
    normalizedSource.includes("facebook") ||
    normalizedSource.includes("fb") ||
    normalizedSource.includes("instagram") ||
    normalizedSource.includes("ig")
  ) {
    return "Meta Ads";
  }
  if (normalizedSource.includes("youtube") || normalizedSource.includes("yt")) return "YouTube";
  if (normalizedSource.includes("naver")) return "Naver";
  if (normalizedSource.includes("tiktok")) return "TikTok";
  if (
    normalizedSource === "(direct)" ||
    normalizedSource === "(none)" ||
    normalizedSource === "direct" ||
    normalizedSource === "none"
  ) {
    return "Direct";
  }
  if (normalizedMedium === "organic") return "Organic";
  return "Other";
};

export const estimateAcquisitionLtvMultiplier = (hints: string[]): number => {
  const text = hints.join(" ").toLowerCase();
  if (SUPPLEMENT_FIRST_PATTERNS.some((pattern) => text.includes(pattern))) return 1.5;
  if (TEST_KIT_FIRST_PATTERNS.some((pattern) => text.includes(pattern))) return 1.2;
  return 1.3;
};

const normalizeLedgerDate = (value: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
};

const getLedgerAnalysisDate = (entry: AttributionLedgerEntry) =>
  normalizeLedgerDate(entry.approvedAt) ?? normalizeLedgerDate(entry.loggedAt);

const isDateInRange = (date: string | null, range: AcquisitionAnalysisDateRange) =>
  Boolean(date && date >= range.startDate && date <= range.endDate);

const extractHost = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return "";

  try {
    return new URL(trimmed).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    const match = trimmed.match(/(?:https?:\/\/)?((?:[a-z0-9-]+\.)+[a-z]{2,})/i);
    return match?.[1]?.toLowerCase().replace(/^www\./, "") ?? "";
  }
};

const hostMatchesSite = (value: string, config: SiteConfig) => {
  const host = extractHost(value);
  return Boolean(host && (host === config.domain || host.endsWith(`.${config.domain}`)));
};

const entryMatchesAcquisitionSite = (entry: AttributionLedgerEntry, config: SiteConfig) => {
  const source = toText(entry.metadata?.source).toLowerCase();
  if (source === config.source || source === config.key || source.startsWith(`${config.key}_`)) {
    return true;
  }

  const store = toText(entry.metadata?.store).toLowerCase();
  if (store === config.key || store.startsWith(config.key)) return true;

  return [
    entry.landing,
    entry.referrer,
    entry.requestContext?.origin ?? "",
    entry.requestContext?.requestReferer ?? "",
    getLandingCandidate(entry),
    getReferrerCandidate(entry),
  ].some((value) => hostMatchesSite(value, config));
};

const getLedgerSourceMedium = (
  entry: AttributionLedgerEntry,
  config: SiteConfig,
): { source: string; medium: string } => {
  const utmSource = getUtm(entry, "source");
  const utmMedium = getUtm(entry, "medium");
  if (utmSource || utmMedium) {
    return {
      source: normalizeKeyPart(utmSource, "(none)"),
      medium: normalizeKeyPart(utmMedium, "(none)"),
    };
  }

  const clickId = getClickId(entry);
  if (clickId?.type === "ttclid") return { source: "tiktok", medium: "paid" };
  if (clickId?.type === "gclid") return { source: "google", medium: "paid" };
  if (clickId?.type === "fbclid" || clickId?.type === "fbc" || clickId?.type === "fbp") {
    return { source: "facebook", medium: "paid" };
  }

  const referrer = getReferrerCandidate(entry);
  if (!referrer || isDirectValue(referrer) || isInternalReferrer(referrer, config)) {
    return { source: "(direct)", medium: "(none)" };
  }

  const host = extractHost(referrer);
  if (host) return { source: host, medium: "referral" };
  return { source: "(direct)", medium: "(none)" };
};

const getLedgerLtvHints = (entry: AttributionLedgerEntry, source: string, medium: string) => [
  source,
  medium,
  getUtm(entry, "campaign"),
  getUtm(entry, "content"),
  getUtm(entry, "term"),
  getMetadataString(entry, [
    "campaign",
    "campaignName",
    "campaign_name",
    "utmCampaign",
    "utm_campaign",
    "productName",
    "product_name",
    "itemName",
    "item_name",
  ]),
].filter((value) => value.trim());

const isLedgerPurchaseLike = (entry: AttributionLedgerEntry) =>
  entry.paymentStatus === "confirmed" || entry.paymentStatus === null;

const buildLedgerSourceMediumStats = (
  entries: AttributionLedgerEntry[],
  siteConfig: SiteConfig,
  range: AcquisitionAnalysisDateRange,
): Map<string, LedgerSourceMediumStats> => {
  const stats = new Map<string, LedgerSourceMediumStats>();

  for (const entry of entries) {
    if (entry.touchpoint !== "payment_success") continue;
    if (entry.captureMode === "smoke" || entry.paymentStatus === "canceled") continue;
    if (!entryMatchesAcquisitionSite(entry, siteConfig)) continue;
    if (!isDateInRange(getLedgerAnalysisDate(entry), range)) continue;

    const { source, medium } = getLedgerSourceMedium(entry, siteConfig);
    const key = sourceMediumKey(source, medium);
    const current =
      stats.get(key) ??
      {
        source,
        medium,
        purchases: 0,
        revenue: 0,
        campaignHints: new Set<string>(),
      };

    for (const hint of getLedgerLtvHints(entry, source, medium)) {
      current.campaignHints.add(hint);
    }

    if (isLedgerPurchaseLike(entry)) {
      current.purchases += 1;
      current.revenue += resolveLedgerRevenueValue(entry);
    }

    stats.set(key, current);
  }

  return stats;
};

const addGa4RowToAccumulator = (
  map: Map<string, SourceMediumAccumulator>,
  row: GA4SourceConversionRow,
) => {
  const source = normalizeKeyPart(row.sessionSource, "(none)");
  const medium = normalizeKeyPart(row.sessionMedium, "(none)");
  const key = sourceMediumKey(source, medium);
  const current =
    map.get(key) ??
    {
      source,
      medium,
      sessions: 0,
      purchases: 0,
      revenue: 0,
      ltvHints: new Set<string>(),
    };

  current.sessions += sanitizeMetric(row.sessions);
  current.purchases += sanitizeMetric(row.ecommercePurchases);
  current.revenue += sanitizeMetric(row.grossPurchaseRevenue);
  current.ltvHints.add(source);
  current.ltvHints.add(medium);
  map.set(key, current);
};

const mergeLedgerStatsIntoAccumulator = (
  map: Map<string, SourceMediumAccumulator>,
  stats: Map<string, LedgerSourceMediumStats>,
) => {
  for (const [key, ledger] of stats.entries()) {
    const current =
      map.get(key) ??
      {
        source: ledger.source,
        medium: ledger.medium,
        sessions: 0,
        purchases: 0,
        revenue: 0,
        ltvHints: new Set<string>(),
      };

    if (current.purchases <= 0 && ledger.purchases > 0) {
      current.purchases = ledger.purchases;
    }
    if (current.revenue <= 0 && ledger.revenue > 0) {
      current.revenue = ledger.revenue;
    }
    current.ltvHints.add(ledger.source);
    current.ltvHints.add(ledger.medium);
    for (const hint of ledger.campaignHints) current.ltvHints.add(hint);
    map.set(key, current);
  }
};

const buildChannelRows = (
  ga4Result: GA4SourceConversionResult,
  ledgerStats: Map<string, LedgerSourceMediumStats>,
): ChannelAcquisitionRow[] => {
  const sourceMediumMap = new Map<string, SourceMediumAccumulator>();
  for (const row of ga4Result.rows) addGa4RowToAccumulator(sourceMediumMap, row);
  mergeLedgerStatsIntoAccumulator(sourceMediumMap, ledgerStats);

  return [...sourceMediumMap.values()]
    .filter((item) => item.sessions > 0 || item.purchases > 0 || item.revenue > 0)
    .map((item) => {
      const channelGroup = resolveAcquisitionChannelGroup(item.source, item.medium);
      const estimatedLtvMultiplier = estimateAcquisitionLtvMultiplier([...item.ltvHints]);
      const purchases = roundMetric(item.purchases);
      const revenue = roundMetric(item.revenue);
      const sessions = roundMetric(item.sessions);

      return {
        source: item.source,
        medium: item.medium,
        channelGroup,
        purchases,
        revenue,
        sessions,
        conversionRate: sessions > 0 ? roundMetric((purchases / sessions) * 100) : 0,
        avgOrderValue: purchases > 0 ? roundMetric(revenue / purchases) : 0,
        estimatedLtvMultiplier,
        estimatedLtvRevenue: roundMetric(revenue * estimatedLtvMultiplier),
        cohortRepeatRate: null,
      };
    })
    .sort((a, b) => (
      b.revenue - a.revenue ||
      b.purchases - a.purchases ||
      b.sessions - a.sessions ||
      a.source.localeCompare(b.source)
    ));
};

const buildChannelGroupRows = (channels: ChannelAcquisitionRow[]): ChannelGroupAcquisitionRow[] => {
  const groupMap = new Map<AcquisitionChannelGroup, {
    totalPurchases: number;
    totalRevenue: number;
    totalSessions: number;
  }>();

  for (const group of ACQUISITION_CHANNEL_GROUPS) {
    groupMap.set(group, { totalPurchases: 0, totalRevenue: 0, totalSessions: 0 });
  }

  for (const channel of channels) {
    const current = groupMap.get(channel.channelGroup);
    if (!current) continue;
    current.totalPurchases += channel.purchases;
    current.totalRevenue += channel.revenue;
    current.totalSessions += channel.sessions;
  }

  return ACQUISITION_CHANNEL_GROUPS.map((group) => {
    const current = groupMap.get(group) ?? { totalPurchases: 0, totalRevenue: 0, totalSessions: 0 };
    return {
      group,
      totalPurchases: roundMetric(current.totalPurchases),
      totalRevenue: roundMetric(current.totalRevenue),
      totalSessions: roundMetric(current.totalSessions),
      overallConversionRate: current.totalSessions > 0
        ? roundMetric((current.totalPurchases / current.totalSessions) * 100)
        : 0,
    };
  });
};

export const buildChannelAcquisitionAnalysis = (params: {
  site: AcquisitionAnalysisSiteKey;
  range: AcquisitionAnalysisDateRange;
  ga4Result: GA4SourceConversionResult;
  ledgerEntries: AttributionLedgerEntry[];
}): ChannelAcquisitionAnalysisResponse => {
  const siteConfig = resolveAcquisitionSiteConfig(params.site);
  const ledgerStats = buildLedgerSourceMediumStats(
    params.ledgerEntries,
    siteConfig,
    params.range,
  );
  const channels = buildChannelRows(params.ga4Result, ledgerStats);

  return {
    ok: true,
    channels,
    channelGroups: buildChannelGroupRows(channels),
  };
};

export const fetchChannelAcquisitionAnalysis = async (params: {
  site: string;
  range: AcquisitionAnalysisDateRange;
  limit?: number;
}): Promise<ChannelAcquisitionAnalysisResponse> => {
  const siteConfig = resolveAcquisitionSiteConfig(params.site);
  const limit = Math.max(1, Math.min(500, params.limit ?? 200));
  const [ga4Result, ledgerEntries] = await Promise.all([
    queryGA4SourceConversion({
      startDate: params.range.startDate,
      endDate: params.range.endDate,
      limit,
    }),
    readLedgerEntries(),
  ]);

  return buildChannelAcquisitionAnalysis({
    site: siteConfig.key,
    range: params.range,
    ga4Result,
    ledgerEntries,
  });
};
