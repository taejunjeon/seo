# Builder ledger lookup wire (gpt0508-40 작업2)

작성 시각: 2026-05-11 12:10:00 KST
실행 상태: helper + fixture **5/5 PASS** (223ms), typecheck PASS
자신감: 90%

## 한 줄 결론

`buildConfirmedPurchaseNoSendPreview` 호출 직후 R2 ledger lookup + 운영DB PAYMENT_COMPLETE + Google Ads click_view exact 분류를 자동 첨부하는 async helper `enrichConfirmedPurchaseWithLedgerLookup` 추가. 5/5 fixture PASS 로 5 카테고리(A_via_ledger_budget_floor / paid_order_no_click_hold / unpaid_order_bridge_hold / fallback default / raw 미노출) 검증.

## 1. helper signature

```ts
enrichConfirmedPurchaseWithLedgerLookup(
  input: { orderNo, site, clickIdentifiers?, paymentMethod?, utmCampaign?, pathBBridgePresent?, confirmedPaidPurchase? },
  deps: { hmacSecret, operationalPaymentCompleteLookupDeps?, clickViewCandidates?, ledgerRowOverride? },
): Promise<{
  ledger_row_present, ledger_row_count, ledger_status,
  payment_complete_match, payment_status, payment_method_family,
  click_view_exact_match, campaign_id, click_id_type,
  budget_classification, budget_usable,
  cross_reference_evidence,
  invariants_held,
}>
```

## 2. fixture 5/5 PASS

| # | 시나리오 | 결과 |
|---|---|---|
| 1 | ledger paid + click_view exact → `A_via_ledger_budget_floor` (budget_usable=true) | PASS |
| 2 | ledger paid + no click → `paid_order_no_click_hold` | PASS |
| 3 | ledger row absent → cross_reference fallback (기본 F~G 분기) | PASS |
| 4 | ledger paid REFUND → `unpaid_order_bridge_hold` | PASS |
| 5 | raw order_no / raw gclid 응답 노출 0 (JSON.stringify scan) | PASS |

## 3. 설계 결정

- `buildConfirmedPurchaseNoSendPreview` 는 sync 함수 그대로 유지 → 호환성 100%
- route 에서 preview 생성 후 enricher 호출 (await) → cross_reference_evidence 갱신
- ledger lookup(better-sqlite3) sync + 운영DB lookup async를 Promise 안에서 결합
- deps 패턴으로 stub 가능 → fixture 자동화

## 4. route integration 보류 사유

본 sprint scope: helper + fixture까지. confirmed-purchase no-send route 를 async 로 변경하는 wire는 별도 deploy 시점에 진행 권장 — 다음 sprint deploy approval 안에 wire 포함.

## 5. invariants

| invariant | 결과 |
|---|---|
| send_candidate / actual_send_candidate / upload_candidate | false / false / 0 |
| raw email/phone/order_no/click_id 응답 노출 | 0 |
| 운영DB write | 0 |
| hash 역산 시도 | none |

## 6. 다음 액션

### Claude Code가 할 일

1. (다음 sprint deploy) confirmed-purchase no-send route 를 async 로 변경 + await enricher 호출 wire
2. (다음 sprint) builder dry-run을 실시간 endpoint 호출로 대체

### TJ님이 할 일

본 helper 자체에 추가 액션 없음.

## 7. Verdict

`HELPER_PASS_FIXTURE_PASS_ROUTE_WIRE_NEXT_SPRINT`

산출 JSON: `data/confirmed-purchase-builder-ledger-lookup-wire-20260511.json`
