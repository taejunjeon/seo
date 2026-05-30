# GA4 ↔ VM Cloud Row-level Safe Bridge Dry-run

작성 시각: 2026-05-24 11:50 KST
Lane: Green read-only
대상: biocom / thecleancoffee 분리

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - data/!data_inventory.md
    - harness/coffee-data/README.md
    - harness/coffee-data/RULES.md
    - harness/coffee-data/VERIFY.md
  lane: Green
  allowed_actions:
    - vm_cloud_sqlite_read_only_safe_hash
    - ga4_bigquery_read_only_safe_hash
    - local_aggregate_join_report
  forbidden_actions:
    - operating_db_write
    - vm_cloud_schema_migration
    - platform_send_or_upload
    - gtm_publish
    - raw_identifier_report_output
  source_window_freshness_confidence:
    source: VM Cloud SQLite + GA4 BigQuery daily export
    window: rolling latest 7d
    freshness: runtime query
    confidence: medium_high for joined sessions, medium for dropout interpretation
```

## 10초 요약

- 원문 주문번호/결제키/회원값을 보고서에 쓰지 않고, VM Cloud와 GA4 양쪽에서 같은 방식의 safe session hash를 만들어 붙였다.
- 바이오컴은 구매 세션과 이탈 세션이 최소 95.56% 이상 GA4와 이어졌다. 기존 30%대 연결률은 BigQuery 결과를 2만 row까지만 읽던 dry-run 구현 제한 영향이었다.
- 더클린커피는 구매 세션과 이탈 세션이 최소 96.41% 이상 GA4와 이어져 row-level 행동 비교가 가능하다.
- 결제 페이지까지 갔지만 구매로 닫히지 않은 세션은 `원인 비교용`이지 예산 판단용 전환율이 아니다.
- Plan B raw id 디버그는 실행하지 않았다. 필요 시 승인받아 secure evidence 내부에서만 쓰는 방식으로 남겼다.

## Safe bridge result

| site | cohort | VM safe sessions | GA4 joined | join rate | amount | p50 dwell | p75 dwell | scroll90 | add_to_cart | begin_checkout | add_payment_info | GA4 purchase |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| biocom | confirmed_purchase | 371 | 356 | 95.96% | 111177580 | 206.57 | 372.87 | 91.85% | 14.89% | 99.16% | 4.21% | 99.44% |
| biocom | dropped_checkout | 721 | 689 | 95.56% | 0 | 88.57 | 214.39 | 69.67% | 8.85% | 44.56% | 2.61% | 3.05% |
| thecleancoffee | confirmed_purchase | 127 | 126 | 99.21% | 8277650 | 209.61 | 404.03 | 100% | 28.57% | 81.75% | 0% | 100% |
| thecleancoffee | dropped_checkout | 195 | 188 | 96.41% | 0 | 176.93 | 339.22 | 90.96% | 19.68% | 57.98% | 0% | 20.74% |

## 판단

| site | readiness | interpretation |
|---|---|---|
| biocom | safe_bridge_usable_for_behavior_comparison | 구매자/이탈자 행동 비교를 Green 분석으로 진행할 수 있다. |
| thecleancoffee | safe_bridge_usable_for_behavior_comparison | 구매자/이탈자 행동 비교를 Green 분석으로 진행할 수 있다. |

## 사람이 이해하기 쉬운 해석

- `confirmed_purchase`는 VM Cloud에서 실제 결제완료로 닫힌 세션이다.
- `dropped_checkout`은 VM Cloud에서 결제 시작/결제 페이지까지는 갔지만 같은 safe session hash 안에서 결제완료로 닫히지 않은 세션이다.
- 구매 세션과 이탈 세션을 같은 hash로 GA4 행동 데이터에 붙였으므로, 이제 평균 체류시간·스크롤·장바구니·결제수단 이벤트가 구매 예고 신호인지 비교할 수 있다.
- 단, 이탈 세션은 브라우저 쿠키/세션 재생성, 결제창 이동, GA4 export 지연 때문에 일부가 빠질 수 있다. 그래서 예산 판단용 ROAS가 아니라 선행지표 후보 찾기용이다.

## Plan B: raw id debug 승인안

이번 dry-run에서는 raw id를 실행하지 않았다.
safe hash join이 부족하거나 특정 주문 1건의 경로를 반드시 닫아야 할 때만 아래 방식으로 승인 후 진행한다.

1. secure local/VM evidence 내부에서만 raw order/payment/member key를 읽는다.
2. 결과 문서·대화·Telegram·git에는 raw 값을 쓰지 않고 safe_ref와 집계만 남긴다.
3. 조사 직후 임시 raw evidence를 삭제하거나 gitignore 밖으로 절대 이동하지 않는다.
4. 목적은 key mapping 오류인지, GA4 export 지연인지, checkout artifact인지 분류하는 데 한정한다.

## 다음 개발 판단

- P0: 선행지표 에이전트는 이 safe bridge 결과를 사용해 구매자/이탈자 행동 차이를 비교한다.
- P1: 더클린커피는 GA4 begin_checkout/add_payment_info가 비어 있어 VM Cloud checkout/payment_page_seen을 우선 funnel source로 쓴다.
- P2: raw id Plan B는 특정 결제건이 꼭 닫히지 않을 때만 승인받아 실행한다.
