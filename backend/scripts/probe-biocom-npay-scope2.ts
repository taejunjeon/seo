// biocom.kr 카테고리별 NPay 버튼 2차 조사 — "검사" 계열 포함
const RUN = async () => {
  const { chromium } = await import("/Users/vibetj/coding/seo/frontend/node_modules/playwright/index.mjs");
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  });

  const samples = [
    // 검사/분석 계열
    { label: "igg_store (IgG 음식물 과민증 검사)", url: "https://biocom.kr/igg_store/?idx=85" },
    { label: "mineraltest_store (미네랄 검사)", url: "https://biocom.kr/mineraltest_store/?idx=6" },
    { label: "organicacid_store (유기산 검사)", url: "https://biocom.kr/organicacid_store/?idx=259" },
    { label: "microbiome (마이크로바이옴)", url: "https://biocom.kr/microbiome/?idx=12" },
    { label: "hormon_store (호르몬 검사)", url: "https://biocom.kr/hormon_store/?idx=219" },
    // 세트 / 정기구독
    { label: "biocomset_store (세트)", url: "https://biocom.kr/biocomset_store/?idx=328" },
    { label: "subscription (정기구독)", url: "https://biocom.kr/subscription/?idx=208" },
    { label: "all (전체)", url: "https://biocom.kr/all/?idx=31" },
    // shop_view 추가
    { label: "shop_view/?idx=369", url: "https://biocom.kr/shop_view/?idx=369" },
    // 건강정보(기사) — 판매 아님
    { label: "healthinfo (기사)", url: "https://biocom.kr/healthinfo/?idx=170935356" },
  ];

  console.log(`${"label".padEnd(40)} ${"status".padStart(6)} ${"npay".padStart(5)} ${"sdk".padStart(4)} ${"title".padStart(10)}`);
  console.log("-".repeat(120));

  for (const s of samples) {
    const p = await ctx.newPage();
    try {
      const resp = await p.goto(s.url, { waitUntil: "domcontentloaded", timeout: 25000 });
      await p.waitForTimeout(2500);
      const info = await p.evaluate(() => {
        const npay = Array.from(document.querySelectorAll("[id^='NPAY_BUY_LINK_IDNC_ID_']"));
        const hasSdk = !!Array.from(document.querySelectorAll("script[src]")).find((s) => /naverpay|pay\.naver\.com/i.test((s as HTMLScriptElement).src));
        return { npay: npay.length, sdk: hasSdk, title: (document.title || "").substring(0, 60) };
      });
      console.log(`${s.label.padEnd(40)} ${String(resp?.status() || 0).padStart(6)} ${String(info.npay).padStart(5)} ${info.sdk ? "yes" : "no "} ${info.title}`);
    } catch (e: any) {
      console.log(`${s.label.padEnd(40)} ${"ERR".padStart(6)} ${"0".padStart(5)} ${"-".padStart(4)} ${e.message.substring(0, 60)}`);
    } finally {
      await p.close();
    }
  }

  await browser.close();
};

RUN().catch((e) => { console.error(e.message); process.exit(1); });
