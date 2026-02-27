import express, { type Request, type Response } from "express";
import { z } from "zod";
import OpenAI from "openai";

import { cacheDel, cacheGetJson, cacheSetJson } from "../cache/cache";
import { env } from "../env";
import { resolveIsoDateRange } from "../dateRange";
import { queryGscSearchAnalytics } from "../gsc";
import { queryGA4AiTrafficDetailed } from "../ga4";
import { classifyKeywordIntents } from "../intent";
import { generateInsights, chat as aiChat, isOpenAIConfigured, type AiInsight, type ChatMessage } from "../ai";
import { fetchSerpApiAccount, isSerpApiConfigured } from "../serpapi";
import { measureAiCitationMulti } from "../aiCitationMulti";
import { matchesHostBroad } from "../urlMatch";
import { isCircuitOpenError } from "../utils/circuitBreaker";
import { daysAgo } from "../utils/dateUtils";

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

type AiInsightsResponse = {
  insights: AiInsight[];
  generatedAt: string;
  model: string;
  dataSource: Record<string, unknown>;
};

const AI_INSIGHTS_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6h
type AiInsightsCacheEntry = { measuredAtMs: number; value: AiInsightsResponse };
const aiInsightsCache = new Map<string, AiInsightsCacheEntry>();
const aiInsightsInflight = new Map<string, Promise<AiInsightsResponse>>();

type LandingTopicsQuery = {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

type LandingTopicsPage = {
  landingPagePlusQueryString: string;
  landingPath: string;
  aiSessions: number;
  ecommercePurchases: number;
  grossPurchaseRevenue: number;
  gscTopQueries: LandingTopicsQuery[];
  topics: string[];
  summary: string;
  likelyQuestions: string[];
};

type LandingTopicsResponse = {
  range: { startDate: string; endDate: string };
  topPages: number;
  topQueries: number;
  referralOnly: boolean;
  method: "llm" | "heuristic";
  model: string | null;
  pages: LandingTopicsPage[];
  debug: { notes: string[] };
};

const LANDING_TOPICS_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6h
type LandingTopicsCacheEntry = { measuredAtMs: number; value: LandingTopicsResponse };
const landingTopicsCache = new Map<string, LandingTopicsCacheEntry>();
const landingTopicsInflight = new Map<string, Promise<LandingTopicsResponse>>();

const makeAiInsightsCacheKey = (params: { startDate: string; endDate: string }) =>
  ["ai_insights", env.GSC_SITE_URL, params.startDate, params.endDate, env.OPENAI_MODEL].join("|");

const buildAiInsights = async (params: { startDate: string; endDate: string }): Promise<AiInsightsResponse> => {
  const [kpiResult, kwResult] = await Promise.allSettled([
    queryGscSearchAnalytics({
      startDate: params.startDate,
      endDate: params.endDate,
      dimensions: ["date"],
      rowLimit: 7,
      startRow: 0,
    }),
    queryGscSearchAnalytics({
      startDate: params.startDate,
      endDate: params.endDate,
      dimensions: ["query"],
      rowLimit: 20,
      startRow: 0,
    }),
  ]);

  const seoData: Record<string, unknown> = {
    period: `${params.startDate} ~ ${params.endDate}`,
    site: env.GSC_SITE_URL,
  };

  if (kpiResult.status === "fulfilled" && kpiResult.value.rows) {
    const rows = kpiResult.value.rows;
    const totalClicks = rows.reduce((s, r) => s + (r.clicks ?? 0), 0);
    const totalImpressions = rows.reduce((s, r) => s + (r.impressions ?? 0), 0);
    const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
    const avgPos = rows.length > 0 ? rows.reduce((s, r) => s + (r.position ?? 0), 0) / rows.length : 0;
    seoData.kpi = {
      totalClicks,
      totalImpressions,
      avgCtr: Math.round(avgCtr * 100) / 100,
      avgPosition: Math.round(avgPos * 10) / 10,
      days: rows.length,
    };
  }

  if (kwResult.status === "fulfilled" && kwResult.value.rows) {
    seoData.topKeywords = kwResult.value.rows.slice(0, 10).map((r) => ({
      query: r.keys?.[0] ?? "",
      clicks: r.clicks,
      impressions: r.impressions,
      ctr: r.ctr ? Math.round(r.ctr * 10000) / 100 : 0,
      position: r.position ? Math.round(r.position * 10) / 10 : 0,
    }));
  }

  const insights = await generateInsights(seoData);
  return {
    insights,
    generatedAt: new Date().toISOString(),
    model: env.OPENAI_MODEL,
    dataSource: seoData,
  };
};

/* POST /api/ai/chat — AI 채팅 메시지 처리 */
const chatSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(2000),
      }),
    )
    .min(1)
    .max(20),
});

export const createAiRouter = () => {
  const router = express.Router();

  /* GET /api/serpapi/account — SerpAPI Key 정상 여부 확인(키 노출 없이) */
  router.get("/api/serpapi/account", async (_req: Request, res: Response) => {
    try {
      if (!isSerpApiConfigured()) {
        res.status(400).json({ error: "serpapi_not_configured", message: "SERP_API_KEY is not configured" });
        return;
      }

      const account = await fetchSerpApiAccount();
      res.json({
        ok: true,
        planName: account.plan_name ?? null,
        thisMonthUsage: account.this_month_usage ?? null,
        searchesLeft: account.searches_left ?? null,
      });
    } catch (error) {
      if (isCircuitOpenError(error)) {
        const retryAfterSeconds = Math.max(1, Math.ceil(error.retryAfterMs / 1000));
        res.setHeader("Retry-After", String(retryAfterSeconds));
        res.status(503).json({ error: "circuit_open", service: error.service, retryAfterSeconds });
        return;
      }
      const message = error instanceof Error ? error.message : "SerpAPI request failed";
      res.status(500).json({ error: "serpapi_error", message });
    }
  });

  /* GET /api/ai/citation — AI 답변 인용도(멀티 프로바이더) 디버그용 */
  router.get("/api/ai/citation", async (req: Request, res: Response) => {
    try {
      const sampleSize = Math.max(1, Math.min(20, Number(req.query.sampleSize ?? "5") || 5));
      const forceRefresh = req.query.refresh === "1";
      const matchModeRaw = typeof req.query.matchMode === "string" ? req.query.matchMode.trim() : "strict";
      const matchMode = matchModeRaw === "broad" || matchModeRaw === "both" ? matchModeRaw : "strict";
      if (matchModeRaw && !["strict", "broad", "both"].includes(matchModeRaw)) {
        res.status(400).json({ error: "validation_error", message: "Invalid matchMode. Allowed: strict, broad, both" });
        return;
      }

      const rawProviders = typeof req.query.providers === "string" ? req.query.providers : "";
      const providers = rawProviders ? rawProviders.split(",").map((p) => p.trim()).filter(Boolean) : undefined;

      const allowedProviders = new Set(["google_ai_overview", "chatgpt_search", "perplexity"]);
      if (providers?.some((p) => !allowedProviders.has(p))) {
        res.status(400).json({
          error: "validation_error",
          message: `Invalid providers. Allowed: ${[...allowedProviders].join(", ")}`,
        });
        return;
      }

      const rawQueries =
        typeof req.query.queries === "string"
          ? req.query.queries
          : Array.isArray(req.query.queries)
            ? req.query.queries.join("\n")
            : "";

      const queries = rawQueries ? rawQueries.split(/[\n,]+/).map((q) => q.trim()).filter(Boolean).slice(0, 50) : [];

      // refresh=1은 비용/쿼터 영향이 커서, 프로덕션에서는 CRON_SECRET이 설정된 경우에만 허용합니다.
      if (forceRefresh && env.NODE_ENV === "production") {
        if (!env.CRON_SECRET) {
          res.status(403).json({
            error: "forbidden",
            message: "refresh is disabled in production unless CRON_SECRET is configured",
          });
          return;
        }
        const headerSecret = req.header("x-cron-secret");
        const querySecret = typeof req.query.secret === "string" ? req.query.secret : undefined;
        const provided = headerSecret ?? querySecret;
        if (provided !== env.CRON_SECRET) {
          res.status(401).json({ error: "unauthorized", message: "Missing or invalid cron secret" });
          return;
        }
      }

      const keywordMetrics =
        queries.length > 0
          ? []
          : (() => {
              // 쿼리를 직접 넣지 않은 경우에만, GSC에서 표본 키워드를 가져옵니다.
              // (이 API는 디버그 목적이므로 rowLimit/기간은 고정)
              return queryGscSearchAnalytics({
                startDate: daysAgo(10),
                endDate: daysAgo(3),
                dimensions: ["query"],
                rowLimit: 500,
                startRow: 0,
              }).then((keywordResult) => {
                const rows = keywordResult.rows as Record<string, unknown>[];
                return rows
                  .map((row) => ({
                    query: (((row.keys as string[]) ?? [])[0] ?? "").trim(),
                    impressions: (row.impressions as number) ?? 0,
                    clicks: (row.clicks as number) ?? 0,
                  }))
                  .filter((k) => k.query);
              });
            })();

      const keywords = Array.isArray(keywordMetrics) ? keywordMetrics : await keywordMetrics;

      const result = await measureAiCitationMulti({
        keywords,
        queries,
        providers: providers as ("google_ai_overview" | "chatgpt_search" | "perplexity")[] | undefined,
        sampleSize,
        forceRefresh,
      });
      if (!result) {
        res.status(503).json({
          error: "citation_unavailable",
          message:
            "No citation providers configured or all providers failed. Check SERP_API_KEY / OPENAI_API_KEY / PERPLEXITY_API_KEY.",
        });
        return;
      }

      const verdictStrict =
        result.eligibleTotal === 0 ? "exposure_zero" : result.citedQueriesTotal === 0 ? "citation_zero" : "cited";

      let payloadResult: unknown = result;
      let verdictBroad: typeof verdictStrict | undefined;

      if (matchMode !== "strict") {
        // Broad match는 redirect/canonical을 따라가므로 네트워크 비용이 발생합니다. (디버그용)
        const enriched = JSON.parse(JSON.stringify(result)) as typeof result & {
          broad?: {
            citedQueriesTotalBroad: number;
            citedReferencesTotalBroad: number;
            citationRateOverallBroad: number;
            note: string;
          };
          providers: Array<
            {
              eligible: number;
              samples: Array<{ eligible: boolean } & Record<string, unknown>>;
              [k: string]: unknown;
            }
          >;
          [k: string]: unknown;
        };

        // providerIdx -> sampleIdx -> link -> reference
        const broadMaps: Array<Array<Map<string, unknown>>> = [];

        type TargetRef = { providerIdx: number; sampleIdx: number };
        const linkTargets = new Map<string, { ref: unknown; targets: TargetRef[] }>();

        for (let pIdx = 0; pIdx < enriched.providers.length; pIdx++) {
          const p = enriched.providers[pIdx]!;
          const mapsBySample: Array<Map<string, unknown>> = [];

          for (let sIdx = 0; sIdx < p.samples.length; sIdx++) {
            const sample = p.samples[sIdx]!;
            const refs = (sample.matchedReferences ?? []) as Array<{ link?: string } & Record<string, unknown>>;
            const map = new Map<string, unknown>();

            for (const ref of refs) {
              const link = (ref.link ?? "").trim();
              if (!link) continue;
              linkTargets.set(link, linkTargets.get(link) ?? { ref, targets: [] });
              linkTargets.get(link)!.targets.push({ providerIdx: pIdx, sampleIdx: sIdx });
            }
            mapsBySample.push(map);
          }
          broadMaps.push(mapsBySample);
        }

        const entries = [...linkTargets.entries()];
        await withConcurrency(entries, 3, async ([link, item]) => {
          const ok = await matchesHostBroad(link, enriched.siteHost);
          if (!ok) return false;
          for (const t of item.targets) {
            broadMaps[t.providerIdx]![t.sampleIdx]!.set(link, item.ref);
          }
          return true;
        });

        let citedQueriesTotalBroad = 0;
        let citedReferencesTotalBroad = 0;

        for (let pIdx = 0; pIdx < enriched.providers.length; pIdx++) {
          const p = enriched.providers[pIdx]!;

          let citedQueriesBroad = 0;
          let citedReferencesBroad = 0;

          for (let sIdx = 0; sIdx < p.samples.length; sIdx++) {
            const s = p.samples[sIdx]!;
            const broadRefs = [...broadMaps[pIdx]![sIdx]!.values()] as unknown[];
            (s as Record<string, unknown>).matchedReferencesBroad = broadRefs;
            (s as Record<string, unknown>).citedBroad = broadRefs.length > 0;

            if (s.eligible && broadRefs.length > 0) citedQueriesBroad++;
            citedReferencesBroad += broadRefs.length;
          }

          (p as Record<string, unknown>).citedQueriesBroad = citedQueriesBroad;
          (p as Record<string, unknown>).citedReferencesBroad = citedReferencesBroad;
          (p as Record<string, unknown>).citationRateBroad = p.eligible > 0 ? citedQueriesBroad / p.eligible : 0;

          citedQueriesTotalBroad += citedQueriesBroad;
          citedReferencesTotalBroad += citedReferencesBroad;
        }

        enriched.broad = {
          citedQueriesTotalBroad,
          citedReferencesTotalBroad,
          citationRateOverallBroad: enriched.eligibleTotal > 0 ? citedQueriesTotalBroad / enriched.eligibleTotal : 0,
          note: "Broad match: redirect/canonical로 최종 도메인을 추적해 매칭(Strict + 추가 매칭).",
        };

        verdictBroad =
          enriched.eligibleTotal === 0 ? "exposure_zero" : citedQueriesTotalBroad === 0 ? "citation_zero" : "cited";

        payloadResult = enriched;
      }

      res.json({
        verdict: verdictStrict,
        ...(verdictBroad ? { verdictBroad } : {}),
        availability: {
          google_ai_overview: { configured: isSerpApiConfigured() },
          chatgpt_search: { configured: !!env.OPENAI_API_KEY },
          perplexity: { configured: !!env.PERPLEXITY_API_KEY },
        },
        requested: {
          sampleSize,
          providers: providers ?? [...allowedProviders],
          queriesProvided: queries.length,
          forceRefresh,
          matchMode,
        },
        ...(payloadResult as Record<string, unknown>),
      });
    } catch (error) {
      if (isCircuitOpenError(error)) {
        const retryAfterSeconds = Math.max(1, Math.ceil(error.retryAfterMs / 1000));
        res.setHeader("Retry-After", String(retryAfterSeconds));
        res.status(503).json({ error: "circuit_open", service: error.service, retryAfterSeconds });
        return;
      }
      const message = error instanceof Error ? error.message : "AI citation measurement failed";
      res.status(500).json({ error: "citation_error", message });
    }
  });

  /* GET /api/ai/insights — KPI/키워드 데이터 기반 AI 인사이트 */
  router.get("/api/ai/insights", async (_req: Request, res: Response) => {
    if (!isOpenAIConfigured()) {
      res.status(503).json({ error: "openai_not_configured", message: "OPENAI_API_KEY is not set" });
      return;
    }

    try {
      const endDate = new Date();
      endDate.setDate(endDate.getDate() - 2);
      const startDate = new Date(endDate);
      startDate.setDate(startDate.getDate() - 6);
      const fmt = (d: Date) => d.toISOString().slice(0, 10);
      const startDateStr = fmt(startDate);
      const endDateStr = fmt(endDate);

      const cacheKey = makeAiInsightsCacheKey({ startDate: startDateStr, endDate: endDateStr });
      const now = Date.now();
      const cached = aiInsightsCache.get(cacheKey);

      const send = (payload: AiInsightsResponse, meta: { source: "cache" | "live"; measuredAtMs: number }) => {
        const ttlSeconds = Math.floor(AI_INSIGHTS_CACHE_TTL_MS / 1000);
        res.json({
          ...payload,
          _meta: {
            source: meta.source,
            generatedAt: payload.generatedAt,
            expiresAt: new Date(meta.measuredAtMs + AI_INSIGHTS_CACHE_TTL_MS).toISOString(),
            ttl: ttlSeconds,
          },
        });
      };

      if (cached && now - cached.measuredAtMs < AI_INSIGHTS_CACHE_TTL_MS) {
        send(cached.value, { source: "cache", measuredAtMs: cached.measuredAtMs });
        return;
      }

      const redisCached = await cacheGetJson<AiInsightsCacheEntry>(cacheKey);
      if (redisCached && now - redisCached.measuredAtMs < AI_INSIGHTS_CACHE_TTL_MS) {
        aiInsightsCache.set(cacheKey, redisCached);
        send(redisCached.value, { source: "cache", measuredAtMs: redisCached.measuredAtMs });
        return;
      }

      const running = aiInsightsInflight.get(cacheKey);
      if (running) {
        const value = await running;
        const entry = aiInsightsCache.get(cacheKey);
        send(value, { source: "live", measuredAtMs: entry?.measuredAtMs ?? Date.now() });
        return;
      }

      const promise = buildAiInsights({ startDate: startDateStr, endDate: endDateStr });

      const cachedPromise = (async () => {
        const value = await promise;
        const measuredAtMs = Date.now();
        aiInsightsCache.set(cacheKey, { measuredAtMs, value });
        void cacheSetJson(cacheKey, { measuredAtMs, value }, Math.floor(AI_INSIGHTS_CACHE_TTL_MS / 1000));
        return value;
      })();

      aiInsightsInflight.set(cacheKey, cachedPromise);
      try {
        const value = await cachedPromise;
        const entry = aiInsightsCache.get(cacheKey);
        send(value, { source: "live", measuredAtMs: entry?.measuredAtMs ?? Date.now() });
      } finally {
        aiInsightsInflight.delete(cacheKey);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("AI insights error:", err);
      const message = err instanceof Error ? err.message : "Unknown error";
      res.status(500).json({ error: "ai_error", message });
    }
  });

  /* POST /api/ai/insights/refresh — AI 인사이트 캐시 수동 갱신 */
  router.post("/api/ai/insights/refresh", async (_req: Request, res: Response) => {
    if (!isOpenAIConfigured()) {
      res.status(503).json({ error: "openai_not_configured", message: "OPENAI_API_KEY is not set" });
      return;
    }

    try {
      const endDate = new Date();
      endDate.setDate(endDate.getDate() - 2);
      const startDate = new Date(endDate);
      startDate.setDate(startDate.getDate() - 6);
      const fmt = (d: Date) => d.toISOString().slice(0, 10);
      const startDateStr = fmt(startDate);
      const endDateStr = fmt(endDate);

      const cacheKey = makeAiInsightsCacheKey({ startDate: startDateStr, endDate: endDateStr });
      await cacheDel(cacheKey);

      const send = (payload: AiInsightsResponse, measuredAtMs: number) => {
        const ttlSeconds = Math.floor(AI_INSIGHTS_CACHE_TTL_MS / 1000);
        res.json({
          ...payload,
          _meta: {
            source: "live",
            generatedAt: payload.generatedAt,
            expiresAt: new Date(measuredAtMs + AI_INSIGHTS_CACHE_TTL_MS).toISOString(),
            ttl: ttlSeconds,
          },
        });
      };

      const running = aiInsightsInflight.get(cacheKey);
      if (running) {
        const value = await running;
        const entry = aiInsightsCache.get(cacheKey);
        send(value, entry?.measuredAtMs ?? Date.now());
        return;
      }

      const promise = buildAiInsights({ startDate: startDateStr, endDate: endDateStr });

      // refresh는 기존 캐시를 무시하고, 완료 시 새 캐시로 덮어씁니다.
      const cachedPromise = (async () => {
        const value = await promise;
        const measuredAtMs = Date.now();
        aiInsightsCache.set(cacheKey, { measuredAtMs, value });
        await cacheSetJson(cacheKey, { measuredAtMs, value }, Math.floor(AI_INSIGHTS_CACHE_TTL_MS / 1000));
        return value;
      })();

      aiInsightsInflight.set(cacheKey, cachedPromise);
      try {
        const value = await cachedPromise;
        const entry = aiInsightsCache.get(cacheKey);
        send(value, entry?.measuredAtMs ?? Date.now());
      } finally {
        aiInsightsInflight.delete(cacheKey);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("AI insights refresh error:", err);
      const message = err instanceof Error ? err.message : "Unknown error";
      res.status(500).json({ error: "ai_error", message });
    }
  });

  /* GET /api/ai/landing-topics — AI 유입 랜딩페이지 토픽 추출 (LLM/휴리스틱) */
  router.get("/api/ai/landing-topics", async (req: Request, res: Response) => {
    try {
      const startDateParam = typeof req.query.startDate === "string" ? req.query.startDate : undefined;
      const endDateParam = typeof req.query.endDate === "string" ? req.query.endDate : undefined;
      const range = resolveIsoDateRange({
        startDateParam,
        endDateParam,
        defaultStartDate: daysAgo(30),
        defaultEndDate: daysAgo(1),
      });

      if (!range.ok) {
        res.status(400).json({ error: range.error, details: range.details });
        return;
      }

      const { startDate, endDate } = range;

      const topPagesRaw = typeof req.query.topPages === "string" ? parseInt(req.query.topPages, 10) : Number.NaN;
      const topQueriesRaw = typeof req.query.topQueries === "string" ? parseInt(req.query.topQueries, 10) : Number.NaN;
      const topPages = Number.isFinite(topPagesRaw) ? Math.max(1, Math.min(20, topPagesRaw)) : 8;
      const topQueries = Number.isFinite(topQueriesRaw) ? Math.max(1, Math.min(10, topQueriesRaw)) : 3;
      const referralOnly = req.query.referralOnly === "1" || req.query.referralOnly === "true";
      const forceRefresh = req.query.refresh === "1";

      const methodRaw = typeof req.query.method === "string" ? req.query.method.trim() : "";
      const requestedMethod = methodRaw === "heuristic" ? "heuristic" : "llm";
      const method: LandingTopicsResponse["method"] = requestedMethod === "llm" && isOpenAIConfigured() ? "llm" : "heuristic";
      const model = method === "llm" ? env.OPENAI_MODEL : null;

      const cacheKey = [
        "landing_topics",
        startDate,
        endDate,
        topPages,
        topQueries,
        referralOnly ? "referralOnly" : "any",
        method,
        model ?? "none",
      ].join("|");

      const now = Date.now();
      const cached = landingTopicsCache.get(cacheKey);

      const send = (payload: LandingTopicsResponse, meta: { source: "cache" | "live"; measuredAtMs: number }) => {
        const ttlSeconds = Math.floor(LANDING_TOPICS_CACHE_TTL_MS / 1000);
        res.json({
          ...payload,
          _meta: {
            source: meta.source,
            method: payload.method,
            model: payload.model,
            generatedAt: new Date(meta.measuredAtMs).toISOString(),
            expiresAt: new Date(meta.measuredAtMs + LANDING_TOPICS_CACHE_TTL_MS).toISOString(),
            ttl: ttlSeconds,
          },
        });
      };

      if (!forceRefresh && cached && now - cached.measuredAtMs < LANDING_TOPICS_CACHE_TTL_MS) {
        send(cached.value, { source: "cache", measuredAtMs: cached.measuredAtMs });
        return;
      }

      if (!forceRefresh) {
        const redisCached = await cacheGetJson<LandingTopicsCacheEntry>(cacheKey);
        if (redisCached && now - redisCached.measuredAtMs < LANDING_TOPICS_CACHE_TTL_MS) {
          landingTopicsCache.set(cacheKey, redisCached);
          send(redisCached.value, { source: "cache", measuredAtMs: redisCached.measuredAtMs });
          return;
        }

        const running = landingTopicsInflight.get(cacheKey);
        if (running) {
          const value = await running;
          const entry = landingTopicsCache.get(cacheKey);
          send(value, { source: "live", measuredAtMs: entry?.measuredAtMs ?? Date.now() });
          return;
        }
      }

      const heuristicLabel = (landingPath: string, queries: string[]) => {
        const clean = (s: string) => s.replace(/\s+/g, " ").trim();
        const qs = queries.map(clean).filter(Boolean);
        const lastSeg = landingPath.split("?")[0]!.split("/").filter(Boolean).slice(-1)[0] ?? landingPath;
        const segTopic = clean(lastSeg.replace(/[-_]/g, " ")).slice(0, 30);

        const topics = [...new Set([...(qs.slice(0, 3)), ...(segTopic ? [segTopic] : [])])]
          .map((t) => t.slice(0, 30))
          .slice(0, 5);

        const summary = qs[0] ? `${qs[0]} 관련 랜딩` : segTopic ? `${segTopic} 관련 랜딩` : "AI 유입 랜딩";
        const likelyQuestions = qs.slice(0, 2).map((q) => (q.endsWith("?") ? q : `${q}?`));

        return {
          topics: topics.length > 0 ? topics : ["기타"],
          summary: summary.slice(0, 60),
          likelyQuestions: likelyQuestions.length > 0 ? likelyQuestions : ["이 페이지는 어떤 내용인가요?"],
        };
      };

      const promise = (async (): Promise<LandingTopicsResponse> => {
        const notes: string[] = [];

        // 1) GA4: AI 유입 랜딩페이지 TOP
        let landingRows: {
          landingPagePlusQueryString: string;
          sessions: number;
          ecommercePurchases: number;
          grossPurchaseRevenue: number;
        }[] = [];

        try {
          const ai = await queryGA4AiTrafficDetailed({ startDate, endDate, limit: topPages, referralOnly, forceRefresh });
          landingRows = (ai.byLandingPage ?? []).map((r) => ({
            landingPagePlusQueryString: r.landingPagePlusQueryString,
            sessions: r.sessions,
            ecommercePurchases: r.ecommercePurchases,
            grossPurchaseRevenue: r.grossPurchaseRevenue,
          }));
          notes.push(`GA4: AI 유입 랜딩 TOP ${landingRows.length}건`);
          if (ai.debug?.notes?.length) notes.push(...ai.debug.notes.map((n) => `GA4: ${n}`));
        } catch (error) {
          const message = error instanceof Error ? error.message : "GA4 AI traffic query failed";
          notes.push(`GA4 조회 실패: ${message}`);
          landingRows = [];
        }

        // 2) GSC: landingPath별 top queries (best-effort)
        const basePages = await withConcurrency(
          landingRows,
          3,
          async (row): Promise<Omit<LandingTopicsPage, "topics" | "summary" | "likelyQuestions">> => {
            const landingPath = (row.landingPagePlusQueryString || "").split("?")[0] ?? "";
            const gscTopQueries: LandingTopicsQuery[] = [];

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
              landingPath,
              aiSessions: row.sessions,
              ecommercePurchases: row.ecommercePurchases,
              grossPurchaseRevenue: row.grossPurchaseRevenue,
              gscTopQueries,
            };
          },
        );

        // 3) LLM 토픽 추출(가능한 경우), 아니면 휴리스틱
        let pages: LandingTopicsPage[] = basePages.map((p) => {
          const topQueryStrings = p.gscTopQueries.map((q) => q.query).filter(Boolean);
          const label = heuristicLabel(p.landingPath, topQueryStrings);
          return { ...p, ...label };
        });

        if (method === "llm") {
          try {
            const client = new OpenAI({ apiKey: env.OPENAI_API_KEY! });
            const inputs = basePages.map((p) => ({
              landingPath: p.landingPath,
              sessions: p.aiSessions,
              ecommercePurchases: p.ecommercePurchases,
              grossPurchaseRevenue: p.grossPurchaseRevenue,
              topQueries: p.gscTopQueries.map((q) => q.query).filter(Boolean).slice(0, topQueries),
            }));

            const system = `당신은 biocom.kr(바이오컴)의 SEO/AEO 콘텐츠 전략가입니다.
입력은 AI 유입 랜딩페이지 목록과 해당 페이지의 상위 검색어입니다.

각 페이지마다 아래 정보를 생성하세요:
- topics: 3~5개의 한국어 토픽(2~6단어, 짧게)
- summary: 한 문장 요약(60자 이내)
- likelyQuestions: 사용자가 AI에서 물었을 법한 질문 2개(각 30자 이내)

반드시 JSON 배열로만 응답하세요 (마크다운/설명 금지).
형식:
[
  {"landingPath": "/path", "topics": ["..."], "summary": "...", "likelyQuestions": ["...","..."]}
]`;

            const resp = await client.chat.completions.create({
              model: env.OPENAI_MODEL,
              messages: [
                { role: "system", content: system },
                { role: "user", content: JSON.stringify(inputs) },
              ],
              max_completion_tokens: 2000,
            });

            const raw = resp.choices[0]?.message?.content?.trim() ?? "[]";
            const cleaned = raw.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "").trim();

            let parsed: unknown = [];
            try {
              parsed = JSON.parse(cleaned);
            } catch {
              parsed = [];
            }

            const map = new Map<string, { topics: string[]; summary: string; likelyQuestions: string[] }>();
            if (Array.isArray(parsed)) {
              for (const item of parsed) {
                const v = item as { landingPath?: unknown; topics?: unknown; summary?: unknown; likelyQuestions?: unknown } | null;
                if (!v || typeof v.landingPath !== "string") continue;
                const topics = Array.isArray(v.topics) ? v.topics.filter((t) => typeof t === "string").map((t) => t.trim()).filter(Boolean) : [];
                const summary = typeof v.summary === "string" ? v.summary.trim() : "";
                const likelyQuestions = Array.isArray(v.likelyQuestions)
                  ? v.likelyQuestions.filter((t) => typeof t === "string").map((t) => t.trim()).filter(Boolean)
                  : [];
                if (topics.length === 0 && !summary && likelyQuestions.length === 0) continue;
                map.set(v.landingPath, {
                  topics: topics.slice(0, 5),
                  summary: summary.slice(0, 60),
                  likelyQuestions: likelyQuestions.slice(0, 2),
                });
              }
            }

            pages = basePages.map((p) => {
              const fromLlm = map.get(p.landingPath);
              if (fromLlm) {
                const fallback = heuristicLabel(p.landingPath, p.gscTopQueries.map((q) => q.query).filter(Boolean));
                return {
                  ...p,
                  topics: fromLlm.topics.length > 0 ? fromLlm.topics : fallback.topics,
                  summary: fromLlm.summary || fallback.summary,
                  likelyQuestions: fromLlm.likelyQuestions.length > 0 ? fromLlm.likelyQuestions : fallback.likelyQuestions,
                };
              }
              const fallback = heuristicLabel(p.landingPath, p.gscTopQueries.map((q) => q.query).filter(Boolean));
              return { ...p, ...fallback };
            });

            notes.push(`LLM 토픽 추출: ${pages.length}건 (model=${env.OPENAI_MODEL})`);
          } catch (error) {
            const message = error instanceof Error ? error.message : "OpenAI request failed";
            notes.push(`LLM 실패 → 휴리스틱 대체: ${message}`);
          }
        } else {
          notes.push("OPENAI 미설정 또는 method=heuristic → 휴리스틱으로 토픽 생성");
        }

        return {
          range: { startDate, endDate },
          topPages,
          topQueries,
          referralOnly,
          method,
          model,
          pages,
          debug: { notes },
        };
      })();

      const cachedPromise = (async () => {
        const value = await promise;
        const measuredAtMs = Date.now();
        landingTopicsCache.set(cacheKey, { measuredAtMs, value });
        void cacheSetJson(cacheKey, { measuredAtMs, value }, Math.floor(LANDING_TOPICS_CACHE_TTL_MS / 1000));
        return value;
      })();

      landingTopicsInflight.set(cacheKey, cachedPromise);
      try {
        const value = await cachedPromise;
        const entry = landingTopicsCache.get(cacheKey);
        send(value, { source: "live", measuredAtMs: entry?.measuredAtMs ?? Date.now() });
      } finally {
        landingTopicsInflight.delete(cacheKey);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Landing topics failed";
      res.status(500).json({ error: "landing_topics_error", message });
    }
  });

  router.post("/api/ai/chat", async (req: Request, res: Response) => {
    if (!isOpenAIConfigured()) {
      res.status(503).json({ error: "openai_not_configured", message: "OPENAI_API_KEY is not set" });
      return;
    }

    const parsed = chatSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "validation_error", issues: parsed.error.issues });
      return;
    }

    try {
      const reply = await aiChat(parsed.data.messages as ChatMessage[]);
      res.json({
        reply,
        model: env.OPENAI_MODEL,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("AI chat error:", err);
      const message = err instanceof Error ? err.message : "Unknown error";
      res.status(500).json({ error: "ai_error", message });
    }
  });

  /* GET /api/keywords/intent — GSC 키워드 기반 인텐트 분류 */
  router.get("/api/keywords/intent", async (req: Request, res: Response) => {
    try {
      const endDate = new Date();
      endDate.setDate(endDate.getDate() - 2);
      const startDate = new Date(endDate);
      startDate.setDate(startDate.getDate() - 27);
      const fmt = (d: Date) => d.toISOString().slice(0, 10);

      const weightRaw = typeof req.query.weight === "string" ? req.query.weight.trim() : "";
      const weight = weightRaw === "impressions" || weightRaw === "count" ? weightRaw : "clicks";

      const gscResult = await queryGscSearchAnalytics({
        startDate: fmt(startDate),
        endDate: fmt(endDate),
        dimensions: ["query"],
        rowLimit: 100,
        startRow: 0,
      });

      const keywords = (gscResult.rows ?? []).map((r) => ({
        query: r.keys?.[0] ?? "",
        clicks: r.clicks ?? 0,
        impressions: r.impressions ?? 0,
      }));

      const intentResult = await classifyKeywordIntents(keywords, { weight });

      res.json({
        ...intentResult,
        period: `${fmt(startDate)} ~ ${fmt(endDate)}`,
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Keyword intent error:", err);
      const message = err instanceof Error ? err.message : "Unknown error";
      res.status(500).json({ error: "intent_error", message });
    }
  });

  return router;
};
