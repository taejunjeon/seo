#!/usr/bin/env node

import fs from 'node:fs';
import playwright from '../backend/node_modules/playwright/index.js';

const { chromium } = playwright;
const snippet = fs.readFileSync('scripts/coffee-meta-middle-funnel-browser-fallback-nosend-snippet.js', 'utf8');

const cases = [
  {
    name: 'checkout reads Korean order summary total before css selectors',
    url: 'https://thecleancoffee.com/shop_payment/?order_code=o_hidden&order_no=202605220001&order_member=m_hidden&__seo_attribution_debug=1',
    html: '<main><div id="oms-shop-payment"><div>주문 요약 상품가격 33,900원 배송비 무료 총 주문금액 33,900원 339 포인트 적립예정</div></div></main>',
    storage: {
      checkout: { checkoutId: 'chk_hidden_0', clientId: 'cid-hidden', gaSessionId: 'sid-hidden' },
      click: { gclid: 'gclid-hidden', gbraid: 'gbraid-hidden', gad_campaignid: '14629255429', google_click_id_source: 'current_url' },
    },
    expect: { emitted: true, eventName: 'InitiateCheckout', value: 33900, valueStatus: 'present', selector: '#oms-shop-payment text:총 주문금액' },
  },
  {
    name: 'checkout emits no-send preview once with value',
    url: 'https://thecleancoffee.com/shop_payment/?order_code=o_hidden&order_no=202605220001&order_member=m_hidden&__seo_attribution_debug=1',
    html: '<main><div class="_payment_total_price">총 결제금액 33,900원</div></main>',
    storage: {
      checkout: { checkoutId: 'chk_hidden_1', clientId: 'cid-hidden', gaSessionId: 'sid-hidden' },
      click: { gclid: 'gclid-hidden', gbraid: 'gbraid-hidden', gad_campaignid: '14629255429', google_click_id_source: 'current_url' },
    },
    expect: { emitted: true, eventName: 'InitiateCheckout', value: 33900, valueStatus: 'present', selector: '._payment_total_price' },
  },
  {
    name: 'checkout missing value still emits preview with missing status',
    url: 'https://thecleancoffee.com/shop_payment/?order_no=202605220002&__seo_attribution_debug=1',
    html: '<main><div class="empty-total"></div></main>',
    storage: {
      checkout: { checkoutId: 'chk_hidden_2' },
      click: {},
    },
    expect: { emitted: true, eventName: 'InitiateCheckout', value: null, valueStatus: 'missing' },
  },
  {
    name: 'product page does not emit preview',
    url: 'https://thecleancoffee.com/thecleancoffee/?idx=75&__seo_attribution_debug=1',
    html: '<main><div class="_payment_total_price">33,900원</div></main>',
    storage: { checkout: {}, click: {} },
    expect: { emitted: false },
  },
  {
    name: 'payment complete page does not emit preview',
    url: 'https://thecleancoffee.com/shop_payment_complete/?order_no=202605220003&__seo_attribution_debug=1',
    html: '<main><div class="_payment_total_price">33,900원</div></main>',
    storage: { checkout: { checkoutId: 'chk_hidden_3' }, click: {} },
    expect: { emitted: false },
  },
  {
    name: 'checkout without order hint does not emit preview',
    url: 'https://thecleancoffee.com/shop_payment/?__seo_attribution_debug=1',
    html: '<main><div class="_payment_total_price">33,900원</div></main>',
    storage: { checkout: {}, click: {} },
    expect: { emitted: false },
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
    await context.route('**/*', async (route) => {
      const request = route.request();
      if (request.isNavigationRequest() && request.frame() === page?.mainFrame()) {
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

    const page = await context.newPage();
    await page.goto(testCase.url, { waitUntil: 'domcontentloaded' });
    await page.evaluate(({ checkout, click }) => {
      sessionStorage.setItem('__seo_checkout_context', JSON.stringify(checkout || {}));
      sessionStorage.setItem('__thecleancoffee_click_id_context_v1', JSON.stringify(click || {}));
      localStorage.setItem('__thecleancoffee_click_id_context_v1', JSON.stringify(click || {}));
    }, testCase.storage);
    await page.addScriptTag({ content: snippet });
    await page.waitForTimeout(100);

    const result = await page.evaluate(() => ({
      preview: window.__THECLEANCOFFEE_META_MIDDLE_FUNNEL_PREVIEW_LAST__ || null,
      dataLayer: window.dataLayer || [],
      fbqType: typeof window.fbq,
    }));

    const preview = result.preview;
    assertEqual(Boolean(preview), testCase.expect.emitted, `${testCase.name} emitted`);
    if (preview) {
      assertEqual(preview.eventName, testCase.expect.eventName, `${testCase.name} eventName`);
      assertEqual(preview.noSend, true, `${testCase.name} noSend`);
      assertEqual(preview.noFbq, true, `${testCase.name} noFbq`);
      assertEqual(preview.noPixelRequest, true, `${testCase.name} noPixelRequest`);
      assertEqual(preview.customData.value, testCase.expect.value, `${testCase.name} value`);
      assertEqual(preview.customData.value_status, testCase.expect.valueStatus, `${testCase.name} valueStatus`);
      if (testCase.expect.selector) {
        assertEqual(preview.customData.value_selector, testCase.expect.selector, `${testCase.name} selector`);
      }
      const serialized = JSON.stringify(preview);
      for (const forbidden of ['o_hidden', 'm_hidden', 'gclid-hidden', 'gbraid-hidden', '202605220001']) {
        if (serialized.includes(forbidden)) {
          throw new Error(`${testCase.name} raw value leaked: ${forbidden}`);
        }
      }
      assertEqual(result.dataLayer.length, 1, `${testCase.name} dataLayer count`);
    } else {
      assertEqual(result.dataLayer.length, 0, `${testCase.name} dataLayer count`);
    }

    assertEqual(blockedRequests.length, 0, `${testCase.name} external requests`);
    console.log(`PASS ${testCase.name}`);
    passed += 1;
    await context.close();
  }
} finally {
  await browser.close();
}

console.log(`${passed}/${cases.length} no-send snippet cases passed`);
