# NPay Recovery Eval Log Schema

작성 시각: 2026-05-01 00:20 KST  
상태: v0 기준판  
목적: dry-run, 승인안, 제한 전송, 검증 결과를 같은 형식으로 기록한다  
관련 문서: [[harness/npay-recovery/README|NPay Recovery Harness]], [[harness/npay-recovery/TASK|Task Spec]], [[harness/npay-recovery/RULES|Rules]], [[harness/npay-recovery/VERIFY|Verify]]

## 10초 요약

이 스키마는 "이번에 무엇을 언제 어떤 기준으로 봤는가"를 남기는 형식이다.

숫자만 저장하면 나중에 믿을 수 없다. 반드시 source, window, freshness, site, confidence, no-send 여부를 같이 남긴다.

## Run Log Schema

```yaml
run_id: "npay-eval-YYYYMMDD-HHmm"
created_at_kst: "2026-05-01 00:20 KST"
created_by: "Codex | Claude | ChatGPT | TJ"
phase: "read_only | dispatcher_dry_run | approval_draft | limited_send | post_send_verification | seven_day_recalibration"
site: "biocom | thecleancoffee | aibio"
mode: "read_only | dry_run | approved_send"
window_kst:
  start: "YYYY-MM-DD HH:mm KST"
  end: "YYYY-MM-DD HH:mm KST"
sources:
  primary:
    name: "VM SQLite npay_intent_log"
    freshness_at_kst: "YYYY-MM-DD HH:mm KST"
    confidence: 0.9
  cross_checks:
    - name: "operational_postgres.public.tb_iamweb_users"
      freshness_at_kst: "YYYY-MM-DD HH:mm KST"
      confidence: 0.85
guardrails:
  no_send_verified: true
  no_db_write_verified: true
  no_deploy_verified: true
  approval_required: false
  approval_document: null
outputs:
  markdown_report: "naver/example.md"
  json_report: null
  changed_files: []
summary:
  live_intent_count: 0
  confirmed_npay_order_count: 0
  strong_match: 0
  strong_match_a: 0
  strong_match_b: 0
  ambiguous: 0
  purchase_without_intent: 0
  clicked_no_purchase: 0
  dispatcher_candidate: 0
auditor:
  verdict: "PASS | PASS_WITH_NOTES | FAIL_BLOCKED | NEEDS_HUMAN_APPROVAL"
  notes: []
confidence: 0.0
```

## Candidate Row Schema

```yaml
order_number: "202604302383065"
channel_order_no: "2026043043205620"
site: "biocom"
order_label: "production_order | manual_test_order"
payment_status: "PAYMENT_COMPLETE"
payment_method: "NAVERPAY_ORDER"
paid_at_kst: "2026-04-30 16:01:14 KST"
matched_intent_id: "uuid"
intent_captured_at_kst: "2026-04-30 15:59:50 KST"
score: 80
score_gap: 20
time_gap_minutes: 1.4
amount:
  intent_product_price: 8900
  order_item_total: 8900
  delivery_price: 3000
  discount_amount: 0
  order_payment_amount: 11900
  amount_delta: 0
  amount_match_type: "shipping_reconciled"
identity:
  client_id_present: true
  ga_session_id_present: true
  fbp_present: true
  fbc_present: false
  ttclid_present: false
  ttp_present: false
bigquery_guard:
  lookup_ids:
    - "202604302383065"
    - "2026043043205620"
  already_in_ga4: "robust_absent | present | unknown | preliminary_absent"
  checked_at_kst: "2026-04-30 20:36 KST"
  query_scope: "ecommerce.transaction_id + event_params.transaction_id + full event_params values + intraday"
classification:
  match_status: "strong_match | ambiguous | purchase_without_intent"
  strong_grade: "A | B | null"
  ambiguous_reasons: []
dispatch_preview:
  send_candidate: false
  block_reason: "read_only_phase"
  event_id: "NPayRecoveredPurchase_202604302383065"
  value: 11900
  currency: "KRW"
```

## Payload Preview Schema

GA4 MP 제한 테스트 승인안에 들어갈 preview다.

```yaml
platform: "GA4_MP"
event_name: "purchase"
event_id: "NPayRecoveredPurchase_202604302383065"
transaction_id: "202604302383065"
channel_order_no: "2026043043205620"
client_id: "123456789.1234567890"
ga_session_id: "1777532376"
timestamp_micros_source: "order_paid_at"
value: 11900
currency: "KRW"
items:
  - item_name: "상품명"
    item_id: "product_idx"
    price: 8900
    quantity: 1
extra_params:
  payment_method: "NAVERPAY_ORDER"
  recovery_source: "npay_recovery_dry_run"
  recovery_version: "v0"
send_candidate: true
block_reason: null
idempotency_key: "npay_recovery_ga4_purchase:biocom:202604302383065"
```

## Post-send Verification Schema

```yaml
verification_id: "npay-verify-YYYYMMDD-HHmm"
sent_event:
  platform: "GA4_MP"
  order_number: "202604302383065"
  event_id: "NPayRecoveredPurchase_202604302383065"
  sent_at_kst: "2026-04-30 21:23 KST"
bigquery_lookup:
  checked_at_kst: "2026-05-01 09:00 KST"
  table_suffix_range: "20260430-20260501"
  found: true
  found_event_name: "purchase"
  found_transaction_id: "202604302383065"
  duplicate_count: 1
result:
  already_in_ga4_after_send: "present"
  resend_allowed: false
  notes: []
```

## Coffee Read-only Eval Schema

더클린커피는 NPay 전송보다 먼저 GA4와 실제 주문 원장 정합성을 본다.

```yaml
run_id: "coffee-ga4-baseline-YYYYMMDD-HHmm"
site: "thecleancoffee"
phase: "read_only"
dataset: "project-dadba7dd-0229-4ff6-81c.analytics_326949178"
window_kst:
  start: "2026-04-24 00:00 KST"
  end: "2026-04-30 23:59 KST"
ga4_summary:
  purchase_events: 0
  distinct_transaction_ids: 0
  missing_transaction_id: 0
  purchase_revenue: 0
order_sources:
  operational_toss:
    status: "fresh | watch | stale | blocked"
  operational_playauto:
    status: "fresh | watch | stale | blocked"
  local_imweb:
    status: "stale"
classification:
  toss_candidate_count: 0
  npay_candidate_count: 0
  other_candidate_count: 0
  unknown_payment_method_count: 0
guardrails:
  no_send_verified: true
  no_db_write_verified: true
confidence: 0.0
```

## File Naming

| 결과물 | 파일명 규칙 |
|---|---|
| dry-run report | `naver/npay-roas-dry-run-YYYYMMDD.md` |
| approval draft | `naver/npay-ga4-mp-limited-test-approval-YYYYMMDD.md` |
| post-send result | `naver/npay-ga4-mp-limited-test-result-YYYYMMDD.md` |
| seven-day recalibration | `naver/npay-7d-rerun-YYYYMMDD.md` |
| coffee baseline | `data/coffee-ga4-baseline-YYYYMMDD.md` |

## 품질 기준

좋은 eval log는 아래를 만족한다.

1. 같은 window로 다시 실행할 수 있다.
2. 어떤 source가 stale인지 알 수 있다.
3. 어떤 후보가 왜 막혔는지 알 수 있다.
4. 실제 전송이 있었는지 30초 안에 알 수 있다.
5. TJ님이 다음 YES/NO 결정을 내릴 수 있다.
