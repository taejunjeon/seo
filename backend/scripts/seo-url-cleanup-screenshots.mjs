#!/usr/bin/env node
import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs/promises";

const ROOT = path.resolve(process.cwd());
const OUTPUT_DIR = path.resolve(ROOT, "..", "seo", "screnshot", "url-cleanup");
const URL = process.env.SEO_URL_CLEANUP || "http://localhost:7010/seo/url-cleanup";

const SECTIONS = [
  { id: "cover", file: "01_cover.png" },
  { id: "overview", file: "02_overview.png" },
  { id: "noindex", file: "03_noindex.png" },
  { id: "canonical", file: "04_canonical.png" },
  { id: "robots", file: "05_robots.png" },
  { id: "sitemap", file: "06_sitemap.png" },
  { id: "weekly", file: "07_weekly.png" },
  { id: "rollback", file: "08_rollback.png" },
  { id: "report", file: "09_report.png" },
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
