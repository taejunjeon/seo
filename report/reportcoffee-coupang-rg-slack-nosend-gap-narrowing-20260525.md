# 더클린커피 쿠팡 로켓그로스 Slack no-send 반영 및 60,700원 차이 축소

작성 시각: 2026-05-25 22:08 KST
기준일: 2026-05-25
문서 성격: 더클린커피 Slack no-send 매출 JSON 보강 결과와 쿠팡 60,700원 / 2건 차이 추적 보고
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
    - docurule.md
  lane: Green
  allowed_actions:
    - local code patch
    - local JSON/Markdown report output
    - Coupang API read-only aggregate
    - local SQLite read-only aggregate
    - no-send Slack preview JSON generation
  forbidden_actions:
    - Slack send
    - operating_db_write
    - VM Cloud write/restart/deploy
    - ad account mutation
    - platform conversion send/upload
    - raw customer/order/payment/click identifier output
  source_window_freshness_confidence:
    source: "Slack no-send JSON + local SQLite aggregate + Coupang read-only API"
    window: "2026-04-25 - 2026-05-01 KST"
    freshness: "2026-05-25 22:08 KST"
    confidence: "high for no-send JSON field attachment, medium_high for gap narrowing"
```

## 10초 요약

Slack에 보내기 전 미리보기 JSON에 쿠팡 로켓그로스 집계를 붙였다. 이제 쿠팡 매출은 일반배송 확인값, 로켓그로스 참고값, 첨부 보고서 재현 차이를 나눠 볼 수 있다.

남은 60,700원 / 2건은 아직 확정 source가 아니다. 추가로 좁혀 보니 로켓그로스 API가 조회 시작일과 종료일 경계에 민감하게 반응한다. 다만 경계일에서 추가로 잡히는 주문들만으로는 60,700원 / 2건 조합이 바로 나오지 않았다.

어려운 용어:

- `Slack no-send JSON`: Slack으로 실제 발송하지 않고, 발송될 내용을 파일로만 미리 만든 결과다.
- `로켓그로스`: 쿠팡 물류를 쓰는 주문 흐름이다. 일반배송 주문서와 별도로 조회해야 한다.
- `aggregate`: 주문 하나하나가 아니라 날짜/채널/상품군별 합계만 남기는 방식이다.
- `guard day`: API가 날짜 경계에서 빠뜨리는 주문이 있는지 보기 위해 앞뒤 하루를 더 조회한 뒤, 목표 기간만 다시 자르는 방식이다.

## 이번에 가능해진 것

`report/reportcoffee-sales-summary-no-send-20260501-coupang-rg.json`에 로켓그로스 집계가 들어갔다.

새로 붙은 핵심 위치는 아래다.

- `windows.weekly.sales.channels.coupang.rg_aggregate_reference`
- `windows.weekly.sales.channels.coupang.attachment_reconstruction_reference`
- `windows.weekly.sales.reference_totals.total_with_coupang_revenue_history_plus_rg_reference_krw`
- `windows.weekly.sales.reference_totals.total_with_coupang_ordersheets_plus_rg_reference_krw`
- `source_details.coupang_rg_aggregate`

Slack 발송은 하지 않았다. 이 파일은 실제 메시지를 보내기 전 검산용이다.

## 숫자 결과

기준 기간은 2026-04-25 - 2026-05-01 KST다.

| 항목 | 금액 | 건수 | 해석 |
|---|---:|---:|---|
| 첨부 XLSX 쿠팡 값 | 2,100,400원 | 56건 | 사람이 만든 기존 주간 보고서 값 |
| 쿠팡 일반배송 확인값 | 1,132,700원 | 28건 | 주문서 API 기준 더클린커피 상품 |
| 쿠팡 로켓그로스 로컬 aggregate | 907,000원 | 26건 | 로켓그로스 API 합계를 로컬 SQLite에 합계만 저장한 값 |
| 일반배송 + 로켓그로스 | 2,039,700원 | 54건 | 첨부값까지 거의 접근한 재현 후보 |
| 남은 차이 | 60,700원 | 2건 | 아직 source 확정 전 |

현재 Slack strict 값으로는 2,100,400원을 바로 승격하지 않는다. 60,700원 / 2건이 설명되기 전까지는 `reference`로 둔다.

## 60,700원 / 2건을 더 좁힌 결과

로켓그로스 API를 같은 목표 기간으로 다시 실행하면 907,000원 / 26건이 반복됐다. 즉 로컬 cache만 stale이라서 생긴 문제는 아니다.

하지만 앞뒤 하루를 더 넓게 조회한 뒤 KST 결제일로 2026-04-25 - 2026-05-01만 다시 자르면 결과가 달라졌다.

| 로켓그로스 API 조회 방식 | 목표 기간 안 금액 | 목표 기간 안 건수 | exact 대비 변화 |
|---|---:|---:|---:|
| 2026-04-25 - 2026-05-01 그대로 조회 | 907,000원 | 26건 | 기준 |
| 2026-04-24 - 2026-05-01 조회 후 목표 기간만 자름 | 974,800원 | 28건 | +67,800원 / +2건 |
| 2026-04-25 - 2026-05-02 조회 후 목표 기간만 자름 | 1,059,400원 | 31건 | +152,400원 / +5건 |
| 2026-04-24 - 2026-05-02 조회 후 목표 기간만 자름 | 1,127,200원 | 33건 | +220,200원 / +7건 |

해석은 이렇다.

1. 로켓그로스 API는 날짜 경계에서 조회 기간 영향을 받는다.
2. 그래서 로켓그로스 strict 매출을 만들 때는 앞뒤 하루를 더 가져와 KST 결제일로 다시 자르는 guard day 방식이 필요할 수 있다.
3. 그러나 guard day로 추가되는 7건 안에서 60,700원 / 2건 조합은 바로 나오지 않았다.
4. 따라서 남은 60,700원은 단순히 “로켓그로스 경계일 2건이 빠졌다”로 확정할 수 없다.

## 좁혀진 원인 후보

### 1. 가장 강한 후보: 로켓그로스 API 날짜 기준 차이

로켓그로스 API는 조회 기간을 넓히면 같은 KST 목표 기간 안 주문 수가 달라진다. 이건 직접 관측이다.

다만 이 차이가 첨부 파일의 60,700원 / 2건을 정확히 설명하지는 못했다. 그래서 source 후보는 강하지만, 정답으로 확정하지 않는다.

### 2. 첨부 XLSX의 쿠팡 값 source 정의가 파일 안에 없음

첨부 파일의 2,100,400원은 수식이 아니라 직접 입력값이었다. 파일만 봐서는 일반배송, 로켓그로스, 수동 조정, 정산값 중 무엇을 섞었는지 확정할 수 없다.

### 3. 일반배송 비완료 주문 가능성은 낮음

기존 역추적에서 일반배송의 비완료 상태 후보는 0원이었다. 그래서 남은 60,700원이 일반배송 비완료 상태에서 왔을 가능성은 낮다.

## 현재 판정

`일반배송 주문서 + 로켓그로스 exact aggregate` 조합은 첨부값을 2,039,700원까지 설명한다. 남은 60,700원 / 2건은 아직 source 확정 전이다.

새로 발견한 더 중요한 병목은 `로켓그로스 API 날짜 경계 민감도`다. 이 문제를 닫지 않으면 Slack 보고서에서 쿠팡 매출을 한 숫자로 확정하기 어렵다.

## Track 진척률

- Track A: 81% -> 81% (+0%)
- Track B: 100% -> 100% (+0%)
- Track C: 100% -> 100% (+0%)
- Track D: 68% -> 70% (+2%)
- Track E: 100% -> 100% (+0%)
- Track F: 100% -> 100% (+0%)

## Guardrail

- Slack send: 0
- 운영DB write: 0
- VM Cloud write/restart/deploy: 0
- 광고 계정 변경: 0
- 플랫폼 전환 send/upload: 0
- raw 고객/주문/결제/click 식별자 출력: 0

## 다음 할일

### Auto Green

1. 로켓그로스 guard day 기준을 정식 집계 규칙으로 분리한다.
   - 무엇을 하는가: 로켓그로스 API는 앞뒤 하루를 더 조회하고, 내부에서 KST 결제일 기준으로 목표 기간만 다시 자르는 helper를 만든다.
   - 왜 하는가: 현재 exact 조회와 guard day 조회가 220,200원 / 7건 차이난다.
   - 어떻게 하는가: raw 주문번호는 출력하지 않고, 내부 비교 후 날짜/건수/금액 합계만 내보낸다.
   - 산출물: no-send JSON에 `rg_boundary_guard_reference` 추가.
   - 검증: exact와 guard day의 차이를 매번 표시하고, strict 승격은 별도 플래그로 막는다.
   - 의존성: 없음.

2. 첨부 XLSX의 60,700원 / 2건 후보를 금액 조합으로만 더 좁힌다.
   - 무엇을 하는가: 로켓그로스 경계일 추가분, 일반배송 확인분, 매출인식 내역을 raw 식별자 없이 금액 조합으로 비교한다.
   - 왜 하는가: 현재 경계일 추가분만으로는 60,700원 / 2건이 바로 나오지 않았다.
   - 어떻게 하는가: 주문 식별자는 내부 메모리에서만 쓰고, 보고서에는 금액 히스토그램과 조합 가능 여부만 출력한다.
   - 산출물: `reportcoffee-coupang-gap-combination-diagnostic` JSON.
   - 검증: 60,700원 / 2건 조합이 있으면 source 후보를 하나로 좁히고, 없으면 첨부값의 수동 조정 가능성을 더 높인다.
   - 의존성: 없음.

### Approval Needed

없음. 이번 작업은 read-only, no-send, 로컬 파일 생성만 수행했다.

### Blocked/Parked

1. 쿠팡 화면 export 대조
   - 무엇을 하는가: 쿠팡 Wing 화면에서 같은 기간 일반배송/로켓그로스 export를 내려받아 첨부값과 직접 대조한다.
   - 왜 보류인가: 브라우저 조작은 read-only라도 로그인 세션과 다운로드 위치가 필요하다.
   - Codex가 대신 못 하는 이유: 현재 이 창에서는 쿠팡 브라우저 세션을 직접 보유하지 않는다.
   - 성공 기준: 2,100,400원 또는 남은 60,700원 / 2건이 화면 export에서 확인된다.
