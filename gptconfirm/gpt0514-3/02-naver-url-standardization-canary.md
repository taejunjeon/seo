# 02. 네이버 광고 URL 표준화 canary 승인안

## 목적

네이버 광고 URL을 한 번에 전체 변경하지 않는다. 1개 캠페인 또는 1개 광고그룹만 canary로 바꿔 24~72시간 동안 `site_landing_ledger`와 `attribution_ledger`에 UTM/NaPm이 같은 방식으로 남는지 본다.

## Canary 범위

- 범위: 1개 캠페인 또는 1개 광고그룹.
- 기간: 24~72시간.
- 운영 영향: 실제 광고 플랫폼 URL 변경이므로 TJ님 승인 필요.
- 예산 ROAS 반영: 자동 포함 금지. reference/evidence로만 표시.

## URL 템플릿

브랜드검색:

```text
utm_source=naver
utm_medium=brandsearch
utm_campaign=naverbrandsearch_biocom_<pc_or_mo>_<landing>
utm_content=<adgroup_or_creative>
utm_term=<keyword_or_query_template>
```

파워링크:

```text
utm_source=naver
utm_medium=cpc
utm_campaign=powerlink_biocom_<campaign_or_product>
utm_content=<adgroup_or_creative>
utm_term=<keyword_or_query_template>
```

쇼핑검색 또는 기타:

```text
utm_source=naver
utm_medium=shopping_cpc
utm_campaign=shoppingsearch_biocom_<campaign_or_product>
utm_content=<adgroup_or_creative>
utm_term=<keyword_or_query_template>
```

네이버가 자동으로 붙이는 `NaPm`은 그대로 둔다. 우리가 추가하는 UTM은 내부 분류 안정화용이며, actual 매출 정본이 아니다.

## 성공 기준

- 새 클릭이 VM Cloud `site_landing_ledger`에 UTM과 NaPm으로 남는다.
- checkout/payment 단계 VM Cloud `attribution_ledger`에도 같은 first touch가 남는다.
- `/total`에서 paid_naver 또는 naver_brandsearch reference line으로 분리된다.
- budget ROAS에는 자동 포함되지 않는다.

## 실패 조건

- redirect가 query string을 제거한다.
- Naver Ads URL에 UTM이 적용되지 않는다.
- landing에는 UTM/NaPm이 보이지만 payment 단계에서 소실된다.
- paid_naver와 organic_naver_candidate가 한 줄로 섞인다.

## Rollback

Canary 대상 1개 캠페인 또는 광고그룹의 destination URL을 변경 전 URL로 되돌린다. 되돌린 뒤 1~2시간 동안 VM Cloud `site_landing_ledger` 신규 row에서 표준 UTM이 더 이상 증가하지 않는지 확인한다.

## 승인 요청

TJ님이 실제로 누를 화면은 Naver Ads 광고그룹/소재 랜딩 URL 설정 화면이다. 바꾸는 설정은 destination URL이다. 바꾸면 네이버 paid/brandsearch/organic 후보가 더 안정적으로 분리되고, 안 바꾸면 UTM 판정불가와 referrer-only 후보가 계속 남는다.
