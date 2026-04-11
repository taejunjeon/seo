
<script>
// 사용자 ID 가져오기 함수 (경로 수정)
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

// 0-1) 로그인/회원 식별 후 가능한 이른 시점에 user_id 설정
waitForGtagAndSetUser();

// 0-2) UTM 파라미터를 첫 방문 시 쿠키/ls에 저장(구매 완료 페이지에서 필요)
(function persistUtm() {
  const userID = getUserID();

  // user_id가 있을 때만 로컬스토리지 처리
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
      return 'anonymous';
    } catch (error) {
      console.warn('Failed to get userID:', error);
      return 'anonymous';
    }
  }

  // URL에서 idx 값 추출
  function getIdxFromUrl() {
    const params = new URLSearchParams(location.search);
    const idx = params.get('idx');
    return idx || 'no_idx';
  }

  // gtag 함수가 로드될 때까지 대기
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

    // UTM 파라미터 처리
    const url = new URL(location.href);
    const utmNow = ['utm_campaign', 'utm_source', 'utm_medium', 'utm_content']
      .reduce((acc, k) => { const v = url.searchParams.get(k); if (v) acc[k] = v; return acc; }, {});
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
    endpoint: 'https://att.ainativeos.net/api/attribution/payment-success',
    source: 'biocom_imweb',
    measurementIds: ["G-WJFXN5E2Q1","G-8GZ48B1S59"],
    requestTimeoutMs: 800,
    debugQueryKey: '__seo_attribution_debug',
    dedupeKeyPrefix: '__seo_payment_success_sent__:'
  };

  if (location.href.indexOf('shop_payment_complete') < 0 && location.href.indexOf('shop_order_done') < 0) return;

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
