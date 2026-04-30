import assert from "node:assert/strict";
import test from "node:test";

import {
  _internal_npayRoasDryRun,
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
