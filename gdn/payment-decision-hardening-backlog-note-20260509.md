# payment-decision raw query logging hardening backlog note

작성 시각: 2026-05-09 01:56 KST
Project: biocom Path B bridge
Lane: Green documentation / P1 hardening backlog
Mode: no-deploy / no-write / no-platform-send

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
    - docs/report/text-report-template.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - docs/agent-harness/growth-data-harness-v0.md
    - harness/npay-recovery/README.md
    - harness/npay-recovery/RULES.md
    - harness/npay-recovery/VERIFY.md
    - harness/npay-recovery/APPROVAL_GATES.md
    - harness/npay-recovery/AUDITOR_CHECKLIST.md
  lane: Green documentation
  allowed_actions:
    - backlog note
    - blocker classification
  forbidden_actions:
    - payment-decision redaction deploy
    - backend operational deploy
    - operational schema migration
    - platform send
  source_window_freshness_confidence:
    source: "gpt0508-7 PM2 read-only grep result"
    window: "2026-05-09 01:28-01:38 KST"
    freshness: "2026-05-09 01:56 KST"
    confidence: 0.82
```

## 한 줄 결론

`/api/attribution/payment-decision` GET query raw logging은 기존 endpoint hardening 이슈다. Path B no-send Preview 진행 blocker는 아니다.

## 현재 판단

- Path B no-send endpoint raw pattern count: 0.
- actual email PM2 pattern count: 0.
- global order/payment pattern count: 2.
- 해당 2건은 기존 `payment-decision` GET query logging에서 나온 것으로 분리됐다.

## P0에서 제외하는 이유

- 이번 P0 목표는 TEST click id와 same-browser preservation 확인이다.
- Path B no-send endpoint 자체는 raw echo/logging 0 기준으로 PASS다.
- 기존 endpoint hardening을 먼저 배포하려면 backend 제한 deploy가 필요하므로 P1 Yellow로 분리하는 편이 안전하다.

## 유지할 정책

- 새 Path B endpoint에는 raw logging을 추가하지 않는다.
- 운영 PM2/nginx raw logging 신규 활성화는 별도 승인 전 금지한다.
- 문제 원인 확인이 정말 불가능한 경우 local/tunnel 환경의 1회 raw debug를 우선한다.
- 운영 redaction deploy는 별도 승인안으로만 진행한다.

## 재개 조건

- Path B storage canary 전.
- 또는 payment-decision endpoint를 계속 사용할 운영 이유가 생긴 경우.
- 또는 PM2/nginx 로그에서 raw query pattern이 증가한 경우.

## 판정

Auditor verdict: PASS_BACKLOG_NOT_BLOCKER
