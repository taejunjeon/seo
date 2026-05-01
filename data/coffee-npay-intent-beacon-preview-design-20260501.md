# 더클린커피 NPay Intent Beacon Preview-only 설계안

생성 시각: 2026-05-01 KST (v0.4 보강: imweb 정본 코드 분석 반영)
site: `thecleancoffee`
mode: `design_only` / `preview_only`
범위: DOM selector 조사 + beacon payload 초안 + preview 검증 절차 + funnel-capi 진단/공존 + imweb 4 layer 정본 분석
관련 Sprint: [[!coffeedata#Phase2-Sprint5|Phase2-Sprint5]] / [[!coffeedata#Phase3-Sprint6|Phase3-Sprint6]] / [[!coffeedata#Phase4-Sprint8|Phase4-Sprint8]]
Live tracking inventory: [[coffee-live-tracking-inventory-20260501|2026-05-01 snapshot]] (필수 선행)
Imweb 헤더/푸터 코드 정본: [[coffee/!imwebcoffee_code_latest_0501|imweb 헤더/푸터 코드 latest 0501]] (필수 선행 — funnel-capi v3 본체 + Purchase Guard v3 + checkout-started v1 + payment-success-order-code v1)

## v0.3 변경 요약 (이번 보강)

- 본 design 은 폐기 아님. site 에 이미 살아 있는 `funnel-capi v3` (2026-04-15) 를 무시하지 않고 **재사용/공존** 하도록 보강.
- funnel-capi 의 `sessionId` 가 노출되면 우리 `session_uuid` 는 새로 발급하지 않고 그것을 재사용.
- funnel-capi 가 NPay click/InitiateCheckout/Purchase 까지 eid 를 박는다면 우리 `intent_uuid` 자리에 funnel-capi eid 사용.
- funnel-capi 가 NPay 분기를 안 박는다면 우리 design 은 NPay 보강 layer 로 유지하되 sessionId 만 공유.
- preview snippet 의 `confirmOrderWithCartItems` wrap 이 안 잡히는 케이스 대비 진단 명령 추가.
- Live tracking inventory snapshot ([[coffee-live-tracking-inventory-20260501]]) 이 본 design 의 선행 조건. snapshot 미갱신 시 [[harness/coffee-data/AUDITOR_CHECKLIST|AUDITOR_CHECKLIST]] hard fail.

## v0.3 → v0.3+ 1차 진단 결과 (2026-05-01 KST)

[[coffee-live-tracking-inventory-20260501]] §4/§5/§7/§8 에 진단 A/B/C/D 결과 반영. 본 design 의 결과 분기 6종 중 일부가 확정됨.

| 분기 | 1차 진단 결과 | 다음 행동 |
|---|---|---|
| sessionId 노출 여부 | window 변수 노출 **없음**. 단 sessionStorage 키 `funnelCapi::sent::<eid>` 패턴에서 정규식 추출 가능 | snippet 안 `sessionUuid` 계산 helper 를 (1) sessionStorage 정규식 추출 우선 → (2) 없으면 새 발급 fallback 으로 보강 |
| funnel-capi 가 NPay click 시 새 eid 박는지 | **미확인** — 클릭 후 console marker 캡처 누락. 진단 G 로 추가 관찰 필요 |  |
| funnel-capi MIRROR_EVENTS 매핑 키 | 미확인 — `track <EventName>` 중 어느 것을 funnel-capi 가 dedupe 처리하는지 진단 E 로 fbq toString 정규식 추출 |  |
| `SITE_SHOP_DETAIL.confirmOrderWithCartItems` 가 thin wrapper 인지 | **확인됨**. preview = `function(type, backurl, params) { confirmOrderWithCartItems(type, backurl, params); }`. 진짜 함수는 글로벌 `window.confirmOrderWithCartItems` | snippet 의 wrap 대상에 글로벌 함수도 추가 (이중 wrap) |
| 우리 wrap 자체가 잡혔는지 | **잡힘** (`confirmOrderLooksWrapped: true`, preview 안에 `if (kind === \"npay\") log(buildPayload` 보임) | OK |
| PC NPay click 이 우리 wrap 을 호출하는지 | **NO** (`bufferLengthAfterClick: 0`). 원인 가설: SDK iframe 안 click 이 메인 컨텍스트 BUY_BUTTON_HANDLER 를 호출 안 함, 또는 redirect 로 sessionStorage write 가 사라짐 | 진단 F 의 직접 호출 sanity test 로 wrap 정상 여부 분리. F 가 buffer 1건 추가 → wrap 정상이고 click → handler 경로가 깨짐. F 도 0건 → 글로벌 함수 wrap 필요 |
| `__seo_funnel_session` sessionStorage 키 | **미관찰 신규 시스템**. funnel-capi/imweb 의 또 다른 layer 일 수 있음 | 진단 E-2 로 값과 발급 위치 추적 |
| TikTok pixel | `window.ttq` `undefined`. 사이트에 TikTok pixel 미설치 | 우리 design 은 TikTok wrap 0건 유지. 향후 TikTok 보강 시 별도 phase |

### 진단 A/B/C/D 1차 raw 요약

- **funnelCapiCandidates**: 4종 모두 `undefined` (window 미노출)
- **fbq wrap preview**: `MIRROR_EVENTS[args[1]]`, `ensureEventId(eventName, payload, eventMeta)`, `injected`, `eid` 키워드 → funnel-capi 가 fbq 를 wrap 해서 매핑된 이벤트만 eid 주입
- **confirmOrder preview**: thin wrapper (글로벌 함수로 위임)
- **NPay PC 버튼 click 후 buffer 변화 0**

### 다음 진단 묶음 (Inventory §9 의 진단 E/F/G)

본 design 의 결정을 닫기 위해 [[coffee-live-tracking-inventory-20260501#9. 빠른 진단 묶음|Inventory §9]] 의 진단 E/F/G 를 실행한다.

- **진단 E**: fbq wrap 안 MIRROR_EVENTS 키 정규식 추출 + sessionStorage 안 funnel-capi sent 목록 + `__seo_funnel_session` 값.
- **진단 F**: `window.SITE_SHOP_DETAIL.confirmOrderWithCartItems("npay","__sanity__")` 와 `window.confirmOrderWithCartItems("npay","__sanity_global__")` 를 직접 호출하고 buffer delta 측정.
- **진단 G**: NPay PC 클릭 직전 console clear → 클릭 → 출력된 모든 console 줄 캡처. 특히 `[funnel-capi] inject eid <EventName>` 줄.

### 결과로 결정될 design v0.4 분기

| 진단 결과 | design v0.4 |
|---|---|
| 진단 F-1 buffer +1, F-2 buffer +1 | wrap 자체 OK. NPay click 이 BUY_BUTTON_HANDLER 호출 안 함이 문제. mobile 경로(`._btn_mobile_npay`)로 시나리오 재시도 + click 직후 console marker 캡처 (진단 G) |
| 진단 F-1 buffer +1, F-2 buffer 0 | thin wrapper 만 잡힘. **글로벌 함수도 동시 wrap 으로 v0.4 보강** |
| 진단 F-1 buffer 0 | snippet 자체가 깨졌거나 SITE_SHOP_DETAIL 객체가 다른 참조. 콘솔 에러 캡처 후 snippet 재실행 |
| 진단 G 에서 funnel-capi 가 NPay click 시 새 eid 박음 | 우리 `intent_uuid` 폐지하고 funnel-capi eid 재사용 → design 대폭 simplify (v0.4) |
| 진단 G 에서 funnel-capi 가 NPay click 무시 | 우리 wrap 이 NPay 분기 보강 layer. 단 sessionId 는 funnel-capi 것 재사용 (sessionStorage 정규식 추출) |
| 진단 E 에서 MIRROR_EVENTS 안 `InitiateCheckout` / `AddPaymentInfo` / `Purchase` 키 발견 | 향후 server CAPI 켤 때 dedupe 키 mapping 가능. 본 phase 의 NPay 분기 보강은 그 이벤트들 wrap 으로 정리 |

## v0.3+ → v0.4 정본 코드 분석으로 확정된 항목 (2026-05-01 KST)

[[coffee/!imwebcoffee_code_latest_0501|imweb 헤더/푸터 코드 정본]] (총 2,292행) 의 4개 layer 직접 분석으로 다음이 확정됨. 진단 E 거의 폐기.

### 4 layer 구조

| layer | line 범위 | snippet version | 역할 |
|---|---|---|---|
| Purchase Guard v3 | 12~946 | `2026-04-14-coffee-server-payment-decision-guard-v3` | NPay/PG 결제 후 attribution 결정. decisionEndpoint = `https://att.ainativeos.net/api/attribution/payment-decision`. vbank/unknown/blocked custom event 분기. **Purchase 단독 처리** |
| (보조 헤더/바디) | 947~994 | — | (보조) |
| checkout-started v1 | 1185~1561 | `2026-04-14-coffee-checkout-started-v1` | checkout 진입 추적 |
| payment-success-order-code v1 | 1563~2041 | `2026-04-14-coffee-payment-success-order-code-v1` | 결제 성공 시 order_code 박음 |
| funnel-capi v3 | 2042~2292 | `2026-04-15-thecleancoffee-funnel-capi-v3` | fbq wrap. ViewContent / AddToCart / InitiateCheckout / AddPaymentInfo eid mirror |

### funnel-capi 핵심 사실 (line-level 인용)

```javascript
// line 2102~2112 — sessionId
var SESSION_KEY = '__seo_funnel_session';
function getOrCreateSessionId() {
  var sid = window.sessionStorage && window.sessionStorage.getItem(SESSION_KEY);
  if (sid) return sid;
  sid = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  if (window.sessionStorage) window.sessionStorage.setItem(SESSION_KEY, sid);
  return sid;
}

// line 2125~2131 — MIRROR_EVENTS
var MIRROR_EVENTS = {
  ViewContent: true,
  AddToCart: true,
  InitiateCheckout: true,
  AddPaymentInfo: true
  /* Purchase 는 제외 — Purchase Guard v3 가 단독 관리 */
};

// line 2143~2149 — eid 형식
function ensureEventId(eventName, payload, eventMeta) {
  var existing = eventMeta && (eventMeta.eventID || eventMeta.eventId);
  if (existing) return { id: String(existing), injected: false };
  var key = extractContentKey(payload);
  var id = eventName + '.' + key + '.' + SESSION_ID;
  return { id: id, injected: true };
}

// line 2080~2081 — window 노출
window.__FUNNEL_CAPI_INSTALLED = SNIPPET_VERSION;
// line 2042 — config
window.FUNNEL_CAPI_CONFIG = { pixelId, endpoint, enableServerCapi, testEventCode, debug };
```

### v0.4 design 결정 (정본 분석 직후)

| 결정 | 근거 |
|---|---|
| `session_uuid` 발급 helper 는 **`sessionStorage.getItem('__seo_funnel_session')` 우선 → 부재 시 fallback 으로 새 발급** | 정본 line 2102 |
| `intent_uuid` 자리에 funnel-capi eid 직접 재사용 가능한가는 **부분 YES**. funnel-capi 는 InitiateCheckout/AddPaymentInfo 의 eid 를 박지만, `<EventName>.<contentKey>.<sessionId>` 형식이라 **결제 시도 1회 단위 unique 키가 아님** (같은 상품 같은 세션 내 여러 NPay 시도가 동일 eid 가능). 따라서 `intent_uuid` 는 별도 발급하되 `funnel_capi_eid_observed` 필드로 funnel-capi eid 를 참조만 보관 | 정본 line 2143~2149 의 contentKey 정의 |
| 우리 wrap 대상에 **글로벌 `window.confirmOrderWithCartItems` 추가** | 정본 분석 결과 thin wrapper 위임 구조 확인 |
| Purchase 는 우리 intent beacon 의 매핑 대상 아님 | Purchase Guard v3 단독 처리 (정본 line 2130 주석) |
| NPay 분기 보강의 핵심 가치는 (a) `confirmOrderWithCartItems('npay', url)` 호출 자체 기록 (BUY_BUTTON_HANDLER 도달 여부), (b) Imweb URL Query Param 보존 검증 후 deterministic 매핑 또는 ledger 트랙. funnel-capi 가 안 채우는 영역만 보강 | 정본 layer 구조 분석 |

### v0.4 snippet 코드 보강 (다음 commit 예정)

본 분석 결과를 적용한 snippet 코드 보강은 다음 commit 에서 진행한다. 보강 항목:

1. `sessionUuid` 계산: `sessionStorage.getItem('__seo_funnel_session')` 우선 → 부재 시 새 UUID
2. 글로벌 `window.confirmOrderWithCartItems` 도 동시 wrap (이중 wrap 가드 포함)
3. payload 에 `funnel_capi_session_id`, `funnel_capi_eid_observed` 필드 추가 (read-only 참조)
4. 진단 G 에서 NPay click 시 funnel-capi 가 어느 EventName 의 eid 를 박는지 (InitiateCheckout / AddPaymentInfo) 결과 반영 후 boolean 분기

### 진단 E 결과 — 정본 분석으로 거의 폐기

이전 진단 E 의 `MIRROR_EVENTS` 추출 / `__seo_funnel_session` 정체 추적은 정본 코드에서 모두 답이 나옴. snapshot §9 의 진단 E 는 **현 페이지의 sessionId 와 sent eid 목록 한 번 읽어두기** 정도로 축소.

### NPay 결제 흐름 4 layer 분석 (별도 문서로 분리)

[[coffee-imweb-tracking-flow-analysis-20260501]] 에 4 layer 의 trigger / 발화 이벤트 / 시간 순서 / 일반 PG vs NPay 차이 / 우리 design 의 보강 위치 정당화 가 정리됨.

핵심 결론: **NPay 결제 흐름은 일반 PG 결제와 달리 `checkout-started v1` 단계가 의도적으로 비어 있다** (NPay 외부 도메인 redirect 때문). 즉 우리 NPay intent beacon 의 진짜 가치는 (a) NPay click 자체 추적, (b) 그 시점의 deterministic key 발급, (c) 비어 있는 checkout-started 단계의 attribution context 보강 — 세 가지로 좁혀진다.

이로써 design v0.4 의 결정 (글로벌 함수 동시 wrap / `__seo_funnel_session` 재사용 / `intent_uuid` 별도 발급 유지 / Purchase 매핑 대상 아님) 이 정본 코드 근거로 정당화됨.

## Auditor Verdict

```text
Auditor verdict: PASS_WITH_NOTES
Phase: coffee_npay_intent_beacon_preview_design (v0.3)
No-send verified: YES
No-write verified: YES
No-deploy verified: YES
No-publish verified: YES
GTM publish: BLOCKED
Live script injection: BLOCKED
fetch/sendBeacon/XHR: BLOCKED
GA4 gtag event: BLOCKED
backend API call: BLOCKED
Meta CAPI / TikTok Events / Google Ads send: BLOCKED
sessionStorage + console.log only: YES
PII output: NONE
New executable send path added: NO
Actual network send observed: NO
intent_uuid scope: per-confirm_to_pay (not per-session)
funnel-capi compatibility section: PRESENT (v0.3)
funnel-capi code modification: NONE (read-only reuse policy)
Live tag inventory snapshot present: YES (data/coffee-live-tracking-inventory-20260501.md)
실제 운영 변경: 0건
```

## 10초 요약

더클린커피 NPay 버튼 클릭은 PC/Mobile 모두 결국 `SITE_SHOP_DETAIL.confirmOrderWithCartItems("npay", url)` 단일 함수로 수렴한다. 따라서 button selector 위임이 아니라 이 함수를 wrap 하는 방식이 가장 안정적이다.

`intent_uuid` 는 NPay 결제 시도(`confirm_to_pay`) 1회당 1개 새로 발급하고, `session_uuid` 는 별도로 페이지 세션 1개당 1개 유지하며, `intent_seq` 로 같은 세션 안 여러 시도를 구분한다.

다음 단계의 핵심 분기는 **Imweb URL Query Param 보존 검증** 이다. `confirmOrderWithCartItems("npay", url)` 의 url 에 `intent_uuid` 를 추가했을 때 Imweb/NPay raw_data 에 보존되면 deterministic match, 보존되지 않으면 internal intent ledger + `(prod_code, quantity, estimated_item_total, order_time_kst ± 30분)` 기반 high-confidence matching 으로 간다. 어느 쪽이 될지는 sandbox 실험 결과로 결정한다.

이번 phase 는 preview only다. GTM publish, head 삽입, fetch/sendBeacon/XHR, GA4 gtag, backend API 호출 모두 금지하며 sessionStorage 4개 키 + console.log 만 사용한다.

## funnel-capi Compatibility (v0.3)

### 발견 (2026-05-01 KST)

[[coffee-live-tracking-inventory-20260501]] 에서 확인됨. 더클린커피 site 에 이미 다음이 운영 중이다.

```
[funnel-capi] fbq wrapped agent=imweb version=2.9.310
[funnel-capi] installed 2026-04-15-thecleancoffee-funnel-capi-v3
  pixel=1186437633687388  enableServerCapi=false  testEventCode=(none)
  sessionId=mompe62dw2gxlk
[funnel-capi] inject eid ViewContent ViewContent.1.mompe62dw2gxlk
[funnel-capi] server skipped (disabled) ViewContent ViewContent.1.mompe62dw2gxlk
```

| 우리 design v0.2 | funnel-capi 가 이미 운영 중인 것 |
|---|---|
| `session_uuid` (새 발급) | `sessionId` (예: `mompe62dw2gxlk`, 자체 발급) |
| `intent_uuid` (per `confirm_to_pay`) | `eid` (per event, `EventName.seq.sessionId`) |
| `intent_seq` | eid 안 `seq` 부분 |

발급 단위, 형식, 목적이 거의 동일. **새로 박는 게 아니라 재사용/보강** 하는 방향이 맞다.

### 진단 명령 (TJ 가 chrome devtools console 에서 실행)

#### 진단 A. site 진입 직후 (preview snippet 실행 전)

```js
// A-0. 페이지 로드 직후 console 자동 출력 메시지 캡처 (funnel-capi installed 줄 등)
// → snapshot 의 §1 에 반영

// A-1. funnel-capi 가 sessionId 를 어디 노출하는지 + 이미 wrap 된 함수 묶음 확인
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

#### 진단 B. preview snippet 실행 후 (NPay 클릭 직전)

```js
// B-1. snippet 살아 있는가
window.__coffeeNpayIntentPreview
// → true: 살아 있음 / undefined: snippet 재실행 필요

// B-2. confirmOrderWithCartItems 가 우리 wrap 으로 잡혀 있는가
window.SITE_SHOP_DETAIL?.confirmOrderWithCartItems?.toString().slice(0, 300)
// → "if (kind === \"npay\") log(buildPayload" 같은 문자열 보이면 wrap OK
// → 안 보이면 다른 코드(funnel-capi/imweb)가 다시 덮어씌움 → 충돌

// B-3. 이전 buffer 길이 (NPay 클릭 전)
JSON.parse(sessionStorage.getItem('coffee_npay_intent_preview') || '[]').length
```

#### 진단 C. NPay PC 버튼 클릭 직후

```js
// C-1. buffer 변화
JSON.parse(sessionStorage.getItem('coffee_npay_intent_preview') || '[]').length
// → 0: hook 못 잡음 / 1+: 잡힘

// C-2. 마지막 payload (있으면)
JSON.parse(sessionStorage.getItem('coffee_npay_intent_preview') || '[]').slice(-1)[0]

// C-3. funnel-capi 가 클릭 직후 새 console marker 를 출력했는가
// (수동 관찰: console 에 "[funnel-capi] inject eid <EventName>..." 줄이 추가됐는지)
// 새 marker 가 InitiateCheckout / AddToCart / Purchase 인지 EventName 기록
```

### 결과 분기 (snapshot 의 §7~§8 채워질 때 자동 결정)

| 진단 결과 | 우리 design 변경 | session/eid 처리 |
|---|---|---|
| funnel-capi sessionId 가 진단 A-1 의 `funnelCapi` 또는 다른 변수로 노출됨 | `session_uuid` 새 발급 폐지, funnel-capi sessionId 재사용 | snippet 안 `sessionUuid` 계산 시 funnel-capi 변수에서 먼저 읽기, 부재 시만 `crypto.randomUUID()` |
| funnel-capi sessionId 가 어디에도 노출 안 됨 (console 마커에만 등장) | sessionId 추출용 작은 helper: console marker 가 띄운 sessionId 형식과 동일한 string 을 별도 발급 안 하고, `coffee_npay_session_uuid` 에 funnel-capi 기록을 그대로 박음 (수동 1회 입력) | 또는 우리 새 `session_uuid` 를 발급하되 funnel-capi sessionId 도 함께 buffer 에 `funnel_capi_session_id` 필드로 기록 |
| funnel-capi 가 NPay 클릭 시 `InitiateCheckout` 또는 별도 eid 를 발급함 | `intent_uuid` 새 발급 폐지, funnel-capi eid 를 그대로 사용. 우리 wrapper 는 보강 layer 가 아니라 funnel-capi eid 의 NPay 분기 라벨 추가만 | payload 의 `intent_uuid` 자리에 funnel-capi eid (예: `InitiateCheckout.<seq>.<sessionId>`) 저장. `intent_uuid_source: "funnel_capi_eid"` |
| funnel-capi 가 NPay 클릭에서 새 eid 안 박음 | 우리 `intent_uuid` 발급 유지. 단 `session_uuid` 만 funnel-capi sessionId 와 공유. NPay 보강 layer 역할 | `intent_uuid_source: "preview_snippet_local"` |
| 진단 B-2 wrap 확인 결과 우리 wrap 이 사라짐 | imweb/funnel-capi 가 `confirmOrderWithCartItems` 를 다시 정의해 우리 wrap 이 덮어씌워짐. snippet 실행 시점을 imweb load 완료 이후 (예: `DOMContentLoaded` + `setTimeout(0)`) 로 늦추거나, `naver.NaverPayButton.apply` 호출 자체를 wrap 해서 BUY_BUTTON_HANDLER 시점에 직접 hook | snippet 코드 v0.3 보강 항목 §"BUY_BUTTON_HANDLER 직접 wrap fallback" |
| 진단 C-1 buffer 0 (hook 못 잡음) | 진입점이 `confirmOrderWithCartItems` 가 아닐 가능성. NPay SDK iframe 내 click 이거나 `naver.NaverPayButton.apply` 시점에서 직접 redirect. 같은 §"BUY_BUTTON_HANDLER 직접 wrap fallback" 으로 진행 | snippet hook 지점 변경 |

### 공존 원칙

- funnel-capi **코드 수정 금지**. 본 phase 의 모든 변경은 우리 snippet 안에서만.
- funnel-capi sessionId / eid 를 **읽기만** 하고 쓰지 않는다.
- funnel-capi 가 fbq 를 wrap 하고 있는 상태에서 우리가 fbq 를 다시 wrap 하지 않는다 (지금 design 에는 fbq wrap 자체가 없음, 명시적 금지).
- 진단 결과로 우리 design 이 simplify 되면 polite 하게 폐기 또는 축소하되 funnel-capi 보강 의도는 본 문서에 보존한다.

### 향후 funnel-capi 에 NPay 분기 추가가 필요해질 경우

본 phase 범위 밖이지만, 만약 funnel-capi 가 NPay 클릭/Purchase 까지 eid 를 안 박고 있는 게 확정되면, 다음 phase 에서:

1. funnel-capi 코드 소스 위치 확인 (GTM tag / 외부 호스팅 / repo 어디에도 없으면 funnel-capi 운영 주체에게 문의).
2. funnel-capi 에 NPay click/InitiateCheckout/Purchase 이벤트 분기 추가 PR 또는 운영 협업.
3. 본 design 의 우리 wrapper 는 funnel-capi 분기가 운영에 들어가는 시점에 폐기.

이 모두는 별도 phase 에서 진행한다.

## 목적

- 과거분 (GA4 synthetic transaction_id) 자동 매칭이 약한 문제를 미래분에서 닫는다.
- NPay 결제 시도 1회마다 first-party correlation key 인 `intent_uuid` 를 발급해 site 단에서 의도(intent)를 확정해 둔다.
- 그 다음 단계는 두 가지 가능성으로 갈린다 (preview 단계에서 어느 쪽인지 검증):
  - (A) `confirmOrderWithCartItems("npay", url)` 의 url 에 `intent_uuid` query param 을 붙였을 때 Imweb/NPay raw_data 에 보존된다면 → **deterministic match** 가 가능.
  - (B) 보존되지 않는다면 → **internal intent ledger** 를 두고 `order_time` / `prod_code` / `quantity` / `estimated_item_total` 기반 high-confidence matching 을 한다. deterministic 은 못 되지만 휴리스틱보다 한 단계 강한 보강.
- 이번 phase 는 **설계 + DOM 조사 + preview 검증 절차** 까지만이고, 데이터 저장/광고 전송/운영 publish 는 별도 승인이 필요하다.

## 조사 결과: 더클린커피 NPay 버튼 DOM 구조

조사 페이지: `https://thecleancoffee.com/shop_view/?idx=1` (대표 상품 1)
조사 방법: `curl -L -s` 로 정적 HTML 받아 grep, no JS execution.

### PC NPay 버튼

```html
<div id='naverPayWrap'>
  <!-- Naver SDK 가 런타임에 button 을 여기 삽입 -->
</div>
```

- selector: `#naverPayWrap` (안정 ID)
- 실제 button 은 `naver.NaverPayButton.apply(...)` 가 SDK iframe 또는 sub-element 로 그림
- DOM 안 button 자체에는 `data-bs-action`, `data-bs-content`, `data-bs-payment-button-type` 가 없음 → selector click 위임 어려움
- 진입 핸들러 (script 내 inline):

```javascript
naver.NaverPayButton.apply({
  BUTTON_KEY: "AF46D07A-5C19-4759-B0E9-AEEEC897653C",
  TYPE: "B", COLOR: 1, COUNT: 2,
  EMBED_ID: embed_id,
  ENABLE: "Y",
  BUY_BUTTON_HANDLER: function () {
    SITE_SHOP_DETAIL.trackClickPurchaseShopView("naverpay");
    SITE_SHOP_DETAIL.confirmOrderWithCartItems("npay",
      "https://thecleancoffee.com/shop_view/?idx=1");
  },
  WISHLIST_BUTTON_HANDLER: function () { SITE_SHOP_DETAIL.addNPayWish(); }
});
```

- 결국 PC 도 `SITE_SHOP_DETAIL.confirmOrderWithCartItems("npay", url)` 한 줄로 수렴.

### Mobile NPay 버튼

```html
<div class="cart_btn n_pay width-50">
  <a href="javascript:;"
     class="_btn_mobile_npay btn button button--pay button--padding naver"
     onclick="SITE_SHOP_DETAIL.showMobileOptions('buy')">
    <img alt="네이버페이" src=".../npay_logo.svg" />
  </a>
</div>
```

- selector 후보:
  - `.cart_btn.n_pay` (NPay 사용 시에만 추가되는 컨테이너 클래스, 주석에 표기됨)
  - `._btn_mobile_npay` (실제 버튼)
  - `a.button.naver` (mobile NPay 버튼은 `naver` 클래스 동시 보유)
- `_btn_mobile_npay` 클릭은 `showMobileOptions('buy')` 로 옵션 다이얼로그 오픈만 한다. 다이얼로그 안 NPay 확인 클릭에서 `naver.NaverPayButton.apply` 핸들러를 거쳐 `confirmOrderWithCartItems("npay", url)` 가 호출된다.
- 따라서 mobile 도 PC 와 동일하게 `confirmOrderWithCartItems("npay", url)` 가 단일 진입점이다.

### 비교: imweb_payment 구매 버튼

```html
<a class="btn buy bg-brand _btn_buy"
   data-dd-action-name="init-checkout"
   data-bs-action="click"
   data-bs-content="purchase"
   data-bs-where="shop_view"
   data-bs-payment-button-type="imweb_payment"
   data-bs-prod-code="s20190901240a23893fa08"
   data-bs-prod-type="normal"
   data-bs-is-regularly-prod="false"
   onclick="SITE_SHOP_DETAIL.selectFreebieAsync().then(function(selected_freebies) {
     SITE_SHOP_DETAIL.confirmOrderWithCartItems('guest_login',
       'https://thecleancoffee.com/shop_view/?idx=1', {selected_freebies})
   });">구매하기</a>
```

- imweb_payment 경로는 `confirmOrderWithCartItems('guest_login', ...)` 로 분기되는 1번째 인자만 다르다.
- 따라서 함수 wrap 시 1번째 인자가 `'npay'` 인 호출만 NPay intent 로 분류 가능.

### 페이지/상품 메타데이터 추출 가능 위치

```javascript
SITE_SHOP_DETAIL.initDetail({
  "prod_idx": 1,
  "prod_code": "s20190901240a23893fa08",
  "prod_price": 21900,
  "options_hash": "e06ff5b...",
  "require_option_count": 2,
  ...
});
```

- `SITE_SHOP_DETAIL.initDetail({prod_idx, prod_code, prod_price})` 가 페이지 로드 시 1회 실행되므로, beacon 안에서 `prod_code`/`prod_idx`/`prod_price` 를 동시 캡처 가능.

## Selector 옵션 비교

| 옵션 | 위치 | 장점 | 단점 | 채택 |
|---|---|---|---|---|
| A) `#naverPayWrap` 클릭 위임 | PC | 안정 ID | SDK 가 iframe 으로 그릴 가능성, click 이벤트가 wrap 까지 bubble 안 될 수 있음 | 비채택 |
| B) `._btn_mobile_npay` listener | Mobile only | DOM 명확 | PC 미커버, dialog 안 NPay 확정 click 누락 위험 | 보조 |
| C) `naver.NaverPayButton.apply` 호출 가로채기 | 공통 | SDK 진입점 | Naver SDK 변경 시 쉽게 깨짐 | 비채택 |
| D) `SITE_SHOP_DETAIL.confirmOrderWithCartItems` wrap | 공통 | PC/Mobile/dialog 전부 통과, 1번째 인자로 NPay 식별 | imweb 내부 함수라 prefix/이름 변경 시 깨짐 (모니터링 필요) | **채택** |

권장 패턴: **D 우선 + B 백업**. D 가 함수 wrap 이라 click 이벤트 누락이 없고, B 는 click 만 잡혀도 intent 로 인정해야 하는 케이스 (다이얼로그 안 NPay 확정 안 누른 채 이탈) 식별에 필요.

## Beacon Payload 초안 (PII 제외)

```typescript
type CoffeeNpayIntentBeacon = {
  site: "thecleancoffee";        // hardcoded
  intent_phase: "click_to_dialog" | "dialog_to_npay" | "confirm_to_pay";

  // --- correlation keys ---
  // session_uuid: 페이지 세션 1개당 1회 발급, 같은 세션 내 여러 시도가 묶이게.
  session_uuid: string;
  // intent_uuid: NPay 결제 시도(confirm_to_pay) 1회당 1개 새로 발급.
  // session 단위 1개가 아니라 시도마다 갱신해야 같은 세션에서 여러 번
  // NPay 클릭한 케이스를 분리 매칭할 수 있다.
  intent_uuid: string;
  // intent_seq: 같은 session_uuid 안에서 confirm_to_pay 가 발생한 순번 (1, 2, ...).
  intent_seq: number;

  // --- product / amount (금액 reconciliation 에 필요) ---
  prod_idx: number;              // SITE_SHOP_DETAIL.initDetail
  prod_code: string;             // SITE_SHOP_DETAIL.initDetail
  prod_price: number;            // SITE_SHOP_DETAIL.initDetail
  selected_option_count: number; // length only, 옵션값 자체는 저장 안 함
  selected_quantity: number;     // 수량 input 값 (DOM 에서 0건이면 1로 폴백)
  estimated_item_total: number;  // prod_price * selected_quantity (배송비 미포함)
  metadata_missing: boolean;     // initDetail 에서 prod_idx/prod_code/prod_price 를 못 잡은 경우 true

  // --- GA / context ---
  ga_client_id: string;          // _ga cookie 의 cid (해시 안 함, GA4 와 동일 키)
  ga_session_id: string;         // _ga_<G-XXX> cookie 의 session_id
  page_url: string;              // location.href, query string 그대로 (PII 없음)
  page_path: string;             // location.pathname
  payment_button_type: "npay";   // wrap 의 1번째 인자 'npay' 일 때만 채움
  ts_ms_kst: number;             // Date.now() 그대로 (UTC 기준)
  ts_label_kst: string;          // KST ISO label, debug 용
  user_agent_class: "pc" | "mobile" | "unknown"; // matchMedia
  metadata_source: "initDetail_wrap" | "inline_script_regex" | "dom_fallback" | "none";

  // --- guard ---
  preview_only: true;            // 항상 true. 절대 false 로 못 가게 가드
};
```

PII 차단 규칙:
- 전화번호, 이메일, 주문자명, 배송지 주소: **수집 금지**
- option 텍스트, option 가격, option key 원문: 수집 금지 (count, quantity 만)
- referrer 의 query string 안 식별자 (`utm_*` 외): 차단

금액 reconciliation 에 필요해서 허용한 숫자 필드는 `prod_price`, `selected_option_count`, `selected_quantity`, `estimated_item_total` 4종이다. 모두 숫자이며 PII 가 아니다.

## Imweb URL Query Param 보존 검증 (다음 단계 핵심 분기)

`confirmOrderWithCartItems("npay", url)` 의 `url` 인자에 `?intent_uuid=...` 를 추가했을 때 그 값이 어디까지 살아남는지가 deterministic match 가능 여부를 결정한다. 본 phase 에서는 **검증 절차만 정의** 하고 실제 실험은 sandbox 에서 진행한다.

| 검증 포인트 | 어떻게 확인 | 결과 분기 |
|---|---|---|
| (a) Imweb 결제 redirect URL 에 query param 이 그대로 전달되는가 | sandbox 결제 흐름에서 chrome devtools Network 탭으로 redirect chain 확인 | YES → (b) 진행 / NO → (B) ledger 트랙 확정 |
| (b) Imweb 측 `tb_iamweb_users` / `tb_playauto_orders` / `imweb_orders` 의 `meta_data` 또는 `raw_data` JSON 안에 보존되는가 | 결제 완료 후 sandbox 주문 1건에 대해 backend read-only 쿼리 | YES → deterministic match 가능 / NO → (c) 진행 |
| (c) NPay 측 `channel_order_no` 응답 또는 결제완료 콜백 query 에 보존되는가 | sandbox NPay 주문관리 API 응답에서 grep | YES → deterministic 보강 / NO → (B) ledger 트랙 확정 |

(B) 케이스 = ledger 트랙 = local 에 `(intent_uuid, session_uuid, intent_seq, ts, prod_code, quantity, estimated_item_total)` 만 저장하고 confirmed order 와 `(prod_code, quantity, estimated_item_total, order_time_kst ± 30분)` 기준 high-confidence matching 을 한다. deterministic 은 못 되지만 GA4 휴리스틱 (시각/금액/상품명) 보다 한 단계 강한 보강이다.

본 phase 는 어느 트랙으로 갈지 결정하지 않는다. 검증 결과를 별도 phase 에서 받아서 분기한다.

## 저장/전송 (preview only)

- ❌ `navigator.sendBeacon` / `fetch` / `XMLHttpRequest` 외부 전송 금지
- ❌ GA4 `gtag('event', ...)` 호출 금지
- ❌ Meta CAPI / TikTok Events API 직접 호출 금지
- ❌ 내부 backend (`/api/...`) 호출 금지
- ✅ `sessionStorage.setItem('coffee_npay_intent_preview', JSON.stringify(buffer))` 로 buffer 만 (검수용)
- ✅ `console.log('[coffee_npay_intent_preview]', payload)` 로 devtools 확인
- ✅ buffer 는 최대 50개, 초과 시 FIFO drop, beforeunload 에서도 외부 전송 안 함

## Preview 코드 초안 (devtools snippet 형태, GTM/live publish 금지)

핵심 변경:
- `intent_uuid` 는 confirm_to_pay 마다 새 발급. session 단위는 별도 `session_uuid`.
- `intent_seq` 는 같은 세션 안 confirm_to_pay 발생 순번.
- `initDetail` 이 snippet 실행 전에 이미 끝났을 수 있으므로 3단 fallback (wrap → inline script regex → DOM data attribute). 못 잡으면 `metadata_missing=true`.

```javascript
// CoffeeNpayIntentPreview v0.2 — preview only
(function () {
  if (window.__coffeeNpayIntentPreview) return;
  window.__coffeeNpayIntentPreview = true;

  const SITE = "thecleancoffee";
  const STORAGE_KEY = "coffee_npay_intent_preview";
  const MAX_BUFFER = 50;

  // --- buffer ---
  const readBuffer = () => {
    try { return JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "[]"); }
    catch { return []; }
  };
  const writeBuffer = (buf) => {
    while (buf.length > MAX_BUFFER) buf.shift();
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(buf));
  };

  // --- uuid helpers ---
  const newUuid = () =>
    (window.crypto?.randomUUID?.() ??
      `nu-${Date.now()}-${Math.random().toString(36).slice(2)}`);

  // session_uuid: 페이지 세션 1회당 1개. sessionStorage 에 보관.
  const sessionUuid = (() => {
    const k = "coffee_npay_session_uuid";
    let v = sessionStorage.getItem(k);
    if (!v) { v = newUuid(); sessionStorage.setItem(k, v); }
    return v;
  })();

  // intent_seq: 같은 sessionStorage 안에서 confirm_to_pay 가 몇 번째인지.
  const SEQ_KEY = "coffee_npay_intent_seq";
  const nextIntentSeq = () => {
    const cur = Number(sessionStorage.getItem(SEQ_KEY) ?? "0") + 1;
    sessionStorage.setItem(SEQ_KEY, String(cur));
    return cur;
  };

  // --- ga cookie ---
  const readGaIds = () => {
    const cookies = Object.fromEntries(
      document.cookie.split(";").map((s) => s.trim().split("=").map(decodeURIComponent))
    );
    const ga = cookies["_ga"] ?? "";
    const cid = ga.split(".").slice(2).join(".") || "";
    const gaSessionEntry = Object.entries(cookies)
      .find(([k]) => k.startsWith("_ga_"))?.[1] ?? "";
    const sessionId = gaSessionEntry.split(".")[2] ?? "";
    return { cid, sessionId };
  };

  const detectUaClass = () => {
    if (window.matchMedia?.("(max-width: 768px)").matches) return "mobile";
    if (window.matchMedia?.("(min-width: 769px)").matches) return "pc";
    return "unknown";
  };

  // --- product metadata: 3단 fallback ---
  // (1) initDetail wrap 캐시
  // (2) inline <script> 안의 SITE_SHOP_DETAIL.initDetail({...}) regex 파싱
  // (3) DOM data attribute (`[data-bs-prod-code]`, `[data-prod_idx]`)
  // 셋 다 실패 시 metadata_missing=true 로 기록.
  const readMetadataFromInlineScript = () => {
    try {
      const scripts = Array.from(document.querySelectorAll("script"));
      for (const s of scripts) {
        const t = s.textContent || "";
        const m = t.match(/SITE_SHOP_DETAIL\.initDetail\(\s*(\{[\s\S]*?\})\s*\)/);
        if (!m) continue;
        const idxMatch = m[1].match(/"prod_idx"\s*:\s*(\d+)/);
        const codeMatch = m[1].match(/"prod_code"\s*:\s*"([^"]+)"/);
        const priceMatch = m[1].match(/"prod_price"\s*:\s*(\d+)/);
        if (idxMatch || codeMatch || priceMatch) {
          return {
            source: "inline_script_regex",
            prod_idx: Number(idxMatch?.[1] ?? 0),
            prod_code: String(codeMatch?.[1] ?? ""),
            prod_price: Number(priceMatch?.[1] ?? 0),
          };
        }
      }
    } catch (err) { /* ignore */ }
    return null;
  };
  const readMetadataFromDom = () => {
    try {
      const codeEl = document.querySelector("[data-bs-prod-code]");
      const idxEl = document.querySelector("[data-prod_idx], [data-prod-idx]");
      const code = codeEl?.getAttribute("data-bs-prod-code") || "";
      const idxRaw =
        idxEl?.getAttribute("data-prod_idx") ||
        idxEl?.getAttribute("data-prod-idx") || "";
      if (!code && !idxRaw) return null;
      return {
        source: "dom_fallback",
        prod_idx: Number(idxRaw || 0),
        prod_code: String(code),
        prod_price: 0, // DOM 에서 신뢰 불가 → 0 + metadata_missing 일부 true 처리
      };
    } catch (err) { return null; }
  };
  const resolveMetadata = () => {
    const cached = window.SITE_SHOP_DETAIL?._initDetailArgs;
    if (cached && (cached.prod_idx || cached.prod_code || cached.prod_price)) {
      return {
        source: "initDetail_wrap",
        prod_idx: Number(cached.prod_idx ?? 0),
        prod_code: String(cached.prod_code ?? ""),
        prod_price: Number(cached.prod_price ?? 0),
      };
    }
    const fromScript = readMetadataFromInlineScript();
    if (fromScript) return fromScript;
    const fromDom = readMetadataFromDom();
    if (fromDom) return fromDom;
    return { source: "none", prod_idx: 0, prod_code: "", prod_price: 0 };
  };

  // --- quantity (수량 input 값) ---
  const readSelectedQuantity = () => {
    try {
      const candidates = [
        ...document.querySelectorAll("input.option_count, input._option_count, input[name='option_count']"),
        ...document.querySelectorAll("input.prod-form-quantity, input[name='quantity']"),
      ];
      for (const el of candidates) {
        const v = Number(el.value || 0);
        if (Number.isFinite(v) && v > 0) return v;
      }
    } catch (err) { /* ignore */ }
    return 1;
  };

  // --- payload ---
  const buildPayload = (phase) => {
    const meta = resolveMetadata();
    const quantity = readSelectedQuantity();
    const estimated_item_total = (meta.prod_price || 0) * quantity;
    const { cid, sessionId } = readGaIds();
    const metadataMissing = !meta.prod_code || !meta.prod_price;
    const intentSeq = phase === "confirm_to_pay" ? nextIntentSeq() : Number(sessionStorage.getItem(SEQ_KEY) ?? "0");
    const intentUuid = phase === "confirm_to_pay"
      ? newUuid()              // 결제 시도마다 새 발급
      : (sessionStorage.getItem("coffee_npay_intent_uuid_pending") || "pending");
    if (phase === "confirm_to_pay") {
      sessionStorage.setItem("coffee_npay_intent_uuid_pending", intentUuid);
    }
    return {
      site: SITE,
      intent_phase: phase,
      session_uuid: sessionUuid,
      intent_uuid: intentUuid,
      intent_seq: intentSeq,
      prod_idx: meta.prod_idx,
      prod_code: meta.prod_code,
      prod_price: meta.prod_price,
      selected_option_count: Number(
        document.querySelectorAll("#prod-form-options ._option_select_row").length || 0
      ),
      selected_quantity: quantity,
      estimated_item_total,
      metadata_missing: metadataMissing,
      metadata_source: meta.source,
      ga_client_id: cid,
      ga_session_id: sessionId,
      page_url: location.href,
      page_path: location.pathname,
      payment_button_type: "npay",
      ts_ms_kst: Date.now(),
      ts_label_kst: new Date().toLocaleString("sv-SE", { timeZone: "Asia/Seoul" }),
      user_agent_class: detectUaClass(),
      preview_only: true,
    };
  };

  const log = (payload) => {
    const buf = readBuffer();
    buf.push(payload);
    writeBuffer(buf);
    console.log("[coffee_npay_intent_preview]", payload);
  };

  // a) initDetail wrap to remember args (preview only, no override).
  // 이미 initDetail 이 끝난 뒤일 수도 있으므로 fallback 은 buildPayload 가 처리.
  const _origInit = window.SITE_SHOP_DETAIL?.initDetail;
  if (typeof _origInit === "function") {
    window.SITE_SHOP_DETAIL.initDetail = function (args) {
      window.SITE_SHOP_DETAIL._initDetailArgs = args;
      return _origInit.apply(this, arguments);
    };
  }

  // b) confirmOrderWithCartItems wrap — single entry point
  const _origConfirm = window.SITE_SHOP_DETAIL?.confirmOrderWithCartItems;
  if (typeof _origConfirm === "function") {
    window.SITE_SHOP_DETAIL.confirmOrderWithCartItems = function (kind) {
      try {
        if (kind === "npay") log(buildPayload("confirm_to_pay"));
      } catch (err) { console.warn("[coffee_npay_intent_preview] error", err); }
      return _origConfirm.apply(this, arguments);
    };
  }

  // c) mobile click backup
  document.addEventListener("click", (event) => {
    const el = event.target instanceof Element ? event.target.closest("._btn_mobile_npay") : null;
    if (!el) return;
    try { log(buildPayload("click_to_dialog")); }
    catch (err) { console.warn("[coffee_npay_intent_preview] error", err); }
  }, true);

  console.log("[coffee_npay_intent_preview] installed (preview only, no network send)");
})();
```

이 코드는 chrome devtools snippet 또는 GTM Preview workspace 안에서만 실행한다. 절대 production GTM workspace publish 또는 imweb head 삽입에 들어가지 않는다.

## Preview 검증 체크리스트

준비:

- [ ] chrome 시크릿 창 (확장 비활성)
- [ ] devtools open (Console + Network 탭)
- [ ] Sources > Snippets 에 위 snippet 붙여넣기
- [ ] `https://thecleancoffee.com/shop_view/?idx=1` 진입 → snippet 1회 실행
- [ ] 시작 직후 console 에 `[coffee_npay_intent_preview] installed (preview only, no network send)` 출력 확인

시나리오 1. PC NPay 결제 시도:

- [ ] 옵션 1개 선택 → 수량 1
- [ ] PC NPay 버튼 (`#naverPayWrap` 안 SDK 버튼) 클릭
- [ ] console payload 1건 출력
- [ ] `intent_phase === "confirm_to_pay"` 확인
- [ ] `payment_button_type === "npay"` 확인
- [ ] `intent_seq === 1` 확인
- [ ] `metadata_source` 가 `initDetail_wrap` 또는 `inline_script_regex` 중 하나
- [ ] `metadata_missing === false`
- [ ] `prod_code` / `prod_idx` / `prod_price` 모두 0/빈문자 아님

시나리오 2. Mobile NPay 결제 시도:

- [ ] devtools mobile emulation iPhone 12 → 같은 페이지 reload → snippet 재실행
- [ ] 옵션 1개 선택 → 수량 1
- [ ] mobile NPay 버튼 (`._btn_mobile_npay`) 클릭
- [ ] console 에 `intent_phase === "click_to_dialog"` 1건 출력
- [ ] 다이얼로그에서 NPay 확정 클릭
- [ ] console 에 `intent_phase === "confirm_to_pay"` 1건 추가 출력
- [ ] 두 payload 의 `session_uuid` 동일
- [ ] `confirm_to_pay` 의 `intent_seq` 가 PC 시나리오와 같은 sessionStorage 면 2, 별도 reload 면 1

시나리오 3. 일반 구매하기 클릭 (NPay 아님, false positive 점검):

- [ ] PC 의 `_btn_buy` 클릭 (imweb_payment)
- [ ] sessionStorage `coffee_npay_intent_preview` buffer 길이 이전 그대로 (증가 0)
- [ ] console 에 `confirm_to_pay` 신규 출력 0건

시나리오 4. 옵션 미선택:

- [ ] 옵션 미선택 상태로 PC NPay 버튼 클릭
- [ ] imweb 가 옵션 선택 alert 띄우면 → 우리 hook 까지 도달 안 함 → console 신규 출력 0
- [ ] 만약 1건 들어오면 false positive — 같은 페이지 안에서 `metadata_missing` 또는 `selected_option_count === 0` 인지 메모

시나리오 5. 같은 세션 안 NPay 2회 시도 (intent_uuid 갱신 검증):

- [ ] 시나리오 1 직후 페이지 새로고침 없이 옵션 다시 선택 → PC NPay 다시 클릭
- [ ] 새 payload 의 `intent_uuid` 가 직전과 다름
- [ ] 새 payload 의 `session_uuid` 는 직전과 같음
- [ ] 새 payload 의 `intent_seq` 가 직전 + 1

PII 점검:

- [ ] 모든 payload JSON 에 `phone`, `email`, `name`, `addr`, `address` 키 부재
- [ ] `option` 텍스트 또는 옵션 가격 원문 부재
- [ ] 숫자 필드 `prod_price`, `selected_option_count`, `selected_quantity`, `estimated_item_total` 만 존재

외부 송출 0건 확인:

- [ ] devtools Network 탭 필터 `pay.naver|google-analytics|facebook|tiktok|/api/`
- [ ] snippet 실행으로 인한 신규 request 0건
- [ ] beforeunload 시점에도 새 request 0건

종료:

- [ ] 페이지 reload 또는 시크릿 창 닫기
- [ ] sessionStorage 의 `coffee_npay_intent_preview`, `coffee_npay_session_uuid`, `coffee_npay_intent_seq`, `coffee_npay_intent_uuid_pending` 4개 키가 모두 소멸

각 체크박스가 모두 PASS 인 경우에만 다음 phase (Imweb URL Query Param 보존 검증) 로 진입한다.

## Live 배포 금지 가드

본 phase 에서 다음은 모두 명시적으로 금지한다. 어느 하나라도 위반 시 Auditor verdict FAIL.

- GTM Coffee workspace **publish** 금지. preview workspace 에서만 검증.
- imweb 사이트 **head/footer custom script 직접 삽입** 금지.
- `fetch` / `navigator.sendBeacon` / `XMLHttpRequest` 호출 금지 (snippet 안에 0건).
- GA4 `gtag('event', ...)` 호출 금지 (snippet 안에 0건).
- Meta CAPI / TikTok Events API 직접 호출 금지.
- backend `/api/...` 호출 금지 (`coffee/intent/dry-run` 도 본 phase 에선 안 만든다).
- 허용은 sessionStorage 4개 키 + console.log 만.
- 본 문서 base 의 코드를 실 배포 코드로 복사 시 Auditor verdict FAIL.

## 다음 단계 (별도 phase, 본 phase 범위 외)

| 단계 | 트리거 | 산출물 |
|---|---|---|
| Step 1 | 본 design 승인 | snippet preview 체크리스트 1회 실행, 결과 기록 |
| Step 2 | preview 체크리스트 PASS | Imweb URL Query Param 보존 검증 (a/b/c) sandbox 실행. **deterministic 트랙 (A) 또는 ledger 트랙 (B) 결정** |
| Step 3 | (A) 트랙 채택 시 | confirmOrderWithCartItems 의 url 인자에 `intent_uuid` 부착하는 변경안 + Imweb sandbox 검증, ledger 는 단순 join 키로만 |
| Step 3 | (B) 트랙 채택 시 | local backend `POST /api/coffee/intent/dry-run` 추가 (write 0, payload 검증만). high-confidence matching 규칙 정의 |
| Step 4 | Step 3 PASS | local SQLite `coffee_npay_intent_log` 테이블 추가 + write 로컬에서만 |
| Step 5 | local store PASS + TJ 승인 | confirmed order join 규칙 적용 (30초 dedupe + 24시간 grace) |
| Step 6 | 정합성 7일 모니터링 | GTM Production workspace publish (이때부터 site live) |
| Step 7 | live PASS + ROAS 정합성 | GA4/Meta CAPI 보강 전송 승인 게이트 별도 진행 |

## 외부 시스템 영향

- imweb 사이트: 변경 없음 (이번 phase 는 head/footer 미수정).
- GTM workspace: workspace 변경 없음 (preview snippet 만, publish 없음).
- GA4/Meta/TikTok: 신규 이벤트 송출 없음.
- 로컬 DB: 신규 테이블 없음.
- 외부 API: 신규 호출 없음.

## 변경되는 동작

본 design 적용으로 인해 production 동작은 0건 변경된다. preview snippet 을 실행하는 chrome 세션에서만:

- `window.SITE_SHOP_DETAIL.initDetail` 이 wrap 되어 `_initDetailArgs` 가 추가됨. snippet 실행 시점에 이미 initDetail 이 끝났으면 inline `<script>` regex 또는 DOM data attribute 로 fallback.
- `window.SITE_SHOP_DETAIL.confirmOrderWithCartItems` 가 wrap 되어 `kind === "npay"` 호출 시 새 `intent_uuid` 발급 + sessionStorage 에 payload 저장.
- `_btn_mobile_npay` click 이벤트가 capture 단계에서 잡힘 (보조 신호 `click_to_dialog`).
- sessionStorage 에 4개 키만 사용: `coffee_npay_intent_preview` (buffer), `coffee_npay_session_uuid`, `coffee_npay_intent_seq`, `coffee_npay_intent_uuid_pending`.

이 모든 변경은 페이지 reload 또는 시크릿 창 종료 시 사라지고 영구 저장소에 남지 않는다.

## 관련 문서

- [[coffee-imweb-operational-readonly-20260501]] — 현재 unassigned actual 18 / ambiguous 29 분류
- [[coffee-excel-ltv-dry-run-20260501]] — 2024/2025 LTV dry-run
- [[coffee-npay-unassigned-ga4-guard-20260501]] — robust_absent 36/36
- [[harness/coffee-data/RULES|Coffee Rules]]
- [[!coffeedata#Phase3-Sprint6|!coffeedata § Phase3-Sprint6]]
