# VM Cloud deploy result — ROAS summary cache

작성 시각: 2026-05-16 KST

## 판정

`ROAS_SUMMARY_CACHE_DEPLOY_PASS`

## 배포한 것

- `backend/src/routes/ads.ts`
- `backend/src/bootstrap/startBackgroundJobs.ts`

## backup

VM Cloud backup path:

```text
/home/biocomkr_sns/seo/repo/backend/_roas-summary-cache-deploy-backup-20260516-gpt0516-4
```

포함 파일:

- `ads.ts.before`
- `startBackgroundJobs.ts.before`

## pre-snapshot

ROAS summary before deploy:

```text
HTTP 200
time_total 13.805773s
cache null
ledger_source operational_vm
row_count 2929
order_count 583
results last_7d,today,yesterday
errors {}
```

기존 funnel-health cache:

```text
HTTP 200
time_total 2.891050s
cache.source in_memory_precompute
cache.generation_ms 156
```

## build/restart

VM Cloud backend:

```text
npm run typecheck PASS
npm run build PASS
pm2 restart seo-backend PASS
seo-backend pid 774226
restart count 4173
status online
```

## post-snapshot

첫 force refresh:

```text
HTTP 200
time_total 11.145094s
cache.source live_force_refresh
cache.cached true
generation_ms 10923
batch.raw_ledger_items_returned 0
ledger_source operational_vm
row_count 2933
order_count 583
results last_7d,today,yesterday
errors {}
```

biocom cache hit:

```text
public route:
- 0.270629s, HTTP 200, cache.source in_memory_precompute
- 3.922259s, HTTP 200, cache.source in_memory_precompute
- 0.264797s, HTTP 200, cache.source in_memory_precompute

VM Cloud localhost:
- 0.011349s, HTTP 200, cache.source in_memory_precompute
- 0.003442s, HTTP 200, cache.source in_memory_precompute
- 0.003727s, HTTP 200, cache.source in_memory_precompute
```

thecleancoffee cache hit:

```text
public route:
- 0.239968s, HTTP 200, cache.source in_memory_precompute
- 3.937126s, HTTP 200, cache.source in_memory_precompute
- 0.297472s, HTTP 200, cache.source in_memory_precompute
```

기존 funnel-health regression:

```text
HTTP 200
time_total 0.335685s
cache.source in_memory_precompute
```

기존 `/api/ads/roas` 단건 endpoint:

```text
HTTP 200
time_total 12.204455s
ledger_source operational_vm
row_count 2937
order_count 583
```

단건 endpoint는 의도적으로 cache 대상이 아니며, 프론트는 summary endpoint를 우선 사용한다.

## worker 확인

VM Cloud log:

```text
[ROAS summary precompute] 활성화 — 5분 주기 (2 accounts)
[ROAS summary precompute] ok account=*2376 source=force_cooldown_cache generationMs=10923
[ROAS summary precompute] ok account=*7474 source=live_force_refresh generationMs=2857
[ROAS summary precompute] tick — ok=2 failed=0 next=300s
```

## 외부 전송/쓰기

- Meta CAPI Purchase send/backfill: 0.
- Google/GA4/TikTok/Naver send/upload: 0.
- 운영DB write/import: 0.
- VM Cloud SQLite schema migration: 0.
- GTM publish: 0.
- Imweb header/footer 변경: 0.

## 해석

backend cache 자체는 VM Cloud localhost에서 3~11ms로 동작한다.

public route에서 한 번씩 3~4초 지연이 있었지만 응답은 모두 cache hit였다. 이는 backend 계산 병목보다는 Cloudflare/public network hop 또는 동시 요청 대기 가능성이 높다.

## rollback

필요 시:

```bash
cp /home/biocomkr_sns/seo/repo/backend/_roas-summary-cache-deploy-backup-20260516-gpt0516-4/ads.ts.before \
  /home/biocomkr_sns/seo/repo/backend/src/routes/ads.ts
cp /home/biocomkr_sns/seo/repo/backend/_roas-summary-cache-deploy-backup-20260516-gpt0516-4/startBackgroundJobs.ts.before \
  /home/biocomkr_sns/seo/repo/backend/src/bootstrap/startBackgroundJobs.ts
cd /home/biocomkr_sns/seo/repo/backend
npm run build
pm2 restart seo-backend
```
