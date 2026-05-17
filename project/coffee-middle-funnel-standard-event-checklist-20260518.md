# Coffee Middle Funnel Standard Event Checklist

작성 시각: 2026-05-18 04:55 KST
기준일: 2026-05-18
문서 성격: 더클린커피 중간전환 이벤트 점검표
site: thecleancoffee

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - harness/coffee-data/RULES.md
  lane: Green for checklist, Red for GTM publish or external send
  allowed_actions:
    - read-only GA4/GTM review
    - checklist and approval packet
  forbidden_actions:
    - GTM Production publish without explicit approval
    - Meta CAPI send
    - GA4 Measurement Protocol send
    - 운영DB write
    - VM Cloud deploy
    - raw identifier output
  source_window_freshness_confidence:
    source: GTM Preview + GA4 Realtime API + official event references
    window: 2026-05-18 KST
    freshness: fresh
    confidence: medium_high
```

## 10초 요약

`begin_checkout`는 GA4 Realtime에서 수신이 확인됐다.
다음은 구매 직전 행동을 더 촘촘하게 보는 것이다. 우선순위는 `add_payment_info`, `view_cart/add_to_cart`, `coupon_download`, `sign_up`, `scroll50/page_view_long` 순서다.

## 현재 확인된 것

| 이벤트 | 현재 상태 | 판단 |
|---|---|---|
| `view_item` | GA4 Realtime 수신 확인 | 정상 |
| `page_view_long` | GA4 Realtime 수신 확인 | 정상 |
| `scroll` | GA4 Realtime 수신 확인 | 정상 |
| `begin_checkout` | GA4 Realtime 수신 확인 | 정상 |
| `add_payment_info` | 아직 수신 확인 안 됨 | 보강 후보 |
| `view_cart` | BigQuery/Preview 재확인 필요 | 보강 후보 |
| `add_to_cart` | 기존 태그/Preview 존재 가능, 최근 수신 재확인 필요 | 보강 후보 |
| `coupon_download` | 현재 표준 수신 근거 없음 | 신규 설계 후보 |
| `sign_up` | 현재 수신 근거 없음 | 신규 설계 후보 |

## GA4 기준 추천 이벤트

Google Analytics 4 전자상거래 흐름 기준으로 더클린커피에 우선 필요한 이벤트는 아래다.

1. `view_item`: 상품 상세를 봤다.
2. `add_to_cart`: 장바구니에 담았다.
3. `view_cart`: 장바구니 화면을 봤다.
4. `begin_checkout`: 주문서/결제 시작 화면에 들어갔다.
5. `add_payment_info`: 결제수단을 선택했거나 결제 정보 입력 단계까지 갔다.
6. `purchase`: 실제 결제완료다.
7. `refund`: 취소/환불 보정이다.
8. `sign_up`: 회원가입 완료다.
9. `select_promotion` 또는 custom `coupon_download`: 쿠폰을 받았다.

## Meta 기준 추천 이벤트

Meta 최적화와 리마케팅에 유용한 중간전환은 아래다.

1. `ViewContent`: 상품 상세를 봤다.
2. `AddToCart`: 장바구니에 담았다.
3. `InitiateCheckout`: 주문서/결제 시작 화면에 들어갔다.
4. `AddPaymentInfo`: 결제수단 입력/선택 단계까지 갔다.
5. `CompleteRegistration`: 회원가입을 완료했다.
6. `Search`: 내부 검색을 했다.
7. custom `CouponDownload`: 쿠폰을 받았다.
8. `Purchase`: 실제 결제완료다. 이 이벤트는 반드시 confirmed/value guard 뒤에만 써야 한다.

## 다음 Preview 체크 순서

1. 상품 상세 진입: `view_item`, `ViewContent`, `page_view_long` 확인.
2. 쿠폰받기 클릭: `coupon_download` 또는 `select_promotion` 후보 확인.
3. 장바구니 담기: `add_to_cart`, `AddToCart` 확인.
4. 장바구니 페이지 진입: `view_cart` 확인.
5. 구매하기 클릭 후 주문서 화면: `begin_checkout`, `InitiateCheckout` 확인.
6. 결제수단 선택: `add_payment_info`, `AddPaymentInfo` 확인.
7. 실제 결제완료: `purchase`는 test/confirmed guard 없이 발화 금지.

## 개발 판단

지금 당장 바꿀 필요가 있는 것은 `begin_checkout`이 아니다. 이미 수신된다.
다음 개발 후보는 결제수단 선택 단계와 쿠폰 단계다. 이 둘은 구매 직전 의도가 강해서, 구매 전 선행지표 분석에 가장 도움이 된다.

## 금지선

- `coupon_download`, `add_payment_info`, `scroll50`을 Purchase로 해석하지 않는다.
- Meta Purchase나 GA4 purchase로 직접 전송하지 않는다.
- GTM Production publish는 TJ님 명시 승인 전 하지 않는다.
- raw 주문/결제/회원/click id를 문서에 남기지 않는다.
