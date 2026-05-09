import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { google } from "googleapis";

dotenv.config({ path: path.resolve(process.cwd(), ".env"), quiet: true });
dotenv.config({ path: path.resolve(process.cwd(), "backend/.env"), override: false, quiet: true });

const ACCOUNT_ID = "4703003246";
const CONTAINER_ID = "13158774";
const CONTAINER_PATH = `accounts/${ACCOUNT_ID}/containers/${CONTAINER_ID}`;
const REPO_ROOT = path.basename(process.cwd()) === "backend"
  ? path.resolve(process.cwd(), "..")
  : process.cwd();
const OUTPUT_DIR = path.resolve(REPO_ROOT, "data");
const RUN_ID = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "Z");

const DEFAULT_WORKSPACE_IDS = ["163", "164"];

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
      "https://www.googleapis.com/auth/tagmanager.delete.containers",
    ],
  });
};

const listSafe = async <T>(fn: () => Promise<{ data: T }>, fallback: T) => {
  try {
    const response = await fn();
    return response.data;
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : String(error),
      fallback,
    } as T & { error: string; fallback: T };
  }
};

const workspaceIsCleanupEligible = (workspaceId: string, name: string) => {
  if (workspaceId === "147" || /default workspace/i.test(name)) return false;
  const normalized = name.toLowerCase();
  return normalized.includes("preview")
    || normalized.includes("path_b")
    || normalized.includes("agent_os")
    || normalized.includes("codex");
};

const writeJson = (filePath: string, value: unknown) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

const main = async () => {
  const workspaceIds = (argValue("workspace-ids") || DEFAULT_WORKSPACE_IDS.join(","))
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const dryRun = process.argv.includes("--dry-run");
  const auth = getAuth();
  const gtm = google.tagmanager({ version: "v2", auth });

  const latestBefore = await gtm.accounts.containers.version_headers.latest({ parent: CONTAINER_PATH });
  const workspacesBefore = await gtm.accounts.containers.workspaces.list({ parent: CONTAINER_PATH });
  const beforeItems = workspacesBefore.data.workspace ?? [];

  const backups = [];
  const cleanupResults = [];
  for (const workspaceId of workspaceIds) {
    const workspacePath = `${CONTAINER_PATH}/workspaces/${workspaceId}`;
    const workspace = await gtm.accounts.containers.workspaces.get({ path: workspacePath });
    const name = workspace.data.name ?? "";
    const eligible = workspaceIsCleanupEligible(workspaceId, name);
    const backup = {
      workspace: workspace.data,
      tags: await listSafe(
        () => gtm.accounts.containers.workspaces.tags.list({ parent: workspacePath }),
        {},
      ),
      triggers: await listSafe(
        () => gtm.accounts.containers.workspaces.triggers.list({ parent: workspacePath }),
        {},
      ),
      variables: await listSafe(
        () => gtm.accounts.containers.workspaces.variables.list({ parent: workspacePath }),
        {},
      ),
      folders: await listSafe(
        () => gtm.accounts.containers.workspaces.folders.list({ parent: workspacePath }),
        {},
      ),
      builtInVariables: await listSafe(
        () => gtm.accounts.containers.workspaces.built_in_variables.list({ parent: workspacePath }),
        {},
      ),
      cleanup_eligibility: {
        eligible,
        reason: eligible
          ? "Preview/path_b/agent_os/codex workspace and not Default Workspace"
          : "Not an approved Preview workspace candidate",
      },
    };
    backups.push(backup);
    if (!eligible) {
      cleanupResults.push({
        workspace_id: workspaceId,
        name,
        deleted: false,
        reason: "not_cleanup_eligible",
      });
      continue;
    }
    if (dryRun) {
      cleanupResults.push({
        workspace_id: workspaceId,
        name,
        deleted: false,
        reason: "dry_run",
      });
      continue;
    }
    await gtm.accounts.containers.workspaces.delete({ path: workspacePath });
    cleanupResults.push({
      workspace_id: workspaceId,
      name,
      deleted: true,
      reason: "approved_preview_workspace_cleanup",
    });
  }

  const latestAfter = await gtm.accounts.containers.version_headers.latest({ parent: CONTAINER_PATH });
  const workspacesAfter = await gtm.accounts.containers.workspaces.list({ parent: CONTAINER_PATH });
  const afterItems = workspacesAfter.data.workspace ?? [];

  const liveVersionBefore = {
    id: latestBefore.data.containerVersionId ?? "",
    name: latestBefore.data.name ?? "",
  };
  const liveVersionAfter = {
    id: latestAfter.data.containerVersionId ?? "",
    name: latestAfter.data.name ?? "",
  };
  const result = {
    generated_at_kst: kstTimestamp(),
    run_id: RUN_ID,
    dry_run: dryRun,
    target_workspace_ids: workspaceIds,
    live_version_before: liveVersionBefore,
    live_version_after: liveVersionAfter,
    live_version_unchanged:
      liveVersionBefore.id === liveVersionAfter.id && liveVersionBefore.name === liveVersionAfter.name,
    workspace_count_before: beforeItems.length,
    workspace_count_after: afterItems.length,
    workspaces_before: beforeItems.map((workspace) => ({
      id: workspace.workspaceId,
      name: workspace.name,
      path: workspace.path,
    })),
    workspaces_after: afterItems.map((workspace) => ({
      id: workspace.workspaceId,
      name: workspace.name,
      path: workspace.path,
    })),
    backups,
    cleanup_results: cleanupResults,
    submit_create_version_publish_taken: false,
    existing_live_tags_modified: false,
    verdict:
      cleanupResults.every((item) => item.deleted || item.reason === "dry_run")
      && liveVersionBefore.id === liveVersionAfter.id
        ? dryRun
          ? "PASS_DRY_RUN_BACKUP_READY"
          : "PASS_PREVIEW_WORKSPACE_CLEANUP"
        : "HOLD_PREVIEW_WORKSPACE_CLEANUP",
  };

  const outputPath = path.join(OUTPUT_DIR, `gtm-preview-workspace-cleanup-${RUN_ID}.json`);
  writeJson(outputPath, result);
  writeJson(path.join(OUTPUT_DIR, "gtm-preview-workspace-cleanup-20260509.json"), result);
  console.log(JSON.stringify({
    verdict: result.verdict,
    dry_run: result.dry_run,
    live_version_unchanged: result.live_version_unchanged,
    workspace_count_before: result.workspace_count_before,
    workspace_count_after: result.workspace_count_after,
    cleanup_results: result.cleanup_results,
    output: outputPath,
  }, null, 2));
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
