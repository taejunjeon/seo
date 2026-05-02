# Coffee Data Lessons

작성 시각: 2026-05-01 15:23 KST  
상태: v0 observation log  
목적: 더클린커피 정합성 작업에서 나온 예외와 교훈을 규칙 후보로 모은다  
관련 문서: [[harness/coffee-data/README|Coffee Data Harness]], [[harness/coffee-data/RULES|Coffee Rules]], [[harness/npay-recovery/LESSONS_TO_RULES_SCHEMA|NPay Lessons-to-Rules Schema]]

## 10초 요약

이 문서는 바로 규칙을 확정하는 곳이 아니다.

새 관찰을 모으고, 반복 근거가 쌓이면 [[harness/coffee-data/RULES|Coffee Rules]]로 승격한다. 전송 후보를 넓히는 규칙은 TJ님 승인 전에는 approved rule이 될 수 없다.

## Observation Log

| id | status | observation | evidence | candidate_rule | confidence | owner |
|---|---|---|---|---|---:|---|
| coffee-lesson-001 | candidate_rule | GA4 NPay형 transaction_id가 Imweb `order_no`나 NPay `channel_order_no`가 아니라 `NPAY - ...` synthetic 값이다 | 2026-05-01 read-only, NPay actual 60건 vs GA4 NPay pattern 58건 | 과거 coffee NPay는 order_number exact match가 아니라 금액/시간/상품명 one-to-one으로만 분석한다 | 0.9 | Codex |
| coffee-lesson-002 | candidate_rule | Imweb v2 API `type=npay`는 coffee NPay actual order primary로 쓸 수 있다 | 60건/2,462,300원, `channel_order_no` 60/60 | Naver API 권한 전까지 coffee NPay actual primary는 Imweb v2 API로 둔다 | 0.89 | Codex |
| coffee-lesson-003 | candidate_rule | 남은 unassigned actual 18건의 `order_no/channel_order_no` 36개는 GA4 raw에서 직접 조회되지 않는다 | [[data/coffee-npay-unassigned-ga4-guard-20260501]] 36/36 robust_absent | 과거 unassigned actual을 자동 복구 전송 후보로 올리지 않고 future intent 필요 근거로 쓴다 | 0.86 | Codex |
| coffee-lesson-004 | candidate_rule | 2024/2025 엑셀은 주문/결제 join이 가능하지만 2023 엑셀은 header-only다 | [[data/coffee-excel-import-dry-run-20260501]] | 2023 파일은 primary/fallback에서 제외하고 inventory에 header-only로 남긴다 | 0.95 | Codex |
| coffee-lesson-005 | candidate_rule | local Imweb/Toss mirror는 freshness가 약해 coffee primary로 쓰면 위험하다 | [[data/!coffeedata]] source freshness 판단 | local mirror는 fallback 또는 비교용으로만 사용한다 | 0.9 | Codex |
| coffee-lesson-006 | candidate_rule | 더클린커피 imweb 헤더/푸터에 4 layer (Purchase Guard v3 / checkout-started v1 / payment-success-order-code v1 / funnel-capi v3) 가 박혀 있고 모두 `att.ainativeos.net` attribution 인프라를 사용한다 | [[coffee/!imwebcoffee_code_latest_0501]] 정본 + [[data/coffee-imweb-tracking-flow-analysis-20260501]] | 신규 tracking/wrapper/intent 작업 직전 정본을 먼저 보고, 4 layer 의 trigger / 발화 이벤트를 line 인용으로 확인한 뒤 진행한다. funnel-capi `__seo_funnel_session` sessionId 와 eid 를 새로 만들지 말고 재사용 | 0.92 | Codex |
| coffee-lesson-007 | candidate_rule | NPay click 시점에 imweb 이 자체 fbq InitiateCheckout 발화 → funnel-capi mirror. NPay 도 InitiateCheckout 단계는 살아 있고, 비어 있는 것은 backend `checkout-started v1` attribution layer 만이다 | 2026-05-01 21:57 KST 진단 G v0.4 결과 ([[data/coffee-live-tracking-inventory-20260501]] §7~§8) | NPay 분기 보강은 InitiateCheckout 단계가 아니라 backend checkout-started 단계 + click 시점 deterministic key (`intent_uuid`) 두 영역에 집중한다 | 0.88 | Codex |
| coffee-lesson-008 | candidate_rule | 더클린커피 발견은 biocom 도 imweb + funnel-capi + ainativeos.net attribution 인프라이면 그대로 적용 가능. 단 site 별 pixel id / GTM container / snippet version / sessionStorage key prefix 는 재검증 필수 | [[data/coffee-funnel-capi-cross-site-applicability-20260501]] | biocom phase 시작 시 (1) 정본 정찰 → (2) snippet site 식별자 치환 → (3) 4 layer flow + URL 보존 검증 재실행 의 3 step 을 순서대로 따른다 | 0.85 | Codex |
| coffee-lesson-009 | observation | dispatcher 의 chrome 측 동작 (GTM Preview cookie + sessionStorage buffer + funnel-capi v3 retry capture flow) 은 **agent 자동화 불가** — TJ chrome 손이 반드시 필요. backend 측 sim 만으로는 dispatcher v2.x 의 O1/O2/O3 effect 측정 못 함 | 2026-05-02 sprint 19.2 partial smoke | dispatcher 변경 sprint 는 (a) backend prep + GTM 등록 + Codex sim → (b) TJ chrome → (c) 결과 결합 의 2 phase 로 명시 분리. (a) 끝나면 partial smoke 종결 + (b) 별도 sprint 로 진입 | 0.9 | Codex |
| coffee-lesson-010 | observation | monitoring script (`backend/scripts/coffee-npay-intent-monitoring-report.ts`) 의 test row 필터는 process scope reject_counters 와 ledger row scope 를 분리 못 함. Codex sim 을 enforce_inserted/deduped 카운터에서 제외 안 함 → sprint 안에서 의도된 dedup test 가 EG-3 FAIL 로 보임. 향후 monitoring script 의 sprint scope 분리 필요 | 2026-05-02 sprint 19.2 monitoring 결과 (M-5 50%, EG-3 FAIL) | A-4 publish 후 운영 monitoring 시점에 sprint scope reject_counters 분리 보강. 단 본 lesson 의 publish 전 영향은 작음 (dispatcher chrome 검증 결과로 평가하므로 reject_counters 는 sub) | 0.7 | Codex |
| coffee-lesson-011 | observation | Coffee Data Harness 의 `AUTONOMY_POLICY.md` (Green/Yellow/Red Lane) 는 sprint 19.2 에서 첫 적용. Yellow Lane 안에서 Codex 가 backend prep + GTM 등록 + Codex sim + cleanup + 보고서 + commit/push 까지 자율 완료 가능. chrome 부분 은 lane 분류 외 (agent 능력 한계) — Yellow Lane 정의 자체에는 영향 없음 | [[harness/coffee-data/AUTONOMY_POLICY]] + 2026-05-02 sprint 19.2 | Yellow Lane sprint 시작 시 agent 능력 (chrome 자동화 불가) 을 사전 확인하고, chrome 단계가 필요하면 partial sprint 명시 + 별도 sprint 분리 | 0.85 | Codex |

## 승격 기준

| 단계 | 기준 |
|---|---|
| observation | 1회 관찰, source/window/evidence 있음 |
| candidate_rule | 같은 문제를 다음 작업에 적용할 수 있음 |
| approved_rule | 2회 이상 반복 확인, auditor hard fail 없음, TJ님 또는 작업 기준판에서 승인 |
| deprecated_rule | source 구조 변경, API 변경, counterexample 발견 |

## 다음에 확인할 교훈

| 후보 | 왜 필요한가 | 확인 방법 |
|---|---|---|
| `shipping_reconciled`가 coffee에서도 안정적인가 | 배송비 때문에 정상 주문이 B급으로 내려가는 것을 막기 위해 | NPay assigned/unassigned rows에서 배송비 근거 확인 |
| ambiguous 29건은 줄일 수 있는가 | 과거 복구 가능성과 future intent 우선순위를 정하기 위해 | time gap, 상품명, 동일 금액 반복 주문 재점수화 |
| `NPAY - ...` synthetic transaction_id는 Hurdlers/Imweb 패턴인가 | biocom/coffee/AIBIO 공통 규칙으로 만들 수 있는지 확인 | GTM/Hurdlers tag와 GA4 event_params 비교 |
