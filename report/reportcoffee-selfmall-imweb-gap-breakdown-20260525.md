# 더클린커피 자사몰 매출 차이 분해

작성 시각: 2026-05-25 22:45 KST
기준일: 2026-05-25
문서 성격: 더클린커피 2026-04-25 - 2026-05-01 자사몰 매출 Excel vs Codex 차이 분해 및 F&B팀 확인 메시지 초안
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
    - Imweb v2 API read-only aggregate
    - operating DB read-only aggregate
    - local JSON/Markdown report output
    - Slack draft only
  forbidden_actions:
    - Slack send
    - operating_db_write
    - VM Cloud write/restart/deploy
    - Imweb write
    - platform conversion send/upload
    - raw customer/order/payment/click identifier output
  source_window_freshness_confidence:
    source: "Imweb v2 API + operating DB public.tb_sales_toss + public.tb_playauto_orders read-only"
    window: "2026-04-25 - 2026-05-01 KST"
    freshness: "2026-05-25 22:45 KST"
    confidence: "high for amount match, medium for count definition"
```

## 10초 요약

자사몰 매출 금액은 첨부 Excel과 Imweb API 기준이 정확히 맞았다. 첨부 Excel의 5,334,362원은 Imweb API에서 `complete_time`이 있는 주문만 더한 금액과 같다.

이전 Codex best-source가 119,064원 낮았던 이유도 거의 확정됐다. 기존 계산은 Toss 순매출과 NPay 실제 결제만 더했고, Imweb API에서 `etc / nicepay`로 잡히는 4건 119,064원을 빼고 있었다.

다만 건수는 아직 질문이 남는다. 첨부 Excel은 128건이고, Imweb API complete_time 기준은 125건, PlayAuto 자사몰 주문 기준은 126건이다. F&B팀에는 금액 기준과 건수 기준을 같이 물어보는 것이 좋다.

## 확인한 숫자

기준 기간은 2026-04-25 - 2026-05-01 KST다.

| 항목 | 금액 | 건수 | 의미 |
|---|---:|---:|---|
| 첨부 Excel 자사몰 | 5,334,362원 | 128건 | 기존 주간 보고서 값 |
| Imweb API complete_time 있음 | 5,334,362원 | 125건 | 금액 정확히 일치 |
| Imweb API 전체 비취소 유상 주문 | 5,518,188원 | 130건 | complete_time 없는 5건까지 포함 |
| complete_time 없는 주문 | 183,826원 | 5건 | 첨부 Excel에는 금액 기준으로 빠진 것으로 보임 |
| Toss 운영DB 순매출 | 2,679,898원 | 62건 | 기존 Codex 카드/가상계좌 쪽 기준 |
| PlayAuto 자사몰 주문 | 금액 0원 | 126건 | 상품/주문 라인 참고용, 결제액 source 아님 |

어려운 용어:

- `Imweb API`: 아임웹이 제공하는 주문 조회 통로다. 사람이 관리자 화면에서 보는 주문을 프로그램으로 읽는다.
- `complete_time`: 아임웹 주문에서 결제가 완료된 시간이다. 이번 Excel 금액과 정확히 맞는 기준이다.
- `Toss 순매출`: Toss 결제 금액에서 취소 금액을 뺀 카드/가상계좌 계열 결제 합계다.
- `PlayAuto`: 상품/주문 라인 확인에는 좋지만, 더클린커피 자사몰 결제액은 대부분 0원으로 들어와 금액 정본으로 쓰기 어렵다.

## 119,064원 차이 원인

이전 Codex best-source는 아래였다.

| 구성 | 금액 |
|---|---:|
| Toss 순매출 | 2,679,898원 |
| VM Cloud NPay actual | 2,535,400원 |
| 합계 | 5,215,298원 |
| 첨부 Excel과 차이 | -119,064원 |

Imweb API complete_time 기준 결제수단 분포는 아래다.

| 결제수단 | PG | 금액 | 건수 |
|---|---|---:|---:|
| npay | blank | 2,535,400원 | 60건 |
| card | tosspayments | 2,628,013원 | 59건 |
| virtual | tosspayments | 51,885원 | 2건 |
| etc | nicepay | 119,064원 | 4건 |
| 합계 | - | 5,334,362원 | 125건 |

즉 금액 차이 119,064원은 Imweb API의 `etc / nicepay` 4건과 정확히 같다. 기존 Codex 계산은 Toss와 NPay만 더해서 이 결제 묶음을 빠뜨렸다.

## 건수 차이

금액은 닫혔지만 건수는 아직 닫히지 않았다.

- 첨부 Excel: 128건
- Imweb API complete_time 있음: 125건
- PlayAuto 자사몰 distinct order: 126건
- Toss + NPay + nicepay 단순 합: 126건

해석:

1. Excel의 128건은 순수 주문번호 기준이 아닐 수 있다.
2. 상품 행, 결제 행, 또는 일부 수동 포함/제외 기준이 섞였을 수 있다.
3. 금액은 Imweb complete_time 기준과 정확히 일치하므로, 매출 금액 source는 거의 확인됐다.
4. 자동 보고서에서는 금액 기준은 Imweb complete_time을 우선 후보로 보고, 건수 기준은 F&B팀 확인 후 고정하는 것이 안전하다.

## Slack 메시지 초안

```text
[예약 발송 초안]

안녕하세요. 더클린커피 주간 성과보고서 자사몰 매출 기준을 확인하고 싶습니다.

확인 대상 파일:
[주간]브랜드 성과보고서_팀키토&더클린커피.xlsx

확인 기간:
2026-04-25 - 2026-05-01

확인하고 싶은 값:
더클린커피 자사몰 매출 5,334,362원 / 128건

저희 쪽에서 아임웹 API와 결제 DB를 다시 대조해보니 금액은 아래 기준과 정확히 일치했습니다.

- 아임웹 API에서 결제완료 시간이 있는 주문만 합산: 5,334,362원
- 결제수단별 구성:
  - NPay: 2,535,400원 / 60건
  - Toss 카드: 2,628,013원 / 59건
  - Toss 가상계좌: 51,885원 / 2건
  - NicePay/기타 결제: 119,064원 / 4건

이전에 저희 자동 집계가 119,064원 낮았던 이유는 NicePay/기타 결제 4건을 빠뜨렸기 때문으로 보입니다.

다만 건수 기준은 아직 확인이 필요합니다.

- 주간 보고서: 128건
- 아임웹 API 결제완료 시간 기준: 125건
- PlayAuto 자사몰 주문 기준: 126건

아래 3가지만 확인 부탁드립니다.

1. 자사몰 매출 5,334,362원은 아임웹의 결제완료 시간 기준으로 보신 값이 맞을까요?
2. 128건은 주문번호 기준, 상품 행 기준, 결제 행 기준 중 무엇인가요?
3. NicePay/기타 결제 119,064원 / 4건도 자사몰 매출에 포함하는 기준이 맞을까요?

목적은 기존 보고서를 문제 삼기 위한 것이 아니라, 앞으로 Slack 자동 보고서에서도 같은 기준으로 자사몰 매출과 건수를 맞추기 위한 확인입니다.
```

## Track 진척률

- Track A: 81% -> 81% (+0%)
- Track B: 100% -> 100% (+0%)
- Track C: 100% -> 100% (+0%)
- Track D: 70% -> 72% (+2%)
- Track E: 100% -> 100% (+0%)
- Track F: 100% -> 100% (+0%)

## Guardrail

- Slack send: 0
- 운영DB write: 0
- VM Cloud write/restart/deploy: 0
- Imweb write: 0
- 광고 계정 변경: 0
- 플랫폼 전환 send/upload: 0
- raw 고객/주문/결제/click 식별자 출력: 0

## 다음 할일

### Auto Green

1. Slack no-send JSON의 자사몰 기준을 Imweb complete_time 기준으로 바꾸는 설계를 한다.
   - 무엇을 하는가: 자사몰 매출 금액은 Imweb API complete_time 기준을 primary 후보로 올리고, Toss/NPay는 구성 breakdown으로 둔다.
   - 왜 하는가: 첨부 Excel 금액과 정확히 맞는 source가 확인됐기 때문이다.
   - 어떻게 하는가: `selfmall.source_basis=imweb_complete_time_paid_orders`와 결제수단 breakdown을 추가한다.
   - 산출물: Slack no-send JSON v2 설계안.
   - 검증: 2026-04-25 - 2026-05-01 금액 5,334,362원 재현.
   - 의존성: 건수 기준은 F&B팀 답변 필요.

### Approval Needed

없음. 이번 작업은 read-only와 메시지 초안 작성만 수행했다.

### Blocked/Parked

1. 자사몰 건수 128건 정의
   - 남은 이유: Codex가 확인한 세 source가 각각 125건, 126건, 126건이라 첨부 Excel 128건과 직접 일치하지 않는다.
   - TJ님 필요 액션: F&B팀에 위 Slack 초안을 보내 기준 확인.
