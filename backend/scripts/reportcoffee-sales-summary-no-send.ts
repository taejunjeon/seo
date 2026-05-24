import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

import Database from "better-sqlite3";
import dotenv from "dotenv";

import type { CoupangAccount, CoupangOrderSheet } from "../src/coupangClient";

dotenv.config({ path: path.resolve(__dirname, "..", ".env"), quiet: true });
dotenv.config({ path: path.resolve(__dirname, "..", ".env.local"), quiet: true });

type WindowKey = "weekly" | "month_to_date" | "rolling_30d";

type WindowSpec = {
  key: WindowKey;
  label: string;
  startDate: string;
  endDateInclusive: string;
  endDateExclusive: string;
  startUtc: string;
  endExclusiveUtc: string;
};

type CliOptions = {
  asOfDate: string;
  site: string;
  npayDbPath: string;
  npaySshHost?: string;
  npayRemoteDbPath: string;
  reportDir: string;
  outputPath?: string;
  topProducts: number;
  adSpendSource: "api" | "skip";
  adSpendApiBase: string;
  adSpendForce: boolean;
  coupangSettlementDbPath: string;
  coupangSettlementSource: "local" | "skip";
  coupangSource: "snapshot" | "api" | "skip";
  coupangRevenueHistorySource: "api" | "skip";
  coupangAccount: CoupangAccount;
  coupangStatuses: string[];
  coupangDelayMs: number;
};

type AggregateRow = {
  count: number;
  amount_krw: number;
  max_order_time: string | null;
  max_complete_time: string | null;
  max_synced_at: string | null;
  max_status_synced_at: string | null;
};

type RemoteFreshnessRow = {
  count: number;
  amount_krw: number;
  max_order_time: string | null;
  max_synced_at: string | null;
  max_status_synced_at: string | null;
};

type RemoteNpayWindowRow = {
  actual_count: number;
  actual_amount_krw: number;
  actual_max_order_time: string | null;
  actual_max_synced_at: string | null;
  actual_max_status_synced_at: string | null;
  gross_count: number;
  gross_amount_krw: number;
  gross_max_order_time: string | null;
  excluded_count: number;
  excluded_amount_krw: number;
  status_blank_count: number;
  status_blank_amount_krw: number;
  complete_time_legacy_count: number;
  complete_time_legacy_amount_krw: number;
  bridge_pending_count: number;
  bridge_pending_amount_krw: number;
};

type TossRow = {
  rows: string;
  total_amount_krw: string | null;
  cancel_amount_krw: string | null;
  net_amount_krw: string | null;
  balance_amount_krw: string | null;
  min_approved_at: string | null;
  max_approved_at: string | null;
};

type SmartstoreProductRow = {
  product_name: string;
  option_name: string;
  ord_status: string;
  rows: string;
  quantity: string;
  amount_krw: string;
};

type SmartstoreStatusRow = {
  ord_status: string;
  rows: string;
  quantity: string;
  amount_krw: string;
  min_time: string | null;
  max_time: string | null;
};

type ProductBucket = {
  rank?: number;
  product_name: string;
  rows: number;
  quantity: number;
  amount_krw: number;
  option_count?: number;
  option_examples?: string[];
};

type CoupangSnapshot = {
  source?: Record<string, unknown>;
  window?: {
    timezone?: string;
    start_date?: string;
    end_date_inclusive?: string;
  };
  totals?: {
    order_sheets?: number;
    items?: number;
    quantity?: number;
    amount_krw?: number;
  };
  product_classification?: Record<string, {
    items?: number;
    quantity?: number;
    amount_krw?: number;
  }>;
  top_products?: Array<{
    name?: string;
    items?: number;
    quantity?: number;
    amount_krw?: number;
  }>;
  api?: {
    calls?: number;
    error_count?: number;
  };
  confidence?: string;
};

type CoupangBucket = {
  order_sheets: number;
  items: number;
  quantity: number;
  amount_krw: number;
};

type CoupangProductBucket = {
  product_name: string;
  items: number;
  quantity: number;
  amount_krw: number;
};

type CoupangProductClassBucket = {
  items: number;
  quantity: number;
  amount_krw: number;
};

type CoupangRevenueHistoryProductClassBucket = {
  rows: number;
  items: number;
  quantity: number;
  sale_amount_krw: number;
  settlement_amount_krw: number;
};

type CoupangRevenueHistoryProductBucket = {
  product_name: string;
  items: number;
  quantity: number;
  sale_amount_krw: number;
  settlement_amount_krw: number;
};

type CoupangOrderItem = NonNullable<CoupangOrderSheet["orderItems"]>[number] & {
  sellerProductName?: string;
  sellerProductItemName?: string;
  firstSellerProductItemName?: string;
  vendorItemName?: string;
  vendorItemPackageName?: string;
};

type MetaSiteSummaryResponse = {
  ok?: boolean;
  start_date?: string;
  end_date?: string;
  date_preset?: string | null;
  sites?: Array<{
    site?: string;
    spend?: number;
    impressions?: number;
    clicks?: number;
    purchases?: number;
    metaPurchaseValue?: number;
    confirmedRevenue?: number;
    confirmedRoas?: number | null;
    siteConfirmedRevenue?: number;
    siteConfirmedOrders?: number;
    metaError?: string | null;
  }>;
  cache?: Record<string, unknown>;
};

type LocalCoupangSettlementFreshnessRow = {
  rows: number;
  total_sale: number;
  final_amount: number;
  min_from: string | null;
  max_to: string | null;
  max_settlement_date: string | null;
  max_synced_at: string | null;
};

type LocalCoupangSettlementWindowRow = {
  rows: number;
  total_sale: number;
  final_amount: number;
  min_from: string | null;
  max_to: string | null;
};

type LocalCoupangSettlementMonthRow = {
  recognition_year_month: string;
  rows: number;
  total_sale: number;
  final_amount: number;
  min_from: string | null;
  max_to: string | null;
  max_settlement_date: string | null;
};

type OperationalCoupangMonthRow = {
  sales_month: string;
  channel: string;
  project: string;
  rows: string;
  net_amount_krw: string | null;
  min_date: string | null;
  max_date: string | null;
  max_uploaded_at: string | null;
};

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const EXCLUDED_IMWEB_STATUS = ["CANCEL", "RETURN", "EXCHANGE"];
const DEFAULT_COUPANG_STATUSES = [
  "ACCEPT",
  "INSTRUCT",
  "DEPARTURE",
  "DELIVERING",
  "FINAL_DELIVERY",
  "NONE_TRACKING",
];
const COUPANG_SNAPSHOT_FILES: Record<WindowKey, string> = {
  weekly: "reportcoffee-coupang-teamketo-ordersheets-weekly-smoke-20260522.json",
  month_to_date: "reportcoffee-coupang-teamketo-ordersheets-month-to-date-20260522.json",
  rolling_30d: "reportcoffee-coupang-teamketo-ordersheets-rolling-30d-20260522.json",
};

function parseArgs(argv: string[]): Record<string, string | boolean> {
  const args: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const body = token.slice(2);
    const eqIndex = body.indexOf("=");
    if (eqIndex >= 0) {
      args[body.slice(0, eqIndex)] = body.slice(eqIndex + 1);
      continue;
    }
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      args[body] = next;
      i += 1;
    } else {
      args[body] = true;
    }
  }
  return args;
}

function assertDate(value: string, label: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${label} must be YYYY-MM-DD`);
  }
  return value;
}

function asInt(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : fallback;
}

function asNonNegativeInt(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : fallback;
}

function shiftKstDate(date: string, deltaDays: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + deltaDays));
  return [
    shifted.getUTCFullYear(),
    String(shifted.getUTCMonth() + 1).padStart(2, "0"),
    String(shifted.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function monthStart(date: string): string {
  return `${date.slice(0, 8)}01`;
}

function getPreviousKstDate(): string {
  const nowKst = new Date(Date.now() + KST_OFFSET_MS);
  const todayKstUtc = Date.UTC(
    nowKst.getUTCFullYear(),
    nowKst.getUTCMonth(),
    nowKst.getUTCDate(),
  );
  const previous = new Date(todayKstUtc - ONE_DAY_MS);
  return [
    previous.getUTCFullYear(),
    String(previous.getUTCMonth() + 1).padStart(2, "0"),
    String(previous.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function kstDateStartToUtcIso(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day) - KST_OFFSET_MS).toISOString();
}

function buildWindows(asOfDate: string): WindowSpec[] {
  const endDateExclusive = shiftKstDate(asOfDate, 1);
  const specs: Array<Omit<WindowSpec, "startUtc" | "endExclusiveUtc">> = [
    {
      key: "weekly",
      label: "최근 완료 7일",
      startDate: shiftKstDate(asOfDate, -6),
      endDateInclusive: asOfDate,
      endDateExclusive,
    },
    {
      key: "month_to_date",
      label: "월초-기준일",
      startDate: monthStart(asOfDate),
      endDateInclusive: asOfDate,
      endDateExclusive,
    },
    {
      key: "rolling_30d",
      label: "최근 완료 30일",
      startDate: shiftKstDate(asOfDate, -29),
      endDateInclusive: asOfDate,
      endDateExclusive,
    },
  ];

  return specs.map((spec) => ({
    ...spec,
    startUtc: kstDateStartToUtcIso(spec.startDate),
    endExclusiveUtc: kstDateStartToUtcIso(spec.endDateExclusive),
  }));
}

function getOptions(): CliOptions {
  const args = parseArgs(process.argv.slice(2));
  const backendRoot = path.resolve(__dirname, "..");
  const repoRoot = path.resolve(backendRoot, "..");
  const adSpendSourceRaw = String(args["ad-spend-source"] ?? "api");
  if (adSpendSourceRaw !== "api" && adSpendSourceRaw !== "skip") {
    throw new Error("--ad-spend-source must be api or skip");
  }
  const coupangSettlementSourceRaw = String(args["coupang-settlement-source"] ?? "local");
  if (coupangSettlementSourceRaw !== "local" && coupangSettlementSourceRaw !== "skip") {
    throw new Error("--coupang-settlement-source must be local or skip");
  }
  const coupangSourceRaw = String(args["coupang-source"] ?? "snapshot");
  if (coupangSourceRaw !== "snapshot" && coupangSourceRaw !== "api" && coupangSourceRaw !== "skip") {
    throw new Error("--coupang-source must be snapshot, api, or skip");
  }
  const coupangRevenueHistorySourceRaw = String(args["coupang-revenue-history-source"] ?? "api");
  if (coupangRevenueHistorySourceRaw !== "api" && coupangRevenueHistorySourceRaw !== "skip") {
    throw new Error("--coupang-revenue-history-source must be api or skip");
  }
  const coupangAccount = String(args["coupang-account"] ?? "teamketo") as CoupangAccount;
  if (coupangAccount !== "teamketo" && coupangAccount !== "biocom") {
    throw new Error("--coupang-account must be teamketo or biocom");
  }
  const coupangStatuses = String(args["coupang-statuses"] ?? DEFAULT_COUPANG_STATUSES.join(","))
    .split(",")
    .map((status) => status.trim())
    .filter(Boolean);

  return {
    asOfDate: assertDate(String(args["as-of"] ?? args.asOf ?? getPreviousKstDate()), "--as-of"),
    site: String(args.site ?? "thecleancoffee"),
    npayDbPath: String(
      args["npay-db"] ??
        args.db ??
        process.env.CRM_LOCAL_DB_PATH ??
        path.join(backendRoot, "data", "crm.sqlite3"),
    ),
    npaySshHost: args["npay-ssh"] ? String(args["npay-ssh"]) : undefined,
    npayRemoteDbPath: String(
      args["npay-remote-db"] ??
        "/home/biocomkr_sns/seo/repo/backend/data/crm.sqlite3",
    ),
    reportDir: String(args["report-dir"] ?? path.join(repoRoot, "report")),
    outputPath: args.out ? String(args.out) : undefined,
    topProducts: Math.max(1, Math.min(20, asInt(args.top ?? args["top-products"], 3))),
    adSpendSource: adSpendSourceRaw,
    adSpendApiBase: String(args["ad-spend-api-base"] ?? "https://att.ainativeos.net"),
    adSpendForce: args["ad-spend-force"] !== "0" && args["ad-spend-force"] !== "false",
    coupangSettlementDbPath: String(
      args["coupang-settlement-db"] ??
        args["npay-db"] ??
        args.db ??
        process.env.CRM_LOCAL_DB_PATH ??
        path.join(backendRoot, "data", "crm.sqlite3"),
    ),
    coupangSettlementSource: coupangSettlementSourceRaw,
    coupangSource: coupangSourceRaw,
    coupangRevenueHistorySource: coupangRevenueHistorySourceRaw,
    coupangAccount,
    coupangStatuses,
    coupangDelayMs: asNonNegativeInt(args["coupang-delay-ms"] ?? args.coupangDelayMs, 250),
  };
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

function sqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function toNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.round(parsed) : 0;
}

function krw(value: number): string {
  return `${value.toLocaleString("ko-KR")}원`;
}

function percent(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 10000) / 100;
}

function tableExists(db: Database.Database, tableName: string): boolean {
  const row = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ? LIMIT 1")
    .get(tableName) as { name?: string } | undefined;
  return row?.name === tableName;
}

function aggregateSqlite(db: Database.Database, whereSql: string, params: Record<string, string>): AggregateRow {
  const row = db
    .prepare(
      `
      SELECT
        COUNT(*) AS count,
        COALESCE(SUM(COALESCE(payment_amount, 0)), 0) AS amount_krw,
        MAX(order_time) AS max_order_time,
        MAX(complete_time) AS max_complete_time,
        MAX(synced_at) AS max_synced_at,
        MAX(imweb_status_synced_at) AS max_status_synced_at
      FROM imweb_orders
      WHERE ${whereSql}
      `,
    )
    .get(params) as Partial<AggregateRow> | undefined;

  return {
    count: Number(row?.count ?? 0),
    amount_krw: Number(row?.amount_krw ?? 0),
    max_order_time: row?.max_order_time ?? null,
    max_complete_time: row?.max_complete_time ?? null,
    max_synced_at: row?.max_synced_at ?? null,
    max_status_synced_at: row?.max_status_synced_at ?? null,
  };
}

function runRemoteSqliteJson<TRow>(host: string, dbPath: string, sql: string): TRow {
  const remoteCommand = [
    "sudo -n -u biocomkr_sns",
    "sqlite3",
    "-readonly",
    shellQuote(dbPath),
    "-json",
    shellQuote(sql),
  ].join(" ");
  const output = execFileSync("ssh", [
    "-o",
    "BatchMode=yes",
    "-o",
    "ConnectTimeout=10",
    host,
    remoteCommand,
  ], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  const parsed = JSON.parse(output) as TRow[];
  if (!parsed[0]) {
    throw new Error("remote sqlite returned no rows");
  }
  return parsed[0];
}

function buildRemoteNpayWindows(options: CliOptions, windows: WindowSpec[]) {
  const host = options.npaySshHost;
  if (!host) return null;

  const siteSql = sqlString(options.site);
  const freshnessSql = `
    SELECT
      COUNT(*) AS count,
      COALESCE(SUM(COALESCE(payment_amount, 0)), 0) AS amount_krw,
      MAX(order_time) AS max_order_time,
      MAX(synced_at) AS max_synced_at,
      MAX(imweb_status_synced_at) AS max_status_synced_at
    FROM imweb_orders
    WHERE site = ${siteSql}
      AND LOWER(COALESCE(pay_type, '')) = 'npay'
      AND COALESCE(payment_amount, 0) > 0
  `;
  const sourceFreshness = runRemoteSqliteJson<RemoteFreshnessRow>(
    host,
    options.npayRemoteDbPath,
    freshnessSql,
  );

  const windowResults: Record<string, unknown> = {};
  for (const window of windows) {
    const startSql = sqlString(window.startUtc);
    const endSql = sqlString(window.endExclusiveUtc);
    const baseWhere = `
      site = ${siteSql}
      AND LOWER(COALESCE(pay_type, '')) = 'npay'
      AND COALESCE(payment_amount, 0) > 0
      AND order_time >= ${startSql}
      AND order_time < ${endSql}
    `;
    const excludedPredicate = `UPPER(COALESCE(imweb_status, '')) IN (${EXCLUDED_IMWEB_STATUS.map(sqlString).join(", ")})`;
    const includedWhere = `${baseWhere} AND NOT (${excludedPredicate})`;
    const sql = `
      SELECT
        (SELECT COUNT(*) FROM imweb_orders WHERE ${includedWhere}) AS actual_count,
        (SELECT COALESCE(SUM(COALESCE(payment_amount, 0)), 0) FROM imweb_orders WHERE ${includedWhere}) AS actual_amount_krw,
        (SELECT MAX(order_time) FROM imweb_orders WHERE ${includedWhere}) AS actual_max_order_time,
        (SELECT MAX(synced_at) FROM imweb_orders WHERE ${includedWhere}) AS actual_max_synced_at,
        (SELECT MAX(imweb_status_synced_at) FROM imweb_orders WHERE ${includedWhere}) AS actual_max_status_synced_at,
        (SELECT COUNT(*) FROM imweb_orders WHERE ${baseWhere}) AS gross_count,
        (SELECT COALESCE(SUM(COALESCE(payment_amount, 0)), 0) FROM imweb_orders WHERE ${baseWhere}) AS gross_amount_krw,
        (SELECT MAX(order_time) FROM imweb_orders WHERE ${baseWhere}) AS gross_max_order_time,
        (SELECT COUNT(*) FROM imweb_orders WHERE ${baseWhere} AND (${excludedPredicate})) AS excluded_count,
        (SELECT COALESCE(SUM(COALESCE(payment_amount, 0)), 0) FROM imweb_orders WHERE ${baseWhere} AND (${excludedPredicate})) AS excluded_amount_krw,
        (SELECT COUNT(*) FROM imweb_orders WHERE ${includedWhere} AND TRIM(COALESCE(imweb_status, '')) = '') AS status_blank_count,
        (SELECT COALESCE(SUM(COALESCE(payment_amount, 0)), 0) FROM imweb_orders WHERE ${includedWhere} AND TRIM(COALESCE(imweb_status, '')) = '') AS status_blank_amount_krw,
        (SELECT COUNT(*) FROM imweb_orders WHERE ${includedWhere} AND TRIM(COALESCE(complete_time, '')) <> '') AS complete_time_legacy_count,
        (SELECT COALESCE(SUM(COALESCE(payment_amount, 0)), 0) FROM imweb_orders WHERE ${includedWhere} AND TRIM(COALESCE(complete_time, '')) <> '') AS complete_time_legacy_amount_krw,
        (SELECT COUNT(*) FROM imweb_orders WHERE ${includedWhere} AND TRIM(COALESCE(complete_time, '')) = '') AS bridge_pending_count,
        (SELECT COALESCE(SUM(COALESCE(payment_amount, 0)), 0) FROM imweb_orders WHERE ${includedWhere} AND TRIM(COALESCE(complete_time, '')) = '') AS bridge_pending_amount_krw
    `;
    const row = runRemoteSqliteJson<RemoteNpayWindowRow>(host, options.npayRemoteDbPath, sql);
    const warnings: string[] = [];
    if (row.status_blank_count > 0) {
      warnings.push(
        `NPay status blank ${row.status_blank_count.toLocaleString("ko-KR")}건 / ${krw(row.status_blank_amount_krw)}은 미결제 단정이 아니라 freshness warning`,
      );
    }

    windowResults[window.key] = {
      status: warnings.length > 0 ? "included_with_warning" : "included",
      amount_krw: toNumber(row.actual_amount_krw),
      count: toNumber(row.actual_count),
      max_order_time: row.actual_max_order_time,
      max_synced_at: row.actual_max_synced_at,
      max_status_synced_at: row.actual_max_status_synced_at,
      diagnostics: {
        gross_before_status_exclusion: {
          count: toNumber(row.gross_count),
          amount_krw: toNumber(row.gross_amount_krw),
          max_order_time: row.gross_max_order_time,
        },
        excluded_cancel_return_exchange: {
          count: toNumber(row.excluded_count),
          amount_krw: toNumber(row.excluded_amount_krw),
        },
        complete_time_legacy: {
          count: toNumber(row.complete_time_legacy_count),
          amount_krw: toNumber(row.complete_time_legacy_amount_krw),
        },
        bridge_pending_complete_time_blank: {
          count: toNumber(row.bridge_pending_count),
          amount_krw: toNumber(row.bridge_pending_amount_krw),
        },
        status_blank_freshness_warning: {
          count: toNumber(row.status_blank_count),
          amount_krw: toNumber(row.status_blank_amount_krw),
        },
      },
      warnings,
    };
  }

  return {
    status: "ok_remote_read_only",
    source: {
      system: "vm_cloud_sqlite_read_only_via_ssh",
      host,
      db_path: options.npayRemoteDbPath,
      table: "imweb_orders",
      primary_rule:
        "site + pay_type=npay + payment_amount>0 + KST order_time window + cancel/return/exchange excluded",
      remote_write_operations: 0,
    },
    source_freshness: {
      site_npay_rows_all_time: toNumber(sourceFreshness.count),
      site_npay_amount_krw_all_time: toNumber(sourceFreshness.amount_krw),
      max_order_time: sourceFreshness.max_order_time,
      max_synced_at: sourceFreshness.max_synced_at,
      max_status_synced_at: sourceFreshness.max_status_synced_at,
    },
    windows: windowResults,
  };
}

function buildNpayWindows(options: CliOptions, windows: WindowSpec[]) {
  const remote = buildRemoteNpayWindows(options, windows);
  if (remote) return remote;

  if (!fs.existsSync(options.npayDbPath)) {
    return {
      status: "source_unavailable",
      source: {
        system: "sqlite_imweb_orders_read_only",
        db_path: options.npayDbPath,
      },
      windows: Object.fromEntries(windows.map((window) => [
        window.key,
        {
          status: "source_missing",
          amount_krw: 0,
          count: 0,
          warnings: [`DB file not found: ${options.npayDbPath}`],
        },
      ])),
    };
  }

  const db = new Database(options.npayDbPath, { readonly: true, fileMustExist: true });
  try {
    if (!tableExists(db, "imweb_orders")) {
      throw new Error("imweb_orders table not found");
    }

    const sourceFreshness = aggregateSqlite(
      db,
      `
      site = @site
      AND LOWER(COALESCE(pay_type, '')) = 'npay'
      AND COALESCE(payment_amount, 0) > 0
      `,
      {
        site: options.site,
        startUtc: "",
        endExclusiveUtc: "",
      },
    );

    const windowResults: Record<string, unknown> = {};
    for (const window of windows) {
      const params = {
        site: options.site,
        startUtc: window.startUtc,
        endExclusiveUtc: window.endExclusiveUtc,
      };
      const baseWhere = `
        site = @site
        AND LOWER(COALESCE(pay_type, '')) = 'npay'
        AND COALESCE(payment_amount, 0) > 0
        AND order_time >= @startUtc
        AND order_time < @endExclusiveUtc
      `;
      const excludedPredicate = `UPPER(COALESCE(imweb_status, '')) IN (${EXCLUDED_IMWEB_STATUS.map(
        (status) => `'${status}'`,
      ).join(", ")})`;
      const includedWhere = `${baseWhere} AND NOT (${excludedPredicate})`;
      const actual = aggregateSqlite(db, includedWhere, params);
      const gross = aggregateSqlite(db, baseWhere, params);
      const excluded = aggregateSqlite(db, `${baseWhere} AND (${excludedPredicate})`, params);
      const statusBlank = aggregateSqlite(
        db,
        `${includedWhere} AND TRIM(COALESCE(imweb_status, '')) = ''`,
        params,
      );
      const completeTimeLegacy = aggregateSqlite(
        db,
        `${includedWhere} AND TRIM(COALESCE(complete_time, '')) <> ''`,
        params,
      );
      const bridgePending = aggregateSqlite(
        db,
        `${includedWhere} AND TRIM(COALESCE(complete_time, '')) = ''`,
        params,
      );
      const warnings: string[] = [];
      if (statusBlank.count > 0) {
        warnings.push(
          `NPay status blank ${statusBlank.count.toLocaleString("ko-KR")}건 / ${krw(statusBlank.amount_krw)}은 미결제 단정이 아니라 freshness warning`,
        );
      }
      if (sourceFreshness.max_order_time && sourceFreshness.max_order_time < window.startUtc) {
        warnings.push("source_freshness_gap: requested window보다 NPay source max_order_time이 오래됨");
      }

      windowResults[window.key] = {
        status: warnings.length > 0 ? "included_with_warning" : "included",
        amount_krw: actual.amount_krw,
        count: actual.count,
        max_order_time: actual.max_order_time,
        max_synced_at: actual.max_synced_at,
        max_status_synced_at: actual.max_status_synced_at,
        diagnostics: {
          gross_before_status_exclusion: gross,
          excluded_cancel_return_exchange: excluded,
          complete_time_legacy: completeTimeLegacy,
          bridge_pending_complete_time_blank: bridgePending,
          status_blank_freshness_warning: statusBlank,
        },
        warnings,
      };
    }

    return {
      status: "ok",
      source: {
        system: "sqlite_imweb_orders_read_only",
        db_path: options.npayDbPath,
        table: "imweb_orders",
        primary_rule:
          "site + pay_type=npay + payment_amount>0 + KST order_time window + cancel/return/exchange excluded",
      },
      source_freshness: {
        site_npay_rows_all_time: sourceFreshness.count,
        site_npay_amount_krw_all_time: sourceFreshness.amount_krw,
        max_order_time: sourceFreshness.max_order_time,
        max_synced_at: sourceFreshness.max_synced_at,
        max_status_synced_at: sourceFreshness.max_status_synced_at,
      },
      windows: windowResults,
    };
  } catch (error) {
    return {
      status: "failed",
      source: {
        system: "sqlite_imweb_orders_read_only",
        db_path: options.npayDbPath,
      },
      error: error instanceof Error ? error.message.slice(0, 240) : String(error).slice(0, 240),
      windows: Object.fromEntries(windows.map((window) => [
        window.key,
        {
          status: "failed",
          amount_krw: 0,
          count: 0,
          warnings: ["npay_sqlite_aggregate_failed"],
        },
      ])),
    };
  } finally {
    db.close();
  }
}

async function buildTossWindows(windows: WindowSpec[]) {
  const { isDatabaseConfigured, queryPg } = await import("../src/postgres");
  if (!isDatabaseConfigured()) {
    return {
      status: "source_unavailable",
      source: {
        system: "operational_postgres_read_only",
        table: "public.tb_sales_toss",
      },
      windows: Object.fromEntries(windows.map((window) => [
        window.key,
        {
          status: "source_missing",
          amount_krw: 0,
          rows: 0,
          warnings: ["DATABASE_URL is not configured"],
        },
      ])),
    };
  }

  const windowResults: Record<string, unknown> = {};
  for (const window of windows) {
    const result = await queryPg<TossRow>(
      `
        SELECT
          COUNT(*)::text AS rows,
          COALESCE(SUM(total_amount), 0)::text AS total_amount_krw,
          COALESCE(SUM(cancel_amount), 0)::text AS cancel_amount_krw,
          COALESCE(SUM(total_amount - cancel_amount), 0)::text AS net_amount_krw,
          COALESCE(SUM(balance_amount), 0)::text AS balance_amount_krw,
          MIN(approved_at)::text AS min_approved_at,
          MAX(approved_at)::text AS max_approved_at
        FROM public.tb_sales_toss
        WHERE store = 'coffee'
          AND approved_at >= $1
          AND approved_at < $2
      `,
      [window.startDate, window.endDateExclusive],
    );
    const row = result.rows[0];
    const net = toNumber(row?.net_amount_krw);
    const balance = toNumber(row?.balance_amount_krw);
    const warnings: string[] = [];
    if (net !== balance) {
      warnings.push("toss net_amount and balance_amount differ; using net_amount_krw");
    }
    windowResults[window.key] = {
      status: "included_with_warning",
      amount_krw: net,
      rows: toNumber(row?.rows),
      total_amount_krw: toNumber(row?.total_amount_krw),
      cancel_amount_krw: toNumber(row?.cancel_amount_krw),
      balance_amount_krw: balance,
      min_approved_at: row?.min_approved_at ?? null,
      max_approved_at: row?.max_approved_at ?? null,
      warnings: [
        "Toss raw API/PG 금액은 자사몰 strict 매출로 바로 쓰지 않고 NPay와 분리한 selfmall component로 합산",
        ...warnings,
      ],
    };
  }

  return {
    status: "ok",
    source: {
      system: "operational_postgres_read_only",
      table: "public.tb_sales_toss",
      filter: "store = 'coffee'",
      amount_rule: "SUM(total_amount - cancel_amount)",
      time_rule: "approved_at KST-like timestamp window",
    },
    windows: windowResults,
  };
}

function normalizeProductName(value: string): string {
  return value.replace(/\s+/g, " ").trim() || "unknown_product";
}

function normalizeOptionName(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function isExcludedSmartstoreStatus(status: string): boolean {
  return /취소|반품|환불|교환/.test(status);
}

async function buildSmartstoreWindows(windows: WindowSpec[], topProductsLimit: number) {
  const { isDatabaseConfigured, queryPg } = await import("../src/postgres");
  if (!isDatabaseConfigured()) {
    return {
      status: "source_unavailable",
      source: {
        system: "operational_postgres_read_only",
        table: "public.tb_playauto_orders",
      },
      windows: Object.fromEntries(windows.map((window) => [
        window.key,
        {
          status: "source_missing",
          amount_krw: 0,
          rows: 0,
          warnings: ["DATABASE_URL is not configured"],
        },
      ])),
    };
  }

  const windowResults: Record<string, unknown> = {};
  for (const window of windows) {
    const params = [window.startDate, window.endDateExclusive];
    const [statusResult, productResult] = await Promise.all([
      queryPg<SmartstoreStatusRow>(
        `
          SELECT
            COALESCE(NULLIF(ord_status, ''), 'unknown') AS ord_status,
            COUNT(*)::text AS rows,
            COALESCE(SUM(sale_cnt::numeric), 0)::text AS quantity,
            COALESCE(SUM(pay_amt::numeric), 0)::text AS amount_krw,
            MIN(COALESCE(NULLIF(pay_time, ''), ord_time))::text AS min_time,
            MAX(COALESCE(NULLIF(pay_time, ''), ord_time))::text AS max_time
          FROM public.tb_playauto_orders
          WHERE shop_name = '스마트스토어'
            AND COALESCE(NULLIF(pay_time, ''), ord_time)::timestamp >= $1::date
            AND COALESCE(NULLIF(pay_time, ''), ord_time)::timestamp < $2::date
          GROUP BY 1
          ORDER BY COALESCE(SUM(pay_amt::numeric), 0) DESC
        `,
        params,
      ),
      queryPg<SmartstoreProductRow>(
        `
          SELECT
            COALESCE(NULLIF(shop_sale_name, ''), 'unknown_product') AS product_name,
            COALESCE(NULLIF(shop_opt_name, ''), '') AS option_name,
            COALESCE(NULLIF(ord_status, ''), 'unknown') AS ord_status,
            COUNT(*)::text AS rows,
            COALESCE(SUM(sale_cnt::numeric), 0)::text AS quantity,
            COALESCE(SUM(pay_amt::numeric), 0)::text AS amount_krw
          FROM public.tb_playauto_orders
          WHERE shop_name = '스마트스토어'
            AND COALESCE(NULLIF(pay_time, ''), ord_time)::timestamp >= $1::date
            AND COALESCE(NULLIF(pay_time, ''), ord_time)::timestamp < $2::date
          GROUP BY 1, 2, 3
          ORDER BY COALESCE(SUM(pay_amt::numeric), 0) DESC
        `,
        params,
      ),
    ]);

    let includedRows = 0;
    let includedQuantity = 0;
    let includedAmount = 0;
    let excludedRows = 0;
    let excludedAmount = 0;
    const buckets = new Map<string, ProductBucket>();

    for (const row of productResult.rows) {
      const rows = toNumber(row.rows);
      const quantity = toNumber(row.quantity);
      const amount = toNumber(row.amount_krw);
      if (isExcludedSmartstoreStatus(row.ord_status)) {
        excludedRows += rows;
        excludedAmount += amount;
        continue;
      }

      includedRows += rows;
      includedQuantity += quantity;
      includedAmount += amount;
      const productName = normalizeProductName(row.product_name);
      const optionName = normalizeOptionName(row.option_name);
      const bucket = buckets.get(productName) ?? {
        product_name: productName,
        rows: 0,
        quantity: 0,
        amount_krw: 0,
        option_count: 0,
        option_examples: [],
      };
      bucket.rows += rows;
      bucket.quantity += quantity;
      bucket.amount_krw += amount;
      bucket.option_count = (bucket.option_count ?? 0) + (optionName ? 1 : 0);
      bucket.option_examples = bucket.option_examples ?? [];
      if (optionName && bucket.option_examples.length < 3 && !bucket.option_examples.includes(optionName)) {
        bucket.option_examples.push(optionName);
      }
      buckets.set(productName, bucket);
    }

    const topProducts = [...buckets.values()]
      .sort((a, b) => b.amount_krw - a.amount_krw)
      .slice(0, topProductsLimit)
      .map((row, index) => ({
        rank: index + 1,
        ...row,
      }));

    windowResults[window.key] = {
      status: "included_with_warning",
      amount_krw: includedAmount,
      rows: includedRows,
      quantity: includedQuantity,
      excluded_rows: excludedRows,
      excluded_amount_krw: excludedAmount,
      top_products: topProducts,
      status_breakdown: statusResult.rows.map((row) => ({
        ord_status: row.ord_status,
        rows: toNumber(row.rows),
        quantity: toNumber(row.quantity),
        amount_krw: toNumber(row.amount_krw),
        excluded_by_rule: isExcludedSmartstoreStatus(row.ord_status),
        min_time: row.min_time,
        max_time: row.max_time,
      })),
      reconciliation: {
        top_product_source_total_krw: [...buckets.values()].reduce((sum, row) => sum + row.amount_krw, 0),
        matches_included_total: [...buckets.values()].reduce((sum, row) => sum + row.amount_krw, 0) === includedAmount,
      },
      warnings: [
        "PlayAuto 상태값은 dry-run 기준이며 정산 기준 확정 전 included_with_warning",
      ],
    };
  }

  return {
    status: "ok",
    source: {
      system: "operational_postgres_read_only",
      table: "public.tb_playauto_orders",
      filter: "shop_name = '스마트스토어'",
      amount_field: "pay_amt",
      product_fields: ["shop_sale_name", "shop_opt_name"],
      time_rule: "COALESCE(pay_time, ord_time) KST date window",
    },
    windows: windowResults,
  };
}

function classifyCoupangProduct(productName: string): "coffee_hint" | "teamketo_hint" | "other_hint" {
  const normalized = productName.toLowerCase();
  if (/커피|coffee|디카페|decaf|원두|콜드브루|드립|블렌드/.test(normalized)) {
    return "coffee_hint";
  }
  if (/키토|keto|mct|방탄|bulletproof|저탄|저당/.test(normalized)) {
    return "teamketo_hint";
  }
  return "other_hint";
}

function emptyCoupangBucket(): CoupangBucket {
  return {
    order_sheets: 0,
    items: 0,
    quantity: 0,
    amount_krw: 0,
  };
}

function emptyCoupangProductClassBucket(): CoupangProductClassBucket {
  return {
    items: 0,
    quantity: 0,
    amount_krw: 0,
  };
}

function emptyCoupangRevenueHistoryProductClassBucket(): CoupangRevenueHistoryProductClassBucket {
  return {
    rows: 0,
    items: 0,
    quantity: 0,
    sale_amount_krw: 0,
    settlement_amount_krw: 0,
  };
}

function addToCoupangBucket(
  bucket: CoupangBucket,
  itemCount: number,
  quantity: number,
  amount: number,
) {
  bucket.order_sheets += 1;
  bucket.items += itemCount;
  bucket.quantity += quantity;
  bucket.amount_krw += amount;
}

function getCoupangProductName(item: CoupangOrderItem): string {
  return normalizeProductName(
    String(
      item.productName ??
        item.sellerProductName ??
        item.sellerProductItemName ??
        item.firstSellerProductItemName ??
        item.vendorItemName ??
        item.vendorItemPackageName ??
        "unknown_product",
    ),
  );
}

function coupangItemQuantity(item: CoupangOrderItem): number {
  const quantity = Number(item.shippingCount ?? 1);
  return Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
}

function coupangItemAmount(item: CoupangOrderItem): number {
  const orderPrice = Number(item.orderPrice ?? 0);
  if (Number.isFinite(orderPrice) && orderPrice > 0) return Math.round(orderPrice);
  const salesPrice = Number(item.salesPrice ?? 0);
  if (Number.isFinite(salesPrice) && salesPrice > 0) {
    return Math.round(salesPrice * coupangItemQuantity(item));
  }
  return 0;
}

function dateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  let cursor = startDate;
  while (cursor <= endDate) {
    dates.push(cursor);
    cursor = shiftKstDate(cursor, 1);
  }
  return dates;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function summarizeCoupangError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/access-key=[^,\s]+/gi, "access-key=[redacted]")
    .replace(/signature=[^,\s]+/gi, "signature=[redacted]")
    .replace(/vendors\/[^/\s]+/gi, "vendors/[redacted]")
    .slice(0, 240);
}

function readCoupangSnapshot(reportDir: string, key: WindowKey): CoupangSnapshot | null {
  const filePath = path.join(reportDir, COUPANG_SNAPSHOT_FILES[key]);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as CoupangSnapshot;
}

async function buildCoupangApiWindow(options: CliOptions, window: WindowSpec) {
  const { isCoupangConfigured, listOrderSheetsByMinute } = await import("../src/coupangClient");
  if (!isCoupangConfigured(options.coupangAccount)) {
    return {
      status: "source_missing",
      coffee_amount_krw: 0,
      account_total_amount_krw: 0,
      warnings: [`Coupang ${options.coupangAccount} env is not configured`],
    };
  }

  const totals = emptyCoupangBucket();
  const byStatus: Record<string, CoupangBucket> = {};
  const byDay: Record<string, CoupangBucket> = {};
  const byProductClass: Record<string, CoupangProductClassBucket> = {
    coffee_hint: emptyCoupangProductClassBucket(),
    teamketo_hint: emptyCoupangProductClassBucket(),
    other_hint: emptyCoupangProductClassBucket(),
  };
  const productBuckets = new Map<string, CoupangProductBucket>();
  const seenShipmentBoxes = new Set<string>();
  const apiErrors: Array<{ date: string; status: string; error: string }> = [];
  let apiCalls = 0;

  for (const date of dateRange(window.startDate, window.endDateInclusive)) {
    byDay[date] = emptyCoupangBucket();
    for (const status of options.coupangStatuses) {
      byStatus[status] = byStatus[status] ?? emptyCoupangBucket();
      apiCalls += 1;
      try {
        const response = await listOrderSheetsByMinute(options.coupangAccount, {
          createdAtFrom: `${date}T00:00`,
          createdAtTo: `${date}T23:59`,
          status,
        });
        for (const sheet of response.data) {
          const shipmentKey =
            sheet.shipmentBoxId === undefined || sheet.shipmentBoxId === null
              ? ""
              : String(sheet.shipmentBoxId);
          if (shipmentKey && seenShipmentBoxes.has(shipmentKey)) continue;
          if (shipmentKey) seenShipmentBoxes.add(shipmentKey);

          const items = sheet.orderItems ?? [];
          let sheetQuantity = 0;
          let sheetAmount = 0;
          for (const item of items) {
            const productName = getCoupangProductName(item);
            const quantity = coupangItemQuantity(item);
            const amount = coupangItemAmount(item);
            const productClass = classifyCoupangProduct(productName);
            const classBucket = byProductClass[productClass];
            classBucket.items += 1;
            classBucket.quantity += quantity;
            classBucket.amount_krw += amount;

            const productBucket = productBuckets.get(productName) ?? {
              product_name: productName,
              items: 0,
              quantity: 0,
              amount_krw: 0,
            };
            productBucket.items += 1;
            productBucket.quantity += quantity;
            productBucket.amount_krw += amount;
            productBuckets.set(productName, productBucket);

            sheetQuantity += quantity;
            sheetAmount += amount;
          }
          const itemCount = items.length;
          addToCoupangBucket(totals, itemCount, sheetQuantity, sheetAmount);
          addToCoupangBucket(byStatus[status], itemCount, sheetQuantity, sheetAmount);
          addToCoupangBucket(byDay[date], itemCount, sheetQuantity, sheetAmount);
        }
      } catch (error) {
        apiErrors.push({ date, status, error: summarizeCoupangError(error) });
      }
      if (options.coupangDelayMs > 0) await sleep(options.coupangDelayMs);
    }
  }

  const coffeeBucket = byProductClass.coffee_hint;
  const teamketoBucket = byProductClass.teamketo_hint;
  const otherBucket = byProductClass.other_hint;
  const topCoffeeProducts = [...productBuckets.values()]
    .filter((product) => classifyCoupangProduct(product.product_name) === "coffee_hint")
    .sort((a, b) => b.amount_krw - a.amount_krw)
    .slice(0, options.topProducts)
    .map((product, index) => ({
      rank: index + 1,
      ...product,
    }));
  const warnings = [
    "Coupang live ordersheets API read-only result; settlement reconciliation is not included",
    "TeamKeto account total is reference only; coffee_hint only is included in strict sales",
  ];
  if (apiErrors.length > 0) {
    warnings.push(`coupang_api_partial_errors: ${apiErrors.length.toLocaleString("ko-KR")} calls failed`);
  }

  return {
    status: apiErrors.length > 0 ? "included_live_api_with_error_warning" : "included_live_api",
    coffee_amount_krw: coffeeBucket.amount_krw,
    account_total_amount_krw: totals.amount_krw,
    teamketo_reference_amount_krw: teamketoBucket.amount_krw,
    other_reference_amount_krw: otherBucket.amount_krw,
    top_products: topCoffeeProducts,
    by_status: byStatus,
    by_day: byDay,
    product_classification: byProductClass,
    api: {
      account: options.coupangAccount,
      calls: apiCalls,
      error_count: apiErrors.length,
      errors: apiErrors,
      delay_ms: options.coupangDelayMs,
    },
    confidence:
      apiErrors.length === 0
        ? "medium_high_live_api_aggregate"
        : "medium_with_api_error_notes",
    warnings,
  };
}

async function buildCoupangWindows(options: CliOptions, windows: WindowSpec[]) {
  if (options.coupangSource === "skip") {
    return {
      status: "skipped",
      source: {
        system: "coupang_skipped_by_cli",
      },
      windows: Object.fromEntries(windows.map((window) => [
        window.key,
        {
          status: "skipped",
          coffee_amount_krw: 0,
          account_total_amount_krw: 0,
          warnings: ["coupang-source=skip"],
        },
      ])),
    };
  }

  if (options.coupangSource === "api") {
    const windowResults: Record<string, unknown> = {};
    for (const window of windows) {
      windowResults[window.key] = await buildCoupangApiWindow(options, window);
    }
    return {
      status: "ok_live_api",
      source: {
        system: "coupang_wing_open_api_ordersheets_read_only",
        account: options.coupangAccount,
        endpoint_family: "ordersheets_v4_minute",
        source_mode: options.coupangSource,
        statuses: options.coupangStatuses,
        raw_order_output: 0,
      },
      windows: windowResults,
    };
  }

  const windowResults: Record<string, unknown> = {};
  for (const window of windows) {
    const snapshot = readCoupangSnapshot(options.reportDir, window.key);
    if (!snapshot) {
      windowResults[window.key] = {
        status: "source_missing",
        coffee_amount_krw: 0,
        account_total_amount_krw: 0,
        warnings: [`missing snapshot ${COUPANG_SNAPSHOT_FILES[window.key]}`],
      };
      continue;
    }

    const coffeeBucket = snapshot.product_classification?.coffee_hint ?? {};
    const teamketoBucket = snapshot.product_classification?.teamketo_hint ?? {};
    const otherBucket = snapshot.product_classification?.other_hint ?? {};
    const topCoffeeProducts = (snapshot.top_products ?? [])
      .filter((product) => classifyCoupangProduct(String(product.name ?? "")) === "coffee_hint")
      .sort((a, b) => toNumber(b.amount_krw) - toNumber(a.amount_krw))
      .slice(0, options.topProducts)
      .map((product, index) => ({
        rank: index + 1,
        product_name: String(product.name ?? "unknown_product"),
        items: toNumber(product.items),
        quantity: toNumber(product.quantity),
        amount_krw: toNumber(product.amount_krw),
      }));
    const warnings: string[] = [
      "Coupang source uses existing no-send snapshot; run dedicated ordersheets aggregate for live freshness",
      "TeamKeto account total is reference only; coffee_hint only is included in strict sales",
    ];
    if (
      snapshot.window?.start_date !== window.startDate ||
      snapshot.window?.end_date_inclusive !== window.endDateInclusive
    ) {
      warnings.push(
        `snapshot_window_mismatch: requested ${window.startDate} - ${window.endDateInclusive}, snapshot ${snapshot.window?.start_date ?? "unknown"} - ${snapshot.window?.end_date_inclusive ?? "unknown"}`,
      );
    }

    windowResults[window.key] = {
      status: "included_with_snapshot_warning",
      coffee_amount_krw: toNumber(coffeeBucket.amount_krw),
      account_total_amount_krw: toNumber(snapshot.totals?.amount_krw),
      teamketo_reference_amount_krw: toNumber(teamketoBucket.amount_krw),
      other_reference_amount_krw: toNumber(otherBucket.amount_krw),
      top_products: topCoffeeProducts,
      snapshot_file: COUPANG_SNAPSHOT_FILES[window.key],
      snapshot_window: snapshot.window ?? null,
      api: snapshot.api ?? null,
      confidence: snapshot.confidence ?? "medium_snapshot",
      warnings,
    };
  }

  return {
    status: "ok_snapshot",
    source: {
      system: "coupang_wing_ordersheets_snapshot_no_send",
      report_dir: options.reportDir,
      source_mode: options.coupangSource,
    },
    windows: windowResults,
  };
}

async function buildCoupangRevenueHistoryApiWindow(
  options: CliOptions,
  window: WindowSpec,
  ordersheetsWindow: Record<string, unknown>,
) {
  const { getRevenueHistory, isCoupangConfigured } = await import("../src/coupangClient");
  if (!isCoupangConfigured(options.coupangAccount)) {
    return {
      status: "source_missing",
      coffee_amount_krw: 0,
      account_total_amount_krw: 0,
      warnings: [`Coupang ${options.coupangAccount} env is not configured`],
    };
  }

  try {
    const response = await getRevenueHistory(options.coupangAccount, {
      recognitionDateFrom: window.startDate,
      recognitionDateTo: window.endDateInclusive,
      maxPerPage: 50,
    });
    const byProductClass: Record<string, CoupangRevenueHistoryProductClassBucket> = {
      coffee_hint: emptyCoupangRevenueHistoryProductClassBucket(),
      teamketo_hint: emptyCoupangRevenueHistoryProductClassBucket(),
      other_hint: emptyCoupangRevenueHistoryProductClassBucket(),
    };
    const productBuckets = new Map<string, CoupangRevenueHistoryProductBucket>();
    let saleRows = 0;
    let refundRows = 0;
    let itemRows = 0;
    let minRecognitionDate: string | null = null;
    let maxRecognitionDate: string | null = null;

    for (const row of response.data) {
      const saleType = String(row.saleType ?? "unknown");
      if (saleType === "SALE") saleRows += 1;
      if (saleType === "REFUND") refundRows += 1;
      const recognitionDate = String(row.recognitionDate ?? "");
      if (recognitionDate) {
        if (minRecognitionDate === null || recognitionDate.localeCompare(minRecognitionDate) < 0) {
          minRecognitionDate = recognitionDate;
        }
        if (maxRecognitionDate === null || recognitionDate.localeCompare(maxRecognitionDate) > 0) {
          maxRecognitionDate = recognitionDate;
        }
      }

      for (const item of row.items ?? []) {
        itemRows += 1;
        const productName = normalizeProductName(
          String(item.productName ?? item.vendorItemName ?? "unknown_product"),
        );
        const quantity = toNumber(item.quantity);
        const saleAmount = toNumber(item.saleAmount);
        const settlementAmount = toNumber(item.settlementAmount);
        const productClass = classifyCoupangProduct(productName);
        const classBucket = byProductClass[productClass];
        classBucket.rows += 1;
        classBucket.items += 1;
        classBucket.quantity += quantity;
        classBucket.sale_amount_krw += saleAmount;
        classBucket.settlement_amount_krw += settlementAmount;

        const productBucket = productBuckets.get(productName) ?? {
          product_name: productName,
          items: 0,
          quantity: 0,
          sale_amount_krw: 0,
          settlement_amount_krw: 0,
        };
        productBucket.items += 1;
        productBucket.quantity += quantity;
        productBucket.sale_amount_krw += saleAmount;
        productBucket.settlement_amount_krw += settlementAmount;
        productBuckets.set(productName, productBucket);
      }
    }

    const totals = Object.values(byProductClass).reduce(
      (acc, bucket) => ({
        items: acc.items + bucket.items,
        quantity: acc.quantity + bucket.quantity,
        sale_amount_krw: acc.sale_amount_krw + bucket.sale_amount_krw,
        settlement_amount_krw: acc.settlement_amount_krw + bucket.settlement_amount_krw,
      }),
      { items: 0, quantity: 0, sale_amount_krw: 0, settlement_amount_krw: 0 },
    );
    const coffeeBucket = byProductClass.coffee_hint;
    const teamketoBucket = byProductClass.teamketo_hint;
    const otherBucket = byProductClass.other_hint;
    const topCoffeeProducts = [...productBuckets.values()]
      .filter((product) => classifyCoupangProduct(product.product_name) === "coffee_hint")
      .sort((a, b) => b.sale_amount_krw - a.sale_amount_krw)
      .slice(0, options.topProducts)
      .map((product, index) => ({
        rank: index + 1,
        ...product,
        amount_krw: product.sale_amount_krw,
      }));

    const ordersheetsCoffeeAmount = toNumber(ordersheetsWindow.coffee_amount_krw);
    const ordersheetsAccountAmount = toNumber(ordersheetsWindow.account_total_amount_krw);
    const warnings = [
      "Coupang revenue-history read-only result; strict sales use revenue recognition date, not order created date",
      "TeamKeto account total is reference only; coffee_hint saleAmount only is included in strict sales",
    ];
    if (ordersheetsCoffeeAmount !== coffeeBucket.sale_amount_krw) {
      warnings.push(
        `ordersheets_reference_diff: coffee ordersheets ${krw(ordersheetsCoffeeAmount)} vs revenue-history ${krw(coffeeBucket.sale_amount_krw)}`,
      );
    }
    if (!response.done) {
      warnings.push(`revenue_history_pagination_incomplete: pages_fetched=${response.pagesFetched}`);
    }

    return {
      status: response.done ? "included_revenue_history" : "included_revenue_history_with_pagination_warning",
      coffee_amount_krw: coffeeBucket.sale_amount_krw,
      coffee_settlement_amount_krw: coffeeBucket.settlement_amount_krw,
      account_total_amount_krw: totals.sale_amount_krw,
      account_total_settlement_amount_krw: totals.settlement_amount_krw,
      teamketo_reference_amount_krw: teamketoBucket.sale_amount_krw,
      teamketo_reference_settlement_amount_krw: teamketoBucket.settlement_amount_krw,
      other_reference_amount_krw: otherBucket.sale_amount_krw,
      other_reference_settlement_amount_krw: otherBucket.settlement_amount_krw,
      top_products: topCoffeeProducts,
      by_product_class: byProductClass,
      revenue_history: {
        account: options.coupangAccount,
        recognition_date_from: window.startDate,
        recognition_date_to: window.endDateInclusive,
        pages_fetched: response.pagesFetched,
        done: response.done,
        rows: response.data.length,
        sale_rows: saleRows,
        refund_rows: refundRows,
        item_rows: itemRows,
        min_recognition_date: minRecognitionDate,
        max_recognition_date: maxRecognitionDate,
        raw_order_output: 0,
      },
      ordersheets_reference: {
        status: ordersheetsWindow.status ?? null,
        coffee_amount_krw: ordersheetsCoffeeAmount,
        account_total_amount_krw: ordersheetsAccountAmount,
      },
      confidence:
        response.done && refundRows === 0
          ? "high_revenue_history_aggregate"
          : "medium_high_revenue_history_aggregate_with_notes",
      warnings,
    };
  } catch (error) {
    return {
      status: "source_error",
      coffee_amount_krw: 0,
      account_total_amount_krw: 0,
      ordersheets_reference: {
        status: ordersheetsWindow.status ?? null,
        coffee_amount_krw: toNumber(ordersheetsWindow.coffee_amount_krw),
        account_total_amount_krw: toNumber(ordersheetsWindow.account_total_amount_krw),
      },
      warnings: [
        `Coupang revenue-history failed: ${summarizeCoupangError(error)}`,
      ],
    };
  }
}

async function buildCoupangRevenueHistoryWindows(
  options: CliOptions,
  windows: WindowSpec[],
  ordersheets: Record<string, unknown>,
) {
  if (options.coupangRevenueHistorySource === "skip") {
    return {
      status: "skipped",
      source: {
        system: "coupang_revenue_history_skipped_by_cli",
      },
      windows: Object.fromEntries(windows.map((window) => [
        window.key,
        {
          status: "skipped",
          coffee_amount_krw: 0,
          account_total_amount_krw: 0,
          warnings: ["coupang-revenue-history-source=skip"],
        },
      ])),
    };
  }

  const windowResults: Record<string, unknown> = {};
  for (const window of windows) {
    windowResults[window.key] = await buildCoupangRevenueHistoryApiWindow(
      options,
      window,
      pickWindowObject(ordersheets, window.key),
    );
  }
  return {
    status: "ok_revenue_history_api",
    source: {
      system: "coupang_wing_open_api_revenue_history_read_only",
      account: options.coupangAccount,
      endpoint_family: "revenue-history",
      date_rule: "recognitionDateFrom/recognitionDateTo",
      amount_rule: "coffee_hint items.saleAmount for strict sales; items.settlementAmount as settlement reference",
      raw_order_output: 0,
    },
    windows: windowResults,
  };
}

function buildCoupangReportingWindows(
  windows: WindowSpec[],
  ordersheets: Record<string, unknown>,
  revenueHistory: Record<string, unknown>,
) {
  const windowResults: Record<string, unknown> = {};
  for (const window of windows) {
    const revenueWindow = pickWindowObject(revenueHistory, window.key);
    const ordersheetsWindow = pickWindowObject(ordersheets, window.key);
    const revenueStatus = String(revenueWindow.status ?? "");
    const canUseRevenueHistory = revenueStatus.startsWith("included_revenue_history");
    if (canUseRevenueHistory) {
      windowResults[window.key] = {
        ...revenueWindow,
        basis: "revenue_history_recognition_date",
        ordersheets_reference: revenueWindow.ordersheets_reference ?? {
          status: ordersheetsWindow.status ?? null,
          coffee_amount_krw: toNumber(ordersheetsWindow.coffee_amount_krw),
          account_total_amount_krw: toNumber(ordersheetsWindow.account_total_amount_krw),
        },
      };
      continue;
    }

    windowResults[window.key] = {
      ...ordersheetsWindow,
      basis: "ordersheets_created_at_fallback",
      status: `fallback_${String(ordersheetsWindow.status ?? "ordersheets")}`,
      warnings: [
        ...((ordersheetsWindow.warnings as string[] | undefined) ?? []),
        ...((revenueWindow.warnings as string[] | undefined) ?? []),
        "revenue-history unavailable; strict Coupang sales fell back to ordersheets",
      ],
    };
  }

  return {
    status: "ok_reporting_basis",
    source: {
      primary: "coupang_wing_open_api_revenue_history_read_only",
      fallback: "coupang_wing_open_api_ordersheets_read_only",
      strict_sales_rule: "Use revenue-history coffee_hint saleAmount when available. Keep ordersheets as order-created reference.",
    },
    windows: windowResults,
  };
}

async function fetchMetaAdSpendWindow(options: CliOptions, window: WindowSpec) {
  if (options.adSpendSource === "skip") {
    return {
      status: "skipped",
      spend_krw: 0,
      warnings: ["ad-spend-source=skip"],
    };
  }

  let lastWarning = "";
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const url = new URL("/api/ads/site-summary", options.adSpendApiBase);
    url.searchParams.set("start_date", window.startDate);
    url.searchParams.set("end_date", window.endDateInclusive);
    if (options.adSpendForce) url.searchParams.set("force", "1");
    url.searchParams.set("cache_bust", `${window.key}-${Date.now()}-${attempt}`);

    try {
      const response = await fetch(url, { headers: { Accept: "application/json" } });
      const body = await response.json() as MetaSiteSummaryResponse;
    if (!response.ok || body.ok === false) {
      lastWarning = `Meta site-summary HTTP ${response.status}${body.ok === false ? `: ${String((body as { error?: unknown }).error ?? "ok=false").slice(0, 160)}` : ""}`;
      if (attempt < 3) {
        await sleep(1000);
        continue;
      }
      return {
        status: "source_error",
        spend_krw: 0,
        warnings: [lastWarning],
        endpoint: url.toString(),
      };
    }
    const site = body.sites?.find((row) => row.site === options.site);
    const warnings: string[] = [];
    if (body.start_date !== window.startDate || body.end_date !== window.endDateInclusive) {
      lastWarning =
        `meta_window_mismatch: requested ${window.startDate} - ${window.endDateInclusive}, response ${body.start_date ?? "unknown"} - ${body.end_date ?? "unknown"}`;
      if (attempt < 3) {
        await sleep(1000);
        continue;
      }
      return {
        status: "source_window_mismatch",
        spend_krw: 0,
        warnings: [lastWarning],
        endpoint: url.toString(),
      };
    }
    if (!site) {
      return {
        status: "site_missing",
        spend_krw: 0,
        warnings: [`Meta site-summary response has no site=${options.site}`, ...warnings],
      };
    }
    if (site.metaError) warnings.push(`meta_api_warning: ${site.metaError.slice(0, 180)}`);

    return {
      status: warnings.length > 0 ? "included_with_warning" : "included",
      spend_krw: toNumber(site.spend),
      impressions: toNumber(site.impressions),
      clicks: toNumber(site.clicks),
      platform_purchase_count: toNumber(site.purchases),
      platform_purchase_value_krw: toNumber(site.metaPurchaseValue),
      platform_purchase_roas: percent(toNumber(site.metaPurchaseValue), toNumber(site.spend)),
      internal_meta_confirmed_revenue_krw: toNumber(site.confirmedRevenue),
      internal_meta_confirmed_roas: site.confirmedRoas ?? null,
      site_confirmed_revenue_reference_krw: toNumber(site.siteConfirmedRevenue),
      site_confirmed_orders_reference: toNumber(site.siteConfirmedOrders),
      source: {
        system: "vm_cloud_ads_site_summary_read_only",
        endpoint: "/api/ads/site-summary",
        forced_live_read: options.adSpendForce,
        response_cache: body.cache ?? null,
      },
      warnings,
    };
    } catch (error) {
      lastWarning = `Meta site-summary failed: ${error instanceof Error ? error.message.slice(0, 180) : String(error).slice(0, 180)}`;
      if (attempt < 3) {
        await sleep(1000);
        continue;
      }
    return {
      status: "source_error",
      spend_krw: 0,
      warnings: [lastWarning],
    };
    }
  }

  return {
    status: "source_error",
    spend_krw: 0,
    warnings: [lastWarning || "Meta site-summary failed after retries"],
  };
}

function buildZeroAdSpendReference(platform: "naver" | "google" | "tiktok", window: WindowSpec) {
  if (platform === "naver") {
    return {
      status: "included_with_warning_zero_candidate",
      spend_krw: 0,
      clicks: 0,
      source: {
        system: "naver_ads_allowlist_dry_run_reference",
        file: "report/reportcoffee-naver-ads-campaign-allowlist-dry-run-20260522.json",
      },
      warning:
        "더클린커피 후보 캠페인 6개는 2026-04-22 - 2026-05-21 기준 광고비 0원/클릭 0회다. cache write 전까지 0원 후보로 표시한다.",
      window_note: `report window ${window.startDate} - ${window.endDateInclusive}`,
    };
  }
  if (platform === "google") {
    return {
      status: "included_with_warning_zero_candidate",
      spend_krw: 0,
      source: {
        system: "vm_cloud_google_ads_dashboard_read_only_reference",
        file: "report/reportcoffee-google-ads-spend-mapping-20260523.md",
      },
      warning:
        "최근 7일/30일 더클린커피 비용 row는 0개다. 다만 Google 클릭 ID 3건 유입 warning은 별도 유지한다.",
      window_note: `report window ${window.startDate} - ${window.endDateInclusive}`,
    };
  }
  return {
    status: "included_zero_user_confirmed_not_running",
    spend_krw: 0,
    source: {
      system: "user_confirmed_currently_not_running_ads",
      confirmed_by: "TJ님",
    },
    warning: "현재 TikTok 광고 미운영 기준 0원으로 표시한다.",
    window_note: `report window ${window.startDate} - ${window.endDateInclusive}`,
  };
}

async function buildAdSpendWindows(options: CliOptions, windows: WindowSpec[]) {
  if (options.adSpendSource === "skip") {
    return {
      status: "skipped",
      source: {
        system: "ad_spend_skipped_by_cli",
      },
      windows: Object.fromEntries(windows.map((window) => [
        window.key,
        {
          status: "skipped",
          included_ad_spend_krw: 0,
          warnings: ["ad-spend-source=skip"],
        },
      ])),
    };
  }

  const windowResults: Record<string, unknown> = {};
  for (const window of windows) {
    const meta = await fetchMetaAdSpendWindow(options, window);
    const naver = buildZeroAdSpendReference("naver", window);
    const google = buildZeroAdSpendReference("google", window);
    const tiktok = buildZeroAdSpendReference("tiktok", window);
    const includedAdSpend = toNumber(meta.spend_krw)
      + toNumber(naver.spend_krw)
      + toNumber(google.spend_krw)
      + toNumber(tiktok.spend_krw);
    const warnings = [
      ...((meta.warnings as string[] | undefined) ?? []),
      naver.warning,
      google.warning,
      tiktok.warning,
    ];

    windowResults[window.key] = {
      status: "included_with_warning",
      included_ad_spend_krw: includedAdSpend,
      formula: "included_ad_spend_krw / total_strict_amount_krw * 100",
      channels: {
        meta,
        naver,
        google,
        tiktok,
      },
      warnings,
    };
  }

  return {
    status: "ok",
    source: {
      meta: "VM Cloud /api/ads/site-summary read-only",
      naver: "allowlist dry-run zero candidate",
      google: "Google Ads dashboard read-only zero candidate",
      tiktok: "TJ님 confirmed not running ads",
      platform_purchase_values: "reference only, not added to internal sales",
    },
    windows: windowResults,
  };
}

function readLocalCoupangSettlement(
  options: CliOptions,
  windows: WindowSpec[],
  coupang: Record<string, unknown>,
) {
  if (options.coupangSettlementSource === "skip") {
    return {
      status: "skipped",
      source: {
        system: "coupang_settlement_skipped_by_cli",
      },
      windows: Object.fromEntries(windows.map((window) => [
        window.key,
        {
          status: "skipped",
          warnings: ["coupang-settlement-source=skip"],
        },
      ])),
    };
  }

  if (!fs.existsSync(options.coupangSettlementDbPath)) {
    return {
      status: "source_unavailable",
      source: {
        system: "local_sqlite_coupang_settlements_api",
        db_path: options.coupangSettlementDbPath,
      },
      windows: Object.fromEntries(windows.map((window) => [
        window.key,
        {
          status: "source_missing",
          warnings: [`DB file not found: ${options.coupangSettlementDbPath}`],
        },
      ])),
    };
  }

  const vendorId = options.coupangAccount === "teamketo" ? "A00963878" : "A00668577";
  const db = new Database(options.coupangSettlementDbPath, { readonly: true, fileMustExist: true });
  try {
    if (!tableExists(db, "coupang_settlements_api")) {
      throw new Error("coupang_settlements_api table not found");
    }
    const freshness = db.prepare(`
      SELECT
        COUNT(*) AS rows,
        COALESCE(SUM(COALESCE(total_sale, 0)), 0) AS total_sale,
        COALESCE(SUM(COALESCE(final_amount, 0)), 0) AS final_amount,
        MIN(recognition_date_from) AS min_from,
        MAX(recognition_date_to) AS max_to,
        MAX(settlement_date) AS max_settlement_date,
        MAX(synced_at) AS max_synced_at
      FROM coupang_settlements_api
      WHERE vendor_id = @vendorId
    `).get({ vendorId }) as LocalCoupangSettlementFreshnessRow;
    const latestMonths = db.prepare(`
      SELECT
        recognition_year_month,
        COUNT(*) AS rows,
        COALESCE(SUM(COALESCE(total_sale, 0)), 0) AS total_sale,
        COALESCE(SUM(COALESCE(final_amount, 0)), 0) AS final_amount,
        MIN(recognition_date_from) AS min_from,
        MAX(recognition_date_to) AS max_to,
        MAX(settlement_date) AS max_settlement_date
      FROM coupang_settlements_api
      WHERE vendor_id = @vendorId
      GROUP BY recognition_year_month
      ORDER BY recognition_year_month DESC
      LIMIT 6
    `).all({ vendorId }) as LocalCoupangSettlementMonthRow[];

    const windowResults: Record<string, unknown> = {};
    for (const window of windows) {
      const overlap = db.prepare(`
        SELECT
          COUNT(*) AS rows,
          COALESCE(SUM(COALESCE(total_sale, 0)), 0) AS total_sale,
          COALESCE(SUM(COALESCE(final_amount, 0)), 0) AS final_amount,
          MIN(recognition_date_from) AS min_from,
          MAX(recognition_date_to) AS max_to
        FROM coupang_settlements_api
        WHERE vendor_id = @vendorId
          AND recognition_date_from <= @endDate
          AND recognition_date_to >= @startDate
      `).get({
        vendorId,
        startDate: window.startDate,
        endDate: window.endDateInclusive,
      }) as LocalCoupangSettlementWindowRow;
      const liveWindow = pickWindowObject(coupang, window.key);
      const liveAccountTotal = toNumber(liveWindow.account_total_amount_krw);
      const comparable = toNumber(overlap.rows) > 0 && Boolean(overlap.max_to && overlap.max_to >= window.startDate);
      const difference = comparable ? liveAccountTotal - toNumber(overlap.total_sale) : null;

      windowResults[window.key] = {
        status: comparable ? "comparison_available_with_warning" : "not_comparable_source_freshness_gap",
        reporting_coupang_source: {
          coffee_amount_krw: toNumber(liveWindow.coffee_amount_krw),
          account_total_amount_krw: liveAccountTotal,
          status: liveWindow.status ?? null,
          basis: liveWindow.basis ?? null,
        },
        local_settlement_overlap: {
          rows: toNumber(overlap.rows),
          total_sale_krw: toNumber(overlap.total_sale),
          final_amount_krw: toNumber(overlap.final_amount),
          min_recognition_date_from: overlap.min_from,
          max_recognition_date_to: overlap.max_to,
        },
        account_total_vs_settlement_total_sale_diff_krw: difference,
        interpretation: comparable
          ? "reporting Coupang account total과 settlement total_sale을 참고 비교한다. coffee-only 금액과 정산 총판매액은 직접 같은 숫자가 아니다."
          : `정산 cache 최신 recognition_date_to가 ${freshness.max_to ?? "unknown"}라 ${window.startDate} - ${window.endDateInclusive} reporting window와 겹치지 않는다.`,
      };
    }

    return {
      status: "ok_local_read_only",
      source: {
        system: "local_sqlite_coupang_settlements_api",
        db_path: options.coupangSettlementDbPath,
        vendor_id: vendorId,
        raw_order_output: 0,
      },
      source_freshness: {
        rows: toNumber(freshness.rows),
        total_sale_krw: toNumber(freshness.total_sale),
        final_amount_krw: toNumber(freshness.final_amount),
        min_recognition_date_from: freshness.min_from,
        max_recognition_date_to: freshness.max_to,
        max_settlement_date: freshness.max_settlement_date,
        max_synced_at: freshness.max_synced_at,
      },
      latest_months: latestMonths.map((row) => ({
        recognition_year_month: row.recognition_year_month,
        rows: toNumber(row.rows),
        total_sale_krw: toNumber(row.total_sale),
        final_amount_krw: toNumber(row.final_amount),
        min_recognition_date_from: row.min_from,
        max_recognition_date_to: row.max_to,
        max_settlement_date: row.max_settlement_date,
      })),
      windows: windowResults,
    };
  } catch (error) {
    return {
      status: "failed",
      source: {
        system: "local_sqlite_coupang_settlements_api",
        db_path: options.coupangSettlementDbPath,
      },
      error: error instanceof Error ? error.message.slice(0, 240) : String(error).slice(0, 240),
      windows: Object.fromEntries(windows.map((window) => [
        window.key,
        {
          status: "failed",
          warnings: ["coupang settlement local read failed"],
        },
      ])),
    };
  } finally {
    db.close();
  }
}

async function buildOperationalCoupangSettlementReference() {
  const { isDatabaseConfigured, queryPg } = await import("../src/postgres");
  if (!isDatabaseConfigured()) {
    return {
      status: "source_unavailable",
      source: {
        system: "operational_postgres_read_only",
        table: "public.tb_sales_coupang",
      },
      warnings: ["DATABASE_URL is not configured"],
    };
  }

  try {
    const result = await queryPg<OperationalCoupangMonthRow>(`
      SELECT
        sales_month,
        channel,
        COALESCE(project, '') AS project,
        COUNT(*)::text AS rows,
        COALESCE(SUM(card_sales + cash_sales + other_sales - card_refund - cash_refund - other_refund), 0)::text AS net_amount_krw,
        MIN(sales_recognition_date)::text AS min_date,
        MAX(sales_recognition_date)::text AS max_date,
        MAX(uploaded_at)::text AS max_uploaded_at
      FROM public.tb_sales_coupang
      GROUP BY 1, 2, 3
      ORDER BY sales_month DESC, COALESCE(SUM(card_sales + cash_sales + other_sales - card_refund - cash_refund - other_refund), 0) DESC
      LIMIT 30
    `);
    return {
      status: "ok_read_only",
      source: {
        system: "operational_postgres_read_only",
        table: "public.tb_sales_coupang",
        raw_order_output: 0,
      },
      latest_month_channel_project: result.rows.map((row) => ({
        sales_month: row.sales_month,
        channel: row.channel,
        project: row.project || "blank",
        rows: toNumber(row.rows),
        net_amount_krw: toNumber(row.net_amount_krw),
        min_sales_recognition_date: row.min_date,
        max_sales_recognition_date: row.max_date,
        max_uploaded_at: row.max_uploaded_at,
      })),
      interpretation:
        "운영DB tb_sales_coupang은 월간 업로드/정산 성격이다. 최신 2026-04까지 보이며 2026-05 live ordersheets와 직접 같은 window 비교는 아직 어렵다.",
    };
  } catch (error) {
    return {
      status: "failed",
      source: {
        system: "operational_postgres_read_only",
        table: "public.tb_sales_coupang",
      },
      error: error instanceof Error ? error.message.slice(0, 240) : String(error).slice(0, 240),
    };
  }
}

async function buildCoupangSettlementComparison(
  options: CliOptions,
  windows: WindowSpec[],
  coupang: Record<string, unknown>,
) {
  const local = readLocalCoupangSettlement(options, windows, coupang);
  const operational = await buildOperationalCoupangSettlementReference();
  return {
    status: "ok_with_freshness_gap",
    purpose: "쿠팡 reporting 기준 금액과 정산/업로드 source가 같은 window로 비교 가능한지 확인한다.",
    local_settlement_cache: local,
    operational_sales_coupang_reference: operational,
    verdict:
      "current_window_not_reconciled: reporting Coupang source는 2026-05-23까지 fresh하지만 local settlement/operational source는 월간 업로드 성격이라 최신 current window와 직접 대조 불가",
  };
}

function pickWindowAmount(source: Record<string, unknown>, key: WindowKey, field = "amount_krw"): number {
  const windows = source.windows as Record<string, Record<string, unknown>> | undefined;
  return toNumber(windows?.[key]?.[field]);
}

function pickWindowObject(source: Record<string, unknown>, key: WindowKey): Record<string, unknown> {
  const windows = source.windows as Record<string, Record<string, unknown>> | undefined;
  return windows?.[key] ?? {};
}

async function run() {
  const options = getOptions();
  const windows = buildWindows(options.asOfDate);

  const [toss, smartstore] = await Promise.all([
    buildTossWindows(windows),
    buildSmartstoreWindows(windows, options.topProducts),
  ]);
  const npay = buildNpayWindows(options, windows);
  const coupangOrdersheets = await buildCoupangWindows(options, windows);
  const coupangRevenueHistory = await buildCoupangRevenueHistoryWindows(
    options,
    windows,
    coupangOrdersheets as Record<string, unknown>,
  );
  const coupang = buildCoupangReportingWindows(
    windows,
    coupangOrdersheets as Record<string, unknown>,
    coupangRevenueHistory as Record<string, unknown>,
  );
  const adSpend = await buildAdSpendWindows(options, windows);
  const coupangSettlementComparison = await buildCoupangSettlementComparison(
    options,
    windows,
    coupang as Record<string, unknown>,
  );

  const channelsByWindow: Record<string, unknown> = {};
  for (const window of windows) {
    const npayAmount = pickWindowAmount(npay as Record<string, unknown>, window.key);
    const tossAmount = pickWindowAmount(toss as Record<string, unknown>, window.key);
    const smartstoreAmount = pickWindowAmount(smartstore as Record<string, unknown>, window.key);
    const coupangCoffeeAmount = pickWindowAmount(coupang as Record<string, unknown>, window.key, "coffee_amount_krw");
    const coupangAccountTotal = pickWindowAmount(
      coupang as Record<string, unknown>,
      window.key,
      "account_total_amount_krw",
    );
    const selfmallAmount = npayAmount + tossAmount;
    const totalStrict = selfmallAmount + smartstoreAmount + coupangCoffeeAmount;
    const totalWithCoupangAccountReference = selfmallAmount + smartstoreAmount + coupangAccountTotal;
    const adSpendWindow = pickWindowObject(adSpend as Record<string, unknown>, window.key);
    const includedAdSpend = toNumber(adSpendWindow.included_ad_spend_krw);

    channelsByWindow[window.key] = {
      window: {
        label: window.label,
        timezone: "Asia/Seoul",
        start_date: window.startDate,
        end_date_inclusive: window.endDateInclusive,
        end_date_exclusive: window.endDateExclusive,
      },
      sales: {
        total_strict_amount_krw: totalStrict,
        total_strict_amount_krw_korean: krw(totalStrict),
        total_with_coupang_account_reference_krw: totalWithCoupangAccountReference,
        total_with_coupang_account_reference_krw_korean: krw(totalWithCoupangAccountReference),
        channels: {
          selfmall: {
            amount_krw: selfmallAmount,
            amount_krw_korean: krw(selfmallAmount),
            status: "included_with_warning",
            components: {
              toss: pickWindowObject(toss as Record<string, unknown>, window.key),
              npay_actual: pickWindowObject(npay as Record<string, unknown>, window.key),
            },
          },
          smartstore: pickWindowObject(smartstore as Record<string, unknown>, window.key),
          coupang: pickWindowObject(coupang as Record<string, unknown>, window.key),
        },
      },
      ad_spend: adSpendWindow,
      ratios: {
        ad_spend_share_percent: percent(includedAdSpend, totalStrict),
        ad_spend_share_formula: "included_ad_spend_krw / total_strict_amount_krw * 100",
        included_ad_spend_krw: includedAdSpend,
        included_ad_spend_krw_korean: krw(includedAdSpend),
        total_strict_amount_krw: totalStrict,
        total_strict_amount_krw_korean: krw(totalStrict),
      },
      warnings: [
        ...((pickWindowObject(npay as Record<string, unknown>, window.key).warnings as string[] | undefined) ?? []),
        ...((pickWindowObject(toss as Record<string, unknown>, window.key).warnings as string[] | undefined) ?? []),
        ...((pickWindowObject(smartstore as Record<string, unknown>, window.key).warnings as string[] | undefined) ?? []),
        ...((pickWindowObject(coupang as Record<string, unknown>, window.key).warnings as string[] | undefined) ?? []),
        ...((adSpendWindow.warnings as string[] | undefined) ?? []),
      ],
    };
  }

  const result = {
    report: "reportcoffee_sales_summary_no_send_v1",
    generated_at: new Date().toISOString(),
    generated_for_kst_date: options.asOfDate,
    mode: "read_only_no_send_no_write",
    site: options.site,
    purpose:
      "Slack send 전에 더클린커피 자사몰, 스마트스토어, 쿠팡 매출을 같은 window로 한 JSON에 합치는 통합 집계기",
    options: {
      top_products: options.topProducts,
      npay_db_path: options.npayDbPath,
      npay_ssh_host: options.npaySshHost ?? null,
      npay_remote_db_path: options.npayRemoteDbPath,
      coupang_source: options.coupangSource,
      coupang_revenue_history_source: options.coupangRevenueHistorySource,
      coupang_account: options.coupangAccount,
      coupang_statuses: options.coupangStatuses,
      coupang_delay_ms: options.coupangDelayMs,
      coupang_settlement_source: options.coupangSettlementSource,
      coupang_settlement_db_path: options.coupangSettlementDbPath,
      ad_spend_source: options.adSpendSource,
      ad_spend_api_base: options.adSpendApiBase,
      ad_spend_force: options.adSpendForce,
      report_dir: options.reportDir,
    },
    source_policy: {
      selfmall: "Toss store=coffee + NPay actual; raw Toss/Imweb samples are not exposed",
      smartstore: "operational PG tb_playauto_orders shop_name='스마트스토어'",
      coupang:
        "TeamKeto revenue-history coffee_hint saleAmount is strict sales when available; ordersheets is order-created reference only.",
      ad_spend:
        "included spend is Meta API spend + Naver/Google/TikTok 0원 후보. Platform purchase values are reference only and are not added to internal sales.",
    },
    windows: channelsByWindow,
    source_details: {
      npay,
      toss,
      smartstore,
      coupang,
      coupang_revenue_history: coupangRevenueHistory,
      coupang_ordersheets: coupangOrdersheets,
      ad_spend: adSpend,
      coupang_settlement_comparison: coupangSettlementComparison,
    },
    guardrails: {
      slack_send: 0,
      operating_db_write: 0,
      vm_cloud_write_or_deploy: 0,
      platform_send_or_upload: 0,
      gtm_publish: 0,
      raw_customer_identifier_output: 0,
      raw_order_identifier_output: 0,
      raw_payment_identifier_output: 0,
      raw_click_identifier_output: 0,
      npay_click_promoted_to_purchase: 0,
    },
    readiness: {
      source_readiness_percent:
        options.coupangRevenueHistorySource === "api" && options.adSpendSource === "api" ? 94 : 88,
      api_automation_readiness_percent:
        options.coupangRevenueHistorySource === "api" && options.adSpendSource === "api" ? 82 : 70,
      next_step:
        options.coupangRevenueHistorySource === "api" && options.adSpendSource === "api"
          ? "Generate Slack no-send preview with Coupang revenue-history strict sales and ordersheets reference."
          : "Run with --coupang-revenue-history-source=api --ad-spend-source=api, then generate Slack no-send preview from this JSON.",
    },
    confidence: "medium_high_for_sales_and_ad_spend_no_send_input",
  };

  const json = `${JSON.stringify(result, null, 2)}\n`;
  if (options.outputPath) {
    fs.mkdirSync(path.dirname(path.resolve(options.outputPath)), { recursive: true });
    fs.writeFileSync(options.outputPath, json);
  } else {
    process.stdout.write(json);
  }
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(JSON.stringify({
      report: "reportcoffee_sales_summary_no_send_v1",
      status: "failed",
      error: error instanceof Error ? error.message.slice(0, 240) : String(error).slice(0, 240),
      guardrails: {
        slack_send: 0,
        operating_db_write: 0,
        vm_cloud_write_or_deploy: 0,
        platform_send_or_upload: 0,
        raw_identifier_output: 0,
      },
    }, null, 2));
    process.exit(1);
  });
