# Header Guard v3.1.3 VirtualAccountIssued 삽입 코드

작성 시각: 2026-05-21 20:20 KST
기준일: 2026-05-21
문서 성격: 아임웹 헤더 코드 상단 교체용 전체 코드 / 운영 저장 전 검토본
Lane: Green code draft. 이 문서는 코드 초안이며 아임웹 저장, GTM publish, Meta actual send, VM Cloud deploy를 하지 않는다.

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - AGENTS.md
    - docurule.md
    - project/header-guard-v312-virtual-account-issued-code-20260521.md
    - project/virtual-account-issued-immediate-fire-plan-20260521.md
    - gdn/imweb-v443-full-paste-code-20260521.md
  lane: Green for code document generation; Red for Imweb production custom-code save
  allowed_actions:
    - read_only_code_review
    - paste_code_document_generation
    - local_syntax_check
  forbidden_actions:
    - imweb_live_custom_code_save
    - gtm_publish
    - meta_platform_send_test
    - backend_deploy
    - vm_cloud_write
    - operating_db_write
  source_window_freshness_confidence:
    source: local repository code docs + current Imweb v4.4.3 paste-code document
    window: 2026-05-21 current Imweb header/footer code generation
    freshness: 2026-05-21 20:20 KST
    confidence: 0.9
```

## 10초 요약

이 문서는 가상계좌 주문생성/미입금 완료 화면에서 Meta Pixel custom event `VirtualAccountIssued`가 안 보이는 문제를 보강하는 헤더 상단 교체 코드다. 현재 적용된 v4.4.3 Google click-id 보존 코드와 푸터 코드는 그대로 유지하고, 기존 `server-payment-decision-guard-v3-1-1` 블록만 아래 v3.1.3 코드로 교체한다. 이 이벤트는 매출 구매가 아니라 "가상계좌가 발급됐다"는 중간 신호이므로 `Purchase`를 보내지 않고 `value=0`으로 보낸다.

## 검토한 기존 문서

- `/Users/vibetj/coding/seo/project/header-guard-v312-virtual-account-issued-code-20260521.md`
- `/Users/vibetj/coding/seo/project/virtual-account-issued-immediate-fire-plan-20260521.md`
- `/Users/vibetj/coding/seo/gdn/imweb-v443-full-paste-code-20260521.md`

## 적용 범위

아임웹 `헤더 코드 상단`에서 기존 `server-payment-decision-guard-v3-1-1` 블록 전체를 아래 코드로 교체한다.

그대로 둔다.

- `BI / Google Click ID Bootstrap v1`의 `2026-05-21-biocom-click-id-bootstrap-v1-1` 블록
- 헤더 코드의 Meta Pixel base, GTM, TikTok Guard
- 푸터 Block 1/2/3/4 전체
- 현재 v4.4.3 Google click-id guard와 checkout/payment-success 수집 구조

## v3.1.2에서 바꾼 점

- 현재 v4.4.3 기준으로 version/key/log prefix를 v3.1.3으로 분리했다.
- 완료 페이지 DOM과 footer context가 늦게 생기는 아임웹 특성을 반영해 즉시 발화를 1회가 아니라 `80ms, 300ms, 800ms, 1500ms, 2500ms, 4000ms`로 재확인한다. 중복은 safe key로 막는다.
- 기존 Purchase 차단 흐름은 유지한다. 브라우저가 `Purchase`를 시도하면 기존처럼 서버 `payment-decision`을 보고 confirmed는 Purchase 허용, pending은 `VirtualAccountIssued`로 낮춘다.
- 브라우저가 `Purchase`를 아예 시도하지 않는 가상계좌 완료 화면도 DOM/저장 context 힌트만으로 `VirtualAccountIssued`를 1회 보낼 수 있게 한다.
- `VirtualAccountIssued` customData에는 `is_purchase=no`, `is_paid=no`, `payment_status=pending` 성격만 남긴다. 실제 주문 금액을 Meta 매출로 보내지 않는다.

## 교체 코드

```html
<script>
(function () {
  'use strict';

  var CONFIG = {
    snippetVersion: '2026-05-21-server-payment-decision-guard-v3-1-3',
    pixelId: '1283400029487161',
    decisionEndpoint: 'https://att.ainativeos.net/api/attribution/payment-decision',
    site: 'biocom',
    store: 'biocom',
    vbankEventName: 'VirtualAccountIssued',
    unknownEventName: 'PurchaseDecisionUnknown',
    blockedEventName: 'PurchaseBlocked',
    requestTimeoutMs: 8000,
    holdMs: 50,
    decisionRetryDelayMs: 500,
    purchaseFallbackDelayMs: 1800,
    decisionCacheTtlMs: 2 * 60 * 1000,
    blockDecisionCacheTtlMs: 30 * 1000,
    unknownDecisionCacheTtlMs: 10 * 1000,
    decisionCachePrefix: '__biocom_payment_decision_guard_v313__:',
    wrapPollMs: [0, 50, 100, 200, 500, 1000, 2000, 3500, 5000, 8000],
    customEventRetryMs: [0, 150, 400, 800, 1500, 2500],
    immediateFirePollMs: [80, 300, 800, 1500, 2500, 4000],
    vbankSentPrefix: '__biocom_virtual_account_issued_sent__:',
    paymentPageBehaviorKey: '__seo_payment_page_behavior_v1',
    checkoutContextKey: '__seo_checkout_context',
    paymentSuccessContextKey: '__seo_payment_success_context',
    logPrefix: '[biocom-server-payment-decision-guard-v3.1.3]'
  };

  function safeString(value) {
    if (value === null || value === undefined) return '';
    return String(value);
  }

  function compact(value) {
    return safeString(value).replace(/\s+/g, ' ').replace(/[|]/g, '/');
  }

  function firstNonEmpty(values) {
    for (var i = 0; i < values.length; i += 1) {
      var value = safeString(values[i]).trim();
      if (value) return value;
    }
    return '';
  }

  function isPaymentCompletePage() {
    var href = safeString(window.location.href).toLowerCase();
    var path = safeString(window.location.pathname).toLowerCase();
    return (
      path.indexOf('shop_payment_complete') >= 0 ||
      path.indexOf('shop_order_done') >= 0 ||
      href.indexOf('order_complete') >= 0 ||
      href.indexOf('payment_complete') >= 0 ||
      href.indexOf('payment_success') >= 0
    );
  }

  if (!isPaymentCompletePage()) return;
  if (window.__BIOCOM_SERVER_PAYMENT_DECISION_GUARD_V313_INSTALLED__) return;
  window.__BIOCOM_SERVER_PAYMENT_DECISION_GUARD_V313_INSTALLED__ = true;

  var allowedPurchaseEventIds = {};
  var handledAttemptKeys = {};
  var fallbackAfterObserveNoEventIds = {};
  var purchaseFallbackAfterObserveNoEventIds = {};
  var virtualAccountIssuedEventIds = {};
  var activeFbPixel = window.FB_PIXEL;
  var activeDecisionPromises = {};

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

  function getCookie(name) {
    var target = safeString(name) + '=';
    var cookies = safeString(document.cookie).split(';');
    for (var i = 0; i < cookies.length; i += 1) {
      var cookie = cookies[i].trim();
      if (cookie.indexOf(target) === 0) {
        return decodeURIComponent(cookie.slice(target.length));
      }
    }
    return '';
  }

  function safeParseJson(raw) {
    if (!raw) return {};
    try {
      var parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch (error) {
      return {};
    }
  }

  function readSessionJson(key) {
    try {
      if (!window.sessionStorage) return {};
      return safeParseJson(window.sessionStorage.getItem(key));
    } catch (error) {
      return {};
    }
  }

  function hasVirtualAccountText(value) {
    var text = safeString(value).toLowerCase();
    if (!text) return false;
    return /가상\s*계좌|무통장|입금\s*계좌|입금\s*기한|입금\s*예정|계좌\s*번호|bank[_\s-]*transfer|virtual[_\s-]*account|vbank/.test(text);
  }

  function getStoredPaymentMethodHint() {
    var behavior = readSessionJson(CONFIG.paymentPageBehaviorKey);
    var checkout = readSessionJson(CONFIG.checkoutContextKey);
    var success = readSessionJson(CONFIG.paymentSuccessContextKey);
    return firstNonEmpty([
      behavior.selected_payment_method,
      behavior.payment_method_attempted,
      behavior.selectedPaymentMethod,
      checkout.selected_payment_method,
      checkout.payment_method,
      checkout.paymentMethod,
      success.selected_payment_method,
      success.payment_method,
      success.paymentMethod
    ]);
  }

  function getBodyTextForPaymentHint() {
    try {
      return safeString(document.body && (document.body.innerText || document.body.textContent)).slice(0, 12000);
    } catch (error) {
      return '';
    }
  }

  function detectVirtualAccountHint() {
    var storedMethod = getStoredPaymentMethodHint();
    if (hasVirtualAccountText(storedMethod)) {
      return {
        found: true,
        source: 'stored_payment_method',
        method: storedMethod
      };
    }

    var bodyText = getBodyTextForPaymentHint();
    if (hasVirtualAccountText(bodyText)) {
      return {
        found: true,
        source: 'completion_page_text',
        method: 'virtual_account_hint_text'
      };
    }

    return {
      found: false,
      source: 'none',
      method: ''
    };
  }

  function getOrderCodeFromEventId(eventId) {
    var value = safeString(eventId);
    var match = value.match(/^Purchase\.(o[0-9A-Za-z_-]+)/);
    return match ? match[1] : '';
  }

  function buildContext(eventId) {
    return {
      eventId: safeString(eventId),
      orderCode: firstNonEmpty([
        getSearchParam(['order_code', 'orderCode']),
        getSearchParam(['order_code', 'orderCode'], document.referrer),
        getOrderCodeFromEventId(eventId)
      ]),
      orderNo: firstNonEmpty([
        getSearchParam(['order_no', 'orderNo', 'order_id', 'orderId']),
        getSearchParam(['order_no', 'orderNo', 'order_id', 'orderId'], document.referrer)
      ]),
      orderId: firstNonEmpty([
        getSearchParam(['order_id', 'orderId']),
        getSearchParam(['order_id', 'orderId'], document.referrer)
      ]),
      paymentCode: firstNonEmpty([
        getSearchParam(['payment_code', 'paymentCode']),
        getSearchParam(['payment_code', 'paymentCode'], document.referrer)
      ]),
      paymentKey: firstNonEmpty([
        getSearchParam(['payment_key', 'paymentKey']),
        getSearchParam(['payment_key', 'paymentKey'], document.referrer)
      ]),
      store: CONFIG.store
    };
  }

  function hasDecisionLookup(context) {
    return Boolean(context.orderCode || context.orderId || context.orderNo || context.paymentCode || context.paymentKey);
  }

  function buildAttemptKey(context) {
    var material = buildHashSource(context);
    return material ? 'attempt:' + simpleHash(material) : '';
  }

  function buildDecisionUrl(context) {
    var url = new URL(CONFIG.decisionEndpoint);
    url.searchParams.set('site', CONFIG.site);
    url.searchParams.set('store', context.store || CONFIG.store);
    if (context.orderCode) url.searchParams.set('order_code', context.orderCode);
    if (context.orderId) url.searchParams.set('order_id', context.orderId);
    if (context.orderNo) url.searchParams.set('order_no', context.orderNo);
    if (context.paymentCode) url.searchParams.set('payment_code', context.paymentCode);
    if (context.paymentKey) url.searchParams.set('payment_key', context.paymentKey);
    return url.toString();
  }

  function normalizeIdentifier(value) {
    return safeString(value)
      .trim()
      .replace(/\s+/g, '')
      .toLowerCase();
  }

  function normalizeOrderNo(value) {
    return normalizeIdentifier(value)
      .replace(/-p\d+$/i, '')
      .replace(/[^0-9a-z_-]/g, '');
  }

  function buildHashSource(context) {
    var site = CONFIG.site;
    var store = normalizeIdentifier(context.store || CONFIG.store);
    var orderCode = normalizeIdentifier(context.orderCode);
    var orderNo = normalizeOrderNo(firstNonEmpty([context.orderNo, context.orderId]));
    var paymentCode = normalizeIdentifier(context.paymentCode);
    var paymentKey = normalizeIdentifier(context.paymentKey);

    if (orderCode && paymentCode) {
      return JSON.stringify({
        site: site,
        store: store,
        tier: 'orderCode_paymentCode',
        orderCode: orderCode,
        paymentCode: paymentCode
      });
    }

    if (orderCode && orderNo) {
      return JSON.stringify({
        site: site,
        store: store,
        tier: 'orderCode_orderNo',
        orderCode: orderCode,
        orderNo: orderNo
      });
    }

    if (paymentCode && orderNo) {
      return JSON.stringify({
        site: site,
        store: store,
        tier: 'paymentCode_orderNo',
        paymentCode: paymentCode,
        orderNo: orderNo
      });
    }

    if (paymentKey) {
      return JSON.stringify({
        site: site,
        store: store,
        tier: 'paymentKey',
        paymentKey: paymentKey
      });
    }

    if (orderNo) {
      return JSON.stringify({
        site: site,
        store: store,
        tier: 'orderNo',
        orderNo: orderNo
      });
    }

    return JSON.stringify({
      site: site,
      store: store,
      tier: 'fallback',
      eventId: normalizeIdentifier(context.eventId)
    });
  }

  function simpleHash(text) {
    var hash = 2166136261;
    for (var i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    return ('00000000' + (hash >>> 0).toString(16)).slice(-8);
  }

  function hashText(text) {
    try {
      if (window.crypto && window.crypto.subtle && window.TextEncoder) {
        return window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)).then(function (buffer) {
          var bytes = Array.prototype.slice.call(new Uint8Array(buffer));
          var hex = bytes.map(function (byte) {
            return ('00' + byte.toString(16)).slice(-2);
          }).join('');
          return hex.slice(0, 24);
        });
      }
    } catch (error) {
      // Fall through to non-cryptographic hash for cache key only.
    }
    return Promise.resolve(simpleHash(text));
  }

  function buildSafeCacheKey(context) {
    return hashText(buildHashSource(context)).then(function (hash) {
      return CONFIG.decisionCachePrefix + hash;
    });
  }

  function fallbackSafeRef(context) {
    return 'safe_' + simpleHash(buildHashSource(context));
  }

  function buildVirtualAccountSentKey(context) {
    return CONFIG.vbankSentPrefix + fallbackSafeRef(context);
  }

  function hasSentVirtualAccountIssued(context) {
    try {
      var key = buildVirtualAccountSentKey(context);
      if (virtualAccountIssuedEventIds[key]) return true;
      return Boolean(window.sessionStorage && window.sessionStorage.getItem(key));
    } catch (error) {
      return false;
    }
  }

  function rememberVirtualAccountIssued(context) {
    try {
      var key = buildVirtualAccountSentKey(context);
      virtualAccountIssuedEventIds[key] = true;
      if (window.sessionStorage) {
        window.sessionStorage.setItem(key, new Date().toISOString());
      }
    } catch (error) {
      // Dedupe best effort only. Event ID still remains safe and deterministic.
    }
  }

  function compactDecision(decision) {
    decision = decision || {};
    return {
      status: safeString(decision.status || 'unknown'),
      browserAction: safeString(decision.browserAction || 'hold_or_block_purchase'),
      reason: safeString(decision.reason || ''),
      matchedBy: safeString(decision.matchedBy || ''),
      confidence: safeString(decision.confidence || '')
    };
  }

  function extractDecision(responseBody) {
    var body = responseBody || {};
    var result = body.result && typeof body.result === 'object' ? body.result : {};
    var data = body.data && typeof body.data === 'object' ? body.data : {};
    var decision = body.decision || result.decision || data.decision || result || data || {};

    return {
      status: firstNonEmpty([
        body.status,
        body.decision_status,
        result.status,
        data.status,
        decision.status
      ]) || 'unknown',
      browserAction: firstNonEmpty([
        body.browserAction,
        body.browser_action,
        result.browserAction,
        result.browser_action,
        data.browserAction,
        data.browser_action,
        decision.browserAction,
        decision.browser_action
      ]) || 'hold_or_block_purchase',
      reason: firstNonEmpty([
        body.reason,
        body.error,
        result.reason,
        result.error,
        data.reason,
        data.error,
        decision.reason,
        decision.error
      ]),
      matchedBy: firstNonEmpty([
        body.matchedBy,
        body.matched_by,
        result.matchedBy,
        result.matched_by,
        data.matchedBy,
        data.matched_by,
        decision.matchedBy,
        decision.matched_by
      ]),
      confidence: firstNonEmpty([
        body.confidence,
        result.confidence,
        data.confidence,
        decision.confidence
      ])
    };
  }

  function normalizeDecisionPayload(responseBody, context, source, endpointStatus) {
    responseBody = responseBody || {};
    var result = responseBody.result && typeof responseBody.result === 'object' ? responseBody.result : {};
    var data = responseBody.data && typeof responseBody.data === 'object' ? responseBody.data : {};
    var decision = extractDecision(responseBody);

    return {
      decision: compactDecision(decision),
      safeRef: firstNonEmpty([
        responseBody.safe_ref,
        responseBody.safeRef,
        result.safe_ref,
        result.safeRef,
        data.safe_ref,
        data.safeRef,
        decision.safe_ref,
        decision.safeRef,
        fallbackSafeRef(context)
      ]),
      source: firstNonEmpty([source, responseBody.source, result.source, data.source, decision.source, 'payment-decision']),
      endpointStatus: endpointStatus || 0,
      fromCache: false,
      noCache: Boolean(responseBody.noCache)
    };
  }

  function readDecisionCache(context) {
    return buildSafeCacheKey(context).then(function (key) {
      try {
        var raw = window.sessionStorage && window.sessionStorage.getItem(key);
        if (!raw) return null;

        var parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return null;
        if (!parsed.expiresAt || Number(parsed.expiresAt) <= Date.now()) {
          window.sessionStorage.removeItem(key);
          return null;
        }

        return {
          decision: compactDecision(parsed.decision || {}),
          safeRef: safeString(parsed.safe_ref || parsed.safeRef || fallbackSafeRef(context)),
          source: safeString(parsed.source || 'session_cache'),
          endpointStatus: 0,
          fromCache: true
        };
      } catch (error) {
        return null;
      }
    });
  }

  function isAllowPurchasePayload(payload) {
    var decision = payload && payload.decision ? payload.decision : {};
    return decision.browserAction === 'allow_purchase' || decision.status === 'confirmed';
  }

  function isFetchFailurePayload(payload) {
    var decision = payload && payload.decision ? payload.decision : {};
    return Boolean(
      payload && payload.noCache ||
      payload && payload.source === 'fetch_failed' ||
      decision.reason === 'decision_fetch_failed' ||
      decision.reason === 'decision_endpoint_error' ||
      decision.reason === 'decision_parse_failed'
    );
  }

  function getDecisionCacheTtlMs(payload) {
    var decision = payload && payload.decision ? payload.decision : {};
    if (!payload || !decision) return 0;
    if (isFetchFailurePayload(payload)) return 0;
    if (isAllowPurchasePayload(payload)) return CONFIG.decisionCacheTtlMs;
    if (decision.browserAction === 'block_purchase_virtual_account') return CONFIG.blockDecisionCacheTtlMs;
    if (decision.browserAction === 'block_purchase') return CONFIG.blockDecisionCacheTtlMs;
    if (decision.status === 'unknown' || decision.browserAction === 'hold_or_block_purchase') {
      return CONFIG.unknownDecisionCacheTtlMs;
    }
    return 0;
  }

  function parseCachedDecision(raw, context) {
    if (!raw) return null;
    try {
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      if (!parsed.expiresAt || Number(parsed.expiresAt) <= Date.now()) return null;
      return {
        decision: compactDecision(parsed.decision || {}),
        safeRef: safeString(parsed.safe_ref || parsed.safeRef || fallbackSafeRef(context)),
        source: safeString(parsed.source || 'session_cache'),
        endpointStatus: 0,
        fromCache: true
      };
    } catch (error) {
      return null;
    }
  }

  function shouldOverwriteDecisionCache(currentPayload, nextPayload) {
    if (!nextPayload || !nextPayload.decision) return false;
    if (isFetchFailurePayload(nextPayload)) return false;
    if (isAllowPurchasePayload(nextPayload)) return true;
    if (currentPayload && isAllowPurchasePayload(currentPayload)) return false;
    return getDecisionCacheTtlMs(nextPayload) > 0;
  }

  function writeDecisionCache(context, payload, source) {
    if (!payload || !payload.decision || !hasDecisionLookup(context)) return Promise.resolve(false);

    return buildSafeCacheKey(context).then(function (key) {
      try {
        var currentRaw = window.sessionStorage && window.sessionStorage.getItem(key);
        var currentPayload = parseCachedDecision(currentRaw, context);

        if (!shouldOverwriteDecisionCache(currentPayload, payload)) {
          return false;
        }

        var ttlMs = getDecisionCacheTtlMs(payload);
        if (ttlMs <= 0) return false;

        var expiresAt = Date.now() + ttlMs;
        var value = {
          snippetVersion: CONFIG.snippetVersion,
          cachedAt: new Date().toISOString(),
          expiresAt: expiresAt,
          safe_ref: payload.safeRef || fallbackSafeRef(context),
          source: source || payload.source || 'payment-decision',
          decision: compactDecision(payload.decision)
        };
        window.sessionStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch (error) {
        return false;
      }
    });
  }

  function logDiagnostic(label, fields) {
    if (!window.console || !console.info) return;
    fields = fields || {};
    var parts = [];
    for (var key in fields) {
      if (!Object.prototype.hasOwnProperty.call(fields, key)) continue;
      parts.push(key + '=' + compact(fields[key]));
    }
    console.info(CONFIG.logPrefix + ' ' + label + ' ' + parts.join(' '));
  }

  function rememberLastDiagnostic(fields) {
    try {
      fields.updatedAt = new Date().toISOString();
      fields.snippetVersion = CONFIG.snippetVersion;
      fields.locationClass = 'payment_complete';
      window.__BIOCOM_SERVER_PAYMENT_DECISION_LAST__ = fields;
    } catch (error) {
      // Assignment can fail in unusual browser contexts.
    }
  }

  function buildSafeLogFields(context, payload, extra) {
    var decision = payload && payload.decision ? payload.decision : {};
    var fields = {
      branch: decision.browserAction || 'unknown',
      status: decision.status || 'unknown',
      reason: decision.reason || '',
      matchedBy: decision.matchedBy || '',
      confidence: decision.confidence || '',
      source: payload && payload.source ? payload.source : '',
      safeRef: payload && payload.safeRef ? payload.safeRef : fallbackSafeRef(context),
      fromCache: payload && payload.fromCache ? 'yes' : 'no',
      hasOrderCode: context.orderCode ? 'yes' : 'no',
      hasOrderNo: context.orderNo ? 'yes' : 'no',
      hasOrderId: context.orderId ? 'yes' : 'no',
      hasPaymentCode: context.paymentCode ? 'yes' : 'no',
      hasPaymentKey: context.paymentKey ? 'yes' : 'no'
    };

    extra = extra || {};
    for (var key in extra) {
      if (Object.prototype.hasOwnProperty.call(extra, key)) fields[key] = extra[key];
    }

    return fields;
  }

  function logDecisionBranch(context, payload, source) {
    var fields = buildSafeLogFields(context, payload, { source: source || payload.source || '' });
    logDiagnostic('decision', fields);
    rememberLastDiagnostic(fields);
  }

  function fetchWithTimeout(url, timeoutMs) {
    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = window.setTimeout(function () {
      if (controller) controller.abort();
    }, timeoutMs);

    return fetch(url, {
      method: 'GET',
      credentials: 'omit',
      mode: 'cors',
      cache: 'no-store',
      keepalive: true,
      signal: controller ? controller.signal : undefined
    }).then(function (response) {
      return response.json().then(function (json) {
        return { ok: response.ok, status: response.status, body: json };
      }).catch(function () {
        return { ok: response.ok, status: response.status, body: null };
      });
    }).finally(function () {
      window.clearTimeout(timer);
    });
  }

  function shouldRetryDecision(context, payload) {
    var decision = payload && payload.decision ? payload.decision : {};
    return Boolean(
      hasDecisionLookup(context) &&
      decision.status === 'unknown' &&
      decision.reason === 'no_toss_or_ledger_match'
    );
  }

  function queryDecisionOnce(context) {
    if (!hasDecisionLookup(context)) {
      return Promise.resolve(normalizeDecisionPayload({
        decision: {
          status: 'unknown',
          browserAction: 'hold_or_block_purchase',
          reason: 'missing_order_identifiers'
        }
      }, context, 'local_guard', 0));
    }

    return fetchWithTimeout(buildDecisionUrl(context), CONFIG.requestTimeoutMs)
      .then(function (response) {
        if (!response.ok || !response.body || response.body.ok !== true) {
          return normalizeDecisionPayload({
            decision: {
              status: 'unknown',
              browserAction: 'hold_or_block_purchase',
              reason: 'decision_endpoint_error',
              endpointStatus: response.status
            },
            noCache: true
          }, context, 'endpoint_error', response.status);
        }
        return normalizeDecisionPayload(response.body, context, 'payment-decision', response.status);
      })
      .catch(function (error) {
        return normalizeDecisionPayload({
          decision: {
            status: 'unknown',
            browserAction: 'hold_or_block_purchase',
            reason: 'decision_fetch_failed',
            message: error && error.message ? error.message : safeString(error)
          },
          noCache: true
        }, context, 'fetch_failed', 0);
      });
  }

  function queryDecision(context) {
    return queryDecisionOnce(context).then(function (payload) {
      if (!shouldRetryDecision(context, payload)) return payload;

      logDiagnostic('decision_retry_scheduled', buildSafeLogFields(context, payload, {
        retryDelayMs: CONFIG.decisionRetryDelayMs
      }));

      return new Promise(function (resolve) {
        window.setTimeout(resolve, CONFIG.decisionRetryDelayMs);
      }).then(function () {
        return queryDecisionOnce(context);
      }).then(function (retryPayload) {
        logDiagnostic('decision_retry_result', buildSafeLogFields(context, retryPayload));
        return retryPayload;
      });
    });
  }

  function getDecisionPromise(context, source) {
    return buildSafeCacheKey(context).then(function (key) {
      if (activeDecisionPromises[key]) return activeDecisionPromises[key];

      activeDecisionPromises[key] = readDecisionCache(context).then(function (cached) {
        if (cached) return cached;

        return queryDecision(context).then(function (payload) {
          return writeDecisionCache(context, payload, source).then(function () {
            return payload;
          });
        });
      }).finally(function () {
        delete activeDecisionPromises[key];
      });

      return activeDecisionPromises[key];
    });
  }

  function prefetchDecision() {
    var context = buildContext('');
    if (!hasDecisionLookup(context)) {
      logDiagnostic('decision_prefetch_skipped', {
        reason: 'missing_order_identifiers',
        safeRef: fallbackSafeRef(context)
      });
      return;
    }

    readDecisionCache(context).then(function (cached) {
      if (cached) {
        logDiagnostic('decision_prefetch_cache_hit', buildSafeLogFields(context, cached));
        return cached;
      }

      return getDecisionPromise(context, 'prefetch').then(function (payload) {
        logDiagnostic('decision_prefetch_result', buildSafeLogFields(context, payload));
        return payload;
      });
    }).catch(function (error) {
      logDiagnostic('decision_prefetch_failed', {
        reason: error && error.message ? error.message : safeString(error),
        safeRef: fallbackSafeRef(context)
      });
    });
  }

  function getRawFbq() {
    var fbq = window.fbq;
    if (!fbq) return null;
    return fbq.__BIOCOM_SERVER_PAYMENT_DECISION_GUARD_RAW__ || fbq;
  }

  function callRawFbq(args) {
    var rawFbq = getRawFbq();
    if (typeof rawFbq !== 'function') return false;
    rawFbq.apply(window, args);
    return true;
  }

  function markAllowed(eventId) {
    var id = safeString(eventId);
    if (!id) return;
    allowedPurchaseEventIds[id] = true;
    window.setTimeout(function () {
      delete allowedPurchaseEventIds[id];
    }, 2000);
  }

  function isAllowed(eventId) {
    var id = safeString(eventId);
    return Boolean(id && allowedPurchaseEventIds[id]);
  }

  function buildCustomEventId(name, context) {
    return name + '.' + firstNonEmpty([
      fallbackSafeRef(context),
      String(Date.now())
    ]);
  }

  function buildCustomData(value, currency, context, payload) {
    var decision = payload.decision || {};
    return {
      value: Number(value) || 0,
      currency: currency || 'KRW',
      payment_decision_status: decision.status || 'unknown',
      payment_decision_reason: decision.reason || '',
      payment_status: payload.paymentStatus || decision.status || 'unknown',
      payment_method: payload.paymentMethod || '',
      event_source: payload.eventSource || '',
      event_trigger: payload.eventTrigger || '',
      decision_safe_ref: payload.safeRef || fallbackSafeRef(context),
      has_order_code: context.orderCode ? 'yes' : 'no',
      has_order_no: context.orderNo ? 'yes' : 'no',
      has_payment_code: context.paymentCode ? 'yes' : 'no',
      has_payment_key: context.paymentKey ? 'yes' : 'no',
      snippet_version: CONFIG.snippetVersion,
      virtual_account_issue_source: payload.virtualAccountIssueSource || '',
      virtual_account_hint_source: payload.virtualAccountHintSource || '',
      is_purchase: payload.isPurchase || '',
      is_paid: payload.isPaid || ''
    };
  }

  function sendPixelFallback(name, customData, eventId) {
    try {
      var url = new URL('https://www.facebook.com/tr/');
      url.searchParams.set('id', CONFIG.pixelId);
      url.searchParams.set('ev', name);
      url.searchParams.set('dl', window.location.href);
      url.searchParams.set('rl', document.referrer || '');
      url.searchParams.set('if', 'false');
      url.searchParams.set('ts', String(Date.now()));
      url.searchParams.set('eid', eventId);

      var fbp = getCookie('_fbp');
      var fbc = getCookie('_fbc');
      if (fbp) url.searchParams.set('fbp', fbp);
      if (fbc) url.searchParams.set('fbc', fbc);

      for (var key in customData) {
        if (!Object.prototype.hasOwnProperty.call(customData, key)) continue;
        var value = customData[key];
        if (value === null || value === undefined || value === '') continue;
        url.searchParams.set('cd[' + key + ']', safeString(value));
      }

      var img = new Image();
      img.src = url.toString();
      return true;
    } catch (error) {
      return false;
    }
  }

  function countPixelNetworkMatches(name, eventId) {
    var result = {
      matchCount: 0,
      eventOnlyCount: 0,
      pixelRequestCount: 0,
      error: ''
    };

    try {
      if (window.performance && typeof window.performance.getEntriesByType === 'function') {
        var entries = window.performance.getEntriesByType('resource') || [];
        for (var i = 0; i < entries.length; i += 1) {
          var rawUrl = safeString(entries[i] && entries[i].name);
          if (rawUrl.indexOf('facebook.com/tr') < 0) continue;
          result.pixelRequestCount += 1;

          var decodedUrl = rawUrl;
          try {
            decodedUrl = decodeURIComponent(rawUrl);
          } catch (error) {
            decodedUrl = rawUrl;
          }

          var eventMatches = rawUrl.indexOf('ev=' + encodeURIComponent(name)) >= 0 ||
            decodedUrl.indexOf('ev=' + name) >= 0 ||
            decodedUrl.indexOf(name) >= 0;
          if (!eventMatches) continue;

          result.eventOnlyCount += 1;
          if (eventId && (rawUrl.indexOf(encodeURIComponent(eventId)) >= 0 || decodedUrl.indexOf(eventId) >= 0)) {
            result.matchCount += 1;
          }
        }
      }
    } catch (error) {
      result.matchCount = -1;
      result.error = error && error.message ? error.message : safeString(error);
    }

    return result;
  }

  function observePixelNetwork(name, eventId, context, customData, payload, sourceMethod) {
    window.setTimeout(function () {
      var summary = countPixelNetworkMatches(name, eventId);

      logDiagnostic('custom_event_network_observed', buildSafeLogFields(context, payload, {
        eventName: name,
        found: summary.matchCount > 0 ? 'yes' : 'no',
        matchCount: summary.matchCount,
        eventOnlyCount: summary.eventOnlyCount,
        pixelRequestCount: summary.pixelRequestCount,
        error: summary.error
      }));

      if (sourceMethod !== 'fbq' || summary.matchCount !== 0) return;
      if (fallbackAfterObserveNoEventIds[eventId]) return;

      fallbackAfterObserveNoEventIds[eventId] = true;

      if (sendPixelFallback(name, customData, eventId)) {
        logDiagnostic('custom_event_fallback_sent', buildSafeLogFields(context, payload, {
          eventName: name,
          method: 'image_fallback_after_observe_no'
        }));
      } else {
        logDiagnostic('custom_event_fallback_failed', buildSafeLogFields(context, payload, {
          eventName: name
        }));
      }
    }, 1500);
  }

  function trackCustom(name, value, currency, context, payload) {
    var customData = buildCustomData(value, currency, context, payload);
    var eventId = buildCustomEventId(name, context);
    var args = [
      'trackCustom',
      name,
      customData,
      { eventID: eventId }
    ];
    var sent = false;

    logDiagnostic('custom_event_prepare', buildSafeLogFields(context, payload, { eventName: name }));

    CONFIG.customEventRetryMs.forEach(function (delayMs, index) {
      window.setTimeout(function () {
        if (sent) return;

        if (callRawFbq(args)) {
          sent = true;
          logDiagnostic('custom_event_sent', buildSafeLogFields(context, payload, {
            eventName: name,
            method: 'fbq'
          }));
          observePixelNetwork(name, eventId, context, customData, payload, 'fbq');
          return;
        }

        if (index === CONFIG.customEventRetryMs.length - 1) {
          sent = sendPixelFallback(name, customData, eventId);
          if (sent) {
            logDiagnostic('custom_event_sent', buildSafeLogFields(context, payload, {
              eventName: name,
              method: 'image_fallback'
            }));
            observePixelNetwork(name, eventId, context, customData, payload, 'image_fallback');
          } else {
            logDiagnostic('custom_event_failed', buildSafeLogFields(context, payload, { eventName: name }));
          }
        }
      }, delayMs);
    });
  }

  function logPurchaseDispatchStart(context, payload, source) {
    logDiagnostic('purchase_dispatch_start', buildSafeLogFields(context, payload, {
      eventName: 'Purchase',
      source: source
    }));
  }

  function sendAllowedPurchaseFallback(params, context, payload, reason) {
    var eventId = context.eventId || ('Purchase.' + fallbackSafeRef(context));
    if (!eventId || purchaseFallbackAfterObserveNoEventIds[eventId]) return;

    purchaseFallbackAfterObserveNoEventIds[eventId] = true;

    var purchaseData = buildCustomData(params.value, params.currency, context, payload);
    logDiagnostic('purchase_network_missing_fallback_start', buildSafeLogFields(context, payload, {
      eventName: 'Purchase',
      method: 'image_fallback_after_original_no_network',
      fallbackReason: reason || ''
    }));

    if (sendPixelFallback('Purchase', purchaseData, eventId)) {
      logDiagnostic('purchase_fallback_sent', buildSafeLogFields(context, payload, {
        eventName: 'Purchase',
        method: 'image_fallback_after_original_no_network'
      }));
    } else {
      logDiagnostic('purchase_fallback_failed', buildSafeLogFields(context, payload, {
        eventName: 'Purchase',
        fallbackReason: 'image_fallback_failed'
      }));
    }
  }

  function observePurchaseNetwork(context, params, payload) {
    window.setTimeout(function () {
      var eventId = context.eventId || ('Purchase.' + fallbackSafeRef(context));
      var summary = countPixelNetworkMatches('Purchase', eventId);

      logDiagnostic('purchase_network_observed', buildSafeLogFields(context, payload, {
        eventName: 'Purchase',
        found: summary.matchCount > 0 ? 'yes' : 'no',
        matchCount: summary.matchCount,
        eventOnlyCount: summary.eventOnlyCount,
        pixelRequestCount: summary.pixelRequestCount,
        error: summary.error
      }));

      if (summary.matchCount === 0 && summary.eventOnlyCount === 0) {
        sendAllowedPurchaseFallback(params, context, payload, 'no_purchase_network_after_original_dispatch');
      }
    }, CONFIG.purchaseFallbackDelayMs);
  }

  function buildVirtualAccountIssuedPayload(context, hint) {
    hint = hint || {};
    return {
      decision: compactDecision({
        status: 'pending',
        browserAction: 'block_purchase_virtual_account',
        reason: 'completion_page_virtual_account_hint',
        matchedBy: hint.source || 'browser_completion_hint',
        confidence: 'medium'
      }),
      safeRef: fallbackSafeRef(context),
      source: 'completion_page_virtual_account_hint_v313',
      endpointStatus: 0,
      fromCache: false,
      virtualAccountIssueSource: 'completion_page_immediate_fire_v313',
      virtualAccountHintSource: hint.source || 'unknown',
      paymentStatus: 'pending',
      paymentMethod: 'virtual_account',
      eventSource: 'header_guard_v313',
      eventTrigger: 'completion_page_virtual_account_hint',
      isPurchase: 'no',
      isPaid: 'no'
    };
  }

  function trackVirtualAccountIssuedOnce(value, currency, context, payload, sourceReason) {
    if (hasSentVirtualAccountIssued(context)) {
      logDiagnostic('virtual_account_issued_skip_duplicate', buildSafeLogFields(context, payload, {
        eventName: CONFIG.vbankEventName,
        sourceReason: sourceReason || ''
      }));
      return false;
    }

    rememberVirtualAccountIssued(context);
    trackCustom(CONFIG.vbankEventName, value || 0, currency || 'KRW', context, payload);
    logDiagnostic('virtual_account_issued_triggered', buildSafeLogFields(context, payload, {
      eventName: CONFIG.vbankEventName,
      sourceReason: sourceReason || ''
    }));
    return true;
  }

  function maybeFireVirtualAccountIssuedOnCompletion() {
    var context = buildContext('');

    if (!hasDecisionLookup(context)) {
      logDiagnostic('virtual_account_issued_immediate_skip', {
        reason: 'missing_order_identifiers',
        safeRef: fallbackSafeRef(context)
      });
      return;
    }

    var hint = detectVirtualAccountHint();
    if (!hint.found) {
      logDiagnostic('virtual_account_issued_immediate_skip', {
        reason: 'missing_virtual_account_hint',
        safeRef: fallbackSafeRef(context)
      });
      return;
    }

    readDecisionCache(context).then(function (cached) {
      if (cached && isAllowPurchasePayload(cached)) {
        logDiagnostic('virtual_account_issued_immediate_skip', buildSafeLogFields(context, cached, {
          reason: 'cached_allow_purchase',
          eventName: CONFIG.vbankEventName
        }));
        return;
      }

      if (cached && cached.decision && cached.decision.browserAction === 'block_purchase') {
        logDiagnostic('virtual_account_issued_immediate_skip', buildSafeLogFields(context, cached, {
          reason: 'cached_block_purchase',
          eventName: CONFIG.vbankEventName
        }));
        return;
      }

      var payload = buildVirtualAccountIssuedPayload(context, hint);
      trackVirtualAccountIssuedOnce(0, 'KRW', context, payload, 'completion_page_virtual_account_hint');
    }).catch(function () {
      var payload = buildVirtualAccountIssuedPayload(context, hint);
      trackVirtualAccountIssuedOnce(0, 'KRW', context, payload, 'completion_page_virtual_account_hint_cache_read_failed');
    });
  }

  function handleDecisionPayload(context, params, payload) {
    var decision = payload.decision || {};

    logDecisionBranch(context, payload, params.source);

    if (decision.browserAction === 'allow_purchase') {
      writeDecisionCache(context, payload, 'allow_purchase').then(function () {});
      logPurchaseDispatchStart(context, payload, params.source);
      markAllowed(context.eventId);
      try {
        params.invokeOriginal();
        logDiagnostic('purchase_dispatch_complete', buildSafeLogFields(context, payload, {
          eventName: 'Purchase',
          source: params.source
        }));
      } catch (error) {
        logDiagnostic('purchase_dispatch_error', buildSafeLogFields(context, payload, {
          eventName: 'Purchase',
          source: params.source,
          message: error && error.message ? error.message : safeString(error)
        }));
        throw error;
      }
      observePurchaseNetwork(context, params, payload);
      return;
    }

    if (decision.browserAction === 'block_purchase_virtual_account') {
      writeDecisionCache(context, payload, 'block_purchase_virtual_account').then(function () {});
      trackVirtualAccountIssuedOnce(0, params.currency || 'KRW', context, payload, 'payment_decision_pending');
      return;
    }

    if (decision.browserAction === 'block_purchase') {
      writeDecisionCache(context, payload, 'block_purchase').then(function () {});
      trackCustom(CONFIG.blockedEventName, params.value, params.currency, context, payload);
      return;
    }

    writeDecisionCache(context, payload, 'unknown').then(function () {});
    trackCustom(CONFIG.unknownEventName, params.value, params.currency, context, payload);
  }

  function handlePurchaseAttempt(params) {
    var context = buildContext(params.eventId);
    var attemptKey = buildAttemptKey(context);

    if (attemptKey && handledAttemptKeys[attemptKey]) {
      return;
    }
    if (attemptKey) handledAttemptKeys[attemptKey] = true;

    readDecisionCache(context).then(function (cached) {
      if (cached) {
        handleDecisionPayload(context, params, cached);
        return;
      }

      window.setTimeout(function () {
        getDecisionPromise(context, params.source).then(function (payload) {
          handleDecisionPayload(context, params, payload);
        });
      }, CONFIG.holdMs);
    }).catch(function () {
      window.setTimeout(function () {
        queryDecision(context).then(function (payload) {
          handleDecisionPayload(context, params, payload);
        });
      }, CONFIG.holdMs);
    });
  }

  function wrapFbPixel(pixel) {
    if (!pixel || typeof pixel.Purchase !== 'function') return false;
    if (pixel.__BIOCOM_SERVER_PAYMENT_DECISION_GUARD_WRAPPED__) return true;

    var originalPurchase = pixel.Purchase;

    pixel.Purchase = function (value, currency, eventId, fbExternalId) {
      var self = this;
      var args = arguments;

      if (isAllowed(eventId)) {
        return originalPurchase.apply(self, args);
      }

      handlePurchaseAttempt({
        source: 'FB_PIXEL.Purchase',
        value: value,
        currency: currency,
        eventId: eventId,
        invokeOriginal: function () {
          originalPurchase.apply(self, args);
        }
      });
    };

    pixel.__BIOCOM_SERVER_PAYMENT_DECISION_GUARD_WRAPPED__ = true;
    return true;
  }

  function extractFbqEventId(options, params) {
    var eventId = '';
    if (options && typeof options === 'object') {
      eventId = options.eventID || options.eventId || options.event_id || '';
    }
    if (!eventId && params && typeof params === 'object') {
      eventId = params.eventID || params.eventId || params.event_id || '';
    }
    return safeString(eventId);
  }

  function wrapFbq() {
    var currentFbq = window.fbq;
    if (typeof currentFbq !== 'function') return false;
    if (currentFbq.__BIOCOM_SERVER_PAYMENT_DECISION_GUARD_WRAPPED__) return true;

    var rawFbq = currentFbq;
    var guardedFbq = function () {
      var args = Array.prototype.slice.call(arguments);
      var command = args[0];
      var eventName = args[1];

      if (command === 'track' && eventName === 'Purchase') {
        var params = args[2] && typeof args[2] === 'object' ? args[2] : {};
        var options = args[3] && typeof args[3] === 'object' ? args[3] : {};
        var eventId = extractFbqEventId(options, params);

        if (isAllowed(eventId)) {
          return rawFbq.apply(window, args);
        }

        handlePurchaseAttempt({
          source: 'fbq.track.Purchase',
          value: params.value,
          currency: params.currency,
          eventId: eventId,
          invokeOriginal: function () {
            rawFbq.apply(window, args);
          }
        });
        return;
      }

      return rawFbq.apply(window, args);
    };

    for (var key in rawFbq) {
      try {
        guardedFbq[key] = rawFbq[key];
      } catch (error) {
        // Some properties may be read-only.
      }
    }

    guardedFbq.__BIOCOM_SERVER_PAYMENT_DECISION_GUARD_WRAPPED__ = true;
    guardedFbq.__BIOCOM_SERVER_PAYMENT_DECISION_GUARD_RAW__ = rawFbq;
    window.fbq = guardedFbq;
    return true;
  }

  try {
    Object.defineProperty(window, 'FB_PIXEL', {
      configurable: true,
      get: function () {
        return activeFbPixel;
      },
      set: function (nextPixel) {
        activeFbPixel = nextPixel;
        wrapFbPixel(activeFbPixel);
      }
    });
  } catch (error) {
    // Polling below still tries to wrap.
  }

  CONFIG.wrapPollMs.forEach(function (ms) {
    window.setTimeout(function () {
      if (window.FB_PIXEL) wrapFbPixel(window.FB_PIXEL);
      wrapFbq();
    }, ms);
  });

  function scheduleImmediateVirtualAccountIssuedChecks() {
    for (var i = 0; i < CONFIG.immediateFirePollMs.length; i += 1) {
      window.setTimeout(maybeFireVirtualAccountIssuedOnCompletion, CONFIG.immediateFirePollMs[i]);
    }
  }

  window.setTimeout(prefetchDecision, 0);
  scheduleImmediateVirtualAccountIssuedChecks();

  if (window.console && console.info) {
    console.info(CONFIG.logPrefix, 'installed', CONFIG.snippetVersion);
  }
})();
</script>

```

## 적용 후 확인 방법

1. 아임웹 헤더 코드 상단에서 기존 `server-payment-decision-guard-v3-1-1` 블록만 위 코드로 교체한다.
2. 가상계좌 주문생성/미입금 완료 URL에 도착한다.
3. Chrome DevTools Network에서 `facebook.com/tr`를 필터링한다.
4. 성공 기준은 `ev=VirtualAccountIssued` 1건, `ev=Purchase` 0건이다.
5. Meta Pixel Helper에 바로 안 보여도 Network의 `facebook.com/tr` 요청이 더 강한 근거다.
6. 같은 완료 페이지 새로고침 시 `VirtualAccountIssued`가 중복으로 늘지 않아야 한다.
7. 카드 결제완료 테스트에서는 `VirtualAccountIssued`가 0건이어야 한다. 카드 결제완료는 서버 판단이 confirmed일 때 Purchase 경로가 우선이다.

## 하지 않은 것

- 아임웹 운영 코드 저장 안 함.
- GTM publish 안 함.
- Meta test event 또는 운영 event를 Codex가 직접 전송하지 않음.
- VM Cloud/backend deploy 안 함.
- 운영DB/VM Cloud write 안 함.

## 다음 판단

이 문서는 운영 반영용 코드 초안이다. 실제 아임웹 저장은 사이트 전체 브라우저 전환 이벤트에 영향을 주므로 TJ님이 저장해야 한다. 저장 후에는 가상계좌 미입금 주문 1건으로 Network smoke를 진행하고, `Purchase=0`, `VirtualAccountIssued=1`을 확인한다.
