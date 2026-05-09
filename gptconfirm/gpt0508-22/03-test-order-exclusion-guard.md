# Test order exclusion guard

작성 시각: 2026-05-10 01:18 KST

## 한 줄 결론

실제 광고 클릭/실제 결제 테스트를 하더라도 그 주문은 내부 confirmed_purchase, Google Ads upload, 예산 판단 ROAS에서 반드시 제외해야 한다.

## 왜 필요한가

실제 결제 테스트는 기존 live purchase tag, 주문 원장, 결제 원장에 흔적이 남을 수 있다. 이 주문이 내부 성과 판단이나 upload 후보에 섞이면 Google Ads ROAS 보정 목적과 반대로 데이터가 오염된다.

## Guard 필드

- `test_order=true`
- `exclude_from_upload=true`
- `exclude_from_budget_roas=true`
- `exclude_from_confirmed_purchase_send=true`
- `block_reason=controlled_real_paid_click_test`
- `qa_owner=TJ`
- `refund_or_cancel_status=pending|refunded|cancelled|kept`
- `send_candidate=false`
- `actual_send_candidate=false`

## 적용 위치

### 문서/결과보고

- gptconfirm 결과보고서에 raw order number를 남기지 않는다.
- 필요하면 order hash prefix 또는 별도 로컬 임시 메모만 사용한다.

### reliability dry-run

- test evidence는 `A_CONTROLLED` 또는 `REAL_TEST_HOLD`로 분리한다.
- 실제 upload 후보에는 절대 넣지 않는다.
- budget ROAS 계산에서 제외한다.

### Google Ads upload 준비

- `exclude_from_upload=true`면 upload input builder가 block한다.
- block reason을 결과에 표시한다.

## Success Criteria

- test order가 upload 후보 0건으로 남는다.
- 내부 confirmed ROAS 계산에서 제외된다.
- refund/cancel status가 기록된다.
- raw email/phone/order/payment가 repo artifact에 남지 않는다.

## Hard Fail

- test order가 Google Ads upload 후보에 포함.
- test order가 예산 판단 ROAS에 포함.
- raw order number/payment key가 repo 문서나 VM Cloud log에 남음.
- send_candidate=true.

