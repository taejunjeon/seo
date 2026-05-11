# Paid click intent same-session bridge (gpt0508-40 작업3)

작성 시각: 2026-05-11 12:35:00 KST
실행 상태: helper + fixture **4/4 PASS** (156ms), typecheck PASS
자신감: 85%

## 5줄 결론

1. R2 ledger row 에 `click_id_hash` 가 없을 때 같은 `ga_session_id` / `client_id` 의 `paid_click_intent_ledger` row 에서 click evidence 를 보강할 수 있는지 평가하는 read-only helper `evaluatePaidClickIntentSameSessionBridge` 신설.
2. fixture 4/4 PASS — same-session match / no-match / unpaid-hold / raw 미노출 검증.
3. **bridge 단독으로 budget_usable=true 승급 절대 없음** (helper 시그니처에 `budget_usable_candidate: false` 리터럴 박힘). exact 승급은 click_view exact lookup 만 가능.
4. local_session_id_hash 비교는 R2 row 가 이미 hash 라 raw paid_intent local_session_id 와 직접 비교 불가 → 추후 paid_intent 도 hash 컬럼 추가 시 enable.
5. audit 결과 sprint canary 9 row 중 same-session match 예상 0건 — TJ controlled traffic 작업6 에서 실측.

## 1. helper signature

```ts
evaluatePaidClickIntentSameSessionBridge({
  ledger_rows: [{ r2_row_hash, sessionKey: { ga_session_id, client_id, local_session_id_hash }, payment_complete_match }],
  paidIntentCandidates: [{ intent_id, rawClickIdValue, click_id_type, ga_session_id, client_id, local_session_id, captured_at_iso }],
}) → {
  total_candidates_scanned, bridged_rows,
  rows: [{ r2_row_hash, paid_intent_session_match, paid_intent_click_hash_present, click_id_type, match_strength, budget_usable_candidate: false, blocked_reason }],
  warnings,
}
```

## 2. fixture 4/4 PASS

| # | 시나리오 | match_strength | blocked_reason | 결과 |
|---|---|---|---|---|
| 1 | same ga_session_id + click present | `same_session_exact` | null | PASS |
| 2 | no session match | `none` | `no_same_session_paid_intent_match` | PASS |
| 3 | session match + payment_complete=false | `same_session_exact` | `unpaid_or_pending_payment_complete` | PASS |
| 4 | raw click_id 응답 노출 0 (JSON.stringify scan) | — | — | PASS |

## 3. policy invariants

| invariant | 결과 |
|---|---|
| `budget_usable_candidate` 최대값 | `false` (리터럴 타입) |
| time-window-only 매칭 인정 | 거부 |
| raw click_id_value echo | 0 |

## 4. 설계 메모

- bridge 는 evidence 보강 helper. budget_usable=true 승급은 click_view exact 만 부여.
- match key 우선순위: `ga_session_id` > `client_id`. local_session_id_hash 비교는 추후 paid_intent 도 hash 컬럼 추가 시 enable.
- candidate 의 rawClickIdValue 는 transient — caller 가 paid_click_intent_ledger 에서 fetch 후 helper 호출 → match 성공 시 enricher 에 forward 해 sha256Hex → click_view exact lookup.
- 0건 매칭 시 warnings 에 paidIntentCandidates 비어있음 명시 — caller 의 candidates inject 누락 디버깅용.

## 5. live 예상

audit `click-evidence-capture-gap-audit-20260511` 기준 sprint canary 9 row 중 same-session match 예상 **0건**. TJ controlled traffic (작업 6, KST 11~12 또는 19~20) 에서 첫 실측 가능. 작업 6 시점에 `paid_click_intent_ledger` 가 새 click 을 잡으면 bridge 통과 후 click_view exact 까지 forwarding.

## 6. 다음 액션

### Claude Code가 할 일

1. 작업 4: `googleAdsClickViewExactLookup` candidates inject automation 추가 — Google Ads click_view 30d 또는 paid_click_intent_ledger 1h read-only fetch 자동화.
2. 작업 5: builder dry-run v2 — 11 row 에 enricher 통과시켜 5 카테고리 분포 측정.
3. 작업 6: peak canary + TJ controlled traffic 시점에 bridge live 측정 (`bridged_rows` 카운트).

### TJ님이 할 일

작업 6 peak canary 시점에 본인 Google 광고 1~2 클릭 → 결제 시도 (취소 OK) 로 same-session bridge live 측정 도와주시기.

## 7. Verdict

`BRIDGE_HELPER_PASS_FIXTURE_PASS_LIVE_AWAIT_TJ_TRAFFIC`

산출 JSON: `data/paid-click-intent-same-session-bridge-20260511.json`
