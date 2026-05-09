# TikTok Guard Monitor 24h

- generated_at: 2026-05-09T03:05:03.626Z
- window: 2026-05-08T03:05:03.626Z ~ 2026-05-09T03:05:03.626Z
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

- totalEvents: 133
- uniqueOrderKeys: 45

### countsByAction

- purchase_intercepted: 45
- decision_received: 44
- released_unknown_purchase: 44

### countsByDecisionStatus

- unknown: 133

### countsByDecisionBranch

- hold_or_block_purchase: 88
- unknown: 45

## Anomalies

- none

## Warnings

- released_unknown_purchase rows=44
- missing final action for order=o2026050859736fa1d250a

## Recent Orders

| order | logged_at | order_no | value | actions | decision |
|---|---:|---:|---:|---|---|
| o20260509f2e2d00682438 | 2026-05-09T02:53:25.775Z | 202605092490677 | 496000 | decision_received, released_unknown_purchase, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o202605096e80eebd26ab4 | 2026-05-09T02:53:11.543Z | 202605096652989 | 153454 | released_unknown_purchase, purchase_intercepted, decision_received | unknown / hold_or_block_purchase, unknown |
| o20260509d9600f90915ce | 2026-05-09T01:28:37.506Z | 202605095620320 | 245000 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o2026050982532a0cba5ed | 2026-05-09T01:26:41.996Z | 202605093742647 | 245000 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o20260509f07203f07c8bb | 2026-05-09T01:13:33.106Z | 202605099003556 | 240000 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o20260508f011d6381f675 | 2026-05-08T23:46:05.761Z | 202605098156101 | 260000 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o20260508c69411e1a6b17 | 2026-05-08T22:33:27.632Z | 202605092540601 | 188000 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o2026050859736fa1d250a | 2026-05-08T22:12:57.131Z | 202605098504227 | 234000 | purchase_intercepted | unknown / unknown |
| o20260508212a043bee114 | 2026-05-08T21:15:58.637Z | 202605099218735 | 98100 | decision_received, released_unknown_purchase, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o20260508edcd65451afa1 | 2026-05-08T20:25:42.655Z | 202605091029333 | 245000 | decision_received, released_unknown_purchase, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o20260508dd28cccee9929 | 2026-05-08T16:54:24.492Z | 202605097364044 | 283100 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o20260508a0f153183edcf | 2026-05-08T16:28:58.529Z | 202605092808730 | 11900 | decision_received, released_unknown_purchase, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o202605088fe8ceebe7920 | 2026-05-08T15:44:25.272Z | 202605090122600 | 69900 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o202605089ea46acfef2c4 | 2026-05-08T15:24:58.272Z | 202605099235107 | 11900 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o202605086698bb5f418f2 | 2026-05-08T15:06:16.318Z | 202605099160003 | 240000 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o202605089b53b34789877 | 2026-05-08T15:02:06.415Z | 202605086959864 | 12622 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o20260508b2911cb564cf9 | 2026-05-08T14:37:26.679Z | 202605089460432 | 245000 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o2026050842ab7e9aa85f9 | 2026-05-08T14:33:14.550Z | 202605089848622 | 46060 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o202605081ed8e93a207e0 | 2026-05-08T14:12:03.359Z | 202605089166933 | 245000 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o202605089e108707c487c | 2026-05-08T13:01:02.784Z | 202605082733299 | 634000 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o202605082ff05d6f43dfa | 2026-05-08T12:37:51.392Z | 202605081860826 | 245000 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o20260508117f4971d4d13 | 2026-05-08T12:32:05.713Z | 202605088050284 | 471200 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o202605083a5670fdd03ad | 2026-05-08T12:29:17.844Z | 202605085864531 | 245000 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o2026050845c16ada07f2d | 2026-05-08T11:52:52.715Z | 202605084683569 | 174000 | released_unknown_purchase, purchase_intercepted, decision_received | unknown / hold_or_block_purchase, unknown |
| o20260508088709c68b063 | 2026-05-08T10:32:00.185Z | 202605085670020 | 723375 | decision_received, released_unknown_purchase, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o2026050860a1f1b7d3495 | 2026-05-08T09:03:27.870Z | 202605086685834 | 15683 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o20260508c25611eb613de | 2026-05-08T08:57:15.357Z | 202605089421206 | 0 | decision_received, released_unknown_purchase, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o20260508ee44d10cfbafc | 2026-05-08T08:39:03.481Z | 202605084258634 | 245000 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o20260508629b105be514a | 2026-05-08T08:26:19.830Z | 202605081800508 | 245000 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o202605085a836e91569df | 2026-05-08T08:22:14.154Z | 202605087592379 | 0 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |

## Interpretation

- PASS means the v2 guard ledger has no detected release/block inconsistency in this window.
- A zero-event PASS means no TikTok Purchase interception was observed in the window, not that ads generated no traffic.
- Business ROAS 판단은 이 원장만으로 끝내지 말고 TikTok Ads export, 아임웹/토스 주문, GA4를 함께 대조한다.
