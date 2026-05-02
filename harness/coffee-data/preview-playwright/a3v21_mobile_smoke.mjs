/**
 * A-3 v2.1 dispatcher mobile flow 자동 검증 (H-1).
 *
 * 목표: PC 검증 (a3v21_smoke.mjs) 외에 mobile path 도 정상 동작 확인.
 * 핵심: snippet 의 `._btn_mobile_npay` click hook (line 458-468) 이 buffer 에 entry push 하는지,
 *      site 의 confirmOrderWithCartItems 도 함께 발화하는지, dispatcher v2.1 이 mobile entry 정상 처리하는지.
 *
 * 가드 (Yellow Lane):
 *  - GTM Production publish 0
 *  - 외부 send 0
 *  - smoke window max 5
 *  - 진짜 NPay 결제 redirect 차단 (confirmOrderWithCartItems noop)
 */

import { chromium, devices } from "playwright";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SITE_URL = "https://thecleancoffee.com/shop_view/?idx=73";
const BACKEND = "https://att.ainativeos.net";

const snippetCode = readFileSync(resolve(__dirname, "snippet_iife.js"), "utf-8");
const dispatcherCode = readFileSync(resolve(__dirname, "dispatcher_v21.js"), "utf-8");

function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

async function captureState(page, label) {
  const state = await page.evaluate(() => {
    const sent = JSON.parse(sessionStorage.getItem("__coffee_intent_sent") || "{}");
    const pending = JSON.parse(sessionStorage.getItem("__coffee_intent_pending") || "{}");
    const buffer = JSON.parse(sessionStorage.getItem("coffee_npay_intent_preview") || "[]");
    return {
      buffer_count: buffer.length,
      buffer_entries: buffer.map((b) => ({
        intent_uuid: b.intent_uuid,
        intent_phase: b.intent_phase,
        imweb_order_code: b.imweb_order_code,
        payment_button_type: b.payment_button_type,
        version: b.version,
        is_simulation: b.is_simulation,
      })),
      sent_count: Object.keys(sent).length,
      sent_entries: sent,
      pending_count: Object.keys(pending).length,
      pending_entries: pending,
    };
  });
  console.log(`\n[${label}]`, JSON.stringify(state, null, 2));
  return state;
}

async function fetchBackendStats() {
  const res = await fetch(`${BACKEND}/api/coffee/intent/stats`);
  return res.json();
}

async function probeButtonExistence(page) {
  return await page.evaluate(() => {
    const result = {};
    const selectors = [
      "._btn_mobile_npay",
      "#naverPayWrap",
      ".btn_naverpay",
      "[class*='naverpay' i]",
      "[class*='npay' i]",
      "[id*='naverpay' i]",
    ];
    for (const s of selectors) {
      const el = document.querySelector(s);
      result[s] = el
        ? {
            tag: el.tagName,
            visible: el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().height > 0,
            class: el.className,
            id: el.id,
          }
        : null;
    }
    return result;
  });
}

async function main() {
  console.log("=== mobile chromium launch (iPhone 14) ===");
  const iPhone = devices["iPhone 14"];
  console.log("device:", JSON.stringify({ viewport: iPhone.viewport, userAgent: iPhone.userAgent.slice(0, 80) }, null, 2));
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ...iPhone });
  const page = await context.newPage();

  const networkLog = [];
  page.on("response", async (res) => {
    const url = res.url();
    if (url.includes("att.ainativeos.net/api/attribution/coffee-npay-intent")) {
      try {
        const body = await res.text();
        networkLog.push({ method: res.request().method(), url, status: res.status(), body: body.slice(0, 250), ts: Date.now() });
      } catch (e) {}
    }
  });

  console.log("=== site 진입 (mobile viewport) ===");
  await page.goto(SITE_URL, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await sleep(2500); // mobile lazy init 시간 좀 더

  console.log("=== mobile NPay button selector 존재 확인 ===");
  const btnProbe = await probeButtonExistence(page);
  console.log("button probe:", JSON.stringify(btnProbe, null, 2));

  console.log("=== confirmOrderWithCartItems noop replace ===");
  await page.evaluate(() => {
    const noop = function (kind) {
      console.info("[playwright-mobile-noop] confirmOrderWithCartItems blocked, kind=", kind);
      return undefined;
    };
    if (window.SITE_SHOP_DETAIL && typeof window.SITE_SHOP_DETAIL.confirmOrderWithCartItems === "function") {
      window.SITE_SHOP_DETAIL.confirmOrderWithCartItems = noop;
    }
    if (typeof window.confirmOrderWithCartItems === "function") {
      window.confirmOrderWithCartItems = noop;
    }
  });

  console.log("=== snippet + dispatcher v2.1 inject ===");
  await page.addScriptTag({ content: snippetCode });
  await sleep(500);
  await page.addScriptTag({ content: dispatcherCode });
  await sleep(500);

  const snippetStatus = await page.evaluate(() => window.coffeeNpayIntentPreview ? window.coffeeNpayIntentPreview.status() : null);
  console.log("snippet status:", JSON.stringify(snippetStatus, null, 2));

  // ── Scenario M-A: mobile button selector click (if exists)
  console.log("=== Scenario M-A: mobile NPay button click ===");
  const mobileBtnExists = btnProbe["._btn_mobile_npay"] !== null;
  if (mobileBtnExists) {
    console.log("→ ._btn_mobile_npay 존재, click 시도");
    try {
      await page.click("._btn_mobile_npay", { timeout: 5000 });
      console.log("click OK");
    } catch (e) {
      console.warn("click 실패:", e.message);
    }
  } else {
    console.log("→ ._btn_mobile_npay 부재, 직접 click event dispatch 시도");
    await page.evaluate(() => {
      // synthesize a mobile click target
      const el = document.createElement("a");
      el.className = "_btn_mobile_npay";
      el.style.cssText = "position:fixed;top:-100px;left:0;width:1px;height:1px;";
      document.body.appendChild(el);
      el.click();
      console.info("[playwright] synthetic ._btn_mobile_npay element click dispatched");
    });
  }
  await sleep(500);

  console.log("=== Scenario M-B: site 의 confirmOrderWithCartItems('npay') 직접 호출 (mobile path 의 main 흐름) ===");
  await page.evaluate(() => {
    if (window.SITE_SHOP_DETAIL && typeof window.SITE_SHOP_DETAIL.confirmOrderWithCartItems === "function") {
      window.SITE_SHOP_DETAIL.confirmOrderWithCartItems("npay", null, {});
    }
  });
  await sleep(500);

  await captureState(page, "after-mobile-click-t0.5s");

  console.log("=== mock funnel-capi key set (hex order_code) ===");
  await page.evaluate(() => {
    const ts = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const orderCode = "o" + ts + "abcdef0987654321";
    const eid = `InitiateCheckout.${orderCode}.aabbccddmobile${Math.random().toString(36).slice(2, 6)}`;
    sessionStorage.setItem(`funnelCapi::sent::${eid}`, "1");
    return orderCode;
  });

  console.log("=== 3초 wait (snippet retry tick + dispatcher v2.1 sweep) ===");
  await sleep(3000);
  const stateMobile = await captureState(page, "after-mobile-mock-3s");

  console.log("=== 최종 backend stats ===");
  const stats = await fetchBackendStats();
  const sw = stats.smoke_window_summary;
  console.log(JSON.stringify({
    enforce_inserted: stats.reject_counters?.enforce_inserted,
    enforce_deduped: stats.reject_counters?.enforce_deduped,
    total_rows: stats.total_rows,
    rows_with_imweb_order_code: stats.rows_with_imweb_order_code,
    smoke_window: sw,
  }, null, 2));

  console.log("=== Network log ===");
  console.log(JSON.stringify(networkLog, null, 2));

  await browser.close();
  console.log("\n=== DONE (mobile) ===");

  return {
    device: "iPhone 14",
    button_probe: btnProbe,
    snippet_status: snippetStatus,
    state_mobile: stateMobile,
    backend_stats: {
      enforce_inserted: stats.reject_counters?.enforce_inserted,
      enforce_deduped: stats.reject_counters?.enforce_deduped,
      total_rows: stats.total_rows,
      rows_with_imweb_order_code: stats.rows_with_imweb_order_code,
      smoke_window: sw,
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
