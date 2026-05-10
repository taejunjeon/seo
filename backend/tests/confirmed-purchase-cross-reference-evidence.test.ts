import assert from "node:assert/strict";
import test from "node:test";

import { classifyCrossReferenceEvidence } from "../src/confirmedPurchaseCrossReferenceEvidence";

test("cross_reference_evidence: homepage confirmed with gclid present is A_click_present_campaign_matched", () => {
  const evidence = classifyCrossReferenceEvidence({
    click_identifiers: { gclid: "Cj0KCQjw_GCLID_HOMEPAGE" },
    payment_method: "homepage",
    utm_campaign: "google_brand",
    path_b_bridge_present: false,
    confirmed_paid_purchase: true,
  });
  assert.equal(evidence.category, "A_click_present_campaign_matched");
  assert.equal(evidence.budget_usable, true);
  assert.equal(evidence.click_id_type, "gclid");
  assert.equal(evidence.send_candidate, false);
  assert.equal(evidence.actual_send_candidate, false);
});

test("cross_reference_evidence: homepage confirmed without click and without utm is F_homepage_no_click_no_utm", () => {
  const evidence = classifyCrossReferenceEvidence({
    click_identifiers: { gclid: "", gbraid: "", wbraid: "" },
    payment_method: "homepage",
    utm_campaign: "",
    path_b_bridge_present: false,
    confirmed_paid_purchase: true,
  });
  assert.equal(evidence.category, "F_homepage_no_click_no_utm");
  assert.equal(evidence.budget_usable, false);
  assert.equal(evidence.click_id_type, "none");
  assert.equal(evidence.blocker_reason, "homepage_confirmed_no_click_no_utm");
});

test("cross_reference_evidence: npay confirmed without click but with utm is C_npay_no_click_with_utm", () => {
  const evidence = classifyCrossReferenceEvidence({
    click_identifiers: {},
    payment_method: "npay",
    utm_campaign: "naverbrandsearch_biocom_MO_mainhome",
    path_b_bridge_present: false,
    confirmed_paid_purchase: true,
  });
  assert.equal(evidence.category, "C_npay_no_click_with_utm");
  assert.equal(evidence.budget_usable, false);
  assert.equal(evidence.click_id_type, "none");
  assert.equal(evidence.blocker_reason, "npay_confirmed_no_click_utm_only");
});

test("cross_reference_evidence: vbank unpaid with path_b bridge but payment not confirmed is G_path_b_bridge_present_payment_not_confirmed", () => {
  const evidence = classifyCrossReferenceEvidence({
    click_identifiers: {},
    payment_method: "vbank",
    utm_campaign: "",
    path_b_bridge_present: true,
    confirmed_paid_purchase: false,
  });
  assert.equal(evidence.category, "G_path_b_bridge_present_payment_not_confirmed");
  assert.equal(evidence.budget_usable, false);
  assert.equal(evidence.send_candidate, false);
  assert.equal(evidence.actual_send_candidate, false);
});

test("cross_reference_evidence: ledger lookup hit promotes to A_via_ledger when body click_id is empty", () => {
  const evidence = classifyCrossReferenceEvidence({
    click_identifiers: {},
    payment_method: "homepage",
    utm_campaign: "",
    path_b_bridge_present: false,
    confirmed_paid_purchase: true,
    ledger_lookup: {
      paid_click_intent_same_order_match: true,
      matched_click_id_type: "gclid",
      matched_hash_prefix: "ab12cd34",
    },
  });
  assert.equal(evidence.category, "A_via_ledger");
  assert.equal(evidence.budget_usable, true);
  assert.equal(evidence.source, "ledger_match");
  assert.equal(evidence.click_id_type, "gclid");
  assert.equal(evidence.hash_prefix, "ab12cd34");
});
