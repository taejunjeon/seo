# Leading Indicator Precompute Cache 2h Controlled Smoke Result

작성 시각: 2026-05-19 03:38 KST
대상: VM Cloud `seo-backend` / `GET /api/attribution/leading-indicators`
실행 성격: Yellow Lane 2시간 controlled smoke
판정: **CONTROLLED_SMOKE_PASS_WITH_RESTART_OBSERVED**

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - project/leading-indicator-precompute-cache-on-approval-20260519.md
    - project/leading-indicator-p1-vm-deploy-result-20260519.md
  lane:
    execution: Yellow
    permanent_on_decision: Red
  allowed_actions_executed:
    - VM Cloud seo-backend env pre-snapshot
    - LEADING_INDICATORS_PRECOMPUTE_ENABLED=1 controlled smoke
    - LEADING_INDICATORS_PRECOMPUTE_INTERVAL_MS=1800000 controlled smoke
    - seo-backend restart with update-env
    - read-only local API smoke
    - PM2 status/log monitor
    - controlled smoke 종료 후 LEADING_INDICATORS_PRECOMPUTE_ENABLED=0 rollback
  forbidden_actions_result:
    Meta_CAPI_send_backfill: 0
    GA4_Measurement_Protocol_send: 0
    Google_Ads_TikTok_Naver_Meta_mutate: 0
    GTM_submit_create_version_publish: 0
    Imweb_header_footer_save: 0
    operating_DB_write_import: 0
    VM_Cloud_schema_migration: 0
    raw_identifier_report_output: 0
  source_window_freshness_confidence:
    source: VM Cloud local API + PM2 logs
    smoke_window_kst: 2026-05-19 01:29:08 ~ 03:29:19
    cache_window: leading-indicators 7d major combinations
    confidence: high for cache mechanics, medium for restart attribution
```

## 10초 요약

선행지표 API 사전 계산 캐시는 2시간 동안 정상 동작했다.

사용자 요청 API는 전 구간 `in_memory_precompute`로 응답했고, 측정된 주요 API 응답 시간은 5-20ms였다. 30분 주기 precompute tick도 `ok=8 failed=0`으로 반복 성공했다.

단, smoke 중 `seo-backend` PM2 restart count가 1회 증가했다. PM2 로그상 max-memory restart는 아니고 backend/frontend가 동시에 `SIGINT`로 재시작된 형태라 precompute crash로 단정할 근거는 없다. 상시 ON은 가능해 보이지만, restart 원인 미확정 때문에 바로 영구화하기보다는 재가동 시 restart alert를 붙이는 것을 권장한다.

## 실행 결과

### Env ON/OFF

- ON 시작: 2026-05-19 01:22 KST 전후.
- v2 smoke 시작: 2026-05-19 01:29:08 KST.
- v2 smoke 종료: 2026-05-19 03:29:19 KST.
- controlled smoke 종료 후 `LEADING_INDICATORS_PRECOMPUTE_ENABLED=0`로 복귀.
- PM2 env에는 `LEADING_INDICATORS_PRECOMPUTE_INTERVAL_MS=1800000` 값이 남아 있으나, enabled가 0이라 worker는 비활성이다.

### 샘플 요약

| sample | KST | PM2 status | restart count | max API ms | cache source | raw key hit | safety |
|---:|---|---|---:|---:|---|---:|---|
| 0 | 01:29:08 | online | 4271 | 20 | in_memory_precompute | 0 | PASS |
| 1 | 01:44:09 | online | 4271 | 9 | in_memory_precompute | 0 | PASS |
| 2 | 01:59:11 | online | 4271 | 11 | in_memory_precompute | 0 | PASS |
| 3 | 02:14:12 | online | 4271 | 8 | in_memory_precompute | 0 | PASS |
| 4 | 02:29:13 | online | 4271 | 13 | in_memory_precompute | 0 | PASS |
| 5 | 02:44:14 | online | 4271 | 10 | in_memory_precompute | 0 | PASS |
| 6 | 02:59:15 | online | 4272 | 11 | in_memory_precompute | 0 | PASS |
| 7 | 03:14:16 | online | 4272 | 17 | in_memory_precompute | 0 | PASS |
| 8 | 03:29:18 | online | 4272 | 9 | in_memory_precompute | 0 | PASS |

대상 API:

- `biocom_meta_7d`
- `thecleancoffee_meta_7d`
- `thecleancoffee_channel_7d`

## Precompute Tick

관측된 tick:

```text
tick ok=8 failed=0 generation_ms=2422 next=1800s
tick ok=8 failed=0 generation_ms=2850 next=1800s
tick ok=8 failed=0 generation_ms=2444 next=1800s
tick ok=8 failed=0 generation_ms=2871 next=1800s
tick ok=8 failed=0 generation_ms=2702 next=1800s
```

해석:

- 30분마다 8개 조합을 사전 계산한다.
- 계산 시간은 약 2.4-2.9초였다.
- 사용자 요청은 이 계산을 기다리지 않고 메모리 캐시를 읽었다.

## Restart 관측

v2 smoke 중 PM2 restart count가 4271에서 4272로 1회 증가했다.

확인한 것:

- PM2 status는 재시작 후에도 online.
- API 응답은 재시작 후에도 200.
- 캐시 source는 재시작 후에도 `in_memory_precompute`.
- PM2 로그에서 해당 시점은 `max-memory-restart`가 아니라 backend/frontend 동시 `SIGINT` restart 형태였다.
- 사용자 요청 API는 restart 이후에도 6-17ms로 정상 응답했다.

해석:

- 기능 자체 실패로 보기는 어렵다.
- 다만 “2시간 동안 restart 0” 조건은 엄격하게는 만족하지 못했다.
- 상시 ON 전에는 restart 원인을 분리하거나, 상시 ON과 함께 restart alert를 붙이는 것이 안전하다.

## False Positive 롤백

초기 monitor script가 `/health` 응답의 `memberHash` 필드명을 raw identifier로 오인해 sample 0에서 false-positive rollback을 1회 수행했다.

조치:

- raw identifier scan 대상을 leading-indicators API 응답으로 제한했다.
- v2 smoke를 새로 시작했다.
- v2 smoke에서는 raw key hit 0을 유지했다.

해석:

- 실제 leading-indicators API의 raw identifier leak은 아니었다.
- smoke tooling bug였고, 보정 후 재실행했다.

## 종료 후 상태

controlled smoke 종료 후:

```text
LEADING_INDICATORS_PRECOMPUTE_ENABLED=0
/health 200
leading-indicators 200
cache.source=live_cache_miss
safety.raw_identifier_output=false
safety.external_platform_send=0
safety.operating_db_write=0
safety.vm_cloud_write=0
safety.gtm_publish=0
```

즉, smoke는 종료했고 상시 ON 상태로 방치하지 않았다.

## 결론

### 기능 판정

**PASS.**

precompute cache는 정상 작동했고, 프론트 사용자가 읽는 API는 2시간 동안 캐시 hit로 빠르게 응답했다.

### 운영 판정

**상시 ON은 가능성이 높지만, restart 1회 때문에 `조건부 승인`이 맞다.**

권장 조건:

1. `LEADING_INDICATORS_PRECOMPUTE_ENABLED=1` 상시 ON.
2. restart count 증가 alert 또는 6-12시간 follow-up monitor.
3. PM2 restart가 다시 증가하면 precompute와 무관한 외부 restart인지, max-memory restart인지 분리.

## 다음 액션

### TJ님이 할 일

1. 상시 ON 여부 결정.
   - 왜: 프론트가 live API를 안정적으로 쓰려면 cache가 켜져 있어야 한다.
   - 어떻게: 아래 승인 문구를 대화에 남긴다.
   - 승인 문구:
     ```text
     [승인] Leading Indicator precompute cache 상시 ON 진행.
     조건: 30분 precompute, restart alert/follow-up monitor 포함, 외부 전송/DB write/GTM publish 금지.
     ```
   - 성공 기준: `/ai-crm/leading-indicators`가 live API를 500ms 이하 캐시 응답으로 사용한다.
   - 실패 시 해석: restart count 증가 또는 API 500이 있으면 precompute OFF 후 원인 분리.
   - 추천 점수/자신감: 82%.

### Codex가 할 일

1. 상시 ON 승인 시 env를 다시 켜고 6-12시간 lightweight monitor를 붙인다.
   - 왜: smoke 중 restart 1회가 있었으므로 영구화 전후를 관찰해야 한다.
   - 어떻게: `LEADING_INDICATORS_PRECOMPUTE_ENABLED=1`, interval 30분, PM2 restart count/health/cache source만 30분 단위로 기록한다.
   - 의존성: TJ님 상시 ON 승인.
   - 성공 기준: cache hit 유지, tick failed 0, restart 증가 0 또는 원인 분리.
   - 실패 시 다음 확인점: PM2 max-memory 로그, 외부 restart, live API hammer, Imweb sync cron.
   - 승인 필요 여부: 필요.
   - 추천 점수/자신감: 82%.
