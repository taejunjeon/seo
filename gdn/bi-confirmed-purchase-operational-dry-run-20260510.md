# BI confirmed_purchase 운영 source no-send dry-run

작성 시각: 2026-05-10 15:14:29 KST

## 10초 결론

이 리포트는 Google Ads에 실제 결제완료 주문만 구매로 알려주기 전, 운영 source 기준으로 후보와 차단 사유를 계산한 no-send 결과다.
NPay 실제 결제완료 주문은 포함했고, NPay 클릭/count/payment start만 있는 신호는 구매 후보에 넣지 않았다.
모든 row는 `send_candidate=false`이며 실제 GA4/Meta/Google Ads 전송, Google Ads 전환 액션 생성/변경, 운영 DB write는 하지 않았다.

## 요약

| metric | value |
| --- | --- |
| operational_orders | 4 |
| confirmed_homepage | 3 |
| confirmed_npay | 1 |
| ga4_present | 0 |
| ga4_robust_absent | 0 |
| with_google_click_id | 0 |
| would_be_eligible_after_approval | 0 |
| send_candidate | 0 |
| blocked_by_missing_google_click_id | 4 |
| blocked_by_read_only_phase | 4 |
| blocked_by_approval_required | 4 |

## Source freshness

| source | status | row_count | source_max_payment_complete_at | source_lag_hours | note |
| --- | --- | --- | --- | --- | --- |
| imweb_operational | fresh | 98909 | 2026-05-09T18:50:10.000Z | 11.4 | fresh 기준. 그래도 외부 전송 전에는 최신성 재확인이 필요하다. |

## send_candidate=0 해석

`send_candidate=0`은 실제 결제완료 주문이 없다는 뜻이 아니다.
현재 Green Lane이므로 모든 row가 `read_only_phase`와 `approval_required`로 막혀 있고, Google Ads 연결 관점에서는 `missing_google_click_id`가 별도 병목이다.

## 후보 샘플

| order_number | channel_order_no | method | value | conversion_time | ga4 | google_click | vm_match | send_candidate | block_reasons |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 202605105123079 |  | homepage | 240000 | 2026-05-09T16:12:17.000Z | unknown | N | biocom_imweb/order_number | N | read_only_phase, approval_required, missing_google_click_id, already_in_ga4_unknown |
| 202605101480176 |  | homepage | 245000 | 2026-05-09T16:28:41.000Z | unknown | N | biocom_imweb/order_number | N | read_only_phase, approval_required, missing_google_click_id, already_in_ga4_unknown |
| 202605102656098 |  | homepage | 260000 | 2026-05-09T16:40:26.000Z | unknown | N | biocom_imweb/order_number | N | read_only_phase, approval_required, missing_google_click_id, already_in_ga4_unknown |
| 202605108365065 | 2026051015292820 | npay | 117000 | 2026-05-09T18:50:10.000Z | unknown | N | npay_intent_log/order_number | N | read_only_phase, approval_required, npay_intent_not_a_grade_strong, missing_google_click_id, already_in_ga4_unknown |

## Guardrails

```text
No-send verified: YES
No-write verified: YES
No-deploy verified: YES
No-publish verified: YES
No-platform-send verified: YES
```

## 다음 판단

- `would_be_eligible_after_approval`은 실제 전송 후보가 아니다. 승인 후에도 Google Ads conversion action 생성/업로드는 Red Lane이다.
- `missing_google_click_id`가 많으면 랜딩/체크아웃 시점 `gclid/gbraid/wbraid` 보존이 먼저다.
- `already_in_ga4=present`는 GA4 복구 전송 후보에서 제외한다.
