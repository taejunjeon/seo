# codefeedback0412 검토 답변

작성 시각: 2026-04-12 KST

## 결론

피드백은 대부분 맞다. 특히 아래 2개는 반드시 반영해야 한다.

- `persistUtm()`이 UTM 없는 페이지에서 기존 UTM을 `0`으로 덮어쓰는 문제
- `payment_success` payload에 `orderCode` / `order_code`가 안정적으로 들어가지 않는 문제

내 의견은 다음과 같다.

- Purchase Guard 방향은 맞다. 이 문제는 서버 CAPI가 아니라 브라우저 Pixel이 미입금 가상계좌를 `Purchase`로 먼저 잡는 문제이므로, 헤더 상단에서 `fbq`를 먼저 감싸는 전략이 현실적이다.
- 다만 Guard는 반드시 GTM/Meta Pixel보다 먼저 들어가야 한다. 푸터에 넣으면 늦을 수 있다.
- 가상계좌 판정은 현재는 텍스트 기반 1차 방어로 간다. 단어 하나만으로 막지 않고, `가상계좌/무통장/계좌번호/입금기한/입금대기` 조합으로 판정하게 보수적으로 유지한다.
- `orderCode`는 CAPI dedup의 핵심 키다. Browser Pixel이 `Purchase.{orderCode}`를 쓰므로, 원장에도 `orderCode`를 넣어야 Browser Pixel / Server CAPI / 내부 Attribution을 같은 주문으로 묶을 수 있다.
- 상품명 API는 지금 1순위가 아니다. 상품명은 브라우저 DOM에서 긁기보다 서버에서 아임웹 주문 상세 기준으로 스냅샷 저장하는 쪽이 맞다.

## 배포 순서

1. 아임웹 헤더 코드 최상단에 Purchase Guard를 넣는다.
2. 기존 GTM, Meta Pixel, 기타 태그는 그 아래에 둔다.
3. 푸터의 user_id/UTM/rebuyz_view 블록은 아래 새 코드로 교체한다.
4. 푸터의 `payment_success` 블록에는 `orderCode`, `orderMember`, `referrerPayment` 추가 패치를 반영한다.
5. 카드 결제 주문완료와 가상계좌 미입금 주문완료를 각각 Pixel Helper로 확인한다.

## 새 코드 1. 헤더 상단 Purchase Guard

아래 코드는 `footer/header_purchase_guard_0412.md`와 같은 목적이다. 아임웹 **헤더 코드 상단**, GTM/Meta Pixel보다 위에 넣는다.

```html
<script>
(function () {
  var CONFIG = {
    snippetVersion: '2026-04-12-vbank-purchase-guard-v1',
    vbankEventName: 'VirtualAccountIssued',
    holdMs: 700,
    logPrefix: '[biocom-purchase-guard]'
  };

  function safeString(value) {
    if (value === null || value === undefined) return '';
    return String(value);
  }

  function lower(value) {
    return safeString(value).toLowerCase();
  }

  function isPaymentCompletePage() {
    var path = lower(window.location.pathname);
    return path.indexOf('shop_payment_complete') >= 0 || path.indexOf('shop_order_done') >= 0;
  }

  if (!isPaymentCompletePage()) return;
  if (window.__BIOCOM_PURCHASE_GUARD_INSTALLED__) return;
  window.__BIOCOM_PURCHASE_GUARD_INSTALLED__ = true;

  function getSearchParam(keys, sourceUrl) {
    try {
      var url = new URL(sourceUrl || window.location.href, window.location.origin);
      for (var i = 0; i < keys.length; i += 1) {
        var value = url.searchParams.get(keys[i]);
        if (value) return value;
      }
    } catch (error) {
      return '';
    }
    return '';
  }

  function firstNonEmpty(values) {
    for (var i = 0; i < values.length; i += 1) {
      var value = safeString(values[i]).trim();
      if (value) return value;
    }
    return '';
  }

  function getOrderCodeFromEventId(eventId) {
    var value = safeString(eventId);
    var match = value.match(/^Purchase\.(o[0-9A-Za-z_-]+)$/);
    return match ? match[1] : '';
  }

  function getEventIdFromArgs(args) {
    var options = args[3] && typeof args[3] === 'object' ? args[3] : undefined;
    if (lower(args[0]) === 'tracksingle') {
      options = args[4] && typeof args[4] === 'object' ? args[4] : options;
    }
    return options && options.eventID ? safeString(options.eventID) : '';
  }

  function getPurchaseParamsFromArgs(args) {
    if (lower(args[0]) === 'tracksingle') {
      return args[3] && typeof args[3] === 'object' ? args[3] : {};
    }
    return args[2] && typeof args[2] === 'object' ? args[2] : {};
  }

  function getOrderContext(args) {
    var eventId = getEventIdFromArgs(args);
    var orderCode = firstNonEmpty([
      getSearchParam(['order_code', 'orderCode']),
      getSearchParam(['orderCode', 'order_code'], document.referrer),
      getOrderCodeFromEventId(eventId)
    ]);
    var orderNo = firstNonEmpty([
      getSearchParam(['order_no', 'orderNo', 'order_id', 'orderId']),
      getSearchParam(['orderNo', 'order_no', 'orderId', 'order_id'], document.referrer)
    ]);
    var paymentCode = firstNonEmpty([
      getSearchParam(['payment_code', 'paymentCode']),
      getSearchParam(['paymentCode', 'payment_code'], document.referrer)
    ]);
    var paymentKey = firstNonEmpty([
      getSearchParam(['paymentKey', 'payment_key']),
      getSearchParam(['paymentKey', 'payment_key'], document.referrer)
    ]);

    return {
      eventId: eventId,
      orderCode: orderCode,
      orderNo: orderNo,
      paymentCode: paymentCode,
      paymentKey: paymentKey
    };
  }

  function getPageText() {
    return lower([
      document.title,
      document.body ? document.body.innerText : '',
      document.body ? document.body.textContent : ''
    ].join(' '));
  }

  function isLikelyUnpaidVirtualAccount() {
    var text = getPageText();
    var strongMarkers = ['가상계좌', '무통장', '계좌번호', '입금기한', '입금자'];
    var weakMarkers = ['입금 대기', '입금대기', '입금 확인', '입금확인'];
    var confirmedMarkers = [
      '신용카드',
      '카드결제',
      '카드 결제',
      '간편결제',
      '네이버페이',
      '카카오페이',
      '토스페이',
      '휴대폰 결제',
      '휴대폰결제'
    ];
    var strongCount = strongMarkers.reduce(function (count, marker) {
      return count + (text.indexOf(marker) >= 0 ? 1 : 0);
    }, 0);
    var weakCount = weakMarkers.reduce(function (count, marker) {
      return count + (text.indexOf(marker) >= 0 ? 1 : 0);
    }, 0);
    var hasConfirmedNonVbankMarker = confirmedMarkers.some(function (marker) {
      return text.indexOf(marker) >= 0;
    });
    var hasVirtualAccountMarker = (
      strongCount >= 2 ||
      ((text.indexOf('가상계좌') >= 0 || text.indexOf('무통장') >= 0) && weakCount >= 1) ||
      (text.indexOf('계좌번호') >= 0 && text.indexOf('입금') >= 0)
    );
    var hasConfirmedCardMarker = (
      text.indexOf('신용카드') >= 0 ||
      text.indexOf('카드결제') >= 0 ||
      text.indexOf('카드 결제') >= 0
    );

    return hasVirtualAccountMarker && !hasConfirmedCardMarker && !hasConfirmedNonVbankMarker;
  }

  function isPurchaseCall(args) {
    var command = lower(args[0]);
    if (command === 'track') return args[1] === 'Purchase';
    if (command === 'tracksingle') return args[2] === 'Purchase';
    return false;
  }

  function copyProperties(from, to) {
    if (!from || !to) return;
    Object.keys(from).forEach(function (key) {
      try {
        if (key !== 'callMethod') to[key] = from[key];
      } catch (error) {}
    });
  }

  function buildVirtualAccountArgs(originalArgs) {
    var command = lower(originalArgs[0]);
    var purchaseParams = getPurchaseParamsFromArgs(originalArgs);
    var context = getOrderContext(originalArgs);
    var params = {};

    Object.keys(purchaseParams || {}).forEach(function (key) {
      params[key] = purchaseParams[key];
    });

    params.payment_status = 'pending';
    params.payment_method = 'virtual_account';
    params.order_code = context.orderCode;
    params.order_no = context.orderNo;
    params.payment_code = context.paymentCode;
    params.payment_key = context.paymentKey;
    params.snippet_version = CONFIG.snippetVersion;

    var eventIdBase = firstNonEmpty([context.orderCode, context.orderNo, context.paymentCode, String(Date.now())]);
    var options = { eventID: CONFIG.vbankEventName + '.' + eventIdBase };

    if (command === 'tracksingle') {
      return ['trackSingleCustom', originalArgs[1], CONFIG.vbankEventName, params, options];
    }
    return ['trackCustom', CONFIG.vbankEventName, params, options];
  }

  function rememberBlocked(args) {
    var context = getOrderContext(args);
    var key = firstNonEmpty([context.orderCode, context.orderNo, context.paymentCode, context.eventId, String(Date.now())]);
    try {
      window.sessionStorage.setItem('__biocom_purchase_guard_blocked__:' + key, JSON.stringify({
        blockedAt: new Date().toISOString(),
        reason: 'unpaid_virtual_account',
        snippetVersion: CONFIG.snippetVersion,
        location: window.location.href,
        referrer: document.referrer,
        eventId: context.eventId,
        orderCode: context.orderCode,
        orderNo: context.orderNo,
        paymentCode: context.paymentCode,
        paymentKey: context.paymentKey
      }));
    } catch (error) {}
  }

  function defineProxyProperty(target, source, key, fallbackValue) {
    try {
      Object.defineProperty(target, key, {
        configurable: true,
        get: function () {
          return source[key] === undefined ? fallbackValue : source[key];
        },
        set: function (nextValue) {
          source[key] = nextValue;
        }
      });
    } catch (error) {
      target[key] = source[key] === undefined ? fallbackValue : source[key];
    }
  }

  function blockAndSendVirtualAccount(dispatch, args) {
    rememberBlocked(args);
    var customArgs = buildVirtualAccountArgs(args);
    try {
      dispatch(customArgs);
    } catch (error) {
      if (window.console && console.warn) {
        console.warn(CONFIG.logPrefix, 'VirtualAccountIssued send failed', error);
      }
    }
    if (window.console && console.info) {
      console.info(CONFIG.logPrefix, 'Blocked unpaid virtual account Purchase', getOrderContext(args));
    }
    return undefined;
  }

  function wrapFbq(originalFbq) {
    if (typeof originalFbq !== 'function') return originalFbq;
    if (originalFbq.__BIOCOM_PURCHASE_GUARD_WRAPPED__) return originalFbq;

    var guardedCallMethod;

    function guardedFbq() {
      var thisArg = this;
      var args = Array.prototype.slice.call(arguments);

      if (!isPurchaseCall(args)) {
        return dispatch(args, thisArg);
      }

      window.setTimeout(function () {
        if (isLikelyUnpaidVirtualAccount()) {
          blockAndSendVirtualAccount(function (nextArgs) {
            return dispatch(nextArgs, thisArg);
          }, args);
        } else {
          dispatch(args, thisArg);
        }
      }, CONFIG.holdMs);

      return undefined;
    }

    function dispatch(args, thisArg) {
      if (typeof guardedFbq.callMethod === 'function' && guardedFbq.callMethod !== guardedCallMethod) {
        return guardedFbq.callMethod.apply(guardedFbq, args);
      }
      if (typeof originalFbq.callMethod === 'function') {
        return originalFbq.callMethod.apply(originalFbq, args);
      }
      return originalFbq.apply(thisArg || originalFbq, args);
    }

    copyProperties(originalFbq, guardedFbq);
    guardedFbq.__BIOCOM_PURCHASE_GUARD_WRAPPED__ = true;
    guardedFbq.push = guardedFbq;
    defineProxyProperty(guardedFbq, originalFbq, 'loaded', originalFbq.loaded);
    defineProxyProperty(guardedFbq, originalFbq, 'version', originalFbq.version);
    defineProxyProperty(guardedFbq, originalFbq, 'queue', originalFbq.queue || []);

    guardedCallMethod = function () {
      return guardedFbq.apply(guardedFbq, arguments);
    };
    guardedFbq.callMethod = guardedCallMethod;

    return guardedFbq;
  }

  var activeFbq = typeof window.fbq === 'function' ? wrapFbq(window.fbq) : undefined;

  try {
    Object.defineProperty(window, 'fbq', {
      configurable: true,
      get: function () {
        return activeFbq;
      },
      set: function (nextFbq) {
        activeFbq = wrapFbq(nextFbq);
      }
    });
  } catch (error) {
    if (typeof window.fbq === 'function') {
      window.fbq = wrapFbq(window.fbq);
    }
  }

  if (window.console && console.info) {
    console.info(CONFIG.logPrefix, 'installed', CONFIG.snippetVersion);
  }
})();
</script>
```

## 새 코드 2. 푸터 user_id / UTM / rebuyz_view 교체 블록

기존 푸터의 첫 번째 `getUserID/waitForGtagAndSetUser/persistUtm` 스크립트와 두 번째 `sendView` 스크립트를 아래 하나로 교체한다.

핵심 수정:

- URL에 실제 UTM/fbclid/gclid/ttclid 중 하나라도 있을 때만 저장한다.
- `0` placeholder를 저장하지 않는다.
- first-touch와 latest-touch를 분리한다.
- 기존 `rebuyz_utm`은 호환용 latest-touch로 유지한다.
- `gtag` 대기는 최대 5초까지만 한다.
- 로그는 `?__seo_attribution_debug=1`일 때만 출력한다.

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

## 새 코드 3. `payment_success`에 orderCode 추가

기존 `payment_success` 스크립트 전체를 갈아엎을 필요는 없다. 아래 블록만 추가/교체하면 된다.

### 3-1. `getSearchParam()` 아래에 추가

```js
function getSearchParamFromUrl(keys, urlLike) {
  try {
    if (!urlLike) return '';
    var params = new URL(urlLike, location.origin).searchParams;
    for (var i = 0; i < keys.length; i += 1) {
      var value = trim(params.get(keys[i]));
      if (value) return value;
    }
  } catch (error) {
    return '';
  }
  return '';
}

function parsePaymentParamsFromUrl(urlLike) {
  return {
    orderCode: getSearchParamFromUrl(['orderCode', 'order_code'], urlLike),
    orderNo: getSearchParamFromUrl(['orderNo', 'order_no'], urlLike),
    orderId: getSearchParamFromUrl(['orderId', 'order_id'], urlLike),
    paymentCode: getSearchParamFromUrl(['paymentCode', 'payment_code'], urlLike),
    paymentKey: getSearchParamFromUrl(['paymentKey', 'payment_key'], urlLike),
    amount: getSearchParamFromUrl(['amount', 'totalAmount', 'total_amount'], urlLike)
  };
}
```

### 3-2. `orderId` / `paymentKey` 계산부 근처에 추가

```js
var referrerPayment = parsePaymentParamsFromUrl(document.referrer);

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
  getSearchParamFromUrl(['order_member', 'orderMember'], document.referrer),
  trim(imwebSession.orderMember),
  trim(imwebSession.order_member),
  trim(lastTouch.orderMember),
  trim(lastTouch.order_member)
]);
```

### 3-3. dedupeKey 계산부 교체

기존:

```js
var dedupeKey = CONFIG.dedupeKeyPrefix + firstNonEmpty([
  orderId,
  paymentKey,
  location.pathname + '::' + document.referrer
]);
```

교체:

```js
var dedupeKey = CONFIG.dedupeKeyPrefix + firstNonEmpty([
  orderId,
  paymentKey,
  orderCode,
  location.pathname + '::' + document.referrer
]);
```

### 3-4. payload에 추가

기존 payload의 `paymentKey`, `checkoutId` 근처에 아래 값을 추가한다.

```js
orderCode: orderCode,
orderMember: orderMember,
```

### 3-5. metadata에 추가

기존 metadata에 아래 값을 추가한다. 현재 백엔드 정규화 로직은 `orderCode`를 독립 컬럼으로 저장하지 않지만 `metadata`는 보존한다. 그래서 `metadata.orderCode`와 `metadata.referrerPayment.orderCode`가 중요하다.

```js
orderCode: orderCode,
order_code: orderCode,
orderMember: orderMember,
order_member: orderMember,
browser_purchase_event_id: orderCode ? 'Purchase.' + orderCode : '',
referrerPayment: {
  orderCode: orderCode || trim(referrerPayment.orderCode),
  orderNo: orderId || trim(referrerPayment.orderNo),
  orderId: trim(referrerPayment.orderId),
  paymentCode: trim(referrerPayment.paymentCode),
  paymentKey: paymentKey || trim(referrerPayment.paymentKey),
  amount: trim(referrerPayment.amount)
}
```

## 반영 후 확인할 값

### 카드 결제 완료

- Browser Pixel Helper: `Purchase` 유지
- Browser Event ID: `Purchase.{orderCode}`
- local ledger `metadata.orderCode`: 값 있음
- local ledger `metadata.referrerPayment.orderCode`: 값 있음
- Server CAPI event_id: `Purchase.{orderCode}`

### 가상계좌 미입금 완료

- Browser Pixel Helper: `Purchase` 없음
- Browser Pixel Helper: `VirtualAccountIssued` 있음
- local ledger `payment_status`: `pending`
- Server CAPI: 운영 `Purchase` 전송 없음

## 아직 다음 단계로 남길 것

- 서버 상태 조회 API 기반 confirmed-only Browser Purchase 통과는 2차 개선이다.
- 상품명/상품 ID는 아임웹 주문 상세 API 또는 주문 스냅샷 기준으로 서버에서 보강한다.
- 기존 헤더의 네이버/GTM/verification/TikTok 정리는 이번 배포에 섞지 않는다. 이번 배포는 Guard + UTM overwrite fix + orderCode 추가만 한다.

## 작성 후 로컬 검증

- Header Purchase Guard는 기존에 `node --check /tmp/biocom_purchase_guard_0412.js`로 문법 확인했다.
- 이 문서의 `user_id / UTM / rebuyz_view` 교체 블록은 `/tmp/biocom_utm_rebuyz_v2.js`로 추출해 `node --check`를 통과했다.
- `payment_success`는 부분 패치 코드라 단독 실행 문법 검사는 하지 않았다. 실제 반영 시 기존 `payment_success` 스크립트 안에서 지정 위치에 넣어야 한다.
