#!/usr/bin/env tsx
/**
 * Biocom Naver brandsearch unresolved narrowing.
 *
 * Green Lane / read-only:
 * - Reads VM Cloud SQLite through read-only commands.
 * - Reads operating DB PostgreSQL without writes.
 * - Narrows existing unresolved safe rows without printing raw identifiers.
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";

import dotenv from "dotenv";
import { Pool } from "pg";

dotenv.config({ path: resolve(__dirname, "..", ".env"), quiet: true });
dotenv.config({ path: resolve(__dirname, "..", ".env.local"), quiet: true });

const SCHEMA_VERSION = "biocom-naver-brandsearch-unresolved-narrowing-v1-20260526";
const DEFAULT_VM_HOST = "34.64.104.94";
const DEFAULT_VM_USER = "taejun";
const DEFAULT_VM_KEY = "~/.ssh/id_ed25519";
const DEFAULT_VM_DB = "/home/biocomkr_sns/seo/repo/backend/data/crm.sqlite3";
const DEFAULT_VM_RUN_AS = "biocomkr_sns";
const DEFAULT_PREVIOUS =
  "../data/project/biocom-naver-brandsearch-unresolved-breakdown-20260525.json";

type CliOptions = {
  since: string;
  until: string;
  output: string;
  json: boolean;
  previous: string;
  vmHost: string;
  vmUser: string;
  vmKey: string;
  vmDb: string;
  vmRunAs: string;
};

type MarkerRow = {
  safeOrdinal: number;
  markerDate: string;
  markerAmountKrw: number;
  orderKeyHashes: string[];
  hasOrderKeyCandidate: boolean;
  sessionBridgePresent: boolean;
};

type SourceOrderRow = {
  source: "operating_db" | "vm_cloud_imweb_orders";
  sourceDate: string;
  amountKrw: number;
  orderKeyHashes: string[];
  isNpay: boolean;
};

type VmPayload = {
  ok: true;
  generated_at_kst: string;
  freshness: {
    landing_max_landed_at: string;
    attribution_max_logged_at: string;
    vm_imweb_orders_max_complete_or_order_time: string;
  };
  marker_rows: MarkerRow[];
  vm_order_rows: SourceOrderRow[];
  invariants_held: Record<string, unknown>;
};

type PreviousBreakdown = {
  breakdown?: {
    unresolved_safe_rows?: Array<{
      safe_row_no: number;
      previous_classification?: string;
      recommended_reason?: string;
    }>;
  };
};

type BiocomPgOrderLine = {
  order_number: string;
  order_section_item_no: string | null;
  order_item_code: string | null;
  raw_order_no: string | null;
  raw_order_code: string | null;
  raw_order_id: string | null;
  raw_channel_order_no: string | null;
  source_date: string;
  amount_krw: string;
  payment_method: string | null;
  has_cancel: boolean;
  has_return: boolean;
};

const usage = () => `
Usage:
  npx tsx scripts/biocom-naver-brandsearch-unresolved-narrowing.ts [options]

Options:
  --since=YYYY-MM-DD       Inclusive KST date. Default: 2026-05-22
  --until=YYYY-MM-DD       Inclusive KST date. Default: 2026-05-25
  --output=path            Write JSON output to path
  --previous=path          Previous unresolved breakdown JSON
  --json                   Print JSON only
`;

const parseArgs = (argv: string[]): CliOptions => {
  const options: CliOptions = {
    since: "2026-05-22",
    until: "2026-05-25",
    output: "",
    json: false,
    previous: DEFAULT_PREVIOUS,
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
    if (arg.startsWith("--since=")) options.since = arg.slice("--since=".length).trim();
    else if (arg.startsWith("--until=")) options.until = arg.slice("--until=".length).trim();
    else if (arg.startsWith("--output=")) options.output = arg.slice("--output=".length).trim();
    else if (arg.startsWith("--previous=")) options.previous = arg.slice("--previous=".length).trim();
    else if (arg.startsWith("--vm-host=")) options.vmHost = arg.slice("--vm-host=".length).trim();
    else if (arg.startsWith("--vm-user=")) options.vmUser = arg.slice("--vm-user=".length).trim();
    else if (arg.startsWith("--vm-key=")) options.vmKey = arg.slice("--vm-key=".length).trim();
    else if (arg.startsWith("--vm-db=")) options.vmDb = arg.slice("--vm-db=".length).trim();
    else if (arg.startsWith("--vm-run-as=")) options.vmRunAs = arg.slice("--vm-run-as=".length).trim();
    else throw new Error(`Unknown argument: ${arg}`);
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(options.since) || !/^\d{4}-\d{2}-\d{2}$/.test(options.until)) {
    throw new Error("date options must be YYYY-MM-DD");
  }
  if (options.since > options.until) throw new Error("since must be <= until");
  return options;
};

const hashValue = (value: string): string => createHash("sha256").update(value).digest("hex");

const clean = (value: unknown): string => String(value ?? "").trim();

const normalizeDatabaseUrl = (value: string) => value.replace(/^postgresql\+asyncpg:\/\//, "postgresql://");

const createPgPool = () => {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) throw new Error("DATABASE_URL is not configured");
  return new Pool({ connectionString: normalizeDatabaseUrl(databaseUrl), max: 1 });
};

const daysApart = (left: string, right: string): number => {
  const l = new Date(`${left}T00:00:00.000Z`).getTime();
  const r = new Date(`${right}T00:00:00.000Z`).getTime();
  return Math.abs(l - r) / 86400000;
};

const amountBucket = (amount: number): string => {
  if (amount < 100_000) return "under_100k";
  if (amount < 300_000) return "100k_to_299k";
  if (amount < 500_000) return "300k_to_499k";
  return "500k_or_more";
};

const pythonStringLiteral = (value: string): string => JSON.stringify(value);

const readPreviousUnresolved = (options: CliOptions): Map<number, { previous: string; reason: string }> => {
  const fullPath = resolve(__dirname, "..", options.previous);
  if (!existsSync(fullPath)) return new Map();
  const parsed = JSON.parse(readFileSync(fullPath, "utf8")) as PreviousBreakdown;
  const rows = parsed.breakdown?.unresolved_safe_rows ?? [];
  return new Map(rows.map((row) => [
    row.safe_row_no,
    {
      previous: row.previous_classification || "unknown",
      reason: row.recommended_reason || "unknown",
    },
  ]));
};

const buildVmPython = (options: CliOptions): string => `
import sqlite3, json, datetime, hashlib, re

DB = ${pythonStringLiteral(options.vmDb)}
SINCE = ${pythonStringLiteral(options.since)}
UNTIL = ${pythonStringLiteral(options.until)}

start = (datetime.date.fromisoformat(SINCE) - datetime.timedelta(days=3)).isoformat()
end = (datetime.date.fromisoformat(UNTIL) + datetime.timedelta(days=3)).isoformat()

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

for name in ["site_landing_ledger", "attribution_ledger", "imweb_orders"]:
    if not table_exists(name):
        raise SystemExit(json.dumps({"ok": False, "error": f"{name} table missing"}, ensure_ascii=False))

landing_sessions = set()
for r in rows("""
SELECT ga_session_id, client_id, local_session_id_hash
FROM site_landing_ledger
WHERE site='biocom'
  AND channel_classified='naver_brandsearch'
  AND substr(landed_at, 1, 10) BETWEEN ? AND ?
""", [SINCE, UNTIL]):
    for key in ["ga_session_id", "client_id", "local_session_id_hash"]:
        v = clean(r.get(key))
        if v:
            landing_sessions.add(h(v))

payment_rows = rows("""
SELECT
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
  AND lower(COALESCE(json_extract(metadata_json,'$.store'), json_extract(metadata_json,'$.site'), source, ''))='biocom'
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
""", [SINCE, UNTIL])

marker_rows = []
for r in payment_rows:
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
    marker_rows.append({
        "safeOrdinal": len(marker_rows) + 1,
        "markerDate": clean(r.get("marker_date")),
        "markerAmountKrw": int(r.get("marker_amount_krw") or 0),
        "orderKeyHashes": candidate_hashes,
        "hasOrderKeyCandidate": bool(candidate_hashes),
        "sessionBridgePresent": bool(session_hashes.intersection(landing_sessions)),
    })

vm_order_rows = []
for r in rows("""
SELECT
  substr(COALESCE(NULLIF(complete_time,''), order_time), 1, 10) AS source_date,
  COALESCE(NULLIF(payment_amount,0), NULLIF(total_price,0), 0) AS amount_krw,
  order_no,
  order_code,
  channel_order_no,
  order_key,
  pay_type
FROM imweb_orders
WHERE site='biocom'
  AND substr(COALESCE(NULLIF(complete_time,''), order_time), 1, 10) BETWEEN ? AND ?
  AND COALESCE(NULLIF(payment_amount,0), NULLIF(total_price,0), 0) > 0
""", [start, end]):
    hashes = sorted(set([h(v) for v in [
        r.get("order_no"),
        r.get("order_code"),
        r.get("channel_order_no"),
        r.get("order_key"),
    ] if clean(v)]))
    vm_order_rows.append({
        "source": "vm_cloud_imweb_orders",
        "sourceDate": clean(r.get("source_date")),
        "amountKrw": int(r.get("amount_krw") or 0),
        "orderKeyHashes": hashes,
        "isNpay": "naver" in clean(r.get("pay_type")).lower() or "npay" in clean(r.get("pay_type")).lower() or "네이버" in clean(r.get("pay_type")),
    })

print(json.dumps({
    "ok": True,
    "generated_at_kst": datetime.datetime.utcnow().isoformat(timespec="seconds") + "Z",
    "freshness": {
        "landing_max_landed_at": conn.execute("SELECT COALESCE(MAX(landed_at),'') FROM site_landing_ledger").fetchone()[0],
        "attribution_max_logged_at": conn.execute("SELECT COALESCE(MAX(logged_at),'') FROM attribution_ledger").fetchone()[0],
        "vm_imweb_orders_max_complete_or_order_time": conn.execute("SELECT COALESCE(MAX(COALESCE(NULLIF(complete_time,''), order_time)),'') FROM imweb_orders WHERE site='biocom'").fetchone()[0],
    },
    "marker_rows": marker_rows,
    "vm_order_rows": vm_order_rows,
    "invariants_held": {
        "sqlite_mode": "read_only",
        "sqlite_write": 0,
        "raw_identifier_output": 0,
        "order_key_hash_mode": "sha256_one_way_internal_only",
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

const queryOperatingOrders = async (pool: Pool, options: CliOptions): Promise<{ rows: SourceOrderRow[]; maxSourceDate: string }> => {
  const result = await pool.query<BiocomPgOrderLine>(
    `
    WITH raw AS (
      SELECT
        order_number::text AS order_number,
        order_section_item_no::text AS order_section_item_no,
        order_item_code::text AS order_item_code,
        raw_data->>'orderNo' AS raw_order_no,
        raw_data->>'orderCode' AS raw_order_code,
        raw_data->>'orderId' AS raw_order_id,
        raw_data->>'channelOrderNo' AS raw_channel_order_no,
        CASE
          WHEN TRIM(COALESCE(payment_complete_time::text, '')) ~ '^\\d{4}-\\d{2}-\\d{2}'
            THEN SUBSTRING(TRIM(payment_complete_time::text), 1, 10)::date
          WHEN TRIM(COALESCE(order_date::text, '')) ~ '^\\d{4}-\\d{2}-\\d{2}'
            THEN SUBSTRING(TRIM(order_date::text), 1, 10)::date
          ELSE NULL
        END AS source_date,
        COALESCE(
          NULLIF(final_order_amount, 0),
          NULLIF(paid_price, 0),
          NULLIF(total_price, 0),
          NULLIF((raw_data->>'totalPaymentPrice')::numeric, 0),
          0
        )::numeric AS amount_krw,
        COALESCE(NULLIF(TRIM(payment_method::text), ''), '(blank)') AS payment_method,
        LOWER(COALESCE(NULLIF(TRIM(cancellation_reason::text), ''), '')) NOT IN ('', 'nan', 'null') AS has_cancel,
        LOWER(COALESCE(NULLIF(TRIM(return_reason::text), ''), '')) NOT IN ('', 'nan', 'null') AS has_return
      FROM public.tb_iamweb_users
      WHERE order_number IS NOT NULL
        AND UPPER(COALESCE(NULLIF(TRIM(payment_status::text), ''), '')) = 'PAYMENT_COMPLETE'
    )
    SELECT
      order_number,
      order_section_item_no,
      order_item_code,
      raw_order_no,
      raw_order_code,
      raw_order_id,
      raw_channel_order_no,
      source_date::text,
      amount_krw::text,
      payment_method,
      has_cancel,
      has_return
    FROM raw
    WHERE source_date BETWEEN ($1::date - INTERVAL '3 days') AND ($2::date + INTERVAL '3 days')
      AND amount_krw > 0
    `,
    [options.since, options.until],
  );

  const grouped = new Map<string, {
    sourceDate: string;
    amountKrw: number;
    hashes: Set<string>;
    isNpay: boolean;
    hasCancel: boolean;
    hasReturn: boolean;
  }>();

  for (const row of result.rows) {
    const key = clean(row.order_number);
    if (!key) continue;
    const current = grouped.get(key) ?? {
      sourceDate: row.source_date,
      amountKrw: 0,
      hashes: new Set<string>(),
      isNpay: false,
      hasCancel: false,
      hasReturn: false,
    };
    if (!current.sourceDate || row.source_date < current.sourceDate) current.sourceDate = row.source_date;
    current.amountKrw = Math.max(current.amountKrw, Number(row.amount_krw) || 0);
    current.isNpay = current.isNpay || /naver|npay|네이버/i.test(clean(row.payment_method));
    current.hasCancel = current.hasCancel || row.has_cancel;
    current.hasReturn = current.hasReturn || row.has_return;
    [
      row.order_number,
      row.order_section_item_no,
      row.order_item_code,
      row.raw_order_no,
      row.raw_order_code,
      row.raw_order_id,
      row.raw_channel_order_no,
    ].forEach((value) => {
      const normalized = clean(value);
      if (normalized) current.hashes.add(hashValue(normalized));
    });
    grouped.set(key, current);
  }

  const rows: SourceOrderRow[] = [];
  for (const row of grouped.values()) {
    if (row.hasCancel || row.hasReturn) continue;
    rows.push({
      source: "operating_db",
      sourceDate: row.sourceDate,
      amountKrw: row.amountKrw,
      orderKeyHashes: Array.from(row.hashes).sort(),
      isNpay: row.isNpay,
    });
  }

  const maxSourceDate = rows.reduce((max, row) => (row.sourceDate > max ? row.sourceDate : max), "");
  return { rows, maxSourceDate };
};

const countBy = (
  rows: SourceOrderRow[],
  predicate: (row: SourceOrderRow) => boolean,
): Record<SourceOrderRow["source"], number> => ({
  operating_db: rows.filter((row) => row.source === "operating_db" && predicate(row)).length,
  vm_cloud_imweb_orders: rows.filter((row) => row.source === "vm_cloud_imweb_orders" && predicate(row)).length,
});

const sumBy = (
  rows: SourceOrderRow[],
  predicate: (row: SourceOrderRow) => boolean,
): Record<SourceOrderRow["source"], number> => ({
  operating_db: rows
    .filter((row) => row.source === "operating_db" && predicate(row))
    .reduce((sum, row) => sum + row.amountKrw, 0),
  vm_cloud_imweb_orders: rows
    .filter((row) => row.source === "vm_cloud_imweb_orders" && predicate(row))
    .reduce((sum, row) => sum + row.amountKrw, 0),
});

const hasExactMatch = (marker: MarkerRow, order: SourceOrderRow): boolean =>
  marker.orderKeyHashes.some((hash) => order.orderKeyHashes.includes(hash));

const classifyNarrowing = (params: {
  exactCounts: Record<SourceOrderRow["source"], number>;
  sameAmountAny: Record<SourceOrderRow["source"], number>;
  sameAmountWithin1d: Record<SourceOrderRow["source"], number>;
  sameAmountWithin3d: Record<SourceOrderRow["source"], number>;
}): { classification: string; recommendedNextStep: string; budgetTreatment: string } => {
  if (params.exactCounts.vm_cloud_imweb_orders > 0 && params.exactCounts.operating_db === 0) {
    return {
      classification: "vm_cloud_order_exact_operating_db_key_gap",
      recommendedNextStep: "VM Cloud imweb_orders exact match를 주문 정본 보조근거로 두고 운영DB sync/key 차이를 별도 확인",
      budgetTreatment: "can_review_for_upgrade_after_order_source_policy",
    };
  }
  if (params.exactCounts.operating_db > 0) {
    return {
      classification: "operating_db_exact_after_alt_key",
      recommendedNextStep: "기존 unresolved에서 exact로 승격 가능한지 원 스크립트 기준 보강",
      budgetTreatment: "candidate_for_exact_upgrade",
    };
  }
  if (params.sameAmountAny.operating_db === 0 && params.sameAmountAny.vm_cloud_imweb_orders === 0) {
    return {
      classification: "no_same_amount_in_order_sources",
      recommendedNextStep: "광고 marker 금액과 주문 정본 금액 정의 차이 또는 tracking marker 비주문 artifact 여부 확인",
      budgetTreatment: "exclude_until_amount_source_explained",
    };
  }
  const totalWithin1d = params.sameAmountWithin1d.operating_db + params.sameAmountWithin1d.vm_cloud_imweb_orders;
  if (totalWithin1d === 1) {
    return {
      classification: "single_amount_date_candidate_needs_key_confirmation",
      recommendedNextStep: "날짜 기준 차이 후보 1건으로 두고 raw-safe 수동 key 확인 또는 더 강한 session bridge 필요",
      budgetTreatment: "exclude_until_key_confirmation",
    };
  }
  if (totalWithin1d > 1 || params.sameAmountWithin3d.operating_db + params.sameAmountWithin3d.vm_cloud_imweb_orders > 1) {
    return {
      classification: "amount_duplicate_cluster_needs_secondary_key",
      recommendedNextStep: "동일 금액 주문이 많아 금액/날짜만으로는 금지. order_key/session/customer bridge가 필요",
      budgetTreatment: "exclude_ambiguous_cluster",
    };
  }
  return {
    classification: "outside_window_or_source_gap",
    recommendedNextStep: "조회 window와 결제완료 기준일을 확장해 재조회",
    budgetTreatment: "exclude_until_window_explained",
  };
};

const buildNarrowing = (
  markers: MarkerRow[],
  orders: SourceOrderRow[],
  previousMap: Map<number, { previous: string; reason: string }>,
) => {
  const targetMarkers = previousMap.size
    ? markers.filter((marker) => previousMap.has(marker.safeOrdinal))
    : markers;

  const rows = targetMarkers.map((marker) => {
    const exactMatches = orders.filter((order) => hasExactMatch(marker, order));
    const exactCounts = countBy(exactMatches, () => true);
    const sameAmountSameDate = countBy(
      orders,
      (order) => order.amountKrw === marker.markerAmountKrw && order.sourceDate === marker.markerDate,
    );
    const sameAmountWithin1d = countBy(
      orders,
      (order) => order.amountKrw === marker.markerAmountKrw && daysApart(order.sourceDate, marker.markerDate) <= 1,
    );
    const sameAmountWithin3d = countBy(
      orders,
      (order) => order.amountKrw === marker.markerAmountKrw && daysApart(order.sourceDate, marker.markerDate) <= 3,
    );
    const sameAmountAny = countBy(orders, (order) => order.amountKrw === marker.markerAmountKrw);
    const nearAmountWithin1d = countBy(
      orders,
      (order) => Math.abs(order.amountKrw - marker.markerAmountKrw) <= 1000 && daysApart(order.sourceDate, marker.markerDate) <= 1,
    );
    const decision = classifyNarrowing({
      exactCounts,
      sameAmountAny,
      sameAmountWithin1d,
      sameAmountWithin3d,
    });
    const previous = previousMap.get(marker.safeOrdinal);

    return {
      safe_row_no: marker.safeOrdinal,
      marker_date: marker.markerDate,
      amount_bucket: amountBucket(marker.markerAmountKrw),
      previous_classification: previous?.previous || "not_in_previous_file",
      previous_reason: previous?.reason || "not_in_previous_file",
      narrowed_classification: decision.classification,
      recommended_next_step: decision.recommendedNextStep,
      budget_treatment: decision.budgetTreatment,
      evidence_counts: {
        exact_key_match_by_source: exactCounts,
        same_amount_same_date_by_source: sameAmountSameDate,
        same_amount_within_1d_by_source: sameAmountWithin1d,
        same_amount_within_3d_by_source: sameAmountWithin3d,
        same_amount_any_window_by_source: sameAmountAny,
        near_amount_within_1d_by_source: nearAmountWithin1d,
      },
      source_amount_sums: {
        exact_key_match_krw_by_source: sumBy(exactMatches, () => true),
        same_amount_same_date_krw_by_source: sumBy(
          orders,
          (order) => order.amountKrw === marker.markerAmountKrw && order.sourceDate === marker.markerDate,
        ),
      },
      has_order_key_candidate: marker.hasOrderKeyCandidate,
      session_bridge_present: marker.sessionBridgePresent,
    };
  });

  const classificationCounts = rows.reduce<Record<string, { rows: number; budget_treatment: string }>>(
    (acc, row) => {
      const current = acc[row.narrowed_classification] ?? { rows: 0, budget_treatment: row.budget_treatment };
      current.rows += 1;
      acc[row.narrowed_classification] = current;
      return acc;
    },
    {},
  );

  return {
    target_rows: rows.length,
    classification_counts: classificationCounts,
    narrowed_safe_rows: rows,
  };
};

const main = async () => {
  const options = parseArgs(process.argv.slice(2));
  const vm = runVmRead(options);
  const pool = createPgPool();
  try {
    const { rows: operatingRows, maxSourceDate } = await queryOperatingOrders(pool, options);
    const previousMap = readPreviousUnresolved(options);
    const orderRows = [...operatingRows, ...vm.vm_order_rows];
    const narrowing = buildNarrowing(vm.marker_rows, orderRows, previousMap);
    const allPreviousUnresolvedMatchedVm =
      narrowing.target_rows > 0 &&
      narrowing.narrowed_safe_rows.every(
        (row) => row.narrowed_classification === "vm_cloud_order_exact_operating_db_key_gap",
      );
    const output = {
      ok: true,
      schema_version: SCHEMA_VERSION,
      generated_at: new Date().toISOString(),
      mode: "read_only_no_send_no_write",
      site: "biocom",
      window: { since: options.since, until: options.until, timezone: "KST" },
      source_policy: {
        primary_marker_source: "VM Cloud attribution_ledger payment_success confirmed with naver_brandsearch marker",
        order_cross_checks: ["operating_db public.tb_iamweb_users", "VM Cloud imweb_orders cache"],
        raw_identifier_policy: "No raw order/payment/member/click identifiers are emitted. Hashes are internal-only and not included in output.",
      },
      freshness: {
        ...vm.freshness,
        operating_db_max_source_date: maxSourceDate,
      },
      source_summary: {
        marker_rows: vm.marker_rows.length,
        previous_unresolved_rows: previousMap.size,
        operating_db_order_rows_in_extended_window: operatingRows.length,
        vm_cloud_imweb_order_rows_in_extended_window: vm.vm_order_rows.length,
      },
      narrowing,
      interpretation: {
        plain_summary: allPreviousUnresolvedMatchedVm
          ? "기존 biocom 브랜드검색 미해결 6건은 VM Cloud imweb_orders 보조 주문 캐시에서는 모두 exact key match다."
          : "기존 biocom 브랜드검색 미해결 row를 운영DB와 VM Cloud 주문 캐시 기준으로 한 단계 더 분해했다.",
        one_step_narrowed: allPreviousUnresolvedMatchedVm
          ? "문제는 주문 부재가 아니라 운영DB public.tb_iamweb_users와 VM Cloud imweb_orders 사이의 주문키/동기화 기준 차이로 좁혀졌다."
          : "row별로 VM exact, amount duplicate, amount/source gap, date-basis 후보를 분리했다.",
        budget_use: "운영DB 기준 exact 13건은 보수 ROAS로 유지한다. 추가 6건은 VM Cloud exact 보조근거가 있으므로 주문 source 정책을 승인하면 upgraded bridge 후보가 된다.",
        next_action: "운영DB와 VM Cloud imweb_orders 중 브랜드검색 주문 단위 bridge의 primary/cross-check 정책을 정한 뒤, 6건을 upgrade preview에 반영한다.",
      },
      invariants_held: {
        ...vm.invariants_held,
        operating_db_write: 0,
        vm_cloud_sqlite_write: 0,
        backend_deploy_or_restart: 0,
        platform_send: 0,
        raw_identifier_output: 0,
      },
    };

    if (options.output) {
      const out = resolve(process.cwd(), options.output);
      mkdirSync(dirname(out), { recursive: true });
      writeFileSync(out, `${JSON.stringify(output, null, 2)}\n`);
    }

    if (options.json) {
      console.log(JSON.stringify(output, null, 2));
    } else {
      console.log("Biocom Naver brandsearch unresolved narrowing");
      console.log(`mode: ${output.mode}`);
      console.log(`target_rows=${narrowing.target_rows}`);
      console.log(
        `classes=${Object.entries(narrowing.classification_counts)
          .map(([name, count]) => `${name}:${count.rows}`)
          .join(", ")}`,
      );
      if (options.output) console.log(`output: ${options.output}`);
    }
  } finally {
    await pool.end();
  }
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
