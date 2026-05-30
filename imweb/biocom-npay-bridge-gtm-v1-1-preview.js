(function (w, d) {
  'use strict';

  var VERSION = '2026-05-28-biocom-npay-bridge-gtm-v1-1-production-ready';
  var ENDPOINT = 'https://att.ainativeos.net/api/attribution/npay-intent';
  var DEBUG_KEY = '__seo_attribution_debug';
  var SOURCE = 'gtm_npay_bridge_v1_1';
  var LOG_PREFIX = '[biocom-npay-bridge-gtm-v1.1]';
  var MAX_TEXT_SCAN = 180000;

  if (w.__BIOCOM_NPAY_BRIDGE_GTM_VERSION__ === VERSION) return;
  w.__BIOCOM_NPAY_BRIDGE_GTM_VERSION__ = VERSION;

  var pending = null;
  var sentKeys = {};
  var lastBridgeUrl = '';
  var lastBridgeObservedAt = '';
  var bridgeCaptureSources = [];

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

  function getRuntimeEnvironment() {
    if (isDebugMode()) return 'debug';

    try {
      var params = new URLSearchParams(w.location.search);
      if (params.get('gtm_debug') || params.get('gtm_preview') || params.get('gtm_auth')) {
        return 'gtm_preview';
      }
    } catch (error) {}

    return 'live';
  }

  function log() {
    if (!isDebugMode() || !w.console || !console.info) return;
    try {
      var args = Array.prototype.slice.call(arguments);
      args.unshift(LOG_PREFIX);
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
    try { pieces.push(element.innerText || element.textContent || ''); } catch (error) {}
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
    return hasNpayKeyword([ownSignalText(action), ownSignalText(element)].join(' '));
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

  function isAllowedNpayBridgeHost(host) {
    host = String(host || '').toLowerCase();
    return (
      host === 'orders.pay.naver.com' ||
      host === 'new-m.pay.naver.com' ||
      host === 'm.pay.naver.com' ||
      host === 'pay.naver.com' ||
      host === 'nid.naver.com'
    );
  }

  function normalizeNpayUrl(value) {
    var text = trim(value);
    if (!text) return '';

    try {
      var url = new URL(text, w.location.href);
      if (isAllowedNpayBridgeHost(url.hostname)) return url.toString();
    } catch (error) {}

    try {
      var decoded = decodeURIComponent(text);
      var decodedUrl = new URL(decoded, w.location.href);
      if (isAllowedNpayBridgeHost(decodedUrl.hostname)) return decodedUrl.toString();
    } catch (error) {}

    return '';
  }

  function extractBridgeUrlFromText(text) {
    var raw = trim(text);
    if (!raw) return '';

    var direct = normalizeNpayUrl(raw);
    if (direct) return direct;

    var sample = raw.length > MAX_TEXT_SCAN ? raw.slice(0, MAX_TEXT_SCAN) : raw;
    var match = sample.match(/https?:\/\/[^"'\s<>\\]+(?:orders\.pay\.naver\.com|new-m\.pay\.naver\.com|m\.pay\.naver\.com|pay\.naver\.com|nid\.naver\.com)[^"'\s<>\\]*/i);
    if (match && match[0]) {
      var fromMatch = normalizeNpayUrl(match[0]);
      if (fromMatch) return fromMatch;
    }

    try {
      var decoded = decodeURIComponent(sample);
      var decodedMatch = decoded.match(/https?:\/\/[^"'\s<>\\]+(?:orders\.pay\.naver\.com|new-m\.pay\.naver\.com|m\.pay\.naver\.com|pay\.naver\.com|nid\.naver\.com)[^"'\s<>\\]*/i);
      if (decodedMatch && decodedMatch[0]) return normalizeNpayUrl(decodedMatch[0]);
    } catch (error) {}

    return '';
  }

  function rememberCaptureSource(source) {
    source = trim(source);
    if (!source) return;
    for (var i = 0; i < bridgeCaptureSources.length; i += 1) {
      if (bridgeCaptureSources[i] === source) return;
    }
    bridgeCaptureSources.push(source);
  }

  function rememberBridgeUrl(value, source) {
    var url = extractBridgeUrlFromText(value);
    if (!url) return '';

    lastBridgeUrl = url;
    lastBridgeObservedAt = nowIso();
    rememberCaptureSource(source || 'unknown');

    if (pending && !pending.npayBridgeUrl) {
      pending.npayBridgeUrl = url;
      pending.npayBridgeObservedAt = lastBridgeObservedAt;
      pending.bridgeSource = source || '';
      if (pending.sent) {
        scheduleBridgeUpdate(0, 'bridge_url_captured_after_initial_send');
      } else {
        scheduleFlush(0, 'bridge_url_captured');
      }
    }

    log('bridge url captured', {
      source: source || '',
      hasBridgeUrl: true
    });

    return url;
  }

  function rememberBridgeUrlFromObject(value, source, depth) {
    if (depth > 4 || value === null || value === undefined) return '';

    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return rememberBridgeUrl(value, source);
    }

    if (Array.isArray(value)) {
      for (var i = 0; i < value.length; i += 1) {
        var arrayUrl = rememberBridgeUrlFromObject(value[i], source, depth + 1);
        if (arrayUrl) return arrayUrl;
      }
      return '';
    }

    if (typeof value === 'object') {
      var preferred = [
        'npay_url', 'npayUrl', 'naver_pay_url', 'naverPayUrl', 'pay_url', 'payUrl',
        'redirect_url', 'redirectUrl', 'bridge_url', 'bridgeUrl', 'url'
      ];

      for (var p = 0; p < preferred.length; p += 1) {
        if (Object.prototype.hasOwnProperty.call(value, preferred[p])) {
          var preferredUrl = rememberBridgeUrlFromObject(value[preferred[p]], source + '.' + preferred[p], depth + 1);
          if (preferredUrl) return preferredUrl;
        }
      }

      var keys = [];
      try { keys = Object.keys(value).slice(0, 80); } catch (error) { keys = []; }
      for (var k = 0; k < keys.length; k += 1) {
        var key = keys[k];
        var nestedUrl = rememberBridgeUrlFromObject(value[key], source + '.' + key, depth + 1);
        if (nestedUrl) return nestedUrl;
      }
    }

    return '';
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

  function buildPayload(event, bridgeUrl, triggerSource) {
    var tracking = buildTracking();
    var eventId = 'npay_bridge_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    return {
      site: 'biocom',
      source: SOURCE,
      environment: getRuntimeEnvironment(),
      snippet_version: VERSION,
      captured_at: nowIso(),
      event_id: eventId,
      gtm_event_id: eventId,
      trigger_source: triggerSource || '',
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
      bridge_capture_sources: bridgeCaptureSources.join(','),
      debug_mode: isDebugMode()
    };
  }

  function ensurePending(triggerSource, event) {
    if (pending && !pending.sent) return pending;

    var bridgeUrl = event && event.target ? getElementBridgeUrl(event.target) : '';
    pending = {
      sent: false,
      npayBridgeUrl: bridgeUrl || lastBridgeUrl,
      npayBridgeObservedAt: bridgeUrl || lastBridgeUrl ? (lastBridgeObservedAt || nowIso()) : '',
      bridgeSource: bridgeUrl ? 'element_attribute' : '',
      payload: buildPayload(event || null, bridgeUrl || lastBridgeUrl, triggerSource)
    };

    log('npay intent observed', {
      triggerSource: triggerSource || '',
      hasGoogleClickId: Boolean(pending.payload.gclid || pending.payload.gbraid || pending.payload.wbraid),
      hasBridgeUrl: Boolean(pending.payload.npayBridgeUrl)
    });

    return pending;
  }

  function compactSendLog(payload) {
    return {
      hasGoogleClickId: Boolean(payload.gclid || payload.gbraid || payload.wbraid),
      hasGclid: Boolean(payload.gclid),
      hasGbraid: Boolean(payload.gbraid),
      hasWbraid: Boolean(payload.wbraid),
      hasBridgeUrl: Boolean(payload.npayBridgeUrl),
      bridgeCaptureSources: payload.bridge_capture_sources,
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
        has_npay_bridge_url: Boolean(payload.npayBridgeUrl),
        bridge_capture_sources: payload.bridge_capture_sources
      });
    } catch (error) {}

    log('sent payload presence', compactSendLog(payload));
  }

  function sendBridgeUpdate(reason) {
    if (!pending || !pending.sent || pending.bridgeUpdateSent || !pending.npayBridgeUrl) return;
    pending.bridgeUpdateSent = true;
    pending.payload.npayBridgeUrl = pending.npayBridgeUrl || lastBridgeUrl || pending.payload.npayBridgeUrl || '';
    pending.payload.npayBridgeObservedAt = pending.npayBridgeObservedAt || lastBridgeObservedAt || pending.payload.npayBridgeObservedAt || nowIso();
    pending.payload.bridge_capture_sources = bridgeCaptureSources.join(',');
    pending.payload.flush_reason = reason || '';
    pending.payload.bridge_update = true;
    sendPayload(pending.payload);
  }

  function scheduleBridgeUpdate(delayMs, reason) {
    w.setTimeout(function () { sendBridgeUpdate(reason); }, Math.max(0, Number(delayMs) || 0));
  }

  function flush(reason) {
    if (!pending || pending.sent) return;
    pending.sent = true;
    pending.payload.npayBridgeUrl = pending.npayBridgeUrl || lastBridgeUrl || pending.payload.npayBridgeUrl || '';
    pending.payload.npayBridgeObservedAt = pending.npayBridgeObservedAt || lastBridgeObservedAt || pending.payload.npayBridgeObservedAt || '';
    pending.payload.bridge_capture_sources = bridgeCaptureSources.join(',');
    pending.payload.flush_reason = reason || '';
    sendPayload(pending.payload);
  }

  function scheduleFlush(delayMs, reason) {
    w.setTimeout(function () { flush(reason); }, Math.max(0, Number(delayMs) || 0));
  }

  function scheduleBridgeScans(reason) {
    [0, 80, 200, 500, 900, 1500, 2500, 4000].forEach(function (delayMs) {
      w.setTimeout(function () {
        try {
          scanNodeForBridgeUrl(d);
          if (pending && pending.sent && pending.npayBridgeUrl) {
            sendBridgeUpdate(reason || 'scheduled_bridge_scan');
          }
        } catch (error) {}
      }, delayMs);
    });
  }

  function onClick(event) {
    if (!isNpayClickElement(event.target)) return;

    ensurePending('npay_click', event);
    scheduleBridgeScans('npay_click_bridge_scan');
    scheduleFlush(900, 'click_wait_900ms');
    scheduleFlush(2500, 'click_wait_2500ms');
    scheduleFlush(4500, 'click_wait_4500ms');
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

  function patchLocationNavigation() {
    try {
      var proto = w.Location && w.Location.prototype;
      if (!proto) return;

      if (typeof proto.assign === 'function' && !proto.assign.__BIOCOM_NPAY_BRIDGE_WRAPPED__) {
        var rawAssign = proto.assign;
        var assignWrapped = function (url) {
          rememberBridgeUrl(url, 'location.assign');
          return rawAssign.apply(this, arguments);
        };
        assignWrapped.__BIOCOM_NPAY_BRIDGE_WRAPPED__ = true;
        proto.assign = assignWrapped;
      }

      if (typeof proto.replace === 'function' && !proto.replace.__BIOCOM_NPAY_BRIDGE_WRAPPED__) {
        var rawReplace = proto.replace;
        var replaceWrapped = function (url) {
          rememberBridgeUrl(url, 'location.replace');
          return rawReplace.apply(this, arguments);
        };
        replaceWrapped.__BIOCOM_NPAY_BRIDGE_WRAPPED__ = true;
        proto.replace = replaceWrapped;
      }
    } catch (error) {}
  }

  function patchElementClick() {
    try {
      var proto = w.HTMLElement && w.HTMLElement.prototype;
      if (!proto || typeof proto.click !== 'function' || proto.click.__BIOCOM_NPAY_BRIDGE_WRAPPED__) return;

      var rawClick = proto.click;
      var clickWrapped = function () {
        try {
          rememberBridgeUrl(this && this.getAttribute && this.getAttribute('href'), 'element.click.href');
          rememberBridgeUrl(this && this.getAttribute && this.getAttribute('action'), 'element.click.action');
          rememberBridgeUrl(this && this.getAttribute && this.getAttribute('src'), 'element.click.src');
        } catch (error) {}
        return rawClick.apply(this, arguments);
      };
      clickWrapped.__BIOCOM_NPAY_BRIDGE_WRAPPED__ = true;
      proto.click = clickWrapped;
    } catch (error) {}
  }

  function patchXhr() {
    try {
      var proto = w.XMLHttpRequest && w.XMLHttpRequest.prototype;
      if (!proto || proto.open.__BIOCOM_NPAY_BRIDGE_WRAPPED__) return;

      var rawOpen = proto.open;
      var rawSend = proto.send;

      proto.open = function (method, url) {
        try {
          this.__BIOCOM_NPAY_BRIDGE_METHOD__ = method;
          this.__BIOCOM_NPAY_BRIDGE_URL__ = url;
          rememberBridgeUrl(url, 'xhr.open');
        } catch (error) {}
        return rawOpen.apply(this, arguments);
      };
      proto.open.__BIOCOM_NPAY_BRIDGE_WRAPPED__ = true;

      proto.send = function () {
        try {
          this.addEventListener('loadend', function () {
            try { rememberBridgeUrl(this.responseURL, 'xhr.response_url'); } catch (error) {}
            try {
              if (typeof this.responseText === 'string') {
                rememberBridgeUrl(this.responseText, 'xhr.response_text');
                rememberBridgeUrlFromObject(safeParseJson(this.responseText), 'xhr.response_json', 0);
              }
            } catch (error) {}
          });
        } catch (error) {}
        return rawSend.apply(this, arguments);
      };
    } catch (error) {}
  }

  function patchFetch() {
    try {
      if (typeof w.fetch !== 'function' || w.fetch.__BIOCOM_NPAY_BRIDGE_WRAPPED__) return;
      var rawFetch = w.fetch;
      var wrappedFetch = function (input) {
        try {
          var requestUrl = typeof input === 'string' ? input : (input && input.url);
          rememberBridgeUrl(requestUrl, 'fetch.request_url');
        } catch (error) {}

        var promise = rawFetch.apply(this, arguments);
        try {
          promise.then(function (response) {
            try { rememberBridgeUrl(response && response.url, 'fetch.response_url'); } catch (error) {}
            try {
              var contentType = response && response.headers && response.headers.get ? trim(response.headers.get('content-type')) : '';
              if (/json|text|html|javascript/i.test(contentType) && response.clone) {
                response.clone().text().then(function (text) {
                  rememberBridgeUrl(text, 'fetch.response_text');
                  rememberBridgeUrlFromObject(safeParseJson(text), 'fetch.response_json', 0);
                }).catch(function () {});
              }
            } catch (error) {}
          }).catch(function () {});
        } catch (error) {}
        return promise;
      };
      wrappedFetch.__BIOCOM_NPAY_BRIDGE_WRAPPED__ = true;
      w.fetch = wrappedFetch;
    } catch (error) {}
  }

  function patchJqueryAjax() {
    try {
      var jq = w.jQuery || w.$;
      if (!jq || typeof jq.ajax !== 'function' || jq.ajax.__BIOCOM_NPAY_BRIDGE_WRAPPED__) return false;

      var rawAjax = jq.ajax;
      var wrappedAjax = function () {
        var args = Array.prototype.slice.call(arguments);
        var options = args[0] && typeof args[0] === 'object' ? args[0] : {};
        var originalSuccess = options.success;
        var requestUrl = trim(options.url || '');
        var data = options.data || {};
        var isNpayOrderRequest = false;

        try {
          isNpayOrderRequest = (
            /\/shop\/(?:oms\/OMS_add_order|add_order)\.cm/i.test(requestUrl) &&
            (
              trim(data.type).toLowerCase() === 'npay' ||
              trim(data).indexOf('type=npay') >= 0
            )
          );
        } catch (error) {
          isNpayOrderRequest = false;
        }

        if (isNpayOrderRequest) {
          ensurePending('jquery_ajax_npay_add_order', null);
          scheduleFlush(4500, 'jquery_ajax_wait_4500ms');
        }

        if (typeof originalSuccess === 'function') {
          options.success = function (result) {
            try {
              if (isNpayOrderRequest) {
                rememberBridgeUrlFromObject(result, 'jquery.ajax.success', 0);
                if (pending && result && typeof result === 'object') {
                  pending.payload.imweb_order_code_present = Boolean(trim(result.order_code));
                  pending.payload.imweb_total_price = Number(result.total_price || 0) || 0;
                  pending.payload.imweb_currency = trim(result.currency || '');
                  pending.payload.imweb_npay_result_observed = true;
                }
              }
            } catch (error) {}
            return originalSuccess.apply(this, arguments);
          };
        }

        return rawAjax.apply(this, args);
      };

      wrappedAjax.__BIOCOM_NPAY_BRIDGE_WRAPPED__ = true;
      jq.ajax = wrappedAjax;
      return true;
    } catch (error) {
      return false;
    }
  }

  function patchImwebConfirmOrder() {
    try {
      var detail = w.SITE_SHOP_DETAIL;
      if (!detail || typeof detail.confirmOrderWithCartItems !== 'function') return false;
      if (detail.confirmOrderWithCartItems.__BIOCOM_NPAY_BRIDGE_WRAPPED__) return true;

      var rawConfirm = detail.confirmOrderWithCartItems;
      var wrappedConfirm = function () {
        var args = Array.prototype.slice.call(arguments);
        try {
          var paymentType = trim(args[0]).toLowerCase();
          if (paymentType === 'npay' || paymentType.indexOf('npay') >= 0) {
            ensurePending('imweb_confirm_order_with_cart_items', null);
            rememberBridgeUrlFromObject(args, 'imweb.confirm_args', 0);
            scheduleBridgeScans('imweb_confirm_bridge_scan');
            if (pending) {
              pending.payload.imweb_confirm_observed = true;
              pending.payload.imweb_confirm_observed_at = nowIso();
              pending.payload.imweb_confirm_arg0 = paymentType;
              pending.payload.imweb_return_url_present = Boolean(trim(args[1]));
            }
            scheduleFlush(4500, 'imweb_confirm_wait_4500ms');
          }
        } catch (error) {}
        return rawConfirm.apply(this, arguments);
      };

      wrappedConfirm.__BIOCOM_NPAY_BRIDGE_WRAPPED__ = true;
      detail.confirmOrderWithCartItems = wrappedConfirm;
      return true;
    } catch (error) {
      return false;
    }
  }

  function patchNaverPayButtonApply() {
    try {
      var button = w.naver && w.naver.NaverPayButton;
      if (!button || typeof button.apply !== 'function' || button.apply.__BIOCOM_NPAY_BRIDGE_WRAPPED__) return false;

      var rawApply = button.apply;
      var wrappedApply = function (config) {
        try {
          if (config && typeof config.BUY_BUTTON_HANDLER === 'function' && !config.BUY_BUTTON_HANDLER.__BIOCOM_NPAY_BRIDGE_WRAPPED__) {
            var rawHandler = config.BUY_BUTTON_HANDLER;
            var wrappedHandler = function () {
              ensurePending('naver_pay_button_handler', null);
              rememberBridgeUrlFromObject(arguments, 'naver_pay_button_handler.args', 0);
              scheduleFlush(4500, 'naver_pay_handler_wait_4500ms');
              return rawHandler.apply(this, arguments);
            };
            wrappedHandler.__BIOCOM_NPAY_BRIDGE_WRAPPED__ = true;
            config.BUY_BUTTON_HANDLER = wrappedHandler;
          }
        } catch (error) {}
        return rawApply.apply(this, arguments);
      };

      wrappedApply.__BIOCOM_NPAY_BRIDGE_WRAPPED__ = true;
      button.apply = wrappedApply;
      return true;
    } catch (error) {
      return false;
    }
  }

  function scanNodeForBridgeUrl(root) {
    try {
      var node = root && root.querySelectorAll ? root : d;
      var elements = node.querySelectorAll('a[href], form[action], iframe[src], script[src]');
      for (var i = 0; i < elements.length; i += 1) {
        rememberBridgeUrl(elements[i].getAttribute('href'), 'mutation.href');
        rememberBridgeUrl(elements[i].getAttribute('action'), 'mutation.action');
        rememberBridgeUrl(elements[i].getAttribute('src'), 'mutation.src');
      }
    } catch (error) {}
  }

  function installMutationObserver() {
    try {
      if (!w.MutationObserver || !d.documentElement) return;
      var observer = new MutationObserver(function (mutations) {
        for (var i = 0; i < mutations.length; i += 1) {
          var nodes = mutations[i].addedNodes || [];
          for (var j = 0; j < nodes.length; j += 1) {
            if (nodes[j] && nodes[j].nodeType === 1) scanNodeForBridgeUrl(nodes[j]);
          }
        }
      });
      observer.observe(d.documentElement, { childList: true, subtree: true });
    } catch (error) {}
  }

  function pollWrappers() {
    var tries = 0;
    var timer = w.setInterval(function () {
      tries += 1;
      var ok1 = patchJqueryAjax();
      var ok2 = patchImwebConfirmOrder();
      var ok3 = patchNaverPayButtonApply();
      if ((ok1 && ok2) || tries >= 80) {
        w.clearInterval(timer);
        log('wrapper poll complete', {
          jqueryAjax: ok1,
          imwebConfirm: ok2,
          naverPayApply: ok3,
          tries: tries
        });
      }
    }, 100);
  }

  d.addEventListener('click', onClick, true);
  w.addEventListener('pagehide', function () { flush('pagehide'); }, true);
  d.addEventListener('visibilitychange', function () {
    if (d.visibilityState === 'hidden') flush('visibility_hidden');
  }, true);

  patchWindowOpen();
  patchForms();
  patchLocationNavigation();
  patchElementClick();
  patchXhr();
  patchFetch();
  patchJqueryAjax();
  patchImwebConfirmOrder();
  patchNaverPayButtonApply();
  installMutationObserver();
  pollWrappers();

  log('installed', { version: VERSION });
})(window, document);
