# reportcoffee coupang settlement refresh path 20260524

작성 시각: 2026-05-24 13:55 KST
문서 성격: 더클린커피 쿠팡 2026-05 정산표 최신화 경로 조사
담당: Codex
상위 문서: [[reportcoffee]], [[!report]]
관련 문서: [[reportcoffee-sales-summary-no-send-20260524]], [[reportcoffee-coupang-source-readiness-20260522]]
JSON 산출물: `report/reportcoffee-coupang-settlement-refresh-path-20260524.json`

```yaml
harness_preflight:
  lane: Green
  allowed_actions:
    - read_only_local_sqlite_query
    - read_only_coupang_api_probe
    - official_api_document_review
    - local_json_markdown_output
  forbidden_actions:
    - operating_db_write
    - local_db_write
    - vm_cloud_write_or_deploy
    - slack_send
    - platform_send_or_upload
    - raw_identifier_output
  source_window_freshness_confidence:
    source: Coupang official Open API docs + Coupang Wing API read-only aggregate + local SQLite cache freshness
    window: settlement 2026-05, revenue-history 2026-05-01 - 2026-05-23, weekly 2026-05-17 - 2026-05-23
    freshness: 2026-05-24 13:55 KST read-only probe
    confidence: high for API existence and access, medium_high for reporting source choice
```

## 사람 말 결론

쿠팡 API는 있다. 지금 막힌 것은 “쿠팡에 API가 없어서”가 아니라, 우리 로컬 정산 cache가 2026-04-19까지만 적재돼 있어서 2026-05 리포트 JSON이 오래된 정산표만 보고 있었던 것이다.

더클린커피 2026-05 리포트에는 두 API를 나눠 쓰는 것이 맞다.

1. `revenue-history`는 매출인식일 기준 상세 매출 API다. 쉽게 말해 “이번 기간에 쿠팡이 매출로 인정한 상품별 금액”을 보는 통로다. 주간·월간 Slack 매출 보고에 가장 맞다.
2. `settlement-histories`는 지급내역 API다. 쉽게 말해 “언제 얼마가 정산 입금될 예정인지 또는 확정됐는지”를 보는 통로다. 월간 정산 대조와 입금 기준 확인에 맞다.

## 공식 API 확인

공식 쿠팡 정산 API workflow는 정산 API에 `매출내역 조회`와 `지급내역 조회` 2개가 있다고 설명한다.

- 지급내역 조회: `GET /v2/providers/marketplace_openapi/apis/api/v1/settlement-histories`
  - 필수값: `revenueRecognitionYearMonth=YYYY-MM`
  - 핵심 필드: `totalSale`, `finalAmount`, `settlementDate`, `revenueRecognitionDateFrom`, `revenueRecognitionDateTo`, `status`
  - 공식 문서: https://developers.coupangcorp.com/hc/ko/articles/360034152213-%EC%A7%80%EA%B8%89%EB%82%B4%EC%97%AD%EC%A1%B0%ED%9A%8C

- 매출내역 조회: `GET /v2/providers/openapi/apis/api/v1/revenue-history`
  - 필수값: `vendorId`, `recognitionDateFrom`, `recognitionDateTo`, `token`
  - 기간 제한: 최대 31일
  - 핵심 필드: `saleType`, `recognitionDate`, `settlementDate`, `items.productName`, `items.saleAmount`, `items.settlementAmount`
  - 공식 문서: https://developers.coupangcorp.com/hc/ko/articles/360033922413-%EB%A7%A4%EC%B6%9C%EB%82%B4%EC%97%AD-%EC%A1%B0%ED%9A%8C

## read-only 실측 결과

### 1. settlement-histories 2026-05

TeamKeto 계정은 2026-05 지급내역이 이미 나온다.

- rows: 4
- totalSale: 7,222,000원
- finalAmount: 2,289,310원
- settlementType: WEEKLY 3건, RESERVE 1건
- status: PENDING 4건
- 매출인식 범위: 2026-05-01 - 2026-05-17
- 정산 예정일 범위: 2026-05-26 - 2026-07-01

이 값은 “입금/지급 기준 정산표”라서 주간 매출 리포트의 총매출과 바로 같은 숫자로 쓰면 안 된다. 대신 월간 정산 대조에는 필요하다.

### 2. revenue-history 2026-05-01 - 2026-05-23

TeamKeto 매출내역 API는 2026-05-23까지 읽힌다.

- 전체 saleAmount: 5,389,600원
- 전체 settlementAmount: 4,761,209원
- coffee_hint saleAmount: 3,391,900원
- coffee_hint settlementAmount: 2,996,443원
- teamketo_hint saleAmount: 1,997,700원
- teamketo_hint settlementAmount: 1,764,766원

`saleAmount`는 상품 판매 매출에 가깝고, `settlementAmount`는 수수료 반영 후 정산대상액에 가깝다. Slack 매출 보고의 “쿠팡 매출”은 우선 `coffee_hint saleAmount`를 쓰고, 정산 대조 카드에는 `coffee_hint settlementAmount`를 같이 보여주는 구성이 가장 이해하기 쉽다.

### 3. revenue-history 주간 2026-05-17 - 2026-05-23

- 전체 saleAmount: 1,781,600원
- 전체 settlementAmount: 1,573,871원
- coffee_hint saleAmount: 858,400원
- coffee_hint settlementAmount: 758,317원
- teamketo_hint saleAmount: 923,200원
- teamketo_hint settlementAmount: 815,554원

참고: 직전 ordersheets 기준 주간 coffee 금액은 1,015,000원이었다. 두 값이 다른 이유는 source 기준이 다르기 때문이다. ordersheets는 주문 발생 기준이고, revenue-history는 매출인식일 기준이다. Slack의 “매출” 기준을 매출인식일로 바꾸면 주간 쿠팡 coffee 금액은 858,400원이 된다.

## 기존 로컬 cache가 오래된 이유

기존 로컬 SQLite `coupang_settlements_api`는 최신 `recognition_date_to`가 2026-04-19이고, `synced_at`은 2026-04-24 09:35:35다.

즉, 2026-05 데이터가 없는 것은 쿠팡 API 부재가 아니라, 기존 백필 스크립트가 2026-05를 아직 로컬 cache에 쓰지 않았기 때문이다.

관련 파일:

- `backend/src/coupangClient.ts`: `getSettlementHistories(account, yearMonth)` 구현됨.
- `backend/scripts/coupang-backfill-settlements.cjs`: `settlement-histories`를 로컬 SQLite `coupang_settlements_api`에 쓰는 기존 백필 스크립트.

## 추천 경로

### 경로 A. 지금 바로 리포트 정확도 개선

무엇을 하는가: Slack no-send 집계기에서 쿠팡 매출을 ordersheets 기준과 revenue-history 기준으로 나란히 보여준다.

왜 하는가: ordersheets는 빠르지만 주문 발생 기준이고, revenue-history는 쿠팡이 매출로 인정한 기준이라 월간 리포트에 더 맞다.

어떻게 하는가:

- 주간/월간 쿠팡 매출: `revenue-history coffee_hint saleAmount`
- 정산 참고: `revenue-history coffee_hint settlementAmount`
- 주문 발생 참고: 기존 ordersheets coffee 금액
- 최종 입금 대조: `settlement-histories finalAmount`, 단 상품별 coffee 분리가 안 되므로 계정 전체 reference로 표시

승인 필요 여부: NO for no-send/read-only.

추천 점수/자신감: 94%.

### 경로 B. 로컬 cache 최신화

무엇을 하는가: 기존 `coupang-backfill-settlements.cjs`로 2026-05 `settlement-histories`를 로컬 SQLite에 적재한다.

왜 하는가: 대시보드와 보고 스크립트가 API를 매번 직접 때리지 않고 빠르게 읽을 수 있다.

주의: 이것은 로컬 DB write다. 운영DB write는 아니지만, AGENTS 규칙상 로컬 DB write는 백업, dry-run, apply, 검증 순서가 필요하다.

승인 필요 여부: YES for apply. 백업과 dry-run 문서 작성은 NO.

추천 점수/자신감: 80%.

### 경로 C. revenue-history helper 구현

무엇을 하는가: `backend/src/coupangClient.ts`에 `getRevenueHistory(account, from, to)` helper를 추가한다.

왜 하는가: 현재 `coupangRequest`는 빈 query 값을 필터링하는데, 쿠팡 revenue-history 첫 페이지는 `token=` 파라미터가 필요하다. 이번 실측에서는 token 공백 workaround로 조회했지만, 정식 helper에서는 빈 token을 보존해야 한다.

승인 필요 여부: NO for local code/test/no-send.

추천 점수/자신감: 92%.

## 결론

쿠팡 API는 있으며, 더클린커피 2026-05 쿠팡 리포트에는 `revenue-history`를 새 primary 후보로 올리는 것이 맞다. `settlement-histories`는 최종 입금·정산표 대조에 쓰고, 기존 ordersheets는 주문 발생 기준 빠른 참고값으로 유지한다.

## Guardrails

- Slack send: 0
- 운영DB write: 0
- 로컬 DB write: 0
- VM Cloud write/deploy/restart: 0
- platform send/upload: 0
- raw customer/order/payment/member/click identifier output: 0

## Track 진척률

이번 문서는 report project 기준이다.

| Track | 이름 | 이전 | 현재 | 증감 |
|---|---|---:|---:|---:|
| A | 정본 문서/source rule 정렬 | 72% | 73% | +1% |
| B | 더클린커피 매출 source 확인 | 99% | 100% | +1% |
| C | 더클린커피 광고비 source 확인 | 82% | 82% | +0% |
| D | 바이오컴 리포트 source map | 35% | 36% | +1% |
| E | Slack no-send 메시지 설계 | 98% | 98% | +0% |
| F | 자동화/배포 readiness | 94% | 95% | +1% |
