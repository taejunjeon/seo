---
harness_preflight:
  common_harness_read: true
  project_harness_read: true
  lane: Yellow approval packet
  allowed_actions:
    - approval document
    - read-only dry-run
  forbidden_actions:
    - VM Cloud backend deploy/restart before approval
    - VM Cloud SQLite status update before approval
    - Meta CAPI send before approval
    - operational DB write/import
    - schema migration
    - GTM publish
    - Imweb code change
    - raw identifier output
  source_window_freshness_confidence:
    source: operational DB public.tb_iamweb_users + VM Cloud SQLite attribution_ledger
    window: 2026-05-14 afternoon failure window
    freshness: checked_at_kst=2026-05-14 20:22 KST
    confidence: 0.9
---

# 바이오컴 pending → confirmed bridge patch 승인안

작성 시각: 2026-05-14 20:22 KST

## 10초 요약

오후 바이오컴 Meta CAPI가 멈춘 근본 원인은 VM Cloud가 v4.3 payment_success row를 계속 `pending`으로 받았기 때문이다. 이미 승인된 10건은 1회성 backfill로 보냈지만, 앞으로 같은 문제가 반복되지 않으려면 VM Cloud backend가 운영DB 결제완료를 읽어 `confirmed` 후보를 안전하게 만드는 bridge가 필요하다.

## 무엇을 바꾸는가

VM Cloud backend에 바이오컴 전용 status bridge를 추가한다.

역할:

1. VM Cloud SQLite `attribution_ledger`에서 `source='biocom_imweb'`, `touchpoint='payment_success'`, `payment_status='pending'` row를 읽는다.
2. 운영DB `public.tb_iamweb_users`를 read-only로 조회한다.
3. 같은 주문 키가 운영DB `PAYMENT_COMPLETE`이고 금액이 양수이며 환불/취소 금액이 0이면 `confirmed` 후보로 승격한다.
4. FREE 0원, NPay 미조인, 미결제/미조인, B/C/ambiguous row는 제외한다.

## 왜 필요한가

Meta CAPI auto-sync는 VM Cloud 원장에서 `payment_success + live + confirmed`만 보낸다. 현재 v4.3 row는 click id 보존은 되지만 결제 상태와 금액이 비어 있어 계속 `pending`으로 남는다. 운영DB에는 결제완료가 있어도 VM Cloud가 이를 confirmed로 올리지 못하면 Meta 구매 이벤트가 계속 빠진다.

## 승인 범위

허용:

- VM Cloud backend patch
- backend typecheck/build
- VM Cloud backend restart
- pre/post snapshot
- dry-run endpoint 또는 guard fixture 추가
- VM Cloud SQLite `attribution_ledger` status/metadata update, 단 승인된 guard를 통과한 row만

금지:

- 운영DB write/import
- schema migration
- pending 전체 일괄 confirmed
- FREE 0원 Purchase 전송
- NPay 미조인 row 강제 편입
- Google Ads/GA4/TikTok/Naver send
- GTM publish
- Imweb code change
- raw identifier 출력

## 성공 기준

- 운영DB `PAYMENT_COMPLETE` + 양수 금액 + 환불/취소 없음 row만 confirmed 후보가 된다.
- FREE 0원 row는 no-send로 남는다.
- NPay 미조인 row는 별도 NPay actual path로 남는다.
- 미조인 pending row는 그대로 pending이다.
- Meta CAPI auto-sync가 새 confirmed 후보만 보낸다.
- successful event_id 중복 0.
- raw identifier output 0.

## 실패 조건

- pending row 전체가 confirmed로 올라감.
- 운영DB 미결제/미조인 row가 confirmed가 됨.
- 0원 또는 NPay 미조인 row가 Purchase로 전송됨.
- duplicate successful event_id가 생김.
- raw 주문번호/결제키/click id가 response나 문서에 노출됨.

## 실행 순서

1. pre-snapshot
   - VM Cloud `attribution_ledger` pending/confirmed count.
   - 운영DB 결제완료 count/amount.
   - Meta CAPI successful event_id duplicate count.
2. dry-run
   - candidate count/amount/method aggregate.
   - exclusion count aggregate.
3. patch
   - status bridge helper 추가.
   - `nan/null/undefined` 문자열은 blank로 정규화.
   - refund amount, refund pending amount, cancellation/return reason guard 적용.
4. typecheck/build.
5. VM Cloud restart.
6. post-snapshot
   - confirmed 후보 count.
   - Meta CAPI send log.
   - excluded row send 0.

## rollback

1. backend 파일을 pre-deploy backup으로 원복한다.
2. status update가 실행된 경우, pre-snapshot 기준 해당 bridge metadata marker가 있는 row만 `pending`으로 되돌리는 rollback SQL을 별도 dry-run 후 실행한다.
3. rollback 후 health, ledger aggregate, Meta CAPI log를 확인한다.

## 권장

진행 추천: 90%

이유: 1회성 backfill은 성공했지만 앞으로 들어오는 결제완료가 계속 pending에 묶일 수 있다. 단, 이 patch는 VM Cloud SQLite status update와 Meta CAPI auto-sync에 영향을 주므로 별도 Yellow 승인 후 진행해야 한다.
