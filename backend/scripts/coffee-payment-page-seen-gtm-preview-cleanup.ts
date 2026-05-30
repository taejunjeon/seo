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
const DEFAULT_WORKSPACE_NAME = "Default Workspace";
const DEFAULT_TARGET_WORKSPACE_ID = "34";
const EXPECTED_WORKSPACE_NAME = "codex_coffee_payment_page_seen_nosend_preview_20260528T035440Z";
const OUTPUT_DIR = path.join(REPO_ROOT, "data", "project");
const RUN_ID = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "Z");
const SHOULD_EXECUTE = process.argv.includes("--execute");

type GtmWorkspaceStatus = {
  workspaceChange?: unknown[];
  mergeConflict?: unknown[];
  error?: string;
};

const argValue = (name: string) => {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : "";
};

const TARGET_WORKSPACE_ID = argValue("workspace-id") || DEFAULT_TARGET_WORKSPACE_ID;
const TARGET_WORKSPACE_PATH = `${CONTAINER_PATH}/workspaces/${TARGET_WORKSPACE_ID}`;

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
    "https://www.googleapis.com/auth/tagmanager.delete.containers",
  ],
});

const writeJson = (fileName: string, value: unknown) => {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const outPath = path.join(OUTPUT_DIR, fileName);
  fs.writeFileSync(outPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return outPath;
};

const listSafe = async <T>(label: string, fn: () => Promise<{ data: T }>) => {
  try {
    const response = await fn();
    return response.data;
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : String(error),
      label,
    };
  }
};

const summarizeWorkspaces = (items: Array<{ workspaceId?: string | null; name?: string | null; path?: string | null }>) =>
  items.map((workspace) => ({
    workspace_id: workspace.workspaceId ?? "",
    name: workspace.name ?? "",
    path: workspace.path ?? "",
  }));

const summarizeStatus = (status: GtmWorkspaceStatus) => ({
  workspace_change_count: (status.workspaceChange ?? []).length,
  merge_conflict_count: (status.mergeConflict ?? []).length,
  error: status.error ?? "",
});

const isCleanupEligible = (workspaceName: string) =>
  workspaceName === EXPECTED_WORKSPACE_NAME
  && /codex_coffee_payment_page_seen_nosend_preview_/i.test(workspaceName);

async function main() {
  const auth = getAuth();
  const gtm = google.tagmanager({ version: "v2", auth });

  const [latestBefore, workspacesBeforeResponse] = await Promise.all([
    gtm.accounts.containers.version_headers.latest({ parent: CONTAINER_PATH }),
    gtm.accounts.containers.workspaces.list({ parent: CONTAINER_PATH }),
  ]);

  const targetWorkspaceResponse = await gtm.accounts.containers.workspaces.get({ path: TARGET_WORKSPACE_PATH })
    .catch((error: unknown) => null);
  const targetWorkspace = targetWorkspaceResponse?.data ?? null;
  const workspacesBefore = workspacesBeforeResponse.data.workspace ?? [];
  const targetAlreadyAbsent = !targetWorkspace
    && !workspacesBefore.some((workspace) => workspace.workspaceId === TARGET_WORKSPACE_ID);

  if (targetAlreadyAbsent) {
    const defaultWorkspaceBefore = workspacesBefore.find((workspace) => workspace.name === DEFAULT_WORKSPACE_NAME) ?? null;
    const defaultStatusBefore = defaultWorkspaceBefore?.path
      ? await gtm.accounts.containers.workspaces.getStatus({ path: defaultWorkspaceBefore.path })
        .then((response) => response.data)
        .catch((error: unknown) => ({
          error: error instanceof Error ? error.message : String(error),
        } as GtmWorkspaceStatus))
      : ({ error: "default_workspace_missing" } as GtmWorkspaceStatus);
    const latestAfter = await gtm.accounts.containers.version_headers.latest({ parent: CONTAINER_PATH });
    const liveVersionBefore = {
      id: latestBefore.data.containerVersionId ?? "",
      name: latestBefore.data.name ?? "",
      path: latestBefore.data.path ?? "",
    };
    const liveVersionAfter = {
      id: latestAfter.data.containerVersionId ?? "",
      name: latestAfter.data.name ?? "",
      path: latestAfter.data.path ?? "",
    };
    const liveVersionUnchanged =
      liveVersionBefore.id === liveVersionAfter.id
      && liveVersionBefore.name === liveVersionAfter.name;
    const defaultClean = summarizeStatus(defaultStatusBefore as GtmWorkspaceStatus);
    const pass =
      liveVersionUnchanged
      && defaultClean.workspace_change_count === 0
      && defaultClean.merge_conflict_count === 0;
    const result = {
      generated_at_kst: kstTimestamp(),
      run_id: RUN_ID,
      mode: "already_cleaned_check",
      container: {
        account_id: ACCOUNT_ID,
        container_id: CONTAINER_ID,
        public_id: CONTAINER_PUBLIC_ID,
        path: CONTAINER_PATH,
      },
      target_workspace: {
        workspace_id: TARGET_WORKSPACE_ID,
        expected_name: EXPECTED_WORKSPACE_NAME,
        observed_name: "",
        path: TARGET_WORKSPACE_PATH,
        cleanup_eligible: false,
      },
      live_version_before: liveVersionBefore,
      live_version_after: liveVersionAfter,
      live_version_unchanged: liveVersionUnchanged,
      workspace_count_before: workspacesBefore.length,
      workspace_count_after: workspacesBefore.length,
      workspaces_before: summarizeWorkspaces(workspacesBefore),
      workspaces_after: summarizeWorkspaces(workspacesBefore),
      target_workspace_present_after: false,
      target_workspace_status_before: {
        workspace_change_count: 0,
        merge_conflict_count: 0,
        error: "target_workspace_already_absent",
      },
      default_workspace_status_before: defaultClean,
      default_workspace_status_after: defaultClean,
      cleanup_result: {
        deleted: false,
        dry_run: !SHOULD_EXECUTE,
        reason: "target_workspace_already_absent",
        error: "",
      },
      backup: null,
      guards: {
        submit_create_version_publish_taken: false,
        existing_live_tags_modified: false,
        production_publish_taken: false,
        platform_send_taken: false,
        vm_cloud_write_taken: false,
        default_workspace_modified: false,
      },
      verdict: pass
        ? "PASS_PREVIEW_WORKSPACE_ALREADY_CLEANED"
        : "HOLD_PREVIEW_WORKSPACE_CLEANUP_REVIEW_REQUIRED",
    };
    const outputPath = writeJson(
      `coffee-payment-page-seen-gtm-preview-workspace34-cleanup-${RUN_ID}.json`,
      result,
    );
    const latestOutputPath = writeJson(
      "coffee-payment-page-seen-gtm-preview-workspace34-cleanup-latest.json",
      result,
    );
    console.log(JSON.stringify({
      verdict: result.verdict,
      mode: result.mode,
      cleanup_result: result.cleanup_result,
      live_version_unchanged: result.live_version_unchanged,
      target_workspace_present_after: result.target_workspace_present_after,
      default_workspace_status_after: result.default_workspace_status_after,
      output: outputPath,
      latest_output: latestOutputPath,
    }, null, 2));
    return;
  }

  if (!targetWorkspace) {
    throw new Error(`target_workspace_lookup_failed:${TARGET_WORKSPACE_PATH}`);
  }

  const targetWorkspaceName = targetWorkspace.name ?? "";
  const eligible = isCleanupEligible(targetWorkspaceName);

  const [targetStatus, defaultStatus, backup] = await Promise.all([
    gtm.accounts.containers.workspaces.getStatus({ path: TARGET_WORKSPACE_PATH })
      .then((response) => response.data)
      .catch((error: unknown) => ({
        error: error instanceof Error ? error.message : String(error),
      } as GtmWorkspaceStatus)),
    (async () => {
      const defaultWorkspace = (workspacesBeforeResponse.data.workspace ?? [])
        .find((workspace) => workspace.name === DEFAULT_WORKSPACE_NAME);
      if (!defaultWorkspace?.path) return { error: "default_workspace_missing" } as GtmWorkspaceStatus;
      return gtm.accounts.containers.workspaces.getStatus({ path: defaultWorkspace.path })
        .then((response) => response.data)
        .catch((error: unknown) => ({
          error: error instanceof Error ? error.message : String(error),
        } as GtmWorkspaceStatus));
    })(),
    (async () => ({
      workspace: targetWorkspace,
      workspace_status: await listSafe("workspace_status", () =>
        gtm.accounts.containers.workspaces.getStatus({ path: TARGET_WORKSPACE_PATH })),
      tags: await listSafe("tags", () =>
        gtm.accounts.containers.workspaces.tags.list({ parent: TARGET_WORKSPACE_PATH })),
      triggers: await listSafe("triggers", () =>
        gtm.accounts.containers.workspaces.triggers.list({ parent: TARGET_WORKSPACE_PATH })),
      variables: await listSafe("variables", () =>
        gtm.accounts.containers.workspaces.variables.list({ parent: TARGET_WORKSPACE_PATH })),
      folders: await listSafe("folders", () =>
        gtm.accounts.containers.workspaces.folders.list({ parent: TARGET_WORKSPACE_PATH })),
      built_in_variables: await listSafe("built_in_variables", () =>
        gtm.accounts.containers.workspaces.built_in_variables.list({ parent: TARGET_WORKSPACE_PATH })),
    }))(),
  ]);

  const liveVersionBefore = {
    id: latestBefore.data.containerVersionId ?? "",
    name: latestBefore.data.name ?? "",
    path: latestBefore.data.path ?? "",
  };
  const cleanupResult = {
    deleted: false,
    dry_run: !SHOULD_EXECUTE,
    reason: "",
    error: "",
  };

  if (!eligible) {
    cleanupResult.reason = "target_workspace_not_expected_preview_workspace";
  } else if (!SHOULD_EXECUTE) {
    cleanupResult.reason = "dry_run_backup_only";
  } else {
    await gtm.accounts.containers.workspaces.delete({ path: TARGET_WORKSPACE_PATH });
    cleanupResult.deleted = true;
    cleanupResult.reason = "approved_payment_page_seen_preview_workspace_cleanup";
  }

  const [latestAfter, workspacesAfterResponse] = await Promise.all([
    gtm.accounts.containers.version_headers.latest({ parent: CONTAINER_PATH }),
    gtm.accounts.containers.workspaces.list({ parent: CONTAINER_PATH }),
  ]);
  const liveVersionAfter = {
    id: latestAfter.data.containerVersionId ?? "",
    name: latestAfter.data.name ?? "",
    path: latestAfter.data.path ?? "",
  };
  const workspacesAfter = workspacesAfterResponse.data.workspace ?? [];
  const targetPresentAfter = workspacesAfter.some((workspace) => workspace.workspaceId === TARGET_WORKSPACE_ID);
  const defaultWorkspaceAfter = workspacesAfter.find((workspace) => workspace.name === DEFAULT_WORKSPACE_NAME) ?? null;
  const defaultStatusAfter = defaultWorkspaceAfter?.path
    ? await gtm.accounts.containers.workspaces.getStatus({ path: defaultWorkspaceAfter.path })
      .then((response) => response.data)
      .catch((error: unknown) => ({
        error: error instanceof Error ? error.message : String(error),
      } as GtmWorkspaceStatus))
    : ({ error: "default_workspace_missing_after" } as GtmWorkspaceStatus);

  const liveVersionUnchanged =
    liveVersionBefore.id === liveVersionAfter.id
    && liveVersionBefore.name === liveVersionAfter.name;
  const defaultCleanAfter = summarizeStatus(defaultStatusAfter as GtmWorkspaceStatus);
  const pass = eligible
    && liveVersionUnchanged
    && defaultCleanAfter.workspace_change_count === 0
    && defaultCleanAfter.merge_conflict_count === 0
    && (SHOULD_EXECUTE ? cleanupResult.deleted && !targetPresentAfter : !cleanupResult.deleted);

  const result = {
    generated_at_kst: kstTimestamp(),
    run_id: RUN_ID,
    mode: SHOULD_EXECUTE ? "execute_cleanup" : "dry_run_backup_only",
    container: {
      account_id: ACCOUNT_ID,
      container_id: CONTAINER_ID,
      public_id: CONTAINER_PUBLIC_ID,
      path: CONTAINER_PATH,
    },
    target_workspace: {
      workspace_id: TARGET_WORKSPACE_ID,
      expected_name: EXPECTED_WORKSPACE_NAME,
      observed_name: targetWorkspaceName,
      path: TARGET_WORKSPACE_PATH,
      cleanup_eligible: eligible,
    },
    live_version_before: liveVersionBefore,
    live_version_after: liveVersionAfter,
    live_version_unchanged: liveVersionUnchanged,
    workspace_count_before: workspacesBefore.length,
    workspace_count_after: workspacesAfter.length,
    workspaces_before: summarizeWorkspaces(workspacesBefore),
    workspaces_after: summarizeWorkspaces(workspacesAfter),
    target_workspace_present_after: targetPresentAfter,
    target_workspace_status_before: summarizeStatus(targetStatus as GtmWorkspaceStatus),
    default_workspace_status_before: summarizeStatus(defaultStatus as GtmWorkspaceStatus),
    default_workspace_status_after: defaultCleanAfter,
    cleanup_result: cleanupResult,
    backup,
    guards: {
      submit_create_version_publish_taken: false,
      existing_live_tags_modified: false,
      production_publish_taken: false,
      platform_send_taken: false,
      vm_cloud_write_taken: false,
      default_workspace_modified: false,
    },
    verdict: pass
      ? SHOULD_EXECUTE
        ? "PASS_PREVIEW_WORKSPACE_CLEANED"
        : "PASS_DRY_RUN_BACKUP_READY"
      : "HOLD_PREVIEW_WORKSPACE_CLEANUP_REVIEW_REQUIRED",
  };

  const outputPath = writeJson(
    `coffee-payment-page-seen-gtm-preview-workspace34-cleanup-${RUN_ID}.json`,
    result,
  );
  const latestOutputPath = writeJson(
    "coffee-payment-page-seen-gtm-preview-workspace34-cleanup-latest.json",
    result,
  );
  console.log(JSON.stringify({
    verdict: result.verdict,
    mode: result.mode,
    cleanup_result: result.cleanup_result,
    live_version_unchanged: result.live_version_unchanged,
    target_workspace_present_after: result.target_workspace_present_after,
    default_workspace_status_after: result.default_workspace_status_after,
    output: outputPath,
    latest_output: latestOutputPath,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
