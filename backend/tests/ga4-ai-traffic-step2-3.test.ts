import test from "node:test";
import assert from "node:assert/strict";

import { BetaAnalyticsDataClient } from "@google-analytics/data";

import { resolveIsoDateRange } from "../src/dateRange";

const makeRow = (dims: string[], metrics: Array<string | number>) => ({
  dimensionValues: dims.map((value) => ({ value })),
  metricValues: metrics.map((value) => ({ value: String(value) })),
});

test("dateRange: validates YYYY-MM-DD and startDate <= endDate", () => {
  const bad = resolveIsoDateRange({
    startDateParam: "2026/01/01",
    endDateParam: "2026-02-26",
    defaultStartDate: "2026-01-27",
    defaultEndDate: "2026-02-26",
  });
  assert.equal(bad.ok, false);
  if (!bad.ok) {
    assert.equal(bad.error, "잘못된 기간 파라미터입니다.");
    assert.equal(bad.details, "startDate/endDate must be YYYY-MM-DD");
  }

  const inverted = resolveIsoDateRange({
    startDateParam: "2026-02-26",
    endDateParam: "2026-01-27",
    defaultStartDate: "2026-01-27",
    defaultEndDate: "2026-02-26",
  });
  assert.equal(inverted.ok, false);
  if (!inverted.ok) {
    assert.equal(inverted.error, "잘못된 기간 파라미터입니다.");
    assert.equal(inverted.details, "startDate must be before or equal to endDate");
  }

  const ok = resolveIsoDateRange({
    defaultStartDate: "2026-01-27",
    defaultEndDate: "2026-02-26",
  });
  assert.deepEqual(ok, { ok: true, startDate: "2026-01-27", endDate: "2026-02-26" });
});

test("GA4: ai-traffic detailed includes expanded engagement metrics + bounceRate fraction", async (t) => {
  process.env.GA4_PROPERTY_ID ??= "test";

  const queue: any[] = [
    // unionTotalsMainRes (no dimensions, MAIN metrics)
    [
      {
        rows: [
          makeRow([], [
            110, // sessions
            90, // activeUsers
            100, // totalUsers
            80, // newUsers
            70, // engagedSessions
            0.221, // bounceRate (fraction)
            0.779, // engagementRate (fraction)
            225, // averageSessionDuration (seconds)
            300, // screenPageViews
          ]),
        ],
        totals: [],
      },
    ],
    // unionTotalsCommerceRes (no dimensions, COMMERCE metrics)
    [
      {
        rows: [makeRow([], [110, 17, 33000])],
        totals: [],
      },
    ],
    // unionByLandingMainRes (landingPagePlusQueryString, MAIN metrics)
    [
      {
        rows: [
          makeRow(["/"], [60, 50, 55, 40, 35, 0.2, 0.8, 200, 120]),
          makeRow(["/products"], [50, 40, 45, 40, 35, 0.25, 0.75, 250, 180]),
        ],
      },
    ],
    // unionByLandingCommerceRes (landingPagePlusQueryString, COMMERCE metrics)
    [
      {
        rows: [
          makeRow(["/"], [60, 10, 20000]),
          makeRow(["/products"], [50, 7, 13000]),
        ],
      },
    ],
    // bySourceMainRes (sessionSource + sessionMedium, MAIN metrics) - referrer only
    [
      {
        rows: [
          makeRow(["chatgpt.com", "referral"], [100, 80, 90, 70, 60, 0.22, 0.78, 230, 260]),
        ],
      },
    ],
    // bySourceCommerceRes (sessionSource + sessionMedium, COMMERCE metrics) - referrer only
    [
      {
        rows: [
          makeRow(["chatgpt.com", "referral"], [100, 17, 33000]),
        ],
      },
    ],
    // utmTotalsMainRes (no dimensions, MAIN metrics) - utm supplement only (disjoint)
    [
      {
        rows: [
          makeRow([], [10, 9, 10, 10, 9, 0.1, 0.9, 180, 40]),
        ],
        totals: [],
      },
    ],
  ];

  const originalRunReport = BetaAnalyticsDataClient.prototype.runReport;
  BetaAnalyticsDataClient.prototype.runReport = (async (_req: any) => {
    const next = queue.shift();
    if (!next) throw new Error("Unexpected GA4 runReport call (queue exhausted)");
    return next;
  }) as any;

  t.after(() => {
    BetaAnalyticsDataClient.prototype.runReport = originalRunReport;
  });

  const { queryGA4AiTrafficDetailed } = await import("../src/ga4");
  const report = await queryGA4AiTrafficDetailed({
    startDate: "2026-01-27",
    endDate: "2026-02-26",
    forceRefresh: true,
  });

  // (1) expanded metrics present
  assert.equal(typeof report.totals.totalUsers, "number");
  assert.equal(typeof report.totals.engagedSessions, "number");
  assert.equal(typeof report.totals.screenPageViews, "number");

  // (2) bounceRate is fraction (0..1), not percent
  assert.equal(report.totals.bounceRate, 0.221);
  assert.ok(report.totals.bounceRate >= 0 && report.totals.bounceRate <= 1);

  // (3) identification method
  assert.equal(report.identification.method, "both");

  // (4) bySource rows include merged commerce metrics and category
  assert.equal(report.bySource[0]?.sessionSource, "chatgpt.com");
  assert.equal(report.bySource[0]?.category, "ai_referral");
  assert.equal(report.bySource[0]?.ecommercePurchases, 17);
  assert.equal(report.bySource[0]?.grossPurchaseRevenue, 33000);
});

test("GA4: ai-traffic user-type includes summary + category per row", async (t) => {
  process.env.GA4_PROPERTY_ID ??= "test";

  const queue: any[] = [
    // summaryRes (newVsReturning, union)
    [
      {
        rows: [
          makeRow(["new"], [80, 70, 60, 0.2, 0.8, 210, 8, 18000]),
          makeRow(["returning"], [50, 40, 35, 0.3, 0.7, 180, 5, 15000]),
        ],
      },
    ],
    // bySourceRes (newVsReturning + sessionSource, referrer only)
    [
      {
        rows: [
          makeRow(["new", "chatgpt.com"], [75, 65, 55, 0.21, 0.79, 220, 7, 17000]),
          makeRow(["returning", "chatgpt.com"], [45, 35, 30, 0.31, 0.69, 175, 5, 15000]),
        ],
      },
    ],
    // byUtmRes (newVsReturning + sessionManualSource, utm supplement)
    [
      {
        rows: [
          makeRow(["new", "chatgpt"], [5, 5, 5, 0.1, 0.9, 240, 1, 1000]),
        ],
      },
    ],
  ];

  const originalRunReport = BetaAnalyticsDataClient.prototype.runReport;
  BetaAnalyticsDataClient.prototype.runReport = (async (_req: any) => {
    const next = queue.shift();
    if (!next) throw new Error("Unexpected GA4 runReport call (queue exhausted)");
    return next;
  }) as any;

  t.after(() => {
    BetaAnalyticsDataClient.prototype.runReport = originalRunReport;
  });

  const { queryGA4AiTrafficUserType } = await import("../src/ga4");
  const report = await queryGA4AiTrafficUserType({
    startDate: "2026-01-27",
    endDate: "2026-02-26",
  });

  // (3) summary.new/returning 존재
  assert.equal(report.summary.new.sessions, 80);
  assert.equal(report.summary.returning.sessions, 50);

  // (4) bySourceAndType row has category + includes utm row
  const hasCategory = report.bySourceAndType.every((r) => typeof r.category === "string");
  assert.equal(hasCategory, true);

  const utmRow = report.bySourceAndType.find((r) => r.source === "utm:chatgpt");
  assert.ok(utmRow);
  assert.equal(utmRow?.category, "ai_referral");

  assert.equal(report.identification.method, "both");
});

