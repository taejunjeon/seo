# codefeedback0412_2 반영 결과

작성 시각: 2026-04-12 KST

## 1. 헤더 상단 삽입 확인

live HTML 기준으로 헤더 상단 `Purchase Guard`는 제대로 삽입됐다.

확인 대상:

- `https://biocom.kr/`
- `https://biocom.kr/shop_view/?idx=97`

확인 결과:

- `snippetVersion: '2026-04-12-vbank-purchase-guard-v1'`가 HTML 초반에 존재한다.
- `GTM-W2Z6PHN`보다 먼저 나온다.
- Meta Pixel 기본 `fbq('init', '1283400029487161'...)`보다 먼저 나온다.
- 기존 리인벤팅 GTM인 `GTM-W7VXS4D8`는 확인되지 않았다.

라인 기준 예시:

- Purchase Guard: `line 50` 부근
- GTM-W2Z6PHN: `line 20518` 부근
- Meta Pixel init: `line 20676` 부근

판정:

- 배치 순서는 맞다.
- 즉, 가드가 GTM/Meta Pixel보다 먼저 `window.fbq` setter를 잡을 수 있는 위치다.
- 단, `shop_payment_complete` URL은 로그인 리다이렉트가 걸려 curl만으로는 실제 주문완료 DOM까지 확인하지 못했다. 최종 검증은 Pixel Helper에서 해야 한다.

## 2. `payment_success`가 무엇을 말하는가

`payment_success`는 아임웹 기본 기능이 아니다.

정확히는 **아임웹 사이트 푸터에 우리가 삽입하는 자체 Attribution 원장 수집 코드**다.

- 실행 위치: 아임웹 사이트의 푸터 삽입 코드
- 실행 조건: `shop_payment_complete` 또는 `shop_order_done` 페이지
- 전송 대상: `https://att.ainativeos.net/api/attribution/payment-success`
- 역할: 전태준 대표님이 구축한 자체 솔루션 원장에 결제완료 도달 정보를 저장
- Meta Pixel `Purchase`와는 별도다.

즉 “아임웹 삽입 코드냐?”라고 하면, **삽입 위치는 아임웹 푸터가 맞고, 코드의 소유/목적은 우리 자체 솔루션 원장 수집 코드**라고 보면 된다.

## 3. 피드백 반영 판단

`codefeedback0412_2.md`의 지적은 맞다.

반영한 내용:

- 첫 2개 푸터 스크립트는 UTM overwrite 방지 버전으로 교체.
- `checkout_context`는 유지.
- `payment_success`는 `document.referrer` fallback을 강화.
- `orderId`, `paymentKey`, `orderCode`, `orderMember` 모두 현재 URL + referrer + storage fallback을 탄다.
- skip 조건도 `orderCode`를 인정한다.
- `metadata.referrerPayment`에 `orderCode/orderNo/orderId/orderMember/paymentCode/paymentKey/amount`를 남긴다.

주의:

- 현재 백엔드 정규화 로직은 `orderCode`를 독립 컬럼으로 저장하지 않는다.
- 그래서 `orderCode`는 top-level payload에도 보내지만, 실제 보존을 위해 `metadata.orderCode`, `metadata.order_code`, `metadata.referrerPayment.orderCode`에도 중복 저장한다.

## 4. 푸터 최종 적용 코드

아임웹 푸터에는 아래 순서로 둔다.

1. 아래 `user_id / UTM / rebuyz_view` 통합 블록
2. 기존 `checkout_context` 블록은 그대로 유지
3. 아래 `payment_success` 최종 블록

### 4-1. user_id / UTM / rebuyz_view 통합 블록

기존 푸터의 첫 번째 `getUserID / waitForGtagAndSetUser / persistUtm` 스크립트와 두 번째 `sendView` 스크립트를 이 블록 하나로 교체한다.

```html
<script>
(function () {
  var CONFIG = {
    debugQueryKey: '__seo_attribution_debug',
    gtagRetryMs: 100,
    gtagMaxWaitMs: 5000,
    legacyUtmKey: 'rebuyz_utm',
    firstTouchKey: 'rebuyz_utm_first_touch',
    latestTouchKey: 'rebuyz_utm_latest_touch'
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

  function getIdxFromUrl() {
    var params = new URLSearchParams(location.search);
    return trim(params.get('idx')) || 'no_idx';
  }

  function sendRebuyzView() {
    waitForGtag(function () {
      var latestTouch = readJson(CONFIG.latestTouchKey);
      var legacyTouch = readJson(CONFIG.legacyUtmKey);
      var current = collectTrackingParams();
      var userId = getUserID() || 'anonymous';
      var eventPayload = {
        userID: userId,
        actionName: 'view',
        actionDetail: getIdxFromUrl(),
        actionTime: new Date().toISOString(),
        utm_campaign: current.utm_campaign || latestTouch.utm_campaign || legacyTouch.utm_campaign || null,
        utm_source: current.utm_source || latestTouch.utm_source || legacyTouch.utm_source || null,
        utm_medium: current.utm_medium || latestTouch.utm_medium || legacyTouch.utm_medium || null,
        utm_content: current.utm_content || latestTouch.utm_content || legacyTouch.utm_content || null,
        utm_term: current.utm_term || latestTouch.utm_term || legacyTouch.utm_term || null
      };

      window.gtag('event', 'rebuyz_view', eventPayload);
      debugLog('rebuyz_view sent', eventPayload);
    });
  }

  persistUtm();
  setGtagUserId();
  sendRebuyzView();
})();
</script>
```

### 4-2. checkout_context 블록

기존 `checkout_context` 블록은 그대로 둔다.

이번 배치에서 손대지 않는 이유:

- 현재 목적은 UTM overwrite 방지, payment_success `orderCode` 보강, pending 가상계좌 Browser Purchase 차단이다.
- `checkout_context`는 이미 `checkoutId`, GA 식별자, `_fbc/_fbp` 연결을 담당하고 있다.
- 이번 배치에서 같이 재작성하면 리스크가 커진다.

### 4-3. payment_success 최종 블록

기존 `payment_success` 스크립트는 아래 최종본으로 교체한다.

```html
<script>
(function () {
  var CONFIG = {
    endpoint: 'https://att.ainativeos.net/api/attribution/payment-success',
    source: 'biocom_imweb',
    measurementIds: ['G-WJFXN5E2Q1', 'G-8GZ48B1S59'],
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
        snippetVersion: '2026-04-12-payment-success-order-code-v2',
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
```

## 5. 반영 후 확인할 것

카드 결제 완료:

- Pixel Helper에 `Purchase`가 살아 있어야 한다.
- Browser Event ID가 `Purchase.{orderCode}`여야 한다.
- `payment_success` 원장 metadata에 `orderCode`가 남아야 한다.
- Server CAPI event_id도 `Purchase.{orderCode}`여야 한다.

가상계좌 미입금 완료:

- Pixel Helper에 `Purchase`가 없어야 한다.
- `VirtualAccountIssued`가 떠야 한다.
- `payment_success` 원장은 `pending` 상태로 남아야 한다.
- Server CAPI 운영 `Purchase`는 없어야 한다.

## 6. 검증

- live HTML에서 Header Guard가 GTM/Meta Pixel보다 먼저 있는 것을 확인했다.
- `shop_payment_complete` 직접 curl은 로그인 리다이렉트 때문에 DOM 검증은 불가했다.
- 이 문서의 `user_id / UTM / rebuyz_view` 블록은 `/tmp/biocom_footer_utm_report.js`로 추출해 `node --check`를 통과했다.
- 이 문서의 `payment_success` 최종본은 `/tmp/biocom_payment_success_report.js`로 추출해 `node --check`를 통과했다.
