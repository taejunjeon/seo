# Path B GTM Preview guard fix 결과

작성 시각: 2026-05-09 00:34 KST
대상: GTM workspace `163`, tag `290`
Lane: Yellow approved Preview only
Mode: no-submit / no-publish / no-platform-send

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
  lane: Yellow Preview fix
  allowed_actions:
    - GTM Preview workspace tag update
    - quick_preview compile
    - synthetic no-send smoke
  forbidden_actions:
    - GTM submit/create_version
    - GTM Production publish
    - Imweb production save
    - operational schema migration
    - backend operational storage canary
    - platform send
    - Google Ads conversion upload
  source_window_freshness_confidence:
    source: "TJ님 Tag Assistant blocked event + GTM API update + synthetic Tag Assistant style smoke"
    window: "2026-05-09 00:31-00:34 KST"
    freshness: "2026-05-09 00:34 KST"
    confidence: 0.9
```

## 10초 결론

`path_b_order_bridge_preview_blocked` 원인은 결제완료 URL이 아니라 태그 내부의 URL 기반 Preview guard였다.
Tag Assistant connected mode에서는 실제 페이지 URL에 `gtm_debug`, `gtm_preview`, `gtm_auth`가 안 보일 수 있어 guard가 `not_gtm_preview`로 잘못 막았다.

workspace `163`의 tag `290`에서 이 URL 기반 guard를 제거했고, synthetic Tag Assistant style smoke는 PASS했다.

## 조치

- tag `290`의 Custom HTML에서 `location.search` 기반 `isPreview()` 검사를 제거했다.
- 결제완료 URL scope guard는 유지했다.
- trigger `289`도 결제완료 URL 전용으로 유지했다.
- submit/create_version/publish는 하지 않았다.

## 검증

- quick preview compile: PASS.
- synthetic Tag Assistant style smoke: PASS.
- no-send endpoint status: 200.
- `would_store=false`.
- `would_send=false`.
- `order_no_hash_present=true`.
- `client_session_present=true`.
- `click_id_hash_present=true`.
- `no_raw_echo_verified=true`.
- `no_platform_send_verified=true`.
- platform send count: 0.
- PM2 raw log match: 0.

## 해석

TJ님 화면에서 같은 Preview workspace를 새로고침하면 이제 `path_b_order_bridge_preview_blocked` 대신 `path_b_order_bridge_preview_result`가 떠야 한다.

단, 실제 결제완료 화면에서 email/phone hash가 true인지 여부는 아직 미확정이다. synthetic URL에는 email/phone이 없어서 false가 정상이다.

## 산출물

- JSON: `data/path-b-gtm-preview-guard-fix-20260508T153305Z.json`
- latest JSON: `data/path-b-gtm-preview-guard-fix-latest.json`
- evidence update: `data/path-b-preview-evidence-20260509.json`
- script: `backend/scripts/path-b-order-bridge-gtm-fix-preview-guard.ts`

## 하지 않은 것

- GTM submit/create_version 하지 않음.
- GTM Production publish 하지 않음.
- Imweb production save 하지 않음.
- 운영 저장 canary 하지 않음.
- Google Ads/GA4/Meta/TikTok/Naver 전송 하지 않음.
- 기존 GTM tag pause/delete 하지 않음.

Auditor verdict: PASS_PREVIEW_GUARD_FIX
Confidence: 90%
