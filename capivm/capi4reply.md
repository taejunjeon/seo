# 서버 상태 조회형 Purchase Guard 진행 결과 - 2026-04-12

## 결론

가상계좌 미입금 주문에서 아직 Browser Pixel `Purchase`가 보이는 문제는 문구 기반 Guard로 더 해결하지 않는다. `FB_PIXEL.Purchase`만 막는 방식도 부족할 수 있으므로, 서버 상태 조회형 Guard v2를 작성했고, 이후 `VirtualAccountIssued` 유실 방지를 위해 v3로 보강했다.

v3는 아래 두 경로를 모두 감싼다.

```text
1. window.FB_PIXEL.Purchase(...)
2. window.fbq('track', 'Purchase', ...)
```

즉 아임웹 기본 구매 추적이 `FB_PIXEL.Purchase`를 쓰든, 다른 스크립트가 직접 `fbq('track', 'Purchase')`를 호출하든, 주문완료 페이지에서는 먼저 서버 결제 상태를 조회한 뒤 `Purchase` 허용 여부를 결정한다.

## 개발 반영

### 1. 백엔드 CORS 보강

파일:

```text
/Users/vibetj/coding/seo/backend/src/bootstrap/configureMiddleware.ts
```

추가 허용 origin:

```text
https://m.biocom.kr
https://biocom.imweb.me
```

기존 `https://biocom.kr`, `https://www.biocom.kr`는 이미 허용돼 있었다.

### 2. payment-decision 응답 안정화

파일:

```text
/Users/vibetj/coding/seo/backend/src/routes/attribution.ts
```

추가/보강:

```text
Cache-Control: no-store
version: 2026-04-12.payment-decision.v1
generatedAt: ISO timestamp
```

이 endpoint는 계속 read-only다. DB를 쓰지 않고 주문 상태 판정만 반환한다.

### 3. 서버형 Guard v3 작성

파일:

```text
/Users/vibetj/coding/seo/footer/header_purchase_guard_server_decision_0412_v3.md
```

핵심 동작:

```text
주문완료 페이지에서 Purchase 시도 감지
-> order_no / order_code / payment_code 추출
-> https://att.ainativeos.net/api/attribution/payment-decision 조회
-> confirmed / allow_purchase면 기존 Purchase 통과
-> pending / block_purchase_virtual_account면 Purchase 차단 후 VirtualAccountIssued 전송
-> canceled면 PurchaseBlocked 전송
-> unknown이면 PurchaseDecisionUnknown 전송, Purchase는 보내지 않음
```

## 검증 결과

### 코드 검증

```text
node --check /tmp/biocom_server_payment_decision_guard_v3.js
성공
```

### 백엔드 타입체크

```text
cd backend && npm run typecheck
성공
```

### 백엔드 테스트

```text
cd backend && node --import tsx --test tests/attribution.test.ts
27개 테스트 전부 통과
```

### 로컬 endpoint CORS 검증

카드 결제 주문:

```text
GET http://localhost:7020/api/attribution/payment-decision?order_no=202604123633105&order_code=o20260411ffcf4b110f72e
Origin: https://biocom.kr

HTTP 200
Access-Control-Allow-Origin: https://biocom.kr
Cache-Control: no-store
decision.status: confirmed
decision.browserAction: allow_purchase
```

가상계좌 미입금 주문:

```text
GET http://localhost:7020/api/attribution/payment-decision?order_no=202604123890630&order_code=o20260411a9f1cba638b60
Origin: https://biocom.kr

HTTP 200
Access-Control-Allow-Origin: https://biocom.kr
Cache-Control: no-store
decision.status: pending
decision.browserAction: block_purchase_virtual_account
```

OPTIONS preflight:

```text
HTTP 204
Access-Control-Allow-Origin: https://biocom.kr
Access-Control-Allow-Methods: GET,HEAD,PUT,PATCH,POST,DELETE
```

### 공개 endpoint 현재 응답 확인

현재 아래 URL도 응답한다.

```text
https://att.ainativeos.net/api/attribution/payment-decision
```

카드 결제 주문:

```text
decision.status: confirmed
decision.browserAction: allow_purchase
```

가상계좌 미입금 주문:

```text
decision.status: pending
decision.browserAction: block_purchase_virtual_account
```

`https://m.biocom.kr` origin도 CORS 통과를 확인했다.

## 중요한 주의

`att.ainativeos.net`는 현재 응답하지만, 이게 노트북/터널에 의존하는 상태라면 안정 운영 endpoint로 보면 안 된다.

서버형 Guard v3는 endpoint가 `unknown` 또는 장애를 반환하면 `Purchase`를 보내지 않고 `PurchaseDecisionUnknown`만 보낸다. 이 정책은 Meta ROAS 과대 오염을 줄이는 데는 맞지만, endpoint가 꺼지면 카드 결제 Browser Purchase도 누락될 수 있다.

따라서 운영 최종 적용 순서는 아래가 안전하다.

```text
1. VM 또는 Cloud Run에 backend 안정 배포
2. payment-decision endpoint 정상 확인
3. 아임웹 헤더 상단에 server-decision Guard v3 삽입
4. 가상계좌 1건 / 카드 1건 테스트
```

단, 지금 당장 짧게 검증하려면 TJ님이 노트북과 backend가 켜져 있는 상태에서 v3를 헤더 상단에 넣고 테스트할 수는 있다. 이 경우는 운영 완료가 아니라 임시 검증이다.

## TJ님 다음 행동

### 권장 행동

먼저 VM 또는 안정 서버를 준비한다. 그 다음 아래 파일의 코드를 아임웹 헤더 상단에 넣는다.

```text
/Users/vibetj/coding/seo/footer/header_purchase_guard_server_decision_0412_v3.md
```

### 빠른 임시 테스트를 하고 싶을 때

노트북이 켜져 있고 backend/Cloudflare tunnel이 살아 있는 상태에서만 v3를 아임웹 헤더 상단에 넣는다.

그 뒤 테스트는 2개만 한다.

```text
1. 가상계좌 미입금 주문
   기대값: Purchase 없음, VirtualAccountIssued 있음

2. 카드 결제 완료 주문
   기대값: Purchase 있음, Event ID = Purchase.{order_code}
```

테스트 결과를 줄 때 필요한 정보:

```text
결제완료 URL
order_no
order_code
Pixel Helper 이벤트 목록
Purchase 또는 VirtualAccountIssued event_id
value / currency
```

## 현재 판단

이제 병목은 코드가 아니라 안정 endpoint다. 가상계좌 Purchase를 확실히 막으려면 브라우저 문구를 더 만지는 것보다 서버 상태 조회형 Guard를 운영 가능한 서버에 올리는 것이 맞다.

## 추가 라이브 테스트 - 가상계좌 미입금

테스트 시각:

```text
2026-04-12 KST
```

TJ님이 `header_purchase_guard_server_decision_0412_v2.md`를 아임웹 헤더 상단에 넣은 뒤 가상계좌 주문을 만들었다.

주문 정보:

```text
order_no: 202604129207048
order_code: o202604127f5916e6e071a
결제수단: 가상계좌
입금상태: 미입금
```

Pixel Helper에서 보인 이벤트:

```text
PageView
PageView https://biocom.kr/HealthFood/?idx=198
AddPaymentInfo https://biocom.kr/HealthFood/?idx=198
PageView https://biocom.kr/shop_payment/?order_code=o202604127f5916e6e071a&order_no=202604129207048&order_member=m2022021990714e913a3de
InitiateCheckout https://biocom.kr/shop_payment/?order_code=o202604127f5916e6e071a&order_no=202604129207048&order_member=m2022021990714e913a3de
ViewContent https://biocom.kr/HealthFood/?idx=198
PageView https://biocom.kr/HealthFood/?idx=198
PageView https://biocom.kr/supplements
PageView https://biocom.kr/index
PageView https://biocom.kr/index
```

중요 결과:

```text
Purchase 없음
```

서버 payment-decision 확인:

```text
GET https://att.ainativeos.net/api/attribution/payment-decision?order_no=202604129207048&order_code=o202604127f5916e6e071a&debug=1

decision.status: pending
decision.browserAction: block_purchase_virtual_account
decision.confidence: high
decision.matchedBy: toss_direct_order_id
reason: toss_direct_api_status
Toss orderId: 202604129207048-P1
Toss paymentKey: iw_bi20260412090746ujHC0
Toss status: WAITING_FOR_DEPOSIT
Toss channel: 가상계좌
```

판정:

```text
서버형 Guard v2는 이번 가상계좌 미입금 주문에서 Browser Purchase 차단에 성공했다.
```

남은 확인:

```text
카드 결제 완료 주문에서 Purchase가 정상 발화하는지 1건만 확인하면 된다.
기대값은 Purchase 있음, Event ID = Purchase.{order_code}다.
```

## 추가 보강 - VirtualAccountIssued 유실 방지 v3

위 테스트에서 `Purchase`는 사라졌지만 `VirtualAccountIssued`도 Pixel Helper에 보이지 않았다.

해석:

```text
ROAS 오염 차단 관점에서는 Purchase 없음이 핵심 성공이다.
하지만 퍼널 분석 관점에서는 VirtualAccountIssued가 반드시 남아야 한다.
```

가장 가능성 높은 원인:

```text
FB_PIXEL.Purchase는 먼저 차단됐지만, 차단 후 보내는 trackCustom('VirtualAccountIssued')가 Meta fbq 준비 전 타이밍에 호출되어 유실됐을 가능성.
```

조치:

```text
파일을 v3로 갱신:
/Users/vibetj/coding/seo/footer/header_purchase_guard_server_decision_0412_v3.md
```

v3 보강점:

```text
1. FB_PIXEL.Purchase와 fbq('track', 'Purchase')를 모두 감싼다.
2. pending 판정 후 VirtualAccountIssued를 fbq로 여러 번 준비 재시도한다.
3. 끝까지 fbq가 준비되지 않으면 facebook.com/tr 이미지 요청 fallback으로 VirtualAccountIssued를 보낸다.
4. 콘솔에 custom event sent 로그를 남긴다.
```

v3 문법 검증:

```text
node --check /tmp/biocom_server_payment_decision_guard_v3.js
성공
```

TJ님 다음 테스트:

```text
1. 아임웹 헤더 상단 코드를 header_purchase_guard_server_decision_0412_v3.md 내용으로 교체
2. 기존 가상계좌 주문완료 URL을 새 탭 또는 시크릿 창에서 다시 열기
   https://biocom.kr/shop_payment_complete?order_code=o202604127f5916e6e071a&payment_code=pa202604129d2239fbf49c2&order_no=202604129207048&rk=S
3. 기대값:
   - Purchase 없음
   - VirtualAccountIssued 있음
   - 콘솔에 custom event sent 로그 있음
4. 그 다음 카드 결제 1건 테스트
   - Purchase 있음
   - Event ID = Purchase.{order_code}
```
