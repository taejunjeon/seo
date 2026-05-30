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
  coupangRgAggregateDbPath: string;
  coupangRgAggregateSource: "local" | "skip";
  selfmallSource: "imweb_complete_time" | "legacy_split";
  imwebMaxPages: number;
  imwebLimit: number;
  imwebDelayMs: number;
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

type SmartstoreExcelGapReference = {
  status: "matched_reference" | "known_gap_reference";
  workbook_window: {
    start_date: string;
    end_date_inclusive: string;
  };
  excel_amount_krw: number;
  excel_rows: number;
  playauto_amount_krw: number;
  playauto_rows: number;
  diff_amount_krw: number;
  diff_rows: number;
  diff_percent: number;
  interpretation: string;
  source_document: string;
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

type LocalCoupangRgAggregateRow = {
  product_class: string;
  rows: number;
  order_count: number;
  item_count: number;
  quantity: number;
  gross_amount_krw: number;
  min_fetched_at: string | null;
  max_fetched_at: string | null;
  max_api_call_count: number | null;
  covered_days: number;
};

type ImwebApiOrder = {
  order_no: string;
  order_time_unix: number;
  paid_at_unix: number;
  complete_time_unix: number;
  pay_type: string;
  pg_type: string;
  payment_amount_krw: number;
  status_text: string;
};

type ImwebApiPage = {
  list: Array<Record<string, unknown>>;
  totalCount: number;
  totalPage: number;
  error: string | null;
};

type ImwebAggregate = {
  orders: number;
  amount_krw: number;
};

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const EXCLUDED_IMWEB_STATUS = ["CANCEL", "RETURN", "EXCHANGE"];
const EXCLUDED_IMWEB_API_STATUS_PATTERN = /(CANCEL|RETURN|EXCHANGE|취소|반품|교환)/i;
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
const SMARTSTORE_PLAYAUTO_POLICY_WARNINGS = [
  "스마트스토어는 PlayAuto 기준으로 먼저 운영하되, 정산/Excel 기준과 완전 일치 전까지 source warning을 유지",
  "2026-04-25 - 2026-05-01 대조에서 Excel보다 PlayAuto가 65,800원 / 2 rows 낮음",
  "네이버 커머스API 직접 조회는 더클린커피 권한/IP/스토어 scope가 검증되기 전까지 primary로 쓰지 않음",
  "운영DB tb_naver_orders/tb_sales_naver_vat는 더클린커피 상품 기준 primary로 쓰지 않음",
];

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
  const coupangRgAggregateSourceRaw = String(args["coupang-rg-aggregate-source"] ?? "local");
  if (coupangRgAggregateSourceRaw !== "local" && coupangRgAggregateSourceRaw !== "skip") {
    throw new Error("--coupang-rg-aggregate-source must be local or skip");
  }
  const selfmallSourceRaw = String(args["selfmall-source"] ?? "imweb_complete_time");
  if (selfmallSourceRaw !== "imweb_complete_time" && selfmallSourceRaw !== "legacy_split") {
    throw new Error("--selfmall-source must be imweb_complete_time or legacy_split");
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
    coupangRgAggregateDbPath: String(
      args["coupang-rg-aggregate-db"] ??
        args["coupang-settlement-db"] ??
        args["npay-db"] ??
        args.db ??
        process.env.CRM_LOCAL_DB_PATH ??
        path.join(backendRoot, "data", "crm.sqlite3"),
    ),
    coupangRgAggregateSource: coupangRgAggregateSourceRaw,
    selfmallSource: selfmallSourceRaw,
    imwebMaxPages: Math.max(1, Math.min(160, asInt(args["imweb-max-pages"], 80))),
    imwebLimit: Math.max(1, Math.min(100, asInt(args["imweb-limit"], 100))),
    imwebDelayMs: asNonNegativeInt(args["imweb-delay-ms"], 350),
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

function toCleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function krw(value: number): string {
  return `${value.toLocaleString("ko-KR")}원`;
}

function percent(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 10000) / 100;
}

function kstWindowToUnix(startDate: string, endDateExclusive: string) {
  const start = new Date(`${startDate}T00:00:00+09:00`);
  const end = new Date(`${endDateExclusive}T00:00:00+09:00`);
  return {
    startUnix: Math.floor(start.getTime() / 1000),
    endUnix: Math.floor(end.getTime() / 1000),
  };
}

function unixToKstDate(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "";
  return new Date(seconds * 1000 + KST_OFFSET_MS).toISOString().slice(0, 10);
}

function unixToKstText(seconds: number): string | null {
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return new Date(seconds * 1000 + KST_OFFSET_MS).toISOString().replace("T", " ").slice(0, 19);
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

function emptyImwebAggregate(): ImwebAggregate {
  return { orders: 0, amount_krw: 0 };
}

function addImwebAggregate(target: ImwebAggregate, amount: number) {
  target.orders += 1;
  target.amount_krw += amount;
}

function aggregateImwebBy(
  rows: ImwebApiOrder[],
  pick: (row: ImwebApiOrder) => string,
): Record<string, ImwebAggregate> {
  const result: Record<string, ImwebAggregate> = {};
  for (const row of rows) {
    const key = pick(row) || "(blank)";
    result[key] ??= emptyImwebAggregate();
    addImwebAggregate(result[key], row.payment_amount_krw);
  }
  return result;
}

async function fetchImwebToken(): Promise<string> {
  const key = process.env.IMWEB_API_KEY_COFFEE?.trim() ?? "";
  const secret = process.env.IMWEB_SECRET_KEY_COFFEE?.trim() ?? "";
  if (!key || !secret) throw new Error("IMWEB_API_KEY_COFFEE / IMWEB_SECRET_KEY_COFFEE missing");

  const response = await fetch("https://api.imweb.me/v2/auth", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ key, secret }),
  });
  const data = await response.json() as { code?: number; msg?: string; access_token?: string };
  if (!data.access_token) {
    throw new Error(`Imweb auth failed: ${response.status} ${data.code ?? ""} ${data.msg ?? ""}`.trim());
  }
  return data.access_token;
}

async function fetchImwebOrdersPage(token: string, page: number, limit: number): Promise<ImwebApiPage> {
  const params = new URLSearchParams({ offset: String(page), limit: String(limit) });
  const response = await fetch(`https://api.imweb.me/v2/shop/orders?${params.toString()}`, {
    headers: { "content-type": "application/json", "access-token": token },
  });
  const data = await response.json() as {
    code?: number;
    msg?: string;
    data?: {
      list?: Array<Record<string, unknown>>;
      pagenation?: { data_count?: string | number; total_page?: string | number };
    };
  };
  return {
    list: data.data?.list ?? [],
    totalCount: toNumber(data.data?.pagenation?.data_count),
    totalPage: toNumber(data.data?.pagenation?.total_page),
    error: response.ok && data.code === 200 ? null : data.msg ?? `Imweb API ${response.status} code ${data.code}`,
  };
}

async function fetchImwebOrdersPageWithRetry(
  token: string,
  page: number,
  limit: number,
  delayMs: number,
): Promise<ImwebApiPage> {
  let lastResult: ImwebApiPage | null = null;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const result = await fetchImwebOrdersPage(token, page, limit);
    lastResult = result;
    const error = result.error?.toUpperCase() ?? "";
    if (!error.includes("TOO MANY REQUEST") && !error.includes("429")) return result;
    await new Promise((resolve) => setTimeout(resolve, delayMs * (attempt + 2)));
  }
  return lastResult ?? fetchImwebOrdersPage(token, page, limit);
}

function toImwebApiOrder(row: Record<string, unknown>): ImwebApiOrder {
  const payment = (row.payment ?? {}) as Record<string, unknown>;
  const orderTimeUnix = toNumber(row.order_time);
  const completeTimeUnix = toNumber(row.complete_time);
  const paymentTimeUnix = toNumber(payment.payment_time);
  const paidAtUnix = paymentTimeUnix || completeTimeUnix || orderTimeUnix;
  const statusText = [
    toCleanString(row.status),
    toCleanString(row.order_status),
    toCleanString(row.status_text),
    toCleanString(row.status_name),
    toCleanString(row.imweb_status),
  ].filter(Boolean).join("|") || "(blank)";

  return {
    order_no: toCleanString(row.order_no),
    order_time_unix: orderTimeUnix,
    paid_at_unix: paidAtUnix,
    complete_time_unix: completeTimeUnix,
    pay_type: toCleanString(payment.pay_type) || "(blank)",
    pg_type: toCleanString(payment.pg_type) || "(blank)",
    payment_amount_krw: toNumber(payment.payment_amount),
    status_text: statusText,
  };
}

async function fetchImwebOrdersForWindows(options: CliOptions, windows: WindowSpec[]) {
  const token = await fetchImwebToken();
  const windowRanges = windows.map((window) => kstWindowToUnix(window.startDate, window.endDateExclusive));
  const minStartUnix = Math.min(...windowRanges.map((range) => range.startUnix));
  const maxEndUnix = Math.max(...windowRanges.map((range) => range.endUnix));
  const orders = new Map<string, ImwebApiOrder>();
  let totalCount = 0;
  let totalPage = 0;
  let stopReason = "max_pages";
  const errors: string[] = [];
  const pageOldestNewest: Array<{
    page: number;
    rows: number;
    oldest_observed_at_kst: string | null;
    newest_observed_at_kst: string | null;
  }> = [];

  for (let page = 1; page <= options.imwebMaxPages; page += 1) {
    const result = await fetchImwebOrdersPageWithRetry(token, page, options.imwebLimit, options.imwebDelayMs);
    if (result.error) {
      errors.push(`page=${page}: ${result.error}`);
      stopReason = "api_error";
      break;
    }
    totalCount = result.totalCount || totalCount;
    totalPage = result.totalPage || totalPage;
    if (result.list.length === 0) {
      stopReason = "empty_page";
      break;
    }

    const normalized = result.list.map(toImwebApiOrder).filter((order) => order.order_no);
    const observedTimes = normalized
      .flatMap((order) => [order.paid_at_unix, order.complete_time_unix])
      .filter((value) => value > 0);
    const newest = Math.max(...observedTimes);
    const oldest = Math.min(...observedTimes);
    pageOldestNewest.push({
      page,
      rows: normalized.length,
      oldest_observed_at_kst: Number.isFinite(oldest) ? unixToKstText(oldest) : null,
      newest_observed_at_kst: Number.isFinite(newest) ? unixToKstText(newest) : null,
    });

    for (const order of normalized) {
      const inWindow =
        (order.paid_at_unix >= minStartUnix && order.paid_at_unix < maxEndUnix) ||
        (order.complete_time_unix >= minStartUnix && order.complete_time_unix < maxEndUnix);
      if (inWindow) orders.set(order.order_no, order);
    }

    if (Number.isFinite(oldest) && oldest < minStartUnix && orders.size > 0) {
      stopReason = "window_covered";
      break;
    }
    if (page >= totalPage) {
      stopReason = "total_page_reached";
      break;
    }
    if (options.imwebDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, options.imwebDelayMs));
    }
  }

  return {
    orders: [...orders.values()],
    source: {
      system: "imweb_v2_shop_orders_readonly",
      total_count: totalCount,
      total_page: totalPage,
      stop_reason: stopReason,
      pages_seen: pageOldestNewest.length,
      page_oldest_newest: pageOldestNewest.slice(0, 3).concat(pageOldestNewest.slice(-3)),
      errors,
      raw_order_output: 0,
    },
  };
}

async function buildImwebCompleteTimeSelfmallWindows(options: CliOptions, windows: WindowSpec[]) {
  if (options.selfmallSource !== "imweb_complete_time") {
    return {
      status: "skipped",
      source: {
        system: "imweb_v2_shop_orders_readonly",
        reason: "selfmall-source=legacy_split",
      },
      windows: Object.fromEntries(windows.map((window) => [
        window.key,
        {
          status: "skipped",
          amount_krw: 0,
          order_count: 0,
          warnings: ["selfmall complete_time source skipped by CLI"],
        },
      ])),
    };
  }

  try {
    const imweb = await fetchImwebOrdersForWindows(options, windows);
    const usableOrders = imweb.orders.filter((order) => (
      order.payment_amount_krw > 0 &&
      !EXCLUDED_IMWEB_API_STATUS_PATTERN.test(order.status_text)
    ));

    const windowResults: Record<string, unknown> = {};
    for (const window of windows) {
      const { startUnix, endUnix } = kstWindowToUnix(window.startDate, window.endDateExclusive);
      const paidAtWindowOrders = usableOrders.filter((order) => (
        order.paid_at_unix >= startUnix &&
        order.paid_at_unix < endUnix
      ));
      const completeTimeOrders = paidAtWindowOrders.filter((order) => order.complete_time_unix > 0);
      const directCompleteTimeWindowOrders = usableOrders.filter((order) => (
        order.complete_time_unix >= startUnix &&
        order.complete_time_unix < endUnix
      ));
      const completeTimeBlankInPaidAtWindow = paidAtWindowOrders.filter((order) => order.complete_time_unix <= 0);
      const completeTimeAmount = completeTimeOrders.reduce((sum, order) => sum + order.payment_amount_krw, 0);
      const directCompleteTimeWindowAmount = directCompleteTimeWindowOrders
        .reduce((sum, order) => sum + order.payment_amount_krw, 0);
      const blankAmount = completeTimeBlankInPaidAtWindow.reduce((sum, order) => sum + order.payment_amount_krw, 0);
      const byPaidDate = Object.fromEntries(dateRange(window.startDate, window.endDateInclusive).map((date) => [
        date,
        emptyImwebAggregate(),
      ]));
      for (const order of completeTimeOrders) {
        const date = unixToKstDate(order.paid_at_unix);
        byPaidDate[date] ??= emptyImwebAggregate();
        addImwebAggregate(byPaidDate[date], order.payment_amount_krw);
      }
      const warnings = [
        "자사몰 order_count는 첨부 Excel과 건수 정의가 다를 수 있어 amount primary, count pending으로 표시",
        "기간은 아임웹 paid/order window로 맞추고 complete_time 존재 주문만 포함한다; complete_time 날짜 자체 window는 diagnostic",
        "complete_time blank는 미결제 증거가 아니라 보고 기준 제외/진단값",
      ];
      if (imweb.source.errors.length > 0) warnings.push("imweb_api_errors_present");
      if (imweb.source.stop_reason !== "window_covered" && imweb.source.stop_reason !== "total_page_reached") {
        warnings.push(`imweb_window_coverage_warning: ${imweb.source.stop_reason}`);
      }

      windowResults[window.key] = {
        status: "included_amount_primary_count_pending",
        source_basis: "imweb_paid_at_window_complete_time_present_v1",
        amount_krw: completeTimeAmount,
        amount_krw_korean: krw(completeTimeAmount),
        order_count: completeTimeOrders.length,
        count_definition_status: "pending_fnb_confirmation",
        min_complete_time_kst: completeTimeOrders.length
          ? unixToKstText(Math.min(...completeTimeOrders.map((order) => order.complete_time_unix)))
          : null,
        max_complete_time_kst: completeTimeOrders.length
          ? unixToKstText(Math.max(...completeTimeOrders.map((order) => order.complete_time_unix)))
          : null,
        payment_breakdown: {
          by_pay_type: aggregateImwebBy(completeTimeOrders, (order) => order.pay_type),
          by_pg_type: aggregateImwebBy(completeTimeOrders, (order) => order.pg_type),
        },
        diagnostics: {
          all_non_cancel_nonzero_by_paid_at_window: {
            orders: paidAtWindowOrders.length,
            amount_krw: paidAtWindowOrders.reduce((sum, order) => sum + order.payment_amount_krw, 0),
          },
          complete_time_blank_by_paid_at_window: {
            orders: completeTimeBlankInPaidAtWindow.length,
            amount_krw: blankAmount,
            interpretation: "report_alignment_excluded_not_unpaid_proof",
          },
          direct_complete_time_date_window: {
            orders: directCompleteTimeWindowOrders.length,
            amount_krw: directCompleteTimeWindowAmount,
            interpretation:
              "This is not used for the Slack no-send selfmall primary because it does not reproduce the existing weekly report basis.",
          },
          by_paid_date_kst: byPaidDate,
        },
        warnings,
      };
    }

    return {
      status: "ok_imweb_api_read_only",
      source: {
        ...imweb.source,
        primary_rule:
          "payment_amount>0 + non cancel/return/exchange + paid/order KST window + complete_time present",
        diagnostic_rule:
          "complete_time date-window is exposed separately because it differs from the existing weekly report basis",
        imweb_write_operations: 0,
      },
      windows: windowResults,
    };
  } catch (error) {
    return {
      status: "failed",
      source: {
        system: "imweb_v2_shop_orders_readonly",
        imweb_write_operations: 0,
      },
      error: error instanceof Error ? error.message.slice(0, 240) : String(error).slice(0, 240),
      windows: Object.fromEntries(windows.map((window) => [
        window.key,
        {
          status: "failed",
          amount_krw: 0,
          order_count: 0,
          warnings: ["imweb_complete_time_api_failed; selfmall falls back to legacy Toss+NPay split"],
        },
      ])),
    };
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

function buildSmartstoreExcelGapReference(window: WindowSpec): SmartstoreExcelGapReference | null {
  if (window.startDate !== "2026-04-25" || window.endDateInclusive !== "2026-05-01") {
    return null;
  }

  const excelAmount = 1_905_140;
  const playautoAmount = 1_839_340;
  const diffAmount = playautoAmount - excelAmount;
  return {
    status: "known_gap_reference",
    workbook_window: {
      start_date: "2026-04-25",
      end_date_inclusive: "2026-05-01",
    },
    excel_amount_krw: excelAmount,
    excel_rows: 55,
    playauto_amount_krw: playautoAmount,
    playauto_rows: 53,
    diff_amount_krw: diffAmount,
    diff_rows: 53 - 55,
    diff_percent: percent(Math.abs(diffAmount), excelAmount) ?? 0,
    interpretation:
      "PlayAuto 자동 집계는 Excel보다 65,800원 / 2 rows 낮다. 원본 추가 2건, 정산 조정, 날짜 기준 차이 중 하나가 확인되기 전까지 경고를 유지한다.",
    source_document: "report/reportcoffee-selfmall-smartstore-nosend-reconciliation-20260525.md",
  };
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
    const excelGapReference = buildSmartstoreExcelGapReference(window);

    windowResults[window.key] = {
      status: "included_with_warning",
      source_basis: "playauto_smartstore_pay_amt_v1",
      source_status: "operating_with_playauto_warning",
      warning_level: "source_warning",
      operation_policy:
        "Use PlayAuto for SmartStore Slack no-send sales until Naver Commerce API direct coffee store access or F&B settlement source closes the Excel gap.",
      confidence: excelGapReference ? "medium_high_with_known_excel_gap" : "medium_high_playauto_operating_candidate",
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
        excel_gap_reference: excelGapReference,
      },
      warnings: [
        ...SMARTSTORE_PLAYAUTO_POLICY_WARNINGS,
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
      operation_policy:
        "PlayAuto is the current best available SmartStore sales source for TheCleanCoffee, but reports must keep a visible warning until direct Commerce API or settlement/excel reconciliation is closed.",
      direct_naver_commerce_api_status:
        "official_order_api_exists_but_thecleancoffee_credentials_ip_and_store_scope_not_validated",
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

function emptyLocalRgAggregateBucket() {
  return {
    rows: 0,
    order_count: 0,
    item_count: 0,
    quantity: 0,
    gross_amount_krw: 0,
    min_fetched_at: null as string | null,
    max_fetched_at: null as string | null,
    max_api_call_count: null as number | null,
    covered_days: 0,
  };
}

function maybeBuildCoupangAttachmentReconstruction(
  window: WindowSpec,
  coupangWindow: Record<string, unknown>,
  rgWindow: Record<string, unknown>,
) {
  if (window.startDate !== "2026-04-25" || window.endDateInclusive !== "2026-05-01") {
    return null;
  }

  const ordersheetsReference = coupangWindow.ordersheets_reference as Record<string, unknown> | undefined;
  const revenueHistoryCoffee = toNumber(coupangWindow.coffee_amount_krw);
  const ordersheetsCoffee = toNumber(ordersheetsReference?.coffee_amount_krw);
  const rgCoffee = toNumber(rgWindow.coffee_amount_krw);
  const target = 2_100_400;
  const ordersheetsPlusRg = ordersheetsCoffee + rgCoffee;
  const revenueHistoryPlusRg = revenueHistoryCoffee + rgCoffee;

  return {
    target_attachment_coupang_amount_krw: target,
    target_attachment_coupang_amount_krw_korean: krw(target),
    revenue_history_plus_rg_amount_krw: revenueHistoryPlusRg,
    revenue_history_plus_rg_amount_krw_korean: krw(revenueHistoryPlusRg),
    ordersheets_plus_rg_amount_krw: ordersheetsPlusRg,
    ordersheets_plus_rg_amount_krw_korean: krw(ordersheetsPlusRg),
    remaining_gap_vs_ordersheets_plus_rg_krw: target - ordersheetsPlusRg,
    remaining_gap_vs_ordersheets_plus_rg_krw_korean: krw(target - ordersheetsPlusRg),
    remaining_gap_vs_revenue_history_plus_rg_krw: target - revenueHistoryPlusRg,
    remaining_gap_vs_revenue_history_plus_rg_krw_korean: krw(target - revenueHistoryPlusRg),
    remaining_gap_orders_hint: 2,
    verdict:
      target - ordersheetsPlusRg === 60_700
        ? "ordersheets_general_delivery_plus_rg_reproduces_all_but_60700_krw_2_orders"
        : "attachment_reconstruction_still_pending",
  };
}

function readLocalCoupangRgAggregate(options: CliOptions, windows: WindowSpec[]) {
  if (options.coupangRgAggregateSource === "skip") {
    return {
      status: "skipped",
      source: {
        system: "local_coupang_rg_aggregate_skipped_by_cli",
      },
      windows: Object.fromEntries(windows.map((window) => [
        window.key,
        {
          status: "skipped",
          coffee_amount_krw: 0,
          warnings: ["coupang-rg-aggregate-source=skip"],
        },
      ])),
    };
  }

  let db: Database.Database | null = null;
  try {
    db = new Database(options.coupangRgAggregateDbPath, { readonly: true, fileMustExist: true });
    if (!tableExists(db, "coupang_rg_daily_aggregate_api")) {
      return {
        status: "source_missing",
        source: {
          system: "local_sqlite_coupang_rg_daily_aggregate_api",
          db_path: options.coupangRgAggregateDbPath,
        },
        windows: Object.fromEntries(windows.map((window) => [
          window.key,
          {
            status: "source_missing",
            coffee_amount_krw: 0,
            warnings: ["coupang_rg_daily_aggregate_api table not found"],
          },
        ])),
      };
    }

    const windowResults: Record<string, unknown> = {};
    for (const window of windows) {
      const rows = db.prepare(`
        SELECT
          product_class,
          COUNT(*) AS rows,
          COALESCE(SUM(order_count), 0) AS order_count,
          COALESCE(SUM(item_count), 0) AS item_count,
          COALESCE(SUM(quantity), 0) AS quantity,
          COALESCE(SUM(gross_amount_krw), 0) AS gross_amount_krw,
          MIN(fetched_at_kst) AS min_fetched_at,
          MAX(fetched_at_kst) AS max_fetched_at,
          MAX(api_call_count) AS max_api_call_count,
          COUNT(DISTINCT paid_date_kst) AS covered_days
        FROM coupang_rg_daily_aggregate_api
        WHERE account_name = @account
          AND paid_date_kst >= @start
          AND paid_date_kst <= @end
        GROUP BY product_class
      `).all({
        account: options.coupangAccount,
        start: window.startDate,
        end: window.endDateInclusive,
      }) as LocalCoupangRgAggregateRow[];

      const byProductClass: Record<string, ReturnType<typeof emptyLocalRgAggregateBucket>> = {
        coffee_hint: emptyLocalRgAggregateBucket(),
        teamketo_hint: emptyLocalRgAggregateBucket(),
        other_hint: emptyLocalRgAggregateBucket(),
      };
      for (const row of rows) {
        byProductClass[row.product_class] = {
          rows: toNumber(row.rows),
          order_count: toNumber(row.order_count),
          item_count: toNumber(row.item_count),
          quantity: toNumber(row.quantity),
          gross_amount_krw: toNumber(row.gross_amount_krw),
          min_fetched_at: row.min_fetched_at,
          max_fetched_at: row.max_fetched_at,
          max_api_call_count: row.max_api_call_count === null ? null : toNumber(row.max_api_call_count),
          covered_days: toNumber(row.covered_days),
        };
      }
      const expectedDays = dateRange(window.startDate, window.endDateInclusive).length;
      const coveredDays = Math.max(
        ...Object.values(byProductClass).map((bucket) => bucket.covered_days),
        0,
      );
      const coffeeBucket = byProductClass.coffee_hint;
      const warnings = [
        "Coupang RG aggregate is local aggregate-only cache; raw order/customer identifiers are not stored in this table",
        "Keep RG as reference until general delivery/RG/dedupe policy is finalized",
      ];
      if (coveredDays < expectedDays) {
        warnings.push(`rg_aggregate_partial_coverage: covered ${coveredDays}/${expectedDays} days`);
      }

      windowResults[window.key] = {
        status: coveredDays === 0
          ? "source_missing_for_window"
          : coveredDays < expectedDays
            ? "included_local_rg_aggregate_with_partial_coverage"
            : "included_local_rg_aggregate",
        basis: "local_coupang_rg_daily_aggregate_api_paid_date_kst",
        coffee_amount_krw: coffeeBucket.gross_amount_krw,
        coffee_amount_krw_korean: krw(coffeeBucket.gross_amount_krw),
        coffee_order_count: coffeeBucket.order_count,
        coffee_item_count: coffeeBucket.item_count,
        coffee_quantity: coffeeBucket.quantity,
        by_product_class: byProductClass,
        coverage: {
          expected_days: expectedDays,
          covered_days: coveredDays,
          min_fetched_at: rows.map((row) => row.min_fetched_at).filter(Boolean).sort()[0] ?? null,
          max_fetched_at: rows.map((row) => row.max_fetched_at).filter(Boolean).sort().at(-1) ?? null,
        },
        source_table: "coupang_rg_daily_aggregate_api",
        raw_order_output: 0,
        raw_json_storage: 0,
        warnings,
        confidence:
          coveredDays === expectedDays
            ? "high_local_rg_aggregate"
            : "medium_local_rg_aggregate_partial_window",
      };
    }

    return {
      status: "ok_local_rg_aggregate",
      source: {
        system: "local_sqlite_coupang_rg_daily_aggregate_api",
        db_path: options.coupangRgAggregateDbPath,
        source_mode: options.coupangRgAggregateSource,
        account: options.coupangAccount,
        date_rule: "paid_date_kst",
        raw_order_output: 0,
        raw_json_storage: 0,
      },
      windows: windowResults,
    };
  } catch (error) {
    return {
      status: "source_error",
      source: {
        system: "local_sqlite_coupang_rg_daily_aggregate_api",
        db_path: options.coupangRgAggregateDbPath,
      },
      windows: Object.fromEntries(windows.map((window) => [
        window.key,
        {
          status: "source_error",
          coffee_amount_krw: 0,
          warnings: [`local RG aggregate failed: ${String(error instanceof Error ? error.message : error).slice(0, 160)}`],
        },
      ])),
    };
  } finally {
    db?.close();
  }
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

  const [toss, smartstore, imwebCompleteTime] = await Promise.all([
    buildTossWindows(windows),
    buildSmartstoreWindows(windows, options.topProducts),
    buildImwebCompleteTimeSelfmallWindows(options, windows),
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
  const coupangRgAggregate = readLocalCoupangRgAggregate(options, windows);
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
    const legacySelfmallAmount = npayAmount + tossAmount;
    const imwebCompleteWindow = pickWindowObject(imwebCompleteTime as Record<string, unknown>, window.key);
    const useImwebCompleteTime =
      options.selfmallSource === "imweb_complete_time" &&
      imwebCompleteWindow.status === "included_amount_primary_count_pending";
    const selfmallAmount = useImwebCompleteTime
      ? toNumber(imwebCompleteWindow.amount_krw)
      : legacySelfmallAmount;
    const smartstoreAmount = pickWindowAmount(smartstore as Record<string, unknown>, window.key);
    const coupangCoffeeAmount = pickWindowAmount(coupang as Record<string, unknown>, window.key, "coffee_amount_krw");
    const coupangWindow = pickWindowObject(coupang as Record<string, unknown>, window.key);
    const coupangRgWindow = pickWindowObject(coupangRgAggregate as Record<string, unknown>, window.key);
    const coupangRgCoffeeAmount = toNumber(coupangRgWindow.coffee_amount_krw);
    const coupangOrdersheetsReference = coupangWindow.ordersheets_reference as Record<string, unknown> | undefined;
    const coupangOrdersheetsCoffeeAmount = toNumber(coupangOrdersheetsReference?.coffee_amount_krw);
    const coupangAccountTotal = pickWindowAmount(
      coupang as Record<string, unknown>,
      window.key,
      "account_total_amount_krw",
    );
    const totalStrict = selfmallAmount + smartstoreAmount + coupangCoffeeAmount;
    const totalWithCoupangAccountReference = selfmallAmount + smartstoreAmount + coupangAccountTotal;
    const totalWithCoupangRevenueHistoryPlusRgReference =
      selfmallAmount + smartstoreAmount + coupangCoffeeAmount + coupangRgCoffeeAmount;
    const totalWithCoupangOrdersheetsPlusRgReference =
      selfmallAmount + smartstoreAmount + coupangOrdersheetsCoffeeAmount + coupangRgCoffeeAmount;
    const adSpendWindow = pickWindowObject(adSpend as Record<string, unknown>, window.key);
    const includedAdSpend = toNumber(adSpendWindow.included_ad_spend_krw);
    const attachmentReconstructionReference = maybeBuildCoupangAttachmentReconstruction(
      window,
      coupangWindow,
      coupangRgWindow,
    );

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
        reference_totals: {
          total_with_coupang_revenue_history_plus_rg_reference_krw:
            totalWithCoupangRevenueHistoryPlusRgReference,
          total_with_coupang_revenue_history_plus_rg_reference_krw_korean:
            krw(totalWithCoupangRevenueHistoryPlusRgReference),
          total_with_coupang_ordersheets_plus_rg_reference_krw:
            totalWithCoupangOrdersheetsPlusRgReference,
          total_with_coupang_ordersheets_plus_rg_reference_krw_korean:
            krw(totalWithCoupangOrdersheetsPlusRgReference),
          note:
            "Reference totals are not strict sales until Coupang general delivery/RG dedupe and attachment gap are closed.",
        },
        channels: {
          selfmall: {
            amount_krw: selfmallAmount,
            amount_krw_korean: krw(selfmallAmount),
            status: useImwebCompleteTime ? "included_amount_primary_count_pending" : "included_with_warning",
            source_basis: useImwebCompleteTime
              ? "imweb_paid_at_window_complete_time_present_v1"
              : "legacy_toss_plus_npay_split_v1",
            source_status: useImwebCompleteTime
              ? "imweb_complete_time_primary"
              : "legacy_split_fallback_or_cli_selected",
            order_count: useImwebCompleteTime ? toNumber(imwebCompleteWindow.order_count) : null,
            count_definition_status: useImwebCompleteTime ? "pending_fnb_confirmation" : "legacy_component_count_only",
            payment_breakdown: useImwebCompleteTime ? imwebCompleteWindow.payment_breakdown ?? null : null,
            diagnostics: useImwebCompleteTime ? imwebCompleteWindow.diagnostics ?? null : null,
            complete_time_source: useImwebCompleteTime ? imwebCompleteWindow : null,
            components: {
              toss: pickWindowObject(toss as Record<string, unknown>, window.key),
              npay_actual: pickWindowObject(npay as Record<string, unknown>, window.key),
            },
            legacy_split_reference: {
              amount_krw: legacySelfmallAmount,
              amount_krw_korean: krw(legacySelfmallAmount),
              note: "기존 Toss+NPay 합산값은 비교/진단용으로 유지하고 자사몰 총액 primary에는 쓰지 않음",
            },
          },
          smartstore: pickWindowObject(smartstore as Record<string, unknown>, window.key),
          coupang: {
            ...coupangWindow,
            rg_aggregate_reference: coupangRgWindow,
            attachment_reconstruction_reference: attachmentReconstructionReference,
          },
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
        ...((imwebCompleteWindow.warnings as string[] | undefined) ?? []),
        ...((pickWindowObject(smartstore as Record<string, unknown>, window.key).warnings as string[] | undefined) ?? []),
        ...((pickWindowObject(coupang as Record<string, unknown>, window.key).warnings as string[] | undefined) ?? []),
        ...((coupangRgWindow.warnings as string[] | undefined) ?? []),
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
      coupang_rg_aggregate_source: options.coupangRgAggregateSource,
      coupang_rg_aggregate_db_path: options.coupangRgAggregateDbPath,
      selfmall_source: options.selfmallSource,
      imweb_max_pages: options.imwebMaxPages,
      imweb_limit: options.imwebLimit,
      imweb_delay_ms: options.imwebDelayMs,
      ad_spend_source: options.adSpendSource,
      ad_spend_api_base: options.adSpendApiBase,
      ad_spend_force: options.adSpendForce,
      report_dir: options.reportDir,
    },
    source_policy: {
      selfmall:
        "Imweb paid/order window rows with complete_time present are the selfmall amount primary; Toss and NPay actual remain diagnostic payment-method references. Raw Toss/Imweb samples are not exposed.",
      smartstore:
        "operational PG tb_playauto_orders shop_name='스마트스토어' is used first with a visible PlayAuto warning. Direct Naver Commerce API is not promoted until TheCleanCoffee credential, IP allowlist, and store scope are verified.",
      coupang:
        "TeamKeto revenue-history coffee_hint saleAmount is strict sales when available; ordersheets and local RG aggregate are references until dedupe/gap is closed.",
      ad_spend:
        "included spend is Meta API spend + Naver/Google/TikTok 0원 후보. Platform purchase values are reference only and are not added to internal sales.",
    },
    windows: channelsByWindow,
    source_details: {
      npay,
      toss,
      imweb_complete_time_selfmall: imwebCompleteTime,
      smartstore,
      coupang,
      coupang_revenue_history: coupangRevenueHistory,
      coupang_ordersheets: coupangOrdersheets,
      coupang_rg_aggregate: coupangRgAggregate,
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
