import { BetaAnalyticsDataClient } from "@google-analytics/data";
import { AlphaAnalyticsDataClient } from "@google-analytics/data/build/src/v1alpha";

import { FUNNEL_CONFIG, type FunnelType } from "./config/funnel-config";
import { AI_REFERRAL_SOURCE_PATTERNS_ALLOWLIST, matchAiReferrer } from "./config/ai-referrers";
import { env as rawEnv } from "./env";

/*
 * GA4 멀티 property 지원:
 * .env에서 GA4_BIOCOM_PROPERTY_ID / GA4_BIOCOM_SERVICE_ACCOUNT_KEY로 변수명이 바뀜.
 * 기존 코드 60곳이 env.GA4_PROPERTY_ID / env.GA4_SERVICE_ACCOUNT_KEY를 참조하므로,
 * 여기서 새 변수명 → 옛 변수명으로 resolve해서 기존 코드를 깨지 않게 한다.
 */
const env = {
  ...rawEnv,
  GA4_PROPERTY_ID: rawEnv.GA4_PROPERTY_ID ?? rawEnv.GA4_BIOCOM_PROPERTY_ID,
  GA4_SERVICE_ACCOUNT_KEY: rawEnv.GA4_SERVICE_ACCOUNT_KEY ?? rawEnv.GA4_BIOCOM_SERVICE_ACCOUNT_KEY,
};

/** 사이트 코드 → GA4 property ID 매핑 */
export const GA4_PROPERTY_MAP: Record<string, string | undefined> = {
  biocom: rawEnv.GA4_BIOCOM_PROPERTY_ID,
  thecleancoffee: rawEnv.GA4_COFFEE_PROPERTY_ID,
  aibio: rawEnv.GA4_AIBIOCOM_PROPERTY_ID,
};

/** site 코드로 property ID를 가져온다. 없으면 기본값(바이오컴). */
export const resolveGA4PropertyId = (site?: string): string => {
  if (site && GA4_PROPERTY_MAP[site]) return GA4_PROPERTY_MAP[site]!;
  return env.GA4_PROPERTY_ID ?? "";
};

const parseServiceAccountKey = (rawKey: string) => {
  try {
    return JSON.parse(rawKey);
  } catch {
    throw new Error("GA4_SERVICE_ACCOUNT_KEY is not valid JSON.");
  }
};

const createGA4Client = (): BetaAnalyticsDataClient => {
  if (!env.GA4_SERVICE_ACCOUNT_KEY) {
    throw new Error("GA4_SERVICE_ACCOUNT_KEY is not configured");
  }
  const credentials = parseServiceAccountKey(env.GA4_SERVICE_ACCOUNT_KEY);
  return new BetaAnalyticsDataClient({ credentials });
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

export type GA4EcommerceFunnelStep = {
  name: string;
  event: string;
  sessions: number;
  /** 이전 단계 대비 전환율(%) */
  conversionRate: number;
};

export type GA4EcommerceFunnelDropoff = {
  from: string;
  to: string;
  /** dropRate(%) = 100 - (to.sessions / from.sessions * 100) */
  dropRate: number;
};

export type GA4EcommerceFunnelResult = {
  range: { startDate: string; endDate: string };
  type: FunnelType;
  label: string;
  steps: GA4EcommerceFunnelStep[];
  overallConversion: number;
  biggestDropoff: GA4EcommerceFunnelDropoff;
  debug?: { notes: string[] };
};

// Ecommerce 이벤트 기반 "의사결정용" 퍼널(검사/영양제).
// NOTE: GA4 Data API에 공식 Funnel 차원이 없어서, 각 eventName별 "sessions"를 단계 값으로 사용합니다.
export const queryGA4EcommerceFunnel = async (params: {
  type: FunnelType;
  startDate: string;
  endDate: string;
}): Promise<GA4EcommerceFunnelResult> => {
  if (!env.GA4_PROPERTY_ID) {
    throw new Error("GA4_PROPERTY_ID is not configured");
  }

  const client = createGA4Client();
  const startDate = params.startDate || "30daysAgo";
  const endDate = params.endDate || "yesterday";
  const config = FUNNEL_CONFIG[params.type];
  const notes: string[] = [];

  const eventNameOr = {
    orGroup: {
      expressions: config.steps.map((step) => ({
        filter: {
          fieldName: "eventName",
          stringFilter: { matchType: "EXACT" as const, value: step.event },
        },
      })),
    },
  };

  const typeOr = {
    orGroup: {
      expressions: config.filter.values.map((value) => ({
        filter: {
          fieldName: config.filter.fieldName,
          stringFilter: { matchType: config.filter.matchType as "EXACT" | "CONTAINS" | "FULL_REGEXP", value },
        },
      })),
    },
  };

  const dimensionFilter = { andGroup: { expressions: [eventNameOr, typeOr] } };

  const [res] = await client.runReport({
    property: `properties/${env.GA4_PROPERTY_ID}`,
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: "eventName" }],
    metrics: [{ name: "sessions" }],
    dimensionFilter,
    limit: 50,
  });

  const sessionsByEvent = new Map<string, number>();
  for (const row of res.rows ?? []) {
    const dims = row.dimensionValues ?? [];
    const mets = row.metricValues ?? [];
    const eventName = dims[0]?.value ?? "";
    if (!eventName) continue;
    const sessionsRaw = Number.parseInt(mets[0]?.value ?? "0", 10);
    sessionsByEvent.set(eventName, Number.isFinite(sessionsRaw) ? sessionsRaw : 0);
  }

  const steps: GA4EcommerceFunnelStep[] = [];
  for (const step of config.steps) {
    const sessions = sessionsByEvent.get(step.event) ?? 0;
    const prevSessions = steps.length > 0 ? steps[steps.length - 1]?.sessions ?? 0 : 0;
    const conversionRate =
      steps.length === 0 ? 100 : prevSessions > 0 ? +((sessions / prevSessions) * 100).toFixed(1) : 0;
    steps.push({ name: step.name, event: step.event, sessions, conversionRate });
  }

  const first = steps[0]?.sessions ?? 0;
  const last = steps[steps.length - 1]?.sessions ?? 0;
  const overallConversion = first > 0 ? +((last / first) * 100).toFixed(1) : 0;

  let biggestDropoff: GA4EcommerceFunnelDropoff = { from: steps[0]?.name ?? "", to: steps[1]?.name ?? "", dropRate: 0 };
  for (let i = 0; i < steps.length - 1; i++) {
    const from = steps[i]!;
    const to = steps[i + 1]!;
    if (from.sessions <= 0) continue;
    const raw = ((from.sessions - to.sessions) / from.sessions) * 100;
    const dropRate = raw > 0 ? +raw.toFixed(1) : 0;
    if (!biggestDropoff.from || dropRate > biggestDropoff.dropRate) {
      biggestDropoff = { from: from.name, to: to.name, dropRate };
    }
  }

  notes.push(`filter: ${config.filter.fieldName} ${config.filter.matchType} (${config.filter.values.join(", ")})`);

  return {
    range: { startDate, endDate },
    type: params.type,
    label: config.label,
    steps,
    overallConversion,
    biggestDropoff,
    ...(notes.length > 0 ? { debug: { notes } } : {}),
  };
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

export type DataSourceMeta = {
  /** "live" = GA4 실시간 조회 결과, "empty" = GA4 미연결/권한 문제 등으로 빈값 */
  type: "live" | "empty";
  /** GA4 property ID (live일 때만) */
  propertyId?: string;
  /** 조회 시각 ISO */
  queriedAt: string;
  /** 조회 기간 */
  period: { startDate: string; endDate: string };
  /** empty일 때 안내 메시지 */
  notice?: string;
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
  matched: boolean;
  label: string | null;
};

export type GA4TopSourcesResult = {
  range: { startDate: string; endDate: string };
  rows: GA4TopSourceRow[];
};

export type TrafficCategory = "ai_referral" | "search_legacy" | "organic";

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

/* ═══════════════════════════════════════
   GA4: AI 유입 전용 전환 퍼널 (best-effort)
   ═══════════════════════════════════════ */

export type GA4AiConversionFunnelStep = {
  name: string;
  key: "sessions" | "engagedSessions" | "view_item" | "add_to_cart" | "begin_checkout" | "purchase";
  /** sessions 기준 값 */
  sessions: number;
  /** 이전 단계 대비 전환율(%) */
  conversionRate: number;
};

export type GA4AiConversionFunnelDropoff = {
  from: string;
  to: string;
  /** dropRate(%) = 100 - (to.sessions / from.sessions * 100) */
  dropRate: number;
};

export type GA4AiConversionFunnelReport = {
  range: { startDate: string; endDate: string };
  identification: GA4AiTrafficIdentification;
  referralOnly: boolean;
  steps: GA4AiConversionFunnelStep[];
  overallConversion: number;
  biggestDropoff: GA4AiConversionFunnelDropoff;
  totals: Pick<GA4AiTrafficTotals, "sessions" | "engagedSessions" | "ecommercePurchases" | "grossPurchaseRevenue"> & {
    conversions: number;
  };
  debug: { matchedPatterns: string[]; notes: string[] };
};

export const queryGA4AiConversionFunnel = async (params: {
  startDate: string;
  endDate: string;
  referralOnly?: boolean;
  patterns?: string[];
}): Promise<GA4AiConversionFunnelReport> => {
  if (!env.GA4_PROPERTY_ID) {
    throw new Error("GA4_PROPERTY_ID is not configured");
  }

  const client = createGA4Client();
  const startDate = params.startDate || "30daysAgo";
  const endDate = params.endDate || "yesterday";
  const referralOnly = !!params.referralOnly;
  const patterns = (params.patterns && params.patterns.length > 0 ? params.patterns : [...AI_REFERRAL_SOURCE_PATTERNS_ALLOWLIST])
    .map((p) => p.trim())
    .filter(Boolean);
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

  notes.push(referralOnly ? "보조 필터: sessionMedium=referral 적용" : "보조 필터 없음(allowlist 기반 sessionSource FULL_REGEXP만 적용)");
  notes.push(`UTM 보충: sessionManualSource FULL_REGEXP (${CHATGPT_UTM_SOURCE_PATTERNS.join(" | ")}) + NOT(sessionSource allowlist)`);

  const [totalsRes, eventsRes, utmSupplementRes] = await Promise.all([
    client.runReport({
      property: `properties/${env.GA4_PROPERTY_ID}`,
      dateRanges: [{ startDate, endDate }],
      metrics: [
        { name: "sessions" },
        { name: "engagedSessions" },
        { name: "conversions" },
        { name: "ecommercePurchases" },
        { name: "grossPurchaseRevenue" },
      ],
      dimensionFilter: dimensionFilterUnion,
    }),
    client.runReport({
      property: `properties/${env.GA4_PROPERTY_ID}`,
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: "eventName" }],
      metrics: [{ name: "sessions" }],
      dimensionFilter: {
        andGroup: {
          expressions: [
            dimensionFilterUnion,
            {
              orGroup: {
                expressions: ["view_item", "add_to_cart", "begin_checkout", "purchase"].map((eventName) => ({
                  filter: {
                    fieldName: "eventName",
                    stringFilter: { matchType: "EXACT" as const, value: eventName },
                  },
                })),
              },
            },
          ],
        },
      },
      limit: 50,
    }),
    client.runReport({
      property: `properties/${env.GA4_PROPERTY_ID}`,
      dateRanges: [{ startDate, endDate }],
      metrics: [{ name: "sessions" }],
      dimensionFilter: dimensionFilterUtmSupplement,
    }),
  ]);

  const totalsValues = totalsRes[0].rows?.[0]?.metricValues ?? [];
  const totals = {
    sessions: toNumber(totalsValues[0]?.value),
    engagedSessions: toNumber(totalsValues[1]?.value),
    conversions: toNumber(totalsValues[2]?.value),
    ecommercePurchases: toNumber(totalsValues[3]?.value),
    grossPurchaseRevenue: toNumber(totalsValues[4]?.value),
  };

  const utmSupplementSessions = toNumber(utmSupplementRes[0].rows?.[0]?.metricValues?.[0]?.value);
  const referrerSessions = Math.max(0, totals.sessions - utmSupplementSessions);
  const identification: GA4AiTrafficIdentification = {
    method:
      referrerSessions > 0 && utmSupplementSessions > 0
        ? "both"
        : utmSupplementSessions > 0
          ? "utm"
          : "referrer",
  };
  notes.push(
    `식별 방식: ${identification.method} (referrer 세션: ${referrerSessions}, utm 보충 세션: ${utmSupplementSessions}, 합계: ${totals.sessions})`,
  );

  const sessionsByEvent = new Map<string, number>();
  for (const row of eventsRes[0].rows ?? []) {
    const dims = row.dimensionValues ?? [];
    const mets = row.metricValues ?? [];
    const eventName = dims[0]?.value ?? "";
    if (!eventName) continue;
    sessionsByEvent.set(eventName, toNumber(mets[0]?.value));
  }

  const steps: GA4AiConversionFunnelStep[] = [];
  const pushStep = (name: GA4AiConversionFunnelStep["name"], key: GA4AiConversionFunnelStep["key"], sessions: number) => {
    const prevSessions = steps.length > 0 ? steps[steps.length - 1]?.sessions ?? 0 : 0;
    const conversionRate =
      steps.length === 0 ? 100 : prevSessions > 0 ? +((sessions / prevSessions) * 100).toFixed(1) : 0;
    steps.push({ name, key, sessions, conversionRate });
  };

  pushStep("AI 유입 세션", "sessions", totals.sessions);
  pushStep("참여 세션", "engagedSessions", totals.engagedSessions);
  pushStep("상품 조회", "view_item", sessionsByEvent.get("view_item") ?? 0);
  pushStep("장바구니", "add_to_cart", sessionsByEvent.get("add_to_cart") ?? 0);
  pushStep("결제 시작", "begin_checkout", sessionsByEvent.get("begin_checkout") ?? 0);
  pushStep("구매", "purchase", sessionsByEvent.get("purchase") ?? 0);

  const first = steps[0]?.sessions ?? 0;
  const last = steps[steps.length - 1]?.sessions ?? 0;
  const overallConversion = first > 0 ? +((last / first) * 100).toFixed(1) : 0;

  let biggestDropoff: GA4AiConversionFunnelDropoff = { from: steps[0]?.name ?? "", to: steps[1]?.name ?? "", dropRate: 0 };
  for (let i = 0; i < steps.length - 1; i++) {
    const from = steps[i]!;
    const to = steps[i + 1]!;
    if (from.sessions <= 0) continue;
    const raw = ((from.sessions - to.sessions) / from.sessions) * 100;
    const dropRate = raw > 0 ? +raw.toFixed(1) : 0;
    if (!biggestDropoff.from || dropRate > biggestDropoff.dropRate) {
      biggestDropoff = { from: from.name, to: to.name, dropRate };
    }
  }

  return {
    range: { startDate, endDate },
    identification,
    referralOnly,
    steps,
    overallConversion,
    biggestDropoff,
    totals,
    debug: { matchedPatterns: patterns, notes },
  };
};

/* ═══════════════════════════════════════
   GA4: AI vs Organic 비교 리포트 (채널 품질 비교)
   ═══════════════════════════════════════ */

export type GA4ChannelQualitySummary = {
  sessions: number;
  newUsers: number;
  engagedSessions: number;
  bounceRate: number; // fraction (0-1)
  engagementRate: number; // fraction (0-1)
  averageSessionDuration: number; // seconds
  screenPageViews: number;
  conversions: number;
  ecommercePurchases: number;
  grossPurchaseRevenue: number;
  /** derived: screenPageViews / sessions */
  pagesPerSession: number;
  /** derived: conversions / sessions * 100 */
  conversionRate: number;
  /** derived: ecommercePurchases / sessions * 100 */
  purchaseConversionRate: number;
};

export type GA4AiVsOrganicReport = {
  range: { startDate: string; endDate: string };
  identification: GA4AiTrafficIdentification;
  referralOnly: boolean;
  ai: GA4ChannelQualitySummary;
  organic: GA4ChannelQualitySummary;
  debug: { matchedPatterns: string[]; notes: string[] };
};

export const queryGA4AiVsOrganicReport = async (params: {
  startDate: string;
  endDate: string;
  referralOnly?: boolean;
  patterns?: string[];
}): Promise<GA4AiVsOrganicReport> => {
  if (!env.GA4_PROPERTY_ID) {
    throw new Error("GA4_PROPERTY_ID is not configured");
  }

  const client = createGA4Client();
  const startDate = params.startDate || "30daysAgo";
  const endDate = params.endDate || "yesterday";
  const referralOnly = !!params.referralOnly;
  const patterns = (params.patterns && params.patterns.length > 0 ? params.patterns : [...AI_REFERRAL_SOURCE_PATTERNS_ALLOWLIST])
    .map((p) => p.trim())
    .filter(Boolean);
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

  const organicFilter = {
    filter: {
      fieldName: "sessionDefaultChannelGroup",
      stringFilter: { matchType: "EXACT" as const, value: "Organic Search" },
    },
  };

  const metrics = [
    { name: "sessions" },
    { name: "newUsers" },
    { name: "engagedSessions" },
    { name: "bounceRate" },
    { name: "engagementRate" },
    { name: "averageSessionDuration" },
    { name: "screenPageViews" },
    { name: "conversions" },
    { name: "ecommercePurchases" },
    { name: "grossPurchaseRevenue" },
  ] as const;

  notes.push(referralOnly ? "보조 필터: sessionMedium=referral 적용" : "보조 필터 없음(allowlist 기반 sessionSource FULL_REGEXP만 적용)");
  notes.push(`UTM 보충: sessionManualSource FULL_REGEXP (${CHATGPT_UTM_SOURCE_PATTERNS.join(" | ")}) + NOT(sessionSource allowlist)`);

  const [aiRes, organicRes, utmSupplementRes] = await Promise.all([
    client.runReport({
      property: `properties/${env.GA4_PROPERTY_ID}`,
      dateRanges: [{ startDate, endDate }],
      metrics: [...metrics],
      dimensionFilter: dimensionFilterUnion,
    }),
    client.runReport({
      property: `properties/${env.GA4_PROPERTY_ID}`,
      dateRanges: [{ startDate, endDate }],
      metrics: [...metrics],
      dimensionFilter: organicFilter,
    }),
    client.runReport({
      property: `properties/${env.GA4_PROPERTY_ID}`,
      dateRanges: [{ startDate, endDate }],
      metrics: [{ name: "sessions" }],
      dimensionFilter: dimensionFilterUtmSupplement,
    }),
  ]);

  const parseSummary = (report: {
    rows?: ({ metricValues?: ({ value?: string | null } | null)[] | null } | null)[] | null;
  } | null | undefined): GA4ChannelQualitySummary => {
    const values = report?.rows?.[0]?.metricValues ?? [];
    const sessions = toNumber(values[0]?.value);
    const newUsers = toNumber(values[1]?.value);
    const engagedSessions = toNumber(values[2]?.value);
    const bounceRate = toNumber(values[3]?.value);
    const engagementRate = toNumber(values[4]?.value);
    const averageSessionDuration = toNumber(values[5]?.value);
    const screenPageViews = toNumber(values[6]?.value);
    const conversions = toNumber(values[7]?.value);
    const ecommercePurchases = toNumber(values[8]?.value);
    const grossPurchaseRevenue = toNumber(values[9]?.value);

    const pagesPerSession = sessions > 0 ? +(screenPageViews / sessions).toFixed(2) : 0;
    const conversionRate = sessions > 0 ? +((conversions / sessions) * 100).toFixed(2) : 0;
    const purchaseConversionRate = sessions > 0 ? +((ecommercePurchases / sessions) * 100).toFixed(2) : 0;

    return {
      sessions,
      newUsers,
      engagedSessions,
      bounceRate,
      engagementRate,
      averageSessionDuration,
      screenPageViews,
      conversions,
      ecommercePurchases,
      grossPurchaseRevenue,
      pagesPerSession,
      conversionRate,
      purchaseConversionRate,
    };
  };

  const aiSummary = parseSummary(aiRes[0]);
  const utmSupplementSessions = toNumber(utmSupplementRes[0].rows?.[0]?.metricValues?.[0]?.value);
  const referrerSessions = Math.max(0, aiSummary.sessions - utmSupplementSessions);
  const identification: GA4AiTrafficIdentification = {
    method:
      referrerSessions > 0 && utmSupplementSessions > 0
        ? "both"
        : utmSupplementSessions > 0
          ? "utm"
          : "referrer",
  };
  notes.push(
    `식별 방식: ${identification.method} (referrer 세션: ${referrerSessions}, utm 보충 세션: ${utmSupplementSessions}, 합계: ${aiSummary.sessions})`,
  );

  return {
    range: { startDate, endDate },
    identification,
    referralOnly,
    ai: aiSummary,
    organic: parseSummary(organicRes[0]),
    debug: { matchedPatterns: patterns, notes },
  };
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
      const category = categorizeTrafficSource(sessionSource);
      const matchedInfo = matchAiReferrer(sessionSource);
      const matched = category === "ai_referral" && matchedInfo.matched;
      return {
        sessionSource,
        category,
        sessions: toNumber(mets[0]?.value),
        matched,
        label: matched ? matchedInfo.label : null,
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

/* ═══════════════════════════════════════
   GA4: 전자상거래 퍼널 — 디바이스별 (Q1 대응)
   view_item → add_to_cart → begin_checkout → add_payment_info → purchase
   ═══════════════════════════════════════ */

export type GA4EcommerceFunnelByDeviceStep = {
  name: string;
  event: string;
  count: number;
  conversionRate: number;
};

export type GA4EcommerceFunnelByDeviceRow = {
  device: string;
  steps: GA4EcommerceFunnelByDeviceStep[];
  overallConversion: number;
  biggestDropoff: { from: string; to: string; dropRate: number };
};

export type GA4EcommerceFunnelByDeviceResult = {
  range: { startDate: string; endDate: string };
  devices: GA4EcommerceFunnelByDeviceRow[];
  allDevices: {
    steps: GA4EcommerceFunnelByDeviceStep[];
    overallConversion: number;
    biggestDropoff: { from: string; to: string; dropRate: number };
  };
  debug: { notes: string[] };
};

const FULL_ECOMMERCE_FUNNEL_STEPS = [
  { name: "상품 조회", event: "view_item" },
  { name: "장바구니", event: "add_to_cart" },
  { name: "결제 시작", event: "begin_checkout" },
  { name: "결제 정보 입력", event: "add_payment_info" },
  { name: "구매 완료", event: "purchase" },
] as const;

const buildFunnelSteps = (
  eventCounts: Map<string, number>,
): { steps: GA4EcommerceFunnelByDeviceStep[]; overallConversion: number; biggestDropoff: { from: string; to: string; dropRate: number } } => {
  const steps: GA4EcommerceFunnelByDeviceStep[] = [];
  for (const step of FULL_ECOMMERCE_FUNNEL_STEPS) {
    const count = eventCounts.get(step.event) ?? 0;
    const prev = steps.length > 0 ? steps[steps.length - 1]!.count : 0;
    const conversionRate = steps.length === 0 ? 100 : prev > 0 ? +((count / prev) * 100).toFixed(1) : 0;
    steps.push({ name: step.name, event: step.event, count, conversionRate });
  }
  const first = steps[0]?.count ?? 0;
  const last = steps[steps.length - 1]?.count ?? 0;
  const overallConversion = first > 0 ? +((last / first) * 100).toFixed(1) : 0;

  let biggestDropoff = { from: "", to: "", dropRate: 0 };
  for (let i = 0; i < steps.length - 1; i++) {
    const from = steps[i]!;
    const to = steps[i + 1]!;
    if (from.count <= 0) continue;
    const dropRate = +((1 - to.count / from.count) * 100).toFixed(1);
    if (dropRate > biggestDropoff.dropRate) {
      biggestDropoff = { from: from.name, to: to.name, dropRate };
    }
  }
  return { steps, overallConversion, biggestDropoff };
};

export const queryGA4EcommerceFunnelByDevice = async (params: {
  startDate: string;
  endDate: string;
}): Promise<GA4EcommerceFunnelByDeviceResult> => {
  if (!env.GA4_PROPERTY_ID) throw new Error("GA4_PROPERTY_ID is not configured");

  const client = createGA4Client();
  const { startDate, endDate } = params;
  const notes: string[] = [];

  const eventFilter = {
    orGroup: {
      expressions: FULL_ECOMMERCE_FUNNEL_STEPS.map((s) => ({
        filter: {
          fieldName: "eventName",
          stringFilter: { matchType: "EXACT" as const, value: s.event },
        },
      })),
    },
  };

  const [res] = await client.runReport({
    property: `properties/${env.GA4_PROPERTY_ID}`,
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: "deviceCategory" }, { name: "eventName" }],
    metrics: [{ name: "eventCount" }],
    dimensionFilter: eventFilter,
    limit: 100,
  });

  // deviceCategory → eventName → count
  const deviceMap = new Map<string, Map<string, number>>();
  const allMap = new Map<string, number>();

  for (const row of res.rows ?? []) {
    const dims = row.dimensionValues ?? [];
    const mets = row.metricValues ?? [];
    const device = (dims[0]?.value ?? "unknown").toLowerCase();
    const event = dims[1]?.value ?? "";
    const count = toNumber(mets[0]?.value);

    if (!deviceMap.has(device)) deviceMap.set(device, new Map());
    deviceMap.get(device)!.set(event, (deviceMap.get(device)!.get(event) ?? 0) + count);
    allMap.set(event, (allMap.get(event) ?? 0) + count);
  }

  const devices: GA4EcommerceFunnelByDeviceRow[] = [];
  for (const [device, eventCounts] of deviceMap) {
    devices.push({ device, ...buildFunnelSteps(eventCounts) });
  }
  devices.sort((a, b) => {
    const order = ["mobile", "desktop", "tablet"];
    return (order.indexOf(a.device) === -1 ? 99 : order.indexOf(a.device)) -
      (order.indexOf(b.device) === -1 ? 99 : order.indexOf(b.device));
  });

  notes.push(`디바이스 ${devices.length}개 감지: ${devices.map((d) => d.device).join(", ")}`);

  return {
    range: { startDate, endDate },
    devices,
    allDevices: buildFunnelSteps(allMap),
    debug: { notes },
  };
};

/* ═══════════════════════════════════════
   GA4: 매출 중심 KPI
   매출, 구매수, 구매전환율, 객단가, 세션당매출, report조회당매출
   ═══════════════════════════════════════ */

export type GA4RevenueKpi = {
  range: { startDate: string; endDate: string };
  totalRevenue: number;
  totalPurchases: number;
  totalSessions: number;
  purchaseConversionRate: number;
  averageOrderValue: number;
  revenuePerSession: number;
  reportViews: number;
  revenuePerReportView: number;
  debug: { notes: string[] };
};

export const queryGA4RevenueKpi = async (params: {
  startDate: string;
  endDate: string;
}): Promise<GA4RevenueKpi> => {
  if (!env.GA4_PROPERTY_ID) throw new Error("GA4_PROPERTY_ID is not configured");

  const client = createGA4Client();
  const { startDate, endDate } = params;
  const notes: string[] = [];

  // 1) 매출 + 구매수 + 세션수
  const [mainRes] = await client.runReport({
    property: `properties/${env.GA4_PROPERTY_ID}`,
    dateRanges: [{ startDate, endDate }],
    metrics: [
      { name: "grossPurchaseRevenue" },
      { name: "ecommercePurchases" },
      { name: "sessions" },
    ],
  });

  const totalRevenue = toNumber(mainRes.rows?.[0]?.metricValues?.[0]?.value);
  const totalPurchases = toNumber(mainRes.rows?.[0]?.metricValues?.[1]?.value);
  const totalSessions = toNumber(mainRes.rows?.[0]?.metricValues?.[2]?.value);

  // 2) report 페이지 조회수 (page_view on /report* paths)
  let reportViews = 0;
  try {
    const [reportRes] = await client.runReport({
      property: `properties/${env.GA4_PROPERTY_ID}`,
      dateRanges: [{ startDate, endDate }],
      metrics: [{ name: "screenPageViews" }],
      dimensionFilter: {
        filter: {
          fieldName: "pagePath",
          stringFilter: { matchType: "FULL_REGEXP" as const, value: "^/report" },
        },
      },
    });
    reportViews = toNumber(reportRes.rows?.[0]?.metricValues?.[0]?.value);
    notes.push(`report 조회수: pagePath FULL_REGEXP ^/report → ${reportViews}`);
  } catch {
    notes.push("report 조회수 집계 실패 — 0으로 표시");
  }

  const purchaseConversionRate = totalSessions > 0 ? +((totalPurchases / totalSessions) * 100).toFixed(2) : 0;
  const averageOrderValue = totalPurchases > 0 ? Math.round(totalRevenue / totalPurchases) : 0;
  const revenuePerSession = totalSessions > 0 ? Math.round(totalRevenue / totalSessions) : 0;
  const revenuePerReportView = reportViews > 0 ? Math.round(totalRevenue / reportViews) : 0;

  return {
    range: { startDate, endDate },
    totalRevenue,
    totalPurchases,
    totalSessions,
    purchaseConversionRate,
    averageOrderValue,
    revenuePerSession,
    reportViews,
    revenuePerReportView,
    debug: { notes },
  };
};

/* ═══════════════════════════════════════
   GA4: 데이터 품질 진단
   중복 URL, (not set) 비율, 파라미터 분산, purchase/checkout 비정상, page_view 누락 세션
   ═══════════════════════════════════════ */

export type GA4DataQualityIssue = {
  id: string;
  severity: "error" | "warning" | "info";
  title: string;
  detail: string;
  value: number;
};

export type GA4DataQualityResult = {
  range: { startDate: string; endDate: string };
  score: number;
  issues: GA4DataQualityIssue[];
  stats: {
    totalPagePaths: number;
    duplicateUrlGroups: number;
    notSetLandingRatio: number;
    queryParamPageRatio: number;
    purchaseCount: number;
    beginCheckoutCount: number;
    pageViewSessions: number;
    totalSessions: number;
    pageViewMissingRatio: number;
  };
  debug: { notes: string[] };
};

export const queryGA4DataQuality = async (params: {
  startDate: string;
  endDate: string;
}): Promise<GA4DataQualityResult> => {
  if (!env.GA4_PROPERTY_ID) throw new Error("GA4_PROPERTY_ID is not configured");

  const client = createGA4Client();
  const { startDate, endDate } = params;
  const notes: string[] = [];
  const issues: GA4DataQualityIssue[] = [];

  // 1) 페이지 경로 목록 (URL 중복 & 파라미터 분산 체크)
  const [pageRes] = await client.runReport({
    property: `properties/${env.GA4_PROPERTY_ID}`,
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: "pagePath" }],
    metrics: [{ name: "sessions" }],
    limit: 500,
    orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
  });

  const pagePaths = (pageRes.rows ?? []).map((r) => ({
    path: r.dimensionValues?.[0]?.value ?? "",
    sessions: toNumber(r.metricValues?.[0]?.value),
  }));
  const totalPagePaths = pagePaths.length;

  // 중복 URL 그룹 (trailing slash 차이)
  const normalizedMap = new Map<string, string[]>();
  for (const p of pagePaths) {
    const normalized = p.path.replace(/\/+$/, "").toLowerCase() || "/";
    if (!normalizedMap.has(normalized)) normalizedMap.set(normalized, []);
    normalizedMap.get(normalized)!.push(p.path);
  }
  const duplicateUrlGroups = [...normalizedMap.values()].filter((v) => v.length > 1).length;

  if (duplicateUrlGroups > 0) {
    const examples = [...normalizedMap.entries()]
      .filter(([, v]) => v.length > 1)
      .slice(0, 3)
      .map(([, v]) => v.join(" / "))
      .join("; ");
    issues.push({
      id: "duplicate_urls",
      severity: "warning",
      title: `중복 URL ${duplicateUrlGroups}그룹 발견`,
      detail: `trailing slash 등으로 같은 페이지가 분산됨. 예: ${examples}`,
      value: duplicateUrlGroups,
    });
  }

  // 쿼리 파라미터가 있는 페이지 비율
  const queryParamPages = pagePaths.filter((p) => p.path.includes("?")).length;
  const queryParamPageRatio = totalPagePaths > 0 ? +(queryParamPages / totalPagePaths).toFixed(3) : 0;
  if (queryParamPageRatio > 0.1) {
    issues.push({
      id: "query_param_dispersion",
      severity: "warning",
      title: `쿼리 파라미터 분산 ${(queryParamPageRatio * 100).toFixed(1)}%`,
      detail: `${queryParamPages}/${totalPagePaths} 페이지에 ?파라미터가 붙어 분산. 페이지 성과 집계가 흐려질 수 있음`,
      value: queryParamPageRatio,
    });
  }

  // 2) Landing page (not set) 비율
  const [landingRes] = await client.runReport({
    property: `properties/${env.GA4_PROPERTY_ID}`,
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: "landingPagePlusQueryString" }],
    metrics: [{ name: "sessions" }],
    limit: 500,
    orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
  });

  let notSetLandingSessions = 0;
  let totalLandingSessions = 0;
  for (const row of landingRes.rows ?? []) {
    const landing = row.dimensionValues?.[0]?.value ?? "";
    const sessions = toNumber(row.metricValues?.[0]?.value);
    totalLandingSessions += sessions;
    if (landing === "(not set)" || !landing) notSetLandingSessions += sessions;
  }
  const notSetLandingRatio = totalLandingSessions > 0 ? +(notSetLandingSessions / totalLandingSessions).toFixed(3) : 0;

  if (notSetLandingRatio > 0.05) {
    issues.push({
      id: "not_set_landing",
      severity: notSetLandingRatio > 0.15 ? "error" : "warning",
      title: `(not set) 랜딩 ${(notSetLandingRatio * 100).toFixed(1)}%`,
      detail: `${notSetLandingSessions}/${totalLandingSessions} 세션의 랜딩 페이지가 (not set). page_view 이벤트 누락 가능성`,
      value: notSetLandingRatio,
    });
  }

  // 3) purchase vs begin_checkout 비율 검증
  const [eventRes] = await client.runReport({
    property: `properties/${env.GA4_PROPERTY_ID}`,
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: "eventName" }],
    metrics: [{ name: "eventCount" }],
    dimensionFilter: {
      orGroup: {
        expressions: [
          { filter: { fieldName: "eventName", stringFilter: { matchType: "EXACT" as const, value: "purchase" } } },
          { filter: { fieldName: "eventName", stringFilter: { matchType: "EXACT" as const, value: "begin_checkout" } } },
          { filter: { fieldName: "eventName", stringFilter: { matchType: "EXACT" as const, value: "page_view" } } },
        ],
      },
    },
    limit: 10,
  });

  let purchaseCount = 0;
  let beginCheckoutCount = 0;
  let pageViewCount = 0;
  for (const row of eventRes.rows ?? []) {
    const event = row.dimensionValues?.[0]?.value ?? "";
    const count = toNumber(row.metricValues?.[0]?.value);
    if (event === "purchase") purchaseCount = count;
    else if (event === "begin_checkout") beginCheckoutCount = count;
    else if (event === "page_view") pageViewCount = count;
  }

  if (purchaseCount > 0 && beginCheckoutCount === 0) {
    issues.push({
      id: "checkout_missing",
      severity: "error",
      title: "begin_checkout 이벤트 누락",
      detail: `purchase ${purchaseCount}건이 있으나 begin_checkout이 0건. 결제 퍼널 추적 불가`,
      value: 0,
    });
  } else if (purchaseCount > beginCheckoutCount && beginCheckoutCount > 0) {
    issues.push({
      id: "checkout_anomaly",
      severity: "warning",
      title: `purchase(${purchaseCount}) > begin_checkout(${beginCheckoutCount})`,
      detail: "구매 수가 결제 시작보다 많음. 이벤트 중복 발화 또는 누락 가능성",
      value: purchaseCount - beginCheckoutCount,
    });
  }

  // 4) page_view가 없는 세션 비율 추정
  const [sessionRes] = await client.runReport({
    property: `properties/${env.GA4_PROPERTY_ID}`,
    dateRanges: [{ startDate, endDate }],
    metrics: [{ name: "sessions" }],
  });
  const totalSessions = toNumber(sessionRes.rows?.[0]?.metricValues?.[0]?.value);
  // page_view 이벤트가 있는 세션: screenPageViews > 0인 세션과 근사
  const pageViewSessions = totalSessions; // GA4에서는 정확한 비교가 어려움 — pageViewCount / totalSessions로 근사
  const avgPageViewsPerSession = totalSessions > 0 ? pageViewCount / totalSessions : 0;
  const pageViewMissingRatio = avgPageViewsPerSession < 1 ? +(1 - avgPageViewsPerSession).toFixed(3) : 0;

  if (pageViewMissingRatio > 0.1) {
    issues.push({
      id: "page_view_missing",
      severity: "warning",
      title: `page_view 부족 (세션당 ${avgPageViewsPerSession.toFixed(1)}회)`,
      detail: `세션 대비 page_view 비율이 낮음. Enhanced Measurement 설정 확인 필요`,
      value: pageViewMissingRatio,
    });
  }

  // 종합 점수 (100점 만점, 이슈당 감점)
  let score = 100;
  for (const issue of issues) {
    if (issue.severity === "error") score -= 20;
    else if (issue.severity === "warning") score -= 10;
    else score -= 5;
  }
  score = Math.max(0, score);

  notes.push(`총 ${issues.length}건 이슈 검출, 품질 점수 ${score}/100`);

  return {
    range: { startDate, endDate },
    score,
    issues,
    stats: {
      totalPagePaths,
      duplicateUrlGroups,
      notSetLandingRatio,
      queryParamPageRatio,
      purchaseCount,
      beginCheckoutCount,
      pageViewSessions,
      totalSessions,
      pageViewMissingRatio,
    },
    debug: { notes },
  };
};

/* ═══════════════════════════════════════
   GA4: 진짜 퍼널 — runFunnelReport (v1alpha)
   view_item → add_to_cart → begin_checkout → add_payment_info → purchase
   deviceCategory 분해 포함
   ═══════════════════════════════════════ */

const createAlphaGA4Client = (): AlphaAnalyticsDataClient => {
  if (!env.GA4_SERVICE_ACCOUNT_KEY) {
    throw new Error("GA4_SERVICE_ACCOUNT_KEY is not configured");
  }
  const credentials = parseServiceAccountKey(env.GA4_SERVICE_ACCOUNT_KEY);
  return new AlphaAnalyticsDataClient({ credentials });
};

export type GA4RealFunnelStep = {
  name: string;
  activeUsers: number;
  completionRate: number;
  abandonmentRate: number;
};

export type GA4RealFunnelDeviceRow = {
  device: string;
  steps: GA4RealFunnelStep[];
  overallConversion: number;
};

export type GA4RealFunnelResult = {
  range: { startDate: string; endDate: string };
  method: "runFunnelReport" | "eventCount_fallback";
  devices: GA4RealFunnelDeviceRow[];
  allDevices: {
    steps: GA4RealFunnelStep[];
    overallConversion: number;
  };
  debug: { notes: string[] };
};

const FUNNEL_STEP_DEFS = [
  { name: "상품 조회", event: "view_item" },
  { name: "장바구니", event: "add_to_cart" },
  { name: "결제 시작", event: "begin_checkout" },
  { name: "결제 정보 입력", event: "add_payment_info" },
  { name: "구매 완료", event: "purchase" },
];

export const queryGA4RealFunnel = async (params: {
  startDate: string;
  endDate: string;
}): Promise<GA4RealFunnelResult> => {
  if (!env.GA4_PROPERTY_ID) throw new Error("GA4_PROPERTY_ID is not configured");

  const { startDate, endDate } = params;
  const notes: string[] = [];

  // runFunnelReport 시도
  try {
    const alphaClient = createAlphaGA4Client();

    const funnelResponse = await alphaClient.runFunnelReport({
      property: `properties/${env.GA4_PROPERTY_ID}`,
      dateRanges: [{ startDate, endDate }],
      funnel: {
        isOpenFunnel: false,
        steps: FUNNEL_STEP_DEFS.map((s) => ({
          name: s.name,
          filterExpression: {
            funnelFieldFilter: {
              fieldName: "eventName",
              stringFilter: { matchType: "EXACT" as unknown as number, value: s.event },
            },
          },
        })),
      },
      funnelBreakdown: {
        breakdownDimension: { name: "deviceCategory" },
      },
    });
    const response = Array.isArray(funnelResponse) ? funnelResponse[0] : funnelResponse;

    // funnelTable 파싱
    const table = response.funnelTable;
    if (!table || !table.rows || table.rows.length === 0) {
      notes.push("runFunnelReport 응답에 데이터 없음 — eventCount fallback 사용");
      throw new Error("EMPTY_FUNNEL_RESPONSE");
    }

    // 헤더 분석
    const dimHeaders = (table.dimensionHeaders ?? []).map((h: { name?: string | null }) => h.name ?? "");
    const metHeaders = (table.metricHeaders ?? []).map((h: { name?: string | null }) => h.name ?? "");
    notes.push(`dimensions: [${dimHeaders.join(",")}], metrics: [${metHeaders.join(",")}]`);

    // funnelStepName이 dimension에, deviceCategory가 breakdown에 들어옴
    const stepNameIdx = dimHeaders.indexOf("funnelStepName");
    const deviceIdx = dimHeaders.indexOf("deviceCategory");
    // 메트릭 헤더는 중복될 수 있음 (funnelTable + funnelVisualization 합쳐짐)
    // 첫 번째 activeUsers, funnelStepCompletionRate, funnelStepAbandonmentRate를 사용
    const activeUsersIdx = metHeaders.indexOf("activeUsers");
    const completionIdx = metHeaders.indexOf("funnelStepCompletionRate");
    const abandonmentIdx = metHeaders.indexOf("funnelStepAbandonmentRate");

    // device → stepName → metrics
    const deviceStepMap = new Map<string, Map<string, { activeUsers: number; completionRate: number; abandonmentRate: number }>>();
    const allStepMap = new Map<string, { activeUsers: number; completionRate: number; abandonmentRate: number }>();

    // raw 샘플 로깅 (디버그)
    const sampleRows = (table.rows ?? []).slice(0, 3);
    for (const sr of sampleRows) {
      notes.push(
        `sample row: dims=[${(sr.dimensionValues ?? []).map((d: { value?: string | null }) => d.value).join(",")}] mets=[${(sr.metricValues ?? []).map((m: { value?: string | null }) => m.value).join(",")}]`,
      );
    }
    notes.push(`idx: step=${stepNameIdx}, device=${deviceIdx}, users=${activeUsersIdx}, completion=${completionIdx}, abandon=${abandonmentIdx}`);

    for (const row of table.rows) {
      const dims = row.dimensionValues ?? [];
      const mets = row.metricValues ?? [];

      const stepName = stepNameIdx >= 0 ? (dims[stepNameIdx]?.value ?? "") : "";
      const device = deviceIdx >= 0 ? (dims[deviceIdx]?.value ?? "all").toLowerCase() : "all";
      const activeUsers = activeUsersIdx >= 0 ? toNumber(mets[activeUsersIdx]?.value) : 0;
      const completionRate = completionIdx >= 0 ? toNumber(mets[completionIdx]?.value) : 0;
      const abandonmentRate = abandonmentIdx >= 0 ? toNumber(mets[abandonmentIdx]?.value) : 0;

      if (!stepName) continue;

      // device별 집계
      if (!deviceStepMap.has(device)) deviceStepMap.set(device, new Map());
      const existing = deviceStepMap.get(device)!.get(stepName);
      if (existing) {
        existing.activeUsers += activeUsers;
      } else {
        deviceStepMap.get(device)!.set(stepName, { activeUsers, completionRate, abandonmentRate });
      }

      // 전체 집계
      const allExisting = allStepMap.get(stepName);
      if (allExisting) {
        allExisting.activeUsers += activeUsers;
      } else {
        allStepMap.set(stepName, { activeUsers, completionRate, abandonmentRate });
      }
    }

    const buildSteps = (stepMap: Map<string, { activeUsers: number; completionRate: number; abandonmentRate: number }>): GA4RealFunnelStep[] => {
      return FUNNEL_STEP_DEFS.map((def, idx) => {
        // runFunnelReport는 스텝 이름에 번호를 붙여 반환 (예: "1. 상품 조회")
        const numberedKey = `${idx + 1}. ${def.name}`;
        const data = stepMap.get(numberedKey) ?? stepMap.get(def.name);
        return {
          name: def.name,
          activeUsers: data?.activeUsers ?? 0,
          completionRate: data ? +(data.completionRate * 100).toFixed(1) : 0,
          abandonmentRate: data ? +(data.abandonmentRate * 100).toFixed(1) : 0,
        };
      });
    };

    const calcOverall = (steps: GA4RealFunnelStep[]): number => {
      const first = steps[0]?.activeUsers ?? 0;
      const last = steps[steps.length - 1]?.activeUsers ?? 0;
      return first > 0 ? +((last / first) * 100).toFixed(2) : 0;
    };

    const devices: GA4RealFunnelDeviceRow[] = [];
    for (const [device, stepMap] of deviceStepMap) {
      // "all", "reserved_total" 등은 디바이스 목록에서 제외
      if (device === "all" || device.startsWith("reserved")) continue;
      const steps = buildSteps(stepMap);
      devices.push({ device, steps, overallConversion: calcOverall(steps) });
    }
    devices.sort((a, b) => {
      const order = ["mobile", "desktop", "tablet"];
      return (order.indexOf(a.device) === -1 ? 99 : order.indexOf(a.device)) -
        (order.indexOf(b.device) === -1 ? 99 : order.indexOf(b.device));
    });

    // allDevices: reserved_total이 있으면 사용, 없으면 전체 합산
    const reservedTotalMap = deviceStepMap.get("reserved_total");
    const allSteps = buildSteps(reservedTotalMap ?? allStepMap);
    notes.push(`runFunnelReport 성공: ${devices.length}개 디바이스, ${allSteps.length}단계`);

    return {
      range: { startDate, endDate },
      method: "runFunnelReport",
      devices,
      allDevices: { steps: allSteps, overallConversion: calcOverall(allSteps) },
      debug: { notes },
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg !== "EMPTY_FUNNEL_RESPONSE") {
      notes.push(`runFunnelReport 실패 (${msg}) — eventCount fallback 사용`);
    }

    // Fallback: 기존 eventCount 기반
    const fallback = await queryGA4EcommerceFunnelByDevice(params);
    return {
      range: { startDate, endDate },
      method: "eventCount_fallback",
      devices: fallback.devices.map((d) => ({
        device: d.device,
        steps: d.steps.map((s) => ({
          name: s.name,
          activeUsers: s.count,
          completionRate: s.conversionRate,
          abandonmentRate: +(100 - s.conversionRate).toFixed(1),
        })),
        overallConversion: d.overallConversion,
      })),
      allDevices: {
        steps: fallback.allDevices.steps.map((s) => ({
          name: s.name,
          activeUsers: s.count,
          completionRate: s.conversionRate,
          abandonmentRate: +(100 - s.conversionRate).toFixed(1),
        })),
        overallConversion: fallback.allDevices.overallConversion,
      },
      debug: { notes: [...notes, ...fallback.debug.notes] },
    };
  }
};

/* ═══════════════════════════════════════
   GA4: 구매 상위 상품 (item 기준)
   ═══════════════════════════════════════ */

export type GA4TopProductRow = {
  itemName: string;
  itemCategory: string;
  itemsViewed: number;
  itemsAddedToCart: number;
  itemsPurchased: number;
  itemRevenue: number;
  cartToViewRate: number;
  purchaseToViewRate: number;
};

export type GA4TopProductsResult = {
  range: { startDate: string; endDate: string };
  products: GA4TopProductRow[];
  debug: { notes: string[] };
};

export const queryGA4TopProducts = async (params: {
  startDate: string;
  endDate: string;
  limit?: number;
}): Promise<GA4TopProductsResult> => {
  if (!env.GA4_PROPERTY_ID) throw new Error("GA4_PROPERTY_ID is not configured");

  const client = createGA4Client();
  const { startDate, endDate } = params;
  const limit = Math.max(1, Math.min(50, params.limit ?? 10));
  const notes: string[] = [];

  const [res] = await client.runReport({
    property: `properties/${env.GA4_PROPERTY_ID}`,
    dateRanges: [{ startDate, endDate }],
    dimensions: [
      { name: "itemName" },
      { name: "itemCategory" },
    ],
    metrics: [
      { name: "itemsViewed" },
      { name: "itemsAddedToCart" },
      { name: "itemsPurchased" },
      { name: "itemRevenue" },
    ],
    limit,
    orderBys: [{ metric: { metricName: "itemRevenue" }, desc: true }],
  });

  const products: GA4TopProductRow[] = (res.rows ?? []).map((row) => {
    const dims = row.dimensionValues ?? [];
    const mets = row.metricValues ?? [];
    const itemName = dims[0]?.value ?? "(unknown)";
    const itemCategory = dims[1]?.value ?? "(not set)";
    const itemsViewed = toNumber(mets[0]?.value);
    const itemsAddedToCart = toNumber(mets[1]?.value);
    const itemsPurchased = toNumber(mets[2]?.value);
    const itemRevenue = toNumber(mets[3]?.value);
    return {
      itemName,
      itemCategory,
      itemsViewed,
      itemsAddedToCart,
      itemsPurchased,
      itemRevenue,
      cartToViewRate: itemsViewed > 0 ? +((itemsAddedToCart / itemsViewed) * 100).toFixed(1) : 0,
      purchaseToViewRate: itemsViewed > 0 ? +((itemsPurchased / itemsViewed) * 100).toFixed(1) : 0,
    };
  });

  notes.push(`매출 상위 ${products.length}개 상품 반환`);

  return {
    range: { startDate, endDate },
    products,
    debug: { notes },
  };
};

/* ═══════════════════════════════════════
   GA4: 소스별 매출/전환 통합 리포트
   "어디서 온 유입이 돈이 되는가" 핵심 리포트
   ═══════════════════════════════════════ */

export type GA4SourceConversionRow = {
  sessionSource: string;
  sessionMedium: string;
  sessions: number;
  totalUsers: number;
  ecommercePurchases: number;
  grossPurchaseRevenue: number;
  purchaseConversionRate: number;
  revenuePerSession: number;
  /** tiktok/meta/google/naver/direct/ai/other */
  channel: string;
};

export type GA4SourceConversionResult = {
  range: { startDate: string; endDate: string };
  rows: GA4SourceConversionRow[];
  byChannel: Array<{
    channel: string;
    sessions: number;
    purchases: number;
    revenue: number;
    conversionRate: number;
    revenuePerSession: number;
  }>;
  debug: { notes: string[] };
};

const classifyChannel = (source: string): string => {
  const s = (source ?? "").toLowerCase();
  if (s.startsWith("tiktok") || s.includes("tiktok")) return "tiktok";
  if (s.startsWith("meta") || s.includes("facebook") || s.includes("instagram") || s.includes("meta_")) return "meta";
  if (s === "google" || s.includes("google")) return "google";
  if (s.includes("naver") || s.startsWith("naverbrand")) return "naver";
  if (s === "(direct)" || s === "direct") return "direct";
  if (s.includes("chatgpt") || s.includes("claude") || s.includes("perplexity") || s.includes("gemini") || s.includes("openai")) return "ai";
  if (s === "(not set)" || !s) return "not_set";
  return "other";
};

export const queryGA4SourceConversion = async (params: {
  startDate: string;
  endDate: string;
  limit?: number;
}): Promise<GA4SourceConversionResult> => {
  if (!env.GA4_PROPERTY_ID) throw new Error("GA4_PROPERTY_ID is not configured");

  const client = createGA4Client();
  const { startDate, endDate } = params;
  const limit = Math.max(1, Math.min(500, params.limit ?? 100));
  const notes: string[] = [];

  // GA4 Data API 10 metrics 제한 → 2회 분리
  const [mainRes] = await client.runReport({
    property: `properties/${env.GA4_PROPERTY_ID}`,
    dateRanges: [{ startDate, endDate }],
    dimensions: [
      { name: "sessionSource" },
      { name: "sessionMedium" },
    ],
    metrics: [
      { name: "sessions" },
      { name: "totalUsers" },
      { name: "ecommercePurchases" },
      { name: "grossPurchaseRevenue" },
    ],
    limit,
    orderBys: [{ metric: { metricName: "grossPurchaseRevenue" }, desc: true }],
  });

  const rows: GA4SourceConversionRow[] = (mainRes.rows ?? []).map((row) => {
    const dims = row.dimensionValues ?? [];
    const mets = row.metricValues ?? [];
    const sessionSource = dims[0]?.value ?? "(not set)";
    const sessionMedium = dims[1]?.value ?? "(none)";
    const sessions = toNumber(mets[0]?.value);
    const totalUsers = toNumber(mets[1]?.value);
    const ecommercePurchases = toNumber(mets[2]?.value);
    const grossPurchaseRevenue = toNumber(mets[3]?.value);

    return {
      sessionSource,
      sessionMedium,
      sessions,
      totalUsers,
      ecommercePurchases,
      grossPurchaseRevenue,
      purchaseConversionRate: sessions > 0 ? +((ecommercePurchases / sessions) * 100).toFixed(2) : 0,
      revenuePerSession: sessions > 0 ? Math.round(grossPurchaseRevenue / sessions) : 0,
      channel: classifyChannel(sessionSource),
    };
  });

  // 채널별 집계
  const channelMap = new Map<string, { sessions: number; purchases: number; revenue: number }>();
  for (const row of rows) {
    const ch = row.channel;
    if (!channelMap.has(ch)) channelMap.set(ch, { sessions: 0, purchases: 0, revenue: 0 });
    const c = channelMap.get(ch)!;
    c.sessions += row.sessions;
    c.purchases += row.ecommercePurchases;
    c.revenue += row.grossPurchaseRevenue;
  }

  const byChannel = [...channelMap.entries()]
    .map(([channel, data]) => ({
      channel,
      sessions: data.sessions,
      purchases: data.purchases,
      revenue: data.revenue,
      conversionRate: data.sessions > 0 ? +((data.purchases / data.sessions) * 100).toFixed(2) : 0,
      revenuePerSession: data.sessions > 0 ? Math.round(data.revenue / data.sessions) : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  notes.push(`${rows.length}개 소스/매체, ${byChannel.length}개 채널로 분류`);

  return {
    range: { startDate, endDate },
    rows,
    byChannel,
    debug: { notes },
  };
};

export type GA4NotSetDailyRevenueRow = {
  date: string;
  ecommercePurchases: number;
  grossPurchaseRevenue: number;
};

export type GA4NotSetDailyRevenueResult = {
  range: { startDate: string; endDate: string };
  rows: GA4NotSetDailyRevenueRow[];
  totals: {
    ecommercePurchases: number;
    grossPurchaseRevenue: number;
  };
};

const normalizeGa4Date = (value: string): string => {
  const cleaned = (value ?? "").trim();
  if (/^\d{8}$/.test(cleaned)) {
    return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 6)}-${cleaned.slice(6, 8)}`;
  }
  return cleaned;
};

export const queryGA4NotSetDailyRevenue = async (params: {
  startDate: string;
  endDate: string;
}): Promise<GA4NotSetDailyRevenueResult> => {
  if (!env.GA4_PROPERTY_ID) throw new Error("GA4_PROPERTY_ID is not configured");

  const client = createGA4Client();
  const { startDate, endDate } = params;

  const [report] = await client.runReport({
    property: `properties/${env.GA4_PROPERTY_ID}`,
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: "date" }],
    metrics: [{ name: "ecommercePurchases" }, { name: "grossPurchaseRevenue" }],
    dimensionFilter: {
      filter: {
        fieldName: "sessionSource",
        stringFilter: { matchType: "EXACT" as const, value: "(not set)" },
      },
    },
    orderBys: [{ dimension: { dimensionName: "date" } }],
    limit: 400,
  });

  const rows: GA4NotSetDailyRevenueRow[] = (report.rows ?? []).map((row) => ({
    date: normalizeGa4Date(row.dimensionValues?.[0]?.value ?? ""),
    ecommercePurchases: toNumber(row.metricValues?.[0]?.value),
    grossPurchaseRevenue: toNumber(row.metricValues?.[1]?.value),
  }));

  return {
    range: { startDate, endDate },
    rows,
    totals: {
      ecommercePurchases: rows.reduce((sum, row) => sum + row.ecommercePurchases, 0),
      grossPurchaseRevenue: rows.reduce((sum, row) => sum + row.grossPurchaseRevenue, 0),
    },
  };
};

/* ═══════════════════════════════════════
   GA4: SEO 전환 숫자 역전 진단
   "왜 유입보다 purchase가 더 커 보이는가"를 같은 화면에서 설명하는 진단 리포트
   ═══════════════════════════════════════ */

export type GA4SeoConversionDiagnosticIssue = {
  id: string;
  severity: "error" | "warning" | "info";
  title: string;
  summary: string;
  whyItHappens: string;
  signals: Array<{ label: string; value: string }>;
  checks: string[];
};

export type GA4SeoConversionDiagnosticInputs = {
  range: { startDate: string; endDate: string };
  organicSessionScope: {
    sessions: number;
    entrances: number;
    ecommercePurchases: number;
    keyEvents: number;
    grossPurchaseRevenue: number;
  };
  organicFirstUserScope: {
    totalUsers: number;
    ecommercePurchases: number;
    grossPurchaseRevenue: number;
  };
  queryStringSignals: {
    shopViewPathViews: number;
    shopViewVariantCount: number;
    shopViewVariantViews: number;
    topShopViewVariants: Array<{ path: string; pageViews: number }>;
  };
  sourceSignals: {
    notSetRevenue: number;
    notSetPurchases: number;
    selfReferralRevenue: number;
    selfReferralPurchases: number;
    suspiciousSources: string[];
  };
  funnelSignals: {
    method: "runFunnelReport" | "eventCount_fallback";
    purchaseUsers: number;
    totalPurchases: number;
  };
  dataQualitySignals: {
    notSetLandingRatio: number;
  };
  transactionSignals: {
    distinctTransactionIds: number;
    totalPurchaseEvents: number;
    blankTransactionEvents: number;
    duplicatePurchaseEvents: number;
    transactionCoverageRatio: number;
  };
  debugNotes?: string[];
};

export type GA4SeoConversionDiagnosticResult = {
  range: { startDate: string; endDate: string };
  summary: GA4SeoConversionDiagnosticInputs;
  issues: GA4SeoConversionDiagnosticIssue[];
  recommendedChecks: string[];
  debug: { notes: string[] };
};

const fmtInt = (value: number) => Math.round(value).toLocaleString("ko-KR");
const fmtWon = (value: number) => `₩${Math.round(value).toLocaleString("ko-KR")}`;
const fmtPctFromFraction = (value: number, digits: number = 1) => `${(value * 100).toFixed(digits)}%`;
const fmtPctPoint = (value: number) => `${value >= 0 ? "+" : ""}${value.toFixed(1)}%p`;

export const buildGA4SeoConversionDiagnostic = (
  input: GA4SeoConversionDiagnosticInputs,
): GA4SeoConversionDiagnosticResult => {
  const notes = [...(input.debugNotes ?? [])];
  const issues: GA4SeoConversionDiagnosticIssue[] = [];

  const purchaseVsSessionGap = input.organicSessionScope.sessions > 0
    ? ((input.organicSessionScope.ecommercePurchases - input.organicSessionScope.sessions) / input.organicSessionScope.sessions) * 100
    : 0;
  const keyEventVsSessionGap = input.organicSessionScope.sessions > 0
    ? ((input.organicSessionScope.keyEvents - input.organicSessionScope.sessions) / input.organicSessionScope.sessions) * 100
    : 0;

  issues.push({
    id: "session_event_scope_mix",
    severity:
      input.organicSessionScope.ecommercePurchases > input.organicSessionScope.sessions ||
      input.organicSessionScope.keyEvents > input.organicSessionScope.sessions
        ? "warning"
        : "info",
    title: "세션과 이벤트를 섞어 보고 있을 가능성",
    summary:
      input.organicSessionScope.ecommercePurchases > input.organicSessionScope.sessions ||
      input.organicSessionScope.keyEvents > input.organicSessionScope.sessions
        ? "Organic Search 기준으로 세션보다 구매나 key event가 더 크게 보인다. 이 경우 버그처럼 보여도, 상당수는 세션 분모와 이벤트 횟수를 직접 비교해서 생기는 해석 문제다."
        : "지금 숫자가 바로 역전되지는 않아도, Organic Search의 세션·구매·key event는 성격이 다른 분모다. 같은 표에 두더라도 직접 나눠 읽으면 쉽게 오해가 생긴다.",
    whyItHappens:
      "GA4의 session은 방문 묶음이고, purchase/key event는 발생 횟수다. 한 세션 안에서 이벤트가 여러 번 일어나면 purchase 또는 key event가 sessions보다 커 보일 수 있다.",
    signals: [
      { label: "Organic Search 세션", value: `${fmtInt(input.organicSessionScope.sessions)}회` },
      { label: "Organic Search 구매", value: `${fmtInt(input.organicSessionScope.ecommercePurchases)}회` },
      { label: "Organic Search key event", value: `${fmtInt(input.organicSessionScope.keyEvents)}회` },
      { label: "구매 - 세션 차이", value: fmtPctPoint(purchaseVsSessionGap) },
      { label: "key event - 세션 차이", value: fmtPctPoint(keyEventVsSessionGap) },
    ],
    checks: [
      "Explore에서는 Sessions, Ecommerce purchases, Key events를 같은 표에 두되 같은 분모처럼 읽지 않는다.",
      "퍼널은 session 기반 funnel 또는 같은 scope의 table로 별도 본다.",
      "purchase 수가 많아 보여도 주문번호 기준 dedupe가 되는지 같이 본다.",
    ],
  });

  const firstUserPurchaseDelta = input.organicSessionScope.ecommercePurchases - input.organicFirstUserScope.ecommercePurchases;
  const firstUserRevenueDelta = input.organicSessionScope.grossPurchaseRevenue - input.organicFirstUserScope.grossPurchaseRevenue;
  const acquisitionSeverity =
    Math.abs(firstUserPurchaseDelta) >= Math.max(10, input.organicSessionScope.ecommercePurchases * 0.1) ||
    Math.abs(firstUserRevenueDelta) >= Math.max(1_000_000, input.organicSessionScope.grossPurchaseRevenue * 0.1)
      ? "warning"
      : "info";

  issues.push({
    id: "acquisition_scope_mismatch",
    severity: acquisitionSeverity,
    title: "User acquisition과 Traffic acquisition을 섞어 봤을 가능성",
    summary:
      acquisitionSeverity === "warning"
        ? "세션 기준 Organic Search와 최초 유입 기준 Organic Search의 구매/매출 차이가 작지 않다. 이 둘을 같은 기준으로 나란히 보면 유입보다 전환이 더 커 보이는 착시가 생길 수 있다."
        : "세션 기준과 최초 유입 기준의 차이가 아주 크지는 않지만, 둘은 scope가 달라 직접 비교하면 안 된다.",
    whyItHappens:
      "Session source는 이번 방문의 유입을 보고, First user source는 사용자의 첫 유입을 본다. Organic Search 성과를 볼 때는 보통 Traffic acquisition의 Session source/medium 기준으로 통일하는 편이 안전하다.",
    signals: [
      { label: "세션 기준 Organic 구매", value: `${fmtInt(input.organicSessionScope.ecommercePurchases)}회` },
      { label: "최초 유입 기준 Organic 구매", value: `${fmtInt(input.organicFirstUserScope.ecommercePurchases)}회` },
      { label: "세션 기준 Organic 매출", value: fmtWon(input.organicSessionScope.grossPurchaseRevenue) },
      { label: "최초 유입 기준 Organic 매출", value: fmtWon(input.organicFirstUserScope.grossPurchaseRevenue) },
    ],
    checks: [
      "SEO 유입 성과는 Traffic acquisition의 Session source / medium 또는 Session default channel group = Organic Search로 통일한다.",
      "User acquisition은 ‘처음 어디서 왔는가’를 보는 별도 리포트로 분리한다.",
    ],
  });

  issues.push({
    id: "query_string_collapse",
    severity: input.queryStringSignals.shopViewVariantCount > 1 ? "warning" : "info",
    title: "상품 상세가 Page path에서 뭉개지고 있을 가능성",
    summary:
      input.queryStringSignals.shopViewVariantCount > 1
        ? "/shop_view는 실제로 여러 query string 변형이 있는데, page path만 보면 전부 /shop_view로 뭉개진다. 윗단 유입은 합쳐지고, 아랫단 구매는 상품 단위로 따로 잡혀 퍼널이 어색해질 수 있다."
        : "/shop_view query string 분산이 현재는 크게 보이지 않지만, 제품 단위 SEO 랜딩을 볼 때는 여전히 landing page + query string 기준이 더 안전하다.",
    whyItHappens:
      "GA4의 pagePath는 query string을 떼어낸다. 반면 실제 상품 상세는 /shop_view/?idx=... 형태라, pagePath만 보면 제품별 랜딩이 한 줄로 뭉개진다.",
    signals: [
      { label: "/shop_view pagePath 조회수", value: `${fmtInt(input.queryStringSignals.shopViewPathViews)}회` },
      { label: "/shop_view 쿼리 변형 수", value: `${fmtInt(input.queryStringSignals.shopViewVariantCount)}개` },
      { label: "쿼리 포함 조회수 합", value: `${fmtInt(input.queryStringSignals.shopViewVariantViews)}회` },
      {
        label: "대표 variant",
        value: input.queryStringSignals.topShopViewVariants
          .slice(0, 3)
          .map((row) => `${row.path} (${fmtInt(row.pageViews)})`)
          .join(" · ") || "없음",
      },
    ],
    checks: [
      "상품 단위 SEO 랜딩은 Page path가 아니라 Landing page + query string 또는 Page path + query string으로 본다.",
      "/shop_view/?idx=... 페이지를 제품별로 분리해 table과 path를 다시 본다.",
    ],
  });

  const crossDomainSuspicious =
    (input.funnelSignals.totalPurchases > 0 && input.funnelSignals.purchaseUsers === 0) ||
    input.sourceSignals.notSetRevenue > 0 ||
    input.sourceSignals.selfReferralRevenue > 0;

  issues.push({
    id: "cross_domain_pg_break",
    severity: crossDomainSuspicious ? "error" : "info",
    title: "cross-domain 또는 PG 리다이렉트로 세션이 끊겼을 가능성",
    summary: crossDomainSuspicious
      ? "실제 구매는 잡히는데 runFunnelReport의 purchase 단계가 비어 있거나, (not set)·자사 도메인 referral 매출이 보여 세션 귀속이 중간에 끊겼을 가능성이 높다."
      : "아직 명확한 cross-domain 단절 신호는 크지 않지만, PG 왕복 구조가 있다면 가장 먼저 의심해야 하는 영역이다.",
    whyItHappens:
      "biocom.kr, www.biocom.kr, biocom.imweb.me, PG 완료 도메인이 섞여 있으면 쿠키와 세션이 다시 만들어질 수 있다. 이 경우 상단 랜딩과 하단 purchase가 같은 흐름으로 이어지지 않는다.",
    signals: [
      { label: "runFunnelReport purchase", value: `${fmtInt(input.funnelSignals.purchaseUsers)}명` },
      { label: "실제 ecommercePurchases", value: `${fmtInt(input.funnelSignals.totalPurchases)}회` },
      { label: "(not set) 매출", value: fmtWon(input.sourceSignals.notSetRevenue) },
      { label: "자사/Imweb referral 매출", value: fmtWon(input.sourceSignals.selfReferralRevenue) },
      {
        label: "의심 소스",
        value: input.sourceSignals.suspiciousSources.slice(0, 4).join(" · ") || "없음",
      },
    ],
    checks: [
      "GA4 Configure your domains에 biocom.kr, www.biocom.kr, biocom.imweb.me, 실제 PG 완료 도메인을 모두 넣는다.",
      "DebugView에서 begin_checkout -> purchase 사이에 source/medium이 바뀌는지 확인한다.",
      "결제 완료 페이지에서 purchase 이벤트가 어느 도메인에서 발화하는지 브라우저로 직접 본다.",
    ],
  });

  const notSetSeverity =
    input.dataQualitySignals.notSetLandingRatio >= 0.15
      ? "error"
      : input.dataQualitySignals.notSetLandingRatio >= 0.05
        ? "warning"
        : "info";
  issues.push({
    id: "landing_not_set",
    severity: notSetSeverity,
    title: "landing page (not set) 때문에 퍼널 분모가 줄고 있을 가능성",
    summary:
      notSetSeverity === "info"
        ? "landing page (not set) 비율은 낮은 편이지만, SEO 랜딩 분모를 해석할 때는 항상 같이 봐야 한다."
        : "landing page (not set) 비율이 무시하기 어려운 수준이다. SEO 랜딩 퍼널의 첫 단계가 이미 일부 사라졌을 수 있다.",
    whyItHappens:
      "landing page는 세션의 첫 page_view를 기준으로 잡힌다. 세션에 page_view가 없거나 첫 페이지가 제대로 기록되지 않으면 landing page가 (not set)으로 남는다.",
    signals: [
      { label: "(not set) 랜딩 비율", value: fmtPctFromFraction(input.dataQualitySignals.notSetLandingRatio) },
      { label: "(not set) 매출", value: fmtWon(input.sourceSignals.notSetRevenue) },
      { label: "(not set) 구매", value: `${fmtInt(input.sourceSignals.notSetPurchases)}회` },
    ],
    checks: [
      "첫 page_view가 빠지는 페이지가 있는지 확인한다.",
      "landing page 기준 퍼널은 (not set) 행을 별도로 떼어 보고 비중이 줄어드는지 모니터링한다.",
    ],
  });

  const transactionSeverity =
    input.transactionSignals.blankTransactionEvents > 0 ||
    input.transactionSignals.duplicatePurchaseEvents > 0 ||
    input.transactionSignals.transactionCoverageRatio < 0.95
      ? "warning"
      : "info";
  issues.push({
    id: "transaction_id_quality",
    severity: transactionSeverity,
    title: "purchase 중복 또는 transaction_id 품질 문제 가능성",
    summary:
      transactionSeverity === "warning"
        ? "transaction_id가 비어 있거나, 같은 transaction_id에 purchase가 여러 번 찍힌 흔적이 있다. 이 경우 purchase 수가 실제 주문 수보다 커질 수 있다."
        : "transaction_id 기준으로는 현재 큰 중복 신호가 보이지 않는다. 그래도 주문번호 기준 대조는 계속 필요하다.",
    whyItHappens:
      "GA4는 같은 transaction_id의 purchase를 deduplicate한다. 반대로 transaction_id가 비어 있거나 이상하면 purchase 집계가 흔들릴 수 있다.",
    signals: [
      { label: "고유 transaction_id", value: `${fmtInt(input.transactionSignals.distinctTransactionIds)}개` },
      { label: "purchase 이벤트 수", value: `${fmtInt(input.transactionSignals.totalPurchaseEvents)}회` },
      { label: "transaction_id 없는 purchase", value: `${fmtInt(input.transactionSignals.blankTransactionEvents)}회` },
      { label: "중복 purchase 의심", value: `${fmtInt(input.transactionSignals.duplicatePurchaseEvents)}회` },
      { label: "transaction_id 커버리지", value: fmtPctFromFraction(input.transactionSignals.transactionCoverageRatio) },
    ],
    checks: [
      "주문번호를 transaction_id로 일관되게 보내는지 확인한다.",
      "GA4 purchase 수와 주문번호 유니크 건수를 같은 기간으로 대조한다.",
    ],
  });

  issues.push({
    id: "path_exploration_scope",
    severity: "info",
    title: "Path exploration은 같은 세션 퍼널처럼 읽으면 안 됨",
    summary:
      "Path exploration은 한 세션 안의 폐쇄형 퍼널이 아니라 여러 세션에 걸친 행동 흐름도 섞일 수 있다. 그래서 later step이 더 크게 보이는 화면이 나와도 바로 버그로 단정하면 안 된다.",
    whyItHappens:
      "Path는 흐름 탐색용이고, 전환율 퍼널은 funnel report나 같은 scope의 table로 따로 봐야 한다.",
    signals: [
      { label: "권장 용도", value: "행동 흐름 탐색" },
      { label: "비권장 용도", value: "같은 세션 전환율 퍼널로 단정" },
    ],
    checks: [
      "같은 세션 퍼널은 Funnel exploration 또는 session scope table로 다시 본다.",
      "Path exploration은 drop-off 지점 가설을 찾는 용도로만 쓴다.",
    ],
  });

  const recommendedChecks = [
    "같은 범위로 다시 만든다: Session default channel group = Organic Search, Session source / medium, Landing page + query string, Sessions / Entrances / Ecommerce purchases / Key events / Total revenue",
    "/shop_view를 제품 단위로 쪼갠다: Page path 대신 Page path + query string 또는 Landing page + query string으로 본다.",
    "live purchase 1건을 DebugView 또는 Realtime으로 태워 view_item -> add_to_cart -> begin_checkout -> add_payment_info -> purchase, source/medium 변화, referral domain, transaction_id를 확인한다.",
    "GA4 Configure your domains에서 biocom.kr, www.biocom.kr, biocom.imweb.me, 실제 PG 완료 도메인을 모두 점검한다.",
    "주문번호 기준 transaction_id 유니크 건수를 보고 GA4 purchase 수와 대조한다.",
  ];

  notes.push(`SEO 전환 진단 이슈 ${issues.length}건 생성`);

  return {
    range: input.range,
    summary: input,
    issues,
    recommendedChecks,
    debug: { notes },
  };
};

export const queryGA4SeoConversionDiagnostic = async (params: {
  startDate: string;
  endDate: string;
}): Promise<GA4SeoConversionDiagnosticResult> => {
  if (!env.GA4_PROPERTY_ID) throw new Error("GA4_PROPERTY_ID is not configured");

  const client = createGA4Client();
  const { startDate, endDate } = params;
  const notes: string[] = [];

  const organicSessionFilter = {
    filter: {
      fieldName: "sessionDefaultChannelGroup",
      stringFilter: { matchType: "EXACT" as const, value: "Organic Search" },
    },
  };
  const organicFirstUserFilter = {
    filter: {
      fieldName: "firstUserDefaultChannelGroup",
      stringFilter: { matchType: "EXACT" as const, value: "Organic Search" },
    },
  };

  const [organicMainRes] = await client.runReport({
    property: `properties/${env.GA4_PROPERTY_ID}`,
    dateRanges: [{ startDate, endDate }],
    metrics: [
      { name: "sessions" },
      { name: "ecommercePurchases" },
      { name: "grossPurchaseRevenue" },
    ],
    dimensionFilter: organicSessionFilter,
  });

  const organicSessions = toNumber(organicMainRes.rows?.[0]?.metricValues?.[0]?.value);
  const organicPurchases = toNumber(organicMainRes.rows?.[0]?.metricValues?.[1]?.value);
  const organicRevenue = toNumber(organicMainRes.rows?.[0]?.metricValues?.[2]?.value);

  let organicEntrances = organicSessions;
  try {
    const [entrancesRes] = await client.runReport({
      property: `properties/${env.GA4_PROPERTY_ID}`,
      dateRanges: [{ startDate, endDate }],
      metrics: [{ name: "entrances" }],
      dimensionFilter: organicSessionFilter,
    });
    organicEntrances = toNumber(entrancesRes.rows?.[0]?.metricValues?.[0]?.value);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    notes.push(`entrances metric 조회 실패 (${message}) — sessions로 대체`);
  }

  let organicKeyEvents = 0;
  try {
    const [keyEventRes] = await client.runReport({
      property: `properties/${env.GA4_PROPERTY_ID}`,
      dateRanges: [{ startDate, endDate }],
      metrics: [{ name: "keyEvents" }],
      dimensionFilter: organicSessionFilter,
    });
    organicKeyEvents = toNumber(keyEventRes.rows?.[0]?.metricValues?.[0]?.value);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    notes.push(`keyEvents metric 조회 실패 (${message}) — conversions metric으로 fallback`);
    const [convRes] = await client.runReport({
      property: `properties/${env.GA4_PROPERTY_ID}`,
      dateRanges: [{ startDate, endDate }],
      metrics: [{ name: "conversions" }],
      dimensionFilter: organicSessionFilter,
    });
    organicKeyEvents = toNumber(convRes.rows?.[0]?.metricValues?.[0]?.value);
  }

  const [organicFirstUserRes] = await client.runReport({
    property: `properties/${env.GA4_PROPERTY_ID}`,
    dateRanges: [{ startDate, endDate }],
    metrics: [
      { name: "totalUsers" },
      { name: "ecommercePurchases" },
      { name: "grossPurchaseRevenue" },
    ],
    dimensionFilter: organicFirstUserFilter,
  });
  const organicFirstUsers = toNumber(organicFirstUserRes.rows?.[0]?.metricValues?.[0]?.value);
  const organicFirstUserPurchases = toNumber(organicFirstUserRes.rows?.[0]?.metricValues?.[1]?.value);
  const organicFirstUserRevenue = toNumber(organicFirstUserRes.rows?.[0]?.metricValues?.[2]?.value);

  const [shopViewRes, shopViewVariantRes] = await Promise.all([
    client.runReport({
      property: `properties/${env.GA4_PROPERTY_ID}`,
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: "pagePath" }],
      metrics: [{ name: "screenPageViews" }],
      dimensionFilter: {
        filter: {
          fieldName: "pagePath",
          stringFilter: { matchType: "FULL_REGEXP" as const, value: "^/shop_view/?$" },
        },
      },
      limit: 10,
    }),
    client.runReport({
      property: `properties/${env.GA4_PROPERTY_ID}`,
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: "pagePathPlusQueryString" }],
      metrics: [{ name: "screenPageViews" }],
      dimensionFilter: {
        filter: {
          fieldName: "pagePathPlusQueryString",
          stringFilter: { matchType: "FULL_REGEXP" as const, value: "^/shop_view\\?.+" },
        },
      },
      limit: 20,
      orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
    }),
  ]);

  const shopViewPathViews = (shopViewRes[0].rows ?? []).reduce(
    (sum, row) => sum + toNumber(row.metricValues?.[0]?.value),
    0,
  );
  const topShopViewVariants = (shopViewVariantRes[0].rows ?? []).map((row) => ({
    path: row.dimensionValues?.[0]?.value ?? "",
    pageViews: toNumber(row.metricValues?.[0]?.value),
  }));
  const shopViewVariantViews = topShopViewVariants.reduce((sum, row) => sum + row.pageViews, 0);
  const shopViewVariantCount = topShopViewVariants.length;

  const [dataQuality, realFunnel, sourceConversion] = await Promise.all([
    queryGA4DataQuality({ startDate, endDate }),
    queryGA4RealFunnel({ startDate, endDate }),
    queryGA4SourceConversion({ startDate, endDate, limit: 150 }),
  ]);

  const suspiciousDomains = ["biocom.kr", "www.biocom.kr", "biocom.imweb.me", "imweb.me"];
  const notSetRows = sourceConversion.rows.filter((row) => row.channel === "not_set" || row.sessionSource === "(not set)");
  const selfReferralRows = sourceConversion.rows.filter((row) =>
    suspiciousDomains.some((domain) => row.sessionSource.toLowerCase().includes(domain)),
  );

  const notSetRevenue = notSetRows.reduce((sum, row) => sum + row.grossPurchaseRevenue, 0);
  const notSetPurchases = notSetRows.reduce((sum, row) => sum + row.ecommercePurchases, 0);
  const selfReferralRevenue = selfReferralRows.reduce((sum, row) => sum + row.grossPurchaseRevenue, 0);
  const selfReferralPurchases = selfReferralRows.reduce((sum, row) => sum + row.ecommercePurchases, 0);
  const suspiciousSources = [...new Set([
    ...notSetRows.map((row) => row.sessionSource),
    ...selfReferralRows.map((row) => row.sessionSource),
  ])].filter(Boolean);

  const funnelPurchaseUsers = realFunnel.allDevices.steps[realFunnel.allDevices.steps.length - 1]?.activeUsers ?? 0;

  let distinctTransactionIds = 0;
  let totalPurchaseEvents = 0;
  let blankTransactionEvents = 0;
  let duplicatePurchaseEvents = 0;
  try {
    const [transactionRes] = await client.runReport({
      property: `properties/${env.GA4_PROPERTY_ID}`,
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: "transactionId" }],
      metrics: [{ name: "eventCount" }],
      dimensionFilter: {
        filter: {
          fieldName: "eventName",
          stringFilter: { matchType: "EXACT" as const, value: "purchase" },
        },
      },
      limit: 10000,
      orderBys: [{ metric: { metricName: "eventCount" }, desc: true }],
    });

    for (const row of transactionRes.rows ?? []) {
      const transactionId = row.dimensionValues?.[0]?.value ?? "";
      const eventCount = toNumber(row.metricValues?.[0]?.value);
      const normalized = transactionId.trim().toLowerCase();
      const isBlank = !normalized || normalized === "(not set)" || normalized === "not set";
      totalPurchaseEvents += eventCount;
      if (isBlank) {
        blankTransactionEvents += eventCount;
        continue;
      }
      distinctTransactionIds += 1;
      if (eventCount > 1) duplicatePurchaseEvents += eventCount - 1;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    notes.push(`transactionId 진단 조회 실패 (${message}) — coverage 0 처리`);
  }

  const transactionCoverageRatio = totalPurchaseEvents > 0
    ? Math.min(1, distinctTransactionIds / totalPurchaseEvents)
    : 0;

  return buildGA4SeoConversionDiagnostic({
    range: { startDate, endDate },
    organicSessionScope: {
      sessions: organicSessions,
      entrances: organicEntrances,
      ecommercePurchases: organicPurchases,
      keyEvents: organicKeyEvents,
      grossPurchaseRevenue: organicRevenue,
    },
    organicFirstUserScope: {
      totalUsers: organicFirstUsers,
      ecommercePurchases: organicFirstUserPurchases,
      grossPurchaseRevenue: organicFirstUserRevenue,
    },
    queryStringSignals: {
      shopViewPathViews,
      shopViewVariantCount,
      shopViewVariantViews,
      topShopViewVariants,
    },
    sourceSignals: {
      notSetRevenue,
      notSetPurchases,
      selfReferralRevenue,
      selfReferralPurchases,
      suspiciousSources,
    },
    funnelSignals: {
      method: realFunnel.method,
      purchaseUsers: funnelPurchaseUsers,
      totalPurchases: organicPurchases,
    },
    dataQualitySignals: {
      notSetLandingRatio: dataQuality.stats.notSetLandingRatio,
    },
    transactionSignals: {
      distinctTransactionIds,
      totalPurchaseEvents,
      blankTransactionEvents,
      duplicatePurchaseEvents,
      transactionCoverageRatio,
    },
    debugNotes: [
      ...notes,
      ...dataQuality.debug.notes,
      ...realFunnel.debug.notes,
      ...sourceConversion.debug.notes,
    ],
  });
};
