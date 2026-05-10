# ConfirmedPurchasePrep same-window builder input - 2026-05-10

## 결론
운영DB PAYMENT_COMPLETE를 primary confirmed source로 두고 VM Cloud Path B/NPay evidence를 보조로 붙이는 공식 no-send input을 생성했다. send_candidate=false, actual_send_candidate=false, upload_candidate=false를 유지한다.

## Summary

```json
{
  "integrated_candidate_count": 2152,
  "homepage_confirmed_count": 2009,
  "npay_actual_confirmed_count": 143,
  "payment_method_counts": {
    "homepage": 2009,
    "npay": 143
  },
  "with_google_click_id": 31,
  "vm_order_evidence_matched_count": 1686,
  "vm_prep_matched_count": 35,
  "path_b_same_order_count": 0,
  "send_candidate": 0,
  "actual_send_candidate": 0,
  "upload_candidate": 0,
  "block_reason_counts": {
    "already_in_ga4_unknown": 2152,
    "approval_required": 2152,
    "missing_google_click_id": 2121,
    "read_only_integrated_input": 2152,
    "read_only_phase": 2152,
    "send_candidate_forced_false": 2152,
    "missing_attribution_vm_evidence": 466,
    "npay_actual_confirmed_from_primary_source": 143,
    "npay_intent_purchase_without_intent": 76,
    "order_has_return_reason": 11,
    "npay_intent_ambiguous": 24,
    "npay_intent_not_a_grade_strong": 22
  },
  "controlled_path_b_reference": {
    "order_no": "",
    "verdict": "PASS_REAL_GOOGLE_AD_CLICK_TO_ORDER_COMPLETE_NO_SEND_BRIDGE__CONFIRMED_PAYMENT_HOLD",
    "click_id_hash_present": true,
    "email_hash_present": true,
    "order_no_hash_present": true,
    "client_session_present": true
  }
}
```

## Guard
- NPay actual confirmed는 운영DB PAYMENT_COMPLETE/admin confirmed source 기준으로 포함 후보가 될 수 있다.
- NPay click/count/add_payment_info only는 포함하지 않는다.
- complete_time blank 또는 imweb_status blank는 단독 차단 사유가 아니다.
- Google Ads upload 후보는 0이다.

## Google click id candidates
- count: 31
- revenue: 7,611,210 KRW
- campaign_id join은 아직 별도 후보표에서 HOLD/PASS를 판단한다.

## Source
- operational input: data/bi-confirmed-purchase-operational-dry-run-20260510-last30-full.tmp.json
- path b evidence: data/path-b-real-paid-click-actual-order-preview-result-20260510.json
- output json: data/confirmed-purchase-builder-same-window-input-20260510.json
