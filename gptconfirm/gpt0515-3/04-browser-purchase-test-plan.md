# 04. Browser Purchase Test Plan

작성 시각: 2026-05-15 01:16 KST

## 결론

Browser Purchase test는 가능하지만 운영 사이트에서 바로 발화하면 안 된다.

전체 Pixel 직접 삽입은 중복 위험이 크다. 필요한 것은 test-only가 보장된 preview route에서 browser Purchase 1건 이하와 server CAPI test Purchase 1건 이하를 같은 event id로 묶어 보는 dedup smoke다.

## 현재 분리된 사실

- Server CAPI test-only Purchase: PASS.
- Meta response: HTTP 200, `events_received=1`.
- 운영 Purchase 즉시 증가: 0.
- Browser Purchase: 아직 실행 안 함.
- FBE/native browser Pixel은 PageView/ViewContent/AddToCart/InitiateCheckout 계열을 받고 있음.
- Purchase-only 영역은 bridge와 completion signal 설계가 먼저다.

## do not add full pixel

전체 Pixel을 직접 삽입하지 않는다.

이유:

- 아임웹 FBE/native browser Pixel이 이미 존재한다.
- PageView/ViewContent/AddToCart/InitiateCheckout가 browser에서 수집되고 있다.
- 직접 Pixel을 추가하면 중복 Purchase와 중복 funnel event 위험이 크다.
- 지금 문제는 Pixel 전체 부재보다 `/shop_payment/` artifact와 confirmed bridge/value guard 문제다.

현재 판정:

`D. SERVER_CAPI_BRIDGE_AND_EVENT_DESIGN_FIRST`

## controlled test-only design

### option 1. preview-only route

- 로컬 또는 제한 preview page에서만 browser Purchase를 1회 발화한다.
- Meta Test Events code를 사용한다.
- 실제 주문/결제 없음.
- 운영 사이트 checkout/payment page 사용 금지.

### option 2. browser/server dedup pairing

- browser `eventID`와 server CAPI `event_id`를 같은 값으로 만든다.
- browser 1건 이하.
- server 1건 이하.
- Meta Test Events에서 같은 이벤트로 묶이는지 확인한다.
- 운영 Purchase count delta 0을 pre/post로 확인한다.

### option 3. production fallback

현재는 금지한다.

production checkout/payment page에서 Purchase를 직접 발화하면 운영 이벤트 count가 증가하거나 기존 FBE와 중복될 수 있다.

## success criteria

- Test Events에만 표시.
- 운영 이벤트 개요 Purchase count 증가 0.
- browser/server가 같은 event id로 dedup 또는 paired 확인.
- Pixel/Dataset은 `1283400029487161`.
- raw order/payment/click/member/email/phone 사용 0.
- 실제 주문/결제 0.

## failure criteria

- test_event_code 없이 Purchase send.
- 운영 Purchase count 증가.
- production page에서 browser Purchase 발화 필요.
- eventID/event_id mismatch.
- 기존 FBE/native Pixel Purchase와 중복 가능성.

## approval packet

### 승인 이름

`Biocom Meta Browser Purchase test-only dedup smoke`

### TJ님이 승인/확인할 화면

- Meta Events Manager > Pixel/Dataset `1283400029487161` > Test Events.
- 운영 이벤트 개요 Purchase count pre/post.

### Codex가 할 것

- preview-only script/payload를 만든다.
- server CAPI test payload와 같은 event id를 사용한다.
- raw id 없는 결과 보고를 작성한다.

### Codex가 승인 없이 하지 않는 것

- 운영 Purchase send.
- production checkout/payment page browser Purchase 발화.
- 아임웹 footer/header 저장.
- GTM publish.
- Pixel 전체 직접 삽입.

## fast-track priority

1. footer v4.4 event split.
2. value guard patch.
3. payment_page_seen data contract.
4. Browser Purchase test-only.
5. confirmed bridge backfill approval.

Browser Purchase test는 4순위다. 먼저 결제 페이지 artifact를 막아야 한다.
