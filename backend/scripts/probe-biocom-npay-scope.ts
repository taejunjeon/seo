// biocom.kr 카테고리별 NPay 버튼 유무 조사
// 2026-04-22. TJ 요청: NPay 가 건기식에만 달려있는지 확인.

const RUN = async () => {
  const { chromium } = await import("/Users/vibetj/coding/seo/frontend/node_modules/playwright/index.mjs");
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  });

  // 1) biocom.kr 홈 → 카테고리 메뉴 추출
  const page = await ctx.newPage();
  await page.goto("https://biocom.kr/", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2500);

  // 메뉴에서 카테고리 링크 수집
  const categories = await page.evaluate(() => {
    const links: Array<{ text: string; href: string }> = [];
    document.querySelectorAll("a[href]").forEach((el) => {
      const a = el as HTMLAnchorElement;
      const href = a.href;
      if (!href || !/biocom\.kr/.test(href)) return;
      if (/#|javascript:/.test(href)) return;
      const text = (a.innerText || a.textContent || "").trim().substring(0, 40);
      if (!text || text.length === 0) return;
      // 중복 제거 (URL 기준)
      if (links.some((l) => l.href === href)) return;
      links.push({ text, href });
    });
    return links;
  });

  // 카테고리성 URL 패턴 필터
  const catCandidates = categories
    .filter((l) => /\/(shop|HealthFood|DietMealBox|supplements|examination|consultation|reservation|goods|category|class|test|kit|diet|breakfast|lunch|snack)/i.test(l.href) && !/shop_view/.test(l.href))
    .slice(0, 25);

  console.log("=== biocom.kr 메인에서 추출한 카테고리 후보 ===");
  for (const c of catCandidates) console.log(`  ${c.text.padEnd(20)} ${c.href}`);

  // 2) 주요 카테고리 대표 페이지 수동 선별 + NPay 버튼 유무 검사
  const sampleUrls = [
    // 이미 관찰된 페이지
    { label: "HealthFood/메타드림 멜라토닌", url: "https://biocom.kr/HealthFood/?idx=386" },
    { label: "DietMealBox/(테스트 상품)", url: "https://biocom.kr/DietMealBox/?idx=424" },
    // 메인 카테고리 URL
    { label: "HealthFood 리스트", url: "https://biocom.kr/HealthFood" },
    { label: "DietMealBox 리스트", url: "https://biocom.kr/DietMealBox" },
    { label: "supplements", url: "https://biocom.kr/supplements" },
    { label: "examination (검사)", url: "https://biocom.kr/examination" },
    // 상품 상세 — 대표 카테고리별
    { label: "shop_view/?idx=171 (가상계좌 테스트)", url: "https://biocom.kr/shop_view/?idx=171" },
    { label: "shop_view/?idx=97 (카드 테스트 11,900원)", url: "https://biocom.kr/shop_view/?idx=97" },
    { label: "shop_view/?idx=424 (DietMealBox 421건 팀키토)", url: "https://biocom.kr/shop_view/?idx=424" },
  ];

  const report: Array<{
    label: string;
    url: string;
    httpStatus: number;
    npayButtonCount: number;
    npayButtonSelectors: string[];
    hasNpayClass: boolean;
    hasNaverPayScript: boolean;
    hasBuyButton: boolean;
    pageTitle: string;
    notes: string;
  }> = [];

  for (const s of sampleUrls) {
    const p = await ctx.newPage();
    try {
      const resp = await p.goto(s.url, { waitUntil: "domcontentloaded", timeout: 25000 });
      await p.waitForTimeout(3000);
      const info = await p.evaluate(() => {
        const npayEls = Array.from(document.querySelectorAll("[id^='NPAY_BUY_LINK_IDNC_ID_']"));
        const hasClass = !!document.querySelector(".npay_btn_link, .npay_btn_pay, .npay_blind, .npay_logo");
        const hasScript = !!Array.from(document.querySelectorAll("script[src]")).find((s) => /naverpay|pay\.naver\.com/i.test((s as HTMLScriptElement).src));
        const buyBtn = !!document.querySelector("[class*='buy'], [class*='purchase'], [id*='buy']");
        return {
          npayButtonCount: npayEls.length,
          npayButtonSelectors: npayEls.slice(0, 3).map((el) => el.id),
          hasNpayClass: hasClass,
          hasNaverPayScript: hasScript,
          hasBuyButton: buyBtn,
          pageTitle: document.title || "",
        };
      });
      report.push({
        label: s.label,
        url: s.url,
        httpStatus: resp?.status() || 0,
        ...info,
        notes: info.npayButtonCount > 0 ? "NPay 버튼 있음" : info.hasNpayClass || info.hasNaverPayScript ? "NPay SDK/class 로드되나 버튼 없음 (목록/카테고리?)" : "NPay 없음",
      });
    } catch (e: any) {
      report.push({
        label: s.label,
        url: s.url,
        httpStatus: 0,
        npayButtonCount: 0,
        npayButtonSelectors: [],
        hasNpayClass: false,
        hasNaverPayScript: false,
        hasBuyButton: false,
        pageTitle: "",
        notes: `ERR: ${e.message}`,
      });
    } finally {
      await p.close();
    }
  }

  console.log("\n=== 카테고리별 NPay 버튼 유무 ===");
  console.log(`${"label".padEnd(40)} ${"status".padStart(6)} ${"npay".padStart(5)} ${"sdk".padStart(4)} ${"note"}`);
  console.log("-".repeat(95));
  for (const r of report) {
    console.log(`${r.label.padEnd(40)} ${String(r.httpStatus).padStart(6)} ${String(r.npayButtonCount).padStart(5)} ${r.hasNaverPayScript ? "yes" : "no "} ${r.notes}`);
  }

  console.log("\n=== 요약 ===");
  const hasNpay = report.filter((r) => r.npayButtonCount > 0);
  const noNpay = report.filter((r) => r.npayButtonCount === 0 && r.httpStatus === 200);
  console.log(`  NPay 버튼 있음 (${hasNpay.length}개): ${hasNpay.map((r) => r.label).join(", ")}`);
  console.log(`  NPay 버튼 없음 (${noNpay.length}개): ${noNpay.map((r) => r.label).join(", ")}`);

  await browser.close();
};

RUN().catch((e) => {
  console.error("FATAL:", e.message);
  process.exit(1);
});
