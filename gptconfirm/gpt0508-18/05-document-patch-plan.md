# Document patch plan for HOLD Reducer and GTM lifecycle

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
    - harness/gdn/VERIFY.md
    - harness/gdn/APPROVAL_GATES.md
    - harness/gdn/AUDITOR_CHECKLIST.md
  lane: Green patch planning
  allowed_actions:
    - diff plan
    - risk classification
    - validation plan
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

바로 patch할 문서와 proposal로 둘 문서를 분리하는 것이 맞습니다. 공통 자율정책과 GDN 검증 문서는 바로 patch하고, AGENTS/CLAUDE/npay-recovery는 중복을 피하기 위해 최소 변경 또는 proposal 유지가 좋습니다.

## 바로 patch 추천 문서

### 1. `harness/common/AUTONOMY_POLICY.md`

무엇을 추가:

- HOLD Reducer Rule.
- HOLD taxonomy.
- Green follow-up 자동 수행 의무.

왜:

- 에이전트 행동을 직접 바꾸는 핵심 규칙입니다.

리스크:

- 낮음. Green 자동 진행 범위를 명확히 하는 문서 변경입니다.

### 2. `harness/common/REPORTING_TEMPLATE.md`

무엇을 추가:

- `## HOLD Reducer` 필드.
- `auto_green_followups_done`.
- `remaining_blocker`.

왜:

- 보고서가 HOLD를 최종 상태처럼 쓰지 않게 합니다.

리스크:

- 낮음.

### 3. `docs/report/text-report-template.md`

무엇을 추가:

- 대화 출력용 HOLD Reducer 체크.
- GTM Workspace Lifecycle 요약 필드.

왜:

- 최종 답변에서도 같은 기준을 유지해야 합니다.

리스크:

- 낮음.

### 4. `docurule.md`

무엇을 추가:

- `Blocked/Parked`에 넣기 전 Green follow-up 수행.
- HOLD 보고서 필수 필드.

왜:

- 정본 문서와 결과보고서가 같은 구조를 쓰게 합니다.

리스크:

- 중간. 문서가 길기 때문에 중복 문장 삽입 위치를 잘 잡아야 합니다.

### 5. `harness/gdn/RULES.md`

무엇을 추가:

- Path B `missing_click_bridge` 처리 예시.
- `identity_only_quarantine`은 send 후보가 아니라 follow-up 대상임을 명시.

왜:

- 이번 문제의 직접 재발을 막습니다.

리스크:

- 낮음.

### 6. `harness/gdn/VERIFY.md`

무엇을 추가:

- GTM workspace lifecycle 검증 명령/체크.
- live version unchanged, workspace backup, write flag ordering 확인.

왜:

- gpt0508-13 workspace capacity 문제가 반복되지 않게 합니다.

리스크:

- 낮음.

### 7. `harness/gdn/APPROVAL_GATES.md`

무엇을 추가:

- GTM Preview Workspace Gate 상세 조건.

왜:

- Preview 승인이 Production publish 승인으로 오해되지 않게 합니다.

리스크:

- 낮음.

### 8. `harness/gdn/AUDITOR_CHECKLIST.md`

무엇을 추가:

- HOLD Reducer 누락 WARN/FAIL.
- GTM workspace lifecycle hard fail.

왜:

- ReportAuditor가 마지막에 잡을 수 있어야 합니다.

리스크:

- 낮음.

## proposal only 권장 문서

### `AGENTS.md`

상위 원칙 한 줄 추가는 가능하지만, 상세 taxonomy를 넣으면 중복이 커집니다. common 문서 링크 중심이 좋습니다.

### `CLAUDE.md`

Growth Data Bootstrap에 이미 common 문서가 링크되어 있습니다. 상세 규칙 복사는 비추천입니다.

### `docs/agent-harness/growth-data-harness-v0.md`

초기 설계/배경 문서라 현재 운영 규칙을 계속 patch하면 history와 기준판이 섞일 수 있습니다.

### `harness/npay-recovery/*`

NPay recovery는 이미 block 처리 선례가 있습니다. 이번은 GDN/Path B 이슈이므로 공통 rule 정착 후 필요한 부분만 반영합니다.

## 수정 예상 파일

바로 patch 시 예상 파일:

- `harness/common/AUTONOMY_POLICY.md`
- `harness/common/REPORTING_TEMPLATE.md`
- `docs/report/text-report-template.md`
- `docurule.md`
- `harness/gdn/RULES.md`
- `harness/gdn/VERIFY.md`
- `harness/gdn/APPROVAL_GATES.md`
- `harness/gdn/AUDITOR_CHECKLIST.md`

선택적 최소 patch:

- `AGENTS.md`
- `CLAUDE.md`

## 검증 명령

```bash
python3 scripts/validate_wiki_links.py \
  harness/common/AUTONOMY_POLICY.md \
  harness/common/REPORTING_TEMPLATE.md \
  docs/report/text-report-template.md \
  docurule.md \
  harness/gdn/RULES.md \
  harness/gdn/VERIFY.md \
  harness/gdn/APPROVAL_GATES.md \
  harness/gdn/AUDITOR_CHECKLIST.md

python3 scripts/harness-preflight-check.py --strict
git diff --check
```

문서만 변경하면 backend typecheck는 생략 가능합니다.

## 이번 턴의 권장 결정

이번 batch는 proposal 문서로 닫는 것이 좋습니다.

이유:

1. gpt0508-18은 원래 click bridge diagnosis batch입니다.
2. 실제 하네스 정본 patch는 별도 batch로 분리하면 reviewer가 보기 쉽습니다.
3. common 문서와 project 문서를 동시에 바꾸므로, patch batch에는 diff review와 validation을 따로 두는 편이 안전합니다.

다음 batch 추천:

- `gptconfirm/gpt0508-19/`
- 목적: HOLD Reducer + GTM lifecycle actual harness patch.
- 포함: patch result, validation result, before/after summary, manifest.
