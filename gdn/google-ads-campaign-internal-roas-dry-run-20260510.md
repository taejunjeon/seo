# Google Ads campaign-level internal ROAS dry-run (2026-05-10)

작성 시각: 2026-05-10 17:57:00 KST

## 5줄 요약

1. Google Ads 캠페인별 플랫폼 주장값과 내부 confirmed 매출을 read-only로 나눠 봤다.
2. 플랫폼 주장값은 cost 23,667,282.84원 / Conv. value 226,732,681.89원 / ROAS 9.58다.
3. 내부 confirmed 중 Google click id가 남은 매출은 7,611,210원/31건이다.
4. 아직 campaign_id 결정 조인이 없어 캠페인별 internal ROAS는 HOLD이며, utm_campaign은 보조 힌트로만 본다.
5. 예산 판단은 platform ROAS가 아니라 internal confirmed ROAS 조인이 닫힌 뒤 해야 한다.

## Platform Campaign Rows

| campaign | cost | platform Conv. value | platform ROAS | internal revenue joined | join status |
| --- | ---: | ---: | ---: | ---: | --- |
| [PM]건기식 실적최대화 | 9,465,724.12 | 97,070,763.06 | 10.25 | 0 | HOLD_campaign_id_missing_in_confirmed_evidence |
| [PM]검사권 실적최대화 | 6,411,800.46 | 74,347,480.72 | 11.6 | 0 | HOLD_campaign_id_missing_in_confirmed_evidence |
| [PM] 이벤트 | 5,876,248.85 | 50,776,321.58 | 8.64 | 0 | HOLD_campaign_id_missing_in_confirmed_evidence |
| [SA]바이오컴 검사권 | 1,493,515.75 | 4,168,116.54 | 2.79 | 0 | HOLD_campaign_id_missing_in_confirmed_evidence |
| [PMAX] 바이오컴 검사권 캠페인 | 419,993.66 | 370,000 | 0.88 | 0 | HOLD_campaign_id_missing_in_confirmed_evidence |

## Internal Google-click Revenue by UTM Campaign

| utm_campaign | orders | internal confirmed revenue | status |
| --- | ---: | ---: | --- |
| (blank) | 8 | 2,754,000 | not_joined_to_google_ads_campaign_id |
| googleads_image_IgGtest_1 | 5 | 1,464,500 | not_joined_to_google_ads_campaign_id |
| googleads_shopping_supplements_neuromaster | 5 | 1,333,300 | not_joined_to_google_ads_campaign_id |
| googleads_performancemax_assetgroup_organicacid | 1 | 496,000 | not_joined_to_google_ads_campaign_id |
| googleads_testSA_foodallergy_SA | 2 | 490,000 | not_joined_to_google_ads_campaign_id |
| googleads_testSA_mineral_SA | 1 | 349,000 | not_joined_to_google_ads_campaign_id |
| google_biocom_pmkit_igg | 1 | 245,000 | not_joined_to_google_ads_campaign_id |
| googleads_shopping_supplements_dangdang | 1 | 120,900 | not_joined_to_google_ads_campaign_id |
| googleads_shopping_supplements_metadream | 1 | 120,900 | not_joined_to_google_ads_campaign_id |
| googleads_eventPM_metadream_launching | 2 | 96,800 | not_joined_to_google_ads_campaign_id |
| googleads_supplements_PM_neuro | 2 | 62,810 | not_joined_to_google_ads_campaign_id |
| googleads_shopping_supplements_biobalance | 1 | 39,000 | not_joined_to_google_ads_campaign_id |
| googleads_biocom_biobalance_PM(USP2) | 1 | 39,000 | not_joined_to_google_ads_campaign_id |

## 다음 Green 분석

- Google Ads campaign id와 VM Cloud/order evidence에 남은 utm_campaign을 deterministic하게 매핑할 수 있는지 사전표를 만든다.
- 매핑이 불명확하면 campaign budget action은 HOLD로 둔다.

## 금지선 준수

- Google Ads upload 0
- conversion action 변경 0
- send_candidate=true 0
