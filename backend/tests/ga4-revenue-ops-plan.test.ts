import assert from "node:assert/strict";
import test from "node:test";

import { getGa4RevenueOpsPlan } from "../src/ga4RevenueOpsPlan";

test("ga4 revenue ops plan keeps W2 / G-W canonical structure", () => {
  const plan = getGa4RevenueOpsPlan();

  assert.equal(plan.canonical.canonicalContainerId, "GTM-W2Z6PHN");
  assert.equal(plan.canonical.canonicalPropertyId, "304759974");
  assert.equal(plan.canonical.canonicalMeasurementId, "G-WJFXN5E2Q1");
  assert.equal(plan.canonical.supportContainerId, "GTM-W7VXS4D8");
  assert.equal(plan.canonical.legacyMeasurementId, "G-8GZ48B1S59");
});

test("ga4 revenue ops plan fixes general purchase, npay, and virtual account roles", () => {
  const plan = getGa4RevenueOpsPlan();
  const summary = plan.tenSecondSummary.join(" ");
  const latest = plan.latestStatus.map((item) => item.detail).join(" ");

  assert.match(plan.latestStatus.map((item) => `${item.label} ${item.detail}`).join(" "), /일반 구매 canonical sender는 HURDLERS \[이벤트전송\] 구매/);
  assert.match(summary, /가상계좌는 신청완료 purchase 유지 \+ 미입금\/취소 보정/);
  assert.match(latest, /transaction_id \/ value \/ currency \/ shipping/);
  assert.match(plan.revenueIntegrityCheck.splitPolicy.join(" "), /virtual_account/);
});

test("ga4 revenue ops plan documents historical limits and MP 72h rule", () => {
  const plan = getGa4RevenueOpsPlan();

  assert.match(plan.historicalBackfill.ga4Ui.join(" "), /GA4 UI/);
  assert.match(plan.historicalBackfill.measurementProtocol.join(" "), /72시간/);
  assert.match(plan.historicalBackfill.sources.join(" "), /sending-events/);
  assert.match(plan.historicalBackfill.sources.join(" "), /reference/);
});

test("ga4 revenue ops plan separates refund from virtual-account non-deposit", () => {
  const plan = getGa4RevenueOpsPlan();

  assert.match(plan.refundCancelDesign.refundWhen.join(" "), /실제로 결제가 완료된 transaction/);
  assert.match(plan.refundCancelDesign.nonDepositDecision.join(" "), /미입금만료는 BI\/DB의 cancel 보정/);
  assert.match(plan.refundCancelDesign.reconciliationImpact.join(" "), /refund ledger/);
});

test("ga4 revenue ops plan captures live html migration blockers", () => {
  const plan = getGa4RevenueOpsPlan();

  assert.match(plan.latestStatus.map((item) => item.detail).join(" "), /GTM-W7VXS4D8/);
  assert.match(plan.imwebMigration.liveHtmlToday.join(" "), /rebuyz_utm/);
  assert.match(plan.imwebMigration.liveHtmlToday.join(" "), /rebuyz_view/);
  assert.match(plan.imwebMigration.versionConflict.join(" "), /direct G-8/);
  assert.match(plan.imwebMigration.migrateFooterLogic.join(" "), /dataLayer/);
});

test("ga4 revenue ops plan asks only minimal materials and rollout order", () => {
  const plan = getGa4RevenueOpsPlan();

  assert.match(plan.materials.required.join(" "), /live Imweb code version 확정 자료/);
  assert.match(plan.materials.required.join(" "), /payment_complete_time/);
  assert.match(plan.materials.reference.join(" "), /purchase DebugView expanded payload/);
  assert.deepEqual(
    plan.rollout.map((item) => item.day),
    ["Day 0", "Day 1", "Day 3"],
  );
});
