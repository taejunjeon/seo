# 01. 카드 결제완료 1건 서버 추적

작성 시각: 2026-05-15 11:48 KST

## 추적 대상

- safe_ref: `safe_80dd8eb5da6f`
- raw order/payment/member/click id: 보고서에 출력하지 않음.
- 기준 window: 2026-05-15 00:00 KST 이후.

## Source별 확인 결과

### VM Cloud SQLite

위치: VM Cloud SQLite `backend/data/crm.sqlite3`, 테이블 `attribution_ledger`.

- window rows: 355.
- touchpoint 분포: checkout_started 125, payment_page_seen 168, payment_success 57, marketing_intent 5.
- payment_success 상태 분포: pending 20, confirmed 35, canceled 2.
- 대상 safe_ref matched rows: 3.
- matched touchpoints: payment_page_seen 1, checkout_started 1, payment_success 1.

대상 safe_ref의 결제완료 row:

- touchpoint: payment_success.
- payment_status: confirmed.
- logged_at: 2026-05-15 11:11:48 KST.
- amount: 11,900원.
- payment key presence: 있음.
- order id presence: 있음.
- checkout id presence: 있음.
- fbp presence: 있음.
- fbc/fbclid presence: 없음.
- snippet: `2026-05-15-biocom-payment-success-v4-4-2`.
- page class: payment_success_allowlist.

해석: VM Cloud에는 실제 결제완료 후보가 들어왔고, pending이 아니라 confirmed 상태다.

### 운영DB

위치: 운영DB PostgreSQL `dashboard.public.tb_iamweb_users`.

- matched rows: 0.
- 해석: 운영DB sync gap이다. 이 결과만으로 미결제라고 보면 안 된다.

`data/!data_inventory.md` 기준으로 운영DB는 개발팀 dashboard DB이며, 실시간 attribution 수신 원장은 VM Cloud다. 이번처럼 결제 직후 복구 판단에는 운영DB를 primary로 두면 늦다.

### VM Cloud payment-decision API

위치: `https://att.ainativeos.net/api/attribution/payment-decision`.

Toss direct ON:

- HTTP 200.
- response time: 3.7-3.9초.
- decision: confirmed.
- browserAction: allow_purchase.
- matchedBy: toss_direct_order_id.
- reason: toss_direct_api_status.
- 운영DB matched rows: 0.

Toss direct OFF:

- HTTP 200.
- response time: 2.9-3.5초.
- decision: confirmed.
- browserAction: allow_purchase.
- matchedBy: ledger_order_id.
- reason: attribution_ledger_status.

해석: 서버 판단 자체는 맞다. 문제는 응답 시간이 Header Guard timeout 3초와 비슷하거나 더 길다는 점이다.

### Imweb v2 API

위치: Imweb v2 API exact order lookup.

- exact lookup: matched.
- pay type candidate: card.
- amount presence: 있음.
- order time presence: 있음.
- complete time presence: 있음.
- item name presence: 2개.
- status candidate: WAIT.

해석: Imweb API에서도 주문은 찾았다. 다만 `WAIT`는 결제 정본 단독으로 쓰기 어렵다. 이 건은 Toss direct `DONE`과 VM Cloud `payment_success confirmed`가 더 강한 결제완료 근거다.

### Meta CAPI send log

위치: VM Cloud Meta CAPI send log, Pixel `1283400029487161`.

- since 2026-05-15 00:00 KST rows: 11.
- 대상 safe_ref matched rows: 0.

해석: 해당 카드 결제는 아직 서버 CAPI로 Meta에 전송되지 않았다.

## 결론

방금 카드 결제는 실제 결제완료로 보는 것이 맞다. 하지만 브라우저 Purchase는 payment-decision 응답을 기다리지 못했고, 서버 CAPI는 후보 필터에서 제외되어 Meta Purchase 복구가 닫히지 않았다.
