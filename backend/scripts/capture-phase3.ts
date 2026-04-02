import { chromium } from "playwright-core";
import path from "path";

const PHASE3_DIR = path.resolve(__dirname, "../../phase3");

async function main() {
  const execPath = "/Users/vibetj/Library/Caches/ms-playwright/chromium-1208/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";
  const browser = await chromium.launch({ headless: true, executablePath: execPath });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "ko-KR" });

  // 1) AI CRM 포털 — 메인 페이지에서 "AI CRM" 탭 클릭
  {
    const page = await context.newPage();
    try {
      console.log("캡처 중: crm-overview (AI CRM 탭 클릭)");
      await page.goto("http://localhost:7010", { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(3000);
      // "AI CRM" 탭 버튼 클릭
      const tab = page.locator("button, a, span, div").filter({ hasText: /^AI CRM$/ }).first();
      await tab.click();
      await page.waitForTimeout(4000);
      await page.screenshot({ path: path.join(PHASE3_DIR, "capture_crm-overview.png"), fullPage: true });
      console.log("  -> 저장 완료");
    } catch (err) {
      console.error("  -> 실패:", err instanceof Error ? err.message : err);
    } finally {
      await page.close();
    }
  }

  // 2) CRM 후속 관리 탭 (기본 탭)
  {
    const page = await context.newPage();
    try {
      console.log("캡처 중: crm-followup");
      await page.goto("http://localhost:7010/crm", { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(5000);
      await page.screenshot({ path: path.join(PHASE3_DIR, "capture_crm-followup.png"), fullPage: true });
      console.log("  -> 저장 완료");
    } catch (err) {
      console.error("  -> 실패:", err instanceof Error ? err.message : err);
    } finally {
      await page.close();
    }
  }

  // 3) CRM 알림톡 발송 탭 — "알림톡 발송" 탭 버튼 클릭
  {
    const page = await context.newPage();
    try {
      console.log("캡처 중: crm-messaging (알림톡 발송 탭 클릭)");
      await page.goto("http://localhost:7010/crm", { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(3000);
      const tab = page.locator("button").filter({ hasText: /알림톡 발송/ }).first();
      await tab.click();
      await page.waitForTimeout(4000);
      await page.screenshot({ path: path.join(PHASE3_DIR, "capture_crm-messaging.png"), fullPage: true });
      console.log("  -> 저장 완료");
    } catch (err) {
      console.error("  -> 실패:", err instanceof Error ? err.message : err);
    } finally {
      await page.close();
    }
  }

  // 4) CRM 실험 운영 탭
  {
    const page = await context.newPage();
    try {
      console.log("캡처 중: crm-experiments (실험 운영 탭 클릭)");
      await page.goto("http://localhost:7010/crm", { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(3000);
      const tab = page.locator("button").filter({ hasText: /실험 운영/ }).first();
      await tab.click();
      await page.waitForTimeout(4000);
      await page.screenshot({ path: path.join(PHASE3_DIR, "capture_crm-experiments.png"), fullPage: true });
      console.log("  -> 저장 완료");
    } catch (err) {
      console.error("  -> 실패:", err instanceof Error ? err.message : err);
    } finally {
      await page.close();
    }
  }

  // 5) 솔루션 소개 페이지
  {
    const page = await context.newPage();
    try {
      console.log("캡처 중: solution");
      await page.goto("http://localhost:7010/solution", { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(4000);
      await page.screenshot({ path: path.join(PHASE3_DIR, "capture_solution.png"), fullPage: true });
      console.log("  -> 저장 완료");
    } catch (err) {
      console.error("  -> 실패:", err instanceof Error ? err.message : err);
    } finally {
      await page.close();
    }
  }

  await browser.close();
  console.log("Phase 3 캡처 완료.");
}

main().catch(console.error);
