# confirmed_purchase no-send route 운영 샘플

작성 시각: 2026-05-06 09:24:25 KST

## 10초 결론

운영 결제완료 주문 샘플을 로컬 no-send route에 넣어 preview 응답과 block_reason 분포를 확인했다.
이 검증은 로컬 API preview이며 GA4/Meta/Google Ads 전송, 운영 DB write, backend deploy를 하지 않는다.

## 요약

| metric | value |
| --- | --- |
| route_sample_count | 20 |
| control_sample_count | 1 |
| all_no_send_verified | true |
| all_no_write_verified | true |
| all_no_platform_send_verified | true |

## route block_reason 분포

| block_reason | count |
| --- | --- |
| read_only_phase | 21 |
| approval_required | 21 |
| blocked_signal_stage_npay_click | 1 |
| signal_stage_must_be_payment_complete | 1 |

## 샘플

| type | http | ok | order | method | value | google_click | already_ga4 | route_block_reasons |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| operational_payment_complete | 200 | true | 202604285726644 | homepage | 484500 | Y | Y | read_only_phase, approval_required |
| operational_payment_complete | 200 | true | 2026043050675170 | npay | 39000 | Y | N | read_only_phase, approval_required |
| operational_payment_complete | 200 | true | 2026050158750350 | npay | 339300 | Y | N | read_only_phase, approval_required |
| operational_payment_complete | 200 | true | 2026050315711070 | npay | 109200 | Y | N | read_only_phase, approval_required |
| operational_payment_complete | 200 | true | 202605046835457 | homepage | 245000 | Y | Y | read_only_phase, approval_required |
| operational_payment_complete | 200 | true | 202604270677433 | homepage | 26754 | N | N | read_only_phase, approval_required |
| operational_payment_complete | 200 | true | 202604277023117 | homepage | 33614 | N | N | read_only_phase, approval_required |
| operational_payment_complete | 200 | true | 202604275581433 | homepage | 40546 | N | N | read_only_phase, approval_required |
| operational_payment_complete | 200 | true | 202604279175001 | homepage | 26481 | N | N | read_only_phase, approval_required |
| operational_payment_complete | 200 | true | 202604276680788 | homepage | 40964 | N | N | read_only_phase, approval_required |
| operational_payment_complete | 200 | true | 2026042741210750 | npay | 117000 | N | N | read_only_phase, approval_required |
| operational_payment_complete | 200 | true | 2026042744014790 | npay | 59800 | N | N | read_only_phase, approval_required |
| operational_payment_complete | 200 | true | 2026042746431650 | npay | 74000 | N | N | read_only_phase, approval_required |
| operational_payment_complete | 200 | true | 2026042747092520 | npay | 975000 | N | N | read_only_phase, approval_required |
| operational_payment_complete | 200 | true | 2026042749475590 | npay | 496000 | N | N | read_only_phase, approval_required |
| operational_payment_complete | 200 | true | 202604271480521 | homepage | 245000 | N | Y | read_only_phase, approval_required |
| operational_payment_complete | 200 | true | 202604275957738 | homepage | 459000 | N | Y | read_only_phase, approval_required |
| operational_payment_complete | 200 | true | 202604271408871 | homepage | 234000 | N | Y | read_only_phase, approval_required |
| operational_payment_complete | 200 | true | 202604274989539 | homepage | 234000 | N | Y | read_only_phase, approval_required |
| operational_payment_complete | 200 | true | 202604274403716 | homepage | 245000 | N | Y | read_only_phase, approval_required |
| control_npay_click_block | 400 | false | 2026043050675170 | npay | 39000 | Y | N | read_only_phase, approval_required, blocked_signal_stage_npay_click, signal_stage_must_be_payment_complete |

## Guardrails

```text
No-send verified: YES
No-write verified: YES
No-deploy verified: YES
No-publish verified: YES
No-platform-send verified: YES
```
