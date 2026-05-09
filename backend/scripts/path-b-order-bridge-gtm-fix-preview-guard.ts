import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { google } from "googleapis";
import { chromium, type Page } from "playwright";

dotenv.config({ path: path.resolve(process.cwd(), ".env"), quiet: true });
dotenv.config({ path: path.resolve(process.cwd(), "backend/.env"), override: false, quiet: true });

const ACCOUNT_ID = "4703003246";
const CONTAINER_ID = "13158774";
const CONTAINER_PUBLIC_ID = "GTM-W2Z6PHN";
const WORKSPACE_ID = process.env.PATH_B_GTM_WORKSPACE_ID?.trim() || "163";
const TAG_ID = process.env.PATH_B_GTM_TAG_ID?.trim() || "290";
const TAG_PATH = `accounts/${ACCOUNT_ID}/containers/${CONTAINER_ID}/workspaces/${WORKSPACE_ID}/tags/${TAG_ID}`;
const CONTAINER_PATH = `accounts/${ACCOUNT_ID}/containers/${CONTAINER_ID}`;
const OUTPUT_DIR = path.resolve(path.basename(process.cwd()) === "backend" ? path.resolve(process.cwd(), "..") : process.cwd(), "data");
const RUN_ID = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "Z");
const SYNTHETIC_ORDER_NO = `PATHB_GUARD_FIX_ORDER_${RUN_ID}`;
const SYNTHETIC_CLICK_ID = `TEST_GCLID_PATHB_GUARD_FIX_${RUN_ID}`;

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

const redactPreviewUrl = (url: string) =>
  url.replace(/gtm_auth=[^&]+/g, "gtm_auth=REDACTED")
    .replace(/gtm_preview=[^&]+/g, "gtm_preview=REDACTED");

const htmlParam = (tag: { parameter?: Array<{ key?: string | null; value?: string | null }> }) =>
  tag.parameter?.find((param) => param.key === "html");

const removeUrlPreviewGuard = (html: string) => {
  const withoutFunction = html.replace(
    /\n\s*function isPreview\(\) \{\n\s*return \/gtm_debug=\|gtm_preview=\|gtm_auth=\/\.test\(location\.search\);\n\s*\}\n/,
    "\n",
  );
  return withoutFunction.replace(
    /\n\s*if \(!isPreview\(\)\) \{\n\s*pushResult\("path_b_order_bridge_preview_blocked", \{ reason: "not_gtm_preview" \}\);\n\s*return;\n\s*\}\n/,
    "\n",
  );
};

const buildPreviewUrl = (env: { authorizationCode?: string | null; environmentId?: string | null }) => {
  if (!env.authorizationCode || !env.environmentId) {
    throw new Error("quick preview environment authorizationCode/environmentId missing");
  }
  const url = new URL("https://biocom.kr/shop_payment_complete");
  url.searchParams.set("order_no", SYNTHETIC_ORDER_NO);
  url.searchParams.set("gclid", SYNTHETIC_CLICK_ID);
  return {
    pageUrl: url.toString(),
    gtmAuth: env.authorizationCode,
    gtmPreview: `env-${env.environmentId}`,
  };
};

const runTagAssistantStyleSmoke = async (
  page: Page,
  env: { authorizationCode?: string | null; environmentId?: string | null },
) => {
  const receiverStatuses: number[] = [];
  const receiverBodies: Array<Record<string, unknown>> = [];
  const networkErrors: string[] = [];
  const consoleMarkers: string[] = [];
  const { pageUrl, gtmAuth, gtmPreview } = buildPreviewUrl(env);

  await page.route("**/gtm.js?id=GTM-W2Z6PHN**", async (route) => {
    const requested = new URL(route.request().url());
    requested.searchParams.set("gtm_auth", gtmAuth);
    requested.searchParams.set("gtm_preview", gtmPreview);
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

  page.on("console", (msg) => {
    const text = msg.text();
    if (text.includes("path_b_order_bridge_preview")) consoleMarkers.push(text);
  });
  page.on("requestfailed", (request) => {
    const url = request.url();
    if (url.includes("/api/attribution/order-bridge/identity-hmac/no-send") || url.includes("googletagmanager.com/gtm.js")) {
      networkErrors.push(`${request.failure()?.errorText ?? "requestfailed"} ${redactPreviewUrl(url)}`);
    }
  });
  page.on("response", async (response) => {
    const url = response.url();
    if (!url.includes("/api/attribution/order-bridge/identity-hmac/no-send")) return;
    receiverStatuses.push(response.status());
    receiverBodies.push(await response.json().catch(() => ({ ok: false })));
  });

  await page.goto(pageUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(7000);
  const pageState = await page.evaluate(`(() => ({
    href: window.location.href,
    installed: window.__pathb_order_bridge_preview_installed || null,
    result: window.__pathb_order_bridge_preview_last_result || null,
    error: window.__pathb_order_bridge_preview_last_error || null,
    gtmLoaded: Boolean(window.google_tag_manager && window.google_tag_manager[${JSON.stringify(CONTAINER_PUBLIC_ID)}])
  }))()`) as Record<string, unknown>;
  if (typeof pageState.href === "string") pageState.href = redactPreviewUrl(pageState.href);

  const serialized = JSON.stringify(receiverBodies);
  return {
    page_url_redacted: redactPreviewUrl(pageUrl),
    receiver_statuses: receiverStatuses,
    receiver_reached: receiverStatuses.length > 0,
    receiver_ok_all: receiverBodies.length > 0 && receiverBodies.every((body) => body.ok === true),
    raw_echo_detected: [SYNTHETIC_ORDER_NO, SYNTHETIC_CLICK_ID].some((raw) => serialized.includes(raw)),
    network_errors: networkErrors,
    console_markers: consoleMarkers,
    page_state: pageState,
  };
};

const main = async () => {
  const auth = getAuth();
  const gtm = google.tagmanager({ version: "v2", auth });
  const tag = await gtm.accounts.containers.workspaces.tags.get({ path: TAG_PATH });
  const param = htmlParam(tag.data);
  if (!param?.value) throw new Error(`tag ${TAG_PATH} html parameter missing`);
  const nextHtml = removeUrlPreviewGuard(param.value);
  if (nextHtml === param.value) {
    throw new Error("URL preview guard pattern not found; aborting to avoid unsafe blind update");
  }
  param.value = nextHtml;
  const updated = await gtm.accounts.containers.workspaces.tags.update({
    path: TAG_PATH,
    requestBody: tag.data,
  });
  const quickPreview = await gtm.accounts.containers.workspaces.quick_preview({
    path: `accounts/${ACCOUNT_ID}/containers/${CONTAINER_ID}/workspaces/${WORKSPACE_ID}`,
  });
  const environments = await gtm.accounts.containers.environments.list({ parent: CONTAINER_PATH });
  const environment = (environments.data.environment ?? [])
    .find((item) => item.workspaceId === WORKSPACE_ID);
  if (!environment) throw new Error(`quick preview environment for workspace ${WORKSPACE_ID} not found`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const smoke = await runTagAssistantStyleSmoke(page, environment);
  await browser.close();

  const result = {
    generated_at_kst: new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(new Date()).replace(" ", "T"),
    workspace_id: WORKSPACE_ID,
    tag_id: TAG_ID,
    tag_name: updated.data.name,
    change: "removed URL-based gtm_debug/gtm_preview/gtm_auth guard",
    reason: "Tag Assistant connected preview may not append preview params to location.search; unpublished workspace already scopes execution to Preview.",
    quick_preview: {
      sync_status: quickPreview.data.syncStatus ?? null,
      compiler_error: quickPreview.data.compilerError ?? null,
      environment_id: environment.environmentId,
      authorization_code_redacted: Boolean(environment.authorizationCode),
    },
    tag_assistant_style_smoke: smoke,
    forbidden_actions_not_taken: [
      "GTM submit/create_version",
      "GTM Production publish",
      "Imweb production save",
      "platform send",
      "operational schema migration",
      "backend operational storage canary",
    ],
    verdict:
      smoke.receiver_reached
      && smoke.receiver_ok_all
      && !smoke.raw_echo_detected
      && smoke.network_errors.length === 0
        ? "PASS_PREVIEW_GUARD_FIX"
        : "HOLD_PREVIEW_GUARD_FIX_SMOKE",
  };

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const outPath = path.join(OUTPUT_DIR, `path-b-gtm-preview-guard-fix-${RUN_ID}.json`);
  fs.writeFileSync(outPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  fs.writeFileSync(path.join(OUTPUT_DIR, "path-b-gtm-preview-guard-fix-latest.json"), `${JSON.stringify(result, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({
    verdict: result.verdict,
    workspace_id: WORKSPACE_ID,
    tag_id: TAG_ID,
    output: outPath,
    receiver_statuses: smoke.receiver_statuses,
    page_state_result: smoke.page_state.result ?? null,
  }, null, 2));
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
