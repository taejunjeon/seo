# ROAS Summary Precompute Permanent ON Result

작성 시각: 2026-05-19 20:37 KST
기준일: 2026-05-19
문서 성격: ROAS summary 상시 사전계산 운영 반영 결과보고
대상: VM Cloud `seo-backend` / `GET /api/ads/roas-summary`
대상 site/account: biocom / Meta account `act_...2376`
판정: **PERMANENT_ON_APPLIED_WITH_24H_MONITOR**

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - project/roas-summary-precompute-permanent-on-approval-20260519.md
    - project/roas-summary-precompute-smoke-result-20260519.md
  lane:
    permanent_on_execution: Red approved by TJ
    follow_up_monitor: Yellow approved scope
  allowed_actions_executed:
    - VM Cloud seo-backend PM2/env/API pre-snapshot
    - ROAS_SUMMARY_PRECOMPUTE_ENABLED=1 상시 ON
    - ROAS_SUMMARY_PRECOMPUTE_INTERVAL_MS=14400000 적용
    - ROAS_SUMMARY_PRECOMPUTE_PRESET_GROUPS=last_3d,last_7d,last_30d|last_7d 적용
    - seo-backend restart with update-env
    - pm2 save
    - first tick/API/cache verification
    - 24시간 heartbeat monitor 생성
  forbidden_actions_result:
    Meta_CAPI_send_backfill: 0
    GA4_Measurement_Protocol_send: 0
    Google_Ads_TikTok_Naver_Meta_mutate: 0
    GTM_submit_create_version_publish: 0
    operating_DB_write_import: 0
    VM_Cloud_SQLite_direct_write: 0
    raw_identifier_report_output: 0
  source_window_freshness_confidence:
    source: VM Cloud PM2 env/status/logs + https://att.ainativeos.net/api/ads/roas-summary
    data_window: biocom KST 완료일 기준 last_3d,last_7d,last_30d and last_7d
    freshness: 2026-05-19 20:35 KST verification
    confidence: high for activation/cache mechanics, medium for 24h memory trend
```

## 10초 요약

ROAS summary 사전계산을 상시 ON으로 반영했다.

백엔드는 4시간마다 biocom Meta account `act_...2376`의 `last_3d,last_7d,last_30d` 묶음과 `last_7d` 단독 조회를 미리 계산한다. 첫 상시 tick은 `ok=2 failed=0`으로 끝났고, 사용자 조회 API는 cache hit 기준 `0.329s`, `0.372s`로 응답했다.

24시간 lightweight monitor도 연결했다. restart count, memory, tick 실패, API 500/502, Meta API rate limit이 발생하면 즉시 OFF rollback 기준으로 본다.

## 적용한 운영 설정

```text
ROAS_SUMMARY_PRECOMPUTE_ENABLED=1
ROAS_SUMMARY_PRECOMPUTE_INTERVAL_MS=14400000
ROAS_SUMMARY_PRECOMPUTE_START_DELAY_MS=30000
ROAS_SUMMARY_PRECOMPUTE_TIMEOUT_MS=80000
ROAS_SUMMARY_PRECOMPUTE_TARGETS=act_3138805896402376
ROAS_SUMMARY_PRECOMPUTE_PRESET_GROUPS=last_3d,last_7d,last_30d|last_7d
```

의미:

- 4시간마다 백엔드가 ROAS summary를 미리 계산한다.
- `last_3d,last_7d,last_30d` 묶음은 `/ads/meta-utm` 상단 요약에 필요하다.
- `last_7d` 단독은 `/ads` 또는 단일 7일 요약 호출의 cold miss를 줄이기 위한 별도 group이다.
- `today`, `yesterday`는 이번 상시 ON 범위에 넣지 않았다. 현재 화면 기준이 “KST 완료일 기준, 오늘 제외”이기 때문이다.

## 적용 결과

### PM2/env

| 항목 | 적용 전 | 적용 후 |
|---|---|---|
| `ROAS_SUMMARY_PRECOMPUTE_ENABLED` | `0` | `1` |
| interval | `1800000` | `14400000` |
| preset groups | `last_3d,last_7d,last_30d` | `last_3d,last_7d,last_30d|last_7d` |
| `seo-backend` restart count | 4282 | 4283 |
| `seo-backend` status | online | online |
| 적용 후 memory | 약 280.4MB | 1.5GB 중단 기준 미만 |

restart count `4283`은 상시 ON 적용을 위한 승인된 `pm2 restart --update-env` 결과다.

### 첫 상시 tick

```text
2026-05-19 20:30:42 KST [ROAS summary precompute] 활성화 — 240분 주기 (1 accounts × last_3d,last_7d,last_30d/last_7d)
2026-05-19 20:32:14 KST [ROAS summary precompute] ok account=*2376 presets=last_3d,last_7d,last_30d source=live_force_refresh generationMs=62203
2026-05-19 20:32:51 KST [ROAS summary precompute] ok account=*2376 presets=last_7d source=live_force_refresh generationMs=36250
2026-05-19 20:32:51 KST [ROAS summary precompute] tick — ok=2 failed=0 next=14400s
```

해석:

- 두 preset group 모두 첫 계산에 성공했다.
- 다음 자동 갱신은 약 4시간 뒤다.
- 계산 시간은 batch group 62.2초, `last_7d` 단독 36.3초였다.

### 사용자 API 확인

| 요청 | HTTP | 응답 시간 | cache source | ledger fetch | source confidence |
|---|---:|---:|---|---:|---|
| `presets=last_3d,last_7d,last_30d` | 200 | 0.329s | `in_memory_precompute` | 0 | A |
| `presets=last_7d` | 200 | 0.372s | `in_memory_precompute` | 0 | A |

## 24시간 monitor

생성한 automation:

```text
automation_id: roas-summary-permanent-monitor
schedule: 4시간 간격, 7회
```

monitor 확인 항목:

- PM2 `seo-backend` status/restart count/memory
- PM2 env `ROAS_SUMMARY*`
- 최근 `ROAS summary precompute` tick
- `presets=last_3d,last_7d,last_30d` API latency/cache
- `presets=last_7d` API latency/cache

rollback 기준:

1. restart count가 기준 `4283` 이후 추가 증가한다.
2. backend memory가 1.5GB 초과로 유지된다.
3. API 500/502가 발생한다.
4. precompute tick이 실패한다.
5. Meta API timeout/rate limit이 반복된다.

## 금지선 준수

| 항목 | 결과 |
|---|---|
| 외부 광고 플랫폼 전환 send | 0 |
| 운영DB write/import | 0 |
| VM Cloud SQLite 직접 write | 0 |
| GTM submit/create version/publish | 0 |
| raw 주문/결제/고객 식별자 출력 | 0 |
| backend code deploy | 0 |
| PM2 restart | 1회, TJ님 승인된 상시 ON env 적용 목적 |

## 남은 리스크

| 리스크 | 영향 | 대응 |
|---|---|---|
| 장기 메모리 추세는 아직 24시간 완료 전 | 장시간 운영 중 memory 상승 가능성 | `roas-summary-permanent-monitor`로 24시간 관찰 |
| Meta API rate limit 가능성 | tick 실패 또는 stale cache 가능 | 4시간 주기로 호출 빈도를 낮췄고, 실패 시 rollback |
| 재시작 직후 첫 tick 계산은 1분 안팎 소요 | 적용 직후 첫 1분은 live 계산 중일 수 있음 | 첫 tick 완료 후 API cache hit 검증 완료 |

## 다음 액션

### TJ님이 할 일

현재 즉시 할 일은 없다.

24시간 monitor가 중단 기준을 잡으면 Codex가 rollback하고 보고한다. 2026-05-20 저녁까지 restart/memory/tick 문제가 없으면 이 설정을 유지하는 쪽이 맞다.

### Codex가 할 일

1. 24시간 monitor 결과를 정리한다.
   - 무엇을 하는가: `roas-summary-permanent-monitor`가 4시간마다 status/API/tick을 확인한다.
   - 왜 하는가: 상시 ON이 장시간에도 안정적인지 확인해야 한다.
   - 어떻게 하는가: heartbeat automation으로 PM2/env/log/API를 read-only 확인하고, 중단 기준 발생 시 OFF rollback한다.
   - 의존성: 없음. 이미 automation 생성 완료.
   - 성공 기준: restart 추가 증가 0, memory 1.5GB 미만, tick failed 0, API 200/cache hit 유지.
   - 실패 시 다음 확인점: PM2 max-memory 로그, Meta API rate limit, ledger fetch latency.
   - 승인 필요 여부: 없음. 승인된 범위 안의 monitor/rollback이다.
   - 추천 점수/자신감: 90%.
