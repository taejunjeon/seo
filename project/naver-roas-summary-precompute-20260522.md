---
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - AGENTS.md
    - docurule.md
  required_context_docs:
    - project/naver-ads-daily-cron-sync-design-20260522.md
  lane: Green
  allowed_actions:
    - local_backend_code_change
    - local_frontend_code_change
    - local_api_smoke
    - browser_smoke
    - no_send_no_write_precompute_design
  forbidden_actions:
    - VM_Cloud_deploy_without_approval
    - production_DB_write
    - external_platform_send
    - GTM_publish
    - secret_logging
  source_window_freshness_confidence:
    source: "local backend + local SQLite, VM Cloud deploy not performed"
    window: "Naver campaign-summary 2026-05-15~2026-05-21 and 2026-04-22~2026-05-21 smoke"
    freshness: "2026-05-22 17:54 KST local smoke"
    confidence: "high for local speed behavior, medium for 운영 before VM Cloud deploy"
---

작성 시각: 2026-05-22 17:54 KST
기준일: 2026-05-22
문서 성격: Naver ROAS 화면 계산 지연 개선 결과 메모

## 10초 요약

Naver ROAS 화면이 느린 주된 이유는 광고비 집계가 아니라 내부 결제완료 매출 연결 계산을 화면 요청마다 다시 돌리기 때문이다.

이번 조치로 `campaign-summary` 응답을 15분 TTL 캐시에 저장하고, 백엔드가 켜진 운영 모드에서는 7일/30일/90일 기본 조합을 self-fetch로 미리 계산한다. 로컬 검증에서는 첫 7일 조회 12.08초가 두 번째 조회 0.01초로 줄었다.

운영 반영은 아직 하지 않았다. VM Cloud 배포 후 `NAVER_ADS_SUMMARY_PRECOMPUTE_ENABLED`가 꺼져 있지 않은지와 첫 tick 로그를 확인해야 한다.

## 변경 요약

| 항목 | 내용 |
|---|---|
| 느린 지점 | `/api/ads/naver/campaign-summary`가 요청마다 `monthly-evidence-join-dry-run.ts`를 실행 |
| 백엔드 변경 | route lazy cache, inflight coalescing, stale fallback, summary cache metadata 추가 |
| precompute 변경 | `naverAdsSummaryPrecompute.ts` 추가. 기본 15분 주기, biocom 7/30/90일 조합 self-fetch |
| 프론트 변경 | `/ads/naver`에 `요약 계산 cache` 상태 카드 추가 |
| 외부 영향 | 없음. no-send, no-write, no-deploy |

## 검증 결과

| 검증 | 결과 | 기준 |
|---|---|---|
| backend typecheck | PASS | `npx tsc --noEmit --pretty false` |
| frontend lint | PASS | `npx eslint src/app/ads/naver/page.tsx` |
| 7일 cold request | PASS | 12.08초, `live_cache_miss`, cache 저장 |
| 7일 warm request | PASS | 0.01초, `lazy_cache_hit` |
| 30일 precompute self-fetch | PASS | 14.78초, `live_force`, `precompute=true` |
| 30일 warm request | PASS | 0.00초, `lazy_cache_hit` |
| browser smoke | PASS | `요약 계산 cache` 카드와 `사전 계산 cache hit` 표시 확인 |

## 운영 반영 시 확인할 것

1. VM Cloud에 배포하면 background jobs가 켜진 환경에서는 기본적으로 Naver Ads summary precompute worker가 활성화된다.
2. 끄려면 `NAVER_ADS_SUMMARY_PRECOMPUTE_ENABLED=0`을 둔다.
3. 기본 주기는 `NAVER_ADS_SUMMARY_PRECOMPUTE_INTERVAL_MS=900000`(15분)이다.
4. 운영 로그에서 `[Naver Ads summary precompute] tick`이 `ok=3 failed=0`인지 확인한다.
5. 화면에서 `요약 계산 cache`가 `사전 계산 cache hit`로 뜨면 사용자 체감 로딩은 짧아진다.

## 남은 리스크

- 현재 로컬 백엔드는 background jobs를 꺼둔 상태라, worker 자동 tick은 로컬에서 실행하지 않았다.
- 2026-05-22 18:25 KST 기준 VM Cloud 배포가 완료되어 운영 화면도 이 개선을 쓴다.
- 첫 cold 계산 자체는 여전히 12~15초 걸린다. 목적은 이 계산을 사용자 요청 전에 미리 끝내는 것이다.

## VM Cloud 배포 결과

배포 시각: 2026-05-22 18:19~18:25 KST
대상: VM Cloud `seo-backend`, `seo-frontend`
승인: TJ님 VM Cloud 배포 승인

### 반영 파일

| 파일 | 목적 |
|---|---|
| `backend/src/routes/naverAds.ts` | campaign-summary lazy cache, inflight coalescing, stale fallback |
| `backend/src/naverAdsSummaryPrecompute.ts` | 7/30/90일 기본 조합 precompute worker |
| `backend/src/bootstrap/startBackgroundJobs.ts` | Naver Ads summary precompute worker 등록 |
| `frontend/src/app/ads/naver/page.tsx` | 화면에 `요약 계산 cache` 상태 표시 |
| `project/naver-roas-summary-precompute-20260522.md` | 배포/검증 기록 |

### 백업

VM Cloud 백업 경로:

```text
/home/biocomkr_sns/seo/repo/.deploy-backups/naver-roas-precompute-20260522T091904KST
```

### 빌드/재시작

| 항목 | 결과 |
|---|---|
| backend `npm run typecheck` | PASS |
| backend `npm run build` | PASS |
| frontend `npm run build` | PASS |
| `pm2 restart seo-backend --update-env` | PASS, restart count 4316 |
| `pm2 restart seo-frontend --update-env` | PASS, restart count 70 |
| `pm2 save` | PASS |

### 운영 smoke

| 확인 | 결과 |
|---|---|
| `https://att.ainativeos.net/health` | 200, `service=biocom-seo-backend` |
| 배포 직후 7일 첫 조회 | 200, 29.15초, `summary_cache.source=live_cache_miss` |
| 7일 두 번째 조회 | 200, 0.29초, `summary_cache.source=lazy_cache_hit` |
| 30일 조회 | 200, 0.24초, `summary_cache.source=lazy_cache_hit`, rows 1,110, spend 7,305,482원, 내부 ROAS 2.0 |
| 90일 조회 | 200, 0.24초, `summary_cache.source=lazy_cache_hit`, rows 1,147, cache status `partial_requested_window` |
| `https://biocom.ainativeos.net/ads/naver` | 200, 화면에서 `Naver ROAS 액션 테이블`, `요약 계산 cache`, `사전 계산 cache hit` 확인 |

### precompute worker 확인

VM Cloud `seo-backend` 로그:

```text
[Naver Ads summary precompute] 활성화 — 15분 주기 (site×7/30/90d 기본 조합)
[Naver Ads summary precompute] ok biocom:last_7d:2026-05-15~2026-05-21 source=live_force 29103ms
[Naver Ads summary precompute] ok biocom:last_30d:2026-04-22~2026-05-21 source=live_force 23938ms
[Naver Ads summary precompute] ok biocom:last_90d:2026-02-21~2026-05-21 source=live_force 23095ms
[Naver Ads summary precompute] tick — ok=3 failed=0 total=3 76138ms
```

### 금지선

- 외부 광고 플랫폼 전송: 0
- 운영DB write/import: 0
- VM Cloud SQLite schema migration: 0
- GTM publish: 0
- Imweb header/footer 변경: 0
