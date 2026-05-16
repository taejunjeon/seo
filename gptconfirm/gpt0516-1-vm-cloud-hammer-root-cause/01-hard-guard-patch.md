# Ledger Item API Hard Guard Patch

## Purpose

`/api/attribution/ledger?limit=10000`를 외부 agent나 스크립트가 반복 호출해도 VM Cloud backend가 대용량 JSON 직렬화와 memory restart로 무너지지 않게 막는다.

## Changed File

- `backend/src/routes/attribution.ts`

## Behavior

- 신뢰된 VM Cloud 내부 caller:
  - 기존처럼 최대 10000 item 조회 가능.
  - 기본 trusted IP 목록: `127.0.0.1`, `::1`, `::ffff:127.0.0.1`, 현재 VM Cloud external IP.
  - env `ATTRIBUTION_LEDGER_TRUSTED_READ_IPS`로 조정 가능.

- 공개 caller:
  - 기본 item cap: `ATTRIBUTION_LEDGER_PUBLIC_MAX_LIMIT`, default 1000.
  - 긴 기간 cap: `ATTRIBUTION_LEDGER_PUBLIC_LONG_RANGE_MAX_LIMIT`, default 500.
  - 긴 기간 기준: `ATTRIBUTION_LEDGER_LONG_RANGE_DAYS`, default 3.
  - rate limit: `ATTRIBUTION_LEDGER_PUBLIC_RATE_LIMIT`, default 60 requests per `ATTRIBUTION_LEDGER_RATE_WINDOW_MS`, default 60s.
  - 초과 시 HTTP 429와 `Retry-After` 반환.

- `summaryOnly=true` 또는 `summary_only=true`:
  - summary만 반환하고 `items=[]`.
  - dashboard/diagnostic에서 raw item이 필요 없을 때 사용.

## Why This Is Needed

Option B precompute는 `/api/attribution/funnel-health`를 빠르게 만들지만, `/api/attribution/ledger` item endpoint 자체를 반복 호출하는 hammer를 막지는 않는다.

따라서 Option B와 이 hard guard는 상호 대체가 아니라 함께 필요한 조치다.

## Validation

- `npm run typecheck` PASS.
- VM Cloud deploy/restart: not executed.

## Deployment Gate

Yellow approval required for VM Cloud backend deploy/restart.
