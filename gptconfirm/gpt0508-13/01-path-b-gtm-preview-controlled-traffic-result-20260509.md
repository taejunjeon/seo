# Path B GTM Preview controlled traffic result

작성 시각: 2026-05-09 18:34 KST
Status: BLOCKED_GTM_FRESH_WORKSPACE_RESOURCE_EXHAUSTED

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
    - gptconfirm/gpt0508-12/00-result-report.md
  lane: Yellow approved GTM Preview controlled traffic
  allowed_actions:
    - GTM fresh workspace Preview
    - VM Cloud write flag temporary ON
    - one controlled browser row
    - immediate flag OFF cleanup
  forbidden_actions:
    - GTM Production publish
    - GTM submit/create_version
    - Imweb production save
    - 1h storage canary main run
    - external platform send
    - conversion upload
    - raw operational storage or logging
  source_window_freshness_confidence:
    source: "GTM API workspace create attempt + workspace list + VM Cloud summary"
    window: "2026-05-09 18:30-18:34 KST"
    freshness: "2026-05-09 18:34 KST"
    confidence: 0.9
```

## 한 줄 결론

GTM Preview controlled traffic은 실행을 시도했지만, GTM API가 fresh workspace 생성을 `429 RESOURCE_EXHAUSTED`로 거부해 실제 browser row 생성 전 단계에서 막혔다. VM Cloud write flag는 즉시 OFF로 원복했고 row 증가는 없었다.

## 무엇을 시도했나

- VM Cloud `ORDER_BRIDGE_WRITE_ENABLED=true`를 15분 window로 임시 ON.
- `ORDER_BRIDGE_WRITE_MAX_ROWS=5`.
- `ORDER_BRIDGE_PLATFORM_SEND_ENABLED=false`.
- `ORDER_BRIDGE_RAW_BODY_LOGGING=false`.
- GTM fresh workspace 생성 후 주문완료 URL Preview를 열려고 했다.

## 어디서 막혔나

GTM API `workspaces.create` 단계에서 실패했다.

```text
status: 429
error: RESOURCE_EXHAUSTED
message: Resource exhausted
blocked_stage: tagmanager.workspaces.create
```

## 현재 GTM workspace 상태

Read-only inventory:

```json
{
  "count": 3,
  "workspaces": [
    { "id": "164", "name": "agent_os_path_b_user_identity_preview_20260508T163414Z" },
    { "id": "163", "name": "codex_path_b_order_bridge_preview_20260508T151938Z" },
    { "id": "147", "name": "Default Workspace" }
  ]
}
```

해석:

- Default Workspace는 사용하지 않았다.
- 기존 Preview workspace 163/164도 삭제하거나 재사용하지 않았다.
- fresh workspace 조건을 지키려면 TJ님 승인으로 old Preview workspace cleanup 또는 fresh workspace 생성 가능 상태 확보가 필요하다.

## VM Cloud cleanup 결과

최종 상태:

```json
{
  "row_count": 1,
  "raw_stored_count": 0,
  "platform_send_count": 0,
  "duplicate_dedupe_count": 1,
  "write_flag_on": false,
  "write_max_rows": 200,
  "raw_email_log_count": 0
}
```

PM2:

- status: online.
- restart_time: 3830.
- 이번 attempt의 expected restart: 2회, ON/OFF.
- unexpected restart delta: 0.

## 이번 결과 판정

| 항목 | 판정 |
|---|---|
| GTM fresh workspace create | BLOCKED |
| Default Workspace 미사용 | PASS |
| 기존 GTM tag pause/delete 없음 | PASS |
| VM Cloud flag OFF cleanup | PASS |
| row_count delta | 0 |
| raw_stored_delta | 0 |
| platform_send_delta | 0 |
| raw email log delta | 0 |

## 다음 판단

선택지는 2개다.

1. 추천: old Preview workspace 163/164 cleanup을 승인한 뒤 fresh workspace 생성 재시도.
2. 대안: workspace 164 재사용을 별도 승인하고 fresh 조건을 완화한다.

Production publish와 1h storage canary main run은 아직 HOLD다.

Auditor verdict: FAIL_BLOCKED_GTM_RESOURCE_EXHAUSTED_WITH_SAFE_CLEANUP
