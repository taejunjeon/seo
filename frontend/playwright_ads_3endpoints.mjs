import { chromium } from "playwright";

const URL = "https://biocom.ainativeos.net/ads";
const TIMEOUT_MS = 90_000;

const result = {
  url: URL,
  loaded: false,
  // 3 endpoints 가 사용자 지정 범위로 호출됐는지
  campaigns_health_with_start_date: false,
  capi_log_with_start_date: false,
  caller_coverage_with_start_date: false,
  // 응답 status (마지막)
  campaigns_health_status: null,
  capi_log_status: null,
  caller_coverage_status: null,
  // 모든 요청 URL 시간순 기록 (디버깅)
  campaigns_health_urls: [],
  capi_log_urls: [],
  caller_coverage_urls: [],
  screenshot: "/tmp/playwright_ads_3ep.png",
};

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext();
const page = await ctx.newPage();

page.on("request", (req) => {
  const url = req.url();
  if (url.includes("/api/meta/campaigns/health")) result.campaigns_health_urls.push(url.slice(0, 250));
  if (url.includes("/api/meta/capi/log")) result.capi_log_urls.push(url.slice(0, 250));
  if (url.includes("/api/attribution/caller-coverage")) result.caller_coverage_urls.push(url.slice(0, 250));
});
page.on("response", (resp) => {
  const u = resp.url();
  const s = resp.status();
  if (u.includes("/api/meta/campaigns/health")) result.campaigns_health_status = s;
  if (u.includes("/api/meta/capi/log")) result.capi_log_status = s;
  if (u.includes("/api/attribution/caller-coverage")) result.caller_coverage_status = s;
});

try {
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: TIMEOUT_MS });
  result.loaded = true;
  await page.waitForLoadState("networkidle", { timeout: TIMEOUT_MS }).catch(() => {});
  await page.waitForTimeout(3000);

  // 사용자 지정 버튼 클릭
  const customBtn = page.locator("button:has-text(\"사용자 지정\")");
  if (await customBtn.count() > 0) {
    await customBtn.first().click();
    await page.waitForTimeout(1000);
    const startInput = page.locator("input[type='date']").nth(0);
    const endInput = page.locator("input[type='date']").nth(1);
    await startInput.fill("2026-05-01");
    await endInput.fill("2026-05-10");
    // 데이터 fetch 대기 (3개 endpoint 새 dateQuery 로 호출)
    await page.waitForTimeout(20000);
  }

  // 잡힌 URL 들 중 하나라도 start_date 가지고 있는지
  result.campaigns_health_with_start_date = result.campaigns_health_urls.some((u) => u.includes("start_date=2026-05-01"));
  result.capi_log_with_start_date = result.capi_log_urls.some((u) => u.includes("start_date=2026-05-01"));
  result.caller_coverage_with_start_date = result.caller_coverage_urls.some((u) => u.includes("start_date=2026-05-01"));

  await page.screenshot({ path: result.screenshot, fullPage: false });
} catch (err) {
  result.error = err instanceof Error ? err.message : String(err);
} finally {
  await browser.close();
}

console.log(JSON.stringify(result, null, 2));
