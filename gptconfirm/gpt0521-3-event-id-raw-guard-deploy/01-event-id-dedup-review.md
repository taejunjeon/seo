# Event ID Dedup Review

## 확인한 위험

기존 CAPI `event_id`는 구매 이벤트에서 주문 코드 기반 문자열을 만들 수 있다. 이 값은 Meta CAPI 로그와 Meta 전송 payload에 남기 때문에 raw order/payment id 정책 관점에서 별도 가드가 필요하다.

## 즉시 해시로 바꾸지 않은 이유

Meta dedup은 Browser Pixel과 Server CAPI가 같은 `event_id`를 쓸 때 작동한다. 서버만 해시 값으로 바꾸고 브라우저가 기존 raw 기반 eventID를 쓰면 같은 주문이 서로 다른 이벤트로 보일 수 있다.

## 안전한 전환 순서

1. 서버에 해시 event_id 기능을 OFF 상태로 배포한다.
2. payment-decision 또는 completion context에서 브라우저가 서버 생성 safe event_id를 받을 수 있게 한다.
3. 브라우저 Purchase가 같은 safe event_id를 쓰는지 test-only로 확인한다.
4. 그 뒤 `META_CAPI_ENABLE_EVENT_ID_HASH=true`와 secret을 켠다.

## 현재 결론

운영 CAPI 회복 상태를 유지하려면 이번 배포에서는 flag OFF가 맞다. hashed event_id 전환은 dedup 테스트 후 진행한다.
