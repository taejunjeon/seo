# BigQuery funnel window coverage - 2026-05-10

## 결론
7/14/30일 funnel 결과가 같은 이유는 쿼리 window 문제가 아니라 현재 GA4 BigQuery export source에 실제 daily suffix가 20260507~20260509 3개뿐이기 때문이다. 따라서 현재 BigQuery 결과는 trend proof가 아니라 source coverage warning이다.

## Suffix coverage

### last_7d
- requested suffix: 20260503 ~ 20260509
- actual suffix count: 3
- total rows: 147,696
  - 20260507: 69,704 rows (2026-05-07 00:00:03 ~ 2026-05-07 23:59:58)
  - 20260508: 43,473 rows (2026-05-08 00:00:00 ~ 2026-05-08 23:59:43)
  - 20260509: 34,519 rows (2026-05-09 00:00:05 ~ 2026-05-09 23:59:24)

### last_14d
- requested suffix: 20260426 ~ 20260509
- actual suffix count: 3
- total rows: 147,696
  - 20260507: 69,704 rows (2026-05-07 00:00:03 ~ 2026-05-07 23:59:58)
  - 20260508: 43,473 rows (2026-05-08 00:00:00 ~ 2026-05-08 23:59:43)
  - 20260509: 34,519 rows (2026-05-09 00:00:05 ~ 2026-05-09 23:59:24)

### last_30d
- requested suffix: 20260410 ~ 20260509
- actual suffix count: 3
- total rows: 147,696
  - 20260507: 69,704 rows (2026-05-07 00:00:03 ~ 2026-05-07 23:59:58)
  - 20260508: 43,473 rows (2026-05-08 00:00:00 ~ 2026-05-08 23:59:43)
  - 20260509: 34,519 rows (2026-05-09 00:00:05 ~ 2026-05-09 23:59:24)

## Verdict
- HOLD_source_coverage_same_rows
- 7/14/30d trend comparison: HOLD
- next: GA4 Data API, archive dataset, or daily snapshot source 확인
