# Path B Preview tag 초안

작성 시각: 2026-05-08 23:03 KST
작업 시작: 2026-05-08 22:59 KST
작업 종료: 2026-05-08 23:06 KST
작업 소요 시간: 7분
대상: biocom GTM Preview only tag
Status: draft_only__no_publish
Next document: [[path-b-gtm-preview-final-checklist-20260508]]
Do not use for: GTM Production publish, Imweb production save, platform send

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - ../AGENTS.md
    - docurule.md
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
    - gdn/path-b-email-phone-preview-plan-20260508.md
    - gdn/path-b-no-send-hmac-local-implementation-20260508.md
  lane: Green tag draft documentation
  allowed_actions:
    - local markdown tag draft
    - Preview-only implementation sketch
  forbidden_actions:
    - GTM Production publish
    - Imweb production save
    - backend 운영 deploy
    - operational schema migration
    - platform send
    - raw email/phone/member_code storage
    - raw email/phone/member_code logging
  source_window_freshness_confidence:
    source: "Path B Preview plan + local no-send endpoint implementation"
    window: "2026-05-08 KST"
    freshness: "2026-05-08 23:03 KST"
    confidence: 0.84
```

## 10초 결론

이 문서는 GTM에 넣을 Path B Preview tag의 초안이다. Production publish용이 아니다.

목적은 결제완료 화면에서 email/phone/order/session/click 후보가 보이는지 확인하고, 우리 no-send endpoint가 HMAC만 반환하는지 확인하는 것이다.

2026-05-08 23:23 KST 보강: 실행용 최종 체크리스트와 보강 tag 초안은 [[path-b-gtm-preview-final-checklist-20260508]]에 있다. 이 문서는 초기 초안으로 유지한다.

## Trigger 초안

Preview 전용 trigger:

- Page URL contains `/shop_payment/`
- 또는 Page URL / dataLayer event에서 결제완료 화면임을 확인할 수 있는 조건.
- NPay가 thanks page로 복귀하지 않으면 `npay_no_thanks_page`로 분리 기록.

금지 trigger:

- 전 페이지 All Pages.
- NPay 구매하기 버튼 클릭 trigger.
- Google Ads/GA4 conversion trigger 재사용.

## Custom HTML 초안

아래 코드는 구조 초안이다. 실제 GTM Production publish 금지.

```html
<script>
(function () {
  var ENDPOINT = "https://att.ainativeos.net/api/attribution/order-bridge/identity-hmac/no-send";
  var isPreview = /gtm_debug=|gtm_preview=|gtm_auth=/.test(location.search);
  if (!isPreview) return;

  function text(selector) {
    var el = document.querySelector(selector);
    return el && el.value ? String(el.value) : "";
  }

  function dataLayerLast(key) {
    var dl = window.dataLayer || [];
    for (var i = dl.length - 1; i >= 0; i -= 1) {
      if (dl[i] && dl[i][key]) return String(dl[i][key]);
    }
    return "";
  }

  var payload = {
    site: "biocom",
    capture_stage: "order_confirm_preview",
    email: text("[name='ordererEmail']") || dataLayerLast("email"),
    phone: text("[name='ordererCall']") || dataLayerLast("phone"),
    order_no: dataLayerLast("order_no") || dataLayerLast("orderNo"),
    client_id: dataLayerLast("client_id"),
    ga_session_id: dataLayerLast("ga_session_id"),
    local_session_id: dataLayerLast("local_session_id"),
    click_id: dataLayerLast("gclid") || dataLayerLast("gbraid") || dataLayerLast("wbraid"),
    preview_mode: true
  };

  fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "omit",
    body: JSON.stringify(payload)
  })
    .then(function (res) { return res.json(); })
    .then(function (json) {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({
        event: "path_b_order_bridge_preview_result",
        would_store: false,
        would_send: false,
        email_hash_present: !!(json.preview && json.preview.email_hash_present),
        phone_hash_present: !!(json.preview && json.preview.phone_hash_present),
        order_no_hash_present: !!(json.preview && json.preview.order_no_hash_present),
        client_session_present: !!(json.preview && json.preview.client_session_present),
        no_platform_send_verified: !!(json.preview && json.preview.no_platform_send_verified)
      });
    })
    .catch(function () {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({
        event: "path_b_order_bridge_preview_error",
        would_store: false,
        would_send: false
      });
    });
})();
</script>
```

## Preview 확인 기준

PASS:

- Network request가 우리 no-send endpoint 1곳으로만 간다.
- response에 raw email/phone/order/member_code가 없다.
- `would_store=false`.
- `would_send=false`.
- `no_platform_send_verified=true`.
- `email_hash_present` 또는 `phone_hash_present`가 true다.
- `order_no_hash_present`와 `client_session_present` 중 가능한 값이 명확하다.

HOLD:

- endpoint가 아직 운영 제한 배포되지 않았다.
- NPay가 결제완료 페이지로 복귀하지 않는다.
- email/phone은 보이나 order/session/click 후보가 부족하다.

FAIL:

- Google/GA4/Meta/TikTok/Naver network request가 새로 발생한다.
- response/log/storage에 raw 값이 보인다.
- GTM Submit/Publish가 필요해진다.

## 운영 금지선

이 tag 초안은 Preview에서만 쓴다. Production publish, Imweb body/footer 저장, tag pause/delete는 하지 않는다.
