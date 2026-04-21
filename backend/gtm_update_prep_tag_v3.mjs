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
const TAG_ID = '251';

// v3 HTML — server-payment-decision-guard 의 __BIOCOM_SERVER_PAYMENT_DECISION_LAST__ flag 를 새 G4 로 추가.
// 2026-04-21 01:05 Preview Run 3 관측: 가상계좌 주문완료에도 rk=S 가 붙고 HURDLERS 가 값 채움.
// server-decision-guard (footer/header_purchase_guard_server_decision_0412_v3.md) 가 이미 branch 를 설정하므로 이를 신뢰.
const HTML = `<script>
(function(){
  var CONTAINER_ID = 'GTM-W2Z6PHN';
  function prepLog() {
    try {
      if (window.console && window.console.log) {
        var args = Array.prototype.slice.call(arguments);
        args.unshift('[seo-hurdlers-prep]');
        window.console.log.apply(window.console, args);
      }
    } catch (e) {}
  }

  try {
    // ========== Guard 1: 결제완료 URL ==========
    var path = (location.pathname || '');
    if (path.indexOf('shop_payment_complete') === -1) {
      prepLog('skip: path does not contain shop_payment_complete', { path: path });
      return;
    }

    var params;
    try { params = new URLSearchParams(location.search); }
    catch (e) { prepLog('skip: URLSearchParams error', e); return; }

    var orderNo = params.get('order_no') || params.get('orderNo') || params.get('order_id');
    if (!orderNo) {
      prepLog('skip: no order_no in URL', { search: location.search });
      return;
    }

    // ========== Guard 2: URL rk 파라미터 (PG 결제완료 성공 마커) ==========
    // 2026-04-21 Preview Run 3 확인: 가상계좌 미입금에도 rk=S 가 붙으므로 이 guard 만으로는 불충분.
    // 유지는 하되 의미는 "rk 값이 비정상(F/error)인 경우만 차단" 수준.
    var rk = params.get('rk');
    if (rk && rk !== 'S') {
      prepLog('GUARD_BLOCKED: rk != S', { order_no: orderNo, rk: rk });
      return;
    }

    // ========== Guard 3 (★ v3 신규): server-payment-decision-guard branch 확인 ==========
    // footer/header_purchase_guard_server_decision_0412_v3.md 가 window.__BIOCOM_SERVER_PAYMENT_DECISION_LAST__
    // 에 {branch, status, reason, ...} 를 저장. 가상계좌 미입금이면 branch='block_purchase_virtual_account'.
    // 이 guard 가 있기 전엔 GA4 purchase 가 잘못 발사됐음.
    // 여기서 block_* 계열이면 prep 도 수행하지 않음.
    var serverBranch = null;
    try {
      var lastDecision = window.__BIOCOM_SERVER_PAYMENT_DECISION_LAST__;
      if (lastDecision && typeof lastDecision.branch === 'string') {
        serverBranch = lastDecision.branch;
        if (serverBranch && serverBranch.indexOf('block_') === 0) {
          prepLog('GUARD_BLOCKED: server decision branch=' + serverBranch, {
            order_no: orderNo,
            status: lastDecision.status || null,
            reason: lastDecision.reason || null,
            matchedBy: lastDecision.matchedBy || null
          });
          return;
        }
      }
    } catch (e) {}

    // ========== Guard 4 (legacy): __seo_allow_purchase 플래그 (있으면 존중) ==========
    var allowFlag = null;
    try {
      allowFlag = window.__seo_allow_purchase;
      if (allowFlag === false) {
        prepLog('GUARD_BLOCKED: window.__seo_allow_purchase=false', { order_no: orderNo });
        return;
      }
    } catch (e) {}

    // ========== Idempotency ==========
    var guardKey = '__seo_hurdlers_ga4_prepared__:' + orderNo;
    try {
      if (window.sessionStorage && sessionStorage.getItem(guardKey) === '1') {
        prepLog('skip: idempotency (already prepared this session)', { order_no: orderNo });
        return;
      }
    } catch (e) {}

    // ========== Value 추출 ==========
    var value = 0, valueSource = 'default_0';
    try {
      var dl = window.dataLayer || [];
      for (var i = dl.length - 1; i >= 0 && value === 0; i--) {
        var ev = dl[i];
        if (!ev) continue;
        if (ev.eventModel && typeof ev.eventModel.value !== 'undefined' && ev.eventModel.value !== null) {
          var v1 = parseInt(ev.eventModel.value, 10);
          if (!isNaN(v1) && v1 > 0) { value = v1; valueSource = 'eventModel'; break; }
        }
        if (ev.ecommerce && typeof ev.ecommerce.value !== 'undefined' && ev.ecommerce.value !== null) {
          var v2 = parseInt(ev.ecommerce.value, 10);
          if (!isNaN(v2) && v2 > 0) { value = v2; valueSource = 'ecommerce'; break; }
        }
        if (ev.hurdlers_ga4 && typeof ev.hurdlers_ga4.value !== 'undefined' && ev.hurdlers_ga4.value !== null) {
          var v3 = parseInt(ev.hurdlers_ga4.value, 10);
          if (!isNaN(v3) && v3 > 0) { value = v3; valueSource = 'hurdlers_existing'; break; }
        }
      }
    } catch (e) { prepLog('value extract error', e); }

    // ========== Items 추출 ==========
    var items = [], itemsSource = 'default_empty';
    try {
      var dl2 = window.dataLayer || [];
      for (var k = dl2.length - 1; k >= 0; k--) {
        var ev2 = dl2[k];
        if (!ev2) continue;
        if (ev2.hurdlers_ga4 && Array.isArray(ev2.hurdlers_ga4.items) && ev2.hurdlers_ga4.items.length > 0) {
          items = ev2.hurdlers_ga4.items; itemsSource = 'hurdlers_existing'; break;
        }
        if (ev2.ecommerce && Array.isArray(ev2.ecommerce.items) && ev2.ecommerce.items.length > 0) {
          items = ev2.ecommerce.items; itemsSource = 'ecommerce'; break;
        }
      }
    } catch (e) { prepLog('items extract error', e); }

    var payload = {
      transaction_id: String(orderNo),
      value: value,
      items: items,
      shipping: 0,
      currency: 'KRW'
    };

    // ========== 핵심 주입: google_tag_manager[CID].dataLayer.set ==========
    var setOk = false, setError = null;
    try {
      var gtm = window.google_tag_manager && window.google_tag_manager[CONTAINER_ID];
      if (gtm && gtm.dataLayer && typeof gtm.dataLayer.set === 'function') {
        gtm.dataLayer.set('hurdlers_ga4', payload);
        gtm.dataLayer.set('_seo_hurdlers_ga4_prep', {
          method: 'gtm.dataLayer.set',
          order_no: String(orderNo),
          rk: rk || null,
          server_branch: serverBranch || null,
          allow_purchase: allowFlag,
          value: value,
          value_source: valueSource,
          items_count: items.length,
          items_source: itemsSource,
          ts: new Date().toISOString()
        });
        setOk = true;
      } else {
        setError = 'gtm container or dataLayer.set not available';
      }
    } catch (e) {
      setError = (e && e.message) ? e.message : String(e);
    }

    // ========== 디버그용 push ==========
    try {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({
        _seo_hurdlers_ga4_prep_debug: {
          set_ok: setOk,
          set_error: setError,
          order_no: String(orderNo),
          rk: rk || null,
          server_branch: serverBranch || null,
          allow_purchase: allowFlag,
          value: value,
          value_source: valueSource,
          items_count: items.length,
          items_source: itemsSource,
          ts: new Date().toISOString(),
          note: 'debug only, not read by [154]'
        }
      });
    } catch (e) {}

    try {
      if (window.sessionStorage) sessionStorage.setItem(guardKey, '1');
    } catch (e) {}

    prepLog(setOk ? 'SET_OK' : 'SET_FAIL', {
      order_no: orderNo, value: value, items: items.length,
      value_source: valueSource, items_source: itemsSource,
      rk: rk || null, server_branch: serverBranch || null,
      set_error: setError
    });
  } catch (err) {
    prepLog('fatal error', err);
  }
})();
</script>`;

let r = await fetch(`${BASE}${wsPath}/tags/${TAG_ID}`, { headers: { Authorization: `Bearer ${token}` } });
const tag = await r.json();
console.log('=== before ===');
console.log('name:', tag.name);
console.log('fingerprint:', tag.fingerprint);

const htmlParam = tag.parameter.find(p => p.key === 'html');
htmlParam.value = HTML;
tag.notes = (tag.notes || '') + '\n2026-04-21 01:15 KST (v3): G3 신규 = server-payment-decision-guard branch 확인 (block_* 계열이면 prep 차단). Preview Run 3 관측 기반.';

r = await fetch(`${BASE}${wsPath}/tags/${TAG_ID}`, {
  method: 'PUT',
  headers: { ...H, 'If-Match-Fingerprint': tag.fingerprint },
  body: JSON.stringify(tag)
});
const updated = await r.json();
if (!r.ok) { console.error('UPDATE FAILED:', JSON.stringify(updated, null, 2)); process.exit(1); }
console.log('\n=== after v3 ===');
console.log('new fingerprint:', updated.fingerprint);

const finalHtml = updated.parameter.find(p => p.key === 'html').value;
console.log('html length:', finalHtml.length);
console.log('  contains __BIOCOM_SERVER_PAYMENT_DECISION_LAST__:', /__BIOCOM_SERVER_PAYMENT_DECISION_LAST__/.test(finalHtml));
console.log('  contains block_ guard:', /block_/.test(finalHtml));
console.log('  contains dataLayer.set:', /dataLayer\.set/.test(finalHtml));
console.log('  forbidden gtag purchase:', /gtag\(["']event["'],\s*["']purchase["']/.test(finalHtml));
console.log('  forbidden event purchase push:', /event\s*:\s*["']purchase["']/.test(finalHtml));
console.log('  forbidden event hurdlers_purchase push:', /event\s*:\s*["']hurdlers_purchase["']/.test(finalHtml));
console.log('  forbidden event conversion push:', /event\s*:\s*["']conversion["']/.test(finalHtml));

r = await fetch(`${BASE}${wsPath}/status`, { headers: { Authorization: `Bearer ${token}` } });
const status = await r.json();
console.log('\n=== workspace pending changes ===');
for (const ch of (status.workspaceChange || [])) {
  const k = ch.tag ? 'tag' : ch.variable ? 'variable' : 'other';
  const obj = ch.tag || ch.variable || {};
  console.log(`  ${k}.${obj.name || obj.tagId || obj.variableId} — ${ch.changeStatus}`);
}
console.log('\nDO NOT PUBLISH.');
