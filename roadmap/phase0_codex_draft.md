# Phase 0 Codex Draft - 운영 기준선 고정

작성 기준일: 2026-04-16 KST
대상 경로: `/Users/vibetj/coding/seo/roadmap/phase0_codex_draft.md`
대상 사이트: `biocom`, `thecleancoffee`, `aibio`

전제는 다음과 같소.

- Phase 0의 목적은 이후 에이전트와 운영 화면이 같은 정의로 숫자를 판단하게 하는 것이오.
- 운영 판단은 VM DB 기준이어야 하며, 현재 로컬 Mac SQLite는 개발/검증용 mirror로만 해석하오.
- 현재 attribution ledger의 실제 저장 상태는 `pending`, `confirmed`, `canceled` 세 가지뿐이오. `paid`, `refunded`, `VirtualAccountIssued`는 Phase 0 dictionary에서 새로 정규화하는 운영 상태이오.
- `confirmed`의 최종 운영 기준은 TJ님 승인이 필요하오. 이 초안은 "운영 confirmed = Imweb 구매확정 `PURCHASE_CONFIRMATION`"을 기본안으로 두고, 현재 ledger `confirmed`는 PG 승인에 가까운 보조 상태로 분리하오.
- Phase 2 backend surface는 `/api/integrity/health`, `/api/integrity/summary`, `/api/integrity/incidents`, `/api/integrity/incidents/:id`, `/api/integrity/orders/search`, `/api/integrity/incidents/:id/feedback`와 호환되어야 하오.

## 1. Conversion Dictionary v1

### paid

- 정의: PG 결제 승인 또는 입금 완료가 확인되어 매출 후보가 생겼지만, 아직 운영 구매확정으로 잠그지 않은 상태이오.

- 판정 근거 필드:
  - `toss_transactions.status`: `DONE`, `PAID`, `APPROVED`, `SUCCESS`, `SUCCEEDED`, `COMPLETED`, `COMPLETE` 계열이면 `paid`로 본다. `toss_transactions`의 실제 컬럼은 `payment_key`, `order_id`, `method`, `status`, `transaction_at`, `currency`, `amount`, `synced_at`이오 (`backend/src/crmLocalDb.ts:337`, `backend/src/crmLocalDb.ts:347`).
  - `toss_settlements.payment_key`, `order_id`, `amount`, `approved_at`, `cancel_amount`, `synced_at`: settlement row가 있고 `amount > 0`, `cancel_amount = 0`이면 PG 기준 paid의 보강 근거로 쓴다 (`backend/src/crmLocalDb.ts:350`, `backend/src/crmLocalDb.ts:363`).
  - `imweb_orders.imweb_status IN ('PAY_COMPLETE','COMPLETE')`: Imweb 주문 생애주기상 결제 완료/배송 완료 계열은 paid 보조 신호로 본다. `imweb_status`는 `ensureColumn`으로 추가된다 (`backend/src/crmLocalDb.ts:43`, `backend/src/routes/crmLocal.ts:501`).
  - `imweb_orders.payment_amount`, `order_no`, `order_code`, `complete_time`, `synced_at`: 주문 금액과 동기화 시점 근거로 쓴다 (`backend/src/crmLocalDb.ts:258`, `backend/src/crmLocalDb.ts:283`).
  - `attribution_ledger.payment_status = 'confirmed'`는 현재 코드에서는 PG paid와 운영 confirmed가 섞일 수 있으므로 secondary로만 본다. ledger 컬럼은 `payment_status`, `logged_at`, `order_id`, `payment_key`, `approved_at`, `source`, `metadata_json`이오 (`backend/src/attributionLedgerDb.ts:45`, `backend/src/attributionLedgerDb.ts:70`).

- ROAS/매출 집계 포함 여부 + 예외:
  - 기본 정책: 운영 메인 ROAS의 분자에는 포함하지 않고 `paidRevenue` 또는 `provisionalRevenue`에만 집계하오.
  - 예외: TJ님이 운영 매출 기준을 PG 승인 매출로 승인하면 `paid`를 `confirmedRevenue`에 포함할 수 있소. 이 경우 `definitionVersion`을 변경해야 하오.
  - 배송비/VAT 포함 여부는 `imweb_orders.payment_amount`, `delivery_price`, `total_price` 기준으로 별도 산식을 둘 수 있으나 승인 전에는 `payment_amount` gross 기준으로 둔다 (`backend/src/crmLocalDb.ts:277`, `backend/src/crmLocalDb.ts:280`).

- CAPI Purchase 전송 여부 + 조건:
  - 기본 전송하지 않소.
  - 현재 Meta CAPI 자동 후보는 ledger의 `touchpoint='payment_success'`, `captureMode='live'`, `paymentStatus='confirmed'`만 고른다 (`backend/src/metaCapi.ts:254`, `backend/src/metaCapi.ts:267`).
  - Phase 0 이후 `paid`와 `confirmed`를 분리하면 `paid`만으로는 Purchase를 보내면 안 되오. 단 TJ님이 PG 승인 기준을 confirmed로 승인하는 경우에만 예외가 가능하오.

- 전이 조건:
  - `pending -> paid`: Toss transaction 또는 direct API에서 승인/입금 완료 계열 status가 확인될 때.
  - `paid -> confirmed`: Imweb status sync에서 `imweb_orders.imweb_status = 'PURCHASE_CONFIRMATION'`이 확인될 때.
  - `paid -> canceled`: 구매확정 전 Toss/Imweb 취소 또는 실패 계열이 확인될 때.
  - `paid -> refunded`: 결제 승인 이후 `toss_settlements.cancel_amount > 0` 또는 Imweb `RETURN`이 확인될 때.

### confirmed

- 정의: 운영 매출과 ROAS 분자로 잠글 수 있는 구매확정 상태이오.

- 판정 근거 필드:
  - 기본 정본: `imweb_orders.imweb_status = 'PURCHASE_CONFIRMATION'`. Imweb status 후보에 `PURCHASE_CONFIRMATION`이 실제로 포함되어 있소 (`backend/src/routes/crmLocal.ts:501`, `backend/src/routes/crmLocal.ts:508`).
  - `imweb_orders.site`, `order_no`, `payment_amount`, `complete_time`, `imweb_status_synced_at`: site별 구매확정 수량/금액과 freshness 근거로 쓴다. 구매확정 stats는 `SUM(payment_amount)`와 `MAX(imweb_status_synced_at)`를 조회한다 (`backend/src/routes/crmLocal.ts:1243`, `backend/src/routes/crmLocal.ts:1258`).
  - 보조 근거: `attribution_ledger.payment_status = 'confirmed'`, `approved_at`, `payment_key`, `metadata_json`. ledger row 변환은 `confirmed`, `canceled`, `pending`만 인정한다 (`backend/src/attributionLedgerDb.ts:160`, `backend/src/attributionLedgerDb.ts:167`).
  - PG 보조 근거: `toss_settlements.amount > 0 AND cancel_amount = 0` 또는 `toss_transactions.status` 승인 계열 (`backend/src/crmLocalDb.ts:350`, `backend/src/crmLocalDb.ts:363`).

- ROAS/매출 집계 포함 여부 + 예외:
  - 기본 정책: 운영 메인 ROAS와 `confirmedRevenue`에 포함하오.
  - 기본 금액: `imweb_orders.payment_amount`를 사용하오.
  - 예외: TJ님이 배송비/VAT 제외 기준을 승인하면 `payment_amount - delivery_price` 또는 VAT 제외 산식으로 `confirmedRevenueNet`를 별도 산출하오.
  - 현재 attribution ledger summary도 `confirmedRevenue`, `pendingRevenue`, `canceledRevenue`를 구분하지만 ledger 기준 confirmed는 secondary로만 둔다 (`backend/src/attribution.ts:687`, `backend/src/attribution.ts:714`).

- CAPI Purchase 전송 여부 + 조건:
  - 전송하오.
  - 조건은 `touchpoint='payment_success'`, `captureMode='live'`, `paymentStatus='confirmed'`, 아직 successful operational CAPI log가 없는 주문이오 (`backend/src/metaCapi.ts:254`, `backend/src/metaCapi.ts:267`).
  - CAPI log에는 `event_id`, `pixel_id`, `event_name`, `timestamp`, `response_status`, `send_path`가 남는다 (`backend/src/metaCapi.ts:92`, `backend/src/metaCapi.ts:103`).
  - 성공 이력은 `response_status` 2xx, segment `operational`, `send_path='auto_sync'` 조건으로 본다 (`backend/src/metaCapi.ts:1265`, `backend/src/metaCapi.ts:1273`).

- 전이 조건:
  - `paid -> confirmed`: `imweb_orders.imweb_status = 'PURCHASE_CONFIRMATION'`.
  - `pending -> confirmed`: Toss 승인과 Imweb 구매확정이 같은 동기화 구간에서 동시에 확인될 때.
  - `confirmed -> refunded`: `imweb_orders.imweb_status = 'RETURN'` 또는 `toss_settlements.cancel_amount > 0`.
  - `confirmed -> canceled`: 구매확정이 잘못 기록된 후 원천 취소가 뒤늦게 확인된 보정 케이스로만 허용하고 incident로 남긴다.

### pending

- 정의: 주문 또는 결제 시도는 확인됐지만 입금/승인/구매확정이 아직 확인되지 않은 상태이오.

- 판정 근거 필드:
  - `attribution_ledger.payment_status = 'pending'`: 현재 ledger의 실제 상태 enum에 포함되어 있소 (`backend/src/attribution.ts:17`, `backend/src/attribution.ts:140`).
  - `attribution_ledger.touchpoint = 'payment_success'`인데 명시 상태가 없으면 normalize 로직상 pending으로 귀속된다 (`backend/src/attribution.ts:318`, `backend/src/attribution.ts:329`).
  - `toss_transactions.status`: `WAITING_FOR_DEPOSIT`, `PENDING`, `WAITING`, `READY`, `DEPOSIT`, `REQUESTED`, `IN_PROGRESS` 계열은 pending으로 normalize된다 (`backend/src/attribution.ts:176`, `backend/src/attribution.ts:178`).
  - `imweb_orders.imweb_status IN ('PAY_WAIT','STANDBY')`: Imweb status 후보에 실제로 존재한다 (`backend/src/routes/crmLocal.ts:501`, `backend/src/routes/crmLocal.ts:505`).
  - `imweb_orders.order_no`, `order_time`, `payment_amount`, `pay_type`, `pg_type`, `raw_json`, `synced_at`: 주문 생성과 결제 방식 보조 근거로 쓴다 (`backend/src/crmLocalDb.ts:261`, `backend/src/crmLocalDb.ts:283`).

- ROAS/매출 집계 포함 여부 + 예외:
  - 기본 정책: 운영 ROAS에는 제외하오.
  - `pendingRevenue` 또는 `potentialRevenue`에 별도로 표시하오.
  - 예외: 당일 실시간 추정 화면에서는 `confirmedRevenue + pendingRevenue`를 참고값으로 보여줄 수 있으나, ROAS 분자에는 넣지 않소.

- CAPI Purchase 전송 여부 + 조건:
  - 전송하지 않소.
  - 서버 payment decision은 `pending`에 대해 `browserAction='block_purchase_virtual_account'`를 반환한다 (`backend/src/routes/attribution.ts:586`, `backend/src/routes/attribution.ts:590`).
  - existing note도 `confirmed만 allow_purchase`라고 못박고 있소 (`backend/src/routes/attribution.ts:1184`, `backend/src/routes/attribution.ts:1187`).

- 전이 조건:
  - `pending -> paid`: Toss status sync 또는 direct API fallback에서 승인/입금 완료 계열이 확인될 때.
  - `pending -> confirmed`: Imweb `PURCHASE_CONFIRMATION`이 직접 확인될 때.
  - `pending -> canceled`: Toss/Imweb 취소, 실패, 만료가 확인될 때.
  - `pending -> VirtualAccountIssued`: 가상계좌 발급 신호가 확인될 때.
  - attribution status sync는 pending `payment_success` row를 Toss row와 대조해 confirmed/canceled로 갱신한다 (`backend/src/routes/attribution.ts:765`, `backend/src/routes/attribution.ts:784`).

### canceled

- 정의: 결제 실패, 주문 취소, 입금 만료처럼 운영 매출로 잡지 않는 종료 상태이오.

- 판정 근거 필드:
  - `attribution_ledger.payment_status = 'canceled'`: ledger row 변환에서 인정되는 상태이오 (`backend/src/attributionLedgerDb.ts:160`, `backend/src/attributionLedgerDb.ts:167`).
  - `toss_transactions.status`: `CANCEL`, `FAIL`, `ABORT`, `EXPIRE`, `VOID` 계열은 canceled로 normalize된다. 현재 `REFUND`도 canceled keyword에 포함되어 있어 refunded와 분리하려면 Phase 0 후속 변경이 필요하오 (`backend/src/attribution.ts:176`, `backend/src/attribution.ts:178`).
  - `imweb_orders.imweb_status = 'CANCEL'`: Imweb status 후보에 실제로 존재한다 (`backend/src/routes/crmLocal.ts:501`, `backend/src/routes/crmLocal.ts:509`).
  - `toss_settlements.cancel_amount > 0`: 취소/환불 금액 보조 근거로 쓴다 (`backend/src/crmLocalDb.ts:350`, `backend/src/crmLocalDb.ts:363`).
  - `attribution_ledger.metadata_json.status`: 원천 상태 문자열 보조 근거로 쓴다 (`backend/src/attributionLedgerDb.ts:68`, `backend/src/attributionLedgerDb.ts:185`).

- ROAS/매출 집계 포함 여부 + 예외:
  - 기본 정책: 운영 ROAS 매출에는 포함하지 않소.
  - gross-to-net waterfall에서는 취소 금액을 별도 차감 항목으로 노출할 수 있소.
  - 이미 Purchase가 전송된 주문이 canceled로 바뀌면 `Purchase 중복` 또는 `정의 불일치` incident 후보로 본다.

- CAPI Purchase 전송 여부 + 조건:
  - 전송하지 않소.
  - 서버 payment decision은 `canceled`에 대해 `browserAction='block_purchase'`를 반환한다 (`backend/src/routes/attribution.ts:598`, `backend/src/routes/attribution.ts:602`).

- 전이 조건:
  - `pending -> canceled`: 입금 전 취소/실패/만료 확인.
  - `paid -> canceled`: 구매확정 전 결제 취소 확인.
  - `confirmed -> canceled`: 정상 전이가 아니라 데이터 보정 케이스이므로 incident로 남긴다.
  - `canceled -> paid/confirmed`: 원천 데이터 보정 외에는 허용하지 않소.

### refunded

- 정의: 결제 승인 또는 구매확정 이후 고객 환불, 반품, 부분취소가 발생한 상태이오.

- 판정 근거 필드:
  - `imweb_orders.imweb_status = 'RETURN'`: Imweb status 후보에 실제로 존재하므로 운영 refunded의 primary 근거로 둔다 (`backend/src/routes/crmLocal.ts:501`, `backend/src/routes/crmLocal.ts:510`).
  - `toss_settlements.cancel_amount > 0`: PG 환불/부분취소 금액 primary 근거로 둔다 (`backend/src/crmLocalDb.ts:350`, `backend/src/crmLocalDb.ts:363`).
  - `toss_settlements.amount`, `pay_out_amount`, `fee`, `approved_at`, `sold_date`, `paid_out_date`: net revenue와 정산 영향 계산에 쓴다 (`backend/src/crmLocalDb.ts:354`, `backend/src/crmLocalDb.ts:359`).
  - 현재 `attribution_ledger.payment_status`에는 `refunded`가 없으므로 `payment_status='canceled'`와 `metadata_json.status`의 refund 계열 문자열을 함께 읽는 secondary 판정만 가능하오 (`backend/src/attribution.ts:17`, `backend/src/attributionLedgerDb.ts:68`).

- ROAS/매출 집계 포함 여부 + 예외:
  - 기본 정책: gross ROAS에서는 원매출과 환불 금액을 분리하고, net ROAS에서는 `refundedAmount`를 차감하오.
  - 부분환불은 `toss_settlements.cancel_amount`만 차감하고 주문 전체를 0으로 만들지 않소.
  - TJ님이 운영 화면을 gross only로 승인하면 `refundedAmount`는 별도 warning metric으로만 둔다.

- CAPI Purchase 전송 여부 + 조건:
  - Purchase는 전송하지 않소.
  - 이미 Purchase가 성공한 주문이 refunded로 바뀌면 Phase 0에서는 보정 이벤트를 만들지 않고 incident로만 남긴다.
  - 향후 별도 refund/offline adjustment 이벤트가 필요하나 이 문서 범위에서는 설계만 보류하오.

- 전이 조건:
  - `confirmed -> refunded`: Imweb `RETURN` 또는 `toss_settlements.cancel_amount > 0`.
  - `paid -> refunded`: 구매확정 전 PG 환불/부분취소 확인.
  - `pending -> refunded`: 원칙상 직접 전이는 이상치이며 원천 데이터 보정 incident로 남긴다.

### VirtualAccountIssued

- 정의: 가상계좌가 발급됐지만 입금 완료가 확인되지 않은 pending의 하위 상태이오.

- 판정 근거 필드:
  - `toss_transactions.method = '가상계좌'`와 pending 계열 `status`를 조합한다. Toss transaction 컬럼에는 `method`, `status`, `transaction_at`, `amount`가 있다 (`backend/src/crmLocalDb.ts:337`, `backend/src/crmLocalDb.ts:347`).
  - Toss direct payment detail의 `method`, `status`, `virtualAccount` 객체는 route의 decision fallback에서 확인 가능한 외부 API 응답 근거로 둔다.
  - `imweb_orders.pay_type`, `pg_type`, `raw_json`, `imweb_status='PAY_WAIT'`: Imweb 주문에서 가상계좌 결제 방식과 입금 대기를 식별한다 (`backend/src/crmLocalDb.ts:274`, `backend/src/crmLocalDb.ts:283`).
  - `attribution_ledger.payment_status='pending'`와 `metadata_json.status='WAITING_FOR_DEPOSIT'` 또는 `metadata_json.method='가상계좌'`: ledger 보조 근거로 둔다 (`backend/src/attributionLedgerDb.ts:49`, `backend/src/attributionLedgerDb.ts:68`).

- ROAS/매출 집계 포함 여부 + 예외:
  - 기본 정책: 운영 ROAS에는 포함하지 않소.
  - `virtualAccountIssuedAmount`로 별도 집계하오.
  - 예외: 실시간 운영 모니터에서 입금 전 기대 매출을 볼 때만 `potentialRevenue`에 포함하되, ROAS 산식에는 넣지 않소.

- CAPI Purchase 전송 여부 + 조건:
  - Purchase 전송하지 않소.
  - 현재 payment decision은 pending을 `block_purchase_virtual_account`로 낮추는 정책을 둔다 (`backend/src/routes/attribution.ts:586`, `backend/src/routes/attribution.ts:590`).
  - Browser Pixel에서 별도 `VirtualAccountIssued` 이벤트를 보낼지는 frontend/운영 정책 승인 전까지 미정이오.

- 전이 조건:
  - `VirtualAccountIssued -> paid`: Toss status가 입금 완료/승인 계열로 바뀔 때.
  - `VirtualAccountIssued -> confirmed`: 입금 완료 후 Imweb `PURCHASE_CONFIRMATION`까지 확인될 때.
  - `VirtualAccountIssued -> canceled`: 입금 만료, 주문 취소, 실패 확인.
  - `VirtualAccountIssued -> refunded`: 입금 완료 후 부분/전체 환불이 곧바로 확인된 예외 케이스.

## 2. 상태 매핑표 (Source × State)

| Source | paid | confirmed | pending | canceled | refunded | VirtualAccountIssued |
|---|---|---|---|---|---|---|
| Imweb Orders local | `imweb_orders.imweb_status IN ('PAY_COMPLETE','COMPLETE')`, `payment_amount > 0` [secondary] | `imweb_orders.imweb_status = 'PURCHASE_CONFIRMATION'` [primary] | `imweb_orders.imweb_status IN ('PAY_WAIT','STANDBY')` [primary] | `imweb_orders.imweb_status = 'CANCEL'` [primary] | `imweb_orders.imweb_status = 'RETURN'` [primary] | `imweb_status='PAY_WAIT'` and `pay_type/pg_type/raw_json`가 가상계좌를 가리킴 [secondary] |
| Toss Settlements local | `toss_settlements.amount > 0 AND cancel_amount = 0`; 보조로 `toss_transactions.status` 승인 계열 [primary for PG paid] | 구매확정 개념 없음. `approved_at`은 PG 승인 시각일 뿐임 [secondary] | settlement에는 대기 상태 없음 [n/a] | `toss_settlements.cancel_amount > 0`이면 취소/환불 보조 근거 [secondary] | `toss_settlements.cancel_amount > 0` [primary for PG refund amount] | settlement에는 발급 상태 없음. `toss_transactions.method='가상계좌'`가 필요 [n/a] |
| Attribution Ledger | 별도 `paid` 없음. `payment_status='confirmed'` and `metadata_json.status` 승인 계열이면 PG paid로 해석 [secondary] | `payment_status='confirmed'` [secondary] | `payment_status='pending'` [primary for browser decision] | `payment_status='canceled'` [secondary] | 별도 상태 없음. `payment_status='canceled'` and `metadata_json.status` refund 계열 [secondary] | `payment_status='pending'` and `metadata_json.status='WAITING_FOR_DEPOSIT'` 또는 method 가상계좌 [secondary] |
| Meta CAPI log | `event_name='Purchase'`, `response_status BETWEEN 200 AND 299`; 결과 log일 뿐 원천 상태 아님 [secondary] | successful operational Purchase log는 confirmed 처리 결과의 audit [secondary] | Purchase를 보내지 않으므로 상태 표현 없음 [n/a] | Purchase를 보내지 않으므로 상태 표현 없음 [n/a] | refund 보정 이벤트 미구현 [n/a] | Purchase 전송 금지. 별도 event 미정 [n/a] |
| GA4 purchase event | `eventName='purchase'`, `transaction_id/order_id`, `purchaseRevenue` [secondary] | GA4에는 구매확정 개념 없음. 운영 confirmed 비교 reference만 가능 [secondary] | GA4 purchase로 pending 구분 불가 [n/a] | GA4 purchase로 canceled 구분 불가 [n/a] | refund event 별도 구현 확인 전까지 불가 [n/a] | GA4 purchase로 가상계좌 발급 구분 불가 [n/a] |
| Browser Pixel | 서버 decision `allow_purchase` 뒤 Purchase 발화 [secondary] | `payment-decision.browserAction='allow_purchase'` [secondary] | `browserAction='hold_or_block_purchase'` 또는 서버 미확인 [secondary] | `browserAction='block_purchase'` [secondary] | refund pixel 미정 [n/a] | `browserAction='block_purchase_virtual_account'` [secondary] |

사이트별 주석은 다음과 같소.

- `biocom`: Imweb primary는 `imweb_orders.site='biocom'`이오. Toss는 store `biocom`만 적용하오. Meta CAPI는 `META_PIXEL_ID_BIOCOM`, GA4는 `GA4_BIOCOM_PROPERTY_ID`를 쓴다.
- `thecleancoffee`: Imweb primary는 `imweb_orders.site='thecleancoffee'`이오. Toss는 내부 store `coffee`로 매핑하오. Meta CAPI는 `META_PIXEL_ID_COFFEE`, GA4는 `GA4_COFFEE_PROPERTY_ID`를 쓴다.
- `aibio`: Imweb primary는 `imweb_orders.site='aibio'`가 되오. 현재 Toss store enum은 `biocom`, `coffee`뿐이라 aibio Toss는 `n/a`로 둔다 (`backend/src/tossConfig.ts:3`, `backend/src/tossConfig.ts:5`). Meta CAPI는 `META_PIXEL_ID_AIBIO`, GA4는 `GA4_AIBIOCOM_PROPERTY_ID`를 쓴다.
- 모든 사이트에서 attribution ledger의 site 판정은 `source`, `metadata_json.source`, `metadata_json.store`, request origin을 조합해야 하오. 현재 ledger schema에 별도 `site` 컬럼은 없소 (`backend/src/attributionLedgerDb.ts:45`, `backend/src/attributionLedgerDb.ts:70`).

## 3. Freshness 판정 규칙

공통 단계는 다음 네 가지로 고정하오.

- `실시간 추정`: 최근 동기화 또는 API 조회가 매우 가까운 시점에 성공했지만, 당일 숫자는 변동 가능하오.
- `잠정`: 데이터는 쓸 수 있으나 일부 지연, 미확정, pending, 플랫폼 보정 가능성이 있소.
- `확정`: 해당 기간의 상태 전이가 충분히 닫혀 운영 비교에 사용할 수 있소.
- `stale`: 설정 누락, 동기화 지연, 데이터 부족, 실패율 과다로 운영 판단에 쓰면 안 되오.

### GA4

| 단계 | 시간 기준 | 데이터 충분성 기준 | 판정 방법 | stale incident |
|---|---|---|---|---|
| 실시간 추정 | 조회 시각 기준 최근 1시간 이내 GA4 API probe 성공 | 요청 site의 property와 shared service account가 configured | `/health.apis.ga4Properties[site].configured` 확인. `GA4_SERVICE_ACCOUNT_KEY`, `GA4_BIOCOM_SERVICE_ACCOUNT_KEY`, `GA4_BIOCOM_PROPERTY_ID`, `GA4_COFFEE_PROPERTY_ID`, `GA4_AIBIOCOM_PROPERTY_ID`를 사용한다 (`backend/src/health/buildHealthPayload.ts:9`, `backend/src/health/buildHealthPayload.ts:26`). | - |
| 잠정 | 최근 24시간 이내 API probe 성공, 조회 기간이 오늘/어제 포함 | purchase row가 0이어도 API 응답이 정상이고 property가 site와 일치 | GA4 purchase report를 `dateHour`, `eventName='purchase'`, revenue metric으로 조회하고 응답 시각을 캐시하오. background job flag는 없으므로 API probe timestamp를 별도 저장해야 하오. | - |
| 확정 | 조회 종료일이 KST 기준 48시간 이전이고 probe 성공 | purchase count/revenue가 반복 조회에서 1% 이하 변화 | 같은 `site/from/to` report hash를 두 번 비교하오. configured 여부는 `/health.apis.ga4Properties`를 source-of-truth로 둔다. | - |
| stale | 마지막 성공 probe 24시간 초과 또는 property/service account 미설정 | 권한 오류, metric 누락, property 미매핑 | `/health.apis.ga4Properties[site].configured=false` 또는 API error. incident taxonomy는 "freshness 문제" 또는 "토큰/권한 문제"에 매핑하오 (`roadmap/roadmap0415.md:266`, `roadmap/roadmap0415.md:270`). | `freshness 문제`, `토큰/권한 문제` |

### Meta Insights

| 단계 | 시간 기준 | 데이터 충분성 기준 | 판정 방법 | stale incident |
|---|---|---|---|---|
| 실시간 추정 | 최근 1시간 이내 `/api/meta/insights` 또는 `/api/meta/insights/daily` probe 성공 | `spend`, `impressions`, `clicks`가 숫자로 파싱됨 | `/health.apis.meta.ready`가 true여야 하오. env flag는 `META_ADMANAGER_API_KEY`, `META_APP_SECRET_CODE` readiness로 확인한다 (`backend/src/health/buildHealthPayload.ts:95`, `backend/src/health/buildHealthPayload.ts:99`). | - |
| 잠정 | 최근 24시간 이내 성공, 오늘/어제 포함 | spend가 0이어도 account/campaign 응답은 정상 | Meta Insights를 `action_report_time=conversion`, attribution window 기준으로 조회하고 generatedAt을 저장하오. | - |
| 확정 | 조회 종료일이 KST 기준 72시간 이전 | spend와 actions/action_values가 반복 조회에서 1% 이하 변화 | `/api/meta/insights/daily?since=&until=` 결과 합계를 캐시 비교하오. | - |
| stale | token 미설정/권한 오류 또는 마지막 성공 probe 24시간 초과 | Graph error, spend/actions 모두 누락 | `/health.apis.meta.ready=false` 또는 Meta Graph error. incident taxonomy는 "freshness 문제" 또는 "토큰/권한 문제"에 매핑하오 (`roadmap/roadmap0415.md:266`, `roadmap/roadmap0415.md:270`). | `freshness 문제`, `토큰/권한 문제` |

### Meta CAPI log

| 단계 | 시간 기준 | 데이터 충분성 기준 | 판정 방법 | stale incident |
|---|---|---|---|---|
| 실시간 추정 | 최신 successful operational log가 `CAPI_AUTO_SYNC_INTERVAL_MS + 10분` 이내 | confirmed ledger 후보가 없거나, 후보별 successful/skip 사유가 존재 | `/health.backgroundJobs.capiAutoSync.enabled`, `intervalMs`, `limit`를 확인한다 (`backend/src/health/buildHealthPayload.ts:43`, `backend/src/health/buildHealthPayload.ts:47`). CAPI log는 `META_CAPI_LOG_PATH` JSONL을 읽는다 (`backend/src/metaCapi.ts:929`, `backend/src/metaCapi.ts:931`). | - |
| 잠정 | 최신 successful operational log가 2 interval 이내 | failure rate 5% 이하, duplicate order-event group이 조사 중 이하 | `response_status 2xx`, `classifyMetaCapiLogSegment(row)==operational`, `send_path='auto_sync'` 조건을 쓴다 (`backend/src/metaCapi.ts:1265`, `backend/src/metaCapi.ts:1273`). | - |
| 확정 | 조회 종료 후 2시간 경과, ledger confirmed 후보가 모두 성공 또는 중복 skip | `orderId + eventName` 단위 성공 이력이 존재 | sync 후보는 `payment_success/live/confirmed`만이다 (`backend/src/metaCapi.ts:254`, `backend/src/metaCapi.ts:267`). log record의 `event_id`, `response_status`, `send_path`를 확인한다 (`backend/src/metaCapi.ts:92`, `backend/src/metaCapi.ts:103`). | - |
| stale | 최신 successful operational log가 2 interval 초과, lock stale, 실패율 20% 초과 | confirmed 후보가 있는데 성공 log 없음 | `CAPI_AUTO_SYNC_ENABLED=false`, Meta token missing, or log parse failure. incident taxonomy는 "freshness 문제", "Purchase 누락", "Purchase 중복", "토큰/권한 문제"에 매핑하오 (`roadmap/roadmap0415.md:266`, `roadmap/roadmap0415.md:270`). | `freshness 문제`, `Purchase 누락`, `Purchase 중복`, `토큰/권한 문제` |

### Imweb Orders (local DB)

| 단계 | 시간 기준 | 데이터 충분성 기준 | 판정 방법 | stale incident |
|---|---|---|---|---|
| 실시간 추정 | `MAX(imweb_orders.synced_at)`가 `IMWEB_AUTO_SYNC_INTERVAL_MS + 10분` 이내 | site별 row가 존재하고 `order_no`, `payment_amount`, `order_time`이 비어 있지 않음 | `/health.backgroundJobs.imwebAutoSync.enabled`, `intervalMs`, `maxPage` 확인 (`backend/src/health/buildHealthPayload.ts:48`, `backend/src/health/buildHealthPayload.ts:52`). Query: `SELECT MAX(synced_at), COUNT(*) FROM imweb_orders WHERE site=?`. | - |
| 잠정 | `MAX(synced_at)`는 24시간 이내이나 `MAX(imweb_status_synced_at)`가 없거나 24시간 초과 | 주문 원장은 최신이나 상태별 confirmed/canceled/refunded 판단은 보류 | `imweb_orders` schema의 `synced_at`와 ensureColumn의 `imweb_status_synced_at`를 함께 본다 (`backend/src/crmLocalDb.ts:258`, `backend/src/crmLocalDb.ts:283`; `backend/src/routes/crmLocal.ts:795`, `backend/src/routes/crmLocal.ts:797`). | - |
| 확정 | 조회 종료일이 24시간 이전이고 `MAX(imweb_status_synced_at)`가 24시간 이내 | `PURCHASE_CONFIRMATION`, `CANCEL`, `RETURN`, `PAY_WAIT` 분포가 조회됨 | `/api/crm-local/imweb/purchase-confirm-stats`와 같은 분포 query를 기준으로 한다 (`backend/src/routes/crmLocal.ts:1239`, `backend/src/routes/crmLocal.ts:1258`). | - |
| stale | `IMWEB_AUTO_SYNC_ENABLED=false`, API credential missing, `synced_at` 24시간 초과 | site row 0건 또는 token 실패 | `/health.apis.imweb.ready`, `IMWEB_API_KEY`, `IMWEB_SECRET_KEY`, `IMWEB_AUTO_SYNC_ENABLED` 확인 (`backend/src/health/buildHealthPayload.ts:100`, `backend/src/health/buildHealthPayload.ts:103`). incident taxonomy는 "freshness 문제" 또는 "토큰/권한 문제"에 매핑하오. | `freshness 문제`, `토큰/권한 문제` |

### Toss Settlements (local DB)

| 단계 | 시간 기준 | 데이터 충분성 기준 | 판정 방법 | stale incident |
|---|---|---|---|---|
| 실시간 추정 | `MAX(toss_transactions.synced_at, toss_settlements.synced_at)`가 `TOSS_AUTO_SYNC_INTERVAL_MS + 10분` 이내 | biocom/coffee store의 transaction 또는 settlement row가 있음 | `/health.backgroundJobs.tossAutoSync.enabled`, `intervalMs`, `windowHours` 확인 (`backend/src/health/buildHealthPayload.ts:53`, `backend/src/health/buildHealthPayload.ts:57`). Query: `SELECT MAX(synced_at), COUNT(*) FROM toss_settlements`. | - |
| 잠정 | 최신 sync 24시간 이내이나 당일/전일 정산이 아직 닫히지 않음 | `toss_transactions`는 있으나 `toss_settlements`가 일부 누락될 수 있음 | local schema의 `toss_transactions.status/transaction_at/synced_at`와 `toss_settlements.approved_at/sold_date/paid_out_date/synced_at`를 함께 본다 (`backend/src/crmLocalDb.ts:337`, `backend/src/crmLocalDb.ts:363`). | - |
| 확정 | 조회 종료일이 48시간 이전이고 transaction/settlement 양쪽 조회 가능 | `amount`, `fee`, `pay_out_amount`, `cancel_amount` 합계 계산 가능 | Query: `SELECT SUM(amount), SUM(cancel_amount), MAX(synced_at) FROM toss_settlements`. store별 readiness는 `/health.apis.toss.stores`로 본다 (`backend/src/health/buildHealthPayload.ts:88`, `backend/src/health/buildHealthPayload.ts:94`). | - |
| stale | `TOSS_AUTO_SYNC_ENABLED=false`, key missing, latest sync 24시간 초과, API 오류 | store별 row 0건인데 해당 site가 Toss 대상임 | `TOSS_LIVE_SECRET_KEY`, `TOSS_LIVE_SECRET_KEY_BIOCOM`, `TOSS_LIVE_SECRET_KEY_COFFEE`, `TOSS_AUTO_SYNC_ENABLED` 확인. incident taxonomy는 "freshness 문제" 또는 "토큰/권한 문제"에 매핑하오 (`roadmap/roadmap0415.md:266`, `roadmap/roadmap0415.md:270`). | `freshness 문제`, `토큰/권한 문제` |

### Attribution Ledger

| 단계 | 시간 기준 | 데이터 충분성 기준 | 판정 방법 | stale incident |
|---|---|---|---|---|
| 실시간 추정 | `MAX(logged_at)`가 최근 1시간 이내 또는 같은 기간 주문 없음이 Imweb/Toss로 확인됨 | `payment_success` 후보가 있고 `order_id` 또는 `payment_key` 중 하나 이상 존재 | ledger schema의 `logged_at`, `touchpoint`, `payment_status`, `order_id`, `payment_key`를 본다 (`backend/src/attributionLedgerDb.ts:45`, `backend/src/attributionLedgerDb.ts:83`). | - |
| 잠정 | 최신 ledger 24시간 이내이나 pending 비율이 높거나 status sync 미완 | `pending/confirmed/canceled` 분포 조회 가능 | actual enum은 `pending | confirmed | canceled`이고 Zod schema도 동일하다 (`backend/src/attribution.ts:17`, `backend/src/attribution.ts:160`). | - |
| 확정 | 조회 종료 이후 `ATTRIBUTION_STATUS_SYNC_INTERVAL_MS * 2` 경과, aged pending 없음 | 2시간 초과 pending이 0이거나 모두 no-match 사유 보유 | `/health.backgroundJobs.attributionStatusSync.enabled`, `intervalMs`, `limit` 확인 (`backend/src/health/buildHealthPayload.ts:38`, `backend/src/health/buildHealthPayload.ts:42`). status sync는 pending row를 Toss와 대조해 갱신한다 (`backend/src/routes/attribution.ts:765`, `backend/src/routes/attribution.ts:784`). | - |
| stale | 최신 ledger 24시간 초과인데 Imweb/Toss에는 신규 주문 존재, 또는 pending aged 과다 | identity 필드 `gaSessionId/clientId/userPseudoId` 커버리지 급락 | Query: `SELECT MAX(logged_at), COUNT(*) FROM attribution_ledger WHERE touchpoint='payment_success'`. incident taxonomy는 "Purchase 누락", "광고 매칭 부족", "freshness 문제"에 매핑하오 (`roadmap/roadmap0415.md:266`, `roadmap/roadmap0415.md:269`). | `freshness 문제`, `Purchase 누락`, `광고 매칭 부족` |

### CRM Local DB

| 단계 | 시간 기준 | 데이터 충분성 기준 | 판정 방법 | stale incident |
|---|---|---|---|---|
| 실시간 추정 | 핵심 테이블 중 하나 이상이 최근 sync interval 이내 갱신 | `imweb_orders`, `toss_transactions`, `toss_settlements`, `attribution_ledger` 중 대상 source row 존재 | `/health.apis.crmLocal`는 `getDbStats()`로 생성된다 (`backend/src/health/buildHealthPayload.ts:110`, `backend/src/health/buildHealthPayload.ts:116`). | - |
| 잠정 | SQLite 접근 가능, 일부 source만 24시간 이내 갱신 | 개발/검증용으로만 사용, 운영 판정에는 VM DB 필요 | `CRM_LOCAL_DB_PATH`와 각 table `COUNT(*)`, `MAX(synced_at/logged_at)`를 조회한다. | - |
| 확정 | VM DB에서 모든 필요한 source가 final이고 local DB는 검증 mirror로만 쓰임 | local/VM row count 또는 hash 차이가 허용 범위 이내 | Phase 0 contract에는 local-vs-VM 비교 결과 필드를 두되, 실제 운영 판정은 VM DB만 신뢰하오. | - |
| stale | DB init 실패, WAL 접근 실패, 핵심 table count 0, max timestamp 24시간 초과 | `/health.apis.crmLocal.error` 또는 table missing | `getCrmDb()`, `getDbStats()`, SQLite schema check. incident taxonomy는 "freshness 문제" 또는 "토큰/권한 문제"에 매핑하오 (`roadmap/roadmap0415.md:266`, `roadmap/roadmap0415.md:270`). | `freshness 문제`, `토큰/권한 문제` |

## 4. Backend Contract 설계

공통 타입은 다음과 같소.

```ts
type Site = "biocom" | "thecleancoffee" | "aibio";

type ConversionState =
  | "paid"
  | "confirmed"
  | "pending"
  | "canceled"
  | "refunded"
  | "VirtualAccountIssued";

type TruthRank = "primary" | "secondary" | "n/a";

type FreshnessLevel = "실시간 추정" | "잠정" | "확정" | "stale";

type IncidentTaxonomy =
  | "정의 불일치"
  | "freshness 문제"
  | "Purchase 중복"
  | "Purchase 누락"
  | "광고 매칭 부족"
  | "토큰/권한 문제";
```

### GET /api/integrity/health

목적: GA4, Meta, Imweb, Toss, CAPI, ledger, CRM local DB의 freshness와 설정 상태를 한 번에 판단하오.

요청 파라미터 스키마:

```ts
interface IntegrityHealthQuery {
  site?: Site;
  includeEvidence?: "0" | "1";
}
```

응답 TypeScript type:

```ts
interface IntegrityHealthResponse {
  ok: true;
  version: "phase0.integrity.health.v1";
  generatedAt: string;
  service: string;
  sites: Site[];
  backgroundJobs: {
    enabled: boolean;
    cwvAutoSync: { enabled: boolean };
    attributionStatusSync: { enabled: boolean; intervalMs: number; limit: number };
    capiAutoSync: { enabled: boolean; intervalMs: number; limit: number };
    imwebAutoSync: { enabled: boolean; intervalMs: number; maxPage: number };
    tossAutoSync: { enabled: boolean; intervalMs: number; windowHours: number };
  };
  sources: IntegritySourceHealth[];
}

interface IntegritySourceHealth {
  source:
    | "ga4"
    | "meta_insights"
    | "meta_capi_log"
    | "imweb_orders_local"
    | "toss_settlements_local"
    | "attribution_ledger"
    | "crm_local_db";
  site: Site | "all";
  freshness: FreshnessLevel;
  configured: boolean;
  lastObservedAt: string | null;
  lastSyncedAt: string | null;
  dataSufficiency: {
    ok: boolean;
    rowCount?: number;
    successCount?: number;
    failureCount?: number;
    missingRequiredFields?: string[];
  };
  checks: Array<{
    name: string;
    ok: boolean;
    detail: string;
  }>;
  incidents: Array<{
    taxonomy: IncidentTaxonomy;
    code: string;
    severity: "info" | "warning" | "critical";
    message: string;
  }>;
  evidence?: Record<string, unknown>;
}
```

최소 JSON 샘플:

```json
{
  "ok": true,
  "version": "phase0.integrity.health.v1",
  "generatedAt": "2026-04-16T00:30:00.000+09:00",
  "service": "biocom-seo-backend",
  "sites": ["biocom", "thecleancoffee", "aibio"],
  "backgroundJobs": {
    "enabled": true,
    "cwvAutoSync": { "enabled": false },
    "attributionStatusSync": { "enabled": true, "intervalMs": 900000, "limit": 100 },
    "capiAutoSync": { "enabled": true, "intervalMs": 1800000, "limit": 100 },
    "imwebAutoSync": { "enabled": true, "intervalMs": 900000, "maxPage": 30 },
    "tossAutoSync": { "enabled": true, "intervalMs": 900000, "windowHours": 6 }
  },
  "sources": [
    {
      "source": "imweb_orders_local",
      "site": "biocom",
      "freshness": "잠정",
      "configured": true,
      "lastObservedAt": "2026-04-16T00:20:00.000+09:00",
      "lastSyncedAt": "2026-04-16T00:20:00.000+09:00",
      "dataSufficiency": {
        "ok": true,
        "rowCount": 12840,
        "missingRequiredFields": ["imweb_status_synced_at"]
      },
      "checks": [
        {
          "name": "imweb_auto_sync_enabled",
          "ok": true,
          "detail": "IMWEB_AUTO_SYNC_ENABLED=true"
        }
      ],
      "incidents": [
        {
          "taxonomy": "freshness 문제",
          "code": "freshness.imweb_status.provisional",
          "severity": "warning",
          "message": "주문 원장은 최신이나 상태 라벨 동기화가 확정 기준을 만족하지 못하오."
        }
      ]
    }
  ]
}
```

에러 케이스 3개:

- `400 invalid_site`: `site`가 `biocom|thecleancoffee|aibio`가 아닐 때.
- `503 source_probe_failed`: source probe 중 하나가 timeout이고 stale cache도 없을 때.
- `500 integrity_health_build_failed`: DB schema 또는 JSONL log parse 오류로 health payload를 만들 수 없을 때.

### GET /api/integrity/dictionary

목적: Conversion Dictionary v1을 frontend와 에이전트가 같은 기준으로 참조하게 하오.

요청 파라미터 스키마:

```ts
interface IntegrityDictionaryQuery {
  version?: "v1";
  locale?: "ko-KR";
}
```

응답 TypeScript type:

```ts
interface IntegrityDictionaryResponse {
  ok: true;
  version: "v1";
  generatedAt: string;
  states: ConversionDictionaryState[];
}

interface ConversionDictionaryState {
  state: ConversionState;
  definition: string;
  basisFields: BasisFieldRule[];
  revenuePolicy: {
    roasIncluded: boolean;
    defaultBucket:
      | "confirmedRevenue"
      | "paidRevenue"
      | "pendingRevenue"
      | "virtualAccountIssuedAmount"
      | "refundedAmount"
      | "excluded";
    exceptions: string[];
  };
  capiPurchasePolicy: {
    send: boolean;
    condition: string;
  };
  transitions: Array<{
    from: ConversionState | "unknown";
    to: ConversionState;
    condition: string;
    source: string;
  }>;
}

interface BasisFieldRule {
  source:
    | "imweb_orders"
    | "toss_transactions"
    | "toss_settlements"
    | "attribution_ledger"
    | "meta_capi_log"
    | "ga4_purchase_event"
    | "browser_pixel";
  fields: string[];
  expression: string;
  truthRank: TruthRank;
}
```

최소 JSON 샘플:

```json
{
  "ok": true,
  "version": "v1",
  "generatedAt": "2026-04-16T00:30:00.000+09:00",
  "states": [
    {
      "state": "confirmed",
      "definition": "운영 매출과 ROAS 분자로 잠글 수 있는 구매확정 상태이오.",
      "basisFields": [
        {
          "source": "imweb_orders",
          "fields": ["site", "order_no", "payment_amount", "imweb_status", "imweb_status_synced_at"],
          "expression": "imweb_status = 'PURCHASE_CONFIRMATION'",
          "truthRank": "primary"
        },
        {
          "source": "attribution_ledger",
          "fields": ["payment_status", "order_id", "payment_key", "approved_at", "metadata_json"],
          "expression": "payment_status = 'confirmed'",
          "truthRank": "secondary"
        }
      ],
      "revenuePolicy": {
        "roasIncluded": true,
        "defaultBucket": "confirmedRevenue",
        "exceptions": ["배송비/VAT 제외 여부는 TJ님 승인 후 별도 산식으로 고정하오."]
      },
      "capiPurchasePolicy": {
        "send": true,
        "condition": "touchpoint='payment_success' AND captureMode='live' AND paymentStatus='confirmed' AND no successful operational CAPI log"
      },
      "transitions": [
        {
          "from": "paid",
          "to": "confirmed",
          "condition": "imweb_orders.imweb_status = 'PURCHASE_CONFIRMATION'",
          "source": "Imweb Orders local"
        }
      ]
    }
  ]
}
```

에러 케이스 3개:

- `400 unsupported_dictionary_version`: `version`이 `v1`이 아닐 때.
- `406 unsupported_locale`: `locale`이 `ko-KR`이 아닐 때.
- `500 dictionary_contract_build_failed`: dictionary artifact를 구성하지 못할 때.

### GET /api/integrity/source-of-truth?site=<biocom|thecleancoffee|aibio>

목적: site별 어느 source가 어느 상태의 정본인지 반환하오.

요청 파라미터 스키마:

```ts
interface IntegritySourceOfTruthQuery {
  site: Site;
}
```

응답 TypeScript type:

```ts
interface IntegritySourceOfTruthResponse {
  ok: true;
  version: "phase0.source_of_truth.v1";
  generatedAt: string;
  site: Site;
  rules: StateSourceTruthRule[];
}

interface StateSourceTruthRule {
  state: ConversionState;
  primary: SourceTruthExpression[];
  secondary: SourceTruthExpression[];
  notApplicable: string[];
  siteNotes: string[];
}

interface SourceTruthExpression {
  source:
    | "imweb_orders_local"
    | "toss_transactions_local"
    | "toss_settlements_local"
    | "attribution_ledger"
    | "meta_capi_log"
    | "ga4_purchase_event"
    | "browser_pixel";
  expression: string;
  fields: string[];
}
```

최소 JSON 샘플:

```json
{
  "ok": true,
  "version": "phase0.source_of_truth.v1",
  "generatedAt": "2026-04-16T00:30:00.000+09:00",
  "site": "thecleancoffee",
  "rules": [
    {
      "state": "paid",
      "primary": [
        {
          "source": "toss_transactions_local",
          "expression": "store='coffee' AND status IN confirmed keyword group",
          "fields": ["payment_key", "order_id", "status", "transaction_at", "amount"]
        },
        {
          "source": "toss_settlements_local",
          "expression": "store='coffee' AND amount > 0 AND cancel_amount = 0",
          "fields": ["payment_key", "order_id", "amount", "approved_at", "cancel_amount"]
        }
      ],
      "secondary": [
        {
          "source": "imweb_orders_local",
          "expression": "site='thecleancoffee' AND imweb_status IN ('PAY_COMPLETE','COMPLETE')",
          "fields": ["site", "order_no", "imweb_status", "payment_amount"]
        }
      ],
      "notApplicable": [],
      "siteNotes": ["Toss 내부 store는 thecleancoffee가 아니라 coffee로 매핑하오."]
    }
  ]
}
```

에러 케이스 3개:

- `400 invalid_site`: `site` enum 불일치.
- `404 source_policy_not_found`: site는 유효하지만 source-of-truth policy가 아직 정의되지 않았을 때.
- `409 source_unconfigured`: policy는 있으나 필수 credential 또는 local table이 없어 적용할 수 없을 때.

### GET /api/integrity/summary?site=&from=&to=

목적: source freshness와 상태 정의 차이를 반영해 정합성 점수, 영향 광고비, 영향 매출을 산출하오.

요청 파라미터 스키마:

```ts
interface IntegritySummaryQuery {
  site: Site;
  from: string; // YYYY-MM-DD, KST inclusive
  to: string;   // YYYY-MM-DD, KST inclusive
  definitionVersion?: "v1";
}
```

응답 TypeScript type:

```ts
interface IntegritySummaryResponse {
  ok: true;
  version: "phase0.integrity.summary.v1";
  definitionVersion: "v1";
  generatedAt: string;
  site: Site;
  range: {
    from: string;
    to: string;
    timezone: "Asia/Seoul";
  };
  score: {
    overall: number;
    formula: "weighted_average";
    components: IntegrityScoreComponent[];
  };
  revenue: {
    confirmedRevenue: number;
    paidRevenue: number;
    pendingRevenue: number;
    virtualAccountIssuedAmount: number;
    refundedAmount: number;
    netRevenue: number;
    primarySource: string;
  };
  advertising: {
    metaSpend: number;
    impactAdSpend: number;
    impactAdSpendDefinition: string;
  };
  impact: {
    impactRevenue: number;
    impactRevenueDefinition: string;
    incidentCount: number;
    criticalIncidentCount: number;
  };
  incidents: IntegritySummaryIncident[];
}

interface IntegrityScoreComponent {
  key:
    | "freshness"
    | "definitionCoverage"
    | "revenueReconciliation"
    | "eventCompleteness"
    | "identityCoverage";
  weight: number;
  score: number;
  formula: string;
  evidence: Record<string, number | string | null>;
}

interface IntegritySummaryIncident {
  id: string;
  taxonomy: IncidentTaxonomy;
  code: string;
  severity: "info" | "warning" | "critical";
  affectedState?: ConversionState;
  affectedRevenue?: number;
  affectedAdSpend?: number;
}
```

정합성 점수 산식:

```text
overall =
  freshness.score * 0.30
  + definitionCoverage.score * 0.20
  + revenueReconciliation.score * 0.25
  + eventCompleteness.score * 0.15
  + identityCoverage.score * 0.10
```

컴포넌트 산식:

- `freshness.score`: source별 `확정=100`, `실시간 추정=85`, `잠정=70`, `stale=0`을 중요도 가중 평균하오.
- `definitionCoverage.score`: 상태별 primary source가 있으면 100, secondary만 있으면 60, n/a면 30, 충돌이면 0으로 계산하오.
- `revenueReconciliation.score`: `100 - min(abs(primaryConfirmedRevenue - comparableSecondaryRevenue) / max(primaryConfirmedRevenue, 1) * 100, 100)`.
- `eventCompleteness.score`: `100 - min(missingPurchaseCount / max(primaryConfirmedOrders, 1) * 100, 100)`.
- `identityCoverage.score`: `gaSessionId`, `clientId`, `userPseudoId` coverage 평균으로 계산하오.

영향 필드 정의:

- `impactAdSpend`: stale 또는 critical incident가 걸린 기간/캠페인의 Meta Insights `spend` 합계이오.
- `impactRevenue`: `abs(primaryConfirmedRevenue - comparableSecondaryRevenue) + stalePendingRevenue + duplicatePurchaseRevenue + missingPurchaseRevenue`이오.
- `confirmedRevenue`: source-of-truth의 confirmed primary source 금액 합계이오. 기본은 `imweb_orders.payment_amount` 중 `PURCHASE_CONFIRMATION`.
- `paidRevenue`: PG paid source 금액 합계이오. `biocom/thecleancoffee`는 Toss, `aibio`는 Imweb paid 보조 기준을 쓴다.
- `netRevenue`: `confirmedRevenue - refundedAmount`이며 배송비/VAT 제외 전 기준이오.

최소 JSON 샘플:

```json
{
  "ok": true,
  "version": "phase0.integrity.summary.v1",
  "definitionVersion": "v1",
  "generatedAt": "2026-04-16T00:30:00.000+09:00",
  "site": "biocom",
  "range": { "from": "2026-04-15", "to": "2026-04-15", "timezone": "Asia/Seoul" },
  "score": {
    "overall": 82.5,
    "formula": "weighted_average",
    "components": [
      {
        "key": "freshness",
        "weight": 0.3,
        "score": 70,
        "formula": "source_weighted_status_score",
        "evidence": { "staleSources": "imweb_status", "finalSources": "toss_settlements" }
      },
      {
        "key": "revenueReconciliation",
        "weight": 0.25,
        "score": 88,
        "formula": "100 - min(abs(primary-secondary)/max(primary,1)*100,100)",
        "evidence": { "primaryConfirmedRevenue": 1250000, "secondaryPaidRevenue": 1310000 }
      }
    ]
  },
  "revenue": {
    "confirmedRevenue": 1250000,
    "paidRevenue": 1310000,
    "pendingRevenue": 180000,
    "virtualAccountIssuedAmount": 50000,
    "refundedAmount": 30000,
    "netRevenue": 1220000,
    "primarySource": "imweb_orders.PURCHASE_CONFIRMATION"
  },
  "advertising": {
    "metaSpend": 410000,
    "impactAdSpend": 120000,
    "impactAdSpendDefinition": "critical/stale incident가 걸린 캠페인 또는 날짜의 Meta spend 합계"
  },
  "impact": {
    "impactRevenue": 240000,
    "impactRevenueDefinition": "source 차이 + stale pending + missing/duplicate purchase 영향 금액",
    "incidentCount": 2,
    "criticalIncidentCount": 0
  },
  "incidents": [
    {
      "id": "inc_20260415_biocom_imweb_status",
      "taxonomy": "freshness 문제",
      "code": "freshness.imweb_status.provisional",
      "severity": "warning",
      "affectedState": "confirmed",
      "affectedRevenue": 180000,
      "affectedAdSpend": 120000
    }
  ]
}
```

에러 케이스 3개:

- `400 invalid_date_range`: `from/to` 형식이 `YYYY-MM-DD`가 아니거나 `from > to`일 때.
- `400 invalid_site`: `site` enum 불일치.
- `409 insufficient_primary_source`: 해당 site/range에서 primary source가 stale 또는 미구성이라 summary 점수를 산출할 수 없을 때.

## 5. 검증/미해결

코드 증거는 다음과 같소.

- `roadmap/roadmap0415.md:168` - Phase 0 산출물로 Conversion Dictionary, freshness 정책, site별 source-of-truth가 명시되어 있소.
- `roadmap/roadmap0415.md:256` - Phase 2 권장 backend surface에 `/api/integrity/health`, `/api/integrity/summary`, incident 계열 API가 명시되어 있소.
- `backend/src/health/buildHealthPayload.ts:33` - health payload가 `BACKGROUND_JOBS_ENABLED`, `CWV_AUTO_SYNC_ENABLED`, `ATTRIBUTION_STATUS_SYNC_ENABLED`, `CAPI_AUTO_SYNC_ENABLED`, `IMWEB_AUTO_SYNC_ENABLED`, `TOSS_AUTO_SYNC_ENABLED`를 노출하오.
- `backend/src/attribution.ts:17` - attribution ledger의 실제 payment status enum은 `pending | confirmed | canceled`뿐이오.
- `backend/src/routes/crmLocal.ts:501` - Imweb status 후보에 `PAY_WAIT`, `PAY_COMPLETE`, `COMPLETE`, `PURCHASE_CONFIRMATION`, `CANCEL`, `RETURN`이 포함되어 있소.

아직 확인이 필요한 가정은 다음과 같소.

- `aibio`의 attribution ledger row가 실제 운영에서 들어오는지 미확인이오.
- `aibio`의 Toss 결제 경로는 현재 `tossConfig` 기준 store가 없어 `n/a`로 두었소.
- `imweb_orders.imweb_status_synced_at`는 ensureColumn으로 추가되지만, 주문 자동 동기화와 상태 동기화가 같은 주기로 항상 돈다고 보장하지 않소.
- GA4 purchase event의 `transaction_id`가 Imweb `order_no` 또는 Toss `order_id`와 항상 같은지 미확인이오.
- Browser Pixel에서 `VirtualAccountIssued` 별도 이벤트를 실제 발화할지는 frontend 정책 승인 전까지 미정이오.
- VM DB와 로컬 Mac DB의 동기화/차이 검증 쿼리는 아직 별도 구현되어 있지 않소.

TJ님 승인 필요 항목은 다음과 같소.

- 운영 `confirmed` 기준을 Imweb `PURCHASE_CONFIRMATION`으로 확정할지, Toss PG 승인으로 둘지 결정이 필요하오.
- `paid`를 운영 ROAS에서 제외하고 `paidRevenue/provisionalRevenue`로만 둘지 승인 필요하오.
- 환불/부분환불을 gross ROAS에서 분리 표시하고 net ROAS에서 차감하는 정책 승인 필요하오.
- 배송비/VAT를 `payment_amount`에서 제외할지, 포함할지 승인 필요하오.
- CAPI Purchase 전송 기준을 `confirmed only`로 잠글지, PG paid도 허용할지 승인 필요하오.
- aibio의 Toss 결제 source-of-truth를 `n/a`로 유지할지, 별도 Toss store/env를 추가할지 승인 필요하오.
