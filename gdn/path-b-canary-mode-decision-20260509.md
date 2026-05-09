# Path B canary mode decision

작성 시각: 2026-05-09 19:21 KST
Status: DECISION_PACKET

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - AGENTS.md
    - docurule.md
    - docs/report/text-report-template.md
  lane: Green decision packet
  allowed_actions:
    - option comparison
    - approval packet writing
  forbidden_actions:
    - GTM Production publish
    - Imweb production save
    - canary execution
    - platform send
    - raw storage or logging
  source_window_freshness_confidence:
    source: gpt0508-15 logged-in browser row and VM Cloud summary
    window: 2026-05-09 19:05-19:21 KST
    freshness: same-session
    site: biocom
    confidence: high
```

## 한 줄 결론

빠르게 실제 fill rate를 보려면 B, 즉 order-complete-only limited Production publish 1h canary가 가장 의미 있다. 더 보수적으로 가려면 A, 즉 Preview/manual canary를 한 번 더 반복한다.

## 전제

- VM Cloud limited storage deploy: PASS.
- schema bootstrap: PASS.
- controlled POST: PASS.
- GTM fresh workspace: PASS.
- 실제 로그인 브라우저 row: PASS.
- raw 저장: 0.
- platform send: 0.
- click id 없는 row: `identity_only_quarantine`으로 처리.

## 선택지 A. Preview/manual canary

무엇:

- TJ님 로그인 브라우저 또는 제한된 수동 URL로 row를 몇 건 더 만든다.

장점:

- 안전하다.
- Production publish가 없다.
- 실제 고객에게 영향이 없다.
- 문제가 생기면 즉시 write flag OFF로 끝난다.

단점:

- row 수가 적다.
- 실제 운영 fill rate를 대표하지 못한다.
- NPay/card/vbank/guest/member 분포를 충분히 못 본다.

승인 필요:

- Yellow controlled Preview row 추가.
- Production publish는 불필요.

추천 상황:

- 한 번 더 click id 포함 row를 보고 싶을 때.
- Production publish 승인 전 마지막 smoke가 필요할 때.

## 선택지 B. order-complete-only limited Production publish 1h canary

무엇:

- fresh workspace에서 order complete page only trigger로 Path B canary tag를 1시간만 Production publish한다.
- VM Cloud write flag도 같은 1시간 window만 ON 한다.
- row cap은 200이다.

장점:

- 실제 운영 주문완료 fill rate를 본다.
- identity-only row와 full bridge row 분포를 산출한다.
- 1h 이후 reliability v2 dry-run으로 바로 넘어갈 수 있다.

단점:

- GTM Production publish라 Red/Yellow 경계가 높다.
- rollback과 monitoring이 필요하다.
- trigger scope가 잘못되면 영향이 커진다.

승인 필요:

- GTM Production publish 명시 승인.
- VM Cloud 1h write flag ON 승인.
- rollback 담당과 모니터링 기준 확인.

추천 상황:

- 실제 fill rate가 필요하고, order-complete-only trigger diff를 검토할 수 있을 때.

## Codex 추천

추천은 B다.

이유:

- Path B의 기능 검증은 이미 충분하다.
- 남은 판단은 실제 fill rate다.
- click id missing row도 quarantine으로 처리하므로, 실제 운영 row를 봐야 다음 결정이 가능하다.

단, B는 Production publish가 포함되므로 TJ님 명시 승인이 필요하다.

## 다음 승인 선택 문구

A를 고르면:

```text
YES: Path B Preview/manual identity-first canary row 추가를 승인합니다.
Production publish 금지, max 5 rows, raw/platform 0, write flag 즉시 OFF.
```

B를 고르면:

```text
YES: Path B order-complete-only limited Production publish 1h canary를 승인합니다.
범위: order complete pages only, 1h, max 200 rows, identity-first hash-only, send_candidate=false.
금지: All Pages trigger, raw 저장/로그, platform send, conversion upload, 기존 GTM tag pause/delete.
```

Auditor verdict: DECISION_READY__B_RECOMMENDED_WITH_APPROVAL
