# 더클린커피 NPay Intent Beacon Preview Snippet (All-in-One, v0.4+v0.5+v0.6)

생성 시각: 2026-05-01 KST
site: `thecleancoffee`
mode: `preview_only`
대상 환경: chrome devtools console (시크릿 창 권장)
관련 문서: [[coffee-npay-intent-beacon-preview-snippet-v04-20260501|v0.4 본체 + v0.5/v0.6 분리본]] / [[coffee-npay-intent-beacon-preview-design-20260501|design v0.4]] / [[coffee-imweb-tracking-flow-analysis-20260501|4 layer 분석]] / [[coffee-live-tracking-inventory-20260501|inventory snapshot]] / [[coffee/!imwebcoffee_code_latest_0501|imweb 헤더/푸터 정본]]

## Auditor Verdict

```text
Auditor verdict: PASS_WITH_NOTES
Phase: coffee_npay_intent_beacon_preview_snippet_all_in_one
No-send verified: YES
No-write verified: YES (sessionStorage 5개 키 + console.log 외 0)
No-deploy verified: YES
No-publish verified: YES
GTM publish: BLOCKED
Live script injection: BLOCKED
fetch / sendBeacon / XHR: BLOCKED
gtag / fbq 직접 호출: BLOCKED
backend API 호출: BLOCKED (snippet 자체. backend dry-run endpoint 는 별도 dispatcher 통해서만)
PII output: NONE
intent_uuid scope: per confirm_to_pay
session_uuid 정책: __seo_funnel_session 우선 재사용 → 부재 시 fallback
funnel-capi 코드 수정: NONE (read-only reuse)
window.dataLayer push 가로채기: NONE (read-only)
실제 운영 변경: 0건
```

## 10초 요약

이 snippet 한 묶음만 paste 하면 v0.4 (intent_uuid + session_uuid + intent_seq + 글로벌 함수 동시 wrap + 3-step metadata fallback + simulateConfirmNpay) + v0.5 (imweb orderCode retry capture) + v0.6 (GA4 NPay synthetic transaction_id retry capture) 가 한 번에 install 된다. PC NPay click 1회로 5종 deterministic key 중 3종 (intent_uuid / funnel_capi_session_id / imweb_order_code) + GA4 synthetic transaction_id 까지 capture 시도.

## 사용 방법 (3단계)

1. chrome 시크릿 창 + devtools open (Console + Network 탭, "preserve log" 권장).
2. `https://thecleancoffee.com/shop_view/?idx=N` (NPay 버튼이 있는 상품 상세 페이지) 진입.
3. 아래 IIFE 한 묶음을 console 에 붙여넣고 enter.

## All-in-One Snippet (붙여넣기 가능, self-contained)

```javascript
/* CoffeeNpayIntentPreview ALL-IN-ONE v0.4+v0.5+v0.6 — preview only, no network send */
(function () {
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
})();
```

## 동작 가드 명세

| 영역 | 명세 |
|---|---|
| `fetch` / `sendBeacon` / `XMLHttpRequest` | 0 |
| `gtag` / `fbq` 직접 호출 | 0 |
| backend `/api/...` 호출 | 0 (snippet 자체. backend dry-run endpoint 는 별도 dispatcher 통해서만) |
| GTM publish | snippet 자체는 GTM 컨테이너 변경 불가 |
| 외부 도메인 send | 0 |
| sessionStorage 키 (우리 5개) | `coffee_npay_intent_preview`, `__coffee_intent_seq`, `__coffee_intent_uuid_pending`, `__coffee_session_uuid` (fallback), `coffee_npay_intent_uuid_pending` 호환용 |
| 읽기 전용 sessionStorage 키 (외부) | `__seo_funnel_session`, `funnelCapi::sent::*` — read 만, 수정 0 |
| funnel-capi 코드 수정 | 0 (read-only reuse) |
| `window.dataLayer` push 가로채기 | 0 (read-only iteration) |
| `SITE_SHOP_DETAIL` / 글로벌 `confirmOrderWithCartItems` 원본 동작 | 그대로 (apply 위임) |
| PII | phone / email / name / address / option text 원문 수집 0 |
| 이중 wrap 가드 | `__coffeeNpayIntentPreviewAllInOneInstalled` + `__coffee_npay_v04_wrapped` |
| `simulateConfirmNpay()` | 원본 결제 함수 미호출. payload + retry capture 박음 |

## 진단 — install / wrap / simulate / 실제 NPay click 검증

snippet 붙여넣은 직후 console 에 다음 한 묶음을 그대로 enter.

```javascript
/* 1) status — install + wrap 확인 */
window.coffeeNpayIntentPreview && window.coffeeNpayIntentPreview.status()

/* 2) simulate — 원본 결제 함수 미호출 + payload + retry capture 박음 */
window.coffeeNpayIntentPreview.simulateConfirmNpay()

/* 3) 잠깐 기다린 뒤 buffer 확인 (retry capture 가 1500~3000ms 내 박힘) */
setTimeout(function () {
  var buf = JSON.parse(sessionStorage.getItem("coffee_npay_intent_preview") || "[]");
  console.log("[after_simulate]\n" + JSON.stringify(buf.slice(-1)[0], null, 2));
}, 3500);
```

PC NPay 버튼 클릭 → 즉시 ESC / 뒤로가기. 페이지 reload 시 sessionStorage 보존되니 그대로 다음 명령:

```javascript
/* 4) 최종 검증 (intent_uuid + imweb_order_code + ga4_synthetic_transaction_id 한 번에) */
;(() => {
  var buf = JSON.parse(sessionStorage.getItem("coffee_npay_intent_preview") || "[]");
  var last = buf.slice(-1)[0] || null;
  var result = {
    bufferLength: buf.length,
    intent_phase: last && last.intent_phase,
    intent_uuid: last && last.intent_uuid,
    session_uuid: last && last.session_uuid,
    intent_seq: last && last.intent_seq,
    funnel_capi_session_id: last && last.funnel_capi_session_id,
    imweb_order_code: last && last.imweb_order_code,
    imweb_order_code_capture_delay_ms: last && last.imweb_order_code_capture_delay_ms,
    ga4_synthetic_transaction_id: last && last.ga4_synthetic_transaction_id,
    ga4_synthetic_transaction_id_source: last && last.ga4_synthetic_transaction_id_source,
    ga4_synthetic_transaction_id_dl_event: last && last.ga4_synthetic_transaction_id_dl_event,
    ga4_synthetic_transaction_id_capture_delay_ms: last && last.ga4_synthetic_transaction_id_capture_delay_ms,
    prod_code: last && last.prod_code,
    prod_price: last && last.prod_price,
    estimated_item_total: last && last.estimated_item_total,
    metadata_source: last && last.metadata_source
  };
  console.log("[final_check json]\n" + JSON.stringify(result, null, 2));
  return result;
})()
```

`[final_check json]` 텍스트만 paste 해 주시면 끝.

## 결과 분기 (5종 deterministic key 의 capture 결과)

| `imweb_order_code` | `ga4_synthetic_transaction_id` | 트랙 |
|---|---|---|
| `o<YYYYMMDD><hex>` 채워짐 | `NPAY - <id> - <ms>` 채워짐 | **(A++) imweb orderCode + GA4 BigQuery transaction_id 두 채널 deterministic 매핑** |
| 채워짐 | null | (A++) 만 — backend `imweb_orders.order_code` 와 deterministic |
| null | 채워짐 | GA4 BigQuery transaction_id 와 deterministic |
| 둘 다 null | — | retry 시점 늦거나 결제 완료 페이지에서만 push 되는 케이스 — v0.7 보강 |

## cleanup

```javascript
window.coffeeNpayIntentPreview && window.coffeeNpayIntentPreview.clearBuffer()
```

페이지 reload 또는 시크릿 창 닫기로 sessionStorage 자동 소멸. 우리 5개 키만 삭제, funnel-capi `__seo_funnel_session` 과 `funnelCapi::sent::*` 는 read-only 라 그대로 둠.

## 외부 시스템 영향

| 시스템 | 영향 |
|---|---|
| imweb 사이트 | 변경 0 (chrome 세션 안에서만, page reload 시 사라짐) |
| GTM workspace | 변경 0 |
| funnel-capi | 수정 0 (read-only reuse) |
| GA4 / Meta / TikTok / Google Ads | 신규 송출 0 |
| 로컬 DB | 신규 row 0 (snippet 측. backend dry-run endpoint 는 별도) |
| 외부 API | 신규 호출 0 |
