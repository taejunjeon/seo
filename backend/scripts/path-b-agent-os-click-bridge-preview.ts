import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { google } from "googleapis";
import { chromium, type BrowserContext, type Page } from "playwright";

dotenv.config({ path: path.resolve(process.cwd(), ".env"), quiet: true });
dotenv.config({ path: path.resolve(process.cwd(), "backend/.env"), override: false, quiet: true });

const ACCOUNT_ID = "4703003246";
const CONTAINER_ID = "13158774";
const CONTAINER_PUBLIC_ID = "GTM-W2Z6PHN";
const WORKSPACE_ID = process.env.PATH_B_AGENT_OS_GTM_WORKSPACE_ID?.trim() || "164";
const CONTAINER_PATH = `accounts/${ACCOUNT_ID}/containers/${CONTAINER_ID}`;
const WORKSPACE_PATH = `${CONTAINER_PATH}/workspaces/${WORKSPACE_ID}`;
const REPO_ROOT = path.basename(process.cwd()) === "backend"
  ? path.resolve(process.cwd(), "..")
  : process.cwd();
const OUTPUT_DIR = path.resolve(REPO_ROOT, "data");
const RUN_ID = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "Z");
const TEST_CLICK_ID = `TEST_GCLID_PATHB_PREVIEW_${RUN_ID}`;
const FLOW_CLICK_ID = `TEST_GCLID_PATHB_FLOW_${RUN_ID}`;
const DIRECT_ORDER_NO = `PATHB_AGENT_OS_DIRECT_ORDER_${RUN_ID}`;
const FLOW_ORDER_NO = `PATHB_AGENT_OS_FLOW_ORDER_${RUN_ID}`;
const DIRECT_CLIENT_ID = `agent-os-direct-client-${RUN_ID}`;
const FLOW_CLIENT_ID = `agent-os-flow-client-${RUN_ID}`;
const DIRECT_LOCAL_SESSION_ID = `agent-os-direct-session-${RUN_ID}`;
const FLOW_LOCAL_SESSION_ID = `agent-os-flow-session-${RUN_ID}`;

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
    identity_source?: string;
    hash_version?: string;
  };
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

const redactPreviewUrl = (url: string) => {
  const redacted = url.replace(/gtm_auth=[^&]+/g, "gtm_auth=REDACTED")
    .replace(/gtm_preview=[^&]+/g, "gtm_preview=REDACTED");
  try {
    const parsed = new URL(redacted);
    for (const key of ["order_no", "orderNo", "order_id", "orderId", "gclid", "gbraid", "wbraid", "ttclid"]) {
      if (parsed.searchParams.has(key)) parsed.searchParams.set(key, "REDACTED_SYNTHETIC");
    }
    return parsed.toString();
  } catch {
    return redacted;
  }
};

const buildOrderCompleteHtml = (clientId: string, localSessionId: string) => `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <title>AGENT_OS Path B click bridge Preview</title>
  <script>
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      "gtm.start": Date.now(),
      event: "gtm.js",
      client_id: ${JSON.stringify(clientId)},
      local_session_id: ${JSON.stringify(localSessionId)}
    });
  </script>
  <script src="https://www.googletagmanager.com/gtm.js?id=${CONTAINER_PUBLIC_ID}"></script>
</head>
<body class="shop_payment_complete loggedin">
  <main>AGENT_OS Path B click bridge controlled Preview</main>
</body>
</html>`;

const routePreviewGtm = async (
  page: Page,
  environment: { authorizationCode?: string | null; environmentId?: string | null },
) => {
  if (!environment.authorizationCode || !environment.environmentId) {
    throw new Error("quick preview environment authorizationCode/environmentId missing");
  }
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
};

const collectOrderCompleteResult = async (page: Page, expectedRawValues: string[]) => {
  await page.waitForTimeout(7000);
  const pageState = await page.evaluate(`(() => ({
    href: window.location.href,
    installed: window.__agent_os_pathb_user_identity_preview_installed || null,
    payloadKeys: window.__agent_os_pathb_user_identity_preview_last_payload_keys || [],
    result: window.__agent_os_pathb_user_identity_preview_last_result || null,
    error: window.__agent_os_pathb_user_identity_preview_last_error || null,
    gtmLoaded: Boolean(window.google_tag_manager && window.google_tag_manager[${JSON.stringify(CONTAINER_PUBLIC_ID)}])
  }))()`) as Record<string, unknown>;
  if (typeof pageState.href === "string") pageState.href = redactPreviewUrl(pageState.href);
  return { pageState, expectedRawValues };
};

const summarizeReceiver = (receiverBodies: ReceiverBody[], expectedRawValues: string[]) => {
  const firstPreview = receiverBodies[0]?.preview ?? {};
  const serialized = JSON.stringify(receiverBodies);
  return {
    receiver_ok_all: receiverBodies.length > 0 && receiverBodies.every((body) => body.ok === true),
    receiver_would_store_false_all:
      receiverBodies.length > 0 && receiverBodies.every((body) => body.would_store === false),
    receiver_would_send_false_all:
      receiverBodies.length > 0 && receiverBodies.every((body) => body.would_send === false),
    receiver_platform_send_zero_all:
      receiverBodies.length > 0 && receiverBodies.every((body) =>
        body.no_platform_send_verified === true
        && (body.platform_send_count ?? 0) === 0
        && (body.preview?.platform_send_count ?? 0) === 0,
      ),
    raw_echo_detected: expectedRawValues.some((raw) => serialized.includes(raw)),
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
  };
};

const runDirectClickIdPreview = async (
  context: BrowserContext,
  environment: { authorizationCode?: string | null; environmentId?: string | null },
) => {
  const page = await context.newPage();
  const receiverStatuses: number[] = [];
  const receiverBodies: ReceiverBody[] = [];
  const networkErrors: string[] = [];
  const pageUrl =
    `https://biocom.kr/shop_payment_complete?order_no=${encodeURIComponent(DIRECT_ORDER_NO)}`
    + `&gclid=${encodeURIComponent(TEST_CLICK_ID)}`;
  const expectedRawValues = [DIRECT_ORDER_NO, TEST_CLICK_ID, DIRECT_CLIENT_ID, DIRECT_LOCAL_SESSION_ID];

  await page.route("https://biocom.kr/shop_payment_complete**", async (route) => {
    await route.fulfill({
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
      },
      body: buildOrderCompleteHtml(DIRECT_CLIENT_ID, DIRECT_LOCAL_SESSION_ID),
    });
  });
  await routePreviewGtm(page, environment);
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
  const { pageState } = await collectOrderCompleteResult(page, expectedRawValues);
  await page.close();
  return {
    page_url_redacted: redactPreviewUrl(pageUrl),
    receiver_statuses: receiverStatuses,
    receiver_bodies: receiverBodies,
    network_errors: networkErrors,
    page_state: pageState,
    ...summarizeReceiver(receiverBodies, expectedRawValues),
  };
};

const runSameBrowserPreservationPreview = async (
  context: BrowserContext,
  environment: { authorizationCode?: string | null; environmentId?: string | null },
) => {
  const page = await context.newPage();
  const receiverStatuses: number[] = [];
  const receiverBodies: ReceiverBody[] = [];
  const networkErrors: string[] = [];
  const productUrl = `https://biocom.kr/shop_view/?idx=198&gclid=${encodeURIComponent(FLOW_CLICK_ID)}`;
  const orderUrl = `https://biocom.kr/shop_payment_complete?order_no=${encodeURIComponent(FLOW_ORDER_NO)}`;
  const expectedRawValues = [FLOW_ORDER_NO, FLOW_CLICK_ID, FLOW_CLIENT_ID, FLOW_LOCAL_SESSION_ID];

  await page.route("https://biocom.kr/shop_view/**", async (route) => {
    await route.fulfill({
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
      },
      body: `<!doctype html>
<html lang="ko">
<head><meta charset="utf-8"><title>AGENT_OS Path B flow source</title></head>
<body>
  <script>
    localStorage.setItem("bi_paid_click_intent_v1", JSON.stringify({
      gclid: ${JSON.stringify(FLOW_CLICK_ID)},
      client_id: ${JSON.stringify(FLOW_CLIENT_ID)},
      localSessionId: ${JSON.stringify(FLOW_LOCAL_SESSION_ID)}
    }));
    window.__agent_os_same_browser_capture = { storage_key: "bi_paid_click_intent_v1", click_id_present: true };
  </script>
  <main>AGENT_OS Path B product-stage controlled capture</main>
</body>
</html>`,
    });
  });
  await page.route("https://biocom.kr/shop_payment_complete**", async (route) => {
    await route.fulfill({
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
      },
      body: buildOrderCompleteHtml(FLOW_CLIENT_ID, FLOW_LOCAL_SESSION_ID),
    });
  });
  await routePreviewGtm(page, environment);
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

  await page.goto(productUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
  const productStage = await page.evaluate(`(() => {
    var raw = localStorage.getItem("bi_paid_click_intent_v1") || "";
    var parsed = {};
    try { parsed = JSON.parse(raw); } catch (e) {}
    return {
      capture_marker_present: Boolean(window.__agent_os_same_browser_capture && window.__agent_os_same_browser_capture.click_id_present),
      storage_key_present: Boolean(raw),
      click_id_present: Boolean(parsed.gclid),
      client_id_present: Boolean(parsed.client_id),
      local_session_id_present: Boolean(parsed.localSessionId)
    };
  })()`);

  await page.goto(orderUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
  const { pageState } = await collectOrderCompleteResult(page, expectedRawValues);
  await page.close();
  return {
    product_url_redacted: redactPreviewUrl(productUrl),
    order_url_redacted: redactPreviewUrl(orderUrl),
    product_stage: productStage,
    receiver_statuses: receiverStatuses,
    receiver_bodies: receiverBodies,
    network_errors: networkErrors,
    page_state: pageState,
    ...summarizeReceiver(receiverBodies, expectedRawValues),
  };
};

const writeJson = (filePath: string, value: unknown) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

const main = async () => {
  const auth = getAuth();
  const gtm = google.tagmanager({ version: "v2", auth });
  const quickPreview = await gtm.accounts.containers.workspaces.quick_preview({ path: WORKSPACE_PATH });
  const environments = await gtm.accounts.containers.environments.list({ parent: CONTAINER_PATH });
  const environment = (environments.data.environment ?? [])
    .find((item) => item.workspaceId === WORKSPACE_ID);
  if (!environment) throw new Error(`quick preview environment for workspace ${WORKSPACE_ID} not found`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const direct = await runDirectClickIdPreview(context, environment);
  const sameBrowser = await runSameBrowserPreservationPreview(context, environment);
  await browser.close();

  const directPass =
    direct.receiver_ok_all
    && direct.receiver_would_store_false_all
    && direct.receiver_would_send_false_all
    && direct.receiver_platform_send_zero_all
    && !direct.raw_echo_detected
    && direct.response_preview_booleans.click_id_hash_present
    && direct.response_preview_booleans.order_no_hash_present
    && direct.response_preview_booleans.client_session_present;

  const preservationPass =
    sameBrowser.receiver_ok_all
    && sameBrowser.receiver_would_store_false_all
    && sameBrowser.receiver_would_send_false_all
    && sameBrowser.receiver_platform_send_zero_all
    && !sameBrowser.raw_echo_detected
    && Boolean((sameBrowser.product_stage as { click_id_present?: boolean }).click_id_present)
    && sameBrowser.response_preview_booleans.click_id_hash_present
    && sameBrowser.response_preview_booleans.order_no_hash_present
    && sameBrowser.response_preview_booleans.client_session_present;

  const result = {
    generated_at_kst: kstTimestamp(),
    run_id: RUN_ID,
    workspace: {
      workspace_id: WORKSPACE_ID,
      preview_environment_id: environment.environmentId,
      quick_preview_sync_status: quickPreview.data.syncStatus ?? null,
      quick_preview_compiler_error: quickPreview.data.compilerError ?? null,
      submitted: false,
      published: false,
    },
    direct_test_click_id_preview: direct,
    same_browser_preservation_preview: sameBrowser,
    mini_scorecard: {
      order_bridge_key_present: direct.response_preview_booleans.order_no_hash_present && sameBrowser.response_preview_booleans.order_no_hash_present ? "PASS" : "FAIL",
      identity_bridge_key_present: "PASS_PREVIOUS_BATCH",
      click_bridge_key_present: direct.response_preview_booleans.click_id_hash_present ? "PASS" : "FAIL",
      raw_identity_absent: !direct.raw_echo_detected && !sameBrowser.raw_echo_detected ? "PASS" : "FAIL",
      no_platform_send: direct.receiver_platform_send_zero_all && sameBrowser.receiver_platform_send_zero_all ? "PASS" : "FAIL",
      would_store_false: direct.receiver_would_store_false_all && sameBrowser.receiver_would_store_false_all ? "PASS" : "FAIL",
      would_send_false: direct.receiver_would_send_false_all && sameBrowser.receiver_would_send_false_all ? "PASS" : "FAIL",
      production_publish_absent: "PASS",
      same_browser_preservation: preservationPass ? "PASS_CONTROLLED" : "FAIL",
      reliability_dry_run_ready: directPass && preservationPass ? "PASS_INPUT_READY" : "HOLD",
    },
    forbidden_actions_not_taken: [
      "GTM Production publish",
      "GTM submit/create_version",
      "Imweb production save",
      "backend operational storage canary",
      "operational schema migration",
      "real ad click generation",
      "actual payment test",
      "raw email/phone/member_code/order/payment operational storage",
      "Google Ads/GA4/Meta/TikTok/Naver send",
      "Google Ads conversion upload",
      "existing GTM tag pause/delete",
      "new operational raw logging",
    ],
    verdict:
      directPass && preservationPass
        ? "PASS_CLICK_BRIDGE_PREVIEW_AND_CONTROLLED_PRESERVATION"
        : "HOLD_CLICK_BRIDGE_PREVIEW",
  };

  writeJson(path.join(OUTPUT_DIR, `path-b-test-click-id-preview-result-${RUN_ID}.json`), result);
  writeJson(path.join(OUTPUT_DIR, "path-b-test-click-id-preview-result-20260509.json"), result);
  writeJson(path.join(OUTPUT_DIR, "path-b-same-browser-preservation-preview-result-20260509.json"), result);
  console.log(JSON.stringify({
    verdict: result.verdict,
    direct: direct.response_preview_booleans,
    same_browser: sameBrowser.response_preview_booleans,
    mini_scorecard: result.mini_scorecard,
    output: "data/path-b-test-click-id-preview-result-20260509.json",
  }, null, 2));
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
