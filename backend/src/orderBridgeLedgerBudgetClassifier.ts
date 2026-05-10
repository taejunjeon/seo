/**
 * order_bridge_ledger row 와 운영DB PAYMENT_COMPLETE / Google Ads click_view evidence 를
 * 결합해 budget_usable 분류로 승급한다.
 *
 * 본 helper 의 사용처:
 *   ConfirmedPurchasePrep cross_reference_evidence.ledger_lookup wire (다음 sprint)
 *   가 ledger row 와 함께 운영DB lookup 결과를 받아 호출.
 *
 * 금지:
 *   raw email/phone/order/payment/member_code 입력 또는 출력
 *   send_candidate / actual_send_candidate / upload_candidate true
 *   exact evidence 없는 row 의 budget_usable 승급
 *   time-window-only attribution 으로 budget_usable 승급
 */

import type { OrderBridgeLedgerStatus } from "./orderBridgeIdentityHmac";

export type LedgerRowSnapshot = {
  status: OrderBridgeLedgerStatus;
  email_hash_present: boolean;
  phone_hash_present: boolean;
  order_no_hash_present: boolean;
  click_id_hash_present: boolean;
  client_session_present: boolean;
};

export type PaymentCompleteJoinResult =
  | { matched: true; payment_status: "PAYMENT_COMPLETE" }
  | { matched: true; payment_status: "REFUND_COMPLETE" | "CANCELLED_BEFORE_DEPOSIT" | "PAYMENT_PREPARATION" | string }
  | { matched: false }
  | null;

export type ClickViewExactResult = {
  matched: boolean;
  click_id_type: "gclid" | "gbraid" | "wbraid" | null;
  campaign_id: string | null;
};

export type BudgetClassification =
  | "A_via_ledger_budget_floor"
  | "paid_order_click_exact"
  | "paid_order_no_click_hold"
  | "unpaid_order_bridge_hold"
  | "session_only_quarantine_no_paid_evidence"
  | "do_not_classify";

export type LedgerBudgetClassificationResult = {
  classification: BudgetClassification;
  budget_usable: boolean;
  send_candidate: false;
  actual_send_candidate: false;
  upload_candidate: false;
  reason: string;
  campaign_id: string | null;
  click_id_type: "gclid" | "gbraid" | "wbraid" | null;
};

const isPaidConfirmed = (paymentJoin: PaymentCompleteJoinResult): boolean => {
  if (!paymentJoin || !("matched" in paymentJoin) || !paymentJoin.matched) return false;
  return paymentJoin.payment_status === "PAYMENT_COMPLETE";
};

const isExplicitlyUnpaid = (paymentJoin: PaymentCompleteJoinResult): boolean => {
  if (!paymentJoin || !("matched" in paymentJoin) || !paymentJoin.matched) return false;
  const blockers: ReadonlyArray<string> = [
    "REFUND_COMPLETE",
    "CANCELLED_BEFORE_DEPOSIT",
    "PAYMENT_PREPARATION",
    "VIRTUAL_ACCOUNT_PENDING",
  ];
  return blockers.includes(paymentJoin.payment_status);
};

export const classifyLedgerRowToBudgetClassification = (input: {
  ledger_row: LedgerRowSnapshot;
  payment_complete_join: PaymentCompleteJoinResult;
  click_view_exact: ClickViewExactResult;
}): LedgerBudgetClassificationResult => {
  const { ledger_row, payment_complete_join, click_view_exact } = input;
  const baseInvariants = {
    send_candidate: false as const,
    actual_send_candidate: false as const,
    upload_candidate: false as const,
  };

  if (!ledger_row.order_no_hash_present) {
    return {
      classification: "do_not_classify",
      budget_usable: false,
      reason: "order_no_hash_missing",
      campaign_id: null,
      click_id_type: null,
      ...baseInvariants,
    };
  }

  if (isExplicitlyUnpaid(payment_complete_join)) {
    return {
      classification: "unpaid_order_bridge_hold",
      budget_usable: false,
      reason: "operational_db_status_blocks_actual_purchase",
      campaign_id: null,
      click_id_type: null,
      ...baseInvariants,
    };
  }

  if (!isPaidConfirmed(payment_complete_join)) {
    if (ledger_row.status === "session_only_quarantine") {
      return {
        classification: "session_only_quarantine_no_paid_evidence",
        budget_usable: false,
        reason: "no_payment_complete_join_yet",
        campaign_id: null,
        click_id_type: null,
        ...baseInvariants,
      };
    }
    return {
      classification: "do_not_classify",
      budget_usable: false,
      reason: "no_payment_complete_join_yet",
      campaign_id: null,
      click_id_type: null,
      ...baseInvariants,
    };
  }

  if (!click_view_exact.matched || !ledger_row.click_id_hash_present) {
    return {
      classification: "paid_order_no_click_hold",
      budget_usable: false,
      reason: "paid_but_no_exact_click_evidence",
      campaign_id: null,
      click_id_type: null,
      ...baseInvariants,
    };
  }

  return {
    classification: "A_via_ledger_budget_floor",
    budget_usable: true,
    reason: "paid_order_click_view_exact_matched",
    campaign_id: click_view_exact.campaign_id,
    click_id_type: click_view_exact.click_id_type,
    ...baseInvariants,
  };
};

/**
 * 별칭 — `paid_order_click_exact` 표현을 명시적으로 쓰고 싶은 호출자용.
 */
export const PAID_ORDER_CLICK_EXACT_CLASSIFICATION: BudgetClassification = "A_via_ledger_budget_floor";
