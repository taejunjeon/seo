# 01. VM Cloud Deploy Result

## 배포 대상

- VM Cloud backend file: `backend/src/funnelHealth.ts`
- local source: `backend/src/funnelHealth.ts`
- target app: `seo-backend`

## Pre-snapshot

Health endpoint:
- `GET https://att.ainativeos.net/health`
- status: ok
- service: biocom-seo-backend

Funnel-health pre:

```json
{
  "biocom": {
    "capi_success": 662,
    "metric_contract": false,
    "pixel_ids": null
  },
  "thecleancoffee": {
    "capi_success": 662,
    "metric_contract": false,
    "pixel_ids": null
  },
  "all_sites": {
    "api_site": "biocom",
    "capi_success": 662,
    "metric_contract": false
  }
}
```

## Backup

Backup path:

```text
/home/biocomkr_sns/seo/repo/.deploy-backups/gpt0515-23-20260515T185946KST/backend/src/funnelHealth.ts
```

Rollback command:

```bash
sudo -n -u biocomkr_sns bash -lc 'export PATH=/home/biocomkr_sns/seo/node/bin:/usr/local/bin:/usr/bin:/bin:$PATH; cd /home/biocomkr_sns/seo/repo; cp .deploy-backups/gpt0515-23-20260515T185946KST/backend/src/funnelHealth.ts backend/src/funnelHealth.ts; cd backend; npm run typecheck && npm run build && pm2 restart seo-backend --update-env'
```

## Build / Restart

Commands executed:

```bash
npm run typecheck
npm run build
pm2 restart seo-backend --update-env
```

Result:
- typecheck: PASS
- build: PASS
- restart: PASS
- `seo-backend`: online

## Deploy Notes

Only `backend/src/funnelHealth.ts` was deployed. No DB migration, no schema change, no platform send.
