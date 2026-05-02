# Biocom GA4 Robust Guard Manual Run (2026-05-02)

작성 시각: 2026-05-02 02:00 KST
site: `biocom`
목적: TJ님이 BigQuery 콘솔에서 직접 실행할 수 있는 A급 production 후보 5건 robust guard 패키지
query target: `hurdlers-naver-pay.analytics_304759974`
table suffix: `20260425` ~ `20260502`
결론: BigQuery 권한이 열리기 전까지 Codex는 추가 dry-run, 전송 판단, approval draft를 하지 않는다.

## 10초 요약

이 문서는 A급 production 후보 5건이 GA4에 이미 있는지 확인하기 위한 수동 BigQuery 실행 패키지다.

TJ님은 아래 SQL을 BigQuery 콘솔에 붙여넣어 실행하면 된다. 결과가 `present` 또는 `unknown`이면 전송 후보가 아니다. `robust_absent`만 approval draft 후보가 될 수 있다.

내일 실행 시 2026-05-03 intraday까지 보고 싶으면 SQL의 end suffix를 `20260503`까지 확장해도 된다.

## 조회 대상 10개 ID

| 후보 | order_number | channel_order_no | value |
|---:|---|---|---:|
| 1 | `202604280487104` | `2026042865542930` | 35000 |
| 2 | `202604285552452` | `2026042867285600` | 496000 |
| 3 | `202604303307399` | `2026043034982320` | 496000 |
| 4 | `202604309992065` | `2026043040116970` | 35000 |
| 5 | `202605011540306` | `2026050158972710` | 496000 |

한 줄 ID 목록은 `data/biocom-ga4-robust-guard-lookup-ids-20260502.txt`에 있다.

## BigQuery 콘솔 SQL

아래 SQL은 GA4 raw export에서 다음 범위를 모두 확인한다.

| 확인 범위 | 포함 여부 |
|---|---|
| `ecommerce.transaction_id` | YES |
| `event_params.transaction_id` | YES |
| `event_params` 전체 value | YES |
| `string_value`, `int_value`, `double_value`, `float_value` | YES |
| `events_*` daily tables | YES |
| `events_intraday_*` tables | YES |

```sql
WITH candidate_pairs AS (
  SELECT '202604280487104' AS order_number, '2026042865542930' AS channel_order_no, 35000 AS value UNION ALL
  SELECT '202604285552452' AS order_number, '2026042867285600' AS channel_order_no, 496000 AS value UNION ALL
  SELECT '202604303307399' AS order_number, '2026043034982320' AS channel_order_no, 496000 AS value UNION ALL
  SELECT '202604309992065' AS order_number, '2026043040116970' AS channel_order_no, 35000 AS value UNION ALL
  SELECT '202605011540306' AS order_number, '2026050158972710' AS channel_order_no, 496000 AS value
),
lookup_ids AS (
  SELECT
    order_number,
    channel_order_no,
    value,
    order_number AS lookup_id,
    'order_number' AS id_type
  FROM candidate_pairs
  UNION ALL
  SELECT
    order_number,
    channel_order_no,
    value,
    channel_order_no AS lookup_id,
    'channel_order_no' AS id_type
  FROM candidate_pairs
),
raw_events AS (
  SELECT
    _TABLE_SUFFIX AS table_suffix,
    event_name,
    event_timestamp,
    FORMAT_TIMESTAMP('%Y-%m-%d %H:%M:%S', TIMESTAMP_MICROS(event_timestamp), 'Asia/Seoul') AS event_time_kst,
    ecommerce.transaction_id AS ecommerce_transaction_id,
    (
      SELECT ep.value.string_value
      FROM UNNEST(event_params) ep
      WHERE ep.key = 'transaction_id'
      LIMIT 1
    ) AS event_params_transaction_id,
    ARRAY(
      SELECT COALESCE(
        ep.value.string_value,
        CAST(ep.value.int_value AS STRING),
        CAST(ep.value.double_value AS STRING),
        CAST(ep.value.float_value AS STRING)
      )
      FROM UNNEST(event_params) ep
      WHERE COALESCE(
        ep.value.string_value,
        CAST(ep.value.int_value AS STRING),
        CAST(ep.value.double_value AS STRING),
        CAST(ep.value.float_value AS STRING)
      ) IS NOT NULL
    ) AS event_param_values
  FROM `hurdlers-naver-pay.analytics_304759974.events_*`
  WHERE (
    REGEXP_CONTAINS(_TABLE_SUFFIX, r'^\d{8}$')
    AND _TABLE_SUFFIX BETWEEN '20260425' AND '20260502'
  ) OR (
    STARTS_WITH(_TABLE_SUFFIX, 'intraday_')
    AND SUBSTR(_TABLE_SUFFIX, 10) BETWEEN '20260425' AND '20260502'
  )
),
matched AS (
  SELECT
    lookup_ids.order_number,
    lookup_ids.channel_order_no,
    lookup_ids.value,
    lookup_ids.lookup_id,
    lookup_ids.id_type,
    raw_events.table_suffix,
    raw_events.event_name,
    raw_events.event_timestamp,
    raw_events.event_time_kst,
    raw_events.ecommerce_transaction_id,
    raw_events.event_params_transaction_id
  FROM lookup_ids
  JOIN raw_events
    ON raw_events.ecommerce_transaction_id = lookup_ids.lookup_id
    OR raw_events.event_params_transaction_id = lookup_ids.lookup_id
    OR lookup_ids.lookup_id IN UNNEST(raw_events.event_param_values)
),
id_summary AS (
  SELECT
    lookup_ids.order_number,
    lookup_ids.channel_order_no,
    lookup_ids.value,
    lookup_ids.lookup_id,
    lookup_ids.id_type,
    COUNT(matched.event_name) AS events,
    COUNTIF(matched.event_name = 'purchase') AS purchase_events,
    ARRAY_TO_STRING(ARRAY_AGG(DISTINCT matched.event_name IGNORE NULLS ORDER BY matched.event_name), ', ') AS event_names,
    FORMAT_TIMESTAMP('%Y-%m-%d %H:%M:%S', TIMESTAMP_MICROS(MIN(matched.event_timestamp)), 'Asia/Seoul') AS first_seen_kst,
    FORMAT_TIMESTAMP('%Y-%m-%d %H:%M:%S', TIMESTAMP_MICROS(MAX(matched.event_timestamp)), 'Asia/Seoul') AS last_seen_kst
  FROM lookup_ids
  LEFT JOIN matched
    ON matched.lookup_id = lookup_ids.lookup_id
    AND matched.id_type = lookup_ids.id_type
  GROUP BY
    lookup_ids.order_number,
    lookup_ids.channel_order_no,
    lookup_ids.value,
    lookup_ids.lookup_id,
    lookup_ids.id_type
)
SELECT
  candidate_pairs.order_number,
  candidate_pairs.channel_order_no,
  candidate_pairs.value,
  COALESCE(order_id.events, 0) AS order_number_events,
  COALESCE(order_id.purchase_events, 0) AS order_number_purchase_events,
  COALESCE(order_id.event_names, '') AS order_number_event_names,
  order_id.first_seen_kst AS order_number_first_seen_kst,
  order_id.last_seen_kst AS order_number_last_seen_kst,
  COALESCE(channel_id.events, 0) AS channel_order_no_events,
  COALESCE(channel_id.purchase_events, 0) AS channel_order_no_purchase_events,
  COALESCE(channel_id.event_names, '') AS channel_order_no_event_names,
  channel_id.first_seen_kst AS channel_order_no_first_seen_kst,
  channel_id.last_seen_kst AS channel_order_no_last_seen_kst,
  CASE
    WHEN COALESCE(order_id.events, 0) > 0 OR COALESCE(channel_id.events, 0) > 0 THEN 'present'
    WHEN COALESCE(order_id.events, 0) = 0 AND COALESCE(channel_id.events, 0) = 0 THEN 'robust_absent'
    ELSE 'unknown'
  END AS manual_guard_result
FROM candidate_pairs
LEFT JOIN id_summary order_id
  ON order_id.order_number = candidate_pairs.order_number
  AND order_id.id_type = 'order_number'
LEFT JOIN id_summary channel_id
  ON channel_id.channel_order_no = candidate_pairs.channel_order_no
  AND channel_id.id_type = 'channel_order_no'
ORDER BY candidate_pairs.order_number;
```

## 결과 판정법

| 결과 | 판정 | 다음 행동 |
|---|---|---|
| order_number 또는 channel_order_no 중 하나라도 `events > 0` | `present` | send 후보 금지. `block_reason=already_in_ga4` |
| 둘 다 `events = 0` | `robust_absent` | approval draft 후보 가능. 실제 전송은 여전히 금지 |
| 쿼리 실패, 테이블 없음, 권한 없음 | `unknown` | send 후보 금지. `block_reason=already_in_ga4_unknown` |

`present` 또는 `unknown`은 send 후보가 아니다.

`robust_absent`만 approval draft 후보가 될 수 있다.

## TJ님 실행 후 붙여넣을 값

내일 Codex에게 아래 형식으로 결과만 붙여넣으면 된다.

```text
biocom manual robust guard result:
202604280487104 / 2026042865542930 = present|robust_absent|unknown
202604285552452 / 2026042867285600 = present|robust_absent|unknown
202604303307399 / 2026043034982320 = present|robust_absent|unknown
202604309992065 / 2026043040116970 = present|robust_absent|unknown
202605011540306 / 2026050158972710 = present|robust_absent|unknown
```

## 금지선

이 문서는 수동 BigQuery 조회만 위한 문서다.

GA4 Measurement Protocol, Meta CAPI, TikTok Events API, Google Ads conversion 전송은 하지 않는다. 운영 DB write, GTM publish, backend deploy, Imweb header/footer 수정, NPay click도 하지 않는다.
