import express, { type Request, type Response } from "express";

import { getSupabaseAdminClient } from "../supabase";
import {
  runPageSpeedTest,
  setCachedResult,
  getCachedResult,
  getAllCachedResults,
  type PageSpeedResult,
  type PageSpeedStrategy,
} from "../pagespeed";

const supabase = getSupabaseAdminClient();

export const persistPageSpeedResult = async (result: PageSpeedResult) => {
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

export const createPageSpeedRouter = () => {
  const router = express.Router();

  router.post("/api/pagespeed/run", async (req: Request, res: Response) => {
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

  router.get("/api/pagespeed/results", async (req: Request, res: Response) => {
    const limitRaw = req.query.limit;
    const parsedLimit = typeof limitRaw === "string" && limitRaw.trim() !== "" ? parseInt(limitRaw, 10) : NaN;
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

  router.post("/api/pagespeed/batch", async (req: Request, res: Response) => {
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

  return router;
};

export const getAutoCwvHelpers = () => ({
  supabaseConfigured: !!supabase,
  getCachedResult,
});

