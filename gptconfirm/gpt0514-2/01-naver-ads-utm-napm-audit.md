# 01. 네이버 광고 UTM/NaPm/n_* 추적 감사

## 무엇이 가능해졌나

네이버 유입이 “자연검색인지 광고인지”를 감으로 보지 않고, source별로 어디까지 흔적이 남는지 볼 수 있게 됐다. 핵심은 실제 매출 정본은 운영DB 결제완료 spine이고, `UTM/NaPm/n_*`는 채널 evidence라는 점이다.

## Source 구분

- 운영DB: PostgreSQL `dashboard.public.tb_iamweb_users`. 실제 결제완료 월 매출 spine.
- VM Cloud: SQLite `/home/biocomkr_sns/seo/repo/backend/data/crm.sqlite3`. `attribution_ledger`, `site_landing_ledger` 채널 evidence.
- 로컬DB: `/Users/vibetj/coding/seo/backend/data/crm.sqlite3`. `naver_ads_daily` 캐시와 local dry-run.
- BigQuery: GA4 traffic source cross-check. actual 매출 정본 아님.

## VM Cloud attribution_ledger inventory

window: 2026-05 monthly KST
source: VM Cloud SQLite `attribution_ledger`, `source='biocom_imweb'`
freshness: 2026-05-14 01:28 KST read-only SSH query
confidence: B

| touchpoint | total | naver_any | search_referrer | NaPm | brandsearch | n_* | bridge key present |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| checkout_started | 2,199 | 629 | 476 | 488 | 229 | 15 | 1,790 |
| marketing_intent | 20,827 | 225 | 0 | 6 | 0 | 219 | 0 |
| payment_success | 854 | 216 | 157 | 158 | 100 | 8 | 854 |

해석:

- `payment_success`까지 네이버 흔적이 216건 남는다.
- 그중 `NaPm` 158건과 브랜드검색 100건이 있어 네이버 검색 referrer를 곧바로 자연검색으로 올리면 과대분류가 된다.
- `marketing_intent`의 `n_*`는 click/intent 단계 참고값이고, 결제완료 매출 attribution으로 바로 쓰면 안 된다.

## VM Cloud site_landing_ledger inventory

source: VM Cloud SQLite `site_landing_ledger`, site `biocom`

- total: 2,912
- UTM any: 2,154
- Naver any: 138
- Naver search referrer: 47
- NaPm: 99
- brandsearch: 68
- n_*: 3
- local session key present: 2,145

해석:

랜딩 단계에서는 `NaPm`과 브랜드검색 흔적이 일부 남지만, site landing만으로 주문 매출 배정은 부족하다. 결제완료 spine과 order/payment bridge까지 닫힌 뒤 reference line으로만 올려야 한다.

## 로컬DB Naver Ads cache

source: 로컬DB `naver_ads_daily`
window: 캐시상 2026-05-06~2026-05-12
confidence: B-, 플랫폼 주장값 reference

- rows: 259
- impressions: 247,090
- clicks: 3,000
- spend: 1,698,930원
- platform claim conversions: 383
- platform claim conversion value: 31,501,866원

이 값은 네이버 광고가 실제로 집행됐는지 보는 참고값이다. 내부 confirmed 매출에 더하지 않는다.

## GA4 BigQuery cross-check

source: BigQuery `analytics_304759974_hurdlers_backfill` + `analytics_304759974` union
window: last_7d/14d/30d ending 2026-05-12
confidence: A- for traffic coverage, not actual revenue

- last_7d coverage: PASS, 355,173 event rows, 59,482 sessions.
- last_30d coverage: PASS, 2,078,719 event rows, 347,662 sessions.
- last_30d paid_naver brandsearch hints: MO 1,771 sessions, PC 691 sessions.

주의:

GA4에서 `source_group=organic_search`인데 campaign_hint에 `naverbrandsearch`가 섞이는 행이 있다. 그래서 GA4는 “유입이 있었다”는 교차검증으로만 쓰고, paid/organic 확정은 VM Cloud first-party evidence와 운영DB 결제완료 spine 결합으로 해야 한다.

## 결론

네이버 광고 표식은 실제로 들어오고 있다. 다만 현재 evidence는 “채널 힌트” 단계라 paid_naver를 예산 ROAS에 바로 승격하지 않는다. 다음 단계는 UTM/NaPm/n_* 표준 규칙을 고정하고, 결제완료 spine과 닫히는 order-level line을 따로 만드는 것이다.
