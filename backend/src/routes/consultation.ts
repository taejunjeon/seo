import express, { type Request, type Response } from "express";

import {
  CONSULTATION_CANDIDATE_SCENARIOS,
  CONSULTATION_STATUS_GROUPS,
  fetchConsultationCandidates,
  fetchConsultationManagers,
  fetchConsultationOrderMatch,
  fetchConsultationProductFollowup,
  fetchConsultationSummary,
  resolveConsultationDateRange,
  type ConsultationCandidateScenario,
  type ConsultationStatusGroup,
} from "../consultation";
import { isDatabaseConfigured } from "../postgres";

const parseString = (value: unknown) => (typeof value === "string" ? value.trim() : "");

const parseOptionalLimit = (value: unknown) => {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const isValidStatusGroup = (value: string): value is ConsultationStatusGroup =>
  CONSULTATION_STATUS_GROUPS.includes(value as ConsultationStatusGroup);

const isValidScenario = (value: string): value is ConsultationCandidateScenario =>
  CONSULTATION_CANDIDATE_SCENARIOS.includes(value as ConsultationCandidateScenario);

export const createConsultationRouter = () => {
  const router = express.Router();

  router.use("/api/consultation", (_req, res, next) => {
    if (!isDatabaseConfigured()) {
      res.status(503).json({
        error: "database_not_configured",
        message: "DATABASE_URL is required for consultation APIs.",
      });
      return;
    }

    next();
  });

  router.get("/api/consultation/summary", async (req: Request, res: Response) => {
    try {
      const range = resolveConsultationDateRange({
        startDateParam: parseString(req.query.startDate),
        endDateParam: parseString(req.query.endDate),
      });

      if (!range.ok) {
        res.status(400).json(range);
        return;
      }

      res.json(await fetchConsultationSummary(range));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load consultation summary";
      res.status(500).json({ error: "consultation_summary_error", message });
    }
  });

  router.get("/api/consultation/managers", async (req: Request, res: Response) => {
    try {
      const range = resolveConsultationDateRange({
        startDateParam: parseString(req.query.startDate),
        endDateParam: parseString(req.query.endDate),
      });

      if (!range.ok) {
        res.status(400).json(range);
        return;
      }

      res.json(
        await fetchConsultationManagers({
          range,
          limit: parseOptionalLimit(req.query.limit),
        }),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load manager KPIs";
      res.status(500).json({ error: "consultation_managers_error", message });
    }
  });

  router.get("/api/consultation/order-match", async (req: Request, res: Response) => {
    try {
      const range = resolveConsultationDateRange({
        startDateParam: parseString(req.query.startDate),
        endDateParam: parseString(req.query.endDate),
      });

      if (!range.ok) {
        res.status(400).json(range);
        return;
      }

      const statusGroupParam = parseString(req.query.statusGroup);
      if (statusGroupParam && !isValidStatusGroup(statusGroupParam)) {
        res.status(400).json({
          error: "validation_error",
          message: `statusGroup must be one of: ${CONSULTATION_STATUS_GROUPS.join(", ")}`,
        });
        return;
      }
      const statusGroup: ConsultationStatusGroup | undefined = statusGroupParam
        ? (statusGroupParam as ConsultationStatusGroup)
        : undefined;

      res.json(
        await fetchConsultationOrderMatch({
          range,
          manager: parseString(req.query.manager) || undefined,
          statusGroup,
        }),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load order match metrics";
      res.status(500).json({ error: "consultation_order_match_error", message });
    }
  });

  router.get("/api/consultation/product-followup", async (req: Request, res: Response) => {
    try {
      const range = resolveConsultationDateRange({
        startDateParam: parseString(req.query.startDate),
        endDateParam: parseString(req.query.endDate),
      });

      if (!range.ok) {
        res.status(400).json(range);
        return;
      }

      const statusGroupParam = parseString(req.query.statusGroup);
      if (statusGroupParam && !isValidStatusGroup(statusGroupParam)) {
        res.status(400).json({
          error: "validation_error",
          message: `statusGroup must be one of: ${CONSULTATION_STATUS_GROUPS.join(", ")}`,
        });
        return;
      }
      const statusGroup: ConsultationStatusGroup | undefined = statusGroupParam
        ? (statusGroupParam as ConsultationStatusGroup)
        : undefined;

      res.json(
        await fetchConsultationProductFollowup({
          range,
          manager: parseString(req.query.manager) || undefined,
          statusGroup,
        }),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load product follow-up metrics";
      res.status(500).json({ error: "consultation_product_followup_error", message });
    }
  });

  router.get("/api/consultation/candidates", async (req: Request, res: Response) => {
    try {
      const scenarioParam = parseString(req.query.scenario);
      if (!isValidScenario(scenarioParam)) {
        res.status(400).json({
          error: "validation_error",
          message: `scenario must be one of: ${CONSULTATION_CANDIDATE_SCENARIOS.join(", ")}`,
        });
        return;
      }

      res.json(
        await fetchConsultationCandidates({
          scenario: scenarioParam,
          manager: parseString(req.query.manager) || undefined,
          analysisType: parseString(req.query.analysisType) || undefined,
          limit: parseOptionalLimit(req.query.limit),
        }),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load consultation candidates";
      res.status(500).json({ error: "consultation_candidates_error", message });
    }
  });

  return router;
};
