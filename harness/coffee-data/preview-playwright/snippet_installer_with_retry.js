/* Coffee NPay Intent Snippet Installer v1
 * Outer ready-retry wrapper + 기존 all-in-one snippet IIFE.
 * SITE_SHOP_DETAIL / window.confirmOrderWithCartItems 부재 시 250ms 간격 재시도, 최대 8초.
 * 이중 설치 방지 = 기존 snippet 의 __coffeeNpayIntentPreviewAllInOneInstalled marker.
 * fetch / sendBeacon / XHR 0 — sessionStorage buffer 만 채움. dispatcher v2.1 가 forward.
 */
(function () {
  if (window.__coffeeNpayIntentSnippetInstallerStarted) return;
  window.__coffeeNpayIntentSnippetInstallerStarted = true;

  var INSTALLER_TAG = "[coffee_npay_intent_snippet_installer]";
  var CHECK_INTERVAL_MS = 250;
  var MAX_WAIT_MS = 8000;
  var startedAt = Date.now();

  function isReady() {
    var sd = window.SITE_SHOP_DETAIL;
    var sdConfirm = sd && typeof sd.confirmOrderWithCartItems === "function";
    var globalConfirm = typeof window.confirmOrderWithCartItems === "function";
    return sdConfirm || globalConfirm;
  }

  function tryInstall() {
    if (window.__coffeeNpayIntentPreviewAllInOneInstalled) {
      try { console.info(INSTALLER_TAG, "snippet already installed (other path) — skip"); } catch (e) {}
      return;
    }
    if (isReady()) {
      try { console.info(INSTALLER_TAG, "site ready — running snippet IIFE (waited " + (Date.now() - startedAt) + "ms)"); } catch (e) {}
      runSnippetIIFE();
      return;
    }
    if (Date.now() - startedAt < MAX_WAIT_MS) {
      setTimeout(tryInstall, CHECK_INTERVAL_MS);
    } else {
      try { console.warn(INSTALLER_TAG, "install timeout " + MAX_WAIT_MS + "ms — SITE_SHOP_DETAIL/window.confirmOrderWithCartItems 둘 다 부재. snippet IIFE 실행 안 함"); } catch (e) {}
    }
  }

  function runSnippetIIFE() {
    /* === 기존 all-in-one snippet IIFE 본문 통째 inline (snippet_iife.js line 3~) === */
  if (window.__coffeeNpayIntentPreviewAllInOneInstalled) {
    console.warn("[coffee_npay_intent_preview] all-in-one already installed");
    return;
  }
  window.__coffeeNpayIntentPreviewAllInOneInstalled = true;

  var SITE = "thecleancoffee";
  var VERSION = "coffee_npay_intent_preview_all_in_one_20260501";
  var BUFFER_KEY = "coffee_npay_intent_preview";
  var INTENT_SEQ_KEY = "__coffee_intent_seq";
  var INTENT_UUID_PENDING_KEY = "__coffee_intent_uuid_pending";
  var SESSION_UUID_KEY = "__coffee_session_uuid";
  var FUNNEL_CAPI_SESSION_KEY = "__seo_funnel_session";
  var FUNNEL_CAPI_SENT_PREFIX = "funnelCapi::sent::";
  var WRAP_MARKER = "__coffee_npay_v04_wrapped";
  var MAX_BUFFER = 50;
  var LOG_PREFIX = "[coffee_npay_intent_preview]";
  var V05_RETRY_DELAYS_MS = [100, 500, 1500];
  var V06_RETRY_DELAYS_MS = [100, 500, 1500, 3000];
  var SYNTHETIC_TX_PATTERN = /^NPAY\s*-\s*\d+\s*-\s*\d{10,}$/;

  /* ── buffer ─────────────────────────────────────────────────────── */
  function readBuffer() {
    try { return JSON.parse(sessionStorage.getItem(BUFFER_KEY) || "[]"); }
    catch (e) { return []; }
  }
  function writeBuffer(buf) {
    try {
      while (buf.length > MAX_BUFFER) buf.shift();
      sessionStorage.setItem(BUFFER_KEY, JSON.stringify(buf));
    } catch (e) {}
  }

  /* ── uuid / seq / session ──────────────────────────────────────── */
  function newUuid() {
    try {
      if (window.crypto && typeof window.crypto.randomUUID === "function") {
        return window.crypto.randomUUID();
      }
    } catch (e) {}
    return "nu-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
  }
  function safeStr(v) { return v == null ? "" : String(v); }

  function getSessionUuid() {
    var fromFunnel = "";
    try { fromFunnel = safeStr(sessionStorage.getItem(FUNNEL_CAPI_SESSION_KEY)); } catch (e) {}
    if (fromFunnel) return fromFunnel;
    var fallback = "";
    try { fallback = safeStr(sessionStorage.getItem(SESSION_UUID_KEY)); } catch (e) {}
    if (fallback) return fallback;
    var fresh = newUuid();
    try { sessionStorage.setItem(SESSION_UUID_KEY, fresh); } catch (e) {}
    return fresh;
  }
  function nextIntentSeq() {
    var cur = 0;
    try { cur = Number(sessionStorage.getItem(INTENT_SEQ_KEY) || "0") || 0; } catch (e) {}
    var nextVal = cur + 1;
    try { sessionStorage.setItem(INTENT_SEQ_KEY, String(nextVal)); } catch (e) {}
    return nextVal;
  }
  function newIntentUuidForConfirm() {
    var v = newUuid();
    try { sessionStorage.setItem(INTENT_UUID_PENDING_KEY, v); } catch (e) {}
    return v;
  }
  function lastPendingIntentUuid() {
    try { return safeStr(sessionStorage.getItem(INTENT_UUID_PENDING_KEY)); }
    catch (e) { return ""; }
  }

  /* ── funnel-capi observation ───────────────────────────────────── */
  function readFunnelCapiSessionId() {
    try { return safeStr(sessionStorage.getItem(FUNNEL_CAPI_SESSION_KEY)); }
    catch (e) { return ""; }
  }
  function readLatestFunnelCapiEid() {
    try {
      var keys = [];
      for (var i = 0; i < sessionStorage.length; i++) {
        var k = sessionStorage.key(i);
        if (k && k.indexOf(FUNNEL_CAPI_SENT_PREFIX) === 0) keys.push(k);
      }
      if (!keys.length) return "";
      return keys[keys.length - 1].replace(FUNNEL_CAPI_SENT_PREFIX, "");
    } catch (e) { return ""; }
  }
  function findInitiateCheckoutEid(beforeKeys) {
    try {
      var keys = [];
      for (var i = 0; i < sessionStorage.length; i++) {
        var k = sessionStorage.key(i);
        if (!k || k.indexOf(FUNNEL_CAPI_SENT_PREFIX + "InitiateCheckout.") !== 0) continue;
        if (beforeKeys.indexOf(k) >= 0) continue;
        keys.push(k);
      }
      if (!keys.length) return null;
      var lastKey = keys[keys.length - 1];
      var eid = lastKey.replace(FUNNEL_CAPI_SENT_PREFIX, "");
      var m = eid.match(/^InitiateCheckout\.(o\d{8}[0-9a-f]+)\.([0-9a-z]+)$/i);
      if (!m) return { raw_key: lastKey, eid: eid, order_code: "", suffix: "", parse_ok: false };
      return { raw_key: lastKey, eid: eid, order_code: m[1], suffix: m[2], parse_ok: true };
    } catch (e) { return null; }
  }

  /* ── dataLayer NPay synthetic id observation ───────────────────── */
  function findSyntheticTxInDataLayer(beforeLength) {
    try {
      if (!Array.isArray(window.dataLayer)) return null;
      var startIdx = typeof beforeLength === "number" ? beforeLength : 0;
      for (var i = window.dataLayer.length - 1; i >= startIdx; i--) {
        var item = window.dataLayer[i];
        if (!item || typeof item !== "object") continue;
        var candidates = [];
        candidates.push(item.transaction_id);
        if (item.ecommerce && typeof item.ecommerce === "object") {
          candidates.push(item.ecommerce.transaction_id);
          candidates.push(item.ecommerce.transactionId);
          if (item.ecommerce.purchase && typeof item.ecommerce.purchase === "object") {
            var af = item.ecommerce.purchase.actionField;
            if (af && typeof af === "object") candidates.push(af.id);
          }
        }
        for (var j = 0; j < candidates.length; j++) {
          var v = candidates[j];
          if (typeof v === "string" && SYNTHETIC_TX_PATTERN.test(v)) {
            return {
              source: "dataLayer[" + i + "]",
              tx_id: v,
              dl_event: typeof item.event === "string" ? item.event : null
            };
          }
        }
      }
    } catch (e) {}
    return null;
  }

  /* ── ga cookies ────────────────────────────────────────────────── */
  function readCookies() {
    var out = {};
    try {
      var pairs = (document.cookie || "").split(";");
      for (var i = 0; i < pairs.length; i++) {
        var s = pairs[i].trim();
        var eq = s.indexOf("=");
        if (eq > 0) out[s.slice(0, eq)] = decodeURIComponent(s.slice(eq + 1));
      }
    } catch (e) {}
    return out;
  }
  function readGaIds() {
    var c = readCookies();
    var ga = c["_ga"] || "";
    var cid = ga.split(".").slice(2).join(".") || "";
    var gaSessionEntry = "";
    for (var k in c) {
      if (Object.prototype.hasOwnProperty.call(c, k) && k.indexOf("_ga_") === 0) {
        gaSessionEntry = c[k]; break;
      }
    }
    var sessionId = (gaSessionEntry.split(".")[2]) || "";
    return { cid: cid, sessionId: sessionId };
  }

  function detectUaClass() {
    try {
      if (window.matchMedia && window.matchMedia("(max-width: 768px)").matches) return "mobile";
      if (window.matchMedia && window.matchMedia("(min-width: 769px)").matches) return "pc";
    } catch (e) {}
    return "unknown";
  }

  /* ── product metadata 3-step fallback ──────────────────────────── */
  function metaFromInitDetailCache() {
    try {
      var cached = window.SITE_SHOP_DETAIL && window.SITE_SHOP_DETAIL._coffeeNpayInitDetailArgs;
      if (!cached) return null;
      if (!cached.prod_idx && !cached.prod_code && !cached.prod_price) return null;
      return {
        source: "initDetail_wrap",
        prod_idx: Number(cached.prod_idx || 0),
        prod_code: safeStr(cached.prod_code),
        prod_price: Number(cached.prod_price || 0)
      };
    } catch (e) { return null; }
  }
  function metaFromInlineScript() {
    try {
      var nodes = document.querySelectorAll("script");
      for (var i = 0; i < nodes.length; i++) {
        var t = nodes[i].textContent || "";
        if (t.indexOf("SITE_SHOP_DETAIL.initDetail(") < 0) continue;
        var m = t.match(/SITE_SHOP_DETAIL\.initDetail\(\s*(\{[\s\S]*?\})\s*\)/);
        if (!m) continue;
        var blob = m[1];
        var idx = (blob.match(/"prod_idx"\s*:\s*(\d+)/) || [])[1];
        var code = (blob.match(/"prod_code"\s*:\s*"([^"]+)"/) || [])[1];
        var price = (blob.match(/"prod_price"\s*:\s*(\d+)/) || [])[1];
        if (idx || code || price) {
          return {
            source: "inline_script_regex",
            prod_idx: Number(idx || 0),
            prod_code: safeStr(code),
            prod_price: Number(price || 0)
          };
        }
      }
    } catch (e) {}
    return null;
  }
  function metaFromDom() {
    try {
      var codeEl = document.querySelector("[data-bs-prod-code]");
      var idxEl = document.querySelector("[data-prod_idx], [data-prod-idx]");
      var code = codeEl ? safeStr(codeEl.getAttribute("data-bs-prod-code")) : "";
      var idxRaw = idxEl
        ? safeStr(idxEl.getAttribute("data-prod_idx") || idxEl.getAttribute("data-prod-idx"))
        : "";
      if (!code && !idxRaw) return null;
      return { source: "dom_fallback", prod_idx: Number(idxRaw || 0), prod_code: code, prod_price: 0 };
    } catch (e) { return null; }
  }
  function resolveMetadata() {
    return (
      metaFromInitDetailCache() ||
      metaFromInlineScript() ||
      metaFromDom() ||
      { source: "none", prod_idx: 0, prod_code: "", prod_price: 0 }
    );
  }

  /* ── option count / quantity (PII 차단: 숫자만) ───────────────── */
  function readSelectedOptionCount() {
    try {
      return Number(document.querySelectorAll("#prod-form-options ._option_select_row").length || 0);
    } catch (e) { return 0; }
  }
  function readSelectedQuantity() {
    try {
      var nodes = document.querySelectorAll(
        "input.option_count, input._option_count, input[name='option_count'], input.prod-form-quantity, input[name='quantity']"
      );
      for (var i = 0; i < nodes.length; i++) {
        var v = Number(nodes[i].value || 0);
        if (isFinite(v) && v > 0) return v;
      }
    } catch (e) {}
    return 1;
  }

  /* ── payload builder ───────────────────────────────────────────── */
  function buildPayload(intentPhase, opts) {
    opts = opts || {};
    var meta = resolveMetadata();
    var quantity = readSelectedQuantity();
    var optionCount = readSelectedOptionCount();
    var ga = readGaIds();
    var fcSessionId = readFunnelCapiSessionId();
    var fcEid = readLatestFunnelCapiEid();
    var sessionUuid = getSessionUuid();
    var isConfirm = (intentPhase === "confirm_to_pay" || intentPhase === "sanity_test");
    var intentUuid = isConfirm ? newIntentUuidForConfirm() : (lastPendingIntentUuid() || "pending");
    var intentSeq = isConfirm ? nextIntentSeq() : Number(sessionStorage.getItem(INTENT_SEQ_KEY) || "0");
    var metadataMissing = !meta.prod_code || !meta.prod_price;
    return {
      site: SITE,
      version: VERSION,
      intent_phase: intentPhase,
      session_uuid: sessionUuid,
      intent_uuid: intentUuid,
      intent_seq: intentSeq,
      prod_idx: meta.prod_idx,
      prod_code: meta.prod_code,
      prod_price: meta.prod_price,
      selected_option_count: optionCount,
      selected_quantity: quantity,
      estimated_item_total: (Number(meta.prod_price) || 0) * (Number(quantity) || 0),
      metadata_missing: metadataMissing,
      metadata_source: meta.source,
      funnel_capi_session_id: fcSessionId,
      funnel_capi_eid_observed: fcEid,
      ga_client_id: ga.cid,
      ga_session_id: ga.sessionId,
      page_url: location.href,
      page_path: location.pathname,
      payment_button_type: "npay",
      ts_ms_kst: Date.now(),
      ts_label_kst: new Date().toLocaleString("sv-SE", { timeZone: "Asia/Seoul" }),
      user_agent_class: detectUaClass(),
      is_simulation: !!opts.isSimulation,
      preview_only: true
    };
  }

  function log(payload) {
    var buf = readBuffer();
    buf.push(payload);
    writeBuffer(buf);
    try { console.log(LOG_PREFIX, payload); } catch (e) {}
  }

  /* ── retry capture: imweb orderCode + GA4 synthetic tx ─────────── */
  function scheduleRetryCaptures(beforeFcKeys, beforeDlLen) {
    V05_RETRY_DELAYS_MS.forEach(function (delay) {
      setTimeout(function () {
        var hit = findInitiateCheckoutEid(beforeFcKeys);
        if (!hit) return;
        try {
          var buf = readBuffer();
          if (!buf.length) return;
          var last = buf[buf.length - 1];
          if (last.intent_phase !== "confirm_to_pay") return;
          if (last.imweb_order_code) return;
          last.imweb_order_code = hit.order_code;
          last.imweb_order_code_eid = hit.eid;
          last.imweb_order_code_capture_delay_ms = delay;
          buf[buf.length - 1] = last;
          writeBuffer(buf);
          console.log(LOG_PREFIX, "v0.5 captured orderCode @" + delay + "ms", hit);
        } catch (e) { console.warn(LOG_PREFIX, "v0.5 capture err", e && e.message); }
      }, delay);
    });
    V06_RETRY_DELAYS_MS.forEach(function (delay) {
      setTimeout(function () {
        var hit = findSyntheticTxInDataLayer(beforeDlLen);
        if (!hit) return;
        try {
          var buf = readBuffer();
          if (!buf.length) return;
          var last = buf[buf.length - 1];
          if (last.intent_phase !== "confirm_to_pay") return;
          if (last.ga4_synthetic_transaction_id) return;
          last.ga4_synthetic_transaction_id = hit.tx_id;
          last.ga4_synthetic_transaction_id_source = hit.source;
          last.ga4_synthetic_transaction_id_dl_event = hit.dl_event;
          last.ga4_synthetic_transaction_id_capture_delay_ms = delay;
          buf[buf.length - 1] = last;
          writeBuffer(buf);
          console.log(LOG_PREFIX, "v0.6 captured synthetic_tx @" + delay + "ms", hit);
        } catch (e) { console.warn(LOG_PREFIX, "v0.6 capture err", e && e.message); }
      }, delay);
    });
  }

  function snapshotBeforeStates() {
    var fcKeys = [];
    try {
      for (var i = 0; i < sessionStorage.length; i++) {
        var k = sessionStorage.key(i);
        if (k && k.indexOf(FUNNEL_CAPI_SENT_PREFIX + "InitiateCheckout.") === 0) fcKeys.push(k);
      }
    } catch (e) {}
    var dlLen = Array.isArray(window.dataLayer) ? window.dataLayer.length : 0;
    return { fcKeys: fcKeys, dlLen: dlLen };
  }

  /* ── 1) initDetail wrap (remember args) ────────────────────────── */
  try {
    var sd = window.SITE_SHOP_DETAIL;
    if (sd && typeof sd.initDetail === "function" && !sd.initDetail[WRAP_MARKER]) {
      var origInit = sd.initDetail;
      var wrapInit = function (args) {
        try { sd._coffeeNpayInitDetailArgs = args; } catch (e) {}
        return origInit.apply(this, arguments);
      };
      wrapInit[WRAP_MARKER] = true;
      sd.initDetail = wrapInit;
    }
  } catch (e) { console.warn(LOG_PREFIX, "initDetail wrap error", e && e.message); }

  /* ── 2) SITE_SHOP_DETAIL.confirmOrderWithCartItems wrap ────────── */
  try {
    var sd2 = window.SITE_SHOP_DETAIL;
    if (sd2 && typeof sd2.confirmOrderWithCartItems === "function" && !sd2.confirmOrderWithCartItems[WRAP_MARKER]) {
      var origSiteConfirm = sd2.confirmOrderWithCartItems;
      var wrapSiteConfirm = function (kind /*, backurl, params */) {
        var snap = snapshotBeforeStates();
        try {
          if (kind === "npay") {
            log(buildPayload("confirm_to_pay"));
            scheduleRetryCaptures(snap.fcKeys, snap.dlLen);
          }
        } catch (err) { console.warn(LOG_PREFIX, "site confirm wrap error", err && err.message); }
        return origSiteConfirm.apply(this, arguments);
      };
      wrapSiteConfirm[WRAP_MARKER] = true;
      sd2.confirmOrderWithCartItems = wrapSiteConfirm;
    }
  } catch (e) { console.warn(LOG_PREFIX, "site confirm wrap install error", e && e.message); }

  /* ── 3) global window.confirmOrderWithCartItems wrap ───────────── */
  try {
    if (typeof window.confirmOrderWithCartItems === "function" && !window.confirmOrderWithCartItems[WRAP_MARKER]) {
      var origGlobalConfirm = window.confirmOrderWithCartItems;
      var wrapGlobalConfirm = function (kind /*, backurl, params */) {
        var snap = snapshotBeforeStates();
        try {
          if (kind === "npay") {
            log(buildPayload("confirm_to_pay"));
            scheduleRetryCaptures(snap.fcKeys, snap.dlLen);
          }
        } catch (err) { console.warn(LOG_PREFIX, "global confirm wrap error", err && err.message); }
        return origGlobalConfirm.apply(this, arguments);
      };
      wrapGlobalConfirm[WRAP_MARKER] = true;
      window.confirmOrderWithCartItems = wrapGlobalConfirm;
    }
  } catch (e) { console.warn(LOG_PREFIX, "global confirm wrap install error", e && e.message); }

  /* ── 4) mobile NPay button click backup ────────────────────────── */
  try {
    document.addEventListener("click", function (event) {
      try {
        var t = event.target;
        if (!(t instanceof Element)) return;
        var el = t.closest && t.closest("._btn_mobile_npay");
        if (!el) return;
        log(buildPayload("click_to_dialog"));
      } catch (err) { console.warn(LOG_PREFIX, "mobile click handler error", err && err.message); }
    }, true);
  } catch (e) { console.warn(LOG_PREFIX, "mobile click listener install error", e && e.message); }

  /* ── 5) public api ─────────────────────────────────────────────── */
  function simulateConfirmNpay() {
    var snap = snapshotBeforeStates();
    var payload = buildPayload("sanity_test", { isSimulation: true });
    log(payload);
    scheduleRetryCaptures(snap.fcKeys, snap.dlLen);
    try { console.info(LOG_PREFIX, "simulateConfirmNpay() — original confirm function NOT called"); } catch (e) {}
    return payload;
  }
  function getBuffer() { return readBuffer(); }
  function clearBuffer() {
    try {
      sessionStorage.removeItem(BUFFER_KEY);
      sessionStorage.removeItem(INTENT_SEQ_KEY);
      sessionStorage.removeItem(INTENT_UUID_PENDING_KEY);
      sessionStorage.removeItem(SESSION_UUID_KEY);
    } catch (e) {}
    return { ok: true };
  }
  function status() {
    return {
      version: VERSION,
      installed: true,
      sessionUuid: getSessionUuid(),
      funnelCapiSessionId: readFunnelCapiSessionId(),
      funnelCapiEidObserved: readLatestFunnelCapiEid(),
      intentSeq: Number(sessionStorage.getItem(INTENT_SEQ_KEY) || "0"),
      bufferLength: readBuffer().length,
      siteConfirmWrapped: !!(window.SITE_SHOP_DETAIL && window.SITE_SHOP_DETAIL.confirmOrderWithCartItems && window.SITE_SHOP_DETAIL.confirmOrderWithCartItems[WRAP_MARKER]),
      globalConfirmWrapped: !!(window.confirmOrderWithCartItems && window.confirmOrderWithCartItems[WRAP_MARKER]),
      initDetailWrapped: !!(window.SITE_SHOP_DETAIL && window.SITE_SHOP_DETAIL.initDetail && window.SITE_SHOP_DETAIL.initDetail[WRAP_MARKER]),
      dataLayerLength: Array.isArray(window.dataLayer) ? window.dataLayer.length : 0
    };
  }

  window.coffeeNpayIntentPreview = {
    version: VERSION,
    simulateConfirmNpay: simulateConfirmNpay,
    getBuffer: getBuffer,
    clearBuffer: clearBuffer,
    status: status
  };

  try {
    console.log(LOG_PREFIX, "all-in-one installed", VERSION,
      "(v0.4 wrap + v0.5 orderCode retry + v0.6 ga4 synthetic tx retry, preview only — no network send)");
  } catch (e) {}
    /* === snippet IIFE 끝 === */
  }

  tryInstall();
})();
