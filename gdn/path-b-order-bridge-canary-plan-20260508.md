# Path B 1h hash-only order bridge canary 계획

작성 시각: 2026-05-08 20:38 KST
대상: biocom order_bridge_ledger hash-only canary
Status: canary_plan_only__execution_hold_until_preview_pass_and_yellow_approval
Do not use for: backend deploy, operational schema migration, GTM Production publish, platform send

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
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
    - gdn/path-b-email-phone-preview-plan-20260508.md
    - gdn/guest-order-attribution-ledger-design-v2-20260508.md
  lane: Green canary plan writing; Yellow/Red approval required before execution
  allowed_actions:
    - canary plan writing
    - metrics and guardrail design
    - local markdown artifact creation
  forbidden_actions:
    - backend deploy
    - operational schema migration
    - GTM Production publish
    - raw email/phone/member_code storage
    - raw order/payment/value storage
    - platform send
    - Google Ads conversion upload
  source_window_freshness_confidence:
    source: "Path B Preview plan + order_bridge_ledger v2 design + GTM read-only inventory"
    window: "2026-05-08 KST"
    freshness: "2026-05-08 20:38 KST"
    confidence: 0.82
```

## 10초 결론

1시간 canary의 목적은 구매 전송이 아니다. 주문과 클릭을 잇는 hash-only 원장이 실제 주문에서 얼마나 잘 채워지는지 보는 짧은 건강검진이다.

실행은 아직 HOLD다. Preview가 PASS하고, backend/no-send endpoint와 schema/flag 승인이 끝난 뒤에만 1시간으로 제한해 연다.

## 실행 전 의존성

1. Path B Preview PASS.
2. no-send HMAC smoke PASS.
3. `order_bridge_ledger` v2 migration 승인.
4. backend deploy 승인.
5. flag 기본값 off 확인.
6. raw log/body 저장 0 증명.
7. GTM Production publish 또는 대체 삽입 방식 별도 승인.

## feature flag

```text
ORDER_BRIDGE_WRITE_ENABLED=false
ORDER_BRIDGE_WRITE_CANARY_UNTIL=
ORDER_BRIDGE_WRITE_MAX_ROWS=200
ORDER_BRIDGE_PLATFORM_SEND_ENABLED=false
ORDER_BRIDGE_RAW_BODY_LOGGING=false
```

기본값은 모두 안전 쪽이다. canary를 열 때도 `ORDER_BRIDGE_PLATFORM_SEND_ENABLED=false`는 바꾸지 않는다.

## canary window

- 기간: 1시간.
- row cap: 200 rows 또는 1시간 중 먼저 도달하는 조건.
- 대상: biocom.
- mode: hash-only store.
- platform send: 0.
- raw store: 0.

## 저장 허용 값

- `order_no_hash`
- `client_id`
- `ga_session_id`
- `local_session_id_hash`
- `click_id_hash`
- `member_code_hash`
- `email_hash`
- `phone_hash`
- `identity_hash_version`
- `identity_source`
- `capture_stage`
- `pay_type`
- `pg_type`
- `expires_at`
- `dedupe_key`

## 저장 금지 값

- raw email
- raw phone
- raw member_code
- raw order number
- payment key
- payment id
- buyer name
- address
- value
- currency
- raw request body

## 측정할 숫자

- row_count.
- unique_order_no_hash.
- unique_email_hash.
- unique_phone_hash.
- unique_client_id.
- unique_ga_session_id.
- unique_click_id_hash.
- email_hash_fill_rate.
- phone_hash_fill_rate.
- order_no_hash_fill_rate.
- client_session_present_rate.
- guest/member split.
- ambiguous_identity_count.
- duplicate_dedupe_count.
- raw_stored_count.
- platform_send_count.

## reliability 판단

PASS:

- raw_stored_count = 0.
- platform_send_count = 0.
- order_no_hash_fill_rate가 주문 확인에 충분하다.
- email_hash 또는 phone_hash가 의미 있게 채워진다.
- duplicate가 dedupe로 억제된다.

HOLD:

- raw/platform 문제는 없지만 identity fill이 낮다.
- NPay가 thanks page로 충분히 복귀하지 않는다.
- click/session 후보가 부족하다.

FAIL:

- raw 값 저장 또는 logging이 발견된다.
- platform send가 1건 이상 발생한다.
- dedupe 실패로 같은 주문이 과다 적재된다.
- endpoint 5xx가 반복된다.

## 보고 형식

canary 종료 후 보고서는 아래 두 값을 분리한다.

- `수집 건강도`: 원장이 잘 쌓였는지.
- `구매 매칭 개선 효과`: 실제 confirmed purchase uplift가 있는지.

1시간 canary만으로는 uplift를 확정하지 않는다. 다만 hash bridge가 충분히 채워지면 이후 confirmed purchase no-send 후보를 주문별로 검증할 수 있다.

## rollback

1. `ORDER_BRIDGE_WRITE_ENABLED=false`.
2. GTM tag pause 또는 version rollback은 별도 승인 범위에서만 실행.
3. endpoint는 no-send response만 유지.
4. canary rows는 TTL 90일 또는 승인된 cleanup으로만 삭제.

## 지금 결론

이 문서는 실행 계획이다. 이번 작업에서는 canary를 열지 않았다.
