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
const WORKSPACE_ID = process.env.PATH_B_AGENT_OS_GTM_WORKSPACE_ID?.trim() || "164";
const TAG_ID = process.env.PATH_B_AGENT_OS_GTM_TAG_ID?.trim() || "293";
const TRIGGER_ID = process.env.PATH_B_AGENT_OS_GTM_TRIGGER_ID?.trim() || "292";
const CONTAINER_PATH = `accounts/${ACCOUNT_ID}/containers/${CONTAINER_ID}`;
const WORKSPACE_PATH = `${CONTAINER_PATH}/workspaces/${WORKSPACE_ID}`;
const TAG_PATH = `${WORKSPACE_PATH}/tags/${TAG_ID}`;
const TRIGGER_PATH = `${WORKSPACE_PATH}/triggers/${TRIGGER_ID}`;
const REPO_ROOT = path.basename(process.cwd()) === "backend"
  ? path.resolve(process.cwd(), "..")
  : process.cwd();
const OUTPUT_DIR = path.resolve(REPO_ROOT, "data");
const RUN_ID = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "Z");
const SYNTHETIC_ORDER_NO = `PATHB_AGENT_OS_RENAME_ORDER_${RUN_ID}`;
const SYNTHETIC_CLICK_ID = `TEST_GCLID_PATHB_AGENT_OS_RENAME_${RUN_ID}`;
const SYNTHETIC_EMAIL = `buyer.pathb.agentos.rename.${RUN_ID.toLowerCase()}@example.invalid`;

const NEW_WORKSPACE_NAME = `agent_os_path_b_user_identity_preview_${RUN_ID}`;
const NEW_TAG_NAME = `AGENT_OS_path_b_user_identity_hmac_preview_no_send_${RUN_ID}`;
const NEW_TRIGGER_NAME = `AGENT_OS_path_b_order_confirm_pages_preview_${RUN_ID}`;

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

const htmlParam = (tag: { parameter?: Array<{ key?: string | null; value?: string | null }> }) =>
  tag.parameter?.find((param) => param.key === "html");

const renameHtml = (html: string) => html
  .replaceAll("path_b_hurdlers_user_id_preview", "agent_os_path_b_user_identity_preview")
  .replaceAll("__pathb_hurdlers_user_id_preview", "__agent_os_pathb_user_identity_preview")
  .replaceAll("order_confirm_hurdlers_user_id_preview", "order_confirm_agent_os_user_identity_preview")
  .replaceAll("hurdlers_user_id", "legacy_user_id")
  .replaceAll("HURDLERS_USER_ID", "LEGACY_USER_ID")
  .replaceAll("Path B HURDLERS user_id Preview", "AGENT_OS Path B user identity Preview")
  .replaceAll("Path B HURDLERS user_id controlled Preview", "AGENT_OS Path B user identity controlled Preview");

const runControlledSmoke = async (
  page: Page,
  environment: { authorizationCode?: string | null; environmentId?: string | null },
) => {
  if (!environment.authorizationCode || !environment.environmentId) {
    throw new Error("quick preview environment authorizationCode/environmentId missing");
  }
  const receiverStatuses: number[] = [];
  const receiverBodies: ReceiverBody[] = [];
  const networkErrors: string[] = [];
  const pageUrl =
    `https://biocom.kr/shop_payment_complete?order_no=${encodeURIComponent(SYNTHETIC_ORDER_NO)}`
    + `&gclid=${encodeURIComponent(SYNTHETIC_CLICK_ID)}`;

  await page.route("https://biocom.kr/shop_payment_complete**", async (route) => {
    await route.fulfill({
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
      },
      body: `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <title>AGENT_OS Path B user identity Preview</title>
  <script>
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({"gtm.start": Date.now(), event: "gtm.js"});
  </script>
  <script src="https://www.googletagmanager.com/gtm.js?id=${CONTAINER_PUBLIC_ID}"></script>
</head>
<body class="shop_payment_complete loggedin">
  <div class="email-info">${SYNTHETIC_EMAIL}</div>
  <main>AGENT_OS Path B user identity controlled Preview</main>
</body>
</html>`,
    });
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
    installed: window.__agent_os_pathb_user_identity_preview_installed || null,
    payloadKeys: window.__agent_os_pathb_user_identity_preview_last_payload_keys || [],
    result: window.__agent_os_pathb_user_identity_preview_last_result || null,
    error: window.__agent_os_pathb_user_identity_preview_last_error || null,
    gtmLoaded: Boolean(window.google_tag_manager && window.google_tag_manager[${JSON.stringify(CONTAINER_PUBLIC_ID)}])
  }))()`) as Record<string, unknown>;
  if (typeof pageState.href === "string") pageState.href = redactPreviewUrl(pageState.href);

  const serializedResponses = JSON.stringify(receiverBodies);
  const rawEchoDetected = [SYNTHETIC_EMAIL, SYNTHETIC_ORDER_NO, SYNTHETIC_CLICK_ID]
    .some((raw) => serializedResponses.includes(raw));
  return {
    page_url_redacted: redactPreviewUrl(pageUrl),
    page_state: pageState,
    receiver_statuses: receiverStatuses,
    receiver_bodies: receiverBodies,
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
    raw_echo_detected: rawEchoDetected,
    network_errors: networkErrors,
  };
};

const writeJson = (filePath: string, value: unknown) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

const main = async () => {
  const auth = getAuth();
  const gtm = google.tagmanager({ version: "v2", auth });

  const workspace = await gtm.accounts.containers.workspaces.get({ path: WORKSPACE_PATH });
  const previousWorkspaceName = workspace.data.name ?? "";
  workspace.data.name = NEW_WORKSPACE_NAME;
  workspace.data.description =
    "AGENT_OS Path B user identity Preview only. No submit, no publish, no platform send.";
  const updatedWorkspace = await gtm.accounts.containers.workspaces.update({
    path: WORKSPACE_PATH,
    requestBody: workspace.data,
  });

  const trigger = await gtm.accounts.containers.workspaces.triggers.get({ path: TRIGGER_PATH });
  const previousTriggerName = trigger.data.name ?? "";
  trigger.data.name = NEW_TRIGGER_NAME;
  trigger.data.notes = "AGENT_OS Preview only. Fires only on order confirmation paths. Do not submit/publish.";
  const updatedTrigger = await gtm.accounts.containers.workspaces.triggers.update({
    path: TRIGGER_PATH,
    requestBody: trigger.data,
  });

  const tag = await gtm.accounts.containers.workspaces.tags.get({ path: TAG_PATH });
  const previousTagName = tag.data.name ?? "";
  const param = htmlParam(tag.data);
  if (!param?.value) throw new Error("tag html parameter missing");
  const nextHtml = renameHtml(param.value);
  if (nextHtml === param.value) {
    throw new Error("expected legacy preview strings were not found; aborting blind update");
  }
  param.value = nextHtml;
  tag.data.name = NEW_TAG_NAME;
  tag.data.notes =
    "AGENT_OS Preview only. Uses existing legacy user_id variable as transient email source for no-send HMAC endpoint. No submit/publish/platform send.";
  const updatedTag = await gtm.accounts.containers.workspaces.tags.update({
    path: TAG_PATH,
    requestBody: tag.data,
  });

  const quickPreview = await gtm.accounts.containers.workspaces.quick_preview({ path: WORKSPACE_PATH });
  const environments = await gtm.accounts.containers.environments.list({ parent: CONTAINER_PATH });
  const environment = (environments.data.environment ?? [])
    .find((item) => item.workspaceId === WORKSPACE_ID);
  if (!environment) throw new Error(`quick preview environment for workspace ${WORKSPACE_ID} not found`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const smoke = await runControlledSmoke(page, environment);
  await browser.close();

  const previewBody = smoke.receiver_bodies[0]?.preview ?? {};
  const result = {
    generated_at_kst: kstTimestamp(),
    run_id: RUN_ID,
    workspace: {
      workspace_id: WORKSPACE_ID,
      previous_name: previousWorkspaceName,
      next_name: updatedWorkspace.data.name,
      submitted: false,
      published: false,
    },
    trigger: {
      trigger_id: TRIGGER_ID,
      previous_name: previousTriggerName,
      next_name: updatedTrigger.data.name,
    },
    tag: {
      tag_id: TAG_ID,
      previous_name: previousTagName,
      next_name: updatedTag.data.name,
      event_name_after: "agent_os_path_b_user_identity_preview_result",
      event_name_before: "path_b_hurdlers_user_id_preview_result",
    },
    quick_preview: {
      sync_status: quickPreview.data.syncStatus ?? null,
      compiler_error: quickPreview.data.compilerError ?? null,
      environment_id: environment.environmentId,
      authorization_code_redacted: Boolean(environment.authorizationCode),
    },
    controlled_smoke: {
      ...smoke,
      receiver_bodies: smoke.receiver_bodies,
      response_preview_booleans: {
        email_hash_present: Boolean(previewBody.email_hash_present),
        phone_hash_present: Boolean(previewBody.phone_hash_present),
        order_no_hash_present: Boolean(previewBody.order_no_hash_present),
        client_session_present: Boolean(previewBody.client_session_present),
        click_id_hash_present: Boolean(previewBody.click_id_hash_present),
        no_raw_echo_verified: Boolean(previewBody.no_raw_echo_verified),
        no_platform_send_verified: Boolean(previewBody.no_platform_send_verified),
        identity_source: previewBody.identity_source ?? "none",
        hash_version: previewBody.hash_version ?? "",
      },
    },
    forbidden_actions_not_taken: [
      "GTM Production publish",
      "GTM submit/create_version",
      "Imweb production save",
      "backend operational storage canary",
      "operational schema migration",
      "raw email/phone/member_code/order storage",
      "raw email/phone/member_code/order logging",
      "Google Ads/GA4/Meta/TikTok/Naver send",
      "Google Ads conversion upload",
      "existing live GTM tag pause/delete/edit",
    ],
    verdict:
      smoke.receiver_ok_all
      && smoke.receiver_would_store_false_all
      && smoke.receiver_would_send_false_all
      && smoke.receiver_platform_send_zero_all
      && !smoke.raw_echo_detected
      && Boolean(previewBody.email_hash_present)
      && previewBody.identity_source === "email"
        ? "PASS_AGENT_OS_RENAME_AND_CONTROLLED_SMOKE"
        : "HOLD_AGENT_OS_RENAME_SMOKE",
  };

  const outPath = path.join(OUTPUT_DIR, `path-b-agent-os-preview-rename-result-${RUN_ID}.json`);
  writeJson(outPath, result);
  writeJson(path.join(OUTPUT_DIR, "path-b-agent-os-preview-rename-result-20260509.json"), result);
  console.log(JSON.stringify({
    verdict: result.verdict,
    workspace: result.workspace,
    tag: result.tag,
    trigger: result.trigger,
    response_preview_booleans: result.controlled_smoke.response_preview_booleans,
    output: outPath,
  }, null, 2));
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
