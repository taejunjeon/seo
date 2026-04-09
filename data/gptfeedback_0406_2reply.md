# GPT Feedback 0406-2 Reply

## 반영 범위

이번 피드백에서 우선순위로 지적된 3가지를 반영했소.

1. `pending -> confirmed/canceled` 자동 동기화 배치 추가
2. API/CRM UI에 `확정/대기/취소 매출` 노출 추가
3. CAPI 전송 후보를 `confirmed live payment_success`로 명시 제한

## 구현 내용

### 1) pending 결제 상태 자동 동기화

- `backend/src/routes/attribution.ts`
  - `POST /api/attribution/sync-status/toss` 추가
  - `tb_sales_toss`에서 pending ledger 후보의 `paymentKey / orderId`를 기준으로 상태 조회
  - `DONE/PAID`류는 `confirmed`, `CANCELED/FAIL`류는 `canceled`로 승격
  - 아직 `WAITING/PENDING`이면 유지
  - 기본은 `dryRun=true` preview 모드, `dryRun=false`면 실제 반영

- `backend/src/attributionLedgerDb.ts`
  - SQLite `attribution_ledger` row update helper 추가
  - 새 row를 append하지 않고 기존 pending row를 직접 갱신하도록 처리
  - 이렇게 해야 summary/매출 집계가 중복으로 부풀지 않소

- `backend/src/bootstrap/startBackgroundJobs.ts`
  - attribution status sync 자동 배치 추가
  - 서버 기동 후 90초 뒤 시작, 15분 주기 실행

### 2) 상태별 매출 노출

- `backend/src/attribution.ts`
  - `buildLedgerSummary()`에 아래 필드 추가
    - `paymentSuccessByPaymentStatus`
    - `paymentRevenueByPaymentStatus`
    - `confirmedRevenue`
    - `pendingRevenue`
    - `canceledRevenue`
  - `metadata.totalAmount`, `metadata.amount`, `metadata.value`, `referrerPayment.amount`에서 금액을 읽어 status별 합산

- `frontend/src/types/crmPhase1.ts`
  - CRM phase1 snapshot 타입에 status별 건수/매출 필드 반영

- `frontend/src/app/crm/page.tsx`
  - 귀속 진단 카드에 아래 3개 추가
    - `확정 매출`
    - `입금 대기 매출`
    - `취소/실패 매출`
  - 해석 안내 문구에도 status별 의미를 같이 설명

### 3) CAPI confirmed-only 재확인

- `backend/src/metaCapi.ts`
  - `selectMetaCapiSyncCandidates()` 추가
  - `syncMetaConversionsFromLedger()`가 이제 `payment_success + live + paymentStatus === confirmed`만 후보로 잡게 변경
  - 기존 Toss 상태 재확인 로직은 그대로 유지하되, candidate 단계부터 더 명확히 제한했소

## 검증 결과

### 백엔드

- `cd backend && npm run typecheck`
  - 통과

- `cd backend && node --import tsx --test tests/ads.test.ts tests/attribution.test.ts`
  - `17/17` 통과

- 임시 서버 검증
  - `PORT=7021 node --import tsx src/server.ts` 로 현재 소스를 별도 기동
  - `POST /api/attribution/sync-status/toss?dryRun=true&limit=5`
    - 응답 정상
    - `totalCandidates=5, matchedRows=0, updatedRows=0, writtenRows=0`
  - `GET /api/attribution/ledger?limit=1`
    - 새 summary 필드 응답 확인
    - 2026-04-06 확인값:
      - `confirmedRevenue = 11,653,869`
      - `pendingRevenue = 586,028,060`
      - `canceledRevenue = 78,088`

### 프론트

- `cd frontend && npm run build`
  - 내 변경분이 아니라 기존 오류로 실패
  - 실패 지점: `frontend/src/app/ads/page.tsx:560`
  - 에러: `Cannot find name 'CampaignManagerSection'`

즉, CRM 카드 추가 자체는 타입 정의와 함께 반영했지만, 현재 프론트 전체 production build는 기존 `ads/page.tsx` 오류 때문에 완전 통과 상태는 아니오.

## 남은 점 / 운영 메모

- 현재 7020에서 떠 있는 기존 백엔드 프로세스는 수정 전 코드였소.
  - 그래서 새 route 검증은 7021 임시 서버에서 했소.
  - 7020 실사용 프로세스 반영은 재기동 또는 watch 기반 reload가 필요하오.

- 이번 작업은 `상태 동기화 plumbing + API/UI 노출 + CAPI candidate 제한`까지 닫았고,
  실제 운영 검증은 별도로 필요하오.
  - pending 무통장 주문이 시간이 지나 `confirmed`로 바뀌는지
  - canceled 주문이 실제로 매출 카드에서 빠지는지
  - CAPI 전송 로그가 confirmed 건만 남는지

## 변경 파일

- `backend/src/attribution.ts`
- `backend/src/attributionLedgerDb.ts`
- `backend/src/routes/attribution.ts`
- `backend/src/bootstrap/startBackgroundJobs.ts`
- `backend/src/metaCapi.ts`
- `backend/tests/attribution.test.ts`
- `frontend/src/types/crmPhase1.ts`
- `frontend/src/app/crm/page.tsx`
