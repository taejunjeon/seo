# Path B GTM Preview final checklist

작성 시각: 2026-05-08 23:23 KST
대상: biocom GTM Preview only / Path B order bridge
Status: final_checklist_ready__execution_requires_yellow_approval
관련 문서: [[path-b-limited-deploy-approval-20260508]], [[path-b-preview-tag-draft-20260508]], [[path-b-email-phone-preview-plan-20260508]], [[gtm-retous-imweb-dependency-map-20260508]]
Do not use for: GTM Production publish, Imweb production save, live payment-success endpoint call, platform send, raw email/phone/member_code 저장

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - ../AGENTS.md
    - CLAUDE.md
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
    - gdn/path-b-limited-deploy-approval-20260508.md
    - gdn/path-b-preview-tag-draft-20260508.md
  lane: Green checklist writing; Yellow required for GTM Preview execution
  allowed_actions:
    - Preview checklist writing
    - Preview tag draft hardening
    - evidence template design
  forbidden_actions:
    - GTM Production publish
    - GTM tag pause/delete
    - Imweb production save
    - backend 운영 deploy
    - operational schema migration
    - raw email/phone/member_code storage
    - raw email/phone/member_code logging
    - Google Ads/GA4/Meta/TikTok/Naver 전송
    - Google Ads conversion upload
  source_window_freshness_confidence:
    source: "TJ Tag Assistant evidence 199~203 + local no-send endpoint + GTM dependency map"
    window: "2026-05-08 KST"
    freshness: "2026-05-08 23:23 KST"
    confidence: 0.86
```

## 10초 결론

이 체크리스트는 GTM Preview에서 “주문과 클릭을 잇는 재료가 실제 화면에 있는지” 확인하기 위한 최종 실행표다.

Production publish가 아니다. Preview 화면에서만 tag를 넣고, no-send endpoint가 raw 값을 응답/저장/로그하지 않는지 본다.

## Preview 전에 닫아야 할 조건

1. receiver URL이 준비되어야 한다.
   - Mode A: `https://att.ainativeos.net/api/attribution/order-bridge/identity-hmac/no-send`
   - Mode T: 임시 HTTPS tunnel URL + path-limited proxy
2. receiver smoke가 PASS해야 한다.
   - 200 success.
   - 413 oversized.
   - response raw echo 0.
   - PM2/raw log 0.
3. GTM은 fresh workspace만 쓴다.
4. Submit/Publish 버튼은 누르지 않는다.
5. 기존 NPay 구매 전환/GA4/Google Ads tag는 건드리지 않는다.

## 테스트 케이스

1. 로그인 홈페이지 결제완료 화면
   - 목적: email/phone/order/session 후보가 보이는지 확인.
   - 성공 기준: `email_hash_present` 또는 `phone_hash_present` 중 하나 이상 true, `order_no_hash_present` true, `client_session_present` true.

2. 비로그인 홈페이지 결제완료 화면
   - 목적: Path C가 못 보는 비회원도 Path B로 잡을 수 있는지 확인.
   - 성공 기준: email/phone/order/session 후보 중 실제 가능한 값이 명확히 기록됨.

3. NPay 결제 시작 후 biocom 복귀 여부
   - 목적: NPay가 결제완료 화면으로 돌아오는지 분리.
   - 성공 기준: 복귀하면 Path B 후보, 복귀하지 않으면 `npay_no_thanks_page`로 HOLD.

주의:

- 실제 결제 테스트는 별도 승인 전에는 하지 않는다.
- 기존 주문/테스트 환경으로 화면 접근이 가능하면 먼저 read-only/Preview evidence만 수집한다.

## GTM 작업 순서

1. GTM `GTM-W2Z6PHN`에서 fresh workspace를 만든다.
2. Custom HTML tag 이름은 아래처럼 둔다.
   - `PathB_order_bridge_identity_hmac_preview_no_send_20260508`
3. Trigger는 결제완료 화면으로 제한한다.
   - Page URL contains `/shop_payment/`
   - 또는 실제 결제완료 dataLayer event가 확인된 경우 그 event만 사용.
4. Trigger 금지:
   - All Pages.
   - NPay 구매하기 버튼 클릭.
   - 기존 Google Ads/GA4 conversion trigger 재사용.
5. Preview를 실행한다.
6. Network와 Tag Assistant에서 evidence를 캡처한다.
7. workspace를 discard하거나 tag를 publish하지 않은 상태로 닫는다.

## 보강된 Preview tag 초안

아래 코드는 Preview 전용 초안이다. Production publish 금지.

```html
<script>
(function () {
  var ENDPOINT = "https://att.ainativeos.net/api/attribution/order-bridge/identity-hmac/no-send";
  var MAX_BODY_BYTES = 12 * 1024;
  var isPreview = /gtm_debug=|gtm_preview=|gtm_auth=/.test(location.search);
  if (!isPreview) return;

  function clean(value) {
    return value == null ? "" : String(value).trim();
  }

  function text(selector) {
    var el = document.querySelector(selector);
    return el && "value" in el ? clean(el.value) : clean(el && el.textContent);
  }

  function dataLayerLast(keys) {
    var dl = window.dataLayer || [];
    for (var i = dl.length - 1; i >= 0; i -= 1) {
      for (var j = 0; j < keys.length; j += 1) {
        var key = keys[j];
        if (dl[i] && dl[i][key]) return clean(dl[i][key]);
      }
    }
    return "";
  }

  function gaClientId() {
    var m = document.cookie.match(/(?:^|; )_ga=GA\\d\\.\\d\\.(\\d+\\.\\d+)/);
    return m ? m[1] : "";
  }

  var payload = {
    site: "biocom",
    capture_stage: "order_confirm_preview",
    email: text("[name='ordererEmail']") || text("[name='email']") || dataLayerLast(["email", "email_buy"]),
    phone: text("[name='ordererCall']") || text("[name='phone']") || dataLayerLast(["phone", "phone_buy"]),
    order_no: dataLayerLast(["order_no", "orderNo", "order_number", "orderNumber", "transaction_id"]),
    client_id: dataLayerLast(["client_id", "clientId"]) || gaClientId(),
    ga_session_id: dataLayerLast(["ga_session_id", "gaSessionId"]),
    local_session_id: dataLayerLast(["local_session_id", "localSessionId"]),
    click_id: dataLayerLast(["gclid", "gbraid", "wbraid", "ttclid", "nclick_id"]),
    preview_mode: true
  };

  var body = JSON.stringify(payload);
  if (body.length > MAX_BODY_BYTES) {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event: "path_b_order_bridge_preview_blocked",
      reason: "client_payload_too_large",
      would_store: false,
      would_send: false
    });
    return;
  }

  fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "omit",
    body: body
  })
    .then(function (res) { return res.json(); })
    .then(function (json) {
      var preview = json.preview || {};
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({
        event: "path_b_order_bridge_preview_result",
        would_store: false,
        would_send: false,
        response_ok: !!json.ok,
        email_hash_present: !!preview.email_hash_present,
        phone_hash_present: !!preview.phone_hash_present,
        order_no_hash_present: !!preview.order_no_hash_present,
        client_session_present: !!preview.client_session_present,
        click_id_hash_present: !!preview.click_id_hash_present,
        no_raw_echo_verified: !!preview.no_raw_echo_verified,
        no_platform_send_verified: !!preview.no_platform_send_verified,
        hash_version: preview.hash_version || ""
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

## Tag Assistant에서 볼 것

이전 TJ님 evidence에서 199~203 구간은 NPay 버튼 클릭 이후 흐름이었다.

이번 Preview에서는 아래만 확인한다.

- event 이름: `path_b_order_bridge_preview_result`.
- `would_store=false`.
- `would_send=false`.
- `email_hash_present`.
- `phone_hash_present`.
- `order_no_hash_present`.
- `client_session_present`.
- `no_raw_echo_verified=true`.
- `no_platform_send_verified=true`.

확인하지 않을 것:

- raw email 값.
- raw phone 값.
- raw order number.
- raw member_code.
- payment key.
- amount/value.

## Network에서 볼 것

허용 request:

- `POST /api/attribution/order-bridge/identity-hmac/no-send` 1건.
- OPTIONS preflight 1건.

금지 request:

- Google Ads conversion request.
- GA4 purchase send.
- Meta Purchase/CAPI.
- TikTok CompletePayment/Events API.
- Naver conversion send.
- 기존 `/api/attribution/payment-success` live endpoint 호출.

## PASS/HOLD/FAIL

PASS:

- no-send endpoint POST 200.
- response raw echo 0.
- `would_store=false`, `would_send=false`.
- `email_hash_present` 또는 `phone_hash_present` 중 하나 이상 true.
- `order_no_hash_present`와 `client_session_present`가 함께 true 또는 부족한 이유가 명확함.
- platform send 0.

HOLD:

- endpoint smoke가 아직 준비되지 않음.
- NPay가 biocom 결제완료 화면으로 복귀하지 않음.
- email/phone은 보이나 order/session 후보가 부족함.

FAIL:

- raw 값이 response/log/storage에 남음.
- live payment-success endpoint가 호출됨.
- platform send가 새로 발생함.
- GTM Submit/Publish가 필요해짐.

## Evidence 기록 양식

```text
case:
screen:
gtm_workspace:
tag_name:
trigger:
endpoint_url:
event_name:
http_status:
would_store:
would_send:
email_hash_present:
phone_hash_present:
order_no_hash_present:
client_session_present:
click_id_hash_present:
raw_echo_0:
pm2_raw_log_0:
platform_send_0:
console_error_count:
verdict:
notes:
```

## Auditor verdict

Auditor verdict: READY_FOR_YELLOW_PREVIEW
Lane: Yellow for GTM Preview execution
Mode: no-send / no-write / no-publish / no-platform-send
Recommendation: 제한 deploy 또는 tunnel smoke PASS 후 GTM Preview 실행
Confidence: 86%
