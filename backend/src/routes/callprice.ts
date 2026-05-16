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
  fetchSupplementFirstLtv,
  parseCallpriceMaturityDays,
  resolveCallpriceDateRange,
  type CallpriceBaselineScope,
  type CallpriceManagerSortField,
} from "../callprice";
import { isDatabaseConfigured } from "../postgres";
import { getLazyCached, setLazyCached, getLazyCachedStale } from "../lib/lazyCache";

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

// callprice endpoint 들은 운영DB join 쿼리로 1~4초씩 걸림 → 10분 lazy cache 로 흡수.
// 같은 (range, maturity_days, baseline_scope, manager, analysisType) 조합은 같은 cache key.
// cache miss 만 SQL 실행. hit 시 ~10ms.
const CALLPRICE_CACHE_TTL_MS = 10 * 60 * 1000;
const CALLPRICE_STALE_MAX_AGE_MS = 60 * 60 * 1000;

const respondCallpriceCached = async <T>(
  res: Response,
  key: string,
  compute: () => Promise<T>,
  errorTag: string,
): Promise<void> => {
  const cached = getLazyCached(key);
  if (cached) {
    res.json(cached.result);
    return;
  }
  try {
    const fresh = await compute();
    setLazyCached(key, fresh, CALLPRICE_CACHE_TTL_MS);
    res.json(fresh);
  } catch (error) {
    // 운영DB 일시 실패 시 stale cache 가 있으면 그것 반환 (1시간 이내).
    const stale = getLazyCachedStale(key, CALLPRICE_STALE_MAX_AGE_MS);
    if (stale) {
      res.json(stale.result);
      return;
    }
    const message = error instanceof Error ? error.message : `Failed to load ${errorTag}`;
    res.status(500).json({ error: errorTag, message });
  }
};

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
    await respondCallpriceCached(
      res,
      "callprice:options",
      () => fetchCallpriceOptions(),
      "callprice_options_error",
    );
  });

  router.get("/api/callprice/subscription-status", async (_req: Request, res: Response) => {
    await respondCallpriceCached(
      res,
      "callprice:subscription-status",
      () => fetchCallpriceSubscriptionStatus(),
      "callprice_subscription_status_error",
    );
  });

  router.get("/api/callprice/subscription-consult-comparison", async (_req: Request, res: Response) => {
    await respondCallpriceCached(
      res,
      "callprice:subscription-consult-comparison",
      () => fetchCallpriceSubscriptionConsultComparison(),
      "callprice_subscription_consult_comparison_error",
    );
  });

  router.get("/api/callprice/overview", async (req: Request, res: Response) => {
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

    const manager = pickFirstString(req.query.manager);
    const analysisType = pickFirstString(req.query.analysis_type, req.query.analysisType);
    const key = `callprice:overview:${range.startDate}:${range.endDate}:${maturityDays}:${baselineScope}:${manager}:${analysisType}`;
    await respondCallpriceCached(
      res,
      key,
      () => fetchCallpriceOverview({
        range,
        manager,
        analysisType,
        maturityDays,
        baselineScope,
      }),
      "callprice_overview_error",
    );
  });

  router.get("/api/callprice/managers", async (req: Request, res: Response) => {
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

    const analysisType = pickFirstString(req.query.analysis_type, req.query.analysisType);
    const key = `callprice:managers:${range.startDate}:${range.endDate}:${maturityDays}:${baselineScope}:${analysisType}:${sortBy}:${sortOrder}`;
    await respondCallpriceCached(
      res,
      key,
      () => fetchCallpriceManagers({
        range,
        analysisType,
        maturityDays,
        baselineScope,
        sortBy,
        sortOrder,
      }),
      "callprice_managers_error",
    );
  });

  router.get("/api/callprice/analysis-types", async (req: Request, res: Response) => {
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

    const manager = pickFirstString(req.query.manager);
    const key = `callprice:analysis-types:${range.startDate}:${range.endDate}:${maturityDays}:${baselineScope}:${manager}`;
    await respondCallpriceCached(
      res,
      key,
      () => fetchCallpriceAnalysisTypes({
        range,
        manager,
        maturityDays,
        baselineScope,
      }),
      "callprice_analysis_types_error",
    );
  });

  router.get("/api/callprice/scenario", async (req: Request, res: Response) => {
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

    const manager = pickFirstString(req.query.manager);
    const analysisType = pickFirstString(req.query.analysis_type, req.query.analysisType);
    const key = `callprice:scenario:${range.startDate}:${range.endDate}:${maturityDays}:${baselineScope}:${manager}:${analysisType}:${monthlyCost}:${headcount}`;
    await respondCallpriceCached(
      res,
      key,
      () => fetchCallpriceScenario({
        range,
        manager,
        analysisType,
        maturityDays,
        baselineScope,
        monthlyCost,
        headcount,
      }),
      "callprice_scenario_error",
    );
  });

  router.get("/api/callprice/daytype-comparison", async (req: Request, res: Response) => {
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

    const key = `callprice:daytype-comparison:${range.startDate}:${range.endDate}:${valueMaturityDays}`;
    await respondCallpriceCached(
      res,
      key,
      () => fetchCallpriceDayTypeComparison({
        range,
        valueMaturityDays,
      }),
      "callprice_daytype_comparison_error",
    );
  });

  router.get("/api/callprice/rampup", async (req: Request, res: Response) => {
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

    const key = `callprice:rampup:${maturityDays}:${baselineScope}`;
    await respondCallpriceCached(
      res,
      key,
      () => fetchCallpriceRampup({
        maturityDays,
        baselineScope,
      }),
      "callprice_rampup_error",
    );
  });

  router.get("/api/callprice/supplement-purchase-timing", async (req: Request, res: Response) => {
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

    const manager = pickFirstString(req.query.manager);
    const analysisType = pickFirstString(req.query.analysis_type, req.query.analysisType);
    const key = `callprice:supplement-purchase-timing:${range.startDate}:${range.endDate}:${maturityDays}:${baselineScope}:${manager}:${analysisType}`;
    await respondCallpriceCached(
      res,
      key,
      () => fetchCallpriceSupplementPurchaseTiming({
        range,
        manager,
        analysisType,
        maturityDays,
        baselineScope,
      }),
      "callprice_supplement_purchase_timing_error",
    );
  });

  router.get("/api/callprice/supplement-repeat-pattern", async (req: Request, res: Response) => {
    const range = resolveCallpriceDateRange({
      startDateParam: pickFirstString(req.query.start_date, req.query.startDate),
      endDateParam: pickFirstString(req.query.end_date, req.query.endDate),
    });
    if (!range.ok) {
      res.status(400).json(range);
      return;
    }

    const manager = pickFirstString(req.query.manager);
    const analysisType = pickFirstString(req.query.analysis_type, req.query.analysisType);
    const key = `callprice:supplement-repeat-pattern:${range.startDate}:${range.endDate}:${manager}:${analysisType}`;
    await respondCallpriceCached(
      res,
      key,
      () => fetchCallpriceSupplementRepeatPattern({
        range,
        manager,
        analysisType,
      }),
      "callprice_supplement_repeat_pattern_error",
    );
  });

  router.get("/api/callprice/supplement-first-ltv", async (req: Request, res: Response) => {
    const startDate = pickFirstString(req.query.start_date, req.query.startDate);
    const endDate = pickFirstString(req.query.end_date, req.query.endDate);
    const key = `callprice:supplement-first-ltv:${startDate}:${endDate}`;
    await respondCallpriceCached(
      res,
      key,
      () => fetchSupplementFirstLtv({
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      }),
      "supplement_first_ltv_error",
    );
  });

  return router;
};
