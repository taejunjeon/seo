# NPay Recovery Lessons

작성 시각: 2026-05-01 00:20 KST  
상태: v0 기준판  
목적: NPay recovery에서 발견한 교훈을 규칙으로 승격하기 전 단계로 모은다  
관련 문서: [[harness/npay-recovery/README|NPay Recovery Harness]], [[harness/npay-recovery/RULES|Rules]], [[harness/npay-recovery/LESSONS_TO_RULES_SCHEMA|Lessons-to-Rules Schema]]

## 10초 요약

교훈은 대화에만 남기면 사라진다.

이 파일은 관찰을 모으고, 반복 근거가 쌓이면 [[harness/npay-recovery/RULES|RULES]]로 승격하기 위한 대기실이다. 전송 후보를 넓히는 교훈은 절대 바로 approved rule이 되지 않는다.

## 운영 원칙

1. 새 예외는 `observation`으로 남긴다.
2. 다음에도 적용할 가능성이 있으면 `candidate_rule`로 올린다.
3. 근거가 쌓이고 auditor를 통과하면 `approved_rule`로 승격한다.
4. 전송 후보를 좁히는 규칙은 빠르게 적용할 수 있다.
5. 전송 후보를 넓히는 규칙은 TJ님 승인 전 approved rule이 될 수 없다.

## Seed Lessons

| id | 상태 | 규칙명 | 현재 적용 | 전송 영향 |
|---|---|---|---|---|
| `npay-rule-20260430-001` | candidate_rule | 배송비 포함 금액 차이는 mismatch가 아니다 | `shipping_reconciled` | 후보를 넓힘, 보수 검토 필요 |
| `npay-rule-20260430-002` | candidate_rule | `order_number`와 `channel_order_no`를 둘 다 조회한다 | BigQuery guard 필수 | 후보를 좁힘 |
| `npay-rule-20260430-003` | candidate_rule | `preliminary_absent`와 `robust_absent`를 구분한다 | robust guard 필수 | 후보를 좁힘 |
| `npay-rule-20260430-004` | candidate_rule | 수동 테스트 주문은 A급이어도 전송 제외 | manual_test_order block | 후보를 좁힘 |
| `npay-rule-20260501-001` | candidate_rule | site filter 없는 운영 DB 결과는 정본이 아니다 | site isolation | 후보를 좁힘 |
| `npay-rule-20260501-002` | candidate_rule | stale local mirror는 primary로 쓰지 않는다 | coffee 확장 guard | 후보를 좁힘 |

## Lesson Detail

### npay-rule-20260430-001

상태: `candidate_rule`  
제목: 배송비 포함 금액 차이는 amount mismatch로 보지 않는다  
근거: TJ 수동 NPay 테스트 주문 `202604309594732`, channel order `2026043044799490`

관찰:

intent 상품가는 8,900원이고 결제금액은 11,900원이었다. 차이 3,000원은 배송비였다.

규칙 후보:

`order_payment_amount == item_total + delivery_price`이면 `amount_match_type=shipping_reconciled`로 본다.

주의:

이 규칙은 정상 후보를 A급으로 올릴 수 있으므로 7일 후보정에서 추가 근거가 필요하다.

### npay-rule-20260430-002

상태: `candidate_rule`  
제목: NPay는 Imweb order_number와 channel_order_no를 둘 다 BigQuery에서 조회한다

관찰:

NPay 주문은 Imweb `order_number`와 NPay `channel_order_no`가 다를 수 있다.

규칙 후보:

GA4 중복 guard는 두 ID 중 하나라도 raw/purchase에 있으면 `present`로 본다.

현재 적용:

전송 후보를 좁히는 guard이므로 v0에서 즉시 적용한다.

### npay-rule-20260430-003

상태: `candidate_rule`  
제목: BigQuery 0건은 preliminary_absent와 robust_absent를 구분한다

관찰:

단순 `ecommerce.transaction_id` 조회 0건과 event_params 전체 value까지 본 0건은 신뢰도가 다르다.

규칙 후보:

`ecommerce.transaction_id`, `event_params.transaction_id`, event_params 전체 value, string/int/double/float, intraday까지 확인한 0건만 `robust_absent`로 본다.

현재 적용:

전송 후보를 좁히는 guard이므로 v0에서 즉시 적용한다.

### npay-rule-20260430-004

상태: `candidate_rule`  
제목: 수동 테스트 주문은 A급이어도 전송 후보에서 제외한다

관찰:

TJ 수동 테스트 주문은 A급 strong으로 잡힐 수 있다.

규칙 후보:

`manual_test_order` 또는 `test_npay_manual_*` label은 `send_candidate=N`, `block_reason=manual_test_order`로 고정한다.

현재 적용:

전송 후보를 좁히는 guard이므로 v0에서 즉시 적용한다.

### npay-rule-20260501-001

상태: `candidate_rule`  
제목: site filter 없는 운영 DB 결과는 정본이 아니다

관찰:

biocom, thecleancoffee, aibio가 같은 운영 DB 또는 같은 분석 코드 안에서 다뤄질 수 있다.

문제:

site/store/domain 조건 없이 주문을 읽으면 사이트 간 원장 오염이 발생한다.

규칙 후보:

모든 report와 query는 `site` 또는 `store` 기준을 명시한다. 기준이 없으면 `source_scope_unknown`으로 표시하고 정본으로 쓰지 않는다.

현재 적용:

전송 후보를 좁히는 guard이므로 즉시 적용한다.

### npay-rule-20260501-002

상태: `candidate_rule`  
제목: stale local mirror는 primary로 쓰지 않는다

관찰:

더클린커피 local Imweb/Toss mirror는 최신 분석 시점에서 stale일 수 있다.

문제:

stale source를 primary로 쓰면 GA4/order mismatch를 실제 문제로 오판할 수 있다.

규칙 후보:

local mirror가 stale이면 primary source로 쓰지 않는다. 문서에는 fallback 또는 auxiliary signal로만 기록한다.

현재 적용:

전송 후보를 좁히는 guard이므로 즉시 적용한다.

## 새 Lesson 작성 형식

새 교훈은 아래 형식으로 추가한다.

```yaml
id: npay-rule-YYYYMMDD-001
status: observation
title: 짧은 규칙명
owner: Codex
created_at: "YYYY-MM-DD HH:mm KST"
source:
  primary: "어떤 데이터에서 봤는가"
  cross_check: "무엇으로 교차 확인했는가"
window: "분석 기간"
observation: "무슨 일이 있었는가"
problem: "기존 규칙으로 왜 부족했는가"
candidate_rule: "다음부터 어떻게 처리할 것인가"
evidence_count: 1
confidence: 0.0
send_allowed_change: "none | narrower | wider"
approval_required: true
```

## 승격 기준

| 승격 | 조건 |
|---|---|
| observation -> candidate_rule | 같은 문제가 다시 나올 가능성이 있고, rule로 표현 가능 |
| candidate_rule -> approved_rule | primary/cross-check 근거가 있고 auditor hard fail 없음 |
| approved_rule -> deprecated_rule | 더 좋은 규칙이 생기거나 오매칭 근거가 나옴 |

전송 후보를 넓히는 규칙은 evidence 3건 이상과 TJ님 승인이 필요하다. 고위험 플랫폼 전송 규칙은 evidence 5건 이상을 권장한다.
