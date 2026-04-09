# #1 작업 결과

작업일시: 2026-04-06  
대상: `next0406.md`의 `#1 attribution ledger DB 승격 + payment_status`

## 읽은 문서

- `next0406.md`
- `roadmap/phase1.md`
- `roadmap/phase5.md`
- `data/datacheck0406.md`
- `data/gptfeedback0406_1.md`

핵심 요구는 아래로 해석했음.

- attribution ledger를 JSONL 임시 파일에서 정식 SQLite 테이블로 승격
- `payment_status`를 `pending / confirmed / canceled`로 분리
- `WAITING_FOR_DEPOSIT` 같은 미입금 가상계좌가 매출/ROAS에 잡히지 않도록 집계 기준을 변경

## 구현 내용

### 1. ledger 저장소 DB 승격

- 신규 파일 `backend/src/attributionLedgerDb.ts` 추가
- SQLite `backend/data/crm.sqlite3` 안에 `attribution_ledger` 테이블 생성
- 기본 저장 경로를 JSONL이 아니라 SQLite 테이블로 전환
- 기존 JSONL `backend/logs/checkout-attribution-ledger.jsonl`은
  - 테스트/override 경로로 유지
  - 기본 읽기/쓰기 진입 시 1회 마이그레이션 소스로 사용

### 2. payment_status 도입

- `backend/src/attribution.ts`
  - `AttributionPaymentStatus = "pending" | "confirmed" | "canceled"` 추가
  - `AttributionLedgerEntry.paymentStatus` 추가
  - `metadata.status`, `paymentStatus`, `payment_status` 값을 해석해 상태를 결정
  - `payment_success`인데 상태 정보가 없으면 기본값을 `pending`으로 둠
  - `buildLedgerSummary()`에 `paymentSuccessByPaymentStatus` 추가

상태 매핑 기준:

- `DONE`, `PAID`, `APPROVED`, `SUCCESS`, `COMPLETED` 계열 -> `confirmed`
- `WAITING_FOR_DEPOSIT`, `PENDING`, `READY`, `REQUESTED` 계열 -> `pending`
- `CANCELED`, `FAIL`, `REFUND`, `VOID` 계열 -> `canceled`

### 3. 광고 매출 집계 기준 변경

- `backend/src/routes/ads.ts`
  - 주문 정규화 결과에 `paymentStatus` 추가
  - 주문별 최종 상태는 보수적으로 `canceled > confirmed > pending` 우선순위로 결정
  - `completed`는 `paymentStatus === "confirmed"`일 때만 `true`
  - 캠페인 ROAS / 일별 ROAS 계산 시 `completed` 주문만 매출로 집계

이 변경으로 `WAITING_FOR_DEPOSIT` 주문은 ledger에 남아도 매출에는 포함되지 않음.

## 수정 파일

- `backend/src/attribution.ts`
- `backend/src/attributionLedgerDb.ts`
- `backend/src/routes/ads.ts`
- `backend/tests/attribution.test.ts`
- `backend/tests/ads.test.ts`

## 검증 결과

### 테스트

- `cd backend && npm run typecheck` -> 통과
- `cd backend && node --import tsx --test tests/attribution.test.ts tests/ads.test.ts` -> 14/14 통과

### 로컬 서버

- `lsof -i :7020` -> backend 서버 listening 확인
- `curl http://localhost:7020/api/attribution/ledger` -> 정상 응답 확인

응답 요약:

- `totalEntries`: `333`
- `paymentSuccessByPaymentStatus.pending`: `326`
- `paymentSuccessByPaymentStatus.confirmed`: `4`
- `paymentSuccessByPaymentStatus.canceled`: `1`

### DB 확인

- `backend/data/crm.sqlite3` 내 `attribution_ledger` 테이블 생성 및 적재 확인
- 행 수: `333`
- 상태 분포:
  - `pending`: `326`
  - `confirmed`: `4`
  - `canceled`: `1`
  - `(null)`: `2`

`(null)` 2건은 `payment_success`가 아니라 `checkout_started` / `form_submit` 계열이라 정상임.

## 판단

이번 작업으로 `#1`의 핵심 요구인

- DB 승격
- `payment_status` 분리
- 미입금/취소 주문의 매출 과대계상 차단

까지는 닫았음.

다음으로 바로 이어질 수 있는 후속은 두 가지임.

1. `confirmed_revenue` / `pending_revenue` / `canceled_revenue`를 API 응답과 UI 카드에 직접 노출
2. replay 또는 Toss 동기화 배치를 주기적으로 돌려 `pending -> confirmed/canceled` 전환을 자동화
