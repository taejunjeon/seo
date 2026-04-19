import fs from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";
import dotenv from "dotenv";
import { google, type bigquery_v2 } from "googleapis";
import { Pool } from "pg";

export type SourceFreshnessStatus = "fresh" | "warn" | "stale" | "empty" | "missing" | "error";

export type SourceFreshnessResult = {
  source: string;
  storage: "bigquery" | "postgres" | "sqlite";
  table: string;
  status: SourceFreshnessStatus;
  totalRows: number | null;
  freshnessAt: string | null;
  freshnessColumn: string | null;
  ageHours: number | null;
  eventMax: Record<string, string | null>;
  syncMax: Record<string, string | null>;
  note: string;
};

export type SourceFreshnessOptions = {
  crmDbPath: string;
  warnHours: number;
  staleHours: number;
};

type SqliteSourceConfig = {
  source: string;
  table: string;
  eventColumns: string[];
  syncColumns: string[];
};

type PgSourceConfig = SqliteSourceConfig;

type BigQuerySourceConfig = {
  source: string;
  projectId: string;
  dataset: string;
  tablePrefix: string;
};

const backendRoot = path.resolve(__dirname, "..");
dotenv.config({ path: path.join(backendRoot, ".env"), quiet: true });

export const DEFAULT_CRM_DB_PATH = path.join(backendRoot, "data", "crm.sqlite3");

export const getDefaultSourceFreshnessOptions = (
  overrides: Partial<SourceFreshnessOptions> = {},
): SourceFreshnessOptions => ({
  crmDbPath: overrides.crmDbPath ?? process.env.CRM_LOCAL_DB_PATH?.trim() ?? DEFAULT_CRM_DB_PATH,
  warnHours: overrides.warnHours ?? 36,
  staleHours: overrides.staleHours ?? 72,
});

const PG_SOURCES: PgSourceConfig[] = [
  {
    source: "toss_operational",
    table: "tb_sales_toss",
    eventColumns: ["approved_at", "sold_date", "sales_month"],
    syncColumns: ["synced_at", "updated_at", "created_at"],
  },
  {
    source: "playauto_operational",
    table: "tb_playauto_orders",
    eventColumns: ["ord_time", "pay_time"],
    syncColumns: ["synced_at", "updated_at", "created_at"],
  },
];

const SQLITE_SOURCES: SqliteSourceConfig[] = [
  {
    source: "toss_local_transactions",
    table: "toss_transactions",
    eventColumns: ["transaction_at"],
    syncColumns: ["synced_at"],
  },
  {
    source: "toss_local_settlements",
    table: "toss_settlements",
    eventColumns: ["approved_at", "sold_date", "paid_out_date"],
    syncColumns: ["synced_at"],
  },
  {
    source: "imweb_local_orders",
    table: "imweb_orders",
    eventColumns: ["order_time", "complete_time"],
    syncColumns: ["synced_at", "imweb_status_synced_at"],
  },
  {
    source: "attribution_ledger",
    table: "attribution_ledger",
    eventColumns: ["logged_at", "approved_at"],
    syncColumns: ["created_at"],
  },
];

const BIGQUERY_SOURCES: BigQuerySourceConfig[] = [
  {
    source: "ga4_bigquery_thecleancoffee",
    projectId: "project-dadba7dd-0229-4ff6-81c",
    dataset: `analytics_${process.env.GA4_COFFEE_PROPERTY_ID?.trim() || "326949178"}`,
    tablePrefix: "events_",
  },
];

const quoteIdent = (value: string) => `"${value.replaceAll('"', '""')}"`;

const parseCount = (value: unknown): number | null => {
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string" && value.trim()) return Number(value);
  return null;
};

const parseTimestamp = (value: string | null): Date | null => {
  if (!value) return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const numeric = Number(trimmed);
  if (/^\d{10}$/.test(trimmed) && Number.isFinite(numeric)) {
    return new Date(numeric * 1000);
  }
  if (/^\d{13}$/.test(trimmed) && Number.isFinite(numeric)) {
    return new Date(numeric);
  }

  const normalized = trimmed.includes(" ") ? trimmed.replace(" ", "T") : trimmed;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const parseJsonCredentials = () => {
  const rawKey = process.env.GA4_SERVICE_ACCOUNT_KEY || process.env.GA4_BIOCOM_SERVICE_ACCOUNT_KEY;
  if (!rawKey?.trim()) return null;
  return JSON.parse(rawKey) as { client_email: string; private_key: string };
};

const ageHours = (value: string | null, now: Date) => {
  const parsed = parseTimestamp(value);
  if (!parsed) return null;
  return Math.max(0, Math.round(((now.getTime() - parsed.getTime()) / 3_600_000) * 10) / 10);
};

const statusFromAge = (
  totalRows: number | null,
  age: number | null,
  options: Pick<SourceFreshnessOptions, "warnHours" | "staleHours">,
): SourceFreshnessStatus => {
  if (!totalRows) return "empty";
  if (age === null) return "warn";
  if (age >= options.staleHours) return "stale";
  if (age >= options.warnHours) return "warn";
  return "fresh";
};

const pickFreshness = (
  eventMax: Record<string, string | null>,
  syncMax: Record<string, string | null>,
) => {
  const candidates = [
    ...Object.entries(syncMax).map(([column, value]) => ({ column, value, priority: 1 })),
    ...Object.entries(eventMax).map(([column, value]) => ({ column, value, priority: 2 })),
  ].filter((item) => item.value && parseTimestamp(item.value));

  candidates.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return (parseTimestamp(b.value)?.getTime() ?? 0) - (parseTimestamp(a.value)?.getTime() ?? 0);
  });

  return candidates[0] ?? { column: null, value: null };
};

const buildSelect = (columns: string[]) =>
  columns
    .map((column) => `MAX(NULLIF(CAST(${quoteIdent(column)} AS TEXT), '')) AS ${quoteIdent(column)}`)
    .join(",\n       ");

const getSqliteColumns = (db: Database.Database, table: string) => {
  const exists = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?")
    .get(table) as { name?: string } | undefined;
  if (!exists) return null;

  const rows = db.prepare(`PRAGMA table_info(${quoteIdent(table)})`).all() as Array<{ name: string }>;
  return new Set(rows.map((row) => row.name));
};

const checkSqliteSource = (
  db: Database.Database,
  config: SqliteSourceConfig,
  options: SourceFreshnessOptions,
  now: Date,
): SourceFreshnessResult => {
  const columns = getSqliteColumns(db, config.table);
  if (!columns) {
    return {
      source: config.source,
      storage: "sqlite",
      table: config.table,
      status: "missing",
      totalRows: null,
      freshnessAt: null,
      freshnessColumn: null,
      ageHours: null,
      eventMax: {},
      syncMax: {},
      note: "table missing",
    };
  }

  const eventColumns = config.eventColumns.filter((column) => columns.has(column));
  const syncColumns = config.syncColumns.filter((column) => columns.has(column));
  const selectedColumns = [...eventColumns, ...syncColumns];

  if (selectedColumns.length === 0) {
    return {
      source: config.source,
      storage: "sqlite",
      table: config.table,
      status: "missing",
      totalRows: null,
      freshnessAt: null,
      freshnessColumn: null,
      ageHours: null,
      eventMax: {},
      syncMax: {},
      note: "freshness columns missing",
    };
  }

  const row = db
    .prepare(`
      SELECT COUNT(*) AS total_rows,
             ${buildSelect(selectedColumns)}
      FROM ${quoteIdent(config.table)}
    `)
    .get() as Record<string, unknown>;

  const eventMax = Object.fromEntries(eventColumns.map((column) => [column, String(row[column] ?? "") || null]));
  const syncMax = Object.fromEntries(syncColumns.map((column) => [column, String(row[column] ?? "") || null]));
  const freshness = pickFreshness(eventMax, syncMax);
  const totalRows = parseCount(row.total_rows);
  const age = ageHours(freshness.value, now);

  return {
    source: config.source,
    storage: "sqlite",
    table: config.table,
    status: statusFromAge(totalRows, age, options),
    totalRows,
    freshnessAt: freshness.value,
    freshnessColumn: freshness.column,
    ageHours: age,
    eventMax,
    syncMax,
    note: "read-only local SQLite",
  };
};

const getPgColumns = async (pool: Pool, table: string) => {
  const result = await pool.query<{ column_name: string }>(
    `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
    `,
    [table],
  );

  if (result.rows.length === 0) return null;
  return new Set(result.rows.map((row) => row.column_name));
};

const checkPgSource = async (
  pool: Pool,
  config: PgSourceConfig,
  options: SourceFreshnessOptions,
  now: Date,
): Promise<SourceFreshnessResult> => {
  const columns = await getPgColumns(pool, config.table);
  if (!columns) {
    return {
      source: config.source,
      storage: "postgres",
      table: config.table,
      status: "missing",
      totalRows: null,
      freshnessAt: null,
      freshnessColumn: null,
      ageHours: null,
      eventMax: {},
      syncMax: {},
      note: "table missing",
    };
  }

  const eventColumns = config.eventColumns.filter((column) => columns.has(column));
  const syncColumns = config.syncColumns.filter((column) => columns.has(column));
  const selectedColumns = [...eventColumns, ...syncColumns];

  if (selectedColumns.length === 0) {
    return {
      source: config.source,
      storage: "postgres",
      table: config.table,
      status: "missing",
      totalRows: null,
      freshnessAt: null,
      freshnessColumn: null,
      ageHours: null,
      eventMax: {},
      syncMax: {},
      note: "freshness columns missing",
    };
  }

  const result = await pool.query<Record<string, unknown>>(`
    SELECT COUNT(*)::text AS total_rows,
           ${buildSelect(selectedColumns)}
    FROM public.${quoteIdent(config.table)}
  `);

  const row = result.rows[0] ?? {};
  const eventMax = Object.fromEntries(eventColumns.map((column) => [column, String(row[column] ?? "") || null]));
  const syncMax = Object.fromEntries(syncColumns.map((column) => [column, String(row[column] ?? "") || null]));
  const freshness = pickFreshness(eventMax, syncMax);
  const totalRows = parseCount(row.total_rows);
  const age = ageHours(freshness.value, now);

  return {
    source: config.source,
    storage: "postgres",
    table: config.table,
    status: statusFromAge(totalRows, age, options),
    totalRows,
    freshnessAt: freshness.value,
    freshnessColumn: freshness.column,
    ageHours: age,
    eventMax,
    syncMax,
    note: "read-only operational Postgres",
  };
};

const runBigQuery = async (
  bq: bigquery_v2.Bigquery,
  projectId: string,
  query: string,
) => {
  const response = await bq.jobs.query({
    projectId,
    requestBody: {
      query,
      useLegacySql: false,
      location: "asia-northeast3",
      timeoutMs: 30_000,
    },
  });

  const fields = response.data.schema?.fields ?? [];
  return (response.data.rows ?? []).map((row) =>
    Object.fromEntries((row.f ?? []).map((cell, index) => [fields[index]?.name ?? String(index), cell.v])),
  ) as Array<Record<string, unknown>>;
};

const checkBigQuerySource = async (
  bq: bigquery_v2.Bigquery,
  config: BigQuerySourceConfig,
  options: SourceFreshnessOptions,
  now: Date,
): Promise<SourceFreshnessResult> => {
  try {
    await bq.datasets.get({ projectId: config.projectId, datasetId: config.dataset });
    const tableResponse = await bq.tables.list({
      projectId: config.projectId,
      datasetId: config.dataset,
      maxResults: 1000,
    });

    const latestTable = (tableResponse.data.tables ?? [])
      .map((table) => table.tableReference?.tableId ?? "")
      .filter((tableId) => new RegExp(`^${config.tablePrefix}\\d{8}$`).test(tableId))
      .sort()
      .at(-1);

    if (!latestTable) {
      return {
        source: config.source,
        storage: "bigquery",
        table: `${config.projectId}.${config.dataset}.${config.tablePrefix}*`,
        status: "empty",
        totalRows: 0,
        freshnessAt: null,
        freshnessColumn: null,
        ageHours: null,
        eventMax: {},
        syncMax: {},
        note: "no events tables",
      };
    }

    const suffix = latestTable.slice(config.tablePrefix.length);
    const rows = await runBigQuery(
      bq,
      config.projectId,
      `
        SELECT
          COUNT(*) AS total_events,
          COUNTIF(event_name = 'purchase') AS purchase_events,
          COUNT(DISTINCT IF(event_name = 'purchase', (
            SELECT ep.value.string_value
            FROM UNNEST(event_params) ep
            WHERE ep.key = 'transaction_id'
          ), NULL)) AS distinct_purchase_transaction_ids,
          FORMAT_TIMESTAMP('%FT%T%Ez', MAX(TIMESTAMP_MICROS(event_timestamp)), 'Asia/Seoul') AS max_event_time_kst
        FROM \`${config.projectId}.${config.dataset}.${config.tablePrefix}*\`
        WHERE _TABLE_SUFFIX = '${suffix}'
      `,
    );

    const row = rows[0] ?? {};
    const totalRows = parseCount(row.total_events);
    const freshnessAt = String(row.max_event_time_kst ?? "") || null;
    const age = ageHours(freshnessAt, now);
    const purchaseEvents = parseCount(row.purchase_events);
    const distinctPurchaseTransactionIds = parseCount(row.distinct_purchase_transaction_ids);

    return {
      source: config.source,
      storage: "bigquery",
      table: `${config.projectId}.${config.dataset}.${latestTable}`,
      status: statusFromAge(totalRows, age, options),
      totalRows,
      freshnessAt,
      freshnessColumn: "event_timestamp",
      ageHours: age,
      eventMax: { event_timestamp: freshnessAt },
      syncMax: {},
      note: `latest table ${latestTable}; purchase ${purchaseEvents ?? 0}; distinct txn ${distinctPurchaseTransactionIds ?? 0}`,
    };
  } catch (error) {
    return {
      source: config.source,
      storage: "bigquery",
      table: `${config.projectId}.${config.dataset}.${config.tablePrefix}*`,
      status: "error",
      totalRows: null,
      freshnessAt: null,
      freshnessColumn: null,
      ageHours: null,
      eventMax: {},
      syncMax: {},
      note: error instanceof Error ? error.message : String(error),
    };
  }
};

export const collectSourceFreshness = async (
  options: SourceFreshnessOptions = getDefaultSourceFreshnessOptions(),
  now = new Date(),
) => {
  const results: SourceFreshnessResult[] = [];

  if (fs.existsSync(options.crmDbPath)) {
    const db = new Database(options.crmDbPath, { readonly: true, fileMustExist: true });
    try {
      for (const source of SQLITE_SOURCES) {
        results.push(checkSqliteSource(db, source, options, now));
      }
    } finally {
      db.close();
    }
  } else {
    for (const source of SQLITE_SOURCES) {
      results.push({
        source: source.source,
        storage: "sqlite",
        table: source.table,
        status: "missing",
        totalRows: null,
        freshnessAt: null,
        freshnessColumn: null,
        ageHours: null,
        eventMax: {},
        syncMax: {},
        note: `crm db missing: ${options.crmDbPath}`,
      });
    }
  }

  const credentials = parseJsonCredentials();
  if (credentials) {
    const auth = new google.auth.JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: [
        "https://www.googleapis.com/auth/bigquery.readonly",
        "https://www.googleapis.com/auth/cloud-platform.read-only",
      ],
    });
    const bq = google.bigquery({ version: "v2", auth });
    for (const source of BIGQUERY_SOURCES) {
      results.push(await checkBigQuerySource(bq, source, options, now));
    }
  } else {
    for (const source of BIGQUERY_SOURCES) {
      results.push({
        source: source.source,
        storage: "bigquery",
        table: `${source.projectId}.${source.dataset}.${source.tablePrefix}*`,
        status: "missing",
        totalRows: null,
        freshnessAt: null,
        freshnessColumn: null,
        ageHours: null,
        eventMax: {},
        syncMax: {},
        note: "GA4 service account key missing",
      });
    }
  }

  const databaseUrl = process.env.DATABASE_URL?.replace(/^postgresql\+asyncpg:\/\//, "postgresql://");
  if (databaseUrl) {
    const pool = new Pool({ connectionString: databaseUrl, max: 1 });
    try {
      for (const source of PG_SOURCES) {
        results.push(await checkPgSource(pool, source, options, now));
      }
    } catch (error) {
      const note = error instanceof Error ? error.message : String(error);
      for (const source of PG_SOURCES) {
        if (results.some((result) => result.source === source.source)) continue;
        results.push({
          source: source.source,
          storage: "postgres",
          table: source.table,
          status: "error",
          totalRows: null,
          freshnessAt: null,
          freshnessColumn: null,
          ageHours: null,
          eventMax: {},
          syncMax: {},
          note,
        });
      }
    } finally {
      await pool.end();
    }
  } else {
    for (const source of PG_SOURCES) {
      results.push({
        source: source.source,
        storage: "postgres",
        table: source.table,
        status: "missing",
        totalRows: null,
        freshnessAt: null,
        freshnessColumn: null,
        ageHours: null,
        eventMax: {},
        syncMax: {},
        note: "DATABASE_URL missing",
      });
    }
  }

  return { checkedAt: now.toISOString(), options, results };
};

const formatNumber = (value: number | null) => (value === null ? "-" : value.toLocaleString("ko-KR"));

const formatAge = (value: number | null) => (value === null ? "-" : `${value}h`);

export const printSourceFreshnessMarkdown = (
  payload: Awaited<ReturnType<typeof collectSourceFreshness>>,
) => {
  console.log(`# Source Freshness Check`);
  console.log("");
  console.log(`- checked_at: ${payload.checkedAt}`);
  console.log(`- warn_hours: ${payload.options.warnHours}`);
  console.log(`- stale_hours: ${payload.options.staleHours}`);
  console.log(`- crm_db: ${payload.options.crmDbPath}`);
  console.log("");
  console.log("| source | status | rows | freshness_at | age | storage.table | note |");
  console.log("|---|---:|---:|---|---:|---|---|");
  for (const result of payload.results) {
    const table = `${result.storage}.${result.table}`;
    const freshness = result.freshnessAt
      ? `${result.freshnessAt}${result.freshnessColumn ? ` (${result.freshnessColumn})` : ""}`
      : "-";
    console.log(
      `| ${result.source} | ${result.status} | ${formatNumber(result.totalRows)} | ${freshness} | ${formatAge(result.ageHours)} | ${table} | ${result.note} |`,
    );
  }
};
