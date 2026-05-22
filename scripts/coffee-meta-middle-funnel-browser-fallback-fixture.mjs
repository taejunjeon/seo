#!/usr/bin/env node

import crypto from 'node:crypto';

const CHECKOUT_CONTEXT_KEY = '__seo_checkout_context';
const CLICK_CONTEXT_KEY = '__thecleancoffee_click_id_context_v1';
const DEDUPE_PREFIX = '__coffee_meta_middle_preview_sent__:';

function stableHash(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex').slice(0, 16);
}

function trim(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function safeUrl(raw) {
  return new URL(raw, 'https://thecleancoffee.com');
}

function safeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function firstNonEmpty(values) {
  for (const value of values) {
    const normalized = trim(value);
    if (normalized) return normalized;
  }
  return '';
}

function isCheckoutPage(urlLike) {
  const url = safeUrl(urlLike);
  const href = `${url.pathname} ${url.href}`.toLowerCase();
  if (/shop_payment_complete|shop_order_done|order_complete|payment_complete/.test(href)) {
    return false;
  }
  return /shop_payment|shop_order|order_form|checkout/.test(href);
}

function readOrderHints(urlLike, checkoutContext) {
  const url = safeUrl(urlLike);
  const params = url.searchParams;
  const context = safeObject(checkoutContext);
  return {
    orderCode: firstNonEmpty([params.get('order_code'), params.get('orderCode'), context.orderCode]),
    orderNo: firstNonEmpty([params.get('order_no'), params.get('orderNo'), context.orderNo]),
    orderMember: firstNonEmpty([params.get('order_member'), params.get('orderMember'), context.orderMember]),
    checkoutId: firstNonEmpty([context.checkoutId, params.get('checkoutId'), params.get('checkout_id')]),
  };
}

function hasOrderHint(hints) {
  return Boolean(hints.orderCode || hints.orderNo || hints.checkoutId);
}

function buildDedupeKey(hints, urlLike) {
  const basis = firstNonEmpty([
    hints.checkoutId,
    hints.orderCode,
    hints.orderNo,
    safeUrl(urlLike).pathname,
  ]);
  return `${DEDUPE_PREFIX}${stableHash(basis)}`;
}

function readValue(candidateTextValues) {
  for (const raw of candidateTextValues || []) {
    const normalized = trim(raw).replace(/[^0-9.]/g, '');
    if (!normalized) continue;
    const value = Number(normalized);
    if (Number.isFinite(value) && value > 0) {
      return { value, valueStatus: 'present' };
    }
  }
  return { value: null, valueStatus: 'missing' };
}

function buildPreviewPayload(input) {
  const url = safeUrl(input.url);
  const checkoutContext = safeObject(input.storage?.[CHECKOUT_CONTEXT_KEY]);
  const clickContext = safeObject(input.storage?.[CLICK_CONTEXT_KEY]);
  const hints = readOrderHints(url.href, checkoutContext);

  if (!isCheckoutPage(url.href)) {
    return { shouldPreview: false, blockReason: 'not_checkout_page' };
  }
  if (!hasOrderHint(hints)) {
    return { shouldPreview: false, blockReason: 'missing_order_hint' };
  }

  const dedupeKey = buildDedupeKey(hints, url.href);
  if (input.session?.[dedupeKey]) {
    return { shouldPreview: false, blockReason: 'deduped', dedupeKey };
  }

  const valueResult = readValue(input.valueTextCandidates);
  const checkoutId = firstNonEmpty([hints.checkoutId, `chk_${stableHash(url.pathname + url.search)}`]);
  const eventID = `InitiateCheckout.${stableHash(checkoutId)}`;

  return {
    shouldPreview: true,
    eventName: 'InitiateCheckout',
    eventID,
    dedupeKey,
    action: 'debug_only_no_fbq_no_pixel_send',
    customData: {
      currency: 'KRW',
      value: valueResult.value,
      value_status: valueResult.valueStatus,
      checkout_id_present: Boolean(hints.checkoutId),
      order_code_present: Boolean(hints.orderCode),
      order_no_present: Boolean(hints.orderNo),
      order_member_present: Boolean(hints.orderMember),
      gclid_present: Boolean(clickContext.gclid),
      gbraid_present: Boolean(clickContext.gbraid),
      wbraid_present: Boolean(clickContext.wbraid),
      gad_campaignid_present: Boolean(clickContext.gad_campaignid),
      google_click_id_source: clickContext.google_click_id_source || '',
      snippet_version: '2026-05-22-coffee-meta-middle-funnel-preview-v0',
    },
    forbiddenRawOutput: {
      orderCode: '',
      orderNo: '',
      orderMember: '',
      gclid: '',
      gbraid: '',
      wbraid: '',
      gadCampaignId: '',
    },
  };
}

const cases = [
  {
    name: 'checkout page creates InitiateCheckout preview with click-id presence only',
    input: {
      url: 'https://thecleancoffee.com/shop_payment/?order_code=o_real_hidden&order_no=123456&order_member=m_hidden',
      storage: {
        [CHECKOUT_CONTEXT_KEY]: { checkoutId: 'chk_abc123', clientId: 'client-hidden' },
        [CLICK_CONTEXT_KEY]: {
          gclid: 'raw-gclid-hidden',
          gbraid: 'raw-gbraid-hidden',
          gad_campaignid: '14629255429',
          google_click_id_source: 'current_url',
        },
      },
      session: {},
      valueTextCandidates: ['총 결제금액 33,900원'],
    },
    expect: { shouldPreview: true, eventName: 'InitiateCheckout', value: 33900, rawOutputEmpty: true },
  },
  {
    name: 'product page is blocked',
    input: {
      url: 'https://thecleancoffee.com/thecleancoffee/?idx=75',
      storage: {},
      session: {},
      valueTextCandidates: ['33,900원'],
    },
    expect: { shouldPreview: false, blockReason: 'not_checkout_page' },
  },
  {
    name: 'payment complete page is blocked',
    input: {
      url: 'https://thecleancoffee.com/shop_payment_complete/?order_no=123456',
      storage: {},
      session: {},
      valueTextCandidates: ['33,900원'],
    },
    expect: { shouldPreview: false, blockReason: 'not_checkout_page' },
  },
  {
    name: 'checkout without order hint is blocked',
    input: {
      url: 'https://thecleancoffee.com/shop_payment/',
      storage: {},
      session: {},
      valueTextCandidates: ['33,900원'],
    },
    expect: { shouldPreview: false, blockReason: 'missing_order_hint' },
  },
  {
    name: 'missing value stays preview only with value_status missing',
    input: {
      url: 'https://thecleancoffee.com/shop_payment/?order_no=123456',
      storage: {
        [CHECKOUT_CONTEXT_KEY]: { checkoutId: 'chk_missing_value' },
        [CLICK_CONTEXT_KEY]: {},
      },
      session: {},
      valueTextCandidates: [''],
    },
    expect: { shouldPreview: true, eventName: 'InitiateCheckout', value: null, valueStatus: 'missing' },
  },
];

let pass = 0;
for (const testCase of cases) {
  const result = buildPreviewPayload(testCase.input);
  const expected = testCase.expect;
  const failures = [];

  for (const [key, value] of Object.entries(expected)) {
    if (key === 'value') {
      if (result.customData?.value !== value) failures.push(`${key}: expected ${value}, got ${result.customData?.value}`);
    } else if (key === 'valueStatus') {
      if (result.customData?.value_status !== value) failures.push(`${key}: expected ${value}, got ${result.customData?.value_status}`);
    } else if (key === 'rawOutputEmpty') {
      const allEmpty = Object.values(result.forbiddenRawOutput || {}).every((item) => item === '');
      if (allEmpty !== value) failures.push(`${key}: expected ${value}, got ${allEmpty}`);
    } else if (result[key] !== value) {
      failures.push(`${key}: expected ${value}, got ${result[key]}`);
    }
  }

  if (result.shouldPreview) {
    const forbiddenSerialized = JSON.stringify(result);
    for (const raw of ['o_real_hidden', 'raw-gclid-hidden', 'raw-gbraid-hidden', 'm_hidden']) {
      if (forbiddenSerialized.includes(raw)) failures.push(`raw leaked: ${raw}`);
    }
  }

  if (failures.length) {
    console.error(`FAIL ${testCase.name}`);
    for (const failure of failures) console.error(`  - ${failure}`);
    process.exitCode = 1;
  } else {
    pass += 1;
    console.log(`PASS ${testCase.name}`);
  }
}

console.log(`${pass}/${cases.length} cases passed`);
