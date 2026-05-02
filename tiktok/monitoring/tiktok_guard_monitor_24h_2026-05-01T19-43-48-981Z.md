# TikTok Guard Monitor 24h

- generated_at: 2026-05-01T19:43:48.981Z
- window: 2026-04-30T19:43:48.981Z ~ 2026-05-01T19:43:48.981Z
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

- totalEvents: 224
- uniqueOrderKeys: 71

### countsByAction

- decision_received: 71
- purchase_intercepted: 71
- released_unknown_purchase: 33
- released_confirmed_purchase: 27
- blocked_pending_purchase: 11
- sent_replacement_place_an_order: 11

### countsByDecisionStatus

- unknown: 137
- confirmed: 54
- pending: 33

### countsByDecisionBranch

- unknown: 71
- hold_or_block_purchase: 66
- allow_purchase: 54
- block_purchase_virtual_account: 33

## Anomalies

- none

## Warnings

- released_unknown_purchase rows=33

## Recent Orders

| order | logged_at | order_no | value | actions | decision |
|---|---:|---:|---:|---|---|
| o20260501af6330b5965f9 | 2026-05-01T19:26:08.414Z | 202605021612741 | 245000 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o20260501001bab2a822da | 2026-05-01T16:12:58.748Z | 202605028227303 | 245000 | sent_replacement_place_an_order, blocked_pending_purchase, decision_received, purchase_intercepted | pending, unknown / block_purchase_virtual_account, unknown |
| o20260501aae9645d41860 | 2026-05-01T16:01:27.584Z | 202605028290456 | 234000 | decision_received, released_unknown_purchase, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o20260501e6b38180e06e1 | 2026-05-01T15:44:04.188Z | 202605025072653 | 31507 | sent_replacement_place_an_order, decision_received, blocked_pending_purchase, purchase_intercepted | pending, unknown / block_purchase_virtual_account, unknown |
| o202605016254afb061151 | 2026-05-01T15:35:27.533Z | 202605029075862 | 260000 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o2026050135d7ff23fca74 | 2026-05-01T15:01:56.684Z | 202605010826719 | 471200 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o20260501e31b852520dbc | 2026-05-01T14:01:18.499Z | 202605011513992 | 491000 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o20260501e6d245cc777b7 | 2026-05-01T13:54:22.866Z | 202605013829458 | 245000 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o20260501ca12b6838c550 | 2026-05-01T13:13:14.566Z | 202605016729602 | 245000 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o202605015620298deb4a2 | 2026-05-01T13:06:58.563Z | 202605012683044 | 234000 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o202605019174ad2be8288 | 2026-05-01T13:00:16.637Z | 202605012373156 | 245000 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o202605018836c2e447aaa | 2026-05-01T12:56:01.037Z | 202605014273080 | 459000 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o20260501a07ddb59c2ca6 | 2026-05-01T12:31:24.145Z | 202605014738443 | 0 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o202605012f4d4c650eded | 2026-05-01T12:23:29.881Z | 202605010542334 | 234000 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o2026050115880a0d4a65a | 2026-05-01T12:21:04.974Z | 202605018535041 | 245000 | decision_received, released_confirmed_purchase, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o202605018f474a1a53449 | 2026-05-01T12:10:57.535Z | 202605012043990 | 4753 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o20260501405e6bcbf26d0 | 2026-05-01T12:03:50.231Z | 202605018335071 | 234000 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o20260501ea86bdf178b34 | 2026-05-01T11:51:00.652Z | 202605011624674 | 245000 | decision_received, released_unknown_purchase, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o20260501544b298b14941 | 2026-05-01T11:31:25.508Z | 202605016799658 | 459000 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o20260501c9dc92c727259 | 2026-05-01T11:26:18.139Z | 202605015828222 | 245000 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o202605015006dd365bde3 | 2026-05-01T10:30:16.770Z | 202605014100167 | 725000 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o202605012de2ad367c7ce | 2026-05-01T10:07:34.326Z | 202605018351983 | 234000 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o20260501856fe080e5ed3 | 2026-05-01T09:02:36.497Z | 202605013084561 | 234000 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o20260501233edfe447247 | 2026-05-01T07:27:19.627Z | 202605018741296 | 292530 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o202605017062b307b4fdf | 2026-05-01T06:36:02.254Z | 202605014968032 | 245000 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o2026050128bc22ace120c | 2026-05-01T06:34:08.434Z | 202605013579052 | 245000 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o202605017a4bfc675fa0b | 2026-05-01T05:59:51.165Z | 202605010949260 | 234000 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o2026050152a89ad734a4d | 2026-05-01T05:42:19.480Z | 202605013260240 | 476000 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o20260501e41272b28e602 | 2026-05-01T05:27:02.903Z | 202605012927636 | 179400 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o2026050171f900ebc226c | 2026-05-01T05:00:20.745Z | 202605012519564 | 471200 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |

## Interpretation

- PASS means the v2 guard ledger has no detected release/block inconsistency in this window.
- A zero-event PASS means no TikTok Purchase interception was observed in the window, not that ads generated no traffic.
- Business ROAS 판단은 이 원장만으로 끝내지 말고 TikTok Ads export, 아임웹/토스 주문, GA4를 함께 대조한다.
