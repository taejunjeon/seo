// Unit test for variable 250 fallback logic.
// Simulates GTM's sandboxed JS execution by replacing {{HURDLERS - GA4 Transaction_id}} with a closure var.

function makeFallback({ dlvTransactionId, dataLayer, locationSearch }) {
  // Mock browser globals
  global.window = { dataLayer: dataLayer || [] };
  global.location = { search: locationSearch || '' };
  global.URLSearchParams = class {
    constructor(s) {
      this.map = new Map();
      (s || '').replace(/^\?/, '').split('&').forEach(kv => {
        const [k, v] = kv.split('=');
        if (k) this.map.set(k, decodeURIComponent(v || ''));
      });
    }
    get(k) { return this.map.get(k) || null; }
  };

  // Paste the GTM variable 250 code with {{HURDLERS - GA4 Transaction_id}} replaced by the mock
  const fn = () => {
    // Priority 1
    try {
      const dlv = dlvTransactionId;
      if (dlv && String(dlv).trim() !== '' && String(dlv) !== '(not set)') return String(dlv);
    } catch(e) {}
    // Priority 2
    try {
      const dl = global.window.dataLayer || [];
      for (let i = dl.length - 1; i >= 0; i--) {
        const ev = dl[i];
        if (ev && ev.ecommerce && ev.ecommerce.transaction_id) return String(ev.ecommerce.transaction_id);
      }
    } catch(e) {}
    // Priority 3
    try {
      const p = new global.URLSearchParams(global.location.search);
      const v = p.get('order_no') || p.get('orderNo') || p.get('order_id') || p.get('order_code') || p.get('orderCode');
      if (v) return String(v);
    } catch(e) {}
    return '';
  };
  return fn();
}

const cases = [
  { name: 'P1 정상 HURDLERS', inp: { dlvTransactionId: '202604120001', dataLayer: [], locationSearch: '' }, expect: '202604120001' },
  { name: 'P1 empty → P2 ecommerce', inp: { dlvTransactionId: '', dataLayer: [{event:'a'},{event:'purchase', ecommerce:{transaction_id:'EC_TX_42'}}], locationSearch: '' }, expect: 'EC_TX_42' },
  { name: 'P1/P2 empty → P3 URL order_no', inp: { dlvTransactionId: '', dataLayer: [], locationSearch: '?order_code=o1&payment_code=p1&order_no=202604205201003&rk=S' }, expect: '202604205201003' },
  { name: 'P3 orderNo camelCase', inp: { dlvTransactionId: undefined, dataLayer: [], locationSearch: '?orderNo=CAMEL_001' }, expect: 'CAMEL_001' },
  { name: 'P3 order_code fallback', inp: { dlvTransactionId: '', dataLayer: [], locationSearch: '?order_code=o20260420abc' }, expect: 'o20260420abc' },
  { name: 'HURDLERS "(not set)" treated as empty → P3', inp: { dlvTransactionId: '(not set)', dataLayer: [], locationSearch: '?order_no=RESCUED' }, expect: 'RESCUED' },
  { name: 'HURDLERS whitespace → P3', inp: { dlvTransactionId: '   ', dataLayer: [], locationSearch: '?order_no=RESCUED2' }, expect: 'RESCUED2' },
  { name: 'all empty → ""', inp: { dlvTransactionId: '', dataLayer: [], locationSearch: '' }, expect: '' },
  { name: 'dataLayer reverse (last wins)', inp: { dlvTransactionId: '', dataLayer: [{ecommerce:{transaction_id:'FIRST'}},{ecommerce:{transaction_id:'SECOND'}}], locationSearch: '' }, expect: 'SECOND' },
  { name: 'P1 priority beats P3', inp: { dlvTransactionId: 'HURD_WIN', dataLayer: [], locationSearch: '?order_no=SHOULD_NOT_USE' }, expect: 'HURD_WIN' },
];

let pass = 0, fail = 0;
for (const c of cases) {
  const actual = makeFallback(c.inp);
  const ok = actual === c.expect;
  console.log(`${ok ? '✅' : '❌'} ${c.name} → actual="${actual}" expect="${c.expect}"`);
  if (ok) pass++; else fail++;
}
console.log(`\n${pass}/${cases.length} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
