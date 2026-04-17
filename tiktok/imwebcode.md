# TikTok Purchase Guard dry-run v3 Imweb 삽입 코드

작성일: 2026-04-17

## 현재 판단

현재 아임웹에는 v2 코드가 제대로 교체되어 들어갔다. 로그에 아래가 찍혔기 때문이다.

```text
[biocom-tiktok-purchase-guard] installed {version: '2026-04-17.tiktok-purchase-guard-dry-run.v2'}
[biocom-tiktok-purchase-guard] wrapped_TIKTOK_PIXEL_init
[biocom-tiktok-purchase-guard] wrapped_TIKTOK_PIXEL_track
[biocom-tiktok-purchase-guard] wrapped_ttq_track
```

하지만 v2에서도 `purchase_seen`이 찍히지 않았다. 즉 코드 교체는 됐지만 TikTok `Purchase`는 wrapper가 붙기 전 아주 짧은 구간에서 이미 실행되고 있다.

따라서 v3는 polling에만 기대지 않고, `window.TIKTOK_PIXEL`과 `window.ttq`에 setter를 먼저 걸어 객체가 생성되는 순간 바로 감싸도록 바꾼다.

## 해야 할 작업

아임웹에 넣은 기존 `2026-04-17.tiktok-purchase-guard-dry-run.v2` 블록을 아래 v3 블록으로 **교체**한다.

추가로 하나 더 붙이지 않는다. 기존 v2를 지우고 v3만 남긴다.

## 붙여넣는 위치

아임웹 관리자 `공통 코드 삽입`의 **Header Code 삽입** 영역.

위치는 기존과 동일하다.

1. Meta `server-payment-decision-guard-v3` 코드 바로 아래
2. GTM/TikTok/아임웹 스크립트보다 위
3. 기존 v2 TikTok Guard 블록은 제거
4. 아래 v3 전체를 붙여넣기

## v3에서 바뀐 점

| 항목 | v2 | v3 |
|---|---|---|
| TikTok 객체 감지 | polling | `window.TIKTOK_PIXEL` setter + polling |
| `ttq` 감지 | polling | `window.ttq` setter + polling |
| 즉시 실행 구간 | 놓칠 수 있음 | 객체 생성 순간 바로 wrap |
| 로그 폭주 | `wrapped_ttq_track` 반복 | 같은 wrap 로그는 최대 3회만 출력 |
| 이벤트 차단 | 안 함 | 안 함. 여전히 dry-run |

## 삽입할 코드

아래 전체를 그대로 붙여넣는다.

```html
<script>
/* TikTok Purchase Guard dry-run
 * Version: 2026-04-17.tiktok-purchase-guard-dry-run.v3
 *
 * Dry-run only:
 * - Does not block TikTok Purchase.
 * - Lets the original TikTok event pass first.
 * - Observes Purchase and queries payment-decision asynchronously.
 */
(function (w) {
  "use strict";

  var VERSION = "2026-04-17.tiktok-purchase-guard-dry-run.v3";
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
    maxRows: 80,
    logPrefix: "[biocom-tiktok-purchase-guard]",
    debug: true
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

  function record(context, body) {
    var decision = body && body.decision ? body.decision : {};
    var row = {
      at: new Date().toISOString(),
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
    log("dry_run_observed_purchase", row);
  }

  function observePurchase(source, eventName, params, options) {
    if (normalizeEventName(eventName) !== "Purchase") return;

    var context = buildContext(source, eventName, params, options);
    var key = buildSeenKey(context);
    if (state.seen[key]) return;
    state.seen[key] = true;

    log("purchase_seen", {
      source: source,
      eventId: context.eventId,
      orderCode: context.orderCode,
      orderNo: context.orderNo,
      paymentCode: context.paymentCode,
      hasPaymentKey: Boolean(context.paymentKey)
    }, true);

    queryDecision(context).then(function (body) {
      record(context, body);
    });
  }

  function wrapTrack(owner, ownerName, stateKey) {
    if (!owner || typeof owner.track !== "function") return false;
    if (owner.track[WRAP_KEY] === VERSION) {
      state.wrappers[stateKey] = true;
      return true;
    }

    var originalTrack = owner.track[RAW_KEY] || owner.track;
    var guardedTrack = function (eventName, params, options) {
      var result = originalTrack.apply(this, arguments);
      observePurchase(ownerName + ".track", eventName, params, options);
      return result;
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
    scanLimitMs: CONFIG.scanLimitMs
  }, true);
})(window);
</script>
```

## 교체 후 확인할 콘솔 로그

정상 설치 후 아래 로그가 보여야 한다.

```text
[biocom-tiktok-purchase-guard] accessor_installed_TIKTOK_PIXEL
[biocom-tiktok-purchase-guard] accessor_installed_ttq
[biocom-tiktok-purchase-guard] installed {version: '2026-04-17.tiktok-purchase-guard-dry-run.v3'}
```

주문 완료 후 아래 로그가 보여야 한다.

```text
[biocom-tiktok-purchase-guard] purchase_seen
[biocom-tiktok-purchase-guard] dry_run_observed_purchase
```

확인 명령:

```js
window.__BIOCOM_TIKTOK_PURCHASE_GUARD__.version
window.__BIOCOM_TIKTOK_PURCHASE_GUARD__.state.accessors
window.__BIOCOM_TIKTOK_PURCHASE_GUARD__.state.wrappers
window.__BIOCOM_TIKTOK_PURCHASE_GUARD__.getDecisions()
```

가상계좌 미입금 기대값:

| 필드 | 기대값 |
|---|---|
| `status` | `pending` |
| `browserAction` | `block_purchase_virtual_account` |
| `matchedBy` | `toss_direct_payment_key` 또는 `toss_direct_order_id` |

## 여전히 Purchase가 보이는 이유

이 코드는 dry-run이다. 아직 TikTok `Purchase`를 차단하지 않는다.

이번 단계의 목표는 Pixel Helper에서 `Purchase`가 사라지는 것이 아니라, `purchase_seen`과 `dry_run_observed_purchase`가 찍히고 `getDecisions()`에 pending row가 생기는 것이다.

이게 확인된 뒤에 enforce 버전을 만들어야 실제로 pending 가상계좌 `Purchase`를 막을 수 있다.
