# Channel/Campaign funnel quality (2026-05-10)

## 5줄 요약

1. GA4 BigQuery current export를 read-only로 조회해 channel/campaign별 퍼널 품질을 갱신했다.
2. 총 세션은 47256건, Google Ads 세션은 3701건이다.
3. NPay click은 구매완료가 아니며, GA4 purchase와 internal confirmed match는 별도 원장 조인이 필요하다.
4. scroll90, view_item, checkout, add_payment_info, NPay click, GA4 purchase를 같은 표로 분리했다.
5. Google Ads/Meta/GA4 전송은 하지 않았고 send_candidate=false 상태다.

## Source

- source: project-dadba7dd-0229-4ff6-81c.analytics_304759974.events_*
- window: 2026-05-07 ~ 2026-05-12
- freshness: {"latest_suffix":"20260512","event_rows":"284879","max_event_ts":"1.778597997306223E9"}

## Top Rows

| source_group | campaign_hint | sessions | scroll90% | view_item | checkout | add_payment_info | npay_click | GA4 purchase |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| paid_meta | meta_biocom_yeonddle_igg | 5657 | 3.75 | 1355 | 31 | 1 | 1 | 18 |
| direct | (direct) | 5184 | 18.4 | 0 | 59 | 0 | 0 | 0 |
| paid_meta | meta_biocom_proteinstory_igg | 3816 | 1.99 | 588 | 2 | 0 | 0 | 2 |
| paid_meta | meta_biocom_sikdanstory_igg | 3696 | 2.71 | 692 | 18 | 0 | 0 | 14 |
| paid_meta | meta_biocom_biospeed_mineral | 2880 | 1.63 | 1402 | 7 | 0 | 0 | 4 |
| paid_google | [PM]건기식 실적최대화 | 2816 | 23.08 | 532 | 89 | 277 | 277 | 0 |
| paid_tiktok | tiktok_biocom_yeonddle_iggacidset | 2636 | 0.61 | 1091 | 0 | 0 | 0 | 0 |
| paid_tiktok | tiktok_biocom_yeonddle_acid | 2173 | 2.72 | 966 | 1 | 1 | 1 | 1 |
| organic_search | (referral) | 1521 | 16.77 | 326 | 80 | 15 | 15 | 45 |
| paid_meta | meta_biocom_igevsiggblog_igg | 1416 | 5.65 | 357 | 6 | 0 | 0 | 5 |
| paid_meta | meta_biocom_skincare_igg | 1328 | 6.02 | 318 | 10 | 0 | 0 | 6 |
| paid_meta | 120245003319500396 | 1183 | 28.4 | 65 | 25 | 1 | 1 | 18 |
| paid_meta | meta_biocom_yeonddle_iggacid | 1098 | 5.1 | 381 | 4 | 2 | 2 | 1 |
| paid_meta | (referral) | 880 | 49.89 | 14 | 13 | 0 | 0 | 8 |
| organic_search | b2026051158d12c08c11ca | 867 | 29.99 | 373 | 69 | 39 | 39 | 24 |
| organic_search | 1 | 839 | 14.66 | 195 | 37 | 1 | 1 | 24 |
| paid_meta | 120244759209860396 | 708 | 2.82 | 210 | 5 | 0 | 0 | 4 |
| organic_search | (organic) | 612 | 30.23 | 159 | 22 | 2 | 2 | 11 |
| paid_meta | 120231749833120396 | 547 | 1.46 | 30 | 0 | 2 | 2 | 0 |
| paid_tiktok | tiktok_biocom_mineralcam_mineral | 504 | 0.99 | 165 | 0 | 0 | 0 | 0 |

## 해석

- GA4 BigQuery는 실제 NPay 결제완료의 primary source가 아니다. 운영DB PAYMENT_COMPLETE/admin confirmed와 조인해야 한다.
- NPay click/add_payment_info는 purchase가 아니며, 구매완료 후보로 승격하지 않는다.
- internal confirmed match는 이번 문서에서 not_joined로 남긴다. ConfirmedPurchasePrep integrated input이 다음 조인 기준이다.

