# 03. Dashboard mismatch analysis

## 사람이 이해하는 결론

현재 `/total` 또는 funnel dashboard에서 “CAPI 성공이 confirmed purchase보다 많다”는 현상은 Meta가 이상하게 중복 학습한다는 뜻이 아니다. 가장 큰 원인은 바이오컴 화면에서 더클린커피 Pixel CAPI log까지 같이 세는 집계 버그다.

## Source / Window / Freshness

| 항목 | 값 |
|---|---|
| source | VM Cloud `funnel-health` API + CAPI send log |
| site | biocom |
| checked_at | 2026-05-15 17:04 KST |
| confidence | high for pixel-mix issue, medium for missing queue |

## 1. CAPI success가 actual confirmed보다 많은 이유

Live API 기준:

- 최근 7일 confirmed purchases: 365건 / 98,431,413원.
- 최근 7일 meta_capi_success: 651건.

하지만 CAPI log를 Pixel별로 나누면:

- 바이오컴 Pixel `1283400029487161`: 353건.
- 더클린커피 Pixel `1186437633687388`: 298건.
- 합계: 651건.

즉, 현재 `site=biocom` funnel-health 화면의 `meta_capi_success`가 site별 Pixel 필터 없이 all-pixel CAPI log를 세고 있다.

필요한 수정:

- `site=biocom` → Pixel `1283400029487161`만 집계.
- `site=thecleancoffee` → Pixel `1186437633687388`만 집계.
- channel breakdown에서도 CAPI log를 ledger source/site와 join하지 못하면 `utm_present 기타`로 몰지 않는다.

## 2. Browser Purchase 0의 운영 리스크

현재 Browser Purchase 0은 “Meta가 구매를 전혀 못 받는다”는 뜻이 아니다.

- Server CAPI는 바이오컴 Pixel 최근 24시간 52/52 성공.
- 최근 7일 353/353 성공.
- Ads Manager 최근 7일도 219 구매를 반환한다.

따라서 Browser Purchase 0은 현재 `긴급 장애`가 아니라 `보조 신호/중복제거/Events Manager UI 진단 부족`으로 분리한다.

단, Browser Purchase가 장기적으로 0이면 남는 문제:

- Events Manager에서 Browser/Server dedup 품질을 보기 어렵다.
- 브라우저 직접 이벤트 기반의 실시간 UI 확인이 약하다.
- CAPI 장애 시 fallback이 약하다.

## 3. confirmed but CAPI missing 큐

Live API:

- confirmed eligible unsent: 12건 / 2,385,485원.
- oldest age: 약 1,368분.

Raw target Pixel 대조:

- 최근 24시간 logged_at 기준 target Pixel로 보내지지 않은 confirmed row: 14건 / 3,354,485원.
- sample aggregate에서는 payment_key가 비어 있고 metadata no-send reason이 남아 있지 않았다.

해석:

- 큐 자체는 진짜 경고다.
- 다만 dashboard 12건과 raw 14건은 기준이 다르다. dashboard는 eligibility guard를 한 번 더 적용한 값이고, raw 14건은 단순 target Pixel send 여부 비교다.
- 이 큐는 바로 대량 backfill하지 말고 `payment_key`, Toss/Imweb confirmed, 취소/환불, value guard를 다시 확인해야 한다.

## 4. UTM Breakdown에서 Meta CAPI success 0처럼 보이는 이유

현재 UTM Breakdown:

- Meta 광고 confirmed purchase: 130건.
- Meta 광고 CAPI success: 0건.
- UTM 있음 기타 CAPI success: 651건.

이것은 Meta 광고에 CAPI가 안 갔다는 뜻이 아니라, CAPI success row가 채널별 ledger evidence와 제대로 join되지 않고 `utm_present 기타` bucket으로 빠진다는 뜻이다.

필요한 수정:

- CAPI log `ledger_entry`를 raw order/payment key로 ledger와 join.
- report에는 raw key를 출력하지 않고 safe_ref/channel aggregate만 표시.
- join 실패 시 `no_ledger_match`로 별도 bucket 처리.
- site/pixel filter를 먼저 적용한 뒤 channel classify를 수행.

## 5. metric source 정리

| 화면/숫자 | 현재 의미 | 예산 판단 사용 |
|---|---|---|
| confirmed_purchases | VM Cloud ledger의 실제 결제완료 row | 내부 매출 판단에 사용 가능 |
| meta_capi_success | Meta CAPI send attempt 성공. 현재 all-pixel 혼입 있음 | patch 전 예산 판단 금지 |
| Ads Manager purchase | Meta가 광고에 귀속한 구매 | Meta 예산 판단 참고 가능 |
| Browser Purchase | 브라우저 Pixel Purchase 관측 | 현재 보조 진단용 |
| UTM Breakdown CAPI count | 현재 join/filter 오류 있음 | patch 전 사용 금지 |

## 판정

- `/total` mismatch root cause: site/pixel filter bug + send attempt vs confirmed order 단위 혼합.
- dashboard patch 필요도: 높음.
- 광고 계정/Pixel 교체 필요도: 낮음.
