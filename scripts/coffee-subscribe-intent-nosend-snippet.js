(function () {
  'use strict';

  var CONFIG = {
    snippetVersion: '2026-05-22-coffee-subscribe-intent-nosend-v1',
    debugQueryKey: '__seo_attribution_debug',
    funnelSessionKey: '__seo_funnel_session',
    previewSessionKey: '__coffee_subscribe_intent_preview_session_id',
    sequenceKey: '__coffee_subscribe_intent_preview_seq',
    dedupeKeyPrefix: '__coffee_subscribe_intent_preview_dedupe__:',
    dedupeWindowMs: 1500,
    dataLayerEventName: 'coffee_subscribe_intent_preview',
    eventName: 'SubscribeIntentPreview',
    logPrefix: '[coffee-subscribe-intent-nosend]'
  };

  if (window.__THECLEANCOFFEE_SUBSCRIBE_INTENT_NOSEND__ === CONFIG.snippetVersion) return;
  window.__THECLEANCOFFEE_SUBSCRIBE_INTENT_NOSEND__ = CONFIG.snippetVersion;

  function trim(value) {
    if (value === null || value === undefined) return '';
    return String(value).trim();
  }

  function normalizeText(value) {
    return trim(value).replace(/\s+/g, ' ');
  }

  function readSessionText(key) {
    try {
      return trim(window.sessionStorage && window.sessionStorage.getItem(key));
    } catch (error) {
      return '';
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

  function stableHash(value) {
    var text = trim(value);
    var hash = 2166136261;
    for (var i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    return ('00000000' + (hash >>> 0).toString(16)).slice(-8);
  }

  function getPreviewSessionId() {
    var funnelSession = readSessionText(CONFIG.funnelSessionKey);
    if (funnelSession) return funnelSession;

    var current = readSessionText(CONFIG.previewSessionKey);
    if (current) return current;

    var created = 'sub_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
    writeSessionText(CONFIG.previewSessionKey, created);
    return created;
  }

  function nextSequence() {
    var current = Number(readSessionText(CONFIG.sequenceKey) || '0');
    var next = Number.isFinite(current) ? current + 1 : 1;
    writeSessionText(CONFIG.sequenceKey, String(next));
    return next;
  }

  function getProductIdx() {
    try {
      return trim(new URLSearchParams(window.location.search).get('idx'));
    } catch (error) {
      return '';
    }
  }

  function isSubscriptionPath() {
    var path = trim(window.location.pathname).toLowerCase();
    return path === '/subscription' || path.indexOf('/subscription/') === 0;
  }

  function attr(node, name) {
    if (!node || typeof node.getAttribute !== 'function') return '';
    return trim(node.getAttribute(name));
  }

  function classText(node) {
    return trim(node && node.className);
  }

  function hasClassToken(node, token) {
    var classes = ' ' + classText(node) + ' ';
    return classes.indexOf(' ' + token + ' ') >= 0 || classes.indexOf(token) >= 0;
  }

  function findActionElement(target) {
    if (!target || typeof target.closest !== 'function') return null;
    return target.closest('a, button, [role="button"]');
  }

  function isSubscribeIntentButton(node) {
    if (!node) return false;

    var text = normalizeText(node.textContent || '');
    var isRegularProduct = attr(node, 'data-bs-is-regularly-prod') === 'true';
    var isPurchaseAction = attr(node, 'data-bs-content') === 'purchase';
    var isImwebPayment = attr(node, 'data-bs-payment-button-type') === 'imweb_payment';
    var isRegularClass = hasClassToken(node, 'im-regularly');
    var isSubscribeText = text.indexOf('정기구독 신청') >= 0 || text === '정기구독';

    return Boolean(
      isSubscriptionPath() &&
      isRegularProduct &&
      isPurchaseAction &&
      isImwebPayment &&
      isRegularClass &&
      isSubscribeText
    );
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
    var text = normalizeText(raw);
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

  function readSubscriptionTotalValue() {
    var selectors = ['.shop-content', '.shop_view', 'main', 'body'];
    for (var i = 0; i < selectors.length; i += 1) {
      var node = null;
      try {
        node = document.querySelector(selectors[i]);
      } catch (error) {
        node = null;
      }
      if (!node) continue;

      var text = node.innerText || node.textContent || '';
      if (text.indexOf('총 상품금액') < 0) continue;

      var value = parsePriceAfterLabel(text, '총 상품금액');
      if (value) {
        return {
          value: value,
          valueStatus: 'present',
          selector: selectors[i] + ' text:총 상품금액'
        };
      }
    }

    return {
      value: null,
      valueStatus: 'missing',
      selector: ''
    };
  }

  function getButtonContext(node) {
    var productCode = attr(node, 'data-bs-prod-code');
    var productIdx = getProductIdx();

    return {
      productIdx: productIdx,
      productCodeHash: productCode ? stableHash(productCode) : '',
      productCodePresent: Boolean(productCode),
      productType: attr(node, 'data-bs-prod-type'),
      where: attr(node, 'data-bs-where'),
      paymentButtonType: attr(node, 'data-bs-payment-button-type'),
      textClass: normalizeText(node.textContent || '').indexOf('신청') >= 0 ? 'subscribe_apply' : 'subscribe_cta',
      elementClassHash: classText(node) ? stableHash(classText(node)) : ''
    };
  }

  function buildDedupeKey(context) {
    return CONFIG.dedupeKeyPrefix + stableHash([
      window.location.pathname,
      context.productIdx,
      context.productCodeHash,
      context.paymentButtonType
    ].join('|'));
  }

  function isDedupedAndRemember(dedupeKey) {
    var now = Date.now();
    var previous = Number(readSessionText(dedupeKey) || '0');
    if (Number.isFinite(previous) && previous > 0 && now - previous < CONFIG.dedupeWindowMs) {
      return true;
    }
    writeSessionText(dedupeKey, String(now));
    return false;
  }

  function buildPreviewPayload(node) {
    var valueResult = readSubscriptionTotalValue();
    var sessionId = getPreviewSessionId();
    var sequence = nextSequence();
    var context = getButtonContext(node);
    var eventId = CONFIG.eventName + '.' + stableHash([
      window.location.pathname,
      context.productIdx,
      context.productCodeHash,
      sessionId,
      sequence
    ].join('|'));

    return {
      event: CONFIG.dataLayerEventName,
      eventName: CONFIG.eventName,
      eventID: eventId,
      noSend: true,
      noFbq: true,
      noPixelRequest: true,
      noNetwork: true,
      snippetVersion: CONFIG.snippetVersion,
      pagePath: window.location.pathname,
      customData: {
        intent_type: 'subscription_application',
        currency: 'KRW',
        value: valueResult.value,
        value_status: valueResult.valueStatus,
        value_selector: valueResult.selector,
        product_idx: context.productIdx,
        product_code_present: context.productCodePresent,
        product_code_hash: context.productCodeHash,
        product_type: context.productType,
        where: context.where,
        payment_button_type: context.paymentButtonType,
        is_regularly_prod: true,
        button_text_class: context.textClass,
        element_class_hash: context.elementClassHash,
        subscription_path: true
      }
    };
  }

  function rememberPreview(payload) {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(payload);
    window.__THECLEANCOFFEE_SUBSCRIBE_INTENT_PREVIEW_LAST__ = payload;
    window.__THECLEANCOFFEE_SUBSCRIBE_INTENT_PREVIEW_HISTORY__ =
      window.__THECLEANCOFFEE_SUBSCRIBE_INTENT_PREVIEW_HISTORY__ || [];
    window.__THECLEANCOFFEE_SUBSCRIBE_INTENT_PREVIEW_HISTORY__.push(payload);
  }

  function handleClick(event) {
    var node = findActionElement(event.target);
    if (!isSubscribeIntentButton(node)) {
      debugLog('blocked', {
        reason: isSubscriptionPath() ? 'not_subscribe_intent_button' : 'not_subscription_path'
      });
      return;
    }

    var context = getButtonContext(node);
    var dedupeKey = buildDedupeKey(context);
    if (isDedupedAndRemember(dedupeKey)) {
      debugLog('blocked', { reason: 'deduped', windowMs: CONFIG.dedupeWindowMs });
      return;
    }

    var payload = buildPreviewPayload(node);
    rememberPreview(payload);
    debugLog('preview', payload);
  }

  document.addEventListener('click', handleClick, true);
  debugLog('installed', { snippetVersion: CONFIG.snippetVersion });
})();
