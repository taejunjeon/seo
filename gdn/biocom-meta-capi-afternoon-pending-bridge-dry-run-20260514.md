---
harness_preflight:
  common_harness_read: true
  project_harness_read: true
  lane: Green read-only dry-run
  allowed_actions:
    - VM Cloud SQLite attribution_ledger read-only aggregate query
    - operational DB public.tb_iamweb_users read-only aggregate query
    - local code inspection
    - approval packet documentation
  forbidden_actions:
    - Meta CAPI send
    - Meta API mutate
    - Google Ads/GA4/TikTok/Naver upload or send
    - operational DB write/import
    - VM Cloud schema migration
    - VM Cloud deploy/restart
    - GTM publish
    - Imweb header/footer change
    - raw identifier output
  source_window_freshness_confidence:
    source: operational DB public.tb_iamweb_users + VM Cloud SQLite backend/data/crm.sqlite3 attribution_ledger + VM Cloud local status sync dry-run summary
    window: 2026-05-14 13:00:00 KST to 2026-05-14 19:53:33 KST
    freshness: checked_at_kst=2026-05-14 19:53:33 KST
    confidence: 0.94
---

# 바이오컴 오후 Meta CAPI pending bridge dry-run

작성 시각: 2026-05-14 20:02 KST

## 10초 요약

2026-05-14 오후 바이오컴 구매 CAPI가 안 보인 이유는 Meta 연결이 끊긴 것보다 **VM Cloud에서 실제 결제완료 주문을 confirmed 후보로 못 올린 것**에 가깝다.

13:00 KST 이후 운영DB에는 실제 결제완료 주문이 12건, 2,395,030원 있다. 같은 시간 VM Cloud는 바이오컴 결제완료 신호를 50건 받았지만 전부 `pending`이다. 이 중 주문 키로 운영DB 결제완료와 붙는 것은 11건, 2,261,130원이며, 실제 Meta Purchase로 보낼 수 있는 양수 매출은 10건, 2,261,130원이다.

## 실제로 확인한 것

### 운영DB 결제완료

source: 운영DB `public.tb_iamweb_users` read-only
window: 2026-05-14 13:00:00 KST 이후
freshness: 2026-05-14 19:53:33 KST
confidence: 0.94

- 결제완료 주문: 12건
- 결제완료 매출: 2,395,030원
- 결제수단:
  - CARD: 9건
  - SUBSCRIPTION: 1건
  - FREE: 1건
  - NAVERPAY_ORDER: 1건
- 결제완료 시각 범위: 2026-05-14 13:11:24 KST ~ 16:09:09 KST

### VM Cloud 수신 원장

source: VM Cloud SQLite `backend/data/crm.sqlite3`의 `attribution_ledger` read-only
window: 2026-05-14 13:00:00 KST 이후
freshness: 2026-05-14 19:53:33 KST
confidence: 0.94

- 바이오컴 `payment_success` 수신: 50건
- `confirmed`: 0건
- `pending`: 50건
- snippet version: `2026-05-14-biocom-payment-success-click-id-v4-3` 50건
- `payment_key` present: 0건
- metadata payment status: blank 50건
- metadata positive value: 0건
- google click id presence: 5건

## 주문 키 대조 결과

raw 주문번호, 결제키, click id는 출력하지 않았다.

- VM Cloud pending 50건 중 운영DB 결제완료와 주문 키가 붙는 row: 11건
- 붙은 운영DB 주문: 11건
- 붙은 금액: 2,261,130원
- 이 중 양수 매출 Purchase 후보: 10건, 2,261,130원
- FREE 0원 주문: 1건, Meta Purchase 발송 후보로는 부적합
- 운영DB 결제완료지만 VM Cloud pending row와 붙지 않은 주문: 1건, 133,900원
- 미조인 1건은 결제수단 기준 `NAVERPAY_ORDER`
- VM Cloud pending 50건 중 운영DB 결제완료가 아닌 row: 39건

해석: 오후에 받은 50건을 모두 구매로 보내면 안 된다. 그중 39건은 아직 운영DB 결제완료가 아니므로 막아야 한다. 반대로 10건의 양수 결제완료는 주문 키와 금액을 운영DB에서 보강하면 Meta Purchase 후보로 복구할 수 있다.

## 기존 status sync가 못 고친 이유

VM Cloud local dry-run:

- endpoint: `POST /api/attribution/sync-status/toss?dryRun=true&limit=100`
- totalCandidates: 100
- matchedRows: 2
- updatedRows: 0
- writtenRows: 0
- skippedNoMatchRows: 98
- skippedPendingRows: 2

현재 status sync는 주로 `tb_sales_toss`와 Toss direct fallback, 가상계좌 만료 보조 판정을 본다. 13:00 이후 v4.3 row는 `payment_key`가 0건이고 metadata의 결제 상태와 금액도 비어 있다. 따라서 기존 sync만으로는 운영DB의 `PAYMENT_COMPLETE` 주문을 confirmed로 올릴 수 없다.

## 코드상 확인한 구조

- Meta CAPI 자동 발송 후보는 `payment_success + live + confirmed`만 고른다.
- Meta Purchase 전송 전에는 value가 양수여야 한다. value가 없거나 0이면 전송 준비 단계에서 실패한다.
- v4.3 아임웹 푸터 payload는 주문 키와 click id context를 보내지만, 이번 오후 row 기준 `paymentStatus`와 양수 금액을 보내지 않았다.

따라서 아임웹 푸터에서 Purchase CAPI를 직접 켜는 것은 정답이 아니다. 서버가 운영DB 결제완료와 금액을 확인한 뒤 confirmed 후보를 만드는 구조가 먼저 필요하다.

## 승인안 — VM Cloud confirmed status bridge

### 무엇을 하는가

VM Cloud backend에 바이오컴 전용 보강 bridge를 추가한다. 역할은 `pending payment_success` 중 운영DB `public.tb_iamweb_users`에서 `PAYMENT_COMPLETE`로 확인되고 금액이 양수인 주문만 `confirmed` 후보로 승격하는 것이다.

### 왜 하는가

오후 바이오컴 구매 CAPI 0건 문제는 Meta 수신점이 아니라 VM Cloud 후보 생성 단계에서 막혔다. 운영DB에는 결제완료가 있는데 VM Cloud가 이를 confirmed로 못 올리면 Meta CAPI auto-sync가 보낼 대상이 없다.

### 어떻게 진행하는가

1. pre-snapshot
   - VM Cloud `attribution_ledger`의 바이오컴 `pending/confirmed` count.
   - 13:00 이후 운영DB `PAYMENT_COMPLETE` count/amount.
   - Meta CAPI send log 최신 바이오컴 count.
2. dry-run
   - 주문 키로 pending row와 운영DB 결제완료 주문을 aggregate match.
   - raw 주문번호/결제키/click id 출력 금지.
3. patch
   - 운영DB 결제완료와 match된 row에만 `paymentStatus=confirmed`, `approvedAt`, `metadata.totalAmount`, `metadata.paymentStatusSyncSource=tb_iamweb_users_payment_complete_bridge`를 보강.
   - `final_order_amount <= 0`은 Meta Purchase 후보에서 제외.
   - `NAVERPAY_ORDER` 미조인 주문은 별도 NPay actual path로 분리.
4. build/typecheck.
5. VM Cloud backend restart.
6. post-snapshot.
   - VM Cloud confirmed 후보 증가가 dry-run과 일치.
   - Meta CAPI send log에서 양수 결제완료 후보만 발송.
   - raw identifier 노출 0.

### 성공 기준

- 2026-05-14 13:00 이후 바이오컴 양수 결제완료 10건, 2,261,130원이 confirmed 후보로 복구된다.
- FREE 0원 주문은 Meta Purchase로 보내지 않는다.
- 운영DB 결제완료가 아닌 VM Cloud pending 39건은 그대로 제외된다.
- NPay 1건, 133,900원은 이번 footer bridge가 아니라 NPay actual path로 분리 표시된다.
- Meta CAPI send/upload/mutate는 승인 범위 안에서만 발생한다.
- 운영DB write 0, VM Cloud schema migration 0, GTM publish 0, Imweb header/footer 변경 0.

### 실패 조건

- pending 50건 전체가 confirmed로 올라감.
- FREE 0원 주문이 Meta Purchase 후보가 됨.
- 운영DB 미결제 row가 confirmed로 올라감.
- NPay actual을 footer bridge로 억지 편입함.
- raw 주문번호/결제키/click id가 response나 문서에 노출됨.
- Meta CAPI가 dry-run 없이 수동 replay로 대량 발송됨.

### rollback

- 배포 전 백업한 VM Cloud backend 파일로 원복.
- status write가 실행된 경우에는 배포 전 snapshot 기준으로 `payment_status`와 metadata 보강 필드만 되돌리는 rollback SQL을 별도 dry-run 후 실행한다.
- rollback 후 `/api/attribution/ledger` aggregate, Meta CAPI send log, health를 다시 확인한다.

## 하지 않은 것

- Meta CAPI 실제 전송: 0
- Meta API mutate: 0
- 운영DB write/import: 0
- VM Cloud schema migration: 0
- VM Cloud deploy/restart: 0
- GTM publish: 0
- Imweb header/footer 변경: 0
- raw identifier output: 0

## 다음 행동

### Codex

1. 승인 시 VM Cloud bridge patch를 작성한다.
2. patch 전후 typecheck와 dry-run fixture를 만든다.
3. 실제 발송 전에는 positive value guard와 zero-value no-send guard를 먼저 검증한다.

### TJ님

1. 이 승인안 범위로 VM Cloud backend patch/deploy를 진행할지 결정한다.
2. 아임웹 푸터에서 Purchase CAPI 직접 발송은 켜지 않는다. 현재 문제는 수신이 아니라 서버 후보 승격 문제다.

상세 JSON: [biocom-meta-capi-afternoon-pending-bridge-dry-run-20260514.json](/Users/vibetj/coding/seo/data/project/biocom-meta-capi-afternoon-pending-bridge-dry-run-20260514.json)
