# ConfirmedPurchasePrep repeatable no-send runbook/result - 2026-05-10

## 5줄 요약

1. 최근 30일 운영DB PAYMENT_COMPLETE/admin-confirmed 기준 confirmed 주문 2152건을 반복 실행 입력으로 고정했다.
2. homepage confirmed 2009건, NPay actual confirmed 143건을 포함한다.
3. Google click id 보유 confirmed는 31건이며, 나머지는 upload 후보로 올리지 않는다.
4. NPay click/count/add_payment_info는 구매완료가 아니므로 입력에 섞지 않는다. complete_time/imweb_status blank도 단독 차단 사유로 쓰지 않는다.
5. send_candidate=false, actual_send_candidate=false, upload_candidate_count=0을 고정한다.

## 반복 실행 구조

- primary source: 운영DB PAYMENT_COMPLETE 또는 관리자 confirmed source
- support source: VM Cloud Path B order bridge evidence, NPay intent/order evidence, Google Ads click_view read-only campaign join
- output shape: `current_summary`, `invariants`, `source`, `validation_contract`를 유지
- 실행 의미: 실제 전송 후보를 만드는 것이 아니라, 전송 전 후보/차단 이유를 매번 같은 기준으로 재계산하는 no-send 입력

## 현재 Summary

- integrated_candidate_count: 2152
- homepage_confirmed_count: 2009
- npay_actual_confirmed_count: 143
- with_google_click_id: 31
- vm_order_evidence_matched_count: 1686
- vm_prep_matched_count: 35
- send_candidate: 0
- actual_send_candidate: 0
- upload_candidate: 0

## Block Reason Counts

- already_in_ga4_unknown: 2152
- approval_required: 2152
- missing_google_click_id: 2121
- read_only_integrated_input: 2152
- read_only_phase: 2152
- send_candidate_forced_false: 2152
- missing_attribution_vm_evidence: 466
- npay_actual_confirmed_from_primary_source: 143
- npay_intent_purchase_without_intent: 76
- order_has_return_reason: 11
- npay_intent_ambiguous: 24
- npay_intent_not_a_grade_strong: 22

## 운영자 해석

- 실제 결제완료 주문은 포함하되, Google Ads에 보낼 후보는 아직 0으로 둔다.
- 플랫폼 ROAS와 내부 confirmed ROAS를 비교할 때 이 파일은 내부 confirmed 후보의 기준선이다.
- campaign_id가 붙지 않은 주문은 예산 판단용 캠페인별 ROAS에 직접 쓰지 않고 HOLD/unknown으로 분리한다.

## 금지선 준수

- 운영DB write 0
- VM Cloud write 0
- Google Ads/GA4/Meta/TikTok/Naver send 0
- send_candidate=true 0
- actual_send_candidate=true 0
