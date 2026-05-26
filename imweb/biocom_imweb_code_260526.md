
<헤더 상단>
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



<헤더 코드>
<!-- Biocom Direct Meta Pixel Base v0.2
  Use only when Imweb Marketing Asset / FBE Meta Pixel is OFF.
  Pixel ID: 1283400029487161
  Fires PageView only.
  Does NOT fire Purchase.
  Version: 2026-05-15-biocom-direct-meta-pixel-base-v0-2
-->
<script>
(function () {
  'use strict';

  var PIXEL_ID = '1283400029487161';
  var VERSION = '2026-05-15-biocom-direct-meta-pixel-base-v0-2';
  var DEBUG_KEY = '__seo_attribution_debug';

  if (window.__BIOCOM_DIRECT_META_PIXEL_BASE_VERSION__ === VERSION) return;
  window.__BIOCOM_DIRECT_META_PIXEL_BASE_VERSION__ = VERSION;

  function isDebugMode() {
    try {
      return new URLSearchParams(window.location.search).get(DEBUG_KEY) === '1';
    } catch (error) {
      return false;
    }
  }

  function log() {
    if (!isDebugMode()) return;
    try {
      console.log.apply(console, ['[biocom-direct-meta-base]'].concat([].slice.call(arguments)));
    } catch (error) {}
  }

  /*
    Safety guard:
    If an existing FBE/native fbq is already on the page, do not initialize another base pixel.
    For direct Pixel experiment, turn OFF Imweb FBE first.
  */
  if (typeof window.fbq === 'function') {
    window.__BIOCOM_DIRECT_PIXEL_BLOCKED_BY_EXISTING_FBQ__ = true;
    log('blocked: existing fbq detected. Turn OFF Imweb FBE before direct Pixel test.');
    return;
  }

  !function(f,b,e,v,n,t,s) {
    if (f.fbq) return;
    n = f.fbq = function() {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
    };
    if (!f._fbq) f._fbq = n;
    n.push = n;
    n.loaded = true;
    n.version = '2.0';
    n.queue = [];
    t = b.createElement(e);
    t.async = true;
    t.src = v;
    s = b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t, s);
  }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');

  window.fbq('init', PIXEL_ID);

  /*
    PageView only.
    Purchase must remain VM Cloud confirmed CAPI / guarded path.
  */
  window.fbq('track', 'PageView');

  window.__BIOCOM_DIRECT_META_PIXEL_READY__ = true;
  window.__BIOCOM_DIRECT_META_PIXEL_ID__ = PIXEL_ID;

  log('direct Meta Pixel initialized', {
    pixelId: PIXEL_ID,
    fires: ['PageView'],
    purchase: 'disabled'
  });
})();
</script>
<!-- End Biocom Direct Meta Pixel Base v0.2 -->

<script>
/* TikTok Purchase Guard enforce candidate
 * Version: 2026-04-23.tiktok-purchase-guard-enforce.v2-event-log
 *
 * Blocks only high-confidence pending virtual-account Purchase events.
 * Confirmed Purchase events are released after payment-decision.
 * Unknown/request-error decisions fail open to avoid losing real purchases.
 */
(function (w) {
  "use strict";

  var VERSION = "2026-04-23.tiktok-purchase-guard-enforce.v2-event-log";
  var GUARD_KEY = "__BIOCOM_TIKTOK_PURCHASE_GUARD__";
  var WRAP_KEY = "__BIOCOM_TIKTOK_PURCHASE_GUARD_WRAPPED__";
  var RAW_KEY = "__BIOCOM_TIKTOK_PURCHASE_GUARD_RAW__";
  var ACCESSOR_KEY = "__BIOCOM_TIKTOK_PURCHASE_GUARD_ACCESSOR__";

  if (w[GUARD_KEY] && w[GUARD_KEY].version === VERSION) return;

  var CONFIG = {
    version: VERSION,
    endpoint: "https://att.ainativeos.net/api/attribution/payment-decision",
    eventLogEndpoint: "https://att.ainativeos.net/api/attribution/tiktok-pixel-event",
    enableEventLog: true,
    store: "biocom",
    timeoutMs: 1800,
    scanIntervalMs: 100,
    scanLimitMs: 90000,
    storageKey: "__biocom_tiktok_purchase_guard_decisions__",
    maxRows: 100,
    logPrefix: "[biocom-tiktok-purchase-guard]",
    replacementEventName: "PlaceAnOrder",
    sendReplacementForPending: true,
    allowOnUnknown: true,
    debug: false
  };

  var activeTiktokPixel = w.TIKTOK_PIXEL;
  var activeTtq = w.ttq;
  var state = {
    installedAt: new Date().toISOString(),
    seen: {},
    rows: [],
    wrappers: {
      tiktokPixelTrack: false,
      tiktokPixelInit: false,
      ttqTrack: false
    },
    accessors: {
      TIKTOK_PIXEL: false,
      ttq: false
    },
    wrapCounts: {},
    accessorErrors: {},
    passthroughDepth: 0,
    scanTimer: null
  };

  function safeString(value) {
    if (value === null || value === undefined) return "";
    return String(value).trim();
  }

  function isObject(value) {
    return value !== null && typeof value === "object";
  }

  function firstNonEmpty(values) {
    for (var i = 0; i < values.length; i += 1) {
      var value = safeString(values[i]);
      if (value) return value;
    }
    return "";
  }

  function log(label, payload, force) {
    if (!force && !CONFIG.debug) return;
    if (!w.console || typeof w.console.log !== "function") return;
    if (payload === undefined) {
      w.console.log(CONFIG.logPrefix, label);
      return;
    }
    w.console.log(CONFIG.logPrefix, label, payload);
  }

  function logWrap(label, payload) {
    state.wrapCounts[label] = (state.wrapCounts[label] || 0) + 1;
    if (state.wrapCounts[label] <= 3) log(label, payload);
  }

  function getUrlParam(name, sourceUrl) {
    try {
      return new URL(sourceUrl || w.location.href, w.location.origin).searchParams.get(name) || "";
    } catch (error) {
      return "";
    }
  }

  function extractOrderCode(value) {
    var text = safeString(value);
    var match = text.match(/(o[0-9]{8}[0-9A-Za-z_-]+)/);
    return match ? match[1] : "";
  }

  function readField(source, keys) {
    if (!isObject(source)) return "";
    for (var i = 0; i < keys.length; i += 1) {
      var value = source[keys[i]];
      if (safeString(value)) return safeString(value);
    }
    return "";
  }

  function normalizeEventName(eventName) {
    var name = safeString(eventName);
    if (name === "CompletePayment") return "Purchase";
    return name;
  }

  function extractEventId(params, options) {
    return firstNonEmpty([
      readField(params, ["event_id", "eventID", "eventId"]),
      readField(options, ["event_id", "eventID", "eventId"])
    ]);
  }

  function buildContext(source, eventName, params, options) {
    var href = safeString(w.location.href);
    var referrer = safeString(document.referrer);
    var safeParams = isObject(params) ? params : {};
    var safeOptions = isObject(options) ? options : {};
    var eventId = extractEventId(safeParams, safeOptions);
    var orderCode = firstNonEmpty([
      readField(safeParams, ["order_code", "orderCode"]),
      readField(safeOptions, ["order_code", "orderCode"]),
      getUrlParam("order_code", href),
      getUrlParam("orderCode", href),
      getUrlParam("order_code", referrer),
      extractOrderCode(eventId)
    ]);
    var orderNo = firstNonEmpty([
      readField(safeParams, ["order_no", "orderNo", "order_id", "orderId"]),
      readField(safeOptions, ["order_no", "orderNo", "order_id", "orderId"]),
      getUrlParam("order_no", href),
      getUrlParam("orderNo", href),
      getUrlParam("order_id", href),
      getUrlParam("orderId", href)
    ]);
    var paymentCode = firstNonEmpty([
      readField(safeParams, ["payment_code", "paymentCode"]),
      readField(safeOptions, ["payment_code", "paymentCode"]),
      getUrlParam("payment_code", href),
      getUrlParam("paymentCode", href)
    ]);
    var paymentKey = firstNonEmpty([
      readField(safeParams, ["payment_key", "paymentKey"]),
      readField(safeOptions, ["payment_key", "paymentKey"]),
      getUrlParam("payment_key", href),
      getUrlParam("paymentKey", href)
    ]);

    return {
      source: source,
      eventName: normalizeEventName(eventName),
      originalEventName: safeString(eventName),
      eventId: eventId || (orderCode ? "Purchase_" + orderCode : ""),
      orderCode: orderCode,
      orderNo: orderNo,
      paymentCode: paymentCode,
      paymentKey: paymentKey,
      value: readField(safeParams, ["value"]),
      currency: readField(safeParams, ["currency"]) || "KRW",
      url: href
    };
  }

  function buildSeenKey(context) {
    return [
      context.eventName,
      context.orderCode || "",
      context.orderNo || "",
      context.paymentCode || "",
      context.paymentKey ? "paymentKey" : "",
      context.orderCode ? "" : context.eventId
    ].join("|");
  }

  function hasLookupKey(context) {
    return Boolean(context.orderCode || context.orderNo || context.paymentCode || context.paymentKey);
  }

  function buildDecisionUrl(context) {
    var params = new URLSearchParams();
    if (context.orderCode) params.set("orderCode", context.orderCode);
    if (context.orderNo) params.set("orderNo", context.orderNo);
    if (context.paymentCode) params.set("paymentCode", context.paymentCode);
    if (context.paymentKey) params.set("paymentKey", context.paymentKey);
    params.set("store", CONFIG.store);
    params.set("debug", "0");
    return CONFIG.endpoint + "?" + params.toString();
  }

  function queryDecision(context) {
    if (!hasLookupKey(context)) {
      return Promise.resolve({
        ok: false,
        decision: {
          status: "unknown",
          browserAction: "hold_or_block_purchase",
          confidence: "none",
          matchedBy: "missing_lookup_keys",
          reason: "no order/payment keys found"
        }
      });
    }

    var controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timer = controller ? w.setTimeout(function () {
      controller.abort();
    }, CONFIG.timeoutMs) : null;

    return fetch(buildDecisionUrl(context), {
      method: "GET",
      cache: "no-store",
      credentials: "omit",
      signal: controller ? controller.signal : undefined
    }).then(function (response) {
      if (timer) w.clearTimeout(timer);
      if (!response.ok) throw new Error("HTTP " + response.status);
      return response.json();
    }).catch(function (error) {
      if (timer) w.clearTimeout(timer);
      return {
        ok: false,
        decision: {
          status: "unknown",
          browserAction: "hold_or_block_purchase",
          confidence: "none",
          matchedBy: "request_error",
          reason: error && error.message ? error.message : safeString(error)
        }
      };
    });
  }

  function copyForEventLog(value, depth) {
    if (depth > 2) return safeString(value);
    if (value === null || value === undefined) return value;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
    if (Array.isArray(value)) {
      return value.slice(0, 20).map(function (item) {
        return copyForEventLog(item, depth + 1);
      });
    }
    if (!isObject(value)) return safeString(value);

    var result = {};
    Object.keys(value).slice(0, 60).forEach(function (key) {
      result[key] = copyForEventLog(value[key], depth + 1);
    });
    return result;
  }

  function buildTrackingFields() {
    return {
      ttclid: getUrlParam("ttclid"),
      utm_source: getUrlParam("utm_source"),
      utm_medium: getUrlParam("utm_medium"),
      utm_campaign: getUrlParam("utm_campaign"),
      utm_content: getUrlParam("utm_content"),
      utm_term: getUrlParam("utm_term")
    };
  }

  function sendEventLog(action, context, body, params, options, replacementEventName) {
    if (!CONFIG.enableEventLog || !CONFIG.eventLogEndpoint) return;

    try {
      var decision = body && body.decision ? body.decision : {};
      var tracking = buildTrackingFields();
      var payload = {
        action: action,
        clientObservedAt: new Date().toISOString(),
        source: context.source,
        eventName: context.eventName,
        eventId: context.eventId,
        originalEventName: context.originalEventName,
        originalEventId: context.eventId,
        replacementEventName: replacementEventName || "",
        orderCode: context.orderCode,
        orderNo: context.orderNo,
        paymentCode: context.paymentCode,
        paymentKeyPresent: context.paymentKey ? "yes" : "no",
        value: context.value,
        currency: context.currency,
        status: decision.status || "unknown",
        browserAction: decision.browserAction || "unknown",
        matchedBy: decision.matchedBy || "unknown",
        reason: decision.reason || "",
        decision: copyForEventLog(decision, 0),
        params: copyForEventLog(params, 0),
        options: copyForEventLog(options, 0),
        url: context.url,
        referrer: safeString(document.referrer),
        ttclid: tracking.ttclid,
        utm_source: tracking.utm_source,
        utm_medium: tracking.utm_medium,
        utm_campaign: tracking.utm_campaign,
        utm_content: tracking.utm_content,
        utm_term: tracking.utm_term
      };
      var payloadJson = JSON.stringify(payload);
      var sent = false;
      if (w.navigator && typeof w.navigator.sendBeacon === "function" && typeof w.Blob === "function") {
        try {
          sent = w.navigator.sendBeacon(
            CONFIG.eventLogEndpoint,
            new w.Blob([payloadJson], { type: "application/json" })
          );
        } catch (error) {
          sent = false;
        }
      }
      if (!sent && typeof fetch === "function") {
        fetch(CONFIG.eventLogEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payloadJson,
          cache: "no-store",
          keepalive: true,
          credentials: "omit"
        }).catch(function () {
          /* ignore */
        });
      }
    } catch (error) {
      log("event_log_error", {
        action: action,
        message: error && error.message ? error.message : safeString(error)
      });
    }
  }

  function persist() {
    try {
      w.sessionStorage.setItem(CONFIG.storageKey, JSON.stringify(state.rows.slice(-CONFIG.maxRows)));
    } catch (error) {
      /* ignore */
    }
  }

  function record(phase, context, body) {
    var decision = body && body.decision ? body.decision : {};
    var row = {
      at: new Date().toISOString(),
      phase: phase,
      source: context.source,
      eventName: context.eventName,
      eventId: context.eventId,
      orderCode: context.orderCode,
      orderNo: context.orderNo,
      paymentCode: context.paymentCode,
      paymentKeyPresent: context.paymentKey ? "yes" : "no",
      value: context.value,
      currency: context.currency,
      status: decision.status || "unknown",
      browserAction: decision.browserAction || "unknown",
      confidence: decision.confidence || "unknown",
      matchedBy: decision.matchedBy || "unknown",
      reason: decision.reason || ""
    };
    state.rows.push(row);
    persist();
    log(phase, row, phase === "blocked_pending_purchase" || phase === "released_confirmed_purchase");
    return row;
  }

  function withPassthrough(fn) {
    state.passthroughDepth += 1;
    try {
      return fn();
    } finally {
      state.passthroughDepth -= 1;
    }
  }

  function makeReplacementParams(params, context) {
    var sourceParams = isObject(params) ? params : {};
    var nextParams = {};
    Object.keys(sourceParams).forEach(function (key) {
      nextParams[key] = sourceParams[key];
    });
    nextParams.event_id = "PlaceAnOrder_" + (context.orderCode || extractOrderCode(context.eventId) || context.eventId || "unknown");
    nextParams.order_code = context.orderCode;
    nextParams.order_no = context.orderNo;
    nextParams.payment_code = context.paymentCode;
    nextParams.payment_status = "pending";
    nextParams.original_event_name = context.eventName;
    nextParams.original_event_id = context.eventId;
    return nextParams;
  }

  function shouldBlock(decision) {
    return decision && (
      decision.browserAction === "block_purchase_virtual_account" ||
      decision.browserAction === "block_purchase"
    );
  }

  function shouldRelease(decision) {
    if (!decision) return CONFIG.allowOnUnknown;
    if (decision.browserAction === "allow_purchase") return true;
    if (shouldBlock(decision)) return false;
    return CONFIG.allowOnUnknown;
  }

  function handlePurchase(source, eventName, params, options, invokeOriginal, invokeReplacement) {
    if (normalizeEventName(eventName) !== "Purchase") return invokeOriginal();
    if (state.passthroughDepth > 0) return invokeOriginal();

    var context = buildContext(source, eventName, params, options);
    var key = buildSeenKey(context);
    if (state.seen[key]) {
      log("duplicate_purchase_attempt_held", {
        source: source,
        eventId: context.eventId,
        orderCode: context.orderCode
      });
      return undefined;
    }
    state.seen[key] = true;

    log("purchase_intercepted", {
      source: source,
      eventId: context.eventId,
      orderCode: context.orderCode,
      orderNo: context.orderNo,
      paymentCode: context.paymentCode,
      hasPaymentKey: Boolean(context.paymentKey)
    }, true);
    sendEventLog("purchase_intercepted", context, null, params, options);

    queryDecision(context).then(function (body) {
      var decision = body && body.decision ? body.decision : {};
      record("decision_received", context, body);
      sendEventLog("decision_received", context, body, params, options);

      if (shouldRelease(decision)) {
        withPassthrough(invokeOriginal);
        record(decision.browserAction === "allow_purchase" ? "released_confirmed_purchase" : "released_unknown_purchase", context, body);
        sendEventLog(
          decision.browserAction === "allow_purchase" ? "released_confirmed_purchase" : "released_unknown_purchase",
          context,
          body,
          params,
          options
        );
        return;
      }

      record("blocked_pending_purchase", context, body);
      sendEventLog("blocked_pending_purchase", context, body, params, options);
      if (
        CONFIG.sendReplacementForPending &&
        decision.browserAction === "block_purchase_virtual_account" &&
        typeof invokeReplacement === "function"
      ) {
        withPassthrough(function () {
          invokeReplacement(CONFIG.replacementEventName, makeReplacementParams(params, context));
        });
        record("sent_replacement_place_an_order", context, body);
        sendEventLog("sent_replacement_place_an_order", context, body, params, options, CONFIG.replacementEventName);
      }
    });

    return undefined;
  }

  function wrapTrack(owner, ownerName, stateKey) {
    if (!owner || typeof owner.track !== "function") return false;
    if (owner.track[WRAP_KEY] === VERSION) {
      state.wrappers[stateKey] = true;
      return true;
    }

    var originalTrack = owner.track[RAW_KEY] || owner.track;
    var guardedTrack = function (eventName, params, options) {
      var self = this;
      var args = arguments;
      return handlePurchase(
        ownerName + ".track",
        eventName,
        params,
        options,
        function () {
          return originalTrack.apply(self, args);
        },
        function (replacementEventName, replacementParams) {
          return originalTrack.call(self, replacementEventName, replacementParams, options);
        }
      );
    };
    guardedTrack[WRAP_KEY] = VERSION;
    guardedTrack[RAW_KEY] = originalTrack;

    try {
      owner.track = guardedTrack;
    } catch (error) {
      return false;
    }

    state.wrappers[stateKey] = true;
    logWrap("wrapped_" + ownerName + "_track", { version: VERSION });
    return true;
  }

  function wrapTiktokPixelInit(pixel) {
    if (!pixel || typeof pixel.init !== "function") return false;
    if (pixel.init[WRAP_KEY] === VERSION) {
      state.wrappers.tiktokPixelInit = true;
      return true;
    }

    var originalInit = pixel.init[RAW_KEY] || pixel.init;
    var guardedInit = function () {
      var result = originalInit.apply(this, arguments);
      wrapTtq();
      wrapTiktokPixel();
      return result;
    };
    guardedInit[WRAP_KEY] = VERSION;
    guardedInit[RAW_KEY] = originalInit;

    try {
      pixel.init = guardedInit;
    } catch (error) {
      return false;
    }

    state.wrappers.tiktokPixelInit = true;
    logWrap("wrapped_TIKTOK_PIXEL_init", { version: VERSION });
    return true;
  }

  function wrapTiktokPixel() {
    var pixel = activeTiktokPixel || w.TIKTOK_PIXEL;
    var initWrapped = wrapTiktokPixelInit(pixel);
    var trackWrapped = wrapTrack(pixel, "TIKTOK_PIXEL", "tiktokPixelTrack");
    return Boolean(initWrapped || trackWrapped);
  }

  function wrapTtq() {
    var ttq = activeTtq || w.ttq;
    return wrapTrack(ttq, "ttq", "ttqTrack");
  }

  function installAccessor(name, getActive, setActive, afterSet) {
    try {
      var descriptor = Object.getOwnPropertyDescriptor(w, name);
      if (descriptor && descriptor.get && descriptor.get[ACCESSOR_KEY] === VERSION) {
        state.accessors[name] = true;
        return true;
      }
      if (descriptor && descriptor.configurable === false) {
        state.accessorErrors[name] = "non_configurable";
        return false;
      }
      if (descriptor && Object.prototype.hasOwnProperty.call(descriptor, "value")) {
        setActive(descriptor.value);
      }

      var getter = function () {
        return getActive();
      };
      var setter = function (nextValue) {
        setActive(nextValue);
        afterSet(nextValue);
      };
      getter[ACCESSOR_KEY] = VERSION;
      setter[ACCESSOR_KEY] = VERSION;

      Object.defineProperty(w, name, {
        configurable: true,
        enumerable: true,
        get: getter,
        set: setter
      });

      state.accessors[name] = true;
      afterSet(getActive());
      log("accessor_installed_" + name, { version: VERSION });
      return true;
    } catch (error) {
      state.accessorErrors[name] = error && error.message ? error.message : safeString(error);
      return false;
    }
  }

  function installAccessors() {
    installAccessor(
      "TIKTOK_PIXEL",
      function () { return activeTiktokPixel; },
      function (nextValue) { activeTiktokPixel = nextValue; },
      function () { wrapTiktokPixel(); }
    );
    installAccessor(
      "ttq",
      function () { return activeTtq; },
      function (nextValue) { activeTtq = nextValue; },
      function () { wrapTtq(); }
    );
  }

  function scanOnce() {
    wrapTiktokPixel();
    wrapTtq();
  }

  function startScan() {
    var startedAt = Date.now();
    if (state.scanTimer) w.clearInterval(state.scanTimer);

    state.scanTimer = w.setInterval(function () {
      scanOnce();
      if (Date.now() - startedAt > CONFIG.scanLimitMs) {
        w.clearInterval(state.scanTimer);
        state.scanTimer = null;
        log("scan_complete", {
          version: VERSION,
          wrappers: state.wrappers,
          accessors: state.accessors,
          wrapCounts: state.wrapCounts,
          accessorErrors: state.accessorErrors
        });
      }
    }, CONFIG.scanIntervalMs);
  }

  w[GUARD_KEY] = {
    version: VERSION,
    config: CONFIG,
    state: state,
    scanOnce: scanOnce,
    getDecisions: function () {
      return state.rows.slice();
    },
    clearDecisions: function () {
      state.rows = [];
      state.seen = {};
      try {
        w.sessionStorage.removeItem(CONFIG.storageKey);
      } catch (error) {
        /* ignore */
      }
    }
  };

  installAccessors();
  scanOnce();
  startScan();
  w.setTimeout(scanOnce, 0);
  w.setTimeout(scanOnce, 250);
  w.setTimeout(scanOnce, 1000);
  if (document && document.addEventListener) {
    document.addEventListener("DOMContentLoaded", scanOnce);
  }
  if (w.addEventListener) {
    w.addEventListener("load", scanOnce);
  }

  log("installed", {
    version: VERSION,
    scanLimitMs: CONFIG.scanLimitMs,
    sendReplacementForPending: CONFIG.sendReplacementForPending,
    allowOnUnknown: CONFIG.allowOnUnknown
  }, true);
})(window);
</script>


<!-- Google Tag Manager - Biocom Canonical -->
<script>
(function(w,d,s,l,i){
  w[l]=w[l]||[];
  w[l].push({'gtm.start': new Date().getTime(), event:'gtm.js'});
  var f=d.getElementsByTagName(s)[0],
      j=d.createElement(s),
      dl=l!='dataLayer' ? '&l='+l : '';
  j.async=true;
  j.src='https://www.googletagmanager.com/gtm.js?id=' + i + dl;
  f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-W2Z6PHN');
</script>
<!-- End Google Tag Manager -->

<meta name="google-site-verification" content="2WXkGfS6Eymkc3PoDgYL-iNliiOLYErwuZHnJAaNgK0" />

<script type="text/javascript">
(function(w, d, a){
  w.__beusablerumclient__ = {
    load : function(src){
      var b = d.createElement("script");
      b.src = src;
      b.async = true;
      b.type = "text/javascript";
      d.getElementsByTagName("head")[0].appendChild(b);
    }
  };
  w.__beusablerumclient__.load(a + "?url=" + encodeURIComponent(d.URL));
})(window, document, "//rum.beusable.net/load/b230307e145743u179");
</script>


<!-- TikTok Catalog 보완 코드 -->
<script>
(function() {
  if (!/[?&]idx=/.test(location.search)) return;

  var EXCLUDE = ['택배배송비'];

  function fire() {
    if (typeof ttq === 'undefined') return false;

    var name = (document.querySelector('h1') || {}).textContent || '';
    name = name.trim();
    if (!name) return false;

    for (var i = 0; i < EXCLUDE.length; i++) {
      if (name.indexOf(EXCLUDE[i]) !== -1) {
        console.log('[TikTok Catalog] 제외:', name);
        return true;
      }
    }

    var meta = function(p) {
      var el = document.querySelector('meta[property="' + p + '"]');
      return el ? el.content : '';
    };
    var priceEl = document.querySelector('.real_price');
    var price = priceEl ? Number(priceEl.textContent.replace(/[^0-9]/g, '')) : 0;

    ttq.track('ViewContent', {
      content_id:   (location.search.match(/idx=(\d+)/) || [])[1] || '',
      content_type: 'product',
      content_name: name,
      description:  meta('og:description') || name,
      image_url:    meta('og:image'),
      price:        price,
      currency:     'KRW',
      value:        price,
      availability: 'in stock',
      product_url:  location.href
    });
    console.log('[TikTok Catalog] ViewContent 전송:', name);
    return true;
  }

  // DOM 로드 후 ttq 준비되면 실행
  function onReady() {
    var timer = setInterval(function() {
      if (fire()) clearInterval(timer);
    }, 200);
    setTimeout(function() { clearInterval(timer); }, 10000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onReady);
  } else {
    onReady();
  }
})();
</script>



<바디 코드>
<!-- Uneedcomms Keepgrow Script -->
<script id="kg-service-init" data-hosting="imweb" src="//storage.keepgrow.com/admin/keepgrow-service/keepgrow-service_c4342055-4ab1-4952-8732-bb8edeab9912.js"></script>
<!-- Uneedcomms Keepgrow Script -->


<!-- Google Tag Manager (noscript) -->
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-W2Z6PHN"
height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
<!-- End Google Tag Manager (noscript) -->



<푸터 코드>
<script>
/* ── Block 1: UTM persistence + Google click-id preservation v4.2 ──
   Purpose:
   - Preserve gclid / gbraid / wbraid captured by the Header Bootstrap.
   - Prevent _p1s1a_last_touch from overwriting Google click IDs with empty values.
   - No ad conversion firing.
   - No network send.
   Version: 2026-05-21-biocom-footer-block1-click-id-v4-2
*/
(function () {
  var CONFIG = {
    debugQueryKey: '__seo_attribution_debug',
    gtagRetryMs: 100,
    gtagMaxWaitMs: 5000,
    legacyUtmKey: '_p1s1a_session_touch',
    firstTouchKey: '_p1s1a_first_touch',
    latestTouchKey: '_p1s1a_last_touch',
    clickContextKey: '__biocom_click_id_context_v1',
    snippetVersion: '2026-05-21-biocom-footer-block1-click-id-v4-2',
    googleClickIdGuardVersion: 'v4.4.3'
  };

  function trim(value) {
    if (value == null) return '';
    return String(value).trim();
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

  function isDebugMode() {
    try {
      return new URLSearchParams(location.search).get(CONFIG.debugQueryKey) === '1';
    } catch (error) {
      return false;
    }
  }

  function debugLog() {
    if (!isDebugMode()) return;
    try {
      console.log.apply(console, ['[seo-user-utm-v4]'].concat([].slice.call(arguments)));
    } catch (error) {}
  }

  function safeParse(raw) {
    if (!raw) return {};
    try {
      var parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch (error) {
      return {};
    }
  }

  function readJson(key) {
    try {
      return safeParse(window.localStorage && window.localStorage.getItem(key));
    } catch (error) {
      return {};
    }
  }

  function writeJson(key, value) {
    try {
      if (!window.localStorage) return;
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {}
  }

  function getUserID() {
    try {
      var formbricksStr = window.localStorage && window.localStorage.getItem('formbricks-js');
      if (!formbricksStr) return '';
      var formbricks = JSON.parse(formbricksStr);
      return trim(formbricks && formbricks.personState && formbricks.personState.data && formbricks.personState.data.userId);
    } catch (error) {
      return '';
    }
  }

  function getParam(name) {
    try {
      return trim(new URLSearchParams(location.search).get(name));
    } catch (error) {
      return '';
    }
  }

  function collectTrackingParams() {
    return {
      utm_campaign: getParam('utm_campaign'),
      utm_source: getParam('utm_source'),
      utm_medium: getParam('utm_medium'),
      utm_content: getParam('utm_content'),
      utm_term: getParam('utm_term'),

      gclid: getParam('gclid'),
      gbraid: getParam('gbraid'),
      wbraid: getParam('wbraid'),
      fbclid: getParam('fbclid'),
      ttclid: getParam('ttclid'),

      landing: location.href,
      referrer: document.referrer || '',
      ts: Date.now()
    };
  }

  function hasRealTrackingValue(tracking) {
    return Boolean(
      trim(tracking.utm_campaign) ||
      trim(tracking.utm_source) ||
      trim(tracking.utm_medium) ||
      trim(tracking.utm_content) ||
      trim(tracking.utm_term) ||
      trim(tracking.gclid) ||
      trim(tracking.gbraid) ||
      trim(tracking.wbraid) ||
      trim(tracking.fbclid) ||
      trim(tracking.ttclid)
    );
  }

  function attachUserIdToExistingTouches(userId) {
    if (!userId) return;

    [CONFIG.legacyUtmKey, CONFIG.firstTouchKey, CONFIG.latestTouchKey].forEach(function (key) {
      var current = readJson(key);
      if (!Object.keys(current).length) return;
      if (current.user_id === userId) return;

      current.user_id = userId;
      current.user_id_updated_at = Date.now();

      writeJson(key, current);
    });
  }

  function mergeTouch(previous, incoming, options) {
    previous = previous && typeof previous === 'object' ? previous : {};
    incoming = incoming && typeof incoming === 'object' ? incoming : {};
    options = options || {};

    var preferIncomingUtm = options.preferIncomingUtm !== false;
    var preserveOriginalLanding = !!options.preserveOriginalLanding;
    var selectedGoogleClickSet = selectGoogleClickSet([
      googleClickSetFrom(incoming, 'incoming'),
      googleClickSetFrom(previous, 'previous')
    ]);

    return {
      utm_campaign: preferIncomingUtm
        ? firstNonEmpty([incoming.utm_campaign, previous.utm_campaign])
        : firstNonEmpty([previous.utm_campaign, incoming.utm_campaign]),

      utm_source: preferIncomingUtm
        ? firstNonEmpty([incoming.utm_source, previous.utm_source])
        : firstNonEmpty([previous.utm_source, incoming.utm_source]),

      utm_medium: preferIncomingUtm
        ? firstNonEmpty([incoming.utm_medium, previous.utm_medium])
        : firstNonEmpty([previous.utm_medium, incoming.utm_medium]),

      utm_content: preferIncomingUtm
        ? firstNonEmpty([incoming.utm_content, previous.utm_content])
        : firstNonEmpty([previous.utm_content, incoming.utm_content]),

      utm_term: preferIncomingUtm
        ? firstNonEmpty([incoming.utm_term, previous.utm_term])
        : firstNonEmpty([previous.utm_term, incoming.utm_term]),

      /*
        v4.4.3:
        Keep Google click IDs coherent. Do not mix gclid/gbraid/wbraid across sources.
      */
      gclid: selectedGoogleClickSet.gclid,
      gbraid: selectedGoogleClickSet.gbraid,
      wbraid: selectedGoogleClickSet.wbraid,
      google_click_id_source: selectedGoogleClickSet.source,
      google_click_id_guard_version: CONFIG.googleClickIdGuardVersion,

      fbclid: firstNonEmpty([incoming.fbclid, previous.fbclid]),
      ttclid: firstNonEmpty([incoming.ttclid, previous.ttclid]),

      fbc: firstNonEmpty([incoming.fbc, previous.fbc]),
      fbp: firstNonEmpty([incoming.fbp, previous.fbp]),

      landing: preserveOriginalLanding
        ? firstNonEmpty([previous.landing, incoming.landing, location.href])
        : firstNonEmpty([incoming.landing, previous.landing, location.href]),

      referrer: preserveOriginalLanding
        ? firstNonEmpty([previous.referrer, incoming.referrer, document.referrer || ''])
        : firstNonEmpty([incoming.referrer, previous.referrer, document.referrer || '']),

      user_id: firstNonEmpty([incoming.user_id, previous.user_id]),
      user_id_updated_at: incoming.user_id_updated_at || previous.user_id_updated_at || '',

      ts: incoming.ts || previous.ts || Date.now(),
      persisted_at: incoming.persisted_at || previous.persisted_at || new Date().toISOString(),

      click_context_version: firstNonEmpty([incoming.click_context_version, previous.click_context_version]),
      snippet_version: CONFIG.snippetVersion
    };
  }

  function enrichWithClickContext(tracking) {
    var clickContext = readJson(CONFIG.clickContextKey);

    /*
      previous = clickContext
      incoming = tracking

      결과:
      - URL에 새 gclid/gbraid/wbraid가 있으면 새 값 사용
      - URL에 없으면 Header Bootstrap이 저장한 값 사용
    */
    return mergeTouch(clickContext, tracking, {
      preferIncomingUtm: true,
      preserveOriginalLanding: false
    });
  }

  function persistUtm() {
    var userId = getUserID();
    var tracking = collectTrackingParams();

    tracking.user_id = userId || '';
    tracking.user_id_updated_at = userId ? Date.now() : '';
    tracking.persisted_at = new Date().toISOString();
    tracking.click_context_version = trim(readJson(CONFIG.clickContextKey).snippet_version);

    attachUserIdToExistingTouches(userId);

    var enriched = enrichWithClickContext(tracking);

    if (!hasRealTrackingValue(enriched)) {
      debugLog('skip persist: no tracking params');
      return;
    }

    var previousFirst = readJson(CONFIG.firstTouchKey);
    var previousLatest = readJson(CONFIG.latestTouchKey);
    var previousSession = readJson(CONFIG.legacyUtmKey);

    /*
      first_touch:
      - 첫 유입의 UTM 정체성은 유지
      - 단, 기존 first_touch에 click id가 비어 있고 현재 click id가 있으면 보강
    */
    if (!Object.keys(previousFirst).length) {
      writeJson(CONFIG.firstTouchKey, mergeTouch({}, enriched, {
        preferIncomingUtm: true,
        preserveOriginalLanding: true
      }));
    } else {
      writeJson(CONFIG.firstTouchKey, mergeTouch(previousFirst, enriched, {
        preferIncomingUtm: false,
        preserveOriginalLanding: true
      }));
    }

    /*
      last_touch:
      - 최신 UTM은 반영
      - click id는 빈 값으로 지우지 않음
    */
    writeJson(CONFIG.latestTouchKey, mergeTouch(previousLatest, enriched, {
      preferIncomingUtm: true,
      preserveOriginalLanding: false
    }));

    /*
      session_touch:
      - 현재 세션용
      - click id는 빈 값으로 지우지 않음
    */
    writeJson(CONFIG.legacyUtmKey, mergeTouch(previousSession, enriched, {
      preferIncomingUtm: true,
      preserveOriginalLanding: false
    }));

    debugLog('tracking persisted', {
      has_gclid: Boolean(enriched.gclid),
      has_gbraid: Boolean(enriched.gbraid),
      has_wbraid: Boolean(enriched.wbraid),
      has_fbclid: Boolean(enriched.fbclid),
      has_ttclid: Boolean(enriched.ttclid),
      utm_source: enriched.utm_source,
      utm_medium: enriched.utm_medium
    });
  }

  function waitForGtag(callback) {
    var startedAt = Date.now();

    function tick() {
      if (typeof window.gtag === 'function') {
        callback();
        return;
      }

      if (Date.now() - startedAt >= CONFIG.gtagMaxWaitMs) {
        debugLog('gtag wait timeout');
        return;
      }

      window.setTimeout(tick, CONFIG.gtagRetryMs);
    }

    tick();
  }

  function setGtagUserId() {
    waitForGtag(function () {
      var userId = getUserID();
      if (!userId) return;

      window.gtag('set', { user_id: userId });

      /*
        raw user_id는 console에 찍지 않는다.
      */
      debugLog('gtag user_id set', { has_user_id: true });
    });
  }

  persistUtm();
  setGtagUserId();
})();


/* ── Block 2: checkout_started 이벤트 + Google click-id checkout context v4.3 ──
   Purpose:
   - Preserve gclid / gbraid / wbraid from Header Bootstrap + Footer Block 1.
   - Store click IDs into __seo_checkout_context before NPay/payment redirect.
   - Keep server payload backward-compatible: do NOT add top-level gbraid/wbraid yet.
   - No Google Ads conversion upload.
   - No new ad conversion firing.
   Version: 2026-05-21-biocom-checkout-started-click-id-v4-3
*/
(function () {
  var CONFIG = {
    endpoint: 'https://att.ainativeos.net/api/attribution/checkout-context',
    source: 'biocom_imweb',
    measurementIds: ['G-WJFXN5E2Q1'],
    snippetVersion: '2026-05-21-biocom-checkout-started-click-id-v4-3',
    googleClickIdGuardVersion: 'v4.4.3',
    requestTimeoutMs: 800,
    debugQueryKey: '__seo_attribution_debug',
    checkoutIdKey: '__seo_checkout_id',
    checkoutContextKey: '__seo_checkout_context',
    clickContextKey: '__biocom_click_id_context_v1',
    dedupeKeyPrefix: '__seo_checkout_started_sent__:'
  };

  function trim(value) {
    if (value == null) return '';
    return String(value).trim();
  }

  function firstNonEmpty(values) {
    for (var i = 0; i < values.length; i += 1) {
      var value = trim(values[i]);
      if (value) return value;
    }
    return '';
  }

  function safeParse(raw) {
    if (!raw) return {};
    try {
      var parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch (error) {
      return {};
    }
  }

  function readJsonStorage(storage, key) {
    try {
      if (!storage) return {};
      return safeParse(storage.getItem(key));
    } catch (error) {
      return {};
    }
  }

  function writeJsonStorage(storage, key, value) {
    try {
      if (!storage) return;
      storage.setItem(key, JSON.stringify(value));
    } catch (error) {}
  }

  function readDataLayerValue(keys) {
    if (!Array.isArray(window.dataLayer)) return '';
    for (var i = window.dataLayer.length - 1; i >= 0; i -= 1) {
      var item = window.dataLayer[i];
      if (!item || typeof item !== 'object' || Array.isArray(item)) continue;

      for (var j = 0; j < keys.length; j += 1) {
        var key = keys[j];
        var value = trim(item[key]);
        if (value) return value;
      }
    }
    return '';
  }

  function readCookie(name) {
    try {
      var pattern = new RegExp('(?:^|; )' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '=([^;]*)');
      var match = document.cookie.match(pattern);
      return match ? decodeURIComponent(match[1]) : '';
    } catch (error) {
      return '';
    }
  }

  function parseClientIdFromGaCookie(cookieValue) {
    if (!cookieValue) return '';
    var parts = cookieValue.split('.');
    if (parts.length >= 4) return parts.slice(-2).join('.');
    return '';
  }

  function parseSessionIdFromGaCookie(cookieValue) {
    if (!cookieValue) return '';

    if (cookieValue.indexOf('GS1.') === 0) {
      var gs1 = cookieValue.split('.');
      return trim(gs1[2]);
    }

    if (cookieValue.indexOf('GS2.') === 0) {
      var body = cookieValue.split('.').slice(2).join('.');
      var chunks = body.split('$');

      for (var i = 0; i < chunks.length; i += 1) {
        if (chunks[i].indexOf('s') === 0) return trim(chunks[i].slice(1));
      }
    }

    return '';
  }

  function getMeasurementCookieName(measurementId) {
    return '_ga_' + trim(measurementId).replace(/^G-/, '');
  }

  function getGtagValue(fieldName) {
    return new Promise(function (resolve) {
      if (typeof window.gtag !== 'function' || !CONFIG.measurementIds.length) {
        resolve('');
        return;
      }

      var settled = false;
      var pending = CONFIG.measurementIds.length;

      var timer = setTimeout(function () {
        if (!settled) {
          settled = true;
          resolve('');
        }
      }, CONFIG.requestTimeoutMs);

      function finish(value) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(trim(value));
      }

      function markPendingDone() {
        pending -= 1;
        if (pending <= 0) finish('');
      }

      CONFIG.measurementIds.forEach(function (measurementId) {
        try {
          window.gtag('get', measurementId, fieldName, function (value) {
            var normalized = trim(value);
            if (normalized) {
              finish(normalized);
              return;
            }
            markPendingDone();
          });
        } catch (error) {
          markPendingDone();
        }
      });
    });
  }

  function getSearchParam(keys) {
    try {
      var params = new URLSearchParams(location.search);

      for (var i = 0; i < keys.length; i += 1) {
        var value = trim(params.get(keys[i]));
        if (value) return value;
      }

      return '';
    } catch (error) {
      return '';
    }
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

  function googleClickSetFromUrl(urlLike, sourceName) {
    try {
      if (!urlLike) return googleClickSetFrom({}, sourceName);
      var params = new URL(urlLike, location.origin).searchParams;
      return googleClickSetFrom({
        gclid: params.get('gclid'),
        gbraid: params.get('gbraid'),
        wbraid: params.get('wbraid')
      }, sourceName);
    } catch (error) {
      return googleClickSetFrom({}, sourceName);
    }
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

  function mergeLandingParams(base, urlLike) {
    try {
      if (!urlLike) return base;

      var params = new URL(urlLike, location.origin).searchParams;

      return {
        utm_source: firstNonEmpty([base.utm_source, params.get('utm_source')]),
        utm_medium: firstNonEmpty([base.utm_medium, params.get('utm_medium')]),
        utm_campaign: firstNonEmpty([base.utm_campaign, params.get('utm_campaign')]),
        utm_content: firstNonEmpty([base.utm_content, params.get('utm_content')]),
        utm_term: firstNonEmpty([base.utm_term, params.get('utm_term')]),

        /*
          v4.4.3:
          Google click IDs are selected atomically outside this generic landing merge.
        */
        gclid: base.gclid,
        gbraid: base.gbraid,
        wbraid: base.wbraid,

        fbclid: firstNonEmpty([base.fbclid, params.get('fbclid')]),
        ttclid: firstNonEmpty([base.ttclid, params.get('ttclid')]),

        fbc: firstNonEmpty([base.fbc, params.get('fbc')]),
        fbp: firstNonEmpty([base.fbp, params.get('fbp')])
      };
    } catch (error) {
      return base;
    }
  }

  function isDebugMode() {
    try {
      return new URLSearchParams(location.search).get(CONFIG.debugQueryKey) === '1';
    } catch (error) {
      return false;
    }
  }

  function debugLog() {
    if (!isDebugMode()) return;

    try {
      console.log.apply(console, ['[seo-checkout-started-v4.3]'].concat([].slice.call(arguments)));
    } catch (error) {}
  }

  function hasSentMarker(key) {
    try {
      return Boolean(window.sessionStorage && window.sessionStorage.getItem(key));
    } catch (error) {
      return false;
    }
  }

  function rememberSent(key) {
    try {
      if (!window.sessionStorage) return;
      window.sessionStorage.setItem(key, new Date().toISOString());
    } catch (error) {}
  }

  function getOrCreateCheckoutId() {
    try {
      var existing = trim(window.sessionStorage && window.sessionStorage.getItem(CONFIG.checkoutIdKey));
      if (existing) return existing;

      var created = 'chk_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);

      if (window.sessionStorage) {
        window.sessionStorage.setItem(CONFIG.checkoutIdKey, created);
      }

      return created;
    } catch (error) {
      return 'chk_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
    }
  }

  function isCheckoutCandidate() {
    var href = location.href;
    var path = location.pathname;

    if (/shop_payment_complete|shop_order_done|order_complete|payment_complete/i.test(href)) {
      return false;
    }

    return /shop_order|shop_payment|order_form|checkout/i.test(path + ' ' + href);
  }

  function sendPayload(payload) {
    return fetch(CONFIG.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
      credentials: 'omit',
      mode: 'cors'
    }).then(function (response) {
      if (!response.ok) {
        throw new Error('checkout-context failed with ' + response.status);
      }

      return {
        sentBy: 'fetch',
        accepted: true,
        status: response.status
      };
    });
  }

  function getGoogleClickIdType(tracking) {
    if (trim(tracking.gclid)) return 'gclid';
    if (trim(tracking.gbraid)) return 'gbraid';
    if (trim(tracking.wbraid)) return 'wbraid';
    return 'none';
  }

  function hasGoogleClickId(tracking) {
    return Boolean(trim(tracking.gclid) || trim(tracking.gbraid) || trim(tracking.wbraid));
  }

  if (!isCheckoutCandidate()) return;

  var imwebSession = readJsonStorage(window.sessionStorage, '__bs_imweb_session');
  var lastTouch = readJsonStorage(window.localStorage, '_p1s1a_last_touch');
  var clickContext = readJsonStorage(window.localStorage, CONFIG.clickContextKey);

  var checkoutId = getOrCreateCheckoutId();
  var landing = location.href;

  var initialReferrer = firstNonEmpty([
    trim(imwebSession.initialReferrer),
    trim(lastTouch.referrer),
    document.referrer || ''
  ]);

  var selectedGoogleClickSet = selectGoogleClickSet([
    googleClickSetFromUrl(location.href, 'current_url'),
    googleClickSetFromUrl(document.referrer, 'document_referrer'),
    googleClickSetFrom(clickContext, 'header_click_context'),
    googleClickSetFrom(lastTouch, 'last_touch'),
    googleClickSetFrom({
      gclid: imwebSession.gclid,
      gbraid: imwebSession.gbraid,
      wbraid: imwebSession.wbraid
    }, 'imweb_session')
  ]);

  var tracking = mergeLandingParams({
    utm_source: firstNonEmpty([
      trim(imwebSession.utmSource),
      trim(lastTouch.utm_source),
      trim(clickContext.utm_source),
      getSearchParam(['utm_source'])
    ]),
    utm_medium: firstNonEmpty([
      trim(imwebSession.utmMedium),
      trim(lastTouch.utm_medium),
      trim(clickContext.utm_medium),
      getSearchParam(['utm_medium'])
    ]),
    utm_campaign: firstNonEmpty([
      trim(imwebSession.utmCampaign),
      trim(lastTouch.utm_campaign),
      trim(clickContext.utm_campaign),
      getSearchParam(['utm_campaign'])
    ]),
    utm_content: firstNonEmpty([
      trim(imwebSession.utmContent),
      trim(lastTouch.utm_content),
      trim(clickContext.utm_content),
      getSearchParam(['utm_content'])
    ]),
    utm_term: firstNonEmpty([
      trim(imwebSession.utmTerm),
      trim(lastTouch.utm_term),
      trim(clickContext.utm_term),
      getSearchParam(['utm_term'])
    ]),

    /*
      v4.4.3:
      Google click IDs are selected as one coherent set.
      Fresh gclid/gbraid must not inherit stale wbraid from older storage.
    */
    gclid: selectedGoogleClickSet.gclid,
    gbraid: selectedGoogleClickSet.gbraid,
    wbraid: selectedGoogleClickSet.wbraid,

    fbclid: firstNonEmpty([
      getSearchParam(['fbclid']),
      trim(clickContext.fbclid),
      trim(lastTouch.fbclid),
      trim(imwebSession.fbclid)
    ]),
    ttclid: firstNonEmpty([
      getSearchParam(['ttclid']),
      trim(clickContext.ttclid),
      trim(lastTouch.ttclid),
      trim(imwebSession.ttclid)
    ]),

    fbc: firstNonEmpty([
      trim(lastTouch.fbc),
      readCookie('_fbc'),
      getSearchParam(['fbc'])
    ]),
    fbp: firstNonEmpty([
      trim(lastTouch.fbp),
      readCookie('_fbp'),
      getSearchParam(['fbp'])
    ])
  }, landing);

  var dedupeKey = CONFIG.dedupeKeyPrefix + checkoutId;

  Promise.all([
    Promise.resolve(firstNonEmpty([
      readDataLayerValue(['ga_session_id', 'gaSessionId']),
      trim(lastTouch.ga_session_id),
      trim(imwebSession.ga_session_id)
    ])).then(function (value) {
      if (value) return value;

      return getGtagValue('session_id').then(function (gtagValue) {
        if (gtagValue) return gtagValue;

        for (var i = 0; i < CONFIG.measurementIds.length; i += 1) {
          var cookieValue = readCookie(getMeasurementCookieName(CONFIG.measurementIds[i]));
          var parsed = parseSessionIdFromGaCookie(cookieValue);
          if (parsed) return parsed;
        }

        return '';
      });
    }),

    Promise.resolve(firstNonEmpty([
      readDataLayerValue(['client_id', 'clientId', 'ga_client_id', 'gaClientId']),
      trim(lastTouch.client_id),
      trim(imwebSession.client_id)
    ])).then(function (value) {
      if (value) return value;

      return getGtagValue('client_id').then(function (gtagValue) {
        if (gtagValue) return gtagValue;
        return parseClientIdFromGaCookie(readCookie('_ga'));
      });
    })
  ]).then(function (identity) {
    var gaSessionId = trim(identity[0]);
    var clientId = trim(identity[1]);

    var userPseudoId = firstNonEmpty([
      readDataLayerValue(['user_pseudo_id', 'userPseudoId', 'ga_user_pseudo_id', 'gaUserPseudoId']),
      trim(lastTouch.user_pseudo_id),
      trim(imwebSession.user_pseudo_id),
      clientId
    ]);

    var customerKey = firstNonEmpty([
      trim(lastTouch.customerKey),
      trim(imwebSession.customerKey),
      trim(imwebSession.memberId),
      trim(imwebSession.member_id)
    ]);

    var observedAt = new Date().toISOString();
    var googleClickIdType = getGoogleClickIdType(tracking);
    var googleClickIdPresent = hasGoogleClickId(tracking);

    /*
      Server payload stays backward-compatible.
      - Top-level gclid already existed.
      - Do NOT add top-level gbraid/wbraid until backend contract is confirmed.
      - Presence-only metadata is safe and does not expose raw gbraid/wbraid.
    */
    var payload = {
      touchpoint: 'checkout_started',
      captureMode: 'live',
      source: CONFIG.source,
      checkoutId: checkoutId,
      customerKey: customerKey,
      clientObservedAt: observedAt,
      landing: landing,
      referrer: document.referrer || '',
      ga_session_id: gaSessionId,
      client_id: clientId,
      user_pseudo_id: userPseudoId,

      utm_source: tracking.utm_source,
      utm_medium: tracking.utm_medium,
      utm_campaign: tracking.utm_campaign,
      utm_content: tracking.utm_content,
      utm_term: tracking.utm_term,

      gclid: tracking.gclid,
      fbclid: tracking.fbclid,
      ttclid: tracking.ttclid,
      fbc: tracking.fbc,
      fbp: tracking.fbp,

      metadata: {
        snippetVersion: CONFIG.snippetVersion,
        ga_measurement_ids: CONFIG.measurementIds,
        fbc: tracking.fbc,
        fbp: tracking.fbp,
        checkoutTrigger: 'pageview',
        checkoutUrl: landing,
        imweb_landing_url: trim(imwebSession.utmLandingUrl),
        initial_referrer: initialReferrer,
        original_referrer: initialReferrer,
        user_pseudo_id_strategy: userPseudoId && userPseudoId === clientId ? 'client_id_fallback' : 'explicit_value',

        /*
          Presence only. Raw gbraid/wbraid stays in sessionStorage until backend contract is checked.
        */
        google_click_id_present: googleClickIdPresent,
        google_click_id_type: googleClickIdType,
        google_click_id_source: selectedGoogleClickSet.source,
        google_click_id_guard_version: CONFIG.googleClickIdGuardVersion,
        has_gclid: Boolean(trim(tracking.gclid)),
        has_gbraid: Boolean(trim(tracking.gbraid)),
        has_wbraid: Boolean(trim(tracking.wbraid)),
        click_context_version: trim(clickContext.snippet_version),
        checkout_context_version: CONFIG.snippetVersion
      }
    };

    /*
      This is the main goal of Block 2 v4.2:
      store click IDs in sessionStorage before payment/NPay redirect.
    */
    writeJsonStorage(window.sessionStorage, CONFIG.checkoutContextKey, {
      checkoutId: checkoutId,
      clientObservedAt: observedAt,
      landing: landing,
      referrer: payload.referrer,
      gaSessionId: gaSessionId,
      clientId: clientId,
      userPseudoId: userPseudoId,
      customerKey: customerKey,

      gclid: tracking.gclid,
      gbraid: tracking.gbraid,
      wbraid: tracking.wbraid,
      fbclid: tracking.fbclid,
      ttclid: tracking.ttclid,

      hasGoogleClickId: googleClickIdPresent,
      googleClickIdType: googleClickIdType,
      googleClickIdSource: selectedGoogleClickSet.source,
      googleClickIdGuardVersion: CONFIG.googleClickIdGuardVersion,
      clickContextVersion: trim(clickContext.snippet_version),
      snippetVersion: CONFIG.snippetVersion
    });

    if (hasSentMarker(dedupeKey)) {
      debugLog('skip duplicate after context refresh', {
        checkoutId: checkoutId,
        has_google_click_id: googleClickIdPresent,
        google_click_id_type: googleClickIdType
      });
      return;
    }

    debugLog('send payload presence', {
      checkoutId: checkoutId,
      has_google_click_id: googleClickIdPresent,
      google_click_id_type: googleClickIdType,
      google_click_id_source: selectedGoogleClickSet.source,
      has_gclid: Boolean(trim(tracking.gclid)),
      has_gbraid: Boolean(trim(tracking.gbraid)),
      has_wbraid: Boolean(trim(tracking.wbraid)),
      has_fbclid: Boolean(trim(tracking.fbclid)),
      has_ttclid: Boolean(trim(tracking.ttclid))
    });

    return sendPayload(payload).then(function (result) {
      rememberSent(dedupeKey);
      debugLog('send ok', result);
      return result;
    }).catch(function (error) {
      debugLog('send failed', error && error.message ? error.message : error);
    });
  });
})();


/* ── Block 3: payment_page_seen / payment_success split v4.4.3 ──
   Purpose:
   - /shop_payment/ is NOT purchase complete. Send it as payment_page_seen only.
   - Only explicit completion URLs send payment_success.
   - Reduce NPay click false positives:
     - npay_button_seen can be broad.
     - npay_button_clicked requires a strong actionable NPay element.
   - Preserve click IDs and diagnostic fields.
   - Do not fire Meta Purchase directly.
   - Do not enable server CAPI mirror.
   Version: 2026-05-21-biocom-payment-split-v4-4-3
*/
(function () {
  'use strict';

  var CONFIG = {
    source: 'biocom_imweb',
    site: 'biocom',

    /*
      Fast-compatible endpoint:
      Current backend stores checkout-context as checkout_started.
      Therefore we preserve semantic meaning in metadata.semantic_touchpoint.
      Formal backend patch should add /api/attribution/payment-page-seen later.
    */
    paymentPageEndpoint: 'https://att.ainativeos.net/api/attribution/checkout-context',
    paymentSuccessEndpoint: 'https://att.ainativeos.net/api/attribution/payment-success',

    measurementIds: ['G-WJFXN5E2Q1'],

    snippetVersion: '2026-05-21-biocom-payment-split-v4-4-3',
    pageSeenVersion: '2026-05-21-biocom-payment-page-seen-v4-4-3',
    paymentSuccessVersion: '2026-05-21-biocom-payment-success-v4-4-3',
    googleClickIdGuardVersion: 'v4.4.3',

    requestTimeoutMs: 1000,
    debugQueryKey: '__seo_attribution_debug',

    checkoutIdKey: '__seo_checkout_id',
    checkoutContextKey: '__seo_checkout_context',
    clickContextKey: '__biocom_click_id_context_v1',
    paymentPageBehaviorKey: '__seo_payment_page_behavior_v1',
    paymentSuccessContextKey: '__seo_payment_success_context',

    /*
      Use v4.4.2-specific dedupe keys so the first v4.4.2 smoke can be sent
      even if v4.4.1 already marked the same checkoutId.
    */
    paymentPageSeenDedupePrefix: '__seo_payment_page_seen_sent_v4_4_2__:',
    paymentPageExitDedupePrefix: '__seo_payment_page_seen_exit_sent_v4_4_2__:',
    paymentSuccessDedupePrefix: '__seo_payment_success_sent_v4_4_2__:',

    /*
      Keep false for safety.
      If Imweb completion page also stays under /shop_payment/,
      we need a separate DOM-confirmed patch after testing.
    */
    allowShopPaymentDomCompletionSignal: false
  };

  function trim(value) {
    if (value == null) return '';
    return String(value).trim();
  }

  function firstNonEmpty(values) {
    for (var i = 0; i < values.length; i += 1) {
      var value = trim(values[i]);
      if (value) return value;
    }
    return '';
  }

  function safeParse(raw) {
    if (!raw) return {};
    try {
      var parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch (error) {
      return {};
    }
  }

  function readJsonStorage(storage, key) {
    try {
      if (!storage) return {};
      return safeParse(storage.getItem(key));
    } catch (error) {
      return {};
    }
  }

  function writeJsonStorage(storage, key, value) {
    try {
      if (!storage) return false;
      storage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      return false;
    }
  }

  function readCookie(name) {
    try {
      var pattern = new RegExp('(?:^|; )' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '=([^;]*)');
      var match = document.cookie.match(pattern);
      return match ? decodeURIComponent(match[1]) : '';
    } catch (error) {
      return '';
    }
  }

  function getSearchParam(keys) {
    try {
      var params = new URLSearchParams(location.search);
      for (var i = 0; i < keys.length; i += 1) {
        var value = trim(params.get(keys[i]));
        if (value) return value;
      }
      return '';
    } catch (error) {
      return '';
    }
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

  function googleClickSetFromUrl(urlLike, sourceName) {
    try {
      if (!urlLike) return googleClickSetFrom({}, sourceName);
      var params = new URL(urlLike, location.origin).searchParams;
      return googleClickSetFrom({
        gclid: params.get('gclid'),
        gbraid: params.get('gbraid'),
        wbraid: params.get('wbraid')
      }, sourceName);
    } catch (error) {
      return googleClickSetFrom({}, sourceName);
    }
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

  function readDataLayerValue(keys) {
    if (!Array.isArray(window.dataLayer)) return '';

    for (var i = window.dataLayer.length - 1; i >= 0; i -= 1) {
      var item = window.dataLayer[i];
      if (!item || typeof item !== 'object' || Array.isArray(item)) continue;

      for (var j = 0; j < keys.length; j += 1) {
        var key = keys[j];
        var value = trim(item[key]);
        if (value) return value;
      }
    }

    return '';
  }

  function isDebugMode() {
    try {
      return new URLSearchParams(location.search).get(CONFIG.debugQueryKey) === '1';
    } catch (error) {
      return false;
    }
  }

  function debugLog() {
    if (!isDebugMode()) return;
    try {
      console.log.apply(console, ['[seo-payment-split-v4.4.3]'].concat([].slice.call(arguments)));
    } catch (error) {}
  }

  function hasSentMarker(key) {
    try {
      return Boolean(window.sessionStorage && window.sessionStorage.getItem(key));
    } catch (error) {
      return false;
    }
  }

  function rememberSent(key) {
    try {
      if (!window.sessionStorage) return;
      window.sessionStorage.setItem(key, new Date().toISOString());
    } catch (error) {}
  }

  function nowIso() {
    try {
      return new Date().toISOString();
    } catch (error) {
      return '';
    }
  }

  function parseNumber(value) {
    var normalized = trim(value).replace(/[^\d.-]/g, '');
    if (!normalized) return 0;
    var parsed = Number(normalized);
    return isFinite(parsed) ? parsed : 0;
  }

  function classifyRoute() {
    var href = String(location.href || '');
    var path = String(location.pathname || '');

    var isKnownSuccess =
      /shop_payment_complete|shop_order_done|order_complete|payment_complete|payment_success/i.test(href);

    var isShopPayment =
      /\/shop_payment\/?/i.test(path) &&
      !isKnownSuccess;

    var domSuccess = false;
    if (CONFIG.allowShopPaymentDomCompletionSignal && isShopPayment) {
      domSuccess = hasStrongCompletionDomSignal();
    }

    if (isKnownSuccess || domSuccess) return 'payment_success';
    if (isShopPayment) return 'payment_page_seen';
    return 'none';
  }

  function hasStrongCompletionDomSignal() {
    try {
      var text = trim(document.body && document.body.innerText);
      if (!text) return false;

      var hasCompletion =
        /주문\s*완료|주문이\s*완료|결제\s*완료|주문\s*내역|입금\s*계좌|가상\s*계좌|무통장\s*입금/i.test(text);

      var hasCheckoutForm =
        /결제\s*수단|결제하기|주문자\s*정보|주문\s*상품\s*정보|바로구매|배송지/i.test(text);

      return hasCompletion && !hasCheckoutForm;
    } catch (error) {
      return false;
    }
  }

  function getOrCreateCheckoutId() {
    try {
      var existing = trim(window.sessionStorage && window.sessionStorage.getItem(CONFIG.checkoutIdKey));
      if (existing) return existing;

      var created = 'chk_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);

      if (window.sessionStorage) {
        window.sessionStorage.setItem(CONFIG.checkoutIdKey, created);
      }

      return created;
    } catch (error) {
      return 'chk_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
    }
  }

  function mergeLandingParams(base, urlLike) {
    try {
      if (!urlLike) return base;

      var params = new URL(urlLike, location.origin).searchParams;

      return {
        utm_source: firstNonEmpty([base.utm_source, params.get('utm_source')]),
        utm_medium: firstNonEmpty([base.utm_medium, params.get('utm_medium')]),
        utm_campaign: firstNonEmpty([base.utm_campaign, params.get('utm_campaign')]),
        utm_content: firstNonEmpty([base.utm_content, params.get('utm_content')]),
        utm_term: firstNonEmpty([base.utm_term, params.get('utm_term')]),

        /*
          v4.4.3:
          Google click IDs are selected atomically in buildCommonContext.
        */
        gclid: base.gclid,
        gbraid: base.gbraid,
        wbraid: base.wbraid,

        fbclid: firstNonEmpty([base.fbclid, params.get('fbclid')]),
        ttclid: firstNonEmpty([base.ttclid, params.get('ttclid')]),

        fbc: firstNonEmpty([base.fbc, params.get('fbc')]),
        fbp: firstNonEmpty([base.fbp, params.get('fbp')])
      };
    } catch (error) {
      return base;
    }
  }

  function getGoogleClickIdType(tracking) {
    if (trim(tracking.gclid)) return 'gclid';
    if (trim(tracking.gbraid)) return 'gbraid';
    if (trim(tracking.wbraid)) return 'wbraid';
    return 'none';
  }

  function hasGoogleClickId(tracking) {
    return Boolean(trim(tracking.gclid) || trim(tracking.gbraid) || trim(tracking.wbraid));
  }

  function getPaymentIdentifiers() {
    return {
      orderCode: firstNonEmpty([
        getSearchParam(['order_code', 'orderCode']),
        readDataLayerValue(['order_code', 'orderCode'])
      ]),
      orderNo: firstNonEmpty([
        getSearchParam(['order_no', 'orderNo']),
        readDataLayerValue(['order_no', 'orderNo'])
      ]),
      orderMember: firstNonEmpty([
        getSearchParam(['order_member', 'orderMember']),
        readDataLayerValue(['order_member', 'orderMember'])
      ]),
      paymentKey: firstNonEmpty([
        getSearchParam(['payment_key', 'paymentKey', 'imp_uid']),
        readDataLayerValue(['payment_key', 'paymentKey', 'imp_uid'])
      ]),
      transactionId: firstNonEmpty([
        getSearchParam(['transaction_id', 'transactionId', 'order_code', 'orderCode']),
        readDataLayerValue(['transaction_id', 'transactionId', 'order_code', 'orderCode'])
      ])
    };
  }

  function getPaymentValue() {
    var fromQuery = firstNonEmpty([
      getSearchParam(['value', 'amount', 'price', 'total_price', 'totalAmount']),
      readDataLayerValue(['value', 'amount', 'price', 'total_price', 'totalAmount'])
    ]);

    return parseNumber(fromQuery);
  }

  function sendPayload(endpoint, payload) {
    return fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
      credentials: 'omit',
      mode: 'cors'
    }).then(function (response) {
      if (!response.ok) {
        throw new Error('attribution send failed with ' + response.status);
      }

      return {
        sentBy: 'fetch',
        accepted: true,
        status: response.status
      };
    });
  }

  function getScrollPercent() {
    try {
      var doc = document.documentElement || document.body;
      var body = document.body || {};
      var scrollTop = window.pageYOffset || doc.scrollTop || body.scrollTop || 0;
      var scrollHeight = Math.max(
        doc.scrollHeight || 0,
        body.scrollHeight || 0,
        doc.offsetHeight || 0,
        body.offsetHeight || 0
      );
      var viewportHeight = window.innerHeight || doc.clientHeight || 0;
      var maxScroll = Math.max(scrollHeight - viewportHeight, 1);
      return Math.round(Math.min(100, Math.max(0, (scrollTop / maxScroll) * 100)));
    } catch (error) {
      return 0;
    }
  }

  function classifyPaymentText(text) {
    var normalized = trim(text).toLowerCase();
    if (!normalized) return '';

    if (/네이버페이|naverpay|npay|naver pay|naver/.test(normalized)) return 'npay';
    if (/신용카드|카드|credit|card/.test(normalized)) return 'card';
    if (/가상계좌|virtual/.test(normalized)) return 'virtual_account';
    if (/무통장|계좌이체|bank/.test(normalized)) return 'bank_transfer';
    if (/카카오|kakao/.test(normalized)) return 'kakao';
    if (/토스|toss/.test(normalized)) return 'toss';
    if (/휴대폰|phone|mobile/.test(normalized)) return 'mobile';
    return '';
  }

  function getTextNearElement(element) {
    try {
      if (!element) return '';

      var pieces = [];

      if (element.id) {
        var label = document.querySelector('label[for="' + element.id.replace(/"/g, '\\"') + '"]');
        if (label) pieces.push(label.innerText || label.textContent || '');
      }

      var cursor = element;
      var depth = 0;
      while (cursor && depth < 4) {
        pieces.push(cursor.innerText || cursor.textContent || '');
        cursor = cursor.parentElement;
        depth += 1;
      }

      return pieces.join(' ');
    } catch (error) {
      return '';
    }
  }

  function detectSelectedPaymentMethod() {
    try {
      var checked = document.querySelectorAll('input[type="radio"]:checked, input[type="checkbox"]:checked, select');

      for (var i = 0; i < checked.length; i += 1) {
        var el = checked[i];
        var text = '';

        if (el.tagName && el.tagName.toLowerCase() === 'select') {
          var opt = el.options && el.selectedIndex >= 0 ? el.options[el.selectedIndex] : null;
          text = opt ? (opt.innerText || opt.textContent || opt.value || '') : '';
        } else {
          text = getTextNearElement(el);
        }

        var method = classifyPaymentText(text);
        if (method) return method;
      }

      return '';
    } catch (error) {
      return '';
    }
  }

  function elementOwnSignalText(element) {
    try {
      if (!element) return '';

      var pieces = [];
      var attrs = [
        'id',
        'class',
        'href',
        'src',
        'alt',
        'title',
        'aria-label',
        'name',
        'value',
        'role',
        'type',
        'onclick',
        'data-type',
        'data-name',
        'data-code',
        'data-pay',
        'data-payment',
        'data-provider',
        'data-module',
        'data-button-type'
      ];

      for (var i = 0; i < attrs.length; i += 1) {
        var name = attrs[i];
        var value = '';

        if (name === 'class') {
          value = typeof element.className === 'string' ? element.className : '';
        } else {
          value = element.getAttribute ? element.getAttribute(name) : '';
        }

        if (value) pieces.push(value);
      }

      /*
        Inner text is allowed only for the actionable node itself.
        We do NOT pull broad parent text here because that caused false positives.
      */
      var tag = String(element.tagName || '').toLowerCase();
      if (tag === 'a' || tag === 'button' || tag === 'input' || tag === 'iframe' || tag === 'area') {
        pieces.push(element.innerText || element.textContent || '');
      }

      return pieces.join(' ');
    } catch (error) {
      return '';
    }
  }

  function hasNpayKeyword(text) {
    return /네이버페이|naver\s*pay|naverpay|npay|n_pay|np_btn|npay_btn|naver_checkout/i.test(String(text || ''));
  }

  function findActionableAncestor(element) {
    try {
      var cursor = element;
      var depth = 0;

      while (cursor && depth < 7) {
        var tag = String(cursor.tagName || '').toLowerCase();
        var role = trim(cursor.getAttribute && cursor.getAttribute('role'));
        var hasOnclick = Boolean(cursor.getAttribute && cursor.getAttribute('onclick'));

        if (
          tag === 'a' ||
          tag === 'button' ||
          tag === 'input' ||
          tag === 'area' ||
          tag === 'iframe' ||
          role === 'button' ||
          role === 'link' ||
          hasOnclick
        ) {
          return cursor;
        }

        cursor = cursor.parentElement;
        depth += 1;
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  function isStrongNpayClickElement(element) {
    try {
      var action = findActionableAncestor(element);
      if (!action) return false;

      var signal = [
        elementOwnSignalText(action),
        elementOwnSignalText(element)
      ].join(' ');

      return hasNpayKeyword(signal);
    } catch (error) {
      return false;
    }
  }

  function isNpaySeenElement(element) {
    try {
      if (!element) return false;

      var signal = [
        elementOwnSignalText(element),
        element.innerText || '',
        element.textContent || ''
      ].join(' ');

      return hasNpayKeyword(signal);
    } catch (error) {
      return false;
    }
  }

  function detectNpaySeen() {
    try {
      var text = trim(document.body && document.body.innerText);
      if (hasNpayKeyword(text)) return true;

      var candidates = document.querySelectorAll('a, button, input, img, iframe, area');
      for (var i = 0; i < candidates.length; i += 1) {
        if (isNpaySeenElement(candidates[i])) return true;
      }

      return false;
    } catch (error) {
      return false;
    }
  }

  function loadBehavior() {
    var state = readJsonStorage(window.sessionStorage, CONFIG.paymentPageBehaviorKey);
    if (!state || typeof state !== 'object') state = {};

    /*
      Reset behavior when moving from v4.4.1 to v4.4.2.
      This clears the old false-positive npay_button_clicked=true state.
    */
    if (trim(state.behavior_version) !== CONFIG.snippetVersion) {
      state = {
        previous_behavior_version: trim(state.behavior_version)
      };
    }

    var now = Date.now();

    if (!state.page_entered_at_ms) {
      state.page_entered_at_ms = now;
      state.page_entered_at = nowIso();
    }

    if (typeof state.max_scroll_percent !== 'number') {
      state.max_scroll_percent = getScrollPercent();
    }

    if (!state.npay_button_seen) {
      state.npay_button_seen = detectNpaySeen();
    }

    if (typeof state.npay_button_clicked !== 'boolean') {
      state.npay_button_clicked = false;
    }

    if (!state.selected_payment_method) {
      state.selected_payment_method = detectSelectedPaymentMethod();
    }

    state.behavior_version = CONFIG.snippetVersion;

    return state;
  }

  function saveBehavior(state) {
    state = state || {};
    state.behavior_version = CONFIG.snippetVersion;
    state.max_scroll_percent = Math.max(Number(state.max_scroll_percent || 0), getScrollPercent());
    state.npay_button_seen = Boolean(state.npay_button_seen || detectNpaySeen());

    var method = detectSelectedPaymentMethod();
    if (method) state.selected_payment_method = method;

    state.updated_at = nowIso();
    writeJsonStorage(window.sessionStorage, CONFIG.paymentPageBehaviorKey, state);
    return state;
  }

  function getBehaviorMetrics() {
    var state = saveBehavior(loadBehavior());
    var now = Date.now();
    var enteredAt = Number(state.page_entered_at_ms || now);
    var timeOnPageMs = Math.max(0, now - enteredAt);

    return {
      page_entered_at: state.page_entered_at || '',
      page_entered_at_ms: enteredAt,
      selected_payment_method: trim(state.selected_payment_method),
      npay_button_seen: Boolean(state.npay_button_seen),
      npay_button_clicked: Boolean(state.npay_button_clicked),
      npay_click_detected_by: trim(state.npay_click_detected_by),
      npay_clicked_at: trim(state.npay_clicked_at),
      scroll_max_percent: Number(state.max_scroll_percent || 0),
      visible_seconds: Math.round(timeOnPageMs / 1000),
      time_on_page_ms: timeOnPageMs,
      behavior_version: CONFIG.snippetVersion
    };
  }

  function installBehaviorListeners() {
    var state = loadBehavior();
    saveBehavior(state);

    window.addEventListener('scroll', function () {
      saveBehavior(loadBehavior());
    }, { passive: true });

    document.addEventListener('change', function () {
      saveBehavior(loadBehavior());
    }, true);

    document.addEventListener('click', function (event) {
      var state = loadBehavior();

      /*
        v4.4.2 change:
        Only a strong actionable NPay element can set npay_button_clicked=true.
        Clicking broad payment-area text must not count as an NPay click.
      */
      if (isStrongNpayClickElement(event.target)) {
        state.npay_button_seen = true;
        state.npay_button_clicked = true;
        state.npay_click_detected_by = 'strong_actionable_npay_element';
        state.npay_clicked_at = nowIso();
        state.selected_payment_method = 'npay';
      } else {
        var method = detectSelectedPaymentMethod();
        if (method) state.selected_payment_method = method;
      }

      saveBehavior(state);
    }, true);
  }

  function buildCommonContext() {
    var imwebSession = readJsonStorage(window.sessionStorage, '__bs_imweb_session');
    var lastTouch = readJsonStorage(window.localStorage, '_p1s1a_last_touch');
    var clickContext = readJsonStorage(window.localStorage, CONFIG.clickContextKey);
    var checkoutContext = readJsonStorage(window.sessionStorage, CONFIG.checkoutContextKey);

    var checkoutId = firstNonEmpty([
      trim(checkoutContext.checkoutId),
      trim(window.sessionStorage && window.sessionStorage.getItem(CONFIG.checkoutIdKey)),
      getOrCreateCheckoutId()
    ]);

    var landing = location.href;

    var versionedCheckoutContext = trim(checkoutContext.googleClickIdGuardVersion) === CONFIG.googleClickIdGuardVersion
      ? checkoutContext
      : {};

    var legacyCheckoutContext = trim(checkoutContext.googleClickIdGuardVersion) === CONFIG.googleClickIdGuardVersion
      ? {}
      : checkoutContext;

    var selectedGoogleClickSet = selectGoogleClickSet([
      googleClickSetFromUrl(location.href, 'current_url'),
      googleClickSetFrom(versionedCheckoutContext, 'checkout_context_v4_4_3'),
      googleClickSetFromUrl(document.referrer, 'document_referrer'),
      googleClickSetFrom(clickContext, 'header_click_context'),
      googleClickSetFrom(lastTouch, 'last_touch'),
      googleClickSetFrom({
        gclid: imwebSession.gclid,
        gbraid: imwebSession.gbraid,
        wbraid: imwebSession.wbraid
      }, 'imweb_session'),
      googleClickSetFrom(legacyCheckoutContext, 'legacy_checkout_context')
    ]);

    var tracking = mergeLandingParams({
      utm_source: firstNonEmpty([
        getSearchParam(['utm_source']),
        trim(checkoutContext.utm_source),
        trim(clickContext.utm_source),
        trim(lastTouch.utm_source),
        trim(imwebSession.utmSource)
      ]),
      utm_medium: firstNonEmpty([
        getSearchParam(['utm_medium']),
        trim(checkoutContext.utm_medium),
        trim(clickContext.utm_medium),
        trim(lastTouch.utm_medium),
        trim(imwebSession.utmMedium)
      ]),
      utm_campaign: firstNonEmpty([
        getSearchParam(['utm_campaign']),
        trim(checkoutContext.utm_campaign),
        trim(clickContext.utm_campaign),
        trim(lastTouch.utm_campaign),
        trim(imwebSession.utmCampaign)
      ]),
      utm_content: firstNonEmpty([
        getSearchParam(['utm_content']),
        trim(checkoutContext.utm_content),
        trim(clickContext.utm_content),
        trim(lastTouch.utm_content),
        trim(imwebSession.utmContent)
      ]),
      utm_term: firstNonEmpty([
        getSearchParam(['utm_term']),
        trim(checkoutContext.utm_term),
        trim(clickContext.utm_term),
        trim(lastTouch.utm_term),
        trim(imwebSession.utmTerm)
      ]),

      /*
        v4.4.3:
        One coherent Google click-id source only.
      */
      gclid: selectedGoogleClickSet.gclid,
      gbraid: selectedGoogleClickSet.gbraid,
      wbraid: selectedGoogleClickSet.wbraid,

      fbclid: firstNonEmpty([
        getSearchParam(['fbclid']),
        trim(checkoutContext.fbclid),
        trim(clickContext.fbclid),
        trim(lastTouch.fbclid),
        trim(imwebSession.fbclid)
      ]),
      ttclid: firstNonEmpty([
        getSearchParam(['ttclid']),
        trim(checkoutContext.ttclid),
        trim(lastTouch.ttclid),
        trim(imwebSession.ttclid)
      ]),

      fbc: firstNonEmpty([
        trim(lastTouch.fbc),
        readCookie('_fbc'),
        getSearchParam(['fbc'])
      ]),
      fbp: firstNonEmpty([
        trim(lastTouch.fbp),
        readCookie('_fbp'),
        getSearchParam(['fbp'])
      ])
    }, landing);

    return {
      imwebSession: imwebSession,
      lastTouch: lastTouch,
      clickContext: clickContext,
      checkoutContext: checkoutContext,
      checkoutId: checkoutId,
      landing: landing,
      tracking: tracking,
      googleClickIdSource: selectedGoogleClickSet.source,
      googleClickIdGuardVersion: CONFIG.googleClickIdGuardVersion
    };
  }

  function buildIdentity(context) {
    var checkoutContext = context.checkoutContext || {};
    var lastTouch = context.lastTouch || {};
    var imwebSession = context.imwebSession || {};

    return {
      ga_session_id: firstNonEmpty([
        trim(checkoutContext.gaSessionId),
        readDataLayerValue(['ga_session_id', 'gaSessionId']),
        trim(lastTouch.ga_session_id),
        trim(imwebSession.ga_session_id)
      ]),
      client_id: firstNonEmpty([
        trim(checkoutContext.clientId),
        readDataLayerValue(['client_id', 'clientId', 'ga_client_id', 'gaClientId']),
        trim(lastTouch.client_id),
        trim(imwebSession.client_id)
      ]),
      user_pseudo_id: firstNonEmpty([
        trim(checkoutContext.userPseudoId),
        readDataLayerValue(['user_pseudo_id', 'userPseudoId', 'ga_user_pseudo_id', 'gaUserPseudoId']),
        trim(lastTouch.user_pseudo_id),
        trim(imwebSession.user_pseudo_id),
        trim(checkoutContext.clientId)
      ]),
      customerKey: firstNonEmpty([
        trim(checkoutContext.customerKey),
        trim(lastTouch.customerKey),
        trim(imwebSession.customerKey),
        trim(imwebSession.memberId),
        trim(imwebSession.member_id)
      ])
    };
  }

  function buildOrderPresence(ids) {
    return {
      order_code_present: Boolean(trim(ids.orderCode)),
      order_no_present: Boolean(trim(ids.orderNo)),
      order_member_present: Boolean(trim(ids.orderMember)),
      payment_key_present: Boolean(trim(ids.paymentKey)),
      transaction_id_present: Boolean(trim(ids.transactionId))
    };
  }

  function sendPaymentPageSeen(phase) {
    var context = buildCommonContext();
    var tracking = context.tracking;
    var ids = getPaymentIdentifiers();
    var identity = buildIdentity(context);
    var behavior = getBehaviorMetrics();

    var googleClickIdPresent = hasGoogleClickId(tracking);
    var googleClickIdType = getGoogleClickIdType(tracking);
    var orderPresence = buildOrderPresence(ids);

    var dedupeKey = (phase === 'exit' ? CONFIG.paymentPageExitDedupePrefix : CONFIG.paymentPageSeenDedupePrefix) + context.checkoutId;

    if (hasSentMarker(dedupeKey)) {
      debugLog('skip duplicate payment_page_seen', {
        phase: phase,
        has_google_click_id: googleClickIdPresent,
        google_click_id_type: googleClickIdType
      });
      return;
    }

    var payload = {
      touchpoint: 'payment_page_seen',
      captureMode: 'live',
      source: CONFIG.source,
      site: CONFIG.site,

      checkoutId: context.checkoutId,
      customerKey: identity.customerKey,
      clientObservedAt: nowIso(),

      landing: context.landing,
      referrer: document.referrer || '',

      ga_session_id: identity.ga_session_id,
      client_id: identity.client_id,
      user_pseudo_id: identity.user_pseudo_id,

      utm_source: tracking.utm_source,
      utm_medium: tracking.utm_medium,
      utm_campaign: tracking.utm_campaign,
      utm_content: tracking.utm_content,
      utm_term: tracking.utm_term,

      gclid: tracking.gclid,
      fbclid: tracking.fbclid,
      ttclid: tracking.ttclid,
      fbc: tracking.fbc,
      fbp: tracking.fbp,

      metadata: {
        snippetVersion: CONFIG.pageSeenVersion,
        split_snippet_version: CONFIG.snippetVersion,
        semantic_touchpoint: 'payment_page_seen',
        page_location_class: 'shop_payment',
        event_phase: phase || 'enter',

        is_purchase_candidate: false,
        meta_purchase_candidate: false,
        confirmed_bridge_candidate: false,
        completion_url: false,
        value_guard_required_before_meta_send: true,

        order_code_present: orderPresence.order_code_present,
        order_no_present: orderPresence.order_no_present,
        member_present: orderPresence.order_member_present,
        guest_checkout: !orderPresence.order_member_present,
        payment_key_present: orderPresence.payment_key_present,
        transaction_id_present: orderPresence.transaction_id_present,

        selected_payment_method: behavior.selected_payment_method,
        payment_method_attempted: Boolean(behavior.selected_payment_method) ? behavior.selected_payment_method : '',
        card_attempted: behavior.selected_payment_method === 'card',
        virtual_account_selected: behavior.selected_payment_method === 'virtual_account',
        bank_transfer_selected: behavior.selected_payment_method === 'bank_transfer',
        virtual_account_issued: false,

        npay_button_seen: behavior.npay_button_seen,
        npay_button_clicked: behavior.npay_button_clicked,
        npay_click_detected_by: behavior.npay_click_detected_by,
        npay_clicked_at_present: Boolean(behavior.npay_clicked_at),

        scroll_max_percent: behavior.scroll_max_percent,
        visible_seconds: behavior.visible_seconds,
        time_on_page_ms: behavior.time_on_page_ms,
        page_entered_at: behavior.page_entered_at,
        behavior_version: behavior.behavior_version,

        google_click_id_present: googleClickIdPresent,
        google_click_id_type: googleClickIdType,
        google_click_id_source: context.googleClickIdSource,
        google_click_id_guard_version: context.googleClickIdGuardVersion,
        has_gclid: Boolean(trim(tracking.gclid)),
        has_gbraid: Boolean(trim(tracking.gbraid)),
        has_wbraid: Boolean(trim(tracking.wbraid)),
        has_fbclid: Boolean(trim(tracking.fbclid)),
        has_fbc: Boolean(trim(tracking.fbc)),
        has_fbp: Boolean(trim(tracking.fbp)),
        has_ttclid: Boolean(trim(tracking.ttclid)),

        ga_join_key_present: Boolean(identity.client_id || identity.ga_session_id || identity.user_pseudo_id),
        client_id_present: Boolean(identity.client_id),
        ga_session_id_present: Boolean(identity.ga_session_id),
        user_pseudo_id_present: Boolean(identity.user_pseudo_id),

        backend_compat_note: 'checkout-context stores as checkout_started until payment_page_seen endpoint is deployed'
      }
    };

    debugLog('send payment_page_seen presence', {
      phase: phase,
      has_google_click_id: googleClickIdPresent,
      google_click_id_type: googleClickIdType,
      selected_payment_method: behavior.selected_payment_method,
      npay_button_seen: behavior.npay_button_seen,
      npay_button_clicked: behavior.npay_button_clicked,
      npay_click_detected_by: behavior.npay_click_detected_by,
      scroll_max_percent: behavior.scroll_max_percent,
      visible_seconds: behavior.visible_seconds
    });

    return sendPayload(CONFIG.paymentPageEndpoint, payload).then(function (result) {
      rememberSent(dedupeKey);
      debugLog('payment_page_seen send ok', result);
      return result;
    }).catch(function (error) {
      debugLog('payment_page_seen send failed', error && error.message ? error.message : error);
    });
  }

  function sendPaymentSuccess() {
    var context = buildCommonContext();
    var tracking = context.tracking;
    var ids = getPaymentIdentifiers();
    var identity = buildIdentity(context);

    var googleClickIdPresent = hasGoogleClickId(tracking);
    var googleClickIdType = getGoogleClickIdType(tracking);

    var transactionId = firstNonEmpty([
      ids.transactionId,
      ids.orderCode,
      ids.orderNo,
      ids.paymentKey,
      context.checkoutId
    ]);

    var dedupeBase = firstNonEmpty([transactionId, context.checkoutId, location.href]);
    var dedupeKey = CONFIG.paymentSuccessDedupePrefix + dedupeBase;

    var value = getPaymentValue();

    if (hasSentMarker(dedupeKey)) {
      debugLog('skip duplicate payment_success', {
        has_google_click_id: googleClickIdPresent,
        google_click_id_type: googleClickIdType
      });
      return;
    }

    var payload = {
      touchpoint: 'payment_success',
      captureMode: 'live',
      source: CONFIG.source,
      site: CONFIG.site,

      checkoutId: context.checkoutId,
      transaction_id: transactionId,
      order_code: ids.orderCode,
      order_no: ids.orderNo,
      order_member: ids.orderMember,
      payment_key: ids.paymentKey,

      clientObservedAt: nowIso(),
      landing: context.landing,
      referrer: document.referrer || '',

      ga_session_id: identity.ga_session_id,
      client_id: identity.client_id,
      user_pseudo_id: identity.user_pseudo_id,

      value: value,
      currency: 'KRW',

      utm_source: tracking.utm_source,
      utm_medium: tracking.utm_medium,
      utm_campaign: tracking.utm_campaign,
      utm_content: tracking.utm_content,
      utm_term: tracking.utm_term,

      gclid: tracking.gclid,
      fbclid: tracking.fbclid,
      ttclid: tracking.ttclid,
      fbc: tracking.fbc,
      fbp: tracking.fbp,

      metadata: {
        snippetVersion: CONFIG.paymentSuccessVersion,
        split_snippet_version: CONFIG.snippetVersion,
        semantic_touchpoint: 'payment_success',
        page_location_class: 'payment_success_allowlist',
        completed_url_allowlist_pass: true,
        completion_url: true,

        pending_until_confirmed_bridge: true,
        value_guard_required_before_meta_send: true,
        confirmed_bridge_candidate: false,
        meta_purchase_candidate: false,

        order_code_present: Boolean(trim(ids.orderCode)),
        order_no_present: Boolean(trim(ids.orderNo)),
        member_present: Boolean(trim(ids.orderMember)),
        payment_key_present: Boolean(trim(ids.paymentKey)),
        transaction_id_present: Boolean(trim(ids.transactionId)),

        checkout_context_version: trim(context.checkoutContext.snippetVersion),
        click_context_version: trim(context.clickContext.snippet_version),

        google_click_id_present: googleClickIdPresent,
        google_click_id_type: googleClickIdType,
        google_click_id_source: context.googleClickIdSource,
        google_click_id_guard_version: context.googleClickIdGuardVersion,
        has_gclid: Boolean(trim(tracking.gclid)),
        has_gbraid: Boolean(trim(tracking.gbraid)),
        has_wbraid: Boolean(trim(tracking.wbraid)),
        has_fbclid: Boolean(trim(tracking.fbclid)),
        has_fbc: Boolean(trim(tracking.fbc)),
        has_fbp: Boolean(trim(tracking.fbp)),
        has_ttclid: Boolean(trim(tracking.ttclid)),

        /*
          Raw Google click IDs are preserved only inside VM Cloud evidence.
          Never print them in reports/Telegram.
        */
        gbraid: tracking.gbraid,
        wbraid: tracking.wbraid,

        click_id_restore_source: context.googleClickIdSource,

        checkoutId: context.checkoutId,
        checkoutUrl: trim(context.checkoutContext.landing),
        paymentUrl: context.landing,
        imweb_landing_url: trim(context.imwebSession.utmLandingUrl)
      }
    };

    writeJsonStorage(window.sessionStorage, CONFIG.paymentSuccessContextKey, {
      snippetVersion: CONFIG.paymentSuccessVersion,
      checkoutId: context.checkoutId,
      hasGoogleClickId: googleClickIdPresent,
      googleClickIdType: googleClickIdType,
      hasGclid: Boolean(trim(tracking.gclid)),
      hasGbraid: Boolean(trim(tracking.gbraid)),
      hasWbraid: Boolean(trim(tracking.wbraid)),
      clickIdRestoreSource: payload.metadata.click_id_restore_source,
      googleClickIdSource: context.googleClickIdSource,
      googleClickIdGuardVersion: context.googleClickIdGuardVersion,
      checkoutContextVersion: trim(context.checkoutContext.snippetVersion),
      clickContextVersion: trim(context.clickContext.snippet_version),
      completedUrlAllowlistPass: true
    });

    debugLog('send payment_success presence', {
      has_google_click_id: googleClickIdPresent,
      google_click_id_type: googleClickIdType,
      has_gclid: Boolean(trim(tracking.gclid)),
      has_gbraid: Boolean(trim(tracking.gbraid)),
      has_wbraid: Boolean(trim(tracking.wbraid)),
      restore_source: payload.metadata.click_id_restore_source,
      google_click_id_source: context.googleClickIdSource,
      value_present: Boolean(value)
    });

    return sendPayload(CONFIG.paymentSuccessEndpoint, payload).then(function (result) {
      rememberSent(dedupeKey);
      debugLog('payment_success send ok', result);
      return result;
    }).catch(function (error) {
      debugLog('payment_success send failed', error && error.message ? error.message : error);
    });
  }

  var route = classifyRoute();

  if (route === 'payment_page_seen') {
    installBehaviorListeners();

    sendPaymentPageSeen('enter');

    window.addEventListener('pagehide', function () {
      saveBehavior(loadBehavior());
      sendPaymentPageSeen('exit');
    });

    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') {
        saveBehavior(loadBehavior());
        sendPaymentPageSeen('exit');
      }
    });

    return;
  }

  if (route === 'payment_success') {
    sendPaymentSuccess();
    return;
  }
})();


  window.FUNNEL_CAPI_CONFIG = {
    pixelId: '1283400029487161',
    endpoint: 'https://att.ainativeos.net/api/meta/capi/track',
    enableServerCapi: false,
    testEventCode: '',
    debug: true
  };


/*!
 * Phase 9 — Funnel CAPI mirror + InitiateCheckout value enrichment (biocom) v4.4.4 candidate
 * 2026-05-21-biocom-funnel-capi-v4-4-4
 *
 * 전략: window.fbq 를 wrap 하여 aimweb/native Pixel 이 이미 쏘는 ViewContent / AddToCart /
 * InitiateCheckout / AddPaymentInfo track 호출을 가로챈다.
 *   - eventID 가 없으면 결정론적 id 를 주입한다.
 *   - InitiateCheckout 에 value/currency 가 없으면 주문서 화면 DOM, dataLayer, sessionStorage 에서
 *     결제 예정 금액을 찾아 기존 browser Pixel payload 에 추가한다.
 *   - 서버 CAPI mirror 는 현재 설정상 enableServerCapi=false 이므로 운영 전송을 새로 만들지 않는다.
 *   - Purchase 는 제외한다. 실제 구매/가상계좌 판정은 Header Guard + VM Cloud payment-decision 이 담당한다.
 *
 * 이 후보가 해결하려는 문제:
 *   Meta 진단의 "InitiateCheckout 값 필드 없음" 경고를 중복 이벤트 없이 줄인다.
 */
(function () {
  'use strict';
  var cfg = window.FUNNEL_CAPI_CONFIG || {};
  var SNIPPET_VERSION = '2026-05-21-biocom-funnel-capi-v4-4-4';
  var ENDPOINT = cfg.endpoint || 'https://att.ainativeos.net/api/meta/capi/track';
  var PIXEL_ID = cfg.pixelId;
  var ENABLE_SERVER_CAPI = !!cfg.enableServerCapi;
  var TEST_CODE = cfg.testEventCode || '';
  var DEBUG = !!cfg.debug;

  if (!PIXEL_ID) {
    console.warn('[funnel-capi] FUNNEL_CAPI_CONFIG.pixelId missing — aborting');
    return;
  }
  if (window.__FUNNEL_CAPI_INSTALLED === SNIPPET_VERSION) return;
  window.__FUNNEL_CAPI_INSTALLED = SNIPPET_VERSION;

  /* ── 유틸 ──────────────────────────────────────────────────────────── */
  function trim(value) {
    if (value === null || value === undefined) return '';
    return String(value).trim();
  }

  function log() {
    if (!DEBUG) return;
    try { console.info.apply(console, ['[funnel-capi-v4.4.4]'].concat([].slice.call(arguments))); }
    catch (e) {}
  }

  function getCookie(name) {
    try {
      var m = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/[-.+*]/g, '\\$&') + '=([^;]*)'));
      return m ? decodeURIComponent(m[1]) : undefined;
    } catch (e) { return undefined; }
  }

  function safeObj(x) {
    return x && typeof x === 'object' && !Array.isArray(x) ? x : {};
  }

  function copyObject(source) {
    source = safeObj(source);
    var result = {};
    for (var key in source) {
      if (Object.prototype.hasOwnProperty.call(source, key)) result[key] = source[key];
    }
    return result;
  }

  function safeParse(raw) {
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
      return safeParse(storage.getItem(key));
    } catch (error) {
      return {};
    }
  }

  function parseKrw(value) {
    if (typeof value === 'number' && isFinite(value)) return value > 0 ? Math.round(value) : 0;
    var normalized = trim(value).replace(/[^0-9.-]/g, '');
    if (!normalized) return 0;
    var parsed = Number(normalized);
    if (!isFinite(parsed) || parsed <= 0) return 0;
    return Math.round(parsed);
  }

  function normalizeReasonableKrw(value) {
    var parsed = parseKrw(value);

    /*
      Guard rails:
      - 1,000원 미만 숫자는 수량/옵션값일 가능성이 높다.
      - 10,000,000원 초과 숫자는 order_no 같은 식별자일 가능성이 높다.
    */
    if (parsed < 1000 || parsed > 10000000) return 0;
    return parsed;
  }

  function readDataLayerNumber(keys) {
    try {
      if (!Array.isArray(window.dataLayer)) return 0;

      for (var i = window.dataLayer.length - 1; i >= 0; i -= 1) {
        var item = window.dataLayer[i];
        if (!item || typeof item !== 'object' || Array.isArray(item)) continue;

        for (var j = 0; j < keys.length; j += 1) {
          var key = keys[j];
          var value = normalizeReasonableKrw(item[key]);
          if (value) return value;
        }

        if (item.ecommerce && typeof item.ecommerce === 'object') {
          for (var k = 0; k < keys.length; k += 1) {
            var nestedValue = normalizeReasonableKrw(item.ecommerce[keys[k]]);
            if (nestedValue) return nestedValue;
          }
        }
      }
    } catch (error) {}

    return 0;
  }

  function readCheckoutContextValue() {
    var context = readStorageJson(window.sessionStorage, '__seo_checkout_context');
    var keys = [
      'value',
      'amount',
      'orderValue',
      'order_value',
      'totalAmount',
      'total_amount',
      'totalPrice',
      'total_price'
    ];

    for (var i = 0; i < keys.length; i += 1) {
      var value = normalizeReasonableKrw(context[keys[i]]);
      if (value) return value;
    }

    return 0;
  }

  function maxReasonableKrwFromText(text) {
    var matches = String(text || '').match(/(?:₩\s*)?[0-9][0-9,]*(?:\.\d+)?\s*(?:원|KRW)?/gi) || [];
    var max = 0;

    for (var i = 0; i < matches.length; i += 1) {
      var value = normalizeReasonableKrw(matches[i]);
      if (value > max) max = value;
    }

    return max;
  }

  function readLabeledDomValue() {
    try {
      var text = document.body && document.body.innerText || '';
      if (!text) return 0;

      var lines = text.split(/\n+/).map(function (line) { return trim(line); }).filter(Boolean);
      var labelRe = /최종\s*결제\s*금액|총\s*결제\s*금액|결제\s*예정\s*금액|결제\s*금액|총\s*주문\s*금액|주문\s*금액|총\s*상품\s*금액|상품\s*금액|합계/i;

      for (var i = 0; i < lines.length; i += 1) {
        if (!labelRe.test(lines[i])) continue;
        var nearby = lines.slice(i, Math.min(lines.length, i + 5)).join(' ');
        var labeled = maxReasonableKrwFromText(nearby);
        if (labeled) return labeled;
      }
    } catch (error) {}

    return 0;
  }

  function readVisibleDomValue() {
    try {
      return maxReasonableKrwFromText(document.body && document.body.innerText || '');
    } catch (error) {
      return 0;
    }
  }

  function getInitiateCheckoutValueCandidate(payload) {
    payload = safeObj(payload);

    var existing = normalizeReasonableKrw(payload.value);
    if (existing) {
      return {
        value: existing,
        source: 'existing_payload',
        confidence: 'high',
        preserveExisting: true
      };
    }

    var dataLayerValue = readDataLayerNumber([
      'value',
      'amount',
      'revenue',
      'total_price',
      'totalPrice',
      'total_amount',
      'totalAmount',
      'order_value',
      'orderValue'
    ]);
    if (dataLayerValue) {
      return {
        value: dataLayerValue,
        source: 'dataLayer',
        confidence: 'high',
        preserveExisting: false
      };
    }

    var contextValue = readCheckoutContextValue();
    if (contextValue) {
      return {
        value: contextValue,
        source: 'checkout_context_storage',
        confidence: 'high',
        preserveExisting: false
      };
    }

    var labeledDomValue = readLabeledDomValue();
    if (labeledDomValue) {
      return {
        value: labeledDomValue,
        source: 'checkout_dom_labeled_amount',
        confidence: 'medium_high',
        preserveExisting: false
      };
    }

    var visibleDomValue = readVisibleDomValue();
    if (visibleDomValue) {
      return {
        value: visibleDomValue,
        source: 'checkout_dom_largest_amount',
        confidence: 'medium',
        preserveExisting: false
      };
    }

    return {
      value: 0,
      source: 'not_found',
      confidence: 'none',
      preserveExisting: false
    };
  }

  function enrichInitiateCheckoutPayload(eventName, payload) {
    payload = safeObj(payload);

    if (eventName !== 'InitiateCheckout') {
      return {
        payload: payload,
        enriched: false,
        reason: 'not_initiate_checkout'
      };
    }

    var candidate = getInitiateCheckoutValueCandidate(payload);
    if (!candidate.value) {
      return {
        payload: payload,
        enriched: false,
        reason: 'value_not_found',
        valueSource: candidate.source,
        valueConfidence: candidate.confidence
      };
    }

    if (candidate.preserveExisting && trim(payload.currency)) {
      return {
        payload: payload,
        enriched: false,
        reason: 'already_has_value_and_currency',
        value: candidate.value,
        valueSource: candidate.source,
        valueConfidence: candidate.confidence
      };
    }

    var nextPayload = copyObject(payload);

    if (!normalizeReasonableKrw(nextPayload.value)) {
      nextPayload.value = candidate.value;
    }

    if (!trim(nextPayload.currency)) {
      nextPayload.currency = 'KRW';
    }

    if (!trim(nextPayload.content_type) && !trim(nextPayload.contentType)) {
      nextPayload.content_type = 'product';
    }

    nextPayload.value_enriched_by = 'biocom_phase9_v444';
    nextPayload.value_source = candidate.source;
    nextPayload.value_confidence = candidate.confidence;
    nextPayload.snippet_version = SNIPPET_VERSION;

    return {
      payload: nextPayload,
      enriched: true,
      reason: 'value_currency_enriched',
      value: candidate.value,
      valueSource: candidate.source,
      valueConfidence: candidate.confidence
    };
  }

  /* ── 세션 고정 id (eventId 주입용) ─────────────────────────────────── */
  var SESSION_KEY = '__seo_funnel_session';
  function getOrCreateSessionId() {
    try {
      var sid = window.sessionStorage && window.sessionStorage.getItem(SESSION_KEY);
      if (sid) return sid;
      sid = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      if (window.sessionStorage) window.sessionStorage.setItem(SESSION_KEY, sid);
      return sid;
    } catch (e) { return 'ns_' + Date.now().toString(36); }
  }
  var SESSION_ID = getOrCreateSessionId();

  /* ── 서버 mirror dedup (eventId 기준) ──────────────────────────────── */
  function sentKey(eventId) { return 'funnelCapi::sent::' + eventId; }
  function alreadySent(eventId) {
    try { return !!(window.sessionStorage && window.sessionStorage.getItem(sentKey(eventId))); }
    catch (e) { return false; }
  }
  function markSent(eventId) {
    try { if (window.sessionStorage) window.sessionStorage.setItem(sentKey(eventId), '1'); } catch (e) {}
  }

  /* ── 결정론적 eventId 생성 (aimweb 이 eid 없이 쏠 때 주입) ────────── */
  var MIRROR_EVENTS = {
    ViewContent: true,
    AddToCart: true,
    InitiateCheckout: true,
    AddPaymentInfo: true
    /* Purchase 는 제외 — Purchase Guard v3 가 단독 관리 */
  };

  function extractContentKey(payload) {
    if (!payload || typeof payload !== 'object') return 'unknown';
    var ids = payload.content_ids || payload.contentIds;
    if (Array.isArray(ids) && ids.length) return String(ids[0]);
    if (typeof ids === 'string' && ids) return ids;
    if (payload.value) return 'v' + Math.round(Number(payload.value) || 0);
    return 'unknown';
  }

  function ensureEventId(eventName, payload, eventMeta) {
    var existing = eventMeta && (eventMeta.eventID || eventMeta.eventId);
    if (existing) return { id: String(existing), injected: false };
    var key = extractContentKey(payload);
    var id = eventName + '.' + key + '.' + SESSION_ID;
    return { id: id, injected: true };
  }

  /* ── 서버 CAPI mirror ──────────────────────────────────────────────── */
  function serverMirror(eventName, eventId, payload) {
    if (alreadySent(eventId)) {
      log('server dup skip', eventName, eventId);
      return;
    }
    markSent(eventId);

    if (!ENABLE_SERVER_CAPI) {
      log('server skipped (disabled)', eventName, eventId);
      return;
    }

    var body = {
      eventName: eventName,
      pixelId: PIXEL_ID,
      eventId: eventId,
      eventSourceUrl: location.href,
      fbp: getCookie('_fbp'),
      fbc: getCookie('_fbc'),
      contentIds: payload.content_ids || payload.contentIds || undefined,
      contentType: payload.content_type || payload.contentType || undefined,
      value: payload.value != null ? payload.value : undefined,
      currency: payload.currency || 'KRW'
    };
    if (TEST_CODE) body.testEventCode = TEST_CODE;

    try {
      fetch(ENDPOINT, {
        method: 'POST',
        mode: 'cors',
        credentials: 'omit',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        keepalive: true
      }).then(function (r) {
        if (!r.ok) log('server non-2xx', r.status, eventName, eventId);
        else log('server ok', eventName, eventId);
      }).catch(function (err) {
        log('server error', eventName, eventId, err && err.message ? err.message : err);
      });
    } catch (e) {
      log('fetch throw', eventName, eventId, e && e.message ? e.message : e);
    }
  }

  /* ── fbq interceptor ───────────────────────────────────────────────── */
  var wrapAttempts = 0;
  var WRAP_MAX_ATTEMPTS = 80; // ~8초 (100ms 간격)

  function wrapFbq() {
    if (typeof window.fbq !== 'function') {
      if (++wrapAttempts < WRAP_MAX_ATTEMPTS) {
        setTimeout(wrapFbq, 100);
      } else {
        log('fbq wrap gave up — fbq not loaded');
      }
      return;
    }

    var orig = window.fbq;
    if (orig.__FUNNEL_CAPI_V444_WRAPPED__) {
      log('fbq already wrapped — skip');
      return;
    }

    var mirror = function () {
      var args = Array.prototype.slice.call(arguments);

      try {
        if (args[0] === 'track' && MIRROR_EVENTS[args[1]]) {
          var eventName = args[1];
          var payload = safeObj(args[2]);
          var enrichment = enrichInitiateCheckoutPayload(eventName, payload);
          payload = enrichment.payload;
          args[2] = payload;

          if (enrichment.enriched) {
            log('enrich InitiateCheckout value', {
              value: enrichment.value,
              source: enrichment.valueSource,
              confidence: enrichment.valueConfidence
            });
          } else if (eventName === 'InitiateCheckout') {
            log('InitiateCheckout value enrichment skipped', {
              reason: enrichment.reason,
              source: enrichment.valueSource || '',
              confidence: enrichment.valueConfidence || ''
            });
          }

          var eventMeta = safeObj(args[3]);
          var idRes = ensureEventId(eventName, payload, eventMeta);

          if (idRes.injected) {
            var merged = {};
            for (var k in eventMeta) if (Object.prototype.hasOwnProperty.call(eventMeta, k)) merged[k] = eventMeta[k];
            merged.eventID = idRes.id;
            args[3] = merged;
            log('inject eid', eventName, idRes.id, 'payload=', payload);
          } else {
            log('reuse eid', eventName, idRes.id);
          }

          serverMirror(eventName, idRes.id, payload);
        }
      } catch (e) {
        log('mirror observe error', e && e.message ? e.message : e);
      }

      return orig.apply(this, args);
    };

    /* ── 기존 fbq 속성 / Purchase Guard 마커 보존 ── */
    try {
      for (var k in orig) {
        if (Object.prototype.hasOwnProperty.call(orig, k)) {
          try { mirror[k] = orig[k]; } catch (copyErr) {}
        }
      }
    } catch (e) {}

    if (orig.callMethod) mirror.callMethod = orig.callMethod;
    if (orig.queue) mirror.queue = orig.queue;
    if (orig.loaded) mirror.loaded = orig.loaded;
    if (orig.version) mirror.version = orig.version;
    if (orig.agent) mirror.agent = orig.agent;
    if (orig._fbq) mirror._fbq = orig._fbq;
    if (orig.push) mirror.push = orig.push;

    if (orig.__BIOCOM_SERVER_PAYMENT_DECISION_GUARD_WRAPPED__) {
      mirror.__BIOCOM_SERVER_PAYMENT_DECISION_GUARD_WRAPPED__ = true;
    }
    if (orig.__BIOCOM_SERVER_PAYMENT_DECISION_GUARD_RAW__) {
      mirror.__BIOCOM_SERVER_PAYMENT_DECISION_GUARD_RAW__ = orig.__BIOCOM_SERVER_PAYMENT_DECISION_GUARD_RAW__;
    }

    mirror.__FUNNEL_CAPI_V444_WRAPPED__ = true;

    window.fbq = mirror;
    if (window._fbq === orig) window._fbq = mirror;

    log('fbq wrapped', 'agent=' + (orig.agent || '?'), 'version=' + (orig.version || '?'));
  }

  wrapFbq();

  log('installed', SNIPPET_VERSION,
      'pixel=' + PIXEL_ID,
      'enableServerCapi=' + ENABLE_SERVER_CAPI,
      'testEventCode=' + (TEST_CODE || '(none)'),
      'sessionId=' + SESSION_ID);
})();

(function () {
  'use strict';

  var CONFIG = {
    pixelId: '1283400029487161',
    snippetVersion: '2026-05-21-biocom-meta-funnel-fallback-block4-v0-5',
    endpoint: 'https://www.facebook.com/tr/',
    debugQueryKey: '__seo_attribution_debug',

    /*
      Wait briefly for native/FBE Pixel to fire first.
      If no actual facebook.com/tr network event exists after this delay,
      v0.5 sends an image beacon fallback.
    */
    nativeObserveMs: 1200,
    valueRetryMs: [0, 600, 1400, 2600, 4000],
    postCheckMs: 900,

    dedupePrefix: '__biocom_meta_funnel_fallback_sent_v0_5__:',
    eventIdStorePrefix: '__biocom_meta_funnel_event_id_v0_5__:',
    logKey: '__biocom_meta_funnel_fallback_v05',

    checkoutIdKey: '__seo_checkout_id',
    checkoutContextKey: '__seo_checkout_context',
    behaviorKey: '__seo_payment_page_behavior_v1',

    /*
      Hard guard.
      v0.5 must never send these events.
    */
    forbiddenEvents: {
      PageView: true,
      ViewContent: true,
      Purchase: true
    },

    allowedEvents: {
      AddToCart: true,
      InitiateCheckout: true,
      AddPaymentInfo: true
    }
  };

  if (window.__BIOCOM_META_FUNNEL_FALLBACK_V05_VERSION__ === CONFIG.snippetVersion) return;
  window.__BIOCOM_META_FUNNEL_FALLBACK_V05_VERSION__ = CONFIG.snippetVersion;

  window.__BIOCOM_META_FUNNEL_IMAGE_BEACONS__ = window.__BIOCOM_META_FUNNEL_IMAGE_BEACONS__ || [];

  function trim(value) {
    return value == null ? '' : String(value).trim();
  }

  function isDebugMode() {
    try {
      return new URLSearchParams(location.search).get(CONFIG.debugQueryKey) === '1';
    } catch (error) {
      return false;
    }
  }

  function log() {
    if (!isDebugMode()) return;
    try {
      console.log.apply(console, ['[biocom-block4-v0.5]'].concat([].slice.call(arguments)));
    } catch (error) {}
  }

  function safeParse(raw) {
    if (!raw) return {};
    try {
      var parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch (error) {
      return {};
    }
  }

  function readSession(key) {
    try {
      return trim(window.sessionStorage && window.sessionStorage.getItem(key));
    } catch (error) {
      return '';
    }
  }

  function writeSession(key, value) {
    try {
      if (!window.sessionStorage) return;
      window.sessionStorage.setItem(key, value);
    } catch (error) {}
  }

  function readSessionJson(key) {
    return safeParse(readSession(key));
  }

  function appendDecision(eventName, decision, extra) {
    try {
      var state = readSessionJson(CONFIG.logKey);
      if (!state.decisions || !Array.isArray(state.decisions)) state.decisions = [];

      var row = {
        at: new Date().toISOString(),
        eventName: eventName,
        decision: decision,
        snippetVersion: CONFIG.snippetVersion
      };

      extra = extra || {};
      for (var key in extra) {
        if (Object.prototype.hasOwnProperty.call(extra, key)) {
          row[key] = extra[key];
        }
      }

      state.decisions.push(row);

      /*
        Keep logs bounded.
      */
      if (state.decisions.length > 80) {
        state.decisions = state.decisions.slice(state.decisions.length - 80);
      }

      state.snippetVersion = CONFIG.snippetVersion;
      writeSession(CONFIG.logKey, JSON.stringify(state));
    } catch (error) {}
  }

  function getPath() {
    return String(location.pathname || '');
  }

  function getHref() {
    return String(location.href || '');
  }

  function isShopPaymentPage() {
    return /\/shop_payment\/?/i.test(getPath());
  }

  function isCartPage() {
    return /shop_cart|cart/i.test(getHref());
  }

  function isCompletionPage() {
    return /shop_payment_complete|shop_order_done|order_complete|payment_complete|payment_success/i.test(getHref());
  }

  function readCookie(name) {
    try {
      var pattern = new RegExp('(?:^|; )' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '=([^;]*)');
      var match = document.cookie.match(pattern);
      return match ? decodeURIComponent(match[1]) : '';
    } catch (error) {
      return '';
    }
  }

  function sanitizeUrl(urlLike) {
    try {
      var url = new URL(urlLike || location.href, location.origin);

      /*
        Remove order/payment/member identifiers from dl/rl.
        Do not send raw order_no/order_code/order_member/payment_key to Meta.
      */
      [
        'order_code',
        'orderCode',
        'order_no',
        'orderNo',
        'order_member',
        'orderMember',
        'payment_key',
        'paymentKey',
        'imp_uid',
        'merchant_uid',
        'member',
        'member_id'
      ].forEach(function (key) {
        url.searchParams.delete(key);
      });

      return url.toString();
    } catch (error) {
      return String(location.origin || '') + String(location.pathname || '');
    }
  }

  function hashString(value) {
    value = String(value || '');
    var hash = 5381;
    for (var i = 0; i < value.length; i += 1) {
      hash = ((hash << 5) + hash) + value.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  function getDayBucket() {
    try {
      var d = new Date();
      return [
        d.getFullYear(),
        String(d.getMonth() + 1).padStart(2, '0'),
        String(d.getDate()).padStart(2, '0')
      ].join('');
    } catch (error) {
      return String(Date.now()).slice(0, 8);
    }
  }

  function buildEventId(eventName, stableKey) {
    var base = [
      'biocom',
      'block4',
      eventName,
      stableKey || getPath(),
      getDayBucket()
    ].join('.');

    return [
      'biocom',
      'block4',
      eventName,
      hashString(base)
    ].join('.');
  }

  function storeEventId(eventName, eventId) {
    writeSession(CONFIG.eventIdStorePrefix + eventName, JSON.stringify({
      event_id: eventId,
      event_name: eventName,
      stored_at: new Date().toISOString(),
      version: CONFIG.snippetVersion
    }));
  }

  function getCheckoutId() {
    try {
      var existing = trim(sessionStorage.getItem(CONFIG.checkoutIdKey));
      if (existing) return existing;

      var created = 'chk_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
      sessionStorage.setItem(CONFIG.checkoutIdKey, created);
      return created;
    } catch (error) {
      return 'chk_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
    }
  }

  function hasSent(dedupeKey) {
    return Boolean(readSession(CONFIG.dedupePrefix + dedupeKey));
  }

  function markSent(dedupeKey, eventId, url) {
    writeSession(CONFIG.dedupePrefix + dedupeKey, JSON.stringify({
      sent_at: new Date().toISOString(),
      event_id: eventId,
      beacon_url_hash: hashString(url),
      version: CONFIG.snippetVersion
    }));
  }

  function parseKrw(value) {
    var normalized = trim(value).replace(/[^\d.-]/g, '');
    if (!normalized) return 0;
    var parsed = Number(normalized);
    return isFinite(parsed) ? parsed : 0;
  }

  function findLargestKrwInText(text) {
    text = String(text || '');
    var matches = text.match(/[\d,]+\s*원/g) || [];
    var max = 0;

    for (var i = 0; i < matches.length; i += 1) {
      max = Math.max(max, parseKrw(matches[i]));
    }

    return max;
  }

  function getVisibleValue() {
    try {
      return findLargestKrwInText(document.body && document.body.innerText);
    } catch (error) {
      return 0;
    }
  }

  function getCartItemCount() {
    try {
      var text = document.body && document.body.innerText || '';

      var m1 = text.match(/상품금액\(총\s*(\d+)\s*개\)/);
      if (m1 && m1[1]) return Number(m1[1]) || 1;

      var m2 = text.match(/일반구매\s*(\d+)/);
      if (m2 && m2[1]) return Number(m2[1]) || 1;

      var selected = document.querySelectorAll('input[type="checkbox"]:checked');
      if (selected && selected.length > 1) return selected.length - 1;

      return 1;
    } catch (error) {
      return 1;
    }
  }

  function getProductId() {
    try {
      var params = new URLSearchParams(location.search);
      return trim(
        params.get('idx') ||
        params.get('product_no') ||
        params.get('productNo') ||
        params.get('product_id') ||
        hashString(location.pathname)
      );
    } catch (error) {
      return hashString(location.pathname);
    }
  }

  function getProductName() {
    var selectors = [
      'h1',
      '.prod_title',
      '.product-title',
      '.goods-name',
      '.item_detail_tit',
      '[data-product-name]'
    ];

    for (var i = 0; i < selectors.length; i += 1) {
      try {
        var el = document.querySelector(selectors[i]);
        var text = trim(el && (el.getAttribute('data-product-name') || el.innerText || el.textContent));
        if (text) return text.slice(0, 120);
      } catch (error) {}
    }

    try {
      return trim(document.title).slice(0, 120);
    } catch (error) {
      return '';
    }
  }

  function getSelectedPaymentMethod() {
    var behavior = readSessionJson(CONFIG.behaviorKey);
    if (trim(behavior.selected_payment_method)) return trim(behavior.selected_payment_method);

    try {
      var checked = document.querySelectorAll('input[type="radio"]:checked, input[type="checkbox"]:checked, select');

      for (var i = 0; i < checked.length; i += 1) {
        var el = checked[i];
        var near = '';

        if (el.tagName && el.tagName.toLowerCase() === 'select') {
          var opt = el.options && el.selectedIndex >= 0 ? el.options[el.selectedIndex] : null;
          near = opt ? (opt.innerText || opt.textContent || opt.value || '') : '';
        } else {
          var cursor = el;
          var depth = 0;
          while (cursor && depth < 4) {
            near += ' ' + (cursor.innerText || cursor.textContent || '');
            cursor = cursor.parentElement;
            depth += 1;
          }
        }

        near = near.toLowerCase();

        if (/신용카드|카드|credit|card/.test(near)) return 'card';
        if (/가상계좌|virtual/.test(near)) return 'virtual_account';
        if (/무통장|계좌이체|bank/.test(near)) return 'bank_transfer';
        if (/네이버페이|naverpay|npay|naver pay/.test(near)) return 'npay';
        if (/토스|toss/.test(near)) return 'toss';
        if (/카카오|kakao/.test(near)) return 'kakao';
      }

      var text = trim(document.body && document.body.innerText).toLowerCase();

      /*
        Conservative fallback from page text.
      */
      if (/신용카드|카드|credit|card/.test(text)) return 'card';
      if (/가상계좌|virtual/.test(text)) return 'virtual_account';
      if (/무통장|계좌이체|bank/.test(text)) return 'bank_transfer';
      if (/네이버페이|naverpay|npay|naver pay/.test(text)) return 'npay';

      return '';
    } catch (error) {
      return '';
    }
  }

  function isAddToCartElement(element) {
    try {
      var cursor = element;
      var depth = 0;

      while (cursor && depth < 6) {
        var text = [
          cursor.innerText || '',
          cursor.textContent || '',
          cursor.id || '',
          typeof cursor.className === 'string' ? cursor.className : '',
          cursor.getAttribute && cursor.getAttribute('aria-label') || '',
          cursor.getAttribute && cursor.getAttribute('title') || '',
          cursor.getAttribute && cursor.getAttribute('data-type') || '',
          cursor.getAttribute && cursor.getAttribute('data-name') || '',
          cursor.getAttribute && cursor.getAttribute('onclick') || ''
        ].join(' ');

        if (/장바구니|담기|cart|add.?to.?cart|basket/i.test(text)) return true;

        cursor = cursor.parentElement;
        depth += 1;
      }

      return false;
    } catch (error) {
      return false;
    }
  }

  function countNetworkEvent(eventName) {
    try {
      var entries = performance.getEntriesByType('resource') || [];
      var count = 0;

      for (var i = 0; i < entries.length; i += 1) {
        var name = String(entries[i].name || '');
        if (name.indexOf('facebook.com/tr') === -1) continue;
        if (name.indexOf('id=' + CONFIG.pixelId) === -1) continue;
        if (
          name.indexOf('ev=' + encodeURIComponent(eventName)) !== -1 ||
          name.indexOf('ev=' + eventName) !== -1
        ) {
          count += 1;
        }
      }

      return count;
    } catch (error) {
      return 0;
    }
  }

  function buildCustomData(eventName, baseData) {
    var data = baseData || {};

    var out = {
      currency: 'KRW'
    };

    if (data.value) out.value = data.value;
    if (data.content_type) out.content_type = data.content_type;
    if (data.content_ids) out.content_ids = data.content_ids;
    if (data.content_name) out.content_name = data.content_name;
    if (data.num_items) out.num_items = data.num_items;
    if (data.payment_method) out.payment_method = data.payment_method;

    /*
      Diagnostic only. Safe, no raw id.
    */
    out.fallback_source = 'biocom_block4_v0_5';
    out.snippet_version = CONFIG.snippetVersion;
    out.event_family = 'browser_funnel_fallback';

    return out;
  }

  function buildBeaconUrl(eventName, eventId, customData) {
    var params = new URLSearchParams();

    params.set('id', CONFIG.pixelId);
    params.set('ev', eventName);
    params.set('dl', sanitizeUrl(location.href));
    params.set('rl', sanitizeUrl(document.referrer || ''));
    params.set('if', 'false');
    params.set('ts', String(Date.now()));
    params.set('sw', String(window.screen && window.screen.width || window.innerWidth || 0));
    params.set('sh', String(window.screen && window.screen.height || window.innerHeight || 0));
    params.set('eid', eventId);
    params.set('rqm', 'GET');

    /*
      Keep version-ish params minimal.
      Meta accepts standard pixel GET beacon style.
    */
    params.set('v', '2.9.319');
    params.set('r', 'stable');

    var fbp = readCookie('_fbp');
    var fbc = readCookie('_fbc');

    if (fbp) params.set('fbp', fbp);
    if (fbc) params.set('fbc', fbc);

    var cd = buildCustomData(eventName, customData);

    Object.keys(cd).forEach(function (key) {
      var value = cd[key];

      if (value === undefined || value === null || value === '') return;

      if (Array.isArray(value)) {
        params.set('cd[' + key + ']', JSON.stringify(value));
      } else {
        params.set('cd[' + key + ']', String(value));
      }
    });

    return CONFIG.endpoint + '?' + params.toString();
  }

  function sendImageBeacon(eventName, dedupeKey, customData) {
    if (CONFIG.forbiddenEvents[eventName]) {
      appendDecision(eventName, 'blocked_forbidden_event', { dedupeKey: dedupeKey });
      log('blocked forbidden event', eventName);
      return false;
    }

    if (!CONFIG.allowedEvents[eventName]) {
      appendDecision(eventName, 'blocked_not_allowed_event', { dedupeKey: dedupeKey });
      log('blocked not allowed event', eventName);
      return false;
    }

    var beforeCount = countNetworkEvent(eventName);

    if (beforeCount > 0) {
      appendDecision(eventName, 'skip_network_already_exists', {
        dedupeKey: dedupeKey,
        networkCountBefore: beforeCount
      });
      log('skip, network already exists', eventName, beforeCount);
      return false;
    }

    if (hasSent(dedupeKey)) {
      appendDecision(eventName, 'skip_session_dedupe', {
        dedupeKey: dedupeKey,
        networkCountBefore: beforeCount
      });
      log('skip, session dedupe', eventName, dedupeKey);
      return false;
    }

    var eventId = buildEventId(eventName, dedupeKey);
    var url = buildBeaconUrl(eventName, eventId, customData);

    var img = new Image(1, 1);
    img.referrerPolicy = 'origin';
    img.alt = '';
    img.src = url;

    /*
      Keep reference so browser does not garbage collect before request starts.
    */
    window.__BIOCOM_META_FUNNEL_IMAGE_BEACONS__.push(img);

    markSent(dedupeKey, eventId);
    storeEventId(eventName, eventId);

    appendDecision(eventName, 'image_beacon_sent', {
      dedupeKey: dedupeKey,
      eventId: eventId,
      networkCountBefore: beforeCount
    });

    log('image beacon sent', eventName, eventId);

    window.setTimeout(function () {
      appendDecision(eventName, 'post_beacon_network_check', {
        dedupeKey: dedupeKey,
        eventId: eventId,
        networkCountAfter: countNetworkEvent(eventName)
      });
    }, CONFIG.postCheckMs);

    return true;
  }

  function resolveCustomData(customDataOrFactory) {
    try {
      if (typeof customDataOrFactory === 'function') {
        return customDataOrFactory() || {};
      }
      return customDataOrFactory || {};
    } catch (error) {
      appendDecision('Block4', 'custom_data_resolve_failed', {
        message: error && error.message ? error.message : String(error || '')
      });
      return {};
    }
  }

  function shouldWaitForValue(eventName, customData) {
    if (eventName !== 'InitiateCheckout' && eventName !== 'AddPaymentInfo') return false;
    if (!isShopPaymentPage() || isCompletionPage()) return false;
    return !customData || !customData.value;
  }

  function sendFallbackWithValueRetry(eventName, dedupeKey, customDataOrFactory, attemptIndex) {
    var index = Math.max(0, Number(attemptIndex || 0));
    var customData = resolveCustomData(customDataOrFactory);

    if (shouldWaitForValue(eventName, customData) && index < CONFIG.valueRetryMs.length - 1) {
      var nextIndex = index + 1;
      var delayMs = CONFIG.valueRetryMs[nextIndex];

      appendDecision(eventName, 'wait_value_retry', {
        dedupeKey: dedupeKey,
        attemptIndex: index,
        nextAttemptIndex: nextIndex,
        nextDelayMs: delayMs
      });

      window.setTimeout(function () {
        sendFallbackWithValueRetry(eventName, dedupeKey, customDataOrFactory, nextIndex);
      }, delayMs);
      return false;
    }

    return sendImageBeacon(eventName, dedupeKey, customData);
  }

  function sendFallbackLater(eventName, dedupeKey, customDataOrFactory) {
    window.setTimeout(function () {
      sendFallbackWithValueRetry(eventName, dedupeKey, customDataOrFactory, 0);
    }, CONFIG.nativeObserveMs);
  }

  function getProductParams() {
    var value = getVisibleValue();
    var productId = getProductId();

    var payload = {
      content_type: 'product',
      content_ids: [String(productId)]
    };

    var name = getProductName();
    if (name) payload.content_name = name;
    if (value) payload.value = value;

    return payload;
  }

  function getCheckoutParams() {
    var value = getVisibleValue();

    var payload = {
      content_type: 'product',
      num_items: getCartItemCount()
    };

    if (value) payload.value = value;

    return payload;
  }

  function maybeAddToCartFromCartPage() {
    if (!isCartPage()) return;

    var text = document.body && document.body.innerText || '';
    if (!/장바구니|일반구매|주문금액|상품금액/i.test(text)) return;

    sendFallbackLater(
      'AddToCart',
      'cartpage:' + hashString(getPath() + ':' + getVisibleValue() + ':' + getCartItemCount()),
      getProductParams()
    );
  }

  function installAddToCartClickListener() {
    document.addEventListener('click', function (event) {
      if (!isAddToCartElement(event.target)) return;

      sendFallbackLater(
        'AddToCart',
        'click:' + hashString(getHref() + ':' + getVisibleValue()),
        getProductParams()
      );
    }, true);
  }

  function maybeInitiateCheckout() {
    if (!isShopPaymentPage()) return;
    if (isCompletionPage()) return;

    sendFallbackLater(
      'InitiateCheckout',
      'checkout:' + getCheckoutId(),
      getCheckoutParams
    );
  }

  function maybeAddPaymentInfo() {
    if (!isShopPaymentPage()) return;
    if (isCompletionPage()) return;

    var method = getSelectedPaymentMethod();
    if (!method) return;

    sendFallbackLater(
      'AddPaymentInfo',
      'paymentinfo:' + getCheckoutId() + ':' + method,
      function () {
        var payload = getCheckoutParams();
        payload.payment_method = getSelectedPaymentMethod() || method;
        return payload;
      }
    );
  }

  function boot() {
    installAddToCartClickListener();

    /*
      These cover:
      - User lands on cart page after adding item.
      - User lands on /shop_payment/ checkout page.
      - Payment method is already selected or becomes selected later.
    */
    maybeAddToCartFromCartPage();
    maybeInitiateCheckout();
    maybeAddPaymentInfo();

    document.addEventListener('click', function () {
      window.setTimeout(maybeAddPaymentInfo, 300);
    }, true);

    document.addEventListener('change', function () {
      window.setTimeout(maybeAddPaymentInfo, 300);
    }, true);

    appendDecision('Block4', 'boot', {
      url_class: isShopPaymentPage() ? 'shop_payment' : (isCartPage() ? 'cart' : 'other')
    });

    log('Block4 v0.5 image beacon fallback booted');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
</script>
