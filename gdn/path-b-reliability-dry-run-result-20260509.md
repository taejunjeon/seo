# Path B reliability dry-run 결과

작성 시각: 2026-05-09 02:24 KST
Project: biocom Path B bridge
Lane: Green dry-run
Mode: no-send / no-write / no-deploy / no-publish / no-platform-send

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
  lane: Green reliability dry-run
  allowed_actions:
    - local artifact normalization
    - no-send dry-run input creation
    - confidence scoring
    - report writing
  forbidden_actions:
    - 1h hash-only storage canary execution
    - backend operational storage canary
    - operational schema migration
    - GTM Production publish
    - Imweb production save
    - real ad click generation
    - actual payment test
    - raw email/phone/member_code/order/payment operational storage
    - Google Ads/GA4/Meta/TikTok/Naver send
    - Google Ads conversion upload
    - existing GTM tag pause/delete
  source_window_freshness_confidence:
    source: "gpt0508-7 identity evidence + gpt0508-8 click evidence + previous order/session reliability baseline"
    window: "2026-05-09 01:28-01:51 KST"
    freshness: "2026-05-09 02:24 KST"
    confidence: 0.9
```

## 5줄 요약

1. `gpt0508-7` 실제 로그인 주문완료 identity evidence와 `gpt0508-8` TEST click evidence를 하나의 reliability dry-run input으로 묶었다.
2. 결과 JSON은 `data/path-b-reliability-dry-run-input-20260509.json`이다.
3. Confidence A는 controlled evidence에서만 1건, Confidence B는 실제 로그인 주문완료 evidence에서 1건, Confidence C는 controlled click evidence에서 2건 나왔다.
4. `send_candidate=false`, `actual_send_candidate=false`, `platform_send_count=0`을 유지했다.
5. storage canary는 승인 판단 가능한 상태지만, 실행은 여전히 HOLD다.

## 생성한 dry-run input

- 산출물: `data/path-b-reliability-dry-run-input-20260509.json`
- 생성 스크립트: `backend/scripts/path-b-reliability-dry-run-input-builder.ts`
- 입력:
  - `data/path-b-agent-os-real-preview-evidence-20260509.json`
  - `data/path-b-test-click-id-preview-result-20260509.json`
  - `data/path-b-same-browser-preservation-preview-result-20260509.json`
  - `data/path-b-order-session-reliability-dry-run-20260509.json`

## Confidence 결과

| 등급 | 개수 | 의미 | 주의 |
|---|---:|---|---|
| A | 1 | order + identity + client/session + click id가 모두 present | controlled smoke라 운영 실측으로 승격 금지 |
| B | 1 | 실제 로그인 주문완료에서 order + identity + client/session present | click id는 이 실제 주문 evidence에 없음 |
| C | 2 | controlled click evidence에서 order + client/session + click id present | identity는 해당 evidence에 없음 |
| D | 0 | 이번 입력에는 D evidence 없음 | 과거 time-only baseline은 별도 위험 기준으로 유지 |

## Ambiguous 판단

- Preview evidence 자체의 ambiguous 후보: 0건.
- time-only baseline은 여전히 위험하다.
  - 주문 52건 모두 prior click 후보 2개 이상.
  - median prior click candidates: 329.
  - p90 prior click candidates: 644.

해석:

- Path B bridge 없이 시간만으로 주문과 클릭을 붙이는 방식은 계속 HOLD다.
- Path B hash bridge가 있으면 ambiguity를 줄일 가능성이 높지만, 운영 저장 row가 아직 없으므로 실제 ambiguous rate는 canary에서 측정해야 한다.

## Guard 결과

| 항목 | 결과 |
|---|---|
| send_candidate | false |
| actual_send_candidate | false |
| would_store | false |
| would_send | false |
| no platform send | PASS |
| raw values stored in dry-run input | false |
| confirmed purchase uplift | HOLD |

## 성공 기준 충족 여부

- confidence_A/B/C/D 후보 출력: PASS.
- ambiguous 후보 분리: PASS.
- `same_browser_controlled_only` flag 유지: PASS.
- `real_checkout_unverified_for_click_bridge` flag 유지: PASS.
- no platform send 0: PASS.
- actual send 후보 0: PASS.

## 현재 판단

Storage canary 승인 패킷을 final로 올릴 수 있다.

다만 운영 저장 실행은 아직 승인하지 않는다. 다음 단계의 목적은 저장 canary를 실제로 켜는 것이 아니라, TJ님이 `YES/HOLD`를 판단할 수 있는 승인안을 완성하는 것이다.

Auditor verdict: PASS_RELIABILITY_DRY_RUN_INPUT_READY__CANARY_EXECUTION_HOLD
