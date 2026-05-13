# 02. 네이버 paid / brandsearch / organic 분류 rule v1

## 왜 나누는가

네이버 검색 referrer가 있다고 모두 자연검색이 아니다. `NaPm`, 브랜드검색 UTM, `n_*` 파라미터가 있으면 유료 광고 또는 브랜드검색 후보로 먼저 분리해야 한다. 반대로 네이버 광고 표식이 있어도 실제 매출 정본은 아니므로 예산 ROAS에는 바로 넣지 않는다.

## rule v1

### paid_naver

조건:

- `NaPm` present, 또는
- `nclid`, `n_media`, `n_query`, `n_rank`, `n_ad_group`, `n_ad`, `n_keyword_id`, `n_keyword`, `n_match` present, 또는
- `utm_source=naver` 계열 + `utm_medium`이 `cpc`, `paid`, `powerlink`, `search` 계열.

사용:

- reference/hint.
- 결제완료 spine + order/payment bridge가 닫히기 전에는 budget ROAS 제외.

### naver_brandsearch

조건:

- campaign/marker에 `brandsearch`, `brand_search`, `naverbrandsearch` 계열.

사용:

- 브랜드검색 reference line.
- 일반 paid_naver와 분리해 표시한다.

### organic_naver_candidate

조건:

- referrer가 `search.naver.com` 또는 `m.search.naver.com`.
- `NaPm`, `nclid`, `n_*`, brandsearch marker 없음.
- paid UTM 없음.

사용:

- 자연검색 후보.
- order/payment bridge가 닫히면 order-level strong 후보가 될 수 있다.

### naver_referrer_or_utm_only

조건:

- 네이버 흔적은 있으나 paid/brandsearch/organic 조건을 충족하지 않음.

사용:

- 참고용.
- next evidence needed: redirect/query preservation, UTM naming cleanup.

## VM Cloud classification v1 결과

source: VM Cloud SQLite `attribution_ledger`
window: 2026-05 monthly KST
freshness: 2026-05-14 01:28 KST
confidence: B

| class | touchpoint | rows | bridge key present | budget ROAS |
| --- | --- | ---: | ---: | --- |
| naver_brandsearch | checkout_started | 229 | 175 | 제외 |
| naver_brandsearch | payment_success | 100 | 100 | 제외 |
| paid_naver | checkout_started | 297 | 77 | 제외 |
| paid_naver | payment_success | 59 | 59 | 제외 |
| organic_naver_candidate | checkout_started | 70 | 70 | 제외 |
| organic_naver_candidate | payment_success | 39 | 39 | 제외 |
| naver_referrer_or_utm_only | checkout_started | 29 | 27 | 제외 |
| naver_referrer_or_utm_only | payment_success | 17 | 17 | 제외 |

해석:

- `/total` 기존 표시의 “네이버 검색 referrer 144건 제외”는 API item slice 기준이다.
- VM Cloud SQLite 전체 aggregate는 더 많은 네이버 흔적을 보여준다.
- 그래서 다음 운영 반영에서는 `/api/attribution/ledger` item slice가 아니라 aggregate query 기반 Naver evidence endpoint 또는 monthly evidence dry-run contract를 써야 한다.

## UTM naming audit

`utm_present_but_invalid_rule` 상위 후보:

| candidate | orders | revenue | recommended rule |
| --- | ---: | ---: | --- |
| topbanner_mo | 9 | 2,278,179원 | unknown_utm_invalid |
| kakao / plus | 7 | 1,868,783원 | kakao_reference |
| newmember_coupon | 6 | 1,652,500원 | unknown_utm_invalid |
| kakao / brand-message | 26 | 1,310,992원 | kakao_reference |
| youtube_biocom_dangdangcare_badhabit | 11 | 844,731원 | paid_google_reference |

이번 패치:

- backend dry-run에서 `utmInvalidAudit` aggregate를 추가했다.
- `/total` API에 `evidence.utm_invalid_audit`를 노출했다.
- frontend unknown drilldown에 “UTM 규칙 후보” 표를 추가했다.
- `heavymetal` 같은 단어 안의 `meta`를 Meta 광고로 오판하지 않도록 UTM family token matching을 보강했다.

## 화면 표시 원칙

- `네이버 광고 표식 있음`: `NaPm/n_*` 또는 paid UTM.
- `네이버 브랜드검색 후보`: brandsearch marker.
- `네이버 자연검색 후보`: 검색 referrer + 유료 표식 없음.
- `네이버 referrer만 있음`: 참고용.
- 모든 네이버 후보는 처음에는 “예산 판단 제외/참고용”으로 보여준다.
