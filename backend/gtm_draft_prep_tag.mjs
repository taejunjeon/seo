import { JWT } from 'google-auth-library';
import dotenv from 'dotenv';
dotenv.config();

const sa = JSON.parse(process.env.GA4_BIOCOM_SERVICE_ACCOUNT_KEY);
const client = new JWT({
  email: sa.client_email, key: sa.private_key,
  scopes: ['https://www.googleapis.com/auth/tagmanager.edit.containers']
});
const { token } = await client.getAccessToken();
const H = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
const BASE = 'https://tagmanager.googleapis.com/tagmanager/v2/';
const wsPath = 'accounts/4703003246/containers/13158774/workspaces/146';

const NEW_TAG_NAME = 'biocom - [데이터 준비] hurdlers_ga4 purchase 값 주입 (Claude)';

// Custom HTML body
// - event 키 없는 dataLayer.push (GTM 이벤트 유발 금지)
// - Guard chain: URL path / order_no / rk=S / allow_purchase 플래그
// - Idempotency guard via sessionStorage
const HTML = `<script>
(function(){
  try {
    // ========== Guard 1: 결제완료 URL 이어야 함 ==========
    var path = (location.pathname || '');
    if (path.indexOf('shop_payment_complete') === -1) {
      return; // 결제완료 페이지 아님 → 발사하지 않음
    }

    var params;
    try { params = new URLSearchParams(location.search); } catch (e) { return; }

    var orderNo = params.get('order_no') || params.get('orderNo') || params.get('order_id');
    if (!orderNo) return; // 주문번호 없으면 조기 종료

    // ========== Guard 2: URL rk 파라미터로 결제 성공 상태 확인 ==========
    // rk='S' = PG 결제완료 마커. 없거나 'F' 이면 가상계좌 미입금/실패로 간주
    var rk = params.get('rk');
    if (rk && rk !== 'S') return;

    // ========== Guard 3: payment-decision 플래그 ==========
    // header_purchase_guard 가 window.__seo_allow_purchase = false 로 명시 차단한 경우 skip
    try {
      if (window.__seo_allow_purchase === false) return;
    } catch (e) {}

    // ========== Idempotency (같은 order 에 반복 실행 방지) ==========
    var guardKey = '__seo_hurdlers_ga4_prepared__:' + orderNo;
    try {
      if (window.sessionStorage && sessionStorage.getItem(guardKey) === '1') return;
    } catch (e) {}

    // ========== Value 추출 (dataLayer 역순 탐색) ==========
    var value = 0, valueSource = 'default_0';
    try {
      var dl = window.dataLayer || [];
      for (var i = dl.length - 1; i >= 0; i--) {
        var ev = dl[i];
        // 우선순위 1: eventModel.value (dlv_price_vlaue 변수가 읽는 경로)
        if (ev && ev.eventModel && typeof ev.eventModel.value !== 'undefined' && ev.eventModel.value !== null) {
          value = parseInt(ev.eventModel.value, 10) || 0;
          valueSource = 'eventModel';
          if (value > 0) break;
        }
        // 우선순위 2: ecommerce.value
        if (ev && ev.ecommerce && typeof ev.ecommerce.value !== 'undefined' && ev.ecommerce.value !== null) {
          value = parseInt(ev.ecommerce.value, 10) || 0;
          valueSource = 'ecommerce';
          if (value > 0) break;
        }
        // 우선순위 3: hurdlers_ga4.value (이미 채워진 경우)
        if (ev && ev.hurdlers_ga4 && typeof ev.hurdlers_ga4.value !== 'undefined' && ev.hurdlers_ga4.value !== null) {
          var v3 = parseInt(ev.hurdlers_ga4.value, 10);
          if (!isNaN(v3) && v3 > 0) { value = v3; valueSource = 'hurdlers_existing'; break; }
        }
      }
    } catch (e) {}

    // ========== Items 추출 ==========
    var items = [], itemsSource = 'default_empty';
    try {
      var dl2 = window.dataLayer || [];
      for (var k = dl2.length - 1; k >= 0; k--) {
        var ev2 = dl2[k];
        if (ev2 && ev2.hurdlers_ga4 && Array.isArray(ev2.hurdlers_ga4.items) && ev2.hurdlers_ga4.items.length > 0) {
          items = ev2.hurdlers_ga4.items;
          itemsSource = 'hurdlers_existing';
          break;
        }
        if (ev2 && ev2.ecommerce && Array.isArray(ev2.ecommerce.items) && ev2.ecommerce.items.length > 0) {
          items = ev2.ecommerce.items;
          itemsSource = 'ecommerce';
          break;
        }
      }
    } catch (e) {}

    // ========== dataLayer push (event 키 없음 — GTM 이벤트 유발 금지) ==========
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      hurdlers_ga4: {
        transaction_id: String(orderNo),
        value: value,
        items: items,
        shipping: 0,
        currency: 'KRW'
      },
      _seo_hurdlers_ga4_prep: {
        order_no: String(orderNo),
        rk: rk || null,
        value: value,
        value_source: valueSource,
        items_count: items.length,
        items_source: itemsSource,
        ts: new Date().toISOString(),
        note: 'prep only, no gtm event key'
      }
    });

    try {
      if (window.sessionStorage) sessionStorage.setItem(guardKey, '1');
    } catch (e) {}

    try {
      if (window.console && window.console.log) {
        console.log('[seo-hurdlers-prep] order_no=' + orderNo + ' value=' + value + ' items=' + items.length + ' source=' + valueSource + '/' + itemsSource);
      }
    } catch (e) {}
  } catch (err) {
    try { if (window.console) console.log('[seo-hurdlers-prep] error', err); } catch(e){}
  }
})();
</script>`;

const newTagBody = {
  name: NEW_TAG_NAME,
  type: 'html',
  parameter: [
    { type: 'template', key: 'html', value: HTML },
    { type: 'boolean', key: 'supportDocumentWrite', value: 'false' }
  ],
  firingTriggerId: [],  // 빈 배열 — 오직 setupTag 로만 발사
  parentFolderId: '37', // biocom.kr 폴더
  notes: 'Claude Code draft 2026-04-21. [154] HURDLERS - [데이터레이어] 구매 의 setupTag 로 실행. event 키 없는 prep push. 가상계좌 guard 포함. publish 전 Preview 검증 필수.'
};

console.log('=== Step 1: create new prep tag ===');
let r = await fetch(`${BASE}${wsPath}/tags`, { method: 'POST', headers: H, body: JSON.stringify(newTagBody) });
const created = await r.json();
if (!r.ok) { console.error('create FAILED:', JSON.stringify(created, null, 2)); process.exit(1); }
console.log('  ✅ created tagId=', created.tagId, 'name=', created.name);
console.log('  path:', created.path);
console.log('  firingTriggerId:', created.firingTriggerId || '[]');

// Step 2: update tag 154 setupTag to reference new tag
console.log('\n=== Step 2: attach setupTag to tag 154 ===');
r = await fetch(`${BASE}${wsPath}/tags/154`, { headers: { Authorization: `Bearer ${token}` } });
const t154 = await r.json();
t154.setupTag = [
  { tagName: created.name, stopOnSetupFailure: false }
];

r = await fetch(`${BASE}${wsPath}/tags/154`, {
  method: 'PUT',
  headers: { ...H, 'If-Match-Fingerprint': t154.fingerprint },
  body: JSON.stringify(t154)
});
const updated154 = await r.json();
if (!r.ok) { console.error('update 154 FAILED:', JSON.stringify(updated154, null, 2)); process.exit(1); }
console.log('  ✅ tag 154 updated, new fingerprint=', updated154.fingerprint);
console.log('  setupTag:', JSON.stringify(updated154.setupTag, null, 2));

// Step 3: workspace status
console.log('\n=== Step 3: workspace pending changes ===');
r = await fetch(`${BASE}${wsPath}/status`, { headers: { Authorization: `Bearer ${token}` } });
const status = await r.json();
for (const ch of (status.workspaceChange || [])) {
  const k = ch.tag ? 'tag' : ch.variable ? 'variable' : 'other';
  const obj = ch.tag || ch.variable || {};
  console.log(`  ${k}.${obj.name || obj.tagId || obj.variableId} — ${ch.changeStatus}`);
}

console.log('\n  newTagId:', created.tagId);
console.log('  newTagName:', created.name);
console.log('  DO NOT PUBLISH. workspace commit only.');
