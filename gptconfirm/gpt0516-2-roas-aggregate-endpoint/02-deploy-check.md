# VM Cloud deploy check

## 배포 대상

- `backend/src/routes/ads.ts`

## 배포 전 확인

```bash
npm run typecheck
```

## 배포 후 smoke

```bash
curl -sS 'https://att.ainativeos.net/api/ads/roas-summary?account_id=act_3138805896402376&presets=today,yesterday,last_7d' \
  | jq '{ok, batch, keys:(.results|keys), errors, metric_contract}'
```

## 실제 배포 결과

- 배포 시각: 2026-05-16 KST
- 배포 파일: `backend/src/routes/ads.ts`
- backup: `/home/biocomkr_sns/seo/repo/backend/_roas-summary-deploy-backup-20260516-gpt0516-2/ads.ts.before`
- remote typecheck/build: PASS
- `seo-backend`: online, pid `766366`, restart count `4154`

Live smoke:

```text
/api/ads/roas-summary
HTTP 200
TIME_TOTAL 12.902s
ledger_source operational_vm
batch.ledger_fetch_count 1
batch.raw_ledger_items_returned 0
results keys last_7d,today,yesterday
```

Option B regression check:

```text
/api/attribution/funnel-health?site=biocom&window=7d
HTTP 200
TIME_TOTAL 0.269s
cache.source in_memory_precompute
```

## 성공 기준

- `ok=true`
- `batch.ledger_fetch_count=1`
- `batch.raw_ledger_items_returned=0`
- `results.today`, `results.yesterday`, `results.last_7d` 중 1개 이상 존재
- `metric_contract.source.revenue`와 `metric_contract.source.spend`가 존재

## 실패 조건

- API 5xx
- frontend가 다시 `/api/ads/roas` 3회 fallback
- raw ledger item array가 응답에 포함됨
- Meta/Google/GA4/TikTok/Naver send/upload 발생

## rollback

`backend/src/routes/ads.ts`를 배포 전 backup으로 되돌리고 backend build/restart 후 `/api/ads/roas` 단건 endpoint가 기존처럼 동작하는지 확인한다.
