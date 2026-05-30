# reportcoffee 제품별 매출 설계 20260522

작성 시각: 2026-05-22 14:08 KST
기준일: 2026-05-22
문서 성격: 더클린커피 주간·월간 Slack 보고에 제품별 매출을 붙이는 실행 설계
담당: Codex
상위 문서: [[reportcoffee]], [[!report]]
관련 문서: [[reportcoffee-slack-preview-20260522]], [[reportcoffee-weekly-aggregate-scripts-20260522]], [[reportcoffee-selfmall-dedupe-rule-20260522]], [[reportcoffee-coupang-source-readiness-20260522]]

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - harness/coffee-data/README.md
    - harness/coffee-data/RULES.md
    - data/!data_inventory.md
    - report/reportcoffee.md
    - report/reportcoffee-slack-preview-20260522.md
  lane: Green
  allowed_actions:
    - local_documentation
    - read_only_source_design
    - no_send_slack_preview_design
    - no_write_aggregate_schema_design
  forbidden_actions:
    - slack_send
    - operating_db_write
    - vm_cloud_write_or_deploy
    - platform_send_or_upload
    - gtm_publish
    - raw_identifier_output
  source_window_freshness_confidence:
    source: 운영DB PlayAuto + VM Cloud Imweb order item 후보 + Coupang TeamKeto ordersheets API + 기존 reportcoffee dry-run
    window: weekly 2026-05-15 - 2026-05-21 KST, rolling_30d 2026-04-22 - 2026-05-21 KST
    freshness: SmartStore prior aggregate max 2026-05-20, Coupang API fresh through 2026-05-21, self-mall item line freshness probe required
    confidence: high for Coupang product output, medium_high for SmartStore product output, medium for self-mall product allocation until item line freshness probe
```

## 10초 요약

제품별 매출을 붙이는 목적은 “이번 주 매출이 왜 늘었는지, 또는 왜 줄었는지”를 채널 총액만 보고 끝내지 않기 위해서다.

Slack 보고에는 채널별 총매출 옆에 TOP 상품 3개를 붙인다. 스마트스토어는 PlayAuto(여러 판매 채널 주문을 한 운영DB 테이블로 모아 둔 수집 원천) 상품명을 쓴다. 쿠팡은 TeamKeto ordersheets(쿠팡 판매자 주문서 API, 주문서에서 상품명·수량·금액을 읽는 공식 통로)를 쓴다. 자사몰은 Imweb order items(아임웹 주문 안의 상품별 행, 한 주문에 상품이 2개면 2줄로 나뉘는 데이터)를 우선 확인한다.

현재 바로 붙일 수 있는 것은 스마트스토어와 쿠팡이다. 자사몰은 총매출 dedupe(같은 주문을 두 번 세지 않게 막는 규칙)는 잡혀 있지만, NPay·Toss·상품 라인을 같은 주문 단위로 맞추는 검증이 한 번 더 필요하다.

## 성공 기준

1. 주간과 월간 Slack 보고에 채널별 매출 옆 TOP 상품 3개가 붙는다.
2. 상품별 금액 합계가 채널 총매출을 초과하지 않는다.
3. 같은 주문이 NPay와 Toss 또는 자사몰 summary에서 중복 집계되지 않는다.
4. 상품명은 보여주되 raw 주문번호, 결제키, 전화번호, 이메일, 회원코드, 클릭 ID는 출력하지 않는다.
5. 상품별 매출도 source, window, freshness, confidence를 같이 표시한다.

## Slack에서 보일 형태

```text
제품별 매출 TOP3
- 자사몰: 방탄커피 6,474,632원 / 콜롬비아 스페셜티 277,799원 / 3위는 item-line freshness 확인 후 확정
- 스마트스토어: 방탄커피 840ml 10개 464,600원 / 콜롬비아 스페셜티 369,810원 / 에티오피아 구지 315,100원
- 쿠팡 coffee 상품: 파푸아뉴기니 디카페인 357,800원 / 케냐 AA 335,100원 / 콜롬비아 스페셜티 286,200원
주의: 자사몰 TOP 상품은 line-item freshness 확인 전까지 cross-check로 표시합니다.
```

## 채널별 설계

### 자사몰

무엇을 하는가: 자사몰 총매출 옆에 어떤 상품이 자사몰 매출을 만들었는지 붙인다.

왜 하는가: 자사몰은 NPay, 카드, 계좌, 정기결제처럼 결제수단이 섞인다. 총매출만 보면 어느 상품이 매출 변동을 만들었는지 모른다.

어떻게 하는가:

1. 주문 총액은 기존 자사몰 dedupe rule을 유지한다. 현재 주간 보고 기준은 Toss 계열 9,611,622원 + NPay actual 3,693,400원 = 13,305,022원이다.
2. 상품 라인은 VM Cloud `imweb_order_items(site='thecleancoffee')`와 `imweb_orders`를 주문 단위로 맞춘다. 여기서 `order_no` 또는 `order_code`가 연결 키다.
3. `imweb_order_items.pay_amt`가 주문 총액과 맞으면 상품별 금액으로 사용한다.
4. 상품 라인 금액이 없거나 주문 총액과 맞지 않으면 주문 총액을 상품 라인 비율로 나누고 `amount_allocation_method=allocated`라고 표시한다.
5. 상품 라인이 없으면 그 주문은 `unknown_product_included`로 묶는다. 총매출에는 포함하지만 TOP 상품에는 끼워 넣지 않는다.

우선 source:

- primary 후보: VM Cloud `imweb_order_items` + `imweb_orders`.
- cross-check: 운영DB `tb_sales_toss store='coffee'`의 상품명 힌트.
- fallback: Imweb v2 주문 상세 API 또는 더클린커피 엑셀 주문 파일 dry-run.

현재 이미 보이는 힌트:

- 주간 자사몰 cross-check TOP 1: 더클린 진짜 방탄커피 곰팡이독소 ZERO 유기농 스페셜티 6,474,632원.
- 월간 자사몰 cross-check TOP 1: 더클린 진짜 방탄커피 곰팡이독소 ZERO 유기농 스페셜티 18,137,834원.

남은 검증:

- VM Cloud `imweb_order_items`가 2026-05-21까지 fresh인지 확인한다.
- NPay actual 주문 72건 / 3,693,400원이 상품 라인과 몇 건 연결되는지 확인한다.
- Toss 계열 주문과 NPay 주문이 상품별 집계에서 중복되지 않는지 확인한다.

### 스마트스토어

무엇을 하는가: 스마트스토어 총매출 옆에 PlayAuto 상품명 기준 TOP 상품을 붙인다.

왜 하는가: 스마트스토어는 이미 운영DB `tb_playauto_orders shop_name='스마트스토어'`에서 더클린커피 상품명이 확인됐다. 채널 총매출 옆에 상품을 붙이면 “스마트스토어 매출이 어떤 상품에서 나왔는지” 바로 보인다.

어떻게 하는가:

1. 운영DB `public.tb_playauto_orders`를 read-only로 조회한다.
2. `shop_name='스마트스토어'`만 사용한다.
3. 기간은 KST 기준 `pay_time`을 우선 쓰고, 비어 있으면 `ord_time`을 fallback으로 쓴다.
4. 상품명은 `shop_sale_name + shop_opt_name`을 정규화한다. 정규화는 같은 상품의 띄어쓰기·옵션 표기를 한 이름으로 묶는 작업이다.
5. 수량은 `sale_cnt`, 금액은 `pay_amt`를 쓴다.
6. 취소·환불 상태는 먼저 `ord_status` 값 목록을 뽑아 포함/제외 표를 만든 뒤 제외한다.

현재 dry-run 완료 값:

- 주간 스마트스토어 총매출: 2,563,520원.
- 주간 TOP 1: 더클린 진짜 방탄커피 840ml 10개 464,600원.
- 월초-기준일 스마트스토어 총매출: 6,731,430원.
- rolling 30d 스마트스토어 총매출: 9,110,570원.
- rolling 30d TOP 1: 초신선 콜롬비아 스페셜티 2,697,350원.

남은 검증:

- `ord_status` 취소·환불 제외 규칙은 v1 dry-run 기준으로 적용됐다. 정산 기준으로 확정하려면 추가 검증이 필요하다.
- 상품 옵션을 합칠지 분리할지 결정. Slack TOP3는 합치고, 상세 JSON에는 옵션까지 남기는 방향이 안전하다.

### 쿠팡

무엇을 하는가: 쿠팡 총매출 옆에 TeamKeto 주문서 API 기준 TOP 상품을 붙인다.

왜 하는가: TeamKeto 쿠팡 계정에는 더클린커피 상품과 팀키토 상품이 같이 있다. 총액 한 줄만 쓰면 팀키토 도시락 매출을 더클린커피 커피 매출처럼 오해할 수 있다.

어떻게 하는가:

1. 기존 `backend/scripts/reportcoffee-coupang-teamketo-ordersheets-aggregate.ts`를 사용한다.
2. 쿠팡 주문서 API에서 고객·주문 식별자는 출력하지 않고 상품명, 수량, 금액 합계만 남긴다.
3. 상품명에 커피, coffee, 디카페, decaf, 원두, 콜드브루, 드립, 블렌드가 있으면 `coffee_hint`로 분류한다.
4. 상품명에 키토, keto, mct, 저탄, 저당 등이 있으면 `teamketo_hint`로 분류한다.
5. Slack strict 매출에는 `coffee_hint`만 더클린커피 쿠팡 매출로 넣고, TeamKeto 계정 전체와 `teamketo_hint`는 참고값으로 분리한다.

현재 이미 보이는 값:

- 주간 쿠팡 coffee 상품: 1,044,900원.
- 주간 TeamKeto 계정 전체 참고: 1,968,100원.
- 주간 TOP coffee 후보: 파푸아뉴기니 디카페인 357,800원, 케냐 AA 335,100원, 콜롬비아 스페셜티 286,200원.
- rolling 30d 쿠팡 coffee 상품: 4,417,800원.
- rolling 30d TeamKeto 계정 전체 참고: 7,264,500원.

남은 검증:

- coffee/teamketo 분류 규칙에 빠지는 상품명 목록이 있는지 monthly 기준으로 점검한다.
- 반품·취소 상태를 쿠팡 주문 상태별로 어떻게 뺄지 확정한다.

## 통합 출력 스키마

Slack 보고서와 JSON 산출물은 같은 구조를 쓴다.

```json
{
  "window": {
    "timezone": "Asia/Seoul",
    "start_date": "2026-05-15",
    "end_date_inclusive": "2026-05-21"
  },
  "channel_products": [
    {
      "channel": "smartstore",
      "channel_total_krw": 2297220,
      "source": "운영DB public.tb_playauto_orders shop_name='스마트스토어'",
      "freshness": "max pay/order date 2026-05-20",
      "confidence": "medium_high",
      "product_rows": [
        {
          "rank": 1,
          "product_name_normalized": "더클린 진짜 방탄커피 840ml 10개",
          "quantity": null,
          "amount_krw": 464600,
          "order_or_item_count": null,
          "amount_allocation_method": "line_pay_amt",
          "warning": null
        }
      ]
    }
  ],
  "guardrails": {
    "raw_customer_identifier_output": 0,
    "raw_order_identifier_output": 0,
    "db_write": 0,
    "slack_send": 0,
    "platform_send_or_upload": 0
  }
}
```

## 실행 순서

### Phase1-Sprint1

**이름**: 스마트스토어 TOP 상품 dry-run

- 무엇을 하는가: 운영DB `tb_playauto_orders`에서 스마트스토어 상품별 주간·월간 TOP 5를 만든다.
- 왜 하는가: 이미 금액과 상품명이 한 테이블에 있어 가장 빠르게 Slack 보고에 붙일 수 있다.
- 어떻게 하는가: `shop_name='스마트스토어'`, KST window, `shop_sale_name`, `shop_opt_name`, `sale_cnt`, `pay_amt`, `ord_status`만 읽는다.
- 산출물: `report/reportcoffee-smartstore-product-sales-20260522.json`, `report/reportcoffee-smartstore-product-sales-20260522.md`.
- 검증: JSON parse, raw PII scan, 금액 합계가 스마트스토어 총매출을 초과하지 않는지 확인.
- 의존성: 운영DB read-only 접근.
- 승인 필요 여부: NO, Green.
- 추천 점수/자신감: 90%.

### Phase1-Sprint2

**이름**: 쿠팡 TOP 상품 Slack preview 연결

- 무엇을 하는가: 이미 생성된 TeamKeto ordersheets TOP 상품을 Slack no-send preview에 붙인다.
- 왜 하는가: 쿠팡은 TeamKeto 계정 전체와 더클린커피 coffee 상품을 나눠 보여줘야 오해가 없다.
- 어떻게 하는가: `top_products` 중 coffee 상품만 strict TOP으로 표시하고, teamketo 상품은 참고로 분리한다.
- 산출물: `report/reportcoffee-slack-preview-20260522.md` 업데이트 또는 다음 날짜 preview.
- 검증: raw order/customer 출력 0, Slack send 0, API write 0.
- 의존성: 없음. 기존 weekly/rolling 30d JSON 있음.
- 승인 필요 여부: NO, Green.
- 추천 점수/자신감: 93%.

### Phase1-Sprint3

**이름**: 자사몰 상품 라인 freshness probe

- 무엇을 하는가: VM Cloud `imweb_order_items`가 2026-05-21까지 fresh한지 read-only로 확인한다.
- 왜 하는가: 자사몰은 결제수단과 상품 라인이 분리되어 있어, freshness가 낮으면 TOP 상품이 오래된 상품으로 보일 수 있다.
- 어떻게 하는가: `imweb_orders(site='thecleancoffee')`와 `imweb_order_items(site='thecleancoffee')`를 주문번호로 맞춰 최근 7일 연결률을 본다.
- 산출물: `report/reportcoffee-selfmall-product-line-readiness-20260522.json`, `report/reportcoffee-selfmall-product-line-readiness-20260522.md`.
- 검증: 주문 raw 값 출력 0, 연결률, 금액 차이, unknown product 비중.
- 의존성: VM Cloud SQLite read-only 접근.
- 승인 필요 여부: NO, Green.
- 추천 점수/자신감: 84%.

### Phase1-Sprint4

**이름**: 자사몰 상품별 매출 배분 dry-run

- 무엇을 하는가: NPay actual과 Toss 계열 자사몰 총매출을 상품 라인에 안전하게 나눈다.
- 왜 하는가: 자사몰 총매출만으로는 어떤 상품이 매출 변동을 만들었는지 알 수 없다.
- 어떻게 하는가: 주문별 결제완료 금액과 상품 라인 금액을 비교하고, 일치하면 line pay amount, 불일치하면 allocation warning을 붙인다.
- 산출물: `report/reportcoffee-selfmall-product-sales-allocation-20260522.json`, `report/reportcoffee-selfmall-product-sales-allocation-20260522.md`.
- 검증: 상품별 합계가 자사몰 총매출을 초과하지 않음, unknown product 비중 표시, raw PII 출력 0.
- 의존성: Phase1-Sprint3 PASS.
- 승인 필요 여부: NO, Green.
- 추천 점수/자신감: 78%.

## 금지선

- Slack 실제 발송 0건.
- 운영DB write 0건.
- VM Cloud write/deploy/restart 0건.
- Google Ads/GA4/Meta/TikTok/Naver 전송 0건.
- GTM publish 0건.
- raw 이메일, 전화번호, 주문번호, 결제키, 회원코드, 클릭 ID 출력 0건.

## Track 진척률

이번 문서는 report project 기준이다.

| Track | 이름 | 이전 | 현재 | 증감 |
|---|---|---:|---:|---:|
| A | 정본 문서/source rule 정렬 | 60% | 62% | +2% |
| B | 더클린커피 매출 source 확인 | 89% | 93% | +4% |
| C | 더클린커피 광고비 source 확인 | 63% | 63% | +0% |
| D | 바이오컴 리포트 source map | 22% | 23% | +1% |
| E | Slack no-send 메시지 설계 | 90% | 91% | +1% |
| F | 자동화/배포 readiness | 74% | 76% | +2% |

## 다음 할일

### Codex가 할 일

1. 스마트스토어 TOP 상품 dry-run을 만든다.
   무엇을: 운영DB PlayAuto 스마트스토어 상품별 매출 TOP 5를 주간·월간으로 산출한다.
   왜: 가장 안전하고 빠르게 채널별 총매출 옆 제품명을 붙일 수 있기 때문이다.
   어떻게: read-only SELECT로 상품명, 옵션명, 수량, 금액, 상태만 aggregate한다.
   의존성: 운영DB read-only 접근.
   성공 기준: TOP 상품 합계가 스마트스토어 총매출을 초과하지 않고 raw 식별자 출력이 0건이다.
   실패 시 확인점: `ord_status` 취소값 미분류, `pay_time` 비어 있음, 운영DB 권한 부족.
   승인 필요 여부: NO, Green.
   추천 점수/자신감: 90%.

2. 쿠팡 TOP 상품을 Slack no-send preview에 붙인다.
   무엇을: TeamKeto ordersheets의 `top_products` 중 coffee 상품을 쿠팡 제품별 매출로 표시한다.
   왜: 쿠팡 계정 전체에는 팀키토 상품도 들어 있어 더클린커피 커피 상품만 분리해야 하기 때문이다.
   어떻게: 기존 JSON의 `product_classification`과 `top_products`를 이용해 coffee/teamketo를 나눠 표시한다.
   의존성: 없음.
   성공 기준: 쿠팡 coffee 상품 TOP3와 TeamKeto 참고값이 분리된다.
   실패 시 확인점: 상품명 분류 규칙 누락.
   승인 필요 여부: NO, Green.
   추천 점수/자신감: 93%.

3. 자사몰 상품 라인 freshness를 확인한다.
   무엇을: VM Cloud `imweb_order_items`가 최근 자사몰 주문과 잘 연결되는지 확인한다.
   왜: 자사몰 제품별 매출은 상품 라인이 stale이면 잘못된 TOP 상품을 보여줄 수 있기 때문이다.
   어떻게: 최근 7일 `imweb_orders`와 `imweb_order_items` 연결률, 금액 차이, unknown product 비중을 본다.
   의존성: VM Cloud SQLite read-only 접근.
   성공 기준: 연결률과 freshness가 숫자로 나오고, 자사몰 TOP 상품 표시 가능 여부가 PASS/HOLD로 정리된다.
   실패 시 확인점: sync 지연, site 값 누락, order_no 연결 불일치.
   승인 필요 여부: NO, Green.
   추천 점수/자신감: 84%.

### TJ님이 할 일

1. 당장 할 일 없음.
   이유: 이번 제품별 매출 설계와 다음 dry-run은 Codex가 read-only로 진행할 수 있다.
   TJ님 확인이 필요한 시점: Slack 실제 발송 채널과 발송 주기를 정할 때다.
   추천 점수/자신감: 95%.
