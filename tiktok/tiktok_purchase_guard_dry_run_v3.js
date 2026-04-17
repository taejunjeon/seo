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
