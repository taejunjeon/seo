# Block 4 v0.3.1 Code

작성 시각: 2026-05-15 10:27 KST

## 10초 요약

이 코드는 Meta 브라우저 이벤트 중 `AddToCart`, `InitiateCheckout`, `AddPaymentInfo`만 보완한다.
이전 v0.2의 문제는 `fbq` 호출을 감지했다는 이유만으로 fallback을 건너뛸 수 있다는 점이다.
v0.3.1은 실제 `facebook.com/tr` 네트워크 요청에 해당 이벤트가 있는지 보고, 네트워크 요청이 0건일 때만 fallback을 실행한다.

## 적용 위치

아임웹 Footer에서 기존 Header Bootstrap, Footer Block 1, Footer Block 2, Footer Block 3 뒤에 새 `Block 4`로 추가한다.
기존 PageView/ViewContent/Purchase 코드는 건드리지 않는다.

## 핵심 변경

- `observedNative`는 참고 기록으로만 사용한다.
- fallback skip 기준은 `performance.getEntriesByType('resource')`에서 `facebook.com/tr?ev=<event>`가 실제로 잡혔는지다.
- `network_count=0`이면 `fbq('track', eventName, ..., { eventID })` fallback을 실행한다.
- `Purchase`는 함수 레벨에서 차단한다.
- `PageView`, `ViewContent`는 호출 경로가 없다.
- `sessionStorage` dedupe는 유지한다.

## Footer Block 4 v0.3.1

```html
<script>
/* ── Block 4: Meta browser funnel fallback only v0.3.1 ──
   Purpose:
   - Fill missing browser funnel events only.
   - Skip fallback only when a real facebook.com/tr network resource exists.
   - observedNative/fbq calls are diagnostic only, not a skip condition.
   - Do not fire PageView, ViewContent, or Purchase.
   - Do not send server CAPI.
   Version: 2026-05-15-biocom-meta-funnel-fallback-block4-v0-3-1
*/
(function () {
  'use strict';

  var CONFIG = {
    pixelId: '1283400029487161',
    snippetVersion: '2026-05-15-biocom-meta-funnel-fallback-block4-v0-3-1',
    debugQueryKey: '__seo_attribution_debug',
    fallbackDelayMs: 1600,
    addPaymentInfoRetryMs: 900,
    addPaymentInfoMaxChecks: 10,
    dedupePrefix: '__biocom_meta_funnel_fallback_sent__:',
    eventIdPrefix: 'biocom.funnel.',
    behaviorKey: '__seo_payment_page_behavior_v1',
    decisionLogKey: '__biocom_meta_funnel_fallback_v031',
    nativeLogKey: '__biocom_meta_native_seen_v031',
    checkoutIdKey: '__seo_checkout_id',
    checkoutContextKey: '__seo_checkout_context'
  };

  var FALLBACK_EVENTS = {
    AddToCart: true,
    InitiateCheckout: true,
    AddPaymentInfo: true
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
      console.log.apply(console, ['[meta-funnel-fallback-block4-v0.3.1]'].concat([].slice.call(arguments)));
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

  function hasDedupe(key) {
    try {
      return Boolean(window.sessionStorage && window.sessionStorage.getItem(CONFIG.dedupePrefix + key));
    } catch (error) {
      return false;
    }
  }

  function writeDedupe(key, payload) {
    try {
      if (!window.sessionStorage) return;
      window.sessionStorage.setItem(CONFIG.dedupePrefix + key, JSON.stringify(payload || {}));
    } catch (error) {}
  }

  function getDecisionLog() {
    var state = readSessionJson(CONFIG.decisionLogKey);
    if (!state || typeof state !== 'object') state = {};
    if (!Array.isArray(state.decisions)) state.decisions = [];
    state.snippetVersion = CONFIG.snippetVersion;
    return state;
  }

  function recordDecision(eventName, dedupeKey, decision, extra) {
    var state = getDecisionLog();
    var item = {
      at: new Date().toISOString(),
      eventName: eventName,
      dedupeKey: dedupeKey,
      decision: decision,
      observedNativeCount: observedNative[eventName] || 0,
      networkCount: getNetworkEventCount(eventName),
      snippetVersion: CONFIG.snippetVersion
    };
    extra = extra || {};
    for (var key in extra) {
      if (Object.prototype.hasOwnProperty.call(extra, key)) item[key] = extra[key];
    }
    state.decisions.push(item);
    if (state.decisions.length > 30) state.decisions = state.decisions.slice(state.decisions.length - 30);
    writeSessionJson(CONFIG.decisionLogKey, state);
    log('decision', item);
  }

  function recordNativeSeen(eventName) {
    observedNative[eventName] = (observedNative[eventName] || 0) + 1;
    var state = readSessionJson(CONFIG.nativeLogKey);
    if (!state || typeof state !== 'object') state = {};
    state[eventName] = {
      count: observedNative[eventName],
      lastSeenAt: new Date().toISOString(),
      networkCountAtSeen: getNetworkEventCount(eventName),
      note: 'diagnostic_only_not_fallback_skip_condition'
    };
    writeSessionJson(CONFIG.nativeLogKey, state);
  }

  function getCheckoutId() {
    try {
      return trim(window.sessionStorage && window.sessionStorage.getItem(CONFIG.checkoutIdKey)) ||
        trim(readSessionJson(CONFIG.checkoutContextKey).checkoutId) ||
        trim(readSessionJson(CONFIG.behaviorKey).checkoutId) ||
        'session';
    } catch (error) {
      return 'session';
    }
  }

  function getCartKey() {
    try {
      var selector = '[data-prod-code], [data-product-code], [data-id]';
      var element = document.querySelector(selector);
      var productHint = element && trim(
        element.getAttribute('data-prod-code') ||
        element.getAttribute('data-product-code') ||
        element.getAttribute('data-id')
      );
      var bodyText = trim(document.body && document.body.innerText);
      return productHint || String(bodyText.length || 'unknown');
    } catch (error) {
      return 'unknown';
    }
  }

  function buildEventId(eventName, key) {
    var safeKey = trim(key).replace(/[^a-zA-Z0-9._:-]/g, '_').slice(0, 120) || 'event';
    return CONFIG.eventIdPrefix + eventName + '.' + safeKey + '.' + getCheckoutId();
  }

  function isAllowedFallbackEvent(eventName) {
    return Boolean(FALLBACK_EVENTS[eventName]);
  }

  function extractEventFromResourceUrl(urlLike) {
    try {
      var url = new URL(urlLike, location.href);
      if (!/(^|\.)facebook\.com$/i.test(url.hostname)) return '';
      if (!/^\/tr\/?$/i.test(url.pathname)) return '';
      return trim(url.searchParams.get('ev'));
    } catch (error) {
      return '';
    }
  }

  function extractPixelFromResourceUrl(urlLike) {
    try {
      var url = new URL(urlLike, location.href);
      if (!/(^|\.)facebook\.com$/i.test(url.hostname)) return '';
      if (!/^\/tr\/?$/i.test(url.pathname)) return '';
      return trim(url.searchParams.get('id'));
    } catch (error) {
      return '';
    }
  }

  function getNetworkEventCount(eventName) {
    try {
      if (!window.performance || typeof window.performance.getEntriesByType !== 'function') return 0;
      var entries = window.performance.getEntriesByType('resource') || [];
      var count = 0;
      for (var i = 0; i < entries.length; i += 1) {
        var name = entries[i] && entries[i].name;
        if (!name) continue;
        if (extractEventFromResourceUrl(name) !== eventName) continue;
        var pixel = extractPixelFromResourceUrl(name);
        if (CONFIG.pixelId && pixel && pixel !== CONFIG.pixelId) continue;
        count += 1;
      }
      return count;
    } catch (error) {
      return 0;
    }
  }

  function callFbq(eventName, payload, eventId) {
    if (!isAllowedFallbackEvent(eventName)) {
      recordDecision(eventName, eventName + '.blocked', 'blocked_event_not_allowed');
      return false;
    }
    if (eventName === 'Purchase' || eventName === 'PageView' || eventName === 'ViewContent') {
      recordDecision(eventName, eventName + '.blocked', 'blocked_protected_event');
      return false;
    }
    if (typeof window.fbq !== 'function') {
      recordDecision(eventName, eventName + '.fbq_missing', 'fbq_missing');
      return false;
    }
    window.fbq('track', eventName, payload || {}, { eventID: eventId });
    return true;
  }

  function observeExistingFbq() {
    if (typeof window.fbq !== 'function') return false;
    if (window.fbq.__BIOCOM_FUNNEL_FALLBACK_BLOCK4_V031_WRAPPED__) return true;

    var original = window.fbq;
    var wrapped = function () {
      var args = Array.prototype.slice.call(arguments);
      if (args[0] === 'track' && args[1]) {
        recordNativeSeen(args[1]);
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
      wrapped.__BIOCOM_FUNNEL_FALLBACK_BLOCK4_V031_WRAPPED__ = true;
      window.fbq = wrapped;
      return true;
    } catch (error) {
      return false;
    }
  }

  function sendFallbackWhenNetworkMissing(eventName, dedupeKey, payload) {
    if (!isAllowedFallbackEvent(eventName)) return;

    window.setTimeout(function () {
      var networkCount = getNetworkEventCount(eventName);
      var nativeCount = observedNative[eventName] || 0;

      if (hasDedupe(dedupeKey)) {
        recordDecision(eventName, dedupeKey, 'skip_session_dedupe', {
          nativeCount: nativeCount,
          networkCountBefore: networkCount
        });
        return;
      }

      if (networkCount > 0) {
        writeDedupe(dedupeKey, {
          status: 'skip_network_seen',
          eventName: eventName,
          networkCount: networkCount,
          nativeCount: nativeCount,
          at: new Date().toISOString(),
          snippetVersion: CONFIG.snippetVersion
        });
        recordDecision(eventName, dedupeKey, 'skip_network_seen', {
          nativeCount: nativeCount,
          networkCountBefore: networkCount
        });
        return;
      }

      var eventId = buildEventId(eventName, dedupeKey);
      var ok = callFbq(eventName, payload, eventId);
      if (!ok) return;

      writeDedupe(dedupeKey, {
        status: 'fallback_sent_because_network_count_zero',
        eventName: eventName,
        eventId: eventId,
        networkCountBefore: networkCount,
        nativeCount: nativeCount,
        at: new Date().toISOString(),
        snippetVersion: CONFIG.snippetVersion
      });
      recordDecision(eventName, dedupeKey, 'fallback_sent_because_network_count_zero', {
        nativeCount: nativeCount,
        networkCountBefore: networkCount,
        eventId: eventId
      });

      window.setTimeout(function () {
        recordDecision(eventName, dedupeKey, 'post_fallback_network_check', {
          networkCountAfter: getNetworkEventCount(eventName)
        });
      }, 700);
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
      if (/카카오|kakao/.test(text)) return 'kakao';
      if (/토스|toss/.test(text)) return 'toss';
    } catch (error) {}
    return '';
  }

  function isShopPaymentPage() {
    return /\/shop_payment\/?/i.test(String(location.pathname || ''));
  }

  function installAddToCartListener() {
    document.addEventListener('click', function (event) {
      var cursor = event.target;
      var text = '';

      for (var depth = 0; cursor && depth < 5; depth += 1) {
        text += ' ' + trim(cursor.innerText || cursor.textContent || cursor.className || cursor.id || '');
        cursor = cursor.parentElement;
      }

      if (!/장바구니|담기|add.?to.?cart|cart/i.test(text)) return;

      var key = 'AddToCart.' + getCartKey();
      sendFallbackWhenNetworkMissing('AddToCart', key, {
        content_type: 'product',
        currency: 'KRW',
        fallback_source: 'biocom_block4_v031',
        snippet_version: CONFIG.snippetVersion
      });
    }, true);
  }

  function maybeInitiateCheckout() {
    if (!isShopPaymentPage()) return;

    var key = 'InitiateCheckout.' + getCheckoutId();
    sendFallbackWhenNetworkMissing('InitiateCheckout', key, {
      currency: 'KRW',
      fallback_source: 'biocom_block4_v031',
      snippet_version: CONFIG.snippetVersion
    });
  }

  function maybeAddPaymentInfo() {
    if (!isShopPaymentPage()) return;

    var method = detectPaymentMethod();
    if (!method) return;

    var key = 'AddPaymentInfo.' + getCheckoutId() + '.' + method;
    sendFallbackWhenNetworkMissing('AddPaymentInfo', key, {
      currency: 'KRW',
      payment_method: method,
      fallback_source: 'biocom_block4_v031',
      snippet_version: CONFIG.snippetVersion
    });
  }

  function installAddPaymentInfoRetries() {
    if (!isShopPaymentPage()) return;
    var checks = 0;
    var timer = window.setInterval(function () {
      checks += 1;
      maybeAddPaymentInfo();
      if (checks >= CONFIG.addPaymentInfoMaxChecks || getNetworkEventCount('AddPaymentInfo') > 0) {
        window.clearInterval(timer);
      }
    }, CONFIG.addPaymentInfoRetryMs);
  }

  observeExistingFbq();
  installAddToCartListener();
  maybeInitiateCheckout();
  installAddPaymentInfoRetries();

  document.addEventListener('click', function () {
    window.setTimeout(maybeAddPaymentInfo, CONFIG.addPaymentInfoRetryMs);
  }, true);

  document.addEventListener('change', function () {
    window.setTimeout(maybeAddPaymentInfo, CONFIG.addPaymentInfoRetryMs);
  }, true);

  /*
    Explicitly no Purchase fallback here.
    Purchase recovery must use completion URL + payment-decision allow_purchase + value guard.
  */
})();
</script>
```

## 적용 후 확인

브라우저 Network에서 `facebook.com/tr` 필터를 걸고 아래를 확인한다.

1. `/shop_payment/` 진입 후 `ev=InitiateCheckout`가 1건 이상 생기는지 본다.
2. 결제수단을 선택하거나 결제 페이지에 머무른 뒤 `ev=AddPaymentInfo`가 생기는지 본다.
3. 장바구니 담기 클릭 후 `ev=AddToCart`가 생기는지 본다.
4. `ev=Purchase`가 Block 4 때문에 생기면 실패다. 이 코드에는 Purchase 호출 경로가 없어야 한다.

콘솔에서 아래를 확인하면 fallback 판단을 볼 수 있다.

```js
JSON.parse(sessionStorage.getItem('__biocom_meta_funnel_fallback_v031'))
JSON.parse(sessionStorage.getItem('__biocom_meta_native_seen_v031'))
performance.getEntriesByType('resource')
  .filter(e => e.name.includes('facebook.com/tr'))
  .map(e => new URL(e.name).searchParams.get('ev'))
```

## 판정

추천: 적용 테스트 진행.

이유: 현재 문제는 `fbq` 호출 감지와 실제 네트워크 전송이 어긋나는 것이다.
v0.3.1은 실제 네트워크 요청이 없을 때만 보완하므로 v0.2보다 안전하다.
다만 아임웹 Footer 저장은 운영 사용자에게 영향을 주므로 TJ님 확인 후 적용한다.
