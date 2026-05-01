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
