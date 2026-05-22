#!/usr/bin/env node

import { chromium } from 'playwright';

const RUN_ID = '20260521_2334';
const TARGET_URL =
  `https://thecleancoffee.com/?utm_source=codex&utm_medium=meta_pixel_smoke&utm_campaign=coffee_meta_eventid_${RUN_ID}&fbclid=TEST_FBCLID_COFFEE_${RUN_ID}`;

const EVENT_PAYLOADS = [
  {
    eventName: 'ViewContent',
    payload: {
      content_ids: [`codex_viewcontent_${RUN_ID}`],
      content_type: 'product',
      value: 12345,
      currency: 'KRW',
    },
  },
  {
    eventName: 'AddToCart',
    payload: {
      content_ids: [`codex_addtocart_${RUN_ID}`],
      content_type: 'product',
      value: 12345,
      currency: 'KRW',
    },
  },
  {
    eventName: 'InitiateCheckout',
    payload: {
      content_ids: [`codex_checkout_${RUN_ID}`],
      content_type: 'product',
      value: 12345,
      currency: 'KRW',
    },
  },
  {
    eventName: 'AddPaymentInfo',
    payload: {
      content_ids: [`codex_paymentinfo_${RUN_ID}`],
      content_type: 'product',
      value: 12345,
      currency: 'KRW',
    },
  },
];

const BLOCKED_NON_META_HOST_FRAGMENTS = [
  'googletagmanager.com',
  'google-analytics.com',
  'googleadservices.com',
  'doubleclick.net',
  'wcs.naver.net',
  'rum.beusable.net',
  'storage.keepgrow.com',
];

function safeUrl(raw) {
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

function parsePixelRequest(rawUrl) {
  const url = safeUrl(rawUrl);
  if (!url) return { rawUrl };
  const params = url.searchParams;
  const decoded = {};
  for (const [key, value] of params.entries()) {
    if (
      key === 'id' ||
      key === 'ev' ||
      key === 'eid' ||
      key === 'dl' ||
      key === 'rl' ||
      key === 'cd[value]' ||
      key === 'cd[currency]' ||
      key === 'cd[content_ids]' ||
      key === 'cd[content_type]'
    ) {
      decoded[key] = value;
    }
  }
  return decoded;
}

function compactRequest(rawUrl) {
  const parsed = parsePixelRequest(rawUrl);
  return {
    event: parsed.ev || '',
    eventId: parsed.eid || '',
    pixelId: parsed.id || '',
    value: parsed['cd[value]'] || '',
    currency: parsed['cd[currency]'] || '',
    contentIds: parsed['cd[content_ids]'] || '',
    contentType: parsed['cd[content_type]'] || '',
    destination: parsed.dl || '',
  };
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1365, height: 900 },
  userAgent: 'CodexCoffeeMetaPixelEventIdSmoke/20260521 no-send',
});
const page = await context.newPage();

const pixelRequests = [];
const capiRequests = [];
const blockedRequests = [];
const consoleMessages = [];

page.on('console', (msg) => {
  const text = msg.text();
  if (/funnel-capi|thecleancoffee|fbq|server|eventid|event id|purchase/i.test(text)) {
    consoleMessages.push(text.slice(0, 800));
  }
});

await page.route('**/*', async (route) => {
  const request = route.request();
  const rawUrl = request.url();
  const url = safeUrl(rawUrl);
  if (!url) return route.continue();

  const isMetaPixelRequest =
    (url.hostname === 'www.facebook.com' || url.hostname === 'facebook.com') &&
    url.pathname === '/tr/';
  if (isMetaPixelRequest) {
    pixelRequests.push(rawUrl);
    return route.abort('blockedbyclient');
  }

  const isCapiRequest =
    url.hostname === 'att.ainativeos.net' &&
    url.pathname === '/api/meta/capi/track';
  if (isCapiRequest) {
    capiRequests.push({
      url: rawUrl,
      method: request.method(),
      postData: request.postData() || '',
    });
    return route.abort('blockedbyclient');
  }

  if (BLOCKED_NON_META_HOST_FRAGMENTS.some((fragment) => rawUrl.includes(fragment))) {
    blockedRequests.push({ url: rawUrl, type: request.resourceType() });
    return route.abort('blockedbyclient');
  }

  return route.continue();
});

let navigationStatus = null;
let navigationError = '';

try {
  const response = await page.goto(TARGET_URL, {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });
  navigationStatus = response ? response.status() : null;
} catch (error) {
  navigationError = error?.message || String(error);
}

await page.waitForTimeout(2500);

const wrapperStateBefore = await page.evaluate(() => ({
  hasFbq: typeof window.fbq === 'function',
  funnelInstalled: window.__FUNNEL_CAPI_INSTALLED || '',
  config: {
    enableServerCapi: Boolean(window.FUNNEL_CAPI_CONFIG && window.FUNNEL_CAPI_CONFIG.enableServerCapi),
    testEventCode: (window.FUNNEL_CAPI_CONFIG && window.FUNNEL_CAPI_CONFIG.testEventCode) || '',
    pixelId: (window.FUNNEL_CAPI_CONFIG && window.FUNNEL_CAPI_CONFIG.pixelId) || '',
  },
  fbqWrapped: Boolean(window.fbq && window.fbq.__FUNNEL_CAPI_V3_WRAPPED__),
}));

let syntheticDispatchError = '';
if (wrapperStateBefore.hasFbq) {
  try {
    await page.evaluate((events) => {
      for (const item of events) {
        window.fbq('track', item.eventName, item.payload);
      }
    }, EVENT_PAYLOADS);
  } catch (error) {
    syntheticDispatchError = error?.message || String(error);
  }
} else {
  syntheticDispatchError = 'window.fbq missing';
}

await page.waitForTimeout(3000);

const wrapperStateAfter = await page.evaluate(() => ({
  hasFbq: typeof window.fbq === 'function',
  funnelInstalled: window.__FUNNEL_CAPI_INSTALLED || '',
  fbqWrapped: Boolean(window.fbq && window.fbq.__FUNNEL_CAPI_V3_WRAPPED__),
  lastDiagnostic: window.__THECLEANCOFFEE_SERVER_PAYMENT_DECISION_LAST__ || null,
}));

await browser.close();

const compactPixelRequests = pixelRequests.map(compactRequest);
const requestedByEvent = {};
for (const request of compactPixelRequests) {
  const eventName = request.event || '(unknown)';
  if (!requestedByEvent[eventName]) requestedByEvent[eventName] = [];
  requestedByEvent[eventName].push(request);
}

const syntheticEventNames = EVENT_PAYLOADS.map((item) => item.eventName);
const syntheticResults = syntheticEventNames.map((eventName) => {
  const requests = requestedByEvent[eventName] || [];
  return {
    eventName,
    requestCount: requests.length,
    eventIds: [...new Set(requests.map((request) => request.eventId).filter(Boolean))],
    hasEventId: requests.some((request) => Boolean(request.eventId)),
    hasValue: requests.some((request) => request.value === '12345'),
    hasCurrency: requests.some((request) => request.currency === 'KRW'),
  };
});

const summary = {
  source: 'Playwright live page Meta Pixel no-send smoke; facebook.com/tr captured and aborted',
  generatedAt: new Date().toISOString(),
  site: 'thecleancoffee',
  runId: RUN_ID,
  targetUrl: TARGET_URL,
  navigationStatus,
  navigationError,
  noSendGuard: {
    facebookPixelRequestsCapturedAndAborted: pixelRequests.length,
    metaCapiRequestsCapturedAndAborted: capiRequests.length,
    nonMetaTrackingRequestsBlocked: blockedRequests.length,
    imwebSaveOrGtmPublish: false,
    checkoutOrPurchaseVisited: false,
  },
  wrapperStateBefore,
  wrapperStateAfter,
  syntheticDispatchError,
  syntheticResults,
  purchaseRequests: requestedByEvent.Purchase || [],
  capiRequests,
  consoleMessages,
};

console.log(JSON.stringify(summary, null, 2));
