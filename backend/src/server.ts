import cors from "cors";
import express, { NextFunction, Request, Response } from "express";
import { z } from "zod";

import { env } from "./env";
import { listGscSites, queryGscSearchAnalytics, type GscDimension } from "./gsc";
import {
  runPageSpeedTest,
  setCachedResult,
  getCachedResult,
  getAllCachedResults,
  type PageSpeedStrategy,
  type PageSpeedResult,
} from "./pagespeed";
import { queryGA4AiTraffic, queryGA4Engagement, queryGA4Funnel } from "./ga4";
import { getSupabaseAdminClient } from "./supabase";
import { resolvePageTitles } from "./pageTitle";
import { crawlAndAnalyze, type CrawlResult } from "./crawl";
import { calculateAeoScore, calculateGeoScore } from "./scoring";
import { generateInsights, chat as aiChat, isOpenAIConfigured, type ChatMessage } from "./ai";
import { classifyKeywordIntents } from "./intent";

const app = express();

/* ── CORS: 다중 오리진 지원 ── */
const allowedOrigins = [
  env.FRONTEND_ORIGIN,
  "http://localhost:3000",
  "http://localhost:7010",
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS blocked: ${origin}`));
      }
    },
  }),
);
app.use(express.json());

/* ═══════════════════════════════════════
   Zod 스키마
   ═══════════════════════════════════════ */
const gscDimensionSchema = z.enum([
  "date",
  "query",
  "page",
  "country",
  "device",
  "searchAppearance",
]);

const gscQuerySchema = z
  .object({
    siteUrl: z.string().min(1).optional(),
    startDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "startDate must use YYYY-MM-DD"),
    endDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "endDate must use YYYY-MM-DD"),
    dimensions: z.array(gscDimensionSchema).min(1).max(5).default(["page", "query"]),
    rowLimit: z.coerce.number().int().min(1).max(25000).default(50),
    startRow: z.coerce.number().int().min(0).default(0),
    type: z.enum(["web", "image", "video", "news", "discover", "googleNews"]).optional(),
    aggregationType: z.enum(["auto", "byPage", "byProperty"]).optional(),
  })
  .refine((payload) => payload.startDate <= payload.endDate, {
    message: "startDate must be before or equal to endDate",
    path: ["startDate"],
  });

/* ═══════════════════════════════════════
   유틸리티
   ═══════════════════════════════════════ */
const toDateString = (date: Date) => date.toISOString().slice(0, 10);

const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toDateString(d);
};

/* Q&A 키워드 자동 분류 패턴 */
const QA_PATTERNS = [
  /무엇/, /어떻게/, /왜/, /언제/, /어디/,
  /증상/, /효능/, /효과/, /부작용/, /방법/,
  /차이/, /원인/, /치료/, /예방/, /관리/,
  /좋은/, /나쁜/, /추천/, /비교/, /가격/,
  /what/i, /how/i, /why/i, /best/i, /vs/i,
];

const isQAKeyword = (query: string) =>
  QA_PATTERNS.some((p) => p.test(query));

const supabase = getSupabaseAdminClient();

const requireCronSecret = (req: Request, res: Response, next: NextFunction) => {
  if (!env.CRON_SECRET) {
    next();
    return;
  }

  const headerSecret = req.header("x-cron-secret");
  const querySecret = typeof req.query.secret === "string" ? req.query.secret : undefined;
  const provided = headerSecret ?? querySecret;

  if (provided !== env.CRON_SECRET) {
    res.status(401).json({ error: "unauthorized", message: "Missing or invalid cron secret" });
    return;
  }

  next();
};

const persistPageSpeedResult = async (result: PageSpeedResult) => {
  if (!supabase) return { ok: false, reason: "supabase_not_configured" as const };

  const { error } = await supabase.from("pagespeed_weekly").insert({
    measured_at: result.measuredAt,
    url: result.url,
    strategy: result.strategy,
    performance_score: result.performanceScore,
    seo_score: result.seoScore,
    accessibility_score: result.accessibilityScore,
    lcp_ms: result.lcpMs,
    fcp_ms: result.fcpMs,
    cls: result.cls,
    inp_ms: result.inpMs,
    ttfb_ms: result.ttfbMs,
  });

  if (error) return { ok: false, reason: "insert_failed" as const, message: error.message };
  return { ok: true as const };
};

/* ═══════════════════════════════════════
   Health
   ═══════════════════════════════════════ */
app.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    service: "biocom-seo-backend",
    timestamp: new Date().toISOString(),
    apis: {
      gsc: !!env.GSC_SERVICE_ACCOUNT_KEY,
      pagespeed: !!env.PAGESPEED_API_KEY,
      ga4: !!env.GA4_PROPERTY_ID && !!env.GA4_SERVICE_ACCOUNT_KEY,
      supabase: !!env.NEXT_PUBLIC_SUPABASE_URL && !!env.SUPABASE_SERVICE_ROLE_KEY,
      openai: isOpenAIConfigured(),
    },
  });
});

/* ═══════════════════════════════════════
   GSC 기존 엔드포인트
   ═══════════════════════════════════════ */
app.get("/api/gsc/sites", async (_req: Request, res: Response) => {
  try {
    const sites = await listGscSites();
    res.json({ sites });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list sites";
    res.status(500).json({ error: "gsc_sites_error", message });
  }
});

app.post("/api/gsc/query", async (req: Request, res: Response) => {
  const parsed = gscQuerySchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: "validation_error",
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
    return;
  }

  try {
    const result = await queryGscSearchAnalytics(parsed.data);
    res.json({
      ...result,
      rowCount: result.rows.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to query GSC";
    res.status(500).json({ error: "gsc_query_error", message });
  }
});

/* ═══════════════════════════════════════
   Cron (DB 적재용)
   ═══════════════════════════════════════ */
app.post("/api/cron/gsc/daily", requireCronSecret, async (req: Request, res: Response) => {
  if (!supabase) {
    res.status(400).json({ error: "supabase_not_configured" });
    return;
  }

  const bodySchema = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    siteUrl: z.string().min(1).optional(),
    pagePathPrefix: z.string().min(1).default("/healthinfo/"),
  });

  const parsed = bodySchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", issues: parsed.error.issues });
    return;
  }

  const targetDate = parsed.data.date ?? daysAgo(3); // GSC 2~3일 딜레이 감안
  const siteUrl = parsed.data.siteUrl ?? env.GSC_SITE_URL;
  const pagePathPrefix = parsed.data.pagePathPrefix;

  const dimensions: GscDimension[] = ["page", "query", "device", "country"];
  const rows: Record<string, unknown>[] = [];

  let startRow = 0;
  const rowLimit = 25000;
  const maxTotalRows = 100000;

  while (startRow < maxTotalRows) {
    const result = await queryGscSearchAnalytics({
      siteUrl,
      startDate: targetDate,
      endDate: targetDate,
      dimensions,
      rowLimit,
      startRow,
    });

    const chunk = (result.rows ?? []) as Record<string, unknown>[];
    if (chunk.length === 0) break;
    rows.push(...chunk);

    if (chunk.length < rowLimit) break;
    startRow += rowLimit;
  }

  const normalizePageUrl = (rawUrl: string) => {
    try {
      const url = new URL(rawUrl.trim());
      url.hash = "";
      if (url.pathname !== "/" && url.pathname.endsWith("/")) {
        url.pathname = url.pathname.slice(0, -1);
      }
      return url.toString();
    } catch {
      return rawUrl.trim();
    }
  };

  const shouldIncludePage = (pageUrl: string) => {
    try {
      return new URL(pageUrl).pathname.startsWith(pagePathPrefix);
    } catch {
      return pageUrl.includes(pagePathPrefix);
    }
  };

  const records = rows
    .map((row) => {
      const keys = (row.keys as string[] | undefined) ?? [];
      const page = normalizePageUrl(keys[0] ?? "");
      const query = keys[1] ?? "";
      const device = keys[2] ?? "";
      const country = keys[3] ?? "";
      if (!page) return null;
      if (!shouldIncludePage(page)) return null;
      return {
        date: targetDate,
        page,
        query,
        device,
        country,
        clicks: (row.clicks as number) ?? 0,
        impressions: (row.impressions as number) ?? 0,
        ctr: (row.ctr as number) ?? 0,
        position: (row.position as number) ?? 0,
      };
    })
    .filter((v): v is NonNullable<typeof v> => v !== null);

  const chunkSize = 500;
  let attempted = 0;
  const errors: { batch: number; message: string }[] = [];
  for (let i = 0; i < records.length; i += chunkSize) {
    const batch = records.slice(i, i + chunkSize);
    attempted += batch.length;
    const { error } = await supabase
      .from("gsc_daily_metrics")
      .upsert(batch, { onConflict: "date,page,query,device,country" });
    if (error) errors.push({ batch: i / chunkSize + 1, message: error.message });
  }

  res.json({
    ok: errors.length === 0,
    siteUrl,
    date: targetDate,
    pagePathPrefix,
    totalRowsFetched: rows.length,
    totalRowsIncluded: records.length,
    attemptedUpserts: attempted,
    errors,
  });
});

/* ═══════════════════════════════════════
   GSC 트렌드 (일별 클릭/노출)
   ═══════════════════════════════════════ */
app.get("/api/gsc/trends", async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string, 10) || 30;
    const startDate = daysAgo(days + 3); // GSC has 2-3 day reporting delay
    const endDate = daysAgo(3);

    const result = await queryGscSearchAnalytics({
      startDate,
      endDate,
      dimensions: ["date"],
      rowLimit: days,
      startRow: 0,
    });

    const trend = (result.rows ?? [])
      .map((row) => ({
        date: row.keys?.[0] ?? "",
        clicks: row.clicks ?? 0,
        impressions: row.impressions ?? 0,
        ctr: row.ctr ?? 0,
        position: row.position ?? 0,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    res.json({ days, startDate, endDate, trend });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to get trends";
    res.status(500).json({ error: "gsc_trends_error", message });
  }
});

/* ═══════════════════════════════════════
   GSC KPI 요약 (7일)
   ═══════════════════════════════════════ */
app.get("/api/gsc/kpi", async (_req: Request, res: Response) => {
  try {
    // 현재 7일
    const currentStart = daysAgo(10); // reporting delay
    const currentEnd = daysAgo(3);
    const current = await queryGscSearchAnalytics({
      startDate: currentStart,
      endDate: currentEnd,
      dimensions: ["date"],
      rowLimit: 10,
      startRow: 0,
    });

    // 이전 7일
    const prevStart = daysAgo(17);
    const prevEnd = daysAgo(11);
    const previous = await queryGscSearchAnalytics({
      startDate: prevStart,
      endDate: prevEnd,
      dimensions: ["date"],
      rowLimit: 10,
      startRow: 0,
    });

    const sumMetrics = (rows: Record<string, unknown>[]) => {
      let clicks = 0, impressions = 0, positionTotal = 0, count = 0;
      for (const row of rows) {
        clicks += (row.clicks as number) ?? 0;
        impressions += (row.impressions as number) ?? 0;
        positionTotal += (row.position as number) ?? 0;
        count++;
      }
      return {
        clicks,
        impressions,
        ctr: impressions > 0 ? clicks / impressions : 0,
        avgPosition: count > 0 ? positionTotal / count : 0,
        days: count,
      };
    };

    const cur = sumMetrics(current.rows as Record<string, unknown>[]);
    const prev = sumMetrics(previous.rows as Record<string, unknown>[]);

    const deltaPercent = (curVal: number, prevVal: number) =>
      prevVal === 0 ? 0 : +((curVal - prevVal) / prevVal * 100).toFixed(1);

    // 일별 스파크라인
    const dailyClicks = (current.rows as Record<string, unknown>[])
      .map((r) => (r.clicks as number) ?? 0)
      .slice(-7);
    const dailyCtr = (current.rows as Record<string, unknown>[])
      .map((r) => (r.ctr as number) ?? 0)
      .slice(-7);
    const dailyPosition = (current.rows as Record<string, unknown>[])
      .map((r) => (r.position as number) ?? 0)
      .slice(-7);

    res.json({
      current: cur,
      previous: prev,
      delta: {
        clicks: deltaPercent(cur.clicks, prev.clicks),
        ctr: +(cur.ctr * 100 - prev.ctr * 100).toFixed(2),
        position: +(prev.avgPosition - cur.avgPosition).toFixed(1),
      },
      sparklines: {
        clicks: dailyClicks,
        ctr: dailyCtr.map((v) => +(v * 100).toFixed(2)),
        position: dailyPosition.map((v) => +v.toFixed(1)),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to get KPI";
    res.status(500).json({ error: "gsc_kpi_error", message });
  }
});

/* ═══════════════════════════════════════
   GSC 키워드 분석 (Q&A 자동 태깅)
   ═══════════════════════════════════════ */
app.get("/api/gsc/keywords", async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string, 10) || 50;
    const startDateQuery = typeof req.query.startDate === "string" ? req.query.startDate : undefined;
    const endDateQuery = typeof req.query.endDate === "string" ? req.query.endDate : undefined;
    const daysQuery = typeof req.query.days === "string" ? parseInt(req.query.days, 10) : Number.NaN;

    const isDateString = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

    let startDate = daysAgo(10);
    let endDate = daysAgo(3);

    if ((startDateQuery && !endDateQuery) || (!startDateQuery && endDateQuery)) {
      res.status(400).json({
        error: "invalid_range",
        message: "startDate and endDate must be provided together (YYYY-MM-DD)",
      });
      return;
    }

    if (startDateQuery && endDateQuery) {
      if (!isDateString(startDateQuery) || !isDateString(endDateQuery)) {
        res.status(400).json({
          error: "invalid_date",
          message: "startDate/endDate must use YYYY-MM-DD",
        });
        return;
      }
      if (startDateQuery > endDateQuery) {
        res.status(400).json({
          error: "invalid_range",
          message: "startDate must be before or equal to endDate",
        });
        return;
      }
      startDate = startDateQuery;
      endDate = endDateQuery;
    } else if (Number.isFinite(daysQuery) && daysQuery > 0) {
      const days = Math.min(Math.max(daysQuery, 1), 180);
      endDate = daysAgo(3); // keep GSC reporting latency buffer
      startDate = daysAgo(days + 3);
    }

    const result = await queryGscSearchAnalytics({
      startDate,
      endDate,
      dimensions: ["query"],
      rowLimit: limit,
      startRow: 0,
    });

    const keywords = (result.rows as Record<string, unknown>[]).map((row) => {
      const keys = row.keys as string[] | undefined;
      const query = keys?.[0] ?? "";
      const clicks = (row.clicks as number) ?? 0;
      const impressions = (row.impressions as number) ?? 0;
      const ctr = (row.ctr as number) ?? 0;
      const position = (row.position as number) ?? 0;

      return {
        query,
        clicks,
        impressions,
        ctr: +(ctr * 100).toFixed(2),
        position: +position.toFixed(1),
        isQA: isQAKeyword(query),
        opportunity: impressions > 500 && ctr < 0.02, // 노출 높은데 CTR 낮음
      };
    });

    res.json({
      startDate,
      endDate,
      totalKeywords: keywords.length,
      qaKeywords: keywords.filter((k) => k.isQA).length,
      opportunityKeywords: keywords.filter((k) => k.opportunity).length,
      keywords,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to get keywords";
    res.status(500).json({ error: "gsc_keywords_error", message });
  }
});

/* ═══════════════════════════════════════
   GSC 칼럼별 분석 (페이지 기반)
   ═══════════════════════════════════════ */
app.get("/api/gsc/columns", async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string, 10) || 30;
    const strategyRaw = typeof req.query.strategy === "string" ? req.query.strategy : "mobile";
    const strategy: PageSpeedStrategy = strategyRaw === "desktop" ? "desktop" : "mobile";
    const startDate = daysAgo(10);
    const endDate = daysAgo(3);

    const [pageResult, pageQueryResult, ga4Result] = await Promise.allSettled([
      queryGscSearchAnalytics({
        startDate,
        endDate,
        dimensions: ["page"],
        rowLimit: limit,
        startRow: 0,
      }),
      // AEO 점수 근사치를 위해 (page, query) 기준으로 Q&A 키워드 비중 계산
      queryGscSearchAnalytics({
        startDate,
        endDate,
        dimensions: ["page", "query"],
        rowLimit: Math.min(25000, Math.max(1000, limit * 400)),
        startRow: 0,
      }),
      // GA4가 활성화된 경우에만 사용자 행동 점수 반영 (실패해도 columns는 계속 반환)
      queryGA4Engagement("30daysAgo", "yesterday", Math.min(500, Math.max(50, limit * 5))),
    ]);

    if (pageResult.status !== "fulfilled") {
      throw pageResult.reason;
    }

    const normalizePageUrl = (rawUrl: string) => {
      try {
        const url = new URL(rawUrl.trim());
        url.hash = "";
        if (url.pathname !== "/" && url.pathname.endsWith("/")) {
          url.pathname = url.pathname.slice(0, -1);
        }
        return url.toString();
      } catch {
        return rawUrl.trim();
      }
    };

    const normalizePath = (rawPath: string) => {
      let path = rawPath.trim();
      if (!path.startsWith("/")) path = `/${path}`;
      if (path !== "/" && path.endsWith("/")) path = path.slice(0, -1);
      return path;
    };

    const pageToPath = (pageUrl: string) => {
      try {
        return normalizePath(new URL(pageUrl).pathname);
      } catch {
        // GSC는 보통 full URL을 주지만, 혹시 path 형태로 넘어오는 경우를 대비
        if (pageUrl.startsWith("/")) return normalizePath(pageUrl.split("?")[0] ?? pageUrl);
        return "";
      }
    };

    const pageRows = pageResult.value.rows as Record<string, unknown>[];
    const maxClicks = Math.max(1, ...pageRows.map((r) => ((r.clicks as number) ?? 0)));
    const maxCtr = Math.max(0.0001, ...pageRows.map((r) => ((r.ctr as number) ?? 0)));

    const pageUrls = pageRows
      .map((row) => {
        const keys = row.keys as string[] | undefined;
        return normalizePageUrl(keys?.[0] ?? "");
      })
      .filter((v) => v.trim() !== "");

    const titleMap = await resolvePageTitles(pageUrls, {
      concurrency: 6,
      timeoutMs: 3000,
      maxUrls: Math.min(50, Math.max(1, limit)),
    });

    const qaAgg = new Map<string, { totalImpressions: number; qaImpressions: number }>();
    if (pageQueryResult.status === "fulfilled") {
      for (const row of pageQueryResult.value.rows as Record<string, unknown>[]) {
        const keys = row.keys as string[] | undefined;
        const page = normalizePageUrl(keys?.[0] ?? "");
        const query = keys?.[1] ?? "";
        if (!page) continue;

        const impressions = (row.impressions as number) ?? 0;
        const bucket = qaAgg.get(page) ?? { totalImpressions: 0, qaImpressions: 0 };
        bucket.totalImpressions += impressions;
        if (isQAKeyword(query)) bucket.qaImpressions += impressions;
        qaAgg.set(page, bucket);
      }
    }

    type Ga4EngagementRowLike = {
      pagePath: string;
      avgEngagementTime: number;
      bounceRate: number;
      sessions: number;
      scrollDepth: number;
    };

    const ga4ByPath = new Map<string, Ga4EngagementRowLike>();
    if (ga4Result.status === "fulfilled") {
      for (const row of ga4Result.value.rows as unknown as Ga4EngagementRowLike[]) {
        ga4ByPath.set(normalizePath(row.pagePath), row);
      }
    }

    const columns = pageRows.map((row) => {
      const keys = row.keys as string[] | undefined;
      const url = normalizePageUrl(keys?.[0] ?? "");
      const clicks = (row.clicks as number) ?? 0;
      const impressions = (row.impressions as number) ?? 0;
      const ctr = (row.ctr as number) ?? 0;
      const position = (row.position as number) ?? 0;

      // 검색 성과 점수 (40%): position + CTR + clicks (상대 정규화)
      const positionScore = position <= 1 ? 1 : position >= 10 ? 0 : 1 - (position - 1) / 9;
      const ctrScore = Math.max(0, Math.min(1, ctr / maxCtr));
      const clickScore = Math.max(0, Math.min(1, clicks / maxClicks));
      const searchScore = Math.max(
        0,
        Math.min(40, Math.round(40 * (positionScore * 0.5 + ctrScore * 0.3 + clickScore * 0.2))),
      );

      // 기술 성능 (20%): PageSpeed 캐시 기반. 없으면 0점(측정 필요)
      const ps = url ? getCachedResult(url, strategy) : undefined;
      const techScore = ps
        ? Math.max(
            0,
            Math.min(
              20,
              Math.round(ps.performanceScore * 0.14 + ps.seoScore * 0.03 + ps.accessibilityScore * 0.03),
            ),
          )
        : 0;

      // 사용자 체류 (25%): GA4가 활성화된 경우에만 pagePath 매칭해 점수화
      const ga4 = url ? ga4ByPath.get(pageToPath(url)) : undefined;
      const timeScore = ga4 ? Math.max(0, Math.min(1, ga4.avgEngagementTime / 180)) : 0;
      const bounceScore = ga4 ? Math.max(0, Math.min(1, 1 - ga4.bounceRate / 70)) : 0;
      const scrollScore = ga4 ? Math.max(0, Math.min(1, ga4.scrollDepth / 80)) : 0;
      const engageScore = ga4
        ? Math.max(0, Math.min(25, Math.round(25 * (timeScore * 0.45 + bounceScore * 0.35 + scrollScore * 0.2))))
        : 0;

      // AEO/GEO (15%): Q&A형 검색어 노출 비중(근사) 기반
      const qa = qaAgg.get(url);
      const qaShare =
        qa && qa.totalImpressions > 0 ? Math.max(0, Math.min(1, qa.qaImpressions / qa.totalImpressions)) : 0;
      const aeoScore = Math.max(0, Math.min(15, Math.round(15 * Math.min(1, qaShare / 0.3))));

      return {
        url,
        title: titleMap.get(url) ?? (url.split("/").pop() || url),
        clicks,
        impressions,
        ctr: +(ctr * 100).toFixed(2),
        position: +position.toFixed(1),
        score: searchScore + techScore + engageScore + aeoScore,
        search: searchScore,
        tech: techScore,
        engage: engageScore,
        aeo: aeoScore,
      };
    });

    res.json({
      startDate,
      endDate,
      strategy,
      columns,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to get columns";
    res.status(500).json({ error: "gsc_columns_error", message });
  }
});

/* ═══════════════════════════════════════
   PageSpeed API
   ═══════════════════════════════════════ */
app.post("/api/pagespeed/run", async (req: Request, res: Response) => {
  try {
    const { url, strategy } = req.body as {
      url?: string;
      strategy?: PageSpeedStrategy;
    };

    if (!url) {
      res.status(400).json({ error: "validation_error", message: "url is required" });
      return;
    }

    const result = await runPageSpeedTest(url, strategy ?? "mobile");
    setCachedResult(result);
    let persist: Awaited<ReturnType<typeof persistPageSpeedResult>> | null = null;
    try {
      persist = await persistPageSpeedResult(result);
    } catch (error) {
      persist = {
        ok: false,
        reason: "insert_failed",
        message: error instanceof Error ? error.message : "Failed to persist PageSpeed result",
      };
    }
    res.json({ ...result, persist });
  } catch (error) {
    const message = error instanceof Error ? error.message : "PageSpeed test failed";
    res.status(500).json({ error: "pagespeed_error", message });
  }
});

app.get("/api/pagespeed/results", async (_req: Request, res: Response) => {
  const limitRaw = _req.query.limit;
  const parsedLimit =
    typeof limitRaw === "string" && limitRaw.trim() !== "" ? parseInt(limitRaw, 10) : NaN;
  const limit = Math.max(1, Math.min(200, Number.isFinite(parsedLimit) ? parsedLimit : 50));

  if (supabase) {
    const { data, error } = await supabase
      .from("pagespeed_weekly")
      .select(
        "measured_at,url,strategy,performance_score,seo_score,accessibility_score,lcp_ms,fcp_ms,cls,inp_ms,ttfb_ms",
      )
      .order("measured_at", { ascending: false })
      .limit(limit);

    if (!error && data) {
      const results = data.map((row) => {
        const mapped: PageSpeedResult = {
          url: (row.url as string) ?? "",
          strategy: (row.strategy as PageSpeedStrategy) ?? "mobile",
          performanceScore: (row.performance_score as number) ?? 0,
          seoScore: (row.seo_score as number) ?? 0,
          accessibilityScore: (row.accessibility_score as number) ?? 0,
          lcpMs: (row.lcp_ms as number) ?? 0,
          fcpMs: (row.fcp_ms as number) ?? 0,
          cls: (row.cls as number) ?? 0,
          inpMs: (row.inp_ms as number) ?? null,
          ttfbMs: (row.ttfb_ms as number) ?? 0,
          measuredAt: (row.measured_at as string) ?? new Date().toISOString(),
        };
        setCachedResult(mapped);
        return mapped;
      });
      res.json({ results, count: results.length, source: "db" });
      return;
    }

    res.json({ results: getAllCachedResults(), count: getAllCachedResults().length, source: "memory" });
    return;
  }

  const results = getAllCachedResults();
  res.json({ results, count: results.length, source: "memory" });
});

app.post("/api/pagespeed/batch", async (req: Request, res: Response) => {
  try {
    const { urls, strategy } = req.body as {
      urls?: string[];
      strategy?: PageSpeedStrategy;
    };

    if (!urls || urls.length === 0) {
      res.status(400).json({ error: "validation_error", message: "urls array is required" });
      return;
    }

    // 순차 실행 (API rate limit 준수)
    const results = [];
    const errors = [];
    for (const url of urls.slice(0, 10)) {
      try {
        const result = await runPageSpeedTest(url, strategy ?? "mobile");
        setCachedResult(result);
        try {
          await persistPageSpeedResult(result);
        } catch {
          // ignore persistence errors; still return measured results
        }
        results.push(result);
      } catch (error) {
        errors.push({
          url,
          error: error instanceof Error ? error.message : "Failed",
        });
      }
    }

    res.json({ results, errors, totalTested: results.length, totalErrors: errors.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Batch test failed";
    res.status(500).json({ error: "pagespeed_batch_error", message });
  }
});

/* ═══════════════════════════════════════
   GA4 API
   ═══════════════════════════════════════ */
app.get("/api/ga4/engagement", async (req: Request, res: Response) => {
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

app.get("/api/ga4/funnel", async (req: Request, res: Response) => {
  try {
    const startDate = (req.query.startDate as string) || "30daysAgo";
    const endDate = (req.query.endDate as string) || "yesterday";

    const steps = await queryGA4Funnel(startDate, endDate);
    res.json({ startDate, endDate, steps });
  } catch (error) {
    const message = error instanceof Error ? error.message : "GA4 funnel query failed";
    res.status(500).json({ error: "ga4_funnel_error", message });
  }
});

/* ═══════════════════════════════════════
   통합 대시보드 데이터 (한번에 조회)
   ═══════════════════════════════════════ */
app.get("/api/dashboard/overview", async (_req: Request, res: Response) => {
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
          ctr: impressions > 0 ? +(clicks / impressions * 100).toFixed(2) : 0,
          avgPosition: rows.length > 0 ? +(positionTotal / rows.length).toFixed(1) : 0,
          dailyClicks: rows.map((r) => (r.clicks as number) ?? 0),
          dailyCtr: rows.map((r) => +((r.ctr as number ?? 0) * 100).toFixed(2)),
          dailyPosition: rows.map((r) => +((r.position as number) ?? 0).toFixed(1)),
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
                date: (r.keys as string[])?.[0] ?? "",
                clicks: (r.clicks as number) ?? 0,
                impressions: (r.impressions as number) ?? 0,
              }))
              .sort((a, b) => a.date.localeCompare(b.date))
          : null,
      keywords:
        keywordsResult.status === "fulfilled"
          ? (keywordsResult.value.rows as Record<string, unknown>[]).map((r) => {
              const q = ((r.keys as string[]) ?? [])[0] ?? "";
              return {
                query: q,
                clicks: (r.clicks as number) ?? 0,
                impressions: (r.impressions as number) ?? 0,
                ctr: +((r.ctr as number ?? 0) * 100).toFixed(2),
                position: +((r.position as number) ?? 0).toFixed(1),
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

/* ═══════════════════════════════════════
   페이지 크롤링 & AEO/GEO 점수
   ═══════════════════════════════════════ */

// 크롤 결과 메모리 캐시 (URL → CrawlResult)
const crawlCache = new Map<string, CrawlResult>();

app.post("/api/crawl/analyze", async (req: Request, res: Response) => {
  try {
    const { url } = req.body as { url?: string };
    if (!url) {
      res.status(400).json({ error: "validation_error", message: "url is required" });
      return;
    }
    const result = await crawlAndAnalyze(url);
    crawlCache.set(url, result);
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Crawl failed";
    res.status(500).json({ error: "crawl_error", message });
  }
});

app.get("/api/aeo/score", async (req: Request, res: Response) => {
  try {
    const targetUrl = typeof req.query.url === "string" ? req.query.url : "";
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

    for (const row of rows) {
      const query = ((row.keys as string[]) ?? [])[0] ?? "";
      const position = (row.position as number) ?? 999;
      const impressions = (row.impressions as number) ?? 0;
      const ctr = (row.ctr as number) ?? 0;

      if (isQAKeyword(query)) qaKeywords++;
      if (impressions > 500 && ctr < 0.02) opportunityKeywords++;
      if (position <= 3) keywordsInTop3++;
      if (position <= 10) keywordsInTop10++;
    }

    // 2) 크롤 데이터 (캐시 or 실시간)
    let crawlData: CrawlResult | null = null;
    if (targetUrl) {
      crawlData = crawlCache.get(targetUrl) ?? null;
      if (!crawlData) {
        try {
          crawlData = await crawlAndAnalyze(targetUrl);
          crawlCache.set(targetUrl, crawlData);
        } catch {
          // crawl failure is non-fatal
        }
      }
    }

    // 3) PageSpeed 성능 점수
    const psResult = targetUrl ? getCachedResult(targetUrl, "mobile") : undefined;

    // 4) GA4: AI 추천(referral) 유입 트래픽 (최근 30일)
    let aiTraffic: { startDate: string; endDate: string; aiSessions: number; totalSessions: number; sources: { source: string; sessions: number }[] } | null = null;
    try {
      aiTraffic = await queryGA4AiTraffic(daysAgo(30), daysAgo(1));
    } catch {
      aiTraffic = null;
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
      aiTraffic,
    });

    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "AEO score failed";
    res.status(500).json({ error: "aeo_score_error", message });
  }
});

app.get("/api/geo/score", async (req: Request, res: Response) => {
  try {
    const targetUrl = typeof req.query.url === "string" ? req.query.url : "";
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
      crawlData = crawlCache.get(targetUrl) ?? null;
      if (!crawlData) {
        try {
          crawlData = await crawlAndAnalyze(targetUrl);
          crawlCache.set(targetUrl, crawlData);
        } catch {
          // non-fatal
        }
      }
    }

    // 4) PageSpeed
    const psResult = targetUrl ? getCachedResult(targetUrl, "mobile") : undefined;

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
    });

    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "GEO score failed";
    res.status(500).json({ error: "geo_score_error", message });
  }
});

/* ═══════════════════════════════════════
   AI (ChatGPT) 엔드포인트
   ═══════════════════════════════════════ */

/* GET /api/ai/insights — KPI/키워드 데이터 기반 AI 인사이트 */
app.get("/api/ai/insights", async (_req: Request, res: Response) => {
  if (!isOpenAIConfigured()) {
    res.status(503).json({ error: "openai_not_configured", message: "OPENAI_API_KEY is not set" });
    return;
  }

  try {
    // 실데이터 수집 (KPI + 키워드 + AEO/GEO)
    const endDate = new Date();
    endDate.setDate(endDate.getDate() - 2);
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 6);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);

    const [kpiResult, kwResult] = await Promise.allSettled([
      queryGscSearchAnalytics({
        startDate: fmt(startDate),
        endDate: fmt(endDate),
        dimensions: ["date"],
        rowLimit: 7,
        startRow: 0,
      }),
      queryGscSearchAnalytics({
        startDate: fmt(startDate),
        endDate: fmt(endDate),
        dimensions: ["query"],
        rowLimit: 20,
        startRow: 0,
      }),
    ]);

    const seoData: Record<string, unknown> = {
      period: `${fmt(startDate)} ~ ${fmt(endDate)}`,
      site: env.GSC_SITE_URL,
    };

    if (kpiResult.status === "fulfilled" && kpiResult.value.rows) {
      const rows = kpiResult.value.rows;
      const totalClicks = rows.reduce((s, r) => s + (r.clicks ?? 0), 0);
      const totalImpressions = rows.reduce((s, r) => s + (r.impressions ?? 0), 0);
      const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
      const avgPos = rows.length > 0
        ? rows.reduce((s, r) => s + (r.position ?? 0), 0) / rows.length
        : 0;
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
    res.json({
      insights,
      generatedAt: new Date().toISOString(),
      model: env.OPENAI_MODEL,
      dataSource: seoData,
    });
  } catch (err) {
    console.error("AI insights error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: "ai_error", message });
  }
});

/* POST /api/ai/chat — AI 채팅 메시지 처리 */
const chatSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string().min(1).max(2000),
    }),
  ).min(1).max(20),
});

app.post("/api/ai/chat", async (req: Request, res: Response) => {
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
    console.error("AI chat error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: "ai_error", message });
  }
});

/* ═══════════════════════════════════════
   키워드 인텐트 분석
   ═══════════════════════════════════════ */

/* GET /api/keywords/intent — GSC 키워드 기반 인텐트 분류 */
app.get("/api/keywords/intent", async (_req: Request, res: Response) => {
  try {
    const endDate = new Date();
    endDate.setDate(endDate.getDate() - 2);
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 27);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);

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

    const intentResult = await classifyKeywordIntents(keywords);

    res.json({
      ...intentResult,
      period: `${fmt(startDate)} ~ ${fmt(endDate)}`,
    });
  } catch (err) {
    console.error("Keyword intent error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: "intent_error", message });
  }
});

/* ═══════════════════════════════════════
   404
   ═══════════════════════════════════════ */
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    error: "not_found",
    message: "Route not found",
  });
});

app.listen(env.PORT, () => {
  console.log(`SEO backend listening on http://localhost:${env.PORT}`);

  /* ── CWV 자동 측정: 서버 시작 30초 후 주요 URL 백그라운드 측정 ── */
  if (env.PAGESPEED_API_KEY) {
    const AUTO_CWV_URLS = ["https://biocom.kr"];
    const AUTO_CWV_STRATEGIES: PageSpeedStrategy[] = ["mobile", "desktop"];

    setTimeout(async () => {
      console.log("[CWV 자동 측정] 시작 —", AUTO_CWV_URLS.join(", "));
      for (const url of AUTO_CWV_URLS) {
        for (const strategy of AUTO_CWV_STRATEGIES) {
          // 캐시에 이미 있으면 스킵
          if (getCachedResult(url, strategy)) {
            console.log(`[CWV 자동 측정] 캐시 있음, 스킵: ${strategy}:${url}`);
            continue;
          }
          try {
            const result = await runPageSpeedTest(url, strategy);
            setCachedResult(result);
            await persistPageSpeedResult(result);
            console.log(`[CWV 자동 측정] ✅ ${strategy}:${url} — Performance: ${result.performanceScore}`);
          } catch (err) {
            console.error(`[CWV 자동 측정] ❌ ${strategy}:${url}:`, err instanceof Error ? err.message : err);
          }
        }
      }
      console.log("[CWV 자동 측정] 완료");
    }, 30_000);
  }
});
