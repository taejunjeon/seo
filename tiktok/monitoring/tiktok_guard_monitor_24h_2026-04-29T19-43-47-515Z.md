# TikTok Guard Monitor 24h

- generated_at: 2026-04-29T19:43:47.515Z
- window: 2026-04-28T19:43:47.515Z ~ 2026-04-29T19:43:47.515Z
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

- totalEvents: 218
- uniqueOrderKeys: 70

### countsByAction

- decision_received: 70
- purchase_intercepted: 70
- released_confirmed_purchase: 39
- released_unknown_purchase: 23
- blocked_pending_purchase: 8
- sent_replacement_place_an_order: 8

### countsByDecisionStatus

- unknown: 116
- confirmed: 78
- pending: 24

### countsByDecisionBranch

- allow_purchase: 78
- unknown: 70
- hold_or_block_purchase: 46
- block_purchase_virtual_account: 24

## Anomalies

- none

## Warnings

- released_unknown_purchase rows=23

## Recent Orders

| order | logged_at | order_no | value | actions | decision |
|---|---:|---:|---:|---|---|
| o202604299d7567ca70fe7 | 2026-04-29T18:27:13.056Z | 202604308712995 | 102900 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o2026042917412ccf2bd77 | 2026-04-29T18:14:21.191Z | 202604305242119 | 255000 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o20260429c92bf6f3aeeac | 2026-04-29T16:48:48.805Z | 202604303083423 | 37010 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o20260429e95dc494125e6 | 2026-04-29T16:30:27.823Z | 202604303441957 | 245000 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o2026042966d069a63cd64 | 2026-04-29T15:44:23.228Z | 202604300833293 | 245000 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o202604296617bca5e2b0a | 2026-04-29T15:25:00.899Z | 202604309779639 | 234000 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o202604297d2235ba9ba74 | 2026-04-29T15:00:31.497Z | 202604291357669 | 245000 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o20260429516ccae7e0cbd | 2026-04-29T14:51:22.927Z | 202604298137105 | 38148 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o202604291181d2cbd7520 | 2026-04-29T13:57:37.857Z | 202604295566198 | 121986 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o20260429ba68d7f6daca2 | 2026-04-29T13:02:40.437Z | 202604299211851 | 459000 | purchase_intercepted, released_confirmed_purchase, decision_received | unknown, confirmed / unknown, allow_purchase |
| o202604291dd726327e3bd | 2026-04-29T12:47:27.213Z | 202604293479061 | 234000 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o202604296858f8a53f14a | 2026-04-29T12:31:58.547Z | 202604294338209 | 245000 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o20260429546039007d012 | 2026-04-29T12:25:33.739Z | 202604294625894 | 234000 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o20260429eb36db8c06890 | 2026-04-29T12:12:00.555Z | 202604297985510 | 255000 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o202604295752b8882c8bd | 2026-04-29T12:04:35.308Z | 202604296577177 | 234000 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o20260429e7a3c06ce08b6 | 2026-04-29T11:23:45.809Z | 202604296656805 | 485000 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o20260429a115f009fc246 | 2026-04-29T11:08:48.855Z | 202604293571506 | 471200 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o2026042941de232d038d1 | 2026-04-29T10:25:25.024Z | 202604295950515 | 484500 | decision_received, released_confirmed_purchase, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o20260429f88bfa162631e | 2026-04-29T10:03:22.315Z | 202604291376342 | 245000 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o202604293140941e904c0 | 2026-04-29T09:45:35.055Z | 202604290175999 | 245000 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o20260429a981e6f4b23b9 | 2026-04-29T09:32:21.552Z | 202604299790980 | 675000 | decision_received, released_unknown_purchase, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o202604297c882de15bb7c | 2026-04-29T09:11:01.826Z | 202604297566793 | 254800 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o202604293c1597c85cd9a | 2026-04-29T08:41:29.704Z | 202604298671048 | 62710 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o202604293ca1487b39c9e | 2026-04-29T08:27:27.462Z | 202604298827490 | 245000 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o20260429744e38de157a3 | 2026-04-29T08:14:46.840Z | 202604297638184 | 234000 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o202604295681e23ee48bf | 2026-04-29T08:08:08.573Z | 202604299446671 | 5625 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o20260429e1dab062125ea | 2026-04-29T07:46:29.217Z | 202604291767552 | 234000 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o20260429f8c05a8c0de53 | 2026-04-29T07:00:35.964Z | 202604291006703 | 1367050 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o2026042946501a677971a | 2026-04-29T06:48:47.899Z | 202604299603393 | 245000 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o202604298b6c946cf0493 | 2026-04-29T06:03:20.642Z | 202604297092261 | 59210 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |

## Interpretation

- PASS means the v2 guard ledger has no detected release/block inconsistency in this window.
- A zero-event PASS means no TikTok Purchase interception was observed in the window, not that ads generated no traffic.
- Business ROAS 판단은 이 원장만으로 끝내지 말고 TikTok Ads export, 아임웹/토스 주문, GA4를 함께 대조한다.
