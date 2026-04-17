# Phase 9 — Funnel CAPI 클라이언트 스니펫 (2026-04-15)

> biocom.kr / thecleancoffee.com 아임웹 **footer 맨 마지막** 에 삽입할 새 스크립트 블록. 브라우저 픽셀(`fbq`)과 서버 CAPI(`POST /api/meta/capi/track`)를 **동일 `eventId`** 로 동시 발사하여 Meta 가 자동 dedup 하도록 설계됨. 실패해도 사용자 경험 영향 없음 (차단 판정 없음).

## 0. 한 줄 요약

- **목적**: `Purchase` 외의 퍼널 3단계 (`ViewContent`, `AddToCart`, `InitiateCheckout`) 를 Meta 에 **서버 경로 + 브라우저 경로** 양쪽으로 보내 AEM 슬롯 1→4 확장 + iOS ITP 손실 5~15% 회복 + ML 학습 신호 강화
- **원리**: 아임웹 기본 `dataLayer.push` 이벤트 (`h_view_item` / `h_add_to_cart` / `h_begin_checkout` — biocom HURDLERS 플러그인 기본 발화) 를 가로채어 서버 `/api/meta/capi/track` 으로 mirror
- **특징**: DOM 셀렉터 의존 없음, sessionStorage 로 같은 상품 반복 발사 차단, 서버 실패해도 fbq 는 독립적으로 이미 발사됨
- **배포**: 기존 footer/header 코드 수정 없이 **새 script 블록 하나만** 추가. snippetVersion 으로 롤아웃 추적

---

## 1. 서버 쪽 선결 조건 (이미 완료)

| 항목 | 확인 방법 |
|---|---|
| `POST /api/meta/capi/track` | `curl https://att.ainativeos.net/api/meta/capi/track -X POST -H 'Origin: https://biocom.kr' ...` → 200 `{ok:true, result:{tokenKind:'global' 또는 'coffee_system_user', response:{events_received:1}}}` |
| CORS 화이트리스트 | biocom.kr / www.biocom.kr / thecleancoffee.com / www.thecleancoffee.com / thecleancoffee.imweb.me |
| 이벤트 화이트리스트 | `ViewContent / AddToCart / InitiateCheckout / Lead / Search` |
| 픽셀 화이트리스트 | `META_PIXEL_ID_BIOCOM` / `META_PIXEL_ID_COFFEE` / `META_PIXEL_ID_AIBIO` (env 기준) |
| Rate limit | IP 당 30초 / 300 req |
| 토큰 라우팅 | 픽셀별 system user token 분기 (coffee 는 `COFFEE_META_TOKEN`) |
| 검증 성공 이력 | 2026-04-15 04:20~ KST biocom + coffee 양쪽 manual curl 로 `events_received:1` 확인 |

---

## 2. 공통 스니펫 (biocom / coffee 공용 — pixelId 만 치환)

아래를 그대로 복붙하되, **마지막 줄의 `FUNNEL_CAPI_CONFIG` 객체 안의 `pixelId`** 만 사이트별로 바꿔 삽입한다.

```html
<script>
/*!
 * Phase 9 — Funnel CAPI mirror
 * 2026-04-15-funnel-capi-v1
 *
 * 아임웹 dataLayer 이벤트 (h_view_item / h_add_to_cart / h_begin_checkout) 를 가로채어
 * Meta 픽셀 (fbq) + 서버 CAPI 양쪽으로 동일 event_id 로 전송.
 * Meta 가 event_id 기준 dedup → 이중 카운트 없음.
 *
 * 설정: window.FUNNEL_CAPI_CONFIG
 *   pixelId    (string, required)  — Meta 픽셀 ID
 *   endpoint   (string, optional)  — CAPI 프록시. default: https://att.ainativeos.net/api/meta/capi/track
 *   dryRun     (boolean, optional) — true 면 fetch 안 하고 console.log 만. default: false
 *   debug      (boolean, optional) — true 면 단계별 console.info. default: false
 *   testEventCode (string, optional) — Meta Events Manager 테스트 코드 (검증 기간 동안만)
 */
(function () {
  'use strict';
  var cfg = window.FUNNEL_CAPI_CONFIG || {};
  var SNIPPET_VERSION = '2026-04-15-funnel-capi-v1';
  var ENDPOINT = cfg.endpoint || 'https://att.ainativeos.net/api/meta/capi/track';
  var PIXEL_ID = cfg.pixelId;
  var DRY_RUN = !!cfg.dryRun;
  var DEBUG = !!cfg.debug;
  var TEST_CODE = cfg.testEventCode || '';

  if (!PIXEL_ID) {
    console.warn('[funnel-capi] FUNNEL_CAPI_CONFIG.pixelId missing — aborting');
    return;
  }
  // 중복 install 방지
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
  function sessionSeenKey(ev, id) { return 'funnelCapi::' + ev + '::' + id; }
  function alreadySeen(ev, id) {
    try { return !!sessionStorage.getItem(sessionSeenKey(ev, id)); } catch (e) { return false; }
  }
  function markSeen(ev, id) {
    try { sessionStorage.setItem(sessionSeenKey(ev, id), '1'); } catch (e) {}
  }

  /* ── 아임웹 페이지 전역에서 현재 상품 정보를 안전하게 추출 ────────────── */
  function getShopDetail() {
    try {
      if (window.SITE_SHOP_DETAIL && typeof window.SITE_SHOP_DETAIL.initDetail === 'function') {
        // aimweb 은 initDetail(payload) 을 즉시 호출하고 저장해 두지 않기 때문에
        // 렌더 직후 payload 를 window.__aimweb_prod 로 남기는 우회가 없다면 DOM fallback 사용
      }
    } catch (e) {}
    // DOM fallback
    var btn = document.querySelector('[data-bs-prod-code]');
    if (btn) {
      return {
        prod_code: btn.getAttribute('data-bs-prod-code') || undefined,
        prod_idx: btn.getAttribute('data-bs-prod-idx') || undefined,
        prod_type: btn.getAttribute('data-bs-prod-type') || undefined,
      };
    }
    return {};
  }
  function numberOr(val, fallback) {
    var n = Number(val);
    return isFinite(n) && n > 0 ? n : fallback;
  }

  /* ── 이벤트 payload 추출 ──────────────────────────────────────────── */
  function extractPayloadFromDataLayerArg(arg) {
    // 허들러스 플러그인은 hurdlers_ga4 네임스페이스 하위에 items/currency/value 를 쌓음
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
    if (!contentIds.length && detail.prod_code) contentIds.push(String(detail.prod_code));
    if (!totalValue) {
      totalValue = numberOr(arg && arg.value, 0)
        || numberOr(arg && arg.ecommerce && arg.ecommerce.value, 0)
        || numberOr(h.value, 0);
    }
    return {
      contentIds: contentIds,
      contentType: 'product',
      value: totalValue > 0 ? totalValue : undefined,
      currency: (arg && arg.currency) || (arg && arg.ecommerce && arg.ecommerce.currency) || h.currency || 'KRW',
    };
  }

  /* ── 핵심 전송 함수 ──────────────────────────────────────────────── */
  function sendFunnelEvent(eventName, payload) {
    var eventId = genEventId(eventName);
    // 중복 억제: 동일 세션 + 동일 contentIds 조합이면 skip (ViewContent 에만 적용)
    if (eventName === 'ViewContent' && payload.contentIds && payload.contentIds.length) {
      var dedupKey = payload.contentIds.join(',');
      if (alreadySeen(eventName, dedupKey)) {
        log('skip dup', eventName, dedupKey);
        return;
      }
      markSeen(eventName, dedupKey);
    }

    var fbPayload = {};
    if (payload.contentIds && payload.contentIds.length) fbPayload.content_ids = payload.contentIds;
    if (payload.contentType) fbPayload.content_type = payload.contentType;
    if (payload.value) fbPayload.value = payload.value;
    if (payload.currency) fbPayload.currency = payload.currency;

    // (1) 브라우저 픽셀 — fbq 가 이미 헤더에서 로드돼 있다면
    try {
      if (typeof window.fbq === 'function') {
        window.fbq('track', eventName, fbPayload, { eventID: eventId });
        log('fbq track', eventName, eventId);
      }
    } catch (e) { log('fbq error', e); }

    // (2) 서버 CAPI
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
      currency: payload.currency || undefined,
    };
    if (TEST_CODE) body.testEventCode = TEST_CODE;

    if (DRY_RUN) {
      console.info('[funnel-capi][dry-run]', eventName, body);
      return;
    }

    try {
      fetch(ENDPOINT, {
        method: 'POST',
        mode: 'cors',
        credentials: 'omit',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        keepalive: true,
      }).then(function (r) {
        if (!r.ok) log('server non-2xx', r.status);
        else log('server ok', eventName, eventId);
      }).catch(function (err) { log('server error', err); });
    } catch (e) { log('fetch throw', e); }
  }

  /* ── dataLayer 구독 ──────────────────────────────────────────────── */
  var EVENT_MAP = {
    'h_view_item': 'ViewContent',
    'view_item': 'ViewContent',
    'h_add_to_cart': 'AddToCart',
    'add_to_cart': 'AddToCart',
    'h_begin_checkout': 'InitiateCheckout',
    'begin_checkout': 'InitiateCheckout',
  };

  function handleDataLayerEntry(entry) {
    if (!entry || typeof entry !== 'object') return;
    var evName = entry.event;
    if (!evName) return;
    var mapped = EVENT_MAP[evName];
    if (!mapped) return;
    var payload = extractPayloadFromDataLayerArg(entry);
    log('map', evName, '→', mapped, payload);
    sendFunnelEvent(mapped, payload);
  }

  window.dataLayer = window.dataLayer || [];
  // 이미 쌓인 엔트리를 한 번 훑음 (문서 상단 GTM 이 먼저 로드된 경우 대비)
  try {
    for (var i = 0; i < window.dataLayer.length; i++) handleDataLayerEntry(window.dataLayer[i]);
  } catch (e) { log('replay error', e); }
  // 이후 push 를 가로챔
  var origPush = window.dataLayer.push.bind(window.dataLayer);
  window.dataLayer.push = function () {
    var rv = origPush.apply(null, arguments);
    try {
      for (var j = 0; j < arguments.length; j++) handleDataLayerEntry(arguments[j]);
    } catch (e) { log('push hook error', e); }
    return rv;
  };

  log('installed', SNIPPET_VERSION, 'pixel=' + PIXEL_ID, 'dryRun=' + DRY_RUN);
})();
</script>
```

### 2-A. biocom.kr 용 — 위 스크립트 앞에 추가

```html
<script>
  window.FUNNEL_CAPI_CONFIG = {
    pixelId: '1283400029487161',  // biocom
    dryRun: true,                  // 초기 24시간은 dry-run
    debug: true,                   // 콘솔 로그 활성화
    testEventCode: 'TEST12345'     // Meta Events Manager 에서 테스트코드 받아 넣음
  };
</script>
```

### 2-B. thecleancoffee.com 용 — 위 스크립트 앞에 추가

```html
<script>
  window.FUNNEL_CAPI_CONFIG = {
    pixelId: '1186437633687388',  // coffee
    dryRun: true,
    debug: true,
    testEventCode: 'TEST12345'
  };
</script>
```

---

## 3. 설치 위치

기존 footer/header 코드 다음에 **독립 블록** 으로 추가. 삽입 전후 순서:

```
┌───────────────────────────────────────────────────────────┐
│ 1. Meta Pixel base code (이미 설치)                       │
│ 2. fbq('init', ...)  (이미 설치)                          │
│ 3. GA4 구성 태그 + HURDLERS 플러그인 (GTM 경유)           │
│ 4. Purchase Guard v3 (header, biocom/coffee)              │
│ 5. UTM persistence + checkout_started + payment_success   │
│    (기존 footer/coffeefooter0414.md)                      │
│ 6. ★ Funnel CAPI mirror ★ (이 파일)                       │ ← 추가
└───────────────────────────────────────────────────────────┘
```

`FUNNEL_CAPI_CONFIG` 는 **반드시 본 스니펫 이전** 에 선언되어야 함 (스니펫이 IIFE 로 즉시 실행되므로).

---

## 4. 검증 절차

### 4-1. 서버 수동 curl (이미 완료)

```bash
# biocom
curl -s -X POST 'https://att.ainativeos.net/api/meta/capi/track' \
  -H 'Content-Type: application/json' -H 'Origin: https://biocom.kr' \
  -d '{"eventName":"ViewContent","pixelId":"1283400029487161","eventId":"manual-1","eventSourceUrl":"https://biocom.kr/product/1","contentIds":["1"],"contentType":"product","value":50000,"currency":"KRW","testEventCode":"TEST12345"}'
# ✅ 확인: 2026-04-15 04:20 KST — events_received:1, tokenKind:'global'

# coffee
curl -s -X POST 'https://att.ainativeos.net/api/meta/capi/track' \
  -H 'Content-Type: application/json' -H 'Origin: https://thecleancoffee.com' \
  -d '{"eventName":"AddToCart","pixelId":"1186437633687388","eventId":"manual-2","eventSourceUrl":"https://thecleancoffee.com/product/4","contentIds":["4"],"contentType":"product","value":18300,"currency":"KRW","testEventCode":"TEST12345"}'
# ✅ 확인: 2026-04-15 04:24 KST — events_received:1, tokenKind:'coffee_system_user'
```

### 4-2. dry-run 배포 후 콘솔 검증

1. biocom 또는 coffee footer 에 스니펫 설치 (dryRun:true)
2. 상품 상세페이지 접속 → F12 Console 에 아래 로그 확인:
   - `[funnel-capi] installed 2026-04-15-funnel-capi-v1 pixel=1283400029487161 dryRun=true`
   - `[funnel-capi] map h_view_item → ViewContent {contentIds, value, currency}`
   - `[funnel-capi][dry-run] ViewContent {...body...}`
3. 장바구니 담기 버튼 클릭 → `[funnel-capi] map h_add_to_cart → AddToCart`
4. 주문서 페이지 진입 → `[funnel-capi] map h_begin_checkout → InitiateCheckout`

### 4-3. Meta Events Manager — 테스트 이벤트 패널

1. Events Manager → 해당 픽셀 (`1283400029487161` biocom / `1186437633687388` coffee)
2. **테스트 이벤트** 탭 → 테스트 이벤트 코드 `TEST12345` 입력
3. dryRun=false 로 바꾸고 실제 페이지 재방문 → ViewContent/AddToCart/InitiateCheckout 이 **"처리된 이벤트"** 에 등장해야 함
4. 같은 이벤트가 **"브라우저 + 서버"** 양쪽으로 1건씩 보이고, **event_id 가 동일**하면 Meta 가 자동 dedup 표시

### 4-4. 실사용자 대상 활성화 (dry-run 해제)

- `dryRun: false`, `debug: false`, `testEventCode: ''` 로 변경 후 재배포
- 24시간 후 Events Manager → **정규 이벤트** 에서 ViewContent/AddToCart/InitiateCheckout 수치 확인
- 7일 후 **이벤트 일치 품질** 점수 확인 (권장: EMQ ≥ 7.0)

---

## 5. 롤백 절차

배포 직후 이상 감지 시:

1. footer 에서 스니펫 블록 전체 제거 or
2. `dryRun: true` 로 토글 후 재배포 (서버 전송 즉시 중단, fbq 도 사이드이펙트 없음)

**주의**: Meta Events Manager 에 이미 발사된 이벤트는 회수 불가. dedup 실수로 이중 카운트된 경우 24시간 관찰 후 Meta 지원 케이스로 보정 요청 가능.

---

## 6. 기대 효과 / 관찰 지표

| 지표 | 도입 전 | 도입 후 기대 |
|---|---:|---:|
| Meta AEM 슬롯 사용 | 1/8 (Purchase 만) | 4/8 |
| 서버 이벤트 비율 (iOS Safari 기준) | — | 60~80% |
| EMQ (Event Match Quality) | — | 7.0+ 목표 |
| Purchase 대비 상위 퍼널 비율 | 정의 불가 | VC:AC:IC:P ≈ 100:15:5:1 기대 (업계 평균) |
| 최적화 가능 캠페인 목표 | "Purchase" 만 | "ViewContent/AddToCart/InitiateCheckout" 도 선택 가능 |

### 모니터링 대상 경고

- **EMQ < 5.0** → fbp/fbc 추출 실패 가능성. 스크립트의 `getCookie('_fbp')` 로그 점검
- **ViewContent 가 Purchase 보다 적음** → sessionStorage dedup 이 너무 공격적. `sessionStorage.clear()` 후 재시도
- **AddToCart / InitiateCheckout 가 0** → 아임웹 HURDLERS 플러그인 미설치 가능성. GTM 컨테이너에서 `HURDLERS - [데이터레이어] 장바구니 담기` 태그 존재 확인
- **서버 500/502 반복** → att.ainativeos.net 장애. VM pm2 status + pm2 logs 확인

---

## 7. 다음 단계 (후속)

1. 🟢 biocom dry-run 설치 → 24시간 콘솔 관찰 → 실제 활성화
2. 🟢 coffee 복제 동일 절차
3. 🟡 `Lead` 이벤트 추가 — 상담 신청 / 회원가입 완료 등 (이미 서버 endpoint 에 `Lead` 허용 리스트 있음)
4. 🟡 `Search` 이벤트 추가 — 사이트 검색어 입력 시
5. 🟢 AEM 우선순위 재설정 — Purchase 최상단 유지 + InitiateCheckout → AddToCart → ViewContent 순서로 Events Manager 에서 재정렬
6. 🟡 Google Ads 쪽 동일 패턴 (Enhanced Conversions for Leads + Funnel events) — 별도 프로젝트
