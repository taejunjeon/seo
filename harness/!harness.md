# Growth Data Agent Harness 조사 및 설계

작성 시각: 2026-04-30 23:16 KST
최종 업데이트: 2026-05-01 00:20 KST
작성 범위: 문서 설계만. 실제 운영 변경, DB write, GA4/Meta/TikTok/Google Ads 전송 없음.
관련 문서: [[docs/agent-harness/growth-data-harness-v0|Growth Data Harness v0]], [[harness/npay-recovery/README|NPay Recovery Harness]], [[harness/npay-recovery/AUDITOR_CHECKLIST|Auditor Checklist]], [[harness/npay-recovery/LESSONS_TO_RULES_SCHEMA|Lessons-to-Rules Schema]], [[naver/!npayroas|NPay ROAS 정합성 회복 계획]]
Primary source: LangChain harness engineering 글, Deep Agents/LangGraph/LangSmith/OpenAI Agents SDK/Claude Code/Codex 공식 문서, Notion `하네스 주주총회 04/30/2026/중요`, 로컬 NPay ROAS 문서
Freshness: 외부 자료 2026-04-30 조회, 로컬 NPay 기준 `naver/!npayroas.md` 2026-04-30 21:30 KST
Confidence: 88%

## 10초 요약

적용 가능하다. 현재 NPay ROAS 정합성 작업은 이미 `agent harness`의 60-70%까지 와 있다. 다만 지금은 규칙, dry-run, 승인 게이트, 교훈이 여러 문서와 대화에 흩어져 있어서 Codex, Claude, ChatGPT가 같은 방식으로 반복 실행하기 어렵다.

바로 도입할 v0는 거대한 LangGraph 구현이 아니다. 먼저 문서형 하네스를 만든다. `TASK`, `CONTEXT_PACK`, `RULES`, `VERIFY`, `APPROVAL_GATES`, `AUDITOR_CHECKLIST`, `LESSONS_TO_RULES_SCHEMA`를 고정하면 된다.

2026-05-01 00:20 KST 기준 NPay recovery 하네스 v0 파일 세트는 작성 완료 상태다. 다음은 이 기준판을 더클린커피 BigQuery-first read-only 정합성에 적용한다.

첫 적용 대상은 NPay recovery가 맞다. 이미 intent 수집, 운영 주문 매칭, A급/B급/ambiguous 분류, BigQuery guard, robust_absent, manual_test_order 제외, human approval 루프가 있기 때문이다.

## 결론

우리 프로젝트에서 agent harness는 아래 의미로 정의한다.

> Growth Data Agent Harness = AI가 GA4, GTM, NPay, TikTok, Meta, BigQuery, 운영 DB 정합성 작업을 반복할 때 항상 같은 컨텍스트, 같은 금지선, 같은 검증, 같은 승인 게이트, 같은 교훈 승격 절차를 따르게 하는 작업장.

이는 단순 프롬프트 모음이 아니다. 모델 주변의 작업 환경과 검증 루프를 설계하는 것이다. LangChain은 harness engineering을 모델 성능 자체가 아니라 system prompt, tool choice, execution flow 등 모델 주변 시스템을 조정해 task performance, latency, token efficiency를 최적화하는 일로 설명한다. 참고: https://www.langchain.com/blog/improving-deep-agents-with-harness-engineering

OpenAI도 Codex harness engineering 글에서 사람의 역할이 코드를 직접 쓰는 것에서 환경 설계, intent 명세, feedback loop 구축으로 이동한다고 설명한다. 참고: https://openai.com/index/harness-engineering/

## 공식/신뢰 자료 기준 개념 정리

| 출처 | 핵심 내용 | 우리 프로젝트 해석 |
|---|---|---|
| LangChain harness engineering | 모델을 고정해도 prompt, tools, middleware, tracing, verification을 바꾸면 agent 성능이 오른다 | GPT/Claude 모델 비교보다 `작업장` 설계가 먼저다 |
| LangChain Deep Agents | Deep Agents는 planning, filesystem context, subagents, memory, permission, HITL을 포함한 agent harness로 설명된다 | NPay recovery도 `계획-실행-검증-승인` 루프가 있어 하네스화 가능 |
| LangGraph durable execution | side effect는 idempotent해야 하고, resume/replay 시 반복되지 않게 task/checkpoint로 감싼다 | GA4 MP/Meta CAPI/TikTok 전송은 idempotency key와 승인 게이트 없이는 열면 안 된다 |
| LangGraph interrupts | human-in-the-loop은 DB 변경, API call, 금융 트랜잭션 같은 민감 작업 전 pause/approval로 쓴다 | TJ 승인 전 DB write/전송/배포 금지가 구조화되어야 한다 |
| LangSmith | trace, eval, dashboard, feedback으로 agent 품질을 반복 개선한다 | dry-run 리포트, BigQuery 결과, commit diff, 사용자 피드백을 eval log로 남긴다 |
| OpenAI Agents SDK | guardrails, tracing, context, HITL이 first-class 구성요소다 | Auditor agent와 no-send guard를 prompt가 아니라 실행 규칙으로 격상해야 한다 |
| Claude Code | hooks, permissions, subagents를 통해 도구 실행 전후 검사와 전문 에이전트 분리가 가능하다 | Claude Code가 리뷰할 때도 같은 auditor checklist를 쓰게 한다 |
| Codex | AGENTS.md, 테스트/로그 citation, isolated environment, repository-local docs가 중요하다 | `docurule.md`, `AGENTS.md`, `harness/`를 Codex의 기준 지도로 만든다 |

### 참고 자료

| 자료 | 링크 |
|---|---|
| LangChain harness engineering | https://www.langchain.com/blog/improving-deep-agents-with-harness-engineering |
| LangChain Deep Agents overview | https://docs.langchain.com/oss/python/deepagents/overview |
| LangGraph durable execution | https://docs.langchain.com/oss/python/langgraph/durable-execution |
| LangGraph interrupts / HITL | https://docs.langchain.com/oss/python/langgraph/interrupts |
| LangSmith observability | https://docs.langchain.com/langsmith/observability |
| LangSmith evaluation concepts | https://docs.langchain.com/langsmith/evaluation-concepts |
| OpenAI Agents SDK guardrails | https://openai.github.io/openai-agents-python/guardrails/ |
| OpenAI Agents SDK tracing | https://openai.github.io/openai-agents-python/tracing/ |
| OpenAI Agents SDK HITL | https://openai.github.io/openai-agents-python/human_in_the_loop/ |
| OpenAI Agents SDK context | https://openai.github.io/openai-agents-python/context/ |
| OpenAI Codex harness engineering | https://openai.com/index/harness-engineering/ |
| OpenAI Codex introduction | https://openai.com/index/introducing-codex/ |
| Claude Code hooks | https://docs.anthropic.com/en/docs/claude-code/hooks |
| Claude Code settings/permissions | https://docs.anthropic.com/en/docs/claude-code/settings |
| Claude Code subagents | https://docs.anthropic.com/en/docs/claude-code/sub-agents |
| Notion reference | https://www.notion.so/04-30-2026-3521a1c96f96807baa2adc5ccbeb50b7?source=copy_link |

## Notion 문서 반영

참조 문서: https://www.notion.so/04-30-2026-3521a1c96f96807baa2adc5ccbeb50b7?source=copy_link

Notion 문서의 핵심은 하네스를 `셀프 코렉팅 시스템`으로 보는 것이다.

| Notion 인사이트 | 반영 방식 |
|---|---|
| 하네스 피드백은 일반 피드백과 다르다. 쓰면 쓸수록 좋아지는 시스템이다 | `LESSONS_TO_RULES_SCHEMA`로 observation을 approved rule까지 승격 |
| 컨텍스트를 말랑말랑하게 구성하되 일관성 있게 운영해야 한다 | `CONTEXT_PACK.md`는 고정하되, phase별 필요한 문서만 조립 |
| 스킬은 동적 프롬프팅에 가깝고, 스킬만 있다고 하네스는 아니다 | reusable skill은 v1 이후. v0는 rule/verify/approval부터 고정 |
| C2/C4가 나와야 하는데 C1/C2가 나오면 verification/context/rules 중 무엇이 틀렸는지 재점검해야 한다 | dry-run 실패 시 `rule_error`, `context_gap`, `verification_gap`, `source_gap` 원인 필드 추가 |
| 암묵지를 디지털화해야 조직 지식이 복리처럼 쌓인다 | 매번의 NPay 예외를 `candidate_rule`로 남기고 반복 확인 후 `approved_rule`로 승격 |
| 하네스는 과적합 위험이 있다 | evidence_count, confidence, owner, deprecated_rule을 schema에 포함 |

## Agent Harness 핵심 구성요소

| 구성요소 | 의미 | NPay recovery 예시 |
|---|---|---|
| context assembly | 작업에 필요한 문서, 데이터 위치, 최신 숫자를 자동 조립 | `!npayroas`, dry-run report, BigQuery guard 결과, 운영 DB/VM SQLite 위치 |
| task planning | phase와 sprint별로 allowed/forbidden을 나누는 계획 | Phase2 read-only, Phase3 limited test, 7일 후보정 |
| tool permissions | 읽기/쓰기/전송 권한을 분리 | Phase2는 운영 DB read-only, DB write/전송 금지 |
| dry-run / verification | 실제 반영 없이 결과 계산 후 검증 | matched/ambiguous/clicked_no_purchase 분류 |
| trace logs | 실행 입력, 명령, 결과, 변경 파일, 검증 결과 기록 | `npay-roas-dry-run-20260430.md`, JSON result, commit log |
| auditor | Codex 산출물이 금지선을 넘었는지 검사 | ambiguous send 후보 여부, unrelated dirty files 포함 여부 |
| human-in-the-loop approval | 민감 작업 전 사람 승인 | GA4 MP 제한 테스트 전 TJ 승인 |
| lessons-to-rules | 반복 예외를 규칙으로 승격 | 배송비 차이는 `shipping_reconciled`, 두 주문번호 동시 조회 |
| skills / memory | 반복 작업의 지식과 실행법 재사용 | v1에서 `npay-recovery` skill 또는 Claude subagent |
| eval logs | 하네스 자체 품질 평가 | A급 비율, ambiguous 비율, false positive/duplicate guard |

## 현재 프로젝트에 이미 있는 Harness 요소

| 요소 | 현재 상태 | 근거 |
|---|---|---|
| 정본 문서 | 있음 | `naver/!npayroas.md`가 목적, 현황, phase, 금지선을 보유 |
| dry-run | 있음 | `backend/src/npayRoasDryRun.ts`, `backend/scripts/npay-roas-dry-run.ts` |
| no-send guard | 있음 | GA4/Meta/TikTok/Google Ads 전송 금지 문구와 코드 경로 분리 |
| BigQuery guard | 있음 | `order_number + channel_order_no` 조회, `present/unknown/robust_absent` 분류 |
| A급/B급/ambiguous | 있음 | score, amount_match_type, time_gap, score_gap 기준 |
| manual_test_order exclusion | 있음 | 수동 테스트 주문은 A급이어도 send 금지 |
| robust_absent | 있음 | TJ robust query 결과 반영 |
| human approval | 있음 | GA4 MP 제한 테스트 1건 승인 후 실행 |
| trace/report | 있음 | dry-run markdown, approval 문서, result 문서 |
| 검증 | 일부 있음 | typecheck/test, BigQuery 확인, no-send 확인 |

## 현재 부족한 Harness 요소

| 부족한 것 | 왜 문제인가 | v0 보강 |
|---|---|---|
| 표준 task spec 없음 | 같은 작업을 매번 장문 프롬프트로 재설명해야 함 | `harness/npay-recovery/TASK.md` 작성 완료 |
| context pack 자동 로딩 없음 | Codex/Claude가 최신 숫자와 금지선을 놓칠 수 있음 | `CONTEXT_PACK.md` 작성 완료 |
| trace/eval log schema 없음 | 실행 간 비교, 실패 패턴 축적이 어렵다 | `EVAL_LOG_SCHEMA.md` 작성 완료 |
| auditor agent 없음 | 전송 금지/DB write 금지를 사람이 매번 확인해야 함 | `AUDITOR_CHECKLIST.md` 작성, coffee 확장 체크 추가 |
| lessons-to-rules pipeline 없음 | 배운 점이 문서 여기저기에 흩어진다 | `LESSONS.md`, `LESSONS_TO_RULES_SCHEMA.md` 작성 |
| reusable skill 없음 | 모델/툴이 바뀌면 같은 품질을 유지하기 어렵다 | v1에서 Codex skill/Claude subagent |
| stale number check 없음 | 문서 숫자와 최신 dry-run이 어긋날 수 있음 | auditor 항목에 숫자 freshness 체크 |

## Growth Data Harness v0 설계

v0는 문서형 하네스다. 목표는 자동화보다 일관성이다.

```text
docs/agent-harness/
  growth-data-harness-v0.md

harness/
  !harness.md
  npay-recovery/
    README.md
    AUDITOR_CHECKLIST.md
    LESSONS_TO_RULES_SCHEMA.md
    TASK.md
    CONTEXT_PACK.md
    RULES.md
    VERIFY.md
    APPROVAL_GATES.md
    LESSONS.md
    EVAL_LOG_SCHEMA.md
```

### v0

| 항목 | 내용 |
|---|---|
| 목적 | Codex/Claude/ChatGPT가 같은 규칙으로 NPay recovery 작업 수행 |
| 구현 수준 | Markdown 문서와 체크리스트 |
| 자동화 | 없음 또는 수동 실행 |
| 금지선 | DB write, 운영 endpoint 배포, GA4/Meta/TikTok/Google Ads 전송 금지 기본 |
| 성공 기준 | 작업 전 context, 작업 중 dry-run, 작업 후 auditor checklist가 문서로 남음 |

### v1

| 항목 | 내용 |
|---|---|
| 목적 | 반복 실행 가능한 CLI/agent workflow |
| 구현 수준 | trace/eval JSON schema, pre-completion checker, stale number checker |
| 자동화 | dry-run 후 문서 숫자 자동 대조, auditor report 생성 |
| 성공 기준 | 사람이 프롬프트를 길게 쓰지 않아도 phase별 작업 가능 |

### v2

| 항목 | 내용 |
|---|---|
| 목적 | multi-agent/self-correcting harness |
| 구현 수준 | LangGraph/Deep Agents/Claude Code hook/Codex skill 중 선택 |
| 자동화 | trace analyzer, lesson 승격 제안, human approval interrupt |
| 성공 기준 | 실패 패턴이 자동으로 candidate rule로 쌓이고 auditor가 강제 실행 |

## NPay Recovery 첫 적용 설계

| Phase | 목적 | 허용 | 금지 | 산출물 |
|---|---|---|---|---|
| Read-only phase | intent와 주문을 읽고 분류 | VM SQLite/운영 DB/BigQuery 조회 | DB write, 전송, 배포 | dry-run report |
| Dispatcher dry-run phase | 보낼 수 있는 payload 후보 계산 | payload preview, idempotency key preview | 실제 send | dispatcher dry-run log |
| GA4 MP limited test approval phase | 1-2건 제한 테스트 승인 여부 판단 | 승인안 작성, payload preview | 승인 전 send | approval 문서 |
| Post-send verification phase | 보낸 이벤트 수신/중복 확인 | BigQuery/Debug 결과 확인 | 재전송 | result 문서 |
| 7일 후보정 phase | 표본 확대 후 규칙 재검증 | A급/ambiguous/purchase_without_intent 재계산 | 자동 dispatcher 즉시 전환 | 후보정 리포트 |

## Auditor Agent 설계

Auditor는 Codex output과 git diff, dry-run report, 문서 숫자를 보고 아래를 검사한다.

| 검사 | 실패 조건 |
|---|---|
| 실제 전송 여부 | GA4/Meta/TikTok/Google Ads send 코드 또는 로그 존재 |
| DB write 여부 | 운영 DB update/insert/delete 또는 `match_status` 변경 |
| BigQuery guard | `already_in_ga4`가 `robust_absent`가 아닌데 후보 open |
| ambiguous | ambiguous 주문이 send 후보 |
| manual_test_order | 수동 테스트 주문이 send 후보 |
| unknown/present | `already_in_ga4=unknown/present`가 send 후보 |
| 숫자 일치 | 문서 summary와 최신 dry-run summary 불일치 |
| unrelated dirty files | 작업 범위 밖 변경 파일이 commit/stage에 포함 |
| 승인 문구 | human approval이 필요한 작업인데 승인 문서 없음 |
| stale context | 기준 시각, window, source, confidence 누락 |

자세한 기준판은 [[npay-recovery/AUDITOR_CHECKLIST]]에 작성했다.

## Lessons-to-Rules Pipeline

| 단계 | 의미 | 예시 |
|---|---|---|
| observation | 단일 관찰 | 8,900원 intent와 11,900원 주문이 배송비 3,000원 때문에 달랐다 |
| candidate_rule | 다음에도 쓸 수 있을 것 같은 규칙 | `shipping_reconciled`를 amount_match_type에 추가 |
| approved_rule | 반복 확인 후 표준 규칙으로 승격 | 배송비가 주문 총액에 포함되면 mismatch로 보지 않는다 |
| deprecated_rule | 더 이상 쓰지 않는 규칙 | final_exact만 A급 허용 |
| evidence_count | 근거 수 | 1건이면 낮은 confidence, 5건 이상이면 승격 검토 |
| last_seen_at | 마지막 관찰 시각 | 2026-04-30 16:01 KST |
| owner | 승인자/관리자 | TJ, Codex, Claude reviewer |

자세한 schema 기준판은 [[npay-recovery/LESSONS_TO_RULES_SCHEMA]]에 작성했다.

## 지금 당장 도입할 3가지

1. `NPay recovery harness`를 모든 관련 작업의 시작 문서로 둔다.
2. 작업 완료 전 `AUDITOR_CHECKLIST`를 반드시 통과하게 한다.
3. 새 예외는 바로 `LESSONS_TO_RULES_SCHEMA` 형식으로 남긴다.

## 장기적으로 만들 3가지

1. `harness run npay-recovery --phase read-only` 같은 CLI wrapper.
2. dry-run JSON과 문서 숫자를 비교하는 stale-number checker.
3. Codex/Claude 공통 auditor agent 또는 hook.

## 최종 판단

NPay ROAS 정합성은 단순 분석 프로젝트가 아니라 Growth Data Harness의 첫 성공 사례로 삼기 좋다. 가장 큰 이유는 루프가 이미 닫혀 있기 때문이다. intent 수집, 주문 원장, dry-run, guard, 승인, 결과 검증, 후보정이 모두 존재한다.

다만 지금은 v0로 충분하다. LangGraph나 Deep Agents를 바로 도입하면 오히려 구조가 무거워질 수 있다. 먼저 문서형 하네스로 Codex/Claude/ChatGPT가 같은 규칙을 읽게 하고, 반복 실행이 2-3회 쌓인 뒤 자동화를 붙이는 순서가 맞다.
