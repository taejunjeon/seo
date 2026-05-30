# 더클린커피 스마트스토어 PlayAuto 운영 기준과 네이버 커머스API 검토

작성 시각: 2026-05-26 00:23 KST  
기준일: 2026-05-26  
문서 성격: 더클린커피 스마트스토어 매출 source 운영 기준 / API readiness 보고  
담당: Codex  
관련 문서: [[reportcoffee-selfmall-smartstore-nosend-reconciliation-20260525]], [[reportcoffee-sales-summary-no-send-20260524]], [[reportcoffee]]

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
  project_harness_read:
    - harness/coffee-data/README.md
    - report/!report.md
    - report/reportcoffee-selfmall-smartstore-nosend-reconciliation-20260525.md
  lane: Green
  allowed_actions:
    - read_only_operational_db_review
    - read_only_external_api_probe
    - local_json_markdown_update
    - no_send_json_regeneration
  forbidden_actions:
    - slack_send
    - operating_db_write
    - vm_cloud_write_or_deploy
    - platform_send_or_upload
    - gtm_publish
    - raw_identifier_output
  source_window_freshness_confidence:
    source: operational DB PlayAuto aggregate, local no-send JSON, official Naver Commerce API docs, local Commerce API token probe
    window: 2026-04-25 - 2026-05-01, 2026-05-18 - 2026-05-24
    freshness: 2026-05-26 00:23 KST
    confidence: medium_high for PlayAuto operating source with warning, medium for Naver Commerce API readiness
```

## 10초 요약

스마트스토어 매출은 지금부터 PlayAuto 기준으로 먼저 운영한다. PlayAuto는 여러 판매 채널 주문을 모아 둔 운영DB 수집 원천이고, 더클린커피 상품명이 확인되는 현재 best available source다.

다만 Excel과 65,800원 / 2건 차이가 있으므로 Slack no-send에는 반드시 경고를 붙인다. 숫자를 Excel에 맞추려고 임의 보정하지 않는다.

네이버 커머스API는 공식적으로 주문 조회와 정산 조회 경로가 있다. 하지만 현재 우리 repo와 VM Cloud에는 더클린커피용 커머스API 앱 키가 확인되지 않았다. VM Cloud에서 기존 후보 키는 토큰 발급에 성공했지만 바이오컴 상품만 반환했고, MacBook에서 직접 호출한 토큰 발급은 IP 허용 문제로 막혔다. 따라서 아직 더클린커피 primary source로 승격할 수 없다.

## 이번에 바꾼 운영 기준

스마트스토어는 `included_with_warning`으로 운영한다. 뜻은 “보고서에 포함하되, 숫자 출처와 차이를 같이 보여준다”이다.

- 운영 source: 운영DB `public.tb_playauto_orders`
- 필터: `shop_name='스마트스토어'`
- 금액 기준: `pay_amt`
- 날짜 기준: `COALESCE(pay_time, ord_time)`
- 상품 기준: `shop_sale_name`, `shop_opt_name`
- 새 source basis: `playauto_smartstore_pay_amt_v1`
- 새 source status: `operating_with_playauto_warning`

Slack no-send JSON에 들어간 경고는 아래 4개다.

1. 스마트스토어는 PlayAuto 기준으로 먼저 운영하되, 정산/Excel 기준과 완전 일치 전까지 source warning을 유지한다.
2. 2026-04-25 - 2026-05-01 대조에서 Excel보다 PlayAuto가 65,800원 / 2 rows 낮다.
3. 네이버 커머스API 직접 조회는 더클린커피 권한/IP/스토어 scope가 검증되기 전까지 primary로 쓰지 않는다.
4. 운영DB `tb_naver_orders`/`tb_sales_naver_vat`는 더클린커피 상품 기준 primary로 쓰지 않는다.

## 실제 숫자

### 2026-04-25 - 2026-05-01 Excel 대조

- Excel 스마트스토어: 1,905,140원 / 55건
- PlayAuto 스마트스토어: 1,839,340원 / 53 rows / 64개
- 차이: -65,800원 / -2 rows
- 차이율: -3.45%

해석: 자동 보고 후보로는 쓸 수 있다. 하지만 F&B팀 기준의 추가 2건, 정산 조정, 날짜 기준 차이 중 무엇인지 닫히기 전까지 “정확히 Excel과 같다”고 말하면 안 된다.

### 2026-05-18 - 2026-05-24 no-send 재생성

- 스마트스토어: 1,526,300원 / 42 rows
- 상태: `included_with_warning`
- source status: `operating_with_playauto_warning`
- 경고 수: 4개

이 값은 `report/reportcoffee-sales-summary-no-send-20260524.json`에 반영했다.

## 네이버 스마트스토어 API 검토

공식 문서상 API는 있다. 커머스API는 스마트스토어 기능을 HTTP API로 호출하는 공식 통로이고, 사용하려면 커머스API센터 가입과 애플리케이션 등록 권한이 필요하다.

주문 매출 집계에 직접적으로 필요한 경로는 두 단계다.

1. 변경 상품 주문 내역 조회  
   무엇을 하는가: 기간 안에 바뀐 상품 주문 번호 목록을 가져온다.  
   공식 경로: `GET /v1/pay-order/seller/product-orders/last-changed-statuses`  
   주의: 한 번에 최대 300개까지 조회하고, 더 있으면 이어서 페이지를 넘겨야 한다.

2. 상품 주문 상세 내역 조회  
   무엇을 하는가: 상품 주문 번호를 넣어서 주문 상세 금액, 결제일, 상품 정보를 가져온다.  
   공식 경로: `POST /v1/pay-order/seller/product-orders/query`  
   주의: 요청 가능한 상품 주문 번호는 최대 300개다.

정산 관점에서는 건별 정산 내역 조회도 있다.

- 공식 경로: `GET /v1/pay-settle/settle/case`
- 용도: 주문 발생 금액이 아니라 정산 기준 금액을 확인할 때 쓴다.

공식 근거:

- [네이버 커머스API 소개](https://apicenter.commerce.naver.com/docs/introduction)
- [네이버 커머스API 인증](https://apicenter.commerce.naver.com/docs/auth)
- [변경 상품 주문 내역 조회](https://apicenter.commerce.naver.com/docs/commerce-api/2.74.0/seller-get-last-changed-status-pay-order-seller)
- [상품 주문 상세 내역 조회](https://apicenter.commerce.naver.com/docs/commerce-api/2.75.0/seller-get-product-orders-pay-order-seller)
- [건별 정산 내역 조회](https://apicenter.commerce.naver.com/docs/commerce-api/current/find-settle-by-case-pay-settle)

## 현재 우리 환경에서 바로 못 쓰는 이유

현재 repo에는 네이버 커머스API를 호출하는 기존 스크립트가 있다.

- 파일: `backend/scripts/reconcile-coffee-ga4-naverpay.py`
- 사용하는 credential 이름: `BIOCOM_STORE_APP_ID`, `BIOCOM_STORE_APP_SECRET`

하지만 더클린커피 스마트스토어 매출 primary로 쓰기에는 아직 부족하다.

- 더클린커피용 커머스API 앱 ID/시크릿 이름은 발견되지 않았다.
- `NAVER_COFFEE_*` 키는 광고 API 계정 키로 보이며, 스마트스토어 주문 조회용 커머스API 키로 확인되지 않았다.
- MacBook에서 토큰 발급을 시도했으나 `GW.IP_NOT_ALLOWED`로 막혔다.
- 즉 “API가 없는 것”이 아니라 “현재 호출 IP와 더클린커피 스토어 권한이 아직 준비됐다고 말할 수 없는 것”이다.

## VM Cloud 추가 테스트 결과

2026-05-26 00:50 KST에 VM Cloud `34.64.104.94`에서 no-raw API probe를 실행했다.

- 기존 커머스API 후보 키: 토큰 발급 200
- 변경 row: 52
- 상세 row: 52
- gross amount: 5,540,740원
- 상태: 구매결정 49, 취소 3
- 반환 상품 scope: 바이오컴 알러지 검사, 구아검, 뉴로마스터
- 판정: `BIOCOM_NOT_THECLEANCOFFEE`

`NAVER_COFFEE_*` 값은 커머스API 서명 단계에서 `Invalid salt`가 발생했다. 이 값은 스마트스토어 주문 API 키가 아니라 네이버 광고 API 키 성격으로 봐야 한다.

따라서 남은 문제는 “VM IP가 전부 막혔다”가 아니다. 더클린커피 스마트스토어용 커머스API 앱 키와 스토어 권한이 아직 없다는 문제다.

상세 설계와 테스트 결과는 [[reportcoffee-smartstore-commerce-api-collector-dry-run-design-20260526]]에 둔다.

## 판정

현재 판정은 `api_possible_but_not_ready_for_thecleancoffee_primary`다.

사람 말로 풀면 이렇다.

네이버 스마트스토어 API로 주문을 직접 가져오는 길은 있다. 하지만 지금 당장 더클린커피 Slack 매출 보고서의 정본으로 쓰기에는 키, IP 허용, 스토어 권한이 아직 닫히지 않았다. 그래서 오늘부터는 PlayAuto 기준으로 운영하고, 경고를 숨기지 않는 방식이 맞다.

## Track 진척률

- Track A Source Rule: 85% -> 88% (+3%)
- Track B Coffee Sales Source: 100% -> 100% (+0%)
- Track C Coffee Ad Spend Source: 100% -> 100% (+0%)
- Track D Biocom Report Source Map: 74% -> 74% (+0%)
- Track E Slack no-send / Schedule: 100% -> 100% (+0%)
- Track F Automation Guard: 100% -> 100% (+0%)

## 하지 않은 것

- Slack 실제 발송 0건
- 운영DB write 0건
- VM Cloud write/deploy/restart 0건
- 광고 플랫폼 send/upload 0건
- GTM publish 0건
- raw 주문/결제/고객/클릭 식별자 출력 0건
- secret/token 출력 0건

## 다음 할 일

### Auto Green

1. Slack no-send preview에서 스마트스토어 경고 문구를 계속 유지한다.
   - 무엇: PlayAuto 기준값 옆에 source warning을 표시한다.
   - 왜: 운영은 시작하되, Excel 차이를 숨기지 않기 위해서다.
   - 어떻게: `reportcoffee-sales-summary-no-send.ts`가 내보내는 `warnings`와 `source_status`를 메시지 렌더러가 그대로 읽게 한다.
   - 성공 기준: 주간/월간 Slack no-send JSON에 스마트스토어 금액과 경고가 같이 보인다.
   - 담당: Codex
   - 추천 점수/자신감: 92%

2. 네이버 커머스API collector dry-run 설계를 준비한다.
   - 무엇: 토큰 발급, 변경 주문 조회, 상세 주문 조회, 정산 조회를 no-raw aggregate로 묶는 collector 초안을 만든다.
   - 왜: PlayAuto 경고를 없애려면 더클린커피 직접 주문 원장을 cross-check해야 한다.
   - 어떻게: 커머스API 키와 호출 IP가 확인되면 raw 주문번호 없이 count/amount/status/product bucket만 저장하는 preview를 만든다.
   - 성공 기준: 같은 기간 PlayAuto, Excel, Naver Commerce API 세 값이 비교된다.
   - 담당: Codex
   - 추천 점수/자신감: 84%

### Approval Needed

1. 더클린커피 커머스API 앱 권한과 호출 IP를 확인한다.
   - 무엇: 더클린커피 스마트스토어용 커머스API 애플리케이션 ID/시크릿과 API 호출 허용 IP를 확인한다.
   - 왜: 현재 MacBook 호출은 IP 허용 문제로 막혔고, repo에는 더클린커피 주문 API 키가 확인되지 않았기 때문이다.
   - 어떻게: 네이버 커머스API센터에서 더클린커피 스토어 앱의 호출 IP를 MacBook 또는 VM Cloud 중 운영할 위치로 등록한다.
   - 성공 기준: OAuth token 발급이 200으로 통과하고, 주문 변경 목록 조회가 raw 노출 없이 집계된다.
   - 담당: TJ님
   - Codex가 대신 못 하는 이유: 네이버 커머스API센터 권한 화면과 키 발급/등록은 계정 소유자 권한이 필요하다.
   - 추천 점수/자신감: 78%

### Blocked/Parked

1. 스마트스토어 경고 제거
   - 현재는 보류한다.
   - 이유: Excel 대비 65,800원 / 2건 차이가 닫히지 않았고, 네이버 직접 API도 아직 검증되지 않았다.
   - 재개 조건: F&B 기준 또는 커머스API 원장으로 추가 2건의 성격이 확인된다.
