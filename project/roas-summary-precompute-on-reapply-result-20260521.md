작성 시각: 2026-05-21 17:12 KST
기준일: 2026-05-21
문서 성격: ROAS summary precompute 상시 ON 재적용 결과보고

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - project/roas-summary-precompute-off-env-drift-analysis-20260521.md
    - project/roas-summary-precompute-permanent-on-result-20260519.md
  required_context_docs:
    - capivm/ecosystem.config.cjs
    - backend/src/bootstrap/startBackgroundJobs.ts
  lane: Red approved by TJ
  allowed_actions_executed:
    - capivm/ecosystem.config.cjs ROAS_SUMMARY_PRECOMPUTE_ENABLED=1
    - VM Cloud backend .env ON 유지 확인
    - PM2 runtime env ON reapply
    - seo-backend restart --update-env
    - pm2 save
    - first tick/API/cache verification
  forbidden_actions_result:
    Google_Ads_conversion_upload: 0
    GA4_measurement_protocol_send: 0
    Meta_CAPI_manual_send: 0
    운영DB_write: 0
    GTM_publish: 0
  source_window_freshness_confidence:
    source: VM Cloud PM2 env/dump/log + public ROAS summary API
    window: 2026-05-21 17:04~17:11 KST
    freshness: 2026-05-21 17:12 KST
    confidence: 0.97
```

## 10초 요약

ROAS summary precompute 상시 ON을 다시 정상화했다.

문제는 `.env`만 ON이고 PM2 runtime/dump/ecosystem이 OFF인 설정 drift였다. 이번에는 세 곳을 모두 ON으로 맞췄고, 첫 자동 tick이 `ok=2 failed=0`으로 끝났다. `/api/ads/roas-summary`는 다시 `in_memory_precompute`, `stale=false`로 응답한다.

## 적용한 것

- local `capivm/ecosystem.config.cjs`: `ROAS_SUMMARY_PRECOMPUTE_ENABLED: "1"`.
- VM Cloud `capivm/ecosystem.config.cjs`: `ROAS_SUMMARY_PRECOMPUTE_ENABLED: "1"`.
- VM Cloud `backend/.env`: `ROAS_SUMMARY_PRECOMPUTE_ENABLED=1`.
- PM2 runtime env:
  - `ROAS_SUMMARY_PRECOMPUTE_ENABLED=1`
  - `ROAS_SUMMARY_PRECOMPUTE_INTERVAL_MS=14400000`
  - `ROAS_SUMMARY_PRECOMPUTE_START_DELAY_MS=240000`
  - `ROAS_SUMMARY_PRECOMPUTE_TIMEOUT_MS=80000`
  - `ROAS_SUMMARY_PRECOMPUTE_TARGETS=act_3138805896402376`
  - `ROAS_SUMMARY_PRECOMPUTE_PRESET_GROUPS=last_3d,last_7d,last_30d|last_7d`
- PM2 dump: 같은 ON 값으로 저장.

## 재시작

- 승인된 재적용 전 관측: restart count `4308`, `ROAS_SUMMARY_PRECOMPUTE_ENABLED=0`.
- 재적용 후: restart count `4309`, `ROAS_SUMMARY_PRECOMPUTE_ENABLED=1`.
- 상태: online.
- memory: 약 627 MB.
- backup: `/home/biocomkr_sns/seo/repo/.deploy-backups/roas-summary-precompute-on-20260521T080439Z`.

## 첫 tick 결과

```text
2026-05-21 17:04:43 KST [ROAS summary precompute] 활성화 — 240분 주기 (1 accounts × last_3d,last_7d,last_30d/last_7d)
2026-05-21 17:09:34 KST [ROAS summary precompute] ok account=*2376 presets=last_3d,last_7d,last_30d source=live_force_refresh generationMs=51106
2026-05-21 17:10:22 KST [ROAS summary precompute] ok account=*2376 presets=last_7d source=live_force_refresh generationMs=48330
2026-05-21 17:10:22 KST [ROAS summary precompute] tick — ok=2 failed=0 next=14400s
```

## API 검증

### last_3d,last_7d,last_30d

- HTTP: 200.
- latency: 0.239초.
- cache source: `in_memory_precompute`.
- stale: `false`.
- cached_at: 2026-05-21 17:09 KST.
- next_refresh: 2026-05-21 21:09 KST.

### last_7d

- HTTP: 200.
- latency: 0.258초.
- cache source: `in_memory_precompute`.
- stale: `false`.
- cached_at: 2026-05-21 17:10 KST.
- next_refresh: 2026-05-21 21:10 KST.

## 금지선

- Google Ads conversion upload: 0.
- GA4 Measurement Protocol purchase send: 0.
- Meta CAPI manual send: 0.
- 운영DB write: 0.
- GTM publish: 0.
- backend code deploy: 0.
- PM2 restart: 1회, TJ님 승인된 precompute 상시 ON 재적용 목적.

## 남은 리스크

1. restart count `4308`이 재적용 직전 이미 발생해 있었다. 이번 작업으로 만든 restart는 `4309`다.
2. memory는 627 MB로 기준 1.5 GB 미만이지만, 다음 4시간 tick 후에도 확인하면 더 좋다.
3. `capivm/ecosystem.config.cjs`를 로컬에서도 수정했으므로 다음 커밋에 포함해야 drift가 재발하지 않는다.

## 다음 할일

### TJ님이 할 일

현재 ROAS precompute 관련 즉시 할 일은 없다.

### Codex가 할 일

다음 4시간 tick 이후 restart count가 추가 증가하지 않고, cache가 계속 `in_memory_precompute`, `stale=false`인지 read-only로 확인한다. 이 확인은 Green Lane이므로 별도 승인 없이 진행 가능하다.
