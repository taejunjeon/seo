# TikTok Guard Monitor 24h

- generated_at: 2026-05-08T02:13:52.820Z
- window: 2026-05-07T02:13:52.820Z ~ 2026-05-08T02:13:52.820Z
- base_url: https://att.ainativeos.net
- source: VM Cloud API / CRM_LOCAL_DB_PATH#tiktok_pixel_events
- status: WARN
- confidence: 90%

## API

- health_status: 200
- health_ok: true
- events_status: 200
- events_ok: true

## Summary

- totalEvents: 192
- uniqueOrderKeys: 64

### countsByAction

- decision_received: 64
- purchase_intercepted: 64
- released_unknown_purchase: 63
- released_confirmed_purchase: 1

### countsByDecisionStatus

- unknown: 190
- confirmed: 2

### countsByDecisionBranch

- hold_or_block_purchase: 126
- unknown: 64
- allow_purchase: 2

## Anomalies

- none

## Warnings

- released_unknown_purchase rows=63

## Recent Orders

| order | logged_at | order_no | value | actions | decision |
|---|---:|---:|---:|---|---|
| o20260508a31827de982d5 | 2026-05-08T02:07:46.491Z | 202605081232163 | 0 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o20260508cf753de48edeb | 2026-05-08T02:06:53.737Z | 202605080693199 | 0 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o202605083f62bbaa979ee | 2026-05-08T02:06:01.871Z | 202605082473485 | 0 | decision_received, purchase_intercepted, released_unknown_purchase | unknown / hold_or_block_purchase, unknown |
| o202605086b40b1f666845 | 2026-05-08T02:04:59.514Z | 202605087593799 | 0 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o20260508abbdad1c1effa | 2026-05-08T02:04:02.448Z | 202605080784719 | 0 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o202605081420806a62bb5 | 2026-05-08T02:03:37.016Z | 202605082072628 | 0 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o20260508c321ea363b45d | 2026-05-08T01:42:34.886Z | 202605086783484 | 245000 | released_unknown_purchase, purchase_intercepted, decision_received | unknown / hold_or_block_purchase, unknown |
| o20260508eea0a2d17b58a | 2026-05-08T01:30:09.929Z | 202605083850292 | 245000 | purchase_intercepted, decision_received, released_unknown_purchase | unknown / unknown, hold_or_block_purchase |
| o20260508ab5fbb4c48b08 | 2026-05-08T00:58:32.055Z | 202605088822930 | 485000 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o202605083aefa2f54c97d | 2026-05-08T00:44:28.926Z | 202605085324871 | 138744 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o202605082eda719a01b57 | 2026-05-08T00:43:28.985Z | 202605083401119 | 107000 | decision_received, released_unknown_purchase, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o202605089ae4ce10169ad | 2026-05-08T00:22:14.130Z | 202605082581745 | 94000 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o202605081790e2b1d3c2e | 2026-05-08T00:07:23.103Z | 202605087932367 | 29900 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o20260508b69a8707cd232 | 2026-05-08T00:06:16.369Z | 202605085695743 | 196200 | decision_received, purchase_intercepted, released_unknown_purchase | unknown / hold_or_block_purchase, unknown |
| o202605079734f702775b7 | 2026-05-07T23:05:01.530Z | 202605083170622 | 245000 | decision_received, released_unknown_purchase, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o20260507fad731ebdf09f | 2026-05-07T22:11:13.875Z | 202605086147972 | 106286 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o20260507f7de894382ae2 | 2026-05-07T21:30:32.938Z | 202605085435456 | 295020 | decision_received, released_unknown_purchase, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o202605070d65488cc99fb | 2026-05-07T21:14:41.649Z | 202605085945639 | 245000 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o20260507a7bbbbe4d691f | 2026-05-07T17:39:31.541Z | 202605085444462 | 188000 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o20260507de34bd9c5ba29 | 2026-05-07T16:45:49.866Z | 202605080273522 | 278679 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o2026050780e9e8e338dc3 | 2026-05-07T16:19:34.531Z | 202605082096479 | 245000 | decision_received, released_unknown_purchase, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o2026050719f6dc9b3fe10 | 2026-05-07T15:57:04.402Z | 202605089240294 | 240000 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o20260507f344d01f69835 | 2026-05-07T15:48:51.440Z | 202605087183792 | 245000 | decision_received, released_unknown_purchase, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o2026050743f45f9ec153b | 2026-05-07T15:48:19.138Z | 202605087229438 | 245000 | decision_received, released_unknown_purchase, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o20260507455fb4c3339b7 | 2026-05-07T15:45:10.590Z | 202605084181891 | 245000 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o202605078b0eeb11328fc | 2026-05-07T15:44:21.911Z | 202605085584797 | 245000 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o20260507313fb70370c82 | 2026-05-07T15:02:05.291Z | 202605071769905 | 52136 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o2026050778b43ab63ae39 | 2026-05-07T14:49:01.884Z | 202605077682570 | 106067 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o20260507315890d9afd09 | 2026-05-07T14:25:03.043Z | 202605073790132 | 422523 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o20260507e54756a56b379 | 2026-05-07T14:21:01.878Z | 202605070090979 | 245000 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |

## Interpretation

- PASS means the v2 guard ledger has no detected release/block inconsistency in this window.
- A zero-event PASS means no TikTok Purchase interception was observed in the window, not that ads generated no traffic.
- Business ROAS 판단은 이 원장만으로 끝내지 말고 TikTok Ads export, 아임웹/토스 주문, GA4를 함께 대조한다.
