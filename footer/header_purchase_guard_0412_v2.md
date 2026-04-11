# Biocom Meta Pixel Purchase Guard v2 - 2026-04-12

## 결론

현재 라이브 콘솔에서 `Purchase`가 계속 보인다면 v1 Guard는 운영 가상계좌 화면에서 실패한 상태로 봐야 한다.

실패 원인 후보는 두 가지다.

- v1은 `window.fbq`를 감싸는 방식이라 Meta Pixel 내부에서 `Multiple pixels with conflicting versions` 경고를 만들 수 있다.
- v1은 페이지 전체 텍스트를 보고 가상계좌 여부를 판단한다. 주문완료 페이지 어딘가에 `신용카드`, `간편결제`, `토스페이` 같은 일반 결제수단 문구가 있으면 가상계좌를 카드성 결제로 오판할 수 있다.

이번 v2는 방향을 바꾼다.

- Meta Pixel 자체인 `fbq`는 건드리지 않는다.
- 아임웹의 `/js/fb_pixel.js`가 만드는 `FB_PIXEL.Purchase()`만 감싼다.
- 아임웹이 Purchase를 보내기 직전에 결제완료 화면의 `결제정보` 주변 텍스트를 보고 가상계좌 미입금이면 Purchase를 막는다.
- 막은 경우 `VirtualAccountIssued` 커스텀 이벤트만 보낸다.

즉 v2는 “Meta Pixel 전체 래핑”이 아니라 “아임웹 Purchase 호출만 차단”하는 방식이라 더 좁고 안전하다.

## 현재 확인된 픽셀

2026-04-12 라이브 HTML 기준 직접 확인되는 Meta Pixel ID는 아래 1개다.

```text
1283400029487161
```

확인된 코드:

```text
fbq('init', '1283400029487161', {'external_id': ''}, {'agent':'plimweb'});
```

같은 HTML에서 확인되는 다른 태그:

```text
GTM-W2Z6PHN
KAKAO_PIXEL.init('8351931815157058348')
```

GTM-W2Z6PHN 컨테이너를 직접 내려받아 `fbq`, `fbevents`, `facebook`, `1283400029487161`를 검색했을 때 별도 Meta Pixel 초기화 코드는 확인되지 않았다. 따라서 지금 보이는 `Multiple pixels with conflicting versions`는 “Meta Pixel ID가 2개 있다”는 의미라기보다, `fbq` wrapper 또는 중복 로더/버전 충돌 경고일 가능성이 높다.

## 교체 위치

아임웹 **헤더 코드 최상단**에 있는 기존 `2026-04-12-vbank-purchase-guard-v1` 블록을 아래 v2 전체 코드로 교체한다.

푸터 코드는 건드리지 않는다.

## v2 코드

```html
<script>
(function () {
  var CONFIG = {
    snippetVersion: '2026-04-12-vbank-purchase-guard-v2',
    vbankEventName: 'VirtualAccountIssued',
    holdMs: 900,
    logPrefix: '[biocom-purchase-guard-v2]'
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
  if (window.__BIOCOM_PURCHASE_GUARD_V2_INSTALLED__) return;
  window.__BIOCOM_PURCHASE_GUARD_V2_INSTALLED__ = true;

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

  function getPaymentContextText() {
    var text = getBodyText();
    var labels = ['결제정보', '결제 정보', '결제수단', '결제 수단'];
    var chunks = [];

    labels.forEach(function (label) {
      var start = 0;
      while (start < text.length) {
        var index = text.indexOf(label, start);
        if (index < 0) break;
        chunks.push(text.slice(Math.max(0, index - 80), Math.min(text.length, index + 700)));
        start = index + label.length;
      }
    });

    return chunks.join(' ');
  }

  function hasAny(text, markers) {
    for (var i = 0; i < markers.length; i += 1) {
      if (text.indexOf(markers[i]) >= 0) return true;
    }
    return false;
  }

  function isLikelyUnpaidVirtualAccount() {
    var paymentText = getPaymentContextText();
    var fullText = getBodyText();
    var compactPaymentText = paymentText.replace(/\s+/g, '');
    var compactFullText = fullText.replace(/\s+/g, '');

    var vbankMarkers = ['가상계좌', '무통장', '입금계좌', '계좌번호', '입금기한', '입금자'];
    var pendingMarkers = ['입금대기', '입금확인', '입금전', '입금후', '입금해주세요', '입금바랍니다'];
    var cardMarkers = ['신용카드', '카드결제', '카드승인'];

    var paymentHasVbank = hasAny(compactPaymentText, vbankMarkers);
    var paymentHasPending = hasAny(compactPaymentText, pendingMarkers) || (
      compactPaymentText.indexOf('입금') >= 0 && compactPaymentText.indexOf('계좌') >= 0
    );
    var paymentHasCard = hasAny(compactPaymentText, cardMarkers);

    if (paymentHasVbank && !paymentHasCard) return true;
    if (paymentHasPending && !paymentHasCard) return true;

    var fullHasStrongVbank = (
      compactFullText.indexOf('가상계좌') >= 0 ||
      compactFullText.indexOf('무통장') >= 0 ||
      compactFullText.indexOf('계좌번호') >= 0 ||
      compactFullText.indexOf('입금기한') >= 0
    );
    var fullHasPending = (
      compactFullText.indexOf('입금대기') >= 0 ||
      compactFullText.indexOf('입금확인') >= 0 ||
      (compactFullText.indexOf('입금') >= 0 && compactFullText.indexOf('계좌') >= 0)
    );

    return fullHasStrongVbank && fullHasPending && !paymentHasCard;
  }

  function buildVirtualAccountParams(value, currency, eventId) {
    var context = getOrderContext(eventId);
    var eventIdBase = firstNonEmpty([context.orderCode, context.orderNo, context.paymentCode, context.eventId, String(Date.now())]);

    return {
      params: {
        value: Number(value) || 0,
        currency: currency || 'KRW',
        payment_status: 'pending',
        payment_method: 'virtual_account',
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

  function rememberBlocked(value, currency, eventId) {
    var built = buildVirtualAccountParams(value, currency, eventId);
    try {
      window.sessionStorage.setItem('__biocom_purchase_guard_blocked__:' + built.options.eventID, JSON.stringify({
        blockedAt: new Date().toISOString(),
        reason: 'unpaid_virtual_account',
        snippetVersion: CONFIG.snippetVersion,
        location: window.location.href,
        referrer: document.referrer,
        value: value,
        currency: currency,
        eventId: eventId,
        context: built.context
      }));
    } catch (error) {
      // Storage can be unavailable in strict browser modes.
    }
    return built;
  }

  function sendVirtualAccountIssued(value, currency, eventId) {
    var built = rememberBlocked(value, currency, eventId);

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
      console.info(CONFIG.logPrefix, 'Blocked unpaid virtual account Purchase', built.context);
    }
  }

  function wrapFbPixel(pixel) {
    if (!pixel || typeof pixel.Purchase !== 'function') return pixel;
    if (pixel.__BIOCOM_PURCHASE_GUARD_V2_WRAPPED__) return pixel;

    var originalPurchase = pixel.Purchase;

    pixel.Purchase = function (value, currency, eventId, fbExternalId) {
      var self = this;
      var args = arguments;

      window.setTimeout(function () {
        if (isLikelyUnpaidVirtualAccount()) {
          sendVirtualAccountIssued(value, currency, eventId);
          return;
        }
        originalPurchase.apply(self, args);
      }, CONFIG.holdMs);
    };

    pixel.__BIOCOM_PURCHASE_GUARD_V2_WRAPPED__ = true;
    return pixel;
  }

  var activeFbPixel = window.FB_PIXEL ? wrapFbPixel(window.FB_PIXEL) : undefined;

  try {
    Object.defineProperty(window, 'FB_PIXEL', {
      configurable: true,
      get: function () {
        return activeFbPixel;
      },
      set: function (nextPixel) {
        activeFbPixel = wrapFbPixel(nextPixel);
      }
    });
  } catch (error) {
    if (window.FB_PIXEL) wrapFbPixel(window.FB_PIXEL);
  }

  if (window.console && console.info) {
    console.info(CONFIG.logPrefix, 'installed', CONFIG.snippetVersion);
  }
})();
</script>
```

## 테스트 기준

가상계좌 미입금 주문완료:

- Pixel Helper에서 `Purchase`가 없어야 한다.
- `VirtualAccountIssued`가 보여야 한다.
- 콘솔에 아래 로그가 보여야 한다.

```text
[biocom-purchase-guard-v2] Blocked unpaid virtual account Purchase
```

카드 결제 완료:

- Pixel Helper에서 `Purchase`가 그대로 보여야 한다.
- Event ID는 기존처럼 `Purchase.{orderCode}` 형태여야 한다.

## 남은 한계

이 v2도 브라우저 화면 텍스트 기반 방어다. 가장 정확한 최종형은 결제완료 URL의 `order_no`, `payment_code`, `order_code`를 서버로 보내서 주문 상태를 조회하고, 실제 confirmed일 때만 Browser Purchase를 통과시키는 방식이다.
