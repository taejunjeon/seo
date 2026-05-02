# TikTok Guard Monitor 24h

- generated_at: 2026-04-30T19:43:48.205Z
- window: 2026-04-29T19:43:48.205Z ~ 2026-04-30T19:43:48.205Z
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

- totalEvents: 252
- uniqueOrderKeys: 81

### countsByAction

- decision_received: 81
- purchase_intercepted: 81
- released_confirmed_purchase: 49
- released_unknown_purchase: 23
- blocked_pending_purchase: 9
- sent_replacement_place_an_order: 9

### countsByDecisionStatus

- unknown: 127
- confirmed: 98
- pending: 27

### countsByDecisionBranch

- allow_purchase: 98
- unknown: 81
- hold_or_block_purchase: 46
- block_purchase_virtual_account: 27

## Anomalies

- none

## Warnings

- released_unknown_purchase rows=23

## Recent Orders

| order | logged_at | order_no | value | actions | decision |
|---|---:|---:|---:|---|---|
| o20260430fb5199edd82ca | 2026-04-30T19:28:06.786Z | 202605016523332 | 278000 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o20260430ba2da7d12f160 | 2026-04-30T18:55:56.873Z | 202605017487988 | 245000 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o202604307ba9c7ceea7f8 | 2026-04-30T18:55:33.829Z | 202605017962669 | 245000 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o2026043057e47f366aff4 | 2026-04-30T16:18:11.092Z | 202605010055570 | 471200 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o2026043089f61ef66da2a | 2026-04-30T15:43:10.236Z | 202605010846570 | 471200 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o202604302f6c5140e7172 | 2026-04-30T15:15:53.405Z | 202605013734755 | 245000 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o202604304d065a7b4df45 | 2026-04-30T15:15:40.457Z | 202605019280945 | 142528 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o20260430f93a067cab190 | 2026-04-30T14:58:44.739Z | 202604307573639 | 459000 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o20260430c3bed4c51e7a4 | 2026-04-30T14:44:44.980Z | 202604304332727 | 234000 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o20260430266993e92af12 | 2026-04-30T14:15:21.941Z | 202604300100404 | 219000 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o20260430416bdc20f828c | 2026-04-30T14:07:59.634Z | 202604308005337 | 471200 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o20260430f8f3fcc9ab9b2 | 2026-04-30T14:05:47.474Z | 202604300550907 | 459000 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o20260430f77359a3f18c5 | 2026-04-30T13:49:00.135Z | 202604303591748 | 234000 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o20260430c6f8033bc0eac | 2026-04-30T13:48:05.725Z | 202604308251572 | 234000 | decision_received, released_unknown_purchase, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o202604300a4dac3924c54 | 2026-04-30T13:33:14.959Z | 202604304718560 | 654000 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o20260430dc88f1e594d0f | 2026-04-30T13:27:17.760Z | 202604304176985 | 245000 | decision_received, released_confirmed_purchase, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o202604306b55ff9c75a2c | 2026-04-30T13:22:42.352Z | 202604305060061 | 99000 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o20260430dd6ba625b7aea | 2026-04-30T13:20:46.677Z | 202604309816653 | 459000 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o20260430d1e748c417b6f | 2026-04-30T13:17:21.699Z | 202604304783667 | 245000 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o202604301a683eb208b7b | 2026-04-30T13:07:16.537Z | 202604303074484 | 459000 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o202604302c1875cd0e085 | 2026-04-30T12:59:10.106Z | 202604308181057 | 234000 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o2026043081c6a1950c455 | 2026-04-30T12:53:03.521Z | 202604304191508 | 459000 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o20260430d501864164250 | 2026-04-30T12:43:36.795Z | 202604300769992 | 234000 | decision_received, released_unknown_purchase, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o20260430bc86a05e502c6 | 2026-04-30T12:19:13.797Z | 202604308991022 | 234000 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o20260430d48facd938365 | 2026-04-30T12:16:19.584Z | 202604304729001 | 459000 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o20260430fce66b74ce415 | 2026-04-30T12:12:04.643Z | 202604303672829 | 234000 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o20260430a92d1b5f0bb4d | 2026-04-30T12:01:02.047Z | 202604306973153 | 80017 | sent_replacement_place_an_order, blocked_pending_purchase, decision_received, purchase_intercepted | pending, unknown / block_purchase_virtual_account, unknown |
| o20260430e10a30435d18d | 2026-04-30T11:57:37.061Z | 202604309382866 | 471200 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o20260430dfd6ac44cd07e | 2026-04-30T11:57:02.489Z | 202604305133317 | 245000 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o20260430aee519ef80979 | 2026-04-30T11:52:00.679Z | 202604305834177 | 459000 | decision_received, released_confirmed_purchase, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |

## Interpretation

- PASS means the v2 guard ledger has no detected release/block inconsistency in this window.
- A zero-event PASS means no TikTok Purchase interception was observed in the window, not that ads generated no traffic.
- Business ROAS 판단은 이 원장만으로 끝내지 말고 TikTok Ads export, 아임웹/토스 주문, GA4를 함께 대조한다.
