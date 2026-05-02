# NPay Recovery Harness

작성 시각: 2026-04-30 23:16 KST
최종 업데이트: 2026-05-02 01:15 KST
상태: v0 기준판
범위: NPay ROAS 정합성 회복 작업을 위한 문서형 agent harness
관련 문서: [[harness/!harness|Growth Data Agent Harness 조사]], [[docs/agent-harness/growth-data-harness-v0|Growth Data Harness v0]], [[naver/!npayroas|NPay ROAS 정합성 회복 계획]], [[harness/npay-recovery/TASK|Task Spec]], [[harness/npay-recovery/CONTEXT_PACK|Context Pack]], [[harness/npay-recovery/RULES|Rules]], [[harness/npay-recovery/AUTONOMY_POLICY|Autonomy Policy]], [[harness/npay-recovery/VERIFY|Verify]], [[harness/npay-recovery/APPROVAL_GATES|Approval Gates]], [[harness/npay-recovery/AUDITOR_CHECKLIST|Auditor Checklist]], [[harness/npay-recovery/LESSONS|Lessons]], [[harness/npay-recovery/LESSONS_TO_RULES_SCHEMA|Lessons-to-Rules Schema]], [[harness/npay-recovery/EVAL_LOG_SCHEMA|Eval Log Schema]], [[data/coffee-funnel-capi-cross-site-applicability-20260501|Coffee → Biocom 적용성 메모]], [[data/biocom-live-tracking-inventory-20260501|Biocom Live Tracking Inventory]], [[data/biocom-npay-intent-beacon-preview-design-20260501|Biocom NPay Preview Design]] (더클린커피에서 검증된 funnel-capi v3 / NPay intent beacon preview / live inventory 절차의 biocom 적용 진입점)
Primary source: `naver/!npayroas.md`, `naver/npay-roas-dry-run-20260430.md`, `backend/src/npayRoasDryRun.ts`, `backend/scripts/npay-roas-dry-run.ts`
Freshness: NPay 기준 2026-04-30 21:30 KST
Confidence: 90%

## 10초 요약

이 하네스는 NPay 버튼 클릭 intent와 실제 NPay 결제 주문을 안전하게 매칭하기 위한 작업장이다.

기본값은 read-only와 no-send다. TJ님 승인 전에는 DB `match_status` 업데이트, GA4/Meta/TikTok/Google Ads 전송, 운영 endpoint 배포를 하지 않는다.

v0의 목표는 무인 전송 자동화가 아니다. Codex, Claude, ChatGPT가 같은 context, 같은 규칙, 같은 검증표, 같은 승인 게이트를 보면서 L0-L3 read-only/dry-run은 자동 실행하고, 실제 write/send/publish/deploy/click은 TJ님 승인으로 막는 안전장치다.

## 목적

NPay 버튼을 외부 주문형으로 유지하면서 아래 둘을 분리한다.

1. NPay 버튼을 눌렀지만 결제하지 않은 사람
2. NPay 버튼을 누르고 실제 결제까지 완료한 사람

이 분리가 되어야 GA4, Meta, TikTok, Google Ads ROAS가 실제 운영 주문 원장과 가까워진다.

## 현재 루프

1. GTM tag 118이 NPay 버튼 클릭 intent를 수집한다.
2. VM SQLite `npay_intent_log`에 클릭 intent가 저장된다.
3. 운영 Postgres `public.tb_iamweb_users`에서 confirmed NPay 주문을 읽는다.
4. dry-run이 intent와 주문을 매칭한다.
5. 주문을 `A급 strong`, `B급 strong`, `ambiguous`, `purchase_without_intent`로 분류한다.
6. A급 production 후보는 Imweb `order_number`와 NPay `channel_order_no`를 모두 BigQuery에서 확인한다.
7. 둘 다 없으면 `robust_absent`, 하나라도 있으면 `present`, 확인 불가면 `unknown`이다.
8. `robust_absent`인 A급 production 후보만 제한 테스트 승인안에 올라갈 수 있다.
9. 실제 전송은 human approval 후 최소 수량만 한다.
10. 전송 후 BigQuery 수신 확인과 중복 방지 상태를 문서화한다.

## Allowed Operations

| Phase | 허용 |
|---|---|
| read-only | 로컬 문서 읽기, VM SQLite read-only 조회, 운영 DB read-only 조회, BigQuery 조회 결과 반영 |
| dispatcher dry-run | 후보 계산, payload preview, idempotency key preview, markdown/JSON report 작성 |
| approval draft | TJ님이 YES/NO로 판단할 수 있는 승인안 작성 |
| post-send verification | 승인된 1건의 수신 확인, BigQuery guard 업데이트 문서화 |
| 7일 후보정 | 같은 로직으로 7일 window 재실행, 규칙 보정 제안 |

## Autonomous Run Envelope

[[harness/npay-recovery/AUTONOMY_POLICY|AUTONOMY_POLICY]]를 기준으로 L0-L3는 TJ님 승인 없이 진행한다.

| Level | 범위 | 승인 필요 |
|---|---|---|
| L0 | 문서 읽기/수정, report/eval log 작성 | NO |
| L1 | 운영 DB SELECT, VM SQLite SELECT, BigQuery read-only, GTM read-only | NO |
| L2 | dry-run, 매칭 후보 계산, BigQuery guard 반영 | NO |
| L3 | payload preview, approval draft, auditor report | NO |
| L4+ | 실제 write/send/publish/deploy/click | YES |

agent는 L0-L3에서 가능한 것은 끝까지 진행한다. source 접근이 막힌 경우에는 막힌 source와 이유를 report에 적고, 다른 read-only source를 계속 확인한다.

## Forbidden Operations

| 금지 | 이유 |
|---|---|
| 운영 DB write | match_status가 잘못 바뀌면 원장 오염 |
| GA4 MP 실제 전송 | 중복/오매칭 전환은 되돌리기 어려움 |
| Meta CAPI 전송 | 광고 최적화에 직접 영향 |
| TikTok Events API 전송 | TikTok 식별값 보강 전 오매칭 위험 |
| Google Ads conversion 전송 | 입찰 학습에 직접 영향이므로 마지막 단계 |
| GTM publish | 별도 승인 대상 |
| 운영 endpoint 배포 | 별도 승인 대상 |
| ambiguous/B급/manual_test_order 전송 후보화 | false positive 방지 |
| `already_in_ga4=unknown/present` 전송 후보화 | 중복 또는 미확인 리스크 |

## Phase Map

| Phase | 이름 | 목표 | 완료 조건 |
|---|---|---|---|
| Phase1 | Intent capture | 버튼 클릭 intent를 안정적으로 저장 | live intent 품질 통과 |
| Phase2 | Read-only matching | confirmed 주문과 intent를 매칭 | A/B/ambiguous/purchase_without_intent 분리 |
| Phase2.5 | Dispatcher dry-run | payload 후보만 계산 | send_candidate와 block_reason 출력 |
| Phase3 | GA4 MP limited test approval | 1-2건 제한 테스트 여부 판단 | 승인안과 payload preview 생성 |
| Phase3.5 | Post-send verification | 보낸 이벤트 수신/중복 확인 | BigQuery raw/purchase 확인 |
| Phase4 | 7일 후보정 | 표본 확대 후 기준 재평가 | A급/ambiguous/purchase_without_intent 비율 재계산 |

## A급 strong 기준

아래 조건을 모두 만족해야 한다.

| 기준 | 값 |
|---|---|
| score | `>= 70` |
| amount_match_type | `final_exact`, `shipping_reconciled`, `discount_reconciled`, `quantity_reconciled` 중 하나 |
| time_gap | `<= 2분` |
| score_gap | `>= 15` |
| order_label | `production_order` |
| already_in_ga4 | limited test 후보는 `robust_absent` |
| 식별값 | `client_id`와 `ga_session_id` 있음 |

## Block 기준

| 조건 | block_reason |
|---|---|
| `manual_test_order` | `manual_test_order` |
| `ambiguous` | `ambiguous` |
| B급 strong | `not_a_grade_strong` |
| `already_in_ga4=present` | `already_in_ga4` |
| `already_in_ga4=unknown` | `already_in_ga4_unknown` |
| BigQuery 미조회 | `ga4_guard_missing` |
| client/session 없음 | `missing_ga_session` 또는 `missing_client_id` |

## v0 Files

| 파일 | 용도 |
|---|---|
| [[harness/npay-recovery/TASK|TASK.md]] | phase별 task spec |
| [[harness/npay-recovery/CONTEXT_PACK|CONTEXT_PACK.md]] | 읽어야 할 로컬 문서와 데이터 소스 |
| [[harness/npay-recovery/RULES|RULES.md]] | 매칭/등급/차단 규칙 |
| [[harness/npay-recovery/AUTONOMY_POLICY|AUTONOMY_POLICY.md]] | auto-run 허용 범위와 승인 필요 지점 |
| [[harness/npay-recovery/VERIFY|VERIFY.md]] | 검증 명령과 no-send 확인 |
| [[harness/npay-recovery/APPROVAL_GATES|APPROVAL_GATES.md]] | 승인 게이트 |
| [[harness/npay-recovery/AUDITOR_CHECKLIST|AUDITOR_CHECKLIST.md]] | 종료 전 검사 |
| [[harness/npay-recovery/LESSONS|LESSONS.md]] | 누적 교훈 |
| [[harness/npay-recovery/LESSONS_TO_RULES_SCHEMA|LESSONS_TO_RULES_SCHEMA.md]] | 교훈 승격 schema |
| [[harness/npay-recovery/EVAL_LOG_SCHEMA|EVAL_LOG_SCHEMA.md]] | run/eval log schema |

## Pre-completion Checklist

Codex/Claude/ChatGPT는 작업 종료 전 아래를 확인한다.

1. 이번 작업이 read-only인지, limited send인지 phase를 명시했다.
2. 실제 DB write가 없었다.
3. 승인 없는 GA4/Meta/TikTok/Google Ads 전송이 없었다.
4. ambiguous/B급/manual_test_order가 send 후보가 아니다.
5. `already_in_ga4=unknown/present`가 send 후보가 아니다.
6. 최신 dry-run 숫자와 문서 숫자가 맞는다.
7. source/window/freshness/confidence를 기록했다.
8. unrelated dirty files를 건드리거나 커밋하지 않았다.
9. 다음 할 일이 TJ/Codex/Claude 중 누구 담당인지 분리했다.

## v0 사용법

사용자 지시 예시:

```text
NPay recovery harness 기준으로 Phase2 read-only만 진행해.
```

이때 agent는 아래 순서로 진행한다.

1. 이 README를 읽는다.
2. [[harness/npay-recovery/CONTEXT_PACK|CONTEXT_PACK]]에서 필수 context를 조립한다.
3. [[harness/npay-recovery/TASK|TASK]]에서 phase의 allowed/forbidden을 확인한다.
4. [[harness/npay-recovery/RULES|RULES]]의 A급/B급/ambiguous/guard 기준을 적용한다.
5. [[harness/npay-recovery/VERIFY|VERIFY]]의 명령으로 no-send/no-write를 확인한다.
6. [[harness/npay-recovery/AUDITOR_CHECKLIST|AUDITOR_CHECKLIST]]로 종료 전 검사한다.
7. 새 예외는 [[harness/npay-recovery/LESSONS|LESSONS]]와 [[harness/npay-recovery/LESSONS_TO_RULES_SCHEMA|LESSONS_TO_RULES_SCHEMA]] 형식으로 남긴다.

## 더클린커피 확장 사용법

사용자 지시 예시:

```text
NPay recovery harness 기준으로 더클린커피 BigQuery-first read-only 정합성을 진행해.
```

이때 agent는 아래를 추가로 지킨다.

1. `site=thecleancoffee`를 명시한다.
2. BigQuery dataset은 `project-dadba7dd-0229-4ff6-81c.analytics_326949178`만 쓴다.
3. local Imweb/Toss stale mirror는 primary로 쓰지 않는다.
4. Naver Commerce API 권한이 coffee용인지 확인 전에는 NPay actual order를 확정하지 않는다.
5. 모든 report는 `send_candidate=N`을 기본값으로 둔다.
6. GA4/Meta/TikTok/Google Ads 전송과 GTM publish는 금지한다.

## 바이오컴 Live Tracking Preflight

바이오컴 wrapper, eid, NPay preview, attribution ledger 작업을 시작하기 전에는 live tracking inventory를 먼저 확인한다.

필수 기준 문서:

| 문서 | 역할 |
|---|---|
| [[data/biocom-live-tracking-inventory-20260501|Biocom Live Tracking Inventory]] | live GTM version, Imweb header/footer code, 기존 wrapper, session/eid, server send 상태 확인 |
| [[data/biocom-npay-intent-beacon-preview-design-20260501|Biocom NPay Preview Design]] | NPay intent beacon preview의 no-send/no-write/no-pixel-send 설계 기준 |

Hard fail:

1. wrapper/eid/NPay 작업 시점 기준 7일 이내 live tracking inventory가 없으면 진행하지 않는다.
2. GTM publish, Imweb header/footer 수정, backend deploy, DB write, 외부 전송은 TJ님 별도 승인 전 금지다.
3. NPay preview의 기본값은 `no-send`, `no-write`, `no-pixel-send`다.
4. 신규 `harness/biocom-data`는 만들지 않는다. 바이오컴 NPay 작업은 이 `harness/npay-recovery`에서 관리한다.

## 현재 판단

NPay recovery는 Growth Data Harness의 첫 적용 사례로 적합하다. 루프가 이미 명확하고, 전송/DB write 같은 위험한 side effect가 있어 guard와 approval의 효과가 크다.

v0 문서형 기준판은 고정됐다. 다음 단계는 이 하네스를 더클린커피 BigQuery-first read-only 정합성에 적용하는 것이다. v0가 2-3회 반복 사용된 후 CLI wrapper, auditor script, Codex/Claude skill로 확장한다.
