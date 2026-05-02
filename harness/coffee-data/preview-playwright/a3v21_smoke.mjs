/**
 * A-3 v2.1 dispatcher 자동 검증 (playwright + monkey-patch + mock funnel-capi key).
 *
 * 흐름:
 *  1. chromium 으로 site 진입
 *  2. site 의 confirmOrderWithCartItems / window.confirmOrderWithCartItems 를 noop 으로 replace
 *     (실제 NPay 결제 페이지 redirect 차단)
 *  3. snippet IIFE inject (buffer push wrap 적용됨)
 *  4. dispatcher v2.1 IIFE inject (1초 sweep + in-flight Set + 3초 wait + payment_button_type fallback)
 *  5. NPay click 흐름 시뮬레이션 (PC #naverPayWrap selector 또는 SITE_SHOP_DETAIL.confirmOrderWithCartItems("npay") 직접 호출)
 *  6. 1.5초 wait → mock funnel-capi key set (`funnelCapi::sent::InitiateCheckout.<order_code>.<suffix>`)
 *  7. 추가 wait → snippet retry capture (200/800/1500/2400ms tick) → buffer entry 의 imweb_order_code 갱신
 *  8. dispatcher v2.1 sweep (1s) → imweb_order_code 채워짐 발견 → fetch → backend INSERT
 *  9. sessionStorage 캡처 (buffer / pending / sent)
 * 10. backend stats 캡처 (외부 도메인 fetch)
 *
 * 가드:
 *  - GTM Production publish 0
 *  - GA4/Meta/TikTok/Google Ads send 0 (코드 자체에 발신 path 없음)
 *  - 운영 DB write 0 (smoke window 안에서만 enforce INSERT, max 5)
 *  - 진짜 NPay 결제 redirect 0 (orig confirm noop replace)
 */

import { chromium } from "playwright";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SITE_URL = "https://thecleancoffee.com/shop_view/?idx=73";
const BACKEND = "https://att.ainativeos.net";

const SNIPPET_PATH = resolve(__dirname, "snippet_iife.js");
const DISPATCHER_PATH = resolve(__dirname, "dispatcher_v21.js");

const snippetCode = readFileSync(SNIPPET_PATH, "utf-8");
const dispatcherCode = readFileSync(DISPATCHER_PATH, "utf-8");

function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

async function captureState(page, label) {
  const state = await page.evaluate(() => {
    const sent = JSON.parse(sessionStorage.getItem("__coffee_intent_sent") || "{}");
    const pending = JSON.parse(sessionStorage.getItem("__coffee_intent_pending") || "{}");
    const buffer = JSON.parse(sessionStorage.getItem("coffee_npay_intent_preview") || "[]");

    let blocked = 0,
      ok = 0,
      perm4xx = 0;
    for (const k in sent) {
      const s = sent[k]?.status || "";
      if (s === "blocked_missing_imweb_order_code") blocked++;
      else if (s.startsWith("ok_")) ok++;
      else if (s.startsWith("permanent_4xx")) perm4xx++;
    }

    const fcKeys = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith("funnelCapi::sent::InitiateCheckout.")) fcKeys.push(k);
    }

    return {
      buffer_count: buffer.length,
      buffer_with_imweb_order_code: buffer.filter((b) => b.imweb_order_code).length,
      buffer_with_payment_button_type: buffer.filter((b) => b.payment_button_type).length,
      sent_count: Object.keys(sent).length,
      sent_ok_count: ok,
      sent_blocked_count: blocked,
      sent_perm4xx_count: perm4xx,
      pending_count: Object.keys(pending).length,
      sent_entries: sent,
      pending_entries: pending,
      buffer_entries: buffer.map((b) => ({
        intent_uuid: b.intent_uuid,
        intent_phase: b.intent_phase,
        imweb_order_code: b.imweb_order_code,
        payment_button_type: b.payment_button_type,
        version: b.version,
      })),
      funnel_capi_initiate_checkout_keys: fcKeys,
    };
  });
  console.log(`\n[${label}]`, JSON.stringify(state, null, 2));
  return state;
}

async function fetchBackendStats() {
  const res = await fetch(`${BACKEND}/api/coffee/intent/stats`);
  return res.json();
}

async function main() {
  console.log("=== chromium launch (headless) ===");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/Codex-A3v21-Playwright Safari/537.36",
  });
  const page = await context.newPage();

  const networkLog = [];
  page.on("request", (req) => {
    const url = req.url();
    if (url.includes("att.ainativeos.net/api/attribution/coffee-npay-intent")) {
      networkLog.push({ method: req.method(), url, ts: Date.now() });
    }
  });
  page.on("response", async (res) => {
    const url = res.url();
    if (url.includes("att.ainativeos.net/api/attribution/coffee-npay-intent")) {
      try {
        const body = await res.text();
        networkLog.push({ method: res.request().method(), url, status: res.status(), body: body.slice(0, 300), ts: Date.now() });
      } catch (e) {}
    }
  });

  console.log("=== site 진입 ===");
  await page.goto(SITE_URL, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await sleep(2000); // site 의 SITE_SHOP_DETAIL / funnel-capi v3 등 lazy init 시간

  console.log("=== confirmOrderWithCartItems noop replace (redirect 차단) ===");
  await page.evaluate(() => {
    const noop = function (kind /*, backurl, params */) {
      console.info("[playwright-noop] confirmOrderWithCartItems blocked, kind=", kind);
      return undefined;
    };
    if (window.SITE_SHOP_DETAIL && typeof window.SITE_SHOP_DETAIL.confirmOrderWithCartItems === "function") {
      window.SITE_SHOP_DETAIL.confirmOrderWithCartItems = noop;
    }
    if (typeof window.confirmOrderWithCartItems === "function") {
      window.confirmOrderWithCartItems = noop;
    }
    // location.assign / location.href 는 not-configurable 이라 override 불가.
    // 다행히 NPay redirect 의 main path 는 confirmOrderWithCartItems 안에서 location 변경.
    // 그게 noop 라 redirect 일어나지 않음.
  });

  console.log("=== snippet IIFE inject ===");
  await page.addScriptTag({ content: snippetCode });
  await sleep(500);

  console.log("=== dispatcher v2.1 IIFE inject ===");
  await page.addScriptTag({ content: dispatcherCode });
  await sleep(500);

  // snippet status 확인
  const snippetStatus = await page.evaluate(() => {
    return window.coffeeNpayIntentPreview ? window.coffeeNpayIntentPreview.status() : null;
  });
  console.log("snippet status:", JSON.stringify(snippetStatus, null, 2));

  console.log("=== Scenario A — NPay click 시뮬레이션 (snippet wrap 통해 buffer push, 진짜 redirect 차단) ===");
  // 직접 confirmOrderWithCartItems("npay") 호출 — snippet wrap 이 buffer push, noop orig 가 redirect 차단
  await page.evaluate(() => {
    if (window.SITE_SHOP_DETAIL && typeof window.SITE_SHOP_DETAIL.confirmOrderWithCartItems === "function") {
      window.SITE_SHOP_DETAIL.confirmOrderWithCartItems("npay", null, {});
    } else if (typeof window.confirmOrderWithCartItems === "function") {
      window.confirmOrderWithCartItems("npay", null, {});
    } else {
      console.warn("[scenarioA] confirmOrderWithCartItems not found");
    }
  });

  await captureState(page, "after-click-t0");

  console.log("=== Scenario A — 1.5초 wait (dispatcher 첫 sweep: imweb null → pending wait) ===");
  await sleep(1500);
  await captureState(page, "after-1.5s");

  console.log("=== Scenario A — mock funnel-capi key set (시뮬레이션: 결제 완료 후 funnel-capi 가 박는 key) ===");
  const orderCodeMock = await page.evaluate(() => {
    const ts = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const orderCode = "o" + ts + "abcdef1234567890";
    const eid = `InitiateCheckout.${orderCode}.aabbccdd${Math.random().toString(36).slice(2, 8)}`;
    sessionStorage.setItem(`funnelCapi::sent::${eid}`, "1");
    return orderCode;
  });
  console.log("mock orderCode:", orderCodeMock);

  console.log("=== Scenario A — 3초 wait (snippet retry tick + dispatcher v2.1 sweep) ===");
  await sleep(3000);
  const stateA = await captureState(page, "after-mock-3s");

  console.log("=== backend stats 즉시 캡처 ===");
  const stats1 = await fetchBackendStats();
  console.log(JSON.stringify({
    enforce_inserted: stats1.reject_counters?.enforce_inserted,
    enforce_deduped: stats1.reject_counters?.enforce_deduped,
    total_rows: stats1.total_rows,
    rows_with_imweb_order_code: stats1.rows_with_imweb_order_code,
    smoke_window: stats1.smoke_window_summary,
  }, null, 2));

  console.log("=== Scenario B — O1 race 검증: 두 번째 click (다른 intent_uuid) ===");
  await page.evaluate(() => {
    if (window.SITE_SHOP_DETAIL && typeof window.SITE_SHOP_DETAIL.confirmOrderWithCartItems === "function") {
      window.SITE_SHOP_DETAIL.confirmOrderWithCartItems("npay", null, {});
    }
  });
  await sleep(500);

  console.log("=== Scenario B — mock funnel-capi key 추가 set ===");
  await page.evaluate(() => {
    const ts = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const orderCode = "o" + ts + "fedcba9999888877";
    const eid = `InitiateCheckout.${orderCode}.aabbeeff${Math.random().toString(36).slice(2, 8)}`;
    sessionStorage.setItem(`funnelCapi::sent::${eid}`, "1");
    return orderCode;
  });

  console.log("=== Scenario B — 3초 wait ===");
  await sleep(3000);
  const stateB = await captureState(page, "after-scenarioB-3s");

  console.log("=== Scenario C — O3 검증: payment_button_type 누락 entry 직접 push (snippet 우회) ===");
  // snippet wrap 이 항상 "npay" 채우므로 누락 path 강제 시뮬레이션
  await page.evaluate(() => {
    const buf = JSON.parse(sessionStorage.getItem("coffee_npay_intent_preview") || "[]");
    const ts = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const orderCode = "o" + ts + "o3test99887766";
    buf.push({
      site: "thecleancoffee",
      version: "a3v21_playwright_O3_test",
      intent_phase: "confirm_to_pay",
      session_uuid: "playwright-session-uuid-O3",
      intent_uuid: "playwright-O3-" + Date.now(),
      intent_seq: 99,
      page_url: location.href,
      page_path: location.pathname,
      // payment_button_type: 의도적으로 누락 — dispatcher v2.1 fallback 검증
      ts_ms_kst: Date.now(),
      ts_label_kst: new Date().toLocaleString("sv-SE", { timeZone: "Asia/Seoul" }),
      preview_only: true,
      is_simulation: false,
      imweb_order_code: orderCode, // 즉시 채워서 dispatcher wait flow skip
      funnel_capi_session_id: "playwright-O3",
    });
    sessionStorage.setItem("coffee_npay_intent_preview", JSON.stringify(buf));
  });
  await sleep(2000);
  const stateC = await captureState(page, "after-scenarioC-2s");

  console.log("=== 최종 backend stats ===");
  const stats2 = await fetchBackendStats();
  console.log(JSON.stringify({
    enforce_inserted: stats2.reject_counters?.enforce_inserted,
    enforce_deduped: stats2.reject_counters?.enforce_deduped,
    total_rows: stats2.total_rows,
    rows_with_imweb_order_code: stats2.rows_with_imweb_order_code,
    smoke_window: stats2.smoke_window_summary,
  }, null, 2));

  console.log("=== Network 로그 (att.ainativeos.net 의 attribution endpoint) ===");
  console.log(JSON.stringify(networkLog, null, 2));

  await browser.close();
  console.log("\n=== DONE ===");
  return {
    snippet_status: snippetStatus,
    state_A: stateA,
    state_B: stateB,
    state_C: stateC,
    stats_after_A: {
      enforce_inserted: stats1.reject_counters?.enforce_inserted,
      enforce_deduped: stats1.reject_counters?.enforce_deduped,
      total_rows: stats1.total_rows,
      rows_with_imweb_order_code: stats1.rows_with_imweb_order_code,
    },
    stats_final: {
      enforce_inserted: stats2.reject_counters?.enforce_inserted,
      enforce_deduped: stats2.reject_counters?.enforce_deduped,
      total_rows: stats2.total_rows,
      rows_with_imweb_order_code: stats2.rows_with_imweb_order_code,
    },
    network_log: networkLog,
  };
}

main()
  .then((result) => {
    console.log("\n=== summary ===");
    console.log(JSON.stringify(result, null, 2));
  })
  .catch((e) => {
    console.error("[fatal]", e);
    process.exit(1);
  });
