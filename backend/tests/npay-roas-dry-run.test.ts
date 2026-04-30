import assert from "node:assert/strict";
import test from "node:test";

import {
  _internal_npayRoasDryRun,
  renderNpayRoasDryRunMarkdown,
  type NpayRoasDryRunIntent,
  type NpayRoasDryRunReport,
  type NpayRoasDryRunOrder,
} from "../src/npayRoasDryRun";

const baseOrder: NpayRoasDryRunOrder = {
  orderNumber: "202604309594732",
  channelOrderNo: "2026043044799490",
  paidAt: "2026-04-30T07:01:14.000Z",
  paymentMethod: "NAVERPAY_ORDER",
  paymentStatus: "PAYMENT_COMPLETE",
  orderAmount: 11900,
  orderItemTotal: 8900,
  deliveryPrice: 3000,
  discountAmount: 0,
  quantity: 1,
  productNames: ["팀키토 슬로우 에이징 도시락 7종 골라담기"],
  lineProductCount: 1,
};

test("npay dry-run amount: shipping-included NPay payment is reconciled", () => {
  const amount = _internal_npayRoasDryRun.amountMatch(8900, baseOrder, true);

  assert.equal(amount.matched, true);
  assert.equal(amount.type, "shipping_reconciled");
  assert.equal(amount.score, 20);
  assert.equal(amount.amountDelta, 3000);
  assert.match(amount.reason, /shipping_reconciled=true/);
});

test("npay dry-run ga4 guard: lookup uses both Imweb order number and NPay channel order number", () => {
  assert.deepEqual(_internal_npayRoasDryRun.buildGa4LookupIds(baseOrder), [
    "202604309594732",
    "2026043044799490",
  ]);

  assert.equal(
    _internal_npayRoasDryRun.resolveGa4Presence(
      ["202604309594732", "2026043044799490"],
      new Set(["2026043044799490"]),
      new Set(),
    ),
    "present",
  );

  assert.equal(
    _internal_npayRoasDryRun.resolveGa4Presence(
      ["202604309594732", "2026043044799490"],
      new Set(),
      new Set(["202604309594732"]),
    ),
    "unknown",
  );

  assert.equal(
    _internal_npayRoasDryRun.resolveGa4Presence(
      ["202604309594732", "2026043044799490"],
      new Set(),
      new Set(["202604309594732", "2026043044799490"]),
    ),
    "absent",
  );
});

test("npay dry-run grade: shipping-reconciled strong match can be A grade", () => {
  const candidate = _internal_npayRoasDryRun.buildCandidate(
    baseOrder,
    {
      id: "intent-1",
      intentKey: "intent-key-1",
      capturedAt: "2026-04-30T07:00:23.688Z",
      site: "biocom",
      source: "gtm_118",
      environment: "live",
      matchStatus: "pending",
      clientId: "349382661.1770783461",
      gaSessionId: "1777532376",
      gaSessionNumber: "19",
      gclid: "",
      gbraid: "",
      wbraid: "",
      fbp: "fb.1.1770783460204.368997675324386965",
      fbc: "",
      fbclid: "",
      utmSource: "",
      utmMedium: "",
      utmCampaign: "",
      pageLocation: "https://biocom.kr/DietMealBox/?idx=424",
      pageReferrer: "https://biocom.kr/supplements",
      productIdx: "424",
      productName: "팀키토 슬로우 에이징 도시락 7종 골라담기",
      productPrice: 8900,
      memberCode: "",
      memberHash: "",
      phoneHash: "",
      emailHash: "",
      duplicateCount: 0,
    },
  );

  assert.equal(candidate.amountMatchType, "shipping_reconciled");
  assert.equal(candidate.score, 80);
  assert.equal(
    _internal_npayRoasDryRun.classifyStrongGrade(candidate, candidate.score, candidate.score, {
      minScore: 70,
      maxTimeGapMinutes: 2,
      minScoreGap: 15,
    }),
    "A",
  );
});

test("npay dry-run grade: item-only amount match is not A grade", () => {
  const itemOnlyOrder: NpayRoasDryRunOrder = {
    ...baseOrder,
    orderAmount: 10000,
    orderItemTotal: 8900,
    deliveryPrice: 0,
  };
  const candidate = _internal_npayRoasDryRun.buildCandidate(
    itemOnlyOrder,
    {
      id: "intent-2",
      intentKey: "intent-key-2",
      capturedAt: "2026-04-30T07:00:23.688Z",
      site: "biocom",
      source: "gtm_118",
      environment: "live",
      matchStatus: "pending",
      clientId: "349382661.1770783461",
      gaSessionId: "1777532376",
      gaSessionNumber: "19",
      gclid: "",
      gbraid: "",
      wbraid: "",
      fbp: "fb.1.1770783460204.368997675324386965",
      fbc: "",
      fbclid: "",
      utmSource: "",
      utmMedium: "",
      utmCampaign: "",
      pageLocation: "https://biocom.kr/DietMealBox/?idx=424",
      pageReferrer: "https://biocom.kr/supplements",
      productIdx: "424",
      productName: "팀키토 슬로우 에이징 도시락 7종 골라담기",
      productPrice: 8900,
      memberCode: "",
      memberHash: "",
      phoneHash: "",
      emailHash: "",
      duplicateCount: 0,
    },
  );

  assert.equal(candidate.amountMatchType, "item_exact");
  assert.equal(
    _internal_npayRoasDryRun.classifyStrongGrade(candidate, candidate.score, candidate.score, {
      minScore: 70,
      maxTimeGapMinutes: 2,
      minScoreGap: 15,
    }),
    "B",
  );
});

test("npay dry-run markdown includes early decision and manual review sections", () => {
  const intent: NpayRoasDryRunIntent = {
    id: "intent-3",
    intentKey: "intent-key-3",
    capturedAt: "2026-04-30T07:00:23.688Z",
    site: "biocom",
    source: "gtm_118",
    environment: "live",
    matchStatus: "pending",
    clientId: "349382661.1770783461",
    gaSessionId: "1777532376",
    gaSessionNumber: "19",
    gclid: "",
    gbraid: "",
    wbraid: "",
    fbp: "fb.1.1770783460204.368997675324386965",
    fbc: "",
    fbclid: "",
    utmSource: "",
    utmMedium: "",
    utmCampaign: "",
    pageLocation: "https://biocom.kr/DietMealBox/?idx=424",
    pageReferrer: "https://biocom.kr/supplements",
    productIdx: "424",
    productName: "팀키토 슬로우 에이징 도시락 7종 골라담기",
    productPrice: 8900,
    memberCode: "",
    memberHash: "",
    phoneHash: "",
    emailHash: "",
    duplicateCount: 0,
  };
  const candidate = _internal_npayRoasDryRun.buildCandidate(baseOrder, intent);
  const report: NpayRoasDryRunReport = {
    ok: true,
    mode: "dry_run_read_only",
    generatedAt: "2026-04-30T09:26:10.008Z",
    source: {
      intents: "readonly sqlite npay_intent_log (test)",
      orders: "readonly operational_postgres.public.tb_iamweb_users",
    },
    window: {
      start: "2026-04-27T09:10:00.000Z",
      end: "2026-04-30T08:48:00.000Z",
      site: "biocom",
      noPurchaseGraceHours: 24,
      clickedNoPurchaseCutoffAt: "2026-04-29T08:48:00.000Z",
    },
    thresholds: {
      strongScoreThreshold: 50,
      minScoreGap: 10,
      gradeA: {
        minScore: 70,
        requiredAmountMatchType: "final_or_reconciled",
        maxTimeGapMinutes: 2,
        minScoreGap: 15,
      },
      maxCandidateLookbackHours: 24,
    },
    summary: {
      liveIntentCount: 296,
      confirmedNpayOrderCount: 1,
      strongMatch: 0,
      strongMatchA: 0,
      strongMatchB: 0,
      ambiguous: 1,
      purchaseWithoutIntent: 0,
      dispatcherDryRunCandidate: 0,
      alreadyInGa4Blocked: 0,
      alreadyInGa4LookupPresent: 0,
      alreadyInGa4LookupAbsent: 0,
      alreadyInGa4LookupUnknown: 1,
      ga4LookupRequiredOrderCount: 0,
      ga4LookupIdCount: 0,
      testOrderBlocked: 0,
      manualOrderCount: 0,
      amountMatchTypeCounts: {
        final_exact: 0,
        item_exact: 0,
        shipping_reconciled: 1,
        discount_reconciled: 0,
        quantity_reconciled: 0,
        cart_contains_item: 0,
        near: 0,
        none: 0,
        unknown: 0,
      },
      shippingReconciledCount: 1,
      shippingReconciledNotGradeACount: 1,
      clickedPurchasedCandidate: 0,
      clickedNoPurchase: 208,
      intentPending: 80,
    },
    orderResults: [
      {
        order: baseOrder,
        orderLabel: "production_order",
        ga4LookupIds: ["202604309594732", "2026043044799490"],
        status: "ambiguous",
        strongGrade: null,
        sendAllowed: false,
        dispatcherDryRun: {
          candidate: false,
          dryRunOnly: true,
          alreadyInGa4: "unknown",
          blockReasons: ["ambiguous", "not_a_grade_strong", "already_in_ga4_unknown"],
        },
        ga4PayloadPreview: {
          orderNumber: baseOrder.orderNumber,
          channelOrderNo: baseOrder.channelOrderNo,
          matchedIntentId: candidate.intentId,
          clientId: candidate.clientId,
          gaSessionId: candidate.gaSessionId,
          value: baseOrder.orderAmount,
          currency: "KRW",
          eventId: `NPayRecoveredPurchase_${baseOrder.orderNumber}`,
          sendCandidate: false,
          blockReason: ["ambiguous", "not_a_grade_strong", "already_in_ga4_unknown"],
        },
        bestCandidate: candidate,
        secondCandidate: null,
        bestScore: candidate.score,
        secondScore: null,
        scoreGap: candidate.score,
        candidateCount: 1,
        candidates: [candidate],
        ambiguousReasons: ["no_member_key"],
      },
    ],
    intentResults: [
      {
        intent,
        status: "clicked_no_purchase",
        candidateOrderNumbers: [baseOrder.orderNumber],
        bestOrderNumber: baseOrder.orderNumber,
        bestScore: candidate.score,
      },
    ],
    breakdowns: {
      ambiguousReasons: [
        {
          key: "no_member_key",
          count: 1,
          sharePct: 100,
          orderNumbers: [baseOrder.orderNumber],
        },
      ],
      clickedNoPurchase: {
        byProduct: [
          {
            key: "424|팀키토 슬로우 에이징 도시락 7종 골라담기",
            productIdx: "424",
            productName: "팀키토 슬로우 에이징 도시락 7종 골라담기",
            count: 1,
            sharePct: 100,
          },
        ],
        byAdKey: [{ key: "fbp", count: 1, sharePct: 100 }],
        byKstHour: [{ key: "2026-04-30 16:00 KST", count: 1, sharePct: 100 }],
      },
    },
    notes: [],
  };

  const markdown = renderNpayRoasDryRunMarkdown(report);

  assert.match(markdown, /## Early Phase2 Decision Package/);
  assert.match(markdown, /## Manual Review Queue/);
  assert.match(markdown, /### BigQuery Query Template/);
  assert.match(markdown, /## Guardrail/);
});
