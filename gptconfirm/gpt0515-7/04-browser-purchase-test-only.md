# Browser Purchase Test-Only And Fast Restore Plan

작성 시각: 2026-05-15 03:31 KST

## 현재 Purchase 구조

live Header의 Purchase Guard는 완료 URL에서만 작동한다.

동작:

1. 아임웹/FBE/native가 Purchase를 시도한다.
2. Guard가 시도를 가로챈다.
3. VM Cloud `payment-decision`을 read-only 조회한다.
4. `allow_purchase`이면 원래 Purchase를 통과시킨다.
5. `pending`이면 `VirtualAccountIssued`로 낮춘다.
6. `unknown/canceled`이면 Purchase를 보내지 않고 `PurchaseDecisionUnknown` 또는 `PurchaseBlocked`로 낮춘다.

따라서 `PurchaseDecisionUnknown`이 보이면 “Purchase 시도는 있었지만 서버가 확정 구매라고 못 닫아서 막은 것”이다.

## 가장 빠른 복구 순서

### 1. VM Cloud backend guard/value guard 배포

목적: `/shop_payment/` artifact를 서버에서 막고, Purchase를 좁게 열 준비를 한다.

이 작업은 Meta send가 아니다. Yellow 승인 후 진행한다.

### 2. `payment-decision` confirmed match 강화

목적: 실제 결제완료 주문이 `allow_purchase`를 빨리 받게 한다.

source priority:

1. 운영DB `dashboard.public.tb_iamweb_users` `PAYMENT_COMPLETE`.
2. Imweb v2 direct confirmed.
3. fresh VM Cloud SQLite cache.
4. Toss direct status.
5. footer payment signal 단독은 confirmed 금지.

성공 기준:

- completion URL에서 실제 결제완료는 `allow_purchase`.
- 미입금/가상계좌/unknown은 Purchase 없음.
- value guard mismatch는 no-send/no-fire.

### 3. 좁은 fail-open은 별도 승인 후보

정말 빠르게 살려야 하면 아래 조건에서만 browser Purchase를 허용하는 후보를 검토할 수 있다.

- completion URL allowlist.
- `/shop_payment/` progress URL 아님.
- order key present.
- value present.
- selected payment method가 card 또는 confirmed payment method.
- virtual_account/bank_transfer evidence 없음.
- eventID dedupe present.
- value guard marker present.
- Meta CAPI server send는 여전히 별도 Red 승인 전 금지.

이 안은 빠르지만, 결제상태 source가 늦을 때 브라우저가 먼저 매출을 보낼 수 있어 리스크가 있다. 현재 추천은 `payment-decision confirmed match 강화`가 먼저다.

## test-only 계획

운영 Purchase count를 늘리지 않는 테스트만 허용한다.

- preview-only route.
- browser Purchase 1건 이하.
- server CAPI test Purchase 1건 이하.
- 동일 eventID/event_id.
- Meta Test Events test_event_code 필수.
- 운영 checkout/payment page에서 Purchase 발화 금지.
- 운영 Purchase count delta 0.

## 테스트를 줄이는 방식

TJ님이 테스트를 많이 하지 않으려면, 실제 주문 테스트를 반복하지 않고 다음 순서로 줄인다.

1. VM Cloud read-only로 `payment-decision`이 confirmed를 주는지 먼저 확인.
2. 확인된 1건만 browser test-only 또는 다음 자연 발생 결제에서 Network monitor.
3. AddToCart/InitiateCheckout/AddPaymentInfo는 Purchase와 분리해 Block 4만 확인.

## 현재 추천

- Purchase 운영 복구: `payment-decision confirmed match 강화` 우선.
- Purchase fail-open: 보류, emergency 후보.
- Browser Purchase test-only: 아직 필요하지만 1회 이하로 제한.
