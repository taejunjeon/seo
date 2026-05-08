# Google Ads confirmed_purchase 후보 준비 no-send

작성 시각: 2026-05-08 12:35:24 KST
상태: read-only candidate prep
Owner: gdn / google_ads
Do not use for: Google Ads conversion upload, conversion action 생성/변경, 운영 DB write

## 10초 결론

운영 결제완료 dry-run 후보를 Google Ads offline conversion 관점의 payload preview로 바꿨다. 실제 upload 후보를 만든 것이 아니라, 어떤 block_reason 때문에 전송을 열면 안 되는지 고정한 것이다.

## 요약

| metric | value |
| --- | --- |
| payment_complete_candidates | 623 |
| homepage | 586 |
| npay | 37 |
| with_google_click_id | 5 |
| after_approval_structurally_eligible | 0 |
| send_candidate | 0 |

## block_reason 분포

| block_reason | count |
| --- | --- |
| read_only_phase | 623 |
| approval_required | 623 |
| google_ads_conversion_action_not_created | 623 |
| conversion_upload_not_approved | 623 |
| missing_google_click_id | 618 |
| already_in_ga4 | 476 |
| missing_attribution_vm_evidence | 129 |
| npay_intent_ambiguous | 10 |
| npay_intent_not_a_grade_strong | 10 |
| npay_intent_purchase_without_intent | 6 |
| order_has_return_reason | 4 |
| canceled_order | 4 |

## Google click id 있는 샘플

| order | method | value | click_type | ga4 | eligible_after_approval | block_reasons |
| --- | --- | --- | --- | --- | --- | --- |
| 202604285726644 | homepage | 484500 | gclid | present | N | read_only_phase, approval_required, already_in_ga4, google_ads_conversion_action_not_created, conversion_upload_not_approved |
| 2026043050675170 | npay | 39000 | gclid | robust_absent | N | read_only_phase, approval_required, npay_intent_ambiguous, google_ads_conversion_action_not_created, conversion_upload_not_approved |
| 2026050158750350 | npay | 339300 | gclid | robust_absent | N | read_only_phase, approval_required, npay_intent_ambiguous, google_ads_conversion_action_not_created, conversion_upload_not_approved |
| 2026050315711070 | npay | 109200 | gclid | robust_absent | N | read_only_phase, approval_required, npay_intent_ambiguous, google_ads_conversion_action_not_created, conversion_upload_not_approved |
| 202605046835457 | homepage | 245000 | gclid | present | N | read_only_phase, approval_required, already_in_ga4, google_ads_conversion_action_not_created, conversion_upload_not_approved |

## click id 없는 robust_absent 샘플

| order | method | value | ga4 | block_reasons |
| --- | --- | --- | --- | --- |
| 202604270677433 | homepage | 26754 | robust_absent | read_only_phase, approval_required, missing_attribution_vm_evidence, missing_google_click_id, google_ads_conversion_action_not_created, conversion_upload_not_approved |
| 202604277023117 | homepage | 33614 | robust_absent | read_only_phase, approval_required, missing_attribution_vm_evidence, missing_google_click_id, google_ads_conversion_action_not_created, conversion_upload_not_approved |
| 202604275581433 | homepage | 40546 | robust_absent | read_only_phase, approval_required, missing_attribution_vm_evidence, missing_google_click_id, google_ads_conversion_action_not_created, conversion_upload_not_approved |
| 202604279175001 | homepage | 26481 | robust_absent | read_only_phase, approval_required, missing_attribution_vm_evidence, missing_google_click_id, google_ads_conversion_action_not_created, conversion_upload_not_approved |
| 202604276680788 | homepage | 40964 | robust_absent | read_only_phase, approval_required, missing_attribution_vm_evidence, missing_google_click_id, google_ads_conversion_action_not_created, conversion_upload_not_approved |
| 202604279702715 | homepage | 26481 | robust_absent | read_only_phase, approval_required, missing_attribution_vm_evidence, missing_google_click_id, google_ads_conversion_action_not_created, conversion_upload_not_approved |
| 202604272102937 | homepage | 29003 | robust_absent | read_only_phase, approval_required, missing_attribution_vm_evidence, missing_google_click_id, google_ads_conversion_action_not_created, conversion_upload_not_approved |
| 202604272521774 | homepage | 33271 | robust_absent | read_only_phase, approval_required, missing_attribution_vm_evidence, missing_google_click_id, google_ads_conversion_action_not_created, conversion_upload_not_approved |
| 202604277373411 | homepage | 40964 | robust_absent | read_only_phase, approval_required, missing_attribution_vm_evidence, missing_google_click_id, google_ads_conversion_action_not_created, conversion_upload_not_approved |
| 202604274581208 | homepage | 67706 | robust_absent | read_only_phase, approval_required, missing_attribution_vm_evidence, missing_google_click_id, google_ads_conversion_action_not_created, conversion_upload_not_approved |
| 202604277117326 | homepage | 34202 | robust_absent | read_only_phase, approval_required, missing_attribution_vm_evidence, missing_google_click_id, google_ads_conversion_action_not_created, conversion_upload_not_approved |
| 202604270623349 | homepage | 26481 | robust_absent | read_only_phase, approval_required, missing_attribution_vm_evidence, missing_google_click_id, google_ads_conversion_action_not_created, conversion_upload_not_approved |
| 202604271400319 | homepage | 26481 | robust_absent | read_only_phase, approval_required, missing_attribution_vm_evidence, missing_google_click_id, google_ads_conversion_action_not_created, conversion_upload_not_approved |
| 202604277091326 | homepage | 33271 | robust_absent | read_only_phase, approval_required, missing_attribution_vm_evidence, missing_google_click_id, google_ads_conversion_action_not_created, conversion_upload_not_approved |
| 202604279652851 | homepage | 26754 | robust_absent | read_only_phase, approval_required, missing_attribution_vm_evidence, missing_google_click_id, google_ads_conversion_action_not_created, conversion_upload_not_approved |
| 202604279128873 | homepage | 80801 | robust_absent | read_only_phase, approval_required, missing_attribution_vm_evidence, missing_google_click_id, google_ads_conversion_action_not_created, conversion_upload_not_approved |
| 202604270283232 | homepage | 53508 | robust_absent | read_only_phase, approval_required, missing_attribution_vm_evidence, missing_google_click_id, google_ads_conversion_action_not_created, conversion_upload_not_approved |
| 202604272315573 | homepage | 33957 | robust_absent | read_only_phase, approval_required, missing_attribution_vm_evidence, missing_google_click_id, google_ads_conversion_action_not_created, conversion_upload_not_approved |
| 202604276544673 | homepage | 34900 | robust_absent | read_only_phase, approval_required, missing_attribution_vm_evidence, missing_google_click_id, google_ads_conversion_action_not_created, conversion_upload_not_approved |
| 202604273070387 | homepage | 33614 | robust_absent | read_only_phase, approval_required, missing_attribution_vm_evidence, missing_google_click_id, google_ads_conversion_action_not_created, conversion_upload_not_approved |

## 다음 할 일

- 24h/72h 모니터링 PASS 이후 minimal paid_click_intent ledger write를 검토한다.
- 저장이 열리면 이 prep을 재실행해 `missing_google_click_id` 감소 여부를 본다.
- Google Ads conversion action 생성/변경과 upload는 계속 별도 Red Lane으로 둔다.
