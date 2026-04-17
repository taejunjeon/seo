2026-04-15~2026-04-16 문서와 최근 자료를 같이 보면, 이 프로젝트에서 **‘재귀개선 AI 피드백 루프’는 충분히 가능**합니다. 다만 형태는 “밤새 알아서 제품 코드를 계속 고치는 자율 에이전트”가 아니라, **고정 평가기 위에서 에이전트의 스킬·프롬프트·라우팅·증거 패키지를 계속 개선하는 얕은 재귀 루프**여야 합니다. 지금 문서도 이미 `수집 → 정규화 → 매칭 → 차이 탐지 → 원인 진단 → 액션 제안 → 사람 승인 → 재검증` 루프, `read-only Agent`, `Verification Harness`, `Evidence Store`, `Approval Gate`, 그리고 **규칙 엔진 / AI 설명 엔진 분리**를 전제로 하고 있어서, 출발점은 꽤 좋습니다.

이 방향은 최근 공식 툴 흐름과도 잘 맞습니다. OpenAI 쪽은 Codex에 `AGENTS.md`, repo-local skills, `PLANS.md`, worktrees, automations, explicit subagents를 강조하고 있고, Anthropic 쪽도 Plan mode, hooks, subagents/agent teams를 공식 패턴으로 밀고 있습니다. 다만 양쪽 다 공통적으로, **병렬 에이전트는 토큰/조정 비용이 크고 재귀 fan-out이 깊어질수록 예측 가능성이 떨어진다**고 봅니다. Codex는 subagent 깊이를 기본 1단으로 두고 깊은 fan-out을 경고하고, Claude Code도 agent teams는 독립적인 작업에만 쓰라고 안내합니다. 그래서 이 프로젝트의 “재귀개선”은 **깊은 자기복제형 루프가 아니라, 1단 fan-out + 사람 승인 + 재검증**이 맞습니다. ([OpenAI 개발자](https://developers.openai.com/cookbook/examples/gpt-5/codex_prompting_guide "https://developers.openai.com/cookbook/examples/gpt-5/codex_prompting_guide"))

제 판단을 한 줄로 말하면 이렇습니다.
**지금 필요한 건 vibe coding의 확장이 아니라, evaluator-driven agentic engineering입니다.** Karpathy의 AutoResearch에서 실제로 가져와야 하는 건 “AI가 똑똑하다”가 아니라 **고정된 평가기, 제한된 수정 범위, 결과 로그, 개선될 때만 유지**라는 운영 규율입니다. 그 점에서 문서의 큰 방향은 맞습니다. 특히 “숫자 계산은 코드, 설명은 AI”라는 분리는 아주 중요하고, 이 프로젝트처럼 광고·GA4·주문·CAPI가 얽힌 환경에서는 거의 필수에 가깝습니다. ([GitHub](https://github.com/karpathy/autoresearch/blob/master/README.md "https://github.com/karpathy/autoresearch/blob/master/README.md"))

제가 추천하는 **재귀개선 루프의 정답 형태**는 3층입니다 😊

첫째는 **Truth Loop**입니다. 이건 프로덕션에 가장 가까운 루프라서 완전히 결정적이어야 합니다. `integrity:check` 같은 고정 evaluator가 원장 신선도, CAPI dedup, lead/purchase 분리, test/debug 제외, CRM segment 정합성을 체크하고, `GET /api/integrity/health`, `incidents`, `incident detail`로 노출합니다. 이 층에서는 AI가 숫자를 바꾸면 안 되고, 오직 incident 요약과 원인 후보, 액션 초안만 만듭니다. 지금 문서의 `Revenue Integrity Agent read-only MVP` 설계가 정확히 이 층입니다.

둘째는 **Skill Loop**입니다. 여기서만 “재귀개선”을 돌립니다. 개선 대상은 프로덕션 코드가 아니라 `agent/programs/*.md`, `AGENTS.md`, `CLAUDE.md`, skills, hooks, evidence 템플릿, incident 라우팅, 설명 템플릿 같은 **에이전트 운영 규칙**입니다. 지난 30일 incident replay를 돌려서 `false positive`, `triage 시간`, `evidence completeness`, `사람이 dismiss한 비율`이 좋아졌을 때만 변경을 채택하면 됩니다. 이건 AutoResearch의 패턴과도 닮아 있고, OpenAI의 skills/evals 문서와 Anthropic의 짧은 `CLAUDE.md` + skills 권장 패턴에도 잘 맞습니다. ([GitHub](https://github.com/karpathy/autoresearch/blob/master/README.md "https://github.com/karpathy/autoresearch/blob/master/README.md"))

셋째는 **Guarded Patch Loop**입니다. 이건 나중 단계입니다. read-only loop가 안정되면, 에이전트가 low-risk 수정만 **draft PR**로 제안하게 합니다. 예를 들면 테스트 추가, 문서 갱신, evidence 파일 포맷 정리, 누락된 `PLANS.md` 생성, 경고 문구 개선 같은 것들입니다. 반대로 GTM/Meta 태그, DB 스키마, 운영 데이터, 광고 write-back, 개인정보 범위 확대는 지금 문서처럼 계속 승인 게이트 뒤에 둬야 합니다. 이 구분은 그대로 유지하는 게 맞습니다.

최근 바이브코딩/에이전트 활용 방법론 중에서, **지금 바로 가져오면 좋은 것**도 꽤 명확합니다.

첫 번째는 **AGENTS.md + CLAUDE.md + PLANS.md 삼각형**입니다. Codex는 repo의 `AGENTS.md`를 자동으로 읽고, OpenAI는 긴 문제에 `PLANS.md` 같은 living doc를 쓰는 방식을 공식적으로 권장합니다. Anthropic도 `CLAUDE.md`는 짧고 사람 친화적으로 두고, 무거운 지식은 skills나 별도 문서로 빼라고 합니다. 여러분 프로젝트에서는 루트에 공통 계약만 두고, 도메인별로는 `agent/programs/revenue-integrity.md`, `data-freshness.md`, `capi-quality.md`처럼 쪼개는 지금 안이 아주 좋습니다. 다만 `CLAUDE.md` 하나에 다 넣는 방식은 피하는 게 좋습니다. ([OpenAI 개발자](https://developers.openai.com/cookbook/examples/gpt-5/codex_prompting_guide "https://developers.openai.com/cookbook/examples/gpt-5/codex_prompting_guide"))

두 번째는 **hooks를 품질 게이트로 쓰는 것**입니다. Anthropic은 hooks를 공식 기능으로 두고 있고, Lenny 쪽 공개 정리에서도 고급 사용자들이 stop hooks와 system prompts로 품질 체크를 자동화한다고 나옵니다. 이 프로젝트에서는 post-edit hook로 `tsc`, 핵심 API smoke test, Playwright screenshot, evidence dump 생성을 걸어두는 게 ROI가 큽니다. 즉, “에이전트가 잘했는지”를 나중에 사람이 감으로 보는 게 아니라, **수정 직후 자동 증거를 남기게** 만드는 겁니다. ([Claude](https://code.claude.com/docs/en/hooks-guide "https://code.claude.com/docs/en/hooks-guide"))

세 번째는 **rich context > clever prompting**입니다. John Lindquist 사례 정리에서 나오는 핵심이 “영리한 프롬프트보다 압축된 맥락”이고, mermaid diagram 같은 구조화된 컨텍스트가 특히 잘 먹힌다고 합니다. 여러분 저장소는 문서·백엔드·프론트·추적 스크립트·운영DB 가정이 한 군데 섞여 있어서, `biocom`, `coffee`, `AIBIO` 각각의 truth flow를 mermaid 하나로 고정해두면 Codex/Claude 둘 다 훨씬 덜 헤맵니다. ([렌니스 뉴스레터](https://www.lennysnewsletter.com/p/this-week-on-how-i-ai-advanced-claude "https://www.lennysnewsletter.com/p/this-week-on-how-i-ai-advanced-claude"))

네 번째는 **codebase Q&A + quirks page**입니다. Galileo 사례에서 공개된 패턴은, 내부 문서보다 현재 코드가 더 최신 source of truth인 경우가 많아서, 코드베이스와 내부 문서를 같이 읽게 하고 별도 “quirks page”를 유지하는 방식입니다. 이 프로젝트에도 이게 정말 잘 맞습니다. `site quirks`를 따로 두세요. 예를 들면 `coffee는 Imweb site_code 이슈`, `GA4 property 권한`, `Toss MID 차이`, `pending→confirmed CAPI`, `AIBIO test lead 분리` 같은 식으로요. 이건 incident 품질을 꽤 끌어올릴 겁니다. ([렌니스 뉴스레터](https://www.lennysnewsletter.com/p/this-week-on-how-i-ai-i-gave-claude "https://www.lennysnewsletter.com/p/this-week-on-how-i-ai-i-gave-claude"))

다섯 번째는 **red/green TDD + “first run the tests”**입니다. Simon Willison은 AI 코딩에서 red/green TDD를 반복적으로 강조하고, “먼저 테스트를 돌려라” 같은 문장이 이후 행동을 크게 바꾼다고 설명합니다. 이 프로젝트에서는 모든 integrity 이슈 수정이 “실패 재현 fixture 1개 추가 → evaluator 실패 확인 → 패치 → evaluator 통과”로 가야 합니다. 그냥 프롬프트로 원인 설명을 더 잘하게 만드는 것보다, **재현 fixture를 늘리는 게 훨씬 강한 재귀개선**입니다. ([Simon Willison’s Weblog](https://simonwillison.net/guides/agentic-engineering-patterns/red-green-tdd/ "https://simonwillison.net/guides/agentic-engineering-patterns/red-green-tdd/"))

여섯 번째는 **모델 간 peer review**입니다. Lenny 쪽 공개 인터뷰/정리에는 서로 다른 AI가 서로의 코드를 리뷰하게 하는 패턴이 계속 보입니다. 이건 여러분에게도 괜찮습니다. 예를 들면 **Codex가 backend patch를 만들고 Claude reviewer subagent가 operator UX/문구/위험 범위를 본다**, 혹은 반대로 **Claude가 설계/와이어를 만들고 Codex가 구현 + 타입체크를 맡는다** 같은 식입니다. 단, auto-merge는 금지하고 PR comment 또는 evidence note까지만 자동화하는 게 맞습니다. ([렌니스 뉴스레터](https://www.lennysnewsletter.com/p/the-non-technical-pms-guide-to-building-with-cursor "https://www.lennysnewsletter.com/p/the-non-technical-pms-guide-to-building-with-cursor"))

이제 문서를 재평가해보면, **도움된다고 한 것 중 실제로도 거의 맞는 것**은 이 다섯 가지입니다.
`Verification Harness 먼저`, `Evidence Store 파일 기반 시작`, `Work Queue + Approval Gate`, `Conversion Dictionary + freshness 선행`, `규칙 엔진/AI 설명 엔진 분리`는 그대로 가는 게 좋습니다. 특히 “정본 전환과 freshness가 먼저”라는 로드맵의 우선순위는 매우 맞습니다. 현재 백엔드에 autosync background job 코드가 이미 있어도, 운영에서 VM env 활성화와 pending→confirmed 검증이 안 닫히면 recursive loop가 가짜 incident만 늘릴 수 있기 때문입니다.

반대로 **문서에서 별로라고 한 것 중 재평가할 만한 것**도 있습니다.

`범용 자율 개발 에이전트 UI`는 지금 당장 우선순위가 낮은 건 맞습니다. 하지만 **아주 얇은 Action Center / Task Inbox**는 생각보다 빨리 필요합니다. 여러분 문서도 결국 승인/재검증/증거를 OS의 중심에 놓고 있고, Codex/Claude 모두 병렬 작업과 하위 에이전트가 늘어날수록 사람 쪽 “업무 큐”가 중요해집니다. 그러니까 **“generic autonomous dev UI”는 별로지만, “operator action center”는 오히려 앞당겨도 좋은 것**입니다. ([OpenAI 개발자](https://developers.openai.com/codex/app "https://developers.openai.com/codex/app"))

`UI polish 전용 에이전트`를 후순위로 둔 것도 대체로 맞습니다. 다만 여기서는 “예쁜 UI”와 “운영자가 1분 안에 판단하는 UI”를 분리해야 합니다. 문서에도 이미 freshness, evidence, severity, approval이 핵심이라고 되어 있죠. 그러니 **순수 polish는 후순위**지만, **freshness badge, evidence-first incident detail, approval CTA 같은 ‘판단용 UI’는 생각보다 핵심 기능**입니다. 이건 Claude Code가 잘 맡을 수 있는 영역이기도 하고요.

`AI 뉴스 자동 수집만 하는 기능`을 별로라고 본 것도 맞습니다. 다만 완전히 버리기보다는 **월 1회 “패턴 큐레이션 → skills/runbook 반영”**으로 바꾸면 쓸 만합니다. 최근 툴 생태계는 Codex, Claude Code, Cursor, ChatGPT 등 purpose-built 도구들이 빠르게 변하고 있고, 실제 엔지니어 사용도 꽤 분산돼 있습니다. 그래서 “뉴스 수집” 자체는 가치가 낮지만, **패턴을 추려서 AGENTS/skills/hook 규칙으로 흡수하는 루프**는 가치가 있습니다. ([렌니스 뉴스레터](https://www.lennysnewsletter.com/p/ai-tools-are-overdelivering-results "https://www.lennysnewsletter.com/p/ai-tools-are-overdelivering-results"))

오히려 문서가 **조금 과하게 보수적인 부분**은 `Nightly Read-only Ops Research만` 먼저 하자는 대목입니다. 1단계에서는 맞지만, evaluator가 붙는 순간부터는 **low-risk 자동 개선**을 일부 허용해도 됩니다. 예를 들어 테스트 보강, incident evidence 요약, stale docs 정리, PR 초안, runbook diff 같은 것은 샌드박스에서 자동 생성해도 리스크가 매우 낮습니다. “프로덕션 수정 금지”와 “개발/문서/테스트 자동개선 금지”를 같은 선으로 묶을 필요는 없습니다. ([OpenAI 개발자](https://developers.openai.com/blog/eval-skills "https://developers.openai.com/blog/eval-skills"))

`Codex = 백엔드 / Claude Code = 프론트` 분업은 좋은 기본값입니다. 실제 프로젝트 메모에서도 큰 백엔드 덩어리를 Codex에 위임했을 때 `tsc`와 curl 검증까지 잘 끝났고, 상태 확인은 `rescue status`보다 `git diff / tsc / curl / result notification`이 훨씬 신뢰된다고 남아 있습니다. 이 실전 팁은 꽤 좋습니다. 다만 이것도 **역할의 법칙**이라기보다 **작업 모양의 기본값**으로 두는 게 낫습니다. 설계·리뷰·설명·운영 문서는 Claude가 세고, 긴 백엔드 패치·타입체크·병렬 worktree 구현은 Codex가 강한 편입니다. ([OpenAI 개발자](https://developers.openai.com/codex/app "https://developers.openai.com/codex/app"))

그래서 저는 이 프로젝트의 **재귀개선 루프를 이렇게 고정**하는 걸 추천합니다.

1. **평가기 고정**
    `integrity:check`와 incident replay 세트를 먼저 고정합니다. 이건 AI가 못 건드리게 둡니다.

2. **개선 대상 제한**
    초기에는 `agent/programs/*.md`, `AGENTS.md`, `CLAUDE.md`, hooks, evidence template, incident 설명 prompt만 자동 제안 대상으로 둡니다. 숫자 계산 로직, GTM/Meta/DB/prod config는 제외합니다.

3. **주간 replay 학습**
    지난 30개 incident를 재실행해서 precision, false positive, triage time, dismissed ratio를 비교합니다. 좋아질 때만 반영합니다. AutoResearch 스타일로요. ([GitHub](https://github.com/karpathy/autoresearch/blob/master/README.md "https://github.com/karpathy/autoresearch/blob/master/README.md"))

4. **1단 fan-out만 허용**
    Sync Freshness / CAPI Integrity / Guard Verification 같은 좁은 read-only agent는 좋지만, 그 안에서 또 실행 에이전트를 재귀적으로 부르는 건 금지합니다. ([OpenAI 개발자](https://developers.openai.com/codex/subagents "https://developers.openai.com/codex/subagents"))

5. **모델 간 교차검토**
    Codex patch → Claude review, 또는 Claude plan → Codex implement 구조로 교차검토만 넣습니다. auto-merge는 하지 않습니다. ([렌니스 뉴스레터](https://www.lennysnewsletter.com/p/the-non-technical-pms-guide-to-building-with-cursor "https://www.lennysnewsletter.com/p/the-non-technical-pms-guide-to-building-with-cursor"))


실행 우선순위도 문서와 거의 같습니다.
지금은 **truth layer 닫기 → `Verification Harness` → `integrity` API → Evidence Store → Approval Gate → feedback/revalidation** 순서가 맞습니다. 여기에 제가 하나만 더하면, **hooks + replay eval**을 Phase 2 초반에 같이 넣는 겁니다. 그러면 재귀개선 루프가 단순 아이디어가 아니라 바로 돌아가기 시작합니다. ([Claude](https://code.claude.com/docs/en/hooks-guide "https://code.claude.com/docs/en/hooks-guide"))

마지막으로 진짜 한 줄 결론만 남기면,
**이 프로젝트에 맞는 건 “자율 코딩 에이전트”가 아니라 “측정 신뢰도를 지키는 얕은 재귀개선 루프”입니다.**
vibe coding은 incident 화면, action center, 내부 운영 UI 같은 **비핵심·가역적 표면**에만 쓰고, purchase guard·CAPI·광고 업로드·DB 변경은 지금 문서대로 **evaluator-driven, evidence-first, human-approved**로 가는 게 맞습니다. 그 방향은 최근 Codex/Claude Code의 공식 운영 패턴과도 잘 맞습니다. ([OpenAI 개발자](https://developers.openai.com/blog/skills-agents-sdk "https://developers.openai.com/blog/skills-agents-sdk"))

원하시면 다음 답변에서 바로 **“우리 저장소용 재귀개선 루프 v0.1 설계안”** 형태로, 디렉터리 구조·에이전트 정의·평가 지표·Codex/Claude 역할 분담까지 아주 구체적으로 적어드리겠습니다.