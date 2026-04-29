import express, { type NextFunction, type Request, type Response } from "express";
import { z } from "zod";

import { cacheGetJson, cacheSetJson } from "../cache/cache";
import { env } from "../env";
import { listGscSites, queryGscSearchAnalytics, type GscDimension } from "../gsc";
import { getSupabaseAdminClient } from "../supabase";
import { resolvePageTitles } from "../pageTitle";
import { getCachedResult, type PageSpeedStrategy } from "../pagespeed";
import { queryGA4Engagement } from "../ga4";
import { daysAgo } from "../utils/dateUtils";
import { computeComparisonRanges, type ComparisonCompare, type DateRange } from "../utils/compareRanges";

const supabase = getSupabaseAdminClient();

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
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "startDate must use YYYY-MM-DD"),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "endDate must use YYYY-MM-DD"),
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
   Cron 보호
   ═══════════════════════════════════════ */
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

/* Q&A 키워드 자동 분류 패턴 */
const QA_PATTERNS = [
  /무엇/, /어떻게/, /왜/, /언제/, /어디/,
  /증상/, /효능/, /효과/, /부작용/, /방법/,
  /차이/, /원인/, /치료/, /예방/, /관리/,
  /좋은/, /나쁜/, /추천/, /비교/, /가격/,
  /what/i, /how/i, /why/i, /best/i, /vs/i,
];

const isQAKeyword = (query: string) => QA_PATTERNS.some((p) => p.test(query));

/* ═══════════════════════════════════════
   Trend API (GSC 기반)
   ═══════════════════════════════════════ */
type TrendsMetric = "clicks" | "impressions" | "ctr" | "position";
type TrendsPeriod = "7d" | "30d" | "90d";
type TrendsCompare = "previous" | "yoy";

type TrendsPoint = { date: string; value: number };

type TrendsPeriodSeries = {
  startDate: string;
  endDate: string;
  data: TrendsPoint[];
  total: number;
  average: number;
};

type TrendsChange = {
  absolute: number;
  percentage: number;
  direction: "up" | "down" | "flat";
};

type TrendsApiValue = {
  metric: TrendsMetric;
  period: TrendsPeriod;
  compare: TrendsCompare;
  current: TrendsPeriodSeries;
  previous: TrendsPeriodSeries;
  change: TrendsChange;
};

const TRENDS_CACHE_TTL_MS = 5 * 60 * 1000; // 5m
const trendsCache = new Map<string, { measuredAtMs: number; value: TrendsApiValue }>();
const trendsInflight = new Map<string, Promise<TrendsApiValue>>();

/* ═══════════════════════════════════════
   Comparison API (GSC 기반)
   ═══════════════════════════════════════ */
type ComparisonDimension = "page" | "query";
type ComparisonSortBy = "clicks" | "impressions" | "ctr" | "position" | "change";

type ComparisonMetrics = {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

type ComparisonMetricChange = {
  absolute: number;
  percentage: number;
  direction: "up" | "down" | "flat";
};

type ComparisonItem = {
  key: string;
  current: ComparisonMetrics;
  previous: ComparisonMetrics;
  change: {
    clicks: ComparisonMetricChange;
    impressions: ComparisonMetricChange;
    ctr: ComparisonMetricChange;
    position: ComparisonMetricChange;
  };
};

type ComparisonApiValue = {
  dimension: ComparisonDimension;
  period: TrendsPeriod;
  compare: ComparisonCompare;
  range: { current: DateRange; previous: DateRange };
  items: ComparisonItem[];
  totalItems: number;
};

const COMPARISON_CACHE_TTL_MS = 5 * 60 * 1000; // 5m
const comparisonCache = new Map<string, { measuredAtMs: number; value: ComparisonApiValue }>();
const comparisonInflight = new Map<string, Promise<ComparisonApiValue>>();

export const createGscRouter = () => {
  const router = express.Router();

  /* ═══════════════════════════════════════
     GSC 기존 엔드포인트
     ═══════════════════════════════════════ */
  router.get("/api/gsc/sites", async (_req: Request, res: Response) => {
    try {
      const sites = await listGscSites();
      res.json({ sites });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to list sites";
      res.status(500).json({ error: "gsc_sites_error", message });
    }
  });

  router.post("/api/gsc/query", async (req: Request, res: Response) => {
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
  router.post("/api/cron/gsc/daily", requireCronSecret, async (req: Request, res: Response) => {
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
      const { error } = await supabase.from("gsc_daily_metrics").upsert(batch, { onConflict: "date,page,query,device,country" });
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
  router.get("/api/gsc/trends", async (req: Request, res: Response) => {
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
  router.get("/api/gsc/kpi", async (_req: Request, res: Response) => {
    try {
      // 현재 7일: GSC reporting delay를 감안해 3일 전까지의 7개 날짜를 본다.
      const currentStart = daysAgo(9);
      const currentEnd = daysAgo(3);
      const current = await queryGscSearchAnalytics({
        startDate: currentStart,
        endDate: currentEnd,
        dimensions: ["date"],
        rowLimit: 10,
        startRow: 0,
      });

      // 이전 7일: 현재 구간 바로 앞 7개 날짜.
      const prevStart = daysAgo(16);
      const prevEnd = daysAgo(10);
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

      const deltaPercent = (curVal: number, prevVal: number) => (prevVal === 0 ? 0 : +(((curVal - prevVal) / prevVal) * 100).toFixed(1));

      // 일별 스파크라인
      const dailyClicks = (current.rows as Record<string, unknown>[]).map((r) => (r.clicks as number) ?? 0).slice(-7);
      const dailyImpressions = (current.rows as Record<string, unknown>[]).map((r) => (r.impressions as number) ?? 0).slice(-7);
      const dailyCtr = (current.rows as Record<string, unknown>[]).map((r) => (r.ctr as number) ?? 0).slice(-7);
      const dailyPosition = (current.rows as Record<string, unknown>[]).map((r) => (r.position as number) ?? 0).slice(-7);

      res.json({
        current: cur,
        previous: prev,
        delta: {
          clicks: deltaPercent(cur.clicks, prev.clicks),
          ctr: +(cur.ctr * 100 - prev.ctr * 100).toFixed(2),
          position: +(cur.avgPosition - prev.avgPosition).toFixed(1),
        },
        sparklines: {
          clicks: dailyClicks,
          impressions: dailyImpressions,
          ctr: dailyCtr.map((v) => +(v * 100).toFixed(2)),
          position: dailyPosition.map((v) => +v.toFixed(1)),
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to get KPI";
      res.status(500).json({ error: "gsc_kpi_error", message });
    }
  });

  router.get("/api/trends", async (req: Request, res: Response) => {
    try {
      const metricRaw = typeof req.query.metric === "string" ? req.query.metric.trim() : "";
      if (!metricRaw) {
        res.status(400).json({ error: "validation_error", message: "metric is required (clicks|impressions|ctr|position)" });
        return;
      }
      const metric = metricRaw as TrendsMetric;
      if (!["clicks", "impressions", "ctr", "position"].includes(metric)) {
        res.status(400).json({ error: "validation_error", message: "Invalid metric. Allowed: clicks, impressions, ctr, position" });
        return;
      }

      const periodRaw = typeof req.query.period === "string" ? req.query.period.trim() : "";
      const period = (periodRaw || "30d") as TrendsPeriod;
      if (!["7d", "30d", "90d"].includes(period)) {
        res.status(400).json({ error: "validation_error", message: "Invalid period. Allowed: 7d, 30d, 90d" });
        return;
      }

      const compareRaw = typeof req.query.compare === "string" ? req.query.compare.trim() : "";
      const compare = ((compareRaw || "previous") as TrendsCompare);
      if (!["previous", "yoy"].includes(compare)) {
        res.status(400).json({ error: "validation_error", message: "Invalid compare. Allowed: previous, yoy" });
        return;
      }

      const cacheKey = ["trends", env.GSC_SITE_URL, metric, period, compare].join("|");
      const now = Date.now();
      const cached = trendsCache.get(cacheKey);

      const send = (value: TrendsApiValue, source: "cache" | "live") => {
        res.json({
          ...value,
          _meta: {
            source,
            ttl: Math.floor(TRENDS_CACHE_TTL_MS / 1000),
            queriedAt: new Date().toISOString(),
          },
        });
      };

      if (cached && now - cached.measuredAtMs < TRENDS_CACHE_TTL_MS) {
        send(cached.value, "cache");
        return;
      }

      const redisCached = await cacheGetJson<{ measuredAtMs: number; value: TrendsApiValue }>(cacheKey);
      if (redisCached && now - redisCached.measuredAtMs < TRENDS_CACHE_TTL_MS) {
        trendsCache.set(cacheKey, redisCached);
        send(redisCached.value, "cache");
        return;
      }

      const running = trendsInflight.get(cacheKey);
      if (running) {
        const value = await running;
        send(value, "live");
        return;
      }

      const promise = (async (): Promise<TrendsApiValue> => {
        const periodDays = period === "7d" ? 7 : period === "90d" ? 90 : 30;
        const delayDays = 3; // GSC reporting latency buffer (consistent with /api/gsc/*)
        const currentEnd = daysAgo(delayDays);
        const currentStart = daysAgo(delayDays + periodDays - 1);

        const shiftDateByDays = (dateStr: string, deltaDays: number) => {
          const d = new Date(`${dateStr}T00:00:00Z`);
          d.setUTCDate(d.getUTCDate() + deltaDays);
          return d.toISOString().slice(0, 10);
        };

        const shiftDateByYears = (dateStr: string, deltaYears: number) => {
          const d = new Date(`${dateStr}T00:00:00Z`);
          d.setUTCFullYear(d.getUTCFullYear() + deltaYears);
          return d.toISOString().slice(0, 10);
        };

        const previousEnd = compare === "previous" ? shiftDateByDays(currentStart, -1) : shiftDateByYears(currentEnd, -1);
        const previousStart =
          compare === "previous" ? shiftDateByDays(previousEnd, -(periodDays - 1)) : shiftDateByYears(currentStart, -1);

        const enumerateDates = (startDate: string, endDate: string) => {
          const out: string[] = [];
          const start = new Date(`${startDate}T00:00:00Z`);
          const end = new Date(`${endDate}T00:00:00Z`);
          const cursor = new Date(start);
          while (cursor <= end) {
            out.push(cursor.toISOString().slice(0, 10));
            cursor.setUTCDate(cursor.getUTCDate() + 1);
          }
          return out;
        };

        type DailyAgg = { clicks: number; impressions: number; positionWeightedSum: number };

        const buildSeries = (
          rows: { keys?: string[]; clicks?: number; impressions?: number; position?: number }[],
          startDate: string,
          endDate: string,
        ): TrendsPeriodSeries => {
          const byDate = new Map<string, DailyAgg>();

          for (const row of rows) {
            const date = row.keys?.[0] ?? "";
            if (!date) continue;
            const clicks = row.clicks ?? 0;
            const impressions = row.impressions ?? 0;
            const position = row.position ?? 0;
            const cur = byDate.get(date) ?? { clicks: 0, impressions: 0, positionWeightedSum: 0 };
            cur.clicks += clicks;
            cur.impressions += impressions;
            cur.positionWeightedSum += position * impressions;
            byDate.set(date, cur);
          }

          const dates = enumerateDates(startDate, endDate);
          const data: TrendsPoint[] = [];
          let totalClicks = 0;
          let totalImpressions = 0;
          let totalPositionWeightedSum = 0;
          let avgCtrSum = 0;
          let avgCtrDays = 0;
          let avgPosSum = 0;
          let avgPosDays = 0;

          for (const date of dates) {
            const agg = byDate.get(date);
            const clicks = agg?.clicks ?? 0;
            const impressions = agg?.impressions ?? 0;
            const ctr = impressions > 0 ? clicks / impressions : 0;
            const position = impressions > 0 ? agg!.positionWeightedSum / impressions : 0;

            totalClicks += clicks;
            totalImpressions += impressions;
            totalPositionWeightedSum += agg?.positionWeightedSum ?? 0;
            avgCtrSum += ctr;
            avgCtrDays += 1;
            avgPosSum += position;
            avgPosDays += 1;

            const value =
              metric === "clicks"
                ? clicks
                : metric === "impressions"
                  ? impressions
                  : metric === "ctr"
                    ? ctr
                    : position;
            data.push({ date, value });
          }

          const total =
            metric === "clicks"
              ? totalClicks
              : metric === "impressions"
                ? totalImpressions
                : metric === "ctr"
                  ? (totalImpressions > 0 ? totalClicks / totalImpressions : 0)
                  : (totalImpressions > 0 ? totalPositionWeightedSum / totalImpressions : 0);

          const average =
            metric === "clicks"
              ? totalClicks / Math.max(1, dates.length)
              : metric === "impressions"
                ? totalImpressions / Math.max(1, dates.length)
                : metric === "ctr"
                  ? avgCtrSum / Math.max(1, avgCtrDays)
                  : avgPosSum / Math.max(1, avgPosDays);

          return {
            startDate,
            endDate,
            data,
            total: Number.isFinite(total) ? +total.toFixed(metric === "ctr" ? 4 : metric === "position" ? 1 : 0) : 0,
            average: Number.isFinite(average) ? +average.toFixed(metric === "ctr" ? 4 : metric === "position" ? 1 : 1) : 0,
          };
        };

        const [currentRes, previousRes] = await Promise.all([
          queryGscSearchAnalytics({
            startDate: currentStart,
            endDate: currentEnd,
            dimensions: ["date"],
            rowLimit: 25000,
            startRow: 0,
          }),
          queryGscSearchAnalytics({
            startDate: previousStart,
            endDate: previousEnd,
            dimensions: ["date"],
            rowLimit: 25000,
            startRow: 0,
          }),
        ]);

        const current = buildSeries((currentRes.rows ?? []) as any[], currentStart, currentEnd);
        const previous = buildSeries((previousRes.rows ?? []) as any[], previousStart, previousEnd);

        const abs = current.total - previous.total;
        const percentage = previous.total === 0 ? 0 : +((abs / previous.total) * 100).toFixed(1);

        // position은 낮아질수록 개선
        const direction: TrendsChange["direction"] =
          abs === 0 ? "flat" : metric === "position" ? (abs < 0 ? "up" : "down") : (abs > 0 ? "up" : "down");

        return {
          metric,
          period,
          compare,
          current,
          previous,
          change: { absolute: abs, percentage, direction },
        };
      })();

      trendsInflight.set(cacheKey, promise);
      try {
        const value = await promise;
        const measuredAtMs = Date.now();
        trendsCache.set(cacheKey, { measuredAtMs, value });
        void cacheSetJson(cacheKey, { measuredAtMs, value }, Math.floor(TRENDS_CACHE_TTL_MS / 1000));
        send(value, "live");
      } finally {
        trendsInflight.delete(cacheKey);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to get trends";
      res.status(500).json({ error: "trends_error", message });
    }
  });

  router.get("/api/comparison", async (req: Request, res: Response) => {
    try {
      const dimensionRaw = typeof req.query.dimension === "string" ? req.query.dimension.trim() : "";
      if (!dimensionRaw) {
        res.status(400).json({ error: "validation_error", message: "dimension is required (page|query)" });
        return;
      }
      const dimension = dimensionRaw as ComparisonDimension;
      if (dimension !== "page" && dimension !== "query") {
        res.status(400).json({ error: "validation_error", message: "Invalid dimension. Allowed: page, query" });
        return;
      }

      const periodRaw = typeof req.query.period === "string" ? req.query.period.trim() : "";
      const period = (periodRaw || "30d") as TrendsPeriod;
      if (!["7d", "30d", "90d"].includes(period)) {
        res.status(400).json({ error: "validation_error", message: "Invalid period. Allowed: 7d, 30d, 90d" });
        return;
      }

      const compareRaw = typeof req.query.compare === "string" ? req.query.compare.trim() : "";
      const compare = ((compareRaw || "previous") as ComparisonCompare);
      if (!["previous", "yoy", "mom"].includes(compare)) {
        res.status(400).json({ error: "validation_error", message: "Invalid compare. Allowed: previous, yoy, mom" });
        return;
      }

      const sortByRaw = typeof req.query.sortBy === "string" ? req.query.sortBy.trim() : "";
      const sortBy = (sortByRaw || "clicks") as ComparisonSortBy;
      if (!["clicks", "impressions", "ctr", "position", "change"].includes(sortBy)) {
        res.status(400).json({ error: "validation_error", message: "Invalid sortBy. Allowed: clicks, impressions, ctr, position, change" });
        return;
      }

      const limitRaw = typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : Number.NaN;
      const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 200) : 20;

      const cacheKey = ["comparison", env.GSC_SITE_URL, dimension, period, compare, sortBy, limit].join("|");
      const now = Date.now();
      const cached = comparisonCache.get(cacheKey);

      const send = (value: ComparisonApiValue, source: "cache" | "live") => {
        res.json({
          ...value,
          _meta: {
            source,
            ttl: Math.floor(COMPARISON_CACHE_TTL_MS / 1000),
            queriedAt: new Date().toISOString(),
          },
        });
      };

      if (cached && now - cached.measuredAtMs < COMPARISON_CACHE_TTL_MS) {
        send(cached.value, "cache");
        return;
      }

      const redisCached = await cacheGetJson<{ measuredAtMs: number; value: ComparisonApiValue }>(cacheKey);
      if (redisCached && now - redisCached.measuredAtMs < COMPARISON_CACHE_TTL_MS) {
        comparisonCache.set(cacheKey, redisCached);
        send(redisCached.value, "cache");
        return;
      }

      const running = comparisonInflight.get(cacheKey);
      if (running) {
        const value = await running;
        send(value, "live");
        return;
      }

      const promise = (async (): Promise<ComparisonApiValue> => {
        const periodDays = period === "7d" ? 7 : period === "90d" ? 90 : 30;
        const delayDays = 3;
        const currentEnd = daysAgo(delayDays);

        const ranges = computeComparisonRanges({ currentEnd, periodDays, compare });
        const currentStart = ranges.current.startDate;
        const previousStart = ranges.previous.startDate;
        const previousEnd = ranges.previous.endDate;

        const [currentRes, previousRes] = await Promise.all([
          queryGscSearchAnalytics({
            startDate: currentStart,
            endDate: currentEnd,
            dimensions: [dimension],
            rowLimit: 25000,
            startRow: 0,
          }),
          queryGscSearchAnalytics({
            startDate: previousStart,
            endDate: previousEnd,
            dimensions: [dimension],
            rowLimit: 25000,
            startRow: 0,
          }),
        ]);

        const toMetricsMap = (rows: { keys?: string[]; clicks?: number; impressions?: number; ctr?: number; position?: number }[]) => {
          const m = new Map<string, ComparisonMetrics>();
          for (const row of rows) {
            const key = row.keys?.[0] ?? "";
            if (!key) continue;
            m.set(key, {
              clicks: row.clicks ?? 0,
              impressions: row.impressions ?? 0,
              ctr: row.ctr ?? 0,
              position: row.position ?? 0,
            });
          }
          return m;
        };

        const currentMap = toMetricsMap((currentRes.rows ?? []) as any[]);
        const previousMap = toMetricsMap((previousRes.rows ?? []) as any[]);

        const allKeys = new Set<string>([...currentMap.keys(), ...previousMap.keys()]);

        const round = (n: number, decimals: number) => (Number.isFinite(n) ? +n.toFixed(decimals) : 0);

        const delta = (curVal: number, prevVal: number, opts?: { invertDirection?: boolean; decimals?: number }): ComparisonMetricChange => {
          const decimals = opts?.decimals ?? 1;
          const abs = round(curVal - prevVal, decimals);
          const pct = prevVal === 0 ? 0 : round(((curVal - prevVal) / prevVal) * 100, 1);
          const improved = opts?.invertDirection ? abs < 0 : abs > 0;
          const worsened = opts?.invertDirection ? abs > 0 : abs < 0;
          const direction: ComparisonMetricChange["direction"] = abs === 0 ? "flat" : improved ? "up" : worsened ? "down" : "flat";
          return { absolute: abs, percentage: pct, direction };
        };

        const zero: ComparisonMetrics = { clicks: 0, impressions: 0, ctr: 0, position: 0 };
        const items: ComparisonItem[] = [];

        for (const key of allKeys) {
          const current = currentMap.get(key) ?? zero;
          const previous = previousMap.get(key) ?? zero;
          items.push({
            key,
            current,
            previous,
            change: {
              clicks: delta(current.clicks, previous.clicks, { decimals: 0 }),
              impressions: delta(current.impressions, previous.impressions, { decimals: 0 }),
              ctr: delta(current.ctr, previous.ctr, { decimals: 4 }),
              position: delta(current.position, previous.position, { invertDirection: true, decimals: 1 }),
            },
          });
        }

        const sorted = items.slice().sort((a, b) => {
          if (sortBy === "clicks") return (b.current.clicks - a.current.clicks) || (b.current.impressions - a.current.impressions);
          if (sortBy === "impressions") return (b.current.impressions - a.current.impressions) || (b.current.clicks - a.current.clicks);
          if (sortBy === "ctr") return (b.current.ctr - a.current.ctr) || (b.current.clicks - a.current.clicks);
          if (sortBy === "position") return (a.current.position - b.current.position) || (b.current.clicks - a.current.clicks);
          // sortBy === "change": biggest absolute click change first
          return (Math.abs(b.change.clicks.absolute) - Math.abs(a.change.clicks.absolute)) || (b.current.clicks - a.current.clicks);
        });

        return {
          dimension,
          period,
          compare,
          range: ranges,
          items: sorted.slice(0, limit),
          totalItems: allKeys.size,
        };
      })();

      comparisonInflight.set(cacheKey, promise);
      try {
        const value = await promise;
        const measuredAtMs = Date.now();
        comparisonCache.set(cacheKey, { measuredAtMs, value });
        void cacheSetJson(cacheKey, { measuredAtMs, value }, Math.floor(COMPARISON_CACHE_TTL_MS / 1000));
        send(value, "live");
      } finally {
        comparisonInflight.delete(cacheKey);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to get comparison";
      res.status(500).json({ error: "comparison_error", message });
    }
  });

  /* ═══════════════════════════════════════
     GSC 키워드 분석 (Q&A 자동 태깅)
     ═══════════════════════════════════════ */
  router.get("/api/gsc/keywords", async (req: Request, res: Response) => {
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
  router.get("/api/gsc/columns", async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string, 10) || 30;
      const categoryRaw = typeof req.query.category === "string" ? req.query.category : "all";
      const category = categoryRaw === "columns" ? "columns" : "all";
      const strategyRaw = typeof req.query.strategy === "string" ? req.query.strategy : "mobile";
      const strategy: PageSpeedStrategy = strategyRaw === "desktop" ? "desktop" : "mobile";

      const startDateQuery = typeof req.query.startDate === "string" ? req.query.startDate : undefined;
      const endDateQuery = typeof req.query.endDate === "string" ? req.query.endDate : undefined;
      const daysQuery = typeof req.query.days === "string" ? parseInt(req.query.days, 10) : Number.NaN;
      const isDateString = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

      let startDate = daysAgo(10);
      let endDate = daysAgo(3);

      if (startDateQuery && endDateQuery) {
        if (isDateString(startDateQuery) && isDateString(endDateQuery) && startDateQuery <= endDateQuery) {
          startDate = startDateQuery;
          endDate = endDateQuery;
        }
      } else if (Number.isFinite(daysQuery) && daysQuery > 0) {
        const days = Math.min(Math.max(daysQuery, 1), 180);
        endDate = daysAgo(3);
        startDate = daysAgo(days + 3);
      }

      const dimensionFilterGroups =
        category === "columns"
          ? [
              {
                // 칼럼(healthinfo) + 소개/랜딩(what_biohacking)만 포함
                // NOTE: groupType OR 조합은 구현/버전에 따라 예상대로 동작하지 않을 수 있어,
                //       1개의 includingRegex 필터로 안전하게 포함 범위를 지정합니다.
                filters: [
                  {
                    dimension: "page",
                    operator: "includingRegex",
                    expression: ".*(/healthinfo|/what_biohacking).*",
                  },
                ],
              },
            ]
          : undefined;

      const pageQueryRowLimit =
        category === "columns" ? Math.min(25000, Math.max(5000, limit * 200)) : Math.min(25000, Math.max(1000, limit * 400));

      const [pageResult, pageQueryResult, ga4Result] = await Promise.allSettled([
        queryGscSearchAnalytics({
          startDate,
          endDate,
          dimensions: ["page"],
          dimensionFilterGroups,
          rowLimit: limit,
          startRow: 0,
        }),
        // AEO 점수 근사치를 위해 (page, query) 기준으로 Q&A 키워드 비중 계산
        queryGscSearchAnalytics({
          startDate,
          endDate,
          dimensions: ["page", "query"],
          dimensionFilterGroups,
          rowLimit: pageQueryRowLimit,
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
      const maxClicks = Math.max(1, ...pageRows.map((r) => (r.clicks as number) ?? 0));
      const maxCtr = Math.max(0.0001, ...pageRows.map((r) => (r.ctr as number) ?? 0));

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
        const searchScore = Math.max(0, Math.min(40, Math.round(40 * (positionScore * 0.5 + ctrScore * 0.3 + clickScore * 0.2))));

        // 기술 성능 (20%): PageSpeed 캐시 기반. 없으면 0점(측정 필요)
        const ps = url ? getCachedResult(url, strategy) : undefined;
        const techScore = ps
          ? Math.max(0, Math.min(20, Math.round(ps.performanceScore * 0.14 + ps.seoScore * 0.03 + ps.accessibilityScore * 0.03)))
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
        const qaShare = qa && qa.totalImpressions > 0 ? Math.max(0, Math.min(1, qa.qaImpressions / qa.totalImpressions)) : 0;
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

  return router;
};
