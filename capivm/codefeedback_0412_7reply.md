# codefeedback_0412_7 결과 보고

작성 시각: 2026-04-12 KST

## 결론

피드백대로 새 v4/v5를 만들지 않고, 현재 `server-payment-decision-guard-v3` 안에서만 수정했다.

현재 문제는 아래처럼 좁혀져 있다.

```text
가상계좌 pending 판정: 통과
Browser Purchase 차단: 통과
VirtualAccountIssued fbq 호출: 통과
VirtualAccountIssued Network 관측: 통과
카드 confirmed Purchase 원본 호출: 통과
카드 confirmed Purchase Network 관측: image fallback으로 통과
```

따라서 이번 수정은 2단계로 진행됐다.

```text
1차:
custom_event_sent method=fbq 이후
custom_event_network_observed found=no matchCount=0이면
같은 eventId로 image fallback을 1회만 추가 전송

2차:
카드 confirmed allow_purchase 이후에도 ev=Purchase가 없으면
같은 eventId로 facebook.com/tr image fallback을 1회만 추가 전송
```

최종 확인:

```text
카드 confirmed: ev=Purchase, eid=Purchase.{order_code}, Status 200 OK 확인
가상계좌 pending: ev=Purchase 없음, ev=VirtualAccountIssued 확인
```

## 수정 파일

```text
footer/header_purchase_guard_server_decision_0412_v3.md
```

새 버전 파일을 만들지 않고 기존 v3 문서와 코드만 갱신했다.

## 반영 내용

추가한 동작:

```text
fbq 전송 후 1.5초 뒤 performance resource entry에서
facebook.com/tr + eventName + eventId 조합을 찾는다.
```

찾은 경우:

```text
custom_event_network_observed ... found=yes matchCount=1
```

찾지 못한 경우:

```text
custom_event_network_observed ... found=no matchCount=0
custom_event_network_missing_fallback_start ... method=image_fallback_after_observe_no
custom_event_sent ... method=image_fallback_after_observe_no
```

중복 방지:

```text
fallbackAfterObserveNoEventIds[eventId]
```

이 in-memory map으로 같은 페이지 라이프사이클에서 같은 `eventId` fallback은 1회만 허용한다.

## 왜 이 방식이 맞는가

`VirtualAccountIssued`는 매출 확정 이벤트가 아니다. 즉 `Purchase`처럼 Meta ROAS를 직접 부풀리는 이벤트가 아니다.

반면 지금 반드시 필요한 것은 아래다.

```text
가상계좌 미입금 주문이 Purchase로 잡히지 않게 막고,
대체 신호는 Meta에 실제로 남긴다.
```

`fbq` 호출은 됐지만 Network 관측이 안 되는 상황에서는 같은 `eventId`로 image fallback을 1회 보강하는 것이 가장 좁고 안전한 수정이다.

## 다음 가상계좌 테스트 기대 로그

가상계좌 미입금 주문완료에서는 아래 흐름이 나와야 한다.

```text
[biocom-server-payment-decision-guard] decision branch=block_purchase_virtual_account status=pending ...
```

```text
[biocom-server-payment-decision-guard] custom_event_prepare eventName=VirtualAccountIssued eventId=VirtualAccountIssued.o...
```

```text
[biocom-server-payment-decision-guard] custom_event_dispatch_start eventName=VirtualAccountIssued eventId=VirtualAccountIssued.o... methodCandidate=fbq ...
```

```text
[biocom-server-payment-decision-guard] custom_event_sent eventName=VirtualAccountIssued eventId=VirtualAccountIssued.o... method=fbq ...
```

그 다음 둘 중 하나다.

성공 케이스 A: fbq 요청이 performance에서 관측됨

```text
[biocom-server-payment-decision-guard] custom_event_network_observed eventName=VirtualAccountIssued eventId=VirtualAccountIssued.o... found=yes matchCount=1 ...
```

성공 케이스 B: fbq 요청이 performance에서 안 보였고 fallback이 1회 보강됨

```text
[biocom-server-payment-decision-guard] custom_event_network_observed eventName=VirtualAccountIssued eventId=VirtualAccountIssued.o... found=no matchCount=0 ...
```

```text
[biocom-server-payment-decision-guard] custom_event_network_missing_fallback_start eventName=VirtualAccountIssued eventId=VirtualAccountIssued.o... method=image_fallback_after_observe_no ...
```

```text
[biocom-server-payment-decision-guard] custom_event_sent eventName=VirtualAccountIssued eventId=VirtualAccountIssued.o... method=image_fallback_after_observe_no ...
```

## Network에서 찾아야 할 값

Chrome DevTools Network에서 `facebook.com/tr` 요청을 찾고 Query String Parameters에서 아래를 확인한다.

```text
ev=VirtualAccountIssued
```

```text
eid=VirtualAccountIssued.o{order_code}
```

예시:

```text
ev=VirtualAccountIssued
eid=VirtualAccountIssued.o2026041222e4335a04244
```

custom data 예시:

```text
cd[order_code]=o2026041222e4335a04244
cd[order_no]=...
cd[payment_code]=...
cd[payment_decision_status]=pending
cd[payment_decision_reason]=toss_direct_api_status
```

## 카드 결제 테스트 기대 로그

카드 결제 완료에서는 아래처럼 나와야 한다.

```text
[biocom-server-payment-decision-guard] decision branch=allow_purchase status=confirmed ...
```

그리고 Pixel Helper 또는 Network에 `Purchase`가 보여야 한다.

```text
ev=Purchase
eid=Purchase.o{order_code}
```

카드 결제에서는 아래 로그가 나오면 안 된다.

```text
custom_event_prepare eventName=VirtualAccountIssued
custom_event_sent eventName=VirtualAccountIssued
image_fallback_after_observe_no
```

즉 카드 결제가 `VirtualAccountIssued`로 내려가면 회귀다.

## 재테스트 범위

필수 2건만 보면 된다.

1. 가상계좌 미입금

```text
Purchase 없음
VirtualAccountIssued 있음
method=fbq 또는 image_fallback_after_observe_no
Network에 ev=VirtualAccountIssued 확인
```

2. 카드 결제 완료

```text
Purchase 있음
Event ID = Purchase.{order_code}
VirtualAccountIssued 없음
```

## Pixel Helper에 계속 안 보일 경우

Pixel Helper에 `VirtualAccountIssued`가 안 보여도 Network에 아래가 있으면 통과로 본다.

```text
facebook.com/tr
ev=VirtualAccountIssued
eid=VirtualAccountIssued.o...
```

이유:

- Pixel Helper는 관측 보조 도구다.
- 현재 페이지에는 `Multiple pixels with conflicting versions` 경고가 있어 Helper 표시가 불안정할 수 있다.
- 실제 전송 여부는 Network 요청과 Events Manager 수신이 더 강한 증거다.

## 검증

수행:

```text
node --check /tmp/biocom_server_payment_decision_guard_v3.js
git diff --check -- footer/header_purchase_guard_server_decision_0412_v3.md
```

결과:

```text
통과
```

## 2026-04-12 최종 테스트 - 카드/가상계좌 핵심 흐름 통과

TJ님이 image fallback 방식으로 바꾼 v3 코드를 아임웹 헤더 상단에 다시 반영한 뒤 카드 결제와 가상계좌 주문을 각각 테스트했다.

### 카드 결제 confirmed 테스트

주문:

```text
order_code=o2026041258d9051379e47
order_id=202604127697550-P1
order_no=202604127697550
payment_code=pa2026041212316cefc7e1c
amount=39000
```

콘솔 흐름:

```text
decision branch=allow_purchase status=confirmed reason=toss_direct_api_status matchedBy=toss_direct_payment_key
purchase_dispatch_start eventId=Purchase.o2026041258d9051379e47
dispatchPurchaseTrack : 39000 , KRW
purchase_dispatch_complete eventId=Purchase.o2026041258d9051379e47
purchase_network_observed found=no matchCount=0 eventOnlyCount=0
purchase_network_missing_fallback_start method=image_fallback_after_original_no_network
purchase_fallback_sent method=image_fallback_after_original_no_network value=39000 currency=KRW
```

Network 확인:

```text
Request URL=https://www.facebook.com/tr/?id=1283400029487161&ev=Purchase...
Status Code=200 OK
eid=Purchase.o2026041258d9051379e47
fbp=fb.1.1775926421386.30431049755970837
cd[value]=39000
cd[currency]=KRW
cd[order_code]=o2026041258d9051379e47
cd[order_id]=202604127697550-P1
cd[order_no]=202604127697550
cd[payment_code]=pa2026041212316cefc7e1c
cd[payment_decision_status]=confirmed
cd[payment_decision_reason]=toss_direct_api_status
```

Pixel Helper 확인:

```text
Purchase Active
Event ID=Purchase.o2026041258d9051379e47
payment_decision_status=confirmed
payment_decision_reason=toss_direct_api_status
value=39000
currency=KRW
```

판정:

```text
카드 confirmed 주문의 Browser Purchase 보장: 통과
```

### 가상계좌 pending 테스트

주문:

```text
order_code=o20260412cdb6664e94ccb
order_id=202604126682764-P1
order_no=202604126682764
payment_code=pa20260412ae31f94d1edab
amount=35000
```

Pixel Helper 확인:

```text
VirtualAccountIssued Active
Event ID=VirtualAccountIssued.o20260412cdb6664e94ccb
original_purchase_event_id=Purchase.o20260412cdb6664e94ccb
payment_decision_status=pending
payment_decision_reason=toss_direct_api_status
value=35000
currency=KRW
```

Network 확인:

```text
Request URL=https://www.facebook.com/tr/?id=1283400029487161&ev=VirtualAccountIssued...
eid=VirtualAccountIssued.o20260412cdb6664e94ccb
fbp=fb.1.1775926421386.30431049755970837
cd[payment_decision_status]=pending
cd[payment_decision_reason]=toss_direct_api_status
```

판정:

```text
가상계좌 pending 주문의 Browser Purchase 차단 및 VirtualAccountIssued 대체 전송: 통과
```

### 현재 최종 판정

핵심 목표는 통과했다.

```text
가상계좌 미입금: Meta Purchase로 잡히지 않게 차단
가상계좌 미입금: VirtualAccountIssued로 별도 기록
카드 결제 완료: Meta Purchase로 기록
카드/가상계좌 모두 결제 상태를 Toss direct API 기준으로 판정
event_id: Purchase.{order_code} / VirtualAccountIssued.{order_code}로 안정화
```

### 남은 리스크

아래는 별도 후속 과제다.

```text
1. 페이지에는 여전히 Multiple pixels with conflicting versions 경고가 있다.
2. 현재 카드 Purchase는 원본 FB_PIXEL.Purchase가 아니라 image fallback으로 보장된다.
3. decision endpoint가 불안정하면 카드 Purchase가 PurchaseDecisionUnknown으로 내려갈 수 있다.
4. CAPI 서버 전송과 Browser Purchase의 event_id dedup은 운영 auto-sync 후 별도 확인해야 한다.
```

### 다음 액션

바로 다음 작업은 코드 추가가 아니라 운영 안정화다.

```text
1. 현재 v3 헤더 상단 코드를 유지한다.
2. 가상계좌 1건, 카드 1건은 더 이상 반복 테스트하지 않아도 된다.
3. 다음 auto-sync 이후 CAPI 서버 Purchase가 같은 event_id=Purchase.{order_code}로 나가는지 확인한다.
4. decision endpoint를 노트북/터널 의존이 아닌 안정 서버로 올리는 작업을 진행한다.
```

## 2026-04-12 추가 테스트 6 - raw fbq fallback도 Network 미생성

TJ님이 수정 코드 반영 후 카드 결제를 다시 테스트했다.

테스트 주문:

```text
order_code=o20260412f3bac7fa4fe2d
order_id=202604123064572-P1
order_no=202604123064572
payment_code=pa2026041293f381dd68498
amount=12900
```

주문완료 URL:

```text
https://biocom.kr/shop_payment_complete?order_code=o20260412f3bac7fa4fe2d&payment_code=pa2026041293f381dd68498&order_no=202604123064572&rk=S
```

콘솔 결과:

```text
decision branch=allow_purchase status=confirmed reason=toss_direct_api_status matchedBy=toss_direct_payment_key
purchase_dispatch_start eventId=Purchase.o20260412f3bac7fa4fe2d
dispatchPurchaseTrack : 12900 , KRW
purchase_dispatch_complete eventId=Purchase.o20260412f3bac7fa4fe2d
purchase_network_observed found=no matchCount=0 eventOnlyCount=0
purchase_network_missing_fallback_start method=raw_fbq_after_observe_no
purchase_fallback_sent method=raw_fbq_after_observe_no
```

Chrome Network 필터:

```text
ev=Purchase -> 0건
```

판정:

```text
raw fbq('track','Purchase') 호출도 현재 페이지에서는 실제 facebook.com/tr 요청을 만들지 못한다.
```

중요한 점:

```text
purchase_fallback_sent method=raw_fbq_after_observe_no
```

이 로그는 함수 호출이 성공했다는 뜻이지, Meta 네트워크 요청이 실제 발생했다는 뜻은 아니다.

### 추가 반영

카드 confirmed fallback 방식을 raw `fbq`에서 직접 image fallback으로 바꿨다.

변경 전:

```text
원본 FB_PIXEL.Purchase 미전송 -> raw fbq('track','Purchase') fallback
```

변경 후:

```text
원본 FB_PIXEL.Purchase 미전송 -> facebook.com/tr image fallback
```

새 기대 로그:

```text
purchase_network_missing_fallback_start eventName=Purchase eventId=Purchase.o... method=image_fallback_after_original_no_network
purchase_fallback_sent eventName=Purchase eventId=Purchase.o... method=image_fallback_after_original_no_network
```

Network 기대값:

```text
ev=Purchase
eid=Purchase.o{order_code}
```

추가 보강:

```text
image fallback URL에 _fbp, _fbc 쿠키가 있으면 fbp, fbc 파라미터로 같이 보낸다.
```

이유:

```text
직접 image fallback은 fbq 내부 wrapper를 우회하므로 현재 Multiple pixels/conflicting versions 상태의 영향을 덜 받는다.
fbp/fbc를 같이 보내면 광고 클릭 식별 연결 가능성이 올라간다.
```

### 다음 테스트 기준

카드 결제 1건:

```text
decision branch=allow_purchase status=confirmed
purchase_network_missing_fallback_start ... method=image_fallback_after_original_no_network
purchase_fallback_sent ... method=image_fallback_after_original_no_network
Network: ev=Purchase 존재
Network: eid=Purchase.o{order_code} 존재
```

가상계좌 1건:

```text
decision branch=block_purchase_virtual_account status=pending
Network: ev=Purchase 없음
Network: ev=VirtualAccountIssued 있음
```

### 검증

수행:

```text
awk '/^<script>/{flag=1; next} /^<\/script>/{flag=0} flag {print}' footer/header_purchase_guard_server_decision_0412_v3.md > /tmp/biocom_server_payment_decision_guard_v3.js
node --check /tmp/biocom_server_payment_decision_guard_v3.js
```

결과:

```text
통과
```

## 현재 판단

이번 수정 후 기대하는 최종 상태:

```text
가상계좌 pending Purchase 차단: 90%
VirtualAccountIssued 실제 Meta 전송 확보: 재테스트 후 확인
카드 결제 Purchase 유지: 재테스트 필요
```

다음 테스트에서 가상계좌는 `image_fallback_after_observe_no`로라도 `ev=VirtualAccountIssued`가 Network에 보이고, 카드 결제는 `Purchase`가 유지되면 이 작업은 실전 통과로 봐도 된다.

## 2026-04-12 추가 테스트 현재 상태

TJ님이 보강된 v3 헤더 코드를 아임웹 헤더 상단에 넣고 가상계좌 주문을 다시 테스트했다.

테스트 주문:

```text
order_code=o20260412949cc26ffa04a
order_no=202604128681867
payment_code=pa20260412c62a5327ebf50
payment_key=iw_bi20260412105157w4rE0
amount=35000
```

주문완료 URL:

```text
https://biocom.kr/shop_payment_complete?order_code=o20260412949cc26ffa04a&payment_code=pa20260412c62a5327ebf50&order_no=202604128681867&rk=S
```

### 브라우저 관찰 결과

Pixel Helper에는 `Purchase`가 뜨지 않았다.

대신 아래 custom event가 떴다.

```text
PurchaseDecisionUnknown
```

Pixel Helper 상세:

```text
event=PurchaseDecisionUnknown
eventId=PurchaseDecisionUnknown.o20260412949cc26ffa04a
value=35000
currency=KRW
order_code=o20260412949cc26ffa04a
order_no=202604128681867
payment_code=pa20260412c62a5327ebf50
payment_decision_status=unknown
payment_decision_reason=no_toss_or_ledger_match
snippet_version=2026-04-12-server-payment-decision-guard-v3
```

Network에서도 아래 요청이 확인됐다.

```text
facebook.com/tr
ev=PurchaseDecisionUnknown
eid=PurchaseDecisionUnknown.o20260412949cc26ffa04a
status=200
```

즉 이번 테스트에서 확인된 것은 아래다.

```text
Browser Purchase 차단: 성공
fallback_after_observe_no 전송: 성공
Pixel Helper 표시: 성공
Network 전송: 성공
정확한 이벤트 분류(VirtualAccountIssued): 실패
```

### 콘솔 로그 요약

주문완료 직후 브라우저 decision:

```text
decision branch=hold_or_block_purchase
status=unknown
reason=no_toss_or_ledger_match
matchedBy=none
confidence=low
```

그 결과 v3 가드는 `VirtualAccountIssued`가 아니라 `PurchaseDecisionUnknown`을 보냈다.

```text
custom_event_prepare eventName=PurchaseDecisionUnknown
custom_event_sent eventName=PurchaseDecisionUnknown method=fbq
custom_event_network_observed found=no matchCount=0
custom_event_network_missing_fallback_start method=image_fallback_after_observe_no
custom_event_sent eventName=PurchaseDecisionUnknown method=image_fallback_after_observe_no
```

이 로그는 fallback 보강이 의도대로 동작했다는 증거다.

### 사후 서버 decision 확인

같은 주문을 테스트 이후 서버에서 다시 조회하니 정상적으로 pending 가상계좌로 잡혔다.

조회:

```text
GET /api/attribution/payment-decision
order_no=202604128681867
order_code=o20260412949cc26ffa04a
payment_code=pa20260412c62a5327ebf50
debug=1
```

응답 요약:

```json
{
  "decision": {
    "status": "pending",
    "browserAction": "block_purchase_virtual_account",
    "confidence": "high",
    "matchedBy": "toss_direct_order_id",
    "reason": "toss_direct_api_status"
  },
  "debug": {
    "matched": {
      "source": "toss_direct_api",
      "orderId": "202604128681867-P1",
      "paymentKey": "iw_bi20260412105157w4rE0",
      "status": "WAITING_FOR_DEPOSIT",
      "approvedAt": "",
      "channel": "가상계좌",
      "store": "biocom"
    }
  }
}
```

한국시간 기준 조회 시각:

```text
2026-04-12 10:55 KST 전후
```

### 현재 해석

이번 테스트는 대체 이벤트 dispatch 문제가 아니다.

`PurchaseDecisionUnknown`이 Pixel Helper와 Network에 실제로 보였기 때문에, 아래는 통과로 본다.

```text
fbq custom event 호출
performance 관측 실패 시 image fallback 1회 보강
facebook.com/tr 실제 전송
Pixel Helper custom event 표시
```

남은 문제는 decision 정확도다.

주문완료 직후에는 endpoint가 `no_toss_or_ledger_match`를 반환했지만, 사후 조회에서는 같은 주문이 `WAITING_FOR_DEPOSIT / 가상계좌`로 정상 매칭됐다.

가능성이 높은 원인:

```text
1. 주문완료 페이지 진입 직후 Toss 조회 가능 시점보다 decision 요청이 빨랐다.
2. 완료 페이지 URL에는 order_no/order_code/payment_code만 있고, 실제 Toss 매칭에 가장 강한 paymentKey는 referrer에만 있었다.
3. 현재 헤더 코드 context는 referrer의 orderId/paymentKey를 decision endpoint로 넘기지 않는다.
```

참고로 이번 주문의 referrer URL에는 아래 값이 있었다.

```text
orderId=202604128681867-P1
paymentKey=iw_bi20260412105157w4rE0
amount=35000
```

이 값들을 헤더 코드가 decision endpoint에 같이 넘기면 주문완료 직후 매칭 성공률이 올라갈 가능성이 높다.

### 현재 완료도 업데이트

```text
가상계좌 Purchase 차단: 95%
custom event 전송 보강: 95%
Pixel Helper/Network 관측: 90%
가상계좌를 VirtualAccountIssued로 정확 분류: 60%
카드 결제 Purchase 유지: 별도 재검증 필요
```

### 다음 개발 액션

이제 fallback 로직은 더 건드리지 않는다.

다음 수정은 decision 입력 식별자 보강이 맞다.

구체적으로:

```text
1. 헤더 코드 buildContext에서 document.referrer의 orderId, paymentKey도 추출한다.
2. buildDecisionUrl에서 order_id 또는 orderId, payment_key 또는 paymentKey를 endpoint로 같이 보낸다.
3. payment-decision이 unknown/no_toss_or_ledger_match를 반환하면 바로 PurchaseDecisionUnknown을 보내지 말고 짧게 1회 재조회한다.
4. 재조회 후 pending이면 VirtualAccountIssued, 그래도 unknown이면 PurchaseDecisionUnknown으로 보낸다.
```

이 방식이면 이번처럼 주문완료 직후에는 unknown이었다가 몇 초 뒤 pending으로 잡히는 케이스를 줄일 수 있다.

### 다음 테스트 기준

다음 가상계좌 테스트에서 기대하는 최종 로그:

```text
decision branch=block_purchase_virtual_account status=pending reason=toss_direct_api_status matchedBy=toss_direct_order_id
custom_event_prepare eventName=VirtualAccountIssued
custom_event_sent eventName=VirtualAccountIssued method=fbq 또는 image_fallback_after_observe_no
```

Network 또는 Pixel Helper 기대값:

```text
ev=VirtualAccountIssued
eid=VirtualAccountIssued.o{order_code}
```

나오면 안 되는 값:

```text
ev=Purchase
ev=PurchaseDecisionUnknown
```

이번 테스트에서 `PurchaseDecisionUnknown`이 뜬 것은 매출 오염 방지 관점에서는 안전하지만, 운영 분석 관점에서는 아직 최종 통과가 아니다.

## 추가 개발 반영 - referrer 식별자 + unknown 1회 재조회

위 현재 상태에 따라 fallback 로직은 더 건드리지 않고, decision 입력 식별자를 보강했다.

수정 파일:

```text
footer/header_purchase_guard_server_decision_0412_v3.md
```

반영 내용:

```text
1. document.referrer에서 orderId를 추출한다.
2. document.referrer에서 paymentKey를 추출한다.
3. decision endpoint 요청에 order_id와 payment_key를 함께 보낸다.
4. payment-decision 결과가 unknown/no_toss_or_ledger_match이면 900ms 뒤 1회 재조회한다.
5. 재조회 결과가 pending이면 VirtualAccountIssued로 보내고, 그래도 unknown이면 PurchaseDecisionUnknown으로 보낸다.
```

추가된 context:

```text
orderId
paymentKey
```

decision endpoint로 추가 전송되는 query parameter:

```text
order_id={referrer의 orderId}
payment_key={referrer의 paymentKey}
```

주의:

```text
paymentKey는 우리 decision endpoint로만 보낸다.
Meta custom event payload에는 paymentKey를 싣지 않는다.
```

Meta custom event payload에는 분석에 필요한 `order_id`만 추가했다.

```text
cd[order_id]=202604128681867-P1
```

### 왜 이 수정이 필요한가

이번 실패 주문의 완료 페이지 URL에는 아래 값만 있었다.

```text
order_code=o20260412949cc26ffa04a
order_no=202604128681867
payment_code=pa20260412c62a5327ebf50
```

하지만 결제 직후 referrer에는 더 강한 식별자가 있었다.

```text
orderId=202604128681867-P1
paymentKey=iw_bi20260412105157w4rE0
```

사후 조회에서 `order_id=202604128681867-P1`를 넣으면 서버는 즉시 pending 가상계좌로 매칭했다.

확인 결과:

```json
{
  "decision": {
    "status": "pending",
    "browserAction": "block_purchase_virtual_account",
    "confidence": "high",
    "matchedBy": "toss_direct_order_id",
    "reason": "toss_direct_api_status"
  },
  "directToss": {
    "attempted": true,
    "matchedRows": 1,
    "errors": 0
  },
  "debug": {
    "matched": {
      "source": "toss_direct_api",
      "orderId": "202604128681867-P1",
      "paymentKey": "iw_bi20260412105157w4rE0",
      "status": "WAITING_FOR_DEPOSIT",
      "approvedAt": "",
      "channel": "가상계좌",
      "store": "biocom"
    }
  }
}
```

따라서 다음 테스트에서는 주문완료 직후에도 `no_toss_or_ledger_match`가 아니라 `toss_direct_order_id`로 잡힐 가능성이 높아졌다.

### 추가된 로그

unknown 재조회가 필요한 경우:

```text
decision_retry_scheduled reason=no_toss_or_ledger_match retryDelayMs=900 orderCode=o... orderId=... orderNo=... paymentCode=... paymentKeyPresent=yes
```

재조회 결과:

```text
decision_retry_result branch=block_purchase_virtual_account status=pending reason=toss_direct_api_status matchedBy=toss_direct_order_id ...
```

최종 기대 로그:

```text
decision branch=block_purchase_virtual_account status=pending reason=toss_direct_api_status matchedBy=toss_direct_order_id orderId=202604128681867-P1 paymentKeyPresent=yes
```

그 다음:

```text
custom_event_prepare eventName=VirtualAccountIssued ...
custom_event_sent eventName=VirtualAccountIssued method=fbq 또는 image_fallback_after_observe_no ...
```

나오면 안 되는 값:

```text
eventName=PurchaseDecisionUnknown
payment_decision_reason=no_toss_or_ledger_match
```

### 검증

수행:

```text
node --check /tmp/biocom_server_payment_decision_guard_v3.js
git diff --check -- footer/header_purchase_guard_server_decision_0412_v3.md
```

결과:

```text
통과
```

endpoint 확인:

```text
order_id=202604128681867-P1
order_no=202604128681867
order_code=o20260412949cc26ffa04a
payment_code=pa20260412c62a5327ebf50
```

결과:

```text
pending / block_purchase_virtual_account / toss_direct_order_id / WAITING_FOR_DEPOSIT
```

### 다음 테스트 기준

가상계좌 미입금 주문완료:

```text
Purchase 없음
PurchaseDecisionUnknown 없음
VirtualAccountIssued 있음
payment_decision_status=pending
payment_decision_reason=toss_direct_api_status
```

카드 결제 완료:

```text
Purchase 있음
Event ID = Purchase.{order_code}
VirtualAccountIssued 없음
PurchaseDecisionUnknown 없음
```

## 2026-04-12 추가 테스트 2 - 가상계좌 통과

referrer 식별자 보강 후 TJ님이 가상계좌 주문을 다시 테스트했다.

테스트 주문:

```text
order_code=o20260412026d5980d85c9
order_id=202604123680489-P1
order_no=202604123680489
payment_code=pa202604120538e84777024
payment_key=iw_bi20260412110357qYmu4
amount=35000
```

서버 decision:

```text
branch=block_purchase_virtual_account
status=pending
reason=toss_direct_api_status
matchedBy=toss_direct_payment_key
confidence=high
paymentKeyPresent=yes
```

Pixel Helper 결과:

```text
VirtualAccountIssued
Active
```

Pixel Helper 상세:

```text
event=VirtualAccountIssued
eventId=VirtualAccountIssued.o20260412026d5980d85c9
value=35000
currency=KRW
order_code=o20260412026d5980d85c9
order_id=202604123680489-P1
order_no=202604123680489
payment_code=pa202604120538e84777024
original_purchase_event_id=Purchase.o20260412026d5980d85c9
payment_decision_status=pending
payment_decision_reason=toss_direct_api_status
snippet_version=2026-04-12-server-payment-decision-guard-v3
```

Network 확인:

```text
facebook.com/tr
ev=VirtualAccountIssued
eid=VirtualAccountIssued.o20260412026d5980d85c9
status=200
```

콘솔 핵심 로그:

```text
decision branch=block_purchase_virtual_account status=pending reason=toss_direct_api_status matchedBy=toss_direct_payment_key confidence=high source=FB_PIXEL.Purchase eventId=Purchase.o20260412026d5980d85c9 orderCode=o20260412026d5980d85c9 orderId=202604123680489-P1 orderNo=202604123680489 paymentCode=pa202604120538e84777024 paymentKeyPresent=yes
```

```text
custom_event_prepare eventName=VirtualAccountIssued eventId=VirtualAccountIssued.o20260412026d5980d85c9 branch=block_purchase_virtual_account status=pending ...
```

```text
custom_event_sent eventName=VirtualAccountIssued eventId=VirtualAccountIssued.o20260412026d5980d85c9 method=fbq ...
```

`performance` resource 관측은 여전히 아래처럼 `found=no`였다.

```text
custom_event_network_observed eventName=VirtualAccountIssued eventId=VirtualAccountIssued.o20260412026d5980d85c9 found=no matchCount=0
```

그래서 fallback도 1회 실행됐다.

```text
custom_event_network_missing_fallback_start eventName=VirtualAccountIssued eventId=VirtualAccountIssued.o20260412026d5980d85c9 method=image_fallback_after_observe_no
custom_event_sent eventName=VirtualAccountIssued eventId=VirtualAccountIssued.o20260412026d5980d85c9 method=image_fallback_after_observe_no
```

사후 endpoint 확인:

```json
{
  "decision": {
    "status": "pending",
    "browserAction": "block_purchase_virtual_account",
    "confidence": "high",
    "matchedBy": "toss_direct_order_id",
    "reason": "toss_direct_api_status"
  },
  "debug": {
    "matched": {
      "source": "toss_direct_api",
      "orderId": "202604123680489-P1",
      "paymentKey": "iw_bi20260412110357qYmu4",
      "status": "WAITING_FOR_DEPOSIT",
      "approvedAt": "",
      "channel": "가상계좌",
      "store": "biocom"
    }
  }
}
```

### 현재 판정

이번 테스트는 가상계좌 미입금 주문완료 기준으로 통과다.

통과한 항목:

```text
Browser Purchase 없음
PurchaseDecisionUnknown 없음
VirtualAccountIssued 있음
payment_decision_status=pending
payment_decision_reason=toss_direct_api_status
order_id 포함
Network ev=VirtualAccountIssued 확인
Pixel Helper VirtualAccountIssued 확인
```

주의할 점:

```text
fbq 전송 후 performance resource 관측은 found=no로 나왔다.
하지만 fallback_after_observe_no가 같은 eventId로 1회 전송했고,
Pixel Helper와 Network에서 VirtualAccountIssued가 실제 확인됐다.
따라서 운영 판단 기준은 performance found=yes가 아니라 Network/Pixel Helper 확인으로 두는 것이 맞다.
```

현재 완료도 업데이트:

```text
가상계좌 Purchase 차단: 98%
VirtualAccountIssued 전송: 95%
Pixel Helper/Network 관측: 95%
가상계좌를 VirtualAccountIssued로 정확 분류: 95%
카드 결제 Purchase 유지: 아직 재검증 필요
```

남은 필수 검증:

```text
카드 결제 완료 1건
```

카드 결제에서 기대값:

```text
Purchase 있음
Event ID = Purchase.{order_code}
VirtualAccountIssued 없음
PurchaseDecisionUnknown 없음
```

카드 결제까지 통과하면 브라우저 Purchase guard는 실전 통과로 봐도 된다.

## 2026-04-12 추가 테스트 3 - 카드 Purchase 미관측

TJ님이 새 창에서 카드 결제를 다시 테스트했다.

테스트 주문:

```text
order_code=o202604122a5b8aa63e86c
order_no=202604124298569
payment_code=pa20260412fbb8a2290d451
amount=36000
```

브라우저 관찰:

```text
Pixel Helper에는 이번 카드 주문의 Purchase가 보이지 않음
```

콘솔에서는 아래가 확인됐다.

```text
decision branch=allow_purchase status=confirmed reason=toss_direct_api_status matchedBy=toss_direct_payment_key confidence=high source=FB_PIXEL.Purchase eventId=Purchase.o202604122a5b8aa63e86c orderCode=o202604122a5b8aa63e86c orderId=202604124298569-P1 orderNo=202604124298569 paymentCode=pa20260412fbb8a2290d451 paymentKeyPresent=yes
```

그리고 아임웹/기존 픽셀 함수 내부 로그도 확인됐다.

```text
dispatchPurchaseFree : 36000 , KRW
dispatchPurchaseTrack : 36000 , KRW
```

서버 decision 사후 확인:

```json
{
  "decision": {
    "status": "confirmed",
    "browserAction": "allow_purchase",
    "confidence": "high",
    "matchedBy": "toss_direct_order_id",
    "reason": "toss_direct_api_status"
  },
  "debug": {
    "matched": {
      "source": "toss_direct_api",
      "orderId": "202604124298569-P1",
      "paymentKey": "iw_bi20260412111449vm2q8",
      "status": "DONE",
      "approvedAt": "2026-04-12T11:15:09+09:00",
      "channel": "카드",
      "store": "biocom"
    }
  }
}
```

### 현재 판정

카드 결제 decision은 통과다.

```text
confirmed / allow_purchase / 카드 / DONE
```

guard도 카드를 막지 않은 것으로 보인다.

```text
FB_PIXEL.Purchase 원본 호출까지 진행됨
dispatchPurchaseTrack 로그 확인됨
```

하지만 Pixel Helper에서 `Purchase`가 보이지 않았으므로 카드 회귀 검증은 아직 미통과다.

현재 미확정인 것:

```text
FB_PIXEL.Purchase 내부 dispatch가 실제 facebook.com/tr?ev=Purchase&eid=... 요청을 만들었는지
```

### 네트워크 관측은 누가 할 수 있는가

이미 지나간 TJ님 브라우저의 Network 요청은 내가 사후에 직접 볼 수 없다.

이유:

```text
Chrome DevTools Network 기록은 TJ님 로컬 브라우저 런타임 메모리에만 있고,
서버 endpoint나 로컬 파일 조회로 복원할 수 없다.
```

내가 할 수 있는 것:

```text
1. 서버 decision 재조회
2. 헤더 스니펫에 진단 로그 추가
3. 다음 테스트에서 콘솔만으로 ev=Purchase/eid=... 관측 여부를 더 쉽게 보이게 만들기
```

내가 하지 않는 것:

```text
기존 카드 주문완료 URL을 Playwright 등으로 재방문해 Purchase를 재발화시키는 것
```

이유:

```text
이미 결제 완료된 주문의 완료 URL을 자동 브라우저로 재방문하면 Meta 이벤트를 중복 발화시킬 수 있다.
Purchase는 중복 전송 리스크가 크므로 현재 단계에서 자동 재현은 하지 않는다.
```

### 추가 개발 반영 - 카드 Purchase 관측 로그

수정 파일:

```text
footer/header_purchase_guard_server_decision_0412_v3.md
```

반영 내용:

```text
1. allow_purchase 분기에서 원본 Purchase 호출 전 purchase_dispatch_start 로그를 남긴다.
2. 원본 Purchase 호출이 예외 없이 끝나면 purchase_dispatch_complete 로그를 남긴다.
3. 1.5초 뒤 performance resource entry에서 facebook.com/tr + ev=Purchase + eid=Purchase.{order_code} 요청을 찾는다.
4. 결과를 purchase_network_observed 로그로 남긴다.
5. Purchase fallback은 추가하지 않았다.
```

다음 카드 테스트 기대 로그:

```text
purchase_dispatch_start eventName=Purchase eventId=Purchase.o... branch=allow_purchase status=confirmed ...
```

```text
purchase_dispatch_complete eventName=Purchase eventId=Purchase.o... source=FB_PIXEL.Purchase ...
```

그 다음:

```text
purchase_network_observed eventName=Purchase eventId=Purchase.o... found=yes matchCount=1 ...
```

또는 아직 미관측이면:

```text
purchase_network_observed eventName=Purchase eventId=Purchase.o... found=no matchCount=0 eventOnlyCount=... pixelRequestCount=...
```

### 다음 테스트에서 봐야 할 값

Chrome Network에서 찾을 값:

```text
facebook.com/tr
ev=Purchase
eid=Purchase.o{order_code}
```

예시:

```text
ev=Purchase
eid=Purchase.o202604122a5b8aa63e86c
```

판정:

```text
purchase_network_observed found=yes
```

또는 Network에서 `ev=Purchase/eid=Purchase.o...`가 직접 보이면 카드도 통과다.

만약 `purchase_dispatch_complete`는 뜨는데 `purchase_network_observed found=no`이고 Network에도 `ev=Purchase`가 없다면, 다음 원인 후보는 1개다.

```text
FB_PIXEL.Purchase 내부의 dispatchPurchaseTrack 로그는 찍히지만,
Meta fbevents 쪽으로 실제 track 요청을 만들지 못하고 있다.
```

그때의 수정안 1개:

```text
allow_purchase에서 원본 FB_PIXEL.Purchase 호출 후에도 Purchase 네트워크 요청이 없을 때,
즉시 fallback을 보내지 말고 raw fbq('track', 'Purchase', ...)를 같은 eventId로 1회만 보낼지 검토한다.
```

단, 이 수정은 아직 적용하지 않는다.

이유:

```text
Purchase는 매출 이벤트라 중복 전송 리스크가 크다.
먼저 진단 로그와 Network로 실제 미전송을 확정해야 한다.
```

## 2026-04-12 추가 테스트 4 - 카드 Purchase 미전송 의심 강화

TJ님이 새 v3 진단 코드 반영 후 카드 결제를 다시 테스트했다.

테스트 주문:

```text
order_code=o20260412c49e91c39cba8
order_id=202604127242605-P1
order_no=202604127242605
payment_code=pa202604126bc4fafd48f78
amount=11900
```

콘솔 decision:

```text
decision branch=allow_purchase status=confirmed reason=toss_direct_api_status matchedBy=toss_direct_payment_key confidence=high source=FB_PIXEL.Purchase eventId=Purchase.o20260412c49e91c39cba8 orderCode=o20260412c49e91c39cba8 orderId=202604127242605-P1 orderNo=202604127242605 paymentCode=pa202604126bc4fafd48f78 paymentKeyPresent=yes
```

원본 `FB_PIXEL.Purchase` 호출 전후 진단:

```text
purchase_dispatch_start eventName=Purchase eventId=Purchase.o20260412c49e91c39cba8 branch=allow_purchase status=confirmed ...
dispatchPurchaseFree : 11900 , KRW
dispatchPurchaseTrack : 11900 , KRW
purchase_dispatch_complete eventName=Purchase eventId=Purchase.o20260412c49e91c39cba8 source=FB_PIXEL.Purchase ...
```

네트워크 관측 진단:

```text
purchase_network_observed eventName=Purchase eventId=Purchase.o20260412c49e91c39cba8 found=no matchCount=0 eventOnlyCount=0 pixelRequestCount=1 error=-
```

### 현재 해석

이 테스트에서 확정된 것:

```text
1. 서버 decision은 confirmed/allow_purchase로 정상이다.
2. guard는 카드 Purchase를 막지 않았다.
3. 원본 FB_PIXEL.Purchase 함수는 호출됐다.
4. dispatchPurchaseTrack 로그도 찍혔다.
```

아직 문제인 것:

```text
ev=Purchase / eid=Purchase.o20260412c49e91c39cba8 네트워크 요청이 관측되지 않았다.
```

TJ님 Network 캡처에서 `facebook.com/tr` 필터 위치는 맞다. 목록의 Name 열에 `ev=AddPaymentInfo`, `ev=PageView`가 보이는 방식이면, 같은 방식으로 `ev=Purchase`도 보여야 정상이다.

따라서 캡처에 보이는 범위와 콘솔 진단만 놓고 보면, 카드 `Purchase` 요청은 실제로 안 만들어졌을 가능성이 높다.

단, 최종 확정은 아래 중 하나로 하면 된다.

```text
Network 필터에 Purchase.o20260412c49e91c39cba8 입력
또는
Network 필터에 ev=Purchase 입력
```

이때 행이 0개면 카드 Purchase 네트워크 요청 없음으로 확정한다.

우측 Headers까지 매번 클릭할 필요는 없다. 다만 `Name` 열이 너무 잘려서 `ev`가 안 보일 때만 해당 row를 클릭해서 Query String Parameters의 `ev`, `eid`를 확인하면 된다.

### 다음 원인 후보

현재 가장 유력한 원인:

```text
FB_PIXEL.Purchase 내부의 dispatchPurchaseTrack 로그는 찍히지만,
실제 Meta fbevents 요청으로 연결되지 않는다.
```

가능한 이유:

```text
1. 페이지에 Multiple pixels with conflicting versions 경고가 있어 Meta wrapper 상태가 꼬였다.
2. 아임웹 FB_PIXEL.Purchase 내부 구현이 로그만 찍고 실제 fbq track Purchase를 만들지 못한다.
3. 기존 fbevents 객체가 guard wrap 이후에도 내부적으로 비정상 상태다.
```

### 다음 수정안

아직 바로 적용하지는 않는다.

다음 수정 후보는 아래 1개다.

```text
allow_purchase에서 원본 FB_PIXEL.Purchase 호출 후에도 ev=Purchase/eid=Purchase.o... 요청이 없다고 확정되면,
같은 eventId로 raw fbq('track', 'Purchase', { value, currency, ... }, { eventID })를 1회만 보낸다.
```

주의:

```text
Purchase는 매출 이벤트라 중복 전송 리스크가 크다.
따라서 Network 필터에서 ev=Purchase가 정말 0개인지 한 번 더 확정한 뒤 적용한다.
```

## 2026-04-12 추가 테스트 5 - 카드 Purchase Network 0건 확정 및 fallback 반영

TJ님이 Chrome Network 필터에서 아래 2가지를 직접 확인했다.

```text
Purchase.o20260412c49e91c39cba8 -> 0건
ev=Purchase -> 0건
```

따라서 카드 confirmed 주문에서 아래 흐름은 확정으로 본다.

```text
decision=allow_purchase
원본 FB_PIXEL.Purchase 호출됨
dispatchPurchaseTrack 로그 찍힘
하지만 실제 facebook.com/tr ev=Purchase 요청은 없음
```

즉 문제는 guard가 카드 Purchase를 막은 것이 아니라, 아임웹/기존 `FB_PIXEL.Purchase` 내부 dispatch가 실제 Meta `Purchase` 요청을 만들지 못하는 쪽이다.

### 반영한 수정

파일:

```text
footer/header_purchase_guard_server_decision_0412_v3.md
```

새 v4/v5 파일을 만들지 않고 v3 안에만 조건부 보강을 넣었다.

수정 내용:

```text
allow_purchase에서 원본 FB_PIXEL.Purchase를 먼저 호출한다.
1.8초 뒤 performance resource entry에서 ev=Purchase + eid=Purchase.{order_code}를 찾는다.
matchCount=0이고 eventOnlyCount=0이면 같은 eventID로 raw fbq('track','Purchase')를 1회만 보낸다.
raw fbq도 실패하면 마지막으로 image fallback을 1회 보낸다.
```

추가 로그:

```text
purchase_network_missing_fallback_start eventName=Purchase eventId=Purchase.o... method=raw_fbq_after_observe_no
purchase_fallback_sent eventName=Purchase eventId=Purchase.o... method=raw_fbq_after_observe_no
```

raw fbq가 준비되지 않은 경우:

```text
purchase_fallback_sent eventName=Purchase eventId=Purchase.o... method=image_fallback_after_observe_no
```

중복 방지:

```text
purchaseFallbackAfterObserveNoEventIds[eventId]
```

같은 페이지 라이프사이클에서 같은 `Purchase.{order_code}` fallback은 1회만 허용한다.

### 왜 이 수정이 필요한가

가상계좌는 `VirtualAccountIssued`로 내려가는 것이 맞지만, 카드 confirmed 주문은 Meta에 `Purchase`가 남아야 한다.

현재 카드 테스트에서는 confirmed 판정까지는 정상인데 실제 `ev=Purchase` 요청이 없었다. 이 상태로 두면 Meta ROAS가 과대가 아니라 오히려 카드 주문 일부를 누락할 수 있다.

따라서 confirmed 주문에 한해 아래 정책이 맞다.

```text
가상계좌 pending: Purchase 차단
카드 confirmed: Purchase 보장
```

### 다음 카드 테스트 기대값

다음 카드 주문에서는 콘솔에 아래가 뜰 수 있다.

```text
decision branch=allow_purchase status=confirmed ...
purchase_dispatch_start ...
purchase_dispatch_complete ...
purchase_network_observed ... found=no matchCount=0 eventOnlyCount=0 ...
purchase_network_missing_fallback_start ... method=raw_fbq_after_observe_no
purchase_fallback_sent ... method=raw_fbq_after_observe_no
```

Network 또는 Pixel Helper에서는 아래가 보여야 한다.

```text
ev=Purchase
eid=Purchase.o{order_code}
```

만약 원본 `FB_PIXEL.Purchase`가 어느 순간 정상화되면 아래처럼 끝나야 한다.

```text
purchase_network_observed ... found=yes matchCount=1
```

이 경우 fallback은 실행되지 않아야 한다.

### 다음 가상계좌 테스트 기대값

가상계좌 미입금은 기존 통과 기준 그대로다.

```text
ev=Purchase 없음
ev=VirtualAccountIssued 있음
payment_decision_status=pending
payment_decision_reason=toss_direct_api_status
```

### 검증

수행:

```text
awk '/^<script>/{flag=1; next} /^<\/script>/{flag=0} flag {print}' footer/header_purchase_guard_server_decision_0412_v3.md > /tmp/biocom_server_payment_decision_guard_v3.js
node --check /tmp/biocom_server_payment_decision_guard_v3.js
```

결과:

```text
통과
```
