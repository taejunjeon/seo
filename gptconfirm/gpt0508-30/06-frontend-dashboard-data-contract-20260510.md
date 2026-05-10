
# Frontend F0 data contract - 2026-05-10

작성 시각: 2026-05-10 19:34:00 KST
Lane: Green data contract / frontend implementation HOLD

## 결론
프론트엔드는 아직 구현하지 않고, Claude Code 구현 전에 F0 데이터 계약부터 고정한다. 화면은 Google Ads 플랫폼 주장값과 내부 confirmed 기준값을 분리해 보여주는 Data Trust Dashboard다.

## 담당 원칙
- Codex: backend/data contract, source freshness, no-send guard 검증.
- Claude Code: frontend implementation.
- frontend 구현 착수는 아직 HOLD.

## F0 payload 초안
```json
{
  "window": "last_7d | last_30d",
  "source_timestamp_kst": "...",
  "freshness": "fresh | stale | partial",
  "confidence": 0.0,
  "platform_roas_reference": {
    "label": "Google Ads ROAS=광고 플랫폼이 주장하는 값",
    "roas": 0,
    "conv_value": 0,
    "primary_npay_share": 0,
    "use_for_budget": false
  },
  "internal_confirmed_roas": {
    "label": "내부 confirmed ROAS=실제 결제완료 주문 원장 기준값",
    "roas": 0,
    "confirmed_revenue": 0,
    "candidate_count": 0,
    "use_for_budget": true
  },
  "confirmed_purchase_guard": {
    "send_candidate": false,
    "actual_send_candidate": false,
    "upload_candidate_count": 0,
    "block_reason_counts": {}
  },
  "npay_warning": {
    "click_count_is_purchase": false,
    "actual_confirmed_source": "operational_db_PAYMENT_COMPLETE_or_admin_confirmed"
  },
  "campaign_join_coverage": {
    "confirmed_orders": 2152,
    "campaign_id_matched_count": 31,
    "ambiguous_count": 0,
    "budget_decision_ready": false
  },
  "bigquery_coverage_warning": {
    "trend_7_14_30_ready": false,
    "actual_suffixes": [
      "20260507",
      "20260508",
      "20260509"
    ],
    "next_source": "archive+daily union"
  },
  "next_safe_action": "VM dashboard route local_first deploy approval or archive+daily BigQuery union dry-run"
}
```

## F0 UI 카드
1. Google Ads ROAS=참고만 볼 플랫폼 주장값.
2. 내부 confirmed ROAS=예산 판단 후보값.
3. NPay click/count warning.
4. campaign_id join coverage.
5. BigQuery coverage warning.
6. upload/send guard: 현재 0.

## 시작 조건
- VM dashboard `last_30d` route가 200으로 안정화되거나, frontend가 로컬/generated JSON fallback을 명시한다.
- ConfirmedPurchasePrep repeatable input이 매일 같은 shape로 나온다.
- BigQuery trend coverage warning 또는 archive+daily union 결과가 payload에 들어간다.
