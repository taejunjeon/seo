# Path B identity-first canary strategy

작성 시각: 2026-05-09 19:21 KST
Status: STRATEGY_UPDATED

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - AGENTS.md
    - docurule.md
    - docs/report/text-report-template.md
  lane: Green documentation plus local implementation
  allowed_actions:
    - strategy update
    - local code/test update
    - no-send/no-platform-send verification
  forbidden_actions:
    - GTM Production publish
    - Imweb production save
    - 1h canary execution
    - platform send
    - conversion upload
    - raw storage or logging
  source_window_freshness_confidence:
    source: gpt0508-15 logged-in browser row, local order bridge tests
    window: 2026-05-09 19:05-19:21 KST
    freshness: same-session
    site: biocom
    confidence: high
```

## 한 줄 결론

Path B canary는 `click_id_hash` 필수 방식이 아니라 identity-first hash-only 방식으로 진행한다. click id가 없는 row는 실패가 아니라 `identity_only_quarantine`으로 저장하고, 후속 dry-run에서 전송 제외 상태로 분류한다.

## 왜 바꾸는가

실제 주문완료 URL에는 광고 click id가 없는 row가 많이 들어올 수 있다.

gpt0508-15 실제 로그인 브라우저 row도 아래처럼 나왔다.

- order hash: present.
- email hash: present.
- client/session: present.
- click id hash: absent.

이 row를 버리면 운영 주문완료 bridge 원장을 충분히 쌓을 수 없다. 지금 목표는 click id가 있는 row만 저장하는 것이 아니라, 주문완료 order bridge 원장을 hash-only로 쌓고 click bridge 유무를 분류하는 것이다.

## 새 원칙

1. `order_no_hash`는 기본 bridge key다.
2. `email_hash` 또는 `phone_hash`는 identity bridge key다.
3. `client_id`, `ga_session_id`, `local_session_id_hash`는 session bridge key다.
4. `click_id_hash`는 있으면 confidence를 올리는 optional key다.
5. `click_id_hash`가 없어도 저장 가능하다.
6. `send_candidate=false`를 유지한다.
7. 외부 플랫폼 전송은 0건이다.
8. raw email/phone/order/member_code/payment는 저장하거나 로그하지 않는다.

## Status taxonomy

| status | 의미 | 기본 처리 |
|---|---|---|
| `full_bridge` | order + identity + session + click 모두 있음 | reliability dry-run에서 A/B 후보 가능 |
| `identity_only_quarantine` | order + identity + session은 있으나 click 없음 | 저장은 하되 전송 후보 제외, 후속 join 검토 |
| `session_only_quarantine` | order + session은 있으나 identity 없음 | 저장은 하되 낮은 confidence로 격리 |
| `click_missing_hold` | click이 없고 identity/session도 충분하지 않음 | 보류, 전송 후보 제외 |
| `ambiguous` | 후보가 여러 개라 primary 결정을 못 함 | do_not_send |
| `do_not_send` | 기본 key 부족 또는 hard fail | 저장/전송 후보 제외 |

## 로컬 구현 반영

로컬 코드에서 `row_status`를 계산하도록 반영했다.

- `backend/src/orderBridgeIdentityHmac.ts`
- `backend/src/orderBridgeLedger.ts`
- `backend/src/routes/attribution.ts`
- `backend/tests/order-bridge-identity-hmac.test.ts`

테스트에 추가한 핵심 케이스:

- 모든 key가 있으면 `full_bridge`.
- click id가 없지만 order + email + session이 있으면 `identity_only_quarantine`.
- response/log/storage raw echo 0.
- platform send 0.

## 성공 기준

- click id 없는 실제 주문완료 row를 버리지 않는다.
- row status로 후속 dry-run 분류가 가능하다.
- `identity_only_quarantine`은 저장되지만 `send_candidate=false`로 유지된다.
- actual send 후보는 0건이다.

Auditor verdict: PASS_STRATEGY_UPDATED_TO_IDENTITY_FIRST
