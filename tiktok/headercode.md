# TikTok Purchase Guard v2 Header Code

작성 시각: 2026-04-23 21:30 KST
버전: 2026-04-23.tiktok-purchase-guard-enforce.v2-event-log
원본 JS: `tiktok/tiktok_purchase_guard_enforce_v1.js`

## 승인 게이트

이 문서는 **backend 준비 완료 후에만** 아임웹 Header Code에 적용한다. `node --check`만으로는 부족하고, 아래 7개가 모두 맞아야 교체 승인이다.

| 체크 | 기준 |
|---|---|
| backend 배포 | 운영 VM backend 배포 완료 |
| health | `GET /health`가 `status: "ok"` 또는 동등한 정상 응답 |
| event endpoint | `POST /api/attribution/tiktok-pixel-event`가 2xx |
| DB insert | `tiktok_pixel_events`에 실제 row 저장 |
| GET readback | `GET /api/attribution/tiktok-pixel-events?...`에 방금 쓴 row 노출 |
| browser CORS | `biocom.kr` 브라우저에서 cross-origin POST 성공 |
| live source 교체 확인 | live source에서 `2026-04-17.tiktok-purchase-guard-enforce.v1`은 0회, `2026-04-23.tiktok-purchase-guard-enforce.v2-event-log`는 1회 |

## 적용 순서

**운영 VM backend 배포가 먼저다.**

아래 헤더는 `https://att.ainativeos.net/api/attribution/tiktok-pixel-event`가 운영에서 2xx 응답을 낸 뒤에만 아임웹에 붙인다. 현재 운영이 `not_found`이면 먼저 backend를 배포하고 smoke test를 끝낸다.

권장 순서:

1. 운영 VM backend 배포.
2. `GET /health` 확인.
3. 아래 smoke script로 `POST -> DB insert -> GET readback -> CORS header`까지 확인.
4. `biocom.kr` 실제 브라우저 콘솔에서 cross-origin fetch POST 성공 확인.
5. 아임웹 공통 코드 삽입 Header Code에서 기존 `2026-04-17.tiktok-purchase-guard-enforce.v1` 블록을 제거.
6. 아래 v2 블록을 **같은 위치에 1회만** 붙여넣기.
7. live source에서 v1 문자열 0회, v2 문자열 1회 확인.
8. 카드 결제 1건, 가상계좌 미입금 1건으로 이벤트 로그와 Pixel Helper 확인.

## rollout smoke script

로컬 또는 운영에서 아래 스크립트로 backend 준비 여부를 먼저 본다.

```bash
cd /Users/vibetj/coding/seo/backend
node --import tsx scripts/tiktok-pixel-event-smoke.ts --baseUrl https://att.ainativeos.net --origin https://biocom.kr
```

이 스크립트는 아래를 한 번에 확인한다.

- `GET /health`
- `OPTIONS /api/attribution/tiktok-pixel-event` preflight
- `POST /api/attribution/tiktok-pixel-event`
- `GET /api/attribution/tiktok-pixel-events?orderCode=...` readback
- `Access-Control-Allow-Origin` 값

단, 이 스크립트는 backend 준비 상태만 확인한다. **실제 `biocom.kr` 페이지 브라우저에서의 fetch 성공과 live source 교체 확인은 별도 필수**다.

## 브라우저 CORS smoke

`biocom.kr` 실제 페이지 콘솔에서 아래 fetch를 실행한다.

```js
fetch('https://att.ainativeos.net/api/attribution/tiktok-pixel-event', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'smoke_test',
    source: 'manual_browser_test',
    eventName: 'Purchase',
    eventId: 'SmokeTest_20260423',
    orderCode: 'smoke_order_code',
    orderNo: 'smoke_order_no',
    paymentCode: 'smoke_payment_code',
    value: '1000',
    currency: 'KRW',
    url: location.href,
    referrer: document.referrer
  })
})
```

성공 기준:

- 브라우저 fetch가 `TypeError: Failed to fetch` 없이 성공
- 응답 body의 `ok: true`
- `GET /api/attribution/tiktok-pixel-events?orderCode=smoke_order_code`에서 방금 row 확인

## live source 교체 확인

헤더 교체 후에는 실제 페이지 소스에서 아래 두 문자열을 찾는다.

- `2026-04-17.tiktok-purchase-guard-enforce.v1` -> `0회`
- `2026-04-23.tiktok-purchase-guard-enforce.v2-event-log` -> `1회`

v1과 v2가 동시에 있으면 wrapper가 겹칠 수 있으므로, 중복 상태에서는 실결제 검증을 시작하면 안 된다.

## 로그 해석 주의

`tiktok_pixel_events`의 row 수는 구매 수가 아니다. 카드 1건도 `purchase_intercepted -> decision_received -> released_confirmed_purchase`처럼 여러 row가 생길 수 있다.

따라서 운영 해석은 **row count가 아니라 `eventId/orderCode/orderNo/paymentCode` 기준 묶음**으로 본다.

첫 1~2일 모니터링 우선순위:

- `released_confirmed_purchase`
- `blocked_pending_purchase`
- `sent_replacement_place_an_order`
- `released_unknown_purchase`
- `missing_lookup_keys`
- `request_error`

## 붙여넣는 위치

아임웹 관리자 `공통 코드 삽입 > Header Code`.

- Meta `server-payment-decision-guard-v3` 바로 아래.
- GTM/TikTok/아임웹 자동 스크립트보다 위.
- 기존 TikTok Guard v1과 중복 삽입 금지.

## Header Code

```html
<script>
/* TikTok Purchase Guard enforce candidate
 * Version: 2026-04-23.tiktok-purchase-guard-enforce.v2-event-log
 *
 * Blocks only high-confidence pending virtual-account Purchase events.
 * Confirmed Purchase events are released after payment-decision.
 * Unknown/request-error decisions fail open to avoid losing real purchases.
 */
(function (w) {
  "use strict";

  var VERSION = "2026-04-23.tiktok-purchase-guard-enforce.v2-event-log";
  var GUARD_KEY = "__BIOCOM_TIKTOK_PURCHASE_GUARD__";
  var WRAP_KEY = "__BIOCOM_TIKTOK_PURCHASE_GUARD_WRAPPED__";
  var RAW_KEY = "__BIOCOM_TIKTOK_PURCHASE_GUARD_RAW__";
  var ACCESSOR_KEY = "__BIOCOM_TIKTOK_PURCHASE_GUARD_ACCESSOR__";

  if (w[GUARD_KEY] && w[GUARD_KEY].version === VERSION) return;

  var CONFIG = {
    version: VERSION,
    endpoint: "https://att.ainativeos.net/api/attribution/payment-decision",
    eventLogEndpoint: "https://att.ainativeos.net/api/attribution/tiktok-pixel-event",
    enableEventLog: true,
    store: "biocom",
    timeoutMs: 1800,
    scanIntervalMs: 100,
    scanLimitMs: 90000,
    storageKey: "__biocom_tiktok_purchase_guard_decisions__",
    maxRows: 100,
    logPrefix: "[biocom-tiktok-purchase-guard]",
    replacementEventName: "PlaceAnOrder",
    sendReplacementForPending: true,
    allowOnUnknown: true,
    debug: false
  };

  var activeTiktokPixel = w.TIKTOK_PIXEL;
  var activeTtq = w.ttq;
  var state = {
    installedAt: new Date().toISOString(),
    seen: {},
    rows: [],
    wrappers: {
      tiktokPixelTrack: false,
      tiktokPixelInit: false,
      ttqTrack: false
    },
    accessors: {
      TIKTOK_PIXEL: false,
      ttq: false
    },
    wrapCounts: {},
    accessorErrors: {},
    passthroughDepth: 0,
    scanTimer: null
  };

  function safeString(value) {
    if (value === null || value === undefined) return "";
    return String(value).trim();
  }

  function isObject(value) {
    return value !== null && typeof value === "object";
  }

  function firstNonEmpty(values) {
    for (var i = 0; i < values.length; i += 1) {
      var value = safeString(values[i]);
      if (value) return value;
    }
    return "";
  }

  function log(label, payload, force) {
    if (!force && !CONFIG.debug) return;
    if (!w.console || typeof w.console.log !== "function") return;
    if (payload === undefined) {
      w.console.log(CONFIG.logPrefix, label);
      return;
    }
    w.console.log(CONFIG.logPrefix, label, payload);
  }

  function logWrap(label, payload) {
    state.wrapCounts[label] = (state.wrapCounts[label] || 0) + 1;
    if (state.wrapCounts[label] <= 3) log(label, payload);
  }

  function getUrlParam(name, sourceUrl) {
    try {
      return new URL(sourceUrl || w.location.href, w.location.origin).searchParams.get(name) || "";
    } catch (error) {
      return "";
    }
  }

  function extractOrderCode(value) {
    var text = safeString(value);
    var match = text.match(/(o[0-9]{8}[0-9A-Za-z_-]+)/);
    return match ? match[1] : "";
  }

  function readField(source, keys) {
    if (!isObject(source)) return "";
    for (var i = 0; i < keys.length; i += 1) {
      var value = source[keys[i]];
      if (safeString(value)) return safeString(value);
    }
    return "";
  }

  function normalizeEventName(eventName) {
    var name = safeString(eventName);
    if (name === "CompletePayment") return "Purchase";
    return name;
  }

  function extractEventId(params, options) {
    return firstNonEmpty([
      readField(params, ["event_id", "eventID", "eventId"]),
      readField(options, ["event_id", "eventID", "eventId"])
    ]);
  }

  function buildContext(source, eventName, params, options) {
    var href = safeString(w.location.href);
    var referrer = safeString(document.referrer);
    var safeParams = isObject(params) ? params : {};
    var safeOptions = isObject(options) ? options : {};
    var eventId = extractEventId(safeParams, safeOptions);
    var orderCode = firstNonEmpty([
      readField(safeParams, ["order_code", "orderCode"]),
      readField(safeOptions, ["order_code", "orderCode"]),
      getUrlParam("order_code", href),
      getUrlParam("orderCode", href),
      getUrlParam("order_code", referrer),
      extractOrderCode(eventId)
    ]);
    var orderNo = firstNonEmpty([
      readField(safeParams, ["order_no", "orderNo", "order_id", "orderId"]),
      readField(safeOptions, ["order_no", "orderNo", "order_id", "orderId"]),
      getUrlParam("order_no", href),
      getUrlParam("orderNo", href),
      getUrlParam("order_id", href),
      getUrlParam("orderId", href)
    ]);
    var paymentCode = firstNonEmpty([
      readField(safeParams, ["payment_code", "paymentCode"]),
      readField(safeOptions, ["payment_code", "paymentCode"]),
      getUrlParam("payment_code", href),
      getUrlParam("paymentCode", href)
    ]);
    var paymentKey = firstNonEmpty([
      readField(safeParams, ["payment_key", "paymentKey"]),
      readField(safeOptions, ["payment_key", "paymentKey"]),
      getUrlParam("payment_key", href),
      getUrlParam("paymentKey", href)
    ]);

    return {
      source: source,
      eventName: normalizeEventName(eventName),
      originalEventName: safeString(eventName),
      eventId: eventId || (orderCode ? "Purchase_" + orderCode : ""),
      orderCode: orderCode,
      orderNo: orderNo,
      paymentCode: paymentCode,
      paymentKey: paymentKey,
      value: readField(safeParams, ["value"]),
      currency: readField(safeParams, ["currency"]) || "KRW",
      url: href
    };
  }

  function buildSeenKey(context) {
    return [
      context.eventName,
      context.orderCode || "",
      context.orderNo || "",
      context.paymentCode || "",
      context.paymentKey ? "paymentKey" : "",
      context.orderCode ? "" : context.eventId
    ].join("|");
  }

  function hasLookupKey(context) {
    return Boolean(context.orderCode || context.orderNo || context.paymentCode || context.paymentKey);
  }

  function buildDecisionUrl(context) {
    var params = new URLSearchParams();
    if (context.orderCode) params.set("orderCode", context.orderCode);
    if (context.orderNo) params.set("orderNo", context.orderNo);
    if (context.paymentCode) params.set("paymentCode", context.paymentCode);
    if (context.paymentKey) params.set("paymentKey", context.paymentKey);
    params.set("store", CONFIG.store);
    params.set("debug", "0");
    return CONFIG.endpoint + "?" + params.toString();
  }

  function queryDecision(context) {
    if (!hasLookupKey(context)) {
      return Promise.resolve({
        ok: false,
        decision: {
          status: "unknown",
          browserAction: "hold_or_block_purchase",
          confidence: "none",
          matchedBy: "missing_lookup_keys",
          reason: "no order/payment keys found"
        }
      });
    }

    var controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timer = controller ? w.setTimeout(function () {
      controller.abort();
    }, CONFIG.timeoutMs) : null;

    return fetch(buildDecisionUrl(context), {
      method: "GET",
      cache: "no-store",
      credentials: "omit",
      signal: controller ? controller.signal : undefined
    }).then(function (response) {
      if (timer) w.clearTimeout(timer);
      if (!response.ok) throw new Error("HTTP " + response.status);
      return response.json();
    }).catch(function (error) {
      if (timer) w.clearTimeout(timer);
      return {
        ok: false,
        decision: {
          status: "unknown",
          browserAction: "hold_or_block_purchase",
          confidence: "none",
          matchedBy: "request_error",
          reason: error && error.message ? error.message : safeString(error)
        }
      };
    });
  }

  function copyForEventLog(value, depth) {
    if (depth > 2) return safeString(value);
    if (value === null || value === undefined) return value;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
    if (Array.isArray(value)) {
      return value.slice(0, 20).map(function (item) {
        return copyForEventLog(item, depth + 1);
      });
    }
    if (!isObject(value)) return safeString(value);

    var result = {};
    Object.keys(value).slice(0, 60).forEach(function (key) {
      result[key] = copyForEventLog(value[key], depth + 1);
    });
    return result;
  }

  function buildTrackingFields() {
    return {
      ttclid: getUrlParam("ttclid"),
      utm_source: getUrlParam("utm_source"),
      utm_medium: getUrlParam("utm_medium"),
      utm_campaign: getUrlParam("utm_campaign"),
      utm_content: getUrlParam("utm_content"),
      utm_term: getUrlParam("utm_term")
    };
  }

  function sendEventLog(action, context, body, params, options, replacementEventName) {
    if (!CONFIG.enableEventLog || !CONFIG.eventLogEndpoint) return;

    try {
      var decision = body && body.decision ? body.decision : {};
      var tracking = buildTrackingFields();
      var payload = {
        action: action,
        clientObservedAt: new Date().toISOString(),
        source: context.source,
        eventName: context.eventName,
        eventId: context.eventId,
        originalEventName: context.originalEventName,
        originalEventId: context.eventId,
        replacementEventName: replacementEventName || "",
        orderCode: context.orderCode,
        orderNo: context.orderNo,
        paymentCode: context.paymentCode,
        paymentKeyPresent: context.paymentKey ? "yes" : "no",
        value: context.value,
        currency: context.currency,
        status: decision.status || "unknown",
        browserAction: decision.browserAction || "unknown",
        matchedBy: decision.matchedBy || "unknown",
        reason: decision.reason || "",
        decision: copyForEventLog(decision, 0),
        params: copyForEventLog(params, 0),
        options: copyForEventLog(options, 0),
        url: context.url,
        referrer: safeString(document.referrer),
        ttclid: tracking.ttclid,
        utm_source: tracking.utm_source,
        utm_medium: tracking.utm_medium,
        utm_campaign: tracking.utm_campaign,
        utm_content: tracking.utm_content,
        utm_term: tracking.utm_term
      };
      var payloadJson = JSON.stringify(payload);
      var sent = false;
      if (w.navigator && typeof w.navigator.sendBeacon === "function" && typeof w.Blob === "function") {
        try {
          sent = w.navigator.sendBeacon(
            CONFIG.eventLogEndpoint,
            new w.Blob([payloadJson], { type: "application/json" })
          );
        } catch (error) {
          sent = false;
        }
      }
      if (!sent && typeof fetch === "function") {
        fetch(CONFIG.eventLogEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payloadJson,
          cache: "no-store",
          keepalive: true,
          credentials: "omit"
        }).catch(function () {
          /* ignore */
        });
      }
    } catch (error) {
      log("event_log_error", {
        action: action,
        message: error && error.message ? error.message : safeString(error)
      });
    }
  }

  function persist() {
    try {
      w.sessionStorage.setItem(CONFIG.storageKey, JSON.stringify(state.rows.slice(-CONFIG.maxRows)));
    } catch (error) {
      /* ignore */
    }
  }

  function record(phase, context, body) {
    var decision = body && body.decision ? body.decision : {};
    var row = {
      at: new Date().toISOString(),
      phase: phase,
      source: context.source,
      eventName: context.eventName,
      eventId: context.eventId,
      orderCode: context.orderCode,
      orderNo: context.orderNo,
      paymentCode: context.paymentCode,
      paymentKeyPresent: context.paymentKey ? "yes" : "no",
      value: context.value,
      currency: context.currency,
      status: decision.status || "unknown",
      browserAction: decision.browserAction || "unknown",
      confidence: decision.confidence || "unknown",
      matchedBy: decision.matchedBy || "unknown",
      reason: decision.reason || ""
    };
    state.rows.push(row);
    persist();
    log(phase, row, phase === "blocked_pending_purchase" || phase === "released_confirmed_purchase");
    return row;
  }

  function withPassthrough(fn) {
    state.passthroughDepth += 1;
    try {
      return fn();
    } finally {
      state.passthroughDepth -= 1;
    }
  }

  function makeReplacementParams(params, context) {
    var sourceParams = isObject(params) ? params : {};
    var nextParams = {};
    Object.keys(sourceParams).forEach(function (key) {
      nextParams[key] = sourceParams[key];
    });
    nextParams.event_id = "PlaceAnOrder_" + (context.orderCode || extractOrderCode(context.eventId) || context.eventId || "unknown");
    nextParams.order_code = context.orderCode;
    nextParams.order_no = context.orderNo;
    nextParams.payment_code = context.paymentCode;
    nextParams.payment_status = "pending";
    nextParams.original_event_name = context.eventName;
    nextParams.original_event_id = context.eventId;
    return nextParams;
  }

  function shouldBlock(decision) {
    return decision && (
      decision.browserAction === "block_purchase_virtual_account" ||
      decision.browserAction === "block_purchase"
    );
  }

  function shouldRelease(decision) {
    if (!decision) return CONFIG.allowOnUnknown;
    if (decision.browserAction === "allow_purchase") return true;
    if (shouldBlock(decision)) return false;
    return CONFIG.allowOnUnknown;
  }

  function handlePurchase(source, eventName, params, options, invokeOriginal, invokeReplacement) {
    if (normalizeEventName(eventName) !== "Purchase") return invokeOriginal();
    if (state.passthroughDepth > 0) return invokeOriginal();

    var context = buildContext(source, eventName, params, options);
    var key = buildSeenKey(context);
    if (state.seen[key]) {
      log("duplicate_purchase_attempt_held", {
        source: source,
        eventId: context.eventId,
        orderCode: context.orderCode
      });
      return undefined;
    }
    state.seen[key] = true;

    log("purchase_intercepted", {
      source: source,
      eventId: context.eventId,
      orderCode: context.orderCode,
      orderNo: context.orderNo,
      paymentCode: context.paymentCode,
      hasPaymentKey: Boolean(context.paymentKey)
    }, true);
    sendEventLog("purchase_intercepted", context, null, params, options);

    queryDecision(context).then(function (body) {
      var decision = body && body.decision ? body.decision : {};
      record("decision_received", context, body);
      sendEventLog("decision_received", context, body, params, options);

      if (shouldRelease(decision)) {
        withPassthrough(invokeOriginal);
        record(decision.browserAction === "allow_purchase" ? "released_confirmed_purchase" : "released_unknown_purchase", context, body);
        sendEventLog(
          decision.browserAction === "allow_purchase" ? "released_confirmed_purchase" : "released_unknown_purchase",
          context,
          body,
          params,
          options
        );
        return;
      }

      record("blocked_pending_purchase", context, body);
      sendEventLog("blocked_pending_purchase", context, body, params, options);
      if (
        CONFIG.sendReplacementForPending &&
        decision.browserAction === "block_purchase_virtual_account" &&
        typeof invokeReplacement === "function"
      ) {
        withPassthrough(function () {
          invokeReplacement(CONFIG.replacementEventName, makeReplacementParams(params, context));
        });
        record("sent_replacement_place_an_order", context, body);
        sendEventLog("sent_replacement_place_an_order", context, body, params, options, CONFIG.replacementEventName);
      }
    });

    return undefined;
  }

  function wrapTrack(owner, ownerName, stateKey) {
    if (!owner || typeof owner.track !== "function") return false;
    if (owner.track[WRAP_KEY] === VERSION) {
      state.wrappers[stateKey] = true;
      return true;
    }

    var originalTrack = owner.track[RAW_KEY] || owner.track;
    var guardedTrack = function (eventName, params, options) {
      var self = this;
      var args = arguments;
      return handlePurchase(
        ownerName + ".track",
        eventName,
        params,
        options,
        function () {
          return originalTrack.apply(self, args);
        },
        function (replacementEventName, replacementParams) {
          return originalTrack.call(self, replacementEventName, replacementParams, options);
        }
      );
    };
    guardedTrack[WRAP_KEY] = VERSION;
    guardedTrack[RAW_KEY] = originalTrack;

    try {
      owner.track = guardedTrack;
    } catch (error) {
      return false;
    }

    state.wrappers[stateKey] = true;
    logWrap("wrapped_" + ownerName + "_track", { version: VERSION });
    return true;
  }

  function wrapTiktokPixelInit(pixel) {
    if (!pixel || typeof pixel.init !== "function") return false;
    if (pixel.init[WRAP_KEY] === VERSION) {
      state.wrappers.tiktokPixelInit = true;
      return true;
    }

    var originalInit = pixel.init[RAW_KEY] || pixel.init;
    var guardedInit = function () {
      var result = originalInit.apply(this, arguments);
      wrapTtq();
      wrapTiktokPixel();
      return result;
    };
    guardedInit[WRAP_KEY] = VERSION;
    guardedInit[RAW_KEY] = originalInit;

    try {
      pixel.init = guardedInit;
    } catch (error) {
      return false;
    }

    state.wrappers.tiktokPixelInit = true;
    logWrap("wrapped_TIKTOK_PIXEL_init", { version: VERSION });
    return true;
  }

  function wrapTiktokPixel() {
    var pixel = activeTiktokPixel || w.TIKTOK_PIXEL;
    var initWrapped = wrapTiktokPixelInit(pixel);
    var trackWrapped = wrapTrack(pixel, "TIKTOK_PIXEL", "tiktokPixelTrack");
    return Boolean(initWrapped || trackWrapped);
  }

  function wrapTtq() {
    var ttq = activeTtq || w.ttq;
    return wrapTrack(ttq, "ttq", "ttqTrack");
  }

  function installAccessor(name, getActive, setActive, afterSet) {
    try {
      var descriptor = Object.getOwnPropertyDescriptor(w, name);
      if (descriptor && descriptor.get && descriptor.get[ACCESSOR_KEY] === VERSION) {
        state.accessors[name] = true;
        return true;
      }
      if (descriptor && descriptor.configurable === false) {
        state.accessorErrors[name] = "non_configurable";
        return false;
      }
      if (descriptor && Object.prototype.hasOwnProperty.call(descriptor, "value")) {
        setActive(descriptor.value);
      }

      var getter = function () {
        return getActive();
      };
      var setter = function (nextValue) {
        setActive(nextValue);
        afterSet(nextValue);
      };
      getter[ACCESSOR_KEY] = VERSION;
      setter[ACCESSOR_KEY] = VERSION;

      Object.defineProperty(w, name, {
        configurable: true,
        enumerable: true,
        get: getter,
        set: setter
      });

      state.accessors[name] = true;
      afterSet(getActive());
      log("accessor_installed_" + name, { version: VERSION });
      return true;
    } catch (error) {
      state.accessorErrors[name] = error && error.message ? error.message : safeString(error);
      return false;
    }
  }

  function installAccessors() {
    installAccessor(
      "TIKTOK_PIXEL",
      function () { return activeTiktokPixel; },
      function (nextValue) { activeTiktokPixel = nextValue; },
      function () { wrapTiktokPixel(); }
    );
    installAccessor(
      "ttq",
      function () { return activeTtq; },
      function (nextValue) { activeTtq = nextValue; },
      function () { wrapTtq(); }
    );
  }

  function scanOnce() {
    wrapTiktokPixel();
    wrapTtq();
  }

  function startScan() {
    var startedAt = Date.now();
    if (state.scanTimer) w.clearInterval(state.scanTimer);

    state.scanTimer = w.setInterval(function () {
      scanOnce();
      if (Date.now() - startedAt > CONFIG.scanLimitMs) {
        w.clearInterval(state.scanTimer);
        state.scanTimer = null;
        log("scan_complete", {
          version: VERSION,
          wrappers: state.wrappers,
          accessors: state.accessors,
          wrapCounts: state.wrapCounts,
          accessorErrors: state.accessorErrors
        });
      }
    }, CONFIG.scanIntervalMs);
  }

  w[GUARD_KEY] = {
    version: VERSION,
    config: CONFIG,
    state: state,
    scanOnce: scanOnce,
    getDecisions: function () {
      return state.rows.slice();
    },
    clearDecisions: function () {
      state.rows = [];
      state.seen = {};
      try {
        w.sessionStorage.removeItem(CONFIG.storageKey);
      } catch (error) {
        /* ignore */
      }
    }
  };

  installAccessors();
  scanOnce();
  startScan();
  w.setTimeout(scanOnce, 0);
  w.setTimeout(scanOnce, 250);
  w.setTimeout(scanOnce, 1000);
  if (document && document.addEventListener) {
    document.addEventListener("DOMContentLoaded", scanOnce);
  }
  if (w.addEventListener) {
    w.addEventListener("load", scanOnce);
  }

  log("installed", {
    version: VERSION,
    scanLimitMs: CONFIG.scanLimitMs,
    sendReplacementForPending: CONFIG.sendReplacementForPending,
    allowOnUnknown: CONFIG.allowOnUnknown
  }, true);
})(window);
</script>
```
