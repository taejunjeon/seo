#!/usr/bin/env tsx
import fs from "node:fs";
import path from "node:path";

import dotenv from "dotenv";
import { google } from "googleapis";
import { chromium } from "playwright";

const repoRoot = path.resolve(__dirname, "..", "..");
dotenv.config({ path: path.resolve(repoRoot, "backend", ".env"), quiet: true });
dotenv.config({ path: path.resolve(repoRoot, ".env"), override: false, quiet: true });

const ACCOUNT_ID = "4703003246";
const CONTAINER_ID = "13158774";
const CONTAINER_PUBLIC_ID = "GTM-W2Z6PHN";
const WORKSPACE_ID = process.env.NPAY_BRIDGE_GTM_WORKSPACE_ID?.trim() || "171";
const CONTAINER_PATH = `accounts/${ACCOUNT_ID}/containers/${CONTAINER_ID}`;
const OUTPUT_DIR = path.resolve(repoRoot, "data");
const RUN_ID = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "Z");
const EXPECTED_VERSION = "2026-05-28-biocom-npay-bridge-gtm-v1-1-production-ready";

const getAuth = () => {
  const raw = process.env.GA4_BIOCOM_SERVICE_ACCOUNT_KEY?.trim()
    || process.env.GSC_SERVICE_ACCOUNT_KEY?.trim();
  if (!raw) throw new Error("GA4_BIOCOM_SERVICE_ACCOUNT_KEY 또는 GSC_SERVICE_ACCOUNT_KEY가 필요합니다.");
  return new google.auth.GoogleAuth({
    credentials: JSON.parse(raw),
    scopes: [
      "https://www.googleapis.com/auth/tagmanager.readonly",
      "https://www.googleapis.com/auth/tagmanager.edit.containers",
      "https://www.googleapis.com/auth/tagmanager.edit.containerversions",
    ],
  });
};

const redactPreviewUrl = (url: string) => {
  try {
    const parsed = new URL(url);
    for (const key of ["gtm_auth", "gtm_preview", "gclid", "gbraid", "wbraid"]) {
      if (parsed.searchParams.has(key)) parsed.searchParams.set(key, "REDACTED");
    }
    return parsed.toString();
  } catch {
    return url.replace(/gtm_auth=[^&]+/g, "gtm_auth=REDACTED")
      .replace(/gtm_preview=[^&]+/g, "gtm_preview=REDACTED");
  }
};

const writeJson = (filename: string, value: unknown) => {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const filePath = path.resolve(OUTPUT_DIR, filename);
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return filePath;
};

const buildPreviewUrl = (environment: { authorizationCode?: string | null; environmentId?: string | null }) => {
  if (!environment.authorizationCode || !environment.environmentId) {
    throw new Error("GTM preview environment authorization code/id missing");
  }
  const url = new URL("https://biocom.kr/shop_view/");
  url.searchParams.set("idx", "198");
  url.searchParams.set("__seo_attribution_debug", "1");
  url.searchParams.set("gclid", `TEST_GCLID_NPAY_BRIDGE_INSTALL_${RUN_ID}`);
  url.searchParams.set("utm_source", "codex_gtm_preview");
  url.searchParams.set("utm_medium", "preview");
  url.searchParams.set("utm_campaign", "npay_bridge_v11_install_smoke");
  url.searchParams.set("gtm_auth", environment.authorizationCode);
  url.searchParams.set("gtm_preview", `env-${environment.environmentId}`);
  url.searchParams.set("gtm_debug", "x");
  return url.toString();
};

const main = async () => {
  const auth = getAuth();
  const gtm = google.tagmanager({ version: "v2", auth });
  const workspacePath = `${CONTAINER_PATH}/workspaces/${WORKSPACE_ID}`;
  const quickPreview = await gtm.accounts.containers.workspaces.quick_preview({ path: workspacePath });
  const environments = await gtm.accounts.containers.environments.list({ parent: CONTAINER_PATH });
  const environment = (environments.data.environment ?? []).find((item) => item.workspaceId === WORKSPACE_ID);
  if (!environment) throw new Error(`preview environment for workspace ${WORKSPACE_ID} not found`);

  const previewUrl = buildPreviewUrl(environment);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const consoleLines: string[] = [];
  const networkErrors: string[] = [];
  page.on("console", (message) => {
    const text = message.text();
    if (text.includes("biocom-npay-bridge")) consoleLines.push(text);
  });
  page.on("requestfailed", (request) => {
    const url = request.url();
    if (url.includes("googletagmanager.com/gtm.js") || url.includes("/api/attribution/npay-intent")) {
      networkErrors.push(`${request.failure()?.errorText ?? "requestfailed"} ${redactPreviewUrl(url)}`);
    }
  });
  await page.route("**/gtm.js?id=GTM-W2Z6PHN**", async (route) => {
    const requested = new URL(route.request().url());
    requested.searchParams.set("gtm_auth", environment.authorizationCode ?? "");
    requested.searchParams.set("gtm_preview", `env-${environment.environmentId}`);
    requested.searchParams.set("gtm_debug", "x");
    const response = await page.context().request.get(requested.toString());
    await route.fulfill({
      status: response.status(),
      headers: {
        "content-type": response.headers()["content-type"] ?? "application/javascript",
        "cache-control": "no-store",
      },
      body: await response.body(),
    });
  });

  await page.goto(previewUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(5000);
  const state = await page.evaluate((expectedVersion) => ({
    installed_version: window.__BIOCOM_NPAY_BRIDGE_GTM_VERSION__ || "",
    expected_version: expectedVersion,
    installed: window.__BIOCOM_NPAY_BRIDGE_GTM_VERSION__ === expectedVersion,
    gtm_loaded: Boolean(window.google_tag_manager && window.google_tag_manager["GTM-W2Z6PHN"]),
    has_npay_text: /네이버페이|naver\s*pay|npay/i.test(document.body?.innerText || ""),
    href_path: window.location.pathname,
  }), EXPECTED_VERSION);
  await browser.close();

  const result = {
    generated_at: new Date().toISOString(),
    run_id: RUN_ID,
    workspace_id: WORKSPACE_ID,
    preview_environment_id: environment.environmentId ?? "",
    quick_preview: {
      sync_status: quickPreview.data.syncStatus ?? null,
      compiler_error: quickPreview.data.compilerError ?? null,
    },
    preview_url_redacted: redactPreviewUrl(previewUrl),
    state,
    console_lines: consoleLines,
    network_errors: networkErrors,
    no_npay_click_performed: true,
    no_platform_conversion_send: true,
    pass: Boolean(state.installed && state.gtm_loaded && !quickPreview.data.compilerError),
  };
  const output = writeJson(`npay-bridge-v11-gtm-preview-install-smoke-${RUN_ID}.json`, result);
  console.log(JSON.stringify({ ok: true, output, result }, null, 2));
  if (!result.pass) process.exit(2);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
