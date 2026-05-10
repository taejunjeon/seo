# ConfirmedPurchasePrep integration next-step (gpt0508-34)

작성 시각: 2026-05-10 22:10:00 KST
Lane: Green design / dry-run / 로컬 산출물 (code touched: 0)
자신감: 90% (paid_click_intent ledger 매칭 hit-rate가 미지)

## 5줄 결론

1. missing 2,121건의 진짜 원인은 `imweb 주문 테이블에 gclid/gbraid/wbraid가 안 따라온다`는 것이다. 그래서 builder 호출 시점에 click_identifiers가 비어 있고 click_view exact join이 31건에 고정된다.
2. builder를 단일 order body가 아니라 `body + paid_click_intent ledger + order_bridge ledger + Google Ads click_view 30d` 4 evidence cross-reference로 확장해야 다음 sprint에 matched가 자동으로 늘어난다.
3. 운영 PG payment_complete를 primary confirmed source로 두고, NPay click/count/add_payment_info와 VM Cloud complete_time blank-only 기준은 confirmed 판정에서 제외 유지.
4. 본 sprint는 design + fixture dry-run 계획까지. 코드는 다음 sprint(gpt0508-35) Yellow approval 후 wire.
5. 추천 옵션은 patch_candidate_1(builder에 cross_reference_evidence 필드 추가) + 4 fixture test PASS 게이팅이고 자신감 90%.

## 1. 현재 builder audit

엔트리: `backend/src/routes/attribution.ts:1104` `buildConfirmedPurchaseNoSendPreview`.

| 영역 | 현재 |
|---|---|
| input keys | site, order_number, channel_order_no, payment_method, signal_stage, paid_at, value, currency, client_id, ga_session_id, gclid, gbraid, wbraid, fbclid, ttclid, page_location, page_referrer, is_test/manual/canceled/refunded |
| block_reasons | `read_only_phase`, `approval_required`, `signal_stage_must_be_payment_complete`, `blocked_signal_stage_<npay_click/add_payment_info>`, `invalid_paid_at`, `invalid_value`, `currency_not_allowed`, `test_order`, `manual_order`, `canceled_order`, `refunded_order` |
| evidence sources currently joined | (1) body의 click_identifiers — present only, (2) Google Ads click_view — 별도 batch에서 join (runtime 미합산) |
| evidence sources NOT joined yet | paid_click_intent_ledger / order_bridge_ledger / npay_intent_log / operational PG payment_complete window / VM Cloud confirmed_purchase_prep recalc snapshot |

## 2. bottleneck root cause

| 카테고리 | 건수 | 원인 |
|---|---|---|
| E (홈페이지+UTM) | 1,054 | imweb order에 gclid 미저장 |
| F (홈페이지+UTM 없음) | 933 | imweb order에 gclid 미저장 |
| C (NPay+UTM) | 27 | NPay flow에서 gclid가 channel_order_no에 따라오지 않음 |
| D (NPay+UTM 없음) | 107 | 동상 |

primary root cause: builder 호출 시 `click_identifiers`가 비어 있음.
secondary root cause: builder가 paid_click_intent ledger와 order_bridge ledger를 같은 order key로 cross-reference 하지 않음.

## 3. next-step 설계

### 3.1 patch_candidate_1 — builder에 cross_reference_evidence 필드 추가

- scope: `buildConfirmedPurchaseNoSendPreview` 내부.
- 동작:
  1. input의 click_identifiers가 비어 있으면 hashed identity material(email/phone/order)로 `paid_click_intent_ledger` + `order_bridge_ledger`에서 same-order exact match를 lookup.
  2. exact match가 있으면 `cross_reference_evidence = { category: 'A_via_ledger', source_table, click_id_type, hash_prefix }`.
  3. 없으면 `category: B~G + blocker_reason`.
  4. send_candidate=false / actual_send_candidate=false / would_store=false 유지.
- 코드 추정량: 약 60 LOC.
- 본 sprint 적용 여부: ❌ 적용 안 함 (design only).

### 3.2 patch_candidate_2 — same-window input builder pipeline에 4 evidence merge step

- scope: ConfirmedPurchaseBuilder script (runtime endpoint와 별도).
- 동작: operational PG payment_complete window + Path B ledger summary + paid_click_intent ledger + Google Ads click_view 30d를 join 단계로 명시. 각 row에 confidence A/B/C/D와 reason 부여.
- 코드 추정량: 약 120 LOC.
- 본 sprint 적용 여부: ❌ 적용 안 함 (design only).

### 3.3 절대 하지 않는 것

- GA4 purchase event를 actual purchase로 승격 ❌
- NPay click/count/add_payment_info를 actual purchase로 승격 ❌
- VM Cloud complete_time 공백만으로 NPay 미결제 판정 ❌
- 운영 PG write ❌

## 4. fixture dry-run 계획

| fixture | expected category | budget usable |
|---|---|---|
| homepage_confirmed_with_gclid_in_paid_click_intent_ledger_same_order | A_via_ledger | true |
| homepage_confirmed_no_click_no_utm | F | false |
| npay_confirmed_no_click_with_utm | C | false |
| vbank_unpaid_path_b_bridge_present | G | false |

검증 절차: fixture JSON → builder + (proposed) cross_reference_evidence 호출 → block_reasons / category 비교.

## 5. 결과 요약

| 항목 | 값 |
|---|---|
| code touched | 0 |
| design artifact JSON | `data/confirmed-purchase-prep-integration-next-step-20260511.json` |
| design artifact MD | 본 문서 |
| 다음 Green 액션 | gpt0508-35에서 fixture 4개 작성 + cross_reference_evidence stub PR draft |
| Yellow 후속 제안 | patch_candidate_1 fixture PASS 후 backend route wire |

## 6. 추천 옵션과 자신감

- 추천: **patch_candidate_1** (작은 scope, runtime 영향 0, fixture dry-run으로 검증 가능)
- 자신감: **90%**
- 미지: paid_click_intent ledger의 hashed identity hit-rate가 실제 confirmed 주문 분포에서 얼마나 매칭될지.

## 7. Verdict

`DESIGN_READY_NEXT_SPRINT_CODE_PATCH`
