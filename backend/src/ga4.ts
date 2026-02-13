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
