# 01. Meta Purchase test-only smoke

작성 시각: 2026-05-15 00:32 KST

## 결론

서버 CAPI 경로는 살아 있다. 승인된 Test Events 코드가 붙은 `Purchase` 1건은 Meta가 받았고, 운영 구매 수는 즉시 증가하지 않았다.

## 실행한 것

- 대상 Pixel/Dataset: `1283400029487161`
- 이벤트: `Purchase`
- 전송 방식: Meta Test Events 전용 `test_event_code` 포함
- 전송 수: 1건
- 실제 주문/결제 사용: 0
- 브라우저 `Purchase`: 실행 안 함

## 결과

- HTTP status: 200
- `events_received`: 1
- API message/error: 0
- immediate production `Purchase` delta: 0
- test code raw 저장: 0
- raw order/payment/click/member/email/phone 출력: 0

## 해석

Meta CAPI 전송 통로 자체가 막힌 것은 아니다. 구매 누락의 핵심은 브라우저 `Purchase` 누락과 VM Cloud confirmed bridge/gate 쪽에 더 가깝다.

브라우저 `Purchase`는 test-only 보장이 없으면 실행하면 안 된다. 운영 사이트에서 직접 발화하면 기존 아임웹 FBE/browser Pixel과 중복될 수 있다.

## 근거 파일

- `capivm/biocom-purchase-test-only-smoke-result-20260515.md`
- `data/project/biocom-purchase-test-only-smoke-result-20260515.json`
