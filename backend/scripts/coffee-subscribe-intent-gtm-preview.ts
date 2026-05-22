import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { google } from "googleapis";
import { chromium, type Page } from "playwright";

const repoRoot = path.resolve(process.cwd(), process.cwd().endsWith("/backend") ? ".." : ".");
const backendDir = path.join(repoRoot, "backend");

dotenv.config({ path: path.join(repoRoot, ".env"), quiet: true });
dotenv.config({ path: path.join(backendDir, ".env"), override: false, quiet: true });

const ACCOUNT_ID = process.env.GTM_COFFEE_ACCOUNT_ID?.trim() || "4703003246";
const CONTAINER_ID = process.env.GTM_COFFEE_CONTAINER_ID?.trim() || "91608400";
const CONTAINER_PUBLIC_ID = "GTM-5M33GC4";
const CONTAINER_PATH = `accounts/${ACCOUNT_ID}/containers/${CONTAINER_ID}`;
const BASE = "https://tagmanager.googleapis.com/tagmanager/v2";
const RUN_ID = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "Z");
const OUTPUT_DIR = path.join(repoRoot, "data");
const SCREENSHOT_DIR = path.join(OUTPUT_DIR, "screenshots");
const TAG_HTML_PATH = path.join(repoRoot, "scripts", "coffee-subscribe-intent-gtm-preview-tag.html");
const WORKSPACE_NAME = `codex_coffee_subscribe_intent_preview_${RUN_ID}`;
const TAG_NAME = `AGENTOS - [no-send] coffee_subscribe_intent_preview_listener ${RUN_ID}`;
const TRIGGER_NAME = `AGENTOS - [preview] coffee subscription path DOM Ready ${RUN_ID}`;
const SUBSCRIPTION_URL = "https://thecleancoffee.com/subscription/?idx=74&__seo_attribution_debug=1";
const PRODUCT_URL = "https://thecleancoffee.com/thecleancoffee/?idx=75&__seo_attribution_debug=1";
const SUBSCRIPTION_PATH_REGEX = "^/subscription/?$";
const EXPECTED_SNIPPET_VERSION = "2026-05-22-coffee-subscribe-intent-gtm-preview-v1";

type RequestOptions = {
  method?: string;
  body?: unknown;
};

type LiveVersion = {
  id: string;
  name: string;
  fingerprint: string;
};

type PreviewEnvironment = {
  authorizationCode?: string | null;
  environmentId?: string | null;
  workspaceId?: string | null;
  type?: string | null;
  name?: string | null;
};

type CreatedPreview = {
  gtm: ReturnType<typeof google.tagmanager>;
  liveVersionBefore: LiveVersion;
  workspaceCountBefore: number;
  workspacesBefore: Array<{ workspaceId?: string | null; name?: string | null; path?: string | null }>;
  workspace: Record<string, unknown>;
  trigger: Record<string, unknown>;
  tag: Record<string, unknown>;
  quickPreview: Record<string, unknown>;
  environment: PreviewEnvironment | null;
  statusBeforeCleanup: Record<string, unknown>;
};

type SmokeCase = {
  kind: "subscription_valid" | "subscription_option_like" | "normal_product_ignored";
  url: string;
  action: "valid_subscribe_click" | "option_like_click";
  expectInstalled: boolean;
  expectEvents: number;
};

type SmokeResult = {
  kind: SmokeCase["kind"];
  previewUrl: string;
  pageLoaded: boolean;
  installed: string | null;
  gtmLoaded: boolean;
  gtmScriptRoutes: string[];
  consoleMarkers: string[];
  networkErrors: string[];
  measurementRequestsAfterClick: string[];
  screenshotPath: string;
  actionResult: Record<string, unknown>;
  pageState: Record<string, unknown>;
  pass: boolean;
  passReasons: Record<string, boolean>;
};

const TEST_CASES: SmokeCase[] = [
  {
    kind: "subscription_valid",
    url: SUBSCRIPTION_URL,
    action: "valid_subscribe_click",
    expectInstalled: true,
    expectEvents: 1,
  },
  {
    kind: "subscription_option_like",
    url: SUBSCRIPTION_URL,
    action: "option_like_click",
    expectInstalled: true,
    expectEvents: 0,
  },
  {
    kind: "normal_product_ignored",
    url: PRODUCT_URL,
    action: "valid_subscribe_click",
    expectInstalled: false,
    expectEvents: 0,
  },
];

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
    "https://www.googleapis.com/auth/tagmanager.delete.containers",
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

function kstTimestamp() {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date()).replace(" ", "T");
}

function writeJson(filePath: string, value: unknown) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function redactPreviewUrl(url: string) {
  return url
    .replace(/gtm_auth=[^&]+/g, "gtm_auth=REDACTED")
    .replace(/gtm_preview=[^&]+/g, "gtm_preview=REDACTED");
}

function buildPreviewUrl(baseUrl: string, env: PreviewEnvironment) {
  if (!env.authorizationCode || !env.environmentId) {
    throw new Error("quick preview environment authorizationCode/environmentId missing");
  }
  const url = new URL(baseUrl);
  url.searchParams.set("gtm_auth", env.authorizationCode);
  url.searchParams.set("gtm_preview", `env-${env.environmentId}`);
  url.searchParams.set("gtm_debug", "x");
  return url.toString();
}

function isMeasurementUrl(rawUrl: string) {
  try {
    const url = new URL(rawUrl);
    const host = url.hostname;
    return host === "www.facebook.com"
      && url.pathname.startsWith("/tr")
      || host === "www.google-analytics.com"
      && url.pathname.startsWith("/g/collect")
      || host === "stats.g.doubleclick.net"
      || host === "www.googleadservices.com"
      || host === "wcs.naver.net"
      || host === "pay.naver.com"
      || host === "att.ainativeos.net";
  } catch {
    return /facebook\.com\/tr|google-analytics\.com\/g\/collect|googleadservices|wcs\.naver|pay\.naver|att\.ainativeos\.net/.test(rawUrl);
  }
}

function summarizeChange(change: any) {
  return {
    changeStatus: change.changeStatus ?? null,
    tag: change.tag ? {
      tagId: change.tag.tagId,
      name: change.tag.name,
      type: change.tag.type,
      firingTriggerId: change.tag.firingTriggerId ?? [],
    } : null,
    trigger: change.trigger ? {
      triggerId: change.trigger.triggerId,
      name: change.trigger.name,
      type: change.trigger.type,
    } : null,
  };
}

async function getLiveVersion(token: string): Promise<LiveVersion> {
  const live = await gtmRequest<any>(token, `${BASE}/${CONTAINER_PATH}/versions:live`);
  return {
    id: live.containerVersionId ?? "",
    name: live.name ?? "",
    fingerprint: live.fingerprint ?? "",
  };
}

async function createPreviewWorkspace(): Promise<CreatedPreview> {
  const token = await accessToken();
  const gtm = google.tagmanager({ version: "v2", auth });
  const containers = await gtm.accounts.containers.list({ parent: `accounts/${ACCOUNT_ID}` });
  const targetContainer = (containers.data.container ?? [])
    .find((container) => container.containerId === CONTAINER_ID);
  if (!targetContainer) {
    throw new Error(`target container not found: accounts/${ACCOUNT_ID}/containers/${CONTAINER_ID}`);
  }
  if (targetContainer.publicId !== CONTAINER_PUBLIC_ID) {
    throw new Error(
      `container public id mismatch: expected ${CONTAINER_PUBLIC_ID}, got ${targetContainer.publicId ?? "(blank)"}`,
    );
  }
  const liveVersionBefore = await getLiveVersion(token);
  const workspacesBeforeResponse = await gtm.accounts.containers.workspaces.list({ parent: CONTAINER_PATH });
  const workspacesBefore = (workspacesBeforeResponse.data.workspace ?? []).map((workspace) => ({
    workspaceId: workspace.workspaceId,
    name: workspace.name,
    path: workspace.path,
  }));

  const tagHtml = fs.readFileSync(TAG_HTML_PATH, "utf8");
  const workspace = await gtm.accounts.containers.workspaces.create({
    parent: CONTAINER_PATH,
    requestBody: {
      name: WORKSPACE_NAME,
      description:
        "Codex 더클린커피 subscription intent GTM Preview only. No submit/create version/publish/platform send.",
    },
  });
  if (!workspace.data.path || !workspace.data.workspaceId) {
    throw new Error("workspace create succeeded but path/workspaceId missing");
  }

  try {
    const trigger = await gtm.accounts.containers.workspaces.triggers.create({
      parent: workspace.data.path,
      requestBody: {
        name: TRIGGER_NAME,
        type: "domReady",
        filter: [
          {
            type: "equals",
            parameter: [
              { type: "template", key: "arg0", value: "{{Page Hostname}}" },
              { type: "template", key: "arg1", value: "thecleancoffee.com" },
            ],
          },
          {
            type: "matchRegex",
            parameter: [
              { type: "template", key: "arg0", value: "{{Page Path}}" },
              { type: "template", key: "arg1", value: SUBSCRIPTION_PATH_REGEX },
              { type: "boolean", key: "ignore_case", value: "true" },
            ],
          },
        ],
        notes: "Preview only. Fires only on thecleancoffee.com/subscription. Do not submit/publish.",
      },
    });
    if (!trigger.data.triggerId) throw new Error("trigger create succeeded but triggerId missing");

    const tag = await gtm.accounts.containers.workspaces.tags.create({
      parent: workspace.data.path,
      requestBody: {
        name: TAG_NAME,
        type: "html",
        parameter: [
          { type: "template", key: "html", value: tagHtml },
          { type: "boolean", key: "supportDocumentWrite", value: "false" },
        ],
        firingTriggerId: [trigger.data.triggerId],
        notes:
          "Preview only. Pushes coffee_subscribe_intent_preview into dataLayer. No fbq/gtag/fetch/sendBeacon/Image/platform send.",
      },
    });
    if (!tag.data.tagId) throw new Error("tag create succeeded but tagId missing");

    const quickPreview = await gtm.accounts.containers.workspaces.quick_preview({
      path: workspace.data.path,
    });
    const environments = await gtm.accounts.containers.environments.list({ parent: CONTAINER_PATH });
    const environment = (environments.data.environment ?? [])
      .find((item) => item.workspaceId === workspace.data.workspaceId) ?? null;
    const status = await gtmRequest<any>(token, `${BASE}/${workspace.data.path}/status`);

    return {
      gtm,
      liveVersionBefore,
      workspaceCountBefore: workspacesBefore.length,
      workspacesBefore,
      workspace: workspace.data as Record<string, unknown>,
      trigger: trigger.data as Record<string, unknown>,
      tag: tag.data as Record<string, unknown>,
      quickPreview: quickPreview.data as Record<string, unknown>,
      environment: environment as PreviewEnvironment | null,
      statusBeforeCleanup: {
        workspaceChangeCount: status.workspaceChange?.length ?? 0,
        mergeConflictCount: status.mergeConflict?.length ?? 0,
        changes: (status.workspaceChange ?? []).map(summarizeChange),
      },
    };
  } catch (error) {
    await gtm.accounts.containers.workspaces.delete({ path: workspace.data.path }).catch(() => undefined);
    throw error;
  }
}

async function addPreviewRoute(page: Page, environment: PreviewEnvironment, routes: string[]) {
  await page.route(`**/gtm.js?id=${CONTAINER_PUBLIC_ID}**`, async (route) => {
    const requested = new URL(route.request().url());
    requested.searchParams.set("gtm_auth", environment.authorizationCode ?? "");
    requested.searchParams.set("gtm_preview", `env-${environment.environmentId}`);
    requested.searchParams.set("gtm_debug", "x");
    routes.push(redactPreviewUrl(requested.toString()));
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
}

async function runCase(
  browser: Awaited<ReturnType<typeof chromium.launch>>,
  testCase: SmokeCase,
  environment: PreviewEnvironment,
): Promise<SmokeResult> {
  const context = await browser.newContext({
    viewport: { width: 1365, height: 900 },
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();
  const gtmScriptRoutes: string[] = [];
  const consoleMarkers: string[] = [];
  const networkErrors: string[] = [];
  const measurementRequestsAfterClick: string[] = [];
  let afterClickStartedAt = 0;

  await addPreviewRoute(page, environment, gtmScriptRoutes);

  page.on("console", (message) => {
    const text = message.text();
    if (/coffee-subscribe-intent-gtm-preview|gtm|Tag Manager/i.test(text)) {
      consoleMarkers.push(text.slice(0, 500));
    }
  });
  page.on("request", (request) => {
    if (afterClickStartedAt > 0 && Date.now() >= afterClickStartedAt && isMeasurementUrl(request.url())) {
      measurementRequestsAfterClick.push(redactPreviewUrl(request.url()));
    }
  });
  page.on("requestfailed", (request) => {
    const url = request.url();
    if (url.includes("googletagmanager.com/gtm.js")) {
      networkErrors.push(`${request.failure()?.errorText ?? "requestfailed"} ${redactPreviewUrl(url)}`);
    }
  });

  const previewUrl = buildPreviewUrl(testCase.url, environment);
  let pageLoaded = false;
  try {
    await page.goto(previewUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
    pageLoaded = true;
  } catch (error) {
    networkErrors.push(`page.goto: ${error instanceof Error ? error.message : String(error)}`);
  }

  await page.waitForTimeout(6000);
  afterClickStartedAt = Date.now();
  const actionResult = await page.evaluate((action) => {
    const previewWindow = window as any;
    const historyBefore = Array.isArray(previewWindow.__THECLEANCOFFEE_SUBSCRIBE_INTENT_GTM_PREVIEW_HISTORY__)
      ? previewWindow.__THECLEANCOFFEE_SUBSCRIBE_INTENT_GTM_PREVIEW_HISTORY__.length
      : 0;
    const dataLayerBefore = Array.isArray(previewWindow.dataLayer)
      ? previewWindow.dataLayer.filter((item: any) => item && item.event === "coffee_subscribe_intent_preview").length
      : 0;

    const button = document.createElement("button");
    button.type = "button";
    if (action === "valid_subscribe_click") {
      button.textContent = "정기구독 신청";
      button.className = "im-regularly";
      button.setAttribute("data-bs-is-regularly-prod", "true");
      button.setAttribute("data-bs-content", "purchase");
      button.setAttribute("data-bs-payment-button-type", "imweb_payment");
      button.setAttribute("data-bs-prod-code", "synthetic_preview_product_code");
      button.setAttribute("data-bs-prod-type", "regularly");
      button.setAttribute("data-bs-where", "detail");
    } else {
      button.textContent = "중량 (필수)";
      button.className = "dropdown-toggle";
      button.setAttribute("aria-haspopup", "listbox");
    }
    button.style.position = "fixed";
    button.style.left = "0";
    button.style.bottom = "0";
    button.style.zIndex = "2147483647";
    document.body.appendChild(button);

    button.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
    if (action === "valid_subscribe_click") {
      button.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
    }

    const historyAfter = Array.isArray(previewWindow.__THECLEANCOFFEE_SUBSCRIBE_INTENT_GTM_PREVIEW_HISTORY__)
      ? previewWindow.__THECLEANCOFFEE_SUBSCRIBE_INTENT_GTM_PREVIEW_HISTORY__.length
      : 0;
    const dataLayerAfter = Array.isArray(previewWindow.dataLayer)
      ? previewWindow.dataLayer.filter((item: any) => item && item.event === "coffee_subscribe_intent_preview").length
      : 0;

    return {
      action,
      historyBefore,
      historyAfter,
      historyDelta: historyAfter - historyBefore,
      dataLayerBefore,
      dataLayerAfter,
      dataLayerDelta: dataLayerAfter - dataLayerBefore,
      syntheticButtonRemoved: Boolean(button.parentNode),
    };
  }, testCase.action);
  await page.waitForTimeout(1200);

  const pageState = await page.evaluate((publicId) => {
    const previewWindow = window as any;
    const history = Array.isArray(previewWindow.__THECLEANCOFFEE_SUBSCRIBE_INTENT_GTM_PREVIEW_HISTORY__)
      ? previewWindow.__THECLEANCOFFEE_SUBSCRIBE_INTENT_GTM_PREVIEW_HISTORY__
      : [];
    const last = previewWindow.__THECLEANCOFFEE_SUBSCRIBE_INTENT_GTM_PREVIEW_LAST__ || null;
    const dataLayerEvents = Array.isArray(previewWindow.dataLayer)
      ? previewWindow.dataLayer
        .filter((item: any) => item && item.event === "coffee_subscribe_intent_preview")
        .map((item: any) => {
          try {
            return JSON.parse(JSON.stringify(item));
          } catch {
            return String(item);
          }
        })
      : [];
    return {
      href: window.location.href.replace(/gtm_auth=[^&]+/g, "gtm_auth=REDACTED").replace(/gtm_preview=[^&]+/g, "gtm_preview=REDACTED"),
      installed: previewWindow.__THECLEANCOFFEE_SUBSCRIBE_INTENT_GTM_PREVIEW__ || null,
      historyLength: history.length,
      last,
      dataLayerEventCount: dataLayerEvents.length,
      dataLayerEvents,
      gtmLoaded: Boolean(previewWindow.google_tag_manager && previewWindow.google_tag_manager[publicId]),
    };
  }, CONTAINER_PUBLIC_ID) as Record<string, unknown>;

  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const screenshotPath = path.join(SCREENSHOT_DIR, `coffee-subscribe-intent-gtm-preview-${RUN_ID}-${testCase.kind}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: false }).catch(() => undefined);
  await context.close();

  const installed = typeof pageState.installed === "string" ? pageState.installed : null;
  const actionDataLayerDelta = Number(actionResult.dataLayerDelta ?? 0);
  const actionHistoryDelta = Number(actionResult.historyDelta ?? 0);
  const passReasons = {
    pageLoaded,
    expectedInstallState: testCase.expectInstalled
      ? installed === EXPECTED_SNIPPET_VERSION
      : installed === null,
    expectedEventDelta:
      actionDataLayerDelta === testCase.expectEvents && actionHistoryDelta === testCase.expectEvents,
    noMeasurementDeltaAfterClick: measurementRequestsAfterClick.length === 0,
    gtmScriptLoadedViaPreview: gtmScriptRoutes.length > 0,
  };

  return {
    kind: testCase.kind,
    previewUrl: redactPreviewUrl(previewUrl),
    pageLoaded,
    installed,
    gtmLoaded: Boolean(pageState.gtmLoaded),
    gtmScriptRoutes,
    consoleMarkers,
    networkErrors,
    measurementRequestsAfterClick,
    screenshotPath,
    actionResult,
    pageState,
    pass: Object.values(passReasons).every(Boolean),
    passReasons,
  };
}

async function main() {
  const created = await createPreviewWorkspace();
  if (!created.environment) {
    throw new Error(`workspace ${created.workspace.workspaceId} quick preview environment not found`);
  }

  const cleanup: Array<Record<string, unknown>> = [];
  const results: SmokeResult[] = [];
  let smokeError = "";
  let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;
  try {
    browser = await chromium.launch({ headless: true });
    for (const testCase of TEST_CASES) {
      results.push(await runCase(browser, testCase, created.environment));
    }
  } catch (error) {
    smokeError = error instanceof Error ? error.message : String(error);
  } finally {
    await browser?.close().catch(() => undefined);
  }

  const token = await accessToken();
  const backupPath = path.join(OUTPUT_DIR, `coffee-subscribe-intent-gtm-preview-workspace-backup-${RUN_ID}.json`);
  writeJson(backupPath, {
    generated_at_kst: kstTimestamp(),
    run_id: RUN_ID,
    container: {
      account_id: ACCOUNT_ID,
      container_id: CONTAINER_ID,
      public_id: CONTAINER_PUBLIC_ID,
      live_version_before: created.liveVersionBefore,
    },
    workspace: created.workspace,
    trigger: created.trigger,
    tag: created.tag,
    quick_preview: created.quickPreview,
    environment: created.environment ? {
      environmentId: created.environment.environmentId,
      workspaceId: created.environment.workspaceId,
      type: created.environment.type,
      name: created.environment.name,
      authorizationCodePresent: Boolean(created.environment.authorizationCode),
    } : null,
    status_before_cleanup: created.statusBeforeCleanup,
    smoke_error: smokeError,
    smoke_results: results.map((item) => ({
      kind: item.kind,
      pass: item.pass,
      passReasons: item.passReasons,
      screenshotPath: item.screenshotPath,
    })),
  });

  try {
    await created.gtm.accounts.containers.workspaces.delete({ path: String(created.workspace.path) });
    cleanup.push({
      deleted: true,
      workspaceId: created.workspace.workspaceId,
      name: created.workspace.name,
      reason: "approved_gtm_preview_cleanup",
    });
  } catch (error) {
    cleanup.push({
      deleted: false,
      workspaceId: created.workspace.workspaceId,
      name: created.workspace.name,
      reason: "cleanup_failed",
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const liveVersionAfter = await getLiveVersion(token);
  const workspacesAfterResponse = await created.gtm.accounts.containers.workspaces.list({ parent: CONTAINER_PATH });
  const workspacesAfter = (workspacesAfterResponse.data.workspace ?? []).map((workspace) => ({
    workspaceId: workspace.workspaceId,
    name: workspace.name,
    path: workspace.path,
  }));
  const workspaceStillOpen = workspacesAfter.some((workspace) => workspace.workspaceId === created.workspace.workspaceId);
  const quickPreview = created.quickPreview as any;
  const liveVersionUnchanged =
    created.liveVersionBefore.id === liveVersionAfter.id
    && created.liveVersionBefore.name === liveVersionAfter.name;
  const cleanupDeleted = cleanup.some((item) => item.deleted === true);
  const overall = {
    quickPreviewCompilerErrorAbsent: quickPreview.compilerError === undefined || quickPreview.compilerError === null,
    quickPreviewEnvironmentPresent: Boolean(created.environment.authorizationCode && created.environment.environmentId),
    workspaceChangeCountExpected: Number((created.statusBeforeCleanup as any).workspaceChangeCount ?? 0) === 2,
    mergeConflictCountZero: Number((created.statusBeforeCleanup as any).mergeConflictCount ?? 0) === 0,
    allSmokeCasesPassed: results.every((item) => item.pass),
    noMeasurementDeltaAllCases: results.every((item) => item.measurementRequestsAfterClick.length === 0),
    smokeCompletedWithoutException: smokeError === "" && results.length === TEST_CASES.length,
    workspaceDeleted: cleanupDeleted && !workspaceStillOpen,
    liveVersionUnchanged,
  };
  const verdict = Object.values(overall).every(Boolean)
    ? "PASS_GTM_PREVIEW_NO_SEND_CLEANED"
    : "HOLD_GTM_PREVIEW_REVIEW_REQUIRED";

  const summary = {
    generated_at_kst: kstTimestamp(),
    run_id: RUN_ID,
    mode: "gtm_preview_only_no_submit_no_create_version_no_publish",
    lane: "Yellow approved by TJ님 for GTM Preview execution",
    no_send_verified_by_design: true,
    no_write_verified_by_design: true,
    no_publish_verified: true,
    no_platform_send_verified: overall.noMeasurementDeltaAllCases,
    container: {
      account_id: ACCOUNT_ID,
      container_id: CONTAINER_ID,
      public_id: CONTAINER_PUBLIC_ID,
      live_version_before: created.liveVersionBefore,
      live_version_after: liveVersionAfter,
      live_version_unchanged: liveVersionUnchanged,
    },
    workspace: {
      workspace_id: created.workspace.workspaceId,
      name: created.workspace.name,
      path: created.workspace.path,
      workspace_count_before: created.workspaceCountBefore,
      workspace_count_after: workspacesAfter.length,
      still_open_after_cleanup: workspaceStillOpen,
    },
    tag: {
      tag_id: created.tag.tagId,
      name: created.tag.name,
      type: created.tag.type,
      firingTriggerId: created.tag.firingTriggerId,
    },
    trigger: {
      trigger_id: created.trigger.triggerId,
      name: created.trigger.name,
      type: created.trigger.type,
      filter: created.trigger.filter,
    },
    quick_preview: {
      sync_status: quickPreview.syncStatus ?? null,
      compiler_error: quickPreview.compilerError ?? null,
      container_version_id: quickPreview.containerVersion?.containerVersionId ?? null,
      container_version_name: quickPreview.containerVersion?.name ?? null,
      environment_id: created.environment.environmentId,
      authorization_code_present: Boolean(created.environment.authorizationCode),
    },
    status_before_cleanup: created.statusBeforeCleanup,
    backup_path: backupPath,
    cleanup,
    smoke_error: smokeError,
    workspaces_before: created.workspacesBefore,
    workspaces_after: workspacesAfter,
    smoke_results: results,
    overall,
    verdict,
  };

  const outputPath = path.join(OUTPUT_DIR, `coffee-subscribe-intent-gtm-preview-result-${RUN_ID}.json`);
  writeJson(outputPath, summary);
  console.log(JSON.stringify({
    outputPath,
    verdict,
    liveVersionUnchanged,
    workspace: summary.workspace,
    quickPreview: summary.quick_preview,
    cleanup,
    overall,
    cases: results.map((item) => ({
      kind: item.kind,
      pass: item.pass,
      passReasons: item.passReasons,
      actionResult: item.actionResult,
      measurementRequestsAfterClick: item.measurementRequestsAfterClick,
      screenshotPath: item.screenshotPath,
    })),
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
