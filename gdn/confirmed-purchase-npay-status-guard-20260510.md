# ConfirmedPurchasePrep NPay Status Guard

harness_preflight:
  common_harness_read: true
  project_harness_read: true
  required_context_docs:
    - AGENTS.md
    - docurule.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
    - naver/!npay.md
    - naver/!npayroas.md
  lane: Green
  allowed_actions:
    - local_code_change
    - fixture_test
    - read_only_vm_cloud_query
    - documentation
    - gptconfirm_packaging
  forbidden_actions:
    - platform_send
    - conversion_upload
    - vm_cloud_write
    - operating_db_write
    - gtm_publish
    - status_sync_cron
  source_window_freshness_confidence: "2026-05-10 KST / VM Cloud SQLite read-only + fixture / confidence 0.93"

작성: 2026-05-10 KST
상태: Green 구현/fixture PASS

## 5줄 요약

1. NPay 실제 결제완료 판정에서 VM Cloud `complete_time` blank와 `imweb_status` blank를 단독 차단 사유로 쓰지 않도록 builder guard를 보강했다.
2. primary confirmed source는 운영DB `PAYMENT_COMPLETE` 또는 관리자-confirmed source이며, Imweb lifecycle status는 보조값이다.
3. NPay click/count/payment start/add_payment_info는 계속 purchase가 아니며, controlled evidence도 upload 후보에서 제외한다.
4. fixture dry-run은 candidate 5건, excluded 3건, send_candidate 0건으로 PASS했다.
5. Google Ads/GA4/Meta/TikTok/Naver 전송, VM Cloud write, status sync cron은 모두 하지 않았다.

## 적용 규칙

NPay actual confirmed candidate 포함 조건:

```text
payment_method = npay
AND (
  operating_db.payment_status = PAYMENT_COMPLETE
  OR source_order_status = PAYMENT_COMPLETE
  OR admin_confirmed = true
)
AND value > 0
AND not cancelled/refunded/test
AND source_evidence_type NOT IN (click, count, payment_start, add_payment_info)
```

단, 이 단계는 후보 input 생성 단계이므로 `send_candidate=false`를 유지한다.

## 단독 차단 금지

아래 값만으로 NPay 미결제라고 판단하지 않는다.

```text
VM Cloud imweb_orders.complete_time blank
VM Cloud imweb_orders.complete_time = 0
VM Cloud imweb_orders.imweb_status blank
```

이유는 `complete_time`이 NPay 결제완료 시각이 아니라 Imweb 주문 lifecycle 완료 시각일 수 있고, `imweb_status`는 status sync job이 돌지 않으면 VM Cloud 전체 row에서 blank일 수 있기 때문이다.

## 차단 조건

```text
npay_click_only
npay_count
npay_payment_start
npay_add_payment_info
payment_status not complete
cancelled/refunded
controlled_test_evidence
value <= 0
```

이 주문은 evidence로 남길 수 있지만, confirmed purchase upload 후보는 아니다.

## Fixture 결과

Source: `data/confirmed-purchase-npay-status-guard-dry-run-20260510.json`

```text
candidate_count=5
excluded_order_count=3
homepage_count=2
npay_actual_count=3
path_c_match_count=2
missing_paid_click_intent=2
after_paid_at=1
ambiguous=1
send_candidate=0
failures=0
```

검증한 케이스:

1. `NPay PAYMENT_COMPLETE + complete_time=0/blank + STANDBY` -> include candidate, send_candidate=false.
2. `NPay PAYMENT_COMPLETE + complete_time blank + imweb_status blank` -> primary source confirms이면 include candidate.
3. `NPay add_payment_info/click only` -> block.
4. `NPay unpaid/pending` -> block.
5. `controlled NPay evidence` -> evidence only, exclude_from_upload.

## 영향

- ConfirmedPurchasePrep input builder는 NPay 실제 결제완료를 lifecycle blank 때문에 잘못 누락하지 않는다.
- click-only NPay 신호는 계속 구매로 승격하지 않는다.
- Google Ads upload 후보는 여전히 0이며, 별도 Red 승인 전 전송하지 않는다.

