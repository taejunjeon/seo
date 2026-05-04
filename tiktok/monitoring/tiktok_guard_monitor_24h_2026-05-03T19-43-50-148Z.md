# TikTok Guard Monitor 24h

- generated_at: 2026-05-03T19:43:50.148Z
- window: 2026-05-02T19:43:50.148Z ~ 2026-05-03T19:43:50.148Z
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

- totalEvents: 171
- uniqueOrderKeys: 56

### countsByAction

- decision_received: 56
- purchase_intercepted: 56
- released_unknown_purchase: 39
- released_confirmed_purchase: 14
- blocked_pending_purchase: 3
- sent_replacement_place_an_order: 3

### countsByDecisionStatus

- unknown: 134
- confirmed: 28
- pending: 9

### countsByDecisionBranch

- hold_or_block_purchase: 78
- unknown: 56
- allow_purchase: 28
- block_purchase_virtual_account: 9

## Anomalies

- none

## Warnings

- released_unknown_purchase rows=39

## Recent Orders

| order | logged_at | order_no | value | actions | decision |
|---|---:|---:|---:|---|---|
| o2026050345c8c729578f7 | 2026-05-03T19:33:22.407Z | 202605042439643 | 245000 | decision_received, released_unknown_purchase, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o202605039d6b9cb9a40b0 | 2026-05-03T17:52:43.200Z | 202605043601258 | 245000 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o202605036f67868f4cca0 | 2026-05-03T15:11:13.735Z | 202605046083737 | 117800 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o202605037409a6478f2bc | 2026-05-03T14:53:43.408Z | 202605032273136 | 21900 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o20260503cecb50a3b9ec0 | 2026-05-03T14:43:42.822Z | 202605031473358 | 260000 | decision_received, released_unknown_purchase, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o202605035375cd58227b2 | 2026-05-03T14:27:28.774Z | 202605034346901 | 459000 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o202605039d86e2cd8defc | 2026-05-03T14:06:49.046Z | 202605033040341 | 245000 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o20260503b5df40acbcee4 | 2026-05-03T13:54:19.754Z | 202605038994202 | 471200 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o202605033611216739f73 | 2026-05-03T13:39:20.727Z | 202605033153818 | 234000 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o20260503a3fdf59624746 | 2026-05-03T13:22:12.155Z | 202605038409156 | 260000 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o202605035c9ff1af94b4c | 2026-05-03T13:14:16.034Z | 202605037581657 | 38918 | decision_received, released_unknown_purchase, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o2026050385ffb4e8bbd8c | 2026-05-03T13:11:22.024Z | 202605032571891 | 241300 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o2026050380162caf00385 | 2026-05-03T13:10:33.878Z | 202605035978019 | 52668 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o20260503dbe1c228361a5 | 2026-05-03T13:00:57.321Z | 202605032337902 | 245000 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o202605032626e221beee4 | 2026-05-03T12:52:51.891Z | 202605039770364 | 245000 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o202605034482859c6e0cf | 2026-05-03T12:46:16.982Z | 202605035195476 | 485000 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o20260503d600db2d4a10c | 2026-05-03T12:34:36.604Z | 202605039869443 | 234000 | decision_received, purchase_intercepted, released_unknown_purchase | unknown / hold_or_block_purchase, unknown |
| o2026050337601d5f90feb | 2026-05-03T12:12:12.133Z | 202605032992169 | 245000 | sent_replacement_place_an_order, blocked_pending_purchase, decision_received, purchase_intercepted | pending, unknown / block_purchase_virtual_account, unknown |
| o20260503f5cca77dcf1dc | 2026-05-03T11:46:51.028Z | 202605035882089 | 234000 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o202605035f8bd41f7a9a1 | 2026-05-03T11:44:09.193Z | 202605036592818 | 245000 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o20260503a35c409e67d51 | 2026-05-03T11:43:46.596Z | 202605038982352 | 234000 | decision_received, released_unknown_purchase, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o20260503109272bcc5fc7 | 2026-05-03T11:27:06.726Z | 202605032999693 | 29003 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o202605034970362b59156 | 2026-05-03T11:00:40.187Z | 202605036812371 | 18359 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o20260503e55e872facfd6 | 2026-05-03T10:46:25.533Z | 202605030492120 | 109000 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o202605035dec2642eb674 | 2026-05-03T10:25:34.125Z | 202605036881629 | 298000 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o2026050340efe3aaf07c4 | 2026-05-03T10:20:10.025Z | 202605039098185 | 459000 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o202605034141cb3946b15 | 2026-05-03T08:20:00.917Z | 202605030701178 | 99000 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o202605039c260400f8e95 | 2026-05-03T07:47:40.233Z | 202605035208273 | 459000 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o202605035588eeb56d06e | 2026-05-03T07:47:14.307Z | 202605031044388 | 471200 | decision_received, released_confirmed_purchase, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o20260503ef1166a644eff | 2026-05-03T07:45:01.581Z | 202605031260819 | 245000 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |

## Interpretation

- PASS means the v2 guard ledger has no detected release/block inconsistency in this window.
- A zero-event PASS means no TikTok Purchase interception was observed in the window, not that ads generated no traffic.
- Business ROAS 판단은 이 원장만으로 끝내지 말고 TikTok Ads export, 아임웹/토스 주문, GA4를 함께 대조한다.
