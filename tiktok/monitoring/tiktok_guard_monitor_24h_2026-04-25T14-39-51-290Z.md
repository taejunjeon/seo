# TikTok Guard Monitor 24h

- generated_at: 2026-04-25T14:39:51.290Z
- window: 2026-04-24T14:39:51.290Z ~ 2026-04-25T14:39:51.290Z
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

- totalEvents: 164
- uniqueOrderKeys: 52

### countsByAction

- decision_received: 52
- purchase_intercepted: 52
- released_confirmed_purchase: 43
- blocked_pending_purchase: 8
- sent_replacement_place_an_order: 8
- released_unknown_purchase: 1

### countsByDecisionStatus

- confirmed: 86
- unknown: 54
- pending: 24

### countsByDecisionBranch

- allow_purchase: 86
- unknown: 52
- block_purchase_virtual_account: 24
- hold_or_block_purchase: 2

## Anomalies

- none

## Warnings

- released_unknown_purchase rows=1

## Recent Orders

| order | logged_at | order_no | value | actions | decision |
|---|---:|---:|---:|---|---|
| o20260425fa475f7834cd0 | 2026-04-25T13:42:24.212Z | 202604254862129 | 245000 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o202604257f1ba522d18cd | 2026-04-25T13:11:18.295Z | 202604251863426 | 250000 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o20260425ed2ff403b9393 | 2026-04-25T12:44:45.061Z | 202604250295799 | 245000 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o20260425374eae360d185 | 2026-04-25T11:26:32.255Z | 202604257682306 | 245000 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o2026042501cce7b032d49 | 2026-04-25T10:51:06.426Z | 202604250250172 | 234000 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o2026042555be906c835a0 | 2026-04-25T10:08:28.810Z | 202604256326624 | 107000 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o202604250803438c79366 | 2026-04-25T09:56:26.266Z | 202604255724733 | 245000 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o202604255e9ff80ba9baf | 2026-04-25T09:53:50.518Z | 202604251348612 | 245000 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o20260425fcd64646139c2 | 2026-04-25T09:53:40.804Z | 202604255126259 | 245000 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o20260425db061f0950c9c | 2026-04-25T09:50:08.648Z | 202604254185455 | 1838250 | sent_replacement_place_an_order, decision_received, blocked_pending_purchase, purchase_intercepted | pending, unknown / block_purchase_virtual_account, unknown |
| o2026042515ef0b284ef27 | 2026-04-25T08:49:41.366Z | 202604254749312 | 245000 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o202604258171d55d23a04 | 2026-04-25T08:27:52.966Z | 202604254213799 | 245000 | sent_replacement_place_an_order, blocked_pending_purchase, decision_received, purchase_intercepted | pending, unknown / block_purchase_virtual_account, unknown |
| o20260425fd5088d0f7e05 | 2026-04-25T08:20:49.354Z | 202604258620081 | 234000 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o20260425e8169317cf2f0 | 2026-04-25T07:13:04.279Z | 202604259704928 | 231550 | sent_replacement_place_an_order, blocked_pending_purchase, decision_received, purchase_intercepted | pending, unknown / block_purchase_virtual_account, unknown |
| o20260425148d4e5accd3c | 2026-04-25T07:09:52.524Z | 202604250472233 | 188000 | decision_received, released_confirmed_purchase, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o20260425f97876f67dfec | 2026-04-25T06:41:31.103Z | 202604253782344 | 234000 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o202604253c05b2464641d | 2026-04-25T06:09:02.569Z | 202604250209475 | 245000 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o20260425ab58f4795cd36 | 2026-04-25T05:53:32.951Z | 202604258172310 | 496000 | decision_received, released_confirmed_purchase, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o202604255208c2baaa0fd | 2026-04-25T05:15:20.986Z | 202604252192616 | 471200 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o20260425e1a731173ac37 | 2026-04-25T05:02:33.577Z | 202604258813196 | 234000 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o20260425f3f70dde58a3e | 2026-04-25T04:52:21.480Z | 202604256193715 | 107282 | sent_replacement_place_an_order, blocked_pending_purchase, decision_received, purchase_intercepted | pending, unknown / block_purchase_virtual_account, unknown |
| o20260425c6c150a7aaef5 | 2026-04-25T04:37:25.070Z | 202604253505513 | 245000 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o20260425f50a5024d40ab | 2026-04-25T04:26:59.711Z | 202604250012765 | 459000 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o20260425bbc480c167de1 | 2026-04-25T04:06:48.526Z | 202604256953360 | 234000 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o20260425feca59036cc82 | 2026-04-25T04:02:39.996Z | 202604257659506 | 485000 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o20260425380c514e03deb | 2026-04-25T03:52:54.266Z | 202604252792627 | 234000 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o20260425c0858ce242db0 | 2026-04-25T03:52:24.637Z | 202604258300326 | 245000 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o20260425a5d66c7c2ebe5 | 2026-04-25T02:42:05.099Z | 202604252097328 | 99000 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o20260425998ff922853a8 | 2026-04-25T02:22:06.094Z | 202604251631749 | 245000 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o20260425b17f7246a3690 | 2026-04-25T02:15:46.262Z | 202604251602866 | 485000 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |

## Interpretation

- PASS means the v2 guard ledger has no detected release/block inconsistency in this window.
- A zero-event PASS means no TikTok Purchase interception was observed in the window, not that ads generated no traffic.
- Business ROAS 판단은 이 원장만으로 끝내지 말고 TikTok Ads export, 아임웹/토스 주문, GA4를 함께 대조한다.
