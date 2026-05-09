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
const SUMMARY_ENDPOINT = "https://att.ainativeos.net/api/attribution/order-bridge/ledger/summary";
const REPO_ROOT = path.basename(process.cwd()) === "backend"
  ? path.resolve(process.cwd(), "..")
  : process.cwd();
const OUTPUT_DIR = path.resolve(REPO_ROOT, "data");
const SCREENSHOT_DIR = path.resolve(OUTPUT_DIR, "path-b-gtm-controlled-traffic-screenshots");
const RUN_ID = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "Z");
const TEST_CLICK_ID = `TEST_GCLID_PATHB_GTM_CONTROLLED_${RUN_ID}`;
const WORKSPACE_NAME = `AGENT_OS_path_b_controlled_traffic_preview_${RUN_ID}`;
const TAG_NAME = `AGENT_OS_path_b_controlled_traffic_hmac_write_preview_${RUN_ID}`;
const TRIGGER_NAME = `AGENT_OS_path_b_order_confirm_controlled_traffic_${RUN_ID}`;
const DEFAULT_PRODUCT_URL = "https://biocom.kr/shop_view/?idx=198";
const PAYMENT_COMPLETE_PATH_REGEX =
  "shop_payment_complete|shop_order_done|payment_complete|order_complete";
const SETUP_OUTPUT_PATH = path.join(OUTPUT_DIR, "path-b-gtm-controlled-traffic-workspace-20260509.json");

type ReceiverBody = {
  ok?: boolean;
  would_store?: boolean;
  would_send?: boolean;
  no_platform_send_verified?: boolean;
  platform_send_count?: number;
  ledger?: {
    stored?: boolean;
    deduped?: boolean;
    write_mode?: string;
    rejected?: boolean;
    reason?: string;
  };
  preview?: {
    would_store?: boolean;
    would_send?: boolean;
    email_hash_present?: boolean;
    phone_hash_present?: boolean;
    order_no_hash_present?: boolean;
    client_session_present?: boolean;
    click_id_hash_present?: boolean;
    no_raw_echo_verified?: boolean;
    no_platform_send_verified?: boolean;
    platform_send_count?: number;
    identity_source?: string;
    hash_version?: string;
  };
  source?: {
    write_flag_on?: boolean;
    mode?: string;
  };
};

type SummaryBody = {
  ok?: boolean;
  summary?: {
    row_count?: number;
    raw_stored_count?: number;
    platform_send_count?: number;
    duplicate_dedupe_count?: number;
  };
  source?: {
    write_flag_on?: boolean;
    write_max_rows?: number;
    receivedAt?: string;
  };
};

const argValue = (name: string) => {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : "";
};

const kstTimestamp = () =>
  new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date()).replace(" ", "T");

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

const redactUrl = (url: string) => {
  const redacted = url.replace(/gtm_auth=[^&]+/g, "gtm_auth=REDACTED")
    .replace(/gtm_preview=[^&]+/g, "gtm_preview=REDACTED");
  try {
    const parsed = new URL(redacted);
    for (const key of [
      "order_code",
      "orderCode",
      "payment_code",
      "paymentCode",
      "paymentKey",
      "payment_key",
      "order_no",
      "orderNo",
      "order_id",
      "orderId",
      "gclid",
      "gbraid",
      "wbraid",
      "ttclid",
    ]) {
      if (parsed.searchParams.has(key)) parsed.searchParams.set(key, "REDACTED_CONTROLLED");
    }
    return parsed.toString();
  } catch {
    return redacted;
  }
};

const withPreviewParamsAndClick = (
  inputUrl: string,
  env: { authorizationCode?: string | null; environmentId?: string | null },
  addTestClick = true,
) => {
  if (!env.authorizationCode || !env.environmentId) {
    throw new Error("quick preview environment authorizationCode/environmentId missing");
  }
  const url = new URL(inputUrl);
  url.searchParams.set("gtm_auth", env.authorizationCode);
  url.searchParams.set("gtm_preview", `env-${env.environmentId}`);
  url.searchParams.set("gtm_debug", "x");
  if (addTestClick && !url.searchParams.get("gclid")) url.searchParams.set("gclid", TEST_CLICK_ID);
  return url.toString();
};

const buildTagHtml = () => `<script>
(function () {
  var VERSION = "agent_os_path_b_controlled_traffic_${RUN_ID}";
  var ENDPOINT = ${JSON.stringify(ENDPOINT)};
  var MAX_BODY_BYTES = 12 * 1024;
  var PATH_RE = /${PAYMENT_COMPLETE_PATH_REGEX}/i;
  var STORAGE_KEYS = ["bi_paid_click_intent_v1", "__bs_imweb", "__pathb_order_bridge_preview"];
  var LEGACY_USER_ID = clean("{{HURDLERS - [맞춤 JS] user_id}}");

  function clean(value) {
    var text = value == null ? "" : String(value).trim();
    if (!text || /^(undefined|null)$/i.test(text)) return "";
    return text;
  }

  function isOrderConfirmPage() {
    return PATH_RE.test(location.pathname + " " + location.href);
  }

  function pushResult(name, data) {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(Object.assign({
      event: name,
      agent_os_path_b_preview_version: VERSION,
      email_source_candidate: LEGACY_USER_ID ? "legacy_user_id" : "none",
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
    window.__agent_os_pathb_controlled_traffic_installed = VERSION;
    if (!isOrderConfirmPage()) {
      pushResult("agent_os_path_b_controlled_traffic_blocked", { reason: "not_order_confirm_page" });
      return;
    }

    var payload = {
      site: "biocom",
      capture_stage: "order_confirm_agent_os_controlled_traffic",
      email:
        LEGACY_USER_ID ||
        text(".email-info") ||
        dataLayerLast(["email", "email_buy", "ordererEmail", "buyerEmail"]),
      email_source_candidate: LEGACY_USER_ID ? "legacy_user_id" : "none",
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
      pushResult("agent_os_path_b_controlled_traffic_blocked", { reason: "client_payload_too_large" });
      return;
    }

    window.__agent_os_pathb_controlled_traffic_last_payload_keys = Object.keys(payload).sort();
    fetch(ENDPOINT, {
      method: "POST",
      mode: "cors",
      credentials: "omit",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: body
    }).then(function (res) {
      return res.text().then(function (textBody) {
        var json = null;
        try { json = JSON.parse(textBody); } catch (e) {}
        var preview = json && json.preview ? json.preview : {};
        var ledger = json && json.ledger ? json.ledger : {};
        var result = {
          response_status: res.status,
          response_ok: !!(json && json.ok),
          identity_source: preview.identity_source || "none",
          would_store: !!(preview.would_store || ledger.stored),
          ledger_stored: !!ledger.stored,
          ledger_deduped: !!ledger.deduped,
          ledger_rejected: !!ledger.rejected,
          ledger_reject_reason: ledger.reason || "",
          would_send: false,
          email_hash_present: !!preview.email_hash_present,
          phone_hash_present: !!preview.phone_hash_present,
          order_no_hash_present: !!preview.order_no_hash_present,
          client_session_present: !!preview.client_session_present,
          click_id_hash_present: !!preview.click_id_hash_present,
          no_raw_echo_verified: !!preview.no_raw_echo_verified,
          no_platform_send_verified: !!preview.no_platform_send_verified,
          platform_send_count: preview.platform_send_count || 0,
          hash_version: preview.hash_version || "",
          source_write_flag_on: !!(json.source && json.source.write_flag_on)
        };
        window.__agent_os_pathb_controlled_traffic_last_result = result;
        pushResult("agent_os_path_b_controlled_traffic_result", result);
      });
    }).catch(function (err) {
      window.__agent_os_pathb_controlled_traffic_last_error = String(err && err.message || err);
      pushResult("agent_os_path_b_controlled_traffic_error", { error_type: "receiver_fetch_failed" });
    });
  } catch (err) {
    window.__agent_os_pathb_controlled_traffic_last_error = String(err && err.message || err);
    pushResult("agent_os_path_b_controlled_traffic_error", { error_type: "install_failed" });
  }
})();
</script>`;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchSummary = async (): Promise<SummaryBody> => {
  let lastError = "";
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    try {
      const response = await fetch(SUMMARY_ENDPOINT);
      const text = await response.text();
      if (!response.ok) {
        lastError = `summary_http_${response.status}`;
      } else {
        try {
          return JSON.parse(text) as SummaryBody;
        } catch {
          lastError = `summary_non_json_${text.slice(0, 40)}`;
        }
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await sleep(attempt * 1000);
  }
  throw new Error(`summary_fetch_failed: ${lastError}`);
};

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
      description:
        "AGENT_OS Path B controlled traffic Preview only. No submit, no publish, no platform send.",
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
        notes: "Preview only. Fires only on order confirmation paths. Do not submit/publish.",
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
          "Preview only. Uses existing legacy user_id variable as transient email source for Path B HMAC endpoint. No submit/publish/platform send.",
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

const getExistingPreviewWorkspace = async (workspaceId: string) => {
  const auth = getAuth();
  const gtm = google.tagmanager({ version: "v2", auth });
  const workspacePath = `${CONTAINER_PATH}/workspaces/${workspaceId}`;
  const latest = await gtm.accounts.containers.version_headers.latest({ parent: CONTAINER_PATH });
  const workspace = await gtm.accounts.containers.workspaces.get({ path: workspacePath });
  const tags = await gtm.accounts.containers.workspaces.tags.list({ parent: workspacePath });
  const triggers = await gtm.accounts.containers.workspaces.triggers.list({ parent: workspacePath });
  const tag = (tags.data.tag ?? [])
    .find((item) => (item.name ?? "").includes("AGENT_OS_path_b_controlled_traffic"))
    ?? (tags.data.tag ?? [])[0];
  const trigger = (triggers.data.trigger ?? [])
    .find((item) => (item.name ?? "").includes("AGENT_OS_path_b_order_confirm_controlled_traffic"))
    ?? (triggers.data.trigger ?? [])[0];
  if (!tag?.tagId || !trigger?.triggerId) {
    throw new Error(`workspace ${workspaceId} does not contain controlled traffic tag/trigger`);
  }
  const quickPreview = await gtm.accounts.containers.workspaces.quick_preview({ path: workspacePath });
  const environments = await gtm.accounts.containers.environments.list({ parent: CONTAINER_PATH });
  const environment = (environments.data.environment ?? [])
    .find((item) => item.workspaceId === workspaceId);
  return {
    liveVersion: {
      id: latest.data.containerVersionId ?? "",
      name: latest.data.name ?? "",
    },
    workspace: workspace.data,
    trigger,
    tag,
    quickPreview: quickPreview.data,
    environment: environment ?? null,
  };
};

const installPlatformRequestBlockers = async (page: Page) => {
  const blocked: string[] = [];
  const patterns = [
    "**/*google-analytics.com/**",
    "**/*analytics.google.com/**",
    "**/*googleadservices.com/**",
    "**/*googlesyndication.com/**",
    "**/*doubleclick.net/**",
    "**/*facebook.com/**",
    "**/*connect.facebook.net/**",
    "**/*tiktok.com/**",
    "**/*analytics.tiktok.com/**",
    "**/*snap.licdn.com/**",
    "**/*clarity.ms/**",
    "**/*hotjar.com/**",
    "**/*hotjar.io/**",
    "**/*channel.io/**",
    "**/*naver.com/**",
  ];
  for (const pattern of patterns) {
    await page.route(pattern, async (route) => {
      blocked.push(redactUrl(route.request().url()));
      await route.abort("blockedbyclient");
    });
  }
  return blocked;
};

const readPaidClickStorage = async (page: Page) =>
  page.evaluate(`(() => {
    var raw = "";
    var parsed = {};
    try {
      raw = localStorage.getItem("bi_paid_click_intent_v1")
        || sessionStorage.getItem("bi_paid_click_intent_v1")
        || "";
      parsed = raw ? JSON.parse(raw) : {};
    } catch (e) {}
    return {
      storage_key_present: Boolean(raw),
      click_id_present: Boolean(parsed.gclid || parsed.gbraid || parsed.wbraid),
      gclid_present: Boolean(parsed.gclid),
      gbraid_present: Boolean(parsed.gbraid),
      wbraid_present: Boolean(parsed.wbraid),
      client_id_present: Boolean(parsed.client_id || parsed.clientId),
      ga_session_id_present: Boolean(parsed.ga_session_id || parsed.gaSessionId),
      local_session_id_present: Boolean(parsed.local_session_id || parsed.localSessionId || parsed.commonSessionId || parsed.customSessionId),
      raw_length: raw.length
    };
  })()`) as Promise<Record<string, unknown>>;

const runRealOrderPreview = async (
  page: Page,
  realOrderUrl: string,
  environment: NonNullable<Awaited<ReturnType<typeof createPreviewWorkspace>>["environment"]>,
  productUrl?: string,
) => {
  const receiverStatuses: number[] = [];
  const receiverBodies: ReceiverBody[] = [];
  const networkErrors: string[] = [];
  const consoleMarkers: string[] = [];
  const gtmScriptRoutes: string[] = [];
  const blockedPlatformRequests = await installPlatformRequestBlockers(page);
  const productPreviewUrl = productUrl ? withPreviewParamsAndClick(productUrl, environment, true) : "";
  const previewUrl = withPreviewParamsAndClick(realOrderUrl, environment, !productUrl);

  await page.route("**/gtm.js?id=GTM-W2Z6PHN**", async (route) => {
    const requested = new URL(route.request().url());
    requested.searchParams.set("gtm_auth", environment.authorizationCode ?? "");
    requested.searchParams.set("gtm_preview", `env-${environment.environmentId}`);
    requested.searchParams.set("gtm_debug", "x");
    gtmScriptRoutes.push(redactUrl(requested.toString()));
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
    if (text.includes("agent_os_path_b_controlled_traffic")) consoleMarkers.push(text);
  });
  page.on("requestfailed", (request) => {
    const url = request.url();
    const isReceiver = url.includes("/api/attribution/order-bridge/identity-hmac/no-send");
    const isGtm = url.includes("googletagmanager.com/gtm.js");
    if (isReceiver || isGtm) {
      networkErrors.push(`${request.failure()?.errorText ?? "requestfailed"} ${redactUrl(url)}`);
    }
  });
  page.on("response", async (response) => {
    const url = response.url();
    if (!url.includes("/api/attribution/order-bridge/identity-hmac/no-send")) return;
    receiverStatuses.push(response.status());
    receiverBodies.push(await response.json().catch(() => ({ ok: false })));
  });

  let pageLoaded = false;
  let productStage: Record<string, unknown> | null = null;
  if (productPreviewUrl) {
    try {
      await page.goto(productPreviewUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForTimeout(9000);
      productStage = await readPaidClickStorage(page);
    } catch (error) {
      networkErrors.push(`product.goto: ${error instanceof Error ? error.message : String(error)}`);
      productStage = await readPaidClickStorage(page).catch(() => ({
        storage_key_present: false,
        click_id_present: false,
        read_error: true,
      }));
    }
  }
  try {
    await page.goto(previewUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
    pageLoaded = true;
  } catch (error) {
    networkErrors.push(`page.goto: ${error instanceof Error ? error.message : String(error)}`);
  }
  await page.waitForTimeout(9000);

  const pageState = await page.evaluate(`(() => ({
    href: window.location.href,
    installed: window.__agent_os_pathb_controlled_traffic_installed || null,
    payloadKeys: window.__agent_os_pathb_controlled_traffic_last_payload_keys || [],
    result: window.__agent_os_pathb_controlled_traffic_last_result || null,
    error: window.__agent_os_pathb_controlled_traffic_last_error || null,
    gtmLoaded: Boolean(window.google_tag_manager && window.google_tag_manager[${JSON.stringify(CONTAINER_PUBLIC_ID)}])
  }))()`) as Record<string, unknown>;
  if (typeof pageState.href === "string") pageState.href = redactUrl(pageState.href);

  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const screenshotPath = path.join(SCREENSHOT_DIR, `path-b-gtm-controlled-traffic-${RUN_ID}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: false }).catch(() => undefined);

  const serializedResponses = JSON.stringify(receiverBodies);
  const rawEchoDetected = [TEST_CLICK_ID]
    .some((raw) => serializedResponses.includes(raw));

  return {
    preview_url_redacted: redactUrl(previewUrl),
    product_url_redacted: productPreviewUrl ? redactUrl(productPreviewUrl) : "",
    page_loaded: pageLoaded,
    same_browser_product_stage: productStage,
    page_state: pageState,
    receiver_reached: receiverStatuses.length > 0,
    receiver_statuses: receiverStatuses,
    receiver_bodies: receiverBodies,
    receiver_ok_all: receiverBodies.length > 0 && receiverBodies.every((body) => body.ok === true),
    receiver_would_send_false_all:
      receiverBodies.length > 0 && receiverBodies.every((body) => body.would_send === false),
    receiver_platform_send_zero_all:
      receiverBodies.length > 0 && receiverBodies.every((body) =>
        body.no_platform_send_verified === true
        && (body.platform_send_count ?? 0) === 0
        && (body.preview?.platform_send_count ?? 0) === 0,
      ),
    raw_echo_detected: rawEchoDetected,
    console_markers: consoleMarkers,
    network_errors: networkErrors,
    blocked_platform_request_count: blockedPlatformRequests.length,
    blocked_platform_requests_sample: blockedPlatformRequests.slice(0, 20),
    gtm_script_routes_redacted: gtmScriptRoutes,
    screenshot_path: screenshotPath,
  };
};

const writeJson = (filePath: string, value: unknown) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

const main = async () => {
  const realOrderUrl = argValue("real-url") || process.env.PATH_B_CONTROLLED_ORDER_URL?.trim() || "";
  const productUrl = argValue("product-url") || process.env.PATH_B_CONTROLLED_PRODUCT_URL?.trim() || "";
  const preserveClickFlow = process.argv.includes("--preserve-click-flow");
  const workspaceId = argValue("workspace-id");
  const setupOnly = process.argv.includes("--setup-only");
  const beforeSummary = await fetchSummary();
  const created = workspaceId ? await getExistingPreviewWorkspace(workspaceId) : await createPreviewWorkspace();
  if (!created.environment) {
    throw new Error("quick preview environment not found for workspace");
  }
  const setupResult = {
    generated_at_kst: kstTimestamp(),
    run_id: RUN_ID,
    setup_only: setupOnly,
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
      left_open_for_review: true,
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
      existing_gtm_tag_modified: false,
      existing_gtm_tag_paused_or_deleted: false,
    },
    quick_preview: {
      sync_status: created.quickPreview.syncStatus ?? null,
      compiler_error: created.quickPreview.compilerError ?? null,
      environment_id: created.environment.environmentId,
      authorization_code_redacted: Boolean(created.environment.authorizationCode),
    },
    before_summary: beforeSummary,
    verdict: "PASS_FRESH_WORKSPACE_READY",
  };
  writeJson(SETUP_OUTPUT_PATH, setupResult);
  if (setupOnly) {
    console.log(JSON.stringify({
      verdict: setupResult.verdict,
      workspace_id: setupResult.workspace.workspace_id,
      tag_id: setupResult.tag.tag_id,
      trigger_id: setupResult.trigger.trigger_id,
      output: SETUP_OUTPUT_PATH,
      note: "Fresh workspace created. VM Cloud write flag can be opened after this step.",
    }, null, 2));
    return;
  }
  if (!realOrderUrl) {
    throw new Error("real order complete URL is required via --real-url or PATH_B_CONTROLLED_ORDER_URL");
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const realOrderPreview = await runRealOrderPreview(
    page,
    realOrderUrl,
    created.environment,
    preserveClickFlow ? (productUrl || DEFAULT_PRODUCT_URL) : "",
  );
  await browser.close();

  const afterSummary = await fetchSummary();
  const firstBody = realOrderPreview.receiver_bodies[0] ?? {};
  const firstPreview = firstBody.preview ?? {};
  const rowDelta =
    Number(afterSummary.summary?.row_count ?? 0) - Number(beforeSummary.summary?.row_count ?? 0);
  const platformDelta =
    Number(afterSummary.summary?.platform_send_count ?? 0) - Number(beforeSummary.summary?.platform_send_count ?? 0);
  const rawStoredDelta =
    Number(afterSummary.summary?.raw_stored_count ?? 0) - Number(beforeSummary.summary?.raw_stored_count ?? 0);

  const result = {
    generated_at_kst: kstTimestamp(),
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
      left_open_for_review: true,
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
      existing_gtm_tag_modified: false,
      existing_gtm_tag_paused_or_deleted: false,
    },
    quick_preview: {
      sync_status: created.quickPreview.syncStatus ?? null,
      compiler_error: created.quickPreview.compilerError ?? null,
      environment_id: created.environment.environmentId,
      authorization_code_redacted: Boolean(created.environment.authorizationCode),
    },
    endpoint: ENDPOINT,
    before_summary: beforeSummary,
    after_summary: afterSummary,
    row_delta: rowDelta,
    raw_stored_delta: rawStoredDelta,
    platform_send_delta: platformDelta,
    real_order_preview: {
      ...realOrderPreview,
      response_preview_booleans: {
        email_hash_present: Boolean(firstPreview.email_hash_present),
        phone_hash_present: Boolean(firstPreview.phone_hash_present),
        order_no_hash_present: Boolean(firstPreview.order_no_hash_present),
        client_session_present: Boolean(firstPreview.client_session_present),
        click_id_hash_present: Boolean(firstPreview.click_id_hash_present),
        no_raw_echo_verified: Boolean(firstPreview.no_raw_echo_verified),
        no_platform_send_verified: Boolean(firstPreview.no_platform_send_verified),
        identity_source: firstPreview.identity_source ?? "none",
        hash_version: firstPreview.hash_version ?? "",
      },
      first_ledger: firstBody.ledger ?? null,
      first_source: firstBody.source ?? null,
    },
    scorecard: {
      vm_cloud_storage_deployed: "PASS_PREVIOUS_BATCH",
      schema_bootstrap_passed: "PASS_PREVIOUS_BATCH",
      flag_off_smoke_passed: "PASS_PREVIOUS_BATCH",
      controlled_write_one_row_passed: "PASS_PREVIOUS_BATCH",
      gtm_preview_controlled_row_passed: rowDelta === 1 ? "PASS" : "HOLD",
      raw_stored_zero: rawStoredDelta === 0 ? "PASS" : "FAIL",
      platform_send_zero: platformDelta === 0 ? "PASS" : "FAIL",
      pm2_unexpected_restart_zero: "CHECK_REMOTE_LOG",
      storage_canary_main_ready: rowDelta === 1 && rawStoredDelta === 0 && platformDelta === 0 ? "PASS_WITH_GUARDS" : "HOLD",
      production_publish_ready: "HOLD",
      same_browser_storage_key_present:
        realOrderPreview.same_browser_product_stage?.storage_key_present === true ? "PASS" : (preserveClickFlow ? "HOLD" : "N/A"),
      same_browser_click_id_present:
        realOrderPreview.same_browser_product_stage?.click_id_present === true ? "PASS" : (preserveClickFlow ? "HOLD" : "N/A"),
      order_complete_click_id_hash_present:
        Boolean(firstPreview.click_id_hash_present) ? "PASS" : (preserveClickFlow ? "HOLD" : "N/A"),
    },
    forbidden_actions_not_taken: [
      "GTM Production publish",
      "GTM submit/create_version",
      "Imweb production save",
      "1h storage canary main run",
      "real paid-click actual order test",
      "Google Ads/GA4/Meta/TikTok/Naver send",
      "Google Ads conversion upload",
      "raw email/phone/member_code/order/payment storage or logging",
      "existing GTM tag pause/delete",
    ],
    verdict:
      rowDelta === 1
      && realOrderPreview.receiver_reached
      && realOrderPreview.receiver_ok_all
      && realOrderPreview.receiver_would_send_false_all
      && realOrderPreview.receiver_platform_send_zero_all
      && !realOrderPreview.raw_echo_detected
      && rawStoredDelta === 0
      && platformDelta === 0
      && (!preserveClickFlow || (
        realOrderPreview.same_browser_product_stage?.click_id_present === true
        && Boolean(firstPreview.click_id_hash_present)
      ))
        ? "PASS_GTM_PREVIEW_CONTROLLED_TRAFFIC_ROW_STORED"
        : preserveClickFlow
          ? "HOLD_GTM_PREVIEW_SAME_BROWSER_PRESERVATION"
          : "HOLD_GTM_PREVIEW_CONTROLLED_TRAFFIC",
  };

  const outPath = path.join(OUTPUT_DIR, `path-b-gtm-preview-controlled-traffic-result-${RUN_ID}.json`);
  writeJson(outPath, result);
  writeJson(path.join(OUTPUT_DIR, "path-b-gtm-preview-controlled-traffic-result-20260509.json"), result);
  if (preserveClickFlow) {
    writeJson(path.join(OUTPUT_DIR, "path-b-same-browser-preservation-preview-result-20260510.json"), result);
  }
  console.log(JSON.stringify({
    verdict: result.verdict,
    workspace_id: result.workspace.workspace_id,
    tag_id: result.tag.tag_id,
    trigger_id: result.trigger.trigger_id,
    row_delta: result.row_delta,
    raw_stored_delta: result.raw_stored_delta,
    platform_send_delta: result.platform_send_delta,
    output: outPath,
    same_browser_product_stage: result.real_order_preview.same_browser_product_stage,
    response_preview_booleans: result.real_order_preview.response_preview_booleans,
  }, null, 2));
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
