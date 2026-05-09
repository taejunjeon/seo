# Path B Preview naming cleanup — AGENT_OS 전환 결과

작성 시각: 2026-05-09 01:36 KST
대상: biocom GTM `GTM-W2Z6PHN` Preview workspace `164`
상태: rename_done / controlled_smoke_pass
Lane: Yellow approved Preview only
Mode: no-send / no-operational-write / no-platform-send / no-publish

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
    - vm/!vm.md
  lane: Yellow Preview only
  allowed_actions:
    - Preview workspace rename
    - Preview-only tag rename
    - Preview event rename
    - controlled smoke
    - read-only PM2 log check
  forbidden_actions:
    - GTM Production publish
    - GTM submit/create_version
    - Imweb production save
    - backend operational storage canary
    - operational schema migration
    - platform send
    - conversion upload
    - existing live GTM tag pause/delete/edit
  source_window_freshness_confidence:
    source: "GTM API update on workspace 164 + controlled smoke result"
    window: "2026-05-09 01:34-01:36 KST"
    freshness: "2026-05-09 01:36 KST"
    confidence: 0.92
```

## 10초 결론

TJ님 지적대로 새로 만든 Preview tag/event 이름에서 과거 협력사명이 보이지 않도록 `AGENT_OS` 계열로 바꿨다.
기존 라이브 HURDLERS 태그는 수정하지 않았다.
변경 후 controlled smoke는 다시 PASS였다.

## 왜 바꿨나

처음 이름에 `HURDLERS`가 들어간 이유는 source가 기존 GTM 변수 `HURDLERS - [맞춤 JS] user_id`였기 때문이다.
하지만 새로 만드는 AGENT/Codex 관리 태그명과 event명에는 과거 협력사명을 노출할 필요가 없다.
운영자가 Tag Assistant에서 봤을 때도 새 작업의 소유권이 `AGENT_OS`로 보여야 한다.

## 바꾼 이름

- Workspace:
  - 이전: `codex_path_b_hurdlers_user_id_preview_20260508T161749Z`
  - 이후: `agent_os_path_b_user_identity_preview_20260508T163414Z`
- Tag:
  - 이전: `PathB_hurdlers_user_id_identity_hmac_preview_no_send_20260508T161749Z`
  - 이후: `AGENT_OS_path_b_user_identity_hmac_preview_no_send_20260508T163414Z`
- Trigger:
  - 이전: `PathB_hurdlers_order_confirm_pages_preview_20260508T161749Z`
  - 이후: `AGENT_OS_path_b_order_confirm_pages_preview_20260508T163414Z`
- dataLayer event:
  - 이전: `path_b_hurdlers_user_id_preview_result`
  - 이후: `agent_os_path_b_user_identity_preview_result`
- source marker:
  - 이전: `email_source_candidate=hurdlers_user_id`
  - 이후: `email_source_candidate=legacy_user_id`

## controlled smoke 결과

- Verdict: `PASS_AGENT_OS_RENAME_AND_CONTROLLED_SMOKE`
- `email_hash_present`: true
- `identity_source`: email
- `order_no_hash_present`: true
- `client_session_present`: true
- `click_id_hash_present`: true
- `would_store`: false
- `would_send`: false
- `no_raw_echo_verified`: true
- `no_platform_send_verified`: true

상세 JSON: `data/path-b-agent-os-preview-rename-result-20260509.json`

## 금지선 준수

- GTM Production publish: 하지 않음.
- GTM submit/create_version: 하지 않음.
- Imweb production save: 하지 않음.
- backend operational storage canary: 하지 않음.
- platform send: 하지 않음.
- conversion upload: 하지 않음.
- 기존 live GTM tag pause/delete/edit: 하지 않음.

## 다음 확인

Tag Assistant를 새로 Preview 연결하면 이제 이벤트 이름은 아래로 보여야 한다.

```text
agent_os_path_b_user_identity_preview_result
```

Auditor verdict: PASS_AGENT_OS_RENAME
