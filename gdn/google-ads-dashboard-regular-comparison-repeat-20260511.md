# VM Cloud Google Ads dashboard 정기 비교 반복 (gpt0508-33)

작성 시각: 2026-05-10 21:45:30 KST
Lane: Green read-only

## 5줄 결론

1. status / last_7d / last_30d 세 endpoint 모두 HTTP 200, 직전 sprint와 동일하게 PASS다.
2. last_7d platform ROAS 11.7, internal confirmed ROAS 0.4. last_30d 9.58 vs 0.27로 platform과 internal을 계속 분리해서 보여준다.
3. campaign_id coverage(google 증거 보유 row 안에서)는 last_7d 0.7, last_30d 0.84로 직전 비교와 같다.
4. upload_candidate_count는 sprint 전반에서 0 유지. send_candidate/actual_send_candidate 모두 false.
5. ROAS gap이 큰 이유는 운영 imweb 주문에 click_id가 안 따라 와서 internal 분모가 작기 때문이다. 본 sprint도 upload/conversion action 변경 안 함.

## 1. 호출 결과

| label | URL | http_status | fetched_at_kst |
|---|---|---|---|
| status | https://att.ainativeos.net/api/google-ads/status | 200 | 2026-05-10T21:41:34 KST |
| last_7d | https://att.ainativeos.net/api/google-ads/dashboard?date_preset=last_7d | 200 | 2026-05-10T21:41:37 KST |
| last_30d | https://att.ainativeos.net/api/google-ads/dashboard?date_preset=last_30d | 200 | 2026-05-10T21:41:41 KST |

## 2. status 상세

| 항목 | 값 |
|---|---|
| API version | v22 |
| Customer ID | 2149990943 |
| Customer | 바이오컴 |
| manager / test_account | false / false |
| query_resource_consumption | 54 |

## 3. last_7d 지표

window: 2026-05-03 ~ 2026-05-09 KST

| 지표 | platform | internal_confirmed |
|---|---|---|
| cost | ₩397만 | n/a |
| 전환수 | 487.18 | 6 |
| 전환금액 | ₩4,648만 | ₩157만 |
| ROAS | 11.7 | 0.4 |
| campaign_id_coverage | n/a | 0.7 (matched 5 / matched+unknown 8) |
| matched_campaign_orders | n/a | 5 |
| unknown_campaign_orders | n/a | 3 |

diagnostics: campaign_rows 4, daily_rows 7, conversion_action_rows 46, conversion_action_metric_rows 17. truncation 없음.

## 4. last_30d 지표

window: 2026-04-10 ~ 2026-05-09 KST

| 지표 | platform | internal_confirmed |
|---|---|---|
| cost | ₩2,366만 | n/a |
| 전환수 | 2,246.97 | 25 |
| 전환금액 | ₩2억 2,673만 | ₩649만 |
| ROAS | 9.58 | 0.27 |
| campaign_id_coverage | n/a | 0.84 (matched 9 / matched+unknown 14) |
| matched_campaign_orders | n/a | 9 |
| unknown_campaign_orders | n/a | 5 |

diagnostics: campaign_rows 5, daily_rows 30, conversion_action_rows 46, conversion_action_metric_rows 22. truncation 없음.

## 5. 지표 표

| 지표 | last_7d | last_30d | 비고 |
|---|---|---|---|
| HTTP status | 200 | 200 | status endpoint 200 동일 |
| platform_roas_reference | 11.7 | 9.58 | 광고 플랫폼 자체 conversion action 기준. budget 절대값으로 사용 금지 |
| internal_confirmed_roas | 0.4 | 0.27 | 운영 attribution ledger의 google evidence 보유 payment_success만 집계 |
| primary_npay_share | n/a | n/a | dashboard internal block에 NPay 분리 노출 없음. ConfirmedPurchasePrep `npay_actual_count=0` 유지 |
| campaign_join_coverage | 0.7 | 0.84 | google evidence 보유 row 안에서 matched 비율. 전체 confirmed 2,152 대비가 아님 |
| upload_candidate_count | 0 | 0 | budget-usable 새 row 없음 |

## 6. delta vs gpt0508-32

| 항목 | delta |
|---|---|
| status http_status | 0 (200 유지) |
| last_7d http_status | 0 |
| last_30d http_status | 0 |
| platform ROAS last_7d | 0 |
| platform ROAS last_30d | 0 |
| internal_confirmed_roas last_7d | 0 |
| internal_confirmed_roas last_30d | 0 |
| campaign_id_coverage last_7d | 0 |
| campaign_id_coverage last_30d | 0 |
| upload_candidate_count | 0 |

VM dashboard fetchedAt이 거의 동일한 시각이라 cost/conv/ROAS도 동일.

## 7. 금지 재확인

- read-only 호출. VM write/restart/deploy 없음.
- Google Ads conversion action 변경 없음.
- send_candidate/actual_send_candidate=false.
- platform vs internal 분리 표시 유지.

## 8. Verdict

`PASS`

산출 JSON: `data/google-ads-dashboard-regular-comparison-repeat-20260511.json`
