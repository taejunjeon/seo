<script>
(function () {
  var CONFIG = {
    endpoint: 'https://att.ainativeos.net/api/attribution/payment-success',
    source: 'aibio_imweb',
    measurementIds: ["G-PQWB91F4VQ"],
    requestTimeoutMs: 800,
    debugQueryKey: '__seo_attribution_debug',
    dedupeKeyPrefix: '__seo_payment_success_sent__:'
  };

  if (location.href.indexOf('shop_payment_complete') < 0 && location.href.indexOf('shop_order_done') < 0) return;
  if (CONFIG.endpoint.indexOf('YOUR_FIXED_ENDPOINT') >= 0) return;

  function trim(value) {
    return typeof value === 'string' ? value.trim() : '';
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
      var params = new URL(urlLike).searchParams;
      return {
        utm_source: firstNonEmpty([base.utm_source, params.get('utm_source')]),
        utm_medium: firstNonEmpty([base.utm_medium, params.get('utm_medium')]),
        utm_campaign: firstNonEmpty([base.utm_campaign, params.get('utm_campaign')]),
        utm_content: firstNonEmpty([base.utm_content, params.get('utm_content')]),
        utm_term: firstNonEmpty([base.utm_term, params.get('utm_term')]),
        gclid: firstNonEmpty([base.gclid, params.get('gclid')]),
        fbclid: firstNonEmpty([base.fbclid, params.get('fbclid')]),
        ttclid: firstNonEmpty([base.ttclid, params.get('ttclid')])
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
    var body = JSON.stringify(payload);
    return fetch(CONFIG.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body,
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
  var landing = firstNonEmpty([trim(imwebSession.utmLandingUrl), trim(lastTouch.landing), location.pathname]);
  var tracking = mergeLandingParams({
    utm_source: firstNonEmpty([trim(imwebSession.utmSource), trim(lastTouch.utm_source), getSearchParam(['utm_source'])]),
    utm_medium: firstNonEmpty([trim(imwebSession.utmMedium), trim(lastTouch.utm_medium), getSearchParam(['utm_medium'])]),
    utm_campaign: firstNonEmpty([trim(imwebSession.utmCampaign), trim(lastTouch.utm_campaign), getSearchParam(['utm_campaign'])]),
    utm_content: firstNonEmpty([trim(imwebSession.utmContent), trim(lastTouch.utm_content), getSearchParam(['utm_content'])]),
    utm_term: firstNonEmpty([trim(imwebSession.utmTerm), trim(lastTouch.utm_term), getSearchParam(['utm_term'])]),
    gclid: firstNonEmpty([trim(lastTouch.gclid), getSearchParam(['gclid'])]),
    fbclid: firstNonEmpty([trim(lastTouch.fbclid), getSearchParam(['fbclid'])]),
    ttclid: firstNonEmpty([trim(lastTouch.ttclid), getSearchParam(['ttclid'])])
  }, landing);

  var dedupeKey = CONFIG.dedupeKeyPrefix + firstNonEmpty([orderId, paymentKey, location.pathname + '::' + document.referrer]);
  if (dedupeKey && hasSentMarker(dedupeKey)) {
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

    var payload = {
      touchpoint: 'payment_success',
      captureMode: 'live',
      source: CONFIG.source,
      orderId: orderId,
      paymentKey: paymentKey,
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
      metadata: {
        snippetVersion: '2026-04-08-fetchfix',
        ga_measurement_ids: CONFIG.measurementIds,
        imweb_landing_url: trim(imwebSession.utmLandingUrl),
        initial_referrer: firstNonEmpty([trim(imwebSession.initialReferrer), trim(lastTouch.referrer)]),
        original_referrer: firstNonEmpty([trim(imwebSession.initialReferrer), trim(lastTouch.referrer)]),
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
    endpoint: 'https://att.ainativeos.net/api/attribution/form-submit',
    source: 'aibio_imweb',
    measurementIds: ["G-PQWB91F4VQ"],
    requestTimeoutMs: 800,
    debugQueryKey: '__seo_attribution_debug',
    dedupeKeyPrefix: '__seo_form_submit_sent__:'
  };
  var pendingSubmit = null;
  var inFlightSubmitKeys = {};
  var recentHandledWidgets = {};
  var clickHookInstalled = false;
  var confirmHookAttempts = 0;
  var successModalPollTimer = null;

  function trim(value) {
    return typeof value === 'string' ? value.trim() : '';
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

  function mergeLandingParams(base, urlLike) {
    try {
      if (!urlLike) return base;
      var params = new URL(urlLike).searchParams;
      return {
        utm_source: firstNonEmpty([base.utm_source, params.get('utm_source')]),
        utm_medium: firstNonEmpty([base.utm_medium, params.get('utm_medium')]),
        utm_campaign: firstNonEmpty([base.utm_campaign, params.get('utm_campaign')]),
        utm_content: firstNonEmpty([base.utm_content, params.get('utm_content')]),
        utm_term: firstNonEmpty([base.utm_term, params.get('utm_term')]),
        gclid: firstNonEmpty([base.gclid, params.get('gclid')]),
        fbclid: firstNonEmpty([base.fbclid, params.get('fbclid')]),
        ttclid: firstNonEmpty([base.ttclid, params.get('ttclid')])
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

  function hasInFlightMarker(key) {
    return Boolean(key && inFlightSubmitKeys[key]);
  }

  function rememberInFlight(key) {
    if (!key) return;
    inFlightSubmitKeys[key] = true;
  }

  function clearInFlight(key) {
    if (!key) return;
    delete inFlightSubmitKeys[key];
  }

  function wasRecentlyHandled(widgetId, now) {
    var key = trim(widgetId);
    if (!key) return false;
    var previous = recentHandledWidgets[key];
    return Boolean(previous && now - previous < 10000);
  }

  function rememberHandledWidget(widgetId, now) {
    var key = trim(widgetId);
    if (!key) return;
    recentHandledWidgets[key] = now;
  }

  function isDebugMode() {
    return new URLSearchParams(location.search).get(CONFIG.debugQueryKey) === '1';
  }

  function debugLog() {
    if (!isDebugMode()) return;
    try {
      console.log.apply(console, ['[seo-form-submit-fallback]'].concat([].slice.call(arguments)));
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
        throw new Error('form-submit failed with ' + response.status);
      }
      return { sentBy: 'fetch', accepted: true, status: response.status };
    });
  }

  function getWidgetIdFromOnclick(node) {
    if (!node || typeof node.getAttribute !== 'function') return '';
    var onclick = trim(node.getAttribute('onclick'));
    if (!onclick) return '';
    var match = onclick.match(/confirmInputForm\('([^']+)'/);
    return match ? trim(match[1]) : '';
  }

  function rememberPendingSubmit(widgetId, triggerType) {
    pendingSubmit = {
      widgetId: trim(widgetId),
      triggerType: trim(triggerType),
      triggeredAt: Date.now()
    };
    debugLog('pending submit', pendingSubmit);
    schedulePendingSubmitModalPoll();
  }

  function buildFormId(widgetId, triggeredAt) {
    return [location.pathname || '/', trim(widgetId) || 'unknown_widget', String(triggeredAt || Date.now())].join('_');
  }

  function pushDataLayer(formPage, formId, widgetId) {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event: 'aibio_form_submit',
      formPage: formPage,
      formId: formId,
      formWidgetId: trim(widgetId)
    });
  }

  function sendFormSubmit(widgetId, triggeredAt, triggerType) {
    var imwebSession = readJsonStorage(window.sessionStorage, '__bs_imweb_session');
    var lastTouch = readJsonStorage(window.localStorage, '_p1s1a_last_touch');
    var formPage = location.pathname || '/';
    var formId = buildFormId(widgetId, triggeredAt);
    var dedupeKey = CONFIG.dedupeKeyPrefix + formId;

    if (hasSentMarker(dedupeKey) || hasInFlightMarker(dedupeKey)) {
      debugLog('skip duplicate', dedupeKey);
      return;
    }
    rememberInFlight(dedupeKey);

    pushDataLayer(formPage, formId, widgetId);

    var landing = firstNonEmpty([trim(imwebSession.utmLandingUrl), trim(lastTouch.landing), location.href]);
    var tracking = mergeLandingParams({
      utm_source: firstNonEmpty([trim(imwebSession.utmSource), trim(lastTouch.utm_source), getSearchParam(['utm_source'])]),
      utm_medium: firstNonEmpty([trim(imwebSession.utmMedium), trim(lastTouch.utm_medium), getSearchParam(['utm_medium'])]),
      utm_campaign: firstNonEmpty([trim(imwebSession.utmCampaign), trim(lastTouch.utm_campaign), getSearchParam(['utm_campaign'])]),
      utm_content: firstNonEmpty([trim(imwebSession.utmContent), trim(lastTouch.utm_content), getSearchParam(['utm_content'])]),
      utm_term: firstNonEmpty([trim(imwebSession.utmTerm), trim(lastTouch.utm_term), getSearchParam(['utm_term'])]),
      gclid: firstNonEmpty([trim(lastTouch.gclid), getSearchParam(['gclid'])]),
      fbclid: firstNonEmpty([trim(lastTouch.fbclid), getSearchParam(['fbclid'])]),
      ttclid: firstNonEmpty([trim(lastTouch.ttclid), getSearchParam(['ttclid'])])
    }, landing);

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

      var payload = {
        touchpoint: 'form_submit',
        captureMode: 'live',
        source: CONFIG.source,
        clientObservedAt: new Date().toISOString(),
        formId: formId,
        formName: 'form',
        formPage: formPage,
        referrer: location.href,
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
        metadata: {
          snippetVersion: '2026-04-08-formfetchfix-v5',
          ga_measurement_ids: CONFIG.measurementIds,
          imweb_landing_url: trim(imwebSession.utmLandingUrl),
          initial_referrer: firstNonEmpty([trim(imwebSession.initialReferrer), trim(lastTouch.referrer), document.referrer || '']),
          original_referrer: firstNonEmpty([trim(imwebSession.initialReferrer), trim(lastTouch.referrer), document.referrer || '']),
          form_widget_id: trim(widgetId),
          form_trigger_type: trim(triggerType),
          user_pseudo_id_strategy: userPseudoId && userPseudoId === clientId ? 'client_id_fallback' : 'explicit_value'
        }
      };

      debugLog('send payload', payload);
      return sendPayload(payload).then(function (result) {
        rememberSent(dedupeKey);
        clearInFlight(dedupeKey);
        debugLog('send ok', result);
        return result;
      }).catch(function (error) {
        clearInFlight(dedupeKey);
        debugLog('send failed', error && error.message ? error.message : error);
      });
    });
  }

  function installClickHook() {
    if (clickHookInstalled) return;
    clickHookInstalled = true;
    document.addEventListener('click', function (event) {
      var target = event.target && event.target.closest ? event.target.closest('._input_form_submit') : null;
      if (!target) return;
      rememberPendingSubmit(getWidgetIdFromOnclick(target), 'click');
    }, true);
  }

  function installConfirmHook() {
    if (!window.SITE_FORM || typeof window.SITE_FORM.confirmInputForm !== 'function') {
      return false;
    }
    if (window.SITE_FORM.confirmInputForm.__seoWrapped) {
      return true;
    }

    var original = window.SITE_FORM.confirmInputForm;
    var wrapped = function () {
      rememberPendingSubmit(arguments[0], 'confirmInputForm');
      return original.apply(this, arguments);
    };

    wrapped.__seoWrapped = true;
    window.SITE_FORM.confirmInputForm = wrapped;
    return true;
  }

  function scheduleConfirmHookInstall() {
    if (installConfirmHook()) return;
    var timer = setInterval(function () {
      confirmHookAttempts += 1;
      if (installConfirmHook() || confirmHookAttempts >= 100) {
        clearInterval(timer);
      }
    }, 200);
  }

  function modalWidgetId(modal) {
    if (!modal || !modal.id) return '';
    return trim(modal.id.replace(/^input_form_complete_modal_/, ''));
  }

  function getSuccessModal(widgetId) {
    if (!widgetId || !document.getElementById) return null;
    return document.getElementById('input_form_complete_modal_' + trim(widgetId));
  }

  function isVisibleSuccessModal(modal) {
    if (!modal || !modal.id || modal.id.indexOf('input_form_complete_modal_') !== 0) return false;
    if (modal.getAttribute('aria-hidden') === 'true') return false;
    if (modal.style && modal.style.display === 'none') return false;
    return true;
  }

  function handleSuccessModal(modal) {
    var widgetId = modalWidgetId(modal);
    var now = Date.now();
    if (wasRecentlyHandled(widgetId, now)) {
      debugLog('skip recent handled widget', widgetId);
      return;
    }
    var pendingMatches = pendingSubmit && now - pendingSubmit.triggeredAt < 60000 && (!pendingSubmit.widgetId || pendingSubmit.widgetId === widgetId);
    var triggeredAt = pendingMatches ? pendingSubmit.triggeredAt : now;
    var triggerType = pendingMatches ? pendingSubmit.triggerType : 'success_modal';
    if (successModalPollTimer) {
      clearInterval(successModalPollTimer);
      successModalPollTimer = null;
    }
    rememberHandledWidget(widgetId, now);
    sendFormSubmit(widgetId, triggeredAt, triggerType);
    if (pendingMatches) {
      pendingSubmit = null;
    }
  }

  function schedulePendingSubmitModalPoll() {
    if (!pendingSubmit || !pendingSubmit.widgetId) return;
    if (successModalPollTimer) {
      clearInterval(successModalPollTimer);
      successModalPollTimer = null;
    }

    var attempts = 0;
    successModalPollTimer = setInterval(function () {
      attempts += 1;
      if (!pendingSubmit || attempts >= 80) {
        clearInterval(successModalPollTimer);
        successModalPollTimer = null;
        return;
      }

      var modal = getSuccessModal(pendingSubmit.widgetId);
      if (isVisibleSuccessModal(modal)) {
        clearInterval(successModalPollTimer);
        successModalPollTimer = null;
        handleSuccessModal(modal);
      }
    }, 250);
  }

  function watchSuccessModals() {
    if (!window.MutationObserver || !document.body) return;

    new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        if (isVisibleSuccessModal(mutation.target)) {
          handleSuccessModal(mutation.target);
        }
      });
    }).observe(document.body, {
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class', 'aria-hidden']
    });
  }

  installClickHook();
  scheduleConfirmHookInstall();
  watchSuccessModals();
})();
</script>
