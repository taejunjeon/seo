import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { google } from "googleapis";

dotenv.config({ path: path.resolve(process.cwd(), ".env"), quiet: true });
dotenv.config({ path: path.resolve(process.cwd(), "backend/.env"), override: false, quiet: true });

const ACCOUNT_ID = "4703003246";
const CONTAINER_ID = "13158774";
const CONTAINER_PATH = `accounts/${ACCOUNT_ID}/containers/${CONTAINER_ID}`;
const DEFAULT_WORKSPACE_NAME = "Default Workspace";
const EXPECTED_LIVE_VERSION_ID = "142";
const EXPECTED_TAG_ID = "118";
const EXPECTED_TAG_NAME = "HURDLERS - [데이터레이어] 네이버페이 구매 (제품상세)";
const BASE = "https://tagmanager.googleapis.com/tagmanager/v2";
const REPO_ROOT = path.resolve(process.cwd(), "..");
const args = new Set(process.argv.slice(2));
const SHOULD_EXECUTE = args.has("--execute");
const RUN_ID = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "Z");

type RequestOptions = {
  method?: string;
  body?: unknown;
};

type GtmRequest = <T>(url: string, options?: RequestOptions) => Promise<T>;

const credentialsJson =
  process.env.GA4_BIOCOM_SERVICE_ACCOUNT_KEY?.trim() ||
  process.env.GSC_SERVICE_ACCOUNT_KEY?.trim();

if (!credentialsJson) {
  throw new Error("GA4_BIOCOM_SERVICE_ACCOUNT_KEY or GSC_SERVICE_ACCOUNT_KEY is required");
}

const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(credentialsJson),
  scopes: [
    "https://www.googleapis.com/auth/tagmanager.readonly",
    "https://www.googleapis.com/auth/tagmanager.edit.containers",
  ],
});

async function accessToken() {
  const client = await auth.getClient();
  const access = await client.getAccessToken();
  const token = typeof access === "string" ? access : access?.token;
  if (!token) throw new Error("failed to get Google API access token");
  return token;
}

async function createRequest(): Promise<GtmRequest> {
  const token = await accessToken();
  return async <T>(url: string, options: RequestOptions = {}) => {
    const response = await fetch(url, {
      method: options.method ?? "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    const text = await response.text();
    const body = text ? JSON.parse(text) : {};
    if (!response.ok) {
      throw new Error(
        `${options.method ?? "GET"} ${url} failed ${response.status}: ${JSON.stringify(body)}`,
      );
    }
    return body as T;
  };
}

function describeEntity(entity: any) {
  const tag = entity?.tag;
  const trigger = entity?.trigger;
  const variable = entity?.variable;
  return {
    keys: entity ? Object.keys(entity) : [],
    tag: tag
      ? {
          tagId: tag.tagId,
          name: tag.name,
          type: tag.type,
          fingerprint: tag.fingerprint,
          paused: tag.paused ?? false,
          firingTriggerId: tag.firingTriggerId ?? [],
        }
      : null,
    trigger: trigger
      ? {
          triggerId: trigger.triggerId,
          name: trigger.name,
          type: trigger.type,
          fingerprint: trigger.fingerprint,
        }
      : null,
    variable: variable
      ? {
          variableId: variable.variableId,
          name: variable.name,
          type: variable.type,
          fingerprint: variable.fingerprint,
        }
      : null,
  };
}

function summarizeStatus(status: any) {
  return {
    workspaceChangeCount: (status.workspaceChange ?? []).length,
    mergeConflictCount: (status.mergeConflict ?? []).length,
    workspaceChanges: (status.workspaceChange ?? []).map((change: any) => ({
      changeStatus: change.changeStatus,
      entity: describeEntity(change),
    })),
    mergeConflicts: (status.mergeConflict ?? []).map((conflict: any) => ({
      base: describeEntity(conflict.entityInBaseVersion),
      workspace: describeEntity(conflict.entityInWorkspace),
    })),
  };
}

function validateExpectedTag(tag: any, problems: string[], label: string) {
  if (!tag) return;
  if (tag.tagId !== EXPECTED_TAG_ID) {
    problems.push(`${label} unexpected tag id ${tag.tagId}, expected ${EXPECTED_TAG_ID}`);
  }
  if (tag.name !== EXPECTED_TAG_NAME) {
    problems.push(`${label} unexpected tag name ${tag.name}, expected ${EXPECTED_TAG_NAME}`);
  }
}

function validatePreconditions(live: any, workspace: any, status: any) {
  const problems: string[] = [];
  const changes = status.workspaceChange ?? [];
  const conflicts = status.mergeConflict ?? [];
  const changeTag = changes[0]?.tag;
  const conflictBaseTag = conflicts[0]?.entityInBaseVersion?.tag;
  const conflictWorkspaceTag = conflicts[0]?.entityInWorkspace?.tag;

  if (live.containerVersionId !== EXPECTED_LIVE_VERSION_ID) {
    problems.push(`live version is ${live.containerVersionId}, expected ${EXPECTED_LIVE_VERSION_ID}`);
  }
  if (workspace.name !== DEFAULT_WORKSPACE_NAME) {
    problems.push(`workspace name is ${workspace.name}, expected ${DEFAULT_WORKSPACE_NAME}`);
  }
  if (changes.length !== 1) problems.push(`workspaceChange count is ${changes.length}, expected 1`);
  if (![0, 1].includes(conflicts.length)) {
    problems.push(`mergeConflict count is ${conflicts.length}, expected 0 or 1`);
  }
  if (!changeTag) problems.push("single workspaceChange is not a tag");
  if (conflicts.length === 1 && (!conflictBaseTag || !conflictWorkspaceTag)) {
    problems.push("single mergeConflict does not contain tag on both sides");
  }

  validateExpectedTag(changeTag, problems, "workspaceChange");
  validateExpectedTag(conflictBaseTag, problems, "entityInBaseVersion");
  validateExpectedTag(conflictWorkspaceTag, problems, "entityInWorkspace");

  return {
    ok: problems.length === 0,
    problems,
    mode: conflicts.length === 1 ? "resolve_then_revert" : "revert_only",
    changeTag,
    conflictBaseTag,
    conflictWorkspaceTag,
  };
}

async function readState(request: GtmRequest) {
  const live = await request<any>(`${BASE}/${CONTAINER_PATH}/versions:live`);
  const workspaces = await request<any>(`${BASE}/${CONTAINER_PATH}/workspaces`);
  const defaultWorkspace = (workspaces.workspace ?? []).find(
    (workspace: any) => workspace.name === DEFAULT_WORKSPACE_NAME,
  );
  if (!defaultWorkspace) throw new Error("Default Workspace not found");
  const status = await request<any>(`${BASE}/${defaultWorkspace.path}/status`);
  return { live, workspaces, defaultWorkspace, status };
}

function writeJson(relativePath: string, payload: unknown) {
  const outPath = path.resolve(REPO_ROOT, relativePath);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return outPath;
}

async function main() {
  const request = await createRequest();
  const before = await readState(request);
  const validation = validatePreconditions(before.live, before.defaultWorkspace, before.status);
  const backup = {
    generatedAt: new Date().toISOString(),
    mode: SHOULD_EXECUTE ? "execute" : "dry_run",
    container: {
      accountId: ACCOUNT_ID,
      containerId: CONTAINER_ID,
      liveVersionId: before.live.containerVersionId,
      liveVersionName: before.live.name,
      liveFingerprint: before.live.fingerprint,
    },
    defaultWorkspace: {
      workspaceId: before.defaultWorkspace.workspaceId,
      name: before.defaultWorkspace.name,
      path: before.defaultWorkspace.path,
      fingerprint: before.defaultWorkspace.fingerprint,
    },
    statusSummary: summarizeStatus(before.status),
    validation: {
      ok: validation.ok,
      problems: validation.problems,
      expectedAction: "resolve conflict by applying entityInBaseVersion tag 118 to Default Workspace",
      cleanupMode: validation.mode,
      noSubmit: true,
      noPublish: true,
      noPlatformSend: true,
    },
    raw: {
      workspaceChange: before.status.workspaceChange ?? [],
      mergeConflict: before.status.mergeConflict ?? [],
    },
  };
  const backupPath = writeJson(
    `data/gtm-default-workspace-conflict-cleanup-${RUN_ID}-backup.json`,
    backup,
  );

  if (!validation.ok) {
    const result = {
      ...backup,
      backupPath,
      executed: false,
      abortReason: "precondition_failed",
    };
    const resultPath = writeJson(
      `data/gtm-default-workspace-conflict-cleanup-${RUN_ID}.json`,
      result,
    );
    console.log(JSON.stringify({ resultPath, ...result }, null, 2));
    process.exitCode = 2;
    return;
  }

  if (!SHOULD_EXECUTE) {
    const result = {
      ...backup,
      backupPath,
      executed: false,
      dryRunOnly: true,
    };
    const resultPath = writeJson(
      `data/gtm-default-workspace-conflict-cleanup-${RUN_ID}.json`,
      result,
    );
    console.log(JSON.stringify({ resultPath, ...result }, null, 2));
    return;
  }

  const workspacePath = before.defaultWorkspace.path;
  const steps: string[] = [];
  let intermediate = before;

  if (validation.mode === "resolve_then_revert") {
    const workspaceFingerprint = validation.conflictWorkspaceTag.fingerprint;
    const resolvedEntity = {
      changeStatus: validation.changeTag.changeStatus ?? "updated",
      ...before.status.mergeConflict[0].entityInBaseVersion,
    };

    await request(
      `${BASE}/${workspacePath}:resolve_conflict?fingerprint=${encodeURIComponent(workspaceFingerprint)}`,
      {
        method: "POST",
        body: resolvedEntity,
      },
    );
    steps.push("resolve_conflict");
    intermediate = await readState(request);
  }

  const intermediateSummary = summarizeStatus(intermediate.status);
  if (
    intermediateSummary.workspaceChangeCount === 1 &&
    intermediateSummary.mergeConflictCount === 0
  ) {
    const tag = intermediate.status.workspaceChange?.[0]?.tag;
    const revertProblems: string[] = [];
    validateExpectedTag(tag, revertProblems, "postResolveWorkspaceChange");
    if (revertProblems.length > 0 || !tag?.path || !tag?.fingerprint) {
      throw new Error(`cannot safely revert resolved tag: ${revertProblems.join("; ")}`);
    }
    await request(
      `${BASE}/${tag.path}:revert?fingerprint=${encodeURIComponent(tag.fingerprint)}`,
      {
        method: "POST",
      },
    );
    steps.push("tags.revert");
  }

  const after = await readState(request);
  const afterSummary = summarizeStatus(after.status);
  const liveUnchanged =
    after.live.containerVersionId === before.live.containerVersionId &&
    after.live.fingerprint === before.live.fingerprint;

  const result = {
    ...backup,
    backupPath,
    executed: true,
    cleanupSteps: steps,
    resolveMethod:
      "workspaces.resolve_conflict(entityInBaseVersion, fingerprint=entityInWorkspace.tag.fingerprint), then tags.revert when one resolved tag change remains",
    after: {
      live: {
        containerVersionId: after.live.containerVersionId,
        name: after.live.name,
        fingerprint: after.live.fingerprint,
        unchanged: liveUnchanged,
      },
      defaultWorkspace: {
        workspaceId: after.defaultWorkspace.workspaceId,
        name: after.defaultWorkspace.name,
        path: after.defaultWorkspace.path,
        fingerprint: after.defaultWorkspace.fingerprint,
      },
      statusSummary: afterSummary,
      cleanupPassed:
        liveUnchanged &&
        afterSummary.workspaceChangeCount === 0 &&
        afterSummary.mergeConflictCount === 0,
    },
  };
  const resultPath = writeJson(
    `data/gtm-default-workspace-conflict-cleanup-${RUN_ID}.json`,
    result,
  );
  console.log(JSON.stringify({ resultPath, ...result }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
