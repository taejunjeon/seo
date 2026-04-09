import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { BetaAnalyticsDataClient } from "@google-analytics/data";
import dotenv from "dotenv";

import { auditLiveGa4Html, buildLiveGa4RiskRows } from "../src/utils/ga4ImplementationAudit";

const execFileAsync = promisify(execFile);

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const KEYWORDS = [
  "G-WJFXN5E2Q1",
  "G-8GZ48B1S59",
  "GTM-W7VXS4D8",
  "GTM-W2Z6PHN",
  "gtag(",
  "dataLayer",
  "view_item",
  "add_to_cart",
  "begin_checkout",
  "add_payment_info",
  "purchase",
  "transaction_id",
  "rebuyz_view",
  "user_id",
  "utm_source",
  "cross_domain",
  "_gl",
];

const LIVE_URLS = ["https://biocom.kr", "https://www.biocom.kr", "https://biocom.imweb.me"];

const resolveGa4ServiceAccountKey = (): string | undefined =>
  process.env.GA4_SERVICE_ACCOUNT_KEY ?? process.env.GA4_BIOCOM_SERVICE_ACCOUNT_KEY;

type RepoScanSummary = {
  label: string;
  root: string;
  output: string;
};

type PropertyAccessSummary = {
  propertyId: string;
  ok: boolean;
  message: string;
};

const resolveArg = (name: string): string | undefined => {
  const exactIdx = process.argv.indexOf(name);
  if (exactIdx >= 0) {
    const value = process.argv[exactIdx + 1];
    return value && !value.startsWith("--") ? value : undefined;
  }
  const inline = process.argv.find((arg) => arg.startsWith(`${name}=`));
  return inline ? inline.slice(name.length + 1) : undefined;
};

const resolveArgList = (name: string): string[] => {
  const values: string[] = [];

  for (let idx = 0; idx < process.argv.length; idx += 1) {
    const arg = process.argv[idx];
    if (arg === name) {
      const next = process.argv[idx + 1];
      if (next && !next.startsWith("--")) {
        values.push(...next.split(",").map((item) => item.trim()).filter(Boolean));
      }
      continue;
    }

    if (arg.startsWith(`${name}=`)) {
      values.push(...arg.slice(name.length + 1).split(",").map((item) => item.trim()).filter(Boolean));
    }
  }

  return [...new Set(values)];
};

const repoRoot = path.resolve(process.cwd(), "..");
const revenueRoot = path.resolve(repoRoot, "../revenue");

const scanRepo = async (label: string, root: string, relativePaths: string[]): Promise<RepoScanSummary> => {
  const targets = relativePaths
    .map((relativePath) => path.resolve(root, relativePath))
    .filter(Boolean);

  try {
    const { stdout } = await execFileAsync(
      "rg",
      [
        "-n",
        "--hidden",
        "-g",
        "!**/node_modules/**",
        "-g",
        "!**/.next/**",
        "-g",
        "!**/dist/**",
        "-g",
        "!**/*.bak*",
        "-e",
        KEYWORDS.map((keyword) => keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"),
        ...targets,
      ],
      {
        maxBuffer: 1024 * 1024 * 8,
        cwd: root,
      },
    );

    return { label, root, output: stdout.trim() };
  } catch (error: any) {
    if (error?.code === 1) {
      return { label, root, output: "" };
    }
    throw error;
  }
};

const fetchHtml = async (url: string): Promise<string> => {
  const response = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 (compatible; BiocomSeoAudit/1.0)",
      accept: "text/html,application/xhtml+xml",
    },
  });

  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}`);
  }

  return response.text();
};

const checkPropertyAccess = async (propertyIds: string[]): Promise<PropertyAccessSummary[]> => {
  const rawCredentials = resolveGa4ServiceAccountKey();
  if (!rawCredentials) {
    return propertyIds.map((propertyId) => ({
      propertyId,
      ok: false,
      message: "GA4 service account key is not configured",
    }));
  }

  const client = new BetaAnalyticsDataClient({
    credentials: JSON.parse(rawCredentials),
  });

  return Promise.all(
    propertyIds.map(async (propertyId) => {
      try {
        const [response] = await client.runReport({
          property: `properties/${propertyId}`,
          dateRanges: [{ startDate: "7daysAgo", endDate: "yesterday" }],
          metrics: [{ name: "sessions" }],
          dimensions: [{ name: "date" }],
          limit: 1,
        });

        const sampleDate = response.rows?.[0]?.dimensionValues?.[0]?.value ?? "(no row)";
        const sampleSessions = response.rows?.[0]?.metricValues?.[0]?.value ?? "0";

        return {
          propertyId,
          ok: true,
          message: `data api ok (${sampleDate}, sessions=${sampleSessions})`,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "unknown error";
        return {
          propertyId,
          ok: false,
          message,
        };
      }
    }),
  );
};

const toMarkdown = async () => {
  const repoScans: RepoScanSummary[] = [];
  repoScans.push(await scanRepo("seo", repoRoot, ["frontend", "backend", "GA4"]));

  try {
    await fs.access(revenueRoot);
    repoScans.push(await scanRepo("revenue", revenueRoot, ["frontend", "backend"]));
  } catch {
    // ignore missing sibling repo
  }

  const liveAudits = await Promise.all(
    LIVE_URLS.map(async (url) => {
      const html = await fetchHtml(url);
      return { url, audit: auditLiveGa4Html(html) };
    }),
  );

  const propertyIds = new Set<string>();
  if (process.env.GA4_PROPERTY_ID) propertyIds.add(process.env.GA4_PROPERTY_ID);
  if (process.env.GA4_BIOCOM_PROPERTY_ID) propertyIds.add(process.env.GA4_BIOCOM_PROPERTY_ID);
  if (process.env.GA4_COFFEE_PROPERTY_ID) propertyIds.add(process.env.GA4_COFFEE_PROPERTY_ID);
  if (process.env.GA4_AIBIOCOM_PROPERTY_ID) propertyIds.add(process.env.GA4_AIBIOCOM_PROPERTY_ID);
  for (const propertyId of resolveArgList("--property")) propertyIds.add(propertyId);
  const propertyAccess = propertyIds.size > 0 ? await checkPropertyAccess([...propertyIds]) : [];

  const lines: string[] = [];
  lines.push("# GA4 Implementation Audit");
  lines.push("");

  if (propertyAccess.length > 0) {
    lines.push("## Property Access");
    lines.push("");
    for (const item of propertyAccess) {
      lines.push(`- ${item.propertyId}: ${item.ok ? "OK" : "ERR"} — ${item.message}`);
    }
    lines.push("");
  }

  lines.push("## Live Site");
  lines.push("");

  for (const { url, audit } of liveAudits) {
    lines.push(`### ${url}`);
    lines.push(`- measurement ids: ${audit.measurementIds.join(", ") || "(none)"}`);
    lines.push(`- GTM containers: ${audit.gtmContainerIds.join(", ") || "(none)"}`);
    lines.push(`- active events: ${audit.activeEvents.join(", ") || "(none)"}`);
    lines.push(`- commented events: ${audit.commentedEvents.join(", ") || "(none)"}`);
    lines.push(
      `- flags: direct_gtag=${audit.flags.hasDirectGtag}, multi_gtm=${audit.flags.hasMultipleGtmContainers}, user_id_setter=${audit.flags.hasUserIdSetter}, utm_requires_user=${audit.flags.utmPersistenceRequiresUserId}, utm_zero_fallback=${audit.flags.utmStoresZeroStringFallback}, rebuyz_view=${audit.flags.hasRebuyzViewEvent}, view_item_active=${audit.flags.hasStandardViewItemEvent}, view_item_commented=${audit.flags.hasCommentedOutViewItem}`,
    );
    lines.push("");
  }

  lines.push("## Risk Rows");
  lines.push("");
  lines.push("| location | code type | identifier | risk | why | quick fix |");
  lines.push("| --- | --- | --- | --- | --- | --- |");
  for (const row of buildLiveGa4RiskRows(liveAudits[0]!.audit)) {
    lines.push(
      `| ${row.location} | ${row.codeType} | ${row.identifier} | ${row.risk} | ${row.why} | ${row.fixability} |`,
    );
  }
  lines.push("");

  lines.push("## Repo Scan");
  lines.push("");
  for (const scan of repoScans) {
    lines.push(`### ${scan.label}`);
    lines.push("");
    lines.push("```text");
    lines.push(scan.output || "(no matches)");
    lines.push("```");
    lines.push("");
  }

  return lines.join("\n");
};

const main = async () => {
  const outputPath = resolveArg("--output");
  const markdown = await toMarkdown();

  if (outputPath) {
    const resolved = path.resolve(process.cwd(), outputPath);
    await fs.mkdir(path.dirname(resolved), { recursive: true });
    await fs.writeFile(resolved, markdown, "utf8");
    // eslint-disable-next-line no-console
    console.log(`Wrote audit to ${resolved}`);
    return;
  }

  // eslint-disable-next-line no-console
  console.log(markdown);
};

void main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exitCode = 1;
});
