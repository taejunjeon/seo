# TikTok Guard Monitor manual-test

- generated_at: 2026-04-24T14:38:56.953Z
- window: 2026-04-24T13:38:56.953Z ~ 2026-04-24T14:38:56.953Z
- base_url: https://att.ainativeos.net
- source: 운영 VM API / CRM_LOCAL_DB_PATH#tiktok_pixel_events
- status: PASS
- confidence: 99%

## API

- health_status: 200
- health_ok: true
- events_status: 200
- events_ok: true

## Summary

- totalEvents: 11
- uniqueOrderKeys: 4

### countsByAction

- decision_received: 3
- purchase_intercepted: 3
- released_confirmed_purchase: 2
- blocked_pending_purchase: 1
- sent_replacement_place_an_order: 1
- smoke_test: 1

### countsByDecisionStatus

- confirmed: 4
- unknown: 4
- pending: 3

### countsByDecisionBranch

- allow_purchase: 5
- block_purchase_virtual_account: 3
- unknown: 3

## Anomalies

- none

## Warnings

- none

## Recent Orders

| order | logged_at | order_no | value | actions | decision |
|---|---:|---:|---:|---|---|
| o202604241a0fe0b455417 | 2026-04-24T14:34:47.260Z | 202604245822900 | 245000 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o20260424e1f05530c933d | 2026-04-24T14:32:58.995Z | 202604247459692 | 11900 | blocked_pending_purchase, sent_replacement_place_an_order, decision_received, purchase_intercepted | pending, unknown / block_purchase_virtual_account, unknown |
| o202604248409955023aa3 | 2026-04-24T14:25:40.226Z | 202604246007665 | 11900 | decision_received, released_confirmed_purchase, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| smoke_o_1777040604374 | 2026-04-24T14:23:25.084Z | smoke_no_1777040604374 | 1000 | smoke_test | unknown / allow_purchase |

## Interpretation

- PASS means the v2 guard ledger has no detected release/block inconsistency in this window.
- A zero-event PASS means no TikTok Purchase interception was observed in the window, not that ads generated no traffic.
- Business ROAS 판단은 이 원장만으로 끝내지 말고 TikTok Ads export, 아임웹/토스 주문, GA4를 함께 대조한다.
