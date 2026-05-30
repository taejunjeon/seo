# 더클린커피 쿠팡 판매 분석 API 가능성 점검

작성 시각: 2026-05-28 13:03 KST
기준일: 2026-05-28
문서 성격: 더클린커피 쿠팡 판매 분석 화면값과 API 재현 가능성 조사
상위 문서: [[!report]], [[reportcoffee]]

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
    - report/!report.md
    - report/reportcoffee.md
  lane: Green
  allowed_actions:
    - local_excel_read
    - coupang_open_api_read_only
    - official_docs_review
    - local_documentation
  forbidden_actions:
    - coupang_account_write
    - operating_db_write
    - local_db_apply
    - slack_send
    - platform_send_or_upload
    - deploy
    - publish
    - raw_identifier_output
  source_window_freshness_confidence:
    source: F&B attached Coupang Seller Insights Excel + Coupang Open API read-only + official Coupang developer docs
    window: 2026-04-25 - 2026-05-01 KST
    freshness: checked 2026-05-28 13:03 KST
    confidence: medium_high
```

## 10초 요약

쿠팡 API 정보는 이미 가지고 있다. 현재 저장소에는 TeamKeto 쿠팡 Open API(쿠팡이 공식 제공하는 판매자용 조회 API)로 주문서, 매출인식 내역, 정산 내역, 로켓그로스 주문을 읽는 코드가 있다.

하지만 F&B팀이 준 화면은 방문자, 조회, 장바구니, 구매전환율까지 들어 있는 쿠팡 판매 분석 화면이다. 공식 Open API 문서에서 이 화면의 `SELLER_INSIGHTS_DAILY_SUMMARY_METRICS`를 직접 내려주는 API는 찾지 못했다. 따라서 정확히 같은 화면값을 자동 보고에 쓰려면 Hermes가 쿠팡 판매자 화면에서 엑셀을 받는 방식이 현재 가장 현실적이다.

첨부 엑셀도 원래 말한 2,100,400원 / 56건과 다르다. 첨부 파일 합계는 2,453,600원 / 주문 60건 / 판매량 71개다. 차이 353,200원은 같은 기간 주문서 API의 팀키토 상품 버킷과 정확히 같다.

## 확인한 값

### F&B팀 기준값

- 화면/보고서 기준: 2,100,400원 / 주문 56건 / 판매량 66개
- 관측 필터: 판매자배송 + 로켓그로스, 커피/차, 2026-04-25 - 2026-05-01
- confidence: medium-high. 캡처 기반이고, 같은 화면의 다운로드 파일은 합계가 다르다.

### 첨부 엑셀

파일: `/Users/vibetj/Downloads/SELLER_INSIGHTS_DAILY_SUMMARY_METRICS_(0).xlsx`

| 날짜 | 주문 | 판매량 | 매출 |
|---|---:|---:|---:|
| 2026-04-25 | 7 | 7 | 224,000원 |
| 2026-04-26 | 8 | 10 | 360,300원 |
| 2026-04-27 | 7 | 13 | 366,200원 |
| 2026-04-28 | 6 | 6 | 200,400원 |
| 2026-04-29 | 13 | 13 | 445,100원 |
| 2026-04-30 | 8 | 10 | 336,000원 |
| 2026-05-01 | 11 | 12 | 521,600원 |
| 합계 | 60 | 71 | 2,453,600원 |

결론: 첨부 엑셀은 “쿠팡 판매 분석” 계열 파일이지만, 원래 확인 대상인 2,100,400원 / 56건 파일과 같은 필터 상태는 아니다.

## API로 재현한 값

### 1. 판매자배송 주문서

주문서 API(ordersheets: 쿠팡 판매자배송 주문을 주문 발생 기준으로 읽는 API)는 같은 기간 read-only로 정상 호출됐다.

- 전체: 1,485,900원 / 주문서 32건 / 수량 37개
- 커피 상품 분류: 1,132,700원 / item 28개 / 수량 32개
- 팀키토 상품 분류: 353,200원 / item 4개 / 수량 5개
- API error: 0
- raw 주문/고객 식별자 출력: 0

### 2. 로켓그로스 주문

로켓그로스 주문 API(Rocket Growth Order API: 쿠팡 물류창고 판매 주문을 읽는 API)도 같은 기간 read-only로 정상 호출됐다.

- 커피 상품: 907,000원 / 주문 26건 / 수량 32개
- API call: 1
- local DB write: 0
- raw 주문/고객 식별자 출력: 0

### 3. 매출인식 내역

매출인식 내역 API(revenue-history: 쿠팡이 매출로 인식한 날짜 기준 내역)는 호출 가능하지만, 판매 분석 화면값과 기준이 다르다.

- 전체 saleAmount: 1,390,500원
- 커피 saleAmount: 1,117,300원
- 커피 settlementAmount: 987,041원
- refund rows: 0

이 값은 매출로 인정된 날짜 기준이다. F&B팀 화면은 “판매 분석” 화면이라 주문/판매량/방문자 흐름을 보여주는 지표와 섞여 있어, 매출인식 내역과 같은 숫자가 되지 않는다.

## 차이 원인표

| 비교 | 금액 | 해석 |
|---|---:|---|
| F&B 기준값 | 2,100,400원 | 원래 확인 대상. 판매 분석 화면 캡처와 기존 주간 보고서 값 |
| 첨부 엑셀 합계 | 2,453,600원 | F&B 기준값보다 353,200원 높음 |
| 주문서 커피 + 로켓그로스 | 2,039,700원 | 기존 Codex 재현값. F&B 기준값보다 60,700원 낮음 |
| 주문서 전체 + 로켓그로스 | 2,392,900원 | 첨부 엑셀보다 60,700원 낮음 |
| 주문서 팀키토 상품 버킷 | 353,200원 | 첨부 엑셀 - F&B 기준값과 정확히 같음 |

가장 그럴듯한 해석은 이렇다.

1. 첨부 엑셀은 원래 기준값보다 팀키토 상품 353,200원을 더 포함한 상태다.
2. 팀키토 상품 353,200원을 빼면 원래 F&B 기준 2,100,400원으로 돌아간다.
3. 그래도 공개 API 조합과는 60,700원 / 2건 차이가 남는다.
4. 이 60,700원은 단순히 팀키토 상품 포함 여부가 아니라, 판매 분석 화면의 날짜/주문 집계 기준 또는 내부 지표 기준 차이로 보인다.

## API 가능성 판단

### 공식 Open API

현재 가능한 것:

- 판매자배송 주문 조회: 가능.
- 로켓그로스 주문 조회: 가능.
- 매출인식 내역 조회: 가능.
- 정산 내역 조회: 구현되어 있음.

현재 공식 문서에서 못 찾은 것:

- 방문자, 조회, 장바구니, 구매전환율, 판매량, 매출을 한 번에 주는 판매 분석 화면용 API.
- `SELLER_INSIGHTS_DAILY_SUMMARY_METRICS` 파일과 동일한 공개 endpoint.

따라서 Slack 자동 보고의 쿠팡 매출 기준은 두 갈래로 둬야 한다.

1. **운영 보고 기준**: F&B가 쓰는 쿠팡 판매 분석 엑셀을 Hermes로 자동 다운로드한다.
2. **검증/대체 기준**: 쿠팡 Open API 주문서 + 로켓그로스 주문 + 매출인식 내역을 계속 대조한다.

## 공식 문서 근거

- [Coupang Sales Detail Query](https://developers.coupangcorp.com/hc/en-us/articles/360033922413-Sales-Detail-Query): 매출인식일 기준 `revenue-history`를 제공한다.
- [Coupang 발주서 목록 조회](https://developers.coupangcorp.com/hc/ko/articles/360033919573-%EB%B0%9C%EC%A3%BC%EC%84%9C-%EB%AA%A9%EB%A1%9D-%EC%A1%B0%ED%9A%8C-%EC%9D%BC%EB%8B%A8%EC%9C%84-%ED%8E%98%EC%9D%B4%EC%A7%95): 주문서 API와 주문 상태를 제공한다.
- [Coupang RG Order API](https://developers.coupangcorp.com/hc/en-us/articles/41131195825433-RG-Order-API-List-Query): 로켓그로스 주문 조회를 제공한다.

## Track 진척률

| Track | 이전 | 현재 | 증감 |
|---|---:|---:|---:|
| A source rule alignment | 76% | 77% | +1% |
| B coffee sales source | 100% | 100% | +0% |
| C coffee ad spend source | 90% | 90% | +0% |
| D biocom report source map | 36% | 36% | +0% |
| E Slack no-send design | 100% | 100% | +0% |
| F automation/deploy readiness | 99% | 99% | +0% |

## 다음 할일

### Auto Green

1. Hermes로 쿠팡 판매 분석 “기간별 엑셀 다운로드”를 같은 필터로 다시 받는다.
   - 무엇을 하는가: 2026-04-25 - 2026-05-01, 판매자배송 + 로켓그로스, 커피/차 필터를 고정해 엑셀을 다시 받는다.
   - 왜 하는가: 지금 첨부 엑셀은 2,453,600원이라 기존 2,100,400원과 필터가 다르다.
   - 어떻게 하는가: Hermes CDP 브라우저에서 쿠팡 판매 분석 화면을 열고 필터와 파일명을 result JSON에 남긴다.
   - 성공 기준: 다운로드 파일 합계가 2,100,400원 / 주문 56건 또는 2,453,600원 / 주문 60건 중 어느 기준인지 재현된다.
   - 추천 점수/자신감: 94%.

2. 상품별 엑셀 다운로드도 같이 받는다.
   - 무엇을 하는가: 같은 기간 상품별 파일을 받아 팀키토 상품 353,200원과 60,700원 잔차를 분해한다.
   - 왜 하는가: 기간별 요약만으로는 60,700원이 어떤 옵션에서 생겼는지 알 수 없다.
   - 어떻게 하는가: 쿠팡 판매 분석 화면의 “상품별 엑셀 다운로드”를 no-send로 저장하고, 상품명 기준으로 커피/팀키토/기타를 분류한다.
   - 성공 기준: 잔차 60,700원 / 2건의 상품 또는 날짜 기준이 확인된다.
   - 추천 점수/자신감: 90%.

### Approval Needed

현재 없음. 브라우저 다운로드는 read-only이고, 쿠팡 계정 설정/주문/상품/광고를 바꾸지 않는다.

### Blocked/Parked

1. 공식 Seller Insights API 직접 연동.
   - 막힌 이유: 공식 Open API 문서에서 판매 분석 요약 파일을 직접 내려주는 endpoint를 찾지 못했다.
   - 우회안: Hermes 다운로드 자동화로 원본 엑셀을 Git에 남기고, Codex가 읽어 Slack no-send JSON에 붙인다.
