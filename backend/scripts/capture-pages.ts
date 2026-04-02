/**
 * 주요 페이지 화면 캡처 스크립트
 * biocom.kr 주요 페이지 + 로컬 대시보드 캡처
 */
import { chromium } from "playwright-core";
import path from "path";

const GA4_DIR = path.resolve(__dirname, "../../GA4");

const PAGES = [
  { name: "dashboard-overview", url: "http://localhost:7010", waitMs: 8000 },
  { name: "biocom-home", url: "https://biocom.kr", waitMs: 5000 },
  { name: "biocom-report", url: "https://biocom.kr/report", waitMs: 5000 },
  { name: "biocom-shop_view", url: "https://biocom.kr/shop_view", waitMs: 5000 },
  { name: "biocom-shop_payment", url: "https://biocom.kr/shop_payment", waitMs: 5000 },
];

async function main() {
  const execPath = "/Users/vibetj/Library/Caches/ms-playwright/chromium-1208/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";
  const browser = await chromium.launch({ headless: true, executablePath: execPath });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: "ko-KR",
  });

  for (const pg of PAGES) {
    const page = await context.newPage();
    try {
      console.log(`캡처 중: ${pg.name} (${pg.url})`);
      await page.goto(pg.url, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(pg.waitMs);
      const filePath = path.join(GA4_DIR, `capture_${pg.name}.png`);
      await page.screenshot({ path: filePath, fullPage: true });
      console.log(`  -> 저장: ${filePath}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  -> 실패: ${pg.name} — ${msg}`);
    } finally {
      await page.close();
    }
  }

  await browser.close();
  console.log("캡처 완료.");
}

main().catch(console.error);
