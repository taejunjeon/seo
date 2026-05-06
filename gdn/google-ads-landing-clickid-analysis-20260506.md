# Google Ads landing-session click id 분모 분석

작성 시각: 2026-05-06 16:12:06 KST
기간: 2026-04-27 ~ 2026-05-03
문서 성격: read-only BigQuery 분석. GTM publish, Google Ads 전송, 운영 DB write 없음.

## 10초 결론

GA4 BigQuery 기준 Google Ads 증거가 있는 세션은 6,879개다.
이 중 URL 또는 collected_traffic_source에 Google click id가 남은 세션은 6,724개, 보존률은 97.75%다.
GA4가 Google Ads 캠페인으로 인식한 세션 중 click id가 raw에 남지 않은 비율은 0.31%다.
즉 Google Ads 랜딩 세션에는 click id가 대부분 남아 있다. 병목은 광고 URL이 아니라 랜딩 이후 checkout/NPay/결제완료 주문 원장까지 click id가 살아남지 않는 것이다.

## 핵심 숫자

| metric | value |
| --- | --- |
| google_ads_sessions | 6879 |
| google_ads_users | 3137 |
| avg_engagement_seconds | 36.41 |
| sessions_with_url_click_id | 6722 |
| sessions_with_url_click_id_rate | 97.72 |
| sessions_with_url_or_collected_click_id | 6724 |
| sessions_with_url_or_collected_click_id_rate | 97.75 |
| sessions_with_url_gclid | 6619 |
| sessions_with_url_gbraid | 235 |
| sessions_with_url_wbraid | 103 |
| sessions_with_collected_gclid | 6548 |
| sessions_with_ga4_google_ads_campaign | 6404 |
| ga4_google_ads_campaign_without_click_id_sessions | 20 |
| ga4_google_ads_campaign_without_click_id_rate | 0.31 |
| regular_checkout_sessions | 136 |
| regular_checkout_rate | 1.98 |
| regular_checkout_with_click_id_sessions | 131 |
| regular_checkout_with_click_id_rate | 96.32 |
| npay_click_sessions | 577 |
| npay_click_rate | 8.39 |
| npay_click_with_click_id_sessions | 575 |
| npay_click_with_click_id_rate | 99.65 |
| homepage_purchase_sessions | 4 |
| homepage_purchase_rate | 0.06 |
| homepage_purchase_value | 336917.0 |
| homepage_purchase_with_click_id_sessions | 1 |
| homepage_purchase_with_click_id_rate | 25.0 |
| ga4_npay_purchase_like_sessions | 0 |
| ga4_npay_purchase_like_with_click_id_sessions | 0 |

## 샘플

| session | first_ts_kst | click_id | gads_campaign | checkout | npay | homepage_purchase | value | landing_url |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1649671974.1773107081.1777548997 | 2026-04-30 20:36:38 | N | Y | Y | Y | Y | 80017.0 | https://biocom.kr/shop_view/?idx=172 |
| 1791645093.1777574382.1777574381 | 2026-05-01 03:39:42 | Y | N | Y | N | Y | 245000.0 | https://biocom.kr/igg_intro?gad_source=1&gad_campaignid=14629255429&gclid=REDACTED |
| 395345677.1775926422.1777733386 | 2026-05-02 23:49:48 | N | N | Y | N | Y | 11900.0 | https://biocom.kr/?utm_source=tiktok&utm_medium=paid&utm_campaign=codex_gtm_test&ttclid=codex_gtm_20260502 |
| 84447528.1773036752.1777343040 | 2026-04-28 11:24:00 | N | N | Y | N | Y | 0.0 | https://biocom.kr/shop_view?idx=259 |
| 196707881.1777605516.1777700306 | 2026-05-02 14:38:26 | Y | Y | Y | Y | N | 0.0 | https://biocom.kr/HealthFood/?idx=386&utm_source=googleads_shopping_supplements_metadream&utm_medium=googleads_shopping_... |
| 1422366705.1776873265.1777316217 | 2026-04-28 03:56:57 | Y | Y | Y | Y | N | 0.0 | https://biocom.kr/HealthFood/?idx=171&utm_source=googleads_shopping_supplements_poongsung&utm_medium=googleads_shopping_... |
| 2126961157.1777813818.1777813817 | 2026-05-03 22:10:18 | Y | Y | Y | N | N | 0.0 | https://biocom.kr/igg_store/?idx=85&utm_source=googleads_testsa_foodallergy_sa&utm_medium=googleads_testsa_foodallergy_s... |
| 1163557940.1770294555.1777813555 | 2026-05-03 22:05:56 | Y | Y | Y | N | N | 0.0 | https://biocom.kr/igg_store/?idx=85&utm_source=googleads_testsa_foodallergy_sa&utm_medium=googleads_testsa_foodallergy_s... |
| 1787812857.1770558897.1777809511 | 2026-05-03 20:58:30 | Y | Y | Y | N | N | 0.0 | https://biocom.kr/HealthFood/?idx=317&gad_source=5&gad_campaignid=21808018766&gclid=REDACTED |
| 1191348420.1770293601.1777808839 | 2026-05-03 20:47:20 | Y | Y | Y | N | N | 0.0 | https://biocom.kr/HealthFood/?idx=317&gad_source=5&gad_campaignid=21808018766&gclid=REDACTED |
| 802285489.1775970900.1777804689 | 2026-05-03 19:38:09 | Y | Y | Y | N | N | 0.0 | https://biocom.kr/HealthFood/?idx=386&utm_source=googleads_shopping_supplements_metadream&utm_medium=googleads_shopping_... |
| 1210720292.1771156649.1777801122 | 2026-05-03 18:38:43 | Y | Y | Y | N | N | 0.0 | https://biocom.kr/HealthFood/?idx=386&utm_source=googleads_shopping_supplements_metadream&utm_medium=googleads_shopping_... |

## 해석

- 이 분석은 GA4 BigQuery raw만 사용한다. 운영 주문 confirmed 여부는 별도 운영 DB/Attribution VM 조인이 필요하다.
- `gclid/gbraid/wbraid`가 raw에 남은 세션과 Google Ads 캠페인 attribution이 있는 세션은 같은 개념이 아니다.
- 운영 GTM에 `paid_click_intent`를 게시하면, 현재 raw에서 비는 Google click id를 랜딩 시점 storage/no-send ledger로 보강할 수 있다.
- NPay 실제 결제완료는 purchase 후보에 포함해야 하지만, NPay click/count/payment start는 purchase가 아니다.
