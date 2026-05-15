# Meta Browser Fallback Block 4 Code Draft

작성 시각: 2026-05-15 03:31 KST

## 목적

FBE/native Pixel이 PageView는 보내지만 AddToCart/InitiateCheckout/AddPaymentInfo를 브라우저 Network에서 못 잡는 상황을 보완한다. 전체 Pixel을 다시 심지 않고, 누락된 funnel event만 fallback으로 발화한다.

## 원칙

- FBE는 유지한다.
- PageView/ViewContent는 건드리지 않는다.
- AddToCart / InitiateCheckout / AddPaymentInfo만 fallback 대상이다.
- Purchase는 절대 발화하지 않는다.
- native fbq event가 이미 발생하면 fallback을 보내지 않는다.
- sessionStorage dedupe를 사용한다.
- eventID를 저장해 향후 server CAPI dedup에 쓸 수 있게 한다.
- raw order/payment/member/click id를 report에 출력하지 않는다.

## 적용 위치

Imweb Footer에서 기존 Header Bootstrap, Block 1, Block 2, Block 3 뒤에 새 `Block 4`로 추가한다. 실제 저장은 TJ님 승인 전 금지.

## Block 4 draft

```html
<script>
/* ── Block 4: Meta browser funnel fallback only v0.1 ──
   Purpose:
   - Fill missing browser funnel events only.
   - Do not fire PageView/ViewContent/Purchase.
   - Do not send server CAPI.
   Version: 2026-05-15-biocom-meta-funnel-fallback-block4-v0-1
*/
(function () {
  'use strict';

  var CONFIG = {
    pixelId: '1283400029487161',
    snippetVersion: '2026-05-15-biocom-meta-funnel-fallback-block4-v0-1',
    debugQueryKey: '__seo_attribution_debug',
    nativeObserveMs: 900,
    fallbackDelayMs: 1100,
    dedupePrefix: '__biocom_meta_funnel_fallback_sent__:',
    eventIdPrefix: 'biocom.funnel.',
    behaviorKey: '__seo_payment_page_behavior_v1'
  };

  var observedNative = {};

  function trim(value) {
    return value == null ? '' : String(value).trim();
  }

  function isDebugMode() {
    try {
      return new URLSearchParams(location.search).get(CONFIG.debugQueryKey) === '1';
    } catch (error) {
      return false;
    }
  }

  function log() {
    if (!isDebugMode()) return;
    try {
      console.log.apply(console, ['[meta-funnel-fallback-block4]'].concat([].slice.call(arguments)));
    } catch (error) {}
  }

  function safeParse(raw) {
    if (!raw) return {};
    try {
      var parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch (error) {
      return {};
    }
  }

  function readSessionJson(key) {
    try {
      return safeParse(window.sessionStorage && window.sessionStorage.getItem(key));
    } catch (error) {
      return {};
    }
  }

  function writeSessionJson(key, value) {
    try {
      if (!window.sessionStorage) return;
      window.sessionStorage.setItem(key, JSON.stringify(value));
    } catch (error) {}
  }

  function hasSent(key) {
    try {
      return Boolean(window.sessionStorage && window.sessionStorage.getItem(CONFIG.dedupePrefix + key));
    } catch (error) {
      return false;
    }
  }

  function markSent(key, eventId) {
    try {
      if (!window.sessionStorage) return;
      window.sessionStorage.setItem(CONFIG.dedupePrefix + key, JSON.stringify({
        sentAt: new Date().toISOString(),
        eventId: eventId,
        snippetVersion: CONFIG.snippetVersion
      }));
    } catch (error) {}
  }

  function getCheckoutId() {
    try {
      return trim(window.sessionStorage && window.sessionStorage.getItem('__seo_checkout_id')) ||
        trim(readSessionJson('__seo_checkout_context').checkoutId) ||
        trim(readSessionJson(CONFIG.behaviorKey).checkoutId) ||
        'session';
    } catch (error) {
      return 'session';
    }
  }

  function getCartKey() {
    try {
      var bodyText = trim(document.body && document.body.innerText);
      var productHint = trim(document.querySelector('[data-prod-code], [data-product-code], [data-id]') &&
        (document.querySelector('[data-prod-code], [data-product-code], [data-id]').getAttribute('data-prod-code') ||
        document.querySelector('[data-prod-code], [data-product-code], [data-id]').getAttribute('data-product-code') ||
        document.querySelector('[data-prod-code], [data-product-code], [data-id]').getAttribute('data-id')));
      return productHint || String(bodyText.length || 'unknown');
    } catch (error) {
      return 'unknown';
    }
  }

  function buildEventId(eventName, key) {
    return CONFIG.eventIdPrefix + eventName + '.' + key + '.' + getCheckoutId();
  }

  function callFbq(eventName, payload, eventId) {
    if (typeof window.fbq !== 'function') return false;
    window.fbq('track', eventName, payload || {}, { eventID: eventId });
    return true;
  }

  function observeExistingFbq() {
    if (typeof window.fbq !== 'function') return false;
    if (window.fbq.__BIOCOM_FUNNEL_FALLBACK_BLOCK4_WRAPPED__) return true;

    var original = window.fbq;
    var wrapped = function () {
      var args = Array.prototype.slice.call(arguments);
      if (args[0] === 'track' && args[1]) {
        observedNative[args[1]] = true;
      }
      return original.apply(this, args);
    };

    try {
      for (var key in original) {
        if (Object.prototype.hasOwnProperty.call(original, key)) wrapped[key] = original[key];
      }
      if (original.callMethod) wrapped.callMethod = original.callMethod;
      if (original.queue) wrapped.queue = original.queue;
      if (original.loaded) wrapped.loaded = original.loaded;
      if (original.version) wrapped.version = original.version;
      if (original.agent) wrapped.agent = original.agent;
      wrapped.__BIOCOM_FUNNEL_FALLBACK_BLOCK4_WRAPPED__ = true;
      window.fbq = wrapped;
    } catch (error) {
      return false;
    }

    return true;
  }

  function sendFallback(eventName, dedupeKey, payload) {
    window.setTimeout(function () {
      if (observedNative[eventName]) {
        log('skip native observed', eventName);
        return;
      }
      if (hasSent(dedupeKey)) {
        log('skip duplicate', eventName, dedupeKey);
        return;
      }
      var eventId = buildEventId(eventName, dedupeKey);
      if (callFbq(eventName, payload, eventId)) {
        markSent(dedupeKey, eventId);
        log('fallback sent', eventName, eventId);
      }
    }, CONFIG.fallbackDelayMs);
  }

  function detectPaymentMethod() {
    var behavior = readSessionJson(CONFIG.behaviorKey);
    if (trim(behavior.selected_payment_method)) return trim(behavior.selected_payment_method);
    try {
      var text = trim(document.body && document.body.innerText).toLowerCase();
      if (/네이버페이|naverpay|npay|naver pay/.test(text)) return 'npay';
      if (/신용카드|카드|credit|card/.test(text)) return 'card';
      if (/가상계좌|virtual/.test(text)) return 'virtual_account';
      if (/무통장|계좌이체|bank/.test(text)) return 'bank_transfer';
    } catch (error) {}
    return '';
  }

  function isShopPaymentPage() {
    return /\/shop_payment\/?/i.test(String(location.pathname || ''));
  }

  function installAddToCartListener() {
    document.addEventListener('click', function (event) {
      var target = event.target;
      var cursor = target;
      var text = '';
      for (var depth = 0; cursor && depth < 5; depth += 1) {
        text += ' ' + trim(cursor.innerText || cursor.textContent || cursor.className || cursor.id || '');
        cursor = cursor.parentElement;
      }
      if (!/장바구니|담기|add.?to.?cart|cart/i.test(text)) return;
      var key = 'AddToCart.' + getCartKey();
      sendFallback('AddToCart', key, {
        content_type: 'product',
        currency: 'KRW',
        fallback_source: 'biocom_block4',
        snippet_version: CONFIG.snippetVersion
      });
    }, true);
  }

  function maybeInitiateCheckout() {
    if (!isShopPaymentPage()) return;
    var key = 'InitiateCheckout.' + getCheckoutId();
    sendFallback('InitiateCheckout', key, {
      currency: 'KRW',
      fallback_source: 'biocom_block4',
      snippet_version: CONFIG.snippetVersion
    });
  }

  function maybeAddPaymentInfo() {
    if (!isShopPaymentPage()) return;
    var method = detectPaymentMethod();
    if (!method) return;
    var key = 'AddPaymentInfo.' + getCheckoutId() + '.' + method;
    sendFallback('AddPaymentInfo', key, {
      currency: 'KRW',
      payment_method: method,
      fallback_source: 'biocom_block4',
      snippet_version: CONFIG.snippetVersion
    });
  }

  observeExistingFbq();
  installAddToCartListener();
  maybeInitiateCheckout();

  document.addEventListener('click', function () {
    window.setTimeout(maybeAddPaymentInfo, CONFIG.nativeObserveMs);
  }, true);
  document.addEventListener('change', function () {
    window.setTimeout(maybeAddPaymentInfo, CONFIG.nativeObserveMs);
  }, true);

  /*
    Explicitly no Purchase fallback here.
    Purchase recovery must use completion URL + payment-decision allow_purchase + value guard.
  */
})();
</script>
```

## 적용 전 최소 확인

1. 현재 AddToCart native Network가 없다는 TJ님 캡처.
2. 현재 InitiateCheckout native Network가 없다는 TJ님 캡처.
3. Block 4 적용 후 `ev=AddToCart`, `ev=InitiateCheckout`, `ev=AddPaymentInfo`만 추가되는지 확인.
4. `ev=Purchase`는 Block 4로 절대 나오면 안 된다.

## 빠른 적용 판단

추천: 조건부 진행.

이유: Purchase 복구와 별개로 funnel event 누락을 줄인다. 단 Imweb footer 저장은 live 사용자에게 영향을 주므로 TJ님 승인 전 적용하지 않는다.
