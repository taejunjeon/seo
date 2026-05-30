#!/usr/bin/env tsx
/**
 * Naver brandsearch order-level bridge preview.
 *
 * Green Lane / read-only by design:
 * - VM Cloud SQLite is opened in read-only mode through SSH.
 * - 운영DB PostgreSQL is queried read-only for biocom order totals.
 * - Raw order/payment/member/click identifiers are never written or printed.
 * - Matching uses one-way SHA-256 hashes for order-key comparisons.
 */

import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import dotenv from "dotenv";
import { Pool } from "pg";

dotenv.config({ path: resolve(__dirname, "..", ".env"), quiet: true });
dotenv.config({ path: resolve(__dirname, "..", ".env.local"), quiet: true });

const SCHEMA_VERSION = "naver-brandsearch-order-bridge-preview-v1-20260525";
const DEFAULT_VM_HOST = "34.64.104.94";
const DEFAULT_VM_USER = "taejun";
const DEFAULT_VM_KEY = "~/.ssh/id_ed25519";
const DEFAULT_VM_DB = "/home/biocomkr_sns/seo/repo/backend/data/crm.sqlite3";
const DEFAULT_VM_RUN_AS = "biocomkr_sns";

type DateWindow = { since: string; until: string; timezone: "KST" };

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

type MarkerRow = {
  site: "biocom" | "thecleancoffee";
  markerDate: string;
  markerAmountKrw: number;
  orderKeyHashes: string[];
  hasOrderKeyCandidate: boolean;
  sessionBridgePresent: boolean;
};

type OrderRow = {
  site: "biocom" | "thecleancoffee";
  sourceDate: string;
  amountKrw: number;
  primaryHash: string;
  orderKeyHashes: string[];
  isNpay: boolean;
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
  marker_rows: MarkerRow[];
  coffee_order_rows: OrderRow[];
  site_landing: Array<{ site: "biocom" | "thecleancoffee"; landing_rows: number }>;
  cost_by_site: Array<{ site: "biocom" | "thecleancoffee"; cost_krw: number }>;
  invariants_held: Record<string, unknown>;
};

type BiocomPgOrderRow = {
  order_number: string;
  source_date: string;
  amount_krw: string;
  is_npay: boolean;
};

type BridgeClassification = {
  total_marker_rows: number;
  total_marker_amount_krw: number;
  marker_rows_with_order_key_candidate: number;
  marker_rows_with_session_bridge: number;
  exact_rows: number;
  exact_marker_amount_krw: number;
  exact_unique_order_count: number;
  exact_unique_order_revenue_krw: number;
  exact_amount_match_rows: number;
  exact_amount_mismatch_rows: number;
  probable_rows: number;
  probable_marker_amount_krw: number;
  ambiguous_rows: number;
  ambiguous_marker_amount_krw: number;
  no_bridge_rows: number;
  no_bridge_marker_amount_krw: number;
  exact_npay_rows: number;
  exact_non_npay_rows: number;
};

type SiteSummary = {
  site: "biocom" | "thecleancoffee";
  window: DateWindow;
  source: {
    cost_source: string;
    marker_source: string;
    order_source: string;
  };
  cost_krw: number;
  brandsearch_landing_rows: number;
  order_source_window: {
    order_count: number;
    revenue_krw: number;
    npay_order_count: number;
    npay_revenue_krw: number;
  };
  bridge: BridgeClassification;
  roas: {
    marker_roas: number | null;
    exact_order_bridge_roas: number | null;
    probable_included_roas: number | null;
    order_source_same_window_reference_roas: number | null;
  };
  interpretation: {
    decision: string;
    budget_use: string;
    next_bottleneck: string;
    confidence: "high" | "medium_high" | "medium" | "low";
  };
  warnings: string[];
};

type Output = {
  ok: true;
  schema_version: string;
  generated_at: string;
  mode: "read_only_no_send_no_write";
  source_policy: {
    plain_summary: string;
    caveats: string[];
  };
  freshness: VmPayload["freshness"] & {
    biocom_operating_db_max_source_date: string;
  };
  by_site: SiteSummary[];
  okr_progress: Array<{
    objective: string;
    key_result: string;
    progress_pct: number;
    status: "done" | "on_track" | "needs_work" | "blocked";
    evidence: string;
  }>;
  action_plan: Array<{
    priority: "P0" | "P1" | "P2";
    owner: "Codex" | "TJ님";
    action: string;
    why: string;
    lane: "Green" | "Yellow" | "Red";
    approval_required: boolean;
    success_criteria: string;
  }>;
  invariants_held: Record<string, unknown>;
};

const usage = () => `
Usage:
  npx tsx scripts/naver-brandsearch-order-bridge-preview.ts [options]

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
  if (!dates.every((value) => /^\d{4}-\d{2}-\d{2}$/.test(value))) throw new Error("date options must be YYYY-MM-DD");
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

const hashValue = (value: string): string => createHash("sha256").update(value).digest("hex");

const round2 = (value: number): number => Math.round(value * 100) / 100;

const roas = (revenue: number, cost: number): number | null => cost > 0 ? round2(revenue / cost) : null;

const daysApart = (left: string, right: string): number => {
  const l = new Date(`${left}T00:00:00.000Z`).getTime();
  const r = new Date(`${right}T00:00:00.000Z`).getTime();
  return Math.abs(l - r) / 86400000;
};

const unique = <T>(values: T[]): T[] => [...new Set(values)];

const pythonStringLiteral = (value: string): string => JSON.stringify(value);

const buildVmPython = (options: CliOptions): string => `
import sqlite3, json, datetime, hashlib, re

DB = ${pythonStringLiteral(options.vmDb)}
BIOCOM_SINCE = ${pythonStringLiteral(options.biocomSince)}
BIOCOM_UNTIL = ${pythonStringLiteral(options.biocomUntil)}
COFFEE_SINCE = ${pythonStringLiteral(options.coffeeSince)}
COFFEE_UNTIL = ${pythonStringLiteral(options.coffeeUntil)}
SITE_ALIASES = {"biocom": ["biocom"], "thecleancoffee": ["thecleancoffee", "coffee"]}

conn = sqlite3.connect(f"file:{DB}?mode=ro", uri=True)
conn.row_factory = sqlite3.Row

def rows(sql, params=()):
    return [dict(r) for r in conn.execute(sql, params).fetchall()]

def table_exists(name):
    return conn.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (name,)).fetchone() is not None

def h(value):
    value = str(value or "").strip()
    return hashlib.sha256(value.encode("utf-8")).hexdigest() if value else ""

def clean(value):
    return str(value or "").strip()

def order_id_base(value):
    value = clean(value)
    if not value:
        return ""
    return re.sub(r"(-|_)?P\\d+$", "", value, flags=re.I)

def metadata_value(raw, *keys):
    if not raw:
        return ""
    try:
        obj = json.loads(raw)
    except Exception:
        return ""
    for key in keys:
        cur = obj
        ok = True
        for part in key.split("."):
            if isinstance(cur, dict) and part in cur:
                cur = cur[part]
            else:
                ok = False
                break
        if ok and clean(cur):
            return clean(cur)
    return ""

for name in ["naver_brandsearch_manual_cost_daily", "site_landing_ledger", "attribution_ledger", "imweb_orders"]:
    if not table_exists(name):
        raise SystemExit(json.dumps({"ok": False, "error": f"{name} table missing"}, ensure_ascii=False))

cost_by_site = rows("""
SELECT site, SUM(cost_krw) AS cost_krw
FROM naver_brandsearch_manual_cost_daily
WHERE (site='biocom' AND date BETWEEN ? AND ?)
   OR (site='thecleancoffee' AND date BETWEEN ? AND ?)
GROUP BY site
ORDER BY site
""", [BIOCOM_SINCE, BIOCOM_UNTIL, COFFEE_SINCE, COFFEE_UNTIL])

site_landing = rows("""
SELECT site, COUNT(*) AS landing_rows
FROM site_landing_ledger
WHERE channel_classified='naver_brandsearch'
  AND (
    (site='biocom' AND substr(landed_at, 1, 10) BETWEEN ? AND ?)
    OR (site='thecleancoffee' AND substr(landed_at, 1, 10) BETWEEN ? AND ?)
  )
GROUP BY site
ORDER BY site
""", [BIOCOM_SINCE, BIOCOM_UNTIL, COFFEE_SINCE, COFFEE_UNTIL])

landing_sessions = {}
for r in rows("""
SELECT site, ga_session_id, client_id, local_session_id_hash
FROM site_landing_ledger
WHERE channel_classified='naver_brandsearch'
  AND (
    (site='biocom' AND substr(landed_at, 1, 10) BETWEEN ? AND ?)
    OR (site='thecleancoffee' AND substr(landed_at, 1, 10) BETWEEN ? AND ?)
  )
""", [BIOCOM_SINCE, BIOCOM_UNTIL, COFFEE_SINCE, COFFEE_UNTIL]):
    site = r["site"]
    landing_sessions.setdefault(site, set())
    for key in ["ga_session_id", "client_id", "local_session_id_hash"]:
        v = clean(r.get(key))
        if v:
            landing_sessions[site].add(h(v))

payment_rows = rows("""
SELECT
  entry_id,
  lower(COALESCE(json_extract(metadata_json,'$.store'), json_extract(metadata_json,'$.site'), source, '')) AS site_hint,
  substr(approved_at, 1, 10) AS marker_date,
  COALESCE(
    CAST(json_extract(metadata_json,'$.totalAmount') AS INTEGER),
    CAST(json_extract(metadata_json,'$.value') AS INTEGER),
    CAST(json_extract(metadata_json,'$.amount') AS INTEGER),
    0
  ) AS marker_amount_krw,
  order_id,
  ga_session_id,
  customer_key,
  metadata_json
FROM attribution_ledger
WHERE touchpoint='payment_success'
  AND payment_status='confirmed'
  AND substr(approved_at, 1, 10) BETWEEN ? AND ?
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
ORDER BY approved_at
""", [min(BIOCOM_SINCE, COFFEE_SINCE), max(BIOCOM_UNTIL, COFFEE_UNTIL)])

marker_rows = []
for r in payment_rows:
    site_hint = clean(r.get("site_hint")).lower()
    mapped_site = None
    for site, aliases in SITE_ALIASES.items():
        if site_hint in [a.lower() for a in aliases]:
            mapped_site = site
            break
    if not mapped_site:
        continue
    marker_date = clean(r.get("marker_date"))
    if mapped_site == "biocom" and not (BIOCOM_SINCE <= marker_date <= BIOCOM_UNTIL):
        continue
    if mapped_site == "thecleancoffee" and not (COFFEE_SINCE <= marker_date <= COFFEE_UNTIL):
        continue

    raw = r.get("metadata_json") or ""
    candidates = [
        order_id_base(r.get("order_id")),
        metadata_value(raw, "orderNo", "order_no", "referrerPayment.orderNo"),
        metadata_value(raw, "orderId", "order_id", "referrerPayment.orderId"),
        metadata_value(raw, "orderCode", "order_code", "referrerPayment.orderCode"),
        metadata_value(raw, "channelOrderNo", "channel_order_no"),
    ]
    candidate_hashes = sorted(set([h(v) for v in candidates if clean(v)]))
    session_hashes = set()
    for key in ["ga_session_id", "customer_key"]:
        v = clean(r.get(key))
        if v:
            session_hashes.add(h(v))
    session_bridge_present = bool(session_hashes.intersection(landing_sessions.get(mapped_site, set())))

    marker_rows.append({
        "site": mapped_site,
        "markerDate": marker_date,
        "markerAmountKrw": int(r.get("marker_amount_krw") or 0),
        "orderKeyHashes": candidate_hashes,
        "hasOrderKeyCandidate": bool(candidate_hashes),
        "sessionBridgePresent": session_bridge_present,
    })

coffee_order_rows = []
for r in rows("""
WITH base AS (
  SELECT
    COALESCE(NULLIF(substr(complete_time, 1, 10), ''), NULLIF(substr(order_time, 1, 10), '')) AS source_date,
    COALESCE(NULLIF(payment_amount, 0), NULLIF(total_price, 0), 0) AS amount,
    order_no,
    order_code,
    channel_order_no,
    lower(COALESCE(NULLIF(pay_type, ''), '(blank)')) AS pay_type_group,
    lower(COALESCE(imweb_status, '')) AS imweb_status_l,
    COALESCE(imweb_status, '') AS imweb_status_raw
  FROM imweb_orders
  WHERE site='thecleancoffee'
)
SELECT *
FROM base
WHERE source_date BETWEEN ? AND ?
  AND amount > 0
  AND NOT (
    imweb_status_l LIKE '%cancel%' OR imweb_status_l LIKE '%return%' OR imweb_status_l LIKE '%exchange%' OR imweb_status_l LIKE '%refund%'
    OR imweb_status_raw LIKE '%취소%' OR imweb_status_raw LIKE '%반품%' OR imweb_status_raw LIKE '%교환%' OR imweb_status_raw LIKE '%환불%'
  )
""", [COFFEE_SINCE, COFFEE_UNTIL]):
    candidates = [clean(r.get("order_no")), clean(r.get("order_code")), clean(r.get("channel_order_no"))]
    hashes = sorted(set([h(v) for v in candidates if v]))
    primary = hashes[0] if hashes else h(json.dumps([r.get("source_date"), r.get("amount"), r.get("pay_type_group")], ensure_ascii=False))
    coffee_order_rows.append({
        "site": "thecleancoffee",
        "sourceDate": clean(r.get("source_date")),
        "amountKrw": int(r.get("amount") or 0),
        "primaryHash": primary,
        "orderKeyHashes": hashes,
        "isNpay": clean(r.get("pay_type_group")).lower() == "npay",
    })

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
    "marker_rows": marker_rows,
    "coffee_order_rows": coffee_order_rows,
    "site_landing": site_landing,
    "cost_by_site": cost_by_site,
    "invariants_held": {
        "sqlite_mode": "read_only",
        "sqlite_write": 0,
        "backend_deploy_or_restart": 0,
        "platform_send": 0,
        "raw_identifier_output": 0,
        "order_key_hash_mode": "sha256_one_way",
    },
}, ensure_ascii=False))
`;

const runVmRead = (options: CliOptions): VmPayload => {
  const result = spawnSync(
    "ssh",
    [
      "-i",
      options.vmKey,
      "-o",
      "IdentitiesOnly=yes",
      "-o",
      "BatchMode=yes",
      `${options.vmUser}@${options.vmHost}`,
      `sudo -n -u ${options.vmRunAs} python3 -`,
    ],
    {
      input: buildVmPython(options),
      encoding: "utf8",
      maxBuffer: 30 * 1024 * 1024,
    },
  );

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`VM Cloud read failed: ${result.stderr || result.stdout || `exit ${result.status}`}`);
  }
  const parsed = JSON.parse(result.stdout) as VmPayload | { ok: false; error: string };
  if (!parsed.ok) throw new Error("error" in parsed ? parsed.error : "VM Cloud read returned ok=false");
  return parsed;
};

const queryBiocomOrders = async (pool: Pool, options: CliOptions): Promise<{ rows: OrderRow[]; maxSourceDate: string }> => {
  const result = await pool.query<BiocomPgOrderRow>(
    `
    WITH raw AS (
      SELECT
        order_number::text AS order_number,
        CASE
          WHEN TRIM(COALESCE(payment_complete_time::text, '')) ~ '^\\d{4}-\\d{2}-\\d{2}'
            THEN SUBSTRING(TRIM(payment_complete_time::text), 1, 10)::date
          WHEN TRIM(COALESCE(order_date::text, '')) ~ '^\\d{4}-\\d{2}-\\d{2}'
            THEN SUBSTRING(TRIM(order_date::text), 1, 10)::date
          ELSE NULL
        END AS source_date,
        COALESCE(NULLIF(final_order_amount, 0), NULLIF(paid_price, 0), NULLIF(total_price, 0), 0)::numeric AS amount,
        COALESCE(NULLIF(TRIM(payment_method::text), ''), '(blank)') AS payment_method,
        COALESCE(NULLIF(TRIM(cancellation_reason::text), ''), '') AS cancellation_reason,
        COALESCE(NULLIF(TRIM(return_reason::text), ''), '') AS return_reason
      FROM public.tb_iamweb_users
      WHERE order_number IS NOT NULL
        AND UPPER(COALESCE(NULLIF(TRIM(payment_status::text), ''), '')) = 'PAYMENT_COMPLETE'
    ),
    order_level AS (
      SELECT
        order_number,
        MIN(source_date) AS source_date,
        MAX(amount) AS amount_krw,
        MAX(payment_method) AS payment_method,
        BOOL_OR(LOWER(COALESCE(cancellation_reason, '')) NOT IN ('', 'nan', 'null')) AS has_cancel,
        BOOL_OR(LOWER(COALESCE(return_reason, '')) NOT IN ('', 'nan', 'null')) AS has_return
      FROM raw
      WHERE source_date BETWEEN $1::date AND $2::date
      GROUP BY order_number
    )
    SELECT
      order_number,
      source_date::text,
      amount_krw::text,
      (payment_method ~* '(naver|npay)' OR payment_method LIKE '%네이버%') AS is_npay
    FROM order_level
    WHERE amount_krw > 0
      AND has_cancel = FALSE
      AND has_return = FALSE
    `,
    [options.biocomSince, options.biocomUntil],
  );

  const rows = result.rows.map((row) => {
    const primaryHash = hashValue(row.order_number.trim());
    return {
      site: "biocom" as const,
      sourceDate: row.source_date,
      amountKrw: Number(row.amount_krw) || 0,
      primaryHash,
      orderKeyHashes: [primaryHash],
      isNpay: row.is_npay,
    };
  });
  const maxSourceDate = rows.reduce((max, row) => row.sourceDate > max ? row.sourceDate : max, "");
  return { rows, maxSourceDate };
};

const classifyBridge = (markers: MarkerRow[], orders: OrderRow[]): BridgeClassification => {
  const exactMatchedOrderHashes = new Set<string>();
  const exactMatchedOrderRevenue = new Map<string, number>();
  const orderByHash = new Map<string, OrderRow[]>();
  for (const order of orders) {
    for (const hash of order.orderKeyHashes) {
      const list = orderByHash.get(hash) ?? [];
      list.push(order);
      orderByHash.set(hash, list);
    }
  }

  const summary: BridgeClassification = {
    total_marker_rows: markers.length,
    total_marker_amount_krw: 0,
    marker_rows_with_order_key_candidate: 0,
    marker_rows_with_session_bridge: 0,
    exact_rows: 0,
    exact_marker_amount_krw: 0,
    exact_unique_order_count: 0,
    exact_unique_order_revenue_krw: 0,
    exact_amount_match_rows: 0,
    exact_amount_mismatch_rows: 0,
    probable_rows: 0,
    probable_marker_amount_krw: 0,
    ambiguous_rows: 0,
    ambiguous_marker_amount_krw: 0,
    no_bridge_rows: 0,
    no_bridge_marker_amount_krw: 0,
    exact_npay_rows: 0,
    exact_non_npay_rows: 0,
  };

  for (const marker of markers) {
    summary.total_marker_amount_krw += marker.markerAmountKrw;
    if (marker.hasOrderKeyCandidate) summary.marker_rows_with_order_key_candidate += 1;
    if (marker.sessionBridgePresent) summary.marker_rows_with_session_bridge += 1;

    const exactOrders = unique(marker.orderKeyHashes.flatMap((hash) => orderByHash.get(hash) ?? []));
    if (exactOrders.length > 0) {
      summary.exact_rows += 1;
      summary.exact_marker_amount_krw += marker.markerAmountKrw;
      if (exactOrders.some((order) => order.amountKrw === marker.markerAmountKrw)) {
        summary.exact_amount_match_rows += 1;
      } else {
        summary.exact_amount_mismatch_rows += 1;
      }
      if (exactOrders.some((order) => order.isNpay)) summary.exact_npay_rows += 1;
      else summary.exact_non_npay_rows += 1;
      for (const order of exactOrders) {
        exactMatchedOrderHashes.add(order.primaryHash);
        exactMatchedOrderRevenue.set(order.primaryHash, order.amountKrw);
      }
      continue;
    }

    const probableOrders = orders.filter((order) =>
      order.amountKrw === marker.markerAmountKrw && daysApart(order.sourceDate, marker.markerDate) <= 1,
    );
    if (probableOrders.length === 1) {
      summary.probable_rows += 1;
      summary.probable_marker_amount_krw += marker.markerAmountKrw;
      continue;
    }
    if (probableOrders.length > 1) {
      summary.ambiguous_rows += 1;
      summary.ambiguous_marker_amount_krw += marker.markerAmountKrw;
      continue;
    }

    summary.no_bridge_rows += 1;
    summary.no_bridge_marker_amount_krw += marker.markerAmountKrw;
  }

  summary.exact_unique_order_count = exactMatchedOrderHashes.size;
  summary.exact_unique_order_revenue_krw = [...exactMatchedOrderRevenue.values()].reduce((total, value) => total + value, 0);
  return summary;
};

const siteCost = (vm: VmPayload, site: "biocom" | "thecleancoffee") =>
  Number(vm.cost_by_site.find((row) => row.site === site)?.cost_krw ?? 0);

const siteLanding = (vm: VmPayload, site: "biocom" | "thecleancoffee") =>
  Number(vm.site_landing.find((row) => row.site === site)?.landing_rows ?? 0);

const buildSiteSummary = (
  site: "biocom" | "thecleancoffee",
  window: DateWindow,
  vm: VmPayload,
  markers: MarkerRow[],
  orders: OrderRow[],
  orderSource: string,
): SiteSummary => {
  const cost = siteCost(vm, site);
  const bridge = classifyBridge(markers, orders);
  const orderRevenue = orders.reduce((total, order) => total + order.amountKrw, 0);
  const npayOrders = orders.filter((order) => order.isNpay);
  const exactPlusProbableAmount = bridge.exact_marker_amount_krw + bridge.probable_marker_amount_krw;
  const warnings: string[] = [];
  if (bridge.no_bridge_rows > 0) warnings.push("marker_rows_without_order_bridge");
  if (bridge.ambiguous_rows > 0) warnings.push("amount_time_ambiguous_rows_present");
  if (site === "thecleancoffee") warnings.push("coffee_bridge_uses_vm_cloud_imweb_orders_primary_candidate");

  const exactRate = bridge.total_marker_rows > 0 ? bridge.exact_rows / bridge.total_marker_rows : 0;
  const confidence = exactRate >= 0.95 ? "medium_high" : exactRate >= 0.75 ? "medium" : "low";
  const decision = bridge.exact_rows === bridge.total_marker_rows
    ? "현재 marker row는 모두 주문 정본과 주문키로 연결된다."
    : "일부 marker row는 주문키가 없거나 금액/날짜 후보만 있어 exact ROAS 승격 전 보강이 필요하다.";

  return {
    site,
    window,
    source: {
      cost_source: "VM Cloud naver_brandsearch_manual_cost_daily",
      marker_source: "VM Cloud attribution_ledger payment_success confirmed with brandsearch marker",
      order_source: orderSource,
    },
    cost_krw: cost,
    brandsearch_landing_rows: siteLanding(vm, site),
    order_source_window: {
      order_count: orders.length,
      revenue_krw: orderRevenue,
      npay_order_count: npayOrders.length,
      npay_revenue_krw: npayOrders.reduce((total, order) => total + order.amountKrw, 0),
    },
    bridge,
    roas: {
      marker_roas: roas(bridge.total_marker_amount_krw, cost),
      exact_order_bridge_roas: roas(bridge.exact_marker_amount_krw, cost),
      probable_included_roas: roas(exactPlusProbableAmount, cost),
      order_source_same_window_reference_roas: roas(orderRevenue, cost),
    },
    interpretation: {
      decision,
      budget_use: "exact_order_bridge_roas만 내부 confirmed 후보로 승격 가능하다. probable은 검토용, same-window order source ROAS는 sanity check다.",
      next_bottleneck: "브랜드검색 비용을 리포트 API에 붙이기 전 exact/probable/ambiguous 분류를 화면에서 분리해야 한다.",
      confidence,
    },
    warnings,
  };
};

const buildOutput = (vm: VmPayload, biocomOrders: OrderRow[], biocomMaxSourceDate: string, options: CliOptions): Output => {
  const biocomMarkers = vm.marker_rows.filter((row) => row.site === "biocom");
  const coffeeMarkers = vm.marker_rows.filter((row) => row.site === "thecleancoffee");
  const biocom = buildSiteSummary(
    "biocom",
    { since: options.biocomSince, until: options.biocomUntil, timezone: "KST" },
    vm,
    biocomMarkers,
    biocomOrders,
    "운영DB PostgreSQL public.tb_iamweb_users PAYMENT_COMPLETE",
  );
  const coffee = buildSiteSummary(
    "thecleancoffee",
    { since: options.coffeeSince, until: options.coffeeUntil, timezone: "KST" },
    vm,
    coffeeMarkers,
    vm.coffee_order_rows,
    "VM Cloud SQLite imweb_orders(site='thecleancoffee') positive orders",
  );

  return {
    ok: true,
    schema_version: SCHEMA_VERSION,
    generated_at: new Date().toISOString(),
    mode: "read_only_no_send_no_write",
    source_policy: {
      plain_summary: "브랜드검색 유입 marker가 붙은 결제완료 row를 주문 정본과 주문키 hash로 비교한다.",
      caveats: [
        "exact_order_bridge_roas is the only metric that can be promoted toward internal confirmed ROAS.",
        "probable rows require human/data review before budget decisions.",
        "same-window order-source ROAS is a sanity check, not brandsearch-attributed revenue.",
        "Raw identifiers are not written to output artifacts.",
      ],
    },
    freshness: {
      ...vm.freshness,
      biocom_operating_db_max_source_date: biocomMaxSourceDate,
    },
    by_site: [biocom, coffee],
    okr_progress: [
      {
        objective: "Naver 브랜드검색을 비용과 실제 주문 기준으로 분리해 예산 판단 가능 상태로 만든다.",
        key_result: "KR1 비용 source를 수동 계약 기간 배분 cache로 고정",
        progress_pct: 100,
        status: "done",
        evidence: "manual cost cache 적재 및 reader preview 완료",
      },
      {
        objective: "Naver 브랜드검색을 비용과 실제 주문 기준으로 분리해 예산 판단 가능 상태로 만든다.",
        key_result: "KR2 브랜드검색 marker ROAS를 site/window별로 산출",
        progress_pct: 90,
        status: "on_track",
        evidence: "biocom/thecleancoffee marker ROAS 산출 완료",
      },
      {
        objective: "Naver 브랜드검색을 비용과 실제 주문 기준으로 분리해 예산 판단 가능 상태로 만든다.",
        key_result: "KR3 주문 정본과 marker를 주문 단위로 bridge",
        progress_pct: Math.round(((biocom.bridge.exact_rows + coffee.bridge.exact_rows) / Math.max(1, biocom.bridge.total_marker_rows + coffee.bridge.total_marker_rows)) * 100),
        status: biocom.bridge.no_bridge_rows + coffee.bridge.no_bridge_rows === 0 ? "on_track" : "needs_work",
        evidence: "exact/probable/ambiguous/no_bridge preview 생성",
      },
      {
        objective: "Naver 브랜드검색을 비용과 실제 주문 기준으로 분리해 예산 판단 가능 상태로 만든다.",
        key_result: "KR4 운영자가 볼 수 있는 Naver ROAS 화면 제공",
        progress_pct: 90,
        status: "on_track",
        evidence: "frontend report page local 구현 완료, 검증 단계",
      },
    ],
    action_plan: [
      {
        priority: "P0",
        owner: "Codex",
        action: "Naver ROAS 프론트엔드에 marker ROAS, exact bridge ROAS, 주문 정본 sanity check를 분리 표시",
        why: "플랫폼 주장값과 내부 주문 정본을 섞지 않기 위해서다.",
        lane: "Green",
        approval_required: false,
        success_criteria: "브랜드검색 ROAS 화면에서 site별 비용, exact bridge, warning, OKR, 액션플랜을 한 번에 본다.",
      },
      {
        priority: "P1",
        owner: "Codex",
        action: "리포트 API 연결 승인안 작성",
        why: "로컬 JSON이 아니라 운영 dashboard에서 자동 갱신하려면 backend route 연결이 필요하다.",
        lane: "Yellow",
        approval_required: true,
        success_criteria: "배포 전/후 snapshot, rollback, no-send 검증이 문서화된다.",
      },
      {
        priority: "P2",
        owner: "TJ님",
        action: "다음 브랜드검색 계약 갱신 금액 확인",
        why: "현재 다음 기간은 동일 가격/기간 갱신 가정이므로 실제 계약이 바뀌면 비용 cache가 달라진다.",
        lane: "Green",
        approval_required: false,
        success_criteria: "다음 기간 모바일/PC 금액과 기간이 확인된다.",
      },
    ],
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
    const [vm, biocom] = await Promise.all([
      Promise.resolve(runVmRead(options)),
      queryBiocomOrders(pool, options),
    ]);
    const output = buildOutput(vm, biocom.rows, biocom.maxSourceDate, options);

    if (options.output) {
      const outputPath = resolve(process.cwd(), options.output);
      mkdirSync(dirname(outputPath), { recursive: true });
      writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`);
    }

    if (options.json) {
      console.log(JSON.stringify(output, null, 2));
      return;
    }

    console.log("Naver brandsearch order bridge preview");
    console.log(`mode: ${output.mode}`);
    for (const site of output.by_site) {
      console.log(
        `${site.site}: marker=${site.bridge.total_marker_rows}/${formatKrw(site.bridge.total_marker_amount_krw)} ` +
        `exact=${site.bridge.exact_rows}/${formatKrw(site.bridge.exact_marker_amount_krw)} ` +
        `probable=${site.bridge.probable_rows}/${formatKrw(site.bridge.probable_marker_amount_krw)} ` +
        `ambiguous=${site.bridge.ambiguous_rows} no_bridge=${site.bridge.no_bridge_rows} ` +
        `exact_roas=${site.roas.exact_order_bridge_roas ?? "n/a"}`,
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
