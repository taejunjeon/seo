#!/usr/bin/env tsx
/**
 * Naver brandsearch order-source cross-check reader.
 *
 * Green Lane / read-only by design:
 * - 운영DB PostgreSQL is queried read-only for biocom actual order totals.
 * - VM Cloud SQLite is opened in read-only mode through SSH for Coffee Imweb totals.
 * - Output is aggregate-only. Raw order/payment/click/member identifiers are never selected.
 */

import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import dotenv from "dotenv";
import { Pool } from "pg";

dotenv.config({ path: resolve(__dirname, "..", ".env"), quiet: true });
dotenv.config({ path: resolve(__dirname, "..", ".env.local"), quiet: true });

const SCHEMA_VERSION = "naver-brandsearch-order-source-crosscheck-v1-20260525";
const DEFAULT_VM_HOST = "34.64.104.94";
const DEFAULT_VM_USER = "taejun";
const DEFAULT_VM_KEY = "~/.ssh/id_ed25519";
const DEFAULT_VM_DB = "/home/biocomkr_sns/seo/repo/backend/data/crm.sqlite3";
const DEFAULT_VM_RUN_AS = "biocomkr_sns";
const SITE_ALIASES: Record<string, string[]> = {
  biocom: ["biocom"],
  thecleancoffee: ["thecleancoffee", "coffee"],
};

type CliOptions = {
  biocomSince: string;
  biocomUntil: string;
  coffeeSince: string;
  coffeeUntil: string;
  output: string;
  json: boolean;
  vmHost: string;
  vmUser: string;
  vmKey: string;
  vmDb: string;
  vmRunAs: string;
};

type VmPayload = {
  ok: true;
  generated_at_kst: string;
  requested_windows: {
    biocom: DateWindow;
    thecleancoffee: DateWindow;
  };
  freshness: {
    cost_cached_at_max: string;
    landing_max_landed_at: string;
    attribution_max_logged_at: string;
    coffee_imweb_max_order_time: string;
    coffee_imweb_max_synced_at: string;
    coffee_imweb_max_status_synced_at: string;
  };
  cost_by_site: Array<{ site: string; cost_krw: number; confirmed_cost_krw: number; renewal_assumption_cost_krw: number }>;
  landing_by_site: Array<{ site: string; landing_rows: number }>;
  marker_payment_by_site: Array<{
    site: string;
    payment_success_rows: number;
    payment_success_amount_krw: number;
  }>;
  coffee_imweb_order_source: CoffeeImwebOrderSource;
  invariants_held: Record<string, unknown>;
};

type DateWindow = { since: string; until: string; timezone: "KST" };

type BiocomOrderSource = {
  source: "운영DB PostgreSQL public.tb_iamweb_users";
  filter: string;
  window: DateWindow;
  order_count: number;
  revenue_krw: number;
  npay_order_count: number;
  npay_revenue_krw: number;
  non_npay_order_count: number;
  non_npay_revenue_krw: number;
  max_source_date: string;
  source_columns_used: {
    date_columns: string[];
    amount_columns: string[];
    key_columns: string[];
  };
  payment_method_breakdown: PaymentMethodBreakdownRow[];
  warnings: string[];
};

type PaymentMethodBreakdownRow = {
  payment_method_group: string;
  order_count: number;
  revenue_krw: number;
};

type CoffeeImwebOrderSource = {
  source: "VM Cloud SQLite imweb_orders(site='thecleancoffee')";
  filter: string;
  window: DateWindow;
  all_positive_orders: number;
  all_positive_revenue_krw: number;
  npay_primary_candidate_orders: number;
  npay_primary_candidate_revenue_krw: number;
  status_blank_orders: number;
  status_blank_revenue_krw: number;
  max_order_time: string;
  max_synced_at: string;
  max_status_synced_at: string;
  pay_type_breakdown: Array<{ pay_type_group: string; order_count: number; revenue_krw: number }>;
  warnings: string[];
};

type SiteCrossCheck = {
  site: "biocom" | "thecleancoffee";
  effective_window: DateWindow;
  cost: {
    total_cost_krw: number;
    confirmed_contract_cost_krw: number;
    renewal_assumption_cost_krw: number;
  };
  brandsearch_evidence: {
    landing_rows: number;
    vm_marker_payment_success_rows: number;
    vm_marker_payment_success_amount_krw: number;
    marker_roas: number | null;
  };
  order_source: BiocomOrderSource | CoffeeImwebOrderSource;
  order_source_same_window_reference: {
    revenue_krw: number;
    order_count: number;
    roas_if_all_same_window_orders_are_compared_to_brandsearch_cost: number | null;
    interpretation: string;
  };
  warnings: string[];
};

type Output = {
  ok: true;
  schema_version: string;
  generated_at: string;
  mode: "read_only_no_send_no_write";
  source_policy: {
    cost_source: string;
    brandsearch_evidence_source: string;
    biocom_order_source_primary: string;
    thecleancoffee_order_source_primary_candidate: string;
    caveats: string[];
  };
  freshness: VmPayload["freshness"] & {
    biocom_operating_db_max_source_date: string;
  };
  by_site: SiteCrossCheck[];
  invariants_held: Record<string, unknown>;
};

const usage = () => `
Usage:
  npx tsx scripts/naver-brandsearch-order-source-crosscheck.ts [options]

Options:
  --biocom-since=YYYY-MM-DD       Inclusive KST date. Default: 2026-05-22
  --biocom-until=YYYY-MM-DD       Inclusive KST date. Default: today in KST
  --coffee-since=YYYY-MM-DD       Inclusive KST date. Default: 2026-05-11
  --coffee-until=YYYY-MM-DD       Inclusive KST date. Default: today in KST
  --output=path                   Write JSON output to path
  --json                          Print JSON only
  --vm-host=host                  VM Cloud host. Default: ${DEFAULT_VM_HOST}
  --vm-user=user                  SSH user. Default: ${DEFAULT_VM_USER}
  --vm-key=path                   SSH key. Default: ${DEFAULT_VM_KEY}
  --vm-db=path                    VM SQLite path. Default: ${DEFAULT_VM_DB}
  --vm-run-as=user                sudo -u user. Default: ${DEFAULT_VM_RUN_AS}
  --help                          Show help
`;

const kstToday = (): string =>
  new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

const isDateString = (value: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(value);

const parseArgs = (argv: string[]): CliOptions => {
  const today = kstToday();
  const options: CliOptions = {
    biocomSince: "2026-05-22",
    biocomUntil: today,
    coffeeSince: "2026-05-11",
    coffeeUntil: today,
    output: "",
    json: false,
    vmHost: process.env.VM_CLOUD_HOST?.trim() || DEFAULT_VM_HOST,
    vmUser: process.env.VM_CLOUD_USER?.trim() || DEFAULT_VM_USER,
    vmKey: process.env.VM_CLOUD_SSH_KEY?.trim() || DEFAULT_VM_KEY,
    vmDb: process.env.VM_CLOUD_SQLITE_PATH?.trim() || DEFAULT_VM_DB,
    vmRunAs: process.env.VM_CLOUD_RUN_AS?.trim() || DEFAULT_VM_RUN_AS,
  };

  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") {
      console.log(usage().trim());
      process.exit(0);
    }
    if (arg === "--json") {
      options.json = true;
      continue;
    }
    if (arg.startsWith("--biocom-since=")) {
      options.biocomSince = arg.slice("--biocom-since=".length).trim();
      continue;
    }
    if (arg.startsWith("--biocom-until=")) {
      options.biocomUntil = arg.slice("--biocom-until=".length).trim();
      continue;
    }
    if (arg.startsWith("--coffee-since=")) {
      options.coffeeSince = arg.slice("--coffee-since=".length).trim();
      continue;
    }
    if (arg.startsWith("--coffee-until=")) {
      options.coffeeUntil = arg.slice("--coffee-until=".length).trim();
      continue;
    }
    if (arg.startsWith("--output=")) {
      options.output = arg.slice("--output=".length).trim();
      continue;
    }
    if (arg.startsWith("--vm-host=")) {
      options.vmHost = arg.slice("--vm-host=".length).trim();
      continue;
    }
    if (arg.startsWith("--vm-user=")) {
      options.vmUser = arg.slice("--vm-user=".length).trim();
      continue;
    }
    if (arg.startsWith("--vm-key=")) {
      options.vmKey = arg.slice("--vm-key=".length).trim();
      continue;
    }
    if (arg.startsWith("--vm-db=")) {
      options.vmDb = arg.slice("--vm-db=".length).trim();
      continue;
    }
    if (arg.startsWith("--vm-run-as=")) {
      options.vmRunAs = arg.slice("--vm-run-as=".length).trim();
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  const dates = [options.biocomSince, options.biocomUntil, options.coffeeSince, options.coffeeUntil];
  if (!dates.every(isDateString)) throw new Error("date options must be YYYY-MM-DD");
  if (options.biocomSince > options.biocomUntil) throw new Error("biocom since must be <= until");
  if (options.coffeeSince > options.coffeeUntil) throw new Error("coffee since must be <= until");
  return options;
};

const normalizeDatabaseUrl = (value: string) => value.replace(/^postgresql\+asyncpg:\/\//, "postgresql://");

const createPgPool = () => {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) throw new Error("DATABASE_URL is not configured");
  return new Pool({ connectionString: normalizeDatabaseUrl(databaseUrl), max: 1 });
};

const toNumber = (value: unknown): number => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "bigint") return Number(value);
  if (typeof value !== "string") return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const round2 = (value: number): number => Math.round(value * 100) / 100;

const roas = (revenue: number, cost: number): number | null => cost > 0 ? round2(revenue / cost) : null;

const sqlIdent = (name: string) => `"${name.replace(/"/g, "\"\"")}"`;

const nullableTrim = (column: string) => `NULLIF(TRIM(t.${sqlIdent(column)}::text), '')`;

const firstAvailable = (columns: Set<string>, candidates: string[]) => candidates.filter((column) => columns.has(column));

const buildDateExpr = (columns: string[]) => {
  const cases = columns.map((column) => {
    const value = `TRIM(COALESCE(t.${sqlIdent(column)}::text, ''))`;
    return `WHEN ${value} ~ '^\\d{4}-\\d{2}-\\d{2}' THEN SUBSTRING(${value}, 1, 10)::date`;
  });
  return `CASE ${cases.join(" ")} ELSE NULL END`;
};

const buildAmountExpr = (columns: string[]) => {
  if (columns.length === 0) return "0::numeric";
  return `COALESCE(${columns.map((column) => `NULLIF(t.${sqlIdent(column)}::numeric, 0)`).join(", ")}, 0)::numeric`;
};

const buildOrderKeyExpr = (columns: string[]) => {
  if (columns.length === 0) return "md5(row_to_json(t)::text)";
  return `COALESCE(${columns.map(nullableTrim).join(", ")}, md5(row_to_json(t)::text))`;
};

const buildOptionalBlankSignal = (columns: Set<string>, column: string) => {
  if (!columns.has(column)) return "FALSE";
  return `LOWER(COALESCE(${nullableTrim(column)}, '')) NOT IN ('', 'nan', 'null', 'none')`;
};

const queryBiocomOperatingDb = async (pool: Pool, options: CliOptions): Promise<BiocomOrderSource> => {
  const columnRows = await pool.query<{ column_name: string }>(
    `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema='public'
        AND table_name='tb_iamweb_users'
      ORDER BY ordinal_position
    `,
  );
  const columns = new Set(columnRows.rows.map((row) => row.column_name));
  if (!columns.has("payment_status")) throw new Error("tb_iamweb_users.payment_status column missing");

  const dateColumns = firstAvailable(columns, ["payment_complete_time", "order_date"]);
  const amountColumns = firstAvailable(columns, ["final_order_amount", "paid_price", "total_price"]);
  const keyColumns = firstAvailable(columns, ["order_number", "order_no", "order_code", "order_id", "channel_order_no"]);
  if (dateColumns.length === 0) throw new Error("tb_iamweb_users date columns missing");
  if (amountColumns.length === 0) throw new Error("tb_iamweb_users amount columns missing");

  const dateExpr = buildDateExpr(dateColumns);
  const amountExpr = buildAmountExpr(amountColumns);
  const orderKeyExpr = buildOrderKeyExpr(keyColumns);
  const paymentMethodExpr = columns.has("payment_method") ? `COALESCE(${nullableTrim("payment_method")}, '(blank)')` : "'(missing)'";
  const cancelExpr = buildOptionalBlankSignal(columns, "cancellation_reason");
  const returnExpr = buildOptionalBlankSignal(columns, "return_reason");

  const summarySql = `
    WITH raw AS (
      SELECT
        ${orderKeyExpr} AS order_key,
        ${dateExpr} AS source_date,
        ${amountExpr} AS amount,
        ${paymentMethodExpr} AS payment_method,
        ${cancelExpr} AS has_cancel,
        ${returnExpr} AS has_return
      FROM public.tb_iamweb_users t
      WHERE UPPER(COALESCE(${nullableTrim("payment_status")}, '')) = 'PAYMENT_COMPLETE'
    ),
    order_level AS (
      SELECT
        order_key,
        MIN(source_date) AS source_date,
        MAX(amount) AS amount,
        MAX(payment_method) AS payment_method,
        BOOL_OR(has_cancel) AS has_cancel,
        BOOL_OR(has_return) AS has_return,
        BOOL_OR(payment_method ~* '(naver|npay)' OR payment_method LIKE '%네이버%') AS is_npay
      FROM raw
      WHERE source_date BETWEEN $1::date AND $2::date
      GROUP BY order_key
    ),
    eligible AS (
      SELECT *
      FROM order_level
      WHERE amount > 0
        AND has_cancel = FALSE
        AND has_return = FALSE
    )
    SELECT
      COUNT(*)::int AS order_count,
      COALESCE(SUM(amount), 0)::text AS revenue_krw,
      COUNT(*) FILTER (WHERE is_npay)::int AS npay_order_count,
      COALESCE(SUM(amount) FILTER (WHERE is_npay), 0)::text AS npay_revenue_krw,
      COUNT(*) FILTER (WHERE NOT is_npay)::int AS non_npay_order_count,
      COALESCE(SUM(amount) FILTER (WHERE NOT is_npay), 0)::text AS non_npay_revenue_krw,
      COALESCE(MAX(source_date)::text, '') AS max_source_date
    FROM eligible
  `;

  const breakdownSql = `
    WITH raw AS (
      SELECT
        ${orderKeyExpr} AS order_key,
        ${dateExpr} AS source_date,
        ${amountExpr} AS amount,
        ${paymentMethodExpr} AS payment_method,
        ${cancelExpr} AS has_cancel,
        ${returnExpr} AS has_return
      FROM public.tb_iamweb_users t
      WHERE UPPER(COALESCE(${nullableTrim("payment_status")}, '')) = 'PAYMENT_COMPLETE'
    ),
    order_level AS (
      SELECT
        order_key,
        MIN(source_date) AS source_date,
        MAX(amount) AS amount,
        MAX(payment_method) AS payment_method,
        BOOL_OR(has_cancel) AS has_cancel,
        BOOL_OR(has_return) AS has_return
      FROM raw
      WHERE source_date BETWEEN $1::date AND $2::date
      GROUP BY order_key
    )
    SELECT
      CASE
        WHEN payment_method ~* '(naver|npay)' OR payment_method LIKE '%네이버%' THEN 'NAVERPAY'
        WHEN payment_method ~* '(virtual|vbank)' OR payment_method LIKE '%가상%' THEN 'VIRTUAL'
        WHEN payment_method ~* '(card|credit)' OR payment_method LIKE '%카드%' THEN 'CARD'
        WHEN payment_method = '(blank)' THEN '(blank)'
        ELSE 'OTHER'
      END AS payment_method_group,
      COUNT(*)::int AS order_count,
      COALESCE(SUM(amount), 0)::text AS revenue_krw
    FROM order_level
    WHERE amount > 0
      AND has_cancel = FALSE
      AND has_return = FALSE
    GROUP BY 1
    ORDER BY COALESCE(SUM(amount), 0) DESC, payment_method_group
  `;

  const [summary, breakdown] = await Promise.all([
    pool.query(summarySql, [options.biocomSince, options.biocomUntil]),
    pool.query<PaymentMethodBreakdownRow>(breakdownSql, [options.biocomSince, options.biocomUntil]),
  ]);
  const row = summary.rows[0] as Record<string, unknown>;
  const warnings: string[] = [];
  if (keyColumns.length === 0) warnings.push("order_key_fallback_row_json_used");
  if (!columns.has("cancellation_reason")) warnings.push("cancellation_reason_column_missing");
  if (!columns.has("return_reason")) warnings.push("return_reason_column_missing");

  return {
    source: "운영DB PostgreSQL public.tb_iamweb_users",
    filter: "payment_status=PAYMENT_COMPLETE, cancellation/return blank, amount>0, grouped by order key",
    window: { since: options.biocomSince, until: options.biocomUntil, timezone: "KST" },
    order_count: toNumber(row.order_count),
    revenue_krw: toNumber(row.revenue_krw),
    npay_order_count: toNumber(row.npay_order_count),
    npay_revenue_krw: toNumber(row.npay_revenue_krw),
    non_npay_order_count: toNumber(row.non_npay_order_count),
    non_npay_revenue_krw: toNumber(row.non_npay_revenue_krw),
    max_source_date: String(row.max_source_date ?? ""),
    source_columns_used: {
      date_columns: dateColumns,
      amount_columns: amountColumns,
      key_columns: keyColumns,
    },
    payment_method_breakdown: breakdown.rows.map((breakdownRow) => ({
      payment_method_group: breakdownRow.payment_method_group,
      order_count: toNumber(breakdownRow.order_count),
      revenue_krw: toNumber(breakdownRow.revenue_krw),
    })),
    warnings,
  };
};

const pythonStringLiteral = (value: string): string => JSON.stringify(value);

const pythonArrayLiteral = (values: string[]): string => `[${values.map(pythonStringLiteral).join(", ")}]`;

const buildVmPython = (options: CliOptions): string => `
import sqlite3, json, datetime

DB = ${pythonStringLiteral(options.vmDb)}
BIOCOM_SINCE = ${pythonStringLiteral(options.biocomSince)}
BIOCOM_UNTIL = ${pythonStringLiteral(options.biocomUntil)}
COFFEE_SINCE = ${pythonStringLiteral(options.coffeeSince)}
COFFEE_UNTIL = ${pythonStringLiteral(options.coffeeUntil)}
SITES = ["biocom", "thecleancoffee"]
SITE_ALIASES = ${JSON.stringify(SITE_ALIASES)}

conn = sqlite3.connect(f"file:{DB}?mode=ro", uri=True)
conn.row_factory = sqlite3.Row

def rows(sql, params=()):
    return [dict(r) for r in conn.execute(sql, params).fetchall()]

def one(sql, params=()):
    r = conn.execute(sql, params).fetchone()
    return dict(r) if r else {}

def table_exists(name):
    return conn.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (name,)).fetchone() is not None

if not table_exists("naver_brandsearch_manual_cost_daily"):
    raise SystemExit(json.dumps({"ok": False, "error": "naver_brandsearch_manual_cost_daily table missing"}, ensure_ascii=False))
if not table_exists("site_landing_ledger"):
    raise SystemExit(json.dumps({"ok": False, "error": "site_landing_ledger table missing"}, ensure_ascii=False))
if not table_exists("attribution_ledger"):
    raise SystemExit(json.dumps({"ok": False, "error": "attribution_ledger table missing"}, ensure_ascii=False))
if not table_exists("imweb_orders"):
    raise SystemExit(json.dumps({"ok": False, "error": "imweb_orders table missing"}, ensure_ascii=False))

cost_by_site = rows("""
SELECT
  site,
  SUM(cost_krw) AS cost_krw,
  SUM(CASE WHEN source_type='manual_contract_confirmed' THEN cost_krw ELSE 0 END) AS confirmed_cost_krw,
  SUM(CASE WHEN source_type<>'manual_contract_confirmed' THEN cost_krw ELSE 0 END) AS renewal_assumption_cost_krw
FROM naver_brandsearch_manual_cost_daily
WHERE site='biocom' AND date BETWEEN ? AND ?
   OR site='thecleancoffee' AND date BETWEEN ? AND ?
GROUP BY site
ORDER BY site
""", [BIOCOM_SINCE, BIOCOM_UNTIL, COFFEE_SINCE, COFFEE_UNTIL])

landing_by_site = rows("""
SELECT
  site,
  COUNT(*) AS landing_rows
FROM site_landing_ledger
WHERE channel_classified='naver_brandsearch'
  AND (
    site='biocom' AND substr(landed_at, 1, 10) BETWEEN ? AND ?
    OR site='thecleancoffee' AND substr(landed_at, 1, 10) BETWEEN ? AND ?
  )
GROUP BY site
ORDER BY site
""", [BIOCOM_SINCE, BIOCOM_UNTIL, COFFEE_SINCE, COFFEE_UNTIL])

payment_raw = rows("""
SELECT
  lower(COALESCE(json_extract(metadata_json,'$.store'), json_extract(metadata_json,'$.site'), source, '')) AS site_hint,
  substr(approved_at, 1, 10) AS date,
  COUNT(*) AS payment_success_rows,
  SUM(COALESCE(
    CAST(json_extract(metadata_json,'$.totalAmount') AS INTEGER),
    CAST(json_extract(metadata_json,'$.value') AS INTEGER),
    CAST(json_extract(metadata_json,'$.amount') AS INTEGER),
    0
  )) AS payment_success_amount_krw
FROM attribution_ledger
WHERE touchpoint='payment_success'
  AND payment_status='confirmed'
  AND (
    lower(COALESCE(utm_source,'')) LIKE '%brandsearch%'
    OR lower(COALESCE(utm_medium,'')) LIKE '%brandsearch%'
    OR lower(COALESCE(utm_campaign,'')) LIKE '%brandsearch%'
    OR lower(COALESCE(utm_content,'')) LIKE '%brandsearch%'
    OR lower(COALESCE(source,'')) LIKE '%brandsearch%'
    OR lower(COALESCE(json_extract(metadata_json,'$.utm_source'),'')) LIKE '%brandsearch%'
    OR lower(COALESCE(json_extract(metadata_json,'$.utm_campaign'),'')) LIKE '%brandsearch%'
    OR lower(COALESCE(json_extract(metadata_json,'$.utmContent'),'')) LIKE '%brandsearch%'
  )
  AND substr(approved_at, 1, 10) BETWEEN ? AND ?
GROUP BY 1, 2
ORDER BY 1, 2
""", [min(BIOCOM_SINCE, COFFEE_SINCE), max(BIOCOM_UNTIL, COFFEE_UNTIL)])

marker_payment_acc = {}
for row in payment_raw:
    site_hint = (row.get("site_hint") or "").lower()
    date = row.get("date") or ""
    mapped_site = None
    for site, aliases in SITE_ALIASES.items():
        if site_hint in [alias.lower() for alias in aliases]:
            mapped_site = site
            break
    if not mapped_site:
        continue
    if mapped_site == "biocom" and not (BIOCOM_SINCE <= date <= BIOCOM_UNTIL):
        continue
    if mapped_site == "thecleancoffee" and not (COFFEE_SINCE <= date <= COFFEE_UNTIL):
        continue
    current = marker_payment_acc.setdefault(mapped_site, {"site": mapped_site, "payment_success_rows": 0, "payment_success_amount_krw": 0})
    current["payment_success_rows"] += int(row["payment_success_rows"] or 0)
    current["payment_success_amount_krw"] += int(row["payment_success_amount_krw"] or 0)

marker_payment_by_site = list(marker_payment_acc.values())

coffee_filter = """
WITH base AS (
  SELECT
    COALESCE(NULLIF(substr(complete_time, 1, 10), ''), NULLIF(substr(order_time, 1, 10), '')) AS source_date,
    COALESCE(NULLIF(payment_amount, 0), NULLIF(total_price, 0), 0) AS amount,
    lower(COALESCE(NULLIF(pay_type, ''), '(blank)')) AS pay_type_group,
    lower(COALESCE(imweb_status, '')) AS imweb_status_l,
    COALESCE(imweb_status, '') AS imweb_status_raw,
    order_time,
    synced_at,
    imweb_status_synced_at
  FROM imweb_orders
  WHERE site='thecleancoffee'
),
eligible AS (
  SELECT *
  FROM base
  WHERE source_date BETWEEN ? AND ?
    AND amount > 0
    AND NOT (
      imweb_status_l LIKE '%cancel%' OR imweb_status_l LIKE '%return%' OR imweb_status_l LIKE '%exchange%' OR imweb_status_l LIKE '%refund%'
      OR imweb_status_raw LIKE '%취소%' OR imweb_status_raw LIKE '%반품%' OR imweb_status_raw LIKE '%교환%' OR imweb_status_raw LIKE '%환불%'
    )
)
"""

coffee_summary = one(coffee_filter + """
SELECT
  COUNT(*) AS all_positive_orders,
  COALESCE(SUM(amount), 0) AS all_positive_revenue_krw,
  COUNT(*) FILTER (WHERE pay_type_group='npay') AS npay_primary_candidate_orders,
  COALESCE(SUM(CASE WHEN pay_type_group='npay' THEN amount ELSE 0 END), 0) AS npay_primary_candidate_revenue_krw,
  COUNT(*) FILTER (WHERE TRIM(COALESCE(imweb_status_raw, ''))='') AS status_blank_orders,
  COALESCE(SUM(CASE WHEN TRIM(COALESCE(imweb_status_raw, ''))='' THEN amount ELSE 0 END), 0) AS status_blank_revenue_krw,
  COALESCE(MAX(order_time), '') AS max_order_time,
  COALESCE(MAX(synced_at), '') AS max_synced_at,
  COALESCE(MAX(imweb_status_synced_at), '') AS max_status_synced_at
FROM eligible
""", [COFFEE_SINCE, COFFEE_UNTIL])

pay_type_breakdown = rows(coffee_filter + """
SELECT
  pay_type_group,
  COUNT(*) AS order_count,
  COALESCE(SUM(amount), 0) AS revenue_krw
FROM eligible
GROUP BY pay_type_group
ORDER BY revenue_krw DESC, pay_type_group
""", [COFFEE_SINCE, COFFEE_UNTIL])

coffee_warnings = []
if int(coffee_summary.get("status_blank_orders") or 0) > 0:
    coffee_warnings.append("coffee_imweb_status_blank_included_with_warning")
if not coffee_summary.get("max_status_synced_at"):
    coffee_warnings.append("coffee_imweb_status_sync_freshness_missing")

freshness = {
    "cost_cached_at_max": conn.execute("SELECT COALESCE(MAX(cached_at),'') FROM naver_brandsearch_manual_cost_daily").fetchone()[0],
    "landing_max_landed_at": conn.execute("SELECT COALESCE(MAX(landed_at),'') FROM site_landing_ledger").fetchone()[0],
    "attribution_max_logged_at": conn.execute("SELECT COALESCE(MAX(logged_at),'') FROM attribution_ledger").fetchone()[0],
    "coffee_imweb_max_order_time": conn.execute("SELECT COALESCE(MAX(order_time),'') FROM imweb_orders WHERE site='thecleancoffee'").fetchone()[0],
    "coffee_imweb_max_synced_at": conn.execute("SELECT COALESCE(MAX(synced_at),'') FROM imweb_orders WHERE site='thecleancoffee'").fetchone()[0],
    "coffee_imweb_max_status_synced_at": conn.execute("SELECT COALESCE(MAX(imweb_status_synced_at),'') FROM imweb_orders WHERE site='thecleancoffee'").fetchone()[0],
}

print(json.dumps({
    "ok": True,
    "generated_at_kst": datetime.datetime.utcnow().isoformat(timespec="seconds") + "Z",
    "requested_windows": {
        "biocom": {"since": BIOCOM_SINCE, "until": BIOCOM_UNTIL, "timezone": "KST"},
        "thecleancoffee": {"since": COFFEE_SINCE, "until": COFFEE_UNTIL, "timezone": "KST"},
    },
    "freshness": freshness,
    "cost_by_site": cost_by_site,
    "landing_by_site": landing_by_site,
    "marker_payment_by_site": marker_payment_by_site,
    "coffee_imweb_order_source": {
        "source": "VM Cloud SQLite imweb_orders(site='thecleancoffee')",
        "filter": "site=thecleancoffee, payment_amount/total_price>0, cancel/return/exchange/refund status excluded; status blank included with warning",
        "window": {"since": COFFEE_SINCE, "until": COFFEE_UNTIL, "timezone": "KST"},
        "all_positive_orders": int(coffee_summary.get("all_positive_orders") or 0),
        "all_positive_revenue_krw": int(coffee_summary.get("all_positive_revenue_krw") or 0),
        "npay_primary_candidate_orders": int(coffee_summary.get("npay_primary_candidate_orders") or 0),
        "npay_primary_candidate_revenue_krw": int(coffee_summary.get("npay_primary_candidate_revenue_krw") or 0),
        "status_blank_orders": int(coffee_summary.get("status_blank_orders") or 0),
        "status_blank_revenue_krw": int(coffee_summary.get("status_blank_revenue_krw") or 0),
        "max_order_time": coffee_summary.get("max_order_time") or "",
        "max_synced_at": coffee_summary.get("max_synced_at") or "",
        "max_status_synced_at": coffee_summary.get("max_status_synced_at") or "",
        "pay_type_breakdown": [
            {"pay_type_group": r["pay_type_group"], "order_count": int(r["order_count"] or 0), "revenue_krw": int(r["revenue_krw"] or 0)}
            for r in pay_type_breakdown
        ],
        "warnings": coffee_warnings,
    },
    "invariants_held": {
        "sqlite_mode": "read_only",
        "sqlite_write": 0,
        "backend_deploy_or_restart": 0,
        "platform_send": 0,
        "raw_identifier_selected": 0,
    },
}, ensure_ascii=False))
`;

const runVmRead = (options: CliOptions): VmPayload => {
  const python = buildVmPython(options);
  const sshTarget = `${options.vmUser}@${options.vmHost}`;
  const remoteCommand = `sudo -n -u ${options.vmRunAs} python3 -`;
  const result = spawnSync(
    "ssh",
    [
      "-i",
      options.vmKey,
      "-o",
      "IdentitiesOnly=yes",
      "-o",
      "BatchMode=yes",
      sshTarget,
      remoteCommand,
    ],
    {
      input: python,
      encoding: "utf8",
      maxBuffer: 20 * 1024 * 1024,
    },
  );

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`VM Cloud read failed: ${result.stderr || result.stdout || `exit ${result.status}`}`);
  }
  const parsed = JSON.parse(result.stdout) as VmPayload | { ok: false; error: string };
  if (!parsed.ok) {
    const errorMessage = "error" in parsed ? parsed.error : "VM Cloud read returned ok=false";
    throw new Error(errorMessage);
  }
  return parsed;
};

const findCost = (vm: VmPayload, site: string) =>
  vm.cost_by_site.find((row) => row.site === site) ?? {
    site,
    cost_krw: 0,
    confirmed_cost_krw: 0,
    renewal_assumption_cost_krw: 0,
  };

const findLanding = (vm: VmPayload, site: string) =>
  vm.landing_by_site.find((row) => row.site === site) ?? { site, landing_rows: 0 };

const findMarker = (vm: VmPayload, site: string) =>
  vm.marker_payment_by_site.find((row) => row.site === site) ?? {
    site,
    payment_success_rows: 0,
    payment_success_amount_krw: 0,
  };

const buildSiteCrossCheck = (
  site: "biocom" | "thecleancoffee",
  window: DateWindow,
  vm: VmPayload,
  orderSource: BiocomOrderSource | CoffeeImwebOrderSource,
): SiteCrossCheck => {
  const cost = findCost(vm, site);
  const landing = findLanding(vm, site);
  const marker = findMarker(vm, site);
  const revenue = "revenue_krw" in orderSource ? orderSource.revenue_krw : orderSource.npay_primary_candidate_revenue_krw;
  const orderCount = "order_count" in orderSource ? orderSource.order_count : orderSource.npay_primary_candidate_orders;
  const warnings = [...orderSource.warnings];
  if (marker.payment_success_amount_krw === 0) warnings.push("brandsearch_marker_payment_success_missing");
  if (site === "thecleancoffee") {
    warnings.push("coffee_order_source_reference_uses_npay_primary_candidate; all_positive_imweb_total_is_available_in_json");
  }

  return {
    site,
    effective_window: window,
    cost: {
      total_cost_krw: toNumber(cost.cost_krw),
      confirmed_contract_cost_krw: toNumber(cost.confirmed_cost_krw),
      renewal_assumption_cost_krw: toNumber(cost.renewal_assumption_cost_krw),
    },
    brandsearch_evidence: {
      landing_rows: toNumber(landing.landing_rows),
      vm_marker_payment_success_rows: toNumber(marker.payment_success_rows),
      vm_marker_payment_success_amount_krw: toNumber(marker.payment_success_amount_krw),
      marker_roas: roas(toNumber(marker.payment_success_amount_krw), toNumber(cost.cost_krw)),
    },
    order_source: orderSource,
    order_source_same_window_reference: {
      revenue_krw: revenue,
      order_count: orderCount,
      roas_if_all_same_window_orders_are_compared_to_brandsearch_cost: roas(revenue, toNumber(cost.cost_krw)),
      interpretation:
        "주문 정본 같은-window 총액이다. 브랜드검색 유입 주문만 확정한 값이 아니므로 marker 매출의 cross-check/상한 참고로만 본다.",
    },
    warnings,
  };
};

const buildOutput = (options: CliOptions, vm: VmPayload, biocomOrderSource: BiocomOrderSource): Output => {
  const biocom = buildSiteCrossCheck(
    "biocom",
    { since: options.biocomSince, until: options.biocomUntil, timezone: "KST" },
    vm,
    biocomOrderSource,
  );
  const coffee = buildSiteCrossCheck(
    "thecleancoffee",
    { since: options.coffeeSince, until: options.coffeeUntil, timezone: "KST" },
    vm,
    vm.coffee_imweb_order_source,
  );

  return {
    ok: true,
    schema_version: SCHEMA_VERSION,
    generated_at: new Date().toISOString(),
    mode: "read_only_no_send_no_write",
    source_policy: {
      cost_source: "VM Cloud SQLite naver_brandsearch_manual_cost_daily 수동 기간 배분 cache",
      brandsearch_evidence_source: "VM Cloud site_landing_ledger + attribution_ledger brandsearch marker",
      biocom_order_source_primary: "운영DB PostgreSQL public.tb_iamweb_users PAYMENT_COMPLETE",
      thecleancoffee_order_source_primary_candidate: "VM Cloud SQLite imweb_orders(site='thecleancoffee') / NPay primary candidate",
      caveats: [
        "브랜드검색 marker 매출은 click/order exact attribution이 아니라 유입 marker 기반 참고값이다.",
        "주문 정본 같은-window 총액은 브랜드검색으로 온 주문만의 확정 매출이 아니라 cross-check 상한/분모 sanity check다.",
        "운영DB write, VM Cloud write, 광고 플랫폼 전송, GTM publish는 실행하지 않는다.",
      ],
    },
    freshness: {
      ...vm.freshness,
      biocom_operating_db_max_source_date: biocomOrderSource.max_source_date,
    },
    by_site: [biocom, coffee],
    invariants_held: {
      ...vm.invariants_held,
      operating_db_mode: "read_only",
      operating_db_write: 0,
      vm_cloud_write: 0,
      backend_deploy_or_restart: 0,
      platform_send: 0,
      conversion_upload: 0,
      raw_identifier_output: 0,
    },
  };
};

const formatKrw = (value: number): string => `${Math.round(value).toLocaleString("ko-KR")}원`;

const main = async () => {
  const options = parseArgs(process.argv.slice(2));
  const pool = createPgPool();
  try {
    const [vm, biocomOrderSource] = await Promise.all([
      Promise.resolve(runVmRead(options)),
      queryBiocomOperatingDb(pool, options),
    ]);
    const output = buildOutput(options, vm, biocomOrderSource);

    if (options.output) {
      const outputPath = resolve(process.cwd(), options.output);
      mkdirSync(dirname(outputPath), { recursive: true });
      writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`);
    }

    if (options.json) {
      console.log(JSON.stringify(output, null, 2));
      return;
    }

    console.log("Naver brandsearch order-source cross-check");
    console.log(`mode: ${output.mode}`);
    for (const row of output.by_site) {
      console.log(
        `${row.site}: window=${row.effective_window.since}..${row.effective_window.until} ` +
        `cost=${formatKrw(row.cost.total_cost_krw)} ` +
        `marker=${row.brandsearch_evidence.vm_marker_payment_success_rows}/${formatKrw(row.brandsearch_evidence.vm_marker_payment_success_amount_krw)} ` +
        `order_source=${row.order_source_same_window_reference.order_count}/${formatKrw(row.order_source_same_window_reference.revenue_krw)} ` +
        `marker_roas=${row.brandsearch_evidence.marker_roas ?? "n/a"} ` +
        `order_source_ref_roas=${row.order_source_same_window_reference.roas_if_all_same_window_orders_are_compared_to_brandsearch_cost ?? "n/a"}`,
      );
    }
    if (options.output) console.log(`output: ${options.output}`);
  } finally {
    await pool.end();
  }
};

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
