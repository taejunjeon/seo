# Builder dry-run v2 분포 측정 (gpt0508-40 작업5)

작성 시각: 2026-05-11 13:30:00 KST
실행 상태: dry-run script `backend/scripts/builder-dry-run-v2-20260511.ts` 실행 완료
자신감: 80% (mock fixture 기반 — 실측은 작업 6 peak canary 에서)

## 5줄 결론

1. enricher + injector + bridge 통합이 R2 ledger 11 row 스타일 입력에 대해 정확히 **3 카테고리 분포** 를 산출함: A_via_ledger_budget_floor 2 / paid_order_no_click_hold 6 / unpaid_order_bridge_hold 3.
2. `budget_usable=true` 는 click_view exact match 2 건에만 부여 — bridge 단독 승급 0건 invariant 유지.
3. operational DB / Google Ads API / VM SSH 호출 0 — stub queryPg + ledgerRowOverride + clickViewCandidates 인젝션 패턴 만으로 helper 합산 시뮬레이션 검증.
4. 5 카테고리 중 `pending_sync_lag_hold` 와 `paid_order_click_unknown_campaign` 은 본 mock 시나리오에서 0건 — peak canary 시 실측으로 채워질 분포.
5. 다음 단계: 작업 6 peak canary 가 TJ controlled traffic 한 두 클릭 + 결제 시도 (취소 OK) 로 실제 분포 측정.

## 1. 분포

| 카테고리 | 카운트 | 시나리오 |
|---|---|---|
| `A_via_ledger_budget_floor` | 2 | 5/9 Tag Assistant 2 row — paid_click_intent 매칭 + click_view exact + PAYMENT_COMPLETE |
| `paid_order_no_click_hold` | 6 | canary 001~006 — PAYMENT_COMPLETE 매칭, click_id_hash 부재 |
| `unpaid_order_bridge_hold` | 3 | canary 007 REFUND + 008 PENDING + 009 PAYMENT_FAILED |
| 총 | 11 | |

## 2. invariants

| invariant | 결과 |
|---|---|
| send_candidate / actual_send_candidate / upload_candidate | false / false / 0 |
| operational DB write / external API call | 0 / 0 |
| raw_pii_in_output | false |
| budget_usable 승급 조건 | click_view exact match only (2/11) |

## 3. 통합 흐름 검증

```
[MockRow] orderNo, hasClickIdHash, paymentStatus, clickViewMatch
   ↓
toLedgerRow() → OrderBridgeLedgerRow (sha256/hmac)
   ↓
enrichConfirmedPurchaseWithLedgerLookup({
  ledgerRowOverride,
  operationalPaymentCompleteLookupDeps: { isDatabaseConfigured, queryPg: stubQueryPg },
  clickViewCandidates: row-별 build
})
   ↓
cross_reference_evidence.category 카운트
```

각 helper 가 입력으로 받는 자료 타입과 출력 형식이 fixture 4/4 + 5/5 + 6/6 PASS 이후 실제 11 row 통합에서도 typecheck/runtime 통과.

## 4. 5 카테고리 중 본 dry-run 에서 0건

- `pending_sync_lag_hold` — stub 의 `now_utc` 와 `max_order_utc` 가 같아서 lag 0. 실측 peak canary 에서 운영DB sync lag 가 있을 때 발생.
- `paid_order_click_unknown_campaign` — click_view 매칭은 있지만 campaign_id 가 null 인 시나리오. 본 mock 에서는 campaign_id 채워 둠.

## 5. 다음 액션

### Claude Code가 할 일

1. 작업 6: peak canary 시점에 R2 ledger 신규 row 가 들어오면 enricher 를 통과시켜 실제 분포 측정 (필요 시 SSH 로 R2 ledger SELECT 후 로컬에서 enricher 적용).
2. 작업 7: 실측 분포 기반 다음 sprint 결정 문서 작성.

### TJ님이 할 일

KST 11~12 또는 19~20 시간대 1~2회 Google 광고 클릭 → checkout 시도 (취소 OK). bridge live 측정 활성화.

## 6. Verdict

`DRY_RUN_V2_DISTRIBUTION_PASS_LIVE_AWAIT_TJ_TRAFFIC`

산출 JSON: `data/builder-dry-run-v2-20260511.json`
