# CAPI Candidate Gate

작성 시각: 2026-05-15 12:18 KST

## 10초 요약

완료 URL에서 들어온 실제 결제완료 row가 `meta_purchase_candidate=false`라는 초기 보호 플래그 때문에 Meta CAPI 후보에서 빠질 수 있었다. 이번 패치는 완료 URL + confirmed + paymentKey + 양수 금액이면 runtime Toss value guard 대상으로 후보에 올리고, 전송 직전 Toss 상태와 중복을 다시 보게 한다.

## 무엇을 바꿨나

- `backend/src/metaCapi.ts`
  - `getMetaCapiNoSendReason`을 보강했다.
  - `payment_page_seen`은 여전히 절대 no-send다.
  - `payment_success + live + confirmed + completion signal + paymentKey + positive value`는 `meta_purchase_candidate=false`만으로 차단하지 않는다.
  - `value_guard_required_before_meta_send=true`여도 위 조건이면 runtime Toss 검증 대상으로 통과시킨다.
  - 실제 build 단계에서는 Toss status가 `DONE/PAID/APPROVED`가 아니면 send를 막는다.

## 계속 막는 것

- payment_page_seen.
- pending/unknown.
- 0원/음수.
- 취소/환불.
- value/source total mismatch.
- operational bridge no-send marker.
- duplicate event_id/order-event.

## 실제 target row dry-run

- source: VM Cloud SQLite `attribution_ledger` read-only.
- window: 2026-05-15 11:05-11:20 KST.
- rows_considered: 1.
- candidates_after_patch: 1.
- amount: 11,900원.
- no_send_reason_after_patch: 없음.

주의: dry-run은 전송이 아니다. Meta CAPI send는 0건이다.

## 의미

safe_ref 1건은 이제 Red 승인만 있으면 단건 backfill 후보가 될 수 있다. 다만 운영 자동 전송을 켜려면 배포 후 중복/금액/상태 guard를 post-snapshot으로 먼저 봐야 한다.
