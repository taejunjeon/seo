import fs from "node:fs/promises";
import path from "node:path";
import dotenv from "dotenv";
import { JWT } from "google-auth-library";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const ACCOUNT_ID = "4703003246";
const CONTAINER_ID = "13158774";
const BASE = "https://tagmanager.googleapis.com/tagmanager/v2";
const CONTAINER_PATH = `accounts/${ACCOUNT_ID}/containers/${CONTAINER_ID}`;
const TARGET_TAG_IDS = ["143", "48", "43"];
const VERSION_NAME = `ga4_purchase_duplicate_fix_${new Date()
  .toISOString()
  .slice(0, 10)
  .replaceAll("-", "")}`;
const VERSION_NOTES =
  "[Codex] GA4 purchase 중복 정리: [48] 홈페이지 purchase 태그 pause, [43] NPay click purchase를 add_payment_info로 강등, [143] HURDLERS purchase에 pay_method=homepage 보강.";

const args = new Set(process.argv.slice(2));
const shouldApply = args.has("--apply");
const shouldPublish = args.has("--publish");

const requiredScopes = [
  "https://www.googleapis.com/auth/tagmanager.readonly",
  "https://www.googleapis.com/auth/tagmanager.edit.containers",
  "https://www.googleapis.com/auth/tagmanager.edit.containerversions",
  "https://www.googleapis.com/auth/tagmanager.publish",
];

function requireServiceAccount() {
  const raw =
    process.env.GA4_BIOCOM_SERVICE_ACCOUNT_KEY ?? process.env.GSC_SERVICE_ACCOUNT_KEY;
  if (!raw) {
    throw new Error(
      "GA4_BIOCOM_SERVICE_ACCOUNT_KEY or GSC_SERVICE_ACCOUNT_KEY is required",
    );
  }
  return JSON.parse(raw);
}

async function getAccessToken() {
  const sa = requireServiceAccount();
  const client = new JWT({
    email: sa.client_email,
    key: sa.private_key,
    scopes: requiredScopes,
  });
  const { token } = await client.getAccessToken();
  if (!token) throw new Error("Failed to acquire GTM access token");
  return token;
}

function buildHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

async function request(token, resourcePath, options = {}) {
  const response = await fetch(`${BASE}/${resourcePath}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers ?? {}),
    },
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) {
    const message =
      data?.error?.message ?? `${response.status} ${response.statusText}`;
    throw new Error(`${options.method ?? "GET"} ${resourcePath} failed: ${message}`);
  }
  return data;
}

function getParam(tag, key) {
  return (tag.parameter ?? []).find((param) => param.key === key);
}

function getParamValue(tag, key) {
  return getParam(tag, key)?.value;
}

function ensureParam(tag, key, value, type = "template") {
  tag.parameter ??= [];
  const existing = getParam(tag, key);
  if (existing) {
    const before = existing.value;
    existing.type = type;
    existing.value = value;
    return before !== value;
  }
  tag.parameter.push({ type, key, value });
  return true;
}

function findEventSettingRow(tag, parameterName) {
  const eventSettings = getParam(tag, "eventSettingsTable");
  return (eventSettings?.list ?? []).find((row) =>
    row.map?.some(
      (entry) => entry.key === "parameter" && entry.value === parameterName,
    ),
  );
}

function getEventSetting(tag, parameterName) {
  const row = findEventSettingRow(tag, parameterName);
  return row?.map?.find((entry) => entry.key === "parameterValue")?.value;
}

function setEventSetting(tag, parameterName, parameterValue) {
  tag.parameter ??= [];
  let eventSettings = getParam(tag, "eventSettingsTable");
  if (!eventSettings) {
    eventSettings = { type: "list", key: "eventSettingsTable", list: [] };
    tag.parameter.push(eventSettings);
  }
  eventSettings.list ??= [];

  const row = findEventSettingRow(tag, parameterName);
  if (row) {
    const valueEntry = row.map.find((entry) => entry.key === "parameterValue");
    if (valueEntry) {
      const before = valueEntry.value;
      valueEntry.value = parameterValue;
      return before !== parameterValue;
    }
    row.map.push({
      type: "template",
      key: "parameterValue",
      value: parameterValue,
    });
    return true;
  }

  eventSettings.list.push({
    type: "map",
    map: [
      { type: "template", key: "parameter", value: parameterName },
      { type: "template", key: "parameterValue", value: parameterValue },
    ],
  });
  return true;
}

function summarizeTag(tag) {
  if (!tag) return null;
  return {
    tagId: tag.tagId,
    name: tag.name,
    type: tag.type,
    paused: Boolean(tag.paused),
    firingTriggerId: tag.firingTriggerId ?? [],
    blockingTriggerId: tag.blockingTriggerId ?? [],
    eventName: getParamValue(tag, "eventName"),
    transaction_id: getEventSetting(tag, "transaction_id"),
    pay_method: getEventSetting(tag, "pay_method"),
    value: getEventSetting(tag, "value"),
    currency: getEventSetting(tag, "currency"),
  };
}

function requireTargetTags(tagsById) {
  const missing = TARGET_TAG_IDS.filter((id) => !tagsById.get(id));
  if (missing.length) {
    throw new Error(`Required target tags were not found: ${missing.join(", ")}`);
  }
  return new Map(TARGET_TAG_IDS.map((id) => [id, tagsById.get(id)]));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function planChanges(tagsById) {
  const plannedTags = new Map();
  const changes = [];

  requireTargetTags(tagsById);
  const tag143 = clone(tagsById.get("143"));
  const tag48 = clone(tagsById.get("48"));
  const tag43 = clone(tagsById.get("43"));

  const tag143Changed = setEventSetting(tag143, "pay_method", "homepage");
  if (tag143Changed) {
    changes.push("[143] set event parameter pay_method=homepage");
  } else {
    changes.push("[143] pay_method=homepage already present");
  }
  plannedTags.set("143", tag143);

  const tag48WasPaused = Boolean(tag48.paused);
  tag48.paused = true;
  changes.push(
    tag48WasPaused ? "[48] already paused" : "[48] pause homepage purchase tag",
  );
  plannedTags.set("48", tag48);

  const before43EventName = getParamValue(tag43, "eventName");
  const tag43Changed = ensureParam(tag43, "eventName", "add_payment_info");
  changes.push(
    tag43Changed
      ? `[43] change eventName ${before43EventName ?? "(missing)"} -> add_payment_info`
      : "[43] eventName already add_payment_info",
  );
  plannedTags.set("43", tag43);

  return { plannedTags, changes };
}

async function listWorkspaces(token) {
  const data = await request(token, `${CONTAINER_PATH}/workspaces`);
  return data.workspace ?? [];
}

async function fetchWorkspaceTags(token, workspacePath) {
  const data = await request(token, `${workspacePath}/tags`);
  return data.tag ?? [];
}

async function fetchLiveVersion(token) {
  return request(token, `${CONTAINER_PATH}/versions:live`);
}

async function createWorkspace(token) {
  const suffix = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  return request(token, `${CONTAINER_PATH}/workspaces`, {
    method: "POST",
    headers: buildHeaders(token),
    body: JSON.stringify({
      name: `codex_ga4_purchase_duplicate_fix_${suffix}`,
      description: VERSION_NOTES,
    }),
  });
}

async function updateTag(token, tag) {
  return request(token, `${tag.path}`, {
    method: "PUT",
    headers: {
      ...buildHeaders(token),
      "If-Match-Fingerprint": tag.fingerprint,
    },
    body: JSON.stringify(tag),
  });
}

async function writeJson(fileName, payload) {
  const outDir = path.resolve(process.cwd(), "..", "gtmaudit");
  await fs.mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, fileName);
  await fs.writeFile(outPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return outPath;
}

function printSummary(title, summaries) {
  console.log(`\n=== ${title} ===`);
  for (const summary of summaries) {
    console.log(
      `[${summary.tagId}] ${summary.name} paused=${summary.paused} eventName=${
        summary.eventName ?? "(none)"
      } tx=${summary.transaction_id ?? "(none)"} pay_method=${
        summary.pay_method ?? "(none)"
      } triggers=${summary.firingTriggerId.join(",") || "(none)"}`,
    );
  }
}

async function main() {
  const token = await getAccessToken();
  const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);

  const liveVersion = await fetchLiveVersion(token);
  const workspaces = await listWorkspaces(token);
  const defaultWorkspace =
    workspaces.find((workspace) => workspace.name === "Default Workspace") ??
    workspaces[0];
  if (!defaultWorkspace) throw new Error("No GTM workspace found");

  const defaultTags = await fetchWorkspaceTags(token, defaultWorkspace.path);
  const defaultTagsById = new Map(defaultTags.map((tag) => [tag.tagId, tag]));
  const targetDefaultTagsById = requireTargetTags(defaultTagsById);
  const targetDefaultTags = [...targetDefaultTagsById.values()];

  const backupPath = await writeJson(
    `gtm-ga4-purchase-duplicates-backup-${timestamp}.json`,
    {
      generatedAt: new Date().toISOString(),
      accountId: ACCOUNT_ID,
      containerId: CONTAINER_ID,
      liveVersion,
      workspaces,
      defaultWorkspace,
      targetDefaultTags,
    },
  );

  printSummary("Current target tags from default workspace", targetDefaultTags.map(summarizeTag));
  console.log(`\nbackup: ${backupPath}`);

  const { plannedTags, changes } = planChanges(defaultTagsById);
  const plannedSummaries = TARGET_TAG_IDS.map((id) => summarizeTag(plannedTags.get(id)));
  printSummary("Planned target tags", plannedSummaries);
  console.log("\nplanned changes:");
  for (const change of changes) console.log(`- ${change}`);

  if (!shouldApply) {
    console.log("\ndry-run only. Re-run with --apply --publish to update and publish.");
    return;
  }

  const workspace = await createWorkspace(token);
  console.log(`\ncreated workspace: ${workspace.path} (${workspace.name})`);

  const workspaceTags = await fetchWorkspaceTags(token, workspace.path);
  const workspaceTagsById = new Map(workspaceTags.map((tag) => [tag.tagId, tag]));
  const { plannedTags: workspacePlannedTags } = planChanges(workspaceTagsById);

  const updatedTags = [];
  for (const id of TARGET_TAG_IDS) {
    const updated = await updateTag(token, workspacePlannedTags.get(id));
    updatedTags.push(updated);
    const summary = summarizeTag(updated);
    console.log(
      `updated [${id}] ${summary.name}: paused=${summary.paused} eventName=${
        summary.eventName ?? "(none)"
      } pay_method=${summary.pay_method ?? "(none)"}`,
    );
  }

  const createVersionResponse = await request(token, `${workspace.path}:create_version`, {
    method: "POST",
    headers: buildHeaders(token),
    body: JSON.stringify({
      name: VERSION_NAME,
      notes: VERSION_NOTES,
    }),
  });

  if (createVersionResponse.compilerError) {
    throw new Error("GTM create_version returned compilerError=true; publish aborted");
  }

  const createdVersion = createVersionResponse.containerVersion;
  console.log(
    `created version: ${createdVersion.containerVersionId} (${createdVersion.name})`,
  );

  let publishResponse = null;
  let liveAfterPublish = null;
  if (shouldPublish) {
    publishResponse = await request(token, `${createdVersion.path}:publish`, {
      method: "POST",
      headers: buildHeaders(token),
    });
    if (publishResponse.compilerError) {
      throw new Error("GTM publish returned compilerError=true");
    }
    liveAfterPublish = await fetchLiveVersion(token);
    console.log(
      `published live version: ${liveAfterPublish.containerVersionId} (${liveAfterPublish.name})`,
    );
  } else {
    console.log("version created but not published. Use --publish to publish.");
  }

  const resultPath = await writeJson(
    `gtm-ga4-purchase-duplicates-result-${timestamp}.json`,
    {
      generatedAt: new Date().toISOString(),
      accountId: ACCOUNT_ID,
      containerId: CONTAINER_ID,
      workspace,
      updatedTags,
      createdVersion,
      publishResponse,
      liveAfterPublish,
    },
  );
  console.log(`result: ${resultPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
