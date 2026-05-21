# scroll90 무결성 dry-run — 2026-05-19

문서 성격: Green read-only audit

```yaml
harness_preflight:
  common_harness_read: true
  project_harness_read: true
  lane: Green
  allowed_actions:
    - ga4_bigquery_read_only_aggregate
    - leading_indicators_api_read_only
    - local_report_write
  forbidden_actions:
    - platform_send
    - gtm_publish
    - operating_db_write
    - vm_cloud_write
    - raw_identifier_output
  source_window_freshness_confidence:
    source: GA4 BigQuery daily export + leading-indicators API
    window: latest 7d per site
    freshness: 2026-05-19 23:49 KST
    confidence: high for GA4 aggregate event integrity, medium for VM-GA4 cohort interpretation
```

## 이번에 가능해진 것

GA4 원본 기준의 `scroll` 이벤트와 `percent_scrolled` 값을 분리했다. 과거 dry-run의 높은 scroll90은 `scroll` 이벤트 자체를 90% 도달로 간주한 계산 영향이 컸는지 확인할 수 있다.

## 사이트별 요약

| 사이트 | GA4 세션 | raw percent_scrolled>=90 | scroll 이벤트를 90으로 간주 | 차이 | page_view_long | 리뷰 URL/이벤트 도달 | p50/p75 체류 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 바이오컴 | 64063 | 14.22% | 14.22% | 0%p | 8.25% | 23.5% / 0.01% | 0s / 1s |
| 더클린커피 | 3904 | 0% | 56.48% | 56.48%p | 13.96% | 26.51% / 0% | 14s / 90s |

## 해석

- `raw percent_scrolled>=90`은 GA4 event_params에 90 이상 값이 들어온 경우만 센 값이다.
- `scroll 이벤트를 90으로 간주`는 기존 일부 dry-run에서 쓰던 방식이다. GA4 기본 scroll 이벤트는 보통 90% 도달 때 발생하지만, 구현에 따라 percent_scrolled 값이 0으로 들어오는 사이트가 있어 이 방식은 비율을 부풀릴 수 있다.
- live leadingIndicators API는 VM Cloud row의 `scroll_max_percent` 계열 metadata만 읽으므로 GA4 기반 과거 dry-run과 같은 지표가 아니다.
- 따라서 scroll90을 선행지표로 쓰려면 분모와 source를 같이 내려줘야 한다: 전체 세션 대비, scroll 관측 세션 대비, raw percent 기반, assumed scroll 기반을 분리해야 한다.

## 권장 API 보강

- `scroll_known_sessions`: scroll 값을 알고 있는 세션 수.
- `scroll_unknown_sessions`: scroll 값이 없는 세션 수.
- `scroll90_known_rate_pct`: scroll 관측 세션 중 90% 이상.
- `scroll90_all_sessions_rate_pct`: 전체 cohort 중 90% 이상.
- `scroll_source`: `vm_metadata`, `ga4_percent_scrolled`, `ga4_scroll_event_assumed_90` 중 하나.
- `page_view_long_rate_pct`, `review_reach_rate_pct`, `dwell_p50/p75`를 같은 cohort 분모로 제공.

## 이벤트 분포

### 바이오컴

| event_name | events | sessions | percent=0 | 1-49 | 50-89 | 90+ | review URL events |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| view_item | 14174 | 11696 | 14174 | 0 | 0 | 0 | 2406 |
| scroll | 12130 | 9108 | 0 | 0 | 0 | 12130 | 172 |
| page_view_long | 5727 | 5287 | 5727 | 0 | 0 | 0 | 699 |
| begin_checkout | 1080 | 719 | 1080 | 0 | 0 | 0 | 0 |
| add_payment_info | 703 | 381 | 703 | 0 | 0 | 0 | 1 |
| purchase | 444 | 416 | 444 | 0 | 0 | 0 | 0 |
| review_submit | 18 | 8 | 18 | 0 | 0 | 0 | 0 |

### 더클린커피

| event_name | events | sessions | percent=0 | 1-49 | 50-89 | 90+ | review URL events |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| scroll | 16540 | 2205 | 16540 | 0 | 0 | 0 | 1069 |
| view_item | 837 | 394 | 837 | 0 | 0 | 0 | 0 |
| page_view_long | 599 | 545 | 599 | 0 | 0 | 0 | 95 |
| purchase | 378 | 318 | 378 | 0 | 0 | 0 | 0 |
| begin_checkout | 57 | 41 | 57 | 0 | 0 | 0 | 0 |
