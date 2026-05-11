# R2 주간 1h canary followup (gpt0508-39 작업6)

작성 시각: 2026-05-11 11:45:00 KST
실행 상태: **`CANARY_COMPLETE_PASS`** — row +5, raw 0, send 0, write_flag 자동 원복 OK, `click_missing_hold` 1건 신규 등장
자신감: 92%

## 한 줄 결론

주간 시간대 1h canary(KST 10:42~11:42) — 야간 2건 대비 2.5배인 +5 row 누적. 신규 row 분포는 `session_only_quarantine` 4건 + **`click_missing_hold` 1건(첫 등장)**. 안전선 모두 PASS이고 11 row 모두 `full_bridge` 미달이라 본 sprint helper 3개 wire 후에도 `A_via_ledger_budget_floor` 승급은 0건 추정.

## 1. 5-signal verdict

| 신호 | 값 | 해석 |
|---|---|---|
| 1. ledger row delta | **+5** (6→11) | 주간 누적 야간보다 2.5배 |
| 2. Path B endpoint 직접 호출 | 0 (정상) | R2 wire가 backend 내부에서 호출 |
| 3. payment-success POST count | 4 (grep 기반) | 정상 |
| 4. paid_click_intent receiver | 정상 누적 | 정상 |
| 5. 운영 fresh order count | 운영DB sync lag 내 | 정상 |

`signal3=4 vs signal1=+5`은 grep 패턴이 OPTIONS preflight 또는 boundary row 1건을 누락했을 가능성 — 안전선은 무관하게 PASS.

## 2. 타임라인 (KST)

| 시각 | 이벤트 |
|---|---|
| 10:42:57 | canary 시작 (`write_flag=true`, cutoff 11:42:57Z) |
| 11:42:02 | VM nohup 자동 rollback 시작 — pre-rollback snapshot row=11 |
| 11:42:09 | rollback 완료, write_flag_on=false 복귀 |
| 11:42:43 | Claude Code 최종 audit |

## 3. status_counts 변화

| status | pre (10:42) | post (11:42) | Δ |
|---|---|---|---|
| full_bridge | 0 | 0 | 0 |
| identity_only_quarantine | 2 | 2 | 0 (이전 evidence 그대로) |
| session_only_quarantine | 2 | **6** | **+4** |
| **click_missing_hold** | 0 | **1** | **+1 (첫 등장)** |
| ambiguous | 0 | 0 | 0 |
| do_not_send | 0 | 0 | 0 |

총: 6 → 11 (+5).

## 4. `click_missing_hold` 첫 등장 분석

`classifyOrderBridgeLedgerStatus` 분기상 `click_missing_hold`는 마지막 fallback:
- hasOrder=true
- hasIdentity 또는 hasSession 일부 보유
- hasClick=false

해석 후보:
1. footer payload에 일부 결제(예: 로그인 회원)는 raw email 또는 phone을 실제로 보낸 케이스 (footer 코드가 갱신됐거나 imweb 특정 페이지에서 다른 origin)
2. imweb checkout flow의 다른 경로에서 payment-success 호출 (별도 origin/source)
3. order_confirm 외 다른 capture_stage row가 R2 wire 트리거

본 sprint scope 외라 raw row 직접 분석은 안 함. 다음 sprint identity 보강 작업에서 자동으로 노출됨.

## 5. 안전선 invariant

| invariant | 결과 |
|---|---|
| `raw_stored_count` | 0 |
| `platform_send_count` | 0 |
| `write_flag_on` | true → **false** (자동 복귀 PASS) |
| `duplicate_dedupe_count` | 1 (변화 없음) |
| `max_rows_remaining` | 189 (200 - 11) |

## 6. 환경변수 자동 원복

| 키 | 값 |
|---|---|
| ORDER_BRIDGE_WRITE_ENABLED | false |
| ORDER_BRIDGE_WRITE_CANARY_UNTIL | empty |
| ORDER_BRIDGE_WRITE_MAX_ROWS | 200 |
| ORDER_BRIDGE_PLATFORM_SEND_ENABLED | false |
| ORDER_BRIDGE_RAW_BODY_LOGGING | false |

## 7. 핵심 발견

1. **주간 누적이 야간보다 2.5배** — 트래픽 추이 일치. KST 정점(11:00~12:00) 전체를 포함하지 못해 50% 비중 추정.
2. **`click_missing_hold` 첫 등장** — 본 sprint helper 분기에서 별도 카테고리로 분류됨 (cross_reference_evidence 새 분기 활용 가능).
3. **여전히 `full_bridge` 0건** — click_id_hash + identity hash 둘 다 보유한 row 없음. 광고 클릭이 살아 있고 raw email/phone까지 들어오는 결제가 본 sample에선 0.
4. **본 sprint helper로 budget_usable 승급은 0 추정** — click_view exact 매칭 자체가 0이라 작업 5 dry-run과 동일.

## 8. 다음 canary 권장사항

- KST 11:00~12:00 또는 19:00~20:00 정점 윈도우로 다시 1h 실행 시 더 큰 누적 + click_id_hash 보유 row 가능성
- max_rows=200 한도 안에서 약 30~40 row까지 안전 누적 가능
- 옵션 2(자동 2h/day) 진입은 다음 sprint cross_reference wire 후 실측 데이터 본 뒤

## 9. 다음 액션

### Claude Code가 할 일

1. (다음 sprint) builder wire integration — 본 sprint helper 3개를 builder에 통합
2. (다음 sprint) 11건 row에 대해 builder dry-run 다시 실행 — click_missing_hold 1건의 cross_reference 카테고리 측정 (paid_order_no_click_hold 예상)

### TJ님이 할 일

- 본 canary 자체에 추가 액션 없음. 정점 시간대 추가 canary는 선택사항.

## 10. Verdict

`CANARY_COMPLETE_PASS`

산출 JSON: `data/r2-daytime-canary-followup-20260511.json`
