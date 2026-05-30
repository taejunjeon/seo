#!/usr/bin/env tsx
import fs from "node:fs";
import path from "node:path";

import dotenv from "dotenv";
import { google } from "googleapis";

const repoRoot = path.resolve(__dirname, "..", "..");
dotenv.config({ path: path.resolve(repoRoot, "backend", ".env"), quiet: true });
dotenv.config({ path: path.resolve(repoRoot, ".env"), override: false, quiet: true });

const ACCOUNT_ID = "4703003246";
const CONTAINER_ID = "13158774";
const CONTAINER_PUBLIC_ID = "GTM-W2Z6PHN";
const CONTAINER_PATH = `accounts/${ACCOUNT_ID}/containers/${CONTAINER_ID}`;
const OUTPUT_DIR = path.resolve(repoRoot, "data");
const JS_PATH = path.resolve(repoRoot, "imweb", "biocom-npay-bridge-gtm-v1-1-preview.js");
const RUN_ID = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "Z");
const WORKSPACE_NAME = `codex_npay_bridge_v11_preview_${RUN_ID}`;
const TRIGGER_NAME = `codex_npay_bridge_v11_all_pages_preview_${RUN_ID}`;
const TAG_NAME = `codex_npay_bridge_v11_custom_html_preview_${RUN_ID}`;

type Args = {
  execute: boolean;
  workspaceId: string;
  help: boolean;
};

const valueAfter = (arg: string, key: string) =>
  arg.startsWith(`--${key}=`) ? arg.slice(key.length + 3) : "";

const parseArgs = (argv: string[]): Args => {
  const args: Args = {
    execute: false,
    workspaceId: "",
    help: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1] ?? "";
    if (arg === "--execute") args.execute = true;
    else if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--workspace-id") {
      args.workspaceId = next;
      i += 1;
    } else if (arg.startsWith("--workspace-id=")) {
      args.workspaceId = valueAfter(arg, "workspace-id");
    }
  }
  return args;
};

const usage = `Usage:
  cd /Users/vibetj/coding/seo
  npx --prefix backend tsx backend/scripts/npay-bridge-v11-gtm-preview.ts --execute

  # Or apply into an existing preview workspace:
  npx --prefix backend tsx backend/scripts/npay-bridge-v11-gtm-preview.ts --workspace-id=171 --execute

What this does:
  - Creates a fresh GTM Preview workspace for GTM-W2Z6PHN, or uses --workspace-id if provided.
  - Adds the Biocom NPay bridge URL capture v1.1 Custom HTML tag.
  - Uses an All Pages trigger, but the script sends only after NPay click/bridge observation.
  - Runs quick_preview compile.

What this never does:
  - No submit.
  - No create_version.
  - No production publish.
  - No Google Ads / Meta / GA4 conversion send.
`;

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

const writeJson = (filename: string, value: unknown) => {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const filePath = path.resolve(OUTPUT_DIR, filename);
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return filePath;
};

const findWorkspace = async (
  gtm: ReturnType<typeof google.tagmanager>,
  workspaceId: string,
) => {
  const workspaces = await gtm.accounts.containers.workspaces.list({ parent: CONTAINER_PATH });
  const list = workspaces.data.workspace ?? [];
  if (workspaceId) {
    return list.find((workspace) => workspace.workspaceId === workspaceId) ?? null;
  }
  return list.find((workspace) =>
    workspace.name === "biocom-npay-bridge-preview-20260528"
    || /^codex_npay_bridge_v11_preview_/.test(workspace.name ?? "")
  ) ?? null;
};

const buildTagHtml = () => {
  const js = fs.readFileSync(JS_PATH, "utf8");
  return `<script>\n${js}\n</script>`;
};

const pickPreviewEnvironment = async (
  gtm: ReturnType<typeof google.tagmanager>,
  workspaceId: string,
) => {
  const environments = await gtm.accounts.containers.environments.list({ parent: CONTAINER_PATH });
  return (environments.data.environment ?? []).find((item) => item.workspaceId === workspaceId) ?? null;
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage);
    return;
  }

  const tagHtml = buildTagHtml();
  const auth = getAuth();
  const gtm = google.tagmanager({ version: "v2", auth });

  const [liveVersion, beforeWorkspaces] = await Promise.all([
    gtm.accounts.containers.version_headers.latest({ parent: CONTAINER_PATH }),
    gtm.accounts.containers.workspaces.list({ parent: CONTAINER_PATH }),
  ]);

  const beforeWorkspaceSummary = (beforeWorkspaces.data.workspace ?? []).map((workspace) => ({
    workspace_id: workspace.workspaceId ?? "",
    name: workspace.name ?? "",
    path: workspace.path ?? "",
  }));

  const dryRunSummary = {
    generated_at_kst: kstTimestamp(),
    run_id: RUN_ID,
    execute: args.execute,
    lane: "Yellow",
    container_public_id: CONTAINER_PUBLIC_ID,
    container_path: CONTAINER_PATH,
    live_version_before: {
      id: liveVersion.data.containerVersionId ?? "",
      name: liveVersion.data.name ?? "",
    },
    workspaces_before: beforeWorkspaceSummary,
    requested_workspace_id: args.workspaceId,
    planned_workspace_name: args.workspaceId ? "" : WORKSPACE_NAME,
    planned_trigger_name: TRIGGER_NAME,
    planned_tag_name: TAG_NAME,
    tag_source_file: JS_PATH,
    tag_html_bytes: Buffer.byteLength(tagHtml, "utf8"),
    no_submit: true,
    no_create_version: true,
    no_publish: true,
    note: "Preview workspace only. The Custom HTML tag writes to VM Cloud npay-intent only when the tester clicks/opens NPay.",
  };

  if (!args.execute) {
    const filePath = writeJson(`npay-bridge-v11-gtm-preview-dry-run-${RUN_ID}.json`, dryRunSummary);
    console.log(JSON.stringify({ ok: true, dry_run: true, output: filePath, summary: dryRunSummary }, null, 2));
    return;
  }

  const existingWorkspace = await findWorkspace(gtm, args.workspaceId);
  const workspace = existingWorkspace
    ? { data: existingWorkspace }
    : await gtm.accounts.containers.workspaces.create({
        parent: CONTAINER_PATH,
        requestBody: {
          name: WORKSPACE_NAME,
          description: "Codex NPay bridge URL capture v1.1 Preview only. No submit, no publish, no platform conversion send.",
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
      notes: "Preview only All Pages trigger. The tag itself sends only after NPay click/bridge observation.",
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
        { type: "template", key: "html", value: tagHtml },
        { type: "boolean", key: "supportDocumentWrite", value: "false" },
      ],
      firingTriggerId: [trigger.data.triggerId],
      notes: "Preview only. Captures NPay click + bridge URL evidence to VM Cloud npay-intent. Do not submit/publish.",
    },
  });

  const quickPreview = await gtm.accounts.containers.workspaces.quick_preview({
    path: workspace.data.path,
  });
  const environment = await pickPreviewEnvironment(gtm, workspace.data.workspaceId);

  const result = {
    ...dryRunSummary,
    execute: true,
    workspace_created_or_reused: {
      workspace_id: workspace.data.workspaceId ?? "",
      name: workspace.data.name ?? "",
      path: workspace.data.path ?? "",
      reused: Boolean(existingWorkspace),
    },
    trigger_created: {
      trigger_id: trigger.data.triggerId ?? "",
      name: trigger.data.name ?? "",
      type: trigger.data.type ?? "",
    },
    tag_created: {
      tag_id: tag.data.tagId ?? "",
      name: tag.data.name ?? "",
      type: tag.data.type ?? "",
      firing_trigger_id: tag.data.firingTriggerId ?? [],
    },
    quick_preview: {
      sync_status: quickPreview.data.syncStatus ?? null,
      compiler_error: quickPreview.data.compilerError ?? null,
      container_version_id: quickPreview.data.containerVersion?.containerVersionId ?? null,
      container_version_name: quickPreview.data.containerVersion?.name ?? null,
    },
    preview_environment: environment
      ? {
          environment_id: environment.environmentId ?? "",
          workspace_id: environment.workspaceId ?? "",
          name: environment.name ?? "",
          type: environment.type ?? "",
          authorization_code_present: Boolean(environment.authorizationCode),
        }
      : null,
    no_submit_done: true,
    no_create_version_done: true,
    no_publish_done: true,
  };

  const output = writeJson(`npay-bridge-v11-gtm-preview-apply-${RUN_ID}.json`, result);
  console.log(JSON.stringify({ ok: true, output, result }, null, 2));
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
