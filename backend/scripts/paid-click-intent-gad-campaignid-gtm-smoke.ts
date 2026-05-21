import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { google } from "googleapis";
import { chromium, type Page } from "playwright";

const repoRoot = path.resolve(process.cwd(), process.cwd().endsWith("/backend") ? ".." : ".");
const backendDir = path.join(repoRoot, "backend");

dotenv.config({ path: path.join(repoRoot, ".env"), quiet: true });
dotenv.config({ path: path.join(backendDir, ".env"), override: false, quiet: true });

const ACCOUNT_ID = "4703003246";
const CONTAINER_ID = "13158774";
const CONTAINER_PUBLIC_ID = "GTM-W2Z6PHN";
const CONTAINER_PATH = `accounts/${ACCOUNT_ID}/containers/${CONTAINER_ID}`;
const BASE = "https://tagmanager.googleapis.com/tagmanager/v2";
const WORKSPACE_ID = process.env.GTM_PAID_CLICK_INTENT_WORKSPACE_ID?.trim() || "168";
const RUN_ID = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "Z");
const OUTPUT_PATH = path.join(repoRoot, `data/gtm-paid-click-intent-tag279-preview-smoke-${RUN_ID}.json`);
const TEST_CLICK_ID = `TEST_GCLID_GAD_CAMPAIGNID_${RUN_ID}`;
const TEST_GBRAID = `TEST_GBRAID_GAD_CAMPAIGNID_${RUN_ID}`;
const TEST_URL =
  `https://biocom.kr/mineraltest_store/?idx=6`
  + `&utm_source=googleads_testsa_mineral_sa`
  + `&utm_medium=googleads_testsa_mineral_sa`
  + `&utm_campaign=googleads_testSA_mineral_SA`
  + `&utm_content=googleads_testSA_mineral_SA`
  + `&gad_source=1`
  + `&gad_campaignid=14629255429`
  + `&gbraid=${encodeURIComponent(TEST_GBRAID)}`
  + `&gclid=${encodeURIComponent(TEST_CLICK_ID)}`;

type RequestOptions = {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
};

const credentialsJson =
  process.env.GA4_BIOCOM_SERVICE_ACCOUNT_KEY?.trim()
  || process.env.GSC_SERVICE_ACCOUNT_KEY?.trim();

if (!credentialsJson) {
  throw new Error("GA4_BIOCOM_SERVICE_ACCOUNT_KEY or GSC_SERVICE_ACCOUNT_KEY is required");
}

const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(credentialsJson),
  scopes: [
    "https://www.googleapis.com/auth/tagmanager.readonly",
    "https://www.googleapis.com/auth/tagmanager.edit.containers",
    "https://www.googleapis.com/auth/tagmanager.edit.containerversions",
  ],
});

async function accessToken() {
  const client = await auth.getClient();
  const access = await client.getAccessToken();
  const token = typeof access === "string" ? access : access?.token;
  if (!token) throw new Error("failed to get Google API access token");
  return token;
}

async function gtmRequest<T>(token: string, url: string, options: RequestOptions = {}): Promise<T> {
  const response = await fetch(url, {
    method: options.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(`${options.method ?? "GET"} ${url} failed ${response.status}: ${JSON.stringify(body)}`);
  }
  return body as T;
}

const redactPreviewUrl = (url: string) =>
  url
    .replace(/gtm_auth=[^&]+/g, "gtm_auth=REDACTED")
    .replace(/gtm_preview=[^&]+/g, "gtm_preview=REDACTED");

function summarizeEntity(entity: any) {
  const tag = entity?.tag;
  const trigger = entity?.trigger;
  const variable = entity?.variable;
  return {
    tag: tag ? {
      tagId: tag.tagId,
      name: tag.name,
      type: tag.type,
      firingTriggerId: tag.firingTriggerId ?? [],
      blockingTriggerId: tag.blockingTriggerId ?? [],
    } : null,
    trigger: trigger ? {
      triggerId: trigger.triggerId,
      name: trigger.name,
      type: trigger.type,
    } : null,
    variable: variable ? {
      variableId: variable.variableId,
      name: variable.name,
      type: variable.type,
    } : null,
  };
}

function summarizeWorkspaceStatus(workspace: any, status: any) {
  return {
    workspaceId: workspace.workspaceId,
    name: workspace.name,
    path: workspace.path,
    workspaceChangeCount: (status.workspaceChange ?? []).length,
    mergeConflictCount: (status.mergeConflict ?? []).length,
    changes: (status.workspaceChange ?? []).map((change: any) => ({
      changeStatus: change.changeStatus,
      entity: summarizeEntity(change),
    })),
    conflicts: (status.mergeConflict ?? []).map((conflict: any) => ({
      base: summarizeEntity(conflict.entityInBaseVersion),
      workspace: summarizeEntity(conflict.entityInWorkspace),
    })),
  };
}

async function readWorkspaceSummaries(token: string) {
  const workspaces = await gtmRequest<any>(token, `${BASE}/${CONTAINER_PATH}/workspaces`);
  const list = workspaces.workspace ?? [];
  const selected = list.filter((workspace: any) =>
    workspace.workspaceId === WORKSPACE_ID
    || workspace.workspaceId === "167"
    || /default workspace/i.test(workspace.name ?? "")
  );
  const summaries = [];
  for (const workspace of selected) {
    const status = await gtmRequest<any>(token, `${BASE}/${workspace.path}/status`);
    summaries.push(summarizeWorkspaceStatus(workspace, status));
  }
  return {
    allWorkspaces: list.map((workspace: any) => ({
      workspaceId: workspace.workspaceId,
      name: workspace.name,
      path: workspace.path,
    })),
    selected: summaries,
  };
}

async function preparePreview(token: string) {
  const workspacePath = `${CONTAINER_PATH}/workspaces/${WORKSPACE_ID}`;
  const workspace = await gtmRequest<any>(token, `${BASE}/${workspacePath}`);
  const quickPreview = await gtmRequest<any>(token, `${BASE}/${workspacePath}:quick_preview`, { method: "POST" });
  const environments = await gtmRequest<any>(token, `${BASE}/${CONTAINER_PATH}/environments`);
  const environment = (environments.environment ?? []).find((item: any) => item.workspaceId === WORKSPACE_ID);
  if (!environment?.authorizationCode || !environment?.environmentId) {
    throw new Error(`quick preview environment not found for workspace ${WORKSPACE_ID}`);
  }
  return { workspace, quickPreview, environment };
}

async function runPreviewPage(environment: any) {
  const previewUrl = new URL(TEST_URL);
  previewUrl.searchParams.set("gtm_auth", environment.authorizationCode);
  previewUrl.searchParams.set("gtm_preview", `env-${environment.environmentId}`);
  previewUrl.searchParams.set("gtm_debug", "x");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1365, height: 900 },
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();
  const consoleMessages: string[] = [];
  const networkErrors: string[] = [];
  const blockedExternalPlatformRequests: string[] = [];
  const gtmScriptRoutes: string[] = [];
  const receiverResponses: Array<{ status: number; ok: boolean; body: unknown }> = [];

  await page.route("**/*", async (route) => {
    const url = route.request().url();
    const parsed = new URL(url);
    const host = parsed.hostname;
    const isExternalMeasurement =
      host === "www.google-analytics.com"
      || host === "stats.g.doubleclick.net"
      || (host === "www.google.com" && parsed.pathname.startsWith("/ccm/collect"))
      || (host === "www.googleadservices.com" && parsed.pathname.startsWith("/pagead/"));
    if (isExternalMeasurement) {
      blockedExternalPlatformRequests.push(redactPreviewUrl(url));
      await route.fulfill({ status: 204, body: "" });
      return;
    }
    await route.continue();
  });

  await page.route("**/gtm.js?id=GTM-W2Z6PHN**", async (route) => {
    const requested = new URL(route.request().url());
    requested.searchParams.set("gtm_auth", environment.authorizationCode ?? "");
    requested.searchParams.set("gtm_preview", `env-${environment.environmentId}`);
    requested.searchParams.set("gtm_debug", "x");
    gtmScriptRoutes.push(redactPreviewUrl(requested.toString()));
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

  page.on("console", (message) => {
    const text = message.text();
    if (/paid_click|seo_|gtm|gad_campaignid/i.test(text)) consoleMessages.push(text.slice(0, 500));
  });
  page.on("requestfailed", (request) => {
    const url = request.url();
    if (url.includes("googletagmanager") || url.includes("/api/attribution/paid-click-intent/no-send")) {
      networkErrors.push(`${request.failure()?.errorText ?? "requestfailed"} ${redactPreviewUrl(url)}`);
    }
  });
  page.on("response", async (response) => {
    const url = response.url();
    if (!url.includes("/api/attribution/paid-click-intent/no-send")) return;
    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      body = await response.text().catch(() => null);
    }
    receiverResponses.push({ status: response.status(), ok: response.ok(), body });
  });

  let pageLoaded = false;
  try {
    await page.goto(previewUrl.toString(), { waitUntil: "domcontentloaded", timeout: 45000 });
    pageLoaded = true;
  } catch (error) {
    networkErrors.push(`page.goto ${error instanceof Error ? error.message : String(error)}`);
  }
  await page.waitForTimeout(5500);

  const pageState = await page.evaluate(`(() => {
    const storageKey = "bi_paid_click_intent_v1";
    const sentKey = "bi_paid_click_intent_v1_sent";
    const parse = (value) => {
      try { return value ? JSON.parse(value) : null; } catch { return value; }
    };
    const localRaw = window.localStorage.getItem(storageKey);
    const sessionRaw = window.sessionStorage.getItem(storageKey);
    const sentRaw = window.sessionStorage.getItem(sentKey);
    const tagManager = window.google_tag_manager && window.google_tag_manager[${JSON.stringify(CONTAINER_PUBLIC_ID)}];
    return {
      href: window.location.href,
      gtmLoaded: Boolean(tagManager),
      installed: window.__seo_paid_click_intent_installed || null,
      lastPayload: window.__seo_paid_click_intent_last_payload || null,
      lastStatus: window.__seo_paid_click_intent_last_status || null,
      lastError: window.__seo_paid_click_intent_last_error || null,
      localStorage: parse(localRaw),
      sessionStorage: parse(sessionRaw),
      sentDedupe: parse(sentRaw),
    };
  })()`) as Record<string, unknown>;

  const screenshotPath = path.join(repoRoot, `data/gtm-paid-click-intent-tag279-preview-smoke-${RUN_ID}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: false }).catch(() => undefined);
  await context.close();
  await browser.close();

  return {
    testUrlRedacted: redactPreviewUrl(previewUrl.toString()),
    pageLoaded,
    pageState,
    receiverResponses,
    consoleMessages,
    networkErrors,
    blockedExternalPlatformRequests,
    gtmScriptRoutes,
    screenshotPath,
  };
}

async function main() {
  const token = await accessToken();
  const live = await gtmRequest<any>(token, `${BASE}/${CONTAINER_PATH}/versions:live`);
  const workspaceSummariesBefore = await readWorkspaceSummaries(token);
  const preview = await preparePreview(token);
  const smoke = await runPreviewPage(preview.environment);
  const workspaceSummariesAfter = await readWorkspaceSummaries(token);

  const payload = (smoke.pageState as any).lastPayload ?? {};
  const result = {
    generatedAt: new Date().toISOString(),
    runId: RUN_ID,
    mode: "gtm_preview_workspace_168_existing_tag_279_smoke",
    container: {
      accountId: ACCOUNT_ID,
      containerId: CONTAINER_ID,
      publicId: CONTAINER_PUBLIC_ID,
      liveVersionId: live.containerVersionId,
      liveVersionName: live.name,
    },
    workspace: {
      targetWorkspaceId: WORKSPACE_ID,
      quickPreviewCompilerError: preview.quickPreview.compilerError ?? null,
      quickPreviewSyncStatus: preview.quickPreview.syncStatus ?? null,
      environmentId: preview.environment.environmentId,
      authorizationCodePresent: Boolean(preview.environment.authorizationCode),
    },
    workspaceSummariesBefore,
    workspaceSummariesAfter,
    smoke,
    assertions: {
      pageLoaded: smoke.pageLoaded,
      gtmLoaded: Boolean((smoke.pageState as any).gtmLoaded),
      v2Installed: (smoke.pageState as any).installed === "paid_click_intent_v2_gad_campaignid_20260521",
      payloadPresent: Boolean(payload && Object.keys(payload).length > 0),
      gadCampaignIdInPayload: payload.gad_campaignid === "14629255429",
      gadSourceInPayload: payload.gad_source === "1",
      gadCampaignIdInLandingUrl: String(payload.landing_url ?? "").includes("gad_campaignid=14629255429"),
      googleClickIdPresent: Boolean(payload.gclid || payload.gbraid || payload.wbraid),
      receiverReached: smoke.receiverResponses.length > 0,
      receiverOk: smoke.receiverResponses.some((item) => item.ok),
      noNetworkErrors: smoke.networkErrors.length === 0,
      externalMeasurementRequestsBlocked: smoke.blockedExternalPlatformRequests.length > 0,
      productionPublished: false,
      submitCreateVersionPublish: false,
      platformSend: false,
    },
  };

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({
    outputPath: OUTPUT_PATH,
    assertions: result.assertions,
    workspace: result.workspace,
    workspaces: workspaceSummariesAfter.selected.map((workspace) => ({
      workspaceId: workspace.workspaceId,
      name: workspace.name,
      workspaceChangeCount: workspace.workspaceChangeCount,
      mergeConflictCount: workspace.mergeConflictCount,
      changes: workspace.changes,
    })),
    screenshotPath: smoke.screenshotPath,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
