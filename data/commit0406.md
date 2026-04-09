# Commit 0406

기준일: 2026-04-06  
대상: `backend/src/server.ts` 관련 커밋 정리

## 1. 관련 커밋

1. `10a1c49` `backend: fix consultation range parsing and toss multi-store config`
2. `ade4200` `docs: update roadmap and data integrity notes`
3. `3967be5` `backend: expose toss store health in status endpoint`

## 2. 왜 `server.ts`를 별도 커밋으로 분리했는가

`server.ts`에는 당시 아래 변경이 한 파일에 같이 섞여 있었다.

- Toss multi-store health 노출
- Ads / Meta / Meta CAPI 라우터 등록
- Meta CAPI 자동 sync 배치
- `meta` health 표시

이 중 `0406` 시점에 내가 확실히 마무리한 범위는 `Toss multi-store health`였다.  
반면 Ads / Meta / CAPI 쪽은 별도 기능 단위였고, 같은 커밋에 섞으면 커밋 목적이 흐려질 수 있었다.

그래서 `3967be5`에는 아래 hunk만 넣었다.

- `getTossStoreHealth` import 추가
- `/health`에서 `toss.stores.biocom`, `toss.stores.coffee` 노출

즉, `server.ts` 전체를 커밋한 것이 아니라 **Toss 상태 노출과 직접 관련된 최소 범위만 커밋**했다.

## 3. 커밋 후 현재 상태

현재 `server.ts` 작업 트리에는 아래 변경이 다시 살아 있다.  
이 변경들은 `3967be5`에 포함되지 않았다.

- `createAdsRouter()` 등록
- `createMetaRouter()` / `createMetaCapiRouter()` 등록
- `meta` health 블록
- `syncMetaConversionsFromLedger()` 기반 자동 배치

즉, **현재 작업 트리의 `server.ts`와 마지막 커밋의 `server.ts`는 다르다.**  
이건 의도된 상태다. 커밋 분리 과정에서 다른 로컬 변경을 잃지 않기 위해, 최소 hunk 커밋 후 나머지 변경을 다시 작업 트리에 복원했다.

## 4. 검증 결과

- `npx tsc --noEmit` 통과
- `curl http://localhost:7020/health` 확인
- `/health` 응답에서 아래 항목 확인
  - `apis.toss.stores.biocom.ready = true`
  - `apis.toss.stores.coffee.ready = true`

## 5. 내 의견: `server.ts` 리팩토링이 필요한가

### 결론

- **예. 필요하다.**
- 다만 당장 기능을 막는 급한 리팩토링은 아니고, **중간 우선순위**다.

### 이유

현재 `server.ts`는 역할이 너무 많다.

- 앱 부트스트랩
- CORS 정책
- rate limit 정책
- health 응답 조립
- 라우터 등록
- PageSpeed 자동 작업
- 향후 Meta CAPI 같은 백그라운드 잡 등록

이 구조에서는 다음 문제가 반복되기 쉽다.

- unrelated 변경이 같은 파일에 섞여 커밋 단위가 흐려짐
- health 수정과 라우터 추가가 한 diff에 같이 들어감
- 배치 작업이 늘수록 부팅 코드 가독성이 급격히 나빠짐

### 권장 리팩토링 방향

1. `health.ts`
   - `/health` 응답 조립 전용
   - 외부 API readiness 계산을 여기로 이동

2. `appRouters.ts`
   - `app.use(...)` 등록만 모으기
   - 기능군별 라우터 등록을 분리

3. `backgroundJobs.ts`
   - PageSpeed, Meta CAPI 같은 서버 시작 후 배치 등록 담당

4. `corsConfig.ts`
   - 허용 origin과 정책 분리

### 우선순위 판단

- 지금 바로 해야 할 정도: 아님
- Ads / Meta / CAPI 기능을 계속 확장할 예정이면: 빨리 하는 편이 좋음
- `server.ts`에 또 새 통합 기능이 들어갈 예정이면: 그 전에 리팩토링하는 게 맞음

## 6. 추천 운영 원칙

- `server.ts`는 앞으로 “조립만 하는 파일”로 유지하는 편이 좋다.
- 새 외부 연동을 붙일 때는
  - readiness 계산
  - 라우터 등록
  - background job
  - env 매핑
  를 한 파일에 같이 넣지 않는 편이 낫다.

## 7. 요약

- `server.ts` 관련 커밋은 **빠진 것이 아니라 의도적으로 분리**했다.
- `3967be5`는 Toss multi-store health만 담은 최소 커밋이다.
- Ads / Meta / CAPI 관련 `server.ts` 변경은 아직 작업 트리에 남아 있다.
- `server.ts`는 리팩토링이 필요한 파일이 맞고, 다음 통합 작업 전에 구조를 나누는 것이 장기적으로 안전하다.

## 8. `server.ts` 리팩토링 계획

### 목표

- `server.ts`를 기능 구현 파일이 아니라 **조립(composition) 파일**로 줄인다.
- 리팩토링 후 `server.ts`의 책임은 아래 3개만 남긴다.
  - app 생성
  - 서버 listen
  - 시작 로그

### 비목표

- CORS 정책 변경
- rate limit 정책 변경
- 라우터 순서 변경
- health 응답 스키마 변경
- PageSpeed / Meta CAPI 배치 동작 변경

즉, 이번 리팩토링은 **구조만 바꾸고 동작은 바꾸지 않는 것**이 원칙이다.

### 현재 문제 정의

현재 `server.ts`는 아래 책임을 한 파일에 같이 들고 있다.

- middleware 설정
- CORS 허용 origin 선언
- rate limiter 연결
- health payload 조립
- 라우터 등록
- 백그라운드 잡 등록
- 서버 시작

이 구조의 문제는 다음과 같다.

- unrelated diff가 한 파일에 쉽게 섞인다
- 커밋 목적이 흐려진다
- health 수정과 라우터 추가가 같이 들어간다
- 백그라운드 잡이 늘어날수록 읽기 어려워진다

### 리팩토링 후 목표 구조

1. `backend/src/app.ts`
   - `createApp()`만 제공
   - express 인스턴스를 만들고 middleware/route를 연결

2. `backend/src/bootstrap/configureMiddleware.ts`
   - `cors`
   - `express.json`
   - `express.text`
   - `pinoHttp`
   - rate limit

3. `backend/src/bootstrap/registerRoutes.ts`
   - `app.use(...)` 등록만 담당
   - 현재 라우터 등록 순서를 그대로 유지

4. `backend/src/bootstrap/startBackgroundJobs.ts`
   - PageSpeed 자동 측정
   - Meta CAPI 자동 sync
   - 향후 cron성 작업도 여기에 모음

5. `backend/src/health/buildHealthPayload.ts`
   - `/health` 응답 body 생성만 담당
   - Toss store health, CRM local stats 계산 포함

6. `backend/src/server.ts`
   - `createApp()` 호출
   - `app.listen()` 호출
   - 시작 로그 출력

### 단계별 계획

#### Step 0. 기준선 고정

- 현재 `/health` 응답을 샘플로 저장
- 현재 라우터 등록 순서를 기록
- 현재 부팅 시 background job 로그를 기록
- 기준 검증:
  - `npx tsc --noEmit`
  - `curl http://localhost:7020/health`

#### Step 1. health 분리

- `/health` body 생성 코드를 `buildHealthPayload.ts`로 이동
- `server.ts`에서는 `res.json(buildHealthPayload())`만 호출
- 이 단계에서는 응답 key 이름과 nested shape를 절대 바꾸지 않는다

#### Step 2. middleware 분리

- `pinoHttp`, CORS, body parser, rate limit 연결을 `configureMiddleware(app)`로 이동
- 특히 아래 항목은 그대로 유지한다.
  - `allowedOrigins`
  - `/health` bypass
  - GSC/AI rate limit 분기

#### Step 3. route registry 분리

- 모든 `app.use(create...Router())`를 `registerRoutes(app)`로 이동
- 등록 순서를 고정값으로 두고, 리팩토링 중 절대 재정렬하지 않는다

#### Step 4. background jobs 분리

- PageSpeed 자동 측정 로직을 `startBackgroundJobs()`로 이동
- Meta CAPI auto-sync도 같은 파일로 이동
- `server.ts`에서는 listen 이후 한 줄로 시작만 시킨다

#### Step 5. 최종 정리

- `server.ts`의 import 수를 최소화
- `server.ts` 길이를 대략 40~60줄 수준으로 줄이는 것을 목표로 한다
- 중복 import, inline function, 긴 리터럴을 각 모듈로 이동

### 커밋 분할 계획

1. `backend: extract health payload from server bootstrap`
   - `buildHealthPayload.ts`
   - `server.ts` health 호출부 최소화

2. `backend: extract middleware and route registration from server bootstrap`
   - `configureMiddleware.ts`
   - `registerRoutes.ts`
   - `server.ts` 정리

3. `backend: extract startup jobs from server bootstrap`
   - `startBackgroundJobs.ts`
   - PageSpeed / Meta CAPI 부팅 로직 이동

4. `backend: shrink server bootstrap entrypoint`
   - `app.ts`
   - 최종 cleanup

### 검증 기준

각 단계마다 아래를 반복한다.

- `npx tsc --noEmit`
- `curl http://localhost:7020/health`
- 핵심 smoke
  - `GET /api/toss/payments/orders/...`
  - `GET /api/consultation/summary?...`
- background job는 로그 기준으로 시작 여부만 확인

### 중단 기준

아래 중 하나가 발생하면 해당 단계에서 멈추고 별도 수정으로 처리한다.

- `/health` 응답 shape 변경
- 라우터 순서 변경으로 기존 endpoint 동작 차이 발생
- CORS 허용 origin 변화
- Meta CAPI / PageSpeed job 실행 타이밍 변화

### 내 판단

- 이 리팩토링은 **필요하다**.
- 하지만 기능 추가와 섞어 하면 실패 확률이 높다.
- 따라서 `Meta/Ads 기능 커밋`과 `server.ts 구조 분리 커밋`은 반드시 분리하는 편이 맞다.
- 가장 안전한 순서는 `health 분리 → middleware/route 분리 → background job 분리 → server.ts 축소`다.

## 9. 실제 리팩토링 수행 결과

### 실제로 어떻게 분리했는가

이번 리팩토링에서는 기존 `server.ts`의 책임을 아래처럼 분리했다.

1. `backend/src/app.ts`
   - `createApp()`만 남겼다
   - middleware 연결, `/health` 연결, route registry 호출만 담당

2. `backend/src/health/buildHealthPayload.ts`
   - 기존 `/health` JSON 조립 로직을 그대로 이동했다
   - `toss.stores`, `crmLocal`, `meta`, `playauto` 포함 기존 응답 shape를 유지했다

3. `backend/src/bootstrap/configureMiddleware.ts`
   - `trust proxy`
   - `pinoHttp`
   - CORS
   - `express.json`
   - `express.text`
   - GSC/AI rate limit
   를 그대로 이동했다

4. `backend/src/bootstrap/registerRoutes.ts`
   - `app.use(create...Router())` 구문을 이 파일로 이동했다
   - 404와 공통 error handler도 같이 옮겼다
   - 라우터 등록 순서는 바꾸지 않았다

5. `backend/src/bootstrap/startBackgroundJobs.ts`
   - PageSpeed 자동 측정 로직 이동
   - Meta CAPI auto-sync 로직 이동
   - 기존 시작 시점(`30초`, `60초`)은 유지했다

6. `backend/src/server.ts`
   - app 생성
   - `app.listen()`
   - 시작 후 `startBackgroundJobs()` 호출
   만 남겼다

### 파일 길이 변화

- 리팩토링 전 `backend/src/server.ts`: `291줄`
- 리팩토링 후 `backend/src/server.ts`: `11줄`

즉, `server.ts`는 실제로 “부트스트랩 진입점” 역할만 남기고 축소되었다.

## 10. 실제 검증 결과

### 정적 검증

- `backend`: `npx tsc --noEmit` 통과

### 동작 검증

1. `/health` 비교
   - 리팩토링 전 `/health` 응답을 저장했다
   - 리팩토링 후 `/health`와 비교했을 때 `timestamp`를 제외하면 **완전히 동일**했다

2. 기존 서버(`7020`) smoke test
   - `GET /api/consultation/summary?start_date=2025-04-01&end_date=2026-03-27` 정상
   - `GET /api/toss/payments/orders/202601017947250-P1?store=coffee` 정상

3. cold start 검증
   - 별도 포트 `7031`에 `node --import tsx src/server.ts`로 새 프로세스를 띄워 확인했다
   - `GET /health` 정상
   - `GET /api/toss/payments/orders/202501019001551-P1?store=biocom` 정상

4. background job 검증
   - 부팅 후 로그에서 `[CWV auto] start - https://biocom.kr` 확인
   - 60초 경과 후 `[CAPI auto-sync] 활성화 — 30분 주기` 확인

### 결론

- 이번 리팩토링은 **구조만 바꾸고 동작은 유지**하는 데 성공했다
- `/health` 응답 shape, 주요 API, cold start, background job 시작까지 모두 확인했다
