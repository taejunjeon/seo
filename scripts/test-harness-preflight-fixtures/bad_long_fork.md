# Growth Data Agent Harness Guidelines v1 (long fork case)

본 파일은 의도된 fork 의심 fixture 이다. preflight-check 가 WARNING 으로 detect 해야 한다 (250-599줄 + common header phrase).

작성: 2026-05-03

## 0. 결론 (10초)

본 가이드라인은 모든 Growth Data 작업의 정본이다. (의도된 fork 의 첫 문장 — 본 정본은 harness/common/ 에 있고, 본 fixture 는 그 본문 일부를 fork 한 case)

## 1. Lane 분류

| Lane | 의미 |
|---|---|
| Green Lane | 자율 진행 |
| Yellow Lane | sprint 1회 승인 |
| Red Lane | 매 작업 명시 승인 |

## 2. Sprint 진입 절차

신규 sprint 진입 시 다음 순서로 작업:

1. AGENTS.md / CLAUDE.md read
2. harness/common/HARNESS_GUIDELINES.md read
3. harness/common/AUTONOMY_POLICY.md read
4. harness/common/REPORTING_TEMPLATE.md read
5. project-specific harness 디렉토리 read
6. lane 분류 후 작업 시작

## 3. Required Context Documents

| 문서 | 위치 | 용도 |
|---|---|---|
| AGENTS.md | repo root | agent 전용 지침 |
| CLAUDE.md | repo root | Claude Code 전용 |
| HARNESS_GUIDELINES.md | harness/common/ | 정본 v1 |
| AUTONOMY_POLICY.md | harness/common/ | Lane 정의 |
| REPORTING_TEMPLATE.md | harness/common/ | 보고 형식 |

## 4. 보고 형식

각 sprint 의 결과 보고는 REPORTING_TEMPLATE.md 의 표준 형식을 따라야 한다.

- 5줄 결론 (사람이 읽는)
- 변경 파일 목록
- 검증 결과 (tsc / lint / audit / lessons-lint / preflight-check)
- 새 lesson 등록
- Auditor verdict (PASS / PASS_WITH_NOTES / FAIL)
- 다음 액션 (무엇/왜/어떻게/누가/성공기준/실패해석)

## 5. 검증

- tsc: backend / frontend
- lint: eslint
- audit: project-specific harness audit script
- lessons-lint: scripts/lessons-lint.py
- preflight-check: scripts/harness-preflight-check.py --strict

## 6. lessons-to-rules pipeline

| stage | 의미 |
|---|---|
| observation | 단일 사례 |
| candidate_rule | 다음에도 적용 가능 |
| approved_rule | 반복 확인 후 RULES.md 반영 |
| deprecated_rule | 더 이상 쓰지 않음 |

## 7. 본 가이드라인의 변경

본 가이드라인의 변경은 TJ 명시 승인 (Red Lane). agent 자율 변경 안 함.

## 8. cross-site grep

```bash
grep -rn --include="*.md" "Pattern" harness/
```

## 9. 기타 항목들

본 fixture 는 의도된 long fork — 250-599줄 범위 안에 들어가도록 padding 한다.

### 9.1 padding section A

text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text.

### 9.2 padding section B

text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text.

### 9.3 padding section C

text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text.

### 9.4 padding section D

text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text.

### 9.5 padding section E

text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text text.

### 9.6 padding section F

line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line

### 9.7 padding section G

line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line
line

## 10. 끝

본 fixture 의 의도된 verdict: WARNING (250-599줄 + Growth Data Agent Harness Guidelines v1 phrase 포함).
