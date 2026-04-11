# codefeedback_0412_4 검토 및 개발 결과 - 2026-04-12

## 결론

`codefeedback_0412_4.md`의 핵심 방향은 맞다.

브라우저 주문완료 페이지의 문구만 읽어서 `카드 confirmed / 가상계좌 pending`을 안정적으로 구분하는 방식은 여기서 중단하는 것이 맞다. v3는 가상계좌는 막았지만 카드도 막았고, v4는 카드 누락을 줄이려고 완화하면서 다시 가상계좌가 샐 수 있는 구조다.

따라서 다음 단계는 **서버 상태 조회형 Guard**다.

```text
브라우저 주문완료 URL의 order_no / order_code / payment_code
-> 우리 서버 payment-decision endpoint 조회
-> 서버가 Attribution ledger + Toss API 기준으로 confirmed/pending/canceled/unknown 판정
-> confirmed만 Browser Purchase 허용
-> pending은 VirtualAccountIssued
-> canceled/unknown은 Purchase 차단 또는 보류
```

## 상단 코드에 대한 내 의견

지금 상단 코드 방향은 이렇게 가는 것이 맞다.

1. **문구 기반 v3/v4 Guard를 더 튜닝하지 않는다.**

정규식이나 DOM 문구를 더 고쳐도 구조적으로 불안정하다. 우리가 알고 싶은 값은 “주문 상태”인데, 브라우저 화면 텍스트는 주문 상태의 정본이 아니다.

2. **현재 운영 상단 코드는 임시로만 판단한다.**

만약 현재 삽입된 v4가 실제 테스트에서 `카드=Purchase`, `가상계좌 미입금=VirtualAccountIssued`를 모두 만족하면 서버형 Guard 배포 전까지 임시 유지할 수 있다. 하지만 둘 중 하나라도 흔들리면 제거하거나 비활성화하는 것이 맞다.

3. **최종 상단 코드는 서버 decision endpoint가 안정 배포된 뒤 교체한다.**

서버형 상단 코드는 이미 초안으로 작성했다.

```text
/Users/vibetj/coding/seo/footer/header_purchase_guard_server_decision_0412.md
```

단, 이 코드는 지금 바로 아임웹에 넣으면 안 된다. `att.ainativeos.net`의 backend가 노트북/터널이 아니라 안정적인 VM 또는 Cloud Run에 올라간 뒤 적용해야 한다. endpoint가 죽으면 카드 Purchase도 막힐 수 있기 때문이다.

## 개발 반영

### 1. 서버 결제상태 판정 API 추가

파일:

```text
/Users/vibetj/coding/seo/backend/src/routes/attribution.ts
```

추가 endpoint:

```text
GET /api/attribution/payment-decision
```

입력 예시:

```text
/api/attribution/payment-decision?order_no=202604123633105&order_code=o20260411ffcf4b110f72e
```

지원 입력값:

```text
order_no
orderNo
order_id
orderId
order_code
orderCode
payment_code
paymentCode
payment_key
paymentKey
site/store
```

반환 핵심값:

```text
status: confirmed | pending | canceled | unknown
browserAction:
  - allow_purchase
  - block_purchase_virtual_account
  - block_purchase
  - hold_or_block_purchase
```

판정 정책:

| 결제 상태 | Browser Pixel 처리 |
|---|---|
| confirmed | `Purchase` 허용 |
| pending | `Purchase` 차단, `VirtualAccountIssued` 권장 |
| canceled | `Purchase` 차단 |
| unknown | `Purchase` 보류/차단 권장 |

### 2. 판정 근거 우선순위

현재 구현은 아래 순서로 본다.

```text
1. Toss 직접 API 조회
2. Toss 직접 조회가 order_no로 실패하면, Attribution ledger의 paymentKey를 찾아 Toss fallback 재조회
3. Attribution ledger의 paymentStatus
4. 그래도 없으면 unknown
```

중요한 발견:

아임웹 주문번호 `order_no`를 Toss `/v1/payments/orders/{orderId}`에 그대로 넣으면 404가 날 수 있다.

실제 Toss orderId는 아래처럼 상품 라인 suffix가 붙는다.

```text
아임웹 order_no: 202604123633105
Toss orderId: 202604123633105-P1
```

그래서 서버 endpoint는 ledger에 저장된 `paymentKey`를 fallback으로 사용하도록 보강했다. 이게 없으면 카드 confirmed도 Toss 직접 조회만으로는 놓칠 수 있다.

### 3. 서버형 상단 코드 초안 작성

파일:

```text
/Users/vibetj/coding/seo/footer/header_purchase_guard_server_decision_0412.md
```

동작:

```text
FB_PIXEL.Purchase 호출을 잠깐 보류
-> order_no/order_code/payment_code를 읽음
-> /api/attribution/payment-decision 조회
-> allow_purchase면 기존 Purchase 실행
-> pending이면 Purchase를 보내지 않고 VirtualAccountIssued 전송
-> canceled이면 PurchaseBlocked 전송
-> unknown이면 PurchaseDecisionUnknown 전송, Purchase는 보내지 않음
```

unknown을 보수적으로 막는 이유:

현재 문제의 핵심이 Meta ROAS 과대이기 때문이다. unknown을 Purchase로 통과시키면 가상계좌 pending 오염이 다시 생긴다. 다만 endpoint 장애 시 카드 Purchase도 누락될 수 있으므로, 안정 서버 배포 전에는 이 코드를 운영에 넣으면 안 된다.

## 로컬 검증 결과

### 1. 카드 결제 주문 판정

요청:

```text
GET http://localhost:7020/api/attribution/payment-decision?order_no=202604123633105&order_code=o20260411ffcf4b110f72e&debug=1
```

결과:

```text
status: confirmed
browserAction: allow_purchase
confidence: high
matchedBy: toss_direct_order_id
reason: toss_direct_api_status
Toss status: DONE
Toss channel: 카드
Toss orderId: 202604123633105-P1
paymentKey: iw_bi20260412021830zdpQ4
```

해석:

이 주문은 서버 기준 confirmed다. Browser `Purchase`를 허용해야 한다.

### 2. 가상계좌 미입금 주문 판정

요청:

```text
GET http://localhost:7020/api/attribution/payment-decision?order_no=202604123890630&order_code=o20260411a9f1cba638b60&debug=1
```

결과:

```text
status: pending
browserAction: block_purchase_virtual_account
confidence: high
matchedBy: toss_direct_order_id
reason: toss_direct_api_status
Toss status: WAITING_FOR_DEPOSIT
Toss channel: 가상계좌
Toss orderId: 202604123890630-P1
paymentKey: iw_bi20260412021242siOX1
```

해석:

이 주문은 서버 기준 pending이다. Browser `Purchase`를 보내면 안 되고 `VirtualAccountIssued`로 낮추는 것이 맞다.

### 3. 문법/테스트

상단 코드 문법 확인:

```text
node --check /tmp/biocom_server_payment_decision_guard.js
성공
```

백엔드 테스트:

```text
node --import tsx --test tests/attribution.test.ts
27개 테스트 전부 통과
```

타입체크:

```text
npm run typecheck
성공
```

## 성공 / 부분 해결 / 실패

### 성공

- 서버 결제 상태 판정 API를 로컬 백엔드에 추가했다.
- 카드 주문과 가상계좌 미입금 주문을 실제 로컬 데이터 + Toss API fallback으로 구분했다.
- `order_no` 직접 Toss 조회 404 문제를 ledger `paymentKey` fallback으로 보완했다.
- 서버형 상단 코드 초안을 작성했다.
- 테스트와 타입체크를 통과했다.

### 부분 해결

- 서버형 Guard는 코드 초안까지 작성했지만 운영 삽입은 아직 하면 안 된다.
- 이유는 backend가 안정적인 클라우드/VM에 올라가기 전까지 endpoint 장애가 곧 카드 Purchase 누락으로 이어질 수 있기 때문이다.

### 실패 또는 보류

- 브라우저 문구 기반 v3/v4 Guard의 추가 튜닝은 중단한다.
- 네이버페이 복귀/Pixel 미발화 문제는 별도 이슈다. Browser Pixel보다 서버 confirmed CAPI 중심으로 해결해야 한다.

## 다음 실행 순서

1. 현재 아임웹 상단 코드의 실제 상태를 한 번만 더 확인한다.

확인 기준:

```text
카드 결제 완료: Purchase
가상계좌 미입금: VirtualAccountIssued
```

2. 둘 다 만족하면 v4는 임시 유지한다.

단, 문서상 final이 아니라 “서버형 Guard 전까지 임시 방어”로만 본다.

3. 둘 중 하나라도 흔들리면 v4를 제거하거나 비활성화한다.

이 경우 Browser Purchase 오염은 남지만, 카드 confirmed 누락보다 해석이 쉽다. 운영 ROAS는 내부 confirmed 기준으로 본다.

4. 백엔드를 VM/Cloud Run으로 올린 뒤 서버형 Guard로 교체한다.

교체 후보:

```text
/Users/vibetj/coding/seo/footer/header_purchase_guard_server_decision_0412.md
```

5. 교체 후 같은 주문 흐름으로 재검증한다.

필수 검증:

```text
카드: decision=confirmed, browserAction=allow_purchase, Pixel Purchase
가상계좌 미입금: decision=pending, browserAction=block_purchase_virtual_account, Pixel VirtualAccountIssued
네이버페이: Browser 복귀 여부 확인, 안 되면 Server CAPI confirmed 기준으로 별도 처리
```
