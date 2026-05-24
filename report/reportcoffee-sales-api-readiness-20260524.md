# reportcoffee sales API readiness 20260524

작성 시각: 2026-05-24 12:43 KST
기준일: 2026-05-24
문서 성격: 더클린커피 Slack 매출 보고용 조회 API 준비도 점검
담당: Codex
상위 문서: [[reportcoffee]], [[!report]]
관련 문서: [[reportcoffee-slack-preview-20260522]], [[reportcoffee-v0.1-readiness-20260523]], [[reportcoffee-weekly-aggregate-scripts-20260522]], [[reportcoffee-smartstore-product-sales-20260522]], [[reportcoffee-coupang-source-readiness-20260522]], [[reportcoffee-vm-cloud-npay-weekly-actual-20260522]]

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
    - docs/report/text-report-template.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - harness/coffee-data/README.md
    - harness/coffee-data/RULES.md
    - report/reportcoffee.md
    - report/reportcoffee-slack-preview-20260522.md
    - report/reportcoffee-v0.1-readiness-20260523.md
  lane: Green
  allowed_actions:
    - read_only_live_api_smoke
    - local_markdown_output
    - source_readiness_assessment
    - no_send_no_write_documentation
  forbidden_actions:
    - slack_send
    - operating_db_write
    - vm_cloud_write_or_deploy
    - platform_send_or_upload
    - gtm_publish
    - raw_identifier_output
  source_window_freshness_confidence:
    source: VM Cloud read-only APIs + local backend route review + existing reportcoffee dry-run docs
    window: live smoke at 2026-05-24 12:41 - 12:43 KST, reference weekly 2026-05-15 - 2026-05-21 KST, reference rolling_30d 2026-04-22 - 2026-05-21 KST
    freshness: VM Cloud Imweb order max 2026-05-24T03:31:45.000Z, NPay actual max 2026-05-24T01:58:25.000Z, source-freshness API checked 2026-05-24T03:42:35Z
    confidence: medium_high for source availability, medium for direct Slack API readiness
```

## 10초 요약

더클린커피 Slack 보고용 매출 숫자는 이미 만들 수 있다. 하지만 Slack이 매일 또는 매주 한 번에 호출할 단일 API(서버가 숫자를 넘겨주는 조회 주소)는 아직 없다.

현재 준비도는 `source readiness 82% / API automation readiness 58%`로 본다. 쉽게 말하면, 숫자를 뽑을 원천은 대부분 확인됐지만, 그 숫자를 자동 보고용 한 묶음으로 안정적으로 넘기는 통로가 아직 덜 만들어졌다.

가장 먼저 할 일은 새 외부 전송이 아니라 `no-send aggregator`다. no-send aggregator는 Slack에 보내지 않고 자사몰, 스마트스토어, 쿠팡 숫자를 한 JSON으로 합치는 로컬 집계기다.

## 판정

판정: `PARTIAL_READY`

사람 말로 풀면, 지금은 “보고서에 들어갈 숫자 재료는 있다. 다만 매번 사람이 문서와 스크립트를 조합하지 않게 만들 API는 아직 필요하다”이다.

### 준비도 점수

| 영역 | 준비도 | 판정 | 이유 |
|---|---:|---|---|
| 매출 source 준비도 | 82% | 높음 | 자사몰 NPay, Toss, 스마트스토어 PlayAuto, 쿠팡 TeamKeto ordersheets가 각각 숫자를 낸다 |
| 단일 API 준비도 | 58% | 중간 | 채널별 source는 따로 열려 있지만 `/api/report/coffee/sales-summary` 같은 통합 조회 주소가 없다 |
| Slack no-send preview 준비도 | 96% | 높음 | 이미 주간/rolling 30d 문구와 숫자 preview가 있다 |
| Slack 실제 발송 준비도 | 35% | 낮음 | 실제 send는 승인 전 금지이고, 채널/주기/실패 처리도 별도 승인안이 필요하다 |
| raw 식별자 차단 준비도 | 90% | 높음 | 기존 script는 aggregate-only 중심이지만 일부 live API는 raw sample risk가 있어 wrapper가 필요하다 |

## Live API smoke 결과

이번 점검은 모두 read-only였다. Slack send, 운영DB write, VM Cloud write/deploy/restart는 하지 않았다.

### VM Cloud health

- endpoint: `GET /health`
- 결과: HTTP 200
- service: `biocom-seo-backend`
- checked_at: 2026-05-24 12:41 KST

의미: VM Cloud backend 자체는 살아 있다.

### 자사몰 NPay actual

- endpoint: `GET /api/attribution/site-landing/summary?site=thecleancoffee&windowHours=720`
- 결과: HTTP 200
- NPay actual 30d: 311건 / 15,955,200원
- gross before exclusion: 345건 / 18,247,200원
- cancel/return/exchange excluded: 34건 / 2,292,000원
- status blank warning: 1건 / 39,900원
- max_order_time: 2026-05-24T01:58:25.000Z
- max_synced_at: 2026-05-24 03:41:24
- guard: external_send_count 0, upload_candidate_count 0, operational_db_write 0

의미: NPay actual source는 fresh하다. 다만 이 API의 NPay actual은 현재 30일 기준으로 붙는다. 주간/월간 Slack 보고에 바로 쓰려면 window를 요청값으로 받는 별도 매출용 wrapper가 필요하다.

### 자사몰 Imweb order stats

- endpoint: `GET /api/crm-local/imweb/order-stats?site=thecleancoffee`
- 결과: HTTP 200
- totalOrders: 3,805건
- paymentAmountSum: 174,936,128원
- firstOrderAt: 2024-10-02T05:39:42.000Z
- lastOrderAt: 2026-05-24T03:31:45.000Z
- lastSyncedAt: 2026-05-24 03:41:39

의미: 더클린커피 Imweb 주문 원장은 VM Cloud에서 최신에 가깝다. 하지만 이 endpoint는 전체 주문 통계라 Slack 주간/월간 매출 API로 바로 쓰기엔 너무 넓다. 결제수단, 취소/반품 제외, 중복 제거가 빠져 있다.

### 자사몰 Toss daily summary

- endpoint: `GET /api/toss/daily-summary?store=coffee&startDate=2026-05-15&endDate=2026-05-21`
- 결과: HTTP 200
- pagesFetched: 2
- totalCount: 184건
- totalAmount: 10,919,811원
- totalFee: 319,240원
- totalPayout: 10,600,571원
- daily rows: 7일

의미: Toss API(토스 결제 금액을 읽는 공식 조회 통로)는 호출된다. 다만 이 값은 기존 Slack strict Toss 계열 9,611,622원과 다르다. 따라서 이 endpoint를 그대로 Slack 매출로 쓰면 안 되고, 취소/정산/Imweb 주문 중복 제거 rule을 맞춘 aggregate-only wrapper가 필요하다.

### 자사몰 Toss reconcile

- endpoint: `GET /api/crm-local/imweb/toss-reconcile?site=thecleancoffee&limit=1&lookbackDays=30`
- 결과: HTTP 200
- report keys: ageBuckets, coverageRate, imwebOrders, matchedOrders, missingInImweb, missingInToss, samples 등
- raw sample risk: 3개 sample field 존재

의미: Toss와 Imweb 주문을 맞춰 보는 진단 API로는 유용하다. 하지만 response에 sample이 있어 Slack 자동화가 직접 호출하면 raw 식별자 노출 위험이 있다. Slack용으로는 sample 없는 aggregate-only wrapper를 새로 둬야 한다.

### 스마트스토어

- 현재 public API: 없음
- 현재 source: 운영DB `public.tb_playauto_orders`, filter `shop_name='스마트스토어'`
- 현재 script: `backend/scripts/reportcoffee-smartstore-product-sales-dry-run.ts`
- 기존 dry-run 결과:
  - weekly 2026-05-15 - 2026-05-21: 2,563,520원
  - month-to-date 2026-05-01 - 2026-05-21: 6,731,430원
  - rolling 30d 2026-04-22 - 2026-05-21: 9,110,570원
  - TOP products 산출 가능

의미: 스마트스토어 숫자와 제품 TOP은 준비됐다. 하지만 Slack이 부를 수 있는 API는 아직 없다. 운영DB read-only query를 서버 route로 감싸거나, 매일 로컬/VM Cloud no-send JSON으로 뽑는 방식이 필요하다.

### 쿠팡

- live endpoint: `GET /api/coupang/dashboard`
- 결과: HTTP 200
- endpoint 성격: 월별/vendor별 정산 대시보드
- TeamKeto aggregate exists: true
- existing script: `backend/scripts/reportcoffee-coupang-teamketo-ordersheets-aggregate.ts`
- 기존 ordersheets dry-run 결과:
  - weekly TeamKeto 계정 전체: 1,968,100원
  - weekly coffee hint: 1,044,900원
  - rolling 30d TeamKeto 계정 전체: 7,264,500원
  - rolling 30d coffee hint: 4,417,800원

의미: 쿠팡은 TeamKeto ordersheets(쿠팡 판매자 주문서 API, 상품명·수량·금액을 읽는 공식 통로) script가 실제 보고에 더 가깝다. `/api/coupang/dashboard`는 바이오컴과 TeamKeto vendor 정산 중심이라 더클린커피 주간 매출 API로 바로 쓰기 어렵다.

### Source freshness

- endpoint: `GET /api/source-freshness`
- 결과: HTTP 200
- checkedAt: 2026-05-24T03:42:35.192Z
- result_count: 9
- fresh sources: toss_local_transactions, toss_local_settlements, imweb_local_orders, attribution_ledger, ga4_bigquery_thecleancoffee, toss_operational, playauto_operational, imweb_operational 등

의미: freshness guard로는 쓸 수 있다. 다만 이 endpoint는 매출액을 주지 않는다. Slack 보고 API에는 freshness label만 가져오는 보조 source로 두는 것이 맞다.

### 광고비 참고 API

- endpoint: `GET /api/ads/site-summary?date_preset=last_7d`
- endpoint: `GET /api/ads/site-summary?date_preset=last_30d`
- 이번 smoke 결과: HTTP 502

의미: 이번 문서의 주제는 매출 조회 API지만, Slack 보고에는 광고비도 들어간다. 2026-05-22 문서의 Meta spend 숫자는 이미 no-send preview에 있다. 다만 2026-05-24 현재 live site-summary가 502이므로, 실제 자동화 전에는 광고비 API 회복 또는 stale cache fallback 확인이 필요하다.

## 채널별 API 준비도

### 자사몰

준비도: 65%

무엇이 준비됐나:

- NPay actual은 VM Cloud summary에서 fresh하게 조회된다.
- Toss daily summary는 store=coffee로 조회된다.
- Imweb order stats는 fresh하다.

무엇이 부족한가:

- NPay weekly/monthly를 API parameter로 직접 조회하는 매출용 endpoint가 없다.
- Toss daily summary는 기존 strict 매출과 금액이 달라 바로 쓰면 안 된다.
- Toss reconcile API는 sample field가 있어 Slack 자동화가 직접 호출하면 안 된다.
- 자사몰 전체 매출은 NPay, Toss, 기타 결제수단을 주문 단위로 중복 제거해야 한다.

필요한 API:

```text
GET /api/report/coffee/selfmall-sales?start=YYYY-MM-DD&end=YYYY-MM-DD&mode=no_send
```

이 API가 반환해야 할 것:

- selfmall_total_amount_krw
- toss_amount_krw
- npay_actual_amount_krw
- other_payment_amount_krw
- excluded_cancel_return_amount_krw
- dedupe_rule_version
- freshness
- warnings
- raw_identifier_output: 0

### 스마트스토어

준비도: 70%

무엇이 준비됐나:

- 운영DB PlayAuto에서 weekly/month-to-date/rolling 30d 매출과 TOP 상품을 뽑는 script가 있다.
- `tb_naver_orders`는 더클린커피 primary에서 제외하는 판단도 정리됐다.

무엇이 부족한가:

- Slack 자동화가 호출할 API endpoint가 없다.
- 취소/반품/환불/교환 제외 rule은 dry-run 기준이다. 정산 기준 확정 전에는 included_with_warning으로 표시해야 한다.

필요한 API:

```text
GET /api/report/coffee/smartstore-sales?start=YYYY-MM-DD&end=YYYY-MM-DD&top=3&mode=no_send
```

이 API가 반환해야 할 것:

- included_amount_krw
- excluded_amount_krw
- top_products
- status_breakdown
- source: operational_postgres_tb_playauto_orders
- freshness
- warnings
- raw_identifier_output: 0

### 쿠팡

준비도: 68%

무엇이 준비됐나:

- TeamKeto ordersheets script가 쿠팡 API를 read-only로 호출해 상품별 합계를 만든다.
- coffee hint와 teamketo hint를 분리한다.
- 기존 weekly/rolling 30d dry-run 숫자가 있다.

무엇이 부족한가:

- public `/api/coupang/dashboard`는 더클린커피 주간 매출 API가 아니다.
- TeamKeto 계정에는 커피와 팀키토 상품이 섞이므로 classifier(상품명을 보고 커피인지 팀키토인지 나누는 규칙)가 필요하다.
- API rate limit을 줄이려면 cache 또는 daily snapshot이 필요하다.

필요한 API:

```text
GET /api/report/coffee/coupang-sales?start=YYYY-MM-DD&end=YYYY-MM-DD&top=3&mode=no_send
```

이 API가 반환해야 할 것:

- coffee_amount_krw
- teamketo_reference_amount_krw
- account_total_amount_krw
- top_products
- classifier_version
- api_calls
- api_error_count
- freshness
- raw_identifier_output: 0

## 통합 Slack 매출 API 설계

최종적으로 Slack 자동화는 채널별 API를 따로 여러 번 부르기보다 한 번만 호출하는 편이 안전하다.

추천 endpoint:

```text
GET /api/report/coffee/sales-summary?window=weekly&end_date=YYYY-MM-DD&top=3&mode=no_send
GET /api/report/coffee/sales-summary?window=rolling_30d&end_date=YYYY-MM-DD&top=3&mode=no_send
GET /api/report/coffee/sales-summary?window=month_to_date&end_date=YYYY-MM-DD&top=3&mode=no_send
```

예상 response:

```json
{
  "ok": true,
  "mode": "read_only_no_send",
  "site": "thecleancoffee",
  "window": {
    "timezone": "Asia/Seoul",
    "start_date": "YYYY-MM-DD",
    "end_date_inclusive": "YYYY-MM-DD"
  },
  "sales": {
    "total_strict_amount_krw": 0,
    "channels": {
      "selfmall": {
        "amount_krw": 0,
        "lines": {
          "toss": 0,
          "npay_actual": 0,
          "other_payment": 0
        },
        "status": "included_with_warning"
      },
      "smartstore": {
        "amount_krw": 0,
        "top_products": []
      },
      "coupang": {
        "coffee_amount_krw": 0,
        "account_total_reference_krw": 0,
        "top_products": []
      }
    }
  },
  "freshness": {},
  "warnings": [],
  "guardrails": {
    "slack_send": 0,
    "operating_db_write": 0,
    "vm_cloud_write_or_deploy": 0,
    "platform_send_or_upload": 0,
    "raw_identifier_output": 0
  }
}
```

핵심 원칙:

1. Slack 메시지에는 주문번호, 결제키, 고객 정보, 클릭 ID를 절대 넣지 않는다.
2. 숫자는 `strict included`, `included_with_warning`, `reference only`, `pending`을 분리한다.
3. NPay 클릭이나 결제 시작은 구매완료가 아니다.
4. Toss raw API 금액은 자사몰 strict 매출로 바로 쓰지 않는다.
5. TeamKeto 쿠팡 계정 전체 금액은 더클린커피 strict 매출에 바로 더하지 않는다.

## 바로 진행 가능한 순서

### Phase1-Sprint1

**이름**: no-send local aggregator

무엇을 하는가: 기존 NPay, Toss, SmartStore, Coupang source를 한 JSON으로 합치는 로컬 집계기를 만든다.

왜 하는가: VM Cloud에 새 API를 배포하기 전에 숫자 정의가 맞는지 검증해야 한다.

어떻게 하는가: `backend/scripts/reportcoffee-*.ts`를 재사용하거나 얇은 wrapper script를 만들어 `report/reportcoffee-sales-summary-no-send-YYYYMMDD.json`을 출력한다.

현재 진척률: 0%

100% 조건:

- weekly, rolling_30d, month_to_date 세 window가 한 JSON으로 나온다.
- 채널별 매출과 TOP 상품이 들어간다.
- raw 식별자 출력이 0이다.
- 기존 `reportcoffee-slack-preview-20260522` 숫자와 차이가 나면 차이 이유가 warnings에 들어간다.

승인 필요 여부: NO, Green.

### Phase1-Sprint2

**이름**: aggregate-only route design

무엇을 하는가: 로컬 aggregator 결과를 서버 API로 옮길 contract를 확정한다.

왜 하는가: Slack 자동화는 사람이 로컬 스크립트를 실행하는 방식이 아니라 서버 조회 주소를 안정적으로 호출해야 한다.

어떻게 하는가: route는 aggregate-only로 만들고, raw sample field가 있는 기존 API를 직접 노출하지 않는다.

현재 진척률: 0%

100% 조건:

- `/api/report/coffee/sales-summary` contract가 문서화된다.
- source별 freshness와 warning이 들어간다.
- no-send mode가 기본값이다.
- 실제 Slack send는 여전히 0이다.

승인 필요 여부: 로컬 코드 작성은 NO, VM Cloud 배포는 YES.

### Phase1-Sprint3

**이름**: Slack send approval packet

무엇을 하는가: 실제 Slack 발송을 위한 승인 문서를 만든다.

왜 하는가: Slack send는 외부 채널 전송이다. 채널, 주기, 실패 시 알림, 중지 방법이 정해져야 한다.

어떻게 하는가: 먼저 no-send preview를 KST 기준으로 매일 오전/주간/월간 세 종류 만들고, TJ님이 받을 채널과 시간을 정한다.

현재 진척률: 0%

100% 조건:

- Slack 채널이 정해진다.
- KST 발송 시간이 정해진다.
- dry-run과 실제 send가 분리된다.
- 실패 시 send 중단 조건이 있다.

승인 필요 여부: 승인 문서 작성은 NO, 실제 send는 YES.

## Track 진척률

이번 문서는 report project 기준이다.

| Track | 이름 | 이전 | 현재 | 증감 |
|---|---|---:|---:|---:|
| A | 정본 문서/source rule 정렬 | 69% | 70% | +1% |
| B | 더클린커피 매출 source 확인 | 96% | 97% | +1% |
| C | 더클린커피 광고비 source 확인 | 74% | 74% | +0% |
| D | 바이오컴 리포트 source map | 35% | 35% | +0% |
| E | Slack no-send 메시지 설계 | 96% | 96% | +0% |
| F | 자동화/배포 readiness | 86% | 88% | +2% |

## Guardrails

- Slack send: 0
- 운영DB write: 0
- VM Cloud write/deploy/restart: 0
- platform send/upload: 0
- GTM publish: 0
- raw customer/order/payment/member/click identifier output: 0

## Auditor verdict

판정: `PASS_WITH_NOTES`

근거:

- 매출 source는 충분히 열려 있다.
- live API smoke에서 VM Cloud health, NPay summary, Imweb order stats, Toss daily summary, Coupang dashboard가 200을 반환했다.
- 광고비 site-summary는 이번 smoke에서 502였다. 매출 API 준비도 문서의 hard fail은 아니지만, Slack 전체 리포트 자동화 전에는 별도 복구 확인이 필요하다.
- 가장 큰 남은 병목은 source가 아니라 통합 API 부재다.
