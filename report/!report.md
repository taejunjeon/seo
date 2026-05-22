# 바이오컴·더클린커피 매출액/광고비 비중 리포트 계획

작성 시각: 2026-05-22 14:08 KST
기준일: 2026-05-22
문서 성격: Slack 주간/월간 매출·광고비 리포트 설계 정본 초안
담당: Codex
상세 문서: [[reportcoffee]], [[reportbiocom]], [[reportcoffee-dry-run-20260521]], [[reportcoffee-selfmall-dedupe-rule-20260522]], [[reportcoffee-coupang-source-readiness-20260522]], [[reportcoffee-weekly-aggregate-scripts-20260522]], [[reportcoffee-okr-action-plan-20260522]], [[reportcoffee-slack-preview-20260522]], [[reportcoffee-naver-ads-campaign-allowlist-dry-run-20260522]], [[reportcoffee-product-sales-design-20260522]], [[reportcoffee-smartstore-product-sales-20260522]]
프론트엔드 HTML 보고서: `report/reportcoffee-project-executive-report-20260522.html`

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
    source: VM Cloud public APIs + 운영DB aggregate SELECT + local SQLite inventory
    window: rolling last_7d, rolling last_30d, future weekly/monthly calendar windows
    freshness: 2026-05-21 23:25 KST read-only probe
    confidence: medium_high for source map, medium for final automated report until channel-specific aggregators are built
```

## 10초 요약

이 작업의 목표는 매주·매월 Slack으로 “매출이 얼마였고, 광고비를 얼마 썼고, 매출 대비 광고비가 몇 %인지”를 자동 보고하는 것이다.

시작은 더클린커피가 맞다. 더클린커피는 자사몰, 스마트스토어, 쿠팡이 분리돼 있고, 이미 `thecleancoffee` site source와 Meta 광고비 source가 일부 열려 있다. 다만 채널마다 정본이 다르므로 한 DB에서 다 끝내면 안 된다.

현재 결론은 “바로 리포트 초안은 만들 수 있지만, 자동 Slack 발송 전에는 채널별 매출 데이터 출처(source: 숫자가 나온 원천)를 고정해야 한다”다. 더클린커피 Naver Ads는 API/IP 문제가 아니라 “더클린커피 캠페인 6개만 통과시키는 허용 목록 안전장치(allowlist guard)” 문제로 좁혀졌다. 후보 6개는 모두 PAUSED라 최근 30일 광고비 0원 후보로 볼 수 있다.

## 보고서 정의

### 매출액

매출액은 광고 플랫폼이 주장하는 전환값이 아니라 내부 결제완료 원장 기준 금액이다.

- 자사몰 매출: Imweb/PG/운영DB 또는 VM Cloud 주문 원장 기준 결제완료 금액
- 스마트스토어 매출: 운영DB `tb_playauto_orders shop_name='스마트스토어'`. `tb_naver_orders`는 더클린커피 상품명 conflict가 있어 primary로 쓰지 않음
- 쿠팡 매출: 운영DB `tb_sales_coupang`, `tb_coupang_orders_rg`, 쿠팡 API/정산 source
- GA4 purchase: 실제 매출 source가 아니라 guard 또는 참고값

### 광고비

광고비는 각 플랫폼에서 실제 지출된 spend다. 플랫폼 전환값은 참고만 하고 내부 매출에 더하지 않는다.

- Meta 광고비: Meta Ads Insights API, site별 account
- Naver 광고비: Naver Search Ad API 또는 `naver_ads_daily` 캐시
- Google 광고비: Google Ads API, campaign/site mapping 필요
- TikTok 광고비: TikTok Business API 또는 로컬 캐시, site mapping 필요

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
- 스마트스토어 fresh dry-run: 2026-05-15 - 2026-05-21 KST 2,563,520원, 2026-05-01 - 2026-05-21 KST 6,731,430원, 2026-04-22 - 2026-05-21 KST 9,110,570원. TOP 상품까지 산출 완료.
- 쿠팡: TeamKeto ordersheets API aggregate script가 생겼다. 2026-05-15 - 2026-05-21 KST 기준 41건 / 1,968,100원이며, coffee hint 1,044,900원과 teamketo hint 923,200원으로 분리된다. 2026-04-22 - 2026-05-21 rolling 30d 기준은 161건 / 7,264,500원, coffee hint 4,417,800원이다.
- Meta 광고비: `/api/ads/site-summary?date_preset=last_7d`에서 더클린커피 spend 1,952,104원, 내부 confirmed revenue 2,040,491원, 내부 ROAS 1.05가 확인됐다. Meta 플랫폼 주장 구매값 7,191,017원은 참고값이다.
- Naver 광고비: VM Cloud `/api/ads/naver/campaign-summary?site=thecleancoffee`는 `naver_ads_daily` 테이블 없음으로 500이다. 로컬 캐시는 `site=biocom` 위주이며 max date 2026-05-12다.

### 바이오컴

source: 정본 문서 + VM Cloud public API
window: latest canonical state
freshness: 2026-05-21 문서 기준
confidence: medium

- 바이오컴은 Google Ads/Meta/Naver/TikTok ROAS 정합성 작업이 더 많이 진행돼 있다.
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
- 쿠팡은 TeamKeto ordersheets API 기준으로 집계한다. ordersheets API는 쿠팡 판매자 주문서에서 상품명, 수량, 금액을 읽는 공식 통로다.
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
- Google/TikTok spend는 site/campaign mapping이 확인된 캠페인만 포함한다.

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
| A | 정본 문서/source rule 정렬 | 62% | 64% | +2% |
| B | 더클린커피 매출 source 확인 | 93% | 95% | +2% |
| C | 더클린커피 광고비 source 확인 | 63% | 63% | +0% |
| D | 바이오컴 리포트 source map | 23% | 23% | +0% |
| E | Slack no-send 메시지 설계 | 91% | 92% | +1% |
| F | 자동화/배포 readiness | 76% | 79% | +3% |

## 하지 않은 것

- Slack 발송 0건.
- 운영DB write 0건.
- VM Cloud write/deploy/restart 0건.
- Google Ads/GA4/Meta/TikTok/Naver 전송 0건.
- GTM publish 0건.
- raw email/phone/order/payment/member_code/click_id 출력 0건.

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
   방법: 스마트스토어는 PlayAuto 상품명, 쿠팡은 TeamKeto ordersheets TOP 상품, 자사몰은 Imweb order items를 사용한다.
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
