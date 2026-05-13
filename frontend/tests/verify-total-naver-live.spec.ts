import { test, expect } from "@playwright/test";

test("total page — Naver platform 카드 5월 live 활성화 확인 (naver_ads_daily 데이터 있는 month)", async ({ page }) => {
  test.setTimeout(90000);
  await page.goto("http://localhost:7010/total", { waitUntil: "domcontentloaded" });
  await page.waitForResponse((r) => r.url().includes("/api/total/monthly-channel-summary"), { timeout: 30000 });
  // 5월로 변경
  await page.locator("input[type='month']").fill("2026-05");
  await page.locator("button", { hasText: "조회" }).click();
  await page.waitForResponse(
    (r) => r.url().includes("month=2026-05") && r.url().includes("/api/total/monthly-channel-summary"),
    { timeout: 30000 },
  );
  await page.waitForTimeout(2000);

  const naverHeading = page.locator("h3", { hasText: "Naver" });
  await expect(naverHeading).toBeVisible({ timeout: 10000 });

  // page 전체 텍스트로 검증 (xpath ancestor 가 hash class 매칭 까다로움)
  const pageText = await page.locator("body").innerText();

  // Status badge — "연결됨" (joined) 확인
  expect(pageText).toContain("연결됨");

  // 핵심 값 확인
  expect(pageText).toContain("Naver 광고 (참고)");
  expect(pageText).toContain("₩170만"); // 광고비
  expect(pageText).toContain("₩3,150만"); // 네이버 주장 매출
  expect(pageText).toContain("18.54"); // 네이버 주장 ROAS

  // blocked 메시지 부재
  expect(pageText).not.toContain("Naver Ads source 는 아직 연결되지 않았습니다");

  console.log("--- Naver 카드 검증 PASS ---");

  await page.screenshot({ path: "/tmp/total-naver-live-may.png", fullPage: true });
});
