# Biocom Meta Pixel Purchase Guard - Server Decision Draft 2026-04-12

## 용도

브라우저 문구 기반 `Purchase` 차단 대신, 서버의 결제 상태 판정 API를 조회해 Meta Browser `Purchase`를 보낼지 결정하는 상단 코드 초안이다.

이 코드는 바로 운영 삽입용이 아니라, `https://att.ainativeos.net/api/attribution/payment-decision`이 안정적인 서버에서 배포된 뒤 교체할 최종형 후보이다.

## 상단 코드

```html
<script>
(function () {
  var CONFIG = {
    snippetVersion: '2026-04-12-server-payment-decision-guard-draft-v1',
    decisionEndpoint: 'https://att.ainativeos.net/api/attribution/payment-decision',
    vbankEventName: 'VirtualAccountIssued',
    unknownEventName: 'PurchaseDecisionUnknown',
    blockedEventName: 'PurchaseBlocked',
    requestTimeoutMs: 3000,
    holdMs: 200,
    wrapPollMs: [0, 100, 300, 700, 1500, 3000, 5000],
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
      paymentCode: firstNonEmpty([
        getSearchParam(['payment_code', 'paymentCode']),
        getSearchParam(['payment_code', 'paymentCode'], document.referrer)
      ])
    };
  }

  function buildDecisionUrl(context) {
    var url = new URL(CONFIG.decisionEndpoint);
    url.searchParams.set('site', 'biocom');
    url.searchParams.set('store', 'biocom');
    if (context.orderCode) url.searchParams.set('order_code', context.orderCode);
    if (context.orderNo) url.searchParams.set('order_no', context.orderNo);
    if (context.paymentCode) url.searchParams.set('payment_code', context.paymentCode);
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
      });
    }).finally(function () {
      window.clearTimeout(timer);
    });
  }

  function queryDecision(context) {
    var url = buildDecisionUrl(context);
    return fetchWithTimeout(url, CONFIG.requestTimeoutMs)
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

  function storeDecision(context, decision, eventName) {
    try {
      window.sessionStorage.setItem('__biocom_server_payment_decision__:' + context.eventId, JSON.stringify({
        storedAt: new Date().toISOString(),
        snippetVersion: CONFIG.snippetVersion,
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

  function trackCustom(name, value, currency, context, decision) {
    if (typeof window.fbq !== 'function') return;
    window.fbq('trackCustom', name, {
      value: Number(value) || 0,
      currency: currency || 'KRW',
      order_code: context.orderCode,
      order_no: context.orderNo,
      payment_code: context.paymentCode,
      original_purchase_event_id: context.eventId,
      payment_decision_status: decision.status || 'unknown',
      payment_decision_reason: decision.reason || '',
      snippet_version: CONFIG.snippetVersion
    }, {
      eventID: name + '.' + firstNonEmpty([context.orderCode, context.orderNo, context.paymentCode, context.eventId, String(Date.now())])
    });
  }

  function wrapFbPixel(pixel) {
    if (!pixel || typeof pixel.Purchase !== 'function') return false;
    if (pixel.__BIOCOM_SERVER_PAYMENT_DECISION_GUARD_WRAPPED__) return true;

    var originalPurchase = pixel.Purchase;

    pixel.Purchase = function (value, currency, eventId, fbExternalId) {
      var self = this;
      var args = arguments;
      var context = buildContext(eventId);

      window.setTimeout(function () {
        queryDecision(context).then(function (decision) {
          if (window.console && console.info) {
            console.info(CONFIG.logPrefix, 'Purchase decision', {
              context: context,
              decision: decision
            });
          }

          if (decision.browserAction === 'allow_purchase') {
            storeDecision(context, decision, 'Purchase');
            originalPurchase.apply(self, args);
            return;
          }

          if (decision.browserAction === 'block_purchase_virtual_account') {
            storeDecision(context, decision, CONFIG.vbankEventName);
            trackCustom(CONFIG.vbankEventName, value, currency, context, decision);
            return;
          }

          if (decision.browserAction === 'block_purchase') {
            storeDecision(context, decision, CONFIG.blockedEventName);
            trackCustom(CONFIG.blockedEventName, value, currency, context, decision);
            return;
          }

          storeDecision(context, decision, CONFIG.unknownEventName);
          trackCustom(CONFIG.unknownEventName, value, currency, context, decision);
        });
      }, CONFIG.holdMs);
    };

    pixel.__BIOCOM_SERVER_PAYMENT_DECISION_GUARD_WRAPPED__ = true;
    if (window.console && console.info) {
      console.info(CONFIG.logPrefix, 'FB_PIXEL.Purchase wrapped', CONFIG.snippetVersion);
    }
    return true;
  }

  var activeFbPixel = window.FB_PIXEL;

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
    }, ms);
  });

  if (window.console && console.info) {
    console.info(CONFIG.logPrefix, 'installed', CONFIG.snippetVersion);
  }
})();
</script>
```

## unknown 정책

이 초안은 `unknown` 또는 endpoint 장애 시 Browser `Purchase`를 보내지 않고 `PurchaseDecisionUnknown`만 보낸다.

이유는 Meta ROAS 과대 오염을 줄이는 것이 현재 목적이기 때문이다. 다만 endpoint가 노트북/터널처럼 불안정한 상태면 카드 구매도 누락될 수 있으므로, 안정적인 VM/Cloud Run 배포 전에는 운영 교체하면 안 된다.
