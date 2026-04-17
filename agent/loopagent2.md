좋습니다. 아래 설계안은 지금 올려주신 PRD, 0415 로드맵, 바이브코딩/AI 엔지니어링 검토 문서를 한 프레임으로 합쳐서 만든 **“우리 저장소용 재귀개선 루프 v0.1”**입니다. 핵심은 **숫자 판정은 고정 평가기**, **AI는 설명·증거 패키징·우선순위화**,** 개선 루프는 프롬프트/프로그램/훅/테스트 쪽만 먼저** 돌리는 것입니다. 이 방향은 지금 문서의 `Verification Harness`, `Evidence Store`, `Work Queue`, `Approval Gate`, `Revenue Integrity Agent read-only MVP`와 정확히 맞고, OpenAI/Anthropic의 최근 Codex/Claude Code 운영 패턴과도 잘 맞습니다. ([OpenAI 개발자](https://developers.openai.com/codex/learn/best-practices "https://developers.openai.com/codex/learn/best-practices"))

## 먼저, 헷갈리는 말을 사람 말로 바꾸면

### 1) 병렬 에이전트가 뭐냐

쉽게 말하면 **한 명이 다 하지 않고, 여러 명이 동시에 나눠서 하는 방식**입니다.
예를 들어, 한 에이전트는 백엔드만 보고, 다른 에이전트는 프론트만 보고, 또 다른 에이전트는 문서/증거만 보는 식입니다. OpenAI도 Codex subagent를 “병렬로 전문 작업을 나눠 처리하는 방식”으로 설명하고, Anthropic도 subagent나 agent teams를 병렬 작업용으로 설명합니다. ([OpenAI 개발자](https://developers.openai.com/codex/subagents "https://developers.openai.com/codex/subagents"))

### 2) “토큰 비용이 크다”는 무슨 뜻이냐

AI에게 토큰은 거의 **연료비**라고 보면 됩니다.
에이전트가 1명일 때는 한 번만 문맥을 읽고 생각하면 되는데, 3명을 동시에 띄우면 **세 명이 각자 문맥을 다시 읽고, 각자 생각하고, 각자 답을 씁니다.** 그래서 같은 문제를 풀어도 총 사용량이 빠르게 늘어납니다. Codex 문서도 subagent는 각자가 자기 모델 호출과 툴 작업을 하기 때문에, 단일 에이전트보다 토큰을 더 쓴다고 명시합니다. ([OpenAI 개발자](https://developers.openai.com/codex/subagents "https://developers.openai.com/codex/subagents"))

### 3) “조정 비용”은 무슨 뜻이냐

이건 **회의 비용**입니다.
사람으로 비유하면, 일을 3명에게 나누면 손은 빨라질 수 있지만, 대신

- 누가 뭘 맡는지 설명해야 하고

- 결과를 다시 모아야 하고

- 서로 충돌하는 결론을 정리해야 하고

- 마지막에 하나로 합쳐야 합니다


AI도 똑같습니다. 부모 에이전트가 자식 에이전트들에게 일을 나누고, 결과를 기다리고, 다시 합쳐야 합니다. Codex 문서도 부모가 자식 에이전트를 띄우고, 지시를 전달하고, 기다리고, 결과를 합치는 오케스트레이션 비용이 있다고 설명합니다. ([OpenAI 개발자](https://developers.openai.com/codex/subagents "https://developers.openai.com/codex/subagents"))

### 4) “재귀 fan-out”은 무슨 뜻이냐

이 말이 제일 헷갈리죠.
사람 말로 바꾸면:

**“팀장이 일을 3명에게 나눴는데, 그 3명이 또 각자 3명씩 더 부르는 구조”**입니다.

즉,

- 1단계: 1명이 3명에게 나눔

- 2단계: 그 3명이 또 3명씩 부름

- 그러면 총 1 + 3 + 9 = 13개의 작업 흐름이 생깁니다

- 한 단계만 더 가면 1 + 3 + 9 + 27 = 40개가 됩니다


문제는, 이쯤 되면 **실제 코딩보다 브리핑·정리·충돌해결이 더 비싸지는** 경우가 많다는 점입니다. OpenAI는 그래서 `agents.max_depth` 기본값을 1로 두고, 깊이를 올리면 repeated fan-out이 생겨 토큰, 지연, 로컬 리소스 사용량이 늘고 예측 가능성이 떨어진다고 경고합니다. Anthropic도 subagent는 **격리된 문맥**에서 움직이고, agent teams는 **독립적인 병렬 작업**에 가장 잘 맞는다고 설명합니다. ([OpenAI 개발자](https://developers.openai.com/codex/subagents "https://developers.openai.com/codex/subagents"))

이걸 우리 저장소 규칙으로 바꾸면 아주 단순합니다.

**좋은 병렬화**
부모 1명 → 자식 2~3명 → 끝

**나쁜 병렬화**
부모 1명 → 자식 3명 → 손자 9명 → 증손 27명

여기서는 **1단 병렬까지만 허용**하는 게 맞습니다. 특히 이 저장소는 광고 추적, 주문 정합성, CRM, CAPI, 프론트, 백엔드가 얽혀 있어서 더 그렇습니다.

---

## PLANS.md는 어떤 성격의 문서인가

`PLANS.md`는 **로드맵 문서가 아닙니다.**
또 **회의 메모도 아니고**, **그냥 TODO 목록도 아닙니다.**

가장 가까운 비유는:

**“복잡한 작업 하나를 끝까지 밀기 위한 실행 설계서 + 작업 일지 + 결정 기록”**

OpenAI의 execution plan 가이드는 이 문서를 `ExecPlan`이라고 부르면서,

- **완전히 자기완결적**이어야 하고

- **초보자도 이 파일 하나만 보고 작업을 이어갈 수 있어야 하며**

- **작업 중 발견사항, 결정, 진행상황, 회고가 계속 업데이트되는 living document**라고 설명합니다. 또 `Progress`, `Surprises & Discoveries`, `Decision Log`, `Outcomes & Retrospective` 섹션을 필수로 둡니다. ([OpenAI 개발자](https://developers.openai.com/cookbook/articles/codex_exec_plans "https://developers.openai.com/cookbook/articles/codex_exec_plans"))


즉, `PLANS.md`는 이런 문서입니다.

- **작업 전**: 무엇을 왜 바꾸는지 적는다

- **작업 중**: 어디까지 했는지, 뭐가 꼬였는지, 왜 방향을 바꿨는지 적는다

- **작업 후**: 무엇이 끝났고, 무엇이 남았는지 적는다


그래서 성격상:

- `roadmap0415.md`는 **분기/단계 로드맵**

- `PLANS.md`는 **개별 복잡 작업의 실행 문서**


이렇게 보는 게 가장 정확합니다. ([OpenAI 개발자](https://developers.openai.com/codex/learn/best-practices "https://developers.openai.com/codex/learn/best-practices"))

제가 이 저장소에 권하는 형태는 이겁니다.

```text
/PLANS.md                 # "우리 저장소에서 실행계획 문서를 어떻게 쓰는가" 규칙/템플릿
/plans/
  2026-04-16-integrity-agent-v0.md
  2026-04-16-capi-quality-replay.md
  2026-04-17-crm-segment-loop.md
```

즉, **루트 `PLANS.md`는 표준**, 실제 살아있는 작업 문서는 `plans/*.md`로 쪼개는 방식입니다. Codex는 `AGENTS.md`를 자동으로 읽고, OpenAI도 복잡한 작업에는 `PLANS.md` 같은 실행계획 템플릿을 두는 방식을 권장합니다. ([OpenAI 개발자](https://developers.openai.com/codex/guides/agents-md "https://developers.openai.com/codex/guides/agents-md"))

---

# 우리 저장소용 재귀개선 루프 v0.1

## 한 줄 정의

**“운영 숫자를 읽고, 정합성 incident를 만들고, 증거를 묶고, 사람이 승인하면 재검증하고, 그 결과로 에이전트 규칙과 증거 템플릿만 조금씩 좋아지게 만드는 루프”**

중요한 점은, 여기서 **재귀개선의 대상은 프로덕션 진실 계산기 자체가 아니라**,
우선은

- 에이전트 프로그램 문서

- 설명 프롬프트

- evidence 템플릿

- hooks

- replay 테스트

- UI copy / 액션 문구


같은 **운영 계층**입니다.
정본 전환 규칙, CAPI write-back, GTM/Meta 배포, DB 스키마는 여전히 승인 게이트 뒤에 둡니다. 이건 현재 문서 방향과 같습니다.

---

## 전체 흐름

```text
운영 데이터
(GA4 / Meta / Imweb / Toss / ledger / CRM)
        ↓
Truth Evaluator (결정적 판정기, 코드)
        ↓
Incident + Evidence Pack
        ↓
Action Center
        ↓
사람 피드백 / 승인 / 보류
        ↓
재검증(Revalidation)
        ↓
Labeled Replay Dataset 축적
        ↓
Improvement Agent
(프로그램/프롬프트/훅/테스트만 개선안 생성)
        ↓
Replay Eval 통과 시 Draft PR
```

이 구조는 지금 문서의 `수집 → 정규화 → 매칭 → 차이 탐지 → 원인 진단 → 액션 제안 → 사람 승인 → 재검증`과, `Verification Harness`, `Evidence Store`, `Approval Gate`, `Work Queue`를 한 시스템으로 엮은 형태입니다.

---

## 추천 디렉터리 구조

현재 저장소의 `backend/src`, `frontend/src`, `/tracking-integrity`, `/ads`, CRM 쪽 구조를 그대로 살리면서 아래를 추가하는 방식이 가장 안전합니다.

```text
/
├─ AGENTS.md
├─ CLAUDE.md
├─ PLANS.md
├─ plans/
│  ├─ 2026-04-16-integrity-agent-v0.md
│  └─ 2026-04-16-replay-loop-v0.md
├─ .codex/
│  ├─ config.toml
│  └─ agents/
│     ├─ integrity-worker.toml
│     ├─ evidence-worker.toml
│     └─ replay-worker.toml
├─ .claude/
│  ├─ agents/
│  │  ├─ ui-operator-reviewer
│  │  ├─ runbook-writer
│  │  └─ incident-explainer
│  └─ settings.json
├─ agent/
│  ├─ programs/
│  │  ├─ revenue-integrity.md
│  │  ├─ data-freshness.md
│  │  ├─ capi-quality.md
│  │  ├─ crm-segment.md
│  │  └─ ops-runbook.md
│  ├─ prompts/
│  │  ├─ incident_explainer.md
│  │  ├─ action_recommender.md
│  │  └─ operator_summary.md
│  ├─ evals/
│  │  ├─ fixtures/
│  │  ├─ expected/
│  │  ├─ replay/
│  │  └─ reports/
│  ├─ evidence/
│  │  └─ YYYY-MM-DD/
│  ├─ decisions/
│  │  └─ YYYY-MM-DD/
│  └─ proposals/
│     └─ YYYY-MM-DD/
├─ backend/
│  └─ src/
│     ├─ integrity/
│     │  ├─ contracts/
│     │  ├─ evaluators/
│     │  ├─ detectors/
│     │  ├─ evidence/
│     │  ├─ replay/
│     │  ├─ routes/
│     │  └─ types.ts
│     └─ jobs/
│        ├─ nightly-integrity-check.ts
│        └─ nightly-replay-eval.ts
└─ frontend/
   └─ src/
      └─ app/
         └─ tracking-integrity/
            ├─ page.tsx
            ├─ incidents/[id]/page.tsx
            ├─ orders/page.tsx
            ├─ settings/page.tsx
            └─ action-center/page.tsx
```

여기서 중요한 포인트만 짚으면,

- `AGENTS.md`는 Codex용 저장소 운영 규칙

- `CLAUDE.md`는 Claude Code용 얇은 영구 문맥

- 실제 도메인 규칙은 `agent/programs/*.md`에 공통으로 둡니다

- 평가기/재현 fixture는 `agent/evals/`

- 증거는 `agent/evidence/`

- 사람이 내린 판단은 `agent/decisions/`

- 자동개선 제안은 `agent/proposals/`

- 백엔드 진실 계산기는 `backend/src/integrity/`

- UI는 기존 `tracking-integrity` 쪽을 확장


이렇게 두면 문서, 평가기, UI, 개선 제안이 한 축으로 묶입니다. Codex는 `AGENTS.md`를 작업 전 읽고, Claude Code는 `CLAUDE.md`와 project-specific subagents/skills 패턴을 쓰는 쪽이 공식 흐름과도 맞습니다. ([OpenAI 개발자](https://developers.openai.com/codex/guides/agents-md "https://developers.openai.com/codex/guides/agents-md"))

---

## 에이전트 정의

여기서는 **“AI 에이전트”와 “결정적 평가기”를 구분**해야 합니다.

### 1) Truth Evaluator

이건 에이전트가 아닙니다.
**숫자 판정기**입니다.

- 위치: `backend/src/integrity/evaluators/*`

- 역할: 정본 전환, freshness, dedup, 매칭, threshold 판정

- 입력: GA4/Meta/Imweb/Toss/ledger/CRM 정규화 데이터

- 출력: incident 후보, mismatch 이유, 영향 범위

- 수정 주체: Codex 중심

- 금지: 자연어 모델이 숫자 판정을 덮어쓰기


핵심은 **같은 입력이면 같은 결과**가 나와야 한다는 점입니다. 이게 문서에서 말한 `Verification Harness`의 중심입니다.

### 2) Data Freshness Agent

- 위치: `agent/programs/data-freshness.md`

- 역할: stale인지, 잠정치인지, 확정치인지 분류

- 출력: `health`, `freshness_status`, 억제/완화 정보

- 수정 허용: 설명 템플릿, stale evidence 포맷

- 금지: truth rule 변경


### 3) Revenue Integrity Agent

- 위치: `agent/programs/revenue-integrity.md`

- 역할: evaluator 결과를 incident로 올리고 우선순위를 매김

- 출력: incident list, severity, business impact

- 수정 허용: incident 설명, taxonomy wording

- 금지: 매출 정의 자체 변경


### 4) Evidence Agent

- 위치: `backend/src/integrity/evidence/*` + `agent/programs/ops-runbook.md`

- 역할: 샘플 주문, 쿼리 결과, API 응답, screenshot, payload 요약을 묶음

- 출력: `agent/evidence/YYYY-MM-DD/<incident-id>.json|md`

- 수정 허용: evidence 템플릿

- 금지: 증거 조작, 누락 은폐


### 5) Explanation / Action Agent

- 위치: `agent/prompts/incident_explainer.md`, `action_recommender.md`

- 역할: 사람이 바로 판단할 수 있게 자연어로 정리

- 출력: “왜 문제인지 / 왜 지금은 잠정치인지 / 다음 액션”

- 수정 허용: copy, 설명 순서, 액션 추천 문구

- 금지: 숫자 재계산


### 6) Approval / Revalidation Agent

- 위치: `backend/src/integrity/routes/*`, `agent/decisions/*`

- 역할: `실제 문제 / 정상 차이 / 무시 / 보류 / 승인` 상태 관리

- 출력: work queue 상태 전이, 재검증 예약

- 금지: 승인 없는 write-back


### 7) Replay Improvement Agent

이게 **재귀개선 루프의 핵심**입니다.

- 입력: 최근 30~50건의 labeled incident

- 비교 대상: 현재 버전 vs 후보 버전

- 후보가 바꿀 수 있는 것:

    - `agent/programs/*.md`

    - `agent/prompts/*.md`

    - hook 규칙

    - evidence 템플릿

    - low-risk test/fixture

- 출력: 개선 리포트 + draft PR

- 금지:

    - evaluator 파일 직접 수정

    - production tracking script 수정

    - GTM/Meta/DB/prod env 변경


---

## 수정 허용 범위

v0.1에서는 이 선을 아주 강하게 지키는 게 좋습니다.

### 자동 제안 가능

- `agent/programs/*.md`

- `agent/prompts/*.md`

- `agent/evals/fixtures/*`

- `agent/evals/expected/*`

- `agent/evidence/*` 포맷

- 운영용 UI copy

- runbook

- draft PR 설명문


### 승인 후만 가능

- alert threshold

- route contract 변경

- frontend 동작 변경

- low-risk backend helper


### 자동 금지

- Conversion Dictionary

- payment decision / purchase guard

- GTM/Meta 배포

- DB schema

- 운영 데이터 수정

- prod env

- 광고 업로드 write-back


이 구분은 지금 문서의 “read-only부터, 사람 승인 전 write-back 금지” 원칙을 그대로 구현한 것입니다.

---

## 평가 지표

재귀개선 루프는 **“더 똑똑해 보이는가”**로 보면 안 됩니다.
숫자로 봐야 합니다.

### A. Truth / Integrity 지표

- **Incident Precision** = `실제 문제`로 라벨된 incident / 전체 incident

- **False Positive Rate** = `정상 차이 + 무시` / 전체 incident

- **Order Match Coverage** = 매칭된 truth order / 전체 truth order

- **Freshness Misfire Rate** = 데이터 지연 때문에 생긴 가짜 경고 / 전체 경고

- **Duplicate Leakage** = dedup 실패로 새는 purchase 건수 / 전체 purchase


### B. 운영 지표

- **Median Triage Time** = incident 생성 후 사람이 분류하기까지의 중간값

- **Evidence Completeness** = 필수 증거 5종이 다 붙은 incident 비율

- **Revalidation Success** = 승인 후 재검증에서 실제로 개선된 비율

- **Dismissed Ratio** = dismiss된 incident 비율


### C. 재귀개선 지표

- **Replay Win Rate** = 후보 버전이 baseline보다 좋아진 비율

- **PR Accept Rate** = draft PR 중 실제 채택 비율

- **No-Regress Rate** = 채택 후 precision/FP가 악화되지 않은 비율


이 지표 중 핵심 3개만 먼저 보세요.
**Incident Precision, False Positive Rate, Median Triage Time.**
v0.1은 이 셋이 좋아지면 성공입니다.

---

## Codex / Claude 역할 분담

여기는 아주 명확하게 쪼개는 게 좋습니다.

### Codex가 메인으로 맡을 것

- `backend/src/integrity/*`

- evaluator / replay / CLI

- SQL / 정규화 / API contract

- fixture / expected / regression test

- `/api/integrity/*` 구현

- low-risk backend refactor

- typecheck / curl / smoke test


### Claude Code가 메인으로 맡을 것

- `frontend/src/app/tracking-integrity/*`

- incident 상세 UX

- operator summary copy

- action center 문구

- runbook

- `agent/programs/*.md` 초안

- evidence 읽기 쉬운 보고서

- 화면 흐름 / 와이어 / 설명 템플릿


### 같이 붙는 구간

- Codex가 evaluator/API 구현 → Claude가 운영자 가독성 리뷰

- Claude가 UI 초안 → Codex가 데이터 바인딩 / 테스트 검증

- 둘 다 complex task 시작 전 `plans/*.md` 업데이트


이 분업은 지금 저장소 메모의 “Codex는 백엔드/검증에 강하고, Claude Code는 UI/운영자 이해/긴 문맥 정리에 강하다”는 경험칙과 잘 맞습니다.

---

## Phase별 작업 순서

## Phase 0. 기준선 문서 고정

가장 먼저 해야 합니다.

만들 파일:

- `/AGENTS.md`

- `/CLAUDE.md`

- `/PLANS.md`

- `/plans/2026-04-16-integrity-agent-v0.md`

- `/agent/programs/revenue-integrity.md`

- `/agent/programs/data-freshness.md`


이 Phase의 목표는 단 하나입니다.

**“정본 전환, freshness, 금지 행동, done 조건을 문서로 먼저 잠그는 것”**

완료 기준:

- Codex와 Claude가 같은 용어를 쓴다

- `confirmed`, `pending`, `refund`, `stale`, `provisional` 뜻이 안 흔들린다

- complex task는 plan을 먼저 만든다


OpenAI는 Codex에 `AGENTS.md`로 지속 규칙을 주고, 복잡한 일에는 계획 문서 템플릿을 두는 방식을 권장합니다. Claude도 `CLAUDE.md`와 plan mode, hooks, subagents를 중심으로 씁니다. ([OpenAI 개발자](https://developers.openai.com/codex/guides/agents-md "https://developers.openai.com/codex/guides/agents-md"))

---

## Phase 1. Verification Harness 구축

여기서부터 진짜입니다.

구현:

- `backend/src/integrity/contracts/*`

- `backend/src/integrity/evaluators/*`

- `backend/src/integrity/replay/*`

- `agent/evals/fixtures/*`

- `agent/evals/expected/*`


추가 명령:

```bash
npm --prefix backend run integrity:check
npm --prefix backend run integrity:replay
```

검사 항목:

- freshness

- order truth match

- CAPI dedup

- lead/purchase 분리

- test/debug 제외

- CRM segment 정합성


완료 기준:

- 같은 fixture 입력이면 같은 incident가 나온다

- AI 설명이 달라져도 숫자 판정은 안 바뀐다


이게 현재 문서에서 제일 먼저 만들 가치가 높다고 본 `Verification Harness`입니다.

---

## Phase 2. Read-only Incident API

구현:

- `GET /api/integrity/health`

- `GET /api/integrity/summary`

- `GET /api/integrity/incidents`

- `GET /api/integrity/incidents/:id`

- `GET /api/integrity/orders/search`

- `POST /api/integrity/incidents/:id/feedback`


동시에 만들 것:

- `agent/evidence/YYYY-MM-DD/*.json`

- `agent/evidence/YYYY-MM-DD/*.md`


완료 기준:

- biocom / coffee / AIBIO를 같은 health surface에서 볼 수 있다

- incident 하나를 열면 샘플 주문, 원인 후보, evidence, recommended action이 같이 보인다


이 단계가 되면 문서의 `Revenue Integrity Agent read-only MVP`가 실제 제품 골격이 됩니다.

---

## Phase 3. 운영자 UI + 승인/재검증

구현:

- `frontend/src/app/tracking-integrity/page.tsx`

- `incidents/[id]/page.tsx`

- `orders/page.tsx`

- `settings/page.tsx`

- `action-center/page.tsx`


필수 버튼:

- 실제 문제

- 정상 차이

- 무시

- 보류

- 승인

- 재검증 예약


완료 기준:

- 운영자가 1분 안에 “진짜 문제인지 / 아직 잠정치인지 / 조치가 필요한지” 판단할 수 있다

- 승인 없는 write-back은 없다


현재 문서가 강조한 “증거 먼저, 판단용 UI, Action Center”를 여기서 구현합니다.

---

## Phase 4. 재귀개선 루프 시작

이제서야 “자기개선”을 켭니다.

야간 작업:

1. 최근 30~50건 labeled incident 불러오기

2. 현재 버전 baseline 성능 측정

3. 후보 버전 생성

    - program files

    - prompts

    - hook rules

    - evidence template

4. replay 실행

5. precision/FP/triage score 개선 시 `agent/proposals/YYYY-MM-DD/*`에 proposal 저장

6. draft PR 생성


여기서 핵심은:

**개선 대상은 “설명하는 방식”과 “증거를 묶는 방식”이지, 진실 계산기 자체가 아닙니다.**

이게 업로드 문서에서 말한 “오토리서치의 핵심만 가져오자”의 정확한 구현입니다.

---

## Phase 5. Low-risk 자동화 확대

이 단계부터 일부 자동 패치를 허용합니다.

허용 시작:

- 테스트 추가

- fixture 보강

- runbook 업데이트

- operator UI copy

- evidence template 개선

- 문서/PR 초안


여전히 금지:

- GTM/Meta write-back

- DB schema

- prod env

- truth rule 변경


여기서는 Claude hooks가 특히 유용합니다. Anthropic 문서도 hooks를 **결정적으로 항상 실행되는 규칙**으로 설명하므로, 파일 편집 후 typecheck, smoke test, evidence dump 같은 걸 자동으로 묶기에 좋습니다. ([Claude](https://code.claude.com/docs/en/hooks-guide "https://code.claude.com/docs/en/hooks-guide"))

---

## Phase 6. CRM / Experiment 연결

이건 v0.1 안정화 후입니다.

붙일 것:

- CRM Segment Agent

- Experiment / holdout evaluator

- iROAS 결과를 incident 우선순위에 반영


하지만 이건 반드시 **Phase 1~4가 안정화된 다음**입니다. 지금 문서 우선순위도 그 순서가 맞습니다.

---

## 우리 저장소에서 병렬 에이전트를 쓰는 규칙

이건 아주 실무적으로 적겠습니다.

### 병렬 허용

- 백엔드 evaluator 조사

- 프론트 와이어/UX 설계

- 외부 문서/API 확인

- 경쟁 가설 디버깅

- 다만 서로 **같은 파일을 안 건드릴 때만**


### 병렬 금지

- 같은 route contract를 동시에 만질 때

- 같은 tracking script를 동시에 만질 때

- 같은 evaluator를 동시에 수정할 때

- truth rule과 UI를 한 번에 동시에 흔들 때


### 강제 규칙

- 부모 에이전트만 자식 에이전트를 부를 수 있음

- 자식은 자식을 못 부름

- 최대 동시 자식 3개

- depth = 1 유지

- 병렬 작업은 read-only 조사나 독립 모듈에 한정


OpenAI도 깊은 fan-out을 경고하고, Anthropic도 subagents/teams를 **독립성이 높은 병렬 작업**에 쓸수록 좋다고 설명합니다. ([OpenAI 개발자](https://developers.openai.com/codex/subagents "https://developers.openai.com/codex/subagents"))

---

## `PLANS.md`에 들어가야 할 실제 섹션

이건 이렇게 두면 됩니다.

```md
# <작업 이름>

## Purpose / Big Picture
이 작업이 끝나면 사용자가 무엇을 할 수 있는가

## Progress
- [ ] ...
- [x] ...

## Surprises & Discoveries
예상과 달랐던 점, 버그, 성능 tradeoff

## Decision Log
무슨 결정을 왜 내렸는지

## Outcomes & Retrospective
무엇이 끝났고, 무엇이 남았는지

## Context and Orientation
이 저장소의 어떤 파일/모듈을 봐야 하는지

## Plan of Work
어느 파일을 어떻게 바꿀지

## Concrete Steps
실행 명령과 순서

## Acceptance
무엇이 보이면 성공인지
```

OpenAI 가이드 기준으로 보면, 이 문서는 **작업 지시서이자, 작업 진행 기록이자, 다음 사람이 이어받을 수 있는 상태 저장소**입니다. 그래서 “살아있는 작업 문서”라는 표현이 딱 맞습니다. ([OpenAI 개발자](https://developers.openai.com/cookbook/articles/codex_exec_plans "https://developers.openai.com/cookbook/articles/codex_exec_plans"))

---

## 마지막으로 아주 짧게 요약하면

이 저장소에서의 재귀개선은
**“AI가 자기 코드를 마음대로 계속 고치는 것”**이 아니라,

**“고정 평가기 위에서, incident 처리 방식과 증거 패키지와 운영 규칙을 조금씩 개선하는 것”**입니다.

그리고 병렬 에이전트는
**“동시에 일하는 여러 작업자”** 정도로만 쓰고,
그 작업자가 또 작업자를 낳는 구조는 막아야 합니다.

`PLANS.md`는
**로드맵이 아니라, 복잡한 작업 하나를 끝까지 밀기 위한 살아있는 실행 문서**입니다.

이 설계를 기준으로 다음 단계는 바로 파일 수준으로 내려갈 수 있습니다.
`AGENTS.md`, `CLAUDE.md`, `PLANS.md`, `agent/programs/revenue-integrity.md` 초안부터 쓰면 구현이 훨씬 덜 흔들립니다.