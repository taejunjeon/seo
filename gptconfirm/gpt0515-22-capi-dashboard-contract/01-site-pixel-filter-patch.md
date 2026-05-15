# Site / Pixel Filter Patch

## 문제

기존 funnel-health contract는 CAPI send log를 site별 Pixel로 자르지 않았다. 그래서 `/total`에서 바이오컴 화면인데도 더클린커피 CAPI success가 합산될 수 있었다.

기준 숫자:
- 바이오컴 Pixel `1283400029487161`: 최근 7일 CAPI success 353
- 더클린커피 Pixel `1186437633687388`: 최근 7일 CAPI success 298
- 잘못 합산된 all-pixel 표시: 651

## 패치

`backend/src/funnelHealth.ts`에 site별 Pixel filter를 추가했다.

```ts
biocom -> 1283400029487161
thecleancoffee -> 1186437633687388
all_sites -> all pixels
```

적용 범위:
- `meta_capi_breakdown`
- `capi_health`
- `series.meta_capi_success`
- `utm_breakdown.meta_capi_success_count`
- `capi_attribution_join`
- `purchase_eligibility_queue`
- `confirmed_but_no_capi_send`

## UTM Breakdown 개선

CAPI log와 VM Cloud attribution_ledger가 조인되지 않는 경우를 `utm_present 기타`로 몰지 않고 `no_ledger_match` bucket으로 분리한다.

이렇게 봐야 한다:
- `meta_capi_success_count`: Pixel-filtered CAPI send success
- `strong_meta_ad_evidence`: fbc/fbclid/Meta UTM/source가 있는 주문
- `non_meta_or_unproven_meta`: fbp만 있거나 Meta 광고 근거가 약한 주문
- `no_ledger_match`: CAPI log와 VM Cloud ledger가 안 붙은 주문

## 운영 반영 전 성공 기준

- `site=biocom&window=7d`의 CAPI success가 651이 아니라 약 353으로 표시된다.
- `site=thecleancoffee&window=7d`의 CAPI success가 약 298로 표시된다.
- `site=all_sites&window=7d`에서만 651 근처 합산값을 허용한다.
- 네이버/구글/기타 UTM이 Meta CAPI success로 섞여 보이더라도 “Meta 광고 귀속”으로 자동 승격하지 않는다.
