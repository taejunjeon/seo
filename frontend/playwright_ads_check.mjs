import { chromium } from "playwright";

const URL = "https://biocom.ainativeos.net/ads";
const TIMEOUT_MS = 90_000;

const result = {
  url: URL,
  loaded: false,
  console_errors: [],
  page_requests_500_502: [],
  date_presets_visible: [],
  campaign_count_or_msg: "(미수집)",
  bicocom_detail_visible: false,
  insights_request_status: null,
  campaign_ltv_roas_status: null,
  campaigns_health_status: null,
  screenshot: null,
};

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext();
const page = await ctx.newPage();

page.on("console", (msg) => {
  if (msg.type() === "error") {
    result.console_errors.push(msg.text().slice(0, 300));
  }
});
page.on("response", (resp) => {
  const url = resp.url();
  const status = resp.status();
  if (status >= 500 && (url.includes("/api/") || url.includes("att.ainativeos.net"))) {
    result.page_requests_500_502.push({ url: url.slice(0, 150), status });
  }
  if (url.includes("/api/meta/insights")) result.insights_request_status = status;
  if (url.includes("/api/ads/campaign-ltv-roas")) result.campaign_ltv_roas_status = status;
  if (url.includes("/api/meta/campaigns/health")) result.campaigns_health_status = status;
});

try {
  await page.goto(URL, { waitUntil: "networkidle", timeout: TIMEOUT_MS });
  result.loaded = true;

  // 캠페인 행이 렌더될 때까지 최대 25초 대기 (network idle 후에도 React state 갱신 시간)
  await page.waitForTimeout(20000);

  // date preset 옵션 확인 — DATE_PRESETS 버튼 텍스트
  const presetTexts = await page.$$eval(
    "button, [role='option']",
    (els) => els.map((e) => e.textContent?.trim() ?? "").filter((t) => t.length > 0 && t.length < 20),
  );
  const filtered = presetTexts.filter((t) =>
    t === "오늘" || t === "어제" || t.startsWith("최근"),
  );
  result.date_presets_visible = [...new Set(filtered)];

  // 캠페인 행 수 (테이블의 tr) 또는 "캠페인 없음" 텍스트
  const noCampaign = await page.locator("text=캠페인 없음").count();
  if (noCampaign > 0) {
    result.campaign_count_or_msg = "❌ 캠페인 없음 표시됨";
  } else {
    // table row 수 추정
    const rows = await page.locator("table tbody tr").count();
    result.campaign_count_or_msg = `✅ ${rows}개 table row 표시`;
  }

  // 바이오컴 상세 섹션 가시성
  const detail = await page.locator("text=바이오컴 상세").count();
  result.bicocom_detail_visible = detail > 0;

  // 스크린샷
  result.screenshot = "/tmp/playwright_ads_screenshot.png";
  await page.screenshot({ path: result.screenshot, fullPage: false });
} catch (err) {
  result.error = err instanceof Error ? err.message : String(err);
} finally {
  await browser.close();
}

console.log(JSON.stringify(result, null, 2));
