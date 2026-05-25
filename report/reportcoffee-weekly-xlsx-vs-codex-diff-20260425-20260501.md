# reportcoffee weekly XLSX vs Codex diff 20260425-20260501

작성 시각: 2026-05-25 18:10 KST
기준일: 2026-05-01
문서 성격: 더클린커피 주간 브랜드 성과보고서와 Codex 집계 차이 원인표
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
    - attached XLSX read-only inspection
    - local/VM Cloud/API read-only dry-run
    - local JSON/Markdown report output
  forbidden_actions:
    - Slack send
    - operating_db_write
    - VM Cloud write/restart/deploy
    - platform conversion send/upload
    - ad account mutation
    - raw customer/order/payment/click identifier output
  source_window_freshness_confidence:
    source: "Attached workbook + Codex read-only dry-run composite"
    window: "2026-04-25 - 2026-05-01 KST"
    freshness: "2026-05-25 18:10 KST"
    confidence: "medium_high for displayed workbook values and high-level gap causes, medium for exact Coupang source cause"
```

## 10초 요약

첨부 파일과 Codex 집계는 같은 기간으로 맞춰도 아직 완전히 일치하지 않는다. 가장 큰 차이는 쿠팡 매출과 네이버/쿠팡 광고비다.

자사몰 광고비는 정확히 일치한다. 자사몰 매출도 VM Cloud NPay를 붙이면 2.23% 차이까지 좁혀진다. 반면 쿠팡 매출은 첨부 파일이 2,100,400원이고 Codex strict 기준은 1,117,300원이라 983,100원 차이가 난다.

광고비 차이는 더 명확하다. 첨부 파일은 네이버 602,890원과 쿠팡 514,712원을 수식으로 붙이고 있지만, Codex no-send 집계기는 아직 두 광고비 source를 이 기간에 붙이지 못한다.

## 비교 기준

첨부 파일 기준값은 `/Users/vibetj/Downloads/[주간]브랜드 성과보고서_팀키토&더클린커피.xlsx`의 `1주차` 시트, 오른쪽 더클린커피 블록이다.

Codex 기준값은 같은 기간 `2026-04-25 - 2026-05-01`로 돌린 no-send dry-run이다. 단, 정확한 원인 분리를 위해 best-source 조합을 썼다. 자사몰은 VM Cloud NPay와 운영DB Toss를 썼고, 쿠팡은 성공한 revenue-history 결과를 썼다. 이것은 최종 Slack 보고서가 아니라 차이를 좁히기 위한 진단값이다.

어려운 용어:

- `dry-run`: 실제 발송이나 저장 없이 계산만 해보는 실행이다.
- `strict 기준`: 보고서에 넣기 전에 source와 날짜 기준이 비교적 분명한 값만 넣는 보수 기준이다.
- `revenue-history`: 쿠팡 매출인식 내역이다. 주문 발생일이 아니라 쿠팡이 매출로 인식한 날짜 기준이다.
- `ordersheets`: 쿠팡 주문서다. 주문 발생 참고에는 좋지만 매출 인식일과 다를 수 있다.

## 매출 차이 원인표

| 구분 | 첨부 파일 | Codex 현재 best-source | 차이 | 원인 판정 |
|---|---:|---:|---:|---|
| 네이버/스마트스토어 | 1,905,140원 / 55건 | 1,839,340원 / 53 rows | -65,800원 | PlayAuto 기준과 첨부 기준이 2건 또는 65,800원만큼 다름 |
| 자사몰 | 5,334,362원 / 128건 | 5,215,298원 | -119,064원 | Toss net + VM Cloud NPay actual 조합에는 첨부의 일부 자사몰 조정값이 빠짐 |
| 쿠팡 | 2,100,400원 / 56건 | 1,117,300원 | -983,100원 | 첨부의 쿠팡 매출 source와 Codex의 revenue-history coffee_hint 기준이 다름 |
| 합계 | 9,339,902원 / 239건 | 8,171,938원 | -1,167,964원 | 전체 차이의 84.2%가 쿠팡에서 발생 |

### 매출 차이 해석

네이버/스마트스토어는 차이가 작다. Codex는 운영DB `public.tb_playauto_orders`에서 `shop_name='스마트스토어'`를 읽고, `pay_time`이 있으면 그것을 쓰고 없으면 `ord_time`을 쓰는 날짜 기준으로 계산한다. 첨부 파일은 55건인데 Codex는 53 rows다. 즉 원본 2건 또는 상태/날짜 기준 차이로 볼 수 있다.

자사몰은 차이가 119,064원이다. Codex는 Toss 결제 순매출 2,679,898원과 VM Cloud NPay actual 2,535,400원을 더해 5,215,298원으로 계산했다. 첨부 파일은 5,334,362원이다. 차이는 크지 않지만, 첨부 파일이 Imweb 전체 주문표 또는 별도 조정값을 포함했을 가능성이 있다.

쿠팡은 가장 크다. 첨부 파일은 2,100,400원이고 Codex strict 기준은 쿠팡 revenue-history의 coffee_hint 1,117,300원이다. Codex가 같은 계정 전체 revenue-history를 봐도 1,390,500원이라 첨부값과 아직 맞지 않는다. 따라서 첨부의 쿠팡 매출은 현재 Codex가 쓰는 `매출인식일 기준 coffee_hint`와 다른 source일 가능성이 높다.

## 광고비 차이 원인표

| 구분 | 첨부 파일 | Codex 현재 no-send | 차이 | 원인 판정 |
|---|---:|---:|---:|---|
| 네이버 | 602,890원 | 0원 | -602,890원 | 이 기간 네이버 광고 원본/export가 Codex에 붙어 있지 않음 |
| 자사몰 Meta | 343,985원 | 343,985원 | 0원 | 완전 일치 |
| 쿠팡 | 514,712원 | 0원 | -514,712원 | 쿠팡 광고비 source가 Codex에 붙어 있지 않음 |
| 합계 | 1,461,587원 | 343,985원 | -1,117,602원 | 네이버와 쿠팡 광고비가 빠진 차이 |

### 광고비 차이 해석

자사몰 Meta 광고는 정확히 맞는다. 첨부 파일과 Codex 모두 광고비 343,985원, 전환매출 1,564,156원, 클릭 312로 일치한다.

네이버 광고비는 첨부 파일에 수식이 들어 있다. 수식은 `217,890 + 1,540,000 / 4`다. 즉 주간 직접값처럼 보이는 217,890원에 1,540,000원을 4주로 나눈 385,000원을 더한다. Codex는 이 수동 배분 규칙을 아직 모른다.

쿠팡 광고비도 수식이다. 첨부 파일은 계정 전체 533,164원에서 팀키토 쪽 18,452원을 빼서 514,712원을 만든다. Codex no-send 집계기에는 쿠팡 광고비 source 자체가 아직 붙어 있지 않다.

## 첫구매와 재구매

첨부 파일에는 첫구매/재구매가 있다.

- 네이버: 전체 47명 / 신규 16명 / 재구매 31명
- 자사몰: 전체 123명 / 신규 28명 / 재구매 95명
- 쿠팡: 전체 28명 / 신규 4명 / 재구매 24명
- 합계: 전체 198명 / 신규 48명 / 재구매 150명

Codex no-send JSON에는 아직 같은 형식의 첫구매/재구매가 없다. 따라서 이 항목은 현재 비교 불가다. 구현하려면 고객 식별자를 원본 내부에서만 사용해 같은 사람 여부를 계산하고, 보고서에는 집계 숫자만 출력해야 한다.

## 현재 판정

첨부 파일 값이 전부 틀렸다고 볼 근거는 없다. 오히려 첨부 파일은 일부 수동 배분과 차감 로직을 이미 쓰고 있다.

Codex 쪽 문제는 세 가지다.

1. 쿠팡 매출 source가 첨부 파일과 다르다.
2. 네이버 광고비 source와 수동 배분 규칙이 아직 없다.
3. 쿠팡 광고비 source와 팀키토 차감 규칙이 아직 없다.

## Track 진척률

- Track A: 81% -> 81% (+0%)
- Track B: 100% -> 100% (+0%)
- Track C: 100% -> 100% (+0%)
- Track D: 61% -> 63% (+2%)
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

1. 쿠팡 2,100,400원 source 역추적
   - 무엇을 하는가: 쿠팡 revenue-history, ordersheets, 정산 cache, 첨부 수식의 원본 후보를 같은 기간으로 비교한다.
   - 왜 하는가: 전체 매출 차이 1,167,964원 중 983,100원이 쿠팡에서 나온다.
   - 어떻게 하는가: raw 주문번호는 출력하지 않고 날짜/상태/상품분류/금액 aggregate만 비교한다.
   - 성공 기준: 첨부의 2,100,400원이 어떤 source에서 나왔는지 판정한다.

2. 네이버 광고비 602,890원 재현 경로 만들기
   - 무엇을 하는가: 2026-04-25 - 2026-05-01 기준 네이버 화면 export 또는 수동 input JSON을 만든다.
   - 왜 하는가: 현재 Codex no-send에서는 네이버 광고비가 0원으로 빠져 있다.
   - 어떻게 하는가: Hermes read-only download 또는 명시적 input file로 처리한다.
   - 성공 기준: 217,890원과 1,540,000/4 배분 규칙이 숨은 수식이 아니라 보고서 JSON에 노출된다.

3. 쿠팡 광고비 514,712원 input layer 설계
   - 무엇을 하는가: 쿠팡 계정 전체 광고비에서 팀키토 값을 빼는 규칙을 명시 input으로 만든다.
   - 왜 하는가: 현재 첨부 파일은 이미 이 방식을 쓰지만 Codex no-send에는 없다.
   - 어떻게 하는가: 수동 Excel 수식을 코드에 숨기지 않고 `source`, `formula`, `owner`, `window`가 있는 JSON으로 둔다.
   - 성공 기준: 쿠팡 광고비가 자동 보고서에 들어가도 근거가 추적된다.

### Approval Needed

없음. 이번 작업은 read-only와 문서화만 수행했다.

### Blocked-Parked

첫구매/재구매 자동 비교는 아직 보류한다. 이유는 현재 no-send JSON에 고객 단위 재구매 계산이 없기 때문이다. 구현은 가능하지만, 고객 식별자를 내부 계산에 쓰는 규칙과 해시화 전환 계획을 별도 설계해야 한다.
