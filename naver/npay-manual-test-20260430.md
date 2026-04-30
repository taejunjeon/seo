# NPay ROAS Dry-run Report

Test case: `test_npay_manual_20260430`
Source: TJ manual NPay payment, VM SQLite `npay_intent_log` readonly snapshot, TossPayments API read-only, Imweb legacy v2 API read-only, 운영 Postgres `tb_iamweb_users` readonly.
Primary observation: 2026-04-30 16:00 KST TJ 수동 NPay 테스트 결제는 결제 완료 후 biocom `shop_payment_complete`로 자동 복귀하지 않았고, 네이버페이 완료 화면에서 종료되었다. 2026-04-30 16:22 KST 기준 BigQuery에는 `events_20260430` / `events_intraday_20260430` 테이블이 아직 보이지 않아 GA4 raw 누락 여부는 2026-05-01 재확인 대상으로 둔다.
Confidence: 92% because the NPay intent, Imweb order mapping, and 운영 Postgres order row are confirmed. BigQuery raw export는 아직 후행 확인 대상이다.

Generated at: 2026-04-30T08:49:32.667Z
Window: 2026-04-30T06:58:00.000Z ~ 2026-04-30T07:05:00.000Z

## Input

| field | value |
| --- | --- |
| site | biocom.kr |
| product_url | https://biocom.kr/DietMealBox/?idx=424 |
| product_name | 팀키토 슬로우 에이징 도시락 7종 골라담기 |
| option | 수비드 간장치킨 |
| paid_amount | 11,900 |
| browser | Chrome |
| paid_at | 2026-04-30 16:00 KST |
| completed_at | 2026-04-30 16:01-16:02 KST |
| naverpay_result_url | https://orders.pay.naver.com/order/result/mall/2026043044799490 |
| naverpay_channel_order_no | 2026043044799490 |
| imweb_order_no | 202604309594732 |
| auto_return_to_biocom | no |

## API Checks

공식 근거:

- TossPayments Payment API는 `orderId`로 결제 조회할 수 있지만, 결제 생성 주체가 TossPayments인 주문에 대한 조회 API다. 참고: [TossPayments Payment APIs](https://docs.tosspayments.com/en/api-guide)
- TossPayments webhook은 `PAYMENT_STATUS_CHANGED` 이벤트를 받을 수 있지만, 이번 주문은 NPay 외부 주문형이라 Toss webhook 정본으로 보기 어렵다. 참고: [TossPayments Webhooks](https://docs.tosspayments.com/en/webhooks)
- Imweb legacy v2 주문 API는 `type=npay`와 주문일/상태 필터를 지원한다. 참고: [Imweb legacy 주문 조회](https://old-developers.imweb.me/orders/get)
- Imweb 신규 Open API는 주문-섹션-섹션아이템 구조를 제공하지만, 현재 보유한 legacy token으로 `openapi.imweb.me/orders`는 401이다. 참고: [Imweb 주문 이해하기](https://developers-docs.imweb.me/guide/%EC%A3%BC%EB%AC%B8-%EC%9D%B4%ED%95%B4%ED%95%98%EA%B8%B0)

| source | result |
| --- | --- |
| VM SQLite `npay_intent_log` | intent 1건 확인, duplicate_count 0 |
| intent captured_at | 2026-04-30 16:00:23 KST |
| intent product_idx | 424 |
| intent product_name | 팀키토 슬로우 에이징 도시락 7종 골라담기 |
| intent product_price | 8,900 |
| intent client_id / ga_session_id | 있음 / 있음 |
| Toss API `GET /v1/payments/orders/2026043044799490` | 404 `NOT_FOUND_PAYMENT` |
| Toss API `GET /v1/payments/orders/2026043044799490-P1` | 404 `NOT_FOUND_PAYMENT` |
| Toss API `GET /v1/transactions?startDate=2026-04-30&endDate=2026-04-30` | count 0, 11,900원 후보 없음 |
| Imweb v2 exact `GET /v2/shop/orders/2026043044799490` | 실패. 이 값은 아임웹 order_no가 아님 |
| Imweb v2 window `type=npay`, 15:55-16:10 KST | 1건 확인 |
| Imweb order_no | `202604309594732` |
| Imweb channel_order_no | `2026043044799490` |
| Imweb order_time | 2026-04-30 16:00:24 KST |
| Imweb payment | `pay_type=npay`, `payment_amount=11900`, `total_price=8900`, `deliv_price=3000` |
| Imweb latest Open API `https://openapi.imweb.me/orders` | legacy token으로 401 |
| 운영 Postgres exact order_number `202604309594732` | 1건 확인 |
| 운영 Postgres exact order_number `2026043044799490` | 0건. 이 값은 `channel_order_no`라서 `tb_iamweb_users.order_number`에 없음 |
| 운영 Postgres payment | `payment_method=NAVERPAY_ORDER`, `payment_status=PAYMENT_COMPLETE`, `paid_price=11900`, `final_order_amount=11900` |
| 운영 Postgres 상품/옵션 | 팀키토 슬로우 에이징 도시락 7종 골라담기 / 슬로우 에이징 도시락:수비드 간장치킨 |
| 운영 Postgres 결제완료 | 2026-04-30 16:01:14 KST |

해석:

1. `2026043044799490`은 네이버페이 완료 URL과 Imweb `channel_order_no`다.
2. 실제 Imweb 주문번호는 `202604309594732`다. NPay ROAS dry-run의 주문 원장 키는 이 값을 우선 사용한다.
3. TossPayments API는 이번 주문의 정본이 아니다. `NOT_FOUND_PAYMENT`가 정상적인 결과로 보인다.
4. 운영 Postgres `tb_iamweb_users`도 2026-04-30 17:33 KST 재확인 시점에는 이 주문을 포함한다.
5. 금액은 불일치가 아니라 배송비 포함 여부 차이다. `intent_product_price=8900`, `order_item_total=8900`, `delivery_price=3000`, `order_payment_amount=11900`이므로 `amount_match_type=shipping_reconciled`다.

## Summary

| metric | value |
| --- | --- |
| live_intent_count | 1 |
| confirmed_npay_order_count | 1 |
| strong_match | 1 |
| strong_match_a | 1 |
| strong_match_b | 0 |
| ambiguous | 0 |
| purchase_without_intent | 0 |
| dispatcher_dry_run_candidate | 0 |
| already_in_ga4_blocked | 0 |
| test_order_blocked | 1 |
| manual_order_count | 0 |
| shipping_reconciled_count | 1 |
| shipping_reconciled_not_grade_a_count | 0 |
| clicked_purchased_candidate | 1 |
| clicked_no_purchase | 0 |
| intent_pending | 0 |

## Order Decisions

| order_number | order_label | paid_at | amount | product | status | strong_grade | candidate_count | best_score | second_score | score_gap | time_gap_min | product_name_match | intent_product_price | order_item_total | delivery_price | order_payment_amount | amount_delta | amount_match | amount_reconcile_reason | ga_session_id | ad_key | already_in_ga4 | dispatcher_candidate | dispatcher_block_reason | ambiguous_reason | send_allowed |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 202604309594732 | test_npay_manual_20260430 | 2026-04-30T07:01:14.000Z | 11900 | 팀키토 슬로우 에이징 도시락 7종 골라담기 | strong_match | A | 1 | 80 | - | 80 | 0.8 | exact | 8900 | 8900 | 3000 | 11900 | 3000 | shipping_reconciled | item_exact=true; shipping_reconciled=true; order_payment_amount == order_item_total + delivery_price | Y | Y | absent | N | manual_test_order | - | N |

## Amount Reconciliation

| amount_match_type | orders |
| --- | --- |
| final_exact | 0 |
| item_exact | 0 |
| shipping_reconciled | 1 |
| discount_reconciled | 0 |
| quantity_reconciled | 0 |
| cart_contains_item | 0 |
| near | 0 |
| none | 0 |
| unknown | 0 |

## Top Candidate Intents

| order_number | rank | intent_id | captured_at | time_gap_min | score | score_components | product_idx | order_product_idx | product_name_match | intent_product_price | order_item_total | delivery_price | order_payment_amount | amount_delta | amount_match | amount_reconcile_reason | client_id | ga_session_id | ad_keys | utm |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 202604309594732 | 1 | 572bdc1a-389b-4128-a389-b9750b063c90 | 2026-04-30T07:00:23.688Z | 0.8 | 80 | time:30, product:30, amount:20 | 424 | N/A | exact | 8900 | 8900 | 3000 | 11900 | 3000 | shipping_reconciled | item_exact=true; shipping_reconciled=true; order_payment_amount == order_item_total + delivery_price | Y | Y | fbp | - |

## 2026-05-01 BigQuery Recheck

목적: Imweb `order_no=202604309594732`와 NPay `channel_order_no=2026043044799490` 중 어느 값이 GA4 raw export에 들어왔는지 확인하고, dispatcher 중복 전송을 막는다.

실행 시점: 2026-05-01 오전 또는 `events_20260430` / `events_intraday_20260430` 테이블 생성 확인 이후.

1. 테이블 존재부터 확인한다.

```sql
SELECT table_name
FROM `<PROJECT>.<GA4_DATASET>.INFORMATION_SCHEMA.TABLES`
WHERE table_name IN ('events_20260430', 'events_intraday_20260430')
ORDER BY table_name;
```

2. 테이블이 있으면 `ecommerce.transaction_id` 기준으로 두 번호를 모두 확인한다.

```sql
SELECT
  _TABLE_SUFFIX AS table_suffix,
  event_name,
  TIMESTAMP_MICROS(event_timestamp) AS event_at,
  ecommerce.transaction_id,
  ecommerce.purchase_revenue
FROM `<PROJECT>.<GA4_DATASET>.events_*`
WHERE _TABLE_SUFFIX IN ('20260430', 'intraday_20260430')
  AND ecommerce.transaction_id IN ('202604309594732', '2026043044799490')
ORDER BY event_timestamp;
```

3. `event_params` 전체에서도 두 번호를 찾는다.

```sql
SELECT
  _TABLE_SUFFIX AS table_suffix,
  event_name,
  TIMESTAMP_MICROS(event_timestamp) AS event_at,
  ep.key,
  COALESCE(
    ep.value.string_value,
    CAST(ep.value.int_value AS STRING),
    CAST(ep.value.float_value AS STRING),
    CAST(ep.value.double_value AS STRING)
  ) AS param_value
FROM `<PROJECT>.<GA4_DATASET>.events_*`,
UNNEST(event_params) AS ep
WHERE _TABLE_SUFFIX IN ('20260430', 'intraday_20260430')
  AND COALESCE(
    ep.value.string_value,
    CAST(ep.value.int_value AS STRING),
    CAST(ep.value.float_value AS STRING),
    CAST(ep.value.double_value AS STRING)
  ) IN ('202604309594732', '2026043044799490')
ORDER BY event_timestamp;
```

판정:

| 결과 | 조치 |
| --- | --- |
| 테이블이 아직 없음 | `already_in_ga4=unknown`, dispatcher 후보 제외 |
| 둘 중 하나라도 purchase 또는 raw event에 존재 | `already_in_ga4=present`, dispatcher 후보 제외 |
| 테이블 생성 후 두 쿼리 모두 0건 | `already_in_ga4=absent`, GA4 raw 미수신으로 기록 |

## Guardrail

- 아직 purchase dispatcher를 열지 않는다.
- 이 리포트는 DB 상태를 바꾸지 않는다.
- 이 리포트는 GA4/Meta/TikTok/Google Ads purchase 전송을 하지 않는다.
- A급 strong만 향후 dispatcher dry-run 후보이며, B급 strong은 첫 dispatcher 후보에서 제외한다.
- already_in_ga4가 present 또는 unknown이면 전송 후보에서 제외한다.
- `test_npay_manual_20260430` 라벨 주문은 `manual_test_order`로 전송 후보에서 제외한다.
