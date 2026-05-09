# Path B order bridge reliability dry-run v2

작성 시각: 2026-05-09 19:21 KST
Status: DESIGN_READY

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
  lane: Green design
  allowed_actions:
    - dry-run design
    - scorecard definition
    - no-send candidate classification
  forbidden_actions:
    - actual send
    - conversion upload
    - raw storage or logging
    - production canary execution
  source_window_freshness_confidence:
    source: gpt0508-15 row and local taxonomy tests
    window: 2026-05-09 19:05-19:21 KST
    freshness: same-session
    site: biocom
    confidence: high
```

## 한 줄 결론

Reliability v2는 click id 유무만 보지 않는다. `order_no_hash`, `email_hash`, `phone_hash`, session key, `click_id_hash`, status taxonomy를 함께 보고 A/B/C/D confidence를 산출한다.

## 입력

Canary row 단위 입력:

- `order_no_hash`
- `email_hash`
- `phone_hash`
- `client_id`
- `ga_session_id`
- `local_session_id_hash`
- `click_id_hash`
- `identity_source`
- `status`
- `duplicate_count`
- `raw_payload_stored`
- `platform_send_count`
- `received_at`

절대 입력하지 않는 값:

- raw email
- raw phone
- raw order number
- raw payment key
- raw member_code
- value/currency

## Confidence rule

| confidence | 조건 | 기본 판단 |
|---|---|---|
| A | `full_bridge` + dedupe 정상 + raw/platform 0 | 강한 후보, 그래도 send_candidate=false |
| B | order + identity + session present, click optional, 중복 낮음 | 검토 후보 |
| C | `identity_only_quarantine` 또는 `session_only_quarantine` | HOLD, 전송 제외 |
| D | key 부족, ambiguous, raw/platform 문제 | do_not_send |

## Status별 처리

| status | reliability 처리 |
|---|---|
| `full_bridge` | A/B 후보로 올리되 실제 전송은 금지 |
| `identity_only_quarantine` | C/HOLD, 후속 order/identity join 검토 |
| `session_only_quarantine` | C/D, session collision 확인 |
| `click_missing_hold` | HOLD, click bridge 없는 이유 분석 |
| `ambiguous` | D, do_not_send |
| `do_not_send` | D, do_not_send |

## Ambiguous rule

아래면 ambiguous로 둔다.

- 같은 order hash에 서로 다른 identity hash가 여러 개.
- 같은 identity hash가 짧은 window 안에 여러 order와 충돌.
- 같은 click hash가 여러 order에 붙고 시간이 겹침.
- duplicate_count가 비정상적으로 증가.

## Dry-run output

필수 출력:

- total_rows.
- status_counts.
- confidence_counts.
- order_hash_fill_rate.
- identity_hash_fill_rate.
- click_hash_fill_rate.
- session_key_fill_rate.
- ambiguous_count/rate.
- raw_stored_count.
- platform_send_count.
- send_candidate_count = 0.
- actual_send_candidate_count = 0.

## 성공 기준

- canary row를 전송 없이 사람이 검토할 수 있다.
- full bridge와 identity-only row를 섞어 말하지 않는다.
- click id missing row를 FAIL로 버리지 않는다.
- `identity_only_quarantine`은 저장하되 전송 후보에서 제외한다.

Auditor verdict: PASS_RELIABILITY_V2_DESIGN
