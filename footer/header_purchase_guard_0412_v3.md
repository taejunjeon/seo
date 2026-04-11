# Biocom Meta Pixel Purchase Guard v3 - 2026-04-12

## 결론

v2 교체 후에도 가상계좌 미입금 주문완료에서 Pixel Helper에 `Purchase`가 보이면 v2도 운영 화면에서는 차단 실패로 본다.

v3는 다음 두 가지를 보강한다.

- `FB_PIXEL` setter만 믿지 않고, 짧은 polling으로 아임웹 `FB_PIXEL.Purchase`를 다시 감싼다.
- 가상계좌 문구를 찾는 방식만 쓰지 않고, 주문완료 화면의 `결제정보` 주변에서 `신용카드`, `카드결제`, `네이버페이`, `카카오페이`, `토스페이`, `휴대폰결제`, `계좌이체` 같은 **즉시 승인 결제수단**이 확인될 때만 Browser Purchase를 통과시킨다.

즉 v3의 기본 원칙은 아래와 같다.

```text
결제완료 페이지 Browser Purchase
= 명확한 즉시 승인 결제수단이면 통과
= 그 외에는 차단하고 VirtualAccountIssued로 낮춤
```

서버 CAPI는 기존처럼 confirmed 주문만 Purchase로 보낸다.

## 교체 방법

아임웹 헤더 코드 최상단의 기존 `2026-04-12-vbank-purchase-guard-v2` 블록을 아래 코드 전체로 교체한다.

푸터 코드는 건드리지 않는다.

## v3 코드

```html
<script>
(function () {
  var CONFIG = {
    snippetVersion: '2026-04-12-vbank-purchase-guard-v3',
    vbankEventName: 'VirtualAccountIssued',
    holdMs: 1000,
    wrapPollMs: [0, 100, 300, 700, 1500, 3000, 5000],
    logPrefix: '[biocom-purchase-guard-v3]'
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
  if (window.__BIOCOM_PURCHASE_GUARD_V3_INSTALLED__) return;
  window.__BIOCOM_PURCHASE_GUARD_V3_INSTALLED__ = true;

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

  function getOrderContext(eventId) {
    return {
      eventId: safeString(eventId),
      orderCode: firstNonEmpty([
        getSearchParam(['order_code', 'orderCode']),
        getSearchParam(['orderCode', 'order_code'], document.referrer),
        getOrderCodeFromEventId(eventId)
      ]),
      orderNo: firstNonEmpty([
        getSearchParam(['order_no', 'orderNo', 'order_id', 'orderId']),
        getSearchParam(['orderNo', 'order_no', 'orderId', 'order_id'], document.referrer)
      ]),
      paymentCode: firstNonEmpty([
        getSearchParam(['payment_code', 'paymentCode']),
        getSearchParam(['paymentCode', 'payment_code'], document.referrer)
      ]),
      paymentKey: firstNonEmpty([
        getSearchParam(['paymentKey', 'payment_key']),
        getSearchParam(['paymentKey', 'payment_key'], document.referrer)
      ])
    };
  }

  function getBodyText() {
    return safeString(document.body ? document.body.innerText || document.body.textContent : '');
  }

  function compact(value) {
    return safeString(value).replace(/\s+/g, '');
  }

  function getPaymentContextText() {
    var text = getBodyText();
    var labels = ['결제정보', '결제 정보', '결제수단', '결제 수단', '결제금액'];
    var chunks = [];

    labels.forEach(function (label) {
      var start = 0;
      while (start < text.length) {
        var index = text.indexOf(label, start);
        if (index < 0) break;
        chunks.push(text.slice(Math.max(0, index - 120), Math.min(text.length, index + 900)));
        start = index + label.length;
      }
    });

    return chunks.length ? chunks.join(' ') : text.slice(0, 2500);
  }

  function hasAny(text, markers) {
    for (var i = 0; i < markers.length; i += 1) {
      if (text.indexOf(markers[i]) >= 0) return true;
    }
    return false;
  }

  function classifyPayment() {
    var contextText = compact(getPaymentContextText());
    var fullText = compact(getBodyText());

    var confirmedMarkers = [
      '신용카드',
      '카드결제',
      '카드승인',
      '네이버페이',
      '카카오페이',
      '토스페이',
      '페이코',
      '휴대폰결제',
      '계좌이체'
    ];
    var pendingMarkers = [
      '가상계좌',
      '무통장',
      '입금계좌',
      '계좌번호',
      '입금기한',
      '입금대기',
      '입금확인',
      '입금자',
      '입금해주세요',
      '입금바랍니다'
    ];

    var contextHasConfirmed = hasAny(contextText, confirmedMarkers);
    var contextHasPending = hasAny(contextText, pendingMarkers);
    var fullHasPending = hasAny(fullText, pendingMarkers);

    if (contextHasConfirmed) {
      return {
        shouldBlock: false,
        reason: 'confirmed_payment_marker',
        contextTextSample: contextText.slice(0, 220)
      };
    }

    if (contextHasPending || fullHasPending) {
      return {
        shouldBlock: true,
        reason: contextHasPending ? 'pending_marker_in_payment_context' : 'pending_marker_in_page',
        contextTextSample: contextText.slice(0, 220)
      };
    }

    return {
      shouldBlock: true,
      reason: 'no_confirmed_payment_marker_on_complete_page',
      contextTextSample: contextText.slice(0, 220)
    };
  }

  function buildVirtualAccountParams(value, currency, eventId) {
    var context = getOrderContext(eventId);
    var eventIdBase = firstNonEmpty([context.orderCode, context.orderNo, context.paymentCode, context.eventId, String(Date.now())]);

    return {
      params: {
        value: Number(value) || 0,
        currency: currency || 'KRW',
        payment_status: 'pending',
        payment_method: 'virtual_account_or_unconfirmed',
        order_code: context.orderCode,
        order_no: context.orderNo,
        payment_code: context.paymentCode,
        payment_key: context.paymentKey,
        original_purchase_event_id: context.eventId,
        snippet_version: CONFIG.snippetVersion
      },
      options: {
        eventID: CONFIG.vbankEventName + '.' + eventIdBase
      },
      context: context
    };
  }

  function sendVirtualAccountIssued(value, currency, eventId, decision) {
    var built = buildVirtualAccountParams(value, currency, eventId);
    built.params.guard_reason = decision.reason;

    try {
      window.sessionStorage.setItem('__biocom_purchase_guard_blocked__:' + built.options.eventID, JSON.stringify({
        blockedAt: new Date().toISOString(),
        reason: decision.reason,
        snippetVersion: CONFIG.snippetVersion,
        location: window.location.href,
        referrer: document.referrer,
        value: value,
        currency: currency,
        eventId: eventId,
        context: built.context,
        contextTextSample: decision.contextTextSample
      }));
    } catch (error) {
      // Storage can be unavailable in strict browser modes.
    }

    if (typeof window.fbq === 'function') {
      try {
        window.fbq('trackCustom', CONFIG.vbankEventName, built.params, built.options);
      } catch (error) {
        if (window.console && console.warn) {
          console.warn(CONFIG.logPrefix, 'VirtualAccountIssued send failed', error);
        }
      }
    }

    if (window.console && console.info) {
      console.info(CONFIG.logPrefix, 'Blocked Browser Purchase', {
        decision: decision,
        context: built.context
      });
    }
  }

  function wrapFbPixel(pixel) {
    if (!pixel || typeof pixel.Purchase !== 'function') return false;
    if (pixel.__BIOCOM_PURCHASE_GUARD_V3_WRAPPED__) return true;

    var originalPurchase = pixel.Purchase;

    pixel.Purchase = function (value, currency, eventId, fbExternalId) {
      var self = this;
      var args = arguments;

      window.setTimeout(function () {
        var decision = classifyPayment();

        if (window.console && console.info) {
          console.info(CONFIG.logPrefix, 'Purchase decision', {
            shouldBlock: decision.shouldBlock,
            reason: decision.reason,
            eventId: eventId,
            value: value,
            currency: currency
          });
        }

        if (decision.shouldBlock) {
          sendVirtualAccountIssued(value, currency, eventId, decision);
          return;
        }

        originalPurchase.apply(self, args);
      }, CONFIG.holdMs);
    };

    pixel.__BIOCOM_PURCHASE_GUARD_V3_WRAPPED__ = true;

    if (window.console && console.info) {
      console.info(CONFIG.logPrefix, 'FB_PIXEL.Purchase wrapped');
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
    // If defineProperty fails, polling below still tries to wrap.
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

## 교체 후 확인할 콘솔 로그

가상계좌 미입금 주문완료에서는 아래 3개가 보여야 한다.

```text
[biocom-purchase-guard-v3] installed 2026-04-12-vbank-purchase-guard-v3
[biocom-purchase-guard-v3] FB_PIXEL.Purchase wrapped
[biocom-purchase-guard-v3] Blocked Browser Purchase
```

그리고 아래 아임웹 기본 로그는 없어야 한다.

```text
dispatchPurchaseTrack
```

카드 결제 완료에서는 아래 로그가 보여도 된다.

```text
[biocom-purchase-guard-v3] Purchase decision { shouldBlock: false, reason: 'confirmed_payment_marker', ... }
dispatchPurchaseTrack
```

## Pixel Helper 기준

가상계좌 미입금:

- `Purchase` 없음
- `VirtualAccountIssued` 있음

카드 결제:

- `Purchase` 있음
- Event ID는 `Purchase.{orderCode}` 형태 유지
