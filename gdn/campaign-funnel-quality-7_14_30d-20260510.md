# Campaign/channel funnel quality 7/14/30d (2026-05-10)

작성 시각: 2026-05-10 17:54:53 KST

## 5줄 요약

1. GA4 BigQuery daily export를 read-only로 조회해 7/14/30일 channel/campaign 퍼널을 한 묶음으로 만들었다.
2. 기준은 어제까지 확정 테이블이며, 2026-05-10 당일 intraday는 변동성이 있어 제외했다.
3. NPay click/add_payment_info는 구매완료가 아니고, actual confirmed 판단은 운영DB PAYMENT_COMPLETE와 연결해야 한다.
4. paid_google에서는 NPay click은 보이지만 GA4 purchase와 내부 confirmed match는 아직 분리되어 있다.
5. Google Ads/Meta/GA4 전송은 0건이며 send_candidate=false다.

## Source Coverage Warning

- 7/14/30 outputs are identical; GA4 export currently returned the same covered rows for all requested windows. Treat older-window expansion as source coverage warning, not trend proof.

## Window Summary

| window | date range | sessions | paid_google | paid_meta | paid_tiktok | npay_click_sessions | GA4 purchase events | freshness |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 7d | 2026-05-03 ~ 2026-05-09 | 25,640 | 2,017 | 13,190 | 5,534 | 181 | 148 | latest=20260509, rows=147696 |
| 14d | 2026-04-26 ~ 2026-05-09 | 25,640 | 2,017 | 13,190 | 5,534 | 181 | 148 | latest=20260509, rows=147696 |
| 30d | 2026-04-10 ~ 2026-05-09 | 25,640 | 2,017 | 13,190 | 5,534 | 181 | 148 | latest=20260509, rows=147696 |

## Paid Google Rows

### 7d

| campaign | sessions | scroll90% | checkout | add_payment_info | NPay click | GA4 purchase | mixed google/meta |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| [PM]건기식 실적최대화 | 1,413 | 23 | 40 | 148 | 148 | 0 | 275 |
| [PMAX] 바이오컴 검사권 캠페인 | 213 | 8.45 | 0 | 0 | 0 | 0 | 0 |
| [PM]검사권 실적최대화 | 172 | 23.84 | 5 | 2 | 2 | 2 | 0 |
| [SA]바이오컴 검사권 | 64 | 31.25 | 2 | 0 | 0 | 2 | 0 |
| googleads_biocom_pmcam_igg | 29 | 27.59 | 0 | 0 | 0 | 0 | 0 |
| googleads_eventPM_metadream_launching | 26 | 30.77 | 0 | 0 | 0 | 0 | 26 |
| googleads_shopping_supplements_biobalance | 20 | 45 | 2 | 1 | 1 | 0 | 4 |
| googleads_shopping_supplements_dangdang | 20 | 35 | 1 | 0 | 0 | 0 | 1 |
| googleads_shopping_supplements_metadream | 14 | 57.14 | 0 | 0 | 0 | 0 | 14 |
| googleads_biocom_PM_metadream | 12 | 33.33 | 0 | 0 | 0 | 0 | 12 |

### 14d

| campaign | sessions | scroll90% | checkout | add_payment_info | NPay click | GA4 purchase | mixed google/meta |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| [PM]건기식 실적최대화 | 1,413 | 23 | 40 | 148 | 148 | 0 | 275 |
| [PMAX] 바이오컴 검사권 캠페인 | 213 | 8.45 | 0 | 0 | 0 | 0 | 0 |
| [PM]검사권 실적최대화 | 172 | 23.84 | 5 | 2 | 2 | 2 | 0 |
| [SA]바이오컴 검사권 | 64 | 31.25 | 2 | 0 | 0 | 2 | 0 |
| googleads_biocom_pmcam_igg | 29 | 27.59 | 0 | 0 | 0 | 0 | 0 |
| googleads_eventPM_metadream_launching | 26 | 30.77 | 0 | 0 | 0 | 0 | 26 |
| googleads_shopping_supplements_biobalance | 20 | 45 | 2 | 1 | 1 | 0 | 4 |
| googleads_shopping_supplements_dangdang | 20 | 35 | 1 | 0 | 0 | 0 | 1 |
| googleads_shopping_supplements_metadream | 14 | 57.14 | 0 | 0 | 0 | 0 | 14 |
| googleads_biocom_PM_metadream | 12 | 33.33 | 0 | 0 | 0 | 0 | 12 |

### 30d

| campaign | sessions | scroll90% | checkout | add_payment_info | NPay click | GA4 purchase | mixed google/meta |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| [PM]건기식 실적최대화 | 1,413 | 23 | 40 | 148 | 148 | 0 | 275 |
| [PMAX] 바이오컴 검사권 캠페인 | 213 | 8.45 | 0 | 0 | 0 | 0 | 0 |
| [PM]검사권 실적최대화 | 172 | 23.84 | 5 | 2 | 2 | 2 | 0 |
| [SA]바이오컴 검사권 | 64 | 31.25 | 2 | 0 | 0 | 2 | 0 |
| googleads_biocom_pmcam_igg | 29 | 27.59 | 0 | 0 | 0 | 0 | 0 |
| googleads_eventPM_metadream_launching | 26 | 30.77 | 0 | 0 | 0 | 0 | 26 |
| googleads_shopping_supplements_biobalance | 20 | 45 | 2 | 1 | 1 | 0 | 4 |
| googleads_shopping_supplements_dangdang | 20 | 35 | 1 | 0 | 0 | 0 | 1 |
| googleads_shopping_supplements_metadream | 14 | 57.14 | 0 | 0 | 0 | 0 | 14 |
| googleads_biocom_PM_metadream | 12 | 33.33 | 0 | 0 | 0 | 0 | 12 |

## 해석

- GA4 BigQuery는 퍼널 품질을 보는 보조 source다. 실제 NPay 결제완료는 운영DB PAYMENT_COMPLETE/admin confirmed 기준으로 봐야 한다.
- paid_google의 NPay click이 높아도 purchase로 승격하지 않는다. click/count/add_payment_info는 구매완료가 아니다.
- 캠페인 예산 판단은 이 표만으로 하지 않고, Google Ads 플랫폼 주장값과 내부 confirmed ROAS dry-run을 같이 본다.

## 금지선 준수

- platform send 0
- Google Ads upload 0
- send_candidate=true 0
