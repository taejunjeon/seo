<!-- thecleancoffee footer v3 - 2026-04-15 final3 (Phase 9 fbq mirror / eventId injector added) -->
<!--
  변경 내역 vs 현재 thecleancoffee.com 라이브 footer:
    1) Block 1 UTM persistence / Block 2 checkout_started / Block 3 payment_success 는
       현재 라이브 코드 그대로 유지 (source='thecleancoffee_imweb', measurementIds=['G-JLSBXX7300'],
       snippetVersion '2026-04-14-coffee-*' 유지). 기존 라벨에 문제 없음 (biocom 같은 오염 없음).
    2) Phase 9 v3 신규 추가 — aimweb 의 fbq track 호출을 가로채서 eventId 를 주입하고
       같은 id 로 서버 CAPI 로 mirror. Meta browser ↔ server 자동 dedup.
       biocom final3 와 구조 동일, 사이트별 식별자만 치환:
         - pixelId: 1186437633687388 (thecleancoffee)
         - SNIPPET_VERSION: 2026-04-15-thecleancoffee-funnel-capi-v3
         - Purchase Guard 마커: __THECLEANCOFFEE_SERVER_PAYMENT_DECISION_GUARD_WRAPPED__ / _RAW__
    3) 기존 Purchase Guard v3 (`[thecleancoffee-server-payment-decision-guard]`) 는 coffee
       [헤더 상단] 슬롯에 별도 설치되어 있으므로 본 푸터 파일에는 포함하지 않음. 손대지 말 것.
    4) 초기 config: enableServerCapi=false (무해 dry-run 단계 0).
       단계 1 (testEventCode Test Events 탭) / 단계 2 (정식 운영) 는 biocom v3 와 동일 rollout.
-->
<!-- Fixed attribution endpoint: https://att.ainativeos.net -->
<!-- thecleancoffee GA4 정본 measurement id: G-JLSBXX7300 -->
<!-- thecleancoffee Meta pixel id: 1186437633687388 -->

<script>
/* ── Block 1: UTM persistence + Formbricks user_id + gtag user_id ── */
(function () {
  var CONFIG = {
    debugQueryKey: '__seo_attribution_debug',
    gtagRetryMs: 100,
    gtagMaxWaitMs: 5000,
    // 기존 coffee footer 의 _p1s1a_* key 유지 — 과거 first-touch 데이터 호환
    legacyUtmKey: '_p1s1a_session_touch',
    firstTouchKey: '_p1s1a_first_touch',
    latestTouchKey: '_p1s1a_last_touch'
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
    // 커피 사이트에 Formbricks 가 설치돼 있으면 user_id 추출, 없으면 빈 문자열
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

    // 기존 _p1s1a_* 키 호환 — first_touch 는 한 번만 저장, last_touch 는 매번 갱신
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

  persistUtm();
  setGtagUserId();
})();
</script>

<script>
/* ── Block 2: checkout_started 이벤트 ── */
(function () {
  var CONFIG = {
    endpoint: 'https://att.ainativeos.net/api/attribution/checkout-context',
    source: 'thecleancoffee_imweb',
    measurementIds: ['G-JLSBXX7300'],
    snippetVersion: '2026-04-14-coffee-checkout-started-v1',
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
/* ── Block 3: payment_success 이벤트 (orderCode/referrerPayment/fbc/fbp 전부 포함) ── */
(function () {
  var CONFIG = {
    endpoint: 'https://att.ainativeos.net/api/attribution/payment-success',
    source: 'thecleancoffee_imweb',
    measurementIds: ['G-JLSBXX7300'],
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
        snippetVersion: '2026-04-14-coffee-payment-success-order-code-v1',
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

<!--
  Phase 9 Funnel CAPI mirror — thecleancoffee v3 (fbq interceptor + eventId injector)

  단계별 config 전환:
    0) 코드 주입 직후 (무해 dry-run): enableServerCapi=false, debug=true
       → Phase 9 는 aimweb 의 fbq 호출에 eventId 를 주입하지만 서버로는 아무것도 안 쏨.
       → 브라우저 Meta 이벤트는 여전히 aimweb 이 주체, Phase 9 는 eid 주입 효과만 관찰.
       → 주의: eid 주입은 실 픽셀에 영향을 줌 (aimweb 호출이 실제로 eid 달고 나감).
               따라서 "진짜 완전 무해" 는 아니지만, 기존 browser 이벤트 자체를 중복시키진 않음.
               Meta 의 기존 카운트와 동일한 수량 + eid 가 새로 붙은 것만 변경됨.
    1) 서버만 테스트 (Test Events 탭):
       enableServerCapi=true, testEventCode='TEST_XXX'
       → 서버 CAPI 가 testEventCode 를 달고 Events Manager 테스트 탭으로만 수신됨.
       → 정규 카운트 영향 없음.
    2) 정식 운영:
       enableServerCapi=true, testEventCode='', debug=false
       → 서버 CAPI 정상 송신. Meta 가 browser(aimweb)+server(Phase 9) 쌍을 eventId 로 dedup.
-->
<script>
  window.FUNNEL_CAPI_CONFIG = {
    pixelId: '1186437633687388',
    endpoint: 'https://att.ainativeos.net/api/meta/capi/track',
    enableServerCapi: false,
    testEventCode: '',
    debug: true
  };
</script>

<script>
/*!
 * Phase 9 — Funnel CAPI mirror (thecleancoffee) v3
 * 2026-04-15-thecleancoffee-funnel-capi-v3
 *
 * 전략: window.fbq 를 wrap 하여 aimweb 이 이미 쏘고 있는 ViewContent / AddToCart /
 * InitiateCheckout / AddPaymentInfo track 호출을 가로챈다.
 *   - eventID 가 없으면 결정론적 id 를 주입 (ViewContent.<prod>.<sessionId>)
 *   - 같은 id 로 서버 CAPI 로 mirror
 *   - Meta 가 browser+server 자동 dedup → 중복 없음
 *
 * Purchase Guard v3 의 fbq wrap 은 그대로 유지된다. Phase 9 mirror 는 Purchase Guard
 * 보다 바깥쪽에서 돌고, 내부 호출 경로는:
 *   aimweb → Phase 9 mirror → Purchase Guard → 원본 fbq → HTTP /tr/
 */
(function () {
  'use strict';
  var cfg = window.FUNNEL_CAPI_CONFIG || {};
  var SNIPPET_VERSION = '2026-04-15-thecleancoffee-funnel-capi-v3';
  var ENDPOINT = cfg.endpoint || 'https://att.ainativeos.net/api/meta/capi/track';
  var PIXEL_ID = cfg.pixelId;
  var ENABLE_SERVER_CAPI = !!cfg.enableServerCapi;
  var TEST_CODE = cfg.testEventCode || '';
  var DEBUG = !!cfg.debug;

  if (!PIXEL_ID) {
    console.warn('[funnel-capi] FUNNEL_CAPI_CONFIG.pixelId missing — aborting');
    return;
  }
  if (window.__FUNNEL_CAPI_INSTALLED) return;
  window.__FUNNEL_CAPI_INSTALLED = SNIPPET_VERSION;

  /* ── 유틸 ──────────────────────────────────────────────────────────── */
  function log() {
    if (!DEBUG) return;
    try { console.info.apply(console, ['[funnel-capi]'].concat([].slice.call(arguments))); }
    catch (e) {}
  }

  function getCookie(name) {
    try {
      var m = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/[-.+*]/g, '\\$&') + '=([^;]*)'));
      return m ? decodeURIComponent(m[1]) : undefined;
    } catch (e) { return undefined; }
  }

  function safeObj(x) {
    return x && typeof x === 'object' && !Array.isArray(x) ? x : {};
  }

  /* ── 세션 고정 id (eventId 주입용) ─────────────────────────────────── */
  var SESSION_KEY = '__seo_funnel_session';
  function getOrCreateSessionId() {
    try {
      var sid = window.sessionStorage && window.sessionStorage.getItem(SESSION_KEY);
      if (sid) return sid;
      sid = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      if (window.sessionStorage) window.sessionStorage.setItem(SESSION_KEY, sid);
      return sid;
    } catch (e) { return 'ns_' + Date.now().toString(36); }
  }
  var SESSION_ID = getOrCreateSessionId();

  /* ── 서버 mirror dedup (eventId 기준) ──────────────────────────────── */
  function sentKey(eventId) { return 'funnelCapi::sent::' + eventId; }
  function alreadySent(eventId) {
    try { return !!(window.sessionStorage && window.sessionStorage.getItem(sentKey(eventId))); }
    catch (e) { return false; }
  }
  function markSent(eventId) {
    try { if (window.sessionStorage) window.sessionStorage.setItem(sentKey(eventId), '1'); } catch (e) {}
  }

  /* ── 결정론적 eventId 생성 (aimweb 이 eid 없이 쏠 때 주입) ────────── */
  var MIRROR_EVENTS = {
    ViewContent: true,
    AddToCart: true,
    InitiateCheckout: true,
    AddPaymentInfo: true
    /* Purchase 는 제외 — Purchase Guard v3 가 단독 관리 */
  };

  function extractContentKey(payload) {
    if (!payload || typeof payload !== 'object') return 'unknown';
    var ids = payload.content_ids || payload.contentIds;
    if (Array.isArray(ids) && ids.length) return String(ids[0]);
    if (typeof ids === 'string' && ids) return ids;
    // AddPaymentInfo 류는 content_ids 가 없을 수 있음 → value 기반 fallback
    if (payload.value) return 'v' + Math.round(Number(payload.value) || 0);
    return 'unknown';
  }

  function ensureEventId(eventName, payload, eventMeta) {
    var existing = eventMeta && (eventMeta.eventID || eventMeta.eventId);
    if (existing) return { id: String(existing), injected: false };
    var key = extractContentKey(payload);
    var id = eventName + '.' + key + '.' + SESSION_ID;
    return { id: id, injected: true };
  }

  /* ── 서버 CAPI mirror ──────────────────────────────────────────────── */
  function serverMirror(eventName, eventId, payload) {
    if (alreadySent(eventId)) {
      log('server dup skip', eventName, eventId);
      return;
    }
    markSent(eventId);

    if (!ENABLE_SERVER_CAPI) {
      log('server skipped (disabled)', eventName, eventId);
      return;
    }

    var body = {
      eventName: eventName,
      pixelId: PIXEL_ID,
      eventId: eventId,
      eventSourceUrl: location.href,
      fbp: getCookie('_fbp'),
      fbc: getCookie('_fbc'),
      contentIds: payload.content_ids || payload.contentIds || undefined,
      contentType: payload.content_type || payload.contentType || undefined,
      value: payload.value != null ? payload.value : undefined,
      currency: payload.currency || 'KRW'
    };
    if (TEST_CODE) body.testEventCode = TEST_CODE;

    try {
      fetch(ENDPOINT, {
        method: 'POST',
        mode: 'cors',
        credentials: 'omit',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        keepalive: true
      }).then(function (r) {
        if (!r.ok) log('server non-2xx', r.status, eventName, eventId);
        else log('server ok', eventName, eventId);
      }).catch(function (err) {
        log('server error', eventName, eventId, err && err.message ? err.message : err);
      });
    } catch (e) {
      log('fetch throw', eventName, eventId, e && e.message ? e.message : e);
    }
  }

  /* ── fbq interceptor ───────────────────────────────────────────────── */
  var wrapAttempts = 0;
  var WRAP_MAX_ATTEMPTS = 80; // ~8초 (100ms 간격)

  function wrapFbq() {
    if (typeof window.fbq !== 'function') {
      if (++wrapAttempts < WRAP_MAX_ATTEMPTS) {
        setTimeout(wrapFbq, 100);
      } else {
        log('fbq wrap gave up — fbq not loaded');
      }
      return;
    }

    var orig = window.fbq;
    if (orig.__FUNNEL_CAPI_V3_WRAPPED__) {
      log('fbq already wrapped — skip');
      return;
    }

    var mirror = function () {
      var args = Array.prototype.slice.call(arguments);

      try {
        if (args[0] === 'track' && MIRROR_EVENTS[args[1]]) {
          var eventName = args[1];
          var payload = safeObj(args[2]);
          var eventMeta = safeObj(args[3]);
          var idRes = ensureEventId(eventName, payload, eventMeta);

          if (idRes.injected) {
            // aimweb 의 원래 호출에 eventId 를 주입해서 browser 쪽도 eid 달고 나가게 함
            var merged = {};
            for (var k in eventMeta) if (Object.prototype.hasOwnProperty.call(eventMeta, k)) merged[k] = eventMeta[k];
            merged.eventID = idRes.id;
            args[3] = merged;
            log('inject eid', eventName, idRes.id, 'payload=', payload);
          } else {
            log('reuse eid', eventName, idRes.id);
          }

          // 서버 mirror (비동기, 원본 호출을 block 하지 않음)
          serverMirror(eventName, idRes.id, payload);
        }
      } catch (e) {
        log('mirror observe error', e && e.message ? e.message : e);
      }

      // Purchase Guard wrap → 원본 fbq 로 전달
      return orig.apply(this, args);
    };

    /* ── 기존 fbq 속성 / Purchase Guard 마커 보존 ──
         fbq 는 function 이면서 queue/callMethod/loaded/version/agent 등 속성을 가짐.
         Purchase Guard v3 는 __THECLEANCOFFEE_SERVER_PAYMENT_DECISION_GUARD_WRAPPED__ 와
         __THECLEANCOFFEE_SERVER_PAYMENT_DECISION_GUARD_RAW__ 를 붙인다. 전부 복사해서 상위로 전파. */
    try {
      for (var k in orig) {
        if (Object.prototype.hasOwnProperty.call(orig, k)) {
          try { mirror[k] = orig[k]; } catch (copyErr) {}
        }
      }
    } catch (e) {}
    // 명시적으로 중요 속성 복사 (for-in 으로 못 잡을 수 있음)
    if (orig.callMethod) mirror.callMethod = orig.callMethod;
    if (orig.queue) mirror.queue = orig.queue;
    if (orig.loaded) mirror.loaded = orig.loaded;
    if (orig.version) mirror.version = orig.version;
    if (orig.agent) mirror.agent = orig.agent;
    if (orig._fbq) mirror._fbq = orig._fbq;
    if (orig.push) mirror.push = orig.push;
    // Purchase Guard 마커 전파
    if (orig.__THECLEANCOFFEE_SERVER_PAYMENT_DECISION_GUARD_WRAPPED__) {
      mirror.__THECLEANCOFFEE_SERVER_PAYMENT_DECISION_GUARD_WRAPPED__ = true;
    }
    if (orig.__THECLEANCOFFEE_SERVER_PAYMENT_DECISION_GUARD_RAW__) {
      mirror.__THECLEANCOFFEE_SERVER_PAYMENT_DECISION_GUARD_RAW__ = orig.__THECLEANCOFFEE_SERVER_PAYMENT_DECISION_GUARD_RAW__;
    }
    mirror.__FUNNEL_CAPI_V3_WRAPPED__ = true;

    window.fbq = mirror;
    // _fbq 별칭도 동기화 (Meta pixel base code 가 참조)
    if (window._fbq === orig) window._fbq = mirror;

    log('fbq wrapped', 'agent=' + (orig.agent || '?'), 'version=' + (orig.version || '?'));
  }

  wrapFbq();

  log('installed', SNIPPET_VERSION,
      'pixel=' + PIXEL_ID,
      'enableServerCapi=' + ENABLE_SERVER_CAPI,
      'testEventCode=' + (TEST_CODE || '(none)'),
      'sessionId=' + SESSION_ID);
})();
</script>
