# BI confirmed_purchase 운영 source no-send dry-run

작성 시각: 2026-05-06 09:23:56 KST

## 10초 결론

이 리포트는 Google Ads에 실제 결제완료 주문만 구매로 알려주기 전, 운영 source 기준으로 후보와 차단 사유를 계산한 no-send 결과다.
NPay 실제 결제완료 주문은 포함했고, NPay 클릭/count/payment start만 있는 신호는 구매 후보에 넣지 않았다.
모든 row는 `send_candidate=false`이며 실제 GA4/Meta/Google Ads 전송, Google Ads 전환 액션 생성/변경, 운영 DB write는 하지 않았다.

## 요약

| metric | value |
| --- | --- |
| operational_orders | 623 |
| confirmed_homepage | 586 |
| confirmed_npay | 37 |
| ga4_present | 476 |
| ga4_robust_absent | 147 |
| with_google_click_id | 5 |
| would_be_eligible_after_approval | 0 |
| send_candidate | 0 |
| blocked_by_missing_google_click_id | 618 |
| blocked_by_read_only_phase | 623 |
| blocked_by_approval_required | 623 |

## Source freshness

| source | status | row_count | source_max_payment_complete_at | source_lag_hours | note |
| --- | --- | --- | --- | --- | --- |
| imweb_operational | fresh | 98470 | 2026-05-05T17:55:41.000Z | 6.5 | fresh 기준. 그래도 외부 전송 전에는 최신성 재확인이 필요하다. |

## send_candidate=0 해석

`send_candidate=0`은 실제 결제완료 주문이 없다는 뜻이 아니다.
현재 Green Lane이므로 모든 row가 `read_only_phase`와 `approval_required`로 막혀 있고, Google Ads 연결 관점에서는 `missing_google_click_id`가 별도 병목이다.

## 후보 샘플

| order_number | channel_order_no | method | value | conversion_time | ga4 | google_click | vm_match | send_candidate | block_reasons |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 202604270677433 |  | homepage | 26754 | 2026-04-27T00:00:13.000Z | robust_absent | N | N | N | read_only_phase, approval_required, missing_attribution_vm_evidence, missing_google_click_id |
| 202604277023117 |  | homepage | 33614 | 2026-04-27T00:00:17.000Z | robust_absent | N | N | N | read_only_phase, approval_required, missing_attribution_vm_evidence, missing_google_click_id |
| 202604275581433 |  | homepage | 40546 | 2026-04-27T00:01:35.000Z | robust_absent | N | N | N | read_only_phase, approval_required, missing_attribution_vm_evidence, missing_google_click_id |
| 202604279175001 |  | homepage | 26481 | 2026-04-27T00:01:35.000Z | robust_absent | N | N | N | read_only_phase, approval_required, missing_attribution_vm_evidence, missing_google_click_id |
| 202604276680788 |  | homepage | 40964 | 2026-04-27T00:01:36.000Z | robust_absent | N | N | N | read_only_phase, approval_required, missing_attribution_vm_evidence, missing_google_click_id |
| 202604279702715 |  | homepage | 26481 | 2026-04-27T00:01:36.000Z | robust_absent | N | N | N | read_only_phase, approval_required, missing_attribution_vm_evidence, missing_google_click_id |
| 202604272102937 |  | homepage | 29003 | 2026-04-27T00:01:42.000Z | robust_absent | N | N | N | read_only_phase, approval_required, missing_attribution_vm_evidence, missing_google_click_id |
| 202604272521774 |  | homepage | 33271 | 2026-04-27T00:01:42.000Z | robust_absent | N | N | N | read_only_phase, approval_required, missing_attribution_vm_evidence, missing_google_click_id |
| 202604277373411 |  | homepage | 40964 | 2026-04-27T00:01:45.000Z | robust_absent | N | N | N | read_only_phase, approval_required, missing_attribution_vm_evidence, missing_google_click_id |
| 202604274581208 |  | homepage | 67706 | 2026-04-27T00:01:50.000Z | robust_absent | N | N | N | read_only_phase, approval_required, missing_attribution_vm_evidence, missing_google_click_id |
| 202604277117326 |  | homepage | 34202 | 2026-04-27T00:01:50.000Z | robust_absent | N | N | N | read_only_phase, approval_required, missing_attribution_vm_evidence, missing_google_click_id |
| 202604270623349 |  | homepage | 26481 | 2026-04-27T00:02:02.000Z | robust_absent | N | N | N | read_only_phase, approval_required, missing_attribution_vm_evidence, missing_google_click_id |
| 202604271400319 |  | homepage | 26481 | 2026-04-27T00:02:03.000Z | robust_absent | N | N | N | read_only_phase, approval_required, missing_attribution_vm_evidence, missing_google_click_id |
| 202604277091326 |  | homepage | 33271 | 2026-04-27T00:02:03.000Z | robust_absent | N | N | N | read_only_phase, approval_required, missing_attribution_vm_evidence, missing_google_click_id |
| 202604279652851 |  | homepage | 26754 | 2026-04-27T00:02:15.000Z | robust_absent | N | N | N | read_only_phase, approval_required, missing_attribution_vm_evidence, missing_google_click_id |
| 202604279128873 |  | homepage | 80801 | 2026-04-27T00:02:21.000Z | robust_absent | N | N | N | read_only_phase, approval_required, missing_attribution_vm_evidence, missing_google_click_id |
| 202604270283232 |  | homepage | 53508 | 2026-04-27T00:02:25.000Z | robust_absent | N | N | N | read_only_phase, approval_required, missing_attribution_vm_evidence, missing_google_click_id |
| 202604272315573 |  | homepage | 33957 | 2026-04-27T00:02:41.000Z | robust_absent | N | N | N | read_only_phase, approval_required, missing_attribution_vm_evidence, missing_google_click_id |
| 202604276544673 |  | homepage | 34900 | 2026-04-27T00:02:45.000Z | robust_absent | N | N | N | read_only_phase, approval_required, missing_attribution_vm_evidence, missing_google_click_id |
| 202604273070387 |  | homepage | 33614 | 2026-04-27T00:03:26.000Z | robust_absent | N | N | N | read_only_phase, approval_required, missing_attribution_vm_evidence, missing_google_click_id |
| 202604271480521 |  | homepage | 245000 | 2026-04-27T00:06:19.000Z | present | N | biocom_imweb/order_number | N | read_only_phase, approval_required, missing_google_click_id, already_in_ga4 |
| 202604277197544 |  | homepage | 245000 | 2026-04-27T00:13:56.000Z | robust_absent | N | biocom_imweb/order_number | N | read_only_phase, approval_required, missing_google_click_id |
| 202604275957738 |  | homepage | 459000 | 2026-04-27T00:17:41.000Z | present | N | biocom_imweb/order_number | N | read_only_phase, approval_required, missing_google_click_id, already_in_ga4 |
| 202604271408871 |  | homepage | 234000 | 2026-04-27T01:22:32.000Z | present | N | biocom_imweb/order_number | N | read_only_phase, approval_required, missing_google_click_id, already_in_ga4 |
| 202604274989539 |  | homepage | 234000 | 2026-04-27T01:29:15.000Z | present | N | biocom_imweb/order_number | N | read_only_phase, approval_required, missing_google_click_id, already_in_ga4 |
| 202604274403716 |  | homepage | 245000 | 2026-04-27T02:06:24.000Z | present | N | biocom_imweb/order_number | N | read_only_phase, approval_required, missing_google_click_id, already_in_ga4 |
| 202604271478471 |  | homepage | 496000 | 2026-04-27T02:12:42.000Z | present | N | biocom_imweb/order_number | N | read_only_phase, approval_required, missing_google_click_id, already_in_ga4 |
| 202604271212189 | 2026042741210750 | npay | 117000 | 2026-04-27T02:40:11.000Z | robust_absent | N | N | N | read_only_phase, approval_required, missing_attribution_vm_evidence, npay_intent_purchase_without_intent, missing_google_click_id |
| 202604270667563 |  | homepage | 234000 | 2026-04-27T02:50:39.000Z | present | N | biocom_imweb/order_number | N | read_only_phase, approval_required, missing_google_click_id, already_in_ga4 |
| 202604278963387 |  | homepage | 245000 | 2026-04-27T02:53:31.000Z | present | N | biocom_imweb/order_number | N | read_only_phase, approval_required, missing_google_click_id, already_in_ga4 |
| 202604272016566 |  | homepage | 234000 | 2026-04-27T03:02:49.000Z | present | N | biocom_imweb/order_number | N | read_only_phase, approval_required, missing_google_click_id, already_in_ga4 |
| 202604279031344 |  | homepage | 459000 | 2026-04-27T03:03:27.000Z | present | N | biocom_imweb/order_number | N | read_only_phase, approval_required, order_has_return_reason, missing_google_click_id, already_in_ga4 |
| 202604273652505 | 2026042744014790 | npay | 59800 | 2026-04-27T04:00:53.000Z | robust_absent | N | N | N | read_only_phase, approval_required, missing_attribution_vm_evidence, npay_intent_purchase_without_intent, missing_google_click_id |
| 202604277510949 |  | homepage | 234000 | 2026-04-27T04:01:51.000Z | present | N | biocom_imweb/order_number | N | read_only_phase, approval_required, missing_google_click_id, already_in_ga4 |
| 202604264643603 |  | homepage | 245000 | 2026-04-27T04:27:29.000Z | robust_absent | N | biocom_imweb/order_number | N | read_only_phase, approval_required, missing_google_click_id |
| 202604277521744 |  | homepage | 234000 | 2026-04-27T04:31:18.000Z | present | N | biocom_imweb/order_number | N | read_only_phase, approval_required, missing_google_click_id, already_in_ga4 |
| 202604273892211 |  | homepage | 117404 | 2026-04-27T04:51:33.000Z | present | N | biocom_imweb/order_number | N | read_only_phase, approval_required, missing_google_click_id, already_in_ga4 |
| 202604278922463 |  | homepage | 245000 | 2026-04-27T04:58:03.000Z | present | N | biocom_imweb/order_number | N | read_only_phase, approval_required, missing_google_click_id, already_in_ga4 |
| 202604275677163 | 2026042746431650 | npay | 74000 | 2026-04-27T05:12:51.000Z | robust_absent | N | N | N | read_only_phase, approval_required, missing_attribution_vm_evidence, npay_intent_purchase_without_intent, missing_google_click_id |
| 202604275799371 |  | homepage | 34900 | 2026-04-27T05:13:40.000Z | present | N | N | N | read_only_phase, approval_required, missing_attribution_vm_evidence, missing_google_click_id, already_in_ga4 |

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
