# codefeedback_0412_6 결과 보고

작성 시각: 2026-04-12 KST

## 결론

이번 최신 가상계좌 주문은 로직상 `Purchase` 차단 후 `VirtualAccountIssued`를 `fbq` 방식으로 보내는 경로를 탔다.

TJ님이 확인한 콘솔 기준:

```text
decision branch=block_purchase_virtual_account status=pending reason=toss_direct_api_status matchedBy=toss_direct_order_id
custom_event_prepare eventName=VirtualAccountIssued eventId=VirtualAccountIssued.o202604127cce6628f3a99
custom_event_sent eventName=VirtualAccountIssued eventId=VirtualAccountIssued.o202604127cce6628f3a99 method=fbq
```

해석:

- 서버 decision은 pending 가상계좌로 정상 판단했다.
- 브라우저 `Purchase`는 차단됐다.
- `VirtualAccountIssued` custom event는 `image_fallback`이 아니라 `fbq('trackCustom', ...)` 경로로 호출됐다.

단, DevTools Network에서 `ev=VirtualAccountIssued` 요청을 직접 확인하지 못했으므로, “실제 Meta 수신 성공”을 100% 확정하긴 어렵다. 현재 결론은 아래처럼 나누는 게 맞다.

```text
Purchase 차단 성공: 확정에 가까움
VirtualAccountIssued fbq 호출 성공: 확정
VirtualAccountIssued 실제 Network 요청 관측: 아직 미확정
Meta Events Manager 수신 성공: 아직 미확정
```

## 이번 주문 서버 decision 확인

콘솔 eventId 기준 주문 코드:

```text
order_code=o202604127cce6628f3a99
event_id=VirtualAccountIssued.o202604127cce6628f3a99
```

`order_code`만으로 조회했을 때:

```json
{
  "decision": {
    "status": "pending",
    "browserAction": "block_purchase_virtual_account",
    "confidence": "high",
    "matchedBy": "ledger_order_code",
    "reason": "attribution_ledger_status"
  },
  "debug": {
    "matched": {
      "source": "attribution_ledger",
      "orderId": "202604123597268",
      "paymentKey": "iw_bi20260412093103qSxC0",
      "status": "pending",
      "approvedAt": "",
      "captureMode": "live"
    }
  }
}
```

`order_no=202604123597268`까지 넣어 Toss 직접 조회했을 때:

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
      "orderId": "202604123597268-P1",
      "paymentKey": "iw_bi20260412093103qSxC0",
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
2026-04-12 09:56 KST 전후
```

해석:

- 이 주문은 입금 전 가상계좌 주문이다.
- Toss 상태가 `WAITING_FOR_DEPOSIT`이므로 confirmed purchase가 아니다.
- 따라서 Meta Browser `Purchase`를 보내면 안 된다.
- `VirtualAccountIssued`로 낮추는 현재 정책이 맞다.

## 브라우저 Network 요청 확정 여부

질문:

```text
이번 주문 기준으로 브라우저에서 실제 facebook.com/tr 요청 중 ev=VirtualAccountIssued가 존재하는지 확정 가능한가?
```

답:

```text
현재 제가 사후 확정할 수는 없다.
```

이유:

- `facebook.com/tr` 요청은 TJ님 브라우저 세션의 DevTools Network 안에 있는 런타임 기록이다.
- 터미널에서 서버 endpoint나 로컬 파일을 조회해도, 이미 지나간 브라우저 Network 요청 전체를 복원할 수 없다.
- 제가 확인 가능한 것은 서버 decision과 스니펫 코드 경로, 그리고 TJ님이 제공한 콘솔 로그다.

현재 증거 수준:

```text
method=fbq 로그가 있으므로, 코드가 raw fbq에 trackCustom 호출을 넘긴 것은 확실하다.
하지만 실제 tr 네트워크 요청이 만들어졌는지는 Network 또는 Events Manager에서만 최종 확인 가능하다.
```

## 코드 작업

수정 파일:

```text
footer/header_purchase_guard_server_decision_0412_v3.md
```

추가한 진단:

1. 전송 직전 로그

```text
custom_event_dispatch_start
```

이 로그에는 아래 값이 같이 찍힌다.

```text
eventName=VirtualAccountIssued
eventId=VirtualAccountIssued.o...
methodCandidate=fbq
networkUrlHint=facebook.com/tr
networkSearchEvent=VirtualAccountIssued
networkSearchEventId=VirtualAccountIssued.o...
orderCode=o...
orderNo=...
paymentCode=...
```

2. 전송 후 브라우저 resource 관측 로그

```text
custom_event_network_observed
```

이 로그는 브라우저의 `performance.getEntriesByType('resource')`에서 `facebook.com/tr` 요청 중 `eventName`과 `eventId`가 들어간 요청을 찾는다.

기대 로그:

```text
[biocom-server-payment-decision-guard] custom_event_network_observed eventName=VirtualAccountIssued eventId=VirtualAccountIssued.o... found=yes matchCount=1 networkUrlHint=facebook.com/tr ...
```

만약 아래처럼 나오면 실제 Network 요청 관측이 안 된 것이다.

```text
found=no matchCount=0
```

주의:

- `performance` resource entry도 브라우저/확장/보안 정책에 따라 누락될 수 있다.
- 그래도 DevTools Network에서 수동으로 찾는 것보다 훨씬 빠른 1차 판정 로그가 된다.

## 다음 테스트에서 볼 콘솔

보강된 v3를 넣은 뒤 가상계좌 주문완료 페이지에서 아래 4줄을 확인하면 된다.

```text
decision branch=block_purchase_virtual_account ...
custom_event_prepare eventName=VirtualAccountIssued ...
custom_event_dispatch_start eventName=VirtualAccountIssued ... networkUrlHint=facebook.com/tr ...
custom_event_sent eventName=VirtualAccountIssued ... method=fbq
custom_event_network_observed eventName=VirtualAccountIssued ... found=yes matchCount=1
```

핵심은 마지막 줄이다.

```text
custom_event_network_observed ... found=yes
```

이게 뜨면 DevTools Network에서 직접 못 찾더라도, 브라우저 resource 기준으로 `facebook.com/tr` 요청은 만들어진 것으로 본다.

## Chrome Network에서 찾는 방법

DevTools Network에서 아래 순서로 보면 된다.

1. Network 탭을 연다.
2. Preserve log를 켠다.
3. 검색창 또는 filter에 아래 중 하나를 넣는다.

```text
VirtualAccountIssued
```

```text
VirtualAccountIssued.o202604127cce6628f3a99
```

```text
facebook.com/tr
```

찾아야 하는 값:

```text
ev=VirtualAccountIssued
eid=VirtualAccountIssued.o202604127cce6628f3a99
cd[order_code]=o202604127cce6628f3a99
```

만약 Network filter가 query string 검색을 제대로 못 하면, `facebook.com/tr` 요청을 하나씩 클릭해서 Payload 또는 Headers의 Query String Parameters에서 `ev`와 `eid`를 본다.

## method=fbq인데 Pixel Helper에 안 보이는 원인 의견

가능성이 높은 순서:

1. Pixel Helper의 custom event 표시 한계

`trackCustom` 이벤트는 표준 이벤트 `PageView`, `Purchase`, `InitiateCheckout`보다 Pixel Helper에 덜 안정적으로 표시될 수 있다. 특히 이벤트가 빠르게 발화되거나 페이지에 여러 픽셀/버전 충돌이 있으면 누락처럼 보일 수 있다.

2. Meta wrapper 충돌

콘솔에 이미 아래 경고가 반복된다.

```text
[Meta Pixel] - Multiple pixels with conflicting versions were detected on this page.
```

이 경고는 Pixel Helper 관측을 불안정하게 만들 수 있다. 실제 전송은 되었지만 Helper UI에는 누락될 수 있다.

3. raw fbq 호출은 되었지만 네트워크 전송으로 이어지지 않은 경우

가능성은 낮지만 배제하면 안 된다. `method=fbq`는 “우리 코드가 fbq에 호출을 넘겼다”는 뜻이지, Meta 서버가 실제 수신했다는 뜻은 아니다. 그래서 이번에 `custom_event_network_observed` 로그를 추가했다.

## 현재 v3를 실제 Meta 전송 성공으로 볼 수 있는가

현재 기준 결론:

```text
조건부 성공으로 본다.
```

세부 판단:

- `Purchase` 차단은 성공으로 봐도 된다.
- `VirtualAccountIssued` fbq 호출도 성공으로 봐도 된다.
- 하지만 `ev=VirtualAccountIssued` Network 요청을 아직 직접 확인하지 못했으므로, “Meta 전송 성공 100% 확정”은 아직 아니다.

제 추정:

```text
실제 전송됐을 가능성: 80~90%
자신감: 7/10
```

왜 100%가 아닌가:

- Pixel Helper에 표시되지 않았다.
- Network에서 `ev=VirtualAccountIssued`를 직접 집어내지 못했다.
- `Multiple pixels with conflicting versions` 경고가 있다.

## 만약 Network에도 ev=VirtualAccountIssued가 없다면

그때만 수정안 1개를 적용한다.

수정안:

```text
fbq로 custom event를 보낸 뒤 1.5초 후 performance resource에서 facebook.com/tr + eventId가 관측되지 않으면, 같은 eventId로 image_fallback을 1회만 보낸다.
```

장점:

- Pixel Helper에 안 보여도 `facebook.com/tr` 직접 요청을 보장할 수 있다.
- `VirtualAccountIssued`는 매출 이벤트가 아니므로, Purchase 과대 계산 리스크는 없다.

주의:

- performance 관측이 브라우저 정책 때문에 누락된 것뿐인데 fallback을 보내면 custom event가 중복될 수 있다.
- 따라서 지금 바로 적용하지 말고, 다음 테스트에서 `custom_event_network_observed found=no`가 실제로 뜰 때만 적용하는 것이 맞다.

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

## 다음 액션

TJ님이 할 일:

```text
보강된 v3 헤더 코드를 다시 넣고, 가상계좌 주문완료 1건을 테스트한다.
```

확인할 것:

```text
custom_event_network_observed ... found=yes
```

내가 볼 것:

```text
found=yes면 v3를 가상계좌 Purchase 차단 + VirtualAccountIssued 전송 성공으로 정리한다.
found=no면 fbq 호출 후 image_fallback 1회 보강안을 적용한다.
```
