# NPay ROAS Dry-run Report

Generated at: 2026-04-30T10:07:51.789Z
Window: 2026-04-27T09:10:00.000Z ~ 2026-04-30T10:10:00.000Z

## Summary

| metric | value |
| --- | --- |
| live_intent_count | 299 |
| confirmed_npay_order_count | 11 |
| strong_match | 8 |
| strong_match_a | 6 |
| strong_match_b | 2 |
| ambiguous | 3 |
| purchase_without_intent | 0 |
| dispatcher_dry_run_candidate | 0 |
| already_in_ga4_blocked | 0 |
| already_in_ga4_lookup_present | 0 |
| already_in_ga4_lookup_absent | 1 |
| already_in_ga4_lookup_unknown | 10 |
| ga4_lookup_required_order_count | 5 |
| ga4_lookup_id_count | 10 |
| test_order_blocked | 1 |
| manual_order_count | 0 |
| shipping_reconciled_count | 1 |
| shipping_reconciled_not_grade_a_count | 0 |
| clicked_purchased_candidate | 8 |
| clicked_no_purchase | 208 |
| intent_pending | 83 |

## Early Phase2 Decision Package

현재 누적 표본으로 먼저 진행할 수 있는 일과 아직 막아야 하는 일을 분리한다. 이 섹션은 승인안 준비용이며, 실제 전송이나 DB 업데이트를 하지 않는다.

| decision_item | status | evidence | next_action |
| --- | --- | --- | --- |
| 현재 표본 조기 진행 | 가능 | 299 intents / 11 confirmed NPay orders | BigQuery guard, 수동 검토, GA4 MP 제한 테스트 승인안까지만 진행 |
| 자동 dispatcher | 금지 | ambiguous 3건 (27.27%), already_in_ga4 unknown 10건 | 7일 후보정 전 자동/대량 전송 금지 |
| GA4 MP 제한 테스트 | 준비 가능 | A급 production 후보 5건, unknown 5건 | 두 ID 모두 GA4 absent 확인 + TJ 승인 후에만 실제 전송 |
| clicked_no_purchase 해석 | 가능 | 208건 | 상품/광고키/시간대 가설 작성. audience 전송은 7일 후보정 후 |

## Order Decisions

| order_number | channel_order_no | order_label | paid_at | amount | product | status | strong_grade | candidate_count | best_score | second_score | score_gap | time_gap_min | product_name_match | intent_product_price | order_item_total | delivery_price | order_payment_amount | amount_delta | amount_match | amount_reconcile_reason | ga_session_id | ad_key | already_in_ga4 | dispatcher_candidate | dispatcher_block_reason | ambiguous_reason | send_allowed |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 202604275329932 | 2026042761751160 | production_order | 2026-04-27T13:52:16.000Z | 117000 | 뉴로마스터 60정 (1개월분) | ambiguous | - | 15 | 60 | 50 | 10 | 0.2 | exact | 35000 | 117000 | 0 | 117000 | 82000 | none | amount_not_reconciled | Y | Y | unknown | N | ambiguous, not_a_grade_strong, already_in_ga4_unknown | multiple_intents_same_product, same_product_multiple_clicks, amount_not_reconciled, no_member_key, low_score_gap, cart_multi_item_possible | N |
| 202604289063428 | 2026042865161940 | production_order | 2026-04-27T19:24:52.000Z | 496000 | 종합 대사기능&음식물 과민증 검사 Set | ambiguous | - | 25 | 80 | 70 | 10 | 0.3 | exact | 496000 | 496000 | 0 | 496000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | unknown | N | ambiguous, not_a_grade_strong, already_in_ga4_unknown | multiple_intents_same_product, same_product_multiple_clicks, no_member_key, low_score_gap | N |
| 202604280487104 | 2026042865542930 | production_order | 2026-04-27T21:13:24.000Z | 35000 | 뉴로마스터 60정 (1개월분) | strong_match | A | 25 | 80 | 52 | 28 | 0.3 | exact | 35000 | 35000 | 0 | 35000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | unknown | N | already_in_ga4_unknown | - | N |
| 202604285552452 | 2026042867285600 | production_order | 2026-04-27T23:27:09.000Z | 496000 | 종합 대사기능&음식물 과민증 검사 Set | strong_match | A | 25 | 70 | 52 | 18 | 1.4 | exact | 496000 | 496000 | 0 | 496000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | unknown | N | already_in_ga4_unknown | - | N |
| 202604283756893 | 2026042875392500 | production_order | 2026-04-28T04:03:41.000Z | 975000 | 종합 대사기능&음식물 과민증 검사 Set | strong_match | B | 25 | 50 | 32 | 18 | 7.5 | exact | 496000 | 975000 | 0 | 975000 | 479000 | none | amount_not_reconciled | Y | Y | unknown | N | not_a_grade_strong, already_in_ga4_unknown | - | N |
| 202604295198830 | 2026042916849620 | production_order | 2026-04-29T05:22:18.000Z | 496000 | 종합 대사기능&음식물 과민증 검사 Set | ambiguous | - | 25 | 80 | 70 | 10 | 0.6 | exact | 496000 | 496000 | 0 | 496000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | unknown | N | ambiguous, not_a_grade_strong, already_in_ga4_unknown | multiple_intents_same_product, same_product_multiple_clicks, no_member_key, low_score_gap | N |
| 202604303307399 | 2026043034982320 | production_order | 2026-04-30T00:19:10.000Z | 496000 | 종합 대사기능&음식물 과민증 검사 Set | strong_match | A | 25 | 70 | 52 | 18 | 1.3 | exact | 496000 | 496000 | 0 | 496000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | unknown | N | already_in_ga4_unknown | - | N |
| 202604309992065 | 2026043040116970 | production_order | 2026-04-30T03:41:30.000Z | 35000 | 뉴로마스터 60정 (1개월분) | strong_match | A | 25 | 80 | 52 | 28 | 0.7 | exact | 35000 | 35000 | 0 | 35000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | unknown | N | already_in_ga4_unknown | - | N |
| 202604303298608 | 2026043043127990 | production_order | 2026-04-30T05:47:54.000Z | 148200 | 다빈치랩 메가프로바이오틱 ND50 (MEGA PROBIOTIC ND50) 30일분 | strong_match | B | 25 | 60 | 20 | 40 | 0.7 | exact | 54900 | 148200 | 0 | 148200 | 93300 | none | amount_not_reconciled | Y | Y | unknown | N | not_a_grade_strong, already_in_ga4_unknown | - | N |
| 202604302383065 | 2026043043205620 | production_order | 2026-04-30T05:50:59.000Z | 35000 | 뉴로마스터 60정 (1개월분) | strong_match | A | 25 | 80 | 52 | 28 | 0.7 | exact | 35000 | 35000 | 0 | 35000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | unknown | N | already_in_ga4_unknown | - | N |
| 202604309594732 | 2026043044799490 | test_npay_manual_20260430 | 2026-04-30T07:01:14.000Z | 11900 | 팀키토 슬로우 에이징 도시락 7종 골라담기 | strong_match | A | 25 | 80 | 20 | 60 | 0.8 | exact | 8900 | 8900 | 3000 | 11900 | 3000 | shipping_reconciled | item_exact=true; shipping_reconciled=true; order_payment_amount == order_item_total + delivery_price | Y | Y | absent | N | manual_test_order | - | N |

## Ambiguous Reason Breakdown

| reason | orders | share | order_numbers |
| --- | --- | --- | --- |
| low_score_gap | 3 | 100% | 202604275329932, 202604289063428, 202604295198830 |
| multiple_intents_same_product | 3 | 100% | 202604275329932, 202604289063428, 202604295198830 |
| no_member_key | 3 | 100% | 202604275329932, 202604289063428, 202604295198830 |
| same_product_multiple_clicks | 3 | 100% | 202604275329932, 202604289063428, 202604295198830 |
| amount_not_reconciled | 1 | 33.33% | 202604275329932 |
| cart_multi_item_possible | 1 | 33.33% | 202604275329932 |

## Manual Review Queue

아래 주문은 자동 전송 후보가 아니다. 수동 검토로 규칙을 보강하거나 전송 제외를 확정해야 한다.

| order_number | channel_order_no | review_group | amount | product | best_score | second_score | score_gap | time_gap_min | amount_match | why_review | dispatch_decision | next_action |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 202604275329932 | 2026042761751160 | ambiguous | 117000 | 뉴로마스터 60정 (1개월분) | 60 | 50 | 10 | 0.2 | none | multiple_intents_same_product, same_product_multiple_clicks, amount_not_reconciled, no_member_key, low_score_gap, cart_multi_item_possible | 전송 금지 | 같은 상품 반복 클릭, score_gap, 금액/장바구니 여부를 수동 확인 |
| 202604289063428 | 2026042865161940 | ambiguous | 496000 | 종합 대사기능&음식물 과민증 검사 Set | 80 | 70 | 10 | 0.3 | final_exact | multiple_intents_same_product, same_product_multiple_clicks, no_member_key, low_score_gap | 전송 금지 | 같은 상품 반복 클릭, score_gap, 금액/장바구니 여부를 수동 확인 |
| 202604283756893 | 2026042875392500 | b_grade_strong | 975000 | 종합 대사기능&음식물 과민증 검사 Set | 50 | 32 | 18 | 7.5 | none | not_a_grade_strong, already_in_ga4_unknown | 전송 금지 | 금액 조정 가능성 또는 장바구니/수량 구조 확인 |
| 202604295198830 | 2026042916849620 | ambiguous | 496000 | 종합 대사기능&음식물 과민증 검사 Set | 80 | 70 | 10 | 0.6 | final_exact | multiple_intents_same_product, same_product_multiple_clicks, no_member_key, low_score_gap | 전송 금지 | 같은 상품 반복 클릭, score_gap, 금액/장바구니 여부를 수동 확인 |
| 202604303298608 | 2026043043127990 | b_grade_strong | 148200 | 다빈치랩 메가프로바이오틱 ND50 (MEGA PROBIOTIC ND50) 30일분 | 60 | 20 | 40 | 0.7 | none | not_a_grade_strong, already_in_ga4_unknown | 전송 금지 | 금액 조정 가능성 또는 장바구니/수량 구조 확인 |

## Clicked No Purchase Breakdown

아래 표는 `clicked_no_purchase` intent만 대상으로 한 read-only 분해다. 구매 전환 전송 대상이 아니며, 리마케팅/결제 UX 점검용이다.

### By Product

| product_idx | product_name | clicked_no_purchase | share |
| --- | --- | --- | --- |
| 97 | 바이오밸런스 90정 (1개월분) | 51 | 24.52% |
| 198 | 뉴로마스터 60정 (1개월분) | 38 | 18.27% |
| 317 | 혈당관리엔 당당케어 (120정) | 38 | 18.27% |
| 171 | 풍성밸런스 90정 (1개월분) | 19 | 9.13% |
| 386 | 메타드림 식물성 멜라토닌 함유 | 19 | 9.13% |
| 328 | 종합 대사기능&음식물 과민증 검사 Set | 18 | 8.65% |
| 300 | 영데이즈 저속노화 SOD 효소 (15포) | 15 | 7.21% |
| 225 | 다래케어 180정 (1개월분) | 4 | 1.92% |
| 409 | 리셋데이 글루텐분해효소 알파CD 차전자피 K-낙산균 | 2 | 0.96% |
| 171 | 풍성밸런스 비오틴 맥주효모 아연 L시스틴 머리카락 탈모 예방 영양제 | 1 | 0.48% |
| 21 | 다빈치랩 메가프로바이오틱 ND50 (MEGA PROBIOTIC ND50) 30일분 | 1 | 0.48% |
| 423 | 팀키토 저포드맵 도시락 7종 골라담기 | 1 | 0.48% |
| 97 | 바이오밸런스 피로회복 영양제 마그네슘 아연 셀레늄 비타민D 바이오미네랄 활성산소 | 1 | 0.48% |

### By Ad Key

| ad_key_combo | clicked_no_purchase | share |
| --- | --- | --- |
| gclid+fbp | 179 | 86.06% |
| fbp | 19 | 9.13% |
| fbclid+fbc+fbp | 7 | 3.37% |
| fbc+fbp | 1 | 0.48% |
| gclid | 1 | 0.48% |
| gclid+gbraid+fbp | 1 | 0.48% |

### By KST Hour

| kst_hour | clicked_no_purchase | share |
| --- | --- | --- |
| 2026-04-27 18:00 KST | 3 | 1.44% |
| 2026-04-27 19:00 KST | 1 | 0.48% |
| 2026-04-27 20:00 KST | 4 | 1.92% |
| 2026-04-27 21:00 KST | 2 | 0.96% |
| 2026-04-27 22:00 KST | 5 | 2.4% |
| 2026-04-27 23:00 KST | 3 | 1.44% |
| 2026-04-28 00:00 KST | 1 | 0.48% |
| 2026-04-28 01:00 KST | 2 | 0.96% |
| 2026-04-28 02:00 KST | 1 | 0.48% |
| 2026-04-28 03:00 KST | 2 | 0.96% |
| 2026-04-28 04:00 KST | 9 | 4.33% |
| 2026-04-28 05:00 KST | 2 | 0.96% |
| 2026-04-28 06:00 KST | 3 | 1.44% |
| 2026-04-28 07:00 KST | 3 | 1.44% |
| 2026-04-28 08:00 KST | 2 | 0.96% |
| 2026-04-28 09:00 KST | 4 | 1.92% |
| 2026-04-28 10:00 KST | 11 | 5.29% |
| 2026-04-28 11:00 KST | 8 | 3.85% |
| 2026-04-28 12:00 KST | 20 | 9.62% |
| 2026-04-28 13:00 KST | 11 | 5.29% |
| 2026-04-28 14:00 KST | 4 | 1.92% |
| 2026-04-28 15:00 KST | 4 | 1.92% |
| 2026-04-28 16:00 KST | 3 | 1.44% |
| 2026-04-28 18:00 KST | 3 | 1.44% |
| 2026-04-28 19:00 KST | 2 | 0.96% |
| 2026-04-28 20:00 KST | 1 | 0.48% |
| 2026-04-28 22:00 KST | 1 | 0.48% |
| 2026-04-29 00:00 KST | 8 | 3.85% |
| 2026-04-29 01:00 KST | 2 | 0.96% |
| 2026-04-29 02:00 KST | 2 | 0.96% |
| 2026-04-29 03:00 KST | 1 | 0.48% |
| 2026-04-29 04:00 KST | 5 | 2.4% |
| 2026-04-29 05:00 KST | 2 | 0.96% |
| 2026-04-29 06:00 KST | 2 | 0.96% |
| 2026-04-29 07:00 KST | 6 | 2.88% |
| 2026-04-29 08:00 KST | 1 | 0.48% |
| 2026-04-29 09:00 KST | 2 | 0.96% |
| 2026-04-29 10:00 KST | 3 | 1.44% |
| 2026-04-29 11:00 KST | 7 | 3.37% |
| 2026-04-29 12:00 KST | 13 | 6.25% |
| 2026-04-29 13:00 KST | 4 | 1.92% |
| 2026-04-29 14:00 KST | 15 | 7.21% |
| 2026-04-29 15:00 KST | 14 | 6.73% |
| 2026-04-29 16:00 KST | 6 | 2.88% |

### Action Queue

상위 미결제 클릭 상품은 purchase가 아니라 결제 UX와 리마케팅 검토 후보로만 본다.

| product_idx | product_name | clicked_no_purchase | share | analysis_action | guardrail |
| --- | --- | --- | --- | --- | --- |
| 97 | 바이오밸런스 90정 (1개월분) | 51 | 24.52% | 상품 상세/가격/배송비/결제 UX 가설 작성 | 7일 후보정 전 audience 전송 금지 |
| 198 | 뉴로마스터 60정 (1개월분) | 38 | 18.27% | 상품 상세/가격/배송비/결제 UX 가설 작성 | 7일 후보정 전 audience 전송 금지 |
| 317 | 혈당관리엔 당당케어 (120정) | 38 | 18.27% | 상품 상세/가격/배송비/결제 UX 가설 작성 | 7일 후보정 전 audience 전송 금지 |
| 171 | 풍성밸런스 90정 (1개월분) | 19 | 9.13% | 상품 상세/가격/배송비/결제 UX 가설 작성 | 7일 후보정 전 audience 전송 금지 |
| 386 | 메타드림 식물성 멜라토닌 함유 | 19 | 9.13% | 상품 상세/가격/배송비/결제 UX 가설 작성 | 7일 후보정 전 audience 전송 금지 |
| 328 | 종합 대사기능&음식물 과민증 검사 Set | 18 | 8.65% | 상품 상세/가격/배송비/결제 UX 가설 작성 | 7일 후보정 전 audience 전송 금지 |
| 300 | 영데이즈 저속노화 SOD 효소 (15포) | 15 | 7.21% | 상품 상세/가격/배송비/결제 UX 가설 작성 | 7일 후보정 전 audience 전송 금지 |
| 225 | 다래케어 180정 (1개월분) | 4 | 1.92% | 상품 상세/가격/배송비/결제 UX 가설 작성 | 7일 후보정 전 audience 전송 금지 |
| 409 | 리셋데이 글루텐분해효소 알파CD 차전자피 K-낙산균 | 2 | 0.96% | 상품 상세/가격/배송비/결제 UX 가설 작성 | 7일 후보정 전 audience 전송 금지 |
| 171 | 풍성밸런스 비오틴 맥주효모 아연 L시스틴 머리카락 탈모 예방 영양제 | 1 | 0.48% | 상품 상세/가격/배송비/결제 UX 가설 작성 | 7일 후보정 전 audience 전송 금지 |

## BigQuery Lookup IDs

A급 production 후보는 `order_number`와 `channel_order_no`를 모두 GA4 raw/purchase에서 조회한다. 둘 중 하나라도 존재하면 `already_in_ga4=present`로 막고, 둘 다 조회해 absent가 확인된 경우에만 dispatcher dry-run 후보가 된다.

| order_number | channel_order_no | lookup_ids | candidate_scope | already_in_ga4 | lookup_status |
| --- | --- | --- | --- | --- | --- |
| 202604280487104 | 2026042865542930 | 202604280487104, 2026042865542930 | a_grade_production_candidate | unknown | BigQuery 확인 필요 |
| 202604285552452 | 2026042867285600 | 202604285552452, 2026042867285600 | a_grade_production_candidate | unknown | BigQuery 확인 필요 |
| 202604303307399 | 2026043034982320 | 202604303307399, 2026043034982320 | a_grade_production_candidate | unknown | BigQuery 확인 필요 |
| 202604309992065 | 2026043040116970 | 202604309992065, 2026043040116970 | a_grade_production_candidate | unknown | BigQuery 확인 필요 |
| 202604302383065 | 2026043043205620 | 202604302383065, 2026043043205620 | a_grade_production_candidate | unknown | BigQuery 확인 필요 |

### BigQuery Query Template

아래 쿼리는 템플릿이다. `<PROJECT>.<GA4_DATASET>`를 실제 GA4 export dataset으로 바꿔 실행한다. `order_number`와 `channel_order_no` 중 하나라도 조회되면 해당 주문은 `already_in_ga4=present`로 막는다.

```sql
WITH ids AS (
  SELECT id FROM UNNEST(['202604280487104', '2026042865542930', '202604285552452', '2026042867285600', '202604303307399', '2026043034982320', '202604309992065', '2026043040116970', '202604302383065', '2026043043205620']) AS id
)
SELECT
  event_date,
  event_timestamp,
  event_name,
  ecommerce.transaction_id AS ecommerce_transaction_id,
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'transaction_id') AS event_param_transaction_id,
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'pay_method') AS pay_method
FROM `<PROJECT>.<GA4_DATASET>.events_*`
WHERE _TABLE_SUFFIX BETWEEN '20260427' AND '20260430'
  AND (
    ecommerce.transaction_id IN (SELECT id FROM ids)
    OR (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'transaction_id') IN (SELECT id FROM ids)
    OR EXISTS (
      SELECT 1
      FROM UNNEST(event_params) ep
      WHERE ep.value.string_value IN (SELECT id FROM ids)
    )
  )
ORDER BY event_timestamp;
```

## Dispatcher Dry-run Log

아래 표는 GA4 Measurement Protocol payload preview다. 실제 전송은 하지 않고, `send_candidate=Y`인 행도 승인 전까지 전송 금지다.

| order_number | channel_order_no | matched_intent_id | client_id | ga_session_id | value | currency | event_id | send_candidate | block_reason |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 202604275329932 | 2026042761751160 | 5c1fe505-6130-482d-b33c-45535823b5f4 | 880190675.1777297553 | 1777297553 | 117000 | KRW | NPayRecoveredPurchase_202604275329932 | N | ambiguous, not_a_grade_strong, already_in_ga4_unknown |
| 202604289063428 | 2026042865161940 | 5a4c859f-3771-4b87-8ba2-13cb58ac5820 | 828165815.1777317234 | 1777317234 | 496000 | KRW | NPayRecoveredPurchase_202604289063428 | N | ambiguous, not_a_grade_strong, already_in_ga4_unknown |
| 202604280487104 | 2026042865542930 | 84060938-5e29-46d5-894f-105fac1b6d62 | 695356435.1777324290 | 1777324290 | 35000 | KRW | NPayRecoveredPurchase_202604280487104 | N | already_in_ga4_unknown |
| 202604285552452 | 2026042867285600 | 6ed1547f-3846-4da3-ad91-c6d00c42509e | 806449930.1777331701 | 1777331701 | 496000 | KRW | NPayRecoveredPurchase_202604285552452 | N | already_in_ga4_unknown |
| 202604283756893 | 2026042875392500 | c42232c8-de9e-43ee-8c18-4105aa28aeeb | 772603471.1777340977 | 1777348462 | 975000 | KRW | NPayRecoveredPurchase_202604283756893 | N | not_a_grade_strong, already_in_ga4_unknown |
| 202604295198830 | 2026042916849620 | 4479b9b8-1827-4dff-a998-70613562bd22 | 1738862242.1777439744 | 1777439744 | 496000 | KRW | NPayRecoveredPurchase_202604295198830 | N | ambiguous, not_a_grade_strong, already_in_ga4_unknown |
| 202604303307399 | 2026043034982320 | b0234ffc-fede-48f5-a313-87480a4884e2 | 901508731.1765852144 | 1777508260 | 496000 | KRW | NPayRecoveredPurchase_202604303307399 | N | already_in_ga4_unknown |
| 202604309992065 | 2026043040116970 | aa6cb8b7-4e55-4731-8fe2-c65dc269e6cc | 118292165.1777520272 | 1777520272 | 35000 | KRW | NPayRecoveredPurchase_202604309992065 | N | already_in_ga4_unknown |
| 202604303298608 | 2026043043127990 | 9eb98bc2-d36d-4c1d-88d9-e2f28d4046c9 | 1536913857.1775778564 | 1777527909 | 148200 | KRW | NPayRecoveredPurchase_202604303298608 | N | not_a_grade_strong, already_in_ga4_unknown |
| 202604302383065 | 2026043043205620 | 34356f9b-33ee-4a5e-88f6-44e52d808ad0 | 2007220387.1777523364 | 1777527289 | 35000 | KRW | NPayRecoveredPurchase_202604302383065 | N | already_in_ga4_unknown |
| 202604309594732 | 2026043044799490 | 572bdc1a-389b-4128-a389-b9750b063c90 | 349382661.1770783461 | 1777532376 | 11900 | KRW | NPayRecoveredPurchase_202604309594732 | N | manual_test_order |

## Amount Reconciliation

| amount_match_type | orders |
| --- | --- |
| final_exact | 7 |
| item_exact | 0 |
| shipping_reconciled | 1 |
| discount_reconciled | 0 |
| quantity_reconciled | 0 |
| cart_contains_item | 0 |
| near | 0 |
| none | 3 |
| unknown | 0 |

## Top Candidate Intents

| order_number | channel_order_no | rank | intent_id | captured_at | time_gap_min | score | score_components | product_idx | order_product_idx | product_name_match | intent_product_price | order_item_total | delivery_price | order_payment_amount | amount_delta | amount_match | amount_reconcile_reason | client_id | ga_session_id | ad_keys | utm |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 202604275329932 | 2026042761751160 | 1 | 5c1fe505-6130-482d-b33c-45535823b5f4 | 2026-04-27T13:52:04.342Z | 0.2 | 60 | time:30, product:30, amount:0 | 198 | N/A | exact | 35000 | 117000 | 0 | 117000 | 82000 | none | amount_not_reconciled | Y | Y | fbp | - |
| 202604275329932 | 2026042761751160 | 2 | 1c08431f-dd1f-496b-afe3-2c516556eb60 | 2026-04-27T13:48:56.588Z | 3.3 | 50 | time:20, product:30, amount:0 | 198 | N/A | exact | 35000 | 117000 | 0 | 117000 | 82000 | none | amount_not_reconciled | Y | Y | fbp | - |
| 202604275329932 | 2026042761751160 | 3 | 1ecb6bfc-f264-40c4-b4c8-4879b5af43e7 | 2026-04-27T13:28:51.109Z | 23.4 | 40 | time:10, product:30, amount:0 | 198 | N/A | exact | 35000 | 117000 | 0 | 117000 | 82000 | none | amount_not_reconciled | Y | Y | gclid, fbp | googleads_shopping_supplements_neuromaster |
| 202604275329932 | 2026042761751160 | 4 | 4daca36b-984f-46db-bc7e-0791c704a40e | 2026-04-27T10:50:57.681Z | 181.3 | 32 | time:2, product:30, amount:0 | 198 | N/A | exact | 35000 | 117000 | 0 | 117000 | 82000 | none | amount_not_reconciled | Y | Y | gclid, fbp | googleads_shopping_supplements_neuromaster |
| 202604275329932 | 2026042761751160 | 5 | 468e84ea-12c4-4698-9fcf-1f6a20d5cd2c | 2026-04-27T09:52:17.944Z | 240 | 16 | time:2, product:14, amount:0 | 97 | N/A | token_overlap | 39000 | 117000 | 0 | 117000 | 78000 | none | amount_not_reconciled | Y | Y | gclid, fbp | googleads_shopping_supplements_biobalance |
| 202604289063428 | 2026042865161940 | 1 | 5a4c859f-3771-4b87-8ba2-13cb58ac5820 | 2026-04-27T19:24:32.704Z | 0.3 | 80 | time:30, product:30, amount:20 | 328 | N/A | exact | 496000 | 496000 | 0 | 496000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | fbp | - |
| 202604289063428 | 2026042865161940 | 2 | 3ff4066f-d896-4375-99d8-d253568d1e77 | 2026-04-27T19:23:02.051Z | 1.8 | 70 | time:20, product:30, amount:20 | 328 | N/A | exact | 496000 | 496000 | 0 | 496000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | fbp | - |
| 202604289063428 | 2026042865161940 | 3 | 1c3c4428-6fcb-41a3-9652-958958507629 | 2026-04-27T19:22:11.826Z | 2.7 | 70 | time:20, product:30, amount:20 | 328 | N/A | exact | 496000 | 496000 | 0 | 496000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | fbp | - |
| 202604289063428 | 2026042865161940 | 4 | 5375d801-8257-4777-9820-f19a6f318129 | 2026-04-27T14:05:26.346Z | 319.4 | 52 | time:2, product:30, amount:20 | 328 | N/A | exact | 496000 | 496000 | 0 | 496000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | fbp | tiktok_biocom_yeonddle_iggacidset |
| 202604289063428 | 2026042865161940 | 5 | 4dc09cb3-2137-4dfb-ac3d-9d68d90d4014 | 2026-04-27T18:57:02.097Z | 27.8 | 10 | time:10, product:0, amount:0 | 171 | N/A | none | 35000 | 496000 | 0 | 496000 | 461000 | none | amount_not_reconciled | Y | Y | gclid, fbp | googleads_shopping_supplements_poongsung |
| 202604280487104 | 2026042865542930 | 1 | 84060938-5e29-46d5-894f-105fac1b6d62 | 2026-04-27T21:13:08.637Z | 0.3 | 80 | time:30, product:30, amount:20 | 198 | N/A | exact | 35000 | 35000 | 0 | 35000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | fbclid, fbc, fbp | meta_master_slow |
| 202604280487104 | 2026042865542930 | 2 | 353f6ed8-87d0-43b0-8252-e89e5cf6e911 | 2026-04-27T16:01:27.086Z | 311.9 | 52 | time:2, product:30, amount:20 | 198 | N/A | exact | 35000 | 35000 | 0 | 35000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | gclid, fbp | googleads_shopping_supplements_neuromaster |
| 202604280487104 | 2026042865542930 | 3 | 6d4f4176-dba8-4d05-89a8-068996425473 | 2026-04-27T14:00:53.496Z | 432.5 | 52 | time:2, product:30, amount:20 | 198 | N/A | exact | 35000 | 35000 | 0 | 35000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | fbclid, fbc, fbp | meta_biocom_nurostory_nuro |
| 202604280487104 | 2026042865542930 | 4 | 5c1fe505-6130-482d-b33c-45535823b5f4 | 2026-04-27T13:52:04.342Z | 441.3 | 52 | time:2, product:30, amount:20 | 198 | N/A | exact | 35000 | 35000 | 0 | 35000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | fbp | - |
| 202604280487104 | 2026042865542930 | 5 | 1c08431f-dd1f-496b-afe3-2c516556eb60 | 2026-04-27T13:48:56.588Z | 444.5 | 52 | time:2, product:30, amount:20 | 198 | N/A | exact | 35000 | 35000 | 0 | 35000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | fbp | - |
| 202604285552452 | 2026042867285600 | 1 | 6ed1547f-3846-4da3-ad91-c6d00c42509e | 2026-04-27T23:25:43.319Z | 1.4 | 70 | time:20, product:30, amount:20 | 328 | N/A | exact | 496000 | 496000 | 0 | 496000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | fbp | - |
| 202604285552452 | 2026042867285600 | 2 | c7c76207-e033-4e1c-bf5e-6faa70856042 | 2026-04-27T21:46:38.778Z | 100.5 | 52 | time:2, product:30, amount:20 | 328 | N/A | exact | 496000 | 496000 | 0 | 496000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | fbclid, fbc, fbp | meta_biocom_iggacidset_2026 |
| 202604285552452 | 2026042867285600 | 3 | 0fa5bf2e-7052-4c55-9c4b-8d3ca3d915e0 | 2026-04-27T21:42:51.847Z | 104.3 | 52 | time:2, product:30, amount:20 | 328 | N/A | exact | 496000 | 496000 | 0 | 496000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | fbclid, fbc, fbp | meta_biocom_iggacidset_2026 |
| 202604285552452 | 2026042867285600 | 4 | a328a16a-0ea7-4a11-ae43-84db6bc8683a | 2026-04-27T19:51:42.777Z | 215.4 | 52 | time:2, product:30, amount:20 | 328 | N/A | exact | 496000 | 496000 | 0 | 496000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | fbp | tiktok_biocom_yeonddle_iggacidset |
| 202604285552452 | 2026042867285600 | 5 | 5a4c859f-3771-4b87-8ba2-13cb58ac5820 | 2026-04-27T19:24:32.704Z | 242.6 | 52 | time:2, product:30, amount:20 | 328 | N/A | exact | 496000 | 496000 | 0 | 496000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | fbp | - |
| 202604283756893 | 2026042875392500 | 1 | c42232c8-de9e-43ee-8c18-4105aa28aeeb | 2026-04-28T03:56:11.928Z | 7.5 | 50 | time:20, product:30, amount:0 | 328 | N/A | exact | 496000 | 975000 | 0 | 975000 | 479000 | none | amount_not_reconciled | Y | Y | fbp | - |
| 202604283756893 | 2026042875392500 | 2 | ecd86337-49df-47d2-ad50-1ad82d1545d4 | 2026-04-28T01:50:13.674Z | 133.5 | 32 | time:2, product:30, amount:0 | 328 | N/A | exact | 496000 | 975000 | 0 | 975000 | 479000 | none | amount_not_reconciled | Y | Y | fbp | tiktok_biocom_yeonddle_iggacidset |
| 202604283756893 | 2026042875392500 | 3 | 0b3861e7-c097-482f-8fd1-91df9027ac0e | 2026-04-28T00:46:58.620Z | 196.7 | 32 | time:2, product:30, amount:0 | 328 | N/A | exact | 496000 | 975000 | 0 | 975000 | 479000 | none | amount_not_reconciled | Y | Y | fbp | - |
| 202604283756893 | 2026042875392500 | 4 | 7528192f-f3f7-4d84-a94d-feb2b0c3c6ea | 2026-04-28T00:40:48.317Z | 202.9 | 32 | time:2, product:30, amount:0 | 328 | N/A | exact | 496000 | 975000 | 0 | 975000 | 479000 | none | amount_not_reconciled | Y | Y | fbp | - |
| 202604283756893 | 2026042875392500 | 5 | 6ed1547f-3846-4da3-ad91-c6d00c42509e | 2026-04-27T23:25:43.319Z | 278 | 32 | time:2, product:30, amount:0 | 328 | N/A | exact | 496000 | 975000 | 0 | 975000 | 479000 | none | amount_not_reconciled | Y | Y | fbp | - |
| 202604295198830 | 2026042916849620 | 1 | 4479b9b8-1827-4dff-a998-70613562bd22 | 2026-04-29T05:21:40.523Z | 0.6 | 80 | time:30, product:30, amount:20 | 328 | N/A | exact | 496000 | 496000 | 0 | 496000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | fbp | - |
| 202604295198830 | 2026042916849620 | 2 | 79f68911-afcf-4547-94ad-542dcfe58b09 | 2026-04-29T05:10:50.194Z | 11.5 | 70 | time:20, product:30, amount:20 | 328 | N/A | exact | 496000 | 496000 | 0 | 496000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | fbp | - |
| 202604295198830 | 2026042916849620 | 3 | 0e9da78a-a28a-43e8-800c-2d7bd600a653 | 2026-04-29T03:09:21.426Z | 132.9 | 52 | time:2, product:30, amount:20 | 328 | N/A | exact | 496000 | 496000 | 0 | 496000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | fbp | - |
| 202604295198830 | 2026042916849620 | 4 | c7c7fb4b-9f52-43c1-b38e-45b5a5666f98 | 2026-04-29T01:04:54.331Z | 257.4 | 52 | time:2, product:30, amount:20 | 328 | N/A | exact | 496000 | 496000 | 0 | 496000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | fbc, fbp | - |
| 202604295198830 | 2026042916849620 | 5 | b9c46566-4641-42ee-8e3c-6284cf4ac8fc | 2026-04-28T16:49:08.997Z | 753.2 | 52 | time:2, product:30, amount:20 | 328 | N/A | exact | 496000 | 496000 | 0 | 496000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | fbclid, fbc, fbp | meta_biocom_yeonddle_iggacid |
| 202604303307399 | 2026043034982320 | 1 | b0234ffc-fede-48f5-a313-87480a4884e2 | 2026-04-30T00:17:52.600Z | 1.3 | 70 | time:20, product:30, amount:20 | 328 | N/A | exact | 496000 | 496000 | 0 | 496000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | fbclid, fbc, fbp | meta_biocom_yeonddle_iggacid |
| 202604303307399 | 2026043034982320 | 2 | 8dee5512-665b-4e77-a7cf-9ec53a228943 | 2026-04-29T15:00:34.191Z | 558.6 | 52 | time:2, product:30, amount:20 | 328 | N/A | exact | 496000 | 496000 | 0 | 496000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | fbc, fbp | - |
| 202604303307399 | 2026043034982320 | 3 | 4479b9b8-1827-4dff-a998-70613562bd22 | 2026-04-29T05:21:40.523Z | 1137.5 | 52 | time:2, product:30, amount:20 | 328 | N/A | exact | 496000 | 496000 | 0 | 496000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | fbp | - |
| 202604303307399 | 2026043034982320 | 4 | 79f68911-afcf-4547-94ad-542dcfe58b09 | 2026-04-29T05:10:50.194Z | 1148.3 | 52 | time:2, product:30, amount:20 | 328 | N/A | exact | 496000 | 496000 | 0 | 496000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | fbp | - |
| 202604303307399 | 2026043034982320 | 5 | 0e9da78a-a28a-43e8-800c-2d7bd600a653 | 2026-04-29T03:09:21.426Z | 1269.8 | 52 | time:2, product:30, amount:20 | 328 | N/A | exact | 496000 | 496000 | 0 | 496000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | fbp | - |
| 202604309992065 | 2026043040116970 | 1 | aa6cb8b7-4e55-4731-8fe2-c65dc269e6cc | 2026-04-30T03:40:48.421Z | 0.7 | 80 | time:30, product:30, amount:20 | 198 | N/A | exact | 35000 | 35000 | 0 | 35000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | fbp | - |
| 202604309992065 | 2026043040116970 | 2 | 5c599fef-62cf-42bd-b9be-236ba03fd9cf | 2026-04-30T00:47:30.567Z | 174 | 52 | time:2, product:30, amount:20 | 198 | N/A | exact | 35000 | 35000 | 0 | 35000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | gclid, fbp | googleads_shopping_supplements_neuromaster |
| 202604309992065 | 2026043040116970 | 3 | f58c932e-a9ba-4897-b0de-9230ba2b8230 | 2026-04-29T19:49:19.743Z | 472.2 | 52 | time:2, product:30, amount:20 | 198 | N/A | exact | 35000 | 35000 | 0 | 35000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | gclid, fbp | googleads_shopping_supplements_neuromaster |
| 202604309992065 | 2026043040116970 | 4 | 44144dad-adaa-4632-9cf3-61d4c4e2708b | 2026-04-29T17:58:23.172Z | 583.1 | 52 | time:2, product:30, amount:20 | 198 | N/A | exact | 35000 | 35000 | 0 | 35000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | gclid, fbp | googleads_shopping_supplements_neuromaster |
| 202604309992065 | 2026043040116970 | 5 | 79ca7e58-75c0-452e-adad-08587565bdc2 | 2026-04-29T16:55:36.104Z | 645.9 | 52 | time:2, product:30, amount:20 | 198 | N/A | exact | 35000 | 35000 | 0 | 35000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | gclid, fbp | googleads_shopping_supplements_neuromaster |
| 202604303298608 | 2026043043127990 | 1 | 9eb98bc2-d36d-4c1d-88d9-e2f28d4046c9 | 2026-04-30T05:47:12.244Z | 0.7 | 60 | time:30, product:30, amount:0 | 21 | N/A | exact | 54900 | 148200 | 0 | 148200 | 93300 | none | amount_not_reconciled | Y | Y | fbp | - |
| 202604303298608 | 2026043043127990 | 2 | dc2f55d1-6585-4edb-83f0-aea053e99de2 | 2026-04-30T05:35:59.113Z | 11.9 | 20 | time:20, product:0, amount:0 | 317 | N/A | none | 59800 | 148200 | 0 | 148200 | 88400 | none | amount_not_reconciled | Y | Y | gclid, fbp | - |
| 202604303298608 | 2026043043127990 | 3 | 49bbb43e-f37f-4573-aec0-9a97c351dffc | 2026-04-30T04:58:44.458Z | 49.2 | 10 | time:10, product:0, amount:0 | 300 | N/A | none | 36000 | 148200 | 0 | 148200 | 112200 | none | amount_not_reconciled | Y | Y | gclid, fbp | googleads_shopping_supplements_youngdays |
| 202604303298608 | 2026043043127990 | 4 | f5b1e5c8-bfde-40f4-bdca-b78211e84184 | 2026-04-30T04:53:44.121Z | 54.2 | 10 | time:10, product:0, amount:0 | 97 | N/A | none | 39000 | 148200 | 0 | 148200 | 109200 | none | amount_not_reconciled | Y | Y | gclid, fbp | googleads_shopping_supplements_biobalance |
| 202604303298608 | 2026043043127990 | 5 | 0b21fced-30b6-4c6c-a59d-6bac4dbb8174 | 2026-04-30T04:53:00.075Z | 54.9 | 10 | time:10, product:0, amount:0 | 386 | N/A | none | 36900 | 148200 | 0 | 148200 | 111300 | none | amount_not_reconciled | Y | Y | gclid, fbp | googleads_shopping_supplements_metadream |
| 202604302383065 | 2026043043205620 | 1 | 34356f9b-33ee-4a5e-88f6-44e52d808ad0 | 2026-04-30T05:50:17.113Z | 0.7 | 80 | time:30, product:30, amount:20 | 198 | N/A | exact | 35000 | 35000 | 0 | 35000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | fbclid, fbc, fbp | meta_master_slow |
| 202604302383065 | 2026043043205620 | 2 | aa6cb8b7-4e55-4731-8fe2-c65dc269e6cc | 2026-04-30T03:40:48.421Z | 130.2 | 52 | time:2, product:30, amount:20 | 198 | N/A | exact | 35000 | 35000 | 0 | 35000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | fbp | - |
| 202604302383065 | 2026043043205620 | 3 | 5c599fef-62cf-42bd-b9be-236ba03fd9cf | 2026-04-30T00:47:30.567Z | 303.5 | 52 | time:2, product:30, amount:20 | 198 | N/A | exact | 35000 | 35000 | 0 | 35000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | gclid, fbp | googleads_shopping_supplements_neuromaster |
| 202604302383065 | 2026043043205620 | 4 | f58c932e-a9ba-4897-b0de-9230ba2b8230 | 2026-04-29T19:49:19.743Z | 601.7 | 52 | time:2, product:30, amount:20 | 198 | N/A | exact | 35000 | 35000 | 0 | 35000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | gclid, fbp | googleads_shopping_supplements_neuromaster |
| 202604302383065 | 2026043043205620 | 5 | 44144dad-adaa-4632-9cf3-61d4c4e2708b | 2026-04-29T17:58:23.172Z | 712.6 | 52 | time:2, product:30, amount:20 | 198 | N/A | exact | 35000 | 35000 | 0 | 35000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | gclid, fbp | googleads_shopping_supplements_neuromaster |
| 202604309594732 | 2026043044799490 | 1 | 572bdc1a-389b-4128-a389-b9750b063c90 | 2026-04-30T07:00:23.688Z | 0.8 | 80 | time:30, product:30, amount:20 | 424 | N/A | exact | 8900 | 8900 | 3000 | 11900 | 3000 | shipping_reconciled | item_exact=true; shipping_reconciled=true; order_payment_amount == order_item_total + delivery_price | Y | Y | fbp | - |
| 202604309594732 | 2026043044799490 | 2 | 0961cd92-4e68-4dfb-b753-f64448da108b | 2026-04-30T06:52:00.503Z | 9.2 | 20 | time:20, product:0, amount:0 | 317 | N/A | none | 59800 | 8900 | 3000 | 11900 | -47900 | none | amount_not_reconciled | Y | Y | gclid, fbp | - |
| 202604309594732 | 2026043044799490 | 3 | fcf2909d-1114-4fc7-a2ea-ec76c338ae60 | 2026-04-30T06:50:23.338Z | 10.8 | 20 | time:20, product:0, amount:0 | 97 | N/A | none | 39000 | 8900 | 3000 | 11900 | -27100 | none | amount_not_reconciled | Y | Y | gclid, fbp | googleads_shopping_supplements_biobalance |
| 202604309594732 | 2026043044799490 | 4 | 40353a51-5213-46b9-8522-b1e53e53445e | 2026-04-30T06:47:24.973Z | 13.8 | 20 | time:20, product:0, amount:0 | 198 | N/A | none | 35000 | 8900 | 3000 | 11900 | -23100 | none | amount_not_reconciled | Y | Y | gclid, fbp | googleads_shopping_supplements_neuromaster |
| 202604309594732 | 2026043044799490 | 5 | 19687a73-0b03-4a5c-9fd4-df64394aebe8 | 2026-04-30T06:39:01.315Z | 22.2 | 10 | time:10, product:0, amount:0 | 97 | N/A | none | 39000 | 8900 | 3000 | 11900 | -27100 | none | amount_not_reconciled | Y | Y | gclid, fbp | googleads_shopping_supplements_biobalance |

## Guardrail

- 아직 purchase dispatcher를 열지 않는다.
- 이 리포트는 DB 상태를 바꾸지 않는다.
- 이 리포트는 GA4/Meta/TikTok/Google Ads purchase 전송을 하지 않는다.
- 이 리포트 변경만으로 운영 endpoint를 배포하지 않는다.
- A급 strong만 향후 dispatcher dry-run 후보이며, B급 strong은 첫 dispatcher 후보에서 제외한다.
- already_in_ga4가 present 또는 unknown이면 전송 후보에서 제외한다.
- 테스트/수동 테스트 라벨 주문은 전송 후보에서 제외한다.
