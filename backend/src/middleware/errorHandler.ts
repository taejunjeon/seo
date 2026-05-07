import type { NextFunction, Request, Response } from "express";

import { isCircuitOpenError } from "../utils/circuitBreaker";

type BodyParserError = Error & { type?: string; status?: number; statusCode?: number };

const isBodyParserError = (err: unknown): err is BodyParserError => {
  if (!(err instanceof Error)) return false;
  const candidate = err as BodyParserError;
  if (typeof candidate.type === "string" && candidate.type.startsWith("entity.")) return true;
  const status = candidate.status ?? candidate.statusCode;
  return typeof status === "number" && status >= 400 && status < 500;
};

export const errorHandler = (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (res.headersSent) return;

  const message = err instanceof Error ? err.message : "Unknown error";
  if (message.startsWith("CORS blocked:")) {
    res.status(403).json({ ok: false, error: "origin_not_allowed", message });
    return;
  }

  // body-parser PayloadTooLargeError / SyntaxError 등은 client side 입력 문제로 4xx 로 분류.
  // 이전에는 unhandled로 떨어져 500 응답이 나갔다 (2026-05-07 paid_click receiver 120KB probe 결과).
  if (isBodyParserError(err)) {
    const candidate = err as BodyParserError;
    const status = candidate.status ?? candidate.statusCode ?? 400;
    const errorCode = candidate.type ?? "bad_request";
    res.status(status).json({ ok: false, error: errorCode, message });
    return;
  }

  // Catch any unhandled errors (most routes already handle errors explicitly).
  // Keep the response shape predictable for the frontend.
  // eslint-disable-next-line no-console
  console.error("[errorHandler] Unhandled error:", err);

  if (isCircuitOpenError(err)) {
    const retryAfterSeconds = Math.max(1, Math.ceil(err.retryAfterMs / 1000));
    res.setHeader("Retry-After", String(retryAfterSeconds));
    res.status(503).json({
      error: "circuit_open",
      service: err.service,
      retryAfterSeconds,
      message: "Upstream service temporarily unavailable. Please retry later.",
    });
    return;
  }

  res.status(500).json({ error: "internal_error", message });
};
