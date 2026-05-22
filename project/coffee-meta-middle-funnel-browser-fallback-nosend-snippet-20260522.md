# 더클린커피 Meta 중간 이벤트 Browser Fallback No-Send Snippet 후보

작성 시각: 2026-05-22 01:30 KST
기준일: 2026-05-22
문서 성격: 더클린커피 결제 시작 Meta browser fallback 운영 전 no-send 후보
Lane: Green snippet candidate / Red required before Imweb save or actual Meta browser send

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - harness/coffee-data/RULES.md
  required_context_docs:
    - project/coffee-meta-middle-funnel-browser-fallback-comparison-20260522.md
    - project/coffee-imweb-live-smoke-result-20260522.md
    - project/coffee-imweb-full-paste-candidate-20260522.md
  lane: Green
  allowed_actions:
    - no_send_snippet_candidate
    - local_fixture
    - preview_payload_only
  forbidden_actions:
    - Imweb save/publish
    - GTM Production publish
    - fbq production call
    - facebook.com/tr image beacon
    - Meta CAPI enable
    - actual checkout or purchase
    - production DB or VM Cloud SQLite write
  source_window_freshness_confidence:
    source: local snippet candidate + browser no-send smoke
    window: 2026-05-22 01:30 KST
    freshness: after Coffee Imweb replacement and live no-send diagnosis
    confidence: 0.88
```

## 10초 요약

이 후보는 실제 Meta 이벤트를 보내지 않는다. `/shop_payment/`에서 `InitiateCheckout` 후보 payload를 `dataLayer`와 debug console에만 남기는 no-send preview다.

목적은 Coffee 결제 페이지에서 중간 퍼널 이벤트를 만들 조건이 안전한지 먼저 보는 것이다. 실제 `fbq('track')`, `facebook.com/tr`, Meta CAPI, GTM publish, Imweb save는 모두 제외했다.

2026-05-22 10:50 KST TJ님 실제 Pixel Helper에서 상품상세 URL의 `InitiateCheckout` active와 `currency=KRW`, `value=33900.00`이 확인됐다. 이어서 상품상세 CTA 1회성 audit에서 `fbq('track', 'InitiateCheckout')` 1건, `eventID_present=true`가 확인됐다.

따라서 checkout page load 기반 `InitiateCheckout` fallback은 불필요하다. 실제 send로 만들면 중복 위험이 크다. 이 no-send snippet은 `InitiateCheckout 실제 전송 후보`가 아니라 `checkout value/condition 관측용 초안`으로만 보관한다.

`AddPaymentInfo`는 결제수단 선택 조건이 안정적으로 잡힐 때까지 보류한다.

## 후보 파일

- snippet: `scripts/coffee-meta-middle-funnel-browser-fallback-nosend-snippet.js`
- smoke: `scripts/coffee-meta-middle-funnel-browser-fallback-nosend-smoke.mjs`

## 동작 조건

1. URL이 checkout 계열이어야 한다.
   - 허용: `/shop_payment/`, `/shop_order`, `order_form`, `checkout`
   - 차단: `/shop_payment_complete`, `/shop_order_done`, `order_complete`, `payment_complete`
2. `order_code`, `order_no`, 또는 `checkoutId` 중 하나가 있어야 한다.
3. sessionStorage dedupe key로 같은 checkout 후보를 1회만 preview한다.
4. `__seo_checkout_context`와 `__thecleancoffee_click_id_context_v1`를 읽되 raw 값은 출력하지 않는다.
5. 금액 selector에서 value를 읽으면 포함하고, 못 읽으면 `value_status=missing`으로만 남긴다.

## 실제 전송 금지 확인

이 후보는 아래를 호출하지 않는다.

- `fbq`
- `fetch`
- `navigator.sendBeacon`
- `new Image()`
- `facebook.com/tr`
- `att.ainativeos.net`
- GA4/Google Ads/Naver collect URL

남기는 것은 아래뿐이다.

- `window.dataLayer.push({ event: 'coffee_meta_middle_funnel_preview', ... })`
- `window.__THECLEANCOFFEE_META_MIDDLE_FUNNEL_PREVIEW_LAST__`
- debug query가 있을 때만 `console.info`

## Preview payload 정책

```js
{
  event: 'coffee_meta_middle_funnel_preview',
  eventName: 'InitiateCheckout',
  eventID: 'InitiateCheckout.{hash}',
  noSend: true,
  noFbq: true,
  noPixelRequest: true,
  customData: {
    currency: 'KRW',
    value: 33900,
    value_status: 'present',
    checkout_id_present: true,
    order_code_present: true,
    order_no_present: true,
    gclid_present: true,
    gbraid_present: true,
    gad_campaignid_present: true
  }
}
```

raw order code, order no, member code, click id는 payload에 넣지 않는다.

## 검증 결과

실행 명령:

```bash
node --check scripts/coffee-meta-middle-funnel-browser-fallback-nosend-snippet.js
node --check scripts/coffee-meta-middle-funnel-browser-fallback-nosend-smoke.mjs
node scripts/coffee-meta-middle-funnel-browser-fallback-nosend-smoke.mjs
```

결과:

- checkout + value: PASS
- checkout + value missing: PASS
- product page blocked: PASS
- payment complete page blocked: PASS
- checkout without order hint blocked: PASS
- raw order/click/member value leakage: 0
- external request: 0

## 결제 페이지 DOM 조사 결과

병렬 read-only 조사 결과, 실제 cart/session이 없는 fake `/shop_payment/` URL에서는 주문서 금액 DOM이 렌더링되지 않았다. 따라서 지금 결론은 `금액 DOM 없음`이 아니라 `fake checkout 조건에서는 value selector 확정 불가`다.

TJ님 실제 checkout/session에서도 아래 selector count는 0이었다. 즉 명령 실행은 맞았지만 selector 후보가 현재 checkout DOM과 매칭되지 않았다.

추가 콘솔 결과에서는 `#oms-shop-payment` 내부에 `주문 요약`, `총 주문금액`, `33,900원` 텍스트가 함께 렌더링되는 것이 확인됐다. class는 `css-*` 해시형이라 운영 selector로 직접 고정하지 않는다. no-send snippet은 먼저 `#oms-shop-payment`/`main`/`body` 텍스트에서 `총 주문금액` 라벨 뒤 첫 `원` 금액을 읽고, 실패할 때만 class selector fallback을 본다.

현재 no-send 후보의 value selector 우선순위는 아래처럼 정리했다.

1. `#oms-shop-payment text:총 주문금액`
2. `main/body text:총 주문금액`
3. `[data-payment-total]`, `[data-order-total]`, `[data-total-price]`
4. `._payment_total_price`
5. `.total_price`
6. `._cart_main_total_price`
7. `.im-price-result`, `.im-order-price`, `.shop-table > tfoot .payment-info`
8. `.payment-total`, `.order-total`, `.total-price`, `.pay_total .price`, `.order_price .price`

`[class*="payment"][class*="total"]` 같은 넓은 selector는 제거했다. 사업자번호, 주소, 전화번호, 배송 안내 숫자를 결제 금액으로 오인할 수 있기 때문이다.

currency는 `KRW` 고정으로 둔다. value가 안 잡히면 `value: null`, `value_status: missing`, `value_selector: ""`로 남긴다. `value=0`으로 보내는 것은 실제 전송 단계에서도 금지한다.

## 운영 반영 방식 결정

결론은 `InitiateCheckout footer fallback은 진행하지 않는다`다.

Footer fallback은 Imweb footer에 Coffee 전용 browser fallback 코드를 넣는 방식이다. 하지만 상품상세 CTA 클릭에서 `InitiateCheckout`이 이미 정상 1건으로 잡혔다. 같은 이벤트를 checkout page load에서 추가 생성하면 중복 위험이 있다.

따라서 no-send preview도 `실제 send 후보`가 아니라 `checkout page value/condition 관측 후보`로만 다룬다.

GTM Preview는 1순위가 아니다. GTM Preview는 fresh workspace에서 실험하기 좋지만, Coffee의 실제 구조는 Biocom처럼 브라우저 Pixel 흐름과 footer wrapper가 중심이다. GTM에서만 미리보기를 만들면 최종 운영 경로인 Imweb footer, Phase9 wrapper, `fbq` 순서를 충분히 검증하지 못한다.

단, 실제 Imweb footer 저장은 Red Lane이다. no-send라도 운영 사이트 전체 script를 바꾸기 때문이다. GTM Preview는 value selector가 계속 불확실하거나 Tag Assistant로만 확인해야 할 때의 보조 Yellow Lane으로 둔다. Production publish는 여전히 Red Lane이다.

### 결정 요약

- 1순위: `InitiateCheckout` fallback 중단
- 2순위: `SubscribedButtonClick`은 일반 상품 옵션 드롭다운에서도 발생하므로 오탐/노이즈 후보로 분리
- 3순위: `AddPaymentInfo`가 필요한지 결제수단 선택 조건 기준으로 별도 설계
- 4순위: checkout value/condition 관측 no-send가 필요하면 이벤트 이름을 `CheckoutSummaryObserved` 같은 내부 preview명으로 바꿔 재설계
- 보조: selector가 불확실하면 GTM Preview로 DOM/dataLayer만 추가 확인
- 금지: 실제 `fbq('track', 'InitiateCheckout')`, `facebook.com/tr`, Meta CAPI 전송, GTM Production publish

## 붙여넣기 후보

아래 코드는 아직 운영에 붙여넣으면 안 된다. 붙여넣기는 Imweb footer 저장이므로 Red Lane이다.

```html
<script>
// Paste the content of scripts/coffee-meta-middle-funnel-browser-fallback-nosend-snippet.js here
</script>
```

## 다음 판단

1. `InitiateCheckout` footer fallback은 중단한다.
2. `SubscribedButtonClick`은 일반 상품 옵션 드롭다운 오탐/노이즈 후보로 분리한다.
3. `AddPaymentInfo`는 결제수단 선택 또는 결제 버튼 직전 조건이 확인될 때 별도 no-send로 설계한다.
4. checkout 금액 관측이 계속 필요하면 `CheckoutSummaryObserved` 내부 preview로만 재설계한다.
5. 실제 `fbq('track', 'InitiateCheckout')`로 바꾸는 것은 진행하지 않는다.
