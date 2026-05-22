#!/usr/bin/env node

import assert from 'node:assert/strict';

const GUARD_VERSION = 'v4.4.3';

function trim(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function firstNonEmpty(values) {
  for (const value of values) {
    const normalized = trim(value);
    if (normalized) return normalized;
  }
  return '';
}

function googleClickSetFrom(source, sourceName) {
  return {
    source: sourceName,
    gclid: trim(source?.gclid),
    gbraid: trim(source?.gbraid),
    wbraid: trim(source?.wbraid),
  };
}

function googleClickSetFromUrl(urlLike, sourceName) {
  try {
    const url = new URL(urlLike || '', 'https://biocom.kr');
    return googleClickSetFrom(
      {
        gclid: url.searchParams.get('gclid'),
        gbraid: url.searchParams.get('gbraid'),
        wbraid: url.searchParams.get('wbraid'),
      },
      sourceName,
    );
  } catch {
    return googleClickSetFrom({}, sourceName);
  }
}

function hasGoogleClickSet(set) {
  return Boolean(set?.gclid || set?.gbraid || set?.wbraid);
}

function selectGoogleClickSet(candidates) {
  for (const candidate of candidates) {
    if (hasGoogleClickSet(candidate)) return candidate;
  }
  return googleClickSetFrom({}, 'none');
}

function legacyMergeTouch(previous, incoming, options = {}) {
  const preferIncomingForUtm = options.preferIncomingForUtm !== false;
  const preferIncomingForClickId = options.preferIncomingForClickId !== false;

  return {
    utm_source: preferIncomingForUtm
      ? firstNonEmpty([incoming.utm_source, previous.utm_source])
      : firstNonEmpty([previous.utm_source, incoming.utm_source]),
    utm_medium: preferIncomingForUtm
      ? firstNonEmpty([incoming.utm_medium, previous.utm_medium])
      : firstNonEmpty([previous.utm_medium, incoming.utm_medium]),
    utm_campaign: preferIncomingForUtm
      ? firstNonEmpty([incoming.utm_campaign, previous.utm_campaign])
      : firstNonEmpty([previous.utm_campaign, incoming.utm_campaign]),
    gclid: preferIncomingForClickId
      ? firstNonEmpty([incoming.gclid, previous.gclid])
      : firstNonEmpty([previous.gclid, incoming.gclid]),
    gbraid: preferIncomingForClickId
      ? firstNonEmpty([incoming.gbraid, previous.gbraid])
      : firstNonEmpty([previous.gbraid, incoming.gbraid]),
    wbraid: preferIncomingForClickId
      ? firstNonEmpty([incoming.wbraid, previous.wbraid])
      : firstNonEmpty([previous.wbraid, incoming.wbraid]),
    fbclid: preferIncomingForClickId
      ? firstNonEmpty([incoming.fbclid, previous.fbclid])
      : firstNonEmpty([previous.fbclid, incoming.fbclid]),
    ttclid: preferIncomingForClickId
      ? firstNonEmpty([incoming.ttclid, previous.ttclid])
      : firstNonEmpty([previous.ttclid, incoming.ttclid]),
  };
}

function v443MergeTouch(previous, incoming, options = {}) {
  const preferIncomingForUtm = options.preferIncomingForUtm !== false;
  const preferIncomingForClickId = options.preferIncomingForClickId !== false;
  const googleClickSet = selectGoogleClickSet(
    preferIncomingForClickId
      ? [
          googleClickSetFrom(incoming, 'incoming'),
          googleClickSetFrom(previous, 'previous'),
        ]
      : [
          googleClickSetFrom(previous, 'previous'),
          googleClickSetFrom(incoming, 'incoming'),
        ],
  );

  return {
    utm_source: preferIncomingForUtm
      ? firstNonEmpty([incoming.utm_source, previous.utm_source])
      : firstNonEmpty([previous.utm_source, incoming.utm_source]),
    utm_medium: preferIncomingForUtm
      ? firstNonEmpty([incoming.utm_medium, previous.utm_medium])
      : firstNonEmpty([previous.utm_medium, incoming.utm_medium]),
    utm_campaign: preferIncomingForUtm
      ? firstNonEmpty([incoming.utm_campaign, previous.utm_campaign])
      : firstNonEmpty([previous.utm_campaign, incoming.utm_campaign]),
    gclid: googleClickSet.gclid,
    gbraid: googleClickSet.gbraid,
    wbraid: googleClickSet.wbraid,
    google_click_id_source: googleClickSet.source,
    google_click_id_guard_version: GUARD_VERSION,
    fbclid: preferIncomingForClickId
      ? firstNonEmpty([incoming.fbclid, previous.fbclid])
      : firstNonEmpty([previous.fbclid, incoming.fbclid]),
    ttclid: preferIncomingForClickId
      ? firstNonEmpty([incoming.ttclid, previous.ttclid])
      : firstNonEmpty([previous.ttclid, incoming.ttclid]),
  };
}

function readUrlParam(urlLike, key) {
  try {
    const url = new URL(urlLike || '', 'https://biocom.kr');
    return trim(url.searchParams.get(key));
  } catch {
    return '';
  }
}

function legacyBlock2CheckoutTracking({
  locationHref,
  clickContext = {},
  lastTouch = {},
  imwebSession = {},
}) {
  return {
    gclid: firstNonEmpty([
      readUrlParam(locationHref, 'gclid'),
      clickContext.gclid,
      lastTouch.gclid,
      imwebSession.gclid,
    ]),
    gbraid: firstNonEmpty([
      readUrlParam(locationHref, 'gbraid'),
      clickContext.gbraid,
      lastTouch.gbraid,
      imwebSession.gbraid,
    ]),
    wbraid: firstNonEmpty([
      readUrlParam(locationHref, 'wbraid'),
      clickContext.wbraid,
      lastTouch.wbraid,
      imwebSession.wbraid,
    ]),
  };
}

function v443Block2CheckoutTracking({
  locationHref,
  documentReferrer,
  clickContext = {},
  lastTouch = {},
  imwebSession = {},
}) {
  const selectedGoogleClickSet = selectGoogleClickSet([
    googleClickSetFromUrl(locationHref, 'current_url'),
    googleClickSetFromUrl(documentReferrer, 'document_referrer'),
    googleClickSetFrom(clickContext, 'header_click_context'),
    googleClickSetFrom(lastTouch, 'last_touch'),
    googleClickSetFrom(
      {
        gclid: imwebSession.gclid,
        gbraid: imwebSession.gbraid,
        wbraid: imwebSession.wbraid,
      },
      'imweb_session',
    ),
  ]);

  return {
    gclid: selectedGoogleClickSet.gclid,
    gbraid: selectedGoogleClickSet.gbraid,
    wbraid: selectedGoogleClickSet.wbraid,
    googleClickIdSource: selectedGoogleClickSet.source,
    googleClickIdGuardVersion: GUARD_VERSION,
  };
}

function legacyBlock3PaymentTracking({
  locationHref,
  checkoutContext = {},
  clickContext = {},
  lastTouch = {},
  imwebSession = {},
}) {
  return {
    gclid: firstNonEmpty([
      readUrlParam(locationHref, 'gclid'),
      checkoutContext.gclid,
      clickContext.gclid,
      lastTouch.gclid,
      imwebSession.gclid,
    ]),
    gbraid: firstNonEmpty([
      readUrlParam(locationHref, 'gbraid'),
      checkoutContext.gbraid,
      clickContext.gbraid,
      lastTouch.gbraid,
      imwebSession.gbraid,
    ]),
    wbraid: firstNonEmpty([
      readUrlParam(locationHref, 'wbraid'),
      checkoutContext.wbraid,
      clickContext.wbraid,
      lastTouch.wbraid,
      imwebSession.wbraid,
    ]),
  };
}

function v443Block3PaymentTracking({
  locationHref,
  documentReferrer,
  checkoutContext = {},
  clickContext = {},
  lastTouch = {},
  imwebSession = {},
}) {
  const versionedCheckoutContext =
    trim(checkoutContext.googleClickIdGuardVersion) === GUARD_VERSION
      ? checkoutContext
      : {};
  const legacyCheckoutContext =
    trim(checkoutContext.googleClickIdGuardVersion) === GUARD_VERSION
      ? {}
      : checkoutContext;

  const selectedGoogleClickSet = selectGoogleClickSet([
    googleClickSetFromUrl(locationHref, 'current_url'),
    googleClickSetFrom(versionedCheckoutContext, 'checkout_context_v4_4_3'),
    googleClickSetFromUrl(documentReferrer, 'document_referrer'),
    googleClickSetFrom(clickContext, 'header_click_context'),
    googleClickSetFrom(lastTouch, 'last_touch'),
    googleClickSetFrom(
      {
        gclid: imwebSession.gclid,
        gbraid: imwebSession.gbraid,
        wbraid: imwebSession.wbraid,
      },
      'imweb_session',
    ),
    googleClickSetFrom(legacyCheckoutContext, 'legacy_checkout_context'),
  ]);

  return {
    gclid: selectedGoogleClickSet.gclid,
    gbraid: selectedGoogleClickSet.gbraid,
    wbraid: selectedGoogleClickSet.wbraid,
    googleClickIdSource: selectedGoogleClickSet.source,
    googleClickIdGuardVersion: GUARD_VERSION,
  };
}

function summarize(result) {
  return {
    has_gclid: Boolean(result.gclid),
    has_gbraid: Boolean(result.gbraid),
    has_wbraid: Boolean(result.wbraid),
    source: result.googleClickIdSource || result.google_click_id_source || '',
  };
}

const FRESH_URL =
  'https://biocom.kr/mineraltest_store/?idx=6&gclid=fresh_gclid&gbraid=fresh_gbraid&gad_campaignid=21808018766';
const CHECKOUT_URL =
  'https://biocom.kr/shop_payment/?order_code=o_test&order_no=202605210000000';
const PAYMENT_SUCCESS_URL =
  'https://biocom.kr/shop_payment_complete?order_code=o_test&payment_code=pa_test&order_no=202605210000000&rk=S';
const STALE_WBRAID = 'test_wbraid_20260514';

const cases = [
  {
    name: 'header bootstrap: fresh gclid+gbraid must not inherit stale wbraid',
    run() {
      const previous = { wbraid: STALE_WBRAID, utm_source: 'old_google' };
      const incoming = { gclid: 'fresh_gclid', gbraid: 'fresh_gbraid', utm_source: 'google' };
      const legacy = legacyMergeTouch(previous, incoming);
      const actual = v443MergeTouch(previous, incoming);

      assert.equal(legacy.wbraid, STALE_WBRAID, 'control should show current v4.4.2-style stale merge');
      assert.deepEqual(summarize(actual), {
        has_gclid: true,
        has_gbraid: true,
        has_wbraid: false,
        source: 'incoming',
      });
    },
  },
  {
    name: 'footer block1: last/session touch must use one Google click-id set',
    run() {
      const previous = { gclid: 'old_gclid', wbraid: STALE_WBRAID, utm_campaign: 'old' };
      const incoming = { gclid: 'fresh_gclid', gbraid: 'fresh_gbraid', utm_campaign: 'fresh' };
      const legacy = legacyMergeTouch(previous, incoming);
      const actual = v443MergeTouch(previous, incoming);

      assert.equal(legacy.wbraid, STALE_WBRAID, 'control should show stale wbraid carry-over');
      assert.equal(actual.gclid, 'fresh_gclid');
      assert.equal(actual.gbraid, 'fresh_gbraid');
      assert.equal(actual.wbraid, '');
      assert.equal(actual.google_click_id_source, 'incoming');
    },
  },
  {
    name: 'checkout context: document referrer fresh click should outrank polluted storage',
    run() {
      const pollutedClickContext = {
        gclid: 'fresh_gclid',
        gbraid: 'fresh_gbraid',
        wbraid: STALE_WBRAID,
      };
      const legacy = legacyBlock2CheckoutTracking({
        locationHref: CHECKOUT_URL,
        clickContext: pollutedClickContext,
      });
      const actual = v443Block2CheckoutTracking({
        locationHref: CHECKOUT_URL,
        documentReferrer: FRESH_URL,
        clickContext: pollutedClickContext,
      });

      assert.equal(legacy.wbraid, STALE_WBRAID, 'control should show Block 2 polluted storage merge');
      assert.deepEqual(summarize(actual), {
        has_gclid: true,
        has_gbraid: true,
        has_wbraid: false,
        source: 'document_referrer',
      });
    },
  },
  {
    name: 'payment success: v4.4.3 checkout context must block stale fallback',
    run() {
      const cleanCheckoutContext = {
        gclid: 'fresh_gclid',
        gbraid: 'fresh_gbraid',
        wbraid: '',
        googleClickIdGuardVersion: GUARD_VERSION,
      };
      const pollutedClickContext = { wbraid: STALE_WBRAID };
      const legacy = legacyBlock3PaymentTracking({
        locationHref: PAYMENT_SUCCESS_URL,
        checkoutContext: cleanCheckoutContext,
        clickContext: pollutedClickContext,
      });
      const actual = v443Block3PaymentTracking({
        locationHref: PAYMENT_SUCCESS_URL,
        checkoutContext: cleanCheckoutContext,
        clickContext: pollutedClickContext,
      });

      assert.equal(legacy.wbraid, STALE_WBRAID, 'control should show Block 3 stale fallback');
      assert.deepEqual(summarize(actual), {
        has_gclid: true,
        has_gbraid: true,
        has_wbraid: false,
        source: 'checkout_context_v4_4_3',
      });
    },
  },
  {
    name: 'real wbraid-only Google click must be preserved',
    run() {
      const actual = v443Block2CheckoutTracking({
        locationHref: CHECKOUT_URL,
        documentReferrer: 'https://biocom.kr/mineraltest_store/?idx=6&wbraid=real_wbraid',
        clickContext: { gclid: 'old_gclid' },
      });

      assert.equal(actual.gclid, '');
      assert.equal(actual.gbraid, '');
      assert.equal(actual.wbraid, 'real_wbraid');
      assert.equal(actual.googleClickIdSource, 'document_referrer');
    },
  },
  {
    name: 'legacy checkout context remains fallback only when no fresher source exists',
    run() {
      const actual = v443Block3PaymentTracking({
        locationHref: PAYMENT_SUCCESS_URL,
        checkoutContext: { wbraid: 'legacy_wbraid' },
        clickContext: {},
        lastTouch: {},
      });

      assert.equal(actual.gclid, '');
      assert.equal(actual.gbraid, '');
      assert.equal(actual.wbraid, 'legacy_wbraid');
      assert.equal(actual.googleClickIdSource, 'legacy_checkout_context');
    },
  },
  {
    name: 'fbclid and ttclid behavior stays independent from Google guard',
    run() {
      const previous = { fbclid: 'old_fbclid', ttclid: 'old_ttclid', wbraid: STALE_WBRAID };
      const incoming = { gclid: 'fresh_gclid', fbclid: 'fresh_fbclid' };
      const actual = v443MergeTouch(previous, incoming);

      assert.equal(actual.gclid, 'fresh_gclid');
      assert.equal(actual.wbraid, '');
      assert.equal(actual.fbclid, 'fresh_fbclid');
      assert.equal(actual.ttclid, 'old_ttclid');
    },
  },
];

let passed = 0;

for (const testCase of cases) {
  try {
    testCase.run();
    passed += 1;
    console.log(`PASS ${testCase.name}`);
  } catch (error) {
    console.error(`FAIL ${testCase.name}`);
    console.error(error);
    process.exitCode = 1;
  }
}

console.log(`\n${passed}/${cases.length} fixture cases passed`);
