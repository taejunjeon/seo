# Path B same-browser preservation Preview diff

작성 시각: 2026-05-10 00:56 KST

## 한 줄 결론

새 GTM 작업공간은 주문완료 화면에서만 Path B no-send endpoint를 호출하는 Preview 전용 tag 1개와 trigger 1개를 추가했다. 기존 live tag는 수정, pause, delete하지 않았고 Production publish도 하지 않았다.

## GTM workspace

- container: `GTM-W2Z6PHN`
- workspace id: `167`
- workspace name: `AGENT_OS_path_b_controlled_traffic_preview_20260509T155435Z`
- live version at setup: `143`
- submit/create_version/publish: 0
- Default Workspace 사용: NO
- fresh workspace 사용: YES

## 추가한 tag

- tag id: `301`
- tag name: `AGENT_OS_path_b_controlled_traffic_hmac_write_preview_20260509T155435Z`
- type: Custom HTML
- endpoint: `https://att.ainativeos.net/api/attribution/order-bridge/identity-hmac/no-send`
- external platform send: 없음
- raw response echo: 없음이어야 함
- would_send: 항상 false

## 추가한 trigger

- trigger id: `300`
- trigger name: `AGENT_OS_path_b_order_confirm_controlled_traffic_20260509T155435Z`
- type: pageview
- scope: order confirmation paths only
- path regex: `shop_payment_complete|shop_order_done|payment_complete|order_complete`
- All Pages trigger: NO

## 읽는 값

주문완료 화면에서 아래 값을 후보로 읽는다.

- `email`: 기존 legacy user_id 값 또는 화면/dataLayer 후보. raw 저장 금지.
- `order_no`: URL/referrer/dataLayer/storage 후보.
- `client_id`, `ga_session_id`, `local_session_id`: dataLayer/storage/cookie 후보.
- `click_id`: URL/dataLayer/storage 후보.
- storage key: `bi_paid_click_intent_v1`, `__bs_imweb`, `__pathb_order_bridge_preview`

## 이번 same-browser test의 차이

이전 direct test는 주문완료 URL에 TEST gclid를 직접 붙일 수 있었다. 이번에는 주문완료 URL에 gclid를 붙이지 않고, 먼저 상품상세 URL에 TEST gclid를 붙여 `bi_paid_click_intent_v1` storage가 만들어지는지 확인했다.

## 금지선 준수

- GTM Production publish: 0
- GTM submit/create_version: 0
- existing live tag pause/delete: 0
- Imweb production save: 0
- actual payment: 0
- real ad click: 0
- Google Ads/GA4/Meta/TikTok/Naver conversion send: 0
- raw email/phone/member_code/order/payment storage/logging: 0

