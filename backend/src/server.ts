import cors from "cors";
import express, { type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import pino from "pino";
import pinoHttp from "pino-http";

import { isOpenAIConfigured } from "./ai";
import { env } from "./env";
import { errorHandler } from "./middleware/errorHandler";
import {
  getCachedResult,
  runPageSpeedTest,
  setCachedResult,
  type PageSpeedStrategy,
} from "./pagespeed";
import { createAiRouter } from "./routes/ai";
import { createCrawlRouter } from "./routes/crawl";
import { createDiagnosisRouter } from "./routes/diagnosis";
import { createGa4Router } from "./routes/ga4";
import { createGscRouter } from "./routes/gsc";
import { createPageSpeedRouter, persistPageSpeedResult } from "./routes/pagespeed";
import { isSerpApiConfigured } from "./serpapi";

const app = express();

// NOTE: When running behind a reverse proxy (e.g., Vercel/NGINX), enable `TRUST_PROXY=1`
// so rate limiting and request IPs work correctly.
if (env.TRUST_PROXY === "1") {
  app.set("trust proxy", 1);
}

// Request logging (pino-http)
const logger = pino({
  level: env.LOG_LEVEL ?? (env.NODE_ENV === "production" ? "info" : "debug"),
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "req.headers['x-cron-secret']",
      "req.headers['x-api-key']",
    ],
    remove: true,
  },
});

app.use(
  pinoHttp({
    logger,
    // Elevate error responses; keep noisy 4xx out of error logs.
    customLogLevel: (_req, res, err) => {
      if (err || res.statusCode >= 500) return "error";
      if (res.statusCode >= 400) return "warn";
      return "info";
    },
  }),
);

// CORS: multi-origin support (local dev + configured frontend origin)
const allowedOrigins = [env.FRONTEND_ORIGIN, "http://localhost:3000", "http://localhost:7010"];

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

// Rate limiting (Sprint 4.1)
const gscLimiter = rateLimit({
  windowMs: 60_000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

const aiLimiter = rateLimit({
  windowMs: 60_000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use((req, res, next) => {
  const p = req.path;
  if (p === "/health") return next();

  // GSC 계열
  if (p.startsWith("/api/gsc") || p === "/api/trends" || p === "/api/comparison" || p.startsWith("/api/cron/gsc")) {
    return gscLimiter(req, res, next);
  }

  // AI 계열 (SerpAPI/AI insights/chat/citation/intent)
  if (p.startsWith("/api/ai") || p.startsWith("/api/serpapi") || p.startsWith("/api/keywords")) {
    return aiLimiter(req, res, next);
  }

  return next();
});

// Health
app.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    service: "biocom-seo-backend",
    timestamp: new Date().toISOString(),
    apis: {
      gsc: !!env.GSC_SERVICE_ACCOUNT_KEY,
      pagespeed: !!env.PAGESPEED_API_KEY,
      ga4: !!env.GA4_PROPERTY_ID && !!env.GA4_SERVICE_ACCOUNT_KEY,
      serpapi: isSerpApiConfigured(),
      perplexity: !!env.PERPLEXITY_API_KEY,
      supabase: !!env.NEXT_PUBLIC_SUPABASE_URL && !!env.SUPABASE_SERVICE_ROLE_KEY,
      openai: isOpenAIConfigured(),
    },
  });
});

// Routers (absolute paths are defined inside each router)
app.use(createGscRouter());
app.use(createGa4Router());
app.use(createPageSpeedRouter());
app.use(createAiRouter());
app.use(createCrawlRouter());
app.use(createDiagnosisRouter());

// 404
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    error: "not_found",
    message: "Route not found",
  });
});

// Common error handler (as a final fallback)
app.use(errorHandler);

app.listen(env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`SEO backend listening on http://localhost:${env.PORT}`);

  // CWV auto measurement: run 30s after boot for a few key URLs
  if (env.PAGESPEED_API_KEY) {
    const AUTO_CWV_URLS = ["https://biocom.kr"];
    const AUTO_CWV_STRATEGIES: PageSpeedStrategy[] = ["mobile", "desktop"];

    setTimeout(async () => {
      // eslint-disable-next-line no-console
      console.log("[CWV auto] start -", AUTO_CWV_URLS.join(", "));

      for (const url of AUTO_CWV_URLS) {
        for (const strategy of AUTO_CWV_STRATEGIES) {
          // Skip if already cached
          if (getCachedResult(url, strategy)) {
            // eslint-disable-next-line no-console
            console.log(`[CWV auto] cache hit, skip: ${strategy}:${url}`);
            continue;
          }

          try {
            const result = await runPageSpeedTest(url, strategy);
            setCachedResult(result);
            await persistPageSpeedResult(result);
            // eslint-disable-next-line no-console
            console.log(`[CWV auto] ok ${strategy}:${url} - Performance: ${result.performanceScore}`);
          } catch (error) {
            // eslint-disable-next-line no-console
            console.error(
              `[CWV auto] fail ${strategy}:${url}:`,
              error instanceof Error ? error.message : error,
            );
          }
        }
      }

      // eslint-disable-next-line no-console
      console.log("[CWV auto] done");
    }, 30_000);
  }
});
