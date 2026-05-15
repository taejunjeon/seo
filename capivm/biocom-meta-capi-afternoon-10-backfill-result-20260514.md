---
harness_preflight:
  common_harness_read: true
  project_harness_read: true
  lane: Red approved limited Meta CAPI backfill
  approval: TJ approved Biocom Meta CAPI A-grade 10 backfill send + post-reconciliation
  allowed_actions:
    - latest read-only preflight
    - Meta CAPI Purchase backfill send for A-grade 10 only
    - VM Cloud meta-capi-sends.jsonl post-reconciliation
    - documentation
  forbidden_actions:
    - pending 41/42 send
    - FREE zero-value send
    - NPay unmatched send
    - B/C/ambiguous row send
    - Google Ads/GA4/TikTok/Naver send
    - campaign or budget mutate
    - GTM publish
    - Imweb code change
    - operational DB write/import
    - VM Cloud SQLite status update
    - schema migration
    - raw identifier output
  source_window_freshness_confidence:
    source: operational DB public.tb_iamweb_users read-only + VM Cloud SQLite attribution_ledger read-only + VM Cloud logs/meta-capi-sends.jsonl
    window: 2026-05-14 13:00 KST onward
    freshness: checked_at_utc=2026-05-14T11:17:14.739Z
    confidence: 0.96
---

# 바이오컴 Meta CAPI 오후 10건 backfill 결과

작성 시각: 2026-05-14 20:22 KST

## 판정

**BACKFILL_10_SUCCESS**

2026-05-14 오후 바이오컴 결제완료 중 A-grade로 확인된 10건, 2,261,130원만 Meta CAPI Purchase로 backfill 전송했다. Meta 응답은 10건 모두 HTTP 200이고 `events_received=1`이었다.

## 무엇이 가능해졌나

오후에 VM Cloud에서 `pending`에 묶여 Meta로 나가지 못했던 바이오컴 결제완료 일부가 Meta 서버 이벤트로 보강됐다. 이 작업은 자동 bridge 수정이 아니라 **승인된 10건만 1회성 backfill**한 것이다.

## 전송 전 preflight

source:
- 운영DB `public.tb_iamweb_users` read-only
- VM Cloud SQLite `attribution_ledger` read-only
- VM Cloud `logs/meta-capi-sends.jsonl` read-only

window: 2026-05-14 13:00 KST 이후
freshness: 2026-05-14 20:16 KST
confidence: 0.96

preflight 결과:

- Pixel: 바이오컴 `1283400029487161`
- VM Cloud pending row: 53건
- A-grade 후보: 10건
- 후보 금액: 2,261,130원
- 기존 성공 event_id 중복: 0건
- 후보 구성:
  - CARD: 9건 / 2,246,430원
  - SUBSCRIPTION: 1건 / 14,700원

첫 preflight에서는 전송을 막았다. 이유는 운영DB `cancellation_reason`과 `return_reason`에 문자열 `nan`이 있어 취소/반품 guard가 이를 nonblank로 봤기 때문이다. 추가 aggregate 확인에서 환불 금액과 환불 대기 금액이 모두 0이고, `nan`은 결측값 marker로 확인됐다. 그래서 `nan`을 blank로 처리한 뒤 다시 preflight를 통과시켰다.

## 전송 결과

- attempted: 10건
- success: 10건
- failed: 0건
- Meta `events_received`: 10
- response status: HTTP 200 10건
- send window: 2026-05-14T11:16:38.733Z ~ 2026-05-14T11:16:41.566Z

raw 주문번호, 결제키, click id, gclid, gbraid, wbraid는 출력하지 않았다.

## Post-send reconciliation

VM Cloud `logs/meta-capi-sends.jsonl` read-only 기준:

- 2026-05-14 02:00 KST 이후 바이오컴 successful Purchase: 25건
- 기존 auto-sync 성공: 15건
- 이번 manual backfill 성공: 10건
- `events_received=1`: 25건
- successful event_id 중복: 0건
- 최신 successful send: 2026-05-14T11:16:41.563Z

## 제외한 것

- pending/unmatched: 42건 전송 안 함
- FREE 0원: 1건 전송 안 함
- NPay 미조인 결제완료: 1건 / 133,900원 전송 안 함
- B/C/ambiguous row: 전송 안 함
- Google Ads/GA4/TikTok/Naver: 전송 0
- 운영DB write/import: 0
- VM Cloud SQLite status update: 0
- schema migration: 0
- GTM publish: 0
- Imweb code change: 0

## Meta ROAS 영향

Meta 쪽에는 승인된 10건, 2,261,130원의 서버 Purchase가 추가로 관측될 수 있다. 단, Events Manager와 광고관리자 반영에는 지연이 있을 수 있다. 이번 작업은 과거 누락분 보강이며, 앞으로 들어오는 오후 주문이 자동으로 해결된 것은 아니다.

## 남은 문제

VM Cloud는 여전히 v4.3 payment_success row를 `pending`으로 받는다. 운영DB 결제완료와 금액을 보고 안전하게 `confirmed` 후보로 승격하는 bridge patch가 필요하다.

상세 JSON: [biocom-meta-capi-afternoon-10-backfill-result-20260514.json](/Users/vibetj/coding/seo/data/project/biocom-meta-capi-afternoon-10-backfill-result-20260514.json)
