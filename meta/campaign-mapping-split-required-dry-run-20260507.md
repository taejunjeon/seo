# Meta split_required 캠페인 매핑 dry-run

작성 시각: 2026-05-07 20:13:56 KST
상태: read-only dry-run
Owner: meta / campaign mapping
Do not use for: Meta Ads 수정, campaign id 강제 배정, 광고 플랫폼 전송

## 10초 결론

그로스파트 수동 엑셀을 기준으로 campaign mapping 후보를 dry-run했다. `분리` 항목은 캠페인 ROAS에 바로 붙이지 않고 주문별 id/date/URL Parameters 증거가 생길 때까지 `split_required`로 유지한다.

## 요약

| metric | value |
| --- | --- |
| manual_rows | 10 |
| mapped_manual | 1 |
| split_required_order_level_needed | 6 |
| excluded_from_meta_roas | 1 |
| precision_loss_review | 2 |
| quarantine_pending | 0 |
| split_required_revenue | 10396950 |

## Dry-run 결과

| target | decision | bucket | selected_campaign | candidate_ids | orders | revenue | confidence | block_reasons |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| fbclid only (/sosohantoon01, /kangman03, /shop_view/?idx=503) | 확정 | precision_loss_review |  | 120242626179290000 | 0 | 0 | 0.55 | read_only_phase, campaign_id_precision_loss_possible |
| meta_biocom_sosohantoon01_igg | 분리 | split_required_order_level_needed |  | 120242626179290396, 120237452088280396 | 12 | 3933000 | 0.82 | read_only_phase, split_required, order_level_campaign_evidence_required, audit_missing_or_stale |
| meta_biocom_kkunoping02_igg | 확정 | mapped_manual | 120242626179290400 | 120242626179290400 | 1 | 675000 | 0.88 | read_only_phase, manual_confirmed, audit_missing_or_stale |
| meta_biocom_skintts1_igg | 분리 | split_required_order_level_needed |  | 120244759209860396, 120213362391690396, 120235591897270396 | 0 | 0 | 0.82 | read_only_phase, split_required, order_level_campaign_evidence_required, audit_missing_or_stale |
| inpork_biocom_igg | 제외 | excluded_from_meta_roas |  |  | 7 | 1969500 | 0.9 | read_only_phase, excluded_by_growth_manual, not_meta_campaign_roas |
| meta_biocom_proteinstory_igg | 분리 | split_required_order_level_needed |  | 120235591897270396, 120213362391690396, 120236373509560396 | 9 | 2787750 | 0.82 | read_only_phase, split_required, order_level_campaign_evidence_required |
| meta_biocom_iggspring | 분리 | split_required_order_level_needed |  | 120213362391690396, 120235591897270396 | 7 | 2206200 | 0.82 | read_only_phase, split_required, order_level_campaign_evidence_required |
| meta_biocom_iggacidset_2026 | 분리 | precision_loss_review |  | 120237452088280000, 120235591897270396 | 4 | 1658600 | 0.55 | read_only_phase, campaign_id_precision_loss_possible |
| meta_biocom_mingzzinginstatoon_igg | 분리 | split_required_order_level_needed |  | 120235591897270396, 120235640158940396, 120240314792490396 | 4 | 980000 | 0.82 | read_only_phase, split_required, order_level_campaign_evidence_required |
| meta_biocom_iggpost_igg | 분리 | split_required_order_level_needed |  | 120213362391690396, 120235591897270396 | 3 | 490000 | 0.82 | read_only_phase, split_required, order_level_campaign_evidence_required |

## 다음 할 일

- `split_required_order_level_needed`는 최신 주문별 campaign/adset/ad id export가 있어야 실제 배정 가능하다.
- `precision_loss_review`는 Excel에서 campaign id가 손상됐을 가능성이 있으므로 Ads Manager 원본 id로 재확인한다.
- 이 dry-run만으로 Meta campaign ROAS 분자를 바꾸지 않는다.
