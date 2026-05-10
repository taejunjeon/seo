export type CrossReferenceClickIdentifiers = {
  gclid?: string | null;
  gbraid?: string | null;
  wbraid?: string | null;
  fbclid?: string | null;
  ttclid?: string | null;
};

export type CrossReferenceLedgerLookup = {
  paid_click_intent_same_order_match?: boolean;
  order_bridge_same_order_match?: boolean;
  matched_click_id_type?: "gclid" | "gbraid" | "wbraid" | null;
  matched_hash_prefix?: string | null;
};

export type CrossReferenceInput = {
  click_identifiers?: CrossReferenceClickIdentifiers | null;
  payment_method?: string | null;
  utm_campaign?: string | null;
  path_b_bridge_present?: boolean;
  confirmed_paid_purchase?: boolean;
  ledger_lookup?: CrossReferenceLedgerLookup | null;
};

export type CrossReferenceCategory =
  | "A_click_present_campaign_matched"
  | "A_via_ledger"
  | "B_click_present_click_view_not_found"
  | "C_npay_no_click_with_utm"
  | "D_npay_no_click_no_utm"
  | "E_homepage_no_click_with_utm"
  | "F_homepage_no_click_no_utm"
  | "G_path_b_bridge_present_payment_not_confirmed"
  | "H_unknown";

export type CrossReferenceEvidence = {
  category: CrossReferenceCategory;
  budget_usable: boolean;
  blocker_reason: string | null;
  source: "body_click_id" | "ledger_match" | "diagnostic_only";
  click_id_type: "gclid" | "gbraid" | "wbraid" | "none";
  hash_prefix: string | null;
  send_candidate: false;
  actual_send_candidate: false;
};

const truthyClickId = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

export const classifyCrossReferenceEvidence = (
  input: CrossReferenceInput,
): CrossReferenceEvidence => {
  const click = input.click_identifiers ?? {};
  const gclid = truthyClickId(click.gclid) ? click.gclid : null;
  const gbraid = truthyClickId(click.gbraid) ? click.gbraid : null;
  const wbraid = truthyClickId(click.wbraid) ? click.wbraid : null;
  const clickIdType: CrossReferenceEvidence["click_id_type"] = gclid
    ? "gclid"
    : gbraid
      ? "gbraid"
      : wbraid
        ? "wbraid"
        : "none";
  const clickPresent = clickIdType !== "none";
  const paymentMethod = (input.payment_method ?? "").toLowerCase();
  const utmCampaign = (input.utm_campaign ?? "").trim();
  const utmPresent = utmCampaign.length > 0;
  const pathBBridgePresent = Boolean(input.path_b_bridge_present);
  const confirmedPaidPurchase = input.confirmed_paid_purchase ?? true;
  const lookup = input.ledger_lookup ?? null;

  if (clickPresent) {
    return {
      category: "A_click_present_campaign_matched",
      budget_usable: true,
      blocker_reason: null,
      source: "body_click_id",
      click_id_type: clickIdType,
      hash_prefix: null,
      send_candidate: false,
      actual_send_candidate: false,
    };
  }

  if (lookup?.paid_click_intent_same_order_match || lookup?.order_bridge_same_order_match) {
    return {
      category: "A_via_ledger",
      budget_usable: true,
      blocker_reason: null,
      source: "ledger_match",
      click_id_type: lookup?.matched_click_id_type ?? "none",
      hash_prefix: lookup?.matched_hash_prefix ?? null,
      send_candidate: false,
      actual_send_candidate: false,
    };
  }

  if (pathBBridgePresent && confirmedPaidPurchase === false) {
    return {
      category: "G_path_b_bridge_present_payment_not_confirmed",
      budget_usable: false,
      blocker_reason: "path_b_bridge_present_payment_not_confirmed",
      source: "diagnostic_only",
      click_id_type: "none",
      hash_prefix: null,
      send_candidate: false,
      actual_send_candidate: false,
    };
  }

  if (paymentMethod === "npay") {
    return {
      category: utmPresent ? "C_npay_no_click_with_utm" : "D_npay_no_click_no_utm",
      budget_usable: false,
      blocker_reason: utmPresent
        ? "npay_confirmed_no_click_utm_only"
        : "npay_confirmed_no_click_no_utm",
      source: "diagnostic_only",
      click_id_type: "none",
      hash_prefix: null,
      send_candidate: false,
      actual_send_candidate: false,
    };
  }

  if (paymentMethod === "homepage" || paymentMethod === "card" || paymentMethod === "vbank") {
    return {
      category: utmPresent ? "E_homepage_no_click_with_utm" : "F_homepage_no_click_no_utm",
      budget_usable: false,
      blocker_reason: utmPresent
        ? "homepage_confirmed_no_click_utm_only"
        : "homepage_confirmed_no_click_no_utm",
      source: "diagnostic_only",
      click_id_type: "none",
      hash_prefix: null,
      send_candidate: false,
      actual_send_candidate: false,
    };
  }

  return {
    category: "H_unknown",
    budget_usable: false,
    blocker_reason: "unknown_payment_method_or_state",
    source: "diagnostic_only",
    click_id_type: "none",
    hash_prefix: null,
    send_candidate: false,
    actual_send_candidate: false,
  };
};
