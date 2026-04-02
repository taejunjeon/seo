import test from "node:test";
import assert from "node:assert/strict";

test("GA4 SEO conversion diagnosis: flags core causes from mixed-scope inputs", async () => {
  process.env.GA4_PROPERTY_ID ??= "test";

  const { buildGA4SeoConversionDiagnostic } = await import("../src/ga4");

  const result = buildGA4SeoConversionDiagnostic({
    range: { startDate: "2026-02-28", endDate: "2026-03-28" },
    organicSessionScope: {
      sessions: 100,
      entrances: 95,
      ecommercePurchases: 120,
      keyEvents: 145,
      grossPurchaseRevenue: 5_000_000,
    },
    organicFirstUserScope: {
      totalUsers: 80,
      ecommercePurchases: 60,
      grossPurchaseRevenue: 2_000_000,
    },
    queryStringSignals: {
      shopViewPathViews: 500,
      shopViewVariantCount: 3,
      shopViewVariantViews: 420,
      topShopViewVariants: [
        { path: "/shop_view/?idx=264", pageViews: 210 },
        { path: "/shop_view/?idx=266", pageViews: 130 },
      ],
    },
    sourceSignals: {
      notSetRevenue: 130_000_000,
      notSetPurchases: 320,
      selfReferralRevenue: 15_000_000,
      selfReferralPurchases: 40,
      suspiciousSources: ["(not set)", "biocom.imweb.me"],
    },
    funnelSignals: {
      method: "runFunnelReport",
      purchaseUsers: 0,
      totalPurchases: 120,
    },
    dataQualitySignals: {
      notSetLandingRatio: 0.159,
    },
    transactionSignals: {
      distinctTransactionIds: 95,
      totalPurchaseEvents: 120,
      blankTransactionEvents: 12,
      duplicatePurchaseEvents: 9,
      transactionCoverageRatio: 0.79,
    },
    debugNotes: [],
  });

  assert.equal(result.issues.length, 7);
  assert.equal(result.recommendedChecks.length, 5);

  const sessionMix = result.issues.find((issue) => issue.id === "session_event_scope_mix");
  assert.ok(sessionMix);
  assert.equal(sessionMix?.severity, "warning");

  const crossDomain = result.issues.find((issue) => issue.id === "cross_domain_pg_break");
  assert.ok(crossDomain);
  assert.equal(crossDomain?.severity, "error");
  assert.match(crossDomain?.summary ?? "", /실제 구매는 잡히는데/);

  const landingNotSet = result.issues.find((issue) => issue.id === "landing_not_set");
  assert.ok(landingNotSet);
  assert.equal(landingNotSet?.severity, "error");

  const transactionQuality = result.issues.find((issue) => issue.id === "transaction_id_quality");
  assert.ok(transactionQuality);
  assert.equal(transactionQuality?.severity, "warning");
});
