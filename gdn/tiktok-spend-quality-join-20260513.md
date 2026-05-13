# TikTok Spend Quality Join Dry-run

작성 시각: 2026-05-13 18:55:11 KST
Lane: Green read-only.

## 10초 요약

TikTok API spend/click과 GA4 BigQuery paid_tiktok 품질을 같은 2026-05-07~2026-05-12 window로 붙였다. 최근 6일 TikTok spend는 140,850원, clicks는 5,754건이고, TikTok platform purchase value는 0원이다. GA4 paid_tiktok은 5,581 sessions, scroll90 1.59%, 평균 engagement 0.61초, GA4 purchase 1건 / 225,300원이다.

## Campaign Join 결과

| TikTok API campaign | spend | clicks | semantic join | GA4 sessions | scroll90 | GA4 purchase |
|---|---:|---:|---|---:|---:|---:|
| 음과검 스마트+ 캠페인 | 75,633원 | 2,629 | semantic_matched | 2,636 | 0.61% | 0 |
| 종합대사기능 분석 스마트+캠페인 | 46,315원 | 2,501 | semantic_matched | 2,313 | 2.81% | 1 |
| 영양중금속분석 스마트+ 캠페인 | 18,902원 | 624 | semantic_matched | 504 | 0.99% | 0 |
| 호르몬 검사 캠페인 | 0원 | 0 | not_matched_or_zero_spend | 0 | 0% | 0 |
| 건강기능식품 스마트+캠페인 | 0원 | 0 | not_matched_or_zero_spend | 0 | 0% | 0 |

## 판정

- 판정: `paid_tiktok_quality_risk_persists_with_join_gap`.
- 이유: active spend campaign은 GA4 paid_tiktok hint와 의미상 연결되지만, GA4에 TikTok campaign_id exact가 없어 campaign/day exact join은 아직 미완성이다.
- 예산 변경: 보류. 이 산출물은 품질 진단이며 TikTok 예산 변경 승인안이 아니다.

## 다음 Green 설계

1. TikTok landing URL에 `utm_campaign`과 `campaign_id`를 같이 남기는 naming rule을 만든다.
2. GA4 BigQuery에서 campaign_id exact가 들어오는지 7일 후 재확인한다.
3. 내부 confirmed order와 GA4/TikTok campaign hint를 연결하는 no-send dry-run을 설계한다.

산출 JSON: `data/project/tiktok-spend-quality-join-20260513.json`
