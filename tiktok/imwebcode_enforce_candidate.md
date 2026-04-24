# TikTok Purchase Guard enforce v1 Imweb 삽입 후보

> 2026-04-23 주의: 이 문서는 2026-04-17 v1 운영 적용 기록이다. 이벤트 단위 로깅까지 포함한 최신 후보는 `tiktok/tiktok_purchase_guard_enforce_v1.js`의 `2026-04-23.tiktok-purchase-guard-enforce.v2-event-log` 버전을 기준으로 한다. 운영 VM에 `POST /api/attribution/tiktok-pixel-event` 배포가 끝나기 전에는 v2를 아임웹에 붙이지 않는다.

작성일: 2026-04-17

## 현재 판단

dry-run v3는 가상계좌 미입금 주문에서 TikTok `Purchase` 호출을 정상 감지했다.

확인된 값:

| 항목 | 값 |
|---|---|
| order_code | `o20260416468f86bc166d8` |
| order_no | `202604171284269` |
| payment_code | `pa2026041647d45f38b315f` |
| dry-run 로그 | `purchase_seen`, `dry_run_observed_purchase` 확인 |
| 서버 판정 | `pending / block_purchase_virtual_account` |
| matchedBy | `toss_direct_order_id` |

따라서 다음 단계는 dry-run이 아니라 실제 차단 후보다. 이 문서는 바로 붙여넣을 수 있는 enforce 후보 코드다.

## 적용 전 확인

아직 운영 적용 전 후보로 둔다. 먼저 dry-run v3 상태에서 카드 결제 1건이 `confirmed / allow_purchase`로 잡히는지 확인한 뒤 적용한다.

## 해야 할 작업

아임웹에 넣은 기존 `2026-04-17.tiktok-purchase-guard-dry-run.v3` 블록을 아래 enforce v1 블록으로 **교체**한다.

추가로 하나 더 붙이지 않는다. 기존 v3를 지우고 enforce v1만 남긴다.

## 붙여넣는 위치

아임웹 관리자 `공통 코드 삽입`의 **Header Code 삽입** 영역.

1. Meta `server-payment-decision-guard-v3` 코드 바로 아래
2. GTM/TikTok/아임웹 스크립트보다 위
3. 기존 dry-run v3 TikTok Guard 블록은 제거
4. 아래 enforce v1 전체를 붙여넣기

## 동작 기준

| 케이스 | 동작 |
|---|---|
| 카드 결제 confirmed | 판정 후 원래 TikTok `Purchase` 전송 |
| 가상계좌 미입금 pending | TikTok `Purchase` 차단 |
| 가상계좌 미입금 pending | 대체 이벤트 `PlaceAnOrder` 전송 |
| 판정 실패/unknown | 안전상 원래 `Purchase` 전송 |

## 삽입할 코드

아래 전체를 그대로 붙여넣는다.

```html
<script>
/* TikTok Purchase Guard enforce candidate
 * Version: 2026-04-17.tiktok-purchase-guard-enforce.v1
 *
 * Blocks only high-confidence pending virtual-account Purchase events.
 * Confirmed Purchase events are released after payment-decision.
 * Unknown/request-error decisions fail open to avoid losing real purchases.
 */
(function (w) {
  "use strict";

  var VERSION = "2026-04-17.tiktok-purchase-guard-enforce.v1";
  var GUARD_KEY = "__BIOCOM_TIKTOK_PURCHASE_GUARD__";
  var WRAP_KEY = "__BIOCOM_TIKTOK_PURCHASE_GUARD_WRAPPED__";
  var RAW_KEY = "__BIOCOM_TIKTOK_PURCHASE_GUARD_RAW__";
  var ACCESSOR_KEY = "__BIOCOM_TIKTOK_PURCHASE_GUARD_ACCESSOR__";

  if (w[GUARD_KEY] && w[GUARD_KEY].version === VERSION) return;

  var CONFIG = {
    version: VERSION,
    endpoint: "https://att.ainativeos.net/api/attribution/payment-decision",
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

    queryDecision(context).then(function (body) {
      var decision = body && body.decision ? body.decision : {};
      record("decision_received", context, body);

      if (shouldRelease(decision)) {
        withPassthrough(invokeOriginal);
        record(decision.browserAction === "allow_purchase" ? "released_confirmed_purchase" : "released_unknown_purchase", context, body);
        return;
      }

      record("blocked_pending_purchase", context, body);
      if (
        CONFIG.sendReplacementForPending &&
        decision.browserAction === "block_purchase_virtual_account" &&
        typeof invokeReplacement === "function"
      ) {
        withPassthrough(function () {
          invokeReplacement(CONFIG.replacementEventName, makeReplacementParams(params, context));
        });
        record("sent_replacement_place_an_order", context, body);
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

## 적용 후 확인

가상계좌 미입금 주문 생성 후 콘솔에서 아래를 확인한다.

`purchase_intercepted`
`decision_received`
`blocked_pending_purchase`
`sent_replacement_place_an_order`

TikTok Pixel Helper에서는 가상계좌 미입금 주문에 `Purchase`가 보이면 안 된다. `PlaceAnOrder` 수신 여부는 Pixel Helper와 Events Manager 테스트 이벤트에서 확인한다.

카드 결제 주문은 콘솔에서 `released_confirmed_purchase`가 찍히고 TikTok Pixel Helper에 `Purchase`가 보여야 한다.

## 롤백

문제가 있으면 enforce v1 블록을 제거하고 기존 dry-run v3 블록으로 되돌린다.
