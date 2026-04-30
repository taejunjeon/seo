# NPay GA4 MP 제한 테스트 승인안

작성 시각: 2026-04-30 20:36 KST
대상: biocom.kr NPay ROAS 정합성 Phase2/초기 Phase3
관련 문서: [[!npayroas]], [[npay-roas-dry-run-20260430]], [[npay-early-phase2-approval-20260430]], [[npay-ga4-mp-limited-test-result-20260430]], [[GA4/gtm]]
Primary source: VM SQLite `npay_intent_log`, 운영 Postgres `public.tb_iamweb_users`
Cross-check: TJ BigQuery robust query
Window: 2026-04-27 18:10 KST ~ 2026-04-30 19:10 KST
Freshness: dry-run report `2026-04-30 20:34 KST`
Confidence: 86%

## 10초 요약

이 문서는 자동 dispatcher 운영 승인이 아니다.

실행 업데이트: TJ님이 `YES: 202604302383065 1건만 GA4 MP 제한 테스트`를 승인했고, Codex가 2026-04-30 21:23 KST에 해당 1건만 전송했다. 결과는 [[npay-ga4-mp-limited-test-result-20260430]]에 기록했다.

목적은 A급 production 후보 중 GA4 raw/purchase에 없다고 robust query로 확인된 주문 1-2건만 GA4 Measurement Protocol로 수동 제한 전송할지 TJ님이 판단하게 하는 것이다.

Codex 추천은 `YES: 202604302383065 1건만 제한 테스트`다. 이유는 최신 후보이고, 금액이 35,000원으로 작고, client_id와 ga_session_id가 있으며, Imweb order_number와 NPay channel_order_no 모두 GA4에 없는 것으로 확인됐기 때문이다.

## 결정 요청

| 선택지 | 의미 | Codex 추천 |
|---|---|---|
| YES: 1건 제한 테스트 | `202604302383065` 1건만 GA4 MP purchase로 수동 전송한다 | 추천 |
| YES: 2건 제한 테스트 | `202604302383065`, `202604309992065` 2건을 순차 전송한다 | 가능하지만 1건 성공 확인 후 권장 |
| NO: 7일 후보정까지 보류 | 실제 전송 없이 2026-05-04 18:10 KST 이후 재분석한다 | 보수안 |

추천 답변:

```text
YES: 202604302383065 1건만 GA4 MP 제한 테스트
```

## 왜 1건부터인가

GA4 Measurement Protocol 전송은 DB dry-run과 다르다. 한번 들어간 이벤트는 GA4 표준 리포트에서 바로 깔끔하게 삭제하거나 되돌리기 어렵다.

그래서 첫 테스트는 아래를 확인하는 용도다.

1. GA4 MP payload가 정상 수신되는가.
2. `transaction_id=Imweb order_number`로 BigQuery에 잡히는가.
3. `channel_order_no`가 event parameter로 남는가.
4. `event_id`와 dispatch dedupe key로 중복 방지 기준을 세울 수 있는가.
5. NPay return 누락 주문을 GA4 raw에 복구할 수 있는가.

이 테스트는 ROAS 대량 복구가 아니라 `수신 가능성 검증`이다.

## 후보 전체 목록

아래 5건은 모두 A급 strong, production_order, manual_test_order 아님, `already_in_ga4=robust_absent`, client_id 있음, ga_session_id 있음이다.

| 우선순위 | Imweb order_number | NPay channel_order_no | value | paid_at UTC | paid_at age | score | score_gap | amount_match | client_id | ga_session_id | event_id | 추천 |
|---:|---|---|---:|---|---:|---:|---:|---|---|---|---|---|
| 1 | `202604302383065` | `2026043043205620` | 35000 | 2026-04-30T05:50:59.000Z | 5.7h | 80 | 28 | final_exact | `2007220387.1777523364` | `1777527289` | `NPayRecoveredPurchase_202604302383065` | 1차 추천 |
| 2 | `202604309992065` | `2026043040116970` | 35000 | 2026-04-30T03:41:30.000Z | 7.9h | 80 | 28 | final_exact | `118292165.1777520272` | `1777520272` | `NPayRecoveredPurchase_202604309992065` | 2차 후보 |
| 3 | `202604303307399` | `2026043034982320` | 496000 | 2026-04-30T00:19:10.000Z | 11.3h | 70 | 18 | final_exact | `901508731.1765852144` | `1777508260` | `NPayRecoveredPurchase_202604303307399` | 1건 성공 후 |
| 4 | `202604285552452` | `2026042867285600` | 496000 | 2026-04-27T23:27:09.000Z | 60.1h | 70 | 18 | final_exact | `806449930.1777331701` | `1777331701` | `NPayRecoveredPurchase_202604285552452` | 보류 권장 |
| 5 | `202604280487104` | `2026042865542930` | 35000 | 2026-04-27T21:13:24.000Z | 62.3h | 80 | 28 | final_exact | `695356435.1777324290` | `1777324290` | `NPayRecoveredPurchase_202604280487104` | 보류 권장 |

## 최초 테스트 추천

### 1순위: `202604302383065`

추천 이유:

1. paid_at age가 5.7시간으로 가장 신선하다.
2. value가 35,000원이라 테스트 실패 시 리포트 왜곡 부담이 상대적으로 작다.
3. score 80, score_gap 28, time_gap 0.7분이라 매칭 근거가 강하다.
4. client_id와 ga_session_id가 모두 있다.
5. ad key에 `fbclid`, `fbc`, `fbp`가 있어 향후 Meta CAPI 테스트 설계에도 참고하기 좋다.

### 2순위: `202604309992065`

2건까지 테스트한다면 이 주문을 두 번째로 본다.

추천 이유:

1. paid_at age가 7.9시간으로 아직 비교적 신선하다.
2. value가 35,000원이다.
3. score 80, score_gap 28, time_gap 0.7분이다.
4. client_id와 ga_session_id가 모두 있다.

### 보류 권장 후보

`202604303307399`는 매칭은 좋지만 value가 496,000원이라 첫 수동 테스트 대상으로는 크다.

`202604285552452`, `202604280487104`는 아직 72시간 안이지만 paid_at age가 60시간을 넘는다. GA4 MP backdate는 72시간 제약에 걸릴 수 있고, session attribution 관점에서는 24시간 리스크가 더 크다.

## Payload Preview

추천 1건 payload 방향은 아래와 같다.

```json
{
  "client_id": "2007220387.1777523364",
  "events": [
    {
      "name": "purchase",
      "params": {
        "transaction_id": "202604302383065",
        "channel_order_no": "2026043043205620",
        "event_id": "NPayRecoveredPurchase_202604302383065",
        "value": 35000,
        "currency": "KRW",
        "session_id": 1777527289,
        "source": "npay_recovery",
        "recovery_reason": "npay_return_missing",
        "dispatch_dedupe_key": "npay_recovery_ga4_purchase:biocom:202604302383065"
      }
    }
  ],
  "timestamp_micros": "1777528259000000"
}
```

### transaction_id 기준

추천: `transaction_id`는 Imweb `order_number`를 쓴다.

이유:

1. 운영 주문 원장의 primary key가 Imweb `order_number`다.
2. 내부 매출/환불/취소/CS 조회 기준과 맞는다.
3. NPay `channel_order_no`는 네이버페이 완료 URL과 외부 대조용으로 event parameter에 같이 남긴다.

따라서:

| 값 | 처리 |
|---|---|
| Imweb `order_number` | GA4 `transaction_id` |
| NPay `channel_order_no` | GA4 event parameter `channel_order_no` |
| 중복 방지 event_id | `NPayRecoveredPurchase_{order_number}` |
| dispatch 중복 방지 키 | `npay_recovery_ga4_purchase:{site}:{order_number}` |

## 제한 테스트 조건

아래 조건을 모두 만족하는 주문만 보낸다.

| 조건 | 기준 | 현재 후보 |
|---|---|---:|
| A급 strong | score >= 70, amount/time/score_gap 통과 | 5 |
| production_order | 수동 테스트 주문 제외 | 5 |
| manual_test_order 아님 | TJ 테스트 주문 제외 | 5 |
| already_in_ga4 | `robust_absent` | 5 |
| client_id | 있음 | 5 |
| ga_session_id | 있음 | 5 |
| paid_at age | 가능하면 72시간 이내 | 5 |

## 리스크

### GA4 72시간 제한

GA4 Measurement Protocol은 과거 이벤트 timestamp에 제한이 있다. 현재 5건은 dry-run 생성 시점 기준 72시간 안이지만, 오래된 두 건은 빠르게 72시간에 가까워진다.

따라서 1차 테스트는 최신 주문인 `202604302383065`로 하는 것이 낫다.

### session attribution 24시간 리스크

GA4에서 원래 세션에 자연스럽게 붙는지는 별도 문제다. client_id와 ga_session_id가 있어도, 전송 시점이 늦으면 세션 귀속 품질이 떨어질 수 있다.

따라서 이 테스트의 1차 성공 기준은 "GA4 raw에 purchase가 들어오는가"다. 세션/캠페인 귀속 품질은 BigQuery 결과로 별도 확인한다.

### rollback 한계

GA4에 들어간 이벤트는 운영 리포트에서 즉시 깔끔하게 롤백하기 어렵다. 그래서 아래를 지킨다.

- 1건부터 시작한다.
- transaction_id와 event_id를 고정한다.
- dispatch dedupe key를 고정한다.
- 전송 전 BigQuery robust query를 한 번 더 확인한다.
- Google Ads 전환, Meta CAPI, TikTok Events API는 같이 보내지 않는다.

## 전송 후 검증 쿼리

전송 후 BigQuery export가 반영되면 아래 조건을 확인한다.

검증 대상 ID:

```text
202604302383065
2026043043205620
NPayRecoveredPurchase_202604302383065
```

확인할 것:

| 항목 | 기대 |
|---|---|
| `ecommerce.transaction_id` | `202604302383065` |
| `event_params.transaction_id` | `202604302383065` 또는 없음. GA4 export 구조에 따라 확인 |
| `event_params.channel_order_no` | `2026043043205620` |
| `event_params.event_id` | `NPayRecoveredPurchase_202604302383065` |
| `event_name` | `purchase` |
| value/currency | `35000` / `KRW` |
| client_id | payload와 동일 |
| ga_session_id | `1777527289` |

검증 쿼리 초안:

```sql
WITH ids AS (
  SELECT id
  FROM UNNEST([
    '202604302383065',
    '2026043043205620',
    'NPayRecoveredPurchase_202604302383065'
  ]) AS id
)
SELECT
  event_date,
  TIMESTAMP_MICROS(event_timestamp) AS event_time,
  event_name,
  ecommerce.transaction_id AS ecommerce_transaction_id,
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'transaction_id') AS event_param_transaction_id,
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'channel_order_no') AS channel_order_no,
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'event_id') AS event_id,
  (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'ga_session_id') AS ga_session_id_int,
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'ga_session_id') AS ga_session_id_string,
  ecommerce.purchase_revenue
FROM `<PROJECT>.<GA4_DATASET>.events_*`
WHERE _TABLE_SUFFIX BETWEEN '20260430' AND '20260502'
  AND (
    ecommerce.transaction_id IN (SELECT id FROM ids)
    OR EXISTS (
      SELECT 1
      FROM UNNEST(event_params) ep
      WHERE ep.value.string_value IN (SELECT id FROM ids)
         OR CAST(ep.value.int_value AS STRING) IN (SELECT id FROM ids)
         OR CAST(ep.value.double_value AS STRING) IN (SELECT id FROM ids)
         OR CAST(ep.value.float_value AS STRING) IN (SELECT id FROM ids)
    )
  )
ORDER BY event_timestamp;
```

## 금지선

이번 승인안으로 아래는 하지 않는다.

- DB `match_status` 업데이트 금지
- 자동 dispatcher 운영 전환 금지
- 운영 endpoint 배포 금지
- Meta CAPI 전송 금지
- TikTok Events API 전송 금지
- Google Ads 전환 전송 금지
- B급 strong 전송 금지
- ambiguous 전송 금지
- 수동 테스트 주문 전송 금지
- `already_in_ga4=unknown` 또는 `present` 전송 금지

## Codex 추천

추천: `YES: 202604302383065 1건만 GA4 MP 제한 테스트`

자신감: 86%

자신감을 100%로 두지 않는 이유는 세 가지다.

1. confirmed NPay 주문 표본이 아직 11건이다.
2. GA4 MP의 session attribution은 timestamp와 전송 지연에 민감하다.
3. 실제 GA4 수신 후 BigQuery export 반영까지 지연이 생길 수 있다.

그래도 1건 제한 테스트는 진행할 만하다. robust_absent가 닫혔고, 후보가 A급이며, 7일을 기다리면 과거 이벤트 복구 가치가 낮아질 수 있기 때문이다.
