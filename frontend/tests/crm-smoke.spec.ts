import { test, expect } from "@playwright/test";

const BASE = "http://localhost:7010";

test.describe("CRM 관리 허브 — 더클린커피 스모크 테스트", () => {
  test("재구매 관리 탭 로드", async ({ page }) => {
    await page.goto(`${BASE}/crm?site=thecleancoffee&tab=repurchase`);
    await expect(page.locator("h2:has-text('재구매 관리')")).toBeVisible({ timeout: 15000 });
    await expect(page.locator("th:has-text('고객번호')")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("th:has-text('고객명')")).toBeVisible();
  });

  test("A/B 테스트 유형 선택 버튼", async ({ page }) => {
    await page.goto(`${BASE}/crm?site=thecleancoffee&tab=repurchase`);
    await expect(page.locator("h2:has-text('A/B 테스트')")).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole("button", { name: "SMS vs 알림톡", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "동의 vs 미동의", exact: true })).toBeVisible();
  });

  test("고객 그룹 탭 로드", async ({ page }) => {
    await page.goto(`${BASE}/crm?site=thecleancoffee&tab=groups`);
    await expect(page.locator("h2:has-text('고객 그룹 목록')")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("th:has-text('그룹명')")).toBeVisible();
  });

  test("고객 그룹 — 신규그룹 만들기", async ({ page }) => {
    await page.goto(`${BASE}/crm?site=thecleancoffee&tab=groups`);
    await expect(page.locator("h2:has-text('고객 그룹 목록')")).toBeVisible({ timeout: 10000 });
    await page.locator("button:has-text('신규그룹 만들기')").click();
    await expect(page.locator("input[placeholder*='그룹명']")).toBeVisible({ timeout: 5000 });
  });

  test("고객 목록 탭 로드", async ({ page }) => {
    await page.goto(`${BASE}/crm?site=thecleancoffee&tab=customers`);
    await expect(page.locator("h2:has-text('고객 목록')")).toBeVisible({ timeout: 15000 });
    await expect(page.locator("th:has-text('이메일')")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("th:has-text('누적구매금액')")).toBeVisible();
  });

  test("고객 행동 탭 + 세그먼트 조회", async ({ page }) => {
    await page.goto(`${BASE}/crm?site=thecleancoffee&tab=behavior`);
    await expect(page.locator("h2:has-text('고객 행동')")).toBeVisible({ timeout: 15000 });
    await expect(page.locator("td:has-text('재구매 하지 않음')")).toBeVisible();
    // 조회 클릭
    const queryBtn = page.locator("button:has-text('조회')").first();
    await queryBtn.click();
    await expect(page.locator("text=/총 \\d+명/")).toBeVisible({ timeout: 10000 });
  });

  test("알림톡 발송 탭 로드", async ({ page }) => {
    await page.goto(`${BASE}/crm?site=thecleancoffee&tab=messaging`);
    await expect(page.locator("text=카카오 알림톡").first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=SMS 문자").first()).toBeVisible();
  });

  test("그룹 발송 모드 (groupId)", async ({ page }) => {
    // Phase D: 기본 /groups 응답이 kind='manual'만 리턴하므로 전체(`kind=all`)로 조회
    const groupsRes = await page.request.get("http://localhost:7020/api/crm-local/groups?kind=all");
    const groups = (await groupsRes.json()).groups ?? [];
    test.skip(groups.length === 0, "그룹 없음");
    const groupId = groups[0].group_id;
    await page.goto(`${BASE}/crm?site=thecleancoffee&tab=messaging&groupId=${groupId}&channel=sms&adminOverride=true`);
    await expect(page.locator("text=그룹 발송 모드")).toBeVisible({ timeout: 10000 });
  });
});
