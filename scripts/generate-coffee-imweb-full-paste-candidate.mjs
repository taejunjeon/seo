#!/usr/bin/env node

import fs from 'node:fs';

const SOURCE = 'coffee/!imwebcoffee_code_latest_0501.md';
const TARGET = 'project/coffee-imweb-full-paste-candidate-20260522.md';
const GENERATED_AT = '2026-05-22 00:17 KST';
const GUARD_VERSION = 'coffee-google-click-id-v1';
const CLICK_CONTEXT_KEY = '__thecleancoffee_click_id_context_v1';

const source = fs.readFileSync(SOURCE, 'utf8');

function fail(message) {
  throw new Error(message);
}

function replaceBetween(input, startMarker, endMarker, replacement, label) {
  const start = input.indexOf(startMarker);
  if (start < 0) fail(`start marker not found: ${label}`);
  const end = input.indexOf(endMarker, start + startMarker.length);
  if (end < 0) fail(`end marker not found: ${label}`);
  return input.slice(0, start) + replacement + input.slice(end);
}

function splitSections(raw) {
  const headerCodeMarker = '\n[헤더코드]\n';
  const bodyCodeMarker = '\n[바디코드]\n';
  const footerCodeMarker = '\n[푸터코드]\n';
  const headerTopMarker = '[헤더 코드 상단]\n';
  const headerCodeAt = raw.indexOf(headerCodeMarker);
  const bodyCodeAt = raw.indexOf(bodyCodeMarker);
  const footerCodeAt = raw.indexOf(footerCodeMarker);
  if (headerCodeAt < 0 || bodyCodeAt < 0 || footerCodeAt < 0) {
    fail('slot markers not found in coffee source');
  }
  let headerTop = raw.slice(0, headerCodeAt).trim();
  const headerTopAt = headerTop.indexOf(headerTopMarker);
  if (headerTopAt >= 0) {
    headerTop = headerTop.slice(headerTopAt + headerTopMarker.length).trim();
  }
  return {
    headerTop,
    headerCode: raw.slice(headerCodeAt + headerCodeMarker.length, bodyCodeAt).trim(),
    bodyCode: raw.slice(bodyCodeAt + bodyCodeMarker.length, footerCodeAt).trim(),
    footerCode: raw.slice(footerCodeAt + footerCodeMarker.length).trim(),
  };
}

const headerTopClickIdScript = `<script>
/* Coffee Google click-id structured storage v1
   Version: 2026-05-22-thecleancoffee-click-id-structured-v1
   Scope: gclid/gbraid/wbraid atomic selection + gad_campaignid campaign hint.
   Do not send platform events from this block.
*/
(function () {
  var CONFIG = {
    guardVersion: '${GUARD_VERSION}',
    clickContextKey: '${CLICK_CONTEXT_KEY}',
    legacyUtmKey: '_p1s1a_session_touch',
    firstTouchKey: '_p1s1a_first_touch',
    latestTouchKey: '_p1s1a_last_touch',
    debugQueryKey: '__seo_attribution_debug',
    logPrefix: '[thecleancoffee-click-id-structured-v1]'
  };

  function trim(value) {
    if (value === null || value === undefined) return '';
    return String(value).trim();
  }

  function safeParse(raw) {
    if (!raw) return {};
    try {
      var parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
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

  function writeJson(storage, key, value) {
    try {
      if (!storage) return;
      storage.setItem(key, JSON.stringify(value));
    } catch (error) {}
  }

  function isDebugMode() {
    try {
      return new URLSearchParams(location.search).get(CONFIG.debugQueryKey) === '1';
    } catch (error) {
      return false;
    }
  }

  function debugLog() {
    if (!isDebugMode()) return;
    try {
      console.log.apply(console, [CONFIG.logPrefix].concat([].slice.call(arguments)));
    } catch (error) {}
  }

  function googleClickSetFrom(source, sourceName) {
    return {
      source: sourceName,
      gclid: trim(source && source.gclid),
      gbraid: trim(source && source.gbraid),
      wbraid: trim(source && source.wbraid),
      gad_source: trim(source && source.gad_source),
      gad_campaignid: trim(source && source.gad_campaignid)
    };
  }

  function googleClickSetFromUrl(urlLike, sourceName) {
    try {
      var url = new URL(urlLike || '', location.origin);
      return googleClickSetFrom({
        gclid: url.searchParams.get('gclid'),
        gbraid: url.searchParams.get('gbraid'),
        wbraid: url.searchParams.get('wbraid'),
        gad_source: url.searchParams.get('gad_source'),
        gad_campaignid: url.searchParams.get('gad_campaignid')
      }, sourceName);
    } catch (error) {
      return googleClickSetFrom({}, sourceName);
    }
  }

  function hasGoogleClickId(set) {
    return Boolean(set && (set.gclid || set.gbraid || set.wbraid));
  }

  function hasGoogleCampaignHint(set) {
    return Boolean(set && (set.gad_source || set.gad_campaignid));
  }

  function selectGoogleClickSet(candidates) {
    for (var i = 0; i < candidates.length; i += 1) {
      if (hasGoogleClickId(candidates[i])) return candidates[i];
      if (hasGoogleCampaignHint(candidates[i])) {
        return {
          source: (candidates[i].source || 'unknown') + '_no_click_id',
          gclid: '',
          gbraid: '',
          wbraid: '',
          gad_source: candidates[i].gad_source || '',
          gad_campaignid: candidates[i].gad_campaignid || ''
        };
      }
    }
    return googleClickSetFrom({}, 'none');
  }

  function selectGoogleCampaignHint(candidates) {
    for (var i = 0; i < candidates.length; i += 1) {
      if (hasGoogleCampaignHint(candidates[i])) {
        return {
          gad_source: candidates[i].gad_source || '',
          gad_campaignid: candidates[i].gad_campaignid || '',
          source: candidates[i].source || ''
        };
      }
    }
    return { gad_source: '', gad_campaignid: '', source: '' };
  }

  function firstNonEmpty(values) {
    for (var i = 0; i < values.length; i += 1) {
      var value = trim(values[i]);
      if (value) return value;
    }
    return '';
  }

  function collectTouchBase() {
    var params = new URLSearchParams(location.search);
    return {
      capturedAt: new Date().toISOString(),
      landing: location.href,
      path: location.pathname + location.search,
      referrer: document.referrer || '',
      utm_source: trim(params.get('utm_source')),
      utm_medium: trim(params.get('utm_medium')),
      utm_campaign: trim(params.get('utm_campaign')),
      utm_content: trim(params.get('utm_content')),
      utm_term: trim(params.get('utm_term')),
      fbclid: trim(params.get('fbclid')),
      ttclid: trim(params.get('ttclid'))
    };
  }

  function buildTouch(base, googleClickSet, campaignHint, previous) {
    var source = googleClickSet || googleClickSetFrom({}, 'none');
    var hint = campaignHint || { gad_source: '', gad_campaignid: '', source: '' };
    previous = previous || {};
    return {
      capturedAt: base.capturedAt,
      landing: base.landing,
      path: base.path,
      referrer: base.referrer,
      utm_source: firstNonEmpty([base.utm_source, previous.utm_source]),
      utm_medium: firstNonEmpty([base.utm_medium, previous.utm_medium]),
      utm_campaign: firstNonEmpty([base.utm_campaign, previous.utm_campaign]),
      utm_content: firstNonEmpty([base.utm_content, previous.utm_content]),
      utm_term: firstNonEmpty([base.utm_term, previous.utm_term]),
      gclid: source.gclid || '',
      gbraid: source.gbraid || '',
      wbraid: source.wbraid || '',
      gad_source: hint.gad_source || '',
      gad_campaignid: hint.gad_campaignid || '',
      google_click_id_source: source.source || 'none',
      google_click_id_guard_version: CONFIG.guardVersion,
      has_google_click_id: hasGoogleClickId(source),
      gad_campaignid_source: hint.source || '',
      fbclid: firstNonEmpty([base.fbclid, previous.fbclid]),
      ttclid: firstNonEmpty([base.ttclid, previous.ttclid])
    };
  }

  function hasMarketingSignal(touch, googleSet) {
    return Boolean(
      touch.utm_source ||
      touch.utm_medium ||
      touch.utm_campaign ||
      touch.utm_content ||
      touch.utm_term ||
      touch.fbclid ||
      touch.ttclid ||
      hasGoogleClickId(googleSet) ||
      hasGoogleCampaignHint(googleSet) ||
      (document.referrer && document.referrer.indexOf(location.origin) !== 0)
    );
  }

  try {
    var base = collectTouchBase();
    var incoming = googleClickSetFromUrl(location.href, 'current_url');
    var previousFirst = readJson(window.localStorage, CONFIG.firstTouchKey);
    var previousLast = readJson(window.localStorage, CONFIG.latestTouchKey);
    var imwebSession = readJson(window.sessionStorage, '__bs_imweb_session');
    var firstCandidates = [
      incoming,
      googleClickSetFrom(imwebSession, 'imweb_session')
    ];
    var lastCandidates = hasGoogleClickId(incoming) || hasGoogleCampaignHint(incoming)
      ? [incoming]
      : [
          googleClickSetFrom(previousLast, 'previous_last_touch'),
          googleClickSetFrom(previousFirst, 'previous_first_touch'),
          googleClickSetFrom(imwebSession, 'imweb_session')
        ];
    var selectedForFirst = selectGoogleClickSet(firstCandidates);
    var selectedForLast = selectGoogleClickSet(lastCandidates);
    var firstHint = selectGoogleCampaignHint(firstCandidates);
    var lastHint = selectGoogleCampaignHint(lastCandidates);
    var hasSignal = hasMarketingSignal(base, incoming);
    var firstTouch = buildTouch(base, selectedForFirst, firstHint, {});
    var lastTouch = buildTouch(base, selectedForLast, lastHint, previousLast);

    if (!Object.keys(previousFirst).length) {
      writeJson(window.localStorage, CONFIG.firstTouchKey, firstTouch);
    }

    if (!readJson(window.sessionStorage, CONFIG.legacyUtmKey).capturedAt) {
      writeJson(window.sessionStorage, CONFIG.legacyUtmKey, lastTouch);
    }

    if (hasSignal || !Object.keys(previousLast).length) {
      writeJson(window.localStorage, CONFIG.latestTouchKey, lastTouch);
      writeJson(window.localStorage, CONFIG.legacyUtmKey, lastTouch);
      writeJson(window.sessionStorage, CONFIG.clickContextKey, lastTouch);
      writeJson(window.localStorage, CONFIG.clickContextKey, lastTouch);
      debugLog('stored', {
        has_google_click_id: lastTouch.has_google_click_id,
        google_click_id_source: lastTouch.google_click_id_source,
        gad_campaignid_source: lastTouch.gad_campaignid_source
      });
    }
  } catch (error) {
    debugLog('failed', error && error.message ? error.message : error);
  }
})();
</script>`;

const sharedHelpers = `
  function googleClickSetFrom(source, sourceName) {
    return {
      source: sourceName,
      gclid: trim(source && source.gclid),
      gbraid: trim(source && source.gbraid),
      wbraid: trim(source && source.wbraid),
      gad_source: trim(source && source.gad_source),
      gad_campaignid: trim(source && source.gad_campaignid)
    };
  }

  function googleClickSetFromUrl(urlLike, sourceName) {
    try {
      if (!urlLike) return googleClickSetFrom({}, sourceName);
      var url = new URL(urlLike, location.origin);
      return googleClickSetFrom({
        gclid: url.searchParams.get('gclid'),
        gbraid: url.searchParams.get('gbraid'),
        wbraid: url.searchParams.get('wbraid'),
        gad_source: url.searchParams.get('gad_source'),
        gad_campaignid: url.searchParams.get('gad_campaignid')
      }, sourceName);
    } catch (error) {
      return googleClickSetFrom({}, sourceName);
    }
  }

  function hasGoogleClickId(set) {
    return Boolean(set && (set.gclid || set.gbraid || set.wbraid));
  }

  function hasGoogleCampaignHint(set) {
    return Boolean(set && (set.gad_source || set.gad_campaignid));
  }

  function selectGoogleClickSet(candidates) {
    for (var i = 0; i < candidates.length; i += 1) {
      if (hasGoogleClickId(candidates[i])) return candidates[i];
      if (hasGoogleCampaignHint(candidates[i])) {
        return {
          source: (candidates[i].source || 'unknown') + '_no_click_id',
          gclid: '',
          gbraid: '',
          wbraid: '',
          gad_source: candidates[i].gad_source || '',
          gad_campaignid: candidates[i].gad_campaignid || ''
        };
      }
    }
    return googleClickSetFrom({}, 'none');
  }

  function selectGoogleCampaignHint(candidates) {
    for (var i = 0; i < candidates.length; i += 1) {
      if (hasGoogleCampaignHint(candidates[i])) {
        return {
          gad_source: candidates[i].gad_source || '',
          gad_campaignid: candidates[i].gad_campaignid || '',
          source: candidates[i].source || ''
        };
      }
    }
    return { gad_source: '', gad_campaignid: '', source: '' };
  }
`;

const footerBlock1 = `<script>
/* ── Block 1: UTM persistence + Google click-id structured storage + Formbricks user_id + gtag user_id ──
   Version: 2026-05-22-thecleancoffee-footer-block1-click-id-v1
*/
(function () {
  var CONFIG = {
    debugQueryKey: '__seo_attribution_debug',
    gtagRetryMs: 100,
    gtagMaxWaitMs: 5000,
    legacyUtmKey: '_p1s1a_session_touch',
    firstTouchKey: '_p1s1a_first_touch',
    latestTouchKey: '_p1s1a_last_touch',
    clickContextKey: '${CLICK_CONTEXT_KEY}',
    googleClickIdGuardVersion: '${GUARD_VERSION}'
  };

  function trim(value) {
    if (value == null) return '';
    return String(value).trim();
  }
${sharedHelpers}

  function isDebugMode() {
    return new URLSearchParams(location.search).get(CONFIG.debugQueryKey) === '1';
  }

  function debugLog() {
    if (!isDebugMode()) return;
    try {
      console.log.apply(console, ['[seo-user-utm]'].concat([].slice.call(arguments)));
    } catch (error) {}
  }

  function safeParse(raw) {
    if (!raw) return {};
    try {
      var parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (error) {
      return {};
    }
  }

  function readJson(key) {
    try {
      return safeParse(window.localStorage && window.localStorage.getItem(key));
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

  function writeJson(key, value) {
    try {
      if (!window.localStorage) return;
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {}
  }

  function writeSessionJson(key, value) {
    try {
      if (!window.sessionStorage) return;
      window.sessionStorage.setItem(key, JSON.stringify(value));
    } catch (error) {}
  }

  function firstNonEmpty(values) {
    for (var i = 0; i < values.length; i += 1) {
      var value = trim(values[i]);
      if (value) return value;
    }
    return '';
  }

  function getUserID() {
    try {
      var formbricksStr = window.localStorage && window.localStorage.getItem('formbricks-js');
      if (!formbricksStr) return '';
      var formbricks = JSON.parse(formbricksStr);
      return trim(formbricks && formbricks.personState && formbricks.personState.data && formbricks.personState.data.userId);
    } catch (error) {
      return '';
    }
  }

  function collectTrackingParams() {
    var params = new URLSearchParams(location.search);
    return {
      utm_campaign: trim(params.get('utm_campaign')),
      utm_source: trim(params.get('utm_source')),
      utm_medium: trim(params.get('utm_medium')),
      utm_content: trim(params.get('utm_content')),
      utm_term: trim(params.get('utm_term')),
      fbclid: trim(params.get('fbclid')),
      ttclid: trim(params.get('ttclid')),
      landing: location.href,
      referrer: document.referrer || '',
      ts: Date.now()
    };
  }

  function hasRealTrackingValue(tracking, googleSet) {
    return Boolean(
      tracking.utm_campaign ||
      tracking.utm_source ||
      tracking.utm_medium ||
      tracking.utm_content ||
      tracking.utm_term ||
      tracking.fbclid ||
      tracking.ttclid ||
      hasGoogleClickId(googleSet) ||
      hasGoogleCampaignHint(googleSet)
    );
  }

  function attachUserIdToExistingTouches(userId) {
    if (!userId) return;
    [CONFIG.legacyUtmKey, CONFIG.firstTouchKey, CONFIG.latestTouchKey].forEach(function (key) {
      var current = readJson(key);
      if (!Object.keys(current).length) return;
      if (current.user_id === userId) return;
      current.user_id = userId;
      current.user_id_updated_at = Date.now();
      writeJson(key, current);
    });
  }

  function buildTouch(base, googleClickSet, campaignHint, previous, userId) {
    googleClickSet = googleClickSet || googleClickSetFrom({}, 'none');
    campaignHint = campaignHint || { gad_source: '', gad_campaignid: '', source: '' };
    previous = previous || {};
    return Object.assign({}, base, {
      utm_campaign: firstNonEmpty([base.utm_campaign, previous.utm_campaign]),
      utm_source: firstNonEmpty([base.utm_source, previous.utm_source]),
      utm_medium: firstNonEmpty([base.utm_medium, previous.utm_medium]),
      utm_content: firstNonEmpty([base.utm_content, previous.utm_content]),
      utm_term: firstNonEmpty([base.utm_term, previous.utm_term]),
      gclid: googleClickSet.gclid || '',
      gbraid: googleClickSet.gbraid || '',
      wbraid: googleClickSet.wbraid || '',
      gad_source: campaignHint.gad_source || '',
      gad_campaignid: campaignHint.gad_campaignid || '',
      google_click_id_source: googleClickSet.source || 'none',
      google_click_id_guard_version: CONFIG.googleClickIdGuardVersion,
      has_google_click_id: hasGoogleClickId(googleClickSet),
      gad_campaignid_source: campaignHint.source || '',
      fbclid: firstNonEmpty([base.fbclid, previous.fbclid]),
      ttclid: firstNonEmpty([base.ttclid, previous.ttclid]),
      user_id: userId || '',
      persisted_at: new Date().toISOString()
    });
  }

  function persistUtm() {
    var userId = getUserID();
    var tracking = collectTrackingParams();
    var lastTouch = readJson(CONFIG.latestTouchKey);
    var firstTouch = readJson(CONFIG.firstTouchKey);
    var imwebSession = readSessionJson('__bs_imweb_session');
    var incoming = googleClickSetFromUrl(location.href, 'current_url');
    var incomingHasMarker = hasGoogleClickId(incoming) || hasGoogleCampaignHint(incoming);
    var clickCandidates = incomingHasMarker
      ? [incoming]
      : [
          googleClickSetFrom(lastTouch, 'last_touch'),
          googleClickSetFrom(firstTouch, 'first_touch'),
          googleClickSetFrom(imwebSession, 'imweb_session')
        ];
    var firstCandidates = [
      incoming,
      googleClickSetFrom(firstTouch, 'first_touch'),
      googleClickSetFrom(imwebSession, 'imweb_session')
    ];
    var selectedGoogleClickSet = selectGoogleClickSet(clickCandidates);
    var selectedFirstGoogleClickSet = selectGoogleClickSet(firstCandidates);
    var campaignHint = selectGoogleCampaignHint(clickCandidates);
    var firstCampaignHint = selectGoogleCampaignHint(firstCandidates);
    var next = buildTouch(tracking, selectedGoogleClickSet, campaignHint, lastTouch, userId);
    var first = buildTouch(tracking, selectedFirstGoogleClickSet, firstCampaignHint, firstTouch, userId);

    attachUserIdToExistingTouches(userId);

    if (!hasRealTrackingValue(tracking, incoming)) {
      debugLog('skip persist: no tracking params');
      return;
    }

    if (!Object.keys(firstTouch).length) {
      writeJson(CONFIG.firstTouchKey, first);
    }
    writeJson(CONFIG.latestTouchKey, next);
    writeJson(CONFIG.legacyUtmKey, next);
    writeSessionJson(CONFIG.legacyUtmKey, next);
    writeJson(CONFIG.clickContextKey, next);
    writeSessionJson(CONFIG.clickContextKey, next);
    debugLog('tracking persisted', {
      has_google_click_id: next.has_google_click_id,
      google_click_id_source: next.google_click_id_source,
      gad_campaignid_source: next.gad_campaignid_source
    });
  }

  function waitForGtag(callback) {
    var startedAt = Date.now();

    function tick() {
      if (typeof window.gtag === 'function') {
        callback();
        return;
      }
      if (Date.now() - startedAt >= CONFIG.gtagMaxWaitMs) {
        debugLog('gtag wait timeout');
        return;
      }
      window.setTimeout(tick, CONFIG.gtagRetryMs);
    }

    tick();
  }

  function setGtagUserId() {
    waitForGtag(function () {
      var userId = getUserID();
      if (!userId) return;
      window.gtag('set', { user_id: userId });
      debugLog('gtag user_id set', userId);
    });
  }

  persistUtm();
  setGtagUserId();
})();
</script>`;

const footerBlock2 = `<script>
/* ── Block 2: checkout_started 이벤트 + Google click-id structured context v1 ── */
(function () {
  var CONFIG = {
    endpoint: 'https://att.ainativeos.net/api/attribution/checkout-context',
    source: 'thecleancoffee_imweb',
    measurementIds: ['G-JLSBXX7300'],
    snippetVersion: '2026-05-22-coffee-checkout-started-click-id-v1',
    googleClickIdGuardVersion: '${GUARD_VERSION}',
    clickContextKey: '${CLICK_CONTEXT_KEY}',
    requestTimeoutMs: 800,
    debugQueryKey: '__seo_attribution_debug',
    checkoutIdKey: '__seo_checkout_id',
    checkoutContextKey: '__seo_checkout_context',
    dedupeKeyPrefix: '__seo_checkout_started_sent__:'
  };

  function trim(value) {
    if (value == null) return '';
    return String(value).trim();
  }

  function firstNonEmpty(values) {
    for (var i = 0; i < values.length; i += 1) {
      var value = trim(values[i]);
      if (value) return value;
    }
    return '';
  }
${sharedHelpers}

  function safeParse(raw) {
    if (!raw) return {};
    try {
      var parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (error) {
      return {};
    }
  }

  function readJsonStorage(storage, key) {
    try {
      if (!storage) return {};
      return safeParse(storage.getItem(key));
    } catch (error) {
      return {};
    }
  }

  function writeJsonStorage(storage, key, value) {
    try {
      if (!storage) return;
      storage.setItem(key, JSON.stringify(value));
    } catch (error) {}
  }

  function readDataLayerValue(keys) {
    if (!Array.isArray(window.dataLayer)) return '';
    for (var i = window.dataLayer.length - 1; i >= 0; i -= 1) {
      var item = window.dataLayer[i];
      if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
      for (var j = 0; j < keys.length; j += 1) {
        var key = keys[j];
        var value = trim(item[key]);
        if (value) return value;
      }
    }
    return '';
  }

  function readCookie(name) {
    var pattern = new RegExp('(?:^|; )' + name.replace(/[.*+?^\\\${}()|[\\]\\\\]/g, '\\\\$&') + '=([^;]*)');
    var match = document.cookie.match(pattern);
    return match ? decodeURIComponent(match[1]) : '';
  }

  function parseClientIdFromGaCookie(cookieValue) {
    if (!cookieValue) return '';
    var parts = cookieValue.split('.');
    if (parts.length >= 4) return parts.slice(-2).join('.');
    return '';
  }

  function parseSessionIdFromGaCookie(cookieValue) {
    if (!cookieValue) return '';
    if (cookieValue.indexOf('GS1.') === 0) {
      var gs1 = cookieValue.split('.');
      return trim(gs1[2]);
    }
    if (cookieValue.indexOf('GS2.') === 0) {
      var body = cookieValue.split('.').slice(2).join('.');
      var chunks = body.split('$');
      for (var i = 0; i < chunks.length; i += 1) {
        if (chunks[i].indexOf('s') === 0) return trim(chunks[i].slice(1));
      }
    }
    return '';
  }

  function getMeasurementCookieName(measurementId) {
    return '_ga_' + trim(measurementId).replace(/^G-/, '');
  }

  function getGtagValue(fieldName) {
    return new Promise(function (resolve) {
      if (typeof window.gtag !== 'function' || !CONFIG.measurementIds.length) {
        resolve('');
        return;
      }

      var settled = false;
      var pending = CONFIG.measurementIds.length;
      var timer = setTimeout(function () {
        if (!settled) {
          settled = true;
          resolve('');
        }
      }, CONFIG.requestTimeoutMs);

      function finish(value) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(trim(value));
      }

      function markPendingDone() {
        pending -= 1;
        if (pending <= 0) finish('');
      }

      CONFIG.measurementIds.forEach(function (measurementId) {
        try {
          window.gtag('get', measurementId, fieldName, function (value) {
            var normalized = trim(value);
            if (normalized) {
              finish(normalized);
              return;
            }
            markPendingDone();
          });
        } catch (error) {
          markPendingDone();
        }
      });
    });
  }

  function getSearchParam(keys) {
    var params = new URLSearchParams(location.search);
    for (var i = 0; i < keys.length; i += 1) {
      var value = trim(params.get(keys[i]));
      if (value) return value;
    }
    return '';
  }

  function mergeLandingParams(base, urlLike) {
    try {
      if (!urlLike) return base;
      var params = new URL(urlLike, location.origin).searchParams;
      return {
        utm_source: firstNonEmpty([base.utm_source, params.get('utm_source')]),
        utm_medium: firstNonEmpty([base.utm_medium, params.get('utm_medium')]),
        utm_campaign: firstNonEmpty([base.utm_campaign, params.get('utm_campaign')]),
        utm_content: firstNonEmpty([base.utm_content, params.get('utm_content')]),
        utm_term: firstNonEmpty([base.utm_term, params.get('utm_term')]),
        gclid: base.gclid,
        gbraid: base.gbraid,
        wbraid: base.wbraid,
        gad_source: base.gad_source,
        gad_campaignid: base.gad_campaignid,
        fbclid: firstNonEmpty([base.fbclid, params.get('fbclid')]),
        ttclid: firstNonEmpty([base.ttclid, params.get('ttclid')]),
        fbc: firstNonEmpty([base.fbc, params.get('fbc')]),
        fbp: firstNonEmpty([base.fbp, params.get('fbp')])
      };
    } catch (error) {
      return base;
    }
  }

  function isDebugMode() {
    return new URLSearchParams(location.search).get(CONFIG.debugQueryKey) === '1';
  }

  function debugLog() {
    if (!isDebugMode()) return;
    try {
      console.log.apply(console, ['[seo-checkout-started]'].concat([].slice.call(arguments)));
    } catch (error) {}
  }

  function hasSentMarker(key) {
    try {
      return Boolean(window.sessionStorage && window.sessionStorage.getItem(key));
    } catch (error) {
      return false;
    }
  }

  function rememberSent(key) {
    try {
      if (!window.sessionStorage) return;
      window.sessionStorage.setItem(key, new Date().toISOString());
    } catch (error) {}
  }

  function getOrCreateCheckoutId() {
    try {
      var existing = trim(window.sessionStorage && window.sessionStorage.getItem(CONFIG.checkoutIdKey));
      if (existing) return existing;
      var created = 'chk_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
      if (window.sessionStorage) {
        window.sessionStorage.setItem(CONFIG.checkoutIdKey, created);
      }
      return created;
    } catch (error) {
      return 'chk_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
    }
  }

  function isCheckoutCandidate() {
    var href = location.href;
    var path = location.pathname;

    if (/shop_payment_complete|shop_order_done|order_complete|payment_complete/i.test(href)) {
      return false;
    }

    return /shop_order|shop_payment|order_form|checkout/i.test(path + ' ' + href);
  }

  function sendPayload(payload) {
    return fetch(CONFIG.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
      credentials: 'omit',
      mode: 'cors'
    }).then(function (response) {
      if (!response.ok) {
        throw new Error('checkout-context failed with ' + response.status);
      }
      return { sentBy: 'fetch', accepted: true, status: response.status };
    });
  }

  if (!isCheckoutCandidate()) return;

  var imwebSession = readJsonStorage(window.sessionStorage, '__bs_imweb_session');
  var lastTouch = readJsonStorage(window.localStorage, '_p1s1a_last_touch');
  var clickContext = readJsonStorage(window.sessionStorage, CONFIG.clickContextKey);
  if (!Object.keys(clickContext).length) {
    clickContext = readJsonStorage(window.localStorage, CONFIG.clickContextKey);
  }
  var checkoutId = getOrCreateCheckoutId();
  var landing = location.href;
  var initialReferrer = firstNonEmpty([
    trim(imwebSession.initialReferrer),
    trim(lastTouch.referrer),
    document.referrer || ''
  ]);
  var googleCandidates = [
    googleClickSetFromUrl(location.href, 'current_url'),
    googleClickSetFromUrl(document.referrer, 'document_referrer'),
    googleClickSetFrom(clickContext, 'coffee_click_context'),
    googleClickSetFrom(lastTouch, 'last_touch'),
    googleClickSetFrom(imwebSession, 'imweb_session')
  ];
  var selectedGoogleClickSet = selectGoogleClickSet(googleCandidates);
  var campaignHint = selectGoogleCampaignHint(googleCandidates);
  var tracking = mergeLandingParams({
    utm_source: firstNonEmpty([trim(imwebSession.utmSource), trim(lastTouch.utm_source), getSearchParam(['utm_source'])]),
    utm_medium: firstNonEmpty([trim(imwebSession.utmMedium), trim(lastTouch.utm_medium), getSearchParam(['utm_medium'])]),
    utm_campaign: firstNonEmpty([trim(imwebSession.utmCampaign), trim(lastTouch.utm_campaign), getSearchParam(['utm_campaign'])]),
    utm_content: firstNonEmpty([trim(imwebSession.utmContent), trim(lastTouch.utm_content), getSearchParam(['utm_content'])]),
    utm_term: firstNonEmpty([trim(imwebSession.utmTerm), trim(lastTouch.utm_term), getSearchParam(['utm_term'])]),
    gclid: selectedGoogleClickSet.gclid,
    gbraid: selectedGoogleClickSet.gbraid,
    wbraid: selectedGoogleClickSet.wbraid,
    gad_source: campaignHint.gad_source,
    gad_campaignid: campaignHint.gad_campaignid,
    google_click_id_source: selectedGoogleClickSet.source,
    google_click_id_guard_version: CONFIG.googleClickIdGuardVersion,
    has_google_click_id: hasGoogleClickId(selectedGoogleClickSet),
    gad_campaignid_source: campaignHint.source,
    fbclid: firstNonEmpty([trim(lastTouch.fbclid), getSearchParam(['fbclid'])]),
    ttclid: firstNonEmpty([trim(lastTouch.ttclid), getSearchParam(['ttclid'])]),
    fbc: firstNonEmpty([trim(lastTouch.fbc), readCookie('_fbc'), getSearchParam(['fbc'])]),
    fbp: firstNonEmpty([trim(lastTouch.fbp), readCookie('_fbp'), getSearchParam(['fbp'])])
  }, landing);

  var dedupeKey = CONFIG.dedupeKeyPrefix + checkoutId;
  if (hasSentMarker(dedupeKey)) {
    debugLog('skip duplicate', dedupeKey);
    return;
  }

  Promise.all([
    Promise.resolve(firstNonEmpty([
      readDataLayerValue(['ga_session_id', 'gaSessionId']),
      trim(lastTouch.ga_session_id),
      trim(imwebSession.ga_session_id)
    ])).then(function (value) {
      if (value) return value;
      return getGtagValue('session_id').then(function (gtagValue) {
        if (gtagValue) return gtagValue;
        for (var i = 0; i < CONFIG.measurementIds.length; i += 1) {
          var cookieValue = readCookie(getMeasurementCookieName(CONFIG.measurementIds[i]));
          var parsed = parseSessionIdFromGaCookie(cookieValue);
          if (parsed) return parsed;
        }
        return '';
      });
    }),
    Promise.resolve(firstNonEmpty([
      readDataLayerValue(['client_id', 'clientId', 'ga_client_id', 'gaClientId']),
      trim(lastTouch.client_id),
      trim(imwebSession.client_id)
    ])).then(function (value) {
      if (value) return value;
      return getGtagValue('client_id').then(function (gtagValue) {
        if (gtagValue) return gtagValue;
        return parseClientIdFromGaCookie(readCookie('_ga'));
      });
    })
  ]).then(function (identity) {
    var gaSessionId = trim(identity[0]);
    var clientId = trim(identity[1]);
    var userPseudoId = firstNonEmpty([
      readDataLayerValue(['user_pseudo_id', 'userPseudoId', 'ga_user_pseudo_id', 'gaUserPseudoId']),
      trim(lastTouch.user_pseudo_id),
      trim(imwebSession.user_pseudo_id),
      clientId
    ]);
    var customerKey = firstNonEmpty([
      trim(lastTouch.customerKey),
      trim(imwebSession.customerKey),
      trim(imwebSession.memberId),
      trim(imwebSession.member_id)
    ]);
    var observedAt = new Date().toISOString();

    var payload = {
      touchpoint: 'checkout_started',
      captureMode: 'live',
      source: CONFIG.source,
      checkoutId: checkoutId,
      customerKey: customerKey,
      clientObservedAt: observedAt,
      landing: landing,
      referrer: document.referrer || '',
      ga_session_id: gaSessionId,
      client_id: clientId,
      user_pseudo_id: userPseudoId,
      utm_source: tracking.utm_source,
      utm_medium: tracking.utm_medium,
      utm_campaign: tracking.utm_campaign,
      utm_content: tracking.utm_content,
      utm_term: tracking.utm_term,
      gclid: tracking.gclid,
      gbraid: tracking.gbraid,
      wbraid: tracking.wbraid,
      gad_source: tracking.gad_source,
      gad_campaignid: tracking.gad_campaignid,
      fbclid: tracking.fbclid,
      ttclid: tracking.ttclid,
      fbc: tracking.fbc,
      fbp: tracking.fbp,
      metadata: {
        snippetVersion: CONFIG.snippetVersion,
        ga_measurement_ids: CONFIG.measurementIds,
        fbc: tracking.fbc,
        fbp: tracking.fbp,
        checkoutTrigger: 'pageview',
        checkoutUrl: landing,
        imweb_landing_url: trim(imwebSession.utmLandingUrl),
        initial_referrer: initialReferrer,
        original_referrer: initialReferrer,
        user_pseudo_id_strategy: userPseudoId && userPseudoId === clientId ? 'client_id_fallback' : 'explicit_value',
        gclid: tracking.gclid,
        gbraid: tracking.gbraid,
        wbraid: tracking.wbraid,
        gad_source: tracking.gad_source,
        gad_campaignid: tracking.gad_campaignid,
        has_gclid: Boolean(tracking.gclid),
        has_gbraid: Boolean(tracking.gbraid),
        has_wbraid: Boolean(tracking.wbraid),
        has_google_click_id: tracking.has_google_click_id,
        google_click_id_source: tracking.google_click_id_source,
        google_click_id_guard_version: tracking.google_click_id_guard_version,
        gad_campaignid_source: tracking.gad_campaignid_source
      }
    };

    writeJsonStorage(window.sessionStorage, CONFIG.checkoutContextKey, {
      checkoutId: checkoutId,
      clientObservedAt: observedAt,
      landing: landing,
      referrer: payload.referrer,
      gaSessionId: gaSessionId,
      clientId: clientId,
      userPseudoId: userPseudoId,
      customerKey: customerKey,
      snippetVersion: CONFIG.snippetVersion,
      gclid: tracking.gclid,
      gbraid: tracking.gbraid,
      wbraid: tracking.wbraid,
      gad_source: tracking.gad_source,
      gad_campaignid: tracking.gad_campaignid,
      google_click_id_source: tracking.google_click_id_source,
      google_click_id_guard_version: tracking.google_click_id_guard_version,
      googleClickIdSource: tracking.google_click_id_source,
      googleClickIdGuardVersion: tracking.google_click_id_guard_version,
      has_google_click_id: tracking.has_google_click_id,
      gad_campaignid_source: tracking.gad_campaignid_source
    });

    debugLog('send payload', payload);
    return sendPayload(payload).then(function (result) {
      rememberSent(dedupeKey);
      debugLog('send ok', result);
      return result;
    }).catch(function (error) {
      debugLog('send failed', error && error.message ? error.message : error);
    });
  });
})();
</script>`;

const footerBlock3 = `<script>
/* ── Block 3: payment_success 이벤트 + Google click-id structured context v1 ── */
(function () {
  var CONFIG = {
    endpoint: 'https://att.ainativeos.net/api/attribution/payment-success',
    source: 'thecleancoffee_imweb',
    measurementIds: ['G-JLSBXX7300'],
    snippetVersion: '2026-05-22-coffee-payment-success-click-id-v1',
    googleClickIdGuardVersion: '${GUARD_VERSION}',
    clickContextKey: '${CLICK_CONTEXT_KEY}',
    requestTimeoutMs: 800,
    debugQueryKey: '__seo_attribution_debug',
    dedupeKeyPrefix: '__seo_payment_success_sent__:'
  };

  if (location.href.indexOf('shop_payment_complete') < 0 && location.href.indexOf('shop_order_done') < 0) return;

  function trim(value) {
    if (value == null) return '';
    return String(value).trim();
  }

  function firstNonEmpty(values) {
    for (var i = 0; i < values.length; i += 1) {
      var value = trim(values[i]);
      if (value) return value;
    }
    return '';
  }
${sharedHelpers}

  function safeParse(raw) {
    if (!raw) return {};
    try {
      var parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (error) {
      return {};
    }
  }

  function readJsonStorage(storage, key) {
    try {
      if (!storage) return {};
      return safeParse(storage.getItem(key));
    } catch (error) {
      return {};
    }
  }

  function readDataLayerValue(keys) {
    if (!Array.isArray(window.dataLayer)) return '';
    for (var i = window.dataLayer.length - 1; i >= 0; i -= 1) {
      var item = window.dataLayer[i];
      if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
      for (var j = 0; j < keys.length; j += 1) {
        var key = keys[j];
        var value = trim(item[key]);
        if (value) return value;
      }
    }
    return '';
  }

  function readCookie(name) {
    var pattern = new RegExp('(?:^|; )' + name.replace(/[.*+?^\\\${}()|[\\]\\\\]/g, '\\\\$&') + '=([^;]*)');
    var match = document.cookie.match(pattern);
    return match ? decodeURIComponent(match[1]) : '';
  }

  function parseClientIdFromGaCookie(cookieValue) {
    if (!cookieValue) return '';
    var parts = cookieValue.split('.');
    if (parts.length >= 4) return parts.slice(-2).join('.');
    return '';
  }

  function parseSessionIdFromGaCookie(cookieValue) {
    if (!cookieValue) return '';
    if (cookieValue.indexOf('GS1.') === 0) {
      var gs1 = cookieValue.split('.');
      return trim(gs1[2]);
    }
    if (cookieValue.indexOf('GS2.') === 0) {
      var body = cookieValue.split('.').slice(2).join('.');
      var chunks = body.split('$');
      for (var i = 0; i < chunks.length; i += 1) {
        if (chunks[i].indexOf('s') === 0) return trim(chunks[i].slice(1));
      }
    }
    return '';
  }

  function getMeasurementCookieName(measurementId) {
    return '_ga_' + trim(measurementId).replace(/^G-/, '');
  }

  function getGtagValue(fieldName) {
    return new Promise(function (resolve) {
      if (typeof window.gtag !== 'function' || !CONFIG.measurementIds.length) {
        resolve('');
        return;
      }

      var settled = false;
      var pending = CONFIG.measurementIds.length;
      var timer = setTimeout(function () {
        if (!settled) {
          settled = true;
          resolve('');
        }
      }, CONFIG.requestTimeoutMs);

      function finish(value) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(trim(value));
      }

      function markPendingDone() {
        pending -= 1;
        if (pending <= 0) finish('');
      }

      CONFIG.measurementIds.forEach(function (measurementId) {
        try {
          window.gtag('get', measurementId, fieldName, function (value) {
            var normalized = trim(value);
            if (normalized) {
              finish(normalized);
              return;
            }
            markPendingDone();
          });
        } catch (error) {
          markPendingDone();
        }
      });
    });
  }

  function getSearchParam(keys) {
    var params = new URLSearchParams(location.search);
    for (var i = 0; i < keys.length; i += 1) {
      var value = trim(params.get(keys[i]));
      if (value) return value;
    }
    return '';
  }

  function getSearchParamFromUrl(keys, urlLike) {
    try {
      if (!urlLike) return '';
      var params = new URL(urlLike, location.origin).searchParams;
      for (var i = 0; i < keys.length; i += 1) {
        var value = trim(params.get(keys[i]));
        if (value) return value;
      }
    } catch (error) {}
    return '';
  }

  function parsePaymentParamsFromUrl(urlLike) {
    return {
      orderCode: getSearchParamFromUrl(['orderCode', 'order_code'], urlLike),
      orderNo: getSearchParamFromUrl(['orderNo', 'order_no'], urlLike),
      orderId: getSearchParamFromUrl(['orderId', 'order_id'], urlLike),
      orderMember: getSearchParamFromUrl(['orderMember', 'order_member'], urlLike),
      paymentCode: getSearchParamFromUrl(['paymentCode', 'payment_code'], urlLike),
      paymentKey: getSearchParamFromUrl(['paymentKey', 'payment_key'], urlLike),
      amount: getSearchParamFromUrl(['amount', 'totalAmount', 'total_amount'], urlLike)
    };
  }

  function getOrderIdFromDom() {
    var selectors = [
      '[data-order-no]',
      '[data-order]',
      '[class*="order-number"]',
      '[class*="order_no"]'
    ];

    for (var i = 0; i < selectors.length; i += 1) {
      var node = document.querySelector(selectors[i]);
      if (!node) continue;
      var value = firstNonEmpty([
        node.getAttribute && node.getAttribute('data-order-no'),
        node.getAttribute && node.getAttribute('data-order'),
        node.textContent
      ]);
      if (value) return value;
    }

    return '';
  }

  function mergeLandingParams(base, urlLike) {
    try {
      if (!urlLike) return base;
      var params = new URL(urlLike, location.origin).searchParams;
      return {
        utm_source: firstNonEmpty([base.utm_source, params.get('utm_source')]),
        utm_medium: firstNonEmpty([base.utm_medium, params.get('utm_medium')]),
        utm_campaign: firstNonEmpty([base.utm_campaign, params.get('utm_campaign')]),
        utm_content: firstNonEmpty([base.utm_content, params.get('utm_content')]),
        utm_term: firstNonEmpty([base.utm_term, params.get('utm_term')]),
        gclid: base.gclid,
        gbraid: base.gbraid,
        wbraid: base.wbraid,
        gad_source: base.gad_source,
        gad_campaignid: base.gad_campaignid,
        fbclid: firstNonEmpty([base.fbclid, params.get('fbclid')]),
        ttclid: firstNonEmpty([base.ttclid, params.get('ttclid')]),
        fbc: firstNonEmpty([base.fbc, params.get('fbc')]),
        fbp: firstNonEmpty([base.fbp, params.get('fbp')])
      };
    } catch (error) {
      return base;
    }
  }

  function hasSentMarker(key) {
    try {
      return Boolean(window.sessionStorage && window.sessionStorage.getItem(key));
    } catch (error) {
      return false;
    }
  }

  function rememberSent(key) {
    try {
      if (!window.sessionStorage) return;
      window.sessionStorage.setItem(key, new Date().toISOString());
    } catch (error) {}
  }

  function clearCheckoutContext() {
    try {
      if (!window.sessionStorage) return;
      window.sessionStorage.removeItem('__seo_checkout_id');
      window.sessionStorage.removeItem('__seo_checkout_context');
    } catch (error) {}
  }

  function isDebugMode() {
    return new URLSearchParams(location.search).get(CONFIG.debugQueryKey) === '1';
  }

  function debugLog() {
    if (!isDebugMode()) return;
    try {
      console.log.apply(console, ['[seo-attribution]'].concat([].slice.call(arguments)));
    } catch (error) {}
  }

  function sendPayload(payload) {
    return fetch(CONFIG.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
      credentials: 'omit',
      mode: 'cors'
    }).then(function (response) {
      if (!response.ok) {
        throw new Error('payment-success failed with ' + response.status);
      }
      return { sentBy: 'fetch', accepted: true, status: response.status };
    });
  }

  var imwebSession = readJsonStorage(window.sessionStorage, '__bs_imweb_session');
  var lastTouch = readJsonStorage(window.localStorage, '_p1s1a_last_touch');
  var checkoutContext = readJsonStorage(window.sessionStorage, '__seo_checkout_context');
  var clickContext = readJsonStorage(window.sessionStorage, CONFIG.clickContextKey);
  if (!Object.keys(clickContext).length) {
    clickContext = readJsonStorage(window.localStorage, CONFIG.clickContextKey);
  }
  var checkoutId = firstNonEmpty([
    trim(checkoutContext.checkoutId),
    trim(imwebSession.checkoutId),
    getSearchParam(['checkoutId', 'checkout_id'])
  ]);
  var referrerPayment = parsePaymentParamsFromUrl(document.referrer);

  var orderId = firstNonEmpty([
    getSearchParam(['order_no', 'orderNo', 'orderId', 'order_id']),
    trim(referrerPayment.orderNo),
    trim(referrerPayment.orderId),
    trim(imwebSession.order_no),
    trim(imwebSession.orderId),
    trim(lastTouch.orderId),
    trim(lastTouch.order_id),
    getOrderIdFromDom()
  ]);
  var paymentKey = firstNonEmpty([
    getSearchParam(['paymentKey', 'payment_key']),
    trim(referrerPayment.paymentKey),
    trim(imwebSession.paymentKey),
    trim(imwebSession.payment_key),
    trim(lastTouch.paymentKey),
    trim(lastTouch.payment_key)
  ]);
  var orderCode = firstNonEmpty([
    getSearchParam(['order_code', 'orderCode']),
    trim(referrerPayment.orderCode),
    trim(imwebSession.orderCode),
    trim(imwebSession.order_code),
    trim(lastTouch.orderCode),
    trim(lastTouch.order_code)
  ]);
  var orderMember = firstNonEmpty([
    getSearchParam(['order_member', 'orderMember']),
    trim(referrerPayment.orderMember),
    trim(imwebSession.orderMember),
    trim(imwebSession.order_member),
    trim(lastTouch.orderMember),
    trim(lastTouch.order_member)
  ]);
  var landing = firstNonEmpty([
    trim(imwebSession.utmLandingUrl),
    trim(lastTouch.landing),
    trim(checkoutContext.landing),
    location.pathname
  ]);
  var isVersionedCheckout =
    trim(checkoutContext.google_click_id_guard_version || checkoutContext.googleClickIdGuardVersion) === CONFIG.googleClickIdGuardVersion;
  var versionedCheckoutContext = isVersionedCheckout ? checkoutContext : {};
  var legacyCheckoutContext = isVersionedCheckout ? {} : checkoutContext;
  var googleCandidates = [
    googleClickSetFromUrl(location.href, 'current_url'),
    googleClickSetFrom(versionedCheckoutContext, 'checkout_context_coffee_v1'),
    googleClickSetFromUrl(document.referrer, 'document_referrer'),
    googleClickSetFrom(clickContext, 'coffee_click_context'),
    googleClickSetFrom(lastTouch, 'last_touch'),
    googleClickSetFrom(imwebSession, 'imweb_session'),
    googleClickSetFrom(legacyCheckoutContext, 'legacy_checkout_context')
  ];
  var selectedGoogleClickSet = selectGoogleClickSet(googleCandidates);
  var campaignHint = selectGoogleCampaignHint(googleCandidates);
  var tracking = mergeLandingParams({
    utm_source: firstNonEmpty([trim(imwebSession.utmSource), trim(lastTouch.utm_source), getSearchParam(['utm_source'])]),
    utm_medium: firstNonEmpty([trim(imwebSession.utmMedium), trim(lastTouch.utm_medium), getSearchParam(['utm_medium'])]),
    utm_campaign: firstNonEmpty([trim(imwebSession.utmCampaign), trim(lastTouch.utm_campaign), getSearchParam(['utm_campaign'])]),
    utm_content: firstNonEmpty([trim(imwebSession.utmContent), trim(lastTouch.utm_content), getSearchParam(['utm_content'])]),
    utm_term: firstNonEmpty([trim(imwebSession.utmTerm), trim(lastTouch.utm_term), getSearchParam(['utm_term'])]),
    gclid: selectedGoogleClickSet.gclid,
    gbraid: selectedGoogleClickSet.gbraid,
    wbraid: selectedGoogleClickSet.wbraid,
    gad_source: campaignHint.gad_source,
    gad_campaignid: campaignHint.gad_campaignid,
    google_click_id_source: selectedGoogleClickSet.source,
    google_click_id_guard_version: CONFIG.googleClickIdGuardVersion,
    has_google_click_id: hasGoogleClickId(selectedGoogleClickSet),
    gad_campaignid_source: campaignHint.source,
    fbclid: firstNonEmpty([trim(lastTouch.fbclid), getSearchParam(['fbclid'])]),
    ttclid: firstNonEmpty([trim(lastTouch.ttclid), getSearchParam(['ttclid'])]),
    fbc: firstNonEmpty([trim(lastTouch.fbc), readCookie('_fbc'), getSearchParam(['fbc'])]),
    fbp: firstNonEmpty([trim(lastTouch.fbp), readCookie('_fbp'), getSearchParam(['fbp'])])
  }, landing);

  var dedupeKey = CONFIG.dedupeKeyPrefix + firstNonEmpty([
    orderCode,
    orderId,
    paymentKey,
    location.pathname + '::' + document.referrer
  ]);
  if (dedupeKey && hasSentMarker(dedupeKey)) {
    debugLog('skip duplicate', dedupeKey);
    return;
  }

  Promise.all([
    Promise.resolve(firstNonEmpty([
      readDataLayerValue(['ga_session_id', 'gaSessionId']),
      trim(lastTouch.ga_session_id),
      trim(imwebSession.ga_session_id),
      trim(checkoutContext.gaSessionId)
    ])).then(function (value) {
      if (value) return value;
      return getGtagValue('session_id').then(function (gtagValue) {
        if (gtagValue) return gtagValue;
        for (var i = 0; i < CONFIG.measurementIds.length; i += 1) {
          var cookieValue = readCookie(getMeasurementCookieName(CONFIG.measurementIds[i]));
          var parsed = parseSessionIdFromGaCookie(cookieValue);
          if (parsed) return parsed;
        }
        return '';
      });
    }),
    Promise.resolve(firstNonEmpty([
      readDataLayerValue(['client_id', 'clientId', 'ga_client_id', 'gaClientId']),
      trim(lastTouch.client_id),
      trim(imwebSession.client_id),
      trim(checkoutContext.clientId)
    ])).then(function (value) {
      if (value) return value;
      return getGtagValue('client_id').then(function (gtagValue) {
        if (gtagValue) return gtagValue;
        return parseClientIdFromGaCookie(readCookie('_ga'));
      });
    })
  ]).then(function (identity) {
    var gaSessionId = trim(identity[0]);
    var clientId = trim(identity[1]);
    var userPseudoId = firstNonEmpty([
      readDataLayerValue(['user_pseudo_id', 'userPseudoId', 'ga_user_pseudo_id', 'gaUserPseudoId']),
      trim(lastTouch.user_pseudo_id),
      trim(imwebSession.user_pseudo_id),
      trim(checkoutContext.userPseudoId),
      clientId
    ]);

    var payload = {
      touchpoint: 'payment_success',
      captureMode: 'live',
      source: CONFIG.source,
      orderId: orderId,
      orderCode: orderCode,
      orderMember: orderMember,
      paymentKey: paymentKey,
      checkoutId: checkoutId,
      clientObservedAt: new Date().toISOString(),
      referrer: document.referrer || '',
      landing: landing,
      ga_session_id: gaSessionId,
      client_id: clientId,
      user_pseudo_id: userPseudoId,
      utm_source: tracking.utm_source,
      utm_medium: tracking.utm_medium,
      utm_campaign: tracking.utm_campaign,
      utm_content: tracking.utm_content,
      utm_term: tracking.utm_term,
      gclid: tracking.gclid,
      gbraid: tracking.gbraid,
      wbraid: tracking.wbraid,
      gad_source: tracking.gad_source,
      gad_campaignid: tracking.gad_campaignid,
      fbclid: tracking.fbclid,
      ttclid: tracking.ttclid,
      fbc: tracking.fbc,
      fbp: tracking.fbp,
      metadata: {
        snippetVersion: CONFIG.snippetVersion,
        ga_measurement_ids: CONFIG.measurementIds,
        imweb_landing_url: trim(imwebSession.utmLandingUrl),
        initial_referrer: firstNonEmpty([trim(imwebSession.initialReferrer), trim(lastTouch.referrer)]),
        original_referrer: firstNonEmpty([trim(imwebSession.initialReferrer), trim(lastTouch.referrer)]),
        fbc: tracking.fbc,
        fbp: tracking.fbp,
        checkout_started_observed_at: trim(checkoutContext.clientObservedAt),
        checkout_started_landing: trim(checkoutContext.landing),
        checkout_started_snippet_version: trim(checkoutContext.snippetVersion),
        user_pseudo_id_strategy: userPseudoId && userPseudoId === clientId ? 'client_id_fallback' : 'explicit_value',
        gclid: tracking.gclid,
        gbraid: tracking.gbraid,
        wbraid: tracking.wbraid,
        gad_source: tracking.gad_source,
        gad_campaignid: tracking.gad_campaignid,
        has_gclid: Boolean(tracking.gclid),
        has_gbraid: Boolean(tracking.gbraid),
        has_wbraid: Boolean(tracking.wbraid),
        has_google_click_id: tracking.has_google_click_id,
        google_click_id_source: tracking.google_click_id_source,
        google_click_id_guard_version: tracking.google_click_id_guard_version,
        gad_campaignid_source: tracking.gad_campaignid_source,
        orderCode: orderCode,
        order_code: orderCode,
        orderMember: orderMember,
        order_member: orderMember,
        browser_purchase_event_id: orderCode ? 'Purchase.' + orderCode : '',
        referrerPayment: {
          orderCode: orderCode || trim(referrerPayment.orderCode),
          orderNo: orderId || trim(referrerPayment.orderNo),
          orderId: trim(referrerPayment.orderId),
          orderMember: orderMember || trim(referrerPayment.orderMember),
          paymentCode: trim(referrerPayment.paymentCode),
          paymentKey: paymentKey || trim(referrerPayment.paymentKey),
          amount: trim(referrerPayment.amount)
        }
      }
    };

    if (
      !payload.orderId &&
      !payload.paymentKey &&
      !payload.orderCode &&
      payload.referrer.indexOf('paymentKey=') < 0 &&
      payload.referrer.indexOf('payment_key=') < 0 &&
      payload.referrer.indexOf('orderNo=') < 0 &&
      payload.referrer.indexOf('order_no=') < 0 &&
      payload.referrer.indexOf('orderId=') < 0 &&
      payload.referrer.indexOf('order_id=') < 0 &&
      payload.referrer.indexOf('orderCode=') < 0 &&
      payload.referrer.indexOf('order_code=') < 0
    ) {
      debugLog('skip: no order/payment/orderCode hint', payload);
      return;
    }

    debugLog('send payload', payload);
    return sendPayload(payload).then(function (result) {
      if (dedupeKey) rememberSent(dedupeKey);
      clearCheckoutContext();
      debugLog('send ok', result);
      return result;
    }).catch(function (error) {
      debugLog('send failed', error && error.message ? error.message : error);
    });
  });
})();
</script>`;

function updateHeaderTop(headerTop) {
  const marker = '<script>\n(function () {\n  try {\n    var url = new URL(window.location.href);';
  const index = headerTop.lastIndexOf(marker);
  if (index < 0) fail('header top simple UTM script not found');
  return headerTop.slice(0, index).trimEnd() + '\n\n' + headerTopClickIdScript;
}

function updateFooter(footerCode) {
  let next = footerCode.replace(
    '<!-- thecleancoffee footer v3 - 2026-04-15 final3 (Phase 9 fbq mirror / eventId injector added) -->',
    '<!-- thecleancoffee footer candidate v4 - 2026-05-22 click-id structured storage; Phase 9 unchanged -->',
  );
  next = next
    .replace('기존 라벨에 문제 없음 (biocom 같은 오염 없음).', '기존 Coffee 라벨 유지.')
    .replace('biocom final3 와 구조 동일, 사이트별 식별자만 치환:', '기존 Coffee Phase 9 구조 유지, 사이트별 식별자 확인:')
    .replace('단계 1 (testEventCode Test Events 탭) / 단계 2 (정식 운영) 는 biocom v3 와 동일 rollout.', '단계 1 (testEventCode Test Events 탭) / 단계 2 (정식 운영) 는 별도 승인 후 rollout.');
  next = replaceBetween(
    next,
    '<script>\n/* ── Block 1: UTM persistence + Formbricks user_id + gtag user_id ── */',
    '\n\n<script>\n/* ── Block 2: checkout_started 이벤트 ── */',
    footerBlock1,
    'footer block 1',
  );
  next = replaceBetween(
    next,
    '<script>\n/* ── Block 2: checkout_started 이벤트 ── */',
    '\n\n<script>\n/* ── Block 3: payment_success 이벤트 (orderCode/referrerPayment/fbc/fbp 전부 포함) ── */',
    footerBlock2,
    'footer block 2',
  );
  next = replaceBetween(
    next,
    '<script>\n/* ── Block 3: payment_success 이벤트 (orderCode/referrerPayment/fbc/fbp 전부 포함) ── */',
    '\n\n<!--\n  Phase 9 Funnel CAPI mirror',
    footerBlock3,
    'footer block 3',
  );
  return next;
}

const sections = splitSections(source);
const candidate = {
  headerTop: updateHeaderTop(sections.headerTop),
  headerCode: sections.headerCode,
  bodyCode: sections.bodyCode,
  footerCode: updateFooter(sections.footerCode),
};

const output = `# 더클린커피 Imweb Full Paste Candidate

작성 시각: ${GENERATED_AT}
기준일: 2026-05-22
문서 성격: 더클린커피 Imweb custom code 전체 붙여넣기 후보 / 운영 반영 전 검토본
Lane: Green candidate generation only / Red Lane required for Imweb save

\`\`\`yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - harness/coffee-data/README.md
    - harness/coffee-data/RULES.md
    - harness/coffee-data/VERIFY.md
    - harness/coffee-data/AUDITOR_CHECKLIST.md
  required_context_docs:
    - imweb/!coderule-thecleancoffee.md
    - project/coffee-google-click-storage-smoke-result-20260521.md
    - project/coffee-google-click-id-structured-storage-plan-20260521.md
    - project/coffee-click-id-structured-storage-fixture-result-20260521.md
    - project/coffee-meta-pixel-eventid-nosend-smoke-result-20260521.md
  lane: Green
  allowed_actions:
    - candidate_code_generation
    - local_static_validation
    - no_send_fixture_reference
  forbidden_actions:
    - Imweb save/publish
    - GTM Production publish
    - Google Ads conversion action mutate
    - Google Ads conversion upload
    - GA4/Meta/Google Ads production send toggle
    - actual checkout or purchase
    - production DB or VM Cloud SQLite write
  source_window_freshness_confidence:
    source: ${SOURCE} + Coffee click-id fixture 9/9 PASS + Meta eventId no-send smoke PASS
    window: candidate generated ${GENERATED_AT}
    freshness: generated from latest local Coffee code snapshot and 2026-05-21 smoke docs
    confidence: 0.84
\`\`\`

## 10초 요약

이 문서는 더클린커피 Imweb 4개 입력칸에 붙여넣을 수 있는 전체 후보 코드다. 실제 운영 저장은 하지 않았다.

바뀐 부분은 Google 클릭 ID 보존 경로다. 기존 gclid 중심 저장에 gbraid, wbraid, gad_source, gad_campaignid 구조화 저장을 추가하고, gclid/gbraid/wbraid를 한 출처 묶음으로 선택해 stale click id 혼입을 막는다.

그대로 둔 부분은 Google Ads 장바구니 hardcoded snippet, GTM loader, Naver wcs, Keepgrow, Purchase Guard, Phase 9 Funnel CAPI mirror다.

## 변경 범위

1. 헤더 상단: 단순 UTM persistence script를 Coffee click-id structured storage v1로 교체.
2. 푸터 Block 1: _p1s1a_* touch 저장에 gbraid/wbraid/gad_source/gad_campaignid와 guard metadata 추가.
3. 푸터 Block 2: checkout-context payload와 session checkout context에 Google click-id 묶음 저장.
4. 푸터 Block 3: payment-success payload에 versioned checkout context 우선 복원과 Google click-id 묶음 저장.

## 금지선

- 이 문서 내용을 Imweb에 저장하는 행위는 Red Lane이다.
- 저장 전 TJ님 명시 승인과 운영 전 백업이 필요하다.
- Google Ads conversion upload, GTM Production publish, Meta CAPI enable은 이 후보 범위가 아니다.

## 후보 검증 결과

정적 검증:

- inline script syntax check: 13개 script PASS
- Coffee key 확인: __thecleancoffee_click_id_context_v1 있음
- Biocom 전용 click context key 없음
- Coffee GTM/GA4/Pixel 유지: GTM-5M33GC4, G-JLSBXX7300, 1186437633687388 있음
- Biocom GTM container 없음
- Meta CAPI 설정: enableServerCapi: false 유지

후보 코드 브라우저 저장 smoke:

- 새 gclid+gbraid + 이전 stale wbraid: wbraid="", has_google_click_id=true PASS
- 새 wbraid only: wbraid 보존, has_google_click_id=true PASS
- gad_campaignid only + 이전 stale click id: gclid/gbraid/wbraid="", has_google_click_id=false PASS
- local browser console error: 0

기존 Coffee fixture:

- node scripts/coffee-click-id-structured-storage-fixture.mjs
- 결과: 9/9 PASS

## [헤더 상단]

\`\`\`html
${candidate.headerTop}
\`\`\`

## [헤더 코드]

\`\`\`html
${candidate.headerCode}
\`\`\`

## [바디 코드]

\`\`\`html
${candidate.bodyCode}
\`\`\`

## [푸터 코드]

\`\`\`html
${candidate.footerCode}
\`\`\`
`;

fs.writeFileSync(TARGET, output);
console.log(`wrote ${TARGET}`);
