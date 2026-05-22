# Imweb Header Code Top Full v3.1.3 VirtualAccountIssued

작성 시각: 2026-05-21 20:25 KST
기준일: 2026-05-21
문서 성격: 아임웹 헤더 코드 상단 전체 붙여넣기본 / 운영 저장 전 검토본

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
  project_context_docs:
    - docurule.md
    - gdn/imweb-v443-full-paste-code-20260521.md
    - project/header-guard-v313-virtual-account-issued-code-20260521.md
  lane: Green for document generation; Red for saving this into Imweb production custom code
  allowed_actions:
    - read local current paste-code docs
    - generate full header-top paste document
    - run local syntax and document validation
  forbidden_actions:
    - no Imweb save
    - no GTM publish
    - no Meta or Google Ads platform send
    - no VM Cloud deploy or backend restart
    - no production DB write
  source_window_freshness_confidence:
    source: local repository docs generated from current Imweb header/footer paste set
    window: 2026-05-21 current implementation state
    freshness: generated 2026-05-21 20:25 KST
    confidence: 0.94
```

## 10초 요약

이 문서는 아임웹의 `헤더 코드 상단` 입력칸을 통째로 교체하기 위한 전체 코드다. 기존 Google click-id 보존 bootstrap은 유지하고, 가상계좌 주문생성/미입금 완료 화면에서 Meta Pixel custom event `VirtualAccountIssued`가 바로 보이도록 결제 판단 guard만 v3.1.3으로 바꿨다.

중요한 기준은 하나다. 이 코드는 가상계좌 발급을 구매로 세지 않는다. 미입금 주문은 `Purchase`가 아니라 `VirtualAccountIssued`로만 보내며, 실제 결제완료 매출 판단은 기존 서버 결제 원장 기준을 유지한다.

## 붙여넣기 위치

아임웹 관리자에서 아래 위치의 기존 내용을 전체 선택 후 이 문서의 `헤더 코드 상단 전체` 코드로 교체한다.

- 위치: 아임웹 관리자 → 환경설정/SEO/헤더·바디·푸터 코드 관리 → `헤더 코드 상단`
- 바꾸는 범위: `헤더 코드 상단` 입력칸 전체
- 건드리지 않는 범위: 일반 `헤더 코드`, `바디 코드`, `푸터 코드`

## 포함된 것

- `BI / Google Click ID Bootstrap v1`: Google click id, Meta/TikTok click id, UTM을 최대한 일찍 저장하는 코드다.
- `server-payment-decision-guard-v3-1-3`: 결제완료 계열 화면에서 서버 결제 판단을 조회하고, 가상계좌 미입금 주문은 `VirtualAccountIssued`로 낮춰 보내는 코드다.
- 즉시 발화 보강: 브라우저가 `Purchase`를 아예 시도하지 않는 가상계좌 완료 화면에서도 completion URL과 저장 context 힌트로 `VirtualAccountIssued`를 1회 보낸다.

## 포함하지 않은 것

- 푸터 코드 전체는 이 문서에 포함하지 않았다. 푸터는 현재 v4.4.3 교체본을 그대로 유지한다.
- Meta `Purchase` 직접 발화 코드를 추가하지 않았다.
- Google Ads 전환 업로드나 GTM 운영 publish는 포함하지 않았다.

## 적용 전 확인

1. 현재 아임웹 `헤더 코드 상단` 내용을 별도 백업한다.
2. 아래 전체 코드를 `헤더 코드 상단`에만 붙여넣는다.
3. 저장 후 가상계좌 미입금 테스트 주문 1건으로 Meta Pixel Helper 또는 Network 탭을 확인한다.
4. 성공 기준은 `VirtualAccountIssued=1`, `Purchase=0`이다.
5. 같은 완료 URL 새로고침 시 `VirtualAccountIssued`가 중복 증가하지 않아야 한다.

## 헤더 코드 상단 전체

```html
<!-- BI / Google Click ID Bootstrap v1
  Purpose:
  - Preserve gclid / gbraid / wbraid / fbclid / ttclid as early as possible.
  - No ad conversion firing.
  - No network send.
  - Safe to place at the very top of Imweb Header code.
  Version: 2026-05-21-biocom-click-id-bootstrap-v1-1
-->
<script>
(function () {
  'use strict';

  var VERSION = '2026-05-21-biocom-click-id-bootstrap-v1-1';
  var GOOGLE_CLICK_ID_GUARD_VERSION = 'v4.4.3';

  var CONFIG = {
    debugQueryKey: '__seo_attribution_debug',

    /* Dedicated BI click-id context */
    clickContextKey: '__biocom_click_id_context_v1',
    clickCookieKey: '__biocom_click_ids',

    /* Existing attribution keys already used by current footer snippets */
    firstTouchKey: '_p1s1a_first_touch',
    latestTouchKey: '_p1s1a_last_touch',
    sessionTouchKey: '_p1s1a_session_touch',

    ttlDays: 30,
    logPrefix: '[biocom-click-id-bootstrap]'
  };

  if (window.__BIOCOM_CLICK_ID_BOOTSTRAP_VERSION__ === VERSION) return;
  window.__BIOCOM_CLICK_ID_BOOTSTRAP_VERSION__ = VERSION;

  function trim(value) {
    if (value === null || value === undefined) return '';
    return String(value).trim();
  }

  function nowIso() {
    try {
      return new Date().toISOString();
    } catch (error) {
      return '';
    }
  }

  function isDebugMode() {
    try {
      return new URLSearchParams(window.location.search).get(CONFIG.debugQueryKey) === '1';
    } catch (error) {
      return false;
    }
  }

  function debugLog() {
    if (!isDebugMode()) return;
    try {
      var args = Array.prototype.slice.call(arguments);
      args.unshift(CONFIG.logPrefix);
      console.info.apply(console, args);
    } catch (error) {}
  }

  function firstNonEmpty(values) {
    for (var i = 0; i < values.length; i += 1) {
      var value = trim(values[i]);
      if (value) return value;
    }
    return '';
  }

  function googleClickSetFrom(source, sourceName) {
    source = source && typeof source === 'object' ? source : {};
    return {
      source: sourceName,
      gclid: trim(source.gclid),
      gbraid: trim(source.gbraid),
      wbraid: trim(source.wbraid)
    };
  }

  function hasGoogleClickSet(set) {
    return Boolean(set && (trim(set.gclid) || trim(set.gbraid) || trim(set.wbraid)));
  }

  function selectGoogleClickSet(candidates) {
    for (var i = 0; i < candidates.length; i += 1) {
      if (hasGoogleClickSet(candidates[i])) return candidates[i];
    }
    return googleClickSetFrom({}, 'none');
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

  function readLocalJson(key) {
    try {
      if (!window.localStorage) return {};
      return safeParseJson(window.localStorage.getItem(key));
    } catch (error) {
      return {};
    }
  }

  function writeLocalJson(key, value) {
    try {
      if (!window.localStorage) return false;
      window.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      return false;
    }
  }

  function writeCookieJson(name, value, maxAgeSeconds) {
    try {
      var encoded = encodeURIComponent(JSON.stringify(value));
      var cookie =
        name + '=' + encoded +
        '; path=/' +
        '; max-age=' + maxAgeSeconds +
        '; SameSite=Lax';
      if (window.location && window.location.protocol === 'https:') {
        cookie += '; Secure';
      }
      document.cookie = cookie;
      return true;
    } catch (error) {
      return false;
    }
  }

  function getSearchParam(name) {
    try {
      var params = new URLSearchParams(window.location.search);
      return trim(params.get(name));
    } catch (error) {
      return '';
    }
  }

  function hasAnyTrackingSignal(obj) {
    return Boolean(
      trim(obj.gclid) ||
      trim(obj.gbraid) ||
      trim(obj.wbraid) ||
      trim(obj.fbclid) ||
      trim(obj.ttclid) ||
      trim(obj.utm_source) ||
      trim(obj.utm_medium) ||
      trim(obj.utm_campaign) ||
      trim(obj.utm_content) ||
      trim(obj.utm_term)
    );
  }

  function mergeTouch(previous, incoming, options) {
    previous = previous && typeof previous === 'object' ? previous : {};
    incoming = incoming && typeof incoming === 'object' ? incoming : {};
    options = options || {};

    var preferIncomingForUtm = options.preferIncomingForUtm !== false;
    var preferIncomingForClickId = options.preferIncomingForClickId !== false;
    var selectedGoogleClickSet = selectGoogleClickSet(
      preferIncomingForClickId
        ? [
            googleClickSetFrom(incoming, 'incoming'),
            googleClickSetFrom(previous, 'previous')
          ]
        : [
            googleClickSetFrom(previous, 'previous'),
            googleClickSetFrom(incoming, 'incoming')
          ]
    );

    var merged = {
      utm_source: preferIncomingForUtm
        ? firstNonEmpty([incoming.utm_source, previous.utm_source])
        : firstNonEmpty([previous.utm_source, incoming.utm_source]),

      utm_medium: preferIncomingForUtm
        ? firstNonEmpty([incoming.utm_medium, previous.utm_medium])
        : firstNonEmpty([previous.utm_medium, incoming.utm_medium]),

      utm_campaign: preferIncomingForUtm
        ? firstNonEmpty([incoming.utm_campaign, previous.utm_campaign])
        : firstNonEmpty([previous.utm_campaign, incoming.utm_campaign]),

      utm_content: preferIncomingForUtm
        ? firstNonEmpty([incoming.utm_content, previous.utm_content])
        : firstNonEmpty([previous.utm_content, incoming.utm_content]),

      utm_term: preferIncomingForUtm
        ? firstNonEmpty([incoming.utm_term, previous.utm_term])
        : firstNonEmpty([previous.utm_term, incoming.utm_term]),

      /*
        v4.4.3:
        Google click IDs must be selected as one coherent set.
        Do not mix fresh gclid/gbraid with stale wbraid from an older storage source.
      */
      gclid: selectedGoogleClickSet.gclid,
      gbraid: selectedGoogleClickSet.gbraid,
      wbraid: selectedGoogleClickSet.wbraid,
      google_click_id_source: selectedGoogleClickSet.source,
      google_click_id_guard_version: GOOGLE_CLICK_ID_GUARD_VERSION,

      fbclid: preferIncomingForClickId
        ? firstNonEmpty([incoming.fbclid, previous.fbclid])
        : firstNonEmpty([previous.fbclid, incoming.fbclid]),

      ttclid: preferIncomingForClickId
        ? firstNonEmpty([incoming.ttclid, previous.ttclid])
        : firstNonEmpty([previous.ttclid, incoming.ttclid]),

      landing: firstNonEmpty([incoming.landing, previous.landing, window.location.href]),
      referrer: firstNonEmpty([incoming.referrer, previous.referrer, document.referrer || '']),

      first_captured_at: firstNonEmpty([previous.first_captured_at, incoming.captured_at]),
      last_captured_at: firstNonEmpty([incoming.captured_at, previous.last_captured_at]),
      expires_at_ms: incoming.expires_at_ms || previous.expires_at_ms || '',
      snippet_version: VERSION
    };

    return merged;
  }

  function getCurrentTouch() {
    var ttlMs = CONFIG.ttlDays * 24 * 60 * 60 * 1000;
    var capturedAt = nowIso();

    return {
      utm_source: getSearchParam('utm_source'),
      utm_medium: getSearchParam('utm_medium'),
      utm_campaign: getSearchParam('utm_campaign'),
      utm_content: getSearchParam('utm_content'),
      utm_term: getSearchParam('utm_term'),

      gclid: getSearchParam('gclid'),
      gbraid: getSearchParam('gbraid'),
      wbraid: getSearchParam('wbraid'),
      fbclid: getSearchParam('fbclid'),
      ttclid: getSearchParam('ttclid'),

      landing: window.location.href,
      referrer: document.referrer || '',
      captured_at: capturedAt,
      expires_at_ms: Date.now() + ttlMs,
      snippet_version: VERSION
    };
  }

  function pushDataLayerPresence(context) {
    try {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({
        event: 'biocom_click_id_captured',
        biocom_click_id_bootstrap_version: VERSION,

        /*
          Do not push raw click-id values into dataLayer here.
          Presence only. Raw values stay in storage for the attribution snippets.
        */
        has_google_click_id: Boolean(context.gclid || context.gbraid || context.wbraid),
        has_gclid: Boolean(context.gclid),
        has_gbraid: Boolean(context.gbraid),
        has_wbraid: Boolean(context.wbraid),
        has_fbclid: Boolean(context.fbclid),
        has_ttclid: Boolean(context.ttclid),

        google_click_id_type: context.gclid
          ? 'gclid'
          : (context.gbraid ? 'gbraid' : (context.wbraid ? 'wbraid' : 'none'))
      });
    } catch (error) {}
  }

  var incoming = getCurrentTouch();

  /*
    If this page has no tracking signal, do nothing.
    Existing stored click IDs remain intact.
  */
  if (!hasAnyTrackingSignal(incoming)) {
    debugLog('no tracking signal on current URL; existing storage untouched');
    return;
  }

  var previousClickContext = readLocalJson(CONFIG.clickContextKey);
  var nextClickContext = mergeTouch(previousClickContext, incoming, {
    preferIncomingForUtm: true,
    preferIncomingForClickId: true
  });

  writeLocalJson(CONFIG.clickContextKey, nextClickContext);
  writeCookieJson(CONFIG.clickCookieKey, nextClickContext, CONFIG.ttlDays * 24 * 60 * 60);

  /*
    Keep existing footer snippets compatible.
    They already read _p1s1a_last_touch.gclid, so writing here can improve gclid retention
    even before the footer patch is deployed.
  */
  var previousFirstTouch = readLocalJson(CONFIG.firstTouchKey);
  var previousLatestTouch = readLocalJson(CONFIG.latestTouchKey);
  var previousSessionTouch = readLocalJson(CONFIG.sessionTouchKey);

  if (!hasAnyTrackingSignal(previousFirstTouch)) {
    writeLocalJson(CONFIG.firstTouchKey, mergeTouch({}, incoming, {
      preferIncomingForUtm: true,
      preferIncomingForClickId: true
    }));
  } else {
    /*
      First touch should not be overwritten, but if it lacks Google click IDs and the current URL has them,
      fill only missing click IDs without changing the original UTM identity.
    */
    writeLocalJson(CONFIG.firstTouchKey, mergeTouch(previousFirstTouch, incoming, {
      preferIncomingForUtm: false,
      preferIncomingForClickId: true
    }));
  }

  writeLocalJson(CONFIG.latestTouchKey, mergeTouch(previousLatestTouch, incoming, {
    preferIncomingForUtm: true,
    preferIncomingForClickId: true
  }));

  writeLocalJson(CONFIG.sessionTouchKey, mergeTouch(previousSessionTouch, incoming, {
    preferIncomingForUtm: true,
    preferIncomingForClickId: true
  }));

  pushDataLayerPresence(nextClickContext);

  debugLog('captured tracking presence', {
    has_google_click_id: Boolean(nextClickContext.gclid || nextClickContext.gbraid || nextClickContext.wbraid),
    has_gclid: Boolean(nextClickContext.gclid),
    has_gbraid: Boolean(nextClickContext.gbraid),
    has_wbraid: Boolean(nextClickContext.wbraid),
    has_fbclid: Boolean(nextClickContext.fbclid),
    has_ttclid: Boolean(nextClickContext.ttclid)
  });
})();
</script>
<!-- End BI / Google Click ID Bootstrap v1 -->


<script>
(function () {
  'use strict';

  var CONFIG = {
    snippetVersion: '2026-05-21-server-payment-decision-guard-v3-1-3',
    pixelId: '1283400029487161',
    decisionEndpoint: 'https://att.ainativeos.net/api/attribution/payment-decision',
    site: 'biocom',
    store: 'biocom',
    vbankEventName: 'VirtualAccountIssued',
    unknownEventName: 'PurchaseDecisionUnknown',
    blockedEventName: 'PurchaseBlocked',
    requestTimeoutMs: 8000,
    holdMs: 50,
    decisionRetryDelayMs: 500,
    purchaseFallbackDelayMs: 1800,
    decisionCacheTtlMs: 2 * 60 * 1000,
    blockDecisionCacheTtlMs: 30 * 1000,
    unknownDecisionCacheTtlMs: 10 * 1000,
    decisionCachePrefix: '__biocom_payment_decision_guard_v313__:',
    wrapPollMs: [0, 50, 100, 200, 500, 1000, 2000, 3500, 5000, 8000],
    customEventRetryMs: [0, 150, 400, 800, 1500, 2500],
    immediateFirePollMs: [80, 300, 800, 1500, 2500, 4000],
    vbankSentPrefix: '__biocom_virtual_account_issued_sent__:',
    paymentPageBehaviorKey: '__seo_payment_page_behavior_v1',
    checkoutContextKey: '__seo_checkout_context',
    paymentSuccessContextKey: '__seo_payment_success_context',
    logPrefix: '[biocom-server-payment-decision-guard-v3.1.3]'
  };

  function safeString(value) {
    if (value === null || value === undefined) return '';
    return String(value);
  }

  function compact(value) {
    return safeString(value).replace(/\s+/g, ' ').replace(/[|]/g, '/');
  }

  function firstNonEmpty(values) {
    for (var i = 0; i < values.length; i += 1) {
      var value = safeString(values[i]).trim();
      if (value) return value;
    }
    return '';
  }

  function isPaymentCompletePage() {
    var href = safeString(window.location.href).toLowerCase();
    var path = safeString(window.location.pathname).toLowerCase();
    return (
      path.indexOf('shop_payment_complete') >= 0 ||
      path.indexOf('shop_order_done') >= 0 ||
      href.indexOf('order_complete') >= 0 ||
      href.indexOf('payment_complete') >= 0 ||
      href.indexOf('payment_success') >= 0
    );
  }

  if (!isPaymentCompletePage()) return;
  if (window.__BIOCOM_SERVER_PAYMENT_DECISION_GUARD_V313_INSTALLED__) return;
  window.__BIOCOM_SERVER_PAYMENT_DECISION_GUARD_V313_INSTALLED__ = true;

  var allowedPurchaseEventIds = {};
  var handledAttemptKeys = {};
  var fallbackAfterObserveNoEventIds = {};
  var purchaseFallbackAfterObserveNoEventIds = {};
  var virtualAccountIssuedEventIds = {};
  var activeFbPixel = window.FB_PIXEL;
  var activeDecisionPromises = {};

  function getSearchParam(keys, sourceUrl) {
    try {
      var url = new URL(sourceUrl || window.location.href, window.location.origin);
      for (var i = 0; i < keys.length; i += 1) {
        var value = url.searchParams.get(keys[i]);
        if (value) return value;
      }
    } catch (error) {
      return '';
    }
    return '';
  }

  function getCookie(name) {
    var target = safeString(name) + '=';
    var cookies = safeString(document.cookie).split(';');
    for (var i = 0; i < cookies.length; i += 1) {
      var cookie = cookies[i].trim();
      if (cookie.indexOf(target) === 0) {
        return decodeURIComponent(cookie.slice(target.length));
      }
    }
    return '';
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

  function readSessionJson(key) {
    try {
      if (!window.sessionStorage) return {};
      return safeParseJson(window.sessionStorage.getItem(key));
    } catch (error) {
      return {};
    }
  }

  function hasVirtualAccountText(value) {
    var text = safeString(value).toLowerCase();
    if (!text) return false;
    return /가상\s*계좌|무통장|입금\s*계좌|입금\s*기한|입금\s*예정|계좌\s*번호|bank[_\s-]*transfer|virtual[_\s-]*account|vbank/.test(text);
  }

  function getStoredPaymentMethodHint() {
    var behavior = readSessionJson(CONFIG.paymentPageBehaviorKey);
    var checkout = readSessionJson(CONFIG.checkoutContextKey);
    var success = readSessionJson(CONFIG.paymentSuccessContextKey);
    return firstNonEmpty([
      behavior.selected_payment_method,
      behavior.payment_method_attempted,
      behavior.selectedPaymentMethod,
      checkout.selected_payment_method,
      checkout.payment_method,
      checkout.paymentMethod,
      success.selected_payment_method,
      success.payment_method,
      success.paymentMethod
    ]);
  }

  function getBodyTextForPaymentHint() {
    try {
      return safeString(document.body && (document.body.innerText || document.body.textContent)).slice(0, 12000);
    } catch (error) {
      return '';
    }
  }

  function detectVirtualAccountHint() {
    var storedMethod = getStoredPaymentMethodHint();
    if (hasVirtualAccountText(storedMethod)) {
      return {
        found: true,
        source: 'stored_payment_method',
        method: storedMethod
      };
    }

    var bodyText = getBodyTextForPaymentHint();
    if (hasVirtualAccountText(bodyText)) {
      return {
        found: true,
        source: 'completion_page_text',
        method: 'virtual_account_hint_text'
      };
    }

    return {
      found: false,
      source: 'none',
      method: ''
    };
  }

  function getOrderCodeFromEventId(eventId) {
    var value = safeString(eventId);
    var match = value.match(/^Purchase\.(o[0-9A-Za-z_-]+)/);
    return match ? match[1] : '';
  }

  function buildContext(eventId) {
    return {
      eventId: safeString(eventId),
      orderCode: firstNonEmpty([
        getSearchParam(['order_code', 'orderCode']),
        getSearchParam(['order_code', 'orderCode'], document.referrer),
        getOrderCodeFromEventId(eventId)
      ]),
      orderNo: firstNonEmpty([
        getSearchParam(['order_no', 'orderNo', 'order_id', 'orderId']),
        getSearchParam(['order_no', 'orderNo', 'order_id', 'orderId'], document.referrer)
      ]),
      orderId: firstNonEmpty([
        getSearchParam(['order_id', 'orderId']),
        getSearchParam(['order_id', 'orderId'], document.referrer)
      ]),
      paymentCode: firstNonEmpty([
        getSearchParam(['payment_code', 'paymentCode']),
        getSearchParam(['payment_code', 'paymentCode'], document.referrer)
      ]),
      paymentKey: firstNonEmpty([
        getSearchParam(['payment_key', 'paymentKey']),
        getSearchParam(['payment_key', 'paymentKey'], document.referrer)
      ]),
      store: CONFIG.store
    };
  }

  function hasDecisionLookup(context) {
    return Boolean(context.orderCode || context.orderId || context.orderNo || context.paymentCode || context.paymentKey);
  }

  function buildAttemptKey(context) {
    var material = buildHashSource(context);
    return material ? 'attempt:' + simpleHash(material) : '';
  }

  function buildDecisionUrl(context) {
    var url = new URL(CONFIG.decisionEndpoint);
    url.searchParams.set('site', CONFIG.site);
    url.searchParams.set('store', context.store || CONFIG.store);
    if (context.orderCode) url.searchParams.set('order_code', context.orderCode);
    if (context.orderId) url.searchParams.set('order_id', context.orderId);
    if (context.orderNo) url.searchParams.set('order_no', context.orderNo);
    if (context.paymentCode) url.searchParams.set('payment_code', context.paymentCode);
    if (context.paymentKey) url.searchParams.set('payment_key', context.paymentKey);
    return url.toString();
  }

  function normalizeIdentifier(value) {
    return safeString(value)
      .trim()
      .replace(/\s+/g, '')
      .toLowerCase();
  }

  function normalizeOrderNo(value) {
    return normalizeIdentifier(value)
      .replace(/-p\d+$/i, '')
      .replace(/[^0-9a-z_-]/g, '');
  }

  function buildHashSource(context) {
    var site = CONFIG.site;
    var store = normalizeIdentifier(context.store || CONFIG.store);
    var orderCode = normalizeIdentifier(context.orderCode);
    var orderNo = normalizeOrderNo(firstNonEmpty([context.orderNo, context.orderId]));
    var paymentCode = normalizeIdentifier(context.paymentCode);
    var paymentKey = normalizeIdentifier(context.paymentKey);

    if (orderCode && paymentCode) {
      return JSON.stringify({
        site: site,
        store: store,
        tier: 'orderCode_paymentCode',
        orderCode: orderCode,
        paymentCode: paymentCode
      });
    }

    if (orderCode && orderNo) {
      return JSON.stringify({
        site: site,
        store: store,
        tier: 'orderCode_orderNo',
        orderCode: orderCode,
        orderNo: orderNo
      });
    }

    if (paymentCode && orderNo) {
      return JSON.stringify({
        site: site,
        store: store,
        tier: 'paymentCode_orderNo',
        paymentCode: paymentCode,
        orderNo: orderNo
      });
    }

    if (paymentKey) {
      return JSON.stringify({
        site: site,
        store: store,
        tier: 'paymentKey',
        paymentKey: paymentKey
      });
    }

    if (orderNo) {
      return JSON.stringify({
        site: site,
        store: store,
        tier: 'orderNo',
        orderNo: orderNo
      });
    }

    return JSON.stringify({
      site: site,
      store: store,
      tier: 'fallback',
      eventId: normalizeIdentifier(context.eventId)
    });
  }

  function simpleHash(text) {
    var hash = 2166136261;
    for (var i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    return ('00000000' + (hash >>> 0).toString(16)).slice(-8);
  }

  function hashText(text) {
    try {
      if (window.crypto && window.crypto.subtle && window.TextEncoder) {
        return window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)).then(function (buffer) {
          var bytes = Array.prototype.slice.call(new Uint8Array(buffer));
          var hex = bytes.map(function (byte) {
            return ('00' + byte.toString(16)).slice(-2);
          }).join('');
          return hex.slice(0, 24);
        });
      }
    } catch (error) {
      // Fall through to non-cryptographic hash for cache key only.
    }
    return Promise.resolve(simpleHash(text));
  }

  function buildSafeCacheKey(context) {
    return hashText(buildHashSource(context)).then(function (hash) {
      return CONFIG.decisionCachePrefix + hash;
    });
  }

  function fallbackSafeRef(context) {
    return 'safe_' + simpleHash(buildHashSource(context));
  }

  function buildVirtualAccountSentKey(context) {
    return CONFIG.vbankSentPrefix + fallbackSafeRef(context);
  }

  function hasSentVirtualAccountIssued(context) {
    try {
      var key = buildVirtualAccountSentKey(context);
      if (virtualAccountIssuedEventIds[key]) return true;
      return Boolean(window.sessionStorage && window.sessionStorage.getItem(key));
    } catch (error) {
      return false;
    }
  }

  function rememberVirtualAccountIssued(context) {
    try {
      var key = buildVirtualAccountSentKey(context);
      virtualAccountIssuedEventIds[key] = true;
      if (window.sessionStorage) {
        window.sessionStorage.setItem(key, new Date().toISOString());
      }
    } catch (error) {
      // Dedupe best effort only. Event ID still remains safe and deterministic.
    }
  }

  function compactDecision(decision) {
    decision = decision || {};
    return {
      status: safeString(decision.status || 'unknown'),
      browserAction: safeString(decision.browserAction || 'hold_or_block_purchase'),
      reason: safeString(decision.reason || ''),
      matchedBy: safeString(decision.matchedBy || ''),
      confidence: safeString(decision.confidence || '')
    };
  }

  function extractDecision(responseBody) {
    var body = responseBody || {};
    var result = body.result && typeof body.result === 'object' ? body.result : {};
    var data = body.data && typeof body.data === 'object' ? body.data : {};
    var decision = body.decision || result.decision || data.decision || result || data || {};

    return {
      status: firstNonEmpty([
        body.status,
        body.decision_status,
        result.status,
        data.status,
        decision.status
      ]) || 'unknown',
      browserAction: firstNonEmpty([
        body.browserAction,
        body.browser_action,
        result.browserAction,
        result.browser_action,
        data.browserAction,
        data.browser_action,
        decision.browserAction,
        decision.browser_action
      ]) || 'hold_or_block_purchase',
      reason: firstNonEmpty([
        body.reason,
        body.error,
        result.reason,
        result.error,
        data.reason,
        data.error,
        decision.reason,
        decision.error
      ]),
      matchedBy: firstNonEmpty([
        body.matchedBy,
        body.matched_by,
        result.matchedBy,
        result.matched_by,
        data.matchedBy,
        data.matched_by,
        decision.matchedBy,
        decision.matched_by
      ]),
      confidence: firstNonEmpty([
        body.confidence,
        result.confidence,
        data.confidence,
        decision.confidence
      ])
    };
  }

  function normalizeDecisionPayload(responseBody, context, source, endpointStatus) {
    responseBody = responseBody || {};
    var result = responseBody.result && typeof responseBody.result === 'object' ? responseBody.result : {};
    var data = responseBody.data && typeof responseBody.data === 'object' ? responseBody.data : {};
    var decision = extractDecision(responseBody);

    return {
      decision: compactDecision(decision),
      safeRef: firstNonEmpty([
        responseBody.safe_ref,
        responseBody.safeRef,
        result.safe_ref,
        result.safeRef,
        data.safe_ref,
        data.safeRef,
        decision.safe_ref,
        decision.safeRef,
        fallbackSafeRef(context)
      ]),
      source: firstNonEmpty([source, responseBody.source, result.source, data.source, decision.source, 'payment-decision']),
      endpointStatus: endpointStatus || 0,
      fromCache: false,
      noCache: Boolean(responseBody.noCache)
    };
  }

  function readDecisionCache(context) {
    return buildSafeCacheKey(context).then(function (key) {
      try {
        var raw = window.sessionStorage && window.sessionStorage.getItem(key);
        if (!raw) return null;

        var parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return null;
        if (!parsed.expiresAt || Number(parsed.expiresAt) <= Date.now()) {
          window.sessionStorage.removeItem(key);
          return null;
        }

        return {
          decision: compactDecision(parsed.decision || {}),
          safeRef: safeString(parsed.safe_ref || parsed.safeRef || fallbackSafeRef(context)),
          source: safeString(parsed.source || 'session_cache'),
          endpointStatus: 0,
          fromCache: true
        };
      } catch (error) {
        return null;
      }
    });
  }

  function isAllowPurchasePayload(payload) {
    var decision = payload && payload.decision ? payload.decision : {};
    return decision.browserAction === 'allow_purchase' || decision.status === 'confirmed';
  }

  function isFetchFailurePayload(payload) {
    var decision = payload && payload.decision ? payload.decision : {};
    return Boolean(
      payload && payload.noCache ||
      payload && payload.source === 'fetch_failed' ||
      decision.reason === 'decision_fetch_failed' ||
      decision.reason === 'decision_endpoint_error' ||
      decision.reason === 'decision_parse_failed'
    );
  }

  function getDecisionCacheTtlMs(payload) {
    var decision = payload && payload.decision ? payload.decision : {};
    if (!payload || !decision) return 0;
    if (isFetchFailurePayload(payload)) return 0;
    if (isAllowPurchasePayload(payload)) return CONFIG.decisionCacheTtlMs;
    if (decision.browserAction === 'block_purchase_virtual_account') return CONFIG.blockDecisionCacheTtlMs;
    if (decision.browserAction === 'block_purchase') return CONFIG.blockDecisionCacheTtlMs;
    if (decision.status === 'unknown' || decision.browserAction === 'hold_or_block_purchase') {
      return CONFIG.unknownDecisionCacheTtlMs;
    }
    return 0;
  }

  function parseCachedDecision(raw, context) {
    if (!raw) return null;
    try {
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      if (!parsed.expiresAt || Number(parsed.expiresAt) <= Date.now()) return null;
      return {
        decision: compactDecision(parsed.decision || {}),
        safeRef: safeString(parsed.safe_ref || parsed.safeRef || fallbackSafeRef(context)),
        source: safeString(parsed.source || 'session_cache'),
        endpointStatus: 0,
        fromCache: true
      };
    } catch (error) {
      return null;
    }
  }

  function shouldOverwriteDecisionCache(currentPayload, nextPayload) {
    if (!nextPayload || !nextPayload.decision) return false;
    if (isFetchFailurePayload(nextPayload)) return false;
    if (isAllowPurchasePayload(nextPayload)) return true;
    if (currentPayload && isAllowPurchasePayload(currentPayload)) return false;
    return getDecisionCacheTtlMs(nextPayload) > 0;
  }

  function writeDecisionCache(context, payload, source) {
    if (!payload || !payload.decision || !hasDecisionLookup(context)) return Promise.resolve(false);

    return buildSafeCacheKey(context).then(function (key) {
      try {
        var currentRaw = window.sessionStorage && window.sessionStorage.getItem(key);
        var currentPayload = parseCachedDecision(currentRaw, context);

        if (!shouldOverwriteDecisionCache(currentPayload, payload)) {
          return false;
        }

        var ttlMs = getDecisionCacheTtlMs(payload);
        if (ttlMs <= 0) return false;

        var expiresAt = Date.now() + ttlMs;
        var value = {
          snippetVersion: CONFIG.snippetVersion,
          cachedAt: new Date().toISOString(),
          expiresAt: expiresAt,
          safe_ref: payload.safeRef || fallbackSafeRef(context),
          source: source || payload.source || 'payment-decision',
          decision: compactDecision(payload.decision)
        };
        window.sessionStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch (error) {
        return false;
      }
    });
  }

  function logDiagnostic(label, fields) {
    if (!window.console || !console.info) return;
    fields = fields || {};
    var parts = [];
    for (var key in fields) {
      if (!Object.prototype.hasOwnProperty.call(fields, key)) continue;
      parts.push(key + '=' + compact(fields[key]));
    }
    console.info(CONFIG.logPrefix + ' ' + label + ' ' + parts.join(' '));
  }

  function rememberLastDiagnostic(fields) {
    try {
      fields.updatedAt = new Date().toISOString();
      fields.snippetVersion = CONFIG.snippetVersion;
      fields.locationClass = 'payment_complete';
      window.__BIOCOM_SERVER_PAYMENT_DECISION_LAST__ = fields;
    } catch (error) {
      // Assignment can fail in unusual browser contexts.
    }
  }

  function buildSafeLogFields(context, payload, extra) {
    var decision = payload && payload.decision ? payload.decision : {};
    var fields = {
      branch: decision.browserAction || 'unknown',
      status: decision.status || 'unknown',
      reason: decision.reason || '',
      matchedBy: decision.matchedBy || '',
      confidence: decision.confidence || '',
      source: payload && payload.source ? payload.source : '',
      safeRef: payload && payload.safeRef ? payload.safeRef : fallbackSafeRef(context),
      fromCache: payload && payload.fromCache ? 'yes' : 'no',
      hasOrderCode: context.orderCode ? 'yes' : 'no',
      hasOrderNo: context.orderNo ? 'yes' : 'no',
      hasOrderId: context.orderId ? 'yes' : 'no',
      hasPaymentCode: context.paymentCode ? 'yes' : 'no',
      hasPaymentKey: context.paymentKey ? 'yes' : 'no'
    };

    extra = extra || {};
    for (var key in extra) {
      if (Object.prototype.hasOwnProperty.call(extra, key)) fields[key] = extra[key];
    }

    return fields;
  }

  function logDecisionBranch(context, payload, source) {
    var fields = buildSafeLogFields(context, payload, { source: source || payload.source || '' });
    logDiagnostic('decision', fields);
    rememberLastDiagnostic(fields);
  }

  function fetchWithTimeout(url, timeoutMs) {
    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = window.setTimeout(function () {
      if (controller) controller.abort();
    }, timeoutMs);

    return fetch(url, {
      method: 'GET',
      credentials: 'omit',
      mode: 'cors',
      cache: 'no-store',
      keepalive: true,
      signal: controller ? controller.signal : undefined
    }).then(function (response) {
      return response.json().then(function (json) {
        return { ok: response.ok, status: response.status, body: json };
      }).catch(function () {
        return { ok: response.ok, status: response.status, body: null };
      });
    }).finally(function () {
      window.clearTimeout(timer);
    });
  }

  function shouldRetryDecision(context, payload) {
    var decision = payload && payload.decision ? payload.decision : {};
    return Boolean(
      hasDecisionLookup(context) &&
      decision.status === 'unknown' &&
      decision.reason === 'no_toss_or_ledger_match'
    );
  }

  function queryDecisionOnce(context) {
    if (!hasDecisionLookup(context)) {
      return Promise.resolve(normalizeDecisionPayload({
        decision: {
          status: 'unknown',
          browserAction: 'hold_or_block_purchase',
          reason: 'missing_order_identifiers'
        }
      }, context, 'local_guard', 0));
    }

    return fetchWithTimeout(buildDecisionUrl(context), CONFIG.requestTimeoutMs)
      .then(function (response) {
        if (!response.ok || !response.body || response.body.ok !== true) {
          return normalizeDecisionPayload({
            decision: {
              status: 'unknown',
              browserAction: 'hold_or_block_purchase',
              reason: 'decision_endpoint_error',
              endpointStatus: response.status
            },
            noCache: true
          }, context, 'endpoint_error', response.status);
        }
        return normalizeDecisionPayload(response.body, context, 'payment-decision', response.status);
      })
      .catch(function (error) {
        return normalizeDecisionPayload({
          decision: {
            status: 'unknown',
            browserAction: 'hold_or_block_purchase',
            reason: 'decision_fetch_failed',
            message: error && error.message ? error.message : safeString(error)
          },
          noCache: true
        }, context, 'fetch_failed', 0);
      });
  }

  function queryDecision(context) {
    return queryDecisionOnce(context).then(function (payload) {
      if (!shouldRetryDecision(context, payload)) return payload;

      logDiagnostic('decision_retry_scheduled', buildSafeLogFields(context, payload, {
        retryDelayMs: CONFIG.decisionRetryDelayMs
      }));

      return new Promise(function (resolve) {
        window.setTimeout(resolve, CONFIG.decisionRetryDelayMs);
      }).then(function () {
        return queryDecisionOnce(context);
      }).then(function (retryPayload) {
        logDiagnostic('decision_retry_result', buildSafeLogFields(context, retryPayload));
        return retryPayload;
      });
    });
  }

  function getDecisionPromise(context, source) {
    return buildSafeCacheKey(context).then(function (key) {
      if (activeDecisionPromises[key]) return activeDecisionPromises[key];

      activeDecisionPromises[key] = readDecisionCache(context).then(function (cached) {
        if (cached) return cached;

        return queryDecision(context).then(function (payload) {
          return writeDecisionCache(context, payload, source).then(function () {
            return payload;
          });
        });
      }).finally(function () {
        delete activeDecisionPromises[key];
      });

      return activeDecisionPromises[key];
    });
  }

  function prefetchDecision() {
    var context = buildContext('');
    if (!hasDecisionLookup(context)) {
      logDiagnostic('decision_prefetch_skipped', {
        reason: 'missing_order_identifiers',
        safeRef: fallbackSafeRef(context)
      });
      return;
    }

    readDecisionCache(context).then(function (cached) {
      if (cached) {
        logDiagnostic('decision_prefetch_cache_hit', buildSafeLogFields(context, cached));
        return cached;
      }

      return getDecisionPromise(context, 'prefetch').then(function (payload) {
        logDiagnostic('decision_prefetch_result', buildSafeLogFields(context, payload));
        return payload;
      });
    }).catch(function (error) {
      logDiagnostic('decision_prefetch_failed', {
        reason: error && error.message ? error.message : safeString(error),
        safeRef: fallbackSafeRef(context)
      });
    });
  }

  function getRawFbq() {
    var fbq = window.fbq;
    if (!fbq) return null;
    return fbq.__BIOCOM_SERVER_PAYMENT_DECISION_GUARD_RAW__ || fbq;
  }

  function callRawFbq(args) {
    var rawFbq = getRawFbq();
    if (typeof rawFbq !== 'function') return false;
    rawFbq.apply(window, args);
    return true;
  }

  function markAllowed(eventId) {
    var id = safeString(eventId);
    if (!id) return;
    allowedPurchaseEventIds[id] = true;
    window.setTimeout(function () {
      delete allowedPurchaseEventIds[id];
    }, 2000);
  }

  function isAllowed(eventId) {
    var id = safeString(eventId);
    return Boolean(id && allowedPurchaseEventIds[id]);
  }

  function buildCustomEventId(name, context) {
    return name + '.' + firstNonEmpty([
      fallbackSafeRef(context),
      String(Date.now())
    ]);
  }

  function buildCustomData(value, currency, context, payload) {
    var decision = payload.decision || {};
    return {
      value: Number(value) || 0,
      currency: currency || 'KRW',
      payment_decision_status: decision.status || 'unknown',
      payment_decision_reason: decision.reason || '',
      payment_status: payload.paymentStatus || decision.status || 'unknown',
      payment_method: payload.paymentMethod || '',
      event_source: payload.eventSource || '',
      event_trigger: payload.eventTrigger || '',
      decision_safe_ref: payload.safeRef || fallbackSafeRef(context),
      has_order_code: context.orderCode ? 'yes' : 'no',
      has_order_no: context.orderNo ? 'yes' : 'no',
      has_payment_code: context.paymentCode ? 'yes' : 'no',
      has_payment_key: context.paymentKey ? 'yes' : 'no',
      snippet_version: CONFIG.snippetVersion,
      virtual_account_issue_source: payload.virtualAccountIssueSource || '',
      virtual_account_hint_source: payload.virtualAccountHintSource || '',
      is_purchase: payload.isPurchase || '',
      is_paid: payload.isPaid || ''
    };
  }

  function sendPixelFallback(name, customData, eventId) {
    try {
      var url = new URL('https://www.facebook.com/tr/');
      url.searchParams.set('id', CONFIG.pixelId);
      url.searchParams.set('ev', name);
      url.searchParams.set('dl', window.location.href);
      url.searchParams.set('rl', document.referrer || '');
      url.searchParams.set('if', 'false');
      url.searchParams.set('ts', String(Date.now()));
      url.searchParams.set('eid', eventId);

      var fbp = getCookie('_fbp');
      var fbc = getCookie('_fbc');
      if (fbp) url.searchParams.set('fbp', fbp);
      if (fbc) url.searchParams.set('fbc', fbc);

      for (var key in customData) {
        if (!Object.prototype.hasOwnProperty.call(customData, key)) continue;
        var value = customData[key];
        if (value === null || value === undefined || value === '') continue;
        url.searchParams.set('cd[' + key + ']', safeString(value));
      }

      var img = new Image();
      img.src = url.toString();
      return true;
    } catch (error) {
      return false;
    }
  }

  function countPixelNetworkMatches(name, eventId) {
    var result = {
      matchCount: 0,
      eventOnlyCount: 0,
      pixelRequestCount: 0,
      error: ''
    };

    try {
      if (window.performance && typeof window.performance.getEntriesByType === 'function') {
        var entries = window.performance.getEntriesByType('resource') || [];
        for (var i = 0; i < entries.length; i += 1) {
          var rawUrl = safeString(entries[i] && entries[i].name);
          if (rawUrl.indexOf('facebook.com/tr') < 0) continue;
          result.pixelRequestCount += 1;

          var decodedUrl = rawUrl;
          try {
            decodedUrl = decodeURIComponent(rawUrl);
          } catch (error) {
            decodedUrl = rawUrl;
          }

          var eventMatches = rawUrl.indexOf('ev=' + encodeURIComponent(name)) >= 0 ||
            decodedUrl.indexOf('ev=' + name) >= 0 ||
            decodedUrl.indexOf(name) >= 0;
          if (!eventMatches) continue;

          result.eventOnlyCount += 1;
          if (eventId && (rawUrl.indexOf(encodeURIComponent(eventId)) >= 0 || decodedUrl.indexOf(eventId) >= 0)) {
            result.matchCount += 1;
          }
        }
      }
    } catch (error) {
      result.matchCount = -1;
      result.error = error && error.message ? error.message : safeString(error);
    }

    return result;
  }

  function observePixelNetwork(name, eventId, context, customData, payload, sourceMethod) {
    window.setTimeout(function () {
      var summary = countPixelNetworkMatches(name, eventId);

      logDiagnostic('custom_event_network_observed', buildSafeLogFields(context, payload, {
        eventName: name,
        found: summary.matchCount > 0 ? 'yes' : 'no',
        matchCount: summary.matchCount,
        eventOnlyCount: summary.eventOnlyCount,
        pixelRequestCount: summary.pixelRequestCount,
        error: summary.error
      }));

      if (sourceMethod !== 'fbq' || summary.matchCount !== 0) return;
      if (fallbackAfterObserveNoEventIds[eventId]) return;

      fallbackAfterObserveNoEventIds[eventId] = true;

      if (sendPixelFallback(name, customData, eventId)) {
        logDiagnostic('custom_event_fallback_sent', buildSafeLogFields(context, payload, {
          eventName: name,
          method: 'image_fallback_after_observe_no'
        }));
      } else {
        logDiagnostic('custom_event_fallback_failed', buildSafeLogFields(context, payload, {
          eventName: name
        }));
      }
    }, 1500);
  }

  function trackCustom(name, value, currency, context, payload) {
    var customData = buildCustomData(value, currency, context, payload);
    var eventId = buildCustomEventId(name, context);
    var args = [
      'trackCustom',
      name,
      customData,
      { eventID: eventId }
    ];
    var sent = false;

    logDiagnostic('custom_event_prepare', buildSafeLogFields(context, payload, { eventName: name }));

    CONFIG.customEventRetryMs.forEach(function (delayMs, index) {
      window.setTimeout(function () {
        if (sent) return;

        if (callRawFbq(args)) {
          sent = true;
          logDiagnostic('custom_event_sent', buildSafeLogFields(context, payload, {
            eventName: name,
            method: 'fbq'
          }));
          observePixelNetwork(name, eventId, context, customData, payload, 'fbq');
          return;
        }

        if (index === CONFIG.customEventRetryMs.length - 1) {
          sent = sendPixelFallback(name, customData, eventId);
          if (sent) {
            logDiagnostic('custom_event_sent', buildSafeLogFields(context, payload, {
              eventName: name,
              method: 'image_fallback'
            }));
            observePixelNetwork(name, eventId, context, customData, payload, 'image_fallback');
          } else {
            logDiagnostic('custom_event_failed', buildSafeLogFields(context, payload, { eventName: name }));
          }
        }
      }, delayMs);
    });
  }

  function logPurchaseDispatchStart(context, payload, source) {
    logDiagnostic('purchase_dispatch_start', buildSafeLogFields(context, payload, {
      eventName: 'Purchase',
      source: source
    }));
  }

  function sendAllowedPurchaseFallback(params, context, payload, reason) {
    var eventId = context.eventId || ('Purchase.' + fallbackSafeRef(context));
    if (!eventId || purchaseFallbackAfterObserveNoEventIds[eventId]) return;

    purchaseFallbackAfterObserveNoEventIds[eventId] = true;

    var purchaseData = buildCustomData(params.value, params.currency, context, payload);
    logDiagnostic('purchase_network_missing_fallback_start', buildSafeLogFields(context, payload, {
      eventName: 'Purchase',
      method: 'image_fallback_after_original_no_network',
      fallbackReason: reason || ''
    }));

    if (sendPixelFallback('Purchase', purchaseData, eventId)) {
      logDiagnostic('purchase_fallback_sent', buildSafeLogFields(context, payload, {
        eventName: 'Purchase',
        method: 'image_fallback_after_original_no_network'
      }));
    } else {
      logDiagnostic('purchase_fallback_failed', buildSafeLogFields(context, payload, {
        eventName: 'Purchase',
        fallbackReason: 'image_fallback_failed'
      }));
    }
  }

  function observePurchaseNetwork(context, params, payload) {
    window.setTimeout(function () {
      var eventId = context.eventId || ('Purchase.' + fallbackSafeRef(context));
      var summary = countPixelNetworkMatches('Purchase', eventId);

      logDiagnostic('purchase_network_observed', buildSafeLogFields(context, payload, {
        eventName: 'Purchase',
        found: summary.matchCount > 0 ? 'yes' : 'no',
        matchCount: summary.matchCount,
        eventOnlyCount: summary.eventOnlyCount,
        pixelRequestCount: summary.pixelRequestCount,
        error: summary.error
      }));

      if (summary.matchCount === 0 && summary.eventOnlyCount === 0) {
        sendAllowedPurchaseFallback(params, context, payload, 'no_purchase_network_after_original_dispatch');
      }
    }, CONFIG.purchaseFallbackDelayMs);
  }

  function buildVirtualAccountIssuedPayload(context, hint) {
    hint = hint || {};
    return {
      decision: compactDecision({
        status: 'pending',
        browserAction: 'block_purchase_virtual_account',
        reason: 'completion_page_virtual_account_hint',
        matchedBy: hint.source || 'browser_completion_hint',
        confidence: 'medium'
      }),
      safeRef: fallbackSafeRef(context),
      source: 'completion_page_virtual_account_hint_v313',
      endpointStatus: 0,
      fromCache: false,
      virtualAccountIssueSource: 'completion_page_immediate_fire_v313',
      virtualAccountHintSource: hint.source || 'unknown',
      paymentStatus: 'pending',
      paymentMethod: 'virtual_account',
      eventSource: 'header_guard_v313',
      eventTrigger: 'completion_page_virtual_account_hint',
      isPurchase: 'no',
      isPaid: 'no'
    };
  }

  function trackVirtualAccountIssuedOnce(value, currency, context, payload, sourceReason) {
    if (hasSentVirtualAccountIssued(context)) {
      logDiagnostic('virtual_account_issued_skip_duplicate', buildSafeLogFields(context, payload, {
        eventName: CONFIG.vbankEventName,
        sourceReason: sourceReason || ''
      }));
      return false;
    }

    rememberVirtualAccountIssued(context);
    trackCustom(CONFIG.vbankEventName, value || 0, currency || 'KRW', context, payload);
    logDiagnostic('virtual_account_issued_triggered', buildSafeLogFields(context, payload, {
      eventName: CONFIG.vbankEventName,
      sourceReason: sourceReason || ''
    }));
    return true;
  }

  function maybeFireVirtualAccountIssuedOnCompletion() {
    var context = buildContext('');

    if (!hasDecisionLookup(context)) {
      logDiagnostic('virtual_account_issued_immediate_skip', {
        reason: 'missing_order_identifiers',
        safeRef: fallbackSafeRef(context)
      });
      return;
    }

    var hint = detectVirtualAccountHint();
    if (!hint.found) {
      logDiagnostic('virtual_account_issued_immediate_skip', {
        reason: 'missing_virtual_account_hint',
        safeRef: fallbackSafeRef(context)
      });
      return;
    }

    readDecisionCache(context).then(function (cached) {
      if (cached && isAllowPurchasePayload(cached)) {
        logDiagnostic('virtual_account_issued_immediate_skip', buildSafeLogFields(context, cached, {
          reason: 'cached_allow_purchase',
          eventName: CONFIG.vbankEventName
        }));
        return;
      }

      if (cached && cached.decision && cached.decision.browserAction === 'block_purchase') {
        logDiagnostic('virtual_account_issued_immediate_skip', buildSafeLogFields(context, cached, {
          reason: 'cached_block_purchase',
          eventName: CONFIG.vbankEventName
        }));
        return;
      }

      var payload = buildVirtualAccountIssuedPayload(context, hint);
      trackVirtualAccountIssuedOnce(0, 'KRW', context, payload, 'completion_page_virtual_account_hint');
    }).catch(function () {
      var payload = buildVirtualAccountIssuedPayload(context, hint);
      trackVirtualAccountIssuedOnce(0, 'KRW', context, payload, 'completion_page_virtual_account_hint_cache_read_failed');
    });
  }

  function handleDecisionPayload(context, params, payload) {
    var decision = payload.decision || {};

    logDecisionBranch(context, payload, params.source);

    if (decision.browserAction === 'allow_purchase') {
      writeDecisionCache(context, payload, 'allow_purchase').then(function () {});
      logPurchaseDispatchStart(context, payload, params.source);
      markAllowed(context.eventId);
      try {
        params.invokeOriginal();
        logDiagnostic('purchase_dispatch_complete', buildSafeLogFields(context, payload, {
          eventName: 'Purchase',
          source: params.source
        }));
      } catch (error) {
        logDiagnostic('purchase_dispatch_error', buildSafeLogFields(context, payload, {
          eventName: 'Purchase',
          source: params.source,
          message: error && error.message ? error.message : safeString(error)
        }));
        throw error;
      }
      observePurchaseNetwork(context, params, payload);
      return;
    }

    if (decision.browserAction === 'block_purchase_virtual_account') {
      writeDecisionCache(context, payload, 'block_purchase_virtual_account').then(function () {});
      trackVirtualAccountIssuedOnce(0, params.currency || 'KRW', context, payload, 'payment_decision_pending');
      return;
    }

    if (decision.browserAction === 'block_purchase') {
      writeDecisionCache(context, payload, 'block_purchase').then(function () {});
      trackCustom(CONFIG.blockedEventName, params.value, params.currency, context, payload);
      return;
    }

    writeDecisionCache(context, payload, 'unknown').then(function () {});
    trackCustom(CONFIG.unknownEventName, params.value, params.currency, context, payload);
  }

  function handlePurchaseAttempt(params) {
    var context = buildContext(params.eventId);
    var attemptKey = buildAttemptKey(context);

    if (attemptKey && handledAttemptKeys[attemptKey]) {
      return;
    }
    if (attemptKey) handledAttemptKeys[attemptKey] = true;

    readDecisionCache(context).then(function (cached) {
      if (cached) {
        handleDecisionPayload(context, params, cached);
        return;
      }

      window.setTimeout(function () {
        getDecisionPromise(context, params.source).then(function (payload) {
          handleDecisionPayload(context, params, payload);
        });
      }, CONFIG.holdMs);
    }).catch(function () {
      window.setTimeout(function () {
        queryDecision(context).then(function (payload) {
          handleDecisionPayload(context, params, payload);
        });
      }, CONFIG.holdMs);
    });
  }

  function wrapFbPixel(pixel) {
    if (!pixel || typeof pixel.Purchase !== 'function') return false;
    if (pixel.__BIOCOM_SERVER_PAYMENT_DECISION_GUARD_WRAPPED__) return true;

    var originalPurchase = pixel.Purchase;

    pixel.Purchase = function (value, currency, eventId, fbExternalId) {
      var self = this;
      var args = arguments;

      if (isAllowed(eventId)) {
        return originalPurchase.apply(self, args);
      }

      handlePurchaseAttempt({
        source: 'FB_PIXEL.Purchase',
        value: value,
        currency: currency,
        eventId: eventId,
        invokeOriginal: function () {
          originalPurchase.apply(self, args);
        }
      });
    };

    pixel.__BIOCOM_SERVER_PAYMENT_DECISION_GUARD_WRAPPED__ = true;
    return true;
  }

  function extractFbqEventId(options, params) {
    var eventId = '';
    if (options && typeof options === 'object') {
      eventId = options.eventID || options.eventId || options.event_id || '';
    }
    if (!eventId && params && typeof params === 'object') {
      eventId = params.eventID || params.eventId || params.event_id || '';
    }
    return safeString(eventId);
  }

  function wrapFbq() {
    var currentFbq = window.fbq;
    if (typeof currentFbq !== 'function') return false;
    if (currentFbq.__BIOCOM_SERVER_PAYMENT_DECISION_GUARD_WRAPPED__) return true;

    var rawFbq = currentFbq;
    var guardedFbq = function () {
      var args = Array.prototype.slice.call(arguments);
      var command = args[0];
      var eventName = args[1];

      if (command === 'track' && eventName === 'Purchase') {
        var params = args[2] && typeof args[2] === 'object' ? args[2] : {};
        var options = args[3] && typeof args[3] === 'object' ? args[3] : {};
        var eventId = extractFbqEventId(options, params);

        if (isAllowed(eventId)) {
          return rawFbq.apply(window, args);
        }

        handlePurchaseAttempt({
          source: 'fbq.track.Purchase',
          value: params.value,
          currency: params.currency,
          eventId: eventId,
          invokeOriginal: function () {
            rawFbq.apply(window, args);
          }
        });
        return;
      }

      return rawFbq.apply(window, args);
    };

    for (var key in rawFbq) {
      try {
        guardedFbq[key] = rawFbq[key];
      } catch (error) {
        // Some properties may be read-only.
      }
    }

    guardedFbq.__BIOCOM_SERVER_PAYMENT_DECISION_GUARD_WRAPPED__ = true;
    guardedFbq.__BIOCOM_SERVER_PAYMENT_DECISION_GUARD_RAW__ = rawFbq;
    window.fbq = guardedFbq;
    return true;
  }

  try {
    Object.defineProperty(window, 'FB_PIXEL', {
      configurable: true,
      get: function () {
        return activeFbPixel;
      },
      set: function (nextPixel) {
        activeFbPixel = nextPixel;
        wrapFbPixel(activeFbPixel);
      }
    });
  } catch (error) {
    // Polling below still tries to wrap.
  }

  CONFIG.wrapPollMs.forEach(function (ms) {
    window.setTimeout(function () {
      if (window.FB_PIXEL) wrapFbPixel(window.FB_PIXEL);
      wrapFbq();
    }, ms);
  });

  function scheduleImmediateVirtualAccountIssuedChecks() {
    for (var i = 0; i < CONFIG.immediateFirePollMs.length; i += 1) {
      window.setTimeout(maybeFireVirtualAccountIssuedOnCompletion, CONFIG.immediateFirePollMs[i]);
    }
  }

  window.setTimeout(prefetchDecision, 0);
  scheduleImmediateVirtualAccountIssuedChecks();

  if (window.console && console.info) {
    console.info(CONFIG.logPrefix, 'installed', CONFIG.snippetVersion);
  }
})();
</script>

```

## 적용 후 Smoke 기준

### 가상계좌 미입금 주문

- 해야 할 일: Google 광고 또는 테스트 유입 URL로 상품 페이지 진입 → 구매하기 → 가상계좌 주문 생성 완료 화면 도달
- 성공 기준: Meta Pixel Helper 또는 Network `facebook.com/tr`에서 `VirtualAccountIssued` 1건 확인
- 실패 기준: `Purchase`가 미입금 주문에서 발화하거나, `VirtualAccountIssued`가 0건인 상태
- 실패 시 확인점: 콘솔의 `[biocom-server-payment-decision-guard-v3.1.3]` 로그, completion URL의 `order_code`, `payment_code`, `order_no` 존재 여부, sessionStorage `__seo_checkout_context` 존재 여부

### 카드 결제완료 주문

- 해야 할 일: 실제 결제완료 흐름에서 completion 화면 도달
- 성공 기준: 서버 결제 판단이 confirmed일 때만 `Purchase` 경로가 허용되고, `VirtualAccountIssued`는 0건
- 실패 기준: 카드 결제완료에서 `VirtualAccountIssued`가 발화
- 실패 시 확인점: 결제수단 판단 힌트, 서버 `payment-decision` 응답, completion URL 분류

## 하지 않은 것

- 이 문서는 운영 반영용 코드 문서만 생성한다.
- 아임웹 저장, GTM 운영 반영, Meta/Google Ads 전환 전송, VM Cloud 배포, 운영DB write는 하지 않았다.

## Auditor Verdict

PASS_WITH_NOTES. 문서 생성과 로컬 코드 형태 검증은 Green Lane으로 가능하다. 실제 아임웹 저장은 사이트 전체 전환 이벤트에 영향을 주므로 Red Lane이며 TJ님이 직접 저장해야 한다.
