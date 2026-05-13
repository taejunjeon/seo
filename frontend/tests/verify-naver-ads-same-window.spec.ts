import { test, expect } from "@playwright/test";

test("/ads/naver — 진짜 ROAS same-window 확인 banner + warning 사라짐", async ({ page }) => {
  test.setTimeout(120000);
  await page.goto("http://localhost:7010/ads/naver", { waitUntil: "domcontentloaded" });
  // evidence-join script 가 spawn 되므로 응답이 최대 90초까지 걸릴 수 있음
  await page.waitForResponse((r) => r.url().includes("/api/ads/naver/campaign-summary"), { timeout: 100000 });
  await page.waitForTimeout(1200);

  const bodyText = await page.locator("body").innerText();
  // same-window 확인 chip
  expect(bodyText).toContain("같은 윈도우");
  expect(bodyText).toMatch(/2026-\d{2}-\d{2}\s*~\s*2026-\d{2}-\d{2}/);
  // mismatch warning 사라짐 (월 단위 합산 문구 없음)
  expect(bodyText).not.toContain("월 단위 합산");
  // 진짜 ROAS 카드 값
  expect(bodyText).toContain("진짜 ROAS");

  await page.screenshot({ path: "/tmp/naver-ads-same-window.png", fullPage: true });
});
