import express, { type Request, type Response } from "express";

import {
  fetchChannelAcquisitionAnalysis,
  resolveAcquisitionAnalysisDateRange,
} from "../acquisitionAnalysis";

const parseString = (value: unknown) => (typeof value === "string" ? value.trim() : "");

const pickFirstString = (...values: unknown[]) => {
  for (const value of values) {
    const parsed = parseString(value);
    if (parsed) return parsed;
  }
  return "";
};

const parseLimit = (value: unknown) => {
  const parsed = parseString(value);
  if (!parsed) return undefined;

  const limit = Number.parseInt(parsed, 10);
  return Number.isFinite(limit) && limit > 0 ? limit : undefined;
};

export const createAcquisitionRouter = () => {
  const router = express.Router();

  router.get("/api/acquisition/channel-analysis", async (req: Request, res: Response) => {
    try {
      const range = resolveAcquisitionAnalysisDateRange({
        dateRange: pickFirstString(req.query.date_range, req.query.dateRange, req.query.date_preset),
        startDate: pickFirstString(req.query.start_date, req.query.startDate),
        endDate: pickFirstString(req.query.end_date, req.query.endDate),
      });
      if (!range.ok) {
        res.status(400).json(range);
        return;
      }

      const site = pickFirstString(req.query.site) || "biocom";
      const result = await fetchChannelAcquisitionAnalysis({
        site,
        range,
        limit: parseLimit(req.query.limit),
      });
      res.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "channel acquisition analysis failed";
      if (message.startsWith("unsupported_site:")) {
        res.status(400).json({
          ok: false,
          error: "validation_error",
          message: "site must be one of: biocom, thecleancoffee, aibio",
        });
        return;
      }

      res.status(500).json({ ok: false, error: "acquisition_channel_analysis_error", message });
    }
  });

  return router;
};
