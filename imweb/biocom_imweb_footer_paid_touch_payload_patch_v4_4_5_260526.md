작성 시각: 2026-05-26 21:12 KST
기준일: 2026-05-26
문서 성격: 바이오컴 아임웹 푸터 코드 전체 교체안 — Meta paidTouchBeforeCheckout v4.4.5 fallback 보강 no-publish 초안

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - docurule.md
    - imweb/biocom_imweb_code_260526.md
    - project/meta-paid-touch-before-checkout-gtm-vs-imweb-review-20260526.md
  lane: Green
  allowed_actions:
    - local no-publish footer replacement draft
    - local fixture validation
    - no-send/no-write static audit
  forbidden_actions:
    - Imweb production save
    - GTM submit/create_version/publish
    - VM Cloud deploy or restart
    - VM Cloud SQLite write
    - operating DB write
    - external platform conversion send
  source_window_freshness_confidence:
    source: imweb/biocom_imweb_code_260526.md + local renderer patch
    window: current Imweb header/body/footer code snapshot as provided by TJ
    site: biocom
    freshness: 2026-05-26 21:12 KST local draft
    confidence: high for text patch, medium until Imweb preview/live smoke
```

## 10초 요약

이 문서는 TJ님이 아임웹 푸터에 그대로 붙여넣을 수 있도록 만든 **푸터 코드 전체 교체안**이다.

바뀐 부분은 푸터 Block 3의 결제완료 전송 payload다. GTM 저장 태그가 남긴 `paidTouchBeforeCheckout` 값을 우선 사용하고, 그 값이 없으면 `_p1s1a_last_touch`의 숫자 UTM을 A급 `paidTouchBeforeCheckout` snapshot으로 변환해 `metadata` 안에 같이 싣는다.

이 문서는 운영 반영 문서가 아니다. 아직 아임웹 저장, GTM publish, VM Cloud 배포, DB write는 0회다.

## 무엇이 바뀌는가

- 기존: 결제완료 row에는 UTM, click id, checkout context 중심 정보만 들어간다.
- 변경: 결제 전에 저장된 유료 유입 snapshot을 `metadata.paidTouchBeforeCheckout`로 같이 보낸다. GTM 전용 snapshot이 없어도 `_p1s1a_last_touch`의 숫자 `utm_campaign/utm_term/utm_content`로 A급 fallback snapshot을 만든다.
- 기대효과: 지금 TJ님이 확인한 `_p1s1a_last_touch`의 숫자 Meta campaign/adset/ad ID가 결제완료 row의 `metadata.paidTouchBeforeCheckout.grade=A`까지 이어진다.
- 주의: 이 코드만 붙인다고 모든 과거 미매핑이 복구되지는 않는다. 앞으로 들어오는 주문부터 결제완료 payload가 보강된다.

## 어디를 바꾸는가

아임웹 관리자에서 **푸터 코드 전체**를 아래 코드로 교체한다.

현재 문서 기준으로는 `<푸터 코드>` 아래 전체 스크립트 영역이다. 헤더 코드와 바디 코드는 이 문서에서 바꾸지 않는다.

## 승인 전 금지

- 이 문서의 코드를 아임웹 운영 화면에 저장하는 것은 운영 사용자에게 영향을 줄 수 있다. TJ님 명시 승인 전에는 저장하지 않는다.
- GTM Production publish도 하지 않는다.
- VM Cloud 배포/restart도 하지 않는다.

## 붙여넣기용 푸터 코드 전체

```html
<script>
/* ── Block 1: UTM persistence + Google click-id preservation v4.2 ──
   Purpose:
   - Preserve gclid / gbraid / wbraid captured by the Header Bootstrap.
   - Prevent _p1s1a_last_touch from overwriting Google click IDs with empty values.
   - No ad conversion firing.
   - No network send.
   Version: 2026-05-21-biocom-footer-block1-click-id-v4-2
*/
(function () {
  var CONFIG = {
    debugQueryKey: '__seo_attribution_debug',
    gtagRetryMs: 100,
    gtagMaxWaitMs: 5000,
    legacyUtmKey: '_p1s1a_session_touch',
    firstTouchKey: '_p1s1a_first_touch',
    latestTouchKey: '_p1s1a_last_touch',
    clickContextKey: '__biocom_click_id_context_v1',
    snippetVersion: '2026-05-21-biocom-footer-block1-click-id-v4-2',
    googleClickIdGuardVersion: 'v4.4.3'
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

  function googleClickSetFrom(source, sourceName) {
    source = source && typeof source === 'object' ? source : {};
    return {
      source: sourceName,
      gclid: trim(source.gclid),
      gbraid: trim(source.gbraid),
      wbraid: trim(source.wbraid)
    };
  }

  function hasGoogleClickSet(set) {
    return Boolean(set && (trim(set.gclid) || trim(set.gbraid) || trim(set.wbraid)));
  }

  function selectGoogleClickSet(candidates) {
    for (var i = 0; i < candidates.length; i += 1) {
      if (hasGoogleClickSet(candidates[i])) return candidates[i];
    }
    return googleClickSetFrom({}, 'none');
  }

  function isDebugMode() {
    try {
      return new URLSearchParams(location.search).get(CONFIG.debugQueryKey) === '1';
    } catch (error) {
      return false;
    }
  }

  function debugLog() {
    if (!isDebugMode()) return;
    try {
      console.log.apply(console, ['[seo-user-utm-v4]'].concat([].slice.call(arguments)));
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

  function getParam(name) {
    try {
      return trim(new URLSearchParams(location.search).get(name));
    } catch (error) {
      return '';
    }
  }

  function collectTrackingParams() {
    return {
      utm_campaign: getParam('utm_campaign'),
      utm_source: getParam('utm_source'),
      utm_medium: getParam('utm_medium'),
      utm_content: getParam('utm_content'),
      utm_term: getParam('utm_term'),

      gclid: getParam('gclid'),
      gbraid: getParam('gbraid'),
      wbraid: getParam('wbraid'),
      fbclid: getParam('fbclid'),
      ttclid: getParam('ttclid'),

      landing: location.href,
      referrer: document.referrer || '',
      ts: Date.now()
    };
  }

  function hasRealTrackingValue(tracking) {
    return Boolean(
      trim(tracking.utm_campaign) ||
      trim(tracking.utm_source) ||
      trim(tracking.utm_medium) ||
      trim(tracking.utm_content) ||
      trim(tracking.utm_term) ||
      trim(tracking.gclid) ||
      trim(tracking.gbraid) ||
      trim(tracking.wbraid) ||
      trim(tracking.fbclid) ||
      trim(tracking.ttclid)
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

  function mergeTouch(previous, incoming, options) {
    previous = previous && typeof previous === 'object' ? previous : {};
    incoming = incoming && typeof incoming === 'object' ? incoming : {};
    options = options || {};

    var preferIncomingUtm = options.preferIncomingUtm !== false;
    var preserveOriginalLanding = !!options.preserveOriginalLanding;
    var selectedGoogleClickSet = selectGoogleClickSet([
      googleClickSetFrom(incoming, 'incoming'),
      googleClickSetFrom(previous, 'previous')
    ]);

    return {
      utm_campaign: preferIncomingUtm
        ? firstNonEmpty([incoming.utm_campaign, previous.utm_campaign])
        : firstNonEmpty([previous.utm_campaign, incoming.utm_campaign]),

      utm_source: preferIncomingUtm
        ? firstNonEmpty([incoming.utm_source, previous.utm_source])
        : firstNonEmpty([previous.utm_source, incoming.utm_source]),

      utm_medium: preferIncomingUtm
        ? firstNonEmpty([incoming.utm_medium, previous.utm_medium])
        : firstNonEmpty([previous.utm_medium, incoming.utm_medium]),

      utm_content: preferIncomingUtm
        ? firstNonEmpty([incoming.utm_content, previous.utm_content])
        : firstNonEmpty([previous.utm_content, incoming.utm_content]),

      utm_term: preferIncomingUtm
        ? firstNonEmpty([incoming.utm_term, previous.utm_term])
        : firstNonEmpty([previous.utm_term, incoming.utm_term]),

      /*
        v4.4.3:
        Keep Google click IDs coherent. Do not mix gclid/gbraid/wbraid across sources.
      */
      gclid: selectedGoogleClickSet.gclid,
      gbraid: selectedGoogleClickSet.gbraid,
      wbraid: selectedGoogleClickSet.wbraid,
      google_click_id_source: selectedGoogleClickSet.source,
      google_click_id_guard_version: CONFIG.googleClickIdGuardVersion,

      fbclid: firstNonEmpty([incoming.fbclid, previous.fbclid]),
      ttclid: firstNonEmpty([incoming.ttclid, previous.ttclid]),

      fbc: firstNonEmpty([incoming.fbc, previous.fbc]),
      fbp: firstNonEmpty([incoming.fbp, previous.fbp]),

      landing: preserveOriginalLanding
        ? firstNonEmpty([previous.landing, incoming.landing, location.href])
        : firstNonEmpty([incoming.landing, previous.landing, location.href]),

      referrer: preserveOriginalLanding
        ? firstNonEmpty([previous.referrer, incoming.referrer, document.referrer || ''])
        : firstNonEmpty([incoming.referrer, previous.referrer, document.referrer || '']),

      user_id: firstNonEmpty([incoming.user_id, previous.user_id]),
      user_id_updated_at: incoming.user_id_updated_at || previous.user_id_updated_at || '',

      ts: incoming.ts || previous.ts || Date.now(),
      persisted_at: incoming.persisted_at || previous.persisted_at || new Date().toISOString(),

      click_context_version: firstNonEmpty([incoming.click_context_version, previous.click_context_version]),
      snippet_version: CONFIG.snippetVersion
    };
  }

  function enrichWithClickContext(tracking) {
    var clickContext = readJson(CONFIG.clickContextKey);

    /*
      previous = clickContext
      incoming = tracking

      결과:
      - URL에 새 gclid/gbraid/wbraid가 있으면 새 값 사용
      - URL에 없으면 Header Bootstrap이 저장한 값 사용
    */
    return mergeTouch(clickContext, tracking, {
      preferIncomingUtm: true,
      preserveOriginalLanding: false
    });
  }

  function persistUtm() {
    var userId = getUserID();
    var tracking = collectTrackingParams();

    tracking.user_id = userId || '';
    tracking.user_id_updated_at = userId ? Date.now() : '';
    tracking.persisted_at = new Date().toISOString();
    tracking.click_context_version = trim(readJson(CONFIG.clickContextKey).snippet_version);

    attachUserIdToExistingTouches(userId);

    var enriched = enrichWithClickContext(tracking);

    if (!hasRealTrackingValue(enriched)) {
      debugLog('skip persist: no tracking params');
      return;
    }

    var previousFirst = readJson(CONFIG.firstTouchKey);
    var previousLatest = readJson(CONFIG.latestTouchKey);
    var previousSession = readJson(CONFIG.legacyUtmKey);

    /*
      first_touch:
      - 첫 유입의 UTM 정체성은 유지
      - 단, 기존 first_touch에 click id가 비어 있고 현재 click id가 있으면 보강
    */
    if (!Object.keys(previousFirst).length) {
      writeJson(CONFIG.firstTouchKey, mergeTouch({}, enriched, {
        preferIncomingUtm: true,
        preserveOriginalLanding: true
      }));
    } else {
      writeJson(CONFIG.firstTouchKey, mergeTouch(previousFirst, enriched, {
        preferIncomingUtm: false,
        preserveOriginalLanding: true
      }));
    }

    /*
      last_touch:
      - 최신 UTM은 반영
      - click id는 빈 값으로 지우지 않음
    */
    writeJson(CONFIG.latestTouchKey, mergeTouch(previousLatest, enriched, {
      preferIncomingUtm: true,
      preserveOriginalLanding: false
    }));

    /*
      session_touch:
      - 현재 세션용
      - click id는 빈 값으로 지우지 않음
    */
    writeJson(CONFIG.legacyUtmKey, mergeTouch(previousSession, enriched, {
      preferIncomingUtm: true,
      preserveOriginalLanding: false
    }));

    debugLog('tracking persisted', {
      has_gclid: Boolean(enriched.gclid),
      has_gbraid: Boolean(enriched.gbraid),
      has_wbraid: Boolean(enriched.wbraid),
      has_fbclid: Boolean(enriched.fbclid),
      has_ttclid: Boolean(enriched.ttclid),
      utm_source: enriched.utm_source,
      utm_medium: enriched.utm_medium
    });
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

      /*
        raw user_id는 console에 찍지 않는다.
      */
      debugLog('gtag user_id set', { has_user_id: true });
    });
  }

  persistUtm();
  setGtagUserId();
})();


/* ── Block 2: checkout_started 이벤트 + Google click-id checkout context v4.3 ──
   Purpose:
   - Preserve gclid / gbraid / wbraid from Header Bootstrap + Footer Block 1.
   - Store click IDs into __seo_checkout_context before NPay/payment redirect.
   - Keep server payload backward-compatible: do NOT add top-level gbraid/wbraid yet.
   - No Google Ads conversion upload.
   - No new ad conversion firing.
   Version: 2026-05-21-biocom-checkout-started-click-id-v4-3
*/
(function () {
  var CONFIG = {
    endpoint: 'https://att.ainativeos.net/api/attribution/checkout-context',
    source: 'biocom_imweb',
    measurementIds: ['G-WJFXN5E2Q1'],
    snippetVersion: '2026-05-21-biocom-checkout-started-click-id-v4-3',
    googleClickIdGuardVersion: 'v4.4.3',
    requestTimeoutMs: 800,
    debugQueryKey: '__seo_attribution_debug',
    checkoutIdKey: '__seo_checkout_id',
    checkoutContextKey: '__seo_checkout_context',
    clickContextKey: '__biocom_click_id_context_v1',
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
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
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
    try {
      var pattern = new RegExp('(?:^|; )' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '=([^;]*)');
      var match = document.cookie.match(pattern);
      return match ? decodeURIComponent(match[1]) : '';
    } catch (error) {
      return '';
    }
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
    try {
      var params = new URLSearchParams(location.search);

      for (var i = 0; i < keys.length; i += 1) {
        var value = trim(params.get(keys[i]));
        if (value) return value;
      }

      return '';
    } catch (error) {
      return '';
    }
  }

  function googleClickSetFrom(source, sourceName) {
    source = source && typeof source === 'object' ? source : {};
    return {
      source: sourceName,
      gclid: trim(source.gclid),
      gbraid: trim(source.gbraid),
      wbraid: trim(source.wbraid)
    };
  }

  function googleClickSetFromUrl(urlLike, sourceName) {
    try {
      if (!urlLike) return googleClickSetFrom({}, sourceName);
      var params = new URL(urlLike, location.origin).searchParams;
      return googleClickSetFrom({
        gclid: params.get('gclid'),
        gbraid: params.get('gbraid'),
        wbraid: params.get('wbraid')
      }, sourceName);
    } catch (error) {
      return googleClickSetFrom({}, sourceName);
    }
  }

  function hasGoogleClickSet(set) {
    return Boolean(set && (trim(set.gclid) || trim(set.gbraid) || trim(set.wbraid)));
  }

  function selectGoogleClickSet(candidates) {
    for (var i = 0; i < candidates.length; i += 1) {
      if (hasGoogleClickSet(candidates[i])) return candidates[i];
    }
    return googleClickSetFrom({}, 'none');
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

        /*
          v4.4.3:
          Google click IDs are selected atomically outside this generic landing merge.
        */
        gclid: base.gclid,
        gbraid: base.gbraid,
        wbraid: base.wbraid,

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
    try {
      return new URLSearchParams(location.search).get(CONFIG.debugQueryKey) === '1';
    } catch (error) {
      return false;
    }
  }

  function debugLog() {
    if (!isDebugMode()) return;

    try {
      console.log.apply(console, ['[seo-checkout-started-v4.3]'].concat([].slice.call(arguments)));
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

      return {
        sentBy: 'fetch',
        accepted: true,
        status: response.status
      };
    });
  }

  function getGoogleClickIdType(tracking) {
    if (trim(tracking.gclid)) return 'gclid';
    if (trim(tracking.gbraid)) return 'gbraid';
    if (trim(tracking.wbraid)) return 'wbraid';
    return 'none';
  }

  function hasGoogleClickId(tracking) {
    return Boolean(trim(tracking.gclid) || trim(tracking.gbraid) || trim(tracking.wbraid));
  }

  if (!isCheckoutCandidate()) return;

  var imwebSession = readJsonStorage(window.sessionStorage, '__bs_imweb_session');
  var lastTouch = readJsonStorage(window.localStorage, '_p1s1a_last_touch');
  var clickContext = readJsonStorage(window.localStorage, CONFIG.clickContextKey);

  var checkoutId = getOrCreateCheckoutId();
  var landing = location.href;

  var initialReferrer = firstNonEmpty([
    trim(imwebSession.initialReferrer),
    trim(lastTouch.referrer),
    document.referrer || ''
  ]);

  var selectedGoogleClickSet = selectGoogleClickSet([
    googleClickSetFromUrl(location.href, 'current_url'),
    googleClickSetFromUrl(document.referrer, 'document_referrer'),
    googleClickSetFrom(clickContext, 'header_click_context'),
    googleClickSetFrom(lastTouch, 'last_touch'),
    googleClickSetFrom({
      gclid: imwebSession.gclid,
      gbraid: imwebSession.gbraid,
      wbraid: imwebSession.wbraid
    }, 'imweb_session')
  ]);

  var tracking = mergeLandingParams({
    utm_source: firstNonEmpty([
      trim(imwebSession.utmSource),
      trim(lastTouch.utm_source),
      trim(clickContext.utm_source),
      getSearchParam(['utm_source'])
    ]),
    utm_medium: firstNonEmpty([
      trim(imwebSession.utmMedium),
      trim(lastTouch.utm_medium),
      trim(clickContext.utm_medium),
      getSearchParam(['utm_medium'])
    ]),
    utm_campaign: firstNonEmpty([
      trim(imwebSession.utmCampaign),
      trim(lastTouch.utm_campaign),
      trim(clickContext.utm_campaign),
      getSearchParam(['utm_campaign'])
    ]),
    utm_content: firstNonEmpty([
      trim(imwebSession.utmContent),
      trim(lastTouch.utm_content),
      trim(clickContext.utm_content),
      getSearchParam(['utm_content'])
    ]),
    utm_term: firstNonEmpty([
      trim(imwebSession.utmTerm),
      trim(lastTouch.utm_term),
      trim(clickContext.utm_term),
      getSearchParam(['utm_term'])
    ]),

    /*
      v4.4.3:
      Google click IDs are selected as one coherent set.
      Fresh gclid/gbraid must not inherit stale wbraid from older storage.
    */
    gclid: selectedGoogleClickSet.gclid,
    gbraid: selectedGoogleClickSet.gbraid,
    wbraid: selectedGoogleClickSet.wbraid,

    fbclid: firstNonEmpty([
      getSearchParam(['fbclid']),
      trim(clickContext.fbclid),
      trim(lastTouch.fbclid),
      trim(imwebSession.fbclid)
    ]),
    ttclid: firstNonEmpty([
      getSearchParam(['ttclid']),
      trim(clickContext.ttclid),
      trim(lastTouch.ttclid),
      trim(imwebSession.ttclid)
    ]),

    fbc: firstNonEmpty([
      trim(lastTouch.fbc),
      readCookie('_fbc'),
      getSearchParam(['fbc'])
    ]),
    fbp: firstNonEmpty([
      trim(lastTouch.fbp),
      readCookie('_fbp'),
      getSearchParam(['fbp'])
    ])
  }, landing);

  var dedupeKey = CONFIG.dedupeKeyPrefix + checkoutId;

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
    var googleClickIdType = getGoogleClickIdType(tracking);
    var googleClickIdPresent = hasGoogleClickId(tracking);

    /*
      Server payload stays backward-compatible.
      - Top-level gclid already existed.
      - Do NOT add top-level gbraid/wbraid until backend contract is confirmed.
      - Presence-only metadata is safe and does not expose raw gbraid/wbraid.
    */
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
        user_pseudo_id_strategy: userPseudoId && userPseudoId === clientId ? 'client_id_fallback' : 'explicit_value',

        /*
          Presence only. Raw gbraid/wbraid stays in sessionStorage until backend contract is checked.
        */
        google_click_id_present: googleClickIdPresent,
        google_click_id_type: googleClickIdType,
        google_click_id_source: selectedGoogleClickSet.source,
        google_click_id_guard_version: CONFIG.googleClickIdGuardVersion,
        has_gclid: Boolean(trim(tracking.gclid)),
        has_gbraid: Boolean(trim(tracking.gbraid)),
        has_wbraid: Boolean(trim(tracking.wbraid)),
        click_context_version: trim(clickContext.snippet_version),
        checkout_context_version: CONFIG.snippetVersion
      }
    };

    /*
      This is the main goal of Block 2 v4.2:
      store click IDs in sessionStorage before payment/NPay redirect.
    */
    writeJsonStorage(window.sessionStorage, CONFIG.checkoutContextKey, {
      checkoutId: checkoutId,
      clientObservedAt: observedAt,
      landing: landing,
      referrer: payload.referrer,
      gaSessionId: gaSessionId,
      clientId: clientId,
      userPseudoId: userPseudoId,
      customerKey: customerKey,

      gclid: tracking.gclid,
      gbraid: tracking.gbraid,
      wbraid: tracking.wbraid,
      fbclid: tracking.fbclid,
      ttclid: tracking.ttclid,

      hasGoogleClickId: googleClickIdPresent,
      googleClickIdType: googleClickIdType,
      googleClickIdSource: selectedGoogleClickSet.source,
      googleClickIdGuardVersion: CONFIG.googleClickIdGuardVersion,
      clickContextVersion: trim(clickContext.snippet_version),
      snippetVersion: CONFIG.snippetVersion
    });

    if (hasSentMarker(dedupeKey)) {
      debugLog('skip duplicate after context refresh', {
        checkoutId: checkoutId,
        has_google_click_id: googleClickIdPresent,
        google_click_id_type: googleClickIdType
      });
      return;
    }

    debugLog('send payload presence', {
      checkoutId: checkoutId,
      has_google_click_id: googleClickIdPresent,
      google_click_id_type: googleClickIdType,
      google_click_id_source: selectedGoogleClickSet.source,
      has_gclid: Boolean(trim(tracking.gclid)),
      has_gbraid: Boolean(trim(tracking.gbraid)),
      has_wbraid: Boolean(trim(tracking.wbraid)),
      has_fbclid: Boolean(trim(tracking.fbclid)),
      has_ttclid: Boolean(trim(tracking.ttclid))
    });

    return sendPayload(payload).then(function (result) {
      rememberSent(dedupeKey);
      debugLog('send ok', result);
      return result;
    }).catch(function (error) {
      debugLog('send failed', error && error.message ? error.message : error);
    });
  });
})();


/* ── Block 3: payment_page_seen / payment_success split v4.4.5 ──
   Purpose:
   - /shop_payment/ is NOT purchase complete. Send it as payment_page_seen only.
   - Only explicit completion URLs send payment_success.
   - Reduce NPay click false positives:
     - npay_button_seen can be broad.
     - npay_button_clicked requires a strong actionable NPay element.
   - Preserve click IDs and diagnostic fields.
   - Do not fire Meta Purchase directly.
   - Do not enable server CAPI mirror.
   Version: 2026-05-26-biocom-payment-split-v4-4-5
*/
(function () {
  'use strict';

  var CONFIG = {
    source: 'biocom_imweb',
    site: 'biocom',

    /*
      Fast-compatible endpoint:
      Current backend stores checkout-context as checkout_started.
      Therefore we preserve semantic meaning in metadata.semantic_touchpoint.
      Formal backend patch should add /api/attribution/payment-page-seen later.
    */
    paymentPageEndpoint: 'https://att.ainativeos.net/api/attribution/checkout-context',
    paymentSuccessEndpoint: 'https://att.ainativeos.net/api/attribution/payment-success',

    measurementIds: ['G-WJFXN5E2Q1'],

    snippetVersion: '2026-05-26-biocom-payment-split-v4-4-5',
    pageSeenVersion: '2026-05-21-biocom-payment-page-seen-v4-4-3',
    paymentSuccessVersion: '2026-05-26-biocom-payment-success-v4-4-5',
    googleClickIdGuardVersion: 'v4.4.3',

    requestTimeoutMs: 1000,
    debugQueryKey: '__seo_attribution_debug',

    checkoutIdKey: '__seo_checkout_id',
    checkoutContextKey: '__seo_checkout_context',
    clickContextKey: '__biocom_click_id_context_v1',
    paymentPageBehaviorKey: '__seo_payment_page_behavior_v1',
    paymentSuccessContextKey: '__seo_payment_success_context',
    paidTouchBeforeCheckoutKey: 'biocom_paid_touch_before_checkout_v1',

    /*
      Use v4.4.2-specific dedupe keys so the first v4.4.2 smoke can be sent
      even if v4.4.1 already marked the same checkoutId.
    */
    paymentPageSeenDedupePrefix: '__seo_payment_page_seen_sent_v4_4_2__:',
    paymentPageExitDedupePrefix: '__seo_payment_page_seen_exit_sent_v4_4_2__:',
    paymentSuccessDedupePrefix: '__seo_payment_success_sent_v4_4_2__:',

    /*
      Keep false for safety.
      If Imweb completion page also stays under /shop_payment/,
      we need a separate DOM-confirmed patch after testing.
    */
    allowShopPaymentDomCompletionSignal: false
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
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
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

  function isPlainObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value);
  }

  function compactStringArray(value) {
    if (!Array.isArray(value)) return [];
    var out = [];
    for (var i = 0; i < value.length && out.length < 20; i += 1) {
      var item = trim(value[i]);
      if (item) out.push(item);
    }
    return out;
  }

  function hasPaidTouchSignal(value) {
    if (!isPlainObject(value)) return false;
    return Boolean(
      trim(value.grade) ||
      trim(value.campaign) ||
      trim(value.term) ||
      trim(value.content) ||
      trim(value.metaCampaignId) ||
      trim(value.metaAdsetId) ||
      trim(value.metaAdId) ||
      trim(value.campaignAlias) ||
      trim(value.landing) ||
      trim(value.clickIdType)
    );
  }

  function numericMetaId(value) {
    var normalized = trim(value);
    return /^\d{8,}$/.test(normalized) ? normalized : '';
  }

  function safePathFromUrl(urlLike) {
    try {
      if (!urlLike) return '';
      return new URL(urlLike, location.origin).pathname || '';
    } catch (error) {
      return '';
    }
  }

  function buildPaidTouchFromFlatTouch(value, sourceName) {
    if (!isPlainObject(value)) return {};
    var metaCampaignId = numericMetaId(firstNonEmpty([value.metaCampaignId, value.meta_campaign_id, value.utm_campaign, value.utm_id]));
    var metaAdsetId = numericMetaId(firstNonEmpty([value.metaAdsetId, value.meta_adset_id, value.utm_term]));
    var metaAdId = numericMetaId(firstNonEmpty([value.metaAdId, value.meta_ad_id, value.utm_content]));
    if (!metaCampaignId || (!metaAdsetId && !metaAdId)) return {};
    var evidence = ['flat_touch_numeric_meta_fallback', 'numeric_utm_campaign'];
    if (metaAdsetId) evidence.push('numeric_utm_term');
    if (metaAdId) evidence.push('numeric_utm_content');
    if (trim(value.utm_source)) evidence.push('utm_source_' + trim(value.utm_source).toLowerCase());
    if (trim(value.utm_medium)) evidence.push('utm_medium_' + trim(value.utm_medium).toLowerCase());
    return {
      schemaVersion: '2026-05-26.paid-touch-before-checkout.v1.flat-touch-fallback',
      capturedAt: firstNonEmpty([value.persisted_at, value.last_captured_at, value.capturedAt, value.captured_at, new Date().toISOString()]),
      source: trim(value.utm_source),
      medium: trim(value.utm_medium),
      campaign: trim(value.utm_campaign),
      term: trim(value.utm_term),
      content: trim(value.utm_content),
      metaCampaignId: metaCampaignId,
      metaAdsetId: metaAdsetId,
      metaAdId: metaAdId,
      campaignAlias: firstNonEmpty([value.campaignAlias, value.campaign_alias]),
      metaSiteSource: firstNonEmpty([value.metaSiteSource, value.meta_site_source]),
      metaPlacement: firstNonEmpty([value.metaPlacement, value.meta_placement]),
      landing: trim(value.landing),
      landingPath: safePathFromUrl(value.landing),
      referrer: trim(value.referrer),
      referrerHost: '',
      clickIdType: trim(value.fbclid) ? 'fbclid' : '',
      grade: 'A',
      confidence: metaAdsetId && metaAdId ? 0.96 : 0.9,
      evidence: evidence,
      storageSource: sourceName,
      readAt: new Date().toISOString()
    };
  }

  function sanitizePaidTouchBeforeCheckout(value, sourceName) {
    if (!hasPaidTouchSignal(value)) return {};
    var confidence = Number(value.confidence || 0);
    return {
      schemaVersion: trim(value.schemaVersion),
      capturedAt: trim(value.capturedAt),
      source: trim(value.source),
      medium: trim(value.medium),
      campaign: trim(value.campaign),
      term: trim(value.term),
      content: trim(value.content),
      metaCampaignId: trim(value.metaCampaignId),
      metaAdsetId: trim(value.metaAdsetId),
      metaAdId: trim(value.metaAdId),
      campaignAlias: trim(value.campaignAlias),
      metaSiteSource: trim(value.metaSiteSource),
      metaPlacement: trim(value.metaPlacement),
      landing: trim(value.landing),
      landingPath: trim(value.landingPath),
      referrer: trim(value.referrer),
      referrerHost: trim(value.referrerHost),
      clickIdType: trim(value.clickIdType),
      grade: trim(value.grade),
      confidence: isFinite(confidence) ? confidence : 0,
      evidence: compactStringArray(value.evidence),
      storageSource: sourceName,
      readAt: new Date().toISOString()
    };
  }

  function readPaidTouchBeforeCheckout(lastTouch, checkoutContext) {
    var candidates = [
      { source: 'localStorage.biocom_paid_touch_before_checkout_v1', value: readJsonStorage(window.localStorage, CONFIG.paidTouchBeforeCheckoutKey) },
      { source: 'sessionStorage.biocom_paid_touch_before_checkout_v1', value: readJsonStorage(window.sessionStorage, CONFIG.paidTouchBeforeCheckoutKey) },
      { source: 'localStorage._p1s1a_last_touch.paidTouchBeforeCheckout', value: lastTouch && lastTouch.paidTouchBeforeCheckout },
      { source: 'sessionStorage.__seo_checkout_context.paidTouchBeforeCheckout', value: checkoutContext && checkoutContext.paidTouchBeforeCheckout },
      { source: 'localStorage._p1s1a_last_touch.flat_numeric_utm', value: buildPaidTouchFromFlatTouch(lastTouch, 'localStorage._p1s1a_last_touch.flat_numeric_utm') },
      { source: 'sessionStorage.__seo_checkout_context.flat_numeric_utm', value: buildPaidTouchFromFlatTouch(checkoutContext, 'sessionStorage.__seo_checkout_context.flat_numeric_utm') }
    ];
    for (var i = 0; i < candidates.length; i += 1) {
      var snapshot = sanitizePaidTouchBeforeCheckout(candidates[i].value, candidates[i].source);
      if (hasPaidTouchSignal(snapshot)) return snapshot;
    }
    return {};
  }

  function writeJsonStorage(storage, key, value) {
    try {
      if (!storage) return false;
      storage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      return false;
    }
  }

  function readCookie(name) {
    try {
      var pattern = new RegExp('(?:^|; )' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '=([^;]*)');
      var match = document.cookie.match(pattern);
      return match ? decodeURIComponent(match[1]) : '';
    } catch (error) {
      return '';
    }
  }

  function getSearchParam(keys) {
    try {
      var params = new URLSearchParams(location.search);
      for (var i = 0; i < keys.length; i += 1) {
        var value = trim(params.get(keys[i]));
        if (value) return value;
      }
      return '';
    } catch (error) {
      return '';
    }
  }

  function googleClickSetFrom(source, sourceName) {
    source = source && typeof source === 'object' ? source : {};
    return {
      source: sourceName,
      gclid: trim(source.gclid),
      gbraid: trim(source.gbraid),
      wbraid: trim(source.wbraid)
    };
  }

  function googleClickSetFromUrl(urlLike, sourceName) {
    try {
      if (!urlLike) return googleClickSetFrom({}, sourceName);
      var params = new URL(urlLike, location.origin).searchParams;
      return googleClickSetFrom({
        gclid: params.get('gclid'),
        gbraid: params.get('gbraid'),
        wbraid: params.get('wbraid')
      }, sourceName);
    } catch (error) {
      return googleClickSetFrom({}, sourceName);
    }
  }

  function hasGoogleClickSet(set) {
    return Boolean(set && (trim(set.gclid) || trim(set.gbraid) || trim(set.wbraid)));
  }

  function selectGoogleClickSet(candidates) {
    for (var i = 0; i < candidates.length; i += 1) {
      if (hasGoogleClickSet(candidates[i])) return candidates[i];
    }
    return googleClickSetFrom({}, 'none');
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

  function isDebugMode() {
    try {
      return new URLSearchParams(location.search).get(CONFIG.debugQueryKey) === '1';
    } catch (error) {
      return false;
    }
  }

  function debugLog() {
    if (!isDebugMode()) return;
    try {
      console.log.apply(console, ['[seo-payment-split-v4.4.3]'].concat([].slice.call(arguments)));
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

  function nowIso() {
    try {
      return new Date().toISOString();
    } catch (error) {
      return '';
    }
  }

  function parseNumber(value) {
    var normalized = trim(value).replace(/[^\d.-]/g, '');
    if (!normalized) return 0;
    var parsed = Number(normalized);
    return isFinite(parsed) ? parsed : 0;
  }

  function classifyRoute() {
    var href = String(location.href || '');
    var path = String(location.pathname || '');

    var isKnownSuccess =
      /shop_payment_complete|shop_order_done|order_complete|payment_complete|payment_success/i.test(href);

    var isShopPayment =
      /\/shop_payment\/?/i.test(path) &&
      !isKnownSuccess;

    var domSuccess = false;
    if (CONFIG.allowShopPaymentDomCompletionSignal && isShopPayment) {
      domSuccess = hasStrongCompletionDomSignal();
    }

    if (isKnownSuccess || domSuccess) return 'payment_success';
    if (isShopPayment) return 'payment_page_seen';
    return 'none';
  }

  function hasStrongCompletionDomSignal() {
    try {
      var text = trim(document.body && document.body.innerText);
      if (!text) return false;

      var hasCompletion =
        /주문\s*완료|주문이\s*완료|결제\s*완료|주문\s*내역|입금\s*계좌|가상\s*계좌|무통장\s*입금/i.test(text);

      var hasCheckoutForm =
        /결제\s*수단|결제하기|주문자\s*정보|주문\s*상품\s*정보|바로구매|배송지/i.test(text);

      return hasCompletion && !hasCheckoutForm;
    } catch (error) {
      return false;
    }
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

        /*
          v4.4.3:
          Google click IDs are selected atomically in buildCommonContext.
        */
        gclid: base.gclid,
        gbraid: base.gbraid,
        wbraid: base.wbraid,

        fbclid: firstNonEmpty([base.fbclid, params.get('fbclid')]),
        ttclid: firstNonEmpty([base.ttclid, params.get('ttclid')]),

        fbc: firstNonEmpty([base.fbc, params.get('fbc')]),
        fbp: firstNonEmpty([base.fbp, params.get('fbp')])
      };
    } catch (error) {
      return base;
    }
  }

  function getGoogleClickIdType(tracking) {
    if (trim(tracking.gclid)) return 'gclid';
    if (trim(tracking.gbraid)) return 'gbraid';
    if (trim(tracking.wbraid)) return 'wbraid';
    return 'none';
  }

  function hasGoogleClickId(tracking) {
    return Boolean(trim(tracking.gclid) || trim(tracking.gbraid) || trim(tracking.wbraid));
  }

  function getPaymentIdentifiers() {
    return {
      orderCode: firstNonEmpty([
        getSearchParam(['order_code', 'orderCode']),
        readDataLayerValue(['order_code', 'orderCode'])
      ]),
      orderNo: firstNonEmpty([
        getSearchParam(['order_no', 'orderNo']),
        readDataLayerValue(['order_no', 'orderNo'])
      ]),
      orderMember: firstNonEmpty([
        getSearchParam(['order_member', 'orderMember']),
        readDataLayerValue(['order_member', 'orderMember'])
      ]),
      paymentKey: firstNonEmpty([
        getSearchParam(['payment_key', 'paymentKey', 'imp_uid']),
        readDataLayerValue(['payment_key', 'paymentKey', 'imp_uid'])
      ]),
      transactionId: firstNonEmpty([
        getSearchParam(['transaction_id', 'transactionId', 'order_code', 'orderCode']),
        readDataLayerValue(['transaction_id', 'transactionId', 'order_code', 'orderCode'])
      ])
    };
  }

  function getPaymentValue() {
    var fromQuery = firstNonEmpty([
      getSearchParam(['value', 'amount', 'price', 'total_price', 'totalAmount']),
      readDataLayerValue(['value', 'amount', 'price', 'total_price', 'totalAmount'])
    ]);

    return parseNumber(fromQuery);
  }

  function sendPayload(endpoint, payload) {
    return fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
      credentials: 'omit',
      mode: 'cors'
    }).then(function (response) {
      if (!response.ok) {
        throw new Error('attribution send failed with ' + response.status);
      }

      return {
        sentBy: 'fetch',
        accepted: true,
        status: response.status
      };
    });
  }

  function getScrollPercent() {
    try {
      var doc = document.documentElement || document.body;
      var body = document.body || {};
      var scrollTop = window.pageYOffset || doc.scrollTop || body.scrollTop || 0;
      var scrollHeight = Math.max(
        doc.scrollHeight || 0,
        body.scrollHeight || 0,
        doc.offsetHeight || 0,
        body.offsetHeight || 0
      );
      var viewportHeight = window.innerHeight || doc.clientHeight || 0;
      var maxScroll = Math.max(scrollHeight - viewportHeight, 1);
      return Math.round(Math.min(100, Math.max(0, (scrollTop / maxScroll) * 100)));
    } catch (error) {
      return 0;
    }
  }

  function classifyPaymentText(text) {
    var normalized = trim(text).toLowerCase();
    if (!normalized) return '';

    if (/네이버페이|naverpay|npay|naver pay|naver/.test(normalized)) return 'npay';
    if (/신용카드|카드|credit|card/.test(normalized)) return 'card';
    if (/가상계좌|virtual/.test(normalized)) return 'virtual_account';
    if (/무통장|계좌이체|bank/.test(normalized)) return 'bank_transfer';
    if (/카카오|kakao/.test(normalized)) return 'kakao';
    if (/토스|toss/.test(normalized)) return 'toss';
    if (/휴대폰|phone|mobile/.test(normalized)) return 'mobile';
    return '';
  }

  function getTextNearElement(element) {
    try {
      if (!element) return '';

      var pieces = [];

      if (element.id) {
        var label = document.querySelector('label[for="' + element.id.replace(/"/g, '\\"') + '"]');
        if (label) pieces.push(label.innerText || label.textContent || '');
      }

      var cursor = element;
      var depth = 0;
      while (cursor && depth < 4) {
        pieces.push(cursor.innerText || cursor.textContent || '');
        cursor = cursor.parentElement;
        depth += 1;
      }

      return pieces.join(' ');
    } catch (error) {
      return '';
    }
  }

  function detectSelectedPaymentMethod() {
    try {
      var checked = document.querySelectorAll('input[type="radio"]:checked, input[type="checkbox"]:checked, select');

      for (var i = 0; i < checked.length; i += 1) {
        var el = checked[i];
        var text = '';

        if (el.tagName && el.tagName.toLowerCase() === 'select') {
          var opt = el.options && el.selectedIndex >= 0 ? el.options[el.selectedIndex] : null;
          text = opt ? (opt.innerText || opt.textContent || opt.value || '') : '';
        } else {
          text = getTextNearElement(el);
        }

        var method = classifyPaymentText(text);
        if (method) return method;
      }

      return '';
    } catch (error) {
      return '';
    }
  }

  function elementOwnSignalText(element) {
    try {
      if (!element) return '';

      var pieces = [];
      var attrs = [
        'id',
        'class',
        'href',
        'src',
        'alt',
        'title',
        'aria-label',
        'name',
        'value',
        'role',
        'type',
        'onclick',
        'data-type',
        'data-name',
        'data-code',
        'data-pay',
        'data-payment',
        'data-provider',
        'data-module',
        'data-button-type'
      ];

      for (var i = 0; i < attrs.length; i += 1) {
        var name = attrs[i];
        var value = '';

        if (name === 'class') {
          value = typeof element.className === 'string' ? element.className : '';
        } else {
          value = element.getAttribute ? element.getAttribute(name) : '';
        }

        if (value) pieces.push(value);
      }

      /*
        Inner text is allowed only for the actionable node itself.
        We do NOT pull broad parent text here because that caused false positives.
      */
      var tag = String(element.tagName || '').toLowerCase();
      if (tag === 'a' || tag === 'button' || tag === 'input' || tag === 'iframe' || tag === 'area') {
        pieces.push(element.innerText || element.textContent || '');
      }

      return pieces.join(' ');
    } catch (error) {
      return '';
    }
  }

  function hasNpayKeyword(text) {
    return /네이버페이|naver\s*pay|naverpay|npay|n_pay|np_btn|npay_btn|naver_checkout/i.test(String(text || ''));
  }

  function findActionableAncestor(element) {
    try {
      var cursor = element;
      var depth = 0;

      while (cursor && depth < 7) {
        var tag = String(cursor.tagName || '').toLowerCase();
        var role = trim(cursor.getAttribute && cursor.getAttribute('role'));
        var hasOnclick = Boolean(cursor.getAttribute && cursor.getAttribute('onclick'));

        if (
          tag === 'a' ||
          tag === 'button' ||
          tag === 'input' ||
          tag === 'area' ||
          tag === 'iframe' ||
          role === 'button' ||
          role === 'link' ||
          hasOnclick
        ) {
          return cursor;
        }

        cursor = cursor.parentElement;
        depth += 1;
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  function isStrongNpayClickElement(element) {
    try {
      var action = findActionableAncestor(element);
      if (!action) return false;

      var signal = [
        elementOwnSignalText(action),
        elementOwnSignalText(element)
      ].join(' ');

      return hasNpayKeyword(signal);
    } catch (error) {
      return false;
    }
  }

  function isNpaySeenElement(element) {
    try {
      if (!element) return false;

      var signal = [
        elementOwnSignalText(element),
        element.innerText || '',
        element.textContent || ''
      ].join(' ');

      return hasNpayKeyword(signal);
    } catch (error) {
      return false;
    }
  }

  function detectNpaySeen() {
    try {
      var text = trim(document.body && document.body.innerText);
      if (hasNpayKeyword(text)) return true;

      var candidates = document.querySelectorAll('a, button, input, img, iframe, area');
      for (var i = 0; i < candidates.length; i += 1) {
        if (isNpaySeenElement(candidates[i])) return true;
      }

      return false;
    } catch (error) {
      return false;
    }
  }

  function loadBehavior() {
    var state = readJsonStorage(window.sessionStorage, CONFIG.paymentPageBehaviorKey);
    if (!state || typeof state !== 'object') state = {};

    /*
      Reset behavior when moving from v4.4.1 to v4.4.2.
      This clears the old false-positive npay_button_clicked=true state.
    */
    if (trim(state.behavior_version) !== CONFIG.snippetVersion) {
      state = {
        previous_behavior_version: trim(state.behavior_version)
      };
    }

    var now = Date.now();

    if (!state.page_entered_at_ms) {
      state.page_entered_at_ms = now;
      state.page_entered_at = nowIso();
    }

    if (typeof state.max_scroll_percent !== 'number') {
      state.max_scroll_percent = getScrollPercent();
    }

    if (!state.npay_button_seen) {
      state.npay_button_seen = detectNpaySeen();
    }

    if (typeof state.npay_button_clicked !== 'boolean') {
      state.npay_button_clicked = false;
    }

    if (!state.selected_payment_method) {
      state.selected_payment_method = detectSelectedPaymentMethod();
    }

    state.behavior_version = CONFIG.snippetVersion;

    return state;
  }

  function saveBehavior(state) {
    state = state || {};
    state.behavior_version = CONFIG.snippetVersion;
    state.max_scroll_percent = Math.max(Number(state.max_scroll_percent || 0), getScrollPercent());
    state.npay_button_seen = Boolean(state.npay_button_seen || detectNpaySeen());

    var method = detectSelectedPaymentMethod();
    if (method) state.selected_payment_method = method;

    state.updated_at = nowIso();
    writeJsonStorage(window.sessionStorage, CONFIG.paymentPageBehaviorKey, state);
    return state;
  }

  function getBehaviorMetrics() {
    var state = saveBehavior(loadBehavior());
    var now = Date.now();
    var enteredAt = Number(state.page_entered_at_ms || now);
    var timeOnPageMs = Math.max(0, now - enteredAt);

    return {
      page_entered_at: state.page_entered_at || '',
      page_entered_at_ms: enteredAt,
      selected_payment_method: trim(state.selected_payment_method),
      npay_button_seen: Boolean(state.npay_button_seen),
      npay_button_clicked: Boolean(state.npay_button_clicked),
      npay_click_detected_by: trim(state.npay_click_detected_by),
      npay_clicked_at: trim(state.npay_clicked_at),
      scroll_max_percent: Number(state.max_scroll_percent || 0),
      visible_seconds: Math.round(timeOnPageMs / 1000),
      time_on_page_ms: timeOnPageMs,
      behavior_version: CONFIG.snippetVersion
    };
  }

  function installBehaviorListeners() {
    var state = loadBehavior();
    saveBehavior(state);

    window.addEventListener('scroll', function () {
      saveBehavior(loadBehavior());
    }, { passive: true });

    document.addEventListener('change', function () {
      saveBehavior(loadBehavior());
    }, true);

    document.addEventListener('click', function (event) {
      var state = loadBehavior();

      /*
        v4.4.2 change:
        Only a strong actionable NPay element can set npay_button_clicked=true.
        Clicking broad payment-area text must not count as an NPay click.
      */
      if (isStrongNpayClickElement(event.target)) {
        state.npay_button_seen = true;
        state.npay_button_clicked = true;
        state.npay_click_detected_by = 'strong_actionable_npay_element';
        state.npay_clicked_at = nowIso();
        state.selected_payment_method = 'npay';
      } else {
        var method = detectSelectedPaymentMethod();
        if (method) state.selected_payment_method = method;
      }

      saveBehavior(state);
    }, true);
  }

  function buildCommonContext() {
    var imwebSession = readJsonStorage(window.sessionStorage, '__bs_imweb_session');
    var lastTouch = readJsonStorage(window.localStorage, '_p1s1a_last_touch');
    var clickContext = readJsonStorage(window.localStorage, CONFIG.clickContextKey);
    var checkoutContext = readJsonStorage(window.sessionStorage, CONFIG.checkoutContextKey);
    var paidTouchBeforeCheckout = readPaidTouchBeforeCheckout(lastTouch, checkoutContext);

    var checkoutId = firstNonEmpty([
      trim(checkoutContext.checkoutId),
      trim(window.sessionStorage && window.sessionStorage.getItem(CONFIG.checkoutIdKey)),
      getOrCreateCheckoutId()
    ]);

    var landing = location.href;

    var versionedCheckoutContext = trim(checkoutContext.googleClickIdGuardVersion) === CONFIG.googleClickIdGuardVersion
      ? checkoutContext
      : {};

    var legacyCheckoutContext = trim(checkoutContext.googleClickIdGuardVersion) === CONFIG.googleClickIdGuardVersion
      ? {}
      : checkoutContext;

    var selectedGoogleClickSet = selectGoogleClickSet([
      googleClickSetFromUrl(location.href, 'current_url'),
      googleClickSetFrom(versionedCheckoutContext, 'checkout_context_v4_4_3'),
      googleClickSetFromUrl(document.referrer, 'document_referrer'),
      googleClickSetFrom(clickContext, 'header_click_context'),
      googleClickSetFrom(lastTouch, 'last_touch'),
      googleClickSetFrom({
        gclid: imwebSession.gclid,
        gbraid: imwebSession.gbraid,
        wbraid: imwebSession.wbraid
      }, 'imweb_session'),
      googleClickSetFrom(legacyCheckoutContext, 'legacy_checkout_context')
    ]);

    var tracking = mergeLandingParams({
      utm_source: firstNonEmpty([
        getSearchParam(['utm_source']),
        trim(checkoutContext.utm_source),
        trim(clickContext.utm_source),
        trim(lastTouch.utm_source),
        trim(imwebSession.utmSource)
      ]),
      utm_medium: firstNonEmpty([
        getSearchParam(['utm_medium']),
        trim(checkoutContext.utm_medium),
        trim(clickContext.utm_medium),
        trim(lastTouch.utm_medium),
        trim(imwebSession.utmMedium)
      ]),
      utm_campaign: firstNonEmpty([
        getSearchParam(['utm_campaign']),
        trim(checkoutContext.utm_campaign),
        trim(clickContext.utm_campaign),
        trim(lastTouch.utm_campaign),
        trim(imwebSession.utmCampaign)
      ]),
      utm_content: firstNonEmpty([
        getSearchParam(['utm_content']),
        trim(checkoutContext.utm_content),
        trim(clickContext.utm_content),
        trim(lastTouch.utm_content),
        trim(imwebSession.utmContent)
      ]),
      utm_term: firstNonEmpty([
        getSearchParam(['utm_term']),
        trim(checkoutContext.utm_term),
        trim(clickContext.utm_term),
        trim(lastTouch.utm_term),
        trim(imwebSession.utmTerm)
      ]),

      /*
        v4.4.3:
        One coherent Google click-id source only.
      */
      gclid: selectedGoogleClickSet.gclid,
      gbraid: selectedGoogleClickSet.gbraid,
      wbraid: selectedGoogleClickSet.wbraid,

      fbclid: firstNonEmpty([
        getSearchParam(['fbclid']),
        trim(checkoutContext.fbclid),
        trim(clickContext.fbclid),
        trim(lastTouch.fbclid),
        trim(imwebSession.fbclid)
      ]),
      ttclid: firstNonEmpty([
        getSearchParam(['ttclid']),
        trim(checkoutContext.ttclid),
        trim(lastTouch.ttclid),
        trim(imwebSession.ttclid)
      ]),

      fbc: firstNonEmpty([
        trim(lastTouch.fbc),
        readCookie('_fbc'),
        getSearchParam(['fbc'])
      ]),
      fbp: firstNonEmpty([
        trim(lastTouch.fbp),
        readCookie('_fbp'),
        getSearchParam(['fbp'])
      ])
    }, landing);

    return {
      imwebSession: imwebSession,
      lastTouch: lastTouch,
      clickContext: clickContext,
      checkoutContext: checkoutContext,
      paidTouchBeforeCheckout: paidTouchBeforeCheckout,
      checkoutId: checkoutId,
      landing: landing,
      tracking: tracking,
      googleClickIdSource: selectedGoogleClickSet.source,
      googleClickIdGuardVersion: CONFIG.googleClickIdGuardVersion
    };
  }

  function buildIdentity(context) {
    var checkoutContext = context.checkoutContext || {};
    var lastTouch = context.lastTouch || {};
    var imwebSession = context.imwebSession || {};

    return {
      ga_session_id: firstNonEmpty([
        trim(checkoutContext.gaSessionId),
        readDataLayerValue(['ga_session_id', 'gaSessionId']),
        trim(lastTouch.ga_session_id),
        trim(imwebSession.ga_session_id)
      ]),
      client_id: firstNonEmpty([
        trim(checkoutContext.clientId),
        readDataLayerValue(['client_id', 'clientId', 'ga_client_id', 'gaClientId']),
        trim(lastTouch.client_id),
        trim(imwebSession.client_id)
      ]),
      user_pseudo_id: firstNonEmpty([
        trim(checkoutContext.userPseudoId),
        readDataLayerValue(['user_pseudo_id', 'userPseudoId', 'ga_user_pseudo_id', 'gaUserPseudoId']),
        trim(lastTouch.user_pseudo_id),
        trim(imwebSession.user_pseudo_id),
        trim(checkoutContext.clientId)
      ]),
      customerKey: firstNonEmpty([
        trim(checkoutContext.customerKey),
        trim(lastTouch.customerKey),
        trim(imwebSession.customerKey),
        trim(imwebSession.memberId),
        trim(imwebSession.member_id)
      ])
    };
  }

  function buildOrderPresence(ids) {
    return {
      order_code_present: Boolean(trim(ids.orderCode)),
      order_no_present: Boolean(trim(ids.orderNo)),
      order_member_present: Boolean(trim(ids.orderMember)),
      payment_key_present: Boolean(trim(ids.paymentKey)),
      transaction_id_present: Boolean(trim(ids.transactionId))
    };
  }

  function sendPaymentPageSeen(phase) {
    var context = buildCommonContext();
    var tracking = context.tracking;
    var ids = getPaymentIdentifiers();
    var identity = buildIdentity(context);
    var behavior = getBehaviorMetrics();

    var googleClickIdPresent = hasGoogleClickId(tracking);
    var googleClickIdType = getGoogleClickIdType(tracking);
    var orderPresence = buildOrderPresence(ids);

    var dedupeKey = (phase === 'exit' ? CONFIG.paymentPageExitDedupePrefix : CONFIG.paymentPageSeenDedupePrefix) + context.checkoutId;

    if (hasSentMarker(dedupeKey)) {
      debugLog('skip duplicate payment_page_seen', {
        phase: phase,
        has_google_click_id: googleClickIdPresent,
        google_click_id_type: googleClickIdType
      });
      return;
    }

    var payload = {
      touchpoint: 'payment_page_seen',
      captureMode: 'live',
      source: CONFIG.source,
      site: CONFIG.site,

      checkoutId: context.checkoutId,
      customerKey: identity.customerKey,
      clientObservedAt: nowIso(),

      landing: context.landing,
      referrer: document.referrer || '',

      ga_session_id: identity.ga_session_id,
      client_id: identity.client_id,
      user_pseudo_id: identity.user_pseudo_id,

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
        snippetVersion: CONFIG.pageSeenVersion,
        split_snippet_version: CONFIG.snippetVersion,
        semantic_touchpoint: 'payment_page_seen',
        page_location_class: 'shop_payment',
        event_phase: phase || 'enter',

        is_purchase_candidate: false,
        meta_purchase_candidate: false,
        confirmed_bridge_candidate: false,
        completion_url: false,
        value_guard_required_before_meta_send: true,

        order_code_present: orderPresence.order_code_present,
        order_no_present: orderPresence.order_no_present,
        member_present: orderPresence.order_member_present,
        guest_checkout: !orderPresence.order_member_present,
        payment_key_present: orderPresence.payment_key_present,
        transaction_id_present: orderPresence.transaction_id_present,

        selected_payment_method: behavior.selected_payment_method,
        payment_method_attempted: Boolean(behavior.selected_payment_method) ? behavior.selected_payment_method : '',
        card_attempted: behavior.selected_payment_method === 'card',
        virtual_account_selected: behavior.selected_payment_method === 'virtual_account',
        bank_transfer_selected: behavior.selected_payment_method === 'bank_transfer',
        virtual_account_issued: false,

        npay_button_seen: behavior.npay_button_seen,
        npay_button_clicked: behavior.npay_button_clicked,
        npay_click_detected_by: behavior.npay_click_detected_by,
        npay_clicked_at_present: Boolean(behavior.npay_clicked_at),

        scroll_max_percent: behavior.scroll_max_percent,
        visible_seconds: behavior.visible_seconds,
        time_on_page_ms: behavior.time_on_page_ms,
        page_entered_at: behavior.page_entered_at,
        behavior_version: behavior.behavior_version,

        google_click_id_present: googleClickIdPresent,
        google_click_id_type: googleClickIdType,
        google_click_id_source: context.googleClickIdSource,
        google_click_id_guard_version: context.googleClickIdGuardVersion,
        has_gclid: Boolean(trim(tracking.gclid)),
        has_gbraid: Boolean(trim(tracking.gbraid)),
        has_wbraid: Boolean(trim(tracking.wbraid)),
        has_fbclid: Boolean(trim(tracking.fbclid)),
        has_fbc: Boolean(trim(tracking.fbc)),
        has_fbp: Boolean(trim(tracking.fbp)),
        has_ttclid: Boolean(trim(tracking.ttclid)),

        ga_join_key_present: Boolean(identity.client_id || identity.ga_session_id || identity.user_pseudo_id),
        client_id_present: Boolean(identity.client_id),
        ga_session_id_present: Boolean(identity.ga_session_id),
        user_pseudo_id_present: Boolean(identity.user_pseudo_id),

        backend_compat_note: 'checkout-context stores as checkout_started until payment_page_seen endpoint is deployed'
      }
    };

    debugLog('send payment_page_seen presence', {
      phase: phase,
      has_google_click_id: googleClickIdPresent,
      google_click_id_type: googleClickIdType,
      selected_payment_method: behavior.selected_payment_method,
      npay_button_seen: behavior.npay_button_seen,
      npay_button_clicked: behavior.npay_button_clicked,
      npay_click_detected_by: behavior.npay_click_detected_by,
      scroll_max_percent: behavior.scroll_max_percent,
      visible_seconds: behavior.visible_seconds
    });

    return sendPayload(CONFIG.paymentPageEndpoint, payload).then(function (result) {
      rememberSent(dedupeKey);
      debugLog('payment_page_seen send ok', result);
      return result;
    }).catch(function (error) {
      debugLog('payment_page_seen send failed', error && error.message ? error.message : error);
    });
  }

  function sendPaymentSuccess() {
    var context = buildCommonContext();
    var tracking = context.tracking;
    var ids = getPaymentIdentifiers();
    var identity = buildIdentity(context);

    var googleClickIdPresent = hasGoogleClickId(tracking);
    var googleClickIdType = getGoogleClickIdType(tracking);
    var paidTouchBeforeCheckoutPresent = hasPaidTouchSignal(context.paidTouchBeforeCheckout);

    var transactionId = firstNonEmpty([
      ids.transactionId,
      ids.orderCode,
      ids.orderNo,
      ids.paymentKey,
      context.checkoutId
    ]);

    var dedupeBase = firstNonEmpty([transactionId, context.checkoutId, location.href]);
    var dedupeKey = CONFIG.paymentSuccessDedupePrefix + dedupeBase;

    var value = getPaymentValue();

    if (hasSentMarker(dedupeKey)) {
      debugLog('skip duplicate payment_success', {
        has_google_click_id: googleClickIdPresent,
        google_click_id_type: googleClickIdType
      });
      return;
    }

    var payload = {
      touchpoint: 'payment_success',
      captureMode: 'live',
      source: CONFIG.source,
      site: CONFIG.site,

      checkoutId: context.checkoutId,
      transaction_id: transactionId,
      order_code: ids.orderCode,
      order_no: ids.orderNo,
      order_member: ids.orderMember,
      payment_key: ids.paymentKey,

      clientObservedAt: nowIso(),
      landing: context.landing,
      referrer: document.referrer || '',

      ga_session_id: identity.ga_session_id,
      client_id: identity.client_id,
      user_pseudo_id: identity.user_pseudo_id,

      value: value,
      currency: 'KRW',

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
        snippetVersion: CONFIG.paymentSuccessVersion,
        split_snippet_version: CONFIG.snippetVersion,
        semantic_touchpoint: 'payment_success',
        page_location_class: 'payment_success_allowlist',
        completed_url_allowlist_pass: true,
        completion_url: true,

        pending_until_confirmed_bridge: true,
        value_guard_required_before_meta_send: true,
        confirmed_bridge_candidate: false,
        meta_purchase_candidate: false,

        order_code_present: Boolean(trim(ids.orderCode)),
        order_no_present: Boolean(trim(ids.orderNo)),
        member_present: Boolean(trim(ids.orderMember)),
        payment_key_present: Boolean(trim(ids.paymentKey)),
        transaction_id_present: Boolean(trim(ids.transactionId)),

        checkout_context_version: trim(context.checkoutContext.snippetVersion),
        click_context_version: trim(context.clickContext.snippet_version),

        google_click_id_present: googleClickIdPresent,
        google_click_id_type: googleClickIdType,
        google_click_id_source: context.googleClickIdSource,
        google_click_id_guard_version: context.googleClickIdGuardVersion,
        has_gclid: Boolean(trim(tracking.gclid)),
        has_gbraid: Boolean(trim(tracking.gbraid)),
        has_wbraid: Boolean(trim(tracking.wbraid)),
        has_fbclid: Boolean(trim(tracking.fbclid)),
        has_fbc: Boolean(trim(tracking.fbc)),
        has_fbp: Boolean(trim(tracking.fbp)),
        has_ttclid: Boolean(trim(tracking.ttclid)),

        /*
          Raw Google click IDs are preserved only inside VM Cloud evidence.
          Never print them in reports/Telegram.
        */
        gbraid: tracking.gbraid,
        wbraid: tracking.wbraid,

        click_id_restore_source: context.googleClickIdSource,

        checkoutId: context.checkoutId,
        checkoutUrl: trim(context.checkoutContext.landing),
        paymentUrl: context.landing,
        imweb_landing_url: trim(context.imwebSession.utmLandingUrl),

        paidTouchBeforeCheckout: paidTouchBeforeCheckoutPresent ? context.paidTouchBeforeCheckout : undefined,
        paid_touch_before_checkout_present: paidTouchBeforeCheckoutPresent,
        paid_touch_before_checkout_grade: paidTouchBeforeCheckoutPresent ? trim(context.paidTouchBeforeCheckout.grade) : '',
        paid_touch_before_checkout_source: paidTouchBeforeCheckoutPresent ? trim(context.paidTouchBeforeCheckout.storageSource) : '',
        paid_touch_meta_campaign_id_present: paidTouchBeforeCheckoutPresent && Boolean(trim(context.paidTouchBeforeCheckout.metaCampaignId)),
        paid_touch_meta_adset_id_present: paidTouchBeforeCheckoutPresent && Boolean(trim(context.paidTouchBeforeCheckout.metaAdsetId)),
        paid_touch_meta_ad_id_present: paidTouchBeforeCheckoutPresent && Boolean(trim(context.paidTouchBeforeCheckout.metaAdId))
      }
    };

    writeJsonStorage(window.sessionStorage, CONFIG.paymentSuccessContextKey, {
      snippetVersion: CONFIG.paymentSuccessVersion,
      checkoutId: context.checkoutId,
      hasGoogleClickId: googleClickIdPresent,
      googleClickIdType: googleClickIdType,
      hasGclid: Boolean(trim(tracking.gclid)),
      hasGbraid: Boolean(trim(tracking.gbraid)),
      hasWbraid: Boolean(trim(tracking.wbraid)),
      clickIdRestoreSource: payload.metadata.click_id_restore_source,
      googleClickIdSource: context.googleClickIdSource,
      googleClickIdGuardVersion: context.googleClickIdGuardVersion,
      checkoutContextVersion: trim(context.checkoutContext.snippetVersion),
      clickContextVersion: trim(context.clickContext.snippet_version),
      completedUrlAllowlistPass: true,
      paidTouchBeforeCheckoutPresent: paidTouchBeforeCheckoutPresent,
      paidTouchBeforeCheckoutGrade: paidTouchBeforeCheckoutPresent ? trim(context.paidTouchBeforeCheckout.grade) : '',
      paidTouchBeforeCheckoutSource: paidTouchBeforeCheckoutPresent ? trim(context.paidTouchBeforeCheckout.storageSource) : ''
    });

    debugLog('send payment_success presence', {
      has_google_click_id: googleClickIdPresent,
      google_click_id_type: googleClickIdType,
      has_gclid: Boolean(trim(tracking.gclid)),
      has_gbraid: Boolean(trim(tracking.gbraid)),
      has_wbraid: Boolean(trim(tracking.wbraid)),
      restore_source: payload.metadata.click_id_restore_source,
      google_click_id_source: context.googleClickIdSource,
      value_present: Boolean(value),
      paid_touch_before_checkout_present: paidTouchBeforeCheckoutPresent,
      paid_touch_before_checkout_grade: paidTouchBeforeCheckoutPresent ? trim(context.paidTouchBeforeCheckout.grade) : ''
    });

    return sendPayload(CONFIG.paymentSuccessEndpoint, payload).then(function (result) {
      rememberSent(dedupeKey);
      debugLog('payment_success send ok', result);
      return result;
    }).catch(function (error) {
      debugLog('payment_success send failed', error && error.message ? error.message : error);
    });
  }

  var route = classifyRoute();

  if (route === 'payment_page_seen') {
    installBehaviorListeners();

    sendPaymentPageSeen('enter');

    window.addEventListener('pagehide', function () {
      saveBehavior(loadBehavior());
      sendPaymentPageSeen('exit');
    });

    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') {
        saveBehavior(loadBehavior());
        sendPaymentPageSeen('exit');
      }
    });

    return;
  }

  if (route === 'payment_success') {
    sendPaymentSuccess();
    return;
  }
})();


  window.FUNNEL_CAPI_CONFIG = {
    pixelId: '1283400029487161',
    endpoint: 'https://att.ainativeos.net/api/meta/capi/track',
    enableServerCapi: false,
    testEventCode: '',
    debug: true
  };


/*!
 * Phase 9 — Funnel CAPI mirror + InitiateCheckout value enrichment (biocom) v4.4.4 candidate
 * 2026-05-21-biocom-funnel-capi-v4-4-4
 *
 * 전략: window.fbq 를 wrap 하여 aimweb/native Pixel 이 이미 쏘는 ViewContent / AddToCart /
 * InitiateCheckout / AddPaymentInfo track 호출을 가로챈다.
 *   - eventID 가 없으면 결정론적 id 를 주입한다.
 *   - InitiateCheckout 에 value/currency 가 없으면 주문서 화면 DOM, dataLayer, sessionStorage 에서
 *     결제 예정 금액을 찾아 기존 browser Pixel payload 에 추가한다.
 *   - 서버 CAPI mirror 는 현재 설정상 enableServerCapi=false 이므로 운영 전송을 새로 만들지 않는다.
 *   - Purchase 는 제외한다. 실제 구매/가상계좌 판정은 Header Guard + VM Cloud payment-decision 이 담당한다.
 *
 * 이 후보가 해결하려는 문제:
 *   Meta 진단의 "InitiateCheckout 값 필드 없음" 경고를 중복 이벤트 없이 줄인다.
 */
(function () {
  'use strict';
  var cfg = window.FUNNEL_CAPI_CONFIG || {};
  var SNIPPET_VERSION = '2026-05-21-biocom-funnel-capi-v4-4-4';
  var ENDPOINT = cfg.endpoint || 'https://att.ainativeos.net/api/meta/capi/track';
  var PIXEL_ID = cfg.pixelId;
  var ENABLE_SERVER_CAPI = !!cfg.enableServerCapi;
  var TEST_CODE = cfg.testEventCode || '';
  var DEBUG = !!cfg.debug;

  if (!PIXEL_ID) {
    console.warn('[funnel-capi] FUNNEL_CAPI_CONFIG.pixelId missing — aborting');
    return;
  }
  if (window.__FUNNEL_CAPI_INSTALLED === SNIPPET_VERSION) return;
  window.__FUNNEL_CAPI_INSTALLED = SNIPPET_VERSION;

  /* ── 유틸 ──────────────────────────────────────────────────────────── */
  function trim(value) {
    if (value === null || value === undefined) return '';
    return String(value).trim();
  }

  function log() {
    if (!DEBUG) return;
    try { console.info.apply(console, ['[funnel-capi-v4.4.4]'].concat([].slice.call(arguments))); }
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

  function copyObject(source) {
    source = safeObj(source);
    var result = {};
    for (var key in source) {
      if (Object.prototype.hasOwnProperty.call(source, key)) result[key] = source[key];
    }
    return result;
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

  function readStorageJson(storage, key) {
    try {
      if (!storage) return {};
      return safeParse(storage.getItem(key));
    } catch (error) {
      return {};
    }
  }

  function parseKrw(value) {
    if (typeof value === 'number' && isFinite(value)) return value > 0 ? Math.round(value) : 0;
    var normalized = trim(value).replace(/[^0-9.-]/g, '');
    if (!normalized) return 0;
    var parsed = Number(normalized);
    if (!isFinite(parsed) || parsed <= 0) return 0;
    return Math.round(parsed);
  }

  function normalizeReasonableKrw(value) {
    var parsed = parseKrw(value);

    /*
      Guard rails:
      - 1,000원 미만 숫자는 수량/옵션값일 가능성이 높다.
      - 10,000,000원 초과 숫자는 order_no 같은 식별자일 가능성이 높다.
    */
    if (parsed < 1000 || parsed > 10000000) return 0;
    return parsed;
  }

  function readDataLayerNumber(keys) {
    try {
      if (!Array.isArray(window.dataLayer)) return 0;

      for (var i = window.dataLayer.length - 1; i >= 0; i -= 1) {
        var item = window.dataLayer[i];
        if (!item || typeof item !== 'object' || Array.isArray(item)) continue;

        for (var j = 0; j < keys.length; j += 1) {
          var key = keys[j];
          var value = normalizeReasonableKrw(item[key]);
          if (value) return value;
        }

        if (item.ecommerce && typeof item.ecommerce === 'object') {
          for (var k = 0; k < keys.length; k += 1) {
            var nestedValue = normalizeReasonableKrw(item.ecommerce[keys[k]]);
            if (nestedValue) return nestedValue;
          }
        }
      }
    } catch (error) {}

    return 0;
  }

  function readCheckoutContextValue() {
    var context = readStorageJson(window.sessionStorage, '__seo_checkout_context');
    var keys = [
      'value',
      'amount',
      'orderValue',
      'order_value',
      'totalAmount',
      'total_amount',
      'totalPrice',
      'total_price'
    ];

    for (var i = 0; i < keys.length; i += 1) {
      var value = normalizeReasonableKrw(context[keys[i]]);
      if (value) return value;
    }

    return 0;
  }

  function maxReasonableKrwFromText(text) {
    var matches = String(text || '').match(/(?:₩\s*)?[0-9][0-9,]*(?:\.\d+)?\s*(?:원|KRW)?/gi) || [];
    var max = 0;

    for (var i = 0; i < matches.length; i += 1) {
      var value = normalizeReasonableKrw(matches[i]);
      if (value > max) max = value;
    }

    return max;
  }

  function readLabeledDomValue() {
    try {
      var text = document.body && document.body.innerText || '';
      if (!text) return 0;

      var lines = text.split(/\n+/).map(function (line) { return trim(line); }).filter(Boolean);
      var labelRe = /최종\s*결제\s*금액|총\s*결제\s*금액|결제\s*예정\s*금액|결제\s*금액|총\s*주문\s*금액|주문\s*금액|총\s*상품\s*금액|상품\s*금액|합계/i;

      for (var i = 0; i < lines.length; i += 1) {
        if (!labelRe.test(lines[i])) continue;
        var nearby = lines.slice(i, Math.min(lines.length, i + 5)).join(' ');
        var labeled = maxReasonableKrwFromText(nearby);
        if (labeled) return labeled;
      }
    } catch (error) {}

    return 0;
  }

  function readVisibleDomValue() {
    try {
      return maxReasonableKrwFromText(document.body && document.body.innerText || '');
    } catch (error) {
      return 0;
    }
  }

  function getInitiateCheckoutValueCandidate(payload) {
    payload = safeObj(payload);

    var existing = normalizeReasonableKrw(payload.value);
    if (existing) {
      return {
        value: existing,
        source: 'existing_payload',
        confidence: 'high',
        preserveExisting: true
      };
    }

    var dataLayerValue = readDataLayerNumber([
      'value',
      'amount',
      'revenue',
      'total_price',
      'totalPrice',
      'total_amount',
      'totalAmount',
      'order_value',
      'orderValue'
    ]);
    if (dataLayerValue) {
      return {
        value: dataLayerValue,
        source: 'dataLayer',
        confidence: 'high',
        preserveExisting: false
      };
    }

    var contextValue = readCheckoutContextValue();
    if (contextValue) {
      return {
        value: contextValue,
        source: 'checkout_context_storage',
        confidence: 'high',
        preserveExisting: false
      };
    }

    var labeledDomValue = readLabeledDomValue();
    if (labeledDomValue) {
      return {
        value: labeledDomValue,
        source: 'checkout_dom_labeled_amount',
        confidence: 'medium_high',
        preserveExisting: false
      };
    }

    var visibleDomValue = readVisibleDomValue();
    if (visibleDomValue) {
      return {
        value: visibleDomValue,
        source: 'checkout_dom_largest_amount',
        confidence: 'medium',
        preserveExisting: false
      };
    }

    return {
      value: 0,
      source: 'not_found',
      confidence: 'none',
      preserveExisting: false
    };
  }

  function enrichInitiateCheckoutPayload(eventName, payload) {
    payload = safeObj(payload);

    if (eventName !== 'InitiateCheckout') {
      return {
        payload: payload,
        enriched: false,
        reason: 'not_initiate_checkout'
      };
    }

    var candidate = getInitiateCheckoutValueCandidate(payload);
    if (!candidate.value) {
      return {
        payload: payload,
        enriched: false,
        reason: 'value_not_found',
        valueSource: candidate.source,
        valueConfidence: candidate.confidence
      };
    }

    if (candidate.preserveExisting && trim(payload.currency)) {
      return {
        payload: payload,
        enriched: false,
        reason: 'already_has_value_and_currency',
        value: candidate.value,
        valueSource: candidate.source,
        valueConfidence: candidate.confidence
      };
    }

    var nextPayload = copyObject(payload);

    if (!normalizeReasonableKrw(nextPayload.value)) {
      nextPayload.value = candidate.value;
    }

    if (!trim(nextPayload.currency)) {
      nextPayload.currency = 'KRW';
    }

    if (!trim(nextPayload.content_type) && !trim(nextPayload.contentType)) {
      nextPayload.content_type = 'product';
    }

    nextPayload.value_enriched_by = 'biocom_phase9_v444';
    nextPayload.value_source = candidate.source;
    nextPayload.value_confidence = candidate.confidence;
    nextPayload.snippet_version = SNIPPET_VERSION;

    return {
      payload: nextPayload,
      enriched: true,
      reason: 'value_currency_enriched',
      value: candidate.value,
      valueSource: candidate.source,
      valueConfidence: candidate.confidence
    };
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
    if (orig.__FUNNEL_CAPI_V444_WRAPPED__) {
      log('fbq already wrapped — skip');
      return;
    }

    var mirror = function () {
      var args = Array.prototype.slice.call(arguments);

      try {
        if (args[0] === 'track' && MIRROR_EVENTS[args[1]]) {
          var eventName = args[1];
          var payload = safeObj(args[2]);
          var enrichment = enrichInitiateCheckoutPayload(eventName, payload);
          payload = enrichment.payload;
          args[2] = payload;

          if (enrichment.enriched) {
            log('enrich InitiateCheckout value', {
              value: enrichment.value,
              source: enrichment.valueSource,
              confidence: enrichment.valueConfidence
            });
          } else if (eventName === 'InitiateCheckout') {
            log('InitiateCheckout value enrichment skipped', {
              reason: enrichment.reason,
              source: enrichment.valueSource || '',
              confidence: enrichment.valueConfidence || ''
            });
          }

          var eventMeta = safeObj(args[3]);
          var idRes = ensureEventId(eventName, payload, eventMeta);

          if (idRes.injected) {
            var merged = {};
            for (var k in eventMeta) if (Object.prototype.hasOwnProperty.call(eventMeta, k)) merged[k] = eventMeta[k];
            merged.eventID = idRes.id;
            args[3] = merged;
            log('inject eid', eventName, idRes.id, 'payload=', payload);
          } else {
            log('reuse eid', eventName, idRes.id);
          }

          serverMirror(eventName, idRes.id, payload);
        }
      } catch (e) {
        log('mirror observe error', e && e.message ? e.message : e);
      }

      return orig.apply(this, args);
    };

    /* ── 기존 fbq 속성 / Purchase Guard 마커 보존 ── */
    try {
      for (var k in orig) {
        if (Object.prototype.hasOwnProperty.call(orig, k)) {
          try { mirror[k] = orig[k]; } catch (copyErr) {}
        }
      }
    } catch (e) {}

    if (orig.callMethod) mirror.callMethod = orig.callMethod;
    if (orig.queue) mirror.queue = orig.queue;
    if (orig.loaded) mirror.loaded = orig.loaded;
    if (orig.version) mirror.version = orig.version;
    if (orig.agent) mirror.agent = orig.agent;
    if (orig._fbq) mirror._fbq = orig._fbq;
    if (orig.push) mirror.push = orig.push;

    if (orig.__BIOCOM_SERVER_PAYMENT_DECISION_GUARD_WRAPPED__) {
      mirror.__BIOCOM_SERVER_PAYMENT_DECISION_GUARD_WRAPPED__ = true;
    }
    if (orig.__BIOCOM_SERVER_PAYMENT_DECISION_GUARD_RAW__) {
      mirror.__BIOCOM_SERVER_PAYMENT_DECISION_GUARD_RAW__ = orig.__BIOCOM_SERVER_PAYMENT_DECISION_GUARD_RAW__;
    }

    mirror.__FUNNEL_CAPI_V444_WRAPPED__ = true;

    window.fbq = mirror;
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

(function () {
  'use strict';

  var CONFIG = {
    pixelId: '1283400029487161',
    snippetVersion: '2026-05-21-biocom-meta-funnel-fallback-block4-v0-5',
    endpoint: 'https://www.facebook.com/tr/',
    debugQueryKey: '__seo_attribution_debug',

    /*
      Wait briefly for native/FBE Pixel to fire first.
      If no actual facebook.com/tr network event exists after this delay,
      v0.5 sends an image beacon fallback.
    */
    nativeObserveMs: 1200,
    valueRetryMs: [0, 600, 1400, 2600, 4000],
    postCheckMs: 900,

    dedupePrefix: '__biocom_meta_funnel_fallback_sent_v0_5__:',
    eventIdStorePrefix: '__biocom_meta_funnel_event_id_v0_5__:',
    logKey: '__biocom_meta_funnel_fallback_v05',

    checkoutIdKey: '__seo_checkout_id',
    checkoutContextKey: '__seo_checkout_context',
    behaviorKey: '__seo_payment_page_behavior_v1',

    /*
      Hard guard.
      v0.5 must never send these events.
    */
    forbiddenEvents: {
      PageView: true,
      ViewContent: true,
      Purchase: true
    },

    allowedEvents: {
      AddToCart: true,
      InitiateCheckout: true,
      AddPaymentInfo: true
    }
  };

  if (window.__BIOCOM_META_FUNNEL_FALLBACK_V05_VERSION__ === CONFIG.snippetVersion) return;
  window.__BIOCOM_META_FUNNEL_FALLBACK_V05_VERSION__ = CONFIG.snippetVersion;

  window.__BIOCOM_META_FUNNEL_IMAGE_BEACONS__ = window.__BIOCOM_META_FUNNEL_IMAGE_BEACONS__ || [];

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
      console.log.apply(console, ['[biocom-block4-v0.5]'].concat([].slice.call(arguments)));
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

  function readSession(key) {
    try {
      return trim(window.sessionStorage && window.sessionStorage.getItem(key));
    } catch (error) {
      return '';
    }
  }

  function writeSession(key, value) {
    try {
      if (!window.sessionStorage) return;
      window.sessionStorage.setItem(key, value);
    } catch (error) {}
  }

  function readSessionJson(key) {
    return safeParse(readSession(key));
  }

  function appendDecision(eventName, decision, extra) {
    try {
      var state = readSessionJson(CONFIG.logKey);
      if (!state.decisions || !Array.isArray(state.decisions)) state.decisions = [];

      var row = {
        at: new Date().toISOString(),
        eventName: eventName,
        decision: decision,
        snippetVersion: CONFIG.snippetVersion
      };

      extra = extra || {};
      for (var key in extra) {
        if (Object.prototype.hasOwnProperty.call(extra, key)) {
          row[key] = extra[key];
        }
      }

      state.decisions.push(row);

      /*
        Keep logs bounded.
      */
      if (state.decisions.length > 80) {
        state.decisions = state.decisions.slice(state.decisions.length - 80);
      }

      state.snippetVersion = CONFIG.snippetVersion;
      writeSession(CONFIG.logKey, JSON.stringify(state));
    } catch (error) {}
  }

  function getPath() {
    return String(location.pathname || '');
  }

  function getHref() {
    return String(location.href || '');
  }

  function isShopPaymentPage() {
    return /\/shop_payment\/?/i.test(getPath());
  }

  function isCartPage() {
    return /shop_cart|cart/i.test(getHref());
  }

  function isCompletionPage() {
    return /shop_payment_complete|shop_order_done|order_complete|payment_complete|payment_success/i.test(getHref());
  }

  function readCookie(name) {
    try {
      var pattern = new RegExp('(?:^|; )' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '=([^;]*)');
      var match = document.cookie.match(pattern);
      return match ? decodeURIComponent(match[1]) : '';
    } catch (error) {
      return '';
    }
  }

  function sanitizeUrl(urlLike) {
    try {
      var url = new URL(urlLike || location.href, location.origin);

      /*
        Remove order/payment/member identifiers from dl/rl.
        Do not send raw order_no/order_code/order_member/payment_key to Meta.
      */
      [
        'order_code',
        'orderCode',
        'order_no',
        'orderNo',
        'order_member',
        'orderMember',
        'payment_key',
        'paymentKey',
        'imp_uid',
        'merchant_uid',
        'member',
        'member_id'
      ].forEach(function (key) {
        url.searchParams.delete(key);
      });

      return url.toString();
    } catch (error) {
      return String(location.origin || '') + String(location.pathname || '');
    }
  }

  function hashString(value) {
    value = String(value || '');
    var hash = 5381;
    for (var i = 0; i < value.length; i += 1) {
      hash = ((hash << 5) + hash) + value.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  function getDayBucket() {
    try {
      var d = new Date();
      return [
        d.getFullYear(),
        String(d.getMonth() + 1).padStart(2, '0'),
        String(d.getDate()).padStart(2, '0')
      ].join('');
    } catch (error) {
      return String(Date.now()).slice(0, 8);
    }
  }

  function buildEventId(eventName, stableKey) {
    var base = [
      'biocom',
      'block4',
      eventName,
      stableKey || getPath(),
      getDayBucket()
    ].join('.');

    return [
      'biocom',
      'block4',
      eventName,
      hashString(base)
    ].join('.');
  }

  function storeEventId(eventName, eventId) {
    writeSession(CONFIG.eventIdStorePrefix + eventName, JSON.stringify({
      event_id: eventId,
      event_name: eventName,
      stored_at: new Date().toISOString(),
      version: CONFIG.snippetVersion
    }));
  }

  function getCheckoutId() {
    try {
      var existing = trim(sessionStorage.getItem(CONFIG.checkoutIdKey));
      if (existing) return existing;

      var created = 'chk_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
      sessionStorage.setItem(CONFIG.checkoutIdKey, created);
      return created;
    } catch (error) {
      return 'chk_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
    }
  }

  function hasSent(dedupeKey) {
    return Boolean(readSession(CONFIG.dedupePrefix + dedupeKey));
  }

  function markSent(dedupeKey, eventId, url) {
    writeSession(CONFIG.dedupePrefix + dedupeKey, JSON.stringify({
      sent_at: new Date().toISOString(),
      event_id: eventId,
      beacon_url_hash: hashString(url),
      version: CONFIG.snippetVersion
    }));
  }

  function parseKrw(value) {
    var normalized = trim(value).replace(/[^\d.-]/g, '');
    if (!normalized) return 0;
    var parsed = Number(normalized);
    return isFinite(parsed) ? parsed : 0;
  }

  function findLargestKrwInText(text) {
    text = String(text || '');
    var matches = text.match(/[\d,]+\s*원/g) || [];
    var max = 0;

    for (var i = 0; i < matches.length; i += 1) {
      max = Math.max(max, parseKrw(matches[i]));
    }

    return max;
  }

  function getVisibleValue() {
    try {
      return findLargestKrwInText(document.body && document.body.innerText);
    } catch (error) {
      return 0;
    }
  }

  function getCartItemCount() {
    try {
      var text = document.body && document.body.innerText || '';

      var m1 = text.match(/상품금액\(총\s*(\d+)\s*개\)/);
      if (m1 && m1[1]) return Number(m1[1]) || 1;

      var m2 = text.match(/일반구매\s*(\d+)/);
      if (m2 && m2[1]) return Number(m2[1]) || 1;

      var selected = document.querySelectorAll('input[type="checkbox"]:checked');
      if (selected && selected.length > 1) return selected.length - 1;

      return 1;
    } catch (error) {
      return 1;
    }
  }

  function getProductId() {
    try {
      var params = new URLSearchParams(location.search);
      return trim(
        params.get('idx') ||
        params.get('product_no') ||
        params.get('productNo') ||
        params.get('product_id') ||
        hashString(location.pathname)
      );
    } catch (error) {
      return hashString(location.pathname);
    }
  }

  function getProductName() {
    var selectors = [
      'h1',
      '.prod_title',
      '.product-title',
      '.goods-name',
      '.item_detail_tit',
      '[data-product-name]'
    ];

    for (var i = 0; i < selectors.length; i += 1) {
      try {
        var el = document.querySelector(selectors[i]);
        var text = trim(el && (el.getAttribute('data-product-name') || el.innerText || el.textContent));
        if (text) return text.slice(0, 120);
      } catch (error) {}
    }

    try {
      return trim(document.title).slice(0, 120);
    } catch (error) {
      return '';
    }
  }

  function getSelectedPaymentMethod() {
    var behavior = readSessionJson(CONFIG.behaviorKey);
    if (trim(behavior.selected_payment_method)) return trim(behavior.selected_payment_method);

    try {
      var checked = document.querySelectorAll('input[type="radio"]:checked, input[type="checkbox"]:checked, select');

      for (var i = 0; i < checked.length; i += 1) {
        var el = checked[i];
        var near = '';

        if (el.tagName && el.tagName.toLowerCase() === 'select') {
          var opt = el.options && el.selectedIndex >= 0 ? el.options[el.selectedIndex] : null;
          near = opt ? (opt.innerText || opt.textContent || opt.value || '') : '';
        } else {
          var cursor = el;
          var depth = 0;
          while (cursor && depth < 4) {
            near += ' ' + (cursor.innerText || cursor.textContent || '');
            cursor = cursor.parentElement;
            depth += 1;
          }
        }

        near = near.toLowerCase();

        if (/신용카드|카드|credit|card/.test(near)) return 'card';
        if (/가상계좌|virtual/.test(near)) return 'virtual_account';
        if (/무통장|계좌이체|bank/.test(near)) return 'bank_transfer';
        if (/네이버페이|naverpay|npay|naver pay/.test(near)) return 'npay';
        if (/토스|toss/.test(near)) return 'toss';
        if (/카카오|kakao/.test(near)) return 'kakao';
      }

      var text = trim(document.body && document.body.innerText).toLowerCase();

      /*
        Conservative fallback from page text.
      */
      if (/신용카드|카드|credit|card/.test(text)) return 'card';
      if (/가상계좌|virtual/.test(text)) return 'virtual_account';
      if (/무통장|계좌이체|bank/.test(text)) return 'bank_transfer';
      if (/네이버페이|naverpay|npay|naver pay/.test(text)) return 'npay';

      return '';
    } catch (error) {
      return '';
    }
  }

  function isAddToCartElement(element) {
    try {
      var cursor = element;
      var depth = 0;

      while (cursor && depth < 6) {
        var text = [
          cursor.innerText || '',
          cursor.textContent || '',
          cursor.id || '',
          typeof cursor.className === 'string' ? cursor.className : '',
          cursor.getAttribute && cursor.getAttribute('aria-label') || '',
          cursor.getAttribute && cursor.getAttribute('title') || '',
          cursor.getAttribute && cursor.getAttribute('data-type') || '',
          cursor.getAttribute && cursor.getAttribute('data-name') || '',
          cursor.getAttribute && cursor.getAttribute('onclick') || ''
        ].join(' ');

        if (/장바구니|담기|cart|add.?to.?cart|basket/i.test(text)) return true;

        cursor = cursor.parentElement;
        depth += 1;
      }

      return false;
    } catch (error) {
      return false;
    }
  }

  function countNetworkEvent(eventName) {
    try {
      var entries = performance.getEntriesByType('resource') || [];
      var count = 0;

      for (var i = 0; i < entries.length; i += 1) {
        var name = String(entries[i].name || '');
        if (name.indexOf('facebook.com/tr') === -1) continue;
        if (name.indexOf('id=' + CONFIG.pixelId) === -1) continue;
        if (
          name.indexOf('ev=' + encodeURIComponent(eventName)) !== -1 ||
          name.indexOf('ev=' + eventName) !== -1
        ) {
          count += 1;
        }
      }

      return count;
    } catch (error) {
      return 0;
    }
  }

  function buildCustomData(eventName, baseData) {
    var data = baseData || {};

    var out = {
      currency: 'KRW'
    };

    if (data.value) out.value = data.value;
    if (data.content_type) out.content_type = data.content_type;
    if (data.content_ids) out.content_ids = data.content_ids;
    if (data.content_name) out.content_name = data.content_name;
    if (data.num_items) out.num_items = data.num_items;
    if (data.payment_method) out.payment_method = data.payment_method;

    /*
      Diagnostic only. Safe, no raw id.
    */
    out.fallback_source = 'biocom_block4_v0_5';
    out.snippet_version = CONFIG.snippetVersion;
    out.event_family = 'browser_funnel_fallback';

    return out;
  }

  function buildBeaconUrl(eventName, eventId, customData) {
    var params = new URLSearchParams();

    params.set('id', CONFIG.pixelId);
    params.set('ev', eventName);
    params.set('dl', sanitizeUrl(location.href));
    params.set('rl', sanitizeUrl(document.referrer || ''));
    params.set('if', 'false');
    params.set('ts', String(Date.now()));
    params.set('sw', String(window.screen && window.screen.width || window.innerWidth || 0));
    params.set('sh', String(window.screen && window.screen.height || window.innerHeight || 0));
    params.set('eid', eventId);
    params.set('rqm', 'GET');

    /*
      Keep version-ish params minimal.
      Meta accepts standard pixel GET beacon style.
    */
    params.set('v', '2.9.319');
    params.set('r', 'stable');

    var fbp = readCookie('_fbp');
    var fbc = readCookie('_fbc');

    if (fbp) params.set('fbp', fbp);
    if (fbc) params.set('fbc', fbc);

    var cd = buildCustomData(eventName, customData);

    Object.keys(cd).forEach(function (key) {
      var value = cd[key];

      if (value === undefined || value === null || value === '') return;

      if (Array.isArray(value)) {
        params.set('cd[' + key + ']', JSON.stringify(value));
      } else {
        params.set('cd[' + key + ']', String(value));
      }
    });

    return CONFIG.endpoint + '?' + params.toString();
  }

  function sendImageBeacon(eventName, dedupeKey, customData) {
    if (CONFIG.forbiddenEvents[eventName]) {
      appendDecision(eventName, 'blocked_forbidden_event', { dedupeKey: dedupeKey });
      log('blocked forbidden event', eventName);
      return false;
    }

    if (!CONFIG.allowedEvents[eventName]) {
      appendDecision(eventName, 'blocked_not_allowed_event', { dedupeKey: dedupeKey });
      log('blocked not allowed event', eventName);
      return false;
    }

    var beforeCount = countNetworkEvent(eventName);

    if (beforeCount > 0) {
      appendDecision(eventName, 'skip_network_already_exists', {
        dedupeKey: dedupeKey,
        networkCountBefore: beforeCount
      });
      log('skip, network already exists', eventName, beforeCount);
      return false;
    }

    if (hasSent(dedupeKey)) {
      appendDecision(eventName, 'skip_session_dedupe', {
        dedupeKey: dedupeKey,
        networkCountBefore: beforeCount
      });
      log('skip, session dedupe', eventName, dedupeKey);
      return false;
    }

    var eventId = buildEventId(eventName, dedupeKey);
    var url = buildBeaconUrl(eventName, eventId, customData);

    var img = new Image(1, 1);
    img.referrerPolicy = 'origin';
    img.alt = '';
    img.src = url;

    /*
      Keep reference so browser does not garbage collect before request starts.
    */
    window.__BIOCOM_META_FUNNEL_IMAGE_BEACONS__.push(img);

    markSent(dedupeKey, eventId);
    storeEventId(eventName, eventId);

    appendDecision(eventName, 'image_beacon_sent', {
      dedupeKey: dedupeKey,
      eventId: eventId,
      networkCountBefore: beforeCount
    });

    log('image beacon sent', eventName, eventId);

    window.setTimeout(function () {
      appendDecision(eventName, 'post_beacon_network_check', {
        dedupeKey: dedupeKey,
        eventId: eventId,
        networkCountAfter: countNetworkEvent(eventName)
      });
    }, CONFIG.postCheckMs);

    return true;
  }

  function resolveCustomData(customDataOrFactory) {
    try {
      if (typeof customDataOrFactory === 'function') {
        return customDataOrFactory() || {};
      }
      return customDataOrFactory || {};
    } catch (error) {
      appendDecision('Block4', 'custom_data_resolve_failed', {
        message: error && error.message ? error.message : String(error || '')
      });
      return {};
    }
  }

  function shouldWaitForValue(eventName, customData) {
    if (eventName !== 'InitiateCheckout' && eventName !== 'AddPaymentInfo') return false;
    if (!isShopPaymentPage() || isCompletionPage()) return false;
    return !customData || !customData.value;
  }

  function sendFallbackWithValueRetry(eventName, dedupeKey, customDataOrFactory, attemptIndex) {
    var index = Math.max(0, Number(attemptIndex || 0));
    var customData = resolveCustomData(customDataOrFactory);

    if (shouldWaitForValue(eventName, customData) && index < CONFIG.valueRetryMs.length - 1) {
      var nextIndex = index + 1;
      var delayMs = CONFIG.valueRetryMs[nextIndex];

      appendDecision(eventName, 'wait_value_retry', {
        dedupeKey: dedupeKey,
        attemptIndex: index,
        nextAttemptIndex: nextIndex,
        nextDelayMs: delayMs
      });

      window.setTimeout(function () {
        sendFallbackWithValueRetry(eventName, dedupeKey, customDataOrFactory, nextIndex);
      }, delayMs);
      return false;
    }

    return sendImageBeacon(eventName, dedupeKey, customData);
  }

  function sendFallbackLater(eventName, dedupeKey, customDataOrFactory) {
    window.setTimeout(function () {
      sendFallbackWithValueRetry(eventName, dedupeKey, customDataOrFactory, 0);
    }, CONFIG.nativeObserveMs);
  }

  function getProductParams() {
    var value = getVisibleValue();
    var productId = getProductId();

    var payload = {
      content_type: 'product',
      content_ids: [String(productId)]
    };

    var name = getProductName();
    if (name) payload.content_name = name;
    if (value) payload.value = value;

    return payload;
  }

  function getCheckoutParams() {
    var value = getVisibleValue();

    var payload = {
      content_type: 'product',
      num_items: getCartItemCount()
    };

    if (value) payload.value = value;

    return payload;
  }

  function maybeAddToCartFromCartPage() {
    if (!isCartPage()) return;

    var text = document.body && document.body.innerText || '';
    if (!/장바구니|일반구매|주문금액|상품금액/i.test(text)) return;

    sendFallbackLater(
      'AddToCart',
      'cartpage:' + hashString(getPath() + ':' + getVisibleValue() + ':' + getCartItemCount()),
      getProductParams()
    );
  }

  function installAddToCartClickListener() {
    document.addEventListener('click', function (event) {
      if (!isAddToCartElement(event.target)) return;

      sendFallbackLater(
        'AddToCart',
        'click:' + hashString(getHref() + ':' + getVisibleValue()),
        getProductParams()
      );
    }, true);
  }

  function maybeInitiateCheckout() {
    if (!isShopPaymentPage()) return;
    if (isCompletionPage()) return;

    sendFallbackLater(
      'InitiateCheckout',
      'checkout:' + getCheckoutId(),
      getCheckoutParams
    );
  }

  function maybeAddPaymentInfo() {
    if (!isShopPaymentPage()) return;
    if (isCompletionPage()) return;

    var method = getSelectedPaymentMethod();
    if (!method) return;

    sendFallbackLater(
      'AddPaymentInfo',
      'paymentinfo:' + getCheckoutId() + ':' + method,
      function () {
        var payload = getCheckoutParams();
        payload.payment_method = getSelectedPaymentMethod() || method;
        return payload;
      }
    );
  }

  function boot() {
    installAddToCartClickListener();

    /*
      These cover:
      - User lands on cart page after adding item.
      - User lands on /shop_payment/ checkout page.
      - Payment method is already selected or becomes selected later.
    */
    maybeAddToCartFromCartPage();
    maybeInitiateCheckout();
    maybeAddPaymentInfo();

    document.addEventListener('click', function () {
      window.setTimeout(maybeAddPaymentInfo, 300);
    }, true);

    document.addEventListener('change', function () {
      window.setTimeout(maybeAddPaymentInfo, 300);
    }, true);

    appendDecision('Block4', 'boot', {
      url_class: isShopPaymentPage() ? 'shop_payment' : (isCartPage() ? 'cart' : 'other')
    });

    log('Block4 v0.5 image beacon fallback booted');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
</script>
```
