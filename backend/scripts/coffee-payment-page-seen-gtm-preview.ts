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
const WORKSPACE_NAME = `codex_coffee_payment_page_seen_nosend_preview_${RUN_ID}`;
const TRIGGER_NAME = `codex_coffee_payment_page_seen_domready_nosend_${RUN_ID}`;
const TAG_NAME = `codex_coffee_payment_page_seen_debug_snapshot_nosend_preview_${RUN_ID}`;
const CANDIDATE_DOC_PATH = path.join(
  REPO_ROOT,
  "imweb",
  "coffee-payment-page-seen-debug-snapshot-gtm-preview-tag-20260527.md",
);
const OUTPUT_DIR = path.join(REPO_ROOT, "data", "project");
const SHOULD_APPLY = process.argv.includes("--apply");

type GtmWorkspaceStatus = {
  workspaceChange?: unknown[];
  mergeConflict?: unknown[];
  error?: string;
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
  scopes: SHOULD_APPLY
    ? [
      "https://www.googleapis.com/auth/tagmanager.readonly",
      "https://www.googleapis.com/auth/tagmanager.edit.containers",
      "https://www.googleapis.com/auth/tagmanager.edit.containerversions",
      "https://www.googleapis.com/auth/tagmanager.delete.containers",
    ]
    : [
      "https://www.googleapis.com/auth/tagmanager.readonly",
    ],
});

const writeJson = (fileName: string, value: unknown) => {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const outPath = path.join(OUTPUT_DIR, fileName);
  fs.writeFileSync(outPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return outPath;
};

const extractCandidateHtml = () => {
  const markdown = fs.readFileSync(CANDIDATE_DOC_PATH, "utf8");
  const match = markdown.match(/```html\n([\s\S]*?)\n```/);
  if (!match?.[1]) throw new Error("candidate_html_block_not_found");
  const html = match[1].trim();
  if (!html.startsWith("<script>") || !html.endsWith("</script>")) {
    throw new Error("candidate_html_must_be_single_script_tag");
  }
  if (!html.includes("2026-05-27-coffee-payment-page-seen-debug-snapshot-nosend-preview-v1")) {
    throw new Error("candidate_snippet_version_mismatch");
  }
  return html;
};

const forbiddenPatterns = [
  /fetch\s*\(/,
  /sendBeacon/,
  /new\s+Image\s*\(/,
  /\bfbq\s*\(/,
  /\bgtag\s*\(/,
  /\bwcs_do\s*\(/,
  /\bttq\./,
  /\/api\/attribution\/payment-page-seen/,
  /facebook\.com\/tr/,
  /google-analytics\.com\/mp\/collect/,
  /googleads\.g\.doubleclick\.net/,
];

const staticNoSendReview = (html: string) => {
  const hits = forbiddenPatterns
    .map((pattern) => pattern.exec(html)?.[0] ?? "")
    .filter(Boolean);
  return {
    pass: hits.length === 0,
    forbidden_hits: hits,
  };
};

const redactAuth = (value: unknown) => {
  if (typeof value !== "string") return value;
  return value.replace(/gtm_auth=[^&"]+/g, "gtm_auth=REDACTED");
};

const buildPreviewUrlTemplate = (
  environment: { authorizationCode?: string | null; environmentId?: string | null } | null,
) => {
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

const summarizeWorkspaceStatus = (status: GtmWorkspaceStatus) => ({
  workspace_change_count: (status.workspaceChange ?? []).length,
  merge_conflict_count: (status.mergeConflict ?? []).length,
  error: status.error ?? "",
});

const workspaceLooksRelated = (name: string) =>
  /codex|preview|payment_page_seen|payment-page-seen|coffee/i.test(name);

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
        { type: "template", key: "arg0", value: "{{Page Path}}" },
        { type: "template", key: "arg1", value: "^/shop_payment" },
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
    "Preview only. Fires on Coffee /shop_payment* pages. Script internally separates payment_page_seen and payment_success_debug_snapshot. No submit/create version/publish.",
});

const tagRequestBody = (triggerId: string, html: string) => ({
  name: TAG_NAME,
  type: "html",
  parameter: [
    { type: "template", key: "html", value: html },
    { type: "boolean", key: "supportDocumentWrite", value: "false" },
  ],
  firingTriggerId: [triggerId],
  notes:
    "Preview only. Pushes coffee_payment_page_seen_debug_snapshot_preview dataLayer event and writes window/sessionStorage debug snapshots only. No fbq/gtag/fetch/sendBeacon/Image/platform endpoint/VM write. Do not submit/publish.",
});

const main = async () => {
  const candidateHtml = extractCandidateHtml();
  const noSendReview = staticNoSendReview(candidateHtml);
  if (!noSendReview.pass) {
    throw new Error(`candidate_no_send_review_failed:${noSendReview.forbidden_hits.join(",")}`);
  }

  const auth = getAuth();
  const gtm = google.tagmanager({ version: "v2", auth });

  const [container, latestBefore, workspacesBefore] = await Promise.all([
    gtm.accounts.containers.get({ path: CONTAINER_PATH }),
    gtm.accounts.containers.version_headers.latest({ parent: CONTAINER_PATH }),
    gtm.accounts.containers.workspaces.list({ parent: CONTAINER_PATH }),
  ]);

  const workspaceItemsBefore = workspacesBefore.data.workspace ?? [];
  const workspaceStatusesBefore = [];
  for (const workspace of workspaceItemsBefore) {
    if (!workspace.path) continue;
    const status = await gtm.accounts.containers.workspaces.getStatus({
      path: workspace.path,
    }).catch((error: unknown) => ({
      data: { error: error instanceof Error ? error.message : String(error) },
    }));
    workspaceStatusesBefore.push({
      workspace_id: workspace.workspaceId ?? "",
      name: workspace.name ?? "",
      path: workspace.path,
      ...summarizeWorkspaceStatus(status.data as GtmWorkspaceStatus),
    });
  }

  const defaultWorkspace = workspaceStatusesBefore.find((workspace) =>
    /default workspace/i.test(workspace.name),
  ) ?? null;
  const relatedWorkspaces = workspaceStatusesBefore.filter((workspace) =>
    workspaceLooksRelated(workspace.name),
  );
  const liveVersionBefore = {
    id: latestBefore.data.containerVersionId ?? "",
    name: latestBefore.data.name ?? "",
    path: latestBefore.data.path ?? "",
  };
  const preflight = {
    generated_at_kst: kstTimestamp(),
    run_id: RUN_ID,
    mode: SHOULD_APPLY ? "apply_preview_workspace" : "dry_run_readonly",
    container: {
      account_id: ACCOUNT_ID,
      container_id: CONTAINER_ID,
      public_id: CONTAINER_PUBLIC_ID,
      name: container.data.name ?? "",
      path: CONTAINER_PATH,
    },
    live_version_before: liveVersionBefore,
    workspace_before_count: workspaceItemsBefore.length,
    default_workspace: defaultWorkspace,
    related_workspaces_before: relatedWorkspaces,
    workspace_capacity: {
      standard_limit_assumption: 3,
      custom_workspace_slots_available: Math.max(0, 3 - workspaceItemsBefore.length),
      source: "Google Tag Manager Help: non-360 containers may have up to three concurrent workspaces including Default Workspace.",
    },
    candidate: {
      doc_path: path.relative(REPO_ROOT, CANDIDATE_DOC_PATH),
      tag_name: TAG_NAME,
      trigger_name: TRIGGER_NAME,
      snippet_version: "2026-05-27-coffee-payment-page-seen-debug-snapshot-nosend-preview-v1",
      no_send_review: noSendReview,
      would_create_workspace: WORKSPACE_NAME,
      would_call_quick_preview: SHOULD_APPLY,
    },
    guards: {
      default_workspace_required_changes: 0,
      existing_live_tags_modified: false,
      submit_create_version_publish_taken: false,
      platform_send_taken: false,
      vm_cloud_write_taken: false,
      production_publish_taken: false,
    },
  };

  const preflightPass = Boolean(defaultWorkspace)
    && defaultWorkspace.workspace_change_count === 0
    && defaultWorkspace.merge_conflict_count === 0
    && workspaceItemsBefore.length < 3
    && relatedWorkspaces.length === 0
    && noSendReview.pass;

  if (!SHOULD_APPLY) {
    const result = {
      ...preflight,
      verdict: preflightPass ? "PASS_DRY_RUN_READY_FOR_APPLY" : "HOLD_DRY_RUN_PREVIEW_WORKSPACE",
      hold_reasons: [
        !defaultWorkspace ? "default_workspace_missing" : "",
        defaultWorkspace && defaultWorkspace.workspace_change_count !== 0 ? "default_workspace_has_changes" : "",
        defaultWorkspace && defaultWorkspace.merge_conflict_count !== 0 ? "default_workspace_has_conflicts" : "",
        workspaceItemsBefore.length >= 3 ? "workspace_capacity_full" : "",
        relatedWorkspaces.length > 0 ? "related_preview_workspace_exists" : "",
      ].filter(Boolean),
    };
    const outputPath = writeJson(`coffee-payment-page-seen-gtm-preview-dry-run-${RUN_ID}.json`, result);
    const latestOutputPath = writeJson("coffee-payment-page-seen-gtm-preview-dry-run-latest.json", result);
    console.log(JSON.stringify({
      verdict: result.verdict,
      live_version_before: result.live_version_before,
      workspace_before_count: result.workspace_before_count,
      default_workspace: result.default_workspace,
      related_workspaces_before: result.related_workspaces_before,
      hold_reasons: result.hold_reasons,
      no_send_review: result.candidate.no_send_review,
      output: outputPath,
      latest_output: latestOutputPath,
    }, null, 2));
    return;
  }

  if (!preflightPass) {
    const result = {
      ...preflight,
      verdict: "HOLD_APPLY_PRECHECK_FAILED",
      hold_reasons: [
        !defaultWorkspace ? "default_workspace_missing" : "",
        defaultWorkspace && defaultWorkspace.workspace_change_count !== 0 ? "default_workspace_has_changes" : "",
        defaultWorkspace && defaultWorkspace.merge_conflict_count !== 0 ? "default_workspace_has_conflicts" : "",
        workspaceItemsBefore.length >= 3 ? "workspace_capacity_full" : "",
        relatedWorkspaces.length > 0 ? "related_preview_workspace_exists" : "",
      ].filter(Boolean),
    };
    const outputPath = writeJson(`coffee-payment-page-seen-gtm-preview-hold-${RUN_ID}.json`, result);
    console.log(JSON.stringify({
      verdict: result.verdict,
      hold_reasons: result.hold_reasons,
      output: outputPath,
    }, null, 2));
    return;
  }

  const workspace = await gtm.accounts.containers.workspaces.create({
    parent: CONTAINER_PATH,
    requestBody: {
      name: WORKSPACE_NAME,
      description:
        "Codex Coffee payment_page_seen + payment_success debug snapshot no-send Preview only. No submit/create version/publish/platform send/VM write.",
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
      requestBody: tagRequestBody(trigger.data.triggerId, candidateHtml),
    });
    if (!tag.data.tagId) throw new Error("tag_create_missing_id");

    const quickPreview = await gtm.accounts.containers.workspaces.quick_preview({
      path: workspace.data.path,
    });
    const [environments, workspaceStatus, latestAfter, workspacesAfter] = await Promise.all([
      gtm.accounts.containers.environments.list({ parent: CONTAINER_PATH }),
      gtm.accounts.containers.workspaces.getStatus({ path: workspace.data.path }).catch((error: unknown) => ({
        data: { error: error instanceof Error ? error.message : String(error) },
      })),
      gtm.accounts.containers.version_headers.latest({ parent: CONTAINER_PATH }),
      gtm.accounts.containers.workspaces.list({ parent: CONTAINER_PATH }),
    ]);
    const environment = (environments.data.environment ?? [])
      .find((item) => item.workspaceId === workspace.data.workspaceId) ?? null;
    const liveVersionAfter = {
      id: latestAfter.data.containerVersionId ?? "",
      name: latestAfter.data.name ?? "",
      path: latestAfter.data.path ?? "",
    };
    const previewUrlTemplate = buildPreviewUrlTemplate(environment);
    const result = {
      ...preflight,
      live_version_after: liveVersionAfter,
      live_version_unchanged:
        liveVersionBefore.id === liveVersionAfter.id
        && liveVersionBefore.name === liveVersionAfter.name,
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
      workspace_status: summarizeWorkspaceStatus(workspaceStatus.data as GtmWorkspaceStatus),
      guards: {
        ...preflight.guards,
        workspace_created: true,
        tag_created: true,
        trigger_created: true,
        quick_preview_called: true,
      },
      verdict:
        liveVersionBefore.id === liveVersionAfter.id
        && liveVersionBefore.name === liveVersionAfter.name
        && !quickPreview.data.compilerError
        && Boolean(tag.data.tagId)
        && Boolean(trigger.data.triggerId)
        && Boolean(environment?.authorizationCode)
          ? "PASS_PREVIEW_WORKSPACE_READY"
          : "HOLD_PREVIEW_WORKSPACE_READY",
    };

    const outputPath = writeJson(`coffee-payment-page-seen-gtm-preview-create-${RUN_ID}.json`, result);
    const latestOutputPath = writeJson("coffee-payment-page-seen-gtm-preview-create-latest.json", result);
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
