# Campaign funnel quality archive+daily union 7/14/30d - 2026-05-11

작성 시각: 2026-05-10 21:17:36 KST
Lane: Green BigQuery read-only

## 5줄 요약

1. archive 백필과 daily export를 합쳐 last_7d, last_14d, last_30d가 실제 다른 날짜 범위를 읽게 했다.
2. 7일은 7개 날짜, 14일은 14개 날짜, 30일은 30개 날짜 coverage PASS다.
3. paid_google에서 NPay click/add_payment_info가 보이지만 구매완료로 승격하지 않는다.
4. GA4 purchase는 BigQuery 이벤트 기준이고, 내부 confirmed match는 ConfirmedPurchasePrep 또는 Path B/order bridge 조인이 필요하다.
5. Google Ads/GA4/Meta/TikTok/Naver 신규 전송과 운영DB write는 0이다.

## Window coverage

| window | date range | suffixes | archive | daily | event rows | status | sessions | paid_google | NPay click | GA4 purchase |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| last_7d | 2026-05-03 - 2026-05-09 | 7 | 4 | 3 | 381559 | PASS | 65993 | 5696 | 499 | 430 |
| last_14d | 2026-04-26 - 2026-05-09 | 14 | 11 | 3 | 754213 | PASS | 125942 | 12300 | 1157 | 874 |
| last_30d | 2026-04-10 - 2026-05-09 | 30 | 27 | 3 | 2289596 | PASS | 391430 | 29418 | 2000 | 3715 |

## Paid Google funnel rows

| window | campaign_hint | sessions | scroll90 | checkout | add_payment_info | NPay click | GA4 purchase | internal confirmed |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| last_7d | [PM]건기식 실적최대화 | 3106 | 740 | 84 | 317 | 317 | 0 | 조인 필요 |
| last_7d | [PM]검사권 실적최대화 | 1367 | 326 | 35 | 103 | 103 | 2 | 조인 필요 |
| last_7d | [PMAX] 바이오컴 검사권 캠페인 | 641 | 46 | 0 | 0 | 0 | 0 | 조인 필요 |
| last_7d | [SA]바이오컴 검사권 | 225 | 69 | 11 | 0 | 0 | 4 | 조인 필요 |
| last_7d | googleads_eventPM_metadream_launching | 64 | 12 | 0 | 0 | 0 | 0 | 조인 필요 |
| last_7d | googleads_shopping_supplements_metadream | 59 | 32 | 1 | 1 | 1 | 0 | 조인 필요 |
| last_7d | googleads_biocom_pmcam_igg | 53 | 8 | 0 | 0 | 0 | 0 | 조인 필요 |
| last_7d | googleads_shopping_supplements_biobalance | 41 | 19 | 2 | 2 | 2 | 0 | 조인 필요 |
| last_14d | [PM]건기식 실적최대화 | 5686 | 1370 | 148 | 522 | 522 | 0 | 조인 필요 |
| last_14d | [PM]검사권 실적최대화 | 4209 | 1032 | 127 | 383 | 383 | 2 | 조인 필요 |
| last_14d | [PM] 이벤트 | 716 | 139 | 18 | 94 | 94 | 1 | 조인 필요 |
| last_14d | [PMAX] 바이오컴 검사권 캠페인 | 641 | 46 | 0 | 0 | 0 | 0 | 조인 필요 |
| last_14d | [SA]바이오컴 검사권 | 415 | 117 | 13 | 0 | 0 | 4 | 조인 필요 |
| last_14d | googleads_eventPM_metadream_launching | 168 | 41 | 0 | 0 | 0 | 0 | 조인 필요 |
| last_14d | googleads_shopping_supplements_metadream | 123 | 69 | 1 | 2 | 2 | 0 | 조인 필요 |
| last_14d | googleads_shopping_supplements_biobalance | 116 | 52 | 6 | 3 | 3 | 1 | 조인 필요 |
| last_30d | [PM]건기식 실적최대화 | 11142 | 2375 | 255 | 847 | 847 | 174 | 조인 필요 |
| last_30d | [PM]검사권 실적최대화 | 9097 | 1962 | 234 | 653 | 653 | 206 | 조인 필요 |
| last_30d | [PM] 이벤트 | 5836 | 808 | 46 | 210 | 210 | 43 | 조인 필요 |
| last_30d | [SA]바이오컴 검사권 | 865 | 241 | 22 | 0 | 0 | 15 | 조인 필요 |
| last_30d | googleads_eventPM_metadream_launching | 727 | 201 | 1 | 1 | 1 | 1 | 조인 필요 |
| last_30d | [PMAX] 바이오컴 검사권 캠페인 | 641 | 46 | 0 | 0 | 0 | 0 | 조인 필요 |
| last_30d | googleads_shopping_supplements_metadream | 381 | 161 | 4 | 2 | 2 | 0 | 조인 필요 |
| last_30d | googleads_biocom_PM_metadream | 292 | 65 | 0 | 1 | 1 | 1 | 조인 필요 |

## 해석

- BigQuery coverage warning은 daily-only 기준에서는 여전히 주의가 필요하지만, archive+daily union 기준으로는 7/14/30일 trend 입력이 가능하다.
- 내부 confirmed match 가능 여부는 `조인 필요`다. GA4 이벤트만 보고 actual purchase를 확정하지 않는다.
- paid_google의 NPay click이 높아도 구매완료가 아니다. NPay actual confirmed는 운영DB PAYMENT_COMPLETE 또는 관리자 confirmed source를 primary로 본다.

## 금지선 준수

- platform send 0
- Google Ads upload 0
- 운영DB write 0
- send_candidate=true 0
