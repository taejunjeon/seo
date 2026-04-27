#!/usr/bin/env node
import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs/promises";

const ROOT = path.resolve(process.cwd());
const OUTPUT_DIR = path.resolve(ROOT, "..", "seo", "screnshot");
const URL = process.env.SEO_URL || "http://localhost:7010/seo";

const SECTIONS = [
  { id: "overview", file: "01_overview.png" },
  { id: "live-gsc", file: "02_live_gsc.png" },
  { id: "url-policy", file: "03_url_policy.png" },
  { id: "jsonld", file: "04_jsonld.png" },
  { id: "product-text", file: "05_product_text.png" },
  { id: "checklist", file: "06_checklist.png" },
  { id: "approvals", file: "07_approvals.png" },
];

async function main() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  console.log(`▶ ${URL}`);
  await page.goto(URL, { waitUntil: "networkidle", timeout: 60_000 });
  await page.waitForTimeout(2500);

  await page.screenshot({
    path: path.join(OUTPUT_DIR, "00_full_page.png"),
    fullPage: true,
  });
  console.log("✔ 00_full_page.png");

  for (const s of SECTIONS) {
    await page.evaluate((id) => {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: "instant", block: "start" });
    }, s.id);
    await page.waitForTimeout(700);
    const handle = await page.$(`#${s.id}`);
    if (handle) {
      await handle.screenshot({ path: path.join(OUTPUT_DIR, s.file) });
      console.log(`✔ ${s.file}`);
    } else {
      console.warn(`✗ #${s.id} not found`);
    }
  }

  await browser.close();
  console.log("done");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
