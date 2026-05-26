#!/usr/bin/env tsx
/**
 * Naver performance display internal bridge requirements preview.
 *
 * Green Lane / read-only by design:
 * - Reads committed Hermes XLSX aggregate JSON for Naver display cost.
 * - Reads VM Cloud SQLite through SSH in read-only mode.
 * - Reads operating PostgreSQL only for biocom order cross-check.
 * - Writes aggregate-only JSON/Markdown outputs.
 * - No raw order/payment/member/click identifiers are printed or written.
 */

import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import dotenv from "dotenv";
import { Pool } from "pg";

dotenv.config({ path: path.resolve(__dirname, "..", ".env"), quiet: true });
dotenv.config({ path: path.resolve(__dirname, "..", ".env.local"), quiet: true });

const SCHEMA_VERSION = "naver-display-internal-bridge-requirements-preview-v1-20260526";
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const DISPLAY_COST_ARTIFACT = "data/project/naver-display-april-hermes-result-20260526.json";
const DEFAULT_JSON_OUTPUT = "data/project/naver-display-internal-bridge-requirements-20260526.json";
const DEFAULT_MD_OUTPUT = "project/naver-display-internal-bridge-requirements-20260526.md";
const DEFAULT_VM_HOST = "34.64.104.94";
const DEFAULT_VM_USER = "taejun";
const DEFAULT_VM_KEY = "~/.ssh/id_ed25519";
const DEFAULT_VM_DB = "/home/biocomkr_sns/seo/repo/backend/data/crm.sqlite3";
const DEFAULT_VM_RUN_AS = "biocomkr_sns";

type Site = "biocom" | "thecleancoffee";

type Options = {
  since: string;
  until: string;
  jsonOutput: string;
  mdOutput: string;
  printJson: boolean;
  vmHost: string;
  vmUser: string;
  vmKey: string;
  vmDb: string;
  vmRunAs: string;
};

type DisplayCostSite = {
  site: Site;
  spend_krw: number;
  naver_claim_conversion_revenue_krw: number;
  naver_claim_roas_percent: number;
  clicks: number;
  active_campaigns: number;
  campaigns?: Array<{
    campaign_id?: string;
    campaign_name?: string;
    spend_krw?: number;
  }>;
};

type DisplayCostArtifact = {
  requested_window?: { since?: string; until?: string; timezone?: string };
  freshness?: Record<string, unknown>;
  validation?: Record<string, unknown>;
  by_site?: DisplayCostSite[];
  totals?: { all_display?: Record<string, unknown> };
};

type MarkerRow = {
  site: Site;
  markerDate: string;
  markerAmountKrw: number;
  orderKeyHashes: string[];
  hasOrderKeyCandidate: boolean;
  markerReason: string;
};

type OrderRow = {
  site: Site;
  sourceDate: string;
  amountKrw: number;
  primaryHash: string;
  orderKeyHashes: string[];
  isNpay: boolean;
};

type VmPayload = {
  ok: true;
  generated_at: string;
  requested_window: { since: string; until: string; timezone: "KST" };
  display_campaign_ids: string[];
  freshness: {
    attribution_max_logged_at: string;
    site_landing_max_landed_at: string;
    coffee_imweb_max_order_time: string;
    coffee_imweb_max_synced_at: string;
    coffee_imweb_max_status_synced_at: string;
  };
  attribution_marker_summary: Array<{
    site: string;
    touchpoint: string;
    paymentStatus: string;
    markerReason: string;
    rows: number;
    bridgeKeyPresent: number;
    amountSumKrw: number;
  }>;
  site_landing_summary: Array<{
    site: string;
    markerReason: string;
    rows: number;
  }>;
  marker_rows: MarkerRow[];
  coffee_order_rows: OrderRow[];
  invariants_held: Record<string, unknown>;
};

type BridgeSummary = {
  marker_rows: number;
  marker_amount_krw: number;
  marker_rows_with_order_key: number;
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

type SiteOutput = {
  site: Site;
  source_policy: {
    cost_source: string;
    marker_source: string;
    order_source: string;
  };
  window: { since: string; until: string; timezone: "KST" };
  naver_platform_claim: {
    spend_krw: number;
    conversion_revenue_krw: number;
    roas_percent: number;
    clicks: number;
    active_campaigns: number;
  };
  internal_bridge: BridgeSummary;
  internal_confirmed_roas: {
    exact_order_bridge_roas_multiple: number | null;
    exact_order_bridge_roas_percent: number | null;
    marker_amount_roas_multiple: number | null;
    budget_use: "ready_for_budget_floor" | "partial_not_budget_ready" | "not_ready";
  };
  gap: {
    naver_claim_minus_exact_bridge_revenue_krw: number | null;
    exact_bridge_revenue_share_of_naver_claim_pct: number | null;
  };
  interpretation: {
    status: "source_ready_bridge_missing" | "partial_bridge_candidate" | "bridge_ready_floor";
    plain: string;
    confidence: "high" | "medium_high" | "medium" | "low";
  };
  warnings: string[];
};

type Output = {
  ok: true;
  schema_version: string;
  generated_at: string;
  mode: "read_only_no_send_no_write";
  requested_window: { since: string; until: string; timezone: "KST" };
  harness_preflight: Record<string, unknown>;
  plain_summary: string;
  by_site: SiteOutput[];
  totals: {
    spend_krw: number;
    naver_claim_conversion_revenue_krw: number;
    exact_order_bridge_revenue_krw: number;
    naver_claim_roas_percent: number | null;
    exact_order_bridge_roas_percent: number | null;
  };
  bridge_work_required: Array<{
    priority: "P0" | "P1" | "P2";
    name: string;
    what: string;
    why: string;
    lane: "Green" | "Yellow" | "Red";
    approval_required: boolean;
    success_criteria: string;
  }>;
  source_window_freshness_confidence: {
    source: string;
    window: string;
    freshness: Record<string, unknown>;
    confidence: string;
  };
  validation: Record<string, unknown>;
  invariants_held: Record<string, unknown>;
};

type BiocomPgOrderRow = {
  order_number: string;
  source_date: string;
  amount_krw: string;
  is_npay: boolean;
};

const usage = () => `
Usage:
  npx tsx scripts/naver-display-internal-bridge-requirements-preview.ts [options]

Options:
  --since=YYYY-MM-DD       Inclusive KST start. Default: 2026-04-01
  --until=YYYY-MM-DD       Inclusive KST end. Default: 2026-04-30
  --json-output=path       Default: ${DEFAULT_JSON_OUTPUT}
  --md-output=path         Default: ${DEFAULT_MD_OUTPUT}
  --json                   Print JSON only
  --vm-host=host           VM Cloud host. Default: ${DEFAULT_VM_HOST}
  --vm-user=user           SSH user. Default: ${DEFAULT_VM_USER}
  --vm-key=path            SSH key. Default: ${DEFAULT_VM_KEY}
  --vm-db=path             VM SQLite path. Default: ${DEFAULT_VM_DB}
  --vm-run-as=user         sudo -u user. Default: ${DEFAULT_VM_RUN_AS}
  --help                   Show help
`;

const parseArgs = (argv: string[]): Options => {
  const options: Options = {
    since: "2026-04-01",
    until: "2026-04-30",
    jsonOutput: DEFAULT_JSON_OUTPUT,
    mdOutput: DEFAULT_MD_OUTPUT,
    printJson: false,
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
      options.printJson = true;
      continue;
    }
    if (arg.startsWith("--since=")) {
      options.since = arg.slice("--since=".length).trim();
      continue;
    }
    if (arg.startsWith("--until=")) {
      options.until = arg.slice("--until=".length).trim();
      continue;
    }
    if (arg.startsWith("--json-output=")) {
      options.jsonOutput = arg.slice("--json-output=".length).trim();
      continue;
    }
    if (arg.startsWith("--md-output=")) {
      options.mdOutput = arg.slice("--md-output=".length).trim();
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

  for (const date of [options.since, options.until]) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("date options must be YYYY-MM-DD");
  }
  if (options.since > options.until) throw new Error("--since must be <= --until");
  return options;
};

const hashValue = (value: string): string => createHash("sha256").update(value).digest("hex");

const normalizeDatabaseUrl = (value: string): string => value.replace(/^postgresql\+asyncpg:\/\//, "postgresql://");

const createPgPool = (): Pool | null => {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) return null;
  return new Pool({ connectionString: normalizeDatabaseUrl(databaseUrl), max: 1 });
};

const readDisplayCostArtifact = (): DisplayCostArtifact => {
  const fullPath = path.resolve(REPO_ROOT, DISPLAY_COST_ARTIFACT);
  return JSON.parse(readFileSync(fullPath, "utf8")) as DisplayCostArtifact;
};

const numberValue = (value: unknown): number => (
  typeof value === "number" && Number.isFinite(value) ? value : 0
);

const round2 = (value: number): number => Math.round(value * 100) / 100;

const roasMultiple = (revenue: number, spend: number): number | null => spend > 0 ? round2(revenue / spend) : null;

const roasPercent = (revenue: number, spend: number): number | null => spend > 0 ? round2((revenue / spend) * 100) : null;

const formatKrw = (value: number): string => `${Math.round(value).toLocaleString("ko-KR")}원`;

const kstTimestamp = (): string =>
  new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date()).replace(" ", " ");

const addDays = (date: string, days: number): string => {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
};

const kstDateToUtcIso = (date: string): string => new Date(`${date}T00:00:00+09:00`).toISOString();

const daysApart = (left: string, right: string): number => {
  if (!left || !right) return Number.POSITIVE_INFINITY;
  const l = new Date(`${left}T00:00:00.000Z`).getTime();
  const r = new Date(`${right}T00:00:00.000Z`).getTime();
  return Math.abs(l - r) / 86400000;
};

const unique = <T>(values: T[]): T[] => [...new Set(values)];

const pythonStringLiteral = (value: string): string => JSON.stringify(value);

const buildVmPython = (options: Options, displayCampaignIds: string[]): string => {
  const startAt = kstDateToUtcIso(options.since);
  const endAt = kstDateToUtcIso(addDays(options.until, 1));
  return `
import sqlite3, json, datetime, hashlib, re

DB = ${pythonStringLiteral(options.vmDb)}
SINCE = ${pythonStringLiteral(options.since)}
UNTIL = ${pythonStringLiteral(options.until)}
START_AT = ${pythonStringLiteral(startAt)}
END_AT = ${pythonStringLiteral(endAt)}
DISPLAY_CAMPAIGN_IDS = ${JSON.stringify(displayCampaignIds)}

conn = sqlite3.connect(f"file:{DB}?mode=ro", uri=True)
conn.row_factory = sqlite3.Row

def rows(sql, params=()):
    return [dict(r) for r in conn.execute(sql, params).fetchall()]

def table_exists(name):
    return conn.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (name,)).fetchone() is not None

def clean(value):
    return str(value or "").strip()

def h(value):
    value = clean(value)
    return hashlib.sha256(value.encode("utf-8")).hexdigest() if value else ""

def order_id_base(value):
    value = clean(value)
    if not value:
        return ""
    return re.sub(r"(-|_)?P\\d+$", "", value, flags=re.I)

def parse_json(raw):
    try:
        return json.loads(raw or "{}")
    except Exception:
        return {}

def metadata_value(raw, *keys):
    obj = parse_json(raw)
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

def number_value(raw, *keys):
    for value in [metadata_value(raw, key) for key in keys]:
        try:
            return int(float(str(value).replace(",", "")))
        except Exception:
            pass
    return 0

def site_from_source(value):
    text = clean(value).lower()
    if "thecleancoffee" in text or "coffee" in text:
        return "thecleancoffee"
    if "biocom" in text:
        return "biocom"
    return ""

def marker_reason(text, medium):
    reasons = []
    lowered = clean(text).lower()
    if "advoost" in lowered:
        reasons.append("advoost")
    if "gfa" in lowered:
        reasons.append("gfa")
    if "naver_display" in lowered:
        reasons.append("naver_display")
    if clean(medium).lower() == "display" or "utm_medium=display" in lowered:
        reasons.append("medium_display")
    for campaign_id in DISPLAY_CAMPAIGN_IDS:
        if campaign_id and campaign_id.lower() in lowered:
            reasons.append("campaign_id")
            break
    return "+".join(sorted(set(reasons)))

for name in ["attribution_ledger", "site_landing_ledger", "imweb_orders"]:
    if not table_exists(name):
        raise SystemExit(json.dumps({"ok": False, "error": f"{name} table missing"}, ensure_ascii=False))

attr_rows = rows("""
SELECT
  source,
  touchpoint,
  payment_status,
  logged_at,
  approved_at,
  order_id,
  payment_key,
  ga_session_id,
  utm_source,
  utm_medium,
  utm_campaign,
  utm_content,
  landing,
  referrer,
  metadata_json,
  lower(COALESCE(utm_source,'') || ' ' || COALESCE(utm_medium,'') || ' ' || COALESCE(utm_campaign,'') || ' ' || COALESCE(utm_content,'') || ' ' || COALESCE(landing,'') || ' ' || COALESCE(referrer,'') || ' ' || COALESCE(metadata_json,'')) AS evidence_text
FROM attribution_ledger
WHERE logged_at >= ? AND logged_at < ?
""", [START_AT, END_AT])

display_attr = []
for r in attr_rows:
    reason = marker_reason(r.get("evidence_text"), r.get("utm_medium"))
    if not reason:
        continue
    site = site_from_source(r.get("source"))
    display_attr.append((r, site, reason))

summary_map = {}
for r, site, reason in display_attr:
    key = (site or "(unknown)", clean(r.get("touchpoint")), clean(r.get("payment_status")), reason)
    bucket = summary_map.setdefault(key, {
        "site": key[0],
        "touchpoint": key[1],
        "paymentStatus": key[2],
        "markerReason": key[3],
        "rows": 0,
        "bridgeKeyPresent": 0,
        "amountSumKrw": 0,
    })
    amount = number_value(r.get("metadata_json"), "value", "amount", "totalAmount", "referrerPayment.amount")
    bucket["rows"] += 1
    if clean(r.get("order_id")) or clean(r.get("payment_key")):
        bucket["bridgeKeyPresent"] += 1
    bucket["amountSumKrw"] += amount

marker_rows = []
for r, site, reason in display_attr:
    if clean(r.get("touchpoint")) != "payment_success":
        continue
    if clean(r.get("payment_status")).lower() != "confirmed":
        continue
    if site not in ["biocom", "thecleancoffee"]:
        continue
    raw = r.get("metadata_json") or "{}"
    marker_date = clean(r.get("approved_at"))[:10] or clean(r.get("logged_at"))[:10]
    amount = number_value(raw, "value", "amount", "totalAmount", "referrerPayment.amount")
    candidates = [
        order_id_base(r.get("order_id")),
        metadata_value(raw, "orderNo", "order_no", "referrerPayment.orderNo"),
        metadata_value(raw, "orderId", "order_id", "referrerPayment.orderId"),
        metadata_value(raw, "orderCode", "order_code", "referrerPayment.orderCode"),
        metadata_value(raw, "channelOrderNo", "channel_order_no"),
    ]
    hashes = sorted(set([h(v) for v in candidates if clean(v)]))
    marker_rows.append({
        "site": site,
        "markerDate": marker_date,
        "markerAmountKrw": amount,
        "orderKeyHashes": hashes,
        "hasOrderKeyCandidate": bool(hashes),
        "markerReason": reason,
    })

landing_rows = rows("""
SELECT
  site,
  utm_medium,
  lower(COALESCE(utm_source,'') || ' ' || COALESCE(utm_medium,'') || ' ' || COALESCE(utm_campaign,'') || ' ' || COALESCE(utm_content,'') || ' ' || COALESCE(landing_url,'') || ' ' || COALESCE(referrer_full_url,'')) AS evidence_text
FROM site_landing_ledger
WHERE landed_at >= ? AND landed_at < ?
""", [START_AT, END_AT])
landing_summary = {}
for r in landing_rows:
    reason = marker_reason(r.get("evidence_text"), r.get("utm_medium"))
    if not reason:
        continue
    key = (clean(r.get("site")), reason)
    bucket = landing_summary.setdefault(key, {"site": key[0], "markerReason": key[1], "rows": 0})
    bucket["rows"] += 1

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
""", [SINCE, UNTIL]):
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

print(json.dumps({
    "ok": True,
    "generated_at": datetime.datetime.utcnow().isoformat(timespec="seconds") + "Z",
    "requested_window": {"since": SINCE, "until": UNTIL, "timezone": "KST"},
    "display_campaign_ids": DISPLAY_CAMPAIGN_IDS,
    "freshness": {
        "attribution_max_logged_at": conn.execute("SELECT COALESCE(MAX(logged_at),'') FROM attribution_ledger").fetchone()[0],
        "site_landing_max_landed_at": conn.execute("SELECT COALESCE(MAX(landed_at),'') FROM site_landing_ledger").fetchone()[0],
        "coffee_imweb_max_order_time": conn.execute("SELECT COALESCE(MAX(order_time),'') FROM imweb_orders WHERE site='thecleancoffee'").fetchone()[0],
        "coffee_imweb_max_synced_at": conn.execute("SELECT COALESCE(MAX(synced_at),'') FROM imweb_orders WHERE site='thecleancoffee'").fetchone()[0],
        "coffee_imweb_max_status_synced_at": conn.execute("SELECT COALESCE(MAX(imweb_status_synced_at),'') FROM imweb_orders WHERE site='thecleancoffee'").fetchone()[0],
    },
    "attribution_marker_summary": list(summary_map.values()),
    "site_landing_summary": list(landing_summary.values()),
    "marker_rows": marker_rows,
    "coffee_order_rows": coffee_order_rows,
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
};

const runVmRead = (options: Options, displayCampaignIds: string[]): VmPayload => {
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
      input: buildVmPython(options, displayCampaignIds),
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

const queryBiocomOrders = async (pool: Pool | null, options: Options): Promise<{
  status: "available" | "unavailable";
  rows: OrderRow[];
  maxSourceDate: string;
  warning: string | null;
}> => {
  if (!pool) {
    return { status: "unavailable", rows: [], maxSourceDate: "", warning: "DATABASE_URL is not configured" };
  }

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
    [options.since, options.until],
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
  return { status: "available", rows, maxSourceDate, warning: null };
};

const classifyBridge = (markers: MarkerRow[], orders: OrderRow[]): BridgeSummary => {
  const orderByHash = new Map<string, OrderRow[]>();
  const exactMatchedOrderRevenue = new Map<string, number>();
  const exactMatchedOrderHashes = new Set<string>();

  for (const order of orders) {
    for (const hash of order.orderKeyHashes) {
      const list = orderByHash.get(hash) ?? [];
      list.push(order);
      orderByHash.set(hash, list);
    }
  }

  const summary: BridgeSummary = {
    marker_rows: markers.length,
    marker_amount_krw: 0,
    marker_rows_with_order_key: 0,
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
    summary.marker_amount_krw += marker.markerAmountKrw;
    if (marker.hasOrderKeyCandidate) summary.marker_rows_with_order_key += 1;

    const exactOrders = unique(marker.orderKeyHashes.flatMap((hash) => orderByHash.get(hash) ?? []));
    if (exactOrders.length > 0) {
      summary.exact_rows += 1;
      summary.exact_marker_amount_krw += marker.markerAmountKrw;
      if (exactOrders.some((order) => order.amountKrw === marker.markerAmountKrw)) summary.exact_amount_match_rows += 1;
      else summary.exact_amount_mismatch_rows += 1;
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

const siteCostRow = (cost: DisplayCostArtifact, site: Site): DisplayCostSite => {
  const row = (cost.by_site ?? []).find((item) => item.site === site);
  if (!row) {
    return {
      site,
      spend_krw: 0,
      naver_claim_conversion_revenue_krw: 0,
      naver_claim_roas_percent: 0,
      clicks: 0,
      active_campaigns: 0,
      campaigns: [],
    };
  }
  return row;
};

const buildSiteOutput = (
  site: Site,
  cost: DisplayCostSite,
  bridge: BridgeSummary,
  orderSource: string,
  operatingDbStatus: "available" | "unavailable",
  window: { since: string; until: string; timezone: "KST" },
): SiteOutput => {
  const exactRoasMultiple = roasMultiple(bridge.exact_marker_amount_krw, numberValue(cost.spend_krw));
  const exactRoasPercent = roasPercent(bridge.exact_marker_amount_krw, numberValue(cost.spend_krw));
  const markerRoas = roasMultiple(bridge.marker_amount_krw, numberValue(cost.spend_krw));
  const claimRevenue = numberValue(cost.naver_claim_conversion_revenue_krw);
  const spend = numberValue(cost.spend_krw);
  const exactRate = bridge.marker_rows > 0 ? bridge.exact_rows / bridge.marker_rows : 0;
  const budgetUse = bridge.exact_rows > 0 && bridge.no_bridge_rows === 0 && bridge.ambiguous_rows === 0
    ? "ready_for_budget_floor"
    : bridge.exact_rows > 0
      ? "partial_not_budget_ready"
      : "not_ready";
  const warnings: string[] = [];
  if (site === "biocom" && operatingDbStatus === "unavailable") warnings.push("operating_db_unavailable_for_biocom_exact_crosscheck");
  if (bridge.marker_rows === 0) warnings.push("no_display_payment_success_marker_rows");
  if (bridge.no_bridge_rows > 0) warnings.push("display_marker_rows_without_order_bridge");
  if (bridge.ambiguous_rows > 0) warnings.push("display_amount_time_ambiguous_rows_present");
  if (site === "thecleancoffee") warnings.push("coffee_order_source_vm_cloud_imweb_orders_primary_candidate");

  return {
    site,
    source_policy: {
      cost_source: "Hermes Naver Ads UI XLSX export, 2026-04 performance display",
      marker_source: "VM Cloud attribution_ledger payment_success confirmed with display/GFA/ADVoost marker",
      order_source: orderSource,
    },
    window,
    naver_platform_claim: {
      spend_krw: spend,
      conversion_revenue_krw: claimRevenue,
      roas_percent: numberValue(cost.naver_claim_roas_percent),
      clicks: numberValue(cost.clicks),
      active_campaigns: numberValue(cost.active_campaigns),
    },
    internal_bridge: bridge,
    internal_confirmed_roas: {
      exact_order_bridge_roas_multiple: exactRoasMultiple,
      exact_order_bridge_roas_percent: exactRoasPercent,
      marker_amount_roas_multiple: markerRoas,
      budget_use: budgetUse,
    },
    gap: {
      naver_claim_minus_exact_bridge_revenue_krw: claimRevenue > 0 ? claimRevenue - bridge.exact_marker_amount_krw : null,
      exact_bridge_revenue_share_of_naver_claim_pct: claimRevenue > 0
        ? round2((bridge.exact_marker_amount_krw / claimRevenue) * 100)
        : null,
    },
    interpretation: {
      status: bridge.exact_rows > 0
        ? bridge.exact_rows === bridge.marker_rows
          ? "bridge_ready_floor"
          : "partial_bridge_candidate"
        : "source_ready_bridge_missing",
      plain: bridge.exact_rows > 0
        ? "일부 성과 디스플레이 결제완료 marker는 주문 정본과 exact로 연결된다. 다만 전체 예산 판단값으로 쓰려면 display 전용 유입 식별률을 더 높여야 한다."
        : "성과 디스플레이 비용 원본은 있지만, 내부 결제완료 주문으로 연결된 marker가 없어 예산 판단용 내부 ROAS는 아직 만들 수 없다.",
      confidence: exactRate >= 0.95 ? "medium_high" : exactRate > 0 ? "medium" : "low",
    },
    warnings,
  };
};

const buildBridgeWork = (): Output["bridge_work_required"] => [
  {
    priority: "P0",
    name: "성과 디스플레이 유입 식별자 표준화",
    what: "ADVoost/GFA/성과 디스플레이 유입을 naver_display로 별도 분류할 수 있게 UTM 또는 landing marker를 고정한다.",
    why: "현재 classifier에는 naver_display 클래스가 없고, 일부 GFA marker만 결제완료에 남는다.",
    lane: "Green",
    approval_required: false,
    success_criteria: "read-only preview에서 naver_display marker count가 search/brandsearch/organic과 분리된다.",
  },
  {
    priority: "P0",
    name: "결제완료 주문키 브릿지",
    what: "VM Cloud 결제완료 신호의 display marker를 주문 정본의 주문키 hash와 exact로 매칭한다.",
    why: "플랫폼 전환금액이 아니라 실제 결제완료 주문만 내부 confirmed ROAS 분자로 써야 한다.",
    lane: "Green",
    approval_required: false,
    success_criteria: "site별 exact/probable/ambiguous/no_bridge가 raw 식별자 없이 산출된다.",
  },
  {
    priority: "P1",
    name: "브라우저 유입 보존 보강",
    what: "성과 디스플레이 landing marker가 주문서와 결제완료까지 유지되는지 site_landing -> checkout -> payment_success를 점검한다.",
    why: "2026년 4월 site_landing에는 display marker가 거의 없고, 결제완료 marker도 일부만 관측된다.",
    lane: "Yellow",
    approval_required: true,
    success_criteria: "VM Cloud 배포/Imweb/GTM 변경 전 승인안 기준으로 marker preservation smoke가 PASS한다.",
  },
  {
    priority: "P2",
    name: "대시보드 API 연결",
    what: "네이버 ROAS 화면에서 플랫폼 주장 ROAS와 내부 confirmed ROAS를 별도 필드로 내려준다.",
    why: "예산 판단값과 참고값을 한 화면에서 섞지 않기 위해서다.",
    lane: "Yellow",
    approval_required: true,
    success_criteria: "API가 display.spend, display.naver_claim, display.internal_exact_bridge를 분리 응답한다.",
  },
];

const renderMarkdown = (output: Output): string => {
  const rows = output.by_site.map((site) =>
    `| ${site.site} | ${formatKrw(site.naver_platform_claim.spend_krw)} | ${formatKrw(site.naver_platform_claim.conversion_revenue_krw)} | ${site.naver_platform_claim.roas_percent}% | ${site.internal_bridge.exact_rows}건 | ${formatKrw(site.internal_bridge.exact_marker_amount_krw)} | ${site.internal_confirmed_roas.exact_order_bridge_roas_percent ?? "n/a"}% | ${site.internal_confirmed_roas.budget_use} |`,
  ).join("\n");

  const work = output.bridge_work_required.map((item) =>
    `### ${item.priority}. ${item.name}\n\n- 무엇: ${item.what}\n- 왜: ${item.why}\n- Lane: ${item.lane}\n- 승인 필요: ${item.approval_required ? "YES" : "NO"}\n- 성공 기준: ${item.success_criteria}`,
  ).join("\n\n");

  return `# 네이버 성과 디스플레이 내부 confirmed ROAS bridge 요구사항 preview

작성 시각: ${kstTimestamp()} KST  
기준일: 2026-05-26  
문서 성격: Naver performance display internal confirmed ROAS bridge read-only preview

## 10초 요약

성과 디스플레이의 네이버 플랫폼 주장 ROAS는 이미 볼 수 있지만, 예산 판단용 내부 confirmed ROAS는 아직 부분 후보 단계다. 2026년 4월 VM Cloud 결제완료 장부에서 바이오컴 GFA marker 3건 / 927,000원 중 운영DB 주문 정본 exact는 2건 / 693,000원이고, 더클린커피는 결제완료 display marker가 0건이다. 다음 핵심은 성과 디스플레이 유입을 \`naver_display\`로 별도 분리하고, 결제완료 주문키와 exact로 연결하는 것이다.

## Harness Preflight

\`\`\`yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - AGENTS.md
    - docurule.md
    - docs/agent-harness/growth-data-harness-v0.md
    - harness/coffee-data/README.md
    - harness/coffee-data/RULES.md
  required_context_docs:
    - gdn/attribution-data-source-decision-guide-20260511.md
    - data/!data_inventory.md
    - project/naver-display-april-hermes-result-20260526.md
  lane: Green
  allowed_actions:
    - read_only_vm_cloud_sqlite_query
    - read_only_operating_db_query
    - aggregate_only_json_markdown_generation
    - no_send_no_write_preview
  forbidden_actions:
    - operating_db_write
    - vm_cloud_write_or_deploy
    - naver_ads_state_change
    - platform_conversion_send
    - gtm_publish
  source_window_freshness_confidence:
    source: Hermes XLSX + VM Cloud attribution_ledger + 운영DB tb_iamweb_users + VM Cloud imweb_orders
    window: 2026-04-01~2026-04-30 KST
    freshness: generated ${output.generated_at}
    confidence: medium
\`\`\`

## 실제 확인된 숫자

| site | 광고비 | 네이버 주장 전환금액 | 네이버 주장 ROAS | 내부 exact marker | 내부 exact 매출 | 내부 exact ROAS | 예산 사용 |
|---|---:|---:|---:|---:|---:|---:|---|
${rows}

## 해석

- 네이버 주장 전환금액은 플랫폼 참고값이다. 내부 confirmed ROAS 분자로 합산하지 않는다.
- 내부 exact 매출은 VM Cloud 결제완료 display marker와 주문 정본이 주문키 hash로 연결된 금액이다.
- 바이오컴은 부분 후보가 있으나 전체 성과 디스플레이 예산 판단값으로 쓰기에는 유입 식별률이 낮다.
- 더클린커피는 2026년 4월 결제완료 display marker가 없어 아직 내부 confirmed ROAS를 만들 수 없다.

## 필요한 bridge 작업

${work}

## Source / Window / Freshness

- source: ${output.source_window_freshness_confidence.source}
- window: ${output.source_window_freshness_confidence.window}
- confidence: ${output.source_window_freshness_confidence.confidence}
- raw identifier output: 0

## 검증

- VM Cloud SQLite: read-only
- 운영DB: read-only
- platform send: 0
- DB write: 0
- generated JSON: \`${DEFAULT_JSON_OUTPUT}\`
`;
};

const buildOutput = (
  options: Options,
  costArtifact: DisplayCostArtifact,
  vm: VmPayload,
  biocomOrders: Awaited<ReturnType<typeof queryBiocomOrders>>,
): Output => {
  const biocomCost = siteCostRow(costArtifact, "biocom");
  const coffeeCost = siteCostRow(costArtifact, "thecleancoffee");
  const biocomMarkers = vm.marker_rows.filter((row) => row.site === "biocom");
  const coffeeMarkers = vm.marker_rows.filter((row) => row.site === "thecleancoffee");
  const biocomBridge = classifyBridge(biocomMarkers, biocomOrders.rows);
  const coffeeBridge = classifyBridge(coffeeMarkers, vm.coffee_order_rows);
  const window = { since: options.since, until: options.until, timezone: "KST" as const };
  const sites = [
    buildSiteOutput(
      "biocom",
      biocomCost,
      biocomBridge,
      "운영DB PostgreSQL public.tb_iamweb_users PAYMENT_COMPLETE",
      biocomOrders.status,
      window,
    ),
    buildSiteOutput(
      "thecleancoffee",
      coffeeCost,
      coffeeBridge,
      "VM Cloud SQLite imweb_orders(site='thecleancoffee') positive non-cancel orders",
      "available",
      window,
    ),
  ];
  const spend = sites.reduce((sum, site) => sum + site.naver_platform_claim.spend_krw, 0);
  const claimRevenue = sites.reduce((sum, site) => sum + site.naver_platform_claim.conversion_revenue_krw, 0);
  const exactRevenue = sites.reduce((sum, site) => sum + site.internal_bridge.exact_marker_amount_krw, 0);

  return {
    ok: true,
    schema_version: SCHEMA_VERSION,
    generated_at: new Date().toISOString(),
    mode: "read_only_no_send_no_write",
    requested_window: { since: options.since, until: options.until, timezone: "KST" },
    harness_preflight: {
      lane: "Green",
      allowed_actions: ["read_only_vm_cloud_sqlite_query", "read_only_operating_db_query", "aggregate_only_report_generation"],
      forbidden_actions: ["operating_db_write", "vm_cloud_write_or_deploy", "naver_ads_state_change", "platform_send", "gtm_publish"],
    },
    plain_summary:
      "Naver performance display platform claim values are source-ready, but internal confirmed ROAS needs display marker classification and order-key exact bridge.",
    by_site: sites,
    totals: {
      spend_krw: spend,
      naver_claim_conversion_revenue_krw: claimRevenue,
      exact_order_bridge_revenue_krw: exactRevenue,
      naver_claim_roas_percent: roasPercent(claimRevenue, spend),
      exact_order_bridge_roas_percent: roasPercent(exactRevenue, spend),
    },
    bridge_work_required: buildBridgeWork(),
    source_window_freshness_confidence: {
      source: "Hermes XLSX + VM Cloud attribution_ledger/site_landing_ledger + operating DB/VM Cloud order source",
      window: `${options.since}~${options.until} KST`,
      freshness: {
        cost_artifact_generated_at: costArtifact.freshness?.imported_at ?? "",
        vm_attribution_max_logged_at: vm.freshness.attribution_max_logged_at,
        vm_site_landing_max_landed_at: vm.freshness.site_landing_max_landed_at,
        biocom_operating_db_status: biocomOrders.status,
        biocom_operating_db_max_source_date: biocomOrders.maxSourceDate,
        coffee_imweb_max_order_time: vm.freshness.coffee_imweb_max_order_time,
        coffee_imweb_max_synced_at: vm.freshness.coffee_imweb_max_synced_at,
      },
      confidence: "medium: cost source is complete, display marker bridge is partial and classifier is not yet first-class.",
    },
    validation: {
      cost_artifact_present: true,
      vm_marker_rows_total: vm.marker_rows.length,
      vm_attribution_marker_summary_rows: vm.attribution_marker_summary.length,
      vm_site_landing_marker_summary_rows: vm.site_landing_summary.length,
      biocom_operating_db_status: biocomOrders.status,
      biocom_operating_db_warning: biocomOrders.warning,
      raw_identifier_output: 0,
    },
    invariants_held: {
      ...vm.invariants_held,
      operating_db_mode: biocomOrders.status === "available" ? "read_only" : "unavailable",
      operating_db_write: 0,
      vm_cloud_write: 0,
      backend_deploy_or_restart: 0,
      platform_send: 0,
      naver_ads_state_change: 0,
      gtm_publish: 0,
      raw_identifier_output: 0,
    },
  };
};

const displayCampaignIds = (artifact: DisplayCostArtifact): string[] =>
  Array.from(new Set((artifact.by_site ?? [])
    .flatMap((site) => site.campaigns ?? [])
    .map((campaign) => String(campaign.campaign_id ?? "").trim())
    .filter(Boolean)));

const main = async () => {
  const options = parseArgs(process.argv.slice(2));
  const costArtifact = readDisplayCostArtifact();
  const campaignIds = displayCampaignIds(costArtifact);
  const pool = createPgPool();
  try {
    const [vm, biocomOrders] = await Promise.all([
      Promise.resolve(runVmRead(options, campaignIds)),
      queryBiocomOrders(pool, options),
    ]);
    const output = buildOutput(options, costArtifact, vm, biocomOrders);

    const jsonPath = path.resolve(REPO_ROOT, options.jsonOutput);
    const mdPath = path.resolve(REPO_ROOT, options.mdOutput);
    mkdirSync(path.dirname(jsonPath), { recursive: true });
    mkdirSync(path.dirname(mdPath), { recursive: true });
    writeFileSync(jsonPath, `${JSON.stringify(output, null, 2)}\n`);
    writeFileSync(mdPath, renderMarkdown(output));

    if (options.printJson) {
      console.log(JSON.stringify(output, null, 2));
      return;
    }
    console.log("Naver display internal bridge requirements preview");
    console.log(`window: ${options.since}~${options.until} KST`);
    for (const site of output.by_site) {
      console.log(
        `${site.site}: spend=${formatKrw(site.naver_platform_claim.spend_krw)} ` +
        `claim=${formatKrw(site.naver_platform_claim.conversion_revenue_krw)} ` +
        `exact=${site.internal_bridge.exact_rows}/${formatKrw(site.internal_bridge.exact_marker_amount_krw)} ` +
        `exact_roas=${site.internal_confirmed_roas.exact_order_bridge_roas_percent ?? "n/a"}%`,
      );
    }
    console.log(`json: ${options.jsonOutput}`);
    console.log(`md: ${options.mdOutput}`);
  } finally {
    await pool?.end();
  }
};

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
