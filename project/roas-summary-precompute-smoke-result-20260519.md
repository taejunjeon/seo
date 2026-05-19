# ROAS Summary Precompute 2h Controlled Smoke Result

작성 시각: 2026-05-19 20:30 KST  
기준일: 2026-05-19  
문서 성격: Yellow Lane 2시간 controlled smoke 결과보고  
대상: VM Cloud `seo-backend` / `GET /api/ads/roas-summary`  
대상 site/account: biocom / Meta account `act_...2376`  
판정: **CONTROLLED_SMOKE_PASS_AND_CLEANED_UP**

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
  lane:
    controlled_smoke_execution: Yellow
    permanent_on_decision: Red
  allowed_actions_executed:
    - VM Cloud seo-backend PM2/env read-only snapshot
    - ROAS_SUMMARY_PRECOMPUTE_ENABLED=1 controlled smoke observation
    - ROAS summary precompute tick log observation
    - roas-summary API latency/cache verification
    - controlled smoke 종료 후 ROAS_SUMMARY_PRECOMPUTE_ENABLED=0 cleanup
    - cleanup 후 backend health/API verification
    - heartbeat automation 종료
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
    smoke_window_kst: 2026-05-19 18:16 이전 시작 ~ 20:20 final tick 확인
    post_deploy_effective_tick_window_kst: 2026-05-19 19:19 ~ 20:19
    data_window: biocom KST 완료일 기준 last_3d,last_7d,last_30d
    freshness: 2026-05-19 20:24 KST verification
    confidence: high for cache mechanics, high for cleanup state, medium for long-term memory behavior
```

## 10초 요약

ROAS summary 사전계산 2시간 controlled smoke는 통과했다.

사용자 조회 API는 precompute cache 상태에서 `0.331s`로 응답했고, 재시작 이후 관측된 ROAS summary precompute tick 3회가 모두 `ok=1 failed=0`이었다. backend memory는 1.5GB 중단 기준보다 훨씬 낮은 약 307MB 수준이었다.

승인 범위는 2시간 smoke였으므로, 상시 ON으로 방치하지 않았다. 종료 후 `ROAS_SUMMARY_PRECOMPUTE_ENABLED=0`으로 cleanup했고, cleanup restart 후 backend health와 ROAS summary API 200을 확인했다.

## 실행 결과

### Env ON/OFF

- smoke 승인 범위: `ROAS_SUMMARY_PRECOMPUTE_ENABLED=1`, 30분 주기, biocom `act_...2376`, preset group `last_3d,last_7d,last_30d`.
- 2026-05-19 18:47 KST backend 배포 restart로 `seo-backend` restart count가 4281까지 증가했다. 이 재시작은 별도 승인된 배포 재시작이라 smoke 실패로 보지 않았다.
- post-deploy 기준 tick은 19:19, 19:49, 20:19 KST 3회 확인했다.
- controlled smoke 종료 후 `ROAS_SUMMARY_PRECOMPUTE_ENABLED=0`으로 cleanup했다.
- cleanup restart로 `seo-backend` restart count는 4282가 됐다. 이는 실패가 아니라 승인 범위 종료 정리 절차다.
- PM2 env에는 interval/target/group 값이 남아 있지만, enabled가 0이라 worker는 비활성이다.

### 샘플 요약

| sample | KST | PM2 status | restart count | memory | API ms | cache source | tick | safety |
|---:|---|---|---:|---:|---:|---|---|---|
| 1 | 19:26 | online | 4281 | 301.9MB | 292 | in_memory_precompute | 19:19 ok=1 failed=0 | PASS |
| 2 | 19:56 | online | 4281 | 303.8MB | 394 | in_memory_precompute | 19:49 ok=1 failed=0 | PASS |
| 3 | 20:20 | online | 4281 | 307.3MB | 331 | in_memory_precompute | 20:19 ok=1 failed=0 | PASS |
| cleanup | 20:23 | online | 4282 | 367.2MB | 54,304 | live_cache_miss | disabled | PASS_WITH_NOTES |
| cleanup recheck | 20:24 | online | 4282 | 367.2MB | 323 | in_memory_precompute | disabled | PASS |

cleanup 직후 첫 조회가 `54.304s live_cache_miss`였던 것은 예상된 동작이다. precompute를 끄고 backend를 재시작했기 때문에 메모리 캐시가 비었고, 첫 요청자가 다시 live 계산을 수행했다. 직후 재조회는 `0.323s in_memory_precompute`로 회복했다.

## Precompute Tick

관측된 post-deploy tick:

```text
2026-05-19 19:19:49 KST [ROAS summary precompute] ok account=*2376 presets=last_3d,last_7d,last_30d source=live_force_refresh generationMs=50157
2026-05-19 19:19:49 KST [ROAS summary precompute] tick — ok=1 failed=0 next=1800s
2026-05-19 19:49:42 KST [ROAS summary precompute] ok account=*2376 presets=last_3d,last_7d,last_30d source=live_force_refresh generationMs=43220
2026-05-19 19:49:42 KST [ROAS summary precompute] tick — ok=1 failed=0 next=1800s
2026-05-19 20:19:48 KST [ROAS summary precompute] ok account=*2376 presets=last_3d,last_7d,last_30d source=live_force_refresh generationMs=49404
2026-05-19 20:19:48 KST [ROAS summary precompute] tick — ok=1 failed=0 next=1800s
```

해석:

- 30분마다 `last_3d,last_7d,last_30d` 묶음을 사전 계산했다.
- 계산 시간은 약 43-50초였다.
- 사용자 요청은 계산 결과 메모리 캐시를 읽으면 0.3-0.4초대로 응답했다.
- 같은 기간 API 500/502, tick 연속 실패, memory 1.5GB 초과는 관측되지 않았다.

## 종료 후 상태

controlled smoke 종료 후:

```text
ROAS_SUMMARY_PRECOMPUTE_ENABLED=0
seo-backend online
restart count=4282
/health HTTP 200 / 0.284s
/api/ads/roas-summary first check HTTP 200 / 54.304s / live_cache_miss
/api/ads/roas-summary recheck HTTP 200 / 0.323s / in_memory_precompute
```

즉, smoke는 종료했고 상시 ON 상태로 방치하지 않았다.

## 결론

### 기능 판정

**PASS.**

ROAS summary precompute는 화면 로딩 체감 문제를 줄이는 데 효과가 있다. 캐시가 준비된 상태에서는 `last_3d,last_7d,last_30d` 묶음 조회가 1초 안쪽으로 응답했다.

### 운영 판정

**상시 ON은 가능성이 높지만 별도 명시 승인이 필요하다.**

이번 controlled smoke에서 확인된 점:

1. restart count는 승인된 배포 재시작 4281 이후 추가 증가하지 않았다.
2. memory는 1.5GB 중단 기준보다 낮았다.
3. precompute tick 3회가 모두 성공했다.
4. 사용자 조회 API는 precompute cache hit에서 0.3초대로 응답했다.

다만 상시 ON은 운영 env flag를 계속 켜 두는 결정이다. 승인안에서 Red Lane으로 분류했으므로, TJ님 명시 승인 전에는 다시 켜지 않는다.

## 금지선 준수

| 항목 | 결과 |
|---|---|
| 외부 광고 플랫폼 전환 send | 0 |
| 운영DB write/import | 0 |
| VM Cloud SQLite 직접 write | 0 |
| GTM submit/create version/publish | 0 |
| raw 주문/결제/고객 식별자 출력 | 0 |
| 배포 | 0 |
| PM2 restart | cleanup 목적으로 1회, 승인된 smoke 종료 범위 |

## 남은 리스크

| 리스크 | 영향 | 대응 |
|---|---|---|
| precompute OFF 상태에서는 backend 재시작 직후 첫 조회가 다시 느리다 | 첫 사용자 화면이 40-60초 대기할 수 있음 | 상시 ON 승인 시 4시간 주기 precompute로 완화 |
| tick 계산 시간이 43-50초로 짧지는 않다 | Meta API/ledger 부하가 너무 잦으면 부담 가능 | 상시 ON은 30분이 아니라 4시간 주기로 낮추는 안이 적절 |
| 장기 메모리 안정성은 2시간만 확인했다 | 24시간 이상 추세는 아직 모름 | 상시 ON 시 24시간 lightweight monitor 권장 |

## 다음 액션

### TJ님이 할 일

1. ROAS summary 상시 ON 승인 여부를 결정한다.
   - 무엇을 하는가: ROAS summary 사전계산을 4시간 주기로 상시 켤지 승인한다.
   - 왜 하는가: backend 재시작 직후 첫 사용자가 50초대 live 계산을 맞는 문제를 줄인다.
   - 어떻게 하는가: 아래 승인 문구를 대화에 남긴다.
   - 승인 문구:
     ```text
     [상시 승인] ROAS summary precompute 상시 ON 진행.
     4시간 주기, targets는 biocom act_...2376, preset groups는 last_3d,last_7d,last_30d 및 last_7d로 제한.
     중단 기준 발생 시 즉시 OFF 롤백하고 보고.
     ```
   - 성공 기준: 재시작 후에도 `/api/ads/roas-summary`가 cache hit 기준 1초 안팎으로 응답한다.
   - 실패 시 확인점: restart count 증가, memory 1.5GB 초과, Meta API rate limit, tick failed 반복.
   - Codex가 대신 못 하는 이유: 상시 ON은 운영 env flag를 계속 켜 두는 Red Lane 결정이라 TJ님 명시 승인이 필요하다.
   - 추천 점수/자신감: 88%.

### Codex가 할 일

1. 상시 ON 승인 시 4시간 주기로 env를 다시 켜고 24시간 lightweight monitor를 붙인다.
   - 무엇을 하는가: `ROAS_SUMMARY_PRECOMPUTE_ENABLED=1`, interval `14400000`, targets `act_...2376`, preset groups `last_3d,last_7d,last_30d|last_7d`로 운영한다.
   - 왜 하는가: 사용자 화면은 빠르게 유지하면서 Meta API 호출 빈도는 줄인다.
   - 어떻게 하는가: VM Cloud PM2 env update, restart, 첫 tick/API smoke, 24시간 restart/memory/API cache 확인을 순서대로 수행한다.
   - 의존성: TJ님 상시 ON 승인.
   - 성공 기준: tick failed 0, restart 증가 없음, memory 1.5GB 미만, API 200/cache hit 1초 안팎.
   - 실패 시 다음 확인점: PM2 max-memory 로그, Meta API rate limit, ledger fetch latency, in-memory cache TTL.
   - 승인 필요 여부: 필요.
   - 추천 점수/자신감: 88%.

