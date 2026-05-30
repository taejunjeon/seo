# Meta API 호출 제한 원인 조사 및 재발 방지 설계

작성 시각: 2026-05-27 02:24 KST
최근 업데이트: 2026-05-27 09:19 KST
대상: 바이오컴 Meta Ads API, `/ads`, `/ads/meta-utm`, `/api/ads/roas-summary`
작업 성격: Green Lane, 로컬 조사/로컬 안전 패치, VM Cloud 배포 없음

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - docs/agent-harness/growth-data-harness-v0.md
  project_harness_read:
    - AGENTS.md
    - project/meta-utm-api-evidence-improvement-plan-20260527.md
    - project/meta-utm-api-evidence-field-expansion-result-20260527.md
  required_context_docs:
    - meta/campaign-alias-mapping.md
  lane: Green
  allowed_actions:
    - local_code_read
    - local_code_patch
    - local_typecheck
    - local_api_smoke_no_force
    - local_account_level_circuit_breaker_patch
    - local_account_level_request_queue_patch
    - local_meta_usage_header_capture
    - local_api_smoke_force_cooldown
    - official_doc_link_review
  forbidden_actions:
    - vm_cloud_deploy
    - meta_ads_setting_change
    - production_db_write
    - gtm_publish
  source_window_freshness_confidence:
    source: "local code + local runtime cache + Meta API error response"
    window: "2026-05-27 01:57~09:19 KST investigation and patch window"
    freshness: "local process/cache observed 2026-05-27 09:19 KST"
    confidence: "High for local call-path root causes, Medium for exact Meta quota math because Meta does not expose full quota formula in response"
```

## 한 줄 결론

이번 호출 제한은 특정 광고 1개의 문제가 아니라 같은 Meta ad account에 무거운 API 묶음이 동시에 몰린 구조 문제다. 특히 서버 재시작 직후 mapping warmup, Meta UTM precompute, ROAS summary precompute, 수동 `force=1` 재조회가 겹치면서 `act_3138805896402376` 계정 단위 rate limit에 걸렸다.

## 관측된 에러

Meta 응답:

```json
{
  "code": 80004,
  "error_subcode": 2446079,
  "message": "There have been too many calls to this ad-account. Wait a bit and try again."
}
```

해석:

- app 전체가 아니라 `ad-account` 단위 호출 제한이다.
- 같은 계정의 campaigns/adsets/ads/insights 조회가 서로 같은 quota를 먹는다.
- Meta 에러 메시지가 안내한 공식 문서 범주는 Ads Management rate limiting이다.

공식 문서:

- https://developers.facebook.com/docs/graph-api/overview/rate-limiting/#ads-management

주의:

- 조사 시점에 해당 공식 문서 페이지 자체가 429를 반환해 본문은 직접 확인하지 못했다.
- 따라서 상세 quota 숫자는 확정하지 않고, 실제 에러 응답과 로컬 호출 구조를 기준으로 판단했다.

## 왜 걸렸는가

### 1. 서버 재시작 직후 Meta 호출이 겹친다

관측:

- parent watcher 시작: 2026-05-23 17:27:35 KST
- child backend process 재시작: 2026-05-27 01:57:01 KST
- ROAS summary cache 생성: 2026-05-27 01:58~01:59 KST
- Meta UTM diagnostics cache 생성: 2026-05-27 02:11 KST

추론:

- 01:57 재시작 직후 router 생성 시 `startMetaMappingWarmupOnce()`가 예약된다.
- 기존 코드는 5초 뒤 3개 계정 전체에 대해 adset map + creative evidence map을 warmup했다.
- 30초 뒤 Meta UTM precompute가 `force=1`로 실행됐다.
- 90초 뒤 ROAS summary precompute가 `force=true`로 2개 계정 × 3 preset group을 실행했다.
- 이후 Codex가 API 보완 검증을 위해 `force=1`과 단건 direct probe를 추가로 시도했다.

이 흐름이 같은 시간대에 겹치면, 단일 사용자 요청이 없어도 이미 Meta API 호출량이 올라간다.

### 2. `/ads/meta-utm` live miss 1회가 가볍지 않다

`/api/ads/meta-utm-diagnostics` live 계산은 대략 아래 호출을 만든다.

1. base context: campaign insights 1회
2. base context: adset mapping 1회, creative evidence 1회 가능
3. diagnostics 본문: campaigns 1회
4. diagnostics 본문: adsets 1회
5. diagnostics 본문: ads 1회
6. diagnostics 본문: campaign insights 1회
7. diagnostics 본문: adset insights 1회
8. diagnostics 본문: ad insights 1회

즉 mapping cache가 차 있어도 7회 내외, cache가 없으면 9회 내외의 Meta 호출이 한 번에 발생할 수 있다. 각 `fetchMetaPaged`는 paging이 있으면 추가 호출을 만든다.

### 3. Meta UTM precompute가 cache를 무시하고 있었다

기존 코드:

```ts
url.searchParams.set("force", "1");
```

문제:

- Meta UTM diagnostics cache TTL은 15분이다.
- Meta UTM precompute interval은 12분이다.
- 그런데 precompute가 `force=1`이어서 12분마다 아직 유효한 cache를 무시하고 live Meta API를 다시 때렸다.

이건 설계상 rate limit에 취약하다.

### 4. `/ads/meta-utm` 프론트는 진단과 ROAS summary를 동시에 부른다

프론트 `/ads/meta-utm` 화면은 mount 시점에 아래 두 요청을 동시에 시작한다.

- `/api/ads/meta-utm-diagnostics`
- `/api/ads/roas-summary?presets=last_3d,last_7d,last_30d`

평소에는 cache hit면 괜찮다. 하지만 둘 다 cache miss이거나 사용자가 강제 새로고침하면, 같은 계정에 진단 API와 summary API가 동시에 붙는다.

### 5. `/ads` 메인 화면도 Meta endpoint를 병렬 호출한다

`/ads` 메인 화면은 기본적으로 아래 요청을 병렬로 호출한다.

- `/api/meta/insights`
- `/api/ads/roas/daily`
- `/api/ads/site-summary`
- `/api/ads/roas`
- `/api/ads/campaign-ltv-roas`

각 endpoint는 lazy cache가 있지만, 첫 miss나 force 상황에서는 같은 ad account 호출이 겹친다.

### 6. 중앙 account-level 차단기가 없었다

현재 일부 endpoint는 stale fallback이 있다. 하지만 `80004`가 한 번 발생했을 때 “이 계정은 15~30분 동안 live Meta 호출 금지”라는 중앙 회로 차단기가 없다.

그래서 한 endpoint가 rate limit을 맞은 뒤에도 다른 endpoint나 direct probe가 계속 같은 계정을 때릴 수 있다.

2026-05-27 09:19 KST 업데이트:

- 로컬 백엔드에 account-level circuit breaker를 추가했다.
- 기본 차단은 5분, 반복 제한은 최대 15분까지 늘어난다.
- 차단은 해당 광고계정에만 적용되고, 다른 계정과 기존 캐시 응답은 계속 살아 있다.
- 같은 광고계정 live 요청은 account-level request queue를 거치도록 추가했다.
- 기본 동시성은 2, 시작 간격은 150ms라서 burst를 낮추되 성능을 과하게 죽이지 않는다.

## 로컬에 즉시 적용한 안전 패치

### 1. Meta UTM precompute에서 force 제거

변경 파일:

- `backend/src/bootstrap/startBackgroundJobs.ts`

변경 전:

```ts
url.searchParams.set("force", "1");
```

변경 후:

- `force=1` 제거
- cache가 신선하면 cache를 사용
- cache가 만료된 경우에만 live refresh

효과:

- 12분마다 무조건 live 조회하던 구조가 사라진다.
- TTL 15분 기준으로 불필요한 live call을 줄인다.

### 2. Meta UTM precompute 시작 지연

변경 전:

- 재시작 30초 뒤 Meta UTM precompute 시작

변경 후:

- 기본 180초 뒤 시작

효과:

- 서버 부팅 직후 mapping warmup, ROAS summary precompute, 사용자의 첫 화면 조회가 동시에 몰리는 위험이 줄어든다.

### 3. Meta mapping warmup 완화

변경 파일:

- `backend/src/metaAccountCircuitBreaker.ts`
- `backend/src/routes/ads.ts`
- `backend/src/routes/meta.ts`

변경 전:

- router 생성 5초 뒤 전체 계정 mapping warmup
- 계정별 adset map + creative map을 병렬 호출

변경 후:

- 기본 120초 뒤 warmup
- `META_MAPPING_WARMUP_ENABLED=0`으로 완전히 끌 수 있음
- 계정별 adset map, creative map을 순차 호출

효과:

- 서버 재시작 직후 Meta 호출 스파이크를 낮춘다.

### 4. Meta UTM force refresh 쿨다운 추가

변경 파일:

- `backend/src/routes/ads.ts`

추가 설정:

```txt
META_UTM_DIAGNOSTICS_FORCE_COOLDOWN_MS
```

기본값:

- 10분

효과:

- 같은 cache key에 대해 10분 안에 `force=1`을 반복하면 live Meta를 다시 때리지 않고 `force_cooldown_cache`를 반환한다.
- 사용자가 새로고침 버튼을 여러 번 눌러도 같은 계정을 계속 때리지 않는다.

### 5. Account-level Meta circuit breaker 추가

변경 파일:

- `backend/src/routes/ads.ts`

추가 설정:

```txt
META_ACCOUNT_RATE_LIMIT_BREAKER_ENABLED
META_ACCOUNT_RATE_LIMIT_BREAKER_MS
META_ACCOUNT_RATE_LIMIT_BREAKER_MAX_MS
META_ACCOUNT_RATE_LIMIT_BREAKER_REPEAT_WINDOW_MS
```

기본값:

- `META_ACCOUNT_RATE_LIMIT_BREAKER_ENABLED`: on
- `META_ACCOUNT_RATE_LIMIT_BREAKER_MS`: 5분
- `META_ACCOUNT_RATE_LIMIT_BREAKER_MAX_MS`: 15분
- `META_ACCOUNT_RATE_LIMIT_BREAKER_REPEAT_WINDOW_MS`: 30분

동작:

- Meta API가 `80004`, `17`, `32`, `613`, `4` 또는 HTTP 429를 반환하면 해당 `act_...` 광고계정만 차단한다.
- 차단 중 같은 계정의 live Meta 호출은 즉시 실패 처리되어 endpoint의 stale/cache fallback으로 넘어간다.
- 다른 광고계정, 이미 만들어진 캐시 응답, 로컬 원장 조회는 차단하지 않는다.
- 반복 제한이면 5분 → 10분 → 15분까지 늘리고, 15분을 넘기지는 않는다.
- `/api/ads/...` 라우터와 `/api/meta/...` 라우터가 같은 in-memory 차단 상태를 공유한다.

설계 의도:

- 너무 안전하게 30~60분 막지 않는다.
- 단, 실제 rate limit이 확인된 계정에는 burst를 즉시 멈춘다.
- 사용자가 보는 화면은 가능한 한 캐시/stale로 살리고, live Meta 호출만 줄인다.

### 6. Account-level request queue 추가

변경 파일:

- `backend/src/metaAccountRequestQueue.ts`
- `backend/src/routes/ads.ts`
- `backend/src/routes/meta.ts`

추가 설정:

```txt
META_ACCOUNT_REQUEST_QUEUE_ENABLED
META_ACCOUNT_REQUEST_QUEUE_CONCURRENCY
META_ACCOUNT_REQUEST_QUEUE_MIN_GAP_MS
META_ACCOUNT_REQUEST_QUEUE_MAX_WAIT_MS
META_API_USAGE_WARN_PERCENT
```

기본값:

- queue enabled: on
- account별 동시성: 2
- 같은 account 요청 시작 간격: 150ms
- queue 최대 대기: 120초
- usage warning threshold: 80%

동작:

- 같은 `act_...` 계정으로 나가는 Meta live 요청은 queue를 거친다.
- 서로 다른 광고계정은 서로 막지 않는다.
- cache hit, 로컬 원장 조회, 문서/프론트 렌더링은 queue를 거치지 않는다.
- `/api/ads/...` 라우터와 `/api/meta/...` 라우터가 같은 queue를 공유한다.

설계 의도:

- 동시성 1은 너무 안전해서 `/ads/meta-utm` cold 조회가 과하게 느려질 수 있다.
- 동시성 2는 현재 heavy endpoint의 burst를 절반 이하로 낮추면서 실사용 응답성은 보존한다.
- 실제 Meta 제한이 다시 감지되면 circuit breaker가 5~15분 차단으로 이어받는다.

### 7. Meta 사용량 헤더와 로컬 호출 수량 관측 추가

변경 파일:

- `backend/src/metaAccountRequestQueue.ts`
- `backend/src/routes/ads.ts`
- `backend/src/routes/meta.ts`

새 read-only endpoint:

```txt
GET /api/ads/meta-api-health
```

보는 값:

- queue config
- account별 started/completed/failed/queued/active
- account별 마지막 Meta path
- Meta가 응답에 포함한 usage headers

관측 대상 헤더:

- `x-app-usage`
- `x-ad-account-usage`
- `x-business-use-case-usage`

주의:

- 이 헤더들은 Meta가 응답에 포함할 때만 기록된다.
- 로컬 started/completed count는 백엔드 프로세스가 실제로 보낸 live Meta 요청 수다.
- Meta 전체 quota 산식과 100%까지 남은 절대 호출 가능 횟수는 응답 헤더만으로 항상 확정되지 않는다.

## 검증 결과

### 타입체크

명령:

```bash
cd /Users/vibetj/coding/seo/backend && npm run typecheck
```

결과:

- 통과

### 타입체크 재검증

시각:

- 2026-05-27 09:16 KST

명령:

```bash
npm --prefix backend run typecheck
```

결과:

- 통과

### no-force API smoke

명령:

```bash
curl 'http://localhost:7020/api/ads/meta-utm-diagnostics?account_id=act_3138805896402376&date_preset=last_7d'
```

결과:

```json
{
  "ok": true,
  "cache": {
    "cached": true,
    "cached_at_kst": "2026-05-27 02:11",
    "next_refresh_at_kst": "2026-05-27 02:26",
    "source": "disk_cache_hit"
  },
  "rows": 125
}
```

해석:

- 일반 화면 조회는 live Meta를 치지 않고 cache를 반환한다.
- 이번 조사는 force/live 추가 호출을 더 늘리지 않기 위해 no-force smoke까지만 수행했다.

### live cache miss smoke

시각:

- 2026-05-27 09:18 KST

명령:

```bash
curl 'http://localhost:7020/api/ads/meta-utm-diagnostics?account_id=act_3138805896402376&date_preset=last_7d'
```

결과 요약:

```json
{
  "ok": true,
  "elapsedMs": 75150,
  "cache": {
    "source": "live_cache_miss",
    "cached_at_kst": "2026-05-27 09:18",
    "next_refresh_at_kst": "2026-05-27 09:33",
    "ttl_seconds": 900
  },
  "rows": 125
}
```

해석:

- circuit breaker 구현 후에도 정상 live 조회는 막히지 않았다.
- 이번 live 조회에서는 Meta rate limit이 재발하지 않았다.

### force cooldown smoke

시각:

- 2026-05-27 09:18 KST

명령:

```bash
curl 'http://localhost:7020/api/ads/meta-utm-diagnostics?account_id=act_3138805896402376&date_preset=last_7d&force=1'
```

결과 요약:

```json
{
  "ok": true,
  "elapsedMs": 38,
  "cache": {
    "source": "force_cooldown_cache",
    "stale_reason": "force refresh cooldown active; retry live Meta refresh after 578s.",
    "force_cooldown_remaining_ms": 577818
  },
  "rows": 125
}
```

해석:

- Meta UTM force cooldown 기본값은 정확히 10분이다.
- live cache miss 직후 22초가 지난 상태였으므로 남은 시간이 약 578초로 표시됐다.

### ROAS summary smoke

시각:

- 2026-05-27 09:17 KST

명령:

```bash
curl 'http://localhost:7020/api/ads/roas-summary?account_id=act_3138805896402376&presets=last_7d'
```

결과 요약:

```json
{
  "ok": true,
  "elapsedMs": 12425,
  "cache": {
    "source": "live_cache_miss",
    "cached_at_kst": "2026-05-27 09:17",
    "next_refresh_at_kst": "2026-05-27 13:17"
  },
  "errors": {}
}
```

해석:

- ROAS summary도 circuit breaker 구현 후 정상 live 조회가 가능했다.

### `/api/meta/insights` smoke

시각:

- 2026-05-27 09:27 KST

명령:

```bash
curl 'http://localhost:7020/api/meta/insights?account_id=act_3138805896402376&date_preset=last_7d&level=campaign'
```

결과 요약:

```json
{
  "ok": true,
  "elapsedMs": 920,
  "cache": {
    "source": "live_cache_miss",
    "cached_at_kst": "2026-05-27 09:27",
    "next_refresh_at_kst": "2026-05-27 09:32"
  },
  "rows": 10
}
```

해석:

- `/api/meta/...` 라우터에도 공유 circuit breaker를 연결했지만 정상 조회는 막히지 않았다.

### circuit breaker local fixture

시각:

- 2026-05-27 09:28 KST

방법:

- 실제 Meta quota를 일부러 소모하지 않기 위해 `act_test_000` 가짜 계정으로 모듈 함수를 직접 호출했다.

결과 요약:

```json
{
  "firstRetrySeconds": 300,
  "secondRetrySeconds": 600,
  "blocked": true
}
```

해석:

- 첫 rate limit은 5분 차단이다.
- 같은 반복 제한은 10분으로 늘어난다.
- 설정상 최대 15분을 넘기지 않는다.

### request queue local fixture

시각:

- 2026-05-27 10:55 KST

방법:

- 실제 Meta를 치지 않고 `act_queue_fixture_2` 가짜 계정으로 5개 비동기 작업을 동시에 queue에 넣었다.

결과 요약:

```json
{
  "active": 0,
  "queued": 0,
  "started": 5,
  "completed": 5,
  "failed": 0,
  "max_queued": 4,
  "avg_queue_wait_ms": 303
}
```

해석:

- 요청 5개가 모두 완료됐다.
- queue 내부 카운터가 정상 기록됐다.
- 실제 Meta API를 치지 않는 fixture라 quota 소모는 없었다.

### Meta usage header smoke

시각:

- 2026-05-27 10:53 KST

명령:

```bash
curl 'http://localhost:7020/api/meta/insights?account_id=act_3138805896402376&date_preset=last_7d&level=campaign&force=1'
curl 'http://localhost:7020/api/ads/meta-api-health'
```

결과 요약:

```json
{
  "queue": {
    "config": {
      "enabled": true,
      "concurrency": 2,
      "minGapMs": 150,
      "maxWaitMs": 120000,
      "usageWarnPercent": 80
    },
    "accounts": {
      "act_3138805896402376": {
        "started": 1,
        "completed": 1,
        "failed": 0,
        "last_started_path": "/act_3138805896402376/insights"
      }
    }
  },
  "usage_headers": {
    "act_3138805896402376": {
      "headers": {
        "x-business-use-case-usage": "{\"3138805896402376\":[{\"type\":\"ads_insights\",\"call_count\":1,\"total_cputime\":3,\"total_time\":11,\"estimated_time_to_regain_access\":0,\"ads_api_access_tier\":\"development_access\"}]}"
      },
      "max_usage_percent": 11,
      "estimated_time_to_regain_access_seconds": 0
    }
  }
}
```

해석:

- Meta 응답에서 `x-business-use-case-usage`가 실제로 내려왔다.
- 이번 응답 기준 최대 사용량은 `total_time=11`로 낮았다.
- `estimated_time_to_regain_access=0`이므로 이 smoke 시점에는 회복 대기 상태가 아니었다.

## 앞으로 안 걸리게 하는 설계

### P0. Account-level Meta circuit breaker

상태:

- 2026-05-27 09:19 KST 로컬 구현 완료.

필요한 이유:

- `80004`는 특정 endpoint 문제가 아니라 ad account 전체 문제다.
- 한 endpoint가 제한을 맞으면 다른 endpoint도 같은 계정을 때리지 않아야 한다.

설계:

```txt
metaRateLimitState[accountId] = {
  limitedUntilMs,
  lastErrorCode,
  lastSubcode,
  lastMessage,
  sourceEndpoint
}
```

동작:

1. `fetchMeta` 또는 `fetchMetaPaged`가 `80004`, `17`, `32`, `613` 계열 제한을 감지한다.
2. 해당 `accountId`에 기본 5분 차단을 저장한다.
3. 이후 같은 account live 호출은 즉시 차단하고 cache/stale/degraded 응답을 반환한다.
4. 같은 제한이 반복되면 5분 → 10분 → 15분으로 backoff한다.
5. 차단 시간이 지나면 다음 live 조회를 허용한다.

성공 기준:

- rate limit 발생 직후에도 같은 account direct probe나 precompute가 추가 호출을 만들지 않는다.
- API 응답에 `meta_rate_limit.cooldown_until_kst`가 표시된다.

추천:

- 로컬 구현 완료. VM Cloud 반영은 별도 배포 승인 필요.

### P1. Account-level request queue

필요한 이유:

- 현재 `Promise.all`로 같은 계정에 campaigns/adsets/ads/insights가 동시에 붙는다.
- Meta는 호출 수뿐 아니라 burst에도 민감하다.

설계:

- accountId별 queue
- default concurrency 2
- 같은 account에 대해 최소 시작 간격 150ms
- queue max wait 120초
- 사용량 헤더 80% 이상이면 warning

성공 기준:

- `/ads/meta-utm` live miss 1회가 7~9개 동시 호출이 아니라 순차/저동시성 호출로 바뀐다.

추천:

- 2026-05-27 10:55 KST 로컬 구현 완료. VM Cloud 반영은 별도 배포 승인 필요.

### P2. Endpoint call consolidation

필요한 이유:

- `meta-utm diagnostics`는 base context의 campaign insights와 diagnostics의 campaign insights를 중복 호출한다.
- `/ads/meta-utm` 화면은 diagnostics와 roas-summary를 동시에 부른다.

설계:

1. `meta-utm diagnostics`에서 campaign level insights는 base context 결과를 재사용한다.
2. `roas-summary`가 이미 fresh면 `/ads/meta-utm`는 period card만 cache에서 읽는다.
3. `/ads` 메인 화면도 5개 endpoint 병렬 호출 대신 summary endpoint 우선으로 축약한다.

성공 기준:

- `/ads/meta-utm` cold start의 Meta 호출 수가 10회 이상에서 5회 이하로 내려간다.

추천:

- P0/P1 이후 적용. 추천 강도 80%.

### P3. Precompute budget rule

필요한 이유:

- 예열 작업은 사용자 요청보다 낮은 우선순위여야 한다.

설계:

- 한 ad account당 live precompute는 최소 30분 간격
- boot 후 첫 5분은 Meta precompute 금지
- cache fresh면 precompute는 무조건 skip
- 사용자가 이미 해당 account를 갱신 중이면 precompute는 skip

성공 기준:

- 서버 재시작 직후 Meta 호출이 몰리지 않는다.

추천:

- 일부 적용 완료, 나머지 중앙 scheduler로 보강. 추천 강도 85%.

### P4. Usage header logging

상태:

- 2026-05-27 10:53 KST 로컬 구현 완료.

필요한 이유:

- 현재는 제한에 걸린 뒤에야 알 수 있다.
- Meta 응답 header에 usage 정보가 내려오면 사전에 throttle할 수 있다.

설계 후보:

- `x-app-usage`
- `x-ad-account-usage`
- `x-business-use-case-usage`

동작:

- fetch wrapper가 응답 header를 읽고 account별 usage를 기록한다.
- usage가 80% 이상이면 precompute skip
- usage가 90% 이상이면 user force도 cooldown cache로 전환

주의:

- 실제 header 제공 여부는 응답별로 다르다.
- 이번 `insights` smoke에서는 `x-business-use-case-usage`가 관측됐다.

추천:

- 로컬 구현 완료. 프론트 표시 여부는 별도 판단.

## 운영 권장값

로컬 개발:

```txt
BACKGROUND_JOBS_ENABLED=0
```

또는 Meta 관련만 줄이고 싶으면:

```txt
META_MAPPING_WARMUP_ENABLED=0
META_UTM_DIAGNOSTICS_PRECOMPUTE_ENABLED=0
```

VM Cloud 운영:

```txt
META_UTM_DIAGNOSTICS_PRECOMPUTE_INTERVAL_MS=1800000
META_UTM_DIAGNOSTICS_PRECOMPUTE_START_DELAY_MS=300000
META_UTM_DIAGNOSTICS_FORCE_COOLDOWN_MS=900000
META_MAPPING_WARMUP_DELAY_MS=300000
```

해석:

- UTM 진단 예열은 30분 간격
- 서버 부팅 후 5분 뒤 시작
- force refresh는 15분 쿨다운
- mapping warmup도 5분 뒤 시작

## 현재 남은 리스크

- 로컬 안전 패치는 적용됐지만 VM Cloud에는 배포하지 않았다.
- Meta usage header logging은 로컬 구현됐지만, 응답별로 헤더가 없을 수 있다.
- account-level circuit breaker는 로컬 구현/타입체크/API smoke는 통과했지만, 실제 80004 재현 테스트는 운영 Meta quota를 일부러 소모해야 하므로 수행하지 않았다.
- request queue는 로컬 구현/fixture/API smoke는 통과했지만, 실제 `/ads/meta-utm` cold heavy 조회의 체감 시간은 VM Cloud 배포 후 한 번 더 확인해야 한다.

## 다음 실행 후보

1. VM Cloud 반영 승인 요청
2. VM Cloud 반영 후 `/api/ads/meta-api-health`로 queue/usage header 확인
3. `/ads/meta-utm` 화면 cold/live smoke에서 응답 시간과 rate limit 재발 여부 확인
4. 필요 시 concurrency 2 → 3 또는 min gap 150ms → 300ms 조정

## Auditor verdict

PASS_WITH_NOTES.

- 원인 경로는 코드와 runtime cache 기준으로 확인했다.
- 예방 로컬 패치 4개를 적용했다.
- account-level circuit breaker 로컬 패치를 추가 적용했다.
- account-level request queue 로컬 패치를 추가 적용했다.
- Meta usage header capture와 read-only health endpoint를 추가했다.
- 타입체크 통과했다.
- 운영 배포는 하지 않았다.
- 정확한 Meta quota 산식은 공식 응답이 제공하지 않아 확정하지 않았다.
