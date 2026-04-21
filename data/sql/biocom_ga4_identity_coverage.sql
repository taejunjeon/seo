-- =====================================================================
-- biocom GA4 raw export 에서 identity coverage 원인 분해 (C-Sprint 5)
--
-- 실행 환경:
--   BigQuery Console → 프로젝트 `hurdlers-naver-pay` → 쿼리 편집기 → 붙여넣기
--   계정: biocomkr.sns@gmail.com (허들러스 권한 부여 계정)
--
-- 데이터셋 규칙:
--   biocom GA4 property ID = 304759974 → `analytics_304759974`
--   테이블 = events_YYYYMMDD (daily) + events_intraday_YYYYMMDD (오늘치)
--
-- 기간: 최근 30일 (필요시 INTERVAL 조정)
-- =====================================================================


-- ────────────────────────────────────────────────────────────────────
-- [쿼리 1] purchase 이벤트의 traffic_source 분포 — `(not set)` 원인 1차 분해
-- ────────────────────────────────────────────────────────────────────
SELECT
  COALESCE(NULLIF(traffic_source.source, ''), '(null)') AS session_source,
  COALESCE(NULLIF(traffic_source.medium, ''), '(null)') AS session_medium,
  COALESCE(NULLIF(traffic_source.name,   ''), '(null)') AS session_campaign,
  COALESCE(NULLIF(collected_traffic_source.manual_source, ''), '(null)') AS collected_source,
  COUNT(DISTINCT ecommerce.transaction_id) AS purchases,
  ROUND(SUM(COALESCE(ecommerce.purchase_revenue, 0))) AS revenue
FROM `hurdlers-naver-pay.analytics_304759974.events_*`
WHERE _TABLE_SUFFIX BETWEEN FORMAT_DATE('%Y%m%d', DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY))
                        AND FORMAT_DATE('%Y%m%d', CURRENT_DATE())
  AND event_name = 'purchase'
GROUP BY 1, 2, 3, 4
ORDER BY purchases DESC
LIMIT 50;


-- ────────────────────────────────────────────────────────────────────
-- [쿼리 2] session_lost 검증 — purchase 에 해당하는 session_start 매칭률
--   같은 user_pseudo_id + ga_session_id 로 session_start 가 존재하는가?
-- ────────────────────────────────────────────────────────────────────
WITH purchase_events AS (
  SELECT
    user_pseudo_id,
    (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'ga_session_id') AS ga_session_id,
    ecommerce.transaction_id,
    COALESCE(NULLIF(traffic_source.source, ''), '(null)') AS session_source,
    event_timestamp
  FROM `hurdlers-naver-pay.analytics_304759974.events_*`
  WHERE _TABLE_SUFFIX BETWEEN FORMAT_DATE('%Y%m%d', DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY))
                          AND FORMAT_DATE('%Y%m%d', CURRENT_DATE())
    AND event_name = 'purchase'
),
session_starts AS (
  SELECT DISTINCT
    user_pseudo_id,
    (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'ga_session_id') AS ga_session_id,
    (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'source') AS utm_source,
    (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'medium') AS utm_medium,
    (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'campaign') AS utm_campaign
  FROM `hurdlers-naver-pay.analytics_304759974.events_*`
  WHERE _TABLE_SUFFIX BETWEEN FORMAT_DATE('%Y%m%d', DATE_SUB(CURRENT_DATE(), INTERVAL 35 DAY))
                          AND FORMAT_DATE('%Y%m%d', CURRENT_DATE())
    AND event_name = 'session_start'
)
SELECT
  COUNT(*) AS total_purchase_events,
  COUNTIF(p.ga_session_id IS NULL) AS missing_ga_session_id,
  COUNTIF(p.session_source = '(null)') AS session_source_null,
  COUNTIF(s.ga_session_id IS NULL) AS session_start_missing,
  COUNTIF(s.utm_source IS NULL AND p.session_source = '(null)') AS both_missing,
  COUNTIF(s.ga_session_id IS NOT NULL AND p.session_source = '(null)') AS session_found_but_source_lost
FROM purchase_events p
LEFT JOIN session_starts s
  ON p.user_pseudo_id = s.user_pseudo_id
 AND p.ga_session_id  = s.ga_session_id;


-- ────────────────────────────────────────────────────────────────────
-- [쿼리 3] duplicate purchase sender — 동일 transaction_id 다중 발사
--   page_location / page_referrer / stream_id 가 다르면 서로 다른 태그가 쏜 것
-- ────────────────────────────────────────────────────────────────────
SELECT
  ecommerce.transaction_id,
  COUNT(*) AS event_count,
  COUNT(DISTINCT event_timestamp) AS distinct_timestamps,
  COUNT(DISTINCT stream_id) AS distinct_streams,
  STRING_AGG(DISTINCT stream_id) AS streams,
  COUNT(DISTINCT (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'page_location')) AS distinct_page_locations
FROM `hurdlers-naver-pay.analytics_304759974.events_*`
WHERE _TABLE_SUFFIX BETWEEN FORMAT_DATE('%Y%m%d', DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY))
                        AND FORMAT_DATE('%Y%m%d', CURRENT_DATE())
  AND event_name = 'purchase'
  AND ecommerce.transaction_id IS NOT NULL
  AND ecommerce.transaction_id != ''
GROUP BY ecommerce.transaction_id
HAVING COUNT(*) > 1
ORDER BY event_count DESC
LIMIT 100;


-- ────────────────────────────────────────────────────────────────────
-- [쿼리 4] 일자별 `(not set)` 비율 추이 — fetch-fix 전후 비교
--   2026-04-08 fetch-fix 이후 `(not set)` 비율이 떨어졌는지 확인
-- ────────────────────────────────────────────────────────────────────
SELECT
  event_date,
  COUNT(DISTINCT ecommerce.transaction_id) AS purchases,
  COUNTIF(traffic_source.source IS NULL OR traffic_source.source = '' OR traffic_source.source = '(not set)') AS not_set_events,
  ROUND(
    100.0 * COUNTIF(traffic_source.source IS NULL OR traffic_source.source = '' OR traffic_source.source = '(not set)')
    / NULLIF(COUNT(*), 0),
    1
  ) AS not_set_pct
FROM `hurdlers-naver-pay.analytics_304759974.events_*`
WHERE _TABLE_SUFFIX BETWEEN FORMAT_DATE('%Y%m%d', DATE_SUB(CURRENT_DATE(), INTERVAL 60 DAY))
                        AND FORMAT_DATE('%Y%m%d', CURRENT_DATE())
  AND event_name = 'purchase'
GROUP BY event_date
ORDER BY event_date;


-- ────────────────────────────────────────────────────────────────────
-- [쿼리 5] transaction_id 별 원본 UTM / gclid / fbclid 추적 (세션 진입 시점)
--   purchase 주문에 대해 처음 들어왔을 때의 파라미터 복원 가능 여부
-- ────────────────────────────────────────────────────────────────────
WITH purchase_tx AS (
  SELECT
    user_pseudo_id,
    (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'ga_session_id') AS ga_session_id,
    ecommerce.transaction_id
  FROM `hurdlers-naver-pay.analytics_304759974.events_*`
  WHERE _TABLE_SUFFIX BETWEEN FORMAT_DATE('%Y%m%d', DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY))
                          AND FORMAT_DATE('%Y%m%d', CURRENT_DATE())
    AND event_name = 'purchase'
    AND ecommerce.transaction_id IS NOT NULL
)
SELECT
  COUNT(*) AS total_purchase_tx,
  COUNTIF(gclid_found.has_gclid > 0) AS has_gclid,
  COUNTIF(fbclid_found.has_fbclid > 0) AS has_fbclid,
  COUNTIF(utm_source_found.has_utm > 0) AS has_utm_source
FROM purchase_tx p
LEFT JOIN (
  SELECT user_pseudo_id,
         (SELECT value.int_value FROM UNNEST(event_params) WHERE key='ga_session_id') AS ga_session_id,
         COUNT(*) AS has_gclid
  FROM `hurdlers-naver-pay.analytics_304759974.events_*`
  WHERE _TABLE_SUFFIX BETWEEN FORMAT_DATE('%Y%m%d', DATE_SUB(CURRENT_DATE(), INTERVAL 35 DAY))
                          AND FORMAT_DATE('%Y%m%d', CURRENT_DATE())
    AND EXISTS (SELECT 1 FROM UNNEST(event_params) WHERE key = 'gclid' AND value.string_value IS NOT NULL AND value.string_value != '')
  GROUP BY 1, 2
) gclid_found USING (user_pseudo_id, ga_session_id)
LEFT JOIN (
  SELECT user_pseudo_id,
         (SELECT value.int_value FROM UNNEST(event_params) WHERE key='ga_session_id') AS ga_session_id,
         COUNT(*) AS has_fbclid
  FROM `hurdlers-naver-pay.analytics_304759974.events_*`
  WHERE _TABLE_SUFFIX BETWEEN FORMAT_DATE('%Y%m%d', DATE_SUB(CURRENT_DATE(), INTERVAL 35 DAY))
                          AND FORMAT_DATE('%Y%m%d', CURRENT_DATE())
    AND EXISTS (SELECT 1 FROM UNNEST(event_params) WHERE key = 'fbclid' AND value.string_value IS NOT NULL AND value.string_value != '')
  GROUP BY 1, 2
) fbclid_found USING (user_pseudo_id, ga_session_id)
LEFT JOIN (
  SELECT user_pseudo_id,
         (SELECT value.int_value FROM UNNEST(event_params) WHERE key='ga_session_id') AS ga_session_id,
         COUNT(*) AS has_utm
  FROM `hurdlers-naver-pay.analytics_304759974.events_*`
  WHERE _TABLE_SUFFIX BETWEEN FORMAT_DATE('%Y%m%d', DATE_SUB(CURRENT_DATE(), INTERVAL 35 DAY))
                          AND FORMAT_DATE('%Y%m%d', CURRENT_DATE())
    AND EXISTS (SELECT 1 FROM UNNEST(event_params) WHERE key = 'source' AND value.string_value IS NOT NULL AND value.string_value != '')
  GROUP BY 1, 2
) utm_source_found USING (user_pseudo_id, ga_session_id);


-- ────────────────────────────────────────────────────────────────────
-- [쿼리 6] 쿼리 5 재쿼리 — collected_traffic_source vs event_params 경로 비교
--   쿼리 5 에서 fbclid=0 으로 나온 이유가 "GA4 자동 수집(collected_traffic_source)"
--   에는 들어있지만 "event_params" 경로에는 노출 안 되는 구조이기 때문인지 확인.
-- ────────────────────────────────────────────────────────────────────
SELECT
  COUNT(*) AS total_purchase_events,
  -- collected_traffic_source (GA4 자동 수집, session level)
  COUNTIF(collected_traffic_source.gclid IS NOT NULL AND collected_traffic_source.gclid != '') AS cts_gclid,
  COUNTIF(collected_traffic_source.manual_source IS NOT NULL AND collected_traffic_source.manual_source != '') AS cts_manual_source,
  COUNTIF(collected_traffic_source.manual_medium IS NOT NULL AND collected_traffic_source.manual_medium != '') AS cts_manual_medium,
  COUNTIF(collected_traffic_source.manual_campaign_name IS NOT NULL AND collected_traffic_source.manual_campaign_name != '') AS cts_manual_campaign,
  -- event_params 경로 (GTM 에서 명시 전송한 경우)
  COUNTIF(EXISTS(SELECT 1 FROM UNNEST(event_params) WHERE key='gclid' AND COALESCE(value.string_value,'') != '')) AS ep_gclid,
  COUNTIF(EXISTS(SELECT 1 FROM UNNEST(event_params) WHERE key='fbclid' AND COALESCE(value.string_value,'') != '')) AS ep_fbclid,
  COUNTIF(EXISTS(SELECT 1 FROM UNNEST(event_params) WHERE key='source' AND COALESCE(value.string_value,'') != '')) AS ep_source,
  -- traffic_source (세션 시작 시점 자동 기록)
  COUNTIF(traffic_source.source IS NOT NULL AND traffic_source.source != '' AND traffic_source.source != '(direct)') AS ts_source_not_direct,
  COUNTIF(traffic_source.source = '(direct)') AS ts_source_direct
FROM `hurdlers-naver-pay.analytics_304759974.events_*`
WHERE _TABLE_SUFFIX BETWEEN FORMAT_DATE('%Y%m%d', DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY))
                        AND FORMAT_DATE('%Y%m%d', CURRENT_DATE())
  AND event_name = 'purchase';
