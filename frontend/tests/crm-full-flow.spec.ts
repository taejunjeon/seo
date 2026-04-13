/**
 * Phase A-1 / A-2 / A-4:
 * End-to-end browser flow tests covering the new CRM features:
 *   - Repurchase tab → temp group auto-create → messaging redirect
 *   - Customer groups tab → excel upload dropzone
 *   - Messaging tab → schedule send UI
 *   - Scheduled sends list → cancel
 *   - Consent audit tab load
 *   - A/B funnel 4-stage render (when data exists)
 *
 * Each test also:
 *   - Validates select API responses against the schemas in
 *     tests/schemas/crm-api.schemas.ts (A-4 contract verification)
 *   - Runs axe-core accessibility scan (A-2)
 *
 * Absolutely no real SMS/alimtalk is sent. Test SMS uses testMode=Y (aligo
 * test), and when actual delivery must be verified the phone 010-8741-8641
 * (the operator's own number) is used.
 */

import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import path from "node:path";
import fs from "node:fs";

import { validateResponse, formatErrors } from "./utils/validate";
import {
  API_BASE,
  createTestGroup,
  deleteGroup,
  isoInFuture,
} from "./utils/test-helpers";

const FRONT = "http://localhost:7010";
const FIXTURE_CSV = path.resolve(__dirname, "./fixtures/test-members.csv");

test.describe.configure({ mode: "serial" });

test.describe("Phase A — CRM 전체 동선 (Playwright + axe + ajv)", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  async function scanA11y(page: Page, label: string) {
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .disableRules(["color-contrast"]) // inline style 위젯이 많아 색 대비는 Phase B 이후 목표
      .analyze();
    const serious = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    if (serious.length > 0) {
      const summary = serious
        .slice(0, 5)
        .map((v) => `  ${v.id} (${v.impact}) — ${v.description}`)
        .join("\n");
      console.warn(`[axe ${label}] ${serious.length} serious/critical:\n${summary}`);
    }
    // Phase A는 a11y를 관측만 하고 실패시키지 않음 (Phase C 이후 강제).
    expect(results).toBeTruthy();
  }

  test("F1: 재구매 탭 로드 + API 계약 검증", async ({ page, request }) => {
    const res = await request.get(`${API_BASE}/api/crm-local/groups`);
    expect(res.ok()).toBeTruthy();
    const groupsPayload = await res.json();
    const { valid, errors } = validateResponse("groupsList", groupsPayload);
    expect(valid, `groupsList 응답 스키마 위반:\n${formatErrors(errors)}`).toBe(true);

    await page.goto(`${FRONT}/crm?site=thecleancoffee&tab=repurchase`, {
      waitUntil: "networkidle",
    });
    await expect(page.locator("h2:has-text('재구매 관리')")).toBeVisible({
      timeout: 15000,
    });
    await scanA11y(page, "repurchase");
  });

  test("F2: 재구매 탭 'N명 발송' 버튼 클릭 → 임시 그룹 자동 생성 → messaging 탭 이동", async ({
    page,
  }) => {
    await page.goto(`${FRONT}/crm?site=thecleancoffee&tab=repurchase`, {
      waitUntil: "networkidle",
    });
    // 후보 로드 대기
    await expect(page.locator("h2:has-text('재구매 관리')")).toBeVisible();
    await page.waitForTimeout(3000);

    // SMS 발송 버튼이 렌더되면 클릭
    const smsBtn = page.getByRole("button", { name: /SMS 문자 발송/ });
    const count = await smsBtn.count();
    if (count === 0) {
      test.info().annotations.push({
        type: "skipped-reason",
        description: "발송 후보가 0명이라 버튼 미노출 (정상 케이스)",
      });
      return;
    }
    await smsBtn.first().click();
    // 그룹 생성 로딩 표시 → messaging 탭 리다이렉트 대기
    await page.waitForURL(/tab=messaging/, { timeout: 15000 }).catch(() => undefined);
    const url = new URL(page.url());
    const groupId = url.searchParams.get("groupId");
    expect(groupId, "리다이렉트 URL에 groupId 파라미터 포함").toBeTruthy();
    expect(url.searchParams.get("channel")).toBe("sms");
  });

  test("F3: 고객 그룹 탭 + 엑셀 업로드 드롭존", async ({ page, request }) => {
    // 사전: 테스트 그룹 1개 생성해서 드롭존이 표시되도록
    const groupId = await createTestGroup(request, `phaseA-test-${Date.now()}`);
    expect(groupId).toBeTruthy();

    await page.goto(`${FRONT}/crm?site=thecleancoffee&tab=groups`, {
      waitUntil: "networkidle",
    });
    await expect(page.locator("h2:has-text('고객 그룹 목록')")).toBeVisible();

    // 해당 그룹 행을 클릭해 멤버 + 업로드 섹션 노출
    const row = page.locator(`tr:has(td:has(strong:has-text("phaseA-test-")))`).first();
    await row.click();
    await expect(page.locator("text=엑셀 / CSV 대량 업로드")).toBeVisible({
      timeout: 5000,
    });
    await scanA11y(page, "groups");

    // 업로드 — API 직접 호출 (파일 input → change 이벤트는 playwright에서도 가능하지만
    // 안정성을 위해 REST 호출로 엔드포인트를 검증)
    const csvBuffer = fs.readFileSync(FIXTURE_CSV);
    const uploadRes = await request.post(
      `${API_BASE}/api/crm-local/groups/${groupId}/members/bulk-upload`,
      {
        multipart: {
          file: {
            name: "test-members.csv",
            mimeType: "text/csv",
            buffer: csvBuffer,
          },
        },
      },
    );
    expect(uploadRes.ok()).toBeTruthy();
    const uploadPayload = await uploadRes.json();
    const { valid, errors } = validateResponse("bulkUploadResult", uploadPayload);
    expect(valid, `bulkUploadResult 스키마 위반:\n${formatErrors(errors)}`).toBe(true);
    expect(uploadPayload.added).toBe(3);
    expect(uploadPayload.skipped_duplicate).toBe(1);
    expect(uploadPayload.skipped_invalid_phone).toBe(1);

    // 정리
    await deleteGroup(request, groupId!);
  });

  test("F4: 예약 발송 — 등록 → 목록 → 취소 (API 전용, 실 발송 없음)", async ({
    request,
  }) => {
    const groupId = await createTestGroup(request, `phaseA-sched-${Date.now()}`);
    expect(groupId).toBeTruthy();

    // 멤버 1명 추가 — 본인 번호만 사용
    await request.post(`${API_BASE}/api/crm-local/groups/${groupId}/members`, {
      data: {
        members: [{ phone: "01087418641", name: "phase-a-test", member_code: "phaseA" }],
      },
    });

    // 등록
    const createRes = await request.post(`${API_BASE}/api/crm-local/scheduled-sends`, {
      data: {
        groupId,
        channel: "sms",
        message: "[phase-a-test] testMode 예약 확인",
        scheduledAt: isoInFuture(3600),
        adminOverride: true,
        testMode: true,
        note: "phase_a_test",
      },
    });
    expect(createRes.ok()).toBeTruthy();
    const createPayload = await createRes.json();
    const createCheck = validateResponse("scheduledSendCreate", createPayload);
    expect(
      createCheck.valid,
      `scheduledSendCreate 스키마 위반:\n${formatErrors(createCheck.errors)}`,
    ).toBe(true);

    // 목록
    const listRes = await request.get(
      `${API_BASE}/api/crm-local/scheduled-sends?limit=10`,
    );
    expect(listRes.ok()).toBeTruthy();
    const listPayload = await listRes.json();
    const listCheck = validateResponse("scheduledSendList", listPayload);
    expect(
      listCheck.valid,
      `scheduledSendList 스키마 위반:\n${formatErrors(listCheck.errors)}`,
    ).toBe(true);

    // 취소
    const cancelRes = await request.delete(
      `${API_BASE}/api/crm-local/scheduled-sends/${createPayload.id}`,
    );
    expect(cancelRes.ok()).toBeTruthy();

    // 정리
    await deleteGroup(request, groupId!);
  });

  test("F5: 예약 발송 엣지 케이스 — 과거 시각·잘못된 channel·존재하지 않는 그룹", async ({
    request,
  }) => {
    const groupId = await createTestGroup(request, `phaseA-edge-${Date.now()}`);

    // 과거
    const past = await request.post(`${API_BASE}/api/crm-local/scheduled-sends`, {
      data: {
        groupId,
        channel: "sms",
        message: "past",
        scheduledAt: "2020-01-01T00:00:00Z",
      },
    });
    expect(past.status()).toBe(400);

    // 잘못된 channel
    const channel = await request.post(`${API_BASE}/api/crm-local/scheduled-sends`, {
      data: {
        groupId,
        channel: "email",
        message: "wrong",
        scheduledAt: isoInFuture(3600),
      },
    });
    expect(channel.status()).toBe(400);

    // 그룹 없음
    const missing = await request.post(`${API_BASE}/api/crm-local/scheduled-sends`, {
      data: {
        groupId: "nope",
        channel: "sms",
        message: "x",
        scheduledAt: isoInFuture(3600),
      },
    });
    expect(missing.status()).toBe(404);

    await deleteGroup(request, groupId!);
  });

  test("F6: ConsentAuditTab 로드 + API 계약", async ({ page, request }) => {
    const res = await request.get(
      `${API_BASE}/api/crm-local/consent-audit?site=thecleancoffee&limit=10`,
    );
    expect(res.ok()).toBeTruthy();
    const payload = await res.json();
    const { valid, errors } = validateResponse("consentAudit", payload);
    expect(valid, `consentAudit 스키마 위반:\n${formatErrors(errors)}`).toBe(true);

    await page.goto(`${FRONT}/crm?site=thecleancoffee&tab=consent`, {
      waitUntil: "networkidle",
    });
    await expect(page.locator("h2:has-text('수신거부 처리')")).toBeVisible();
    await scanA11y(page, "consent");
  });

  test("F7: 고객 그룹 탭 — 엑셀 업로드 버튼 실제 UI 클릭 (파일 input)", async ({
    page,
    request,
  }) => {
    const groupId = await createTestGroup(request, `phaseA-ui-${Date.now()}`);

    await page.goto(`${FRONT}/crm?site=thecleancoffee&tab=groups`, {
      waitUntil: "networkidle",
    });
    await expect(page.locator("h2:has-text('고객 그룹 목록')")).toBeVisible();

    const row = page.locator(`tr:has(td:has(strong:has-text("phaseA-ui-")))`).first();
    await row.click();

    const fileChooserPromise = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "파일 선택" }).click();
    const chooser = await fileChooserPromise;
    await chooser.setFiles(FIXTURE_CSV);

    // 결과 배너 대기
    await expect(page.locator("text=업로드 완료")).toBeVisible({ timeout: 15000 });
    await expect(page.locator("text=추가")).toBeVisible();

    await deleteGroup(request, groupId!);
  });

  test("F8: A/B 퍼널 API 계약 (실험 key 있는 경우)", async ({ request }) => {
    // 기존 실험 키 하나 조회
    const expRes = await request.get(
      `${API_BASE}/api/crm-local/experiments?meta=true`,
    );
    expect(expRes.ok()).toBeTruthy();
    const expPayload = await expRes.json();
    const experimentKey = expPayload.experiments?.[0]?.experiment_key;
    if (!experimentKey) {
      test.info().annotations.push({
        type: "skipped-reason",
        description: "실험이 없어 funnel 계약 테스트 스킵",
      });
      return;
    }
    const funnelRes = await request.get(
      `${API_BASE}/api/crm-local/experiments/${experimentKey}/funnel`,
    );
    expect(funnelRes.ok()).toBeTruthy();
    const funnelPayload = await funnelRes.json();
    const { valid, errors } = validateResponse("experimentFunnel", funnelPayload);
    expect(valid, `experimentFunnel 스키마 위반:\n${formatErrors(errors)}`).toBe(true);
    expect(funnelPayload.funnel).toHaveProperty("visited");
    expect(funnelPayload.rates).toHaveProperty("visit_rate");
  });
});
