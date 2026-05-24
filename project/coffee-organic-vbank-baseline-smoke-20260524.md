# 더클린커피 오가닉 가상계좌 baseline smoke 20260524

작성 시각: 2026-05-24 13:03 KST
기준일: 2026-05-24
문서 성격: 더클린커피 오가닉 유입 -> 가상계좌 미입금 주문 생성 smoke 결과 / read-only 사후 확인
담당: TJ님 테스트, Codex read-only 확인
상위 문서: [[coffee-meta-checkout-event-gap-gtm-preview-plan-20260522]], [[../report/reportcoffee-campaign-id-p1-vm-deploy-result-20260524]], [[../report/reportcoffee]]

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
    - harness/coffee-data/VERIFY.md
    - harness/coffee-data/AUDITOR_CHECKLIST.md
  required_context_docs:
    - project/coffee-meta-checkout-event-gap-gtm-preview-plan-20260522.md
    - report/reportcoffee-campaign-id-p1-vm-deploy-result-20260524.md
  lane: Green read-only after TJ manual browser test
  allowed_actions:
    - vm_cloud_sqlite_readonly_query
    - evidence_documentation
    - followup_design_note
  forbidden_actions:
    - GTM Production publish
    - Meta CAPI enable
    - Meta browser event production code change
    - Google Ads campaign change
    - Google Ads conversion upload
    - VM Cloud deploy or restart
    - 운영DB write
    - raw_identifier_output
  source_window_freshness_confidence:
    source: TJ님 Chrome/Meta Pixel Helper observation + VM Cloud SQLite read-only
    window: 2026-05-24 12:53-12:58 KST
    freshness: immediate after manual smoke
    confidence: 0.92 for VM Cloud capture; 0.62 for organic attribution because old browser storage polluted the test
```

## 10초 요약

가상계좌 미입금 주문의 결제 진입과 결제 완료 신호는 VM Cloud에 들어왔다. `checkout_started`와 `payment_success(pending)`가 같은 주문 후보로 확인됐다.

다만 이번 테스트는 깨끗한 오가닉 baseline으로 쓰면 안 된다. Google 검색 결과 URL에는 `srsltid`만 있었지만, 같은 브라우저 저장소에 이전 `coffee_smoke_0522` Google CPC 테스트값과 이전 smoke click id가 남아 있었다. 그래서 VM Cloud에는 오가닉이 아니라 `google / cpc / paid_search` 후보로 기록됐다.

Meta Pixel Helper에서는 결제 진입 단계의 `InitiateCheckout` 또는 `AddPaymentInfo`가 보이지 않았다. 이 gap은 수정 필요 항목으로 유지한다.

## TJ님 테스트 입력

- 유입: Google에서 `더클린커피` 검색 후 자연 검색 결과 클릭.
- 랜딩 URL 특징: `srsltid` 포함, 광고 click id 직접 파라미터 없음.
- 결제 진입: `/shop_payment/` with order code/order number.
- 완료 URL: `/shop_payment_complete` with order code/payment code/order number.
- 결제수단: 가상계좌.
- 주문 상태: 미입금 pending.
- 상품금액: 33,900원.

raw order code, order number, payment code는 이 문서에 저장하지 않는다.

## VM Cloud read-only 확인

기준 source:

- VM Cloud SQLite: `/home/biocomkr_sns/seo/repo/backend/data/crm.sqlite3`
- 테이블: `attribution_ledger`, `site_landing_ledger`, `paid_click_intent_ledger`, `order_bridge_ledger`, `imweb_orders`
- 조회 시각: 2026-05-24 12:56-12:58 KST

### 확인된 row

| 항목 | 결과 |
|---|---|
| `attribution_ledger.checkout_started` | 있음 |
| `attribution_ledger.payment_success` | 있음 |
| `payment_success.payment_status` | `pending` |
| `checkout_started` logged_at | 2026-05-24T03:54:08Z |
| `payment_success` logged_at | 2026-05-24T03:55:06Z |
| `site_landing_ledger` recent row | 2건 확인 |
| `paid_click_intent_ledger site=thecleancoffee` | 같은 window 신규 row 없음 |
| `order_bridge_ledger site=thecleancoffee` | 같은 window 신규 row 없음 |
| `imweb_orders` exact order | 2026-05-24 13:00:28 KST sync에서 관측 |

### 중요한 오염 신호

| 항목 | 관측 |
|---|---|
| checkout/payment `utm_source` | `google` |
| checkout/payment `utm_medium` | `cpc` |
| checkout/payment `utm_campaign` | `coffee_smoke_0522` |
| checkout/payment click id | 이전 smoke click id로 분류됨 |
| landing URL | `srsltid` 포함 |
| attribution metadata `srsltid` | 없음 |

해석:

브라우저 저장소의 이전 테스트 touch가 남아 있었다. 따라서 이번 주문을 오가닉 주문으로 분류하면 안 된다. 이 주문은 `오가닉 테스트 시도였지만 이전 Google CPC smoke context에 오염된 checkout/payment capture`로 기록한다.

## Meta Pixel Helper 관측

### 결제 진입 단계

Meta Pixel Helper에서 결제 진입 단계 이벤트가 보이지 않았다.

관측된 것:

- `PageView`
- `SubscribedButtonClick` 자동 감지 이벤트

관측되지 않은 것:

- `InitiateCheckout`
- `AddPaymentInfo`

해석:

기존 결론이 유지된다. Coffee Phase 9는 이미 발생한 `fbq` 이벤트에 eventID를 붙이는 wrapper다. `/shop_payment/`에서 원래 Meta checkout event가 없으면 Pixel Helper에도 새 이벤트가 보이지 않는다.

### 가상계좌 주문 생성 후

Meta Pixel Helper에서 `PurchaseDecisionUnknown`이 보였다.

확인된 주요 custom data:

- currency: `KRW`
- value: `33900`
- order number 계열 값 있음
- payment decision status: `unknown`
- snippet version 있음

해석:

Purchase 자체는 막혔고, 대체 custom event가 나갔다. 다만 가상계좌 pending이면 이상적으로는 `VirtualAccountIssued` 쪽으로 분기되는 것이 더 정확하다. 이번에는 payment decision endpoint가 즉시 가상계좌 pending을 확정하지 못한 것으로 보이며, 별도 진단 후보로 남긴다.

### 사후 payment-decision 재조회

조회 시각: 2026-05-24 13:04 KST

같은 주문 후보를 `payment-decision` endpoint로 사후 read-only 재조회하면 아래처럼 정상 분류됐다.

| 항목 | 결과 |
|---|---|
| status | `pending` |
| browserAction | `block_purchase_virtual_account` |
| reason | `fast_ledger_pending_status` |
| matchedBy | `ledger_order_id` |
| confidence | `high` |

추가 key별 조회:

| lookup key | 결과 |
|---|---|
| order code only | pending / ledger order code match |
| order number only | pending / ledger order id match |
| order id suffix | pending / ledger order id match |
| payment code only | unknown / no match |
| full lookup | pending / ledger order id match |

해석:

가상계좌 pending 판단 로직 자체는 살아 있다. 완료 직후 브라우저에서 `PurchaseDecisionUnknown`이 뜬 원인은 `가상계좌 판단 로직 부재`가 아니라 `완료 직후 ledger/lookup 타이밍 gap`일 가능성이 높다. 현재 Coffee header guard는 unknown일 때 900ms 뒤 1회 재조회하도록 되어 있지만, 이번 케이스에서는 그 시간 안에 pending ledger가 아직 준비되지 않았거나 브라우저 쪽 lookup key가 endpoint 사후 조회와 다르게 들어갔을 가능성이 있다.

## 판정

### 통과

- VM Cloud 자체 checkout/payment 수집은 동작한다.
- 가상계좌 미입금 완료 페이지에서 Purchase를 바로 허용하지 않고 custom event로 분기한다.
- Coffee 서버 수신점 배포 후 site 허용은 깨지지 않았다.

### 실패 또는 보류

- 깨끗한 오가닉 baseline은 실패. 이유는 이전 브라우저 저장소 오염이다.
- Meta checkout browser event는 여전히 미발화.
- `PurchaseDecisionUnknown`은 완료 직후 발생했다. 사후 decision endpoint는 pending을 정상 반환하므로 timing gap으로 분류한다.
- `payment_code`는 Pixel custom data에는 보였지만, VM Cloud `attribution_ledger.metadata_json`에서는 이번 조회 기준 비어 있었다.
- `payment_code` 단독 조회는 사후에도 unknown이다. order code/order number/order id suffix는 각각 pending으로 매칭된다.
- `imweb_orders` exact row는 payment_success보다 약 5분 뒤 sync에서 확인됐다.

## 다음 액션

### Auto Green

1. 깨끗한 오가닉 baseline 재테스트
   - 새 Chrome 프로필 또는 시크릿창에서 진행한다.
   - 테스트 전 localStorage/sessionStorage를 비운다.
   - 검색 결과 URL에 `gclid/gbraid/wbraid/utm_*`가 없는지 확인한다.
   - 성공 기준: VM Cloud attribution row의 `utm_source/utm_medium/gclid`가 비어 있거나 organic/referrer 근거만 남는다.

2. 결제 진입 Meta 이벤트 보강 설계 유지
   - `/shop_payment/` 진입 시 no-send Preview로 `InitiateCheckout` 후보를 먼저 만든다.
   - 운영 Meta browser event 전송은 별도 Red 승인 전에는 하지 않는다.
   - 성공 기준: Preview에서 order code/order number/value/currency가 1회만 생성된다.

3. payment decision unknown 분기 진단
   - 같은 주문 window의 브라우저 console decision log와 사후 endpoint 결과를 비교한다.
   - 성공 기준: 완료 직후에는 unknown이고 사후에는 pending인 이유를 `ledger sync delay` 또는 `browser lookup key mismatch` 중 하나로 분리한다.

### Approval Needed

1. Meta checkout browser event 운영 반영
   - GTM Production publish 또는 Imweb footer fallback production send가 필요하다.
   - 외부 플랫폼 이벤트 수량에 영향을 주므로 Red Lane이다.

2. Google Ads 실제 클릭 -> 가상계좌 주문 end-to-end smoke
   - 광고 클릭 비용과 실제 주문 생성이 들어가므로 TJ님 수동 실행이 필요하다.
   - Codex는 사후 VM Cloud read-only 조회만 담당한다.
