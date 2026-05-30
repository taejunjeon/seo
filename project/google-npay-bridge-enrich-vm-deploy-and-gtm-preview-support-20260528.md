# Google NPay bridge enrichment VM deploy and GTM Preview support - 2026-05-28

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - docs/report/text-report-template.md
    - project/google-npay-button-bridge-gtm-patch-and-bi-confirmed-plan-20260528.md
  required_context_docs:
    - project/google-ads-private-payload-preview-vm-deploy-result-20260526.md
    - gdn/google-paid-click-intent-gad-campaignid-gtm-hardening-plan-20260521.md
  lane: Yellow
  allowed_actions:
    - VM Cloud backend single-file deploy
    - remote backup
    - typecheck/build/restart
    - read-only API smoke
    - GTM Preview-only support checklist
  forbidden_actions:
    - GTM Production publish
    - Google Ads conversion upload/send
    - production DB write/import
    - live synthetic insert beyond explicit smoke need
    - campaign/bid/budget changes
  source_window_freshness_confidence:
    source: VM Cloud API + PM2 logs + local source
    window: last_7d where API used
    freshness: 2026-05-28 01:18 KST
    confidence: high for deploy/smoke, medium for future GTM Preview because browser UI not executed by Codex
```

## One-line result

VM Cloud backend has the NPay intent duplicate-enrichment patch deployed, built, restarted, and smoke-checked. No Google Ads send, GTM publish, or production DB write was performed.

## What changed

- Deployed file: `backend/src/npayIntentLog.ts`
- VM target path: `/home/biocomkr_sns/seo/repo/backend/src/npayIntentLog.ts`
- VM backup path: `/home/biocomkr_sns/seo/repo/.deploy-backups/npay-bridge-enrich-20260527T161329Z/npayIntentLog.ts.before`
- PM2 app: `seo-backend`
- Purpose: when the same NPay button-click intent is received again with richer data, fill only missing bridge/click-id fields instead of leaving the first sparse row permanently incomplete.

## Deploy validation

- Local `npm run typecheck`: PASS
- Local `python3 scripts/harness-preflight-check.py --strict`: PASS
- VM `npm run typecheck`: PASS
- VM `npm run build`: PASS
- PM2 restart: PASS
- PM2 save: PASS
- PM2 status after restart: `online`
- PM2 restart count: `40 -> 41`
- Health endpoint: `GET https://att.ainativeos.net/health` returned HTTP 200
- New error log after restart: none observed for `2026-05-27 16:* UTC`

## Read-only smoke snapshots

### Google ROAS dashboard API

Endpoint:

`GET https://att.ainativeos.net/api/google-ads/dashboard-summary?date_preset=last_7d&campaign_limit=20&refresh=1`

Observed at `2026-05-28 01:16 KST`:

- ok: `true`
- source: `google_ads_dashboard_summary`
- Google Ads platform ROAS: `10.2355x`
- NPay button-click intents: `258`
- Google-like NPay intents: `193`
- Google click-id preserved NPay intents: `190`
- Actual confirmed NPay orders: `25`
- Internal bridge exact candidates: `18`
- Grade A bridge candidates: `13`
- Grade A with direct Google click id: `0`
- Google Ads send candidates: `0`
- VM Cloud write by smoke: `0`
- Operational DB write by smoke: `0`

### Private payload preview

Endpoint:

`GET https://att.ainativeos.net/api/google-ads/confirmed-purchase/private-payload-preview?site=biocom&window=last_7d&limit=10`

Observed at `2026-05-28 01:17 KST`:

- ok: `true`
- mode: `private_no_send_payload_preview`
- source order rows: `525`
- exact gclid actual purchase rows: `3`
- returned candidates: `3`
- private raw value checks passed: `3`
- upload candidate count: `0`
- send candidate count: `0`
- raw order id in response: `false`
- raw click id in response: `false`
- external send count: `0`
- Google Ads write: `0`

### Candidate expansion

Endpoint:

`GET https://att.ainativeos.net/api/google-ads/confirmed-purchase/candidate-expansion?site=biocom&window=last_7d&refresh=1`

Observed at `2026-05-28 01:18 KST`:

- actual purchase rows: `525`
- actual purchase revenue: `126,753,108 KRW`
- ready exact gclid rows: `3`
- NPay bridge Grade A needs click-id recovery rows: `13`
- internal bridge without Google click id rows: `403`
- missing click bridge rows: `119`
- upload candidate count: `0`
- send candidate count: `0`
- actual purchase candidate readiness: `0.6%`
- overall primary conversion readiness: `88%`

## GTM Preview-only smoke checklist

This is not a Production publish runbook. It is only for confirming that the NPay button click stores richer bridge data before publishing any tag.

1. Open GTM container `GTM-W2Z6PHN`.
2. Create or open a fresh workspace named like `biocom-npay-bridge-preview-20260528`.
3. Do not use Default Workspace.
4. Find the NPay intent Custom HTML tag by searching one of:
   - `npay-intent`
   - `orders.pay.naver.com`
   - `att.ainativeos.net/api/attribution/npay-intent`
5. Back up current tag HTML before editing.
6. Apply the GTM Custom HTML patch from `project/google-npay-button-bridge-gtm-patch-and-bi-confirmed-plan-20260528.md`.
7. Click `Preview`, not `Submit`.
8. Target URL:
   - `https://biocom.kr/shop_view/?idx=198&__seo_attribution_debug=1`
9. In the preview browser, click the NPay button once.
10. Stop at the Naver login page. Do not complete payment for this smoke.
11. In Network or Tag Assistant, confirm:
    - one NPay intent receiver request is sent to VM Cloud,
    - request includes product/page URL and NPay bridge or external URL evidence when available,
    - Google click id fields are present if the test started from a Google Ads click URL,
    - no extra Google Ads purchase conversion is fired by this patch itself,
    - no GTM Production version is created.

## Success criteria for GTM Preview

- The NPay button click creates or enriches an NPay intent row with enough evidence to later match the external NPay completed order.
- The patch does not fire Google Ads, Meta, TikTok, or GA4 purchase by itself.
- Existing NPay secondary Google Ads click/entry signal may fire as already configured, but the bridge patch must not create an additional duplicate conversion.
- No Production publish.

## Current interpretation

The VM backend side is ready to accept richer duplicate NPay intent signals. The next bottleneck is browser/GTM-side capture: the button click must send bridge URL and Google click id evidence before the customer leaves biocom.kr for Naver Pay.
