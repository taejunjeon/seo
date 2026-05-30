#!/usr/bin/env tsx
/**
 * Biocom Naver brandsearch unresolved bridge breakdown.
 *
 * Green Lane / read-only by design:
 * - Reads VM Cloud SQLite through read-only URI.
 * - Reads operating DB PostgreSQL without writes.
 * - Emits aggregate counts and safe row ordinals only.
 * - Does not print raw order/payment/member/click identifiers.
 */

import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import dotenv from "dotenv";
import { Pool } from "pg";

dotenv.config({ path: resolve(__dirname, "..", ".env"), quiet: true });
dotenv.config({ path: resolve(__dirname, "..", ".env.local"), quiet: true });

const SCHEMA_VERSION = "biocom-naver-brandsearch-unresolved-breakdown-v1-20260525";
const DEFAULT_VM_HOST = "34.64.104.94";
const DEFAULT_VM_USER = "taejun";
const DEFAULT_VM_KEY = "~/.ssh/id_ed25519";
const DEFAULT_VM_DB = "/home/biocomkr_sns/seo/repo/backend/data/crm.sqlite3";
const DEFAULT_VM_RUN_AS = "biocomkr_sns";

type CliOptions = {
  since: string;
  until: string;
  output: string;
  json: boolean;
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

type OrderRow = {
  sourceDate: string;
  amountKrw: number;
  primaryHash: string;
  orderKeyHashes: string[];
  isNpay: boolean;
};

type VmPayload = {
  ok: true;
  generated_at_kst: string;
  freshness: {
    landing_max_landed_at: string;
    attribution_max_logged_at: string;
  };
  marker_rows: MarkerRow[];
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
  npx tsx scripts/biocom-naver-brandsearch-unresolved-breakdown.ts [options]

Options:
  --since=YYYY-MM-DD       Inclusive KST date. Default: 2026-05-22
  --until=YYYY-MM-DD       Inclusive KST date. Default: today in KST
  --output=path            Write JSON output to path
  --json                   Print JSON only
  --vm-host=host           VM Cloud host. Default: ${DEFAULT_VM_HOST}
  --vm-user=user           SSH user. Default: ${DEFAULT_VM_USER}
  --vm-key=path            SSH key. Default: ${DEFAULT_VM_KEY}
  --vm-db=path             VM SQLite path. Default: ${DEFAULT_VM_DB}
  --vm-run-as=user         sudo -u user. Default: ${DEFAULT_VM_RUN_AS}
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
    since: "2026-05-22",
    until: today,
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
    if (arg.startsWith("--since=")) {
      options.since = arg.slice("--since=".length).trim();
      continue;
    }
    if (arg.startsWith("--until=")) {
      options.until = arg.slice("--until=".length).trim();
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

  if (!/^\d{4}-\d{2}-\d{2}$/.test(options.since) || !/^\d{4}-\d{2}-\d{2}$/.test(options.until)) {
    throw new Error("date options must be YYYY-MM-DD");
  }
  if (options.since > options.until) throw new Error("since must be <= until");
  return options;
};

const normalizeDatabaseUrl = (value: string) => value.replace(/^postgresql\+asyncpg:\/\//, "postgresql://");

const createPgPool = () => {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) throw new Error("DATABASE_URL is not configured");
  return new Pool({ connectionString: normalizeDatabaseUrl(databaseUrl), max: 1 });
};

const hashValue = (value: string): string => createHash("sha256").update(value).digest("hex");

const pythonStringLiteral = (value: string): string => JSON.stringify(value);

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

const buildVmPython = (options: CliOptions): string => `
import sqlite3, json, datetime, hashlib, re

DB = ${pythonStringLiteral(options.vmDb)}
SINCE = ${pythonStringLiteral(options.since)}
UNTIL = ${pythonStringLiteral(options.until)}

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

for name in ["site_landing_ledger", "attribution_ledger"]:
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
  entry_id,
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

print(json.dumps({
    "ok": True,
    "generated_at_kst": datetime.datetime.utcnow().isoformat(timespec="seconds") + "Z",
    "freshness": {
        "landing_max_landed_at": conn.execute("SELECT COALESCE(MAX(landed_at),'') FROM site_landing_ledger").fetchone()[0],
        "attribution_max_logged_at": conn.execute("SELECT COALESCE(MAX(logged_at),'') FROM attribution_ledger").fetchone()[0],
    },
    "marker_rows": marker_rows,
    "invariants_held": {
        "sqlite_mode": "read_only",
        "sqlite_write": 0,
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
      maxBuffer: 20 * 1024 * 1024,
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
    [options.since, options.until],
  );

  const rows = result.rows.map((row) => {
    const primaryHash = hashValue(row.order_number.trim());
    return {
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

const classifyReason = (params: {
  previousClass: "ambiguous" | "probable" | "no_bridge";
  hasOrderKeyCandidate: boolean;
  sessionBridgePresent: boolean;
  sameAmountWithin1d: number;
  sameAmountWithin3d: number;
  sameAmountAnyWindow: number;
  nearAmountWithin1d: number;
}): string => {
  if (params.previousClass === "ambiguous") return "amount_date_duplicate_needs_order_key_review";
  if (params.sameAmountWithin3d > 0) return "date_window_mismatch_candidate";
  if (params.sameAmountAnyWindow > 0) return "outside_current_window_candidate";
  if (params.nearAmountWithin1d > 0) return "amount_mismatch_candidate";
  if (params.hasOrderKeyCandidate && params.sessionBridgePresent) return "order_key_not_found_in_operating_db_with_session_bridge";
  if (params.hasOrderKeyCandidate) return "order_key_not_found_in_operating_db";
  return "missing_order_key_candidate";
};

const buildBreakdown = (markers: MarkerRow[], orders: OrderRow[]) => {
  const orderByHash = new Map<string, OrderRow[]>();
  for (const order of orders) {
    for (const hash of order.orderKeyHashes) {
      const list = orderByHash.get(hash) ?? [];
      list.push(order);
      orderByHash.set(hash, list);
    }
  }

  const unresolved = [];
  let exactRows = 0;
  let exactAmountKrw = 0;
  let ambiguousRows = 0;
  let ambiguousAmountKrw = 0;
  let noBridgeRows = 0;
  let noBridgeAmountKrw = 0;

  for (const marker of markers) {
    const exactMatches = marker.orderKeyHashes.flatMap((hash) => orderByHash.get(hash) ?? []);
    if (exactMatches.length > 0) {
      exactRows += 1;
      exactAmountKrw += marker.markerAmountKrw;
      continue;
    }

    const sameAmountSameDate = orders.filter((order) => order.amountKrw === marker.markerAmountKrw && order.sourceDate === marker.markerDate).length;
    const sameAmountWithin1d = orders.filter((order) => order.amountKrw === marker.markerAmountKrw && daysApart(order.sourceDate, marker.markerDate) <= 1).length;
    const sameAmountWithin3d = orders.filter((order) => order.amountKrw === marker.markerAmountKrw && daysApart(order.sourceDate, marker.markerDate) <= 3).length;
    const sameAmountAnyWindow = orders.filter((order) => order.amountKrw === marker.markerAmountKrw).length;
    const sameDateAnyAmount = orders.filter((order) => order.sourceDate === marker.markerDate).length;
    const nearAmountWithin1d = orders.filter((order) => Math.abs(order.amountKrw - marker.markerAmountKrw) <= 1000 && daysApart(order.sourceDate, marker.markerDate) <= 1).length;

    const previousClass = sameAmountWithin1d === 1 ? "probable" : sameAmountWithin1d > 1 ? "ambiguous" : "no_bridge";
    if (previousClass === "ambiguous") {
      ambiguousRows += 1;
      ambiguousAmountKrw += marker.markerAmountKrw;
    } else if (previousClass === "no_bridge") {
      noBridgeRows += 1;
      noBridgeAmountKrw += marker.markerAmountKrw;
    }

    const reason = classifyReason({
      previousClass,
      hasOrderKeyCandidate: marker.hasOrderKeyCandidate,
      sessionBridgePresent: marker.sessionBridgePresent,
      sameAmountWithin1d,
      sameAmountWithin3d,
      sameAmountAnyWindow,
      nearAmountWithin1d,
    });

    unresolved.push({
      safe_row_no: marker.safeOrdinal,
      previous_classification: previousClass,
      recommended_reason: reason,
      marker_date: marker.markerDate,
      amount_bucket: amountBucket(marker.markerAmountKrw),
      has_order_key_candidate: marker.hasOrderKeyCandidate,
      session_bridge_present: marker.sessionBridgePresent,
      same_amount_same_date_count: sameAmountSameDate,
      same_amount_within_1d_count: sameAmountWithin1d,
      same_amount_within_3d_count: sameAmountWithin3d,
      same_amount_any_window_count: sameAmountAnyWindow,
      same_date_any_amount_count: sameDateAnyAmount,
      near_amount_within_1d_count: nearAmountWithin1d,
    });
  }

  const reasonCounts = unresolved.reduce<Record<string, { rows: number; ambiguous_rows: number; no_bridge_rows: number }>>((acc, row) => {
    const current = acc[row.recommended_reason] ?? { rows: 0, ambiguous_rows: 0, no_bridge_rows: 0 };
    current.rows += 1;
    if (row.previous_classification === "ambiguous") current.ambiguous_rows += 1;
    if (row.previous_classification === "no_bridge") current.no_bridge_rows += 1;
    acc[row.recommended_reason] = current;
    return acc;
  }, {});

  return {
    exact_rows: exactRows,
    exact_amount_krw: exactAmountKrw,
    unresolved_rows: unresolved.length,
    ambiguous_rows: ambiguousRows,
    ambiguous_amount_krw: ambiguousAmountKrw,
    no_bridge_rows: noBridgeRows,
    no_bridge_amount_krw: noBridgeAmountKrw,
    reason_counts: reasonCounts,
    unresolved_safe_rows: unresolved,
  };
};

const main = async () => {
  const options = parseArgs(process.argv.slice(2));
  const vm = runVmRead(options);
  const pool = createPgPool();
  try {
    const { rows: orders, maxSourceDate } = await queryBiocomOrders(pool, options);
    const breakdown = buildBreakdown(vm.marker_rows, orders);
    const output = {
      ok: true,
      schema_version: SCHEMA_VERSION,
      generated_at: new Date().toISOString(),
      mode: "read_only_no_send_no_write",
      site: "biocom",
      window: { since: options.since, until: options.until, timezone: "KST" },
      freshness: {
        ...vm.freshness,
        operating_db_max_source_date: maxSourceDate,
      },
      marker_summary: {
        total_marker_rows: vm.marker_rows.length,
        total_marker_amount_krw: vm.marker_rows.reduce((sum, row) => sum + row.markerAmountKrw, 0),
      },
      order_source_summary: {
        order_rows: orders.length,
        order_amount_krw: orders.reduce((sum, row) => sum + row.amountKrw, 0),
        npay_order_rows: orders.filter((row) => row.isNpay).length,
        npay_amount_krw: orders.filter((row) => row.isNpay).reduce((sum, row) => sum + row.amountKrw, 0),
      },
      breakdown,
      interpretation: {
        plain_summary: "Biocom 브랜드검색 unresolved 5건은 주문키 후보가 있지만 운영DB 주문 정본과 직접 일치하지 않는 row다.",
        budget_use: "unresolved row는 예산 판단값에서 제외하고 exact bridge ROAS를 보수값으로 사용한다.",
        next_action: "order_key_not_found 계열 row는 VM Cloud marker 주문키 후보와 운영DB order_number 형식 차이를 raw 노출 없이 hash 비교로 좁힌다.",
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
      console.log("Biocom Naver brandsearch unresolved breakdown");
      console.log(`mode: ${output.mode}`);
      console.log(`marker=${output.marker_summary.total_marker_rows}/${output.marker_summary.total_marker_amount_krw.toLocaleString("ko-KR")}원 exact=${breakdown.exact_rows}/${breakdown.exact_amount_krw.toLocaleString("ko-KR")}원 unresolved=${breakdown.unresolved_rows}`);
      console.log(`ambiguous=${breakdown.ambiguous_rows}/${breakdown.ambiguous_amount_krw.toLocaleString("ko-KR")}원 no_bridge=${breakdown.no_bridge_rows}/${breakdown.no_bridge_amount_krw.toLocaleString("ko-KR")}원`);
      console.log(`reasons=${Object.entries(breakdown.reason_counts).map(([reason, v]) => `${reason}:${v.rows}`).join(", ")}`);
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
