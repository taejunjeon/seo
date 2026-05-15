# 03. Implementation Handoff

작성 시각: 2026-05-15 KST

## 구현 담당

구현은 Claude Code가 진행한다. Codex는 이번 범위에서 설계까지만 한다.

## 권장 구현 순서

### Step 1. Read-only API부터 만든다

무엇을 하는가:

- `GET /api/attribution/funnel-health`를 만든다.

왜:

- 화면을 먼저 만들면 숫자의 출처가 흔들린다.
- 이 화면은 데이터 정합성이 핵심이므로 contract가 먼저다.

성공 기준:

- API 200
- site/window/granularity query 동작
- raw identifier output 0
- external send 0
- 운영DB write 0

### Step 2. 로컬 프론트 route를 만든다

무엇을 하는가:

- `frontend/src/app/ai-crm/conversion-funnel/page.tsx`
- `frontend/src/app/ai-crm/conversion-funnel/page.module.css`

왜:

- 기존 `/total`과 분리해 “월 매출 출처” 화면과 “전환 신호 관제” 화면 역할을 구분한다.

성공 기준:

- `http://localhost:7010/ai-crm/conversion-funnel`에서 화면이 열린다.
- 로딩 중 진행률/단계 표시가 보인다.
- API 실패 시 “무엇이 안 되는지” 사람이 읽을 수 있다.

### Step 3. AI CRM 카드에 진입점을 추가한다

무엇을 하는가:

- 기존 AI CRM 카드 그리드에 `전환 퍼널 관제` 카드를 추가한다.

왜:

- TJ님이 `https://biocom.ainativeos.net/#ai-crm`에서 바로 들어갈 수 있어야 한다.

성공 기준:

- 카드 클릭 시 conversion funnel page로 이동한다.
- 카드 설명이 기술 용어보다 사용자 베네핏을 먼저 말한다.

### Step 4. 일별/주별 퍼널 구현

무엇을 하는가:

- Funnel stage bar
- 일별/주별 line chart
- UTM breakdown
- unmatched reason drilldown
- CAPI health panel

왜:

- 하루 장애와 구조적 누락을 분리해야 한다.

성공 기준:

- 오늘/7일/30일 전환 가능
- 일별/주별 toggle 가능
- 결제 시작, 결제완료, CAPI 성공, Browser Purchase가 한 흐름으로 보임

### Step 5. 운영 반영 승인안 작성

무엇을 하는가:

- 로컬 구현과 smoke가 끝나면 VM Cloud backend/frontend 운영 반영 승인안을 만든다.

왜:

- API 추가와 운영 frontend deploy는 Yellow Lane이다.

성공 기준:

- pre-snapshot
- deploy 대상 파일
- build/typecheck
- post-snapshot
- rollback
- failure condition
- raw id leak check

## 디자인 세부 규칙

- 큰 카드는 6개 이하.
- 상세 진단은 기본 접힘.
- 원본 ID는 기본 비노출.
- 색상은 상태 중심으로만 쓴다.
- funnel 단계는 같은 높이/간격으로 고정한다.
- 버튼은 “조회”, “원인 보기”, “CSV 내보내기” 정도만 둔다.
- “CAPI”는 첫 등장 시 `전환 API=서버가 Meta에 구매 이벤트를 보내는 통로`라고 풀어쓴다.

## Claude Code에게 넘길 구현 프롬프트 초안

```text
YES: Conversion Funnel Monitor frontend/API implementation 진행.

목표:
gptconfirm/gpt0515-17-funnel-monitor-design 설계에 따라 전환 퍼널 관제 화면을 구현한다.

범위:
- GET /api/attribution/funnel-health read-only endpoint
- frontend route /ai-crm/conversion-funnel
- AI CRM 카드 그리드에 "전환 퍼널 관제" 카드 추가
- 일별/주별 funnel, UTM breakdown, unmatched drilldown, CAPI health 표시

금지:
- Meta/Google/GA4/TikTok/Naver send
- 운영DB write/import
- GTM publish
- VM Cloud schema migration without approval
- raw order/payment/click/member/email/phone output

성공 기준:
- local backend 7020 API 200
- local frontend 7010 page render
- 로딩 상태/실패 상태 표시
- raw identifier leak 0
- frontend typecheck PASS
- API smoke PASS
```
