# Path B HURDLERS user_id HMAC-only Preview 결과

작성 시각: 2026-05-09 01:22 KST
대상: biocom Path B 주문-클릭 bridge
상태: controlled_preview_pass / real_browser_preview_pending
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
    - GTM fresh workspace creation
    - Preview-only tag smoke
    - no-send HMAC endpoint call
    - read-only PM2 log check
  forbidden_actions:
    - GTM Production publish
    - GTM submit/create_version
    - Imweb production save
    - backend operational storage canary
    - operational schema migration
    - raw email/phone/member_code/order storage
    - raw email/phone/member_code/order logging
    - Google Ads/GA4/Meta/TikTok/Naver send
    - Google Ads conversion upload
    - existing GTM tag pause/delete/edit
  source_window_freshness_confidence:
    source: "data/path-b-hurdlers-user-id-preview-result-20260509.json + VM PM2 log grep"
    window: "2026-05-09 01:17-01:22 KST"
    freshness: "2026-05-09 01:22 KST"
    confidence: 0.9
```

## 10초 결론

controlled smoke 기준으로는 HURDLERS user_id를 email source로 넣어 `email_hash_present=true`를 만들 수 있다.
서버 응답은 raw 값을 돌려주지 않았고, PM2 로그에서도 synthetic raw pattern match는 0이었다.
다만 TJ님 로그인 브라우저의 실제 주문완료 화면에서는 아직 결과 이벤트를 캡처해야 한다.

## 결과 요약

- Verdict: `PASS_CONTROLLED_HURDLERS_USER_ID_HMAC_PREVIEW_READY`
- Workspace ID: `164`
- Tag ID: `293`
- Trigger ID: `292`
- Response status: `200`
- `email_hash_present`: true
- `identity_source`: email
- `order_no_hash_present`: true
- `client_session_present`: true
- `click_id_hash_present`: true
- `would_store`: false
- `would_send`: false
- `no_raw_echo_verified`: true
- `no_platform_send_verified`: true
- `platform_send_count`: 0
- PM2 raw pattern match: 0

상세 JSON: `data/path-b-hurdlers-user-id-preview-result-20260509.json`

## 무엇을 확인했나

주문완료 화면을 흉내 낸 controlled Preview에서 GTM quick preview JS를 불러왔다.
그 화면에는 HURDLERS `user_id` 변수가 읽을 수 있는 이메일형 DOM source를 넣었다.
새 Preview tag는 이 값을 no-send endpoint로 transient 전달했다.

서버는 즉시 normalize + HMAC-SHA256을 수행하고, response에는 hash present boolean과 hash prefix만 반환했다.

## 이번 결과가 말하는 것

말하는 것:

- 새 Preview tag 구조는 컴파일된다.
- 주문완료 path trigger는 동작한다.
- HURDLERS user_id source가 값만 있으면 `email_hash_present=true`가 가능하다.
- no-send endpoint는 `would_store=false`, `would_send=false`를 유지한다.
- response raw echo는 발생하지 않았다.
- PM2 최근 로그에서 synthetic raw pattern match는 0이었다.

말하지 않는 것:

- TJ님 실제 로그인 브라우저의 주문완료 화면에서 HURDLERS user_id가 항상 존재한다는 뜻은 아니다.
- 실제 광고 클릭에서 들어온 click id가 주문완료까지 보존된다는 뜻은 아니다.
- 운영 저장 canary나 Google Ads 전송 준비가 끝났다는 뜻은 아니다.

## 남은 실제 Preview 확인

TJ님 브라우저에서 주문완료 화면을 다시 열어 아래 이벤트를 확인해야 한다.

```text
path_b_hurdlers_user_id_preview_result
```

성공 화면 기준:

- `response_status=200`
- `email_hash_present=true`
- `identity_source=email`
- `order_no_hash_present=true`
- `client_session_present=true`
- `would_store=false`
- `would_send=false`
- `no_raw_echo_verified=true`
- `no_platform_send_verified=true`
- `platform_send_count=0`

## 금지선 준수

- GTM Production publish: 하지 않음.
- GTM submit/create_version: 하지 않음.
- Imweb production save: 하지 않음.
- backend operational storage canary: 하지 않음.
- operational schema migration: 하지 않음.
- raw email/phone/member_code/order storage: 하지 않음.
- 운영 raw logging: 하지 않음.
- Google Ads/GA4/Meta/TikTok/Naver send: 하지 않음.
- Google Ads conversion upload: 하지 않음.
- 기존 GTM tag pause/delete/edit: 하지 않음.

Auditor verdict: PASS_WITH_REAL_BROWSER_EVIDENCE_PENDING
