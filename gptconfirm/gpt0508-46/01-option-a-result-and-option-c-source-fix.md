# Option A Result And Option C Source Fix

## Option A 결과 보정

옵션 A 수동 `sync-order-statuses`는 실행됐고 VM Cloud `imweb_orders.imweb_status`는 채워졌습니다.

- biocom status update: 7,316건.
- thecleancoffee status update: 2,310건.
- aibio status update: 2건.

하지만 summary API의 NPay 매출은 `complete_time` 기준이었기 때문에 옵션 A만으로는 실제 결제완료 기준 화면으로 바뀌지 않았습니다. 즉 "status sync 미실행"은 원인 중 하나였지만, 이번 dashboard 병목의 핵심은 summary source가 `complete_time`에 묶여 있었다는 점입니다.

## Option C source fix

기준을 아래처럼 고정했습니다.

- 실제 결제완료 primary: 운영DB `public.tb_iamweb_users`, `NAVERPAY_ORDER + PAYMENT_COMPLETE + 취소/반품 제외 + 금액 양수`.
- bridge source: `site_landing_ledger → imweb_orders.order_code/order_no → 운영DB order_number`.
- diagnostic source: `complete_time`, `imweb_status`, `raw_json.orderStatus`.
- forbidden proxy: `complete_time` 공백만으로 미결제 판정, `imweb_status`만으로 actual purchase 판정, NPay click/count/add_payment_info 구매 승격.

## 현재 숫자

biocom은 actual confirmed가 운영DB에서 aggregate로 붙습니다.

- actual confirmed: 163건 / ₩29,500,200.
- legacy complete_time live: 128건 / ₩25,664,000.
- bridge pending: 59건 / ₩7,841,600.

thecleancoffee는 운영DB `tb_iamweb_users` site 격리가 아직 증명되지 않았습니다. 그래서 actual confirmed로 승격하지 않고 bridge_pending으로 둡니다.
