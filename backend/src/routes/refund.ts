/**
 * C-Sprint 4 (confirmed_stopline v1): Refund dispatch 라우트.
 *
 *  - POST /api/refund/dispatch?mode=dry_run|enforce  (dry_run 기본 무기록, enforce 는 REFUND_DISPATCH_ENFORCE=true 필요)
 *    예전처럼 dry_run 관측 로그를 남겨야 할 때만 recordDryRun=true 또는 record=true 를 명시한다.
 *  - GET  /api/refund/log?limit=50&site=biocom
 *  - GET  /api/refund/summary?windowDays=7            — 최근 N 일 집계
 */

import express, { type Request, type Response, Router } from "express";
import { BetaAnalyticsDataClient } from "@google-analytics/data";

import { env } from "../env";
import { GA4_PROPERTY_MAP } from "../ga4";
import {
  backfillPurchaseRefunds,
  detectPendingRefundCandidates,
  dispatchRefunds,
  getRefundDispatchSummary,
  listRefundDispatchLog,
} from "../services/refundDispatcher";

const readBooleanFlag = (value: unknown): boolean =>
  value === true || value === "true" || value === "1" || value === 1;

const runGa4RefundRealtimeCheck = async (site: string) => {
  const propertyId = GA4_PROPERTY_MAP[site];
  if (!propertyId) return { ok: false, error: `no property for ${site}` };
  const keyRaw = env.GA4_BIOCOM_SERVICE_ACCOUNT_KEY;
  if (!keyRaw) return { ok: false, error: "GA4_BIOCOM_SERVICE_ACCOUNT_KEY missing" };
  const credentials = JSON.parse(keyRaw);
  const client = new BetaAnalyticsDataClient({ credentials });
  const [resp] = await client.runRealtimeReport({
    property: `properties/${propertyId}`,
    dimensions: [{ name: "eventName" }],
    metrics: [{ name: "eventCount" }],
  });
  const all = (resp.rows ?? []).map((r) => ({
    eventName: r.dimensionValues?.[0]?.value ?? "",
    count: Number(r.metricValues?.[0]?.value ?? 0),
  }));
  const refund = all.find((r) => r.eventName === "refund");
  return { ok: true, site, propertyId, refundLast30m: refund?.count ?? 0, allEvents: all };
};

export const createRefundRouter = () => {
  const router: Router = express.Router();

  router.post("/api/refund/dispatch", express.json(), async (req: Request, res: Response) => {
    try {
      const mode = (req.query.mode === "enforce" || req.body?.mode === "enforce") ? "enforce" : "dry_run";
      const limit = Number(req.query.limit ?? req.body?.limit ?? 500);
      const recordDryRun =
        readBooleanFlag(req.query.recordDryRun) ||
        readBooleanFlag(req.query.record) ||
        readBooleanFlag(req.body?.recordDryRun) ||
        readBooleanFlag(req.body?.record);
      const summary = await dispatchRefunds({
        mode,
        limit: Number.isFinite(limit) && limit > 0 ? limit : 500,
        recordDryRun,
      });
      res.json({ ok: true, summary });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "refund dispatch failed" });
    }
  });

  router.get("/api/refund/log", (req: Request, res: Response) => {
    try {
      const limit = Number(req.query.limit ?? 50);
      const site = typeof req.query.site === "string" && req.query.site ? req.query.site : undefined;
      const rows = listRefundDispatchLog({
        limit: Number.isFinite(limit) && limit > 0 ? limit : 50,
        site,
      });
      res.json({ ok: true, rows });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "refund log failed" });
    }
  });

  router.get("/api/refund/summary", (req: Request, res: Response) => {
    try {
      const windowDays = Number(req.query.windowDays ?? 7);
      const summary = getRefundDispatchSummary(Number.isFinite(windowDays) && windowDays > 0 ? windowDays : 7);
      res.json({ ok: true, ...summary });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "refund summary failed" });
    }
  });

  router.post("/api/refund/purchase-refund-backfill", express.json(), async (req: Request, res: Response) => {
    try {
      const limit = Number(req.query.limit ?? req.body?.limit ?? 5000);
      const summary = await backfillPurchaseRefunds(Number.isFinite(limit) && limit > 0 ? limit : 5000);
      res.json({ ok: true, summary });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "purchase refund backfill failed" });
    }
  });

  router.get("/api/refund/ga4-verify", async (req: Request, res: Response) => {
    try {
      const site = typeof req.query.site === "string" && req.query.site ? req.query.site : "biocom";
      const result = await runGa4RefundRealtimeCheck(site);
      res.json(result);
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "ga4 verify failed" });
    }
  });

  router.get("/api/refund/pending-preview", (_req: Request, res: Response) => {
    try {
      const candidates = detectPendingRefundCandidates(20);
      res.json({ ok: true, previewCount: candidates.length, sample: candidates });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "refund preview failed" });
    }
  });

  return router;
};
