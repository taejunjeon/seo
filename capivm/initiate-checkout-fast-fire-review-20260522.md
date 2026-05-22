# InitiateCheckout Fast Fire Review

작성 시각: 2026-05-22 12:53 KST
기준일: 2026-05-22
문서 성격: Meta `InitiateCheckout` 브라우저 이벤트 지연 원인과 빠른 발화 가능성 검토

## 10초 요약

`InitiateCheckout`이 몇 초 뒤 보이는 것은 서버 CAPI 지연이 아니라 Biocom Imweb Footer Block4의 브라우저 대기 로직 때문일 가능성이 높다.
현재 Block4는 native/FBE Pixel이 먼저 발화하는지 1.2초 기다리고, 주문 금액이 아직 안 보이면 최대 4초까지 짧게 재시도한다.

`VirtualAccountIssued`처럼 0초 즉시 발화하는 방식은 `InitiateCheckout`에는 권장하지 않는다.
대신 `value/currency`가 이미 보이면 0.3~0.5초 안에 발화하고, native 이벤트가 먼저 뜨면 fallback을 보내지 않는 fast path가 더 안전하다.

## 현재 지연이 생기는 이유

Block4 v0.5의 현재 핵심 설정:

```text
nativeObserveMs = 1200ms
valueRetryMs = [0, 600, 1400, 2600, 4000]
```

의미:

1. `/shop_payment/`에 도착한다.
2. 먼저 기존 Meta/FBE/native Pixel이 `InitiateCheckout`을 보내는지 1.2초 기다린다.
3. 이미 `facebook.com/tr ev=InitiateCheckout` 요청이 있으면 Block4 fallback은 보내지 않는다.
4. 없으면 Block4가 image beacon fallback을 보낸다.
5. 이때 `value`가 아직 DOM에서 안 읽히면 0.6초, 1.4초, 2.6초, 4초까지 재시도한다.

따라서 Meta Pixel Helper에서 몇 초 뒤 보이는 것은 아래 둘이 합쳐진 결과일 수 있다.

- 우리 코드의 중복 방지 대기
- Meta Pixel Helper UI 표시 지연

정확한 기준은 Pixel Helper UI보다 Network `facebook.com/tr?ev=InitiateCheckout` 요청 시각이다.

## VirtualAccountIssued와 다른 점

### VirtualAccountIssued

`VirtualAccountIssued`는 가상계좌 발급 또는 미입금 주문 생성을 뜻하는 custom event다.
Meta/Imweb native가 자동으로 같은 이벤트를 보낼 가능성이 낮다.

그래서 완료 URL에서 가상계좌 힌트가 보이면 즉시 1회 보내는 설계가 맞다.

### InitiateCheckout

`InitiateCheckout`은 Meta 표준 이벤트다.
Imweb/FBE/native Pixel이 같은 이벤트를 보낼 수 있다.

따라서 0초 즉시 fallback을 보내면 아래 위험이 있다.

```text
Block4 fallback InitiateCheckout 1건
+ native/FBE InitiateCheckout 1건
= Meta 관점에서 중복 가능
```

또 주문서 화면은 DOM 금액이 늦게 렌더링될 수 있다.
너무 빨리 보내면 `value/currency`가 빠져 Meta 진단에서 품질 경고가 남을 수 있다.

## 권장안: 0초 즉시가 아니라 fast path

권장 목표:

```text
주문서 화면 진입 후 0.3~0.5초 안에 value/currency가 있으면 바로 발화
native 이벤트가 이미 있으면 fallback skip
value가 없으면 짧게 재시도
Purchase는 절대 발화하지 않음
서버 CAPI는 계속 OFF
```

권장 변경 후보:

```text
nativeObserveMs: 1200 -> 400
valueRetryMs: [0, 600, 1400, 2600, 4000] -> [0, 300, 800, 1600, 3000]
```

또는 더 보수적으로:

```text
nativeObserveMs: 1200 -> 600
valueRetryMs: [0, 600, 1400, 2600, 4000] -> [0, 500, 1200, 2400, 4000]
```

## 성공 기준

적용 후 smoke 기준:

| 기준 | 목표 |
|---|---|
| `/shop_payment/` 진입 후 Network `ev=InitiateCheckout` | 1초 안팎 |
| `cd[value]` | 있음 |
| `cd[currency]` | `KRW` |
| `fallback_source` | `biocom_block4_v0_5` 또는 새 버전 |
| 같은 세션 새로고침 | 중복 0 |
| native/FBE가 먼저 보낸 경우 | Block4 fallback skip |
| `Purchase` | 0 |

## 판단

서버 CAPI 운영 ON은 보류가 맞다.
브라우저 `InitiateCheckout`은 이미 살아 있으므로, 지금 문제는 서버 전송이 아니라 발화 속도와 품질이다.

따라서 다음 개선은 `InitiateCheckout CAPI`가 아니라 `Block4 fast path`다.
다만 Imweb footer를 바꾸는 작업이므로 운영 반영 전 별도 승인과 smoke가 필요하다.

## Source / Window / Freshness / Confidence

- source: Biocom Imweb Footer Block4 v0.5 candidate, TJ님 실제 Pixel Helper evidence, local code audit
- window: 2026-05-22 테스트 세션 기준
- freshness: 2026-05-22 12:53 KST
- confidence: 0.91

## 금지선

- Meta 운영 CAPI send: 실행하지 않음
- GTM publish: 실행하지 않음
- VM Cloud deploy/restart: 실행하지 않음
- Imweb header/footer 변경: 실행하지 않음
- raw order/member/payment identifier 출력: 하지 않음
