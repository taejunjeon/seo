날짜 : 4월 15일, 오후 11:56

[헤더 코드 상단]
<script>
(function () {
  var CONFIG = {
    snippetVersion: '2026-04-12-server-payment-decision-guard-v3',
    pixelId: '1283400029487161',
    decisionEndpoint: 'https://att.ainativeos.net/api/attribution/payment-decision',
    vbankEventName: 'VirtualAccountIssued',
    unknownEventName: 'PurchaseDecisionUnknown',
    blockedEventName: 'PurchaseBlocked',
    requestTimeoutMs: 3000,
    holdMs: 100,
    decisionRetryDelayMs: 900,
    purchaseFallbackDelayMs: 1800,
    wrapPollMs: [0, 50, 100, 200, 500, 1000, 2000, 3500, 5000, 8000],
    customEventRetryMs: [0, 150, 400, 800, 1500, 2500],
    logPrefix: '[biocom-server-payment-decision-guard]'
  };

  function safeString(value) {
    if (value === null || value === undefined) return '';
    return String(value);
  }

  function isPaymentCompletePage() {
    var path = safeString(window.location.pathname).toLowerCase();
    return path.indexOf('shop_payment_complete') >= 0 || path.indexOf('shop_order_done') >= 0;
  }

  if (!isPaymentCompletePage()) return;
  if (window.__BIOCOM_SERVER_PAYMENT_DECISION_GUARD_INSTALLED__) return;
  window.__BIOCOM_SERVER_PAYMENT_DECISION_GUARD_INSTALLED__ = true;

  var allowedPurchaseEventIds = {};
  var handledAttemptKeys = {};
  var fallbackAfterObserveNoEventIds = {};
  var purchaseFallbackAfterObserveNoEventIds = {};
  var activeFbPixel = window.FB_PIXEL;

  function firstNonEmpty(values) {
    for (var i = 0; i < values.length; i += 1) {
      var value = safeString(values[i]).trim();
      if (value) return value;
    }
    return '';
  }

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
      ])
    };
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
    url.searchParams.set('site', 'biocom');
    url.searchParams.set('store', 'biocom');
    if (context.orderCode) url.searchParams.set('order_code', context.orderCode);
    if (context.orderId) url.searchParams.set('order_id', context.orderId);
    if (context.orderNo) url.searchParams.set('order_no', context.orderNo);
    if (context.paymentCode) url.searchParams.set('payment_code', context.paymentCode);
    if (context.paymentKey) url.searchParams.set('payment_key', context.paymentKey);
    return url.toString();
  }

  function fetchWithTimeout(url, timeoutMs) {
    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = window.setTimeout(function () {
      if (controller) controller.abort();
    }, timeoutMs);

    return fetch(url, {
      method: 'GET',
      credentials: 'omit',
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

  function hasDecisionLookup(context) {
    return Boolean(context.orderCode || context.orderId || context.orderNo || context.paymentCode || context.paymentKey);
  }

  function shouldRetryDecision(context, decision) {
    return Boolean(
      hasDecisionLookup(context) &&
      decision &&
      decision.status === 'unknown' &&
      decision.reason === 'no_toss_or_ledger_match'
    );
  }

  function queryDecisionOnce(context) {
    if (!hasDecisionLookup(context)) {
      return Promise.resolve({
        status: 'unknown',
        browserAction: 'hold_or_block_purchase',
        reason: 'missing_order_identifiers'
      });
    }

    return fetchWithTimeout(buildDecisionUrl(context), CONFIG.requestTimeoutMs)
      .then(function (response) {
        if (!response.ok || !response.body || response.body.ok !== true) {
          return {
            status: 'unknown',
            browserAction: 'hold_or_block_purchase',
            reason: 'decision_endpoint_error',
            endpointStatus: response.status
          };
        }
        return response.body.decision || {
          status: 'unknown',
          browserAction: 'hold_or_block_purchase',
          reason: 'decision_missing'
        };
      })
      .catch(function (error) {
        return {
          status: 'unknown',
          browserAction: 'hold_or_block_purchase',
          reason: 'decision_fetch_failed',
          message: error && error.message ? error.message : safeString(error)
        };
      });
  }

  function queryDecision(context) {
    return queryDecisionOnce(context).then(function (decision) {
      if (!shouldRetryDecision(context, decision)) return decision;

      logDiagnostic('decision_retry_scheduled', {
        reason: decision.reason || '',
        retryDelayMs: CONFIG.decisionRetryDelayMs,
        orderCode: context.orderCode,
        orderId: context.orderId,
        orderNo: context.orderNo,
        paymentCode: context.paymentCode,
        paymentKeyPresent: context.paymentKey ? 'yes' : 'no'
      });

      return new Promise(function (resolve) {
        window.setTimeout(resolve, CONFIG.decisionRetryDelayMs);
      }).then(function () {
        return queryDecisionOnce(context);
      }).then(function (retryDecision) {
        logDiagnostic('decision_retry_result', {
          branch: retryDecision.browserAction || 'unknown',
          status: retryDecision.status || 'unknown',
          reason: retryDecision.reason || '',
          matchedBy: retryDecision.matchedBy || '',
          confidence: retryDecision.confidence || '',
          orderCode: context.orderCode,
          orderId: context.orderId,
          orderNo: context.orderNo,
          paymentCode: context.paymentCode,
          paymentKeyPresent: context.paymentKey ? 'yes' : 'no'
        });
        return retryDecision;
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

  function storeDecision(context, decision, eventName, source) {
    try {
      window.sessionStorage.setItem('__biocom_server_payment_decision__:' + (context.eventId || context.orderCode || context.orderNo || context.paymentCode), JSON.stringify({
        storedAt: new Date().toISOString(),
        snippetVersion: CONFIG.snippetVersion,
        source: source,
        eventName: eventName,
        context: context,
        decision: decision,
        location: window.location.href,
        referrer: document.referrer
      }));
    } catch (error) {
      // sessionStorage may be blocked.
    }
  }

  function compactLogValue(value) {
    var text = safeString(value);
    if (!text) return '-';
    return text.replace(/\s+/g, ' ').replace(/[|]/g, '/');
  }

  function logDiagnostic(label, fields) {
    if (!window.console || !console.info) return;
    var parts = [];
    for (var key in fields) {
      if (!Object.prototype.hasOwnProperty.call(fields, key)) continue;
      parts.push(key + '=' + compactLogValue(fields[key]));
    }
    console.info(CONFIG.logPrefix + ' ' + label + ' ' + parts.join(' '));
  }

  function rememberLastDiagnostic(fields) {
    try {
      fields.updatedAt = new Date().toISOString();
      fields.snippetVersion = CONFIG.snippetVersion;
      fields.location = window.location.href;
      window.__BIOCOM_SERVER_PAYMENT_DECISION_LAST__ = fields;
    } catch (error) {
      // Assignment can fail in unusual browser contexts.
    }
  }

  function logDecisionBranch(context, decision, source) {
    var fields = {
      branch: decision.browserAction || 'unknown',
      status: decision.status || 'unknown',
      reason: decision.reason || '',
      matchedBy: decision.matchedBy || '',
      confidence: decision.confidence || '',
      source: source,
      eventId: context.eventId,
      orderCode: context.orderCode,
      orderId: context.orderId,
      orderNo: context.orderNo,
      paymentCode: context.paymentCode,
      paymentKeyPresent: context.paymentKey ? 'yes' : 'no'
    };
    logDiagnostic('decision', fields);
    rememberLastDiagnostic(fields);
  }

  function buildCustomEventId(name, context) {
    return name + '.' + firstNonEmpty([
      context.orderCode,
      context.orderNo,
      context.paymentCode,
      context.eventId,
      String(Date.now())
    ]);
  }

  function buildCustomData(value, currency, context, decision) {
    return {
      value: Number(value) || 0,
      currency: currency || 'KRW',
      order_code: context.orderCode,
      order_id: context.orderId,
      order_no: context.orderNo,
      payment_code: context.paymentCode,
      original_purchase_event_id: context.eventId,
      payment_decision_status: decision.status || 'unknown',
      payment_decision_reason: decision.reason || '',
      snippet_version: CONFIG.snippetVersion
    };
  }

  function buildPurchaseData(value, currency, context, decision) {
    return {
      value: Number(value) || 0,
      currency: currency || 'KRW',
      order_code: context.orderCode,
      order_id: context.orderId,
      order_no: context.orderNo,
      payment_code: context.paymentCode,
      payment_decision_status: decision.status || 'confirmed',
      payment_decision_reason: decision.reason || '',
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

  function logCustomDispatch(name, eventId, method, context, decision) {
    var fields = {
      eventName: name,
      eventId: eventId,
      method: method,
      branch: decision.browserAction || 'unknown',
      status: decision.status || 'unknown',
      reason: decision.reason || '',
      orderCode: context.orderCode,
      orderId: context.orderId,
      orderNo: context.orderNo,
      paymentCode: context.paymentCode,
      paymentKeyPresent: context.paymentKey ? 'yes' : 'no'
    };
    logDiagnostic('custom_event_sent', fields);
    rememberLastDiagnostic(fields);
  }

  function logCustomDispatchStart(name, eventId, context, decision) {
    logDiagnostic('custom_event_dispatch_start', {
      eventName: name,
      eventId: eventId,
      methodCandidate: 'fbq',
      networkUrlHint: 'facebook.com/tr',
      networkSearchEvent: name,
      networkSearchEventId: eventId,
      branch: decision.browserAction || 'unknown',
      status: decision.status || 'unknown',
      reason: decision.reason || '',
      orderCode: context.orderCode,
      orderId: context.orderId,
      orderNo: context.orderNo,
      paymentCode: context.paymentCode,
      paymentKeyPresent: context.paymentKey ? 'yes' : 'no'
    });
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
          if (rawUrl.indexOf(encodeURIComponent(eventId)) >= 0 || decodedUrl.indexOf(eventId) >= 0) {
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

  function observePixelNetwork(name, eventId, context, customData, decision, sourceMethod) {
    window.setTimeout(function () {
      var summary = countPixelNetworkMatches(name, eventId);

      logDiagnostic('custom_event_network_observed', {
        eventName: name,
        eventId: eventId,
        found: summary.matchCount > 0 ? 'yes' : 'no',
        matchCount: summary.matchCount,
        eventOnlyCount: summary.eventOnlyCount,
        pixelRequestCount: summary.pixelRequestCount,
        error: summary.error,
        networkUrlHint: 'facebook.com/tr',
        networkSearchEvent: name,
        networkSearchEventId: eventId,
        orderCode: context.orderCode,
        orderId: context.orderId,
        orderNo: context.orderNo,
        paymentCode: context.paymentCode,
        paymentKeyPresent: context.paymentKey ? 'yes' : 'no'
      });

      if (sourceMethod !== 'fbq' || summary.matchCount !== 0) return;
      if (fallbackAfterObserveNoEventIds[eventId]) return;

      fallbackAfterObserveNoEventIds[eventId] = true;

      logDiagnostic('custom_event_network_missing_fallback_start', {
        eventName: name,
        eventId: eventId,
        method: 'image_fallback_after_observe_no',
        originalMethod: sourceMethod,
        orderCode: context.orderCode,
        orderId: context.orderId,
        orderNo: context.orderNo,
        paymentCode: context.paymentCode,
        paymentKeyPresent: context.paymentKey ? 'yes' : 'no'
      });

      if (sendPixelFallback(name, customData, eventId)) {
        logCustomDispatch(name, eventId, 'image_fallback_after_observe_no', context, decision);
      } else {
        logDiagnostic('custom_event_fallback_after_observe_no_failed', {
          eventName: name,
          eventId: eventId,
          orderCode: context.orderCode,
          orderId: context.orderId,
          orderNo: context.orderNo,
          paymentCode: context.paymentCode,
          paymentKeyPresent: context.paymentKey ? 'yes' : 'no'
        });
      }
    }, 1500);
  }

  function logPurchaseDispatchStart(context, decision, source) {
    logDiagnostic('purchase_dispatch_start', {
      eventName: 'Purchase',
      eventId: context.eventId,
      branch: decision.browserAction || 'unknown',
      status: decision.status || 'unknown',
      reason: decision.reason || '',
      matchedBy: decision.matchedBy || '',
      confidence: decision.confidence || '',
      source: source,
      orderCode: context.orderCode,
      orderId: context.orderId,
      orderNo: context.orderNo,
      paymentCode: context.paymentCode,
      paymentKeyPresent: context.paymentKey ? 'yes' : 'no'
    });
  }

  function sendAllowedPurchaseFallback(params, context, decision, reason) {
    var eventId = context.eventId || ('Purchase.' + firstNonEmpty([
      context.orderCode,
      context.orderNo,
      context.orderId,
      context.paymentCode
    ]));
    if (!eventId || purchaseFallbackAfterObserveNoEventIds[eventId]) return;

    purchaseFallbackAfterObserveNoEventIds[eventId] = true;

    var purchaseData = buildPurchaseData(params.value, params.currency, context, decision);
    logDiagnostic('purchase_network_missing_fallback_start', {
      eventName: 'Purchase',
      eventId: eventId,
      method: 'image_fallback_after_original_no_network',
      reason: reason || '',
      orderCode: context.orderCode,
      orderId: context.orderId,
      orderNo: context.orderNo,
      paymentCode: context.paymentCode,
      paymentKeyPresent: context.paymentKey ? 'yes' : 'no'
    });

    if (sendPixelFallback('Purchase', purchaseData, eventId)) {
      logDiagnostic('purchase_fallback_sent', {
        eventName: 'Purchase',
        eventId: eventId,
        method: 'image_fallback_after_original_no_network',
        value: purchaseData.value,
        currency: purchaseData.currency,
        orderCode: context.orderCode,
        orderId: context.orderId,
        orderNo: context.orderNo,
        paymentCode: context.paymentCode,
        paymentKeyPresent: context.paymentKey ? 'yes' : 'no'
      });
      return;
    }

    logDiagnostic('purchase_fallback_failed', {
      eventName: 'Purchase',
      eventId: eventId,
      reason: 'image_fallback_failed',
      orderCode: context.orderCode,
      orderId: context.orderId,
      orderNo: context.orderNo,
      paymentCode: context.paymentCode,
      paymentKeyPresent: context.paymentKey ? 'yes' : 'no'
    });
  }

  function observePurchaseNetwork(context, params, decision) {
    window.setTimeout(function () {
      var eventId = context.eventId || ('Purchase.' + firstNonEmpty([
        context.orderCode,
        context.orderNo,
        context.orderId,
        context.paymentCode
      ]));
      var summary = countPixelNetworkMatches('Purchase', eventId);

      logDiagnostic('purchase_network_observed', {
        eventName: 'Purchase',
        eventId: eventId,
        found: summary.matchCount > 0 ? 'yes' : 'no',
        matchCount: summary.matchCount,
        eventOnlyCount: summary.eventOnlyCount,
        pixelRequestCount: summary.pixelRequestCount,
        error: summary.error,
        networkUrlHint: 'facebook.com/tr',
        networkSearchEvent: 'Purchase',
        networkSearchEventId: eventId,
        orderCode: context.orderCode,
        orderId: context.orderId,
        orderNo: context.orderNo,
        paymentCode: context.paymentCode,
        paymentKeyPresent: context.paymentKey ? 'yes' : 'no'
      });

      if (summary.matchCount === 0 && summary.eventOnlyCount === 0) {
        sendAllowedPurchaseFallback(params, context, decision, 'no_purchase_network_after_original_dispatch');
      }
    }, CONFIG.purchaseFallbackDelayMs);
  }

  function trackCustom(name, value, currency, context, decision) {
    var customData = buildCustomData(value, currency, context, decision);
    var eventId = buildCustomEventId(name, context);
    var args = [
      'trackCustom',
      name,
      customData,
      { eventID: eventId }
    ];
    var sent = false;
    var dispatchStartLogged = false;

    logDiagnostic('custom_event_prepare', {
      eventName: name,
      eventId: eventId,
      branch: decision.browserAction || 'unknown',
      status: decision.status || 'unknown',
      orderCode: context.orderCode,
      orderId: context.orderId,
      orderNo: context.orderNo,
      paymentCode: context.paymentCode,
      paymentKeyPresent: context.paymentKey ? 'yes' : 'no'
    });

    CONFIG.customEventRetryMs.forEach(function (delayMs, index) {
      window.setTimeout(function () {
        if (sent) return;

        if (!dispatchStartLogged) {
          dispatchStartLogged = true;
          logCustomDispatchStart(name, eventId, context, decision);
        }

        if (callRawFbq(args)) {
          sent = true;
          logCustomDispatch(name, eventId, 'fbq', context, decision);
          observePixelNetwork(name, eventId, context, customData, decision, 'fbq');
          return;
        }

        if (index === CONFIG.customEventRetryMs.length - 1) {
          sent = sendPixelFallback(name, customData, eventId);
          if (sent) {
            logCustomDispatch(name, eventId, 'image_fallback', context, decision);
            observePixelNetwork(name, eventId, context, customData, decision, 'image_fallback');
          } else {
            logDiagnostic('custom_event_failed', {
              eventName: name,
              eventId: eventId,
              branch: decision.browserAction || 'unknown',
              status: decision.status || 'unknown',
              orderCode: context.orderCode,
              orderId: context.orderId,
              orderNo: context.orderNo,
              paymentCode: context.paymentCode,
              paymentKeyPresent: context.paymentKey ? 'yes' : 'no'
            });
          }
        }
      }, delayMs);
    });
  }

  function handlePurchaseAttempt(params) {
    var context = buildContext(params.eventId);
    var attemptKey = buildAttemptKey(context);

    if (attemptKey && handledAttemptKeys[attemptKey]) {
      return;
    }
    if (attemptKey) handledAttemptKeys[attemptKey] = true;

    window.setTimeout(function () {
      queryDecision(context).then(function (decision) {
        logDecisionBranch(context, decision, params.source);

        if (decision.browserAction === 'allow_purchase') {
          storeDecision(context, decision, 'Purchase', params.source);
          logPurchaseDispatchStart(context, decision, params.source);
          markAllowed(context.eventId);
          try {
            params.invokeOriginal();
            logDiagnostic('purchase_dispatch_complete', {
              eventName: 'Purchase',
              eventId: context.eventId,
              source: params.source,
              orderCode: context.orderCode,
              orderId: context.orderId,
              orderNo: context.orderNo,
              paymentCode: context.paymentCode,
              paymentKeyPresent: context.paymentKey ? 'yes' : 'no'
            });
          } catch (error) {
            logDiagnostic('purchase_dispatch_error', {
              eventName: 'Purchase',
              eventId: context.eventId,
              source: params.source,
              message: error && error.message ? error.message : safeString(error),
              orderCode: context.orderCode,
              orderId: context.orderId,
              orderNo: context.orderNo,
              paymentCode: context.paymentCode,
              paymentKeyPresent: context.paymentKey ? 'yes' : 'no'
            });
            throw error;
          }
          observePurchaseNetwork(context, params, decision);
          return;
        }

        if (decision.browserAction === 'block_purchase_virtual_account') {
          storeDecision(context, decision, CONFIG.vbankEventName, params.source);
          trackCustom(CONFIG.vbankEventName, params.value, params.currency, context, decision);
          return;
        }

        if (decision.browserAction === 'block_purchase') {
          storeDecision(context, decision, CONFIG.blockedEventName, params.source);
          trackCustom(CONFIG.blockedEventName, params.value, params.currency, context, decision);
          return;
        }

        storeDecision(context, decision, CONFIG.unknownEventName, params.source);
        trackCustom(CONFIG.unknownEventName, params.value, params.currency, context, decision);
      });
    }, CONFIG.holdMs);
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

  if (window.console && console.info) {
    console.info(CONFIG.logPrefix, 'installed', CONFIG.snippetVersion);
  }
})();
</script>

[헤더 코드]
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

[바디 코드]
<!-- Uneedcomms Keepgrow Script -->
<script id="kg-service-init" data-hosting="imweb" src="//storage.keepgrow.com/admin/keepgrow-service/keepgrow-service_c4342055-4ab1-4952-8732-bb8edeab9912.js"></script>
<!-- Uneedcomms Keepgrow Script -->


<!-- Google Tag Manager (noscript) -->
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-W2Z6PHN"
height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
<!-- End Google Tag Manager (noscript) -->


[푸터 코드]
<!-- biocom footer v3 - 2026-04-15 final3 (Phase 9 pivoted to fbq mirror / eventId injector) -->
<!--
  변경 내역 vs biocom_footer_0415_final2.md (v2):
    1) Phase 9 재설계 — dataLayer 구독 + 자체 fbq 발사 방식을 폐기하고,
       aimweb 이 이미 쏘고 있는 fbq 호출을 가로채는 "interceptor + mirror" 방식으로 전환.
       근거: aimweb plimweb agent 가 ViewContent/AddToCart/InitiateCheckout/AddPaymentInfo 를
            모든 상품 페이지에서 이미 발사 중. 다만 ViewContent 는 eid 없음, AddToCart 는 eid 있음
            (2026-04-15 실측). Phase 9 v2 는 자체 eventId 로 쏴서 aimweb 것과 중복 발생 위험 확인됨.
    2) Phase 9 가 하는 일: window.fbq 를 한 번 더 wrap 하여
       - aimweb 의 track 호출이 MIRROR_EVENTS 에 해당하면
       - eventId 가 없으면 결정론적 id 주입 (ViewContent.<prod>.<sessionId>)
       - 수정된 args 로 원래 경로 (Purchase Guard wrap → 원본 fbq) 에 전달
       - 동시에 같은 eventId 로 서버 CAPI 로 mirror
       → Meta 가 browser+server 쌍을 자동 dedup. 중복 없음.
    3) FUNNEL_CAPI_CONFIG 에서 enableBrowserFbq 제거 (v2 의 flag)
       — Phase 9 가 직접 fbq('track',...) 를 쏘지 않으므로 불필요.
       남은 플래그: enableServerCapi (서버 미러 on/off), testEventCode, debug.
    4) HURDLERS dataLayer 구독 경로 제거. aimweb fbq 가 상위 호환 + 더 포괄적 (DietMealBox 포함).
    5) Purchase Guard v3 의 fbq wrap 체인 보존 — Phase 9 mirror 는 가장 바깥쪽에 올라가며,
       __BIOCOM_SERVER_PAYMENT_DECISION_GUARD_WRAPPED__ 마커를 상위로 전파.
    6) Block 1 UTM persistence / Block 2 checkout_started / Block 3 payment_success 는 v2 와 동일.
    7) snippetVersion 2026-04-15-biocom-funnel-capi-v3.
-->
<!-- Fixed attribution endpoint: https://att.ainativeos.net -->
<!-- biocom GA4 정본 measurement id: G-WJFXN5E2Q1 -->
<!-- biocom Meta pixel id: 1283400029487161 -->

<script>
/* ── Block 1: UTM persistence + Formbricks user_id + gtag user_id ── */
(function () {
  var CONFIG = {
    debugQueryKey: '__seo_attribution_debug',
    gtagRetryMs: 100,
    gtagMaxWaitMs: 5000,
    legacyUtmKey: '_p1s1a_session_touch',
    firstTouchKey: '_p1s1a_first_touch',
    latestTouchKey: '_p1s1a_last_touch'
  };

  function trim(value) {
    if (value == null) return '';
    return String(value).trim();
  }

  function isDebugMode() {
    return new URLSearchParams(location.search).get(CONFIG.debugQueryKey) === '1';
  }

  function debugLog() {
    if (!isDebugMode()) return;
    try {
      console.log.apply(console, ['[seo-user-utm]'].concat([].slice.call(arguments)));
    } catch (error) {}
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

  function collectTrackingParams() {
    var params = new URLSearchParams(location.search);
    return {
      utm_campaign: trim(params.get('utm_campaign')),
      utm_source: trim(params.get('utm_source')),
      utm_medium: trim(params.get('utm_medium')),
      utm_content: trim(params.get('utm_content')),
      utm_term: trim(params.get('utm_term')),
      fbclid: trim(params.get('fbclid')),
      gclid: trim(params.get('gclid')),
      ttclid: trim(params.get('ttclid')),
      landing: location.href,
      referrer: document.referrer || '',
      ts: Date.now()
    };
  }

  function hasRealTrackingValue(tracking) {
    return Boolean(
      tracking.utm_campaign ||
      tracking.utm_source ||
      tracking.utm_medium ||
      tracking.utm_content ||
      tracking.utm_term ||
      tracking.fbclid ||
      tracking.gclid ||
      tracking.ttclid
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

  function persistUtm() {
    var userId = getUserID();
    var tracking = collectTrackingParams();

    attachUserIdToExistingTouches(userId);

    if (!hasRealTrackingValue(tracking)) {
      debugLog('skip persist: no tracking params');
      return;
    }

    var next = Object.assign({}, tracking, {
      user_id: userId || '',
      persisted_at: new Date().toISOString()
    });

    if (!Object.keys(readJson(CONFIG.firstTouchKey)).length) {
      writeJson(CONFIG.firstTouchKey, next);
    }
    writeJson(CONFIG.latestTouchKey, next);
    writeJson(CONFIG.legacyUtmKey, next);
    debugLog('tracking persisted', next);
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
      debugLog('gtag user_id set', userId);
    });
  }

  persistUtm();
  setGtagUserId();
})();
</script>

<script>
/* ── Block 2: checkout_started 이벤트 ── */
(function () {
  var CONFIG = {
    endpoint: 'https://att.ainativeos.net/api/attribution/checkout-context',
    source: 'biocom_imweb',
    measurementIds: ['G-WJFXN5E2Q1'],
    snippetVersion: '2026-04-15-biocom-checkout-started-v1',
    requestTimeoutMs: 800,
    debugQueryKey: '__seo_attribution_debug',
    checkoutIdKey: '__seo_checkout_id',
    checkoutContextKey: '__seo_checkout_context',
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
    var pattern = new RegExp('(?:^|; )' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '=([^;]*)');
    var match = document.cookie.match(pattern);
    return match ? decodeURIComponent(match[1]) : '';
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
    var params = new URLSearchParams(location.search);
    for (var i = 0; i < keys.length; i += 1) {
      var value = trim(params.get(keys[i]));
      if (value) return value;
    }
    return '';
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
    return new URLSearchParams(location.search).get(CONFIG.debugQueryKey) === '1';
  }

  function debugLog() {
    if (!isDebugMode()) return;
    try {
      console.log.apply(console, ['[seo-checkout-started]'].concat([].slice.call(arguments)));
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
      return { sentBy: 'fetch', accepted: true, status: response.status };
    });
  }

  if (!isCheckoutCandidate()) return;

  var imwebSession = readJsonStorage(window.sessionStorage, '__bs_imweb_session');
  var lastTouch = readJsonStorage(window.localStorage, '_p1s1a_last_touch');
  var checkoutId = getOrCreateCheckoutId();
  var landing = location.href;
  var initialReferrer = firstNonEmpty([
    trim(imwebSession.initialReferrer),
    trim(lastTouch.referrer),
    document.referrer || ''
  ]);
  var tracking = mergeLandingParams({
    utm_source: firstNonEmpty([trim(imwebSession.utmSource), trim(lastTouch.utm_source), getSearchParam(['utm_source'])]),
    utm_medium: firstNonEmpty([trim(imwebSession.utmMedium), trim(lastTouch.utm_medium), getSearchParam(['utm_medium'])]),
    utm_campaign: firstNonEmpty([trim(imwebSession.utmCampaign), trim(lastTouch.utm_campaign), getSearchParam(['utm_campaign'])]),
    utm_content: firstNonEmpty([trim(imwebSession.utmContent), trim(lastTouch.utm_content), getSearchParam(['utm_content'])]),
    utm_term: firstNonEmpty([trim(imwebSession.utmTerm), trim(lastTouch.utm_term), getSearchParam(['utm_term'])]),
    gclid: firstNonEmpty([trim(lastTouch.gclid), getSearchParam(['gclid'])]),
    fbclid: firstNonEmpty([trim(lastTouch.fbclid), getSearchParam(['fbclid'])]),
    ttclid: firstNonEmpty([trim(lastTouch.ttclid), getSearchParam(['ttclid'])]),
    fbc: firstNonEmpty([trim(lastTouch.fbc), readCookie('_fbc'), getSearchParam(['fbc'])]),
    fbp: firstNonEmpty([trim(lastTouch.fbp), readCookie('_fbp'), getSearchParam(['fbp'])])
  }, landing);

  var dedupeKey = CONFIG.dedupeKeyPrefix + checkoutId;
  if (hasSentMarker(dedupeKey)) {
    debugLog('skip duplicate', dedupeKey);
    return;
  }

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
        user_pseudo_id_strategy: userPseudoId && userPseudoId === clientId ? 'client_id_fallback' : 'explicit_value'
      }
    };

    writeJsonStorage(window.sessionStorage, CONFIG.checkoutContextKey, {
      checkoutId: checkoutId,
      clientObservedAt: observedAt,
      landing: landing,
      referrer: payload.referrer,
      gaSessionId: gaSessionId,
      clientId: clientId,
      userPseudoId: userPseudoId,
      customerKey: customerKey,
      snippetVersion: CONFIG.snippetVersion
    });

    debugLog('send payload', payload);
    return sendPayload(payload).then(function (result) {
      rememberSent(dedupeKey);
      debugLog('send ok', result);
      return result;
    }).catch(function (error) {
      debugLog('send failed', error && error.message ? error.message : error);
    });
  });
})();
</script>

<script>
/* ── Block 3: payment_success 이벤트 (orderCode/referrerPayment/fbc/fbp 전부 포함) ── */
(function () {
  var CONFIG = {
    endpoint: 'https://att.ainativeos.net/api/attribution/payment-success',
    source: 'biocom_imweb',
    measurementIds: ['G-WJFXN5E2Q1'],
    snippetVersion: '2026-04-15-biocom-payment-success-order-code-v1',
    requestTimeoutMs: 800,
    debugQueryKey: '__seo_attribution_debug',
    dedupeKeyPrefix: '__seo_payment_success_sent__:'
  };

  if (location.href.indexOf('shop_payment_complete') < 0 && location.href.indexOf('shop_order_done') < 0) return;

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
    var pattern = new RegExp('(?:^|; )' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '=([^;]*)');
    var match = document.cookie.match(pattern);
    return match ? decodeURIComponent(match[1]) : '';
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

  function parsePaymentParamsFromUrl(urlLike) {
    return {
      orderCode: getSearchParamFromUrl(['orderCode', 'order_code'], urlLike),
      orderNo: getSearchParamFromUrl(['orderNo', 'order_no'], urlLike),
      orderId: getSearchParamFromUrl(['orderId', 'order_id'], urlLike),
      orderMember: getSearchParamFromUrl(['orderMember', 'order_member'], urlLike),
      paymentCode: getSearchParamFromUrl(['paymentCode', 'payment_code'], urlLike),
      paymentKey: getSearchParamFromUrl(['paymentKey', 'payment_key'], urlLike),
      amount: getSearchParamFromUrl(['amount', 'totalAmount', 'total_amount'], urlLike)
    };
  }

  function getOrderIdFromDom() {
    var selectors = [
      '[data-order-no]',
      '[data-order]',
      '[class*="order-number"]',
      '[class*="order_no"]'
    ];

    for (var i = 0; i < selectors.length; i += 1) {
      var node = document.querySelector(selectors[i]);
      if (!node) continue;
      var value = firstNonEmpty([
        node.getAttribute && node.getAttribute('data-order-no'),
        node.getAttribute && node.getAttribute('data-order'),
        node.textContent
      ]);
      if (value) return value;
    }

    return '';
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
        fbclid: firstNonEmpty([base.fbclid, params.get('fbclid')]),
        ttclid: firstNonEmpty([base.ttclid, params.get('ttclid')]),
        fbc: firstNonEmpty([base.fbc, params.get('fbc')]),
        fbp: firstNonEmpty([base.fbp, params.get('fbp')])
      };
    } catch (error) {
      return base;
    }
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

  function clearCheckoutContext() {
    try {
      if (!window.sessionStorage) return;
      window.sessionStorage.removeItem('__seo_checkout_id');
      window.sessionStorage.removeItem('__seo_checkout_context');
    } catch (error) {}
  }

  function isDebugMode() {
    return new URLSearchParams(location.search).get(CONFIG.debugQueryKey) === '1';
  }

  function debugLog() {
    if (!isDebugMode()) return;
    try {
      console.log.apply(console, ['[seo-attribution]'].concat([].slice.call(arguments)));
    } catch (error) {}
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
        throw new Error('payment-success failed with ' + response.status);
      }
      return { sentBy: 'fetch', accepted: true, status: response.status };
    });
  }

  var imwebSession = readJsonStorage(window.sessionStorage, '__bs_imweb_session');
  var lastTouch = readJsonStorage(window.localStorage, '_p1s1a_last_touch');
  var checkoutContext = readJsonStorage(window.sessionStorage, '__seo_checkout_context');
  var checkoutId = firstNonEmpty([
    trim(checkoutContext.checkoutId),
    trim(imwebSession.checkoutId),
    getSearchParam(['checkoutId', 'checkout_id'])
  ]);
  var referrerPayment = parsePaymentParamsFromUrl(document.referrer);

  var orderId = firstNonEmpty([
    getSearchParam(['order_no', 'orderNo', 'orderId', 'order_id']),
    trim(referrerPayment.orderNo),
    trim(referrerPayment.orderId),
    trim(imwebSession.order_no),
    trim(imwebSession.orderId),
    trim(lastTouch.orderId),
    trim(lastTouch.order_id),
    getOrderIdFromDom()
  ]);
  var paymentKey = firstNonEmpty([
    getSearchParam(['paymentKey', 'payment_key']),
    trim(referrerPayment.paymentKey),
    trim(imwebSession.paymentKey),
    trim(imwebSession.payment_key),
    trim(lastTouch.paymentKey),
    trim(lastTouch.payment_key)
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
  var landing = firstNonEmpty([
    trim(imwebSession.utmLandingUrl),
    trim(lastTouch.landing),
    trim(checkoutContext.landing),
    location.pathname
  ]);
  var tracking = mergeLandingParams({
    utm_source: firstNonEmpty([trim(imwebSession.utmSource), trim(lastTouch.utm_source), getSearchParam(['utm_source'])]),
    utm_medium: firstNonEmpty([trim(imwebSession.utmMedium), trim(lastTouch.utm_medium), getSearchParam(['utm_medium'])]),
    utm_campaign: firstNonEmpty([trim(imwebSession.utmCampaign), trim(lastTouch.utm_campaign), getSearchParam(['utm_campaign'])]),
    utm_content: firstNonEmpty([trim(imwebSession.utmContent), trim(lastTouch.utm_content), getSearchParam(['utm_content'])]),
    utm_term: firstNonEmpty([trim(imwebSession.utmTerm), trim(lastTouch.utm_term), getSearchParam(['utm_term'])]),
    gclid: firstNonEmpty([trim(lastTouch.gclid), getSearchParam(['gclid'])]),
    fbclid: firstNonEmpty([trim(lastTouch.fbclid), getSearchParam(['fbclid'])]),
    ttclid: firstNonEmpty([trim(lastTouch.ttclid), getSearchParam(['ttclid'])]),
    fbc: firstNonEmpty([trim(lastTouch.fbc), readCookie('_fbc'), getSearchParam(['fbc'])]),
    fbp: firstNonEmpty([trim(lastTouch.fbp), readCookie('_fbp'), getSearchParam(['fbp'])])
  }, landing);

  var dedupeKey = CONFIG.dedupeKeyPrefix + firstNonEmpty([
    orderCode,
    orderId,
    paymentKey,
    location.pathname + '::' + document.referrer
  ]);
  if (dedupeKey && hasSentMarker(dedupeKey)) {
    debugLog('skip duplicate', dedupeKey);
    return;
  }

  Promise.all([
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

    var payload = {
      touchpoint: 'payment_success',
      captureMode: 'live',
      source: CONFIG.source,
      orderId: orderId,
      orderCode: orderCode,
      orderMember: orderMember,
      paymentKey: paymentKey,
      checkoutId: checkoutId,
      clientObservedAt: new Date().toISOString(),
      referrer: document.referrer || '',
      landing: landing,
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
        imweb_landing_url: trim(imwebSession.utmLandingUrl),
        initial_referrer: firstNonEmpty([trim(imwebSession.initialReferrer), trim(lastTouch.referrer)]),
        original_referrer: firstNonEmpty([trim(imwebSession.initialReferrer), trim(lastTouch.referrer)]),
        fbc: tracking.fbc,
        fbp: tracking.fbp,
        checkout_started_observed_at: trim(checkoutContext.clientObservedAt),
        checkout_started_landing: trim(checkoutContext.landing),
        checkout_started_snippet_version: trim(checkoutContext.snippetVersion),
        user_pseudo_id_strategy: userPseudoId && userPseudoId === clientId ? 'client_id_fallback' : 'explicit_value',
        orderCode: orderCode,
        order_code: orderCode,
        orderMember: orderMember,
        order_member: orderMember,
        browser_purchase_event_id: orderCode ? 'Purchase.' + orderCode : '',
        referrerPayment: {
          orderCode: orderCode || trim(referrerPayment.orderCode),
          orderNo: orderId || trim(referrerPayment.orderNo),
          orderId: trim(referrerPayment.orderId),
          orderMember: orderMember || trim(referrerPayment.orderMember),
          paymentCode: trim(referrerPayment.paymentCode),
          paymentKey: paymentKey || trim(referrerPayment.paymentKey),
          amount: trim(referrerPayment.amount)
        }
      }
    };

    if (
      !payload.orderId &&
      !payload.paymentKey &&
      !payload.orderCode &&
      payload.referrer.indexOf('paymentKey=') < 0 &&
      payload.referrer.indexOf('payment_key=') < 0 &&
      payload.referrer.indexOf('orderNo=') < 0 &&
      payload.referrer.indexOf('order_no=') < 0 &&
      payload.referrer.indexOf('orderId=') < 0 &&
      payload.referrer.indexOf('order_id=') < 0 &&
      payload.referrer.indexOf('orderCode=') < 0 &&
      payload.referrer.indexOf('order_code=') < 0
    ) {
      debugLog('skip: no order/payment/orderCode hint', payload);
      return;
    }

    debugLog('send payload', payload);
    return sendPayload(payload).then(function (result) {
      if (dedupeKey) rememberSent(dedupeKey);
      clearCheckoutContext();
      debugLog('send ok', result);
      return result;
    }).catch(function (error) {
      debugLog('send failed', error && error.message ? error.message : error);
    });
  });
})();
</script>

<!--
  Phase 9 Funnel CAPI mirror — biocom v3 (fbq interceptor + eventId injector)

  단계별 config 전환:
    0) 코드 주입 직후 (무해 dry-run): enableServerCapi=false, debug=true
       → Phase 9 는 aimweb 의 fbq 호출에 eventId 를 주입하지만 서버로는 아무것도 안 쏨.
       → 브라우저 Meta 이벤트는 여전히 aimweb 이 주체, Phase 9 는 eid 주입 효과만 관찰.
       → 주의: eid 주입은 실 픽셀에 영향을 줌 (aimweb 호출이 실제로 eid 달고 나감).
               따라서 "진짜 완전 무해" 는 아니지만, 기존 browser 이벤트 자체를 중복시키진 않음.
               Meta 의 기존 카운트와 동일한 수량 + eid 가 새로 붙은 것만 변경됨.
    1) 서버만 테스트 (Test Events 탭):
       enableServerCapi=true, testEventCode='TEST_XXX'
       → 서버 CAPI 가 testEventCode 를 달고 Events Manager 테스트 탭으로만 수신됨.
       → 정규 카운트 영향 없음.
    2) 정식 운영:
       enableServerCapi=true, testEventCode='', debug=false
       → 서버 CAPI 정상 송신. Meta 가 browser(aimweb)+server(Phase 9) 쌍을 eventId 로 dedup.
-->
<script>
  window.FUNNEL_CAPI_CONFIG = {
    pixelId: '1283400029487161',
    endpoint: 'https://att.ainativeos.net/api/meta/capi/track',
    enableServerCapi: false,
    testEventCode: '',
    debug: true
  };
</script>

<script>
/*!
 * Phase 9 — Funnel CAPI mirror (biocom) v3
 * 2026-04-15-biocom-funnel-capi-v3
 *
 * 전략: window.fbq 를 wrap 하여 aimweb 이 이미 쏘고 있는 ViewContent / AddToCart /
 * InitiateCheckout / AddPaymentInfo track 호출을 가로챈다.
 *   - eventID 가 없으면 결정론적 id 를 주입 (ViewContent.<prod>.<sessionId>)
 *   - 같은 id 로 서버 CAPI 로 mirror
 *   - Meta 가 browser+server 자동 dedup → 중복 없음
 *
 * Purchase Guard v3 의 fbq wrap 은 그대로 유지된다. Phase 9 mirror 는 Purchase Guard
 * 보다 바깥쪽에서 돌고, 내부 호출 경로는:
 *   aimweb → Phase 9 mirror → Purchase Guard → 원본 fbq → HTTP /tr/
 */
(function () {
  'use strict';
  var cfg = window.FUNNEL_CAPI_CONFIG || {};
  var SNIPPET_VERSION = '2026-04-15-biocom-funnel-capi-v3';
  var ENDPOINT = cfg.endpoint || 'https://att.ainativeos.net/api/meta/capi/track';
  var PIXEL_ID = cfg.pixelId;
  var ENABLE_SERVER_CAPI = !!cfg.enableServerCapi;
  var TEST_CODE = cfg.testEventCode || '';
  var DEBUG = !!cfg.debug;

  if (!PIXEL_ID) {
    console.warn('[funnel-capi] FUNNEL_CAPI_CONFIG.pixelId missing — aborting');
    return;
  }
  if (window.__FUNNEL_CAPI_INSTALLED) return;
  window.__FUNNEL_CAPI_INSTALLED = SNIPPET_VERSION;

  /* ── 유틸 ──────────────────────────────────────────────────────────── */
  function log() {
    if (!DEBUG) return;
    try { console.info.apply(console, ['[funnel-capi]'].concat([].slice.call(arguments))); }
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
    // AddPaymentInfo 류는 content_ids 가 없을 수 있음 → value 기반 fallback
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
    if (orig.__FUNNEL_CAPI_V3_WRAPPED__) {
      log('fbq already wrapped — skip');
      return;
    }

    var mirror = function () {
      var args = Array.prototype.slice.call(arguments);

      try {
        if (args[0] === 'track' && MIRROR_EVENTS[args[1]]) {
          var eventName = args[1];
          var payload = safeObj(args[2]);
          var eventMeta = safeObj(args[3]);
          var idRes = ensureEventId(eventName, payload, eventMeta);

          if (idRes.injected) {
            // aimweb 의 원래 호출에 eventId 를 주입해서 browser 쪽도 eid 달고 나가게 함
            var merged = {};
            for (var k in eventMeta) if (Object.prototype.hasOwnProperty.call(eventMeta, k)) merged[k] = eventMeta[k];
            merged.eventID = idRes.id;
            args[3] = merged;
            log('inject eid', eventName, idRes.id, 'payload=', payload);
          } else {
            log('reuse eid', eventName, idRes.id);
          }

          // 서버 mirror (비동기, 원본 호출을 block 하지 않음)
          serverMirror(eventName, idRes.id, payload);
        }
      } catch (e) {
        log('mirror observe error', e && e.message ? e.message : e);
      }

      // Purchase Guard wrap → 원본 fbq 로 전달
      return orig.apply(this, args);
    };

    /* ── 기존 fbq 속성 / Purchase Guard 마커 보존 ──
         fbq 는 function 이면서 queue/callMethod/loaded/version/agent 등 속성을 가짐.
         Purchase Guard v3 는 __BIOCOM_SERVER_PAYMENT_DECISION_GUARD_WRAPPED__ 와
         __BIOCOM_SERVER_PAYMENT_DECISION_GUARD_RAW__ 를 붙인다. 전부 복사해서 상위로 전파. */
    try {
      for (var k in orig) {
        if (Object.prototype.hasOwnProperty.call(orig, k)) {
          try { mirror[k] = orig[k]; } catch (copyErr) {}
        }
      }
    } catch (e) {}
    // 명시적으로 중요 속성 복사 (for-in 으로 못 잡을 수 있음)
    if (orig.callMethod) mirror.callMethod = orig.callMethod;
    if (orig.queue) mirror.queue = orig.queue;
    if (orig.loaded) mirror.loaded = orig.loaded;
    if (orig.version) mirror.version = orig.version;
    if (orig.agent) mirror.agent = orig.agent;
    if (orig._fbq) mirror._fbq = orig._fbq;
    if (orig.push) mirror.push = orig.push;
    // Purchase Guard 마커 전파
    if (orig.__BIOCOM_SERVER_PAYMENT_DECISION_GUARD_WRAPPED__) {
      mirror.__BIOCOM_SERVER_PAYMENT_DECISION_GUARD_WRAPPED__ = true;
    }
    if (orig.__BIOCOM_SERVER_PAYMENT_DECISION_GUARD_RAW__) {
      mirror.__BIOCOM_SERVER_PAYMENT_DECISION_GUARD_RAW__ = orig.__BIOCOM_SERVER_PAYMENT_DECISION_GUARD_RAW__;
    }
    mirror.__FUNNEL_CAPI_V3_WRAPPED__ = true;

    window.fbq = mirror;
    // _fbq 별칭도 동기화 (Meta pixel base code 가 참조)
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
</script>
