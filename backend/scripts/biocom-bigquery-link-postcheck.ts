import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import dotenv from "dotenv";
import { google, type bigquery_v2 } from "googleapis";

dotenv.config({ path: path.resolve(__dirname, "..", ".env"), quiet: true });

const TARGET_PROJECT = "project-dadba7dd-0229-4ff6-81c";
const NEW_EXPORT_DATASET = "analytics_304759974";
const SOURCE_PROJECT = "hurdlers-naver-pay";
const SOURCE_DATASET = "analytics_304759974";
const ARCHIVE_DATASET = "analytics_304759974_hurdlers_backfill";
const LOCATION = "asia-northeast3";
const QUERY_TIMEOUT_MS = 60_000;
const POLL_INTERVAL_MS = 2_000;

type BigQueryRow = Record<string, unknown>;

type CredentialInfo = {
  client_email: string;
  project_id?: string;
};

type DatasetCheck = {
  projectId: string;
  datasetId: string;
  exists: boolean;
  location?: string;
  errorCode?: number;
  errorMessage?: string;
};

type InventorySummary = {
  firstTable?: string;
  latestTable?: string;
  tableCount: number;
  totalRows: number;
  totalSizeBytes: number;
};

type PurchaseSanity = {
  tableId: string;
  rows: number;
  purchase: number;
  distinctTransactionId: number;
  maxEventTimeKst?: string;
};

type SourceSnapshot = {
  dataset: DatasetCheck;
  inventory?: InventorySummary;
  latestPurchaseSanity?: PurchaseSanity;
  error?: string;
};

const parseArgs = () => {
  const label =
    process.argv.find((arg) => arg.startsWith("--label="))?.slice("--label=".length) ??
    new Date().toISOString().replace(/[-:]/g, "").slice(0, 13);
  return { label };
};

const toKst = (date = new Date()) =>
  new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);

const parseJsonCredentials = () => {
  const rawKey = process.env.GA4_BIOCOM_SERVICE_ACCOUNT_KEY?.trim() || process.env.GA4_SERVICE_ACCOUNT_KEY?.trim();
  if (!rawKey) {
    throw new Error("GA4_BIOCOM_SERVICE_ACCOUNT_KEY or GA4_SERVICE_ACCOUNT_KEY is required");
  }
  const parsed = JSON.parse(rawKey) as CredentialInfo & { private_key: string };
  if (!parsed.client_email || !parsed.private_key) {
    throw new Error("BigQuery service account key must include client_email and private_key");
  }
  return parsed;
};

const createBigQueryClient = () => {
  const credentials = parseJsonCredentials();
  const auth = new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ["https://www.googleapis.com/auth/bigquery", "https://www.googleapis.com/auth/cloud-platform"],
  });
  return {
    bq: google.bigquery({ version: "v2", auth }),
    credential: {
      client_email: credentials.client_email,
      project_id: credentials.project_id,
    },
  };
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const num = (value: unknown) => {
  if (value === null || value === undefined || value === "") return 0;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`Expected numeric value, got ${String(value)}`);
  return parsed;
};

const mapRows = (response: bigquery_v2.Schema$GetQueryResultsResponse | bigquery_v2.Schema$QueryResponse) => {
  const fields = response.schema?.fields ?? [];
  return (response.rows ?? []).map((row) =>
    Object.fromEntries((row.f ?? []).map((cell, index) => [fields[index]?.name ?? String(index), cell.v])),
  ) as BigQueryRow[];
};

const runQuery = async (bq: bigquery_v2.Bigquery, query: string) => {
  const initial = await bq.jobs.query({
    projectId: TARGET_PROJECT,
    requestBody: {
      query,
      useLegacySql: false,
      location: LOCATION,
      timeoutMs: QUERY_TIMEOUT_MS,
      maxResults: 10_000,
    },
  });

  let rows = mapRows(initial.data);
  let pageToken = initial.data.pageToken ?? undefined;
  const jobId = initial.data.jobReference?.jobId ?? undefined;

  while (!initial.data.jobComplete && jobId) {
    await sleep(POLL_INTERVAL_MS);
    const poll = await bq.jobs.getQueryResults({
      projectId: TARGET_PROJECT,
      jobId,
      location: LOCATION,
      maxResults: 10_000,
    });
    if (poll.data.jobComplete) {
      rows = mapRows(poll.data);
      pageToken = poll.data.pageToken ?? undefined;
      break;
    }
  }

  while (pageToken && jobId) {
    const page = await bq.jobs.getQueryResults({
      projectId: TARGET_PROJECT,
      jobId,
      location: LOCATION,
      pageToken,
      maxResults: 10_000,
    });
    rows = rows.concat(mapRows(page.data));
    pageToken = page.data.pageToken ?? undefined;
  }

  return rows;
};

const getDataset = async (bq: bigquery_v2.Bigquery, projectId: string, datasetId: string): Promise<DatasetCheck> => {
  try {
    const response = await bq.datasets.get({ projectId, datasetId });
    return {
      projectId,
      datasetId,
      exists: true,
      location: response.data.location ?? undefined,
    };
  } catch (error) {
    const err = error as { code?: number; message?: string };
    return {
      projectId,
      datasetId,
      exists: false,
      errorCode: err.code,
      errorMessage: err.message,
    };
  }
};

const queryInventory = async (
  bq: bigquery_v2.Bigquery,
  projectId: string,
  datasetId: string,
): Promise<InventorySummary> => {
  const rows = await runQuery(
    bq,
    `
    SELECT
      table_id,
      row_count,
      size_bytes
    FROM \`${projectId}.${datasetId}.__TABLES__\`
    WHERE REGEXP_CONTAINS(table_id, r'^events_\\d{8}$')
    ORDER BY table_id
    `,
  );
  const mapped = rows.map((row) => ({
    tableId: String(row.table_id),
    rowCount: num(row.row_count),
    sizeBytes: num(row.size_bytes),
  }));
  return {
    firstTable: mapped[0]?.tableId,
    latestTable: mapped[mapped.length - 1]?.tableId,
    tableCount: mapped.length,
    totalRows: mapped.reduce((sum, row) => sum + row.rowCount, 0),
    totalSizeBytes: mapped.reduce((sum, row) => sum + row.sizeBytes, 0),
  };
};

const queryPurchaseSanity = async (
  bq: bigquery_v2.Bigquery,
  projectId: string,
  datasetId: string,
  tableId?: string,
): Promise<PurchaseSanity | undefined> => {
  if (!tableId) return undefined;
  const rows = await runQuery(
    bq,
    `
    SELECT
      COUNT(*) AS total_events,
      COUNTIF(event_name = 'purchase') AS purchase,
      COUNT(DISTINCT IF(event_name = 'purchase', NULLIF(ecommerce.transaction_id, ''), NULL)) AS distinct_transaction_id,
      FORMAT_TIMESTAMP('%F %T %Z', MAX(TIMESTAMP_MICROS(event_timestamp)), 'Asia/Seoul') AS max_event_time_kst
    FROM \`${projectId}.${datasetId}.${tableId}\`
    `,
  );
  const row = rows[0] ?? {};
  return {
    tableId,
    rows: num(row.total_events),
    purchase: num(row.purchase),
    distinctTransactionId: num(row.distinct_transaction_id),
    maxEventTimeKst: row.max_event_time_kst ? String(row.max_event_time_kst) : undefined,
  };
};

const snapshotDataset = async (
  bq: bigquery_v2.Bigquery,
  projectId: string,
  datasetId: string,
): Promise<SourceSnapshot> => {
  const dataset = await getDataset(bq, projectId, datasetId);
  if (!dataset.exists) return { dataset };
  try {
    const inventory = await queryInventory(bq, projectId, datasetId);
    const latestPurchaseSanity = await queryPurchaseSanity(bq, projectId, datasetId, inventory.latestTable);
    return { dataset, inventory, latestPurchaseSanity };
  } catch (error) {
    return {
      dataset,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

const runFreshnessScript = () => {
  try {
    const output = execFileSync("npx", ["tsx", "scripts/check-source-freshness.ts", "--json"], {
      cwd: path.resolve(__dirname, ".."),
      encoding: "utf8",
      timeout: 180_000,
      env: process.env,
    });
    return JSON.parse(output) as unknown;
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

const formatNumber = (value?: number) => (value === undefined ? "-" : value.toLocaleString("en-US"));

const formatDatasetLine = (snapshot: SourceSnapshot) => {
  const dataset = `${snapshot.dataset.projectId}.${snapshot.dataset.datasetId}`;
  if (!snapshot.dataset.exists) {
    return `- ${dataset}: not found${snapshot.dataset.errorCode ? ` (${snapshot.dataset.errorCode})` : ""}`;
  }
  const inventory = snapshot.inventory;
  return `- ${dataset}: exists, location ${snapshot.dataset.location ?? "-"}, latest ${
    inventory?.latestTable ?? "-"
  }, tables ${formatNumber(inventory?.tableCount)}, rows ${formatNumber(inventory?.totalRows)}`;
};

const writeMarkdown = (filePath: string, result: Record<string, unknown>) => {
  const newExport = result.newExport as SourceSnapshot;
  const liveSource = result.liveSource as SourceSnapshot;
  const archive = result.archive as SourceSnapshot;
  const decision = String(result.decision);
  const markdown = `# biocom BigQuery Link 자동 확인 - ${result.label}

작성 시각: ${result.generatedAtKst} KST
작업 성격: Green Lane, cron scheduled read-only check
관련 JSON: \`${path.basename(filePath).replace(/\.md$/, ".json")}\`

## 10초 요약

자동 확인 결과는 \`${decision}\`이다.
신규 GA4 export dataset은 \`${TARGET_PROJECT}.${NEW_EXPORT_DATASET}\`이고, 기대 location은 \`${LOCATION}\`이다.
이 문서는 BigQuery read-only 확인 결과만 기록한다.

## Harness Preflight

\`\`\`yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - docs/agent-harness/growth-data-harness-v0.md
  required_context_docs:
    - AGENTS.md
    - docurule.md
    - data/!bigquery.md
  lane: Green
  allowed_actions:
    - BigQuery dataset/table metadata read
    - BigQuery sanity query read
    - local result file write
  forbidden_actions:
    - BigQuery dataset/table create
    - BigQuery table copy/delete
    - GA4 Link delete/create
    - sourceFreshness switch
    - deploy
    - platform send
  source_window_freshness_confidence:
    source: ${TARGET_PROJECT}.${NEW_EXPORT_DATASET}
    window: post-cutover latest daily table if available
    freshness: ${result.generatedAtKst} KST
    site: biocom
    confidence: ${result.confidence}
\`\`\`

## Dataset Checks

${formatDatasetLine(newExport)}
${formatDatasetLine(liveSource)}
${formatDatasetLine(archive)}

## New Export Latest Sanity

${
  newExport.latestPurchaseSanity
    ? `| table | rows | purchase | distinct transaction_id | max event time KST |
|---|---:|---:|---:|---|
| \`${newExport.latestPurchaseSanity.tableId}\` | ${formatNumber(newExport.latestPurchaseSanity.rows)} | ${formatNumber(newExport.latestPurchaseSanity.purchase)} | ${formatNumber(newExport.latestPurchaseSanity.distinctTransactionId)} | ${newExport.latestPurchaseSanity.maxEventTimeKst ?? "-"} |`
    : "신규 export daily table이 아직 없어 purchase sanity를 실행하지 않았다."
}

## 판단

- 신규 dataset이 없으면: Link 생성은 됐지만 BigQuery export materialization 대기.
- 신규 dataset은 있고 daily table이 없으면: dataset 생성은 됐지만 첫 daily export 대기.
- daily table이 있으면: rows, purchase, distinct transaction_id, max event time KST를 기준으로 3일 연속 안정 여부를 계속 본다.

## 금지선 확인

- sourceFreshness 전환: 하지 않음.
- BigQuery write/copy/delete: 하지 않음.
- GA4 Link 추가 변경: 하지 않음.
- deploy: 하지 않음.
- platform send: 하지 않음.
`;
  fs.writeFileSync(filePath, markdown);
};

const main = async () => {
  const { label } = parseArgs();
  const { bq, credential } = createBigQueryClient();
  const generatedAtKst = toKst();
  const dataDir = path.resolve(__dirname, "..", "..", "data");
  fs.mkdirSync(dataDir, { recursive: true });

  const newExport = await snapshotDataset(bq, TARGET_PROJECT, NEW_EXPORT_DATASET);
  const liveSource = await snapshotDataset(bq, SOURCE_PROJECT, SOURCE_DATASET);
  const archive = await snapshotDataset(bq, TARGET_PROJECT, ARCHIVE_DATASET);
  const sourceFreshness = runFreshnessScript();

  let decision = "new_export_dataset_pending";
  let confidence = "B";
  if (newExport.dataset.exists && newExport.dataset.location !== LOCATION) {
    decision = "new_export_location_mismatch";
    confidence = "C";
  } else if (newExport.dataset.exists && (newExport.inventory?.tableCount ?? 0) === 0) {
    decision = "new_export_dataset_available_waiting_for_daily_table";
    confidence = "B+";
  } else if (newExport.latestPurchaseSanity) {
    decision = "new_export_daily_table_available";
    confidence = "A-";
  }

  const result = {
    label,
    generatedAtKst,
    credential,
    expected: {
      projectId: TARGET_PROJECT,
      datasetId: NEW_EXPORT_DATASET,
      location: LOCATION,
    },
    newExport,
    liveSource,
    archive,
    sourceFreshness,
    decision,
    confidence,
  };

  const jsonPath = path.join(dataDir, `biocom-bigquery-link-postcheck-${label}.json`);
  const mdPath = path.join(dataDir, `biocom-bigquery-link-postcheck-${label}.md`);
  fs.writeFileSync(jsonPath, `${JSON.stringify(result, null, 2)}\n`);
  writeMarkdown(mdPath, result);

  console.log(JSON.stringify({ ok: true, decision, confidence, jsonPath, mdPath }, null, 2));
};

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});
