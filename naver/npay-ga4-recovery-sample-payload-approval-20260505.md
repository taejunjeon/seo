# NPay GA4 누락 복구 샘플 8건 payload 승인안

작성 시각: 2026-05-05 23:22 KST
대상: biocom NPay 실제 결제완료 주문 중 GA4 robust_absent 샘플 8건
문서 성격: Green Lane payload preview. 실제 GA4/Meta/Google Ads 전송 승인 문서가 아니다.

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - harness/npay-recovery/RULES.md
    - harness/npay-recovery/APPROVAL_GATES.md
  lane: Green
  allowed_actions:
    - payload preview
    - read-only GA4 BigQuery guard result 정리
    - no-send 승인안 작성
  forbidden_actions:
    - GA4 Measurement Protocol purchase 전송
    - Meta CAPI Purchase 전송
    - Google Ads conversion upload
    - 운영 DB write/import/update
    - GTM publish
    - backend deploy
  source_window_freshness_confidence:
    source: "data/npay-roas-dry-run-vm-snapshot-20260505-ga4-guarded.json"
    window: "2026-04-27~2026-05-05 dry-run"
    freshness: "VM snapshot + 운영 PostgreSQL read-only + GA4 BigQuery robust guard"
    site: "biocom"
    confidence: 0.82
```

## 10초 결론

이 8건은 `실제 전송 후보`가 아니라 `GA4 누락 복구 파이프라인 검증용 샘플`이다.
8건 모두 운영 주문 기준 NPay 실제 결제완료이고, GA4 BigQuery robust guard에서는 `robust_absent`로 분리됐다.
하지만 실제 전송은 승인되지 않았으므로 모든 row의 `send_candidate`는 `false`다.

핵심 병목은 8건을 보내는 일이 아니다.
근본 해결은 앞으로 NPay 클릭/count/payment start가 아니라 `NPay 실제 결제완료 주문`만 실시간 또는 준실시간 confirmed purchase 파이프라인으로 보내는 것이다.

## 72시간 초과 주문

아래 7건은 paid_at 기준 72시간을 초과했다.
GA4 Measurement Protocol로 보낸다고 해도 원래 세션/날짜 복구가 불확실하므로 실제 전송 후보에서 별도 분리한다.

| order_number | channel_order_no | value | paid_at | paid_at_age_hours | client_id | ga_session_id | event_id | dedupe_key | is_test | is_manual | is_canceled | is_refunded | already_in_ga4 | send_candidate | block_reason |
|---|---|---:|---|---:|---|---|---|---|---|---|---|---|---|---|---|
| 202604280487104 | 2026042865542930 | 35000 | 2026-04-27T21:13:24.000Z | 184.4 | 695356435.1777324290 | 1777324290 | NPayRecoveredPurchase_202604280487104 | npay_recovery_ga4_purchase:biocom:202604280487104 | false | false | false | false | robust_absent | false | approval_required; actual_send_not_approved; ga4_mp_72h_exceeded_original_session_uncertain |
| 202604285552452 | 2026042867285600 | 496000 | 2026-04-27T23:27:09.000Z | 182.1 | 806449930.1777331701 | 1777331701 | NPayRecoveredPurchase_202604285552452 | npay_recovery_ga4_purchase:biocom:202604285552452 | false | false | false | false | robust_absent | false | approval_required; actual_send_not_approved; ga4_mp_72h_exceeded_original_session_uncertain |
| 202604303307399 | 2026043034982320 | 496000 | 2026-04-30T00:19:10.000Z | 133.3 | 901508731.1765852144 | 1777508260 | NPayRecoveredPurchase_202604303307399 | npay_recovery_ga4_purchase:biocom:202604303307399 | false | false | false | false | robust_absent | false | approval_required; actual_send_not_approved; ga4_mp_72h_exceeded_original_session_uncertain |
| 202604309594732 | 2026043044799490 | 11900 | 2026-04-30T07:01:14.000Z | 126.6 | 349382661.1770783461 | 1777532376 | NPayRecoveredPurchase_202604309594732 | npay_recovery_ga4_purchase:biocom:202604309594732 | false | false | false | false | robust_absent | false | approval_required; actual_send_not_approved; ga4_mp_72h_exceeded_original_session_uncertain |
| 202605011540306 | 2026050158972710 | 496000 | 2026-05-01T00:16:46.000Z | 109.3 | 985413772.1774220691 | 1777594221 | NPayRecoveredPurchase_202605011540306 | npay_recovery_ga4_purchase:biocom:202605011540306 | false | false | false | false | robust_absent | false | approval_required; actual_send_not_approved; ga4_mp_72h_exceeded_original_session_uncertain |
| 202605026187995 | 2026050280712120 | 35000 | 2026-05-01T23:04:34.000Z | 86.5 |  |  | NPayRecoveredPurchase_202605026187995 | npay_recovery_ga4_purchase:biocom:202605026187995 | false | false | false | false | robust_absent | false | approval_required; actual_send_not_approved; ga4_mp_72h_exceeded_original_session_uncertain; missing_client_id; missing_ga_session_id |
| 202605027178971 | 2026050281216190 | 496000 | 2026-05-01T23:44:31.000Z | 85.9 | 90602956.1776243790 | 1777678740 | NPayRecoveredPurchase_202605027178971 | npay_recovery_ga4_purchase:biocom:202605027178971 | false | false | false | false | robust_absent | false | approval_required; actual_send_not_approved; ga4_mp_72h_exceeded_original_session_uncertain |

## 72시간 이내 주문

아래 1건은 dry-run 산출 시점 기준 72시간 이내였지만, TJ님이 실제 전송을 승인하지 않았으므로 전송하지 않는다.

| order_number | channel_order_no | value | paid_at | paid_at_age_hours | client_id | ga_session_id | event_id | dedupe_key | is_test | is_manual | is_canceled | is_refunded | already_in_ga4 | send_candidate | block_reason |
|---|---|---:|---|---:|---|---|---|---|---|---|---|---|---|---|---|
| 202605031873910 | 2026050331688110 | 496000 | 2026-05-03T14:33:32.000Z | 47.0 | 1333734162.1777818563 | 1777818562 | NPayRecoveredPurchase_202605031873910 | npay_recovery_ga4_purchase:biocom:202605031873910 | false | false | false | false | robust_absent | false | approval_required; actual_send_not_approved; sample_only_no_actual_send |

## 해석

이 표의 `already_in_ga4=robust_absent`는 GA4 raw에서 `order_number`와 `channel_order_no` 모두 발견되지 않았다는 뜻이다.
하지만 `robust_absent`가 곧 전송 승인은 아니다.
실제 전송은 GA4 전환값을 바꾸는 Red Lane 작업이므로, 별도 승인 문서와 특정 주문번호 범위가 필요하다.

## 다음 판단

이 8건은 복구 전송보다 파이프라인 검증에 쓴다.
다음 구현은 `NPay 실제 결제완료 주문 확인 -> intent/client/session/click id 조인 -> GA4/Meta/Google Ads별 no-send payload 생성 -> 중복 guard -> 승인 전송` 순서다.

## Auditor verdict

Auditor verdict: PASS_WITH_NOTES
No-send verified: YES
No-write verified: YES
No-deploy verified: YES
No-publish verified: YES
No-platform-send verified: YES

Notes:
- 72시간 초과 7건은 원래 세션/날짜 복구 불확실성 때문에 실제 전송 후보에서 분리했다.
- 72시간 이내 1건도 실제 전송 승인 전에는 보내지 않는다.
- 근본 해결은 8건 복구가 아니라 confirmed purchase 파이프라인이다.
