# Cross-Site Lessons INDEX (2026-05-03)

작성: Sprint 23, Green Lane (자율 진행).
정본 가이드라인: [[harness/!공통하네스_가이드라인]] §10 Lessons-to-Rules 흐름.
schema 정본: [[harness/npay-recovery/LESSONS_TO_RULES_SCHEMA]] (yaml + 4 lifecycle).

본 문서 성격: **모든 site 의 LESSONS 단일 INDEX**. cross-site / cross-cutting lesson 표준 schema, lint, 통합 grep 의 entry point. 본 INDEX 자체가 정본은 아니고, **각 site LESSONS.md 가 정본** 이며 본 INDEX 는 "어디 있는지" + "어떤 lesson 이 다른 site 에 적용 가능한지" 의 navigation.

## 0. 결론 (10초)

| Lifecycle | 의미 |
|---|---|
| `observation` | 단일 사례 관찰 |
| `candidate_rule` | 다음에도 적용 가능 — 추가 evidence 수집 |
| `approved_rule` | 반복 확인 후 RULES.md 반영 |
| `deprecated_rule` | 더 이상 쓰지 않음 — 이유 + 대체 규칙 기록 |

**전송 후보를 좁히는 규칙은 빠르게 적용 가능 / 전송 후보를 넓히는 규칙은 TJ 승인 후만.**

## 1. Site 별 LESSONS 위치 + count

| Site | 정본 위치 | lesson count | schema | 마지막 갱신 |
|---|---|---|---|---|
| **Coffee** | [[harness/coffee-data/LESSONS]] | 16 (15 + sprint 23 의 016) | markdown table | 2026-05-03 |
| **biocom NPay recovery** | [[harness/npay-recovery/LESSONS]] | 6 (npay-rule-20260430-001 ~ -20260501-002) | yaml + markdown | 2026-05-01 |
| **TikTok** | [[harness/tiktok/LESSONS]] | **7 (sprint 23.2 신규)** | markdown table | 2026-05-03 |
| **AIBIO** | [[harness/aibio/LESSONS]] | **5 (sprint 23.2 신규)** | markdown table | 2026-05-03 |

**합계**: 34 lesson (Coffee 16 + biocom 6 + TikTok 7 + AIBIO 5).

## 2. 표준 schema (yaml)

본 가이드라인 §10 + biocom NPay recovery 의 schema 정본 통합:

```yaml
id: <site>-rule-YYYYMMDD-NNN  # 또는 <site>-lesson-NNN (Coffee 형식)
status: observation | candidate_rule | approved_rule | deprecated_rule
title: 짧은 규칙명
owner: TJ | Codex | Claude | ChatGPT
created_at: "YYYY-MM-DDTHH:MM:SS+09:00"
last_seen_at: "YYYY-MM-DDTHH:MM:SS+09:00"
source:
  primary: "VM SQLite ... 또는 Coffee NPay sprint N evidence"
  cross_check: "운영 PG ... 또는 git commit hash"
  report: "관련 문서 anchor"
window: "YYYY-MM-DD HH:MM ~ YYYY-MM-DD HH:MM KST"
observation: "무슨 일이 있었는가 — 사실"
problem: "기존 규칙으로 왜 부족했는가"
candidate_rule: "다음부터 어떻게 처리할 것인가"
approved_rule: "승격된 최종 규칙. 아직 없으면 null"
evidence:
  count: 1
  examples:
    - <site>-specific evidence (intent_uuid / order_no / commit hash 등)
confidence: 0.0-1.0
guardrail_impact:
  narrows_send_candidate: true | false  # 후보를 좁히는가?
  widens_send_candidate: false  # 후보를 넓히는가? (true 면 TJ 승인 후만 approved_rule)
applies_to:
  - coffee
  - biocom
  - tiktok
  - aibio
  - "*"  # cross-cutting (모든 site)
deprecated_at: "(deprecated_rule 일 때만) 이유 + 대체 규칙"
```

**markdown table 형식** (Coffee 의 기존 형식, lint 호환):

| id | status | title | observation | source | candidate_rule / approved_rule | evidence_count | confidence | owner | applies_to |
|---|---|---|---|---|---|---|---|---|---|

두 형식 모두 허용. lint 가 schema 일치 검증.

## 3. cross-cutting lessons (모든 site 적용 가능)

본 sprint 23 시점, 4 site 의 lesson 중 **cross-cutting** 으로 인정된 것:

| id | source | applies_to | candidate_rule |
|---|---|---|---|
| `coffee-lesson-008` | Coffee → biocom 적용성 | coffee, biocom (imweb + funnel-capi) | site 식별자 (pixel id / GTM container / snippet version / sessionStorage key prefix) 재검증 필수 |
| `coffee-lesson-014` | Coffee sprint 19~22 | * | publish-targeting design 시 backend 운영 모드 가드 사전 review (smoke_window vs production_mode 분리) |
| `coffee-lesson-015` | Coffee sprint 20 N-2+ | * | dispatcher 와 buffer generator/snippet installer 는 publish scope 에 함께 포함 |
| `coffee-lesson-016` (본 sprint 23 신규) | Sprint 23 진입 시점 | * | 신규 sprint 진입 전 `harness/!공통하네스_가이드라인.md` 의 §4 Required Context Documents 의 모든 정본 문서 read 필수. 본 가이드라인 자체를 모르고 진행 시 fork 작성 위험 |
| `coffee-lesson-013` | sprint 19.3 H-2 | coffee, biocom | real funnel-capi v3 InitiateCheckout key timing 측정 패턴 (NPay click 후 ~873ms PC 기준) — 신규 dispatcher version 검증 시 H-2 5분 절차 재사용 |
| `coffee-lesson-009` | sprint 19.2 + 19.3 | * | dispatcher chrome 측 동작 검증은 simulateConfirmNpay 만으로 불가 — playwright + monkey-patch + mock funnel-capi key 조합 필요 |
| `npay-rule-20260430-001` | biocom | coffee, biocom (배송비 포함 채널) | 배송비 포함 금액 차이는 amount mismatch 로 보지 않는다 (전송 후보 넓힘 — TJ 보수 검토 후 approved_rule) |
| `npay-rule-20260430-002` | biocom | coffee, biocom | NPay 의 `order_number` 와 `channel_order_no` 둘 다 BigQuery guard 로 조회 |
| `npay-rule-20260430-003` | biocom | * | `preliminary_absent` 와 `robust_absent` 구분 — robust guard 필수 |
| `npay-rule-20260430-004` | biocom | * | 수동 테스트 주문은 A급이어도 전송 제외 (`manual_test_order` block) |
| `npay-rule-20260501-001` | biocom | * | site filter 없는 운영 DB 결과는 정본이 아니다 |
| `npay-rule-20260501-002` | biocom | * | stale local mirror 는 primary 로 쓰지 않는다 |
| `tiktok-lesson-001` (sprint 23.2 신규) | tiktok | * (모든 광고 채널) | 플랫폼 attribution 과 내부 strict confirmed 의 정의가 다르다 — 플랫폼 값은 reference, 내부 confirmed 만 예산 증액 판단 기준 |
| `tiktok-lesson-005` | tiktok | * | DB / 원장 위치 명시 — TJ 관리 Attribution VM SQLite vs 개발팀 관리 운영DB PostgreSQL vs 로컬 개발 DB 혼용 금지 |
| `tiktok-lesson-006` | tiktok | * | source-persistence / firstTouch / payment 보강은 신규 이벤트부터 적용 — 과거 주문 backfill 정확도 한계 보고서에 명시 |
| `aibio-lesson-002` (sprint 23.2 신규) | aibio | aibio + 모든 sync 작업 | SoT 와 read-only 복제본 구분 — 로컬만 보고 의사결정 금지, sync freshness 먼저 확인 |
| `aibio-lesson-003` | aibio | * (모든 cross-site 조인) | phone 정규화 (`regexp_replace(phone, '[- ]', '', 'g')`) 후 cross-site 조인 |
| `aibio-lesson-005` | aibio | * | 로컬 테이블 prefix 통일 (`imweb_*` / `aibio_*` / `tb_*`) — prefix 보고 SoT 식별 가능 |

**합계**: 16 cross-cutting lesson (sprint 23 의 8 + sprint 23.2 의 8 추가). cross-cutting 표는 sprint 23.x 진입마다 갱신.

## 4. lessons-lint 사용

```bash
# 모든 LESSONS.md 검증
python3 scripts/lessons-lint.py

# 특정 site 만
python3 scripts/lessons-lint.py --site coffee

# 자동 fix (id 누락 / 형식 위반 등)
python3 scripts/lessons-lint.py --fix
```

검증 항목:
- id 중복 (사이트 prefix 포함 cross-site 검증)
- status 값 (4 lifecycle 외 reject — 예: Coffee 의 `resolved` 는 `approved_rule` 로 마이그)
- 필수 필드 누락 (status / title / observation / candidate_rule)
- 깨진 wiki 링크
- evidence_count >0 검증 (status=approved_rule 인데 count=0 이면 fail)

자세한 lint logic: [[scripts/lessons-lint.py]].

## 5. 본 sprint 23 의 진행 결과

### 5.1 Coffee LESSONS schema 정정

기존 `coffee-lesson-012`, `coffee-lesson-009` 의 status `resolved` (Coffee 임의 명명) → `approved_rule` (정본 schema). 의미 동일 — 반복 확인 후 RULES.md 반영 단계.

### 5.2 본 sprint 의 lesson 등록 — coffee-lesson-016

| field | value |
|---|---|
| id | coffee-lesson-016 |
| status | candidate_rule |
| title | 정본 가이드라인 사전 read 누락 시 fork 작성 위험 |
| observation | 본 agent (Claude Code) 가 sprint 19~22 진행 시 `harness/!공통하네스_가이드라인.md` (cross-codex 정본 v1) 의 존재 인지 못함. `harness/coffee-data/AUTONOMY_POLICY.md` 작성 시 본 가이드라인의 무자각 fork. lessons schema 도 임의 명명 (`resolved` 가 본 가이드라인의 `approved_rule` 와 다른 명칭). |
| problem | 본 가이드라인 §4 의 Required Context Documents (AGENTS.md / CLAUDE.md / harness/common/HARNESS_GUIDELINES.md / harness/common/AUTONOMY_POLICY.md) read 절차가 sprint 진입 전 표준화 안 됨. agent 가 정본 모르고 진행 시 fork + schema 불일치 발생. |
| candidate_rule | 신규 sprint 진입 시 §4 Required Context Documents 의 모든 정본 문서 read 후 진입. AGENTS.md / CLAUDE.md / 가이드라인 정본 문서 read 절차를 매 sprint 의 작업 시작 규칙으로 명시. |
| applies_to | * (모든 site) |
| evidence | sprint 23 진입 시점 (2026-05-03 KST) 본 agent 가 가이드라인 read 안 한 상태로 sprint 22 까지 진행 — !menu / !aiosagent / !function 작성 시 정본 참조 0 |
| confidence | 0.95 |
| owner | Claude Code |

### 5.3 다음 sprint 23.1 (후속) — **2026-05-03 진행 완료**

- AGENTS.md / CLAUDE.md 의 "신규 sprint 진입 시 정본 문서 read 절차" 추가 — **완료** (sprint 23.1)
- `harness/!공통하네스_가이드라인.md` redirect 로 정리 — **완료** (775 → ~30 줄)
- `scripts/harness-preflight-check.py` 신규 — **완료** (5 검사 항목)
- coffee-lesson-016 의 cross-site 적용 강조 — **완료** (본 INDEX §3 cross-cutting table 등록)

### 5.4 sprint 23.2 (2026-05-03 완료)

- TikTok LESSONS.md 신규 (7 lesson) — `tiktok/!tiktokroasplan.md` 의 결론/원인 분해 추출
- AIBIO LESSONS.md 신규 (5 lesson) — `aibio/aibio_revenue_reconciliation.md` + `aibio_sync_design.md` 추출
- biocom 6 cross-cutting 추가 등록 (§3 의 표 16 row 로 확장)
- `scripts/lessons-lint.py` 의 LESSONS_PATHS 에 tiktok/aibio 추가 → 34 lesson 검증 PASS

### 5.5 sprint 23.3 (2026-05-03 완료) — Yellow Lane Z-1

- `.githooks/pre-commit` 신규 (Y1-A) — Growth Data 관련 영역 변경 commit 시 preflight 자동 호출
- `scripts/install-harness-precommit.sh` 신규 — 운영자 1회 실행으로 git config core.hooksPath = .githooks 설정
- `scripts/harness-preflight-check.py` 보강 (Y2-C) — `[4b] global fork detect`: 250줄+ markdown 의 common header phrase grep + whitelist
- CLAUDE.md / AGENTS.md 에 hook 설치 안내 추가

## 6. 정본 경로 + legacy alias 정책 (sprint 23.3)

| 경로 | 역할 | 유지 정책 |
|---|---|---|
| `harness/common/HARNESS_GUIDELINES.md` | **정본 v1** — Growth Data Agent Harness Guidelines | 본문 보존 + 모든 sprint 의 source-of-truth |
| `harness/common/AUTONOMY_POLICY.md` | **정본 v1** — Lane 분류 + 자율 권한 | 본문 보존 |
| `harness/common/REPORTING_TEMPLATE.md` | **정본 v1** — Auditor verdict / 보고 형식 | 본문 보존 |
| `harness/!공통하네스_가이드라인.md` | **legacy redirect** — sprint 23.1 정리됨 (775→~30줄) | 삭제 안 함, redirect 만 유지 (외부 link history 보존) |
| `harness/coffee-data/AUTONOMY_POLICY.md` | **project-specific** (Coffee 한정) — Lane 정의는 정본과 동일, project context 추가 | 정본 fork 금지, project-local 차이만 명시 |
| `harness/{project}/RULES|VERIFY|LESSONS|AUDITOR_CHECKLIST.md` | project-specific harness | 정본 schema 따르되 본문 fork 금지 |
| `harness/0501gpt/` | GPT review archive | `.gitignore` 적용, fork detect whitelist |

위반 detect: `python3 scripts/harness-preflight-check.py --strict` (sprint 23.3 의 [4a] hardcoded + [4b] global grep). pre-commit hook 자동 호출.

## 6. INDEX 갱신 routine

본 INDEX 는 정적이 아닌 운영 문서. 갱신 trigger:
- 신규 lesson 등록 시 — 본 INDEX 의 §1 site count 자동 갱신 (lessons-lint.py 가 주기적 실행)
- cross-cutting 판정 시 — §3 표 갱신
- site 추가 시 (TikTok / AIBIO LESSONS.md 신규 시) — §1 row 추가

자동화 후속: sprint 24 (AEO/GEO score 자동 산출) 와 같은 패턴 — INDEX 자체도 cron 으로 갱신 가능.

## 7. 본 문서의 자기 정의

본 문서는 **lessons 의 navigation index**. 각 site 의 LESSONS.md 가 정본, 본 INDEX 는 cross-site grep + lint + 통합 view 의 entry point. 본 가이드라인 §10 의 lessons-to-rules pipeline 이 cross-site 단위로 작동하도록 보장.

자세한 lifecycle: [[harness/!공통하네스_가이드라인#10-lessons-to-rules-흐름]] · 정본 schema: [[harness/npay-recovery/LESSONS_TO_RULES_SCHEMA]] · lint script: [[scripts/lessons-lint.py]].
