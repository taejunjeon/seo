# R2 canary row post-classification audit (gpt0508-39 작업1)

작성 시각: 2026-05-11 10:35:00 KST
실행 상태: read-only PASS / raw 출력 0 / hash prefix 8자리만 표시
자신감: 96%

## 한 줄 결론

gpt0508-38 1h canary에서 누적된 신규 2 row를 hash 길이와 prefix만으로 분해한 결과, 둘 다 **`session_only_quarantine_click_missing`** (order_no_hash 보유 + session 보유 + **click_id_hash 길이 0**)이오. 즉 둘 다 gclid 없는 결제라 본 sprint helper로 paid_order_click_exact 승급은 불가하고, 진짜 승급은 주간 시간대 canary에서 google traffic 비율이 더 높을 때를 기다려야 하오.

## 1. audit source

| 항목 | 값 |
|---|---|
| table | VM Cloud SQLite `order_bridge_ledger` |
| filter | `site='biocom' AND created_at >= '2026-05-10T16:41:00.000Z'` (canary 시작 직전 UTC) |
| method | ssh + sudo -u biocomkr_sns + better-sqlite3 read-only |
| raw 출력 | 0 (hash 길이 + 8자리 prefix만) |

## 2. 신규 2 row 상태표

| # | bridge_id (last 8) | created_at_kst | status | order_hash_len | click_hash_len | email_hash_len | phone_hash_len | session_id_len | ord_prefix |
|---|---|---|---|---|---|---|---|---|---|
| 1 | …82cbf1e | 02:19:13 KST | session_only_quarantine | 64 | **0** | 0 | 0 | client+ga 보유 | 598f3a69 |
| 2 | …d7d0bdab22 | 02:36:01 KST | session_only_quarantine | 64 | **0** | 0 | 0 | client+ga 보유 | f2498ee8 |

invariant 확인:
- duplicate_count: 0 / 0
- raw_payload_stored: 0 / 0
- platform_send_count: 0 / 0

## 3. 카테고리 분류

| 카테고리 | 건수 |
|---|---|
| `session_only_quarantine_click_present` | 0 |
| **`session_only_quarantine_click_missing`** | **2** |
| `missing_order_hash` | 0 |
| `duplicate_deduped` | 0 |
| `other` | 0 |

분류 근거: `hasOrder=true + hasIdentity=false (email/phone hash 0) + hasSession=true (client_id+ga_session_id) + hasClick=false (click_id_hash 0)`

## 4. paid_order_click_exact 승급 가능성

| row | operationalPaymentCompleteLookup | googleAdsClickViewExactLookup | 승급 가능 | 차단 사유 |
|---|---|---|---|---|
| #1 | POSSIBLE (order_no_hash 보유) | **BLOCKED** (click_id_hash 길이 0) | ❌ | `click_id_hash_absent` |
| #2 | POSSIBLE | **BLOCKED** | ❌ | `click_id_hash_absent` |

본 sprint helper 3개 wire 후에도 두 row의 `paid_order_click_exact` 승급 추정은 **0건**.

## 5. 사람이 이해하는 해석

야간(KST 02:19, 02:36) 결제 2건은 footer payload의 `tracking.gclid`가 비어 있었소. 가능성:
1. **direct/non-google traffic** — 사용자가 광고 클릭 없이 즐겨찾기/검색/직접 URL로 들어와 결제
2. **referrer chain에서 gclid 만료/소실** — 결제완료 시점에 referrer가 https://payment.imweb.me 같은 결제 페이지라 원래 landing의 gclid 정보 사라짐
3. **footer가 gclid를 _seo_funnel_session/localStorage에서 가져오는데, 그 storage 자체가 빈 경우** — 광고가 아닌 경로로 들어온 손님

야간이라 운영 결제 표본이 작아 분포가 우연일 가능성도 있소. **주간 시간대 canary에서는 google traffic 비율이 더 높아 click_id_hash 보유 row가 누적될 가능성**이 있고, 그게 본 sprint 작업 6의 추가 표본 목적.

## 6. 다음 helper 입력에 미치는 영향

| helper | 입력 |
|---|---|
| operationalPaymentCompleteLookup | order_no_hash 2건 (`598f3a69…`, `f2498ee8…`) — 운영DB 30d 후보 transient HMAC 후 비교 |
| googleAdsClickViewExactLookup | click_id_hash 0건 — 자동 `click_view_not_found` |
| cross_reference_evidence | 예상 분류: `paid_order_no_click_hold` (payment_complete 매칭 시) 또는 `session_only_quarantine_no_paid_evidence` (sync_lag) — 둘 다 budget_usable=false |

## 7. 검증

| 항목 | 결과 |
|---|---|
| read-only query | PASS |
| raw email/phone/order_no/click_id 출력 | 0 (hash 길이 + 8자리 prefix만) |
| 운영DB write | 0 |
| 외부 전송 | 0 |
| invariants(send/upload/raw_stored/platform_send) | 모두 0 유지 |

## 8. 다음 액션

### Claude Code가 할 일

1. (본 sprint 작업 2/3) operationalPaymentCompleteLookup + googleAdsClickViewExactLookup helper 구현 — order_no_hash 후보 매칭은 진행, click_view exact는 본 2 row 기준 0건 예상
2. (본 sprint 작업 4/5) cross_reference_evidence 통합 + dry-run — 2 row 모두 `paid_order_no_click_hold` 또는 sync_lag 분류 예상
3. (본 sprint 작업 6) 주간 시간대 canary 재실행으로 click_id_hash 보유 row 추가 표본 확보

### TJ님이 할 일

본 audit 자체에 추가 액션 없음.

## 9. Verdict

`AUDIT_PASS_BOTH_ROWS_CLICK_HASH_ABSENT_PROMOTION_BLOCKED_AT_CLICK_EVIDENCE`

산출 JSON: `data/r2-canary-row-post-classification-audit-20260511.json`
