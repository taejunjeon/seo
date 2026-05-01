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

## 4. Existing wrappers (2026-05-01 KST 진단 A 결과 채움)

| 함수 | wrap 여부 | 핵심 코드 단서 |
|---|---|---|
| `window.fbq` | **wrap 됨** by funnel-capi | preview 안 `MIRROR_EVENTS[args[1]]`, `ensureEventId(eventName, payload, eventMeta)`, `injected`, `eid` 키워드. `track` 이벤트 중 MIRROR_EVENTS 매핑된 것만 eid 주입 |
| `window.gtag` | **wrap 안 됨** (원본) | preview = `function gtag(){dataLayer.push(arguments);}` |
| `window.ttq` | **`undefined`** | TikTok pixel 미설치 |
| `SITE_SHOP_DETAIL.confirmOrderWithCartItems` | **thin wrapper 가 이미 박혀 있음** | preview = `function (type, backurl, params) { confirmOrderWithCartItems(type, backurl, params); }`. 즉 진짜 함수는 **글로벌 `window.confirmOrderWithCartItems`** |
| `SITE_SHOP_DETAIL.initDetail` | **thin wrapper** | preview = `function (option) { initDetail(option); this.setShippingTemplateCode(...); }`. 진짜 함수는 글로벌 `initDetail` |
| `naver.NaverPayButton.apply` | NPay SDK 원본 (cross-origin script `https://pay.naver.com/customer/js/innerNaverPayButton.js` 가 document.write 로 inject) | preview 의 `prepareInitialParam`, `prepareLayoutHTML`, `prepareButtonHTML` 호출 체인 |

해석:
- `confirmOrderWithCartItems` 에 wrap 을 박을 때는 **`SITE_SHOP_DETAIL.confirmOrderWithCartItems` 만 wrap 하면 thin wrapper 만 걸려 위임 호출은 안 잡힐 수 있음**. 글로벌 `window.confirmOrderWithCartItems` 도 동시에 wrap 해야 안전.
- fbq 의 funnel-capi wrap 은 MIRROR_EVENTS 등록 이벤트만 처리. NPay 단계 이벤트가 등록되어 있는지가 핵심.

## 5. Existing session / eid keys (2026-05-01 KST 진단 A/B 결과 채움)

| 시스템 | 변수/cookie/sessionStorage | 형식 / 값 |
|---|---|---|
| GA4 | `_ga` cookie + `_ga_JLSBXX7300` cookie | 표준 GA4 cid + session_id (G-JLSBXX7300 = coffee 측정 ID) |
| Meta Pixel | `_fbp` cookie | 표준 fb.1.<ts>.<rand> |
| Naver wcs | `wcs_bt` cookie | 네이버 web conversion script |
| Microsoft Clarity | `_clck`, `_clsk` cookies | session 추적 |
| KeepGrow KAKAO Sync | `keepgrowUserData` cookie | UNEEDCOMMS 카카오 광고 sync |
| imweb 자체 | `__bs_imweb`, `__fs_imweb`, `_imweb_login_state` cookies + `__bs_imweb_session`, `__bs_browser_session_id` sessionStorage | imweb 코어 session |
| Google Ads | `_gcl_au`, `_gid`, `_gat_UA-147278175-3` cookies | conversion linker |
| Channel Talk | `ch-veil-id`, `ch-session-130495` cookies + `Channel.draft_*` sessionStorage | 채널톡 |
| funnel-capi sessionId | **window 변수 노출 없음** (`window.__funnelCapi`, `window.funnelCapi`, `window.__FUNNEL_CAPI__`, `window.__FUNNEL_CAPI` 모두 `undefined`) — sessionStorage 키 `funnelCapi::sent::<eid>` 에서 추출 가능 | 예 `funnelCapi::sent::ViewContent.1.momrm95adwj94z` → `<sessionId>` = `momrm95adwj94z` |
| funnel-capi eid | sessionStorage 키 자체 또는 console marker `[funnel-capi] inject eid <EventName> <eid>` | 예 `ViewContent.1.momrm95adwj94z`. 형식 `<EventName>.<seq>.<sessionId>` |
| imweb a7s lifecycle | `__a7s_lifecycle_event_session` sessionStorage | `appSessionId` (예 `019de310ed7472ef8dd874d88271fd2a`), `appSessionKey: lifecycle-event` |
| imweb ADVANCED TRACE | `ADVANCED_TRACE_CODE_view_contents_code_{...}` sessionStorage 키 | imweb 자체 ADVANCED TRACE 가 prod 정보 포함해 sessionStorage 에 박음. 우리는 읽기만 |
| **`__seo_funnel_session`** | sessionStorage 키 | **별도 funnel session 시스템 존재**. 정체와 발급 주체 미확인 — 추가 진단 필요 |
| imweb dog (?) buffer | `__imdog_buffer__` sessionStorage | 정체 미확인 |
| 우리 intent beacon (preview only) | `coffee_npay_session_uuid`, `coffee_npay_intent_seq`, `coffee_npay_intent_uuid_pending`, `coffee_npay_intent_preview` | preview-only, 페이지 reload 시 소멸. 진단 B 시점 `coffee_npay_session_uuid: d3975495-9df7-445d-a71d-97f38967227e` 발급 확인 |

핵심: **funnel-capi sessionId 는 sessionStorage 키 정규식으로 추출 가능**. design v0.3 의 결과 분기 중 "sessionId 노출됨 → 재사용" 으로 확정.

## 6. Server send enabled / disabled

| 시스템 | flag | 결과 |
|---|---|---|
| funnel-capi server CAPI | `enableServerCapi` | **false (disabled)** — console marker 에서 직접 확인 + `server skipped (disabled)` 로그 |
| GA4 Measurement Protocol | backend `.env` `GA4_MP_API_SECRET_COFFEE` | enabled (값 present), refundDispatcher 등에서 사용 |
| Meta CAPI server | backend `.env` `COFFEE_META_TOKEN` | 키 present, [[coffee-source-freshness-meta-tiktok-20260501]] 에서 last_7d insights 정상. 단 client→server 이벤트 dedupe 로직은 `enableServerCapi=false` 라 현재 client-only |
| TikTok Events API | backend tiktok 키 present | last_7d insights 정상. coffee 단독 분리는 campaign 단위 |

## 7. Observed events (2026-05-01 KST 1차 진단까지)

| step | 이벤트 | eid / dedupe 키 |
|---|---|---|
| `shop_view/?idx=1` 진입 | funnel-capi `ViewContent` (fbq wrap + inject + sessionStorage `funnelCapi::sent::ViewContent.1.<sessionId>` 박음) | `ViewContent.1.<sessionId>` (예 `ViewContent.1.momrm95adwj94z`) |
| 동일 시점 server | `[funnel-capi] server skipped (disabled)` (실제 server CAPI 송출 0건, `enableServerCapi=false`) | — |
| imweb deploy | `IMWEB_DEPLOY_STRATEGY init event dispatched` | — |
| 스크롤 | `[scroll-tracking:B0012]`, `[scroll-tracking:B0015]` (반복) | — (scroll 은 funnel-capi 와 다른 layer, payload 안 `productCode` 포함) |
| KAKAO sync 로드 | `KEEPGROW KAKAOSYNC / COPYRIGHT ⓒUNEEDCOMMS` | — |
| AddToCart | **2026-05-01 진단 시점 미관찰** |  |
| 일반 구매하기 click (`_btn_buy`) | **2026-05-01 진단 시점 미관찰** |  |
| NPay PC click | **2026-05-01 진단 시점 hook 호출 미발견** (preview snippet wrap 은 잡혔으나 `bufferLengthAfterClick: 0`). 원인 가설은 §8 마지막 줄. funnel-capi 가 NPay click 시 추가 console marker 출력했는지 별도 캡처 필요 |  |
| NPay 결제 완료 callback | 미관찰 (sandbox 결제 미진행) |  |

## 8. NPay click / Purchase 관련 이벤트 유무 (2026-05-01 KST 1차 진단)

| 질문 | 현재 답 |
|---|---|
| NPay PC 클릭 시 funnel-capi console marker 가 추가로 출력되는가 | **미확인** — 클릭 후 console 캡처 누락. 다음 진단에서 명시적으로 추출 |
| NPay Mobile 클릭 시 동일 | 미확인 |
| NPay 결제 redirect 직전 funnel-capi `InitiateCheckout` eid 가 발급되는가 | 미확인 — `MIRROR_EVENTS` 매핑에 `InitiateCheckout` 이 등록되어 있는지가 관건 |
| 결제 완료 callback 에서 `Purchase` eid 가 발급되는가 | 미관찰 (sandbox 결제 필요) |
| `confirmOrderWithCartItems('npay', url)` 의 url 에 우리 query param 을 추가했을 때 funnel-capi 가 dedupe 키로 사용하는가 | 미확인 (sandbox 결제 + Imweb raw_data 검증 필요) |
| `SITE_SHOP_DETAIL.confirmOrderWithCartItems` wrap 이 NPay click 시 호출되는가 | **NO 추정** (`bufferLengthAfterClick: 0`). 원인 가설: (i) PC NPay 버튼이 SDK iframe 안에 그려져 메인 컨텍스트의 BUY_BUTTON_HANDLER 가 호출 안 됨, 또는 (ii) BUY_BUTTON_HANDLER 는 호출되지만 redirect 가 너무 빠르게 일어나 sessionStorage write 가 사라짐. 확정은 다음 진단의 직접 호출 sanity test (`window.SITE_SHOP_DETAIL.confirmOrderWithCartItems("npay", "test")`) 와 글로벌 `window.confirmOrderWithCartItems` 동시 wrap 으로 |

## 9. 빠른 진단 묶음

### 진단 A — 페이지 로드 직후 (1차 완료)

```js
({
  funnelCapi: [window.__funnelCapi, window.funnelCapi, window.__FUNNEL_CAPI__, window.__FUNNEL_CAPI].filter(Boolean),
  fbq: typeof window.fbq === "function" ? window.fbq.toString().slice(0, 600) : typeof window.fbq,
  gtag: typeof window.gtag === "function" ? window.gtag.toString().slice(0, 400) : typeof window.gtag,
  ttq: typeof window.ttq,
  confirmOrder: window.SITE_SHOP_DETAIL?.confirmOrderWithCartItems?.toString().slice(0, 600),
  globalConfirmOrder: typeof window.confirmOrderWithCartItems === "function" ? window.confirmOrderWithCartItems.toString().slice(0, 600) : typeof window.confirmOrderWithCartItems,
  initDetail: window.SITE_SHOP_DETAIL?.initDetail?.toString().slice(0, 400),
  naverPay: window.naver?.NaverPayButton?.apply?.toString?.().slice(0, 400),
  cookies: document.cookie.split(";").map(s => s.trim().split("=")[0]).filter(Boolean),
  sessionStorageKeys: Object.keys(sessionStorage),
})
```

### 진단 E — funnel-capi MIRROR_EVENTS 키 추출

fbq wrap 코드 안 `MIRROR_EVENTS[args[1]]` 가 등록된 이벤트만 eid 주입한다. 어떤 이벤트가 등록되어 있는지 확인.

```js
// E-1. fbq wrap 안 MIRROR_EVENTS / EVENT_MAP 같은 객체를 정규식으로 찾기
(() => {
  const src = window.fbq?.toString() || "";
  const matches = {
    mirror_events_assignment: src.match(/MIRROR_EVENTS\s*=\s*([\s\S]{0,300})/),
    event_keys_referenced: [...src.matchAll(/MIRROR_EVENTS\s*\[\s*['"]?([^'"\]]+)/g)].map(m => m[1]),
    src_length: src.length,
    snippet_first: src.slice(0, 800),
    snippet_last: src.slice(-800),
  };
  return matches;
})()

// E-2. funnel-capi 가 발급한 sessionId / eid 를 sessionStorage 에서 직접 추출
(() => {
  const out = {};
  for (const k of Object.keys(sessionStorage)) {
    if (k.startsWith("funnelCapi::sent::")) {
      const eid = k.replace("funnelCapi::sent::", "");
      const m = eid.match(/^([^.]+)\.(\d+)\.(.+)$/);
      out[k] = { eid, eventName: m?.[1], seq: m?.[2], sessionId: m?.[3] };
    }
  }
  out.__seo_funnel_session = sessionStorage.getItem("__seo_funnel_session");
  out.imdog_buffer_preview = (sessionStorage.getItem("__imdog_buffer__") || "").slice(0, 300);
  return out;
})()
```

### 진단 F — `confirmOrderWithCartItems` wrap 직접 호출 sanity test

PC NPay click hook 미발견 원인 분리. 직접 함수 호출이 buffer 에 1건 추가하면 wrap 자체는 정상 → 그러면 NPay click 이 BUY_BUTTON_HANDLER 를 호출 안 한다는 결론. buffer 에 안 들어가면 wrap 자체가 thin wrapper 만 잡았고 글로벌 함수가 다른 경로라는 결론.

```js
// F-0. preview snippet 살아 있는지 확인 (snippet 1번 다시 실행 권장)
window.__coffeeNpayIntentPreview

// F-1. 사이트 동작 변경 0건 호출 (구매 진행 안 시킴, _origConfirm 도 no-op 으로 우회)
//    주의: 이 명령은 SITE_SHOP_DETAIL.confirmOrderWithCartItems 를 직접 호출한다.
//    실제 결제 redirect 가 일어날 수 있으므로 즉시 ESC / popup 닫기.
//    redirect 가 안 되더라도 sessionStorage buffer 만 본다.
const before = JSON.parse(sessionStorage.getItem('coffee_npay_intent_preview') || '[]').length;
try { window.SITE_SHOP_DETAIL.confirmOrderWithCartItems("npay", "https://thecleancoffee.com/__sanity_test__"); }
catch (e) { console.log("[sanity_test] err", e.message); }
const after = JSON.parse(sessionStorage.getItem('coffee_npay_intent_preview') || '[]').length;
({ before, after, delta: after - before })

// F-2. 글로벌 함수 직접 호출 (thin wrapper 우회 케이스)
const before2 = JSON.parse(sessionStorage.getItem('coffee_npay_intent_preview') || '[]').length;
try { window.confirmOrderWithCartItems("npay", "https://thecleancoffee.com/__sanity_test_global__"); }
catch (e) { console.log("[sanity_test_global] err", e.message); }
const after2 = JSON.parse(sessionStorage.getItem('coffee_npay_intent_preview') || '[]').length;
({ before2, after2, delta: after2 - before2 })
```

### 진단 G — NPay PC 버튼 클릭 직후 console marker 추출

NPay PC 클릭 직전 console 비우고 (devtools console 좌상단 🚫 아이콘) 클릭 후 console 의 모든 줄을 캡처. 특히 `[funnel-capi] inject eid <EventName>` 줄이 새로 출력되면 어떤 EventName 인지 기록.

별도 도구 없이 chrome devtools 의 "preserve log" 켜고 console 캡처 → snapshot 의 §7~§8 에 반영.

이번 1차 진단까지의 결과는 위 §1~§8 에 반영되어 있다. 진단 E/F/G 결과는 본 snapshot 의 다음 갱신에서 추가한다.

## 10. 발견의 함의 (design 측면) — 2026-05-01 KST 1차 진단 반영

1. 우리 intent beacon design v0.2 는 새 `session_uuid` + 새 `intent_uuid` + 새 `intent_seq` 를 만들도록 되어 있다. **funnel-capi 가 이미 동일 패턴 (`sessionId` + `eid` + `seq`) 으로 운영 중** 이므로 이중 박지 말고 재사용 또는 보강 방향으로 v0.3 설계를 정리한다.
2. funnel-capi sessionId 는 **window 변수에는 노출 안 됨**. 그러나 sessionStorage 키 `funnelCapi::sent::<eid>` 패턴에서 정규식 `^funnelCapi::sent::([^.]+)\.(\d+)\.(.+)$` 으로 `<EventName>`, `<seq>`, `<sessionId>` 를 모두 추출 가능. 우리 `session_uuid` 는 이 sessionId 를 재사용한다 (없으면 새로 발급 fallback).
3. fbq 는 funnel-capi 에 의해 wrap 되어 있고 `MIRROR_EVENTS[args[1]]` 매핑에 등록된 이벤트만 eid 주입. NPay 진입 시 funnel-capi 가 새 eid 를 박는지는 `MIRROR_EVENTS` 의 키 목록 확인 필요. fbq 에 직접 `MIRROR_EVENTS` 를 toString 으로 추출 시도 가능.
4. `SITE_SHOP_DETAIL.confirmOrderWithCartItems` 는 thin wrapper 이고 진짜 함수는 글로벌 `window.confirmOrderWithCartItems`. wrap 시 둘 다 wrap 해야 thin wrapper 우회 케이스 대비 가능.
5. preview snippet 의 PC NPay click hook 미발견. SDK iframe 안 click 이 메인 컨텍스트 BUY_BUTTON_HANDLER 를 호출 안 하는지, 호출은 됐는데 redirect 로 sessionStorage 가 잠깐만 쓰였는지 분리 진단 필요. 직접 호출 sanity test (`window.SITE_SHOP_DETAIL.confirmOrderWithCartItems("npay","test")`) 가 1건 buffer 추가하면 wrap 자체는 정상.
6. server CAPI 가 disabled 라는 건 client→server dedupe 로직이 아직 운영 안 됨을 뜻함. 즉 향후 server CAPI 를 켤 때 우리 intent_uuid (또는 funnel-capi eid) 를 그대로 dedupe 키로 사용 가능.
7. NPay SDK 가 cross-site script + parser-blocking 이라 click 위임 selector 위주 설계는 fragile. 진입점은 여전히 `confirmOrderWithCartItems('npay', url)` 이 가장 안정.
8. **`__seo_funnel_session`** 은 우리가 안 만든 것. 정체와 발급 주체 미확인. funnel-capi 또는 imweb 의 또 다른 layer 일 가능성 — 다음 진단에서 `sessionStorage.getItem('__seo_funnel_session')` 값과 발급 코드 위치 추적 필요.

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
