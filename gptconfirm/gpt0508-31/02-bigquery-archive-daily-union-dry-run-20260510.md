# BigQuery archive + daily export union dry-run (2026-05-10)

## 5줄 요약

1. GA4 daily suffix는 날짜별 raw event table이다. 신규 daily export만 보면 biocom은 2026-05-07~2026-05-09 3일치만 보여 trend 비교가 안 된다.
2. 이번 dry-run은 archive 백필 `<=20260506`과 신규 daily export `>=20260507`을 합쳐 7/14/30일 window를 다시 읽었다.
3. union trend readiness는 PASS다. 7/14/30일이 실제로 다른 날짜 범위를 읽는지 확인했다.
4. NPay click/add_payment_info는 구매완료가 아니며, actual confirmed는 운영DB PAYMENT_COMPLETE/admin confirmed source와 조인해야 한다.
5. GA4/Google Ads/Meta/TikTok/Naver 신규 전송은 하지 않았고, BigQuery read-only 조회만 수행했다.

## Source / Window / Freshness

- archive source: project-dadba7dd-0229-4ff6-81c.analytics_304759974_hurdlers_backfill.events_*
- daily source: project-dadba7dd-0229-4ff6-81c.analytics_304759974.events_*
- job project: project-dadba7dd-0229-4ff6-81c
- generated_at_kst: 2026-05-10 20:13:07 KST
- confidence: A-

## Window Coverage

| window | requested days | available suffixes | archive suffixes | daily suffixes | status | event rows |
| --- | ---: | ---: | ---: | ---: | --- | ---: |
| last_7d | 7 | 7 | 4 | 3 | PASS | 381559 |
| last_14d | 14 | 14 | 11 | 3 | PASS | 754213 |
| last_30d | 30 | 30 | 27 | 3 | PASS | 2289596 |

## Top Funnel Rows

### last_7d

| source_group | campaign_hint | sessions | scroll90% | checkout | add_payment_info | NPay click | GA4 purchase |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| paid_tiktok | tiktok_biocom_yeonddle_iggacidset | 11901 | 0.42 | 1 | 1 | 1 | 0 |
| direct | (direct) | 5363 | 20.49 | 58 | 0 | 0 | 0 |
| paid_tiktok | tiktok_biocom_yeonddle_acid | 5223 | 2.37 | 0 | 0 | 0 | 0 |
| paid_meta | meta_biocom_yeonddle_igg | 4657 | 4.27 | 41 | 1 | 1 | 22 |
| paid_meta | meta_biocom_proteinstory_igg | 3741 | 1.68 | 5 | 0 | 0 | 5 |
| paid_google | [PM]건기식 실적최대화 | 3106 | 23.82 | 84 | 317 | 317 | 0 |
| paid_meta | meta_biocom_sikdanstory_igg | 2979 | 2.48 | 12 | 0 | 0 | 8 |
| paid_meta | meta_biocom_biospeed_mineral | 2523 | 1.9 | 7 | 1 | 1 | 5 |
| paid_tiktok | tiktok_biocom_mineralcam_mineral | 2511 | 1.31 | 0 | 0 | 0 | 0 |
| paid_meta | meta_biocom_skincare_igg | 2029 | 5.37 | 15 | 0 | 0 | 4 |

### last_14d

| source_group | campaign_hint | sessions | scroll90% | checkout | add_payment_info | NPay click | GA4 purchase |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| paid_tiktok | tiktok_biocom_yeonddle_iggacidset | 17980 | 0.49 | 3 | 7 | 7 | 0 |
| paid_tiktok | tiktok_biocom_mineralcam_mineral | 9921 | 0.93 | 0 | 1 | 1 | 0 |
| direct | (direct) | 9272 | 25.69 | 117 | 1 | 1 | 0 |
| paid_meta | meta_biocom_yeonddle_igg | 8085 | 4.72 | 83 | 2 | 2 | 39 |
| paid_tiktok | tiktok_biocom_yeonddle_acid | 6299 | 2.43 | 0 | 0 | 0 | 0 |
| paid_meta | meta_biocom_proteinstory_igg | 6011 | 2.51 | 18 | 0 | 0 | 10 |
| paid_google | [PM]건기식 실적최대화 | 5686 | 24.09 | 148 | 522 | 522 | 0 |
| paid_meta | meta_biocom_skincare_igg | 4381 | 5.68 | 31 | 0 | 0 | 17 |
| paid_google | [PM]검사권 실적최대화 | 4209 | 24.52 | 127 | 383 | 383 | 2 |
| paid_meta | meta_biocom_sikdanstory_igg | 3856 | 2.9 | 22 | 0 | 0 | 15 |

### last_30d

| source_group | campaign_hint | sessions | scroll90% | checkout | add_payment_info | NPay click | GA4 purchase |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| paid_tiktok | tiktok_biocom_yeonddle_iggacidset | 78666 | 0.39 | 34 | 31 | 31 | 63 |
| paid_tiktok | tiktok_biocom_mineralcam_mineral | 54862 | 1.25 | 2 | 1 | 1 | 21 |
| paid_tiktok | tiktok_biocom_yeonddle_acid | 24925 | 2.53 | 0 | 0 | 0 | 17 |
| paid_tiktok | tiktok_biocom_bangtanjelly | 22068 | 2.2 | 0 | 0 | 0 | 8 |
| paid_meta | meta_biocom_yeonddle_igg | 19103 | 4.2 | 158 | 4 | 4 | 170 |
| paid_meta | meta_biocom_proteinstory_igg | 17877 | 2.19 | 43 | 0 | 0 | 107 |
| direct | (direct) | 17440 | 29.76 | 295 | 1 | 1 | 529 |
| paid_google | [PM]건기식 실적최대화 | 11142 | 21.32 | 255 | 847 | 847 | 174 |
| paid_tiktok | tiktok_biocom_biobalance | 9893 | 1.44 | 0 | 0 | 0 | 9 |
| paid_meta | meta_biocom_skincare_igg | 9185 | 6.14 | 68 | 0 | 0 | 92 |

## 운영자 해석

- `source coverage warning`은 보고 기간보다 실제 읽은 날짜가 적다는 뜻이다. 이번 union이 PASS이면 7/14/30일 추세 비교의 데이터 기반은 확보된 것이다.
- 그래도 GA4 purchase는 내부 confirmed purchase의 정답이 아니다. NPay 실제 결제완료는 운영DB PAYMENT_COMPLETE/admin confirmed source를 primary로 본다.
- 이 결과는 frontend에서 BigQuery coverage warning을 낮출 근거가 되지만, Google Ads upload 또는 예산 판단을 자동 승인하지 않는다.

## 금지선 준수

- 운영DB write 0
- VM Cloud write 0
- GTM Production publish 0
- Google Ads/GA4/Meta/TikTok/Naver 신규 전송 0

