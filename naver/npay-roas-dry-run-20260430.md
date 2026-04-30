# NPay ROAS Dry-run Report

Generated at: 2026-04-30T08:52:30.170Z
Window: 2026-04-27T09:10:00.000Z ~ 2026-04-30T08:48:00.000Z

## Summary

| metric | value |
| --- | --- |
| live_intent_count | 296 |
| confirmed_npay_order_count | 11 |
| strong_match | 8 |
| strong_match_a | 6 |
| strong_match_b | 2 |
| ambiguous | 3 |
| purchase_without_intent | 0 |
| dispatcher_dry_run_candidate | 0 |
| already_in_ga4_blocked | 0 |
| test_order_blocked | 1 |
| manual_order_count | 0 |
| shipping_reconciled_count | 1 |
| shipping_reconciled_not_grade_a_count | 0 |
| clicked_purchased_candidate | 8 |
| clicked_no_purchase | 208 |
| intent_pending | 80 |

## Order Decisions

| order_number | order_label | paid_at | amount | product | status | strong_grade | candidate_count | best_score | second_score | score_gap | time_gap_min | product_name_match | intent_product_price | order_item_total | delivery_price | order_payment_amount | amount_delta | amount_match | amount_reconcile_reason | ga_session_id | ad_key | already_in_ga4 | dispatcher_candidate | dispatcher_block_reason | ambiguous_reason | send_allowed |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 202604275329932 | production_order | 2026-04-27T13:52:16.000Z | 117000 | 뉴로마스터 60정 (1개월분) | ambiguous | - | 15 | 60 | 50 | 10 | 0.2 | exact | 35000 | 117000 | 0 | 117000 | 82000 | none | amount_not_reconciled | Y | Y | unknown | N | ambiguous, not_a_grade_strong, already_in_ga4_unknown | multiple_intents_same_product, same_product_multiple_clicks, no_member_key, low_score_gap | N |
| 202604289063428 | production_order | 2026-04-27T19:24:52.000Z | 496000 | 종합 대사기능&음식물 과민증 검사 Set | ambiguous | - | 25 | 80 | 70 | 10 | 0.3 | exact | 496000 | 496000 | 0 | 496000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | unknown | N | ambiguous, not_a_grade_strong, already_in_ga4_unknown | multiple_intents_same_product, same_product_multiple_clicks, no_member_key, low_score_gap | N |
| 202604280487104 | production_order | 2026-04-27T21:13:24.000Z | 35000 | 뉴로마스터 60정 (1개월분) | strong_match | A | 25 | 80 | 52 | 28 | 0.3 | exact | 35000 | 35000 | 0 | 35000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | unknown | N | already_in_ga4_unknown | - | N |
| 202604285552452 | production_order | 2026-04-27T23:27:09.000Z | 496000 | 종합 대사기능&음식물 과민증 검사 Set | strong_match | A | 25 | 70 | 52 | 18 | 1.4 | exact | 496000 | 496000 | 0 | 496000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | unknown | N | already_in_ga4_unknown | - | N |
| 202604283756893 | production_order | 2026-04-28T04:03:41.000Z | 975000 | 종합 대사기능&음식물 과민증 검사 Set | strong_match | B | 25 | 50 | 32 | 18 | 7.5 | exact | 496000 | 975000 | 0 | 975000 | 479000 | none | amount_not_reconciled | Y | Y | unknown | N | not_a_grade_strong, already_in_ga4_unknown | - | N |
| 202604295198830 | production_order | 2026-04-29T05:22:18.000Z | 496000 | 종합 대사기능&음식물 과민증 검사 Set | ambiguous | - | 25 | 80 | 70 | 10 | 0.6 | exact | 496000 | 496000 | 0 | 496000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | unknown | N | ambiguous, not_a_grade_strong, already_in_ga4_unknown | multiple_intents_same_product, same_product_multiple_clicks, no_member_key, low_score_gap | N |
| 202604303307399 | production_order | 2026-04-30T00:19:10.000Z | 496000 | 종합 대사기능&음식물 과민증 검사 Set | strong_match | A | 25 | 70 | 52 | 18 | 1.3 | exact | 496000 | 496000 | 0 | 496000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | unknown | N | already_in_ga4_unknown | - | N |
| 202604309992065 | production_order | 2026-04-30T03:41:30.000Z | 35000 | 뉴로마스터 60정 (1개월분) | strong_match | A | 25 | 80 | 52 | 28 | 0.7 | exact | 35000 | 35000 | 0 | 35000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | unknown | N | already_in_ga4_unknown | - | N |
| 202604303298608 | production_order | 2026-04-30T05:47:54.000Z | 148200 | 다빈치랩 메가프로바이오틱 ND50 (MEGA PROBIOTIC ND50) 30일분 | strong_match | B | 25 | 60 | 20 | 40 | 0.7 | exact | 54900 | 148200 | 0 | 148200 | 93300 | none | amount_not_reconciled | Y | Y | unknown | N | not_a_grade_strong, already_in_ga4_unknown | - | N |
| 202604302383065 | production_order | 2026-04-30T05:50:59.000Z | 35000 | 뉴로마스터 60정 (1개월분) | strong_match | A | 25 | 80 | 52 | 28 | 0.7 | exact | 35000 | 35000 | 0 | 35000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | unknown | N | already_in_ga4_unknown | - | N |
| 202604309594732 | test_npay_manual_20260430 | 2026-04-30T07:01:14.000Z | 11900 | 팀키토 슬로우 에이징 도시락 7종 골라담기 | strong_match | A | 25 | 80 | 20 | 60 | 0.8 | exact | 8900 | 8900 | 3000 | 11900 | 3000 | shipping_reconciled | item_exact=true; shipping_reconciled=true; order_payment_amount == order_item_total + delivery_price | Y | Y | absent | N | manual_test_order | - | N |

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

| order_number | rank | intent_id | captured_at | time_gap_min | score | score_components | product_idx | order_product_idx | product_name_match | intent_product_price | order_item_total | delivery_price | order_payment_amount | amount_delta | amount_match | amount_reconcile_reason | client_id | ga_session_id | ad_keys | utm |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 202604275329932 | 1 | 5c1fe505-6130-482d-b33c-45535823b5f4 | 2026-04-27T13:52:04.342Z | 0.2 | 60 | time:30, product:30, amount:0 | 198 | N/A | exact | 35000 | 117000 | 0 | 117000 | 82000 | none | amount_not_reconciled | Y | Y | fbp | - |
| 202604275329932 | 2 | 1c08431f-dd1f-496b-afe3-2c516556eb60 | 2026-04-27T13:48:56.588Z | 3.3 | 50 | time:20, product:30, amount:0 | 198 | N/A | exact | 35000 | 117000 | 0 | 117000 | 82000 | none | amount_not_reconciled | Y | Y | fbp | - |
| 202604275329932 | 3 | 1ecb6bfc-f264-40c4-b4c8-4879b5af43e7 | 2026-04-27T13:28:51.109Z | 23.4 | 40 | time:10, product:30, amount:0 | 198 | N/A | exact | 35000 | 117000 | 0 | 117000 | 82000 | none | amount_not_reconciled | Y | Y | gclid, fbp | googleads_shopping_supplements_neuromaster |
| 202604275329932 | 4 | 4daca36b-984f-46db-bc7e-0791c704a40e | 2026-04-27T10:50:57.681Z | 181.3 | 32 | time:2, product:30, amount:0 | 198 | N/A | exact | 35000 | 117000 | 0 | 117000 | 82000 | none | amount_not_reconciled | Y | Y | gclid, fbp | googleads_shopping_supplements_neuromaster |
| 202604275329932 | 5 | 468e84ea-12c4-4698-9fcf-1f6a20d5cd2c | 2026-04-27T09:52:17.944Z | 240 | 16 | time:2, product:14, amount:0 | 97 | N/A | token_overlap | 39000 | 117000 | 0 | 117000 | 78000 | none | amount_not_reconciled | Y | Y | gclid, fbp | googleads_shopping_supplements_biobalance |
| 202604289063428 | 1 | 5a4c859f-3771-4b87-8ba2-13cb58ac5820 | 2026-04-27T19:24:32.704Z | 0.3 | 80 | time:30, product:30, amount:20 | 328 | N/A | exact | 496000 | 496000 | 0 | 496000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | fbp | - |
| 202604289063428 | 2 | 3ff4066f-d896-4375-99d8-d253568d1e77 | 2026-04-27T19:23:02.051Z | 1.8 | 70 | time:20, product:30, amount:20 | 328 | N/A | exact | 496000 | 496000 | 0 | 496000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | fbp | - |
| 202604289063428 | 3 | 1c3c4428-6fcb-41a3-9652-958958507629 | 2026-04-27T19:22:11.826Z | 2.7 | 70 | time:20, product:30, amount:20 | 328 | N/A | exact | 496000 | 496000 | 0 | 496000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | fbp | - |
| 202604289063428 | 4 | 5375d801-8257-4777-9820-f19a6f318129 | 2026-04-27T14:05:26.346Z | 319.4 | 52 | time:2, product:30, amount:20 | 328 | N/A | exact | 496000 | 496000 | 0 | 496000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | fbp | tiktok_biocom_yeonddle_iggacidset |
| 202604289063428 | 5 | 4dc09cb3-2137-4dfb-ac3d-9d68d90d4014 | 2026-04-27T18:57:02.097Z | 27.8 | 10 | time:10, product:0, amount:0 | 171 | N/A | none | 35000 | 496000 | 0 | 496000 | 461000 | none | amount_not_reconciled | Y | Y | gclid, fbp | googleads_shopping_supplements_poongsung |
| 202604280487104 | 1 | 84060938-5e29-46d5-894f-105fac1b6d62 | 2026-04-27T21:13:08.637Z | 0.3 | 80 | time:30, product:30, amount:20 | 198 | N/A | exact | 35000 | 35000 | 0 | 35000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | fbclid, fbc, fbp | meta_master_slow |
| 202604280487104 | 2 | 353f6ed8-87d0-43b0-8252-e89e5cf6e911 | 2026-04-27T16:01:27.086Z | 311.9 | 52 | time:2, product:30, amount:20 | 198 | N/A | exact | 35000 | 35000 | 0 | 35000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | gclid, fbp | googleads_shopping_supplements_neuromaster |
| 202604280487104 | 3 | 6d4f4176-dba8-4d05-89a8-068996425473 | 2026-04-27T14:00:53.496Z | 432.5 | 52 | time:2, product:30, amount:20 | 198 | N/A | exact | 35000 | 35000 | 0 | 35000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | fbclid, fbc, fbp | meta_biocom_nurostory_nuro |
| 202604280487104 | 4 | 5c1fe505-6130-482d-b33c-45535823b5f4 | 2026-04-27T13:52:04.342Z | 441.3 | 52 | time:2, product:30, amount:20 | 198 | N/A | exact | 35000 | 35000 | 0 | 35000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | fbp | - |
| 202604280487104 | 5 | 1c08431f-dd1f-496b-afe3-2c516556eb60 | 2026-04-27T13:48:56.588Z | 444.5 | 52 | time:2, product:30, amount:20 | 198 | N/A | exact | 35000 | 35000 | 0 | 35000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | fbp | - |
| 202604285552452 | 1 | 6ed1547f-3846-4da3-ad91-c6d00c42509e | 2026-04-27T23:25:43.319Z | 1.4 | 70 | time:20, product:30, amount:20 | 328 | N/A | exact | 496000 | 496000 | 0 | 496000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | fbp | - |
| 202604285552452 | 2 | c7c76207-e033-4e1c-bf5e-6faa70856042 | 2026-04-27T21:46:38.778Z | 100.5 | 52 | time:2, product:30, amount:20 | 328 | N/A | exact | 496000 | 496000 | 0 | 496000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | fbclid, fbc, fbp | meta_biocom_iggacidset_2026 |
| 202604285552452 | 3 | 0fa5bf2e-7052-4c55-9c4b-8d3ca3d915e0 | 2026-04-27T21:42:51.847Z | 104.3 | 52 | time:2, product:30, amount:20 | 328 | N/A | exact | 496000 | 496000 | 0 | 496000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | fbclid, fbc, fbp | meta_biocom_iggacidset_2026 |
| 202604285552452 | 4 | a328a16a-0ea7-4a11-ae43-84db6bc8683a | 2026-04-27T19:51:42.777Z | 215.4 | 52 | time:2, product:30, amount:20 | 328 | N/A | exact | 496000 | 496000 | 0 | 496000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | fbp | tiktok_biocom_yeonddle_iggacidset |
| 202604285552452 | 5 | 5a4c859f-3771-4b87-8ba2-13cb58ac5820 | 2026-04-27T19:24:32.704Z | 242.6 | 52 | time:2, product:30, amount:20 | 328 | N/A | exact | 496000 | 496000 | 0 | 496000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | fbp | - |
| 202604283756893 | 1 | c42232c8-de9e-43ee-8c18-4105aa28aeeb | 2026-04-28T03:56:11.928Z | 7.5 | 50 | time:20, product:30, amount:0 | 328 | N/A | exact | 496000 | 975000 | 0 | 975000 | 479000 | none | amount_not_reconciled | Y | Y | fbp | - |
| 202604283756893 | 2 | ecd86337-49df-47d2-ad50-1ad82d1545d4 | 2026-04-28T01:50:13.674Z | 133.5 | 32 | time:2, product:30, amount:0 | 328 | N/A | exact | 496000 | 975000 | 0 | 975000 | 479000 | none | amount_not_reconciled | Y | Y | fbp | tiktok_biocom_yeonddle_iggacidset |
| 202604283756893 | 3 | 0b3861e7-c097-482f-8fd1-91df9027ac0e | 2026-04-28T00:46:58.620Z | 196.7 | 32 | time:2, product:30, amount:0 | 328 | N/A | exact | 496000 | 975000 | 0 | 975000 | 479000 | none | amount_not_reconciled | Y | Y | fbp | - |
| 202604283756893 | 4 | 7528192f-f3f7-4d84-a94d-feb2b0c3c6ea | 2026-04-28T00:40:48.317Z | 202.9 | 32 | time:2, product:30, amount:0 | 328 | N/A | exact | 496000 | 975000 | 0 | 975000 | 479000 | none | amount_not_reconciled | Y | Y | fbp | - |
| 202604283756893 | 5 | 6ed1547f-3846-4da3-ad91-c6d00c42509e | 2026-04-27T23:25:43.319Z | 278 | 32 | time:2, product:30, amount:0 | 328 | N/A | exact | 496000 | 975000 | 0 | 975000 | 479000 | none | amount_not_reconciled | Y | Y | fbp | - |
| 202604295198830 | 1 | 4479b9b8-1827-4dff-a998-70613562bd22 | 2026-04-29T05:21:40.523Z | 0.6 | 80 | time:30, product:30, amount:20 | 328 | N/A | exact | 496000 | 496000 | 0 | 496000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | fbp | - |
| 202604295198830 | 2 | 79f68911-afcf-4547-94ad-542dcfe58b09 | 2026-04-29T05:10:50.194Z | 11.5 | 70 | time:20, product:30, amount:20 | 328 | N/A | exact | 496000 | 496000 | 0 | 496000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | fbp | - |
| 202604295198830 | 3 | 0e9da78a-a28a-43e8-800c-2d7bd600a653 | 2026-04-29T03:09:21.426Z | 132.9 | 52 | time:2, product:30, amount:20 | 328 | N/A | exact | 496000 | 496000 | 0 | 496000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | fbp | - |
| 202604295198830 | 4 | c7c7fb4b-9f52-43c1-b38e-45b5a5666f98 | 2026-04-29T01:04:54.331Z | 257.4 | 52 | time:2, product:30, amount:20 | 328 | N/A | exact | 496000 | 496000 | 0 | 496000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | fbc, fbp | - |
| 202604295198830 | 5 | b9c46566-4641-42ee-8e3c-6284cf4ac8fc | 2026-04-28T16:49:08.997Z | 753.2 | 52 | time:2, product:30, amount:20 | 328 | N/A | exact | 496000 | 496000 | 0 | 496000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | fbclid, fbc, fbp | meta_biocom_yeonddle_iggacid |
| 202604303307399 | 1 | b0234ffc-fede-48f5-a313-87480a4884e2 | 2026-04-30T00:17:52.600Z | 1.3 | 70 | time:20, product:30, amount:20 | 328 | N/A | exact | 496000 | 496000 | 0 | 496000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | fbclid, fbc, fbp | meta_biocom_yeonddle_iggacid |
| 202604303307399 | 2 | 8dee5512-665b-4e77-a7cf-9ec53a228943 | 2026-04-29T15:00:34.191Z | 558.6 | 52 | time:2, product:30, amount:20 | 328 | N/A | exact | 496000 | 496000 | 0 | 496000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | fbc, fbp | - |
| 202604303307399 | 3 | 4479b9b8-1827-4dff-a998-70613562bd22 | 2026-04-29T05:21:40.523Z | 1137.5 | 52 | time:2, product:30, amount:20 | 328 | N/A | exact | 496000 | 496000 | 0 | 496000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | fbp | - |
| 202604303307399 | 4 | 79f68911-afcf-4547-94ad-542dcfe58b09 | 2026-04-29T05:10:50.194Z | 1148.3 | 52 | time:2, product:30, amount:20 | 328 | N/A | exact | 496000 | 496000 | 0 | 496000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | fbp | - |
| 202604303307399 | 5 | 0e9da78a-a28a-43e8-800c-2d7bd600a653 | 2026-04-29T03:09:21.426Z | 1269.8 | 52 | time:2, product:30, amount:20 | 328 | N/A | exact | 496000 | 496000 | 0 | 496000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | fbp | - |
| 202604309992065 | 1 | aa6cb8b7-4e55-4731-8fe2-c65dc269e6cc | 2026-04-30T03:40:48.421Z | 0.7 | 80 | time:30, product:30, amount:20 | 198 | N/A | exact | 35000 | 35000 | 0 | 35000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | fbp | - |
| 202604309992065 | 2 | 5c599fef-62cf-42bd-b9be-236ba03fd9cf | 2026-04-30T00:47:30.567Z | 174 | 52 | time:2, product:30, amount:20 | 198 | N/A | exact | 35000 | 35000 | 0 | 35000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | gclid, fbp | googleads_shopping_supplements_neuromaster |
| 202604309992065 | 3 | f58c932e-a9ba-4897-b0de-9230ba2b8230 | 2026-04-29T19:49:19.743Z | 472.2 | 52 | time:2, product:30, amount:20 | 198 | N/A | exact | 35000 | 35000 | 0 | 35000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | gclid, fbp | googleads_shopping_supplements_neuromaster |
| 202604309992065 | 4 | 44144dad-adaa-4632-9cf3-61d4c4e2708b | 2026-04-29T17:58:23.172Z | 583.1 | 52 | time:2, product:30, amount:20 | 198 | N/A | exact | 35000 | 35000 | 0 | 35000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | gclid, fbp | googleads_shopping_supplements_neuromaster |
| 202604309992065 | 5 | 79ca7e58-75c0-452e-adad-08587565bdc2 | 2026-04-29T16:55:36.104Z | 645.9 | 52 | time:2, product:30, amount:20 | 198 | N/A | exact | 35000 | 35000 | 0 | 35000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | gclid, fbp | googleads_shopping_supplements_neuromaster |
| 202604303298608 | 1 | 9eb98bc2-d36d-4c1d-88d9-e2f28d4046c9 | 2026-04-30T05:47:12.244Z | 0.7 | 60 | time:30, product:30, amount:0 | 21 | N/A | exact | 54900 | 148200 | 0 | 148200 | 93300 | none | amount_not_reconciled | Y | Y | fbp | - |
| 202604303298608 | 2 | dc2f55d1-6585-4edb-83f0-aea053e99de2 | 2026-04-30T05:35:59.113Z | 11.9 | 20 | time:20, product:0, amount:0 | 317 | N/A | none | 59800 | 148200 | 0 | 148200 | 88400 | none | amount_not_reconciled | Y | Y | gclid, fbp | - |
| 202604303298608 | 3 | 49bbb43e-f37f-4573-aec0-9a97c351dffc | 2026-04-30T04:58:44.458Z | 49.2 | 10 | time:10, product:0, amount:0 | 300 | N/A | none | 36000 | 148200 | 0 | 148200 | 112200 | none | amount_not_reconciled | Y | Y | gclid, fbp | googleads_shopping_supplements_youngdays |
| 202604303298608 | 4 | f5b1e5c8-bfde-40f4-bdca-b78211e84184 | 2026-04-30T04:53:44.121Z | 54.2 | 10 | time:10, product:0, amount:0 | 97 | N/A | none | 39000 | 148200 | 0 | 148200 | 109200 | none | amount_not_reconciled | Y | Y | gclid, fbp | googleads_shopping_supplements_biobalance |
| 202604303298608 | 5 | 0b21fced-30b6-4c6c-a59d-6bac4dbb8174 | 2026-04-30T04:53:00.075Z | 54.9 | 10 | time:10, product:0, amount:0 | 386 | N/A | none | 36900 | 148200 | 0 | 148200 | 111300 | none | amount_not_reconciled | Y | Y | gclid, fbp | googleads_shopping_supplements_metadream |
| 202604302383065 | 1 | 34356f9b-33ee-4a5e-88f6-44e52d808ad0 | 2026-04-30T05:50:17.113Z | 0.7 | 80 | time:30, product:30, amount:20 | 198 | N/A | exact | 35000 | 35000 | 0 | 35000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | fbclid, fbc, fbp | meta_master_slow |
| 202604302383065 | 2 | aa6cb8b7-4e55-4731-8fe2-c65dc269e6cc | 2026-04-30T03:40:48.421Z | 130.2 | 52 | time:2, product:30, amount:20 | 198 | N/A | exact | 35000 | 35000 | 0 | 35000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | fbp | - |
| 202604302383065 | 3 | 5c599fef-62cf-42bd-b9be-236ba03fd9cf | 2026-04-30T00:47:30.567Z | 303.5 | 52 | time:2, product:30, amount:20 | 198 | N/A | exact | 35000 | 35000 | 0 | 35000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | gclid, fbp | googleads_shopping_supplements_neuromaster |
| 202604302383065 | 4 | f58c932e-a9ba-4897-b0de-9230ba2b8230 | 2026-04-29T19:49:19.743Z | 601.7 | 52 | time:2, product:30, amount:20 | 198 | N/A | exact | 35000 | 35000 | 0 | 35000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | gclid, fbp | googleads_shopping_supplements_neuromaster |
| 202604302383065 | 5 | 44144dad-adaa-4632-9cf3-61d4c4e2708b | 2026-04-29T17:58:23.172Z | 712.6 | 52 | time:2, product:30, amount:20 | 198 | N/A | exact | 35000 | 35000 | 0 | 35000 | 0 | final_exact | intent_product_price == order_payment_amount | Y | Y | gclid, fbp | googleads_shopping_supplements_neuromaster |
| 202604309594732 | 1 | 572bdc1a-389b-4128-a389-b9750b063c90 | 2026-04-30T07:00:23.688Z | 0.8 | 80 | time:30, product:30, amount:20 | 424 | N/A | exact | 8900 | 8900 | 3000 | 11900 | 3000 | shipping_reconciled | item_exact=true; shipping_reconciled=true; order_payment_amount == order_item_total + delivery_price | Y | Y | fbp | - |
| 202604309594732 | 2 | 0961cd92-4e68-4dfb-b753-f64448da108b | 2026-04-30T06:52:00.503Z | 9.2 | 20 | time:20, product:0, amount:0 | 317 | N/A | none | 59800 | 8900 | 3000 | 11900 | -47900 | none | amount_not_reconciled | Y | Y | gclid, fbp | - |
| 202604309594732 | 3 | fcf2909d-1114-4fc7-a2ea-ec76c338ae60 | 2026-04-30T06:50:23.338Z | 10.8 | 20 | time:20, product:0, amount:0 | 97 | N/A | none | 39000 | 8900 | 3000 | 11900 | -27100 | none | amount_not_reconciled | Y | Y | gclid, fbp | googleads_shopping_supplements_biobalance |
| 202604309594732 | 4 | 40353a51-5213-46b9-8522-b1e53e53445e | 2026-04-30T06:47:24.973Z | 13.8 | 20 | time:20, product:0, amount:0 | 198 | N/A | none | 35000 | 8900 | 3000 | 11900 | -23100 | none | amount_not_reconciled | Y | Y | gclid, fbp | googleads_shopping_supplements_neuromaster |
| 202604309594732 | 5 | 19687a73-0b03-4a5c-9fd4-df64394aebe8 | 2026-04-30T06:39:01.315Z | 22.2 | 10 | time:10, product:0, amount:0 | 97 | N/A | none | 39000 | 8900 | 3000 | 11900 | -27100 | none | amount_not_reconciled | Y | Y | gclid, fbp | googleads_shopping_supplements_biobalance |

## Guardrail

- 아직 purchase dispatcher를 열지 않는다.
- 이 리포트는 DB 상태를 바꾸지 않는다.
- 이 리포트는 GA4/Meta/TikTok/Google Ads purchase 전송을 하지 않는다.
- A급 strong만 향후 dispatcher dry-run 후보이며, B급 strong은 첫 dispatcher 후보에서 제외한다.
- already_in_ga4가 present 또는 unknown이면 전송 후보에서 제외한다.
- 테스트/수동 테스트 라벨 주문은 전송 후보에서 제외한다.
