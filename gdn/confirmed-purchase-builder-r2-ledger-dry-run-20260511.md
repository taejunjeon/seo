# ConfirmedPurchasePrep builder R2 ledger dry-run (gpt0508-39 작업5)

작성 시각: 2026-05-11 10:55:00 KST
실행 상태: **`DRY_RUN_PASS_WIRE_CONNECTED_2_ROWS_PAID_BUT_NO_CLICK`** — 운영DB 와 R2 ledger 첫 실측 연결 검증
자신감: 95%

## 한 줄 결론

gpt0508-38 R2 canary가 누적한 신규 2 row를 본 sprint helper 3개로 분류해 보니, **둘 다 운영DB `tb_iamweb_users.order_number` 와 HMAC 1:1 매칭 + `PAYMENT_COMPLETE` 확인** — R2 wire가 운영 데이터와 진짜 연결됐다는 직접 증거요. 다만 click_id_hash 부재로 cross_reference 분류는 `paid_order_no_click_hold` 2건, **`A_via_ledger_budget_floor` 승급은 0건** (예상대로).

## 1. dry-run 입력

| 항목 | 값 |
|---|---|
| ledger order_no_hash 2 row | prefix `598f3a69`, `f2498ee8` (64자리 full hash 사용, 출력엔 prefix 8자리만) |
| ledger click_id_hash | 0 (둘 다 gclid 없는 결제) |
| operational PAYMENT_COMPLETE 검사 윈도우 | 7일 (운영DB read-only) |
| google_ads click_view 검사 | skip (click_id_hash 부재) |

## 2. operationalPaymentCompleteLookup 결과

| 지표 | 값 |
|---|---|
| candidates_scanned (7d) | 642 |
| matches | **2** |
| pending_sync_lag | 0 |
| unpaid_hold | 0 |

row별 상세:

| prefix | match | match_key_type | payment_status | payment_method_family | amount_krw_bucket |
|---|---|---|---|---|---|
| 598f3a69 | ✅ | `order_number_hash` | PAYMENT_COMPLETE | card | ₩10~30만 |
| f2498ee8 | ✅ | `order_number_hash` | PAYMENT_COMPLETE | card | ₩10~30만 |

## 3. googleAdsClickViewExactLookup 결과

| 지표 | 값 |
|---|---|
| total_ledger_hashes | 0 (입력 click_id_hash 없음) |
| matches | 0 |
| source_blocked | 0 (자동 skip) |
| skip_reason | "ledger click_id_hash absent in both rows" |

## 4. cross_reference_evidence 분류

| prefix | category | budget_usable | blocker_reason |
|---|---|---|---|
| 598f3a69 | `paid_order_no_click_hold` | ❌ | `paid_but_no_click_view_exact` |
| f2498ee8 | `paid_order_no_click_hold` | ❌ | `paid_but_no_click_view_exact` |

## 5. summary 카운트

| 항목 | 값 |
|---|---|
| total_r2_rows_from_canary | 2 |
| session_only_quarantine_before | 2 |
| payment_complete_matched | **2** |
| click_view_exact_matched | 0 |
| campaign_id_exact_matched | 0 |
| **paid_order_click_exact / A_via_ledger_budget_floor** | **0** |
| paid_order_no_click_hold | 2 |
| unpaid_order_bridge_hold | 0 |
| pending_sync_lag_hold | 0 |
| upload_candidate_count | 0 |
| send_candidate_count | 0 |
| actual_send_candidate_count | 0 |

## 6. 핵심 발견 (사람의 언어로)

1. **R2 wire가 운영DB와 정말 연결됐다는 첫 운영 데이터 증거** — order_no_hash 2건 모두 운영DB `tb_iamweb_users.order_number` HMAC와 정확히 매칭(match_key_type=order_number_hash). gpt0508-38 1h canary 동안 들어온 결제 2건이 실제로 가게에 들어온 매출이라는 게 hash로 확인됐오.
2. 둘 다 **카드 결제 ₩10~30만** 사이 진짜 매출이오. 다만 footer가 결제완료 시점에 gclid를 안 보낸 결제라 "Google 광고가 들여보낸 손님"이라고는 증명 불가.
3. 이 두 row는 internal ROAS 분자(NPay actual 합류 + 카드 매출 합산)에는 이미 반영됐고, **광고 floor 후보로는 자동 승급되지 않소** — 본 sprint 정책 그대로.
4. `budget_usable = 0`은 wire 결함이 아니라 광고 클릭이 없는 결제였기 때문. 다음 주간 canary 또는 다음 sprint에서 gclid 보유 결제가 들어오면 자동으로 `A_via_ledger_budget_floor` 후보가 측정될 것.

## 7. 검증

| 항목 | 결과 |
|---|---|
| 운영DB read-only query | PASS |
| HMAC 매칭 (transient) | PASS |
| raw email/phone/order_number/click_id 출력 | 0 |
| send_candidate / actual_send_candidate / upload_candidate | 0 |
| 운영DB write | 0 |
| 외부 전송 | 0 |

## 8. 다음 액션

### Claude Code가 할 일

1. (본 sprint 작업 6) 주간 시간대 1h canary 재실행 — google traffic 비율이 더 높은 시간 (KST 11~12 또는 19~20)
2. (다음 sprint) helper 3개를 ConfirmedPurchasePrep `buildConfirmedPurchaseNoSendPreview` 안에 wire — 본 dry-run의 결과가 builder 응답에 자동 포함되도록
3. (다음 sprint) googleAdsClickViewExactLookup 의 `clickViewCandidates` inject 자동화 — Google Ads click_view API 호출 또는 paid_click_intent_log read-only 조회 caller 추가

### TJ님이 할 일

본 dry-run에 추가 액션 없음. 작업 6 주간 canary는 본 sprint Claude Code가 시도, 시간대 안 맞으면 인계.

## 9. Verdict

`DRY_RUN_PASS_WIRE_CONNECTED_2_ROWS_PAID_BUT_NO_CLICK`

산출 JSON: `data/confirmed-purchase-builder-r2-ledger-dry-run-20260511.json`
