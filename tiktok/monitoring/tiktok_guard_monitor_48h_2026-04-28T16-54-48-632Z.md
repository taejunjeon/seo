# TikTok Guard Monitor 48h

- generated_at: 2026-04-28T16:54:48.632Z
- window: 2026-04-26T16:54:48.632Z ~ 2026-04-28T16:54:48.632Z
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

- totalEvents: 525
- uniqueOrderKeys: 168

### countsByAction

- decision_received: 168
- purchase_intercepted: 168
- released_confirmed_purchase: 126
- blocked_pending_purchase: 21
- released_unknown_purchase: 21
- sent_replacement_place_an_order: 21

### countsByDecisionStatus

- confirmed: 252
- unknown: 210
- pending: 63

### countsByDecisionBranch

- allow_purchase: 252
- unknown: 168
- block_purchase_virtual_account: 63
- hold_or_block_purchase: 42

## Anomalies

- none

## Warnings

- released_unknown_purchase rows=21

## Recent Orders

| order | logged_at | order_no | value | actions | decision |
|---|---:|---:|---:|---|---|
| o20260428aff94774323b6 | 2026-04-28T16:06:07.366Z | 202604290668226 | 245000 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o202604285b8cb12538fd8 | 2026-04-28T15:51:11.005Z | 202604290741414 | 234000 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o202604288df3e37bf937f | 2026-04-28T15:47:57.968Z | 202604296637873 | 234000 | decision_received, released_confirmed_purchase, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o20260428a2fb87f4eed08 | 2026-04-28T15:43:17.704Z | 202604293097133 | 234000 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o20260428ed7e2f07f7910 | 2026-04-28T15:12:05.421Z | 202604292486096 | 106438 | purchase_intercepted, released_unknown_purchase, decision_received | unknown / unknown, hold_or_block_purchase |
| o20260428054b4ecf7c6d3 | 2026-04-28T15:10:07.183Z | 202604291740102 | 245000 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o2026042857beacb235e05 | 2026-04-28T14:59:37.490Z | 202604283411848 | 234000 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o2026042800cdd5316c3e9 | 2026-04-28T14:59:22.670Z | 202604282356787 | 459000 | decision_received, released_confirmed_purchase, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o2026042830c54c0cf83cc | 2026-04-28T14:54:48.185Z | 202604285730164 | 178200 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o20260428c8d2316958ebc | 2026-04-28T14:51:28.483Z | 202604282032758 | 459000 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o202604285de1715b785d3 | 2026-04-28T14:49:09.675Z | 202604280849844 | 245000 | sent_replacement_place_an_order, blocked_pending_purchase, decision_received, purchase_intercepted | pending, unknown / block_purchase_virtual_account, unknown |
| o20260428104c059a5a6dd | 2026-04-28T14:31:41.857Z | 202604288295007 | 234000 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o2026042859abb23486b37 | 2026-04-28T13:51:52.638Z | 202604289447757 | 245000 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o20260428d80d928ef9c4c | 2026-04-28T13:48:39.159Z | 202604282045054 | 234000 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o20260428f66be631d8371 | 2026-04-28T13:24:42.427Z | 202604288836072 | 234000 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o20260428d088e79d62504 | 2026-04-28T13:15:01.652Z | 202604287147787 | 909000 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o20260428a8a771c643a48 | 2026-04-28T12:45:57.456Z | 202604281320760 | 234000 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o2026042820e0cdad661a8 | 2026-04-28T12:41:32.213Z | 202604285948639 | 234000 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o202604287ee3434c1e4bf | 2026-04-28T12:37:45.782Z | 202604281779367 | 245000 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o20260428d738f9a70ebc6 | 2026-04-28T12:35:09.507Z | 202604283404922 | 675000 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o20260428d41f767afb027 | 2026-04-28T12:10:37.330Z | 202604280977981 | 245000 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o20260428a7026f9b0a1f2 | 2026-04-28T11:42:01.052Z | 202604283174209 | 234000 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o202604288b8b606a57560 | 2026-04-28T11:26:24.625Z | 202604282801948 | 459000 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o20260428343a24897a6b5 | 2026-04-28T11:15:38.856Z | 202604284163587 | 530100 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o20260428c05fb52841f48 | 2026-04-28T11:02:53.562Z | 202604288868577 | 459000 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o20260428361aaf3f3143b | 2026-04-28T10:15:09.792Z | 202604283663101 | 396800 | released_confirmed_purchase, purchase_intercepted, decision_received | confirmed, unknown / allow_purchase, unknown |
| o202604284f21d4764f6e1 | 2026-04-28T10:10:42.485Z | 202604282414189 | 459000 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o2026042854b12a5384825 | 2026-04-28T09:54:07.277Z | 202604282016885 | 136270 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o202604289687d9c081bb1 | 2026-04-28T09:34:15.106Z | 202604288309347 | 268200 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o20260428f801a25c9024e | 2026-04-28T09:17:52.477Z | 202604285620365 | 245000 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |

## Interpretation

- PASS means the v2 guard ledger has no detected release/block inconsistency in this window.
- A zero-event PASS means no TikTok Purchase interception was observed in the window, not that ads generated no traffic.
- Business ROAS 판단은 이 원장만으로 끝내지 말고 TikTok Ads export, 아임웹/토스 주문, GA4를 함께 대조한다.
