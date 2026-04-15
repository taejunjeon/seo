import fs from "node:fs/promises";
import path from "node:path";
import dotenv from "dotenv";
import { google } from "googleapis";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const SCOPES = [
  "https://www.googleapis.com/auth/tagmanager.readonly",
  "https://www.googleapis.com/auth/tagmanager.edit.containers",
];

const resolveCredentials = () => {
  const raw =
    process.env.GSC_SERVICE_ACCOUNT_KEY ?? process.env.GA4_BIOCOM_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error("Service account key env var missing");
  return JSON.parse(raw);
};

const createTagManager = () => {
  const auth = new google.auth.GoogleAuth({
    credentials: resolveCredentials(),
    scopes: SCOPES,
  });
  return google.tagmanager({ version: "v2", auth });
};

type AccountSummary = {
  accountId: string;
  name: string;
  path: string;
};

type ContainerSummary = {
  accountId: string;
  containerId: string;
  publicId: string;
  name: string;
  path: string;
  usageContext: string[] | undefined;
};

type WorkspaceSummary = {
  workspaceId: string;
  name: string;
  path: string;
};

const listAccounts = async (gtm: ReturnType<typeof createTagManager>) => {
  const res = await gtm.accounts.list({});
  const accounts = res.data.account ?? [];
  return accounts.map<AccountSummary>((a) => ({
    accountId: a.accountId ?? "",
    name: a.name ?? "",
    path: a.path ?? "",
  }));
};

const listContainers = async (
  gtm: ReturnType<typeof createTagManager>,
  accountPath: string,
) => {
  const res = await gtm.accounts.containers.list({ parent: accountPath });
  const containers = res.data.container ?? [];
  return containers.map<ContainerSummary>((c) => ({
    accountId: c.accountId ?? "",
    containerId: c.containerId ?? "",
    publicId: c.publicId ?? "",
    name: c.name ?? "",
    path: c.path ?? "",
    usageContext: c.usageContext ?? undefined,
  }));
};

const listWorkspaces = async (
  gtm: ReturnType<typeof createTagManager>,
  containerPath: string,
) => {
  const res = await gtm.accounts.containers.workspaces.list({ parent: containerPath });
  const workspaces = res.data.workspace ?? [];
  return workspaces.map<WorkspaceSummary>((w) => ({
    workspaceId: w.workspaceId ?? "",
    name: w.name ?? "",
    path: w.path ?? "",
  }));
};

const dumpWorkspace = async (
  gtm: ReturnType<typeof createTagManager>,
  workspacePath: string,
) => {
  const [tags, triggers, variables, templates, folders, builtins] = await Promise.all([
    gtm.accounts.containers.workspaces.tags.list({ parent: workspacePath }),
    gtm.accounts.containers.workspaces.triggers.list({ parent: workspacePath }),
    gtm.accounts.containers.workspaces.variables.list({ parent: workspacePath }),
    gtm.accounts.containers.workspaces.templates.list({ parent: workspacePath }).catch(() => ({ data: {} })),
    gtm.accounts.containers.workspaces.folders.list({ parent: workspacePath }).catch(() => ({ data: {} })),
    gtm.accounts.containers.workspaces.built_in_variables.list({ parent: workspacePath }).catch(() => ({ data: {} })),
  ]);
  return {
    tags: tags.data.tag ?? [],
    triggers: triggers.data.trigger ?? [],
    variables: variables.data.variable ?? [],
    templates: (templates.data as any).template ?? [],
    folders: (folders.data as any).folder ?? [],
    builtInVariables: (builtins.data as any).builtInVariable ?? [],
  };
};

const getPublishedVersion = async (
  gtm: ReturnType<typeof createTagManager>,
  containerPath: string,
) => {
  try {
    const res = await gtm.accounts.containers.version_headers.latest({ parent: containerPath });
    return res.data;
  } catch (err) {
    return { error: (err as Error).message };
  }
};

const main = async () => {
  const gtm = createTagManager();
  const outDir = path.resolve(process.cwd(), "..", "gtmaudit");
  await fs.mkdir(outDir, { recursive: true });

  console.log("[gtm-audit] listing accounts…");
  const accounts = await listAccounts(gtm);
  console.log("[gtm-audit] accounts:", accounts);

  const report: any = {
    generatedAt: new Date().toISOString(),
    accounts,
    containers: [],
  };

  for (const account of accounts) {
    const containers = await listContainers(gtm, account.path);
    for (const container of containers) {
      console.log(
        `[gtm-audit] ${account.name} / ${container.publicId} (${container.name})`,
      );
      const workspaces = await listWorkspaces(gtm, container.path);
      const defaultWs = workspaces.find((w) => w.name === "Default Workspace") ?? workspaces[0];
      const dump = defaultWs ? await dumpWorkspace(gtm, defaultWs.path) : null;
      const versionHeader = await getPublishedVersion(gtm, container.path);
      report.containers.push({
        account: account.name,
        container,
        workspaces,
        defaultWorkspace: defaultWs,
        dump,
        latestPublishedVersion: versionHeader,
      });
    }
  }

  const outPath = path.join(outDir, `gtm-audit-${new Date().toISOString().slice(0, 10)}.json`);
  await fs.writeFile(outPath, JSON.stringify(report, null, 2), "utf-8");
  console.log(`[gtm-audit] wrote ${outPath}`);

  for (const entry of report.containers) {
    const dump = entry.dump;
    if (!dump) continue;
    console.log(
      `\n=== ${entry.container.publicId} (${entry.container.name}) ===`,
    );
    console.log(
      `tags=${dump.tags.length} triggers=${dump.triggers.length} variables=${dump.variables.length} templates=${dump.templates.length}`,
    );
    for (const tag of dump.tags) {
      const paused = tag.paused ? "[PAUSED]" : "       ";
      console.log(`  ${paused} ${tag.tagId}  ${tag.type}  ${tag.name}`);
    }
  }
};

main().catch((err) => {
  console.error("[gtm-audit] failed:", err);
  process.exit(1);
});
