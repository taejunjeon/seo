# 보고서 양식 v1.3 — 사람 말 우선 (gpt0508-43 작업0)

작성 시각: 2026-05-11 17:00:00 KST
적용 정본: `harness/common/REPORTING_TEMPLATE.md` v1.3

## 1. 이번에 가능해진 것

이제 모든 sprint 결과보고 채팅 답변이 "사람이 바로 이해하는 5 필드 설명" 으로 시작하고, 개발 용어는 처음 1회 괄호 안에서만 등장한다. 검증 결과 상세표나 금지선 준수 invariant 같은 긴 표는 sprint 산출 문서 (gptconfirm 마크다운) 안에만 들어가 채팅에는 들어가지 않는다.

## 2. 왜 필요했는지

직전 sprint (gpt0508-42) 의 보고가 여전히 "site_landing_ledger 에 fan-out wire 박았다" 같은 개발 용어 중심이라 비개발자가 첫 문단만 보고 무엇이 가능해졌는지 알 수 없었다. 그리고 채팅에 invariant 표가 항상 들어가면 사람이 정작 봐야 할 "이번에 가능해진 것" 을 찾기 어려웠다.

## 3. 어떻게 작동하는지 (비개발자용 설명)

- 채팅 답변에 들어가는 것: ① 이번에 가능해진 것 ② 왜 필요했는지 ③ 비개발자용 설명 ④ 실제로 확인된 결과 ⑤ 아직 안 된 것 + 다음 할 일 owner 분리 점수표.
- 채팅 답변에 들어가지 않는 것: 금지선 준수 긴 표 / 검증 결과 상세 (fixture 케이스별 / 명령어 / commit hash) / raw send upload invariant — 이건 sprint 산출 문서로 분리.
- 개발 용어 등장 규칙: "고객 유입 장부 (site_landing_ledger)" 처럼 처음 한 번 괄호 안에 영어 이름 표시 후, 다음부터는 한국어 사람 말만 사용.

## 4. 실제로 확인된 결과

- 보고서 양식 정본 (`harness/common/REPORTING_TEMPLATE.md`) 의 v1.3 변경 § 추가.
- 메모리 (`feedback_readable_report_language.md`) 신설. 인덱스 (`MEMORY.md`) 갱신.
- 본 sprint (gpt0508-43) 의 모든 결과보고가 v1.3 양식 자체 적용.

## 5. 아직 안 된 것

이전 sprint (gpt0508-37 ~ 42) 의 보고서는 옛 양식 그대로 archive — retroactive 수정 안 함. 본 sprint 의 작업 1 에서 gpt0508-42 결과만 readable 형식으로 rewrite.

## 6. 기술어 치환표

| 기술어 | 사람 말 |
|---|---|
| site_landing_ledger | 고객 유입 장부 |
| backend handler | 서버가 신호를 받는 입구 |
| fan-out wire | 들어온 신호를 유입 장부에도 같이 적도록 연결 |
| recordSiteLanding | 유입 장부에 기록하는 기능 |
| marketing-intent / checkout-context / payment-success / paid-click-intent | 광고/마케팅 유입 신호 / 결제 단계 진입 신호 / 결제완료 신호 / 유료 광고 클릭 신호 |
| summary API | 화면이 읽을 수 있는 유입 분석 결과 조회 기능 |
| frontend minimal view | 유입 분석 결과를 보여주는 간단한 화면 |
| fixture PASS | 테스트용 데이터 검증 성공 |
| production trigger | 실제 운영 트래픽이 들어오는 연결점 |

## 7. gptconfirm 패키지 5 문서 한도

| # | 권장 파일 |
|---|---|
| 1 | 00-result-report.md |
| 2 | 01-implementation-and-validation.md |
| 3 | 02-analysis-and-decision.md |
| 4 | 03-approval-and-next-actions.md |
| 5 | 99-total-current-copy.md |
|  | manifest.json |

최대 8 문서 (사유 00-result 안에 명시). 합칠 수 있는 문서는 합친다. telegram skip note 는 별도 문서 X — 00 또는 03 안에 한 문단으로 통합.

## 8. 다음 할 일

| Owner | Action | Claude Code 직접 가능? | 못 하면 이유 | 데이터 충분도 | 타이밍 | 영향도 | 위험도 (↓) | 종합 추천 | 추천 |
|---|---|---|---|---:|---:|---:|---:|---:|---|
| Claude Code | 작업 1 gpt0508-42 readable rewrite | YES | — | 95 | 95 | 80 | 5 | 92 | 진행 |
| Claude Code | 작업 6 패키지를 본 v1.3 그대로 5 문서로 만든다 | YES | — | 90 | 90 | 75 | 10 | 88 | 진행 |

산출 JSON: `data/report-template-v1-3-readable-owner-scoring-20260511.json`
