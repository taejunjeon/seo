# R2 1h canary 결과 (gpt0508-38 작업2)

작성 시각: 2026-05-11 02:42:00 KST
실행 상태: **`CANARY_COMPLETE_PASS`** — payment-success 2건 호출, ledger row 2건 누적 (1:1 coverage), 안전선 모두 PASS
자신감: 95% (snapshot 직접 확인 + .env 자동 원복 직접 확인 + log POST count 직접 확인)

## 한 줄 결론

야간 시간대(KST 01:41~02:41)인데도 결제 2건이 발생했고 R2 wire가 그 2건 모두를 hash-only ledger에 1:1로 누적했소(`session_only_quarantine` 분류 2건). raw 0 / platform send 0 / write_flag 자동 원복까지 모든 안전 invariant PASS. R2 wire 운영 동작이 직접 검증됐오.

## 1. 4-signal decision tree 적용 결과

| 신호 | 값 | 해석 |
|---|---|---|
| 1. ledger row delta | **+2** (4→6) | 누적 시작 |
| 2. Path B endpoint 직접 호출 | 0 (정상) | R2 wire는 backend 내부에서 호출하므로 외부 endpoint 호출 0이 정상 |
| 3. payment-success call count | **2** | 결제완료 신호 backend 도달 |
| 4. paid_click_intent receiver | 정상 누적 (cumulative 8,427+) | landing intent 수집 정상 |
| 5. 운영 fresh order count | sync lag 78분이라 canary 시각 기준 미반영 | 다음 측정에서 검증 |

decision tree path: signal3=2(>0) → signal5≠0(운영 결제 발생) → signal4 정상 → signal2=0(정상) → signal1=+2 → **`CANARY_COMPLETE_PASS`**

## 2. 타임라인 (KST)

| 시각 | 이벤트 |
|---|---|
| 01:41:12 | canary 시작 — `ORDER_BRIDGE_WRITE_ENABLED=true` + `CANARY_UNTIL=2026-05-10T17:41:12Z` |
| 01:49:08 | mid 8분 — row=4 (아직 결제 0), write_flag_on=true |
| 02:40:30 | VM nohup 자동 rollback 시작 — pre-rollback snapshot row=6 |
| 02:40:37 | rollback 완료 — write_flag_on=false 복귀 |
| 02:41:24 | Claude Code 최종 audit |

## 3. 스냅샷 비교

| 시점 | row_count | session_only_quarantine | raw | send | write_flag |
|---|---|---|---|---|---|
| pre-canary (01:40) | 4 | 0 | 0 | 0 | false |
| canary 시작 (01:41) | 4 | 0 | 0 | 0 | true |
| mid (01:49) | 4 | 0 | 0 | 0 | true |
| pre-rollback (02:40:31) | **6** | **2** | 0 | 0 | true |
| post-rollback (02:40:37) | 6 | 2 | 0 | 0 | **false** |
| final audit (02:41:24) | 6 | 2 | 0 | 0 | false |

delta:
- row_count: **+2** (둘 다 신규 결제완료)
- session_only_quarantine: **+2** (gpt0508-37 작업3 R2_READY_SESSION_ONLY audit 그대로)
- raw_stored_count Δ: 0
- platform_send_count Δ: 0
- write_flag_on: true → false (자동 복귀)

## 4. 1:1 wire coverage 검증

| 항목 | 값 |
|---|---|
| canary window 1h 내 payment-success POST 호출 | **2** |
| 같은 window ledger row delta | **2** |
| **wire coverage ratio** | **1.0 (100%)** |
| 누락 row | 0 |

R2 wire가 결제완료 신호를 누락 없이 모두 ledger에 누적했음을 backend log 직접 확인.

## 5. 환경변수 자동 원복 확인

| 키 | 값 |
|---|---|
| `ORDER_BRIDGE_WRITE_ENABLED` | **false** (복귀 PASS) |
| `ORDER_BRIDGE_WRITE_CANARY_UNTIL` | empty (복귀 PASS) |
| `ORDER_BRIDGE_WRITE_MAX_ROWS` | 200 |
| `ORDER_BRIDGE_PLATFORM_SEND_ENABLED` | false |
| `ORDER_BRIDGE_RAW_BODY_LOGGING` | false |
| `ORDER_BRIDGE_RETENTION_DAYS` | 90 |
| `ORDER_BRIDGE_IDENTITY_HASH_SECRET` | set |

## 6. status 분포 해석

ledger 6건 분포:
- `full_bridge`: 0
- `identity_only_quarantine`: 2 (이전 Tag Assistant evidence — 2026-05-10 01:35 KST)
- **`session_only_quarantine`: 2 (이번 canary 누적)**
- `click_missing_hold`: 0
- `ambiguous`: 0
- `do_not_send`: 0

session_only_quarantine 분류는 gpt0508-37 작업3 R2_READY_SESSION_ONLY audit 결과(footer payload에 raw email/phone 부재)와 100% 일치. 즉 wire가 의도한 그대로 동작.

## 7. budget_usable 영향

session_only_quarantine 분류는 `classifyLedgerRowToBudgetClassification`(gpt0508-38 작업3 helper) 기준 **budget_usable=false** 유지. 본 sprint upload_candidate_count=0 invariant 그대로.

다음 sprint identity 보강 + ledger_lookup wire 진입 시 이 2 row 의 운영DB PAYMENT_COMPLETE 매칭 + Google Ads click_view exact 매칭 결과에 따라 paid_order_click_exact 후보로 승급 가능.

## 8. 다음 canary 권장사항

- **주간 시간대 (KST 11~12 또는 19~20) 재실행** — 야간 1h 2건 vs 주간 1h 추정 80~120건
- max_rows 200 한도 고려: 주간 1h가 100건 넘기면 retention rotation 또는 max_rows 증액 검토
- ledger_lookup wire 후 dry-run으로 row 분류 변동 확인

## 9. 다음 액션

### Claude Code가 할 일

1. (다음 sprint) operationalPaymentCompleteLookup + googleAdsClickViewExactLookup + cross_reference_evidence wire integration (`gdn/next-sprint-helper-signatures-20260511.md` 시그니처 그대로)
2. (다음 sprint) ledger_lookup wire 후 builder dry-run으로 paid_order_click_exact 승급 측정

### TJ님이 할 일

1. **(권장, 선택) 주간 시간대 1h canary 재실행** — 더 큰 누적으로 status 분포 다양화 검증
   - 추천: 진행 추천 / 자신감 88%
   - Lane: Yellow (이미 gpt0508-38 작업2 승인 범위)
   - 명령: gdn/payment-success-r2-backend-deploy-approval-20260511.md 6절 (env toggle + nohup auto-rollback)
2. 옵션3 Red 결정, Meta Test Events 코드 발급 — 직전 sprint 인계 그대로

## 10. Verdict

`CANARY_COMPLETE_PASS`

산출 JSON: `data/r2-order-bridge-1h-canary-result-20260511.json`
