import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluatePaidClickIntentSameSessionBridge,
  type PaidClickIntentCandidate,
} from "../src/paidClickIntentSameSessionBridge";

const baseCandidate = (overrides: Partial<PaidClickIntentCandidate> = {}): PaidClickIntentCandidate => ({
  intent_id: "fixture-intent-1",
  rawClickIdValue: "Cj0KCQ_FIX_GCLID_X",
  click_id_type: "gclid",
  ga_session_id: "111111",
  client_id: "999.888",
  local_session_id: "",
  captured_at_iso: "2026-05-11T01:30:00.000Z",
  ...overrides,
});

test("paid_intent same-session bridge: same ga_session_id + click present → bridge_click_hash", () => {
  const result = evaluatePaidClickIntentSameSessionBridge({
    ledger_rows: [{
      r2_row_hash: "abcdef12",
      sessionKey: { ga_session_id: "111111", client_id: "999.888" },
      payment_complete_match: true,
    }],
    paidIntentCandidates: [baseCandidate()],
  });
  assert.equal(result.bridged_rows, 1);
  assert.equal(result.rows[0].paid_intent_session_match, true);
  assert.equal(result.rows[0].paid_intent_click_hash_present, true);
  assert.equal(result.rows[0].match_strength, "same_session_exact");
  assert.equal(result.rows[0].budget_usable_candidate, false); // helper 단독으로는 false
  assert.equal(result.rows[0].click_id_type, "gclid");
});

test("paid_intent same-session bridge: no session match, time only → blocked_time_window_only equivalent", () => {
  const result = evaluatePaidClickIntentSameSessionBridge({
    ledger_rows: [{
      r2_row_hash: "abcdef12",
      sessionKey: { ga_session_id: "DIFFERENT_SESSION", client_id: "DIFFERENT_CLIENT" },
      payment_complete_match: true,
    }],
    paidIntentCandidates: [baseCandidate()],
  });
  assert.equal(result.bridged_rows, 0);
  assert.equal(result.rows[0].match_strength, "none");
  assert.equal(result.rows[0].blocked_reason, "no_same_session_paid_intent_match");
});

test("paid_intent same-session bridge: session match but payment not complete → unpaid_hold", () => {
  const result = evaluatePaidClickIntentSameSessionBridge({
    ledger_rows: [{
      r2_row_hash: "abcdef12",
      sessionKey: { ga_session_id: "111111", client_id: "999.888" },
      payment_complete_match: false,
    }],
    paidIntentCandidates: [baseCandidate()],
  });
  assert.equal(result.bridged_rows, 1);
  assert.equal(result.rows[0].match_strength, "same_session_exact");
  assert.equal(result.rows[0].blocked_reason, "unpaid_or_pending_payment_complete");
});

test("paid_intent same-session bridge: raw click_id_value never appears in output", () => {
  const rawGclid = "Cj0KCQ_DO_NOT_LEAK_THIS_GCLID";
  const result = evaluatePaidClickIntentSameSessionBridge({
    ledger_rows: [{
      r2_row_hash: "abcdef12",
      sessionKey: { ga_session_id: "111111", client_id: "999.888" },
      payment_complete_match: true,
    }],
    paidIntentCandidates: [baseCandidate({ rawClickIdValue: rawGclid })],
  });
  const serialized = JSON.stringify(result);
  assert.ok(!serialized.includes(rawGclid), "raw click_id_value must not appear");
  assert.equal(result.rows[0].paid_intent_click_hash_present, true);
});
