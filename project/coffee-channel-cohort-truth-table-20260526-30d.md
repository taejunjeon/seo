# 더클린커피 Channel별 구매자 vs 이탈자 Truth Table

작성 시각: 2026-05-26 17:42 KST
Lane: Green read-only
대상: thecleancoffee

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - data/!data_inventory.md
    - harness/coffee-data/RULES.md
  lane: Green
  allowed_actions:
    - vm_cloud_sqlite_read_only_safe_hash
    - ga4_bigquery_read_only_safe_hash
    - aggregate_truth_table_report
  forbidden_actions:
    - operating_db_write
    - vm_cloud_schema_migration
    - gtm_publish
    - platform_send_or_upload
    - raw_identifier_report_output
  source_window_freshness_confidence:
    source: VM Cloud SQLite + GA4 BigQuery daily export
    window: rolling latest 30d
    freshness: runtime query
    confidence: high for safe bridge coverage, medium for dropped-checkout interpretation
```

## 왜 이 표를 보는가

광고·자연검색·직접방문 같은 유입 채널별로 `구매까지 간 사람`과 `결제 흐름에서 멈춘 사람`의 행동 차이를 본다. 이 표는 광고 예산을 바로 바꾸는 표가 아니라, 구매 전에 어떤 행동이 매출을 예고하는지 찾는 선행지표 탐색 표다.

## Channel truth table

| channel | 전체 safe 세션 | 구매자 | 이탈자 | 구매율 | 구매 금액 | GA4 연결률 | 구매자 p50 체류 | 이탈자 p50 체류 | 구매자 scroll90 | 이탈자 scroll90 | 구매자 cart | 이탈자 cart | 이탈자 중 GA4 purchase | confidence |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| direct_or_unknown | 390 | 188 | 202 | 48.21% | 12061677 | 98.97% | 332.76s | 201.15s | 100% | 99.5% | 41.62% | 25.37% | 22.39% | high |
| google_paid | 4 | 0 | 4 | 0% | 0 | 100% |  | 21.72s |  | 100% |  | 0% | 25% | low |
| meta | 205 | 96 | 109 | 46.83% | 5324380 | 97.56% | 209.61s | 198.72s | 100% | 100% | 16.84% | 17.14% | 15.24% | high |
| naver_other | 43 | 21 | 22 | 48.84% | 1285486 | 93.02% | 283.67s | 287.66s | 100% | 100% | 36.84% | 33.33% | 61.9% | high |
| naver_paid_or_brand | 522 | 128 | 394 | 24.52% | 6389344 | 95.02% | 234.58s | 108.63s | 100% | 78.76% | 44.35% | 15.05% | 24.73% | high |
| other | 74 | 35 | 39 | 47.3% | 1882060 | 95.95% | 308.09s | 176.93s | 100% | 97.37% | 42.42% | 10.53% | 28.95% | high |
| youtube | 206 | 123 | 83 | 59.71% | 8530439 | 99.51% | 258.69s | 175.15s | 99.18% | 92.77% | 8.2% | 7.23% | 9.64% | high |

## Landing bucket truth table

| landing bucket | 전체 safe 세션 | 구매자 | 이탈자 | 구매율 | 구매 금액 | GA4 연결률 | 구매자 p50 체류 | 이탈자 p50 체류 | 구매자 cart | 이탈자 cart | confidence |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| cart | 4 | 4 | 0 | 100% | 347780 | 100% | 145.01s |  | 50% |  | low |
| checkout | 1139 | 566 | 573 | 49.69% | 34016067 | 98.16% | 264.43s | 207.1s | 30.76% | 21.71% | high |
| home_or_other | 145 | 11 | 134 | 7.59% | 532925 | 92.41% | 240.14s | 78.29s | 50% | 7.14% | high |
| product | 156 | 10 | 146 | 6.41% | 576614 | 93.59% | 131.9s | 39.84s | 20% | 8.09% | high |

## 읽는 법

- `구매자`는 VM Cloud에서 실제 결제완료로 닫힌 safe session이다.
- `이탈자`는 VM Cloud에서 checkout/payment page까지 보였지만 같은 safe session 안에서 결제완료로 닫히지 않은 세션이다.
- `이탈자 중 GA4 purchase`가 높으면 진짜 이탈이 아니라 세션 변경, 결제창 이동, GA4/VM window 차이일 수 있다. 이 경우 예산 판단이 아니라 분류 개선 후보로 본다.
- 더클린커피의 GA4 begin_checkout/add_payment_info는 현재 비어 있는 편이라, 이 단계는 GTM/GA4 중간 이벤트 보강 후 다시 봐야 한다.

## 추천 액션

1. 채널별 구매율과 체류시간 차이가 큰 bucket부터 랜딩/콘텐츠/결제 흐름을 비교한다.
2. `dropped_with_ga4_purchase_event`가 있는 bucket은 이탈이 아니라 join/window 문제일 수 있으므로 재분류 규칙을 먼저 확인한다.
3. 더클린커피 GA4에 `view_cart`, `begin_checkout`, `add_payment_info`를 Preview로 확인한 뒤 운영 반영 여부를 결정한다.
