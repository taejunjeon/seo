# 03. Test Checklist

작성 시각: 2026-05-15 KST

## 적용 전

1. 아임웹 Header의 기존 `server-payment-decision-guard-v3` script를 복사해 백업한다.
2. Footer Block 3 v4.4.2와 Block 4 v0.4는 수정하지 않는다.
3. Meta Events Manager Test Events 창은 열어두되, Purchase 테스트를 위해 새 주문을 반복하지 않는다.

## 적용 직후 콘솔 확인

```js
typeof fbq
```

기대값:

```text
'function'
```

```js
Object.keys(sessionStorage).filter(function (key) {
  return key.indexOf('__biocom_payment_decision_guard_v31__:') === 0;
})
```

기대값:

```text
결제완료 URL에서는 1개 이상 가능
일반 페이지나 /shop_payment/에서는 없어도 정상
```

## 결제완료 URL 테스트

Network 필터:

```text
payment-decision
facebook.com/tr
```

기대값:

- `payment-decision`: 200
- `payment-decision` type: fetch
- `payment-decision` status: canceled 아님
- `facebook.com/tr`에서 `ev=Purchase` 1회
- `Purchase`가 2회 이상이면 중복 위험

## 미입금/가상계좌 테스트

Network 필터:

```text
facebook.com/tr
```

기대값:

- `ev=Purchase`: 0
- `ev=VirtualAccountIssued`: 1회 이상이면 정상
- `ev=PurchaseDecisionUnknown`: unknown일 때만 허용

## 캐시 경로 테스트

1. 결제완료 URL 진입 후 2분 안에 같은 완료 URL에서 Purchase 시도가 있으면 cached allow를 먼저 쓴다.
2. 2분 뒤에는 cache 만료로 다시 `payment-decision`을 호출한다.
3. 캐시 값에는 원문 주문번호/결제코드가 없어야 한다.

콘솔 확인:

```js
Object.keys(sessionStorage)
  .filter(function (key) { return key.indexOf('__biocom_payment_decision_guard_v31__:') === 0; })
  .map(function (key) { return JSON.parse(sessionStorage.getItem(key)); })
```

허용되는 값:

```text
snippetVersion
cachedAt
expiresAt
safe_ref
source
decision.status
decision.browserAction
decision.reason
decision.matchedBy
decision.confidence
```

금지되는 값:

```text
원문 주문번호
원문 결제코드
원문 결제키
회원 식별자
클릭 ID 원문
```

## Block 4 충돌 확인

장바구니/결제시작 페이지에서 확인한다.

- AddToCart는 Block 4 v0.4가 계속 담당한다.
- InitiateCheckout은 Block 4 v0.4가 계속 담당한다.
- AddPaymentInfo는 Block 4 쪽에서 별도 개선 대상이다.
- Header Guard v3.1은 완료 URL에서 Purchase만 판단한다.

## 롤백 기준

다음 중 하나라도 발생하면 Header Guard v3 hotfix 백업본으로 되돌린다.

- 미입금/가상계좌에서 Purchase 발생
- 결제완료에서 Purchase 2회 이상 발생
- `fbq`가 function이 아니게 됨
- PageView/ViewContent가 사라짐
- `payment-decision`이 계속 4xx/5xx
- sessionStorage에 원문 주문/결제/클릭 ID가 저장됨
