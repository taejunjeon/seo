# feedback0226codex2.0 작업 결과 (Backend)

- 작업일: 2026-02-26
- 기준: repo `/Users/vibetj/coding/seo` (git HEAD: `e3d831a`)
- 범위: `backend/src/` 중심 (요청 B0~B6)
- 상태: B0~B6 구현 완료, 백엔드 타입체크/테스트 통과

---

# B0 사전 확인 리포트 (현 repo 기준)

## 1. 기술 스택 (package.json)

### Backend (`backend/package.json`)
- 런타임 의존성
  - Express `^5.2.1`
  - Zod `^4.3.6`
  - Google APIs (GSC) `googleapis ^171.4.0`
  - GA4 Data API `@google-analytics/data ^5.2.1`
  - OpenAI SDK `openai ^6.21.0`
  - Supabase `@supabase/supabase-js ^2.56.0`
  - 기타: `dotenv`, `cors`, `cheerio`
- Dev 의존성/툴링
  - TypeScript `5.9.3`
  - `tsx`(dev runner) `^4.21.0`
  - Playwright `^1.50.0` (백엔드에 설치되어 있으나 E2E로 사용 여부는 별도 확인 필요)

### Frontend (`frontend/package.json`)
- Next.js `16.1.6`
- React/ReactDOM `19.2.3`
- TypeScript `^5`
- ESLint `^9` + `eslint-config-next 16.1.6`
- Tailwind CSS: 설치 흔적 없음(의존성 없음)
- shadcn/ui: 설치 흔적 없음
- Recharts: 설치 흔적 없음

## 2. 캐시 구조 (in-memory)

### GSC 캐시
- `backend/src/gsc.ts:80`
  - 구조: `Map(cacheKey -> {measuredAtMs, value})` + `inflight Map`
  - TTL: `QUERY_CACHE_TTL_MS = 60_000` (60초)
  - 키: `siteUrl|startDate|endDate|dimensions|rowLimit|startRow|type|aggregationType|filters` (`backend/src/gsc.ts:93`)
  - 무효화: TTL 경과 또는 프로세스 재시작 (forceRefresh 파라미터는 이 레벨에는 없음)

### GA4 캐시
- `backend/src/ga4.ts:551` (AI traffic detailed)
  - TTL: `GA4_AI_TRAFFIC_CACHE_TTL_MS = 30m`
  - 구조: `ga4AiTrafficCache(Map)` + `ga4AiTrafficInflight(Map)` (`backend/src/ga4.ts:552-553`)
  - 키: `startDate|endDate|limit|referralOnly|patterns` (`backend/src/ga4.ts:682`)
  - 무효화: `forceRefresh` 또는 TTL 경과
- `backend/src/ga4.ts:555` (top sources)
  - TTL: `GA4_TOP_SOURCES_CACHE_TTL_MS = 30m`
  - 구조: `ga4TopSourcesCache(Map)` + `ga4TopSourcesInflight(Map)` (`backend/src/ga4.ts:556-557`)
  - 키: `startDate|endDate|limit` (`backend/src/ga4.ts:926`)
  - 무효화: `forceRefresh` 또는 TTL 경과

### AI citation 캐시
- `backend/src/aiCitation.ts:32`
  - TTL: 6h
  - 구조: 단일 `cached` 객체 + `inflight Map` (`backend/src/aiCitation.ts:33-41`)
  - 무효화: `forceRefresh` 또는 TTL 경과
- `backend/src/aiCitationMulti.ts:66` (멀티 프로바이더)  
  - TTL: 6h (구조/무효화 패턴은 단일 버전과 유사)

### URL canonical/redirect 캐시 (broad match 보조)
- `backend/src/urlMatch.ts:19`
  - TTL: 6h
  - 구조: `cache Map` + `inflight Map`
  - 목적: 인용 링크 host 매칭에서 final/canonical URL 확인 비용 절감

### Page title 캐시
- `backend/src/pageTitle.ts:6`
  - TTL: 7일 (`TITLE_CACHE_TTL_MS`)
  - 실패 재시도 TTL: 1시간 (`TITLE_RETRY_TTL_MS`)
  - 구조: `Map(url -> {title, expiresAtMs})`

### PageSpeed 결과 캐시
- `backend/src/pagespeed.ts:83`
  - 구조: `Map(strategy:url -> result)`
  - TTL: 없음(프로세스 생명주기 동안 유지)

### Server 레벨 캐시 (API 응답 캐시)
- `backend/src/server.ts:167`
  - `/api/ai-traffic/topics` 캐시
  - TTL: 1h (`AI_TRAFFIC_TOPICS_CACHE_TTL_MS`)
  - 구조: `aiTrafficTopicsCache(Map)` + `aiTrafficTopicsInflight(Map)`
- `backend/src/server.ts:178`
  - `/api/ai/insights` 캐시
  - TTL: 6h (`AI_INSIGHTS_CACHE_TTL_MS`)
  - 구조: `aiInsightsCache(Map)` + `aiInsightsInflight(Map)`
  - 수동 무효화: `POST /api/ai/insights/refresh` (`backend/src/server.ts:2719`)
- `backend/src/server.ts:273`
  - `/api/trends` 캐시
  - TTL: 5m
  - 구조: `trendsCache(Map)` + `trendsInflight(Map)`
- `backend/src/server.ts:312`
  - `/api/comparison` 캐시
  - TTL: 5m
  - 구조: `comparisonCache(Map)` + `comparisonInflight(Map)`

## 3. 엔드포인트 전체 목록 (server.ts)

아래는 `backend/src/server.ts` 기준(라인은 `rg` 기준, 상세는 코드 참조):

- `GET /health` (`backend/src/server.ts:372`)
- SerpAPI
  - `GET /api/serpapi/account` (`backend/src/server.ts:390`) → `fetchSerpApiAccount()`
- AI citation
  - `GET /api/ai/citation` (`backend/src/server.ts:411`) → `measureAiCitationMulti()`, `measureAiCitation()`
- GSC
  - `GET /api/gsc/sites` (`backend/src/server.ts:645`) → `listGscSites()`
  - `POST /api/gsc/query` (`backend/src/server.ts:655`) → `queryGscSearchAnalytics()`
  - `POST /api/cron/gsc/daily` (`backend/src/server.ts:684`) → Supabase `gsc_daily_metrics` 적재
  - `GET /api/gsc/trends` (`backend/src/server.ts:802`) → GSC date dim 기반
  - `GET /api/gsc/kpi` (`backend/src/server.ts:836`) → GSC KPI 요약
  - `GET /api/gsc/keywords` (`backend/src/server.ts:1324`)
  - `GET /api/gsc/columns` (`backend/src/server.ts:1411`)
- Phase 3 성격(이번 작업 포함)
  - `GET /api/trends` (`backend/src/server.ts:917`) → (신규) Trend API
  - `GET /api/comparison` (`backend/src/server.ts:1150`) → (신규) Comparison API
- PageSpeed
  - `POST /api/pagespeed/run` (`backend/src/server.ts:1639`) → `runPageSpeedTest()`
  - `GET /api/pagespeed/results` (`backend/src/server.ts:1670`)
  - `POST /api/pagespeed/batch` (`backend/src/server.ts:1715`)
- GA4
  - `GET /api/ga4/engagement` (`backend/src/server.ts:1758`) → `queryGA4Engagement()`
  - `GET /api/ga4/funnel` (`backend/src/server.ts:1772`) → `queryGA4Funnel()` + (신규) `queryGA4EcommerceFunnel()`
  - `GET /api/ga4/ai-traffic` (`backend/src/server.ts:1867`) → `queryGA4AiTrafficDetailed()`
  - `GET /api/ga4/ai-traffic/user-type` (`backend/src/server.ts:1940`) → `queryGA4AiTrafficUserType()`
  - `GET /api/ga4/top-sources` (`backend/src/server.ts:2026`) → `queryGA4TopSources()`
- AI traffic topics
  - `GET /api/ai-traffic/topics` (`backend/src/server.ts:2060`)
- Dashboard
  - `GET /api/dashboard/overview` (`backend/src/server.ts:2189`)
- Crawl/Diagnosis
  - `POST /api/crawl/analyze` (`backend/src/server.ts:2300`)
  - `POST /api/crawl/subpages` (`backend/src/server.ts:2316`)
  - `GET /api/diagnosis/history` (`backend/src/server.ts:2368`)
  - `POST /api/diagnosis/save` (`backend/src/server.ts:2378`)
  - `DELETE /api/diagnosis/history/:id` (`backend/src/server.ts:2406`)
- AEO/GEO Score
  - `GET /api/aeo/score` (`backend/src/server.ts:2418`)
  - `GET /api/geo/score` (`backend/src/server.ts:2518`)
- AI (OpenAI)
  - `GET /api/ai/insights` (`backend/src/server.ts:2650`) + 캐시 메타
  - `POST /api/ai/insights/refresh` (`backend/src/server.ts:2719`)
  - `POST /api/ai/chat` (`backend/src/server.ts:2791`)
- Keyword Intent
  - `GET /api/keywords/intent` (`backend/src/server.ts:2822`) → `classifyKeywordIntents({weight})`

## 4. AI referrer / UTM 현재 구현

### allowlist 위치/방식
- 설정 파일(외부화): `backend/src/config/ai-referrers.ts:8`
  - `AI_REFERRERS`: `{domain,label}` 목록
  - `AI_REFERRAL_SOURCE_PATTERNS_ALLOWLIST`: FULL_REGEXP용 suffix 패턴 목록(`(^|.*\\.)domain$`)
  - `matchAiReferrer()`: label 매칭용
- 적용 코드: `backend/src/ga4.ts:656` (`categorizeTrafficSource()` + allowlist 패턴)
- 매칭 방식: **domain suffix + subdomain 허용** (오탐 방지)

### UTM(보충) 규칙
- `backend/src/ga4.ts:584`의 `CHATGPT_UTM_SOURCE_PATTERNS` 기반
  - `sessionManualSource`가 chatgpt 계열로 잡히는 케이스를 보충(supplement)로 합산
  - 단, `NOT(sessionSource allowlist)` 조건으로 중복 합산 방지 (`backend/src/ga4.ts:711-728`)

## 5. GA4 퍼널 구현

### 기존 범용 퍼널(하위호환 유지)
- 구현: `backend/src/ga4.ts:140`의 `queryGA4Funnel()`
- 단계: Organic Search sessions → pageviews → engagedSessions → conversions
- 방식: `runReport`만 사용 (runFunnelReport 사용 안 함)
- API: `GET /api/ga4/funnel` (기본값/`type=all`) (`backend/src/server.ts:1772-1789`)

### 신규(검사/영양제) 퍼널
- config: `backend/src/config/funnel-config.ts:29`
- 구현: `backend/src/ga4.ts:265`의 `queryGA4EcommerceFunnel()`
  - eventName별 `sessions`를 단계 값으로 사용
  - type별 filter는 config의 `fieldName/matchType/values`로 적용
- API: `GET /api/ga4/funnel?type=test|supplement` (`backend/src/server.ts:1772`)
- 기간: `period=7d|30d|custom` + custom은 `startDate/endDate(YYYY-MM-DD)` 필수

## 6. Cron 작업
- 엔드포인트: `POST /api/cron/gsc/daily` (`backend/src/server.ts:684`)
  - `requireCronSecret` 미들웨어로 보호 (`backend/src/server.ts:330`)
  - Supabase 테이블 `gsc_daily_metrics`에 적재
- Vercel Cron 설정 파일: `vercel.json` 없음(레포 루트 기준)

## 7. 키워드 인텐트 현재 구현
- 파일: `backend/src/intent.ts` 존재
- 방식: 규칙 기반 1차 + (선택) OpenAI로 low confidence만 보완(hybrid) (`backend/src/intent.ts:1-214`)
- 비율 계산: 기본 클릭 가중치(클릭=0이면 노출 fallback, 둘 다 0이면 count) (`backend/src/intent.ts:223-252`)
- API 응답: `categories[]`, `weightedBy`, `totalClicks/Impressions`, `keywords[]`, `method` 등 포함
- API: `GET /api/keywords/intent?weight=clicks|impressions|count` (`backend/src/server.ts:2822`)

## 8. B1-B6 프롬프트 영향 요약
- B1 영향: server.ts에 이미 Map+inflight 기반 캐시 패턴이 있어 동일 패턴으로 AI insights 캐시 확장 가능
- B2 영향: `intent.ts`가 존재했고 비율이 “count 기반”이어서 가중치 옵션 확장이 유효
- B3 영향: 기존 `/api/gsc/trends`는 있었지만 “비교(current vs previous/yoy)” 및 표준화된 응답이 없어 신규 `/api/trends`로 분리 구현
- B4 영향: page/query별 비교 API가 없어서 신규 `/api/comparison` 구현
- B5 영향: 기존 `/api/ga4/funnel`이 범용 퍼널만 제공 → type 파라미터로 확장(하위호환 유지)
- B6 영향: GA4 allowlist가 코드 하드코딩 형태였고 label 매핑이 없어서 config 외부화 + top-sources 응답 확장 필요

---

# B1~B6 구현 내용 (변경 사항)

## B1: AI Insights 캐싱 체계화 (P0)
- 변경: `backend/src/server.ts:167-242`(캐시 구조) + `backend/src/server.ts:2649-2779`(엔드포인트)
- TTL: 6시간 (`AI_INSIGHTS_CACHE_TTL_MS`, `backend/src/server.ts:178`)
- 키: `ai_insights|<GSC_SITE>|<start>|<end>|<OPENAI_MODEL>` (`backend/src/server.ts:182-183`)
- 응답 메타: `_meta.source = live|cache`, `generatedAt`, `expiresAt`, `ttl` (`backend/src/server.ts:2669-2679`)
- 수동 갱신: `POST /api/ai/insights/refresh` (`backend/src/server.ts:2719`)

## B2: 키워드 인텐트 가중치 개선 (P1)
- 변경: `backend/src/intent.ts`
  - `IntentWeight` 도입 (`backend/src/intent.ts:15`)
  - 클릭 가중치 기본, 클릭 합 0이면 노출 fallback, 둘 다 0이면 count (`backend/src/intent.ts:223-252`)
  - 응답 확장: `weightedBy`, `totalClicks`, `totalImpressions`, 카테고리별 `topKeywords` 등
- API 확장: `GET /api/keywords/intent?weight=clicks|impressions|count` (`backend/src/server.ts:2822`)

## B3: Trend API 개발 (P2)
- 신규: `GET /api/trends` (`backend/src/server.ts:917`)
- 특징
  - metric/period/compare 지원(검증 포함)
  - current/previous(또는 yoy) **병렬 조회**
  - 데이터 없는 날짜는 0으로 채움
  - position은 “낮아질수록 개선” 방향 보정
  - 캐시 TTL 5분 (`backend/src/server.ts:273`)
- 응답 메타: `_meta {source, ttl, queriedAt}`

## B4: Comparison API 개발 (P2)
- 신규: `GET /api/comparison` (`backend/src/server.ts:1150`)
- 특징
  - dimension(page|query) + period + sortBy + limit
  - current/previous 2기간 병렬 조회 → union key 구성
  - position 방향 보정(감소 = up)
  - 캐시 TTL 5분 (`backend/src/server.ts:312`)
- 응답 메타: `_meta {source, ttl, queriedAt}`

## B5: GA4 Funnel 고도화 - 검사/영양제 분리 (P2)
- 신규 config: `backend/src/config/funnel-config.ts:29`
- 신규 쿼리: `backend/src/ga4.ts:265` `queryGA4EcommerceFunnel()`
  - `dimensions: eventName`, `metrics: sessions`, `dimensionFilter: (eventName in steps) AND (type filter)`
  - runFunnelReport 미사용, runReport만 사용
- API 확장: `backend/src/server.ts:1772`
  - `GET /api/ga4/funnel` (기존 동일)
  - `GET /api/ga4/funnel?type=test|supplement&period=7d|30d|custom`
  - custom은 `startDate/endDate(YYYY-MM-DD)` 검증(`resolveIsoDateRange`)

## B6: AI 유입 트래픽 allowlist 확장 및 정밀화 (P2)
- allowlist 외부화: `backend/src/config/ai-referrers.ts:8`
- 적용: `backend/src/ga4.ts:656` (`categorizeTrafficSource()`)
- top-sources 응답 확장: `backend/src/ga4.ts:531-537`, `backend/src/ga4.ts:947+`
  - `matched: boolean`, `label: string|null` 추가
- server fallback debug의 패턴 목록도 config 기반으로 통일: `backend/src/server.ts:1875`
- 오탐 방지 테스트 강화:
  - `backend/tests/ga4-traffic-category.test.ts`에 `notchatgpt.com`, `mygeminigame.com` 케이스 추가

---

# 검증 결과

아래 명령 기준으로 통과했습니다.

```bash
cd backend
npm run typecheck
node --test --import tsx tests/*.test.ts
```

---

# 추가 확인이 필요한 정보 (있으면)

- GA4 ecommerce dimension 필터가 환경마다 다를 수 있습니다.
  - 현재 기본 config는 `itemCategory CONTAINS ["검사","test"]`, `["영양제","supplement"]`로 설정되어 있습니다 (`backend/src/config/funnel-config.ts:37-56`).
  - 실제 GA4에서 분리 기준이 `pagePath`, `itemName`, custom dimension 등이라면 config의 `fieldName/matchType/values`를 조정해야 퍼널 값이 0이 아닌 “정확한 분리”로 나옵니다.

