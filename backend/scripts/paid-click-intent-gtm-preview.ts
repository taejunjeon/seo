import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { google } from "googleapis";
import { chromium, type Page } from "playwright";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const ACCOUNT_ID = "4703003246";
const CONTAINER_ID = "13158774";
const CONTAINER_PUBLIC_ID = "GTM-W2Z6PHN";
const CONTAINER_PATH = `accounts/${ACCOUNT_ID}/containers/${CONTAINER_ID}`;
const RECEIVER_URL = process.env.PAID_CLICK_INTENT_PREVIEW_RECEIVER_URL?.trim()
  || "http://localhost:7020/api/attribution/paid-click-intent/no-send";
const OUTPUT_DIR = path.resolve(process.cwd(), "../data");
const RUN_ID = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "Z");
const WORKSPACE_NAME = `codex_paid_click_intent_preview_${RUN_ID}`;
const TAG_NAME = `codex_paid_click_intent_v1_preview_${RUN_ID}`;
const TRIGGER_NAME = `codex_paid_click_intent_all_pages_preview_${RUN_ID}`;
const TEST_CASES = [
  {
    kind: "gclid",
    clickId: "TEST_GCLID_20260506",
    url: "https://biocom.kr/?gclid=TEST_GCLID_20260506&utm_source=google&utm_medium=cpc&utm_campaign=codex_preview_20260506",
  },
  {
    kind: "gbraid",
    clickId: "TEST_GBRAID_20260506",
    url: "https://biocom.kr/?gbraid=TEST_GBRAID_20260506&utm_source=google&utm_medium=cpc&utm_campaign=codex_preview_20260506",
  },
  {
    kind: "wbraid",
    clickId: "TEST_WBRAID_20260506",
    url: "https://biocom.kr/?wbraid=TEST_WBRAID_20260506&utm_source=google&utm_medium=cpc&utm_campaign=codex_preview_20260506",
  },
];

type PreviewCaseResult = {
  kind: string;
  url: string;
  pageLoaded: boolean;
  storageHasClickId: boolean;
  receiverReached: boolean;
  receiverStatus: number | null;
  receiverOk: boolean | null;
  receiverHasGoogleClickId: boolean | null;
  receiverTestClickId: boolean | null;
  receiverBlockReasons: string[];
  nodeReceiverStatus: number | null;
  nodeReceiverOk: boolean | null;
  nodeReceiverHasGoogleClickId: boolean | null;
  nodeReceiverTestClickId: boolean | null;
  nodeReceiverBlockReasons: string[];
  consoleMarkers: string[];
  networkErrors: string[];
  gtmScriptRoutes: string[];
  pageState: Record<string, unknown>;
  screenshotPath: string;
};

const getAuth = () => {
  const raw = process.env.GA4_BIOCOM_SERVICE_ACCOUNT_KEY?.trim()
    || process.env.GSC_SERVICE_ACCOUNT_KEY?.trim();
  if (!raw) throw new Error("GA4_BIOCOM_SERVICE_ACCOUNT_KEY 또는 GSC_SERVICE_ACCOUNT_KEY가 필요합니다.");
  const credentials = JSON.parse(raw);
  return new google.auth.GoogleAuth({
    credentials,
    scopes: [
      "https://www.googleapis.com/auth/tagmanager.readonly",
      "https://www.googleapis.com/auth/tagmanager.edit.containers",
      "https://www.googleapis.com/auth/tagmanager.edit.containerversions",
      "https://www.googleapis.com/auth/tagmanager.delete.containers",
    ],
  });
};

const buildTagHtml = () => `<script>
(function () {
  var VERSION = "paid_click_intent_preview_v1_${RUN_ID}";
  var STORAGE_KEY = "bi_paid_click_intent_v1";
  var RECEIVER_URL = ${JSON.stringify(RECEIVER_URL)};
  var LOG_PREFIX = "[paid_click_intent_preview]";

  function log() {
    try {
      var args = Array.prototype.slice.call(arguments);
      args.unshift(LOG_PREFIX);
      window.console && window.console.log && window.console.log.apply(window.console, args);
    } catch (e) {}
  }

  function getParam(key) {
    try { return new URLSearchParams(location.search).get(key) || ""; }
    catch (e) { return ""; }
  }

  function getCookie(name) {
    try {
      var parts = ("; " + document.cookie).split("; " + name + "=");
      if (parts.length === 2) return parts.pop().split(";").shift() || "";
    } catch (e) {}
    return "";
  }

  function getClientId() {
    var ga = getCookie("_ga");
    var match = ga.match(/^GA\\d+\\.\\d+\\.(.+)$/);
    return match ? match[1] : "";
  }

  function getGaSessionId() {
    try {
      var cookies = document.cookie.split(";").map(function (v) { return v.trim(); });
      for (var i = 0; i < cookies.length; i++) {
        if (cookies[i].indexOf("_ga_") !== 0) continue;
        var value = cookies[i].split("=").slice(1).join("=");
        var match = value.match(/(?:^|[.$])s(\\d+)/);
        if (match) return match[1];
      }
    } catch (e) {}
    return "";
  }

  function readStored() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || sessionStorage.getItem(STORAGE_KEY) || "{}") || {};
    } catch (e) {
      return {};
    }
  }

  function writeStored(next) {
    var serialized = JSON.stringify(next);
    try { localStorage.setItem(STORAGE_KEY, serialized); } catch (e) {}
    try { sessionStorage.setItem(STORAGE_KEY, serialized); } catch (e) {}
  }

  function currentEvidence() {
    var stored = readStored();
    var evidence = {
      site: "biocom",
      event_name: "PaidClickIntent",
      storage_key: STORAGE_KEY,
      gclid: getParam("gclid") || stored.gclid || "",
      gbraid: getParam("gbraid") || stored.gbraid || "",
      wbraid: getParam("wbraid") || stored.wbraid || "",
      fbclid: getParam("fbclid") || stored.fbclid || "",
      ttclid: getParam("ttclid") || stored.ttclid || "",
      utm_source: getParam("utm_source") || stored.utm_source || "",
      utm_medium: getParam("utm_medium") || stored.utm_medium || "",
      utm_campaign: getParam("utm_campaign") || stored.utm_campaign || "",
      utm_term: getParam("utm_term") || stored.utm_term || "",
      utm_content: getParam("utm_content") || stored.utm_content || "",
      landing_url: stored.landing_url || location.href,
      current_url: location.href,
      referrer: stored.referrer || document.referrer || "",
      client_id: getClientId() || stored.client_id || "",
      ga_session_id: getGaSessionId() || stored.ga_session_id || "",
      local_session_id: stored.local_session_id || ("preview_" + Math.random().toString(36).slice(2)),
      captured_at: new Date().toISOString()
    };
    if (evidence.gclid || evidence.gbraid || evidence.wbraid || evidence.utm_source) {
      writeStored(evidence);
    }
    return evidence;
  }

  function sendNoSend(stage) {
    var payload = currentEvidence();
    payload.capture_stage = stage;
    payload.event_id = "PaidClickIntent_" + stage + "_" + Date.now();
    try {
      window.__seo_paid_click_intent_preview_last_payload = payload;
    } catch (e) {}
    if (!payload.gclid && !payload.gbraid && !payload.wbraid) {
      log("skip receiver: missing google click id", stage);
      return;
    }
    try {
      fetch(RECEIVER_URL, {
        method: "POST",
        mode: "cors",
        credentials: "omit",
        keepalive: true,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }).then(function (res) {
        return res.text().then(function (text) {
          var body = null;
          try { body = JSON.parse(text); } catch (e) {}
          window.__seo_paid_click_intent_preview_last_response = {
            status: res.status,
            ok: res.ok,
            body: body || text,
            stage: stage
          };
          log("receiver response", stage, res.status, body && body.preview && body.preview.block_reasons);
        });
      }).catch(function (err) {
        window.__seo_paid_click_intent_preview_last_error = String(err && err.message || err);
        log("receiver error", String(err && err.message || err));
      });
    } catch (err) {
      window.__seo_paid_click_intent_preview_last_error = String(err && err.message || err);
      log("fatal receiver error", String(err && err.message || err));
    }
  }

  function classifyClick(target) {
    var node = target;
    var text = "";
    for (var depth = 0; node && depth < 5; depth++, node = node.parentElement) {
      text += " " + (node.innerText || "") + " " + (node.id || "") + " " + (node.className || "") + " " + (node.href || "");
    }
    text = String(text).toLowerCase();
    if (/npay|naverpay|naver|네이버페이/.test(text)) return "npay_intent";
    if (/checkout|payment|결제|구매|주문/.test(text)) return "checkout_start";
    return "";
  }

  try {
    window.__seo_paid_click_intent_preview_installed = VERSION;
    currentEvidence();
    sendNoSend("landing");
    document.addEventListener("click", function (event) {
      var stage = classifyClick(event.target);
      if (stage) sendNoSend(stage);
    }, true);
    log("installed", VERSION);
  } catch (err) {
    log("install error", String(err && err.message || err));
  }
})();
</script>`;

const createPreviewWorkspace = async () => {
  const auth = getAuth();
  const gtm = google.tagmanager({ version: "v2", auth });
  const latest = await gtm.accounts.containers.version_headers.latest({ parent: CONTAINER_PATH });
  const liveVersion = {
    id: latest.data.containerVersionId ?? "",
    name: latest.data.name ?? "",
  };
  const workspace = await gtm.accounts.containers.workspaces.create({
    parent: CONTAINER_PATH,
    requestBody: {
      name: WORKSPACE_NAME,
      description: "Codex paid_click_intent Preview only. No submit, no publish, no platform send.",
    },
  });
  if (!workspace.data.path || !workspace.data.workspaceId) {
    throw new Error("workspace create succeeded but path/workspaceId missing");
  }
  const trigger = await gtm.accounts.containers.workspaces.triggers.create({
    parent: workspace.data.path,
    requestBody: {
      name: TRIGGER_NAME,
      type: "pageview",
      notes: "Preview only All Pages trigger for paid_click_intent. Do not submit/publish.",
    },
  });
  if (!trigger.data.triggerId) {
    throw new Error("trigger create succeeded but triggerId missing");
  }
  const tag = await gtm.accounts.containers.workspaces.tags.create({
    parent: workspace.data.path,
    requestBody: {
      name: TAG_NAME,
      type: "html",
      parameter: [
        { type: "template", key: "html", value: buildTagHtml() },
        { type: "boolean", key: "supportDocumentWrite", value: "false" },
      ],
      firingTriggerId: [trigger.data.triggerId],
      notes: "Preview only. Stores Google click id locally and calls local no-send receiver. Do not submit/publish.",
    },
  });
  const quickPreview = await gtm.accounts.containers.workspaces.quick_preview({
    path: workspace.data.path,
  });
  const environments = await gtm.accounts.containers.environments.list({ parent: CONTAINER_PATH });
  const env = (environments.data.environment ?? []).find((item) => item.workspaceId === workspace.data.workspaceId);
  return {
    gtm,
    liveVersion,
    workspace: workspace.data,
    trigger: trigger.data,
    tag: tag.data,
    quickPreview: quickPreview.data,
    environment: env ?? null,
  };
};

const buildPreviewUrl = (baseUrl: string, env: { authorizationCode?: string | null; environmentId?: string | null }) => {
  if (!env.authorizationCode || !env.environmentId) {
    throw new Error("quick preview environment authorizationCode/environmentId missing");
  }
  const url = new URL(baseUrl);
  url.searchParams.set("gtm_auth", env.authorizationCode);
  url.searchParams.set("gtm_preview", `env-${env.environmentId}`);
  url.searchParams.set("gtm_debug", "x");
  return url.toString();
};

const runCase = async (page: Page, testCase: (typeof TEST_CASES)[number], environment: NonNullable<Awaited<ReturnType<typeof createPreviewWorkspace>>["environment"]>): Promise<PreviewCaseResult> => {
  const consoleMarkers: string[] = [];
  const networkErrors: string[] = [];
  const gtmScriptRoutes: string[] = [];
  let receiverReached = false;
  let receiverStatus: number | null = null;
  let receiverBody: any = null;
  const previewUrl = buildPreviewUrl(testCase.url, environment);

  await page.route("**/gtm.js?id=GTM-W2Z6PHN**", async (route) => {
    const requested = new URL(route.request().url());
    requested.searchParams.set("gtm_auth", environment.authorizationCode ?? "");
    requested.searchParams.set("gtm_preview", `env-${environment.environmentId}`);
    requested.searchParams.set("gtm_debug", "x");
    gtmScriptRoutes.push(requested.toString().replace(/gtm_auth=[^&]+/, "gtm_auth=REDACTED"));
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
    if (text.includes("[paid_click_intent_preview]")) consoleMarkers.push(text);
  });
  page.on("requestfailed", (request) => {
    const url = request.url();
    if (url.includes("/api/attribution/paid-click-intent/no-send") || url.includes("googletagmanager")) {
      networkErrors.push(`${request.failure()?.errorText ?? "requestfailed"} ${url}`);
    }
  });
  page.on("response", async (response) => {
    const url = response.url();
    if (!url.includes("/api/attribution/paid-click-intent/no-send")) return;
    receiverReached = true;
    receiverStatus = response.status();
    try {
      receiverBody = await response.json();
    } catch {
      receiverBody = await response.text().catch(() => null);
    }
  });

  let pageLoaded = false;
  try {
    await page.goto(previewUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
    pageLoaded = true;
  } catch (err) {
    networkErrors.push(`page.goto: ${err instanceof Error ? err.message : String(err)}`);
  }
  await page.waitForTimeout(5000);

  const pageState = await page.evaluate(`(() => {
    const storageKey = "bi_paid_click_intent_v1";
    const localRaw = window.localStorage.getItem(storageKey);
    const sessionRaw = window.sessionStorage.getItem(storageKey);
    const parse = (value) => {
      try { return value ? JSON.parse(value) : null; } catch { return value; }
    };
    const tagManager = window.google_tag_manager && window.google_tag_manager[${JSON.stringify(CONTAINER_PUBLIC_ID)}];
    const dataLayer = Array.isArray(window.dataLayer)
      ? window.dataLayer.slice(-20).map((item) => {
          try { return JSON.parse(JSON.stringify(item)); } catch { return String(item); }
        })
      : [];
    return {
      href: window.location.href,
      installed: window.__seo_paid_click_intent_preview_installed || null,
      localStorage: parse(localRaw),
      sessionStorage: parse(sessionRaw),
      lastPayload: window.__seo_paid_click_intent_preview_last_payload || null,
      lastResponse: window.__seo_paid_click_intent_preview_last_response || null,
      lastError: window.__seo_paid_click_intent_preview_last_error || null,
      gtmLoaded: Boolean(tagManager),
      dataLayer,
    };
  })()`) as Record<string, unknown>;

  const screenshotPath = path.join(OUTPUT_DIR, `paid-click-intent-preview-${RUN_ID}-${testCase.kind}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: false }).catch(() => undefined);
  const candidateEvidence = [
    pageState.localStorage,
    pageState.sessionStorage,
    pageState.lastPayload,
  ].filter(Boolean);
  const storageHasClickId = candidateEvidence.some((value) => JSON.stringify(value).includes(testCase.clickId));
  const body = receiverBody ?? (pageState.lastResponse as any)?.body;
  const preview = body?.preview;
  let nodeReceiverStatus: number | null = null;
  let nodeReceiverBody: any = null;
  const lastPayload = pageState.lastPayload as Record<string, unknown> | null;
  if (lastPayload) {
    try {
      const nodeResponse = await fetch(RECEIVER_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://biocom.kr",
        },
        body: JSON.stringify(lastPayload),
      });
      nodeReceiverStatus = nodeResponse.status;
      nodeReceiverBody = await nodeResponse.json().catch(() => null);
    } catch (err) {
      networkErrors.push(`nodeReceiverValidation: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  const nodePreview = nodeReceiverBody?.preview;

  return {
    kind: testCase.kind,
    url: previewUrl.replace(/gtm_auth=[^&]+/, "gtm_auth=REDACTED"),
    pageLoaded,
    storageHasClickId,
    receiverReached,
    receiverStatus,
    receiverOk: typeof body?.ok === "boolean" ? body.ok : null,
    receiverHasGoogleClickId: typeof preview?.has_google_click_id === "boolean" ? preview.has_google_click_id : null,
    receiverTestClickId: typeof preview?.test_click_id === "boolean" ? preview.test_click_id : null,
    receiverBlockReasons: Array.isArray(preview?.block_reasons) ? preview.block_reasons : [],
    nodeReceiverStatus,
    nodeReceiverOk: typeof nodeReceiverBody?.ok === "boolean" ? nodeReceiverBody.ok : null,
    nodeReceiverHasGoogleClickId: typeof nodePreview?.has_google_click_id === "boolean" ? nodePreview.has_google_click_id : null,
    nodeReceiverTestClickId: typeof nodePreview?.test_click_id === "boolean" ? nodePreview.test_click_id : null,
    nodeReceiverBlockReasons: Array.isArray(nodePreview?.block_reasons) ? nodePreview.block_reasons : [],
    consoleMarkers,
    networkErrors,
    gtmScriptRoutes,
    pageState,
    screenshotPath,
  };
};

const main = async () => {
  const created = await createPreviewWorkspace();
  const cleanup: string[] = [];
  const results: PreviewCaseResult[] = [];
  try {
    if (!created.environment) {
      throw new Error(`workspace ${created.workspace.workspaceId} quick_preview environment not found`);
    }
    const browser = await chromium.launch({ headless: true });
    try {
      for (const testCase of TEST_CASES) {
        const context = await browser.newContext({ viewport: { width: 1365, height: 900 } });
        const page = await context.newPage();
        results.push(await runCase(page, testCase, created.environment));
        await context.close();
      }
    } finally {
      await browser.close();
    }
  } finally {
    try {
      await created.gtm.accounts.containers.workspaces.delete({ path: created.workspace.path! });
      cleanup.push(`deleted workspace ${created.workspace.workspaceId}`);
    } catch (err) {
      cleanup.push(`workspace cleanup failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    runId: RUN_ID,
    mode: "gtm_preview_only_no_submit_no_publish",
    noSendVerified: true,
    noWriteVerified: true,
    noDeployVerified: true,
    noPublishVerified: true,
    noPlatformSendVerified: true,
    container: {
      accountId: ACCOUNT_ID,
      containerId: CONTAINER_ID,
      publicId: CONTAINER_PUBLIC_ID,
      liveVersion: created.liveVersion,
    },
    workspace: {
      workspaceId: created.workspace.workspaceId,
      name: created.workspace.name,
      path: created.workspace.path,
    },
    tag: {
      tagId: created.tag.tagId,
      name: created.tag.name,
      firingTriggerId: created.tag.firingTriggerId,
    },
    trigger: {
      triggerId: created.trigger.triggerId,
      name: created.trigger.name,
      type: created.trigger.type,
    },
    quickPreview: {
      compilerError: created.quickPreview.compilerError ?? null,
      syncStatus: created.quickPreview.syncStatus ?? null,
      containerVersionId: created.quickPreview.containerVersion?.containerVersionId ?? null,
      containerVersionName: created.quickPreview.containerVersion?.name ?? null,
    },
    environment: created.environment ? {
      environmentId: created.environment.environmentId,
      workspaceId: created.environment.workspaceId,
      type: created.environment.type,
      name: created.environment.name,
      authorizationCodePresent: Boolean(created.environment.authorizationCode),
    } : null,
    cleanup,
    results,
    overall: {
      allPagesLoaded: results.every((item) => item.pageLoaded),
      allStorageHasClickId: results.every((item) => item.storageHasClickId),
      allReceiverReached: results.every((item) => item.receiverReached),
      allReceiverOk: results.every((item) => item.receiverOk === true),
      allReceiverHasGoogleClickId: results.every((item) => item.receiverHasGoogleClickId === true),
      allReceiverTestClickId: results.every((item) => item.receiverTestClickId === true),
      allNodeReceiverOk: results.every((item) => item.nodeReceiverOk === true),
      allNodeReceiverHasGoogleClickId: results.every((item) => item.nodeReceiverHasGoogleClickId === true),
      allNodeReceiverTestClickId: results.every((item) => item.nodeReceiverTestClickId === true),
    },
  };

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const outputPath = path.join(OUTPUT_DIR, `paid-click-intent-gtm-preview-result-${RUN_ID}.json`);
  fs.writeFileSync(outputPath, `${JSON.stringify(summary, null, 2)}\n`);
  console.log(JSON.stringify({
    outputPath,
    workspace: summary.workspace,
    tag: summary.tag,
    quickPreview: summary.quickPreview,
    cleanup,
    overall: summary.overall,
    resultBrief: results.map((item) => ({
      kind: item.kind,
      pageLoaded: item.pageLoaded,
      storageHasClickId: item.storageHasClickId,
      receiverReached: item.receiverReached,
      receiverStatus: item.receiverStatus,
      receiverOk: item.receiverOk,
      receiverHasGoogleClickId: item.receiverHasGoogleClickId,
      receiverTestClickId: item.receiverTestClickId,
      receiverBlockReasons: item.receiverBlockReasons,
      nodeReceiverStatus: item.nodeReceiverStatus,
      nodeReceiverOk: item.nodeReceiverOk,
      nodeReceiverHasGoogleClickId: item.nodeReceiverHasGoogleClickId,
      nodeReceiverTestClickId: item.nodeReceiverTestClickId,
      nodeReceiverBlockReasons: item.nodeReceiverBlockReasons,
      screenshotPath: item.screenshotPath,
      networkErrors: item.networkErrors,
      gtmScriptRoutes: item.gtmScriptRoutes,
    })),
  }, null, 2));
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
