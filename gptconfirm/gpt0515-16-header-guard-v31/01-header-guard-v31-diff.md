# 01. Header Guard v3.1 Diff

작성 시각: 2026-05-15 KST

## 한 줄 결론

기존 hotfix는 timeout을 늘린 응급 처치이고, v3.1은 결제완료 페이지에 들어오는 순간 서버 판단을 미리 받아서 Browser Purchase 시도 때 즉시 통과할 수 있게 만드는 보강이다.

## 기존 v3 hotfix 유지 항목

- `requestTimeoutMs`: 8000ms 유지
- `holdMs`: 50ms 유지
- `decisionRetryDelayMs`: 500ms 유지
- `fetch cache: no-store` 유지
- `fetch keepalive: true` 유지
- `FB_PIXEL.Purchase` wrapper 유지
- `fbq('track', 'Purchase')` wrapper 유지
- `VirtualAccountIssued` 처리 유지
- `PurchaseDecisionUnknown` 처리 유지
- `PurchaseBlocked` 처리 유지
- unknown fail-open 금지 유지

## v3.1 신규 항목

1. 완료 페이지 진입 즉시 `payment-decision` prefetch를 실행한다.
2. prefetch 결과를 `sessionStorage`에 저장한다.
3. cache TTL은 2분이다.
4. cache key는 원문 주문/결제 ID가 아니라 브라우저 내부 hash 기반 safe key다.
5. cache value에는 `decision`, `browserAction`, `source`, `safe_ref`, `expiresAt`만 남긴다.
6. Purchase attempt가 들어오면 같은 주문/결제 safe key의 cached `allow_purchase`를 먼저 확인한다.
7. cached `allow_purchase`가 있으면 원래 `Purchase`를 즉시 통과시킨다.
8. cached `block_purchase_virtual_account`, `block_purchase`, `unknown`은 기존 차단 로직을 그대로 탄다.
9. prefetch 실패 시 기존 decision fetch 흐름으로 fallback한다.
10. payment-decision이 느리거나 실패해도 unknown fail-open은 하지 않는다.

## 교체 범위

아임웹 `헤더 코드 상단`에서 아래 script만 교체한다.

```text
snippetVersion: 2026-04-12-server-payment-decision-guard-v3
또는
server-payment-decision-guard-v3
```

교체하지 않는 것:

- Footer Block 3 v4.4.2
- Block 4 v0.4 funnel fallback
- Meta FBE 자산 연결
- GTM
- VM Cloud backend
- 운영DB

## 성공 기준

1. 완료 URL 진입 직후 `/api/attribution/payment-decision`이 200으로 끝난다.
2. sessionStorage에 `__biocom_payment_decision_guard_v31__:` prefix의 캐시가 생긴다.
3. 실제 결제완료에서 cached `allow_purchase` 또는 즉시 decision `allow_purchase`가 잡힌다.
4. Network에 `facebook.com/tr?...ev=Purchase...`가 1회 보인다.
5. 미입금/가상계좌/unknown에서는 Purchase가 0이고 `VirtualAccountIssued` 또는 `PurchaseDecisionUnknown`이 보인다.

## 실패 시 해석

- `payment-decision`이 200인데 Purchase가 없으면 browser/FBE Purchase 호출 자체가 없는 문제다.
- `payment-decision`이 `canceled`면 아직 page lifecycle 또는 timeout 문제가 남은 것이다.
- `payment-decision`이 `unknown`이면 VM Cloud 결제완료 매칭 또는 payment key/value guard가 닫히지 않은 것이다.
- Purchase가 미입금에서 뜨면 guard 회귀이므로 즉시 기존 Header로 롤백해야 한다.
