# ConfirmedPurchasePrep 통합 input dry-run (2026-05-10)

## 5줄 요약

1. 운영DB PAYMENT_COMPLETE 기준 confirmed 주문 2152건을 primary source로 통합했다.
2. NPay actual confirmed는 143건 포함했고, complete_time/imweb_status blank는 단독 차단 사유로 쓰지 않았다.
3. Google click id 보유 주문은 31건이라 Google Ads upload 후보는 아직 0건이다.
4. VM Cloud/Path B evidence는 보조 원장으로만 붙였고 send_candidate=false를 강제했다.
5. 다음은 action/campaign별 Google Ads 플랫폼 주장값과 내부 confirmed 매출 gap 분해다.

## Summary

- generated_at_kst: 2026-05-10 17:50:29 KST
- integrated_candidate_count: 2152
- homepage_confirmed_count: 2009
- npay_actual_confirmed_count: 143
- with_google_click_id: 31
- vm_order_evidence_matched_count: 1686
- send_candidate: 0
- actual_send_candidate: 0
- candidates_total: 2152
- candidates_sample: first 50 only. Full rows are reproducible by rerunning the dry-run script.

## Block Reason Counts

- already_in_ga4_unknown: 2152
- approval_required: 2152
- missing_attribution_vm_evidence: 466
- missing_google_click_id: 2121
- npay_actual_confirmed_from_primary_source: 143
- npay_intent_ambiguous: 24
- npay_intent_not_a_grade_strong: 22
- npay_intent_purchase_without_intent: 76
- order_has_return_reason: 11
- read_only_integrated_input: 2152
- read_only_phase: 2152
- send_candidate_forced_false: 2152

## Candidate Sample First 50

| order_number | method | value | VM order | Google click | Path B same order | send | primary reason |
| --- | --- | ---: | --- | --- | --- | --- | --- |
| 202604117818380 | homepage |  | no | no | no | false | already_in_ga4_unknown |
| 202604111244275 | homepage |  | no | no | no | false | already_in_ga4_unknown |
| 202604115118967 | homepage |  | no | no | no | false | already_in_ga4_unknown |
| 202604112055255 | homepage |  | no | no | no | false | already_in_ga4_unknown |
| 202604110781753 | npay |  | no | no | no | false | already_in_ga4_unknown |
| 202604113737797 | npay |  | no | no | no | false | already_in_ga4_unknown |
| 202604111454078 | homepage |  | no | no | no | false | already_in_ga4_unknown |
| 202604111580824 | homepage |  | no | no | no | false | already_in_ga4_unknown |
| 202604115757217 | homepage |  | no | no | no | false | already_in_ga4_unknown |
| 202604112155749 | npay |  | no | no | no | false | already_in_ga4_unknown |
| 202604118562495 | homepage |  | no | no | no | false | already_in_ga4_unknown |
| 202604112700124 | homepage |  | no | no | no | false | already_in_ga4_unknown |
| 202604114508225 | homepage |  | no | no | no | false | already_in_ga4_unknown |
| 202604116344404 | homepage |  | no | no | no | false | already_in_ga4_unknown |
| 202604118425637 | homepage |  | no | no | no | false | already_in_ga4_unknown |
| 202604115699827 | homepage |  | no | no | no | false | already_in_ga4_unknown |
| 202604119605718 | homepage |  | no | no | no | false | already_in_ga4_unknown |
| 202604117757875 | homepage |  | no | no | no | false | already_in_ga4_unknown |
| 202604111349966 | homepage |  | no | no | no | false | already_in_ga4_unknown |
| 202604110809695 | homepage |  | no | no | no | false | already_in_ga4_unknown |
| 202604112557244 | homepage |  | no | no | no | false | already_in_ga4_unknown |
| 202604110801764 | homepage |  | no | no | no | false | already_in_ga4_unknown |
| 202604112883367 | npay |  | no | no | no | false | already_in_ga4_unknown |
| 202604111445985 | homepage |  | no | no | no | false | already_in_ga4_unknown |
| 202604118509662 | homepage |  | no | no | no | false | already_in_ga4_unknown |
| 202604114654534 | homepage |  | no | no | no | false | already_in_ga4_unknown |
| 202604113287925 | homepage |  | no | no | no | false | already_in_ga4_unknown |
| 202604117313877 | homepage |  | no | no | no | false | already_in_ga4_unknown |
| 202604110440436 | homepage |  | no | no | no | false | already_in_ga4_unknown |
| 202604110835144 | homepage |  | no | no | no | false | already_in_ga4_unknown |
| 202604116150716 | homepage |  | no | no | no | false | already_in_ga4_unknown |
| 202604119144238 | homepage |  | no | no | no | false | already_in_ga4_unknown |
| 202604115397118 | homepage |  | no | no | no | false | already_in_ga4_unknown |
| 202604119638594 | homepage |  | no | no | no | false | already_in_ga4_unknown |
| 202604116253633 | homepage |  | no | no | no | false | already_in_ga4_unknown |
| 202604116014857 | homepage |  | no | no | no | false | already_in_ga4_unknown |
| 202604114188881 | homepage |  | no | no | no | false | already_in_ga4_unknown |
| 202604113906855 | npay |  | no | no | no | false | already_in_ga4_unknown |
| 202604110666452 | homepage |  | no | no | no | false | already_in_ga4_unknown |
| 202604119933827 | homepage |  | no | no | no | false | already_in_ga4_unknown |
| 202604114243782 | homepage |  | no | no | no | false | already_in_ga4_unknown |
| 202604112063199 | homepage |  | no | no | no | false | already_in_ga4_unknown |
| 202604114797781 | homepage |  | no | no | no | false | already_in_ga4_unknown |
| 202604116131920 | homepage |  | no | no | no | false | already_in_ga4_unknown |
| 202604111849684 | homepage |  | no | no | no | false | already_in_ga4_unknown |
| 202604116224417 | homepage |  | no | no | no | false | already_in_ga4_unknown |
| 202604113376482 | homepage |  | no | no | no | false | already_in_ga4_unknown |
| 202604110213894 | homepage |  | no | no | no | false | already_in_ga4_unknown |
| 202604111683190 | homepage |  | no | no | no | false | already_in_ga4_unknown |
| 202604117002395 | homepage |  | no | no | no | false | already_in_ga4_unknown |

## 해석

- 이 문서는 Google Ads upload 승인 문서가 아니다.
- NPay actual confirmed는 운영DB PAYMENT_COMPLETE/admin confirmed source 기준으로 포함한다.
- click-only, unpaid/test/controlled evidence는 계속 차단한다.
- send_candidate=false와 actual_send_candidate=false를 유지한다.

## 금지선 준수

- Google Ads upload 0
- platform send 0
- raw email/phone/member_code/order/payment 저장 0
