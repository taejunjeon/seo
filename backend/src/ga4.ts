import { BetaAnalyticsDataClient } from "@google-analytics/data";

import { env } from "./env";

const parseServiceAccountKey = (rawKey: string) => {
  try {
    return JSON.parse(rawKey);
  } catch {
    throw new Error("GA4_SERVICE_ACCOUNT_KEY is not valid JSON.");
  }
};

const createGA4Client = (): BetaAnalyticsDataClient => {
  if (env.GA4_SERVICE_ACCOUNT_KEY) {
    const credentials = parseServiceAccountKey(env.GA4_SERVICE_ACCOUNT_KEY);
    return new BetaAnalyticsDataClient({ credentials });
  }
  // Fall back to Application Default Credentials
  return new BetaAnalyticsDataClient();
};

export type GA4EngagementRow = {
  pagePath: string;
  sessions: number;
  users: number;
  newUsers: number;
  avgEngagementTime: number;
  bounceRate: number;
  scrollDepth: number;
  conversions: number;
};

export type GA4EngagementResult = {
  startDate: string;
  endDate: string;
  rows: GA4EngagementRow[];
};

export const queryGA4Engagement = async (
  startDate: string = "30daysAgo",
  endDate: string = "yesterday",
  limit: number = 50,
): Promise<GA4EngagementResult> => {
  if (!env.GA4_PROPERTY_ID) {
    throw new Error("GA4_PROPERTY_ID is not configured");
  }

  const client = createGA4Client();

  const [response] = await client.runReport({
    property: `properties/${env.GA4_PROPERTY_ID}`,
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: "pagePath" }],
    metrics: [
      { name: "sessions" },
      { name: "totalUsers" },
      { name: "newUsers" },
      { name: "averageSessionDuration" },
      { name: "bounceRate" },
      { name: "conversions" },
    ],
    limit,
    orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
  });

  // GA4 "scroll" event: Enhanced Measurement enabled일 때 페이지의 약 90%에 도달하면 1회 발생.
  // 여기서는 '스크롤 완료율(세션 대비)'로 근사하여 scrollDepth로 노출합니다.
  let scrollEventCountByPath = new Map<string, number>();
  try {
    const [scrollRes] = await client.runReport({
      property: `properties/${env.GA4_PROPERTY_ID}`,
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: "pagePath" }],
      metrics: [{ name: "eventCount" }],
      dimensionFilter: {
        filter: {
          fieldName: "eventName",
          stringFilter: { matchType: "EXACT", value: "scroll" },
        },
      },
      limit,
      orderBys: [{ metric: { metricName: "eventCount" }, desc: true }],
    });

    scrollEventCountByPath = new Map<string, number>(
      (scrollRes.rows ?? []).map((row) => {
        const dims = row.dimensionValues ?? [];
        const mets = row.metricValues ?? [];
        const pagePath = dims[0]?.value ?? "";
        const eventCount = parseInt(mets[0]?.value ?? "0", 10);
        return [pagePath, Number.isFinite(eventCount) ? eventCount : 0] as const;
      }),
    );
  } catch {
    // scroll 이벤트가 수집되지 않거나(Enhanced Measurement off),
    // 권한/쿼리 제한이 있는 경우에도 기본 리포트는 계속 반환.
  }

  const rows: GA4EngagementRow[] = (response.rows ?? []).map((row) => {
    const dims = row.dimensionValues ?? [];
    const mets = row.metricValues ?? [];
    const pagePath = dims[0]?.value ?? "";
    const sessions = parseInt(mets[0]?.value ?? "0", 10);
    const scrollEvents = scrollEventCountByPath.get(pagePath) ?? 0;
    const scrollDepth =
      sessions > 0 ? Math.min(100, +((scrollEvents / sessions) * 100).toFixed(1)) : 0;
    return {
      pagePath,
      sessions,
      users: parseInt(mets[1]?.value ?? "0", 10),
      newUsers: parseInt(mets[2]?.value ?? "0", 10),
      avgEngagementTime: parseFloat(mets[3]?.value ?? "0"),
      bounceRate: parseFloat(mets[4]?.value ?? "0") * 100,
      scrollDepth,
      conversions: parseInt(mets[5]?.value ?? "0", 10),
    };
  });

  return { startDate, endDate, rows };
};

export type GA4FunnelStep = {
  label: string;
  value: number;
  percent: number;
};

export type GA4AiTrafficSource = {
  source: string;
  sessions: number;
};

export type GA4AiTrafficResult = {
  startDate: string;
  endDate: string;
  aiSessions: number;
  totalSessions: number;
  sources: GA4AiTrafficSource[];
};

export const queryGA4Funnel = async (
  startDate: string = "30daysAgo",
  endDate: string = "yesterday",
): Promise<GA4FunnelStep[]> => {
  if (!env.GA4_PROPERTY_ID) {
    throw new Error("GA4_PROPERTY_ID is not configured");
  }

  const client = createGA4Client();

  // Step 1: Total organic sessions
  const [organicRes] = await client.runReport({
    property: `properties/${env.GA4_PROPERTY_ID}`,
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: "sessionDefaultChannelGroup" }],
    metrics: [{ name: "sessions" }],
    dimensionFilter: {
      filter: {
        fieldName: "sessionDefaultChannelGroup",
        stringFilter: { matchType: "EXACT", value: "Organic Search" },
      },
    },
  });

  const organicSessions = parseInt(
    organicRes.rows?.[0]?.metricValues?.[0]?.value ?? "0",
    10,
  );

  // Step 2: Page views from organic
  const [pageViewRes] = await client.runReport({
    property: `properties/${env.GA4_PROPERTY_ID}`,
    dateRanges: [{ startDate, endDate }],
    metrics: [{ name: "screenPageViews" }],
    dimensionFilter: {
      filter: {
        fieldName: "sessionDefaultChannelGroup",
        stringFilter: { matchType: "EXACT", value: "Organic Search" },
      },
    },
  });

  const pageViews = parseInt(
    pageViewRes.rows?.[0]?.metricValues?.[0]?.value ?? "0",
    10,
  );

  // Step 3: Engaged sessions from organic (GA4 정의: 10초 이상/2페이지 이상/전환 포함)
  let engagedSessions = 0;
  try {
    const [engagedRes] = await client.runReport({
      property: `properties/${env.GA4_PROPERTY_ID}`,
      dateRanges: [{ startDate, endDate }],
      metrics: [{ name: "engagedSessions" }],
      dimensionFilter: {
        filter: {
          fieldName: "sessionDefaultChannelGroup",
          stringFilter: { matchType: "EXACT", value: "Organic Search" },
        },
      },
    });

    engagedSessions = parseInt(engagedRes.rows?.[0]?.metricValues?.[0]?.value ?? "0", 10);
  } catch {
    engagedSessions = Math.round(organicSessions * 0.35);
  }

  // Step 3: Conversions from organic
  const [convRes] = await client.runReport({
    property: `properties/${env.GA4_PROPERTY_ID}`,
    dateRanges: [{ startDate, endDate }],
    metrics: [{ name: "conversions" }],
    dimensionFilter: {
      filter: {
        fieldName: "sessionDefaultChannelGroup",
        stringFilter: { matchType: "EXACT", value: "Organic Search" },
      },
    },
  });

  const conversions = parseInt(
    convRes.rows?.[0]?.metricValues?.[0]?.value ?? "0",
    10,
  );

  // Build funnel (some steps are estimated proportions)
  const steps: GA4FunnelStep[] = [
    { label: "유기 검색 유입", value: organicSessions, percent: 100 },
    { label: "페이지 조회", value: pageViews, percent: organicSessions > 0 ? Math.round((pageViews / organicSessions) * 100) : 0 },
    { label: "참여 세션", value: engagedSessions, percent: organicSessions > 0 ? Math.round((engagedSessions / organicSessions) * 100) : 0 },
    { label: "전환 완료", value: conversions, percent: organicSessions > 0 ? +((conversions / organicSessions) * 100).toFixed(1) : 0 },
  ];

  return steps;
};

/* ── AI 추천(referral) 유입 트래픽 ──
   GA4 Data API에서 "sessionSource" 기준으로 AI 서비스 도메인을 필터링하여 집계합니다.
   NOTE: GA4에 "AI 유입"이라는 공식 차원이 있는 것은 아니므로, referrer/source 기반 휴리스틱입니다.
*/
export const queryGA4AiTraffic = async (
  startDate: string = "30daysAgo",
  endDate: string = "yesterday",
): Promise<GA4AiTrafficResult> => {
  if (!env.GA4_PROPERTY_ID) {
    throw new Error("GA4_PROPERTY_ID is not configured");
  }

  const client = createGA4Client();

  const [totalRes] = await client.runReport({
    property: `properties/${env.GA4_PROPERTY_ID}`,
    dateRanges: [{ startDate, endDate }],
    metrics: [{ name: "sessions" }],
  });

  const totalSessions = parseInt(
    totalRes.rows?.[0]?.metricValues?.[0]?.value ?? "0",
    10,
  );

  const AI_SOURCE_CONTAINS = [
    "chatgpt",
    "openai",
    "perplexity",
    "claude",
    "anthropic",
    "gemini",
    "bard",
    "copilot",
  ];

  const [aiRes] = await client.runReport({
    property: `properties/${env.GA4_PROPERTY_ID}`,
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: "sessionSource" }],
    metrics: [{ name: "sessions" }],
    dimensionFilter: {
      orGroup: {
        expressions: AI_SOURCE_CONTAINS.map((token) => ({
          filter: {
            fieldName: "sessionSource",
            stringFilter: { matchType: "CONTAINS", value: token },
          },
        })),
      },
    },
    limit: 200,
    orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
  });

  const sources: GA4AiTrafficSource[] = (aiRes.rows ?? []).map((row) => {
    const dims = row.dimensionValues ?? [];
    const mets = row.metricValues ?? [];
    return {
      source: dims[0]?.value ?? "",
      sessions: parseInt(mets[0]?.value ?? "0", 10),
    };
  }).filter((r) => r.source);

  const aiSessions = sources.reduce((s, r) => s + (Number.isFinite(r.sessions) ? r.sessions : 0), 0);

  return {
    startDate,
    endDate,
    aiSessions,
    totalSessions: Number.isFinite(totalSessions) ? totalSessions : 0,
    sources,
  };
};

/* ═══════════════════════════════════════
   GA4: AI referral 트래픽(상세) + 디버그용 Top Sources
   ═══════════════════════════════════════ */

export type GA4AiTrafficTotals = {
  sessions: number;
  activeUsers: number;
  totalUsers: number;
  /** 신규 사용자 수 */
  newUsers: number;
  /** 참여 세션 수 (10초+ 또는 키이벤트 또는 2페이지+) */
  engagedSessions: number;
  /** 이탈률 fraction (0-1). 프론트에서 x100하여 % 표시할 것 */
  bounceRate: number;
  /** 참여율 fraction (0-1). 1 - bounceRate와 근사 */
  engagementRate: number;
  /** 평균 세션 시간 (초 단위). 프론트에서 분:초로 변환 */
  averageSessionDuration: number;
  /** 총 페이지뷰 */
  screenPageViews: number;
  ecommercePurchases: number;
  grossPurchaseRevenue: number;
};

export type GA4AiTrafficBySourceRow = {
  sessionSource: string;
  sessionSourceMedium: string;
  category: TrafficCategory;
  sessions: number;
  activeUsers: number;
  totalUsers: number;
  /** 신규 사용자 수 */
  newUsers: number;
  /** 참여 세션 수 (10초+ 또는 키이벤트 또는 2페이지+) */
  engagedSessions: number;
  /** 이탈률 fraction (0-1). 프론트에서 x100하여 % 표시할 것 */
  bounceRate: number;
  /** 참여율 fraction (0-1). 1 - bounceRate와 근사 */
  engagementRate: number;
  /** 평균 세션 시간 (초 단위). 프론트에서 분:초로 변환 */
  averageSessionDuration: number;
  /** 총 페이지뷰 */
  screenPageViews: number;
  ecommercePurchases: number;
  grossPurchaseRevenue: number;
};

export type GA4AiTrafficByLandingPageRow = {
  landingPagePlusQueryString: string;
  sessions: number;
  activeUsers: number;
  totalUsers: number;
  /** 신규 사용자 수 */
  newUsers: number;
  /** 참여 세션 수 (10초+ 또는 키이벤트 또는 2페이지+) */
  engagedSessions: number;
  /** 이탈률 fraction (0-1). 프론트에서 x100하여 % 표시할 것 */
  bounceRate: number;
  /** 참여율 fraction (0-1). 1 - bounceRate와 근사 */
  engagementRate: number;
  /** 평균 세션 시간 (초 단위). 프론트에서 분:초로 변환 */
  averageSessionDuration: number;
  /** 총 페이지뷰 */
  screenPageViews: number;
  ecommercePurchases: number;
  grossPurchaseRevenue: number;
};

export type GA4AiTrafficIdentification = {
  method: "referrer" | "utm" | "both";
};

export type GA4AiTrafficReport = {
  range: { startDate: string; endDate: string };
  definition: string;
  identification: GA4AiTrafficIdentification;
  totals: GA4AiTrafficTotals;
  bySource: GA4AiTrafficBySourceRow[];
  byLandingPage: GA4AiTrafficByLandingPageRow[];
  debug: { matchedPatterns: string[]; notes: string[] };
};

export type GA4TopSourceRow = {
  sessionSource: string;
  category: TrafficCategory;
  sessions: number;
};

export type GA4TopSourcesResult = {
  range: { startDate: string; endDate: string };
  rows: GA4TopSourceRow[];
};

export type TrafficCategory = "ai_referral" | "search_legacy" | "organic";

// NOTE: GA4 stringFilter.matchType=FULL_REGEXP requires a full regex match.
// We keep the regex "domain-anchored" and also allow subdomains:
//   (^|.*\\.)example\\.com$  -> matches example.com, www.example.com, a.b.example.com
const AI_REFERRAL_SOURCE_PATTERNS_ALLOWLIST = [
  "(^|.*\\.)chatgpt\\.com$",
  "(^|.*\\.)chat\\.openai\\.com$",
  "(^|.*\\.)perplexity\\.ai$",
  "(^|.*\\.)claude\\.ai$",
  "(^|.*\\.)gemini\\.google\\.com$",
  "(^|.*\\.)bard\\.google\\.com$",
  "(^|.*\\.)copilot\\.microsoft\\.com$",
  "(^|.*\\.)you\\.com$",
  "(^|.*\\.)komo\\.ai$",
  "(^|.*\\.)phind\\.com$",
  "(^|.*\\.)meta\\.ai$",
  "(^|.*\\.)search\\.brave\\.com$",
] as const;

const SEARCH_LEGACY_SOURCE_PATTERNS = [
  "(^|.*\\.)bing\\.com$",
  "^bing$",
] as const;

const GA4_AI_TRAFFIC_CACHE_TTL_MS = 30 * 60 * 1000; // 30m
const ga4AiTrafficCache = new Map<string, { measuredAtMs: number; value: GA4AiTrafficReport }>();
const ga4AiTrafficInflight = new Map<string, Promise<GA4AiTrafficReport>>();

const GA4_TOP_SOURCES_CACHE_TTL_MS = 30 * 60 * 1000; // 30m
const ga4TopSourcesCache = new Map<string, { measuredAtMs: number; value: GA4TopSourcesResult }>();
const ga4TopSourcesInflight = new Map<string, Promise<GA4TopSourcesResult>>();

const toNumber = (raw: string | null | undefined) => {
  const n = raw ? Number(raw) : 0;
  return Number.isFinite(n) ? n : 0;
};

// GA4 Data API는 요청당 metrics 10개 제한이 있어, 메트릭을 2개 요청으로 분리합니다.
const AI_TRAFFIC_METRICS_MAIN = [
  { name: "sessions" },
  { name: "activeUsers" },
  { name: "totalUsers" },
  { name: "newUsers" },
  { name: "engagedSessions" },
  { name: "bounceRate" },
  { name: "engagementRate" },
  { name: "averageSessionDuration" },
  { name: "screenPageViews" },
] as const;

const AI_TRAFFIC_METRICS_COMMERCE = [
  // ordering/limit 정합성을 위해 sessions 포함
  { name: "sessions" },
  { name: "ecommercePurchases" },
  { name: "grossPurchaseRevenue" },
] as const;

const CHATGPT_UTM_SOURCE_PATTERNS = [
  "(^|.*\\.)chatgpt\\.com$",
  "^chatgpt$",
] as const;

const makeEmptyAiTrafficTotals = (): GA4AiTrafficTotals => ({
  sessions: 0,
  activeUsers: 0,
  ecommercePurchases: 0,
  grossPurchaseRevenue: 0,
  totalUsers: 0,
  newUsers: 0,
  engagedSessions: 0,
  bounceRate: 0,
  engagementRate: 0,
  averageSessionDuration: 0,
  screenPageViews: 0,
});

type AiTrafficMainMetrics = Omit<GA4AiTrafficTotals, "ecommercePurchases" | "grossPurchaseRevenue">;
type AiTrafficCommerceMetrics = Pick<GA4AiTrafficTotals, "sessions" | "ecommercePurchases" | "grossPurchaseRevenue">;

const parseAiTrafficMainMetrics = (metricValues: { value?: string | null }[]): AiTrafficMainMetrics => ({
  sessions: toNumber(metricValues[0]?.value),
  activeUsers: toNumber(metricValues[1]?.value),
  totalUsers: toNumber(metricValues[2]?.value),
  newUsers: toNumber(metricValues[3]?.value),
  engagedSessions: toNumber(metricValues[4]?.value),
  bounceRate: toNumber(metricValues[5]?.value),
  engagementRate: toNumber(metricValues[6]?.value),
  averageSessionDuration: toNumber(metricValues[7]?.value),
  screenPageViews: toNumber(metricValues[8]?.value),
});

const parseAiTrafficCommerceMetrics = (metricValues: { value?: string | null }[]): AiTrafficCommerceMetrics => ({
  sessions: toNumber(metricValues[0]?.value),
  ecommercePurchases: toNumber(metricValues[1]?.value),
  grossPurchaseRevenue: toNumber(metricValues[2]?.value),
});

const mergeAiTrafficMetrics = (
  main: AiTrafficMainMetrics,
  commerce: AiTrafficCommerceMetrics,
): GA4AiTrafficTotals => ({
  ...main,
  ecommercePurchases: commerce.ecommercePurchases,
  grossPurchaseRevenue: commerce.grossPurchaseRevenue,
});

const makeFullRegexpOrGroup = (fieldName: string, patterns: readonly string[]) => ({
  orGroup: {
    expressions: patterns.map((value) => ({
      filter: {
        fieldName,
        stringFilter: { matchType: "FULL_REGEXP" as const, value },
      },
    })),
  },
});

const matchesAnyPattern = (value: string, patterns: readonly string[]) => {
  const v = value.trim().toLowerCase();
  if (!v) return false;
  return patterns.some((p) => {
    try {
      return new RegExp(p).test(v);
    } catch {
      return false;
    }
  });
};

export const categorizeTrafficSource = (sessionSource: string): TrafficCategory => {
  const normalized = (sessionSource ?? "").trim().toLowerCase();
  if (!normalized) return "organic";
  if (matchesAnyPattern(normalized, SEARCH_LEGACY_SOURCE_PATTERNS)) return "search_legacy";
  if (matchesAnyPattern(normalized, AI_REFERRAL_SOURCE_PATTERNS_ALLOWLIST)) return "ai_referral";
  return "organic";
};

export const queryGA4AiTrafficDetailed = async (params: {
  startDate: string;
  endDate: string;
  limit?: number;
  referralOnly?: boolean;
  forceRefresh?: boolean;
  patterns?: string[];
}): Promise<GA4AiTrafficReport> => {
  if (!env.GA4_PROPERTY_ID) {
    throw new Error("GA4_PROPERTY_ID is not configured");
  }

  const client = createGA4Client();
  const startDate = params.startDate || "30daysAgo";
  const endDate = params.endDate || "yesterday";
  const limit = Math.max(1, Math.min(500, params.limit ?? 20));
  const referralOnly = !!params.referralOnly;
  const patterns = (params.patterns && params.patterns.length > 0 ? params.patterns : [...AI_REFERRAL_SOURCE_PATTERNS_ALLOWLIST]).map((p) => p.trim()).filter(Boolean);
  const cacheKey = [startDate, endDate, limit, referralOnly ? "referralOnly" : "any", patterns.join(",")].join("|");

  if (!params.forceRefresh) {
    const cached = ga4AiTrafficCache.get(cacheKey);
    const now = Date.now();
    if (cached && now - cached.measuredAtMs < GA4_AI_TRAFFIC_CACHE_TTL_MS) return cached.value;

    const running = ga4AiTrafficInflight.get(cacheKey);
    if (running) return running;
  }

  const promise = (async (): Promise<GA4AiTrafficReport> => {
    const notes: string[] = [];
    const filterReferrerSourceOr = makeFullRegexpOrGroup("sessionSource", patterns);
    const filterUtmSourceOr = makeFullRegexpOrGroup("sessionManualSource", CHATGPT_UTM_SOURCE_PATTERNS);
    const referralMediumFilter = {
      filter: {
        fieldName: "sessionMedium",
        stringFilter: { matchType: "EXACT" as const, value: "referral" },
      },
    };

    const dimensionFilterReferrer = referralOnly
      ? { andGroup: { expressions: [filterReferrerSourceOr, referralMediumFilter] } }
      : filterReferrerSourceOr;

    // 보충(supplement) 규칙: ChatGPT UTM으로 잡히지만, sessionSource(AI referrer)로는 이미 잡히지 않은 세션만 추가합니다.
    // - sessionManualSource가 chatgpt.com / chatgpt 인 경우만 대상
    // - sessionSource가 AI allowlist에 매칭되는 경우는 제외(notExpression)
    const dimensionFilterUtmSupplement = referralOnly
      ? {
          andGroup: {
            expressions: [
              filterUtmSourceOr,
              { notExpression: filterReferrerSourceOr },
              referralMediumFilter,
            ],
          },
        }
      : {
          andGroup: {
            expressions: [
              filterUtmSourceOr,
              { notExpression: filterReferrerSourceOr },
            ],
          },
        };

    const dimensionFilterUnion = {
      orGroup: {
        expressions: [dimensionFilterReferrer, dimensionFilterUtmSupplement],
      },
    };

    if (referralOnly) {
      notes.push("보조 필터: sessionMedium=referral 적용");
    } else {
      notes.push("보조 필터 없음(allowlist 기반 sessionSource FULL_REGEXP만 적용)");
    }
    notes.push(`UTM 보충: sessionManualSource FULL_REGEXP (${CHATGPT_UTM_SOURCE_PATTERNS.join(" | ")}) + NOT(sessionSource allowlist)`);

    // 실행: (1) referrer 기반 bySource, (2) 합집합(union) totals/byLanding, (3) UTM 보충분 totals
    // NOTE: GA4는 1회 요청에 metrics 10개 제한이 있어(main + commerce) 2회로 나눠 조회 후 병합합니다.
    const [
      unionTotalsMainRes,
      unionTotalsCommerceRes,
      unionByLandingMainRes,
      unionByLandingCommerceRes,
      bySourceMainRes,
      bySourceCommerceRes,
      utmTotalsMainRes,
    ] = await Promise.all([
      client.runReport({
        property: `properties/${env.GA4_PROPERTY_ID}`,
        dateRanges: [{ startDate, endDate }],
        metrics: [...AI_TRAFFIC_METRICS_MAIN],
        dimensionFilter: dimensionFilterUnion,
      }),
      client.runReport({
        property: `properties/${env.GA4_PROPERTY_ID}`,
        dateRanges: [{ startDate, endDate }],
        metrics: [...AI_TRAFFIC_METRICS_COMMERCE],
        dimensionFilter: dimensionFilterUnion,
      }),
      client.runReport({
        property: `properties/${env.GA4_PROPERTY_ID}`,
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: "landingPagePlusQueryString" }],
        metrics: [...AI_TRAFFIC_METRICS_MAIN],
        dimensionFilter: dimensionFilterUnion,
        limit,
        orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
      }),
      client.runReport({
        property: `properties/${env.GA4_PROPERTY_ID}`,
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: "landingPagePlusQueryString" }],
        metrics: [...AI_TRAFFIC_METRICS_COMMERCE],
        dimensionFilter: dimensionFilterUnion,
        limit,
        orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
      }),
      client.runReport({
        property: `properties/${env.GA4_PROPERTY_ID}`,
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: "sessionSource" }, { name: "sessionMedium" }],
        metrics: [...AI_TRAFFIC_METRICS_MAIN],
        dimensionFilter: dimensionFilterReferrer,
        limit,
        orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
      }),
      client.runReport({
        property: `properties/${env.GA4_PROPERTY_ID}`,
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: "sessionSource" }, { name: "sessionMedium" }],
        metrics: [...AI_TRAFFIC_METRICS_COMMERCE],
        dimensionFilter: dimensionFilterReferrer,
        limit,
        orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
      }),
      client.runReport({
        property: `properties/${env.GA4_PROPERTY_ID}`,
        dateRanges: [{ startDate, endDate }],
        metrics: [...AI_TRAFFIC_METRICS_MAIN],
        dimensionFilter: dimensionFilterUtmSupplement,
      }),
    ]);

    // NOTE: totals는 metricAggregations를 요청하지 않으면 비어있을 수 있어,
    // no-dimension 요청의 rows[0]를 우선 사용하고, fallback으로 totals[0]도 확인합니다.
    const unionMain = parseAiTrafficMainMetrics(
      unionTotalsMainRes[0]?.rows?.[0]?.metricValues ??
        unionTotalsMainRes[0]?.totals?.[0]?.metricValues ??
        [],
    );
    const unionCommerce = parseAiTrafficCommerceMetrics(
      unionTotalsCommerceRes[0]?.rows?.[0]?.metricValues ??
        unionTotalsCommerceRes[0]?.totals?.[0]?.metricValues ??
        [],
    );
    const unionTotals = mergeAiTrafficMetrics(unionMain, unionCommerce);

    const utmSupplementMain = parseAiTrafficMainMetrics(
      utmTotalsMainRes[0]?.rows?.[0]?.metricValues ??
        utmTotalsMainRes[0]?.totals?.[0]?.metricValues ??
        [],
    );
    const utmSupplementSessions = utmSupplementMain.sessions;

    const referrerSessions = Math.max(0, unionTotals.sessions - utmSupplementSessions);
    const identification: GA4AiTrafficIdentification = {
      method:
        referrerSessions > 0 && utmSupplementSessions > 0
          ? "both"
          : utmSupplementSessions > 0
            ? "utm"
            : "referrer",
    };
    notes.push(
      `식별 방식: ${identification.method} (referrer 세션: ${referrerSessions}, utm 보충 세션: ${utmSupplementSessions}, 합계: ${unionTotals.sessions})`,
    );

    const commerceBySource = new Map<string, AiTrafficCommerceMetrics>();
    for (const row of bySourceCommerceRes[0].rows ?? []) {
      const dims = row.dimensionValues ?? [];
      const sessionSource = dims[0]?.value ?? "";
      const sessionMedium = dims[1]?.value ?? "";
      if (!sessionSource) continue;
      const key = `${sessionSource}|||${sessionMedium}`;
      commerceBySource.set(key, parseAiTrafficCommerceMetrics(row.metricValues ?? []));
    }

    const bySource: GA4AiTrafficBySourceRow[] = (bySourceMainRes[0].rows ?? []).map((row) => {
      const dims = row.dimensionValues ?? [];
      const sessionSource = dims[0]?.value ?? "";
      const sessionMedium = dims[1]?.value ?? "";
      const main = parseAiTrafficMainMetrics(row.metricValues ?? []);
      const key = `${sessionSource}|||${sessionMedium}`;
      const commerce = commerceBySource.get(key) ?? { sessions: main.sessions, ecommercePurchases: 0, grossPurchaseRevenue: 0 };
      const m = mergeAiTrafficMetrics(main, commerce);
      return {
        sessionSource,
        sessionSourceMedium: sessionMedium ? `${sessionSource} / ${sessionMedium}` : sessionSource,
        category: categorizeTrafficSource(sessionSource),
        ...m,
      };
    }).filter((r) => r.sessionSource);

    const commerceByLanding = new Map<string, AiTrafficCommerceMetrics>();
    for (const row of unionByLandingCommerceRes[0].rows ?? []) {
      const dims = row.dimensionValues ?? [];
      const landingPagePlusQueryString = dims[0]?.value ?? "";
      if (!landingPagePlusQueryString) continue;
      commerceByLanding.set(landingPagePlusQueryString, parseAiTrafficCommerceMetrics(row.metricValues ?? []));
    }

    const byLandingPage: GA4AiTrafficByLandingPageRow[] = (unionByLandingMainRes[0].rows ?? []).map((row) => {
      const dims = row.dimensionValues ?? [];
      const landingPagePlusQueryString = dims[0]?.value ?? "";
      const main = parseAiTrafficMainMetrics(row.metricValues ?? []);
      const commerce = commerceByLanding.get(landingPagePlusQueryString) ?? { sessions: main.sessions, ecommercePurchases: 0, grossPurchaseRevenue: 0 };
      const m = mergeAiTrafficMetrics(main, commerce);
      return {
        landingPagePlusQueryString,
        ...m,
      };
    }).filter((r) => r.landingPagePlusQueryString);

    const report: GA4AiTrafficReport = {
      range: { startDate, endDate },
      definition: "AI traffic identified by sessionSource(referrer) with ChatGPT UTM supplement(sessionManualSource)",
      identification,
      totals: unionTotals,
      bySource,
      byLandingPage,
      debug: { matchedPatterns: patterns, notes },
    };

    ga4AiTrafficCache.set(cacheKey, { measuredAtMs: Date.now(), value: report });
    return report;
  })();

  ga4AiTrafficInflight.set(cacheKey, promise);
  try {
    return await promise;
  } finally {
    ga4AiTrafficInflight.delete(cacheKey);
  }
};

export const queryGA4TopSources = async (params: {
  startDate: string;
  endDate: string;
  limit?: number;
  forceRefresh?: boolean;
}): Promise<GA4TopSourcesResult> => {
  if (!env.GA4_PROPERTY_ID) {
    throw new Error("GA4_PROPERTY_ID is not configured");
  }

  const client = createGA4Client();
  const startDate = params.startDate || "30daysAgo";
  const endDate = params.endDate || "yesterday";
  const limit = Math.max(1, Math.min(500, params.limit ?? 200));
  const cacheKey = [startDate, endDate, limit].join("|");

  if (!params.forceRefresh) {
    const cached = ga4TopSourcesCache.get(cacheKey);
    const now = Date.now();
    if (cached && now - cached.measuredAtMs < GA4_TOP_SOURCES_CACHE_TTL_MS) return cached.value;

    const running = ga4TopSourcesInflight.get(cacheKey);
    if (running) return running;
  }

  const promise = (async (): Promise<GA4TopSourcesResult> => {
    const [res] = await client.runReport({
      property: `properties/${env.GA4_PROPERTY_ID}`,
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: "sessionSource" }],
      metrics: [{ name: "sessions" }],
      limit,
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
    });

    const rows: GA4TopSourceRow[] = (res.rows ?? []).map((row) => {
      const dims = row.dimensionValues ?? [];
      const mets = row.metricValues ?? [];
      const sessionSource = dims[0]?.value ?? "";
      return {
        sessionSource,
        category: categorizeTrafficSource(sessionSource),
        sessions: toNumber(mets[0]?.value),
      };
    }).filter((r) => r.sessionSource);

    const value: GA4TopSourcesResult = {
      range: { startDate, endDate },
      rows,
    };

    ga4TopSourcesCache.set(cacheKey, { measuredAtMs: Date.now(), value });
    return value;
  })();

  ga4TopSourcesInflight.set(cacheKey, promise);
  try {
    return await promise;
  } finally {
    ga4TopSourcesInflight.delete(cacheKey);
  }
};

/* ═══════════════════════════════════════
   GA4: AI 유입 신규 vs 재방문 분석
   ═══════════════════════════════════════ */

export type GA4AiTrafficUserType = "new" | "returning";

export type GA4AiTrafficUserTypeSummary = {
  sessions: number;
  activeUsers: number;
  /** 참여 세션 수 (10초+ 또는 키이벤트 또는 2페이지+) */
  engagedSessions: number;
  /** 이탈률 fraction (0-1). 프론트에서 x100하여 % 표시할 것 */
  bounceRate: number;
  /** 참여율 fraction (0-1). 1 - bounceRate와 근사 */
  engagementRate: number;
  /** 평균 세션 시간 (초 단위). 프론트에서 분:초로 변환 */
  averageSessionDuration: number;
  ecommercePurchases: number;
  grossPurchaseRevenue: number;
};

export type GA4AiTrafficUserTypeBySourceAndTypeRow = {
  source: string;
  userType: GA4AiTrafficUserType;
  sessions: number;
  activeUsers: number;
  engagedSessions: number;
  bounceRate: number;
  engagementRate: number;
  averageSessionDuration: number;
  ecommercePurchases: number;
  grossPurchaseRevenue: number;
  category: TrafficCategory;
};

export type GA4AiTrafficUserTypeResponse = {
  period: { startDate: string; endDate: string };
  identification: GA4AiTrafficIdentification;
  summary: {
    new: GA4AiTrafficUserTypeSummary;
    returning: GA4AiTrafficUserTypeSummary;
  };
  bySourceAndType: GA4AiTrafficUserTypeBySourceAndTypeRow[];
  debug: { notes: string[] };
};

const AI_USER_TYPE_METRICS = [
  { name: "sessions" },
  { name: "activeUsers" },
  { name: "engagedSessions" },
  { name: "bounceRate" },
  { name: "engagementRate" },
  { name: "averageSessionDuration" },
  { name: "ecommercePurchases" },
  { name: "grossPurchaseRevenue" },
] as const;

const makeEmptyUserTypeSummary = (): GA4AiTrafficUserTypeSummary => ({
  sessions: 0,
  activeUsers: 0,
  engagedSessions: 0,
  bounceRate: 0,
  engagementRate: 0,
  averageSessionDuration: 0,
  ecommercePurchases: 0,
  grossPurchaseRevenue: 0,
});

const parseUserTypeMetrics = (metricValues: { value?: string | null }[]): GA4AiTrafficUserTypeSummary => ({
  sessions: toNumber(metricValues[0]?.value),
  activeUsers: toNumber(metricValues[1]?.value),
  engagedSessions: toNumber(metricValues[2]?.value),
  bounceRate: toNumber(metricValues[3]?.value),
  engagementRate: toNumber(metricValues[4]?.value),
  averageSessionDuration: toNumber(metricValues[5]?.value),
  ecommercePurchases: toNumber(metricValues[6]?.value),
  grossPurchaseRevenue: toNumber(metricValues[7]?.value),
});

export const queryGA4AiTrafficUserType = async (params: {
  startDate: string;
  endDate: string;
  limit?: number;
}): Promise<GA4AiTrafficUserTypeResponse> => {
  if (!env.GA4_PROPERTY_ID) {
    throw new Error("GA4_PROPERTY_ID is not configured");
  }

  const client = createGA4Client();
  const startDate = params.startDate || "30daysAgo";
  const endDate = params.endDate || "today";
  const limit = Math.max(1, Math.min(500, params.limit ?? 200));

  const notes: string[] = [];
  const filterReferrerSourceOr = makeFullRegexpOrGroup("sessionSource", AI_REFERRAL_SOURCE_PATTERNS_ALLOWLIST);
  const filterUtmSourceOr = makeFullRegexpOrGroup("sessionManualSource", CHATGPT_UTM_SOURCE_PATTERNS);

  const dimensionFilterReferrer = filterReferrerSourceOr;
  const dimensionFilterUtmSupplement = {
    andGroup: {
      expressions: [
        filterUtmSourceOr,
        { notExpression: filterReferrerSourceOr },
      ],
    },
  };
  const dimensionFilterUnion = {
    orGroup: {
      expressions: [dimensionFilterReferrer, dimensionFilterUtmSupplement],
    },
  };

  notes.push("식별: sessionSource allowlist(FULL_REGEXP) + ChatGPT utm_source(sessionManualSource) 보충");
  notes.push(`UTM 패턴: ${CHATGPT_UTM_SOURCE_PATTERNS.join(" | ")}`);

  const [summaryRes, bySourceRes, byUtmRes] = await Promise.all([
    client.runReport({
      property: `properties/${env.GA4_PROPERTY_ID}`,
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: "newVsReturning" }],
      metrics: [...AI_USER_TYPE_METRICS],
      dimensionFilter: dimensionFilterUnion,
    }),
    client.runReport({
      property: `properties/${env.GA4_PROPERTY_ID}`,
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: "newVsReturning" }, { name: "sessionSource" }],
      metrics: [...AI_USER_TYPE_METRICS],
      dimensionFilter: dimensionFilterReferrer,
      limit,
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
    }),
    client.runReport({
      property: `properties/${env.GA4_PROPERTY_ID}`,
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: "newVsReturning" }, { name: "sessionManualSource" }],
      metrics: [...AI_USER_TYPE_METRICS],
      dimensionFilter: dimensionFilterUtmSupplement,
      limit: Math.min(limit, 20),
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
    }),
  ]);

  const summary = {
    new: makeEmptyUserTypeSummary(),
    returning: makeEmptyUserTypeSummary(),
  };

  // newVsReturning은 문서상 "new"/"returning"이지만, 실데이터에서 "(not set)" 등이 반환될 수 있어
  // totals/식별 계산에서는 전체 세션을 합산하고, 응답 summary는 스펙대로 new/returning만 채웁니다.
  let unionSessions = 0;
  for (const row of summaryRes[0].rows ?? []) {
    const dims = row.dimensionValues ?? [];
    const userTypeValue = (dims[0]?.value ?? "").trim();
    const m = parseUserTypeMetrics(row.metricValues ?? []);
    unionSessions += m.sessions;
    if (userTypeValue === "new" || userTypeValue === "returning") {
      summary[userTypeValue] = m;
    } else if (userTypeValue) {
      notes.push(
        `주의: newVsReturning='${userTypeValue}' 행이 반환됨 (sessions=${m.sessions}, purchases=${m.ecommercePurchases}, revenue=${m.grossPurchaseRevenue})`,
      );
    }
  }

  const bySourceAndType: GA4AiTrafficUserTypeBySourceAndTypeRow[] = [];

  for (const row of bySourceRes[0].rows ?? []) {
    const dims = row.dimensionValues ?? [];
    const userTypeValue = (dims[0]?.value ?? "").trim();
    const source = dims[1]?.value ?? "";
    const m = parseUserTypeMetrics(row.metricValues ?? []);
    if (!source) continue;
    if (userTypeValue !== "new" && userTypeValue !== "returning") {
      if (userTypeValue) {
        notes.push(
          `주의: bySource에서도 newVsReturning='${userTypeValue}' 행이 반환됨 (source=${source}, sessions=${m.sessions})`,
        );
      }
      continue;
    }
    bySourceAndType.push({
      source,
      userType: userTypeValue,
      ...m,
      category: categorizeTrafficSource(source),
    });
  }

  let utmSessions = 0;
  for (const row of byUtmRes[0].rows ?? []) {
    const dims = row.dimensionValues ?? [];
    const userTypeValue = (dims[0]?.value ?? "").trim();
    const manualSource = (dims[1]?.value ?? "").trim();
    if (!manualSource) continue;
    const m = parseUserTypeMetrics(row.metricValues ?? []);
    utmSessions += m.sessions;
    if (userTypeValue !== "new" && userTypeValue !== "returning") {
      if (userTypeValue) {
        notes.push(
          `주의: UTM 보충에서도 newVsReturning='${userTypeValue}' 행이 반환됨 (utm=${manualSource}, sessions=${m.sessions})`,
        );
      }
      continue;
    }
    const categoryKey = manualSource === "chatgpt" ? "chatgpt.com" : manualSource;
    bySourceAndType.push({
      source: `utm:${manualSource}`,
      userType: userTypeValue,
      ...m,
      category: categorizeTrafficSource(categoryKey),
    });
  }

  const referrerSessions = Math.max(0, unionSessions - utmSessions);
  const identification: GA4AiTrafficIdentification = {
    method:
      referrerSessions > 0 && utmSessions > 0
        ? "both"
        : utmSessions > 0
          ? "utm"
          : "referrer",
  };
  notes.push(`식별 요약: ${identification.method} (referrer=${referrerSessions}, utm=${utmSessions}, total=${unionSessions})`);

  return {
    period: { startDate, endDate },
    identification,
    summary,
    bySourceAndType,
    debug: { notes },
  };
};
