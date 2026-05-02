# TikTok Events API Test Events Runbook

작성 시각: 2026-05-03 KST
Lane: Yellow Lane for execution, Green Lane for this document
상태: 실행 전 runbook. 이번 sprint에서는 실제 TikTok Events API 호출을 하지 않았다.

## 1. Purpose

목적:
- TikTok Events API production send를 켜기 전에, Test Events 전용 코드로 payload 형식, event name, event_id, pixel code, dedup readiness를 확인한다.
- Test Events는 production 최적화 신호로 쓰지 않는다.

이번 문서에서 하는 것:
- 테스트 절차와 payload 초안을 정의한다.

이번 문서에서 하지 않는 것:
- TikTok API 호출
- production send
- GTM publish 변경
- Purchase Guard 변경
- 운영DB write

## 2. Lane and Approval

| 작업 | Lane | 승인 필요 |
| --- | --- | --- |
| runbook 작성 | Green | 불필요 |
| payload dry-run 생성 | Green | 불필요 |
| TJ 관리 Attribution VM에 shadow-only 로컬 테스트 | Yellow | 필요 |
| TikTok Events Manager Test Events 호출 | Yellow | 필요 |
| production Events API send | Red | 별도 명시 승인 필요 |

## 3. Prerequisites

TJ님이 준비할 것:
- TikTok Events Manager에서 해당 Pixel `D5G8FTBC77UAODHQ0KOG` 선택
- Test Events tab 열기
- `test_event_code` 복사
- test 실행 시간 동안 Test Events 화면 유지

Codex가 준비할 것:
- token/secret을 출력하지 않고 env 존재 여부만 확인
- `production_send=false` 확인
- `test_event_code`가 runtime memory 또는 temporary env에만 존재하도록 구성
- payload에 raw PII가 없는지 검사
- event_id가 browser final event_id와 같은지 검사

필요 credential:
- TikTok Events API access token
- Pixel/Event Source code: `D5G8FTBC77UAODHQ0KOG`
- `test_event_code`

## 4. Test Scope

1차 Test Events 후보:
- `Purchase` test event 1건
- event_id: 실제 주문과 충돌하지 않는 synthetic id 또는 별도 테스트 주문의 `Purchase_{order_code}`
- value: 테스트 주문 금액 또는 `1`
- currency: `KRW`
- `test_event_code`: TikTok Events Manager에서 발급받은 값

2차 후보:
- `InitiateCheckout` 1건. 단 browser event_id capture가 먼저 필요하다.
- `AddPaymentInfo`는 browser 발화가 아직 미확인이라 보류한다.
- `PlaceAnOrder`는 soft-deprecated이고 pending Guard와 충돌 가능성이 있어 production 전송 검토 대상에서 제외한다. Test Events에서만 event 수신 여부 확인 가능하다.

## 5. Payload Draft

주의:
- 아래는 검토용 pseudo payload다.
- 실제 endpoint/field shape는 실행 직전 TikTok Business API 최신 문서와 현재 token 권한 기준으로 다시 확인한다.
- `test_event_code`는 production config에 남기지 않는다.

```json
{
  "pixel_code": "D5G8FTBC77UAODHQ0KOG",
  "event": "Purchase",
  "event_id": "Purchase_o20260502test000000",
  "timestamp": 1777737600,
  "test_event_code": "REDACTED_TEST_EVENT_CODE",
  "context": {
    "page": {
      "url": "https://biocom.kr/shop_payment_complete?order_code=o20260502test000000",
      "referrer": "https://biocom.kr/"
    },
    "ad": {
      "callback": "REDACTED_TTCLID_IF_AVAILABLE"
    },
    "user": {
      "ttp": "REDACTED_TTP_IF_AVAILABLE"
    },
    "user_agent": "REDACTED_TEST_BROWSER_UA"
  },
  "properties": {
    "currency": "KRW",
    "value": 11900,
    "content_type": "product",
    "contents": [
      {
        "content_id": "198",
        "content_name": "REDACTED_PRODUCT_NAME",
        "price": 11900,
        "quantity": 1
      }
    ],
    "order_id": "20260502TEST-P1"
  }
}
```

PII guard:
- raw email, raw phone, name, shipping address는 넣지 않는다.
- hashed match key도 이번 Test Events only 1차에서는 제외한다. 나중에 EMQ 개선이 목적일 때 별도 승인한다.

## 6. Execution Steps

1. TikTok Events Manager에서 Test Events tab을 열고 test code를 확인한다.
2. TJ 관리 Attribution VM에서 `production_send=false`와 kill switch off를 확인한다.
3. payload generator를 dry-run으로 실행해 `event`, `event_id`, `pixel_code`, `test_event_code_present=true`, `pii=false`만 확인한다.
4. Test Events only 호출을 1건 실행한다.
5. TikTok Events Manager Test Events tab에서 server event가 보이는지 확인한다.
6. event name이 `Purchase`로 표시되는지 확인한다.
7. event_id가 `Purchase_o...`로 표시되는지 확인한다.
8. payload에 value/currency/order/content가 정상 표시되는지 확인한다.
9. 실행 후 test code를 temporary env에서 제거한다.
10. 실행 결과를 `tiktok/tiktok_events_api_test_events_result_YYYYMMDD.md`로 기록한다.

## 7. Success Criteria

성공:
- Test Events tab에 server-side `Purchase`가 표시된다.
- `event_id=Purchase_{order_code}`가 확인된다.
- value/currency가 정상 표시된다.
- PII 경고가 없다.
- production event data 또는 campaign optimization에 반영되지 않는다.
- test code가 코드/env에 남아 있지 않다.

부분 성공:
- event는 보이나 event_id 또는 parameter warning이 있다.
- 이 경우 production send는 계속 Red Lane 금지다.

실패:
- event가 보이지 않는다.
- token permission denied가 난다.
- pixel code mismatch가 난다.
- event name이 표준 event로 인식되지 않는다.
- PII 또는 policy warning이 난다.

## 8. Rollback

Test Events only는 production send가 아니므로 rollback 범위는 작다.

즉시 조치:
- temporary `test_event_code` 제거
- Events API send job/scheduler 없음 확인
- `TIKTOK_EVENTS_API_SEND_ENABLED=false` 확인
- shadow 후보 ledger가 있으면 test row에 `test_only=true` 표시 또는 삭제 정책 적용

금지:
- 실패를 보정하려고 production send를 켜지 않는다.
- browser Purchase Guard를 변경하지 않는다.
- GTM Production publish를 변경하지 않는다.

## 9. Next Approval Request Template

이름:
TikTok Events API Test Events Only Smoke

허용:
- Test Events tab의 `test_event_code` 사용
- TikTok Events API test-only payload 1~3건 호출
- VM/log read-only 확인
- 결과 문서 작성

금지:
- production send
- scheduler/auto dispatcher
- GA4/Meta/Google send
- GTM publish 변경
- Purchase Guard 변경
- firstTouch strict 승격
- 운영DB PostgreSQL write

TJ님이 할 일:
- Test Events 화면에서 test code를 발급해 전달하거나, 화면 공유 상태에서 Codex가 입력할 수 있게 한다.
- 테스트 중 Test Events tab을 열어두고 표시되는 event를 캡처한다.

Codex가 할 일:
- test-only guard와 payload를 준비한다.
- secret을 출력하지 않는다.
- 1~3건만 호출한다.
- 결과와 실패 원인을 문서화한다.
