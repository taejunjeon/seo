# Missing Queue Triage

## 기준

- source: VM Cloud SQLite `attribution_ledger` + VM Cloud `meta-capi-sends.jsonl`
- site: biocom
- pixel_id: `1283400029487161`
- window: last 7d
- checked_at_kst: 2026-05-15 17:50
- raw order/payment/member/click id output: 0

## 최신 분류

요청 프롬프트에는 12건 / 2,385,485원으로 기록돼 있었지만, 최신 read-only 재조회 기준으로는 15건 / 2,754,484원이다. 새 confirmed row가 추가되어 queue가 늘어난 것으로 본다.

분류:

```json
{
  "backfill_ready": {
    "count": 7,
    "amount_krw": 1159999,
    "meaning": "confirmed + value > 0 + payment_key present + no matching CAPI success"
  },
  "legacy_missing_payment_key": {
    "count": 8,
    "amount_krw": 1594485,
    "meaning": "confirmed이지만 payment_key가 없어 바로 CAPI send 후보로 올리면 중복/오매칭 위험"
  },
  "no_send_guard": {
    "count": 0,
    "amount_krw": 0
  },
  "duplicate_or_already_sent": {
    "count": 0,
    "amount_krw": 0
  },
  "needs_toss_or_imweb_confirm": {
    "count": 0,
    "amount_krw": 0
  }
}
```

## 해석

`backfill_ready` 7건은 Red 승인 없이는 보내지 않는다. 지금 해야 하는 일은 자동 전송이 아니라, 프론트에서 이 queue를 “즉시 전송 후보”와 “키 보강 필요 후보”로 나누어 보여주는 것이다.

`legacy_missing_payment_key` 8건은 금액이 더 크다. 이 묶음은 운영DB sync, Toss direct, Imweb API 또는 기존 legacy key mapping 보강이 먼저다.

## 프론트 표시 문구

- `backfill_ready`: “결제완료는 확인됐고 CAPI 전송만 빠진 후보”
- `legacy_missing_payment_key`: “결제키가 없어 바로 보내면 중복 위험”
- `no_send_guard`: “0원/취소/환불/정책 차단”
- `duplicate_or_already_sent`: “이미 같은 주문이 전송된 것으로 보임”
- `needs_toss_or_imweb_confirm`: “Toss/Imweb 상태 확인 필요”
