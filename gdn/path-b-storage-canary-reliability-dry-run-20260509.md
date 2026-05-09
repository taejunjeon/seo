# Path B storage canary reliability dry-run

작성 시각: 2026-05-09 10:35 KST
Status: NOT_RUN_NO_CANARY_ROWS

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
    - data/path-b-storage-canary-20260509.json
  lane: Green dry-run reporting
  allowed_actions:
    - dry-run result writing
    - no-send preview carry-forward scoring
  forbidden_actions:
    - actual send
    - platform send
    - storage canary fabrication
  source_window_freshness_confidence:
    source: "Storage canary precheck result"
    window: "2026-05-09 10:18-10:35 KST"
    freshness: "2026-05-09 10:35 KST"
    confidence: 0.88
```

## 한 줄 결론

canary row가 없으므로 row 기반 reliability dry-run은 아직 실행할 수 없다. Preview 기준 PASS는 유지하지만, 운영 fill rate와 ambiguous rate는 아직 미측정이다.

## 이번 문서가 말하는 것

- storage canary가 실제로 실행되지 않았음.
- 따라서 `order_bridge_ledger` row 기반 A/B/C/D confidence는 아직 0건.
- no-send Preview evidence는 여전히 PASS.
- 다음 병목은 limited storage deploy + schema bootstrap.

## 이번 문서가 말하지 않는 것

- 실제 운영 주문에서 identity/click fill rate가 얼마인지.
- 실제 운영 주문의 ambiguous rate가 얼마인지.
- confirmed purchase uplift가 얼마인지.
- Google Ads에 보낼 후보가 있는지.

## Carry-forward score

- order bridge key: PASS_PREVIEW.
- identity bridge key: PASS_REAL_CHECKOUT_PREVIEW.
- click bridge key: PASS_CONTROLLED_PREVIEW.
- same-browser preservation: PASS_CONTROLLED_PREVIEW.
- storage row count: HOLD_NO_ROWS.
- reliability dry-run ready: HOLD_UNTIL_CANARY_ROWS.
- production publish ready: HOLD.
- actual send ready: NO.

## 다음 reliability 실행 조건

1. `order_bridge_ledger` table exists.
2. `ORDER_BRIDGE_WRITE_ENABLED=true` during approved 1h window.
3. row_count 1~200.
4. raw_stored_count 0.
5. platform_send_count 0.
6. canary rows exported to JSON.

위 조건이 충족되면 다음 dry-run은 아래를 계산한다.

- confidence A/B/C/D.
- ambiguous count/rate.
- order hash fill rate.
- identity hash fill rate.
- click hash fill rate.
- client/session fill rate.
- duplicate dedupe count.

## 현재 판정

- Reliability dry-run status: NOT_RUN_NO_CANARY_ROWS.
- Next action: Path B limited storage deploy approval packet.
