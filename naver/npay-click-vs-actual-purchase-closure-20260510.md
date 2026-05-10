# NPay click vs actual purchase closure (2026-05-10)

작성 시각: 2026-05-10 KST
작업 성격: Green Lane read-only/dry-run 기준 정본화
대상: biocom NPay actual confirmed 판단, TechSol NPay click conversion risk

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - harness/npay-recovery/README.md
    - harness/gdn/VERIFY.md
  lane: Green
  allowed_actions:
    - read-only 문서화
    - dry-run 결과 정리
    - ConfirmedPurchasePrep guard 설계
  forbidden_actions:
    - Google Ads/GA4/Meta/TikTok/Naver actual send
    - Google Ads conversion upload
    - GTM Production publish
    - raw email/phone/member_code/order/payment 저장 또는 logging
    - send_candidate=true
  source_window_freshness_confidence:
    source: 운영DB PAYMENT_COMPLETE dry-run + VM Cloud 보조 원장 + Tag Assistant evidence
    window: 2026-05-10 KST
    freshness: same-day
    confidence: high
```

## 5줄 결론

1. NPay 버튼 클릭, NPay count, `add_payment_info`는 결제완료 구매가 아니다.
2. NPay actual confirmed는 운영DB `PAYMENT_COMPLETE` 또는 관리자 confirmed source를 primary로 판단한다.
3. VM Cloud의 `complete_time` blank나 `imweb_status` blank는 단독 미결제 판단 근거로 쓰지 않는다.
4. TechSol Google Ads NPay click conversion은 실제 구매완료와 분리해야 하는 별도 risk다.
5. 현재 Google Ads upload 후보는 0이고, `send_candidate=false`, `actual_send_candidate=false`를 유지한다.

## 기준

### 실제 구매완료로 볼 수 있는 것

- `payment_method=npay`
- 운영DB 또는 관리자 source에서 `PAYMENT_COMPLETE` 확인
- 결제 금액 `value > 0`
- 취소/환불/test/controlled evidence가 아님

이 조건을 만족하면 NPay actual confirmed 후보로 포함한다. 단, 현 단계에서는 upload 후보가 아니라 no-send dry-run 후보이며 `send_candidate=false`다.

### 구매완료로 보면 안 되는 것

- NPay 버튼 클릭
- NPay count
- `add_payment_info`
- 결제 시작 또는 결제창 진입
- NPay intent만 있는 row
- 가상계좌 미입금 evidence
- controlled/test order evidence

위 항목은 funnel evidence로는 의미가 있지만 매출/ROAS confirmed purchase가 아니다.

## complete_time / imweb_status 해석

`complete_time=0` 또는 blank는 NPay 미결제를 뜻한다고 단정하지 않는다. 배송/주문 lifecycle 완료 전 상태일 수 있다.

`imweb_status` blank는 status sync job 미실행 또는 VM Cloud 보조 원장 freshness 문제일 수 있다. 전체 VM Cloud `imweb_orders`가 blank일 수 있으므로 단독 차단 사유로 쓰지 않는다.

결론:

```text
primary confirmed source = 운영DB PAYMENT_COMPLETE / 관리자 confirmed
secondary lifecycle source = VM Cloud complete_time / imweb_status
```

## TechSol Google Ads NPay click conversion

Tag Assistant에서 `TechSol - [GAds]NPAY구매 51163`은 NPay 버튼 클릭 시 Google Ads conversion tracking으로 실행되는 것이 관측됐다.

이는 이름에 `구매`가 들어가지만 실제 결제완료 확인과 다르다. Google Ads action/campaign decomposition에서는 이 계열을 NPay click/count risk로 분리한다.

해야 할 후속:

- Google Ads 전환 액션에서 이 label/action이 Primary 전환인지 확인
- Primary면 실제 구매완료 학습 신호와 분리할 Red 승인안 작성
- 지금은 pause/delete/change 금지

## ConfirmedPurchasePrep guard 반영

반영할 guard:

```text
include_candidate:
  payment_method == npay
  AND primary_payment_status == PAYMENT_COMPLETE
  AND value > 0
  AND not cancelled/refunded/test

block:
  npay_click_only
  npay_count_only
  add_payment_info_only
  unpaid_or_pending
  controlled_evidence
  missing_primary_confirmed_source
```

항상 유지:

```text
send_candidate=false
actual_send_candidate=false
google_ads_upload_candidate=false
```

## 오늘 기준 상태

- 운영DB PAYMENT_COMPLETE 기반 통합 input: NPay actual confirmed 1건 포함
- Google click id 보유 confirmed 주문: 0건
- Google Ads upload candidate: 0건
- platform send: 0건
- raw 저장/logging 신규 활성화: 0건

## 다음 Green

1. Google Ads action/campaign decomposition으로 NPay click/count 계열이 어느 campaign/action value를 키우는지 분해한다.
2. ConfirmedPurchasePrep integrated input을 기준으로 no-send 후보를 재계산한다.
3. TechSol NPay click conversion은 실제 구매완료 전환과 이름/용도/Primary 여부를 분리해 문서화한다.

