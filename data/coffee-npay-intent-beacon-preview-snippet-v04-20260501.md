# 더클린커피 NPay Intent Beacon Preview Snippet v0.4 (붙여넣기 가능)

생성 시각: 2026-05-01 KST
site: `thecleancoffee`
mode: `preview_only`
대상 환경: chrome devtools console (시크릿 창 권장) 또는 GTM Preview workspace
관련 문서: [[coffee-npay-intent-beacon-preview-design-20260501|design v0.4]] / [[coffee-imweb-tracking-flow-analysis-20260501|4 layer 분석]] / [[coffee-live-tracking-inventory-20260501|inventory snapshot]] / [[coffee/!imwebcoffee_code_latest_0501|imweb 헤더/푸터 정본]] / [[harness/coffee-data/AUDITOR_CHECKLIST|auditor checklist]]

## Auditor Verdict

```text
Auditor verdict: PASS_WITH_NOTES
Phase: coffee_npay_intent_beacon_preview_snippet_v04
No-send verified: YES
No-write verified: YES
No-deploy verified: YES
No-publish verified: YES
GTM publish: BLOCKED
Live script injection: BLOCKED
fetch / sendBeacon / XHR: BLOCKED (snippet 내 0건)
gtag / fbq 직접 호출: BLOCKED (snippet 내 0건)
backend API 호출: BLOCKED
sessionStorage + console.log only: YES (sessionStorage 4개 키 + console)
PII output: NONE (phone/email/name/address/option 원문 0)
intent_uuid scope: per confirm_to_pay (not per session)
session_uuid 정책: __seo_funnel_session 우선 재사용 → 부재 시 fallback
funnel-capi 코드 수정: NONE (read-only reuse)
실제 운영 변경: 0건
```

## 10초 요약

이 snippet 은 더클린커피 NPay 결제 click 시점을 추적하기 위한 **preview-only** 코드다. 실제 운영 전송, GTM publish, fetch / sendBeacon / XHR / gtag / fbq / backend API 호출은 모두 0이며, sessionStorage 4개 키 + console.log 만 사용한다.

핵심 변경 vs v0.2/v0.3:

- `session_uuid` 는 funnel-capi 의 `sessionStorage['__seo_funnel_session']` 을 **우선 재사용** (없으면 새 UUID).
- `SITE_SHOP_DETAIL.confirmOrderWithCartItems` (thin wrapper) 와 `window.confirmOrderWithCartItems` (글로벌) **둘 다 wrap** (이전 PC NPay click 시 buffer 0 문제 대응).
- payload 에 `funnel_capi_session_id`, `funnel_capi_eid_observed`, `intent_seq` 포함.
- `simulateConfirmNpay()` 헬퍼 추가 — 원본 결제 함수 호출 0, payload 만 buffer/console 에 박음.
- `intent_uuid` 는 `confirm_to_pay` 1회마다 새로 발급.

## 사용 방법 (3단계)

1. chrome 시크릿 창 + devtools 열기 (Console + Network 탭, "preserve log" 권장).
2. `https://thecleancoffee.com/shop_view/?idx=1` 진입.
3. 아래 snippet 한 묶음을 console 에 붙여넣고 enter. 그 후 진단 F → (선택) 진단 G 순서.

## Snippet (붙여넣기 가능, self-contained)

```javascript
/* CoffeeNpayIntentPreview v0.4 — preview only, no network send */
(function () {
  if (window.__coffeeNpayIntentPreviewV04Installed) {
    console.warn("[coffee_npay_intent_preview_v04] already installed — skip");
    return;
  }
  window.__coffeeNpayIntentPreviewV04Installed = true;

  var SITE = "thecleancoffee";
  var VERSION = "coffee_npay_intent_preview_v0.4_20260501";
  var BUFFER_KEY = "coffee_npay_intent_preview";
  var INTENT_SEQ_KEY = "__coffee_intent_seq";
  var INTENT_UUID_PENDING_KEY = "__coffee_intent_uuid_pending";
  var SESSION_UUID_KEY = "__coffee_session_uuid";   // funnel-capi 부재 시 fallback 용
  var FUNNEL_CAPI_SESSION_KEY = "__seo_funnel_session";
  var FUNNEL_CAPI_SENT_PREFIX = "funnelCapi::sent::";
  var WRAP_MARKER = "__coffee_npay_v04_wrapped";
  var MAX_BUFFER = 50;
  var LOG_PREFIX = "[coffee_npay_intent_preview_v04]";

  /* ── small utils ───────────────────────────────────────────────── */
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
  function newUuid() {
    try {
      if (window.crypto && typeof window.crypto.randomUUID === "function") {
        return window.crypto.randomUUID();
      }
    } catch (e) {}
    return "nu-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
  }
  function safeStr(v) { return v == null ? "" : String(v); }

  /* ── session / intent / seq ────────────────────────────────────── */
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

  /* ── funnel-capi observation (read-only, no wrap of fbq) ───────── */
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
      // sessionStorage iteration order is insertion order in major browsers — last is latest
      var lastKey = keys[keys.length - 1];
      return lastKey.replace(FUNNEL_CAPI_SENT_PREFIX, "");
    } catch (e) { return ""; }
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

  /* ── ua class ──────────────────────────────────────────────────── */
  function detectUaClass() {
    try {
      if (window.matchMedia && window.matchMedia("(max-width: 768px)").matches) return "mobile";
      if (window.matchMedia && window.matchMedia("(min-width: 769px)").matches) return "pc";
    } catch (e) {}
    return "unknown";
  }

  /* ── product metadata: 3-step fallback ─────────────────────────── */
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
      return {
        source: "dom_fallback",
        prod_idx: Number(idxRaw || 0),
        prod_code: code,
        prod_price: 0
      };
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

  /* ── selected option / quantity (PII 차단: count, quantity 만) ─── */
  function readSelectedOptionCount() {
    try {
      return Number(
        document.querySelectorAll("#prod-form-options ._option_select_row").length || 0
      );
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

  /* ── 1) initDetail wrap (no override behavior, just remember args) ── */
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
        try {
          if (kind === "npay") log(buildPayload("confirm_to_pay"));
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
        try {
          if (kind === "npay") log(buildPayload("confirm_to_pay"));
        } catch (err) { console.warn(LOG_PREFIX, "global confirm wrap error", err && err.message); }
        return origGlobalConfirm.apply(this, arguments);
      };
      wrapGlobalConfirm[WRAP_MARKER] = true;
      window.confirmOrderWithCartItems = wrapGlobalConfirm;
    }
  } catch (e) { console.warn(LOG_PREFIX, "global confirm wrap install error", e && e.message); }

  /* ── 4) mobile NPay button click backup (capture phase) ────────── */
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

  /* ── 5) public api on window.coffeeNpayIntentPreview ────────────── */
  function simulateConfirmNpay() {
    var payload = buildPayload("sanity_test", { isSimulation: true });
    log(payload);
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
      initDetailWrapped: !!(window.SITE_SHOP_DETAIL && window.SITE_SHOP_DETAIL.initDetail && window.SITE_SHOP_DETAIL.initDetail[WRAP_MARKER])
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
    console.log(LOG_PREFIX, "installed", VERSION, "preview only — no network send");
  } catch (e) {}
})();
```

### snippet 동작 가드 명세

| 영역 | 명세 |
|---|---|
| `fetch` / `sendBeacon` / `XMLHttpRequest` | snippet 안에 호출 0건 |
| `gtag(...)` / `fbq(...)` | snippet 안에 호출 0건 |
| backend `/api/...` | 호출 0건 |
| GTM publish | snippet 자체는 GTM 컨테이너 변경 불가 |
| 외부 도메인 send | 0건 |
| sessionStorage 키 | `coffee_npay_intent_preview` (buffer), `__coffee_intent_seq`, `__coffee_intent_uuid_pending`, `__coffee_session_uuid` (funnel-capi 부재 시 fallback) — 4개 |
| 읽기 전용 sessionStorage 키 | `__seo_funnel_session`, `funnelCapi::sent::*` — 우리 snippet 은 read 만, 수정 0 |
| funnel-capi 코드 수정 | 0건 |
| `SITE_SHOP_DETAIL` / 글로벌 `confirmOrderWithCartItems` 원본 함수 동작 | 그대로 호출됨 (wrap 은 hook 후 `apply` 위임). 사이트 동작 변경 0 |
| PII | phone / email / name / address / option text / option price 원문 수집 0 |
| 이중 wrap 가드 | `__coffee_npay_v04_wrapped` 마커. snippet 두 번 실행해도 wrap 한 번만 적용 |
| `simulateConfirmNpay()` | 원본 결제 함수 **미호출**. payload 만 buffer/console 에 박음. `is_simulation: true` 마킹 |

## 진단 F — 설치 / wrap / simulate 확인 (HIGH)

snippet 붙여넣고 enter 친 직후 console 에 다음 한 묶음을 그대로 붙여넣는다.

```javascript
/* F-1. 설치 + wrap 확인 */
window.coffeeNpayIntentPreview && window.coffeeNpayIntentPreview.status()

/* F-2. simulate (원본 결제 함수 미호출, payload 만 buffer 에 박음) */
window.coffeeNpayIntentPreview.simulateConfirmNpay()

/* F-3. simulate 후 buffer 변화 확인 */
({
  bufferLengthAfterSimulate: JSON.parse(sessionStorage.getItem("coffee_npay_intent_preview") || "[]").length,
  lastPayload: JSON.parse(sessionStorage.getItem("coffee_npay_intent_preview") || "[]").slice(-1)[0]
})
```

기대 결과:

| 항목 | 기대값 |
|---|---|
| F-1 `installed` | `true` |
| F-1 `sessionUuid` | `__seo_funnel_session` 의 값 (예 `momrm95adwj94z`). funnel-capi 가 살아 있어야 정상 |
| F-1 `funnelCapiSessionId` | 위와 동일 |
| F-1 `funnelCapiEidObserved` | 예 `ViewContent.1.<sessionId>` |
| F-1 `siteConfirmWrapped` | `true` |
| F-1 `globalConfirmWrapped` | `true` |
| F-1 `initDetailWrapped` | `true` (단, initDetail 이 snippet 실행 전에 끝났으면 fallback 으로 `false`. 그래도 metadata 는 inline_script_regex 또는 dom_fallback 으로 잡힘) |
| F-2 return | `intent_phase: "sanity_test"`, `is_simulation: true`, `intent_uuid` 발급, `intent_seq: 1+`, `funnel_capi_session_id` 채워짐 |
| F-3 `bufferLengthAfterSimulate` | F-1 직후 값 + 1 |
| F-3 `lastPayload.intent_phase` | `"sanity_test"` |
| F-3 `lastPayload.is_simulation` | `true` |
| F-3 `lastPayload.preview_only` | `true` |

판정:

- F-3 buffer 가 +1 → wrap 정상 (글로벌 함수 wrap 까지 살아 있음).
- F-3 buffer 변화 0 → snippet 자체 깨짐 또는 SITE_SHOP_DETAIL 객체가 다른 참조. console.warn 메시지 캡처 후 snippet 재실행.

## 진단 G — 실제 PC NPay 클릭 후 buffer 증가 확인 (MID)

**주의**: 실제 결제 redirect 가 일어날 수 있다. 결제 페이지로 넘어가지 않게 즉시 ESC / 뒤로가기 / 팝업 닫기 권장. devtools 의 "preserve log" 켜두면 redirect 후에도 console 출력이 살아 있다.

**paste 주의**: G-1 과 G-2 는 **반드시 따로 enter** 한다. 한 묶음으로 붙이면 G-1 의 마지막 표현식이 G-2 의 `(...)` 와 결합해 함수 호출로 잘못 파싱된다. 본 양식은 IIFE + `window.__g_before` 로 합쳐져도 안전하게 만들었지만, 분리해서 입력하는 것이 검증에 가장 깔끔하다.

```javascript
/* G-1. 클릭 직전 baseline (먼저 단독으로 enter) */
;(() => {
  window.__g_before = {
    bufferLength: JSON.parse(sessionStorage.getItem("coffee_npay_intent_preview") || "[]").length,
    intentSeq: Number(sessionStorage.getItem("__coffee_intent_seq") || "0"),
    funnelCapiSentEids: Object.keys(sessionStorage).filter(function (k) {
      return k.indexOf("funnelCapi::sent::") === 0;
    })
  };
  console.log("[g_before]", window.__g_before);
  return window.__g_before;
})()
```

이제 devtools 의 console 을 비운다 (`Clear console` 또는 🚫 아이콘). 그 직후 **PC NPay 버튼 클릭** → 즉시 ESC / 뒤로가기 / 결제 팝업 닫기. 그 다음 아래 G-2 를 단독으로 enter.

```javascript
/* G-2. 클릭 직후 delta (G-1 이후 단독으로 enter) */
;(() => {
  var before = window.__g_before || { bufferLength: 0, intentSeq: 0, funnelCapiSentEids: [] };
  var buf = JSON.parse(sessionStorage.getItem("coffee_npay_intent_preview") || "[]");
  var seq = Number(sessionStorage.getItem("__coffee_intent_seq") || "0");
  var sentKeys = Object.keys(sessionStorage).filter(function (k) {
    return k.indexOf("funnelCapi::sent::") === 0;
  });
  return {
    bufferLengthAfter: buf.length,
    bufferDelta: buf.length - before.bufferLength,
    intentSeqAfter: seq,
    intentSeqDelta: seq - before.intentSeq,
    lastPayload: buf.slice(-1)[0],
    newFunnelCapiSentEids: sentKeys.filter(function (k) {
      return before.funnelCapiSentEids.indexOf(k) < 0;
    })
  };
})()
```

분기:

| 결과 | 해석 |
|---|---|
| `bufferDelta >= 1`, `lastPayload.intent_phase === "confirm_to_pay"`, `lastPayload.is_simulation === false` | wrap 정상, NPay click hook 도달. funnel-capi 가 InitiateCheckout 또는 AddPaymentInfo 새 marker 출력했는지 console 캡처 보강 |
| `bufferDelta === 0`, F-3 simulate buffer +1 | 직접 호출 wrap 은 정상이지만 NPay SDK 의 click 이 메인 컨텍스트의 `confirmOrderWithCartItems` 를 호출 안 함. 4 layer 분석 결론대로 NPay 외부 redirect 가 메인 컨텍스트 BUY_BUTTON_HANDLER 를 우회. 다음 phase 에서 `naver.NaverPayButton.apply` 시점 `BUY_BUTTON_HANDLER` 직접 wrap 또는 mobile 경로(`._btn_mobile_npay` → 다이얼로그 → 확정) 시나리오로 재시도 |
| `bufferDelta === 0`, F-3 simulate buffer 0 | snippet 자체 깨짐. 페이지 reload 후 snippet 재실행 |
| `newFunnelCapiSentEids` 에 `InitiateCheckout.*` 또는 `AddPaymentInfo.*` 신규 추가 | funnel-capi 가 NPay click 시 해당 이벤트 mirror 한 정황. eid 값 기록 |
| `newFunnelCapiSentEids` 0 | NPay click 이 funnel-capi MIRROR 이벤트 발화 안 시킴. 4 layer 분석의 NPay 외부 redirect 결론과 정합 |

## v0.5 보강 — imweb orderCode retry capture (1-A 결과 + Codex backend 정찰 결과 반영)

### 배경

[[coffee-npay-intent-uuid-preservation-test-20260501]] 1-A 결과 + Codex 정찰로 다음 사실이 확정됨:

- NPay click 시 imweb 자체가 `o<YYYYMMDD><14자 hex>` 형식 orderCode 발급
- 그 orderCode 가 fbq InitiateCheckout 의 `eventID` 에 박혀 funnel-capi 가 sessionStorage `funnelCapi::sent::InitiateCheckout.<orderCode>.<rand>` 키로 저장
- 같은 orderCode 가 backend `imweb_orders.order_code` (local SQLite) / `tb_iamweb_users.order_number` (운영 PG) 에 저장됨

→ NPay click 직후 우리 wrap 에서 orderCode 를 capture 할 수 있다면 **(A++) deterministic 트랙** 가능.

### v0.5 추가 helper (v0.4 snippet 위에 1회 install)

v0.4 snippet 이 이미 설치된 chrome 세션에서 다음 보강을 추가로 붙여넣는다. v0.4 의 confirm_to_pay 시점 후 100ms / 500ms / 1500ms 3회에 걸쳐 funnel-capi sessionStorage 에서 orderCode 를 retry capture, 가장 최근 buffer entry 에 `imweb_order_code` 필드 박음.

```javascript
/* CoffeeNpayIntentPreview v0.5 보강 — orderCode retry capture (preview only) */
;(() => {
  if (window.__coffeeNpayIntentPreviewV05Installed) return console.log("v0.5 already installed");
  window.__coffeeNpayIntentPreviewV05Installed = true;

  var BUFFER_KEY = "coffee_npay_intent_preview";
  var FUNNEL_CAPI_SENT_PREFIX = "funnelCapi::sent::";
  var LOG_PREFIX = "[coffee_npay_intent_preview_v05]";
  var RETRY_DELAYS_MS = [100, 500, 1500];

  function readBuffer() {
    try { return JSON.parse(sessionStorage.getItem(BUFFER_KEY) || "[]"); }
    catch (e) { return []; }
  }
  function writeBuffer(buf) {
    try { sessionStorage.setItem(BUFFER_KEY, JSON.stringify(buf)); } catch (e) {}
  }
  function safeStr(v) { return v == null ? "" : String(v); }

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

  // v0.4 snippet 의 SITE_SHOP_DETAIL.confirmOrderWithCartItems wrap 위에 한 번 더 wrap.
  // 원본 동작 변경 0. confirm 호출 시점의 funnel-capi sent keys snapshot 후 retry 로
  // InitiateCheckout 신규 키를 잡아 buffer 의 가장 최근 entry 에 추가 박음.
  var sd = window.SITE_SHOP_DETAIL;
  if (sd && typeof sd.confirmOrderWithCartItems === "function") {
    var _orig = sd.confirmOrderWithCartItems;
    sd.confirmOrderWithCartItems = function (kind /*, backurl, params */) {
      var beforeKeys = [];
      try {
        if (kind === "npay") {
          for (var i = 0; i < sessionStorage.length; i++) {
            var k = sessionStorage.key(i);
            if (k && k.indexOf(FUNNEL_CAPI_SENT_PREFIX + "InitiateCheckout.") === 0) beforeKeys.push(k);
          }
          RETRY_DELAYS_MS.forEach(function (delay) {
            setTimeout(function () {
              var hit = findInitiateCheckoutEid(beforeKeys);
              if (!hit) return;
              try {
                var buf = readBuffer();
                if (!buf.length) return;
                var last = buf[buf.length - 1];
                if (last.intent_phase !== "confirm_to_pay") return;
                if (last.imweb_order_code) return; // already captured
                last.imweb_order_code = hit.order_code;
                last.imweb_order_code_eid = hit.eid;
                last.imweb_order_code_capture_delay_ms = delay;
                buf[buf.length - 1] = last;
                writeBuffer(buf);
                console.log(LOG_PREFIX, "captured orderCode @" + delay + "ms", hit);
              } catch (e) { console.warn(LOG_PREFIX, "capture err", e && e.message); }
            }, delay);
          });
        }
      } catch (e) { console.warn(LOG_PREFIX, "wrap err", e && e.message); }
      return _orig.apply(this, arguments);
    };
  }
  console.log(LOG_PREFIX, "v0.5 retry capture installed (3 retries: 100ms, 500ms, 1500ms)");
})()
```

### 동작 명세

| 항목 | 값 |
|---|---|
| 추가 sessionStorage 키 | 0 (v0.4 의 `coffee_npay_intent_preview` buffer 안 last entry 에만 필드 추가) |
| 외부 송출 / fetch / sendBeacon / XHR | 0 |
| funnel-capi 코드 수정 | 0 (read-only) |
| 원본 결제 함수 동작 변경 | 0 (`apply` 위임) |
| 이중 wrap 가드 | `window.__coffeeNpayIntentPreviewV05Installed` |
| retry 시점 | confirm_to_pay 호출 직후 `setTimeout 100/500/1500ms` 3회 (가장 빨리 잡힌 1회만 buffer 박음) |
| 추가되는 payload 필드 | `imweb_order_code`, `imweb_order_code_eid`, `imweb_order_code_capture_delay_ms` |

### v0.5 검증 명령

v0.4 snippet + v0.5 보강 둘 다 install 한 상태에서 PC NPay click → 즉시 ESC. 그 후:

```javascript
;(() => {
  var buf = JSON.parse(sessionStorage.getItem("coffee_npay_intent_preview") || "[]");
  var last = buf.slice(-1)[0] || null;
  return {
    bufferLength: buf.length,
    intent_phase: last && last.intent_phase,
    intent_uuid: last && last.intent_uuid,
    imweb_order_code: last && last.imweb_order_code,
    imweb_order_code_eid: last && last.imweb_order_code_eid,
    imweb_order_code_capture_delay_ms: last && last.imweb_order_code_capture_delay_ms,
    funnel_capi_session_id: last && last.funnel_capi_session_id
  };
})()
```

기대 결과:

| 필드 | 예상 |
|---|---|
| `intent_phase` | `"confirm_to_pay"` |
| `imweb_order_code` | `o<YYYYMMDD><hex>` 형식 (예 `o202605019a684b5c47669`) |
| `imweb_order_code_eid` | `InitiateCheckout.<order_code>.<suffix>` |
| `imweb_order_code_capture_delay_ms` | 100 / 500 / 1500 중 하나 (가장 빨리 잡힌 시점) |

캡처 결과의 `imweb_order_code` 가 `o<YYYYMMDD>` 형식이면 (A++) imweb orderCode 트랙 확정. 그 값을 backend SQL `SELECT * FROM imweb_orders WHERE order_code = '<value>'` 로 정찰하면 결제 완료 후 1:1 매핑되는지 즉시 검증 가능.

## v0.6 보강 — GA4 NPay synthetic transaction_id capture (preview only)

### 배경

v0.5 검증 중 console 에 imweb 이 띄운 줄 `NPAY - 202604101 - 1777642253241` 발견. 이는 **imweb 이 GA4 dataLayer 에 push 한 NPay synthetic transaction_id** 이고 형식 `NPAY - <imweb 자체 ID 9자리> - <Date.now() ms>`. 같은 형식이 이미 GA4 BigQuery `events_*.ecommerce.transaction_id` 에 다수 존재 ([[coffee-imweb-operational-readonly-20260501]] unassigned actual recovery 분석의 robust_absent 36/36 의 진짜 매칭 키).

v0.6 보강은 confirm_to_pay 시점 후 retry 로 `window.dataLayer` 안 NPay synthetic id 를 capture 해 buffer 의 같은 entry 에 `ga4_synthetic_transaction_id` 필드로 박는다. 이로써 (A++) imweb_order_code 매핑 + GA4 BigQuery transaction_id 매핑 두 채널 동시 확보.

### v0.6 추가 helper (v0.5 위에 1회 install)

```javascript
/* CoffeeNpayIntentPreview v0.6 보강 — GA4 NPay synthetic transaction_id capture (preview only) */
;(() => {
  if (window.__coffeeNpayIntentPreviewV06Installed) return console.log("v0.6 already installed");
  window.__coffeeNpayIntentPreviewV06Installed = true;

  var BUFFER_KEY = "coffee_npay_intent_preview";
  var LOG_PREFIX = "[coffee_npay_intent_preview_v06]";
  var RETRY_DELAYS_MS = [100, 500, 1500, 3000];
  var SYNTHETIC_TX_PATTERN = /^NPAY\s*-\s*\d+\s*-\s*\d{10,}$/;

  function readBuffer() {
    try { return JSON.parse(sessionStorage.getItem(BUFFER_KEY) || "[]"); }
    catch (e) { return []; }
  }
  function writeBuffer(buf) {
    try { sessionStorage.setItem(BUFFER_KEY, JSON.stringify(buf)); } catch (e) {}
  }

  // dataLayer 의 모든 entry 안 transaction_id 후보 검사 (ecommerce.transaction_id, transaction_id, ecommerce.purchase.actionField.id 등)
  function findSyntheticTxInDataLayer(beforeLength) {
    try {
      if (!Array.isArray(window.dataLayer)) return null;
      // beforeLength 이후 새로 push 된 항목만 우선 검사
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

  var sd = window.SITE_SHOP_DETAIL;
  if (sd && typeof sd.confirmOrderWithCartItems === "function") {
    var _orig = sd.confirmOrderWithCartItems;
    sd.confirmOrderWithCartItems = function (kind /*, backurl, params */) {
      var beforeDlLen = Array.isArray(window.dataLayer) ? window.dataLayer.length : 0;
      try {
        if (kind === "npay") {
          RETRY_DELAYS_MS.forEach(function (delay) {
            setTimeout(function () {
              var hit = findSyntheticTxInDataLayer(beforeDlLen);
              if (!hit) return;
              try {
                var buf = readBuffer();
                if (!buf.length) return;
                var last = buf[buf.length - 1];
                if (last.intent_phase !== "confirm_to_pay") return;
                if (last.ga4_synthetic_transaction_id) return; // already captured
                last.ga4_synthetic_transaction_id = hit.tx_id;
                last.ga4_synthetic_transaction_id_source = hit.source;
                last.ga4_synthetic_transaction_id_dl_event = hit.dl_event;
                last.ga4_synthetic_transaction_id_capture_delay_ms = delay;
                buf[buf.length - 1] = last;
                writeBuffer(buf);
                console.log(LOG_PREFIX, "captured synthetic_tx @" + delay + "ms", hit);
              } catch (e) { console.warn(LOG_PREFIX, "capture err", e && e.message); }
            }, delay);
          });
        }
      } catch (e) { console.warn(LOG_PREFIX, "wrap err", e && e.message); }
      return _orig.apply(this, arguments);
    };
  }
  console.log(LOG_PREFIX, "v0.6 retry capture installed (4 retries: 100ms, 500ms, 1500ms, 3000ms)");
})()
```

### v0.6 동작 명세

| 항목 | 값 |
|---|---|
| 추가 sessionStorage 키 | 0 (v0.4 buffer 안 last entry 에만 필드 추가) |
| fetch / sendBeacon / XHR / gtag / fbq / backend API 호출 | 0 |
| funnel-capi / dataLayer 코드 수정 | 0 (read-only, push 가로채지 않음) |
| 원본 결제 함수 동작 변경 | 0 (`apply` 위임) |
| 이중 wrap 가드 | `window.__coffeeNpayIntentPreviewV06Installed` |
| retry 시점 | confirm_to_pay 직후 100/500/1500/**3000** ms 4회 (synthetic tx 발화 시점이 v0.5 의 InitiateCheckout 보다 늦을 수 있어 3000ms 추가) |
| 추가 payload 필드 | `ga4_synthetic_transaction_id`, `ga4_synthetic_transaction_id_source`, `ga4_synthetic_transaction_id_dl_event`, `ga4_synthetic_transaction_id_capture_delay_ms` |

### v0.6 검증 명령

v0.4 + v0.5 + v0.6 모두 install 한 상태에서 PC NPay click → 즉시 ESC. 그 후:

```javascript
;(() => {
  var buf = JSON.parse(sessionStorage.getItem("coffee_npay_intent_preview") || "[]");
  var last = buf.slice(-1)[0] || null;
  var result = {
    bufferLength: buf.length,
    intent_phase: last && last.intent_phase,
    intent_uuid: last && last.intent_uuid,
    imweb_order_code: last && last.imweb_order_code,
    imweb_order_code_capture_delay_ms: last && last.imweb_order_code_capture_delay_ms,
    ga4_synthetic_transaction_id: last && last.ga4_synthetic_transaction_id,
    ga4_synthetic_transaction_id_source: last && last.ga4_synthetic_transaction_id_source,
    ga4_synthetic_transaction_id_dl_event: last && last.ga4_synthetic_transaction_id_dl_event,
    ga4_synthetic_transaction_id_capture_delay_ms: last && last.ga4_synthetic_transaction_id_capture_delay_ms,
    funnel_capi_session_id: last && last.funnel_capi_session_id
  };
  console.log("[v06_check json]\n" + JSON.stringify(result, null, 2));
  return result;
})()
```

### 기대 결과 분기

| `ga4_synthetic_transaction_id` | 해석 |
|---|---|
| `"NPAY - <9자리> - <13자리 ms>"` 형식 | (A++) + GA4 deterministic 매핑 트랙 둘 다 확정. backend ledger 와 BigQuery `transaction_id` 1:1 join 가능 |
| `null` 또는 `undefined` | imweb 이 dataLayer 에 push 안 했거나 4회 retry 시점 이후 push. (a) 다른 위치 (window 변수, sessionStorage, custom event) capture 시도, (b) dataLayer push 시점이 결제 완료 페이지 (`/shop_order_done`) 에서만 발생할 가능성 — 그 경우 별도 capture 단계 필요 |

### 주의

v0.6 는 `window.dataLayer` 를 read 만 한다. push 자체를 가로채지 않으므로 GTM tag / GA4 e-commerce 동작 변경 0. 단 capture 가 안 되면 `confirmOrderWithCartItems` 호출과 imweb dataLayer push 사이의 타이밍이 실제로 어떻게 되는지 별도 정찰 필요 (예: 결제 완료 페이지에서만 push 되는 케이스). 그 경우 v0.7 에서 결제 완료 페이지용 capture 추가 가능.

## 종료 / cleanup

```javascript
/* 페이지 reload 또는 시크릿 창 닫으면 sessionStorage 자동 소멸. 수동 cleanup: */
window.coffeeNpayIntentPreview && window.coffeeNpayIntentPreview.clearBuffer()
```

cleanup 후 `coffee_npay_intent_preview`, `__coffee_intent_seq`, `__coffee_intent_uuid_pending`, `__coffee_session_uuid` (4개) 가 삭제된다. funnel-capi 의 `__seo_funnel_session` 과 `funnelCapi::sent::*` 는 우리 snippet 이 만들지 않았으므로 그대로 남는다.

## 외부 시스템 영향

| 시스템 | 영향 |
|---|---|
| imweb 사이트 | 변경 0 (snippet 은 chrome 세션 안에서만 동작, page reload 시 사라짐) |
| GTM workspace | 변경 0 |
| funnel-capi 코드 | 수정 0 (read-only reuse) |
| GA4 / Meta / TikTok / Google Ads | 신규 송출 0 |
| 로컬 DB | 신규 테이블 0 |
| 외부 API | 신규 호출 0 |

## 다음 단계 (별도 phase)

| 단계 | 트리거 | 산출물 |
|---|---|---|
| Step 1 | TJ 진단 F + G 실행 후 결과 캡처 | 결과를 [[coffee-live-tracking-inventory-20260501]] §7~§8 에 추가 반영 |
| Step 2 | 진단 G 에서 buffer 증가 확인 | NPay url 에 `intent_uuid` query param 부착했을 때 Imweb redirect URL / Imweb meta_data / NPay channel_order_no 응답 중 어디까지 보존되는지 sandbox 결제 1건 으로 검증 |
| Step 3 | 보존 검증 결과 받음 | (A) deterministic 트랙 또는 (B) ledger + (prod_code, quantity, estimated_item_total, order_time_kst ± 30분) 휴리스틱 트랙 결정 |
| Step 4 | 트랙 결정 | local backend `POST /api/coffee/intent/dry-run` 추가 (write 0) |
| Step 5 | dry-run PASS + TJ 승인 | local SQLite `coffee_npay_intent_log` 테이블 추가 |
| Step 6 | 정합성 7일 모니터링 | GTM Production workspace publish |
| Step 7 | live PASS + ROAS 정합성 | GA4 / Meta CAPI 보강 전송 승인 게이트 별도 진행 |
