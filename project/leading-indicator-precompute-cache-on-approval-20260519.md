# Leading Indicator Precompute Cache ON 승인안

작성 시각: 2026-05-19 01:13 KST
기준일: 2026-05-19
문서 성격: Yellow Lane controlled smoke 승인안 + Red Lane 상시 ON 후보 승인안
대상 기능: 구매 전 선행지표 분석 에이전트 P1 API 캐시 사전 계산
대상 API: `GET /api/attribution/leading-indicators`
대상 화면: `/ai-crm/leading-indicators`

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - project/leading-indicator-p1-vm-deploy-result-20260519.md
    - project/leading-indicator-p1-live-endpoint-vm-approval-20260518.md
    - project/leading-indicator-aggregate-endpoint-design-20260518.md
  lane:
    controlled_smoke: Yellow
    permanent_on: Red
  allowed_actions_after_yellow_approval:
    - VM Cloud seo-backend current env/pre-snapshot
    - set LEADING_INDICATORS_PRECOMPUTE_ENABLED=1 for controlled smoke window
    - set LEADING_INDICATORS_PRECOMPUTE_INTERVAL_MS=1800000
    - seo-backend restart with update-env
    - read-only API smoke/post-check
    - PM2 log and memory/CPU/event-loop monitor
    - cache source and response time verification
    - rollback to disabled env if stop criteria hit
  forbidden_actions:
    - Meta CAPI send/backfill
    - GA4 Measurement Protocol send
    - Google Ads/TikTok/Naver/Meta mutate
    - GTM submit/create_version/publish
    - Imweb header/footer save
    - operating DB write/import
    - VM Cloud schema migration/source ledger write
    - raw identifier report/chat/telegram/git output
  source_window_freshness_confidence:
    source: VM Cloud SQLite attribution_ledger aggregate
    window: leading-indicators API 1d/7d 주요 조합
    current_state: endpoint live, precompute disabled, live_cache_miss 1.8-2.8s
    target_state: in_memory_precompute cache hit <=500ms
    freshness: cache.cached_at_kst and next_refresh_at_kst in API response
    confidence: high for cache mechanics, medium for behavior interpretation
```

## 10초 요약

선행지표 API는 VM Cloud에 배포됐지만, 지금은 요청이 올 때마다 live 계산을 해서 첫 응답이 약 1.8-2.8초 걸린다.

이 승인안은 backend가 30분마다 주요 조합을 미리 계산해 메모리 캐시에 담고, 화면 요청은 그 캐시만 읽게 만드는 작업이다. 성공하면 `/ai-crm/leading-indicators` 화면을 정적 snapshot이 아니라 live API로 바꿔도 500ms 이하 응답을 기대할 수 있다.

권장 진행은 `2시간 제한 smoke ON`이다. 상시 ON은 smoke 결과가 안정적일 때 별도로 확정한다.

## 지금 상태

2026-05-19 01:03 KST 기준 P1 endpoint 배포는 완료됐다.

확인된 상태:

- `GET /api/attribution/leading-indicators` public 200.
- 4 cohort 응답 확인.
  - `confirmed_buyer`
  - `checkout_non_buyer`
  - `ga4_purchase_conflict`
  - `pending_payment_success`
- `safety.raw_identifier_output=false`.
- 외부 전송 0.
- 운영DB write 0.
- GTM publish 0.
- `LEADING_INDICATORS_PRECOMPUTE_ENABLED`는 OFF.
- public 첫 호출 응답은 `live_cache_miss`, 약 1.8-2.8초.

## 무엇을 켜는가

켜는 설정은 2개다.

```text
LEADING_INDICATORS_PRECOMPUTE_ENABLED=1
LEADING_INDICATORS_PRECOMPUTE_INTERVAL_MS=1800000
```

쉬운 뜻:

- `PRECOMPUTE_ENABLED=1`은 “선행지표 데이터를 미리 계산해두라”는 스위치다.
- `INTERVAL_MS=1800000`은 “30분마다 한 번씩 다시 계산하라”는 뜻이다.

코드는 이미 VM Cloud에 배포되어 있다. 이번 작업은 env를 켜고, backend를 restart한 뒤 캐시가 실제로 생성되는지 확인하는 것이다.

## 왜 필요한가

프론트가 live API를 직접 읽기 시작하면 사용자가 화면을 열 때마다 큰 계산을 돌리면 안 된다.

precompute cache가 필요한 이유:

1. 화면 응답 속도를 500ms 이하로 낮춘다.
2. 백엔드 hammer를 막는다.
3. 같은 숫자를 모든 사용자가 같은 기준 시각으로 보게 한다.
4. `데이터 기준 시각`과 `다음 갱신 시각`을 화면에 표시할 수 있다.

## 권장 승인 범위

### 1단계: 2시간 제한 smoke ON

권장 승인 문구:

```text
[승인] Leading Indicator precompute cache 2시간 smoke ON 진행.
LEADING_INDICATORS_PRECOMPUTE_ENABLED=1,
LEADING_INDICATORS_PRECOMPUTE_INTERVAL_MS=1800000 로 설정하고 seo-backend restart 후,
2시간 동안 cache hit 응답, memory/CPU/event-loop, API 200을 모니터링한다.
외부 전송, 운영DB write, GTM publish, raw identifier 출력은 금지한다.
stop criteria 발생 시 즉시 precompute OFF로 rollback한다.
```

이 승인은 Yellow Lane이다. 시간 제한과 rollback 조건이 있기 때문이다.

### 2단계: 상시 ON 후보

2시간 smoke가 통과하면 아래를 별도로 승인할 수 있다.

```text
[상시 승인] Leading Indicator precompute cache 상시 ON 유지.
조건: 2시간 smoke 동안 cache hit <=500ms, health 200, failed tick 0,
backend restart 추가 발생 없음, memory/event-loop stop criteria 미발생.
```

이 승인은 Red Lane에 가깝다. env flag가 운영 mode로 고착되기 때문이다.

## 실행 계획

### Step 1. Pre-snapshot

무엇을 하는가:

- 지금 backend 상태와 env 상태를 저장한다.

왜 하는가:

- 문제가 생기면 어떤 설정을 되돌려야 하는지 알아야 한다.

확인 항목:

```text
pm2 status seo-backend
/api/health
current env: LEADING_INDICATORS_PRECOMPUTE_ENABLED
current env: LEADING_INDICATORS_PRECOMPUTE_INTERVAL_MS
recent pm2 logs
current memory / CPU / event-loop latency
```

### Step 2. Controlled env ON + restart

무엇을 하는가:

- `seo-backend`에 precompute env를 켜고 restart한다.

예상 명령:

```bash
ssh -i ~/.ssh/id_ed25519 -o IdentitiesOnly=yes -o BatchMode=yes taejun@34.64.104.94 '
  sudo -n -u biocomkr_sns bash -lc "
    export PATH=/home/biocomkr_sns/seo/node/bin:\$PATH
    export LEADING_INDICATORS_PRECOMPUTE_ENABLED=1
    export LEADING_INDICATORS_PRECOMPUTE_INTERVAL_MS=1800000
    pm2 restart seo-backend --update-env
    pm2 save
  "
'
```

주의:

- 이 방식은 PM2 env update를 통해 실행 중인 process env를 갱신한다.
- 별도 `.env` 파일을 수정하지 않는다.
- 실패하면 즉시 OFF rollback으로 복귀한다.

### Step 3. 1차 smoke

확인할 API:

```text
https://att.ainativeos.net/api/health
https://att.ainativeos.net/api/attribution/leading-indicators?site=biocom&window=7d&channel=meta&dimension=buyer_vs_leaver
https://att.ainativeos.net/api/attribution/leading-indicators?site=thecleancoffee&window=7d&channel=meta&dimension=buyer_vs_leaver
```

성공 기준:

```text
/api/health 200
leading-indicators 200
schema_version=leading-indicators-v1
cache.source initially live_cache_miss or in_memory_precompute
raw identifier scan hit 0
safety.external_platform_send=0
safety.operating_db_write=0
safety.vm_cloud_write=0
safety.gtm_publish=0
```

### Step 4. Precompute tick 확인

무엇을 보는가:

- PM2 log에 아래 형태가 나와야 한다.

```text
[leading-indicators precompute] 활성화 — 30분 주기
[leading-indicators precompute] tick ok=8 failed=0 generation_ms=...
```

성공 기준:

```text
tick ok >= 8
failed = 0
generation_ms <= 5000 target
```

### Step 5. Cache hit 확인

무엇을 보는가:

- 같은 API를 2회 이상 호출했을 때 캐시 응답으로 바뀌는지 확인한다.

성공 기준:

```text
cache.cached=true
cache.source=in_memory_precompute
cache.cached_at_kst present
cache.next_refresh_at_kst present
response <= 500ms target
```

### Step 6. 2시간 monitor

30분 주기라 2시간이면 최소 4번 tick을 볼 수 있다.

확인 항목:

```text
tick count >= 4
failed tick = 0
/health 200 유지
seo-backend unexpected restart 0
public API 200 유지
memory 급증 없음
event-loop latency 급등 없음
```

## Stop criteria

아래 중 하나라도 발생하면 precompute를 끈다.

```text
/health non-200
leading-indicators API 5xx
precompute tick failed > 0 repeated
seo-backend unexpected restart >= 1
PM2 heap/memory 급증으로 OOM 위험
event-loop latency p95 지속 2초 초과
generation_ms 10초 초과 반복
cache response가 계속 1초 초과
raw identifier scan hit > 0
safety external send/write/publish 값이 0이 아님
```

## Rollback

OFF rollback 명령:

```bash
ssh -i ~/.ssh/id_ed25519 -o IdentitiesOnly=yes -o BatchMode=yes taejun@34.64.104.94 '
  sudo -n -u biocomkr_sns bash -lc "
    export PATH=/home/biocomkr_sns/seo/node/bin:\$PATH
    export LEADING_INDICATORS_PRECOMPUTE_ENABLED=0
    unset LEADING_INDICATORS_PRECOMPUTE_INTERVAL_MS
    pm2 restart seo-backend --update-env
    pm2 save
  "
'
```

Rollback 성공 기준:

```text
/api/health 200
pm2 seo-backend online
log contains leading-indicators precompute disabled
leading-indicators API 200 via live fallback
external send/write/publish 0 유지
```

## 하지 않는 것

이번 승인안으로 하지 않는 작업:

- Meta CAPI Purchase 전송.
- GA4 Measurement Protocol 전송.
- Google Ads/TikTok/Naver/Meta mutate.
- GTM submit/create_version/publish.
- Imweb header/footer 저장.
- 운영DB write/import.
- VM Cloud schema migration.
- source ledger write.
- raw order/payment/member/click/session id 출력.

## 완료 보고 형식

완료 보고에는 아래를 반드시 포함한다.

```text
판정: PRECOMPUTE_CACHE_SMOKE_PASS / PRECOMPUTE_CACHE_ROLLBACK_DONE / PRECOMPUTE_CACHE_BLOCKED
ON window: 시작/종료 KST
cache hit 여부와 응답 시간
tick ok/failed count
health 200 여부
PM2 restart 변화
memory/CPU/event-loop 특이사항
raw identifier scan 결과
external send/write/publish 0 여부
상시 ON 추천 여부
```

## Auditor Verdict

APPROVAL_PACKET_READY

이 승인안은 실제 env를 아직 켜지 않았다. TJ님이 위 승인 문구를 주면 Codex가 2시간 controlled smoke ON을 실행하고, stop criteria에 걸리면 즉시 OFF rollback한다.
