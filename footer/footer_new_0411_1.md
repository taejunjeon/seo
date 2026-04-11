아래 **전체를 현재 푸터 코드와 통째로 교체해서** 넣으시면 됩니다.
현재 푸터의 `user_id/UTM`, `rebuyz_view`, `payment_success`를 유지하면서, `checkout_started`를 추가하고 `payment_success`에 `checkoutId`, `_fbc`, `_fbp`, checkout context 연결까지 반영한 최종 병합본입니다. `checkout_started`는 기존 `payment_success`와 **같이 있어야** 하고, `payment_success`에도 같은 `checkoutId`를 실어 보내야 두 이벤트를 이어붙일 수 있습니다. 또한 기존 `trim()` 버그를 피하려고 숫자형 값도 문자열로 안전하게 처리하도록 바꿨습니다.

```html
<script>
// 사용자 ID 가져오기 함수
function getUserID() {
  try {
    const formbricksStr = localStorage.getItem('formbricks-js');
    if (formbricksStr) {
      const formbricks = JSON.parse(formbricksStr);
      if (formbricks.personState?.data?.userId) {
        return formbricks.personState.data.userId;
      }
    }
    return null;
  } catch (error) {
    console.warn('Failed to get userID:', error);
    return null;
  }
}

// gtag 로드 대기 및 user_id 설정
function waitForGtagAndSetUser() {
  if (typeof gtag !== 'undefined') {
    const userID = getUserID();
    if (userID) {
      gtag('set', { user_id: userID });
      console.log('User ID set:', userID);
    }
  } else {
    setTimeout(waitForGtagAndSetUser, 100);
  }
}

// 로그인/회원 식별 후 가능한 이른 시점에 user_id 설정
waitForGtagAndSetUser();

// UTM 파라미터를 첫 방문 시 localStorage에 저장
(function persistUtm() {
  const userID = getUserID();

  if (userID) {
    const params = new URLSearchParams(location.search);
    const utm = {
      utm_campaign: params.get('utm_campaign') || '0',
      utm_source: params.get('utm_source') || '0',
      utm_medium: params.get('utm_medium') || '0',
      utm_content: params.get('utm_content') || '0',
      user_id: userID,
      ts: Date.now()
    };

    localStorage.setItem('rebuyz_utm', JSON.stringify(utm));
    console.log('UTM data saved:', utm);
  }
})();
</script>

<script>
(function sendView() {
  function getUserID() {
    try {
      const formbricksStr = localStorage.getItem('formbricks-js');
      if (formbricksStr) {
        const formbricks = JSON.parse(formbricksStr);
        if (formbricks.personState?.data?.userId) {
          return formbricks.personState.data.userId;
        }
      }
      return 'anonymous';
    } catch (error) {
      console.warn('Failed to get userID:', error);
      return 'anonymous';
    }
  }

  function getIdxFromUrl() {
    const params = new URLSearchParams(location.search);
    const idx = params.get('idx');
    return idx || 'no_idx';
  }

  function waitForGtag(callback) {
    if (typeof gtag !== 'undefined') {
      callback();
    } else {
      setTimeout(() => waitForGtag(callback), 100);
    }
  }

  waitForGtag(() => {
    const userID = getUserID();
    const actionName = 'view';
    const actionDetail = getIdxFromUrl();
    const actionTime = new Date().toISOString();

    const url = new URL(location.href);
    const utmNow = ['utm_campaign', 'utm_source', 'utm_medium', 'utm_content']
      .reduce((acc, k) => {
        const v = url.searchParams.get(k);
        if (v) acc[k] = v;
        return acc;
      }, {});
    const utmStore = JSON.parse(localStorage.getItem('rebuyz_utm') || '{}');
    const utm = {
      utm_campaign: utmNow.utm_campaign || utmStore.utm_campaign || null,
      utm_source: utmNow.utm_source || utmStore.utm_source || null,
      utm_medium: utmNow.utm_medium || utmStore.utm_medium || null,
      utm_content: utmNow.utm_content || utmStore.utm_content || null
    };

    gtag('event', 'rebuyz_view', {
      userID,
      actionName,
      actionDetail,
      actionTime,
      ...utm
    });

    console.log('GA events sent:', { userID, actionName, actionDetail });
  });
})();
</script>

<script>
(function () {
  var CONFIG = {
    endpoint: 'https://att.ainativeos.net/api/attribution/checkout-context',
    source: 'biocom_imweb',
    measurementIds: ['G-WJFXN5E2Q1', 'G-8GZ48B1S59'],
    snippetVersion: '2026-04-11-checkout-started-v1',
    requestTimeoutMs: 800,
    debugQueryKey: '__seo_attribution_debug',
    checkoutIdKey: '__seo_checkout_id',
    checkoutContextKey: '__seo_checkout_context',
    dedupeKeyPrefix: '__seo_checkout_started_sent__:'
  };

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

  function writeJsonStorage(storage, key, value) {
    try {
      if (!storage) return;
      storage.setItem(key, JSON.stringify(value));
    } catch (error) {}
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

  function isDebugMode() {
    return new URLSearchParams(location.search).get(CONFIG.debugQueryKey) === '1';
  }

  function debugLog() {
    if (!isDebugMode()) return;
    try {
      console.log.apply(console, ['[seo-checkout-started]'].concat([].slice.call(arguments)));
    } catch (error) {}
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

  function getOrCreateCheckoutId() {
    try {
      var existing = trim(window.sessionStorage && window.sessionStorage.getItem(CONFIG.checkoutIdKey));
      if (existing) return existing;
      var created = 'chk_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
      if (window.sessionStorage) {
        window.sessionStorage.setItem(CONFIG.checkoutIdKey, created);
      }
      return created;
    } catch (error) {
      return 'chk_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
    }
  }

  function isCheckoutCandidate() {
    var href = location.href;
    var path = location.pathname;

    if (/shop_payment_complete|shop_order_done|order_complete|payment_complete/i.test(href)) {
      return false;
    }

    return /shop_order|shop_payment|order_form|checkout/i.test(path + ' ' + href);
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
        throw new Error('checkout-context failed with ' + response.status);
      }
      return { sentBy: 'fetch', accepted: true, status: response.status };
    });
  }

  if (!isCheckoutCandidate()) return;

  var imwebSession = readJsonStorage(window.sessionStorage, '__bs_imweb_session');
  var lastTouch = readJsonStorage(window.localStorage, '_p1s1a_last_touch');
  var checkoutId = getOrCreateCheckoutId();
  var landing = location.href;
  var initialReferrer = firstNonEmpty([
    trim(imwebSession.initialReferrer),
    trim(lastTouch.referrer),
    document.referrer || ''
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

  var dedupeKey = CONFIG.dedupeKeyPrefix + checkoutId;
  if (hasSentMarker(dedupeKey)) {
    debugLog('skip duplicate', dedupeKey);
    return;
  }

  Promise.all([
    Promise.resolve(firstNonEmpty([
      readDataLayerValue(['ga_session_id', 'gaSessionId']),
      trim(lastTouch.ga_session_id),
      trim(imwebSession.ga_session_id)
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
      trim(imwebSession.client_id)
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
      clientId
    ]);
    var customerKey = firstNonEmpty([
      trim(lastTouch.customerKey),
      trim(imwebSession.customerKey),
      trim(imwebSession.memberId),
      trim(imwebSession.member_id)
    ]);
    var observedAt = new Date().toISOString();

    var payload = {
      touchpoint: 'checkout_started',
      captureMode: 'live',
      source: CONFIG.source,
      checkoutId: checkoutId,
      customerKey: customerKey,
      clientObservedAt: observedAt,
      landing: landing,
      referrer: document.referrer || '',
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
        snippetVersion: CONFIG.snippetVersion,
        ga_measurement_ids: CONFIG.measurementIds,
        fbc: tracking.fbc,
        fbp: tracking.fbp,
        checkoutTrigger: 'pageview',
        checkoutUrl: landing,
        imweb_landing_url: trim(imwebSession.utmLandingUrl),
        initial_referrer: initialReferrer,
        original_referrer: initialReferrer,
        user_pseudo_id_strategy: userPseudoId && userPseudoId === clientId ? 'client_id_fallback' : 'explicit_value'
      }
    };

    writeJsonStorage(window.sessionStorage, CONFIG.checkoutContextKey, {
      checkoutId: checkoutId,
      clientObservedAt: observedAt,
      landing: landing,
      referrer: payload.referrer,
      gaSessionId: gaSessionId,
      clientId: clientId,
      userPseudoId: userPseudoId,
      customerKey: customerKey,
      snippetVersion: CONFIG.snippetVersion
    });

    debugLog('send payload', payload);
    return sendPayload(payload).then(function (result) {
      rememberSent(dedupeKey);
      debugLog('send ok', result);
      return result;
    }).catch(function (error) {
      debugLog('send failed', error && error.message ? error.message : error);
    });
  });
})();
</script>

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

  var orderId = firstNonEmpty([
    getSearchParam(['order_no', 'orderId', 'order_id']),
    trim(imwebSession.order_no),
    trim(lastTouch.orderId),
    getOrderIdFromDom()
  ]);
  var paymentKey = firstNonEmpty([
    getSearchParam(['paymentKey', 'payment_key']),
    trim(lastTouch.paymentKey)
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
        snippetVersion: '2026-04-11-payment-success-checkout-linked-v1',
        ga_measurement_ids: CONFIG.measurementIds,
        imweb_landing_url: trim(imwebSession.utmLandingUrl),
        initial_referrer: firstNonEmpty([trim(imwebSession.initialReferrer), trim(lastTouch.referrer)]),
        original_referrer: firstNonEmpty([trim(imwebSession.initialReferrer), trim(lastTouch.referrer)]),
        fbc: tracking.fbc,
        fbp: tracking.fbp,
        checkout_started_observed_at: trim(checkoutContext.clientObservedAt),
        checkout_started_landing: trim(checkoutContext.landing),
        checkout_started_snippet_version: trim(checkoutContext.snippetVersion),
        user_pseudo_id_strategy: userPseudoId && userPseudoId === clientId ? 'client_id_fallback' : 'explicit_value'
      }
    };

    if (!payload.orderId && !payload.paymentKey && payload.referrer.indexOf('paymentKey=') < 0 && payload.referrer.indexOf('orderNo=') < 0 && payload.referrer.indexOf('orderId=') < 0) {
      debugLog('skip: no order/payment key hint', payload);
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

붙인 뒤에는 먼저 주문서/결제 시작 페이지에 들어가서 `checkout_started`가 생기는지만 보세요. 그다음 실제 결제완료 1건에서 `payment_success`에 `checkoutId`가 들어오는지 보면 됩니다. `checkout_started`는 운영 DB를 건드리지 않고 SEO local ledger에만 쌓는 흐름이라, 지금처럼 운영 DB를 못 건드리는 상황에서 먼저 붙이기 좋은 작업입니다.