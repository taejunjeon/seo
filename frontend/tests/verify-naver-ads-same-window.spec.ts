import { test, expect } from "@playwright/test";

test("/ads/naver — 진짜 ROAS same-window 확인 banner + warning 사라짐", async ({ page }) => {
  test.setTimeout(240000);
  await page.goto("http://localhost:7010/ads/naver", { waitUntil: "domcontentloaded" });
  // chip 의 "같은 윈도우" 텍스트가 보일 때까지 polling (evidence-join spawn cold 시 최대 ~90s).
  await expect(page.locator("body")).toContainText("같은 윈도우", { timeout: 200000 });

  const bodyText = await page.locator("body").innerText();
  expect(bodyText).toMatch(/2026-\d{2}-\d{2}\s*~\s*2026-\d{2}-\d{2}/);
  // mismatch warning 사라짐 (월 단위 합산 문구 없음)
  expect(bodyText).not.toContain("월 단위 합산");
  expect(bodyText).toContain("진짜 ROAS");

  await page.screenshot({ path: "/tmp/naver-ads-same-window.png", fullPage: true });
});
