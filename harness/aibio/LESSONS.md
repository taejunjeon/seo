# AIBIO Lessons

작성 시각: 2026-05-03 KST (Sprint 23.2 신규)
상태: v0 기준판 — `aibio/aibio_revenue_reconciliation.md`, `aibio/aibio_sync_design.md`, `aibio/aibiodb.md` 등 기존 분석 문서에서 추출
정본 schema: [[harness/!공통하네스_가이드라인]] (redirect → [[harness/common/HARNESS_GUIDELINES]]) §10 + [[harness/npay-recovery/LESSONS_TO_RULES_SCHEMA]]
관련: [[aibio/aibio_revenue_reconciliation]] · [[aibio/aibio_sync_design]] · [[aibio/aibiodb]] · [[harness/cross-site-lessons/INDEX]]

## 10초 요약

AIBIO 리커버리랩 (Supabase 정본) 의 매출 정합성 / sync / 환불 처리 / 회원 funnel 작업에서 발견한 교훈을 모은다. AIBIO 는 Supabase 가 진실의 원천 (SoT), 로컬 SQLite 는 분석용 read-only 복제본.

## 운영 원칙

1. observation → candidate_rule → approved_rule → deprecated_rule (정본 4 lifecycle)
2. AIBIO Supabase 는 SoT — 로컬 sync 는 read-only 복제본
3. phone 키는 정규화 (`regexp_replace(phone, '[- ]', '', 'g')`) 후 cross-site 조인
4. AIBIO 의 환불 = 음수 amount + notes 텍스트 (별도 status 컬럼 없음)

## Seed Lessons

| id | status | title | observation | source | candidate_rule / approved_rule | evidence_count | confidence | owner | applies_to |
|---|---|---|---|---|---|---|---|---|---|
| `aibio-lesson-001` | candidate_rule | AIBIO 의 환불은 음수 amount + notes 텍스트 (별도 status 컬럼 부재) | payments 1,018건 중 음수 결제 45건. 환불은 음수 amount 로 기록, 별도 status 컬럼 없음. 집계 시 `SUM(amount)` 단순합 = net 매출 자동 일치 | aibio/aibio_revenue_reconciliation.md §7 음수 결제(환불) 단서 | AIBIO 매출 집계 시 환불 별도 분리 안 함 — `SUM(amount)` 만으로 net 매출 산출. 단 환불 분석이 필요한 경우 amount<0 row 별도 grep | 1 (전체 1,018건 / 환불 45건 evidence) | 0.95 | Codex | * |
| `aibio-lesson-002` | candidate_rule | AIBIO Supabase 는 SoT — 로컬 SQLite 는 read-only 복제본 | AIBIO sync 설계 원칙 1 "읽기 전용 복제. Supabase 가 진실의 원천 (SoT). 로컬 SQLite 는 분석용 읽기 복제본". 분석 결과는 Supabase 와 다를 수 있음 — 로컬 stale 가능성 | aibio/aibio_sync_design.md §1 설계 원칙 | AIBIO 매출 / 회원 / 예약 분석 시 source label 에 "AIBIO Supabase (SoT)" 또는 "로컬 SQLite read-only 복제 (sync_lag_check 후)" 명시. 로컬만 보고 의사결정 금지 — sync freshness 먼저 확인 | 1 | 0.92 | Codex | * |
| `aibio-lesson-003` | candidate_rule | phone 정규화 (regexp 하이픈/공백 제거) 후 cross-site 조인 | AIBIO `customers.phone` 의 하이픈·공백을 제거해 `imweb_orders.orderer_call` 과 조인 가능하도록 정규화. cross-site (biocom × Coffee × AIBIO) 통합 분석의 기본 키 | aibio/aibio_sync_design.md §1 설계 원칙 §2 phone 키 통일 | 모든 cross-site 조인 SQL 에 phone 정규화 함수 우선 적용 — `regexp_replace(phone, '[- ]', '', 'g')`. 미정규화 phone 으로 조인 시 결과 0 또는 누락 위험 | 2 (AIBIO + Coffee phone 패턴) | 0.95 | Codex | * |
| `aibio-lesson-004` | candidate_rule | sync 우선순위 = 작은 테이블 먼저 (full refresh) + 큰 테이블 증분 (incremental) | P0 customers (1,074) / payments (1,018) full refresh, P1 product_usage (11,092) 증분 (`usage_date` 추정), P2 reservations (356) `updated_at` 증분 | aibio/aibio_sync_design.md §2 동기화 대상 / 우선순위 | 신규 site sync 진입 시 row count 별 full vs incremental 분리. 큰 테이블 (>5,000) 만 증분 — full refresh 비용 큰 경우만 | 1 | 0.88 | Codex | * |
| `aibio-lesson-005` | candidate_rule | 로컬 테이블명 prefix `aibio_` (네임스페이스 분리) | 로컬 SQLite 의 imweb_members / imweb_orders 등과 충돌 방지 — 모든 AIBIO 테이블 `aibio_` prefix. cross-site 조인 시 site 식별 명확 | aibio/aibio_sync_design.md §1 설계 원칙 §5 별도 네임스페이스 | 로컬 SQLite 의 cross-site 테이블 prefix 통일 — `imweb_*` (biocom/Coffee 의 imweb), `aibio_*` (AIBIO Supabase), `tb_*` (운영 PG 정본). prefix 보고 SoT 식별 가능 | 2 (AIBIO + Coffee imweb_* 패턴) | 0.93 | Codex | * |

## 승격 기준 (정본 §10)

| 단계 | 기준 |
|---|---|
| `observation` | 1회 관찰, source/window/evidence 있음 |
| `candidate_rule` | 같은 문제를 다음 작업에 적용 가능 |
| `approved_rule` | 반복 확인 + audit 통과, RULES.md 반영 |
| `deprecated_rule` | 더 이상 안 쓰는 규칙 — 이유 + 대체 규칙 기록 |

## 후속 sprint

- contact dashboard / CRM journey sprint 진행 시 신규 lesson 누적
- AIBIO RULES.md / VERIFY.md / AUDITOR_CHECKLIST.md 신규 (별도 sprint)
- cross-cutting 후보 → [[harness/cross-site-lessons/INDEX]] §3 의 표 추가 등록 (특히 `aibio-lesson-003` phone 정규화 → 모든 site)
