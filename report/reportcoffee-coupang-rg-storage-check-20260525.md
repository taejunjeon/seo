# reportcoffee coupang RG storage check 20260525

작성 시각: 2026-05-25 18:58 KST
문서 성격: 더클린커피 쿠팡 로켓그로스 매출 저장 위치 확인
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
    - data/!data_inventory.md
  lane: Green
  allowed_actions:
    - VM Cloud SQLite read-only aggregate
    - operating DB read-only aggregate
    - local SQLite read-only aggregate
    - local JSON/Markdown report output
  forbidden_actions:
    - Slack send
    - operating_db_write
    - VM Cloud write/restart/deploy
    - ad account mutation
    - platform conversion send/upload
    - raw customer/order/payment/click identifier output
  source_window_freshness_confidence:
    source: "VM Cloud SQLite + 운영DB dashboard.public + 로컬 SQLite"
    window: "2026-04-25 - 2026-05-01 KST target; all-time freshness snapshot 2026-05-25"
    freshness: "VM Cloud/로컬 RG cache max paid date 2026-04-23; 운영DB RG order max paid date 2026-05-25"
    confidence: "high for storage existence/freshness, medium_high for not being target coffee source"
```

## 사람 말 결론

로켓그로스 매출자료는 저장되고 있다. 다만 “어디에 저장됐는가”와 “더클린커피 2026-04-25 - 2026-05-01 매출을 바로 설명하는가”는 답이 다르다.

VM Cloud와 로컬DB에는 TeamKeto 로켓그로스 커피 자료가 저장돼 있지만 2026-04-23에서 멈췄다. 그래서 우리가 찾는 2026-04-25 - 2026-05-01 기간에는 저장된 row가 0건이다.

운영DB에는 로켓그로스 최신 자료가 2026-05-25까지 들어 있다. 하지만 같은 기간 2026-04-25 - 2026-05-01에 잡힌 165건 / 9,209,580원은 더클린커피 coffee 분류가 아니라 other 분류다. 즉 운영DB 최신 로켓그로스 자료는 있으나, 이번 더클린커피 쿠팡 2,100,400원 source로 바로 쓰기에는 맞지 않는다.

어려운 용어:

- `VM Cloud`: att.ainativeos.net 쪽 보조 수집 DB다. 이 맥북 로컬DB와 다르다.
- `운영DB`: 개발팀이 관리하는 PostgreSQL DB다. Supabase dashboard DB로 쓰인다.
- `로컬DB`: 이 맥북 안의 SQLite 파일이다.
- `로켓그로스`: 쿠팡 물류를 타는 주문이다. 일반배송 주문서와 별도 source로 봐야 한다.
- `cache`: API에서 예전에 읽어 와 DB에 저장해 둔 사본이다.
- `freshness`: 그 데이터가 어느 날짜까지 최신인지 보는 기준이다.

## VM Cloud 확인

source: VM Cloud SQLite `/home/biocomkr_sns/seo/repo/backend/data/crm.sqlite3`

테이블은 있다.

- `coupang_rg_orders_api`
- `coupang_settlements_api`
- `coupang_ordersheets_api`

`coupang_rg_orders_api` 전체:

- row: 11,078건
- 계정 수: 2개
- paid date 범위: 2025-01-01 - 2026-04-23
- 마지막 sync: 2026-04-24 12:27:12
- 전체 총액: 382,705,000원
- coffee hint 총액: 151,773,130원

계정별 요약:

- biocom: 10,642건 / 368,466,100원 / 최신 2026-01-30
- teamketo: 436건 / 14,238,900원 / 최신 2026-04-23

타겟 기간 2026-04-25 - 2026-05-01:

- row: 0건
- 금액: 0원
- coffee hint: 0원

판정: VM Cloud에는 TeamKeto 더클린커피 로켓그로스 과거 자료가 있지만, 이번 타겟 기간은 저장되어 있지 않다.

## 로컬DB 확인

source: 로컬 SQLite `/Users/vibetj/coding/seo/backend/data/crm.sqlite3`

로컬DB도 VM Cloud와 같은 상태다.

- row: 11,078건
- paid date 범위: 2025-01-01 - 2026-04-23
- 마지막 sync: 2026-04-24 12:27:12
- 타겟 기간 2026-04-25 - 2026-05-01 row: 0건

판정: 로컬DB는 VM Cloud의 낡은 cache와 같은 수준이며, 타겟 기간 검증에는 못 쓴다.

## 운영DB 확인

source: 운영DB `dashboard.public`

쿠팡 관련 테이블은 있다.

- `tb_coupang_orders_rg`
- `tb_sales_coupang`
- `tb_coupang_orders_mp`
- `tb_coupang_inventory`

### 운영DB `tb_coupang_orders_rg`

이 테이블은 로켓그로스 주문 item 단위 자료다.

전체:

- row: 2,017건
- paid date 범위: 2026-02-19 - 2026-05-25
- 마지막 sync: 2026-05-25 08:05:02
- 전체 총액: 102,315,900원
- coffee hint 총액: 32,880원

타겟 기간 2026-04-25 - 2026-05-01:

- row: 165건
- 전체 총액: 9,209,580원
- coffee hint: 0원
- 상품 분류: other 165건 / 9,209,580원

판정: 운영DB 로켓그로스 주문 테이블은 최신이지만, 더클린커피 커피 주문이 아니라 다른 상품군으로 보인다.

### 운영DB `tb_sales_coupang`

이 테이블은 쿠팡 정산/업로드형 매출 테이블이다.

`channel='coupang_rg'` 전체:

- row: 14,485건
- payment complete date 범위: 2025-01-01 - 2026-04-30
- sales month 범위: 2025-01 - 2026-04
- 마지막 upload: 2026-05-11 03:34:11
- 전체 gross amount: 494,230,130원

타겟 기간 2026-04-25 - 2026-05-01:

- 영양제: 144건 / net 8,082,140원 / gross 7,995,140원
- 미분류: 1건 / net 103,220원 / gross 103,220원

판정: 운영DB 정산형 테이블에도 로켓그로스 매출자료는 있지만, 프로젝트가 영양제/미분류라 더클린커피 주간 쿠팡 매출 source로 직접 쓰기 어렵다.

## 그래서 907,000원은 왜 아직 확정이 아닌가

이전 역추적에서 쿠팡 API range 조회로 로켓그로스 coffee 후보 907,000원이 나왔다. 하지만 저장된 source를 확인해 보니:

1. VM Cloud/로컬DB 저장본은 2026-04-23까지만 있어 2026-04-25 - 2026-05-01을 검산할 수 없다.
2. 운영DB 최신 로켓그로스는 2026-05-25까지 있지만, 같은 기간 더클린커피 coffee가 아니라 other/영양제 쪽이다.
3. 따라서 907,000원은 “fresh API 후보값”이지 “DB 저장본으로 검산된 확정값”은 아니다.

## 현재 판정

질문: VM Cloud 혹은 운영DB 쪽에는 로켓그로스 매출자료가 저장되고 있는가?

답:

- VM Cloud: 저장되고 있다. 하지만 TeamKeto 더클린커피 후보 cache가 2026-04-23에서 멈춰 타겟 기간은 없다.
- 운영DB: 저장되고 있다. 하지만 최신 로켓그로스 자료는 더클린커피 coffee가 아니라 다른 상품군으로 분류된다.
- 로컬DB: VM Cloud와 같은 stale cache다.

자동 Slack 보고 기준:

```text
더클린커피 쿠팡 RG:
- DB 저장본 기준 확정값: 아직 없음
- API 후보값: 907,000원
- 상태: needs_api_refresh_or_export_cross_check
```

## Track 진척률

- Track A: 81% -> 81% (+0%)
- Track B: 100% -> 100% (+0%)
- Track C: 100% -> 100% (+0%)
- Track D: 65% -> 66% (+1%)
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

### Codex가 할 일

1. 쿠팡 로켓그로스 API fresh aggregate를 no-write로 한 번 더 재현한다.
   - 무엇을: 2026-04-25 - 2026-05-01 TeamKeto 로켓그로스 API를 다시 조회해 고객/주문 식별자 없이 날짜별 합계만 만든다.
   - 왜: 907,000원이 저장본으로 검산되지 않았기 때문에 API 재현성부터 닫아야 한다.
   - 어떻게: `getRgOrders` read-only 호출 결과를 날짜/상품분류/금액만 집계한다.
   - 의존성: 쿠팡 API 접근과 rate limit.
   - 성공 기준: 907,000원이 재현되거나 차이 원인이 `API window`, `date basis`, `rate limit`, `source changed` 중 하나로 분류된다.
   - 실패 시 다음 확인점: 쿠팡 API 응답 형식, paidAt 기준, 로켓그로스 메뉴 export.
   - 승인 필요 여부: 없음.
   - 추천 점수/자신감: 88%.

2. Slack no-send JSON에는 RG를 확정값이 아니라 `api_candidate_pending_db_crosscheck`로 표시한다.
   - 무엇을: DB 저장본 확정값과 API 후보값을 분리한다.
   - 왜: 확인 안 된 907,000원을 확정 매출처럼 보이지 않게 하기 위해서다.
   - 어떻게: 쿠팡 breakdown에 `stored_confirmed`, `api_candidate`, `pending_gap` 필드를 둔다.
   - 의존성: 없음.
   - 성공 기준: Slack preview에서 일반배송, RG 후보, 미확인 gap이 분리된다.
   - 실패 시 다음 확인점: 기존 reportcoffee JSON 스키마와 호환성.
   - 승인 필요 여부: 문서/JSON 설계는 없음. 실제 Slack 발송은 별도 승인 필요.
   - 추천 점수/자신감: 91%.

### TJ님이 할 일

1. 필요하면 쿠팡 로켓그로스 화면 export 접근을 허용한다.
   - 무엇을: 쿠팡 관리자에서 2026-04-25 - 2026-05-01 로켓그로스 주문/매출 export를 받는다.
   - 왜: DB 저장본이 타겟 기간을 갖고 있지 않아 화면 export가 가장 빠른 교차검증 수단이다.
   - 어떻게: TJ님이 직접 다운로드하거나 Hermes read-only/download-only를 승인한다.
   - 의존성: 쿠팡 로그인 세션과 메뉴 권한.
   - 성공 기준: export에서 907,000원 또는 남은 60,700원 / 2건이 확인된다.
   - 실패 시 다음 확인점: 메뉴 위치, 권한, 기간 필터.
   - 승인 필요 여부: 직접 다운로드는 없음. Hermes 조작은 별도 승인 권장.
   - 추천 점수/자신감: 74%.
