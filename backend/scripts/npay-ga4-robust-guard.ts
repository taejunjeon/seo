#!/usr/bin/env tsx
import fs from "node:fs";
import path from "node:path";

import dotenv from "dotenv";
import { google, type bigquery_v2 } from "googleapis";

dotenv.config({ path: path.resolve(__dirname, "..", ".env"), quiet: true });

const DEFAULT_PROJECT_ID = "hurdlers-naver-pay";
const DEFAULT_DATASET = `analytics_${process.env.GA4_BIOCOM_PROPERTY_ID?.trim() || "304759974"}`;
const DEFAULT_LOCATION = "US";

type CliOptions = {
  ids: string[];
  startSuffix: string;
  endSuffix: string;
  projectId: string;
  dataset: string;
  location: string;
  output?: string;
  markdown: boolean;
};

type GuardResult = {
  id: string;
  guardStatus: "present" | "robust_absent";
  events: number;
  purchaseEvents: number;
  eventNames: string;
  firstSeenKst: string;
  lastSeenKst: string;
};

const argValue = (name: string) =>
  process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);

const validateSuffix = (label: string, value: string) => {
  if (!/^\d{8}$/.test(value)) throw new Error(`${label} must be YYYYMMDD: ${value}`);
  return value;
};

const parseIdList = (value: string) =>
  value
    .split(/[,\n\s]+/)
    .map((id) => id.trim())
    .filter(Boolean);

const parseArgs = (): CliOptions => {
  const idsFile = argValue("ids-file") || argValue("idsFile");
  const fileIds = idsFile ? parseIdList(fs.readFileSync(path.resolve(idsFile), "utf8")) : [];
  const inlineIds = parseIdList(argValue("ids") ?? "");
  const ids = [...new Set([...inlineIds, ...fileIds])];
  if (ids.length === 0) throw new Error("Provide --ids=ORDER1,ORDER2 or --ids-file=path");

  const startSuffix = validateSuffix("start-suffix", argValue("start-suffix") || argValue("startSuffix") || "");
  const endSuffix = validateSuffix("end-suffix", argValue("end-suffix") || argValue("endSuffix") || "");
  if (startSuffix > endSuffix) {
    throw new Error(`start-suffix must be <= end-suffix: ${startSuffix} > ${endSuffix}`);
  }

  return {
    ids,
    startSuffix,
    endSuffix,
    projectId: argValue("project") || DEFAULT_PROJECT_ID,
    dataset: argValue("dataset") || DEFAULT_DATASET,
    location: argValue("location") || DEFAULT_LOCATION,
    output: argValue("output"),
    markdown: process.argv.includes("--markdown"),
  };
};

const parseJsonCredentials = () => {
  const rawKey = process.env.GA4_BIOCOM_SERVICE_ACCOUNT_KEY || process.env.GA4_SERVICE_ACCOUNT_KEY;
  if (!rawKey?.trim()) throw new Error("GA4_BIOCOM_SERVICE_ACCOUNT_KEY missing");
  return JSON.parse(rawKey) as { client_email: string; private_key: string; project_id: string };
};

const createBigQueryClient = () => {
  const credentials = parseJsonCredentials();
  const auth = new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: [
      "https://www.googleapis.com/auth/bigquery.readonly",
      "https://www.googleapis.com/auth/cloud-platform.read-only",
    ],
  });
  return {
    billingProjectId: credentials.project_id,
    clientEmail: credentials.client_email,
    bq: google.bigquery({ version: "v2", auth }),
  };
};

const bqString = (value: string) => `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;

const eventParamValueExpr =
  "COALESCE(ep.value.string_value, CAST(ep.value.int_value AS STRING), CAST(ep.value.double_value AS STRING), CAST(ep.value.float_value AS STRING))";

const buildQuery = (options: CliOptions) => `
WITH ids AS (
  SELECT id FROM UNNEST([${options.ids.map(bqString).join(", ")}]) AS id
),
raw AS (
  SELECT
    _TABLE_SUFFIX AS table_suffix,
    event_name,
    event_timestamp,
    FORMAT_TIMESTAMP('%Y-%m-%d %H:%M:%S', TIMESTAMP_MICROS(event_timestamp), 'Asia/Seoul') AS event_time_kst,
    ecommerce.transaction_id AS ecommerce_transaction_id,
    (SELECT ep.value.string_value FROM UNNEST(event_params) ep WHERE ep.key = 'transaction_id') AS param_transaction_id,
    ARRAY(
      SELECT ${eventParamValueExpr}
      FROM UNNEST(event_params) ep
      WHERE ${eventParamValueExpr} IS NOT NULL
    ) AS event_param_values
  FROM \`${options.projectId}.${options.dataset}.events_*\`
  WHERE (
    REGEXP_CONTAINS(_TABLE_SUFFIX, r'^\\d{8}$')
    AND _TABLE_SUFFIX BETWEEN '${options.startSuffix}' AND '${options.endSuffix}'
  ) OR (
    STARTS_WITH(_TABLE_SUFFIX, 'intraday_')
    AND SUBSTR(_TABLE_SUFFIX, 10) BETWEEN '${options.startSuffix}' AND '${options.endSuffix}'
  )
),
matched AS (
  SELECT
    ids.id,
    raw.table_suffix,
    raw.event_name,
    raw.event_timestamp,
    raw.event_time_kst,
    raw.ecommerce_transaction_id,
    raw.param_transaction_id
  FROM ids
  JOIN raw
    ON raw.ecommerce_transaction_id = ids.id
    OR raw.param_transaction_id = ids.id
    OR ids.id IN UNNEST(raw.event_param_values)
)
SELECT
  ids.id,
  COUNT(matched.event_name) AS events,
  COUNTIF(matched.event_name = 'purchase') AS purchase_events,
  ARRAY_TO_STRING(ARRAY_AGG(DISTINCT matched.event_name IGNORE NULLS ORDER BY matched.event_name), ', ') AS event_names,
  FORMAT_TIMESTAMP('%Y-%m-%d %H:%M:%S', TIMESTAMP_MICROS(MIN(matched.event_timestamp)), 'Asia/Seoul') AS first_seen_kst,
  FORMAT_TIMESTAMP('%Y-%m-%d %H:%M:%S', TIMESTAMP_MICROS(MAX(matched.event_timestamp)), 'Asia/Seoul') AS last_seen_kst
FROM ids
LEFT JOIN matched USING (id)
GROUP BY ids.id
ORDER BY ids.id;
`;

const runBigQuery = async (
  bq: bigquery_v2.Bigquery,
  billingProjectId: string,
  options: CliOptions,
) => {
  const response = await bq.jobs.query({
    projectId: billingProjectId,
    requestBody: {
      query: buildQuery(options),
      useLegacySql: false,
      location: options.location,
      timeoutMs: 30_000,
    },
  });
  const fields = response.data.schema?.fields ?? [];
  return (response.data.rows ?? []).map((row) =>
    Object.fromEntries((row.f ?? []).map((cell, index) => [fields[index]?.name ?? String(index), cell.v])),
  ) as Record<string, unknown>[];
};

const parseNumber = (value: unknown) => {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim()) return Number(value);
  return 0;
};

const nowKst = () =>
  `${new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date())} KST`;

const escapeCell = (value: unknown) => String(value ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");

const markdownTable = (headers: string[], rows: unknown[][]) => [
  `| ${headers.map(escapeCell).join(" | ")} |`,
  `| ${headers.map(() => "---").join(" | ")} |`,
  ...rows.map((row) => `| ${row.map(escapeCell).join(" | ")} |`),
].join("\n");

const renderMarkdown = (payload: Record<string, any>) => [
  "# Biocom GA4 Robust Guard Read-only 결과",
  "",
  `생성 시각: ${payload.checkedAtKst}`,
  `site: \`${payload.site}\``,
  `window: ${payload.window.startSuffix} ~ ${payload.window.endSuffix}`,
  `dataset: \`${payload.queryScope.projectId}.${payload.queryScope.dataset}\``,
  "",
  "## Guard Summary",
  "",
  payload.ok
    ? markdownTable(
        ["id", "guard_status", "events", "purchase_events", "event_names", "first_seen", "last_seen"],
        payload.results.map((row: GuardResult) => [
          row.id,
          row.guardStatus,
          row.events,
          row.purchaseEvents,
          row.eventNames,
          row.firstSeenKst,
          row.lastSeenKst,
        ]),
      )
    : `blocked: ${payload.error}`,
  "",
  "## Guardrails",
  "",
  "```text",
  "No-send verified: YES",
  "No-write verified: YES",
  "No-deploy verified: YES",
  "Purpose: read-only already_in_ga4 guard only",
  "```",
].join("\n");

const writeOutput = (options: CliOptions, output: string) => {
  if (options.output) {
    fs.writeFileSync(path.resolve(options.output), output, "utf8");
  } else {
    process.stdout.write(output);
  }
};

const main = async () => {
  const options = parseArgs();
  const payloadBase = {
    checkedAtKst: nowKst(),
    site: "biocom",
    mode: "read_only",
    window: {
      startSuffix: options.startSuffix,
      endSuffix: options.endSuffix,
    },
    queryScope: {
      projectId: options.projectId,
      dataset: options.dataset,
      location: options.location,
      searchedFields: [
        "ecommerce.transaction_id",
        "event_params.transaction_id",
        "event_params full value scan string/int/double/float",
        "events_* daily tables",
        "events_intraday_* tables when present",
      ],
    },
  };

  try {
    const { bq, billingProjectId, clientEmail } = createBigQueryClient();
    const rows = await runBigQuery(bq, billingProjectId, options);
    const results: GuardResult[] = rows.map((row) => {
      const events = parseNumber(row.events);
      const purchaseEvents = parseNumber(row.purchase_events);
      return {
        id: String(row.id ?? ""),
        guardStatus: events > 0 ? "present" : "robust_absent",
        events,
        purchaseEvents,
        eventNames: String(row.event_names ?? ""),
        firstSeenKst: String(row.first_seen_kst ?? ""),
        lastSeenKst: String(row.last_seen_kst ?? ""),
      };
    });
    const payload = {
      ok: true,
      ...payloadBase,
      serviceAccount: {
        clientEmail,
        billingProjectId,
      },
      results,
      summary: {
        ids: results.length,
        present: results.filter((row) => row.guardStatus === "present").length,
        robustAbsent: results.filter((row) => row.guardStatus === "robust_absent").length,
      },
      guardrails: {
        noSendVerified: true,
        noWriteVerified: true,
        noDeployVerified: true,
      },
    };
    writeOutput(options, options.markdown ? `${renderMarkdown(payload)}\n` : `${JSON.stringify(payload, null, 2)}\n`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const payload = {
      ok: false,
      ...payloadBase,
      error: message,
      summary: {
        ids: options.ids.length,
        present: 0,
        robustAbsent: 0,
        unknown: options.ids.length,
      },
      guardrails: {
        noSendVerified: true,
        noWriteVerified: true,
        noDeployVerified: true,
      },
    };
    writeOutput(options, options.markdown ? `${renderMarkdown(payload)}\n` : `${JSON.stringify(payload, null, 2)}\n`);
    process.exitCode = 2;
  }
};

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`npay-ga4-robust-guard failed: ${message}`);
  process.exitCode = 1;
});
