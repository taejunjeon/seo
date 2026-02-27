# External API / Solution 연동 현황 (apisolution 1.0)

- 작성일: 2026-02-26
- 기준: 이 저장소(`frontend/`, `backend/`) 코드 + 문서(`objective1.0.md`, `newfunc*.md`, `phase1.2.md`)에 근거
- 정의:
  - **현재 연동(구현됨)**: 코드에서 실제 외부 호출이 존재하며, 관련 환경변수를 설정하면 동작 가능한 상태
  - **연동 계획(미구현/옵션)**: 문서에 필요/대안으로 언급되었으나 코드/환경변수/엔드포인트가 아직 없는 상태

---

## 1) 현재 연동된 외부 API (구현됨)

### 1.1 Google Search Console API (GSC)

- 목적: 검색 성과(클릭/노출/CTR/평균순위)를 페이지/키워드 관점으로 조회하고 KPI/트렌드/칼럼 분석에 활용
- 구현 파일:
  - `backend/src/gsc.ts` (GSC client/auth + searchanalytics.query)
  - `backend/src/server.ts` (API 라우팅)
- 백엔드 엔드포인트:
  - `GET /api/gsc/sites`
  - `POST /api/gsc/query`
  - `GET /api/gsc/kpi`
  - `GET /api/gsc/trends`
  - `GET /api/gsc/keywords`
  - `GET /api/gsc/columns`
  - `POST /api/cron/gsc/daily` (Supabase upsert; `CRON_SECRET` 가드)
- 인증/설정(env): `backend/src/env.ts`
  - `GSC_SERVICE_ACCOUNT_KEY` (권장: 1줄 JSON) 또는 `GOOGLE_APPLICATION_CREDENTIALS`(키 파일 경로)
  - `GSC_SITE_URL` (기본 `sc-domain:biocom.kr`)
- 운영 메모:
  - 중복 호출 감소용 in-memory 캐시(TTL 60초) 및 in-flight dedupe가 구현되어 있음(`backend/src/gsc.ts`).
  - GSC 데이터는 통상 2~3일 지연될 수 있어(문서 기준), Cron 적재/표기 정책이 필요함(`newfunc1.2.md`).

### 1.2 Google Analytics Data API (GA4)

- 목적: 검색 이후 사용자 행동(참여/이탈/전환)과 “AI referral 유입(휴리스틱)”을 조회하여 사용자 행동 탭/점수 산출에 활용
- 구현 파일:
  - `backend/src/ga4.ts` (GA4 Data API 리포트)
  - `backend/src/dateRange.ts` (기간 파싱/검증)
  - `backend/src/server.ts` (API 라우팅 + fallback 메타)
- 백엔드 엔드포인트:
  - `GET /api/ga4/engagement`
  - `GET /api/ga4/funnel`
  - `GET /api/ga4/top-sources` (응답에 `_meta` 포함)
  - `GET /api/ga4/ai-traffic` (응답에 `_meta` 포함)
  - `GET /api/ga4/ai-traffic/user-type` (응답에 `_meta` 포함)
  - `GET /api/ai-traffic/topics` (GA4 + GSC 결합 리포트)
- 인증/설정(env): `backend/src/env.ts`
  - `GA4_PROPERTY_ID`
  - `GA4_SERVICE_ACCOUNT_KEY` (1줄 JSON; 미설정 시 GA4 조회는 에러로 처리되고 API는 fallback 응답을 반환하도록 설계됨)
- 운영 메모:
  - GA4 응답에는 `_meta.type = live|fallback`이 포함되어, 실데이터/대체값을 UI에서 명확히 구분 가능(`backend/src/server.ts`).
  - “AI 유입”은 GA4의 공식 차원이 아니라, `sessionSource`(referrer) allowlist(FULL_REGEXP) + `utm_source=chatgpt...` 보충 규칙을 조합한 휴리스틱임(`backend/src/ga4.ts`).
  - 쿼터 보호를 위해 in-memory 캐시(TTL 30분) 및 in-flight dedupe가 구현됨(`backend/src/ga4.ts`).

### 1.3 Google PageSpeed Insights API (PSI)

- 목적: URL별 PageSpeed 점수(Performance/SEO/Accessibility) + CWV(LCP/FCP/CLS/INP/TTFB) 측정
- 구현 파일:
  - `backend/src/pagespeed.ts`
  - `backend/src/server.ts`
- 백엔드 엔드포인트:
  - `POST /api/pagespeed/run`
  - `GET /api/pagespeed/results` (in-memory 캐시 조회)
  - `POST /api/pagespeed/batch`
- 인증/설정(env): `backend/src/env.ts`
  - `PAGESPEED_API_KEY`
- 운영 메모:
  - 현재 기본은 in-memory 캐시이며, 장기 히스토리/추이는 Supabase 적재로 확장하는 로드맵이 문서에 존재함(`objective1.0.md`, `newfunc1.2.md`).

### 1.4 OpenAI API (LLM)

- 목적:
  - 인사이트 카드 생성(SEO 데이터 → 실행 제안)
  - SEO/AEO/GEO 챗봇 응답
  - “ChatGPT Search” 스타일 웹 검색 결과의 출처 URL 수집(Responses API + `web_search_preview`)
  - 키워드 intent 분류 보완(규칙 기반 + GPT hybrid 옵션)
- 구현 파일:
  - `backend/src/ai.ts` (chat.completions 기반: insights/chat)
  - `backend/src/intent.ts` (chat.completions 기반: intent hybrid 분류)
  - `backend/src/openaiSearch.ts` (responses + `web_search_preview`: URL citation 추출)
  - `backend/src/aiCitationMulti.ts` (provider `chatgpt_search`)
- 백엔드 엔드포인트:
  - `GET /api/ai/insights`
  - `POST /api/ai/chat`
  - `GET /api/keywords/intent` (GSC 키워드 + 규칙분류, 필요 시 GPT 보완)
  - `GET /api/ai/citation` (provider 중 `chatgpt_search`)
- 인증/설정(env): `backend/src/env.ts`
  - `OPENAI_API_KEY`
  - `OPENAI_MODEL` (기본 `gpt-5-mini`)
  - `OPENAI_SEARCH_MODEL` (기본 `gpt-4o-mini`)
- 운영 메모:
  - 비용/로그/PII 정책은 운영 단계에서 확정이 필요하다고 문서에 명시됨(`objective1.0.md`, `newfunc1.2.md`).

### 1.5 SerpAPI (Google SERP / AI Overview)

- 목적:
  - Google 검색 결과에서 AI Overview 노출 여부/참고 링크(references)를 추출하여 “AI Overview 노출/인용”을 측정
  - SerpAPI 계정 상태(플랜/이번달 사용량/잔여 검색) 확인
- 구현 파일:
  - `backend/src/serpapi.ts` (account, search.json)
  - `backend/src/aiCitation.ts` (SerpAPI 기반 AI Overview 인용 측정)
  - `backend/src/aiCitationMulti.ts` (provider `google_ai_overview`)
  - `backend/src/server.ts`
- 백엔드 엔드포인트:
  - `GET /api/serpapi/account`
  - `GET /api/ai/citation` (provider 중 `google_ai_overview`)
- 인증/설정(env): `backend/src/env.ts`
  - `SERP_API_KEY`
- 운영 메모:
  - SerpAPI 비용/쿼터를 고려해 표본 수 제한 + 제한 동시성 + 캐시(TTL 6시간)가 적용되어 있음(`backend/src/aiCitation.ts`).

### 1.6 Perplexity API (Citations)

- 목적: Perplexity 응답의 citations/search_results를 파싱하여 “출처 인용 여부”를 측정(AEO 점수 구성 요소)
- 구현 파일:
  - `backend/src/perplexity.ts`
  - `backend/src/aiCitationMulti.ts` (provider `perplexity`)
  - `backend/src/server.ts`
- 백엔드 엔드포인트:
  - `GET /api/ai/citation` (provider 중 `perplexity`)
- 인증/설정(env): `backend/src/env.ts`
  - `PERPLEXITY_API_KEY`
  - `PERPLEXITY_MODEL` (기본 `sonar-pro`)

---

## 2) 현재 연동된 “솔루션/서비스” (API가 아니거나 인프라 성격)

### 2.1 Supabase (DB/BaaS)

- 목적: 히스토리/추이 분석을 위한 데이터 저장(운영형 적재 파이프라인의 핵심)
- 구현 파일:
  - `backend/src/supabase.ts` (service role 기반 admin client)
  - `backend/supabase/schema.sql` (스키마)
  - `backend/src/server.ts` (GSC Cron upsert, PageSpeed insert 등)
- 설정(env): `backend/src/env.ts`
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
- 현재 상태:
  - 키가 있으면 insert/upsert가 동작하는 수준까지 구현되어 있으나,
  - “운영형 DB 구축 + 크론 자동 적재”는 로드맵 단계로 문서에 정리됨(`objective1.0.md` R1/R2, `newfunc1.2.md`).

### 2.2 웹 크롤링(HTTP fetch + Cheerio)

- 목적: 대상 URL의 Schema(JSON-LD/microdata) 및 콘텐츠 구조(H2/H3/표/리스트/인용/alt 등)를 진단
- 구현 파일:
  - `backend/src/crawl.ts`
  - `backend/src/server.ts`
- 백엔드 엔드포인트:
  - `POST /api/crawl/analyze`
  - `POST /api/crawl/subpages`
- 특징:
  - 외부 “API”가 아니라, 사용자 입력 URL에 대해 직접 HTTP 요청하는 크롤러 방식
  - 운영 시 SSRF/timeout/대상 도메인 제한/robots 정책 등 보안·정책 확정이 필요함(현재는 15초 timeout, User-Agent 지정)

### 2.3 진단 히스토리(로컬 파일 저장)

- 목적: 페이지 진단 결과를 간단히 누적(프로토타입)하여 프론트에서 조회
- 구현 파일:
  - `backend/src/server.ts` (저장 위치: `data/diagnosis-history.json`)
- 백엔드 엔드포인트:
  - `GET /api/diagnosis/history`
  - `POST /api/diagnosis/save`
  - `DELETE /api/diagnosis/history/:id`
- 로드맵:
  - 배포/다중 사용자 전환 시 Supabase 등 DB로 이전 필요(`objective1.0.md`).

### 2.4 대시보드 캡처(Playwright) + 프론트 캡처(html2canvas)

- 목적: 공유/리포팅 자동화(스크린샷 기반)
- 구현 파일:
  - Playwright(백엔드 스크립트): `backend/scripts/capture-dashboard.ts`
  - html2canvas(프론트): `frontend/src/app/page.tsx`
- 비고:
  - 외부 API는 아니지만, “알림/리포트 전송(Slack 등)”과 결합될 여지가 큰 구성 요소임(현재 전송 연동은 없음).

### 2.5 MCP(Model Context Protocol)

- 현 상태:
  - 이 저장소에서 MCP 연동 코드/서브프로젝트는 발견되지 않음(`AGENTS.md`에 예시로만 언급).
- 의미:
  - MCP로 어떤 도구를 붙이려면, 별도 `mcp-servers/` 같은 하위 프로젝트 추가가 필요.

---

## 3) 앞으로 연동 계획(문서 기준: 미구현/옵션)

> 아래는 “현재 코드에 없음”을 전제로, 문서에서 계획/대안/운영 항목으로 언급된 것들을 정리한 목록입니다.

### 3.1 DataForSEO SERP API (SerpAPI 대안/보완)

- 목적: AI Overview 요소/인용 URL 수집을 SerpAPI 외에 DataForSEO로도 커버(커버리지/비용/안정성 선택지 확보)
- 근거 문서: `newfunc1.3.md`, `newfunc1.4.md`, `newfunc1.5.md`
- 현재 상태: 미연동
- 예상 연동 방식:
  - 신규 커넥터 모듈 추가(예: `backend/src/dataforseo.ts`)
  - `/api/ai/citation` provider 확장 또는 AEO/GEO 점수 파이프라인에 편입

### 3.2 스케줄러/크론(수집 자동화)

- 목적: 매일/매주 GSC/GA4/PSI 데이터를 자동 적재하여 “누적/비교 자동화(O1)” 완성
- 근거 문서: `objective1.0.md`(R2), `newfunc1.2.md`, `phase1.2.md`
- 후보 솔루션:
  - Vercel Cron Jobs
  - Supabase Edge Function + `pg_cron`
  - 단일 서버 환경의 `node-cron`
- 현재 상태:
  - `POST /api/cron/gsc/daily`는 존재(외부 스케줄러에서 호출 가능)
  - `/api/cron/pagespeed/weekly`, `/api/cron/ga4/daily` 등은 문서상 계획 단계

### 3.3 알림/운영 루프(Slack/Email) + 에러 모니터링(Sentry 등)

- 목적: 급락/악화 감지(순위/CTR/CWV 등) → Slack/이메일 알림 + 담당자 액션 로그(O5)
- 근거 문서: `objective1.0.md`(R5/R6)
- 현재 상태: 미연동(코드 없음)
- 예상 연동 후보(예시):
  - Slack Incoming Webhook 또는 Slack API
  - 이메일 발송 서비스(Resend/SendGrid/SES 등)
  - 에러 모니터링(Sentry 등)

### 3.4 GTM/GA4 커스텀 이벤트(전환/기여도 측정 고도화)

- 목적: “칼럼 → 제품/검사” CTA 클릭 및 key event를 GA4로 정교하게 측정하여 퍼널/기여도 분석을 완성
- 근거 문서: `newfunc1.2.md`, `newfunc2.0.md`, `newfunc2.1.md`
- 현재 상태:
  - 대시보드 코드가 아니라, `biocom.kr` 사이트 또는 GTM/태그 설정(외부 운영 영역) 작업이 필요

### 3.5 상용 AEO/GEO 모니터링 플랫폼(선택)

- 목적: AI 인용/노출을 더 정교하게/대규모로 추적(직접 구현 부담을 줄이는 대안)
- 근거 문서: `newfunc1.3.md` (Profound/Otterly 언급)
- 현재 상태: 미연동(아이디어/옵션)

---

## 4) 빠른 점검(운영 체크)

- 연동 상태 확인: `GET /health`
  - 주의: 현재 `/health`의 `gsc`는 `GSC_SERVICE_ACCOUNT_KEY` 존재 여부만 체크하므로, `GOOGLE_APPLICATION_CREDENTIALS`만 사용하는 경우 `false`로 표시될 수 있음(`backend/src/server.ts`).
- 환경변수/키 목록: `backend/src/env.ts`, `backend/.env.example`
- 비용/쿼터 주의 호출:
  - `GET /api/ai/citation` (SerpAPI/OpenAI/Perplexity 호출 → 비용/레이턴시 발생)
  - PageSpeed batch(대량 URL)
- GA4 실데이터 여부:
  - GA4 관련 응답의 `_meta.type` 확인(`live` / `fallback`)

