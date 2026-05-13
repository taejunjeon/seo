# BigQuery archive + daily export union dry-run (2026-05-13 latest)

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
- generated_at_kst: 2026-05-13 18:50:51 KST
- confidence: A-

## Window Coverage

| window | requested days | available suffixes | archive suffixes | daily suffixes | status | event rows |
| --- | ---: | ---: | ---: | ---: | --- | ---: |
| last_7d | 7 | 7 | 1 | 6 | PASS | 355173 |
| last_14d | 14 | 14 | 8 | 6 | PASS | 698414 |
| last_30d | 30 | 30 | 24 | 6 | PASS | 2078719 |

## Top Funnel Rows

### last_7d

| source_group | campaign_hint | sessions | scroll90% | checkout | add_payment_info | NPay click | GA4 purchase |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| direct | (direct) | 6215 | 18.25 | 71 | 0 | 0 | 0 |
| paid_meta | meta_biocom_yeonddle_igg | 6209 | 3.83 | 39 | 1 | 1 | 22 |
| paid_tiktok | tiktok_biocom_yeonddle_iggacidset | 6043 | 0.43 | 0 | 0 | 0 | 0 |
| paid_meta | meta_biocom_proteinstory_igg | 4289 | 1.84 | 3 | 0 | 0 | 3 |
| paid_meta | meta_biocom_sikdanstory_igg | 3988 | 2.83 | 19 | 0 | 0 | 15 |
| paid_meta | meta_biocom_biospeed_mineral | 3267 | 1.71 | 9 | 1 | 1 | 5 |
| paid_google | [PM]건기식 실적최대화 | 3193 | 22.83 | 100 | 322 | 322 | 0 |
| paid_tiktok | tiktok_biocom_yeonddle_acid | 2860 | 2.52 | 1 | 1 | 1 | 1 |
| organic_search | (referral) | 1726 | 17.96 | 91 | 15 | 15 | 53 |
| paid_meta | meta_biocom_skincare_igg | 1629 | 5.65 | 11 | 0 | 0 | 6 |

### last_14d

| source_group | campaign_hint | sessions | scroll90% | checkout | add_payment_info | NPay click | GA4 purchase |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| paid_tiktok | tiktok_biocom_yeonddle_iggacidset | 16732 | 0.45 | 1 | 1 | 1 | 0 |
| direct | (direct) | 10212 | 21.88 | 118 | 0 | 0 | 0 |
| paid_meta | meta_biocom_yeonddle_igg | 9327 | 4.29 | 75 | 3 | 3 | 37 |
| paid_meta | meta_biocom_proteinstory_igg | 6788 | 2.34 | 17 | 0 | 0 | 10 |
| paid_google | [PM]건기식 실적최대화 | 6160 | 23.43 | 175 | 580 | 580 | 0 |
| paid_tiktok | tiktok_biocom_yeonddle_acid | 5660 | 2.54 | 1 | 1 | 1 | 1 |
| paid_meta | meta_biocom_sikdanstory_igg | 4903 | 3 | 27 | 0 | 0 | 21 |
| paid_tiktok | tiktok_biocom_mineralcam_mineral | 4861 | 1.19 | 0 | 1 | 1 | 0 |
| paid_meta | meta_biocom_biospeed_mineral | 4392 | 1.82 | 12 | 1 | 1 | 6 |
| paid_meta | meta_biocom_skincare_igg | 4308 | 5.66 | 35 | 0 | 0 | 18 |

### last_30d

| source_group | campaign_hint | sessions | scroll90% | checkout | add_payment_info | NPay click | GA4 purchase |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| paid_tiktok | tiktok_biocom_yeonddle_iggacidset | 51525 | 0.47 | 33 | 26 | 26 | 52 |
| paid_tiktok | tiktok_biocom_mineralcam_mineral | 47216 | 1.33 | 2 | 1 | 1 | 20 |
| paid_meta | meta_biocom_yeonddle_igg | 21303 | 4.1 | 165 | 5 | 5 | 171 |
| paid_tiktok | tiktok_biocom_yeonddle_acid | 20018 | 2.6 | 1 | 1 | 1 | 13 |
| direct | (direct) | 18951 | 28.02 | 289 | 1 | 1 | 413 |
| paid_tiktok | tiktok_biocom_bangtanjelly | 18215 | 1.95 | 1 | 0 | 0 | 3 |
| paid_meta | meta_biocom_proteinstory_igg | 16455 | 2.21 | 36 | 0 | 0 | 88 |
| paid_google | [PM]건기식 실적최대화 | 11801 | 21.41 | 279 | 927 | 927 | 165 |
| paid_meta | meta_biocom_skincare_igg | 9476 | 6 | 70 | 0 | 0 | 83 |
| paid_tiktok | tiktok_biocom_biobalance | 8712 | 1.16 | 0 | 0 | 0 | 4 |

## 운영자 해석

- `source coverage warning`은 보고 기간보다 실제 읽은 날짜가 적다는 뜻이다. 이번 union이 PASS이면 7/14/30일 추세 비교의 데이터 기반은 확보된 것이다.
- 그래도 GA4 purchase는 내부 confirmed purchase의 정답이 아니다. NPay 실제 결제완료는 운영DB PAYMENT_COMPLETE/admin confirmed source를 primary로 본다.
- 이 결과는 frontend에서 BigQuery coverage warning을 낮출 근거가 되지만, Google Ads upload 또는 예산 판단을 자동 승인하지 않는다.

## 금지선 준수

- 운영DB write 0
- VM Cloud write 0
- GTM Production publish 0
- Google Ads/GA4/Meta/TikTok/Naver 신규 전송 0
