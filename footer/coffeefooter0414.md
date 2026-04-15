# The Clean Coffee — 아임웹 푸터 Tracking Snippet (2026-04-14)

> **원본**: biocom 푸터 (2026-04-11 `checkout-started-v1` + 2026-04-12 `payment-success-order-code-v2`)
> **목적**: 커피 자사몰의 기존 `2026-04-08-coffee-fetchfix-v2` 구버전 footer 를 biocom 수준으로 업그레이드.
> **연관**: [coffee_header_guard_0414.md](coffee_header_guard_0414.md) (커피 header Purchase Guard 별도 파일) · [../meta/capimeta.md](../meta/capimeta.md) §커피 footer 개선 필요성 분석

---

## 이 스크립트가 하는 일 (3 블록)

1. **UTM / 유입 identifier persistence + Formbricks user_id + gtag user_id set** (첫 블록)
2. **`checkout_started` 이벤트** → `POST /api/attribution/checkout-context` 로 결제 시작 시점 식별자 저장 + `checkoutId` 생성 (둘째 블록)
3. **`payment_success` 이벤트** → `POST /api/attribution/payment-success` 로 주문완료 시점 기록 + **`orderCode`/`referrerPayment`/`fbc`/`fbp`/`browser_purchase_event_id`** 전부 포함 (셋째 블록)

## 기존 구버전(`2026-04-08-coffee-fetchfix-v2`) 대비 추가 기능 6가지

1. ✅ **`checkout_started` endpoint 호출** — 기존 구버전에는 완전 부재
2. ✅ **`orderCode` 파싱** — URL + `document.referrer` + sessionStorage + localStorage + DOM 5중 fallback
3. ✅ **`orderMember` 파싱**
4. ✅ **`fbc` / `fbp` 쿠키** — `_fbc`, `_fbp` 를 `checkout_started` 와 `payment_success` 양쪽에 포함 → Meta EMQ 상승
5. ✅ **`browser_purchase_event_id = Purchase.{orderCode}`** metadata 에 직접 생성 → Pixel·CAPI·ledger 3자 디둡 가능
6. ✅ **`referrerPayment` 객체** — URL 파라미터 소실 시 referrer 에서 복원

## 삽입 방법 (⚠️ 중요)

### 🔴 권고: **기존 footer 완전 삭제 후 교체** (append 금지)

**왜 교체가 필요한가**:
1. 기존 coffee footer 의 `payment_success` 블록과 본 스크립트의 `payment_success` 블록이 **같은 endpoint** (`/api/attribution/payment-success`) 로 전송
2. 둘 다 활성화되면 **동일 주문이 ledger 에 2회 적재**되어 `totalEntries` 가 부풀림
3. dedupeKey 가 서로 다른 key prefix 를 사용(`__seo_payment_success_sent__:` 는 공통이지만 localStorage 읽기 값이 다르면 다른 결과)
4. fbc/fbp 쿠키 읽기가 2번 반복되지만 값은 같아 무의미한 중복
5. fetch 가 페이지당 2회 나가면서 네트워크·서버 부하 소폭 증가

**삭제 방법**:
- 아임웹 admin → 디자인 → HTML/CSS 편집 → 푸터 영역
- `2026-04-08-coffee-fetchfix-v2` 키워드로 검색 → 해당 `<script>...</script>` 블록 전체 삭제
- `_p1s1a_session_touch`, `_p1s1a_first_touch`, `_p1s1a_last_touch` 키를 쓰는 첫 블록도 삭제 (본 스크립트의 첫 블록이 대체)
- 저장

**삽입 방법**:
- 아임웹 admin → 디자인 → HTML/CSS 편집 → **푸터 하단** (`<body>` 닫히기 전 위치, 또는 "사이트 전체 푸터" 커스텀 블록)
- 아래 3개 `<script>` 블록을 **통째로** 복사 → 붙여넣기
- 저장

### 🟡 대안: 기존 유지 + 본 스크립트 추가 (비권고)

- `payment_success` 중복 fetch → ledger 중복 적재 위험
- dedupeKey 가 다르면 완전한 중복이 됨
- **ledger totalEntries 부풀리기 + 서버 부하 + 운영 혼선**
- **권고하지 않음**. 테스트 목적으로 잠시 병행할 수는 있으나 24시간 이내 교체 완료 필수.

### ⚠️ localStorage key 호환성 (backward-compat)

본 스크립트는 **기존 `_p1s1a_*` localStorage 키를 그대로 유지**. 즉 교체 후에도 과거 first-touch UTM 데이터가 계속 사용됨. 사용자 브라우저의 historical first-touch 정보가 유실되지 않음.

만약 데이터 초기화를 원하면 별도로 `localStorage.removeItem('_p1s1a_first_touch')` 를 수동 실행해야 함.

---

## 검증 순서 (설치 직후 반드시 확인)

1. **새 탭에서 `https://thecleancoffee.com?utm_source=test&__seo_attribution_debug=1` 열기**
   - 콘솔에 `[seo-attribution]` · `[seo-checkout-started]` · `[seo-user-utm]` 로그가 보여야 함
   - 오류 없어야 함
2. **상품 상세 페이지 진입 → 결제 시작** (결제 진행은 하지 않음, URL 이 `/shop_payment/...` 로 바뀌는지만)
   - Network 탭: `POST /api/attribution/checkout-context` 가 1회 발사되는지 확인. Status 200, response `{ok: true}` 기대
   - Response preview 에 `checkoutId`, `fbc`, `fbp`, `ga_session_id` 가 payload 에 포함됐는지 확인 (`__seo_attribution_debug=1` 모드에서 콘솔에 payload 출력됨)
3. **실제 가상계좌 테스트 주문** (소액)
   - 주문완료 페이지 `shop_payment_complete` 도달 시 Network 탭에서 `POST /api/attribution/payment-success` 가 1회 발사되는지 확인
   - **payload.orderCode** 가 `o2026041...` 로 채워져 있는지 (구버전은 null 이었음)
   - **payload.metadata.browser_purchase_event_id** 가 `Purchase.o2026041...` 로 생성됐는지
   - **payload.fbc / payload.fbp** 가 쿠키 값으로 채워져 있는지
4. **24시간 뒤 ledger 확인**:
   ```bash
   curl -s "https://att.ainativeos.net/api/attribution/ledger?limit=5" | jq '.items[] | select(.source=="thecleancoffee_imweb") | {orderCode, orderId, paymentKey, paymentStatus, loggedAt}'
   ```
   - `orderCode` 필드가 더 이상 null 이 아니어야 함
   - `metadata.browser_purchase_event_id` 가 `Purchase.{orderCode}` 로 채워져야 함

---

## 스크립트 전체 (3 블록 — 통째로 복사)

```html
<!-- thecleancoffee footer - 2026-04-14 upgrade (UTM / checkout_started / payment_success) -->
<!-- 기존 2026-04-08-coffee-fetchfix-v2 구버전을 완전히 교체. append 금지. -->
<!-- Fixed attribution endpoint: https://att.ainativeos.net -->
<!-- GA4 measurement id: G-JLSBXX7300 -->

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
```

---

## 롤백 경로

문제가 생기면:
1. 아임웹 admin → 디자인 → HTML/CSS → 푸터 영역
2. 위 3개 `<script>` 블록 전체 삭제
3. 이전 버전 `2026-04-08-coffee-fetchfix-v2` 스크립트 (원본은 git history 또는 별도 보관소에 있어야 함) 재삽입
4. 저장

**롤백 시 부작용**:
- 새로 쌓인 `orderCode` / `fbc` / `fbp` 데이터는 그대로 ledger 에 남음 (안전)
- `_p1s1a_*` localStorage 는 그대로 유지 (backward-compat 덕에 데이터 호환)
- checkout_started 이벤트만 다시 중단됨

---

## 관련 문서

- [coffee_header_guard_0414.md](coffee_header_guard_0414.md) — 커피 header Purchase Guard (별개 파일, 가상계좌 분리용)
- [header_purchase_guard_server_decision_0412_v3.md](header_purchase_guard_server_decision_0412_v3.md) — biocom header v3 원본
- [footer_new_0411_1.md](footer_new_0411_1.md) — biocom footer 원본
- [../meta/capimeta.md](../meta/capimeta.md) §2026-04-14 커피 footer 개선 필요성 분석
- [../meta/capimeta.md](../meta/capimeta.md) §2026-04-14 가상계좌 입금 전환 테스트 주문 기록 (`order_no 202604144671071`)

---

**요지**: biocom footer (0411/0412 버전) 를 커피로 치환. 기존 `_p1s1a_*` localStorage key 호환 유지해 historical first-touch 데이터 손실 없음. 교체 방식은 **반드시 기존 구버전 삭제 후 삽입** — append 하면 `payment_success` 이벤트가 중복 발사됨. 설치 후 24시간 내 ledger 의 `orderCode` 필드가 null 이 아니게 되는지 확인이 성공 판정 기준.
