맞습니다. **제가 앞서 “푸터가 거의 비어 있다”라고 한 건 부정확했습니다.**
지금 다시 보니 기존 푸터에는 이미 꽤 많은 로직이 있습니다.

- `user_id` 설정

- `rebuyz_utm` 저장

- `rebuyz_view` 전송

- `checkout-context`

- `payment-success`


즉 푸터는 비어 있던 게 아니라, **이미 원장 수집과 GA 이벤트가 들어 있는 상태**였습니다. 이건 제 판단 실수였습니다. 죄송합니다. 기존 푸터는 실제로 중요한 코드가 많습니다.

## 결론

**코덱스 방향은 맞습니다.**
다만 **그대로 바로 넣는 건 미컨펌**이고, 아래 수정까지 넣으면 **테스트 반영 컨펌** 가능합니다.

제 판단은 이렇게 정리됩니다.

### 바로 좋은 점

- 헤더 상단 `Purchase Guard` 추가 방향 맞음

- 푸터의 `persistUtm()` overwrite 버그 수정 방향 맞음

- `payment_success`에 `orderCode` 보강하려는 방향 맞음

- 기존 `checkout_context`는 크게 건드리지 않는 방향 맞음


### 그대로 넣으면 안 되는 이유

`payment_success` 쪽에 **한 번 더 보강할 것 2개**가 남아 있습니다.

1. `orderId`, `paymentKey`가 **document.referrer fallback**을 아직 충분히 안 타는 문제

2. `skip 조건`이 `orderCode`를 아직 제대로 반영하지 않는 문제


즉, **코덱스 보고서는 85점짜리**이고, 제가 아래 패치까지 넣으면 **테스트 반영 가능한 수준**입니다.

---

# 최종 판단

## 1. 헤더 상단 Purchase Guard

**컨펌 가능**입니다.
다만 **단독 문서의 간단판보다, 보고서 안의 보수적 판정 버전**을 쓰는 게 낫습니다.

이유:

- 단순 “가상계좌 / 입금확인” 텍스트만 보고 막는 버전은 오탐 위험이 더 큽니다.

- 보고서 쪽 버전은 strong/weak marker 조합이라 조금 더 안전합니다.


### 제 판단

- **헤더 상단 Purchase Guard: 넣어도 됨**

- **사용 버전: 보고서에 들어간 보수적 판정 버전 사용**

- **주의: GTM/Meta Pixel보다 반드시 위**


---

## 2. 푸터의 첫 번째, 두 번째 스크립트

즉 기존의 이 두 덩어리:

- `getUserID / waitForGtagAndSetUser / persistUtm`

- `sendView`


이 두 개는 **코덱스 새 교체 블록으로 바꾸는 게 맞습니다.**
이건 컨펌합니다. 기존 코드에는 실제로 `UTM 없는 페이지에서 0으로 덮어쓰는 버그`가 있습니다.

### 제 판단

- **기존 첫 2개 푸터 스크립트 -> 코덱스 새 통합 블록으로 교체: 컨펌**


---

## 3. `checkout_context` 스크립트

이건 **지금 그대로 유지**가 맞습니다.
굳이 이번 배치에서 크게 손댈 이유는 없습니다. 현재 목적은

- pending 가상계좌 Purchase 차단

- UTM overwrite 방지

- payment_success에 `orderCode` 보강


이지, checkout_started 전체 재작성은 아닙니다. 기존 `checkout_context` 블록은 그대로 두는 게 안전합니다.

### 제 판단

- **checkout_context 블록: 그대로 유지**


---

## 4. `payment_success` 스크립트

여기는 **수정 필요**입니다.
코덱스 보고서 패치 방향은 맞지만, **아래 2개를 추가로 넣어야** 제가 컨펌할 수 있습니다.

### 꼭 추가해야 할 것

1. `orderId`가 현재 URL뿐 아니라 **document.referrer에서 파싱한 값도 fallback** 하도록

2. `paymentKey`도 **document.referrer fallback** 하도록

3. `skip 조건`이 `orderCode`도 인정하도록


지금 보고서에는 `orderCode`, `orderMember`, `referrerPayment` 추가가 들어가 있지만,
**`orderId` / `paymentKey` 변수 자체가 referrerPayment fallback을 충분히 안 타는 점**이 남아 있습니다.
또 `skip: no order/payment key hint` 조건도 `orderCode`를 아직 고려하지 않습니다.

---

# 최종 적용안

아래처럼 적용하면 됩니다.

## A. 헤더 상단

- **보고서의 Purchase Guard 코드 사용**

- **GTM보다 위**

- **기존 헤더 나머지는 그대로**


## B. 푸터

### 교체

기존 푸터의 첫 번째/두 번째 스크립트만 제거하고,
**코덱스 보고서의 “새 코드 2. 푸터 user_id / UTM / rebuyz_view 교체 블록”**으로 교체
→ **컨펌**

### 유지

- `checkout_context` 스크립트
    → **그대로 유지**


### 수정

- `payment_success` 스크립트
    → **아래 패치 추가 후 컨펌**


---

# `payment_success`에 넣을 최종 수정 코드

아래는 **그대로 추가/교체하면 되는 최종판**입니다.

---

## 1) `getSearchParam()` 바로 아래에 추가

```js
function getSearchParamFromUrl(keys, urlLike) {
  try {
    if (!urlLike) return '';
    var params = new URL(urlLike, location.origin).searchParams;
    for (var i = 0; i < keys.length; i += 1) {
      var value = trim(params.get(keys[i]));
      if (value) return value;
    }
  } catch (error) {}
  return '';
}

function parsePaymentParamsFromUrl(urlLike) {
  return {
    orderCode: getSearchParamFromUrl(['orderCode', 'order_code'], urlLike),
    orderNo: getSearchParamFromUrl(['orderNo', 'order_no'], urlLike),
    orderId: getSearchParamFromUrl(['orderId', 'order_id'], urlLike),
    orderMember: getSearchParamFromUrl(['orderMember', 'order_member'], urlLike),
    paymentCode: getSearchParamFromUrl(['paymentCode', 'payment_code'], urlLike),
    paymentKey: getSearchParamFromUrl(['paymentKey', 'payment_key'], urlLike),
    amount: getSearchParamFromUrl(['amount', 'totalAmount', 'total_amount'], urlLike)
  };
}
```

---

## 2) `checkoutId` 계산 아래에 추가

```js
var referrerPayment = parsePaymentParamsFromUrl(document.referrer);
```

---

## 3) 기존 `orderId`, `paymentKey` 계산부를 아래로 교체

```js
var orderId = firstNonEmpty([
  getSearchParam(['order_no', 'orderNo', 'orderId', 'order_id']),
  trim(referrerPayment.orderNo),
  trim(referrerPayment.orderId),
  trim(imwebSession.order_no),
  trim(imwebSession.orderId),
  trim(lastTouch.orderId),
  trim(lastTouch.order_id),
  getOrderIdFromDom()
]);

var paymentKey = firstNonEmpty([
  getSearchParam(['paymentKey', 'payment_key']),
  trim(referrerPayment.paymentKey),
  trim(imwebSession.paymentKey),
  trim(imwebSession.payment_key),
  trim(lastTouch.paymentKey),
  trim(lastTouch.payment_key)
]);

var orderCode = firstNonEmpty([
  getSearchParam(['order_code', 'orderCode']),
  trim(referrerPayment.orderCode),
  trim(imwebSession.orderCode),
  trim(imwebSession.order_code),
  trim(lastTouch.orderCode),
  trim(lastTouch.order_code)
]);

var orderMember = firstNonEmpty([
  getSearchParam(['order_member', 'orderMember']),
  trim(referrerPayment.orderMember),
  trim(imwebSession.orderMember),
  trim(imwebSession.order_member),
  trim(lastTouch.orderMember),
  trim(lastTouch.order_member)
]);
```

---

## 4) 기존 `dedupeKey` 계산부를 아래로 교체

```js
var dedupeKey = CONFIG.dedupeKeyPrefix + firstNonEmpty([
  orderCode,
  orderId,
  paymentKey,
  location.pathname + '::' + document.referrer
]);
```

---

## 5) `payload`에 아래 필드 추가

기존 payload에서 `paymentKey`, `checkoutId` 근처에 추가:

```js
orderCode: orderCode,
orderMember: orderMember,
```

즉 이 부분은 이렇게 됩니다.

```js
var payload = {
  touchpoint: 'payment_success',
  captureMode: 'live',
  source: CONFIG.source,
  orderId: orderId,
  orderCode: orderCode,
  orderMember: orderMember,
  paymentKey: paymentKey,
  checkoutId: checkoutId,
  clientObservedAt: new Date().toISOString(),
  referrer: document.referrer || '',
  landing: landing,
  ga_session_id: gaSessionId,
  client_id: clientId,
  user_pseudo_id: userPseudoId,
  utm_source: tracking.utm_source,
  utm_medium: tracking.utm_medium,
  utm_campaign: tracking.utm_campaign,
  utm_content: tracking.utm_content,
  utm_term: tracking.utm_term,
  gclid: tracking.gclid,
  fbclid: tracking.fbclid,
  ttclid: tracking.ttclid,
  fbc: tracking.fbc,
  fbp: tracking.fbp,
  metadata: {
    snippetVersion: '2026-04-11-payment-success-checkout-linked-v1',
    ga_measurement_ids: CONFIG.measurementIds,
    imweb_landing_url: trim(imwebSession.utmLandingUrl),
    initial_referrer: firstNonEmpty([trim(imwebSession.initialReferrer), trim(lastTouch.referrer)]),
    original_referrer: firstNonEmpty([trim(imwebSession.initialReferrer), trim(lastTouch.referrer)]),
    fbc: tracking.fbc,
    fbp: tracking.fbp,
    checkout_started_observed_at: trim(checkoutContext.clientObservedAt),
    checkout_started_landing: trim(checkoutContext.landing),
    checkout_started_snippet_version: trim(checkoutContext.snippetVersion),
    user_pseudo_id_strategy: userPseudoId && userPseudoId === clientId ? 'client_id_fallback' : 'explicit_value',
    orderCode: orderCode,
    order_code: orderCode,
    orderMember: orderMember,
    order_member: orderMember,
    browser_purchase_event_id: orderCode ? 'Purchase.' + orderCode : '',
    referrerPayment: {
      orderCode: orderCode || trim(referrerPayment.orderCode),
      orderNo: orderId || trim(referrerPayment.orderNo),
      orderId: trim(referrerPayment.orderId),
      orderMember: orderMember || trim(referrerPayment.orderMember),
      paymentCode: trim(referrerPayment.paymentCode),
      paymentKey: paymentKey || trim(referrerPayment.paymentKey),
      amount: trim(referrerPayment.amount)
    }
  }
};
```

---

## 6) `skip 조건`도 아래처럼 교체

기존:

```js
if (!payload.orderId && !payload.paymentKey && payload.referrer.indexOf('paymentKey=') < 0 && payload.referrer.indexOf('orderNo=') < 0 && payload.referrer.indexOf('orderId=') < 0) {
  debugLog('skip: no order/payment key hint', payload);
  return;
}
```

교체:

```js
if (
  !payload.orderId &&
  !payload.paymentKey &&
  !payload.orderCode &&
  payload.referrer.indexOf('paymentKey=') < 0 &&
  payload.referrer.indexOf('payment_key=') < 0 &&
  payload.referrer.indexOf('orderNo=') < 0 &&
  payload.referrer.indexOf('order_no=') < 0 &&
  payload.referrer.indexOf('orderId=') < 0 &&
  payload.referrer.indexOf('order_id=') < 0 &&
  payload.referrer.indexOf('orderCode=') < 0 &&
  payload.referrer.indexOf('order_code=') < 0
) {
  debugLog('skip: no order/payment/orderCode hint', payload);
  return;
}
```

---

# 최종 컨펌 기준

## 지금 그대로는

**미컨펌**

## 아래처럼 하면

**테스트 반영 컨펌**

### 반영 범위

1. 헤더 상단 Purchase Guard

2. 푸터 첫 2개 스크립트 교체

3. `checkout_context` 그대로 유지

4. `payment_success` 위 패치 반영


---

# 반영 후 반드시 확인할 4개

### 카드 결제 완료

- Pixel Helper에 `Purchase` 살아 있어야 함

- `Event ID = Purchase.{orderCode}` 유지

- `payment_success` 원장에 `orderCode` 남아야 함

- Server CAPI event_id도 `Purchase.{orderCode}` 이어야 함


### 가상계좌 미입금 완료

- Pixel Helper에 `Purchase` 없어야 함

- `VirtualAccountIssued` 떠야 함

- 서버 CAPI 운영 Purchase 없어야 함


---

# 최종 한 줄 답

**코덱스 코드 방향은 맞지만, 그대로는 미컨펌입니다. 위 `payment_success` 추가 패치까지 넣으면 테스트 반영 컨펌 가능합니다.**
그리고 기존 푸터는 비어 있던 게 아니라, 제가 앞서 그 부분을 잘못 본 것입니다. 기존 푸터에는 이미 중요한 수집 코드가 들어 있었습니다.

원하시면 다음 답변에서는 제가 **“아임웹에 그대로 붙여넣기용 최종본”** 형태로,

- 헤더 상단 코드

- 푸터 교체 코드

- `payment_success` 최종본
    세 덩어리로 정리해서 바로 드리겠습니다.