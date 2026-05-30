# Google NPay 버튼 저장값 보강 GTM 패치와 BI Confirmed 운영안 - 2026-05-28

작성 시각: 2026-05-28 01:08 KST
문서 성격: GTM/푸터 붙여넣기 후보 코드 + Google Ads 실제 구매 주 전환 운영 판단
site: biocom

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - docs/report/text-report-template.md
  project_harness_read:
    - harness/npay-recovery/README.md
    - docs/agent-harness/growth-data-harness-v0.md
  required_context_docs:
    - project/google-npay-bridge-hash-hardening-20260528.md
    - project/google-ads-offline-conversion-diagnostics-readonly-20260527.md
    - project/google-ads-npay-value-reduction-and-candidate-rate-plan-20260527.md
  lane: Green for patch document/design; Red for GTM Production publish and Google Ads send rule changes
  allowed_actions:
    - local codebase inspection
    - read-only VM Cloud API check
    - GTM Custom HTML patch draft
    - Imweb footer fallback draft
    - BI confirmed_purchase_offline operating recommendation
  forbidden_actions:
    - GTM Production publish
    - Google Ads conversion upload/send rule expansion
    - VM Cloud write outside existing receiver
    - production DB write/import
    - raw order id or raw click id exposure in report output
  source_window_freshness_confidence:
    source:
      - VM Cloud live API
      - Google Ads API report summary
      - local backend npay_intent receiver code
      - project documents listed above
    window: 2026-05-21 to 2026-05-28 KST
    freshness: live read-only check at 2026-05-28 00:57 KST
    confidence: high for endpoint/action status, medium for GTM runtime capture until Preview smoke
```

## 한 줄 결론

NPay 버튼 클릭 시점의 Google click id는 이미 꽤 잘 남고 있다. 지금 부족한 것은 `NPay 버튼 클릭 row`와 `NPay 외부 결제완료 주문`을 안정적으로 이어 주는 결제창 bridge 증거다.

따라서 우선순위는 다음이다.

1. GTM에서 NPay 버튼 클릭 순간에 `gclid/gbraid/wbraid`와 NPay 외부 결제창 URL을 같이 VM Cloud로 보낸다.
2. VM Cloud는 원문 결제창 URL을 저장하지 않고 hash만 저장한다.
3. `BI confirmed_purchase_offline`은 그대로 실제 구매 전용 Primary 신호로 유지한다.
4. NPay 버튼 클릭/결제진입은 계속 Secondary, 고정 1,000원 보조 신호로 유지한다.

## 왜 GTM 우선인가

GTM이 푸터보다 낫다.

- Preview로 먼저 확인할 수 있다.
- 문제가 있으면 태그 하나만 끄면 된다.
- 아임웹 푸터 전체 교체보다 rollback이 쉽다.
- 기존 NPay intent 태그와 같은 위치에서 관리할 수 있다.

단, GTM에서 `window.open`, `form.submit`, `location` 이동을 충분히 빨리 잡지 못하면 푸터 fallback을 쓴다. 같은 코드를 아임웹 푸터에 붙일 수 있게 작성했다.

중요: GTM에 새 태그를 추가해서 기존 NPay intent 태그와 동시에 운영하면 intent row가 중복될 수 있다. 운영 적용 시에는 `기존 NPay intent 태그를 이 코드로 교체`하거나, 새 태그를 쓴다면 기존 태그를 같은 trigger에서 꺼야 한다.

## 현재 BI Confirmed 구매 신호 판단

`BI confirmed_purchase_offline`은 계속 살린다.

이유:

- 이 신호는 웹사이트 버튼 클릭 태그가 아니다.
- VM Cloud가 실제 결제완료 주문 중 Google click id가 있는 주문만 Google Ads API로 올리는 실제 구매 전용 통로다.
- Google Ads API 리포트에서 이미 3건 / 305,900원이 반영됐다.
- Google Ads 화면의 `데이터 소스 연결` 경고는 현재 API 리포트 반영 실패 증거가 아니다.

현재 운영 방침:

- `BI confirmed_purchase_offline`: Primary 유지. 실제 구매완료 학습용.
- `NPay 버튼 클릭/결제진입(보조)`: Secondary 유지. 버튼 클릭/결제 시작 관찰용. 고정 1,000원.
- 기존 `구매완료`류 웹사이트/NPay 버튼 신호: 실제 구매로 쓰지 않는다.
- Google Ads 자동 전송 후보 확대: bridge hash와 중복/환불 guard 검증 전에는 보수 유지.

## 현재 숫자

Source: VM Cloud live API, Google Ads API
조회 시각: 2026-05-28 00:57 KST
window: 최근 7일 계열, KST
confidence: high for aggregate, medium for NPay bridge row-level until hash patch smoke

- Google Ads 최근 구간 플랫폼 ROAS: 10.19x
- 실제 구매 전용 후보 생성기 기준 실제 결제완료 주문: 525건 / 126,753,108원
- 바로 전송 가능한 직접 gclid 후보: 3건
- NPay bridge A급이지만 click id 복구가 필요한 후보: 13건
- Google Ads 전송 후보: 0건
- NPay 버튼 클릭 intent: 258건
- Google 흔적이 있는 NPay 버튼 클릭: 193건
- Google click id가 보존된 NPay 버튼 클릭: 190건
- 실제 NPay 결제완료 주문: 25건
- A급 bridge: 13건
- A급 bridge + Google click id: 0건
- NPay 결제완료 중 Google 유입 후보: 2건 / 146,600원

해석:

- 버튼 클릭 단계의 Google click id 보존은 나쁘지 않다.
- 실제 결제완료 주문으로 넘어가는 마지막 연결이 약하다.
- 이번 패치는 그 마지막 연결에 필요한 bridge URL hash를 확보하기 위한 것이다.

## GTM 패치 적용 방식

### 태그 위치

- GTM Custom HTML 태그
- 권장 이름: `BI - NPay Bridge Intent Capture v1`
- 권장 trigger: 기존 NPay intent 태그와 동일 trigger 또는 DOM Ready / All Pages
- 적용 전 조건: 기존 NPay intent 태그와 중복 운영하지 않는다.

### Preview 성공 기준

1. Google 광고 클릭 후 상품 페이지에 진입한다.
2. NPay 버튼을 누른다.
3. Network에서 `/api/attribution/npay-intent`가 1회 호출된다.
4. payload에 `gclid` 또는 `gbraid`가 있다.
5. payload에 `npayBridgeUrl` 또는 `npay_bridge_url`이 있다.
6. VM Cloud 응답이 `ok: true`다.
7. Google Ads/Meta 전환 이벤트는 추가로 발화하지 않는다.

## GTM Custom HTML 코드

아래 코드는 Google Ads나 Meta 이벤트를 발화하지 않는다. 오직 VM Cloud NPay intent receiver로 저장용 payload만 보낸다.

```html
<!-- BI NPay Bridge Intent Capture v1
  Purpose:
  - Capture NPay button click with Google click id evidence.
  - Capture NPay/Naver external bridge URL before browser leaves biocom.kr.
  - Send only to VM Cloud /api/attribution/npay-intent.
  - No Google Ads conversion send.
  - No Meta event send.
  Version: 2026-05-28-biocom-npay-bridge-gtm-v1
-->
<script>
(function (w, d) {
  'use strict';

  var VERSION = '2026-05-28-biocom-npay-bridge-gtm-v1';
  var ENDPOINT = 'https://att.ainativeos.net/api/attribution/npay-intent';
  var DEBUG_KEY = '__seo_attribution_debug';
  var SOURCE = 'gtm_npay_bridge_v1';

  if (w.__BIOCOM_NPAY_BRIDGE_GTM_VERSION__ === VERSION) return;
  w.__BIOCOM_NPAY_BRIDGE_GTM_VERSION__ = VERSION;

  var pending = null;
  var sentKeys = {};
  var lastBridgeUrl = '';
  var lastBridgeObservedAt = '';

  function trim(value) {
    return value === null || value === undefined ? '' : String(value).trim();
  }

  function nowIso() {
    try { return new Date().toISOString(); } catch (error) { return ''; }
  }

  function isDebugMode() {
    try { return new URLSearchParams(w.location.search).get(DEBUG_KEY) === '1'; }
    catch (error) { return false; }
  }

  function log() {
    if (!isDebugMode() || !w.console || !console.info) return;
    try {
      var args = Array.prototype.slice.call(arguments);
      args.unshift('[biocom-npay-bridge-gtm]');
      console.info.apply(console, args);
    } catch (error) {}
  }

  function safeParseJson(raw) {
    if (!raw) return {};
    try {
      var parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch (error) {
      return {};
    }
  }

  function readStorageJson(storage, key) {
    try {
      if (!storage) return {};
      return safeParseJson(storage.getItem(key));
    } catch (error) {
      return {};
    }
  }

  function readCookie(name) {
    try {
      var pattern = new RegExp('(?:^|; )' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '=([^;]*)');
      var match = d.cookie.match(pattern);
      return match ? decodeURIComponent(match[1]) : '';
    } catch (error) {
      return '';
    }
  }

  function firstNonEmpty(values) {
    for (var i = 0; i < values.length; i += 1) {
      var value = trim(values[i]);
      if (value) return value;
    }
    return '';
  }

  function getQueryParam(name, sourceUrl) {
    try {
      var url = new URL(sourceUrl || w.location.href, w.location.origin);
      return trim(url.searchParams.get(name));
    } catch (error) {
      return '';
    }
  }

  function parseClientIdFromGaCookie(raw) {
    var value = trim(raw);
    var match = value.match(/^GA\d+\.\d+\.(.+)$/);
    return match ? match[1] : '';
  }

  function parseGaSessionId(raw) {
    var value = trim(raw);
    var match = value.match(/GS\d+\.\d+\.s(\d+)/i);
    return match ? match[1] : '';
  }

  function getMeasurementCookieName() {
    var ids = ['G-WJFXN5E2Q1'];
    for (var i = 0; i < ids.length; i += 1) {
      var suffix = ids[i].replace(/^G-/, '');
      var name = '_ga_' + suffix;
      if (readCookie(name)) return name;
    }
    return '';
  }

  function hasNpayKeyword(text) {
    return /네이버페이|naver\s*pay|naverpay|npay|n_pay|np_btn|npay_btn|orders\.pay\.naver\.com|new-m\.pay\.naver\.com|pay\.naver\.com/i.test(String(text || ''));
  }

  function ownSignalText(element) {
    if (!element) return '';
    var attrs = [
      'id', 'class', 'href', 'src', 'alt', 'title', 'aria-label', 'name', 'value',
      'role', 'type', 'onclick', 'data-type', 'data-name', 'data-code', 'data-pay',
      'data-payment', 'data-provider', 'data-module', 'data-button-type'
    ];
    var pieces = [];
    for (var i = 0; i < attrs.length; i += 1) {
      var name = attrs[i];
      var value = '';
      try {
        value = name === 'class'
          ? (typeof element.className === 'string' ? element.className : '')
          : (element.getAttribute ? element.getAttribute(name) : '');
      } catch (error) {
        value = '';
      }
      if (value) pieces.push(value);
    }
    try {
      pieces.push(element.innerText || element.textContent || '');
    } catch (error) {}
    return pieces.join(' ');
  }

  function findActionable(element) {
    var cursor = element;
    var depth = 0;
    while (cursor && depth < 8) {
      var tag = String(cursor.tagName || '').toLowerCase();
      var role = trim(cursor.getAttribute && cursor.getAttribute('role'));
      var hasOnclick = Boolean(cursor.getAttribute && cursor.getAttribute('onclick'));
      if (
        tag === 'a' || tag === 'button' || tag === 'input' || tag === 'iframe' ||
        tag === 'area' || tag === 'form' || role === 'button' || role === 'link' || hasOnclick
      ) {
        return cursor;
      }
      cursor = cursor.parentElement;
      depth += 1;
    }
    return null;
  }

  function isNpayClickElement(element) {
    var action = findActionable(element);
    var signal = [
      ownSignalText(action),
      ownSignalText(element)
    ].join(' ');
    return hasNpayKeyword(signal);
  }

  function selectorFor(element) {
    try {
      if (!element) return '';
      var tag = String(element.tagName || '').toLowerCase();
      if (!tag) return '';
      if (element.id) return tag + '#' + element.id;
      var cls = typeof element.className === 'string' ? element.className.trim().replace(/\s+/g, '.') : '';
      if (cls) return tag + '.' + cls.slice(0, 120);
      var name = element.getAttribute && element.getAttribute('name');
      if (name) return tag + '[name="' + String(name).replace(/"/g, '') + '"]';
      return tag;
    } catch (error) {
      return '';
    }
  }

  function normalizeNpayUrl(value) {
    var text = trim(value);
    if (!text) return '';
    try {
      var decoded = text;
      try { decoded = decodeURIComponent(text); } catch (error) {}
      var url = new URL(text, w.location.href);
      var host = url.hostname.toLowerCase();
      if (
        host === 'orders.pay.naver.com' ||
        host === 'new-m.pay.naver.com' ||
        host === 'm.pay.naver.com' ||
        host === 'pay.naver.com' ||
        host === 'nid.naver.com'
      ) {
        return url.toString();
      }
      if (/orders\.pay\.naver\.com|new-m\.pay\.naver\.com|pay\.naver\.com|nid\.naver\.com/i.test(decoded)) {
        return text;
      }
    } catch (error) {
      if (/orders\.pay\.naver\.com|new-m\.pay\.naver\.com|pay\.naver\.com|nid\.naver\.com/i.test(text)) {
        return text;
      }
    }
    return '';
  }

  function extractBridgeUrlFromText(text) {
    var raw = trim(text);
    if (!raw) return '';
    var direct = normalizeNpayUrl(raw);
    if (direct) return direct;

    var match = raw.match(/https?:\/\/[^"'\s<>]+(?:naver\.com|pay\.naver\.com)[^"'\s<>]*/i);
    if (match && match[0]) {
      var fromMatch = normalizeNpayUrl(match[0]);
      if (fromMatch) return fromMatch;
    }

    try {
      var decoded = decodeURIComponent(raw);
      var decodedMatch = decoded.match(/https?:\/\/[^"'\s<>]+(?:naver\.com|pay\.naver\.com)[^"'\s<>]*/i);
      if (decodedMatch && decodedMatch[0]) return normalizeNpayUrl(decodedMatch[0]);
    } catch (error) {}

    return '';
  }

  function rememberBridgeUrl(value, source) {
    var url = extractBridgeUrlFromText(value);
    if (!url) return '';

    lastBridgeUrl = url;
    lastBridgeObservedAt = nowIso();

    if (pending && !pending.npayBridgeUrl) {
      pending.npayBridgeUrl = url;
      pending.npayBridgeObservedAt = lastBridgeObservedAt;
      pending.bridgeSource = source || '';
      scheduleFlush(0, 'bridge_url_captured');
    }

    log('bridge url captured', {
      source: source || '',
      hasBridgeUrl: true
    });

    return url;
  }

  function getElementBridgeUrl(element) {
    var action = findActionable(element);
    var candidates = [];
    if (action) {
      candidates.push(action.getAttribute && action.getAttribute('href'));
      candidates.push(action.getAttribute && action.getAttribute('src'));
      candidates.push(action.getAttribute && action.getAttribute('onclick'));
      if (action.form) candidates.push(action.form.getAttribute && action.form.getAttribute('action'));
    }
    if (element) {
      candidates.push(element.getAttribute && element.getAttribute('href'));
      candidates.push(element.getAttribute && element.getAttribute('src'));
      candidates.push(element.getAttribute && element.getAttribute('onclick'));
    }
    for (var i = 0; i < candidates.length; i += 1) {
      var url = rememberBridgeUrl(candidates[i], 'element_attribute');
      if (url) return url;
    }
    return '';
  }

  function parseKrw(value) {
    var normalized = trim(value).replace(/[^\d.-]/g, '');
    if (!normalized) return 0;
    var parsed = Number(normalized);
    return isFinite(parsed) ? parsed : 0;
  }

  function findLargestKrw(text) {
    var matches = String(text || '').match(/[\d,]+\s*원/g) || [];
    var max = 0;
    for (var i = 0; i < matches.length; i += 1) max = Math.max(max, parseKrw(matches[i]));
    return max;
  }

  function getProductPrice() {
    var selectors = ['.real_price', '.sale_price', '.prod_price', '.price', '[data-product-price]'];
    for (var i = 0; i < selectors.length; i += 1) {
      try {
        var el = d.querySelector(selectors[i]);
        var raw = el && (el.getAttribute('data-product-price') || el.innerText || el.textContent);
        var value = parseKrw(raw);
        if (value) return value;
      } catch (error) {}
    }
    try { return findLargestKrw(d.body && d.body.innerText); } catch (error) { return 0; }
  }

  function getProductName() {
    var selectors = ['h1', '.prod_title', '.product-title', '.goods-name', '.item_detail_tit', '[data-product-name]'];
    for (var i = 0; i < selectors.length; i += 1) {
      try {
        var el = d.querySelector(selectors[i]);
        var text = trim(el && (el.getAttribute('data-product-name') || el.innerText || el.textContent));
        if (text) return text.slice(0, 180);
      } catch (error) {}
    }
    try { return trim(d.title).slice(0, 180); } catch (error) { return ''; }
  }

  function buildTracking() {
    var clickContext = readStorageJson(w.localStorage, '__biocom_click_id_context_v1');
    var lastTouch = readStorageJson(w.localStorage, '_p1s1a_last_touch');
    var checkoutContext = readStorageJson(w.sessionStorage, '__seo_checkout_context');
    var gaCookie = readCookie('_ga');
    var gaMeasurementCookieName = getMeasurementCookieName();
    var gaMeasurementCookie = gaMeasurementCookieName ? readCookie(gaMeasurementCookieName) : '';

    return {
      gclid: firstNonEmpty([getQueryParam('gclid'), clickContext.gclid, checkoutContext.gclid, lastTouch.gclid]),
      gbraid: firstNonEmpty([getQueryParam('gbraid'), clickContext.gbraid, checkoutContext.gbraid, lastTouch.gbraid]),
      wbraid: firstNonEmpty([getQueryParam('wbraid'), clickContext.wbraid, checkoutContext.wbraid, lastTouch.wbraid]),
      fbclid: firstNonEmpty([getQueryParam('fbclid'), clickContext.fbclid, checkoutContext.fbclid, lastTouch.fbclid]),
      fbp: firstNonEmpty([readCookie('_fbp'), lastTouch.fbp]),
      fbc: firstNonEmpty([readCookie('_fbc'), lastTouch.fbc]),
      utm_source: firstNonEmpty([getQueryParam('utm_source'), clickContext.utm_source, checkoutContext.utm_source, lastTouch.utm_source]),
      utm_medium: firstNonEmpty([getQueryParam('utm_medium'), clickContext.utm_medium, checkoutContext.utm_medium, lastTouch.utm_medium]),
      utm_campaign: firstNonEmpty([getQueryParam('utm_campaign'), clickContext.utm_campaign, checkoutContext.utm_campaign, lastTouch.utm_campaign]),
      utm_content: firstNonEmpty([getQueryParam('utm_content'), clickContext.utm_content, checkoutContext.utm_content, lastTouch.utm_content]),
      utm_term: firstNonEmpty([getQueryParam('utm_term'), clickContext.utm_term, checkoutContext.utm_term, lastTouch.utm_term]),
      client_id: firstNonEmpty([checkoutContext.clientId, lastTouch.client_id, parseClientIdFromGaCookie(gaCookie)]),
      ga_cookie_raw: gaCookie,
      ga_session_id: firstNonEmpty([checkoutContext.gaSessionId, lastTouch.ga_session_id, parseGaSessionId(gaMeasurementCookie)]),
      ga_session_number: ''
    };
  }

  function buildPayload(event, bridgeUrl) {
    var tracking = buildTracking();
    var eventId = 'npay_bridge_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    return {
      site: 'biocom',
      source: SOURCE,
      environment: isDebugMode() ? 'debug' : 'production',
      snippet_version: VERSION,
      captured_at: nowIso(),
      event_id: eventId,
      gtm_event_id: eventId,
      client_id: tracking.client_id,
      ga_cookie_raw: tracking.ga_cookie_raw,
      ga_session_id: tracking.ga_session_id,
      ga_session_number: tracking.ga_session_number,
      gclid: tracking.gclid,
      gbraid: tracking.gbraid,
      wbraid: tracking.wbraid,
      fbclid: tracking.fbclid,
      fbp: tracking.fbp,
      fbc: tracking.fbc,
      utm_source: tracking.utm_source,
      utm_medium: tracking.utm_medium,
      utm_campaign: tracking.utm_campaign,
      utm_content: tracking.utm_content,
      utm_term: tracking.utm_term,
      page_location: w.location.href,
      page_referrer: d.referrer || '',
      product_idx: getQueryParam('idx'),
      product_name: getProductName(),
      product_price: getProductPrice(),
      button_selector: selectorFor(event && event.target ? findActionable(event.target) || event.target : null),
      npayBridgeUrl: bridgeUrl || lastBridgeUrl || '',
      npayBridgeObservedAt: bridgeUrl || lastBridgeUrl ? (lastBridgeObservedAt || nowIso()) : '',
      debug_mode: isDebugMode()
    };
  }

  function compactSendLog(payload) {
    return {
      hasGoogleClickId: Boolean(payload.gclid || payload.gbraid || payload.wbraid),
      hasGclid: Boolean(payload.gclid),
      hasGbraid: Boolean(payload.gbraid),
      hasWbraid: Boolean(payload.wbraid),
      hasBridgeUrl: Boolean(payload.npayBridgeUrl),
      productIdx: payload.product_idx,
      productPrice: payload.product_price
    };
  }

  function sendPayload(payload) {
    var key = [
      payload.source,
      payload.page_location,
      payload.product_idx,
      payload.captured_at,
      payload.npayBridgeUrl ? 'bridge' : 'no_bridge'
    ].join('|');

    if (sentKeys[key]) return;
    sentKeys[key] = true;

    var json = JSON.stringify(payload);
    var beaconSent = false;
    try {
      if (w.navigator && typeof w.navigator.sendBeacon === 'function' && typeof w.Blob === 'function') {
        beaconSent = w.navigator.sendBeacon(ENDPOINT, new w.Blob([json], { type: 'application/json' }));
      }
    } catch (error) {
      beaconSent = false;
    }

    if (!beaconSent && typeof w.fetch === 'function') {
      try {
        w.fetch(ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: json,
          mode: 'cors',
          credentials: 'omit',
          cache: 'no-store',
          keepalive: true
        }).catch(function () {});
      } catch (error) {}
    }

    try {
      w.dataLayer = w.dataLayer || [];
      w.dataLayer.push({
        event: 'biocom_npay_bridge_intent_captured',
        biocom_npay_bridge_version: VERSION,
        has_google_click_id: Boolean(payload.gclid || payload.gbraid || payload.wbraid),
        has_npay_bridge_url: Boolean(payload.npayBridgeUrl)
      });
    } catch (error) {}

    log('sent payload presence', compactSendLog(payload));
  }

  function flush(reason) {
    if (!pending || pending.sent) return;
    pending.sent = true;
    pending.payload.npayBridgeUrl = pending.npayBridgeUrl || lastBridgeUrl || pending.payload.npayBridgeUrl || '';
    pending.payload.npayBridgeObservedAt = pending.npayBridgeObservedAt || lastBridgeObservedAt || pending.payload.npayBridgeObservedAt || '';
    pending.payload.flush_reason = reason || '';
    sendPayload(pending.payload);
  }

  function scheduleFlush(delayMs, reason) {
    w.setTimeout(function () {
      flush(reason);
    }, Math.max(0, Number(delayMs) || 0));
  }

  function onClick(event) {
    if (!isNpayClickElement(event.target)) return;

    var bridgeUrl = getElementBridgeUrl(event.target);
    pending = {
      sent: false,
      npayBridgeUrl: bridgeUrl,
      npayBridgeObservedAt: bridgeUrl ? nowIso() : '',
      payload: buildPayload(event, bridgeUrl)
    };

    log('npay click observed', compactSendLog(pending.payload));

    scheduleFlush(160, 'short_wait');
    scheduleFlush(650, 'fallback_wait');
  }

  function patchWindowOpen() {
    try {
      var rawOpen = w.open;
      if (typeof rawOpen !== 'function' || rawOpen.__BIOCOM_NPAY_BRIDGE_WRAPPED__) return;
      var wrapped = function (url) {
        rememberBridgeUrl(url, 'window.open');
        return rawOpen.apply(this, arguments);
      };
      wrapped.__BIOCOM_NPAY_BRIDGE_WRAPPED__ = true;
      w.open = wrapped;
    } catch (error) {}
  }

  function patchLocationMethods() {
    try {
      var rawAssign = w.location && w.location.assign;
      if (typeof rawAssign === 'function') {
        w.location.assign = function (url) {
          rememberBridgeUrl(url, 'location.assign');
          return rawAssign.apply(w.location, arguments);
        };
      }
    } catch (error) {}

    try {
      var rawReplace = w.location && w.location.replace;
      if (typeof rawReplace === 'function') {
        w.location.replace = function (url) {
          rememberBridgeUrl(url, 'location.replace');
          return rawReplace.apply(w.location, arguments);
        };
      }
    } catch (error) {}
  }

  function patchForms() {
    try {
      var proto = w.HTMLFormElement && w.HTMLFormElement.prototype;
      if (!proto) return;

      if (typeof proto.submit === 'function' && !proto.submit.__BIOCOM_NPAY_BRIDGE_WRAPPED__) {
        var rawSubmit = proto.submit;
        var submitWrapped = function () {
          rememberBridgeUrl(this && this.action, 'form.submit');
          return rawSubmit.apply(this, arguments);
        };
        submitWrapped.__BIOCOM_NPAY_BRIDGE_WRAPPED__ = true;
        proto.submit = submitWrapped;
      }

      if (typeof proto.requestSubmit === 'function' && !proto.requestSubmit.__BIOCOM_NPAY_BRIDGE_WRAPPED__) {
        var rawRequestSubmit = proto.requestSubmit;
        var requestSubmitWrapped = function () {
          rememberBridgeUrl(this && this.action, 'form.requestSubmit');
          return rawRequestSubmit.apply(this, arguments);
        };
        requestSubmitWrapped.__BIOCOM_NPAY_BRIDGE_WRAPPED__ = true;
        proto.requestSubmit = requestSubmitWrapped;
      }
    } catch (error) {}
  }

  d.addEventListener('click', onClick, true);
  w.addEventListener('pagehide', function () { flush('pagehide'); }, true);
  d.addEventListener('visibilitychange', function () {
    if (d.visibilityState === 'hidden') flush('visibility_hidden');
  }, true);

  patchWindowOpen();
  patchLocationMethods();
  patchForms();

  log('installed', { version: VERSION });
})(window, document);
</script>
```

## 푸터 fallback

GTM Preview에서 아래 중 하나가 실패하면 같은 코드를 아임웹 푸터 하단에 넣는 fallback을 쓴다.

- NPay 버튼 클릭은 잡히지만 `npayBridgeUrl`이 비어 있다.
- GTM 태그 실행 시점이 너무 늦어서 `window.open` 또는 form submit을 못 감싼다.
- Preview에서는 되지만 Production publish 전 workspace 충돌/권한 이슈가 있다.

푸터 fallback도 운영 사이트 전체에 영향을 주므로 실제 반영은 승인 대상이다. 단 코드 자체는 위 GTM 코드와 동일하다.

## 적용 전 필요한 작은 백엔드 보강

현재 receiver는 bridge URL hash를 받을 준비가 되어 있다. 하지만 같은 `intentKey`로 먼저 저장된 row가 있고, 나중에 bridge URL이 들어온 요청이 중복으로 판정되면 기존 row의 bridge hash를 보강하지 않는다.

그래서 가장 안전한 순서는 다음이다.

1. GTM 패치를 기존 NPay intent 태그와 교체해 첫 전송부터 bridge URL을 포함한다.
2. 별도 보강으로 receiver의 `markDuplicateIntent`가 새 요청에 bridge hash가 있으면 기존 row의 빈 bridge hash를 채우게 만든다.

2번은 로컬 코드에 패치했다. 아직 VM Cloud 배포는 하지 않았다. 이 문서의 GTM 코드만으로도 효과는 있지만, 중복/순서 문제까지 닫으려면 backend enrich patch를 VM Cloud에 같이 배포하는 것이 좋다.

## 적용 후 테스트 절차

1. GTM Preview에서 이 태그만 켠다.
2. Google 광고 클릭으로 상품 페이지에 진입한다.
3. NPay 버튼만 누르고 로그인/결제는 하지 않는다.
4. Network에서 `/api/attribution/npay-intent` request payload를 확인한다.
5. 확인할 값:
   - `gclid` 또는 `gbraid` 존재
   - `npayBridgeUrl` 존재
   - `product_idx` 존재
   - `product_price` 존재
   - Google Ads conversion request 추가 발화 없음
6. VM Cloud live API에서 `liveIntentWithNpayBridgeUrlHash`가 1 이상 증가하는지 본다.

## 성공 기준

1차 성공:

- NPay 버튼 클릭 1건에서 bridge URL hash가 VM Cloud에 저장된다.
- 같은 row에 Google click id가 있다.
- Google Ads 전환은 추가 발화하지 않는다.

2차 성공:

- 실제 NPay 결제완료 주문과 NPay 버튼 row가 A급 bridge로 붙는다.
- A급 bridge row에 Google click id와 bridge hash가 같이 있다.
- Google Ads 전송 후보가 0에서 1 이상으로 늘어난다.

최종 성공:

- `BI confirmed_purchase_offline`으로 실제 결제완료 주문만 자동 전송된다.
- NPay 버튼 클릭/결제진입은 계속 보조 신호로 남는다.
- Google Ads 플랫폼 ROAS와 내부 confirmed ROAS의 차이가 줄어든다.

## 하지 말아야 할 것

- 이 GTM 태그와 기존 NPay intent 태그를 동시에 Production publish하지 않는다.
- `NPay 버튼 클릭/결제진입(보조)`를 Primary로 올리지 않는다.
- bridge만 A급이라고 Google Ads 전송 후보로 바로 승격하지 않는다.
- Google click id 없는 NPay 결제완료 주문을 Google Ads에 보내지 않는다.
- `데이터 소스 연결` 버튼을 지금 누르지 않는다. 현재 BI Confirmed는 API 리포트에 이미 반영된다.

## 다음 판단

추천 순서:

1. backend duplicate enrich patch를 먼저 넣는다.
2. VM Cloud backend 배포 후 GTM Preview smoke를 한다.
3. bridge URL hash 저장률이 올라가는지 24시간 본다.
4. A급 bridge + Google click id 후보가 생기면 Google Ads 전송 조건을 다시 평가한다.
5. 자동 전송 규칙 확장은 별도 Red 승인 후 진행한다.
