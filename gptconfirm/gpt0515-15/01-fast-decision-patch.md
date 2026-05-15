# Fast Decision Patch

작성 시각: 2026-05-15 12:18 KST

## 10초 요약

카드 결제완료 화면에서 Browser Purchase가 막힌 직접 병목은 `payment-decision` 응답이 3초를 넘는 것이었다. 이번 패치는 운영DB sync와 Toss API를 기다리기 전에 VM Cloud SQLite 보조 원장에서 exact confirmed row를 먼저 찾아 빠르게 `allow_purchase`를 반환한다.

## 무엇을 바꿨나

- `backend/src/attributionLedgerDb.ts`
  - `listAttributionLedgerPaymentDecisionCandidates` 추가.
  - `payment_key`, `order_id`, 완료 URL의 `order_code/payment_code` 토큰으로 `payment_success` row만 제한 조회한다.
  - 전체 원장 read보다 작은 후보만 먼저 읽는다.
- `backend/src/routes/attribution.ts`
  - `buildFastLedgerPaymentDecision` 추가.
  - `payment-decision` route에서 fast path를 먼저 시도한다.
  - 조건 통과 시 운영DB/Toss/full ledger fallback 전에 응답한다.

## allow 조건

- source: VM Cloud SQLite `attribution_ledger`.
- touchpoint: `payment_success`.
- captureMode: `live`.
- paymentStatus: `confirmed`.
- amount/value: 양수.
- 취소/환불 flag 또는 refund amount 없음.
- exact key match: paymentKey/orderNo/orderCode/paymentCode 중 하나.

## block 조건

- pending exact match: `block_purchase_virtual_account`.
- canceled/refund exact match: `block_purchase`.
- unknown 또는 value 없음: fast path로 allow하지 않고 기존 fallback으로 넘긴다.

## 검증

- 로컬 테스트: `node --import tsx --test tests/attribution.test.ts` PASS.
- typecheck/build: PASS.
- VM Cloud read-only dry-run: 11,900원 카드 결제 row 1건이 새 기준에서 candidate 1건.

## 배포 승인안

- Lane: Yellow.
- 대상 파일:
  - `backend/src/attributionLedgerDb.ts`
  - `backend/src/routes/attribution.ts`
  - `backend/src/metaCapi.ts`
  - `backend/tests/attribution.test.ts`는 운영 배포 대상 아님.
- 순서:
  1. pre-snapshot: health, payment-decision sample, CAPI candidate dry-run.
  2. VM Cloud backend backup.
  3. 파일 배포.
  4. `npm run typecheck && npm run build`.
  5. `seo-backend` restart.
  6. post-snapshot.
- 성공 기준:
  - `/api/health` 200.
  - target card row payment-decision `fastPath.returned=true`.
  - `/shop_payment/` progress URL은 payment_success로 신규 기록되지 않음.
  - Meta CAPI send 0.
- 실패 조건:
  - API 5xx.
  - pending/unknown이 `allow_purchase`로 바뀜.
  - candidate가 대량 증가.
  - raw identifier 노출.
