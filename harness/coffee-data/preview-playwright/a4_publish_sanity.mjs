/**
 * A-4 publish sanity — site 진입 시 dispatcher v2.1 + snippet installer v1 자동 install 확인.
 *
 * 1. site 진입 (snippet/dispatcher inject 안 함 — 진짜 자동 install 검증)
 * 2. windowLoaded 후 sleep, snippet retry (250ms × 8s) 가 SITE_SHOP_DETAIL ready 대기
 * 3. install state 캡처 (dispatcher / snippet / wrap)
 * 4. simulateConfirmNpay() 호출 — snippet API 검증 (is_simulation=true, dispatcher skip)
 * 5. 별도 mock buffer entry push (is_simulation=false, imweb_order_code 채움) — dispatcher v2.1 fetch 검증
 * 6. mock funnel-capi key 도 set — snippet retry capture 검증
 * 7. wait → dispatcher sweep → backend INSERT
 * 8. backend stats / ledger 확인
 *
 * 가드:
 *  - confirmOrderWithCartItems noop replace 안 함 (production publish 후 자동 wrap 검증)
 *  - 진짜 NPay click 안 함 (Naver redirect 차단 위해)
 *  - mock buffer entry 만 직접 push (Scenario C 패턴)
 */

import { chromium } from "playwright";

const SITE_URL = "https://thecleancoffee.com/shop_view/?idx=73";
const BACKEND = "https://att.ainativeos.net";

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function captureState(page, label) {
  const state = await page.evaluate(() => {
    const sd = window.SITE_SHOP_DETAIL;
    const wrapMarker = "__coffeeNpayIntentPreviewWrapped";
    return {
      dispatcher_installed: !!window.__coffeeNpayIntentDispatcherInstalled,
      installer_started: !!window.__coffeeNpayIntentSnippetInstallerStarted,
      snippet_installed: !!window.__coffeeNpayIntentPreviewAllInOneInstalled,
      snippet_api_present: !!window.coffeeNpayIntentPreview,
      snippet_api_status: window.coffeeNpayIntentPreview ? window.coffeeNpayIntentPreview.status() : null,
      site_shop_detail: !!sd,
      site_confirm_wrapped: !!(sd && sd.confirmOrderWithCartItems && sd.confirmOrderWithCartItems[wrapMarker]),
      global_confirm_wrapped: !!(window.confirmOrderWithCartItems && window.confirmOrderWithCartItems[wrapMarker]),
      buffer_count: JSON.parse(sessionStorage.getItem("coffee_npay_intent_preview") || "[]").length,
      sent_count: Object.keys(JSON.parse(sessionStorage.getItem("__coffee_intent_sent") || "{}")).length,
      pending_count: Object.keys(JSON.parse(sessionStorage.getItem("__coffee_intent_pending") || "{}")).length,
    };
  });
  console.log(`\n[${label}]`, JSON.stringify(state, null, 2));
  return state;
}

async function fetchStats() {
  const r = await fetch(`${BACKEND}/api/coffee/intent/stats`);
  return r.json();
}

async function main() {
  console.log("=== A-4 publish sanity (자동 install 검증) ===");
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  const networkLog = [];
  page.on("response", async (res) => {
    if (res.url().includes("att.ainativeos.net/api/attribution/coffee-npay-intent")) {
      try {
        const body = await res.text();
        networkLog.push({ method: res.request().method(), status: res.status(), body: body.slice(0, 250), ts: Date.now() });
      } catch (e) {}
    }
  });

  console.log("=== 1. site 진입 (waitUntil=load — windowLoaded 보장) ===");
  await page.goto(SITE_URL, { waitUntil: "load", timeout: 30_000 });
  console.log("=== 2. snippet installer retry 시간 (8초+) 대기 ===");
  await sleep(9000);

  const stateAfterLoad = await captureState(page, "after-load-9s");

  if (!stateAfterLoad.dispatcher_installed || !stateAfterLoad.snippet_installed) {
    console.error("\n[FAIL] dispatcher 또는 snippet 미install — publish 또는 timing 문제");
    await browser.close();
    process.exit(1);
  }

  // ── snippet API status 출력
  console.log("\n=== 3. snippet API status ===");
  console.log(JSON.stringify(stateAfterLoad.snippet_api_status, null, 2));

  // ── simulateConfirmNpay (is_simulation=true, dispatcher skip 예상)
  console.log("\n=== 4. simulateConfirmNpay (snippet API 호출) ===");
  const simResult = await page.evaluate(() => {
    return window.coffeeNpayIntentPreview ? window.coffeeNpayIntentPreview.simulateConfirmNpay() : null;
  });
  console.log("sim payload first fields:", simResult ? {
    intent_uuid: simResult.intent_uuid,
    intent_phase: simResult.intent_phase,
    is_simulation: simResult.is_simulation,
    payment_button_type: simResult.payment_button_type,
  } : null);
  await sleep(1000);
  await captureState(page, "after-simulate-1s");

  // ── Scenario C: dispatcher v2.1 backend INSERT 검증 — buffer 에 직접 mock entry push
  console.log("\n=== 5. Scenario C: 직접 buffer push (Mock A-4 sanity row) — dispatcher v2.1 fetch 검증 ===");
  const directInsertUuid = `smoke_a4_sanity_${Date.now()}`;
  await page.evaluate((iu) => {
    const buf = JSON.parse(sessionStorage.getItem("coffee_npay_intent_preview") || "[]");
    const orderCode = "o" + new Date().toISOString().slice(0, 10).replace(/-/g, "") + "abcdef0011223344";
    buf.push({
      site: "thecleancoffee",
      version: "a4_sanity_playwright",
      intent_phase: "confirm_to_pay",
      session_uuid: "playwright-a4-sanity",
      intent_uuid: iu,
      intent_seq: 1,
      page_url: location.href,
      page_path: location.pathname,
      payment_button_type: "npay",
      ts_ms_kst: Date.now(),
      ts_label_kst: new Date().toLocaleString("sv-SE", { timeZone: "Asia/Seoul" }),
      preview_only: true,
      is_simulation: false,
      imweb_order_code: orderCode,
      funnel_capi_session_id: "playwright-a4-sanity",
    });
    sessionStorage.setItem("coffee_npay_intent_preview", JSON.stringify(buf));
  }, directInsertUuid);

  console.log("=== 6. dispatcher sweep wait (3초) ===");
  await sleep(3000);
  const stateFinal = await captureState(page, "after-direct-push-3s");

  console.log("\n=== 7. backend stats ===");
  const stats = await fetchStats();
  console.log(JSON.stringify({
    enforce: stats.enforce_flag_active,
    production_mode: stats.production_mode_active,
    daily_count: stats.production_mode_daily_count,
    daily_quota: stats.production_mode_daily_quota,
    smoke_window: stats.smoke_window_active,
    total_rows: stats.total_rows,
    enforce_inserted: stats.reject_counters.enforce_inserted,
    enforce_deduped: stats.reject_counters.enforce_deduped,
    invalid_origin: stats.reject_counters.invalid_origin,
    pii_rejected: stats.reject_counters.pii_rejected,
    production_mode_quota_exceeded: stats.reject_counters.production_mode_quota_exceeded,
  }, null, 2));

  console.log("\n=== 8. Network log ===");
  console.log(JSON.stringify(networkLog, null, 2));

  await browser.close();

  // verdict
  console.log("\n=== verdict ===");
  const pass = (
    stateAfterLoad.dispatcher_installed &&
    stateAfterLoad.snippet_installed &&
    stateAfterLoad.snippet_api_present &&
    (stateAfterLoad.site_confirm_wrapped || stateAfterLoad.global_confirm_wrapped) &&
    stateFinal.sent_count > 0 &&
    stats.reject_counters.enforce_inserted > 0
  );
  console.log("PASS:", pass);
  return { stateAfterLoad, stateFinal, stats, networkLog, pass, directInsertUuid };
}

main().then((r) => {
  console.log("\n=== summary ===");
  console.log(JSON.stringify({ pass: r.pass, directInsertUuid: r.directInsertUuid }, null, 2));
}).catch((e) => { console.error("[fatal]", e); process.exit(1); });
