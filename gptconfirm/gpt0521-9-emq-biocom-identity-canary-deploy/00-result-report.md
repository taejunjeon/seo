# gpt0521-9 EMQ Biocom Identity Canary Deploy Result

## Harness Preflight

```yaml
harness_preflight: common_harness_read
project_harness_read:
  - AGENTS.md
  - harness/common/HARNESS_GUIDELINES.md
  - harness/common/AUTONOMY_POLICY.md
  - harness/common/REPORTING_TEMPLATE.md
lane: Yellow
allowed_actions:
  - deploy backend/src/env.ts to VM Cloud
  - deploy backend/src/metaCapi.ts to VM Cloud
  - enable biocom-only CAPI identity enrichment canary
  - restart seo-backend
  - read-only health/log post-check
forbidden_actions:
  - Meta backfill/manual bulk send
  - Browser Purchase fallback
  - event_id hash enablement
  - email user_data enablement
  - thecleancoffee identity enrichment
  - GTM publish
  - operating DB write/import
source_window_freshness_confidence:
  source: VM Cloud backend + Meta CAPI send log
  window: deploy timestamp and recent CAPI records
  freshness: live
  confidence: high
```

## 10-second Summary

VM Cloud에 `backend/src/env.ts`, `backend/src/metaCapi.ts`를 배포하고 `seo-backend`를 재시작했다.

이번 canary는 **바이오컴 Purchase CAPI에만 전화번호 해시(`ph`)와 외부 ID 해시(`external_id`)를 붙이는 설정**이다. 이메일, 더클린커피, event_id hashing, 수동 backfill은 켜지 않았다.

## Baseline Screenshot Captured

TJ님이 제공한 배포 전 Meta Events Manager 기준선:

- Event Matching Quality: **6.0/10**
- IP address: **100%**
- User agent: **100%**
- Browser ID (`fbp`): **95.74%**
- Click ID (`fbc`): **42.55%**
- Meta suggested additions: email, phone, Facebook login ID, external ID

이 기준은 24시간 canary 후 비교용이다.

## Deploy Result

- `backend/src/env.ts`: deployed
- `backend/src/metaCapi.ts`: deployed
- `.env`: identity canary flags enabled for `biocom` only
- `META_CAPI_ENABLE_EVENT_ID_HASH`: `false`
- Backend typecheck/build: PASS
- `seo-backend` restart: PASS
- `/api/meta/health`: HTTP 200

## Early Post-check

Recent post-deploy CAPI log records that include the new `user_data_presence` field:

| site/pixel scope | records with presence field | success | `ph=true` | `external_id=true` | note |
|---|---:|---:|---:|---:|---|
| biocom | 8 | 8 | 2 | 2 | canary active on new eligible records |
| thecleancoffee | 3 | 3 | 0 | 0 | allowlist block working |

## Current Impact

Biocom Purchase CAPI is now sending additional customer identifiers only when the local matching source has enough data. This should improve Meta Event Matching Quality over the next 12-24 hours, without changing the event count or sending extra purchases.

## Not Done

- Did not send manual Meta Purchase backfill.
- Did not enable Browser Purchase.
- Did not enable event_id hashing.
- Did not add email.
- Did not enable identity enrichment for thecleancoffee.
- Did not publish GTM.
- Did not write/import operating DB data.

## Next Check

Re-check Meta Events Manager after enough new Purchase events accumulate:

- preferred first check: 6-12 hours
- decision check: 24 hours
- success target: `ph` and `external_id` appear in CAPI logs, and Meta Event Matching Quality moves above the 6.0/10 baseline without CAPI failures.
