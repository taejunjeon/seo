# TikTok Guard Monitor 24h

- generated_at: 2026-05-05T22:33:00.581Z
- window: 2026-05-04T22:33:00.581Z ~ 2026-05-05T22:33:00.581Z
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

- totalEvents: 197
- uniqueOrderKeys: 66

### countsByAction

- purchase_intercepted: 66
- released_unknown_purchase: 66
- decision_received: 65

### countsByDecisionStatus

- unknown: 197

### countsByDecisionBranch

- hold_or_block_purchase: 131
- unknown: 66

## Anomalies

- none

## Warnings

- released_unknown_purchase rows=66

## Recent Orders

| order | logged_at | order_no | value | actions | decision |
|---|---:|---:|---:|---|---|
| o202605051216ad9ab93f5 | 2026-05-05T21:47:19.457Z | 202605066791468 | 89426 | decision_received, released_unknown_purchase, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o202605057d168e3ae6c86 | 2026-05-05T17:54:26.211Z | 202605064376043 | 255000 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o20260505e3c2de7c1c9c0 | 2026-05-05T17:24:05.828Z | 202605063838970 | 260000 | released_unknown_purchase, purchase_intercepted, decision_received | unknown / hold_or_block_purchase, unknown |
| o20260505e900c24b515cb | 2026-05-05T16:11:58.801Z | 202605068986585 | 245000 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o2026050591778a1b0b801 | 2026-05-05T15:34:43.887Z | 202605062215641 | 245000 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o20260505c3ac74b930660 | 2026-05-05T15:14:24.068Z | 202605065963208 | 245000 | released_unknown_purchase, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o202605050dacde0af25bd | 2026-05-05T15:06:05.989Z | 202605062450118 | 409640 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o2026050538fedbfdd5959 | 2026-05-05T14:59:48.261Z | 202605052640134 | 234000 | decision_received, purchase_intercepted, released_unknown_purchase | unknown / hold_or_block_purchase, unknown |
| o202605050899ceb4d1f80 | 2026-05-05T14:34:00.439Z | 202605057389358 | 459000 | decision_received, released_unknown_purchase, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o20260505d98a3dc6a4473 | 2026-05-05T14:32:35.866Z | 202605054013465 | 245000 | purchase_intercepted, released_unknown_purchase, decision_received | unknown / unknown, hold_or_block_purchase |
| o20260505d90350cf08dbf | 2026-05-05T14:13:17.543Z | 202605058237136 | 64000 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o20260505630f94e7fd58b | 2026-05-05T13:48:01.611Z | 202605053408839 | 234000 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o20260505f90e66a6604a6 | 2026-05-05T13:36:02.718Z | 202605054253569 | 234000 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o20260505c282045fd44a5 | 2026-05-05T13:16:39.781Z | 202605058574716 | 283000 | released_unknown_purchase, purchase_intercepted, decision_received | unknown / hold_or_block_purchase, unknown |
| o202605055179b8ad18f6c | 2026-05-05T13:13:33.157Z | 202605055359176 | 245000 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o202605058ca772325b619 | 2026-05-05T12:51:49.630Z | 202605050590305 | 245000 | purchase_intercepted, decision_received, released_unknown_purchase | unknown / unknown, hold_or_block_purchase |
| o202605057866843498bc2 | 2026-05-05T12:39:10.853Z | 202605054545087 | 245000 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o2026050589a7828c3729f | 2026-05-05T12:37:17.827Z | 202605055362679 | 245000 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o2026050553a4081a8b7d1 | 2026-05-05T12:16:49.263Z | 202605057751410 | 49800 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o202605059028963e94acc | 2026-05-05T11:27:44.413Z | 202605057735706 | 459000 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o2026050589094860da08e | 2026-05-05T11:22:05.853Z | 202605058400659 | 234000 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o2026050577399abf0ea9c | 2026-05-05T11:19:06.362Z | 202605054252994 | 245000 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o20260505deb0e21d68973 | 2026-05-05T11:09:37.978Z | 202605056258337 | 27300 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o202605054a44887c3e83f | 2026-05-05T10:56:53.721Z | 202605057835596 | 675000 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o20260505dbd21a10657c4 | 2026-05-05T10:52:54.364Z | 202605055626978 | 79672 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o202605059def1d8d451a6 | 2026-05-05T10:34:22.291Z | 202605058950414 | 245000 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o20260505751a0a6e8be37 | 2026-05-05T09:04:20.901Z | 202605056482366 | 245000 | decision_received, released_unknown_purchase, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o20260505232b0ef712f4e | 2026-05-05T08:59:04.638Z | 202605059950752 | 459000 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o2026050587f38aa45137f | 2026-05-05T08:36:19.692Z | 202605054633665 | 234000 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o20260505907f25b8ea926 | 2026-05-05T08:10:14.444Z | 202605059391431 | 234000 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |

## Interpretation

- PASS means the v2 guard ledger has no detected release/block inconsistency in this window.
- A zero-event PASS means no TikTok Purchase interception was observed in the window, not that ads generated no traffic.
- Business ROAS 판단은 이 원장만으로 끝내지 말고 TikTok Ads export, 아임웹/토스 주문, GA4를 함께 대조한다.
