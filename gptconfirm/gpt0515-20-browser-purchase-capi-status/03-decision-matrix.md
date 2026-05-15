# Decision Matrix

작성 시각: 2026-05-15 16:38 KST

## 현재 분기

현재는 **CAPI sent success + Browser Purchase not observed** 분기다.

| 조건 | 현재 결과 |
|---|---|
| CAPI sent success | YES |
| Browser Purchase observed | NO / not confirmed |
| 현재 결론 | 서버 구매 신호는 복구됨. Browser Purchase는 보조 문제 |
| 단건 backfill | 필요 없음 |
| console Purchase diagnostic | 지금은 비추천 |

## 분기별 판단

### 1. CAPI sent success + diagnostic Purchase success

해석:
Meta 수신 경로는 정상이다. Browser Purchase 운영 미발화는 Header Guard, wrapper chain, page lifecycle 문제로 좁혀진다.

다음 행동:
- 운영 복구는 CAPI 유지.
- Browser Purchase guarded fallback은 중복 방지 설계 후 천천히 적용한다.

### 2. CAPI sent success + diagnostic Purchase fail

해석:
서버 경로는 정상이고, 브라우저 경로에 브라우저 정책/차단/Pixel helper 표시 문제가 있다.

다음 행동:
- CAPI를 primary 복구 경로로 유지.
- Browser Pixel은 AddToCart/InitiateCheckout/AddPaymentInfo까지만 먼저 안정화한다.

### 3. CAPI not sent + diagnostic Purchase success

해석:
서버 CAPI candidate gate 또는 auto-sync가 문제다. 브라우저 endpoint 자체는 살아 있다.

다음 행동:
- 단기: Red 승인 후 단건 CAPI backfill.
- 중기: CAPI candidate gate와 auto-sync schedule을 패치한다.
- Browser Purchase guarded fallback은 보조안이다.

### 4. CAPI not sent + diagnostic Purchase fail

해석:
Meta 수신 경로 자체, Pixel/Dataset, 정책, 브라우저 차단, 계정 설정을 다시 봐야 한다.

다음 행동:
- Pixel ID와 Dataset 연결 확인.
- Meta Events Manager Test Events를 다시 확인.
- CAPI test-only와 browser test-only를 각각 분리한다.

## 지금 선택해야 할 액션

1. **서버 CAPI 모니터 유지**: 추천 92%.
2. **같은 주문 Browser Purchase diagnostic 보류**: 추천 90%.
3. **다음 결제에서 Browser Purchase 관찰**: 추천 75%.
4. **운영 코드에 Browser Purchase fallback 즉시 삽입**: 추천 35%, 지금은 보류.

## 금지선

- 같은 주문에 추가 Purchase를 무승인으로 보내지 않는다.
- pending/가상계좌/unknown은 Purchase로 보내지 않는다.
- Browser fallback은 반드시 `allow_purchase`와 dedupe를 요구한다.
