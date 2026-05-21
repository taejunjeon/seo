# 바이오컴 Meta-only 구매자 vs 비결제자 선행지표 Dry-run

작성 시각: 2026-05-20 01:37 KST
Lane: Green read-only
대상: biocom / source_group=meta

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - data/!data_inventory.md
  lane: Green
  allowed_actions:
    - vm_cloud_sqlite_read_only_safe_hash
    - ga4_bigquery_read_only_safe_hash
    - local_aggregate_truth_table_report
  forbidden_actions:
    - operating_db_write
    - vm_cloud_write_or_schema_migration
    - platform_send_or_upload
    - gtm_publish
    - raw_identifier_report_output
  source_window_freshness_confidence:
    source: VM Cloud SQLite + GA4 BigQuery daily export
    window: rolling latest 7d
    freshness: runtime query
    confidence: high
```

## 10초 요약

- VM Cloud에서 Meta 유입으로 분류된 바이오컴 safe session은 254건이고, 이 중 GA4와 붙은 것은 231건(90.94%)이다.
- Meta 구매자는 139건, 비결제자는 115건이다.
- GA4로 붙은 row 기준 구매자 p50 체류시간은 208.03s, 비결제자는 187.74s로 차이는 20.29s이다.
- 비결제자처럼 보였지만 GA4 purchase가 있는 충돌 row는 18건(17.14%)이다. 이 row는 순수 이탈자가 아니라 보류 bucket으로 떼어내야 한다.
- 현재 판정은 high다. 즉, Meta-only 행동 비교를 볼 만큼 GA4-VM 연결은 충분히 닫혔다. 다만 비결제자 중 GA4 purchase가 17.14% 있어 진짜 이탈자와 분류 충돌 row를 분리해야 한다.

## Meta-only truth table

| 구분 | VM safe sessions | GA4 joined | join rate | 금액 | p50 체류 | p75 체류 | scroll90 | view_item | cart/view_cart | begin_checkout | add_payment_info | GA4 purchase |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 구매자 | 139 | 126 | 90.65% | ₩47,984,391 | 208.03s | 354.93s | 96.83% | 46.03% | 11.9% | 99.21% | 0.79% | 98.41% |
| 비결제자 | 115 | 105 | 91.3% | ₩0 | 187.74s | 290.28s | 86.67% | 57.14% | 13.33% | 93.33% | 2.86% | 17.14% |

## 차이값

- 체류시간: 구매자 - 비결제자 = 20.29s.
- scroll90: 구매자 - 비결제자 = 10.16%.
- view_item: 구매자 - 비결제자 = -11.11%.
- cart/view_cart: 구매자 - 비결제자 = -1.43%.
- begin_checkout: 구매자 - 비결제자 = 5.88%.
- add_payment_info: 구매자 - 비결제자 = -2.07%.

## `비결제자인데 GA4 purchase` 충돌 분석

이 bucket은 VM Cloud에서는 같은 safe session 안에서 실제 결제완료로 닫히지 않았지만, GA4 BigQuery에는 purchase event가 있는 경우다. 따라서 `결제 안 한 사람`으로 섞으면 안 되고, 원인 확인 전에는 `구매 판정 충돌`로 분리한다.

- 충돌 row: 18건
- 비결제자 GA4 join row 중 비중: 17.14%

### 원인 bucket

| 원인 후보 | row | 사람이 읽는 의미 |
|---|---:|---|
| checkout_started_only_ga4_purchase | 14 | VM Cloud는 결제 시작까지만 봤고 완료를 못 봤는데 GA4는 purchase를 봤다. 세션 전환 또는 VM completion capture 누락 후보. |
| vm_payment_success_not_confirmed | 3 | VM Cloud에도 payment_success row는 있지만 status가 confirmed가 아니다. 운영DB/Imweb/Toss 확인 전 pending/unknown으로 남은 케이스다. |
| payment_page_seen_only_ga4_purchase | 1 | VM Cloud는 결제 페이지 진입까지만 봤고 완료를 못 봤는데 GA4는 purchase를 봤다. 결제완료 URL/브라우저 이벤트만 GA4로 갔을 가능성이 있다. |

### VM Cloud 흔적

- payment_success row: 3
- confirmed payment_success row: 0
- pending/unknown payment_success row: 3
- 완료 URL 흔적: 2
- 결제키/거래키 presence: payment_key 0, transaction_id 2
- value presence: 2

## 왜 바로 예산 판단이 아닌가

- row-level join은 `같은 사람/같은 세션`으로 VM Cloud와 GA4가 붙는지를 보는 절차다.
- 이번 dry-run에서는 Meta-only 범위의 GA4-VM 연결률이 충분히 높아졌다. 기존 30~34% 가정은 BigQuery query result 2만 row 제한으로 생긴 dry-run 구현 문제였다.
- 그래도 비결제자 cohort 안에 GA4 purchase event가 17.14% 남아 있다. 이것은 진짜 이탈자가 아니라 세션 window 차이, 결제창 이동, source 분류 차이일 가능성이 있다.
- 그래서 이 표는 `구매자는 더 오래 머물렀는가`, `스크롤·장바구니·결제시작이 구매를 예고하는가`를 찾는 선행지표 후보 표로 쓰고, 예산 자동 판단에는 분류 충돌 row를 먼저 떼어낸 뒤 써야 한다.

## 해결 방안

1. `비결제자이지만 GA4 purchase가 있는 row`를 별도 conflict bucket으로 분리한다.
2. 프론트엔드 선행지표 화면에서는 `확정 구매자`, `결제 시작 후 미구매`, `GA4 purchase 충돌`을 나눠 보여준다.
3. conflict bucket이 계속 크면 그 row만 raw-id Plan B 승인 후 secure evidence 안에서 key mapping 오류를 확인한다.
4. key capture 보강은 계속 유지하되, 지금 병목은 join율 자체보다 비결제자 정의 정리다.

## 구체 실행 계획

1. P0: 선행지표 API/문서에서는 Meta-only cohort를 `confirmed_buyer`, `checkout_non_buyer`, `ga4_purchase_conflict` 3개로 나눈다.
   - 무엇을: 비결제자 중 GA4 purchase가 있는 세션을 일반 이탈자에서 제외한다.
   - 왜: 이 row를 이탈자로 두면 구매자/비결제자 행동 차이가 희석된다.
   - 성공 기준: conflict bucket count/rate가 별도 숫자로 보이고, pure checkout_non_buyer의 체류·스크롤·장바구니 지표가 다시 계산된다.
2. P1: Claude Code 프론트엔드 선행지표 화면은 세 그룹을 사람이 이해할 수 있는 말로 보여준다.
   - 무엇을: `구매 완료`, `결제 시작 후 멈춤`, `GA4와 VM 판단 충돌` 카드로 분리한다.
   - 왜: 운영자가 `광고 유입자가 왜 안 샀는지`를 보려면 충돌 데이터를 이탈로 섞으면 안 된다.
   - 성공 기준: Meta-only 필터에서 각 그룹의 p50 체류시간, scroll90, view_item, cart/view_cart, begin_checkout, add_payment_info가 나온다.
3. P2: conflict bucket이 5% 이상 유지될 때만 raw-id Plan B를 검토한다.
   - 무엇을: 승인받은 secure evidence 안에서만 원문 key를 잠시 사용해 mapping 오류를 확인한다.
   - 왜: 현재 join율은 높으므로 원문 ID 디버그를 기본값으로 쓸 필요가 없다.
   - 성공 기준: raw identifier는 보고서/대화/git에 0건이고, conflict 원인이 `window mismatch`, `source mismatch`, `key mapping error` 중 하나로 분류된다.
