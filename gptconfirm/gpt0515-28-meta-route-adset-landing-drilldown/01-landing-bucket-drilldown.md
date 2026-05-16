# 2026-05-15 Meta 랜딩 bucket 분해

작성 시각: 2026-05-16 02:30 KST

## 기준

| 항목 | 값 |
|---|---|
| site | biocom |
| Pixel | 1283400029487161 |
| 내부 원장 | VM Cloud SQLite `attribution_ledger` |
| CAPI 로그 | VM Cloud `meta-capi-sends.jsonl` |
| Ads source | Meta Ads Insights API |
| window | 2026-05-15 00:00-23:59 KST |
| 조회 시각 | 2026-05-16 02:27-02:30 KST |
| raw id 출력 | 0 |

## 먼저 답

`내부 ATT ROAS 2.22x`는 Meta 유입 evidence 기반이 맞다. 전체 결제완료 매출을 Meta 성과로 나눈 값이 아니다.

다만 2026-05-15 하루 데이터는 live sync가 계속 보강되면서 snapshot별 숫자가 달라진다.

| 기준 | Meta 후보 구매 | Meta 후보 매출 | Meta spend | 내부 ATT ROAS |
|---|---:|---:|---:|---:|
| gpt0515-27 frozen snapshot | 21건 | 7,764,567원 | 3,500,934원 | 2.22x |
| 2026-05-16 02:30 refresh | 24건 | 8,514,567원 | 3,500,951원 | 2.43x |

## 랜딩 bucket별 결과

아래 표는 최신 refresh 기준이다. 결제완료 이벤트 자체의 URL은 모두 `/shop_payment_complete`에 가깝게 찍히므로, 실제 유입 랜딩 후보는 VM Cloud metadata의 `imweb_landing_url`과 first-touch 후보를 우선 사용했다.

| landing bucket | Meta checkout | payment page seen | confirmed purchase | confirmed revenue | CAPI success | CAPI revenue | 해석 |
|---|---:|---:|---:|---:|---:|---:|---|
| `/shop_payment` | 54 | 68 | 7 | 2,836,067원 | 6 | 2,602,067원 | 원래 랜딩이 보존되지 않고 결제 페이지로 남은 bucket. 추가 first-touch 보강 필요 |
| `/igg_store` | 0 | 12 | 6 | 1,724,500원 | 5 | 1,479,500원 | 리뷰/인플루언서 랜딩 후보. 가장 먼저 실험 대상으로 볼 만함 |
| `/songyuul07` | 0 | 0 | 5 | 1,622,000원 | 4 | 1,388,000원 | 송율 리뷰/공동구매 후보. campaign/adset 매핑이 잘 잡힘 |
| `/hwajung01` | 0 | 0 | 3 | 1,178,000원 | 3 | 1,178,000원 | 화정 리뷰/인플루언서 후보. CAPI 누락 없음 |
| `/shop_view` | 0 | 22 | 2 | 920,000원 | 2 | 920,000원 | 상품 상세/일반 상품 랜딩 후보 |
| `/site_join_type_choice` | 0 | 0 | 1 | 234,000원 | 1 | 234,000원 | 회원가입/쿠폰 흐름 후보 |
| `/shop_cart` | 0 | 16 | 0 | 0원 | 0 | 0원 | 장바구니 진입만 확인, 구매 연결 없음 |

## 리뷰 랜딩 후보 합계

| 후보 묶음 | confirmed purchase | confirmed revenue | CAPI success | CAPI revenue |
|---|---:|---:|---:|---:|
| `/igg_store` + `/songyuul07` + `/hwajung01` | 14건 | 4,524,500원 | 12건 | 4,045,500원 |

## Ads Manager attributed purchase

2026-05-15 Meta Ads Insights read-only 결과는 purchase-family action이 account/ad/campaign level 모두 0이다.

따라서 같은 날짜의 landing bucket별 Ads Manager attributed purchase도 전부 0으로 봐야 한다. 이것은 “landing별 성과가 없다”가 아니라, Ads Manager가 그 날짜에 구매 귀속을 아직 또는 전혀 보여주지 않는다는 뜻이다.

## 중요한 caveat

- `/shop_payment` bucket은 광고 랜딩이 아니라 결제 페이지다. 원래 랜딩이 보존되지 않은 구매가 이 bucket에 들어간다.
- `payment_page_seen`은 결제 완료가 아니라 결제 페이지 진입 진단이다.
- CAPI success는 Meta가 이벤트를 받았다는 뜻이다. Ads Manager가 해당 구매를 광고 성과로 귀속했다는 뜻은 아니다.
