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
const wsPath = 'accounts/4703003246/containers/13158774/workspaces/145';

const fallbackCode = `function() {
  // Priority 1: existing HURDLERS dataLayer value (hurdlers_ga4.transaction_id)
  try {
    var dlv = {{HURDLERS - GA4 Transaction_id}};
    if (dlv && String(dlv).trim() !== '' && String(dlv) !== '(not set)') return String(dlv);
  } catch(e) {}

  // Priority 2: ecommerce.transaction_id from latest dataLayer push
  try {
    var dl = window.dataLayer || [];
    for (var i = dl.length - 1; i >= 0; i--) {
      var ev = dl[i];
      if (ev && ev.ecommerce && ev.ecommerce.transaction_id) {
        return String(ev.ecommerce.transaction_id);
      }
    }
  } catch(e) {}

  // Priority 3: URL fallback (order_no / orderNo / order_code)
  try {
    var p = new URLSearchParams(location.search);
    var v = p.get('order_no') || p.get('orderNo') || p.get('order_id') || p.get('order_code') || p.get('orderCode');
    if (v) return String(v);
  } catch(e) {}

  return '';
}`;

const newVar = {
  name: 'JS - Purchase Transaction ID (fallback chain)',
  type: 'jsm',
  parameter: [
    { type: 'template', key: 'javascript', value: fallbackCode }
  ],
  parentFolderId: '106'
};

console.log('=== creating new variable ===');
let r = await fetch(`${BASE}${wsPath}/variables`, { method: 'POST', headers: H, body: JSON.stringify(newVar) });
const created = await r.json();
if (!r.ok) { console.error('create failed:', created); process.exit(1); }
console.log('created variableId=', created.variableId, 'name=', created.name);
console.log('url:', created.tagManagerUrl);

const newVarRef = `{{${created.name}}}`;
console.log('\n=== patching tag [143] HURDLERS - [이벤트전송] 구매 ===');

r = await fetch(`${BASE}${wsPath}/tags/143`, { headers: { Authorization: `Bearer ${token}` } });
const tag = await r.json();
console.log('fetched fingerprint=', tag.fingerprint);

// find transaction_id row in eventSettingsTable and replace parameterValue
const est = tag.parameter.find(p => p.key === 'eventSettingsTable');
if (!est) { console.error('no eventSettingsTable'); process.exit(1); }
let txRow = est.list.find(row =>
  row.type === 'map' && row.map.find(m => m.key === 'parameter' && m.value === 'transaction_id')
);
if (!txRow) { console.error('no transaction_id row'); process.exit(1); }

const before = txRow.map.find(m => m.key === 'parameterValue').value;
console.log('before:', before);
txRow.map.find(m => m.key === 'parameterValue').value = newVarRef;
const after = txRow.map.find(m => m.key === 'parameterValue').value;
console.log('after :', after);

// PUT the updated tag
r = await fetch(`${BASE}${wsPath}/tags/143`, {
  method: 'PUT',
  headers: { ...H, 'If-Match-Fingerprint': tag.fingerprint },
  body: JSON.stringify(tag)
});
const updated = await r.json();
if (!r.ok) { console.error('update failed:', JSON.stringify(updated, null, 2)); process.exit(1); }
console.log('updated tag [143], new fingerprint=', updated.fingerprint);
console.log('tag url:', updated.tagManagerUrl);
