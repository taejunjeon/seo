# GPT footer 피드백 검토 및 답변 — 2026-04-15

> **원문**: `footer/gpt_footerfeedback_0415.md`
> **대상 파일**: `footer/biocom_footer_0415_final2.md` (현재 biocom.kr 운영 중)
> **작성자**: Claude (Code 리뷰 + 운영 맥락 통합 판정)

---

## TL;DR

GPT 피드백 7개 이슈 전부 **동의**하오. 특히 **`dryRun` 함정** 은 코드 한 줄 단위로 재현 확인됨 — 현재 "dry-run" 소크 중에도 **브라우저 fbq InitiateCheckout 은 실 픽셀로 이미 발사되고 있었음**. 옵션 중 **B (aimweb 자동 이벤트 수집 OFF → Phase 9 단독 소유)** 를 1순위로, **즉시 코드 수정**을 0순위로 진행 권고. 아래 §8 에 v2 전체 코드 제시.

**행동 순서**:
1. ⚡ 즉시: 코드에서 `dryRun` 을 `enableBrowserFbq` + `enableServerCapi` 로 분리 (§8 v2 코드)
2. 즉시: dedup 를 3개 이벤트 전부에 적용, EVENT_MAP 의 plain alias 제거
3. 24h 내: aimweb admin 에서 "자동 이벤트 수집" 토글 위치 확인 (TJ)
4. 확인되면: aimweb 자동 수집 OFF → Phase 9 `enableBrowserFbq=true, enableServerCapi=true` 로 전환
5. 전환 후: 옵션 D (24h Events Manager 수치 대조) 는 검증 수단으로만 사용

---

## 이슈별 검토

### Issue 1 — ★★★★★ `dryRun` 이 브라우저 fbq 를 막지 못함

**GPT 지적**: "현재 `dryRun`은 서버 fetch만 막고, 브라우저 `fbq('track', ...)`는 계속 발사합니다."

**내 판정: 완전 동의.** 코드 증거:

```js
// biocom_footer_0415_final2.md 라인 1167-1195

try {
  if (typeof window.fbq === 'function') {
    window.fbq('track', eventName, fbPayload, { eventID: eventId });  // ← line 1168 (fires regardless)
    log('fbq track', eventName, eventId);
  }
} catch (e) { log('fbq error', e); }

var body = {...};
if (TEST_CODE) body.testEventCode = TEST_CODE;

if (DRY_RUN) {  // ← line 1190 (only guards the fetch below)
  console.info('[funnel-capi][dry-run]', eventName, body);
  return;
}

try {
  fetch(ENDPOINT, {...})  // ← only this is blocked
```

**실제 운영 데이터로 교차 검증**:
어제 TJ 테스트에서 Console 에 `[funnel-capi] fbq track InitiateCheckout InitiateCheckout-1776257597827-apof4ciy` 가 찍혔고, Meta Events Manager 에 **"InitiateCheckout Active"** 항목이 새로 등장함. 즉 dry-run 이라고 선전했던 소크 동안 브라우저 픽셀이 **진짜 Meta 로 이벤트를 전송했음**. 이 건은 이미 Meta 에 반영됨 (회수 불가).

또한 **`testEventCode` 는 서버 바디에만 붙는 게 맞음** — 브라우저 fbq 의 `track` 메서드에는 testEventCode 파라미터가 없음. 따라서 "testEventCode 로 테스트 탭만 보게 하려면 fbq 호출 자체를 끄는 방법밖에 없음".

**수정 방향**: `dryRun` 을 두 개 독립 플래그로 쪼갬.
- `enableBrowserFbq: boolean` — 브라우저 fbq 호출 여부
- `enableServerCapi: boolean` — 서버 CAPI POST 여부
- `testEventCode: string` — 서버 바디에만 붙음 (브라우저엔 효과 없음)

"진짜 dry-run" = `enableBrowserFbq: false, enableServerCapi: false`. 어제 소크는 실제로는 `enableBrowserFbq: true, enableServerCapi: false` 상태였음.

### Issue 2 — ★★★★ 옵션 B 우선, A 비추

**GPT 판정**: B > C > D > A

**내 판정: 대부분 동의. 단서 1건 추가.**

| 옵션 | GPT | Claude (원래) | Claude (수정) | 이유 |
|---|---|---|---|---|
| A (Phase 9 서버 전용) | 비추 | 권장 | ❌ 철회 | GPT 말이 맞음. 서버만 남기면 browser↔server dedup pair 가 깨져서 Phase 9 의 가치(iOS ITP 회복)가 사라짐. 또 aimweb 자동 이벤트와는 여전히 dedup 안 됨 |
| B (aimweb 자동 OFF) | 1순위 | 3순위 | 🥇 1순위 | 이벤트 소유권을 한쪽으로 몰아야 dedup 의미 있음. Phase 9 가 `ViewContent/AddToCart/InitiateCheckout` 을 단독 소유하면 eventId 로 완벽 dedup |
| C (fbq monkey-patch) | 차선 | 4순위 | 🥈 2순위 | Purchase Guard v3 가 이미 `fbq` 를 wrap 한 상태에 또 겹치는 건 위험. 제대로 하려면 "패치 하나 더" 가 아니라 **공용 래퍼 재설계**. 복잡도 ↑ |
| D (사후 대조) | 검증용 | 1순위 | 검증용 | 의사결정 도구가 아니라 B 적용 후 검증 도구. 완전 동의 |

**B 의 단서 — AddPaymentInfo 손실 여부**:
- GPT 지적: "`AddPaymentInfo`는 현재 Phase 9 코드에 없어서 사라질 수 있으니, 그 이벤트가 꼭 필요하면 별도 추가 여부를 같이 결정"
- 현재 Events Manager 에 aimweb 이 `AddPaymentInfo https://biocom.kr/shop_view/?idx=...` 를 자동 발사 중
- aimweb shop plugin 이 이 이벤트를 **어느 dataLayer 이벤트와 연동하는지 불명**. HURDLERS 플러그인의 경우 `h_add_payment_info` 라는 이름이 있을 수 있음 (biocom GTM 감사에서 `HURDLERS - [데이터레이어] 네이버페이 구매` 등이 `h_add_payment_info` 발사 확인됨)
- **결정 필요**: `EVENT_MAP` 에 `h_add_payment_info: 'AddPaymentInfo'` 추가 여부. AEM 8-슬롯 우선순위에서 AddPaymentInfo 를 쓰는지 여부가 기준. biocom 의 현재 AEM 설정 확인 후 결정 권장. 일단 §8 v2 코드엔 **주석 처리해 두고**, 필요 시 한 줄 활성화로 추가

### Issue 3 — ★★★★ 옵션 C (monkey-patch) 보류

**GPT 지적**: "Purchase Guard가 이미 `fbq`를 건드리는 상황이면, 여기에 또 monkey-patch를 올리는 건 위험합니다."

**내 판정: 동의.** Purchase Guard v3 의 `wrapFbq` 체인은 이미 다음을 보장:
```
원본 fbq
  → Purchase Guard wrap (Purchase 차단/판정)
  → guardedFbq
```

여기에 Phase 9 가 또 wrap 을 얹으면:
```
원본 fbq
  → Purchase Guard wrap
  → Phase 9 wrap (ViewContent/AddToCart/InitiateCheckout 에 eventId 주입)
  → doubleWrappedFbq
```

- wrap 순서에 따라 Purchase Guard 의 Purchase 판정이 Phase 9 wrap 을 거쳐야 됨 → 예측 어려움
- Purchase Guard 는 `fbq.__BIOCOM_SERVER_PAYMENT_DECISION_GUARD_WRAPPED__` 마커로 재래핑 방지 → Phase 9 가 이 마커를 못 보고 덮어쓰면 Purchase 차단 로직이 날아감 리스크
- GPT 가 말한 "공용 래퍼 재설계" 가 정답이지만, 지금 시점엔 과함

**결론**: C 는 B 가 admin UI 제약으로 불가능할 때 last resort 로만 고려.

### Issue 4 — ★★★★★ 옵션 D 는 사후 검증용

**GPT 지적**: "D는 해결책으로는 약하고, 변경 후 검증용으로만 의미가 있습니다."

**내 판정: 완전 동의, 내 앞선 제안 중 "1차: 옵션 D" 는 틀렸음.** D 를 의사결정 메커니즘으로 쓰려면 "24h 운영 후 수치 2배 점프 여부" 를 봐야 하는데:
1. 수치 변화 해석이 애매함 (원래 트래픽 변화도 섞임)
2. 이미 어제 소크 중 브라우저 fbq 가 실 픽셀로 나가서 "활성화 전 vs 활성화 후" 의 기준점이 오염됨
3. B 로 일단 이벤트 소유권 정리한 뒤 D 로 "정말 중복 사라졌나" 확인하는 게 목적에 맞음

### Issue 5 — ★★★★★ AddToCart/InitiateCheckout dedup 부재

**GPT 지적**: "현재 dedupe는 `ViewContent`만 sessionStorage 기반으로 한 번 막고 있고, `InitiateCheckout`과 `AddToCart`는 별도 중복 방지가 없습니다."

**내 판정: 완전 동의.** 현재 코드 (라인 1135-1142):

```js
if (eventName === 'ViewContent' && payload.contentIds && payload.contentIds.length) {
  var dedupKey = payload.contentIds.join(',');
  if (alreadySeen(eventName, dedupKey)) {
    log('skip dup', eventName, dedupKey);
    return;
  }
  markSeen(eventName, dedupKey);
}
```

`ViewContent` 에만 dedup 체크가 있고 AddToCart/InitiateCheckout 는 체크 없이 통과. 아임웹 HURDLERS 플러그인이 같은 h_add_to_cart 를 여러 번 push 하거나(예: SPA 리렌더), 유저가 장바구니 버튼을 연속 클릭하면 **다중 발사** 가능.

**수정 방향 (§8 v2)**:
- 3개 이벤트 모두 dedup
- 핑거프린트 규칙:
  - `ViewContent`: `contentIds.join(',')`
  - `AddToCart`: `contentIds.join(',') + '::' + value` (수량/옵션 바뀌면 재발사 허용)
  - `InitiateCheckout`: Block 2 가 생성한 `__seo_checkout_id` 재사용 (있으면 `chk::<id>`, 없으면 content+value)

### Issue 6 — ★★★★ EVENT_MAP alias 중복 리스크

**GPT 지적**: "`EVENT_MAP`이 `h_*`와 일반 `view_item / add_to_cart / begin_checkout`를 둘 다 받기 때문에, 플러그인이 둘을 동시에 푸시하는 환경이면 중복 전송 가능성"

**내 판정: 동의.** 현재 map:
```js
var EVENT_MAP = {
  'h_view_item': 'ViewContent',
  'view_item': 'ViewContent',           // ← 일반 alias
  'h_add_to_cart': 'AddToCart',
  'add_to_cart': 'AddToCart',           // ← 일반 alias
  'h_begin_checkout': 'InitiateCheckout',
  'begin_checkout': 'InitiateCheckout'  // ← 일반 alias
};
```

biocom/coffee 는 HURDLERS 플러그인 기반이라 **`h_*` prefix 만** 사용 중임을 GTM 감사에서 확인했음. 일반 `view_item` 은 GTM 기본 ecommerce 경로에서 사용되는 이름으로, 일부 사이트가 HURDLERS + 기본 GTM 둘 다 쓰면 같은 사용자 액션에 `h_view_item` + `view_item` 이 순차 push → Phase 9 가 둘 다 매핑 → 2번 발사.

**수정 방향 (§8 v2)**:
- biocom/coffee/aibio 는 모두 HURDLERS 기반이므로 **일반 alias 제거**
- 추가 안전장치: `gtm.uniqueEventId` 기반 per-entry dedup. 같은 gtm.uniqueEventId 는 한 번만 처리 (같은 dataLayer push 에 대해 여러 이벤트 이름이 붙어도 한 번만 반응)

### Issue 7 — ★★★★★ Config 분리

**GPT 지적**: "`dryRun` 하나로 뭉뚱그리지 말고 `enableBrowserFbq`, `enableServerCapi`, `testEventCode`를 분리해야 합니다."

**내 판정: 완전 동의.** Issue 1 의 근본 해결. 분리하면:

| 시나리오 | enableBrowserFbq | enableServerCapi | testEventCode | 의미 |
|---|---|---|---|---|
| 완전 무해 dry-run (코드만 주입, 아무것도 안 쏨) | false | false | '' | snippet 설치 + 로그만, 이벤트 0건 |
| 서버 단독 테스트 (Meta Events Manager 테스트 탭만) | false | true | 'TESTXXX' | 브라우저는 조용, 서버만 테스트 탭으로 |
| 정식 운영 (aimweb 자동 OFF 후) | true | true | '' | Phase 9 가 browser + server 둘 다 단독 소유, dedup |
| 서버 전용 운영 (옵션 A — 비추) | false | true | '' | 브라우저는 aimweb 에 양보, 서버만 |

---

## 추가 발견 사항 (GPT 피드백 외)

### Add-1. EVENT_MAP 에 `h_add_payment_info` 포함 여부

aimweb Events Manager 에 현재 `AddPaymentInfo` 가 ViewContent 와 같은 페이지(`/shop_view/?idx=...`) 에서 발사 중. aimweb shop plugin 이 commerce flow 전환 시 자동 발사. 만약 aimweb 자동 수집을 끄면 (옵션 B) 이 이벤트가 사라짐.

**결정 기준**: biocom AEM 8 슬롯 우선순위 구성. AddPaymentInfo 가 슬롯 안에 있으면 대체 경로 필요, 없으면 loss 허용 가능. 확인 전까지 `EVENT_MAP` 에 주석 처리해 두고, 필요 시 `h_add_payment_info: 'AddPaymentInfo'` 한 줄 활성화.

### Add-2. Purchase Guard v3 와의 wrap 순서

Phase 9 가 fbq 를 직접 호출할 때 Purchase Guard v3 의 wrap 을 통과함. Purchase Guard 는 event name 이 `Purchase` 인 경우만 판정 로직에 들어가고 나머지는 passthrough 이므로 ViewContent/AddToCart/InitiateCheckout 은 영향 없음. 이미 어제 vbank 테스트에서 공존 확인됨 (Purchase Guard 의 VirtualAccountIssued + Phase 9 의 InitiateCheckout 이 같은 세션에서 독립 발사).

### Add-3. 배포 직후 검증 스크립트

v2 배포 후 live HTML 에 아래 식별자 확인:
```bash
curl -sL "https://www.biocom.kr/" -o /tmp/biocom_v2.html
grep -c "2026-04-15-biocom-funnel-capi-v2" /tmp/biocom_v2.html        # 기대 ≥1
grep -c "enableBrowserFbq" /tmp/biocom_v2.html                         # 기대 ≥1
grep -c "enableServerCapi" /tmp/biocom_v2.html                         # 기대 ≥1
grep -c "v1'\|funnel-capi-v1" /tmp/biocom_v2.html                      # 기대 0 (구버전 제거됨)
```

---

## 최종 권장 실행 순서

### 0순위 — 코드 수정 (즉시)

§8 v2 코드로 biocom_footer 교체. 핵심 변경:
1. `dryRun` → `enableBrowserFbq` + `enableServerCapi` 로 분리
2. AddToCart/InitiateCheckout 에도 dedup 추가
3. EVENT_MAP 에서 일반 alias 제거
4. `gtm.uniqueEventId` 기반 per-entry dedup 추가
5. snippetVersion 을 `2026-04-15-biocom-funnel-capi-v2` 로 bump

### 1순위 — "완전 무해 dry-run" 소크 (24h)

v2 배포 후 기본값:
```js
enableBrowserFbq: false
enableServerCapi: false
debug: true
```
이 상태면 Phase 9 가 **아무것도 안 쏨**. Console 로그로 dataLayer 구독 + payload 추출 + dedup 키 생성만 확인. Meta Events Manager 에 Phase 9 의 새 이벤트 0건 추가됨. 어제의 "소크 중 fbq 실 발사" 같은 부작용 없음.

### 2순위 — aimweb admin 확인 (TJ, 5분)

aimweb > 마케팅 > Facebook 픽셀 설정 들어가서 **"이벤트 자동 수집"** 또는 **"고급 이벤트 자동 전송"** 유사 토글 존재 여부 확인.

- **있으면 (옵션 B 가능)**: 토글 OFF → Events Manager 에서 ViewContent/InitiateCheckout/AddPaymentInfo 자동 발사가 멈추는지 24h 관찰
- **없으면 (옵션 B 불가)**: aimweb 에 요청해서 해제 옵션 생기는지 문의 / 또는 Phase 9 를 서버 전용 (옵션 A) 로 축소하고 AEM 슬롯 우선순위를 재조정
- **확신 안 서면**: 스크린샷 찍어 내게 주시오. 어떤 옵션이 있는지 같이 판단 가능

### 3순위 — 옵션 B 활성화 (1일 후)

aimweb 자동 OFF 확인 → Phase 9 설정 변경:
```js
enableBrowserFbq: true   // Phase 9 가 browser fbq 단독 소유
enableServerCapi: true   // 서버 CAPI 도 동시 활성
testEventCode: 'TEST...' // 먼저 24h Test Events 탭에서만 보기
```
Meta Events Manager 테스트 탭에서 ViewContent/AddToCart/InitiateCheckout 가 **브라우저 + 서버** 양쪽으로 수신, `event_id` 기준 dedup 되어 **1건** 으로 합쳐지는지 확인.

### 4순위 — 정식 운영 (48h 후)

testEventCode 제거:
```js
enableBrowserFbq: true
enableServerCapi: true
testEventCode: ''
debug: false
```

### 5순위 — 옵션 D 검증 (7일 관찰)

Events Manager 수치 + GA4 ecommerce + Google Ads 전환 기준선 변화. GPT 말대로 이건 결정이 아니라 **B 가 잘 작동했는지 사후 확인**.

---

## §8 — 최종 제안 코드 (v2 전체)

Phase 9 블록만 교체. Block 1~3 (UTM persistence / checkout_started / payment_success) 은 `biocom_footer_0415_final2.md` 라인 1-1008 그대로 유지. 아래 블록이 1009 줄부터 끝까지 교체.

```html
<!--
  Phase 9 Funnel CAPI mirror — biocom (v2)
  변경 내역 vs v1:
    1) dryRun 플래그를 enableBrowserFbq + enableServerCapi 로 분리
       (v1 의 dryRun 은 서버 fetch 만 차단하고 브라우저 fbq 는 실 발사되는 버그)
    2) AddToCart / InitiateCheckout 에도 sessionStorage dedup 추가
    3) EVENT_MAP 에서 일반 alias (view_item/add_to_cart/begin_checkout) 제거
       HURDLERS 기반 사이트(biocom/coffee/aibio)는 h_* 만 사용
    4) gtm.uniqueEventId 기반 per-entry dedup 추가 (같은 push 재처리 방지)
    5) snippetVersion 2026-04-15-biocom-funnel-capi-v2

  단계별 config 전환:
    0) 코드 주입 직후 (무해 dry-run):   enableBrowserFbq=false, enableServerCapi=false
    1) 서버만 테스트 (Test Events 탭):  enableBrowserFbq=false, enableServerCapi=true, testEventCode='TEST_XXX'
    2) aimweb 자동 수집 OFF 후 병행:    enableBrowserFbq=true,  enableServerCapi=true, testEventCode='TEST_XXX'
    3) 정식 운영:                       enableBrowserFbq=true,  enableServerCapi=true, testEventCode=''
-->
<script>
  window.FUNNEL_CAPI_CONFIG = {
    pixelId: '1283400029487161',
    endpoint: 'https://att.ainativeos.net/api/meta/capi/track',
    // Phase 0 — 초기 주입 시 아무것도 안 쏨 (완전 무해 dry-run)
    enableBrowserFbq: false,
    enableServerCapi: false,
    testEventCode: '',
    debug: true
  };
</script>

<script>
/*!
 * Phase 9 — Funnel CAPI mirror (biocom)
 * 2026-04-15-biocom-funnel-capi-v2
 *
 * 아임웹 dataLayer 이벤트 (h_view_item / h_add_to_cart / h_begin_checkout) 를
 * 가로채어 Meta 픽셀 (fbq) + 서버 CAPI 양쪽으로 동일 event_id 로 전송한다.
 * Meta 가 event_id 기준으로 자동 dedup → 이중 카운트 없음.
 *
 * v2: browser fbq 와 server CAPI 를 독립 플래그로 제어하여 진짜 무해한
 * dry-run 을 만들 수 있다. v1 의 dryRun 은 server fetch 만 차단했던
 * 부분 버그였음 (fbq 는 실 발사). 자세한 경위는 gpt_footerfeedback_0415reply.md 참조.
 */
(function () {
  'use strict';
  var cfg = window.FUNNEL_CAPI_CONFIG || {};
  var SNIPPET_VERSION = '2026-04-15-biocom-funnel-capi-v2';
  var ENDPOINT = cfg.endpoint || 'https://att.ainativeos.net/api/meta/capi/track';
  var PIXEL_ID = cfg.pixelId;
  var ENABLE_BROWSER_FBQ = !!cfg.enableBrowserFbq;
  var ENABLE_SERVER_CAPI = !!cfg.enableServerCapi;
  var TEST_CODE = cfg.testEventCode || '';
  var DEBUG = !!cfg.debug;

  if (!PIXEL_ID) {
    console.warn('[funnel-capi] FUNNEL_CAPI_CONFIG.pixelId missing — aborting');
    return;
  }
  if (window.__FUNNEL_CAPI_INSTALLED) return;
  window.__FUNNEL_CAPI_INSTALLED = SNIPPET_VERSION;

  function log() {
    if (DEBUG) {
      try { console.info.apply(console, ['[funnel-capi]'].concat([].slice.call(arguments))); }
      catch (e) {}
    }
  }

  function getCookie(name) {
    var m = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/[-.+*]/g, '\\$&') + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : undefined;
  }

  function genEventId(ev) {
    return ev + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);
  }

  /* ── sessionStorage dedup (3 events 공통) ─────────────────────────── */
  function sentKey(ev, fp) { return 'funnelCapi::' + ev + '::' + fp; }
  function alreadySent(ev, fp) {
    try { return !!window.sessionStorage && !!window.sessionStorage.getItem(sentKey(ev, fp)); }
    catch (e) { return false; }
  }
  function markSent(ev, fp) {
    try {
      if (!window.sessionStorage) return;
      window.sessionStorage.setItem(sentKey(ev, fp), '1');
    } catch (e) {}
  }

  // Per-event dedup fingerprint
  function dedupFingerprint(eventName, payload) {
    var ids = (payload.contentIds || []).join(',') || 'empty';
    var value = payload.value || 0;
    switch (eventName) {
      case 'ViewContent':
        return ids;
      case 'AddToCart':
        return ids + '::v' + value;
      case 'InitiateCheckout':
        // Block 2 의 checkoutId 를 재사용 (같은 주문서 재방문은 1회만)
        try {
          var cid = window.sessionStorage && window.sessionStorage.getItem('__seo_checkout_id');
          if (cid) return 'chk::' + cid;
        } catch (e) {}
        return ids + '::v' + value;
      default:
        return null;
    }
  }

  /* ── 상품 정보 추출 (fallback) ─────────────────────────────────────── */
  function getShopDetail() {
    try {
      // SITE_SHOP_DETAIL.initDetail(payload) 는 호출 즉시 사라지므로 DOM fallback 사용
      var btn = document.querySelector('[data-bs-prod-code]');
      if (btn) {
        return {
          prod_code: btn.getAttribute('data-bs-prod-code') || undefined,
          prod_idx: btn.getAttribute('data-bs-prod-idx') || undefined,
          prod_type: btn.getAttribute('data-bs-prod-type') || undefined
        };
      }
    } catch (e) {}
    return {};
  }

  function numberOr(val, fallback) {
    var n = Number(val);
    return isFinite(n) && n > 0 ? n : fallback;
  }

  function extractPayloadFromDataLayerArg(arg) {
    var h = (arg && arg.hurdlers_ga4) || (window.hurdlers_ga4 || {});
    var items = (arg && arg.items) || (arg && arg.ecommerce && arg.ecommerce.items) || h.items || [];
    var detail = getShopDetail();

    var contentIds = [];
    var totalValue = 0;

    if (Array.isArray(items) && items.length) {
      for (var i = 0; i < items.length; i++) {
        var it = items[i] || {};
        var id = it.item_id || it.id || it.prod_code || it.productId || '';
        if (id) contentIds.push(String(id));
        var price = numberOr(it.price, 0);
        var qty = numberOr(it.quantity, 1);
        totalValue += price * qty;
      }
    }

    if (!contentIds.length && detail.prod_code) {
      contentIds.push(String(detail.prod_code));
    }

    if (!totalValue) {
      totalValue =
        numberOr(arg && arg.value, 0) ||
        numberOr(arg && arg.ecommerce && arg.ecommerce.value, 0) ||
        numberOr(h.value, 0);
    }

    return {
      contentIds: contentIds,
      contentType: 'product',
      value: totalValue > 0 ? totalValue : undefined,
      currency: (arg && arg.currency) || (arg && arg.ecommerce && arg.ecommerce.currency) || h.currency || 'KRW'
    };
  }

  /* ── 핵심 전송 함수 ────────────────────────────────────────────────── */
  function sendFunnelEvent(eventName, payload) {
    var fp = dedupFingerprint(eventName, payload);
    if (fp && alreadySent(eventName, fp)) {
      log('skip dup', eventName, fp);
      return;
    }

    var eventId = genEventId(eventName);

    var fbPayload = {};
    if (payload.contentIds && payload.contentIds.length) fbPayload.content_ids = payload.contentIds;
    if (payload.contentType) fbPayload.content_type = payload.contentType;
    if (payload.value) fbPayload.value = payload.value;
    if (payload.currency) fbPayload.currency = payload.currency;

    /* ── (1) 브라우저 fbq ── gated ── */
    if (ENABLE_BROWSER_FBQ) {
      try {
        if (typeof window.fbq === 'function') {
          window.fbq('track', eventName, fbPayload, { eventID: eventId });
          log('fbq track (live)', eventName, eventId);
        } else {
          log('fbq not loaded', eventName);
        }
      } catch (e) {
        log('fbq error', e && e.message ? e.message : e);
      }
    } else {
      log('fbq skipped (disabled)', eventName, eventId);
    }

    /* ── (2) 서버 CAPI ── gated ── */
    var body = {
      eventName: eventName,
      pixelId: PIXEL_ID,
      eventId: eventId,
      eventSourceUrl: location.href,
      fbp: getCookie('_fbp'),
      fbc: getCookie('_fbc'),
      contentIds: payload.contentIds || undefined,
      contentType: payload.contentType || undefined,
      value: payload.value || undefined,
      currency: payload.currency || undefined
    };
    if (TEST_CODE) body.testEventCode = TEST_CODE;

    if (!ENABLE_SERVER_CAPI) {
      log('server skipped (disabled)', eventName, body);
      if (fp) markSent(eventName, fp);
      return;
    }

    try {
      fetch(ENDPOINT, {
        method: 'POST',
        mode: 'cors',
        credentials: 'omit',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        keepalive: true
      }).then(function (r) {
        if (!r.ok) log('server non-2xx', r.status);
        else log('server ok', eventName, eventId);
      }).catch(function (err) {
        log('server error', err && err.message ? err.message : err);
      });
      if (fp) markSent(eventName, fp);
    } catch (e) {
      log('fetch throw', e && e.message ? e.message : e);
    }
  }

  /* ── dataLayer 구독 ────────────────────────────────────────────────── */
  // v2: plain alias 제거. HURDLERS h_* 만 지원.
  // 필요 시 h_add_payment_info 를 활성화 하려면 아래 주석 해제:
  //   'h_add_payment_info': 'AddPaymentInfo'
  var EVENT_MAP = {
    'h_view_item': 'ViewContent',
    'h_add_to_cart': 'AddToCart',
    'h_begin_checkout': 'InitiateCheckout'
    // 'h_add_payment_info': 'AddPaymentInfo'  // aimweb 자동 OFF 후 AEM 우선순위 확인 후 활성화
  };

  // Per-push dedup (gtm.uniqueEventId 기반, 같은 push 중복 처리 방지)
  var seenGtmEventIds = Object.create(null);

  function handleDataLayerEntry(entry) {
    if (!entry || typeof entry !== 'object') return;
    var evName = entry.event;
    if (!evName) return;
    var mapped = EVENT_MAP[evName];
    if (!mapped) return;

    var gtmUid = entry['gtm.uniqueEventId'];
    if (typeof gtmUid === 'number') {
      var k = String(gtmUid);
      if (seenGtmEventIds[k]) {
        log('skip gtm.uniqueEventId dup', evName, k);
        return;
      }
      seenGtmEventIds[k] = 1;
    }

    var payload = extractPayloadFromDataLayerArg(entry);
    log('map', evName, '→', mapped, payload);
    sendFunnelEvent(mapped, payload);
  }

  window.dataLayer = window.dataLayer || [];
  // 기존 엔트리 replay (GTM 이 먼저 로드된 경우)
  try {
    for (var i = 0; i < window.dataLayer.length; i++) {
      handleDataLayerEntry(window.dataLayer[i]);
    }
  } catch (e) {
    log('replay error', e && e.message ? e.message : e);
  }

  // push 가로채기
  var origPush = window.dataLayer.push.bind(window.dataLayer);
  window.dataLayer.push = function () {
    var rv = origPush.apply(null, arguments);
    try {
      for (var j = 0; j < arguments.length; j++) {
        handleDataLayerEntry(arguments[j]);
      }
    } catch (e) {
      log('push hook error', e && e.message ? e.message : e);
    }
    return rv;
  };

  log('installed', SNIPPET_VERSION,
    'pixel=' + PIXEL_ID,
    'enableBrowserFbq=' + ENABLE_BROWSER_FBQ,
    'enableServerCapi=' + ENABLE_SERVER_CAPI,
    'testEventCode=' + (TEST_CODE || '(none)'));
})();
</script>
```

---

## 배포 후 즉시 검증

### 1. 라이브 HTML grep

```bash
curl -sL "https://www.biocom.kr/" -H "User-Agent: Mozilla/5.0" -o /tmp/biocom_v2.html
grep -c "2026-04-15-biocom-funnel-capi-v2" /tmp/biocom_v2.html          # 기대 ≥1
grep -c "enableBrowserFbq" /tmp/biocom_v2.html                           # 기대 ≥2
grep -c "enableServerCapi" /tmp/biocom_v2.html                           # 기대 ≥2
grep -c "2026-04-15-biocom-funnel-capi-v1" /tmp/biocom_v2.html          # 기대 0 (구버전 제거)
grep -c "2026-04-15-biocom-checkout-started-v1" /tmp/biocom_v2.html     # 기대 1 (block 2 유지)
grep -c "2026-04-15-biocom-payment-success-order-code-v1" /tmp/biocom_v2.html  # 기대 1 (block 3 유지)
```

### 2. Console 로그 (TJ 가 biocom 아무 상품 페이지 열어서 확인)

기대 로그:
```
[biocom-server-payment-decision-guard] installed 2026-04-12-server-payment-decision-guard-v3
[funnel-capi] installed 2026-04-15-biocom-funnel-capi-v2 pixel=1283400029487161 enableBrowserFbq=false enableServerCapi=false testEventCode=(none)
[funnel-capi] map h_view_item → ViewContent {contentIds: [...], value: ..., currency: 'KRW'}
[funnel-capi] fbq skipped (disabled) ViewContent ViewContent-...
[funnel-capi] server skipped (disabled) ViewContent {...body...}
```

**이 단계에서 Meta Events Manager 에는 Phase 9 의 새 이벤트 0건**. 완전 무해한 dry-run. 반면 어제 v1 은 `[funnel-capi] fbq track InitiateCheckout ...` 이 찍혔고 실제 Events Manager 에 올라갔음 — 그게 v1 의 부분 버그.

### 3. 장바구니/주문서 페이지에서도 map 로그 확인

- 장바구니 담기 → `[funnel-capi] map h_add_to_cart → AddToCart {...}`
- 주문서 페이지 → `[funnel-capi] map h_begin_checkout → InitiateCheckout {...}`
- 같은 페이지 재방문 → `[funnel-capi] skip dup ViewContent <fingerprint>` (dedup 작동 확인)

### 4. aimweb admin 토글 확인 (병행)

TJ 가 동시에 aimweb admin 에서 "자동 이벤트 수집" 옵션 위치 찾기. 찾으면 스크린샷.

---

## 리스크 / 한계

1. **어제 v1 으로 이미 발사된 Phase 9 fbq 이벤트** (InitiateCheckout 1건 이상) 는 Meta Events Manager 에 반영됨. 회수 불가. 단, v1 snippetVersion 이 짧게 (수십 분) 운영됐으므로 영향 극소.
2. **옵션 B 의 aimweb 토글이 실제로 존재하지 않을 가능성**. 그 경우 옵션 C (monkey-patch) 로 갈지, 옵션 A (server only) 로 축소할지 재논의 필요.
3. **AddPaymentInfo 처리**. v2 코드엔 주석 처리. 필요하면 한 줄 활성화로 추가. biocom AEM 8 슬롯 구성 확인 후 결정.
4. **gtm.uniqueEventId 없는 push 는 dedup 누락**. 대부분의 GTM push 는 이 필드를 자동 부여하지만, 직접 `window.dataLayer.push({event: 'h_view_item'})` 를 쓰는 커스텀 코드는 없을 수 있음. 그 경우 fingerprint dedup (sessionStorage) 가 2차 방어선.
5. **sessionStorage quota**. 상품 N개 × 이벤트 3종 × dedup 키 = 세션당 최대 수백 개. 일반적 한도 내. 모바일 Safari private mode 는 sessionStorage 가 동작하지만 5MB 미만으로 제한 — 문제없음.

---

## 결론

GPT 피드백 7개 이슈 전부 수용. v1 의 `dryRun` 함정은 실측으로 확인됨. §8 v2 코드로 교체하고, "진짜 무해 dry-run → aimweb 자동 확인 → B 활성화 → D 사후 검증" 순서로 진행. v2 파일은 `biocom_footer_0415_final3.md` 로 생성 예정 (TJ 승인 시).
