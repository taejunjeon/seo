# Biocom Meta Pixel Purchase Guard - Server Decision v3 2026-04-12

## 용도

가상계좌 미입금 주문완료 페이지에서 Meta Browser `Purchase`가 먼저 나가는 문제를 서버 결제상태 조회로 막는 헤더 상단 코드다.

이 코드는 `FB_PIXEL.Purchase(...)`와 직접 `fbq('track', 'Purchase', ...)` 호출을 둘 다 감싼다. 기존 문구 기반 v3/v4 Guard보다 안정적이지만, `decisionEndpoint`가 안정적인 HTTPS 백엔드에 배포된 뒤에만 운영 삽입해야 한다.

v3 보강점:

- `Purchase` 차단 뒤 `VirtualAccountIssued`가 Meta Pixel 준비 전 타이밍에 유실되지 않도록 `fbq` 준비 재시도를 넣었다.
- 끝까지 `fbq`가 준비되지 않으면 `https://www.facebook.com/tr/` 이미지 요청 fallback으로 custom event를 보낸다.
- 콘솔에 decision branch, custom event 이름, eventId, 전송 방식(`fbq` 또는 `image_fallback`)을 한 줄 문자열로 남긴다.
- Chrome Network에서 찾기 쉽도록 전송 직전에 `custom_event_dispatch_start` 로그와 검색 힌트(`facebook.com/tr`, eventName, eventId)를 남긴다.
- 전송 후 브라우저 `performance` resource entry에서 `facebook.com/tr` + eventName/eventId가 관측되는지 `custom_event_network_observed` 로그로 남긴다.
- `fbq` 전송 후에도 Network 관측이 `found=no`이면 같은 eventId로 `image_fallback_after_observe_no`를 1회만 보낸다.
- 주문완료 referrer의 `orderId`, `paymentKey`를 decision endpoint에 같이 보내고, `no_toss_or_ledger_match` unknown이면 짧게 1회 재조회한다.
- 카드 `allow_purchase` 분기에서는 기존 `FB_PIXEL.Purchase`를 먼저 살리고, Network에 `ev=Purchase`가 전혀 없을 때만 같은 `eventID`로 `facebook.com/tr` image fallback을 1회 보낸다.

## 삽입 위치

아임웹 **헤더 상단 코드 최상단**에 넣는다. Meta Pixel, GTM, 아임웹 기본 구매 추적보다 먼저 실행되어야 한다.

## 운영 전 필수 조건

- `https://att.ainativeos.net/api/attribution/payment-decision` 또는 실제 운영 backend URL이 안정적으로 떠 있어야 한다.
- 해당 endpoint가 `https://biocom.kr` origin의 GET 요청을 CORS로 허용해야 한다.
- endpoint 장애가 길면 카드 결제 Browser Purchase도 보류될 수 있으므로, 노트북/터널 상태에서는 삽입하지 않는다.

## 헤더 상단 코드

```html
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
```

## 검증 기대값

가상계좌 미입금 주문완료:

```text
Purchase 없음
VirtualAccountIssued 있음
```

카드 결제 완료:

```text
Purchase 있음
Event ID = Purchase.{order_code}
```

## 중요한 한계

이 코드는 endpoint가 `unknown` 또는 장애를 반환하면 `PurchaseDecisionUnknown`만 보내고 `Purchase`는 보내지 않는다. Meta ROAS 과대 오염을 줄이는 정책으로는 맞지만, 안정 서버 없이 운영 삽입하면 카드 Purchase 누락이 생길 수 있다.
