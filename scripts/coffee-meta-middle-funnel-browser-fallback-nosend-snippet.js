(function () {
  'use strict';

  var CONFIG = {
    snippetVersion: '2026-05-22-coffee-meta-middle-funnel-browser-fallback-nosend-v1',
    debugQueryKey: '__seo_attribution_debug',
    checkoutContextKey: '__seo_checkout_context',
    clickContextKey: '__thecleancoffee_click_id_context_v1',
    previewSessionKey: '__coffee_meta_middle_preview_session_id',
    dedupeKeyPrefix: '__coffee_meta_middle_preview_sent__:',
    dataLayerEventName: 'coffee_meta_middle_funnel_preview',
    eventName: 'InitiateCheckout',
    logPrefix: '[coffee-meta-middle-funnel-nosend]',
    valueSelectors: [
      '[data-payment-total]',
      '[data-order-total]',
      '[data-total-price]',
      '._payment_total_price',
      '.total_price',
      '._cart_main_total_price',
      '.im-price-result',
      '.im-order-price',
      '.shop-table > tfoot .payment-info',
      '.payment-total',
      '.order-total',
      '.total-price',
      '.pay_total .price',
      '.order_price .price'
    ]
  };

  if (window.__THECLEANCOFFEE_META_MIDDLE_FUNNEL_NOSEND__ === CONFIG.snippetVersion) return;
  window.__THECLEANCOFFEE_META_MIDDLE_FUNNEL_NOSEND__ = CONFIG.snippetVersion;

  function trim(value) {
    if (value === null || value === undefined) return '';
    return String(value).trim();
  }

  function safeParse(raw) {
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
      return safeParse(window.sessionStorage && window.sessionStorage.getItem(key));
    } catch (error) {
      return {};
    }
  }

  function readLocalJson(key) {
    try {
      return safeParse(window.localStorage && window.localStorage.getItem(key));
    } catch (error) {
      return {};
    }
  }

  function writeSessionText(key, value) {
    try {
      if (!window.sessionStorage) return false;
      window.sessionStorage.setItem(key, value);
      return true;
    } catch (error) {
      return false;
    }
  }

  function readSessionText(key) {
    try {
      return trim(window.sessionStorage && window.sessionStorage.getItem(key));
    } catch (error) {
      return '';
    }
  }

  function firstNonEmpty(values) {
    for (var i = 0; i < values.length; i += 1) {
      var value = trim(values[i]);
      if (value) return value;
    }
    return '';
  }

  function isDebugMode() {
    try {
      return new URLSearchParams(window.location.search).get(CONFIG.debugQueryKey) === '1';
    } catch (error) {
      return false;
    }
  }

  function debugLog(label, fields) {
    if (!isDebugMode()) return;
    try {
      console.info(CONFIG.logPrefix, label, fields || {});
    } catch (error) {}
  }

  function getSearchParam(keys) {
    try {
      var params = new URLSearchParams(window.location.search);
      for (var i = 0; i < keys.length; i += 1) {
        var value = trim(params.get(keys[i]));
        if (value) return value;
      }
    } catch (error) {}
    return '';
  }

  function isCheckoutPage() {
    var href = (window.location.pathname + ' ' + window.location.href).toLowerCase();
    if (/shop_payment_complete|shop_order_done|order_complete|payment_complete/.test(href)) return false;
    return /shop_payment|shop_order|order_form|checkout/.test(href);
  }

  function getPreviewSessionId() {
    var current = readSessionText(CONFIG.previewSessionKey);
    if (current) return current;
    var created = 'mid_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
    writeSessionText(CONFIG.previewSessionKey, created);
    return created;
  }

  function stableHash(value) {
    var text = trim(value);
    var hash = 2166136261;
    for (var i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    return ('00000000' + (hash >>> 0).toString(16)).slice(-8);
  }

  function getOrderHints(checkoutContext) {
    checkoutContext = checkoutContext || {};
    return {
      orderCode: firstNonEmpty([
        getSearchParam(['order_code', 'orderCode']),
        checkoutContext.orderCode,
        checkoutContext.order_code
      ]),
      orderNo: firstNonEmpty([
        getSearchParam(['order_no', 'orderNo']),
        checkoutContext.orderNo,
        checkoutContext.order_no
      ]),
      orderMember: firstNonEmpty([
        getSearchParam(['order_member', 'orderMember']),
        checkoutContext.orderMember,
        checkoutContext.order_member
      ]),
      checkoutId: firstNonEmpty([
        checkoutContext.checkoutId,
        checkoutContext.checkout_id,
        getSearchParam(['checkoutId', 'checkout_id'])
      ])
    };
  }

  function hasOrderHint(hints) {
    return Boolean(hints.orderCode || hints.orderNo || hints.checkoutId);
  }

  function buildDedupeKey(hints) {
    var basis = firstNonEmpty([
      hints.checkoutId,
      hints.orderCode,
      hints.orderNo,
      window.location.pathname
    ]);
    return CONFIG.dedupeKeyPrefix + stableHash(basis);
  }

  function parsePriceFromText(raw) {
    var text = trim(raw).replace(/,/g, '');
    if (!text) return null;
    var matches = text.match(/[0-9]+(?:\.[0-9]+)?/g);
    if (!matches || !matches.length) return null;
    var best = 0;
    for (var i = 0; i < matches.length; i += 1) {
      var value = Number(matches[i]);
      if (Number.isFinite(value) && value > best) best = value;
    }
    return best > 0 ? best : null;
  }

  function parsePriceAfterLabel(raw, label) {
    var text = trim(raw).replace(/\s+/g, ' ');
    var index = text.indexOf(label);
    if (index < 0) return null;
    var rest = text.slice(index + label.length);
    var wonMatch = rest.match(/([0-9][0-9,]*(?:\.[0-9]+)?)\s*원/);
    if (wonMatch && wonMatch[1]) {
      var wonValue = Number(wonMatch[1].replace(/,/g, ''));
      if (Number.isFinite(wonValue) && wonValue > 0) return wonValue;
    }
    return parsePriceFromText(rest);
  }

  function isVisible(node) {
    try {
      if (!node) return false;
      var style = window.getComputedStyle ? window.getComputedStyle(node) : null;
      if (style && (style.display === 'none' || style.visibility === 'hidden')) return false;
      var rect = node.getBoundingClientRect ? node.getBoundingClientRect() : null;
      return !rect || (rect.width > 0 && rect.height > 0);
    } catch (error) {
      return true;
    }
  }

  function readOrderSummaryValue() {
    var selectors = ['#oms-shop-payment', 'main', 'body'];
    for (var i = 0; i < selectors.length; i += 1) {
      var node = null;
      try {
        node = document.querySelector(selectors[i]);
      } catch (error) {
        node = null;
      }
      if (!node) continue;
      var text = node.innerText || node.textContent || '';
      if (text.indexOf('주문 요약') < 0 || text.indexOf('총 주문금액') < 0) continue;
      var value = parsePriceAfterLabel(text, '총 주문금액');
      if (value) {
        return {
          value: value,
          valueStatus: 'present',
          selector: selectors[i] + ' text:총 주문금액'
        };
      }
    }
    return null;
  }

  function readValueCandidate() {
    var orderSummaryValue = readOrderSummaryValue();
    if (orderSummaryValue) return orderSummaryValue;

    for (var i = 0; i < CONFIG.valueSelectors.length; i += 1) {
      var selector = CONFIG.valueSelectors[i];
      var nodes = [];
      try {
        nodes = Array.prototype.slice.call(document.querySelectorAll(selector));
      } catch (error) {
        nodes = [];
      }
      for (var j = 0; j < nodes.length; j += 1) {
        if (!isVisible(nodes[j])) continue;
        var value = parsePriceFromText(nodes[j].getAttribute('data-payment-total') ||
          nodes[j].getAttribute('data-order-total') ||
          nodes[j].getAttribute('data-total-price') ||
          nodes[j].textContent);
        if (value) {
          return { value: value, valueStatus: 'present', selector: selector };
        }
      }
    }
    return { value: null, valueStatus: 'missing', selector: '' };
  }

  function compactPreviewPayload(hints, checkoutContext, clickContext, valueResult) {
    var previewSessionId = getPreviewSessionId();
    var eventIdBasis = firstNonEmpty([hints.checkoutId, previewSessionId]);
    return {
      event: CONFIG.dataLayerEventName,
      eventName: CONFIG.eventName,
      eventID: CONFIG.eventName + '.' + stableHash(eventIdBasis),
      noSend: true,
      noFbq: true,
      noPixelRequest: true,
      snippetVersion: CONFIG.snippetVersion,
      pagePath: window.location.pathname,
      customData: {
        currency: 'KRW',
        value: valueResult.value,
        value_status: valueResult.valueStatus,
        value_selector: valueResult.selector,
        checkout_id_present: Boolean(hints.checkoutId),
        order_code_present: Boolean(hints.orderCode),
        order_no_present: Boolean(hints.orderNo),
        order_member_present: Boolean(hints.orderMember),
        client_id_present: Boolean(checkoutContext.clientId),
        ga_session_id_present: Boolean(checkoutContext.gaSessionId),
        gclid_present: Boolean(clickContext.gclid),
        gbraid_present: Boolean(clickContext.gbraid),
        wbraid_present: Boolean(clickContext.wbraid),
        gad_campaignid_present: Boolean(clickContext.gad_campaignid),
        google_click_id_source: clickContext.google_click_id_source || ''
      }
    };
  }

  function runPreview() {
    if (!isCheckoutPage()) {
      debugLog('blocked', { reason: 'not_checkout_page' });
      return;
    }

    var checkoutContext = readSessionJson(CONFIG.checkoutContextKey);
    var clickContext = firstNonEmpty([
      JSON.stringify(readSessionJson(CONFIG.clickContextKey)),
      JSON.stringify(readLocalJson(CONFIG.clickContextKey))
    ]);
    clickContext = safeParse(clickContext);
    var hints = getOrderHints(checkoutContext);

    if (!hasOrderHint(hints)) {
      debugLog('blocked', { reason: 'missing_order_hint' });
      return;
    }

    var dedupeKey = buildDedupeKey(hints);
    if (readSessionText(dedupeKey)) {
      debugLog('blocked', { reason: 'deduped' });
      return;
    }

    var valueResult = readValueCandidate();
    var payload = compactPreviewPayload(hints, checkoutContext, clickContext, valueResult);
    writeSessionText(dedupeKey, new Date().toISOString());

    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(payload);
    window.__THECLEANCOFFEE_META_MIDDLE_FUNNEL_PREVIEW_LAST__ = payload;
    debugLog('preview', payload);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runPreview, { once: true });
  } else {
    runPreview();
  }
})();
