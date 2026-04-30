# NPay ROAS Dry-run Report

Generated at: 2026-04-30T07:06:49.152Z
Window: 2026-04-27T09:10:00.000Z ~ 2026-04-30T05:56:56.299Z

## Summary

| metric | value |
| --- | --- |
| live_intent_count | 264 |
| confirmed_npay_order_count | 7 |
| strong_match | 4 |
| strong_match_a | 3 |
| strong_match_b | 1 |
| ambiguous | 3 |
| purchase_without_intent | 0 |
| dispatcher_dry_run_candidate | 3 |
| already_in_ga4_blocked | 0 |
| test_order_blocked | 0 |
| clicked_purchased_candidate | 4 |
| clicked_no_purchase | 185 |
| intent_pending | 75 |

## Order Decisions

| order_number | order_label | paid_at | amount | product | status | strong_grade | candidate_count | best_score | second_score | score_gap | time_gap_min | product_name_match | amount_match | ga_session_id | ad_key | already_in_ga4 | dispatcher_candidate | dispatcher_block_reason | ambiguous_reason | send_allowed |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 202604275329932 | production_order | 2026-04-27T13:52:16.000Z | 117000 | 뉴로마스터 60정 (1개월분) | ambiguous | - | 15 | 60 | 50 | 10 | 0.2 | exact | none | Y | Y | absent | N | ambiguous, not_a_grade_strong | multiple_intents_same_product, same_product_multiple_clicks, no_member_key, low_score_gap | N |
| 202604289063428 | production_order | 2026-04-27T19:24:52.000Z | 496000 | 종합 대사기능&음식물 과민증 검사 Set | ambiguous | - | 25 | 80 | 70 | 10 | 0.3 | exact | exact | Y | Y | absent | N | ambiguous, not_a_grade_strong | multiple_intents_same_product, same_product_multiple_clicks, no_member_key, low_score_gap | N |
| 202604280487104 | production_order | 2026-04-27T21:13:24.000Z | 35000 | 뉴로마스터 60정 (1개월분) | strong_match | A | 25 | 80 | 52 | 28 | 0.3 | exact | exact | Y | Y | absent | Y | - | - | N |
| 202604285552452 | production_order | 2026-04-27T23:27:09.000Z | 496000 | 종합 대사기능&음식물 과민증 검사 Set | strong_match | A | 25 | 70 | 52 | 18 | 1.4 | exact | exact | Y | Y | absent | Y | - | - | N |
| 202604283756893 | production_order | 2026-04-28T04:03:41.000Z | 975000 | 종합 대사기능&음식물 과민증 검사 Set | strong_match | B | 25 | 50 | 32 | 18 | 7.5 | exact | none | Y | Y | absent | N | not_a_grade_strong | - | N |
| 202604295198830 | production_order | 2026-04-29T05:22:18.000Z | 496000 | 종합 대사기능&음식물 과민증 검사 Set | ambiguous | - | 25 | 80 | 70 | 10 | 0.6 | exact | exact | Y | Y | absent | N | ambiguous, not_a_grade_strong | multiple_intents_same_product, same_product_multiple_clicks, no_member_key, low_score_gap | N |
| 202604309992065 | production_order | 2026-04-30T03:41:30.000Z | 35000 | 뉴로마스터 60정 (1개월분) | strong_match | A | 25 | 80 | 52 | 28 | 0.7 | exact | exact | Y | Y | absent | Y | - | - | N |

## Top Candidate Intents

| order_number | rank | intent_id | captured_at | time_gap_min | score | score_components | product_idx | order_product_idx | product_name_match | amount_match | client_id | ga_session_id | ad_keys | utm |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 202604275329932 | 1 | 5c1fe505-6130-482d-b33c-45535823b5f4 | 2026-04-27T13:52:04.342Z | 0.2 | 60 | time:30, product:30, amount:0 | 198 | N/A | exact | none | Y | Y | fbp | - |
| 202604275329932 | 2 | 1c08431f-dd1f-496b-afe3-2c516556eb60 | 2026-04-27T13:48:56.588Z | 3.3 | 50 | time:20, product:30, amount:0 | 198 | N/A | exact | none | Y | Y | fbp | - |
| 202604275329932 | 3 | 1ecb6bfc-f264-40c4-b4c8-4879b5af43e7 | 2026-04-27T13:28:51.109Z | 23.4 | 40 | time:10, product:30, amount:0 | 198 | N/A | exact | none | Y | Y | gclid, fbp | googleads_shopping_supplements_neuromaster |
| 202604275329932 | 4 | 4daca36b-984f-46db-bc7e-0791c704a40e | 2026-04-27T10:50:57.681Z | 181.3 | 32 | time:2, product:30, amount:0 | 198 | N/A | exact | none | Y | Y | gclid, fbp | googleads_shopping_supplements_neuromaster |
| 202604275329932 | 5 | 468e84ea-12c4-4698-9fcf-1f6a20d5cd2c | 2026-04-27T09:52:17.944Z | 240 | 28 | time:2, product:14, amount:12 | 97 | N/A | token_overlap | multiple | Y | Y | gclid, fbp | googleads_shopping_supplements_biobalance |
| 202604289063428 | 1 | 5a4c859f-3771-4b87-8ba2-13cb58ac5820 | 2026-04-27T19:24:32.704Z | 0.3 | 80 | time:30, product:30, amount:20 | 328 | N/A | exact | exact | Y | Y | fbp | - |
| 202604289063428 | 2 | 3ff4066f-d896-4375-99d8-d253568d1e77 | 2026-04-27T19:23:02.051Z | 1.8 | 70 | time:20, product:30, amount:20 | 328 | N/A | exact | exact | Y | Y | fbp | - |
| 202604289063428 | 3 | 1c3c4428-6fcb-41a3-9652-958958507629 | 2026-04-27T19:22:11.826Z | 2.7 | 70 | time:20, product:30, amount:20 | 328 | N/A | exact | exact | Y | Y | fbp | - |
| 202604289063428 | 4 | 5375d801-8257-4777-9820-f19a6f318129 | 2026-04-27T14:05:26.346Z | 319.4 | 52 | time:2, product:30, amount:20 | 328 | N/A | exact | exact | Y | Y | fbp | tiktok_biocom_yeonddle_iggacidset |
| 202604289063428 | 5 | 4dc09cb3-2137-4dfb-ac3d-9d68d90d4014 | 2026-04-27T18:57:02.097Z | 27.8 | 10 | time:10, product:0, amount:0 | 171 | N/A | none | none | Y | Y | gclid, fbp | googleads_shopping_supplements_poongsung |
| 202604280487104 | 1 | 84060938-5e29-46d5-894f-105fac1b6d62 | 2026-04-27T21:13:08.637Z | 0.3 | 80 | time:30, product:30, amount:20 | 198 | N/A | exact | exact | Y | Y | fbclid, fbc, fbp | meta_master_slow |
| 202604280487104 | 2 | 353f6ed8-87d0-43b0-8252-e89e5cf6e911 | 2026-04-27T16:01:27.086Z | 311.9 | 52 | time:2, product:30, amount:20 | 198 | N/A | exact | exact | Y | Y | gclid, fbp | googleads_shopping_supplements_neuromaster |
| 202604280487104 | 3 | 6d4f4176-dba8-4d05-89a8-068996425473 | 2026-04-27T14:00:53.496Z | 432.5 | 52 | time:2, product:30, amount:20 | 198 | N/A | exact | exact | Y | Y | fbclid, fbc, fbp | meta_biocom_nurostory_nuro |
| 202604280487104 | 4 | 5c1fe505-6130-482d-b33c-45535823b5f4 | 2026-04-27T13:52:04.342Z | 441.3 | 52 | time:2, product:30, amount:20 | 198 | N/A | exact | exact | Y | Y | fbp | - |
| 202604280487104 | 5 | 1c08431f-dd1f-496b-afe3-2c516556eb60 | 2026-04-27T13:48:56.588Z | 444.5 | 52 | time:2, product:30, amount:20 | 198 | N/A | exact | exact | Y | Y | fbp | - |
| 202604285552452 | 1 | 6ed1547f-3846-4da3-ad91-c6d00c42509e | 2026-04-27T23:25:43.319Z | 1.4 | 70 | time:20, product:30, amount:20 | 328 | N/A | exact | exact | Y | Y | fbp | - |
| 202604285552452 | 2 | c7c76207-e033-4e1c-bf5e-6faa70856042 | 2026-04-27T21:46:38.778Z | 100.5 | 52 | time:2, product:30, amount:20 | 328 | N/A | exact | exact | Y | Y | fbclid, fbc, fbp | meta_biocom_iggacidset_2026 |
| 202604285552452 | 3 | 0fa5bf2e-7052-4c55-9c4b-8d3ca3d915e0 | 2026-04-27T21:42:51.847Z | 104.3 | 52 | time:2, product:30, amount:20 | 328 | N/A | exact | exact | Y | Y | fbclid, fbc, fbp | meta_biocom_iggacidset_2026 |
| 202604285552452 | 4 | a328a16a-0ea7-4a11-ae43-84db6bc8683a | 2026-04-27T19:51:42.777Z | 215.4 | 52 | time:2, product:30, amount:20 | 328 | N/A | exact | exact | Y | Y | fbp | tiktok_biocom_yeonddle_iggacidset |
| 202604285552452 | 5 | 5a4c859f-3771-4b87-8ba2-13cb58ac5820 | 2026-04-27T19:24:32.704Z | 242.6 | 52 | time:2, product:30, amount:20 | 328 | N/A | exact | exact | Y | Y | fbp | - |
| 202604283756893 | 1 | c42232c8-de9e-43ee-8c18-4105aa28aeeb | 2026-04-28T03:56:11.928Z | 7.5 | 50 | time:20, product:30, amount:0 | 328 | N/A | exact | none | Y | Y | fbp | - |
| 202604283756893 | 2 | 929b74db-cef0-4504-a894-bcf0955bf62d | 2026-04-28T03:54:20.332Z | 9.3 | 32 | time:20, product:0, amount:12 | 97 | N/A | none | multiple | Y | Y | gclid, fbp | googleads_shopping_supplements_biobalance |
| 202604283756893 | 3 | dd1fc09e-ee8a-4730-b204-e61913b4890e | 2026-04-28T03:53:49.239Z | 9.9 | 32 | time:20, product:0, amount:12 | 97 | N/A | none | multiple | Y | Y | gclid, fbp | googleads_shopping_supplements_biobalance |
| 202604283756893 | 4 | ecd86337-49df-47d2-ad50-1ad82d1545d4 | 2026-04-28T01:50:13.674Z | 133.5 | 32 | time:2, product:30, amount:0 | 328 | N/A | exact | none | Y | Y | fbp | tiktok_biocom_yeonddle_iggacidset |
| 202604283756893 | 5 | 0b3861e7-c097-482f-8fd1-91df9027ac0e | 2026-04-28T00:46:58.620Z | 196.7 | 32 | time:2, product:30, amount:0 | 328 | N/A | exact | none | Y | Y | fbp | - |
| 202604295198830 | 1 | 4479b9b8-1827-4dff-a998-70613562bd22 | 2026-04-29T05:21:40.523Z | 0.6 | 80 | time:30, product:30, amount:20 | 328 | N/A | exact | exact | Y | Y | fbp | - |
| 202604295198830 | 2 | 79f68911-afcf-4547-94ad-542dcfe58b09 | 2026-04-29T05:10:50.194Z | 11.5 | 70 | time:20, product:30, amount:20 | 328 | N/A | exact | exact | Y | Y | fbp | - |
| 202604295198830 | 3 | 0e9da78a-a28a-43e8-800c-2d7bd600a653 | 2026-04-29T03:09:21.426Z | 132.9 | 52 | time:2, product:30, amount:20 | 328 | N/A | exact | exact | Y | Y | fbp | - |
| 202604295198830 | 4 | c7c7fb4b-9f52-43c1-b38e-45b5a5666f98 | 2026-04-29T01:04:54.331Z | 257.4 | 52 | time:2, product:30, amount:20 | 328 | N/A | exact | exact | Y | Y | fbc, fbp | - |
| 202604295198830 | 5 | b9c46566-4641-42ee-8e3c-6284cf4ac8fc | 2026-04-28T16:49:08.997Z | 753.2 | 52 | time:2, product:30, amount:20 | 328 | N/A | exact | exact | Y | Y | fbclid, fbc, fbp | meta_biocom_yeonddle_iggacid |
| 202604309992065 | 1 | aa6cb8b7-4e55-4731-8fe2-c65dc269e6cc | 2026-04-30T03:40:48.421Z | 0.7 | 80 | time:30, product:30, amount:20 | 198 | N/A | exact | exact | Y | Y | fbp | - |
| 202604309992065 | 2 | 5c599fef-62cf-42bd-b9be-236ba03fd9cf | 2026-04-30T00:47:30.567Z | 174 | 52 | time:2, product:30, amount:20 | 198 | N/A | exact | exact | Y | Y | gclid, fbp | googleads_shopping_supplements_neuromaster |
| 202604309992065 | 3 | f58c932e-a9ba-4897-b0de-9230ba2b8230 | 2026-04-29T19:49:19.743Z | 472.2 | 52 | time:2, product:30, amount:20 | 198 | N/A | exact | exact | Y | Y | gclid, fbp | googleads_shopping_supplements_neuromaster |
| 202604309992065 | 4 | 44144dad-adaa-4632-9cf3-61d4c4e2708b | 2026-04-29T17:58:23.172Z | 583.1 | 52 | time:2, product:30, amount:20 | 198 | N/A | exact | exact | Y | Y | gclid, fbp | googleads_shopping_supplements_neuromaster |
| 202604309992065 | 5 | 79ca7e58-75c0-452e-adad-08587565bdc2 | 2026-04-29T16:55:36.104Z | 645.9 | 52 | time:2, product:30, amount:20 | 198 | N/A | exact | exact | Y | Y | gclid, fbp | googleads_shopping_supplements_neuromaster |

## Guardrail

- 아직 purchase dispatcher를 열지 않는다.
- 이 리포트는 DB 상태를 바꾸지 않는다.
- 이 리포트는 GA4/Meta/TikTok/Google Ads purchase 전송을 하지 않는다.
- A급 strong만 향후 dispatcher dry-run 후보이며, B급 strong은 첫 dispatcher 후보에서 제외한다.
- already_in_ga4가 present 또는 unknown이면 전송 후보에서 제외한다.
- test_order 라벨 주문은 전송 후보에서 제외한다.
