(function () {
  var VERSION = '2026-05-28-coffee-payment-page-seen-preview-smoke-console-v1';

  function safeString(value) {
    if (value === null || value === undefined) return '';
    return String(value);
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

  function readJson(storage, key) {
    try {
      if (!storage) return {};
      return safeParse(storage.getItem(key));
    } catch (error) {
      return {};
    }
  }

  function searchParams() {
    try {
      return new URLSearchParams(window.location.search);
    } catch (error) {
      return new URLSearchParams('');
    }
  }

  function summarizeTouch(value) {
    value = value && typeof value === 'object' ? value : {};
    var landing = safeString(value.landing || value.href || value.url || value.path);
    return {
      utm_source: safeString(value.utm_source),
      utm_medium: safeString(value.utm_medium),
      utm_campaign: safeString(value.utm_campaign),
      has_gclid: Boolean(value.gclid || value.has_gclid || landing.indexOf('gclid=') >= 0),
      has_gbraid: Boolean(value.gbraid || value.has_gbraid || landing.indexOf('gbraid=') >= 0),
      has_wbraid: Boolean(value.wbraid || value.has_wbraid || landing.indexOf('wbraid=') >= 0),
      gad_campaignid: safeString(value.gad_campaignid),
      gad_source: safeString(value.gad_source),
      google_click_id_source: safeString(value.google_click_id_source),
      landing_has_napm: Boolean(value.landing_has_napm || landing.indexOf('NaPm=') >= 0),
      landing_has_srsltid: Boolean(value.landing_has_srsltid || landing.indexOf('srsltid=') >= 0),
      source_name: safeString(value.source_name)
    };
  }

  function summarizeCheckoutContext(value) {
    value = value && typeof value === 'object' ? value : {};
    return {
      checkout_id_present: Boolean(value.checkoutId || value.checkout_id),
      order_code_present: Boolean(value.orderCode || value.order_code),
      order_no_present: Boolean(value.orderNo || value.order_no),
      source: safeString(value.source),
      touchpoint: safeString(value.touchpoint),
      client_observed_at_present: Boolean(value.clientObservedAt || value.client_observed_at),
      landing_present: Boolean(value.landing),
      referrer_present: Boolean(value.referrer)
    };
  }

  function summarizePaymentPreview(value) {
    value = value && typeof value === 'object' ? value : {};
    return {
      event: safeString(value.event),
      site: safeString(value.site),
      source: safeString(value.source),
      owner_surface: safeString(value.owner_surface),
      snippetVersion: safeString(value.snippetVersion),
      noSend: value.noSend === true,
      noVmWrite: value.noVmWrite === true,
      noPixelRequest: value.noPixelRequest === true,
      source_name: safeString(value.source_name),
      utm_source: safeString(value.utm_source),
      utm_medium: safeString(value.utm_medium),
      utm_campaign: safeString(value.utm_campaign),
      has_gclid: Boolean(value.has_gclid),
      has_gbraid: Boolean(value.has_gbraid),
      has_wbraid: Boolean(value.has_wbraid),
      gad_campaignid: safeString(value.gad_campaignid),
      gad_source: safeString(value.gad_source),
      google_click_id_source: safeString(value.google_click_id_source),
      napm_present: Boolean(value.napm_present),
      srsltid_present: Boolean(value.srsltid_present),
      landing_has_napm: Boolean(value.landing_has_napm),
      landing_has_srsltid: Boolean(value.landing_has_srsltid)
    };
  }

  function recentDataLayerEvents() {
    var events = [];
    try {
      if (!Array.isArray(window.dataLayer)) return events;
      for (var index = Math.max(0, window.dataLayer.length - 40); index < window.dataLayer.length; index += 1) {
        var item = window.dataLayer[index];
        if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
        var name = safeString(item.event);
        if (!name) continue;
        if (!/begin_checkout|checkout|payment|purchase|coffee_payment_page_seen/i.test(name)) continue;
        events.push({
          index: index,
          event: name,
          has_ecommerce: Boolean(item.ecommerce),
          has_agentsos_ga4: Boolean(item.agentsos_ga4),
          has_hurdlers_ga4: Boolean(item.hurdlers_ga4),
          has_payment_page_seen_preview: Boolean(item.coffee_payment_page_seen_debug_snapshot_preview),
          value: item.ecommerce && item.ecommerce.value !== undefined
            ? item.ecommerce.value
            : item.agentsos_ga4 && item.agentsos_ga4.value !== undefined
              ? item.agentsos_ga4.value
              : ''
        });
      }
    } catch (error) {}
    return events;
  }

  function resourceCounts() {
    var counts = {
      payment_page_seen_endpoint: 0,
      attribution_checkout_context: 0,
      attribution_payment_success: 0,
      facebook_pixel: 0,
      ga_collect: 0,
      google_ads_collect: 0
    };

    try {
      var entries = window.performance && typeof window.performance.getEntriesByType === 'function'
        ? window.performance.getEntriesByType('resource')
        : [];
      entries.forEach(function (entry) {
        var name = safeString(entry && entry.name);
        if (name.indexOf('/api/attribution/payment-page-seen') >= 0) counts.payment_page_seen_endpoint += 1;
        if (name.indexOf('/api/attribution/checkout-context') >= 0) counts.attribution_checkout_context += 1;
        if (name.indexOf('/api/attribution/payment-success') >= 0) counts.attribution_payment_success += 1;
        if (name.indexOf('facebook.com/tr') >= 0) counts.facebook_pixel += 1;
        if (name.indexOf('/g/collect') >= 0 || name.indexOf('/mp/collect') >= 0) counts.ga_collect += 1;
        if (name.indexOf('googleads.g.doubleclick.net') >= 0 || name.indexOf('/pagead/') >= 0) counts.google_ads_collect += 1;
      });
    } catch (error) {}
    return counts;
  }

  var params = searchParams();
  var preview = window.__THECLEANCOFFEE_PAYMENT_PAGE_SEEN_PREVIEW_LAST__ || {};
  var result = {
    version: VERSION,
    checked_at: new Date().toISOString(),
    href_without_query_values: window.location.origin + window.location.pathname,
    path: window.location.pathname,
    gtm_preview_present: Boolean(params.get('gtm_preview') || params.get('gtm_debug')),
    debug_param_present: params.get('__seo_attribution_debug') === '1',
    checkout_context: summarizeCheckoutContext(readJson(window.sessionStorage, '__seo_checkout_context')),
    payment_page_seen_preview: summarizePaymentPreview(preview),
    checkout_context_debug_merged_preview: summarizePaymentPreview(
      readJson(window.sessionStorage, '__seo_checkout_context_debug_merged_preview')
    ),
    payment_success_context_debug_merged_preview: summarizePaymentPreview(
      readJson(window.sessionStorage, '__seo_payment_success_context_debug_merged_preview')
    ),
    coffee_click_context_session: summarizeTouch(
      readJson(window.sessionStorage, '__thecleancoffee_click_id_context_v1')
    ),
    coffee_click_context_local: summarizeTouch(
      readJson(window.localStorage, '__thecleancoffee_click_id_context_v1')
    ),
    last_touch: summarizeTouch(readJson(window.localStorage, '_p1s1a_last_touch')),
    session_touch: summarizeTouch(readJson(window.sessionStorage, '_p1s1a_session_touch')),
    recent_dataLayer_events: recentDataLayerEvents(),
    resource_counts: resourceCounts()
  };

  console.log(result);
  return result;
})();
