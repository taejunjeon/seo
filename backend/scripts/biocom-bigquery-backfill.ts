import path from "node:path";

import dotenv from "dotenv";
import { google, type bigquery_v2 } from "googleapis";

dotenv.config({ path: path.resolve(__dirname, "..", ".env"), quiet: true });

const SOURCE_PROJECT = "hurdlers-naver-pay";
const SOURCE_DATASET = "analytics_304759974";
const TARGET_PROJECT = "project-dadba7dd-0229-4ff6-81c";
const TARGET_DATASET = "analytics_304759974_hurdlers_backfill";
const LOCATION = "asia-northeast3";
const START_SUFFIX = "20240909";
const TABLE_PREFIX = "events_";
const COPY_CONCURRENCY = 3;
const QUERY_TIMEOUT_MS = 60_000;
const POLL_INTERVAL_MS = 2_000;

type Mode = "plan" | "initial-copy" | "verify" | "delta-plan" | "delta-copy";

type CredentialInfo = {
  client_email: string;
  project_id?: string;
};

type InventoryRow = {
  tableId: string;
  suffix: string;
  rowCount: number;
  sizeBytes: number;
};

type DatasetInfo = {
  projectId: string;
  datasetId: string;
  exists: boolean;
  location?: string;
};

type CopyAction = {
  tableId: string;
  sourceRows: number;
  targetRows?: number;
  sizeBytes: number;
  action: "copy" | "skip_existing";
};

type Plan = {
  generatedAtKst: string;
  credential: CredentialInfo;
  sourceDataset: DatasetInfo;
  targetDataset: DatasetInfo;
  source: {
    firstTable?: string;
    latestTable?: string;
    tableCount: number;
    totalRows: number;
    totalSizeBytes: number;
    totalSizeGiB: number;
    intradayTableCount: number;
  };
  target: {
    tableCount: number;
    totalRows: number;
    totalSizeBytes: number;
    totalSizeGiB: number;
  };
  actions: {
    copyCount: number;
    skipExistingCount: number;
    copyTables: CopyAction[];
    skippedExistingTables: CopyAction[];
  };
  mismatches: string[];
  warnings: string[];
  okToInitialCopy: boolean;
};

type VerificationResult = {
  generatedAtKst: string;
  credential: CredentialInfo;
  sourceDataset: DatasetInfo;
  targetDataset: DatasetInfo;
  source: Plan["source"];
  target: Plan["target"];
  tableCountMatches: boolean;
  rowCountMatches: boolean;
  sizeBytesDifference: number;
  sizeBytesDifferencePct: number;
  missingTargetTables: string[];
  extraTargetTables: string[];
  mismatchedRowTables: Array<{ tableId: string; sourceRows: number; targetRows: number }>;
  sampleDateChecks: Array<{ tableId: string; sourceRows: number; targetRows: number; match: boolean }>;
  latestPurchaseCheck?: {
    tableId: string;
    source: PurchaseSanity;
    target: PurchaseSanity;
    match: boolean;
  };
  ok: boolean;
};

type PurchaseSanity = {
  rows: number;
  purchaseEvents: number;
  distinctTransactionIds: number;
  maxEventTimeKst: string | null;
};

type CliOptions = {
  mode: Mode;
  json: boolean;
};

type BigQueryRow = Record<string, unknown>;

const modeValues = new Set<Mode>(["plan", "initial-copy", "verify", "delta-plan", "delta-copy"]);

const formatKst = (date = new Date()) =>
  new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
    .format(date)
    .replace(" ", "T");

const parseArgs = (): CliOptions => {
  const rawMode =
    process.argv
      .find((arg) => arg.startsWith("--mode="))
      ?.slice("--mode=".length) ?? "plan";
  if (!modeValues.has(rawMode as Mode)) {
    throw new Error(`Invalid --mode=${rawMode}. Allowed: ${Array.from(modeValues).join(", ")}`);
  }
  return {
    mode: rawMode as Mode,
    json: process.argv.includes("--json"),
  };
};

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
    scopes: [
      "https://www.googleapis.com/auth/bigquery",
      "https://www.googleapis.com/auth/cloud-platform",
    ],
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

const tableIdToSuffix = (tableId: string) => tableId.slice(TABLE_PREFIX.length);

const isDailyEventsTable = (tableId: string) => /^events_\d{8}$/.test(tableId);

const num = (value: unknown) => {
  if (value === null || value === undefined || value === "") return 0;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`Expected numeric value, got ${String(value)}`);
  return parsed;
};

const sizeGiB = (bytes: number) => Math.round((bytes / 1024 ** 3) * 100) / 100;

const tableRef = (projectId: string, datasetId: string, tableId: string) =>
  `\`${projectId}.${datasetId}.${tableId}\``;

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
  let jobId = initial.data.jobReference?.jobId ?? undefined;

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

const getDatasetInfo = async (bq: bigquery_v2.Bigquery, projectId: string, datasetId: string): Promise<DatasetInfo> => {
  try {
    const response = await bq.datasets.get({ projectId, datasetId });
    return {
      projectId,
      datasetId,
      exists: true,
      location: response.data.location ?? undefined,
    };
  } catch (error) {
    const status = (error as { code?: number }).code;
    if (status === 404) {
      return { projectId, datasetId, exists: false };
    }
    throw error;
  }
};

const assertDatasetLocation = (dataset: DatasetInfo, label: string) => {
  if (!dataset.exists) return;
  if ((dataset.location ?? "").toLowerCase() !== LOCATION) {
    throw new Error(
      `${label} location must be ${LOCATION}, got ${dataset.location ?? "(missing)"} for ${dataset.projectId}.${dataset.datasetId}`,
    );
  }
};

const queryInventory = async (bq: bigquery_v2.Bigquery, projectId: string, datasetId: string) => {
  const rows = await runQuery(
    bq,
    `
    SELECT
      table_id,
      row_count,
      size_bytes
    FROM \`${projectId}.${datasetId}.__TABLES__\`
    WHERE REGEXP_CONTAINS(table_id, r'^events_\\d{8}$')
      AND SUBSTR(table_id, 8) >= '${START_SUFFIX}'
    ORDER BY table_id
    `,
  );
  return rows.map((row) => {
    const tableId = String(row.table_id);
    if (!isDailyEventsTable(tableId)) throw new Error(`Unexpected daily table id: ${tableId}`);
    return {
      tableId,
      suffix: tableIdToSuffix(tableId),
      rowCount: num(row.row_count),
      sizeBytes: num(row.size_bytes),
    };
  }) satisfies InventoryRow[];
};

const queryIntradayCount = async (bq: bigquery_v2.Bigquery, projectId: string, datasetId: string) => {
  const rows = await runQuery(
    bq,
    `
    SELECT COUNT(*) AS table_count
    FROM \`${projectId}.${datasetId}.__TABLES__\`
    WHERE STARTS_WITH(table_id, 'events_intraday_')
    `,
  );
  return num(rows[0]?.table_count);
};

const summarizeInventory = (inventory: InventoryRow[]) => {
  const totalRows = inventory.reduce((sum, row) => sum + row.rowCount, 0);
  const totalSizeBytes = inventory.reduce((sum, row) => sum + row.sizeBytes, 0);
  return {
    firstTable: inventory[0]?.tableId,
    latestTable: inventory[inventory.length - 1]?.tableId,
    tableCount: inventory.length,
    totalRows,
    totalSizeBytes,
    totalSizeGiB: sizeGiB(totalSizeBytes),
  };
};

const chooseSampleTables = (sourceInventory: InventoryRow[]) => {
  const sourceIds = new Set(sourceInventory.map((row) => row.tableId));
  const latestTable = sourceInventory[sourceInventory.length - 1]?.tableId;
  const candidates = ["events_20240909", "events_20260101", "events_20260423", "events_20260425", latestTable].filter(
    Boolean,
  ) as string[];
  return Array.from(new Set(candidates)).filter((tableId) => sourceIds.has(tableId));
};

const buildPlan = async (
  bq: bigquery_v2.Bigquery,
  credential: CredentialInfo,
): Promise<{ plan: Plan; sourceInventory: InventoryRow[]; targetInventory: InventoryRow[] }> => {
  const sourceDataset = await getDatasetInfo(bq, SOURCE_PROJECT, SOURCE_DATASET);
  if (!sourceDataset.exists) {
    throw new Error(`Source dataset not found: ${SOURCE_PROJECT}.${SOURCE_DATASET}`);
  }
  assertDatasetLocation(sourceDataset, "source dataset");

  const targetDataset = await getDatasetInfo(bq, TARGET_PROJECT, TARGET_DATASET);
  assertDatasetLocation(targetDataset, "target dataset");

  const sourceInventory = await queryInventory(bq, SOURCE_PROJECT, SOURCE_DATASET);
  if (sourceInventory.length === 0) {
    throw new Error(`No daily events tables found in ${SOURCE_PROJECT}.${SOURCE_DATASET} from ${START_SUFFIX}`);
  }

  const targetInventory = targetDataset.exists ? await queryInventory(bq, TARGET_PROJECT, TARGET_DATASET) : [];
  const sourceById = new Map(sourceInventory.map((row) => [row.tableId, row]));
  const targetById = new Map(targetInventory.map((row) => [row.tableId, row]));
  const mismatches: string[] = [];
  const warnings: string[] = [];
  const copyTables: CopyAction[] = [];
  const skippedExistingTables: CopyAction[] = [];
  const intradayTableCount = await queryIntradayCount(bq, SOURCE_PROJECT, SOURCE_DATASET);

  if (sourceInventory[0]?.tableId !== `${TABLE_PREFIX}${START_SUFFIX}`) {
    warnings.push(`first included source table is ${sourceInventory[0]?.tableId}, expected events_${START_SUFFIX}`);
  }
  if (intradayTableCount > 0) {
    warnings.push(`${intradayTableCount} intraday table(s) exist in source; this approved initial copy only copies daily events_YYYYMMDD tables`);
  }

  for (const source of sourceInventory) {
    const target = targetById.get(source.tableId);
    if (!target) {
      copyTables.push({
        tableId: source.tableId,
        sourceRows: source.rowCount,
        sizeBytes: source.sizeBytes,
        action: "copy",
      });
      continue;
    }
    if (target.rowCount !== source.rowCount) {
      mismatches.push(
        `${source.tableId} exists in target with row_count=${target.rowCount}, source row_count=${source.rowCount}`,
      );
      continue;
    }
    skippedExistingTables.push({
      tableId: source.tableId,
      sourceRows: source.rowCount,
      targetRows: target.rowCount,
      sizeBytes: source.sizeBytes,
      action: "skip_existing",
    });
  }

  for (const target of targetInventory) {
    if (!sourceById.has(target.tableId)) {
      mismatches.push(`${target.tableId} exists in target but not in source initial range`);
    }
  }

  const sourceSummary = summarizeInventory(sourceInventory);
  const targetSummary = summarizeInventory(targetInventory);
  const plan: Plan = {
    generatedAtKst: `${formatKst()}+09:00`,
    credential,
    sourceDataset,
    targetDataset,
    source: {
      ...sourceSummary,
      intradayTableCount,
    },
    target: targetSummary,
    actions: {
      copyCount: copyTables.length,
      skipExistingCount: skippedExistingTables.length,
      copyTables,
      skippedExistingTables,
    },
    mismatches,
    warnings,
    okToInitialCopy: mismatches.length === 0,
  };
  return { plan, sourceInventory, targetInventory };
};

const createTargetDataset = async (bq: bigquery_v2.Bigquery) => {
  await bq.datasets.insert({
    projectId: TARGET_PROJECT,
    requestBody: {
      datasetReference: {
        projectId: TARGET_PROJECT,
        datasetId: TARGET_DATASET,
      },
      friendlyName: "biocom GA4 Hurdlers backfill",
      description:
        "Approved initial backfill copy from hurdlers-naver-pay.analytics_304759974. Source remains unchanged.",
      location: LOCATION,
    },
  });
};

const copyTable = async (bq: bigquery_v2.Bigquery, tableId: string) => {
  const jobId = `biocom_backfill_${tableId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const response = await bq.jobs.insert({
    projectId: TARGET_PROJECT,
    requestBody: {
      jobReference: {
        projectId: TARGET_PROJECT,
        jobId,
        location: LOCATION,
      },
      configuration: {
        copy: {
          sourceTable: {
            projectId: SOURCE_PROJECT,
            datasetId: SOURCE_DATASET,
            tableId,
          },
          destinationTable: {
            projectId: TARGET_PROJECT,
            datasetId: TARGET_DATASET,
            tableId,
          },
          writeDisposition: "WRITE_EMPTY",
        },
      },
    },
  });

  const actualJobId = response.data.jobReference?.jobId ?? jobId;
  for (;;) {
    const job = await bq.jobs.get({
      projectId: TARGET_PROJECT,
      jobId: actualJobId,
      location: LOCATION,
    });
    if (job.data.status?.state === "DONE") {
      if (job.data.status.errorResult) {
        const message = job.data.status.errors?.map((err) => err.message).filter(Boolean).join(" | ");
        throw new Error(`copy ${tableId} failed: ${job.data.status.errorResult.message ?? message ?? "unknown error"}`);
      }
      return actualJobId;
    }
    await sleep(POLL_INTERVAL_MS);
  }
};

const runWithConcurrency = async <T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
) => {
  const results: R[] = [];
  let cursor = 0;
  let completed = 0;

  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    for (;;) {
      const index = cursor;
      cursor += 1;
      const item = items[index];
      if (!item) return;
      const result = await worker(item, index);
      results[index] = result;
      completed += 1;
      if (completed % 25 === 0 || completed === items.length) {
        console.log(`copy progress: ${completed}/${items.length}`);
      }
    }
  });

  await Promise.all(runners);
  return results;
};

const countRows = async (bq: bigquery_v2.Bigquery, projectId: string, datasetId: string, tableId: string) => {
  const rows = await runQuery(
    bq,
    `
    SELECT COUNT(*) AS row_count
    FROM ${tableRef(projectId, datasetId, tableId)}
    `,
  );
  return num(rows[0]?.row_count);
};

const queryPurchaseSanity = async (
  bq: bigquery_v2.Bigquery,
  projectId: string,
  datasetId: string,
  tableId: string,
): Promise<PurchaseSanity> => {
  const rows = await runQuery(
    bq,
    `
    SELECT
      COUNT(*) AS total_rows,
      COUNTIF(event_name = 'purchase') AS purchase_events,
      COUNT(DISTINCT IF(
        event_name = 'purchase',
        NULLIF(COALESCE(
          ecommerce.transaction_id,
          (SELECT ep.value.string_value FROM UNNEST(event_params) ep WHERE ep.key = 'transaction_id' LIMIT 1)
        ), ''),
        NULL
      )) AS distinct_transaction_ids,
      FORMAT_TIMESTAMP('%Y-%m-%d %H:%M:%S %Z', TIMESTAMP_MICROS(MAX(event_timestamp)), 'Asia/Seoul') AS max_event_time_kst
    FROM ${tableRef(projectId, datasetId, tableId)}
    `,
  );
  const row = rows[0] ?? {};
  return {
    rows: num(row.total_rows),
    purchaseEvents: num(row.purchase_events),
    distinctTransactionIds: num(row.distinct_transaction_ids),
    maxEventTimeKst: row.max_event_time_kst ? String(row.max_event_time_kst) : null,
  };
};

const verifyBackfill = async (bq: bigquery_v2.Bigquery, credential: CredentialInfo): Promise<VerificationResult> => {
  const sourceDataset = await getDatasetInfo(bq, SOURCE_PROJECT, SOURCE_DATASET);
  const targetDataset = await getDatasetInfo(bq, TARGET_PROJECT, TARGET_DATASET);
  if (!sourceDataset.exists) throw new Error(`Source dataset not found: ${SOURCE_PROJECT}.${SOURCE_DATASET}`);
  if (!targetDataset.exists) throw new Error(`Target dataset not found: ${TARGET_PROJECT}.${TARGET_DATASET}`);
  assertDatasetLocation(sourceDataset, "source dataset");
  assertDatasetLocation(targetDataset, "target dataset");

  const sourceInventory = await queryInventory(bq, SOURCE_PROJECT, SOURCE_DATASET);
  const targetInventory = await queryInventory(bq, TARGET_PROJECT, TARGET_DATASET);
  const sourceById = new Map(sourceInventory.map((row) => [row.tableId, row]));
  const targetById = new Map(targetInventory.map((row) => [row.tableId, row]));

  const missingTargetTables = sourceInventory.filter((row) => !targetById.has(row.tableId)).map((row) => row.tableId);
  const extraTargetTables = targetInventory.filter((row) => !sourceById.has(row.tableId)).map((row) => row.tableId);
  const mismatchedRowTables = sourceInventory
    .map((source) => {
      const target = targetById.get(source.tableId);
      if (!target || target.rowCount === source.rowCount) return null;
      return { tableId: source.tableId, sourceRows: source.rowCount, targetRows: target.rowCount };
    })
    .filter(Boolean) as Array<{ tableId: string; sourceRows: number; targetRows: number }>;

  const sampleDateChecks = [];
  for (const tableId of chooseSampleTables(sourceInventory)) {
    const [sourceRows, targetRows] = await Promise.all([
      countRows(bq, SOURCE_PROJECT, SOURCE_DATASET, tableId),
      countRows(bq, TARGET_PROJECT, TARGET_DATASET, tableId),
    ]);
    sampleDateChecks.push({ tableId, sourceRows, targetRows, match: sourceRows === targetRows });
  }

  const latestTable = sourceInventory[sourceInventory.length - 1]?.tableId;
  let latestPurchaseCheck: VerificationResult["latestPurchaseCheck"];
  if (latestTable && targetById.has(latestTable)) {
    const [source, target] = await Promise.all([
      queryPurchaseSanity(bq, SOURCE_PROJECT, SOURCE_DATASET, latestTable),
      queryPurchaseSanity(bq, TARGET_PROJECT, TARGET_DATASET, latestTable),
    ]);
    latestPurchaseCheck = {
      tableId: latestTable,
      source,
      target,
      match:
        source.rows === target.rows &&
        source.purchaseEvents === target.purchaseEvents &&
        source.distinctTransactionIds === target.distinctTransactionIds &&
        source.maxEventTimeKst === target.maxEventTimeKst,
    };
  }

  const sourceSummary = summarizeInventory(sourceInventory);
  const targetSummary = summarizeInventory(targetInventory);
  const sizeBytesDifference = Math.abs(sourceSummary.totalSizeBytes - targetSummary.totalSizeBytes);
  const sizeBytesDifferencePct =
    sourceSummary.totalSizeBytes > 0 ? (sizeBytesDifference / sourceSummary.totalSizeBytes) * 100 : 0;
  const intradayTableCount = await queryIntradayCount(bq, SOURCE_PROJECT, SOURCE_DATASET);
  const tableCountMatches = sourceSummary.tableCount === targetSummary.tableCount;
  const rowCountMatches = sourceSummary.totalRows === targetSummary.totalRows;
  const ok =
    tableCountMatches &&
    rowCountMatches &&
    missingTargetTables.length === 0 &&
    extraTargetTables.length === 0 &&
    mismatchedRowTables.length === 0 &&
    sampleDateChecks.every((check) => check.match) &&
    Boolean(latestPurchaseCheck?.match);

  return {
    generatedAtKst: `${formatKst()}+09:00`,
    credential,
    sourceDataset,
    targetDataset,
    source: {
      ...sourceSummary,
      intradayTableCount,
    },
    target: targetSummary,
    tableCountMatches,
    rowCountMatches,
    sizeBytesDifference,
    sizeBytesDifferencePct: Math.round(sizeBytesDifferencePct * 1000) / 1000,
    missingTargetTables,
    extraTargetTables,
    mismatchedRowTables,
    sampleDateChecks,
    latestPurchaseCheck,
    ok,
  };
};

const printPlan = (plan: Plan, json: boolean) => {
  if (json) {
    console.log(JSON.stringify(plan, null, 2));
    return;
  }
  console.log("biocom BigQuery backfill plan");
  console.log(`generated_at_kst: ${plan.generatedAtKst}`);
  console.log(`credential: ${plan.credential.client_email}`);
  console.log(`source: ${SOURCE_PROJECT}.${SOURCE_DATASET} @ ${plan.sourceDataset.location}`);
  console.log(
    `target: ${TARGET_PROJECT}.${TARGET_DATASET} ${
      plan.targetDataset.exists ? `@ ${plan.targetDataset.location}` : "(missing; will create)"
    }`,
  );
  console.log(
    `source daily: ${plan.source.firstTable}..${plan.source.latestTable}, tables=${plan.source.tableCount}, rows=${plan.source.totalRows}, size=${plan.source.totalSizeGiB} GiB`,
  );
  console.log(
    `target daily: tables=${plan.target.tableCount}, rows=${plan.target.totalRows}, size=${plan.target.totalSizeGiB} GiB`,
  );
  console.log(`actions: copy=${plan.actions.copyCount}, skip_existing=${plan.actions.skipExistingCount}`);
  if (plan.warnings.length > 0) {
    console.log("warnings:");
    for (const warning of plan.warnings) console.log(`- ${warning}`);
  }
  if (plan.mismatches.length > 0) {
    console.log("mismatches:");
    for (const mismatch of plan.mismatches.slice(0, 30)) console.log(`- ${mismatch}`);
    if (plan.mismatches.length > 30) console.log(`- ... ${plan.mismatches.length - 30} more`);
  }
  console.log(`ok_to_initial_copy: ${plan.okToInitialCopy ? "YES" : "NO"}`);
};

const printVerification = (result: VerificationResult, json: boolean) => {
  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  console.log("biocom BigQuery backfill verification");
  console.log(`generated_at_kst: ${result.generatedAtKst}`);
  console.log(`credential: ${result.credential.client_email}`);
  console.log(`source: ${SOURCE_PROJECT}.${SOURCE_DATASET} @ ${result.sourceDataset.location}`);
  console.log(`target: ${TARGET_PROJECT}.${TARGET_DATASET} @ ${result.targetDataset.location}`);
  console.log(
    `source daily: ${result.source.firstTable}..${result.source.latestTable}, tables=${result.source.tableCount}, rows=${result.source.totalRows}, size=${result.source.totalSizeGiB} GiB`,
  );
  console.log(
    `target daily: ${result.target.firstTable}..${result.target.latestTable}, tables=${result.target.tableCount}, rows=${result.target.totalRows}, size=${result.target.totalSizeGiB} GiB`,
  );
  console.log(`table_count_matches: ${result.tableCountMatches ? "YES" : "NO"}`);
  console.log(`row_count_matches: ${result.rowCountMatches ? "YES" : "NO"}`);
  console.log(
    `size_bytes_difference: ${result.sizeBytesDifference} (${result.sizeBytesDifferencePct.toFixed(3)}%)`,
  );
  console.log("sample_date_checks:");
  for (const check of result.sampleDateChecks) {
    console.log(`- ${check.tableId}: source=${check.sourceRows}, target=${check.targetRows}, match=${check.match}`);
  }
  if (result.latestPurchaseCheck) {
    const latest = result.latestPurchaseCheck;
    console.log(
      `latest_purchase_check ${latest.tableId}: source rows=${latest.source.rows}, purchase=${latest.source.purchaseEvents}, distinct=${latest.source.distinctTransactionIds}, max=${latest.source.maxEventTimeKst}`,
    );
    console.log(
      `latest_purchase_check ${latest.tableId}: target rows=${latest.target.rows}, purchase=${latest.target.purchaseEvents}, distinct=${latest.target.distinctTransactionIds}, max=${latest.target.maxEventTimeKst}`,
    );
    console.log(`latest_purchase_match: ${latest.match ? "YES" : "NO"}`);
  }
  if (result.missingTargetTables.length > 0) {
    console.log(`missing_target_tables: ${result.missingTargetTables.join(", ")}`);
  }
  if (result.extraTargetTables.length > 0) {
    console.log(`extra_target_tables: ${result.extraTargetTables.join(", ")}`);
  }
  if (result.mismatchedRowTables.length > 0) {
    console.log("mismatched_row_tables:");
    for (const row of result.mismatchedRowTables.slice(0, 30)) {
      console.log(`- ${row.tableId}: source=${row.sourceRows}, target=${row.targetRows}`);
    }
    if (result.mismatchedRowTables.length > 30) {
      console.log(`- ... ${result.mismatchedRowTables.length - 30} more`);
    }
  }
  console.log(`verification_ok: ${result.ok ? "YES" : "NO"}`);
};

const runInitialCopy = async (bq: bigquery_v2.Bigquery, credential: CredentialInfo, json: boolean) => {
  const initial = await buildPlan(bq, credential);
  if (!initial.plan.okToInitialCopy) {
    printPlan(initial.plan, json);
    throw new Error("Plan has mismatches. Initial copy is blocked.");
  }

  if (!initial.plan.targetDataset.exists) {
    console.log(`creating target dataset: ${TARGET_PROJECT}.${TARGET_DATASET} @ ${LOCATION}`);
    await createTargetDataset(bq);
    await sleep(2_000);
  }

  const afterDataset = await buildPlan(bq, credential);
  if (!afterDataset.plan.okToInitialCopy) {
    printPlan(afterDataset.plan, json);
    throw new Error("Plan has mismatches after target dataset check. Initial copy is blocked.");
  }

  const tablesToCopy = afterDataset.plan.actions.copyTables.map((action) => action.tableId);
  printPlan(afterDataset.plan, json);
  if (tablesToCopy.length === 0) {
    console.log("No tables to copy. Target already matches source row_count for all daily tables.");
    return afterDataset.plan;
  }

  console.log(`starting initial copy: ${tablesToCopy.length} table(s), concurrency=${COPY_CONCURRENCY}`);
  await runWithConcurrency(tablesToCopy, COPY_CONCURRENCY, async (tableId) => {
    await copyTable(bq, tableId);
    return tableId;
  });

  const finalPlan = await buildPlan(bq, credential);
  if (finalPlan.plan.mismatches.length > 0 || finalPlan.plan.actions.copyCount > 0) {
    printPlan(finalPlan.plan, json);
    throw new Error("Initial copy finished but final plan still has missing copy actions or mismatches.");
  }

  console.log("initial copy completed");
  printPlan(finalPlan.plan, json);
  return finalPlan.plan;
};

const main = async () => {
  const options = parseArgs();
  if (options.mode === "delta-plan" || options.mode === "delta-copy") {
    throw new Error("Final delta backfill is outside the current TJ approval. Separate approval is required.");
  }

  const { bq, credential } = createBigQueryClient();

  if (options.mode === "plan") {
    const { plan } = await buildPlan(bq, credential);
    printPlan(plan, options.json);
    if (!plan.okToInitialCopy) process.exitCode = 2;
    return;
  }

  if (options.mode === "initial-copy") {
    await runInitialCopy(bq, credential, options.json);
    return;
  }

  if (options.mode === "verify") {
    const verification = await verifyBackfill(bq, credential);
    printVerification(verification, options.json);
    if (!verification.ok) process.exitCode = 2;
  }
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
