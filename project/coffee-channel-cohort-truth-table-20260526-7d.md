# 더클린커피 Channel별 구매자 vs 이탈자 Truth Table

작성 시각: 2026-05-26 17:43 KST
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
| direct_or_unknown | 54 | 25 | 29 | 46.3% | 1327643 | 92.59% | 337.79s | 269.65s | 100% | 100% | 68.18% | 25% | 35.71% | high |
| google_paid | 4 | 0 | 4 | 0% | 0 | 100% |  | 21.72s |  | 100% |  | 0% | 25% | low |
| meta | 89 | 34 | 55 | 38.2% | 1569236 | 94.38% | 185s | 232.14s | 100% | 100% | 3.03% | 17.65% | 15.69% | high |
| naver_other | 11 | 6 | 5 | 54.55% | 464860 | 81.82% | 240.14s | 191.7s | 100% | 100% | 40% | 25% | 0% | medium |
| naver_paid_or_brand | 138 | 39 | 99 | 28.26% | 2056349 | 85.51% | 207.56s | 82.14s | 100% | 79.27% | 30.56% | 15.85% | 25.61% | high |
| other | 14 | 6 | 8 | 42.86% | 516120 | 78.57% | 196s | 44.97s | 100% | 85.71% | 50% | 0% | 28.57% | medium |
| youtube | 8 | 5 | 3 | 62.5% | 347645 | 87.5% | 211.22s | 99.53s | 100% | 100% | 0% | 0% | 0% | low |

## Landing bucket truth table

| landing bucket | 전체 safe 세션 | 구매자 | 이탈자 | 구매율 | 구매 금액 | GA4 연결률 | 구매자 p50 체류 | 이탈자 p50 체류 | 구매자 cart | 이탈자 cart | confidence |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| cart | 1 | 1 | 0 | 100% | 67115 | 100% | 342.14s |  | 100% |  | low |
| checkout | 237 | 108 | 129 | 45.57% | 5954169 | 91.14% | 213.28s | 217.34s | 28.57% | 22.03% | high |
| home_or_other | 37 | 4 | 33 | 10.81% | 186093 | 78.38% | 240.14s | 60.87s | 33.33% | 3.85% | medium |
| product | 43 | 2 | 41 | 4.65% | 74476 | 86.05% | 131.9s | 39.84s | 50% | 8.57% | high |

## 읽는 법

- `구매자`는 VM Cloud에서 실제 결제완료로 닫힌 safe session이다.
- `이탈자`는 VM Cloud에서 checkout/payment page까지 보였지만 같은 safe session 안에서 결제완료로 닫히지 않은 세션이다.
- `이탈자 중 GA4 purchase`가 높으면 진짜 이탈이 아니라 세션 변경, 결제창 이동, GA4/VM window 차이일 수 있다. 이 경우 예산 판단이 아니라 분류 개선 후보로 본다.
- 더클린커피의 GA4 begin_checkout/add_payment_info는 현재 비어 있는 편이라, 이 단계는 GTM/GA4 중간 이벤트 보강 후 다시 봐야 한다.

## 추천 액션

1. 채널별 구매율과 체류시간 차이가 큰 bucket부터 랜딩/콘텐츠/결제 흐름을 비교한다.
2. `dropped_with_ga4_purchase_event`가 있는 bucket은 이탈이 아니라 join/window 문제일 수 있으므로 재분류 규칙을 먼저 확인한다.
3. 더클린커피 GA4에 `view_cart`, `begin_checkout`, `add_payment_info`를 Preview로 확인한 뒤 운영 반영 여부를 결정한다.
