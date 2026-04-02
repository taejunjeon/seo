import express, { type Request, type Response } from "express";

import {
  CALLPRICE_BASELINE_SCOPES,
  CALLPRICE_MANAGER_SORT_FIELDS,
  fetchCallpriceAnalysisTypes,
  fetchCallpriceDayTypeComparison,
  fetchCallpriceManagers,
  fetchCallpriceOptions,
  fetchCallpriceOverview,
  fetchCallpriceRampup,
  fetchCallpriceScenario,
  fetchCallpriceSubscriptionConsultComparison,
  fetchCallpriceSubscriptionStatus,
  fetchCallpriceSupplementRepeatPattern,
  fetchCallpriceSupplementPurchaseTiming,
  parseCallpriceMaturityDays,
  resolveCallpriceDateRange,
  type CallpriceBaselineScope,
  type CallpriceManagerSortField,
} from "../callprice";
import { isDatabaseConfigured } from "../postgres";

const parseString = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const pickFirstString = (...values: unknown[]) => {
  for (const value of values) {
    const parsed = parseString(value);
    if (parsed) return parsed;
  }
  return "";
};

const parsePositiveNumber = (value: unknown) => {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const parsePositiveInteger = (value: unknown) => {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const isValidBaselineScope = (value: string): value is CallpriceBaselineScope =>
  CALLPRICE_BASELINE_SCOPES.includes(value as CallpriceBaselineScope);

const isValidManagerSortField = (value: string): value is CallpriceManagerSortField =>
  CALLPRICE_MANAGER_SORT_FIELDS.includes(value as CallpriceManagerSortField);

export const createCallpriceRouter = () => {
  const router = express.Router();

  router.use("/api/callprice", (_req, res, next) => {
    if (!isDatabaseConfigured()) {
      res.status(503).json({
        error: "database_not_configured",
        message: "DATABASE_URL is required for callprice APIs.",
      });
      return;
    }

    next();
  });

  router.get("/api/callprice/options", async (_req: Request, res: Response) => {
    try {
      res.json(await fetchCallpriceOptions());
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load callprice options";
      res.status(500).json({ error: "callprice_options_error", message });
    }
  });

  router.get("/api/callprice/subscription-status", async (_req: Request, res: Response) => {
    try {
      res.json(await fetchCallpriceSubscriptionStatus());
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load subscription status";
      res.status(500).json({ error: "callprice_subscription_status_error", message });
    }
  });

  router.get("/api/callprice/subscription-consult-comparison", async (_req: Request, res: Response) => {
    try {
      res.json(await fetchCallpriceSubscriptionConsultComparison());
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load subscription consult comparison";
      res.status(500).json({ error: "callprice_subscription_consult_comparison_error", message });
    }
  });

  router.get("/api/callprice/overview", async (req: Request, res: Response) => {
    try {
      const range = resolveCallpriceDateRange({
        startDateParam: pickFirstString(req.query.start_date, req.query.startDate),
        endDateParam: pickFirstString(req.query.end_date, req.query.endDate),
      });
      if (!range.ok) {
        res.status(400).json(range);
        return;
      }

      const maturityDays = parseCallpriceMaturityDays(
        pickFirstString(req.query.maturity_days, req.query.maturityDays),
      );
      if (!maturityDays) {
        res.status(400).json({
          error: "validation_error",
          message: "maturity_days must be one of 30, 60, 90, 180",
        });
        return;
      }

      const baselineScopeParam = pickFirstString(
        req.query.baseline_scope,
        req.query.baselineScope,
      );
      const baselineScope = baselineScopeParam || "global_non_consultation";
      if (!isValidBaselineScope(baselineScope)) {
        res.status(400).json({
          error: "validation_error",
          message: `baseline_scope must be one of: ${CALLPRICE_BASELINE_SCOPES.join(", ")}`,
        });
        return;
      }

      res.json(
        await fetchCallpriceOverview({
          range,
          manager: pickFirstString(req.query.manager),
          analysisType: pickFirstString(req.query.analysis_type, req.query.analysisType),
          maturityDays,
          baselineScope,
        }),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load callprice overview";
      res.status(500).json({ error: "callprice_overview_error", message });
    }
  });

  router.get("/api/callprice/managers", async (req: Request, res: Response) => {
    try {
      const range = resolveCallpriceDateRange({
        startDateParam: pickFirstString(req.query.start_date, req.query.startDate),
        endDateParam: pickFirstString(req.query.end_date, req.query.endDate),
      });
      if (!range.ok) {
        res.status(400).json(range);
        return;
      }

      const maturityDays = parseCallpriceMaturityDays(
        pickFirstString(req.query.maturity_days, req.query.maturityDays),
      );
      if (!maturityDays) {
        res.status(400).json({
          error: "validation_error",
          message: "maturity_days must be one of 30, 60, 90, 180",
        });
        return;
      }

      const baselineScopeParam = pickFirstString(
        req.query.baseline_scope,
        req.query.baselineScope,
      );
      const baselineScope = baselineScopeParam || "global_non_consultation";
      if (!isValidBaselineScope(baselineScope)) {
        res.status(400).json({
          error: "validation_error",
          message: `baseline_scope must be one of: ${CALLPRICE_BASELINE_SCOPES.join(", ")}`,
        });
        return;
      }

      const sortByParam = pickFirstString(req.query.sort_by, req.query.sortBy);
      const sortBy = sortByParam || "estimated_incremental_revenue";
      if (!isValidManagerSortField(sortBy)) {
        res.status(400).json({
          error: "validation_error",
          message: `sort_by must be one of: ${CALLPRICE_MANAGER_SORT_FIELDS.join(", ")}`,
        });
        return;
      }

      const sortOrderParam = pickFirstString(req.query.sort_order, req.query.sortOrder);
      const sortOrder = sortOrderParam || "desc";
      if (sortOrder !== "asc" && sortOrder !== "desc") {
        res.status(400).json({
          error: "validation_error",
          message: "sort_order must be asc or desc",
        });
        return;
      }

      res.json(
        await fetchCallpriceManagers({
          range,
          analysisType: pickFirstString(req.query.analysis_type, req.query.analysisType),
          maturityDays,
          baselineScope,
          sortBy,
          sortOrder,
        }),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load callprice managers";
      res.status(500).json({ error: "callprice_managers_error", message });
    }
  });

  router.get("/api/callprice/analysis-types", async (req: Request, res: Response) => {
    try {
      const range = resolveCallpriceDateRange({
        startDateParam: pickFirstString(req.query.start_date, req.query.startDate),
        endDateParam: pickFirstString(req.query.end_date, req.query.endDate),
      });
      if (!range.ok) {
        res.status(400).json(range);
        return;
      }

      const maturityDays = parseCallpriceMaturityDays(
        pickFirstString(req.query.maturity_days, req.query.maturityDays),
      );
      if (!maturityDays) {
        res.status(400).json({
          error: "validation_error",
          message: "maturity_days must be one of 30, 60, 90, 180",
        });
        return;
      }

      const baselineScopeParam = pickFirstString(
        req.query.baseline_scope,
        req.query.baselineScope,
      );
      const baselineScope = baselineScopeParam || "global_non_consultation";
      if (!isValidBaselineScope(baselineScope)) {
        res.status(400).json({
          error: "validation_error",
          message: `baseline_scope must be one of: ${CALLPRICE_BASELINE_SCOPES.join(", ")}`,
        });
        return;
      }

      res.json(
        await fetchCallpriceAnalysisTypes({
          range,
          manager: pickFirstString(req.query.manager),
          maturityDays,
          baselineScope,
        }),
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load callprice analysis types";
      res.status(500).json({ error: "callprice_analysis_types_error", message });
    }
  });

  router.get("/api/callprice/scenario", async (req: Request, res: Response) => {
    try {
      const range = resolveCallpriceDateRange({
        startDateParam: pickFirstString(req.query.start_date, req.query.startDate),
        endDateParam: pickFirstString(req.query.end_date, req.query.endDate),
      });
      if (!range.ok) {
        res.status(400).json(range);
        return;
      }

      const maturityDays = parseCallpriceMaturityDays(
        pickFirstString(req.query.maturity_days, req.query.maturityDays),
      );
      if (!maturityDays) {
        res.status(400).json({
          error: "validation_error",
          message: "maturity_days must be one of 30, 60, 90, 180",
        });
        return;
      }

      const baselineScopeParam = pickFirstString(
        req.query.baseline_scope,
        req.query.baselineScope,
      );
      const baselineScope = baselineScopeParam || "global_non_consultation";
      if (!isValidBaselineScope(baselineScope)) {
        res.status(400).json({
          error: "validation_error",
          message: `baseline_scope must be one of: ${CALLPRICE_BASELINE_SCOPES.join(", ")}`,
        });
        return;
      }

      const monthlyCost = parsePositiveNumber(
        pickFirstString(req.query.monthly_cost, req.query.monthlyCost),
      );
      const headcount = parsePositiveInteger(pickFirstString(req.query.headcount));
      if (!monthlyCost || !headcount) {
        res.status(400).json({
          error: "validation_error",
          message: "monthly_cost and headcount must be positive numbers",
        });
        return;
      }

      res.json(
        await fetchCallpriceScenario({
          range,
          manager: pickFirstString(req.query.manager),
          analysisType: pickFirstString(req.query.analysis_type, req.query.analysisType),
          maturityDays,
          baselineScope,
          monthlyCost,
          headcount,
        }),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load callprice scenario";
      res.status(500).json({ error: "callprice_scenario_error", message });
    }
  });

  router.get("/api/callprice/daytype-comparison", async (req: Request, res: Response) => {
    try {
      const range = resolveCallpriceDateRange({
        startDateParam: pickFirstString(req.query.start_date, req.query.startDate),
        endDateParam: pickFirstString(req.query.end_date, req.query.endDate),
      });
      if (!range.ok) {
        res.status(400).json(range);
        return;
      }

      const valueMaturityDays = parseCallpriceMaturityDays(
        pickFirstString(req.query.value_maturity_days, req.query.valueMaturityDays),
        30,
      );
      if (!valueMaturityDays) {
        res.status(400).json({
          error: "validation_error",
          message: "value_maturity_days must be one of 30, 60, 90, 180, 365",
        });
        return;
      }

      res.json(
        await fetchCallpriceDayTypeComparison({
          range,
          valueMaturityDays,
        }),
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load callprice daytype comparison";
      res.status(500).json({ error: "callprice_daytype_comparison_error", message });
    }
  });

  router.get("/api/callprice/rampup", async (req: Request, res: Response) => {
    try {
      const maturityDays = parseCallpriceMaturityDays(
        pickFirstString(req.query.maturity_days, req.query.maturityDays),
      );
      if (!maturityDays) {
        res.status(400).json({
          error: "validation_error",
          message: "maturity_days must be one of 30, 60, 90, 180, 365",
        });
        return;
      }

      const baselineScopeParam = pickFirstString(
        req.query.baseline_scope,
        req.query.baselineScope,
      );
      const baselineScope = baselineScopeParam || "global_non_consultation";
      if (!isValidBaselineScope(baselineScope)) {
        res.status(400).json({
          error: "validation_error",
          message: `baseline_scope must be one of: ${CALLPRICE_BASELINE_SCOPES.join(", ")}`,
        });
        return;
      }

      res.json(
        await fetchCallpriceRampup({
          maturityDays,
          baselineScope,
        }),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load callprice rampup";
      res.status(500).json({ error: "callprice_rampup_error", message });
    }
  });

  router.get("/api/callprice/supplement-purchase-timing", async (req: Request, res: Response) => {
    try {
      const range = resolveCallpriceDateRange({
        startDateParam: pickFirstString(req.query.start_date, req.query.startDate),
        endDateParam: pickFirstString(req.query.end_date, req.query.endDate),
      });
      if (!range.ok) {
        res.status(400).json(range);
        return;
      }

      const maturityDays = parseCallpriceMaturityDays(
        pickFirstString(req.query.maturity_days, req.query.maturityDays),
      );
      if (!maturityDays) {
        res.status(400).json({
          error: "validation_error",
          message: "maturity_days must be one of 30, 60, 90, 180, 365",
        });
        return;
      }

      const baselineScopeParam = pickFirstString(
        req.query.baseline_scope,
        req.query.baselineScope,
      );
      const baselineScope = baselineScopeParam || "global_non_consultation";
      if (!isValidBaselineScope(baselineScope)) {
        res.status(400).json({
          error: "validation_error",
          message: `baseline_scope must be one of: ${CALLPRICE_BASELINE_SCOPES.join(", ")}`,
        });
        return;
      }

      res.json(
        await fetchCallpriceSupplementPurchaseTiming({
          range,
          manager: pickFirstString(req.query.manager),
          analysisType: pickFirstString(req.query.analysis_type, req.query.analysisType),
          maturityDays,
          baselineScope,
        }),
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to load callprice supplement purchase timing";
      res.status(500).json({ error: "callprice_supplement_purchase_timing_error", message });
    }
  });

  router.get("/api/callprice/supplement-repeat-pattern", async (req: Request, res: Response) => {
    try {
      const range = resolveCallpriceDateRange({
        startDateParam: pickFirstString(req.query.start_date, req.query.startDate),
        endDateParam: pickFirstString(req.query.end_date, req.query.endDate),
      });
      if (!range.ok) {
        res.status(400).json(range);
        return;
      }

      res.json(
        await fetchCallpriceSupplementRepeatPattern({
          range,
          manager: pickFirstString(req.query.manager),
          analysisType: pickFirstString(req.query.analysis_type, req.query.analysisType),
        }),
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to load callprice supplement repeat pattern";
      res.status(500).json({ error: "callprice_supplement_repeat_pattern_error", message });
    }
  });

  return router;
};
