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
    await page.getByLabel(/개인정보 수집·이용에 동의합니다/).check();
    await page.getByLabel(/이벤트·할인 안내 메시지 수신에 동의합니다/).check();
    await page.getByRole("button", { name: "상담 신청하기" }).click();

    await expect(page.getByText("상담 신청이 접수되었습니다.")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/영업일 기준 24시간 안에/)).toBeVisible();
    await expect(page.getByText(/접수번호/)).toBeVisible();
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
    await page.getByLabel(/개인정보 수집·이용에 동의합니다/).check();
    await page.getByRole("button", { name: "첫방문 상담 신청 저장" }).click();

    await expect(page.getByText("상담 신청이 접수되었습니다.")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/접수번호/)).toBeVisible();
  });

  test("모바일 CTA와 전화번호 검증 UX가 보인다", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE}/shop_view?idx=25&utm_source=meta`);

    const ctaBar = page.getByRole("navigation", { name: "모바일 빠른 상담 메뉴" });
    await expect(ctaBar.getByRole("link", { name: "카카오 상담" })).toBeVisible();
    await expect(ctaBar.getByRole("link", { name: "첫방문 상담 신청" })).toBeVisible();

    await ctaBar.getByRole("link", { name: "첫방문 상담 신청" }).click();
    await page.getByLabel("연락처").fill("0101234");
    await page.getByLabel("연락처").blur();
    await expect(page.getByText("010으로 시작하는 휴대폰 번호를 입력해 주세요.")).toBeVisible();

    await page.getByLabel("연락처").fill("01012345678");
    await expect(page.getByLabel("연락처")).toHaveValue("010-1234-5678");
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
    let savedPayload: Record<string, unknown> | null = null;
    let savedAdminToken = "";
    let savedContactToken = "";

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
              assignedTo: "",
              operatorMemo: "",
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
    await page.route("**/api/aibio/native-leads/fallback-comparison?**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          generatedAt: "2026-04-26T09:30:00.000Z",
          source: {
            native: "local_sqlite_aibio_native_leads",
            fallback: "local_sqlite_ledger",
          },
          window: {
            startAt: "2026-03-27T00:00:00.000Z",
            endAt: "2026-04-26T00:00:00.000Z",
            startDate: "2026-03-27",
            endDate: "2026-04-26",
            rangeDays: 30,
          },
          freshness: {
            latestNativeLeadAt: "2026-04-26T09:30:00.000Z",
            latestFallbackAt: "2026-04-25T09:30:00.000Z",
          },
          counts: {
            nativeRows: 10,
            nativeUniquePhones: 9,
            fallbackRows: 11,
            fallbackUniquePhones: 10,
            overlapUniquePhones: 8,
            nativeOnlyUniquePhones: 1,
            fallbackOnlyUniquePhones: 2,
          },
          rates: {
            nativeOnlyRate: 1 / 9,
            fallbackOnlyRate: 0.2,
            overlapRateAgainstNative: 8 / 9,
            overlapRateAgainstFallback: 0.8,
          },
          warnings: [],
          notes: ["전화번호 hash 기준 대조"],
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
    await page.route("**/api/aibio/native-leads/*/status", async (route) => {
      savedPayload = route.request().postDataJSON() as Record<string, unknown>;
      savedAdminToken = route.request().headers()["x-admin-token"] ?? "";
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          lead: {
            leadId: "aibio_native_test_001",
            status: "new",
            statusLabel: "신규",
            statusUpdatedAt: "2026-04-26T09:31:00.000Z",
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
            assignedTo: "김상담",
            operatorMemo: "오전 재연락",
            reservationAt: "2026-04-27T10:00:00.000Z",
            visitAt: "2026-04-28T11:00:00.000Z",
            paymentAmount: null,
            paymentAt: null,
            createdAt: "2026-04-26T09:30:00.000Z",
            updatedAt: "2026-04-26T09:31:00.000Z",
          },
        }),
      });
    });
    await page.route("**/api/aibio/native-leads/*/contact", async (route) => {
      savedContactToken = route.request().headers()["x-admin-token"] ?? "";
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          contact: {
            leadId: "aibio_native_test_001",
            name: "테스트",
            phone: "01012345678",
            phoneHashSha256: "a".repeat(64),
          },
        }),
      });
    });

    await page.goto(`${BASE}/aibio-native/admin`);

    await expect(page.getByRole("heading", { name: /자체 리드 원장과 주간 퍼널/ })).toBeVisible();
    const fallbackRegion = page.getByRole("region", { name: "아임웹 30일 병행 대조" });
    await expect(page.getByRole("heading", { name: "팀 리뷰 이후 30일 병행 운영 대조" })).toBeVisible();
    await expect(fallbackRegion.getByText("아임웹 폼", { exact: true })).toBeVisible();
    await expect(fallbackRegion.getByText("11", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "운영 리드 리스트" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "상태" })).toBeVisible();
    await expect(page.getByLabel("상태 필터")).toContainText("예약확정");
    await page.getByRole("textbox", { name: "관리자 토큰" }).fill("test-admin-token");
    await page.getByRole("button", { name: "세션에 저장" }).click();
    await expect(page.getByText("토큰 입력됨")).toBeVisible();
    await expect(page.getByText("aibio_native_test_001")).toBeVisible();
    await page.getByRole("button", { name: "원문 연락처 보기" }).click();
    await expect(page.getByText("테스트 · 01012345678")).toBeVisible();
    expect(savedContactToken).toBe("test-admin-token");
    await page.getByLabel("담당자").fill("김상담");
    await page.getByLabel("예약일").fill("2026-04-27T10:00");
    await page.getByLabel("방문일").fill("2026-04-28T11:00");
    await page.getByLabel("메모").fill("오전 재연락");
    await page.getByRole("button", { name: "운영 정보 저장" }).click();

    await expect.poll(() => savedPayload).toMatchObject({
      assignedTo: "김상담",
      memo: "오전 재연락",
      reservationAt: "2026-04-27T10:00",
      visitAt: "2026-04-28T11:00",
    });
    expect(savedAdminToken).toBe("test-admin-token");
  });

  test("상세페이지 편집 관리자가 문구를 저장한다", async ({ page }) => {
    let savedToken = "";
    let savedTitle = "";
    const content = {
      slug: "shop-view-25",
      route: "/shop_view?idx=25",
      status: "draft",
      updatedAt: "2026-04-26T06:00:00.000Z",
      updatedBy: "system",
      hero: {
        eyebrow: "AIBIO Recovery Lab Offer",
        title: "붓기와 식욕 리듬을 먼저 확인하는 첫방문 체험 상담",
        body: "테스트 본문",
        primaryCta: "첫방문 상담 신청",
        secondaryCta: "카카오 상담",
        imageUrl: "https://cdn.imweb.me/thumbnail/20250124/e96dc62d45b13.jpg",
      },
      strip: [
        { label: "핵심 CTA", value: "상담 신청" },
        { label: "저장 위치", value: "Native Lead Ledger" },
        { label: "광고키", value: "UTM · fbclid · gclid" },
      ],
      program: { eyebrow: "Program", title: "프로그램", body: "프로그램 본문", imageUrl: "https://cdn.imweb.me/thumbnail/20250124/340d5a869a6b2.jpg" },
      offerPoints: [
        { label: "첫 방문", title: "대사 리듬 상담", body: "상담 방향을 정합니다." },
        { label: "센터 체험", title: "리커버리 장비 안내", body: "체험 순서를 안내합니다." },
        { label: "운영 원장", title: "상담 상태 추적", body: "자체 리드 원장에 남깁니다." },
      ],
      flow: [
        { step: "01", title: "신청", body: "정보를 남깁니다." },
        { step: "02", title: "상담", body: "상담합니다." },
        { step: "03", title: "예약", body: "확정합니다." },
        { step: "04", title: "방문", body: "기록합니다." },
      ],
      proof: { eyebrow: "Measurement", title: "측정", body: "저장합니다.", imageUrl: "https://cdn.imweb.me/thumbnail/20250124/1312356faa028.jpg" },
      form: { eyebrow: "First Visit Lead", title: "첫방문 체험 상담을 신청합니다.", description: "저장됩니다.", submitLabel: "첫방문 상담 신청 저장" },
    };

    await page.route("**/api/aibio/content/shop-view-25", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, content }) });
    });
    await page.route("**/api/aibio/admin/content/shop-view-25", async (route) => {
      savedToken = route.request().headers()["x-admin-token"] ?? "";
      const payload = route.request().postDataJSON() as typeof content;
      savedTitle = payload.hero.title;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, content: { ...payload, updatedAt: "2026-04-26T10:00:00.000Z", updatedBy: "aibio-native-admin" } }),
      });
    });

    await page.goto(`${BASE}/aibio-native/admin/content`);
    await expect(page.getByRole("heading", { name: "상세페이지 문구와 이미지를 직접 바꿉니다." })).toBeVisible();
    await page.getByRole("textbox", { name: "관리자 토큰" }).fill("test-admin-token");
    await page.getByRole("button", { name: "세션 저장" }).click();
    await page.getByRole("textbox", { name: "큰 제목" }).fill("운영자가 바꾼 첫방문 체험 상담");
    await page.getByRole("button", { name: "상세페이지 저장" }).click();

    await expect(page.getByText("저장되었습니다. 공개 랜딩 새로고침 시 반영됩니다.")).toBeVisible();
    expect(savedToken).toBe("test-admin-token");
    expect(savedTitle).toBe("운영자가 바꾼 첫방문 체험 상담");
  });

  test("입력폼 분석 관리자가 엑셀 집계를 확인한다", async ({ page }) => {
    let savedToken = "";
    await page.route("**/api/aibio/admin/form-export/analyze", async (route) => {
      savedToken = route.request().headers()["x-admin-token"] ?? "";
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          generatedAt: "2026-04-26T10:00:00.000Z",
          file: { name: "diet.xlsx", size: 1024, mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
          privacy: { rawPiiReturned: false, phoneHashOnly: true, note: "PII 없음" },
          shape: { sheetRows: 107, dataRows: 106, columns: 12, headers: ["이름", "연락처"] },
          freshness: { firstResponseAt: "2024-11-10 21:37:49", latestResponseAt: "2026-04-26 01:12:47" },
          quality: {
            missingNameRows: 0,
            missingPhoneRows: 0,
            uniquePhoneHashes: 99,
            duplicatePhoneHashRows: 7,
            privacyConsentRows: 106,
            thirdPartyConsentRows: 0,
          },
          distributions: {
            age: [{ key: "40대", count: 20 }],
            purpose: [{ key: "체중 감량", count: 96 }],
            channel: [{ key: "유튜브", count: 56 }],
            consultationType: [{ key: "(blank)", count: 88 }],
          },
          recommendedNativeFields: [
            { sourceHeader: "상담 목적 (다중 선택 가능)", nativeField: "purpose[]", note: "다중 선택 전환 권장" },
          ],
        }),
      });
    });

    await page.goto(`${BASE}/aibio-native/admin/forms`);
    await expect(page.getByRole("heading", { name: "아임웹 입력폼 엑셀을 자체 원장 필드와 대조합니다." })).toBeVisible();
    await page.getByRole("textbox", { name: "관리자 토큰" }).fill("test-admin-token");
    await page.getByRole("button", { name: "세션 저장" }).click();
    await page.locator('input[type="file"]').setInputFiles({
      name: "diet.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: Buffer.from("fake"),
    });

    await expect(page.getByText("입력폼 엑셀 분석이 완료되었습니다. 원문 이름, 전화번호, IP는 화면에 반환하지 않습니다.")).toBeVisible();
    await expect(page.getByText("체중 감량")).toBeVisible();
    await expect(page.getByText("purpose[]")).toBeVisible();
    expect(savedToken).toBe("test-admin-token");
  });
});
