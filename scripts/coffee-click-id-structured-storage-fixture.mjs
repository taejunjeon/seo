#!/usr/bin/env node

import assert from 'node:assert/strict';

const GUARD_VERSION = 'coffee-google-click-id-v1';

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
    gad_source: trim(source?.gad_source),
    gad_campaignid: trim(source?.gad_campaignid),
  };
}

function googleClickSetFromUrl(urlLike, sourceName) {
  try {
    const url = new URL(urlLike || '', 'https://thecleancoffee.com');
    return googleClickSetFrom(
      {
        gclid: url.searchParams.get('gclid'),
        gbraid: url.searchParams.get('gbraid'),
        wbraid: url.searchParams.get('wbraid'),
        gad_source: url.searchParams.get('gad_source'),
        gad_campaignid: url.searchParams.get('gad_campaignid'),
      },
      sourceName,
    );
  } catch {
    return googleClickSetFrom({}, sourceName);
  }
}

function hasGoogleClickId(set) {
  return Boolean(set?.gclid || set?.gbraid || set?.wbraid);
}

function hasGoogleCampaignHint(set) {
  return Boolean(set?.gad_source || set?.gad_campaignid);
}

function selectGoogleClickSet(candidates) {
  for (const candidate of candidates) {
    if (hasGoogleClickId(candidate)) return candidate;
    if (hasGoogleCampaignHint(candidate)) {
      return {
        ...candidate,
        source: `${candidate.source || 'unknown'}_no_click_id`,
        gclid: '',
        gbraid: '',
        wbraid: '',
      };
    }
  }
  return googleClickSetFrom({}, 'none');
}

function selectGoogleCampaignHint(candidates) {
  for (const candidate of candidates) {
    if (hasGoogleCampaignHint(candidate)) {
      return {
        gad_source: candidate.gad_source || '',
        gad_campaignid: candidate.gad_campaignid || '',
        source: candidate.source || '',
      };
    }
  }
  return { gad_source: '', gad_campaignid: '', source: '' };
}

function hasAnyIncomingGoogleMarker(source) {
  return Boolean(
    trim(source?.gclid) ||
      trim(source?.gbraid) ||
      trim(source?.wbraid) ||
      trim(source?.gad_source) ||
      trim(source?.gad_campaignid),
  );
}

function mergeTouch(previous, incoming, options = {}) {
  const preferIncomingForUtm = options.preferIncomingForUtm !== false;
  const incomingSet = googleClickSetFrom(incoming, 'incoming');
  const previousSet = googleClickSetFrom(previous, 'previous');
  const incomingHasGoogleMarker = hasAnyIncomingGoogleMarker(incoming);
  const selectedGoogleClickSet = incomingHasGoogleMarker
    ? (hasGoogleClickId(incomingSet) ? incomingSet : googleClickSetFrom(incoming, 'incoming_no_click_id'))
    : selectGoogleClickSet([previousSet]);
  const campaignHint = selectGoogleCampaignHint([incomingSet, previousSet]);

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
    gclid: selectedGoogleClickSet.gclid,
    gbraid: selectedGoogleClickSet.gbraid,
    wbraid: selectedGoogleClickSet.wbraid,
    gad_source: campaignHint.gad_source,
    gad_campaignid: campaignHint.gad_campaignid,
    google_click_id_source: selectedGoogleClickSet.source,
    google_click_id_guard_version: GUARD_VERSION,
    has_google_click_id: hasGoogleClickId(selectedGoogleClickSet),
    fbclid: firstNonEmpty([incoming.fbclid, previous.fbclid]),
    ttclid: firstNonEmpty([incoming.ttclid, previous.ttclid]),
  };
}

function checkoutTracking({
  locationHref,
  documentReferrer,
  clickContext = {},
  lastTouch = {},
  imwebSession = {},
}) {
  const candidates = [
    googleClickSetFromUrl(locationHref, 'current_url'),
    googleClickSetFromUrl(documentReferrer, 'document_referrer'),
    googleClickSetFrom(clickContext, 'coffee_click_context'),
    googleClickSetFrom(lastTouch, 'last_touch'),
    googleClickSetFrom(imwebSession, 'imweb_session'),
  ];
  const selectedGoogleClickSet = selectGoogleClickSet(candidates);
  const campaignHint = selectGoogleCampaignHint(candidates);

  return {
    gclid: selectedGoogleClickSet.gclid,
    gbraid: selectedGoogleClickSet.gbraid,
    wbraid: selectedGoogleClickSet.wbraid,
    gad_source: campaignHint.gad_source,
    gad_campaignid: campaignHint.gad_campaignid,
    google_click_id_source: selectedGoogleClickSet.source,
    google_click_id_guard_version: GUARD_VERSION,
    has_google_click_id: hasGoogleClickId(selectedGoogleClickSet),
    gad_campaignid_source: campaignHint.source,
  };
}

function paymentSuccessTracking({
  locationHref,
  documentReferrer,
  checkoutContext = {},
  clickContext = {},
  lastTouch = {},
  imwebSession = {},
}) {
  const isVersionedCheckout =
    trim(checkoutContext.google_click_id_guard_version || checkoutContext.googleClickIdGuardVersion) === GUARD_VERSION;
  const versionedCheckoutContext = isVersionedCheckout ? checkoutContext : {};
  const legacyCheckoutContext = isVersionedCheckout ? {} : checkoutContext;
  const candidates = [
    googleClickSetFromUrl(locationHref, 'current_url'),
    googleClickSetFrom(versionedCheckoutContext, 'checkout_context_coffee_v1'),
    googleClickSetFromUrl(documentReferrer, 'document_referrer'),
    googleClickSetFrom(clickContext, 'coffee_click_context'),
    googleClickSetFrom(lastTouch, 'last_touch'),
    googleClickSetFrom(imwebSession, 'imweb_session'),
    googleClickSetFrom(legacyCheckoutContext, 'legacy_checkout_context'),
  ];
  const selectedGoogleClickSet = selectGoogleClickSet(candidates);
  const campaignHint = selectGoogleCampaignHint(candidates);

  return {
    gclid: selectedGoogleClickSet.gclid,
    gbraid: selectedGoogleClickSet.gbraid,
    wbraid: selectedGoogleClickSet.wbraid,
    gad_source: campaignHint.gad_source,
    gad_campaignid: campaignHint.gad_campaignid,
    google_click_id_source: selectedGoogleClickSet.source,
    google_click_id_guard_version: GUARD_VERSION,
    has_google_click_id: hasGoogleClickId(selectedGoogleClickSet),
    gad_campaignid_source: campaignHint.source,
  };
}

function summarize(result) {
  return {
    has_gclid: Boolean(result.gclid),
    has_gbraid: Boolean(result.gbraid),
    has_wbraid: Boolean(result.wbraid),
    has_google_click_id: Boolean(result.has_google_click_id),
    gad_campaignid: result.gad_campaignid || '',
    source: result.google_click_id_source || '',
  };
}

const FRESH_URL =
  'https://thecleancoffee.com/?gclid=fresh_gclid&gbraid=fresh_gbraid&gad_source=1&gad_campaignid=14629255429';
const W_BRAID_ONLY_URL =
  'https://thecleancoffee.com/?wbraid=actual_wbraid&gad_source=1&gad_campaignid=14629255429';
const CAMPAIGN_ONLY_URL =
  'https://thecleancoffee.com/?gad_source=1&gad_campaignid=14629255429&utm_source=google&utm_medium=cpc';
const CHECKOUT_URL = 'https://thecleancoffee.com/shop_payment/?order_code=o_test';
const PAYMENT_SUCCESS_URL = 'https://thecleancoffee.com/shop_payment_complete?order_code=o_test&payment_code=pa_test';
const STALE_WBRAID = 'TEST_WBRAID_STALE_COFFEE_20260521';

const cases = [
  {
    name: 'touch merge: fresh gclid+gbraid must not inherit stale wbraid',
    run() {
      const previous = { wbraid: STALE_WBRAID, gad_campaignid: 'old_campaign', utm_source: 'old_google' };
      const incoming = {
        gclid: 'fresh_gclid',
        gbraid: 'fresh_gbraid',
        gad_source: '1',
        gad_campaignid: '14629255429',
        utm_source: 'google',
      };
      const actual = mergeTouch(previous, incoming);

      assert.deepEqual(summarize(actual), {
        has_gclid: true,
        has_gbraid: true,
        has_wbraid: false,
        has_google_click_id: true,
        gad_campaignid: '14629255429',
        source: 'incoming',
      });
    },
  },
  {
    name: 'touch merge: real wbraid-only Google click must be preserved',
    run() {
      const previous = { gclid: 'old_gclid' };
      const incoming = { wbraid: 'actual_wbraid', gad_campaignid: '14629255429' };
      const actual = mergeTouch(previous, incoming);

      assert.equal(actual.gclid, '');
      assert.equal(actual.gbraid, '');
      assert.equal(actual.wbraid, 'actual_wbraid');
      assert.equal(actual.has_google_click_id, true);
      assert.equal(actual.google_click_id_source, 'incoming');
    },
  },
  {
    name: 'touch merge: gad_campaignid-only must not reuse stale Google click id',
    run() {
      const previous = { gclid: 'old_gclid', wbraid: STALE_WBRAID };
      const incoming = { gad_source: '1', gad_campaignid: '14629255429', utm_source: 'google' };
      const actual = mergeTouch(previous, incoming);

      assert.equal(actual.gclid, '');
      assert.equal(actual.gbraid, '');
      assert.equal(actual.wbraid, '');
      assert.equal(actual.gad_campaignid, '14629255429');
      assert.equal(actual.has_google_click_id, false);
      assert.equal(actual.google_click_id_source, 'incoming_no_click_id');
    },
  },
  {
    name: 'checkout context: document referrer fresh click outranks polluted storage',
    run() {
      const actual = checkoutTracking({
        locationHref: CHECKOUT_URL,
        documentReferrer: FRESH_URL,
        clickContext: { gclid: 'fresh_gclid', gbraid: 'fresh_gbraid', wbraid: STALE_WBRAID },
        lastTouch: { wbraid: STALE_WBRAID },
      });

      assert.deepEqual(summarize(actual), {
        has_gclid: true,
        has_gbraid: true,
        has_wbraid: false,
        has_google_click_id: true,
        gad_campaignid: '14629255429',
        source: 'document_referrer',
      });
    },
  },
  {
    name: 'checkout context: wbraid-only referrer is preserved',
    run() {
      const actual = checkoutTracking({
        locationHref: CHECKOUT_URL,
        documentReferrer: W_BRAID_ONLY_URL,
        lastTouch: { gclid: 'old_gclid' },
      });

      assert.equal(actual.gclid, '');
      assert.equal(actual.gbraid, '');
      assert.equal(actual.wbraid, 'actual_wbraid');
      assert.equal(actual.has_google_click_id, true);
      assert.equal(actual.google_click_id_source, 'document_referrer');
    },
  },
  {
    name: 'checkout context: gad_campaignid-only is campaign hint, not click id',
    run() {
      const actual = checkoutTracking({
        locationHref: CAMPAIGN_ONLY_URL,
        documentReferrer: '',
        lastTouch: { wbraid: STALE_WBRAID },
      });

      assert.equal(actual.gclid, '');
      assert.equal(actual.gbraid, '');
      assert.equal(actual.wbraid, '');
      assert.equal(actual.gad_campaignid, '14629255429');
      assert.equal(actual.has_google_click_id, false);
      assert.equal(actual.google_click_id_source, 'current_url_no_click_id');
      assert.equal(actual.gad_campaignid_source, 'current_url');
    },
  },
  {
    name: 'payment success: versioned checkout context blocks stale fallback',
    run() {
      const cleanCheckoutContext = {
        gclid: 'fresh_gclid',
        gbraid: 'fresh_gbraid',
        wbraid: '',
        gad_campaignid: '14629255429',
        google_click_id_guard_version: GUARD_VERSION,
      };
      const actual = paymentSuccessTracking({
        locationHref: PAYMENT_SUCCESS_URL,
        checkoutContext: cleanCheckoutContext,
        clickContext: { wbraid: STALE_WBRAID },
        lastTouch: { wbraid: STALE_WBRAID },
      });

      assert.deepEqual(summarize(actual), {
        has_gclid: true,
        has_gbraid: true,
        has_wbraid: false,
        has_google_click_id: true,
        gad_campaignid: '14629255429',
        source: 'checkout_context_coffee_v1',
      });
    },
  },
  {
    name: 'payment success: legacy checkout context remains fallback only when no fresher source exists',
    run() {
      const actual = paymentSuccessTracking({
        locationHref: PAYMENT_SUCCESS_URL,
        documentReferrer: '',
        checkoutContext: { wbraid: 'legacy_wbraid' },
        clickContext: {},
        lastTouch: {},
      });

      assert.equal(actual.gclid, '');
      assert.equal(actual.gbraid, '');
      assert.equal(actual.wbraid, 'legacy_wbraid');
      assert.equal(actual.google_click_id_source, 'legacy_checkout_context');
    },
  },
  {
    name: 'fbclid and ttclid behavior stays independent from Google guard',
    run() {
      const actual = mergeTouch(
        { fbclid: 'old_fbclid', ttclid: 'old_ttclid', wbraid: STALE_WBRAID },
        { gclid: 'fresh_gclid', fbclid: 'fresh_fbclid' },
      );

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
