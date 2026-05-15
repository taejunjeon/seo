# Single Backfill Approval Packet

작성 시각: 2026-05-15 12:18 KST

## 목적

2026-05-15 오전 카드 결제완료 1건은 VM Cloud/Toss 기준 confirmed였지만 Meta CAPI send log에는 0건이었다. 이 문서는 그 1건만 Meta CAPI Purchase로 보내도 되는지 판단하기 위한 Red 승인안이다.

## 승인 문구

```text
[승인] safe_ref safe_80dd8eb5da6f Meta CAPI Purchase 단건 backfill 전송
```

## 범위

- 대상: `safe_ref=safe_80dd8eb5da6f` 1건.
- 금액: 11,900원.
- Pixel: 바이오컴 Pixel `1283400029487161`.
- event_name: Purchase.
- expected: attempted 1, events_received 1.

## 전송 전 preflight

전송 직전 다시 확인한다.

- VM Cloud SQLite `attribution_ledger`: payment_success confirmed 1건.
- Toss direct: DONE 계열 status.
- amount: 11,900원 일치.
- cancel/refund: 0.
- duplicate event_id: 0.
- existing successful Meta CAPI send: 0.
- target 외 후보: send 금지.

## 실패 조건

- candidate count가 1이 아님.
- amount mismatch.
- Toss status가 DONE/PAID/APPROVED가 아님.
- duplicate event_id 또는 duplicate order-event 발견.
- Pixel ID 불일치.

## 실패 시 행동

- send하지 않는다.
- 원인을 `duplicate`, `value_mismatch`, `status_not_done`, `target_not_found`, `token/API_error`로 분류한다.
- 추가 backfill은 새 Red 승인 없이는 진행하지 않는다.

## 실행하지 않은 것

이 문서 작성 시점에는 Meta CAPI 운영 Purchase 전송을 실행하지 않았다.
