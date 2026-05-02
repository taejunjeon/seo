# TikTok Guard Monitor gtm-publish-baseline

- generated_at: 2026-05-02T15:37:24.135Z
- window: 2026-05-02T14:37:24.135Z ~ 2026-05-02T15:37:24.135Z
- base_url: https://att.ainativeos.net
- source: 운영 VM API / CRM_LOCAL_DB_PATH#tiktok_pixel_events
- status: WARN
- confidence: 90%

## API

- health_status: 200
- health_ok: true
- events_status: 200
- events_ok: true

## Summary

- totalEvents: 12
- uniqueOrderKeys: 4

### countsByAction

- decision_received: 4
- purchase_intercepted: 4
- released_confirmed_purchase: 2
- released_unknown_purchase: 2

### countsByDecisionStatus

- unknown: 8
- confirmed: 4

### countsByDecisionBranch

- allow_purchase: 4
- hold_or_block_purchase: 4
- unknown: 4

## Anomalies

- none

## Warnings

- released_unknown_purchase rows=2

## Recent Orders

| order | logged_at | order_no | value | actions | decision |
|---|---:|---:|---:|---|---|
| o20260502a0a035128ba07 | 2026-05-02T15:25:53.238Z | 202605033130831 | 245000 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o20260502c0c1ce5d28e95 | 2026-05-02T15:11:28.316Z | 202605035698347 | 11900 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o202605021bec71044267b | 2026-05-02T15:08:20.067Z | 202605030593116 | 459000 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o20260502cefce95befefd | 2026-05-02T14:38:26.259Z | 202605022907364 | 264325 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |

## Interpretation

- PASS means the v2 guard ledger has no detected release/block inconsistency in this window.
- A zero-event PASS means no TikTok Purchase interception was observed in the window, not that ads generated no traffic.
- Business ROAS 판단은 이 원장만으로 끝내지 말고 TikTok Ads export, 아임웹/토스 주문, GA4를 함께 대조한다.
