# 네이버페이 Purchase 추적 검토 - 2026-04-12

## 결론

네이버페이는 현재 자사몰 카드/가상계좌처럼 브라우저 헤더 코드로 바로 해결할 수 없다.

2026-04-12 테스트에서 네이버페이 결제 완료 후 최종 URL이 아래처럼 `orders.pay.naver.com`에 머물렀다.

```text
https://orders.pay.naver.com/order/result/mall/2026041289545040
```

이 페이지는 `biocom.kr`이 아니므로 우리가 아임웹 헤더/푸터에 넣은 Meta Pixel Guard, `payment_success` 수집 코드, `checkout_started` 보강 코드가 실행되지 않는다. 실제 테스트에서도 Meta Pixel Helper는 `No Pixels found on this page`, Network에서는 `ev=Purchase`가 없었다.

따라서 네이버페이 Purchase는 **브라우저 Pixel이 아니라 서버 측 CAPI 또는 아임웹 주문 API 기반 후처리로 잡아야 한다.**

## 이번에 확인한 것

### 1. 테스트 주문은 아임웹 주문 캐시에 들어온다

로컬 백엔드에서 biocom 아임웹 주문 sync를 실행했다.

```text
POST /api/crm-local/imweb/sync-orders
site=biocom, maxPage=20
synced=900
biocom totalOrders=8362
lastOrderAt=2026-04-12T02:54:38.000Z
```

테스트 네이버페이 주문도 로컬 `imweb_orders`에 잡혔다.

```text
아임웹 order_no: 202604121410057
아임웹 order_code: o202604127d1a5930ca6e1
네이버페이 channel_order_no: 2026041289545040
pay_type: npay
order_time: 2026-04-12T02:54:38.000Z
payment_time: 2026-04-12T02:55:45.000Z
total_price: 8,900
payment_amount: 11,900
delivery_price: 3,000
```

즉 네이버페이 주문 자체는 아임웹 API로 확인 가능하다. 다만 고객 브라우저가 자사몰 완료 페이지로 돌아오지 않으므로 브라우저 Pixel 이벤트가 비는 것이다.

### 2. 네이버페이 비중은 낮다

로컬 아임웹 캐시 기준 biocom 네이버페이 비중은 아래와 같다.

| 기간 | 전체 주문 | 네이버페이 주문 | 주문 비중 | 네이버페이 상품금액 | 금액 비중 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 최근 7일 | 658 | 43 | 6.53% | ₩6,304,300 | 0.94% |
| 최근 14일 | 1,255 | 83 | 6.61% | ₩12,742,500 | 1.22% |
| 최근 30일 | 2,448 | 145 | 5.92% | ₩24,518,800 | 1.73% |
| 전체 캐시 | 8,362 | 430 | 5.14% | ₩83,891,200 | 2.78% |

최근 7일 기준 금액 비중이 1% 미만이라, 현재 Meta ROAS와 Attribution ROAS가 크게 벌어지는 핵심 원인으로 보기는 어렵다. 네이버페이 누락은 오히려 Meta Browser Purchase를 낮추는 방향의 이슈다.

### 3. 네이버페이 결제 완료 후 자사몰 복귀는 “직접 SDK 결제형”이면 가능하다

공식 네이버페이 개발문서의 단건 결제 SDK 흐름은 결제 완료 후 가맹점의 `returnUrl`로 이동할 수 있다. 문서상 `returnUrl`은 결제 인증 결과를 받을 URL이고, 결제 완료 후 등록된 `returnUrl`로 리다이렉트된다고 설명되어 있다.

참고:

- https://docs.pay.naver.com/en/docs/onetime-payment/onetime-payment-overview/
- https://docs.pay.naver.com/en/docs/onetime-payment/payment/payment-auth-window/

하지만 이번 테스트는 아임웹 네이버페이 주문형 흐름으로 보이며, 실제로 `returnUrl` 기반 자사몰 복귀가 일어나지 않았다. 아임웹 설정에서 네이버페이 완료 후 복귀 URL을 제어할 수 있는 옵션이 없다면, 우리 코드만으로 복귀를 강제하기 어렵다.

## 왜 지금 바로 헤더 코드로 해결할 수 없는가

브라우저 Pixel은 고객 브라우저가 우리 사이트에 있을 때만 작동한다.

현재 네이버페이 흐름은 다음처럼 끝난다.

```text
biocom.kr 상품/결제 시작
-> 네이버페이 결제
-> orders.pay.naver.com/order/result/mall/{네이버페이 주문번호}
-> biocom.kr/shop_payment_complete로 자동 복귀하지 않음
```

따라서 아래 코드는 모두 실행되지 않는다.

- 아임웹 헤더 상단의 Meta Purchase Guard
- 아임웹 푸터의 `checkout_started` / `payment_success` 수집 코드
- `FB_PIXEL.Purchase`
- `fbq('track', 'Purchase')`

네이버페이 완료 페이지 안에 우리 스크립트를 넣을 수 없으므로, 브라우저 단에서 `Purchase`를 만드는 방식은 불가능에 가깝다.

## 현재 CAPI 구조와의 차이

현재 CAPI 자동 동기화는 `payment_success` 원장을 기준으로 한다.

코드 기준:

```text
backend/src/metaCapi.ts
selectMetaCapiSyncCandidates()
조건:
- touchpoint === payment_success
- captureMode === live
- paymentStatus === confirmed
```

즉 현재 CAPI 자동 전송은 “우리 자사몰 결제 완료 페이지에서 수집한 live payment_success”를 본다. 네이버페이는 고객이 자사몰 완료 페이지로 돌아오지 않기 때문에 이 원장에 자연스럽게 들어오지 않는다.

반면 아임웹 주문 캐시에는 네이버페이 주문이 `pay_type=npay`로 들어온다. 따라서 네이버페이용 CAPI는 아래처럼 별도 후보 생성 로직이 필요하다.

```text
imweb_orders에서 pay_type=npay 주문 조회
-> raw_json.payment.payment_time > 0인 주문을 결제 완료로 간주
-> 이미 CAPI 전송한 주문은 제외
-> Meta CAPI Purchase 전송
```

## 지금 할지, 다음에 할지 판단

### 판단: 다음 단계로 넘기는 것이 맞다

이유:

1. 최근 7일 금액 비중이 0.94%라 현재 ROAS 괴리의 핵심 원인이 아니다.
2. 브라우저 헤더/푸터 수정으로 끝나는 작업이 아니다.
3. 서버 CAPI 후보 생성, 중복 방지, attribution touchpoint 연결, event_id 정책이 필요하다.
4. 지금 가장 중요한 작업은 카드/가상계좌 Purchase 정합성 안정화와 CAPI 서버 상시 운영화다.

즉 “간단한 작업이면 지금 처리” 범위는 아니다. 다만 주문 데이터 확인과 설계는 이번에 끝냈다.

## 다음에 구현할 때의 설계

### 1. 아임웹 주문 sync를 안정화한다

현재 수동 sync로 최신 네이버페이 주문은 잡혔다. 운영 반영하려면 최소 15분 또는 30분 주기로 biocom `imweb_orders`를 최신화해야 한다.

필요 조건:

- `pay_type=npay` 주문 수집
- `channel_order_no` 수집
- `raw_json.payment.payment_time` 수집
- `order_code`, `order_no`, `orderer.call`, `orderer.email` 수집

### 2. 네이버페이 CAPI 후보 테이블 또는 로그를 만든다

운영 DB를 직접 바꾸지 않고 로컬/우리 서버 기준으로 아래 중 하나를 둔다.

- `meta_capi_npay_sent` 같은 로컬 dedup 테이블
- 또는 기존 `meta-capi-sends.jsonl` 기반 중복 방지 확장

중복 방지 키는 아래 중 하나가 적합하다.

```text
event_id = Purchase.{order_code}
dedupe_key = npay:{order_code}
fallback_key = npay:{channel_order_no}
```

가장 좋은 기본값은 `Purchase.{아임웹 order_code}`다. 아임웹 주문 캐시에 `order_code`가 안정적으로 들어오기 때문이다.

### 3. 네이버페이 CAPI Purchase를 서버에서 전송한다

전송 조건:

```text
site = biocom
pay_type = npay
raw_json.payment.payment_time > 0
이미 같은 order_code로 CAPI 성공 로그 없음
```

전송값:

```text
event_name: Purchase
event_id: Purchase.{order_code}
event_time: payment_time
event_source_url: 가능하면 마지막 biocom 랜딩/결제 시작 URL
value: 기존 ROAS 기준에 맞춘 상품금액 또는 결제금액
currency: KRW
order_id: order_no
channel_order_no: 네이버페이 주문번호
```

주의할 점:

- `payment_amount`는 배송비가 포함될 수 있다.
- `total_price`는 상품금액 기준에 더 가까워 보인다.
- 기존 Meta/Attribution ROAS의 revenue 기준과 맞춰야 한다.

### 4. 네이버페이 클릭/이탈 지점을 보조 이벤트로 남긴다

네이버페이는 결제 완료 페이지에서 브라우저 이벤트를 남길 수 없으므로, 결제 시작 전 자사몰에서 아래 이벤트를 남기는 것이 좋다.

```text
NPayCheckoutStarted
```

또는 기존 `InitiateCheckout` / `AddPaymentInfo`에 `payment_method=npay`를 붙일 수 있으면 더 좋다.

이렇게 해야 나중에 서버 CAPI Purchase와 결제 전 브라우저 식별자를 묶을 수 있다.

## 리스크

### Attribution 연결 약화

네이버페이 완료 화면에서는 `_fbp`, `_fbc`, `fbclid`, `client_id`를 새로 받을 수 없다. 따라서 결제 직전 자사몰에서 남긴 식별자를 `order_code` 기준으로 저장해 두지 않으면 CAPI 매칭 품질이 낮아질 수 있다.

### 구매 금액 기준 차이

네이버페이 raw data에서는 `total_price`와 `payment_amount`가 다를 수 있다. 예시 테스트 주문은 상품금액 `8,900`, 결제금액 `11,900`, 배송비 `3,000`이다. ROAS 기준을 상품금액으로 볼지 배송비 포함 결제금액으로 볼지 통일해야 한다.

### 주문 상태 기준

네이버페이 주문의 `payment.payment_time`은 430건 모두 들어오지만, `complete_time`은 371건만 들어온다. `complete_time`은 결제 완료라기보다 주문 처리/완료 성격일 가능성이 있으므로 CAPI Purchase 기준으로 쓰면 안 된다. 결제 기준은 `payment.payment_time > 0`이 더 적합하다.

## 다음 액션

### 이번 주 우선순위

1. 카드/가상계좌 Browser Pixel Guard를 현재 v3 기준으로 안정화한다.
2. `payment-decision`과 CAPI sync를 노트북 의존이 아닌 상시 서버로 옮긴다.
3. `payment_success` / `checkout_started` 식별자 품질을 더 올린다.

### 네이버페이 작업 시작 조건

아래 조건 중 하나가 충족되면 바로 착수한다.

- 네이버페이 금액 비중이 최근 7일 기준 3% 이상으로 올라간다.
- 네이버페이 주문이 특정 Meta 캠페인에서 많이 발생한다는 증거가 나온다.
- 카드/가상계좌 CAPI 서버 안정화가 끝난다.
- 아임웹에서 네이버페이 완료 후 자사몰 복귀 URL 설정이 가능하다는 설정 화면을 확인한다.

### 구현 작업 목록

1. `imweb_orders`에서 `pay_type=npay` + `payment.payment_time > 0` 후보 조회 함수 작성.
2. `Purchase.{order_code}` event_id 생성.
3. 기존 `meta-capi-sends.jsonl` 또는 별도 dedup 테이블로 중복 전송 방지.
4. `/api/meta/capi/sync-npay` 또는 기존 sync에 `source=npay_imweb_order` 모드 추가.
5. 테스트 주문 `2026041289545040`은 `test_event_code`로 먼저 수동 전송 검증.
6. 최근 7일 네이버페이 주문에 대해 dry-run 리포트 생성.
7. 문제 없으면 운영 CAPI sync에 포함.

## 현재 판단

네이버페이는 추적 누락이 맞지만, 현재 단계에서 Meta ROAS 과대 문제의 핵심 원인은 아니다. 최근 7일 금액 비중이 0.94%이므로, 지금은 카드 confirmed Purchase와 가상계좌 pending 차단을 마무리하고 CAPI 서버를 안정화하는 것이 우선이다.

네이버페이는 다음 Phase에서 서버 CAPI 보강으로 처리한다. 브라우저 헤더 코드로 해결하려고 시간을 더 쓰지 않는다.
