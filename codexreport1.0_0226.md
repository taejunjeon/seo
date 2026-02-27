# Codex Report 1.0 (2026-02-26) - server.ts 라우터 분리

TJ님 요청(next1.0.md Sprint 1.2)대로 백엔드 `backend/src/server.ts`(모놀리식)을 Express Router 모듈로 분리했습니다.

## 1) 결과 요약
- `backend/src/server.ts`: **2,900줄 -> 118줄**
  - 앱 부트스트랩(CORS/JSON), `/health`, 라우터 마운트, 404, 공통 에러 핸들러, CWV 자동측정만 유지
- 신규/추가된 구조
  - `backend/src/routes/` 하위로 도메인별 라우터 분리
  - `backend/src/utils/` 공용 유틸 분리
  - `backend/src/middleware/` 공통 에러 처리 추가
- 백업
  - `backend/src/server.ts.bak.20260226.router_split_pre`

## 2) 생성/변경된 파일 목록
- 라우터
  - `backend/src/routes/gsc.ts`
  - `backend/src/routes/ga4.ts`
  - `backend/src/routes/pagespeed.ts`
  - `backend/src/routes/ai.ts`
  - `backend/src/routes/diagnosis.ts`
  - `backend/src/routes/crawl.ts`
- 미들웨어
  - `backend/src/middleware/errorHandler.ts`
- 유틸
  - `backend/src/utils/dateUtils.ts` (daysAgo/toDateString)
  - `backend/src/utils/ga4Meta.ts` (GA4 _meta 생성/credential error 판별)
- 서버 엔트리
  - `backend/src/server.ts` (대폭 슬림화)

## 3) 라우터별 엔드포인트 매핑
> 라우터 내부에서 기존 **절대 경로(/api/...)** 를 그대로 유지하고, `server.ts`에서 `app.use(router)`로 루트에 마운트하는 방식으로 URL 변경을 방지했습니다.

### `backend/src/routes/gsc.ts`
- GET `/api/gsc/sites`
- POST `/api/gsc/query`
- POST `/api/cron/gsc/daily` (CRON_SECRET 보호)
- GET `/api/gsc/trends`
- GET `/api/gsc/kpi`
- GET `/api/trends`
- GET `/api/comparison`
- GET `/api/gsc/keywords`
- GET `/api/gsc/columns`

### `backend/src/routes/ga4.ts`
- GET `/api/ga4/engagement`
- GET `/api/ga4/funnel`
- GET `/api/ga4/ai-traffic`
- GET `/api/ga4/ai-traffic/user-type`
- GET `/api/ga4/top-sources`
- GET `/api/ai-traffic/topics`

### `backend/src/routes/pagespeed.ts`
- POST `/api/pagespeed/run`
- GET `/api/pagespeed/results`
- POST `/api/pagespeed/batch`
- (export) `persistPageSpeedResult()`
  - 서버 부팅 후 CWV 자동측정에서도 동일 로직으로 DB 저장 시도

### `backend/src/routes/ai.ts`
- GET `/api/serpapi/account`
- GET `/api/ai/citation`
- GET `/api/ai/insights`
- POST `/api/ai/insights/refresh`
- POST `/api/ai/chat`
- GET `/api/keywords/intent`

### `backend/src/routes/diagnosis.ts`
- GET `/api/dashboard/overview`
- GET `/api/diagnosis/history`
- POST `/api/diagnosis/save`
- DELETE `/api/diagnosis/history/:id`
- GET `/api/aeo/score`
- GET `/api/geo/score`

### `backend/src/routes/crawl.ts`
- POST `/api/crawl/analyze`
- POST `/api/crawl/subpages`
- (export) `getCrawlData()`
  - diagnosis(AEO/GEO 점수)에서 crawl 결과를 재사용(캐시/중복요청 방지)

## 4) server.ts 동작/구조 변경점
- `backend/src/server.ts`는 아래만 담당하도록 축소
  - 공통 미들웨어: CORS/JSON
  - `/health`
  - 라우터 마운트(`createGscRouter()` 등)
  - 404 + 공통 에러 처리(`errorHandler`)
  - CWV 자동측정(기존 로직 유지)

## 5) 검증(로컬)
- 타입체크
  - `cd backend && npm run typecheck` (pass)
- 테스트
  - `cd backend && node --test --import tsx tests/*.test.ts` (pass: 4 tests)

## 6) 메모 / 다음 정리 후보(옵션)
- `routes/pagespeed.ts`의 `getAutoCwvHelpers()` export는 현재 미사용으로 보임(정리 가능)
- `QA_PATTERNS/isQAKeyword`가 `routes/gsc.ts`, `routes/diagnosis.ts`에 중복(유틸로 합치기 가능)
- in-memory 캐시들은 멀티 인스턴스 환경에서 일관성이 없음 -> next1.0.md의 Sprint 4.6(Redis 캐시 전환)과 같이 추후 정리 권장
