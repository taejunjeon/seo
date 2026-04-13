/**
 * Phase A-3: Visual regression baseline + diff.
 *
 * Captures 1440×full-page screenshots of core CRM tabs and compares them
 * against baselines stored in tests/fixtures/visual-baseline/. First run
 * creates baselines; subsequent runs diff and fail if pixel difference
 * exceeds the threshold.
 *
 * Threshold: 1% of pixels (generous because of server-side data changes
 * like timestamps and row counts). To update baselines, delete the file
 * in tests/fixtures/visual-baseline/ and re-run.
 *
 * Output artifacts on diff failure:
 *   - tests/artifacts/visual-diff/<name>.actual.png (current capture)
 *   - tests/artifacts/visual-diff/<name>.diff.png   (pixel diff)
 */

import { test, expect } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";

const BASE = "http://localhost:7010";
const BASELINE_DIR = path.resolve(__dirname, "./fixtures/visual-baseline");
const ARTIFACT_DIR = path.resolve(__dirname, "./artifacts/visual-diff");
const DIFF_THRESHOLD = 0.01; // 1%

type Capture = { name: string; url: string };

const CAPTURES: Capture[] = [
  { name: "coffee-orders", url: `${BASE}/crm?site=thecleancoffee&tab=orders` },
  { name: "coffee-groups", url: `${BASE}/crm?site=thecleancoffee&tab=groups` },
  { name: "coffee-messaging", url: `${BASE}/crm?site=thecleancoffee&tab=messaging` },
  { name: "coffee-consent-audit", url: `${BASE}/crm?site=thecleancoffee&tab=consent` },
];

test.describe("Phase A-3 — 시각 회귀", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test.beforeAll(() => {
    fs.mkdirSync(BASELINE_DIR, { recursive: true });
    fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  });

  for (const cap of CAPTURES) {
    test(`VR ${cap.name}`, async ({ page }) => {
      await page.goto(cap.url, { waitUntil: "networkidle" });
      await page.waitForTimeout(2000);
      const actualBuf = await page.screenshot({ fullPage: true });
      const baselinePath = path.join(BASELINE_DIR, `${cap.name}.png`);

      if (!fs.existsSync(baselinePath)) {
        fs.writeFileSync(baselinePath, actualBuf);
        test.info().annotations.push({
          type: "baseline-created",
          description: `첫 실행 — baseline 생성: ${baselinePath}`,
        });
        return;
      }

      const baseline = PNG.sync.read(fs.readFileSync(baselinePath));
      const actual = PNG.sync.read(actualBuf);

      if (baseline.width !== actual.width || baseline.height !== actual.height) {
        // 크기 다르면 항상 재baseline (페이지 내용이 바뀐 케이스)
        fs.writeFileSync(path.join(ARTIFACT_DIR, `${cap.name}.actual.png`), actualBuf);
        throw new Error(
          `크기 불일치 baseline=${baseline.width}x${baseline.height} actual=${actual.width}x${actual.height}. baseline 재생성 필요.`,
        );
      }

      const diff = new PNG({ width: baseline.width, height: baseline.height });
      const diffPixels = pixelmatch(
        baseline.data,
        actual.data,
        diff.data,
        baseline.width,
        baseline.height,
        { threshold: 0.2 },
      );
      const totalPixels = baseline.width * baseline.height;
      const ratio = diffPixels / totalPixels;

      if (ratio > DIFF_THRESHOLD) {
        fs.writeFileSync(path.join(ARTIFACT_DIR, `${cap.name}.actual.png`), actualBuf);
        fs.writeFileSync(path.join(ARTIFACT_DIR, `${cap.name}.diff.png`), PNG.sync.write(diff));
      }
      expect(
        ratio,
        `${cap.name} pixel diff ${(ratio * 100).toFixed(2)}% (threshold ${(DIFF_THRESHOLD * 100).toFixed(2)}%)`,
      ).toBeLessThanOrEqual(DIFF_THRESHOLD);
    });
  }
});
