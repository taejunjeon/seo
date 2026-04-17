# 바이브코딩 / AI 엔지니어링 적용 검토

작성일: 2026-04-16 KST

참조 문서:
- `agent/agentprd.md`
- `roadmap/roadmap0415.md`
- `agent/autoresearch.md`
- `docurule.md`

## 10초 결론

지금 이 프로젝트에 필요한 것은 범용 자율 코딩 에이전트가 아니다.

오토리서치의 핵심인 `고정 평가기 -> 제한된 수정 범위 -> 개선될 때만 유지 -> 증거 로그`만 가져와야 한다. 현재 로드맵에 이미 있는 `Revenue Integrity Agent`, `Verification Harness`, `Evidence Store`, `Work Queue`, `Approval Gate`가 그릇이다.

따라서 지금 구현 가치가 있는 것은 "밤새 알아서 코드를 고치는 에이전트"가 아니라, 운영 숫자를 읽고 정합성 문제를 발견한 뒤 사람이 승인할 수 있는 증거 패키지를 만드는 read-only 에이전트다.

## 문서 목적

이 문서는 오토리서치, 레니 뉴스레터/How I AI, Claude Code/Codex 운영 방식에서 현재 SEO 프로젝트에 실질적으로 도움이 되는 것과 아직 하면 안 되는 것을 구분한다.

## 먼저 하지 말아야 할 것

아래는 지금 만들면 토큰과 개발 시간을 낭비할 가능성이 높다.

| 항목 | 하지 않는 이유 |
|---|---|
| 범용 "자율 개발 에이전트" UI | 현재 병목은 UI 껍데기가 아니라 숫자 신뢰도, 원장, CAPI, CRM, 승인 루프다. |
| 오토리서치식 무제한 코드 수정 루프 | 이 프로젝트는 `val_bpb`처럼 단일 점수로 평가하기 어렵다. 잘못된 지표를 최적화하면 추적 코드나 운영 데이터를 망칠 수 있다. |
| GTM/Meta/DB를 자동 수정하는 에이전트 | 광고 전환, 개인정보, 운영 데이터는 사람 승인 없는 write-back 대상이 아니다. |
| "AI 뉴스 자동 수집"만 하는 기능 | 수집 결과가 backlog, evaluator, incident로 연결되지 않으면 지식 저장소만 커진다. |
| UI polish 전용 에이전트 | 현재 우선순위는 더 예쁜 화면이 아니라 "이 숫자를 믿어도 되는가"를 증명하는 일이다. |

## 오토리서치에서 가져올 것

오토리서치의 쓸모는 에이전트가 똑똑하다는 데 있지 않다. 사람이 평가 기준을 고정하고, 에이전트가 그 안에서만 반복하게 만든 구조가 핵심이다.

| 오토리서치 요소 | 현재 프로젝트 적용 |
|---|---|
| `program.md`는 사람이 쓴다 | `agent/programs/*.md`로 에이전트별 목적, 권한, 금지 행동, 완료 기준을 고정한다. |
| AI는 `train.py` 하나만 고친다 | Codex/Claude가 수정할 수 있는 파일 범위를 작업마다 좁힌다. 예: attribution rule만, integrity API만. |
| `prepare.py` 평가기는 고정한다 | `Verification Harness`는 같은 입력이면 같은 결과를 내는 고정 평가기로 둔다. 에이전트가 평가기를 같이 고치면 안 된다. |
| 5분 고정 평가 예산 | 운영 점검도 "최근 7일 원장", "최근 50건 주문", "오늘 AIBIO 폼 제출"처럼 고정 범위로 평가한다. |
| 개선 commit만 유지 | 테스트, 원장 샘플, incident 감소, 중복 전환 감소처럼 사전에 정한 기준을 통과한 변경만 남긴다. |
| `results.tsv` 로그 | `Evidence Store`에 API 응답, 쿼리 결과, 네트워크 payload, 스크린샷, 판단 이유를 저장한다. |

## 프로젝트에 맞는 구현 방향

현재 `agentprd.md`의 핵심 루프는 `수집 -> 정규화 -> 매칭 -> 차이 탐지 -> 원인 진단 -> 액션 제안 -> 사람 승인 -> 재검증`이다. `roadmap0415.md`도 Phase 2를 read-only Revenue Integrity Agent로 잡고 있고, Phase 7에 Agent Registry, Work Queue, Evidence Store, Runbook Library, Approval Gate, Verification Harness가 들어가 있다.

이 흐름은 오토리서치보다 운영 프로젝트에 더 맞다. 자동으로 고치는 것이 아니라, 먼저 문제를 정확히 발견하고 증거를 남기는 구조이기 때문이다.

## 지금 만들 가치가 있는 기능

### 1. Verification Harness

가장 먼저 필요하다.

역할은 "에이전트가 자기 말을 검증할 수 있게 하는 고정 평가기"다. 이게 없으면 Codex든 Claude Code든 결국 추측을 늘어놓게 된다.

초기 평가 항목:

| 평가 항목 | 확인할 것 |
|---|---|
| 원장 신선도 | biocom, coffee, AIBIO 원장 최신 row 시간이 기대 범위 안에 있는가 |
| 유입 분석 정합성 | raw 전환, test/debug 제외, 운영 전환 숫자가 분리되는가 |
| Meta Lead | 정상 폼 제출은 `aibio_form_submit`, 테스트 연락처는 `aibio_form_submit_test`로 분리되는가 |
| CAPI 품질 | event_id 중복 제거, browser/server 이벤트 매칭, 누락 이벤트가 보이는가 |
| Purchase Guard | 테스트 결제와 운영 결제가 분리되는가 |
| CRM/segment | 발송 대상, 제외 대상, 전환 대상이 같은 기준으로 계산되는가 |

권장 산출물:
- `GET /api/integrity/health`
- `GET /api/integrity/incidents`
- `GET /api/integrity/incidents/:id`
- 로컬 검증 명령: `npm --prefix backend run integrity:check`

### 2. Evidence Store

두 번째로 필요하다.

숫자 문제가 생겼을 때 "왜 문제라고 판단했는지"가 남아야 한다. 지금처럼 Meta, GTM, 원장, acquisition 화면, 네트워크 payload를 사람이 따로 모으면 재현성이 약하다.

초기 저장 단위:

| 증거 | 예시 |
|---|---|
| API 응답 | Meta Events Test, GTM tag fired 결과, ledger API 응답 |
| 원장 row | form_id, event_id, source, medium, is_test_contact |
| 쿼리 결과 | 최근 7일 채널별 전환, 제외 사유별 건수 |
| 화면/네트워크 증거 | Playwright screenshot, `facebook.com/tr` payload 요약 |
| 판단 로그 | "정상", "실제 문제", "테스트 제외", "확정 아님" |

초기에는 DB보다 파일 기반도 가능하다.

권장 경로:
- `agent/evidence/YYYY-MM-DD/<incident-id>.md`
- `agent/evidence/YYYY-MM-DD/<incident-id>.json`

운영 규모가 커지면 DB 테이블로 올린다.

### 3. Work Queue + Approval Gate

세 번째로 필요하다.

에이전트가 발견한 문제는 바로 수정하면 안 된다. 특히 GTM, Meta, DB, 배포, 개인정보와 연결된 작업은 사람 승인이 필요하다.

초기 task 상태:

| 상태 | 의미 |
|---|---|
| `detected` | 문제가 자동 발견됨 |
| `triaged` | 원인 후보와 증거가 정리됨 |
| `needs_approval` | 운영 변경이 필요함 |
| `approved` | TJ님 또는 운영자가 승인함 |
| `implemented` | Codex/Claude가 변경함 |
| `verified` | Verification Harness로 재검증 완료 |
| `dismissed` | 정상 차이 또는 보류로 판정 |

권한 기준:

| 작업 | 자동 가능 여부 |
|---|---|
| read-only 분석 | 가능 |
| 문서/증거 생성 | 가능 |
| 로컬 테스트 | 가능 |
| 프론트 표시 문구 수정 | 낮은 위험이면 가능 |
| GTM/Meta 태그 게시 | 승인 필요 |
| DB 스키마 변경 | 승인 필요 |
| 운영 데이터 수정 | 승인 필요 |
| 개인정보 수집 확대 | 승인 필요 |

### 4. Agent Program Files

오토리서치의 `program.md`를 우리 식으로 작게 쪼갠다.

권장 파일:
- `agent/programs/revenue-integrity.md`
- `agent/programs/data-freshness.md`
- `agent/programs/capi-quality.md`
- `agent/programs/crm-segment.md`
- `agent/programs/ops-runbook.md`

각 파일은 아래만 담는다.

1. 에이전트 목적
2. 읽을 수 있는 데이터
3. 수정 가능한 파일
4. 금지 행동
5. 통과해야 하는 평가기
6. incident 출력 형식
7. 사람 승인 기준

이렇게 해야 Codex나 Claude Code가 세션마다 긴 설명을 다시 읽지 않아도 된다.

### 5. Nightly Read-only Ops Research

"밤새 자동으로 개선"은 코드가 아니라 운영 점검에 먼저 적용한다.

매일 새벽에 실행할 만한 read-only 점검:

| 점검 | 결과 |
|---|---|
| 전날 원장 fresh 여부 | stale incident 생성 |
| 채널별 전환 급락/급증 | acquisition incident 생성 |
| test/debug 제외 급증 | tracking hygiene incident 생성 |
| Meta Lead/GA4 lead 차이 | paid tracking incident 생성 |
| CRM 발송 대비 전환 누락 | CRM integrity incident 생성 |

이 작업은 실제로 도움이 된다. 코드 변경 없이 문제를 빨리 찾고, 사람에게 승인 가능한 증거를 주기 때문이다.

## Codex와 Claude Code 역할 분리

| 역할 | Codex가 더 맞는 일 | Claude Code가 더 맞는 일 |
|---|---|---|
| 백엔드/데이터 | API, evaluator, 원장 정규화, 테스트, Playwright 검증 | 구조 리뷰, 대안 설계 검토 |
| 프론트 | 동작 검증, 데이터 바인딩, 회귀 수정 | 화면 문구, 운영자용 설명, 와이어 UI 초안 |
| 운영 문서 | 변경 로그, 검증 결과, 파일 기반 evidence | 긴 운영 runbook, 고객/운영자 안내문 |
| 리서치 | 소스 확인 후 구현 항목으로 변환 | 긴 자료 요약, 사례 비교, 아이디어 발산 |
| 위험 작업 | 승인 후 제한된 패치 | 승인 전 영향 범위 정리 |

결론은 하나다. 숫자와 테스트가 필요한 작업은 Codex 중심, 맥락 정리와 운영자 이해가 중요한 작업은 Claude Code를 보조로 쓰는 것이 맞다.

## 외부 자료에서 얻은 실전 힌트

| 출처 | 확인한 내용 | 우리 프로젝트 적용 |
|---|---|---|
| Karpathy Autoresearch | `prepare.py`는 고정하고, AI는 `train.py`만 수정하며, `program.md`는 사람이 관리한다. 평가는 고정 시간과 단일 지표로 한다. | 평가기와 수정 범위를 분리한다. 에이전트가 자기 평가 기준을 고치지 못하게 한다. |
| Anthropic Claude Code Best Practices | Claude Code는 테스트, 스크린샷, 예상 출력처럼 스스로 검증할 수 있는 기준이 있을 때 성능이 좋아진다. 먼저 탐색하고 계획한 뒤 구현하는 흐름을 권장한다. | `Verification Harness`를 먼저 만들고, 큰 작업은 탐색/계획/구현을 분리한다. |
| Lenny's Newsletter AI productivity survey | 엔지니어 쪽에서는 ChatGPT, Cursor, Claude Code 같은 코딩 특화 도구가 강하게 쓰이고, 문서화/코드리뷰/테스트 작성 수요가 크다. | 단순 코드 생성보다 테스트, 리뷰, 문서화, 증거 정리에 AI를 붙이는 편이 ROI가 높다. |
| Lenny's How I AI - Galileo 사례 | 코드와 내부 문서를 함께 읽어 고객 질문에 답하는 방식이 소개됐다. "현재 코드가 문서보다 더 믿을 수 있는 source of truth"라는 점이 핵심이다. | 오래된 문서보다 현재 repo, 원장, API 응답을 우선 근거로 삼는 Q&A/incident 에이전트가 유용하다. |
| Lenny's How I AI - Gumroad 사례 | v0, Cursor, Devin 등을 써서 빠른 프로토타입과 구현 속도를 높이는 흐름이 소개됐다. | UI 초안에는 유용하지만, 우리 핵심 병목인 추적 정합성에는 고정 검증 없이 바로 적용하면 위험하다. |
| ChatPRD How I AI - granular context library | 큰 context 파일 하나보다 작은 markdown context library를 만들고, index 파일로 찾게 하는 방식이 소개됐다. | `agent/programs/*.md`, `agent/evidence/*`, `runbook/*`처럼 작은 단위 문서가 낫다. |

## 72시간 실행안

### 1일차: 평가기 계약 고정

할 일:
- `Revenue Integrity Agent`가 만들 incident schema 정의
- `integrity health` 출력 JSON 예시 작성
- test/debug 제외 기준을 evaluator에 고정
- `aibio_form_submit`과 `aibio_form_submit_test` 분리 검증 케이스 추가

완료 기준:
- 같은 입력 원장을 넣으면 같은 incident 결과가 나온다.
- AI가 설명을 바꿔도 숫자는 바뀌지 않는다.

### 2일차: read-only API 만들기

할 일:
- `GET /api/integrity/health`
- `GET /api/integrity/incidents`
- `GET /api/integrity/incidents/:id`
- evidence payload에 원장 row, API 응답 요약, 판단 이유 포함

완료 기준:
- biocom, coffee, AIBIO를 같은 endpoint에서 볼 수 있다.
- AIBIO 네이버 유입 1건처럼 "구체적으로 어디까지 알 수 있는지"를 evidence로 설명할 수 있다.

### 3일차: 운영자 화면과 evidence 파일

할 일:
- `/tracking-integrity` 또는 별도 integrity 화면에 incident 목록 추가
- incident 상세에 증거와 다음 액션 표시
- `agent/evidence/YYYY-MM-DD/`에 샘플 evidence 저장

완료 기준:
- 운영자가 "문제인지 정상 차이인지"를 1분 안에 판단할 수 있다.
- TJ님 승인 없이는 GTM, Meta, DB, 배포 변경으로 넘어가지 않는다.

## MVP 성공 기준

이 기능은 아래를 만족해야 만든 의미가 있다.

| 기준 | 통과 조건 |
|---|---|
| 숫자 재현성 | 같은 원장 입력으로 같은 결과가 나온다. |
| 증거 추적성 | incident마다 근거 row, API 응답, 판단 이유가 남는다. |
| 사람 승인 | 운영 변경은 승인 전에는 실행되지 않는다. |
| 재검증 | 변경 후 같은 evaluator로 다시 검증한다. |
| 토큰 절약 | 에이전트가 매번 전체 repo를 읽지 않고 필요한 program/evidence만 읽는다. |
| 사업 연결 | incident가 "광고비 낭비", "전환 누락", "CRM 성과 왜곡" 중 하나로 연결된다. |

## 다음 개발 판단

바로 개발한다면 순서는 아래가 맞다.

1. `Verification Harness`를 먼저 만든다.
2. 그 결과를 `Revenue Integrity Agent read-only MVP` API로 노출한다.
3. incident별 `Evidence Store`를 파일 기반으로 시작한다.
4. `Work Queue + Approval Gate`는 DB 전환 전까지 JSON/markdown으로 작게 시작한다.
5. Codex/Claude Code 자동화는 이 평가기와 증거 저장소 위에서만 허용한다.

## 최종 판단

오토리서치를 그대로 구현하는 것은 지금은 하지 않는다.

다만 오토리서치의 방식 중 `평가기 고정`, `수정 범위 제한`, `개선될 때만 유지`, `결과 로그 축적`은 지금 프로젝트에 바로 도움이 된다. 이 네 가지를 Revenue Integrity Agent의 개발 규칙으로 가져오면 껍데기 에이전트가 아니라 실제 운영 숫자를 지키는 에이전트가 된다.

## 참고 링크

- Karpathy Autoresearch GitHub: https://github.com/karpathy/autoresearch
- Anthropic Claude Code Best Practices: https://code.claude.com/docs/en/best-practices
- Lenny's Newsletter - AI tools are overdelivering survey: https://www.lennysnewsletter.com/p/ai-tools-are-overdelivering-results
- Lenny's Newsletter - Gumroad CEO playbook with v0, Cursor, Devin: https://www.lennysnewsletter.com/p/gumroad-ceos-playbook-to-40x-his
- Lenny's Newsletter - Claude Code codebase Q&A/Galileo case: https://www.lennysnewsletter.com/p/i-gave-claude-code-our-entire-codebase
- ChatPRD How I AI - granular context library: https://www.chatprd.ai/how-i-ai/workflows/how-to-create-a-granular-context-library-for-lazy-prompting-with-ai
