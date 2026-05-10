# Frontend Data Trust Dashboard F0 data contract v2 - 2026-05-11

작성 시각: 2026-05-10 21:17:36 KST
Lane: Green document-only. Frontend 구현 착수 아님.

## 10초 결론

F0 화면의 첫 질문은 “Google Ads가 말하는 매출과 실제 결제완료 주문 기준 매출이 얼마나 다른가”다. 구현은 아직 HOLD이며, 이번 문서는 화면이 읽어야 할 안전한 데이터 필드와 금지선을 고정한다.

## Data sources

| artifact | role | freshness | confidence |
| --- | --- | --- | --- |
| data/google-ads-dashboard-regular-comparison-20260511.json | platform_roas_reference와 internal_confirmed_roas 분리 | 2026-05-10 21:17:36 KST | 93% |
| data/campaign-funnel-quality-union-7_14_30d-20260511.json | BigQuery coverage와 campaign funnel 품질 | 2026-05-10 21:17:36 KST | 92% |
| data/google-ads-campaign-id-coverage-extension-20260511.json | campaign_join_coverage와 HOLD 이유 | 2026-05-10 21:17:36 KST | 89% |

## Required cards

| 사람이 보는 이름 | 필드 | 쉬운 뜻 | 화면 판정 |
| --- | --- | --- | --- |
| 광고 플랫폼 주장 ROAS | platform_roas_reference | Google Ads가 현재 전환 action 기준으로 주장하는 ROAS | 참고값 |
| 실제 결제완료 기준 ROAS | internal_confirmed_roas | 운영 원장 confirmed 주문만 분자로 쓴 ROAS | 예산 판단 핵심값 |
| NPay 경고 | npay_warning | NPay click/count는 구매완료가 아니며 actual confirmed만 포함해야 한다는 안내 | 상단 경고 |
| 캠페인 조인 커버리지 | campaign_join_coverage | 캠페인 ID가 붙은 내부 주문 비율 | 낮으면 예산 판단 HOLD |
| BigQuery coverage | bigquery_coverage | 7/14/30일이 실제 날짜 범위를 읽었는지 | PASS/HOLD 배지 |
| 전송 차단 장치 | upload_send_guard | Google Ads/GA4/Meta/TikTok/Naver 전송과 upload 후보가 0인지 | 항상 표시 |
| 다음 안전 액션 | next_safe_action | 승인 없이 해도 되는 다음 read-only 작업 | CTA 문구 |

## JSON shape v2

```json
{
  "generated_at_kst": "2026-05-10 21:17:36 KST",
  "site": "biocom",
  "dashboard": {
    "last_7d": {
      "platform_roas_reference": 11.700718743761232,
      "internal_confirmed_roas": 0.4,
      "primary_npay_share": 0,
      "campaign_join_coverage": 0.7,
      "upload_candidate_count": 0
    },
    "last_30d": {
      "platform_roas_reference": 9.580324933126128,
      "internal_confirmed_roas": 0.27,
      "primary_npay_share": 0,
      "campaign_join_coverage": 0.84,
      "upload_candidate_count": 0
    }
  },
  "npay_warning": "NPay click/count/add_payment_info는 구매완료가 아니다. 실제 결제완료 NPay 매출은 내부 confirmed에 포함한다.",
  "bigquery_coverage": [
    {
      "label": "last_7d",
      "requested_days": 7,
      "available_suffix_count": 7,
      "coverage_status": "PASS",
      "event_rows": 381559
    },
    {
      "label": "last_14d",
      "requested_days": 14,
      "available_suffix_count": 14,
      "coverage_status": "PASS",
      "event_rows": 754213
    },
    {
      "label": "last_30d",
      "requested_days": 30,
      "available_suffix_count": 30,
      "coverage_status": "PASS",
      "event_rows": 2289596
    }
  ],
  "upload_send_guard": {
    "google_ads_upload": 0,
    "platform_send": 0,
    "send_candidate": false,
    "actual_send_candidate": false
  },
  "next_safe_action": "campaign_id exact join 반복 실행과 dashboard read-only 정기 비교"
}
```

## UI wording rules

- 첫 화면 문장: “광고 플랫폼이 주장하는 구매 성과와 실제 결제완료 주문 기준 성과를 분리해서 봅니다.”
- `Primary 전환`은 “Google Ads가 입찰 학습에 쓰는 핵심 구매 신호”로 처음 한 번 풀어 쓴다.
- `Secondary 전환`은 “입찰에는 안 쓰고 관찰만 하는 보조 신호”로 처음 한 번 풀어 쓴다.
- NPay는 결제수단이다. 문제는 “NPay 클릭을 구매완료로 세는 것”이지 “NPay 매출을 제외하는 것”이 아니다.
- 넓은 표보다 결론 카드, 경고 카드, 상세 표 순서로 배치한다.

## Guard

- Frontend 구현 착수: HOLD
- Google Ads upload/change: Red HOLD
- Meta CAPI Test Events actual call: test_event_code 제공 전 HOLD
- 화면은 data contract를 읽는 read-only consumer여야 하며, write/send button을 만들지 않는다.
