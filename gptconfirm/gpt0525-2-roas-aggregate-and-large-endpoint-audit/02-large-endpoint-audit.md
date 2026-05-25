# 대형 Endpoint 후보 감사

## P0: 바로 줄여야 하는 후보

### 1. `/api/ads/tiktok/roas-comparison`

현재 역할:

- TikTok 광고비/전환/내부 매출을 비교한다.
- TikTok 광고가 현재 꺼져 있어도 화면 진입 시 자동 호출된다.

무거운 이유:

- 내부에서 `/api/attribution/ledger`를 `limit=10000`으로 조회한다.
- 내부에서 `/api/attribution/tiktok-pixel-events`도 `limit=10000`으로 조회한다.
- 화면에 필요한 요약 숫자를 만들기 위해 원본 row를 크게 가져온다.

추천:

- 기본 화면은 새 요약 API만 호출한다.
- 기존 `roas-comparison`은 “정밀 진단” 버튼으로만 호출한다.

### 2. `/api/attribution/tiktok-pixel-events`

현재 역할:

- TikTok pixel 이벤트 원본 목록을 반환한다.

무거운 이유:

- `limit=10000`까지 원본 items를 반환할 수 있다.
- `/api/attribution/ledger`와 달리 이번 hard guard 수준의 public cap/summary-only 패턴이 아직 약하다.

추천:

- `summaryOnly=true` 모드 추가.
- public caller 기본 cap 축소.
- TikTok 성과 화면은 raw items 대신 summary만 사용.

## P1: 모니터링하면서 요약-first로 전환할 후보

### 1. `/api/ads/roas`

Meta ROAS 단건 조회 API다. lazy cache가 있으나, cache miss나 넓은 window에서는 내부 원장 조회가 커질 수 있다.

추천:

- 기본 대시보드에서는 `/api/ads/roas-summary` 우선 사용.
- 상세 진단일 때만 `/api/ads/roas` 호출.

### 2. `/api/ads/roas/daily`

일별 Meta ROAS 조회 API다. 광고 성과 페이지에서 사용된다.

추천:

- 최근 7일/30일 기본 카드에는 precomputed summary를 우선 사용.
- campaign/adset 세부 drilldown만 live 계산.

### 3. `/api/ads/campaign-ltv-roas`

LTV/CAC 및 캠페인 ROAS 분석에 사용된다.

추천:

- 주기적 summary cache를 붙이고, raw ledger 재계산은 수동 새로고침으로 분리.

### 4. `/api/google-ads/dashboard`

Google Ads ROAS/대시보드 API다. 내부에서 VM Cloud ledger를 chunk 조회한다.

추천:

- 현 구조는 TikTok보다 낫지만, 넓은 기간을 기본 자동 호출하지 않게 cache 우선으로 유지한다.

## P2: 수동/스크립트 후보

아래는 화면 자동 호출보다 위험도는 낮지만, 반복 실행되면 VM Cloud를 두드릴 수 있다.

- `backend/scripts/monthly-evidence-join-dry-run.ts`
- `backend/scripts/tiktok-guard-monitor.cjs`
- `backend/scripts/vm-snapshot-refresh-20260514.ts`
- `backend/src/routes/aibio.ts` fallback comparison

추천:

- cron 또는 수동 스크립트는 실행 주체와 주기를 문서화한다.
- 원본 row가 필요한 스크립트는 실행 전 예상 row 수와 window를 출력한다.

