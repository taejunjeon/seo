# feedback0226codex1.0 구조 조사 리포트 (Tab 0) — 2026-02-26

요청사항: **구조 조사/리포트만** (코드 수정 없이)  
대상: Tab 0(오버뷰) 내 ① AI 에이전트 활동 상태(AI Insights) ② 키워드 인텐트 분석 ③ AI 최적화 작업 체크리스트

---

## 조사 A: AI 에이전트 활동 상태 구조 분석

### 데이터 흐름
`frontend Tab0(page.tsx)` → `GET /api/ai/insights` → (GSC KPI/키워드 수집) → (OpenAI로 인사이트 생성) → `frontend 렌더링`

추가로, API가 실패/미설정인 경우:
`frontend`가 **정적 Fallback(AI_INSIGHTS)** 를 계속 렌더링하지만, 배지는 `데이터 없음`으로 표시됩니다.

### 데이터 소스 (어디서 오나?)
- **백엔드 API + LLM 생성(주 경로)**
  - 프론트는 초기 로드 시 `GET /api/ai/insights`를 호출합니다. (`frontend/src/app/page.tsx:1329`)
  - 백엔드(`backend/src/server.ts:2027`)는 GSC 데이터를 수집한 뒤 `generateInsights()`로 OpenAI(Chat Completions) 호출하여 인사이트를 생성합니다.
  - 프롬프트/생성 로직은 `backend/src/ai.ts:27`의 `INSIGHTS_SYSTEM_PROMPT`에 있습니다.
- **프론트 정적 텍스트(보조/Fallback)**
  - API 응답이 없으면 `AI_INSIGHTS` 상수(하드코딩된 샘플 텍스트)가 카드에 표시됩니다. (`frontend/src/app/page.tsx:231`)

### 생성 방식
- **혼합(라이브=AI 기반 / 미연결=정적 샘플)**
  - Live: OpenAI가 `seoData` 기반으로 4개 인사이트 생성 (`backend/src/ai.ts:50`)
  - Fallback: `frontend/src/app/page.tsx:231`의 `AI_INSIGHTS` 배열 사용

### 우선순위 결정 로직(긴급/스케일/추세/스케줄?)
현재 코드 기준으로는 아래 4단계입니다:
- `urgent`, `opportunity`, `trend`, `recommend` (`backend/src/ai.ts:27`, `frontend/src/app/page.tsx:39`)
- **LLM이 문맥을 보고 priority를 판단**하지만, 프롬프트에서 “정확히 4개, 각각 다른 priority 사용”을 강제합니다.  
  → 즉, “우선순위가 몇 개 뽑히는지”는 규칙(항상 4개, 각 1개)이고, “어떤 내용이 urgent인지”는 AI 판단입니다.

참고: 요청서의 표현(긴급/스케일/추세/스케줄)과 코드의 priority 이름이 다릅니다.
- 요청서: 긴급/스케일/추세/스케줄
- 코드: urgent/opportunity/trend/recommend
  - 의미상으로는 `urgent=긴급`, `trend=추세`는 유사하지만 `opportunity`/`recommend`는 **스케일/스케줄과 1:1 대응이 명확하지 않습니다.**

### 업데이트 주기(언제 갱신?)
- **페이지 로드 시 1회 자동 호출**
  - `useEffect()`에서 `/api/ai/insights` 호출 (`frontend/src/app/page.tsx:1329`)
- **수동 갱신 버튼(다시 분석)**
  - “다시 분석” 버튼 클릭 시 재호출 (`frontend/src/app/page.tsx:2328`)
- 백엔드 쪽 스케줄러/배치 갱신은 없음(호출될 때마다 생성).
  - 단, GSC 조회 자체는 `backend/src/gsc.ts`에 1분 TTL 캐시가 있어 연속 호출 시 GSC 결과는 재사용될 수 있습니다. (`backend/src/gsc.ts:55`)

### 관련 파일
- 프론트:
  - `frontend/src/app/page.tsx` (타입/상태/호출/렌더링/정적 샘플 포함)
  - `frontend/src/app/page.module.css` (insightsPanel 스타일)
- 백엔드:
  - `backend/src/server.ts` (`GET /api/ai/insights`)
  - `backend/src/ai.ts` (OpenAI 호출 + `INSIGHTS_SYSTEM_PROMPT`)
  - `backend/src/gsc.ts` (GSC query 함수, 1분 캐시)
  - `backend/src/env.ts` (`OPENAI_API_KEY`, `OPENAI_MODEL` 등)

### 현재 인사이트 예시(코드에 하드코딩된 Fallback 기준)
`frontend/src/app/page.tsx:231` 기준:
1. [urgent] `"건강기능식품" 순위 5→12위 하락 — 즉각적인 콘텐츠 보강 필요`
2. [opportunity] `FAQ 스키마 추가 시 CTR 15% 향상 예상`
3. [trend] `모바일 검색 비율 68%, 전월대비 12% 증가`
4. [recommend] `"프로바이오틱스 효능" 콘텐츠 보강 필요`

### 개선 가능 포인트(의견)
- **priority 명명 불일치**: 기획서(스케일/스케줄) vs 코드(opportunity/recommend) 용어 정합 필요.
- **태그(icon) 매핑 취약**: 프론트는 `ins.tag` 문자열이 아이콘 map에 없으면 “콘텐츠” 아이콘으로 fallback됩니다. (`frontend/src/app/page.tsx:2347`)
- **캐시/비용 관리**: `/api/ai/insights`는 호출 시마다 OpenAI 비용 발생(현재 서버 단 캐시 없음).

---

## 조사 B: 키워드 인텐트 분석 구조

### 데이터 흐름
`GSC query(최근 28일)` → `backend: classifyKeywordIntents()` → `GET /api/keywords/intent` → `frontend bar chart + 예시 키워드 표시`

### 데이터 소스(어디서 오나?)
- 백엔드 API:
  - 프론트는 Tab0 로드 시 `GET /api/keywords/intent` 호출 (`frontend/src/app/page.tsx:1317`)
  - 백엔드는 GSC에서 query dimension으로 100개를 조회하고(`backend/src/server.ts:2146`),
    이를 `classifyKeywordIntents()`로 분류(`backend/src/intent.ts:132`) 후 반환합니다.
- 프론트 Fallback:
  - intentData가 없으면 `INTENT_CATEGORIES`(45/30/15/10) 샘플을 렌더링합니다. (`frontend/src/app/page.tsx:239`)

### 분류 기준(정확한 로직)
구현은 `backend/src/intent.ts`에 있으며 “규칙 기반 1차 + GPT 보완(선택)” 구조입니다.

- 브랜드(brand)
  - 단독 브랜드명 매칭: `바이오컴`, `biocom`, `biocom.kr` (정규식) (`backend/src/intent.ts:18`)
- 탐색성(navigational)
  - 브랜드 prefix + navigational suffix(홈페이지/로그인/고객센터/주소/전화번호 등) (`backend/src/intent.ts:27`)
  - 브랜드 prefix만 있어도 navigational로 분류(중간 신뢰도) (`backend/src/intent.ts:69`)
- 상업성(commercial)
  - 가격/비용/후기/리뷰/추천/비교/구매/할인/쿠폰/예약/상담 등 패턴 매칭 (`backend/src/intent.ts:33`)
  - 특이 규칙: `"검사"` 포함 키워드는 상업성(중간 신뢰도) (`backend/src/intent.ts:95`)
- 정보성(informational)
  - 효능/효과/증상/원인/방법/부작용/차이/정의/what/how/why 등 패턴 (`backend/src/intent.ts:47`)
- 기본값
  - 위 규칙에 걸리지 않으면 informational + low confidence (`backend/src/intent.ts:100`)

#### GPT 보완(선택)
- low confidence 항목만 GPT에 재분류 요청 (`backend/src/intent.ts:106`)
- OpenAI 설정이 있으면 JSON 매핑을 받아 일부를 업데이트(신뢰도 low → medium), method=`hybrid` (`backend/src/intent.ts:150`)
- OpenAI 미설정이면 순수 rule 기반으로 종료(method=`rule`)

### 대표 키워드 선정(각 인텐트별 예시)
- 프론트가 `intentData.keywords`에서 intent별로 필터 후 **앞에서 6개만 slice**하여 문자열로 출력합니다. (`frontend/src/app/page.tsx:2482`)
- 즉, “인텐트별 Top 키워드 정렬”을 따로 하는 게 아니라,
  - **GSC에서 내려온 순서(대개 상위 키워드)** 를 유지한 결과에서 intent별로 앞부분을 보여주는 방식입니다.

### 업데이트 주기 / 기간
- 백엔드 기간 고정:
  - endDate = 오늘 - 2일
  - startDate = endDate - 27일 (총 28일 범위) (`backend/src/server.ts:2150`)
- 프론트 갱신:
  - Tab0 로드시 1회 fetch (`frontend/src/app/page.tsx:1317`)
  - 별도 “새로고침” 버튼은 없음(페이지 리로드/재방문 시 재호출).
- 참고: GSC 호출은 1분 캐시가 있어 짧은 시간 내 중복 호출은 캐시될 수 있습니다. (`backend/src/gsc.ts:55`)

### 관련 파일
- 프론트:
  - `frontend/src/app/page.tsx` (IntentApiResponse 타입, fetch, 렌더)
  - `frontend/src/app/page.module.css` (intentPanel 스타일)
- 백엔드:
  - `backend/src/server.ts` (`GET /api/keywords/intent`)
  - `backend/src/intent.ts` (규칙 + GPT 보완 분류)
  - `backend/src/gsc.ts` (GSC query)
  - `backend/src/ai.ts` (isOpenAIConfigured 참조)

### Tab 2(키워드 분석)와의 관계
- **별개 API/별개 데이터 구조**입니다.
  - Tab0 인텐트 분석: `GET /api/keywords/intent` (28일, intent 분류 포함)
  - Tab2 키워드 테이블: `GET /api/gsc/keywords` (기본 7일(버퍼 포함) 또는 7/30일 프리셋/커스텀, isQA/opportunity 계산 포함) (`backend/src/server.ts:771`, `frontend/src/app/page.tsx:919`)
- 공통점: 둘 다 **GSC Search Analytics의 query dimension**을 기반으로 하지만,
  - 기간/rowLimit/가공 로직이 달라 같은 화면이라도 수치가 불일치할 수 있습니다.

### 개선 가능 포인트(의견)
- 현재 인텐트 비율은 “키워드 개수 기준(count)”입니다. 클릭/노출 가중치 기반이 필요하면 로직 변경이 필요합니다.
- intent API에도 “수동 갱신” UX(버튼) 추가 고려 가능(현재는 최초 로드 only).

---

## 조사 C: Tab 0 “AI 최적화 작업” 체크리스트 구조

### 1) 체크리스트 항목은 어디서 오나?
- **프론트 하드코딩 + 실데이터 기반 done 판정(규칙 기반)** 입니다.
  - 항목 리스트(총 9개)는 `frontend/src/app/page.tsx:1893`의 `aiOptimizationTasks`에서 생성합니다.
  - 백엔드에서 체크리스트를 내려주지 않습니다(별도 API 없음).

### 2) 체크 상태는 어디에 저장되나?
- **어디에도 저장하지 않습니다.** (localStorage/DB 없음)
- 매 렌더/데이터 변경 시마다 아래 실측 데이터 상태로 `done`을 **재계산**합니다.

### 3) 항목별 영향도(impact)/우선순위 정보가 있나?
- 별도 impact/priority 필드는 없습니다.
  - `done: boolean`
  - `detail?: string` (근거/가이드 텍스트)
  - UI는 코드에 정의된 순서대로 나열합니다.

### 4) 체크리스트가 참조하는 데이터(실데이터 소스)
`frontend/src/app/page.tsx:1893` 기준:
- AEO/GEO 스코어 결과(스키마/콘텐츠 구조)
  - `aeoScore`, `geoScore`의 breakdown/detail 텍스트를 regex로 파싱하여 done 판정
  - (원천 API) `GET /api/aeo/score`, `GET /api/geo/score` (`backend/src/server.ts` 내)
- 키워드 데이터
  - `keywordsData`가 있으면 “기회 키워드” 개수를 계산
  - (원천 API) `GET /api/gsc/keywords` (`backend/src/server.ts:771`)
- PageSpeed/CWV 측정 이력
  - `pageSpeedHistory.length > 0` 여부 + LCP/FCP 평균이 임계치 이내인지 여부로 done 판정
  - (원천 API) `GET /api/pagespeed/results` (`backend/src/server.ts:1117`)
- AI 인사이트 생성 여부
  - `aiInsights.length > 0` 여부로 done 판정
  - (원천 API) `GET /api/ai/insights` (`backend/src/server.ts:2027`)

### 5) 체크리스트 항목 목록(현재 코드 기준)
`frontend/src/app/page.tsx:1893`에서 생성되는 항목:
1. `schema_faq` — FAQ 스키마 마크업 추가 (schema detail에 `FAQPage ✅` 포함 시 done)
2. `schema_article` — Article 스키마 마크업 추가 (`Article ✅`)
3. `schema_author` — 저자(Person) 정보 구조화 (`저자 정보…✅`)
4. `schema_speakable` — Speakable 스키마 적용 (`Speakable ✅`)
5. `meta_description` — 메타 디스크립션 최적화 (content detail에 `메타 디스크립션 ✅`)
6. `opportunity_keywords` — 기회 키워드 개선 (impressions>500 & CTR<2% 기준, 해당 0개면 done)
7. `pagespeed_history` — PageSpeed 측정 리포트 누적 (historyCount>0면 done)
8. `cwv_lcp_fcp` — CWV 최적화(LCP/FCP) 또는 실측 실행 (평균 LCP<=2500ms & FCP<=1800ms면 done)
9. `ai_insights` — AI 인사이트 자동 생성/갱신 (aiInsights 존재 시 done)

### 관련 파일
- 프론트:
  - `frontend/src/app/page.tsx` (체크리스트 정의/계산/렌더)
  - `frontend/src/app/page.module.css` (taskPanel 스타일)
- 백엔드(참조되는 실데이터 API):
  - `backend/src/server.ts` (`/api/aeo/score`, `/api/geo/score`, `/api/gsc/keywords`, `/api/pagespeed/results`, `/api/ai/insights`)
  - 세부 계산 로직은 각각 `backend/src/scoring.ts`, `backend/src/crawl.ts`, `backend/src/pagespeed.ts` 등에서 수행(체크리스트는 결과만 소비)

---

## (선택) 확인이 필요해 보이는 질문/추가 정보 요청
- 기획서의 인사이트 우선순위(긴급/스케일/추세/스케줄) 용어를 **코드의 urgent/opportunity/trend/recommend로 그대로 둘지**, 아니면 UI/스키마를 기획서 용어로 맞출지 방향이 필요합니다.
- 키워드 인텐트 비율을 “키워드 개수”가 아니라 “노출/클릭 가중치”로 보고 싶다면, 원하는 기준(클릭 가중 vs 노출 가중)을 확인해야 합니다.

