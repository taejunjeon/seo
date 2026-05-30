# reportcoffee coupang source readiness 20260522

작성 시각: 2026-05-22 00:25 KST
문서 성격: 더클린커피 쿠팡 매출 source 조사 v0.1
상위 문서: [[!report]], [[reportcoffee]], [[reportcoffee-dry-run-20260521]]

```yaml
harness_preflight:
  lane: Green
  allowed_actions:
    - read_only_operational_db_aggregate
    - read_only_local_sqlite_query
    - read_only_coupang_api_probe
    - local_report_artifact
  forbidden_actions:
    - operating_db_write
    - coupang_order_update
    - slack_send
    - platform_send_or_upload
    - raw_identifier_output
  source_window_freshness_confidence:
    source: 운영DB aggregate + 로컬 SQLite aggregate + Coupang Wing read-only aggregate
    window: 2026-05-15 - 2026-05-21, 2026-04-22 - 2026-05-21
    freshness: 2026-05-22 00:25 KST
    confidence: medium for source map, low for current included amount
```

## 사람 말 결론

더클린커피 쿠팡은 아직 Slack 총매출에 넣으면 안 된다. 최신 상품/수량은 PlayAuto에 있지만 금액이 0원이고, 금액이 있는 쿠팡 source들은 오래됐거나 바이오컴 중심이다.

다만 길은 보인다. TeamKeto 쿠팡 API는 read-only로 접근된다. 이제 필요한 것은 raw 주문 정보를 저장하거나 출력하지 않는 “일별 aggregate 수집기”다.

## source별 판단

### PlayAuto 쿠팡

source: 운영DB `tb_playauto_orders shop_name='쿠팡'`

- 주간: 30행 / 31개, 그중 coffee hint 17행 / 18개, 금액 0원, 최신 2026-05-20.
- 월간: 166행 / 174개, 그중 coffee hint 118행 / 126개, 금액 0원, 최신 2026-05-20.

판단: 상품/수량 source로는 좋지만 매출액 source는 아니다.

### 로컬 쿠팡 RG 주문 API cache

source: 로컬 SQLite `coupang_rg_orders_api`

- TeamKeto 전체: 436행 / 14,238,900원.
- 최신 paid_at: 2026-04-23.
- rolling 30d에 걸친 값: 15행 / 496,500원. 단 2026-04-22 - 2026-04-23 일부라 현재 월간으로 보면 stale이다.

판단: 과거 TeamKeto coffee gross source로는 쓸 수 있지만, 현재 주간/월간 fresh source는 아니다.

### 로컬 쿠팡 정산 cache

source: 로컬 SQLite `coupang_settlements_api`

- TeamKeto final_amount: 15,966,931원.
- TeamKeto total_sale: 45,932,600원.
- max recognition month: 2026-04.
- max settlement date: 2026-06-01.

판단: 월간 정산 리포트에는 후보가 될 수 있다. 주간 매출 보고에는 부적합하다. 그리고 TJ님 기준으로 `total_sale`을 매출로 볼지, `final_amount`를 정산 입금 기준으로 볼지 선택이 필요하다.

### 운영DB 쿠팡 테이블

source: 운영DB `tb_sales_coupang`, `tb_coupang_orders_rg`

- `tb_sales_coupang`: last_7d 0원. last_30d는 2026-04-30까지만 있고, `영양제/미분류` 중심이라 coffee weekly source로 안전하지 않다.
- `tb_coupang_orders_rg`: 최신 2026-05-20까지 있으나 vendor `A00668577` 중심이고 coffee hint gross는 0원이다.

판단: 현재 더클린커피 쿠팡 매출액 source로 쓰지 않는다.

### Coupang Wing API

source: Coupang Wing API read-only probe

- TeamKeto credentials configured.
- Biocom credentials configured.
- TeamKeto RG 2026-05-21: 0건.
- TeamKeto ordersheets 최근 24h status aggregate: 11 sheet / 11 item / 449,600원, coffee hint amount 0원.
- Biocom 일부 status probe는 429가 있었으나 TeamKeto 접근 자체는 확인됐다.

판단: API 접근 가능성은 있다. 하지만 주간/월간 coffee 금액으로 포함하려면 일별 aggregate 수집 + 상품 classifier + rate-limit 처리가 필요하다.

## 결론

현재 리포트에서는 쿠팡을 `source pending`으로 유지한다.

```text
쿠팡: source pending
이유: 최신 PlayAuto는 금액 0, 금액 source는 stale 또는 non-coffee, API는 aggregate 수집기 미구현
```

## 다음 할일

1. Codex가 쿠팡 TeamKeto ordersheets aggregate script를 만든다.
   무엇을: 1일 단위로 TeamKeto ordersheets를 read-only 조회하고, productName을 coffee/teamketo/unknown으로 분류한 뒤 count/amount만 저장 또는 출력한다.
   왜: PlayAuto의 수량과 API의 금액을 맞춰야 쿠팡을 총매출에 넣을 수 있다.
   성공 기준: raw 주문번호/수취인/연락처 없이 날짜별 coffee amount가 나온다.
   승인 필요: 로컬 no-write script는 없음. VM cron/cache는 별도 승인.
   추천 점수/자신감: 82%.

2. TJ님이 나중에 정산 기준을 선택한다.
   무엇을: 쿠팡 월간 리포트에서 `total_sale`을 매출로 볼지, `final_amount`를 정산 입금 기준으로 볼지 결정한다.
   왜: 매출 보고와 정산 보고는 숫자의 목적이 다르다.
   어디서: 이 문서의 `로컬 쿠팡 정산 cache` 섹션.
   성공 기준: Slack 월간 쿠팡 라벨이 `총판매액` 또는 `정산입금액`으로 명확해진다.
   Codex가 대신 못 하는 이유: 사업상 보고 기준 선택이다.
   추천 점수/자신감: 64%.
