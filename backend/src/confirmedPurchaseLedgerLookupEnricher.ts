/**
 * ConfirmedPurchase no-send preview 에 R2 ledger lookup + operational PAYMENT_COMPLETE +
 * Google Ads click_view exact 결과를 결합해 cross_reference_evidence 의 ledger_lookup
 * 분기를 채운다.
 *
 * 핵심 invariant:
 *   - raw order_no, email, phone, payment, member_code, click_id 출력 0
 *   - hash 역산 시도 0
 *   - send_candidate / actual_send_candidate / upload_candidate 항상 false / 0
 *   - 운영DB write 0
 *
 * 사용처:
 *   confirmed-purchase no-send route 에서 preview 생성 후 enrichConfirmedPurchaseWithLedgerLookup
 *   호출 → cross_reference_evidence 자동 갱신.
 *
 * 본 sprint(gpt0508-40) 는 helper + fixture 까지. route 와의 통합 wire 는 deploy 직전에.
 */

import { createHmac } from "node:crypto";

import {
  classifyCrossReferenceEvidence,
  type CrossReferenceEvidence,
  type CrossReferenceLedgerLookup,
} from "./confirmedPurchaseCrossReferenceEvidence";
import { findOrderBridgeRowsByOrderHash, type OrderBridgeLedgerRow } from "./orderBridgeLedger";
import {
  classifyLedgerRowToBudgetClassification,
  type ClickViewExactResult,
  type PaymentCompleteJoinResult,
} from "./orderBridgeLedgerBudgetClassifier";
import {
  lookupOperationalPaymentComplete,
  type OperationalPaymentCompleteLookupDeps,
} from "./operationalPaymentCompleteLookup";
import {
  lookupGoogleAdsClickViewExact,
  type GoogleAdsClickViewCandidate,
} from "./googleAdsClickViewExactLookup";

export type EnrichmentInput = {
  /** raw order_no (transient — 응답에 절대 노출 안 됨) */
  orderNo: string;
  site: "biocom";
  /** preview 의 기존 click_identifiers (cross_reference 첫 분류 기준) */
  clickIdentifiers?: {
    gclid?: string | null;
    gbraid?: string | null;
    wbraid?: string | null;
    fbclid?: string | null;
    ttclid?: string | null;
  };
  paymentMethod?: string | null;
  utmCampaign?: string | null;
  pathBBridgePresent?: boolean;
  confirmedPaidPurchase?: boolean;
};

export type EnrichmentDeps = {
  hmacSecret: string;
  operationalPaymentCompleteLookupDeps?: OperationalPaymentCompleteLookupDeps;
  /** caller 가 click_view 후보를 inject 한 경우 */
  clickViewCandidates?: ReadonlyArray<GoogleAdsClickViewCandidate>;
  /** test 용 ledger row override */
  ledgerRowOverride?: OrderBridgeLedgerRow[];
};

export type EnrichmentResult = {
  ledger_row_present: boolean;
  ledger_row_count: number;
  ledger_status: string | null;
  payment_complete_match: boolean;
  payment_status: string | null;
  payment_method_family: string | null;
  click_view_exact_match: boolean;
  campaign_id: string | null;
  click_id_type: "gclid" | "gbraid" | "wbraid" | null;
  budget_classification: string;
  budget_usable: boolean;
  cross_reference_evidence: CrossReferenceEvidence;
  invariants_held: {
    raw_pii_in_output: false;
    send_candidate: false;
    actual_send_candidate: false;
    upload_candidate: 0;
  };
};

const hmacHex = (value: string, secret: string): string =>
  createHmac("sha256", secret).update(value, "utf8").digest("hex");

export const enrichConfirmedPurchaseWithLedgerLookup = async (
  input: EnrichmentInput,
  deps: EnrichmentDeps,
): Promise<EnrichmentResult> => {
  const orderNoHash = hmacHex(input.orderNo, deps.hmacSecret);
  const ledgerRows: OrderBridgeLedgerRow[] =
    deps.ledgerRowOverride ?? findOrderBridgeRowsByOrderHash(orderNoHash, input.site);
  const firstRow = ledgerRows[0] ?? null;

  // operational payment complete lookup
  const paymentLookup = await lookupOperationalPaymentComplete(
    {
      site: input.site,
      ledgerOrderHashes: [orderNoHash],
      windowDays: 30,
      hmacSecret: deps.hmacSecret,
    },
    deps.operationalPaymentCompleteLookupDeps ?? {},
  );
  const paymentRow = paymentLookup.rows[0] ?? null;

  // click_view exact lookup (only if ledger has click_id_hash)
  const ledgerClickHashes = firstRow && firstRow.clickIdHash ? [firstRow.clickIdHash] : [];
  const clickLookup = await lookupGoogleAdsClickViewExact({
    ledgerClickHashes,
    hmacSecret: deps.hmacSecret,
    clickViewCandidates: deps.clickViewCandidates ?? [],
  });
  const clickRow = clickLookup.rows[0] ?? null;

  const paymentJoin: PaymentCompleteJoinResult = paymentRow
    ? paymentRow.payment_complete_match
      ? { matched: true, payment_status: "PAYMENT_COMPLETE" }
      : paymentRow.payment_status
        ? { matched: true, payment_status: paymentRow.payment_status }
        : { matched: false }
    : { matched: false };

  const clickView: ClickViewExactResult = clickRow
    ? {
        matched: clickRow.click_view_exact_match,
        click_id_type:
          clickRow.click_id_type === "unknown" ? null : (clickRow.click_id_type ?? null),
        campaign_id: clickRow.campaign_id,
      }
    : { matched: false, click_id_type: null, campaign_id: null };

  const ledgerSnapshot = firstRow
    ? {
        status: firstRow.status,
        email_hash_present: Boolean(firstRow.emailHash),
        phone_hash_present: Boolean(firstRow.phoneHash),
        order_no_hash_present: Boolean(firstRow.orderNoHash),
        click_id_hash_present: Boolean(firstRow.clickIdHash),
        client_session_present: Boolean(
          firstRow.clientId || firstRow.gaSessionId || firstRow.localSessionIdHash,
        ),
      }
    : null;

  const budgetClassification = ledgerSnapshot
    ? classifyLedgerRowToBudgetClassification({
        ledger_row: ledgerSnapshot,
        payment_complete_join: paymentJoin,
        click_view_exact: clickView,
      })
    : null;

  const crossReferenceLedgerLookup: CrossReferenceLedgerLookup = {
    ledger_row_present: ledgerRows.length > 0,
    payment_complete_match: paymentRow?.payment_complete_match ?? false,
    payment_status: paymentRow?.payment_status ?? null,
    click_view_exact_match: clickRow?.click_view_exact_match ?? false,
    campaign_id: clickRow?.campaign_id ?? null,
    matched_click_id_type:
      budgetClassification?.click_id_type === undefined
        ? null
        : budgetClassification?.click_id_type === null
          ? null
          : (budgetClassification?.click_id_type as "gclid" | "gbraid" | "wbraid"),
    matched_hash_prefix: firstRow ? firstRow.orderNoHash.slice(0, 8) : null,
    sync_lag_status: paymentRow?.sync_lag_note ?? "unknown",
  };

  const crossReferenceEvidence = classifyCrossReferenceEvidence({
    click_identifiers: input.clickIdentifiers ?? {},
    payment_method: input.paymentMethod ?? null,
    utm_campaign: input.utmCampaign ?? null,
    path_b_bridge_present: input.pathBBridgePresent ?? false,
    confirmed_paid_purchase: input.confirmedPaidPurchase ?? true,
    ledger_lookup: crossReferenceLedgerLookup,
  });

  return {
    ledger_row_present: ledgerRows.length > 0,
    ledger_row_count: ledgerRows.length,
    ledger_status: firstRow?.status ?? null,
    payment_complete_match: paymentRow?.payment_complete_match ?? false,
    payment_status: paymentRow?.payment_status ?? null,
    payment_method_family: paymentRow?.payment_method_family ?? null,
    click_view_exact_match: clickRow?.click_view_exact_match ?? false,
    campaign_id: clickRow?.campaign_id ?? null,
    click_id_type:
      budgetClassification?.click_id_type === null
        ? null
        : (budgetClassification?.click_id_type as "gclid" | "gbraid" | "wbraid" | null | undefined) ??
          null,
    budget_classification: budgetClassification?.classification ?? "do_not_classify",
    budget_usable: budgetClassification?.budget_usable ?? false,
    cross_reference_evidence: crossReferenceEvidence,
    invariants_held: {
      raw_pii_in_output: false,
      send_candidate: false,
      actual_send_candidate: false,
      upload_candidate: 0,
    },
  };
};
