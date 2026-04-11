# Biocom Meta Pixel Purchase Guard 2026-04-12

아임웹 **헤더 코드 상단** 또는 Meta Pixel/GTM보다 먼저 실행되는 위치에 넣는 스니펫입니다.

목적은 가상계좌/무통장 **미입금 주문완료 화면에서만** 브라우저 Meta Pixel `Purchase` 발화를 막고, 대신 `VirtualAccountIssued` 커스텀 이벤트로 낮추는 것입니다. 카드 결제처럼 실제 결제가 끝난 주문의 `Purchase`는 그대로 통과시킵니다.

중요:

- 이 코드는 서버 CAPI를 막지 않습니다. 브라우저 Pixel `Purchase`만 감쌉니다.
- 반드시 Meta Pixel 기본 코드보다 먼저 실행되어야 합니다. 푸터 하단에만 넣으면 이미 발화된 `Purchase`는 막지 못할 수 있습니다.
- 카드 결제 확인 후 `Purchase`가 정상 발화되는지, 가상계좌 미입금 주문완료에서는 `Purchase`가 사라지고 `VirtualAccountIssued`만 남는지 Meta Pixel Helper로 확인해야 합니다.

```html
<script>
(function () {
  var CONFIG = {
    snippetVersion: '2026-04-12-vbank-purchase-guard-v1',
    vbankEventName: 'VirtualAccountIssued',
    holdMs: 700,
    logPrefix: '[biocom-purchase-guard]'
  };

  function safeString(value) {
    if (value === null || value === undefined) return '';
    return String(value);
  }

  function lower(value) {
    return safeString(value).toLowerCase();
  }

  function isPaymentCompletePage() {
    var path = lower(window.location.pathname);
    return path.indexOf('shop_payment_complete') >= 0 || path.indexOf('shop_order_done') >= 0;
  }

  if (!isPaymentCompletePage()) return;
  if (window.__BIOCOM_PURCHASE_GUARD_INSTALLED__) return;
  window.__BIOCOM_PURCHASE_GUARD_INSTALLED__ = true;

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

  function firstNonEmpty(values) {
    for (var i = 0; i < values.length; i += 1) {
      var value = safeString(values[i]).trim();
      if (value) return value;
    }
    return '';
  }

  function getOrderCodeFromEventId(eventId) {
    var value = safeString(eventId);
    var match = value.match(/^Purchase\.(o[0-9A-Za-z_-]+)$/);
    return match ? match[1] : '';
  }

  function getEventIdFromArgs(args) {
    var options = args[3] && typeof args[3] === 'object' ? args[3] : undefined;
    if (lower(args[0]) === 'tracksingle') {
      options = args[4] && typeof args[4] === 'object' ? args[4] : options;
    }
    return options && options.eventID ? safeString(options.eventID) : '';
  }

  function getPurchaseParamsFromArgs(args) {
    if (lower(args[0]) === 'tracksingle') {
      return args[3] && typeof args[3] === 'object' ? args[3] : {};
    }
    return args[2] && typeof args[2] === 'object' ? args[2] : {};
  }

  function getOrderContext(args) {
    var eventId = getEventIdFromArgs(args);
    var orderCode = firstNonEmpty([
      getSearchParam(['order_code', 'orderCode']),
      getSearchParam(['orderCode', 'order_code'], document.referrer),
      getOrderCodeFromEventId(eventId)
    ]);
    var orderNo = firstNonEmpty([
      getSearchParam(['order_no', 'orderNo', 'order_id', 'orderId']),
      getSearchParam(['orderNo', 'order_no', 'orderId', 'order_id'], document.referrer)
    ]);
    var paymentCode = firstNonEmpty([
      getSearchParam(['payment_code', 'paymentCode']),
      getSearchParam(['paymentCode', 'payment_code'], document.referrer)
    ]);
    var paymentKey = firstNonEmpty([
      getSearchParam(['paymentKey', 'payment_key']),
      getSearchParam(['paymentKey', 'payment_key'], document.referrer)
    ]);

    return {
      eventId: eventId,
      orderCode: orderCode,
      orderNo: orderNo,
      paymentCode: paymentCode,
      paymentKey: paymentKey
    };
  }

  function getPageText() {
    return lower([
      document.title,
      document.body ? document.body.innerText : '',
      document.body ? document.body.textContent : ''
    ].join(' '));
  }

  function isLikelyUnpaidVirtualAccount() {
    var text = getPageText();
    var strongMarkers = ['가상계좌', '무통장', '계좌번호', '입금기한', '입금자'];
    var weakMarkers = ['입금 대기', '입금대기', '입금 확인', '입금확인'];
    var confirmedMarkers = [
      '신용카드',
      '카드결제',
      '카드 결제',
      '간편결제',
      '네이버페이',
      '카카오페이',
      '토스페이',
      '휴대폰 결제',
      '휴대폰결제'
    ];
    var strongCount = strongMarkers.reduce(function (count, marker) {
      return count + (text.indexOf(marker) >= 0 ? 1 : 0);
    }, 0);
    var weakCount = weakMarkers.reduce(function (count, marker) {
      return count + (text.indexOf(marker) >= 0 ? 1 : 0);
    }, 0);
    var hasConfirmedNonVbankMarker = confirmedMarkers.some(function (marker) {
      return text.indexOf(marker) >= 0;
    });
    var hasVirtualAccountMarker = (
      strongCount >= 2 ||
      ((text.indexOf('가상계좌') >= 0 || text.indexOf('무통장') >= 0) && weakCount >= 1) ||
      (text.indexOf('계좌번호') >= 0 && text.indexOf('입금') >= 0)
    );
    var hasConfirmedCardMarker = (
      text.indexOf('신용카드') >= 0 ||
      text.indexOf('카드결제') >= 0 ||
      text.indexOf('카드 결제') >= 0
    );

    return hasVirtualAccountMarker && !hasConfirmedCardMarker && !hasConfirmedNonVbankMarker;
  }

  function isPurchaseCall(args) {
    var command = lower(args[0]);
    if (command === 'track') return args[1] === 'Purchase';
    if (command === 'tracksingle') return args[2] === 'Purchase';
    return false;
  }

  function copyProperties(from, to) {
    if (!from || !to) return;
    Object.keys(from).forEach(function (key) {
      try {
        if (key !== 'callMethod') to[key] = from[key];
      } catch (error) {
        // Ignore read-only properties from Meta's fbq stub.
      }
    });
  }

  function buildVirtualAccountArgs(originalArgs) {
    var command = lower(originalArgs[0]);
    var purchaseParams = getPurchaseParamsFromArgs(originalArgs);
    var context = getOrderContext(originalArgs);
    var params = {};

    Object.keys(purchaseParams || {}).forEach(function (key) {
      params[key] = purchaseParams[key];
    });

    params.payment_status = 'pending';
    params.payment_method = 'virtual_account';
    params.order_code = context.orderCode;
    params.order_no = context.orderNo;
    params.payment_code = context.paymentCode;
    params.payment_key = context.paymentKey;
    params.snippet_version = CONFIG.snippetVersion;

    var eventIdBase = firstNonEmpty([context.orderCode, context.orderNo, context.paymentCode, String(Date.now())]);
    var options = { eventID: CONFIG.vbankEventName + '.' + eventIdBase };

    if (command === 'tracksingle') {
      return ['trackSingleCustom', originalArgs[1], CONFIG.vbankEventName, params, options];
    }
    return ['trackCustom', CONFIG.vbankEventName, params, options];
  }

  function rememberBlocked(args) {
    var context = getOrderContext(args);
    var key = firstNonEmpty([context.orderCode, context.orderNo, context.paymentCode, context.eventId, String(Date.now())]);
    try {
      window.sessionStorage.setItem('__biocom_purchase_guard_blocked__:' + key, JSON.stringify({
        blockedAt: new Date().toISOString(),
        reason: 'unpaid_virtual_account',
        snippetVersion: CONFIG.snippetVersion,
        location: window.location.href,
        referrer: document.referrer,
        eventId: context.eventId,
        orderCode: context.orderCode,
        orderNo: context.orderNo,
        paymentCode: context.paymentCode,
        paymentKey: context.paymentKey
      }));
    } catch (error) {
      // Storage can be unavailable in strict browser modes.
    }
  }

  function defineProxyProperty(target, source, key, fallbackValue) {
    try {
      Object.defineProperty(target, key, {
        configurable: true,
        get: function () {
          return source[key] === undefined ? fallbackValue : source[key];
        },
        set: function (nextValue) {
          source[key] = nextValue;
        }
      });
    } catch (error) {
      target[key] = source[key] === undefined ? fallbackValue : source[key];
    }
  }

  function blockAndSendVirtualAccount(dispatch, args) {
    rememberBlocked(args);
    var customArgs = buildVirtualAccountArgs(args);
    try {
      dispatch(customArgs);
    } catch (error) {
      if (window.console && console.warn) {
        console.warn(CONFIG.logPrefix, 'VirtualAccountIssued send failed', error);
      }
    }
    if (window.console && console.info) {
      console.info(CONFIG.logPrefix, 'Blocked unpaid virtual account Purchase', getOrderContext(args));
    }
    return undefined;
  }

  function wrapFbq(originalFbq) {
    if (typeof originalFbq !== 'function') return originalFbq;
    if (originalFbq.__BIOCOM_PURCHASE_GUARD_WRAPPED__) return originalFbq;

    var guardedCallMethod;

    function guardedFbq() {
      var thisArg = this;
      var args = Array.prototype.slice.call(arguments);

      if (!isPurchaseCall(args)) {
        return dispatch(args, thisArg);
      }

      window.setTimeout(function () {
        if (isLikelyUnpaidVirtualAccount()) {
          blockAndSendVirtualAccount(function (nextArgs) {
            return dispatch(nextArgs, thisArg);
          }, args);
        } else {
          dispatch(args, thisArg);
        }
      }, CONFIG.holdMs);

      return undefined;
    }

    function dispatch(args, thisArg) {
      if (typeof guardedFbq.callMethod === 'function' && guardedFbq.callMethod !== guardedCallMethod) {
        return guardedFbq.callMethod.apply(guardedFbq, args);
      }
      if (typeof originalFbq.callMethod === 'function') {
        return originalFbq.callMethod.apply(originalFbq, args);
      }
      return originalFbq.apply(thisArg || originalFbq, args);
    }

    copyProperties(originalFbq, guardedFbq);
    guardedFbq.__BIOCOM_PURCHASE_GUARD_WRAPPED__ = true;
    guardedFbq.push = guardedFbq;
    defineProxyProperty(guardedFbq, originalFbq, 'loaded', originalFbq.loaded);
    defineProxyProperty(guardedFbq, originalFbq, 'version', originalFbq.version);
    defineProxyProperty(guardedFbq, originalFbq, 'queue', originalFbq.queue || []);

    guardedCallMethod = function () {
      return guardedFbq.apply(guardedFbq, arguments);
    };
    guardedFbq.callMethod = guardedCallMethod;

    return guardedFbq;
  }

  var activeFbq = typeof window.fbq === 'function' ? wrapFbq(window.fbq) : undefined;

  try {
    Object.defineProperty(window, 'fbq', {
      configurable: true,
      get: function () {
        return activeFbq;
      },
      set: function (nextFbq) {
        activeFbq = wrapFbq(nextFbq);
      }
    });
  } catch (error) {
    if (typeof window.fbq === 'function') {
      window.fbq = wrapFbq(window.fbq);
    }
  }

  if (window.console && console.info) {
    console.info(CONFIG.logPrefix, 'installed', CONFIG.snippetVersion);
  }
})();
</script>
```

## 테스트 방법

1. 아임웹 헤더 코드 상단에 위 스니펫을 넣습니다.
2. 카드 결제 주문완료에서 Meta Pixel Helper에 `Purchase`가 계속 뜨는지 확인합니다.
3. 가상계좌 미입금 주문완료에서 Meta Pixel Helper에 `Purchase`가 뜨지 않는지 확인합니다.
4. 가상계좌 미입금 주문완료에서 `VirtualAccountIssued`가 뜨는지 확인합니다.
5. 브라우저 콘솔에서 `[biocom-purchase-guard] Blocked unpaid virtual account Purchase` 로그가 찍히는지 확인합니다.

## 한계

- 스니펫이 Meta Pixel보다 늦게 실행되면 이미 나간 `Purchase`는 되돌릴 수 없습니다. 그래서 “헤더 코드 상단”이 중요합니다.
- 아임웹 주문완료 화면 텍스트에 가상계좌/계좌번호/입금대기 문구 조합이 없으면 브라우저만으로는 미입금 여부를 확정하기 어렵습니다. 그 경우 다음 단계는 백엔드에 `order_no/paymentKey` 상태 조회 API를 만들고, `Purchase`를 잠깐 보류한 뒤 confirmed일 때만 통과시키는 방식입니다.
