작성 시각: 2026-05-21 15:52 KST
기준일: 2026-05-21
문서 성격: Harness 의견서 / 자율 실행 운영 원칙 결정 메모

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - harness/jdisession.md
  required_context_docs:
    - docurule.md
    - "harness/claude code (desktop) 강의-bkit v1.1.pptx"
  lane: Green
  allowed_actions:
    - read_only_document_review
    - pptx_text_extraction
    - opinion_document_creation
    - local_validation
  forbidden_actions:
    - production_db_write
    - vm_cloud_db_write
    - gtm_publish
    - backend_deploy_or_restart
    - ad_platform_send_or_upload
    - destructive_file_or_git_operation
  source_window_freshness_confidence:
    source: local_repo_docs_and_pptx
    window: 2026-05-21 review
    freshness: 2026-05-21 15:52 KST
    confidence: 0.9
```

# 10초 요약

TJ님 방향이 맞다. 지금 필요한 것은 안전 가드를 더 두껍게 만드는 일이 아니라, **Green Lane은 Codex가 묻지 않고 끝까지 밀고 가고, Red Line만 아주 좁고 명확하게 막는 운영 방식**이다.

Claude Code/BKIT 강의 자료는 우리에게 도움 된다. 다만 도구를 그대로 들여오는 것이 아니라, `PDCA`, `Check report`, `Hooks식 자동검사`, `Subagent 병렬 위임`만 현재 Codex/harness 방식에 흡수하는 것이 맞다.

결론은 **자율 실행을 기본값으로 올리고, 승인 요청은 운영·돈·외부 플랫폼·운영DB에 직접 영향을 주는 일로 제한**하는 것이다.

# 결론

## 지금 채택할 것

1. **Green First 원칙**
   - 문서 조사, read-only DB/API 조회, 로그 확인, dry-run, 로컬 테스트, 설계, 승인안 작성, 스코프 내 로컬 코드 수정은 Codex가 묻지 않고 진행한다.
   - 중간에 막히면 바로 승인 요청으로 넘기지 않고, `접근 권한`, `데이터 부족`, `source freshness gap`, `verification gap`, `missing bridge`, `기술 실패` 중 무엇인지 먼저 분류한다.

2. **PDCA를 짧게 적용**
   - Plan: 성공 기준, source, 금지선을 정한다.
   - Do: Green 작업을 실행한다.
   - Check: 목표 대비 실제 결과와 gap을 확인한다.
   - Act: 다음 Green 실행 또는 Yellow/Red 승인안으로 넘긴다.
   - 여기서 중요한 것은 양식이 아니라 **멈추지 않는 실행 루프**다.

3. **Check report는 테스트 PASS보다 더 중요하게 본다**
   - `API 200`, `typecheck PASS`, `preflight PASS`만으로는 부족하다.
   - `목표가 무엇이었나`, `실제 결과가 무엇인가`, `차이가 무엇인가`, `다음에 무엇을 할 것인가`를 같이 남긴다.
   - `paid_click_intent_ledger exact-click miss`처럼 "서버 200인데 원하는 row가 없음"인 문제를 잡는 데 특히 필요하다.

4. **Subagent는 속도를 올리는 도구로 쓴다**
   - 코드베이스 조사, 문서 검토, QA, 프론트 smoke, 승인안 초안처럼 서로 충돌하지 않는 작업은 병렬화한다.
   - 단, deploy, restart, rollback, publish, DB write는 여러 에이전트가 병렬로 만지지 않는다.

5. **Hooks 개념은 최소 자동검사로만 흡수한다**
   - raw identifier scan, send/upload flag, 운영DB write, GTM publish, 승인 없는 deploy/restart 같은 위험만 자동으로 잡는다.
   - 모든 작업을 gate로 막는 방향은 아니다.

## 지금 채택하지 않을 것

1. **BKIT/Claude Code 플러그인 직접 도입**
   - 강의 자료는 신규 앱을 빠르게 만드는 교육 흐름이다.
   - 우리는 이미 Codex, VM Cloud, GTM, 운영DB, Google/Meta attribution, Obsidian 문서 체계가 있다.
   - 지금 새 플러그인 체계를 들이면 속도보다 운영 혼선이 커진다.

2. **Supabase/Vercel 신규앱 흐름**
   - 우리 프로젝트의 primary source는 상황별로 VM Cloud SQLite, 운영DB, 로컬 DB, 외부 API가 나뉜다.
   - Supabase/Vercel 흐름은 참고만 하고 그대로 적용하지 않는다.

3. **일반 모드식 매번 확인 요청**
   - 안전하지만 너무 느리다.
   - TJ님이 원하는 방향과 맞지 않는다.

4. **완전자율 모드**
   - 광고 플랫폼 전송, GTM publish, 운영DB write, permanent env ON, 실제 결제 테스트까지 자동으로 열어두면 위험하다.
   - 스타트업 속도를 위해 일부 모험은 하되, 되돌리기 어렵고 비용/계정/고객 데이터에 영향을 주는 일은 Red Line으로 둔다.

# 검토 근거

## `harness/jdisession.md`

이 문서는 이미 좋은 방향을 갖고 있다.

- 자료 점수는 운영 철학 기준으로 높게 평가되어 있다.
- 핵심은 `PDCA`, `hooks-style preflight`, `subagent`, `Go/No-Go`를 현재 체계에 흡수하는 것이다.
- "도구 설치보다 운영 철학 흡수"라는 판단이 지금 상황에 맞다.

다만 실제 운영 문장으로는 더 짧아져야 한다. 하네스가 컨펌을 늘리는 장치처럼 보이면 안 된다.

## `claude code (desktop) 강의-bkit v1.1.pptx`

PPTX 41장을 텍스트 기준으로 확인했다. 우리에게 중요한 슬라이드는 아래다.

- Slide 4: `CLAUDE.md`, `Skills`, `Hooks`, `Subagents`, `Plugins` 5계층.
- Slide 7: Hooks. 도구 실행 전후 자동 품질 게이트.
- Slide 8: Subagents. 메인 컨텍스트를 깨끗하게 하고 작업을 위임.
- Slide 13: PDCA. Plan, Do, Check, Act.
- Slide 28: Go/No-Go. 구현 전 핵심 조건 확인.
- Slide 30: Check report. 설계와 실제 결과 차이 분석.
- Slide 35: 권한 모드. 일반 모드, 자동수정 모드, 완전자율 모드.

우리에게 맞는 해석은 `자동수정 모드 + 허용 목록`이다. 즉, Green은 자동 실행하고 Red만 명시적으로 막는다.

# 우리 프로젝트용 운영 원칙

## 1. Green Lane은 기본 실행이다

Codex는 아래 작업을 승인 없이 진행해야 한다.

- 문서 읽기와 요약.
- VM Cloud/운영DB/로컬 DB read-only 조회.
- 로그 확인.
- API read-only smoke.
- dry-run.
- 로컬 코드 수정과 테스트.
- 프론트 로컬 화면 확인.
- 원인 분석 문서 작성.
- 배포 승인안 작성.
- 커밋 범위 선별 준비.

승인 대기가 아니라 결과 보고가 기본이다.

## 2. Yellow Lane은 한 번 승인하면 sprint 단위로 닫는다

Yellow는 위험이 있지만 되돌릴 수 있는 작업이다.

예:

- backend 배포.
- frontend 배포.
- VM Cloud env 변경.
- 제한된 monitoring 시작.
- GTM Preview workspace 수정.

Yellow 승인을 받았으면 중간 확인을 남발하지 않는다. Codex가 backup, apply, smoke, rollback 기준 확인, cleanup, report까지 한 번에 닫는다.

## 3. Red Lane은 좁게 둔다

Red는 실제 돈, 계정, 고객 데이터, 외부 플랫폼, 되돌리기 어려운 운영 상태에 영향을 준다.

예:

- GTM Production publish.
- Google/Meta/Naver 전환 send 또는 upload.
- 운영DB write/import/schema 변경.
- permanent env ON.
- 실제 결제 테스트.
- destructive migration.
- rollback이 어려운 대규모 자동화.

Red는 TJ님 명시 승인 전 실행하지 않는다. 단, 승인안 작성과 read-only 검증은 Codex가 계속 진행한다.

## 4. HOLD는 최종 상태가 아니다

HOLD라고 쓰고 멈추는 것은 나쁜 운영이다.

먼저 아래 중 무엇인지 분류한다.

- 접근 권한 문제.
- 데이터 부족.
- source freshness gap.
- verification gap.
- missing bridge.
- 기술 실패.
- 사업 판단 필요.

그 다음 Codex가 할 수 있는 Green follow-up을 먼저 수행한다. 정말 TJ님이 눌러야 하거나 승인해야 하는 일만 남긴다.

# 현재 ROAS/GTM 작업에 대한 적용

## `paid_click_intent_ledger exact-click miss`

이번 건은 Green 진단 대상이었다. 운영 변경 없이 VM Cloud read-only, 코드 read-only, local simulation, 문서 업데이트로 원인을 좁힐 수 있었다.

바로 Red로 묶었으면 느려졌을 것이다. 반대로 Green으로 밀었기 때문에 다음 결론까지 도달했다.

- GTM/fetch/CORS 실패가 아니다.
- `site_landing_ledger`와 `attribution_ledger`에는 실제 Google click evidence가 있다.
- `paid_click_intent_ledger`만 빠졌다.
- 실제 URL에는 `gclid/gbraid`가 있었지만, 주문 metadata에는 과거 `test_wbraid_20260514`가 섞였다.
- backend guard가 click id 중 하나라도 test이면 live write 후보에서 제외한다.

따라서 다음 행동은 "가드를 더 올리기"가 아니라 아래 두 가지다.

1. 새 Google evidence가 들어오면 stale 저장 click id를 섞지 않도록 payload 정리.
2. 실제 primary click id가 유효하면 stale secondary test id 때문에 live write를 탈락시키지 않도록 backend guard 조정.

둘 다 로컬 구현과 테스트는 Green이다. 배포와 GTM publish만 Yellow/Red로 분리하면 된다.

# 앞으로 바꿀 Codex 운영 방식

## Auto Green

아래는 Codex가 바로 진행한다.

1. 원인 진단.
2. source/window/freshness/confidence 정리.
3. dry-run.
4. 로컬 테스트.
5. 문서화.
6. patch 초안 작성.
7. approval packet 작성.

TJ님에게는 "할까요?"가 아니라 "여기까지 했고, 운영 반영만 승인 필요합니다"라고 보고한다.

## Approval Needed

아래는 TJ님에게 승인 요청한다.

1. 운영 배포.
2. GTM Production publish.
3. 외부 광고 플랫폼으로 전환 전송.
4. 운영DB write.
5. permanent env ON.
6. 실제 결제 테스트.

승인 요청 시에는 바꾸는 화면/설정, 효과, 안 하면 남는 문제, 성공 기준, 실패 시 rollback을 같이 제시한다.

## Blocked/Parked

아래만 멈춘다.

1. 계정/2FA/권한이 없어 Codex가 접근할 수 없는 경우.
2. 데이터가 아직 생성되지 않은 경우.
3. 사업 판단이 필요한 경우.
4. Red Lane인데 TJ님 승인이 없는 경우.

멈출 때도 "안 됨"이 아니라 다음 Green 대체 작업을 함께 제시한다.

# 적용 우선순위

## P0

**Green Lane 기본 실행 문장 정리**

- 무엇을 하는가: `harness/common` 또는 `AGENTS.md`의 운영 문장을 짧게 보강한다.
- 왜 하는가: Codex가 위험하지 않은 영역에서 확인 대기 없이 목표까지 밀고 가게 하기 위해서다.
- 어떻게 하는가: 기존 규칙을 늘리지 않고, `Green은 실행`, `Red는 좁게`, `HOLD는 원인 분류 후 Green follow-up` 문장만 반영한다.
- 승인 필요 여부: 문서 패치만이면 NO.
- 성공 기준: 다음 Growth Data 작업에서 Codex가 read-only/dry-run/local test를 승인 없이 수행한다.

## P1

**Check report 최소 양식 추가**

- 무엇을 하는가: 결과보고에 `목표`, `실제`, `gap`, `다음 action`을 짧게 넣는다.
- 왜 하는가: "테스트는 통과했는데 목표가 안 됨"을 줄이기 위해서다.
- 어떻게 하는가: 별도 긴 문서가 아니라 기존 결과보고/confirm 문서 안에 4줄 블록으로 넣는다.
- 승인 필요 여부: NO.
- 성공 기준: `paid_click_intent` 같은 exact miss에서 원인 분기와 다음 행동이 남는다.

## P2

**Hook-like preflight는 위험 탐지만 추가**

- 무엇을 하는가: raw identifier, send/upload flag, 운영DB write, GTM publish, deploy/restart approval 같은 위험만 자동 검사한다.
- 왜 하는가: 속도를 늦추지 않으면서 큰 사고만 줄이기 위해서다.
- 어떻게 하는가: 검사 항목을 과하게 늘리지 않고, Red Line 관련 항목 위주로 제한한다.
- 승인 필요 여부: 검사 스크립트 로컬 패치 NO. 운영 workflow 강제 적용은 별도 판단.
- 성공 기준: 승인 없이 외부 전송/운영DB write/GTM publish가 섞이는 일을 막는다.

# 최종 의견

이 자료는 지금 우리에게 도움 된다. 다만 **안전 가드를 더 올리는 자료로 쓰면 안 되고, Codex가 더 자율적으로 빨리 움직이게 하는 운영 참고자료로 써야 한다.**

가져올 것은 네 가지다.

1. PDCA를 짧은 실행 루프로 쓴다.
2. Check report로 목표 대비 gap을 남긴다.
3. Subagent로 read-only 조사와 QA를 병렬화한다.
4. Hooks는 Red 위험 자동탐지에만 쓴다.

버릴 것은 세 가지다.

1. BKIT/Claude plugin 직접 도입.
2. 모든 단계의 확인 요청.
3. 완전자율로 Red 작업까지 여는 방식.

한 문장으로 정리하면 이렇다.

> **하네스는 제한 장치가 아니라, Green을 자동으로 밀고 Red만 좁게 막는 실행 장치여야 한다.**

# 다음 할일

## Codex가 할 일

1. `harness/common` 또는 루트 운영 지침에 Green First 문장을 짧게 반영한다.
   - 의존성: 없음.
   - 승인 필요 여부: 문서 패치만이면 NO.
   - 성공 기준: Green 작업은 묻지 않고 진행, Red만 승인 요청한다는 문장이 중복 없이 들어간다.
   - 실패 시 확인점: 기존 문장과 충돌하면 새 섹션 추가 대신 기존 문장을 수정한다.
   - 추천 점수/자신감: 92%.

2. `paid_click_intent` 보강은 Green 구현부터 진행한다.
   - 의존성: 현재 exact miss 진단 완료.
   - 승인 필요 여부: 로컬 구현/테스트 NO, backend deploy/GTM publish YES.
   - 성공 기준: stale test `wbraid`가 실제 `gclid/gbraid` live 후보를 탈락시키지 않는다.
   - 실패 시 확인점: GTM storage reset, primary click id 선택 기준, receiver audit 필요 여부.
   - 추천 점수/자신감: 94%.

## TJ님이 할 일

1. 지금은 추가 승인 없이 Codex가 Green 작업을 계속 진행하게 두면 된다.
   - Codex가 대신 못 하는 이유: 없음. 이 단계는 Codex가 할 수 있다.
   - 승인 필요 여부: NO.
   - 성공 기준: 다음 보고에서 로컬 patch/test 결과와 운영 반영 승인 포인트만 남는다.
   - 실패 시 확인점: Codex가 Red 작업을 실행하려고 할 때만 멈추고 승인 요청해야 한다.
   - 추천 점수/자신감: 90%.
