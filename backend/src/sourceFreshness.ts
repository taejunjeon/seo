import fs from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";
import dotenv from "dotenv";
import { google, type bigquery_v2 } from "googleapis";
import { Pool } from "pg";

export type SourceFreshnessStatus = "fresh" | "warn" | "stale" | "empty" | "missing" | "error" | "data_sparse";

// 운영자 친화 용어. status → severity 매핑.
export type SourceFreshnessSeverity = "ok" | "watch" | "alert" | "critical";

export type SourceFreshnessResult = {
  source: string;
  storage: "bigquery" | "postgres" | "sqlite";
  table: string;
  status: SourceFreshnessStatus;
  severity: SourceFreshnessSeverity;
  action: string | null;
  totalRows: number | null;
  freshnessAt: string | null;
  freshnessColumn: string | null;
  ageHours: number | null;
  warnHours: number;
  staleHours: number;
  eventMax: Record<string, string | null>;
  syncMax: Record<string, string | null>;
  note: string;
};

export type SourceFreshnessOptions = {
  crmDbPath: string;
  warnHours: number;
  staleHours: number;
};

// 2026-04-20: TJ 승인 stale 기준 v1. 원천별 임계값.
// - Toss/PlayAuto operational: 결제·주문 장부. 실시간성 요구. 24h 주의 / 36h 위험.
// - Imweb local orders: 24h 주의 / 48h 위험.
// - GA4 BigQuery daily export: 48h 주의 / 72h 위험 (구글이 T+24~36h 배포).
// - local mirror (Toss/Imweb 로컬 캐시): 72h 주의 / 120h 위험 (정본 아니라 소음 방지 위해 완화).
// - attribution_ledger: 12h 주의 / 24h 위험. 단 `data_sparse` 는 stale과 분리 판정 필요.
type PerSourceThreshold = { warnHours: number; staleHours: number; action: string };
const PER_SOURCE_THRESHOLDS: Record<string, PerSourceThreshold> = {
  toss_operational: { warnHours: 24, staleHours: 36, action: "Toss 운영 DB 수집 스케줄 확인, tb_sales_toss 적재 경로 점검" },
  playauto_operational: { warnHours: 24, staleHours: 36, action: "PlayAuto 주문 수집 스케줄 점검, tb_playauto_orders 갱신 확인" },
  imweb_local_orders: { warnHours: 24, staleHours: 48, action: "POST /api/crm-local/imweb/sync-orders 재실행 후 imweb_status_synced_at 확인" },
  ga4_bigquery_thecleancoffee: { warnHours: 48, staleHours: 72, action: "GA4 daily export 허들러스에 지연 여부 확인, BigQuery events_* 최신 suffix 점검" },
  ga4_bigquery_biocom: { warnHours: 48, staleHours: 72, action: "허들러스 hurdlers-naver-pay 프로젝트의 biocom raw export 적재 지연 확인. 우리 service account 권한 확보 필요 시 에러로 표시됨" },
  toss_local_transactions: { warnHours: 72, staleHours: 120, action: "Toss 로컬 미러 싱크 스케줄 점검 (정본은 toss_operational)" },
  toss_local_settlements: { warnHours: 72, staleHours: 120, action: "Toss 정산 미러 스케줄 점검 (정본은 toss_operational)" },
  attribution_ledger: { warnHours: 12, staleHours: 24, action: "VM att.ainativeos.net 헬스 체크, webhook·payment_success 이벤트 수신 여부 확인" },
};
// Attribution ledger "저트래픽 예외" 기준:
// MAX(logged_at)만 보면 주문이 적은 새벽에 과한 경고가 날 수 있다.
// 최근 24시간 내 이벤트 개수가 임계 아래면 `data_sparse`로 분리 판정.
const ATTRIBUTION_DATA_SPARSE_MIN_EVENTS_24H = 3;

const resolvePerSourceThresholds = (
  source: string,
  fallback: Pick<SourceFreshnessOptions, "warnHours" | "staleHours">,
): PerSourceThreshold => (
  PER_SOURCE_THRESHOLDS[source] ?? {
    warnHours: fallback.warnHours,
    staleHours: fallback.staleHours,
    action: "기본 임계값 적용. 원천별 임계값 등록 권장.",
  }
);

const statusToSeverity = (status: SourceFreshnessStatus): SourceFreshnessSeverity => {
  switch (status) {
    case "fresh": return "ok";
    case "empty":
    case "data_sparse":
    case "warn": return "watch";
    case "stale": return "alert";
    case "missing":
    case "error": return "critical";
    default: return "watch";
  }
};

const resolveAction = (
  source: string,
  status: SourceFreshnessStatus,
  baseAction: string,
): string | null => {
  if (status === "fresh") return null;
  if (status === "empty") return `${source} 데이터가 비어있음. 수집 경로 확인.`;
  if (status === "data_sparse") return `최근 이벤트 수 적음. 주문 없는 구간인지 수집 장애인지 구분 필요.`;
  if (status === "missing") return `${source} 테이블·원천 연결 자체가 없음. 운영팀 에스컬레이션.`;
  if (status === "error") return `${source} 조회 실패. 에러 메시지 확인.`;
  if (status === "warn") return `추이 모니터링. 악화되면: ${baseAction}`;
  if (status === "stale") return baseAction;
  return null;
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
  sourceProjectId: string;
  jobProjectId?: string;
  dataset: string;
  location?: string;
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
    sourceProjectId: "project-dadba7dd-0229-4ff6-81c",
    dataset: `analytics_${process.env.GA4_COFFEE_PROPERTY_ID?.trim() || "326949178"}`,
    tablePrefix: "events_",
  },
  // biocom raw export 는 허들러스 소유 프로젝트에 있고, job 은 우리 통합 후보 프로젝트에서 생성한다.
  // 허들러스에는 dataset read 권한만 유지하고, query job 권한·비용은 project-dadba7dd 쪽에서 관리한다.
  {
    source: "ga4_bigquery_biocom",
    sourceProjectId: "hurdlers-naver-pay",
    jobProjectId: "project-dadba7dd-0229-4ff6-81c",
    dataset: `analytics_${process.env.GA4_BIOCOM_PROPERTY_ID?.trim() || "304759974"}`,
    location: "asia-northeast3",
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
  thresholds: Pick<PerSourceThreshold, "warnHours" | "staleHours">,
): SourceFreshnessStatus => {
  if (!totalRows) return "empty";
  if (age === null) return "warn";
  if (age >= thresholds.staleHours) return "stale";
  if (age >= thresholds.warnHours) return "warn";
  return "fresh";
};

/**
 * SourceFreshnessResult 생성기 — 모든 브랜치(missing·error·정상)에서 재사용.
 * per-source 임계값·severity·action 자동 반영.
 */
const buildFreshnessResult = (params: {
  source: string;
  storage: SourceFreshnessResult["storage"];
  table: string;
  status: SourceFreshnessStatus;
  totalRows: number | null;
  freshnessAt: string | null;
  freshnessColumn: string | null;
  ageHours: number | null;
  eventMax: Record<string, string | null>;
  syncMax: Record<string, string | null>;
  note: string;
  fallback: Pick<SourceFreshnessOptions, "warnHours" | "staleHours">;
}): SourceFreshnessResult => {
  const threshold = resolvePerSourceThresholds(params.source, params.fallback);
  return {
    source: params.source,
    storage: params.storage,
    table: params.table,
    status: params.status,
    severity: statusToSeverity(params.status),
    action: resolveAction(params.source, params.status, threshold.action),
    totalRows: params.totalRows,
    freshnessAt: params.freshnessAt,
    freshnessColumn: params.freshnessColumn,
    ageHours: params.ageHours,
    warnHours: threshold.warnHours,
    staleHours: threshold.staleHours,
    eventMax: params.eventMax,
    syncMax: params.syncMax,
    note: params.note,
  };
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
  const fallback = { warnHours: options.warnHours, staleHours: options.staleHours };
  const threshold = resolvePerSourceThresholds(config.source, fallback);

  const columns = getSqliteColumns(db, config.table);
  if (!columns) {
    return buildFreshnessResult({
      source: config.source, storage: "sqlite", table: config.table,
      status: "missing", totalRows: null, freshnessAt: null, freshnessColumn: null,
      ageHours: null, eventMax: {}, syncMax: {}, note: "table missing", fallback,
    });
  }

  const eventColumns = config.eventColumns.filter((column) => columns.has(column));
  const syncColumns = config.syncColumns.filter((column) => columns.has(column));
  const selectedColumns = [...eventColumns, ...syncColumns];

  if (selectedColumns.length === 0) {
    return buildFreshnessResult({
      source: config.source, storage: "sqlite", table: config.table,
      status: "missing", totalRows: null, freshnessAt: null, freshnessColumn: null,
      ageHours: null, eventMax: {}, syncMax: {}, note: "freshness columns missing", fallback,
    });
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

  let status = statusFromAge(totalRows, age, threshold);
  let note = "read-only local SQLite";

  // Attribution ledger 저트래픽 예외 (TJ 2026-04-20 승인):
  // "no recent event"와 "source broken"을 분리. 최근 24h 이벤트 개수가 적으면 `data_sparse`로 판정해
  // stale 알람을 띄우지 않음. 실제 수집 장애인지 주문이 없는 구간인지 구분.
  if (config.source === "attribution_ledger" && status === "stale") {
    const sinceIso = new Date(now.getTime() - 24 * 3_600_000).toISOString();
    const recent = db.prepare(
      `SELECT COUNT(*) AS cnt FROM ${quoteIdent(config.table)}
       WHERE logged_at >= ? AND touchpoint IN ('payment_success','checkout_started')`
    ).get(sinceIso) as { cnt: number };
    if (recent.cnt < ATTRIBUTION_DATA_SPARSE_MIN_EVENTS_24H) {
      status = "data_sparse";
      note = `attribution ledger recent 24h events=${recent.cnt} (< ${ATTRIBUTION_DATA_SPARSE_MIN_EVENTS_24H}); 저트래픽 구간일 수 있어 stale 알람 억제`;
    }
  }

  return buildFreshnessResult({
    source: config.source, storage: "sqlite", table: config.table,
    status, totalRows, freshnessAt: freshness.value, freshnessColumn: freshness.column,
    ageHours: age, eventMax, syncMax, note, fallback,
  });
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
  const fallback = { warnHours: options.warnHours, staleHours: options.staleHours };
  const threshold = resolvePerSourceThresholds(config.source, fallback);

  const columns = await getPgColumns(pool, config.table);
  if (!columns) {
    return buildFreshnessResult({
      source: config.source, storage: "postgres", table: config.table,
      status: "missing", totalRows: null, freshnessAt: null, freshnessColumn: null,
      ageHours: null, eventMax: {}, syncMax: {}, note: "table missing", fallback,
    });
  }

  const eventColumns = config.eventColumns.filter((column) => columns.has(column));
  const syncColumns = config.syncColumns.filter((column) => columns.has(column));
  const selectedColumns = [...eventColumns, ...syncColumns];

  if (selectedColumns.length === 0) {
    return buildFreshnessResult({
      source: config.source, storage: "postgres", table: config.table,
      status: "missing", totalRows: null, freshnessAt: null, freshnessColumn: null,
      ageHours: null, eventMax: {}, syncMax: {}, note: "freshness columns missing", fallback,
    });
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
  const status = statusFromAge(totalRows, age, threshold);

  return buildFreshnessResult({
    source: config.source, storage: "postgres", table: config.table,
    status, totalRows, freshnessAt: freshness.value, freshnessColumn: freshness.column,
    ageHours: age, eventMax, syncMax, note: "read-only operational Postgres", fallback,
  });
};

const runBigQuery = async (
  bq: bigquery_v2.Bigquery,
  projectId: string,
  query: string,
  location = "asia-northeast3",
) => {
  const response = await bq.jobs.query({
    projectId,
    requestBody: {
      query,
      useLegacySql: false,
      location,
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
  const fallback = { warnHours: options.warnHours, staleHours: options.staleHours };
  const threshold = resolvePerSourceThresholds(config.source, fallback);
  const jobProjectId = config.jobProjectId ?? config.sourceProjectId;
  const location = config.location ?? "asia-northeast3";

  try {
    await bq.datasets.get({ projectId: config.sourceProjectId, datasetId: config.dataset });
    const tableResponse = await bq.tables.list({
      projectId: config.sourceProjectId,
      datasetId: config.dataset,
      maxResults: 1000,
    });

    const latestTable = (tableResponse.data.tables ?? [])
      .map((table) => table.tableReference?.tableId ?? "")
      .filter((tableId) => new RegExp(`^${config.tablePrefix}\\d{8}$`).test(tableId))
      .sort()
      .at(-1);

    if (!latestTable) {
      return buildFreshnessResult({
        source: config.source, storage: "bigquery",
        table: `${config.sourceProjectId}.${config.dataset}.${config.tablePrefix}*`,
        status: "empty", totalRows: 0, freshnessAt: null, freshnessColumn: null,
        ageHours: null, eventMax: {}, syncMax: {}, note: "no events tables", fallback,
      });
    }

    const suffix = latestTable.slice(config.tablePrefix.length);
    const rows = await runBigQuery(
      bq,
      jobProjectId,
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
        FROM \`${config.sourceProjectId}.${config.dataset}.${config.tablePrefix}*\`
        WHERE _TABLE_SUFFIX = '${suffix}'
      `,
      location,
    );

    const row = rows[0] ?? {};
    const totalRows = parseCount(row.total_events);
    const freshnessAt = String(row.max_event_time_kst ?? "") || null;
    const age = ageHours(freshnessAt, now);
    const purchaseEvents = parseCount(row.purchase_events);
    const distinctPurchaseTransactionIds = parseCount(row.distinct_purchase_transaction_ids);

    return buildFreshnessResult({
      source: config.source, storage: "bigquery",
      table: `${config.sourceProjectId}.${config.dataset}.${latestTable}`,
      status: statusFromAge(totalRows, age, threshold),
      totalRows, freshnessAt, freshnessColumn: "event_timestamp",
      ageHours: age, eventMax: { event_timestamp: freshnessAt }, syncMax: {},
      note: `latest table ${latestTable}; job project ${jobProjectId}; purchase ${purchaseEvents ?? 0}; distinct txn ${distinctPurchaseTransactionIds ?? 0}`,
      fallback,
    });
  } catch (error) {
    return buildFreshnessResult({
      source: config.source, storage: "bigquery",
      table: `${config.sourceProjectId}.${config.dataset}.${config.tablePrefix}*`,
      status: "error", totalRows: null, freshnessAt: null, freshnessColumn: null,
      ageHours: null, eventMax: {}, syncMax: {},
      note: error instanceof Error ? error.message : String(error), fallback,
    });
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
      results.push(buildFreshnessResult({
        source: source.source, storage: "sqlite", table: source.table,
        status: "missing", totalRows: null, freshnessAt: null, freshnessColumn: null,
        ageHours: null, eventMax: {}, syncMax: {},
        note: `crm db missing: ${options.crmDbPath}`,
        fallback: { warnHours: options.warnHours, staleHours: options.staleHours },
      }));
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
      results.push(buildFreshnessResult({
        source: source.source, storage: "bigquery",
        table: `${source.sourceProjectId}.${source.dataset}.${source.tablePrefix}*`,
        status: "missing", totalRows: null, freshnessAt: null, freshnessColumn: null,
        ageHours: null, eventMax: {}, syncMax: {},
        note: "GA4 service account key missing",
        fallback: { warnHours: options.warnHours, staleHours: options.staleHours },
      }));
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
        results.push(buildFreshnessResult({
          source: source.source, storage: "postgres", table: source.table,
          status: "error", totalRows: null, freshnessAt: null, freshnessColumn: null,
          ageHours: null, eventMax: {}, syncMax: {}, note,
          fallback: { warnHours: options.warnHours, staleHours: options.staleHours },
        }));
      }
    } finally {
      await pool.end();
    }
  } else {
    for (const source of PG_SOURCES) {
      results.push(buildFreshnessResult({
        source: source.source, storage: "postgres", table: source.table,
        status: "missing", totalRows: null, freshnessAt: null, freshnessColumn: null,
        ageHours: null, eventMax: {}, syncMax: {}, note: "DATABASE_URL missing",
        fallback: { warnHours: options.warnHours, staleHours: options.staleHours },
      }));
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
