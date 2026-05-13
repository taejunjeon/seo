import { test, expect } from "@playwright/test";

// gpt0508-53: /ads/google progress panel + 단계명 + 옛 값 유지.

test("/ads/google — initial load progress panel renders with stage labels", async ({ page }) => {
  test.setTimeout(60000);
  // 데이터 도착 전 progress panel 캡쳐 — request 를 의도적으로 지연
  await page.route("**/api/google-ads/dashboard*", async (route) => {
    await new Promise((r) => setTimeout(r, 8000));
    await route.continue();
  });
  await page.goto("http://localhost:7010/ads/google", { waitUntil: "domcontentloaded" });
  await expect(page.locator("body")).toContainText("Google Ads 데이터 불러오는 중", { timeout: 5000 });
  await expect(page.locator("body")).toContainText("Google Ads campaign metrics 조회");
  await expect(page.locator("body")).toContainText("conversion_action / conversion value 조회");
  await expect(page.locator("body")).toContainText("내부 confirmed revenue 조회");
  await expect(page.locator("body")).toContainText("NPay actual correction 조회");
  await expect(page.locator("body")).toContainText("ROAS gap 계산");
  await expect(page.locator("body")).toContainText("source freshness");
  // 진행률 숫자 (% 표시)
  await expect(page.locator("body")).toContainText(/[1-9]\d?%/);
  await page.screenshot({ path: "/tmp/ads-google-progress.png", fullPage: false });
});

test("/ads/google — 옛 값 유지 (refresh during loading, mocked)", async ({ page }) => {
  test.setTimeout(60000);
  // 첫 fetch: 즉시 mock 응답
  const mockResponse = {
    ok: true,
    fetchedAt: "2026-05-14T00:00:00.000Z",
    apiVersion: "v22",
    customerId: "2149990943",
    datePreset: "last_30d",
    dateRangeLiteral: "LAST_30_DAYS",
    customer: { resourceName: "customers/2149990943", id: "2149990943", descriptiveName: "바이오컴", manager: false, testAccount: false, status: "ENABLED" },
    source: "google_ads_api",
    summary: { cost: 1234567, impressions: 100000, clicks: 5000, conversions: 30, conversionValue: 8000000, allConversions: 30, allConversionValue: 8000000, viewThroughConversions: 0, roas: 6.48, ctr: 0.05, cpc: 247, conversionRate: 0.006, cpa: 41152 },
    campaigns: [],
    daily: [],
    conversionActions: [],
    conversionActionSegments: null,
    internal: null,
    npayActualCorrection: null,
    serviceAccount: { clientEmail: "x@y", projectId: "z" },
  };
  let callCount = 0;
  await page.route("**/api/google-ads/dashboard*", async (route) => {
    callCount++;
    if (callCount === 1) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(mockResponse) });
    } else {
      // 두 번째 fetch 는 지연 → progress panel 가 노출
      await new Promise((r) => setTimeout(r, 6000));
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(mockResponse) });
    }
  });
  await page.goto("http://localhost:7010/ads/google", { waitUntil: "domcontentloaded" });
  // 첫 mock 도착 → summary cost=₩1,234,567 노출
  await expect(page.locator("body")).toContainText("₩1,234,567", { timeout: 15000 });

  // 7일 preset 클릭 → 지연된 두 번째 fetch 발동
  await page.getByRole("button", { name: "7일" }).click();
  // 옛 데이터 유지 + "새 데이터 조회 중" 헤더 노출
  await expect(page.locator("body")).toContainText("새 데이터 조회 중 (이전 값 유지)", { timeout: 5000 });
  // 옛 값 유지 — ₩1,234,567 여전히 화면에 (0 으로 리셋 금지)
  await expect(page.locator("body")).toContainText("₩1,234,567");
  await page.screenshot({ path: "/tmp/ads-google-refresh.png", fullPage: false });
});
