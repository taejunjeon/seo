# Growth Data Harness v0

작성 시각: 2026-04-30 23:16 KST
문서 목적: SEO/AEO/GA4/NPay/TikTok/ROAS 정합성 작업에 적용할 agent harness v0 설계
관련 문서: [[harness/!harness|Growth Data Agent Harness 조사]], [[harness/npay-recovery/README|NPay Recovery Harness]], [[naver/!npayroas|NPay ROAS 정합성 회복 계획]]
Primary source: LangChain, Deep Agents, LangGraph, LangSmith, OpenAI Agents SDK, Claude Code, Codex 공식 자료와 로컬 NPay 문서
Freshness: 2026-04-30
Confidence: 88%

## 10초 요약

Growth Data Harness v0는 AI 에이전트가 데이터 정합성 작업을 할 때 매번 같은 기준으로 움직이게 하는 문서형 작업장이다.

v0의 핵심은 `빠른 자동화`가 아니라 `반복 가능한 판단 구조`다. 즉, 어떤 데이터를 읽고, 무엇을 금지하고, 어떤 dry-run을 돌리고, 어떤 승인 전에는 절대 전송하지 않는지를 파일로 고정한다.

## 왜 지금 필요한가

NPay ROAS 작업은 이미 복잡한 운영 루프가 되었다.

1. NPay 버튼 intent 수집
2. 운영 DB confirmed 주문 조회
3. dry-run 매칭
4. A급/B급/ambiguous 분류
5. BigQuery `already_in_ga4` guard
6. `robust_absent` 확인
7. GA4 MP 제한 테스트 승인안
8. 실제 전송 전 human approval
9. post-send verification
10. 7일 후보정

이 흐름은 매번 프롬프트로 복붙하기에는 길고, 실수 비용이 크다. 특히 GA4/Meta/TikTok/Google Ads 전송이나 운영 DB write는 잘못 실행되면 되돌리기 어렵다.

## Harness 원칙

| 원칙 | 설명 |
|---|---|
| 문서가 system of record | 대화나 기억이 아니라 repo-local 문서가 기준이다 |
| phase별 권한 분리 | read-only, dry-run, limited test, production send를 명확히 나눈다 |
| side effect는 승인 후 | DB write, GTM publish, 광고 플랫폼 전송은 human approval 전 금지 |
| no-send가 기본값 | 명시 승인 전에는 후보 계산만 한다 |
| trace를 남긴다 | source, window, freshness, confidence, command, output path를 남긴다 |
| 실패를 규칙으로 승격 | observation -> candidate_rule -> approved_rule 순서로 처리 |
| auditor를 통과해야 완료 | 숫자, 금지선, unrelated dirty files를 종료 전 확인 |

## 참고 자료

| 자료 | 링크 |
|---|---|
| LangChain harness engineering | https://www.langchain.com/blog/improving-deep-agents-with-harness-engineering |
| Deep Agents overview | https://docs.langchain.com/oss/python/deepagents/overview |
| LangGraph durable execution | https://docs.langchain.com/oss/python/langgraph/durable-execution |
| LangGraph interrupts | https://docs.langchain.com/oss/python/langgraph/interrupts |
| LangSmith observability | https://docs.langchain.com/langsmith/observability |
| LangSmith evaluation concepts | https://docs.langchain.com/langsmith/evaluation-concepts |
| OpenAI Agents SDK guardrails | https://openai.github.io/openai-agents-python/guardrails/ |
| OpenAI Agents SDK tracing | https://openai.github.io/openai-agents-python/tracing/ |
| OpenAI Agents SDK human-in-the-loop | https://openai.github.io/openai-agents-python/human_in_the_loop/ |
| OpenAI Codex harness engineering | https://openai.com/index/harness-engineering/ |
| Claude Code hooks | https://docs.anthropic.com/en/docs/claude-code/hooks |
| Claude Code subagents | https://docs.anthropic.com/en/docs/claude-code/sub-agents |

## 디렉토리 설계

```text
docs/agent-harness/
  growth-data-harness-v0.md

harness/
  !harness.md
  npay-recovery/
    README.md
    AUDITOR_CHECKLIST.md
    LESSONS_TO_RULES_SCHEMA.md
    TASK.md                 # planned
    CONTEXT_PACK.md         # planned
    RULES.md                # planned
    VERIFY.md               # planned
    APPROVAL_GATES.md       # planned
    LESSONS.md              # planned
    EVAL_LOG_SCHEMA.md      # planned
```

## 파일별 역할

| 파일 | 역할 | v0 상태 |
|---|---|---|
| `README.md` | 이 하네스가 무엇이고 언제 쓰는지 설명 | 작성 |
| `TASK.md` | phase/sprint별 작업 명세 | planned |
| `CONTEXT_PACK.md` | 읽어야 할 문서와 데이터 위치 | planned |
| `RULES.md` | A급/B급/ambiguous, BigQuery guard 등 판정 규칙 | planned |
| `VERIFY.md` | typecheck, dry-run, BigQuery, no-send 검증 | planned |
| `APPROVAL_GATES.md` | TJ 승인 전 금지되는 작업 | planned |
| `AUDITOR_CHECKLIST.md` | 작업 종료 전 auditor 검사표 | 작성 |
| `LESSONS.md` | 누적 교훈 목록 | planned |
| `LESSONS_TO_RULES_SCHEMA.md` | 교훈을 규칙으로 승격하는 schema | 작성 |
| `EVAL_LOG_SCHEMA.md` | run log와 평가 로그 형식 | planned |

## v0와 v1/v2 구분

| 버전 | 목표 | 구현 수준 | 지금 할지 |
|---|---|---|---|
| v0 | 같은 규칙으로 작업하게 만들기 | Markdown, checklist, report schema | 지금 |
| v1 | 반복 실행을 줄이기 | CLI wrapper, stale-number checker, auditor script | 다음 |
| v2 | self-correcting agent workflow | LangGraph/Deep Agents/Claude hook/Codex skill | 나중 |

## Growth Data Harness 공통 Task Spec

각 작업은 아래 항목을 반드시 갖는다.

| 필드 | 설명 |
|---|---|
| task_id | 예: `npay-recovery.phase2.read-only.20260430` |
| owner | TJ/Codex/Claude/ChatGPT |
| phase | read-only, dry-run, limited-test, post-send, recalibration |
| source | primary/cross-check/fallback 데이터 |
| window | 분석 기간 |
| allowed_actions | 허용된 행동 |
| forbidden_actions | 금지된 행동 |
| commands | 실행 명령 |
| output_files | 산출 파일 |
| verification | 검증 방법 |
| approval_required | 승인 필요 여부 |
| confidence | 판단 자신감 |
| next_action | 다음 단계 |

## 권한 모델

| 권한 | 설명 | 기본값 |
|---|---|---|
| read_local_docs | 로컬 md/code 읽기 | 허용 |
| read_operational_db | 운영 DB read-only 조회 | 승인된 범위에서 허용 |
| write_local_docs | 문서 업데이트 | 허용 |
| write_code | 코드 초안/테스트 작성 | 허용 |
| write_operational_db | 운영 DB 변경 | 금지 |
| publish_gtm | GTM publish | 금지 |
| send_ga4_mp | GA4 MP 전송 | 승인 전 금지 |
| send_meta_capi | Meta CAPI 전송 | 금지 |
| send_tiktok_events | TikTok Events API 전송 | 금지 |
| send_google_ads | Google Ads conversion 전송 | 금지 |
| deploy_endpoint | 운영 endpoint 배포 | 금지 |

## Evaluation Log Schema 초안

```json
{
  "run_id": "npay-recovery-20260430-2125",
  "created_at": "2026-04-30T21:25:25+09:00",
  "operator": "Codex",
  "phase": "dispatcher_dry_run",
  "source": {
    "primary": "VM SQLite npay_intent_log + operational_postgres.public.tb_iamweb_users",
    "cross_check": "BigQuery robust query",
    "window": "2026-04-27 18:10 KST ~ 2026-04-30 21:25 KST",
    "freshness": "2026-04-30 21:25 KST"
  },
  "commands": [],
  "summary_metrics": {
    "live_intent": 304,
    "confirmed_npay_order": 11,
    "strong_match": 8,
    "grade_a": 6,
    "ambiguous": 3
  },
  "guards": {
    "db_write": false,
    "ga4_send": false,
    "meta_send": false,
    "tiktok_send": false,
    "google_ads_send": false,
    "bigquery_guard": "required"
  },
  "files_changed": [],
  "verification": [],
  "decision": "report_only",
  "next_action": "human approval or 7d recalibration"
}
```

## Auditor 운영 방식

v0에서는 auditor가 사람이 읽는 체크리스트다. v1에서는 script로 자동화한다.

Auditor는 작업 종료 전 아래를 확인한다.

1. 금지된 전송이 있었는가.
2. 운영 DB write가 있었는가.
3. BigQuery guard 없이 후보가 열렸는가.
4. ambiguous/B급/manual_test_order가 후보가 되었는가.
5. 문서 숫자가 최신 dry-run과 맞는가.
6. unrelated dirty files가 커밋에 섞였는가.
7. source/window/freshness/confidence가 있는가.

## Lessons-to-Rules 운영 방식

v0에서는 새 예외가 나오면 바로 아래 형태로 기록한다.

| 단계 | 질문 |
|---|---|
| observation | 무슨 일이 있었나 |
| evidence | 어떤 데이터로 확인했나 |
| candidate_rule | 다음에 적용할 수 있는 규칙인가 |
| confidence | 자신감은 몇 %인가 |
| approved_rule | 반복 확인 후 표준 규칙으로 승격할 것인가 |
| owner | 누가 승인/관리하나 |
| deprecation | 나중에 폐기 조건은 무엇인가 |

## NPay Recovery에 즉시 적용할 것

1. 모든 새 NPay ROAS 작업은 `harness/npay-recovery/README.md`를 먼저 읽는 것으로 시작한다.
2. 작업 종료 전 `AUDITOR_CHECKLIST.md`를 체크한다.
3. 새 예외는 `LESSONS_TO_RULES_SCHEMA.md` 형식으로 기록한다.
4. 7일 후보정 전까지 자동 dispatcher는 금지한다.
5. GA4 MP 제한 테스트는 `approval -> send -> post-send verification -> already_in_ga4 present guard` 순서로만 한다.

## 장기 확장

| 단계 | 설명 |
|---|---|
| Codex skill | `npay-recovery` 반복 작업을 skill로 만들기 |
| Claude subagent | auditor/reviewer 전용 subagent 만들기 |
| LangGraph workflow | read-only -> dry-run -> approval interrupt -> send -> verify 그래프화 |
| LangSmith/trace store | 실행 trace와 eval 결과 저장 |
| Obsidian/Notion sync | approved rule을 위키와 repo 문서에 동기화 |

## 최종 판단

v0는 지금 바로 도입한다. 자동화는 나중이다.

이유는 명확하다. 지금 리스크는 모델 성능이 아니라 `누가 어떤 기준으로 판단했는지`, `전송 금지선이 지켜졌는지`, `문서 숫자가 최신인지`가 흔들리는 데 있다. v0 문서형 하네스는 이 리스크를 가장 낮은 비용으로 줄인다.
