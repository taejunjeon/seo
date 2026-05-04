# TikTok Guard Monitor 48h

- generated_at: 2026-05-02T19:43:45.377Z
- window: 2026-04-30T19:43:45.377Z ~ 2026-05-02T19:43:45.377Z
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

- totalEvents: 377
- uniqueOrderKeys: 121

### countsByAction

- decision_received: 121
- purchase_intercepted: 121
- released_unknown_purchase: 57
- released_confirmed_purchase: 50
- blocked_pending_purchase: 14
- sent_replacement_place_an_order: 14

### countsByDecisionStatus

- unknown: 235
- confirmed: 100
- pending: 42

### countsByDecisionBranch

- unknown: 121
- hold_or_block_purchase: 114
- allow_purchase: 100
- block_purchase_virtual_account: 42

## Anomalies

- none

## Warnings

- released_unknown_purchase rows=57

## Recent Orders

| order | logged_at | order_no | value | actions | decision |
|---|---:|---:|---:|---|---|
| o202605022a005cfa6f10e | 2026-05-02T16:24:48.975Z | 202605032367365 | 26754 | decision_received, released_unknown_purchase, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o20260502e40c789932ac1 | 2026-05-02T16:12:54.248Z | 202605033205623 | 156849 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o20260502c9d76cae07cb9 | 2026-05-02T16:00:07.696Z | 202605037551791 | 99000 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o20260502cfa569a32eb64 | 2026-05-02T15:52:24.498Z | 202605032066543 | 12359 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o20260502a0a035128ba07 | 2026-05-02T15:25:53.238Z | 202605033130831 | 245000 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o20260502c0c1ce5d28e95 | 2026-05-02T15:11:28.316Z | 202605035698347 | 11900 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o202605021bec71044267b | 2026-05-02T15:08:20.067Z | 202605030593116 | 459000 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o20260502cefce95befefd | 2026-05-02T14:38:26.259Z | 202605022907364 | 264325 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o20260502aecdeb5a0a691 | 2026-05-02T14:30:56.363Z | 202605026007608 | 245000 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o20260502f8aaa7018869d | 2026-05-02T13:59:56.504Z | 202605021050111 | 245000 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o20260502dd2f6625f691a | 2026-05-02T13:45:05.429Z | 202605027272282 | 260000 | decision_received, released_unknown_purchase, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o20260502e968c3d3b8278 | 2026-05-02T12:56:09.526Z | 202605022960793 | 249000 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o20260502299de95733ee4 | 2026-05-02T12:29:07.625Z | 202605023812275 | 234000 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o20260502bea1b35b23f63 | 2026-05-02T12:27:52.994Z | 202605020049758 | 107000 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o202605029c0822bf0573f | 2026-05-02T12:18:07.236Z | 202605026221725 | 234000 | sent_replacement_place_an_order, blocked_pending_purchase, decision_received, purchase_intercepted | pending, unknown / block_purchase_virtual_account, unknown |
| o20260502308ea27812fc6 | 2026-05-02T11:25:39.474Z | 202605029541206 | 484500 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o2026050214585a74ccda9 | 2026-05-02T11:21:52.797Z | 202605028261931 | 188000 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o202605021e6754711dbd1 | 2026-05-02T11:20:51.351Z | 202605021913748 | 245000 | sent_replacement_place_an_order, blocked_pending_purchase, decision_received, purchase_intercepted | pending, unknown / block_purchase_virtual_account, unknown |
| o2026050209124342ead9e | 2026-05-02T11:04:24.084Z | 202605029193646 | 504900 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o202605027e80f43b6d31c | 2026-05-02T09:02:38.216Z | 202605025162282 | 245000 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o202605028a3c92970c236 | 2026-05-02T07:39:41.126Z | 202605029659916 | 234000 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o20260502fd614075c6fc4 | 2026-05-02T06:21:43.753Z | 202605025283515 | 245000 | decision_received, released_unknown_purchase, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o202605029ddf9e6482eb1 | 2026-05-02T06:20:37.044Z | 202605023872018 | 159000 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o202605028020d77f3238b | 2026-05-02T06:17:21.916Z | 202605021372139 | 245000 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o20260502568f4ee645011 | 2026-05-02T04:32:56.097Z | 202605029983458 | 240000 | decision_received, released_unknown_purchase, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o2026050279624e6aa5629 | 2026-05-02T04:32:55.683Z | 202605026173788 | 240000 | decision_received, released_unknown_purchase, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o2026050220d4f834410d1 | 2026-05-02T04:26:02.387Z | 202605021417817 | 67716 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |
| o202605020eba6c7ae1f80 | 2026-05-02T04:04:29.120Z | 202605024571402 | 38885 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o202605026e3abbdb93117 | 2026-05-02T03:54:44.540Z | 202605022002132 | 788 | released_unknown_purchase, decision_received, purchase_intercepted | unknown / hold_or_block_purchase, unknown |
| o20260502d70de3c5d8cad | 2026-05-02T03:49:02.034Z | 202605027769010 | 25396 | released_confirmed_purchase, decision_received, purchase_intercepted | confirmed, unknown / allow_purchase, unknown |

## Interpretation

- PASS means the v2 guard ledger has no detected release/block inconsistency in this window.
- A zero-event PASS means no TikTok Purchase interception was observed in the window, not that ads generated no traffic.
- Business ROAS 판단은 이 원장만으로 끝내지 말고 TikTok Ads export, 아임웹/토스 주문, GA4를 함께 대조한다.
