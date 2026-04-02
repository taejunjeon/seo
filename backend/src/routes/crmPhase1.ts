import express, { type Request, type Response } from "express";

import { getPhase1OpsSnapshot } from "../crmPhase1";
import { daysAgo } from "../utils/dateUtils";

export const createCrmPhase1Router = () => {
  const router = express.Router();

  router.get("/api/crm-phase1/ops", async (req: Request, res: Response) => {
    const startDate = typeof req.query.startDate === "string" ? req.query.startDate : daysAgo(30);
    const endDate = typeof req.query.endDate === "string" ? req.query.endDate : daysAgo(1);
    const experimentKey =
      typeof req.query.experimentKey === "string" ? req.query.experimentKey.trim() : undefined;

    try {
      const snapshot = await getPhase1OpsSnapshot({
        startDate,
        endDate,
        experimentKey,
      });
      res.json({
        ok: true,
        data: snapshot,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "phase1 ops snapshot failed";
      res.status(500).json({ ok: false, error: "crm_phase1_ops_error", message });
    }
  });

  return router;
};
