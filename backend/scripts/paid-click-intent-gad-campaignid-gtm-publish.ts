import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { google } from "googleapis";

const repoRoot = path.resolve(process.cwd(), process.cwd().endsWith("/backend") ? ".." : ".");
const backendDir = path.join(repoRoot, "backend");

dotenv.config({ path: path.join(repoRoot, ".env"), quiet: true });
dotenv.config({ path: path.join(backendDir, ".env"), override: false, quiet: true });

const ACCOUNT_ID = "4703003246";
const CONTAINER_ID = "13158774";
const CONTAINER_PUBLIC_ID = "GTM-W2Z6PHN";
const CONTAINER_PATH = `accounts/${ACCOUNT_ID}/containers/${CONTAINER_ID}`;
const BASE = "https://tagmanager.googleapis.com/tagmanager/v2";
const WORKSPACE_ID = "168";
const TAG_ID = "279";
const EXPECTED_TAG_NAME = "codex_paid_click_intent_v1_receiver_no_send";
const EXPECTED_VERSION = "paid_click_intent_v2_gad_campaignid_20260521";
const RUN_ID = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "Z");
const VERSION_NAME = "paid_click_intent_v2_gad_campaignid_20260521";
const VERSION_NOTES = [
  "TJ approved GTM Production publish.",
  "Scope: existing tag_id=279 only.",
  "Purpose: preserve gad_campaignid/gad_source/utm_id in paid-click-intent no-send evidence.",
  "No Google Ads/GA4/Meta/TikTok/Naver conversion send added.",
  "Trigger id 278 unchanged. Storage keys unchanged.",
  "Preview PASS: data/gtm-paid-click-intent-tag279-preview-smoke-20260521T032711Z.json.",
  "Rollback: restore previous live version or tag 279 HTML backup data/gtm-paid-click-intent-tag279-backup-20260521T031433Z.html.",
].join("\n");

type RequestOptions = {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
};

const credentialsJson =
  process.env.GA4_BIOCOM_SERVICE_ACCOUNT_KEY?.trim()
  || process.env.GSC_SERVICE_ACCOUNT_KEY?.trim();

if (!credentialsJson) {
  throw new Error("GA4_BIOCOM_SERVICE_ACCOUNT_KEY or GSC_SERVICE_ACCOUNT_KEY is required");
}

const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(credentialsJson),
  scopes: [
    "https://www.googleapis.com/auth/tagmanager.readonly",
    "https://www.googleapis.com/auth/tagmanager.edit.containers",
    "https://www.googleapis.com/auth/tagmanager.edit.containerversions",
    "https://www.googleapis.com/auth/tagmanager.publish",
  ],
});

async function accessToken() {
  const client = await auth.getClient();
  const access = await client.getAccessToken();
  const token = typeof access === "string" ? access : access?.token;
  if (!token) throw new Error("failed to get Google API access token");
  return token;
}

async function gtmRequest<T>(token: string, url: string, options: RequestOptions = {}): Promise<T> {
  const response = await fetch(url, {
    method: options.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(`${options.method ?? "GET"} ${url} failed ${response.status}: ${JSON.stringify(body)}`);
  }
  return body as T;
}

function getHtmlParam(tag: any): string {
  const htmlParam = (tag.parameter ?? []).find((param: any) => param.key === "html");
  if (!htmlParam?.value || typeof htmlParam.value !== "string") {
    throw new Error(`tag ${tag.tagId ?? TAG_ID} html parameter missing`);
  }
  return htmlParam.value;
}

function summarizeEntity(entity: any) {
  const tag = entity?.tag;
  const trigger = entity?.trigger;
  const variable = entity?.variable;
  return {
    tag: tag ? {
      tagId: tag.tagId,
      name: tag.name,
      type: tag.type,
      firingTriggerId: tag.firingTriggerId ?? [],
      blockingTriggerId: tag.blockingTriggerId ?? [],
    } : null,
    trigger: trigger ? {
      triggerId: trigger.triggerId,
      name: trigger.name,
      type: trigger.type,
    } : null,
    variable: variable ? {
      variableId: variable.variableId,
      name: variable.name,
      type: variable.type,
    } : null,
  };
}

async function readWorkspaceStatus(token: string, workspaceId: string) {
  const workspacePath = `${CONTAINER_PATH}/workspaces/${workspaceId}`;
  const workspace = await gtmRequest<any>(token, `${BASE}/${workspacePath}`);
  const status = await gtmRequest<any>(token, `${BASE}/${workspacePath}/status`);
  return {
    workspace,
    status,
    summary: {
      workspaceId: workspace.workspaceId,
      name: workspace.name,
      path: workspace.path,
      workspaceChangeCount: (status.workspaceChange ?? []).length,
      mergeConflictCount: (status.mergeConflict ?? []).length,
      changes: (status.workspaceChange ?? []).map((change: any) => ({
        changeStatus: change.changeStatus,
        entity: summarizeEntity(change),
      })),
      conflicts: (status.mergeConflict ?? []).map((conflict: any) => ({
        base: summarizeEntity(conflict.entityInBaseVersion),
        workspace: summarizeEntity(conflict.entityInWorkspace),
      })),
    },
  };
}

function validatePrePublish(status: any, tag: any) {
  const problems: string[] = [];
  const changes = status.workspaceChange ?? [];
  const conflicts = status.mergeConflict ?? [];
  if (changes.length !== 1) problems.push(`workspaceChange count ${changes.length}, expected 1`);
  if (conflicts.length !== 0) problems.push(`mergeConflict count ${conflicts.length}, expected 0`);
  const changeTag = changes[0]?.tag;
  if (!changeTag) problems.push("single workspaceChange is not tag update");
  if (changeTag && String(changeTag.tagId) !== TAG_ID) {
    problems.push(`changed tag ${changeTag.tagId}, expected ${TAG_ID}`);
  }
  if (changeTag && changeTag.name !== EXPECTED_TAG_NAME) {
    problems.push(`changed tag name ${changeTag.name}, expected ${EXPECTED_TAG_NAME}`);
  }
  const html = getHtmlParam(tag);
  if (!html.includes(EXPECTED_VERSION)) problems.push(`tag html missing ${EXPECTED_VERSION}`);
  if (!html.includes("gad_campaignid")) problems.push("tag html missing gad_campaignid");
  if (!html.includes("gad_source")) problems.push("tag html missing gad_source");
  if (!html.includes("utm_id")) problems.push("tag html missing utm_id");
  return { ok: problems.length === 0, problems };
}

function writeJson(relativePath: string, payload: unknown) {
  const outPath = path.join(repoRoot, relativePath);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return outPath;
}

async function main() {
  const token = await accessToken();
  const liveBefore = await gtmRequest<any>(token, `${BASE}/${CONTAINER_PATH}/versions:live`);
  const workspacePath = `${CONTAINER_PATH}/workspaces/${WORKSPACE_ID}`;
  const before = await readWorkspaceStatus(token, WORKSPACE_ID);
  const tag = await gtmRequest<any>(token, `${BASE}/${workspacePath}/tags/${TAG_ID}`);
  const prePublish = validatePrePublish(before.status, tag);

  const backupPath = writeJson(`data/gtm-paid-click-intent-tag279-prepublish-backup-${RUN_ID}.json`, {
    generatedAt: new Date().toISOString(),
    container: {
      accountId: ACCOUNT_ID,
      containerId: CONTAINER_ID,
      publicId: CONTAINER_PUBLIC_ID,
      liveVersionId: liveBefore.containerVersionId,
      liveVersionName: liveBefore.name,
    },
    workspace: before.summary,
    tag,
    prePublish,
  });

  if (!prePublish.ok) {
    throw new Error(`pre-publish validation failed: ${prePublish.problems.join("; ")}`);
  }

  const versionResponse = await gtmRequest<any>(token, `${BASE}/${workspacePath}:create_version`, {
    method: "POST",
    body: {
      name: VERSION_NAME,
      notes: VERSION_NOTES,
    },
  });
  if (versionResponse.compilerError) {
    throw new Error("create_version returned compilerError=true");
  }
  const createdVersion = versionResponse.containerVersion;
  if (!createdVersion?.path || !createdVersion.containerVersionId) {
    throw new Error("created version path/containerVersionId missing");
  }

  const published = await gtmRequest<any>(token, `${BASE}/${createdVersion.path}:publish`, {
    method: "POST",
  });
  if (published.compilerError) {
    throw new Error("publish returned compilerError=true");
  }

  const liveAfter = await gtmRequest<any>(token, `${BASE}/${CONTAINER_PATH}/versions:live`);
  const result = {
    generatedAt: new Date().toISOString(),
    mode: "gtm_production_publish",
    approvedBy: "TJ",
    backupPath,
    container: {
      accountId: ACCOUNT_ID,
      containerId: CONTAINER_ID,
      publicId: CONTAINER_PUBLIC_ID,
    },
    liveBefore: {
      containerVersionId: liveBefore.containerVersionId,
      name: liveBefore.name,
    },
    workspaceBefore: before.summary,
    createdVersion: {
      containerVersionId: createdVersion.containerVersionId,
      name: createdVersion.name,
      path: createdVersion.path,
      compilerError: versionResponse.compilerError ?? false,
    },
    publish: {
      compilerError: published.compilerError ?? false,
    },
    liveAfter: {
      containerVersionId: liveAfter.containerVersionId,
      name: liveAfter.name,
      matchesCreatedVersion: liveAfter.containerVersionId === createdVersion.containerVersionId,
    },
    invariants: {
      onlyExpectedWorkspaceChangePublished: true,
      tagId279Only: true,
      triggerId278Unchanged: true,
      noGoogleAdsConversionTagCreated: true,
      noPlatformConversionUpload: true,
      noBackendDeploy: true,
    },
  };
  const outputPath = writeJson(`data/gtm-paid-click-intent-tag279-production-publish-${RUN_ID}.json`, result);
  console.log(JSON.stringify({ outputPath, ...result }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
