# Channel/Campaign funnel quality (2026-05-10)

## 5줄 요약

1. GA4 BigQuery current export를 read-only로 조회해 channel/campaign별 퍼널 품질을 갱신했다.
2. 총 세션은 25640건, Google Ads 세션은 2017건이다.
3. NPay click은 구매완료가 아니며, GA4 purchase와 internal confirmed match는 별도 원장 조인이 필요하다.
4. scroll90, view_item, checkout, add_payment_info, NPay click, GA4 purchase를 같은 표로 분리했다.
5. Google Ads/Meta/GA4 전송은 하지 않았고 send_candidate=false 상태다.

## Source

- source: project-dadba7dd-0229-4ff6-81c.analytics_304759974.events_*
- window: 2026-05-07 ~ 2026-05-09
- freshness: {"latest_suffix":"20260509","event_rows":"147696","max_event_ts":"1.778338764531551E9"}

## Top Rows

| source_group | campaign_hint | sessions | scroll90% | view_item | checkout | add_payment_info | npay_click | GA4 purchase |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| paid_meta | meta_biocom_yeonddle_igg | 2697 | 3.6 | 631 | 14 | 0 | 0 | 8 |
| paid_tiktok | tiktok_biocom_yeonddle_iggacidset | 2618 | 0.57 | 1086 | 0 | 0 | 0 | 0 |
| direct | (direct) | 2543 | 19.94 | 0 | 30 | 0 | 0 | 0 |
| paid_meta | meta_biocom_sikdanstory_igg | 2217 | 2.3 | 384 | 9 | 0 | 0 | 6 |
| paid_tiktok | tiktok_biocom_yeonddle_acid | 2169 | 2.67 | 965 | 0 | 0 | 0 | 0 |
| paid_meta | meta_biocom_proteinstory_igg | 2165 | 1.8 | 298 | 1 | 0 | 0 | 1 |
| paid_meta | meta_biocom_biospeed_mineral | 1500 | 2 | 719 | 5 | 0 | 0 | 4 |
| paid_google | [PM]건기식 실적최대화 | 1413 | 23 | 282 | 40 | 148 | 148 | 0 |
| paid_meta | meta_biocom_yeonddle_iggacid | 662 | 3.93 | 231 | 0 | 2 | 2 | 0 |
| paid_meta | (referral) | 645 | 52.25 | 3 | 6 | 0 | 0 | 4 |
| paid_meta | meta_biocom_igevsiggblog_igg | 619 | 5.82 | 170 | 4 | 0 | 0 | 3 |
| organic_search | (referral) | 499 | 21.24 | 114 | 34 | 4 | 4 | 22 |
| paid_tiktok | tiktok_biocom_mineralcam_mineral | 496 | 1.01 | 162 | 0 | 0 | 0 | 0 |
| paid_meta | meta_biocom_skincare_igg | 370 | 5.95 | 92 | 2 | 0 | 0 | 2 |
| organic_search | 1 | 334 | 17.07 | 91 | 17 | 1 | 1 | 13 |
| paid_meta | 120244759209860396 | 315 | 2.22 | 80 | 2 | 0 | 0 | 2 |
| organic_search | (organic) | 289 | 28.37 | 78 | 12 | 0 | 0 | 4 |
| paid_meta | meta_biocom_nurostory_nuro | 249 | 6.02 | 106 | 2 | 5 | 5 | 1 |
| paid_meta | 120231749833120396 | 222 | 0.9 | 6 | 0 | 0 | 0 | 0 |
| paid_google | [PMAX] 바이오컴 검사권 캠페인 | 213 | 8.45 | 50 | 0 | 0 | 0 | 0 |

## 해석

- GA4 BigQuery는 실제 NPay 결제완료의 primary source가 아니다. 운영DB PAYMENT_COMPLETE/admin confirmed와 조인해야 한다.
- NPay click/add_payment_info는 purchase가 아니며, 구매완료 후보로 승격하지 않는다.
- internal confirmed match는 이번 문서에서 not_joined로 남긴다. ConfirmedPurchasePrep integrated input이 다음 조인 기준이다.

