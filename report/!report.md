# 바이오컴·더클린커피 매출액/광고비 비중 리포트 계획

작성 시각: 2026-05-25 21:40 KST
기준일: 2026-05-25
문서 성격: Slack 주간/월간 매출·광고비 리포트 설계 정본 초안
담당: Codex
상세 문서: [[reportcoffee]], [[reportbiocom]], [[reportcoffee-sales-api-readiness-20260524]], [[reportcoffee-sales-summary-no-send-20260524]], [[reportcoffee-selfmall-smartstore-nosend-reconciliation-20260525]], [[reportcoffee-smartstore-playauto-warning-and-naver-commerce-api-review-20260526]], [[reportcoffee-smartstore-commerce-api-collector-dry-run-design-20260526]], [[reportcoffee-coupang-settlement-refresh-path-20260524]], [[reportcoffee-coupang-settlement-cache-202605-approval-20260525]], [[reportcoffee-coupang-settlement-cache-202605-result-20260525]], [[report-v0.1-readiness-and-next-impact-plan-20260523]], [[reportcoffee-v0.1-readiness-20260523]], [[report-ad-spend-source-gap-plan-20260523]], [[reportcoffee-google-ads-spend-mapping-20260523]], [[reportcoffee-google-click-id-campaign-id-linkage-20260523]], [[reportcoffee-google-click-campaign-bridge-preview-20260523]], [[reportcoffee-campaign-id-capture-hardening-design-20260524]], [[reportbiocom-source-map-20260523]], [[naver-brandsearch-manual-cost-source-policy-20260525]], [[naver-brandsearch-manual-cost-cache-write-approval-20260525]], [[reportcoffee-dry-run-20260521]], [[reportcoffee-selfmall-dedupe-rule-20260522]], [[reportcoffee-coupang-source-readiness-20260522]], [[reportcoffee-weekly-aggregate-scripts-20260522]], [[reportcoffee-okr-action-plan-20260522]], [[reportcoffee-slack-preview-20260522]], [[reportcoffee-naver-ads-campaign-allowlist-dry-run-20260522]], [[reportcoffee-product-sales-design-20260522]], [[reportcoffee-smartstore-product-sales-20260522]]
프론트엔드 HTML 보고서: `report/reportcoffee-project-executive-report-20260522.html`
더클린커피 매출 보고서 화면: `report/reportcoffee-sales-dashboard-20260525.html`

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - data/!data_inventory.md
    - data/dbstructure.md
    - data/!coffeedata.md
    - gdn/attribution-data-source-decision-guide-20260511.md
    - project/!traffic-attribution-current-state-guide-20260521.md
  lane: Green
  allowed_actions:
    - canonical_document_review
    - read_only_live_api_check
    - read_only_operational_db_aggregate
    - local_documentation
    - slack_message_design_no_send
  forbidden_actions:
    - slack_send
    - operating_db_write
    - vm_cloud_write_or_deploy
    - platform_send_or_upload
    - gtm_publish
    - raw_identifier_output
  source_window_freshness_confidence:
    source: VM Cloud public APIs + 운영DB aggregate SELECT + local SQLite inventory + TJ-confirmed Naver brandsearch manual contracts
    window: rolling last_7d, rolling last_30d, future weekly/monthly calendar windows, Naver manual contract periods from 2026-05-11 and 2026-05-22
    freshness: 2026-05-25 21:40 KST manual Naver source update
    confidence: medium_high for source map and Naver first contract cost, medium for final automated report until channel-specific aggregators are built
```

## 10초 요약

이 작업의 목표는 매주·매월 Slack으로 “매출이 얼마였고, 광고비를 얼마 썼고, 매출 대비 광고비가 몇 %인지”를 자동 보고하는 것이다.

시작은 더클린커피가 맞다. 더클린커피는 자사몰, 스마트스토어, 쿠팡이 분리돼 있고, 이미 `thecleancoffee` site source와 Meta 광고비 source가 일부 열려 있다. 다만 채널마다 정본이 다르므로 한 DB에서 다 끝내면 안 된다.

현재 결론은 “더클린커피는 no-send preview 기준 v0.1 준비, 바이오컴은 source map부터 시작”이다. Naver 브랜드검색 비용은 API가 아니라 TJ님이 확인한 수동 계약 금액을 임시 primary source로 쓴다. 더클린커피는 2026-05-11..2026-06-09 기준 모바일 880,000원 + PC 660,000원 = 1,540,000원이다. 바이오컴은 모바일 1,760,000원(2026-05-22..2026-07-20, 60일) + PC 660,000원(2026-05-22..2026-06-20, 30일)이다. API/Bizmoney 조회는 추후 재확인할 cross-check로 남긴다.

2026-05-24 기준 더클린커피 매출 source는 이미 보고서 숫자를 만들 수 있고, no-send 통합 집계기 [[reportcoffee-sales-summary-no-send-20260524]]에는 광고비 input과 쿠팡 정산 대조까지 붙었다. 주간 strict 매출은 15,177,390원, 포함 광고비는 2,099,737원, 매출 대비 광고비는 13.83%다. 쿠팡 API에는 `revenue-history`와 `settlement-histories`가 둘 다 있으며, 쿠팡 strict 매출은 ordersheets 주문 발생 기준이 아니라 revenue-history 매출인식 기준으로 전환했다. 상세는 [[reportcoffee-coupang-settlement-refresh-path-20260524]]에 분리했다. 매출 조회 API 준비도는 [[reportcoffee-sales-api-readiness-20260524]], 더클린커피 실제 발송 직전 준비도는 [[reportcoffee-v0.1-readiness-20260523]], 광고비 source gap은 [[report-ad-spend-source-gap-plan-20260523]], 바이오컴 확장 지도는 [[reportbiocom-source-map-20260523]]에 분리했다.

2026-05-25 기준 쿠팡 2026-05 정산표 로컬 cache 적재 승인안을 추가했다. 이것은 매출 총액 기준을 바꾸는 작업이 아니라, 정산 대조용 로컬 cache를 2026-05로 최신화하기 위한 Yellow Lane 승인안이다. 승인 전 local DB write는 0건이며, 상세는 [[reportcoffee-coupang-settlement-cache-202605-approval-20260525]]에 둔다.

2026-05-25 실행 결과: 승인 후 로컬 쿠팡 정산 cache에 2026-05 row 8건을 적재했다. TeamKeto 4건 / totalSale 7,222,000원 / finalAmount 2,289,310원, biocom 4건 / totalSale 1,019,400원 / finalAmount 256,524원이다. Slack no-send JSON도 재생성했고, 정산 대조 상태는 `comparison_available_with_warning`으로 바뀌었다. 상세는 [[reportcoffee-coupang-settlement-cache-202605-result-20260525]]에 둔다.

2026-05-25 프론트엔드: 더클린커피 매출 보고서 화면을 추가했다. 2026년 4월 전체와 5월 기간을 선택해 채널별 매출, 매출 추이, 광고비 분석, 광고비 비중, 스마트스토어/쿠팡 TOP 상품을 볼 수 있다. 화면 파일은 `report/reportcoffee-sales-dashboard-20260525.html`이다.

2026-05-25 자사몰 no-send 기준: `reportcoffee-sales-summary-no-send-20260501-imweb-complete-time.json`에서 자사몰 총액을 Imweb paid/order window + complete_time 존재 주문 기준으로 연결했다. 2026-04-25 - 2026-05-01 자사몰 금액은 5,334,362원으로 Excel과 일치한다. 스마트스토어는 운영DB PlayAuto 기준 1,839,340원 / 53 rows이고 Excel 1,905,140원 / 55건보다 65,800원 낮다. VM Cloud에는 스마트스토어 주문 원장이 없고, 운영DB `tb_naver_orders`/`tb_sales_naver_vat`는 바이오컴 상품·정산 쪽으로 확인되어 더클린커피 primary에서 제외한다. 상세는 [[reportcoffee-selfmall-smartstore-nosend-reconciliation-20260525]]에 둔다.

2026-05-26 스마트스토어 운영 기준: 스마트스토어는 PlayAuto 경고 포함으로 먼저 운영한다. `reportcoffee-sales-summary-no-send-20260524.json`과 `reportcoffee-sales-summary-no-send-20260501-imweb-complete-time.json`에 `source_status=operating_with_playauto_warning`, `source_basis=playauto_smartstore_pay_amt_v1`, Excel gap reference를 반영했다. 네이버 커머스API는 공식 주문 조회/정산 조회 경로가 있지만, 현재 MacBook 토큰 발급이 `GW.IP_NOT_ALLOWED`로 막혔고 더클린커피용 커머스API 앱 키와 스토어 scope가 확인되지 않아 primary 승격은 보류한다. 상세는 [[reportcoffee-smartstore-playauto-warning-and-naver-commerce-api-review-20260526]]에 둔다.

2026-05-26 VM 커머스API 테스트: VM Cloud `34.64.104.94`에서 기존 커머스API 후보 키는 토큰 발급 200과 주문 상세 집계까지 성공했지만, 반환 상품이 바이오컴 알러지 검사/구아검/뉴로마스터라 더클린커피 scope가 아니었다. `NAVER_COFFEE_*` 값은 광고 API 키 모양이라 커머스API 서명에 실패했다. 따라서 “VM IP 전체가 막힌 문제”가 아니라 “더클린커피 커머스API 앱 키/스토어 권한이 아직 없음”으로 분류한다. 상세는 [[reportcoffee-smartstore-commerce-api-collector-dry-run-design-20260526]]에 둔다.

## 보고서 정의

### 매출액

매출액은 광고 플랫폼이 주장하는 전환값이 아니라 내부 결제완료 원장 기준 금액이다.

- 자사몰 매출: Imweb paid/order window 안에서 complete_time이 존재하는 유상 비취소 주문 금액. Toss/NPay split은 결제수단 참고값
- 스마트스토어 매출: 운영DB `tb_playauto_orders shop_name='스마트스토어'`. `tb_naver_orders`는 더클린커피 상품명 conflict가 있어 primary로 쓰지 않음
- 쿠팡 매출: 운영DB `tb_sales_coupang`, `tb_coupang_orders_rg`, 쿠팡 API/정산 source
- GA4 purchase: 실제 매출 source가 아니라 guard 또는 참고값

### 광고비

광고비는 각 플랫폼에서 실제 지출된 spend다. 플랫폼 전환값은 참고만 하고 내부 매출에 더하지 않는다.

- Meta 광고비: Meta Ads Insights API, site별 account
- Naver 광고비: 일반 검색 광고는 Naver Search Ad API 또는 `naver_ads_daily` 캐시, 브랜드검색은 2026-05-25부터 수동 계약 비용 source를 primary로 둔다.
- Google 광고비: Google Ads API. 더클린커피는 2026-05-23 read-only 기준 0원 확인 후보이며, Google 클릭 ID 3건은 유입 warning으로 분리. campaign_id 연결 가능성은 [[reportcoffee-google-click-campaign-bridge-preview-20260523]] 기준 `gad_campaignid` 0건이라 미확정
- TikTok 광고비: TJ님 확인 기준 현재 광고 미운영 0원

### 매출액 대비 광고비 %

공식 계산식:

```text
광고비 비중 = 광고비 합계 / 내부 confirmed 매출 합계 * 100
```

보고서에는 두 값을 분리한다.

1. 전체 광고비 비중: 전체 광고비 ÷ 전체 내부 confirmed 매출
2. 플랫폼별 참고 ROAS: 플랫폼별 광고비 ÷ 해당 플랫폼 evidence 매출 또는 플랫폼 주장 매출

## 문서 구조

1. [[reportcoffee]]
   더클린커피 전용. 자사몰, 스마트스토어, 쿠팡 매출과 Meta/Naver/Google/TikTok 광고비 source를 먼저 닫는다.

2. [[reportbiocom]]
   바이오컴 전용. Google Ads, Meta, Naver, TikTok 광고비와 내부 confirmed 매출을 기존 ROAS 정합성 작업과 연결한다.

3. 이 문서
   공통 정의, Slack 메시지 형식, 실행 순서, 승인선만 관리한다.

## 현재 read-only 확인 결과

### 더클린커피

source: VM Cloud public API + 운영DB aggregate SELECT
window: 2026-04-22 - 2026-05-21, 2026-05-15 - 2026-05-21
freshness: 2026-05-22 00:25 KST
confidence: medium_high

- 자사몰 NPay actual 30d: 304건 / 15,538,800원. source는 VM Cloud `imweb_orders(site='thecleancoffee', pay_type='npay')`.
- 자사몰 Toss 계열 `store=coffee`: last_7d 9,611,622원, last_30d 31,444,064원.
- 자사몰 dedupe v0.2: 월간은 `Toss + NPay actual = 46,982,864원`을 included with warning으로 본다. 주간은 VM Cloud fresh DB read-only 기준 NPay actual 72건 / 3,693,400원이 확인되어 `Toss 9,611,622원 + NPay 3,693,400원 = 13,305,022원`까지 채울 수 있다.
- 스마트스토어 운영DB `tb_playauto_orders shop_name='스마트스토어'`: last_7d 2,297,220원, last_30d 8,844,270원. `tb_naver_orders`는 TOP 상품명이 바이오컴 제품이라 더클린커피 primary에서 제외한다.
- 스마트스토어 fresh dry-run: 2026-05-15 - 2026-05-21 KST 2,563,520원, 2026-05-01 - 2026-05-21 KST 6,731,430원, 2026-04-22 - 2026-05-21 KST 9,110,570원. TOP 상품까지 산출하고 Slack no-send preview에 반영 완료.
- 쿠팡: TeamKeto revenue-history API가 strict 매출 기준이다. 2026-05-17 - 2026-05-23 KST 기준 coffee_hint saleAmount는 858,400원 / settlementAmount는 758,317원이다. ordersheets 주문 발생 참고값은 같은 기간 coffee 1,015,000원, TeamKeto 계정 전체 1,798,700원이다. 즉 주문 발생 기준과 매출인식 기준이 다르므로 Slack에는 둘을 분리 표시해야 한다.
- Meta 광고비: `/api/ads/site-summary` force live read-only 기준 더클린커피 주간 spend 2,099,737원, 월초-기준일 spend 4,440,225원, rolling 30d spend 4,784,969원이 확인됐다. Meta 플랫폼 주장 구매값은 참고값이며 내부 매출에 더하지 않는다.
- Naver 광고비: 더클린커피 브랜드검색은 TJ님 수동 확인 기준 2026-05-11..2026-06-09 모바일 880,000원 + PC 660,000원 = 1,540,000원을 primary로 둔다. 현재 연결된 Naver Ads API 계정에서 더클린커피 후보 캠페인이 PAUSED/0원으로 보이는 것은 API 계정 범위 불일치 또는 브랜드검색 API source gap으로 표시한다.

### 바이오컴

source: 정본 문서 + VM Cloud public API
window: latest canonical state
freshness: 2026-05-21 문서 기준
confidence: medium

- 바이오컴은 Google Ads/Meta/Naver/TikTok ROAS 정합성 작업이 더 많이 진행돼 있다.
- 바이오컴 브랜드검색 비용은 TJ님 수동 확인 기준 모바일 1,760,000원(60일, 2026-05-22..2026-07-20) + PC 660,000원(30일, 2026-05-22..2026-06-20)을 primary로 둔다. 둘 다 계약 가능 검색수는 8,000 기준이다.
- 다만 이 창의 리포트 자동화는 더클린커피 source를 먼저 닫고, 같은 구조를 바이오컴에 복사하는 순서가 안전하다.

## Slack 메시지 초안

Slack 발송 전에는 아래를 no-send preview로 먼저 만든다.

```text
[매출·광고비 리포트] 더클린커피 주간 2026-05-18 - 2026-05-24

매출: __원
광고비: __원
매출 대비 광고비: __%

채널별 매출:
- 자사몰: __원 (NPay __ / 카드·계좌 __ / 정기결제 __)
- 스마트스토어: __원
- 쿠팡: __원

광고비:
- Meta: __원
- Naver: __원
- Google: __원
- TikTok: __원

주요 제품:
1. __
2. __
3. __

주요 유입:
- paid: __
- organic/search: __
- direct/referral: __

주의:
- 플랫폼 주장 매출은 내부 매출에 합산하지 않음
- source freshness: __
```

## 실행 순서

### Phase 1. 더클린커피 source 확정

무엇을 하는가: 자사몰, 스마트스토어, 쿠팡 매출 source를 주간/월간 window로 뽑을 수 있게 한다.

왜 하는가: 총매출 분모가 안정돼야 광고비 비중이 의미가 있다.

성공 기준:

- 자사몰 전체 결제완료 매출이 NPay, Toss, 정기결제, 기타 결제수단으로 분리된다.
- 스마트스토어 매출은 운영DB `tb_playauto_orders shop_name='스마트스토어'`를 primary 후보로 두고, `tb_naver_orders`는 바이오컴 상품명이 섞인 conflict source로 분리한다.
- 쿠팡은 TEAMKETO/coffee source가 현재 fresh한지 확인하고, 불충분하면 리포트에서 `source pending`으로 표시한다.

### Phase 1-1. 더클린커피 제품별 매출 연결

무엇을 하는가: 채널별 총매출 옆에 잘 팔린 상품 TOP3를 붙인다.

왜 하는가: 총매출이 늘거나 줄었을 때 어느 상품이 원인인지 바로 봐야 다음 광고비와 재고 판단이 가능하다.

어떻게 하는가:

- 스마트스토어는 운영DB PlayAuto 상품명 기준으로 집계한다. PlayAuto는 여러 판매 채널 주문을 한 테이블로 모아 둔 수집 원천이다.
- 쿠팡은 TeamKeto revenue-history API 기준으로 집계한다. revenue-history API는 쿠팡이 매출로 인식한 상품명, 수량, 매출금액, 정산대상액을 읽는 통로다. ordersheets API는 주문 발생 참고값으로 둔다.
- 자사몰은 VM Cloud Imweb order items 기준으로 집계한다. Imweb order items는 한 주문 안에 들어 있는 상품별 행이다.

성공 기준:

- 주간·월간 Slack no-send preview에 자사몰, 스마트스토어, 쿠팡 TOP 상품 3개가 붙는다.
- 상품별 금액 합계가 채널 총매출을 초과하지 않는다.
- 자사몰 상품 라인 freshness가 부족하면 TOP 상품을 확정값이 아니라 cross-check 또는 pending으로 표시한다.
- raw 주문번호, 결제키, 전화번호, 이메일, 회원코드, 클릭 ID 출력 0건을 유지한다.

상세 설계: [[reportcoffee-product-sales-design-20260522]]
스마트스토어 dry-run: [[reportcoffee-smartstore-product-sales-20260522]]

### Phase 2. 더클린커피 광고비 source 확정

무엇을 하는가: Meta부터 광고비를 붙이고, Naver/Google/TikTok은 source가 열리는 순서대로 붙인다.

왜 하는가: 광고비는 플랫폼별 spend가 정본이고, 플랫폼 전환값은 내부 매출과 섞으면 안 된다.

성공 기준:

- Meta spend는 live API로 주간/월간 조회 가능하다.
- Naver spend는 API/IP 등록 또는 `naver_ads_daily(site='thecleancoffee')` 캐시 생성 전까지 HOLD로 표시된다.
- Google spend는 더클린커피 비용 row가 없으면 0원 후보로 표시하고, landing click evidence는 유입 warning으로 분리한다.
- TikTok spend는 현재 광고 미운영 기준 0원으로 표시한다.

### Phase 3. Slack no-send preview

무엇을 하는가: Slack으로 보낼 텍스트를 파일/JSON으로 미리 생성한다.

왜 하는가: Slack send는 외부 발송이므로 문구, 숫자, source warning을 먼저 검증해야 한다.

성공 기준:

- raw email/phone/order/payment/click id가 0건이다.
- 주간/월간 메시지가 30초 안에 읽힌다.
- 매출, 광고비, 광고비 비중, source warning이 모두 보인다.

### Phase 4. Slack 발송 승인안

무엇을 하는가: Slack webhook 또는 Slack connector 발송 승인안을 만든다.

왜 하는가: 자동 발송은 외부 채널로 메시지를 보내는 작업이므로 승인 게이트가 필요하다.

성공 기준:

- 발송 채널, 발송 주기, 실패 시 재시도 여부, 비밀값 관리 방식이 정리된다.
- 승인 전 실제 Slack 전송은 0건이다.

## Track 진척률

이번 창 전용 report project 기준이다.

| Track | 이름 | 이전 | 현재 | 증감 |
|---|---|---:|---:|---:|
| A | 정본 문서/source rule 정렬 | 73% | 74% | +1% |
| B | 더클린커피 매출 source 확인 | 100% | 100% | +0% |
| C | 더클린커피 광고비 source 확인 | 82% | 82% | +0% |
| D | 바이오컴 리포트 source map | 36% | 36% | +0% |
| E | Slack no-send 메시지 설계 | 98% | 99% | +1% |
| F | 자동화/배포 readiness | 95% | 96% | +1% |

## 하지 않은 것

- Slack 발송 0건.
- 운영DB write 0건.
- VM Cloud write/deploy/restart 0건.
- Google Ads/GA4/Meta/TikTok/Naver 전송 0건.
- GTM publish 0건.
- raw 이메일/전화/주문/결제/회원/클릭 식별자 출력 0건.

## 다음 할일

### Codex가 할 일

1. 더클린커피 주간/월간 매출 집계 dry-run을 만든다.
   Lane: Green.
   의존성: 없음.
   방법: 운영DB aggregate SELECT와 VM Cloud public API를 조합하되, 자사몰 총매출의 빠진 결제수단을 `source pending`으로 표시한다.
   성공 기준: `report/reportcoffee.md`에 weekly/monthly source별 숫자와 gap이 들어간다.
   추천 점수/자신감: 92%.
   진행 상태: 2026-05-22 01:55 KST 기준 [[reportcoffee-dry-run-20260521]], [[reportcoffee-selfmall-dedupe-rule-20260522]], [[reportcoffee-weekly-aggregate-scripts-20260522]], [[reportcoffee-okr-action-plan-20260522]], [[reportcoffee-slack-preview-20260522]] 작성 완료.

2. 더클린커피 Slack no-send preview 파일을 만든다.
   Lane: Green.
   의존성: 없음. VM Cloud fresh DB에서 NPay 주간 actual 72건 / 3,693,400원 확인 완료.
   방법: 실제 Slack send 없이 Markdown/JSON으로 메시지 본문을 만든다. 자사몰, 스마트스토어, 쿠팡, Meta 광고비를 같은 KST window로 맞춘다.
   성공 기준: raw 식별자 0, 매출/광고비/비중/source warning 포함.
   추천 점수/자신감: 93%.
   진행 상태: 2026-05-22 01:55 KST에 [[reportcoffee-slack-preview-20260522]] 작성 완료.

3. Naver Ads fresh source blocker를 줄인다.
   Lane: Green 조사, 실제 API/IP 등록은 TJ님 또는 승인 필요.
   의존성: Naver IP 등록 가능 시점.
   방법: 현재 캐시/운영DB로 가능한 부분과 API가 필요한 부분을 분리한다.
   성공 기준: `HOLD`가 아니라 `source pending: 이유/필요 액션/대체값`으로 표시된다.
   추천 점수/자신감: 82%.

4. 더클린커피 제품별 매출을 Slack preview에 붙인다.
   Lane: Green.
   의존성: 스마트스토어 dry-run은 완료. 쿠팡은 기존 JSON 있음. 자사몰은 VM Cloud `imweb_order_items` freshness 확인 후.
   방법: 스마트스토어는 PlayAuto 상품명, 쿠팡은 TeamKeto revenue-history TOP 상품, 자사몰은 Imweb order items를 사용한다.
   성공 기준: 채널별 총매출 옆 TOP 상품 3개가 보이고, 상품별 합계가 채널 총매출을 초과하지 않는다.
   참고 문서: [[reportcoffee-product-sales-design-20260522]], [[reportcoffee-smartstore-product-sales-20260522]]
   추천 점수/자신감: 92%.

### TJ님이 할 일

1. Slack 실제 발송 채널을 정한다.
   Lane: Yellow.
   의존성: no-send preview 확인 후.
   방법: 받을 Slack 채널명 또는 webhook/connector 사용 방식을 지정한다.
   Claude Code가 대신 못 하는 이유: 어떤 채널에 운영 보고를 받을지는 TJ님 계정/팀 운영 결정이다.
   성공 기준: 발송 대상 채널이 하나로 확정된다.
   추천 점수/자신감: 70%.

2. Naver Ads API IP 등록은 내일 가능하면 VM Cloud IP 기준으로 진행한다.
   Lane: Yellow.
   의존성: 네이버 API 관리 화면 접근.
   방법: 운영 리포트는 서버가 자동 조회해야 하므로 PC IP보다 VM Cloud IP가 장기적으로 맞다. PC 테스트가 꼭 필요하면 단기 테스트 후 VM Cloud로 바꾸는 임시 운영이지만, 1개만 등록 가능하면 VM Cloud 우선이 낫다.
   성공 기준: `naver_ads_daily(site='thecleancoffee')`를 만들 수 있거나, API read-only probe가 HTTP 200을 받는다.
   실패 시 해석: IP/권한/가맹점 scope 문제로 보고, 스마트스토어 매출은 운영DB만 쓰고 광고비는 HOLD로 둔다.
   추천 점수/자신감: 82%.
