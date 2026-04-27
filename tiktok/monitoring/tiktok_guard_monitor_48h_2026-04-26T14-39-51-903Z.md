# TikTok Guard Monitor 48h

- generated_at: 2026-04-26T14:39:51.903Z
- window: 2026-04-24T14:39:51.903Z ~ 2026-04-26T14:39:51.903Z
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

- totalEvents: 350
- uniqueOrderKeys: 111

### countsByAction

- decision_received: 111
- purchase_intercepted: 111
- released_confirmed_purchase: 88
- blocked_pending_purchase: 17
- sent_replacement_place_an_order: 17
- released_unknown_purchase: 6

### countsByDecisionStatus

- confirmed: 176
- unknown: 123
- pending: 51

### countsByDecisionBranch

- allow_purchase: 176
- unknown: 111
- block_purchase_virtual_account: 51
- hold_or_block_purchase: 12

## Anomalies

- none

## Warnings

- released_unknown_purchase rows=6

## Recent Orders

| order | logged_at | order_no | value | actions | decision |
|---|---:|---:|---:|---|---|
| o20260426dccb48d2ad99d | 2026-04-26T14:35:16.178Z | 202604269278267 | 245000 | sent_replacement_place_an_order, blocked_pending_purchase, decision_received, purchase_intercepted | pending, unknown / block_purchase_virtual_account, unknown |
| o202604261af7165107519 | 2026-04-26T14:28:06.572Z | 202604265406500 | 484500 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o2026042624ce1f7dfc994 | 2026-04-26T14:13:54.598Z | 202604266772400 | 459000 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o202604263fa9ffef703d1 | 2026-04-26T14:08:49.989Z | 202604261270246 | 234000 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o2026042684ec7ca038093 | 2026-04-26T13:45:49.183Z | 202604264669303 | 283000 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o202604261eb37d403d999 | 2026-04-26T13:22:55.912Z | 202604260079913 | 245000 | decision_received, released_confirmed_purchase, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o20260426b364b0c902765 | 2026-04-26T13:18:06.101Z | 202604262618783 | 234000 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o20260426c80e0ddc0efe5 | 2026-04-26T13:05:53.438Z | 202604260628180 | 234000 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o202604264ffafbc67cebb | 2026-04-26T12:46:11.087Z | 202604269631966 | 234000 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o20260426feb83abd0853b | 2026-04-26T12:41:13.849Z | 202604265839940 | 245000 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o2026042657122c8e529bf | 2026-04-26T12:23:26.056Z | 202604269470895 | 99000 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o202604264e6096dc5fecc | 2026-04-26T12:16:41.107Z | 202604260926606 | 245000 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o202604260c983476dfcbc | 2026-04-26T12:16:20.257Z | 202604261683153 | 34300 | sent_replacement_place_an_order, blocked_pending_purchase, purchase_intercepted, decision_received | pending, unknown / block_purchase_virtual_account, unknown |
| o2026042699ff0cb43aae6 | 2026-04-26T12:15:35.303Z | 202604268763396 | 26319 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o20260426c84905cbfcb6e | 2026-04-26T12:10:23.922Z | 202604266417077 | 234000 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o20260426db6c78591e822 | 2026-04-26T12:06:16.875Z | 202604264058195 | 459000 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o20260426ac6c8c0585d85 | 2026-04-26T12:03:19.659Z | 202604261129661 | 245000 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o2026042697cd6966fdebc | 2026-04-26T11:54:51.309Z | 202604261477230 | 361800 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o20260426823e9f974e215 | 2026-04-26T11:52:54.724Z | 202604265098030 | 245000 | sent_replacement_place_an_order, blocked_pending_purchase, decision_received, purchase_intercepted | pending, unknown / block_purchase_virtual_account, unknown |
| o202604261407f4858dd97 | 2026-04-26T11:50:26.299Z | 202604267447534 | 166320 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o20260426fc4e9dc15ec82 | 2026-04-26T11:46:58.379Z | 202604265445528 | 245000 | sent_replacement_place_an_order, blocked_pending_purchase, decision_received, purchase_intercepted | pending, unknown / block_purchase_virtual_account, unknown |
| o20260426b6a2f81006210 | 2026-04-26T11:46:00.499Z | 202604264021356 | 471200 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o2026042683f0be23e9d18 | 2026-04-26T11:45:33.828Z | 202604261710886 | 245000 | sent_replacement_place_an_order, blocked_pending_purchase, decision_received, purchase_intercepted | pending, unknown / block_purchase_virtual_account, unknown |
| o20260426c7dfaf5a4c5c3 | 2026-04-26T11:28:26.677Z | 202604267408904 | 234000 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o20260426270788e51c4c1 | 2026-04-26T11:20:09.319Z | 202604266820151 | 245000 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o2026042684140b2a41576 | 2026-04-26T11:07:44.387Z | 202604262047005 | 282840 | sent_replacement_place_an_order, decision_received, blocked_pending_purchase, purchase_intercepted | pending, unknown / block_purchase_virtual_account, unknown |
| o20260426252880ddebe35 | 2026-04-26T11:01:15.565Z | 202604265461652 | 245000 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o20260426e33aabbe03ae9 | 2026-04-26T10:55:42.704Z | 202604266008804 | 234000 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o202604266a98505b7e189 | 2026-04-26T10:24:01.420Z | 202604269279044 | 491000 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o202604264355916eafdfd | 2026-04-26T09:46:17.368Z | 202604269842902 | 459000 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |

## Interpretation

- PASS means the v2 guard ledger has no detected release/block inconsistency in this window.
- A zero-event PASS means no TikTok Purchase interception was observed in the window, not that ads generated no traffic.
- Business ROAS 판단은 이 원장만으로 끝내지 말고 TikTok Ads export, 아임웹/토스 주문, GA4를 함께 대조한다.
