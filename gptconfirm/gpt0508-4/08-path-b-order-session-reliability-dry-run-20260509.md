# Path B order/session reliability dry-run 결과

작성 시각: 2026-05-09 01:00 KST
대상: biocom Path B 주문완료 화면 bridge
상태: partial pass / row-level no match for this Preview order
Lane: Green read-only dry-run
Mode: no-send / no-write / no-platform-send / no-publish

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
    - docs/report/text-report-template.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - docs/agent-harness/growth-data-harness-v0.md
    - harness/npay-recovery/README.md
    - harness/npay-recovery/RULES.md
    - harness/npay-recovery/VERIFY.md
    - harness/npay-recovery/APPROVAL_GATES.md
    - harness/npay-recovery/AUDITOR_CHECKLIST.md
  lane: Green preview reliability dry-run
  allowed_actions:
    - read-only local artifact analysis
    - preview evidence interpretation
    - no-send/no-write dry-run report
  forbidden_actions:
    - operational schema migration
    - backend operational storage canary
    - GTM Production publish
    - Imweb production save
    - platform send
    - Google Ads conversion upload
  source_window_freshness_confidence:
    source: "Path B actual Preview payload + live VM paid_click_intent_ledger read-only check"
    window: "2026-05-07 23:02 KST - 2026-05-09 00:51 KST ledger + 2026-05-09 00:35 KST Preview"
    freshness: "2026-05-09 01:00 KST"
    confidence: 0.93
```

## 10초 결론

Path B Preview는 실제 주문완료 화면에서 "저장 없이 hash 응답을 받는 것"까지 통과했다.

하지만 이번 payload는 `order_no_hash + client/session`까지만 있다.
`email_hash`, `phone_hash`, `click_id_hash`는 없다.

따라서 Preview availability 판단은 `PASS_ORDER_SESSION_ONLY`다.

다만 VM row-level read-only 확인 결과, 이번 Preview 주문의 client/session 후보는 live paid_click_intent 원장에 0건이었다.
이번 주문 1건 기준 주문-클릭 연결 판정은 `NO_MATCH_FOR_THIS_PREVIEW_ORDER`다.

## 확인된 값

- `response_status=200`
- `response_ok=true`
- `would_store=false`
- `would_send=false`
- `order_no_hash_present=true`
- `client_session_present=true`
- `email_hash_present=false`
- `phone_hash_present=false`
- `click_id_hash_present=false`
- `no_raw_echo_verified=true`
- `no_platform_send_verified=true`
- `platform_send_count=0`

## 현재 의미

이번 결과는 Path B의 가장 중요한 안전 조건을 통과했다.

- 운영 저장 안 함.
- 외부 플랫폼 전송 안 함.
- raw echo 없음.
- 주문번호는 hash로 만들 수 있음.
- client/session도 hash로 만들 수 있음.

다만 광고 클릭 연결력은 아직 증명되지 않았다.

click id가 주문완료 화면에 없기 때문에, 다음 연결은 `client_id`, `ga_session_id`, `local_session_id`로 paid_click_intent 원장과 이어지는지 봐야 한다.

## live paid_click_intent row-level 확인

VM 정본 접속 경로는 `ssh taejun@34.64.104.94`다.
`att.ainativeos.net`은 HTTP tunnel 도메인이라 SSH 대상이 아니다.

2026-05-09 00:53 KST read-only 확인 결과:

- total rows: 1,044건.
- unique click hash: 633개.
- unique client id: 449개.
- unique GA session id: 586개.
- earliest received: `2026-05-07T14:02:15.047Z`.
- latest received: `2026-05-08T15:51:28.110Z`.
- capture stage:
  - landing: 686건.
  - checkout_start: 186건.
  - npay_intent: 172건.

이번 Preview 주문의 key 후보 매칭:

- same client id: 0건.
- same GA session id: 0건.
- same Imweb common session id: 0건.
- same Imweb custom session id: 0건.
- matching click hash: 0건.

## 기존 집계 기준선

이전 18.4h aggregate dry-run 기준:

- paid_click_intent ledger row: 709건.
- unique click id hash: 428개.
- unique client id: 318개.
- unique GA session id: 407개.
- 결제완료 후보 주문: 52건.
- 시간 기반 prior click 후보 median: 329개.
- p90: 644개.
- max: 691개.
- single prior click 주문: 0건.

즉 bridge 없이 시간만으로 붙이면 계속 과대귀속이다.

## dry-run 실행 가능성

row-level read-only join은 실행했다.
이번 Preview 주문 기준으로는 no match다.

이 결과는 Path B 실패가 아니라, 이 테스트 세션이 paid_click_intent ledger에 먼저 잡힌 광고 클릭 세션이 아니었다는 뜻이다.
실제 광고 클릭에서 시작한 세션이 아니면 `click_id_hash_present=false`와 ledger match 0은 정상이다.

그래서 다음 판단은 두 가지다.

1. 실제 paid click session에서 결제완료까지 가는 테스트를 만들거나, click id를 주문완료까지 보존한다.
2. 또는 HURDLERS email-like `user_id`를 raw 저장 없이 server-side HMAC identity source로 추가한다.

## 판정

PASS:

- no-send endpoint 응답.
- order/session hash present.
- no raw echo.
- no platform send.
- no operational storage.

HOLD:

- email/phone identity bridge.
- click id direct bridge.
- confirmed purchase uplift.
- this Preview order's order-click reliability.

FAIL 아님:

- 이번 결과는 실패가 아니다.
- 다만 "주문과 광고 클릭을 확정적으로 연결"하기에는 아직 한 단계 부족하다.

## 다음 판단

우선순위는 카드/NPay 추가 결제가 아니다.

1. 기존 HURDLERS email-like `user_id`를 server-side HMAC-only source로 쓸지 승인안을 분리한다.
2. paid click에서 시작한 실제 테스트 세션을 만들 수 있는지 검토한다.
3. 그 다음에 카드 결제완료 Preview와 NPay return 여부를 본다.

Auditor verdict: PARTIAL_PASS_PREVIEW_AVAILABILITY__ROW_LEVEL_NO_MATCH_FOR_THIS_ORDER
Confidence: 93%
