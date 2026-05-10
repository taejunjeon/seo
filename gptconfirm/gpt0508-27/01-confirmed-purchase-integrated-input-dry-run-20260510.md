# ConfirmedPurchasePrep 통합 input dry-run (2026-05-10)

## 5줄 요약

1. 운영DB PAYMENT_COMPLETE 기준 confirmed 주문 4건을 primary source로 통합했다.
2. NPay actual confirmed는 1건 포함했고, complete_time/imweb_status blank는 단독 차단 사유로 쓰지 않았다.
3. Google click id 보유 주문은 0건이라 Google Ads upload 후보는 아직 0건이다.
4. VM Cloud/Path B evidence는 보조 원장으로만 붙였고 send_candidate=false를 강제했다.
5. 다음은 action/campaign별 Google Ads 플랫폼 주장값과 내부 confirmed 매출 gap 분해다.

## Summary

- generated_at_kst: 2026-05-10 15:57:45 KST
- operational_input: data/bi-confirmed-purchase-operational-dry-run-20260510.json
- vm_prep_input: data/confirmed-purchase-prep-recalc-20260510.json
- path_b_evidence_input: data/path-b-real-paid-click-actual-order-preview-result-20260510.json
- integrated_candidate_count: 4
- homepage_confirmed_count: 3
- npay_actual_confirmed_count: 1
- with_google_click_id: 0
- vm_order_evidence_matched_count: 4
- vm_prep_matched_count: 3
- send_candidate: 0
- actual_send_candidate: 0

## Block Reason Counts

- already_in_ga4_unknown: 4
- approval_required: 4
- missing_google_click_id: 4
- npay_actual_confirmed_from_primary_source: 1
- npay_intent_not_a_grade_strong: 1
- read_only_integrated_input: 4
- read_only_phase: 4
- send_candidate_forced_false: 4

## Candidate Table

| order_number | method | value | VM order | Google click | Path B same order | send | primary reason |
| --- | --- | ---: | --- | --- | --- | --- | --- |
| 202605105123079 | homepage | 240000 | yes | no | no | false | homepage_confirmed_order |
| 202605101480176 | homepage | 245000 | yes | no | no | false | homepage_confirmed_order |
| 202605102656098 | homepage | 260000 | yes | no | no | false | homepage_confirmed_order |
| 202605108365065 | npay | 117000 | yes | no | no | false | npay_confirmed_order |

## 이번 문서가 말하는 것

- 실제 결제완료 판단은 운영DB PAYMENT_COMPLETE/admin-confirmed 계열을 primary로 둔다.
- NPay 버튼 클릭, 결제 시작, add_payment_info는 구매완료가 아니다.
- NPay actual confirmed는 포함 후보가 될 수 있으나 Google Ads upload는 계속 금지다.
- VM Cloud complete_time/imweb_status blank는 단독 미결제 판단 근거가 아니다.

## 이번 문서가 말하지 않는 것

- Google Ads 전송 후보 승인 여부를 말하지 않는다. 현재 upload 후보는 0건이다.
- Google Ads ROAS gap 원인을 확정하지 않는다. action/campaign decomposition이 다음 입력이다.
- Path B evidence가 모든 운영 주문과 1:1로 연결됐다고 말하지 않는다.

## 금지선 준수

- 운영DB write 0
- VM Cloud write 0
- GTM Production publish 0
- Google Ads/GA4/Meta/TikTok/Naver send 0
- send_candidate=true 0

