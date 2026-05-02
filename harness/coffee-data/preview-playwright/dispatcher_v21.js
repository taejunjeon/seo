
(function () {
  if (window.__coffeeNpayIntentDispatcherInstalled) return;
  window.__coffeeNpayIntentDispatcherInstalled = true;

  var BUFFER_KEY = "coffee_npay_intent_preview";
  var PENDING_KEY = "__coffee_intent_pending";
  var SENT_KEY = "__coffee_intent_sent";
  var ENDPOINT = "https://att.ainativeos.net/api/attribution/coffee-npay-intent?mode=enforce";
  var SWEEP_INTERVAL_MS = 1000;
  var MAX_RETRY = 5;
  var TTL_MS = 24 * 3600 * 1000;
  var ORDER_CODE_WAIT_TIMEOUT_MS = 3000;

  var inflight = new Set();

  function readJsonStorage(k) {
    try { return JSON.parse(sessionStorage.getItem(k) || "{}"); }
    catch (e) { return {}; }
  }
  function writeJsonStorage(k, v) {
    try { sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) {}
  }

  function hasSent(intentUuid) {
    return !!readJsonStorage(SENT_KEY)[intentUuid];
  }
  function markSent(intentUuid, status) {
    var sent = readJsonStorage(SENT_KEY);
    sent[intentUuid] = { sent_at_ms: Date.now(), status: status };
    var keys = Object.keys(sent);
    if (keys.length > 200) {
      keys.sort(function (a, b) { return (sent[a].sent_at_ms || 0) - (sent[b].sent_at_ms || 0); });
      for (var i = 0; i < keys.length - 200; i++) delete sent[keys[i]];
    }
    writeJsonStorage(SENT_KEY, sent);
  }
  function isPermanentFailure(e) {
    if (!e) return false;
    if (e.attempts >= MAX_RETRY) return true;
    if (e.first_seen_ms && Date.now() - e.first_seen_ms > TTL_MS) return true;
    if (e.last_status && e.last_status >= 400 && e.last_status < 500) return true;
    return false;
  }

  function attemptDispatch(p) {
    if (!p || p.preview_only !== true) return;
    if (p.is_simulation === true) return;
    if (!p.intent_uuid) return;
    if (hasSent(p.intent_uuid)) return;
    if (inflight.has(p.intent_uuid)) return;

    var pending = readJsonStorage(PENDING_KEY);
    var entry = pending[p.intent_uuid];
    if (entry && isPermanentFailure(entry)) return;

    // O2: imweb_order_code wait (snippet retry 시간 줌)
    if (!p.imweb_order_code) {
      var firstSeenMs = entry && entry.first_seen_ms ? entry.first_seen_ms : Date.now();
      var elapsedMs = Date.now() - firstSeenMs;

      if (!entry) {
        pending[p.intent_uuid] = {
          first_seen_ms: firstSeenMs,
          attempts: 0,
          last_attempt_ms: null,
          last_status: null,
          last_reason: "wait_for_order_code"
        };
        writeJsonStorage(PENDING_KEY, pending);
      }

      if (elapsedMs < ORDER_CODE_WAIT_TIMEOUT_MS) return;

      // 3초 timeout — block (fetch 안 함)
      markSent(p.intent_uuid, "blocked_missing_imweb_order_code");
      delete pending[p.intent_uuid];
      writeJsonStorage(PENDING_KEY, pending);
      return;
    }

    // O3: payment_button_type fallback (snippet 우선, 안전망)
    if (!p.payment_button_type && p.intent_phase === "confirm_to_pay") {
      p.payment_button_type = "npay";
    }

    var nextAttempts = (entry && entry.attempts ? entry.attempts : 0) + 1;
    pending[p.intent_uuid] = {
      first_seen_ms: entry && entry.first_seen_ms ? entry.first_seen_ms : Date.now(),
      attempts: nextAttempts,
      last_attempt_ms: Date.now(),
      last_status: null,
      last_reason: null
    };
    writeJsonStorage(PENDING_KEY, pending);

    var withSchema = Object.assign({}, p, { payload_schema_version: 1 });

    // O1: in-flight tracking
    inflight.add(p.intent_uuid);

    fetch(ENDPOINT, {
      method: "POST",
      mode: "cors",
      credentials: "omit",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(withSchema),
      keepalive: true
    }).then(function (res) {
      var pend = readJsonStorage(PENDING_KEY);
      var e = pend[p.intent_uuid] || {};
      e.last_status = res.status;
      pend[p.intent_uuid] = e;
      writeJsonStorage(PENDING_KEY, pend);

      if (res.status >= 200 && res.status < 300) {
        markSent(p.intent_uuid, "ok_" + res.status);
        delete pend[p.intent_uuid];
        writeJsonStorage(PENDING_KEY, pend);
      } else if (res.status >= 400 && res.status < 500) {
        markSent(p.intent_uuid, "permanent_4xx_" + res.status);
        delete pend[p.intent_uuid];
        writeJsonStorage(PENDING_KEY, pend);
      }
      // 5xx: pending 유지 → 다음 sweep retry
    }).catch(function (err) {
      var pend = readJsonStorage(PENDING_KEY);
      var e = pend[p.intent_uuid] || {};
      e.last_reason = err && err.message ? String(err.message).slice(0, 100) : "fetch_failed";
      pend[p.intent_uuid] = e;
      writeJsonStorage(PENDING_KEY, pend);
    }).finally(function () {
      inflight.delete(p.intent_uuid);
    });
  }

  function sweep() {
    try {
      var buf = JSON.parse(sessionStorage.getItem(BUFFER_KEY) || "[]");
      buf.forEach(attemptDispatch);
    } catch (e) {}
  }

  setInterval(sweep, SWEEP_INTERVAL_MS);
  window.addEventListener("beforeunload", sweep);
})();

