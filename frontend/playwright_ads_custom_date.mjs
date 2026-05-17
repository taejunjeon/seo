import { chromium } from "playwright";

const URL = "https://biocom.ainativeos.net/ads";
const TIMEOUT_MS = 90_000;

const result = {
  url: URL,
  loaded: false,
  console_errors: [],
  // 사용자 지정 버튼/입력 가시성
  custom_button_visible: false,
  date_inputs_visible_after_click: false,
  // 입력 후 fetch 가 start_date/end_date 로 가는지
  requests_with_start_date: [],
  requests_with_date_preset_only: [],
  // 적용 후 라벨 변화
  range_label_shown: null,
  screenshot_initial: "/tmp/playwright_ads_initial.png",
  screenshot_custom: "/tmp/playwright_ads_custom.png",
};

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext();
const page = await ctx.newPage();

page.on("console", (msg) => {
  if (msg.type() === "error") {
    result.console_errors.push(msg.text().slice(0, 200));
  }
});
page.on("request", (req) => {
  const url = req.url();
  if (url.includes("/api/") && (url.includes("/ads/") || url.includes("/meta/"))) {
    if (url.includes("start_date=")) result.requests_with_start_date.push(url.slice(0, 180));
    else if (url.includes("date_preset=")) result.requests_with_date_preset_only.push(url.slice(0, 180));
  }
});

try {
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: TIMEOUT_MS });
  result.loaded = true;
  await page.waitForLoadState("networkidle", { timeout: TIMEOUT_MS }).catch(() => {});
  await page.waitForTimeout(3000);

  // 1) "사용자 지정" 버튼이 보이는지
  const customBtn = page.locator("button:has-text(\"사용자 지정\")");
  result.custom_button_visible = (await customBtn.count()) > 0;

  await page.screenshot({ path: result.screenshot_initial, fullPage: false });

  // 2) 클릭 → date input 2개 등장
  if (result.custom_button_visible) {
    await customBtn.first().click();
    await page.waitForTimeout(1000);
    const dateInputs = await page.locator("input[type='date']").count();
    result.date_inputs_visible_after_click = dateInputs >= 2;

    // 3) 2026-05-01 ~ 2026-05-10 입력
    if (dateInputs >= 2) {
      // request 기록 초기화 (페이지 로드 시 fired 된 것은 제외하기 위함은 X — 이미 누적, 그대로 OK)
      const startInput = page.locator("input[type='date']").nth(0);
      const endInput = page.locator("input[type='date']").nth(1);
      await startInput.fill("2026-05-01");
      await endInput.fill("2026-05-10");
      // 입력 후 useCallback 의존성이 변해서 fetch 새로 발생
      await page.waitForTimeout(15000);

      // 4) "2026-05-01 ~ 2026-05-10" 라벨이 본문 어딘가에 보이는지
      const labelLocator = page.locator("text=2026-05-01 ~ 2026-05-10");
      result.range_label_shown = (await labelLocator.count()) > 0;

      await page.screenshot({ path: result.screenshot_custom, fullPage: false });
    }
  }
} catch (err) {
  result.error = err instanceof Error ? err.message : String(err);
} finally {
  await browser.close();
}

console.log(JSON.stringify(result, null, 2));
