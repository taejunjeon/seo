# 네이버 광고 URL 현재값 vs 표준 UTM canary

작성 시각: 2026-05-14 03:00 KST

## 목적

네이버 광고 클릭이 landing, checkout, payment_success까지 같은 first touch로 이어지는지 1개 광고그룹에서만 확인한다. 전체 광고 URL을 한 번에 바꾸지 않는다.

## 현재 확인한 것

source: Naver Search Ad API read-only
checked_at: 2026-05-14 02:55 KST
confidence: 0.87

9개 active 캠페인을 read-only로 확인했다. external write와 platform upload는 0이다.

추천 canary 후보:

- campaign: `바이오컴_파워링크_영양중금속검사`
- adgroup: `01_메인키워드_PC`
- status: campaign/adgroup/ad 모두 eligible 또는 approved.
- 현재 landing: `https://www.biocom.kr/mineraltest_store/` 계열.
- 현재 query key: `idx`만 있음.
- 현재 tracking UTM: 없음.

현재 UTM과 표준 UTM 차이:

| 항목 | 현재 | 표준 canary |
|---|---|---|
| `utm_source` | 없음 | `naver` |
| `utm_medium` | 없음 | `cpc` |
| `utm_campaign` | 없음 | `바이오컴_파워링크_영양중금속검사` |
| `utm_content` | 없음 | `01_메인키워드_PC` |
| `utm_term` | 없음 | `{keyword}` |
| `NaPm` | 네이버 redirect에서 자동 부여될 수 있음 | 유지 확인 대상 |

일부 캠페인은 이미 비표준 UTM이 있다. 예를 들어 `utm_source=naver_cpc_organicacid3_pc`, `utm_medium=naver_cpc_organicacid3_pc`처럼 source와 medium이 같은 값으로 들어간다. 이 방식은 사람이 읽기 어렵고, rule 기반 paid_naver 분류를 어렵게 만든다.

## API 적용 가능 여부

공식 Search Ad API spec 기준 광고 소재 수정 PUT은 `userLock`, `inspect` 필드만 허용한다. 소재의 `pc.final`, `mobile.final` URL은 create payload에는 보이지만 update 필드로는 열려 있지 않다.

따라서 이번 canary는 API로 바로 바꾸지 않았다. 안전한 실행 방식은 네이버 광고 UI에서 1개 광고그룹의 소재 landing URL만 수동 변경하는 것이다.

공식 문서 기준:

- https://naver.github.io/searchad-apidoc/
- swagger source: `assets/json/ncc-heroes-ncc.json`
- 관련 path: `/api/ncc/ads/{adId}{?fields}`

## UI canary 적용안

적용 범위:

- 전체 광고가 아니라 `바이오컴_파워링크_영양중금속검사 / 01_메인키워드_PC` 1개 광고그룹.
- PC/MO final URL 모두 기존 URL을 먼저 백업한다.
- 기존 `idx` 같은 상품/페이지 식별자는 유지한다.
- 표준 UTM만 추가한다.

표준 URL query:

```text
utm_source=naver
utm_medium=cpc
utm_campaign=바이오컴_파워링크_영양중금속검사
utm_content=01_메인키워드_PC
utm_term={keyword}
```

관찰 기간:

- 최소 24시간.
- 권장 72시간.

성공 기준:

- 새 클릭이 VM Cloud `site_landing_ledger`에 UTM/NaPm/n_* 형태로 남는다.
- checkout/payment_success 단계에서도 같은 first touch가 이어진다.
- `/total`에서 paid_naver 후보 또는 naver_brandsearch 후보로 분리된다.
- budget ROAS에는 자동 포함되지 않는다.

실패 조건:

- redirect가 query string을 제거한다.
- NaPm/UTM이 landing 이후 사라진다.
- 기존 전환 추적이 깨진다.
- organic_naver로 오분류된다.

실패 시:

- 백업한 기존 URL로 즉시 원복한다.
- 24시간 window의 `site_landing_ledger`, `attribution_ledger`, `/total` aggregate를 다시 확인한다.

## Backup 방식

현재 API audit JSON은 원문 final URL 대신 origin/path/query key와 UTM 구조만 저장했다. 실제 UI에서 변경 전에는 네이버 광고 화면의 기존 PC/MO URL을 캡처 또는 텍스트로 별도 백업해야 한다.

근거 파일:

- `data/naver-ads-url-canary-audit-20260514.json`
