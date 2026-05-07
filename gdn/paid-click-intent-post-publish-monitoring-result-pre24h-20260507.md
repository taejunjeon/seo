# paid_click_intent v1 pre24h 모니터링 결과

작성 시각: 2026-05-07 21:05:26 KST
상태: generated monitoring smoke
Owner: gdn / paid_click_intent
Do not use for: Google Ads 전환 변경, conversion upload, GA4/Meta/Google Ads 전송, 운영 DB/ledger write

## 10초 결론

receiver smoke 중 실패가 있다. 24h/72h PASS 또는 minimal ledger write 판단 전에 실패 케이스를 먼저 분해해야 한다.

## 요약

| metric | value |
| --- | --- |
| window | pre24h |
| base_url | https://att.ainativeos.net |
| health_ok | true |
| smoke_pass | false |
| smoke_count | 7 |
| failed_count | 1 |
| no_write_violations | 0 |
| no_platform_send_violations | 0 |

## Smoke 결과

| case | expected | http | pass | ok | would_store | would_send | test_click | live_candidate | block_reasons |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| positive_test_gclid | 200 | 200 | Y | Y | N | N | Y | N | read_only_phase, approval_required, test_click_id_rejected_for_live |
| missing_google_click_id | 400 | 400 | Y | N | N | N | N | N | read_only_phase, approval_required, missing_google_click_id |
| reject_value_currency | 400 | 502 | N | N | N | N | N | N |  |
| reject_order_fields | 400 | 400 | Y | N | N | N | N | N | read_only_phase, approval_required, pii_detected, secret_detected |
| reject_pii | 400 | 400 | Y | N | N | N | N | N | read_only_phase, approval_required, pii_detected, secret_detected |
| reject_admin_path | 400 | 400 | Y | N | N | N | N | N | read_only_phase, approval_required, admin_or_internal_path |
| reject_oversized_body | 413 | 413 | Y | N | N | N | N | N | read_only_phase, approval_required, payload_too_large |

## block_reason 분포

| block_reason | count |
| --- | --- |
| read_only_phase | 6 |
| approval_required | 6 |
| pii_detected | 2 |
| secret_detected | 2 |
| test_click_id_rejected_for_live | 1 |
| missing_google_click_id | 1 |
| admin_or_internal_path | 1 |
| payload_too_large | 1 |

## 아직 판정하지 않는 것

- 운영 고객 트래픽 전체 receiver fill-rate.
- 주문 원장 `missing_google_click_id` 감소.
- Google Ads ROAS 개선.
- minimal ledger write 승인 여부.

## 다음 할 일

- 24h/72h 정시 모니터링에서는 이 스크립트를 같은 옵션으로 재실행한다.
- 실패 케이스가 있으면 GTM tag pause 또는 receiver guard 수정 여부를 판단한다.
- PASS가 유지되면 minimal paid_click_intent ledger write 승인안을 검토한다.
