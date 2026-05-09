# HOLD Reducer Rule proposal

작성 시각: 2026-05-10 00:30 KST

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
    - harness/gdn/RULES.md
    - harness/gdn/AUDITOR_CHECKLIST.md
  lane: Green rule proposal
  allowed_actions:
    - documentation proposal
    - auditor rule proposal
  forbidden_actions:
    - deploy
    - DB write
    - GTM publish
    - platform send
  source_window_freshness_confidence:
    source: repo-local harness documents
    window: 2026-05-10 00:30 KST
    site: biocom
    freshness: same-session
    confidence: high
```

## 한 줄 결론

HOLD는 최종 상태가 아니라 원인 분류가 필요한 중간 상태로 정의해야 합니다. HOLD가 나오면 가능한 Green 분석을 자동으로 끝낸 뒤, 남은 것이 Yellow/Red/권한/사업 판단일 때만 TJ님에게 넘깁니다.

## 새 규칙 이름

`HOLD Reducer Rule`

## 규칙 본문 제안

```md
## HOLD Reducer Rule

HOLD는 최종 상태가 아니다.

결과가 HOLD면 에이전트는 즉시 아래를 수행한다.

1. HOLD 원인을 taxonomy로 분류한다.
2. 실행 가능한 Green follow-up을 식별한다.
3. Green follow-up은 TJ님 확인 없이 자동 수행한다.
4. 자동 수행한 follow-up과 남은 blocker를 보고서에 분리한다.
5. 남은 작업이 Yellow/Red/권한/사업 판단일 때만 TJ님에게 넘긴다.

HOLD 보고서에는 반드시 아래 필드를 둔다.

- hold_reason:
- hold_reason_category:
- auto_green_followups_available:
- auto_green_followups_done:
- remaining_blocker:
- next_lane:
- tj_action_required:
- codex_next_green_action:
```

## HOLD 원인 taxonomy

| hold_reason_category | 의미 | 자동 Green follow-up 예 |
|---|---|---|
| `missing_click_bridge` | 주문 row에 click id가 없거나 paid_click ledger와 exact match가 없음 | storage/source audit, session join dry-run, same-browser preservation 설계 |
| `missing_identity_bridge` | email/member/phone/session 등 identity key가 없음 | available source inventory, no-send HMAC smoke 설계 |
| `ambiguous_candidates` | 후보가 2건 이상이거나 time-window-only 후보가 과다 | confidence rule 보강, last eligible click rule, do_not_send 분류 |
| `workspace_capacity` | GTM workspace 생성 quota/충돌 | workspace list, old preview backup/cleanup plan, live version check |
| `blocked_access` | UI/2FA/API 권한으로 Codex가 직접 접근 불가 | read-only fallback, 필요한 화면/캡처 최소화 |
| `blocked_data` | primary source가 없거나 stale | fallback source query, freshness report, source gap 문서화 |
| `time_waiting` | 24h/72h 등 시간이 아직 안 됨 | 현재까지 가능한 capture health, scheduled runbook 작성 |
| `approval_required` | 남은 작업이 Yellow/Red | 승인안 final packet 작성 |
| `source_freshness_gap` | source window가 낡음 | read-only refresh, stale 표시 |
| `verification_gap` | 검증 명령/fixture/auditor 누락 | validation 실행, raw/log/platform grep |

## 적용 문서별 제안

### AGENTS.md

상위 원칙으로 짧게 추가합니다.

```md
- HOLD 결과가 나오면 바로 TJ님 승인 대기로 넘기지 않는다. 먼저 HOLD 원인을 분류하고, read-only/dry-run/문서/로컬 테스트 등 Green follow-up을 자동 수행한 뒤 남은 blocker만 TJ님에게 넘긴다.
```

### harness/common/AUTONOMY_POLICY.md

가장 중요한 실제 적용 위치입니다.

```md
## HOLD Reducer Rule

HOLD는 최종 보고 상태가 아니라 자동 축소 대상이다.
Green Lane으로 가능한 원인 분석과 후속 dry-run은 TJ님 확인 없이 진행한다.
남은 작업이 Yellow/Red/권한/사업 판단일 때만 TJ님에게 넘긴다.
```

### harness/common/REPORTING_TEMPLATE.md

보고 필드를 추가합니다.

```md
## HOLD Reducer

- hold_reason:
- hold_reason_category:
- auto_green_followups_available:
- auto_green_followups_done:
- remaining_blocker:
- next_lane:
- tj_action_required:
- codex_next_green_action:
```

### docurule.md

`Blocked/Parked` 규칙 아래 추가합니다.

```md
- HOLD는 `Blocked/Parked`에 넣기 전에 Green으로 줄일 수 있는 원인을 먼저 줄인다.
- `Auto Green`으로 가능한 follow-up을 수행하지 않은 HOLD 보고서는 불완전한 보고서다.
- HOLD 보고서에는 `auto_green_followups_done`을 반드시 적는다.
```

### harness/gdn/RULES.md

Path B/GTM 예시를 추가합니다.

```md
## Path B HOLD Reducer

`missing_google_click_id` 또는 `missing_click_bridge`가 나오면 바로 전송 승인 대기로 넘기지 않는다.
먼저 order_bridge to paid_click_intent join dry-run, click storage/source audit, same-browser preservation design을 Green으로 수행한다.
```

### harness/gdn/AUDITOR_CHECKLIST.md

Auditor 검사 항목을 추가합니다.

```md
| HOLD reducer 누락 | status=HOLD인데 auto_green_followups_done이 비어 있으면 soft fail 또는 fail |
| Green 작업을 TJ에게 넘김 | read-only/dry-run/문서/로컬 검증을 TJ님 할 일로 넘기면 soft fail |
```

## 현재 gpt0508-18에 적용한 예

- HOLD 원인: `missing_click_bridge`.
- 자동 Green follow-up:
  - order_bridge to paid_click_intent join dry-run.
  - click storage/source audit.
  - next action decision.
- 남은 blocker:
  - same-browser TEST click preservation은 다음 Preview/no-send flow 필요.
  - 실제 paid-click actual order test는 별도 승인 전 HOLD.

## patch 추천

바로 patch 추천입니다.

- `harness/common/AUTONOMY_POLICY.md`
- `harness/common/REPORTING_TEMPLATE.md`
- `docs/report/text-report-template.md`
- `docurule.md`
- `harness/gdn/RULES.md`
- `harness/gdn/AUDITOR_CHECKLIST.md`

proposal only 권장입니다.

- `AGENTS.md`: 상위 원칙 한 줄만 충분합니다.
- `CLAUDE.md`: common 링크만 충분합니다.
- `docs/agent-harness/growth-data-harness-v0.md`: historical design 성격이라 즉시 patch 우선순위 낮음.
- `harness/npay-recovery/*`: 공통 rule이 정착된 뒤 필요한 경우 반영합니다.
