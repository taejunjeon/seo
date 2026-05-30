# reportcoffee coupang RG fresh aggregate cache result 20260525

작성 시각: 2026-05-25 21:38 KST
기준일: 2026-05-25
문서 성격: 더클린커피 쿠팡 로켓그로스 API fresh aggregate 재현 및 로컬 적재 결과
담당: Codex

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - harness/coffee-data/README.md
    - harness/coffee-data/RULES.md
    - data/!datacheckplan.md
  lane: Yellow
  approval_basis: "TJ님 직접 지시: 쿠팡 로켓그로스 API fresh aggregate를 다시 재현해서 로컬 적재 해놔."
  allowed_actions:
    - Coupang RG Orders API read-only replay
    - local DB backup
    - local SQLite aggregate-only cache table create/upsert
    - local JSON/Markdown report output
  forbidden_actions:
    - Slack send
    - operating_db_write
    - VM Cloud write/restart/deploy
    - ad account mutation
    - platform conversion send/upload
    - raw customer/order/payment/click identifier output
    - raw order JSON storage in new aggregate table
  source_window_freshness_confidence:
    source: "Coupang RG Orders API read-only + local SQLite aggregate table"
    window: "2026-04-25 - 2026-05-01 KST"
    freshness: "API replay and local insert at 2026-05-25 21:37 KST"
    confidence: "high for aggregate replay and local aggregate insert; medium_high for using it as attachment reconstruction evidence"
```

## 10초 요약

쿠팡 로켓그로스 907,000원을 API로 다시 재현했고, 로컬DB에 aggregate만 적재했다. aggregate는 고객/주문 식별자를 저장하지 않는 날짜별 합계표다.

이제 `일반배송 1,132,700원 + 로켓그로스 907,000원 = 2,039,700원`까지는 로컬에서 재계산 가능한 상태다. 첨부 파일의 쿠팡 2,100,400원까지는 아직 60,700원 / 2건이 남는다.

## 무엇을 했는가

더클린커피 쿠팡 로켓그로스 매출 후보 907,000원을 다시 조회했다. 로켓그로스는 쿠팡 물류 주문이고, 일반배송 주문서와 다른 API로 확인해야 한다.

기존 raw 백필 스크립트는 주문 ID와 원문 JSON을 저장하는 구조였다. 이번에는 자동 보고에 필요한 숫자만 필요하므로 새 aggregate 전용 스크립트를 만들었다.

새 스크립트:

```text
backend/scripts/reportcoffee-coupang-rg-fresh-aggregate-cache.ts
```

새 로컬 table:

```text
coupang_rg_daily_aggregate_api
```

이 테이블은 아래 단위로만 저장한다.

- 계정
- 날짜
- 상품 분류
- 주문 건수
- 상품 row 수
- 수량
- 금액
- 조회 window
- 조회 시각

주문 ID, 고객 정보, 원문 주문 JSON은 저장하지 않았다.

## 왜 했는가

이전 확인에서 VM Cloud와 로컬DB의 로켓그로스 저장본은 2026-04-23에서 멈춰 있었다. 그래서 첨부 파일 기간인 2026-04-25 - 2026-05-01을 DB 저장본으로 검산할 수 없었다.

이번 작업의 목적은 907,000원이 우연한 한 번의 API 결과인지, 다시 재현되는 값인지 확인하는 것이다. 그리고 재현된 값을 Slack no-send 보고서가 읽을 수 있는 로컬 aggregate cache로 남기는 것이다.

## 실행 결과

dry-run 결과:

- API 호출: 1회
- API 주문: 26건
- 상품 row: 26건
- 수량: 32개
- coffee 금액: 907,000원
- 로컬DB write: 0건
- raw 식별자 출력: 0건

apply 결과:

- 로컬DB 백업 생성: `backend/data/crm.sqlite3.bak_20260525T213426_coupang_rg_aggregate`
- 로컬 table 생성/갱신: `coupang_rg_daily_aggregate_api`
- 적재 row: 21건
- 구조: 7일 x 3개 상품 분류
- coffee 금액: 907,000원
- coffee 주문 건수: 26건
- coffee 수량: 32개

## 일별 coffee aggregate

| 날짜 | 주문 건수 | 수량 | 금액 |
|---|---:|---:|---:|
| 2026-04-25 | 3건 | 3개 | 82,600원 |
| 2026-04-26 | 5건 | 7개 | 212,200원 |
| 2026-04-27 | 4건 | 6개 | 107,900원 |
| 2026-04-28 | 3건 | 3개 | 99,700원 |
| 2026-04-29 | 5건 | 5개 | 146,400원 |
| 2026-04-30 | 5건 | 7개 | 226,300원 |
| 2026-05-01 | 1건 | 1개 | 31,900원 |

합계: 26건 / 32개 / 907,000원.

## 검증

로컬DB post-verify:

- target window row: 21건
- gross amount: 907,000원
- coffee row: 7건
- coffee order count: 26건
- coffee item count: 26건
- coffee quantity: 32개
- coffee amount: 907,000원
- duplicate row: 0건
- SQLite integrity check: ok
- 새 aggregate table의 raw 식별자 컬럼: 0개

## 2,100,400원 역추적 영향

현재 더클린커피 쿠팡 첨부값은 아래까지 좁혀졌다.

| 구성 | 금액 |
|---|---:|
| 일반배송 coffee 확인값 | 1,132,700원 |
| 로켓그로스 fresh aggregate | 907,000원 |
| 합계 | 2,039,700원 |
| 첨부 쿠팡 값 | 2,100,400원 |
| 남은 차이 | 60,700원 |

판정: 로켓그로스 907,000원은 이제 로컬 aggregate로 재현/저장됐다. 남은 문제는 60,700원 / 2건이다.

## Track 진척률

- Track A: 81% -> 81% (+0%)
- Track B: 100% -> 100% (+0%)
- Track C: 100% -> 100% (+0%)
- Track D: 66% -> 68% (+2%)
- Track E: 100% -> 100% (+0%)
- Track F: 100% -> 100% (+0%)

## Guardrail

- Slack send: 0
- 운영DB write: 0
- VM Cloud write/restart/deploy: 0
- 광고 계정 변경: 0
- 플랫폼 전환 send/upload: 0
- raw 고객/주문/결제/click 식별자 출력: 0
- 새 aggregate table raw 주문 JSON 저장: 0

## 다음 할일

### Codex가 할 일

1. Slack no-send JSON의 쿠팡 breakdown에 로켓그로스 aggregate를 붙인다.
   - 무엇을: `coupang_rg_daily_aggregate_api`의 907,000원을 더클린커피 쿠팡 보조 source로 연결한다.
   - 왜: 일반배송과 로켓그로스를 분리해 보여야 2,100,400원 차이를 설명할 수 있다.
   - 어떻게: 기존 `reportcoffee-sales-summary-no-send`에 `coupang_rg_aggregate_reference` 필드를 추가한다.
   - 의존성: 없음.
   - 성공 기준: no-send JSON에 일반배송, 로켓그로스, 남은 gap이 분리된다.
   - 실패 시 다음 확인점: 날짜 기준 KST, product classifier, 기존 JSON 스키마 호환성.
   - 승인 필요 여부: 로컬 코드/JSON no-send는 없음. 실제 Slack 발송은 별도 승인.
   - 추천 점수/자신감: 92%.

2. 남은 60,700원 / 2건을 찾는 후보 source를 좁힌다.
   - 무엇을: 쿠팡 일반배송, 로켓그로스, 첨부 엑셀의 날짜 기준 차이를 다시 대조한다.
   - 왜: 2,100,400원을 최종 확정하려면 남은 2건의 출처를 알아야 한다.
   - 어떻게: 저장된 aggregate와 일반배송 주문서 aggregate를 같은 KST 기준으로 비교한다.
   - 의존성: 이번 로컬 aggregate 적재 완료.
   - 성공 기준: 60,700원이 날짜 밀림, 취소/환불, 수동 조정, 다른 export 중 어디인지 분류된다.
   - 실패 시 다음 확인점: 쿠팡 화면 export 또는 엑셀 작성 원본.
   - 승인 필요 여부: read-only/no-send는 없음.
   - 추천 점수/자신감: 84%.

### TJ님이 할 일

현재 필수 액션은 없다. 쿠팡 화면 export가 있으면 60,700원 / 2건을 더 빨리 닫을 수 있지만, Codex가 먼저 로컬 aggregate와 일반배송 기준 재대조를 진행할 수 있다.
