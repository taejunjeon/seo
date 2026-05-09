# Path B HURDLERS user_id Preview tag diff 초안

작성 시각: 2026-05-09 01:21 KST
대상: biocom GTM `GTM-W2Z6PHN`
상태: controlled_preview_ready
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
  lane: Yellow Preview only
  allowed_actions:
    - GTM fresh workspace creation
    - Preview-only custom HTML tag creation
    - existing HURDLERS user_id variable read
    - Path B no-send HMAC endpoint smoke
    - hash-only evidence collection
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
    source: "GTM Preview API workspace 164 + controlled synthetic smoke"
    window: "2026-05-09 01:17-01:21 KST"
    freshness: "2026-05-09 01:21 KST"
    confidence: 0.92
```

## 10초 결론

새 GTM Preview workspace에 Path B HURDLERS user_id 전용 Preview tag 초안을 만들었다.
기존 HURDLERS 태그는 수정하지 않았다.
새 태그는 주문완료 화면에서만 실행되고, 기존 HURDLERS `user_id` 값을 우리 no-send HMAC endpoint의 transient email 후보로만 보낸다.

## 실제 생성된 Preview workspace

- Workspace ID: `164`
- Workspace name: `codex_path_b_hurdlers_user_id_preview_20260508T161749Z`
- Trigger ID: `292`
- Trigger name: `PathB_hurdlers_order_confirm_pages_preview_20260508T161749Z`
- Tag ID: `293`
- Tag name: `PathB_hurdlers_user_id_identity_hmac_preview_no_send_20260508T161749Z`
- Quick Preview environment ID: `294`
- Submit: NO.
- Publish: NO.

## tag diff 핵심

추가된 것은 새 Custom HTML tag 하나다.

기존 HURDLERS 태그와 변수는 pause/delete/edit 하지 않는다.
새 태그 안에서만 아래 source를 읽는다.

```js
var HURDLERS_USER_ID = clean("{{HURDLERS - [맞춤 JS] user_id}}");

var payload = {
  site: "biocom",
  capture_stage: "order_confirm_hurdlers_user_id_preview",
  email: HURDLERS_USER_ID || text(".email-info") || dataLayerLast(["email", "email_buy", "ordererEmail", "buyerEmail"]),
  email_source_candidate: HURDLERS_USER_ID ? "hurdlers_user_id" : "none",
  order_no: searchParam(["order_no", "orderNo", "order_id", "orderId", "order_code", "orderCode"]) || dataLayerLast(["order_no", "orderNo", "order_number", "orderNumber", "transaction_id"]),
  client_id: dataLayerLast(["client_id", "clientId"]) || storageFirst(["client_id", "clientId"]) || gaClientId(),
  ga_session_id: dataLayerLast(["ga_session_id", "gaSessionId"]) || storageFirst(["ga_session_id", "gaSessionId"]) || gaSessionId(),
  local_session_id: dataLayerLast(["local_session_id", "localSessionId"]) || storageFirst(["local_session_id", "localSessionId", "commonSessionId", "customSessionId"]),
  click_id: searchParam(["gclid", "gbraid", "wbraid", "ttclid", "nclick_id"]) || dataLayerLast(["gclid", "gbraid", "wbraid", "ttclid", "nclick_id"]) || storageFirst(["gclid", "gbraid", "wbraid", "ttclid", "nclick_id"]),
  preview_mode: true
};

fetch("https://att.ainativeos.net/api/attribution/order-bridge/identity-hmac/no-send", {
  method: "POST",
  mode: "cors",
  credentials: "omit",
  keepalive: true,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(payload)
});
```

## 실행 범위

Trigger는 `{{Page Path}}`가 아래 정규식과 맞을 때만 발화한다.

```text
shop_payment_complete|shop_order_done|payment_complete|order_complete
```

All Pages trigger는 쓰지 않는다.
Default Workspace는 쓰지 않는다.
Production publish는 하지 않는다.

## response에서 보는 값

dataLayer에는 raw email을 넣지 않는다.
아래 boolean과 상태만 남긴다.

- `response_status`
- `response_ok`
- `identity_source`
- `email_hash_present`
- `order_no_hash_present`
- `client_session_present`
- `click_id_hash_present`
- `would_store=false`
- `would_send=false`
- `no_raw_echo_verified`
- `no_platform_send_verified`
- `platform_send_count`

## Hard Fail

- raw email이 response에 보임.
- raw email이 PM2/nginx/browser storage에 남음.
- `would_store=true`.
- `would_send=true`.
- platform send request가 새로 생김.
- tag가 주문완료 외 화면에서 발화함.
- 기존 HURDLERS 태그를 수정해야 함.
- Submit 또는 Production publish가 필요해짐.

## 다음 사용법

TJ님 브라우저에서 Tag Assistant Preview를 다시 연결한 뒤 주문완료 화면을 열고, 이벤트 `path_b_hurdlers_user_id_preview_result`를 확인한다.

성공 기준은 아래다.

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

Auditor verdict: PASS_CONTROLLED_TAG_DIFF_READY
