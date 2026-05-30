# Google NPay bridge URL capture v1.1 - 2026-05-28

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - harness/npay-recovery/RULES.md
    - harness/npay-recovery/VERIFY.md
  required_context_docs:
    - project/google-npay-row-level-verification-runbook-20260528.md
    - project/google-npay-button-bridge-gtm-patch-and-bi-confirmed-plan-20260528.md
    - project/google-npay-bridge-hash-hardening-20260528.md
  lane: Green for code/document draft, Yellow for GTM Preview, Red for GTM Production publish
  allowed_actions:
    - local code/document draft
    - no-send design
    - syntax check
    - GTM Preview support after TJ-approved preview workspace
  forbidden_actions:
    - GTM Production publish
    - Google Ads conversion upload/send
    - production DB write
    - raw bridge URL server storage without separate approval
  source_window_freshness_confidence:
    source: biocom live product page HTML + Imweb site_shop.js + VM Cloud row-level summary
    window: 2026-05-28 KST investigation
    freshness: live HTML/JS checked on 2026-05-28
    confidence: high for Imweb NPay redirect path, medium until GTM Preview smoke captures bridge hash
```

## 한 줄 결론

기존 GTM Preview 태그가 놓친 핵심은 `window.location.href = result.npay_url` 직전의 아임웹 AJAX 성공 응답이다. v1.1은 NPay 버튼 클릭뿐 아니라 `SITE_SHOP_DETAIL.confirmOrderWithCartItems`, `$.ajax success(result)`, `XMLHttpRequest`, `fetch`, 동적 DOM 삽입을 같이 감싸서 `result.npay_url`을 잡는다.

## 왜 v1이 비었나

실제 바이오컴 상품 페이지의 NPay 버튼은 버튼 HTML에 최종 네이버페이 URL을 들고 있지 않다.

```js
SITE_SHOP_DETAIL.confirmOrderWithCartItems("npay", "https://biocom.kr/shop_view/?idx=198");
```

아임웹 내부 JS 흐름은 다음에 가깝다.

```text
NPay 버튼 클릭
→ SITE_SHOP_DETAIL.confirmOrderWithCartItems("npay", ...)
→ /shop/add_order.cm AJAX POST
→ result.npay_url 수신
→ window.location.href = result.npay_url
→ orders.pay.naver.com 또는 nid.naver.com 이동
```

`window.location.href = ...` 직접 대입은 브라우저에서 안정적으로 monkey patch하기 어렵다. 그래서 URL이 만들어지는 바로 앞 단계인 `$.ajax success(result)`에서 `result.npay_url`을 잡아야 한다.

## v1.1 보강점

1. `SITE_SHOP_DETAIL.confirmOrderWithCartItems("npay", ...)` 호출을 감싼다.
2. `$.ajax`를 감싸 `/shop/add_order.cm` 또는 `/shop/oms/OMS_add_order.cm` + `type=npay` 응답을 본다.
3. 응답 object 안의 `npay_url`, `npayUrl`, `redirect_url`, `bridge_url`, `url` 계열을 재귀적으로 검사한다.
4. XHR/fetch 응답 텍스트에서도 네이버페이 URL을 탐색한다.
5. 동적으로 생기는 `<a href>`, `<form action>`, `<iframe src>`도 관찰한다.
6. 서버에는 기존과 같이 `npayBridgeUrl`을 보내되, VM Cloud는 원문을 저장하지 않고 hash/host/path hash로 보관한다.

## 원문 URL 저장 검토

TJ님 의견처럼 "해시 때문에 연결이 안 되는" 상황은 아니다. 지금 병목은 원문이든 해시든 URL 자체가 서버에 0건 들어온 것이다. 따라서 1순위는 raw 저장이 아니라 `result.npay_url` 캡처다.

원문 저장에 대한 판단:

- Google Ads 정책 관점: 원문 NPay URL을 Google Ads에 보내지 않는 한, Google Ads 정책 이슈라기보다는 내부 개인정보/보안 관리 이슈다.
- 보안 관점: NPay bridge URL에는 외부 결제 세션을 식별할 수 있는 token성 path가 들어갈 수 있어 장기 raw 저장은 권장하지 않는다.
- 연결 관점: 같은 URL인지 비교하는 목적이면 hash로 충분하다. 사람이 디버그해야 할 때만 짧은 시간 원문 확인이 필요하다.

따라서 v1.1에서는 원문을 서버에 저장하지 않는다. 대신 GTM Preview/Network에서 원문 URL을 눈으로 확인하고, VM Cloud에는 hash/host/path hash가 생겼는지 확인한다. 그래도 raw가 필요하면 다음 단계에서 `preview-only`, `admin-only`, `TTL 24h`, `암호화 또는 즉시 삭제` 조건으로 별도 승인안을 만든다.

공식 문서 기준으로도 Google Ads에 보내는 URL에 개인정보가 섞이면 문제가 될 수 있다. Google Ads Help는 Google 태그가 URL을 수집할 수 있으므로 URL에 PII가 들어가지 않게 처리하라고 안내한다. Google Ads API 오프라인 전환 업로드에는 `gclid/gbraid/wbraid`, 전환시각, 값, 통화, order id가 핵심이지 NPay bridge 원문 URL이 필수값이 아니다.

참고:

- Google Ads Help: About PII in URLs - https://support.google.com/google-ads/answer/6389382
- Google Ads API: Manage offline conversions - https://developers.google.com/google-ads/api/docs/conversions/upload-offline

## 적용 파일

GTM Custom HTML에 넣을 스크립트 본문:

- `/Users/vibetj/coding/seo/imweb/biocom-npay-bridge-gtm-v1-1-preview.js`

GTM에는 아래 형태로 감싼다.

```html
<!-- BI NPay Bridge Intent Capture v1.1 Preview -->
<script>
/* /Users/vibetj/coding/seo/imweb/biocom-npay-bridge-gtm-v1-1-preview.js 내용 전체 붙여넣기 */
</script>
```

## Preview 성공 기준

1. Google 광고 클릭 후 바이오컴 상품 페이지에 진입한다.
2. NPay 버튼만 누른다. 로그인/결제는 하지 않는다.
3. Network에서 `/api/attribution/npay-intent` 호출이 보인다.
4. request payload에 `gclid` 또는 `gbraid` 또는 `wbraid` 중 하나가 있다.
5. request payload에 `npayBridgeUrl`이 있다.
6. VM Cloud row-level 조회에서 `source=gtm_npay_bridge_v1_1` row의 `has_npay_bridge_url_hash=true`가 나온다.
7. Google Ads 전환 업로드나 GTM Production publish는 발생하지 않는다.

## 실패 시 해석

- payload는 생기지만 `npayBridgeUrl`이 비어 있음: 아임웹 응답이 `$.ajax` wrapper보다 먼저 실행됐거나, NPay URL이 다른 필드명으로 내려온 것이다. Network의 `/shop/add_order.cm` response field를 추가로 확인한다.
- `/api/attribution/npay-intent` 자체가 없음: GTM Preview workspace에서 태그 firing trigger가 맞지 않거나, NPay button click selector가 안 맞는 것이다.
- row-level에는 저장됐지만 hash가 없음: VM Cloud receiver의 bridge URL allowlist 또는 field alias를 확인한다.

## 다음 판단

v1.1 Preview smoke에서 bridge hash가 1건이라도 생기면, 다음은 GTM Production publish 승인안이다. 그 전까지는 실제 사용자의 전체 트래픽에 반영하지 않는다.
