# cross_reference_evidence ledger_lookup integration (gpt0508-39 작업4)

작성 시각: 2026-05-11 10:54:00 KST
실행 상태: typecheck PASS / fixture 6/6 PASS / regression 5/5 PASS
자신감: 92%

## 한 줄 결론

작업 2/3에서 만든 operationalPaymentCompleteLookup + googleAdsClickViewExactLookup의 결과를 `classifyCrossReferenceEvidence`의 `ledger_lookup` 분기에 통합했소. 신규 5개 카테고리(`A_via_ledger_budget_floor` / `paid_order_click_unknown_campaign` / `paid_order_no_click_hold` / `unpaid_order_bridge_hold` / `pending_sync_lag_hold`)가 추가되고 기존 5 fixture는 회귀 없이 PASS.

## 1. 새 카테고리 + 분기

| 조건 | 카테고리 | budget_usable |
|---|---|---|
| ledger_row_present + payment_status not in (PAYMENT_COMPLETE, empty) | `unpaid_order_bridge_hold` | ❌ |
| ledger_row_present + payment_complete_match=false | `pending_sync_lag_hold` | ❌ |
| ledger_row_present + paid + click_view exact + campaign_id 존재 | **`A_via_ledger_budget_floor`** | ✅ |
| ledger_row_present + paid + click_view exact + campaign_id 부재 | `paid_order_click_unknown_campaign` | ❌ |
| ledger_row_present + paid + click_view exact 없음 | `paid_order_no_click_hold` | ❌ |
| ledger_row_present 미설정 | 기존 분기 유지 (A_via_ledger / B~G / H_unknown) | varies |

## 2. CrossReferenceLedgerLookup 새 필드 6개

```ts
ledger_row_present?: boolean;
payment_complete_match?: boolean;
payment_status?: string | null;
click_view_exact_match?: boolean;
campaign_id?: string | null;
sync_lag_status?: "fresh" | "lagged" | "stale" | "unknown";
```

기존 4개 필드(paid_click_intent_same_order_match / order_bridge_same_order_match / matched_click_id_type / matched_hash_prefix)는 그대로 유지 — 호환성 보장.

## 3. fixture 6/6 PASS

| # | 시나리오 | 결과 |
|---|---|---|
| 1 | ledger paid + click_view_exact + campaign_id → A_via_ledger_budget_floor (budget_usable=true) | PASS |
| 2 | ledger paid + click_view exact + campaign_id 부재 → paid_order_click_unknown_campaign | PASS |
| 3 | ledger paid + no click_view exact → paid_order_no_click_hold | PASS |
| 4 | ledger unpaid (REFUND_COMPLETE) → unpaid_order_bridge_hold | PASS |
| 5 | ledger sync lag pending → pending_sync_lag_hold | PASS |
| 6 | raw 응답 노출 0 (JSON.stringify scan) | PASS |

## 4. regression 5/5 PASS

기존 fixture 5개(`backend/tests/confirmed-purchase-cross-reference-evidence.test.ts`, gpt0508-35 작성)는 새 ledger_lookup 분기와 충돌 없이 모두 PASS.

## 5. invariants

| invariant | 상태 |
|---|---|
| send_candidate / actual_send_candidate / upload_candidate | false / false / 0 |
| raw email/phone/order_no 응답 노출 | 0 |
| ledger_lookup undefined 호환 | YES (기존 호출 그대로 동작) |

## 6. 다음 액션

### Claude Code가 할 일

1. (다음 sprint) builder `buildConfirmedPurchaseNoSendPreview` 안에서 본 helper들의 결과를 ledger_lookup 인자로 wire — 본 sprint 작업 5 dry-run이 그 wire 후 builder 응답에 자동 포함
2. (다음 sprint) googleAdsClickViewExactLookup 의 clickViewCandidates inject 자동화 — Google Ads click_view 조회 caller 추가

### TJ님이 할 일

본 integration 자체에 추가 액션 없음.

## 7. Verdict

`INTEGRATION_PASS_FIXTURE_PASS_NO_REGRESSION`

산출 JSON: `data/cross-reference-evidence-ledger-lookup-integration-20260511.json`
