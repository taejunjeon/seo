import express, { type Request, type Response } from "express";

import { cacheGetJson, cacheSetJson } from "../cache/cache";
import { crawlAndAnalyze, discoverSubpages, type CrawlResult } from "../crawl";

// 크롤 결과 메모리 캐시 (URL -> CrawlResult)
const crawlCache = new Map<string, CrawlResult>();
const crawlInflight = new Map<string, Promise<CrawlResult>>();

export const getCrawlData = async (url: string): Promise<CrawlResult> => {
  const cacheKey = ["crawl", url].join("|");

  const cached = crawlCache.get(url);
  if (cached) return cached;

  const redisCached = await cacheGetJson<CrawlResult>(cacheKey);
  if (redisCached) {
    crawlCache.set(url, redisCached);
    return redisCached;
  }

  const running = crawlInflight.get(url);
  if (running) return running;

  const promise = crawlAndAnalyze(url)
    .then((result) => {
      crawlCache.set(url, result);
      void cacheSetJson(cacheKey, result, 60 * 60); // 1h
      return result;
    })
    .finally(() => {
      crawlInflight.delete(url);
    });

  crawlInflight.set(url, promise);
  return promise;
};

export const createCrawlRouter = () => {
  const router = express.Router();

  router.post("/api/crawl/analyze", async (req: Request, res: Response) => {
    try {
      const { url } = req.body as { url?: string };
      if (!url) {
        res.status(400).json({ error: "validation_error", message: "url is required" });
        return;
      }
      const result = await getCrawlData(url);
      res.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Crawl failed";
      res.status(500).json({ error: "crawl_error", message });
    }
  });

  router.post("/api/crawl/subpages", async (req: Request, res: Response) => {
    try {
      const { url, maxLinks } = req.body as { url?: string; maxLinks?: number };
      if (!url) {
        res.status(400).json({ error: "validation_error", message: "url is required" });
        return;
      }
      const links = await discoverSubpages(url, maxLinks ?? 50);
      res.json({ parentUrl: url, subpages: links, count: links.length });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Subpage discovery failed";
      res.status(500).json({ error: "crawl_error", message });
    }
  });

  return router;
};
