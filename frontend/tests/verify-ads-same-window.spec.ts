import { test, expect } from "@playwright/test";

// gpt0508-52: /ads/google · /ads/tiktok · /ads (Meta) same-window chip live.
// chip 텍스트 polling — evidence-join script spawn 대기 (캐시 채워지면 cached).

test("/ads/google — same-window 진짜 ROAS chip", async ({ page }) => {
  test.setTimeout(180000);
  await page.goto("http://localhost:7010/ads/google", { waitUntil: "domcontentloaded" });
  await expect(page.locator("body")).toContainText("진짜 ROAS (evidence-join", { timeout: 150000 });
  const body = await page.locator("body").innerText();
  expect(body).toContain("paid_google");
  expect(body).toMatch(/윈도우\s*\d{4}-\d{2}-\d{2}\s*~\s*\d{4}-\d{2}-\d{2}/);
  await page.screenshot({ path: "/tmp/ads-google-same-window.png", fullPage: false });
});

test("/ads/tiktok — same-window 진짜 ROAS chip", async ({ page }) => {
  test.setTimeout(240000);
  await page.goto("http://localhost:7010/ads/tiktok", { waitUntil: "domcontentloaded" });
  await expect(page.locator("body")).toContainText("진짜 ROAS (evidence-join", { timeout: 200000 });
  const body = await page.locator("body").innerText();
  expect(body).toContain("paid_tiktok");
  expect(body).toMatch(/윈도우\s*\d{4}-\d{2}-\d{2}\s*~\s*\d{4}-\d{2}-\d{2}/);
  await page.screenshot({ path: "/tmp/ads-tiktok-same-window.png", fullPage: false });
});

test("/ads (Meta) — same-window 진짜 ROAS chip", async ({ page }) => {
  test.setTimeout(180000);
  await page.goto("http://localhost:7010/ads", { waitUntil: "domcontentloaded" });
  await expect(page.locator("body")).toContainText("진짜 ROAS (evidence-join", { timeout: 150000 });
  const body = await page.locator("body").innerText();
  expect(body).toContain("paid_meta");
  await page.screenshot({ path: "/tmp/ads-meta-same-window.png", fullPage: false });
});
