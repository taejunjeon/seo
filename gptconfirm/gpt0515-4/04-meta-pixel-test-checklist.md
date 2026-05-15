# 04. Meta Pixel Test Checklist

작성 시각: 2026-05-15 01:32 KST

## 결론

TJ님은 Meta Events Manager에서 browser event가 살아 있는지 확인하면 된다. Purchase는 test-only 보장이 없으면 실행하지 않는다.

이번 체크의 목적은 Pixel 전체를 새로 심는 것이 아니다. 기존 아임웹 FBE/native browser Pixel이 PageView/ViewContent/AddToCart/InitiateCheckout를 정상 수집하는지 보는 것이다.

## 확인 화면

- Meta Events Manager.
- Pixel/Dataset: `1283400029487161`.
- 탭: Test Events, Overview, Event match quality, Event source.

## 브라우저 콘솔 체크

운영 사이트에서 실제 결제 없이 확인한다.

```js
typeof fbq
```

성공 기준:

- `"function"`이면 browser Pixel 함수가 존재한다.
- `"undefined"`이면 FBE/native pixel 삽입 또는 로딩이 막혔을 수 있다.

## Network 체크

Chrome DevTools > Network에서 아래를 본다.

- domain: `facebook.com/tr`
- Pixel ID: `1283400029487161`
- event names:
  - `PageView`
  - `ViewContent`
  - `AddToCart`
  - `InitiateCheckout`
  - `AddPaymentInfo`

성공 기준:

- PageView/ViewContent는 상품/페이지 탐색에서 보인다.
- AddToCart는 장바구니 동작에서 보인다.
- InitiateCheckout은 결제 흐름 진입에서 보인다.
- AddPaymentInfo는 결제수단 선택 시점에 보이는지 확인한다.

## Purchase 금지 기준

Purchase는 아래 조건 전에는 실행하지 않는다.

- Meta Test Events 전용 test_event_code가 있음.
- 운영 Purchase count delta 0을 pre/post로 확인할 수 있음.
- 실제 주문/결제가 없음.
- browser eventID와 server event_id를 같은 값으로 묶는 dedup plan이 있음.

따라서 운영 사이트에서 직접 `fbq('track', 'Purchase')`를 실행하지 않는다.

## AddPaymentInfo 0건 원인 체크

AddPaymentInfo가 0이면 아래를 순서대로 본다.

1. 결제수단 선택 UI에서 browser Pixel event가 원래 발화되는 구조인지.
2. 아임웹 FBE/native integration이 AddPaymentInfo를 지원하는지.
3. Phase 9 Funnel CAPI mirror의 `enableServerCapi=false` 때문에 server mirror만 꺼져 있는지.
4. browser Pixel 자체는 켜져 있지만 해당 이벤트만 FBE에서 만들지 않는지.
5. 결제수단 선택이 iframe/외부 PG 안에서 일어나 브라우저 페이지에서 잡히지 않는지.

## enableServerCapi=false 의미

`enableServerCapi=false`는 server mirror를 끈다는 뜻이다.

중요:

- browser Pixel이 꺼졌다는 뜻이 아니다.
- PageView/ViewContent/AddToCart/InitiateCheckout browser event는 FBE/native Pixel이 계속 보낼 수 있다.
- 서버 CAPI mirror가 꺼져 있으므로 server event count가 적게 보일 수 있다.
- Purchase는 별도 guard가 필요하다.

## TJ님이 캡처하면 좋은 화면

1. Test Events에서 PageView 수신 화면.
2. Test Events에서 ViewContent/AddToCart/InitiateCheckout 수신 화면.
3. Overview에서 Purchase count와 recent received time.
4. AddPaymentInfo가 없으면 Network filter `facebook.com/tr` 화면.

## Codex가 화면 없이 할 수 있는 것

- VM Cloud 수신 row read-only 집계.
- backend route/guard 설계.
- footer v4.4 코드 초안 작성.
- value guard fixture 작성.

## Codex가 화면 없이 못 하는 것

- Meta UI Test Events 실시간 수신 확인.
- Meta UI에서 browser/server dedup 표시 확인.
- 아임웹 운영 코드 저장.

## 승인 필요한 다음 테스트

`Biocom Meta Browser Purchase test-only dedup smoke`.

조건:

- test_event_code 필수.
- browser Purchase 1건 이하.
- server CAPI test Purchase 1건 이하.
- 운영 Purchase count 증가 0.
- 실제 주문/결제 0.
