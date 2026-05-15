# v3.1 대비 v3.1.1 변경 요약

작성 시각: 2026-05-15 15:40 KST

## 결론

v3.1.1은 새 Pixel 삽입이나 Purchase fail-open 코드가 아니다. 기존 Header Guard v3.1의 wrapper는 유지하고, 결제완료 decision cache만 더 안전하게 고친 버전이다.

## 바뀐 것

1. **버전 식별자 변경**
   - `2026-05-15-server-payment-decision-guard-v3-1`
   - `2026-05-15-server-payment-decision-guard-v3-1-1`

2. **cache prefix 변경**
   - 기존 v3.1 cache와 섞이지 않도록 `__biocom_payment_decision_guard_v311__:` 사용.

3. **canonical cache key 도입**
   - `orderCode/orderNo/paymentCode`와 `order_code/order_id/order_no/payment_code/payment_key`를 같은 결제건 기준으로 정규화.
   - raw order/payment 값을 sessionStorage key에 직접 저장하지 않고 hash/safe key만 사용.

4. **failure cache 금지**
   - `decision_fetch_failed`, endpoint error, parse failure는 캐시하지 않음.
   - 기존 `allow_purchase` cache가 있으면 failure/unknown이 덮어쓰지 못함.

5. **TTL 분리**
   - `allow_purchase`: 2분
   - `block_purchase_virtual_account`: 30초 이하
   - 명시적 `block_purchase`: 30초 이하
   - 명시적 server `unknown`: 10초 이하
   - fetch/parse failure: no-cache

6. **response parser 확장**
   - `body.decision.browserAction`
   - `body.browserAction`
   - `body.result.browserAction`
   - `body.data.browserAction`
   - `browser_action` 변형까지 읽음.

## 유지한 것

- `fbq` wrapper 유지.
- `FB_PIXEL.Purchase` wrapper 유지.
- `VirtualAccountIssued` 유지.
- `PurchaseDecisionUnknown` 유지.
- `PurchaseBlocked` 유지.
- `requestTimeoutMs=8000` 유지.
- `cache:'no-store'`, `keepalive:true` 유지.
- unknown fail-open 금지.
- 미입금/가상계좌 Purchase 0 원칙 유지.

## 하지 않은 것

- Footer 변경 없음.
- Block 4 변경 없음.
- GTM 변경 없음.
- VM Cloud 배포 없음.
- Meta CAPI 운영 send 없음.
