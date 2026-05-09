# total-current v7 구조 적용 제안서

작성 시각: 2026-05-08 23:59 KST
대상 문서: `total/!total-current.md`
작성 목적: `docurule.md` v7 기준으로 정본 문서 구조를 재정렬하기 위한 적용 제안
Lane: Green document proposal
Mode: no-operational-write / no-deploy / no-publish / no-platform-send

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
  lane: Green documentation proposal
  allowed_actions:
    - 정본 구조 제안서 작성
    - 문서 링크 검증
    - gptconfirm 패키징
  forbidden_actions:
    - total/!total-current.md 직접 수정
    - backend 운영 deploy
    - operational schema migration
    - GTM Production publish
    - Imweb production save
    - platform send
    - Google Ads conversion upload
  source_window_freshness_confidence:
    source: "docurule.md v7 + docs/report/text-report-template.md v3 + total/!total-current.md headings"
    window: "2026-05-08 KST"
    freshness: "2026-05-08 23:59 KST"
    confidence: 0.88
```

## 10초 결론

`total/!total-current.md`는 이미 `Phase-Sprint 요약표`, `다음 할일`, `실제 개발 순서`를 갖고 있지만, `Active Action Board`, `Approval Queue`, `Approval History`, `Completed Ledger`가 본문에 섞여 있어 지금 무엇을 먼저 해야 하는지 한눈에 보기가 어렵다.

정본 본문은 아래 3개 섹션으로 압축하는 것이 맞다.

1. `Phase-Sprint 요약표 - 실제 개발 순서 기준`
2. `다음 할일 - Auto Green / Approval Needed / Blocked-Parked`
3. `상세 Sprint 설명 - 각 Sprint별 무엇/왜/어떻게/% 올리려면`

`Active Action Board`는 `다음 할일` 안으로 흡수하고, `Approval History`와 `Completed Ledger`는 부록으로 내린다.

## 현재 구조에서 보이는 문제

1. **실행 순서와 문서 순서가 일부 어긋난다.**
   - 현재 문서에는 `현재 기준`, `실제 개발 순서`, `Active Action Board`, `Approval Queue`가 별도 섹션으로 나뉘어 있다.
   - 대표가 보면 "그래서 지금 할 일은 어디인가"를 여러 섹션에서 다시 조합해야 한다.

2. **완료 기록과 진행 중 판단이 같은 본문 무게로 보인다.**
   - `Completed Ledger`는 중요하지만 의사결정 본문보다 부록 성격이 강하다.
   - 본문에는 아직 움직여야 할 작업과 승인 판단만 남기는 편이 좋다.

3. **Path B 같은 최신 우선순위가 정본 상단에서 충분히 강하게 보이지 않는다.**
   - 현재 Path B bridge는 약 58%이며, 실제 다음 행동은 제한 deploy 또는 tunnel smoke, GTM Preview, evidence 수집이다.
   - 이 내용은 Phase 번호보다 실제 실행 우선순위 기준으로 가장 위에 있어야 한다.

4. **진척률을 올리는 조건이 표준화되어 있지 않다.**
   - 앞으로 각 Sprint에는 "현재 %", "%를 올리려면 해야 할 일", "다음 병목"이 고정으로 들어가야 한다.

## 제안 구조

### 1. Phase-Sprint 요약표 - 실제 개발 순서 기준

본문 첫 표는 Phase 번호순이 아니라 실행 우선순위순으로 둔다.

필수 컬럼:

```md
| Priority | Phase/Sprint | 현재 목표 | 왜 하는가 | 지금 상태 | 현재 진척률 % | %를 올리려면 해야 할 일 | 승인 필요 여부 | Source 문서 |
|---:|---|---|---|---|---:|---|---|---|
```

적용 예시:

```md
| P0 | Phase4-Sprint7 Path B bridge | 주문과 광고 클릭을 안전하게 잇는 hash-only 연결키를 확인한다 | Google Ads가 주장하는 구매와 실제 결제완료 주문의 차이를 줄이려면 주문과 클릭을 1:1에 가깝게 이어야 한다 | 제한 deploy/tunnel smoke와 GTM Preview 승인됨, 실행 중 | 58% | HTTPS no-send endpoint smoke, GTM Preview evidence, reliability dry-run 입력 확보 | YES, Yellow 승인 범위 안 실행 | gdn/path-b-limited-deploy-approval-20260508.md |
| P1 | Phase4-Sprint6 capture health | click intent 수집기가 안정적으로 작동하는지 본다 | 구매 개선 효과를 보기 전 수집 파이프가 살아 있어야 한다 | 24h health audit 문서화됨 | 70% | 24h 재측정 결과를 PASS/HOLD/FAIL로 기록 | NO, Green read-only | gdn/canary-capture-health-24h-20260508.md |
| P2 | Path C member bridge | 회원 주문과 광고 클릭을 member_code_hash로 잇는다 | Path C는 회원 결제에 강하지만 브라우저 member_code source가 현재 보이지 않는다 | HOLD | 35% | member_code source 재발견 또는 backend/client hash 설계 확정 | HOLD | gdn/path-c-member-code-source-discovery-20260508.md |
```

### 2. 다음 할일 - 3개 bucket으로 통합

`Active Action Board`와 `Approval Queue`를 독립 섹션으로 두지 말고, `다음 할일` 안에 흡수한다.

#### Auto Green

승인 없이 에이전트가 진행할 수 있는 일만 둔다.

예시:

- 무엇을 하는가: Preview evidence JSON/Markdown schema를 최신화한다.
- 왜 하는가: 화면 캡처만으로는 dry-run 입력으로 재사용하기 어렵다.
- 어떻게 하는가: `data/path-b-preview-evidence-YYYYMMDD.json`과 `gdn/path-b-preview-result-YYYYMMDD.md`를 같은 필드로 맞춘다.
- 성공 기준: `email_hash_present`, `phone_hash_present`, `order_no_hash_present`, `client_session_present`, `raw_echo_detected`, `platform_send_detected`가 모두 기록된다.
- 실패 시 다음 확인점: GTM Preview 접근권한, no-send endpoint CORS, 결제완료 화면 값 존재 여부.
- 승인 필요 여부: NO, Green.
- 산출물: Preview evidence JSON/Markdown.
- 진척률에 미치는 영향: Path B 58%에서 65~70%로 상승 가능.

#### Approval Needed

TJ님 승인 또는 외부 화면 접근이 필요한 일만 둔다.

예시:

- 무엇을 하는가: GTM fresh workspace에서 Path B Preview tag를 실행한다.
- 왜 하는가: 실제 결제완료 화면에서 email/phone/order/session 후보가 보이는지 확인해야 한다.
- 어떻게 하는가: Default Workspace가 아니라 새 workspace에서만 Preview하고, Production publish는 하지 않는다.
- 성공 기준: no-send endpoint 응답에 hash present가 보이고 raw 값, platform send, storage가 없다.
- 실패 시 다음 확인점: 계정/2FA 접근, 결제완료 화면 scope, endpoint CORS.
- 승인 필요 여부: YES, 이미 gpt0508-3에서 Preview only 승인됨.
- 산출물: `gdn/path-b-gtm-preview-result-20260508.md`.
- 진척률에 미치는 영향: Path B 58%에서 70% 부근으로 상승 가능.

#### Blocked/Parked

운영 저장, publish, 외부 전송처럼 Red/Yellow 미승인 작업은 여기에 둔다.

예시:

- 1h hash-only canary 운영 저장: HOLD. Preview evidence와 smoke PASS 후 별도 Yellow 승인 필요.
- GTM Production publish: HOLD/Red. Preview PASS, rollback plan, monitoring plan 없이는 금지.
- Google Ads conversion upload: NO. confirmed purchase 후보 품질 검증 전에는 금지.

### 3. 상세 Sprint 설명

각 Sprint 상세는 아래 고정 구조를 쓴다.

```md
### PhaseX-SprintY

**이름**:
**현재 목표**:
**왜 하는가**:
**지금 상태**:
**현재 진척률 %**:
**%를 올리려면 해야 할 일**:
**승인 필요 여부**:
**Source 문서**:

#### 무엇

#### 왜

#### 어떻게

#### 성공 기준

#### 실패 시 다음 확인점

#### 금지선
```

## 부록으로 내려야 할 섹션

아래 섹션은 보존하되 본문 의사결정 아래로 내리는 것이 좋다.

- `Approval History / Active Approval Scope`
- `Completed Ledger`
- `Parked / Later`
- `Source / Window / Freshness / Confidence`
- 긴 운영 로그, 세부 명령, 과거 sprint 기록

## 적용 순서 제안

1. **1차 편집: 제목과 섹션 골격만 정리**
   - `Active Action Board`를 삭제하지 말고 `다음 할일`로 병합한다.
   - `Approval History`, `Completed Ledger`는 `부록` 아래로 이동한다.

2. **2차 편집: Phase-Sprint 요약표 재정렬**
   - Path B bridge를 P0 최상단에 둔다.
   - capture health, Path C, Google Ads confirmed purchase 후보, NPay recovery를 실제 실행 순서대로 재배치한다.

3. **3차 편집: 상세 Sprint 설명 보강**
   - 각 sprint마다 `무엇/왜/어떻게/% 올리려면/승인 필요 여부`를 채운다.
   - 오래된 `member_code NOT PII`, raw 저장, 60~80% uplift 실측처럼 오해될 수 있는 표현은 stale/superseded로 표시한다.

4. **4차 검증**
   - `python3 scripts/validate_wiki_links.py total/!total-current.md`
   - `python3 scripts/harness-preflight-check.py --strict`
   - `git diff --check -- total/!total-current.md`

## 이번 제안에서 하지 않은 것

- `total/!total-current.md`를 직접 수정하지 않았다.
- 운영 backend deploy, DB write, GTM publish, 외부 플랫폼 전송은 하지 않았다.
- 기존 Completed Ledger와 Approval History 내용을 삭제하라고 제안하지 않았다. 부록으로 이동하자는 제안이다.

## Codex 의견

이번 구조 변경의 핵심은 "문서를 짧게 만들기"가 아니라 "의사결정에 필요한 순서로 다시 놓기"다. Path B처럼 지금 당장 움직이는 작업은 상단에서 상태와 병목이 보여야 하고, 완료 기록은 참고 부록으로 내려가야 한다.

Auditor verdict: PASS_PROPOSAL_ONLY
Confidence: 88%
