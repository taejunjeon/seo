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
const CONTAINER_PATH = `accounts/${ACCOUNT_ID}/containers/${CONTAINER_ID}`;
const ENDPOINT =
  process.env.PATH_B_ORDER_BRIDGE_PREVIEW_RECEIVER_URL?.trim()
  || "https://att.ainativeos.net/api/attribution/order-bridge/identity-hmac/no-send";
const REPO_ROOT = path.basename(process.cwd()) === "backend"
  ? path.resolve(process.cwd(), "..")
  : process.cwd();
const OUTPUT_DIR = path.resolve(REPO_ROOT, "data");
const SCREENSHOT_DIR = path.resolve(OUTPUT_DIR, "path-b-gtm-preview-screenshots");
const RUN_ID = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "Z");
const WORKSPACE_NAME = `codex_path_b_order_bridge_preview_${RUN_ID}`;
const TAG_NAME = `PathB_order_bridge_identity_hmac_preview_no_send_${RUN_ID}`;
const TRIGGER_NAME = `PathB_order_confirm_pages_preview_${RUN_ID}`;
const SYNTHETIC_ORDER_NO = `PATHB_PREVIEW_ORDER_${RUN_ID}`;
const SYNTHETIC_CLICK_ID = `TEST_GCLID_PATHB_PREVIEW_${RUN_ID}`;
const PAYMENT_COMPLETE_PATH_REGEX =
  "shop_payment_complete|shop_order_done|payment_complete|order_complete";

type ReceiverBody = {
  ok?: boolean;
  would_store?: boolean;
  would_send?: boolean;
  no_platform_send_verified?: boolean;
  platform_send_count?: number;
  preview?: {
    email_hash_present?: boolean;
    phone_hash_present?: boolean;
    order_no_hash_present?: boolean;
    client_session_present?: boolean;
    click_id_hash_present?: boolean;
    no_raw_echo_verified?: boolean;
    no_platform_send_verified?: boolean;
    platform_send_count?: number;
  };
};

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
      "https://www.googleapis.com/auth/tagmanager.delete.containers",
    ],
  });
};

const redactPreviewUrl = (url: string) =>
  url.replace(/gtm_auth=[^&]+/g, "gtm_auth=REDACTED")
    .replace(/gtm_preview=[^&]+/g, "gtm_preview=REDACTED");

const buildTagHtml = () => `<script>
(function () {
  var VERSION = "path_b_order_bridge_preview_${RUN_ID}";
  var ENDPOINT = ${JSON.stringify(ENDPOINT)};
  var MAX_BODY_BYTES = 12 * 1024;
  var PATH_RE = /${PAYMENT_COMPLETE_PATH_REGEX}/i;
  var STORAGE_KEYS = ["bi_paid_click_intent_v1", "__bs_imweb", "__pathb_order_bridge_preview"];

  function clean(value) {
    return value == null ? "" : String(value).trim();
  }

  function isPreview() {
    return /gtm_debug=|gtm_preview=|gtm_auth=/.test(location.search);
  }

  function isOrderConfirmPage() {
    return PATH_RE.test(location.pathname + " " + location.href);
  }

  function pushResult(name, data) {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(Object.assign({
      event: name,
      path_b_preview_version: VERSION,
      would_store: false,
      would_send: false
    }, data || {}));
  }

  function text(selector) {
    var el = document.querySelector(selector);
    return el && "value" in el ? clean(el.value) : clean(el && el.textContent);
  }

  function searchParam(keys, urlLike) {
    try {
      var url = new URL(urlLike || location.href, location.origin);
      for (var i = 0; i < keys.length; i += 1) {
        var value = clean(url.searchParams.get(keys[i]));
        if (value) return value;
      }
    } catch (e) {}
    return "";
  }

  function dataLayerLast(keys) {
    var dl = window.dataLayer || [];
    for (var i = dl.length - 1; i >= 0; i -= 1) {
      for (var j = 0; j < keys.length; j += 1) {
        var value = dl[i] && dl[i][keys[j]];
        if (clean(value)) return clean(value);
      }
    }
    return "";
  }

  function readJsonStorage(key) {
    try {
      var raw = window.localStorage && window.localStorage.getItem(key);
      if (!raw) raw = window.sessionStorage && window.sessionStorage.getItem(key);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function storageFirst(keys) {
    for (var i = 0; i < STORAGE_KEYS.length; i += 1) {
      var obj = readJsonStorage(STORAGE_KEYS[i]);
      for (var j = 0; j < keys.length; j += 1) {
        var value = clean(obj && obj[keys[j]]);
        if (value) return value;
      }
    }
    return "";
  }

  function gaClientId() {
    var match = document.cookie.match(/(?:^|; )_ga=GA\\d\\.\\d\\.(\\d+\\.\\d+)/);
    return match ? match[1] : "";
  }

  function gaSessionId() {
    try {
      var cookies = document.cookie.split(";").map(function (v) { return v.trim(); });
      for (var i = 0; i < cookies.length; i += 1) {
        if (cookies[i].indexOf("_ga_") !== 0) continue;
        var value = cookies[i].split("=").slice(1).join("=");
        var match = value.match(/(?:^|[.$])s(\\d+)/);
        if (match) return match[1];
      }
    } catch (e) {}
    return "";
  }

  try {
    window.__pathb_order_bridge_preview_installed = VERSION;
    if (!isPreview()) {
      pushResult("path_b_order_bridge_preview_blocked", { reason: "not_gtm_preview" });
      return;
    }
    if (!isOrderConfirmPage()) {
      pushResult("path_b_order_bridge_preview_blocked", { reason: "not_order_confirm_page" });
      return;
    }

    var payload = {
      site: "biocom",
      capture_stage: "order_confirm_preview",
      email:
        text("[name='ordererEmail']") ||
        text("[name='email']") ||
        dataLayerLast(["email", "email_buy", "ordererEmail", "buyerEmail"]),
      phone:
        text("[name='ordererCall']") ||
        text("[name='phone']") ||
        dataLayerLast(["phone", "phone_buy", "ordererCall", "buyerPhone"]),
      order_no:
        searchParam(["order_no", "orderNo", "order_id", "orderId", "order_code", "orderCode"]) ||
        searchParam(["order_no", "orderNo", "order_id", "orderId", "order_code", "orderCode"], document.referrer) ||
        dataLayerLast(["order_no", "orderNo", "order_number", "orderNumber", "transaction_id"]) ||
        storageFirst(["order_no", "orderNo", "order_number", "orderNumber", "transaction_id"]),
      client_id:
        dataLayerLast(["client_id", "clientId"]) ||
        storageFirst(["client_id", "clientId"]) ||
        gaClientId(),
      ga_session_id:
        dataLayerLast(["ga_session_id", "gaSessionId"]) ||
        storageFirst(["ga_session_id", "gaSessionId"]) ||
        gaSessionId(),
      local_session_id:
        dataLayerLast(["local_session_id", "localSessionId"]) ||
        storageFirst(["local_session_id", "localSessionId", "commonSessionId", "customSessionId"]),
      click_id:
        searchParam(["gclid", "gbraid", "wbraid", "ttclid", "nclick_id"]) ||
        dataLayerLast(["gclid", "gbraid", "wbraid", "ttclid", "nclick_id"]) ||
        storageFirst(["gclid", "gbraid", "wbraid", "ttclid", "nclick_id"]),
      preview_mode: true
    };

    var body = JSON.stringify(payload);
    if (body.length > MAX_BODY_BYTES) {
      pushResult("path_b_order_bridge_preview_blocked", { reason: "client_payload_too_large" });
      return;
    }

    window.__pathb_order_bridge_preview_last_payload_keys = Object.keys(payload).sort();
    fetch(ENDPOINT, {
      method: "POST",
      mode: "cors",
      credentials: "omit",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: body
    }).then(function (res) {
      return res.text().then(function (text) {
        var json = null;
        try { json = JSON.parse(text); } catch (e) {}
        var preview = json && json.preview ? json.preview : {};
        var result = {
          response_status: res.status,
          response_ok: !!(json && json.ok),
          would_store: false,
          would_send: false,
          email_hash_present: !!preview.email_hash_present,
          phone_hash_present: !!preview.phone_hash_present,
          order_no_hash_present: !!preview.order_no_hash_present,
          client_session_present: !!preview.client_session_present,
          click_id_hash_present: !!preview.click_id_hash_present,
          no_raw_echo_verified: !!preview.no_raw_echo_verified,
          no_platform_send_verified: !!preview.no_platform_send_verified,
          platform_send_count: preview.platform_send_count || 0,
          hash_version: preview.hash_version || ""
        };
        window.__pathb_order_bridge_preview_last_result = result;
        pushResult("path_b_order_bridge_preview_result", result);
      });
    }).catch(function (err) {
      window.__pathb_order_bridge_preview_last_error = String(err && err.message || err);
      pushResult("path_b_order_bridge_preview_error", { error_type: "receiver_fetch_failed" });
    });
  } catch (err) {
    window.__pathb_order_bridge_preview_last_error = String(err && err.message || err);
    pushResult("path_b_order_bridge_preview_error", { error_type: "install_failed" });
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
      description: "Codex Path B order bridge Preview only. No submit, no publish, no platform send.",
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
        type: "pageview",
        filter: [
          {
            type: "matchRegex",
            parameter: [
              { type: "template", key: "arg0", value: "{{Page Path}}" },
              { type: "template", key: "arg1", value: PAYMENT_COMPLETE_PATH_REGEX },
              { type: "boolean", key: "ignore_case", value: "true" },
            ],
          },
        ],
        notes:
          "Preview only. Fires only on order confirmation paths. Do not submit/publish.",
      },
    });
    if (!trigger.data.triggerId) throw new Error("trigger create succeeded but triggerId missing");

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
        notes:
          "Preview only. Sends transient identity/order values only to Path B no-send HMAC endpoint. No submit/publish/platform send.",
      },
    });
    if (!tag.data.tagId) throw new Error("tag create succeeded but tagId missing");

    const quickPreview = await gtm.accounts.containers.workspaces.quick_preview({
      path: workspace.data.path,
    });
    const environments = await gtm.accounts.containers.environments.list({ parent: CONTAINER_PATH });
    const environment = (environments.data.environment ?? [])
      .find((item) => item.workspaceId === workspace.data.workspaceId);
    return {
      gtm,
      liveVersion,
      workspace: workspace.data,
      trigger: trigger.data,
      tag: tag.data,
      quickPreview: quickPreview.data,
      environment: environment ?? null,
    };
  } catch (error) {
    await gtm.accounts.containers.workspaces.delete({ path: workspace.data.path }).catch(() => undefined);
    throw error;
  }
};

const buildPreviewUrl = (
  baseUrl: string,
  env: { authorizationCode?: string | null; environmentId?: string | null },
) => {
  if (!env.authorizationCode || !env.environmentId) {
    throw new Error("quick preview environment authorizationCode/environmentId missing");
  }
  const url = new URL(baseUrl);
  url.searchParams.set("gtm_auth", env.authorizationCode);
  url.searchParams.set("gtm_preview", `env-${env.environmentId}`);
  url.searchParams.set("gtm_debug", "x");
  return url.toString();
};

const runSyntheticPreview = async (
  page: Page,
  environment: NonNullable<Awaited<ReturnType<typeof createPreviewWorkspace>>["environment"]>,
) => {
  const receiverStatuses: number[] = [];
  const receiverBodies: ReceiverBody[] = [];
  const consoleMarkers: string[] = [];
  const networkErrors: string[] = [];
  const gtmScriptRoutes: string[] = [];
  const baseUrl =
    `https://biocom.kr/shop_payment_complete?order_no=${encodeURIComponent(SYNTHETIC_ORDER_NO)}`
    + `&gclid=${encodeURIComponent(SYNTHETIC_CLICK_ID)}`;
  const previewUrl = buildPreviewUrl(baseUrl, environment);

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

  page.on("console", (msg) => {
    const text = msg.text();
    if (text.includes("path_b_order_bridge_preview")) consoleMarkers.push(text);
  });
  page.on("requestfailed", (request) => {
    const url = request.url();
    const isReceiver = url.includes("/api/attribution/order-bridge/identity-hmac/no-send");
    const isGtm = url.includes("googletagmanager.com/gtm.js");
    if (isReceiver || isGtm) {
      networkErrors.push(`${request.failure()?.errorText ?? "requestfailed"} ${redactPreviewUrl(url)}`);
    }
  });
  page.on("response", async (response) => {
    const url = response.url();
    if (!url.includes("/api/attribution/order-bridge/identity-hmac/no-send")) return;
    receiverStatuses.push(response.status());
    receiverBodies.push(await response.json().catch(() => ({ ok: false })));
  });

  let pageLoaded = false;
  try {
    await page.goto(previewUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
    pageLoaded = true;
  } catch (error) {
    networkErrors.push(`page.goto: ${error instanceof Error ? error.message : String(error)}`);
  }
  await page.waitForTimeout(7000);

  const pageState = await page.evaluate(`(() => ({
    href: window.location.href,
    installed: window.__pathb_order_bridge_preview_installed || null,
    payloadKeys: window.__pathb_order_bridge_preview_last_payload_keys || [],
    result: window.__pathb_order_bridge_preview_last_result || null,
    error: window.__pathb_order_bridge_preview_last_error || null,
    gtmLoaded: Boolean(window.google_tag_manager && window.google_tag_manager[${JSON.stringify(CONTAINER_PUBLIC_ID)}])
  }))()`) as Record<string, unknown>;
  if (typeof pageState.href === "string") {
    pageState.href = redactPreviewUrl(pageState.href);
  }

  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const screenshotPath = path.join(SCREENSHOT_DIR, `path-b-gtm-preview-${RUN_ID}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: false }).catch(() => undefined);

  const serializedResponses = JSON.stringify(receiverBodies);
  const rawEchoDetected = [SYNTHETIC_ORDER_NO, SYNTHETIC_CLICK_ID].some((raw) =>
    serializedResponses.includes(raw),
  );

  return {
    previewUrl: redactPreviewUrl(previewUrl),
    pageLoaded,
    pageState,
    receiverReached: receiverStatuses.length > 0,
    receiverStatuses,
    receiverBodies,
    receiverOkAll: receiverBodies.length > 0 && receiverBodies.every((body) => body.ok === true),
    receiverWouldStoreFalseAll:
      receiverBodies.length > 0 && receiverBodies.every((body) => body.would_store === false),
    receiverWouldSendFalseAll:
      receiverBodies.length > 0 && receiverBodies.every((body) => body.would_send === false),
    receiverPlatformSendZeroAll:
      receiverBodies.length > 0 && receiverBodies.every((body) =>
        body.no_platform_send_verified === true
        && (body.platform_send_count ?? 0) === 0
        && (body.preview?.platform_send_count ?? 0) === 0,
      ),
    rawEchoDetected,
    consoleMarkers,
    networkErrors,
    gtmScriptRoutes,
    screenshotPath,
  };
};

const writeJson = (filePath: string, value: unknown) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

const main = async () => {
  const created = await createPreviewWorkspace();
  if (!created.environment) {
    throw new Error("quick preview environment not found for workspace");
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const synthetic = await runSyntheticPreview(page, created.environment);
  await browser.close();

  const previewBody = synthetic.receiverBodies[0]?.preview ?? {};
  const summary = {
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
    run_id: RUN_ID,
    container: {
      account_id: ACCOUNT_ID,
      container_id: CONTAINER_ID,
      public_id: CONTAINER_PUBLIC_ID,
      live_version_id: created.liveVersion.id,
      live_version_name: created.liveVersion.name,
    },
    workspace: {
      workspace_id: created.workspace.workspaceId,
      name: created.workspace.name,
      path: created.workspace.path,
      submitted: false,
      published: false,
      left_open_for_tj_preview: true,
    },
    trigger: {
      trigger_id: created.trigger.triggerId,
      name: created.trigger.name,
      type: created.trigger.type,
      scope: "order confirmation paths only",
      all_pages: false,
      path_regex: PAYMENT_COMPLETE_PATH_REGEX,
    },
    tag: {
      tag_id: created.tag.tagId,
      name: created.tag.name,
      type: created.tag.type,
      production_publish: false,
      platform_send: false,
    },
    quick_preview: {
      sync_status: created.quickPreview.syncStatus ?? null,
      compiler_error: created.quickPreview.compilerError ?? null,
      environment_id: created.environment.environmentId,
      authorization_code_redacted: Boolean(created.environment.authorizationCode),
    },
    endpoint: ENDPOINT,
    synthetic_preview: {
      page_loaded: synthetic.pageLoaded,
      receiver_reached: synthetic.receiverReached,
      receiver_statuses: synthetic.receiverStatuses,
      receiver_ok_all: synthetic.receiverOkAll,
      would_store_false_all: synthetic.receiverWouldStoreFalseAll,
      would_send_false_all: synthetic.receiverWouldSendFalseAll,
      platform_send_zero_all: synthetic.receiverPlatformSendZeroAll,
      raw_echo_detected: synthetic.rawEchoDetected,
      network_errors: synthetic.networkErrors,
      screenshot_path: synthetic.screenshotPath,
      preview_url_redacted: synthetic.previewUrl,
      gtm_script_routes_redacted: synthetic.gtmScriptRoutes,
      page_state: synthetic.pageState,
      response_preview_booleans: {
        email_hash_present: Boolean(previewBody.email_hash_present),
        phone_hash_present: Boolean(previewBody.phone_hash_present),
        order_no_hash_present: Boolean(previewBody.order_no_hash_present),
        client_session_present: Boolean(previewBody.client_session_present),
        click_id_hash_present: Boolean(previewBody.click_id_hash_present),
        no_raw_echo_verified: Boolean(previewBody.no_raw_echo_verified),
        no_platform_send_verified: Boolean(previewBody.no_platform_send_verified),
      },
    },
    real_payment_complete_evidence: {
      status: "not_collected",
      reason: "No real checkout/payment-complete browser session was available to Codex.",
      required_next: "TJ님 browser GTM Preview on real homepage checkout complete page.",
    },
    forbidden_actions_not_taken: [
      "GTM Production publish",
      "GTM submit/create_version",
      "Imweb production save",
      "backend operational storage canary",
      "operational schema migration",
      "raw email/phone/member_code/order storage",
      "Google Ads/GA4/Meta/TikTok/Naver send",
      "Google Ads conversion upload",
      "existing GTM tag pause/delete",
    ],
    verdict:
      synthetic.receiverReached
      && synthetic.receiverOkAll
      && synthetic.receiverWouldStoreFalseAll
      && synthetic.receiverWouldSendFalseAll
      && synthetic.receiverPlatformSendZeroAll
      && !synthetic.rawEchoDetected
        ? "PASS_SYNTHETIC_PREVIEW_WORKSPACE_READY"
        : "HOLD_SYNTHETIC_PREVIEW_ISSUE",
  };

  const outPath = path.join(OUTPUT_DIR, `path-b-gtm-preview-api-result-${RUN_ID}.json`);
  writeJson(outPath, summary);
  writeJson(path.join(OUTPUT_DIR, "path-b-gtm-preview-api-result-latest.json"), summary);
  console.log(JSON.stringify({
    verdict: summary.verdict,
    workspace_id: summary.workspace.workspace_id,
    tag_id: summary.tag.tag_id,
    trigger_id: summary.trigger.trigger_id,
    output: outPath,
    receiver_statuses: summary.synthetic_preview.receiver_statuses,
    real_payment_complete_evidence: summary.real_payment_complete_evidence.status,
  }, null, 2));
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
