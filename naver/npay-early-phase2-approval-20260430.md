# NPay Phase2 조기 진행 승인안

작성 시각: 2026-04-30 20:36 KST
대상: biocom.kr NPay ROAS 정합성
관련 문서: [[!npayroas]], [[npay-roas-dry-run-20260430]], [[npay-ga4-mp-limited-test-approval]], [[npay-manual-test-20260430]], [[GA4/gtm]]
Primary source: VM SQLite `npay_intent_log`, 운영 Postgres `public.tb_iamweb_users`
Window: 2026-04-27 18:10 KST ~ 2026-04-30 19:10 KST
Freshness: dry-run report `2026-04-30 20:34 KST`, TJ BigQuery robust query 결과 반영 `2026-04-30 20:36 KST`
Confidence: 88%

## 10초 요약

현재 데이터는 7일치가 아니지만, `live intent 299건`, `confirmed NPay 주문 11건`, `A급 production 후보 5건`이 있어 조기 Phase2 진행은 가능하다.

TJ님이 A급 production 후보 5건의 Imweb `order_number`와 NPay `channel_order_no` 총 10개 ID를 BigQuery robust query로 조회했고, GA4 raw/purchase 전체에서 표시할 데이터 없음으로 확인했다. 이 5건은 `already_in_ga4=robust_absent`로 반영했다.

단, 이 문서는 실제 전송 승인이 아니다. 현재 결론은 아래 두 가지다.

1. Phase2 read-only guard는 닫혔다. A급 production 후보 5건은 robust_absent다.
2. 실제 GA4 Measurement Protocol 전송 여부는 [[npay-ga4-mp-limited-test-approval]]에서 별도 YES/NO로 결정한다.

## 현재 판단

| 항목 | 값 |
|---|---:|
| live intent | 299 |
| confirmed NPay 주문 | 11 |
| strong_match | 8 |
| A급 strong | 6 |
| A급 production 후보 | 5 |
| B급 strong | 2 |
| ambiguous | 3 |
| purchase_without_intent | 0 |
| clicked_no_purchase | 208 |
| dispatcher dry-run 후보 | 5 |
| 실제 전송 | 0 |
| A급 production `robust_absent` | 5 |

dispatcher dry-run 후보 5건은 "승인하면 보낼 수 있는 후보"라는 뜻이다. 실제 전송은 아직 0건이고, 승인 전까지 GA4/Meta/TikTok/Google Ads 전송은 금지다.

## Codex 추천

추천: **YES: GA4 MP 1건 제한 테스트 승인 여부 검토 + 7일 후보정**

이유:

1. 현재 표본으로 BigQuery guard와 수동 검토는 충분히 가능했고, A급 production 5건은 robust_absent로 닫혔다.
2. GA4 Measurement Protocol은 과거 이벤트와 세션 귀속에 시간 제약이 있으므로 7일을 기다리기만 하면 복구 가치가 떨어질 수 있다.
3. 반대로 ambiguous 3건이 있어 자동 dispatcher나 Google Ads 전송은 아직 열면 안 된다.

자신감: 88%

자신감을 낮춘 이유:

- confirmed NPay 주문이 아직 11건이라 표본이 작다.
- ambiguous가 3건으로 27.3%다.
- BigQuery robust guard는 닫혔지만, 실제 GA4 MP 전송은 롤백이 제한된다.
- TikTok 전용 식별값 `ttclid`, `_ttp`는 아직 없다.

## TJ님 확인 필요

### 선택지

| 선택 | 의미 | Codex 추천 |
|---|---|---|
| YES | GA4 MP 제한 테스트 승인안에서 1건 수동 제한 전송 여부를 판단한다. 실제 전송은 별도 승인 전까지 금지한다. | 추천 |
| NO | 2026-05-04 18:10 KST 이후 7일치 dry-run까지 모든 다음 판단을 보류한다. | 비추천 |

추천 답변:

```text
YES: GA4 MP 제한 테스트 승인안을 보고 1건 제한 테스트 여부를 판단
```

## BigQuery 조회 대상

아래 5개 주문은 A급 production 후보이며, TJ님 BigQuery robust query에서 모두 `robust_absent`로 확인됐다.

| Imweb order_number | NPay channel_order_no | 상태 |
|---|---|---|
| `202604280487104` | `2026042865542930` | `robust_absent` |
| `202604285552452` | `2026042867285600` | `robust_absent` |
| `202604303307399` | `2026043034982320` | `robust_absent` |
| `202604309992065` | `2026043040116970` | `robust_absent` |
| `202604302383065` | `2026043043205620` | `robust_absent` |

조회 ID 전체:

```text
202604280487104
2026042865542930
202604285552452
2026042867285600
202604303307399
2026043034982320
202604309992065
2026043040116970
202604302383065
2026043043205620
```

## BigQuery SQL

아래 쿼리는 기존 문서에서 쓰던 GA4 export dataset `hurdlers-naver-pay.analytics_304759974.events_*` 기준 초안이다. TJ님은 이보다 더 넓은 robust query를 직접 실행했다.

TJ님 robust query 확인 범위:

- `ecommerce.transaction_id`
- `event_params.transaction_id`
- `event_params` 전체 value
- `string_value`, `int_value`, `double_value`, `float_value`
- `events_*`와 `events_intraday_*`
- `_TABLE_SUFFIX`에서 날짜를 추출하는 방식

결과: 위 10개 ID 모두 표시할 데이터 없음.

```sql
WITH ids AS (
  SELECT id
  FROM UNNEST([
    '202604280487104',
    '2026042865542930',
    '202604285552452',
    '2026042867285600',
    '202604303307399',
    '2026043034982320',
    '202604309992065',
    '2026043040116970',
    '202604302383065',
    '2026043043205620'
  ]) AS id
)
SELECT
  event_date,
  TIMESTAMP_MICROS(event_timestamp) AS event_time,
  event_name,
  ecommerce.transaction_id AS ecommerce_transaction_id,
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'transaction_id') AS event_param_transaction_id,
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'pay_method') AS pay_method,
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'page_location') AS page_location
FROM `hurdlers-naver-pay.analytics_304759974.events_*`
WHERE _TABLE_SUFFIX BETWEEN '20260427' AND '20260504'
  AND (
    ecommerce.transaction_id IN (SELECT id FROM ids)
    OR (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'transaction_id') IN (SELECT id FROM ids)
    OR EXISTS (
      SELECT 1
      FROM UNNEST(event_params) ep
      WHERE ep.value.string_value IN (SELECT id FROM ids)
    )
  )
ORDER BY event_timestamp;
```

## 결과 해석

| 결과 | 처리 |
|---|---|
| 10개 ID 중 하나라도 조회됨 | 해당 주문은 `already_in_ga4=present`, GA4 MP 전송 후보 제외 |
| 주문의 `order_number`, `channel_order_no` 둘 다 robust query에서 조회 안 됨 | 해당 주문은 `already_in_ga4=robust_absent`, GA4 MP 제한 테스트 후보 가능 |
| BigQuery table 미생성/권한 없음 | 해당 주문은 `already_in_ga4=unknown`, 전송 후보 제외 |

BigQuery 결과를 Codex가 반영할 때는 `--ga4-present`, `--ga4-robust-absent` 쉼표 목록 또는 `--ga4-present-file`, `--ga4-robust-absent-file` 줄바꿈 파일을 사용할 수 있다. 파일 방식은 order id가 많아질 때 복사 실수를 줄이기 위한 보조 경로다.

## 수동 검토 큐

아래 주문은 현재 자동 전송 금지다.

| 주문 | 유형 | 이유 | 다음 작업 |
|---|---|---|---|
| `202604283756893` | B급 strong | score 50, time_gap 7.5분, amount_match none | 장바구니/묶음상품/수량 구조 확인 |
| `202604303298608` | B급 strong | 상품은 맞지만 결제금액 148,200원과 intent 상품가 54,900원 차이 | 수량/세트/할인 구조 확인 |
| `202604275329932` | ambiguous | low_score_gap, multiple_intents_same_product, amount_not_reconciled | 전송 제외 유지 또는 장바구니 규칙 보강 |
| `202604289063428` | ambiguous | 같은 상품 클릭 후보가 여러 개, score_gap 10 | 전송 제외 유지 |
| `202604295198830` | ambiguous | 같은 상품 클릭 후보가 여러 개, score_gap 10 | 전송 제외 유지 |

## 금지선

- DB `match_status` 업데이트 금지
- GA4/Meta/TikTok/Google Ads purchase 전송 금지
- 운영 dispatcher endpoint 배포 금지
- ambiguous, B급 strong, `already_in_ga4=unknown`, test order 전송 금지
- Google Ads 전환 복구는 마지막 단계

## 다음 단계

| 순서 | 담당 | 무엇 | 왜 | 산출물 |
|---:|---|---|---|---|
| 1 | TJ | BigQuery robust query 실행 | 이미 GA4에 있는 주문 중복 전송 방지 | 완료. 10개 ID 모두 `robust_absent` |
| 2 | Codex | `--ga4-robust-absent`를 넣어 dry-run 재계산 | 실제 후보가 열리는지 확인 | 완료. dispatcher dry-run 후보 5건 |
| 3 | Codex | GA4 MP 제한 테스트 승인안 작성 | 전송 전 payload/범위/롤백 한계 확인 | [[npay-ga4-mp-limited-test-approval]] |
| 4 | TJ | GA4 MP 제한 테스트 YES/NO | 실제 광고/분석 신호 변경 승인 | 승인 또는 보류 |
| 5 | Codex | 2026-05-04 18:10 KST 이후 7일 후보정 | 현재 판단을 7일 표본으로 재검증 | 후보정 리포트 |
