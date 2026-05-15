# 03. Browser Purchase test-only plan

작성 시각: 2026-05-15 00:55 KST

## 결론

Browser Purchase test는 가능하지만 운영 사이트에서 바로 쏘면 안 된다.

전체 Pixel 직접 삽입은 중복 위험 때문에 금지다. 필요한 것은 Meta Test Events 전용 preview-only Purchase 1회와 server CAPI Purchase 1회를 같은 event id로 묶는 dedup smoke다.

## 현재 분리된 사실

- Server CAPI test-only Purchase: PASS. Meta가 `events_received=1`로 받음.
- 운영 Purchase 즉시 증가: 0.
- Browser Purchase: 아직 실행 안 함.
- 기존 FBE/browser Pixel은 PageView/ViewContent/AddToCart/InitiateCheckout를 받고 있음.
- Purchase만 browser/server 모두 표시가 약함.

## test-only 조건

아래가 모두 닫히기 전에는 browser Purchase를 실행하지 않는다.

1. Meta Test Events 화면에서 브라우저 이벤트가 test-only로 분리되는 방식 확인.
2. 운영 이벤트 개요 Purchase count pre/post delta 0 확인 가능.
3. 실제 주문/결제 페이지가 아닌 preview-only route 사용.
4. browser `eventID`와 server `event_id` 동일.
5. Pixel/Dataset은 `1283400029487161`만 사용.
6. `value`는 테스트 값만 사용.
7. raw order/payment/click/member/email/phone 사용 0.

## 권장 실행 흐름

1. Meta Events Manager Test Events 탭에서 테스트 세션을 시작한다.
2. preview-only page를 연다. production checkout/payment page는 사용하지 않는다.
3. browser `fbq('track', 'Purchase', ..., {eventID})`를 1회만 발화한다.
4. 같은 `event_id`로 server CAPI test-only Purchase를 1회만 보낸다.
5. Test Events 화면에서 browser/server가 같은 event id로 묶이는지 확인한다.
6. 운영 Purchase count가 증가하지 않았는지 pre/post 확인한다.

## 판정

`D. BROWSER_PURCHASE_TEST_PATH_READY`는 “설계 준비” 기준으로는 YES다.

실행은 아직 NO다. TJ님 UI 확인 또는 별도 controlled browser smoke 승인이 필요하다.

## 실패 조건

- browser Purchase가 운영 이벤트 개요에 반영됨.
- test-only가 아닌 production Pixel event가 발화됨.
- eventID/event_id가 다르게 들어감.
- 기존 FBE/browser Purchase와 중복 가능성이 생김.
- 실제 주문/결제 페이지에서 발화가 필요해짐.

실패 조건 중 하나라도 있으면 즉시 중단하고 Pixel 직접 삽입은 계속 금지한다.
