# Sprint 4 Guide (백엔드 프로덕션 준비)

> 기준 문서: `next1.0.md` (Sprint 4: 백엔드 프로덕션 준비)
> 
> 목적(한 줄): **서비스를 "실제로 배포해도 안 터지게" 만드는 안전장치/운영도구를 붙인다.**

---

## 큰 그림

지금 백엔드는 여러 외부 서비스(GSC/GA4/PageSpeed/SerpAPI/Perplexity/OpenAI/Supabase)에 요청해서 데이터를 모아 대시보드에 보여줍니다.

문제는 "배포"하면 아래가 현실로 옵니다:
- 갑자기 사용자가 늘거나(또는 봇이 몰리거나) → 서버/외부 API가 과부하
- 외부 API가 느려지거나 장애 → 우리 서버도 같이 느려져서 전체가 다운처럼 보임
- 무슨 일이 벌어졌는지 로그가 없으면 → 원인 파악/복구가 늦어짐
- 매일 자동으로 쌓여야 할 데이터(GSC daily) → 사람이 수동으로 하면 자주 빠짐
- GA4가 안 붙었는데도 "가짜 숫자"를 보여주면 → 잘못된 의사결정

Sprint 4는 이 문제들을 막는 **안전장치(제한/차단/복구)** 와 **운영도구(로그/스케줄링/캐시)** 를 추가하는 단계입니다.

---

## 4.1 Rate Limiting 추가 (express-rate-limit)

### 왜 필요한가 (직관)
- 편의점에 손님이 한 번에 몰리면 계산대가 멈추듯, API도 갑자기 많이 들어오면 서버가 느려집니다.
- 특히 AI/외부 API는 **돈**이 들고 **시간**이 오래 걸려서, 무제한으로 열어두면 비용 폭탄/장애로 이어질 수 있습니다.
- 실수로 프론트에서 무한 재요청 버그가 나도, Rate limit이 "안전벨트"가 됩니다.

`next1.0.md` 기준 목표
- GSC 계열: **60 req/min**
- AI 계열: **10 req/min**

### 대략 어떻게 할까 (구현 방향)
1) 패키지 설치
- `cd backend && npm i express-rate-limit`

2) 미들웨어를 `backend/src/server.ts`에 추가
- 현재 서버는 라우터를 `app.use(createXRouter())`로 루트에 마운트하고, 라우터 내부에서 절대경로(`/api/...`)를 사용합니다.
- 그래서 "라우터별"로 마운트 경로를 나누지 못하는 대신, **req.path를 보고 limiter를 선택**하는 방식이 간단합니다.

예시(개략):
```ts
import rateLimit from "express-rate-limit";

const gscLimiter = rateLimit({ windowMs: 60_000, limit: 60 });
const aiLimiter = rateLimit({ windowMs: 60_000, limit: 10 });

app.use((req, res, next) => {
  const p = req.path;

  // GSC 관련
  if (
    p.startsWith("/api/gsc") ||
    p === "/api/trends" ||
    p === "/api/comparison" ||
    p.startsWith("/api/cron/gsc")
  ) {
    return gscLimiter(req, res, next);
  }

  // AI 관련(인사이트/채팅/인용/SerpAPI/키워드 인텐트)
  if (
    p.startsWith("/api/ai") ||
    p.startsWith("/api/serpapi") ||
    p.startsWith("/api/keywords")
  ) {
    return aiLimiter(req, res, next);
  }

  return next();
});
```

3) 배포 환경이면 프록시 뒤에 있을 수 있어 IP 인식 주의
- 필요 시 `app.set("trust proxy", 1)` 설정(배포 환경 구성에 따라 다름)

### 완료 기준(체크)
- 같은 API를 분당 60번(또는 10번) 넘게 호출하면 429가 뜬다.
- 정상 사용자는 체감 없이 사용 가능하다.

---

## 4.2 Request Logging (pino or morgan)

### 왜 필요한가 (직관)
- 게임 서버가 렉 걸릴 때 "누가 언제 어떤 행동을 했는지" 기록이 없으면 원인을 못 찾습니다.
- 운영에서 로그는 "블랙박스"입니다.
  - 어떤 API가 느린지(응답 시간)
  - 어떤 에러가 언제부터 늘었는지
  - 사용량이 갑자기 폭증했는지

### 대략 어떻게 할까 (구현 방향)
선택지 A) `pino`(구조화 로그, 운영 친화)
1) 설치
- `cd backend && npm i pino pino-http`

2) `server.ts`에서 라우터보다 먼저 붙이기
```ts
import pinoHttp from "pino-http";

app.use(
  pinoHttp({
    level: env.NODE_ENV === "production" ? "info" : "debug",
    // 필요 시 reqId, redact(민감정보 마스킹) 등을 추가
  }),
);
```

선택지 B) `morgan`(간단한 텍스트 로그)
- 개발 단계에서 빠르게 붙이기 좋음

### 완료 기준(체크)
- API 요청 1번마다 status code + latency(응답시간)가 로그로 남는다.
- 500/429가 언제/어떤 경로에서 나는지 바로 찾을 수 있다.

---

## 4.3 Cron 외부 스케줄러 연동 (Vercel Cron / GitHub Actions)

### 왜 필요한가 (직관)
- "매일" 해야 하는 작업을 사람이 기억해서 하면 100% 빠집니다.
- GSC daily 적재는 대시보드 품질의 기본 재료라서 자동화가 필요합니다.

현재 엔드포인트
- POST `/api/cron/gsc/daily`
- 보호: `x-cron-secret`(또는 `?secret=`)로 `CRON_SECRET` 검증

### 대략 어떻게 할까 (구현 방향)
선택지 A) GitHub Actions(HTTP 호출)
- 서버가 외부에서 접근 가능한 URL이 있을 때 간단함

예시(개략) `.github/workflows/gsc-daily.yml`:
```yml
name: gsc-daily
on:
  schedule:
    - cron: "10 3 * * *"  # 매일 03:10 UTC
jobs:
  run:
    runs-on: ubuntu-latest
    steps:
      - name: Call cron endpoint
        run: |
          curl -sS -X POST "$API_BASE_URL/api/cron/gsc/daily" \
            -H "content-type: application/json" \
            -H "x-cron-secret: $CRON_SECRET" \
            -d '{"pagePathPrefix":"/healthinfo/"}'
        env:
          API_BASE_URL: ${{ secrets.API_BASE_URL }}
          CRON_SECRET: ${{ secrets.CRON_SECRET }}
```

선택지 B) Vercel Cron
- Vercel 환경이면 스케줄 설정을 Vercel에서 관리

### 완료 기준(체크)
- 스케줄 시간이 되면 호출이 발생하고(로그로 확인), Supabase에 데이터가 쌓인다.
- `CRON_SECRET` 없이는 401로 막힌다.

---

## 4.4 GA4 Fallback 제거 (가짜 데이터 제거)

### 왜 필요한가 (직관)
- 시험 점수표에 "임의로 만든 점수"가 섞이면 분석이 무의미해집니다.
- GA4가 미연동/권한 문제일 때는 "가짜 숫자"보다 **빈 값(또는 명확한 에러)** 이 더 안전합니다.

`next1.0.md` 의도
- `_meta.type: "fallback"` 같은 하드코딩 샘플 데이터를 **없애고**
- GA4 미연동 시 **empty 반환**(또는 명확한 not-configured 응답)

### 대략 어떻게 할까 (구현 방향)
1) GA4 관련 라우트(`backend/src/routes/ga4.ts`)에서
- GA4 설정 누락/권한오류를 감지하면
  - (권장) `200` + 빈 배열/0 summary + `_meta`에 "not_configured" 표시
  - 또는 `503` 에러로 내려서 프론트가 empty-state로 처리

2) 테스트 업데이트
- "fallback" 데이터가 더 이상 나오지 않는 것을 테스트로 고정

### 완료 기준(체크)
- GA4 키가 없을 때도 "그럴듯한 숫자"가 나오지 않는다.
- 프론트는 empty-state로 자연스럽게 보인다.

---

## 4.5 Circuit Breaker (외부 API 장애 격리)

### 왜 필요한가 (직관)
- 친구에게 전화했는데 상대가 계속 안 받으면, 계속 전화하면 내 폰도 뜨겁고 배터리도 닳습니다.
- 외부 API(SerpAPI/Perplexity/OpenAI)가 느리거나 장애면, 우리 서버도 요청이 쌓여서 같이 느려집니다.
- Circuit breaker는 "잠깐 전화 시도 중단"처럼, 장애가 날 때 **즉시 실패**하게 만들어 서버 전체를 살립니다.

`next1.0.md` 기준 힌트
- SerpAPI 12s, Perplexity 15s 같은 타임아웃/장애 격리

### 대략 어떻게 할까 (구현 방향)
1) 모든 외부 호출에 timeout을 강제(AbortController)
- 응답이 없으면 일정 시간 후 끊고 실패 처리

2) 서비스별 circuit 상태를 메모리에 관리(또는 라이브러리 사용)
- 예: 5번 연속 실패하면 30초 동안 "OPEN" 상태로 전환
- OPEN 상태에서는 외부 호출을 하지 않고 즉시 `503` 반환
- 30초 후 1번만 시험 호출(half-open)로 회복 여부 판단

3) 적용 위치
- `backend/src/serpapi.ts`, `backend/src/perplexity.ts`, `backend/src/openaiSearch.ts` 같은 "외부 호출" 모듈

### 완료 기준(체크)
- 외부 API가 장애일 때도 백엔드가 전체적으로 느려지지 않는다.
- 장애 중에는 빠르게 `503`으로 응답하고, 회복되면 자동으로 정상화된다.

---

## 4.6 Redis 캐시 전환(선택)

### 왜 필요한가 (직관)
- 현재 in-memory(Map) 캐시는 "한 대의 컴퓨터" 안에서만 기억합니다.
- 서버를 2대로 늘리거나(스케일) 재시작하면 캐시가 날아가서, 같은 요청이 또 외부 API로 나가 비용/지연이 증가합니다.
- Redis는 "공용 메모장"이라서 여러 서버가 같은 캐시를 공유할 수 있습니다.

### 대략 어떻게 할까 (구현 방향)
1) Redis 준비
- 로컬: docker로 redis
- 운영: Upstash 같은 managed Redis

2) 클라이언트 라이브러리 추가
- 예: `npm i redis` 또는 `ioredis`

3) 공용 캐시 유틸을 하나 만들고(Map 캐시를 대체)
- `get(key)`, `set(key, value, ttlSeconds)` 형태
- JSON 직렬화/역직렬화

4) 교체 대상(대표)
- AI insights 캐시
- `/api/ai-traffic/topics` 캐시
- GSC trends/comparison 캐시
- crawl 결과 캐시

### 완료 기준(체크)
- 서버를 재시작해도 캐시 hit가 유지된다.
- 서버를 여러 대 띄워도 캐시가 공유된다.

---

## 추천 실행 순서(실행하기 쉽게)
1) 4.2 Request Logging: 먼저 붙이면 이후 작업 디버깅이 쉬움
2) 4.1 Rate Limiting: 비용/장애 방지의 즉효
3) 4.3 Cron 연동: 데이터 적재 자동화
4) 4.4 GA4 fallback 제거: 데이터 신뢰도 확보
5) 4.5 Circuit Breaker: 외부 장애에 강해짐
6) 4.6 Redis(선택): 스케일/운영 단계에서 필요해질 때 적용
