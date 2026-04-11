# Biocom Meta Pixel Purchase Guard v4 - 2026-04-12

## 결론

v3는 가상계좌 미입금 주문을 `VirtualAccountIssued`로 낮추는 데는 성공했지만, 카드 결제 완료 주문까지 `VirtualAccountIssued`로 낮추는 회귀가 확인됐다.

따라서 v3는 운영 기준으로 너무 공격적이다. v4는 아래 원칙으로 바꾼다.

```text
명확한 가상계좌/입금대기 신호가 있으면 Purchase 차단
그 외에는 Purchase 통과
```

이 방향이 맞는 이유:

- 카드 결제 `Purchase`를 놓치면 Meta ROAS가 실제보다 낮아지고 학습도 흔들린다.
- 가상계좌 미입금 오염을 줄이되, 확정 카드 매출을 놓치지 않는 것이 더 중요하다.
- 완전한 해결은 브라우저 문구 추정이 아니라 서버 주문 상태 조회 기반이지만, 지금 즉시 적용 가능한 안전한 보정은 v4다.

## 교체 방법

아임웹 헤더 코드 최상단의 기존 `2026-04-12-vbank-purchase-guard-v3` 블록을 아래 코드 전체로 교체한다.

푸터 코드는 건드리지 않는다.

## v4 코드

```html
<script>
(function () {
  var CONFIG = {
    snippetVersion: '2026-04-12-vbank-purchase-guard-v4',
    vbankEventName: 'VirtualAccountIssued',
    holdMs: 1000,
    wrapPollMs: [0, 100, 300, 700, 1500, 3000, 5000],
    logPrefix: '[biocom-purchase-guard-v4]'
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
  if (window.__BIOCOM_PURCHASE_GUARD_V4_INSTALLED__) return;
  window.__BIOCOM_PURCHASE_GUARD_V4_INSTALLED__ = true;

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
        chunks.push(text.slice(Math.max(0, index - 160), Math.min(text.length, index + 1100)));
        start = index + label.length;
      }
    });

    return chunks.length ? chunks.join(' ') : text.slice(0, 3000);
  }

  function countMarkers(text, markers) {
    var count = 0;
    for (var i = 0; i < markers.length; i += 1) {
      if (text.indexOf(markers[i]) >= 0) count += 1;
    }
    return count;
  }

  function hasAny(text, markers) {
    return countMarkers(text, markers) > 0;
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
    var strongPendingMarkers = [
      '가상계좌',
      '무통장',
      '입금계좌',
      '계좌번호',
      '입금기한'
    ];
    var weakPendingMarkers = [
      '입금대기',
      '입금확인',
      '입금자',
      '입금해주세요',
      '입금바랍니다',
      '입금전',
      '입금후'
    ];

    var contextHasConfirmed = hasAny(contextText, confirmedMarkers);
    var contextStrongPendingCount = countMarkers(contextText, strongPendingMarkers);
    var contextWeakPendingCount = countMarkers(contextText, weakPendingMarkers);
    var fullStrongPendingCount = countMarkers(fullText, strongPendingMarkers);
    var fullWeakPendingCount = countMarkers(fullText, weakPendingMarkers);

    if (contextHasConfirmed) {
      return {
        shouldBlock: false,
        reason: 'confirmed_payment_marker',
        contextTextSample: contextText.slice(0, 260)
      };
    }

    if (contextStrongPendingCount >= 1 && (contextWeakPendingCount >= 1 || contextText.indexOf('입금') >= 0)) {
      return {
        shouldBlock: true,
        reason: 'pending_marker_in_payment_context',
        contextTextSample: contextText.slice(0, 260)
      };
    }

    if (fullStrongPendingCount >= 2 && fullWeakPendingCount >= 1) {
      return {
        shouldBlock: true,
        reason: 'pending_marker_in_page',
        contextTextSample: contextText.slice(0, 260)
      };
    }

    return {
      shouldBlock: false,
      reason: 'no_pending_marker_allow_purchase',
      contextTextSample: contextText.slice(0, 260)
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
    if (pixel.__BIOCOM_PURCHASE_GUARD_V4_WRAPPED__) return true;

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

    pixel.__BIOCOM_PURCHASE_GUARD_V4_WRAPPED__ = true;

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

## 교체 후 기대값

카드 결제 완료:

- `Purchase`가 떠야 한다.
- `VirtualAccountIssued`는 뜨면 안 된다.
- 콘솔에는 아래처럼 나와야 한다.

```text
[biocom-purchase-guard-v4] Purchase decision { shouldBlock: false, reason: 'confirmed_payment_marker' ... }
```

또는 카드 문구를 못 찾았더라도 아래처럼 나오면 우선 통과다.

```text
[biocom-purchase-guard-v4] Purchase decision { shouldBlock: false, reason: 'no_pending_marker_allow_purchase' ... }
```

가상계좌 미입금:

- `Purchase`가 없어야 한다.
- `VirtualAccountIssued`가 떠야 한다.
- 콘솔에는 아래처럼 나와야 한다.

```text
[biocom-purchase-guard-v4] Blocked Browser Purchase
```

## 한계

v4는 카드 매출 누락을 막기 위해 unknown 결제완료를 `Purchase` 통과로 둔다. 따라서 가상계좌 화면에서 입금대기/가상계좌 문구가 DOM에 전혀 없으면 다시 `Purchase`가 통과될 수 있다.

최종형은 서버 주문 상태 조회 기반이다.

```text
Browser 결제완료 URL
-> order_no/payment_code/order_code를 서버에 전달
-> 서버가 Toss/아임웹/로컬 원장 기준으로 confirmed/pending 판정
-> confirmed면 Purchase 통과
-> pending이면 VirtualAccountIssued
```
