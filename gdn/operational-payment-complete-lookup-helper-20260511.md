# operationalPaymentCompleteLookup helper (gpt0508-39 작업2)

작성 시각: 2026-05-11 10:50:00 KST
실행 상태: helper + fixture **5/5 PASS** + live dry-run PASS
자신감: 92%

## 한 줄 결론

R2 ledger의 `order_no_hash`를 운영DB `tb_iamweb_users.order_number`(또는 `order_section_item_no`)와 read-only HMAC 비교로 매칭하는 helper 추가. **hash 역산 금지 / raw order_no·email·phone·payment·member_code 응답 절대 노출 0**. live dry-run에서 gpt0508-38 canary 신규 2 row 모두 운영DB와 `order_number_hash` 매칭 + `PAYMENT_COMPLETE` 확인.

## 1. helper signature

```ts
lookupOperationalPaymentComplete({
  site: "biocom",
  ledgerOrderHashes: ReadonlyArray<string>,  // 64-char HMAC hex
  windowDays?: number,                       // default 30
  hmacSecret: string,
}, deps?: { isDatabaseConfigured?, queryPg? }): Promise<{
  ok, window_days, candidates_scanned, matches, pending_sync_lag, unpaid_hold,
  rows: Array<{
    ledger_order_no_hash, payment_complete_match, match_key_type,
    payment_status, payment_method_family, amount_krw_bucket, sync_lag_note,
  }>,
  warnings,
}>
```

## 2. fixture 5/5 PASS

| # | 시나리오 | 결과 |
|---|---|---|
| 1 | ledger order_hash matches order_number HMAC → payment_complete_match=true | PASS |
| 2 | ledger order_hash matches channel_order_no HMAC → match_key_type=channel_order_no_hash, npay family | PASS |
| 3 | ledger order_hash no match → pending_sync_lag count++ | PASS |
| 4 | payment_status=REFUND_COMPLETE → unpaid_hold count++ | PASS |
| 5 | raw order_no 응답 노출 0 (JSON.stringify scan) | PASS |

## 3. 동작 절차

1. 운영DB read-only로 최근 N일 후보 fetch (raw `order_number` / `channel_order_no` 포함, transient input only)
2. 함수 내부 transient HMAC 처리 — Map<HMAC hex, candidate row>
3. ledger order_no_hash와 동일 HMAC을 가진 row만 매칭으로 인정
4. 응답에는 hash와 status/method/bucket/sync_lag_note만 — raw 값은 함수 종료 후 폐기

## 4. live dry-run (gpt0508-38 canary 2 row)

| 지표 | 값 |
|---|---|
| 입력 ledger hash | 2건 |
| candidates_scanned 7d | 642 |
| matches | **2** |
| match_key_type | `order_number_hash` |
| payment_status | `PAYMENT_COMPLETE` |
| payment_method_family | `card` |
| amount_krw_bucket | `100000_to_300000` |
| sync_lag_note | `stale` (query 시점 변동) |

## 5. 검증

| 항목 | 결과 |
|---|---|
| typecheck (`npx tsc --noEmit`) | PASS |
| fixture (`npx tsx --test`) | PASS 5/5 |
| live dry-run | PASS (2/2 matches) |
| raw 응답 노출 | 0 |
| 운영DB write | 0 |

## 6. 다음 액션

### Claude Code가 할 일
1. 작업 4 cross_reference_evidence integration에서 본 helper의 결과를 `ledger_lookup` 인자로 wire
2. 다음 sprint builder integration에서 운영 dashboard 응답에 분류 결과 표시 검토

### TJ님이 할 일
본 helper 자체에 추가 액션 없음.

## 7. Verdict

`HELPER_PASS_FIXTURE_PASS_LIVE_DRY_RUN_PASS`

산출 JSON: `data/operational-payment-complete-lookup-helper-20260511.json`
