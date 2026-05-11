import assert from "node:assert/strict";
import test from "node:test";

import { classifyCrossReferenceEvidence } from "../src/confirmedPurchaseCrossReferenceEvidence";

test("integration: ledger paid + click_view_exact + campaign_id → A_via_ledger_budget_floor", () => {
  const result = classifyCrossReferenceEvidence({
    click_identifiers: {},
    payment_method: "homepage",
    utm_campaign: "",
    path_b_bridge_present: false,
    confirmed_paid_purchase: true,
    ledger_lookup: {
      ledger_row_present: true,
      payment_complete_match: true,
      payment_status: "PAYMENT_COMPLETE",
      click_view_exact_match: true,
      campaign_id: "22018174474",
      matched_click_id_type: "gclid",
      matched_hash_prefix: "ab12cd34",
      sync_lag_status: "fresh",
    },
  });
  assert.equal(result.category, "A_via_ledger_budget_floor");
  assert.equal(result.budget_usable, true);
  assert.equal(result.send_candidate, false);
  assert.equal(result.actual_send_candidate, false);
});

test("integration: ledger paid + click_hash present but click_view not found → paid_order_click_unknown_campaign", () => {
  const result = classifyCrossReferenceEvidence({
    click_identifiers: {},
    payment_method: "homepage",
    utm_campaign: "",
    path_b_bridge_present: false,
    confirmed_paid_purchase: true,
    ledger_lookup: {
      ledger_row_present: true,
      payment_complete_match: true,
      payment_status: "PAYMENT_COMPLETE",
      click_view_exact_match: true,
      campaign_id: null,
      matched_click_id_type: "gclid",
      matched_hash_prefix: "ab12cd34",
    },
  });
  assert.equal(result.category, "paid_order_click_unknown_campaign");
  assert.equal(result.budget_usable, false);
  assert.equal(result.blocker_reason, "click_view_matched_but_campaign_id_absent");
});

test("integration: ledger paid + no click_view exact → paid_order_no_click_hold", () => {
  const result = classifyCrossReferenceEvidence({
    click_identifiers: {},
    payment_method: "homepage",
    utm_campaign: "",
    path_b_bridge_present: false,
    confirmed_paid_purchase: true,
    ledger_lookup: {
      ledger_row_present: true,
      payment_complete_match: true,
      payment_status: "PAYMENT_COMPLETE",
      click_view_exact_match: false,
      campaign_id: null,
    },
  });
  assert.equal(result.category, "paid_order_no_click_hold");
  assert.equal(result.budget_usable, false);
  assert.equal(result.blocker_reason, "paid_but_no_click_view_exact");
});

test("integration: ledger unpaid (REFUND_COMPLETE) → unpaid_order_bridge_hold", () => {
  const result = classifyCrossReferenceEvidence({
    click_identifiers: {},
    payment_method: "homepage",
    utm_campaign: "",
    path_b_bridge_present: false,
    confirmed_paid_purchase: true,
    ledger_lookup: {
      ledger_row_present: true,
      payment_complete_match: false,
      payment_status: "REFUND_COMPLETE",
      click_view_exact_match: true,
      campaign_id: "X",
    },
  });
  assert.equal(result.category, "unpaid_order_bridge_hold");
  assert.equal(result.budget_usable, false);
  assert.equal(result.blocker_reason, "unpaid_status_REFUND_COMPLETE");
});

test("integration: ledger sync lag pending (no payment join) → pending_sync_lag_hold", () => {
  const result = classifyCrossReferenceEvidence({
    click_identifiers: {},
    payment_method: "homepage",
    utm_campaign: "",
    path_b_bridge_present: false,
    confirmed_paid_purchase: true,
    ledger_lookup: {
      ledger_row_present: true,
      payment_complete_match: false,
      payment_status: null,
      click_view_exact_match: false,
      campaign_id: null,
      sync_lag_status: "lagged",
    },
  });
  assert.equal(result.category, "pending_sync_lag_hold");
  assert.equal(result.budget_usable, false);
  assert.equal(result.blocker_reason, "pending_sync_lag_lagged");
});

test("integration: raw fields never output (response serialization scan)", () => {
  const result = classifyCrossReferenceEvidence({
    click_identifiers: {},
    payment_method: "homepage",
    utm_campaign: "",
    path_b_bridge_present: false,
    confirmed_paid_purchase: true,
    ledger_lookup: {
      ledger_row_present: true,
      payment_complete_match: true,
      payment_status: "PAYMENT_COMPLETE",
      click_view_exact_match: true,
      campaign_id: "22018174474",
      matched_click_id_type: "gclid",
      matched_hash_prefix: "ab12cd34",
    },
  });
  const serialized = JSON.stringify(result);
  // raw email/phone/order pattern 없음
  assert.ok(!/@/.test(serialized), "no email pattern");
  assert.ok(!/01[0-9]-[0-9]{3,4}-[0-9]{4}/.test(serialized), "no korean phone pattern");
  assert.equal(result.send_candidate, false);
  assert.equal(result.actual_send_candidate, false);
});
