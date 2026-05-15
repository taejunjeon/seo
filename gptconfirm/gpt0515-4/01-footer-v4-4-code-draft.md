# 01. Footer v4.4 Code Draft

작성 시각: 2026-05-15 01:32 KST

## 결론

Footer v4.4 초안은 준비됐다.

이 코드는 `/shop_payment/`를 결제완료로 보내지 않는다. 대신 `payment_page_seen` 진단 신호로 보내고, 완료 URL allowlist에 해당할 때만 `payment_success` 후보를 보낸다.

## 적용 전 중요한 주의

이 문서는 코드 초안이다. 아직 아임웹에 저장하지 않았다.

현재 VM Cloud backend는 `payment_page_seen` touchpoint를 정식 저장하지 않는다. 빠른 초안은 `/api/attribution/checkout-context`에 보내면서 metadata에 `semantic_touchpoint=payment_page_seen`을 남긴다. 정식 분리를 하려면 backend 신규 endpoint 또는 checkout-context 확장이 필요하다.

## 기존 Header Bootstrap / Block 1 / Block 2 호환성

- Header Bootstrap의 click id context를 읽는다.
- Block 1의 `_p1s1a_last_touch`를 읽는다.
- Block 2의 `__seo_checkout_context`를 읽고 이어 붙인다.
- 기존 FBE/native Pixel을 직접 건드리지 않는다.
- Purchase browser event를 직접 발화하지 않는다.
- server CAPI 전송을 새로 켜지 않는다.

## 교체할 Block 3 전체 코드 초안

아래 코드는 Block 3 교체용 초안이다. 실제 적용 전에는 기존 Block 3를 백업해야 한다.

```html
<script>
/* ── Block 3 v4.4: payment_page_seen / payment_success split ── */
(function () {
  'use strict';

  var CONFIG = {
    paymentPageSeenEndpoint: 'https://att.ainativeos.net/api/attribution/checkout-context',
    paymentSuccessEndpoint: 'https://att.ainativeos.net/api/attribution/payment-success',
    source: 'biocom_imweb',
    measurementIds: ['G-WJFXN5E2Q1'],
    snippetVersion: '2026-05-15-biocom-payment-event-split-v4-4-draft',
    requestTimeoutMs: 800,
    debugQueryKey: '__seo_attribution_debug',
    pageSeenDedupePrefix: '__seo_payment_page_seen_sent__:',
    pageExitDedupePrefix: '__seo_payment_page_exit_sent__:',
    successDedupePrefix: '__seo_payment_success_sent__:'
  };

  var href = String(location.href || '');
  var path = String(location.pathname || '');

  function isPaymentSuccessUrl() {
    return /shop_payment_complete|shop_order_done|order_complete|payment_complete/i.test(href);
  }

  function isPaymentPageUrl() {
    return /\/shop_payment\/?/i.test(path) && !isPaymentSuccessUrl();
  }

  if (!isPaymentPageUrl() && !isPaymentSuccessUrl()) return;

  var enteredAtMs = Date.now();
  var enteredAtIso = new Date(enteredAtMs).toISOString();
  var maxScrollPercent = 0;
  var visibilityStartedAtMs = document.visibilityState === 'visible' ? Date.now() : 0;
  var visibleMs = 0;
  var npayClicked = false;
  var paymentMethodAttempted = '';

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
      return parsed && typeof parsed === 'object' ? parsed : {};
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

  function readCookie(name) {
    try {
      var pattern = new RegExp('(?:^|; )' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '=([^;]*)');
      var match = document.cookie.match(pattern);
      return match ? decodeURIComponent(match[1]) : '';
    } catch (error) {
      return '';
    }
  }

  function readDataLayerValue(keys) {
    if (!Array.isArray(window.dataLayer)) return '';
    for (var i = window.dataLayer.length - 1; i >= 0; i -= 1) {
      var item = window.dataLayer[i];
      if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
      for (var j = 0; j < keys.length; j += 1) {
        var value = trim(item[keys[j]]);
        if (value) return value;
      }
    }
    return '';
  }

  function getSearchParam(keys) {
    var params = new URLSearchParams(location.search);
    for (var i = 0; i < keys.length; i += 1) {
      var value = trim(params.get(keys[i]));
      if (value) return value;
    }
    return '';
  }

  function getSearchParamFromUrl(keys, urlLike) {
    try {
      if (!urlLike) return '';
      var params = new URL(urlLike, location.origin).searchParams;
      for (var i = 0; i < keys.length; i += 1) {
        var value = trim(params.get(keys[i]));
        if (value) return value;
      }
    } catch (error) {}
    return '';
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

      function done() {
        pending -= 1;
        if (pending <= 0) finish('');
      }

      CONFIG.measurementIds.forEach(function (measurementId) {
        try {
          window.gtag('get', measurementId, fieldName, function (value) {
            var normalized = trim(value);
            if (normalized) finish(normalized);
            else done();
          });
        } catch (error) {
          done();
        }
      });
    });
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
      console.log.apply(console, ['[seo-payment-v4-4]'].concat([].slice.call(arguments)));
    } catch (error) {}
  }

  function safePageKey() {
    return firstNonEmpty([
      getSearchParam(['order_code', 'orderCode']),
      getSearchParam(['order_no', 'orderNo']),
      getSearchParam(['order_id', 'orderId']),
      'page_' + enteredAtMs
    ]);
  }

  function parsePaymentParamsFromUrl(urlLike) {
    return {
      orderCode: getSearchParamFromUrl(['order_code', 'orderCode'], urlLike),
      orderNo: getSearchParamFromUrl(['order_no', 'orderNo'], urlLike),
      orderId: getSearchParamFromUrl(['order_id', 'orderId'], urlLike),
      orderMember: getSearchParamFromUrl(['order_member', 'orderMember'], urlLike),
      paymentCode: getSearchParamFromUrl(['payment_code', 'paymentCode'], urlLike),
      paymentKey: getSearchParamFromUrl(['payment_key', 'paymentKey'], urlLike),
      amount: getSearchParamFromUrl(['amount', 'totalAmount', 'total_amount'], urlLike)
    };
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
        gclid: firstNonEmpty([base.gclid, params.get('gclid')]),
        gbraid: firstNonEmpty([base.gbraid, params.get('gbraid')]),
        wbraid: firstNonEmpty([base.wbraid, params.get('wbraid')]),
        fbclid: firstNonEmpty([base.fbclid, params.get('fbclid')]),
        ttclid: firstNonEmpty([base.ttclid, params.get('ttclid')]),
        fbc: firstNonEmpty([base.fbc, params.get('fbc')]),
        fbp: firstNonEmpty([base.fbp, params.get('fbp')])
      };
    } catch (error) {
      return base;
    }
  }

  function normalizePaymentMethodText(value) {
    var text = trim(value).toLowerCase();
    if (!text) return '';
    if (text.indexOf('npay') >= 0 || text.indexOf('naver') >= 0 || text.indexOf('네이버') >= 0) return 'npay';
    if (text.indexOf('card') >= 0 || text.indexOf('카드') >= 0) return 'card';
    if (text.indexOf('virtual') >= 0 || text.indexOf('가상') >= 0 || text.indexOf('무통장') >= 0 || text.indexOf('입금') >= 0) return 'virtual_account_or_bank_transfer';
    if (text.indexOf('kakao') >= 0 || text.indexOf('카카오') >= 0) return 'kakao_pay';
    if (text.indexOf('toss') >= 0 || text.indexOf('토스') >= 0) return 'toss';
    return 'unknown_selected';
  }

  function getLabelText(node) {
    if (!node) return '';
    var pieces = [];
    try {
      if (node.id) {
        var label = document.querySelector('label[for="' + node.id.replace(/"/g, '') + '"]');
        if (label) pieces.push(label.textContent || '');
      }
      var parent = node.closest && node.closest('label, li, div');
      if (parent) pieces.push(parent.textContent || '');
      pieces.push(node.getAttribute && node.getAttribute('aria-label'));
      pieces.push(node.getAttribute && node.getAttribute('title'));
      pieces.push(node.value);
    } catch (error) {}
    return firstNonEmpty(pieces);
  }

  function detectSelectedPaymentMethod() {
    var selectors = [
      'input[type="radio"]:checked',
      'input[type="checkbox"]:checked',
      'select[name*="pay" i]',
      'select[id*="pay" i]',
      '[aria-checked="true"]',
      '.active',
      '.selected',
      '[class*="selected" i]'
    ];
    for (var i = 0; i < selectors.length; i += 1) {
      var nodes = [];
      try {
        nodes = Array.prototype.slice.call(document.querySelectorAll(selectors[i] || ''));
      } catch (error) {
        nodes = [];
      }
      for (var j = 0; j < nodes.length; j += 1) {
        var method = normalizePaymentMethodText(getLabelText(nodes[j]));
        if (method) return method;
      }
    }
    return '';
  }

  function hasNpayButton() {
    var selectors = [
      '[href*="npay" i]',
      '[src*="npay" i]',
      '[class*="npay" i]',
      '[id*="npay" i]',
      '[alt*="NPay" i]',
      '[title*="NPay" i]',
      '[href*="naverpay" i]',
      '[src*="naverpay" i]',
      '[class*="naverpay" i]',
      '[id*="naverpay" i]'
    ];
    for (var i = 0; i < selectors.length; i += 1) {
      try {
        if (document.querySelector(selectors[i])) return true;
      } catch (error) {}
    }
    try {
      var bodyText = trim(document.body && document.body.innerText).slice(0, 20000);
      return /NPay|네이버페이|NAVER PAY/i.test(bodyText);
    } catch (error) {
      return false;
    }
  }

  function detectCartSummary() {
    var itemCount = 0;
    var productCount = 0;
    var valuePresent = false;
    try {
      itemCount = document.querySelectorAll('[class*="item" i], [class*="goods" i], [class*="product" i]').length;
      productCount = document.querySelectorAll('[data-product-no], [data-prod-no], [data-product-id], [class*="product" i]').length;
      var text = trim(document.body && document.body.innerText).slice(0, 30000);
      valuePresent = /원|KRW|₩/.test(text);
    } catch (error) {}
    return {
      cartValuePresent: Boolean(valuePresent),
      itemCount: Math.max(0, Math.min(itemCount, 200)),
      productCount: Math.max(0, Math.min(productCount, 200))
    };
  }

  function updateScrollMetrics() {
    try {
      var doc = document.documentElement || {};
      var body = document.body || {};
      var scrollTop = window.pageYOffset || doc.scrollTop || body.scrollTop || 0;
      var scrollHeight = Math.max(doc.scrollHeight || 0, body.scrollHeight || 0);
      var viewportHeight = window.innerHeight || doc.clientHeight || 0;
      var denominator = Math.max(1, scrollHeight - viewportHeight);
      var percent = Math.round(Math.min(100, Math.max(0, (scrollTop / denominator) * 100)));
      if (percent > maxScrollPercent) maxScrollPercent = percent;
    } catch (error) {}
  }

  function updateVisibilityMetrics() {
    var now = Date.now();
    if (document.visibilityState === 'visible') {
      if (!visibilityStartedAtMs) visibilityStartedAtMs = now;
      return;
    }
    if (visibilityStartedAtMs) {
      visibleMs += Math.max(0, now - visibilityStartedAtMs);
      visibilityStartedAtMs = 0;
    }
  }

  function currentVisibleSeconds() {
    var total = visibleMs;
    if (document.visibilityState === 'visible' && visibilityStartedAtMs) {
      total += Math.max(0, Date.now() - visibilityStartedAtMs);
    }
    return Math.round(total / 1000);
  }

  function installInteractionWatchers() {
    updateScrollMetrics();
    window.addEventListener('scroll', updateScrollMetrics, { passive: true });
    document.addEventListener('visibilitychange', updateVisibilityMetrics);
    document.addEventListener('click', function (event) {
      var target = event && event.target;
      var node = target && target.closest ? target.closest('a, button, input, label, div') : target;
      var text = getLabelText(node);
      var method = normalizePaymentMethodText(text);
      if (method) paymentMethodAttempted = method;
      if (/npay|naver|네이버/i.test(text)) npayClicked = true;
    }, true);
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
      if (!response.ok) throw new Error('attribution request failed with ' + response.status);
      return { accepted: true, status: response.status };
    });
  }

  var imwebSession = readJsonStorage(window.sessionStorage, '__bs_imweb_session');
  var lastTouch = readJsonStorage(window.localStorage, '_p1s1a_last_touch');
  var headerClickContext = readJsonStorage(window.localStorage, '__biocom_click_id_context_v1');
  var checkoutContext = readJsonStorage(window.sessionStorage, '__seo_checkout_context');
  var referrerPayment = parsePaymentParamsFromUrl(document.referrer);
  var landing = firstNonEmpty([
    trim(imwebSession.utmLandingUrl),
    trim(lastTouch.landing),
    trim(checkoutContext.landing),
    location.href
  ]);
  var tracking = mergeLandingParams({
    utm_source: firstNonEmpty([trim(imwebSession.utmSource), trim(lastTouch.utm_source), getSearchParam(['utm_source'])]),
    utm_medium: firstNonEmpty([trim(imwebSession.utmMedium), trim(lastTouch.utm_medium), getSearchParam(['utm_medium'])]),
    utm_campaign: firstNonEmpty([trim(imwebSession.utmCampaign), trim(lastTouch.utm_campaign), getSearchParam(['utm_campaign'])]),
    utm_content: firstNonEmpty([trim(imwebSession.utmContent), trim(lastTouch.utm_content), getSearchParam(['utm_content'])]),
    utm_term: firstNonEmpty([trim(imwebSession.utmTerm), trim(lastTouch.utm_term), getSearchParam(['utm_term'])]),
    gclid: firstNonEmpty([trim(headerClickContext.gclid), trim(lastTouch.gclid), getSearchParam(['gclid'])]),
    gbraid: firstNonEmpty([trim(headerClickContext.gbraid), trim(lastTouch.gbraid), getSearchParam(['gbraid'])]),
    wbraid: firstNonEmpty([trim(headerClickContext.wbraid), trim(lastTouch.wbraid), getSearchParam(['wbraid'])]),
    fbclid: firstNonEmpty([trim(lastTouch.fbclid), getSearchParam(['fbclid'])]),
    ttclid: firstNonEmpty([trim(lastTouch.ttclid), getSearchParam(['ttclid'])]),
    fbc: firstNonEmpty([trim(lastTouch.fbc), readCookie('_fbc'), getSearchParam(['fbc'])]),
    fbp: firstNonEmpty([trim(lastTouch.fbp), readCookie('_fbp'), getSearchParam(['fbp'])])
  }, landing);

  function resolveIdentity() {
    return Promise.all([
      Promise.resolve(firstNonEmpty([
        readDataLayerValue(['ga_session_id', 'gaSessionId']),
        trim(lastTouch.ga_session_id),
        trim(imwebSession.ga_session_id),
        trim(checkoutContext.gaSessionId)
      ])).then(function (value) {
        if (value) return value;
        return getGtagValue('session_id').then(function (gtagValue) {
          if (gtagValue) return gtagValue;
          for (var i = 0; i < CONFIG.measurementIds.length; i += 1) {
            var parsed = parseSessionIdFromGaCookie(readCookie(getMeasurementCookieName(CONFIG.measurementIds[i])));
            if (parsed) return parsed;
          }
          return '';
        });
      }),
      Promise.resolve(firstNonEmpty([
        readDataLayerValue(['client_id', 'clientId', 'ga_client_id', 'gaClientId']),
        trim(lastTouch.client_id),
        trim(imwebSession.client_id),
        trim(checkoutContext.clientId)
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
        trim(checkoutContext.userPseudoId),
        clientId
      ]);
      return {
        gaSessionId: gaSessionId,
        clientId: clientId,
        userPseudoId: userPseudoId
      };
    });
  }

  function buildCommonPayload(identity) {
    return {
      captureMode: 'live',
      source: CONFIG.source,
      checkoutId: firstNonEmpty([trim(checkoutContext.checkoutId), trim(imwebSession.checkoutId), safePageKey()]),
      clientObservedAt: new Date().toISOString(),
      landing: landing,
      referrer: document.referrer || '',
      ga_session_id: identity.gaSessionId,
      client_id: identity.clientId,
      user_pseudo_id: identity.userPseudoId,
      utm_source: tracking.utm_source,
      utm_medium: tracking.utm_medium,
      utm_campaign: tracking.utm_campaign,
      utm_content: tracking.utm_content,
      utm_term: tracking.utm_term,
      gclid: tracking.gclid,
      fbclid: tracking.fbclid,
      ttclid: tracking.ttclid,
      fbc: tracking.fbc,
      fbp: tracking.fbp
    };
  }

  function buildPaymentPageSeenPayload(identity, phase) {
    updateScrollMetrics();
    updateVisibilityMetrics();
    var selectedMethod = firstNonEmpty([paymentMethodAttempted, detectSelectedPaymentMethod()]);
    var cart = detectCartSummary();
    var orderCode = getSearchParam(['order_code', 'orderCode']);
    var orderNo = getSearchParam(['order_no', 'orderNo']);
    var orderMember = getSearchParam(['order_member', 'orderMember']);
    var common = buildCommonPayload(identity);
    common.touchpoint = 'payment_page_seen';
    common.customerKey = '';
    common.metadata = {
      snippetVersion: CONFIG.snippetVersion,
      semantic_touchpoint: 'payment_page_seen',
      event_phase: phase,
      page_location_class: 'shop_payment',
      is_purchase_candidate: false,
      meta_purchase_candidate: false,
      completion_url: false,
      order_code_present: Boolean(orderCode),
      order_no_present: Boolean(orderNo),
      member_present: Boolean(orderMember),
      guest_checkout: !orderMember,
      selected_payment_method: selectedMethod,
      payment_method_attempted: firstNonEmpty([paymentMethodAttempted, selectedMethod]),
      card_attempted: selectedMethod === 'card',
      virtual_account_selected: selectedMethod === 'virtual_account_or_bank_transfer',
      virtual_account_issued: false,
      npay_button_seen: hasNpayButton(),
      npay_button_clicked: npayClicked,
      cart_value_present: cart.cartValuePresent,
      item_count: cart.itemCount,
      product_count: cart.productCount,
      scroll_max_percent: maxScrollPercent,
      visible_seconds: currentVisibleSeconds(),
      time_on_page_ms: Math.max(0, Date.now() - enteredAtMs),
      page_entered_at: enteredAtIso,
      page_left_at: phase === 'page_exit' ? new Date().toISOString() : '',
      ga_session_id_present: Boolean(identity.gaSessionId),
      client_id_present: Boolean(identity.clientId),
      user_pseudo_id_present: Boolean(identity.userPseudoId),
      fbp_present: Boolean(tracking.fbp),
      fbc_present: Boolean(tracking.fbc),
      fbclid_present: Boolean(tracking.fbclid),
      gclid_present: Boolean(tracking.gclid),
      gbraid_present: Boolean(tracking.gbraid),
      wbraid_present: Boolean(tracking.wbraid),
      gbraid: tracking.gbraid,
      wbraid: tracking.wbraid,
      checkout_started_observed_at: trim(checkoutContext.clientObservedAt),
      checkout_started_snippet_version: trim(checkoutContext.snippetVersion),
      backend_compat_note: 'checkout-context stores as checkout_started until payment_page_seen endpoint is deployed'
    };
    return common;
  }

  function buildPaymentSuccessPayload(identity) {
    var orderId = firstNonEmpty([
      getSearchParam(['order_no', 'orderNo', 'order_id', 'orderId']),
      trim(referrerPayment.orderNo),
      trim(referrerPayment.orderId),
      trim(imwebSession.order_no),
      trim(imwebSession.orderId),
      trim(lastTouch.orderId),
      trim(lastTouch.order_id)
    ]);
    var orderCode = firstNonEmpty([
      getSearchParam(['order_code', 'orderCode']),
      trim(referrerPayment.orderCode),
      trim(imwebSession.orderCode),
      trim(imwebSession.order_code),
      trim(lastTouch.orderCode),
      trim(lastTouch.order_code)
    ]);
    var orderMember = firstNonEmpty([
      getSearchParam(['order_member', 'orderMember']),
      trim(referrerPayment.orderMember),
      trim(imwebSession.orderMember),
      trim(imwebSession.order_member),
      trim(lastTouch.orderMember),
      trim(lastTouch.order_member)
    ]);
    var paymentKey = firstNonEmpty([
      getSearchParam(['payment_key', 'paymentKey']),
      trim(referrerPayment.paymentKey),
      trim(imwebSession.paymentKey),
      trim(imwebSession.payment_key),
      trim(lastTouch.paymentKey),
      trim(lastTouch.payment_key)
    ]);
    var common = buildCommonPayload(identity);
    common.touchpoint = 'payment_success';
    common.orderId = orderId;
    common.orderCode = orderCode;
    common.orderMember = orderMember;
    common.paymentKey = paymentKey;
    common.metadata = {
      snippetVersion: CONFIG.snippetVersion,
      semantic_touchpoint: 'payment_success',
      page_location_class: 'payment_success_allowlist',
      completion_url: true,
      pending_until_confirmed_bridge: true,
      value_guard_required_before_meta_send: true,
      order_code_present: Boolean(orderCode),
      order_no_present: Boolean(orderId),
      order_member_present: Boolean(orderMember),
      payment_key_present: Boolean(paymentKey),
      gbraid: tracking.gbraid,
      wbraid: tracking.wbraid,
      gclid_present: Boolean(tracking.gclid),
      gbraid_present: Boolean(tracking.gbraid),
      wbraid_present: Boolean(tracking.wbraid),
      fbp_present: Boolean(tracking.fbp),
      fbc_present: Boolean(tracking.fbc),
      fbclid_present: Boolean(tracking.fbclid),
      checkout_started_observed_at: trim(checkoutContext.clientObservedAt),
      checkout_started_landing: trim(checkoutContext.landing),
      checkout_started_snippet_version: trim(checkoutContext.snippetVersion),
      referrer_payment_key_present: Boolean(referrerPayment.paymentKey),
      referrer_payment_code_present: Boolean(referrerPayment.paymentCode),
      referrer_amount_present: Boolean(referrerPayment.amount)
    };
    return common;
  }

  function sendPaymentPageSeen(identity, phase) {
    var dedupeKey = (phase === 'page_exit' ? CONFIG.pageExitDedupePrefix : CONFIG.pageSeenDedupePrefix) + safePageKey();
    if (hasSentMarker(dedupeKey)) return;
    var payload = buildPaymentPageSeenPayload(identity, phase);
    debugLog('send payment_page_seen', payload);
    return sendPayload(CONFIG.paymentPageSeenEndpoint, payload).then(function () {
      rememberSent(dedupeKey);
    }).catch(function (error) {
      debugLog('payment_page_seen failed', error && error.message ? error.message : error);
    });
  }

  function sendPaymentSuccess(identity) {
    var payload = buildPaymentSuccessPayload(identity);
    var dedupeKey = CONFIG.successDedupePrefix + firstNonEmpty([
      payload.orderCode,
      payload.orderId,
      payload.paymentKey,
      safePageKey()
    ]);
    if (hasSentMarker(dedupeKey)) return;
    if (!payload.orderId && !payload.paymentKey && !payload.orderCode) {
      debugLog('skip payment_success: no order/payment/orderCode hint');
      return;
    }
    debugLog('send payment_success', payload);
    return sendPayload(CONFIG.paymentSuccessEndpoint, payload).then(function () {
      rememberSent(dedupeKey);
      try {
        window.sessionStorage.removeItem('__seo_checkout_id');
        window.sessionStorage.removeItem('__seo_checkout_context');
      } catch (error) {}
    }).catch(function (error) {
      debugLog('payment_success failed', error && error.message ? error.message : error);
    });
  }

  installInteractionWatchers();

  resolveIdentity().then(function (identity) {
    if (isPaymentPageUrl()) {
      writeJsonStorage(window.sessionStorage, '__seo_payment_page_seen_context', {
        enteredAt: enteredAtIso,
        snippetVersion: CONFIG.snippetVersion,
        gaSessionId: identity.gaSessionId,
        clientId: identity.clientId,
        userPseudoId: identity.userPseudoId
      });

      setTimeout(function () {
        sendPaymentPageSeen(identity, 'page_entry');
      }, 600);

      window.addEventListener('pagehide', function () {
        sendPaymentPageSeen(identity, 'page_exit');
      });
      document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'hidden') sendPaymentPageSeen(identity, 'page_exit');
      });
      return;
    }

    if (isPaymentSuccessUrl()) {
      sendPaymentSuccess(identity);
    }
  }).catch(function (error) {
    debugLog('identity resolve failed', error && error.message ? error.message : error);
  });
})();
</script>
```

## 빠른 적용안의 한계

이 초안은 `payment_page_seen` payload를 보내지만, 현재 backend는 `/api/attribution/checkout-context`를 `checkout_started`로 저장한다. 그래서 metadata의 `semantic_touchpoint=payment_page_seen`으로 의미를 보존한다.

정식 적용은 backend가 `payment_page_seen`을 별도 touchpoint로 받아야 한다.

## backend patch 권장

1. `AttributionTouchpoint`에 `payment_page_seen` 추가.
2. `/api/attribution/payment-page-seen` 신규 route 추가.
3. `/api/attribution/payment-success`에 `/shop_payment/` downgrade/reject guard 추가.
4. site_landing fan-out sourceTag에 `payment_page_seen` 추가 또는 checkout diagnostic bucket으로 분리.

## 적용 성공 기준

- `/shop_payment/`에서 `payment_success` 신규 row 0.
- `/shop_payment/`에서 `payment_page_seen` 또는 semantic marker row 생성.
- 완료 URL에서만 `payment_success` 생성.
- click id presence 유지.
- Purchase browser event 발화 0.
- Meta 운영 CAPI send 0.
