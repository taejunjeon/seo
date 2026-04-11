# checkout_started 스니펫

작성 기준: 2026-04-11

목표는 GA4 설정을 바꾸는 것이 아니라, 아임웹 checkout 진입 시점의 식별자를 우리 Attribution ledger에 먼저 남기는 것이다.

수집 endpoint:

```text
POST https://att.ainativeos.net/api/attribution/checkout-context
```

이 endpoint는 SEO local Attribution ledger에 `checkout_started` row를 만든다. 운영 DB `tb_sales_toss`는 수정하지 않는다.

## 적용 위치

아임웹 관리자에서 biocom 공통 footer custom code 영역에 추가한다.

기존 `payment_success` 스니펫과 함께 있어야 한다. 이유는 `checkout_started`에서 만든 `checkoutId`를 sessionStorage에 저장하고, 결제완료 시점의 `payment_success` payload에도 같은 `checkoutId`를 보내야 두 row를 이어붙일 수 있기 때문이다.

## checkout_started footer code

```html
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

    return /shop_cart|shop_order|shop_payment|order_form|checkout|cart|payment/i.test(path + ' ' + href);
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

  var dedupeKey = CONFIG.dedupeKeyPrefix + checkoutId + ':' + location.pathname;
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
```

## 기존 payment_success 스니펫에 추가할 부분

`checkout_started`와 `payment_success`를 이어붙이려면 payment_success payload에도 같은 `checkoutId`가 들어가야 한다.

기존 payment_success 스니펫 안에 `imwebSession`, `lastTouch`를 읽은 뒤 아래를 추가한다.

```js
var checkoutContext = readJsonStorage(window.sessionStorage, '__seo_checkout_context');
var checkoutId = firstNonEmpty([
  trim(checkoutContext.checkoutId),
  trim(imwebSession.checkoutId),
  getSearchParam(['checkoutId', 'checkout_id'])
]);
```

그리고 `payload`에 아래 필드를 추가한다.

```js
checkoutId: checkoutId,
```

`payload.metadata`에는 아래 보조 필드를 추가한다.

```js
checkout_started_observed_at: trim(checkoutContext.clientObservedAt),
checkout_started_landing: trim(checkoutContext.landing),
checkout_started_snippet_version: trim(checkoutContext.snippetVersion)
```

## 검증 순서

1. 아임웹에 적용 전, 로컬 백엔드가 켜져 있으면 아래 endpoint가 존재하는지 확인한다.

```bash
curl -i http://localhost:7020/api/attribution/caller-coverage?source=biocom_imweb
```

2. 아임웹 footer에 checkout_started 스니펫을 추가한다.

3. 실제 사이트에서 주문서/장바구니/결제 시작 페이지에 들어간다.

4. 디버그가 필요하면 URL에 아래 query를 붙인다.

```text
?__seo_attribution_debug=1
```

5. 개발자도구 Console에서 `[seo-checkout-started] send ok`가 보이는지 확인한다.

6. 적용 후 24시간 내 아래 수치를 본다.

```bash
curl -s 'https://att.ainativeos.net/api/attribution/caller-coverage?source=biocom_imweb'
```

성공 기준:

- `checkout_started.total > 0`
- 최근 24시간 `checkout_started` all-three coverage 70% 이상
- `payment_success` row에 `checkoutId`가 들어오기 시작
- 이후 로컬 조인 리포트에서 `checkout_started -> payment_success` 일부 매칭 확인

## 주의사항

- 이 코드는 GA4 관리자 설정을 바꾸는 작업이 아니다.
- GA4 `begin_checkout` 이벤트까지 같이 보내면 보조적으로 좋지만, 현재 ROAS 정합성 필수 작업은 우리 Attribution ledger에 `checkout_started` row를 쌓는 것이다.
- 결제완료 URL에서는 `checkout_started`를 보내면 안 된다. 결제완료는 기존 `payment_success` 스니펫의 영역이다.
- 실제 아임웹 주문서 URL 패턴은 운영 사이트에서 한 번 확인해야 한다. 현재 코드는 `shop_cart`, `shop_order`, `shop_payment`, `order_form`, `checkout`, `cart`, `payment`를 후보로 본다.
- 개인정보 원문을 새로 늘리지 않는다. `customerKey`는 이미 session/local storage에 있는 운영 식별자가 있을 때만 보낸다.
