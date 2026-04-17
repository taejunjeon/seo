/* TikTok Purchase Guard dry-run
 * Version: 2026-04-16.tiktok-purchase-guard-dry-run.v1
 *
 * Purpose:
 * - Observe TikTok Purchase calls on Imweb checkout-complete pages.
 * - Query the existing payment-decision endpoint.
 * - Do not block or change TikTok events while enforcePurchaseDecision=false.
 *
 * Deployment note:
 * - Put this before Imweb/TikTok purchase calls if dry-run must see every call.
 * - Keep enforcePurchaseDecision=false until card + virtual account tests pass.
 */
(function (w, d) {
  "use strict";

  var GUARD_KEY = "__BIOCOM_TIKTOK_PURCHASE_GUARD__";
  var WRAP_KEY = "__BIOCOM_TIKTOK_PURCHASE_GUARD_WRAPPED__";

  if (w[GUARD_KEY] && w[GUARD_KEY].version) return;

  var CONFIG = {
    version: "2026-04-16.tiktok-purchase-guard-dry-run.v1",
    logPrefix: "[biocom-tiktok-purchase-guard]",
    decisionEndpoint: "https://att.ainativeos.net/api/attribution/payment-decision",
    store: "biocom",
    enforcePurchaseDecision: false,
    decisionTimeoutMs: 1800,
    scanIntervalMs: 120,
    scanLimitMs: 10000,
    replacementEventName: "PlaceAnOrder",
    unknownEventName: "PurchaseDecisionUnknown",
    blockedEventName: "PurchaseBlocked",
    sessionStorageKey: "__biocom_tiktok_purchase_guard_decisions__",
    maxStoredDecisions: 60,
    debug: true
  };

  var state = {
    installedAt: new Date().toISOString(),
    handledAttemptKeys: {},
    decisions: [],
    passthroughDepth: 0,
    wrappers: {
      tiktokPixel: false,
      ttq: false
    }
  };

  function safeString(value) {
    if (value == null) return "";
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

  function getUrlParam(name) {
    try {
      return new URL(w.location.href).searchParams.get(name) || "";
    } catch (error) {
      return "";
    }
  }

  function extractOrderCode(value) {
    var text = safeString(value);
    if (!text) return "";
    var match = text.match(/(o[0-9]{8}[0-9A-Za-z_-]+)/);
    return match ? match[1] : "";
  }

  function extractParamFromUrlLike(value, name) {
    var text = safeString(value);
    if (!text) return "";
    try {
      return new URL(text, w.location.origin).searchParams.get(name) || "";
    } catch (error) {
      var escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      var match = text.match(new RegExp("[?&]" + escaped + "=([^&#]+)"));
      return match ? decodeURIComponent(match[1].replace(/\+/g, " ")) : "";
    }
  }

  function readNestedString(source, keys) {
    if (!isObject(source)) return "";
    for (var i = 0; i < keys.length; i += 1) {
      var key = keys[i];
      if (source[key] != null && safeString(source[key])) return safeString(source[key]);
    }
    return "";
  }

  function extractEventId(params, options) {
    return firstNonEmpty([
      readNestedString(params, ["event_id", "eventID", "eventId"]),
      readNestedString(options, ["event_id", "eventID", "eventId"])
    ]);
  }

  function normalizeEventName(eventName) {
    var name = safeString(eventName);
    if (name === "CompletePayment") return "Purchase";
    return name;
  }

  function buildContext(payload) {
    var params = isObject(payload.params) ? payload.params : {};
    var options = isObject(payload.options) ? payload.options : {};
    var eventId = firstNonEmpty([payload.eventId, extractEventId(params, options)]);
    var href = safeString(w.location.href);
    var orderCode = firstNonEmpty([
      readNestedString(params, ["order_code", "orderCode"]),
      readNestedString(options, ["order_code", "orderCode"]),
      getUrlParam("order_code"),
      extractParamFromUrlLike(href, "order_code"),
      extractOrderCode(eventId)
    ]);
    var orderNo = firstNonEmpty([
      readNestedString(params, ["order_no", "orderNo"]),
      readNestedString(options, ["order_no", "orderNo"]),
      getUrlParam("order_no"),
      extractParamFromUrlLike(href, "order_no")
    ]);
    var paymentCode = firstNonEmpty([
      readNestedString(params, ["payment_code", "paymentCode"]),
      readNestedString(options, ["payment_code", "paymentCode"]),
      getUrlParam("payment_code"),
      extractParamFromUrlLike(href, "payment_code")
    ]);
    var paymentKey = firstNonEmpty([
      readNestedString(params, ["payment_key", "paymentKey"]),
      readNestedString(options, ["payment_key", "paymentKey"]),
      getUrlParam("paymentKey"),
      getUrlParam("payment_key"),
      extractParamFromUrlLike(href, "paymentKey"),
      extractParamFromUrlLike(href, "payment_key")
    ]);

    return {
      source: payload.source,
      eventName: normalizeEventName(payload.eventName),
      originalEventName: safeString(payload.eventName),
      eventId: eventId || (orderCode ? "Purchase_" + orderCode : ""),
      orderCode: orderCode,
      orderNo: orderNo,
      paymentCode: paymentCode,
      paymentKey: paymentKey,
      value: readNestedString(params, ["value"]),
      currency: readNestedString(params, ["currency"]) || "KRW",
      url: href,
      createdAt: new Date().toISOString()
    };
  }

  function hasLookupKey(context) {
    return Boolean(context.orderCode || context.orderNo || context.paymentCode || context.paymentKey);
  }

  function buildAttemptKey(context) {
    return [
      context.source,
      context.eventName,
      context.orderCode,
      context.orderNo,
      context.paymentCode,
      context.paymentKey ? "paymentKey" : "",
      context.eventId
    ].join("|");
  }

  function buildDecisionUrl(context) {
    var params = new URLSearchParams();
    if (context.orderCode) params.set("orderCode", context.orderCode);
    if (context.orderNo) params.set("orderNo", context.orderNo);
    if (context.paymentCode) params.set("paymentCode", context.paymentCode);
    if (context.paymentKey) params.set("paymentKey", context.paymentKey);
    params.set("store", CONFIG.store);
    params.set("debug", "0");
    return CONFIG.decisionEndpoint + "?" + params.toString();
  }

  function timeoutFetch(url) {
    var controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timer = null;
    if (controller) {
      timer = w.setTimeout(function () {
        controller.abort();
      }, CONFIG.decisionTimeoutMs);
    }

    return fetch(url, {
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
      throw error;
    });
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
          reason: "no order/payment keys found in url/event payload"
        }
      });
    }

    return timeoutFetch(buildDecisionUrl(context)).then(function (body) {
      if (!body || !body.decision) throw new Error("invalid payment-decision response");
      return body;
    }).catch(function (error) {
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

  function persistDecisions() {
    try {
      var tail = state.decisions.slice(-CONFIG.maxStoredDecisions);
      w.sessionStorage.setItem(CONFIG.sessionStorageKey, JSON.stringify(tail));
    } catch (error) {
      /* ignore storage failures */
    }
  }

  function recordDecision(phase, context, body) {
    var decision = body && body.decision ? body.decision : {};
    var row = {
      phase: phase,
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
    state.decisions.push(row);
    persistDecisions();

    if (CONFIG.debug && w.console && typeof w.console.log === "function") {
      w.console.log(CONFIG.logPrefix, row);
    }

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
    var next = {};
    var source = isObject(params) ? params : {};
    Object.keys(source).forEach(function (key) {
      next[key] = source[key];
    });
    next.event_id = context.orderCode || extractOrderCode(context.eventId) || context.eventId;
    next.order_code = context.orderCode;
    next.order_no = context.orderNo;
    next.payment_code = context.paymentCode;
    next.payment_status = "pending";
    next.original_event_name = context.eventName;
    next.original_event_id = context.eventId;
    return next;
  }

  function shouldAllowPurchase(decision) {
    return decision && decision.browserAction === "allow_purchase";
  }

  function shouldSendReplacement(decision) {
    return decision && decision.browserAction === "block_purchase_virtual_account";
  }

  function shouldSendDiagnostic(decision) {
    return decision && decision.browserAction && decision.browserAction !== "allow_purchase";
  }

  function handlePurchaseAttempt(payload) {
    var context = buildContext(payload);
    var attemptKey = buildAttemptKey(context);

    if (attemptKey && state.handledAttemptKeys[attemptKey]) {
      return payload.invokeOriginal();
    }
    if (attemptKey) state.handledAttemptKeys[attemptKey] = true;

    if (!CONFIG.enforcePurchaseDecision) {
      var result = payload.invokeOriginal();
      queryDecision(context).then(function (body) {
        recordDecision("dry_run_observed_purchase", context, body);
      });
      return result;
    }

    queryDecision(context).then(function (body) {
      var decision = body.decision || {};
      recordDecision("enforce_decision", context, body);

      if (shouldAllowPurchase(decision)) {
        payload.invokeOriginal();
        return;
      }

      if (shouldSendReplacement(decision) && typeof payload.invokeReplacement === "function") {
        payload.invokeReplacement(CONFIG.replacementEventName, makeReplacementParams(payload.params, context));
        return;
      }

      if (shouldSendDiagnostic(decision) && typeof payload.invokeReplacement === "function") {
        payload.invokeReplacement(CONFIG.unknownEventName, makeReplacementParams(payload.params, context));
      }
    });

    return undefined;
  }

  function wrapTiktokPixel() {
    var pixel = w.TIKTOK_PIXEL;
    if (!pixel || typeof pixel.track !== "function") return false;
    if (pixel[WRAP_KEY]) return true;

    var originalTrack = pixel.track;
    pixel.track = function (eventName, params) {
      var self = this;
      var args = arguments;
      var normalizedEventName = normalizeEventName(eventName);

      if (state.passthroughDepth > 0 || normalizedEventName !== "Purchase") {
        return originalTrack.apply(self, args);
      }

      return handlePurchaseAttempt({
        source: "TIKTOK_PIXEL.track",
        eventName: eventName,
        params: params,
        invokeOriginal: function () {
          return withPassthrough(function () {
            return originalTrack.apply(self, args);
          });
        },
        invokeReplacement: function (replacementEventName, replacementParams) {
          return withPassthrough(function () {
            return originalTrack.call(self, replacementEventName, replacementParams);
          });
        }
      });
    };

    pixel[WRAP_KEY] = true;
    state.wrappers.tiktokPixel = true;
    return true;
  }

  function wrapTtq() {
    var ttq = w.ttq;
    if (!ttq || typeof ttq.track !== "function") return false;
    if (ttq.track[WRAP_KEY]) return true;

    var originalTrack = ttq.track;
    var guardedTrack = function (eventName, params, options) {
      var self = this;
      var args = arguments;
      var normalizedEventName = normalizeEventName(eventName);

      if (state.passthroughDepth > 0 || normalizedEventName !== "Purchase") {
        return originalTrack.apply(self, args);
      }

      return handlePurchaseAttempt({
        source: "ttq.track",
        eventName: eventName,
        params: params,
        options: options,
        invokeOriginal: function () {
          return withPassthrough(function () {
            return originalTrack.apply(self, args);
          });
        },
        invokeReplacement: function (replacementEventName, replacementParams) {
          return withPassthrough(function () {
            return originalTrack.call(self, replacementEventName, replacementParams, options);
          });
        }
      });
    };

    guardedTrack[WRAP_KEY] = true;
    ttq.track = guardedTrack;
    state.wrappers.ttq = true;
    return true;
  }

  function scan() {
    var start = Date.now();
    var timer = w.setInterval(function () {
      wrapTiktokPixel();
      wrapTtq();

      if ((state.wrappers.tiktokPixel && state.wrappers.ttq) || Date.now() - start > CONFIG.scanLimitMs) {
        w.clearInterval(timer);
        if (CONFIG.debug && w.console && typeof w.console.log === "function") {
          w.console.log(CONFIG.logPrefix, "scan_complete", {
            version: CONFIG.version,
            enforcePurchaseDecision: CONFIG.enforcePurchaseDecision,
            wrappers: state.wrappers
          });
        }
      }
    }, CONFIG.scanIntervalMs);
  }

  w[GUARD_KEY] = {
    version: CONFIG.version,
    config: CONFIG,
    state: state,
    wrapTiktokPixel: wrapTiktokPixel,
    wrapTtq: wrapTtq,
    getDecisions: function () {
      return state.decisions.slice();
    },
    clearDecisions: function () {
      state.decisions = [];
      try {
        w.sessionStorage.removeItem(CONFIG.sessionStorageKey);
      } catch (error) {
        /* ignore storage failures */
      }
    }
  };

  wrapTiktokPixel();
  wrapTtq();
  scan();
})(window, document);
