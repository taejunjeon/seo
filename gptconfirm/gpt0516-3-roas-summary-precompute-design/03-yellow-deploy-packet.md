# Yellow deploy packet — ROAS summary precompute/cache

작성 시각: 2026-05-16 14:25 KST

## 목표

ROAS 카드가 Meta API 실시간 조회 때문에 10초 이상 걸리는 문제를 줄인다.

## 승인 범위

- VM Cloud backend code patch.
- `backend/src/routes/ads.ts` cache layer 추가.
- `backend/src/bootstrap/startBackgroundJobs.ts` ROAS summary precompute self-call worker 추가.
- 필요 시 `backend/src/roasSummaryPrecompute.ts` 신규 파일 추가.
- backend typecheck/build.
- `seo-backend` restart.
- post-snapshot smoke.

## 금지

- Meta CAPI Purchase send/backfill.
- Google/GA4/TikTok/Naver send/upload.
- 운영DB write/import.
- VM Cloud SQLite schema migration.
- GTM publish.
- Imweb header/footer 변경.
- raw identifier output.

## pre-snapshot

```bash
curl -sS -m 60 -w 'TIME_TOTAL:%{time_total}\nHTTP_STATUS:%{http_code}\n' \
  -o /tmp/roas-summary-before.json \
  'https://att.ainativeos.net/api/ads/roas-summary?account_id=act_3138805896402376&presets=today,yesterday,last_7d'

jq '{ok,cache,batch,ledger_source,row_count,order_count,keys:(.results|keys)}' /tmp/roas-summary-before.json
```

기대:

- 현재는 10초대 가능.
- `cache.cached=true`는 아직 없어도 정상.

## post-snapshot

첫 호출:

```bash
curl -sS -m 80 -w 'TIME_TOTAL:%{time_total}\nHTTP_STATUS:%{http_code}\n' \
  -o /tmp/roas-summary-force.json \
  'https://att.ainativeos.net/api/ads/roas-summary?account_id=act_3138805896402376&presets=today,yesterday,last_7d&force=true'
```

cache hit:

```bash
curl -sS -m 20 -w 'TIME_TOTAL:%{time_total}\nHTTP_STATUS:%{http_code}\n' \
  -o /tmp/roas-summary-cache.json \
  'https://att.ainativeos.net/api/ads/roas-summary?account_id=act_3138805896402376&presets=today,yesterday,last_7d'

jq '{ok,cache,batch,ledger_source,keys:(.results|keys),errors}' /tmp/roas-summary-cache.json
```

성공 기준:

- cache hit 500ms 이하.
- `cache.cached=true`.
- `cache.source=in_memory_precompute`.
- `batch.raw_ledger_items_returned=0`.
- `ledger_source=operational_vm`.
- `results.today`, `results.yesterday`, `results.last_7d` 존재.
- `seo-backend` restart loop 없음.

## rollback

배포 전 backup한 파일을 원복한다.

```bash
cp <backup>/ads.ts.before backend/src/routes/ads.ts
cp <backup>/startBackgroundJobs.ts.before backend/src/bootstrap/startBackgroundJobs.ts
rm -f backend/src/roasSummaryPrecompute.ts
npm run build
pm2 restart seo-backend
```

## stop criteria

- API 5xx.
- cache hit인데 응답 5초 초과가 반복됨.
- Meta API rate limit error 증가.
- 기존 `/api/ads/roas` 단건 endpoint 5xx.
- `funnel-health` Option B cache regression.
