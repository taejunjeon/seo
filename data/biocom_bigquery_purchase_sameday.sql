-- biocom GA4 BigQuery raw purchase sanity query
-- 사용 방법:
-- 1) 아래 project_id / dataset_id 를 실제 값으로 바꾼다.
-- 2) same-day 범위를 start_date / end_date 로 맞춘다.
-- 3) query 1 -> query 2 -> query 3 순서로 본다.

DECLARE start_date STRING DEFAULT '20260403';
DECLARE end_date STRING DEFAULT '20260409';

-- project_id.dataset_id 는 예시다.
-- biocom legacy raw export가 hurdlers-naver-pay 에 살아 있으면
-- `hurdlers-naver-pay.analytics_<property_id>` 형태로 바꿔야 한다.

-- Query 1. 날짜별 purchase event 수 / distinct transaction_id 수
WITH purchase_events AS (
  SELECT
    event_date,
    (
      SELECT ep.value.string_value
      FROM UNNEST(event_params) ep
      WHERE ep.key = 'transaction_id'
    ) AS transaction_id,
    (
      SELECT ep.value.int_value
      FROM UNNEST(event_params) ep
      WHERE ep.key = 'value'
    ) AS purchase_value_int,
    (
      SELECT ep.value.double_value
      FROM UNNEST(event_params) ep
      WHERE ep.key = 'value'
    ) AS purchase_value_double,
    user_pseudo_id
  FROM `project_id.dataset_id.events_*`
  WHERE _TABLE_SUFFIX BETWEEN start_date AND end_date
    AND event_name = 'purchase'
)
SELECT
  event_date,
  COUNT(*) AS purchase_events,
  COUNT(DISTINCT transaction_id) AS distinct_transaction_id,
  COUNTIF(transaction_id IS NULL OR transaction_id = '') AS blank_transaction_id,
  ROUND(SUM(COALESCE(CAST(purchase_value_int AS FLOAT64), purchase_value_double, 0)), 2) AS raw_purchase_value
FROM purchase_events
GROUP BY event_date
ORDER BY event_date;

-- Query 2. duplicate transaction_id 상위 샘플
WITH purchase_events AS (
  SELECT
    event_date,
    (
      SELECT ep.value.string_value
      FROM UNNEST(event_params) ep
      WHERE ep.key = 'transaction_id'
    ) AS transaction_id,
    user_pseudo_id,
    event_timestamp
  FROM `project_id.dataset_id.events_*`
  WHERE _TABLE_SUFFIX BETWEEN start_date AND end_date
    AND event_name = 'purchase'
)
SELECT
  transaction_id,
  COUNT(*) AS event_count,
  COUNT(DISTINCT user_pseudo_id) AS distinct_users,
  MIN(event_date) AS first_event_date,
  MAX(event_date) AS last_event_date,
  MIN(TIMESTAMP_MICROS(event_timestamp)) AS first_seen_at,
  MAX(TIMESTAMP_MICROS(event_timestamp)) AS last_seen_at
FROM purchase_events
WHERE transaction_id IS NOT NULL
  AND transaction_id != ''
GROUP BY transaction_id
HAVING COUNT(*) > 1
ORDER BY event_count DESC, last_seen_at DESC
LIMIT 50;

-- Query 3. duplicate sample 상세
WITH purchase_events AS (
  SELECT
    event_date,
    (
      SELECT ep.value.string_value
      FROM UNNEST(event_params) ep
      WHERE ep.key = 'transaction_id'
    ) AS transaction_id,
    (
      SELECT ep.value.string_value
      FROM UNNEST(event_params) ep
      WHERE ep.key = 'page_location'
    ) AS page_location,
    (
      SELECT ep.value.string_value
      FROM UNNEST(event_params) ep
      WHERE ep.key = 'source'
    ) AS source,
    (
      SELECT ep.value.string_value
      FROM UNNEST(event_params) ep
      WHERE ep.key = 'medium'
    ) AS medium,
    user_pseudo_id,
    event_timestamp
  FROM `project_id.dataset_id.events_*`
  WHERE _TABLE_SUFFIX BETWEEN start_date AND end_date
    AND event_name = 'purchase'
)
SELECT
  event_date,
  transaction_id,
  user_pseudo_id,
  TIMESTAMP_MICROS(event_timestamp) AS event_time,
  page_location,
  source,
  medium
FROM purchase_events
WHERE transaction_id IN (
  SELECT transaction_id
  FROM purchase_events
  WHERE transaction_id IS NOT NULL
    AND transaction_id != ''
  GROUP BY transaction_id
  HAVING COUNT(*) > 1
)
ORDER BY transaction_id, event_timestamp;
