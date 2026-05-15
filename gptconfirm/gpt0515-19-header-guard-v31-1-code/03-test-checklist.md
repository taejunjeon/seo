# Header Guard v3.1.1 Test Checklist

작성 시각: 2026-05-15 15:40 KST

## 적용 직후 기본 확인

1. Chrome Console에서 설치 버전을 확인한다.

```js
window.__BIOCOM_SERVER_PAYMENT_DECISION_LAST__
```

기대:

- `snippetVersion`에 `v3-1-1`이 보인다.
- raw order/payment 값은 확인 화면에 붙여넣지 않는다.

2. sessionStorage key를 확인한다.

```js
Object.keys(sessionStorage).filter(function (key) {
  return key.indexOf('__biocom_payment_decision_guard_v311__') === 0;
});
```

기대:

- v3.1.1 prefix key가 생긴다.
- key 안에 raw 주문/결제값이 직접 보이지 않는다.

## 실제 결제완료 페이지 테스트

Chrome Network 필터:

```text
payment-decision
```

기대:

- Status 200.
- response body에 `allow_purchase`가 보이면 정상.
- canceled가 나도 sessionStorage에 `decision_fetch_failed`가 2분 TTL로 남으면 안 된다.

Chrome Network 필터:

```text
facebook.com/tr
```

기대:

- 실제 결제완료에서 `ev=Purchase` 1회.
- 같은 이벤트가 여러 번 나오면 중복 위험이다.

## 미입금/가상계좌 테스트

기대:

- `ev=Purchase` 0.
- 필요 시 `VirtualAccountIssued` 또는 `PurchaseDecisionUnknown`만 보인다.
- `allow_purchase`가 나오면 즉시 원복 검토.

## failure cache 확인

아래 값이 보이면 실패다.

```text
decision.reason = decision_fetch_failed
expiresAt = 현재 시각보다 약 2분 뒤
```

v3.1.1에서는 fetch failure가 장기 cache로 남지 않아야 한다.

## 성공 판정

- confirmed 결제완료: Purchase 1회.
- 미입금/가상계좌: Purchase 0회.
- `decision_fetch_failed` 장기 cache 0.
- Footer/Block 4 기존 AddToCart/InitiateCheckout에는 회귀 없음.

## 실패 시 첫 확인점

1. `payment-decision` response body가 `allow_purchase`인지 본다.
2. allow인데 Purchase가 안 나가면 wrapper chain 문제다.
3. decision이 unknown이면 서버 match 또는 completion URL payload 문제다.
4. Network canceled가 있어도 cache가 오염되지 않으면 v3.1.1의 1차 목표는 통과다.
