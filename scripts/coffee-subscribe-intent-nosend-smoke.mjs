#!/usr/bin/env node

import fs from 'node:fs';
import playwright from '../backend/node_modules/playwright/index.js';

const { chromium } = playwright;
const snippet = fs.readFileSync('scripts/coffee-subscribe-intent-nosend-snippet.js', 'utf8');

const subscribeAttrs = [
  'data-bs-action="click"',
  'data-bs-content="purchase"',
  'data-bs-where="shop_view"',
  'data-bs-payment-button-type="imweb_payment"',
  'data-bs-prod-code="s20260430d101ee36ea35d"',
  'data-bs-prod-type="normal"',
  'data-bs-is-regularly-prod="true"',
].join(' ');

const cases = [
  {
    name: 'desktop subscription apply button emits one no-send preview',
    url: 'https://thecleancoffee.com/subscription/?idx=74&__seo_attribution_debug=1',
    html: `<main>총 상품금액(1개) 18,900원 <a id="target" class="btn buy bg-brand im-regularly _btn_regularly" ${subscribeAttrs} href="javascript:;">정기구독 신청</a></main>`,
    clicks: 1,
    expect: { emittedCount: 1, value: 18900, valueStatus: 'present', selector: 'main text:총 상품금액', textClass: 'subscribe_apply' },
  },
  {
    name: 'mobile subscription button emits no-send preview',
    url: 'https://thecleancoffee.com/subscription/?idx=74&__seo_attribution_debug=1',
    html: `<main>총 상품금액(1개) 18,900원 <a id="target" class="btn opt buy bg-brand im-regularly _buy_regularly" ${subscribeAttrs} href="javascript:;">정기구독</a></main>`,
    clicks: 1,
    expect: { emittedCount: 1, value: 18900, valueStatus: 'present', selector: 'main text:총 상품금액', textClass: 'subscribe_cta' },
  },
  {
    name: 'option dropdown does not emit preview',
    url: 'https://thecleancoffee.com/subscription/?idx=74&__seo_attribution_debug=1',
    html: '<main>총 상품금액(1개) 18,900원 <button id="target" class="dropdown-toggle">중량 (필수)</button></main>',
    clicks: 1,
    expect: { emittedCount: 0 },
  },
  {
    name: 'normal buy button does not emit preview',
    url: 'https://thecleancoffee.com/subscription/?idx=74&__seo_attribution_debug=1',
    html: '<main>총 상품금액(1개) 18,900원 <a id="target" class="btn buy bg-brand _btn_buy" data-bs-content="purchase" data-bs-payment-button-type="imweb_payment" data-bs-prod-code="s20260430d101ee36ea35d" data-bs-prod-type="normal" data-bs-is-regularly-prod="false" href="javascript:;">구매하기</a></main>',
    clicks: 1,
    expect: { emittedCount: 0 },
  },
  {
    name: 'regular subscription cart button does not emit preview',
    url: 'https://thecleancoffee.com/subscription/?idx=74&__seo_attribution_debug=1',
    html: '<main>총 상품금액(1개) 18,900원 <a id="target" class="btn cart im-regularly _btn_cart" data-bs-content="add_to_cart" data-bs-prod-code="s20260430d101ee36ea35d" data-bs-prod-type="normal" data-bs-is-regularly-prod="true" href="javascript:;">장바구니</a></main>',
    clicks: 1,
    expect: { emittedCount: 0 },
  },
  {
    name: 'mobile show-options button without purchase attrs does not emit preview',
    url: 'https://thecleancoffee.com/subscription/?idx=74&__seo_attribution_debug=1',
    html: '<main>총 상품금액(1개) 18,900원 <a id="target" class="btn defualt bg-brand border-none buy im-regularly _buy_regularly" href="javascript:;">정기구독</a></main>',
    clicks: 1,
    expect: { emittedCount: 0 },
  },
  {
    name: 'same button double click is deduped within short window',
    url: 'https://thecleancoffee.com/subscription/?idx=74&__seo_attribution_debug=1',
    html: `<main>총 상품금액(1개) 18,900원 <a id="target" class="btn buy bg-brand im-regularly _btn_regularly" ${subscribeAttrs} href="javascript:;">정기구독 신청</a></main>`,
    clicks: 2,
    expect: { emittedCount: 1, value: 18900, valueStatus: 'present' },
  },
  {
    name: 'non subscription path does not emit preview',
    url: 'https://thecleancoffee.com/thecleancoffee/?idx=75&__seo_attribution_debug=1',
    html: `<main>총 상품금액(1개) 33,900원 <a id="target" class="btn buy bg-brand im-regularly _btn_regularly" ${subscribeAttrs} href="javascript:;">정기구독 신청</a></main>`,
    clicks: 1,
    expect: { emittedCount: 0 },
  },
  {
    name: 'missing value still emits no-send preview with missing status',
    url: 'https://thecleancoffee.com/subscription/?idx=74&__seo_attribution_debug=1',
    html: `<main><a id="target" class="btn buy bg-brand im-regularly _btn_regularly" ${subscribeAttrs} href="javascript:;">정기구독 신청</a></main>`,
    clicks: 1,
    expect: { emittedCount: 1, value: null, valueStatus: 'missing', selector: '' },
  },
];

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

const browser = await chromium.launch({ headless: true });
let passed = 0;

try {
  for (const testCase of cases) {
    const context = await browser.newContext();
    const blockedRequests = [];
    let page;

    await context.route('**/*', async (route) => {
      const request = route.request();
      if (request.isNavigationRequest() && page && request.frame() === page.mainFrame()) {
        await route.fulfill({
          status: 200,
          contentType: 'text/html; charset=utf-8',
          body: `<!doctype html><html><head></head><body>${testCase.html}</body></html>`,
        });
        return;
      }
      blockedRequests.push(request.url());
      await route.abort('blockedbyclient');
    });

    page = await context.newPage();
    await page.goto(testCase.url, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      sessionStorage.setItem('__seo_funnel_session', 'coffee-session-hidden');
    });
    await page.addScriptTag({ content: snippet });

    for (let i = 0; i < testCase.clicks; i += 1) {
      await page.click('#target');
    }
    await page.waitForTimeout(100);

    const result = await page.evaluate(() => ({
      last: window.__THECLEANCOFFEE_SUBSCRIBE_INTENT_PREVIEW_LAST__ || null,
      history: window.__THECLEANCOFFEE_SUBSCRIBE_INTENT_PREVIEW_HISTORY__ || [],
      dataLayer: window.dataLayer || [],
      marker: window.__THECLEANCOFFEE_SUBSCRIBE_INTENT_NOSEND__ || '',
    }));

    assertEqual(result.history.length, testCase.expect.emittedCount, `${testCase.name} history count`);
    assertEqual(result.dataLayer.length, testCase.expect.emittedCount, `${testCase.name} dataLayer count`);

    if (testCase.expect.emittedCount > 0) {
      const preview = result.last;
      assertEqual(Boolean(preview), true, `${testCase.name} preview exists`);
      assertEqual(preview.event, 'coffee_subscribe_intent_preview', `${testCase.name} dataLayer event`);
      assertEqual(preview.eventName, 'SubscribeIntentPreview', `${testCase.name} eventName`);
      assertEqual(preview.noSend, true, `${testCase.name} noSend`);
      assertEqual(preview.noFbq, true, `${testCase.name} noFbq`);
      assertEqual(preview.noPixelRequest, true, `${testCase.name} noPixelRequest`);
      assertEqual(preview.noNetwork, true, `${testCase.name} noNetwork`);
      assertEqual(preview.customData.intent_type, 'subscription_application', `${testCase.name} intent_type`);
      assertEqual(preview.customData.currency, 'KRW', `${testCase.name} currency`);
      assertEqual(preview.customData.value, testCase.expect.value, `${testCase.name} value`);
      assertEqual(preview.customData.value_status, testCase.expect.valueStatus, `${testCase.name} valueStatus`);
      if (Object.hasOwn(testCase.expect, 'selector')) {
        assertEqual(preview.customData.value_selector, testCase.expect.selector, `${testCase.name} selector`);
      }
      if (testCase.expect.textClass) {
        assertEqual(preview.customData.button_text_class, testCase.expect.textClass, `${testCase.name} textClass`);
      }
      assertEqual(preview.customData.product_code_present, true, `${testCase.name} product_code_present`);
      assertEqual(preview.customData.product_code_hash.length, 8, `${testCase.name} product_code_hash length`);
      assertEqual(preview.customData.payment_button_type, 'imweb_payment', `${testCase.name} payment_button_type`);
      assertEqual(preview.customData.is_regularly_prod, true, `${testCase.name} is_regularly_prod`);

      const serialized = JSON.stringify(preview);
      for (const forbidden of ['s20260430d101ee36ea35d', 'coffee-session-hidden']) {
        if (serialized.includes(forbidden)) {
          throw new Error(`${testCase.name} raw value leaked: ${forbidden}`);
        }
      }
    }

    assertEqual(blockedRequests.length, 0, `${testCase.name} external requests`);
    console.log(`PASS ${testCase.name}`);
    passed += 1;
    await context.close();
  }
} finally {
  await browser.close();
}

console.log(`${passed}/${cases.length} subscribe intent no-send cases passed`);
