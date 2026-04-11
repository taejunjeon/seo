# CAPI / Pixel Purchase 정합성 운영 테스트 결과 - 2026-04-12

## 최신 결론

v3 Guard는 **가상계좌 미입금 Purchase 차단에는 성공했지만, 카드 결제 Purchase까지 차단하는 회귀가 확인되어 최종 운영안으로는 부적합**하다.

카드 결제 완료 주문에서도 Meta Pixel Helper에 아래처럼 `Purchase`가 아니라 `VirtualAccountIssued`가 찍혔다.

```text
결제 완료 URL:
https://biocom.kr/shop_payment_complete?order_code=o20260411ffcf4b110f72e&payment_code=pa202604114e7d185d01605&order_no=202604123633105&rk=S

실제 표시 이벤트:
VirtualAccountIssued
Event ID: VirtualAccountIssued.o20260411ffcf4b110f72e
value: 35000
currency: KRW
Pixel ID: 1283400029487161
```

이건 카드 confirmed 구매가 Meta Browser `Purchase`로 남지 않는 문제라서 즉시 수정 대상이다.

## 바로 실행한 조치

v4 Guard 코드를 작성했다.

```text
파일:
/Users/vibetj/coding/seo/footer/header_purchase_guard_0412_v4.md

버전:
2026-04-12-vbank-purchase-guard-v4
```

v4 원칙은 다음과 같다.

```text
명확한 가상계좌/입금대기 신호가 있으면 Purchase 차단
그 외에는 Purchase 통과
```

즉 카드 결제 또는 결제수단을 브라우저 문구만으로 확정할 수 없는 완료 화면은 `Purchase`를 통과시킨다. 카드 매출 누락을 막는 것이 우선이기 때문이다.

로컬 시뮬레이션 결과:

| 케이스 | 결과 |
|---|---|
| 가상계좌/계좌번호/입금기한/입금대기 문구 있음 | `Purchase` 차단, `VirtualAccountIssued` 전송 |
| 신용카드 문구 있음 | 기존 `Purchase` 통과 |
| 결제수단 문구를 못 찾는 unknown 완료 화면 | 기존 `Purchase` 통과 |

`node --check /tmp/biocom_purchase_guard_v4.js` 문법 검증도 통과했다.

## 지금 해야 할 운영 조치

아임웹 헤더 코드 최상단의 기존 v3 블록을 아래 파일의 v4 전체 코드로 교체한다.

```text
/Users/vibetj/coding/seo/footer/header_purchase_guard_0412_v4.md
```

푸터 코드는 건드리지 않는다.

교체 후 카드 결제 완료에서 기대값:

```text
Purchase
Event ID: Purchase.o20260411ffcf4b110f72e 같은 Purchase.{orderCode}
value: 35000
currency: KRW
```

교체 후 가상계좌 미입금에서 기대값:

```text
VirtualAccountIssued
Event ID: VirtualAccountIssued.o20260411a9f1cba638b60
value: 35000
currency: KRW
Pixel ID: 1283400029487161
```

단, v4는 unknown 완료 화면을 `Purchase` 통과로 둔다. 따라서 가상계좌 페이지에서 입금대기/가상계좌 문구가 DOM에 전혀 없으면 Purchase가 다시 통과될 수 있다. 그래도 카드 confirmed 구매를 놓치는 v3보다는 v4가 운영상 안전하다.

## 네이버페이 이슈

네이버페이 결제 테스트에서는 Pixel이 아예 뜨지 않은 것으로 보인다. 또한 결제 완료 후 바이오컴 자사몰 주문완료 페이지가 아니라 네이버페이 쪽으로 이탈되는 흐름이 있다.

이건 헤더 Guard 문제가 아니라 결제 완료 return URL / 외부 결제 플로우 문제다.

해결 방향은 두 갈래다.

1. 네이버페이 결제 완료 후 바이오컴 주문완료 페이지로 돌아오게 설정 가능한지 확인한다.
2. 브라우저 복귀가 불안정하면 네이버페이/아임웹 주문 API 또는 서버 원장 기준으로 confirmed 주문만 Server CAPI `Purchase`를 보내는 방식으로 보완한다.

즉 네이버페이는 Browser Pixel만 믿으면 안 되고, 서버 CAPI confirmed 전송이 더 중요하다.

## 최종형 계획

브라우저 문구 기반 Guard는 임시 방어다. 가장 정확한 구조는 서버 주문 상태 조회 기반이다.

권장 구조:

```text
1. 주문완료 페이지 진입
2. 헤더 Guard가 order_no / payment_code / order_code를 읽음
3. https://att.ainativeos.net/api/attribution/payment-decision 같은 공개 read-only endpoint로 조회
4. 서버가 Toss API, 아임웹 주문 API, 로컬 Attribution 원장을 조합해 confirmed / pending / unknown 판단
5. confirmed면 Browser Purchase 통과
6. pending이면 Browser Purchase 차단 후 VirtualAccountIssued 전송
7. unknown이면 운영 정책상 카드 매출 누락 방지를 위해 일단 Purchase 통과 또는 짧은 재조회
```

이 endpoint는 아직 운영 배포된 기능이 아니다. 지금 바로 가능한 것은 v4 헤더 코드 교체이고, 서버 조회형 Guard는 다음 개발 단계다.

## 기존 v3 가상계좌 테스트 결과

## 라이브 반영 상태

2026-04-12 KST 기준, v3 적용 당시 라이브 HTML에서 아래 버전이 확인됐다.

```text
snippetVersion: 2026-04-12-vbank-purchase-guard-v3
logPrefix: [biocom-purchase-guard-v3]
Meta Pixel ID: 1283400029487161
GTM: GTM-W2Z6PHN
```

직접 확인되는 Meta Pixel `init`은 아래 1개다.

```text
fbq('init', '1283400029487161', {'external_id' : ''}, {'agent':'plimweb'});
```

## 이번 테스트 주문

테스트 흐름은 다음과 같다.

```text
결제 시작 URL:
https://biocom.kr/shop_payment/?order_code=o20260411a9f1cba638b60&order_no=202604123890630&order_member=m2022021990714e913a3de

결제 완료 URL:
https://biocom.kr/shop_payment_complete?order_code=o20260411a9f1cba638b60&payment_code=pa2026041183a3aba83dac2&order_no=202604123890630&rk=S

결제수단:
가상계좌

입금 상태:
미입금

금액:
35000 KRW
```

## 결제하기 페이지 이벤트

결제하기 페이지에서는 `InitiateCheckout`이 정상 발화했다.

```text
Event: InitiateCheckout
Pixel ID: 1283400029487161
value: 35000.00
currency: KRW
Event ID: InitiateCheckout.o20260411a9f1cba638b60.571ed
URL:
https://biocom.kr/shop_payment/?order_code=o20260411a9f1cba638b60&order_no=202604123890630&order_member=m2022021990714e913a3de
```

이 이벤트는 결제 시도/결제 시작 신호이므로 유지하는 것이 맞다. 아직 매출 확정이 아니므로 `Purchase`와 다르게 해석해야 한다.

## 토스페이먼츠 창

가상계좌를 선택해 토스페이먼츠 PG 창으로 이동했을 때 Pixel Helper에 Meta Pixel이 뜨지 않았다.

이건 문제라기보다 정상에 가깝다. 토스페이먼츠 결제창은 바이오컴 도메인이 아니라 PG사 페이지라서, 우리 아임웹 사이트의 Meta Pixel이 그대로 동작하지 않는 것이 자연스럽다.

## 주문완료 페이지 이벤트

주문완료 페이지에서는 `Purchase` 대신 `VirtualAccountIssued`가 잡혔다.

```text
Event: VirtualAccountIssued
Pixel ID: 1283400029487161
value: 35000
currency: KRW
Event ID: VirtualAccountIssued.o20260411a9f1cba638b60
URL:
https://biocom.kr/shop_payment_complete?order_code=o20260411a9f1cba638b60&payment_code=pa2026041183a3aba83dac2&order_no=202604123890630&rk=S
```

이번 결과에서 중요한 점은 `Events on this page`에 `Purchase`가 보이지 않았다는 것이다. 따라서 이전에 확인됐던 “가상계좌 미입금 주문완료에서도 Browser Purchase가 value=35000/39000으로 발화되는 문제”는 v3 기준으로 막혔다.

## 왜 이게 중요한가

가상계좌는 주문완료와 입금완료가 다르다.

미입금 상태에서 Browser Pixel `Purchase`가 나가면 Meta는 아직 실제 매출이 아닌 주문을 구매로 볼 수 있다. 반면 우리 내부 Attribution은 confirmed, 즉 결제 승인/입금 확인 이후만 매출로 본다.

그래서 이 문제가 있으면 Meta ROAS가 내부 Attribution ROAS보다 높게 보이는 구조적 원인이 된다.

이번 v3 Guard는 미입금 가상계좌를 `Purchase`가 아니라 `VirtualAccountIssued`로 낮춘다. 즉 Meta에는 “결제 의향/가상계좌 발급” 신호는 남기되, 매출 확정 구매로는 세지 않게 만든다.

## 현재 기준 이벤트 정의

| 상황 | Browser Pixel | Server CAPI | 내부 Attribution |
|---|---:|---:|---:|
| 결제 시작 | `InitiateCheckout` | 없음 | checkout_started 원장 |
| 가상계좌 발급, 미입금 | `VirtualAccountIssued` | `Purchase` 전송 안 함 | pending |
| 카드 결제 완료 | `Purchase` 유지 | `Purchase` 전송 | confirmed |
| 가상계좌 입금 완료 | Browser는 이미 지나간 화면이라 없음 | `Purchase` 전송 대상 | confirmed |

## 남은 검증

1. v4 교체 후 카드 결제 회귀 테스트

카드 결제 완료에서는 Browser Pixel `Purchase`가 떠야 한다. v3에서는 카드 결제도 `VirtualAccountIssued`로 내려가는 회귀가 확인됐으므로, v4 교체 후 다시 확인해야 한다.

기대값:

```text
Event: Purchase
Event ID: Purchase.{아임웹 order_code}
value: 결제금액
currency: KRW
```

2. 이번 가상계좌 주문의 내부 원장 상태 확인

주문번호 `202604123890630`은 입금 전이므로 우리 자체 원장에서는 `pending`이어야 한다. 서버 CAPI 운영 `Purchase`로 나가면 안 된다.

기대값:

```text
payment_success: pending
Server CAPI Purchase: 없음
```

3. 입금 후 상태 전환 확인

나중에 이 가상계좌 주문을 실제 입금하면, 내부 원장이 confirmed로 바뀌고 서버 CAPI가 `Purchase`를 보내는지 확인해야 한다.

기대값:

```text
Server CAPI event_name: Purchase
Server CAPI event_id: Purchase.o20260411a9f1cba638b60
custom_data.order_id: 202604123890630
value: 35000
currency: KRW
```

4. 과거 데이터 해석

v4 적용 전 이미 Meta로 들어간 가상계좌 미입금 `Purchase` 또는 카드 결제 `VirtualAccountIssued`는 소급 수정되지 않는다. 따라서 Meta ROAS 비교는 v4 적용 이후 구간을 따로 잘라 봐야 한다.

추천 기준:

```text
pre-v4: v4 적용 전
post-v4: 2026-04-12 v4 적용 이후
```

## 현재 판단

v3 테스트로 Meta ROAS 과대 후보 중 하나였던 **가상계좌 미입금 Browser Purchase 오염**은 막을 수 있다는 방향은 확인됐다.

하지만 카드 결제까지 `VirtualAccountIssued`로 낮춘 회귀 때문에 v3는 최종안이 아니다. 현재 최우선은 v4로 교체해 카드 결제 `Purchase`를 복구하는 것이다.

다만 전체 Meta ROAS와 내부 Attribution ROAS 차이가 완전히 해결됐다고 보려면 아직 아래가 더 필요하다.

- v4 적용 후 카드 결제에서 Purchase가 정상 유지되는지 확인
- v4 적용 후 가상계좌 미입금에서 `VirtualAccountIssued`만 남는지 확인
- v4 이후 24시간, 48시간, 7일 단위로 Meta Purchase 수가 정상화되는지 확인
- 가상계좌 입금 완료 시 서버 CAPI Purchase가 정확히 나가는지 확인
- Server CAPI와 Browser Pixel의 confirmed 주문 event_id가 계속 `Purchase.{orderCode}`로 일치하는지 확인

## 다음 액션

바로 다음은 v4 헤더 코드 교체다.

v4 교체 후 같은 순서로 테스트한다.

1. 카드 결제 완료에서 `Purchase`가 뜨는지 확인한다.
2. 가상계좌 미입금 완료에서 `Purchase`가 사라지고 `VirtualAccountIssued`만 뜨는지 확인한다.
3. 네이버페이는 별도 이슈로 분리한다. 자사몰 주문완료 페이지로 복귀하지 않으면 Browser Pixel이 아니라 Server CAPI confirmed 전송으로 보완해야 한다.
