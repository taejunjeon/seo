# TikTok Guard Monitor 48h

- generated_at: 2026-05-04T22:30:05.424Z
- window: 2026-05-02T22:30:05.424Z ~ 2026-05-04T22:30:05.424Z
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

- totalEvents: 436
- uniqueOrderKeys: 144

### countsByAction

- purchase_intercepted: 145
- decision_received: 144
- released_unknown_purchase: 125
- released_confirmed_purchase: 16
- blocked_pending_purchase: 3
- sent_replacement_place_an_order: 3

### countsByDecisionStatus

- unknown: 395
- confirmed: 32
- pending: 9

### countsByDecisionBranch

- hold_or_block_purchase: 250
- unknown: 145
- allow_purchase: 32
- block_purchase_virtual_account: 9

## Anomalies

- none

## Warnings

- released_unknown_purchase rows=125
- missing final action for order=o2026050452fd780e28d50

## Recent Orders

| order | logged_at | order_no | value | actions | decision |
|---|---:|---:|---:|---|---|
| o20260504f1c84fedf5985 | 2026-05-04T22:22:12.901Z | 202605050514020 | 245000 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o20260504e2d47167b65ca | 2026-05-04T16:28:50.799Z | 202605057563437 | 459000 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o202605044e37c85b55ae0 | 2026-05-04T16:24:22.297Z | 202605053111440 | 260000 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o2026050415ec19bc1da34 | 2026-05-04T16:01:29.904Z | 202605050265873 | 99000 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o20260504304c18062e512 | 2026-05-04T15:57:52.298Z | 202605058660677 | 313500 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o2026050442d27efe9d396 | 2026-05-04T14:58:14.142Z | 202605045819443 | 245000 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o2026050452fd780e28d50 | 2026-05-04T14:26:22.596Z | 202605042894653 | 245000 | purchase_intercepted | unknown / unknown |
| o202605040e5e67d9b7e17 | 2026-05-04T14:07:07.244Z | 202605042631638 | 245000 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o20260504f713f5ea773dd | 2026-05-04T13:53:20.249Z | 202605041639344 | 260000 | released_unknown_purchase, purchase_intercepted, decision_received | unknown / hold_or_block_purchase, unknown |
| o202605042a9233be21d1a | 2026-05-04T13:52:05.077Z | 202605047105133 | 293000 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o20260504c1cdff8ff305c | 2026-05-04T13:11:41.737Z | 202605048852928 | 484500 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o20260504efd7e65c20518 | 2026-05-04T13:05:25.039Z | 202605041182075 | 56870 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o20260504101dda116ed84 | 2026-05-04T12:50:23.331Z | 202605040947812 | 260000 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o20260504b581b1603125f | 2026-05-04T12:36:13.348Z | 202605044909268 | 484500 | released_unknown_purchase, purchase_intercepted, decision_received | unknown / hold_or_block_purchase, unknown |
| o2026050413b1572bae804 | 2026-05-04T12:01:47.066Z | 202605041819859 | 234000 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o2026050436b89e0b41641 | 2026-05-04T11:50:00.833Z | 202605046257780 | 245000 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o2026050472cb0f39b3e02 | 2026-05-04T11:27:54.866Z | 202605044899707 | 154230 | decision_received, released_unknown_purchase, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o20260504af44613ddfa90 | 2026-05-04T11:24:41.888Z | 202605042741225 | 289060 | decision_received, released_unknown_purchase, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o202605042aa6ca5184d9d | 2026-05-04T11:21:59.862Z | 202605041199399 | 245000 | decision_received, released_unknown_purchase, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o20260504105a8a4ec8ad4 | 2026-05-04T11:04:18.431Z | 202605047507355 | 245000 | decision_received, released_unknown_purchase, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o20260504afe6983b14b54 | 2026-05-04T10:58:37.127Z | 202605040997740 | 234000 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o2026050434c51d37b6650 | 2026-05-04T10:56:06.174Z | 202605040391034 | 245000 | purchase_intercepted, decision_received, released_unknown_purchase | unknown / unknown, hold_or_block_purchase |
| o20260504733687428fc97 | 2026-05-04T10:51:38.880Z | 202605040966811 | 283000 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o20260504a313b71b55802 | 2026-05-04T10:35:45.166Z | 202605042243324 | 479500 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o2026050446ad440bf8565 | 2026-05-04T09:47:43.615Z | 202605047152217 | 367000 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o20260504ed049d4ad524d | 2026-05-04T09:43:03.029Z | 202605044158345 | 245000 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o20260504818d18ee5df52 | 2026-05-04T09:25:57.347Z | 202605042451155 | 245000 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o2026050435b69f6ebae08 | 2026-05-04T09:24:28.676Z | 202605042864103 | 0 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o202605043c99eaa5bee8a | 2026-05-04T09:24:00.293Z | 202605042606088 | 295020 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o202605040ee218f33e5ad | 2026-05-04T09:23:43.247Z | 202605047751525 | 234000 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |

## Interpretation

- PASS means the v2 guard ledger has no detected release/block inconsistency in this window.
- A zero-event PASS means no TikTok Purchase interception was observed in the window, not that ads generated no traffic.
- Business ROAS 판단은 이 원장만으로 끝내지 말고 TikTok Ads export, 아임웹/토스 주문, GA4를 함께 대조한다.
