# NPay ROAS Dry-run Report

Generated at: 2026-05-05T13:15:25.415Z
Window: 2026-04-27T09:10:00.000Z ~ 2026-05-05T15:00:00.000Z

## Summary

| metric | value |
| --- | --- |
| live_intent_count | 820 |
| confirmed_npay_order_count | 30 |
| strong_match | 20 |
| strong_match_a | 10 |
| strong_match_b | 10 |
| ambiguous | 10 |
| purchase_without_intent | 0 |
| dispatcher_dry_run_candidate | 0 |
| already_in_ga4_blocked | 0 |
| already_in_ga4_lookup_present | 0 |
| already_in_ga4_lookup_robust_absent | 0 |
| already_in_ga4_lookup_absent | 0 |
| already_in_ga4_lookup_unknown | 30 |
| ga4_lookup_required_order_count | 10 |
| ga4_lookup_id_count | 20 |
| test_order_blocked | 0 |
| manual_order_count | 0 |
| shipping_reconciled_count | 1 |
| shipping_reconciled_not_grade_a_count | 0 |
| clicked_purchased_candidate | 20 |
| clicked_no_purchase | 709 |
| intent_pending | 91 |

## Early Phase2 Decision Package

현재 누적 표본으로 먼저 진행할 수 있는 일과 아직 막아야 하는 일을 분리한다. 이 섹션은 승인안 준비용이며, 실제 전송이나 DB 업데이트를 하지 않는다.

| decision_item | status | evidence | next_action |
| --- | --- | --- | --- |
| 현재 표본 조기 진행 | 가능 | 820 intents / 30 confirmed NPay orders | BigQuery guard, 수동 검토, GA4 MP 제한 테스트 승인안까지만 진행 |
| 자동 dispatcher | 금지 | ambiguous 10건 (33.33%), already_in_ga4 unknown 30건 | 7일 후보정 전 자동/대량 전송 금지 |
| GA4 MP 제한 테스트 | 준비 가능 | A급 production 후보 10건, robust_absent 0건, unknown 10건 | 두 ID 모두 GA4 robust_absent 확인 + TJ 승인 후에만 실제 전송 |
| clicked_no_purchase 해석 | 가능 | 709건 | 상품/광고키/시간대 가설 작성. audience 전송은 7일 후보정 후 |

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
| 202604309594732 | 2026043044799490 | production_order | 2026-04-30T07:01:14.000Z | 11900 | 팀키토 슬로우 에이징 도시락 7종 골라담기 | strong_match | A | 25 | 80 | 20 | 60 | 0.8 | exact | 8900 | 8900 | 3000 | 11900 | 3000 | shipping_reconciled | item_exact=true; shipping_reconciled=true; order_payment_amount == order_item_total + delivery_price | Y | Y | unknown | N | already_in_ga4_unknown | - | N |
| 202604307495485 | 2026043050675170 | production_order | 2026-04-30T11:59:24.000Z | 39000 | 바이오밸런스 90정 (1개월분) | ambiguous | - | 25 | 52 | 52 | 0 | 184.1 | exact | 39000 | 39000 | 0 | 39000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | unknown | N | ambiguous, not_a_grade_strong, already_in_ga4_unknown | multiple_intents_same_product, weak_time_gap, no_member_key, low_score_gap | N |
| 202604305294407 | 2026043053058190 | production_order | 2026-04-30T14:04:53.000Z | 161700 | 다빈치랩 엔자임 베네핏 (ENZYME BENEFITS) 30일분 | strong_match | B | 25 | 50 | 20 | 30 | 2 | exact | 59900 | 161700 | 0 | 161700 | 101800 | none | amount_not_reconciled | Y | Y | unknown | N | not_a_grade_strong, already_in_ga4_unknown | - | N |
| 202605013241376 | 2026050158750350 | production_order | 2026-05-01T00:05:23.000Z | 339300 | 썬화이버 프리바이오틱스 식이섬유 210g + 뉴로마스터 60정 (1개월분) + 바이오밸런스 90정 (1개월분) | ambiguous | - | 25 | 62 | 62 | 0 | 13.9 | exact | 35000 | 1017900 | 0 | 339300 | 304300 | cart_contains_item | cart_contains_item=true; order amount is cart total for multiple products | Y | Y | unknown | N | ambiguous, not_a_grade_strong, already_in_ga4_unknown | multiple_intents_same_product, same_product_multiple_clicks, no_member_key, low_score_gap, cart_multi_item_possible | N |
| 202605011540306 | 2026050158972710 | production_order | 2026-05-01T00:16:46.000Z | 496000 | 종합 대사기능&음식물 과민증 검사 Set | strong_match | A | 25 | 80 | 52 | 28 | 0.7 | exact | 496000 | 496000 | 0 | 496000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | unknown | N | already_in_ga4_unknown | - | N |
| 202605013947069 | 2026050174275040 | production_order | 2026-05-01T11:53:10.000Z | 978000 | 종합 대사기능&음식물 과민증 검사 Set | strong_match | B | 25 | 60 | 32 | 28 | 0.9 | exact | 496000 | 975000 | 0 | 978000 | 482000 | none | amount_not_reconciled | Y | Y | unknown | N | not_a_grade_strong, already_in_ga4_unknown | - | N |
| 202605026187995 | 2026050280712120 | production_order | 2026-05-01T23:04:34.000Z | 35000 | 뉴로마스터 60정 (1개월분) | strong_match | A | 25 | 80 | 52 | 28 | 0.6 | exact | 35000 | 35000 | 0 | 35000 | 0 | final_exact | intent_product_price == order_payment_amount | N | Y | unknown | N | already_in_ga4_unknown | - | N |
| 202605027178971 | 2026050281216190 | production_order | 2026-05-01T23:44:31.000Z | 496000 | 종합 대사기능&음식물 과민증 검사 Set | strong_match | A | 25 | 80 | 52 | 28 | 0.2 | exact | 496000 | 496000 | 0 | 496000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | unknown | N | already_in_ga4_unknown | - | N |
| 202605023918252 | 2026050281699210 | production_order | 2026-05-02T00:16:12.000Z | 117000 | 뉴로마스터 60정 (1개월분) | strong_match | B | 25 | 60 | 32 | 28 | 0.3 | exact | 35000 | 117000 | 0 | 117000 | 82000 | none | amount_not_reconciled | N | Y | unknown | N | not_a_grade_strong, already_in_ga4_unknown | - | N |
| 202605022046757 | 2026050285300840 | production_order | 2026-05-02T03:13:41.000Z | 117000 | 뉴로마스터 60정 (1개월분) | strong_match | B | 25 | 60 | 32 | 28 | 0.4 | exact | 35000 | 117000 | 0 | 117000 | 82000 | none | amount_not_reconciled | Y | Y | unknown | N | not_a_grade_strong, already_in_ga4_unknown | - | N |
| 202605024695718 | 2026050295172640 | production_order | 2026-05-02T11:39:11.000Z | 120000 | 뉴로마스터 60정 (1개월분) | strong_match | B | 25 | 60 | 40 | 20 | 0.9 | exact | 35000 | 117000 | 0 | 120000 | 85000 | none | amount_not_reconciled | Y | Y | unknown | N | not_a_grade_strong, already_in_ga4_unknown | - | N |
| 202605033001947 | 2026050311336550 | production_order | 2026-05-02T22:51:52.000Z | 975000 | 종합 대사기능&음식물 과민증 검사 Set | strong_match | B | 25 | 60 | 32 | 28 | 0.9 | exact | 496000 | 975000 | 0 | 975000 | 479000 | none | amount_not_reconciled | Y | Y | unknown | N | not_a_grade_strong, already_in_ga4_unknown | - | N |
| 202605037443252 | 2026050312341550 | production_order | 2026-05-03T00:16:25.000Z | 496000 | 종합 대사기능&음식물 과민증 검사 Set | ambiguous | - | 25 | 80 | 70 | 10 | 0.6 | exact | 496000 | 496000 | 0 | 496000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | unknown | N | ambiguous, not_a_grade_strong, already_in_ga4_unknown | multiple_intents_same_product, same_product_multiple_clicks, no_member_key, low_score_gap | N |
| 202605036979766 | 2026050315711070 | production_order | 2026-05-03T03:04:53.000Z | 109200 | 뉴로마스터 60정 (1개월분) + 팀키토 저포드맵 도시락 7종 골라담기 + 팀키토 오리지널 도시락 8종 골라담기 | ambiguous | - | 25 | 52 | 44 | 8 | 28.4 | exact | 35000 | 955800 | 3000 | 109200 | 74200 | cart_contains_item | cart_contains_item=true; order amount is cart total for multiple products | Y | Y | unknown | N | ambiguous, not_a_grade_strong, already_in_ga4_unknown | multiple_intents_same_product, weak_time_gap, no_member_key, low_score_gap, cart_multi_item_possible | N |
| 202605033654935 | 2026050318679610 | production_order | 2026-05-03T05:27:43.000Z | 117000 | 뉴로마스터 60정 (1개월분) | ambiguous | - | 25 | 50 | 50 | 0 | 3.7 | exact | 35000 | 117000 | 0 | 117000 | 82000 | none | amount_not_reconciled | Y | Y | unknown | N | ambiguous, not_a_grade_strong, already_in_ga4_unknown | multiple_intents_same_product, same_product_multiple_clicks, amount_not_reconciled, no_member_key, low_score_gap, cart_multi_item_possible | N |
| 202605031517085 | 2026050328355140 | production_order | 2026-05-03T12:23:07.000Z | 42600 | 팀키토 시그니처 도시락 6종 골라담기 | ambiguous | - | 25 | 78 | 68 | 10 | 0.1 | exact | 9900 | 158400 | 3000 | 42600 | 32700 | quantity_reconciled | order amount reconciles with intent_product_price * quantity plus delivery/discount | Y | Y | unknown | N | ambiguous, not_a_grade_strong, already_in_ga4_unknown | multiple_intents_same_product, same_product_multiple_clicks, no_member_key, low_score_gap, cart_multi_item_possible | N |
| 202605031873910 | 2026050331688110 | production_order | 2026-05-03T14:33:32.000Z | 496000 | 종합 대사기능&음식물 과민증 검사 Set | strong_match | A | 25 | 80 | 52 | 28 | 0.2 | exact | 496000 | 496000 | 0 | 496000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | unknown | N | already_in_ga4_unknown | - | N |
| 202605047544570 | 2026050432504950 | production_order | 2026-05-03T15:14:34.000Z | 35000 | 뉴로마스터 60정 (1개월분) | ambiguous | - | 25 | 80 | 80 | 0 | 0.2 | exact | 35000 | 35000 | 0 | 35000 | 0 | final_exact | intent_product_price == order_payment_amount | N | Y | unknown | N | ambiguous, not_a_grade_strong, already_in_ga4_unknown | multiple_intents_same_product, same_product_multiple_clicks, no_member_key, low_score_gap | N |
| 202605042286528 | 2026050434702070 | production_order | 2026-05-03T21:31:25.000Z | 496000 | 종합 대사기능&음식물 과민증 검사 Set | strong_match | B | 25 | 70 | 52 | 18 | 4.4 | exact | 496000 | 496000 | 0 | 496000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | unknown | N | not_a_grade_strong, already_in_ga4_unknown | - | N |
| 202605041662694 | 2026050447240150 | production_order | 2026-05-04T06:00:10.000Z | 117000 | 바이오밸런스 90정 (1개월분) | strong_match | B | 25 | 60 | 40 | 20 | 0.3 | exact | 39000 | 117000 | 0 | 117000 | 78000 | none | amount_not_reconciled | Y | Y | unknown | N | not_a_grade_strong, already_in_ga4_unknown | - | N |

## Ambiguous Reason Breakdown

| reason | orders | share | order_numbers |
| --- | --- | --- | --- |
| low_score_gap | 10 | 100% | 202604275329932, 202604289063428, 202604295198830, 202604307495485, 202605013241376, 202605031517085, 202605033654935, 202605036979766, 202605037443252, 202605047544570 |
| multiple_intents_same_product | 10 | 100% | 202604275329932, 202604289063428, 202604295198830, 202604307495485, 202605013241376, 202605031517085, 202605033654935, 202605036979766, 202605037443252, 202605047544570 |
| no_member_key | 10 | 100% | 202604275329932, 202604289063428, 202604295198830, 202604307495485, 202605013241376, 202605031517085, 202605033654935, 202605036979766, 202605037443252, 202605047544570 |
| same_product_multiple_clicks | 8 | 80% | 202604275329932, 202604289063428, 202604295198830, 202605013241376, 202605031517085, 202605033654935, 202605037443252, 202605047544570 |
| cart_multi_item_possible | 5 | 50% | 202604275329932, 202605013241376, 202605031517085, 202605033654935, 202605036979766 |
| amount_not_reconciled | 2 | 20% | 202604275329932, 202605033654935 |
| weak_time_gap | 2 | 20% | 202604307495485, 202605036979766 |

## Manual Review Queue

아래 주문은 자동 전송 후보가 아니다. 수동 검토로 규칙을 보강하거나 전송 제외를 확정해야 한다.

| order_number | channel_order_no | review_group | amount | product | best_score | second_score | score_gap | time_gap_min | amount_match | why_review | dispatch_decision | next_action |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 202604275329932 | 2026042761751160 | ambiguous | 117000 | 뉴로마스터 60정 (1개월분) | 60 | 50 | 10 | 0.2 | none | multiple_intents_same_product, same_product_multiple_clicks, amount_not_reconciled, no_member_key, low_score_gap, cart_multi_item_possible | 전송 금지 | 같은 상품 반복 클릭, score_gap, 금액/장바구니 여부를 수동 확인 |
| 202604289063428 | 2026042865161940 | ambiguous | 496000 | 종합 대사기능&음식물 과민증 검사 Set | 80 | 70 | 10 | 0.3 | final_exact | multiple_intents_same_product, same_product_multiple_clicks, no_member_key, low_score_gap | 전송 금지 | 같은 상품 반복 클릭, score_gap, 금액/장바구니 여부를 수동 확인 |
| 202604283756893 | 2026042875392500 | b_grade_strong | 975000 | 종합 대사기능&음식물 과민증 검사 Set | 50 | 32 | 18 | 7.5 | none | not_a_grade_strong, already_in_ga4_unknown | 전송 금지 | 금액 조정 가능성 또는 장바구니/수량 구조 확인 |
| 202604295198830 | 2026042916849620 | ambiguous | 496000 | 종합 대사기능&음식물 과민증 검사 Set | 80 | 70 | 10 | 0.6 | final_exact | multiple_intents_same_product, same_product_multiple_clicks, no_member_key, low_score_gap | 전송 금지 | 같은 상품 반복 클릭, score_gap, 금액/장바구니 여부를 수동 확인 |
| 202604303298608 | 2026043043127990 | b_grade_strong | 148200 | 다빈치랩 메가프로바이오틱 ND50 (MEGA PROBIOTIC ND50) 30일분 | 60 | 20 | 40 | 0.7 | none | not_a_grade_strong, already_in_ga4_unknown | 전송 금지 | 금액 조정 가능성 또는 장바구니/수량 구조 확인 |
| 202604307495485 | 2026043050675170 | ambiguous | 39000 | 바이오밸런스 90정 (1개월분) | 52 | 52 | 0 | 184.1 | final_exact | multiple_intents_same_product, weak_time_gap, no_member_key, low_score_gap | 전송 금지 | 같은 상품 반복 클릭, score_gap, 금액/장바구니 여부를 수동 확인 |
| 202604305294407 | 2026043053058190 | b_grade_strong | 161700 | 다빈치랩 엔자임 베네핏 (ENZYME BENEFITS) 30일분 | 50 | 20 | 30 | 2 | none | not_a_grade_strong, already_in_ga4_unknown | 전송 금지 | 금액 조정 가능성 또는 장바구니/수량 구조 확인 |
| 202605013241376 | 2026050158750350 | ambiguous | 339300 | 썬화이버 프리바이오틱스 식이섬유 210g + 뉴로마스터 60정 (1개월분) + 바이오밸런스 90정 (1개월분) | 62 | 62 | 0 | 13.9 | cart_contains_item | multiple_intents_same_product, same_product_multiple_clicks, no_member_key, low_score_gap, cart_multi_item_possible | 전송 금지 | 같은 상품 반복 클릭, score_gap, 금액/장바구니 여부를 수동 확인 |
| 202605013947069 | 2026050174275040 | b_grade_strong | 978000 | 종합 대사기능&음식물 과민증 검사 Set | 60 | 32 | 28 | 0.9 | none | not_a_grade_strong, already_in_ga4_unknown | 전송 금지 | 금액 조정 가능성 또는 장바구니/수량 구조 확인 |
| 202605023918252 | 2026050281699210 | b_grade_strong | 117000 | 뉴로마스터 60정 (1개월분) | 60 | 32 | 28 | 0.3 | none | not_a_grade_strong, already_in_ga4_unknown | 전송 금지 | 금액 조정 가능성 또는 장바구니/수량 구조 확인 |
| 202605022046757 | 2026050285300840 | b_grade_strong | 117000 | 뉴로마스터 60정 (1개월분) | 60 | 32 | 28 | 0.4 | none | not_a_grade_strong, already_in_ga4_unknown | 전송 금지 | 금액 조정 가능성 또는 장바구니/수량 구조 확인 |
| 202605024695718 | 2026050295172640 | b_grade_strong | 120000 | 뉴로마스터 60정 (1개월분) | 60 | 40 | 20 | 0.9 | none | not_a_grade_strong, already_in_ga4_unknown | 전송 금지 | 금액 조정 가능성 또는 장바구니/수량 구조 확인 |
| 202605033001947 | 2026050311336550 | b_grade_strong | 975000 | 종합 대사기능&음식물 과민증 검사 Set | 60 | 32 | 28 | 0.9 | none | not_a_grade_strong, already_in_ga4_unknown | 전송 금지 | 금액 조정 가능성 또는 장바구니/수량 구조 확인 |
| 202605037443252 | 2026050312341550 | ambiguous | 496000 | 종합 대사기능&음식물 과민증 검사 Set | 80 | 70 | 10 | 0.6 | final_exact | multiple_intents_same_product, same_product_multiple_clicks, no_member_key, low_score_gap | 전송 금지 | 같은 상품 반복 클릭, score_gap, 금액/장바구니 여부를 수동 확인 |
| 202605036979766 | 2026050315711070 | ambiguous | 109200 | 뉴로마스터 60정 (1개월분) + 팀키토 저포드맵 도시락 7종 골라담기 + 팀키토 오리지널 도시락 8종 골라담기 | 52 | 44 | 8 | 28.4 | cart_contains_item | multiple_intents_same_product, weak_time_gap, no_member_key, low_score_gap, cart_multi_item_possible | 전송 금지 | 같은 상품 반복 클릭, score_gap, 금액/장바구니 여부를 수동 확인 |
| 202605033654935 | 2026050318679610 | ambiguous | 117000 | 뉴로마스터 60정 (1개월분) | 50 | 50 | 0 | 3.7 | none | multiple_intents_same_product, same_product_multiple_clicks, amount_not_reconciled, no_member_key, low_score_gap, cart_multi_item_possible | 전송 금지 | 같은 상품 반복 클릭, score_gap, 금액/장바구니 여부를 수동 확인 |
| 202605031517085 | 2026050328355140 | ambiguous | 42600 | 팀키토 시그니처 도시락 6종 골라담기 | 78 | 68 | 10 | 0.1 | quantity_reconciled | multiple_intents_same_product, same_product_multiple_clicks, no_member_key, low_score_gap, cart_multi_item_possible | 전송 금지 | 같은 상품 반복 클릭, score_gap, 금액/장바구니 여부를 수동 확인 |
| 202605047544570 | 2026050432504950 | ambiguous | 35000 | 뉴로마스터 60정 (1개월분) | 80 | 80 | 0 | 0.2 | final_exact | multiple_intents_same_product, same_product_multiple_clicks, no_member_key, low_score_gap | 전송 금지 | 같은 상품 반복 클릭, score_gap, 금액/장바구니 여부를 수동 확인 |
| 202605042286528 | 2026050434702070 | b_grade_strong | 496000 | 종합 대사기능&음식물 과민증 검사 Set | 70 | 52 | 18 | 4.4 | final_exact | not_a_grade_strong, already_in_ga4_unknown | 전송 금지 | 금액 조정 가능성 또는 장바구니/수량 구조 확인 |
| 202605041662694 | 2026050447240150 | b_grade_strong | 117000 | 바이오밸런스 90정 (1개월분) | 60 | 40 | 20 | 0.3 | none | not_a_grade_strong, already_in_ga4_unknown | 전송 금지 | 금액 조정 가능성 또는 장바구니/수량 구조 확인 |

## Clicked No Purchase Breakdown

아래 표는 `clicked_no_purchase` intent만 대상으로 한 read-only 분해다. 구매 전환 전송 대상이 아니며, 리마케팅/결제 UX 점검용이다.

### By Product

| product_idx | product_name | clicked_no_purchase | share |
| --- | --- | --- | --- |
| 317 | 혈당관리엔 당당케어 (120정) | 189 | 26.66% |
| 97 | 바이오밸런스 90정 (1개월분) | 134 | 18.9% |
| 198 | 뉴로마스터 60정 (1개월분) | 113 | 15.94% |
| 386 | 메타드림 식물성 멜라토닌 함유 | 97 | 13.68% |
| 300 | 영데이즈 저속노화 SOD 효소 (15포) | 59 | 8.32% |
| 171 | 풍성밸런스 90정 (1개월분) | 42 | 5.92% |
| 328 | 종합 대사기능&음식물 과민증 검사 Set | 35 | 4.94% |
| 225 | 다래케어 180정 (1개월분) | 14 | 1.97% |
| 409 | 리셋데이 글루텐분해효소 알파CD 차전자피 K-낙산균 | 4 | 0.56% |
| 423 | 팀키토 저포드맵 도시락 7종 골라담기 | 4 | 0.56% |
| 21 | 다빈치랩 메가프로바이오틱 ND50 (MEGA PROBIOTIC ND50) 30일분 | 3 | 0.42% |
| 172 | 클린밸런스 120정 (1개월분) | 2 | 0.28% |
| 281 | 팀키토 시그니처 도시락 6종 골라담기 | 2 | 0.28% |
| 317 | 혈당 다이어트 영양제 혈당관리엔 당당케어 바나바잎 추출물 가르시니아 비타민B | 2 | 0.28% |
| 386 | 메타드림 식물성 멜라토닌 함유 액상 | 2 | 0.28% |
| 97 | 바이오밸런스 피로회복 영양제 마그네슘 아연 셀레늄 비타민D 바이오미네랄 활성산소 | 2 | 0.28% |
| 171 | 풍성밸런스 비오틴 맥주효모 아연 L시스틴 머리카락 탈모 예방 영양제 | 1 | 0.14% |
| 282 | 팀키토 오리지널 도시락 8종 골라담기 | 1 | 0.14% |
| 300 | 바이오컴 영데이즈 저속노화 SOD 효소 리포좀 글루타치온 | 1 | 0.14% |
| 31 | 다빈치랩 엔자임 베네핏 (ENZYME BENEFITS) 30일분 | 1 | 0.14% |
| 32 | 다빈치랩 고용량 코큐텐 DMG (COQ10 DMG 300/300mg) 60일분 | 1 | 0.14% |

### By Ad Key

| ad_key_combo | clicked_no_purchase | share |
| --- | --- | --- |
| gclid+fbp | 633 | 89.28% |
| fbp | 48 | 6.77% |
| fbclid+fbc+fbp | 13 | 1.83% |
| fbc+fbp | 8 | 1.13% |
| gclid | 3 | 0.42% |
| fbclid | 2 | 0.28% |
| gclid+gbraid+fbp | 1 | 0.14% |
| none | 1 | 0.14% |

### By KST Hour

| kst_hour | clicked_no_purchase | share |
| --- | --- | --- |
| 2026-04-27 18:00 KST | 3 | 0.42% |
| 2026-04-27 19:00 KST | 1 | 0.14% |
| 2026-04-27 20:00 KST | 4 | 0.56% |
| 2026-04-27 21:00 KST | 2 | 0.28% |
| 2026-04-27 22:00 KST | 5 | 0.71% |
| 2026-04-27 23:00 KST | 3 | 0.42% |
| 2026-04-28 00:00 KST | 1 | 0.14% |
| 2026-04-28 01:00 KST | 2 | 0.28% |
| 2026-04-28 02:00 KST | 1 | 0.14% |
| 2026-04-28 03:00 KST | 2 | 0.28% |
| 2026-04-28 04:00 KST | 9 | 1.27% |
| 2026-04-28 05:00 KST | 2 | 0.28% |
| 2026-04-28 06:00 KST | 3 | 0.42% |
| 2026-04-28 07:00 KST | 3 | 0.42% |
| 2026-04-28 08:00 KST | 2 | 0.28% |
| 2026-04-28 09:00 KST | 4 | 0.56% |
| 2026-04-28 10:00 KST | 11 | 1.55% |
| 2026-04-28 11:00 KST | 8 | 1.13% |
| 2026-04-28 12:00 KST | 20 | 2.82% |
| 2026-04-28 13:00 KST | 11 | 1.55% |
| 2026-04-28 14:00 KST | 4 | 0.56% |
| 2026-04-28 15:00 KST | 4 | 0.56% |
| 2026-04-28 16:00 KST | 3 | 0.42% |
| 2026-04-28 18:00 KST | 3 | 0.42% |
| 2026-04-28 19:00 KST | 2 | 0.28% |
| 2026-04-28 20:00 KST | 1 | 0.14% |
| 2026-04-28 22:00 KST | 1 | 0.14% |
| 2026-04-29 00:00 KST | 8 | 1.13% |
| 2026-04-29 01:00 KST | 2 | 0.28% |
| 2026-04-29 02:00 KST | 2 | 0.28% |
| 2026-04-29 03:00 KST | 1 | 0.14% |
| 2026-04-29 04:00 KST | 5 | 0.71% |
| 2026-04-29 05:00 KST | 2 | 0.28% |
| 2026-04-29 06:00 KST | 2 | 0.28% |
| 2026-04-29 07:00 KST | 6 | 0.85% |
| 2026-04-29 08:00 KST | 1 | 0.14% |
| 2026-04-29 09:00 KST | 2 | 0.28% |
| 2026-04-29 10:00 KST | 3 | 0.42% |
| 2026-04-29 11:00 KST | 7 | 0.99% |
| 2026-04-29 12:00 KST | 13 | 1.83% |
| 2026-04-29 13:00 KST | 4 | 0.56% |
| 2026-04-29 14:00 KST | 15 | 2.12% |
| 2026-04-29 15:00 KST | 14 | 1.97% |
| 2026-04-29 16:00 KST | 6 | 0.85% |
| 2026-04-29 19:00 KST | 1 | 0.14% |
| 2026-04-29 21:00 KST | 1 | 0.14% |
| 2026-04-29 22:00 KST | 2 | 0.28% |
| 2026-04-29 23:00 KST | 1 | 0.14% |
| 2026-04-30 00:00 KST | 2 | 0.28% |
| 2026-04-30 01:00 KST | 7 | 0.99% |
| 2026-04-30 02:00 KST | 7 | 0.99% |
| 2026-04-30 03:00 KST | 1 | 0.14% |
| 2026-04-30 04:00 KST | 2 | 0.28% |
| 2026-04-30 05:00 KST | 3 | 0.42% |
| 2026-04-30 06:00 KST | 2 | 0.28% |
| 2026-04-30 07:00 KST | 1 | 0.14% |
| 2026-04-30 08:00 KST | 2 | 0.28% |
| 2026-04-30 09:00 KST | 4 | 0.56% |
| 2026-04-30 10:00 KST | 2 | 0.28% |
| 2026-04-30 11:00 KST | 1 | 0.14% |
| 2026-04-30 13:00 KST | 7 | 0.99% |
| 2026-04-30 14:00 KST | 3 | 0.42% |
| 2026-04-30 15:00 KST | 8 | 1.13% |
| 2026-04-30 16:00 KST | 18 | 2.54% |
| 2026-04-30 17:00 KST | 7 | 0.99% |
| 2026-04-30 19:00 KST | 1 | 0.14% |
| 2026-04-30 20:00 KST | 3 | 0.42% |
| 2026-04-30 21:00 KST | 4 | 0.56% |
| 2026-04-30 22:00 KST | 1 | 0.14% |
| 2026-04-30 23:00 KST | 3 | 0.42% |
| 2026-05-01 00:00 KST | 2 | 0.28% |
| 2026-05-01 01:00 KST | 3 | 0.42% |
| 2026-05-01 02:00 KST | 1 | 0.14% |
| 2026-05-01 03:00 KST | 3 | 0.42% |
| 2026-05-01 04:00 KST | 1 | 0.14% |
| 2026-05-01 05:00 KST | 1 | 0.14% |
| 2026-05-01 06:00 KST | 1 | 0.14% |
| 2026-05-01 07:00 KST | 5 | 0.71% |
| 2026-05-01 08:00 KST | 5 | 0.71% |
| 2026-05-01 09:00 KST | 1 | 0.14% |
| 2026-05-01 10:00 KST | 19 | 2.68% |
| 2026-05-01 11:00 KST | 15 | 2.12% |
| 2026-05-01 12:00 KST | 15 | 2.12% |
| 2026-05-01 13:00 KST | 5 | 0.71% |
| 2026-05-01 14:00 KST | 3 | 0.42% |
| 2026-05-01 15:00 KST | 5 | 0.71% |
| 2026-05-01 16:00 KST | 3 | 0.42% |
| 2026-05-01 17:00 KST | 3 | 0.42% |
| 2026-05-01 18:00 KST | 2 | 0.28% |
| 2026-05-01 19:00 KST | 2 | 0.28% |
| 2026-05-01 20:00 KST | 3 | 0.42% |
| 2026-05-01 21:00 KST | 2 | 0.28% |
| 2026-05-01 23:00 KST | 2 | 0.28% |
| 2026-05-02 00:00 KST | 3 | 0.42% |
| 2026-05-02 01:00 KST | 4 | 0.56% |
| 2026-05-02 02:00 KST | 5 | 0.71% |
| 2026-05-02 03:00 KST | 2 | 0.28% |
| 2026-05-02 04:00 KST | 5 | 0.71% |
| 2026-05-02 05:00 KST | 1 | 0.14% |
| 2026-05-02 06:00 KST | 9 | 1.27% |
| 2026-05-02 07:00 KST | 4 | 0.56% |
| 2026-05-02 08:00 KST | 4 | 0.56% |
| 2026-05-02 10:00 KST | 1 | 0.14% |
| 2026-05-02 11:00 KST | 4 | 0.56% |
| 2026-05-02 12:00 KST | 5 | 0.71% |
| 2026-05-02 13:00 KST | 6 | 0.85% |
| 2026-05-02 14:00 KST | 6 | 0.85% |
| 2026-05-02 15:00 KST | 7 | 0.99% |
| 2026-05-02 16:00 KST | 5 | 0.71% |
| 2026-05-02 17:00 KST | 3 | 0.42% |
| 2026-05-02 18:00 KST | 2 | 0.28% |
| 2026-05-02 19:00 KST | 2 | 0.28% |
| 2026-05-02 20:00 KST | 4 | 0.56% |
| 2026-05-02 21:00 KST | 3 | 0.42% |
| 2026-05-02 22:00 KST | 2 | 0.28% |
| 2026-05-02 23:00 KST | 1 | 0.14% |
| 2026-05-03 00:00 KST | 1 | 0.14% |
| 2026-05-03 01:00 KST | 1 | 0.14% |
| 2026-05-03 02:00 KST | 3 | 0.42% |
| 2026-05-03 03:00 KST | 1 | 0.14% |
| 2026-05-03 04:00 KST | 3 | 0.42% |
| 2026-05-03 05:00 KST | 5 | 0.71% |
| 2026-05-03 06:00 KST | 3 | 0.42% |
| 2026-05-03 07:00 KST | 4 | 0.56% |
| 2026-05-03 08:00 KST | 4 | 0.56% |
| 2026-05-03 09:00 KST | 9 | 1.27% |
| 2026-05-03 10:00 KST | 4 | 0.56% |
| 2026-05-03 11:00 KST | 5 | 0.71% |
| 2026-05-03 12:00 KST | 2 | 0.28% |
| 2026-05-03 13:00 KST | 11 | 1.55% |
| 2026-05-03 14:00 KST | 5 | 0.71% |
| 2026-05-03 15:00 KST | 11 | 1.55% |
| 2026-05-03 16:00 KST | 16 | 2.26% |
| 2026-05-03 17:00 KST | 11 | 1.55% |
| 2026-05-03 18:00 KST | 5 | 0.71% |
| 2026-05-03 19:00 KST | 7 | 0.99% |
| 2026-05-03 20:00 KST | 8 | 1.13% |
| 2026-05-03 21:00 KST | 12 | 1.69% |
| 2026-05-03 23:00 KST | 1 | 0.14% |
| 2026-05-04 00:00 KST | 4 | 0.56% |
| 2026-05-04 01:00 KST | 7 | 0.99% |
| 2026-05-04 02:00 KST | 4 | 0.56% |
| 2026-05-04 03:00 KST | 4 | 0.56% |
| 2026-05-04 05:00 KST | 3 | 0.42% |
| 2026-05-04 06:00 KST | 4 | 0.56% |
| 2026-05-04 07:00 KST | 7 | 0.99% |
| 2026-05-04 08:00 KST | 7 | 0.99% |
| 2026-05-04 09:00 KST | 3 | 0.42% |
| 2026-05-04 10:00 KST | 5 | 0.71% |
| 2026-05-04 11:00 KST | 4 | 0.56% |
| 2026-05-04 12:00 KST | 2 | 0.28% |
| 2026-05-04 13:00 KST | 2 | 0.28% |
| 2026-05-04 14:00 KST | 3 | 0.42% |
| 2026-05-04 15:00 KST | 1 | 0.14% |
| 2026-05-04 16:00 KST | 4 | 0.56% |
| 2026-05-04 17:00 KST | 3 | 0.42% |
| 2026-05-04 18:00 KST | 4 | 0.56% |
| 2026-05-04 19:00 KST | 7 | 0.99% |
| 2026-05-04 21:00 KST | 1 | 0.14% |
| 2026-05-04 22:00 KST | 2 | 0.28% |
| 2026-05-04 23:00 KST | 4 | 0.56% |

### Action Queue

상위 미결제 클릭 상품은 purchase가 아니라 결제 UX와 리마케팅 검토 후보로만 본다.

| product_idx | product_name | clicked_no_purchase | share | analysis_action | guardrail |
| --- | --- | --- | --- | --- | --- |
| 317 | 혈당관리엔 당당케어 (120정) | 189 | 26.66% | 상품 상세/가격/배송비/결제 UX 가설 작성 | 7일 후보정 전 audience 전송 금지 |
| 97 | 바이오밸런스 90정 (1개월분) | 134 | 18.9% | 상품 상세/가격/배송비/결제 UX 가설 작성 | 7일 후보정 전 audience 전송 금지 |
| 198 | 뉴로마스터 60정 (1개월분) | 113 | 15.94% | 상품 상세/가격/배송비/결제 UX 가설 작성 | 7일 후보정 전 audience 전송 금지 |
| 386 | 메타드림 식물성 멜라토닌 함유 | 97 | 13.68% | 상품 상세/가격/배송비/결제 UX 가설 작성 | 7일 후보정 전 audience 전송 금지 |
| 300 | 영데이즈 저속노화 SOD 효소 (15포) | 59 | 8.32% | 상품 상세/가격/배송비/결제 UX 가설 작성 | 7일 후보정 전 audience 전송 금지 |
| 171 | 풍성밸런스 90정 (1개월분) | 42 | 5.92% | 상품 상세/가격/배송비/결제 UX 가설 작성 | 7일 후보정 전 audience 전송 금지 |
| 328 | 종합 대사기능&음식물 과민증 검사 Set | 35 | 4.94% | 상품 상세/가격/배송비/결제 UX 가설 작성 | 7일 후보정 전 audience 전송 금지 |
| 225 | 다래케어 180정 (1개월분) | 14 | 1.97% | 상품 상세/가격/배송비/결제 UX 가설 작성 | 7일 후보정 전 audience 전송 금지 |
| 409 | 리셋데이 글루텐분해효소 알파CD 차전자피 K-낙산균 | 4 | 0.56% | 상품 상세/가격/배송비/결제 UX 가설 작성 | 7일 후보정 전 audience 전송 금지 |
| 423 | 팀키토 저포드맵 도시락 7종 골라담기 | 4 | 0.56% | 상품 상세/가격/배송비/결제 UX 가설 작성 | 7일 후보정 전 audience 전송 금지 |

## BigQuery Lookup IDs

A급 production 후보는 `order_number`와 `channel_order_no`를 모두 GA4 raw/purchase에서 조회한다. 둘 중 하나라도 존재하면 `already_in_ga4=present`로 막고, 둘 다 robust query에서 조회되지 않은 경우 `already_in_ga4=robust_absent`로 표시한다.

| order_number | channel_order_no | lookup_ids | candidate_scope | already_in_ga4 | lookup_status |
| --- | --- | --- | --- | --- | --- |
| 202604280487104 | 2026042865542930 | 202604280487104, 2026042865542930 | a_grade_production_candidate | unknown | BigQuery 확인 필요 |
| 202604285552452 | 2026042867285600 | 202604285552452, 2026042867285600 | a_grade_production_candidate | unknown | BigQuery 확인 필요 |
| 202604303307399 | 2026043034982320 | 202604303307399, 2026043034982320 | a_grade_production_candidate | unknown | BigQuery 확인 필요 |
| 202604309992065 | 2026043040116970 | 202604309992065, 2026043040116970 | a_grade_production_candidate | unknown | BigQuery 확인 필요 |
| 202604302383065 | 2026043043205620 | 202604302383065, 2026043043205620 | a_grade_production_candidate | unknown | BigQuery 확인 필요 |
| 202604309594732 | 2026043044799490 | 202604309594732, 2026043044799490 | a_grade_production_candidate | unknown | BigQuery 확인 필요 |
| 202605011540306 | 2026050158972710 | 202605011540306, 2026050158972710 | a_grade_production_candidate | unknown | BigQuery 확인 필요 |
| 202605026187995 | 2026050280712120 | 202605026187995, 2026050280712120 | a_grade_production_candidate | unknown | BigQuery 확인 필요 |
| 202605027178971 | 2026050281216190 | 202605027178971, 2026050281216190 | a_grade_production_candidate | unknown | BigQuery 확인 필요 |
| 202605031873910 | 2026050331688110 | 202605031873910, 2026050331688110 | a_grade_production_candidate | unknown | BigQuery 확인 필요 |

### BigQuery Query Template

아래 쿼리는 템플릿이다. `<PROJECT>.<GA4_DATASET>`를 실제 GA4 export dataset으로 바꿔 실행한다. `order_number`와 `channel_order_no` 중 하나라도 조회되면 해당 주문은 `already_in_ga4=present`로 막는다.

```sql
WITH ids AS (
  SELECT id FROM UNNEST(['202604280487104', '2026042865542930', '202604285552452', '2026042867285600', '202604303307399', '2026043034982320', '202604309992065', '2026043040116970', '202604302383065', '2026043043205620', '202604309594732', '2026043044799490', '202605011540306', '2026050158972710', '202605026187995', '2026050280712120', '202605027178971', '2026050281216190', '202605031873910', '2026050331688110']) AS id
)
SELECT
  event_date,
  event_timestamp,
  event_name,
  ecommerce.transaction_id AS ecommerce_transaction_id,
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'transaction_id') AS event_param_transaction_id,
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'pay_method') AS pay_method
FROM `<PROJECT>.<GA4_DATASET>.events_*`
WHERE _TABLE_SUFFIX BETWEEN '20260427' AND '20260506'
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

| order_number | channel_order_no | matched_intent_id | client_id | ga_session_id | value | currency | event_id | already_in_ga4 | send_candidate | block_reason | paid_at | paid_at_72h | paid_at_age_hours | client_id_present | ga_session_id_present | transaction_id | channel_order_no_param | timestamp_micros | dispatch_dedupe_key |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 202604275329932 | 2026042761751160 | 5c1fe505-6130-482d-b33c-45535823b5f4 | 880190675.1777297553 | 1777297553 | 117000 | KRW | NPayRecoveredPurchase_202604275329932 | unknown | N | ambiguous, not_a_grade_strong, already_in_ga4_unknown | 2026-04-27T13:52:16.000Z | N | 191.4 | Y | Y | 202604275329932 | 2026042761751160 | 1777297936000000 | npay_recovery_ga4_purchase:biocom:202604275329932 |
| 202604289063428 | 2026042865161940 | 5a4c859f-3771-4b87-8ba2-13cb58ac5820 | 828165815.1777317234 | 1777317234 | 496000 | KRW | NPayRecoveredPurchase_202604289063428 | unknown | N | ambiguous, not_a_grade_strong, already_in_ga4_unknown | 2026-04-27T19:24:52.000Z | N | 185.8 | Y | Y | 202604289063428 | 2026042865161940 | 1777317892000000 | npay_recovery_ga4_purchase:biocom:202604289063428 |
| 202604280487104 | 2026042865542930 | 84060938-5e29-46d5-894f-105fac1b6d62 | 695356435.1777324290 | 1777324290 | 35000 | KRW | NPayRecoveredPurchase_202604280487104 | unknown | N | already_in_ga4_unknown | 2026-04-27T21:13:24.000Z | N | 184 | Y | Y | 202604280487104 | 2026042865542930 | 1777324404000000 | npay_recovery_ga4_purchase:biocom:202604280487104 |
| 202604285552452 | 2026042867285600 | 6ed1547f-3846-4da3-ad91-c6d00c42509e | 806449930.1777331701 | 1777331701 | 496000 | KRW | NPayRecoveredPurchase_202604285552452 | unknown | N | already_in_ga4_unknown | 2026-04-27T23:27:09.000Z | N | 181.8 | Y | Y | 202604285552452 | 2026042867285600 | 1777332429000000 | npay_recovery_ga4_purchase:biocom:202604285552452 |
| 202604283756893 | 2026042875392500 | c42232c8-de9e-43ee-8c18-4105aa28aeeb | 772603471.1777340977 | 1777348462 | 975000 | KRW | NPayRecoveredPurchase_202604283756893 | unknown | N | not_a_grade_strong, already_in_ga4_unknown | 2026-04-28T04:03:41.000Z | N | 177.2 | Y | Y | 202604283756893 | 2026042875392500 | 1777349021000000 | npay_recovery_ga4_purchase:biocom:202604283756893 |
| 202604295198830 | 2026042916849620 | 4479b9b8-1827-4dff-a998-70613562bd22 | 1738862242.1777439744 | 1777439744 | 496000 | KRW | NPayRecoveredPurchase_202604295198830 | unknown | N | ambiguous, not_a_grade_strong, already_in_ga4_unknown | 2026-04-29T05:22:18.000Z | N | 151.9 | Y | Y | 202604295198830 | 2026042916849620 | 1777440138000000 | npay_recovery_ga4_purchase:biocom:202604295198830 |
| 202604303307399 | 2026043034982320 | b0234ffc-fede-48f5-a313-87480a4884e2 | 901508731.1765852144 | 1777508260 | 496000 | KRW | NPayRecoveredPurchase_202604303307399 | unknown | N | already_in_ga4_unknown | 2026-04-30T00:19:10.000Z | N | 132.9 | Y | Y | 202604303307399 | 2026043034982320 | 1777508350000000 | npay_recovery_ga4_purchase:biocom:202604303307399 |
| 202604309992065 | 2026043040116970 | aa6cb8b7-4e55-4731-8fe2-c65dc269e6cc | 118292165.1777520272 | 1777520272 | 35000 | KRW | NPayRecoveredPurchase_202604309992065 | unknown | N | already_in_ga4_unknown | 2026-04-30T03:41:30.000Z | N | 129.6 | Y | Y | 202604309992065 | 2026043040116970 | 1777520490000000 | npay_recovery_ga4_purchase:biocom:202604309992065 |
| 202604303298608 | 2026043043127990 | 9eb98bc2-d36d-4c1d-88d9-e2f28d4046c9 | 1536913857.1775778564 | 1777527909 | 148200 | KRW | NPayRecoveredPurchase_202604303298608 | unknown | N | not_a_grade_strong, already_in_ga4_unknown | 2026-04-30T05:47:54.000Z | N | 127.5 | Y | Y | 202604303298608 | 2026043043127990 | 1777528074000000 | npay_recovery_ga4_purchase:biocom:202604303298608 |
| 202604302383065 | 2026043043205620 | 34356f9b-33ee-4a5e-88f6-44e52d808ad0 | 2007220387.1777523364 | 1777527289 | 35000 | KRW | NPayRecoveredPurchase_202604302383065 | unknown | N | already_in_ga4_unknown | 2026-04-30T05:50:59.000Z | N | 127.4 | Y | Y | 202604302383065 | 2026043043205620 | 1777528259000000 | npay_recovery_ga4_purchase:biocom:202604302383065 |
| 202604309594732 | 2026043044799490 | 572bdc1a-389b-4128-a389-b9750b063c90 | 349382661.1770783461 | 1777532376 | 11900 | KRW | NPayRecoveredPurchase_202604309594732 | unknown | N | already_in_ga4_unknown | 2026-04-30T07:01:14.000Z | N | 126.2 | Y | Y | 202604309594732 | 2026043044799490 | 1777532474000000 | npay_recovery_ga4_purchase:biocom:202604309594732 |
| 202604307495485 | 2026043050675170 | b2a26d87-5b8f-4fd5-b6ce-46507dc1a5c2 | 1736093538.1775875445 | 1777539308 | 39000 | KRW | NPayRecoveredPurchase_202604307495485 | unknown | N | ambiguous, not_a_grade_strong, already_in_ga4_unknown | 2026-04-30T11:59:24.000Z | N | 121.3 | Y | Y | 202604307495485 | 2026043050675170 | 1777550364000000 | npay_recovery_ga4_purchase:biocom:202604307495485 |
| 202604305294407 | 2026043053058190 | 3f507ffb-1454-454a-bf49-4f3728f1942d | 816678760.1777557486 | 1777557486 | 161700 | KRW | NPayRecoveredPurchase_202604305294407 | unknown | N | not_a_grade_strong, already_in_ga4_unknown | 2026-04-30T14:04:53.000Z | N | 119.2 | Y | Y | 202604305294407 | 2026043053058190 | 1777557893000000 | npay_recovery_ga4_purchase:biocom:202604305294407 |
| 202605013241376 | 2026050158750350 | 6b63cad2-4db6-4065-9409-8e3821000893 | 669709684.1771712337 | 1777593056 | 339300 | KRW | NPayRecoveredPurchase_202605013241376 | unknown | N | ambiguous, not_a_grade_strong, already_in_ga4_unknown | 2026-05-01T00:05:23.000Z | N | 109.2 | Y | Y | 202605013241376 | 2026050158750350 | 1777593923000000 | npay_recovery_ga4_purchase:biocom:202605013241376 |
| 202605011540306 | 2026050158972710 | b9ca845f-9a56-4a0a-a78e-5f495419ba6a | 985413772.1774220691 | 1777594221 | 496000 | KRW | NPayRecoveredPurchase_202605011540306 | unknown | N | already_in_ga4_unknown | 2026-05-01T00:16:46.000Z | N | 109 | Y | Y | 202605011540306 | 2026050158972710 | 1777594606000000 | npay_recovery_ga4_purchase:biocom:202605011540306 |
| 202605013947069 | 2026050174275040 | a3853db2-bd68-4211-8e42-70425b3bc6e0 | 851056072.1777100414 | 1777635989 | 978000 | KRW | NPayRecoveredPurchase_202605013947069 | unknown | N | not_a_grade_strong, already_in_ga4_unknown | 2026-05-01T11:53:10.000Z | N | 97.4 | Y | Y | 202605013947069 | 2026050174275040 | 1777636390000000 | npay_recovery_ga4_purchase:biocom:202605013947069 |
| 202605026187995 | 2026050280712120 | a8659001-0966-4937-8a49-129c19c09cf9 | - | - | 35000 | KRW | NPayRecoveredPurchase_202605026187995 | unknown | N | already_in_ga4_unknown | 2026-05-01T23:04:34.000Z | N | 86.2 | N | N | 202605026187995 | 2026050280712120 | 1777676674000000 | npay_recovery_ga4_purchase:biocom:202605026187995 |
| 202605027178971 | 2026050281216190 | 06f6d2d3-61dd-47de-a9fc-389a49b20e1e | 90602956.1776243790 | 1777678740 | 496000 | KRW | NPayRecoveredPurchase_202605027178971 | unknown | N | already_in_ga4_unknown | 2026-05-01T23:44:31.000Z | N | 85.5 | Y | Y | 202605027178971 | 2026050281216190 | 1777679071000000 | npay_recovery_ga4_purchase:biocom:202605027178971 |
| 202605023918252 | 2026050281699210 | 1218118b-5946-4d7c-bd80-7513ed6a6d54 | - | - | 117000 | KRW | NPayRecoveredPurchase_202605023918252 | unknown | N | not_a_grade_strong, already_in_ga4_unknown | 2026-05-02T00:16:12.000Z | N | 85 | N | N | 202605023918252 | 2026050281699210 | 1777680972000000 | npay_recovery_ga4_purchase:biocom:202605023918252 |
| 202605022046757 | 2026050285300840 | b1de1584-c398-413c-ad2e-7d0c76a4d12c | 1185846745.1776736823 | 1777691590 | 117000 | KRW | NPayRecoveredPurchase_202605022046757 | unknown | N | not_a_grade_strong, already_in_ga4_unknown | 2026-05-02T03:13:41.000Z | N | 82 | Y | Y | 202605022046757 | 2026050285300840 | 1777691621000000 | npay_recovery_ga4_purchase:biocom:202605022046757 |
| 202605024695718 | 2026050295172640 | f9b92c18-c1e2-4013-a8f8-7704a3dc3513 | 1809327675.1777119397 | 1777721669 | 120000 | KRW | NPayRecoveredPurchase_202605024695718 | unknown | N | not_a_grade_strong, already_in_ga4_unknown | 2026-05-02T11:39:11.000Z | N | 73.6 | Y | Y | 202605024695718 | 2026050295172640 | 1777721951000000 | npay_recovery_ga4_purchase:biocom:202605024695718 |
| 202605033001947 | 2026050311336550 | c40a0e03-1fc3-425c-9b50-06ebaf1e9004 | 1951287909.1777761881 | 1777761880 | 975000 | KRW | NPayRecoveredPurchase_202605033001947 | unknown | N | not_a_grade_strong, already_in_ga4_unknown | 2026-05-02T22:51:52.000Z | Y | 62.4 | Y | Y | 202605033001947 | 2026050311336550 | 1777762312000000 | npay_recovery_ga4_purchase:biocom:202605033001947 |
| 202605037443252 | 2026050312341550 | fdf14a90-53de-4fb8-94cd-b2251dc23bdf | 1201813305.1777708546 | 1777767016 | 496000 | KRW | NPayRecoveredPurchase_202605037443252 | unknown | N | ambiguous, not_a_grade_strong, already_in_ga4_unknown | 2026-05-03T00:16:25.000Z | Y | 61 | Y | Y | 202605037443252 | 2026050312341550 | 1777767385000000 | npay_recovery_ga4_purchase:biocom:202605037443252 |
| 202605036979766 | 2026050315711070 | c0f54aeb-4df6-4198-872d-3f5f53c94a75 | 2133113673.1771693641 | 1777775749 | 109200 | KRW | NPayRecoveredPurchase_202605036979766 | unknown | N | ambiguous, not_a_grade_strong, already_in_ga4_unknown | 2026-05-03T03:04:53.000Z | Y | 58.2 | Y | Y | 202605036979766 | 2026050315711070 | 1777777493000000 | npay_recovery_ga4_purchase:biocom:202605036979766 |
| 202605033654935 | 2026050318679610 | 918b6782-8c50-47b7-b6f1-e5f8e5535abf | 1161535895.1777785573 | 1777785573 | 117000 | KRW | NPayRecoveredPurchase_202605033654935 | unknown | N | ambiguous, not_a_grade_strong, already_in_ga4_unknown | 2026-05-03T05:27:43.000Z | Y | 55.8 | Y | Y | 202605033654935 | 2026050318679610 | 1777786063000000 | npay_recovery_ga4_purchase:biocom:202605033654935 |
| 202605031517085 | 2026050328355140 | 37f626bb-0a2b-47b6-8bd2-c05792b88a9a | 1998499720.1777810727 | 1777810726 | 42600 | KRW | NPayRecoveredPurchase_202605031517085 | unknown | N | ambiguous, not_a_grade_strong, already_in_ga4_unknown | 2026-05-03T12:23:07.000Z | Y | 48.9 | Y | Y | 202605031517085 | 2026050328355140 | 1777810987000000 | npay_recovery_ga4_purchase:biocom:202605031517085 |
| 202605031873910 | 2026050331688110 | a1943060-9bda-481a-85c4-a8499205c2ec | 1333734162.1777818563 | 1777818562 | 496000 | KRW | NPayRecoveredPurchase_202605031873910 | unknown | N | already_in_ga4_unknown | 2026-05-03T14:33:32.000Z | Y | 46.7 | Y | Y | 202605031873910 | 2026050331688110 | 1777818812000000 | npay_recovery_ga4_purchase:biocom:202605031873910 |
| 202605047544570 | 2026050432504950 | 0cb9e172-aac5-4535-9eb7-2f133722bbc9 | - | - | 35000 | KRW | NPayRecoveredPurchase_202605047544570 | unknown | N | ambiguous, not_a_grade_strong, already_in_ga4_unknown | 2026-05-03T15:14:34.000Z | Y | 46 | N | N | 202605047544570 | 2026050432504950 | 1777821274000000 | npay_recovery_ga4_purchase:biocom:202605047544570 |
| 202605042286528 | 2026050434702070 | 994ee64f-838c-4b9d-bfa7-0799719751df | 1943277021.1777843588 | 1777843587 | 496000 | KRW | NPayRecoveredPurchase_202605042286528 | unknown | N | not_a_grade_strong, already_in_ga4_unknown | 2026-05-03T21:31:25.000Z | Y | 39.7 | Y | Y | 202605042286528 | 2026050434702070 | 1777843885000000 | npay_recovery_ga4_purchase:biocom:202605042286528 |
| 202605041662694 | 2026050447240150 | 12a50a6a-48c7-4ec4-aa42-f723c7398676 | 1109039205.1777874331 | 1777874331 | 117000 | KRW | NPayRecoveredPurchase_202605041662694 | unknown | N | not_a_grade_strong, already_in_ga4_unknown | 2026-05-04T06:00:10.000Z | Y | 31.3 | Y | Y | 202605041662694 | 2026050447240150 | 1777874410000000 | npay_recovery_ga4_purchase:biocom:202605041662694 |

## Amount Reconciliation

| amount_match_type | orders |
| --- | --- |
| final_exact | 15 |
| item_exact | 0 |
| shipping_reconciled | 1 |
| discount_reconciled | 0 |
| quantity_reconciled | 1 |
| cart_contains_item | 2 |
| near | 0 |
| none | 11 |
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
| 202604307495485 | 2026043050675170 | 1 | b2a26d87-5b8f-4fd5-b6ce-46507dc1a5c2 | 2026-04-30T08:55:19.298Z | 184.1 | 52 | time:2, product:30, amount:20 | 97 | N/A | exact | 39000 | 39000 | 0 | 39000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | gclid, fbp | googleads_shopping_supplements_biobalance |
| 202604307495485 | 2026043050675170 | 2 | 096a5c6e-28a6-4fc0-a73f-a3d8ad80a58a | 2026-04-30T08:07:47.787Z | 231.6 | 52 | time:2, product:30, amount:20 | 97 | N/A | exact | 39000 | 39000 | 0 | 39000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | gclid, fbp | googleads_shopping_supplements_biobalance |
| 202604307495485 | 2026043050675170 | 3 | ea3cd33a-3680-4db7-a69c-204aade88b22 | 2026-04-30T07:41:58.781Z | 257.4 | 52 | time:2, product:30, amount:20 | 97 | N/A | exact | 39000 | 39000 | 0 | 39000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | gclid, fbp | googleads_shopping_supplements_biobalance |
| 202604307495485 | 2026043050675170 | 4 | 52e71e0b-dcbd-4266-a11d-a2c1163a7b64 | 2026-04-30T07:40:58.653Z | 258.4 | 52 | time:2, product:30, amount:20 | 97 | N/A | exact | 39000 | 39000 | 0 | 39000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | gclid, fbp | googleads_shopping_supplements_biobalance |
| 202604307495485 | 2026043050675170 | 5 | 705b6f91-354a-4672-a59d-4190cd77a1f0 | 2026-04-30T07:39:04.784Z | 260.3 | 52 | time:2, product:30, amount:20 | 97 | N/A | exact | 39000 | 39000 | 0 | 39000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | gclid, fbp | googleads_shopping_supplements_biobalance |
| 202604305294407 | 2026043053058190 | 1 | 3f507ffb-1454-454a-bf49-4f3728f1942d | 2026-04-30T14:02:52.542Z | 2 | 50 | time:20, product:30, amount:0 | 31 | N/A | exact | 59900 | 161700 | 0 | 161700 | 101800 | none | amount_not_reconciled | Y | Y | fbp | - |
| 202604305294407 | 2026043053058190 | 2 | 93e42fcf-8b1e-4d73-aaed-67b6d3c13b42 | 2026-04-30T13:54:57.824Z | 9.9 | 20 | time:20, product:0, amount:0 | 97 | N/A | none | 39000 | 161700 | 0 | 161700 | 122700 | none | amount_not_reconciled | Y | Y | gclid, fbp | googleads_shopping_supplements_biobalance |
| 202604305294407 | 2026043053058190 | 3 | 9eb98bc2-d36d-4c1d-88d9-e2f28d4046c9 | 2026-04-30T05:47:12.244Z | 497.7 | 16 | time:2, product:14, amount:0 | 21 | N/A | token_overlap | 54900 | 161700 | 0 | 161700 | 106800 | none | amount_not_reconciled | Y | Y | fbp | - |
| 202604305294407 | 2026043053058190 | 4 | 6940ed78-9cf9-4f0c-988e-ab73f9182fe0 | 2026-04-30T12:36:51.138Z | 88 | 2 | time:2, product:0, amount:0 | 317 | N/A | none | 59800 | 161700 | 0 | 161700 | 101900 | none | amount_not_reconciled | Y | Y | gclid, fbp | googleads_shopping_supplements_dangdang |
| 202604305294407 | 2026043053058190 | 5 | 348e7177-a0ad-4bc5-bfd1-27f556f53066 | 2026-04-30T12:34:29.946Z | 90.4 | 2 | time:2, product:0, amount:0 | 328 | N/A | none | 496000 | 161700 | 0 | 161700 | -334300 | none | amount_not_reconciled | Y | Y | fbp | - |
| 202605013241376 | 2026050158750350 | 1 | 6b63cad2-4db6-4065-9409-8e3821000893 | 2026-04-30T23:51:27.570Z | 13.9 | 62 | time:20, product:30, amount:12 | 198 | N/A | exact | 35000 | 1017900 | 0 | 339300 | 304300 | cart_contains_item | cart_contains_item=true; order amount is cart total for multiple products | Y | Y | gclid, fbp | googleads_shopping_supplements_neuromaster |
| 202605013241376 | 2026050158750350 | 2 | 1c72873b-81e2-43cc-b0da-03445649ed9c | 2026-04-30T23:50:39.652Z | 14.7 | 62 | time:20, product:30, amount:12 | 198 | N/A | exact | 35000 | 1017900 | 0 | 339300 | 304300 | cart_contains_item | cart_contains_item=true; order amount is cart total for multiple products | Y | Y | gclid, fbp | googleads_shopping_supplements_neuromaster |
| 202605013241376 | 2026050158750350 | 3 | 3ede8417-c2ac-4a85-af50-c8ee14d3c56b | 2026-04-30T23:50:08.038Z | 15.2 | 52 | time:10, product:30, amount:12 | 97 | N/A | exact | 39000 | 1017900 | 0 | 339300 | 300300 | cart_contains_item | cart_contains_item=true; order amount is cart total for multiple products | Y | Y | gclid, fbp | googleads_shopping_supplements_biobalance |
| 202605013241376 | 2026050158750350 | 4 | a887584d-0734-4f8e-b7e6-604b06ae3a66 | 2026-04-30T23:31:37.397Z | 33.8 | 52 | time:10, product:30, amount:12 | 97 | N/A | exact | 39000 | 1017900 | 0 | 339300 | 300300 | cart_contains_item | cart_contains_item=true; order amount is cart total for multiple products | Y | Y | gclid, fbp | googleads_shopping_supplements_biobalance |
| 202605013241376 | 2026050158750350 | 5 | c1e454f2-0769-41aa-b16f-707418314ef4 | 2026-04-30T22:47:30.554Z | 77.9 | 44 | time:2, product:30, amount:12 | 97 | N/A | exact | 39000 | 1017900 | 0 | 339300 | 300300 | cart_contains_item | cart_contains_item=true; order amount is cart total for multiple products | Y | Y | gclid, fbp | googleads_shopping_supplements_biobalance |
| 202605011540306 | 2026050158972710 | 1 | b9ca845f-9a56-4a0a-a78e-5f495419ba6a | 2026-05-01T00:16:01.019Z | 0.7 | 80 | time:30, product:30, amount:20 | 328 | N/A | exact | 496000 | 496000 | 0 | 496000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | fbc, fbp | - |
| 202605011540306 | 2026050158972710 | 2 | 348e7177-a0ad-4bc5-bfd1-27f556f53066 | 2026-04-30T12:34:29.946Z | 702.3 | 52 | time:2, product:30, amount:20 | 328 | N/A | exact | 496000 | 496000 | 0 | 496000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | fbp | - |
| 202605011540306 | 2026050158972710 | 3 | b0234ffc-fede-48f5-a313-87480a4884e2 | 2026-04-30T00:17:52.600Z | 1438.9 | 52 | time:2, product:30, amount:20 | 328 | N/A | exact | 496000 | 496000 | 0 | 496000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | fbclid, fbc, fbp | meta_biocom_yeonddle_iggacid |
| 202605011540306 | 2026050158972710 | 4 | 711378ac-b74c-43e9-b4ab-be58cecf08f5 | 2026-05-01T00:08:58.216Z | 7.8 | 20 | time:20, product:0, amount:0 | 171 | N/A | none | 35000 | 496000 | 0 | 496000 | 461000 | none | amount_not_reconciled | Y | Y | gclid, fbp | googleads_shopping_supplements_poongsung |
| 202605011540306 | 2026050158972710 | 5 | 6b63cad2-4db6-4065-9409-8e3821000893 | 2026-04-30T23:51:27.570Z | 25.3 | 10 | time:10, product:0, amount:0 | 198 | N/A | none | 35000 | 496000 | 0 | 496000 | 461000 | none | amount_not_reconciled | Y | Y | gclid, fbp | googleads_shopping_supplements_neuromaster |
| 202605013947069 | 2026050174275040 | 1 | a3853db2-bd68-4211-8e42-70425b3bc6e0 | 2026-05-01T11:52:18.622Z | 0.9 | 60 | time:30, product:30, amount:0 | 328 | N/A | exact | 496000 | 975000 | 0 | 978000 | 482000 | none | amount_not_reconciled | Y | Y | fbp | - |
| 202605013947069 | 2026050174275040 | 2 | 4e2c6802-3227-4c49-9b6e-f1282e64b1f6 | 2026-05-01T05:39:51.758Z | 373.3 | 32 | time:2, product:30, amount:0 | 328 | N/A | exact | 496000 | 975000 | 0 | 978000 | 482000 | none | amount_not_reconciled | Y | Y | fbclid, fbc, fbp | meta_biocom_iggacidset_2026 |
| 202605013947069 | 2026050174275040 | 3 | b9ca845f-9a56-4a0a-a78e-5f495419ba6a | 2026-05-01T00:16:01.019Z | 697.1 | 32 | time:2, product:30, amount:0 | 328 | N/A | exact | 496000 | 975000 | 0 | 978000 | 482000 | none | amount_not_reconciled | Y | Y | fbc, fbp | - |
| 202605013947069 | 2026050174275040 | 4 | 348e7177-a0ad-4bc5-bfd1-27f556f53066 | 2026-04-30T12:34:29.946Z | 1398.7 | 32 | time:2, product:30, amount:0 | 328 | N/A | exact | 496000 | 975000 | 0 | 978000 | 482000 | none | amount_not_reconciled | Y | Y | fbp | - |
| 202605013947069 | 2026050174275040 | 5 | 193492e5-9c04-4c77-b24d-75e4682af1cc | 2026-05-01T11:42:59.773Z | 10.2 | 20 | time:20, product:0, amount:0 | 317 | N/A | none | 59800 | 975000 | 0 | 978000 | 918200 | none | amount_not_reconciled | Y | Y | gclid, fbp | googleads_shopping_supplements_dangdang |
| 202605026187995 | 2026050280712120 | 1 | a8659001-0966-4937-8a49-129c19c09cf9 | 2026-05-01T23:04:00.118Z | 0.6 | 80 | time:30, product:30, amount:20 | 198 | N/A | exact | 35000 | 35000 | 0 | 35000 | 0 | final_exact | intent_product_price == order_payment_amount | N | N | fbclid | meta_master_slow |
| 202605026187995 | 2026050280712120 | 2 | 4a828706-4fc1-4313-8ac7-6507a788c7e3 | 2026-05-01T21:39:00.588Z | 85.6 | 52 | time:2, product:30, amount:20 | 198 | N/A | exact | 35000 | 35000 | 0 | 35000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | gclid, fbp | googleads_shopping_supplements_neuromaster |
| 202605026187995 | 2026050280712120 | 3 | 8ab41bc3-0901-44b4-a6bc-5540a9945dae | 2026-05-01T21:36:30.043Z | 88.1 | 52 | time:2, product:30, amount:20 | 198 | N/A | exact | 35000 | 35000 | 0 | 35000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | gclid, fbp | googleads_shopping_supplements_neuromaster |
| 202605026187995 | 2026050280712120 | 4 | 32c53c19-32b1-4130-a1bf-6724e0343112 | 2026-05-01T18:40:43.683Z | 263.8 | 52 | time:2, product:30, amount:20 | 198 | N/A | exact | 35000 | 35000 | 0 | 35000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | gclid, fbp | googleads_shopping_supplements_neuromaster |
| 202605026187995 | 2026050280712120 | 5 | 1bf91f1b-3e42-4ef2-b204-84ec6ab9e74d | 2026-05-01T17:30:46.119Z | 333.8 | 52 | time:2, product:30, amount:20 | 198 | N/A | exact | 35000 | 35000 | 0 | 35000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | gclid, fbp | googleads_shopping_supplements_neuromaster |
| 202605027178971 | 2026050281216190 | 1 | 06f6d2d3-61dd-47de-a9fc-389a49b20e1e | 2026-05-01T23:44:17.449Z | 0.2 | 80 | time:30, product:30, amount:20 | 328 | N/A | exact | 496000 | 496000 | 0 | 496000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | fbc, fbp | - |
| 202605027178971 | 2026050281216190 | 2 | a3853db2-bd68-4211-8e42-70425b3bc6e0 | 2026-05-01T11:52:18.622Z | 712.2 | 52 | time:2, product:30, amount:20 | 328 | N/A | exact | 496000 | 496000 | 0 | 496000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | fbp | - |
| 202605027178971 | 2026050281216190 | 3 | 4e2c6802-3227-4c49-9b6e-f1282e64b1f6 | 2026-05-01T05:39:51.758Z | 1084.7 | 52 | time:2, product:30, amount:20 | 328 | N/A | exact | 496000 | 496000 | 0 | 496000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | fbclid, fbc, fbp | meta_biocom_iggacidset_2026 |
| 202605027178971 | 2026050281216190 | 4 | b9ca845f-9a56-4a0a-a78e-5f495419ba6a | 2026-05-01T00:16:01.019Z | 1408.5 | 52 | time:2, product:30, amount:20 | 328 | N/A | exact | 496000 | 496000 | 0 | 496000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | fbc, fbp | - |
| 202605027178971 | 2026050281216190 | 5 | 057d6687-48c4-4d07-9d49-58ba4622e4cb | 2026-05-01T23:26:12.782Z | 18.3 | 10 | time:10, product:0, amount:0 | 317 | N/A | none | 59800 | 496000 | 0 | 496000 | 436200 | none | amount_not_reconciled | Y | Y | gclid, fbp | - |
| 202605023918252 | 2026050281699210 | 1 | 1218118b-5946-4d7c-bd80-7513ed6a6d54 | 2026-05-02T00:15:54.037Z | 0.3 | 60 | time:30, product:30, amount:0 | 198 | N/A | exact | 35000 | 117000 | 0 | 117000 | 82000 | none | amount_not_reconciled | N | N | fbclid, fbc, fbp | meta_master_slow |
| 202605023918252 | 2026050281699210 | 2 | a8659001-0966-4937-8a49-129c19c09cf9 | 2026-05-01T23:04:00.118Z | 72.2 | 32 | time:2, product:30, amount:0 | 198 | N/A | exact | 35000 | 117000 | 0 | 117000 | 82000 | none | amount_not_reconciled | N | N | fbclid | meta_master_slow |
| 202605023918252 | 2026050281699210 | 3 | 4a828706-4fc1-4313-8ac7-6507a788c7e3 | 2026-05-01T21:39:00.588Z | 157.2 | 32 | time:2, product:30, amount:0 | 198 | N/A | exact | 35000 | 117000 | 0 | 117000 | 82000 | none | amount_not_reconciled | Y | Y | gclid, fbp | googleads_shopping_supplements_neuromaster |
| 202605023918252 | 2026050281699210 | 4 | 8ab41bc3-0901-44b4-a6bc-5540a9945dae | 2026-05-01T21:36:30.043Z | 159.7 | 32 | time:2, product:30, amount:0 | 198 | N/A | exact | 35000 | 117000 | 0 | 117000 | 82000 | none | amount_not_reconciled | Y | Y | gclid, fbp | googleads_shopping_supplements_neuromaster |
| 202605023918252 | 2026050281699210 | 5 | 32c53c19-32b1-4130-a1bf-6724e0343112 | 2026-05-01T18:40:43.683Z | 335.5 | 32 | time:2, product:30, amount:0 | 198 | N/A | exact | 35000 | 117000 | 0 | 117000 | 82000 | none | amount_not_reconciled | Y | Y | gclid, fbp | googleads_shopping_supplements_neuromaster |
| 202605022046757 | 2026050285300840 | 1 | b1de1584-c398-413c-ad2e-7d0c76a4d12c | 2026-05-02T03:13:17.828Z | 0.4 | 60 | time:30, product:30, amount:0 | 198 | N/A | exact | 35000 | 117000 | 0 | 117000 | 82000 | none | amount_not_reconciled | Y | Y | fbclid, fbc, fbp | meta_biocom_nurostory_nuro |
| 202605022046757 | 2026050285300840 | 2 | 1218118b-5946-4d7c-bd80-7513ed6a6d54 | 2026-05-02T00:15:54.037Z | 177.8 | 32 | time:2, product:30, amount:0 | 198 | N/A | exact | 35000 | 117000 | 0 | 117000 | 82000 | none | amount_not_reconciled | N | N | fbclid, fbc, fbp | meta_master_slow |
| 202605022046757 | 2026050285300840 | 3 | a8659001-0966-4937-8a49-129c19c09cf9 | 2026-05-01T23:04:00.118Z | 249.7 | 32 | time:2, product:30, amount:0 | 198 | N/A | exact | 35000 | 117000 | 0 | 117000 | 82000 | none | amount_not_reconciled | N | N | fbclid | meta_master_slow |
| 202605022046757 | 2026050285300840 | 4 | 4a828706-4fc1-4313-8ac7-6507a788c7e3 | 2026-05-01T21:39:00.588Z | 334.7 | 32 | time:2, product:30, amount:0 | 198 | N/A | exact | 35000 | 117000 | 0 | 117000 | 82000 | none | amount_not_reconciled | Y | Y | gclid, fbp | googleads_shopping_supplements_neuromaster |
| 202605022046757 | 2026050285300840 | 5 | 8ab41bc3-0901-44b4-a6bc-5540a9945dae | 2026-05-01T21:36:30.043Z | 337.2 | 32 | time:2, product:30, amount:0 | 198 | N/A | exact | 35000 | 117000 | 0 | 117000 | 82000 | none | amount_not_reconciled | Y | Y | gclid, fbp | googleads_shopping_supplements_neuromaster |
| 202605024695718 | 2026050295172640 | 1 | f9b92c18-c1e2-4013-a8f8-7704a3dc3513 | 2026-05-02T11:38:17.146Z | 0.9 | 60 | time:30, product:30, amount:0 | 198 | N/A | exact | 35000 | 117000 | 0 | 120000 | 85000 | none | amount_not_reconciled | Y | Y | fbp | inpork_biocom_nuromaster |
| 202605024695718 | 2026050295172640 | 2 | 04f5425b-ab5d-49da-bbd2-b7b2275b41e4 | 2026-05-02T11:15:57.657Z | 23.2 | 40 | time:10, product:30, amount:0 | 198 | N/A | exact | 35000 | 117000 | 0 | 120000 | 85000 | none | amount_not_reconciled | Y | Y | fbclid, fbc, fbp | meta_master_slow |
| 202605024695718 | 2026050295172640 | 3 | 266ed28e-2f63-4f14-88fd-84120434ff0b | 2026-05-02T04:35:05.046Z | 424.1 | 32 | time:2, product:30, amount:0 | 198 | N/A | exact | 35000 | 117000 | 0 | 120000 | 85000 | none | amount_not_reconciled | Y | Y | gclid, fbp | googleads_shopping_supplements_neuromaster |
| 202605024695718 | 2026050295172640 | 4 | 8ef14bbc-b255-4012-9efa-217b1cde14a8 | 2026-05-02T04:21:34.403Z | 437.6 | 32 | time:2, product:30, amount:0 | 198 | N/A | exact | 35000 | 117000 | 0 | 120000 | 85000 | none | amount_not_reconciled | Y | Y | gclid, fbp | googleads_shopping_supplements_neuromaster |
| 202605024695718 | 2026050295172640 | 5 | 0eee7f2f-e3b2-499a-a10e-bd4652e27fb7 | 2026-05-02T03:24:55.227Z | 494.3 | 32 | time:2, product:30, amount:0 | 198 | N/A | exact | 35000 | 117000 | 0 | 120000 | 85000 | none | amount_not_reconciled | Y | Y | gclid, fbp | googleads_shopping_supplements_neuromaster |
| 202605033001947 | 2026050311336550 | 1 | c40a0e03-1fc3-425c-9b50-06ebaf1e9004 | 2026-05-02T22:50:59.404Z | 0.9 | 60 | time:30, product:30, amount:0 | 328 | N/A | exact | 496000 | 975000 | 0 | 975000 | 479000 | none | amount_not_reconciled | Y | Y | fbp | - |
| 202605033001947 | 2026050311336550 | 2 | 6154fed7-99bb-4d64-bce4-3c46ae8d9d5e | 2026-05-02T07:01:01.519Z | 950.8 | 32 | time:2, product:30, amount:0 | 328 | N/A | exact | 496000 | 975000 | 0 | 975000 | 479000 | none | amount_not_reconciled | Y | Y | fbc, fbp | - |
| 202605033001947 | 2026050311336550 | 3 | 913cd75c-f8db-43cf-bd63-da96f54a820d | 2026-05-02T03:02:31.199Z | 1189.3 | 32 | time:2, product:30, amount:0 | 328 | N/A | exact | 496000 | 975000 | 0 | 975000 | 479000 | none | amount_not_reconciled | Y | Y | fbc, fbp | - |
| 202605033001947 | 2026050311336550 | 4 | 76638aa8-d811-41d4-8e07-5a7185eeb365 | 2026-05-02T02:03:47.158Z | 1248.1 | 32 | time:2, product:30, amount:0 | 328 | N/A | exact | 496000 | 975000 | 0 | 975000 | 479000 | none | amount_not_reconciled | Y | Y | fbc, fbp | - |
| 202605033001947 | 2026050311336550 | 5 | 06f6d2d3-61dd-47de-a9fc-389a49b20e1e | 2026-05-01T23:44:17.449Z | 1387.6 | 32 | time:2, product:30, amount:0 | 328 | N/A | exact | 496000 | 975000 | 0 | 975000 | 479000 | none | amount_not_reconciled | Y | Y | fbc, fbp | - |
| 202605037443252 | 2026050312341550 | 1 | fdf14a90-53de-4fb8-94cd-b2251dc23bdf | 2026-05-03T00:15:48.015Z | 0.6 | 80 | time:30, product:30, amount:20 | 328 | N/A | exact | 496000 | 496000 | 0 | 496000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | fbp | - |
| 202605037443252 | 2026050312341550 | 2 | 182debf7-5b6a-4c7b-9fb9-6adcf4d22a8c | 2026-05-03T00:13:01.853Z | 3.4 | 70 | time:20, product:30, amount:20 | 328 | N/A | exact | 496000 | 496000 | 0 | 496000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | fbp | - |
| 202605037443252 | 2026050312341550 | 3 | 43314674-363b-4b62-a0b7-e289a7040de1 | 2026-05-02T23:18:20.534Z | 58.1 | 60 | time:10, product:30, amount:20 | 328 | N/A | exact | 496000 | 496000 | 0 | 496000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | fbp | - |
| 202605037443252 | 2026050312341550 | 4 | 494bc829-8952-4398-a66e-c9e6a7fc1f2d | 2026-05-02T22:56:23.574Z | 80 | 52 | time:2, product:30, amount:20 | 328 | N/A | exact | 496000 | 496000 | 0 | 496000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | fbp | tiktok_biocom_yeonddle_iggacidset |
| 202605037443252 | 2026050312341550 | 5 | c40a0e03-1fc3-425c-9b50-06ebaf1e9004 | 2026-05-02T22:50:59.404Z | 85.4 | 52 | time:2, product:30, amount:20 | 328 | N/A | exact | 496000 | 496000 | 0 | 496000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | fbp | - |
| 202605036979766 | 2026050315711070 | 1 | c0f54aeb-4df6-4198-872d-3f5f53c94a75 | 2026-05-03T02:36:29.972Z | 28.4 | 52 | time:10, product:30, amount:12 | 198 | N/A | exact | 35000 | 955800 | 3000 | 109200 | 74200 | cart_contains_item | cart_contains_item=true; order amount is cart total for multiple products | Y | Y | gclid, fbp | googleads_shopping_supplements_neuromaster |
| 202605036979766 | 2026050315711070 | 2 | 735b46b3-8574-43d5-803f-57209999538f | 2026-05-02T20:36:00.513Z | 388.9 | 44 | time:2, product:30, amount:12 | 198 | N/A | exact | 35000 | 955800 | 3000 | 109200 | 74200 | cart_contains_item | cart_contains_item=true; order amount is cart total for multiple products | Y | Y | gclid, fbp | googleads_shopping_supplements_neuromaster |
| 202605036979766 | 2026050315711070 | 3 | 91f2883d-15de-4ae4-ba00-fc51143f1eb5 | 2026-05-02T12:05:12.593Z | 899.7 | 44 | time:2, product:30, amount:12 | 423 | N/A | exact | 8900 | 955800 | 3000 | 109200 | 100300 | cart_contains_item | cart_contains_item=true; order amount is cart total for multiple products | Y | Y | fbp | - |
| 202605036979766 | 2026050315711070 | 4 | f9b92c18-c1e2-4013-a8f8-7704a3dc3513 | 2026-05-02T11:38:17.146Z | 926.6 | 44 | time:2, product:30, amount:12 | 198 | N/A | exact | 35000 | 955800 | 3000 | 109200 | 74200 | cart_contains_item | cart_contains_item=true; order amount is cart total for multiple products | Y | Y | fbp | inpork_biocom_nuromaster |
| 202605036979766 | 2026050315711070 | 5 | 04f5425b-ab5d-49da-bbd2-b7b2275b41e4 | 2026-05-02T11:15:57.657Z | 948.9 | 44 | time:2, product:30, amount:12 | 198 | N/A | exact | 35000 | 955800 | 3000 | 109200 | 74200 | cart_contains_item | cart_contains_item=true; order amount is cart total for multiple products | Y | Y | fbclid, fbc, fbp | meta_master_slow |
| 202605033654935 | 2026050318679610 | 1 | 918b6782-8c50-47b7-b6f1-e5f8e5535abf | 2026-05-03T05:24:02.259Z | 3.7 | 50 | time:20, product:30, amount:0 | 198 | N/A | exact | 35000 | 117000 | 0 | 117000 | 82000 | none | amount_not_reconciled | Y | Y | fbp | teamketoblog_biocom_dietsuppement_nuro |
| 202605033654935 | 2026050318679610 | 2 | d593c7d2-d34d-468e-9031-4beb39bcfcfe | 2026-05-03T05:23:05.530Z | 4.6 | 50 | time:20, product:30, amount:0 | 198 | N/A | exact | 35000 | 117000 | 0 | 117000 | 82000 | none | amount_not_reconciled | Y | Y | fbp | teamketoblog_biocom_dietsuppement_nuro |
| 202605033654935 | 2026050318679610 | 3 | 881cb250-3948-42aa-a418-6200de72bdd6 | 2026-05-03T04:16:25.074Z | 71.3 | 32 | time:2, product:30, amount:0 | 198 | N/A | exact | 35000 | 117000 | 0 | 117000 | 82000 | none | amount_not_reconciled | Y | Y | gclid, fbp | googleads_shopping_supplements_neuromaster |
| 202605033654935 | 2026050318679610 | 4 | 0f190de7-621b-4647-bacd-bfca8cfffeef | 2026-05-03T03:19:54.788Z | 127.8 | 32 | time:2, product:30, amount:0 | 198 | N/A | exact | 35000 | 117000 | 0 | 117000 | 82000 | none | amount_not_reconciled | Y | Y | gclid, fbp | googleads_shopping_supplements_neuromaster |
| 202605033654935 | 2026050318679610 | 5 | c0f54aeb-4df6-4198-872d-3f5f53c94a75 | 2026-05-03T02:36:29.972Z | 171.2 | 32 | time:2, product:30, amount:0 | 198 | N/A | exact | 35000 | 117000 | 0 | 117000 | 82000 | none | amount_not_reconciled | Y | Y | gclid, fbp | googleads_shopping_supplements_neuromaster |
| 202605031517085 | 2026050328355140 | 1 | 37f626bb-0a2b-47b6-8bd2-c05792b88a9a | 2026-05-03T12:23:00.326Z | 0.1 | 78 | time:30, product:30, amount:18 | 281 | N/A | exact | 9900 | 158400 | 3000 | 42600 | 32700 | quantity_reconciled | order amount reconciles with intent_product_price * quantity plus delivery/discount | Y | Y | fbp | - |
| 202605031517085 | 2026050328355140 | 2 | ac72a7fe-af40-4554-92f0-5160e6417416 | 2026-05-03T12:19:35.336Z | 3.5 | 68 | time:20, product:30, amount:18 | 281 | N/A | exact | 9900 | 158400 | 3000 | 42600 | 32700 | quantity_reconciled | order amount reconciles with intent_product_price * quantity plus delivery/discount | Y | Y | fbp | - |
| 202605031517085 | 2026050328355140 | 3 | c311f9a9-d4ec-4840-af73-89a825ac9326 | 2026-05-03T12:12:24.806Z | 10.7 | 20 | time:20, product:0, amount:0 | 317 | N/A | none | 59800 | 158400 | 3000 | 42600 | -17200 | none | amount_not_reconciled | Y | Y | gclid, fbp | googleads_shopping_supplements_dangdang |
| 202605031517085 | 2026050328355140 | 4 | 256098b1-6c7e-45fb-a8d5-a48b79fb20ed | 2026-05-03T12:12:20.130Z | 10.8 | 20 | time:20, product:0, amount:0 | 317 | N/A | none | - | 158400 | 3000 | 42600 | - | unknown | intent_product_price_or_order_payment_amount_missing | Y | Y | gclid, fbp | googleads_shopping_supplements_dangdang |
| 202605031517085 | 2026050328355140 | 5 | 1c02387c-d3cd-46e0-93d5-abedb7c47b5a | 2026-05-03T12:12:05.353Z | 11 | 20 | time:20, product:0, amount:0 | 317 | N/A | none | 59800 | 158400 | 3000 | 42600 | -17200 | none | amount_not_reconciled | Y | Y | gclid, fbp | googleads_shopping_supplements_dangdang |
| 202605031873910 | 2026050331688110 | 1 | a1943060-9bda-481a-85c4-a8499205c2ec | 2026-05-03T14:33:19.851Z | 0.2 | 80 | time:30, product:30, amount:20 | 328 | N/A | exact | 496000 | 496000 | 0 | 496000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | fbp | - |
| 202605031873910 | 2026050331688110 | 2 | d956dda2-4474-44cf-a12c-7a043a973177 | 2026-05-03T08:20:54.541Z | 372.6 | 52 | time:2, product:30, amount:20 | 328 | N/A | exact | 496000 | 496000 | 0 | 496000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | fbc, fbp | - |
| 202605031873910 | 2026050331688110 | 3 | cd5f6d8b-c76c-4bc8-a2d4-84c997d2dfd2 | 2026-05-03T04:49:53.938Z | 583.6 | 52 | time:2, product:30, amount:20 | 328 | N/A | exact | 496000 | 496000 | 0 | 496000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | fbp | - |
| 202605031873910 | 2026050331688110 | 4 | 2b6c913b-f803-4d4e-b0da-cdd9fd084d5b | 2026-05-03T04:35:38.891Z | 597.9 | 52 | time:2, product:30, amount:20 | 328 | N/A | exact | 496000 | 496000 | 0 | 496000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | fbp | - |
| 202605031873910 | 2026050331688110 | 5 | 7ad05898-6fda-4563-a2ff-2d7b088e875c | 2026-05-03T04:05:37.850Z | 627.9 | 52 | time:2, product:30, amount:20 | 328 | N/A | exact | 496000 | 496000 | 0 | 496000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | fbp | - |
| 202605047544570 | 2026050432504950 | 1 | 0cb9e172-aac5-4535-9eb7-2f133722bbc9 | 2026-05-03T15:14:20.423Z | 0.2 | 80 | time:30, product:30, amount:20 | 198 | N/A | exact | 35000 | 35000 | 0 | 35000 | 0 | final_exact | intent_product_price == order_payment_amount | N | N | fbclid | meta_master_slow |
| 202605047544570 | 2026050432504950 | 2 | cc1e3e87-475e-4ca0-abae-b7893e828df8 | 2026-05-03T15:14:21.994Z | 0.2 | 80 | time:30, product:30, amount:20 | 198 | N/A | exact | 35000 | 35000 | 0 | 35000 | 0 | final_exact | intent_product_price == order_payment_amount | N | Y | fbclid | meta_master_slow |
| 202605047544570 | 2026050432504950 | 3 | d655dd66-2a63-4ec0-9db0-3b2c264c0489 | 2026-05-03T14:55:36.084Z | 19 | 60 | time:10, product:30, amount:20 | 198 | N/A | exact | 35000 | 35000 | 0 | 35000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | gclid, fbp | googleads_shopping_supplements_neuromaster |
| 202605047544570 | 2026050432504950 | 4 | d8e1a65f-51b9-4177-b569-aa0094e7278a | 2026-05-03T11:49:52.133Z | 204.7 | 52 | time:2, product:30, amount:20 | 198 | N/A | exact | 35000 | 35000 | 0 | 35000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | gclid, fbp | googleads_shopping_supplements_neuromaster |
| 202605047544570 | 2026050432504950 | 5 | 579c4a36-6797-424e-83c2-cef1f73b806e | 2026-05-03T11:35:27.212Z | 219.1 | 52 | time:2, product:30, amount:20 | 198 | N/A | exact | 35000 | 35000 | 0 | 35000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | gclid, fbp | googleads_shopping_supplements_neuromaster |
| 202605042286528 | 2026050434702070 | 1 | 994ee64f-838c-4b9d-bfa7-0799719751df | 2026-05-03T21:27:03.896Z | 4.4 | 70 | time:20, product:30, amount:20 | 328 | N/A | exact | 496000 | 496000 | 0 | 496000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | fbp | instagram_biocom_inpork_iggacid |
| 202605042286528 | 2026050434702070 | 2 | a1943060-9bda-481a-85c4-a8499205c2ec | 2026-05-03T14:33:19.851Z | 418.1 | 52 | time:2, product:30, amount:20 | 328 | N/A | exact | 496000 | 496000 | 0 | 496000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | fbp | - |
| 202605042286528 | 2026050434702070 | 3 | d956dda2-4474-44cf-a12c-7a043a973177 | 2026-05-03T08:20:54.541Z | 790.5 | 52 | time:2, product:30, amount:20 | 328 | N/A | exact | 496000 | 496000 | 0 | 496000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | fbc, fbp | - |
| 202605042286528 | 2026050434702070 | 4 | cd5f6d8b-c76c-4bc8-a2d4-84c997d2dfd2 | 2026-05-03T04:49:53.938Z | 1001.5 | 52 | time:2, product:30, amount:20 | 328 | N/A | exact | 496000 | 496000 | 0 | 496000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | fbp | - |
| 202605042286528 | 2026050434702070 | 5 | 2b6c913b-f803-4d4e-b0da-cdd9fd084d5b | 2026-05-03T04:35:38.891Z | 1015.8 | 52 | time:2, product:30, amount:20 | 328 | N/A | exact | 496000 | 496000 | 0 | 496000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | fbp | - |
| 202605041662694 | 2026050447240150 | 1 | 12a50a6a-48c7-4ec4-aa42-f723c7398676 | 2026-05-04T05:59:53.227Z | 0.3 | 60 | time:30, product:30, amount:0 | 97 | N/A | exact | 39000 | 117000 | 0 | 117000 | 78000 | none | amount_not_reconciled | Y | Y | fbp | - |
| 202605041662694 | 2026050447240150 | 2 | 93bb5634-dc93-446a-ad77-2012f6a09d82 | 2026-05-04T05:25:07.551Z | 35 | 40 | time:10, product:30, amount:0 | 97 | N/A | exact | 39000 | 117000 | 0 | 117000 | 78000 | none | amount_not_reconciled | Y | Y | gclid, fbp | - |
| 202605041662694 | 2026050447240150 | 3 | 971c9fe7-1b4f-4fdc-82bb-dd3ac5a4953b | 2026-05-04T05:19:52.432Z | 40.3 | 40 | time:10, product:30, amount:0 | 97 | N/A | exact | 39000 | 117000 | 0 | 117000 | 78000 | none | amount_not_reconciled | Y | Y | gclid, fbp | googleads_shopping_supplements_biobalance |
| 202605041662694 | 2026050447240150 | 4 | 2668c5fe-d918-4281-b2d5-575857d17758 | 2026-05-03T12:33:28.400Z | 1046.7 | 32 | time:2, product:30, amount:0 | 97 | N/A | exact | 39000 | 117000 | 0 | 117000 | 78000 | none | amount_not_reconciled | Y | Y | gclid, fbp | googleads_shopping_supplements_biobalance |
| 202605041662694 | 2026050447240150 | 5 | 380f14a0-59d9-4389-b8a1-a88a01e85f37 | 2026-05-03T11:35:33.502Z | 1104.6 | 32 | time:2, product:30, amount:0 | 97 | N/A | exact | 39000 | 117000 | 0 | 117000 | 78000 | none | amount_not_reconciled | Y | Y | gclid, fbp | googleads_shopping_supplements_biobalance |

## Guardrail

- 아직 purchase dispatcher를 열지 않는다.
- 이 리포트는 DB 상태를 바꾸지 않는다.
- 이 리포트는 GA4/Meta/TikTok/Google Ads purchase 전송을 하지 않는다.
- 이 리포트 변경만으로 운영 endpoint를 배포하지 않는다.
- A급 strong만 향후 dispatcher dry-run 후보이며, B급 strong은 첫 dispatcher 후보에서 제외한다.
- already_in_ga4가 present 또는 unknown이면 전송 후보에서 제외한다.
- robust_absent는 order_number와 channel_order_no가 GA4 raw/purchase 전체 robust query에서 모두 조회되지 않은 상태다.
- 테스트/수동 테스트 라벨 주문은 전송 후보에서 제외한다.
