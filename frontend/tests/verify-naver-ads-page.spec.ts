import { test, expect } from "@playwright/test";

test("AI CRM page — 네이버 광고 분석 카드 존재", async ({ page }) => {
  test.setTimeout(30000);
  await page.goto("http://localhost:7010/?tab=crm#ai-crm", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  const link = page.locator("a[href='/ads/naver']");
  await expect(link).toBeVisible({ timeout: 5000 });
  const text = await link.innerText();
  expect(text).toContain("네이버 광고 분석");
});

test("/ads/naver — 캠페인별 ROAS / 광고비 / 네이버 주장 매출 노출", async ({ page }) => {
  test.setTimeout(60000);
  await page.goto("http://localhost:7010/ads/naver", { waitUntil: "domcontentloaded" });
  await page.waitForResponse((r) => r.url().includes("/api/ads/naver/campaign-summary"), { timeout: 20000 });
  await page.waitForTimeout(800);

  const bodyText = await page.locator("body").innerText();
  // 전체 KPI 카드
  expect(bodyText).toContain("전체 광고비");
  expect(bodyText).toContain("네이버 주장 매출");
  expect(bodyText).toContain("네이버 주장 ROAS");
  expect(bodyText).toContain("활성 캠페인");
  // 광고비 (7일 default) — ₩만 단위로 등장
  expect(bodyText).toMatch(/₩\d+만|₩\d+억/);
  // 캠페인별 표 헤더
  expect(bodyText).toContain("캠페인별 ROAS");
  // 적어도 1개 캠페인 row
  expect(bodyText).toContain("바이오컴");

  await page.screenshot({ path: "/tmp/naver-ads-page.png", fullPage: true });
});
