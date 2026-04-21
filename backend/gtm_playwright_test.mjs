import { JWT } from 'google-auth-library';
import dotenv from 'dotenv';
dotenv.config();

// Grab full auth code
const sa = JSON.parse(process.env.GA4_BIOCOM_SERVICE_ACCOUNT_KEY);
const client = new JWT({
  email: sa.client_email, key: sa.private_key,
  scopes: ['https://www.googleapis.com/auth/tagmanager.readonly']
});
const { token } = await client.getAccessToken();
let r = await fetch('https://tagmanager.googleapis.com/tagmanager/v2/accounts/4703003246/containers/13158774/environments', {
  headers: { Authorization: `Bearer ${token}` }
});
const envs = (await r.json()).environment || [];
const wsEnv = envs.find(e => e.workspaceId === '145');
if (!wsEnv) { console.error('no ws env'); process.exit(1); }
console.log('env[5] authCode (full):', wsEnv.authorizationCode);
console.log('environmentId:', wsEnv.environmentId);

// Use frontend's playwright
const { chromium } = await import('/Users/vibetj/coding/seo/frontend/node_modules/playwright/index.mjs');

const previewUrl = `https://biocom.kr/?gtm_auth=${wsEnv.authorizationCode}&gtm_preview=env-${wsEnv.environmentId}&gtm_debug=x&order_no=TEST_PLAYWRIGHT_12345&order_code=o_test_abc&payment_code=p_test_xyz`;
console.log('\npreviewUrl length:', previewUrl.length);

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();

page.on('console', msg => {
  const t = msg.text();
  if (/gtm|tag|dataLayer|transaction|preview/i.test(t)) console.log('[console]', t.substring(0, 200));
});

console.log('\n=== Loading biocom.kr with workspace 145 preview params ===');
try {
  await page.goto(previewUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
} catch (e) {
  console.log('goto error:', e.message);
}

// Wait a bit for GTM to load
await page.waitForTimeout(3000);

const gtmStatus = await page.evaluate(() => {
  const gtm = window.google_tag_manager;
  const result = {
    gtmLoaded: !!gtm,
    containers: gtm ? Object.keys(gtm) : [],
    dataLayerLen: (window.dataLayer || []).length,
    url: location.href
  };
  if (gtm && gtm['GTM-W2Z6PHN']) {
    const c = gtm['GTM-W2Z6PHN'];
    result.W2Z6PHN_keys = Object.keys(c).slice(0, 20);
    try {
      result.dataLayerGet_gtm_preview = c.dataLayer?.get?.('gtm.uniqueEventId');
    } catch(e) { result.getError = e.message; }
  }
  return result;
});
console.log('\n=== GTM status ===');
console.log(JSON.stringify(gtmStatus, null, 2));

const urlParams = await page.evaluate(() => {
  const p = new URLSearchParams(location.search);
  return {
    order_no: p.get('order_no'),
    order_code: p.get('order_code'),
    gtm_preview: p.get('gtm_preview'),
    gtm_auth_present: !!p.get('gtm_auth')
  };
});
console.log('\n=== URL params on page ===');
console.log(JSON.stringify(urlParams, null, 2));

// Evaluate the fallback logic directly in page context
const fallbackResult = await page.evaluate(() => {
  function run() {
    // P1: look for hurdlers_ga4.transaction_id in dataLayer events (nested)
    try {
      const dl = window.dataLayer || [];
      for (let i = dl.length - 1; i >= 0; i--) {
        const ev = dl[i];
        if (ev && ev.hurdlers_ga4 && ev.hurdlers_ga4.transaction_id) {
          const v = ev.hurdlers_ga4.transaction_id;
          if (v && String(v).trim() !== '' && String(v) !== '(not set)') return { source: 'P1_HURDLERS_DL', value: String(v) };
        }
      }
    } catch(e) {}
    // P2: ecommerce.transaction_id
    try {
      const dl = window.dataLayer || [];
      for (let i = dl.length - 1; i >= 0; i--) {
        const ev = dl[i];
        if (ev && ev.ecommerce && ev.ecommerce.transaction_id) return { source: 'P2_ECOMMERCE_DL', value: String(ev.ecommerce.transaction_id) };
      }
    } catch(e) {}
    // P3: URL
    try {
      const p = new URLSearchParams(location.search);
      const v = p.get('order_no') || p.get('orderNo') || p.get('order_id') || p.get('order_code') || p.get('orderCode');
      if (v) return { source: 'P3_URL', value: String(v) };
    } catch(e) {}
    return { source: 'none', value: '' };
  }
  return run();
});
console.log('\n=== Fallback logic evaluation on real biocom.kr page ===');
console.log(JSON.stringify(fallbackResult, null, 2));

await page.screenshot({ path: '/tmp/biocom_preview.png', fullPage: false });
console.log('\nscreenshot: /tmp/biocom_preview.png');

await browser.close();
console.log('\ndone.');
