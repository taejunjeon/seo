import fs from "node:fs";
import path from "node:path";

import dotenv from "dotenv";
import { google, type bigquery_v2 } from "googleapis";

dotenv.config({ path: path.resolve(__dirname, "..", ".env"), quiet: true });

const SITE = "thecleancoffee";
const COFFEE_PROJECT_ID = "project-dadba7dd-0229-4ff6-81c";
const COFFEE_DATASET = `analytics_${process.env.GA4_COFFEE_PROPERTY_ID?.trim() || "326949178"}`;
const COFFEE_LOCATION = "asia-northeast3";

type BigQueryRow = Record<string, unknown>;

const argValue = (name: string) =>
  process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);

const validateSuffix = (label: string, suffix: string) => {
  if (!/^\d{8}$/.test(suffix)) throw new Error(`${label} must be YYYYMMDD: ${suffix}`);
  return suffix;
};

const parseArgs = () => {
  const startSuffix = validateSuffix("startSuffix", argValue("startSuffix") ?? "20260423");
  const endSuffix = validateSuffix("endSuffix", argValue("endSuffix") ?? "20260429");
  if (startSuffix > endSuffix) throw new Error(`startSuffix must be <= endSuffix: ${startSuffix} > ${endSuffix}`);

  const inlineIds = (argValue("ids") ?? "")
    .split(/[,\n]/)
    .map((id) => id.trim())
    .filter(Boolean);
  const idsFile = argValue("idsFile");
  const fileIds = idsFile
    ? fs
        .readFileSync(path.resolve(idsFile), "utf8")
        .split(/[,\n]/)
        .map((id) => id.trim())
        .filter((id) => id && !id.startsWith("#"))
    : [];
  const ids = [...new Set([...inlineIds, ...fileIds])];
  if (ids.length === 0) throw new Error("Provide --ids=ORDER1,ORDER2 or --idsFile=path");

  return {
    startSuffix,
    endSuffix,
    ids,
    markdown: process.argv.includes("--markdown"),
  };
};

const parseJsonCredentials = () => {
  const rawKey = process.env.GA4_SERVICE_ACCOUNT_KEY || process.env.GA4_BIOCOM_SERVICE_ACCOUNT_KEY;
  if (!rawKey?.trim()) throw new Error("GA4 service account key missing");
  return JSON.parse(rawKey) as { client_email: string; private_key: string };
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
  return google.bigquery({ version: "v2", auth });
};

const runBigQuery = async (bq: bigquery_v2.Bigquery, query: string) => {
  const response = await bq.jobs.query({
    projectId: COFFEE_PROJECT_ID,
    requestBody: {
      query,
      useLegacySql: false,
      location: COFFEE_LOCATION,
      timeoutMs: 30_000,
    },
  });
  const fields = response.data.schema?.fields ?? [];
  return (response.data.rows ?? []).map((row) =>
    Object.fromEntries((row.f ?? []).map((cell, index) => [fields[index]?.name ?? String(index), cell.v])),
  ) as BigQueryRow[];
};

const bqString = (value: string) => `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;

const valueExpr =
  "COALESCE(ep.value.string_value, CAST(ep.value.int_value AS STRING), CAST(ep.value.double_value AS STRING), CAST(ep.value.float_value AS STRING))";

const buildQuery = (ids: string[], startSuffix: string, endSuffix: string) => `
  WITH ids AS (
    SELECT id FROM UNNEST([${ids.map(bqString).join(", ")}]) AS id
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
        SELECT ${valueExpr}
        FROM UNNEST(event_params) ep
        WHERE ${valueExpr} IS NOT NULL
      ) AS event_param_values,
      ARRAY(
        SELECT CONCAT(ep.key, '=', ${valueExpr})
        FROM UNNEST(event_params) ep
        WHERE ${valueExpr} IS NOT NULL
      ) AS event_param_pairs
    FROM \`${COFFEE_PROJECT_ID}.${COFFEE_DATASET}.events_*\`
    WHERE _TABLE_SUFFIX BETWEEN '${startSuffix}' AND '${endSuffix}'
  ),
  matched AS (
    SELECT
      ids.id,
      raw.table_suffix,
      raw.event_name,
      raw.event_timestamp,
      raw.event_time_kst,
      raw.ecommerce_transaction_id,
      raw.param_transaction_id,
      ARRAY(
        SELECT pair FROM UNNEST(raw.event_param_pairs) AS pair
        WHERE ENDS_WITH(pair, CONCAT('=', ids.id))
      ) AS matched_event_params
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
    FORMAT_TIMESTAMP('%Y-%m-%d %H:%M:%S', TIMESTAMP_MICROS(MAX(matched.event_timestamp)), 'Asia/Seoul') AS last_seen_kst,
    ARRAY_AGG(
      IF(matched.event_name IS NULL, NULL, STRUCT(
        matched.table_suffix AS table_suffix,
        matched.event_name AS event_name,
        matched.event_time_kst AS event_time_kst,
        matched.ecommerce_transaction_id AS ecommerce_transaction_id,
        matched.param_transaction_id AS param_transaction_id,
        ARRAY_TO_STRING(matched.matched_event_params, ' | ') AS matched_event_params
      ))
      IGNORE NULLS
      ORDER BY matched.event_timestamp DESC
      LIMIT 5
    ) AS samples
  FROM ids
  LEFT JOIN matched USING (id)
  GROUP BY ids.id
  ORDER BY ids.id;
`;

const parseNumber = (value: unknown) => {
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
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
  "# 더클린커피 GA4 Robust Guard Read-only 결과",
  "",
  `생성 시각: ${payload.checkedAt}`,
  `site: \`${payload.site}\``,
  `window: ${payload.window.startSuffix} ~ ${payload.window.endSuffix}`,
  "",
  "## Guard Summary",
  "",
  markdownTable(
    ["id", "guard_status", "events", "purchase_events", "event_names", "first_seen", "last_seen"],
    payload.results.map((row: Record<string, unknown>) => [
      row.id,
      row.guardStatus,
      row.events,
      row.purchaseEvents,
      row.eventNames,
      row.firstSeenKst,
      row.lastSeenKst,
    ]),
  ),
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

const main = async () => {
  const args = parseArgs();
  const bq = createBigQueryClient();
  const rows = await runBigQuery(bq, buildQuery(args.ids, args.startSuffix, args.endSuffix));
  const results = rows.map((row) => {
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
      samples: row.samples ?? [],
    };
  });
  const payload = {
    ok: true,
    checkedAt: nowKst(),
    site: SITE,
    mode: "read_only",
    window: {
      startSuffix: args.startSuffix,
      endSuffix: args.endSuffix,
    },
    queryScope: {
      projectId: COFFEE_PROJECT_ID,
      dataset: COFFEE_DATASET,
      location: COFFEE_LOCATION,
      searchedFields: [
        "ecommerce.transaction_id",
        "event_params.transaction_id",
        "event_params full value scan string/int/double/float",
      ],
    },
    results,
    summary: {
      ids: results.length,
      present: results.filter((row) => row.guardStatus === "present").length,
      robustAbsent: results.filter((row) => row.guardStatus === "robust_absent").length,
      purchasePresent: results.filter((row) => row.purchaseEvents > 0).length,
    },
    guardrails: {
      dbWrite: false,
      ga4Send: false,
      metaSend: false,
      tiktokSend: false,
      googleAdsSend: false,
      gtmPublish: false,
      endpointDeploy: false,
    },
  };

  console.log(args.markdown ? renderMarkdown(payload) : JSON.stringify(payload, null, 2));
};

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
