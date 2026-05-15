# Header Guard v3.1 Cache Key Analysis

작성 시각: 2026-05-15 15:21 KST
범위: Header Guard v3.1 code review + VM Cloud payment-decision request shape aggregate
raw identifier 출력: 0

## 결론

snake_case와 camelCase 이름 자체는 v3.1이 둘 다 읽을 수 있다. 문제는 같은 주문이라도 요청에 들어오는 field set이 다르면 hash source가 달라지는 구조다. 특히 어떤 요청은 `payment_key/order_id`가 있고, 어떤 요청은 없다. v3.1은 이 차이를 cache key에 그대로 넣기 때문에 같은 결제완료 건이 서로 다른 cache key로 갈라질 수 있다.

## 현재 v3.1 key material

현재 `buildHashSource`는 아래 필드를 모두 그대로 넣는다.

```js
{
  site,
  store,
  orderCode,
  orderNo,
  orderId,
  paymentCode,
  paymentKey
}
```

그리고 이 JSON 문자열을 hash해서 sessionStorage key를 만든다.

## VM Cloud 로그에서 본 요청 shape

최근 80건 기준:

| 요청 형태 | 건수 | 특징 |
|---|---:|---|
| camelCase | 47 | 주로 `orderCode/orderNo/paymentCode`, `payment_key` 없음 |
| snake_case | 33 | 일부 요청에 `payment_key/order_id` 포함 |
| payment_key 포함 | 23 | snake_case 계열에 집중 |
| order_id 포함 | 23 | snake_case 계열에 집중 |

같은 브라우저 완료 페이지에서 prefetch와 Purchase attempt가 아래처럼 갈릴 수 있다.

- prefetch: `orderCode + orderNo + paymentCode`
- footer/decision request: `order_code + order_id + order_no + payment_code + payment_key`

이 경우 서버는 같은 구매를 볼 수 있지만, 브라우저 캐시는 서로 다른 키를 쓴다.

## 왜 위험한가

1. allow response가 key A에 저장된다.
2. fetch failure가 key B에 저장된다.
3. Purchase attempt가 key B를 읽으면 cached failure 때문에 Purchase가 막힌다.
4. 사용자가 sessionStorage를 보면 allow가 아니라 `decision_fetch_failed`만 보일 수 있다.

또는 반대로:

1. failure가 먼저 key A에 저장된다.
2. allow response는 key B에 저장된다.
3. Purchase attempt가 key A를 읽으면 allow를 못 본다.

## v3.1.1 canonical key rule

캐시 키는 "field가 많이 들어왔는가"보다 "같은 결제완료 건인가"를 우선해야 한다.

권장 tier:

1. `site + store + orderCode + paymentCode`
2. `site + store + orderCode + normalizedOrderNo`
3. `site + store + paymentCode + normalizedOrderNo`
4. `site + store + paymentKey`
   단, `orderCode/paymentCode`가 없을 때만 사용한다.
5. `site + store + normalizedOrderNo`
6. 마지막 fallback: eventID 기반 임시 key

중요:

- `paymentKey`는 강한 식별자이지만, 한 요청에만 있고 다른 요청에 없으면 cache split을 만든다.
- `orderId`는 표시나 내부 suffix가 붙을 수 있으므로 cache key에서는 normalized order number로 낮춰야 한다.
- raw 값은 sessionStorage key에 직접 저장하지 않고 hash material로만 사용한다.

## pseudo-code

```js
function normalizeOrderNo(value) {
  return safeString(value)
    .replace(/-P\d+$/i, '')
    .replace(/\s+/g, '')
    .toLowerCase();
}

function buildCanonicalHashSource(context) {
  var site = CONFIG.site;
  var store = context.store || CONFIG.store;
  var orderCode = safeString(context.orderCode);
  var paymentCode = safeString(context.paymentCode);
  var normalizedOrderNo = normalizeOrderNo(firstNonEmpty([context.orderNo, context.orderId]));
  var paymentKey = safeString(context.paymentKey);

  if (orderCode && paymentCode) {
    return JSON.stringify({ site, store, tier: 'orderCode_paymentCode', orderCode, paymentCode });
  }

  if (orderCode && normalizedOrderNo) {
    return JSON.stringify({ site, store, tier: 'orderCode_orderNo', orderCode, orderNo: normalizedOrderNo });
  }

  if (paymentCode && normalizedOrderNo) {
    return JSON.stringify({ site, store, tier: 'paymentCode_orderNo', paymentCode, orderNo: normalizedOrderNo });
  }

  if (paymentKey) {
    return JSON.stringify({ site, store, tier: 'paymentKey', paymentKey });
  }

  if (normalizedOrderNo) {
    return JSON.stringify({ site, store, tier: 'orderNo', orderNo: normalizedOrderNo });
  }

  return JSON.stringify({ site, store, tier: 'fallback', eventId: safeString(context.eventId) });
}
```

## 성공 기준

- 같은 결제완료 건은 prefetch와 Purchase attempt에서 같은 safe cache key를 쓴다.
- `payment_key`가 한 요청에만 있어도 key가 갈라지지 않는다.
- failure cache가 allow cache를 덮어쓰지 않는다.
