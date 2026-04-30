# NPay Recovery Lessons-to-Rules Schema

작성 시각: 2026-04-30 23:16 KST
상태: 초안
목적: NPay recovery 작업 중 발견한 예외와 교훈을 재사용 가능한 규칙으로 승격하는 형식
관련 문서: [[harness/npay-recovery/README|NPay Recovery Harness]], [[harness/npay-recovery/AUDITOR_CHECKLIST|Auditor Checklist]], [[naver/!npayroas|NPay ROAS 정합성 회복 계획]]

## 10초 요약

하네스가 좋아지려면 실패나 예외가 대화에만 남으면 안 된다. 관찰을 `candidate_rule`로 만들고, 반복 근거가 쌓이면 `approved_rule`로 승격해야 한다.

단, 근거 1건으로 모든 규칙을 자동 승격하면 과적합이 된다. 그래서 evidence_count, confidence, owner, deprecation 조건을 같이 기록한다.

## Rule Lifecycle

| 상태 | 의미 | 다음 단계 |
|---|---|---|
| observation | 단일 사례 관찰 | candidate_rule 제안 여부 판단 |
| candidate_rule | 다음에도 적용 가능해 보이는 임시 규칙 | 추가 evidence 수집 |
| approved_rule | 반복 확인 후 표준 규칙으로 승격 | `RULES.md` 반영 |
| deprecated_rule | 더 이상 쓰지 않는 규칙 | 삭제하지 말고 이유 기록 |

## Schema

```yaml
id: npay-rule-YYYYMMDD-001
status: observation | candidate_rule | approved_rule | deprecated_rule
title: 짧은 규칙명
owner: TJ | Codex | Claude | ChatGPT
created_at: "2026-04-30T23:16:00+09:00"
last_seen_at: "2026-04-30T23:16:00+09:00"
source:
  primary: "VM SQLite npay_intent_log"
  cross_check: "operational_postgres.public.tb_iamweb_users"
  report: "naver/npay-roas-dry-run-20260430.md"
window: "2026-04-27 18:10 KST ~ 2026-04-30 21:25 KST"
observation: "무슨 일이 있었는가"
problem: "기존 규칙으로 왜 부족했는가"
candidate_rule: "다음부터 어떻게 처리할 것인가"
approved_rule: "승격된 최종 규칙. 아직 없으면 null"
evidence:
  count: 1
  examples:
    - order_number: "202604309594732"
      channel_order_no: "2026043044799490"
      intent_id: "optional"
      observed_value: "intent 8900, payment 11900, delivery 3000"
confidence: 0.75
guardrail_impact:
  false_positive_risk: "low | medium | high"
  false_negative_risk: "low | medium | high"
  send_allowed_change: "none | narrower | wider"
approval:
  required: true
  approved_by: null
  approved_at: null
deprecation:
  condition: "언제 폐기할 것인가"
  replaced_by: null
notes: []
```

## Approved Rule 승격 기준

| 기준 | 권장값 |
|---|---|
| evidence_count | 3건 이상 권장. 고위험 전송 규칙은 5건 이상 |
| source | primary와 cross-check 둘 다 있어야 함 |
| false_positive_risk | 낮거나, block 쪽으로 더 보수적이어야 함 |
| human approval | TJ 또는 지정 reviewer 승인 |
| auditor | hard fail 없음 |

예외: 전송을 더 넓히는 규칙이 아니라 더 막는 규칙은 evidence 1건으로도 candidate_rule로 즉시 적용 가능하다.

## 현재 Seed Lessons

### shipping_reconciled

```yaml
id: npay-rule-20260430-001
status: candidate_rule
title: 배송비 포함 금액 차이는 amount mismatch로 보지 않는다
owner: Codex
created_at: "2026-04-30T18:00:00+09:00"
last_seen_at: "2026-04-30T16:01:14+09:00"
source:
  primary: "TJ manual NPay payment"
  cross_check: "Imweb order 202604309594732, channel_order_no 2026043044799490"
  report: "naver/npay-manual-test-20260430.md"
observation: "intent 상품가 8,900원과 결제금액 11,900원이 달랐지만 배송비 3,000원을 더하면 정확히 일치했다."
problem: "final amount만 보면 정상 주문이 amount_match=none으로 B급 처리된다."
candidate_rule: "order_payment_amount == order_item_total + delivery_price이면 amount_match_type=shipping_reconciled로 본다."
approved_rule: null
evidence:
  count: 1
  examples:
    - order_number: "202604309594732"
      channel_order_no: "2026043044799490"
      observed_value: "8900 + 3000 = 11900"
confidence: 0.82
guardrail_impact:
  false_positive_risk: "medium"
  false_negative_risk: "low"
  send_allowed_change: "wider"
approval:
  required: true
  approved_by: null
  approved_at: null
deprecation:
  condition: "7일 후보정에서 배송비 reconciliation이 오매칭을 만들면 폐기 또는 조건 강화"
  replaced_by: null
notes:
  - "manual_test_order는 A급이어도 전송 금지"
```

### dual_order_id_lookup

```yaml
id: npay-rule-20260430-002
status: candidate_rule
title: NPay는 Imweb order_number와 channel_order_no를 둘 다 BigQuery에서 조회한다
owner: Codex
created_at: "2026-04-30T20:36:00+09:00"
last_seen_at: "2026-04-30T20:36:00+09:00"
source:
  primary: "TJ BigQuery robust query"
  cross_check: "naver/npay-early-phase2-approval-20260430.md"
  report: "naver/npay-roas-dry-run-20260430.md"
observation: "NPay 주문은 Imweb order_number와 NPay channel_order_no가 다를 수 있다."
problem: "하나만 조회하면 already_in_ga4 guard가 false negative를 낼 수 있다."
candidate_rule: "GA4 중복 guard는 order_number와 channel_order_no 둘 중 하나라도 GA4 raw/purchase에 있으면 present로 본다."
approved_rule: null
evidence:
  count: 5
  examples:
    - order_number: "202604280487104"
      channel_order_no: "2026042865542930"
confidence: 0.9
guardrail_impact:
  false_positive_risk: "low"
  false_negative_risk: "low"
  send_allowed_change: "narrower"
approval:
  required: true
  approved_by: null
  approved_at: null
deprecation:
  condition: "GA4 표준 transaction_id가 하나로 통일되면 재검토"
  replaced_by: null
notes:
  - "전송 후보를 좁히는 guard라 v0에서 즉시 적용 가능"
```

### robust_absent

```yaml
id: npay-rule-20260430-003
status: candidate_rule
title: BigQuery 0건은 preliminary_absent와 robust_absent를 구분한다
owner: Codex
created_at: "2026-04-30T20:36:00+09:00"
last_seen_at: "2026-04-30T20:36:00+09:00"
source:
  primary: "TJ BigQuery robust query"
  cross_check: "events_* and events_intraday_*"
  report: "naver/npay-early-phase2-approval-20260430.md"
observation: "단순 transaction_id 조회 0건과 event_params 전체 value까지 본 0건은 신뢰도가 다르다."
problem: "preliminary_absent를 robust_absent처럼 취급하면 중복 전송 위험이 있다."
candidate_rule: "ecommerce.transaction_id, event_params.transaction_id, event_params 전체 value, string/int/double/float, intraday까지 확인한 경우만 robust_absent로 본다."
approved_rule: null
evidence:
  count: 5
  examples:
    - lookup_id_pair: "202604302383065 / 2026043043205620"
confidence: 0.88
guardrail_impact:
  false_positive_risk: "low"
  false_negative_risk: "low"
  send_allowed_change: "narrower"
approval:
  required: true
  approved_by: null
  approved_at: null
deprecation:
  condition: "GA4 export schema가 바뀌면 조회 범위 재검토"
  replaced_by: null
notes:
  - "robust_absent는 전송 허용이 아니라 제한 테스트 후보의 필요조건"
```

### manual_test_order_exclusion

```yaml
id: npay-rule-20260430-004
status: candidate_rule
title: 수동 테스트 주문은 A급이어도 전송 후보에서 제외한다
owner: Codex
created_at: "2026-04-30T18:00:00+09:00"
last_seen_at: "2026-04-30T16:01:14+09:00"
source:
  primary: "TJ manual NPay payment"
  cross_check: "naver/npay-manual-test-20260430.md"
  report: "naver/npay-roas-dry-run-20260430.md"
observation: "TJ 수동 테스트 주문은 A급 strong으로 잡혔다."
problem: "테스트 주문을 복구 전환으로 보내면 운영 ROAS가 오염된다."
candidate_rule: "manual_test_order/test_npay_manual label은 send_allowed=false, block_reason=manual_test_order로 고정한다."
approved_rule: null
evidence:
  count: 1
  examples:
    - order_number: "202604309594732"
      channel_order_no: "2026043044799490"
confidence: 0.95
guardrail_impact:
  false_positive_risk: "low"
  false_negative_risk: "low"
  send_allowed_change: "narrower"
approval:
  required: false
  approved_by: null
  approved_at: null
deprecation:
  condition: "테스트 라벨 체계가 바뀌면 키 이름 재검토"
  replaced_by: null
notes:
  - "전송 후보를 막는 규칙이므로 즉시 적용 가능"
```

## 운영 원칙

1. 새 observation은 버리지 말고 schema로 남긴다.
2. send 후보를 넓히는 규칙은 바로 approved_rule로 승격하지 않는다.
3. send 후보를 좁히는 guard는 빠르게 적용하되 문서에 남긴다.
4. 7일 후보정에서 evidence_count와 confidence를 갱신한다.
5. deprecated_rule도 삭제하지 않고 이유를 남긴다.
