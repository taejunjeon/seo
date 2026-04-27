# TikTok Guard Monitor 24h

- generated_at: 2026-04-27T16:54:49.258Z
- window: 2026-04-26T16:54:49.258Z ~ 2026-04-27T16:54:49.258Z
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

- totalEvents: 257
- uniqueOrderKeys: 82

### countsByAction

- decision_received: 82
- purchase_intercepted: 82
- released_confirmed_purchase: 64
- blocked_pending_purchase: 11
- sent_replacement_place_an_order: 11
- released_unknown_purchase: 7

### countsByDecisionStatus

- confirmed: 128
- unknown: 96
- pending: 33

### countsByDecisionBranch

- allow_purchase: 128
- unknown: 82
- block_purchase_virtual_account: 33
- hold_or_block_purchase: 14

## Anomalies

- none

## Warnings

- released_unknown_purchase rows=7

## Recent Orders

| order | logged_at | order_no | value | actions | decision |
|---|---:|---:|---:|---|---|
| o2026042746878703ad61e | 2026-04-27T15:55:07.996Z | 202604281000972 | 510000 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o20260427471ae9f0d37e2 | 2026-04-27T15:32:05.242Z | 202604286816728 | 459000 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o202604271a5a928ce0da8 | 2026-04-27T15:27:22.776Z | 202604289800649 | 268200 | decision_received, released_confirmed_purchase, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o202604273ef491f94b850 | 2026-04-27T15:20:23.010Z | 202604289879164 | 234000 | sent_replacement_place_an_order, blocked_pending_purchase, decision_received, purchase_intercepted | pending, unknown / block_purchase_virtual_account, unknown |
| o20260427016c28339089c | 2026-04-27T15:20:19.981Z | 202604289758373 | 11900 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o202604276adb3e225883d | 2026-04-27T14:57:27.284Z | 202604278349685 | 485000 | decision_received, released_confirmed_purchase, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o20260427d62e96d8c8253 | 2026-04-27T14:43:05.331Z | 202604277847876 | 245000 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o2026042705c0da395af77 | 2026-04-27T13:57:41.725Z | 202604275818534 | 35000 | decision_received, blocked_pending_purchase, sent_replacement_place_an_order, purchase_intercepted | pending, unknown / block_purchase_virtual_account, unknown |
| o20260427b9f9731ac439c | 2026-04-27T13:55:27.448Z | 202604278592541 | 208000 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o20260427bd777436b679a | 2026-04-27T13:51:04.070Z | 202604278917385 | 245000 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o2026042704d8581f8f907 | 2026-04-27T13:29:33.282Z | 202604271668161 | 474200 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o20260427f2997e3843f7a | 2026-04-27T13:23:03.532Z | 202604270669672 | 245000 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o2026042757089af92871f | 2026-04-27T13:07:46.504Z | 202604277502294 | 245000 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o2026042799367c28c87c0 | 2026-04-27T13:05:00.218Z | 202604273883301 | 567312 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o20260427b8cd905b7b8b9 | 2026-04-27T13:02:44.892Z | 202604279618267 | 245000 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o202604272a9b30a3f0f98 | 2026-04-27T12:48:19.729Z | 202604273662859 | 245000 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o20260427d1a565a8b657b | 2026-04-27T12:44:43.376Z | 202604273467847 | 234000 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o202604277df9789d26363 | 2026-04-27T12:44:11.623Z | 202604276585736 | 396800 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o20260427cae741513d9af | 2026-04-27T12:13:33.313Z | 202604278456395 | 234000 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o202604279669bad428572 | 2026-04-27T12:00:42.867Z | 202604276343171 | 218000 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o2026042701727f6c775a8 | 2026-04-27T11:57:12.833Z | 202604275917198 | 245000 | decision_received, blocked_pending_purchase, sent_replacement_place_an_order, purchase_intercepted | pending, unknown / block_purchase_virtual_account, unknown |
| o202604278918521e8654d | 2026-04-27T11:39:18.151Z | 202604279648879 | 234000 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o2026042741ae62069931f | 2026-04-27T11:39:04.119Z | 202604278196159 | 234000 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o2026042754f76b247e3ac | 2026-04-27T11:29:04.971Z | 202604279385954 | 234000 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o20260427945fe68afab11 | 2026-04-27T10:45:40.270Z | 202604274494684 | 283000 | sent_replacement_place_an_order, blocked_pending_purchase, decision_received, purchase_intercepted | pending, unknown / block_purchase_virtual_account, unknown |
| o20260427ca581acbb2fd3 | 2026-04-27T10:38:02.853Z | 202604275035280 | 245000 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o2026042772b1b399a54bc | 2026-04-27T10:32:59.616Z | 202604275676462 | 476000 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o202604279bb31d5b68098 | 2026-04-27T09:55:08.349Z | 202604272075903 | 181409 | decision_received, released_confirmed_purchase, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o20260427f688ce7268190 | 2026-04-27T09:47:48.564Z | 202604276059558 | 245000 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o2026042764ed5a41c15ce | 2026-04-27T09:30:03.620Z | 202604271190064 | 245000 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |

## Interpretation

- PASS means the v2 guard ledger has no detected release/block inconsistency in this window.
- A zero-event PASS means no TikTok Purchase interception was observed in the window, not that ads generated no traffic.
- Business ROAS 판단은 이 원장만으로 끝내지 말고 TikTok Ads export, 아임웹/토스 주문, GA4를 함께 대조한다.
