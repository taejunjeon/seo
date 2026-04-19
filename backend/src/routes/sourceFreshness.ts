import express, { type Request, type Response } from "express";

import { collectSourceFreshness, getDefaultSourceFreshnessOptions } from "../sourceFreshness";

const parsePositiveNumber = (value: unknown, fallback: number) => {
  if (typeof value !== "string" || !value.trim()) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const createSourceFreshnessRouter = () => {
  const router = express.Router();

  router.get("/api/source-freshness", async (req: Request, res: Response) => {
    try {
      const defaults = getDefaultSourceFreshnessOptions();
      const payload = await collectSourceFreshness({
        crmDbPath: defaults.crmDbPath,
        warnHours: parsePositiveNumber(req.query.warnHours, defaults.warnHours),
        staleHours: parsePositiveNumber(req.query.staleHours, defaults.staleHours),
      });

      res.json({ ok: true, ...payload });
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: "source_freshness_error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  return router;
};
