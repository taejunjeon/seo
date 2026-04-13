import { test } from "@playwright/test";
import path from "node:path";

const BASE = "http://localhost:7010";
const OUT_DIR = path.resolve(__dirname, "../../crmux/0412");

const CAPTURES: Array<{ name: string; url: string; wait?: number }> = [
  // 더클린커피 탭 (핵심 CRM)
  { name: "01_coffee_orders", url: `${BASE}/crm?site=thecleancoffee&tab=orders` },
  { name: "02_coffee_repurchase", url: `${BASE}/crm?site=thecleancoffee&tab=repurchase`, wait: 3500 },
  { name: "03_coffee_groups", url: `${BASE}/crm?site=thecleancoffee&tab=groups` },
  { name: "04_coffee_customers", url: `${BASE}/crm?site=thecleancoffee&tab=customers`, wait: 3000 },
  { name: "05_coffee_behavior", url: `${BASE}/crm?site=thecleancoffee&tab=behavior` },
  { name: "06_coffee_messaging", url: `${BASE}/crm?site=thecleancoffee&tab=messaging` },
  { name: "07_coffee_attribution", url: `${BASE}/crm?site=thecleancoffee&tab=attribution` },
  { name: "08_coffee_consent_audit", url: `${BASE}/crm?site=thecleancoffee&tab=consent` },
  // 전체 / 사이트 비교
  { name: "09_all_comparison", url: `${BASE}/crm?site=all&tab=comparison` },
  // biocom
  { name: "10_biocom_consultation", url: `${BASE}/crm?site=biocom&tab=consultation` },
  // aibio
  { name: "11_aibio_ads", url: `${BASE}/crm?site=aibio&tab=ads` },
];

test.describe("CRM 스크린샷 (크롬 1440 wide, full page)", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  for (const cap of CAPTURES) {
    test(cap.name, async ({ page }) => {
      await page.goto(cap.url, { waitUntil: "networkidle", timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(cap.wait ?? 2000);
      await page.screenshot({
        path: path.join(OUT_DIR, `${cap.name}.png`),
        fullPage: true,
      });
    });
  }
});
