# 더클린커피 Channel별 구매자 vs 이탈자 Truth Table

작성 시각: 2026-05-24 11:50 KST
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
    window: rolling latest 7d
    freshness: runtime query
    confidence: high for safe bridge coverage, medium for dropped-checkout interpretation
```

## 왜 이 표를 보는가

광고·자연검색·직접방문 같은 유입 채널별로 `구매까지 간 사람`과 `결제 흐름에서 멈춘 사람`의 행동 차이를 본다. 이 표는 광고 예산을 바로 바꾸는 표가 아니라, 구매 전에 어떤 행동이 매출을 예고하는지 찾는 선행지표 탐색 표다.

## Channel truth table

| channel | 전체 safe 세션 | 구매자 | 이탈자 | 구매율 | 구매 금액 | GA4 연결률 | 구매자 p50 체류 | 이탈자 p50 체류 | 구매자 scroll90 | 이탈자 scroll90 | 구매자 cart | 이탈자 cart | 이탈자 중 GA4 purchase | confidence |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| direct_or_unknown | 61 | 26 | 35 | 42.62% | 1833809 | 100% | 385.54s | 232.52s | 100% | 100% | 46.15% | 25.71% | 22.86% | high |
| google_paid | 3 | 0 | 3 | 0% | 0 | 100% |  | 43.09s |  | 100% |  | 0% | 0% | low |
| meta | 88 | 39 | 49 | 44.32% | 2156704 | 97.73% | 188.81s | 225.43s | 100% | 100% | 15.38% | 14.89% | 14.89% | high |
| naver_other | 13 | 4 | 9 | 30.77% | 330964 | 100% | 152.54s | 416.26s | 100% | 100% | 25% | 55.56% | 33.33% | medium |
| naver_paid_or_brand | 119 | 38 | 81 | 31.93% | 2016776 | 95.8% | 200.6s | 116.42s | 100% | 79.22% | 37.84% | 20.78% | 25.97% | high |
| other | 14 | 6 | 8 | 42.86% | 540427 | 92.86% | 576.56s | 44.97s | 100% | 85.71% | 50% | 0% | 14.29% | medium |
| youtube | 24 | 14 | 10 | 58.33% | 1398970 | 100% | 165.49s | 175.15s | 100% | 100% | 0% | 0% | 0% | medium |

## Landing bucket truth table

| landing bucket | 전체 safe 세션 | 구매자 | 이탈자 | 구매율 | 구매 금액 | GA4 연결률 | 구매자 p50 체류 | 이탈자 p50 체류 | 구매자 cart | 이탈자 cart | confidence |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| cart | 1 | 1 | 0 | 100% | 105145 | 100% | 22.2s |  | 0% |  | low |
| checkout | 258 | 122 | 136 | 47.29% | 8039025 | 98.45% | 219.99s | 220.24s | 28.93% | 24.06% | high |
| home_or_other | 26 | 2 | 24 | 7.69% | 59004 | 92.31% | 101.02s | 74.31s | 0% | 4.55% | medium |
| product | 37 | 2 | 35 | 5.41% | 74476 | 94.59% | 131.9s | 27.41s | 50% | 12.12% | high |

## 읽는 법

- `구매자`는 VM Cloud에서 실제 결제완료로 닫힌 safe session이다.
- `이탈자`는 VM Cloud에서 checkout/payment page까지 보였지만 같은 safe session 안에서 결제완료로 닫히지 않은 세션이다.
- `이탈자 중 GA4 purchase`가 높으면 진짜 이탈이 아니라 세션 변경, 결제창 이동, GA4/VM window 차이일 수 있다. 이 경우 예산 판단이 아니라 분류 개선 후보로 본다.
- 더클린커피의 GA4 begin_checkout/add_payment_info는 현재 비어 있는 편이라, 이 단계는 GTM/GA4 중간 이벤트 보강 후 다시 봐야 한다.

## 추천 액션

1. 채널별 구매율과 체류시간 차이가 큰 bucket부터 랜딩/콘텐츠/결제 흐름을 비교한다.
2. `dropped_with_ga4_purchase_event`가 있는 bucket은 이탈이 아니라 join/window 문제일 수 있으므로 재분류 규칙을 먼저 확인한다.
3. 더클린커피 GA4에 `view_cart`, `begin_checkout`, `add_payment_info`를 Preview로 확인한 뒤 운영 반영 여부를 결정한다.
