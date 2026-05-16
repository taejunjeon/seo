# Yellow deploy packet — ROAS summary cache

작성 시각: 2026-05-16 KST

## TJ님 승인 문구

```text
[승인] gpt0516-4 ROAS summary cache VM Cloud backend 배포/restart 진행.
범위:
- backend/src/routes/ads.ts
- backend/src/bootstrap/startBackgroundJobs.ts
- pre-snapshot
- remote backup
- backend typecheck/build
- seo-backend restart
- post-snapshot smoke
금지:
- Meta/Google/GA4/TikTok/Naver send/upload
- 운영DB write/import
- VM Cloud SQLite schema migration
- GTM publish
- Imweb header/footer 변경
- raw identifier output
```

## 목표

프론트 ROAS 카드가 매 요청마다 Meta Ads API를 실시간 조회해 10초 이상 걸리는 문제를 줄인다.

## pre-snapshot

```bash
curl -sS -m 90 -w 'TIME_TOTAL:%{time_total}\nHTTP_STATUS:%{http_code}\n' \
  -o /tmp/roas-summary-before.json \
  'https://att.ainativeos.net/api/ads/roas-summary?account_id=act_3138805896402376&presets=today,yesterday,last_7d'

jq '{ok,cache,batch,ledger_source,row_count,order_count,keys:(.results|keys),errors}' \
  /tmp/roas-summary-before.json
```

## deploy 대상

- `backend/src/routes/ads.ts`
- `backend/src/bootstrap/startBackgroundJobs.ts`

## build/restart

VM Cloud에서 실행:

```bash
cd /home/biocomkr_sns/seo/repo/backend
npm run typecheck
npm run build
pm2 restart seo-backend
```

## post-snapshot

첫 force refresh:

```bash
curl -sS -m 120 -w 'TIME_TOTAL:%{time_total}\nHTTP_STATUS:%{http_code}\n' \
  -o /tmp/roas-summary-force.json \
  'https://att.ainativeos.net/api/ads/roas-summary?account_id=act_3138805896402376&presets=today,yesterday,last_7d&force=true'
```

cache hit 확인:

```bash
curl -sS -m 20 -w 'TIME_TOTAL:%{time_total}\nHTTP_STATUS:%{http_code}\n' \
  -o /tmp/roas-summary-cache.json \
  'https://att.ainativeos.net/api/ads/roas-summary?account_id=act_3138805896402376&presets=today,yesterday,last_7d'

jq '{ok,cache,batch,ledger_source,keys:(.results|keys),errors}' \
  /tmp/roas-summary-cache.json
```

## 성공 기준

- `/api/health` 200.
- `seo-backend` restart loop 없음.
- ROAS summary cache hit 500ms 이하.
- `cache.cached=true`.
- `cache.source`가 `in_memory_precompute`, `force_cooldown_cache`, 또는 cache hit 계열로 표시.
- `batch.raw_ledger_items_returned=0`.
- `results.today`, `results.yesterday`, `results.last_7d` 존재.
- 기존 `/api/ads/roas` 단건 endpoint 200.
- 기존 `/api/attribution/funnel-health` Option B cache regression 0.
- external send/upload 0.
- 운영DB write/import 0.

## 실패 조건

- API 5xx.
- cache hit인데 응답 5초 초과가 반복됨.
- Meta API rate limit error 증가.
- ROAS 값이 기존 live summary와 크게 어긋나고 source/window 설명이 불가능함.
- `funnel-health` cache가 깨짐.

## rollback

배포 전 backup 파일로 원복한다.

```bash
cp <backup>/ads.ts.before /home/biocomkr_sns/seo/repo/backend/src/routes/ads.ts
cp <backup>/startBackgroundJobs.ts.before /home/biocomkr_sns/seo/repo/backend/src/bootstrap/startBackgroundJobs.ts
cd /home/biocomkr_sns/seo/repo/backend
npm run build
pm2 restart seo-backend
```
