# Unpaid vbank controlled evidence exclusion guard

작성 시각: 2026-05-10 01:51 KST
Status: GREEN_POLICY_DESIGN

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - harness/gdn/RULES.md
    - harness/gdn/VERIFY.md
  required_context_docs:
    - gptconfirm/gpt0508-23/01-real-paid-click-order-preview-result.md
    - gptconfirm/gpt0508-23/02-reliability-v2-real-click-updated-result.md
    - gptconfirm/gpt0508-23/03-confirmed-payment-next-step-approval.md
  lane: Green documentation and local builder policy design
  allowed_actions:
    - exclusion guard design
    - dry-run block_reason mapping
    - total current update
    - gptconfirm packaging
  forbidden_actions:
    - actual deposit or payment
    - Google Ads conversion upload
    - GA4/Meta/Google Ads/TikTok/Naver new send
    - send_candidate=true
    - actual_send_candidate=true
    - raw email/phone/member_code/order/payment storage or logging
  source_window_freshness_confidence:
    source: gpt0508-23 Tag Assistant evidence + VM Cloud summary read-only
    window: 2026-05-10 01:21-01:51 KST
    freshness: same-session + read-only summary
    confidence: 0.95
```

## 한 줄 결론

가상계좌 주문완료 화면까지 도달한 evidence는 Path B bridge 증거로는 유용하다. 하지만 입금 전이면 실제 결제완료 구매가 아니므로 Google Ads upload, confirmed_purchase, 내부 ROAS 후보에서 반드시 제외한다.

## 왜 필요한가

이번 실제 광고 클릭 테스트는 `광고 클릭 -> 바이오컴 방문 -> 주문완료 화면 -> Path B hash present`를 확인했다. 그러나 가상계좌는 주문완료 화면이 떠도 입금 전에는 매출이 아니다. 이 row를 성과 매출로 쓰면 Google ROAS 보정 목적과 반대로 데이터가 오염된다.

## 기본 block rule

```text
IF source_order_status != confirmed
  THEN block_reason includes payment_status_not_confirmed

IF payment_method IN (vbank, virtual_account)
  AND paid_at is missing
  THEN block_reason includes unpaid_vbank_controlled_evidence
```

필수 출력값:

- `exclude_from_upload=true`
- `exclude_from_budget_roas=true`
- `send_candidate=false`
- `actual_send_candidate=false`
- `block_reason=unpaid_vbank_controlled_evidence`

## builder별 반영 설계

### ConfirmedPurchasePrep input builder

현재 `ConfirmedPurchasePrep` input builder는 결제완료 상태만 후보로 잡는다. 따라서 unpaid vbank row는 원칙적으로 input에 들어오지 않아야 한다.

추가 설계:

- 운영 PG/Imweb source에서 `payment_status != confirmed` 또는 `paid_at missing`이면 candidate 생성 전 제외한다.
- audit summary에는 제외 카운터를 별도 표시한다.
- 제외 row가 evidence 파일에만 존재하면 `evidence_only=true`로 남기고 `upload_candidate=false`로 둔다.

권장 block reason:

- `payment_status_not_confirmed`
- `unpaid_vbank_controlled_evidence`
- `missing_paid_at`

### Google Ads confirmed_purchase upload builder

현재 `google-ads-confirmed-purchase-candidate-prep.ts`는 `payment_status !== "confirmed"`이면 hard block을 건다. 이 정책은 유지한다.

추가 설계:

- `payment_status !== "confirmed"`이면 공통 `payment_status_not_confirmed`를 추가한다.
- `payment_method=vbank|virtual_account` 이고 `paid_at` 또는 `conversion_time`이 비어 있으면 `unpaid_vbank_controlled_evidence`를 추가한다.
- `unpaid_vbank_controlled_evidence`가 있으면 `would_be_google_ads_upload_candidate_after_approval=false`가 된다.

## send/upload 판정

| 상태 | bridge evidence 사용 | upload 후보 | ROAS 후보 | 이유 |
|---|---|---|---|---|
| 실제 광고 클릭 + 가상계좌 미입금 | YES | NO | NO | 클릭/주문 화면 연결은 증거지만 매출이 아님 |
| 실제 광고 클릭 + 결제완료 확인 | YES | HOLD | HOLD | test_order guard와 upload 승인 별도 필요 |
| TEST gclid preview | YES | NO | NO | 기술 검증용 |

## 성공 기준

- unpaid vbank evidence는 reliability confidence에는 남는다.
- Google Ads upload 후보는 0으로 유지된다.
- 내부 confirmed ROAS=실제 결제완료 주문 원장 기준값에는 포함되지 않는다.
- `send_candidate=false`, `actual_send_candidate=false`가 유지된다.

## Hard Fail

- `source_order_status != confirmed` row가 upload 후보에 들어감.
- `payment_method=vbank` + `paid_at missing` row가 confirmed_purchase 후보에 들어감.
- raw order/payment/email/phone/member_code가 repo artifact나 VM Cloud log에 남음.
- `send_candidate=true` 또는 `actual_send_candidate=true`가 생성됨.

## 다음 P0

1. `ConfirmedPurchasePrep` dry-run 출력에 status guard 카운터를 추가한다.
2. Google Ads upload builder block reason에 `payment_status_not_confirmed`와 `unpaid_vbank_controlled_evidence` alias를 추가할지 검토한다.
3. 실제 upload 승인 전에는 test evidence와 business confirmed candidate를 분리한 표를 만든다.
