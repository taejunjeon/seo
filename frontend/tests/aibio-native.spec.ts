import { expect, test } from "@playwright/test";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:7010";

test.describe("AIBIO native MVP", () => {
  test("공개 홈페이지 MVP와 상담 폼이 동작한다", async ({ page }) => {
    await page.route("**/api/aibio/native-leads", async (route) => {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          mode: "local_sqlite_persistence",
          leadId: "aibio_native_test_001",
          receivedAt: "2026-04-26T09:30:00.000Z",
          nextStatus: "new",
          nextStatusLabel: "신규",
          duplicateOfLeadId: null,
          phoneHashSha256: "a".repeat(64),
          attributionKeys: ["fbclid", "utm_campaign", "utm_medium", "utm_source"],
        }),
      });
    });

    await page.goto(`${BASE}/aibio-native?utm_source=meta&utm_medium=paid_social&utm_campaign=aibio_native_test&fbclid=test_click_id`);

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
    await page.getByLabel("마케팅 정보 수신에 동의합니다. 선택 항목입니다.").check();
    await page.getByRole("button", { name: "상담 신청 저장" }).click();

    await expect(page.getByText(/운영 리드 원장에 저장되었습니다/)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/유입 키 \d+개 확인/)).toBeVisible();
  });

  test("/shop_view?idx=25 첫 실험 랜딩이 자체 리드 API에 저장한다", async ({ page }) => {
    await page.route("**/api/aibio/native-leads", async (route) => {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          mode: "local_sqlite_persistence",
          leadId: "aibio_offer_test_001",
          receivedAt: "2026-04-26T10:30:00.000Z",
          nextStatus: "new",
          nextStatusLabel: "신규",
          duplicateOfLeadId: null,
          phoneHashSha256: "b".repeat(64),
          attributionKeys: ["fbclid", "utm_campaign", "utm_medium", "utm_source"],
        }),
      });
    });

    await page.goto(`${BASE}/shop_view?idx=25&utm_source=meta&utm_medium=paid_social&utm_campaign=shop_view_25_test&fbclid=offer_click_id`);

    await expect(page.getByRole("heading", { name: /붓기와 식욕 리듬을 먼저 확인/ })).toBeVisible();
    await expect(page.getByText("/shop_view?idx=25", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "첫방문 체험 상담을 신청합니다." })).toBeVisible();

    await page.getByLabel("이름").fill("오퍼테스트");
    await page.getByLabel("연락처").fill("010-1111-2222");
    await page.getByLabel("나이대").selectOption("40s");
    await page.getByLabel("상담 목적").selectOption("appetite");
    await page.getByLabel("알게 된 경로").selectOption("facebook");
    await page.getByLabel("연락 희망 시간").selectOption("morning");
    await page.getByLabel("개인정보 수집 및 상담 연락에 동의합니다.").check();
    await page.getByRole("button", { name: "첫방문 상담 신청 저장" }).click();

    await expect(page.getByText(/운영 리드 원장에 저장되었습니다/)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/접수번호: aibio_offer_test_001/)).toBeVisible();
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
        attribution: {
          utm_source: "meta",
          utm_medium: "paid_social",
          utm_campaign: "aibio_native_test",
          fbclid: "test_click_id",
          ignored: "not_allowed",
        },
      },
    });

    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.mode).toBe("dry_run_no_persistence");
    expect(body.phoneHashSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(body.attributionKeys).toEqual(["fbclid", "utm_campaign", "utm_medium", "utm_source"]);
    expect(JSON.stringify(body)).not.toContain("010-0000-0000");
    expect(JSON.stringify(body)).not.toContain("테스트");
    expect(JSON.stringify(body)).not.toContain("test_click_id");
  });

  test("운영자 리드 관리자가 실제 API 응답으로 로드된다", async ({ page }) => {
    await page.route("**/api/aibio/native-leads?**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          total: 1,
          summary: {
            total: 1,
            byStatus: {
              new: 1,
              contact_attempted: 0,
              contacted: 0,
              reserved: 0,
              visited: 0,
              paid: 0,
              no_show: 0,
              invalid_duplicate: 0,
            },
            byLanding: [{ key: "/aibio-native", count: 1 }],
            bySource: [{ key: "meta", count: 1 }],
            withAdKey: 1,
            adKeyCoverageRate: 1,
            duplicates: 0,
            duplicateRate: 0,
          },
          leads: [
            {
              leadId: "aibio_native_test_001",
              status: "new",
              statusLabel: "신규",
              statusUpdatedAt: "2026-04-26T09:30:00.000Z",
              customerNameMasked: "테*트",
              customerPhoneMasked: "010-****-0000",
              phoneHashSha256: "a".repeat(64),
              ageRange: "30s",
              purpose: "metabolism",
              channel: "instagram",
              preferredTime: "afternoon",
              privacyConsent: true,
              marketingConsent: true,
              landingPath: "/aibio-native",
              referrer: null,
              utm: { source: "meta", medium: "paid_social", campaign: "aibio_native_test", content: null, term: null },
              adKeys: { fbclid: true, gclid: false, fbc: false, fbp: false, gaClientId: false },
              attributionKeys: ["fbclid", "utm_campaign", "utm_medium", "utm_source"],
              isDuplicate: false,
              duplicateOfLeadId: null,
              assignedTo: null,
              operatorMemo: null,
              reservationAt: null,
              visitAt: null,
              paymentAmount: null,
              paymentAt: null,
              createdAt: "2026-04-26T09:30:00.000Z",
              updatedAt: "2026-04-26T09:30:00.000Z",
            },
          ],
        }),
      });
    });
    await page.route("**/api/aibio/native-leads/funnel?**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          source: "local_sqlite_aibio_native_leads",
          window: { startAt: "2026-04-19T00:00:00.000Z", endAt: "2026-04-26T00:00:00.000Z", days: 7 },
          freshness: { latestLeadAt: "2026-04-26T09:30:00.000Z", latestStatusUpdatedAt: "2026-04-26T09:30:00.000Z" },
          funnel: { leads: 1, contactStarted: 0, contacted: 0, reserved: 0, visited: 0, paid: 0, noShow: 0, invalidDuplicate: 0 },
          confidence: "low_sample",
        }),
      });
    });

    await page.goto(`${BASE}/aibio-native/admin`);

    await expect(page.getByRole("heading", { name: /자체 리드 원장과 주간 퍼널/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: "운영 리드 리스트" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "상태" })).toBeVisible();
    await expect(page.getByText("aibio_native_test_001")).toBeVisible();
  });
});
