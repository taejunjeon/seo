import type { NextFunction, Request, Response } from "express";

import { isCircuitOpenError } from "../utils/circuitBreaker";

export const errorHandler = (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  // Catch any unhandled errors (most routes already handle errors explicitly).
  // Keep the response shape predictable for the frontend.
  // eslint-disable-next-line no-console
  console.error("[errorHandler] Unhandled error:", err);

  if (res.headersSent) return;

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

  const message = err instanceof Error ? err.message : "Unknown error";
  res.status(500).json({ error: "internal_error", message });
};
