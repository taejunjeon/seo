
# Frontend F0 data contract - 2026-05-10

작성 시각: 2026-05-10 20:22:00 KST
Lane: Green data contract / frontend implementation HOLD

## 결론
프론트엔드는 아직 구현하지 않고, Claude Code 구현 전에 F0 데이터 계약부터 고정한다. 화면은 Google Ads 플랫폼 주장값과 내부 confirmed 기준값을 분리해 보여주는 Data Trust Dashboard다.

VM dashboard route는 `GOOGLE_ADS_DASHBOARD_LEDGER_MODE=local_first` 제한 배포 후 `last_7d`, `last_30d` 모두 200으로 회복했다. BigQuery도 archive+daily union으로 7/14/30일이 실제 다른 날짜 범위를 읽는 상태가 됐다.

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
    "campaign_id_missing_count": 2121,
    "ambiguous_count": 0,
    "budget_decision_ready": false,
    "budget_decision_note": "exact click id matched rows are lower-bound samples; missing rows stay HOLD"
  },
  "bigquery_coverage_warning": {
    "trend_7_14_30_ready": true,
    "source_mode": "archive_backfill_until_20260506_plus_daily_export_from_20260507",
    "last_7d_suffix_count": 7,
    "last_14d_suffix_count": 14,
    "last_30d_suffix_count": 30
  },
  "dashboard_route": {
    "mode": "local_first",
    "last_7d_http": 200,
    "last_30d_http": 200,
    "deploy_scope": "VM limited read-only route stabilization"
  },
  "next_safe_action": "Build frontend only after API response shape is frozen and upload/send remains 0"
}
```

## F0 UI 카드
1. Google Ads ROAS=참고만 볼 플랫폼 주장값.
2. 내부 confirmed ROAS=예산 판단 후보값.
3. NPay click/count warning.
4. campaign_id join coverage.
5. BigQuery coverage status.
6. upload/send guard: 현재 0.

## 시작 조건
- VM dashboard `last_30d` route가 200으로 안정화되어야 한다. 현재 `local_first` 제한 배포 후 PASS다.
- ConfirmedPurchasePrep repeatable input이 매일 같은 shape로 나온다.
- BigQuery archive+daily union 결과가 payload에 들어간다.

## 아직 구현하지 않는 이유
- Google Ads upload 후보는 0이고 send_candidate=false다.
- campaign_id join coverage는 31/2152로 낮아 캠페인별 예산 판단은 아직 HOLD다.
- F0는 먼저 데이터 신뢰도와 warning을 보여주는 화면이어야 하며, 액션 버튼이나 upload 기능은 넣지 않는다.
