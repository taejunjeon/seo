import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyLedgerRowToBudgetClassification,
  type LedgerRowSnapshot,
} from "../src/orderBridgeLedgerBudgetClassifier";

const baseSession: LedgerRowSnapshot = {
  status: "session_only_quarantine",
  email_hash_present: false,
  phone_hash_present: false,
  order_no_hash_present: true,
  click_id_hash_present: true,
  client_session_present: true,
};

test("budget classifier: paid + click exact + click_view match → A_via_ledger_budget_floor", () => {
  const result = classifyLedgerRowToBudgetClassification({
    ledger_row: baseSession,
    payment_complete_join: { matched: true, payment_status: "PAYMENT_COMPLETE" },
    click_view_exact: { matched: true, click_id_type: "gclid", campaign_id: "22018174474" },
  });
  assert.equal(result.classification, "A_via_ledger_budget_floor");
  assert.equal(result.budget_usable, true);
  assert.equal(result.send_candidate, false);
  assert.equal(result.actual_send_candidate, false);
  assert.equal(result.upload_candidate, false);
  assert.equal(result.campaign_id, "22018174474");
});

test("budget classifier: paid + no click exact → paid_order_no_click_hold", () => {
  const result = classifyLedgerRowToBudgetClassification({
    ledger_row: { ...baseSession, click_id_hash_present: false },
    payment_complete_join: { matched: true, payment_status: "PAYMENT_COMPLETE" },
    click_view_exact: { matched: false, click_id_type: null, campaign_id: null },
  });
  assert.equal(result.classification, "paid_order_no_click_hold");
  assert.equal(result.budget_usable, false);
});

test("budget classifier: REFUND_COMPLETE → unpaid_order_bridge_hold", () => {
  const result = classifyLedgerRowToBudgetClassification({
    ledger_row: baseSession,
    payment_complete_join: { matched: true, payment_status: "REFUND_COMPLETE" },
    click_view_exact: { matched: true, click_id_type: "gclid", campaign_id: "X" },
  });
  assert.equal(result.classification, "unpaid_order_bridge_hold");
  assert.equal(result.budget_usable, false);
});

test("budget classifier: VIRTUAL_ACCOUNT_PENDING → unpaid_order_bridge_hold", () => {
  const result = classifyLedgerRowToBudgetClassification({
    ledger_row: baseSession,
    payment_complete_join: { matched: true, payment_status: "VIRTUAL_ACCOUNT_PENDING" },
    click_view_exact: { matched: true, click_id_type: "gclid", campaign_id: "X" },
  });
  assert.equal(result.classification, "unpaid_order_bridge_hold");
  assert.equal(result.budget_usable, false);
});

test("budget classifier: session_only_quarantine + no payment join yet → session_only_quarantine_no_paid_evidence", () => {
  const result = classifyLedgerRowToBudgetClassification({
    ledger_row: baseSession,
    payment_complete_join: { matched: false },
    click_view_exact: { matched: true, click_id_type: "gclid", campaign_id: "X" },
  });
  assert.equal(result.classification, "session_only_quarantine_no_paid_evidence");
  assert.equal(result.budget_usable, false);
});

test("budget classifier: order_no_hash absent → do_not_classify", () => {
  const result = classifyLedgerRowToBudgetClassification({
    ledger_row: { ...baseSession, order_no_hash_present: false },
    payment_complete_join: { matched: true, payment_status: "PAYMENT_COMPLETE" },
    click_view_exact: { matched: true, click_id_type: "gclid", campaign_id: "X" },
  });
  assert.equal(result.classification, "do_not_classify");
  assert.equal(result.budget_usable, false);
});

test("budget classifier: invariants always false even on budget_usable=true", () => {
  const result = classifyLedgerRowToBudgetClassification({
    ledger_row: baseSession,
    payment_complete_join: { matched: true, payment_status: "PAYMENT_COMPLETE" },
    click_view_exact: { matched: true, click_id_type: "gclid", campaign_id: "X" },
  });
  assert.equal(result.send_candidate, false);
  assert.equal(result.actual_send_candidate, false);
  assert.equal(result.upload_candidate, false);
});
