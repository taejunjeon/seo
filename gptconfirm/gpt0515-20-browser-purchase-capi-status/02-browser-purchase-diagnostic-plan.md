# Browser Purchase Diagnostic Plan

작성 시각: 2026-05-15 16:38 KST

## 결론

지금은 같은 결제건에 Browser Purchase diagnostic을 실행하지 않는 것이 맞다. 서버 CAPI가 이미 11,900원 구매를 Meta에 보냈고 `events_received=1`을 받았기 때문이다.

## 왜 바로 실행하지 않는가

- Browser Purchase는 Meta 운영 이벤트다.
- 같은 주문이 이미 서버 CAPI로 들어간 상태에서 Browser Purchase를 추가로 보내면 중복 또는 해석 혼선이 생길 수 있다.
- 지금 목표는 "Meta가 구매를 받았는가"였고, 이 조건은 CAPI로 충족됐다.

## 그래도 진단이 필요한 경우

아래 조건이 모두 맞을 때만 단건 진단을 고려한다.

1. 다음 실제 결제에서 CAPI가 안 들어간다.
2. 결제완료 row가 VM Cloud에서 confirmed다.
3. amount가 source total과 일치한다.
4. duplicate event_id가 없다.
5. TJ님이 별도 Red 승인으로 "Browser Purchase diagnostic 1건"을 허용한다.

## Console one-time image beacon 후보

아래는 **실행용 코드가 아니라 설계 템플릿**이다. 실제 실행은 Red 승인 전 금지다.

```js
// DO NOT RUN WITHOUT RED APPROVAL.
// 목적: confirmed 결제 1건에 한해 Meta가 Browser Purchase beacon을 받는지 확인.
// raw order/payment/member/click id는 넣지 않는다.
const EXECUTE_PURCHASE_DIAGNOSTIC = false;
if (!EXECUTE_PURCHASE_DIAGNOSTIC) {
  throw new Error('Purchase diagnostic is disabled until explicit Red approval.');
}

const pixelId = '1283400029487161';
const eventId = 'diag_purchase_<safe_hash_only>';
const value = 11900;
const currency = 'KRW';
const params = new URLSearchParams({
  id: pixelId,
  ev: 'Purchase',
  dl: location.href,
  rl: document.referrer || '',
  if: 'false',
  ts: String(Date.now()),
  cd: JSON.stringify({ value, currency }),
  eventID: eventId
});
new Image().src = 'https://www.facebook.com/tr/?' + params.toString();
```

이 방식은 browser endpoint 확인에는 도움이 되지만, 운영 이벤트를 만들 수 있다. 그래서 현재처럼 CAPI가 성공한 주문에는 쓰지 않는다.

## Guarded browser fallback 운영 적용 조건

운영 코드에 Browser Purchase fallback을 넣으려면 아래 조건이 필요하다.

- `payment-decision`이 `allow_purchase`를 반환한 경우에만 발화.
- sessionStorage dedupe 유지.
- CAPI와 같은 eventID 규칙을 써서 중복 제거 가능해야 함.
- `pending`, `unknown`, 가상계좌 미입금, 취소/환불, 0원은 절대 발화 금지.
- Meta CAPI가 이미 성공한 같은 주문에 중복으로 발화하지 않도록 우선순위 규칙 필요.

## 지금 권장

- Browser Purchase diagnostic은 보류.
- 다음 실제 결제에서 CAPI가 계속 들어가는지 우선 모니터링.
- Browser Purchase는 "서버 경로가 끊겼을 때의 보조 진단"으로만 다룬다.
