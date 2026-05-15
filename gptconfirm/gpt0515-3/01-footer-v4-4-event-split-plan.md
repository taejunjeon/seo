# 01. Footer v4.4 Event Split Plan

작성 시각: 2026-05-15 01:16 KST

## 결론

`/shop_payment/`는 결제완료가 아니라 결제 진행 페이지다. 이 화면에서 VM Cloud `payment_success` endpoint로 보내는 현재 구조는 artifact를 만든다.

footer v4.4는 이벤트를 둘로 나눠야 한다.

- `/shop_payment/` -> `payment_page_seen`
- `/shop_payment_complete`, `/shop_order_done`, `order_complete`, `payment_complete` -> `payment_success`

`payment_page_seen`은 Meta Purchase 후보가 될 수 없다. `payment_success`도 운영DB `PAYMENT_COMPLETE` 또는 Imweb API confirmed status로 닫히기 전에는 Meta Purchase 후보가 될 수 없다.

## 현재 문제

VM Cloud read-only aggregate 기준으로 현재 pending 69건은 모두 같은 패턴이다.

- request path: `/api/attribution/payment-success`
- touchpoint: `payment_success`
- URL pattern: `/shop_payment/`
- snippet: `2026-05-14-biocom-payment-success-click-id-v4-3`
- payment_key/value/transaction_id/order_member: 0건

즉 “결제 페이지에 도달했다”는 사실이 “결제완료 후보”로 저장되고 있다.

## v4.4 route guard

아래 기준으로 route를 나눈다.

```js
var href = String(location.href || '');
var path = String(location.pathname || '');

var isPaymentPage =
  /\/shop_payment\/?/i.test(path) &&
  !/shop_payment_complete|shop_order_done|order_complete|payment_complete/i.test(href);

var isPaymentSuccess =
  /shop_payment_complete|shop_order_done|order_complete|payment_complete/i.test(href);

if (isPaymentPage) {
  sendAttribution('payment_page_seen');
}

if (isPaymentSuccess) {
  sendAttribution('payment_success');
}
```

## event contract

### payment_page_seen

목적: 사용자가 결제 단계에 도달했는지 기록한다. 구매완료가 아니다.

권장 endpoint:

- 기존 `/api/attribution/checkout-context`를 확장하거나
- 신규 `/api/attribution/payment-page-seen` 추가

필수 속성:

- `site`: `biocom`
- `touchpoint`: `payment_page_seen`
- `snippetVersion`: `2026-05-15-biocom-payment-page-seen-v4-4`
- `page_location_class`: `shop_payment`
- click id presence: gclid/gbraid/wbraid/fbclid/fbc/fbp presence only
- GA4 join key presence: client_id/ga_session_id/user_pseudo_id presence
- `order_code_present`: boolean
- `order_no_present`: boolean
- `member_present`: boolean, raw member id 출력 금지
- `selected_payment_method`: safe enum only
- `npay_button_seen`: boolean
- `npay_button_clicked`: boolean
- `scroll_max_percent`: number
- `visible_seconds`: number
- `time_on_page_ms`: number

절대 금지:

- Meta Purchase 후보 생성
- confirmed bridge 후보 생성
- raw order/payment/member/click id report 출력

### payment_success

목적: 완료 URL에서 실제 결제완료 후보를 기록한다. 그래도 정본은 아니다.

필수 조건:

- 완료 URL allowlist를 통과해야 한다.
- amount/order/member/payment key는 완료 URL 또는 아임웹 완료 context에서만 수집한다.
- VM Cloud 저장 후에도 운영DB 또는 Imweb API confirmed status로 닫히기 전까지 pending이다.
- Meta Purchase 후보는 value guard를 통과해야 한다.

## click id restore

click id 복원은 두 이벤트 모두 유지한다.

- `payment_page_seen`: 결제 페이지에서 광고 클릭 정보가 살아 있는지 진단한다.
- `payment_success`: 실제 완료 후보에 광고 클릭 정보를 붙인다.

단, click id가 있다고 해서 구매완료가 아니다. click id는 광고-주문 연결 evidence이고, 결제완료 정본은 운영DB/Imweb confirmed source다.

## backend 개선 옵션

1. 빠른 적용안: 기존 `/api/attribution/checkout-context`에 `touchpoint=payment_page_seen`을 허용한다.
2. 명확한 적용안: 신규 `/api/attribution/payment-page-seen` endpoint를 만든다.
3. 방어 적용안: backend `/api/attribution/payment-success`에서 `/shop_payment/` URL이 들어오면 reject 또는 downgrade한다.

추천은 2 + 3이다.

이유:

- 신규 endpoint는 화면 의미가 명확하다.
- backend downgrade는 footer 실수 재발을 막는 안전장치다.

## 성공 기준

- `/shop_payment/`에서 VM Cloud `payment_success` 신규 row가 0건.
- `/shop_payment/`에서는 `payment_page_seen`만 생성.
- 완료 URL에서는 `payment_success` 생성.
- click id presence는 두 이벤트 모두 보존.
- Meta Purchase 후보는 완료 URL + confirmed bridge + value guard 통과 건만 남음.
- raw id report/chat/telegram/git output 0.

## 실패 조건

- `/shop_payment/`가 계속 `payment_success`로 들어감.
- 완료 URL에서 `payment_success`가 누락됨.
- `payment_page_seen`이 Meta Purchase 후보로 들어감.
- 기존 FBE/browser Pixel 이벤트와 중복 Purchase가 생김.
- raw id가 report나 로그에 노출됨.

## 승인안

### 승인 이름

`Biocom footer v4.4 payment_page_seen / payment_success split`

### TJ님이 실제로 승인/확인할 것

- 아임웹 Footer Block에서 `/shop_payment/`는 결제 페이지 도달 신호로만 보낸다.
- 완료 URL만 결제완료 후보로 보낸다.
- 저장 전 기존 v4.3 코드를 백업한다.

### Codex가 할 것

- v4.4 코드 초안을 작성한다.
- backend downgrade guard 초안을 작성한다.
- local/API smoke plan을 만든다.
- VM Cloud 배포가 필요하면 별도 Yellow 승인안으로 분리한다.

### Codex가 승인 없이 하지 않는 것

- 아임웹 코드 저장.
- VM Cloud backend deploy/restart.
- Meta Purchase 운영 전송.
- GTM publish.
