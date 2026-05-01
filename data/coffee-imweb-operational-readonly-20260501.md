# 더클린커피 Imweb/GA4 NPay Read-only 리포트

생성 시각: 2026-05-01 14:43:54 KST
site: `thecleancoffee`
window: 2026-04-23 ~ 2026-04-29 KST
mode: `read_only`

## Auditor Verdict

```text
Auditor verdict: PASS_WITH_NOTES
No-send verified: YES
No-write verified: YES
No-deploy verified: YES
New executable send path added: NO
Actual network send observed: NO
```

## Summary

| 항목 | 값 |
| --- | --- |
| Imweb orders | 113 / 4,699,767원 |
| Imweb NPay actual | 60 / 2,462,300원 |
| GA4 purchases | 108 / 4,454,524원 |
| GA4 NPay pattern | 58 / 2,359,300원 |
| NPay delta | 2건 / 103,000원 |
| Exact GA4-Imweb matches | 50 |
| tb_iamweb_users matched orders | 0 |

## NPay Matching

| 분류 | 건수 |
| --- | --- |
| per-order strong | 29 |
| per-order probable | 2 |
| per-order ambiguous | 29 |
| one-to-one assigned | 42 |
| one-to-one unassigned actual | 18 |
| one-to-one unassigned GA4 | 16 |

## One-to-one Grade Summary

| grade | count |
| --- | --- |
| A_strong | 31 |
| probable | 7 |
| B_strong | 4 |

## One-to-one Residual Summary

| 항목 | 값 |
| --- | --- |
| assigned | 42건 / 주문 1,821,000원 / GA4 1,750,400원 / delta 70,600원 |
| unassigned actual | 18건 / 641,300원 |
| unassigned GA4 | 16건 / 608,900원 |
| unassigned net delta | 32,400원 |

## Amount Match Type Summary

| amount_match_type | count |
| --- | --- |
| shipping_reconciled | 29 |
| final_exact | 27 |
| near_exact | 2 |
| none | 2 |

## Ambiguous Reason Summary

| reason | count |
| --- | --- |
| low_score_gap | 29 |
| multiple_ga4_candidates | 29 |
| same_amount_many_orders | 24 |
| weak_time_gap | 20 |
| amount_not_reconciled | 2 |
| no_product_evidence | 2 |
| product_name_variant_or_no_overlap | 2 |

## Unassigned Actual Reason Summary

| reason | count |
| --- | --- |
| best_candidate_score_below_assignment_threshold | 13 |
| best_ga4_candidate_already_assigned_to_stronger_order | 5 |

## Unassigned Actual Time Gap Summary

| time_gap_bucket | count |
| --- | --- |
| within_24h | 12 |
| over_24h | 4 |
| within_10m | 1 |
| within_2m | 1 |

## Unassigned GA4 Reason Summary

| reason | count |
| --- | --- |
| best_actual_candidate_score_below_assignment_threshold | 8 |
| best_actual_order_already_assigned_to_stronger_ga4 | 5 |
| no_actual_candidate_above_threshold | 3 |

## Review Orders Top 20

| order_number | channel_order_no | paid_at | amount | diagnosis | best_score | best_tx | best_gap | amount_type | reasons |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 202604238847032 | 2026042322051380 | 2026-04-23 00:36:20 | 21,300원 | best_ga4_candidate_already_assigned_to_stronger_order | 65 | NPAY - 202603127 - 1777286395026 | over_24h | final_exact | multiple_ga4_candidates,low_score_gap,weak_time_gap,same_amount_many_orders |
| 202604230317351 | 2026042324312140 | 2026-04-23 07:28:15 | 67,000원 | best_ga4_candidate_already_assigned_to_stronger_order | 65 | NPAY - 202603123 - 1776933586465 | within_24h | final_exact | multiple_ga4_candidates,low_score_gap,weak_time_gap,same_amount_many_orders |
| 202604235490820 | 2026042325252020 | 2026-04-23 08:26:00 | 39,500원 | best_candidate_score_below_assignment_threshold | 58 | NPAY - 202603129 - 1777436965329 | over_24h | shipping_reconciled | multiple_ga4_candidates,low_score_gap,weak_time_gap,same_amount_many_orders |
| 202604239700298 | 2026042330145580 | 2026-04-23 11:20:55 | 36,500원 | best_candidate_score_below_assignment_threshold | 61 | NPAY - 202603123 - 1776916716489 | within_24h | final_exact | multiple_ga4_candidates,low_score_gap,weak_time_gap,same_amount_many_orders |
| 202604240876153 | 2026042454763850 | 2026-04-24 09:27:00 | 39,500원 | best_candidate_score_below_assignment_threshold | 58 | NPAY - 202603123 - 1776948650451 | within_24h | shipping_reconciled | multiple_ga4_candidates,low_score_gap,weak_time_gap,same_amount_many_orders |
| 202604251942923 | 2026042593855480 | 2026-04-25 22:03:50 | 31,500원 | best_candidate_score_below_assignment_threshold | 41 | NPAY - 202603125 - 1777122508913 | within_10m | none | multiple_ga4_candidates,low_score_gap,amount_not_reconciled |
| 202604268287926 | 2026042699576540 | 2026-04-26 09:23:45 | 39,500원 | best_ga4_candidate_already_assigned_to_stronger_order | 73 | NPAY - 202603126 - 1777163000478 | within_2m | shipping_reconciled | best_ga4_candidate_already_assigned_to_stronger_order |
| 202604263784181 | 2026042624630970 | 2026-04-26 20:40:05 | 21,300원 | best_ga4_candidate_already_assigned_to_stronger_order | 65 | NPAY - 202603127 - 1777286395026 | within_24h | final_exact | multiple_ga4_candidates,low_score_gap,weak_time_gap,same_amount_many_orders |
| 202604278529848 | 2026042732746230 | 2026-04-27 06:26:20 | 36,500원 | best_candidate_score_below_assignment_threshold | 61 | NPAY - 202603127 - 1777265008070 | within_24h | final_exact | multiple_ga4_candidates,low_score_gap,weak_time_gap,same_amount_many_orders |
| 202604279056292 | 2026042732843650 | 2026-04-27 06:38:50 | 44,400원 | best_candidate_score_below_assignment_threshold | 50 | NPAY - 202603128 - 1777346115402 | over_24h | near_exact | multiple_ga4_candidates,low_score_gap,weak_time_gap |
| 202604271236090 | 2026042733291400 | 2026-04-27 07:21:00 | 36,500원 | best_candidate_score_below_assignment_threshold | 61 | NPAY - 202603127 - 1777265008070 | within_24h | final_exact | multiple_ga4_candidates,low_score_gap,weak_time_gap,same_amount_many_orders |
| 202604272281898 | 2026042750751350 | 2026-04-27 16:30:30 | 36,500원 | best_candidate_score_below_assignment_threshold | 61 | NPAY - 202603127 - 1777265008070 | within_24h | final_exact | multiple_ga4_candidates,low_score_gap,weak_time_gap,same_amount_many_orders |
| 202604273604765 | 2026042753475420 | 2026-04-27 18:07:25 | 21,300원 | best_ga4_candidate_already_assigned_to_stronger_order | 65 | NPAY - 202603127 - 1777286395026 | within_24h | final_exact | multiple_ga4_candidates,low_score_gap,weak_time_gap,same_amount_many_orders |
| 202604274520883 | 2026042754292460 | 2026-04-27 18:40:25 | 43,600원 | best_candidate_score_below_assignment_threshold | 30 | NPAY - 202603128 - 1777346115402 | within_24h | near_exact | multiple_ga4_candidates,low_score_gap,weak_time_gap,product_name_variant_or_no_overlap,no_product_evidence,same_amount_many_orders |
| 202604288034126 | 2026042863432580 | 2026-04-28 00:02:05 | 13,900원 | best_candidate_score_below_assignment_threshold | 58 | NPAY - 202603124 - 1777031469775 | over_24h | shipping_reconciled | multiple_ga4_candidates,low_score_gap,weak_time_gap,same_amount_many_orders |
| 202604289612056 | 2026042865939010 | 2026-04-28 07:01:15 | 36,500원 | best_candidate_score_below_assignment_threshold | 61 | NPAY - 202603128 - 1777355688070 | within_24h | final_exact | multiple_ga4_candidates,low_score_gap,weak_time_gap,same_amount_many_orders |
| 202604292165516 | 2026042995980970 | 2026-04-29 07:54:50 | 39,500원 | best_candidate_score_below_assignment_threshold | 58 | NPAY - 202603128 - 1777361477772 | within_24h | shipping_reconciled | multiple_ga4_candidates,low_score_gap,weak_time_gap,same_amount_many_orders |
| 202604297662281 | 2026042926614830 | 2026-04-29 21:04:05 | 36,500원 | best_candidate_score_below_assignment_threshold | 61 | NPAY - 202603129 - 1777468263462 | within_24h | final_exact | multiple_ga4_candidates,low_score_gap,weak_time_gap,same_amount_many_orders |

## Unassigned GA4 Top 20

| ga4_transaction_id | event_time | revenue | diagnosis | best_order | best_score | best_gap | amount_type | item_names |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| NPAY - 202603123 - 1776948650451 | 2026-04-23 21:50:48 | 36,500원 | best_actual_candidate_score_below_assignment_threshold | 202604240876153 | 58 | within_24h | shipping_reconciled | 파푸아뉴기니 유기농 디카페인 스위스 워터 원두 SHB 200g / 500g |
| NPAY - 202603124 - 1776988757304 | 2026-04-24 08:59:16 | 48,500원 | best_actual_candidate_score_below_assignment_threshold | 202604256430237 | 61 | over_24h | final_exact | 파푸아뉴기니 유기농 디카페인 스위스 워터 원두 SHB 200g / 500g + 콜롬비아 스페셜티 200g / 500g + 더클린커피 초신선 드립백 커피 |
| NPAY - 202603124 - 1776992774617 | 2026-04-24 10:06:15 | 18,300원 | best_actual_candidate_score_below_assignment_threshold | 202604238847032 | 58 | over_24h | shipping_reconciled | 콜롬비아 스페셜티 200g / 500g |
| NPAY - 202603124 - 1777031469775 | 2026-04-24 20:51:10 | 10,900원 | best_actual_candidate_score_below_assignment_threshold | 202604238969232 | 58 | over_24h | shipping_reconciled | 더클린커피 초신선 드립백 커피 |
| NPAY - 202603125 - 1777122508913 | 2026-04-25 22:08:28 | 48,500원 | best_actual_order_already_assigned_to_stronger_ga4 | 202604256430237 | 86 | within_10m | final_exact | 과테말라 SHB 스페셜티 200g / 500g + 콜롬비아 스페셜티 200g / 500g + 더클린커피 초신선 드립백 커피 |
| NPAY - 202603126 - 1777168176914 | 2026-04-26 10:49:37 | 106,500원 | best_actual_candidate_score_below_assignment_threshold | 202604250816227 | 55 | within_24h | final_exact | 파푸아뉴기니 유기농 디카페인 스위스 워터 원두 SHB 200g / 500g + 과테말라 SHB 스페셜티 200g / 500g + 콜롬비아 스페셜티 200g / 500g |
| NPAY - 202603127 - 1777260400447 | 2026-04-27 12:26:40 | 33,500원 | best_actual_order_already_assigned_to_stronger_ga4 | 202604279324111 | 68 | within_60m | shipping_reconciled | 콜롬비아 스페셜티 200g / 500g |
| NPAY - 202603127 - 1777269448944 | 2026-04-27 14:57:29 | 33,500원 | no_actual_candidate_above_threshold |  | 0 | no_candidate | no_candidate | 콜롬비아 스페셜티 200g / 500g |
| NPAY - 202603127 - 1777271145450 | 2026-04-27 15:25:45 | 29,100원 | no_actual_candidate_above_threshold |  | 0 | no_candidate | no_candidate | 과테말라 SHB 스페셜티 200g / 500g + 과테말라 SHB 스페셜티 200g / 500g |
| NPAY - 202603127 - 1777286315864 | 2026-04-27 19:38:35 | 18,300원 | best_actual_order_already_assigned_to_stronger_ga4 | 202604279308580 | 83 | within_10m | shipping_reconciled | 콜롬비아 스페셜티 200g / 500g |
| NPAY - 202603128 - 1777338581088 | 2026-04-28 10:09:41 | 19,300원 | best_actual_candidate_score_below_assignment_threshold | 202604266778351 | 58 | over_24h | shipping_reconciled | 과테말라 SHB 스페셜티 200g / 500g |
| NPAY - 202603128 - 1777346115402 | 2026-04-28 12:15:14 | 43,700원 | best_actual_order_already_assigned_to_stronger_ga4 | 202604282968746 | 90 | within_10m | final_exact | 콜롬비아 스페셜티 200g / 500g |
| NPAY - 202603129 - 1777417306636 | 2026-04-29 08:01:46 | 73,000원 | best_actual_order_already_assigned_to_stronger_ga4 | 202604274554581 | 65 | over_24h | final_exact | 파푸아뉴기니 유기농 디카페인 스위스 워터 원두 SHB 200g / 500g |
| NPAY - 202603129 - 1777418768914 | 2026-04-29 08:26:08 | 33,500원 | no_actual_candidate_above_threshold |  | 0 | no_candidate | no_candidate | 콜롬비아 스페셜티 200g / 500g |
| NPAY - 202603129 - 1777432701085 | 2026-04-29 12:18:21 | 19,300원 | best_actual_candidate_score_below_assignment_threshold | 202604266778351 | 58 | over_24h | shipping_reconciled | 과테말라 SHB 스페셜티 200g / 500g |
| NPAY - 202603129 - 1777468263462 | 2026-04-29 22:11:03 | 36,500원 | best_actual_candidate_score_below_assignment_threshold | 202604297662281 | 61 | within_24h | final_exact | 에티오피아 구지 사키소 스페셜티 G1등급 200g / 500g |

## Dry-run Schema

`send_candidate` is fixed to `N` in this phase.

| field | meaning |
| --- | --- |
| site | thecleancoffee |
| order_number | Imweb order_no |
| channel_order_no | NPay external order number from Imweb |
| ga4_transaction_id | GA4 NPay synthetic transaction id candidate |
| amount_match_type | final_exact/shipping_reconciled/discount_reconciled/item_exact/near_exact/none |
| match_grade | A_strong/B_strong/probable/ambiguous/purchase_without_ga4 |
| already_in_ga4 | present_npay_pattern_candidate/unknown |
| send_candidate | always N in read-only phase |
| block_reason | read_only_phase plus guard reasons |
