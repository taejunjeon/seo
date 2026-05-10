# R2 ledger row → paid_order_click_exact 승급 분류기 (gpt0508-38 작업3)

작성 시각: 2026-05-11 02:00:00 KST
실행 상태: helper + fixture **7/7 PASS** (157ms), typecheck PASS
자신감: 90%

## 한 줄 결론

R2 wire가 쌓는 `session_only_quarantine` row가 “못 씀”에서 멈추지 않고, **운영DB PAYMENT_COMPLETE same-order + Google Ads click_view exact 결합으로 `A_via_ledger_budget_floor`(=paid_order_click_exact) 까지 승급**될 수 있는 helper를 코드와 fixture로 박았소. 본 sprint 작업 4 ledger_lookup wire readiness가 이 helper를 사용.

## 1. 분류 세트

| 라벨 | budget_usable | 조건 |
|---|---|---|
| **A_via_ledger_budget_floor** (≡ paid_order_click_exact) | ✅ | ledger order_no_hash 존재 + 운영DB `PAYMENT_COMPLETE` + Google Ads `click_view` exact 매칭 |
| paid_order_no_click_hold | ❌ | ledger order 존재 + PAYMENT_COMPLETE + click exact 부재 |
| unpaid_order_bridge_hold | ❌ | 운영DB status가 `REFUND_COMPLETE` / `CANCELLED_BEFORE_DEPOSIT` / `PAYMENT_PREPARATION` / `VIRTUAL_ACCOUNT_PENDING` |
| session_only_quarantine_no_paid_evidence | ❌ | ledger session_only_quarantine + 운영DB join 미매칭 (sync lag 또는 미발생) |
| do_not_classify | ❌ | order_no_hash 부재 등 분류 불가 |

## 2. 코드 변경

| 파일 | 종류 | LOC |
|---|---|---|
| `backend/src/orderBridgeLedgerBudgetClassifier.ts` | 신규 helper | 132 |
| `backend/tests/order-bridge-ledger-budget-classifier.test.ts` | 신규 fixture | 92 |

## 3. fixture 결과

| # | 시나리오 | 결과 |
|---|---|---|
| 1 | paid + click exact + click_view match → `A_via_ledger_budget_floor` | PASS |
| 2 | paid + no click exact → `paid_order_no_click_hold` | PASS |
| 3 | `REFUND_COMPLETE` → `unpaid_order_bridge_hold` | PASS |
| 4 | `VIRTUAL_ACCOUNT_PENDING` → `unpaid_order_bridge_hold` | PASS |
| 5 | session_only_quarantine + no payment join yet → `session_only_quarantine_no_paid_evidence` | PASS |
| 6 | order_no_hash absent → `do_not_classify` | PASS |
| 7 | invariants(send/actual/upload) 항상 false 유지 | PASS |

총: **7/7 PASS, 157ms**.

## 4. 핵심 invariants

- `send_candidate=false`, `actual_send_candidate=false`, `upload_candidate=false` 항상 (budget_usable=true 인 경우에도 invariant 유지)
- raw email/phone/order/payment/member_code 입력/출력 0
- email/phone identity 보강은 후순위 — order_no_hash + click_id_hash + 운영DB confirm 3축으로 budget_usable 결정
- exact evidence 없는 row 의 budget_usable 승급 0
- time-window-only 에 의한 승급 0

## 5. 다음 sprint wire target

본 helper 는 ConfirmedPurchasePrep `cross_reference_evidence.ledger_lookup` 분기 안에서 호출.
- input: ledger row 한 건 + 운영DB read-only PAYMENT_COMPLETE join + Google Ads click_view exact lookup
- output: classification + budget_usable + campaign_id + click_id_type
- send/upload 후보 승급은 본 helper로는 불가 (별도 Red 승인 + 동의/검증 절차).

## 6. 다음 액션

### Claude Code가 할 일

1. (작업 4) ConfirmedPurchasePrep ledger_lookup wire readiness 산출물 작성
2. (다음 sprint) cross_reference_evidence helper 안에서 본 classifier 호출 + 운영DB read-only PAYMENT_COMPLETE lookup 함수 추가

### TJ님이 할 일

본 helper 자체에 추가 액션 없음.

## 7. Verdict

`HELPER_READY_FIXTURE_PASS_WIRE_NEXT_SPRINT`

산출 JSON: `data/r2-session-only-to-paid-order-click-exact-plan-or-patch-20260511.json`
