import fs from "node:fs";
import path from "node:path";

import dotenv from "dotenv";
import { google } from "googleapis";

const REPO_ROOT = path.basename(process.cwd()) === "backend"
  ? path.resolve(process.cwd(), "..")
  : process.cwd();
const BACKEND_DIR = path.join(REPO_ROOT, "backend");

dotenv.config({ path: path.join(REPO_ROOT, ".env"), quiet: true });
dotenv.config({ path: path.join(BACKEND_DIR, ".env"), override: false, quiet: true });

const ACCOUNT_ID = "4703003246";
const CONTAINER_ID = "91608400";
const CONTAINER_PUBLIC_ID = "GTM-5M33GC4";
const CONTAINER_PATH = `accounts/${ACCOUNT_ID}/containers/${CONTAINER_ID}`;
const RUN_ID = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "Z");
const WORKSPACE_NAME = `codex_coffee_meta_initiatecheckout_nosend_preview_${RUN_ID}`;
const TRIGGER_NAME = `codex_coffee_shop_payment_domready_nosend_${RUN_ID}`;
const TAG_NAME = `codex_coffee_meta_initiatecheckout_nosend_preview_${RUN_ID}`;
const SNIPPET_PATH = path.join(REPO_ROOT, "scripts", "coffee-meta-middle-funnel-browser-fallback-nosend-snippet.js");
const OUTPUT_DIR = path.join(REPO_ROOT, "data", "project");

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

const credentialsJson = () => {
  const raw = process.env.GA4_BIOCOM_SERVICE_ACCOUNT_KEY?.trim()
    || process.env.GSC_SERVICE_ACCOUNT_KEY?.trim()
    || process.env.GA4_SERVICE_ACCOUNT_KEY?.trim()
    || "";
  if (!raw) throw new Error("missing_google_service_account_env");
  return raw;
};

const getAuth = () => new google.auth.GoogleAuth({
  credentials: JSON.parse(credentialsJson()),
  scopes: [
    "https://www.googleapis.com/auth/tagmanager.readonly",
    "https://www.googleapis.com/auth/tagmanager.edit.containers",
    "https://www.googleapis.com/auth/tagmanager.edit.containerversions",
    "https://www.googleapis.com/auth/tagmanager.delete.containers",
  ],
});

const writeJson = (fileName: string, value: unknown) => {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const outPath = path.join(OUTPUT_DIR, fileName);
  fs.writeFileSync(outPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return outPath;
};

const buildTagHtml = () => {
  const snippet = fs.readFileSync(SNIPPET_PATH, "utf8").trim();
  if (snippet.includes("</script")) {
    throw new Error("snippet_contains_script_close_tag");
  }
  return `<script>\n${snippet}\n</script>`;
};

const redactAuth = (value: unknown) => {
  if (typeof value !== "string") return value;
  return value.replace(/gtm_auth=[^&"]+/g, "gtm_auth=REDACTED");
};

const buildPreviewUrlTemplate = (environment: { authorizationCode?: string | null; environmentId?: string | null } | null) => {
  if (!environment?.authorizationCode || !environment.environmentId) return "";
  const url = new URL("https://thecleancoffee.com/shop_payment/");
  url.searchParams.set("order_code", "USE_REAL_ORDER_CODE");
  url.searchParams.set("order_no", "USE_REAL_ORDER_NO");
  url.searchParams.set("__seo_attribution_debug", "1");
  url.searchParams.set("gtm_auth", environment.authorizationCode);
  url.searchParams.set("gtm_preview", `env-${environment.environmentId}`);
  url.searchParams.set("gtm_cookies_win", "x");
  return url.toString();
};

const triggerRequestBody = () => ({
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
        { type: "template", key: "arg0", value: "{{Page URL}}" },
        { type: "template", key: "arg1", value: "\\/shop_payment\\/?\\?.*(order_code|order_no|orderCode|orderNo)=" },
        { type: "boolean", key: "ignore_case", value: "true" },
      ],
    },
    {
      type: "equals",
      parameter: [
        { type: "template", key: "arg0", value: "{{HURDLERS - Iframe}}" },
        { type: "template", key: "arg1", value: "false" },
      ],
    },
  ],
  notes:
    "Preview only. Fires on Coffee shop_payment order pages. No submit/create version/publish.",
});

const tagRequestBody = (triggerId: string) => ({
  name: TAG_NAME,
  type: "html",
  parameter: [
    { type: "template", key: "html", value: buildTagHtml() },
    { type: "boolean", key: "supportDocumentWrite", value: "false" },
  ],
  firingTriggerId: [triggerId],
  notes:
    "Preview only. Pushes coffee_meta_middle_funnel_preview dataLayer event. Does not call fbq/gtag/fetch/sendBeacon/Image or platform endpoints. Do not submit/publish.",
});

const main = async () => {
  const auth = getAuth();
  const gtm = google.tagmanager({ version: "v2", auth });

  const latestBefore = await gtm.accounts.containers.version_headers.latest({ parent: CONTAINER_PATH });
  const liveVersionBefore = {
    id: latestBefore.data.containerVersionId ?? "",
    name: latestBefore.data.name ?? "",
  };

  const workspacesBefore = await gtm.accounts.containers.workspaces.list({ parent: CONTAINER_PATH });
  const workspace = await gtm.accounts.containers.workspaces.create({
    parent: CONTAINER_PATH,
    requestBody: {
      name: WORKSPACE_NAME,
      description:
        "Codex Coffee Meta InitiateCheckout no-send Preview only. No submit/create version/publish/platform send.",
    },
  });
  if (!workspace.data.path || !workspace.data.workspaceId) {
    throw new Error("workspace_create_missing_path_or_id");
  }

  try {
    const trigger = await gtm.accounts.containers.workspaces.triggers.create({
      parent: workspace.data.path,
      requestBody: triggerRequestBody(),
    });
    if (!trigger.data.triggerId) throw new Error("trigger_create_missing_id");

    const tag = await gtm.accounts.containers.workspaces.tags.create({
      parent: workspace.data.path,
      requestBody: tagRequestBody(trigger.data.triggerId),
    });
    if (!tag.data.tagId) throw new Error("tag_create_missing_id");

    const quickPreview = await gtm.accounts.containers.workspaces.quick_preview({
      path: workspace.data.path,
    });
    const environments = await gtm.accounts.containers.environments.list({ parent: CONTAINER_PATH });
    const environment = (environments.data.environment ?? [])
      .find((item) => item.workspaceId === workspace.data.workspaceId) ?? null;
    const workspaceStatus = await gtm.accounts.containers.workspaces.getStatus({
      path: workspace.data.path,
    }).catch((error: unknown) => ({
      data: { error: error instanceof Error ? error.message : String(error) },
    }));
    const latestAfter = await gtm.accounts.containers.version_headers.latest({ parent: CONTAINER_PATH });
    const liveVersionAfter = {
      id: latestAfter.data.containerVersionId ?? "",
      name: latestAfter.data.name ?? "",
    };
    const workspacesAfter = await gtm.accounts.containers.workspaces.list({ parent: CONTAINER_PATH });
    const previewUrlTemplate = buildPreviewUrlTemplate(environment);
    const result = {
      generated_at_kst: kstTimestamp(),
      run_id: RUN_ID,
      container: {
        account_id: ACCOUNT_ID,
        container_id: CONTAINER_ID,
        public_id: CONTAINER_PUBLIC_ID,
        path: CONTAINER_PATH,
      },
      live_version_before: liveVersionBefore,
      live_version_after: liveVersionAfter,
      live_version_unchanged:
        liveVersionBefore.id === liveVersionAfter.id && liveVersionBefore.name === liveVersionAfter.name,
      workspace_before_count: (workspacesBefore.data.workspace ?? []).length,
      workspace_after_count: (workspacesAfter.data.workspace ?? []).length,
      workspace: {
        workspace_id: workspace.data.workspaceId,
        name: workspace.data.name,
        path: workspace.data.path,
      },
      trigger: {
        trigger_id: trigger.data.triggerId,
        name: trigger.data.name,
        type: trigger.data.type,
      },
      tag: {
        tag_id: tag.data.tagId,
        name: tag.data.name,
        type: tag.data.type,
        firing_trigger_id: tag.data.firingTriggerId,
      },
      quick_preview: {
        compiler_error: quickPreview.data.compilerError ?? false,
        sync_status: quickPreview.data.syncStatus ?? null,
      },
      environment: environment ? {
        environment_id: environment.environmentId,
        workspace_id: environment.workspaceId,
        authorization_code_present: Boolean(environment.authorizationCode),
      } : null,
      preview_url_template_redacted: redactAuth(previewUrlTemplate),
      workspace_status: {
        workspace_change_count: (workspaceStatus.data.workspaceChange ?? []).length,
        merge_conflict_count: (workspaceStatus.data.mergeConflict ?? []).length,
        error: (workspaceStatus.data as { error?: string }).error ?? "",
      },
      guards: {
        existing_live_tags_modified: false,
        submit_create_version_publish_taken: false,
        platform_send_taken: false,
        production_publish_taken: false,
        tag_event_name: "coffee_meta_middle_funnel_preview",
        preview_candidate_event_name: "InitiateCheckout",
        no_send_snippet_path: path.relative(REPO_ROOT, SNIPPET_PATH),
      },
      verdict:
        liveVersionBefore.id === liveVersionAfter.id
        && !quickPreview.data.compilerError
        && Boolean(tag.data.tagId)
        && Boolean(trigger.data.triggerId)
        && Boolean(environment?.authorizationCode)
          ? "PASS_PREVIEW_WORKSPACE_READY"
          : "HOLD_PREVIEW_WORKSPACE_READY",
    };

    const outputPath = writeJson(`coffee-meta-initiatecheckout-gtm-preview-create-${RUN_ID}.json`, result);
    const latestOutputPath = writeJson("coffee-meta-initiatecheckout-gtm-preview-create-latest.json", result);
    console.log(JSON.stringify({
      verdict: result.verdict,
      live_version_unchanged: result.live_version_unchanged,
      workspace: result.workspace,
      trigger: result.trigger,
      tag: result.tag,
      quick_preview: result.quick_preview,
      environment: result.environment,
      workspace_status: result.workspace_status,
      preview_url_template_redacted: result.preview_url_template_redacted,
      output: outputPath,
      latest_output: latestOutputPath,
    }, null, 2));
  } catch (error) {
    await gtm.accounts.containers.workspaces.delete({ path: workspace.data.path }).catch(() => undefined);
    throw error;
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
