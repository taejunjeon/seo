# 더클린커피 자사몰 Slack no-send 기준 변경 설계

작성 시각: 2026-05-25 23:02 KST
기준일: 2026-05-25
문서 성격: 더클린커피 Slack no-send JSON 자사몰 매출 source 변경 설계
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
    - local design document
    - local JSON contract proposal
    - no-send source contract design
  forbidden_actions:
    - Slack send
    - operating_db_write
    - VM Cloud write/restart/deploy
    - Imweb write
    - platform conversion send/upload
    - raw customer/order/payment/click identifier output
  source_window_freshness_confidence:
    source: "Imweb v2 API read-only validation + operating DB read-only cross-check"
    window: "2026-04-25 - 2026-05-01 KST"
    freshness: "2026-05-25 23:02 KST"
    confidence: "high for amount basis, medium for order count basis"
```

## 10초 요약

자사몰 매출 금액은 Slack 미리보기 JSON에서 아임웹 결제완료 시간 기준으로 바꾸는 것이 맞다. 2026-04-25 - 2026-05-01 검증에서 이 기준이 기존 Excel 금액 5,334,362원과 정확히 일치했다.

다만 건수는 아직 확정하지 않는다. Excel은 128건이고, 아임웹 결제완료 시간 기준은 125건이다. 그래서 자동 보고서에는 금액 기준은 바꾸되, 건수는 `count_definition_pending`으로 표시하는 설계가 안전하다.

어려운 용어:

- `Slack no-send JSON`: Slack에 실제로 보내지 않고, 보낼 내용을 파일로 미리 만든 결과다.
- `source basis`: 이 숫자를 어떤 원본과 기준으로 만들었는지 적는 설명 필드다.
- `complete_time`: 아임웹 주문의 결제완료 시간이다.
- `diagnostic`: 예산 판단에 바로 쓰는 값이 아니라, 차이 원인을 설명하는 보조값이다.

## 바꿀 방향

기존 자사몰 금액은 Toss 순매출과 NPay actual을 더하는 방식이었다. 이 방식은 결제수단을 이해하기 좋지만, 주간 Excel 금액과는 119,064원 차이가 났다.

새 기준은 아래다.

```text
자사몰 매출 금액 = 아임웹 API 주문 중
site=thecleancoffee,
결제완료 시간이 있고,
결제금액이 0원보다 크고,
취소/반품/교환으로 분류되지 않은 주문의 결제금액 합계
```

이 기준은 2026-04-25 - 2026-05-01에 5,334,362원으로 Excel 금액과 정확히 맞았다.

## 검증 숫자

| 항목 | 금액 | 건수 | 판정 |
|---|---:|---:|---|
| Excel 자사몰 | 5,334,362원 | 128건 | 기존 보고서 |
| 아임웹 결제완료 시간 있음 | 5,334,362원 | 125건 | 금액 source 후보 확정 |
| 아임웹 전체 비취소 유상 주문 | 5,518,188원 | 130건 | complete_time 없는 주문까지 포함돼 과대 |
| complete_time 없는 주문 | 183,826원 | 5건 | Excel 금액에는 빠진 것으로 보임 |
| PlayAuto 자사몰 주문 | 금액 0원 | 126건 | 상품/건수 참고용 |

주의: `complete_time 없는 주문`은 Excel 금액에는 빠졌지만, 이것만으로 미결제라고 단정하지 않는다. 자동 보고에서는 “보고서 기준에서 제외된 보조 진단값”으로 표시한다.

## 결제수단 breakdown

아임웹 결제완료 시간 기준 5,334,362원은 아래로 나뉜다.

| 결제수단 | 결제 처리사 | 금액 | 건수 |
|---|---|---:|---:|
| NPay | blank | 2,535,400원 | 60건 |
| card | TossPayments | 2,628,013원 | 59건 |
| virtual | TossPayments | 51,885원 | 2건 |
| etc | NicePay | 119,064원 | 4건 |
| 합계 | - | 5,334,362원 | 125건 |

이 breakdown은 F&B팀에 보낼 필요는 없다. 자동 보고서 내부에서는 왜 금액이 맞는지 설명하는 근거로 남긴다.

## no-send JSON 제안 구조

`windows.<window>.sales.channels.selfmall` 아래에 아래 필드를 둔다.

```json
{
  "amount_krw": 5334362,
  "amount_krw_korean": "5,334,362원",
  "order_count": 125,
  "source_basis": "imweb_complete_time_paid_orders_v1",
  "source_status": "amount_matched_attachment_count_pending",
  "count_definition_status": "pending_fnb_confirmation",
  "payment_breakdown": {
    "by_pay_type": {
      "npay": { "orders": 60, "amount_krw": 2535400 },
      "card": { "orders": 59, "amount_krw": 2628013 },
      "virtual": { "orders": 2, "amount_krw": 51885 },
      "etc": { "orders": 4, "amount_krw": 119064 }
    },
    "by_pg_type": {
      "blank": { "orders": 60, "amount_krw": 2535400 },
      "tosspayments": { "orders": 61, "amount_krw": 2679898 },
      "nicepay": { "orders": 4, "amount_krw": 119064 }
    }
  },
  "diagnostics": {
    "complete_time_blank": {
      "orders": 5,
      "amount_krw": 183826,
      "meaning": "report_alignment_excluded_not_unpaid_proof"
    }
  },
  "legacy_reference": {
    "toss_plus_npay_amount_krw": 5215298,
    "meaning": "old split basis kept only for continuity"
  }
}
```

## 구현 계획

1. 아임웹 API aggregate helper를 만든다.
   - 무엇을 하는가: 주문번호를 출력하지 않고, 날짜/결제수단/금액 합계만 만든다.
   - 왜 하는가: Slack 보고서에 개인정보나 주문 식별자가 들어가면 안 된다.
   - 어떻게 하는가: API는 페이지 단위로 읽고, `TOO MANY REQUEST`가 나오면 재시도한다.

2. no-send 집계기에 옵션을 추가한다.
   - 제안: `--selfmall-source=imweb_complete_time|legacy_split`
   - 기본값은 처음에는 `legacy_split`로 두고, 검증 window에서만 `imweb_complete_time`을 사용해 비교한다.
   - 이후 2-3개 주차에서 맞으면 기본값을 바꾼다.

3. 자사몰 금액은 아임웹 기준으로 계산한다.
   - 기준: 결제완료 시간이 있는 비취소 유상 주문.
   - 보조 표시: NPay, Toss, NicePay breakdown.
   - 보류 표시: 건수 기준은 F&B팀 확인 전까지 pending.

4. 기존 Toss/NPay split은 삭제하지 않는다.
   - 이유: 결제수단별 설명과 cross-check에 필요하다.
   - 위치: `legacy_reference` 또는 `cross_checks`.

5. Slack 실제 발송은 별도 승인 전까지 하지 않는다.
   - 이번 설계는 no-send 구조만 바꾼다.

## 성공 기준

- 2026-04-25 - 2026-05-01 자사몰 금액이 5,334,362원으로 재현된다.
- 결제수단 breakdown 합계도 5,334,362원이다.
- `complete_time_blank` 183,826원 / 5건은 진단값으로만 표시된다.
- raw 고객/주문/결제 식별자는 JSON에 없다.
- Slack send는 0이다.

## Track 진척률

- Track A: 81% -> 81% (+0%)
- Track B: 100% -> 100% (+0%)
- Track C: 100% -> 100% (+0%)
- Track D: 72% -> 73% (+1%)
- Track E: 100% -> 100% (+0%)
- Track F: 100% -> 100% (+0%)

## Guardrail

- Slack send: 0
- 운영DB write: 0
- VM Cloud write/restart/deploy: 0
- Imweb write: 0
- 플랫폼 전환 send/upload: 0
- raw 고객/주문/결제/click 식별자 출력: 0

## 다음 할일

### Auto Green

1. `reportcoffee-sales-summary-no-send.ts`에 selfmall source 옵션을 추가한다.
   - 무엇을 하는가: no-send JSON에서 자사몰 금액을 아임웹 결제완료 시간 기준으로 계산할 수 있게 한다.
   - 왜 하는가: Excel 금액과 맞는 기준이 확인됐기 때문이다.
   - 어떻게 하는가: 기존 Toss/NPay 계산은 cross-check로 유지하고, 새 Imweb aggregate를 primary 후보로 붙인다.
   - 검증: 같은 기간 5,334,362원 재현, typecheck, JSON parse, raw scan.
   - 의존성: 없음.

2. 2026-04-25 - 2026-05-01 외 다른 주차도 1-2개 더 비교한다.
   - 무엇을 하는가: 새 기준이 한 주차에만 우연히 맞는지 확인한다.
   - 왜 하는가: Slack 자동 보고 기본값을 바꾸려면 반복성이 필요하다.
   - 어떻게 하는가: 동일한 no-send 옵션으로 최근 주차와 4월 다른 주차를 비교한다.
   - 검증: 금액 차이와 건수 차이를 source/window/freshness와 함께 기록한다.
   - 의존성: 비교할 Excel 기준값 또는 F&B팀 기준 답변.

### Approval Needed

없음. 실제 Slack 발송은 별도 승인 전까지 하지 않는다.

### Blocked/Parked

1. 자사몰 건수 128건 정의
   - 남은 이유: 아임웹 결제완료 시간 기준은 125건이고, PlayAuto 자사몰 주문 기준은 126건이다.
   - 필요한 확인: F&B팀이 128건을 주문번호, 상품 행, 결제 행 중 무엇으로 본 것인지.
