# 더클린커피 Meta InitiateCheckout no-send GTM Preview 생성 결과

작성 시각: 2026-05-24 13:36 KST
기준일: 2026-05-24
문서 성격: GTM Preview workspace/tag/trigger 생성 결과
Lane: Yellow approved Preview / Red needed for Production publish or Meta browser send

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - harness/coffee-data/README.md
    - harness/coffee-data/RULES.md
    - harness/coffee-data/VERIFY.md
    - harness/coffee-data/AUDITOR_CHECKLIST.md
  required_context_docs:
    - GA4/gtm-thecleancoffee.md
    - project/coffee-meta-checkout-event-gap-gtm-preview-plan-20260522.md
    - scripts/coffee-meta-middle-funnel-browser-fallback-nosend-snippet.js
  lane: Yellow
  allowed_actions:
    - GTM fresh workspace create
    - GTM no-send Custom HTML tag create
    - GTM DOM Ready trigger create
    - GTM quick_preview
    - documentation_update
  forbidden_actions:
    - GTM Submit/Create version/Production publish
    - Meta browser event production send
    - Meta CAPI enable/send
    - GA4/Google Ads/Naver/TikTok production send
    - production DB or VM Cloud SQLite write
  source_window_freshness_confidence:
    source: GTM API workspace/tag/trigger create response + read-only postcheck
    window: 2026-05-24 13:29~13:36 KST
    freshness: same-turn GTM API response
    confidence: 0.92
```

## 결과

더클린커피 GTM `GTM-5M33GC4`에 Meta `InitiateCheckout` 운영 전송 후보를 검증하기 위한 no-send Preview 태그를 만들었다. 실제 Meta/GA4/Google Ads 전송은 만들지 않고, Preview 화면에서 `coffee_meta_middle_funnel_preview` dataLayer event만 볼 수 있게 했다.

## 생성된 GTM 리소스

- workspace: `codex_coffee_meta_initiatecheckout_nosend_preview_20260524T042930Z` / id `30`
- trigger: `codex_coffee_shop_payment_domready_nosend_20260524T042930Z` / id `95`
- tag: `codex_coffee_meta_initiatecheckout_nosend_preview_20260524T042930Z` / id `96`
- environment: id `97`, authorization code present

트리거 조건:

- `Page Hostname` equals `thecleancoffee.com`
- `Page URL` matches `/shop_payment/` with order hint query
- `HURDLERS - Iframe` equals `false`

태그 동작:

- `/shop_payment/` 주문서 URL에서만 실행된다.
- `order_code`, `order_no`, `checkoutId` 중 하나가 없으면 중단한다.
- `window.dataLayer.push({ event: "coffee_meta_middle_funnel_preview", eventName: "InitiateCheckout", ... })`만 수행한다.
- `fbq`, `gtag`, `fetch`, `sendBeacon`, `Image`, `facebook.com/tr`, `att.ainativeos.net` 호출은 없다.

## 검증

- live version before/after: `21` / `21`
- live version unchanged: `true`
- workspace change count: `2`
- merge conflict count: `0`
- quick_preview compiler error: `false`
- Submit/Create version/Production publish: `0건`
- platform send: `0건`
- output JSON: `data/project/coffee-meta-initiatecheckout-gtm-preview-create-20260524T042930Z.json`
- latest JSON: `data/project/coffee-meta-initiatecheckout-gtm-preview-create-latest.json`

## 첫 시도 메모

첫 실행은 workspace/tag/trigger 생성 뒤 `quick_preview` 단계에서 OAuth scope 부족으로 실패했다. 스크립트 catch가 생성 workspace를 삭제했고, read-only postcheck에서 Default Workspace만 남고 live version 21이 유지됨을 확인했다. 이후 `tagmanager.edit.containerversions` scope를 추가해 재실행했고, 현재 workspace id 30만 남아 있다.

## 다음 확인

1. Tag Assistant에서 workspace id 30의 Preview를 연결한다.
2. 실제 주문서 URL `/shop_payment/?order_code=...&order_no=...`에서 `coffee_meta_middle_funnel_preview`가 1회만 생기는지 본다.
3. Meta Pixel Helper에 운영 `InitiateCheckout`이 새로 뜨지 않아야 한다.
4. 성공하면 실제 Meta browser event 운영 전송 여부는 별도 승인안으로 분리한다.

## 2026-05-24 TJ님 subscription Preview 관측

TJ님이 GTM Preview workspace를 연결하고 `https://thecleancoffee.com/subscription/?idx=74&__seo_attribution_debug=1`에서 정기구독 흐름을 확인했다.

Pixel Helper 관측:

- Meta Pixel id: `1186437633687388`
- `InitiateCheckout` 관측됨.
- URL: `/subscription/?idx=74&__seo_attribution_debug=1&gtm_debug=...`
- value: `21900.00`
- currency: `KRW`
- advanced matching: external_id, zp present
- frame: IFrame
- eventID: `InitiateCheckout.{order-code-like}.{short-suffix}` 형식
- `SubscribedButtonClick` 자동 감지 이벤트도 복수 관측됨.

해석:

- 이 `InitiateCheckout`은 본 no-send GTM tag 96의 결과로 보기 어렵다.
- 이유 1: tag 96 trigger는 `/shop_payment/` + order hint 조건이고 `/subscription/`에는 발화하지 않아야 한다.
- 이유 2: tag 96은 `coffee_meta_middle_funnel_preview` dataLayer event만 만들고 `fbq`, `gtag`, `fetch`, `sendBeacon`, `Image`, `facebook.com/tr`를 호출하지 않는다.
- 이유 3: tag 96의 preview eventID 형식은 `InitiateCheckout.{8-char-hash}`인데, 관측 eventID는 order code 계열 값이 포함된 native/FBE 또는 Phase 9 wrapper 계열 형식이다.

판정:

- 정기구독 상품 흐름에서는 Imweb/FBE 또는 기존 footer wrapper 계열이 Meta browser `InitiateCheckout`을 실제로 만들고 있다.
- 이번 관측은 “Coffee 전체에서 `InitiateCheckout` 원천이 항상 없다”가 아니라, “일반 `/shop_payment/` 주문서 진입에서 빠져 있고, subscription 흐름에는 원천이 있을 수 있다”로 분리해야 한다.
- no-send Preview의 원래 검증 대상은 여전히 실제 `/shop_payment/?order_code=...&order_no=...` 주문서 URL이다.

## 2026-05-24 주문서 화면 no-send Preview PASS

TJ님이 실제 주문서 화면에서 Tag Assistant와 console을 확인했다.

관측:

- tag `codex_coffee_meta_initiatecheckout_nosend_preview_20260524T042930Z`가 1회 Fired.
- firing timing: event 22 `DOM 사용 가능`.
- 같은 timing에서 기존 `AGENTSOS - [begin_checkout] 주문서작성`도 Fired.
- 좌측 event timeline에는 `coffee_meta_middle_funnel_preview`가 생성됨.
- console payload:
  - `event`: `coffee_meta_middle_funnel_preview`
  - `eventName`: `InitiateCheckout`
  - `eventID`: `InitiateCheckout.{8-char-hash}` 형식
  - `noSend`: `true`
  - `noFbq`: `true`
  - `noPixelRequest`: `true`
  - `pagePath`: `/shop_payment/`
  - `customData.currency`: `KRW`
  - `customData.value`: `21900`
  - `customData.value_status`: `present`
  - `customData.value_selector`: `#oms-shop-payment text:총 주문금액`

판정:

- `/shop_payment/` 주문서 화면에서 no-send Preview 태그는 의도대로 1회 발화했다.
- value/currency 추출도 성공했다.
- 이 태그 자체는 실제 Meta `fbq` 또는 `facebook.com/tr` 요청을 만들지 않는다.
- 남은 확인은 Pixel Helper 또는 Network에서 같은 주문서 화면의 운영 `InitiateCheckout`이 새로 생겼는지 여부다. 없으면 no-send Preview는 최종 PASS로 닫는다.

## 2026-05-24 Pixel Helper 추가 확인 — 최종 PASS

TJ님이 같은 Preview 세션에서 Meta Pixel Helper를 재확인했다.

확인 결과:

- `/shop_payment/` 주문서 화면에서 추가 운영 `InitiateCheckout`은 없었다.
- Pixel Helper에 남은 `InitiateCheckout` 1건은 `/subscription/?idx=74...` URL 기준 이벤트였다.
- value/currency: `21900.00` / `KRW`
- eventID: `InitiateCheckout.{order-code-like}.{short-suffix}` 형식

최종 판정:

- no-send Preview tag 96은 실제 Meta browser event를 만들지 않았다.
- 주문서 화면에서는 `coffee_meta_middle_funnel_preview` dataLayer event만 1회 생성됐다.
- 정기구독 흐름의 기존 `InitiateCheckout`과 일반 주문서 no-send Preview는 분리해 볼 수 있다.
- GTM Preview tag/trigger/payload 검증은 `PASS_FINAL_NO_SEND`.

## 2026-05-24 Preview workspace cleanup

no-send Preview가 최종 PASS로 닫혔기 때문에 workspace id `30`은 운영 publish 후보로 남기지 않고 삭제했다.

처리 결과:

- cleanup result JSON: `data/project/coffee-meta-initiatecheckout-gtm-preview-workspace30-cleanup-20260524T072654Z.json`
- cleanup verdict: `PASS_PREVIEW_WORKSPACE30_CLEANUP`
- workspace id `30` present after cleanup: `false`
- live version before/after: `21` / `21`
- live version unchanged: `true`
- workspace count before/after: `2` / `1`
- Submit/Create version/Production publish: `0건`
- Meta/GA4/Google Ads/Naver/TikTok platform send: `0건`

판정:

- no-send evidence는 본 문서와 JSON으로 보존했다.
- 실제 Meta browser `InitiateCheckout` 운영 반영은 fresh workspace에서 다시 만들어야 한다.
- workspace id `30`을 남기면 no-send 태그가 운영 후보로 오해될 수 있으므로 삭제가 맞다.
