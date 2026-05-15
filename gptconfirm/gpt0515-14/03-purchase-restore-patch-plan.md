# 03. Purchase restore patch plan

작성 시각: 2026-05-15 11:48 KST

## 목표

실제 결제완료 주문은 3초 timeout에 걸리지 않고 `allow_purchase`를 받아 Browser Purchase가 통과되게 한다. 미입금/가상계좌/unknown은 계속 차단한다.

## P0. Header Purchase Guard v3.1

무엇을 바꾸나:

- `requestTimeoutMs`: 3000ms -> 7000ms 또는 8000ms.
- 완료 페이지 진입 즉시 `payment-decision` prefetch.
- prefetch 결과를 `sessionStorage`에 2분 TTL로 cache.
- Purchase attempt가 오면 cached `allow_purchase`를 먼저 사용.
- fetch에는 `cache: 'no-store'`, 가능하면 `keepalive: true`를 둔다.

왜 필요한가:

- 현재 서버가 `allow_purchase`를 만들어도 3초 안에 못 오면 브라우저가 Purchase를 막는다.
- timeout만 늘리면 UX 지연이 생길 수 있으므로 prefetch/cache가 같이 필요하다.

성공 기준:

- completion URL에서 payment-decision Network status가 `canceled`가 아니라 200.
- 서버 decision `allow_purchase`.
- `facebook.com/tr ev=Purchase`가 1회 발생.
- 미입금/가상계좌에서는 Purchase 0.

승인:

- 아임웹 Header 코드 변경은 TJ님 확인/저장 필요.
- GTM publish 아님.

## P1. VM Cloud payment-decision fast path

무엇을 바꾸나:

- 전체 attribution ledger를 읽기 전에 exact key로 VM Cloud SQLite `payment_success`를 먼저 찾는다.
- `payment_success confirmed + order/payment exact match`이면 즉시 `allow_purchase`를 반환한다.
- 운영DB는 실시간 primary가 아니라 cross-check/fallback으로 낮춘다.
- Toss direct는 결제키나 주문번호가 있을 때 short timeout으로 확인한다.
- Imweb v2 direct는 Toss가 없거나 NPay/아임웹 상태 확인이 필요할 때 보조로 둔다.

왜 필요한가:

- 현재 directToss OFF도 2.9-3.5초라 Header timeout 3초와 충돌한다.
- VM Cloud SQLite는 이 프로젝트의 실시간 수신 원장이므로 브라우저 Guard에는 더 적합하다.

성공 기준:

- 대상 safe_ref 같은 confirmed row는 500ms-1초 안에 `allow_purchase`.
- pending/unknown은 기존처럼 차단.
- 운영DB 0건이어도 VM Cloud/Toss 근거가 있으면 confirmed 처리.

승인:

- VM Cloud backend deploy/restart가 필요하므로 Yellow 승인 필요.

## P2. VM Cloud realtime payment cache

무엇을 바꾸나:

- payment-success 수신 시 paymentKey/orderId가 있으면 Toss direct를 즉시 확인한다.
- confirmed면 VM Cloud에 `confirmed_source=toss_direct_api`, `value_guard_passed=true`를 저장한다.
- Imweb v2 direct는 Toss key가 없거나 주문 상태 보조 확인이 필요할 때 fallback으로 사용한다.
- 운영DB는 나중에 cross-check로 붙인다.

왜 필요한가:

- 운영DB sync를 기다리면 결제 직후 Browser Purchase/CAPI가 늦어진다.
- VM Cloud에 빠른 결제 판단 cache를 두면 브라우저와 서버 CAPI가 같은 정본을 본다.

schema 선택:

- 빠른 안: 기존 `attribution_ledger.metadata_json`에 status/value guard marker를 보강한다. schema migration 없음.
- 확장 안: `payment_decision_cache` 테이블을 추가한다. 이 경우 VM Cloud schema migration이므로 별도 Yellow 승인 필요.

## P3. guarded browser Purchase fallback

조건:

- completion URL.
- payment-decision cached result가 `allow_purchase`.
- native/FBE Purchase network count가 0.
- sessionStorage dedupe 통과.

금지:

- unknown fail-open.
- unguarded Purchase.
- payment_page_seen에서 Purchase.

이 안은 P0/P1 뒤에도 native Purchase가 불안정할 때만 적용한다.
