# /api/attribution/ledger hard guard deploy packet

harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - AGENTS.md
  required_context_docs:
    - data/!data_inventory.md
  lane: Yellow
  allowed_actions:
    - backend/src/routes/attribution.ts deploy
    - VM Cloud backend build
    - seo-backend restart
    - health and read-only smoke checks
  forbidden_actions:
    - operating DB write/import
    - VM Cloud schema migration
    - Meta/Google/TikTok send
    - GTM publish
    - Imweb header/footer edit
  source_window_freshness_confidence:
    source: VM Cloud pm2 logs, local backend code, local typecheck, local smoke
    window: recent ledger hammer observed on 2026-05-25 KST
    freshness: 2026-05-25 KST
    confidence: 0.90

## Decision

Deploy the local `backend/src/routes/attribution.ts` hard guard.

The previous guard capped the number of rows returned to the caller, but the backend still loaded the full attribution ledger first. The new guard uses the indexed date range reader for non-trusted public calls that include `startAt` or `endAt`, so the server reads only the requested time window before filtering and slicing.

## Expected impact

- Lower memory pressure for large public ledger calls.
- Lower event-loop blocking when local scripts or dashboards request a date window.
- Preserve trusted localhost/internal diagnostics on full ledger behavior.
- Treat Cloudflare-forwarded self-calls as public calls, even when the forwarded client IP is the VM public IP.
- Avoid returning `allEntriesSummary` to public filtered calls, because it forces a wider read and is not needed for dashboard use.

## Deployment scope

- Deploy only: `backend/src/routes/attribution.ts`
- No DB schema changes.
- No external platform sends.
- No frontend changes.

## Pre-check

- Local `npm run typecheck`: PASS.
- Local `git diff --check`: PASS.
- Local public-smoke route: PASS, `readStrategy=indexed_range_read`.

## VM deployment steps

1. Create a timestamped VM backup of `backend/src/routes/attribution.ts`.
2. Copy the patched local file to VM.
3. Run backend build/typecheck command available on VM.
4. Restart `seo-backend`.
5. Check `/api/health`.
6. Smoke `/api/attribution/ledger` with simulated public headers and a date range.

## Rollback

Restore the timestamped backup file, rebuild backend, restart `seo-backend`, then re-run `/api/health`.

## Post-check criteria

- `/api/health` returns HTTP 200.
- Public ledger date-window request returns HTTP 200.
- Response guard contains `readStrategy=indexed_range_read`.
- VM public self-call with `CF-Connecting-IP: 34.64.104.94` is not trusted and uses `indexed_range_read`.
- No Meta/Google/TikTok send occurs.
- No operating DB write occurs.

## Deploy result

Status: deployed.

VM backup paths:

- `/home/biocomkr_sns/seo/repo/backend/_ledger-hard-guard-backup-20260525-005424`
- `/home/biocomkr_sns/seo/repo/backend/_ledger-hard-guard-selfcall-backup-20260525-010311`

Build/restart:

- VM backend build: PASS.
- `seo-backend` restart: PASS.
- `/health`: HTTP 200.

Smoke checks:

- Public 1-day ledger request:
  - HTTP 200.
  - `requestedLimit=10000`.
  - effective `limit=1000`.
  - `readStrategy=indexed_range_read`.
  - `trustedInternalCaller=false`.
  - `allEntriesSummaryPresent=false`.
- VM self-call 90-day ledger request:
  - HTTP 200.
  - effective `limit=500`.
  - `readStrategy=indexed_range_read`.
  - `trustedInternalCaller=false`.
  - `allEntriesSummaryPresent=false`.
