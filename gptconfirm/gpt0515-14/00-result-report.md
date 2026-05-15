# gpt0515-14 payment-decision canceled root-cause + Purchase restore

작성 시각: 2026-05-15 11:48 KST

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - data/!data_inventory.md
  required_context_docs:
    - gptconfirm/gpt0515-8/00-result-report.md
    - footer/header_purchase_guard_server_decision_0412_v3.md
  lane: Green analysis + Red/Yellow approval packet
  allowed_actions:
    - VM Cloud read-only ledger query
    - 운영DB read-only query
    - Toss/Imweb direct read-only verification
    - Meta CAPI log read-only check
    - restore patch plan and approval packet
  forbidden_actions:
    - Meta 운영 Purchase send
    - Browser Purchase unguarded fallback
    - Pixel 전체 직접 삽입
    - GTM publish
    - 운영DB write/import
    - VM Cloud deploy/restart without approval
    - raw identifier report/chat/telegram/git output
  source_window_freshness_confidence:
    source: "VM Cloud SQLite attribution_ledger + VM Cloud payment-decision API + 운영DB dashboard.public.tb_iamweb_users + Imweb v2 API + Meta CAPI send log"
    window: "2026-05-15 00:00 KST 이후, 대상 safe_ref 1건"
    freshness: "조회 시각 2026-05-15 11:39-11:44 KST"
    confidence: "high for payment-decision timeout and VM Cloud ledger trace; medium for Meta UI because Events Manager display can lag"
```

## 판정

**A+B+D: DECISION_BACKEND_SLOW_TIMEOUT + DECISION_GUARD_ABORT_TOO_SHORT + DECISION_ALLOWED_BUT_BROWSER_ABORTED**

10초 요약: 방금 카드 결제 1건은 실제 결제완료로 확인됐다. VM Cloud에는 `payment_success confirmed`로 들어왔고, 서버의 결제 판단 API도 `allow_purchase`를 만들었다. 하지만 Header Purchase Guard의 브라우저 timeout은 3초인데 서버 응답은 2.9-4.7초라, 브라우저가 결정을 받기 전에 요청이 `canceled` 된 것이 핵심 원인이다. 별도로 서버 CAPI도 이 주문을 아직 Meta로 보내지 않았다.

## 완료한 것

- 카드 결제 1건을 `safe_ref=safe_80dd8eb5da6f`로 추적했다.
- 운영DB `dashboard.public.tb_iamweb_users`는 아직 0건으로, 결제 미완료가 아니라 sync 지연으로 분류했다.
- VM Cloud SQLite `attribution_ledger`에서는 같은 건이 `payment_page_seen -> checkout_started -> payment_success` 순서로 확인됐다.
- VM Cloud `payment-decision` API는 해당 건에 대해 `confirmed / allow_purchase`를 반환했다.
- Imweb v2 exact lookup은 주문을 찾았고, 카드 결제/금액/주문시각/완료시각 presence를 확인했다.
- Meta CAPI send log에는 해당 건 전송 기록이 없어 단건 backfill 또는 auto-send 패치 후보로 분리했다.

## 실제 숫자

- VM Cloud matched rows: 3건.
- VM Cloud matched touchpoints: `payment_page_seen` 1, `checkout_started` 1, `payment_success` 1.
- VM Cloud matched payment_success: confirmed 1건, 11,900원.
- payment-decision directToss ON 응답: 3.7-3.9초, `allow_purchase`.
- payment-decision directToss OFF 응답: 2.9-3.5초, `allow_purchase`.
- Header Purchase Guard timeout: 3.0초.
- 운영DB matched rows: 0건.
- Meta CAPI matched send log: 0건.

## 결론

현재 Purchase가 안 뜬 이유는 “결제가 실패해서”가 아니다. 서버는 구매로 인정했지만, 브라우저 Guard가 서버 응답을 기다리는 시간이 짧고, 서버 판단 API가 느려서 브라우저 Purchase가 통과하지 못했다.

운영DB는 지금 이 문제의 실시간 정본으로 쓰기 어렵다. `data/!data_inventory.md` 기준 실시간 유입/결제 후보는 VM Cloud 원장이 담당하고, 운영DB는 개발팀 dashboard DB라 sync gap이 생긴다. 카드 결제완료 복구는 VM Cloud `payment_success + Toss direct`, 보조로 Imweb v2 direct를 쓰는 방향이 맞다.

## 하지 않은 것

- Meta 운영 Purchase send: 0.
- 단건 backfill send: 0.
- Browser Purchase unguarded fallback: 0.
- Pixel 전체 직접 삽입: 0.
- GTM publish: 0.
- 운영DB write/import: 0.
- VM Cloud deploy/restart: 0.
- raw identifier report/chat/telegram/git 출력: 0.

## 바로 적용할 복구 방향

1. 브라우저 쪽: Header Purchase Guard timeout을 7-8초로 늘리고, 완료 페이지 진입 즉시 `payment-decision`을 prefetch/cache한다.
2. VM Cloud backend 쪽: `payment-decision`이 전체 원장을 읽기 전에 exact key로 VM Cloud SQLite `payment_success`를 먼저 찾게 한다.
3. 서버 CAPI 쪽: `payment_success confirmed + paymentKey + Toss DONE + value guard pass`이면, 브라우저 사전 guard의 `meta_purchase_candidate=false`를 최종 no-send로 보지 않게 한다.
4. 실시간 정본 쪽: 운영DB sync를 기다리지 않고 VM Cloud에 결제완료 판단 cache를 쌓거나, Toss/Imweb direct를 짧은 timeout으로 쓰는 구조로 바꾼다.

## Telegram

실제 발송용 5줄 요약은 raw id 없이 아래 문구로 준비했다.

```text
gpt0515-14 판정: payment-decision timeout + guard abort.
카드 결제 1건은 VM Cloud/Toss 기준 confirmed, 운영DB는 sync gap.
Browser Purchase는 서버 allow 응답 전 request canceled 가능성이 높음.
Meta CAPI는 해당 건 send 0, 단건 backfill/auto-send 패치 후보.
다음은 Guard timeout/prefetch + VM Cloud fast decision + CAPI gate 패치 승인.
```
