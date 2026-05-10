# Google Ads live action/campaign refresh (2026-05-10)

작성 시각: 2026-05-10 17:56:17 KST

## 5줄 요약

1. Google Ads API를 read-only로 다시 조회했고, window는 LAST_30_DAYS이다.
2. Google Ads ROAS=광고 플랫폼이 주장하는 값은 Conv. value 226,732,681.89원 / cost 23,667,282.84원 / ROAS 9.58다.
3. 내부 confirmed ROAS=실제 결제완료 주문 기준값은 같은 비교창에서 502,237,676원, 이 중 Google click id가 남은 confirmed는 7,611,210원/31건이다.
4. Primary NPay label value가 226,732,645.92원으로 플랫폼 Conv. value의 대부분이라, click/count 계열 오염 리스크가 계속 높다.
5. Google Ads upload/전환 액션 변경/send_candidate=true는 모두 0/NO다.

## Conversion Action Read-only Audit

| action id | name | primary | classification | risk | 해석 |
| --- | --- | --- | --- | --- | --- |
| 7130249515 | 구매완료 | true | primary_npay_count_label | HIGH | Primary 전환=Google Ads가 입찰 학습에 쓰는 핵심 구매 신호가 NPay count label에 묶여 있다. 실제 confirmed purchase와 분리 전까지 예산 판단에 직접 쓰면 위험하다. |
| 7564830949 | TechSol - NPAY구매 50739 | false | secondary_npay_click_label | MEDIUM | TechSol NPay click/conversion action은 Secondary로 보이나 NPay 버튼 클릭/intent 성격이다. 실제 결제완료가 아니므로 confirmed purchase로 쓰지 않는다. |

## Campaign Refresh

| campaign | status | channel | cost | platform Conv. value | primary NPay value | platform ROAS | internal join |
| --- | --- | --- | ---: | ---: | ---: | ---: | --- |
| [PM]건기식 실적최대화 | ENABLED | PERFORMANCE_MAX | 9,465,724.12 | 97,070,763.06 | 97,070,763.06 | 10.25 | campaign_id_not_available_in_confirmed_input |
| [PM]검사권 실적최대화 | ENABLED | PERFORMANCE_MAX | 6,411,800.46 | 74,347,480.72 | 74,347,461.28 | 11.6 | campaign_id_not_available_in_confirmed_input |
| [PM] 이벤트 | PAUSED | PERFORMANCE_MAX | 5,876,248.85 | 50,776,321.58 | 50,776,321.58 | 8.64 | campaign_id_not_available_in_confirmed_input |
| [SA]바이오컴 검사권 | ENABLED | SEARCH | 1,493,515.75 | 4,168,116.54 | 4,168,100 | 2.79 | campaign_id_not_available_in_confirmed_input |
| [PMAX] 바이오컴 검사권 캠페인 | PAUSED | PERFORMANCE_MAX | 419,993.66 | 370,000 | 370,000 | 0.88 | campaign_id_not_available_in_confirmed_input |

## Internal Confirmed Google-click Revenue by UTM

| utm_campaign | confirmed orders | internal confirmed revenue | note |
| --- | ---: | ---: | --- |
| (blank) | 8 | 2,754,000 | campaign_id join not yet deterministic |
| googleads_image_IgGtest_1 | 5 | 1,464,500 | campaign_id join not yet deterministic |
| googleads_shopping_supplements_neuromaster | 5 | 1,333,300 | campaign_id join not yet deterministic |
| googleads_performancemax_assetgroup_organicacid | 1 | 496,000 | campaign_id join not yet deterministic |
| googleads_testSA_foodallergy_SA | 2 | 490,000 | campaign_id join not yet deterministic |
| googleads_testSA_mineral_SA | 1 | 349,000 | campaign_id join not yet deterministic |
| google_biocom_pmkit_igg | 1 | 245,000 | campaign_id join not yet deterministic |
| googleads_shopping_supplements_dangdang | 1 | 120,900 | campaign_id join not yet deterministic |
| googleads_shopping_supplements_metadream | 1 | 120,900 | campaign_id join not yet deterministic |
| googleads_eventPM_metadream_launching | 2 | 96,800 | campaign_id join not yet deterministic |
| googleads_supplements_PM_neuro | 2 | 62,810 | campaign_id join not yet deterministic |
| googleads_shopping_supplements_biobalance | 1 | 39,000 | campaign_id join not yet deterministic |
| googleads_biocom_biobalance_PM(USP2) | 1 | 39,000 | campaign_id join not yet deterministic |

## 이번 문서가 말하는 것 / 말하지 않는 것

- 말하는 것: Google Ads 플랫폼 주장값이 어떤 action/campaign에서 발생하는지, 그리고 TechSol/NPay click label 리스크가 남아 있는지.
- 말하지 않는 것: Google Ads에 업로드할 confirmed_purchase 후보 승인. 현재 upload 후보는 0이다.

## 금지선 준수

- Google Ads upload 0
- conversion action 변경 0
- platform send 0
- send_candidate=true 0
