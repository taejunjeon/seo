# Deploy And Env Result

## Deployed Files

Remote target:

- `/home/biocomkr_sns/seo/repo/backend/src/env.ts`
- `/home/biocomkr_sns/seo/repo/backend/src/metaCapi.ts`

Local and remote SHA-256 hashes matched after deploy:

| file | SHA-256 |
|---|---|
| `backend/src/env.ts` | `6fb394544cc4c800678940cdae9bf8fc1119ee221c9acbbe9d00e12f3729ef45` |
| `backend/src/metaCapi.ts` | `644470a06d2a22a59729230ebdba74f588ac97ed243e8b1b065772f23bb88f57` |

## Backup

Remote backup directory:

`/home/biocomkr_sns/seo/repo/backend/_deploy-backup-20260521-emq-identity-canary`

Backed up:

- `src/env.ts`
- `src/metaCapi.ts`
- `.env`

## Env Settings

Set in remote `.env`:

```text
META_CAPI_ENABLE_IMWEB_PHONE_HASH=true
META_CAPI_ENABLE_MEMBER_EXTERNAL_ID=true
META_CAPI_EXTERNAL_ID_SECRET=present
META_CAPI_IDENTITY_ENRICHMENT_SITE_ALLOWLIST=biocom
META_CAPI_ENABLE_EVENT_ID_HASH=false
META_CAPI_EVENT_ID_SECRET=missing
```

Secret value was generated/stored without printing it.

## Build And Restart

- Remote `npm run typecheck`: PASS
- Remote `npm run build`: PASS
- PM2 restart: PASS
- `seo-backend` restart count after deploy: 4306
- `seo-backend` status after deploy: online
- Memory settled around 283 MB in the immediate post-check.

## Health

`GET http://127.0.0.1:7020/api/meta/health`

- HTTP 200
- Biocom/main Meta token: valid
- Existing coffee token warnings remained unrelated to this biocom canary.
