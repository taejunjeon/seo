# ConfirmedPurchasePrep cross_reference_evidence patch 결과 (gpt0508-35)

작성 시각: 2026-05-10 22:55:00 KST
실행 상태: **patch 적용 + typecheck PASS + fixture 5/5 PASS**
자신감: 92% (ledger 실제 lookup은 다음 sprint wire)

## 5줄 결론 (사람이 이해하는 언어로)

1. 지금까지는 "주문 결제완료 시점에 광고 클릭ID(gclid)가 같이 들어오는 31건"만 캠페인 ID에 붙고 나머지 2,121건은 "왜 못 붙였는지" 사람이 표로만 보고 있었소.
2. 이번에 builder 함수가 응답에 `cross_reference_evidence` 라는 필드를 추가하도록 바꿨소. 이 필드가 자동으로 카테고리(A~G)를 라벨링하오.
3. A=클릭ID 있음 / A_via_ledger=클릭ID 없지만 ledger에 같은 주문 hash 매칭 / C·D=NPay 결제+클릭 부재 / E·F=홈페이지 결제+클릭 부재 / G=Path B 흔적 있지만 결제완료 아님.
4. fixture 5개 모두 통과 — `npx tsc --noEmit` PASS, `npx tsx --test` PASS. 외부 전송/저장은 0 그대로요.
5. 다음 sprint에서 ledger lookup을 실제로 wire 하면 Path B canary가 쌓는 row 만큼 매칭 후보가 자동으로 늘어나오.

## 1. 무엇을 / 왜 / 어떻게

| 항목 | 값 |
|---|---|
| 무엇을 | `buildConfirmedPurchaseNoSendPreview` 응답에 `cross_reference_evidence` 필드 추가 + helper 모듈 + fixture 테스트 |
| 왜 | missing 2,121건의 카테고리 라벨이 사람 표로만 존재했고, 다음 input이 들어와도 자동 분류가 안 됐음. 이걸 자동화하면 다음 sprint에서 ledger row가 늘어나는 만큼 budget-usable 후보가 계산됨. |
| 어떻게 | helper 함수 1개 신규 + builder에 호출 + fixture test 5개 |
| 어디에서 | `backend/src/`, `backend/tests/` (operational PG/VM 변경 0) |

## 2. 변경 파일

| 파일 | 변경 종류 | LOC |
|---|---|---|
| `backend/src/confirmedPurchaseCrossReferenceEvidence.ts` | 신규 모듈 | 119 |
| `backend/src/routes/attribution.ts` | import + builder 안에서 호출 | +17 |
| `backend/tests/confirmed-purchase-cross-reference-evidence.test.ts` | 신규 fixture 테스트 | 86 |

## 3. 카테고리 라벨 (사람이 이해하는 정의)

| ID | 의미 | budget 사용 |
|---|---|---|
| A | 주문에 광고 클릭ID(gclid/gbraid/wbraid)가 들어옴 → 광고 학습 신호로 직접 사용 가능 | 가능 |
| A_via_ledger | 주문에는 클릭ID 없지만 ledger에 같은 주문 hash 매칭 → 다음 sprint ledger wire 후 활성 | 가능 |
| C | NPay 결제 완료 + 클릭ID 없음 + UTM만 있음 → 캠페인 추정 불가 | 불가 |
| D | NPay 결제 완료 + 클릭ID 없음 + UTM 없음 | 불가 |
| E | 홈페이지(카드/계좌) 결제 완료 + 클릭ID 없음 + UTM만 있음 | 불가 |
| F | 홈페이지 결제 완료 + 클릭ID 없음 + UTM 없음 | 불가 |
| G | Path B 흔적은 있는데 결제완료 신호가 아직 안 들어옴 (가상계좌 미입금 등) | 불가 |

## 4. fixture 테스트 결과

| # | 시나리오 | 기대 카테고리 | 결과 |
|---|---|---|---|
| 1 | homepage_confirmed_with_gclid_present | A_click_present_campaign_matched | PASS |
| 2 | homepage_confirmed_no_click_no_utm | F_homepage_no_click_no_utm | PASS |
| 3 | npay_confirmed_no_click_with_utm | C_npay_no_click_with_utm | PASS |
| 4 | vbank_unpaid_path_b_bridge_present | G_path_b_bridge_present_payment_not_confirmed | PASS |
| 5 | ledger_lookup_hit_promotes_to_A_via_ledger | A_via_ledger | PASS |

총: 5/5 PASS, duration 148ms.

## 5. 검증

| 검증 | 결과 | 명령 |
|---|---|---|
| backend typecheck | PASS | `npx tsc --noEmit` |
| backend fixture test | PASS 5/5 | `npx tsx --test tests/confirmed-purchase-cross-reference-evidence.test.ts` |
| send_candidate / actual_send_candidate / would_store / would_send | 모두 false 유지 | helper 출력 명시적 false |
| platform_send_count | 0 | 변경 없음 |
| raw PII 패턴 스캔 | PASS | grep로 0 hit |

## 6. 다음 sprint(gpt0508-36) wire 계획

- helper 함수의 `ledger_lookup` 인자에 실제 lookup 결과 채움.
  - paid_click_intent_log: same `order_no_hash` 또는 hashed identity material 매칭 시 `matched_click_id_type` / `matched_hash_prefix` 채움.
  - order_bridge_ledger: same `order_no_hash` + `click_id_hash` 매칭 시 동일.
- 둘 다 미스면 `ledger_lookup=null` 그대로 → 카테고리 B~G로 분기.
- Lane: Green code (backend route 변경, no platform send, no operational DB write).
- 의존성: Path B canary 1h 실행 후 ledger row 누적이 시작돼야 효과가 보임.

## 7. 다음 할일

### Codex가 할 일
1. Path B canary 결과 받으면 paid_click_intent_log + order_bridge_ledger lookup wire 코드 추가.
   - 추천: 진행 추천
   - 자신감: 90%
   - Lane: Green code
   - 의존성: 작업1 Path B canary 실행 결과
   - 성공 기준: ledger row가 1건이라도 매칭되면 builder 응답의 `cross_reference_evidence.category`가 `A_via_ledger`로 바뀌는 fixture 추가 PASS

### TJ님이 할 일
- 본 patch에 필요한 액션 없음. fixture 테스트는 자동 검증됨.

## 8. Verdict

`PATCH_EXECUTED_FIXTURE_PASS_LEDGER_WIRE_NEXT_SPRINT`

산출 JSON: `data/confirmed-purchase-cross-reference-evidence-patch-20260511.json`
