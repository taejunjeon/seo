/**
 * C-Sprint 5: BigQuery 접근 대기 중에도 가능한 identity coverage 진단 라우트.
 *
 *  - GET /api/identity-coverage/summary             — 전체 요약 (era/source/duplicate/field/timeSeries)
 *  - GET /api/identity-coverage/duplicate-samples   — duplicate order 샘플 상위 N 건
 */

import express, { type Request, type Response, Router } from "express";

import { buildIdentityCoverageSummary, listDuplicateOrderSamples } from "../services/identityCoverage";

export const createIdentityCoverageRouter = () => {
  const router: Router = express.Router();

  router.get("/api/identity-coverage/summary", (_req: Request, res: Response) => {
    try {
      res.json({ ok: true, summary: buildIdentityCoverageSummary() });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "identity coverage summary failed" });
    }
  });

  router.get("/api/identity-coverage/duplicate-samples", (req: Request, res: Response) => {
    try {
      const limit = Number(req.query.limit ?? 20);
      const rows = listDuplicateOrderSamples(Number.isFinite(limit) && limit > 0 ? limit : 20);
      res.json({ ok: true, rows });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "duplicate samples failed" });
    }
  });

  return router;
};
