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

const FALLBACK_REF = '{{JS - Purchase Transaction ID (fallback chain)}}';

async function addTransactionIdToTag(tagId) {
  let r = await fetch(`${BASE}${wsPath}/tags/${tagId}`, { headers: { Authorization: `Bearer ${token}` } });
  const tag = await r.json();
  console.log(`\n=== [${tagId}] ${tag.name} ===`);
  console.log(`fingerprint: ${tag.fingerprint}`);

  let est = tag.parameter.find(p => p.key === 'eventSettingsTable');
  if (!est) {
    est = { type: 'list', key: 'eventSettingsTable', list: [] };
    tag.parameter.push(est);
    console.log('  no eventSettingsTable → creating');
  }

  const existingRow = (est.list || []).find(row =>
    row.type === 'map' && row.map?.find(m => m.key === 'parameter' && m.value === 'transaction_id')
  );

  let action;
  if (existingRow) {
    action = 'updated existing transaction_id row';
    existingRow.map.find(m => m.key === 'parameterValue').value = FALLBACK_REF;
  } else {
    action = 'added new transaction_id row (appended)';
    est.list = est.list || [];
    est.list.push({
      type: 'map',
      map: [
        { type: 'template', key: 'parameter', value: 'transaction_id' },
        { type: 'template', key: 'parameterValue', value: FALLBACK_REF }
      ]
    });
  }
  console.log('  action:', action);

  r = await fetch(`${BASE}${wsPath}/tags/${tagId}`, {
    method: 'PUT',
    headers: { ...H, 'If-Match-Fingerprint': tag.fingerprint },
    body: JSON.stringify(tag)
  });
  const updated = await r.json();
  if (!r.ok) {
    console.error('  ❌ UPDATE FAILED:', JSON.stringify(updated).substring(0, 500));
    return { ok: false, tagId, error: updated };
  }
  const newEst = updated.parameter.find(p => p.key === 'eventSettingsTable');
  const txRow = newEst.list.find(row => row.map?.find(m => m.key === 'parameter' && m.value === 'transaction_id'));
  const finalValue = txRow.map.find(m => m.key === 'parameterValue').value;
  console.log(`  ✅ new fingerprint=${updated.fingerprint}`);
  console.log(`  transaction_id = ${finalValue}`);
  console.log(`  full eventSettings after:`);
  for (const row of newEst.list) {
    const k = row.map.find(m => m.key === 'parameter')?.value;
    const v = row.map.find(m => m.key === 'parameterValue')?.value;
    console.log(`    - ${k} = ${v}`);
  }
  return { ok: true, tagId, name: updated.name, fingerprint: updated.fingerprint, transaction_id: finalValue };
}

const results = [];
results.push(await addTransactionIdToTag('48'));
results.push(await addTransactionIdToTag('43'));

console.log('\n=== SUMMARY ===');
for (const r of results) {
  console.log(`  [${r.tagId}] ${r.name || '(failed)'} — ${r.ok ? 'OK' : 'FAIL'}  tx=${r.transaction_id || r.error?.error?.message || '?'}`);
}

// Final workspace status
const ws = await fetch(`${BASE}${wsPath}/status`, { headers: { Authorization: `Bearer ${token}` } });
const status = await ws.json();
console.log('\n=== PENDING WORKSPACE CHANGES ===');
for (const ch of (status.workspaceChange || [])) {
  const k = ch.tag ? 'tag' : ch.variable ? 'variable' : 'other';
  const obj = ch.tag || ch.variable || {};
  console.log(`  ${k}.${obj.name || obj.tagId || obj.variableId} — ${ch.changeStatus}`);
}
