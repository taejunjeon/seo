import express, { type Request, type Response } from "express";

import { cacheGetJson, cacheSetJson } from "../cache/cache";
import { queryGscSearchAnalytics } from "../gsc";
import { resolveIsoDateRange } from "../dateRange";
import { daysAgo, toDateString } from "../utils/dateUtils";
import { makeEmptyMeta, makeLiveMeta, isGa4CredentialError } from "../utils/ga4Meta";
import { AI_REFERRAL_SOURCE_PATTERNS_ALLOWLIST } from "../config/ai-referrers";
import {
  queryGA4AiTrafficDetailed,
  queryGA4AiTrafficUserType,
  queryGA4AiConversionFunnel,
  queryGA4AiVsOrganicReport,
  queryGA4EcommerceFunnel,
  queryGA4EcommerceFunnelByDevice,
  queryGA4RealFunnel,
  queryGA4SeoConversionDiagnostic,
  queryGA4TopProducts,
  queryGA4SourceConversion,
  queryGA4Engagement,
  queryGA4Funnel,
  queryGA4RevenueKpi,
  queryGA4DataQuality,
  queryGA4TopSources,
  type GA4AiConversionFunnelReport,
  type GA4AiVsOrganicReport,
} from "../ga4";
import { getGa4CutoverPlan } from "../ga4Cutover";
import { getGa4RevenueOpsPlan } from "../ga4RevenueOpsPlan";
import { aggregateByPageGroup } from "../utils/pageGroup";
import { getCoffeeBigQueryDiagnostics } from "../coffeeBigQueryDiagnostics";

const withConcurrency = async <T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, idx: number) => Promise<R>,
): Promise<R[]> => {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  const runners = Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, async () => {
    while (true) {
      const idx = cursor++;
      if (idx >= items.length) break;
      results[idx] = await worker(items[idx] as T, idx);
    }
  });

  await Promise.all(runners);
  return results;
};

type AiTrafficTopicQuery = {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

type AiTrafficTopicsPageRow = {
  landingPagePlusQueryString: string;
  aiSessions: number;
  aiActiveUsers: number;
  ecommercePurchases: number;
  grossPurchaseRevenue: number;
  gscTopQueries: AiTrafficTopicQuery[];
};

type AiTrafficTopicsResponse = {
  range: { startDate: string; endDate: string };
  topPages: number;
  topQueries: number;
  pages: AiTrafficTopicsPageRow[];
  debug: { notes: string[] };
};

const AI_TRAFFIC_TOPICS_CACHE_TTL_MS = 60 * 60 * 1000; // 1h
type AiTrafficTopicsCacheEntry = { measuredAtMs: number; value: AiTrafficTopicsResponse };
const aiTrafficTopicsCache = new Map<string, AiTrafficTopicsCacheEntry>();
const aiTrafficTopicsInflight = new Map<string, Promise<AiTrafficTopicsResponse>>();

const AI_FUNNEL_CACHE_TTL_MS = 30 * 60 * 1000; // 30m
type AiFunnelCacheEntry = { measuredAtMs: number; value: GA4AiConversionFunnelReport };
const aiFunnelCache = new Map<string, AiFunnelCacheEntry>();
const aiFunnelInflight = new Map<string, Promise<GA4AiConversionFunnelReport>>();

const AI_VS_ORGANIC_CACHE_TTL_MS = 30 * 60 * 1000; // 30m
type AiVsOrganicCacheEntry = { measuredAtMs: number; value: GA4AiVsOrganicReport };
const aiVsOrganicCache = new Map<string, AiVsOrganicCacheEntry>();
const aiVsOrganicInflight = new Map<string, Promise<GA4AiVsOrganicReport>>();

export const createGa4Router = () => {
  const router = express.Router();

  router.get("/api/ga4/coffee-bigquery/diagnostics", async (req: Request, res: Response) => {
    try {
      const startSuffix = typeof req.query.startSuffix === "string" ? req.query.startSuffix : undefined;
      const endSuffix = typeof req.query.endSuffix === "string" ? req.query.endSuffix : undefined;
      const diagnostics = await getCoffeeBigQueryDiagnostics({ startSuffix, endSuffix });
      res.json(diagnostics);
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: "coffee_bigquery_diagnostics_error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  router.get("/api/ga4/engagement", async (req: Request, res: Response) => {
    try {
      const startDate = (req.query.startDate as string) || "30daysAgo";
      const endDate = (req.query.endDate as string) || "yesterday";
      const limit = parseInt(req.query.limit as string, 10) || 50;

      const result = await queryGA4Engagement(startDate, endDate, limit);
      res.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "GA4 query failed";
      res.status(500).json({ error: "ga4_engagement_error", message });
    }
  });

  router.get("/api/ga4/funnel", async (req: Request, res: Response) => {
    const typeRaw = typeof req.query.type === "string" ? req.query.type.trim() : "";
    const type = typeRaw === "test" || typeRaw === "supplement" ? typeRaw : "all";

    // 기존 범용 퍼널(Organic -> Pageviews -> Engaged -> Conversions) 유지 (하위호환).
    if (type === "all") {
      try {
        const startDate = (req.query.startDate as string) || "30daysAgo";
        const endDate = (req.query.endDate as string) || "yesterday";

        const steps = await queryGA4Funnel(startDate, endDate);
        res.json({ startDate, endDate, steps });
      } catch (error) {
        const message = error instanceof Error ? error.message : "GA4 funnel query failed";
        res.status(500).json({ error: "ga4_funnel_error", message });
      }
      return;
    }

    const periodRaw = typeof req.query.period === "string" ? req.query.period.trim() : "";
    const period = periodRaw === "7d" || periodRaw === "custom" ? periodRaw : "30d";

    let startDate = "";
    let endDate = "";

    if (period === "custom") {
      const startDateParam = typeof req.query.startDate === "string" ? req.query.startDate : undefined;
      const endDateParam = typeof req.query.endDate === "string" ? req.query.endDate : undefined;
      if (!startDateParam || !endDateParam) {
        res.status(400).json({
          error: "잘못된 기간 파라미터입니다.",
          details: "custom period requires startDate/endDate (YYYY-MM-DD)",
        });
        return;
      }
      const range = resolveIsoDateRange({
        startDateParam,
        endDateParam,
        defaultStartDate: startDateParam,
        defaultEndDate: endDateParam,
      });
      if (!range.ok) {
        res.status(400).json({ error: range.error, details: range.details });
        return;
      }
      startDate = range.startDate;
      endDate = range.endDate;
    } else {
      const days = period === "7d" ? 7 : 30;
      startDate = daysAgo(days);
      endDate = daysAgo(1);
    }

    try {
      const result = await queryGA4EcommerceFunnel({ type, startDate, endDate });
      res.json({
        _meta: makeLiveMeta({ startDate, endDate }),
        type,
        period,
        label: result.label,
        steps: result.steps,
        overallConversion: result.overallConversion,
        biggestDropoff: result.biggestDropoff,
        ...(result.debug ? { debug: result.debug } : {}),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "GA4 funnel query failed";

      if (message.includes("GA4_PROPERTY_ID is not configured")) {
        res.json({
          _meta: makeEmptyMeta({ startDate, endDate }),
          type,
          period,
          steps: [],
          overallConversion: 0,
          biggestDropoff: { from: "", to: "", dropRate: 0 },
          debug: { notes: ["GA4 API 미설정: GA4_PROPERTY_ID 누락"] },
        });
        return;
      }

      if (isGa4CredentialError(message)) {
        res.json({
          _meta: makeEmptyMeta({ startDate, endDate }),
          type,
          period,
          steps: [],
          overallConversion: 0,
          biggestDropoff: { from: "", to: "", dropRate: 0 },
          debug: { notes: ["GA4 미연결(인증 실패 또는 credential 미설정). 실제 데이터가 아닙니다."] },
        });
        return;
      }

      res.status(500).json({ error: "ga4_funnel_error", message });
    }
  });

  router.get("/api/ga4/ai-traffic", async (req: Request, res: Response) => {
    const startDate = typeof req.query.startDate === "string" ? req.query.startDate : daysAgo(30);
    const endDate = typeof req.query.endDate === "string" ? req.query.endDate : daysAgo(1);
    const limitRaw = typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : Number.NaN;
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(500, limitRaw)) : 20;
    const referralOnly = req.query.referralOnly === "1" || req.query.referralOnly === "true";
    const forceRefresh = req.query.refresh === "1";

    const matchedPatterns = [...AI_REFERRAL_SOURCE_PATTERNS_ALLOWLIST];

    try {
      const result = await queryGA4AiTrafficDetailed({ startDate, endDate, limit, referralOnly, forceRefresh });
      res.json({ _meta: makeLiveMeta({ startDate, endDate }), ...result });
    } catch (error) {
      const message = error instanceof Error ? error.message : "GA4 AI traffic query failed";

      // 프론트가 안정적으로 렌더링할 수 있도록, GA4 미설정은 200 + 0값 구조로 반환합니다.
      if (message.includes("GA4_PROPERTY_ID is not configured")) {
        res.json({
          _meta: makeEmptyMeta({ startDate, endDate }),
          range: { startDate, endDate },
          definition: "AI traffic identified by sessionSource(referrer) with ChatGPT UTM supplement(sessionManualSource)",
          identification: { method: "referrer" },
          totals: {
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
          },
          bySource: [],
          byLandingPage: [],
          debug: { matchedPatterns, notes: ["GA4 API 미설정: GA4_PROPERTY_ID 누락"] },
        });
        return;
      }

      if (isGa4CredentialError(message)) {
        res.json({
          _meta: makeEmptyMeta({ startDate, endDate }),
          range: { startDate, endDate },
          definition: "AI traffic identified by sessionSource(referrer) with ChatGPT UTM supplement(sessionManualSource)",
          identification: { method: "referrer" },
          totals: {
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
          },
          bySource: [],
          byLandingPage: [],
          debug: { matchedPatterns, notes: ["GA4 미연결(인증 실패 또는 credential 미설정). 실제 데이터가 아닙니다."] },
        });
        return;
      }

      res.status(500).json({ error: "ga4_ai_traffic_error", message });
    }
  });

  router.get("/api/ga4/ai-funnel", async (req: Request, res: Response) => {
    const referralOnly = req.query.referralOnly === "1" || req.query.referralOnly === "true";
    const forceRefresh = req.query.refresh === "1";
    const periodRaw = typeof req.query.period === "string" ? req.query.period.trim() : "";
    const period = periodRaw === "7d" || periodRaw === "90d" || periodRaw === "custom" ? periodRaw : "30d";

    let startDate = "";
    let endDate = "";

    if (period === "custom") {
      const startDateParam = typeof req.query.startDate === "string" ? req.query.startDate : undefined;
      const endDateParam = typeof req.query.endDate === "string" ? req.query.endDate : undefined;
      if (!startDateParam || !endDateParam) {
        res.status(400).json({
          error: "invalid_range",
          message: "custom period requires startDate/endDate (YYYY-MM-DD)",
        });
        return;
      }
      const range = resolveIsoDateRange({
        startDateParam,
        endDateParam,
        defaultStartDate: startDateParam,
        defaultEndDate: endDateParam,
      });
      if (!range.ok) {
        res.status(400).json({ error: range.error, details: range.details });
        return;
      }
      startDate = range.startDate;
      endDate = range.endDate;
    } else {
      const days = period === "7d" ? 7 : period === "90d" ? 90 : 30;
      startDate = daysAgo(days);
      endDate = daysAgo(1);
    }

    const cacheKey = ["ga4_ai_funnel", startDate, endDate, referralOnly ? "referralOnly" : "any"].join("|");
    const now = Date.now();

    if (!forceRefresh) {
      const cached = aiFunnelCache.get(cacheKey);
      if (cached && now - cached.measuredAtMs < AI_FUNNEL_CACHE_TTL_MS) {
        res.json({ _meta: makeLiveMeta({ startDate, endDate }), period, ...cached.value });
        return;
      }

      const redisCached = await cacheGetJson<AiFunnelCacheEntry>(cacheKey);
      if (redisCached && now - redisCached.measuredAtMs < AI_FUNNEL_CACHE_TTL_MS) {
        aiFunnelCache.set(cacheKey, redisCached);
        res.json({ _meta: makeLiveMeta({ startDate, endDate }), period, ...redisCached.value });
        return;
      }

      const running = aiFunnelInflight.get(cacheKey);
      if (running) {
        res.json({ _meta: makeLiveMeta({ startDate, endDate }), period, ...(await running) });
        return;
      }
    }

    const matchedPatterns = [...AI_REFERRAL_SOURCE_PATTERNS_ALLOWLIST];

    const promise = (async (): Promise<GA4AiConversionFunnelReport> => {
      return queryGA4AiConversionFunnel({ startDate, endDate, referralOnly, patterns: matchedPatterns });
    })();

    aiFunnelInflight.set(cacheKey, promise);
    try {
      const value = await promise;
      aiFunnelCache.set(cacheKey, { measuredAtMs: Date.now(), value });
      void cacheSetJson(cacheKey, { measuredAtMs: Date.now(), value }, Math.floor(AI_FUNNEL_CACHE_TTL_MS / 1000));
      res.json({ _meta: makeLiveMeta({ startDate, endDate }), period, ...value });
    } catch (error) {
      const message = error instanceof Error ? error.message : "GA4 AI funnel query failed";

      if (message.includes("GA4_PROPERTY_ID is not configured")) {
        res.json({
          _meta: makeEmptyMeta({ startDate, endDate }),
          period,
          range: { startDate, endDate },
          referralOnly,
          identification: { method: "referrer" },
          steps: [],
          overallConversion: 0,
          biggestDropoff: { from: "", to: "", dropRate: 0 },
          totals: { sessions: 0, engagedSessions: 0, conversions: 0, ecommercePurchases: 0, grossPurchaseRevenue: 0 },
          debug: { matchedPatterns, notes: ["GA4 API 미설정: GA4_PROPERTY_ID 누락"] },
        });
        return;
      }

      if (isGa4CredentialError(message)) {
        res.json({
          _meta: makeEmptyMeta({ startDate, endDate }),
          period,
          range: { startDate, endDate },
          referralOnly,
          identification: { method: "referrer" },
          steps: [],
          overallConversion: 0,
          biggestDropoff: { from: "", to: "", dropRate: 0 },
          totals: { sessions: 0, engagedSessions: 0, conversions: 0, ecommercePurchases: 0, grossPurchaseRevenue: 0 },
          debug: { matchedPatterns, notes: ["GA4 미연결(인증 실패 또는 credential 미설정). 실제 데이터가 아닙니다."] },
        });
        return;
      }

      res.status(500).json({ error: "ga4_ai_funnel_error", message });
    } finally {
      aiFunnelInflight.delete(cacheKey);
    }
  });

  router.get("/api/ga4/ai-vs-organic", async (req: Request, res: Response) => {
    const referralOnly = req.query.referralOnly === "1" || req.query.referralOnly === "true";
    const forceRefresh = req.query.refresh === "1";
    const periodRaw = typeof req.query.period === "string" ? req.query.period.trim() : "";
    const period = periodRaw === "7d" || periodRaw === "90d" || periodRaw === "custom" ? periodRaw : "30d";

    let startDate = "";
    let endDate = "";

    if (period === "custom") {
      const startDateParam = typeof req.query.startDate === "string" ? req.query.startDate : undefined;
      const endDateParam = typeof req.query.endDate === "string" ? req.query.endDate : undefined;
      if (!startDateParam || !endDateParam) {
        res.status(400).json({
          error: "invalid_range",
          message: "custom period requires startDate/endDate (YYYY-MM-DD)",
        });
        return;
      }
      const range = resolveIsoDateRange({
        startDateParam,
        endDateParam,
        defaultStartDate: startDateParam,
        defaultEndDate: endDateParam,
      });
      if (!range.ok) {
        res.status(400).json({ error: range.error, details: range.details });
        return;
      }
      startDate = range.startDate;
      endDate = range.endDate;
    } else {
      const days = period === "7d" ? 7 : period === "90d" ? 90 : 30;
      startDate = daysAgo(days);
      endDate = daysAgo(1);
    }

    const cacheKey = ["ga4_ai_vs_organic", startDate, endDate, referralOnly ? "referralOnly" : "any"].join("|");
    const now = Date.now();

    if (!forceRefresh) {
      const cached = aiVsOrganicCache.get(cacheKey);
      if (cached && now - cached.measuredAtMs < AI_VS_ORGANIC_CACHE_TTL_MS) {
        res.json({ _meta: makeLiveMeta({ startDate, endDate }), period, ...cached.value });
        return;
      }

      const redisCached = await cacheGetJson<AiVsOrganicCacheEntry>(cacheKey);
      if (redisCached && now - redisCached.measuredAtMs < AI_VS_ORGANIC_CACHE_TTL_MS) {
        aiVsOrganicCache.set(cacheKey, redisCached);
        res.json({ _meta: makeLiveMeta({ startDate, endDate }), period, ...redisCached.value });
        return;
      }

      const running = aiVsOrganicInflight.get(cacheKey);
      if (running) {
        res.json({ _meta: makeLiveMeta({ startDate, endDate }), period, ...(await running) });
        return;
      }
    }

    const matchedPatterns = [...AI_REFERRAL_SOURCE_PATTERNS_ALLOWLIST];

    const promise = (async (): Promise<GA4AiVsOrganicReport> => {
      return queryGA4AiVsOrganicReport({ startDate, endDate, referralOnly, patterns: matchedPatterns });
    })();

    aiVsOrganicInflight.set(cacheKey, promise);
    try {
      const value = await promise;
      aiVsOrganicCache.set(cacheKey, { measuredAtMs: Date.now(), value });
      void cacheSetJson(cacheKey, { measuredAtMs: Date.now(), value }, Math.floor(AI_VS_ORGANIC_CACHE_TTL_MS / 1000));
      res.json({ _meta: makeLiveMeta({ startDate, endDate }), period, ...value });
    } catch (error) {
      const message = error instanceof Error ? error.message : "GA4 channel compare query failed";

      const emptySummary = {
        sessions: 0,
        newUsers: 0,
        engagedSessions: 0,
        bounceRate: 0,
        engagementRate: 0,
        averageSessionDuration: 0,
        screenPageViews: 0,
        conversions: 0,
        ecommercePurchases: 0,
        grossPurchaseRevenue: 0,
        pagesPerSession: 0,
        conversionRate: 0,
        purchaseConversionRate: 0,
      };

      if (message.includes("GA4_PROPERTY_ID is not configured")) {
        res.json({
          _meta: makeEmptyMeta({ startDate, endDate }),
          period,
          range: { startDate, endDate },
          referralOnly,
          identification: { method: "referrer" },
          ai: emptySummary,
          organic: emptySummary,
          debug: { matchedPatterns, notes: ["GA4 API 미설정: GA4_PROPERTY_ID 누락"] },
        });
        return;
      }

      if (isGa4CredentialError(message)) {
        res.json({
          _meta: makeEmptyMeta({ startDate, endDate }),
          period,
          range: { startDate, endDate },
          referralOnly,
          identification: { method: "referrer" },
          ai: emptySummary,
          organic: emptySummary,
          debug: { matchedPatterns, notes: ["GA4 미연결(인증 실패 또는 credential 미설정). 실제 데이터가 아닙니다."] },
        });
        return;
      }

      res.status(500).json({ error: "ga4_ai_vs_organic_error", message });
    } finally {
      aiVsOrganicInflight.delete(cacheKey);
    }
  });

  router.get("/api/ga4/ai-traffic/user-type", async (req: Request, res: Response) => {
    const startDateParam = typeof req.query.startDate === "string" ? req.query.startDate : undefined;
    const endDateParam = typeof req.query.endDate === "string" ? req.query.endDate : undefined;
    const limitRaw = typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : Number.NaN;
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(500, limitRaw)) : 200;

    const range = resolveIsoDateRange({
      startDateParam,
      endDateParam,
      defaultStartDate: daysAgo(30),
      defaultEndDate: toDateString(new Date()),
    });

    if (!range.ok) {
      res.status(400).json({ error: range.error, details: range.details });
      return;
    }

    const { startDate, endDate } = range;

    try {
      const result = await queryGA4AiTrafficUserType({ startDate, endDate, limit });
      res.json({ _meta: makeLiveMeta({ startDate, endDate }), ...result });
    } catch (error) {
      const message = error instanceof Error ? error.message : "GA4 user-type query failed";

      if (message.includes("GA4_PROPERTY_ID is not configured")) {
        const emptySummary = {
          sessions: 0,
          activeUsers: 0,
          engagedSessions: 0,
          bounceRate: 0,
          engagementRate: 0,
          averageSessionDuration: 0,
          ecommercePurchases: 0,
          grossPurchaseRevenue: 0,
        };
        res.json({
          _meta: makeEmptyMeta({ startDate, endDate }),
          period: { startDate, endDate },
          identification: { method: "referrer" },
          summary: {
            new: emptySummary,
            returning: emptySummary,
          },
          bySourceAndType: [],
          debug: { notes: ["GA4 API 미설정: GA4_PROPERTY_ID 누락"] },
        });
        return;
      }

      const msgLower = message.toLowerCase();
      if (message.includes("RESOURCE_EXHAUSTED") || message.includes("429") || msgLower.includes("quota")) {
        res.status(429).json({ error: "GA4 API 할당량 초과. 잠시 후 다시 시도해주세요.", retryAfter: 60 });
        return;
      }

      if (isGa4CredentialError(message)) {
        const emptySummary = {
          sessions: 0,
          activeUsers: 0,
          engagedSessions: 0,
          bounceRate: 0,
          engagementRate: 0,
          averageSessionDuration: 0,
          ecommercePurchases: 0,
          grossPurchaseRevenue: 0,
        };
        res.json({
          _meta: makeEmptyMeta({ startDate, endDate }),
          period: { startDate, endDate },
          identification: { method: "referrer" },
          summary: {
            new: emptySummary,
            returning: emptySummary,
          },
          bySourceAndType: [],
          debug: { notes: ["GA4 미연결(인증 실패 또는 credential 미설정). 실제 데이터가 아닙니다."] },
        });
        return;
      }

      res.status(500).json({ error: "ga4_ai_traffic_user_type_error", message });
    }
  });

  router.get("/api/ga4/top-sources", async (req: Request, res: Response) => {
    const startDate = typeof req.query.startDate === "string" ? req.query.startDate : daysAgo(30);
    const endDate = typeof req.query.endDate === "string" ? req.query.endDate : daysAgo(1);
    const limitRaw = typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : Number.NaN;
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(500, limitRaw)) : 200;
    const forceRefresh = req.query.refresh === "1";

    try {
      const result = await queryGA4TopSources({ startDate, endDate, limit, forceRefresh });
      res.json({
        _meta: makeLiveMeta({ startDate, endDate }),
        ...result,
        debug: { notes: ["필터 없이 sessionSource 상위 목록 반환"] },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "GA4 top sources query failed";
      if (message.includes("GA4_PROPERTY_ID is not configured")) {
        res.json({
          _meta: makeEmptyMeta({ startDate, endDate }),
          range: { startDate, endDate },
          rows: [],
          debug: { notes: ["GA4 API 미설정: GA4_PROPERTY_ID 누락"] },
        });
        return;
      }
      if (isGa4CredentialError(message)) {
        res.json({
          _meta: makeEmptyMeta({ startDate, endDate }),
          range: { startDate, endDate },
          rows: [],
          debug: { notes: ["GA4 미연결(인증 실패 또는 credential 미설정). 실제 데이터가 아닙니다."] },
        });
        return;
      }
      res.status(500).json({ error: "ga4_top_sources_error", message });
    }
  });

  router.get("/api/ai-traffic/topics", async (req: Request, res: Response) => {
    const startDate = typeof req.query.startDate === "string" ? req.query.startDate : daysAgo(30);
    const endDate = typeof req.query.endDate === "string" ? req.query.endDate : daysAgo(1);
    const topPagesRaw = typeof req.query.topPages === "string" ? parseInt(req.query.topPages, 10) : Number.NaN;
    const topQueriesRaw = typeof req.query.topQueries === "string" ? parseInt(req.query.topQueries, 10) : Number.NaN;
    const topPages = Number.isFinite(topPagesRaw) ? Math.max(1, Math.min(50, topPagesRaw)) : 10;
    const topQueries = Number.isFinite(topQueriesRaw) ? Math.max(1, Math.min(10, topQueriesRaw)) : 3;
    const referralOnly = req.query.referralOnly === "1" || req.query.referralOnly === "true";
    const forceRefresh = req.query.refresh === "1";
    const cacheKey = [
      "ai_traffic_topics",
      startDate,
      endDate,
      topPages,
      topQueries,
      referralOnly ? "referralOnly" : "any",
    ].join("|");

    if (!forceRefresh) {
      const cached = aiTrafficTopicsCache.get(cacheKey);
      const now = Date.now();
      if (cached && now - cached.measuredAtMs < AI_TRAFFIC_TOPICS_CACHE_TTL_MS) {
        res.json(cached.value);
        return;
      }

      const redisCached = await cacheGetJson<AiTrafficTopicsCacheEntry>(cacheKey);
      if (redisCached && now - redisCached.measuredAtMs < AI_TRAFFIC_TOPICS_CACHE_TTL_MS) {
        aiTrafficTopicsCache.set(cacheKey, redisCached);
        res.json(redisCached.value);
        return;
      }

      const running = aiTrafficTopicsInflight.get(cacheKey);
      if (running) {
        res.json(await running);
        return;
      }
    }

    const promise = (async (): Promise<AiTrafficTopicsResponse> => {
      const notes: string[] = [];
      let landingRows: {
        landingPagePlusQueryString: string;
        sessions: number;
        activeUsers: number;
        ecommercePurchases: number;
        grossPurchaseRevenue: number;
      }[] = [];

      try {
        const ai = await queryGA4AiTrafficDetailed({ startDate, endDate, limit: topPages, referralOnly, forceRefresh });
        landingRows = (ai.byLandingPage ?? []).map((r) => ({
          landingPagePlusQueryString: r.landingPagePlusQueryString,
          sessions: r.sessions,
          activeUsers: r.activeUsers,
          ecommercePurchases: r.ecommercePurchases,
          grossPurchaseRevenue: r.grossPurchaseRevenue,
        }));
        notes.push(`GA4: AI 유입 랜딩 TOP ${landingRows.length}건`);
      } catch (error) {
        const message = error instanceof Error ? error.message : "GA4 AI traffic query failed";
        if (message.includes("GA4_PROPERTY_ID is not configured")) {
          notes.push("GA4 API 미설정: GA4_PROPERTY_ID 누락");
        } else {
          notes.push(`GA4 조회 실패: ${message}`);
        }
        landingRows = [];
      }

      const pages = await withConcurrency(
        landingRows,
        3,
        async (row): Promise<AiTrafficTopicsPageRow> => {
          const landingPath = (row.landingPagePlusQueryString || "").split("?")[0] ?? "";
          const gscTopQueries: AiTrafficTopicQuery[] = [];

          if (landingPath) {
            try {
              const gsc = await queryGscSearchAnalytics({
                startDate,
                endDate,
                dimensions: ["query"],
                rowLimit: topQueries,
                startRow: 0,
                dimensionFilterGroups: [
                  {
                    filters: [
                      {
                        dimension: "page",
                        operator: "contains",
                        expression: landingPath,
                      },
                    ],
                  },
                ],
              });

              const rows = gsc.rows as Record<string, unknown>[];
              for (const r of rows) {
                const query = ((r.keys as string[]) ?? [])[0] ?? "";
                if (!query) continue;
                gscTopQueries.push({
                  query,
                  clicks: (r.clicks as number) ?? 0,
                  impressions: (r.impressions as number) ?? 0,
                  ctr: (r.ctr as number) ?? 0,
                  position: (r.position as number) ?? 0,
                });
              }
            } catch {
              // best-effort: GSC 미설정/실패 시 빈 배열 유지
            }
          }

          return {
            landingPagePlusQueryString: row.landingPagePlusQueryString,
            aiSessions: row.sessions,
            aiActiveUsers: row.activeUsers,
            ecommercePurchases: row.ecommercePurchases,
            grossPurchaseRevenue: row.grossPurchaseRevenue,
            gscTopQueries,
          };
        },
      );

      const value: AiTrafficTopicsResponse = {
        range: { startDate, endDate },
        topPages,
        topQueries,
        pages,
        debug: { notes },
      };

      const measuredAtMs = Date.now();
      aiTrafficTopicsCache.set(cacheKey, { measuredAtMs, value });
      void cacheSetJson(cacheKey, { measuredAtMs, value }, Math.floor(AI_TRAFFIC_TOPICS_CACHE_TTL_MS / 1000));
      return value;
    })();

    aiTrafficTopicsInflight.set(cacheKey, promise);
    try {
      res.json(await promise);
    } finally {
      aiTrafficTopicsInflight.delete(cacheKey);
    }
  });

  /* ── 전자상거래 퍼널 디바이스별 (Q1 대응) ── */
  router.get("/api/ga4/ecommerce-funnel-by-device", async (req: Request, res: Response) => {
    const startDate = typeof req.query.startDate === "string" ? req.query.startDate : daysAgo(30);
    const endDate = typeof req.query.endDate === "string" ? req.query.endDate : daysAgo(1);

    try {
      const result = await queryGA4EcommerceFunnelByDevice({ startDate, endDate });
      res.json({ _meta: makeLiveMeta({ startDate, endDate }), ...result });
    } catch (error) {
      const message = error instanceof Error ? error.message : "GA4 ecommerce funnel by device query failed";
      if (message.includes("GA4_PROPERTY_ID is not configured")) {
        res.json({
          _meta: makeEmptyMeta({ startDate, endDate }),
          range: { startDate, endDate },
          devices: [],
          allDevices: { steps: [], overallConversion: 0, biggestDropoff: { from: "", to: "", dropRate: 0 } },
          debug: { notes: ["GA4 API 미설정: GA4_PROPERTY_ID 누락"] },
        });
        return;
      }
      if (isGa4CredentialError(message)) {
        res.json({
          _meta: makeEmptyMeta({ startDate, endDate }),
          range: { startDate, endDate },
          devices: [],
          allDevices: { steps: [], overallConversion: 0, biggestDropoff: { from: "", to: "", dropRate: 0 } },
          debug: { notes: ["GA4 미연결(인증 실패 또는 credential 미설정)"] },
        });
        return;
      }
      res.status(500).json({ error: "ga4_ecommerce_funnel_by_device_error", message });
    }
  });

  /* ── 매출 중심 KPI ── */
  router.get("/api/ga4/revenue-kpi", async (req: Request, res: Response) => {
    const startDate = typeof req.query.startDate === "string" ? req.query.startDate : daysAgo(30);
    const endDate = typeof req.query.endDate === "string" ? req.query.endDate : daysAgo(1);

    try {
      const result = await queryGA4RevenueKpi({ startDate, endDate });
      res.json({ _meta: makeLiveMeta({ startDate, endDate }), ...result });
    } catch (error) {
      const message = error instanceof Error ? error.message : "GA4 revenue KPI query failed";
      if (message.includes("GA4_PROPERTY_ID is not configured")) {
        res.json({
          _meta: makeEmptyMeta({ startDate, endDate }),
          range: { startDate, endDate },
          totalRevenue: 0, totalPurchases: 0, totalSessions: 0,
          purchaseConversionRate: 0, averageOrderValue: 0, revenuePerSession: 0,
          reportViews: 0, revenuePerReportView: 0,
          debug: { notes: ["GA4 API 미설정: GA4_PROPERTY_ID 누락"] },
        });
        return;
      }
      if (isGa4CredentialError(message)) {
        res.json({
          _meta: makeEmptyMeta({ startDate, endDate }),
          range: { startDate, endDate },
          totalRevenue: 0, totalPurchases: 0, totalSessions: 0,
          purchaseConversionRate: 0, averageOrderValue: 0, revenuePerSession: 0,
          reportViews: 0, revenuePerReportView: 0,
          debug: { notes: ["GA4 미연결(인증 실패 또는 credential 미설정)"] },
        });
        return;
      }
      res.status(500).json({ error: "ga4_revenue_kpi_error", message });
    }
  });

  /* ── 데이터 품질 진단 ── */
  router.get("/api/ga4/data-quality", async (req: Request, res: Response) => {
    const startDate = typeof req.query.startDate === "string" ? req.query.startDate : daysAgo(30);
    const endDate = typeof req.query.endDate === "string" ? req.query.endDate : daysAgo(1);

    try {
      const result = await queryGA4DataQuality({ startDate, endDate });
      res.json({ _meta: makeLiveMeta({ startDate, endDate }), ...result });
    } catch (error) {
      const message = error instanceof Error ? error.message : "GA4 data quality query failed";
      if (message.includes("GA4_PROPERTY_ID is not configured")) {
        res.json({
          _meta: makeEmptyMeta({ startDate, endDate }),
          range: { startDate, endDate },
          score: 0, issues: [],
          stats: { totalPagePaths: 0, duplicateUrlGroups: 0, notSetLandingRatio: 0, queryParamPageRatio: 0, purchaseCount: 0, beginCheckoutCount: 0, pageViewSessions: 0, totalSessions: 0, pageViewMissingRatio: 0 },
          debug: { notes: ["GA4 API 미설정: GA4_PROPERTY_ID 누락"] },
        });
        return;
      }
      if (isGa4CredentialError(message)) {
        res.json({
          _meta: makeEmptyMeta({ startDate, endDate }),
          range: { startDate, endDate },
          score: 0, issues: [],
          stats: { totalPagePaths: 0, duplicateUrlGroups: 0, notSetLandingRatio: 0, queryParamPageRatio: 0, purchaseCount: 0, beginCheckoutCount: 0, pageViewSessions: 0, totalSessions: 0, pageViewMissingRatio: 0 },
          debug: { notes: ["GA4 미연결(인증 실패 또는 credential 미설정)"] },
        });
        return;
      }
      res.status(500).json({ error: "ga4_data_quality_error", message });
    }
  });

  /* ── SEO 전환 숫자 역전 진단 ── */
  router.get("/api/ga4/seo-conversion-diagnosis", async (req: Request, res: Response) => {
    const startDate = typeof req.query.startDate === "string" ? req.query.startDate : daysAgo(30);
    const endDate = typeof req.query.endDate === "string" ? req.query.endDate : daysAgo(1);

    try {
      const result = await queryGA4SeoConversionDiagnostic({ startDate, endDate });
      res.json({ _meta: makeLiveMeta({ startDate, endDate }), ...result });
    } catch (error) {
      const message = error instanceof Error ? error.message : "GA4 SEO conversion diagnosis query failed";
      if (message.includes("GA4_PROPERTY_ID is not configured")) {
        res.json({
          _meta: makeEmptyMeta({ startDate, endDate }),
          range: { startDate, endDate },
          summary: {
            range: { startDate, endDate },
            organicSessionScope: {
              sessions: 0,
              entrances: 0,
              ecommercePurchases: 0,
              keyEvents: 0,
              grossPurchaseRevenue: 0,
            },
            organicFirstUserScope: {
              totalUsers: 0,
              ecommercePurchases: 0,
              grossPurchaseRevenue: 0,
            },
            queryStringSignals: {
              shopViewPathViews: 0,
              shopViewVariantCount: 0,
              shopViewVariantViews: 0,
              topShopViewVariants: [],
            },
            sourceSignals: {
              notSetRevenue: 0,
              notSetPurchases: 0,
              selfReferralRevenue: 0,
              selfReferralPurchases: 0,
              suspiciousSources: [],
            },
            funnelSignals: {
              method: "eventCount_fallback",
              purchaseUsers: 0,
              totalPurchases: 0,
            },
            dataQualitySignals: {
              notSetLandingRatio: 0,
            },
            transactionSignals: {
              distinctTransactionIds: 0,
              totalPurchaseEvents: 0,
              blankTransactionEvents: 0,
              duplicatePurchaseEvents: 0,
              transactionCoverageRatio: 0,
            },
          },
          issues: [],
          recommendedChecks: [],
          debug: { notes: ["GA4 API 미설정: GA4_PROPERTY_ID 누락"] },
        });
        return;
      }
      if (isGa4CredentialError(message)) {
        res.json({
          _meta: makeEmptyMeta({ startDate, endDate }),
          range: { startDate, endDate },
          summary: {
            range: { startDate, endDate },
            organicSessionScope: {
              sessions: 0,
              entrances: 0,
              ecommercePurchases: 0,
              keyEvents: 0,
              grossPurchaseRevenue: 0,
            },
            organicFirstUserScope: {
              totalUsers: 0,
              ecommercePurchases: 0,
              grossPurchaseRevenue: 0,
            },
            queryStringSignals: {
              shopViewPathViews: 0,
              shopViewVariantCount: 0,
              shopViewVariantViews: 0,
              topShopViewVariants: [],
            },
            sourceSignals: {
              notSetRevenue: 0,
              notSetPurchases: 0,
              selfReferralRevenue: 0,
              selfReferralPurchases: 0,
              suspiciousSources: [],
            },
            funnelSignals: {
              method: "eventCount_fallback",
              purchaseUsers: 0,
              totalPurchases: 0,
            },
            dataQualitySignals: {
              notSetLandingRatio: 0,
            },
            transactionSignals: {
              distinctTransactionIds: 0,
              totalPurchaseEvents: 0,
              blankTransactionEvents: 0,
              duplicatePurchaseEvents: 0,
              transactionCoverageRatio: 0,
            },
          },
          issues: [],
          recommendedChecks: [],
          debug: { notes: ["GA4 미연결(인증 실패 또는 credential 미설정)"] },
        });
        return;
      }
      res.status(500).json({ error: "ga4_seo_conversion_diagnosis_error", message });
    }
  });

  /* ── GTM / GA4 컷오버 계획 ── */
  router.get("/api/ga4/cutover-plan", (_req: Request, res: Response) => {
    res.json({
      _meta: {
        type: "static_plan",
        generatedAt: new Date().toISOString(),
      },
      ...getGa4CutoverPlan(),
    });
  });

  /* ── GA4 매출 정합성 / 가상계좌 / 아임웹 이관 계획 ── */
  router.get("/api/ga4/revenue-ops-plan", (_req: Request, res: Response) => {
    res.json({
      _meta: {
        type: "static_plan",
        generatedAt: new Date().toISOString(),
      },
      ...getGa4RevenueOpsPlan(),
    });
  });

  /* ── 페이지 그룹 집계 ── */
  router.get("/api/ga4/page-groups", async (req: Request, res: Response) => {
    const startDate = typeof req.query.startDate === "string" ? req.query.startDate : daysAgo(30);
    const endDate = typeof req.query.endDate === "string" ? req.query.endDate : daysAgo(1);

    try {
      const engagement = await queryGA4Engagement(startDate, endDate, 500);
      const groups = aggregateByPageGroup(
        engagement.rows.map((r) => ({
          pagePath: r.pagePath,
          sessions: r.sessions,
          users: r.users,
          bounceRate: r.bounceRate,
        })),
      );
      res.json({
        _meta: makeLiveMeta({ startDate, endDate }),
        range: { startDate, endDate },
        groups,
        debug: { notes: [`${engagement.rows.length}개 페이지를 ${groups.length}개 그룹으로 분류`] },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "GA4 page groups query failed";
      if (message.includes("GA4_PROPERTY_ID is not configured")) {
        res.json({
          _meta: makeEmptyMeta({ startDate, endDate }),
          range: { startDate, endDate },
          groups: [],
          debug: { notes: ["GA4 API 미설정: GA4_PROPERTY_ID 누락"] },
        });
        return;
      }
      if (isGa4CredentialError(message)) {
        res.json({
          _meta: makeEmptyMeta({ startDate, endDate }),
          range: { startDate, endDate },
          groups: [],
          debug: { notes: ["GA4 미연결(인증 실패 또는 credential 미설정)"] },
        });
        return;
      }
      res.status(500).json({ error: "ga4_page_groups_error", message });
    }
  });

  /* ── 진짜 퍼널 (runFunnelReport v1alpha + eventCount fallback) ── */
  router.get("/api/ga4/real-funnel", async (req: Request, res: Response) => {
    const startDate = typeof req.query.startDate === "string" ? req.query.startDate : daysAgo(30);
    const endDate = typeof req.query.endDate === "string" ? req.query.endDate : daysAgo(1);

    try {
      const result = await queryGA4RealFunnel({ startDate, endDate });
      res.json({ _meta: makeLiveMeta({ startDate, endDate }), ...result });
    } catch (error) {
      const message = error instanceof Error ? error.message : "GA4 real funnel query failed";
      if (message.includes("GA4_PROPERTY_ID is not configured")) {
        res.json({
          _meta: makeEmptyMeta({ startDate, endDate }),
          range: { startDate, endDate },
          method: "eventCount_fallback",
          devices: [],
          allDevices: { steps: [], overallConversion: 0 },
          debug: { notes: ["GA4 API 미설정: GA4_PROPERTY_ID 누락"] },
        });
        return;
      }
      if (isGa4CredentialError(message)) {
        res.json({
          _meta: makeEmptyMeta({ startDate, endDate }),
          range: { startDate, endDate },
          method: "eventCount_fallback",
          devices: [],
          allDevices: { steps: [], overallConversion: 0 },
          debug: { notes: ["GA4 미연결(인증 실패 또는 credential 미설정)"] },
        });
        return;
      }
      res.status(500).json({ error: "ga4_real_funnel_error", message });
    }
  });

  /* ── 구매 상위 상품 ── */
  router.get("/api/ga4/top-products", async (req: Request, res: Response) => {
    const startDate = typeof req.query.startDate === "string" ? req.query.startDate : daysAgo(30);
    const endDate = typeof req.query.endDate === "string" ? req.query.endDate : daysAgo(1);
    const limitRaw = typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : Number.NaN;
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(50, limitRaw)) : 10;

    try {
      const result = await queryGA4TopProducts({ startDate, endDate, limit });
      res.json({ _meta: makeLiveMeta({ startDate, endDate }), ...result });
    } catch (error) {
      const message = error instanceof Error ? error.message : "GA4 top products query failed";
      if (message.includes("GA4_PROPERTY_ID is not configured")) {
        res.json({
          _meta: makeEmptyMeta({ startDate, endDate }),
          range: { startDate, endDate },
          products: [],
          debug: { notes: ["GA4 API 미설정: GA4_PROPERTY_ID 누락"] },
        });
        return;
      }
      if (isGa4CredentialError(message)) {
        res.json({
          _meta: makeEmptyMeta({ startDate, endDate }),
          range: { startDate, endDate },
          products: [],
          debug: { notes: ["GA4 미연결(인증 실패 또는 credential 미설정)"] },
        });
        return;
      }
      res.status(500).json({ error: "ga4_top_products_error", message });
    }
  });

  /* ── 소스별 매출/전환 통합 리포트 ── */
  router.get("/api/ga4/source-conversion", async (req: Request, res: Response) => {
    const startDate = typeof req.query.startDate === "string" ? req.query.startDate : daysAgo(30);
    const endDate = typeof req.query.endDate === "string" ? req.query.endDate : daysAgo(1);
    const limitRaw = typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : Number.NaN;
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(500, limitRaw)) : 100;

    try {
      const result = await queryGA4SourceConversion({ startDate, endDate, limit });
      res.json({ _meta: makeLiveMeta({ startDate, endDate }), ...result });
    } catch (error) {
      const message = error instanceof Error ? error.message : "GA4 source conversion query failed";
      if (message.includes("GA4_PROPERTY_ID is not configured")) {
        res.json({
          _meta: makeEmptyMeta({ startDate, endDate }),
          range: { startDate, endDate },
          rows: [],
          byChannel: [],
          debug: { notes: ["GA4 API 미설정: GA4_PROPERTY_ID 누락"] },
        });
        return;
      }
      if (isGa4CredentialError(message)) {
        res.json({
          _meta: makeEmptyMeta({ startDate, endDate }),
          range: { startDate, endDate },
          rows: [],
          byChannel: [],
          debug: { notes: ["GA4 미연결(인증 실패 또는 credential 미설정)"] },
        });
        return;
      }
      res.status(500).json({ error: "ga4_source_conversion_error", message });
    }
  });

  return router;
};
