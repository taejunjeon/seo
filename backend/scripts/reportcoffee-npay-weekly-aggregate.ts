import fs from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "..", ".env"), quiet: true });
dotenv.config({ path: path.resolve(__dirname, "..", ".env.local"), quiet: true });

type CliOptions = {
  dbPath: string;
  site: string;
  days: number;
  startDate: string;
  endDate: string;
  outputPath?: string;
};

type AggregateRow = {
  count: number;
  amount_krw: number;
  max_order_time: string | null;
  max_complete_time: string | null;
  max_synced_at: string | null;
  max_status_synced_at: string | null;
};

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const EXCLUDED_STATUS = ["CANCEL", "RETURN", "EXCHANGE"];

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

function shiftKstDate(date: string, deltaDays: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + deltaDays));
  return [
    shifted.getUTCFullYear(),
    String(shifted.getUTCMonth() + 1).padStart(2, "0"),
    String(shifted.getUTCDate()).padStart(2, "0"),
  ].join("-");
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

function asInt(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : fallback;
}

function getOptions(): CliOptions {
  const args = parseArgs(process.argv.slice(2));
  const backendRoot = path.resolve(__dirname, "..");
  const dbPath = String(
    args.db ??
      args["db-path"] ??
      process.env.CRM_LOCAL_DB_PATH ??
      path.join(backendRoot, "data", "crm.sqlite3"),
  );
  const days = asInt(args.days, 7);
  const endDate = assertDate(String(args.end ?? getPreviousKstDate()), "--end");
  const startDate = assertDate(
    String(args.start ?? shiftKstDate(endDate, -(days - 1))),
    "--start",
  );
  if (startDate > endDate) {
    throw new Error("--start must be before or equal to --end");
  }
  return {
    dbPath,
    site: String(args.site ?? "thecleancoffee"),
    days,
    startDate,
    endDate,
    outputPath: args.out ? String(args.out) : undefined,
  };
}

function tableExists(db: Database.Database, tableName: string): boolean {
  const row = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name = ? LIMIT 1",
    )
    .get(tableName) as { name?: string } | undefined;
  return row?.name === tableName;
}

function aggregate(
  db: Database.Database,
  whereSql: string,
  params: Record<string, string>,
): AggregateRow {
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

function run() {
  const options = getOptions();
  const startUtc = kstDateStartToUtcIso(options.startDate);
  const endExclusiveDate = shiftKstDate(options.endDate, 1);
  const endExclusiveUtc = kstDateStartToUtcIso(endExclusiveDate);

  const db = new Database(options.dbPath, { readonly: true, fileMustExist: true });
  try {
    if (!tableExists(db, "imweb_orders")) {
      throw new Error(`imweb_orders table not found in ${options.dbPath}`);
    }

    const baseWhere = `
      site = @site
      AND LOWER(COALESCE(pay_type, '')) = 'npay'
      AND COALESCE(payment_amount, 0) > 0
      AND order_time >= @startUtc
      AND order_time < @endExclusiveUtc
    `;
    const excludedPredicate = `UPPER(COALESCE(imweb_status, '')) IN (${EXCLUDED_STATUS.map(
      (status) => `'${status}'`,
    ).join(", ")})`;
    const includedWhere = `${baseWhere} AND NOT (${excludedPredicate})`;
    const params = {
      site: options.site,
      startUtc,
      endExclusiveUtc,
    };
    const sourceFreshness = aggregate(
      db,
      `
      site = @site
      AND LOWER(COALESCE(pay_type, '')) = 'npay'
      AND COALESCE(payment_amount, 0) > 0
      `,
      params,
    );

    const gross = aggregate(db, baseWhere, params);
    const actualIncluded = aggregate(db, includedWhere, params);
    const excluded = aggregate(db, `${baseWhere} AND (${excludedPredicate})`, params);
    const statusBlank = aggregate(
      db,
      `${includedWhere} AND TRIM(COALESCE(imweb_status, '')) = ''`,
      params,
    );
    const statusPresent = aggregate(
      db,
      `${includedWhere} AND TRIM(COALESCE(imweb_status, '')) <> ''`,
      params,
    );
    const completeTimeLegacy = aggregate(
      db,
      `${includedWhere} AND TRIM(COALESCE(complete_time, '')) <> ''`,
      params,
    );
    const bridgePending = aggregate(
      db,
      `${includedWhere} AND TRIM(COALESCE(complete_time, '')) = ''`,
      params,
    );

    const result = {
      report: "reportcoffee_npay_weekly_aggregate_v1",
      generated_at: new Date().toISOString(),
      site: options.site,
      source: {
        system: "sqlite_imweb_orders_read_only",
        db_path: options.dbPath,
        table: "imweb_orders",
        primary_rule:
          "site + pay_type=npay + payment_amount>0 + order_time window + cancel/return/exchange excluded",
        diagnostic_only: ["complete_time", "imweb_status", "imweb_status_synced_at"],
      },
      window: {
        timezone: "Asia/Seoul",
        start_date: options.startDate,
        end_date_inclusive: options.endDate,
        start_utc: startUtc,
        end_exclusive_utc: endExclusiveUtc,
        requested_days: options.days,
      },
      source_freshness: {
        site_npay_rows_all_time: sourceFreshness.count,
        site_npay_amount_krw_all_time: sourceFreshness.amount_krw,
        max_order_time: sourceFreshness.max_order_time,
        max_synced_at: sourceFreshness.max_synced_at,
        max_status_synced_at: sourceFreshness.max_status_synced_at,
        freshness_gap_for_requested_window:
          sourceFreshness.max_order_time !== null &&
          sourceFreshness.max_order_time < startUtc,
      },
      npay_actual: {
        status:
          statusBlank.count > 0 ? "included_with_freshness_warning" : "included",
        count: actualIncluded.count,
        amount_krw: actualIncluded.amount_krw,
        max_order_time: actualIncluded.max_order_time,
        max_synced_at: actualIncluded.max_synced_at,
        max_status_synced_at: actualIncluded.max_status_synced_at,
      },
      diagnostics: {
        gross_before_status_exclusion: gross,
        excluded_cancel_return_exchange: excluded,
        included_status_present: statusPresent,
        included_status_blank_freshness_warning: statusBlank,
        complete_time_legacy: completeTimeLegacy,
        bridge_pending_complete_time_blank: bridgePending,
      },
      guardrails: {
        complete_time_blank_is_not_unpaid: true,
        imweb_status_is_diagnostic_not_actual_primary: true,
        npay_click_promoted_to_purchase: false,
        raw_identifier_output: 0,
        send_or_write: 0,
      },
      confidence:
        actualIncluded.count > 0
          ? "medium_high_with_freshness_warning"
          : sourceFreshness.max_order_time !== null && sourceFreshness.max_order_time < startUtc
            ? "source_freshness_gap_run_on_fresh_vm_cloud_db"
          : "low_until_fresh_vm_cloud_db_run",
    };

    const json = `${JSON.stringify(result, null, 2)}\n`;
    if (options.outputPath) {
      fs.mkdirSync(path.dirname(path.resolve(options.outputPath)), { recursive: true });
      fs.writeFileSync(options.outputPath, json);
    } else {
      process.stdout.write(json);
    }
  } finally {
    db.close();
  }
}

run();
