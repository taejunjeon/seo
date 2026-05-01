# Coffee Data Live Tracking Inventory (preflight template)

작성 시각: 2026-05-01 KST
상태: v0 template
목적: 더클린커피 site 의 live tracking layer 를 새 wrapper/intent/eid 작업 전에 한 번 빠르게 점검하는 preflight 체크리스트
관련 문서: [[harness/coffee-data/README|Coffee Data Harness]], [[harness/coffee-data/RULES|Coffee Rules]], [[harness/coffee-data/AUDITOR_CHECKLIST|Coffee Auditor Checklist]]

## 왜 필요한가

2026-05-01 NPay intent beacon preview 검증 중 **이미 site 에 `funnel-capi v3` 가 설치되어 first-party `sessionId` 와 `eid` 를 발급하고 있다는 사실** 이 발견되었다. 이전에는 빈 site 라고 가정하고 새 wrapper 와 새 session_uuid 를 설계 중이었는데, 이는 중복 작업이고 충돌 위험이 있다.

이 사고를 막기 위해 다음 규칙을 둔다.

- 더클린커피 site 에 새 tracking wrapper, 새 session/eid 체계, 새 click hook 을 설계하기 **전에** 본 inventory 의 항목들을 먼저 채워야 한다.
- 비어 있는 항목이 있으면 작업을 멈추고 site live console 에서 채운 뒤 진행한다.
- inventory 가 없거나 stale (7일 이상 미갱신) 인 채로 새 wrapper 작업을 시작하면 [[harness/coffee-data/AUDITOR_CHECKLIST|AUDITOR_CHECKLIST]] 의 hard fail.

## Inventory 항목 (template)

각 항목은 site live console 에서 직접 관찰 가능한 형태로 적는다. 추측 금지.

### 1. Live console markers

페이지 로드 직후 console 에 자동 출력되는 메시지를 모두 기록한다. 이 메시지들이 어떤 SDK / wrapper / version 이 살아 있는지 보여준다.

| marker | 출처 | 의미 |
|---|---|---|
| (예) `[funnel-capi] installed YYYY-MM-DD-thecleancoffee-funnel-capi-vX` | funnel-capi | first-party CAPI wrapper version |
| (예) `[funnel-capi] fbq wrapped agent=imweb version=X.Y.Z` | funnel-capi | imweb fbq 가 wrap 되어 있음 |
| (예) `[funnel-capi] inject eid <EventName> <eid>` | funnel-capi | 어떤 이벤트에 eid 가 박히는지 |
| (예) `IMWEB_DEPLOY_STRATEGY init event dispatched` | imweb 코어 | imweb deploy strategy 활성 |
| (예) `[scroll-tracking:Bxxxx]` | imweb a7s.umd | scroll 이벤트 tracking 활성 |

### 2. GTM live version

| 필드 | 값 |
|---|---|
| GTM container id | `GTM-XXXXXXX` |
| live version no | (GTM 콘솔 또는 `dataLayer` 내 `gtm.uniqueEventId` 등에서 확인) |
| workspace name | (production / staging / preview) |
| 마지막 publish 시각 | YYYY-MM-DD KST |

### 3. Imweb header / footer custom code

| 위치 | 코드 출처 | 핵심 라이브러리 |
|---|---|---|
| `<head>` 직접 삽입 스크립트 | (사이트 관리자 메뉴 또는 footer 백업 md) | (예) GA4, GTM, Pixel, funnel-capi |
| `<body>` 끝 footer custom | 동일 | 동일 |

### 4. Existing wrappers

다음 함수가 이미 wrap 되어 있는지 console 한 줄 한 줄 검사.

| 함수 | wrap 여부 확인 명령 | 관찰 결과 |
|---|---|---|
| `window.fbq` | `window.fbq?.toString().slice(0, 400)` | wrap 흔적 (예: `funnel-capi`, `imweb`) 또는 원본 fb pixel 코드 |
| `window.gtag` | `window.gtag?.toString().slice(0, 400)` | wrap / 원본 |
| `window.ttq` | `typeof window.ttq, window.ttq?.toString?.().slice(0, 400)` | TikTok pixel 존재/wrap |
| `SITE_SHOP_DETAIL.confirmOrderWithCartItems` | `window.SITE_SHOP_DETAIL?.confirmOrderWithCartItems?.toString().slice(0, 300)` | 우리 wrap 또는 원본 |
| `SITE_SHOP_DETAIL.initDetail` | `window.SITE_SHOP_DETAIL?.initDetail?.toString().slice(0, 300)` | 동일 |
| `naver.NaverPayButton.apply` | `window.naver?.NaverPayButton?.apply?.toString?.().slice(0, 300)` | NPay SDK wrap 여부 |

### 5. Existing session / eid keys

| 시스템 | 변수/cookie/sessionStorage 위치 | 형식 |
|---|---|---|
| GA4 | `_ga` cookie, `_ga_<G-ID>` cookie | `GA1.1.<cid>`, `GS1.1.<sessionId>...` |
| funnel-capi | (예) `window.__funnelCapi`, `window.funnelCapi`, console marker | `mompe62dw2gxlk` 형식 자체 sessionId |
| funnel-capi eid | console marker `[funnel-capi] inject eid <EventName> <eid>` | `<EventName>.<seq>.<sessionId>` |
| Meta Pixel | `_fbp` cookie | `fb.1.<ts>.<rand>` |
| TikTok | `_ttp` cookie, `ttclid` query param | TikTok 자체 |
| 우리 intent beacon | `coffee_npay_session_uuid`, `coffee_npay_intent_seq`, `coffee_npay_intent_uuid_pending`, `coffee_npay_intent_preview` | preview-only |

### 6. Server send enabled / disabled

| 시스템 | flag | 관찰 위치 |
|---|---|---|
| funnel-capi server CAPI | `enableServerCapi` | console marker `[funnel-capi] installed ... enableServerCapi=true|false` |
| GA4 Measurement Protocol | (사이트 outside) | backend `.env` `GA4_MP_API_SECRET_*`, refundDispatcher 코드 |
| Meta CAPI server | (사이트 outside) | backend `.env` `COFFEE_META_TOKEN`, metaCapi.ts |
| TikTok Events API | (사이트 outside) | backend tiktokAdsDailySync 등 |

server send 가 enabled 인 시스템에 새 client-side wrapper 를 박을 때는 dedupe 키 (eid / event_id) 를 동일하게 맞춰야 한다.

### 7. Observed events

페이지 진입부터 NPay 결제 시도까지 실제 발화되는 이벤트를 적는다 (funnel-capi console marker, GA4 dataLayer, Meta fbq 호출 모두 포함).

| step | 발화되는 이벤트 | eid / dedupe 키 발급 여부 |
|---|---|---|
| (예) shop_view 진입 | `ViewContent` (fbq + funnel-capi inject) | `ViewContent.1.{sessionId}` |
| (예) AddToCart 클릭 | `AddToCart` (?) | (?) |
| (예) 일반 구매하기 (`_btn_buy`) 클릭 | `InitiateCheckout` (?), GA4 begin_checkout | (?) |
| (예) NPay PC 버튼 클릭 | (?) | (?) |
| (예) NPay Mobile dialog → 확정 | (?) | (?) |
| (예) 결제 완료 후 callback page | `Purchase` (fbq + funnel-capi inject), GA4 purchase | `Purchase.<seq>.{sessionId}` |

### 8. NPay click / Purchase 관련 이벤트 유무

NPay 분기에서 funnel-capi 가 별도 이벤트를 발화하는지를 명시 기록한다.

| 질문 | 결과 |
|---|---|
| NPay PC 버튼 클릭 시 funnel-capi console marker 가 추가로 출력되는가 | YES / NO |
| NPay Mobile 버튼 클릭 시 동일 | YES / NO |
| NPay 결제 redirect 직전 funnel-capi `InitiateCheckout` eid 가 발급되는가 | YES / NO / `eid_value` |
| NPay 결제 완료 callback 에서 `Purchase` eid 가 발급되는가 | YES / NO / `eid_value` |
| `confirmOrderWithCartItems('npay', url)` 의 url 에 우리 query param 을 추가했을 때 funnel-capi 가 그 param 을 dedupe 키로 사용하는가 | (sandbox 검증 필요) |

## 빠른 진단 명령 묶음

페이지 로드 후 console 에 다음 한 묶음을 붙여 6번까지 한 번에 확인한다.

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
  localStorageKeys: Object.keys(localStorage).slice(0, 30),
})
```

## Inventory 갱신 주기

- **신규 wrapper / intent / eid 작업 직전**: 본 inventory 가 7일 이내 갱신 상태인지 확인. 아니면 다시 채운 뒤 진행.
- **funnel-capi 또는 imweb 코어 버전이 console marker 에서 바뀐 것을 발견**: 그날 즉시 갱신.
- **GTM live publish 발생**: 그날 즉시 갱신.

## Snapshot 저장 위치

각 갱신은 `data/coffee-live-tracking-inventory-YYYYMMDD.md` 로 snapshot 을 남긴다. 본 template 은 채워야 할 항목만 정의하고 실제 값은 snapshot 에 적는다.

가장 최근 snapshot:

- [[coffee-live-tracking-inventory-20260501|2026-05-01 snapshot]]

## Auditor 연동

- 본 inventory 의 1~6번 항목 중 비어 있는 게 있으면 [[harness/coffee-data/AUDITOR_CHECKLIST|AUDITOR_CHECKLIST]] 의 soft fail.
- 새 wrapper / 새 session/eid 체계 / 새 click hook 작업 commit 의 변경 파일 목록 안에 design 문서가 있는데 본 inventory 또는 snapshot 갱신이 없다면 hard fail.
- server CAPI / GA4 MP / Meta CAPI 의 enable 상태가 미확인인 채로 새 client wrapper 를 추가하면 soft fail.
