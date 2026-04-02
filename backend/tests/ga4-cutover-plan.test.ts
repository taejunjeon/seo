import assert from "node:assert/strict";
import test from "node:test";

import { getGa4CutoverPlan } from "../src/ga4Cutover";

test("ga4 cutover plan keeps W2 / G-W as canonical structure", () => {
  const plan = getGa4CutoverPlan();

  assert.equal(plan.canonical.canonicalContainerId, "GTM-W2Z6PHN");
  assert.equal(plan.canonical.canonicalPropertyName, "[G4] biocom.kr");
  assert.equal(plan.canonical.canonicalPropertyId, "304759974");
  assert.equal(plan.canonical.canonicalMeasurementId, "G-WJFXN5E2Q1");
});

test("ga4 cutover plan fixes GTM work spec according to source of truth", () => {
  const plan = getGa4CutoverPlan();
  const byTag = new Map(plan.gtmWorkSpec.map((item) => [item.tagName, item]));

  assert.equal(byTag.get("GA4_픽셀")?.action, "유지");
  assert.equal(byTag.get("GA4_픽셀2")?.action, "pause");
  assert.equal(byTag.get("[new]Google 태그")?.action, "rename");
  assert.equal(byTag.get("HURDLERS [이벤트전송] 구매")?.action, "유지");
  assert.equal(byTag.get("HURDLERS [이벤트전송] 네이버페이 구매")?.action, "rename");
});

test("ga4 cutover plan treats general purchase as canonical and npay as support signal", () => {
  const plan = getGa4CutoverPlan();
  const summary = plan.tenSecondSummary.join(" ");
  const latest = plan.latestStatus.map((item) => item.detail).join(" ");

  assert.match(summary, /일반 구매는 HURDLERS \[이벤트전송\] 구매를 그대로 canonical sender/);
  assert.match(latest, /items는 source variable은 존재하지만 DebugView 실측 확인은 아직 미완료/);
  assert.match(latest, /NPay는 pay\.naver\.com/);
  assert.match(plan.addPaymentInfoSpec.npayDecision.join(" "), /npay_click/);
});

test("ga4 cutover plan includes payload completeness spec and items validation details", () => {
  const plan = getGa4CutoverPlan();
  const items = plan.purchasePayloadSpec.find((item) => item.fieldName === "items");
  const transactionId = plan.purchasePayloadSpec.find((item) => item.fieldName === "transaction_id");

  assert.match(transactionId?.sourceExists ?? "", /hurdlers_ga4\.transaction_id/);
  assert.match(items?.sourceExists ?? "", /hurdlers_ga4\.items/);
  assert.match(items?.measuredStatus ?? "", /미완료/);
  assert.match(plan.itemsValidationPlan.sourceVariable, /hurdlers_ga4\.items/);
  assert.ok(plan.itemsValidationPlan.expectedSchema.includes("item_id"));
  assert.ok(plan.itemsValidationPlan.expectedSchema.includes("item_variant"));
});

test("ga4 cutover plan asks only minimal next materials", () => {
  const plan = getGa4CutoverPlan();

  assert.match(plan.materialRequests.required.join(" "), /DebugView expanded payload/);
  assert.match(plan.materialRequests.required.join(" "), /NPay 테스트 1건/);
  assert.match(plan.materialRequests.reference.join(" "), /W7 벤더 export/);
  assert.deepEqual(
    plan.rollout.map((item) => item.day),
    ["Day 0", "Day 1", "Day 3"],
  );
});
