# ConfirmedPurchasePrep ledger_lookup wire readiness (gpt0508-38 작업4)

작성 시각: 2026-05-11 02:08:00 KST
실행 상태: small lookup helper 추가 + design 완료
자신감: 88%

## 한 줄 결론

ledger_lookup wire에 필요한 4개 helper 중 **3개는 이미 ready**(classifyCrossReferenceEvidence / classifyLedgerRowToBudgetClassification / findOrderBridgeRowsByOrderHash). 다음 sprint에서 운영DB PAYMENT_COMPLETE lookup + Google Ads click_view exact lookup 두 함수만 추가하면 cross_reference_evidence가 R2 ledger row를 자동으로 `A_via_ledger_budget_floor`(=paid_order_click_exact)로 승급시킬 수 있소.

## 1. 이미 자리 잡은 컴포넌트

| 컴포넌트 | 파일 | 상태 | 출처 sprint |
|---|---|---|---|
| `classifyCrossReferenceEvidence` | `backend/src/confirmedPurchaseCrossReferenceEvidence.ts` | ready (5/5 PASS) | gpt0508-35 |
| `buildConfirmedPurchaseNoSendPreview` builder wire (ledger_lookup=null 상태) | `backend/src/routes/attribution.ts` | wired_with_ledger_lookup_null | gpt0508-35 |
| `recordPaymentSuccessOrderBridgeLedger` (R2 wire) | `backend/src/routes/attribution.ts` | deployed (write_flag=false 기본) | gpt0508-37 + gpt0508-38 deploy |
| `classifyLedgerRowToBudgetClassification` (paid_order_click_exact 승급 분류기) | `backend/src/orderBridgeLedgerBudgetClassifier.ts` | ready (7/7 PASS) | gpt0508-38 작업3 |
| **`findOrderBridgeRowsByOrderHash`** (신규 lookup helper, +18 LOC) | `backend/src/orderBridgeLedger.ts` | added in this sprint | gpt0508-38 작업4 |

## 2. 다음 sprint에 추가할 것

| 컴포넌트 | 목적 | 추정 LOC |
|---|---|---|
| `operationalPaymentCompleteLookup` | 운영DB read-only로 order_no 기준 PAYMENT_COMPLETE 상태 조회 (transient, hash 처리 즉시) | ~30 |
| `googleAdsClickViewExactLookup` | gclid/gbraid/wbraid 매칭 + campaign_id 반환 (기존 join-candidates 로직 통합) | ~40 |
| `cross_reference_evidence wire integration` | buildConfirmedPurchaseNoSendPreview 안에서 ledger_lookup={...} 채움 | ~40 |
| 운영 dry-run | 1h canary 누적 row 있을 때 builder dry-run 으로 budget_usable 분포 측정 | n/a |

## 3. 다음 sprint pseudo-code

```ts
async function attachLedgerLookup(orderNoHash: string, site: string) {
  const rows = findOrderBridgeRowsByOrderHash(orderNoHash, site);
  if (rows.length === 0) return null;

  const payment = await operationalPaymentCompleteLookup(orderNoHash); // transient input
  const click = await googleAdsClickViewExactLookup(rows[0].clickIdHash);

  const classification = classifyLedgerRowToBudgetClassification({
    ledger_row: rows[0].previewSnapshot,
    payment_complete_join: payment,
    click_view_exact: click,
  });

  return {
    paid_click_intent_same_order_match: classification.budget_usable,
    order_bridge_same_order_match: rows[0].clickIdHash !== "",
    matched_click_id_type: classification.click_id_type,
    matched_hash_prefix: rows[0].orderNoHash.slice(0, 8),
  };
}
```

## 4. 기대 효과 (full wire 후)

| 항목 | 현재 | full wire 후 |
|---|---|---|
| campaign_id matched | 31건 (gclid + click_view exact) | 31건 + ledger A_via_ledger_budget_floor 신규 row |
| campaign_id missing | 2,121건 | 일부가 ledger 누적과 함께 점진 감소 |
| budget_usable promotion 트리거 | 단일 source(body click_id) | body + ledger same-order 둘 다 |
| upload_candidate_count | 0 (sprint invariant) | 0 (변함 없음) |

첫 1h canary 누적 row 는 footer payload 에 raw email/phone 부재 + 운영DB sync lag 영향으로 **session_only_quarantine 비율이 큼** (직전 sprint 작업3 input audit 의 R2_READY_SESSION_ONLY 결과와 일치).

## 5. invariants 검증 (변함 없음)

- `send_candidate=false`, `actual_send_candidate=false`, `upload_candidate_count=0`
- raw email/phone/order/payment/member_code 입력/출력 0
- platform actual send 0
- 운영DB write 0

## 6. 검증

| 항목 | 결과 |
|---|---|
| backend typecheck | PASS |
| 신규 helper 추가 | `findOrderBridgeRowsByOrderHash` 1개 (+18 LOC) |
| 누적 fixture (이전 sprint 5 + 본 sprint 7) | PASS 12/12 |
| 응답/로그에 raw 노출 | 0 |

## 7. 다음 액션

### Claude Code가 할 일

1. (다음 sprint) `operationalPaymentCompleteLookup` + `googleAdsClickViewExactLookup` + cross_reference_evidence wire integration 작성
2. (다음 sprint, 의존성: 1h canary PASS) ledger row 누적 후 builder dry-run

### TJ님이 할 일

본 readiness에 추가 액션 없음.

## 8. Verdict

`READINESS_PASS_HELPERS_IN_PLACE_NEXT_SPRINT_FULL_WIRE`

산출 JSON: `data/confirmed-purchase-ledger-lookup-wire-readiness-20260511.json`
