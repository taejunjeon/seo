# 더클린커피 Live Tracking Inventory Snapshot (2026-05-01)

생성 시각: 2026-05-01 KST
site: `thecleancoffee` (`https://thecleancoffee.com`)
mode: `read_only` / `observation_only`
관찰 방법: TJ 가 chrome devtools console 에서 페이지 로드 후 자동 출력 메시지 + 직접 명령 실행
관련 template: [[harness/coffee-data/LIVE_TAG_INVENTORY|Coffee Live Tag Inventory template]]

## Auditor Verdict

```text
Auditor verdict: PASS_WITH_NOTES
Phase: coffee_live_tracking_inventory_snapshot
No-send verified: YES
No-write verified: YES
No-deploy verified: YES
No-publish verified: YES
GTM publish: BLOCKED
Live script injection: BLOCKED
fetch/sendBeacon/XHR: BLOCKED (observation only)
GA4 gtag event: BLOCKED (no new event)
backend API call: BLOCKED
sessionStorage + console.log only: YES (preview snippet 한정)
실제 운영 변경: 0건
```

## 10초 요약

더클린커피 site 에 **이미 funnel-capi v3 가 설치되어 first-party `sessionId` 와 `eid` 시스템을 운영 중** 이다. 이는 NPay intent beacon 설계가 새 session/eid 체계를 만드는 게 아니라 funnel-capi 의 sessionId/eid 를 재사용 또는 보강하는 방향으로 가야 한다는 신호다.

본 snapshot 은 "지금 site 에 무엇이 살아 있는가" 를 박아 두는 관찰 기록이며, design 변경의 근거가 된다.

## 1. Live console markers (페이지 로드 시 자동 출력)

```
[funnel-capi] fbq wrapped agent=imweb version=2.9.310
[funnel-capi] installed 2026-04-15-thecleancoffee-funnel-capi-v3 pixel=1186437633687388 enableServerCapi=false testEventCode=(none) sessionId=mompe62dw2gxlk
naverPayButton.js:20 A parser-blocking, cross site (...) script https://pay.naver.com/customer/js/innerNaverPayButton.js?... is invoked via document.write
[funnel-capi] inject eid ViewContent ViewContent.1.mompe62dw2gxlk payload= Object
[funnel-capi] server skipped (disabled) ViewContent ViewContent.1.mompe62dw2gxlk
deploy_strategy.js:35 IMWEB_DEPLOY_STRATEGY init event dispatched Object
a7s.umd.js:25815 [scroll-tracking:B0012] Object
a7s.umd.js:25816 [스크롤_이벤트_테이블] Object
kg_kakaoSync.js:1354 KEEPGROW KAKAOSYNC / COPYRIGHT ⓒUNEEDCOMMS ALL RIGHTS RESERVED.
a7s.umd.js:25815 [scroll-tracking:B0015] Object (반복)
```

해석:

| marker | 의미 |
|---|---|
| `funnel-capi v3` `2026-04-15-thecleancoffee` | 2026-04-15 배포된 funnel-capi version 3, site 식별자 `thecleancoffee` |
| `fbq wrapped agent=imweb version=2.9.310` | imweb 의 fbq 가 이미 wrap 됨, 즉 우리가 새 wrap 을 추가하면 이중 wrap 위험 |
| `pixel=1186437633687388` | Meta Pixel id (= `META_PIXEL_ID_COFFEE` 환경변수와 일치, 운영 정합) |
| `enableServerCapi=false` | server CAPI 는 disabled — `server skipped (disabled)` 로그가 그 결과 |
| `testEventCode=(none)` | Meta Test Event Code 미사용 |
| `sessionId=mompe62dw2gxlk` | **funnel-capi 가 자체 발급한 first-party sessionId**. ga_session_id 와 별개 |
| `inject eid ViewContent ViewContent.1.mompe62dw2gxlk` | eid 형식 = `<EventName>.<seq>.<sessionId>`. 이번 페이지에서 ViewContent 이벤트가 1번째로 발생, eid 까지 함께 발급됨 |
| `naverPayButton.js parser-blocking` | NPay SDK 자체 경고. document.write 로 inner script 삽입. **NPay 버튼은 SDK 가 그리는 cross-site 자원** 이라는 점이 중요 |
| `deploy_strategy.js`, `a7s.umd.js`, `kg_kakaoSync.js` | imweb 코어 + scroll tracking + KAKAO SYNC (UNEEDCOMMS) 활성 |

## 2. GTM live version

| 필드 | 값 |
|---|---|
| GTM container id | `GTM-5M33GC4` ([[coffeefooter]] 헤더 주석에서 확인) |
| GA4 measurement id | `G-JLSBXX7300` |
| live version no | 미확인 — TJ GTM 콘솔에서 직접 확인 필요 |
| 마지막 publish 시각 | 미확인 |

## 3. Imweb header / footer custom code

| 위치 | 출처 | 핵심 라이브러리 |
|---|---|---|
| `<head>` 직접 삽입 | `data/coffeefooter.md` 로 스냅샷 보관 (396 lines) | GTM, Meta Pixel, GA4, funnel-capi |
| `<body>` 끝 footer custom | 동일 | 동일 |

본 snapshot 시점에 `data/coffeefooter.md` 안에서는 `funnel-capi` 직접 키워드 검색 결과 0건. 이는 funnel-capi 가 **GTM tag 또는 외부 호스팅 스크립트** 로 들어왔음을 시사. 즉 imweb header 코드 자체에는 안 박히고 GTM 으로 inject 되었을 가능성. (`coffeefooter.md` 의 `<!-- Current GTM container GTM-5M33GC4 ... -->` 주석과 일치.)

## 4. Existing wrappers

본 snapshot 시점까지 console 자동 출력으로 확인된 wrap:

| 함수 | wrap 여부 | 출처 |
|---|---|---|
| `window.fbq` | **wrap 됨** (`funnel-capi` 가 wrap, `agent=imweb`) | console marker `[funnel-capi] fbq wrapped` |
| `window.gtag` | 미확인 — 진단 명령 1개 추가 필요 |  |
| `window.ttq` | 미확인 |  |
| `SITE_SHOP_DETAIL.confirmOrderWithCartItems` | preview snippet 으로 wrap 시도 했으나 buffer 비어 있어 hook 불확실 |  |
| `SITE_SHOP_DETAIL.initDetail` | 동일 |  |
| `naver.NaverPayButton.apply` | wrap 안 함 (NPay SDK 자체) |  |

## 5. Existing session / eid keys (관찰된 것만)

| 시스템 | 변수/cookie/sessionStorage | 형식 / 값 |
|---|---|---|
| GA4 | `_ga` cookie, `_ga_<G-ID>` cookie | (TJ 환경, 본 snapshot 에 cookie 값 미기록) |
| Meta Pixel | `_fbp` cookie | (미기록) |
| funnel-capi sessionId | `mompe62dw2gxlk` 형식 | console marker 에서 추출. 노출 변수 위치는 진단 [3] 으로 확인 필요 |
| funnel-capi eid | `<EventName>.<seq>.<sessionId>` | 예: `ViewContent.1.mompe62dw2gxlk` |
| 우리 intent beacon (preview only) | `coffee_npay_session_uuid`, `coffee_npay_intent_seq`, `coffee_npay_intent_uuid_pending`, `coffee_npay_intent_preview` | preview-only, 페이지 reload 시 소멸 |

## 6. Server send enabled / disabled

| 시스템 | flag | 결과 |
|---|---|---|
| funnel-capi server CAPI | `enableServerCapi` | **false (disabled)** — console marker 에서 직접 확인 + `server skipped (disabled)` 로그 |
| GA4 Measurement Protocol | backend `.env` `GA4_MP_API_SECRET_COFFEE` | enabled (값 present), refundDispatcher 등에서 사용 |
| Meta CAPI server | backend `.env` `COFFEE_META_TOKEN` | 키 present, [[coffee-source-freshness-meta-tiktok-20260501]] 에서 last_7d insights 정상. 단 client→server 이벤트 dedupe 로직은 `enableServerCapi=false` 라 현재 client-only |
| TikTok Events API | backend tiktok 키 present | last_7d insights 정상. coffee 단독 분리는 campaign 단위 |

## 7. Observed events (페이지 진입~ViewContent 까지)

본 snapshot 은 페이지 진입 직후만 관찰. NPay click 이후 이벤트는 진단 [6] 에서 추가 관찰 필요.

| step | 이벤트 | eid / dedupe 키 |
|---|---|---|
| `shop_view/?idx=1` 진입 | funnel-capi `ViewContent` (fbq + inject) | `ViewContent.1.mompe62dw2gxlk` |
| 동일 시점 server | `server skipped (disabled)` (실제 송출 0건) | — |
| 스크롤 | `[scroll-tracking:B0012]`, `[scroll-tracking:B0015]` (반복) | — (scroll 은 funnel-capi 와 다른 layer) |
| AddToCart | 미관찰 |  |
| 일반 구매하기 click (`_btn_buy`) | 미관찰 |  |
| NPay PC click | 미관찰 (snippet hook 안 닿음 추정) |  |
| NPay 결제 완료 callback | 미관찰 (sandbox 결제 미진행) |  |

## 8. NPay click / Purchase 관련 이벤트 유무

| 질문 | 현재 답 |
|---|---|
| NPay PC 클릭 시 funnel-capi console marker 가 추가로 출력되는가 | **미확인** — 다음 진단에서 [6] 항목으로 확인 |
| NPay Mobile 클릭 시 동일 | 미확인 |
| NPay 결제 redirect 직전 funnel-capi `InitiateCheckout` eid 가 발급되는가 | 미확인 |
| 결제 완료 callback 에서 `Purchase` eid 가 발급되는가 | 미확인 (sandbox 결제 필요) |
| `confirmOrderWithCartItems('npay', url)` 의 url 에 우리 query param 을 추가했을 때 funnel-capi 가 dedupe 키로 사용하는가 | 미확인 (sandbox 결제 + Imweb raw_data 검증 필요) |

## 9. 빠른 진단 묶음 (TJ 다음 실행)

페이지 로드 직후 console 에 다음 한 묶음을 붙여 한 번에 6번 + 추가 항목 확인.

```js
({
  funnelCapi: [window.__funnelCapi, window.funnelCapi, window.__FUNNEL_CAPI__].filter(Boolean),
  fbq: typeof window.fbq === "function" ? window.fbq.toString().slice(0, 400) : typeof window.fbq,
  gtag: typeof window.gtag === "function" ? window.gtag.toString().slice(0, 400) : typeof window.gtag,
  ttq: typeof window.ttq,
  confirmOrder: window.SITE_SHOP_DETAIL?.confirmOrderWithCartItems?.toString().slice(0, 300),
  initDetail: window.SITE_SHOP_DETAIL?.initDetail?.toString().slice(0, 200),
  naverPay: window.naver?.NaverPayButton?.apply?.toString?.().slice(0, 200),
  cookies: document.cookie.split(";").map(s => s.trim().split("=")[0]).filter(Boolean),
  sessionStorageKeys: Object.keys(sessionStorage),
})
```

NPay PC 버튼 클릭 직후 console 에 새로 추가된 funnel-capi marker 줄을 모두 캡처해 본 snapshot 의 §7~§8 에 반영한다.

## 10. 발견의 함의 (design 측면)

1. 우리 intent beacon design v0.2 는 새 `session_uuid` + 새 `intent_uuid` + 새 `intent_seq` 를 만들도록 되어 있다. **funnel-capi 가 이미 동일 패턴 (`sessionId` + `eid` + `seq`) 으로 운영 중** 이므로 이중 박지 말고 재사용 또는 보강 방향으로 v0.3 설계를 정리한다.
2. funnel-capi 가 NPay 분기까지 이벤트를 박는다면 → 우리 wrapper 는 불필요해질 수 있고, intent_uuid 자리에 funnel-capi eid 를 넣는 것으로 정리.
3. funnel-capi 가 NPay 분기를 안 박는다면 → 우리 wrapper 가 NPay 보강 layer 역할. 단 sessionId 는 funnel-capi 것을 재사용 (`session_uuid` 별도 발급 안 함).
4. server CAPI 가 disabled 라는 건 client→server dedupe 로직이 아직 운영 안 됨을 뜻함. 즉 향후 server CAPI 를 켤 때 우리 intent_uuid (또는 funnel-capi eid) 를 그대로 dedupe 키로 사용 가능.
5. NPay SDK 가 cross-site script + parser-blocking 이라 click 위임 selector 위주 설계는 fragile. 진입점은 여전히 `confirmOrderWithCartItems('npay', url)` 이 가장 안정.

## 11. 외부 시스템 영향

- imweb 사이트: 본 snapshot 작성으로 site live 동작 변경 0건.
- GTM workspace: 변경 없음 (관찰만).
- funnel-capi 코드: 수정 금지. 재사용 가능 변수가 있는지만 확인.
- GA4 / Meta / TikTok / Google Ads: 신규 송출 0건.
- 로컬 DB: 신규 테이블 없음.
- 외부 API: 신규 호출 없음.

## 관련 문서

- [[harness/coffee-data/LIVE_TAG_INVENTORY|Coffee Live Tag Inventory template]]
- [[coffee-npay-intent-beacon-preview-design-20260501]] § funnel-capi compatibility (v0.3)
- [[coffeefooter|coffeefooter (imweb header/footer 백업)]]
- [[coffee-source-freshness-meta-tiktok-20260501|Meta/TikTok freshness]]
- [[!coffeedata#Phase3-Sprint6|!coffeedata § Phase3-Sprint6]]
