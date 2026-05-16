# ROAS summary precompute architecture

작성 시각: 2026-05-16 14:25 KST

## 목적

`/api/ads/roas-summary`를 화면이 누를 때마다 계산하지 않고, 5분마다 미리 계산한 결과를 즉시 반환한다.

## 현재 구조

현재 구조:

```text
frontend
  -> /api/ads/roas-summary
    -> VM Cloud ledger load 1회
    -> Meta Ads Insights today
    -> Meta Ads Insights yesterday
    -> Meta Ads Insights last_7d
    -> summary 반환
```

현재 장점:

- raw ledger item 응답 0.
- `/api/ads/roas` 3회 fallback을 피함.
- ledger load는 1회.

현재 한계:

- Meta Ads Insights를 preset별로 실시간 조회한다.
- live smoke 기준 약 12.9초.

## 목표 구조

목표 구조:

```text
background worker
  -> 5분마다 /api/ads/roas-summary?force=true&cache_write=1 호출
  -> 결과를 in-memory cache에 저장

frontend
  -> /api/ads/roas-summary
  -> cache hit이면 즉시 반환
```

## cache key

```text
roas_summary:${account_id}:${normalized_presets}:${ledger_source}
```

예:

```text
roas_summary:act_3138805896402376:last_7d,today,yesterday:auto
```

정규화 규칙:

- `presets`는 split 후 trim, 중복 제거, 사전순 정렬.
- `ledger_source` 기본값은 `auto`.
- raw order/payment/click/member id는 cache key에 넣지 않는다.

## cache value

```ts
type RoasSummaryCacheEntry = {
  body: RoasSummaryResponse;
  computedAtMs: number;
  generationMs: number;
  nextRefreshAtMs: number;
  source: "in_memory_precompute";
};
```

## worker target

Phase 1 target:

```ts
[
  {
    site: "biocom",
    accountId: "act_3138805896402376",
    presets: ["today", "yesterday", "last_7d"],
  },
  {
    site: "thecleancoffee",
    accountId: "act_654671961007474",
    presets: ["today", "yesterday", "last_7d"],
  },
]
```

Phase 1.1:

- `aibio` 추가.
- 필요하면 `last_30d` 추가.

## worker schedule

권장값:

```text
ROAS_SUMMARY_PRECOMPUTE_ENABLED=1
ROAS_SUMMARY_PRECOMPUTE_INTERVAL_MS=300000
ROAS_SUMMARY_PRECOMPUTE_START_DELAY_MS=90000
ROAS_SUMMARY_FORCE_COOLDOWN_MS=300000
ROAS_SUMMARY_STALE_MAX_AGE_MS=1800000
```

이유:

- funnel-health precompute는 restart 후 30초에 시작한다.
- ROAS summary는 Meta API를 호출하므로 90초 뒤에 시작해 tick 충돌을 줄인다.
- force refresh는 사용자 버튼 또는 worker가 동시에 누르더라도 key별 한 번만 실행되게 한다.

## concurrency guard

필수 guard:

- 전역 `workerRunning`이면 다음 tick skip.
- key별 `refreshInFlight`이면 같은 key refresh skip.
- force refresh cooldown 미만이면 기존 cache 반환.
- live refresh 실패가 기존 allow cache를 지우면 안 된다.

## stale fallback

정책:

- cache age 0~10분: fresh.
- cache age 10~30분: stale but usable.
- cache age 30분 초과: stale expired, live 계산 시도.

Meta API 장애 시:

- 30분 이하 cache가 있으면 `cache.stale=true`로 반환.
- cache가 없으면 502 또는 기존 live error 반환.

## 구현 방식 선택

### 권장: route-level cache + self-call worker

장점:

- 기존 `ads.ts` 내부 helper를 크게 분리하지 않아도 된다.
- 구현 파일이 적다.
- Option B와 충돌 가능성이 낮다.

단점:

- 장기적으로는 service module 분리가 더 깨끗하다.

### 보류: service module 대분리

장점:

- 테스트와 재사용성이 좋다.

단점:

- `ads.ts`에 있는 Meta/ledger helper를 대거 export 또는 이동해야 한다.
- incident 안정화 단계에서는 리팩토링 범위가 크다.

## 구현 순서

1. `ads.ts`에 cache Map과 cache helper 추가.
2. `roas-summary` route에서 cache hit 우선 반환.
3. live 계산 성공 시 cache write.
4. `startBackgroundJobs.ts`에 self-call worker 추가.
5. local typecheck/build.
6. VM Cloud Yellow deploy.
7. live smoke:
   - 첫 force: 10~20초 가능.
   - 이후 cache hit: 500ms 이하.
