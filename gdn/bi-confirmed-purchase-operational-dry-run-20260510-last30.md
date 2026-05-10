# BI confirmed_purchase 운영 source no-send dry-run

작성 시각: 2026-05-10 17:48:53 KST

## 10초 결론

이 리포트는 Google Ads에 실제 결제완료 주문만 구매로 알려주기 전, 운영 source 기준으로 후보와 차단 사유를 계산한 no-send 결과다.
NPay 실제 결제완료 주문은 포함했고, NPay 클릭/count/payment start만 있는 신호는 구매 후보에 넣지 않았다.
모든 row는 `send_candidate=false`이며 실제 GA4/Meta/Google Ads 전송, Google Ads 전환 액션 생성/변경, 운영 DB write는 하지 않았다.

## 요약

| metric | value |
| --- | --- |
| operational_orders | 2152 |
| confirmed_homepage | 2009 |
| confirmed_npay | 143 |
| ga4_present | 0 |
| ga4_robust_absent | 0 |
| with_google_click_id | 31 |
| would_be_eligible_after_approval | 0 |
| send_candidate | 0 |
| blocked_by_missing_google_click_id | 2121 |
| blocked_by_read_only_phase | 2152 |
| blocked_by_approval_required | 2152 |

## Source freshness

| source | status | row_count | source_max_payment_complete_at | source_lag_hours | note |
| --- | --- | --- | --- | --- | --- |
| imweb_operational | fresh | 98982 | 2026-05-10T06:25:08.000Z | 2.4 | fresh 기준. 그래도 외부 전송 전에는 최신성 재확인이 필요하다. |

## send_candidate=0 해석

`send_candidate=0`은 실제 결제완료 주문이 없다는 뜻이 아니다.
현재 Green Lane이므로 모든 row가 `read_only_phase`와 `approval_required`로 막혀 있고, Google Ads 연결 관점에서는 `missing_google_click_id`가 별도 병목이다.

## 후보 샘플

| order_number | channel_order_no | method | value | conversion_time | ga4 | google_click | vm_match | send_candidate | block_reasons |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 202604117818380 |  | homepage | 234000 | 2026-04-10T15:05:19.000Z | unknown | N | biocom_imweb/order_number | N | read_only_phase, approval_required, missing_google_click_id, already_in_ga4_unknown |
| 202604111244275 |  | homepage | 245000 | 2026-04-10T15:13:13.000Z | unknown | N | biocom_imweb/order_number | N | read_only_phase, approval_required, missing_google_click_id, already_in_ga4_unknown |
| 202604115118967 |  | homepage | 234000 | 2026-04-10T15:39:38.000Z | unknown | N | biocom_imweb/order_number | N | read_only_phase, approval_required, missing_google_click_id, already_in_ga4_unknown |
| 202604112055255 |  | homepage | 260000 | 2026-04-10T16:11:30.000Z | unknown | N | biocom_imweb/order_number | N | read_only_phase, approval_required, missing_google_click_id, already_in_ga4_unknown |
| 202604110781753 | 2026041163896160 | npay | 496000 | 2026-04-10T16:38:36.000Z | unknown | N | N | N | read_only_phase, approval_required, missing_attribution_vm_evidence, npay_intent_purchase_without_intent, missing_google_click_id, already_in_ga4_unknown |
| 202604113737797 | 2026041163975450 | npay | 35000 | 2026-04-10T16:53:23.000Z | unknown | N | N | N | read_only_phase, approval_required, missing_attribution_vm_evidence, npay_intent_purchase_without_intent, missing_google_click_id, already_in_ga4_unknown |
| 202604111454078 |  | homepage | 245000 | 2026-04-10T17:33:07.000Z | unknown | N | biocom_imweb/order_number | N | read_only_phase, approval_required, missing_google_click_id, already_in_ga4_unknown |
| 202604111580824 |  | homepage | 245000 | 2026-04-10T18:08:39.000Z | unknown | N | biocom_imweb/order_number | N | read_only_phase, approval_required, missing_google_click_id, already_in_ga4_unknown |
| 202604115757217 |  | homepage | 64000 | 2026-04-10T21:45:51.000Z | unknown | N | biocom_imweb/order_number | N | read_only_phase, approval_required, missing_google_click_id, already_in_ga4_unknown |
| 202604112155749 | 2026041165255610 | npay | 117000 | 2026-04-10T22:47:24.000Z | unknown | N | N | N | read_only_phase, approval_required, missing_attribution_vm_evidence, npay_intent_purchase_without_intent, missing_google_click_id, already_in_ga4_unknown |
| 202604118562495 |  | homepage | 26013 | 2026-04-10T23:46:34.000Z | unknown | N | N | N | read_only_phase, approval_required, missing_attribution_vm_evidence, missing_google_click_id, already_in_ga4_unknown |
| 202604112700124 |  | homepage | 245000 | 2026-04-10T23:51:14.000Z | unknown | N | biocom_imweb/order_number | N | read_only_phase, approval_required, missing_google_click_id, already_in_ga4_unknown |
| 202604114508225 |  | homepage | 26754 | 2026-04-11T00:00:09.000Z | unknown | N | N | N | read_only_phase, approval_required, missing_attribution_vm_evidence, missing_google_click_id, already_in_ga4_unknown |
| 202604116344404 |  | homepage | 40546 | 2026-04-11T00:00:17.000Z | unknown | N | N | N | read_only_phase, approval_required, missing_attribution_vm_evidence, missing_google_click_id, already_in_ga4_unknown |
| 202604118425637 |  | homepage | 27027 | 2026-04-11T00:01:26.000Z | unknown | N | N | N | read_only_phase, approval_required, missing_attribution_vm_evidence, missing_google_click_id, already_in_ga4_unknown |
| 202604115699827 |  | homepage | 34551 | 2026-04-11T00:01:26.000Z | unknown | N | N | N | read_only_phase, approval_required, missing_attribution_vm_evidence, missing_google_click_id, already_in_ga4_unknown |
| 202604119605718 |  | homepage | 27027 | 2026-04-11T00:01:57.000Z | unknown | N | N | N | read_only_phase, approval_required, missing_attribution_vm_evidence, missing_google_click_id, already_in_ga4_unknown |
| 202604117757875 |  | homepage | 47530 | 2026-04-11T00:02:11.000Z | unknown | N | N | N | read_only_phase, approval_required, missing_attribution_vm_evidence, missing_google_click_id, already_in_ga4_unknown |
| 202604111349966 |  | homepage | 40964 | 2026-04-11T00:03:14.000Z | unknown | N | N | N | read_only_phase, approval_required, missing_attribution_vm_evidence, missing_google_click_id, already_in_ga4_unknown |
| 202604110809695 |  | homepage | 29900 | 2026-04-11T00:03:20.000Z | unknown | N | N | N | read_only_phase, approval_required, missing_attribution_vm_evidence, missing_google_click_id, already_in_ga4_unknown |
| 202604112557244 |  | homepage | 26754 | 2026-04-11T00:03:21.000Z | unknown | N | N | N | read_only_phase, approval_required, missing_attribution_vm_evidence, missing_google_click_id, already_in_ga4_unknown |
| 202604110801764 |  | homepage | 245000 | 2026-04-11T00:55:13.000Z | unknown | N | biocom_imweb/order_number | N | read_only_phase, approval_required, missing_google_click_id, already_in_ga4_unknown |
| 202604112883367 | 2026041167153620 | npay | 69700 | 2026-04-11T01:05:16.000Z | unknown | N | N | N | read_only_phase, approval_required, missing_attribution_vm_evidence, npay_intent_purchase_without_intent, missing_google_click_id, already_in_ga4_unknown |
| 202604111445985 |  | homepage | 118800 | 2026-04-11T01:07:21.000Z | unknown | N | biocom_imweb/order_number | N | read_only_phase, approval_required, missing_google_click_id, already_in_ga4_unknown |
| 202604118509662 |  | homepage | 471200 | 2026-04-11T01:41:11.000Z | unknown | N | biocom_imweb/order_number | N | read_only_phase, approval_required, missing_google_click_id, already_in_ga4_unknown |
| 202604114654534 |  | homepage | 99000 | 2026-04-11T01:43:39.000Z | unknown | N | biocom_imweb/order_number | N | read_only_phase, approval_required, missing_google_click_id, already_in_ga4_unknown |
| 202604113287925 |  | homepage | 459000 | 2026-04-11T02:04:15.000Z | unknown | N | biocom_imweb/order_number | N | read_only_phase, approval_required, missing_google_click_id, already_in_ga4_unknown |
| 202604117313877 |  | homepage | 479500 | 2026-04-11T03:04:49.000Z | unknown | N | biocom_imweb/order_number | N | read_only_phase, approval_required, missing_google_click_id, already_in_ga4_unknown |
| 202604110440436 |  | homepage | 471200 | 2026-04-11T03:57:56.000Z | unknown | N | biocom_imweb/order_number | N | read_only_phase, approval_required, missing_google_click_id, already_in_ga4_unknown |
| 202604110835144 |  | homepage | 245000 | 2026-04-11T04:02:03.000Z | unknown | N | biocom_imweb/order_number | N | read_only_phase, approval_required, missing_google_click_id, already_in_ga4_unknown |
| 202604116150716 |  | homepage | 234000 | 2026-04-11T04:07:22.000Z | unknown | N | biocom_imweb/order_number | N | read_only_phase, approval_required, missing_google_click_id, already_in_ga4_unknown |
| 202604119144238 |  | homepage | 256880 | 2026-04-11T04:14:39.000Z | unknown | N | biocom_imweb/order_number | N | read_only_phase, approval_required, missing_google_click_id, already_in_ga4_unknown |
| 202604115397118 |  | homepage | 234000 | 2026-04-11T04:48:57.000Z | unknown | N | biocom_imweb/order_number | N | read_only_phase, approval_required, missing_google_click_id, already_in_ga4_unknown |
| 202604119638594 |  | homepage | 681000 | 2026-04-11T06:20:56.000Z | unknown | N | biocom_imweb/order_number | N | read_only_phase, approval_required, missing_google_click_id, already_in_ga4_unknown |
| 202604116253633 |  | homepage | 42330 | 2026-04-11T07:22:23.000Z | unknown | N | biocom_imweb/order_number | N | read_only_phase, approval_required, missing_google_click_id, already_in_ga4_unknown |
| 202604116014857 |  | homepage | 245000 | 2026-04-11T07:24:25.000Z | unknown | N | biocom_imweb/order_number | N | read_only_phase, approval_required, missing_google_click_id, already_in_ga4_unknown |
| 202604114188881 |  | homepage | 1324300 | 2026-04-11T07:25:32.000Z | unknown | N | biocom_imweb/order_number | N | read_only_phase, approval_required, missing_google_click_id, already_in_ga4_unknown |
| 202604113906855 | 2026041174649390 | npay | 35000 | 2026-04-11T07:26:27.000Z | unknown | N | N | N | read_only_phase, approval_required, missing_attribution_vm_evidence, npay_intent_purchase_without_intent, missing_google_click_id, already_in_ga4_unknown |
| 202604110666452 |  | homepage | 245000 | 2026-04-11T08:20:06.000Z | unknown | N | biocom_imweb/order_number | N | read_only_phase, approval_required, missing_google_click_id, already_in_ga4_unknown |
| 202604119933827 |  | homepage | 245000 | 2026-04-11T08:26:04.000Z | unknown | N | biocom_imweb/order_number | N | read_only_phase, approval_required, missing_google_click_id, already_in_ga4_unknown |

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
