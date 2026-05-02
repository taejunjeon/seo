# Biocom NPay GA4 MP Limited Test Result (2026-05-02)

작성 시각: 2026-05-02 18:05 KST
site: `biocom`
phase: `limited_send`
scope: `GA4_MP purchase 1건`
order_number: `202604309992065`
channel_order_no: `2026043040116970`
event_id: `NPayRecoveredPurchase_202604309992065`
measurement_id: `G-WJFXN5E2Q1`

## 10초 요약

TJ님 승인 범위대로 `202604309992065` 1건만 GA4 Measurement Protocol purchase 제한 테스트를 실행했다.

debug validation은 HTTP 200이고 validation message는 0건이다. 실제 collect는 HTTP 204로 응답했다.

2026-05-02 18:18 KST 기준 TJ님 BigQuery 수신 확인 SQL은 "표시할 데이터 없음"을 반환했다. 전송 직후 raw export 지연 가능성이 있어 현재 판정은 `WAIT_EXPORT_LATENCY`다.

Meta CAPI, TikTok Events API, Google Ads conversion 전송은 하지 않았다. 운영 DB write, `match_status` 업데이트, GTM publish, backend deploy, Imweb 수정, NPay click도 하지 않았다.

## 실행 결과

| 단계 | 결과 |
|---|---|
| dry-run guard | PASS |
| GA4 debug endpoint | HTTP 200 |
| debug validationMessages | 0 |
| GA4 collect endpoint | HTTP 204 |
| send count | 1 |
| sent_at_kst | 2026-05-02 18:04 KST |

## Guard Snapshot

| 항목                         | 값                       |
| -------------------------- | ----------------------- |
| status                     | `strong_match`          |
| strong_grade               | `A`                     |
| order_label                | `production_order`      |
| already_in_ga4_before_send | `robust_absent`         |
| dispatcher_candidate       | `true`                  |
| block_reasons              | `[]`                    |
| paid_at_kst                | 2026-04-30 12:41:30 KST |
| paid_at_age_at_send        | 53.4h                   |
| within_72h                 | YES                     |
| score                      | 80                      |
| time_gap_minutes           | 0.7                     |
| amount_match_type          | `final_exact`           |
| client_id_present          | YES                     |
| ga_session_id_present      | YES                     |

## Payload Summary

| field | value |
|---|---|
| transaction_id | `202604309992065` |
| channel_order_no | `2026043040116970` |
| event_id | `NPayRecoveredPurchase_202604309992065` |
| value | 35000 |
| currency | `KRW` |
| client_id | `118292165.1777520272` |
| session_id | `1777520272` |
| matched_intent_id | `aa6cb8b7-4e55-4731-8fe2-c65dc269e6cc` |
| item_id | `198` |
| item_name | `뉴로마스터 60정 (1개월분)` |
| dispatch_dedupe_key | `npay_recovery_ga4_purchase:biocom:202604309992065` |

## Local Artifacts

| artifact | path |
|---|---|
| dry-run output | `/tmp/biocom-npay-ga4-mp-limited-test-dryrun-20260502.json` |
| debug validation output | `/tmp/biocom-npay-ga4-mp-limited-test-validate-20260502.json` |
| send output | `/tmp/biocom-npay-ga4-mp-limited-test-send-20260502.json` |
| VM SQLite temp snapshot | `/tmp/biocom-npay-intent-snapshot-20260502.sqlite3` |

## TJ님 BigQuery 수신 확인 SQL

Codex는 BigQuery job 권한이 없어 직접 확인하지 못한다. TJ님이 BigQuery 콘솔에서 아래 SQL을 실행하면 된다.

조회는 backdated event timestamp와 export 지연을 고려해 `20260430` ~ `20260503` 범위로 본다.

```sql
WITH lookup_ids AS (
  SELECT id
  FROM UNNEST([
    '202604309992065',
    '2026043040116970',
    'NPayRecoveredPurchase_202604309992065',
    'npay_recovery_ga4_purchase:biocom:202604309992065'
  ]) AS id
),
raw AS (
  SELECT
    _TABLE_SUFFIX AS table_suffix,
    event_date,
    event_name,
    event_timestamp,
    FORMAT_TIMESTAMP('%Y-%m-%d %H:%M:%S', TIMESTAMP_MICROS(event_timestamp), 'Asia/Seoul') AS event_time_kst,
    ecommerce.transaction_id AS ecommerce_transaction_id,
    event_params,
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
    AND _TABLE_SUFFIX BETWEEN '20260430' AND '20260503'
  ) OR (
    STARTS_WITH(_TABLE_SUFFIX, 'intraday_')
    AND SUBSTR(_TABLE_SUFFIX, 10) BETWEEN '20260430' AND '20260503'
  )
)
SELECT
  raw.table_suffix,
  raw.event_date,
  raw.event_time_kst,
  raw.event_name,
  raw.ecommerce_transaction_id,
  (SELECT ep.value.string_value FROM UNNEST(raw.event_params) ep WHERE ep.key = 'transaction_id') AS event_param_transaction_id,
  (SELECT ep.value.string_value FROM UNNEST(raw.event_params) ep WHERE ep.key = 'channel_order_no') AS channel_order_no,
  (SELECT ep.value.string_value FROM UNNEST(raw.event_params) ep WHERE ep.key = 'event_id') AS event_id,
  (SELECT ep.value.string_value FROM UNNEST(raw.event_params) ep WHERE ep.key = 'dispatch_dedupe_key') AS dispatch_dedupe_key,
  (SELECT ep.value.int_value FROM UNNEST(raw.event_params) ep WHERE ep.key = 'ga_session_id') AS ga_session_id_int,
  (SELECT ep.value.string_value FROM UNNEST(raw.event_params) ep WHERE ep.key = 'ga_session_id') AS ga_session_id_string,
  (SELECT ep.value.int_value FROM UNNEST(raw.event_params) ep WHERE ep.key = 'value') AS value_int,
  (SELECT ep.value.double_value FROM UNNEST(raw.event_params) ep WHERE ep.key = 'value') AS value_double,
  (SELECT ep.value.string_value FROM UNNEST(raw.event_params) ep WHERE ep.key = 'currency') AS currency
FROM raw
WHERE raw.ecommerce_transaction_id IN (SELECT id FROM lookup_ids)
   OR EXISTS (
     SELECT 1
     FROM UNNEST(raw.event_param_values) AS param_value
     WHERE param_value IN (SELECT id FROM lookup_ids)
   )
ORDER BY raw.event_timestamp DESC;
```

## 수신 판정

| BigQuery 결과 | 판정 | 다음 행동 |
|---|---|---|
| `202604309992065` 또는 event_id가 보임 | PASS | 이후 dry-run에서 해당 주문을 `already_in_ga4=present`로 막는다 |
| 24시간 안에 안 보임 | WAIT | export 지연 가능성이 있어 재조회 |
| 48시간 안에도 안 보임 | FAIL/UNKNOWN | MP 수신 누락 또는 property/stream/API secret 문제 확인 |

## Post-send BigQuery Check

| 항목 | 값 |
|---|---|
| checked_at_kst | 2026-05-02 18:18 KST |
| query_result | 표시할 데이터 없음 |
| current_status | `WAIT_EXPORT_LATENCY` |
| interpretation | GA4 collect HTTP 204 직후라 BigQuery raw export 지연 가능성이 있다 |
| next_check | 2026-05-03 18:04 KST 이후 같은 SQL 재조회 |
| send_decision | 추가 GA4 MP 전송 금지 |

## 금지선 확인

| 항목 | 결과 |
|---|---|
| GA4 MP send | 1건, 승인 범위 내 |
| Meta CAPI send | 0 |
| TikTok Events API send | 0 |
| Google Ads conversion send | 0 |
| 운영 DB write | 0 |
| `match_status` update | 0 |
| GTM publish | 0 |
| backend deploy | 0 |
| Imweb header/footer 수정 | 0 |
| NPay click | 0 |
