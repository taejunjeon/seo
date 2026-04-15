# codefeedback_0412_5 결과 보고

작성 시각: 2026-04-12 KST

## 결론

이번 가상계좌 주문은 서버 판단 기준으로 `pending`이 맞고, 브라우저에서 `Purchase`를 보내면 안 되는 케이스다.

서버 `payment-decision` 응답은 `block_purchase_virtual_account`였고, Toss 직접 조회에서도 `WAITING_FOR_DEPOSIT`, 결제 채널 `가상계좌`로 확인됐다.

따라서 이번 테스트에서 중요한 1차 결론은 아래와 같다.

- `Purchase`가 Pixel Helper에 안 보인 것은 정상에 가깝다. 가드가 원래 `Purchase`를 막아야 하는 주문이기 때문이다.
- 문제는 `VirtualAccountIssued`가 Pixel Helper에 명확히 안 보인 점이다.
- 기존 v3 콘솔 로그가 `custom event sent Object`로만 보여서, 실제 전송 방식이 `fbq`였는지 `image_fallback`였는지 확정할 수 없었다.
- 그래서 새 버전을 무작정 올리기보다, v3 코드에 진단 로그를 보강했다.

## 이번 주문 서버 decision 확인

대상 주문:

```text
order_no=202604125352055
order_code=o2026041299496e654e8c1
payment_code=pa20260412050bbe102fbea
URL=https://biocom.kr/shop_payment_complete?order_code=o2026041299496e654e8c1&payment_code=pa20260412050bbe102fbea&order_no=202604125352055&rk=S
```

확인 endpoint:

```text
https://att.ainativeos.net/api/attribution/payment-decision
```

응답 요약:

```json
{
  "ok": true,
  "version": "2026-04-12.payment-decision.v1",
  "generatedAt": "2026-04-12T00:24:55.906Z",
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
    "errors": 1
  }
}
```

한국시간 기준 생성 시각:

```text
2026-04-12 09:24:55 KST
```

Toss 직접 조회 debug:

```json
{
  "source": "toss_direct_api",
  "orderId": "202604125352055-P1",
  "paymentKey": "iw_bi20260412091612yqXH5",
  "status": "WAITING_FOR_DEPOSIT",
  "approvedAt": "",
  "channel": "가상계좌",
  "store": "biocom"
}
```

해석:

- `order_no=202604125352055` 원문으로 Toss 조회 시 404가 한 번 났다.
- 하지만 실제 결제 건은 `202604125352055-P1`로 매칭됐다.
- 상태는 `WAITING_FOR_DEPOSIT`이므로 아직 입금 완료가 아니다.
- `approvedAt`이 비어 있으므로 confirmed purchase가 아니다.
- 따라서 Browser `Purchase`를 보내면 Meta ROAS가 과대 계산될 수 있다.

## 브라우저 branch 판단

서버 응답 기준으로 이번 주문이 타야 하는 branch는 아래다.

```text
branch=block_purchase_virtual_account
status=pending
reason=toss_direct_api_status
matchedBy=toss_direct_order_id
```

즉 브라우저 가드는 원래 `Purchase`를 막고, 대신 custom event인 `VirtualAccountIssued`를 보내야 한다.

## 기존 v3 테스트에서 확정된 것과 미확정인 것

확정:

- 가상계좌 주문완료 페이지에서 가드 설치 로그가 떴다.
- `custom event sent` 로그가 떴다.
- Pixel Helper에서 `Purchase`가 안 보였다.
- 서버 decision은 `pending / block_purchase_virtual_account`다.

미확정:

- `custom event sent Object` 안의 `method`가 `fbq`였는지 `image_fallback`였는지 확인되지 않았다.
- 실제 `https://www.facebook.com/tr/` 네트워크 요청의 `ev`, `eid`, `cd[order_code]`, `cd[order_no]`, `cd[payment_code]`는 과거 브라우저 세션이라 터미널에서 사후 확인할 수 없다.
- Pixel Helper가 `VirtualAccountIssued`를 표시하지 않은 이유가 전송 실패인지, `image_fallback` 표시 한계인지, Pixel Helper 표시 지연/제한인지는 아직 단정할 수 없다.

## 코드 작업

수정 파일:

```text
footer/header_purchase_guard_server_decision_0412_v3.md
```

수정 내용:

- `decision` branch를 한 줄 콘솔 로그로 출력하게 했다.
- `custom_event_prepare` 로그를 추가했다.
- `custom_event_sent` 로그를 Object가 아니라 문자열 key=value 형태로 출력하게 했다.
- `eventName`, `eventId`, `method`, `branch`, `status`, `reason`, `orderCode`, `orderNo`, `paymentCode`가 콘솔 한 줄에 바로 보이게 했다.
- 마지막 진단값을 `window.__BIOCOM_SERVER_PAYMENT_DECISION_LAST__`에 저장하게 했다.

다음 테스트에서 기대되는 콘솔 예시:

```text
[biocom-server-payment-decision-guard] decision branch=block_purchase_virtual_account status=pending reason=toss_direct_api_status matchedBy=toss_direct_order_id confidence=high source=FB_PIXEL.Purchase eventId=Purchase.o2026041299496e654e8c1 orderCode=o2026041299496e654e8c1 orderNo=202604125352055 paymentCode=pa20260412050bbe102fbea
```

```text
[biocom-server-payment-decision-guard] custom_event_prepare eventName=VirtualAccountIssued eventId=VirtualAccountIssued.o2026041299496e654e8c1 branch=block_purchase_virtual_account status=pending orderCode=o2026041299496e654e8c1 orderNo=202604125352055 paymentCode=pa20260412050bbe102fbea
```

```text
[biocom-server-payment-decision-guard] custom_event_sent eventName=VirtualAccountIssued eventId=VirtualAccountIssued.o2026041299496e654e8c1 method=fbq branch=block_purchase_virtual_account status=pending reason=toss_direct_api_status orderCode=o2026041299496e654e8c1 orderNo=202604125352055 paymentCode=pa20260412050bbe102fbea
```

또는 `fbq`가 준비되지 않았으면 아래처럼 보여야 한다.

```text
method=image_fallback
```

## Pixel Helper에 안 보인 이유에 대한 현재 판단

현재 단계에서는 원인을 하나로 확정하면 안 된다.

가능성이 높은 순서는 아래다.

1. `image_fallback`으로 전송된 경우: direct image 방식은 실제 `facebook.com/tr/` 요청은 나가도 Pixel Helper 이벤트 목록에 안정적으로 표시되지 않을 수 있다.
2. `fbq`로 전송됐지만 Pixel Helper가 custom event를 표시하지 못한 경우: 현재 페이지에는 `Multiple pixels with conflicting versions` 경고가 있어 Pixel Helper 관측이 불안정할 수 있다.
3. `custom event sent` 로그는 찍혔지만 실제 네트워크 요청이 안 나간 경우: 이 경우는 다음 테스트에서 Network 탭으로 확인해야 한다.

중요한 점:

- Pixel Helper는 참고 도구다.
- 최종 판단은 Chrome DevTools Network 탭의 `https://www.facebook.com/tr/` 요청으로 해야 한다.
- Network에서 `ev=VirtualAccountIssued`, `eid=VirtualAccountIssued.o...`, `cd[order_code]`, `cd[order_no]`, `cd[payment_code]`가 보이면 Meta 전송은 된 것으로 보는 게 맞다.

## 다음 수정안 1개

지금 바로 v4/v5로 새 로직을 만들지 말고, 보강된 v3를 헤더 상단에 다시 넣고 한 번만 재테스트한다.

다음 테스트에서 확인할 것:

- 콘솔에 `decision branch=block_purchase_virtual_account`가 뜨는지
- 콘솔에 `custom_event_sent eventName=VirtualAccountIssued`가 뜨는지
- `method=fbq`인지 `method=image_fallback`인지
- Network 탭에서 `facebook.com/tr` 요청에 `ev=VirtualAccountIssued`가 있는지
- Pixel Helper에는 안 떠도 Network에는 뜨는지

분기별 다음 액션:

- `method=fbq`이고 Network에도 `ev=VirtualAccountIssued`가 있으면, 기능은 통과로 보고 Pixel Helper 표시 한계로 정리한다.
- `method=image_fallback`이고 Network에 `ev=VirtualAccountIssued`가 있으면, 전송은 됐지만 Pixel Helper 표시 한계가 있을 수 있다. 운영상 허용할지, `fbq` 준비를 더 기다릴지 결정한다.
- `custom_event_sent`는 뜨는데 Network에 요청이 없으면, dispatch 로직을 다시 고쳐야 한다.
- `decision` 로그가 없으면, Purchase 호출을 가드가 잡지 못한 것이므로 wrap 타이밍 문제를 봐야 한다.

## 검증

수행한 검증:

```text
node --check /tmp/biocom_server_payment_decision_guard_v3.js
git diff --check -- footer/header_purchase_guard_server_decision_0412_v3.md
```

결과:

```text
통과
```

## 현재 완료도

가상계좌 Purchase 차단:

```text
80%
```

이유:

- 서버 decision은 정확하다.
- Pixel Helper에서 `Purchase`가 사라진 것도 방향은 맞다.
- 하지만 `VirtualAccountIssued`의 Meta 전송 관측이 아직 Network 기준으로 확정되지 않았다.

다음 한 번의 테스트에서 `method`와 Network 요청만 확인되면 이 항목은 95% 이상으로 올릴 수 있다.
