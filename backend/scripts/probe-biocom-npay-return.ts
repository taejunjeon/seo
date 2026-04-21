import path from "node:path";

// biocom NPay return URL 구조 조사 스크립트
// 2026-04-21. NPay 결제 후 biocom.kr 복귀 안 함 문제의 원인 조사.
// Playwright 로 제품 상세 페이지 접속 → NPay 관련 DOM / script / form / config 수집

const RUN = async () => {
  const { chromium } = await import("/Users/vibetj/coding/seo/frontend/node_modules/playwright/index.mjs");

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  });
  const page = await ctx.newPage();

  // NPay 관련 network 요청 추적
  const npayRequests: Array<{ url: string; method: string; headers: Record<string, string>; postData?: string | null }> = [];
  page.on("request", (req) => {
    const url = req.url();
    if (/pay\.naver\.com|naverpay|NPAY|returnUrl|callbackUrl|naver/i.test(url) || /npay|NPAY/i.test(req.postData() || "")) {
      npayRequests.push({
        url,
        method: req.method(),
        headers: req.headers(),
        postData: req.postData() ? (req.postData() || "").substring(0, 800) : null,
      });
    }
  });

  const productUrl = "https://biocom.kr/HealthFood/?idx=386";
  console.log(`\n=== Loading ${productUrl} ===`);
  try {
    await page.goto(productUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
  } catch (e: any) {
    console.log("goto error:", e.message);
  }
  await page.waitForTimeout(4000); // npay button.js 로드 대기

  // 1) NPay 관련 DOM elements
  const npayDom = await page.evaluate(() => {
    const result: any = { npayLinks: [], npayForms: [], npaySdkVariables: {}, naverPayButtonScript: null };
    // NPAY_BUY_LINK_IDNC_ID_ 패턴 찾기
    document.querySelectorAll("[id^='NPAY_BUY_LINK_IDNC_ID_']").forEach((el) => {
      result.npayLinks.push({
        id: el.id,
        tagName: el.tagName,
        href: (el as HTMLAnchorElement).href || null,
        outerHTML: el.outerHTML.substring(0, 500),
      });
    });
    // form
    document.querySelectorAll("form").forEach((f) => {
      const action = f.getAttribute("action") || "";
      if (/naver|pay/i.test(action) || /naver|pay/i.test(f.id || "")) {
        result.npayForms.push({
          id: f.id,
          action,
          method: f.method,
          fields: Array.from(f.elements).map((el: any) => ({ name: el.name, type: el.type, value: el.value?.substring?.(0, 200) })),
        });
      }
    });
    // global NPay SDK variables
    const candidates = [
      "Naver", "naver", "npay", "NaverPay", "NAVER_PAY",
      "GLOBAL_NAVER_PAY", "NPAY_CONFIG", "NPAY_BUY_BUTTON_OPTIONS",
      "returnUrl", "callbackUrl"
    ];
    for (const k of candidates) {
      try {
        const v = (window as any)[k];
        if (typeof v !== "undefined") {
          result.npaySdkVariables[k] = typeof v === "object" ? "[Object]" : String(v).substring(0, 200);
        }
      } catch {}
    }
    // innerNaverPayButton.js URL 확인
    document.querySelectorAll("script[src]").forEach((s) => {
      const src = (s as HTMLScriptElement).src;
      if (/naverpay/i.test(src) || /pay\.naver\.com/i.test(src)) {
        result.naverPayButtonScript = src;
      }
    });
    return result;
  });

  console.log("\n=== NPay DOM elements ===");
  console.log(`  npayLinks:`, npayDom.npayLinks.length);
  for (const el of npayDom.npayLinks) {
    console.log(`    ${el.id} tag=${el.tagName}`);
    console.log(`      href=${el.href}`);
    console.log(`      html=${el.outerHTML.substring(0, 300)}`);
  }
  console.log(`  npayForms:`, npayDom.npayForms.length);
  for (const f of npayDom.npayForms) {
    console.log(`    id=${f.id} action=${f.action} method=${f.method}`);
    for (const fld of f.fields || []) {
      console.log(`      ${fld.name} (${fld.type}) = ${fld.value}`);
    }
  }
  console.log(`  naverPayButtonScript:`, npayDom.naverPayButtonScript);
  console.log(`  global NPay variables:`, Object.keys(npayDom.npaySdkVariables));

  // 2) innerNaverPayButton.js 소스 직접 fetch (가능하면)
  if (npayDom.naverPayButtonScript) {
    try {
      const r = await fetch(npayDom.naverPayButtonScript);
      const text = await r.text();
      const relevantMatch = text.match(/returnUrl|callbackUrl|complete_url|success_url|shop_payment_complete/gi);
      console.log(`\n=== naverPayButton.js fetched (${text.length} bytes) ===`);
      console.log(`  matches for returnUrl/callbackUrl: ${relevantMatch?.length ?? 0}`);
      // snippet around 'returnUrl'
      const idx = text.search(/returnUrl/i);
      if (idx >= 0) console.log(`  snippet: ${text.substring(Math.max(0, idx - 80), idx + 240)}`);
    } catch (e: any) {
      console.log("  fetch error:", e.message);
    }
  }

  // 3) 페이지 source 에서 NPay config 검색
  const html = await page.content();
  const npayConfigs = html.match(/NPAY[A-Z_]*\s*=\s*[^;<]+/gi) || [];
  const naverPayButtons = html.match(/innerNaverPayButton|createNaverPayButton|openNaverPay/gi) || [];
  const returnUrlMatches = html.match(/returnUrl[\s:='"]+[^\s"<>]+/gi) || [];
  console.log(`\n=== HTML source NPay patterns ===`);
  console.log(`  NPAY_* assigns:`, npayConfigs.slice(0, 5));
  console.log(`  naverPay button calls:`, naverPayButtons.slice(0, 5));
  console.log(`  returnUrl matches:`, returnUrlMatches.slice(0, 5));

  // 4) biocom.kr/shop_view/?idx=386 의 iframe 안의 npay 버튼도 있을 수 있음 - 일단 skip.

  // 5) 관측한 network request
  console.log(`\n=== NPay-related network requests (during page load) ===`);
  for (const req of npayRequests) {
    console.log(`  ${req.method} ${req.url.substring(0, 150)}`);
    if (req.postData) console.log(`    postData: ${req.postData.substring(0, 200)}`);
  }

  await browser.close();
  console.log("\ndone.");
};

RUN().catch((e) => {
  console.error("FATAL:", e.message);
  process.exit(1);
});
