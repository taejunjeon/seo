import { type Request, type Response, Router } from "express";

import { getCrmDb } from "../crmLocalDb";
import {
  getAibioStats,
  isAibioConfigured,
  syncAibioCustomers,
  syncAibioPayments,
} from "../aibioSync";

export const createAibioRouter = () => {
  const router = Router();

  router.get("/api/aibio/stats", (_req: Request, res: Response) => {
    try {
      if (!isAibioConfigured()) {
        res.status(400).json({ ok: false, error: "AIBIO_SUPABASE_* env not configured" });
        return;
      }
      res.json({ ok: true, ...getAibioStats() });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "stats failed" });
    }
  });

  router.post("/api/aibio/sync-customers", async (req: Request, res: Response) => {
    try {
      if (!isAibioConfigured()) {
        res.status(400).json({ ok: false, error: "AIBIO_SUPABASE_* env not configured" });
        return;
      }
      const mode = req.body?.mode === "full" ? "full" : "incremental";
      const out = await syncAibioCustomers({ mode });
      res.json({ ok: true, ...out, stats: getAibioStats() });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "sync failed" });
    }
  });

  router.post("/api/aibio/sync-payments", async (req: Request, res: Response) => {
    try {
      if (!isAibioConfigured()) {
        res.status(400).json({ ok: false, error: "AIBIO_SUPABASE_* env not configured" });
        return;
      }
      const mode = req.body?.mode === "full" ? "full" : "incremental";
      const out = await syncAibioPayments({ mode });
      res.json({ ok: true, ...out, stats: getAibioStats() });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "sync failed" });
    }
  });

  router.post("/api/aibio/sync-all", async (req: Request, res: Response) => {
    try {
      if (!isAibioConfigured()) {
        res.status(400).json({ ok: false, error: "AIBIO_SUPABASE_* env not configured" });
        return;
      }
      const mode = req.body?.mode === "full" ? "full" : "incremental";
      const c = await syncAibioCustomers({ mode });
      const p = await syncAibioPayments({ mode });
      res.json({ ok: true, customers: c, payments: p, stats: getAibioStats() });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "sync failed" });
    }
  });

  // 통합 등급 분포 · 로컬 SQLite (aibio_*) 기준 빠른 읽기
  router.get("/api/aibio/tier-distribution", (_req: Request, res: Response) => {
    try {
      const db = getCrmDb();
      const rows = db
        .prepare(
          `
          WITH cust_rev AS (
            SELECT customer_id, SUM(amount) AS rev
            FROM aibio_payments
            WHERE payment_date >= date('now','-12 months')
            GROUP BY customer_id
          )
          SELECT
            CASE
              WHEN rev >= 10000000 THEN 'PRIME'
              WHEN rev >= 5000000  THEN 'PLATINUM'
              WHEN rev >= 2000000  THEN 'GOLD'
              WHEN rev >= 1000000  THEN 'SILVER'
              WHEN rev >= 300000   THEN 'INITIATE'
              ELSE 'below'
            END AS tier,
            COUNT(*) AS customers,
            SUM(rev) AS total_rev
          FROM cust_rev
          GROUP BY 1
          ORDER BY CASE tier
            WHEN 'PRIME' THEN 1
            WHEN 'PLATINUM' THEN 2
            WHEN 'GOLD' THEN 3
            WHEN 'SILVER' THEN 4
            WHEN 'INITIATE' THEN 5
            ELSE 6
          END
          `,
        )
        .all();
      res.json({ ok: true, basedOn: "aibio_payments (12 months)", tiers: rows });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "query failed" });
    }
  });

  return router;
};
