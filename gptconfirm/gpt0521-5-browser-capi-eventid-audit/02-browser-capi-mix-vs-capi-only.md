# Browser+CAPI vs CAPI-only

## 핵심 개념

Browser Purchase는 브라우저가 Meta에 직접 구매를 보내는 방식이다.

Server CAPI는 서버가 실제 결제완료로 확인한 구매를 Meta에 보내는 방식이다.

둘을 같이 쓰는 경우 같은 구매를 두 번 보낼 수 있다. 이때 eventID가 같으면 Meta가 같은 구매라고 인식해 하나로 합친다. 이 과정을 dedup이라고 부른다.

## Option A. CAPI-only 유지

판정: 운영 기본값.

장점:

- confirmed Purchase만 전송한다.
- 결제 페이지 artifact, 미입금, unknown, 취소/환불, value mismatch를 서버에서 막을 수 있다.
- 현재 최근 7일 duplicate 0 상태와 잘 맞는다.
- 아임웹 Header/Footer를 더 건드리지 않아도 된다.

리스크:

- Pixel Helper에서 Browser Purchase가 보이지 않아 운영자가 불안할 수 있다.
- 브라우저 쪽 매칭 단서는 적다.

추천:

현재 운영은 CAPI-only 유지가 맞다.

## Option B. Browser Purchase + CAPI 혼합

판정: 조건부 test-only.

장점:

- Meta UI에서 브라우저 구매 신호도 확인할 수 있다.
- 브라우저 fbp/fbc context와 서버 confirmed value를 함께 활용할 수 있다.
- 장기적으로 dedup 품질 확인에 도움이 된다.

리스크:

- Browser eventID와 Server eventID가 다르면 구매가 중복 집계될 수 있다.
- 브라우저가 raw 주문 키를 쓰고 서버가 safe/hash eventID를 쓰면 dedup이 깨질 수 있다.
- Header/GTM/아임웹 코드를 건드릴 가능성이 생긴다.

추천:

운영 상시 적용 전, 완료 페이지 test-only 1건에서 Browser eventID와 Server eventID가 같은지 확인한다.

## Option C. Browser Purchase-only

판정: 비추천.

이유:

- payment-decision timeout, 브라우저 차단, 페이지 이탈에 취약하다.
- 서버 value guard를 우회할 수 있다.
- 이미 Server CAPI가 회복된 상황에서 운영 복구 전략으로 쓸 이유가 작다.

## 최종 추천

현재는 CAPI-only가 운영 기본값이다.

Browser+CAPI는 dedup 검증 실험으로만 남긴다.
