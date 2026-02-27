import express, { type Request, type Response } from "express";
import { promises as fsPromises } from "node:fs";
import path from "node:path";

import { env } from "../env";
import { queryGscSearchAnalytics } from "../gsc";
import { calculateAeoScore, calculateGeoScore } from "../scoring";
import { measureAiCitation } from "../aiCitation";
import { measureAiCitationMulti } from "../aiCitationMulti";
import { isSerpApiConfigured } from "../serpapi";
import { getAllCachedResults, getCachedResult, type PageSpeedStrategy } from "../pagespeed";
import type { CrawlResult } from "../crawl";
import { queryGA4AiTraffic } from "../ga4";
import { daysAgo } from "../utils/dateUtils";

import { getCrawlData } from "./crawl";

/* Q&A 키워드 자동 분류 패턴 */
const QA_PATTERNS = [
  /무엇/, /어떻게/, /왜/, /언제/, /어디/,
  /증상/, /효능/, /효과/, /부작용/, /방법/,
  /차이/, /원인/, /치료/, /예방/, /관리/,
  /좋은/, /나쁜/, /추천/, /비교/, /가격/,
  /what/i, /how/i, /why/i, /best/i, /vs/i,
];

const isQAKeyword = (query: string) => QA_PATTERNS.some((p) => p.test(query));

/* ── 진단 히스토리 (JSON 파일 기반) ── */
const HISTORY_DIR = path.join(process.cwd(), "data");
const HISTORY_FILE = path.join(HISTORY_DIR, "diagnosis-history.json");

type DiagnosisRecord = {
  id: string;
  url: string;
  mode: "quick" | "detailed";
  aeoScore: number | null;
  geoScore: number | null;
  crawlSummary: {
    schemaTypes: string[];
    wordCount: number;
    h2Count: number;
    h3Count: number;
    hasMetaDescription: boolean;
  } | null;
  createdAt: string;
};

const loadHistory = async (): Promise<DiagnosisRecord[]> => {
  try {
    const raw = await fsPromises.readFile(HISTORY_FILE, "utf-8");
    return JSON.parse(raw) as DiagnosisRecord[];
  } catch {
    return [];
  }
};

const saveHistory = async (records: DiagnosisRecord[]): Promise<void> => {
  await fsPromises.mkdir(HISTORY_DIR, { recursive: true });
  await fsPromises.writeFile(HISTORY_FILE, JSON.stringify(records, null, 2), "utf-8");
};

export const createDiagnosisRouter = () => {
  const router = express.Router();

  /* ═══════════════════════════════════════
     통합 대시보드 데이터 (한번에 조회)
     ═══════════════════════════════════════ */
  router.get("/api/dashboard/overview", async (_req: Request, res: Response) => {
    try {
      const startDate = daysAgo(10);
      const endDate = daysAgo(3);

      // 병렬 조회
      const [kpiResult, trendResult, keywordsResult] = await Promise.allSettled([
        // KPI
        (async () => {
          const current = await queryGscSearchAnalytics({
            startDate,
            endDate,
            dimensions: ["date"],
            rowLimit: 10,
            startRow: 0,
          });
          const rows = current.rows as Record<string, unknown>[];
          let clicks = 0, impressions = 0, positionTotal = 0;
          for (const r of rows) {
            clicks += (r.clicks as number) ?? 0;
            impressions += (r.impressions as number) ?? 0;
            positionTotal += (r.position as number) ?? 0;
          }
          return {
            clicks,
            impressions,
            ctr: impressions > 0 ? +((clicks / impressions) * 100).toFixed(2) : 0,
            avgPosition: rows.length > 0 ? +(positionTotal / rows.length).toFixed(1) : 0,
            dailyClicks: rows.map((r) => (r.clicks as number) ?? 0),
            dailyCtr: rows.map((r) => +(((r.ctr as number) ?? 0) * 100).toFixed(2)),
            dailyPosition: rows.map((r) => +(((r.position as number) ?? 0)).toFixed(1)),
          };
        })(),
        // 30일 트렌드
        queryGscSearchAnalytics({
          startDate: daysAgo(33),
          endDate: daysAgo(3),
          dimensions: ["date"],
          rowLimit: 30,
          startRow: 0,
        }),
        // 키워드 Top 20
        queryGscSearchAnalytics({
          startDate,
          endDate,
          dimensions: ["query"],
          rowLimit: 20,
          startRow: 0,
        }),
      ]);

      res.json({
        kpi: kpiResult.status === "fulfilled" ? kpiResult.value : null,
        trend:
          trendResult.status === "fulfilled"
            ? (trendResult.value.rows as Record<string, unknown>[])
                .map((r) => ({
                  date: ((r.keys as string[])?.[0]) ?? "",
                  clicks: (r.clicks as number) ?? 0,
                  impressions: (r.impressions as number) ?? 0,
                }))
                .sort((a, b) => a.date.localeCompare(b.date))
            : null,
        keywords:
          keywordsResult.status === "fulfilled"
            ? (keywordsResult.value.rows as Record<string, unknown>[]).map((r) => {
                const q = (((r.keys as string[]) ?? [])[0]) ?? "";
                return {
                  query: q,
                  clicks: (r.clicks as number) ?? 0,
                  impressions: (r.impressions as number) ?? 0,
                  ctr: +((((r.ctr as number) ?? 0) * 100)).toFixed(2),
                  position: +(((r.position as number) ?? 0)).toFixed(1),
                  isQA: isQAKeyword(q),
                };
              })
            : null,
        pagespeed: getAllCachedResults(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Dashboard overview failed";
      res.status(500).json({ error: "dashboard_error", message });
    }
  });

  /* ── 진단 히스토리 ── */
  router.get("/api/diagnosis/history", async (_req: Request, res: Response) => {
    try {
      const records = await loadHistory();
      res.json({ records, count: records.length });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load history";
      res.status(500).json({ error: "history_error", message });
    }
  });

  router.post("/api/diagnosis/save", async (req: Request, res: Response) => {
    try {
      const body = req.body as Partial<DiagnosisRecord>;
      if (!body.url) {
        res.status(400).json({ error: "validation_error", message: "url is required" });
        return;
      }
      const record: DiagnosisRecord = {
        id: `diag_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        url: body.url,
        mode: body.mode ?? "quick",
        aeoScore: body.aeoScore ?? null,
        geoScore: body.geoScore ?? null,
        crawlSummary: body.crawlSummary ?? null,
        createdAt: new Date().toISOString(),
      };
      const records = await loadHistory();
      records.unshift(record); // 최신순
      // 최대 100건 유지
      if (records.length > 100) records.length = 100;
      await saveHistory(records);
      res.json({ success: true, record });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save history";
      res.status(500).json({ error: "history_error", message });
    }
  });

  router.delete("/api/diagnosis/history/:id", async (req: Request, res: Response) => {
    try {
      const records = await loadHistory();
      const filtered = records.filter((r) => r.id !== req.params.id);
      await saveHistory(filtered);
      res.json({ success: true, remaining: filtered.length });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete record";
      res.status(500).json({ error: "history_error", message });
    }
  });

  /* ═══════════════════════════════════════
     AEO / GEO 점수
     ═══════════════════════════════════════ */
  router.get("/api/aeo/score", async (req: Request, res: Response) => {
    try {
      const targetUrl = typeof req.query.url === "string" ? req.query.url : "";
      const strategyRaw = typeof req.query.strategy === "string" ? req.query.strategy : "mobile";
      const strategy: PageSpeedStrategy = strategyRaw === "desktop" ? "desktop" : "mobile";
      const startDate = daysAgo(10);
      const endDate = daysAgo(3);

      // 1) GSC 키워드 데이터 조회
      const keywordResult = await queryGscSearchAnalytics({
        startDate,
        endDate,
        dimensions: ["query"],
        rowLimit: 500,
        startRow: 0,
      });

      const rows = keywordResult.rows as Record<string, unknown>[];
      const totalKeywords = rows.length;
      let qaKeywords = 0;
      let opportunityKeywords = 0;
      let keywordsInTop3 = 0;
      let keywordsInTop10 = 0;
      const keywordMetrics: { query: string; impressions: number; clicks: number }[] = [];

      for (const row of rows) {
        const query = (((row.keys as string[]) ?? [])[0]) ?? "";
        const position = (row.position as number) ?? 999;
        const impressions = (row.impressions as number) ?? 0;
        const clicks = (row.clicks as number) ?? 0;
        const ctr = (row.ctr as number) ?? 0;

        if (query) keywordMetrics.push({ query, impressions, clicks });
        if (isQAKeyword(query)) qaKeywords++;
        if (impressions > 500 && ctr < 0.02) opportunityKeywords++;
        if (position <= 3) keywordsInTop3++;
        if (position <= 10) keywordsInTop10++;
      }

      // 2) 크롤 데이터 (캐시 or 실시간)
      let crawlData: CrawlResult | null = null;
      if (targetUrl) {
        try {
          crawlData = await getCrawlData(targetUrl);
        } catch {
          // crawl failure is non-fatal
          crawlData = null;
        }
      }

      // 3) PageSpeed 성능 점수
      const psResult = targetUrl
        ? (getCachedResult(targetUrl, strategy) ??
            getCachedResult(targetUrl, strategy === "mobile" ? "desktop" : "mobile"))
        : undefined;

      // 4) GA4: AI 추천(referral) 유입 트래픽 (최근 30일)
      let aiTraffic:
        | {
            startDate: string;
            endDate: string;
            aiSessions: number;
            totalSessions: number;
            sources: { source: string; sessions: number }[];
          }
        | null = null;
      try {
        aiTraffic = await queryGA4AiTraffic(daysAgo(30), daysAgo(1));
      } catch {
        aiTraffic = null;
      }

      // 5) AI 답변 인용 빈도(표본 측정 + 캐시) — Google AIO + ChatGPT(Search) + Perplexity
      let aiCitation = null;
      try {
        const forceRefresh = req.query.refresh === "1";
        // KR 운영 점수는 ChatGPT(Search)/Perplexity 중심으로 보고, SerpAPI(Google AIO)는 필요 시 디버그 API로만 호출하는 편이 비용/신뢰도 측면에서 유리합니다.
        const providers: ("google_ai_overview" | "chatgpt_search" | "perplexity")[] = [];
        if (env.OPENAI_API_KEY) providers.push("chatgpt_search");
        if (env.PERPLEXITY_API_KEY) providers.push("perplexity");
        aiCitation = await measureAiCitationMulti({ keywords: keywordMetrics, sampleSize: 5, forceRefresh, providers });
        if (!aiCitation && isSerpApiConfigured()) {
          aiCitation = await measureAiCitationMulti({
            keywords: keywordMetrics,
            sampleSize: 5,
            forceRefresh,
            providers: ["google_ai_overview"],
          });
        }
      } catch {
        aiCitation = null;
      }

      const result = calculateAeoScore({
        totalKeywords,
        qaKeywords,
        opportunityKeywords,
        keywordsInTop3,
        keywordsInTop10,
        schema: crawlData?.schema ?? null,
        content: crawlData?.content ?? null,
        performanceScore: psResult?.performanceScore ?? null,
        aiCitation,
        aiTraffic,
      });

      res.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "AEO score failed";
      res.status(500).json({ error: "aeo_score_error", message });
    }
  });

  router.get("/api/geo/score", async (req: Request, res: Response) => {
    try {
      const targetUrl = typeof req.query.url === "string" ? req.query.url : "";
      const strategyRaw = typeof req.query.strategy === "string" ? req.query.strategy : "mobile";
      const strategy: PageSpeedStrategy = strategyRaw === "desktop" ? "desktop" : "mobile";
      const startDate = daysAgo(10);
      const endDate = daysAgo(3);

      // 1) GSC 키워드 데이터 (순위 기반)
      const keywordResult = await queryGscSearchAnalytics({
        startDate,
        endDate,
        dimensions: ["query"],
        rowLimit: 500,
        startRow: 0,
      });

      const rows = keywordResult.rows as Record<string, unknown>[];
      const totalKeywords = rows.length;
      let keywordsInTop3 = 0;
      let keywordsInTop10 = 0;

      for (const row of rows) {
        const position = (row.position as number) ?? 999;
        if (position <= 3) keywordsInTop3++;
        if (position <= 10) keywordsInTop10++;
      }

      // 2) CTR 트렌드 (현재 vs 이전 7일)
      const [currentCtr, prevCtr] = await Promise.all([
        queryGscSearchAnalytics({
          startDate: daysAgo(10),
          endDate: daysAgo(3),
          dimensions: ["date"],
          rowLimit: 10,
          startRow: 0,
        }),
        queryGscSearchAnalytics({
          startDate: daysAgo(17),
          endDate: daysAgo(11),
          dimensions: ["date"],
          rowLimit: 10,
          startRow: 0,
        }),
      ]);

      const avgCtr = (result: { rows: unknown[] }) => {
        const r = result.rows as Record<string, unknown>[];
        if (r.length === 0) return 0;
        const sum = r.reduce((s, row) => s + ((row.ctr as number) ?? 0), 0);
        return sum / r.length;
      };

      const ctrCurrent = avgCtr(currentCtr);
      const ctrPrevious = avgCtr(prevCtr);

      // 3) 크롤 데이터
      let crawlData: CrawlResult | null = null;
      if (targetUrl) {
        try {
          crawlData = await getCrawlData(targetUrl);
        } catch {
          crawlData = null;
        }
      }

      // 4) PageSpeed
      const psResult = targetUrl
        ? (getCachedResult(targetUrl, strategy) ??
            getCachedResult(targetUrl, strategy === "mobile" ? "desktop" : "mobile"))
        : undefined;

      // 5) SerpAPI: AI Overview 인용 측정 (캐시 공유)
      let aiCitationGeo:
        | {
            sampled: number;
            aiOverviewPresent: number;
            citedQueries: number;
            citedReferences: number;
            citationRateAmongAiOverview: number;
            siteHost: string;
            measuredAt: string;
            samples: { query: string; cited: boolean }[];
          }
        | null = null;
      if (isSerpApiConfigured()) {
        try {
          const keywordMetrics = rows.map((r) => ({
            query: ((r.keys as string[]) ?? [""])[0],
            clicks: (r.clicks as number) ?? 0,
          }));
          const measured = await measureAiCitation({ keywords: keywordMetrics, sampleSize: 5, forceRefresh: false });
          aiCitationGeo = measured
            ? {
                sampled: measured.sampled,
                aiOverviewPresent: measured.aiOverviewPresent,
                citedQueries: measured.citedQueries,
                citedReferences: measured.citedReferences,
                citationRateAmongAiOverview: measured.citationRateAmongAiOverview,
                siteHost: measured.siteHost,
                measuredAt: measured.measuredAt,
                samples: measured.samples.map((s) => ({ query: s.query, cited: s.cited })),
              }
            : null;
        } catch {
          aiCitationGeo = null;
        }
      }

      const result = calculateGeoScore({
        totalKeywords,
        keywordsInTop3,
        keywordsInTop10,
        performanceScore: psResult?.performanceScore ?? null,
        seoScore: psResult?.seoScore ?? null,
        ctrCurrent,
        ctrPrevious,
        schema: crawlData?.schema ?? null,
        content: crawlData?.content ?? null,
        aiCitation: aiCitationGeo,
      });

      res.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "GEO score failed";
      res.status(500).json({ error: "geo_score_error", message });
    }
  });

  return router;
};

