# 더클린커피 Channel별 구매자 vs 이탈자 Truth Table

작성 시각: 2026-05-18 21:32 KST
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
| direct_or_unknown | 231 | 120 | 111 | 51.95% | 8417922 | 94.81% | 269.06s | 179.03s | 100% | 100% | 32.17% | 23.08% | 11.54% | high |
| meta | 88 | 50 | 38 | 56.82% | 3243506 | 84.09% | 209.61s | 162.88s | 100% | 100% | 15.91% | 16.67% | 20% | high |
| naver_other | 19 | 6 | 13 | 31.58% | 381695 | 89.47% | 330.98s | 339.02s | 100% | 100% | 16.67% | 36.36% | 72.73% | medium |
| naver_paid_or_brand | 174 | 42 | 132 | 24.14% | 2358680 | 92.53% | 234.58s | 102.34s | 100% | 74.4% | 50% | 10.4% | 19.2% | high |
| other | 30 | 14 | 16 | 46.67% | 670079 | 93.33% | 231.26s | 176.93s | 100% | 100% | 21.43% | 14.29% | 28.57% | high |
| youtube | 194 | 116 | 78 | 59.79% | 7928459 | 98.45% | 259.89s | 174.96s | 99.12% | 92.21% | 8.77% | 7.79% | 10.39% | high |

## Landing bucket truth table

| landing bucket | 전체 safe 세션 | 구매자 | 이탈자 | 구매율 | 구매 금액 | GA4 연결률 | 구매자 p50 체류 | 이탈자 p50 체류 | 구매자 cart | 이탈자 cart | confidence |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| cart | 2 | 2 | 0 | 100% | 233965 | 50% | 145.01s |  | 0% |  | low |
| checkout | 625 | 335 | 290 | 53.6% | 22095180 | 93.92% | 255.57s | 183.78s | 22.96% | 17.84% | high |
| home_or_other | 47 | 5 | 42 | 10.64% | 250067 | 95.74% | 227.54s | 105.16s | 50% | 7.32% | high |
| product | 62 | 6 | 56 | 9.68% | 421129 | 91.94% | 133.62s | 31.98s | 16.67% | 5.88% | high |

## 읽는 법

- `구매자`는 VM Cloud에서 실제 결제완료로 닫힌 safe session이다.
- `이탈자`는 VM Cloud에서 checkout/payment page까지 보였지만 같은 safe session 안에서 결제완료로 닫히지 않은 세션이다.
- `이탈자 중 GA4 purchase`가 높으면 진짜 이탈이 아니라 세션 변경, 결제창 이동, GA4/VM window 차이일 수 있다. 이 경우 예산 판단이 아니라 분류 개선 후보로 본다.
- 더클린커피의 GA4 begin_checkout/add_payment_info는 현재 비어 있는 편이라, 이 단계는 GTM/GA4 중간 이벤트 보강 후 다시 봐야 한다.

## 추천 액션

1. 채널별 구매율과 체류시간 차이가 큰 bucket부터 랜딩/콘텐츠/결제 흐름을 비교한다.
2. `dropped_with_ga4_purchase_event`가 있는 bucket은 이탈이 아니라 join/window 문제일 수 있으므로 재분류 규칙을 먼저 확인한다.
3. 더클린커피 GA4에 `view_cart`, `begin_checkout`, `add_payment_info`를 Preview로 확인한 뒤 운영 반영 여부를 결정한다.
