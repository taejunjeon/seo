import { test, expect } from "@playwright/test";

test("/ads/naver — 진짜 ROAS + over-claim + 컨트롤 강화", async ({ page }) => {
  test.setTimeout(120000);
  await page.goto("http://localhost:7010/ads/naver", { waitUntil: "domcontentloaded" });
  // gpt0508-50: evidence-join script spawn 으로 응답이 최대 90초까지 걸릴 수 있음
  await page.waitForResponse((r) => r.url().includes("/api/ads/naver/campaign-summary"), { timeout: 100000 });
  await page.waitForTimeout(1200);

  const bodyText = await page.locator("body").innerText();
  expect(bodyText).toContain("진짜 ROAS");
  expect(bodyText).toContain("과대 주장");
  expect(bodyText).toContain("최근 7일");
  expect(bodyText).toContain("최근 30일");
  expect(bodyText).toContain("최근 90일");
  expect(bodyText).toContain("광고비 0 숨김");
  expect(bodyText).toContain("CSV");
  expect(bodyText).toMatch(/\d+\.\d+x/); // ROAS x
  expect(bodyText).toContain("내부 paid_naver");

  await page.screenshot({ path: "/tmp/naver-ads-real-roas.png", fullPage: true });
});
