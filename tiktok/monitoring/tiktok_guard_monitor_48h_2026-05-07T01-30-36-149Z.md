# TikTok Guard Monitor 48h

- generated_at: 2026-05-07T01:30:36.149Z
- window: 2026-05-05T01:30:36.149Z ~ 2026-05-07T01:30:36.149Z
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

- totalEvents: 441
- uniqueOrderKeys: 149

### countsByAction

- purchase_intercepted: 149
- decision_received: 147
- released_unknown_purchase: 145

### countsByDecisionStatus

- unknown: 441

### countsByDecisionBranch

- hold_or_block_purchase: 292
- unknown: 149

## Anomalies

- none

## Warnings

- released_unknown_purchase rows=145
- missing final action for order=o20260506e812dd306f1df
- missing final action for order=o20260506ad7b0ba32f4df
- missing final action for order=o20260506b017bc682bab3
- missing final action for order=o202605063016411791670

## Recent Orders

| order | logged_at | order_no | value | actions | decision |
|---|---:|---:|---:|---|---|
| o202605075f716deeda04f | 2026-05-07T01:23:19.409Z | 202605078083394 | 245000 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o2026050758feeed6e7721 | 2026-05-07T01:18:38.299Z | 202605073545833 | 0 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o20260507476573ebcb1c3 | 2026-05-07T00:46:10.861Z | 202605070284290 | 245000 | decision_received, released_unknown_purchase, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o20260507c0b424457d791 | 2026-05-07T00:30:51.113Z | 202605070179730 | 241700 | released_unknown_purchase, purchase_intercepted, decision_received | unknown / hold_or_block_purchase, unknown |
| o20260507b3f9fd14e1ea0 | 2026-05-07T00:15:14.773Z | 202605072652000 | 59800 | decision_received, released_unknown_purchase, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o20260507efc8e621b1670 | 2026-05-07T00:02:39.497Z | 202605070560068 | 49800 | released_unknown_purchase, purchase_intercepted, decision_received | unknown / hold_or_block_purchase, unknown |
| o202605066d257227384cd | 2026-05-06T23:52:52.996Z | 202605074122275 | 245000 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o20260506ef2842fa84b4f | 2026-05-06T23:33:52.326Z | 202605070590741 | 158000 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o202605062756eb9906827 | 2026-05-06T23:09:46.629Z | 202605079875598 | 106000 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o202605069329d184e33cb | 2026-05-06T22:36:37.058Z | 202605073239420 | 530100 | decision_received, purchase_intercepted, released_unknown_purchase | unknown / hold_or_block_purchase, unknown |
| o202605068d2127416879a | 2026-05-06T22:25:24.691Z | 202605072810775 | 260000 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o20260506a9181bdbde446 | 2026-05-06T21:07:32.295Z | 202605076140634 | 292570 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o20260506a0e5fade9e868 | 2026-05-06T19:56:26.028Z | 202605077070535 | 120972 | released_unknown_purchase, purchase_intercepted, decision_received | unknown / hold_or_block_purchase, unknown |
| o202605067f03d7acc5bb2 | 2026-05-06T19:46:56.447Z | 202605075598459 | 117000 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o20260506f2af91f4e0a15 | 2026-05-06T18:32:38.893Z | 202605077341154 | 245000 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o202605065193a05591afe | 2026-05-06T17:20:55.857Z | 202605078909937 | 53200 | released_unknown_purchase, purchase_intercepted, decision_received | unknown / hold_or_block_purchase, unknown |
| o2026050629a728db51afe | 2026-05-06T17:06:34.004Z | 202605075551292 | 99000 | decision_received, released_unknown_purchase, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o20260506064a344d11340 | 2026-05-06T16:56:35.830Z | 202605078017839 | 245000 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o20260506511d621b8ce77 | 2026-05-06T16:44:17.057Z | 202605078326817 | 245000 | released_unknown_purchase, purchase_intercepted, decision_received | unknown / hold_or_block_purchase, unknown |
| o20260506915676f5ac5f5 | 2026-05-06T16:19:59.672Z | 202605079739118 | 291510 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o20260506b670c1662b9c7 | 2026-05-06T16:00:10.787Z | 202605076192299 | 245000 | decision_received, released_unknown_purchase, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o20260506d78de9958e73f | 2026-05-06T15:23:11.947Z | 202605073277446 | 58151 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o20260506a30570d4c0e53 | 2026-05-06T15:17:14.979Z | 202605075668224 | 245000 | released_unknown_purchase, purchase_intercepted, decision_received | unknown / hold_or_block_purchase, unknown |
| o20260506514947a1fce29 | 2026-05-06T14:59:09.473Z | 202605065650872 | 234000 | purchase_intercepted, released_unknown_purchase, decision_received | unknown / unknown, hold_or_block_purchase |
| o2026050689218abcee273 | 2026-05-06T14:57:08.442Z | 202605066769484 | 245000 | purchase_intercepted, decision_received, released_unknown_purchase | unknown / unknown, hold_or_block_purchase |
| o2026050604d5450ce9a66 | 2026-05-06T14:09:54.724Z | 202605068765731 | 49800 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o20260506481b4fc979f80 | 2026-05-06T14:06:44.964Z | 202605067983742 | 99000 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o20260506e812dd306f1df | 2026-05-06T14:02:25.385Z | 202605066807588 | 245000 | decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o20260506bc0f64efeee8a | 2026-05-06T13:25:31.703Z | 202605066973845 | 49800 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o202605065936838e5332a | 2026-05-06T13:12:15.842Z | 202605068652073 | 471200 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |

## Interpretation

- PASS means the v2 guard ledger has no detected release/block inconsistency in this window.
- A zero-event PASS means no TikTok Purchase interception was observed in the window, not that ads generated no traffic.
- Business ROAS 판단은 이 원장만으로 끝내지 말고 TikTok Ads export, 아임웹/토스 주문, GA4를 함께 대조한다.
