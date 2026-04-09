# Commit Feedback Reply

기준일: 2026-04-06

## 1. 프로젝트 구조 확인

먼저 저장소 구조를 다시 확인했다.

- 루트는 다중 워크스페이스 형태이고, 이번 확인 대상의 핵심 실행 프로젝트는 `frontend/`와 `backend/`였다.
- `frontend/`는 Next.js 기반이며 `frontend/package.json` 기준 개발 포트는 `7010`이다.
- `backend/`는 Express + TypeScript 기반이며 `backend/package.json` 기준 개발 포트는 `7020`이다.
- 문서/검증 자료는 `docs/`, `data/`에 있고, 이번 피드백 문서도 `data/` 아래에 있었다.

현재 백엔드 부트스트랩 구조는 아래처럼 분리되어 있다.

- `backend/src/server.ts`
- `backend/src/app.ts`
- `backend/src/bootstrap/configureMiddleware.ts`
- `backend/src/bootstrap/registerRoutes.ts`
- `backend/src/bootstrap/startBackgroundJobs.ts`
- `backend/src/health/buildHealthPayload.ts`

즉, `commit0406.md`에서 제안했던 `server.ts` 분리 방향은 실제 파일 구조로 반영되어 있다.

## 2. 실제 diff 기준 확인 결과

이번에는 문서만 본 것이 아니라, `git diff`와 현재 파일 내용을 기준으로 직접 확인했다.

### 2-1. 라우터 순서

기준 비교 대상은 현재 `HEAD`의 기존 `backend/src/server.ts`와 현재 작업트리의 `registerRoutes.ts`였다.

기존 `server.ts`의 라우터 순서는 아래였다.

1. GSC
2. GA4
3. PageSpeed
4. ChannelTalk
5. Toss
6. Aligo
7. Attribution
8. Callprice
9. CrmPhase1
10. CrmLocal
11. Consultation
12. AI
13. Crawl
14. Diagnosis
15. 404
16. errorHandler

현재 `registerRoutes.ts`의 순서는 아래다.

1. GSC
2. GA4
3. PageSpeed
4. ChannelTalk
5. Toss
6. Ads
7. Meta
8. Meta CAPI
9. Aligo
10. Attribution
11. Callprice
12. CrmPhase1
13. CrmLocal
14. Consultation
15. AI
16. Crawl
17. Diagnosis
18. 404
19. errorHandler

정리하면 다음과 같다.

- 기존 라우터들끼리의 상대 순서는 유지됐다.
- 다만 현재 작업트리는 순수 리팩토링만 있는 상태가 아니고, `Ads / Meta / Meta CAPI` 라우터가 `Toss` 뒤에 새로 삽입되어 있다.
- 따라서 “전체 순서가 완전히 동일하다”는 표현은 부정확하다.
- 정확한 표현은 “기존 라우터의 상대 순서는 유지됐고, 새 라우터가 404 이전에 추가됐다”가 맞다.

이 부분은 피드백에 답할 때 반드시 분리해서 말해야 한다.

## 2-2. 404 / error handler 위치

이건 실제 코드 기준으로 유지됐다.

- `registerRoutes.ts` 마지막에 404 핸들러가 있다.
- 그 다음 줄에 `errorHandler`가 있다.

즉, 기존 `server.ts`에서 하던 최종 fallback 위치는 그대로 유지됐다.

## 2-3. `startBackgroundJobs()` 호출 타이밍

현재 `server.ts`는 아래 순서다.

1. `createApp()` 호출
2. `app.listen(...)`
3. listen callback 안에서 시작 로그 출력
4. 같은 callback 안에서 `startBackgroundJobs()` 호출

따라서 background job 등록 시점은 여전히 “listen 이후”다.

세부적으로 보면:

- PageSpeed 자동 작업은 `startBackgroundJobs()` 내부에서 `setTimeout(..., 30_000)`으로 시작한다.
- 이것은 기존 `server.ts`의 listen callback 안에 있던 30초 지연 실행과 동일한 성격이다.
- Meta CAPI auto-sync는 현재 작업트리에 추가된 신규 동작이며, `setTimeout(..., 60_000)` 이후 interval 등록으로 시작한다.

즉, “기존 PageSpeed 잡의 실행 타이밍이 listen 이전으로 당겨진 것” 같은 회귀는 없었다.
다만 현재 diff에는 리팩토링 외에 신규 Meta CAPI 잡 추가가 함께 섞여 있다.

## 2-4. `buildHealthPayload.ts` import side effect 여부

이 부분도 실제 import 대상을 확인했다.

`buildHealthPayload.ts`는 아래를 import 한다.

- `isOpenAIConfigured`
- `getDbStats`
- `env`
- `isSerpApiConfigured`
- `getTossStoreHealth`

확인 결과:

- `isOpenAIConfigured`, `isSerpApiConfigured`, `getTossStoreHealth`는 설정값 확인용 함수라 import 시점 부작용이 없다.
- `crmLocalDb.ts`는 DB 싱글턴을 가지고 있지만, 실제 DB 오픈은 `getDbStats()` 호출 시 내부 `getCrmDb()`에서 lazy init 된다.
- 기존 인라인 `/health` 구현도 동일하게 요청 시점에 `getCrmLocalStats()`를 호출하고 있었기 때문에, 이 동작은 리팩토링 전후 의미가 같다.

따라서 `buildHealthPayload.ts`로 분리되면서 “import만 해도 잡이 돌거나 외부 호출이 발생하는” 종류의 새 side effect는 확인되지 않았다.

## 3. 실제 검증 실행 결과

문서 확인에서 끝내지 않고 현재 실행 중인 백엔드(`src/server.ts`, 포트 `7020`)에 대해 직접 검증했다.

### 3-1. 타입체크

- `npm --prefix backend run typecheck`
- 결과: 통과

### 3-2. 핵심 smoke

- `curl http://localhost:7020/health`
  - 결과: `200 OK`
  - 확인:
    - `apis.toss.stores.biocom.ready = true`
    - `apis.toss.stores.coffee.ready = true`
    - `apis.meta.ready = true`

- `curl 'http://localhost:7020/api/consultation/summary?startDate=2026-04-01&endDate=2026-04-06'`
  - 결과: `ok: true`

- `curl 'http://localhost:7020/api/meta/status'`
  - 결과: `{"ok":true,"configured":true,...}`

- `curl 'http://localhost:7020/api/ads/iroas/experiments'`
  - 결과: `ok: true`
  - 실험 3건 반환 확인

- `curl 'http://localhost:7020/api/toss/payments/orders/202602229401511-P1?store=coffee'`
  - 결과: `ok: true`
  - 실제 Toss 결제 조회 성공
  - `status = "DONE"` 확인

### 3-3. CORS / 예외 경로

- `OPTIONS /api/meta/status` with `Origin: http://localhost:7010`
  - 결과: `204 No Content`
  - `Access-Control-Allow-Origin: http://localhost:7010` 확인

- `GET /definitely-not-found`
  - 결과: `404`
  - 응답:
    - `{"error":"not_found","message":"Route not found"}`

- `GET /api/meta/status` with blocked origin `https://evil.example.com`
  - 결과: `500`
  - 응답:
    - `{"error":"internal_error","message":"CORS blocked: https://evil.example.com"}`

이걸로 404 fallback과 전역 에러 핸들러 경로 둘 다 실제로 살아 있음을 확인했다.

### 3-4. 테스트

- `node --import tsx --test tests/ads.test.ts` (workdir: `backend/`)
- 결과: 4/4 통과

## 4. 피드백에 대한 최종 답변

이번 피드백의 핵심은 맞았다.

문서만 보면 합격처럼 보여도, 실제 diff 기준으로는 아래를 분리해서 말해야 한다.

1. `server.ts` 분리 자체는 실제 코드 기준으로 성립했다.
2. 404 / error handler 위치는 유지됐다.
3. PageSpeed background job 시작 시점도 listen 이후로 유지됐다.
4. `buildHealthPayload.ts` 분리로 인한 새 import side effect는 확인되지 않았다.
5. 그러나 현재 작업트리는 “순수 리팩토링만 있는 상태”가 아니다.
6. `Ads / Meta / Meta CAPI` 추가가 함께 섞여 있으므로, reviewer 관점에서 보면 리팩토링 diff와 기능 추가 diff가 아직 분리되지 않았다.

즉, 이번 피드백에 대한 가장 정확한 답은 아래다.

- 문서 기준 성공이라는 평가는 유지 가능
- 코드 기준으로도 큰 회귀는 현재 확인되지 않음
- 하지만 현재 작업트리는 독립 리팩토링 커밋으로 닫힌 상태가 아니라, 기능 추가가 섞여 있어 커밋 경계는 여전히 불명확함

## 5. 지금 시점 권장 결론

내 판단은 아래와 같다.

- 다음 작업 전 “작은 마감 커밋을 독립으로 닫자”는 피드백은 여전히 유효하다.
- 특히 지금 diff에는 `server.ts` 구조 분리와 `ads/meta/capi` 확장이 함께 섞여 있으므로, 이후 장애가 나면 원인 분리가 어려워진다.

따라서 안전한 다음 순서는:

1. `server.ts` 분리 결과만 선택적으로 정리
2. 가능하면 독립 커밋으로 분리
3. 동일 smoke 재실행
4. 그 다음 Ads / Meta / CAPI 작업 진행

## 6. 이번 작업 범위 메모

이번에는 검증과 답변 문서화까지 수행했다.

- 프로젝트 구조 재확인 완료
- `commit0406.md` 확인 완료
- `commitfeedback.md` 확인 완료
- 실제 diff / 코드 / 런타임 기준 검증 완료
- 결과를 이 문서에 기록 완료

별도 코드 수정이나 커밋 생성은 이번 요청 범위에서 수행하지 않았다.
