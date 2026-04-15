# The Clean Coffee Meta Pixel Purchase Guard — Server Decision 2026-04-14

> **원본**: `footer/header_purchase_guard_server_decision_0412_v3.md` (biocom v3, 2026-04-12)
> **복제 사유**: 2026-04-14 검토 결과 커피 자사몰에는 Purchase guard 미적용 상태 확인. biocom 에 적용된 서버 판정 기반 가드를 커피에 동일 구조로 복제.
> **연관 문서**: [../meta/capimeta.md](../meta/capimeta.md) Phase 1b · [../capivm/capi.md](../capivm/capi.md) · [../roadmap/roadmap0327.md](../roadmap/roadmap0327.md) 0414 최우선

---

## 용도

더클린커피 가상계좌 미입금 주문완료 페이지에서 Meta Browser `Purchase`가 먼저 나가는 문제를 서버 결제상태 조회로 막는 헤더 상단 코드다.

이 코드는 `FB_PIXEL.Purchase(...)`와 직접 `fbq('track', 'Purchase', ...)` 호출을 둘 다 감싼다. biocom v3 와 동일한 로직·재시도·이미지 fallback·network observe 구조를 그대로 사용하고, 커피 도메인·pixel ID·sessionStorage 키·전역 플래그만 `THECLEANCOFFEE_` 네임스페이스로 분리했다.

커피 전용 조정점:

- `pixelId`: `1186437633687388` (커피 전용 픽셀. 2026-04-14 `993029601940881` 삭제 완료 후 단일 픽셀 상태)
- `site=thecleancoffee`, `store=thecleancoffee` 로 decision endpoint 호출
- 전역 플래그와 sessionStorage 키 이름을 biocom 것과 충돌하지 않도록 `THECLEANCOFFEE_` prefix 사용
- snippet version `2026-04-14-coffee-server-payment-decision-guard-v3`

biocom v3 의 핵심 보강 기능은 동일하게 포함:

- `Purchase` 차단 뒤 `VirtualAccountIssued`가 Meta Pixel 준비 전 타이밍에 유실되지 않도록 `fbq` 준비 재시도
- 끝까지 `fbq`가 준비되지 않으면 `https://www.facebook.com/tr/` 이미지 요청 fallback 으로 custom event 전송
- 콘솔에 decision branch · custom event 이름 · eventId · 전송 방식을 한 줄 문자열로 남김
- Chrome Network 에서 찾기 쉽도록 전송 직전 `custom_event_dispatch_start` 로그 + 검색 힌트 출력
- 전송 후 `performance` resource entry 로 `facebook.com/tr` + eventName/eventId 관측 여부 남김
- `fbq` 전송 후 Network 관측이 `found=no` 이면 같은 eventId 로 `image_fallback_after_observe_no` 1회 재송
- 주문완료 referrer 의 `orderId`, `paymentKey` 를 decision endpoint 에 같이 전달하고 `no_toss_or_ledger_match` unknown 이면 1회 재조회
- 카드 `allow_purchase` 분기에서 기존 `FB_PIXEL.Purchase` 를 먼저 살리고, Network 에 `ev=Purchase` 가 전혀 없을 때만 같은 `eventID` 로 image fallback 1회

## 삽입 위치

아임웹 **헤더 상단 코드 최상단**에 넣는다. Meta Pixel, GTM, 아임웹 기본 구매 추적보다 먼저 실행되어야 한다. 구체 경로:

```
아임웹 admin → 디자인 → HTML / CSS 편집 → [head] 영역 → "사이트 전체에 적용" 최상단 블록
```

## 운영 전 필수 조건

- `https://att.ainativeos.net/api/attribution/payment-decision` 가 안정적으로 떠 있어야 한다.
- 해당 endpoint 가 `https://thecleancoffee.com` **origin 의 GET 요청을 CORS 로 허용**해야 한다. biocom 용 CORS 설정은 이미 있으므로, 설치 전에 커피 도메인이 허용 목록에 포함돼 있는지 확인.
- endpoint 가 `site=thecleancoffee` 파라미터를 처리해 커피 attribution ledger 에서 조회할 수 있어야 한다. 현재 backend 가 biocom 만 하드코딩돼 있다면 동일한 결제 판정 로직을 thecleancoffee 분기에 추가해야 한다. (§ 배포 전 backend 체크리스트 참조)
- endpoint 장애가 길면 카드 결제 Browser Purchase 도 보류될 수 있으므로, 노트북/터널 상태에서는 삽입하지 않는다.

## 헤더 상단 코드

```html
<script>
(function () {
  var CONFIG = {
    snippetVersion: '2026-04-14-coffee-server-payment-decision-guard-v3',
    pixelId: '1186437633687388',
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
    logPrefix: '[thecleancoffee-server-payment-decision-guard]'
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
  if (window.__THECLEANCOFFEE_SERVER_PAYMENT_DECISION_GUARD_INSTALLED__) return;
  window.__THECLEANCOFFEE_SERVER_PAYMENT_DECISION_GUARD_INSTALLED__ = true;

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
    url.searchParams.set('site', 'thecleancoffee');
    url.searchParams.set('store', 'thecleancoffee');
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
    return fbq.__THECLEANCOFFEE_SERVER_PAYMENT_DECISION_GUARD_RAW__ || fbq;
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
      window.sessionStorage.setItem('__thecleancoffee_server_payment_decision__:' + (context.eventId || context.orderCode || context.orderNo || context.paymentCode), JSON.stringify({
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
      window.__THECLEANCOFFEE_SERVER_PAYMENT_DECISION_LAST__ = fields;
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
    if (pixel.__THECLEANCOFFEE_SERVER_PAYMENT_DECISION_GUARD_WRAPPED__) return true;

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

    pixel.__THECLEANCOFFEE_SERVER_PAYMENT_DECISION_GUARD_WRAPPED__ = true;
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
    if (currentFbq.__THECLEANCOFFEE_SERVER_PAYMENT_DECISION_GUARD_WRAPPED__) return true;

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

    guardedFbq.__THECLEANCOFFEE_SERVER_PAYMENT_DECISION_GUARD_WRAPPED__ = true;
    guardedFbq.__THECLEANCOFFEE_SERVER_PAYMENT_DECISION_GUARD_RAW__ = rawFbq;
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
VirtualAccountIssued 있음 (eventId = VirtualAccountIssued.{order_code})
Console: [thecleancoffee-server-payment-decision-guard] decision branch=block_purchase_virtual_account status=pending
```

카드 결제 완료:

```text
Purchase 있음
Event ID = Purchase.{order_code}
Console: [thecleancoffee-server-payment-decision-guard] decision branch=allow_purchase status=confirmed
```

가상계좌 입금 후 confirmed 전환 (backend attribution status sync 처리):

```text
Browser 측에서는 추가 이벤트 없음 (이미 주문완료 페이지는 닫힌 상태)
Server CAPI Purchase 1회 전송 (metaCapi.ts auto_sync)
event_id = Purchase.{order_code}
```

## 중요한 한계

biocom v3 와 동일. endpoint 가 `unknown` 또는 장애를 반환하면 `PurchaseDecisionUnknown` 만 보내고 `Purchase` 는 보내지 않는다. Meta ROAS 과대 오염을 줄이는 정책으로는 맞지만, 안정 서버 없이 운영 삽입하면 카드 Purchase 누락이 생길 수 있다.

---

## 배포 전 backend 체크리스트 (반드시 사전 확인)

> 2026-04-14 실측 결과가 아래 각 항목에 기재됨. `meta/capimeta.md` 의 "Phase 1b 배포 체크리스트 실측 결과" 와 동일 내용.

이 스크립트는 클라이언트 측이다. 아래 항목이 backend 에 준비되지 않으면 카드 Purchase 도 unknown 으로 blocked 됨:

### 1. CORS 허용 확인

`backend/src/bootstrap/configureMiddleware.ts` 의 CORS origin 화이트리스트에 아래가 포함돼야 한다:

```
https://thecleancoffee.com
https://www.thecleancoffee.com
https://thecleancoffee.imweb.me
```

확인 방법:

```bash
curl -s -X GET \
  -H "Origin: https://thecleancoffee.com" \
  -I "https://att.ainativeos.net/api/attribution/payment-decision?site=thecleancoffee&store=thecleancoffee&order_code=TEST"
# 응답 헤더에 Access-Control-Allow-Origin: https://thecleancoffee.com 가 있어야 함
```

### 2. `site=thecleancoffee` 분기 지원 확인

`backend/src/routes/attribution.ts` 의 `payment-decision` handler 가 `site` 파라미터를 받아 `thecleancoffee` 분기에서 커피 attribution ledger + Toss coffee secret key 로 조회하는지 확인.

grep:

```bash
rg 'payment-decision' backend/src/routes/attribution.ts
rg "'thecleancoffee'|\"thecleancoffee\"" backend/src/routes/attribution.ts
```

현재 biocom 만 하드코딩돼 있다면 아래 작업이 필요:
- `site` 쿼리 파라미터 → store 맵 (`biocom` / `thecleancoffee`)
- 분기: biocom 은 `TOSS_LIVE_SECRET_KEY`, 커피는 `TOSS_LIVE_SECRET_KEY_COFFEE`
- attribution ledger 조회 시 `site` 필드 필터 추가
- response 구조는 biocom 과 동일 (`{ ok, decision: { status, browserAction, reason, matchedBy, confidence } }`)

### 3. 커피 Toss secret key 확보 — ✅ **실측 결과: 이미 존재 (해소)**

**실측 (2026-04-14)**: `backend/.env` 에 다음이 저장돼 있음:

```
TOSS_SHOP_ID_COFFEE=iw_thecleaz5j
TOSS_LIVE_CLIENT_KEY_COFFEE_API=live_ck_DpexMgkW3679vRBb0zM9VGbR5ozO
TOSS_LIVE_SECRET_KEY_COFFEE_API=live_sk_P9BRQmyarY5vo1LoGNjNrJ07KzLN
TOSS_LIVE_SECURITY_KEY_COFFEE_API=a7c513ab00be2826bab52c1e0cf3c7065c9f3281bf0875c69662bde5d0fdee41
TOSS_TEST_CLIENT_KEY_COFFEE=test_gck_DnyRpQWGrN5YGX0qnpp2VKwv1M9E
TOSS_TEST_SECRET_KEY_COFFEE=test_gsk_DLJOpm5Qrl7Rdqb2yZ9PVPNdxbWn
TOSS_TEST_CLIENT_KEY_COFFEE_API=test_ck_KNbdOvk5rk1jbgBbKZBv3n07xlzm
TOSS_TEST_SECRET_KEY_COFFEE_API=test_sk_XZYkKL4MrjDvZ1LKROYA30zJwlEW
TOSS_TEST_SECURITY_KEY_COFFEE_API=f5dbe2295eb3f3db20a0aa19a55e68ca83f0f12b0da3e2b6019fe9374a909fc5
```

**키 이름 주의**: live secret key 는 `TOSS_LIVE_SECRET_KEY_COFFEE` 가 아니라 **`TOSS_LIVE_SECRET_KEY_COFFEE_API`** (뒤에 `_API` 접미사) 로 저장돼 있음. 하지만 `backend/src/env.ts:17-18` 에서 fallback 처리를 해서 코드 내부에선 `env.TOSS_LIVE_SECRET_KEY_COFFEE` 로 접근 가능:

```typescript
TOSS_LIVE_SECRET_KEY_COFFEE:
  process.env.TOSS_LIVE_SECRET_KEY_COFFEE ?? process.env.TOSS_LIVE_SECRET_KEY_COFFEE_API,
```

실사용 확인: `tossConfig.ts:45`, `metaCapi.ts:876` 에서 이미 커피 분기로 사용 중. **새로 발급받을 필요 없음**. 이 항목은 선결 과제에서 제외.

### 4. 커피 attribution ledger 동기화 — 🔴 **실측 결과: 자동 sync 부재가 근본 원인**

**실측 DB 상태 (`backend/data/crm.sqlite3`, 2026-04-14 기준)**:

| 사이트 | imweb_orders 총 | 최신 주문 시각 | 마지막 synced_at | 경과일 |
|---|---|---|---|---|
| biocom | 8,362건 | 2026-04-12 11:54 KST | 2026-04-12 12:03 KST | 2일 |
| **coffee** | **1,937건** | **2026-04-04 10:38 KST** | **2026-04-04 13:18 KST** | **10일** ❌ |

**"왜 멈췄나" — 원인 확정**:

`backend/src/bootstrap/startBackgroundJobs.ts` 를 전수 검토한 결과, 자동으로 돌고 있는 job 은 다음 3종뿐:

| Background Job | 주기 | 대상 |
|---|---|---|
| ✅ `[CAPI auto-sync]` | 30분 | Meta CAPI Purchase 이벤트 전송 |
| ✅ `[Attribution status sync]` | 15분 | attribution ledger pending→confirmed 전환 |
| ✅ `[Scheduled send]` | 60초 | 알림톡/SMS 예약 발송 |

**❌ 자동화 안 돼 있는 것**:
- `imweb_orders` sync (아임웹 주문 동기화)
- `toss_settlements` sync (Toss 정산 동기화)

이 둘은 `POST /api/crm-local/imweb/sync-orders` 와 `POST /api/toss/sync` 로 **수동 호출**해야만 실행됨. biocom/coffee 양쪽 **모두 자동 sync 가 아님**. biocom 이 `2026-04-12` 까지 업데이트된 것은 누군가 4/12 에 수동 실행했기 때문이고, coffee 가 4/4 에서 멈춘 것은 그 이후 수동 실행이 없었기 때문이다.

즉 **"커피가 뒤처진 이유는 사이트 차이가 아니라 운영자 수동 루틴에서 커피 쪽이 누락된 것"**. biocom 도 4/12 이후 수동 실행이 없으면 같은 방식으로 정체될 수 있음.

**왜 자동화 안 됐나 (추정)**:
1. 아임웹/Toss API 의 pagination 이 수천 행 단위로 길게 걸려 background setInterval 에서 돌리면 long-running 리스크
2. 운영 초기 ledger 무결성을 사람이 수동 확인하는 걸 선호해서 유보
3. `capivm/capi.md` 와 `roadmap0327.md` 0411 기록상 수동 실행은 정기 루틴으로 간주됐지만 문서 어디에도 "몇 시간 간격" 이 명시되지 않음 → 실제로는 부정기

**해결 — 2단계**:

1. **즉시 복구 (수동 1회)**: 커피 가드 설치 전 반드시 실행
   ```bash
   curl -X POST "http://localhost:7020/api/crm-local/imweb/sync-orders" \
     -H "Content-Type: application/json" -d '{"site":"thecleancoffee"}'
   curl -X POST "http://localhost:7020/api/toss/sync?store=thecleancoffee&mode=incremental"
   ```
2. **근본 해결 (P1 별도 작업)**: `startBackgroundJobs.ts` 에 imweb/toss 자동 sync 등록 — 6시간 주기, KST 새벽 off-peak 실행 권고. Phase 1b 와 독립적으로 진행 가능.

이 상태로 가드만 설치하면 최근 10일 내 커피 주문은 전부 `no_toss_or_ledger_match` unknown 으로 처리되어 `PurchaseDecisionUnknown` 이벤트로만 전송됨 (= 카드 Purchase 도 차단). **설치 전 수동 복구 최소 1회 필수**.

**biocom vs coffee 비교**:

| 축 | biocom | coffee | 비고 |
|---|---|---|---|
| imweb sync 자동화 | ❌ 없음 | ❌ 없음 | 공통 |
| Toss sync 자동화 | ❌ 없음 | ❌ 없음 | 공통 |
| 최근 수동 sync 일시 | 2026-04-12 | 2026-04-04 | **운영 루틴 차이** |
| Attribution status sync | ✅ 15분 자동 | ✅ 15분 자동 | 공통 (위 background job) |
| CAPI Purchase 전송 | ✅ 30분 자동 | ✅ 30분 자동 | 공통 |

즉 **실시간 전환 전송 경로는 두 사이트가 동일하게 자동화** 돼 있지만, 그 전 단계인 **원장 원천 데이터 sync 는 두 사이트 모두 수동**. 커피가 뒤처진 것은 단순히 수동 루틴에서 누락됐기 때문.

---

## 설치 순서 체크리스트

- [ ] 1. backend 체크리스트 4 항목 전부 통과
- [ ] 2. 아임웹 admin → 디자인 → HTML/CSS → head 영역 "사이트 전체" 최상단에 본 스크립트 붙여넣기
- [ ] 3. 아임웹 저장 후 `https://thecleancoffee.com` 공개 페이지에서 개발자도구 Network 로 본 스크립트가 로드되는지 확인
- [ ] 4. 아무 상품 페이지 접근 → console 에 `[thecleancoffee-server-payment-decision-guard] installed 2026-04-14-coffee-server-payment-decision-guard-v3` 확인
- [ ] 5. **테스트 주문 1 — 카드 결제**: 최저가 커피 1봉 → 카드 결제 → 주문완료 페이지에서:
  - Console: `decision branch=allow_purchase status=confirmed`
  - Network: `facebook.com/tr` 에 `ev=Purchase`, `eid=Purchase.{order_code}` 확인
- [ ] 6. **테스트 주문 2 — 가상계좌 미입금**: 최저가 커피 1봉 → 가상계좌 결제 → 주문완료 페이지에서:
  - Console: `decision branch=block_purchase_virtual_account status=pending`
  - Network: `facebook.com/tr` 에 `ev=Purchase` **없음**, `ev=VirtualAccountIssued` 있음
- [ ] 7. **테스트 주문 3 — 가상계좌 입금 후 confirmed 전환**: 6번 테스트 주문을 실제 입금 → 24시간 내 Server CAPI 로그에서 `Purchase.{order_code}` 1회 전송 확인
- [ ] 8. `coffee/metacoffee0413.md` Phase 1b 완성도 0% → 100% 업데이트
- [ ] 9. `capivm/capi.md` 에 coffee 섹션 append (biocom §3,§4 와 같은 형식)
- [ ] 10. `roadmap/roadmap0327.md` 현재 진행 중 섹션의 "⚡ 최우선" 커피 Guard 항목을 ✅ 완료로 전환

---

## 롤백 경로

문제가 생기면 **아임웹 admin → 디자인 → HTML/CSS 편집 → 본 스크립트 블록 삭제 → 저장**. 2분 내 원상 복구.

롤백 시 부작용:
- 커피 가상계좌 미입금 주문은 다시 Browser Pixel `Purchase` 로 전송될 수 있음 (원래 상태 = 현재 상태)
- Server CAPI `confirmed-only` 정책은 그대로라 Server 측 매출은 오염되지 않음
- Meta ROAS 는 브라우저 Purchase 오염 가능성이 있는 baseline 으로 복귀

---

**요지**: biocom v3 의 927줄 guard 를 커피에 복제한 것. 클라이언트 로직은 100% 동일하고 `site/store/pixelId/namespace` 4축만 치환했다. 설치 전 backend `payment-decision` endpoint 가 `site=thecleancoffee` 분기를 실제로 처리하는지, CORS 가 커피 도메인을 허용하는지, 커피 Toss secret key 가 있는지, 커피 Imweb+Toss sync 가 최신 상태인지 4가지를 **반드시** 확인해야 한다. 이 4가지를 건너뛰고 설치하면 카드 결제도 unknown 으로 blocked 되어 실제 Purchase 이벤트 누락이 발생한다.
