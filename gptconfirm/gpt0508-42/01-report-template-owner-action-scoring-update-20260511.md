# 보고서 양식 업데이트 — owner 분리 + 추천 점수표 (gpt0508-42 작업0)

작성 시각: 2026-05-11 15:10:00 KST
적용 정본: `harness/common/REPORTING_TEMPLATE.md` v1.2

## 1. 사람이 이해하는 작업 설명

- **무엇을 했는가**: REPORTING_TEMPLATE v1.1 의 "5줄 결론" 자연어 only 요약 섹션을 폐지하고, 사람이 한 번에 흡수 가능한 보고서를 만들기 위한 5 섹션 구조 + next-action owner 점수표를 새로 박았다. CLAUDE memory 두 개 갱신 + REPORTING_TEMPLATE 헤더에 v1.2 변경 박스 추가.
- **왜 했는가**: 2026-05-03 의 5줄 결론 강제 정책은 sprint 가 커지면서 owner 분리 / Claude Code 가능 여부 / 추천 점수 같은 의사결정 정보를 담지 못해 본 sprint (gpt0508-42) 시작 시 TJ 가 직접 정정. 같은 sprint 안에서 정책 정본 갱신 + 본 sprint 결과보고에도 즉시 적용.
- **어떻게 했는가**: (a) `harness/common/REPORTING_TEMPLATE.md` 헤더에 v1.2 변경 § 추가, (b) `feedback_5_line_conclusion.md` memory 내용을 폐지 → 신규 5 섹션 구조로 교체, (c) `feedback_next_action_owner_scoring.md` memory 신설, (d) `MEMORY.md` 인덱스 갱신.
- **결과가 무엇인가**: 향후 모든 sprint 결과보고 / 중간 보고 / 단발 답변은 1) 사람이 이해하는 작업 설명 6 필드 / 2) 작업별 결과표 / 3) Track 진척률 / 4) 금지선 준수 / 5) 다음 할 일 owner 분리 점수표 5 섹션 구조로 작성. 5줄 결론 표현 사용 금지.
- **목표에 어떤 영향을 줬는가**: Track F (QA / Guard / Data Guide) 92→93% 도달. 같은 sprint 안에서 다른 작업 결과보고를 새 양식 그대로 적용해 양식 의 실제 효과 검증 가능.
- **남은 병목은 무엇인가**: 기존 sprint (gpt0508-37~41) 의 보고서는 옛 5줄 결론 형식 그대로 archive. 본 정책은 forward-only — 과거 문서 retroactive 수정 안 함.

## 2. 양식 변경 핵심

| 섹션 | v1.1 (폐지) | v1.2 (신규) |
|---|---|---|
| 1 | "## 한 줄 결론" 자연어 요약 | "## 1. 사람이 이해하는 작업 설명" — 6 필드 |
| 2 | "## 완료한 것" 표 | "## 2. 작업별 결과표" — owner 칼럼 포함 |
| 3 | "## 진척률 %" | "## 3. Track 진척률" |
| 4 | "## 하지 않은 것" YES/NO | "## 4. 금지선 준수" invariant 표 |
| 5 | "## 다음 액션" Lane 표 | "## 5. 다음 할 일 owner 분리 + 추천 점수표" |

### §5 next-action 점수표 양식

| Owner | Action | Claude Code 직접 가능? | 못 하면 이유 | 데이터 충분도 | 타이밍 | 목표 영향도 | 위험도 (↓ 좋음) | 종합 추천 | 추천 |
|---|---|---|---|---:|---:|---:|---:|---:|---|

- Owner = `Claude Code` 또는 `TJ님` 둘 중 하나.
- TJ 님 행은 Claude Code 가능 여부 (YES / NO / PARTIAL) 먼저 검토.
- PARTIAL 이면 Claude Code 가 먼저 할 부분 별도 행으로 분리.
- 점수 0~100. 위험도는 낮을수록 좋음.
- 추천: 진행 / 조건부 진행 / 보류.

## 3. Green 작업 진행 원칙

Green 영역 작업은 1차 개발 완료 후 멈추지 말고 추가 조사 → 설계 → approval packet 까지 같은 sprint 안에서 끌고 간다. Yellow / Red 는 승인 게이트일 뿐 금지가 아니므로 필요 시 packet 만들어 제안하되 승인 전 실행 금지.

## 4. 변경 파일

| 파일 | 내용 | 범위 내 |
|---|---|---|
| `harness/common/REPORTING_TEMPLATE.md` | v1.2 헤더 + 변경 § 추가 | ✅ |
| `~/.claude/projects/.../memory/feedback_5_line_conclusion.md` | 폐지 → 새 5 섹션 구조 안내 | ✅ |
| `~/.claude/projects/.../memory/feedback_next_action_owner_scoring.md` | 신규 점수표 강제 | ✅ |
| `~/.claude/projects/.../memory/MEMORY.md` | 인덱스 두 항목 갱신 | ✅ |

산출 JSON: `data/report-template-owner-action-scoring-update-20260511.json`
