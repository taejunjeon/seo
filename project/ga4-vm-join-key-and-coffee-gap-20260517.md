# GA4 ↔ VM Cloud Join Key / Coffee Middle Event Gap Dry-run

작성 시각: 2026-05-17 16:58 KST
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
    - vm_cloud_sqlite_read_only_aggregate
    - ga4_bigquery_read_only_aggregate
    - local_report_script
    - documentation_update
  forbidden_actions:
    - operating_db_write
    - vm_cloud_schema_migration
    - platform_send_or_upload
    - gtm_publish
    - vm_cloud_deploy_or_restart
  source_window_freshness_confidence:
    source: VM Cloud SQLite aggregate read-only + GA4 BigQuery daily export read-only
    window: VM Cloud rolling last 7d; GA4 latest daily table minus 6 days
    freshness: runtime query
    confidence: medium_high for key presence, medium for row-level buyer/dropout join
```

## 10초 요약

- VM Cloud 결제완료 row에는 GA4와 이어볼 수 있는 세션 키가 대부분 남아 있다.
- 바이오컴과 더클린커피 모두 `checkout_id` 기준으로 결제 전 단계와 결제완료가 거의 이어진다.
- 더클린커피 GA4는 purchase event는 있는데 begin_checkout/add_payment_info가 없다. 결제 단계가 없다는 뜻이 아니라 GA4 중간 이벤트 계측 gap이다.
- 아직 예산 판단용 source별 구매율은 만들지 않는다. 다음 단계는 raw id 출력 없이 safe session/order bridge를 만드는 것이다.

## VM Cloud confirmed purchase join key coverage

| site | confirmed | GA session key | checkout key | metadata client key | prior checkout match | prior GA session match | landing match by client | status |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| biocom | 410 | 94.39% | 100% | 94.39% | 99.76% | 94.15% | 77.8% | needs_key_capture_improvement |
| thecleancoffee | 335 | 99.1% | 99.7% | 99.1% | 99.7% | 98.81% | 80% | strong_enough_for_next_row_level_dry_run |

## 쉬운 설명

이번 확인은 `이 주문이 어떤 방문에서 시작됐는지 추적할 수 있는 열쇠가 남아 있는가`를 보는 작업이다.
열쇠가 있으면 다음 sprint에서 구매자와 이탈자를 같은 기준으로 비교할 수 있다.
열쇠가 없으면 GA4의 방문자 숫자와 VM Cloud의 주문 숫자를 억지로 나누게 되고, 그 값은 진짜 구매율이 아니다.

## GA4 middle event gap

| site | window | view_item | add_to_cart | view_cart | begin_checkout | add_payment_info | sign_up | purchase | interpretation |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| biocom | 2026-05-10~2026-05-16 | 11465 | 623 | 17 | 773 | 454 | 436 | 416 | GA4 middle event availability should be read with VM Cloud cross-check. |
| thecleancoffee | 2026-05-10~2026-05-16 | 510 | 205 | 0 | 0 | 0 | 0 | 432 | GA4 purchase exists but begin_checkout/add_payment_info are absent. This is event instrumentation gap, not proof that checkout did not happen. |

## 더클린커피 gap 판단

- 더클린커피는 VM Cloud에서 결제 시작과 결제완료가 잡힌다.
- 하지만 GA4에는 begin_checkout/add_payment_info가 0으로 나온다.
- 따라서 `사용자가 결제 단계에 가지 않았다`가 아니라 `GA4 ecommerce 중간 이벤트가 더클린커피 결제 흐름에서 안 찍힌다`가 현재 판단이다.
- 화면에는 GA4 중간 이벤트를 결제 단계 정답으로 쓰지 말고, VM Cloud payment_started를 결제 단계 primary로 써야 한다.

## 다음 개발 판단

- 바이오컴/더클린커피 모두 next step은 row-level safe bridge dry-run이다.
- 더클린커피 GA4에는 begin_checkout/add_payment_info 보강 설계를 별도 ticket으로 둔다.
- 운영 전송, GTM publish, VM Cloud deploy, 운영DB write는 하지 않았다.
