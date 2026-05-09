# ReportAuditor HOLD and GTM rules

작성 시각: 2026-05-10 00:30 KST

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - harness/gdn/AUDITOR_CHECKLIST.md
    - docs/report/text-report-template.md
  lane: Green auditor rule proposal
  allowed_actions:
    - auditor rule proposal
    - report template proposal
  forbidden_actions:
    - deploy
    - GTM publish
    - DB write
    - platform send
  source_window_freshness_confidence:
    source: repo-local harness and reporting templates
    window: 2026-05-10 00:30 KST
    site: biocom
    freshness: same-session
    confidence: high
```

## 한 줄 결론

ReportAuditorAgent는 HOLD 자체보다 `HOLD인데 Green follow-up을 안 한 상태`를 잡아야 합니다. GTM 작업에서는 workspace lifecycle 순서 위반을 hard fail로 잡아야 합니다.

## HOLD Reducer 검사 규칙

| 검사 | 판정 | 이유 |
|---|---|---|
| status=HOLD인데 `hold_reason_category` 없음 | WARN | HOLD 원인 없이는 다음 행동이 모호함 |
| status=HOLD인데 `auto_green_followups_done` 없음 | FAIL | Green으로 줄일 수 있는 원인을 바로 TJ님에게 넘길 위험 |
| `TJ님이 할 일`에 read-only/dry-run/문서/로컬 테스트가 포함됨 | WARN | Codex가 할 수 있는 Green 작업을 사람에게 넘김 |
| `approval_required`만 있고 접근/데이터/기술 blocker 분류 없음 | WARN | 승인 부족과 실제 blocker가 섞임 |
| `missing_click_bridge`인데 storage/source audit 또는 join dry-run 없음 | WARN/FAIL | Path B류 HOLD 축소 분석 누락 |
| `ambiguous_candidates`인데 confidence/ambiguous rule 보강 없음 | WARN | 후보 과다를 전송 후보로 오해할 수 있음 |
| `workspace_capacity`인데 workspace list/cleanup/backup plan 없음 | WARN | 같은 GTM quota 문제가 반복됨 |

## GTM lifecycle 검사 규칙

| 검사 | 판정 | 이유 |
|---|---|---|
| GTM Preview인데 workspace capacity preflight 없음 | WARN | `RESOURCE_EXHAUSTED` 반복 가능 |
| Default Workspace 사용 | FAIL | 격리 없는 live tracking 변경 위험 |
| fresh workspace 생성 전 VM Cloud write flag ON | FAIL | 브라우저 트래픽 받을 준비 전 write window가 열림 |
| cleanup 전 workspace JSON backup 없음 | FAIL | rollback/감사 근거 손실 |
| cleanup 후 live version unchanged 확인 없음 | WARN | live 변경 여부 불명확 |
| 승인 없이 submit/create_version/publish 등장 | FAIL | Production publish 또는 version 생성은 별도 승인 대상 |
| Preview 성공을 Production publish 승인으로 표현 | FAIL | Preview와 Production publish는 lane이 다름 |

## 금지선 검사 규칙

| 검사 | 판정 | 이유 |
|---|---|---|
| raw email/phone/order/member_code logging 승인 없이 등장 | FAIL | raw 식별자 잔존 위험 |
| raw request body 저장 또는 response echo | FAIL | hash-only 원칙 위반 |
| `send_candidate=true`가 승인 없이 등장 | FAIL | 전송 후보가 열림 |
| Google Ads/GA4/Meta/TikTok/Naver send path 추가 | FAIL | 외부 플랫폼 오염 |
| NPay click/count를 purchase로 승격 | FAIL | 핵심 ROAS 오염 원인 재발 |

## ReportAuditor 출력 필드 제안

```yaml
auditor:
  verdict: PASS | PASS_WITH_NOTES | FAIL_BLOCKED | NEEDS_HUMAN_APPROVAL
  hold_reducer:
    status_is_hold: true
    hold_reason_category: missing_click_bridge
    auto_green_followups_done:
      - order_bridge_paid_click_join_dry_run
      - click_storage_source_audit
    remaining_blocker: same_browser_preservation_not_verified
    tj_action_required: false
  gtm_workspace_lifecycle:
    default_workspace_used: false
    capacity_preflight_done: true
    fresh_workspace_created: true
    backup_before_cleanup: true
    live_version_unchanged: true
    submit_create_version_publish_count: 0
    vm_cloud_write_flag_on_after_workspace_ready: true
  forbidden_actions:
    raw_logging_detected: false
    platform_send_detected: false
    send_candidate_true_detected: false
```

## gpt0508-18에 대한 auditor 적용 예

- status: HOLD for click bridge.
- hold_reason_category: `missing_click_bridge`.
- auto_green_followups_done:
  - `order_bridge_paid_click_join_dry_run`.
  - `click_storage_source_audit`.
  - `next_action_decision`.
- remaining blocker: `same_browser_preservation_not_verified`.
- verdict: PASS_WITH_NOTES.
- 이유: Green follow-up은 수행했고, 남은 실제 브라우저/Preview flow는 다음 승인 또는 실행 batch로 분리됨.

## 구현 단계 제안

1. 문서 규칙부터 적용합니다.
2. 이후 `scripts/harness-preflight-check.py` 또는 별도 `scripts/report-auditor-check.py`에 grep 기반 1차 검사를 추가합니다.
3. 자동 검사 전까지는 `harness/gdn/AUDITOR_CHECKLIST.md` 체크리스트로 사람이 검토합니다.
