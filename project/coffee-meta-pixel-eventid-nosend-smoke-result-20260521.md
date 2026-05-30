# 더클린커피 Meta Pixel eventId No-send Smoke 결과

작성 시각: 2026-05-21 23:59 KST
기준일: 2026-05-21
문서 성격: Coffee live page Meta Pixel browser eventId no-send smoke 결과
Lane: Green browser smoke / no-send / no-write
정본 연결: `imweb/!coderule-thecleancoffee.md`, `project/coffee-google-click-id-structured-storage-plan-20260521.md`, `GA4/gtm-thecleancoffee.md`

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - harness/coffee-data/README.md
    - harness/coffee-data/RULES.md
    - harness/coffee-data/VERIFY.md
    - harness/coffee-data/AUDITOR_CHECKLIST.md
  required_context_docs:
    - imweb/!coderule-thecleancoffee.md
    - project/coffee-google-click-id-structured-storage-plan-20260521.md
    - GA4/gtm-thecleancoffee.md
  lane: Green
  allowed_actions:
    - Playwright browser smoke
    - facebook pixel request capture
    - request abort before platform receipt
    - result documentation
  forbidden_actions:
    - Meta CAPI enable
    - Meta Events Manager live send confirmation
    - Purchase event test
    - Imweb save/publish
    - GTM Production publish
    - actual checkout or purchase
    - production DB or VM Cloud SQLite write
  source_window_freshness_confidence:
    source: thecleancoffee.com live page + Playwright route-captured Meta pixel requests
    window: 2026-05-21 23:58 KST
    freshness: live page smoke at report time
    confidence: 0.91
```

## 10초 요약

더클린커피 live page에서 Phase 9 Funnel CAPI mirror가 정상 설치되어 있고, synthetic middle-funnel 4종 이벤트에 eventId를 주입하는 것을 확인했다. `facebook.com/tr` 요청은 모두 캡처 후 abort했으므로 Meta 플랫폼으로 수신시키지 않았다.

`enableServerCapi=false`도 확인했다. Meta CAPI 서버 요청은 0건이었다. `Purchase` 요청도 0건이었다.

## 만든 파일

`backend/scripts/coffee-meta-pixel-eventid-nosend-smoke.mjs`

역할:

1. live page에서 `fbq`와 Funnel CAPI wrapper 상태를 확인한다.
2. `ViewContent`, `AddToCart`, `InitiateCheckout`, `AddPaymentInfo` synthetic browser 이벤트를 호출한다.
3. `facebook.com/tr` 요청을 캡처한 뒤 abort한다.
4. `att.ainativeos.net/api/meta/capi/track` 서버 CAPI 요청이 없는지 확인한다.

## 실행 명령

```bash
cd backend
node scripts/coffee-meta-pixel-eventid-nosend-smoke.mjs
```

## 실행 결과

source/window:

- source: `thecleancoffee.com` live page + Playwright route-captured Pixel request
- generatedAt: 2026-05-21 23:58:52 KST
- target URL: `https://thecleancoffee.com/?utm_source=codex&utm_medium=meta_pixel_smoke&utm_campaign=coffee_meta_eventid_20260521_2334&fbclid=TEST_FBCLID_COFFEE_20260521_2334`
- navigation status: 200

no-send guard:

- `facebook.com/tr` captured and aborted: 5건
- Meta CAPI request captured: 0건
- non-Meta tracking request blocked: 7건
- checkout/purchase visited: 0건
- Imweb save/GTM publish: 0건

wrapper state:

- `window.fbq`: present
- `window.__FUNNEL_CAPI_INSTALLED`: `2026-04-15-thecleancoffee-funnel-capi-v3`
- `window.FUNNEL_CAPI_CONFIG.enableServerCapi`: false
- `window.FUNNEL_CAPI_CONFIG.pixelId`: `1186437633687388`
- `window.fbq.__FUNNEL_CAPI_V3_WRAPPED__`: true

synthetic event 결과:

- `ViewContent`: request 1건, eventId 있음, value 있음, currency 있음
- `AddToCart`: request 1건, eventId 있음, value 있음, currency 있음
- `InitiateCheckout`: request 1건, eventId 있음, value 있음, currency 있음
- `AddPaymentInfo`: request 1건, eventId 있음, value 있음, currency 있음
- `Purchase`: request 0건
- Meta CAPI server request: 0건

console evidence:

```text
[funnel-capi] fbq wrapped agent=imweb version=2.9.324
[funnel-capi] installed 2026-04-15-thecleancoffee-funnel-capi-v3 pixel=1186437633687388 enableServerCapi=false testEventCode=(none)
[funnel-capi] inject eid ViewContent ...
[funnel-capi] server skipped (disabled) ViewContent ...
[funnel-capi] inject eid AddToCart ...
[funnel-capi] server skipped (disabled) AddToCart ...
[funnel-capi] inject eid InitiateCheckout ...
[funnel-capi] server skipped (disabled) InitiateCheckout ...
[funnel-capi] inject eid AddPaymentInfo ...
[funnel-capi] server skipped (disabled) AddPaymentInfo ...
```

## 해석

현재 Coffee Phase 9는 browser 이벤트에 deterministic eventId를 붙일 수 있다. 서버 CAPI는 꺼져 있다.

따라서 Meta CAPI를 나중에 켤 경우 browser/server dedup의 기반인 eventId 계약은 로컬 no-send 기준으로 준비되어 있다. 단, 이번 smoke는 synthetic fbq 호출이다. 실제 Imweb native 이벤트가 상품/장바구니/결제 단계에서 같은 방식으로 발생하는지는 다음 live journey smoke가 필요하다.

## 한계

1. Meta Events Manager Test Events 화면에서 실제 수신 확인은 하지 않았다.
2. `facebook.com/tr` 요청은 캡처 후 abort했으므로 Meta 플랫폼 수신으로 보지 않는다.
3. checkout/payment/purchase 경로는 방문하지 않았다.
4. synthetic fbq 호출이라 Imweb native trigger coverage 자체를 검증한 것은 아니다.

## 하지 않은 것

- Meta CAPI enable 0건
- Meta Events Manager 실제 수신 확인 0건
- Purchase event synthetic call 0건
- Imweb 저장 0건
- GTM publish 0건
- 실제 checkout/purchase 0건
- 운영DB/VM Cloud write 0건

## 다음 판단

1. Meta eventId wrapper 자체는 PASS다.
2. 실제 Imweb native journey에서 ViewContent/AddToCart/AddPaymentInfo가 언제 발화하는지는 별도 smoke가 필요하다.
3. `add_payment_info` GTM Preview 설계는 이 eventId 결과를 참고해 Purchase와 분리해야 한다.
