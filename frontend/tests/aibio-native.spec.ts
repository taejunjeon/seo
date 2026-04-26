import { expect, test } from "@playwright/test";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:7010";

test.describe("AIBIO native MVP", () => {
  test("공개 홈페이지 MVP와 상담 폼이 동작한다", async ({ page }) => {
    await page.goto(`${BASE}/aibio-native`);

    await expect(page.getByRole("heading", { name: /상담 예약부터 방문 전환까지/ })).toBeVisible();
    await expect(page.getByRole("link", { name: "카카오 상담" })).toHaveAttribute("href", /pf\.kakao\.com/);
    await expect(page.getByRole("heading", { name: /폼 제출에서 결제까지/ })).toBeVisible();

    await page.getByLabel("이름").fill("테스트");
    await page.getByLabel("연락처").fill("010-0000-0000");
    await page.getByLabel("나이대").selectOption("30s");
    await page.getByLabel("상담 목적").selectOption("metabolism");
    await page.getByLabel("알게 된 경로").selectOption("instagram");
    await page.getByLabel("연락 희망 시간").selectOption("afternoon");
    await page.getByLabel("개인정보 수집 및 상담 연락에 동의합니다.").check();
    await page.getByRole("button", { name: "상담 신청 임시 저장" }).click();

    await expect(page.getByText(/원문 연락처 저장 없이 접수 초안/)).toBeVisible({ timeout: 10000 });
  });

  test("lead draft API는 전화번호 원문을 응답하지 않는다", async ({ request }) => {
    const response = await request.post(`${BASE}/api/aibio-native/lead-draft`, {
      data: {
        name: "테스트",
        phone: "010-0000-0000",
        ageRange: "30s",
        purpose: "metabolism",
        channel: "instagram",
        preferredTime: "afternoon",
        consent: true,
        landingPath: "/aibio-native",
      },
    });

    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.mode).toBe("dry_run_no_persistence");
    expect(body.phoneHashSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(body)).not.toContain("010-0000-0000");
    expect(JSON.stringify(body)).not.toContain("테스트");
  });
});
