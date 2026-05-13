import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

type Args = {
  site: string;
  windowDays: number;
  windowHours: number;
  summaryBaseUrl: string;
  output?: string;
  mode: "ssh" | "local";
  sshTarget: string;
  sshKey: string;
  remoteUser: string;
  sqlitePath: string;
};

type SqliteAggregate = {
  gross_count: number;
  gross_amount: number;
  actual_count: number;
  actual_amount: number;
  confirmed_status_count: number;
  confirmed_status_amount: number;
  status_blank_count: number;
  status_blank_amount: number;
  status_blank_missing_marker_count: number;
  cancel_excluded_count: number;
  cancel_excluded_amount: number;
  max_order_time: string | null;
  max_synced_at: string | null;
  max_status_synced_at: string | null;
};

const defaults: Args = {
  site: "thecleancoffee",
  windowDays: 30,
  windowHours: 24,
  summaryBaseUrl: "https://att.ainativeos.net",
  mode: "ssh",
  sshTarget: process.env.COFFEE_MONITOR_SSH_TARGET || "taejun@34.64.104.94",
  sshKey: process.env.COFFEE_MONITOR_SSH_KEY || path.join(os.homedir(), ".ssh", "id_ed25519"),
  remoteUser: process.env.COFFEE_MONITOR_REMOTE_USER || "biocomkr_sns",
  sqlitePath:
    process.env.COFFEE_MONITOR_SQLITE_PATH ||
    "/home/biocomkr_sns/seo/repo/backend/data/crm.sqlite3",
};

const parseArgs = (): Args => {
  const args = { ...defaults };
  for (const raw of process.argv.slice(2)) {
    const [key, value = ""] = raw.replace(/^--/, "").split("=");
    if (key === "site") args.site = value;
    if (key === "window-days") args.windowDays = Number(value);
    if (key === "window-hours") args.windowHours = Number(value);
    if (key === "summary-base-url") args.summaryBaseUrl = value.replace(/\/$/, "");
    if (key === "output") args.output = value;
    if (key === "mode" && (value === "ssh" || value === "local")) args.mode = value;
    if (key === "ssh-target") args.sshTarget = value;
    if (key === "ssh-key") args.sshKey = value;
    if (key === "remote-user") args.remoteUser = value;
    if (key === "sqlite-path") args.sqlitePath = value;
  }
  return args;
};

const shellQuote = (value: string): string => `'${value.replace(/'/g, "'\\''")}'`;
const sqlQuote = (value: string): string => `'${value.replace(/'/g, "''")}'`;

const parseSqliteTimeMs = (value: string | null): number | null => {
  if (!value) return null;
  const normalized = value.includes("T") ? value : `${value.replace(" ", "T")}Z`;
  const ms = Date.parse(normalized);
  return Number.isFinite(ms) ? ms : null;
};

const hoursSince = (value: string | null): number | null => {
  const ms = parseSqliteTimeMs(value);
  if (ms === null) return null;
  return Math.round(((Date.now() - ms) / 36_000) ) / 100;
};

const kstNow = (): string =>
  new Date().toLocaleString("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

const buildSql = (args: Args): string => {
  const thresholdIso = new Date(Date.now() - args.windowDays * 24 * 60 * 60 * 1000).toISOString();
  const site = sqlQuote(args.site);
  const threshold = sqlQuote(thresholdIso);
  return `
WITH base AS (
  SELECT
    CAST(COALESCE(payment_amount, 0) AS INTEGER) AS amount_krw,
    COALESCE(NULLIF(TRIM(imweb_status), ''), '') AS status,
    order_time,
    synced_at,
    imweb_status_synced_at
  FROM imweb_orders
  WHERE site = ${site}
    AND LOWER(COALESCE(pay_type, '')) = 'npay'
    AND order_time >= ${threshold}
    AND COALESCE(payment_amount, 0) > 0
),
site_freshness AS (
  SELECT
    MAX(synced_at) AS max_synced_at,
    MAX(imweb_status_synced_at) AS max_status_synced_at
  FROM imweb_orders
  WHERE site = ${site}
)
SELECT
  COUNT(*) AS gross_count,
  COALESCE(SUM(amount_krw), 0) AS gross_amount,
  COALESCE(SUM(CASE WHEN status NOT IN ('CANCEL', 'RETURN', 'EXCHANGE') THEN 1 ELSE 0 END), 0) AS actual_count,
  COALESCE(SUM(CASE WHEN status NOT IN ('CANCEL', 'RETURN', 'EXCHANGE') THEN amount_krw ELSE 0 END), 0) AS actual_amount,
  COALESCE(SUM(CASE WHEN status != '' AND status NOT IN ('CANCEL', 'RETURN', 'EXCHANGE') THEN 1 ELSE 0 END), 0) AS confirmed_status_count,
  COALESCE(SUM(CASE WHEN status != '' AND status NOT IN ('CANCEL', 'RETURN', 'EXCHANGE') THEN amount_krw ELSE 0 END), 0) AS confirmed_status_amount,
  COALESCE(SUM(CASE WHEN status = '' THEN 1 ELSE 0 END), 0) AS status_blank_count,
  COALESCE(SUM(CASE WHEN status = '' THEN amount_krw ELSE 0 END), 0) AS status_blank_amount,
  COALESCE(SUM(CASE WHEN status = '' AND imweb_status_synced_at IS NULL THEN 1 ELSE 0 END), 0) AS status_blank_missing_marker_count,
  COALESCE(SUM(CASE WHEN status IN ('CANCEL', 'RETURN', 'EXCHANGE') THEN 1 ELSE 0 END), 0) AS cancel_excluded_count,
  COALESCE(SUM(CASE WHEN status IN ('CANCEL', 'RETURN', 'EXCHANGE') THEN amount_krw ELSE 0 END), 0) AS cancel_excluded_amount,
  MAX(order_time) AS max_order_time,
  (SELECT max_synced_at FROM site_freshness) AS max_synced_at,
  (SELECT max_status_synced_at FROM site_freshness) AS max_status_synced_at
FROM base;
`.trim();
};

const readSqliteAggregate = async (args: Args): Promise<SqliteAggregate> => {
  const sql = buildSql(args);
  let stdout = "";
  if (args.mode === "local") {
    const result = await execFileAsync("sqlite3", ["-json", args.sqlitePath, sql], {
      maxBuffer: 1024 * 1024,
    });
    stdout = result.stdout;
  } else {
    const remoteScript = `set -euo pipefail\nsqlite3 -json ${shellQuote(args.sqlitePath)} ${shellQuote(sql)}`;
    const result = await execFileAsync(
      "ssh",
      [
        "-i",
        args.sshKey,
        "-o",
        "IdentitiesOnly=yes",
        "-o",
        "BatchMode=yes",
        "-o",
        "ConnectTimeout=8",
        args.sshTarget,
        `sudo -n -u ${args.remoteUser} bash -lc ${shellQuote(remoteScript)}`,
      ],
      { maxBuffer: 1024 * 1024 },
    );
    stdout = result.stdout;
  }
  const rows = JSON.parse(stdout || "[]") as SqliteAggregate[];
  return rows[0] || {
    gross_count: 0,
    gross_amount: 0,
    actual_count: 0,
    actual_amount: 0,
    confirmed_status_count: 0,
    confirmed_status_amount: 0,
    status_blank_count: 0,
    status_blank_amount: 0,
    status_blank_missing_marker_count: 0,
    cancel_excluded_count: 0,
    cancel_excluded_amount: 0,
    max_order_time: null,
    max_synced_at: null,
    max_status_synced_at: null,
  };
};

const fetchSummaryActual = async (args: Args): Promise<Record<string, unknown>> => {
  const url = `${args.summaryBaseUrl}/api/attribution/site-landing/summary?site=${encodeURIComponent(
    args.site,
  )}&windowHours=${encodeURIComponent(String(args.windowHours))}`;
  const res = await fetch(url);
  const json = (await res.json()) as { derived?: Record<string, unknown> };
  if (!res.ok) {
    throw new Error(`summary_api_http_${res.status}`);
  }
  return (json.derived?.npay_revenue_30d_actual_confirmed || {}) as Record<string, unknown>;
};

const warningsFor = (agg: SqliteAggregate): string[] => {
  const warnings = ["ga4_guard_not_actual_source"];
  if (agg.status_blank_count > 0) warnings.push("status_blank_rows_included_with_warning");
  const lag = hoursSince(agg.max_status_synced_at);
  if (lag === null) warnings.push("status_sync_freshness_unknown");
  if (lag !== null && lag > 6) warnings.push("status_sync_stale_over_6h");
  if (agg.actual_count === 0) warnings.push("coffee_npay_no_rows_in_window");
  return warnings;
};

const main = async () => {
  const args = parseArgs();
  const [summary, aggregate] = await Promise.all([fetchSummaryActual(args), readSqliteAggregate(args)]);
  const statusSyncLagHours = hoursSince(aggregate.max_status_synced_at);
  const output = {
    ok: true,
    site: args.site,
    checked_at_kst: kstNow(),
    window_days: args.windowDays,
    window_hours_summary_api: args.windowHours,
    source: "imweb_v2_vm_cloud_imweb_orders",
    db_location:
      args.mode === "ssh"
        ? `VM Cloud SQLite ${args.sqlitePath}`
        : `local SQLite ${args.sqlitePath}`,
    actual_count: aggregate.actual_count,
    actual_amount: aggregate.actual_amount,
    status_blank_count: aggregate.status_blank_count,
    status_blank_amount: aggregate.status_blank_amount,
    status_blank_missing_marker_count: aggregate.status_blank_missing_marker_count,
    status_blank_root_cause:
      aggregate.status_blank_count > 0 &&
      aggregate.status_blank_missing_marker_count === aggregate.status_blank_count
        ? "VM Cloud SQLite imweb_orders status sync lag: blank rows have no imweb_status_synced_at marker"
        : "mixed_or_no_blank_rows",
    cancel_excluded_count: aggregate.cancel_excluded_count,
    cancel_excluded_amount: aggregate.cancel_excluded_amount,
    gross_count: aggregate.gross_count,
    gross_amount: aggregate.gross_amount,
    confirmed_status_count: aggregate.confirmed_status_count,
    confirmed_status_amount: aggregate.confirmed_status_amount,
    max_order_time: aggregate.max_order_time,
    max_synced_at: aggregate.max_synced_at,
    max_status_synced_at: aggregate.max_status_synced_at,
    status_sync_lag_hours: statusSyncLagHours,
    warnings: warningsFor(aggregate),
    summary_api_cross_check: {
      source: summary.source,
      status: summary.status,
      complete_count: summary.complete_count,
      complete_amount_krw: summary.complete_amount_krw,
      status_blank_count: summary.status_blank_count,
      status_blank_amount_krw: summary.status_blank_amount_krw,
      warnings: summary.warnings,
    },
    no_send: true,
    no_write: true,
    raw_identifier_output: false,
  };

  const body = `${JSON.stringify(output, null, 2)}\n`;
  if (args.output) {
    fs.mkdirSync(path.dirname(args.output), { recursive: true });
    fs.writeFileSync(args.output, body, "utf8");
  }
  process.stdout.write(body);
};

main().catch((error) => {
  const body = {
    ok: false,
    checked_at_kst: kstNow(),
    error: error instanceof Error ? error.message : String(error),
    no_send: true,
    no_write: true,
    raw_identifier_output: false,
  };
  process.stderr.write(`${JSON.stringify(body, null, 2)}\n`);
  process.exit(1);
});
