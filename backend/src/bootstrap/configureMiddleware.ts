import cors from "cors";
import express, { type Application } from "express";
import rateLimit from "express-rate-limit";
import pino from "pino";
import pinoHttp from "pino-http";

import { env } from "../env";

const createLogger = () =>
  pino({
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

const allowedOrigins = [
  env.FRONTEND_ORIGIN,
  "http://localhost:3000",
  "http://localhost:7010",
  "https://thecleancoffee.com",
  "https://www.thecleancoffee.com",
  "https://thecleancoffee.imweb.me",
  "https://biocom.kr",
  "https://www.biocom.kr",
  "https://m.biocom.kr",
  "https://biocom.imweb.me",
  "https://aibio.ai",
  "https://www.aibio.ai",
];

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

export const configureMiddleware = (app: Application) => {
  if (env.TRUST_PROXY === "1") {
    app.set("trust proxy", 1);
  }

  const logger = createLogger();

  app.use(
    pinoHttp({
      logger,
      customLogLevel: (_req, res, err) => {
        if (err || res.statusCode >= 500) return "error";
        if (res.statusCode >= 400) return "warn";
        return "info";
      },
    }),
  );

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
  app.use(express.text({ type: "text/plain" }));

  app.use((req, res, next) => {
    const p = req.path;
    if (p === "/health") return next();

    if (p.startsWith("/api/gsc") || p === "/api/trends" || p === "/api/comparison" || p.startsWith("/api/cron/gsc")) {
      return gscLimiter(req, res, next);
    }

    if (p.startsWith("/api/ai") || p.startsWith("/api/serpapi") || p.startsWith("/api/keywords")) {
      return aiLimiter(req, res, next);
    }

    return next();
  });
};
