# 더클린커피 Channel별 구매자 vs 이탈자 Truth Table

작성 시각: 2026-05-20 01:37 KST
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
| direct_or_unknown | 147 | 73 | 74 | 49.66% | 4757393 | 91.84% | 317.87s | 179.03s | 100% | 100% | 36.23% | 28.79% | 13.64% | high |
| meta | 76 | 41 | 35 | 53.95% | 2345574 | 88.16% | 241.78s | 148.4s | 100% | 100% | 25% | 12.9% | 12.9% | high |
| naver_other | 16 | 2 | 14 | 12.5% | 57800 | 87.5% | 112.15s | 276.11s | 100% | 100% | 0% | 33.33% | 66.67% | medium |
| naver_paid_or_brand | 150 | 42 | 108 | 28% | 2249717 | 80% | 219.99s | 89.97s | 100% | 78.82% | 48.57% | 11.76% | 23.53% | high |
| other | 18 | 7 | 11 | 38.89% | 384907 | 94.44% | 214.04s | 176.49s | 100% | 100% | 42.86% | 0% | 10% | medium |
| youtube | 102 | 62 | 40 | 60.78% | 4867757 | 95.1% | 265.94s | 143.56s | 98.33% | 86.49% | 6.67% | 2.7% | 5.41% | high |

## Landing bucket truth table

| landing bucket | 전체 safe 세션 | 구매자 | 이탈자 | 구매율 | 구매 금액 | GA4 연결률 | 구매자 p50 체류 | 이탈자 p50 체류 | 구매자 cart | 이탈자 cart | confidence |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| cart | 2 | 2 | 0 | 100% | 233965 | 100% | 22.2s |  | 0% |  | low |
| checkout | 420 | 216 | 204 | 51.43% | 13838469 | 90.95% | 269.91s | 176.49s | 28.14% | 19.13% | high |
| home_or_other | 36 | 4 | 32 | 11.11% | 221167 | 80.56% | 295.47s | 105.16s | 66.67% | 3.85% | high |
| product | 51 | 5 | 46 | 9.8% | 369547 | 72.55% | 133.62s | 20.4s | 0% | 6.25% | medium |

## 읽는 법

- `구매자`는 VM Cloud에서 실제 결제완료로 닫힌 safe session이다.
- `이탈자`는 VM Cloud에서 checkout/payment page까지 보였지만 같은 safe session 안에서 결제완료로 닫히지 않은 세션이다.
- `이탈자 중 GA4 purchase`가 높으면 진짜 이탈이 아니라 세션 변경, 결제창 이동, GA4/VM window 차이일 수 있다. 이 경우 예산 판단이 아니라 분류 개선 후보로 본다.
- 더클린커피의 GA4 begin_checkout/add_payment_info는 현재 비어 있는 편이라, 이 단계는 GTM/GA4 중간 이벤트 보강 후 다시 봐야 한다.

## 추천 액션

1. 채널별 구매율과 체류시간 차이가 큰 bucket부터 랜딩/콘텐츠/결제 흐름을 비교한다.
2. `dropped_with_ga4_purchase_event`가 있는 bucket은 이탈이 아니라 join/window 문제일 수 있으므로 재분류 규칙을 먼저 확인한다.
3. 더클린커피 GA4에 `view_cart`, `begin_checkout`, `add_payment_info`를 Preview로 확인한 뒤 운영 반영 여부를 결정한다.
