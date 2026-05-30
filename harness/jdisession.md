According to a document from 2026-05-21, TJ님, **첨부 강의 자료는 우리 프로젝트에 꽤 도움 됩니다. 다만 “Claude Code/BKIT를 그대로 도입”하기보다는, 그 안의 운영 철학을 Codex/harness/gptconfirm 방식으로 흡수하는 게 맞습니다.**

제 평가 점수는 **8.2 / 10**입니다.

핵심은 이겁니다.

> **우리는 이미 Green/Yellow/Red, gptconfirm, preflight, source guide를 갖고 있습니다.
> 이 자료에서 가져올 것은 새 툴이 아니라 “PDCA식 작업 분할, hooks식 자동 품질 게이트, subagent식 병렬 위임, CEO용 Go/No-Go 체크리스트”입니다.**

---

## 1. 우리에게 바로 도움 되는 부분

### 1) PDCA를 sprint 운영 양식으로 고정

자료는 PDCA를 “무엇을/왜/어떻게 만들지 계획하고, 만들고, 결과를 확인하고, 다음 사이클로 반영하는 방식”으로 설명합니다. 또 BKIT은 이 흐름을 `/bkit:pdca-plan`, `pdca-do`, `pdca-check`, `pdca-act` 같은 명령어로 자동화한다고 되어 있습니다.

우리 프로젝트에 맞게 바꾸면 이렇게 됩니다.

```text
Plan  = 이번 sprint 성공 기준, 금지선, source priority 확정
Do    = Green 코드/쿼리/로컬 dry-run 진행
Check = typecheck/test/API smoke/Playwright/숫자 비교
Act   = gptconfirm에 다음 P0/P1/P2 정리 + approval packet 생성
```

우리는 이미 이걸 부분적으로 하고 있습니다. 다만 매번 프롬프트마다 길게 설명하니 흔들립니다.
따라서 **AGENTS.md나 REPORTING_TEMPLATE에 “Codex PDCA Sprint”를 고정 템플릿으로 넣는 것**이 좋습니다.

---

### 2) CEO Go/No-Go 체크리스트

자료에는 CEO가 다음 단계로 넘어가기 전 확인할 4개 질문이 있습니다. 예를 들면 P0 기능이 plan/ui/schema에 들어갔는지, 데모 흐름이 끊기지 않는지, 보안 요구가 반영됐는지, 범위가 50분 안에 끝날 정도인지 확인하라고 되어 있습니다.

이걸 우리 프로젝트에는 이렇게 바꾸면 됩니다.

```text
TJ Go/No-Go 체크리스트

1. 이번 작업이 현재 OKR의 P0/P1 중 어디에 속하는가?
2. 성공 기준이 숫자/API/화면/테스트로 확인됐는가?
3. raw PII, platform send, 운영DB write, GTM publish 위험은 차단됐는가?
4. 지금 deploy/승인 범위가 너무 넓지 않은가?
```

이건 특히 **Google Ads Option 3, Meta CAPI, Naver URL canary, /total deploy** 같은 Yellow/Red 판단에 유용합니다.

---

### 3) Check 단계: “그냥 동작”이 아니라 “설계와 얼마나 맞는가”

자료의 Check 단계는 단순히 앱이 켜지는지 보는 게 아니라, plan.md / ui_spec.md / schema.sql과 실제 코드가 얼마나 맞는지 비교하라고 합니다. 그리고 check_report.md를 만들어 누락 기능, 다른 동작, 미구현 화면, 보안 갭을 정리합니다.

우리에게 매우 유용합니다.

지금 우리도 검증은 많이 하지만, 종종 이런 식입니다.

```text
typecheck PASS
API 200
preflight PASS
```

좋지만 충분하지 않습니다. 앞으로는 추가로:

```text
이번 sprint 성공 기준과 실제 결과 비교
숫자 차이
화면 차이
source rule 차이
남은 blocker
```

를 **check_report**처럼 남겨야 합니다.

예:

```text
gptconfirm/<auto>/02-check-report.md
- 목표: /total에서 Naver aggregate 216건 기준 표시
- 실제: endpoint 200, paid 59 / brandsearch 100 / organic 후보 39 표시
- 차이: 운영 deploy 전이라 live 화면 미반영
- 다음: Yellow deploy approval
```

---

### 4) Hooks 개념

자료는 Hooks를 “도구 실행 전/후 자동으로 반응하는 결정론적 콜백”이라고 설명합니다. 예시는 auto-lint, 파일 삭제 전 차단, 종료 시 Slack 알림 등입니다.

Codex에서도 완전 같은 기능은 아니어도, 우리 repo에는 **hook처럼 동작하는 scripts/checks**를 만들 수 있습니다.

우리에게 필요한 hook 후보는 이겁니다.

```text
1. gptconfirm 문서 수 5개 이하 검사
2. 확인하면 좋은 문서가 gptconfirm 내부만 가리키는지 검사
3. Codex/Claude Code 표현 혼선 검사
4. raw email/phone/order/payment/click_id 값 패턴 검사
5. platform send/upload flag가 true로 바뀌었는지 검사
6. 운영DB write SQL이 추가됐는지 검사
7. deploy 승인 없이 restart 명령이 문서 밖에서 실행됐는지 검사
```

즉, 지금 우리가 매번 프롬프트로 강제하는 것을 **`harness-preflight-check --strict` 안에 더 많이 흡수**하는 게 좋습니다.

---

### 5) Subagents를 더 명확히 쓰기

자료는 큰 작업을 메인 에이전트가 직접 다 하지 말고 코드 리뷰어, 테스트 실행기, 코드 탐색기 같은 서브에이전트로 나눠 위임하라고 설명합니다.

우리 프로젝트에선 이렇게 쓰면 됩니다.

```text
Agent A: Data Source / SQL / source truth
Agent B: Backend API / contract
Agent C: Frontend UX / Playwright smoke
Agent D: QA / gptconfirm / raw pattern scan
Agent E: Approval packet / rollback plan
```

단, 주의할 점은 **deploy/restart/rollback은 병렬 금지**입니다.
동시에 여러 에이전트가 운영을 만지면 위험합니다.

---

## 2. 우리에게 덜 맞는 부분

### 1) Supabase/Vercel 중심 흐름

자료는 Supabase, Vercel, Claude Design, BKIT을 조합한 신규 앱 제작 강의입니다.
우리 프로젝트는 이미 운영 VM, BigQuery, GA4, Google Ads, Meta CAPI, Imweb, Toss, VM Cloud SQLite가 얽혀 있습니다.

따라서 Supabase/Vercel 흐름은 그대로 쓰기 어렵습니다.

우리는 이렇게 바꿔야 합니다.

```text
Supabase schema 설계
→ 우리에겐 VM Cloud SQLite / 운영DB / BigQuery source guide

Vercel deploy
→ 우리에겐 VM backend/frontend deploy + pm2 restart + rollback

Claude Design handoff
→ 우리에겐 /total, /ads/site-landing, leading-indicators UX contract
```

---

### 2) “완전 자율 모드”는 우리에겐 위험

자료에는 권한 모드 3단계가 있고, 일반 모드, 자동수정 모드, 완전자율 모드를 설명합니다. 자동수정 모드 + 허용 목록이 속도와 안전의 균형이라고 되어 있습니다.

우리 프로젝트에는 **완전자율 모드가 맞지 않습니다.**
이유는 광고 플랫폼, 운영DB, GTM, VM restart 같은 Red/Yellow 영역이 많기 때문입니다.

우리에게 맞는 것은:

```text
Green 자동 실행
Yellow approval packet 후 실행
Red TJ 명시 승인 전 금지
```

즉, **자동수정 모드 + 허용 목록**이 맞습니다.

---

## 3. 지금 바로 반영할 것

### A. AGENTS.md에 “Codex PDCA Sprint” 추가

아래 블록을 프로젝트 AGENTS.md 상단 또는 harness 안내에 넣으면 좋습니다.

```text
## Codex PDCA Sprint Rule

Every sprint must follow:

1. Plan
- Define target KR/Track.
- Define success criteria in numbers/API/UI/tests.
- Define forbidden actions.
- Define owner split: Codex / TJ님.

2. Do
- Execute all Green work without waiting.
- Keep changes surgical.
- Do not touch unrelated dirty files.
- Use multi-agent only when tasks are independent.

3. Check
- Compare result against success criteria.
- Run typecheck/test/API smoke/Playwright when relevant.
- Produce a short check report: expected vs actual vs gap.
- Never treat platform claim as internal confirmed revenue.

4. Act
- Update gptconfirm package.
- Create next P0/P1/P2 plan.
- Create approval packet for Yellow/Red.
- “확인하면 좋은 문서” must point only to gptconfirm files.
```

---

### B. `harness-preflight-check`에 새 검사 추가

추천 검사:

```text
gptconfirm_document_count <= 8
recommended_docs_only_in_gptconfirm = true
raw_identifier_scan = true
send_upload_flags_false = true
operator_label_consistent = Codex
deploy_without_approval = false
```

이건 우리 프로젝트에서 반복 실수 방지 효과가 큽니다.

---

### C. gptconfirm 구조에 PDCA를 녹이기

문서 수는 늘리지 말고, 기존 5개 구조 안에 PDCA를 넣으면 됩니다.

```text
00-result-report.md
- 이번에 가능해진 것
- 실제 숫자
- 아직 남은 것
- 다음 행동

01-plan-and-implementation.md
- Plan + Do

02-check-report.md
- Check: 성공 기준 vs 실제 결과

03-next-actions-and-approval.md
- Act: 다음 P0/P1/P2 + 승인안

99-total-current-copy.md
manifest.json
```

자료의 plan.md, check_report.md, retrospective.md 철학을 우리 gptconfirm에 흡수하는 방식입니다. 자료도 PDCA의 장점으로 일관성, 추적성, 친숙성, 자율성, 재현성을 말합니다.

---

## 4. 우리 프로젝트 적용 우선순위

|우선순위|적용 항목|효과|
|--:|---|---|
|1|Codex PDCA Sprint Rule|작업 방향 흔들림 감소|
|2|Check report 강제|“PASS인데 왜 목표 미달?” 문제 감소|
|3|Hook-like preflight 강화|raw/output/deploy 실수 방지|
|4|Multi-agent 역할 고정|넓고 깊은 작업 속도 증가|
|5|Skills화|반복 작업을 프롬프트 대신 모듈로 관리|
|6|BKIT/Claude plugin 직접 도입|현재는 후순위|

---

## 5. Skills로 만들면 좋은 것

자료는 반복 작업을 `.claude/skills/` 아래 `SKILL.md`로 만들어두면 자동 매칭된다고 설명합니다.

Codex에서도 완전히 같은 구조는 아니지만, 우리는 `harness/skills` 또는 `docs/skills`처럼 운영할 수 있습니다.

추천 skill:

```text
source-truth-skill
- 운영DB / VM Cloud / 로컬DB / BigQuery source priority

gptconfirm-packaging-skill
- 문서 수 제한, manifest, 확인 문서 규칙

roas-gap-skill
- platform ROAS vs internal confirmed ROAS 계산

unknown-drilldown-skill
- unknown revenue blocker 분해

capi-guard-skill
- Purchase / intermediate / send 후보 분리

deploy-approval-skill
- pre-snapshot / backup / deploy / post-snapshot / rollback
```

이렇게 하면 매번 긴 프롬프트로 반복하지 않아도 됩니다.

---

## 6. Codex에 줄 프롬프트

```text
YES: Codex Agent Workflow PDCA Harness Upgrade Sprint 진행.

목표:
첨부된 Claude Code/BKIT 강의 자료에서 우리 프로젝트에 맞는 운영 원칙만 추출해, Codex 기반 SEO/AEO/GA4 프로젝트의 AGENTS/harness/gptconfirm 운영 방식에 반영한다.
새 도구를 무리하게 설치하는 것이 아니라, PDCA, check report, hooks-style preflight, subagent 역할 분리를 현재 Codex workflow에 맞게 흡수한다.

운영 철학:
- 현재 작업자는 Codex 기준이다.
- Claude Code/BKIT 원문을 그대로 복붙하지 않는다.
- Supabase/Vercel/신규 앱 제작 흐름은 우리 프로젝트에 그대로 적용하지 않는다.
- 우리 프로젝트는 VM Cloud, 운영DB, BigQuery, GA4, Google Ads, Meta CAPI, Imweb, Toss가 얽힌 운영 데이터 프로젝트다.
- Green 영역은 사용자 확인 없이 진행한다.
- Yellow/Red는 approval packet으로 제안하되 승인 전 실행 금지.
- 문서 수는 기본 5개 이하, 최대 8개.
- 확인하면 좋은 문서는 gptconfirm 내부만.
- 결과보고는 사람 말 우선.
- 한 줄 결론 대신 “이번에 가능해진 것”으로 시작한다.

참조할 첨부 자료 핵심:
- PDCA: Plan / Do / Check / Act
- CLAUDE.md: 규칙 레이어
- Skills: 반복 작업 지식 모듈
- Hooks: 자동 품질 게이트
- Subagents: 병렬 위임
- Plugins/BKIT: 팀 배포 구조
- CEO Go/No-Go 체크리스트
- Check report: 설계 vs 실제 결과 비교

작업 0. gptconfirm 패키지 자동 생성
- 기존 gptconfirm 폴더 스캔.
- 다음 번호 자동 선택.
- 권장 구성:
  - 00-result-report.md
  - 01-pdca-harness-upgrade.md
  - 02-preflight-and-skill-design.md
  - 03-next-actions-and-approval.md
  - 99-total-current-copy.md
  - manifest.json

작업 1. AGENTS.md / harness 충돌 audit
목표:
현재 AGENTS.md, harness/common, REPORTING_TEMPLATE가 이미 갖고 있는 규칙과 첨부 자료의 원칙이 어디서 겹치는지 본다.

해야 할 것:
- AGENTS.md
- harness/common/HARNESS_GUIDELINES.md
- harness/common/AUTONOMY_POLICY.md
- harness/common/REPORTING_TEMPLATE.md
- docurule.md
- gptconfirm 최신 패키지
를 읽는다.

출력:
- 이미 있는 규칙
- 부족한 규칙
- 충돌하는 규칙
- 수정 제안

성공 기준:
- 중복 문구를 늘리지 않는다.
- 실제로 필요한 보강만 정한다.

작업 2. Codex PDCA Sprint Rule 추가
목표:
현재 Codex sprint가 항상 Plan/Do/Check/Act를 지나가게 한다.

추가 내용:
- Plan: 성공 기준/금지선/owner/Track
- Do: Green 진행, scoped change, unrelated dirty 제외
- Check: expected vs actual vs gap
- Act: gptconfirm, next P0/P1/P2, approval packet

성공 기준:
- AGENTS 또는 harness에 짧고 명확하게 들어간다.
- 장문 복붙 금지.

작업 3. check report 규칙 추가
목표:
“테스트 PASS”뿐 아니라 “목표 대비 결과 차이”를 항상 남기게 한다.

해야 할 것:
- gptconfirm 구조 안에 check report 섹션을 넣는다.
- 필드:
  - success criteria
  - actual result
  - gap
  - blocker
  - next action

성공 기준:
- 다음 sprint부터 PASS/FAIL이 목표 달성과 연결된다.

작업 4. hooks-style preflight 강화 설계
목표:
Claude Code Hooks 아이디어를 Codex harness preflight로 흡수한다.

검사 후보:
- gptconfirm 문서 수 <= 8
- 확인하면 좋은 문서는 gptconfirm 내부만
- raw identifier scan
- send/upload flags false
- operator label consistent Codex
- deploy/restart approval present
- unrelated dirty excluded
- external platform send 0

성공 기준:
- 실제 harness-preflight-check에 넣을 수 있는 설계 또는 patch를 만든다.
- patch가 안전하면 구현한다.

작업 5. skills-like 운영 문서 설계
목표:
반복 작업을 매번 긴 프롬프트 대신 모듈화한다.

후보:
- source-truth-skill
- gptconfirm-packaging-skill
- roas-gap-skill
- unknown-drilldown-skill
- capi-guard-skill
- deploy-approval-skill

성공 기준:
- 어디에 둘지 정한다.
- 바로 1개 이상 초안 작성 가능하면 작성한다.

작업 6. subagent 역할표 업데이트
목표:
넓고 깊게 진행할 때 충돌 없이 병렬화하는 기준을 만든다.

역할:
- Data Source Agent
- Backend Contract Agent
- Frontend UX Agent
- QA/Gptconfirm Agent
- Approval/Rollback Agent

금지:
- deploy/restart/rollback 병렬 수행
- 같은 파일 동시 수정

성공 기준:
- 다음 sprint 프롬프트에 바로 재사용 가능.

작업 7. gptconfirm 패키지 완성
검증:
- JSON parse PASS
- validate_wiki_links PASS
- harness-preflight-check --strict PASS
- git diff --check PASS
- raw PII/order/payment/click_id/member_code pattern scan PASS
- upload/send/platform actual send 0
- 운영DB write 0
- GTM publish 0
- Imweb footer/header 변경 0

보고:
- 이번에 가능해진 것
- 우리에게 실제 도움 되는 것
- 적용하지 않을 것
- 다음 sprint부터 바뀌는 운영 방식
- 확인하면 좋은 문서는 gptconfirm 내부만
```

---

## 7. 최종 의견

이 자료는 우리에게 **도구 설치 가이드**로는 40점, **운영 철학 참고자료**로는 90점입니다.

바로 가져올 것은 딱 네 가지입니다.

```text
1. PDCA sprint rule
2. check report
3. hooks-style preflight
4. subagent role split
```

BKIT 설치나 Claude Desktop 전환은 지금 당장은 우선순위가 낮습니다.
현재 TJ님은 Codex를 쓰고 있고, 우리 프로젝트는 이미 자체 harness와 gptconfirm 체계를 갖고 있으니, **새 도구를 들이는 것보다 현재 체계를 더 자동화하고 덜 흔들리게 만드는 게 훨씬 효과적**입니다.