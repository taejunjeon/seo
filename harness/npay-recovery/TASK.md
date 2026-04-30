# NPay Recovery Task Spec

작성 시각: 2026-05-01 00:20 KST  
상태: v0 기준판  
목적: NPay recovery 관련 작업 요청을 agent가 같은 형식으로 해석하게 만드는 작업 명세서  
관련 문서: [[harness/npay-recovery/README|NPay Recovery Harness]], [[harness/npay-recovery/CONTEXT_PACK|Context Pack]], [[harness/npay-recovery/RULES|Rules]], [[harness/npay-recovery/VERIFY|Verify]], [[harness/npay-recovery/APPROVAL_GATES|Approval Gates]]

## 10초 요약

이 파일은 NPay recovery 작업을 시작할 때 쓰는 표준 작업지시서다.

agent는 작업 전 `phase`, `site`, `window`, `allowed operations`, `forbidden operations`, `output`, `success criteria`를 먼저 고정한다. 이 값이 없으면 임의로 전송, DB write, 운영 배포를 하지 않는다.

## 사용 순서

NPay recovery harness 기준으로 작업할 때 agent는 아래 순서로 읽는다.

1. [[harness/npay-recovery/README|README]]
2. [[harness/npay-recovery/CONTEXT_PACK|CONTEXT_PACK]]
3. 이 파일 `TASK.md`
4. [[harness/npay-recovery/RULES|RULES]]
5. [[harness/npay-recovery/APPROVAL_GATES|APPROVAL_GATES]]
6. 작업 후 [[harness/npay-recovery/VERIFY|VERIFY]]
7. 종료 전 [[harness/npay-recovery/AUDITOR_CHECKLIST|AUDITOR_CHECKLIST]]

## 표준 Task Spec

새 작업은 아래 형식으로 먼저 해석한다.

```yaml
task_id: "npay-recovery-YYYYMMDD-001"
requested_at_kst: "2026-05-01 00:20 KST"
requested_by: "TJ"
phase: "read_only | dispatcher_dry_run | approval_draft | limited_send | post_send_verification | seven_day_recalibration"
site: "biocom | thecleancoffee | aibio"
window_kst:
  start: "YYYY-MM-DD HH:mm KST"
  end: "YYYY-MM-DD HH:mm KST"
primary_goal: "이 작업이 무엇을 확인하거나 만들 것인가"
allowed_operations:
  - "문서 읽기"
  - "read-only query"
  - "dry-run report"
forbidden_operations:
  - "운영 DB write"
  - "GA4/Meta/TikTok/Google Ads 전송"
  - "운영 endpoint 배포"
primary_sources:
  - "VM SQLite npay_intent_log"
  - "operational_postgres.public.tb_iamweb_users"
cross_checks:
  - "BigQuery robust query"
  - "GTM version"
outputs:
  - "markdown report"
  - "JSON dry-run preview"
success_criteria:
  - "source/window/freshness/confidence 기록"
  - "send_candidate=N 기본값 유지"
audit_required: true
approval_required_before:
  - "limited_send"
  - "DB write"
  - "GTM publish"
```

## Phase별 Task

| Phase | 허용 범위 | 목표 | 산출물 | 승인 필요 |
|---|---|---|---|---|
| `read_only` | 문서, DB, BigQuery 읽기 | 현재 숫자와 source 상태 확인 | markdown summary | NO |
| `dispatcher_dry_run` | 후보 계산, payload preview | send 후보와 block reason 계산 | dry-run report, JSON preview | NO |
| `approval_draft` | 승인안 작성 | TJ님이 YES/NO로 판단 가능하게 정리 | approval 문서 | NO |
| `limited_send` | 승인된 1-2건 전송 | GA4 MP 제한 테스트 | 전송 로그, event_id | YES |
| `post_send_verification` | 전송 결과 조회 | BigQuery 수신/중복 확인 | verification report | NO |
| `seven_day_recalibration` | 7일 window 재실행 | A급/ambiguous 기준 후보정 | recalibration report | NO |

## Read-only Task 기준

목표:

운영 원장이나 광고 플랫폼을 바꾸지 않고 현재 상태를 읽는다.

허용:

- 로컬 문서 읽기
- 운영 DB read-only query
- VM SQLite read-only query
- BigQuery read-only query
- 기존 report 숫자 검증
- markdown/JSON report 생성

금지:

- `INSERT`, `UPDATE`, `DELETE`
- `match_status` 변경
- GA4 MP 전송
- Meta CAPI 전송
- TikTok Events API 전송
- Google Ads conversion 전송
- GTM publish
- 운영 endpoint 배포

완료 기준:

1. source, window, freshness, confidence가 적혔다.
2. 이번 작업이 read-only였음을 명시했다.
3. no-send/no-write가 검증됐다.

## Dispatcher Dry-run Task 기준

목표:

실제 전송 없이 intent와 confirmed order를 붙여 보고 후보만 계산한다.

필수 출력:

| 필드 | 설명 |
|---|---|
| `order_number` | Imweb 주문번호 |
| `channel_order_no` | NPay 외부 주문번호 |
| `matched_intent_id` | 매칭된 intent |
| `score` | 매칭 점수 |
| `score_gap` | 1등과 2등 후보 점수차 |
| `amount_match_type` | 금액 reconciliation 결과 |
| `already_in_ga4` | `present`, `unknown`, `robust_absent` |
| `send_candidate` | 기본값 `N` |
| `block_reason` | 전송 금지 이유 |

완료 기준:

1. A급/B급/ambiguous/purchase_without_intent가 분리됐다.
2. ambiguous, B급, manual_test_order는 `send_candidate=N`이다.
3. `already_in_ga4=unknown/present`는 `send_candidate=N`이다.
4. 실제 전송은 0건이다.

## Approval Draft Task 기준

목표:

실제 전송 전 TJ님이 YES/NO로 판단할 수 있는 승인안을 만든다.

필수 포함:

- 대상 후보 목록
- 왜 이 후보를 고르는지
- payload preview
- event_id
- transaction_id 기준
- `channel_order_no` 저장 방식
- `timestamp_micros` 사용 여부
- GA4 72시간 제한 리스크
- session attribution 24시간 리스크
- 전송 후 검증 쿼리
- rollback 한계
- 중복 방지 키
- 추천안과 자신감 %

완료 기준:

승인안만 만들고 전송은 하지 않는다.

## Limited Send Task 기준

목표:

TJ님이 명시 승인한 최소 후보만 실제 전송한다.

실행 전 필요 조건:

1. 승인 문서가 있다.
2. 승인 범위가 특정 order_number 단위로 좁다.
3. BigQuery guard가 `robust_absent`다.
4. `manual_test_order=false`다.
5. `already_in_ga4=present/unknown`이 아니다.
6. `AUDITOR_CHECKLIST` 사전 검사에서 hard fail이 없다.

완료 기준:

1. 전송 로그와 event_id를 문서화했다.
2. 같은 주문 재전송을 막는 idempotency key를 기록했다.
3. post-send verification task를 즉시 생성했다.

## Post-send Verification Task 기준

목표:

승인된 전송이 GA4 raw에 들어갔는지, 중복으로 들어가지 않았는지 확인한다.

필수 확인:

- `ecommerce.transaction_id`
- `event_params.transaction_id`
- event_params 전체 value
- `event_id`
- `channel_order_no`
- purchase value
- event timestamp

완료 기준:

1. 수신되면 `already_in_ga4=present`로 다음 dry-run에서 차단한다.
2. 수신되지 않으면 지연/누락/쿼리 window 문제를 분리한다.
3. 같은 주문 추가 전송은 TJ님 재승인 전 금지한다.

## Seven-day Recalibration Task 기준

목표:

표본이 충분히 쌓인 뒤 A급 기준과 ambiguous 원인을 재평가한다.

필수 지표:

| 지표 | Go 검토 기준 |
|---|---|
| A급 strong 비율 | 50% 이상 |
| ambiguous 비율 | 10% 이하 |
| purchase_without_intent 비율 | 20% 이하 |
| BigQuery guard 확인률 | 100% |
| manual_test_order 전송 후보 | 0건 |

완료 기준:

자동 dispatcher 운영 전환 여부는 이 task 이후 별도 승인안으로만 판단한다.

## 더클린커피 적용 Task

더클린커피는 `site=thecleancoffee`로 분리한다.

1차 목표:

GA4 BigQuery가 열려 있는 사이트에서 실제 주문/결제 원장과 GA4 purchase가 얼마나 맞는지 read-only로 확인한다.

허용:

- BigQuery `project-dadba7dd-0229-4ff6-81c.analytics_326949178` 조회
- 운영 DB read-only 조회
- 최근 7일 purchase summary 생성
- payment_method 분리
- amount reconciliation 초안 적용
- dry-run schema 작성

금지:

- coffee GTM publish
- NPay intent live 배포
- 광고 플랫폼 전송
- 운영 DB write

TJ님 확인 필요:

- 더클린커피 Naver Commerce API 권한
- 더클린커피 Meta token 갱신
- 2025 결제내역 엑셀, 2024 주문/결제 엑셀 다운로드
