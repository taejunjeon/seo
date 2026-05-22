작성 시각: 2026-05-21 16:56 KST
기준일: 2026-05-21
문서 성격: ROAS summary precompute OFF 원인분석

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - project/roas-summary-precompute-permanent-on-result-20260519.md
    - project/roas-summary-precompute-restart-4298-analysis-20260520.md
  required_context_docs:
    - capivm/ecosystem.config.cjs
    - backend/src/env.ts
    - backend/src/bootstrap/startBackgroundJobs.ts
  lane: Green
  allowed_actions:
    - VM Cloud read-only PM2/env/log/API inspection
    - local source inspection
    - analysis document
  forbidden_actions:
    - ROAS_SUMMARY_PRECOMPUTE_ENABLED mutation
    - PM2 restart
    - pm2 save
    - Google Ads/Meta/GA4 platform send
    - 운영DB write
  source_window_freshness_confidence:
    source: VM Cloud PM2 env/dump/.env/log + public ROAS summary API + local source
    window: 2026-05-21 16:43~16:56 KST
    freshness: 2026-05-21 16:56 KST
    confidence: 0.94
```

## 10초 요약

ROAS summary precompute는 코드 문제로 꺼진 것이 아니라, PM2 런타임 env가 `.env`보다 우선하면서 꺼진 상태가 유지됐다.

VM Cloud의 `backend/.env`에는 `ROAS_SUMMARY_PRECOMPUTE_ENABLED=1`이 있지만, 실제 실행 중인 `seo-backend` PM2 env와 PM2 dump에는 `0`이 저장되어 있다. backend는 시작 시 `dotenv.config()`를 쓰지만 기본 동작이 기존 `process.env`를 덮어쓰지 않으므로, PM2의 `0`이 `.env`의 `1`을 가렸다.

상시 ON 자체는 유지하는 것이 맞다. 다만 다시 꺼지지 않게 하려면 PM2 런타임 env뿐 아니라 PM2 dump와 `capivm/ecosystem.config.cjs`의 hardcoded OFF도 함께 정리해야 한다.

## 관측값

### 현재 VM Cloud 상태

- `seo-backend`: online.
- restart count: `4307`.
- memory: 약 271 MB.
- `pm2 env 0`: `ROAS_SUMMARY_PRECOMPUTE_ENABLED: 0`.
- `backend/.env`: line 222 `ROAS_SUMMARY_PRECOMPUTE_ENABLED=1`.
- PM2 dump: `seo-backend`의 `ROAS_SUMMARY_PRECOMPUTE_ENABLED`가 `"0"`.
- `capivm/ecosystem.config.cjs`: `ROAS_SUMMARY_PRECOMPUTE_ENABLED: "0"` hardcoded.

### API 상태

- 요청: `https://att.ainativeos.net/api/ads/roas-summary?account_id=act_3138805896402376&presets=last_7d`
- HTTP: 200.
- latency: 약 0.28초.
- cache source: `stale_fallback`.
- cache stale: `true`.
- 의미: 화면 응답은 빠르지만 상시 사전계산이 fresh cache를 갱신 중인 상태는 아니다.

### 로그 상태

최근 `seo-backend` 로그에는 `ROAS summary precompute` tick이 보이지 않는다.
대신 `Meta UTM precompute`는 계속 돌고 있다. 이는 ROAS summary만 PM2 env OFF 때문에 스케줄러가 시작되지 않은 상태와 맞다.

## 원인

### 1. PM2 env가 `.env`보다 우선했다

backend는 `backend/src/env.ts`에서 `dotenv.config({ quiet: true })`를 호출한다.
dotenv 기본 동작은 이미 존재하는 `process.env` 값을 덮어쓰지 않는다.

따라서 PM2가 `ROAS_SUMMARY_PRECOMPUTE_ENABLED=0`을 process env로 넘기면, `.env`의 `1`은 적용되지 않는다.

### 2. PM2 dump에 OFF가 저장되어 재시작 후에도 유지됐다

`/home/biocomkr_sns/.pm2/dump.pm2`의 `seo-backend` env에도 `"ROAS_SUMMARY_PRECOMPUTE_ENABLED":"0"`이 남아 있다.

최근 backend deploy에서 `pm2 restart seo-backend --update-env`와 `pm2 save`가 실행되면서 현재 PM2 env가 그대로 저장됐다. 이 과정은 deploy 자체의 실패가 아니라, 이미 PM2 env에 남아 있던 OFF 값이 보존된 것이다.

### 3. ecosystem config에도 OFF가 남아 있어 다시 꺼질 위험이 있다

`capivm/ecosystem.config.cjs`에는 `ROAS_SUMMARY_PRECOMPUTE_ENABLED: "0"`이 hardcoded되어 있다.

나중에 이 ecosystem 기준으로 start/reload/save가 실행되면, `.env`가 ON이어도 다시 OFF로 돌아갈 수 있다.

## 왜 이런 상태가 생겼나

2026-05-20 문서 기준으로는 stale monitor가 승인된 backend deploy 재시작을 장애로 오해해 precompute를 OFF했다.
이후 한 번 ON으로 복구했지만, PM2 런타임 env/dump/ecosystem이 같은 정본으로 정리되지 않았다.

그 결과 `.env`만 ON이고 실제 process env는 OFF인 drift가 남았다. 이후 backend 배포와 `pm2 save`가 이 drift를 다시 고정했다.

## 판단

상시 ON은 유지하는 것이 맞다.

이 기능은 `/ads`와 `/ads/meta-utm`에서 첫 live miss를 줄이고, Meta API 호출이 사용자 요청에 몰리는 것을 막는 장치다. 현재처럼 OFF이면 화면은 stale cache로 빠르게 보일 수 있지만, fresh cache 갱신이 멈춰 데이터 신선도가 떨어진다.

## 재적용 권장안

재적용은 단순히 PM2 env만 바꾸면 부족하다.

1. `capivm/ecosystem.config.cjs`의 `ROAS_SUMMARY_PRECOMPUTE_ENABLED`를 `"1"`로 바꾼다.
2. VM Cloud `seo-backend` PM2 env를 `ROAS_SUMMARY_PRECOMPUTE_ENABLED=1`로 다시 적용한다.
3. `pm2 restart seo-backend --update-env`로 재시작한다.
4. `pm2 save`로 dump를 갱신한다.
5. 4분 start delay 후 첫 tick을 확인한다.
6. `roas-summary` public API가 `in_memory_precompute` 또는 fresh cache로 돌아오는지 확인한다.

## 금지선

- 이 문서 작성 중 PM2 env 변경은 하지 않았다.
- backend restart는 하지 않았다.
- PM2 save는 하지 않았다.
- 광고 플랫폼 전송은 하지 않았다.
- 운영DB write는 하지 않았다.

## 다음 할일

### TJ님이 할 일

ROAS summary precompute 상시 ON 재적용을 승인할지 결정한다. 바꾸는 설정은 `ROAS_SUMMARY_PRECOMPUTE_ENABLED=1`이며, 효과는 `/ads` ROAS summary fresh cache를 4시간마다 자동 갱신하는 것이다. 안 바꾸면 화면은 계속 stale cache에 기대고, 다음 live miss 때 다시 긴 계산이 발생할 수 있다.

### Codex가 할 일

승인되면 PM2 runtime env, PM2 dump, `capivm/ecosystem.config.cjs`를 같은 ON 상태로 맞추고 4분 뒤 첫 tick/API cache를 확인한다. 성공 기준은 `pm2 env 0`과 dump가 모두 `1`, 로그에 `ROAS summary precompute 활성화` 및 `tick ok`, API cache가 fresh hit로 바뀌는 것이다.
