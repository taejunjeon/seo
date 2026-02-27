# report0222feedback-1result — GA4 “AI 유입(referral)” 집계 API 반영 결과

작성일: 2026-02-22  
작성: 헤파이스토스(코딩 에이전트)  
대상 저장소: `/Users/vibetj/coding/seo`

---

## 0) 결론 요약

- `report0222feedback-1.md`의 핵심 목표(“AI 서비스 referral 유입을 GA4 Data API로 안정 집계 → 프론트가 쓰게”)를 위해 **신규 API 2개 + 옵션 API 1개를 백엔드에 구현**했습니다.
- **캐시(30분~1시간 TTL) + inflight dedupe**를 넣어 내부 운영에서 API 남발/비용을 줄였습니다.
- “AI 유입 키워드(=사용자 프롬프트)”는 GA4만으로는 직접 측정이 어려워, 옵션으로 **랜딩페이지 TOP → GSC top queries 매핑(근사치)** API를 추가했습니다.
- 보안 항목([6])의 “URL fetch allowlist/SSRF 방지”는 **정책 결정(허용 도메인 범위) 없이는 기능 제약이 커서 이번 반영에서 제외**하고, 다음 계획으로 남겼습니다.

---

## 1) 반영된 변경 사항(코드)

### 1-1. 신규/변경 API

1) `GET /api/ga4/ai-traffic?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&limit=20&referralOnly=0|1&refresh=0|1`
   - GA4 Data API에서 **AI 서비스 sessionSource allowlist** 기반으로 AI referral 트래픽을 집계해 반환합니다.
   - Response 스키마는 피드백 문서 예시를 따르며, `debug.matchedPatterns`/`debug.notes` 포함.
   - `referralOnly=1`이면 `sessionMedium=referral` 보조 필터를 AND로 추가(기본은 off).
   - `refresh=1`이면 캐시를 우회합니다.

2) `GET /api/ga4/top-sources?startDate=...&endDate=...&limit=200&refresh=0|1`
   - **필터 없이** sessionSource 상위 목록을 반환(allowlist 튜닝 용도).

3) (옵션) `GET /api/ai-traffic/topics?startDate=...&endDate=...&topPages=10&topQueries=3&referralOnly=0|1&refresh=0|1`
   - `/api/ga4/ai-traffic`의 byLandingPage TOP N을 뽑고,
   - 각 랜딩의 path를 기준으로 GSC에 page contains 필터를 걸어 **top queries(근사치)**를 붙여 반환합니다.
   - 내부 캐시 1시간 TTL.

### 1-2. 수정 파일

- `backend/src/ga4.ts`
  - `queryGA4AiTrafficDetailed()` 추가: totals/bySource/byLandingPage + allowlist 필터 + optional referralOnly
  - `queryGA4TopSources()` 추가: 필터 없는 상위 sessionSource 목록
  - 캐시(30분 TTL) + inflight dedupe 추가
- `backend/src/server.ts`
  - 라우트 추가: `/api/ga4/ai-traffic`, `/api/ga4/top-sources`, (옵션) `/api/ai-traffic/topics`
  - topics endpoint용 캐시(1시간 TTL) + inflight dedupe 추가

### 1-3. 백업(수정 전)

- `backend/src/ga4.ts.bak.20260222`
- `backend/src/server.ts.bak.20260222`

---

## 2) GA4 쿼리 구현(피드백 요구사항 매핑)

### 2-1. dimensions / metrics

- `/api/ga4/ai-traffic`
  - **bySource**: dimensions = `sessionSource`, `sessionMedium` (응답의 `sessionSourceMedium`는 `${source} / ${medium}`으로 생성)
  - **byLandingPage**: dimensions = `landingPagePlusQueryString`
  - **totals**: dimensions 없음(총합)
  - metrics:
    - `sessions`
    - `activeUsers`
    - `totalUsers` (totals에만 포함)
    - `ecommercePurchases`
    - `grossPurchaseRevenue`

### 2-2. dimensionFilter(allowlist)

- `sessionSource`에 대해 OR 그룹으로 `CONTAINS` 매칭:
  - `chatgpt.com`, `chat.openai.com`, `openai`, `perplexity.ai`, `claude.ai`, `gemini.google.com`, `bard.google.com`, `copilot.microsoft.com`, `bing.com`
- 옵션: `referralOnly=1`이면 AND로 `sessionMedium=referral` 추가

---

## 3) 캐시/비용([5] 반영)

- `backend/src/ga4.ts`
  - `/api/ga4/ai-traffic`: 30분 TTL 메모리 캐시 + inflight dedupe
  - `/api/ga4/top-sources`: 30분 TTL 메모리 캐시 + inflight dedupe
- `backend/src/server.ts`
  - `/api/ai-traffic/topics`: 1시간 TTL 메모리 캐시 + inflight dedupe
- 공통: `refresh=1` 쿼리로 캐시 우회 가능

---

## 4) DoD(완료 기준) 체크

- ✅ `/api/ga4/ai-traffic`가 구조화된 JSON을 반환
  - GA4 미설정(`GA4_PROPERTY_ID` 없음)인 경우에도 프론트 렌더 안정성을 위해 **200 + 0값 구조**로 반환(단, `debug.notes`에 미설정 명시)
- ✅ `/api/ga4/top-sources`로 실제 `sessionSource` 값을 확인 가능
- ✅ 프론트가 KPI + 표(소스/랜딩) 렌더링 가능한 수준의 스키마 제공
  - (프론트 실제 UI 반영은 이번 범위에서 미포함. 아래 “다음 계획”에 포함)

---

## 5) 피드백 항목별 반영 결과(성공/미해결)

### [성공] [1] 신규 엔드포인트 `/api/ga4/ai-traffic`

- 구현 완료: `backend/src/server.ts`에 라우트 추가, `backend/src/ga4.ts`에 상세 집계 함수 구현
- 요구 스키마 충족:
  - `range`, `definition`, `totals`, `bySource`, `byLandingPage`, `debug(matchedPatterns, notes)`

### [성공] [2] GA4 쿼리 구현 포인트

- dimensions/metrics 반영 완료
- allowlist OR-group(CONTAINS) 반영 완료
- “referral 보조 필터”는 **기본 off + `referralOnly` 옵션 제공**으로 반영
  - 이유: 실제 GA4 값(최근 30일 sessionSource/sessionMedium 분포)을 확인하기 전, 기본 on은 누락 리스크가 큼

### [성공] [3] 디버그 엔드포인트 `/api/ga4/top-sources`

- 구현 완료: 필터 없이 top sessionSource를 내려줌(allowlist 튜닝 용도)

### [성공(옵션)] [4] “AI 유입 주제/키워드” 근사치 API

- 구현 완료: `GET /api/ai-traffic/topics`
- 접근 방식:
  - GA4의 AI 유입 랜딩 TOP N + GSC page contains 필터로 top queries를 근사 매핑
- 한계(정확도):
  - “AI에 사용자가 입력한 프롬프트 키워드”가 아니라,
    “AI 유입이 많이 들어온 랜딩이 Google 검색에서 어떤 쿼리를 먹는지”의 **근사치**입니다.

### [성공] [5] 캐시/비용

- 30분~1시간 TTL 메모리 캐시 + inflight dedupe를 구현했고 `refresh=1`로 우회 가능하게 했습니다.

### [미해결] [6] 최소 보안/안전(allowlist/SSRF 방지)

- 이번 반영에서 **미적용**(사유)
  - “페이지 진단/크롤/서브페이지 탐색/broad match”는 사용자가 입력한 URL을 서버가 fetch하는 경로라,
    allowlist를 걸면 기능 제약이 커지고(경쟁사/외부 URL 진단 불가),
    allowlist 범위(예: `biocom.kr`만 vs 사내 테스트 도메인 포함) 합의가 필요합니다.
  - 또한 broad match는 이미 timeout(8s) + body read limit(64KB)이 있으나, **사설 IP 차단/호스트 검증 같은 SSRF 가드**는 별도 설계가 필요합니다.

---

## 6) 검증(내가 수행)

- `npm --prefix backend run typecheck` ✅ 통과
- `npm --prefix backend run build` ✅ 통과

---

## 7) 다음 개발 계획(왜 이렇게 잡았는지 포함)

1) 프론트(Tab 5 사용자 행동 / Tab 0 오버뷰)에 “AI 유입” UI 연결
   - 이유: API만 있으면 운영자가 실제로 쓰기 어렵고, 피드백의 목적이 “프론트가 쓰게”이기 때문입니다.
   - 구현 방향(추천):
     - Tab 5: 기간 선택 UI 재사용 → `/api/ga4/ai-traffic` 호출 → KPI(세션/유저/매출) + bySource/byLandingPage 테이블
     - Tab 0: 요약 카드 1개(최근 30일 AI 세션/유저 + 상위 1~3 소스)

2) allowlist/보조필터 튜닝(운영 데이터 기반)
   - 이유: `sessionSource` 실제 값이 GA4 설정/플랫폼별로 달라 allowlist를 코드에 고정하면 누락/오탐이 발생합니다.
   - 진행 방식:
     - `/api/ga4/top-sources`로 최근 30일 상위 목록 확인
     - “AI 유입으로 인정할 source 목록”을 확정(예: `chat.openai.com`, `chatgpt.com`, `perplexity.ai` 등)
     - 필요 시 `referralOnly` 기본값을 on으로 바꾸거나, `sessionDefaultChannelGroup=Referral` 같은 보조 필터 추가

3) (보안) URL fetch 엔드포인트 SSRF 가드 설계/반영
   - 이유: 내부툴이라도 URL fetch는 사고 파급이 크고, broad match는 외부 링크를 따라가므로 방어가 필요합니다.
   - 범위:
     - crawl/subpages/broad match에 대해
       - `http/https`만 허용
       - redirect hop 상한
       - timeout 상한(이미 일부 존재)
       - 사설 IP/링크-로컬 차단
       - (정책 결정 시) 허용 도메인 allowlist 적용

4) (품질) 엔드포인트별 스키마를 Zod로 고정 + 간단한 e2e smoke(옵션)
   - 이유: GA4 Data API는 차원/메트릭 제약으로 런타임 에러가 나기 쉬워, 스키마/에러핸들링을 고정해 두면 운영 안정성이 올라갑니다.

---

## 8) TJ님께 필요한 확인/질문(정보 요청)

1) “AI 유입”을 **세션(sessions)** 기준으로 볼까요, **유저(activeUsers/totalUsers)** 기준으로 볼까요? (UI KPI 우선순위 결정)
2) `referralOnly`를 기본값 on으로 할까요?
   - 실제 GA4에서 `sessionMedium` 값이 “referral”로 안정적으로 들어오는지 확인이 필요합니다.
3) e-commerce 메트릭(`ecommercePurchases`, `grossPurchaseRevenue`)은 이 GA4 속성에서 의미가 있나요?
   - 의미 없다면 UI/응답에서 숨기거나, 메트릭 조회를 옵션화해 런타임 제약을 줄일 수 있습니다.
4) [보안] 페이지 진단/크롤 기능에서 **외부 도메인 진단을 허용**해야 하나요?
   - 허용이면: SSRF 가드(사설 IP 차단 등) 중심
   - 비허용이면: `biocom.kr`(+필요 시 테스트 도메인) allowlist 강제

