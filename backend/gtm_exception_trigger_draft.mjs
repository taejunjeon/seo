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

// ============================================================
// Step 1: Custom JS Variable `JS - vbank blocked`
// ============================================================
const VBANK_VAR_JS = `function() {
  try {
    var last = window.__BIOCOM_SERVER_PAYMENT_DECISION_LAST__;
    if (!last || typeof last.branch !== 'string') return false;
    return last.branch.indexOf('block_') === 0;
  } catch (e) {
    return false;
  }
}`;

const vbankVarBody = {
  name: 'JS - vbank blocked',
  type: 'jsm',
  parameter: [
    { type: 'template', key: 'javascript', value: VBANK_VAR_JS }
  ],
  parentFolderId: '37', // biocom.kr
  notes: 'Claude draft 2026-04-21. Read window.__BIOCOM_SERVER_PAYMENT_DECISION_LAST__.branch. Returns true when branch starts with "block_" (e.g. block_purchase_virtual_account). Used as Exception Trigger filter for [143]/[48]/[154].'
};

console.log('=== Step 1: create variable JS - vbank blocked ===');
let r = await fetch(`${BASE}${wsPath}/variables`, { method: 'POST', headers: H, body: JSON.stringify(vbankVarBody) });
const vbankVar = await r.json();
if (!r.ok) { console.error('create var FAILED:', JSON.stringify(vbankVar, null, 2)); process.exit(1); }
console.log('  ✅ variableId=', vbankVar.variableId, 'name=', vbankVar.name);

// ============================================================
// Step 2: Exception Trigger (Custom Event matching all events, filter: {{JS - vbank blocked}} == true)
// ============================================================
const triggerBody = {
  name: 'Exception - vbank blocked (all events)',
  type: 'customEvent',
  customEventFilter: [
    {
      type: 'matchRegex',
      parameter: [
        { type: 'template', key: 'arg0', value: '{{_event}}' },
        { type: 'template', key: 'arg1', value: '.*' }
      ]
    }
  ],
  filter: [
    {
      type: 'equals',
      parameter: [
        { type: 'template', key: 'arg0', value: '{{JS - vbank blocked}}' },
        { type: 'template', key: 'arg1', value: 'true' }
      ]
    }
  ],
  parentFolderId: '37',
  notes: 'Claude draft 2026-04-21. Used as blockingTriggerId on [143]/[48]/[154]. Fires on ANY event where JS - vbank blocked returns true (server-decision-guard branch=block_*). publish 전 Preview 검증 필수.'
};

console.log('\n=== Step 2: create Exception trigger ===');
r = await fetch(`${BASE}${wsPath}/triggers`, { method: 'POST', headers: H, body: JSON.stringify(triggerBody) });
const exTrigger = await r.json();
if (!r.ok) { console.error('create trigger FAILED:', JSON.stringify(exTrigger, null, 2)); process.exit(1); }
console.log('  ✅ triggerId=', exTrigger.triggerId, 'name=', exTrigger.name);

const blockingId = exTrigger.triggerId;

// ============================================================
// Step 3: Attach blockingTriggerId to [143], [48], [154]
// ============================================================
async function attachBlockingTrigger(tagId) {
  let r2 = await fetch(`${BASE}${wsPath}/tags/${tagId}`, { headers: { Authorization: `Bearer ${token}` } });
  const tag = await r2.json();
  console.log(`\n=== Step 3.${tagId}: attach blocking trigger to [${tagId}] ${tag.name} ===`);

  tag.blockingTriggerId = Array.from(new Set([...(tag.blockingTriggerId || []), blockingId]));

  r2 = await fetch(`${BASE}${wsPath}/tags/${tagId}`, {
    method: 'PUT',
    headers: { ...H, 'If-Match-Fingerprint': tag.fingerprint },
    body: JSON.stringify(tag)
  });
  const updated = await r2.json();
  if (!r2.ok) { console.error(`update [${tagId}] FAILED:`, JSON.stringify(updated, null, 2)); return false; }
  console.log('  ✅ new fingerprint=', updated.fingerprint);
  console.log('  blockingTriggerId:', updated.blockingTriggerId);
  return true;
}

await attachBlockingTrigger('143');
await attachBlockingTrigger('48');
await attachBlockingTrigger('154');

// ============================================================
// Step 4: Workspace status
// ============================================================
r = await fetch(`${BASE}${wsPath}/status`, { headers: { Authorization: `Bearer ${token}` } });
const status = await r.json();
console.log('\n=== Workspace pending changes ===');
for (const ch of (status.workspaceChange || [])) {
  const kind = ch.tag ? 'tag' : ch.variable ? 'variable' : ch.trigger ? 'trigger' : 'other';
  const obj = ch.tag || ch.variable || ch.trigger || {};
  console.log(`  ${kind}.${obj.name || obj.tagId || obj.variableId || obj.triggerId} — ${ch.changeStatus}`);
}

console.log('\nExported ids:');
console.log('  variable JS - vbank blocked  =', vbankVar.variableId);
console.log('  trigger  Exception          =', blockingId);
console.log('\nDO NOT PUBLISH.');
