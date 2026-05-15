# 02. Header Guard v3.1 Code

작성 시각: 2026-05-15 KST

## 적용 위치

아임웹 `헤더 코드 상단`에서 아래 조건에 해당하는 `<script>...</script>` 한 덩어리만 교체한다.

- 기존 주석 또는 설정에 `server-payment-decision-guard-v3`가 있는 블록
- `decisionEndpoint: 'https://att.ainativeos.net/api/attribution/payment-decision'`가 있는 블록
- `VirtualAccountIssued`, `PurchaseDecisionUnknown`, `PurchaseBlocked`를 처리하는 블록

유지한다.

- Footer Block 1/2/3/4
- Meta FBE/아임웹 자산 연결
- GTM
- NPay intent beacon

## 교체 코드

```html
<script>
(function () {
  'use strict';

  var CONFIG = {
    snippetVersion: '2026-05-15-server-payment-decision-guard-v3-1',
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
    decisionCachePrefix: '__biocom_payment_decision_guard_v31__:',
    wrapPollMs: [0, 50, 100, 200, 500, 1000, 2000, 3500, 5000, 8000],
    customEventRetryMs: [0, 150, 400, 800, 1500, 2500],
    logPrefix: '[biocom-server-payment-decision-guard-v3.1]'
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
  if (window.__BIOCOM_SERVER_PAYMENT_DECISION_GUARD_V31_INSTALLED__) return;
  window.__BIOCOM_SERVER_PAYMENT_DECISION_GUARD_V31_INSTALLED__ = true;

  var allowedPurchaseEventIds = {};
  var handledAttemptKeys = {};
  var fallbackAfterObserveNoEventIds = {};
  var purchaseFallbackAfterObserveNoEventIds = {};
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
    return firstNonEmpty([
      context.eventId,
      context.orderCode ? 'orderCode:' + context.orderCode : '',
      context.paymentKey ? 'paymentKey:' + context.paymentKey : '',
      context.orderId ? 'orderId:' + context.orderId : '',
      context.orderNo ? 'orderNo:' + context.orderNo : '',
      context.paymentCode ? 'paymentCode:' + context.paymentCode : ''
    ]);
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

  function buildHashSource(context) {
    var base = {
      site: CONFIG.site,
      store: context.store || CONFIG.store,
      orderCode: context.orderCode || '',
      orderNo: context.orderNo || '',
      orderId: context.orderId || '',
      paymentCode: context.paymentCode || '',
      paymentKey: context.paymentKey || ''
    };

    if (!hasDecisionLookup(context)) {
      base.eventIdFallback = context.eventId || '';
    }

    return JSON.stringify(base);
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

  function normalizeDecisionPayload(responseBody, context, source, endpointStatus) {
    responseBody = responseBody || {};
    var decision = responseBody.decision || {
      status: 'unknown',
      browserAction: 'hold_or_block_purchase',
      reason: 'decision_missing'
    };

    return {
      decision: compactDecision(decision),
      safeRef: firstNonEmpty([
        responseBody.safe_ref,
        responseBody.safeRef,
        decision.safe_ref,
        decision.safeRef,
        fallbackSafeRef(context)
      ]),
      source: firstNonEmpty([source, responseBody.source, decision.source, 'payment-decision']),
      endpointStatus: endpointStatus || 0,
      fromCache: false
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

  function writeDecisionCache(context, payload, source) {
    if (!payload || !payload.decision || !hasDecisionLookup(context)) return Promise.resolve(false);

    return buildSafeCacheKey(context).then(function (key) {
      try {
        var expiresAt = Date.now() + CONFIG.decisionCacheTtlMs;
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
            }
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
          }
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
      decision_safe_ref: payload.safeRef || fallbackSafeRef(context),
      has_order_code: context.orderCode ? 'yes' : 'no',
      has_order_no: context.orderNo ? 'yes' : 'no',
      has_payment_code: context.paymentCode ? 'yes' : 'no',
      has_payment_key: context.paymentKey ? 'yes' : 'no',
      snippet_version: CONFIG.snippetVersion
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
      trackCustom(CONFIG.vbankEventName, params.value, params.currency, context, payload);
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

  window.setTimeout(prefetchDecision, 0);

  if (window.console && console.info) {
    console.info(CONFIG.logPrefix, 'installed', CONFIG.snippetVersion);
  }
})();
</script>
```

## 설계 메모

- `requestTimeoutMs=8000`, `holdMs=50`, `decisionRetryDelayMs=500`, `fetch cache:no-store`, `keepalive:true`는 hotfix 상태를 유지했다.
- 완료 페이지에 들어오면 `payment-decision`을 즉시 prefetch한다.
- prefetch 결과는 `sessionStorage`에 2분 TTL로 저장한다.
- 캐시 키는 주문/결제 식별자를 직접 쓰지 않고 브라우저 내부 hash로 만든다.
- 캐시 값에는 `decision`, `browserAction`, `source`, `safe_ref`, `expiresAt`만 저장한다.
- `allow_purchase` 캐시가 있으면 원래 `Purchase` 호출을 바로 통과시킨다.
- `block_purchase_virtual_account`, `block_purchase`, `unknown` 캐시는 fail-open하지 않고 기존 차단 이벤트로 내려보낸다.
- `payment_page_seen`이나 `/shop_payment/`에서는 이 코드가 실행되지 않는다.
