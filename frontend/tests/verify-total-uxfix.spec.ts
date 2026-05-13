import { test, expect } from "@playwright/test";

test("total page — query button color + spinner + dataDimmed", async ({ page }) => {
  await page.goto("http://localhost:7010/total", { waitUntil: "domcontentloaded" });
  await page.waitForSelector("button", { timeout: 5000 });

  const btn = page.locator("button", { hasText: "조회" });
  await expect(btn).toBeVisible();

  // 색상 확인
  const bgColor = await btn.evaluate((el) => getComputedStyle(el).backgroundColor);
  const txtColor = await btn.evaluate((el) => getComputedStyle(el).color);
  const w = await btn.evaluate((el) => (el as HTMLElement).offsetWidth);
  const h = await btn.evaluate((el) => (el as HTMLElement).offsetHeight);
  console.log(`btn bg=${bgColor} txt=${txtColor} size=${w}x${h}`);

  // 클래스 확인
  const cls = await btn.evaluate((el) => el.className);
  console.log(`btn class=${cls}`);

  // 스크린샷 (조회 버튼 영역만)
  await btn.screenshot({ path: "/tmp/query-btn.png" });

  // 클릭 → loading + dataDimmed 확인
  await btn.click();
  await page.waitForTimeout(500); // loading 상태 잠시 캡쳐
  const hasSpinner = await page.locator(".page-module__-uFW5a__spinner, [class*='spinner']").count();
  console.log(`spinner count=${hasSpinner}`);
  const dimmed = await page.locator("[class*='dataDimmed']").count();
  console.log(`dataDimmed div count=${dimmed}`);

  // 로딩 메시지 텍스트 확인
  const loadingText = await page.locator("[class*='loading']").first().innerText().catch(() => "");
  console.log(`loading text="${loadingText.slice(0, 120)}"`);

  // 전체 페이지 스크린샷
  await page.screenshot({ path: "/tmp/total-after-fix.png", fullPage: true });
});
