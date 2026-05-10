# Google Ads campaign_id join candidates - 2026-05-10

## 결론
Google click id가 있는 내부 confirmed 주문 31건은 Google Ads click_view read-only 조회로 campaign_id까지 결정 조인됐다. 전체 confirmed 2,152건 중 31건만 campaign_id가 있으므로, 캠페인별 internal ROAS는 아직 예산 결정값이 아니라 click-id 매칭 하한값이다.

## Summary

```json
{
  "confirmed_orders": 2152,
  "google_click_id_orders": 31,
  "unique_gclid": 31,
  "campaign_id_matched_count": 31,
  "campaign_id_missing_count": 2121,
  "ambiguous_count": 0,
  "match_method_counts": {
    "none": 2121,
    "google_ads_click_view_gclid": 31
  },
  "campaign_counts": {
    "14629255429 [SA]바이오컴 검사권": 9,
    "23171999678 [PM] 이벤트": 2,
    "21807994952 [PM]검사권 실적최대화": 12,
    "22018174474 [PM]건기식 실적최대화": 8
  },
  "matched_revenue": 7611210
}
```

## 판정
- campaign_id matched: 31건 / 31 click-id orders
- matched revenue: 7,611,210 KRW
- ambiguous: 0
- send_candidate=false, actual_send_candidate=false

## 캠페인별 matched count
- 14629255429 [SA]바이오컴 검사권: 9건
- 23171999678 [PM] 이벤트: 2건
- 21807994952 [PM]검사권 실적최대화: 12건
- 22018174474 [PM]건기식 실적최대화: 8건

## 주의
- time-window-only attribution은 사용하지 않았다.
- utm_campaign은 보조 힌트로만 두고, deterministic campaign_id에는 쓰지 않았다.
- 예산 판단은 platform ROAS가 아니라 내부 confirmed ROAS와 funnel quality를 함께 봐야 한다.
