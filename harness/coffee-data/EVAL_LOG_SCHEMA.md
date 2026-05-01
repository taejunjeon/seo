# Coffee Data Eval Log Schema

작성 시각: 2026-05-01 15:23 KST  
상태: v0 기준판  
목적: 더클린커피 read-only, dry-run, guard, 승인안 결과를 같은 형식으로 기록한다  
관련 문서: [[harness/coffee-data/README|Coffee Data Harness]], [[harness/coffee-data/RULES|Coffee Rules]], [[harness/coffee-data/AUDITOR_CHECKLIST|Coffee Auditor Checklist]]

## 10초 요약

숫자만 남기면 나중에 다시 믿기 어렵다.

모든 결과는 `site`, `window`, `source`, `freshness`, `confidence`, `no-send/no-write`를 같이 남긴다.

## Run Log Schema

```yaml
run_id: "coffee-data-YYYYMMDD-HHmm"
created_at_kst: "2026-05-01 15:23 KST"
created_by: "Codex | Claude | ChatGPT | TJ"
site: "thecleancoffee"
phase: "source_inventory | ga4_order_matching | npay_order_split | excel_dry_run | roas_read_only | approval_draft"
mode: "read_only | dry_run | approval_draft"
window_kst:
  start: "YYYY-MM-DD 00:00 KST"
  end: "YYYY-MM-DD 23:59 KST"
sources:
  primary:
    name: "GA4 BigQuery analytics_326949178"
    freshness_at_kst: "YYYY-MM-DD HH:mm KST"
    confidence: 0.9
  cross_checks:
    - name: "Imweb v2 API type=npay"
      freshness_at_kst: "YYYY-MM-DD HH:mm KST"
      confidence: 0.85
guardrails:
  no_send_verified: true
  no_write_verified: true
  no_deploy_verified: true
  approval_required: false
outputs:
  markdown_report: "data/coffee-example-YYYYMMDD.md"
  json_report: null
  changed_files: []
summary:
  imweb_orders: 0
  imweb_npay_actual: 0
  ga4_purchases: 0
  ga4_npay_pattern: 0
  one_to_one_assigned: 0
  unassigned_actual: 0
  unassigned_ga4: 0
auditor:
  verdict: "PASS | PASS_WITH_NOTES | FAIL_BLOCKED | NEEDS_HUMAN_APPROVAL"
  notes: []
confidence: 0.0
```

## NPay Matching Row Schema

```yaml
site: "thecleancoffee"
order_number: "202604268287926"
channel_order_no: "2026042699576540"
payment_method: "NAVERPAY_ORDER"
payment_status: "PAYMENT_COMPLETE"
paid_at_kst: "2026-04-26 09:23:45 KST"
order_payment_amount: 39500
ga4_transaction_id: "NPAY - 202603126 - 1777163000478"
ga4_event_time_kst: "2026-04-26 09:25:00 KST"
ga4_revenue: 36500
score: 73
time_gap_minutes: 1.3
time_gap_bucket: "within_2m"
amount_match_type: "shipping_reconciled"
match_grade: "A_strong | B_strong | probable | ambiguous"
assignment_status: "assigned | unassigned_actual | unassigned_ga4"
assignment_diagnosis: "best_candidate_score_below_assignment_threshold | best_ga4_candidate_already_assigned_to_stronger_order | no_actual_candidate_above_threshold"
bigquery_guard:
  lookup_ids:
    - "202604268287926"
    - "2026042699576540"
  already_in_ga4: "present | robust_absent | unknown"
dispatch:
  send_candidate: false
  block_reason: "read_only_phase"
```

## Excel Dry-run Row Schema

```yaml
site: "thecleancoffee"
year: 2025
order_number: "ORDER_NO"
payment_row_status: "matched | missing_payment | duplicate_payment | amount_mismatch"
order_amount: 0
payment_amount: 0
amount_delta: 0
payment_method: "card | npay | bank | unknown"
customer_keys:
  phone_hash_present: true
  email_present: true
privacy:
  raw_phone_exported: false
  raw_email_exported: false
import:
  mode: "dry_run"
  apply_allowed: false
```

## ROAS Read-only Schema

```yaml
site: "thecleancoffee"
window_kst:
  start: "YYYY-MM-DD"
  end: "YYYY-MM-DD"
spend_sources:
  meta:
    status: "fresh | token_expired | blocked"
    spend: 0
  tiktok:
    status: "fresh | token_expired | blocked"
    spend: 0
revenue_sources:
  ga4_purchase_revenue: 0
  imweb_actual_revenue: 0
  npay_actual_revenue: 0
classification:
  roas_source: "ga4 | actual_order | both"
  confidence: 0.0
guardrails:
  no_platform_send: true
```

## File Naming

| 결과물 | 파일명 규칙 |
|---|---|
| GA4 baseline | `data/coffee-ga4-baseline-YYYYMMDD.md` |
| Imweb/GA4 read-only | `data/coffee-imweb-operational-readonly-YYYYMMDD.md` |
| robust guard | `data/coffee-npay-unassigned-ga4-guard-YYYYMMDD.md` |
| Excel dry-run | `data/coffee-excel-import-dry-run-YYYYMMDD.md` |
| ROAS read-only | `data/coffee-roas-readonly-YYYYMMDD.md` |
| approval draft | `data/coffee-approval-YYYYMMDD.md` |

## 품질 기준

좋은 eval log는 아래를 만족한다.

1. 같은 window로 재실행할 수 있다.
2. 어떤 source가 primary인지 알 수 있다.
3. stale source가 primary로 쓰이지 않았다.
4. 어떤 row가 왜 막혔는지 알 수 있다.
5. 실제 전송과 DB write가 0건임을 확인할 수 있다.
