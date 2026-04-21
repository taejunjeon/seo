import { JWT } from 'google-auth-library';
import dotenv from 'dotenv';
dotenv.config();

const sa = JSON.parse(process.env.GA4_BIOCOM_SERVICE_ACCOUNT_KEY);
const client = new JWT({
  email: sa.client_email, key: sa.private_key,
  scopes: [
    'https://www.googleapis.com/auth/tagmanager.edit.containers',
    'https://www.googleapis.com/auth/tagmanager.edit.containerversions',
    'https://www.googleapis.com/auth/tagmanager.publish'
  ]
});
const { token } = await client.getAccessToken();
const H = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
const BASE = 'https://tagmanager.googleapis.com/tagmanager/v2/';
const accountId = '4703003246';
const containerId = '13158774';
const workspaceId = '146';

const VERSION_NAME = 'vbank_exception_trigger_2026-04-21';
const VERSION_NOTES = '가상계좌 미입금 GA4 purchase 차단 + hurdlers_ga4 prep 태그. 변수 [252] JS - vbank blocked + 트리거 [253] Exception + 태그 [143]/[48]/[154] blockingTriggerId + 태그 [251] prep v3 (dataLayer.set + server-branch guard) + 태그 [154] setupTag. Preview A(카드)/B(가상계좌) 통과. 근거: GA4/gtm_exception_trigger_draft_20260421.md, GA4/gptfeedback_gtm_0421_2reply.md §13.';

// Step 1: create version from workspace
console.log('=== Step 1: create_version from workspace', workspaceId, '===');
let r = await fetch(
  `${BASE}accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}:create_version`,
  { method: 'POST', headers: H, body: JSON.stringify({ name: VERSION_NAME, notes: VERSION_NOTES }) }
);
const cvResp = await r.json();
if (!r.ok) { console.error('create_version FAILED:', JSON.stringify(cvResp, null, 2)); process.exit(1); }

const cv = cvResp.containerVersion;
console.log('  ✅ version created');
console.log('  containerVersionId:', cv.containerVersionId);
console.log('  name:', cv.name);
console.log('  path:', cv.path);
console.log('  fingerprint:', cv.fingerprint);
if (cvResp.compilerError) console.log('  ⚠️ compilerError:', cvResp.compilerError);
if (cvResp.newWorkspacePath) console.log('  new workspace path:', cvResp.newWorkspacePath);
console.log('  tag count:', (cv.tag || []).length);
console.log('  variable count:', (cv.variable || []).length);

// Verify targeted changes are in this version
const v143 = (cv.tag || []).find(t => t.tagId === '143');
const v48 = (cv.tag || []).find(t => t.tagId === '48');
const v43 = (cv.tag || []).find(t => t.tagId === '43');
const v250 = (cv.variable || []).find(v => v.variableId === '250');

function getTxParam(tag) {
  const est = tag?.parameter?.find(p => p.key === 'eventSettingsTable');
  if (!est) return '(no eventSettingsTable)';
  const row = (est.list || []).find(r => r.map?.find(m => m.key === 'parameter' && m.value === 'transaction_id'));
  if (!row) return '(no transaction_id row)';
  return row.map.find(m => m.key === 'parameterValue')?.value;
}

console.log('\n=== Version content verification ===');
console.log('  tag[143] transaction_id =', getTxParam(v143));
console.log('  tag[48]  transaction_id =', getTxParam(v48));
console.log('  tag[43]  transaction_id =', getTxParam(v43));
console.log('  variable[250] name =', v250?.name);

// Step 2: publish version
console.log('\n=== Step 2: publish version', cv.containerVersionId, '===');
r = await fetch(`${BASE}${cv.path}:publish`, { method: 'POST', headers: H });
const pubResp = await r.json();
if (!r.ok) { console.error('publish FAILED:', JSON.stringify(pubResp, null, 2)); process.exit(1); }
console.log('  ✅ publish response received');
console.log('  compilerError:', pubResp.compilerError || 'none');

// Step 3: verify live version
console.log('\n=== Step 3: verify live version ===');
r = await fetch(`${BASE}accounts/${accountId}/containers/${containerId}/versions:live`, { headers: { Authorization: `Bearer ${token}` } });
const liveVer = await r.json();
console.log('  live containerVersionId:', liveVer.containerVersionId);
console.log('  live name:', liveVer.name);
console.log('  live description:', liveVer.description);

const liveMatch = liveVer.containerVersionId === cv.containerVersionId;
console.log('  matches published version?', liveMatch ? '✅ YES' : '❌ NO');
