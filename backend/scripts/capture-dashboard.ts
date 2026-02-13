import fs from "node:fs/promises";
import path from "node:path";

import { chromium, type Page } from "playwright";

type CaptureMode = "scroll" | "full";

const NAV_TABS = ["오버뷰", "칼럼 분석", "키워드 분석", "Core Web Vitals", "사용자 행동", "솔루션 소개"];

const getArgValue = (name: string): string | undefined => {
  const exact = process.argv.find((a) => a === name);
  if (exact) {
    const idx = process.argv.indexOf(exact);
    const next = process.argv[idx + 1];
    return next && !next.startsWith("--") ? next : undefined;
  }

  const withEq = process.argv.find((a) => a.startsWith(`${name}=`));
  if (withEq) return withEq.slice(name.length + 1);
  return undefined;
};

const hasFlag = (name: string) => process.argv.includes(name);

const sanitizeFileName = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\-_.]/g, "");

const timestamp = () => new Date().toISOString().replace(/[:.]/g, "-");

const captureByScrolling = async (page: Page, outPrefix: string) => {
  const viewport = page.viewportSize();
  if (!viewport) throw new Error("Viewport size is not available");

  const totalHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  const step = Math.max(200, Math.floor(viewport.height * 0.9));

  let y = 0;
  let part = 1;
  while (y < totalHeight) {
    await page.evaluate((scrollY) => window.scrollTo(0, scrollY), y);
    await page.waitForTimeout(200);

    const partName = String(part).padStart(3, "0");
    const outPath = `${outPrefix}.${partName}.png`;
    await page.screenshot({ path: outPath });

    y += step;
    part += 1;
    if (part > 500) break;
  }
};

const captureTab = async (page: Page, tabName: string, outDir: string, mode: CaptureMode) => {
  await page.getByRole("button", { name: tabName, exact: true }).click();
  await page.waitForTimeout(350);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(200);

  const baseName = sanitizeFileName(tabName) || "tab";
  const outPrefix = path.join(outDir, baseName);

  if (mode === "full") {
    await page.screenshot({ path: `${outPrefix}.full.png`, fullPage: true });
    return;
  }

  await captureByScrolling(page, outPrefix);
};

const resolveTabs = (tabsArg: string | undefined) => {
  if (!tabsArg || tabsArg.trim() === "" || tabsArg.trim().toLowerCase() === "all") return NAV_TABS;

  const wanted = tabsArg
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

  const resolved: string[] = [];
  for (const item of wanted) {
    if (/^\d+$/.test(item)) {
      const idx = parseInt(item, 10);
      if (idx >= 0 && idx < NAV_TABS.length) resolved.push(NAV_TABS[idx]);
      continue;
    }

    const matched = NAV_TABS.find((tab) => tab === item) ?? NAV_TABS.find((tab) => tab.includes(item));
    if (matched) resolved.push(matched);
  }

  return resolved.length > 0 ? Array.from(new Set(resolved)) : NAV_TABS;
};

const main = async () => {
  const url =
    getArgValue("--url") ??
    process.env.DASHBOARD_URL ??
    process.env.NEXT_PUBLIC_DASHBOARD_URL ??
    "http://localhost:7010";
  const outArg = getArgValue("--out");
  const mode = (getArgValue("--mode") ?? "scroll") as CaptureMode;
  const tabs = resolveTabs(getArgValue("--tabs"));
  const headless = !hasFlag("--headful");

  if (mode !== "scroll" && mode !== "full") {
    throw new Error(`Invalid --mode: ${mode} (use: scroll | full)`);
  }

  const outDir = outArg ? path.resolve(outArg) : path.resolve(process.cwd(), "artifacts", "screenshots", timestamp());
  await fs.mkdir(outDir, { recursive: true });

  const browser = await chromium.launch({ headless });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });

  try {
    await page.goto(url, { waitUntil: "networkidle" });
    await page.waitForTimeout(500);

    for (const tab of tabs) {
      await captureTab(page, tab, outDir, mode);
    }
  } finally {
    await page.close().catch(() => {});
    await browser.close().catch(() => {});
  }

  // eslint-disable-next-line no-console
  console.log(`Saved screenshots to: ${outDir}`);
};

void main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);

  const message = error instanceof Error ? error.message : "";
  if (message.includes("Executable doesn't exist") || message.includes("playwright install")) {
    // eslint-disable-next-line no-console
    console.error("Playwright 브라우저가 설치되지 않았습니다. 아래 명령을 실행하세요:");
    // eslint-disable-next-line no-console
    console.error("  npx playwright install chromium");
  }

  process.exitCode = 1;
});
