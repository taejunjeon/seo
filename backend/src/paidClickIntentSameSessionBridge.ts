/**
 * R2 order_bridge_ledger row 에 click_id_hash 가 없을 때, 같은 ga_session_id /
 * client_id / local_session_id 를 가진 paid_click_intent_ledger row 에서 click evidence 를
 * 보강할 수 있는지 검토하는 helper.
 *
 * 금지:
 *   - raw click_id_value 출력
 *   - time-window-only 단독으로 매칭 인정
 *   - session match 만으로 budget_usable=true 승급
 *
 * 사용처:
 *   ConfirmedPurchasePrep ledger lookup enricher 의 옵션 입력. R2 row 의 click 부재 시
 *   paid_click_intent_ledger 에서 same-session bridge 후보를 가져와 transient HMAC 후
 *   click_view exact lookup 으로 forwarding.
 */

export type PaidClickIntentCandidate = {
  intent_id: string;
  /** raw click_id_value (transient input only — helper output 에 echo 0) */
  rawClickIdValue: string;
  click_id_type: "gclid" | "gbraid" | "wbraid" | "ttclid" | "nclick_id" | "unknown";
  ga_session_id: string;
  client_id: string;
  local_session_id: string;
  captured_at_iso: string;
};

export type LedgerSessionKey = {
  /** raw ga_session_id (R2 row 의 ga_session_id 컬럼) */
  ga_session_id?: string | null;
  /** raw client_id (R2 row 의 client_id 컬럼) */
  client_id?: string | null;
  /** R2 row 의 local_session_id_hash (이미 hash) — paid_intent local_session_id raw 와 비교 시에는 다른 키 */
  local_session_id_hash?: string | null;
};

export type SameSessionBridgeMatchStrength =
  | "same_session_exact"
  | "weak_session"
  | "none";

export type SameSessionBridgeRow = {
  r2_row_hash: string;
  paid_intent_session_match: boolean;
  paid_intent_click_hash_present: boolean;
  click_id_type: "gclid" | "gbraid" | "wbraid" | "ttclid" | "nclick_id" | "unknown" | null;
  match_strength: SameSessionBridgeMatchStrength;
  budget_usable_candidate: false;
  blocked_reason: string | null;
};

export type SameSessionBridgeResult = {
  total_candidates_scanned: number;
  bridged_rows: number;
  rows: SameSessionBridgeRow[];
  warnings: string[];
};

export type SameSessionBridgeInput = {
  ledger_rows: ReadonlyArray<{
    r2_row_hash: string;
    sessionKey: LedgerSessionKey;
    payment_complete_match?: boolean; // 운영DB 결과 — false 일 때 unpaid_hold 로 분류
  }>;
  /** caller 가 paid_click_intent_ledger 에서 read-only fetch 한 후보 */
  paidIntentCandidates: ReadonlyArray<PaidClickIntentCandidate>;
};

const SAME_SESSION_RAW_MATCH = (
  ledgerKey: LedgerSessionKey,
  candidate: PaidClickIntentCandidate,
): boolean => {
  if (ledgerKey.ga_session_id && candidate.ga_session_id && ledgerKey.ga_session_id === candidate.ga_session_id) {
    return true;
  }
  if (ledgerKey.client_id && candidate.client_id && ledgerKey.client_id === candidate.client_id) {
    return true;
  }
  return false;
};

export const evaluatePaidClickIntentSameSessionBridge = (
  input: SameSessionBridgeInput,
): SameSessionBridgeResult => {
  const rows: SameSessionBridgeRow[] = [];
  let bridgedRows = 0;

  for (const ledger of input.ledger_rows) {
    if (!ledger.sessionKey.ga_session_id && !ledger.sessionKey.client_id) {
      rows.push({
        r2_row_hash: ledger.r2_row_hash,
        paid_intent_session_match: false,
        paid_intent_click_hash_present: false,
        click_id_type: null,
        match_strength: "none",
        budget_usable_candidate: false,
        blocked_reason: "ledger_session_key_missing",
      });
      continue;
    }

    let matchedCandidate: PaidClickIntentCandidate | null = null;
    for (const candidate of input.paidIntentCandidates) {
      if (SAME_SESSION_RAW_MATCH(ledger.sessionKey, candidate)) {
        if (candidate.rawClickIdValue && candidate.rawClickIdValue.trim().length > 0) {
          matchedCandidate = candidate;
          break;
        }
      }
    }

    if (!matchedCandidate) {
      rows.push({
        r2_row_hash: ledger.r2_row_hash,
        paid_intent_session_match: false,
        paid_intent_click_hash_present: false,
        click_id_type: null,
        match_strength: "none",
        budget_usable_candidate: false,
        blocked_reason: "no_same_session_paid_intent_match",
      });
      continue;
    }

    bridgedRows += 1;
    const blocked = ledger.payment_complete_match === false
      ? "unpaid_or_pending_payment_complete"
      : null;
    rows.push({
      r2_row_hash: ledger.r2_row_hash,
      paid_intent_session_match: true,
      paid_intent_click_hash_present: true,
      click_id_type:
        matchedCandidate.click_id_type === "unknown" ? null : matchedCandidate.click_id_type,
      match_strength: "same_session_exact",
      budget_usable_candidate: false,
      blocked_reason: blocked,
    });
  }

  return {
    total_candidates_scanned: input.paidIntentCandidates.length,
    bridged_rows: bridgedRows,
    rows,
    warnings:
      input.paidIntentCandidates.length === 0
        ? ["paidIntentCandidates empty — caller 가 paid_click_intent_ledger 후보를 inject 하지 않음"]
        : [],
  };
};
